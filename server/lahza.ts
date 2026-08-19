import { and, desc, eq, gt, inArray } from "drizzle-orm";
import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { jwtVerify, SignJWT } from "jose";
import { parse } from "cookie";
import { z } from "zod";
import { catalogItems, customerPresence, customerProfiles, lahzaEmployees, orderLines, orders, supervisors, systemSettings } from "../drizzle/schema";
import { catalogSeed, DEFAULT_TICKER_PRIMARY, DEFAULT_TICKER_SECONDARY, normalizeTickerText, type LahzaCategory } from "../shared/lahza";
import { getDb } from "./db";
import { getSessionCookieOptions } from "./_core/cookies";
import { getDirections } from "./maps";
import { publicProcedure, router } from "./_core/trpc";
import type { TrpcContext } from "./_core/context";

const scrypt = promisify(scryptCallback);
const ADMIN_COOKIE = "lahza_admin_session";
const categories = ["groceries", "chicken", "breakfast", "lamb", "butcher", "fuel", "pharmacy", "other", "offers"] as const;
const adminRoles = ["owner", "supervisor"] as const;
const orderStatuses = ["pending", "confirmed", "preparing", "on_the_way", "completed", "cancelled"] as const;
const MANBIJ_CENTER = { lat: 36.5281, lng: 37.9549 };

type AdminRole = (typeof adminRoles)[number];
type AdminSession = { role: AdminRole; supervisorId?: number };

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

function readTickerSettings(settings: { tickerPrimary?: unknown; tickerSecondary?: unknown }) {
  return {
    tickerPrimary: normalizeTickerText(settings.tickerPrimary, DEFAULT_TICKER_PRIMARY),
    tickerSecondary: normalizeTickerText(settings.tickerSecondary, DEFAULT_TICKER_SECONDARY),
  };
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

async function requireAdmin(ctx: TrpcContext, allowed: AdminRole[] = [...adminRoles]) {
  const session = await readSession(ctx);
  if (!session || !allowed.includes(session.role)) {
    throw new Error("غير مصرح لك بتنفيذ هذا الإجراء");
  }
  return session;
}

function setAdminCookie(ctx: TrpcContext, token: string) {
  ctx.res.cookie(ADMIN_COOKIE, token, {
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
});

const deviceIdSchema = z.string().trim().min(16, "معرف الجهاز غير صالح").max(80);
export function calculateLineTotal(quantity: number, unitPrice: number, unit: string) {
  if (unit === "جرام") return Math.round((quantity / 1000) * unitPrice);
  return Math.round(quantity * unitPrice);
}

export const orderInputSchema = z.object({
  orderType: z.enum(["delivery", "taxi"]),
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
      await db.insert(catalogItems).values({
        code: `custom-${input.category}-${randomBytes(8).toString("hex")}`,
        name: input.name,
        category: input.category,
        unit: input.unit,
        unitPrice: input.price,
        available: input.available,
        deleted: false,
      });
      return { success: true };
    }),
    update: publicProcedure.input(catalogItemInput.extend({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      await requireAdmin(ctx);
      const db = await getDb();
      if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً");
      await db.update(catalogItems).set({ name: input.name, category: input.category, unit: input.unit, unitPrice: input.price, available: input.available }).where(and(eq(catalogItems.id, input.id), eq(catalogItems.deleted, false)));
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
      if (input.orderType === "delivery") {
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
        customerName: input.customerName,
        customerPhone: input.customerPhone,
        paymentMethod: input.paymentMethod,
        totalAmount,
        deliveryDistanceMeters,
        deliveryFee,
        taxiType: input.taxiType ?? null,
        pickupLocation: input.pickupLocation ?? null,
        destination: input.destination ?? null,
        notes: [input.notes, deliveryPricingPending ? DELIVERY_PRICING_PENDING_NOTE : ""].filter(Boolean).join("\n") || null,
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
        const nextTickerSettings = {
          tickerPrimary: normalizeTickerText(input.tickerPrimary, DEFAULT_TICKER_PRIMARY),
          tickerSecondary: normalizeTickerText(input.tickerSecondary, DEFAULT_TICKER_SECONDARY),
        };
        await db.update(systemSettings).set(nextTickerSettings).where(eq(systemSettings.id, 1));
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
