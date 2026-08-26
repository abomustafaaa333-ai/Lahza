import { and, desc, eq, gt, gte, inArray, isNull, lt, lte, or, sql } from "drizzle-orm";
import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { jwtVerify, SignJWT } from "jose";
import { parse } from "cookie";
import { z } from "zod";
import { catalogItems, customCategories, customerPresence, customerProfiles, customerAccounts, customerNotifications, drivers, financeEntries, intercityOrders, intercityTrips, inventoryMovements, lahzaEmployees, missingProductRequests, notificationCampaigns, orderAssignments, orderLines, orders, partnerOffers, partners, customerReferrals, customerPoints, discountCodes, pointTransactions, storeTrafficEvents, stores, supportContacts, supervisors, systemSettings } from "../drizzle/schema";
import { calculatePercentageDeliveryFeeNewSyp, catalogSeed, customerDeliveryCategories, DEFAULT_TICKER_PRIMARY, DEFAULT_TICKER_SECONDARY, formatNewSyp, normalizeTickerText, toLegacySyp, toNewSyp, type LahzaCategory } from "../shared/lahza";
import { isStoreClosedForCustomer } from "../shared/storeAvailability";
import { getDb } from "./db";
import { demoProductImages, demoProductTemplates, type DemoStoreCategory } from "./demoCatalog";
import { getSessionCookieOptions } from "./_core/cookies";
import { getDirections } from "./maps";
import { cleanExpiredOffers } from "./expiredOffers";
import { cleanExpiredOrders, isOrderArchived } from "./orderLifecycle";
import { deleteOfferImage, uploadOfferImage } from "./offerMedia";
import { publicProcedure, router } from "./_core/trpc";
import type { TrpcContext } from "./_core/context";

const scrypt = promisify(scryptCallback);
const ADMIN_COOKIE = "lahza_admin_session";
const PARTNER_COOKIE = "lahza_partner_session";
const categories = ["restaurants", "groceries", "household", "produce", "bakery", "butcher", "gas", "pharmacy", "sweets", "clothing", "mobile_accessories", "beauty_personal_care", "baby", "school_stationery", "chicken", "breakfast", "lamb", "fuel", "other", "offers", "beauty_boutique"] as const;
const restaurantTypes = ["all", "breakfast", "chicken", "grills", "sandwiches"] as const;
const adminRoles = ["owner", "supervisor"] as const;
const orderStatuses = ["pending", "confirmed", "preparing", "on_the_way", "completed", "cancelled", "rejected"] as const;
export type PartnerReportRow = { orderId: number; status: (typeof orderStatuses)[number]; totalAmount: number; itemName: string; quantity: string };
export function summarizePartnerReportRows(rows: PartnerReportRow[]) {
  const byOrder = new Map<number, PartnerReportRow>();
  rows.forEach(row => { if (!byOrder.has(row.orderId)) byOrder.set(row.orderId, row); });
  const orderRows = Array.from(byOrder.values());
  const completed = orderRows.filter(row => row.status === "completed").length;
  const cancelled = orderRows.filter(row => row.status === "cancelled" || row.status === "rejected").length;
  const sales = orderRows.filter(row => row.status !== "cancelled" && row.status !== "rejected").reduce((sum, row) => sum + row.totalAmount, 0);
  const products = new Map<string, number>();
  rows.forEach(row => products.set(row.itemName, (products.get(row.itemName) ?? 0) + (Number.parseFloat(row.quantity) || 0)));
  const topProducts = Array.from(products.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, quantity]) => ({ name, quantity }));
  return { orders: byOrder.size, completed, cancelled, sales, topProducts };
}
const MANBIJ_CENTER = { lat: 36.5281, lng: 37.9549 };

type AdminRole = (typeof adminRoles)[number];
type AdminSession = { role: AdminRole; supervisorId?: number };
type PartnerSession = { partnerId: number };
type AdminSessionPayload = AdminSession & { runtimeId: string };
type PartnerSessionPayload = PartnerSession & { runtimeId: string };

export function filterRestaurantStores<T extends { restaurantType: (typeof restaurantTypes)[number] }>(items: T[], category: (typeof categories)[number], restaurantType?: (typeof restaurantTypes)[number]) {
  if (category !== "restaurants" || !restaurantType || restaurantType === "all") return items;
  return items.filter(store => store.restaurantType === restaurantType || store.restaurantType === "all");
}

const passwordSchema = z.string().min(4, "يجب أن تتكون كلمة المرور من 4 أحرف أو أرقام على الأقل").max(100);
const coordinateSchema = z.number().finite("إحداثيات الموقع غير صالحة");
const newSypMoneyInput = z.number().finite("أدخل سعراً صالحاً").int("أدخل مبلغاً صحيحاً من دون كسور").min(0).max(10_000_000);
const deliveryPercentInput = z.number().finite("أدخل نسبة صالحة").int("أدخل نسبة صحيحة").min(0).max(100);

export function calculateDeliveryFee(distanceMeters: number, pricePerKm: number) {
  const billableKm = Math.max(1, Math.ceil(Math.max(0, distanceMeters) / 1000));
  return { billableKm, deliveryFee: billableKm * Math.max(0, pricePerKm) };
}

export function calculatePercentageDeliveryFee(itemsTotalInLegacySyp: number, percentage: number) {
  return toLegacySyp(calculatePercentageDeliveryFeeNewSyp(itemsTotalInLegacySyp, percentage));
}

export const DELIVERY_PRICING_PENDING_NOTE = "رسوم التوصيل: يحددها فريق لحظة لاحقاً لعدم توفر حساب مسافة الطريق حالياً.";

export function pendingDeliveryCalculation() {
  return { deliveryDistanceMeters: 0, deliveryFee: 0, deliveryPricingPending: true };
}

export function canReserveIntercityTrip(capacity: number, reservedOrders: number) {
  return Number.isInteger(capacity) && capacity > 0 && reservedOrders >= 0 && reservedOrders < capacity;
}

export function readTickerSettings(settings: { tickerPrimary?: unknown; tickerSecondary?: unknown }) {
  return {
    tickerPrimary: normalizeTickerText(settings.tickerPrimary, DEFAULT_TICKER_PRIMARY),
    tickerSecondary: normalizeTickerText(settings.tickerSecondary, DEFAULT_TICKER_SECONDARY),
  };
}

function isDuplicateColumnError(error: unknown) {
  return error instanceof Error && /duplicate column name/i.test(error.message);
}

async function addTickerColumnIfMissing(db: NonNullable<Awaited<ReturnType<typeof getDb>>>, name: "tickerPrimary" | "tickerSecondary", defaultValue: string) {
  try {
    await db.execute(sql.raw(`ALTER TABLE \`system_settings\` ADD COLUMN \`${name}\` VARCHAR(220) NOT NULL DEFAULT '${defaultValue.replace(/'/g, "''")}'`));
  } catch (error) {
    if (!isDuplicateColumnError(error)) throw error;
  }
}

async function ensureTickerColumns(db: NonNullable<Awaited<ReturnType<typeof getDb>>>) {
  const [columns] = await db.execute(sql.raw("SHOW COLUMNS FROM `system_settings`"));
  const availableColumns = new Set(
    Array.isArray(columns)
      ? columns.map(column => String((column as { Field?: unknown }).Field ?? ""))
      : [],
  );

  if (!availableColumns.has("tickerPrimary")) {
    await addTickerColumnIfMissing(db, "tickerPrimary", DEFAULT_TICKER_PRIMARY);
  }
  if (!availableColumns.has("tickerSecondary")) {
    await addTickerColumnIfMissing(db, "tickerSecondary", DEFAULT_TICKER_SECONDARY);
  }
}

async function ensureCustomerAccountsTable(db: NonNullable<Awaited<ReturnType<typeof getDb>>>) {
  await db.execute(sql.raw(`CREATE TABLE IF NOT EXISTS \`customer_accounts\` (\`id\` INT NOT NULL AUTO_INCREMENT, \`phone\` VARCHAR(24) NOT NULL, \`name\` VARCHAR(80) NOT NULL, \`status\` ENUM('pending','approved','rejected','suspended') NOT NULL DEFAULT 'pending', \`verifiedAt\` TIMESTAMP NULL, \`verifiedBy\` VARCHAR(80) NULL, \`rejectionReason\` VARCHAR(300) NULL, \`lastOrderId\` INT NULL, \`createdAt\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, \`updatedAt\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, PRIMARY KEY (\`id\`), UNIQUE KEY \`customer_accounts_phone_unique\` (\`phone\`)\`)`));
}

async function ensureProfileImageColumns(db: NonNullable<Awaited<ReturnType<typeof getDb>>>) {
  for (const [table, name] of [["stores", "imageUrl"], ["partners", "imageUrl"]] as const) {
    const [columns] = await db.execute(sql.raw(`SHOW COLUMNS FROM \`${table}\``));
    const present = new Set(Array.isArray(columns) ? columns.map(column => String((column as { Field?: unknown }).Field ?? "")) : []);
    if (!present.has(name)) await db.execute(sql.raw(`ALTER TABLE \`${table}\` ADD COLUMN \`${name}\` VARCHAR(500) NULL`));
  }
}

async function addDeliveryPercentColumnIfMissing(db: NonNullable<Awaited<ReturnType<typeof getDb>>>, name: "manbijDeliveryPercent" | "jarabulusDeliveryPercent", defaultValue: number) {
  try {
    await db.execute(sql.raw(`ALTER TABLE \`system_settings\` ADD COLUMN \`${name}\` INT NOT NULL DEFAULT ${defaultValue}`));
  } catch (error) {
    if (!isDuplicateColumnError(error)) throw error;
  }
}

async function ensureDeliveryPercentColumns(db: NonNullable<Awaited<ReturnType<typeof getDb>>>) {
  const [columns] = await db.execute(sql.raw("SHOW COLUMNS FROM `system_settings`"));
  const availableColumns = new Set(
    Array.isArray(columns)
      ? columns.map(column => String((column as { Field?: unknown }).Field ?? ""))
      : [],
  );
  if (!availableColumns.has("manbijDeliveryPercent")) await addDeliveryPercentColumnIfMissing(db, "manbijDeliveryPercent", 20);
  if (!availableColumns.has("jarabulusDeliveryPercent")) await addDeliveryPercentColumnIfMissing(db, "jarabulusDeliveryPercent", 30);
}

async function saveTickerSettings(db: NonNullable<Awaited<ReturnType<typeof getDb>>>, tickerSettings: ReturnType<typeof readTickerSettings>) {
  await ensureTickerColumns(db);
  await db.execute(sql`
    UPDATE \`system_settings\`
    SET \`tickerPrimary\` = ${tickerSettings.tickerPrimary}, \`tickerSecondary\` = ${tickerSettings.tickerSecondary}
    WHERE \`id\` = 1
  `);
}

export const tickerSettingsInputSchema = z.object({
  tickerPrimary: z.string().optional(),
  tickerSecondary: z.string().optional(),
}).transform(input => readTickerSettings(input));

async function hashSecret(value: string) {
  const salt = randomBytes(16).toString("hex");
  const derived = (await scrypt(value, salt, 64)) as Buffer;
  return `${salt}:${derived.toString("hex")}`;
}

async function verifySecret(value: string, stored: string) {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const derived = (await scrypt(value, salt, 64)) as Buffer;
  const storedBuffer = Buffer.from(hash, "hex");
  return storedBuffer.length === derived.length && timingSafeEqual(storedBuffer, derived);
}

function sessionKey() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("مفتاح الجلسة غير مهيأ");
  return new TextEncoder().encode(secret);
}

async function createSession(payload: AdminSessionPayload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("12h")
    .sign(sessionKey());
}

async function createPartnerSession(payload: PartnerSessionPayload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("12h")
    .sign(sessionKey());
}

export function isAuthRuntimeId(value: unknown): value is string {
  return typeof value === "string" && /^[a-zA-Z0-9-]{16,160}$/.test(value);
}

export function hasMatchingAuthRuntime(requestRuntimeId: unknown, tokenRuntimeId: unknown) {
  return isAuthRuntimeId(requestRuntimeId) && isAuthRuntimeId(tokenRuntimeId) && requestRuntimeId === tokenRuntimeId;
}

function getAuthRuntimeId(ctx: TrpcContext) {
  const header = ctx.req.headers["x-lahza-auth-runtime"];
  const value = Array.isArray(header) ? header[0] : header;
  return isAuthRuntimeId(value) ? value : null;
}

async function readSession(ctx: TrpcContext): Promise<AdminSession | null> {
  const token = parse(ctx.req.headers.cookie ?? "")[ADMIN_COOKIE];
  const runtimeId = getAuthRuntimeId(ctx);
  if (!token || !runtimeId) return null;
  try {
    const { payload } = await jwtVerify(token, sessionKey());
    if ((payload.role !== "owner" && payload.role !== "supervisor") || !hasMatchingAuthRuntime(runtimeId, payload.runtimeId)) return null;
    return { role: payload.role, supervisorId: typeof payload.supervisorId === "number" ? payload.supervisorId : undefined };
  } catch {
    return null;
  }
}

async function readPartnerSession(ctx: TrpcContext): Promise<PartnerSession | null> {
  const token = parse(ctx.req.headers.cookie ?? "")[PARTNER_COOKIE];
  const runtimeId = getAuthRuntimeId(ctx);
  if (!token || !runtimeId) return null;
  try {
    const { payload } = await jwtVerify(token, sessionKey());
    if (typeof payload.partnerId !== "number" || !hasMatchingAuthRuntime(runtimeId, payload.runtimeId)) return null;
    return { partnerId: payload.partnerId };
  } catch {
    return null;
  }
}

async function requireAdmin(ctx: TrpcContext, allowed: AdminRole[] = [...adminRoles]) {
  const session = await readSession(ctx);
  if (!session || !allowed.includes(session.role)) {
    throw new Error("غير مصرح لك بتنفيذ هذا الإجراء");
  }
  return session;
}

async function requirePartner(ctx: TrpcContext) {
  const session = await readPartnerSession(ctx);
  if (!session) throw new Error("سجل دخولك بحساب الشريك أولاً");
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً");
  const found = await db.select().from(partners).where(and(eq(partners.id, session.partnerId), eq(partners.active, true))).limit(1);
  if (!found[0]) throw new Error("حساب الشريك غير متاح حالياً");
  return { db, partner: found[0] };
}

async function requirePartnerStore(ctx: TrpcContext, storeId: number) {
  const { db, partner } = await requirePartner(ctx);
  const found = await db.select().from(stores).where(and(eq(stores.id, storeId), eq(stores.partnerId, partner.id), eq(stores.active, true))).limit(1);
  if (!found[0]) throw new Error("هذا المتجر غير معيّن لحسابك أو غير متاح حالياً");
  return { db, partner, store: found[0] };
}

function setAdminCookie(ctx: TrpcContext, token: string) {
  ctx.res.cookie(ADMIN_COOKIE, token, {
    ...getSessionCookieOptions(ctx.req),
  });
  ctx.res.clearCookie(PARTNER_COOKIE, getSessionCookieOptions(ctx.req));
}

function setPartnerCookie(ctx: TrpcContext, token: string) {
  ctx.res.cookie(PARTNER_COOKIE, token, {
    ...getSessionCookieOptions(ctx.req),
  });
  ctx.res.clearCookie(ADMIN_COOKIE, getSessionCookieOptions(ctx.req));
}

