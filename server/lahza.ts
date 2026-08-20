import { and, desc, eq, gt, inArray, sql } from "drizzle-orm";
import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { jwtVerify, SignJWT } from "jose";
import { parse } from "cookie";
import { z } from "zod";
import { catalogItems, customerPresence, customerProfiles, intercityOrders, intercityTrips, lahzaEmployees, orderLines, orders, partnerOffers, partners, stores, supervisors, systemSettings } from "../drizzle/schema";
import { catalogSeed, DEFAULT_TICKER_PRIMARY, DEFAULT_TICKER_SECONDARY, normalizeTickerText, type LahzaCategory } from "../shared/lahza";
import { getDb } from "./db";
import { getSessionCookieOptions } from "./_core/cookies";
import { getDirections } from "./maps";
import { publicProcedure, router } from "./_core/trpc";
import type { TrpcContext } from "./_core/context";

const scrypt = promisify(scryptCallback);
const ADMIN_COOKIE = "lahza_admin_session";
const PARTNER_COOKIE = "lahza_partner_session";
const categories = ["groceries", "chicken", "breakfast", "lamb", "butcher", "fuel", "pharmacy", "other", "offers", "sweets", "clothing", "mobile_accessories", "beauty_boutique"] as const;
const adminRoles = ["owner", "supervisor"] as const;
const orderStatuses = ["pending", "confirmed", "preparing", "on_the_way", "completed", "cancelled"] as const;
const MANBIJ_CENTER = { lat: 36.5281, lng: 37.9549 };

type AdminRole = (typeof adminRoles)[number];
type AdminSession = { role: AdminRole; supervisorId?: number };
type PartnerSession = { partnerId: number };

const passwordSchema = z.string().min(4, "يجب أن تتكون كلمة المرور من 4 أحرف أو أرقام على الأقل").max(100);
const coordinateSchema = z.number().finite("إحداثيات الموقع غير صالحة");

export function calculateDeliveryFee(distanceMeters: number, pricePerKm: number) {
  const billableKm = Math.max(1, Math.ceil(Math.max(0, distanceMeters) / 1000));
  return { billableKm, deliveryFee: billableKm * Math.max(0, pricePerKm) };
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

async function createSession(payload: AdminSession) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("12h")
    .sign(sessionKey());
}

async function createPartnerSession(payload: PartnerSession) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("12h")
    .sign(sessionKey());
}

async function readSession(ctx: TrpcContext): Promise<AdminSession | null> {
  const token = parse(ctx.req.headers.cookie ?? "")[ADMIN_COOKIE];
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, sessionKey());
    if (payload.role !== "owner" && payload.role !== "supervisor") return null;
    return { role: payload.role, supervisorId: typeof payload.supervisorId === "number" ? payload.supervisorId : undefined };
  } catch {
    return null;
  }
}

async function readPartnerSession(ctx: TrpcContext): Promise<PartnerSession | null> {
  const token = parse(ctx.req.headers.cookie ?? "")[PARTNER_COOKIE];
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, sessionKey());
    if (typeof payload.partnerId !== "number") return null;
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
    maxAge: 12 * 60 * 60 * 1000,
  });
}

function setPartnerCookie(ctx: TrpcContext, token: string) {
  ctx.res.cookie(PARTNER_COOKIE, token, {
    ...getSessionCookieOptions(ctx.req),
    maxAge: 12 * 60 * 60 * 1000,
  });
}

async function getSettings() {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً");
  const current = await db.select().from(systemSettings).where(eq(systemSettings.id, 1)).limit(1);
  if (current[0]) return current[0];
  const masterPinHash = await hashSecret("5555");
  await db.insert(systemSettings).values({ id: 1, masterPinHash, tickerPrimary: DEFAULT_TICKER_PRIMARY, tickerSecondary: DEFAULT_TICKER_SECONDARY });
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

async function ensureCatalogSeed() {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً");
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
  price: z.number().int().min(0).max(10_000_000),
  available: z.boolean().default(true),
  storeId: z.number().int().positive().optional(),
});