async function getSettings() {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً");
  await ensureDeliveryPercentColumns(db);
  await ensureTickerColumns(db);
  const current = await db.select().from(systemSettings).where(eq(systemSettings.id, 1)).limit(1);
  if (current[0]) return current[0];
  const masterPinHash = await hashSecret("5555");
  await db.insert(systemSettings).values({ id: 1, masterPinHash, manbijDeliveryPercent: 20, jarabulusDeliveryPercent: 30, tickerPrimary: DEFAULT_TICKER_PRIMARY, tickerSecondary: DEFAULT_TICKER_SECONDARY });
  const created = await db.select().from(systemSettings).where(eq(systemSettings.id, 1)).limit(1);
  return created[0]!;
}

async function getDrivingQuote(customerLat: number, customerLng: number) {
  const settings = await getSettings();
  const originLat = settings.originLatE6 / 1_000_000;
  const originLng = settings.originLngE6 / 1_000_000;
  const response = await getDirections({
    origin: `${originLat},${originLng}`,
    destination: `${customerLat},${customerLng}`,
    mode: "driving",
    language: "ar",
    region: "sy",
  });
  const leg = response.routes?.[0]?.legs?.[0];
  if (response.status !== "OK" || !leg?.distance?.value) throw new Error("تعذر حساب مسافة الطريق حالياً. حاول مجدداً بعد لحظات.");
  const { billableKm, deliveryFee } = calculateDeliveryFee(leg.distance.value, settings.deliveryPricePerKm);
  return {
    origin: { lat: originLat, lng: originLng },
    distanceMeters: leg.distance.value,
    distanceText: leg.distance.text,
    distanceKm: Math.round((leg.distance.value / 1000) * 10) / 10,
    billableKm,
    pricePerKm: settings.deliveryPricePerKm,
    deliveryFee,
  };
}

const demoStoreNames: Record<(typeof customerDeliveryCategories)[number], string[]> = {
  restaurants: ["مذاق الساحة", "دار المشاوي", "بيت الشاورما", "مطبخ الياسمين", "لقمة هنية"],
  groceries: ["سوق الندى", "بقالة البركة", "سلة البيت", "مؤونة الحارة", "ميني ماركت الورد"],
  household: ["بيت الأناقة", "دار النظافة", "لمسة منزل", "ركن الترتيب", "أساس البيت"],
  produce: ["خيرات الأرض", "بستان اليوم", "سلة الفلاح", "خضار الضيعة", "قطاف طازج"],
  pharmacy: ["صيدلية العافية", "دواء وراحة", "ركن الصحة", "شفاء بلس", "صيدلية الياسمين"],
  bakery: ["أفران الصباح", "خبز وريحان", "فرن الذهب", "رغيف الدار", "مخبز القمح"],
  sweets: ["حلويات السعادة", "سكر وزهر", "بيت الكنافة", "حلا الشام", "لقمة سكر"],
  butcher: ["ملحمة النخبة", "لحوم الساحة", "مذاق اللحم", "ملحمة البركة", "الذبيحة الطازجة"],
  baby: ["عالم الصغار", "بيت البيبي", "خطوة طفل", "صغيري ستور", "أمومة وطفولة"],
  school_stationery: ["مكتبة القلم", "دفتر وألوان", "قرطاسية النور", "مكتبة المعرفة", "ركن الطالب"],
  beauty_personal_care: ["لمسة جمال", "عطر وورد", "بيت العناية", "إشراقة", "جمالك بلس"],
  mobile_accessories: ["موبايل بلس", "ركن التقنية", "إكسسوارك", "شاشة وجراب", "تقنية اليوم"],
  clothing: ["أناقة الورد", "خزانة مودا", "لمسة قماش", "ستايل البيت", "موضة اليوم"],
  gas: ["غاز الحارة", "بيت الدفء", "أسطوانة بلس", "غاز الأمان", "خدمة الغاز"],
};

async function ensureDemoStores(db: NonNullable<Awaited<ReturnType<typeof getDb>>>) {
  for (const category of customerDeliveryCategories) {
    const existing = await db.select({ id: stores.id }).from(stores).where(eq(stores.category, category)).orderBy(stores.sortOrder, stores.id).limit(5);
    if (existing.length >= 5) continue;
    const missingNames = demoStoreNames[category].slice(existing.length, 5);
    for (let index = 0; index < missingNames.length; index += 1) {
      const name = missingNames[index];
      await db.insert(stores).values({ name, category, restaurantType: "all", active: true, sortOrder: 900 + existing.length + index });
    }
  }
}

async function ensureDemoProducts(db: NonNullable<Awaited<ReturnType<typeof getDb>>>) {
  for (const category of customerDeliveryCategories) {
    const demoStores = await db.select({ id: stores.id }).from(stores).where(and(eq(stores.category, category), gte(stores.sortOrder, 900))).orderBy(stores.sortOrder, stores.id).limit(5);
    for (const store of demoStores) {
      const templates = demoProductTemplates[category as DemoStoreCategory];
      for (let index = 0; index < templates.length; index += 1) {
        const product = templates[index];
        const code = `demo-${category}-${store.id}-${index + 1}`;
        const imageUrl = demoProductImages[category as DemoStoreCategory];
        const estimatedUnitPrice = toLegacySyp(product.estimatedPrice);
        await db.insert(catalogItems).values({ code, name: product.name, category, unit: product.unit, unitPrice: estimatedUnitPrice, available: true, deleted: false, storeId: store.id, imageUrl }).onDuplicateKeyUpdate({ set: { name: product.name, category, unit: product.unit, unitPrice: sql`IF(${catalogItems.unitPrice} = 0, ${estimatedUnitPrice}, ${catalogItems.unitPrice})`, available: true, deleted: false, imageUrl } });
      }
    }
  }
}

export async function ensureDemoStoresSeed() {
  const db = await getDb();
  if (!db) return;
  await ensureDemoStores(db);
  await ensureDemoProducts(db);
}

async function ensureCatalogSeed() {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً");
  const existing = await db.select({ id: catalogItems.id }).from(catalogItems).limit(1);
  if (existing.length) return db;
  for (const item of catalogSeed) {
    await db.insert(catalogItems).values({
      code: item.code,
      name: item.name,
      category: item.category,
      unit: item.unit,
      unitPrice: 0,
      available: true,
    }).onDuplicateKeyUpdate({ set: { code: item.code } });
  }
  return db;
}

const lineInput = z.object({
  catalogItemId: z.number().int().positive().optional(),
  category: z.enum(categories),
  itemName: z.string().trim().min(1, "أدخل اسم الصنف").max(120),
  quantity: z.number().positive("أدخل كمية صالحة").max(100000),
  unit: z.string().trim().min(1).max(16),
  notes: z.string().trim().max(300).optional(),
});

const catalogItemInput = z.object({
  name: z.string().trim().min(2, "أدخل اسم الصنف").max(160),
  category: z.enum(categories),
  unit: z.enum(["وحدة", "جرام", "ليتر", "قنينة", "طلب"]),
  price: newSypMoneyInput,
  available: z.boolean().default(true),
  storeId: z.number().int().positive().optional(),
  customCategoryId: z.number().int().positive().nullable().optional(),
  imageUrl: z.string().trim().url("أدخل رابط صورة صالحاً").max(500).optional().or(z.literal("")),
});

export const storeInput = z.object({
  name: z.string().trim().min(2, "أدخل اسم المتجر").max(140),
  category: z.enum(categories),
  restaurantType: z.enum(["all", "breakfast", "chicken", "grills", "sandwiches"]).default("all"),
  customCategoryId: z.number().int().positive().nullable().optional(),
  partnerId: z.number().int().positive().nullable().optional(),
  active: z.boolean().default(true),
  sortOrder: z.number().int().min(0).max(10_000).default(0),
  imageUrl: z.string().trim().url("أدخل رابط صورة صالحاً").max(500).optional().or(z.literal("")),
});

const customCategoryInput = z.object({
  title: z.string().trim().min(2, "أدخل اسم القسم").max(120),
  subtitle: z.string().trim().min(2, "أدخل وصفاً مختصراً للقسم").max(180),
  active: z.boolean().default(true),
  sortOrder: z.number().int().min(0).max(10_000).default(0),
});

const partnerAccountInput = z.object({
  name: z.string().trim().min(2, "أدخل اسم الشريك أو المتجر").max(120),
  phone: z.string().trim().regex(/^\+9639\d{8}$/, "أدخل رقم هاتف سورياً صحيحاً يبدأ بـ +9639"),
  password: passwordSchema,
  imageUrl: z.string().trim().url("أدخل رابط صورة صالحاً").max(500).optional().or(z.literal("")),
});

export const supportContactInput = z.object({
  label: z.string().trim().min(2, "أدخل اسماً واضحاً لجهة التواصل").max(80),
  phone: z.string().regex(/^\+9639\d{8}$/, "أدخل رقم هاتف سوري صحيحاً يبدأ بـ +9639"),
  callEnabled: z.boolean(),
  whatsappEnabled: z.boolean(),
  active: z.boolean().default(true),
  sortOrder: z.number().int().min(0).max(100_000).default(0),
}).superRefine((input, context) => {
  if (!input.callEnabled && !input.whatsappEnabled) context.addIssue({ code: "custom", message: "اختر الاتصال أو واتساب لجهة التواصل" });
});

export const driverInput = z.object({
  name: z.string().trim().min(2, "أدخل اسم المندوب").max(80),
  phone: z.string().regex(/^\+9639\d{8}$/, "أدخل رقم مندوب سورياً صحيحاً"),
  vehicleType: z.enum(["motorcycle", "car", "van"]).default("motorcycle"),
  region: z.string().trim().min(2).max(120).default("منبج"),
  active: z.boolean().default(true),
  available: z.boolean().default(true),
});

export const notificationCampaignInput = z.object({
  kind: z.enum(["offer", "event", "reminder"]),
  title: z.string().trim().min(2).max(120),
  body: z.string().trim().min(2).max(300),
  targetPath: z.string().trim().min(1).max(180).default("/"),
  scheduledAt: z.string().datetime().optional(),
  expiresAt: z.string().datetime().optional(),
  active: z.boolean().default(true),
});

export const inventoryMovementInput = z.object({
  catalogItemId: z.number().int().positive(),
  quantityDelta: z.number().int().refine(value => value !== 0, "يجب أن تكون حركة المخزون غير صفرية"),
  reason: z.enum(["purchase", "adjustment", "order_reserved", "order_released"]).default("adjustment"),
  orderId: z.number().int().positive().optional(),
  note: z.string().trim().max(300).optional(),
});

export const financeEntryInput = z.object({
  orderId: z.number().int().positive().optional(),
  kind: z.enum(["order_income", "delivery_fee", "partner_payable", "driver_payable", "adjustment"]),
  direction: z.enum(["credit", "debit"]),
  amount: z.number().int().positive(),
  note: z.string().trim().max(300).optional(),
});

export const partnerProductInput = z.object({
  name: z.string().trim().min(2, "أدخل اسم المنتج").max(160),
  category: z.enum(categories),
  storeId: z.number().int().positive(),
  unit: z.enum(["وحدة", "جرام", "ليتر", "قنينة", "طلب"]),
  price: newSypMoneyInput,
  available: z.boolean().default(true),
  imageUrl: z.string().trim().url("أدخل رابط صورة صالحاً").max(500).optional().or(z.literal("")),
});

export const partnerOfferInput = z.object({
  storeId: z.number().int().positive(),
  catalogItemId: z.number().int().positive("اختر صنف العرض من منتجات متجرك"),
  text: z.string().trim().min(3, "أدخل وصف العرض").max(220),
  imageUrl: z.string().trim().url("أدخل رابط صورة صالحاً").max(500).optional().or(z.literal("")),
  imageStorageKey: z.string().trim().min(1).max(500).optional().or(z.literal("")),
  durationDays: z.number().int().min(1, "اختر مدة عرض لا تقل عن يوم واحد").max(365, "الحد الأقصى لمدة العرض سنة واحدة"),
  offerPrice: newSypMoneyInput.min(1, "أدخل سعر العرض الجديد"),
  active: z.boolean().default(true),
});

export function calculateOfferExpiry(durationDays: number, now = new Date()) {
  return new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);
}

const tripStatusSchema = z.enum(["open", "closed", "dispatching", "arrived"]);
const intercityOrderStatusSchema = z.enum(["new", "accepted", "ready", "collected", "delivered", "cancelled"]);
const tripInput = z.object({
  title: z.string().trim().min(4).max(140),
  bookingCloseLabel: z.string().trim().min(3).max(160),
  arrivalLabel: z.string().trim().min(3).max(160),
  capacity: z.number().int().min(1).max(1000),
  pickupFee: newSypMoneyInput,
  doorstepFee: newSypMoneyInput,
  status: tripStatusSchema.default("open"),
  active: z.boolean().default(true),
});

const intercityOrderInput = z.object({
  tripId: z.number().int().positive(),
  catalogItemId: z.number().int().positive().optional(),
  partnerId: z.number().int().positive().optional(),
  customerName: z.string().trim().min(2).max(80),
  customerPhone: z.string().regex(/^\+9639\d{8}$/, "أدخل رقم الهاتف السوري ابتداءً من 9"),
  locationUrl: z.string().url("حدد موقعك عبر زر تحديد موقعي قبل إرسال الطلب").max(500),
  itemName: z.string().trim().min(2).max(180),
  quantity: z.string().trim().min(1).max(32).default("1"),
  deliveryChoice: z.enum(["pickup_point", "doorstep"]),
  notes: z.string().trim().max(500).optional(),
});

const deviceIdSchema = z.string().trim().min(16, "معرف الجهاز غير صالح").max(80);
const missingProductRequestInput = z.object({
  customerName: z.string().trim().min(2, "أدخل الاسم").max(80),
  customerPhone: z.string().regex(/^\+9639\d{8}$/, "أدخل رقم الهاتف السوري ابتداءً من 9"),
  productName: z.string().trim().min(2, "اكتب اسم المنتج المطلوب").max(180),
  notes: z.string().trim().max(500).optional(),
});
export function calculatePointsReward(itemsTotal: number, percent: number) {
  if (itemsTotal <= 0 || percent <= 0) return 0;
  return Math.min(itemsTotal, Math.floor(itemsTotal * percent / 100));
}

async function awardCustomerPoint(db: NonNullable<Awaited<ReturnType<typeof getDb>>>, customerPhone: string, reason: "order_completed" | "referral_completed", orderId?: number, referralId?: number) {
  if (!customerPhone) return;
  try {
    await db.insert(pointTransactions).values({ customerPhone, points: 1, reason, orderId: orderId ?? null, referralId: referralId ?? null });
  } catch {
    return;
  }
  await db.insert(customerPoints).values({ customerPhone, balance: 1, lifetimeEarned: 1 }).onDuplicateKeyUpdate({ set: { balance: sql`${customerPoints.balance} + 1`, lifetimeEarned: sql`${customerPoints.lifetimeEarned} + 1` } });
}

export function calculateLineTotal(quantity: number, unitPrice: number, unit: string) {
  if (unit === "جرام") return Math.round((quantity / 1000) * unitPrice);
  return Math.round(quantity * unitPrice);
}

export const MINIMUM_DELIVERY_ORDER_SYP = 300;

export function meetsMinimumDeliveryOrder(itemsTotalInLegacySyp: number) {
  return toNewSyp(itemsTotalInLegacySyp) >= MINIMUM_DELIVERY_ORDER_SYP;
}

export function normalizeProductSearchText(value: string) {
  return value.trim().replace(/[%_]/g, "");
}

export function canShowFeaturedOffer(featuredStatus: "none" | "pending" | "approved" | "rejected", active: boolean, expiresAt: Date | null, now = new Date()) {
  return featuredStatus === "approved" && active && (!expiresAt || expiresAt > now);
}

export function initialCustomerOrderStatus(orderType: "delivery" | "taxi", lines: Array<{ priceKnown: boolean; unitPrice: number }>) {
  return orderType === "delivery" && lines.length > 0 && lines.every(line => line.priceKnown && line.unitPrice > 0) ? "preparing" : "pending";
}

async function findStoreForCatalog(db: NonNullable<Awaited<ReturnType<typeof getDb>>>, storeId: number | undefined, category: LahzaCategory) {
  if (!storeId) return null;
  const found = await db.select().from(stores).where(eq(stores.id, storeId)).limit(1);
  const store = found[0];
  if (!store) throw new Error("المتجر المختار غير موجود");
  if (store.category !== category) throw new Error("يجب أن يكون المنتج ضمن القسم نفسه للمتجر المختار");
  return store;
}

async function getActiveCustomCategory(db: NonNullable<Awaited<ReturnType<typeof getDb>>>, customCategoryId: number | null | undefined) {
  if (!customCategoryId) return null;
  const found = await db.select().from(customCategories).where(and(eq(customCategories.id, customCategoryId), eq(customCategories.active, true))).limit(1);
  if (!found[0]) throw new Error("القسم المخصص المختار غير متاح حالياً");
  return found[0];
}

export const orderInputSchema = z.object({
  orderType: z.enum(["delivery", "taxi"]),
  intercityTripId: z.number().int().positive().optional(),
  customerName: z.string().trim().min(2, "أدخل الاسم").max(80),
  customerPhone: z.string().regex(/^\+9639\d{8}$/, "أدخل رقم الهاتف السوري ابتداءً من 9"),
  locationMode: z.enum(["gps", "manual"]).default("gps"),
  locationText: z.string().trim().min(3, "اكتب وصفاً واضحاً لموقعك").max(280).optional(),
  locationUrl: z.string().url("رابط الموقع غير صالح").max(500).optional(),
  locationLat: coordinateSchema.min(-90).max(90).optional(),
  locationLng: coordinateSchema.min(-180).max(180).optional(),
  paymentMethod: z.enum(["sham_cash", "cash"]),
  discountCode: z.string().trim().min(2).max(40).optional(),
  referralCode: z.string().trim().min(2).max(40).optional(),
  usePointsReward: z.boolean().optional(),
  lines: z.array(lineInput).max(30),
  taxiType: z.enum(["standard", "van"]).optional(),
  pickupLocation: z.string().trim().max(220).optional(),
  destination: z.string().trim().max(220).optional(),
  notes: z.string().trim().max(500).optional(),
}).superRefine((input, context) => {
  if (input.orderType === "delivery" && input.lines.length === 0) context.addIssue({ code: "custom", message: "أضف صنفاً واحداً على الأقل" });
  if (input.orderType === "taxi" && (!input.taxiType || !input.pickupLocation || !input.destination)) context.addIssue({ code: "custom", message: "أكمل بيانات التاكسي" });
  if (input.locationMode === "gps" && (!input.locationUrl || input.locationLat === undefined || input.locationLng === undefined)) context.addIssue({ code: "custom", message: "حدد موقعك عبر زر تحديد موقعي أو اختر كتابة الموقع يدوياً" });
  if (input.locationMode === "manual" && !input.locationText) context.addIssue({ code: "custom", message: "اكتب وصفاً واضحاً لموقعك اليدوي" });
});

const adminOrderUpdateInput = z.object({
  id: z.number().int().positive(),
  customerName: z.string().trim().min(2).max(80),
  customerPhone: z.string().regex(/^\+9639\d{8}$/, "أدخل رقم الهاتف السوري ابتداءً من 9"),
  paymentMethod: z.enum(["sham_cash", "cash"]),
  locationMode: z.enum(["gps", "manual"]),
  locationText: z.string().trim().max(280).optional(),
  pickupLocation: z.string().trim().max(220).optional(),
  destination: z.string().trim().max(220).optional(),
  notes: z.string().trim().max(500).optional(),
}).superRefine((input, context) => {
  if (input.locationMode === "manual" && !input.locationText) context.addIssue({ code: "custom", message: "اكتب وصفاً واضحاً للموقع اليدوي" });
});