export const storeInput = z.object({
  name: z.string().trim().min(2, "أدخل اسم المتجر").max(140),
  category: z.enum(categories),
  partnerId: z.number().int().positive().nullable().optional(),
  active: z.boolean().default(true),
  sortOrder: z.number().int().min(0).max(10_000).default(0),
});

const partnerAccountInput = z.object({
  name: z.string().trim().min(2, "أدخل اسم المتجر").max(120),
  username: z.string().trim().min(3).max(64).regex(/^[A-Za-z0-9_]+$/, "استخدم أحرفاً إنجليزية أو أرقاماً أو شرطة سفلية"),
  password: passwordSchema,
});

const partnerProductInput = z.object({
  name: z.string().trim().min(2, "أدخل اسم المنتج").max(160),
  category: z.enum(categories),
  storeId: z.number().int().positive(),
  unit: z.enum(["وحدة", "جرام", "ليتر", "قنينة", "طلب"]),
  price: z.number().int().min(0).max(10_000_000),
  available: z.boolean().default(true),
  imageUrl: z.string().trim().url("أدخل رابط صورة صالحاً").max(500).optional().or(z.literal("")),
});

const tripStatusSchema = z.enum(["open", "closed", "dispatching", "arrived"]);
const intercityOrderStatusSchema = z.enum(["new", "accepted", "ready", "collected", "delivered", "cancelled"]);
const tripInput = z.object({
  title: z.string().trim().min(4).max(140),
  bookingCloseLabel: z.string().trim().min(3).max(160),
  arrivalLabel: z.string().trim().min(3).max(160),
  capacity: z.number().int().min(1).max(1000),
  pickupFee: z.number().int().min(0).max(10_000_000),
  doorstepFee: z.number().int().min(0).max(10_000_000),
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
export function calculateLineTotal(quantity: number, unitPrice: number, unit: string) {
  if (unit === "جرام") return Math.round((quantity / 1000) * unitPrice);
  return Math.round(quantity * unitPrice);
}

async function findStoreForCatalog(db: NonNullable<Awaited<ReturnType<typeof getDb>>>, storeId: number | undefined, category: LahzaCategory) {
  if (!storeId) return null;
  const found = await db.select().from(stores).where(eq(stores.id, storeId)).limit(1);
  const store = found[0];
  if (!store) throw new Error("المتجر المختار غير موجود");
  if (store.category !== category) throw new Error("يجب أن يكون المنتج ضمن القسم نفسه للمتجر المختار");
  return store;
}

export const orderInputSchema = z.object({
  orderType: z.enum(["delivery", "taxi"]),
  intercityTripId: z.number().int().positive().optional(),
  customerName: z.string().trim().min(2, "أدخل الاسم").max(80),
  customerPhone: z.string().regex(/^\+9639\d{8}$/, "أدخل رقم الهاتف السوري ابتداءً من 9"),
  locationUrl: z.string().url("حدد موقعك عبر زر تحديد موقعي قبل إرسال الطلب").max(500),
  locationLat: coordinateSchema.min(-90).max(90),
  locationLng: coordinateSchema.min(-180).max(180),
  paymentMethod: z.enum(["sham_cash", "cash"]),
  lines: z.array(lineInput).max(30),
  taxiType: z.enum(["standard", "van"]).optional(),
  pickupLocation: z.string().trim().max(220).optional(),
  destination: z.string().trim().max(220).optional(),
  notes: z.string().trim().max(500).optional(),
}).superRefine((input, context) => {
  if (input.orderType === "delivery" && input.lines.length === 0) context.addIssue({ code: "custom", message: "أضف صنفاً واحداً على الأقل" });
  if (input.orderType === "taxi" && (!input.taxiType || !input.pickupLocation || !input.destination)) context.addIssue({ code: "custom", message: "أكمل بيانات التاكسي" });
});

export const lahzaRouter = router({
  interfaceSettings: router({
    get: publicProcedure.query(async () => {
      const settings = await getSettings();
      return readTickerSettings(settings);
    }),
  }),
  customers: router({
    touch: publicProcedure.input(z.object({ deviceId: deviceIdSchema })).mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً");
      await db.insert(customerPresence).values({ deviceId: input.deviceId, lastSeen: new Date() }).onDuplicateKeyUpdate({ set: { lastSeen: new Date() } });
      return { success: true };
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
  delivery: router({
    quote: publicProcedure.input(z.object({ locationLat: coordinateSchema.min(-90).max(90), locationLng: coordinateSchema.min(-180).max(180) })).mutation(async ({ input }) => getDrivingQuote(input.locationLat, input.locationLng)),
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
      await db.insert(catalogItems).values({
        code: `custom-${input.category}-${randomBytes(8).toString("hex")}`,
        name: input.name,
        category: input.category,
        unit: input.unit,
        unitPrice: input.price,
        available: input.available,
        deleted: false,
        storeId: store?.id ?? null,
      });
      return { success: true };
    }),
    update: publicProcedure.input(catalogItemInput.extend({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      await requireAdmin(ctx);
      const db = await getDb();
      if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً");
      const store = await findStoreForCatalog(db, input.storeId, input.category);
      await db.update(catalogItems).set({ name: input.name, category: input.category, unit: input.unit, unitPrice: input.price, available: input.available, ...(input.storeId !== undefined ? { storeId: store?.id ?? null } : {}) }).where(and(eq(catalogItems.id, input.id), eq(catalogItems.deleted, false)));
      return { success: true };
    }),
    updatePrice: publicProcedure.input(z.object({ id: z.number().int().positive(), price: z.number().int().min(0).max(10_000_000) })).mutation(async ({ ctx, input }) => {
      await requireAdmin(ctx);
      const db = await getDb();
      if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً");
      await db.update(catalogItems).set({ unitPrice: input.price }).where(and(eq(catalogItems.id, input.id), eq(catalogItems.deleted, false)));
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
    stores: publicProcedure.input(z.object({ category: z.enum(categories) })).query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً");
      const categoryStores = await db.select().from(stores).where(and(eq(stores.category, input.category), eq(stores.active, true))).orderBy(stores.sortOrder, stores.name);
      const activePartners = await db.select({ id: partners.id, active: partners.active, storeOpen: partners.storeOpen }).from(partners);
      const partnerById = new Map(activePartners.map(partner => [partner.id, partner]));
      return categoryStores.filter(store => {
        if (!store.partnerId) return true;
        const partner = partnerById.get(store.partnerId);
        return Boolean(partner?.active && partner.storeOpen);
      });
    }),
    products: publicProcedure.input(z.object({ storeId: z.number().int().positive() })).query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً");
      const found = await db.select().from(stores).where(and(eq(stores.id, input.storeId), eq(stores.active, true))).limit(1);
      const store = found[0];
      if (!store) throw new Error("هذا المتجر غير متاح حالياً");
      if (store.partnerId) {
        const partner = await db.select({ active: partners.active, storeOpen: partners.storeOpen }).from(partners).where(eq(partners.id, store.partnerId)).limit(1);
        if (!partner[0]?.active || !partner[0].storeOpen) throw new Error("هذا المتجر مغلق حالياً");
      }
      const products = await db.select().from(catalogItems).where(and(eq(catalogItems.storeId, store.id), eq(catalogItems.deleted, false), eq(catalogItems.available, true))).orderBy(catalogItems.name);
      return { store, products };
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
        return partner?.storeOpen ? [{ ...item, partnerName: partner.name }] : [];
      });
    }),
    offers: publicProcedure.query(async () => {
      const db = await getDb();
      if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً");
      const activeOffers = await db.select().from(partnerOffers).where(eq(partnerOffers.active, true)).orderBy(desc(partnerOffers.createdAt));
      const activePartners = await db.select({ id: partners.id, name: partners.name, storeOpen: partners.storeOpen }).from(partners).where(eq(partners.active, true));
      const partnerById = new Map(activePartners.map(partner => [partner.id, partner]));
      return activeOffers.flatMap(offer => {
        const partner = partnerById.get(offer.partnerId);
        return partner?.storeOpen ? [{ ...offer, partnerName: partner.name }] : [];
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
  partner: router({
    session: publicProcedure.query(async ({ ctx }) => {
      const session = await readPartnerSession(ctx);
      if (!session) return null;
      const db = await getDb();
      if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً");
      const found = await db.select({ id: partners.id, name: partners.name, username: partners.username, active: partners.active, storeOpen: partners.storeOpen, preparationMinutes: partners.preparationMinutes }).from(partners).where(eq(partners.id, session.partnerId)).limit(1);
      if (!found[0]) return null;
      const assignedStores = await db.select().from(stores).where(eq(stores.partnerId, found[0].id)).orderBy(stores.category, stores.sortOrder, stores.name);
      return { ...found[0], stores: assignedStores };
    }),
    login: publicProcedure.input(z.object({ username: z.string().trim().min(3).max(64), password: passwordSchema })).mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً");
      const found = await db.select().from(partners).where(and(eq(partners.username, input.username), eq(partners.active, true))).limit(1);
      if (!found[0] || !await verifySecret(input.password, found[0].passwordHash)) throw new Error("بيانات دخول الشريك غير صحيحة");
      setPartnerCookie(ctx, await createPartnerSession({ partnerId: found[0].id }));
      return { id: found[0].id, name: found[0].name };
    }),
    logout: publicProcedure.mutation(({ ctx }) => {
      ctx.res.clearCookie(PARTNER_COOKIE, getSessionCookieOptions(ctx.req));
      return { success: true };
    }),
    store: router({
      update: publicProcedure.input(z.object({ storeOpen: z.boolean(), preparationMinutes: z.number().int().min(0).max(1440) })).mutation(async ({ ctx, input }) => {
        const { db, partner } = await requirePartner(ctx);
        await db.update(partners).set({ storeOpen: input.storeOpen, preparationMinutes: input.preparationMinutes }).where(eq(partners.id, partner.id));
        return { success: true };
      }),
    }),
    stores: router({
      list: publicProcedure.query(async ({ ctx }) => {
        const { db, partner } = await requirePartner(ctx);
        return db.select().from(stores).where(eq(stores.partnerId, partner.id)).orderBy(stores.category, stores.sortOrder, stores.name);
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
        await db.insert(catalogItems).values({ code: `partner-${partner.id}-${randomBytes(8).toString("hex")}`, name: input.name, category: input.category, unit: input.unit, unitPrice: input.price, available: input.available, deleted: false, partnerId: partner.id, storeId: store.id, imageUrl: input.imageUrl || null });
        return { success: true };
      }),
      update: publicProcedure.input(partnerProductInput.extend({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
        const { db, store } = await requirePartnerStore(ctx, input.storeId);
        if (store.category !== input.category) throw new Error("يمكنك تعديل منتجات القسم الخاص بمتجرك فقط");
        await db.update(catalogItems).set({ name: input.name, category: input.category, unit: input.unit, unitPrice: input.price, available: input.available, imageUrl: input.imageUrl || null }).where(and(eq(catalogItems.id, input.id), eq(catalogItems.storeId, store.id), eq(catalogItems.deleted, false)));
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
    }),
    offers: router({
      list: publicProcedure.query(async ({ ctx }) => {
        const { db, partner } = await requirePartner(ctx);
        return db.select().from(partnerOffers).where(eq(partnerOffers.partnerId, partner.id)).orderBy(desc(partnerOffers.createdAt));
      }),
      create: publicProcedure.input(z.object({ text: z.string().trim().min(3).max(220), active: z.boolean().default(true) })).mutation(async ({ ctx, input }) => {
        const { db, partner } = await requirePartner(ctx);
        await db.insert(partnerOffers).values({ partnerId: partner.id, text: input.text, active: input.active });
        return { success: true };
      }),
      update: publicProcedure.input(z.object({ id: z.number().int().positive(), text: z.string().trim().min(3).max(220), active: z.boolean() })).mutation(async ({ ctx, input }) => {
        const { db, partner } = await requirePartner(ctx);
        await db.update(partnerOffers).set({ text: input.text, active: input.active }).where(and(eq(partnerOffers.id, input.id), eq(partnerOffers.partnerId, partner.id)));
        return { success: true };
      }),
      remove: publicProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
        const { db, partner } = await requirePartner(ctx);
        await db.delete(partnerOffers).where(and(eq(partnerOffers.id, input.id), eq(partnerOffers.partnerId, partner.id)));
        return { success: true };
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
    create: publicProcedure.input(orderInputSchema).mutation(async ({ input }) => {
      const db = await ensureCatalogSeed();
      const ids = input.lines.flatMap(line => line.catalogItemId ? [line.catalogItemId] : []);
      const products = ids.length ? await db.select().from(catalogItems).where(inArray(catalogItems.id, ids)) : [];
      const productMap = new Map(products.map(product => [product.id, product]));
      let totalAmount = 0;
      const resolvedLines = input.lines.map(line => {
        const product = line.catalogItemId ? productMap.get(line.catalogItemId) : undefined;
        const isPharmacy = line.category === "pharmacy";
        const unitPrice = !isPharmacy && product?.available && !product.deleted ? product.unitPrice : 0;
        const lineTotal = calculateLineTotal(line.quantity, unitPrice, line.unit);
        totalAmount += lineTotal;
        return { ...line, unitPrice, lineTotal, priceKnown: !isPharmacy && Boolean(product && !product.deleted) };
      });
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
        deliveryFee = intercityTrip.pickupFee;
        totalAmount += deliveryFee;
      } else if (input.orderType === "delivery") {
        try {
          const quote = await getDrivingQuote(input.locationLat, input.locationLng);
          deliveryDistanceMeters = quote.distanceMeters;
          deliveryFee = quote.deliveryFee;
          totalAmount += deliveryFee;
        } catch (error) {
          const pendingCalculation = pendingDeliveryCalculation();
          deliveryDistanceMeters = pendingCalculation.deliveryDistanceMeters;
          deliveryFee = pendingCalculation.deliveryFee;
          deliveryPricingPending = pendingCalculation.deliveryPricingPending;
          console.warn("[Lahza] تعذر احتساب مسافة الطريق؛ سيُحفظ الطلب برسوم توصيل تحدد لاحقاً.", error);
        }
      }

      const created = await db.insert(orders).values({
        orderType: input.orderType,
        intercityTripId: intercityTrip?.id ?? null,
        customerName: input.customerName,
        customerPhone: input.customerPhone,
        paymentMethod: input.paymentMethod,
        totalAmount,
        deliveryDistanceMeters,
        deliveryFee,
        taxiType: input.taxiType ?? null,
        pickupLocation: input.pickupLocation ?? null,
        destination: input.destination ?? null,
        notes: [input.notes, intercityTrip ? `حجز جرابلس: ${intercityTrip.title} · ${intercityTrip.bookingCloseLabel} · ${intercityTrip.arrivalLabel}` : "", deliveryPricingPending ? DELIVERY_PRICING_PENDING_NOTE : ""].filter(Boolean).join("\n") || null,
      });
      const orderId = Number(created[0].insertId);
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
    list: publicProcedure.query(async ({ ctx }) => {
      await requireAdmin(ctx);
      const db = await getDb();
      if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً");
      const allOrders = await db.select().from(orders).orderBy(desc(orders.createdAt));
      const ids = allOrders.map(order => order.id);
      const lines = ids.length ? await db.select().from(orderLines).where(inArray(orderLines.orderId, ids)) : [];
      return allOrders.map(order => ({ ...order, lines: lines.filter(line => line.orderId === order.id) }));
    }),
    updateStatus: publicProcedure.input(z.object({ id: z.number().int().positive(), status: z.enum(orderStatuses) })).mutation(async ({ ctx, input }) => {
      await requireAdmin(ctx);
      const db = await getDb();
      if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً");
      await db.update(orders).set({ status: input.status }).where(eq(orders.id, input.id));
      return { success: true };
    }),
  }),
  admin: router({
    stores: router({
      list: publicProcedure.query(async ({ ctx }) => {
        await requireAdmin(ctx);
        const db = await getDb();
        if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً");
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
        await db.insert(stores).values({ name: input.name, category: input.category, partnerId: input.partnerId ?? null, active: input.active, sortOrder: input.sortOrder });
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
        const { id, ...patch } = input;
        await db.update(stores).set(patch).where(eq(stores.id, id));
        return { success: true };
      }),
      remove: publicProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
        await requireAdmin(ctx, ["owner"]);
        const db = await getDb();
        if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً");
        await db.delete(stores).where(eq(stores.id, input.id));
        return { success: true };
      }),
    }),
    partners: router({
      list: publicProcedure.query(async ({ ctx }) => {
        await requireAdmin(ctx, ["owner"]);
        const db = await getDb();
        if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً");
        return db.select({ id: partners.id, name: partners.name, username: partners.username, active: partners.active, storeOpen: partners.storeOpen, preparationMinutes: partners.preparationMinutes, createdAt: partners.createdAt }).from(partners).orderBy(desc(partners.createdAt));
      }),
      create: publicProcedure.input(partnerAccountInput).mutation(async ({ ctx, input }) => {
        await requireAdmin(ctx, ["owner"]);
        const db = await getDb();
        if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً");
        const exists = await db.select({ id: partners.id }).from(partners).where(eq(partners.username, input.username)).limit(1);
        if (exists[0]) throw new Error("اسم مستخدم الشريك مستخدم بالفعل");
        await db.insert(partners).values({ name: input.name, username: input.username, passwordHash: await hashSecret(input.password), active: true, storeOpen: true, preparationMinutes: 20 });
        return { success: true };
      }),
      update: publicProcedure.input(z.object({ id: z.number().int().positive(), name: z.string().trim().min(2).max(120), active: z.boolean(), storeOpen: z.boolean(), preparationMinutes: z.number().int().min(0).max(1440) })).mutation(async ({ ctx, input }) => {
        await requireAdmin(ctx, ["owner"]);
        const db = await getDb();
        if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً");
        await db.update(partners).set({ name: input.name, active: input.active, storeOpen: input.storeOpen, preparationMinutes: input.preparationMinutes }).where(eq(partners.id, input.id));
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
          await db.insert(intercityTrips).values(input);
          return { success: true };
        }),
        update: publicProcedure.input(tripInput.extend({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
          await requireAdmin(ctx, ["owner"]);
          const db = await getDb();
          if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً");
          const { id, ...patch } = input;
          await db.update(intercityTrips).set(patch).where(eq(intercityTrips.id, id));
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
    session: publicProcedure.query(async ({ ctx }) => readSession(ctx)),
    login: publicProcedure.input(z.discriminatedUnion("role", [
      z.object({ role: z.literal("owner"), pin: passwordSchema }),
      z.object({ role: z.literal("supervisor"), username: z.string().trim().min(3).max(64), password: passwordSchema }),
    ])).mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً");
      if (input.role === "owner") {
        const settings = await getSettings();
        if (!await verifySecret(input.pin, settings.masterPinHash)) throw new Error("رمز PIN غير صحيح");
        setAdminCookie(ctx, await createSession({ role: "owner" }));
        return { role: "owner" as const };
      }
      const found = await db.select().from(supervisors).where(and(eq(supervisors.username, input.username), eq(supervisors.active, true))).limit(1);
      if (!found[0] || !await verifySecret(input.password, found[0].passwordHash)) throw new Error("بيانات دخول المشرف غير صحيحة");
      setAdminCookie(ctx, await createSession({ role: "supervisor", supervisorId: found[0].id }));
      return { role: "supervisor" as const };
    }),
    logout: publicProcedure.mutation(({ ctx }) => {
      ctx.res.clearCookie(ADMIN_COOKIE, getSessionCookieOptions(ctx.req));
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
          pricePerKm: settings.deliveryPricePerKm,
          originLat: settings.originLatE6 / 1_000_000,
          originLng: settings.originLngE6 / 1_000_000,
          originLabel: "مركز مدينة منبج",
        };
      }),
      update: publicProcedure.input(z.object({ pricePerKm: z.number().int().min(0).max(1_000_000), originLat: coordinateSchema.min(-90).max(90), originLng: coordinateSchema.min(-180).max(180) })).mutation(async ({ ctx, input }) => {
        await requireAdmin(ctx);
        const db = await getDb();
        if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً");
        await db.update(systemSettings).set({ deliveryPricePerKm: input.pricePerKm, originLatE6: Math.round(input.originLat * 1_000_000), originLngE6: Math.round(input.originLng * 1_000_000) }).where(eq(systemSettings.id, 1));
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