export const lahzaRouter = router({
  interfaceSettings: router({
    get: publicProcedure.query(async ({ ctx }) => {
      ctx.res.setHeader("Cache-Control", "no-store, max-age=0");
      const settings = await getSettings();
      return readTickerSettings(settings);
    }),
  }),
  deliveryFees: router({
    get: publicProcedure.query(async () => {
      const settings = await getSettings();
      return { manbijPercent: settings.manbijDeliveryPercent, jarabulusPercent: settings.jarabulusDeliveryPercent };
    }),
  }),
  support: router({
    contacts: publicProcedure.query(async () => {
      const db = await getDb();
      if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً");
      return db.select().from(supportContacts).where(eq(supportContacts.active, true)).orderBy(supportContacts.sortOrder, supportContacts.id);
    }),
  }),
  notifications: router({
    feed: publicProcedure.input(z.object({ deviceId: deviceIdSchema })).query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً");
      const now = new Date();
      const campaigns = await db.select().from(notificationCampaigns).where(and(eq(notificationCampaigns.active, true), or(isNull(notificationCampaigns.scheduledAt), lte(notificationCampaigns.scheduledAt, now)), or(isNull(notificationCampaigns.expiresAt), gte(notificationCampaigns.expiresAt, now)))).orderBy(desc(notificationCampaigns.createdAt));
      const reads = await db.select({ campaignId: customerNotifications.campaignId, readAt: customerNotifications.readAt }).from(customerNotifications).where(eq(customerNotifications.deviceId, input.deviceId));
      const readByCampaign = new Map(reads.map(row => [row.campaignId, row.readAt]));
      return campaigns.map(campaign => ({ ...campaign, readAt: readByCampaign.get(campaign.id) ?? null, unread: !readByCampaign.has(campaign.id) }));
    }),
    markRead: publicProcedure.input(z.object({ deviceId: deviceIdSchema, campaignId: z.number().int().positive() })).mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً");
      await db.insert(customerPresence).values({ deviceId: input.deviceId, lastSeen: new Date() }).onDuplicateKeyUpdate({ set: { lastSeen: new Date() } });
      const campaign = await db.select({ id: notificationCampaigns.id }).from(notificationCampaigns).where(and(eq(notificationCampaigns.id, input.campaignId), eq(notificationCampaigns.active, true))).limit(1);
      if (!campaign[0]) throw new Error("الإشعار غير متاح حالياً");
      await db.insert(customerNotifications).values({ campaignId: input.campaignId, deviceId: input.deviceId, readAt: new Date() }).onDuplicateKeyUpdate({ set: { readAt: new Date() } });
      return { success: true };
    }),
  }),
  customers: router({
    touch: publicProcedure.input(z.object({ deviceId: deviceIdSchema })).mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً");
      await db.insert(customerPresence).values({ deviceId: input.deviceId, lastSeen: new Date() }).onDuplicateKeyUpdate({ set: { lastSeen: new Date() } });
      return { success: true };
    }),
    points: router({
      balance: publicProcedure.input(z.object({ phone: z.string().regex(/^\+9639\d{8}$/) })).query(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً");
        const balance = (await db.select().from(customerPoints).where(eq(customerPoints.customerPhone, input.phone)).limit(1))[0];
        const transactions = await db.select().from(pointTransactions).where(eq(pointTransactions.customerPhone, input.phone)).orderBy(desc(pointTransactions.createdAt)).limit(30);
        const settings = await getSettings();
        return { balance: balance?.balance ?? 0, lifetimeEarned: balance?.lifetimeEarned ?? 0, rewardPercent: settings.pointsRewardPercent, transactions };
      }),
    }),
    referral: router({
      getOrCreate: publicProcedure.input(z.object({ phone: z.string().regex(/^\+9639\d{8}$/) })).mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً");
        const existing = await db.select({ code: customerReferrals.code }).from(customerReferrals).where(eq(customerReferrals.ownerPhone, input.phone)).limit(1);
        if (existing[0]) return { code: existing[0].code };
        const code = `LHZ-${randomBytes(4).toString("hex").toUpperCase()}`;
        await db.insert(customerReferrals).values({ code, ownerPhone: input.phone });
        return { code };
      }),
    }),
    dashboard: publicProcedure.query(async ({ ctx }) => {
      await requireAdmin(ctx, ["owner"]);
      const db = await getDb();
      if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً");
      const activeSince = new Date(Date.now() - 2 * 60 * 1000);
      const activeRows = await db.select({ deviceId: customerPresence.deviceId }).from(customerPresence).where(gt(customerPresence.lastSeen, activeSince));
      return { activeVisitors: activeRows.length };
    }),
  }),
  missingProducts: router({
    create: publicProcedure.input(missingProductRequestInput).mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً");
      await db.insert(missingProductRequests).values({ ...input, notes: input.notes || null });
      return { success: true };
    }),
    list: publicProcedure.query(async ({ ctx }) => {
      await requireAdmin(ctx);
      const db = await getDb();
      if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً");
      return db.select().from(missingProductRequests).orderBy(desc(missingProductRequests.createdAt));
    }),
    updateStatus: publicProcedure.input(z.object({ id: z.number().int().positive(), status: z.enum(["new", "contacted", "fulfilled", "closed"]) })).mutation(async ({ ctx, input }) => {
      await requireAdmin(ctx);
      const db = await getDb();
      if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً");
      await db.update(missingProductRequests).set({ status: input.status }).where(eq(missingProductRequests.id, input.id));
      return { success: true };
    }),
  }),
  delivery: router({
    quote: publicProcedure.input(z.object({ locationLat: coordinateSchema.min(-90).max(90), locationLng: coordinateSchema.min(-180).max(180) })).mutation(async ({ input }) => getDrivingQuote(input.locationLat, input.locationLng)),
  }),
  customCategories: router({
    listActive: publicProcedure.query(async () => {
      const db = await getDb();
      if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً");
      return db.select().from(customCategories).where(eq(customCategories.active, true)).orderBy(customCategories.sortOrder, customCategories.title);
    }),
  }),
  catalog: router({
    list: publicProcedure.query(async () => {
      const db = await ensureCatalogSeed();
      return db.select().from(catalogItems).where(eq(catalogItems.deleted, false)).orderBy(catalogItems.category, catalogItems.name);
    }),
    create: publicProcedure.input(catalogItemInput).mutation(async ({ ctx, input }) => {
      await requireAdmin(ctx);
      const db = await getDb();
      if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً");
      const store = await findStoreForCatalog(db, input.storeId, input.category);
      const customCategory = input.category === "other" ? await getActiveCustomCategory(db, store?.customCategoryId ?? input.customCategoryId) : null;
      await db.insert(catalogItems).values({
        code: `custom-${input.category}-${randomBytes(8).toString("hex")}`,
        name: input.name,
        category: input.category,
        unit: input.unit,
        unitPrice: toLegacySyp(input.price),
        available: input.available,
        deleted: false,
        storeId: store?.id ?? null,
        customCategoryId: customCategory?.id ?? null,
        imageUrl: input.imageUrl || null,
      });
      return { success: true };
    }),
    update: publicProcedure.input(catalogItemInput.extend({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      await requireAdmin(ctx);
      const db = await getDb();
      if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً");
      const store = await findStoreForCatalog(db, input.storeId, input.category);
      const customCategory = input.category === "other" ? await getActiveCustomCategory(db, store?.customCategoryId ?? input.customCategoryId) : null;
      await db.update(catalogItems).set({ name: input.name, category: input.category, unit: input.unit, unitPrice: toLegacySyp(input.price), available: input.available, customCategoryId: customCategory?.id ?? null, imageUrl: input.imageUrl || null, ...(input.storeId !== undefined ? { storeId: store?.id ?? null } : {}) }).where(and(eq(catalogItems.id, input.id), eq(catalogItems.deleted, false)));
      return { success: true };
    }),
    uploadImage: publicProcedure.input(z.object({ storeId: z.number().int().positive(), dataUrl: z.string().min(30).max(8_000_000) })).mutation(async ({ ctx, input }) => {
      await requireAdmin(ctx, ["owner"]);
      return uploadOfferImage(input.dataUrl, input.storeId, `catalog-${randomBytes(12).toString("hex")}`);
    }),
    updatePrice: publicProcedure.input(z.object({ id: z.number().int().positive(), price: newSypMoneyInput })).mutation(async ({ ctx, input }) => {
      await requireAdmin(ctx);
      const db = await getDb();
      if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً");
      await db.update(catalogItems).set({ unitPrice: toLegacySyp(input.price) }).where(and(eq(catalogItems.id, input.id), eq(catalogItems.deleted, false)));
      return { success: true };
    }),
    updateAvailability: publicProcedure.input(z.object({ id: z.number().int().positive(), available: z.boolean() })).mutation(async ({ ctx, input }) => {
      await requireAdmin(ctx);
      const db = await getDb();
      if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً");
      await db.update(catalogItems).set({ available: input.available }).where(and(eq(catalogItems.id, input.id), eq(catalogItems.deleted, false)));
      return { success: true };
    }),
    remove: publicProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      await requireAdmin(ctx);
      const db = await getDb();
      if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً");
      await db.update(catalogItems).set({ deleted: true, available: false }).where(and(eq(catalogItems.id, input.id), eq(catalogItems.deleted, false)));
      return { success: true };
    }),
  }),
  storefront: router({
    stores: publicProcedure.input(z.object({ category: z.enum(categories), restaurantType: z.enum(restaurantTypes).optional(), customCategorySlug: z.string().trim().max(80).optional() })).query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً");
      await ensureDemoStores(db);
      const customCategory = input.category === "other" && input.customCategorySlug
        ? (await db.select().from(customCategories).where(and(eq(customCategories.slug, input.customCategorySlug), eq(customCategories.active, true))).limit(1))[0]
        : null;
      if (input.category === "other" && !customCategory) return [];
      const categoryStores = await db.select().from(stores).where(and(eq(stores.category, input.category), eq(stores.active, true), ...(customCategory ? [eq(stores.customCategoryId, customCategory.id)] : []))).orderBy(stores.sortOrder, stores.name);
      const activePartners = await db.select({ id: partners.id, active: partners.active, storeOpen: partners.storeOpen }).from(partners);
      const partnerById = new Map(activePartners.map(partner => [partner.id, partner]));
      const filteredStores = filterRestaurantStores(categoryStores, input.category, input.restaurantType);
      return filteredStores.flatMap(store => {
        if (!store.partnerId) return [{ ...store, storeOpen: true }];
        const partner = partnerById.get(store.partnerId);
        return partner?.active ? [{ ...store, storeOpen: partner.storeOpen }] : [];
      });
    }),
    products: publicProcedure.input(z.object({ storeId: z.number().int().positive() })).query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً");
      const found = await db.select().from(stores).where(and(eq(stores.id, input.storeId), eq(stores.active, true))).limit(1);
      const store = found[0];
      if (!store) throw new Error("هذا المتجر غير متاح حالياً");
      let storeOpen = true;
      if (store.partnerId) {
        const partner = await db.select({ active: partners.active, storeOpen: partners.storeOpen }).from(partners).where(eq(partners.id, store.partnerId)).limit(1);
        if (!partner[0]?.active) throw new Error("هذا المتجر غير متاح حالياً");
        storeOpen = partner[0].storeOpen;
      }
      const products = await db.select().from(catalogItems).where(and(eq(catalogItems.storeId, store.id), eq(catalogItems.deleted, false), eq(catalogItems.available, true))).orderBy(catalogItems.name);
      return { store: { ...store, storeOpen }, products };
    }),
    searchProducts: publicProcedure.input(z.object({ query: z.string().trim().min(2, "اكتب حرفين على الأقل للبحث").max(80) })).query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً");
      const normalizedQuery = normalizeProductSearchText(input.query);
      if (normalizedQuery.length < 2) return [];
      const pattern = `%${normalizedQuery}%`;
      const results = await db.select({
        id: catalogItems.id,
        name: catalogItems.name,
        unit: catalogItems.unit,
        unitPrice: catalogItems.unitPrice,
        available: catalogItems.available,
        storeId: stores.id,
        storeName: stores.name,
        storeCategory: stores.category,
        storeOpen: partners.storeOpen,
      }).from(catalogItems)
        .innerJoin(stores, eq(catalogItems.storeId, stores.id))
        .leftJoin(partners, eq(stores.partnerId, partners.id))
        .where(and(
          eq(catalogItems.deleted, false),
          eq(stores.active, true),
          or(isNull(stores.partnerId), eq(partners.active, true)),
          or(sql`LOWER(${catalogItems.name}) LIKE LOWER(${pattern})`, sql`LOWER(${stores.name}) LIKE LOWER(${pattern})`),
        ))
        .orderBy(desc(catalogItems.available), stores.name, catalogItems.name)
        .limit(30);
      return results.map(result => ({ ...result, price: toNewSyp(result.unitPrice), storeOpen: result.storeOpen ?? true }));
    }),
    availability: publicProcedure.input(z.object({ storeId: z.number().int().positive() })).mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً");
      const found = await db.select({ partnerId: stores.partnerId, active: stores.active }).from(stores).where(eq(stores.id, input.storeId)).limit(1);
      const store = found[0];
      if (!store?.active) throw new Error("هذا المتجر غير متاح حالياً");
      if (!store.partnerId) return { storeOpen: true };
      const partner = await db.select({ active: partners.active, storeOpen: partners.storeOpen }).from(partners).where(eq(partners.id, store.partnerId)).limit(1);
      if (!partner[0]?.active) throw new Error("هذا المتجر غير متاح حالياً");
      return { storeOpen: partner[0].storeOpen };
    }),
  }),
  intercity: router({
    trips: publicProcedure.query(async () => {
      const db = await getDb();
      if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً");
      const trips = await db.select().from(intercityTrips).where(eq(intercityTrips.active, true)).orderBy(desc(intercityTrips.createdAt));
      const activeOrders = await db.select({ tripId: intercityOrders.tripId }).from(intercityOrders).where(inArray(intercityOrders.status, ["new", "accepted", "ready", "collected"]));
      const linkedOrders = await db.select({ tripId: orders.intercityTripId, status: orders.status }).from(orders).where(inArray(orders.status, ["pending", "confirmed", "preparing", "on_the_way"]));
      const reservedByTrip = new Map<number, number>();
      activeOrders.forEach(order => reservedByTrip.set(order.tripId, (reservedByTrip.get(order.tripId) ?? 0) + 1));
      linkedOrders.forEach(order => { if (order.tripId) reservedByTrip.set(order.tripId, (reservedByTrip.get(order.tripId) ?? 0) + 1); });
      return trips.map(trip => ({ ...trip, reservedCount: reservedByTrip.get(trip.id) ?? 0 }));
    }),
    products: publicProcedure.query(async () => {
      const db = await getDb();
      if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً");
      const items = await db.select().from(catalogItems).where(and(eq(catalogItems.deleted, false), eq(catalogItems.available, true)));
      const activePartners = await db.select({ id: partners.id, name: partners.name, storeOpen: partners.storeOpen }).from(partners).where(eq(partners.active, true));
      const partnerById = new Map(activePartners.map(partner => [partner.id, partner]));
      return items.flatMap(item => {
        const partner = item.partnerId ? partnerById.get(item.partnerId) : null;
        return partner ? [{ ...item, partnerName: partner.name, storeOpen: partner.storeOpen }] : [];
      });
    }),
    offers: publicProcedure.input(z.object({ storeId: z.number().int().positive().optional(), includeRegular: z.boolean().optional() }).optional()).query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً");
      await cleanExpiredOffers();
      const now = new Date();
      const featuredOnly = !input?.storeId && !input?.includeRegular;
      const activeOffers = await db.select().from(partnerOffers).where(and(eq(partnerOffers.active, true), or(isNull(partnerOffers.expiresAt), gt(partnerOffers.expiresAt, now)), ...(input?.storeId ? [eq(partnerOffers.storeId, input.storeId)] : featuredOnly ? [eq(partnerOffers.featuredStatus, "approved")] : []))).orderBy(desc(partnerOffers.createdAt));
      const activePartners = await db.select({ id: partners.id, name: partners.name, storeOpen: partners.storeOpen }).from(partners).where(eq(partners.active, true));
      const activeStores = await db.select({ id: stores.id, name: stores.name, category: stores.category, partnerId: stores.partnerId }).from(stores).where(eq(stores.active, true));
      const offerProductIds = activeOffers.flatMap(offer => offer.catalogItemId ? [offer.catalogItemId] : []);
      const offerProducts = offerProductIds.length ? await db.select({ id: catalogItems.id, name: catalogItems.name, unit: catalogItems.unit, unitPrice: catalogItems.unitPrice, imageUrl: catalogItems.imageUrl, storeId: catalogItems.storeId, partnerId: catalogItems.partnerId }).from(catalogItems).where(and(inArray(catalogItems.id, offerProductIds), eq(catalogItems.deleted, false), eq(catalogItems.available, true))) : [];
      const partnerById = new Map(activePartners.map(partner => [partner.id, partner]));
      const storeById = new Map(activeStores.map(store => [store.id, store]));
      const productById = new Map(offerProducts.map(product => [product.id, product]));
      return activeOffers.flatMap(offer => {
        if (featuredOnly && !canShowFeaturedOffer(offer.featuredStatus, offer.active, offer.expiresAt, now)) return [];
        const partner = partnerById.get(offer.partnerId);
        const store = offer.storeId ? storeById.get(offer.storeId) : null;
        const product = offer.catalogItemId ? productById.get(offer.catalogItemId) : null;
        return partner && store?.partnerId === partner.id ? [{ ...offer, partnerName: partner.name, storeName: store.name, storeCategory: store.category, productName: product?.name ?? "عرض مميز", productUnit: product?.unit ?? "قطعة", productPrice: offer.offerPrice > 0 ? offer.offerPrice : (product?.unitPrice ?? 0), originalProductPrice: product?.unitPrice ?? offer.offerPrice, productImageUrl: product?.imageUrl ?? null, storeOpen: partner.storeOpen }] : [];
      });
    }),
    createOrder: publicProcedure.input(intercityOrderInput).mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً");
      const trip = await db.select().from(intercityTrips).where(and(eq(intercityTrips.id, input.tripId), eq(intercityTrips.active, true))).limit(1);
      if (!trip[0] || trip[0].status !== "open") throw new Error("هذه الرحلة غير متاحة للحجز الآن");
      const reserved = await db.select({ id: intercityOrders.id }).from(intercityOrders).where(and(eq(intercityOrders.tripId, input.tripId), inArray(intercityOrders.status, ["new", "accepted", "ready", "collected"])));
      if (!canReserveIntercityTrip(trip[0].capacity, reserved.length)) throw new Error("اكتملت سعة هذه الرحلة، اختر رحلة أخرى");
      const product = input.catalogItemId ? (await db.select().from(catalogItems).where(and(eq(catalogItems.id, input.catalogItemId), eq(catalogItems.deleted, false), eq(catalogItems.available, true))).limit(1))[0] : null;
      const partnerId = product?.partnerId ?? input.partnerId ?? null;
      const itemAmount = product?.unitPrice ?? 0;
      const tripFee = input.deliveryChoice === "doorstep" ? trip[0].doorstepFee : trip[0].pickupFee;
      const created = await db.insert(intercityOrders).values({ tripId: trip[0].id, partnerId, catalogItemId: product?.id ?? null, customerName: input.customerName, customerPhone: input.customerPhone, locationUrl: input.locationUrl, itemName: product?.name ?? input.itemName, quantity: input.quantity, deliveryChoice: input.deliveryChoice, itemAmount, tripFee, status: "new", notes: input.notes ?? null });
      return { success: true, orderId: Number(created[0].insertId), totalAmount: itemAmount + tripFee };
    }),
  }),
  customerAccounts: router({
    register: publicProcedure.input(z.object({ phone: z.string().regex(/^\+9639\d{8}$/, "أدخل رقم واتساب سورياً صحيحاً"), name: z.string().trim().min(2).max(80) })).mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً");
      await ensureCustomerAccountsTable(db);
      const existing = (await db.select().from(customerAccounts).where(eq(customerAccounts.phone, input.phone)).limit(1))[0];
      if (!existing) {
        await db.insert(customerAccounts).values({ phone: input.phone, name: input.name, status: "pending" });
        return { status: "pending" as const, message: "حسابك بانتظار التحقق من فريق لحظة" };
      }
      if (existing.name !== input.name && existing.status !== "approved") await db.update(customerAccounts).set({ name: input.name }).where(eq(customerAccounts.id, existing.id));
      if (existing.status === "approved") return { status: "approved" as const, message: "الحساب موثق ويمكنك متابعة الطلب" };
      if (existing.status === "rejected") return { status: "rejected" as const, message: "تم رفض الحساب، تواصل مع فريق لحظة عبر واتساب" };
      return { status: "pending" as const, message: "حسابك بانتظار التحقق من فريق لحظة" };
    }),
    status: publicProcedure.input(z.object({ phone: z.string().regex(/^\+9639\d{8}$/) })).query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً");
      await ensureCustomerAccountsTable(db);
      const found = (await db.select({ status: customerAccounts.status, name: customerAccounts.name }).from(customerAccounts).where(eq(customerAccounts.phone, input.phone)).limit(1))[0];
      return found ?? { status: "new" as const, name: "" };
    }),
    list: publicProcedure.query(async ({ ctx }) => {
      await requireAdmin(ctx);
      const db = await getDb();
      if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً");
      await ensureCustomerAccountsTable(db);
      const accounts = await db.select().from(customerAccounts).orderBy(desc(customerAccounts.createdAt));
      const phones = accounts.map(account => account.phone);
      const pointsRows = phones.length ? await db.select({ customerPhone: customerPoints.customerPhone, balance: customerPoints.balance }).from(customerPoints).where(inArray(customerPoints.customerPhone, phones)) : [];
      const pointsByPhone = new Map(pointsRows.map(row => [row.customerPhone, row.balance]));
      return accounts.map(account => ({ ...account, points: pointsByPhone.get(account.phone) ?? 0 }));
    }),
    approve: publicProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const session = await requireAdmin(ctx);
      const db = await getDb();
      if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً");
      await ensureCustomerAccountsTable(db);
      await db.update(customerAccounts).set({ status: "approved", verifiedAt: new Date(), verifiedBy: session.role === "owner" ? "المالك" : "المشرف", rejectionReason: null }).where(eq(customerAccounts.id, input.id));
      return { success: true };
    }),
    reject: publicProcedure.input(z.object({ id: z.number().int().positive(), reason: z.string().trim().max(300).optional() })).mutation(async ({ ctx, input }) => {
      await requireAdmin(ctx);
      const db = await getDb();
      if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً");
      await ensureCustomerAccountsTable(db);
      await db.update(customerAccounts).set({ status: "rejected", rejectionReason: input.reason || null }).where(eq(customerAccounts.id, input.id));
      return { success: true };
    }),
  }),
  traffic: router({
    track: publicProcedure.input(z.object({ storeId: z.number().int().positive(), source: z.enum(["direct", "qr"]).default("direct") })).mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً");
      const store = await db.select({ id: stores.id }).from(stores).where(and(eq(stores.id, input.storeId), eq(stores.active, true))).limit(1);
      if (!store[0]) return { success: false } as const;
      await db.insert(storeTrafficEvents).values({ storeId: input.storeId, source: input.source });
      return { success: true } as const;
    }),
  }),
  partner: router({
    session: publicProcedure.query(async ({ ctx }) => {
      const session = await readPartnerSession(ctx);
      if (!session) return null;
      const db = await getDb();
      if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً");
      await ensureProfileImageColumns(db);
      const found = await db.select({ id: partners.id, name: partners.name, username: partners.username, imageUrl: partners.imageUrl, active: partners.active, storeOpen: partners.storeOpen, preparationMinutes: partners.preparationMinutes }).from(partners).where(eq(partners.id, session.partnerId)).limit(1);
      if (!found[0] || !found[0].active) return null;
      const assignedStores = await db.select().from(stores).where(eq(stores.partnerId, found[0].id)).orderBy(stores.category, stores.sortOrder, stores.name);
      return { ...found[0], stores: assignedStores };
    }),
    login: publicProcedure.input(z.object({ password: passwordSchema })).mutation(async ({ ctx, input }) => {
      const runtimeId = getAuthRuntimeId(ctx);
      if (!runtimeId) throw new Error("تعذر تأمين جلسة الشريك، أعد فتح التطبيق وحاول مرة أخرى");
      const db = await getDb();
      if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً");
      const candidates = await db.select().from(partners).where(eq(partners.active, true)).limit(100);
      let found = null;
      for (const candidate of candidates) {
        if (await verifySecret(input.password, candidate.passwordHash)) {
          found = candidate;
          break;
        }
      }
      if (!found) throw new Error("كلمة مرور الشريك غير صحيحة");
      setPartnerCookie(ctx, await createPartnerSession({ partnerId: found.id, runtimeId }));
      return { id: found.id, name: found.name };
    }),
    logout: publicProcedure.mutation(({ ctx }) => {
      ctx.res.clearCookie(PARTNER_COOKIE, getSessionCookieOptions(ctx.req));
      ctx.res.clearCookie(ADMIN_COOKIE, getSessionCookieOptions(ctx.req));
      return { success: true };
    }),
    report: publicProcedure.query(async ({ ctx }) => {
      const { db, partner } = await requirePartner(ctx);
      const assignedStores = await db.select({ id: stores.id, name: stores.name }).from(stores).where(eq(stores.partnerId, partner.id));
      const storeIds = assignedStores.map(store => store.id);
      const now = new Date();
      const periodEnd = new Date(now);
      periodEnd.setHours(23, 59, 59, 999);
      const periodStart = new Date(periodEnd);
      periodStart.setDate(periodStart.getDate() - 6);
      periodStart.setHours(0, 0, 0, 0);
      const previousStart = new Date(periodStart);
      previousStart.setDate(previousStart.getDate() - 7);
      const orderLinesRows = storeIds.length ? await db.select({ orderId: orders.id, status: orders.status, totalAmount: orders.totalAmount, catalogItemId: orderLines.catalogItemId, itemName: orderLines.itemName, quantity: orderLines.quantity, storeId: catalogItems.storeId, createdAt: orders.createdAt }).from(orderLines).innerJoin(orders, eq(orderLines.orderId, orders.id)).innerJoin(catalogItems, eq(orderLines.catalogItemId, catalogItems.id)).where(and(inArray(catalogItems.storeId, storeIds), gte(orders.createdAt, previousStart), lt(orders.createdAt, new Date(periodEnd.getTime() + 1)))) : [];
      const currentRows = orderLinesRows.filter(row => row.createdAt >= periodStart);
      const previousRows = orderLinesRows.filter(row => row.createdAt < periodStart);
      const summarize = (rows: typeof orderLinesRows) => summarizePartnerReportRows(rows);
      const traffic = storeIds.length ? await db.select({ source: storeTrafficEvents.source }).from(storeTrafficEvents).where(and(inArray(storeTrafficEvents.storeId, storeIds), gte(storeTrafficEvents.createdAt, periodStart), lt(storeTrafficEvents.createdAt, new Date(periodEnd.getTime() + 1)))) : [];
      const qrVisits = traffic.filter(event => event.source === "qr").length;
      return { periodStart, periodEnd, stores: assignedStores, current: summarize(currentRows), previous: summarize(previousRows), visits: traffic.length, qrVisits, directVisits: traffic.length - qrVisits };
    }),
    store: router({
      update: publicProcedure.input(z.object({ storeOpen: z.boolean(), preparationMinutes: z.number().int().min(0).max(1440), imageUrl: z.string().trim().url().max(500).optional().or(z.literal("")) })).mutation(async ({ ctx, input }) => {
        const { db, partner } = await requirePartner(ctx);
        await ensureProfileImageColumns(db);
        await db.update(partners).set({ storeOpen: input.storeOpen, preparationMinutes: input.preparationMinutes, imageUrl: input.imageUrl || null }).where(eq(partners.id, partner.id));
        return { success: true };
      }),
      uploadImage: publicProcedure.input(z.object({ dataUrl: z.string().min(30).max(8_000_000) })).mutation(async ({ ctx, input }) => {
        const { partner } = await requirePartner(ctx);
        return uploadOfferImage(input.dataUrl, partner.id, `partner-${randomBytes(12).toString("hex")}`);
      }),
    }),
    stores: router({
      list: publicProcedure.query(async ({ ctx }) => {
        const { db, partner } = await requirePartner(ctx);
        const partnerStores = await db.select().from(stores).where(eq(stores.partnerId, partner.id)).orderBy(stores.category, stores.sortOrder, stores.name);
        const customIds = partnerStores.flatMap(store => store.customCategoryId ? [store.customCategoryId] : []);
        if (!customIds.length) return partnerStores.map(store => ({ ...store, categoryTitle: null }));
        const categoryRows = await db.select({ id: customCategories.id, title: customCategories.title }).from(customCategories).where(inArray(customCategories.id, customIds));
        const titleById = new Map(categoryRows.map(category => [category.id, category.title]));
        return partnerStores.map(store => ({ ...store, categoryTitle: store.customCategoryId ? titleById.get(store.customCategoryId) ?? null : null }));
      }),
    }),
    catalog: router({
      list: publicProcedure.query(async ({ ctx }) => {
        const { db, partner } = await requirePartner(ctx);
        const assignedStores = await db.select({ id: stores.id }).from(stores).where(eq(stores.partnerId, partner.id));
        if (!assignedStores.length) return [];
        return db.select().from(catalogItems).where(and(inArray(catalogItems.storeId, assignedStores.map(store => store.id)), eq(catalogItems.deleted, false))).orderBy(desc(catalogItems.createdAt));
      }),
      create: publicProcedure.input(partnerProductInput).mutation(async ({ ctx, input }) => {
        const { db, partner, store } = await requirePartnerStore(ctx, input.storeId);
        if (store.category !== input.category) throw new Error("يمكنك إضافة منتجات القسم الخاص بمتجرك فقط");
        await db.insert(catalogItems).values({ code: `partner-${partner.id}-${randomBytes(8).toString("hex")}`, name: input.name, category: input.category, unit: input.unit, unitPrice: toLegacySyp(input.price), available: input.available, deleted: false, partnerId: partner.id, storeId: store.id, customCategoryId: store.customCategoryId, imageUrl: input.imageUrl || null });
        return { success: true };
      }),
      update: publicProcedure.input(partnerProductInput.extend({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
        const { db, store } = await requirePartnerStore(ctx, input.storeId);
        if (store.category !== input.category) throw new Error("يمكنك تعديل منتجات القسم الخاص بمتجرك فقط");
        await db.update(catalogItems).set({ name: input.name, category: input.category, unit: input.unit, unitPrice: toLegacySyp(input.price), available: input.available, customCategoryId: store.customCategoryId, imageUrl: input.imageUrl || null }).where(and(eq(catalogItems.id, input.id), eq(catalogItems.storeId, store.id), eq(catalogItems.deleted, false)));
        return { success: true };
      }),
      remove: publicProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
        const { db, partner } = await requirePartner(ctx);
        const found = await db.select({ storeId: catalogItems.storeId }).from(catalogItems).where(and(eq(catalogItems.id, input.id), eq(catalogItems.deleted, false))).limit(1);
        if (!found[0]?.storeId) throw new Error("هذا المنتج غير مرتبط بمتجر شريك");
        const assigned = await db.select({ id: stores.id }).from(stores).where(and(eq(stores.id, found[0].storeId), eq(stores.partnerId, partner.id))).limit(1);
        if (!assigned[0]) throw new Error("لا تملك صلاحية حذف هذا المنتج");
        await db.update(catalogItems).set({ deleted: true, available: false }).where(and(eq(catalogItems.id, input.id), eq(catalogItems.storeId, assigned[0].id), eq(catalogItems.deleted, false)));
        return { success: true };
      }),
      uploadImage: publicProcedure.input(z.object({ storeId: z.number().int().positive(), dataUrl: z.string().min(30).max(8_000_000) })).mutation(async ({ ctx, input }) => {
        const { store } = await requirePartnerStore(ctx, input.storeId);
        return uploadOfferImage(input.dataUrl, store.id, `product-${randomBytes(12).toString("hex")}`);
      }),
    }),
    offers: router({
      list: publicProcedure.query(async ({ ctx }) => {
        const { db, partner } = await requirePartner(ctx);
        await cleanExpiredOffers();
        const assignedStores = await db.select({ id: stores.id }).from(stores).where(eq(stores.partnerId, partner.id));
        if (!assignedStores.length) return [];
        return db.select().from(partnerOffers).where(and(eq(partnerOffers.partnerId, partner.id), inArray(partnerOffers.storeId, assignedStores.map(store => store.id)))).orderBy(desc(partnerOffers.createdAt));
      }),
      create: publicProcedure.input(partnerOfferInput).mutation(async ({ ctx, input }) => {
        const { db, partner, store } = await requirePartnerStore(ctx, input.storeId);
        await cleanExpiredOffers();
        const product = await db.select({ id: catalogItems.id, unitPrice: catalogItems.unitPrice }).from(catalogItems).where(and(eq(catalogItems.id, input.catalogItemId), eq(catalogItems.storeId, store.id), eq(catalogItems.deleted, false), eq(catalogItems.available, true))).limit(1);
        if (!product[0]) throw new Error("اختر صنفاً متاحاً من منتجات متجرك لهذا العرض");
        const offerPrice = toLegacySyp(input.offerPrice);
        if (offerPrice >= product[0].unitPrice) throw new Error("يجب أن يكون سعر العرض أقل من سعر المنتج الأصلي");
        const discountPercent = Math.round((product[0].unitPrice - offerPrice) * 100 / product[0].unitPrice);
        if (discountPercent < 1 || discountPercent > 90) throw new Error("اجعل سعر العرض يحقق خصماً بين 1% و90%");
        const inserted = await db.insert(partnerOffers).values({ partnerId: partner.id, storeId: store.id, catalogItemId: product[0].id, text: input.text, discountPercent, offerPrice, imageUrl: input.imageUrl || null, imageStorageKey: input.imageStorageKey || null, imageDeletePending: false, durationDays: input.durationDays, expiresAt: calculateOfferExpiry(input.durationDays), active: input.active, featuredStatus: "none" });
        return { success: true, id: Number(inserted[0].insertId) };
      }),
      update: publicProcedure.input(partnerOfferInput.extend({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
        const { db, partner, store } = await requirePartnerStore(ctx, input.storeId);
        await cleanExpiredOffers();
        const product = await db.select({ id: catalogItems.id, unitPrice: catalogItems.unitPrice }).from(catalogItems).where(and(eq(catalogItems.id, input.catalogItemId), eq(catalogItems.storeId, store.id), eq(catalogItems.deleted, false), eq(catalogItems.available, true))).limit(1);
        if (!product[0]) throw new Error("اختر صنفاً متاحاً من منتجات متجرك لهذا العرض");
        const offerPrice = toLegacySyp(input.offerPrice);
        if (offerPrice >= product[0].unitPrice) throw new Error("يجب أن يكون سعر العرض أقل من سعر المنتج الأصلي");
        const discountPercent = Math.round((product[0].unitPrice - offerPrice) * 100 / product[0].unitPrice);
        if (discountPercent < 1 || discountPercent > 90) throw new Error("اجعل سعر العرض يحقق خصماً بين 1% و90%");
        await db.update(partnerOffers).set({ catalogItemId: product[0].id, text: input.text, discountPercent, offerPrice, imageUrl: input.imageUrl || null, imageStorageKey: input.imageStorageKey || null, imageDeletePending: false, durationDays: input.durationDays, expiresAt: calculateOfferExpiry(input.durationDays), deletedAt: null, active: input.active, featuredStatus: "none", featuredRequestedAt: null, featuredReviewedAt: null, featuredReviewNote: null }).where(and(eq(partnerOffers.id, input.id), eq(partnerOffers.partnerId, partner.id), eq(partnerOffers.storeId, store.id)));
        return { success: true };
      }),
      requestFeatured: publicProcedure.input(z.object({ id: z.number().int().positive(), storeId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
        const { db, partner, store } = await requirePartnerStore(ctx, input.storeId);
        await cleanExpiredOffers();
        const offer = await db.select({ id: partnerOffers.id, active: partnerOffers.active, expiresAt: partnerOffers.expiresAt, catalogItemId: partnerOffers.catalogItemId, discountPercent: partnerOffers.discountPercent, offerPrice: partnerOffers.offerPrice }).from(partnerOffers).where(and(eq(partnerOffers.id, input.id), eq(partnerOffers.partnerId, partner.id), eq(partnerOffers.storeId, store.id))).limit(1);
        const found = offer[0];
        if (!found?.active || (found.expiresAt && found.expiresAt <= new Date()) || !found.catalogItemId || found.discountPercent < 1 || found.offerPrice < 1) throw new Error("أدخل سعر عرض صالحاً قبل طلب اعتماد العرض المميز");
        const product = await db.select({ id: catalogItems.id }).from(catalogItems).where(and(eq(catalogItems.id, found.catalogItemId), eq(catalogItems.storeId, store.id), eq(catalogItems.deleted, false), eq(catalogItems.available, true))).limit(1);
        if (!product[0]) throw new Error("صنف العرض غير متاح حالياً؛ حدّث العرض قبل طلب تمييزه");
        await db.update(partnerOffers).set({ featuredStatus: "pending", featuredRequestedAt: new Date(), featuredReviewedAt: null, featuredReviewNote: null }).where(eq(partnerOffers.id, found.id));
        return { success: true };
      }),
      remove: publicProcedure.input(z.object({ id: z.number().int().positive(), storeId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
        const { db, partner, store } = await requirePartnerStore(ctx, input.storeId);
        await cleanExpiredOffers();
        const found = await db.select({ imageStorageKey: partnerOffers.imageStorageKey }).from(partnerOffers).where(and(eq(partnerOffers.id, input.id), eq(partnerOffers.partnerId, partner.id), eq(partnerOffers.storeId, store.id))).limit(1);
        if (!found[0]) throw new Error("العرض غير موجود أو لا تملك صلاحية حذفه");
        await db.update(partnerOffers).set({ active: false, deletedAt: new Date(), imageDeletePending: Boolean(found[0].imageStorageKey) }).where(eq(partnerOffers.id, input.id));
        await cleanExpiredOffers();
        return { success: true };
      }),
      uploadImage: publicProcedure.input(z.object({ storeId: z.number().int().positive(), dataUrl: z.string().min(30).max(8_000_000) })).mutation(async ({ ctx, input }) => {
        const { store } = await requirePartnerStore(ctx, input.storeId);
        return uploadOfferImage(input.dataUrl, store.id, randomBytes(12).toString("hex"));
      }),
    }),
    intercityOrders: router({
      list: publicProcedure.query(async ({ ctx }) => {
        const { db, partner } = await requirePartner(ctx);
        return db.select().from(intercityOrders).where(eq(intercityOrders.partnerId, partner.id)).orderBy(desc(intercityOrders.createdAt));
      }),
      updateStatus: publicProcedure.input(z.object({ id: z.number().int().positive(), status: z.enum(["accepted", "ready", "cancelled"]) })).mutation(async ({ ctx, input }) => {
        const { db, partner } = await requirePartner(ctx);
        await db.update(intercityOrders).set({ status: input.status }).where(and(eq(intercityOrders.id, input.id), eq(intercityOrders.partnerId, partner.id)));
        return { success: true };
      }),
    }),
  }),
  orders: router({
    previewPromotion: publicProcedure.input(z.object({
      code: z.string().trim().min(2).max(40),
      kind: z.enum(["discount", "referral"]),
      customerPhone: z.string().regex(/^\+9639\d{8}$/).optional(),
      lines: z.array(lineInput).min(1).max(30),
    })).mutation(async ({ input }) => {
      const db = await ensureCatalogSeed();
      const code = input.code.toUpperCase();
      const ids = input.lines.flatMap(line => line.catalogItemId ? [line.catalogItemId] : []);
      const products = ids.length ? await db.select().from(catalogItems).where(inArray(catalogItems.id, ids)) : [];
      const productMap = new Map(products.map(product => [product.id, product]));
      const itemsTotal = input.lines.reduce((sum, line) => {
        const product = line.catalogItemId ? productMap.get(line.catalogItemId) : undefined;
        const unitPrice = !product?.available || product.deleted ? 0 : product.unitPrice;
        return sum + calculateLineTotal(line.quantity, unitPrice, line.unit);
      }, 0);
      if (input.kind === "discount") {
        const discount = (await db.select().from(discountCodes).where(and(eq(discountCodes.code, code), eq(discountCodes.active, true))).limit(1))[0];
        if (!discount) throw new Error("رمز الخصم غير صالح");
        if (discount.expiresAt && discount.expiresAt.getTime() <= Date.now()) throw new Error("انتهت صلاحية رمز الخصم");
        if (discount.maxUses !== null && discount.maxUses !== undefined && discount.usedCount >= discount.maxUses) throw new Error("اكتمل عدد مرات استخدام رمز الخصم");
        const discountAmount = Math.min(itemsTotal, Math.max(0, Math.floor(itemsTotal * discount.discountPercent / 100)));
        return { code: discount.code, kind: "discount" as const, percent: discount.discountPercent, discountAmount, itemsTotal };
      }
      const referral = (await db.select().from(customerReferrals).where(eq(customerReferrals.code, code)).limit(1))[0];
      if (!referral) throw new Error("رمز الإحالة غير صالح");
      if (input.customerPhone && (referral.ownerPhone === input.customerPhone || referral.referredPhone)) throw new Error("لا يمكن استخدام رمز الإحالة لهذا العميل");
      const referralSetting = (await db.select({ discountPercent: discountCodes.discountPercent }).from(discountCodes).where(and(eq(discountCodes.active, true), eq(discountCodes.code, "REFERRAL"))).limit(1))[0];
      const percent = referralSetting?.discountPercent ?? 0;
      if (percent < 1) throw new Error("رمز الإحالة غير مفعّل حالياً");
      const discountAmount = Math.min(itemsTotal, Math.max(0, Math.floor(itemsTotal * percent / 100)));
      return { code: referral.code, kind: "referral" as const, percent, discountAmount, itemsTotal };
    }),
    create: publicProcedure.input(orderInputSchema).mutation(async ({ input }) => {
      const db = await ensureCatalogSeed();
      const ids = input.lines.flatMap(line => line.catalogItemId ? [line.catalogItemId] : []);
      const products = ids.length ? await db.select().from(catalogItems).where(inArray(catalogItems.id, ids)) : [];
      const productMap = new Map(products.map(product => [product.id, product]));
      const partnerIds = Array.from(new Set(products.flatMap(product => product.partnerId ? [product.partnerId] : [])));
      if (partnerIds.length) {
        const productPartners = await db.select({ id: partners.id, active: partners.active, storeOpen: partners.storeOpen }).from(partners).where(inArray(partners.id, partnerIds));
        const partnerById = new Map(productPartners.map(partner => [partner.id, partner]));
        if (products.some(product => product.partnerId && (!partnerById.get(product.partnerId)?.active || isStoreClosedForCustomer(partnerById.get(product.partnerId)?.storeOpen)))) {
          throw new Error("المتجر مغلق حالياً");
        }
      }
      let totalAmount = 0;
      const resolvedLines = input.lines.map(line => {
        const product = line.catalogItemId ? productMap.get(line.catalogItemId) : undefined;
        const unitPrice = product?.available && !product.deleted ? product.unitPrice : 0;
        const lineTotal = calculateLineTotal(line.quantity, unitPrice, line.unit);
        totalAmount += lineTotal;
        return { ...line, unitPrice, lineTotal, priceKnown: Boolean(product && !product.deleted && product.unitPrice > 0) };
      });
      const itemsTotal = totalAmount;
      let discountAmount = 0;
      let appliedDiscountCode: string | null = null;
      let appliedReferralCode: string | null = null;
      if (input.discountCode || input.referralCode) {
        const code = (input.discountCode ?? input.referralCode ?? "").trim().toUpperCase();
        const discount = (await db.select().from(discountCodes).where(and(eq(discountCodes.code, code), eq(discountCodes.active, true))).limit(1))[0];
        const referral = !discount ? (await db.select().from(customerReferrals).where(eq(customerReferrals.code, code)).limit(1))[0] : null;
        if (!discount && !referral) throw new Error("رمز الخصم أو الإحالة غير صالح");
        if (discount) {
          if (discount.expiresAt && discount.expiresAt.getTime() <= Date.now()) throw new Error("انتهت صلاحية رمز الخصم");
          if (discount.maxUses !== null && discount.maxUses !== undefined && discount.usedCount >= discount.maxUses) throw new Error("اكتمل عدد مرات استخدام رمز الخصم");
          discountAmount = Math.floor(itemsTotal * discount.discountPercent / 100);
          appliedDiscountCode = discount.code;
        } else if (referral) {
          if (referral.ownerPhone === input.customerPhone || referral.referredPhone) throw new Error("لا يمكن استخدام رمز الإحالة لهذا العميل");
          const ownerDiscount = await db.select({ discountPercent: discountCodes.discountPercent }).from(discountCodes).where(and(eq(discountCodes.active, true), eq(discountCodes.code, "REFERRAL"))).limit(1);
          const referralPercent = ownerDiscount[0]?.discountPercent ?? 0;
          discountAmount = Math.floor(itemsTotal * referralPercent / 100);
          appliedReferralCode = referral.code;
        }
        discountAmount = Math.min(itemsTotal, Math.max(0, discountAmount));
      }
      const discountedItemsTotal = itemsTotal - discountAmount;
      const settings = await getSettings();
      let pointsUsed = 0;
      let pointsRewardPercent = 0;
      let pointsRewardAmount = 0;
      if (input.usePointsReward) {
        if (input.orderType !== "delivery") throw new Error("مكافأة النقاط متاحة لطلبات التوصيل فقط");
        if (settings.pointsRewardPercent < 1) throw new Error("لم يحدد المالك نسبة مكافأة النقاط بعد");
        const pointBalance = (await db.select({ balance: customerPoints.balance }).from(customerPoints).where(eq(customerPoints.customerPhone, input.customerPhone)).limit(1))[0];
        if (!pointBalance || pointBalance.balance < 10) throw new Error("تحتاج إلى 10 نقاط على الأقل لاستخدام المكافأة");
        pointsUsed = 10;
        pointsRewardPercent = settings.pointsRewardPercent;
        pointsRewardAmount = calculatePointsReward(discountedItemsTotal, pointsRewardPercent);
      }
      const finalItemsTotal = discountedItemsTotal - pointsRewardAmount;
      const initialStatus = initialCustomerOrderStatus(input.orderType, resolvedLines);
      if (input.orderType === "delivery" && !meetsMinimumDeliveryOrder(finalItemsTotal)) {
        throw new Error(`الحد الأدنى لمجموع الطلب هو ${formatNewSyp(MINIMUM_DELIVERY_ORDER_SYP)}`);
      }
      let deliveryDistanceMeters = 0;
      let deliveryFee = 0;
      let deliveryPricingPending = false;
      let intercityTrip: typeof intercityTrips.$inferSelect | null = null;
      if (input.intercityTripId) {
        const foundTrips = await db.select().from(intercityTrips).where(and(eq(intercityTrips.id, input.intercityTripId), eq(intercityTrips.active, true))).limit(1);
        intercityTrip = foundTrips[0] ?? null;
        if (!intercityTrip || intercityTrip.status !== "open") throw new Error("الحجز المختار غير متاح الآن، اختر حجزاً آخر");
        const linkedReservations = await db.select({ id: orders.id, status: orders.status }).from(orders).where(eq(orders.intercityTripId, intercityTrip.id));
        const legacyReservations = await db.select({ id: intercityOrders.id }).from(intercityOrders).where(and(eq(intercityOrders.tripId, intercityTrip.id), inArray(intercityOrders.status, ["new", "accepted", "ready", "collected"])));
        const activeLinkedReservations = linkedReservations.filter(order => ["pending", "confirmed", "preparing", "on_the_way"].includes(order.status)).length;
        if (!canReserveIntercityTrip(intercityTrip.capacity, legacyReservations.length + activeLinkedReservations)) throw new Error("اكتملت سعة هذا الحجز، اختر حجزاً آخر");
        deliveryFee = calculatePercentageDeliveryFee(itemsTotal, settings.jarabulusDeliveryPercent);
        totalAmount = finalItemsTotal + deliveryFee;
      } else if (input.orderType === "delivery") {
        deliveryFee = calculatePercentageDeliveryFee(itemsTotal, settings.manbijDeliveryPercent);
        totalAmount = finalItemsTotal + deliveryFee;
      }

      const created = await db.insert(orders).values({
        orderType: input.orderType,
        status: initialStatus,
        intercityTripId: intercityTrip?.id ?? null,
        customerName: input.customerName,
        customerPhone: input.customerPhone,
        paymentMethod: input.paymentMethod,
        totalAmount,
        discountCode: appliedDiscountCode,
        referralCode: appliedReferralCode,
        discountAmount: discountAmount + pointsRewardAmount,
        pointsUsed,
        pointsRewardPercent,
        deliveryDistanceMeters,
        deliveryFee,
        taxiType: input.taxiType ?? null,
        pickupLocation: input.pickupLocation ?? null,
        destination: input.destination ?? null,
        locationMode: input.locationMode,
        locationText: input.locationText ?? null,
        locationUrl: input.locationUrl ?? null,
        locationLat: input.locationLat === undefined ? null : Math.round(input.locationLat * 1_000_000),
        locationLng: input.locationLng === undefined ? null : Math.round(input.locationLng * 1_000_000),
        notes: [input.notes, intercityTrip ? `حجز جرابلس: ${intercityTrip.title} · ${intercityTrip.bookingCloseLabel} · ${intercityTrip.arrivalLabel}` : "", deliveryPricingPending ? DELIVERY_PRICING_PENDING_NOTE : ""].filter(Boolean).join("\n") || null,
      });
      const orderId = Number(created[0].insertId);
      if (pointsUsed) {
        const spent = await db.update(customerPoints).set({ balance: sql`${customerPoints.balance} - 10` }).where(and(eq(customerPoints.customerPhone, input.customerPhone), gte(customerPoints.balance, 10)));
        if (!spent[0]?.affectedRows) throw new Error("تعذر استخدام النقاط، أعد المحاولة");
        await db.insert(pointTransactions).values({ customerPhone: input.customerPhone, points: -10, reason: "reward_redeemed", rewardPercent: pointsRewardPercent, orderId });
      }
      if (appliedDiscountCode) await db.update(discountCodes).set({ usedCount: sql`${discountCodes.usedCount} + 1` }).where(eq(discountCodes.code, appliedDiscountCode));
      if (appliedReferralCode) await db.update(customerReferrals).set({ referredPhone: input.customerPhone, referredOrderId: orderId, completedAt: null }).where(eq(customerReferrals.code, appliedReferralCode));
      if (resolvedLines.length) {
        await db.insert(orderLines).values(resolvedLines.map(line => ({
          orderId,
          catalogItemId: line.catalogItemId ?? null,
          category: line.category,
          itemName: line.itemName,
          quantity: String(line.quantity),
          unit: line.unit,
          unitPrice: line.unitPrice,
          lineTotal: line.lineTotal,
          priceKnown: line.priceKnown,
          notes: line.notes ?? null,
        })));
      }
      return { success: true, orderId, totalAmount, deliveryDistanceMeters, deliveryFee, deliveryPricingPending };
    }),
    track: publicProcedure.input(z.object({ orderId: z.number().int().positive(), customerPhone: z.string().regex(/^\+9639\d{8}$/) })).query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً");
      const order = (await db.select().from(orders).where(and(eq(orders.id, input.orderId), eq(orders.customerPhone, input.customerPhone))).limit(1))[0];
      if (!order) throw new Error("لم نجد طلباً بهذه البيانات");
      const lines = await db.select().from(orderLines).where(eq(orderLines.orderId, order.id));
      return { ...order, lines };
    }),
    list: publicProcedure.query(async ({ ctx }) => {
      await requireAdmin(ctx);
      const db = await getDb();
      if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً");
      await cleanExpiredOrders();
      const allOrders = await db.select().from(orders).orderBy(desc(orders.createdAt));
      const ids = allOrders.map(order => order.id);
      const lines = ids.length ? await db.select().from(orderLines).where(inArray(orderLines.orderId, ids)) : [];
      return allOrders.map(order => ({ ...order, archived: isOrderArchived(order.createdAt), lines: lines.filter(line => line.orderId === order.id) }));
    }),
    updateStatus: publicProcedure.input(z.object({ id: z.number().int().positive(), status: z.enum(orderStatuses), reason: z.string().trim().min(2).max(300).optional() })).mutation(async ({ ctx, input }) => {
      await requireAdmin(ctx);
      const db = await getDb();
      if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً");
      await db.update(orders).set({ status: input.status, statusReason: input.reason ?? null, statusChangedAt: new Date() }).where(eq(orders.id, input.id));
      if (input.status === "completed") {
        const order = (await db.select({ customerPhone: orders.customerPhone }).from(orders).where(eq(orders.id, input.id)).limit(1))[0];
        if (order) {
          await awardCustomerPoint(db, order.customerPhone, "order_completed", input.id);
          const referral = (await db.select().from(customerReferrals).where(and(eq(customerReferrals.referredOrderId, input.id), isNull(customerReferrals.completedAt))).limit(1))[0];
          if (referral) { await db.update(customerReferrals).set({ completedAt: new Date() }).where(eq(customerReferrals.id, referral.id)); await awardCustomerPoint(db, referral.ownerPhone, "referral_completed", undefined, referral.id); }
        }
      }
      return { success: true };
    }),
    update: publicProcedure.input(adminOrderUpdateInput).mutation(async ({ ctx, input }) => {
      await requireAdmin(ctx);
      const db = await getDb();
      if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً");
      await db.update(orders).set({
        customerName: input.customerName,
        customerPhone: input.customerPhone,
        paymentMethod: input.paymentMethod,
        locationMode: input.locationMode,
        locationText: input.locationText || null,
        pickupLocation: input.pickupLocation || null,
        destination: input.destination || null,
        notes: input.notes || null,
      }).where(eq(orders.id, input.id));
      return { success: true };
    }),
  }),
  admin: router({
    discountCodes: router({
      list: publicProcedure.query(async ({ ctx }) => { await requireAdmin(ctx, ["owner"]); const db = await getDb(); if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً"); return db.select().from(discountCodes).orderBy(desc(discountCodes.createdAt)); }),
      create: publicProcedure.input(z.object({ code: z.string().trim().min(3).max(40).regex(/^[A-Za-z0-9_-]+$/), discountPercent: z.number().int().min(1).max(100), maxUses: z.number().int().positive().optional(), expiresAt: z.string().datetime().optional() })).mutation(async ({ ctx, input }) => { await requireAdmin(ctx, ["owner"]); const db = await getDb(); if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً"); const code = input.code.toUpperCase(); const exists = await db.select({ id: discountCodes.id }).from(discountCodes).where(eq(discountCodes.code, code)).limit(1); if (exists[0]) throw new Error("رمز الخصم مستخدم مسبقاً"); await db.insert(discountCodes).values({ code, discountPercent: input.discountPercent, maxUses: input.maxUses ?? null, expiresAt: input.expiresAt ? new Date(input.expiresAt) : null, active: true }); return { success: true }; }),
      toggle: publicProcedure.input(z.object({ id: z.number().int().positive(), active: z.boolean() })).mutation(async ({ ctx, input }) => { await requireAdmin(ctx, ["owner"]); const db = await getDb(); if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً"); await db.update(discountCodes).set({ active: input.active }).where(eq(discountCodes.id, input.id)); return { success: true }; }),
    }),
    categories: router({
      list: publicProcedure.query(async ({ ctx }) => {
        await requireAdmin(ctx, ["owner"]);
        const db = await getDb();
        if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً");
        return db.select().from(customCategories).orderBy(customCategories.sortOrder, customCategories.title);
      }),
      create: publicProcedure.input(customCategoryInput).mutation(async ({ ctx, input }) => {
        await requireAdmin(ctx, ["owner"]);
        const db = await getDb();
        if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً");
        const slug = `custom-${randomBytes(6).toString("hex")}`;
        await db.insert(customCategories).values({ ...input, slug });
        return { success: true };
      }),
      update: publicProcedure.input(customCategoryInput.extend({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
        await requireAdmin(ctx, ["owner"]);
        const db = await getDb();
        if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً");
        const { id, ...patch } = input;
        await db.update(customCategories).set(patch).where(eq(customCategories.id, id));
        return { success: true };
      }),
      remove: publicProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
        await requireAdmin(ctx, ["owner"]);
        const db = await getDb();
        if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً");
        const [storeLink, itemLink] = await Promise.all([
          db.select({ id: stores.id }).from(stores).where(eq(stores.customCategoryId, input.id)).limit(1),
          db.select({ id: catalogItems.id }).from(catalogItems).where(eq(catalogItems.customCategoryId, input.id)).limit(1),
        ]);
        if (storeLink[0] || itemLink[0]) throw new Error("لا يمكن حذف قسم مرتبط بمتاجر أو منتجات. أخفه بدلاً من ذلك أو انقل بياناته أولاً.");
        await db.delete(customCategories).where(eq(customCategories.id, input.id));
        return { success: true };
      }),
    }),
    stores: router({
      list: publicProcedure.query(async ({ ctx }) => {
        await requireAdmin(ctx);
        const db = await getDb();
        if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً");
        await ensureProfileImageColumns(db);
        await ensureDemoStores(db);
        return db.select().from(stores).orderBy(stores.category, stores.sortOrder, stores.name);
      }),
      create: publicProcedure.input(storeInput).mutation(async ({ ctx, input }) => {
        await requireAdmin(ctx, ["owner"]);
        const db = await getDb();
        if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً");
        if (input.partnerId) {
          const assignedPartner = await db.select({ id: partners.id }).from(partners).where(and(eq(partners.id, input.partnerId), eq(partners.active, true))).limit(1);
          if (!assignedPartner[0]) throw new Error("اختر حساب شريك نشطاً لتعيين المتجر");
        }
        const customCategory = input.category === "other" ? await getActiveCustomCategory(db, input.customCategoryId) : null;
        if (input.category === "other" && !customCategory) throw new Error("اختر قسماً مخصصاً نشطاً للمتجر");
        await ensureProfileImageColumns(db);
        await db.insert(stores).values({ name: input.name, category: input.category, restaurantType: input.category === "restaurants" ? input.restaurantType : "all", customCategoryId: customCategory?.id ?? null, partnerId: input.partnerId ?? null, imageUrl: input.imageUrl || null, active: input.active, sortOrder: input.sortOrder });
        return { success: true };
      }),
      update: publicProcedure.input(storeInput.extend({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
        await requireAdmin(ctx, ["owner"]);
        const db = await getDb();
        if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً");
        if (input.partnerId) {
          const assignedPartner = await db.select({ id: partners.id }).from(partners).where(and(eq(partners.id, input.partnerId), eq(partners.active, true))).limit(1);
          if (!assignedPartner[0]) throw new Error("اختر حساب شريك نشطاً لتعيين المتجر");
        }
        const customCategory = input.category === "other" ? await getActiveCustomCategory(db, input.customCategoryId) : null;
        if (input.category === "other" && !customCategory) throw new Error("اختر قسماً مخصصاً نشطاً للمتجر");
        await ensureProfileImageColumns(db);
        const { id, category, restaurantType, customCategoryId: _customCategoryId, imageUrl, ...patch } = input;
        await db.update(stores).set({ ...patch, imageUrl: imageUrl || null, category, restaurantType: category === "restaurants" ? restaurantType : "all", customCategoryId: customCategory?.id ?? null }).where(eq(stores.id, id));
        return { success: true };
      }),
      remove: publicProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
        await requireAdmin(ctx, ["owner"]);
        const db = await getDb();
        if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً");
        await db.delete(stores).where(eq(stores.id, input.id));
        return { success: true };
      }),
      uploadImage: publicProcedure.input(z.object({ storeId: z.number().int().positive(), dataUrl: z.string().min(30).max(8_000_000) })).mutation(async ({ ctx, input }) => {
        await requireAdmin(ctx, ["owner"]);
        await getDb();
        return uploadOfferImage(input.dataUrl, input.storeId, `store-${randomBytes(12).toString("hex")}`);
      }),
    }),
    partners: router({
      list: publicProcedure.query(async ({ ctx }) => {
        await requireAdmin(ctx, ["owner"]);
        const db = await getDb();
        if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً");
        await ensureProfileImageColumns(db);
        return db.select({ id: partners.id, name: partners.name, username: partners.username, imageUrl: partners.imageUrl, active: partners.active, storeOpen: partners.storeOpen, preparationMinutes: partners.preparationMinutes, createdAt: partners.createdAt }).from(partners).orderBy(desc(partners.createdAt));
      }),
      create: publicProcedure.input(partnerAccountInput).mutation(async ({ ctx, input }) => {
        await requireAdmin(ctx, ["owner"]);
        const db = await getDb();
        if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً");
        const exists = await db.select({ id: partners.id }).from(partners).where(eq(partners.username, input.phone)).limit(1);
        if (exists[0]) throw new Error("رقم هاتف الشريك مستخدم بالفعل");
        await ensureProfileImageColumns(db);
        await db.insert(partners).values({ name: input.name, username: input.phone, imageUrl: input.imageUrl || null, passwordHash: await hashSecret(input.password), active: true, storeOpen: true, preparationMinutes: 20 });
        return { success: true };
      }),
      update: publicProcedure.input(z.object({ id: z.number().int().positive(), name: z.string().trim().min(2).max(120), imageUrl: z.string().trim().url().max(500).optional().or(z.literal("")), active: z.boolean(), storeOpen: z.boolean(), preparationMinutes: z.number().int().min(0).max(1440) })).mutation(async ({ ctx, input }) => {
        await requireAdmin(ctx, ["owner"]);
        const db = await getDb();
        if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً");
        await ensureProfileImageColumns(db);
        await db.update(partners).set({ name: input.name, imageUrl: input.imageUrl || null, active: input.active, storeOpen: input.storeOpen, preparationMinutes: input.preparationMinutes }).where(eq(partners.id, input.id));
        return { success: true };
      }),
      remove: publicProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
        await requireAdmin(ctx, ["owner"]);
        const db = await getDb();
        if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً");
        await db.delete(partners).where(eq(partners.id, input.id));
        return { success: true };
      }),
    }),
    intercity: router({
      trips: router({
        list: publicProcedure.query(async ({ ctx }) => {
          await requireAdmin(ctx);
          const db = await getDb();
          if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً");
          return db.select().from(intercityTrips).orderBy(desc(intercityTrips.createdAt));
        }),
        create: publicProcedure.input(tripInput).mutation(async ({ ctx, input }) => {
          await requireAdmin(ctx, ["owner"]);
          const db = await getDb();
          if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً");
          await db.insert(intercityTrips).values({ ...input, pickupFee: toLegacySyp(input.pickupFee), doorstepFee: toLegacySyp(input.doorstepFee) });
          return { success: true };
        }),
        update: publicProcedure.input(tripInput.extend({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
          await requireAdmin(ctx, ["owner"]);
          const db = await getDb();
          if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً");
          const { id, pickupFee, doorstepFee, ...patch } = input;
          await db.update(intercityTrips).set({ ...patch, pickupFee: toLegacySyp(pickupFee), doorstepFee: toLegacySyp(doorstepFee) }).where(eq(intercityTrips.id, id));
          return { success: true };
        }),
      }),
      orders: router({
        list: publicProcedure.query(async ({ ctx }) => {
          await requireAdmin(ctx);
          const db = await getDb();
          if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً");
          return db.select().from(intercityOrders).orderBy(desc(intercityOrders.createdAt));
        }),
        updateStatus: publicProcedure.input(z.object({ id: z.number().int().positive(), status: intercityOrderStatusSchema })).mutation(async ({ ctx, input }) => {
          await requireAdmin(ctx);
          const db = await getDb();
          if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً");
          await db.update(intercityOrders).set({ status: input.status }).where(eq(intercityOrders.id, input.id));
          return { success: true };
        }),
      }),
    }),
    offers: router({
      active: publicProcedure.query(async ({ ctx }) => {
        await requireAdmin(ctx, ["owner"]);
        const db = await getDb();
        if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً");
        await cleanExpiredOffers();
        const now = new Date();
        const rows = await db.select().from(partnerOffers).where(and(eq(partnerOffers.active, true), or(isNull(partnerOffers.expiresAt), gt(partnerOffers.expiresAt, now)))).orderBy(desc(partnerOffers.createdAt));
        const [storeRows, partnerRows, productRows] = await Promise.all([
          db.select({ id: stores.id, name: stores.name }).from(stores),
          db.select({ id: partners.id, name: partners.name }).from(partners),
          db.select({ id: catalogItems.id, name: catalogItems.name, available: catalogItems.available, unitPrice: catalogItems.unitPrice, imageUrl: catalogItems.imageUrl }).from(catalogItems).where(eq(catalogItems.deleted, false)),
        ]);
        const storeById = new Map(storeRows.map(store => [store.id, store.name]));
        const partnerById = new Map(partnerRows.map(partner => [partner.id, partner.name]));
        const productById = new Map(productRows.map(product => [product.id, product]));
        return rows.map(offer => ({ ...offer, storeName: offer.storeId ? storeById.get(offer.storeId) ?? "متجر غير محدد" : "متجر غير محدد", partnerName: partnerById.get(offer.partnerId) ?? "شريك غير محدد", product: offer.catalogItemId ? productById.get(offer.catalogItemId) ?? null : null }));
      }),
      updateActive: publicProcedure.input(z.object({ id: z.number().int().positive(), text: z.string().trim().min(3).max(180), offerPrice: z.number().int().positive(), durationDays: z.number().int().min(1).max(365), active: z.boolean() })).mutation(async ({ ctx, input }) => {
        await requireAdmin(ctx, ["owner"]);
        const db = await getDb();
        if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً");
        const found = await db.select({ id: partnerOffers.id, catalogItemId: partnerOffers.catalogItemId }).from(partnerOffers).where(and(eq(partnerOffers.id, input.id), eq(partnerOffers.active, true))).limit(1);
        if (!found[0] || !found[0].catalogItemId) throw new Error("العرض النشط غير موجود أو لا يرتبط بمنتج");
        const product = await db.select({ unitPrice: catalogItems.unitPrice }).from(catalogItems).where(and(eq(catalogItems.id, found[0].catalogItemId), eq(catalogItems.deleted, false))).limit(1);
        if (!product[0] || !product[0].unitPrice) throw new Error("المنتج المرتبط بالعرض غير متاح");
        const offerPrice = toLegacySyp(input.offerPrice);
        if (offerPrice >= product[0].unitPrice) throw new Error("يجب أن يكون سعر العرض أقل من السعر الأصلي");
        const discountPercent = Math.round((product[0].unitPrice - offerPrice) * 100 / product[0].unitPrice);
        if (discountPercent < 1 || discountPercent > 90) throw new Error("يجب أن تكون نسبة الخصم بين 1% و90%");
        await db.update(partnerOffers).set({ text: input.text, offerPrice, discountPercent, durationDays: input.durationDays, expiresAt: calculateOfferExpiry(input.durationDays), active: input.active, deletedAt: input.active ? null : new Date() }).where(eq(partnerOffers.id, input.id));
        return { success: true };
      }),
      removeActive: publicProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
        await requireAdmin(ctx, ["owner"]);
        const db = await getDb();
        if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً");
        const found = await db.select({ id: partnerOffers.id }).from(partnerOffers).where(and(eq(partnerOffers.id, input.id), eq(partnerOffers.active, true))).limit(1);
        if (!found[0]) throw new Error("العرض النشط غير موجود");
        await db.update(partnerOffers).set({ active: false, deletedAt: new Date(), imageDeletePending: true }).where(eq(partnerOffers.id, input.id));
        return { success: true };
      }),
      featuredRequests: publicProcedure.query(async ({ ctx }) => {
        await requireAdmin(ctx, ["owner"]);
        const db = await getDb();
        if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً");
        await cleanExpiredOffers();
        const rows = await db.select().from(partnerOffers).where(eq(partnerOffers.featuredStatus, "pending")).orderBy(desc(partnerOffers.featuredRequestedAt));
        const [storeRows, partnerRows, productRows] = await Promise.all([
          db.select({ id: stores.id, name: stores.name }).from(stores),
          db.select({ id: partners.id, name: partners.name }).from(partners),
          db.select({ id: catalogItems.id, name: catalogItems.name, available: catalogItems.available, unitPrice: catalogItems.unitPrice, imageUrl: catalogItems.imageUrl }).from(catalogItems).where(eq(catalogItems.deleted, false)),
        ]);
        const storeById = new Map(storeRows.map(store => [store.id, store.name]));
        const partnerById = new Map(partnerRows.map(partner => [partner.id, partner.name]));
        const productById = new Map(productRows.map(product => [product.id, product]));
        return rows.map(offer => ({ ...offer, storeName: offer.storeId ? storeById.get(offer.storeId) ?? "متجر غير محدد" : "متجر غير محدد", partnerName: partnerById.get(offer.partnerId) ?? "شريك غير محدد", product: offer.catalogItemId ? productById.get(offer.catalogItemId) ?? null : null }));
      }),
      reviewFeatured: publicProcedure.input(z.object({ id: z.number().int().positive(), decision: z.enum(["approved", "rejected"]), note: z.string().trim().max(300).optional() })).mutation(async ({ ctx, input }) => {
        await requireAdmin(ctx, ["owner"]);
        const db = await getDb();
        if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً");
        const found = await db.select({ id: partnerOffers.id, active: partnerOffers.active, expiresAt: partnerOffers.expiresAt, catalogItemId: partnerOffers.catalogItemId, featuredStatus: partnerOffers.featuredStatus, discountPercent: partnerOffers.discountPercent, offerPrice: partnerOffers.offerPrice }).from(partnerOffers).where(eq(partnerOffers.id, input.id)).limit(1);
        const offer = found[0];
        if (!offer || offer.featuredStatus !== "pending") throw new Error("طلب العرض المميز غير متاح للمراجعة");
        if (input.decision === "approved") {
          if (!offer.active || (offer.expiresAt && offer.expiresAt <= new Date()) || !offer.catalogItemId || offer.discountPercent < 1 || offer.offerPrice < 1) throw new Error("لا يمكن اعتماد عرض من دون سعر عرض وخصم محسوب صالحين");
          const product = await db.select({ id: catalogItems.id }).from(catalogItems).where(and(eq(catalogItems.id, offer.catalogItemId), eq(catalogItems.deleted, false), eq(catalogItems.available, true))).limit(1);
          if (!product[0]) throw new Error("لا يمكن اعتماد عرض لصنف غير متاح");
        }
        await db.update(partnerOffers).set({ featuredStatus: input.decision, featuredReviewedAt: new Date(), featuredReviewNote: input.note || null }).where(eq(partnerOffers.id, offer.id));
        return { success: true };
      }),
      expired: publicProcedure.query(async ({ ctx }) => {
        await requireAdmin(ctx);
        const db = await getDb();
        if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً");
        await cleanExpiredOffers();
        const now = new Date();
        const rows = await db.select().from(partnerOffers).where(and(eq(partnerOffers.active, false), lte(partnerOffers.expiresAt, now))).orderBy(desc(partnerOffers.expiresAt));
        const [storeRows, partnerRows] = await Promise.all([
          db.select({ id: stores.id, name: stores.name }).from(stores),
          db.select({ id: partners.id, name: partners.name }).from(partners),
        ]);
        const storeById = new Map(storeRows.map(store => [store.id, store.name]));
        const partnerById = new Map(partnerRows.map(partner => [partner.id, partner.name]));
        return rows.map(offer => ({ ...offer, storeName: offer.storeId ? storeById.get(offer.storeId) ?? "متجر محذوف" : "متجر غير محدد", partnerName: partnerById.get(offer.partnerId) ?? "شريك غير محدد" }));
      }),
      removeExpired: publicProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
        await requireAdmin(ctx);
        const db = await getDb();
        if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً");
        await cleanExpiredOffers();
        const found = await db.select({ id: partnerOffers.id, active: partnerOffers.active, expiresAt: partnerOffers.expiresAt, imageStorageKey: partnerOffers.imageStorageKey }).from(partnerOffers).where(eq(partnerOffers.id, input.id)).limit(1);
        const offer = found[0];
        if (!offer || offer.active || !offer.expiresAt || offer.expiresAt > new Date()) throw new Error("لا يمكن حذف إلا عرض منتهي من قائمة التنبيهات");
        if (offer.imageStorageKey) {
          const imageResult = await deleteOfferImage(offer.imageStorageKey);
          if (!imageResult.deleted) throw new Error("تعذر حذف صورة العرض من التخزين السحابي؛ لم يُحذف العرض حتى لا تبقى الصورة بلا إدارة");
        }
        await db.delete(partnerOffers).where(eq(partnerOffers.id, offer.id));
        return { success: true };
      }),
    }),
    session: publicProcedure.query(async ({ ctx }) => readSession(ctx)),
    login: publicProcedure.input(z.discriminatedUnion("role", [
      z.object({ role: z.literal("owner"), pin: passwordSchema }),
      z.object({ role: z.literal("supervisor"), username: z.string().trim().min(3).max(64), password: passwordSchema }),
    ])).mutation(async ({ ctx, input }) => {
      const runtimeId = getAuthRuntimeId(ctx);
      if (!runtimeId) throw new Error("تعذر تأمين جلسة الإدارة، أعد فتح التطبيق وحاول مرة أخرى");
      const db = await getDb();
      if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً");
      if (input.role === "owner") {
        const settings = await getSettings();
        if (!await verifySecret(input.pin, settings.masterPinHash)) throw new Error("رمز PIN غير صحيح");
        setAdminCookie(ctx, await createSession({ role: "owner", runtimeId }));
        return { role: "owner" as const };
      }
      const found = await db.select().from(supervisors).where(and(eq(supervisors.username, input.username), eq(supervisors.active, true))).limit(1);
      if (!found[0] || !await verifySecret(input.password, found[0].passwordHash)) throw new Error("بيانات دخول المشرف غير صحيحة");
      setAdminCookie(ctx, await createSession({ role: "supervisor", supervisorId: found[0].id, runtimeId }));
      return { role: "supervisor" as const };
    }),
    logout: publicProcedure.mutation(({ ctx }) => {
      ctx.res.clearCookie(ADMIN_COOKIE, getSessionCookieOptions(ctx.req));
      ctx.res.clearCookie(PARTNER_COOKIE, getSessionCookieOptions(ctx.req));
      return { success: true };
    }),
    changePin: publicProcedure.input(z.object({ currentPin: passwordSchema, newPin: passwordSchema })).mutation(async ({ ctx, input }) => {
      await requireAdmin(ctx, ["owner"]);
      const settings = await getSettings();
      if (!await verifySecret(input.currentPin, settings.masterPinHash)) throw new Error("رمز PIN الحالي غير صحيح");
      const db = await getDb();
      if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً");
      await db.update(systemSettings).set({ masterPinHash: await hashSecret(input.newPin) }).where(eq(systemSettings.id, 1));
      return { success: true };
    }),
    deliverySettings: router({
      get: publicProcedure.query(async ({ ctx }) => {
        await requireAdmin(ctx);
        const settings = await getSettings();
        return {
          manbijPercent: settings.manbijDeliveryPercent,
          jarabulusPercent: settings.jarabulusDeliveryPercent,
          pointsRewardPercent: settings.pointsRewardPercent,
        };
      }),
      update: publicProcedure.input(z.object({ manbijPercent: deliveryPercentInput, jarabulusPercent: deliveryPercentInput, pointsRewardPercent: deliveryPercentInput })).mutation(async ({ ctx, input }) => {
        await requireAdmin(ctx);
        const db = await getDb();
        if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً");
        await db.update(systemSettings).set({ manbijDeliveryPercent: input.manbijPercent, jarabulusDeliveryPercent: input.jarabulusPercent, pointsRewardPercent: input.pointsRewardPercent }).where(eq(systemSettings.id, 1));
        return { success: true };
      }),
    }),
    interfaceSettings: router({
      get: publicProcedure.query(async ({ ctx }) => {
        await requireAdmin(ctx, ["owner"]);
        const settings = await getSettings();
        return readTickerSettings(settings);
      }),
      update: publicProcedure.input(tickerSettingsInputSchema).mutation(async ({ ctx, input }) => {
        await requireAdmin(ctx, ["owner"]);
        const db = await getDb();
        if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً");
        const nextTickerSettings = readTickerSettings(input);
        await saveTickerSettings(db, nextTickerSettings);
        return { success: true, ...nextTickerSettings };
      }),
    }),
    drivers: router({
      list: publicProcedure.query(async ({ ctx }) => {
        await requireAdmin(ctx);
        const db = await getDb();
        if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً");
        return db.select().from(drivers).orderBy(desc(drivers.createdAt));
      }),
      create: publicProcedure.input(driverInput).mutation(async ({ ctx, input }) => {
        await requireAdmin(ctx, ["owner"]);
        const db = await getDb();
        if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً");
        const exists = await db.select({ id: drivers.id }).from(drivers).where(eq(drivers.phone, input.phone)).limit(1);
        if (exists[0]) throw new Error("رقم المندوب مستخدم بالفعل");
        await db.insert(drivers).values(input);
        return { success: true };
      }),
      update: publicProcedure.input(driverInput.safeExtend({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
        await requireAdmin(ctx, ["owner"]);
        const db = await getDb();
        if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً");
        const { id, ...patch } = input;
        await db.update(drivers).set(patch).where(eq(drivers.id, id));
        return { success: true };
      }),
      remove: publicProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
        await requireAdmin(ctx, ["owner"]);
        const db = await getDb();
        if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً");
        const assignment = await db.select({ id: orderAssignments.id }).from(orderAssignments).where(and(eq(orderAssignments.driverId, input.id), or(eq(orderAssignments.status, "assigned"), eq(orderAssignments.status, "accepted"), eq(orderAssignments.status, "picked_up")))).limit(1);
        if (assignment[0]) throw new Error("لا يمكن حذف مندوب لديه طلب قيد التنفيذ");
        await db.delete(drivers).where(eq(drivers.id, input.id));
        return { success: true };
      }),
      assign: publicProcedure.input(z.object({ orderId: z.number().int().positive(), driverId: z.number().int().positive(), note: z.string().trim().max(300).optional() })).mutation(async ({ ctx, input }) => {
        await requireAdmin(ctx);
        const db = await getDb();
        if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً");
        const driver = await db.select({ id: drivers.id, active: drivers.active, available: drivers.available }).from(drivers).where(eq(drivers.id, input.driverId)).limit(1);
        if (!driver[0] || !driver[0].active || !driver[0].available) throw new Error("المندوب غير متاح للتعيين");
        const order = await db.select({ id: orders.id }).from(orders).where(eq(orders.id, input.orderId)).limit(1);
        if (!order[0]) throw new Error("الطلب غير موجود");
        await db.insert(orderAssignments).values({ orderId: input.orderId, driverId: input.driverId, note: input.note || null }).onDuplicateKeyUpdate({ set: { driverId: input.driverId, status: "assigned", note: input.note || null, assignedAt: new Date() } });
        await db.update(drivers).set({ available: false }).where(eq(drivers.id, input.driverId));
        return { success: true };
      }),
    }),
    inventory: router({
      list: publicProcedure.query(async ({ ctx }) => {
        await requireAdmin(ctx);
        const db = await getDb();
        if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً");
        const rows = await db.select({ movement: inventoryMovements, itemName: catalogItems.name }).from(inventoryMovements).leftJoin(catalogItems, eq(inventoryMovements.catalogItemId, catalogItems.id)).orderBy(desc(inventoryMovements.createdAt)).limit(200);
        const balances = new Map<number, number>();
        for (const row of rows) balances.set(row.movement.catalogItemId, (balances.get(row.movement.catalogItemId) ?? 0) + row.movement.quantityDelta);
        return { movements: rows.map(row => ({ ...row.movement, itemName: row.itemName ?? "منتج محذوف" })), balances: Array.from(balances.entries()).map(([catalogItemId, quantity]) => ({ catalogItemId, quantity })) };
      }),
      adjust: publicProcedure.input(inventoryMovementInput).mutation(async ({ ctx, input }) => {
        await requireAdmin(ctx, ["owner"]);
        const db = await getDb();
        if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً");
        const item = await db.select({ id: catalogItems.id }).from(catalogItems).where(and(eq(catalogItems.id, input.catalogItemId), eq(catalogItems.deleted, false))).limit(1);
        if (!item[0]) throw new Error("المنتج غير موجود");
        await db.insert(inventoryMovements).values(input);
        return { success: true };
      }),
    }),
    finance: router({
      list: publicProcedure.query(async ({ ctx }) => {
        await requireAdmin(ctx);
        const db = await getDb();
        if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً");
        return db.select().from(financeEntries).orderBy(desc(financeEntries.createdAt)).limit(300);
      }),
      create: publicProcedure.input(financeEntryInput).mutation(async ({ ctx, input }) => {
        await requireAdmin(ctx, ["owner"]);
        const db = await getDb();
        if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً");
        await db.insert(financeEntries).values({ ...input, amount: toLegacySyp(input.amount) });
        return { success: true };
      }),
      settle: publicProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
        await requireAdmin(ctx, ["owner"]);
        const db = await getDb();
        if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً");
        await db.update(financeEntries).set({ status: "settled", settledAt: new Date() }).where(eq(financeEntries.id, input.id));
        return { success: true };
      }),
    }),
    analytics: router({
      dashboard: publicProcedure.query(async ({ ctx }) => {
        await requireAdmin(ctx);
        const db = await getDb();
        if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً");
        const rows = await db.select({ id: orders.id, status: orders.status, orderType: orders.orderType, totalAmount: orders.totalAmount, createdAt: orders.createdAt }).from(orders).orderBy(desc(orders.createdAt)).limit(1000);
        const byStatus = rows.reduce<Record<string, number>>((acc, row) => { acc[row.status] = (acc[row.status] ?? 0) + 1; return acc; }, {});
        const totalAmount = rows.reduce((sum, row) => sum + row.totalAmount, 0);
        return { totalOrders: rows.length, totalAmount: toNewSyp(totalAmount), byStatus, recentOrders: rows.slice(0, 10).map(row => ({ ...row, totalAmount: toNewSyp(row.totalAmount) })) };
      }),
    }),
    notifications: router({
      list: publicProcedure.query(async ({ ctx }) => {
        await requireAdmin(ctx, ["owner"]);
        const db = await getDb();
        if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً");
        return db.select().from(notificationCampaigns).orderBy(desc(notificationCampaigns.createdAt));
      }),
      create: publicProcedure.input(notificationCampaignInput).mutation(async ({ ctx, input }) => {
        await requireAdmin(ctx, ["owner"]);
        const db = await getDb();
        if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً");
        await db.insert(notificationCampaigns).values({ ...input, scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null, expiresAt: input.expiresAt ? new Date(input.expiresAt) : null });
        return { success: true };
      }),
      update: publicProcedure.input(notificationCampaignInput.safeExtend({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
        await requireAdmin(ctx, ["owner"]);
        const db = await getDb();
        if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً");
        const { id, ...patch } = input;
        await db.update(notificationCampaigns).set({ ...patch, scheduledAt: patch.scheduledAt ? new Date(patch.scheduledAt) : null, expiresAt: patch.expiresAt ? new Date(patch.expiresAt) : null }).where(eq(notificationCampaigns.id, id));
        return { success: true };
      }),
      toggle: publicProcedure.input(z.object({ id: z.number().int().positive(), active: z.boolean() })).mutation(async ({ ctx, input }) => {
        await requireAdmin(ctx, ["owner"]);
        const db = await getDb();
        if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً");
        await db.update(notificationCampaigns).set({ active: input.active }).where(eq(notificationCampaigns.id, input.id));
        return { success: true };
      }),
      remove: publicProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
        await requireAdmin(ctx, ["owner"]);
        const db = await getDb();
        if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً");
        await db.delete(notificationCampaigns).where(eq(notificationCampaigns.id, input.id));
        return { success: true };
      }),
    }),
    supportContacts: router({
      list: publicProcedure.query(async ({ ctx }) => {
        await requireAdmin(ctx, ["owner"]);
        const db = await getDb();
        if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً");
        return db.select().from(supportContacts).orderBy(supportContacts.sortOrder, supportContacts.id);
      }),
      create: publicProcedure.input(supportContactInput).mutation(async ({ ctx, input }) => {
        await requireAdmin(ctx, ["owner"]);
        const db = await getDb();
        if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً");
        await db.insert(supportContacts).values(input);
        return { success: true };
      }),
      update: publicProcedure.input(supportContactInput.safeExtend({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
        await requireAdmin(ctx, ["owner"]);
        const db = await getDb();
        if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً");
        const { id, ...patch } = input;
        await db.update(supportContacts).set(patch).where(eq(supportContacts.id, id));
        return { success: true };
      }),
      remove: publicProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
        await requireAdmin(ctx, ["owner"]);
        const db = await getDb();
        if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً");
        await db.delete(supportContacts).where(eq(supportContacts.id, input.id));
        return { success: true };
      }),
    }),
    employees: router({
      list: publicProcedure.query(async ({ ctx }) => {
        await requireAdmin(ctx);
        const db = await getDb();
        if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً");
        return db.select().from(lahzaEmployees).orderBy(desc(lahzaEmployees.createdAt));
      }),
      create: publicProcedure.input(z.object({ name: z.string().trim().min(2).max(80), phone: z.string().regex(/^\+9639\d{8}$/, "أدخل رقم موظف سورياً صحيحاً") })).mutation(async ({ ctx, input }) => {
        await requireAdmin(ctx, ["owner"]);
        const db = await getDb();
        if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً");
        await db.insert(lahzaEmployees).values({ name: input.name, phone: input.phone, active: true });
        return { success: true };
      }),
      update: publicProcedure.input(z.object({ id: z.number().int().positive(), name: z.string().trim().min(2).max(80), phone: z.string().regex(/^\+9639\d{8}$/, "أدخل رقم موظف سورياً صحيحاً"), active: z.boolean() })).mutation(async ({ ctx, input }) => {
        await requireAdmin(ctx, ["owner"]);
        const db = await getDb();
        if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً");
        await db.update(lahzaEmployees).set({ name: input.name, phone: input.phone, active: input.active }).where(eq(lahzaEmployees.id, input.id));
        return { success: true };
      }),
      remove: publicProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
        await requireAdmin(ctx, ["owner"]);
        const db = await getDb();
        if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً");
        await db.delete(lahzaEmployees).where(eq(lahzaEmployees.id, input.id));
        return { success: true };
      }),
    }),
    staff: router({
      list: publicProcedure.query(async ({ ctx }) => {
        await requireAdmin(ctx, ["owner"]);
        const db = await getDb();
        if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً");
        return db.select({ id: supervisors.id, username: supervisors.username, active: supervisors.active, createdAt: supervisors.createdAt }).from(supervisors).orderBy(desc(supervisors.createdAt));
      }),
      create: publicProcedure.input(z.object({ username: z.string().trim().min(3).max(64).regex(/^[A-Za-z0-9_]+$/, "استخدم أحرفاً إنجليزية أو أرقاماً أو شرطة سفلية"), password: passwordSchema })).mutation(async ({ ctx, input }) => {
        await requireAdmin(ctx, ["owner"]);
        const db = await getDb();
        if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً");
        const exists = await db.select({ id: supervisors.id }).from(supervisors).where(eq(supervisors.username, input.username)).limit(1);
        if (exists[0]) throw new Error("اسم المستخدم مستخدم بالفعل");
        await db.insert(supervisors).values({ username: input.username, passwordHash: await hashSecret(input.password), active: true });
        return { success: true };
      }),
      remove: publicProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
        await requireAdmin(ctx, ["owner"]);
        const db = await getDb();
        if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً");
        await db.delete(supervisors).where(eq(supervisors.id, input.id));
        return { success: true };
      }),
    }),
  }),
});
