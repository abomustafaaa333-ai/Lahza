import { boolean, int, mysqlEnum, mysqlTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/mysql-core";
import { CITY_KEYS } from "../shared/cities";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const partners = mysqlTable("partners", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 120 }).notNull(),
  imageUrl: varchar("imageUrl", { length: 500 }),
  username: varchar("username", { length: 64 }).notNull().unique(),
  passwordHash: varchar("passwordHash", { length: 255 }).notNull(),
  active: boolean("active").notNull().default(true),
  storeOpen: boolean("storeOpen").notNull().default(true),
  preparationMinutes: int("preparationMinutes").notNull().default(20),
  workHours: text("workHours"),
  city: mysqlEnum("city", CITY_KEYS).notNull().default("manbij"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const customCategories = mysqlTable("custom_categories", {
  id: int("id").autoincrement().primaryKey(),
  slug: varchar("slug", { length: 80 }).notNull().unique(),
  title: varchar("title", { length: 120 }).notNull(),
  subtitle: varchar("subtitle", { length: 180 }).notNull().default("متاجر ومنتجات القسم"),
  active: boolean("active").notNull().default(true),
  sortOrder: int("sortOrder").notNull().default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const stores = mysqlTable("stores", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 140 }).notNull(),
  category: mysqlEnum("category", ["restaurants", "groceries", "household", "produce", "bakery", "butcher", "gas", "pharmacy", "sweets", "clothing", "mobile_accessories", "beauty_personal_care", "baby", "school_stationery", "chicken", "breakfast", "lamb", "fuel", "other", "offers", "beauty_boutique"]).notNull(),
  restaurantType: mysqlEnum("restaurantType", ["all", "breakfast", "chicken", "grills", "sandwiches"]).notNull().default("all"),
  customCategoryId: int("customCategoryId").references(() => customCategories.id, { onDelete: "set null" }),
  partnerId: int("partnerId").references(() => partners.id, { onDelete: "set null" }),
  imageUrl: varchar("imageUrl", { length: 500 }),
  active: boolean("active").notNull().default(true),
  sortOrder: int("sortOrder").notNull().default(0),
  city: mysqlEnum("city", CITY_KEYS).notNull().default("manbij"),
  // A Manbij store can be deliberately published in the Jarabulus gateway.
  // It remains a Manbij store for all local operations.
  jarabulusGatewayEnabled: boolean("jarabulusGatewayEnabled").notNull().default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export const storeTrafficEvents = mysqlTable("store_traffic_events", {
  id: int("id").autoincrement().primaryKey(),
  storeId: int("storeId").notNull().references(() => stores.id, { onDelete: "cascade" }),
  source: mysqlEnum("source", ["direct", "qr"]).notNull().default("direct"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export const catalogItems = mysqlTable("catalog_items", {
  id: int("id").autoincrement().primaryKey(),
  code: varchar("code", { length: 80 }).notNull().unique(),
  name: varchar("name", { length: 160 }).notNull(),
  category: mysqlEnum("category", ["restaurants", "groceries", "household", "produce", "bakery", "butcher", "gas", "pharmacy", "sweets", "clothing", "mobile_accessories", "beauty_personal_care", "baby", "school_stationery", "chicken", "breakfast", "lamb", "fuel", "other", "offers", "beauty_boutique"]).notNull(),
  unit: varchar("unit", { length: 16 }).notNull(),
  unitPrice: int("unitPrice").notNull().default(0),
  available: boolean("available").notNull().default(true),
  deleted: boolean("deleted").notNull().default(false),
  partnerId: int("partnerId").references(() => partners.id, { onDelete: "set null" }),
  storeId: int("storeId").references(() => stores.id, { onDelete: "set null" }),
  customCategoryId: int("customCategoryId").references(() => customCategories.id, { onDelete: "set null" }),
  imageUrl: varchar("imageUrl", { length: 500 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const partnerOffers = mysqlTable("partner_offers", {
  id: int("id").autoincrement().primaryKey(),
  partnerId: int("partnerId").notNull().references(() => partners.id, { onDelete: "cascade" }),
  storeId: int("storeId").references(() => stores.id, { onDelete: "cascade" }),
  catalogItemId: int("catalogItemId").references(() => catalogItems.id, { onDelete: "set null" }),
  text: varchar("text", { length: 220 }).notNull(),
  discountPercent: int("discountPercent").notNull().default(0),
  offerPrice: int("offerPrice").notNull().default(0),
  imageUrl: varchar("imageUrl", { length: 500 }),
  imageStorageKey: varchar("imageStorageKey", { length: 500 }),
  imageDeletePending: boolean("imageDeletePending").notNull().default(false),
  durationDays: int("durationDays"),
  expiresAt: timestamp("expiresAt"),
  deletedAt: timestamp("deletedAt"),
  active: boolean("active").notNull().default(true),
  featuredStatus: mysqlEnum("featuredStatus", ["none", "pending", "approved", "rejected"]).notNull().default("none"),
  featuredRequestedAt: timestamp("featuredRequestedAt"),
  featuredReviewedAt: timestamp("featuredReviewedAt"),
  featuredReviewNote: varchar("featuredReviewNote", { length: 300 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const intercityTrips = mysqlTable("intercity_trips", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 140 }).notNull(),
  bookingCloseLabel: varchar("bookingCloseLabel", { length: 160 }).notNull(),
  arrivalLabel: varchar("arrivalLabel", { length: 160 }).notNull(),
  capacity: int("capacity").notNull().default(0),
  pickupFee: int("pickupFee").notNull().default(0),
  doorstepFee: int("doorstepFee").notNull().default(0),
  status: mysqlEnum("status", ["open", "closed", "dispatching", "arrived"]).notNull().default("open"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const intercityOrders = mysqlTable("intercity_orders", {
  id: int("id").autoincrement().primaryKey(),
  tripId: int("tripId").notNull().references(() => intercityTrips.id, { onDelete: "cascade" }),
  partnerId: int("partnerId").references(() => partners.id, { onDelete: "set null" }),
  catalogItemId: int("catalogItemId").references(() => catalogItems.id, { onDelete: "set null" }),
  customerName: varchar("customerName", { length: 80 }).notNull(),
  customerPhone: varchar("customerPhone", { length: 24 }).notNull(),
  locationUrl: varchar("locationUrl", { length: 500 }).notNull(),
  itemName: varchar("itemName", { length: 180 }).notNull(),
  quantity: varchar("quantity", { length: 32 }).notNull().default("1"),
  deliveryChoice: mysqlEnum("deliveryChoice", ["pickup_point", "doorstep"]).notNull().default("pickup_point"),
  itemAmount: int("itemAmount").notNull().default(0),
  tripFee: int("tripFee").notNull().default(0),
  status: mysqlEnum("status", ["new", "accepted", "ready", "collected", "delivered", "cancelled"]).notNull().default("new"),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const orders = mysqlTable("orders", {
  id: int("id").autoincrement().primaryKey(),
  orderType: mysqlEnum("orderType", ["delivery", "taxi"]).notNull(),
  orderCity: mysqlEnum("orderCity", CITY_KEYS).notNull().default("manbij"),
  fulfillmentScope: mysqlEnum("fulfillmentScope", ["local", "manbij_to_jarabulus"]).notNull().default("local"),
  intercityTripId: int("intercityTripId").references(() => intercityTrips.id, { onDelete: "set null" }),
  customerName: varchar("customerName", { length: 80 }).notNull(),
  customerPhone: varchar("customerPhone", { length: 24 }).notNull(),
  paymentMethod: mysqlEnum("paymentMethod", ["sham_cash", "cash"]).notNull(),
  totalAmount: int("totalAmount").notNull().default(0),
  discountCode: varchar("discountCode", { length: 40 }),
  referralCode: varchar("referralCode", { length: 40 }),
  discountAmount: int("discountAmount").notNull().default(0),
  pointsUsed: int("pointsUsed").notNull().default(0),
  pointsRewardPercent: int("pointsRewardPercent").notNull().default(0),
  deliveryDistanceMeters: int("deliveryDistanceMeters").notNull().default(0),
  deliveryFee: int("deliveryFee").notNull().default(0),
  preparationMinutes: int("preparationMinutes").notNull().default(0),
  status: mysqlEnum("status", ["pending", "confirmed", "preparing", "on_the_way", "completed", "cancelled", "rejected"]).notNull().default("pending"),
  taxiType: mysqlEnum("taxiType", ["standard", "van"]),
  pickupLocation: varchar("pickupLocation", { length: 220 }),
  destination: varchar("destination", { length: 220 }),
  locationMode: mysqlEnum("locationMode", ["gps", "manual"]).notNull().default("gps"),
  locationText: varchar("locationText", { length: 280 }),
  locationUrl: varchar("locationUrl", { length: 500 }),
  locationLat: int("locationLat"),
  locationLng: int("locationLng"),
  statusReason: varchar("statusReason", { length: 300 }),
  statusChangedAt: timestamp("statusChangedAt").defaultNow().notNull(),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const orderLines = mysqlTable("order_lines", {
  id: int("id").autoincrement().primaryKey(),
  orderId: int("orderId").notNull().references(() => orders.id, { onDelete: "cascade" }),
  catalogItemId: int("catalogItemId").references(() => catalogItems.id, { onDelete: "set null" }),
  category: varchar("category", { length: 32 }).notNull(),
  itemName: varchar("itemName", { length: 160 }).notNull(),
  quantity: varchar("quantity", { length: 32 }).notNull(),
  unit: varchar("unit", { length: 16 }).notNull(),
  unitPrice: int("unitPrice").notNull().default(0),
  lineTotal: int("lineTotal").notNull().default(0),
  priceKnown: boolean("priceKnown").notNull().default(false),
  notes: text("notes"),
});

export const systemSettings = mysqlTable("system_settings", {
  id: int("id").primaryKey(),
  masterPinHash: varchar("masterPinHash", { length: 255 }).notNull(),
  deliveryPricePerKm: int("deliveryPricePerKm").notNull().default(2),
  manbijDeliveryPercent: int("manbijDeliveryPercent").notNull().default(20),
  jarabulusDeliveryPercent: int("jarabulusDeliveryPercent").notNull().default(30),
  jarabulusMinimumOrder: int("jarabulusMinimumOrder").notNull().default(500),
  jarabulusPreparationMinutes: int("jarabulusPreparationMinutes").notNull().default(120),
  pointsRewardPercent: int("pointsRewardPercent").notNull().default(0),
  driverDeliveryPercent: int("driverDeliveryPercent").notNull().default(0),
  originLatE6: int("originLatE6").notNull().default(36528100),
  originLngE6: int("originLngE6").notNull().default(37954900),
  tickerPrimary: varchar("tickerPrimary", { length: 220 }).notNull().default("حقق ١٠ طلبات واربح معنا هدية"),
  tickerSecondary: varchar("tickerSecondary", { length: 220 }).notNull().default("لحظة — منبج بين يديك"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const supervisors = mysqlTable("supervisors", {
  id: int("id").autoincrement().primaryKey(),
  username: varchar("username", { length: 64 }).notNull().unique(),
  passwordHash: varchar("passwordHash", { length: 255 }).notNull(),
  active: boolean("active").notNull().default(true),
  city: mysqlEnum("city", CITY_KEYS).notNull().default("manbij"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export const lahzaEmployees = mysqlTable("lahza_employees", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 80 }).notNull(),
  phone: varchar("phone", { length: 24 }).notNull(),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const supportContacts = mysqlTable("support_contacts", {
  id: int("id").autoincrement().primaryKey(),
  label: varchar("label", { length: 80 }).notNull(),
  phone: varchar("phone", { length: 24 }).notNull(),
  callEnabled: boolean("callEnabled").notNull().default(true),
  whatsappEnabled: boolean("whatsappEnabled").notNull().default(true),
  active: boolean("active").notNull().default(true),
  sortOrder: int("sortOrder").notNull().default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const customerProfiles = mysqlTable("customer_profiles", {
  id: int("id").autoincrement().primaryKey(),
  deviceId: varchar("deviceId", { length: 80 }).notNull().unique(),
  name: varchar("name", { length: 80 }).notNull(),
  phone: varchar("phone", { length: 24 }).notNull().default(""),
  location: varchar("location", { length: 280 }).notNull(),
  locationUrl: varchar("locationUrl", { length: 500 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const customerAccounts = mysqlTable("customer_accounts", {
  id: int("id").autoincrement().primaryKey(),
  phone: varchar("phone", { length: 24 }).notNull().unique(),
  name: varchar("name", { length: 80 }).notNull(),
  city: mysqlEnum("city", ["منبج", "جرابلس"]).notNull().default("منبج"),
  status: mysqlEnum("status", ["pending", "approved", "rejected", "suspended"]).notNull().default("pending"),
  verifiedAt: timestamp("verifiedAt"),
  verifiedBy: varchar("verifiedBy", { length: 80 }),
  rejectionReason: varchar("rejectionReason", { length: 300 }),
  lastOrderId: int("lastOrderId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const discountCodes = mysqlTable("discount_codes", {
  id: int("id").autoincrement().primaryKey(),
  code: varchar("code", { length: 40 }).notNull().unique(),
  discountPercent: int("discountPercent").notNull().default(0),
  active: boolean("active").notNull().default(true),
  maxUses: int("maxUses"),
  usedCount: int("usedCount").notNull().default(0),
  expiresAt: timestamp("expiresAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export const customerReferrals = mysqlTable("customer_referrals", {
  id: int("id").autoincrement().primaryKey(),
  code: varchar("code", { length: 40 }).notNull().unique(),
  ownerPhone: varchar("ownerPhone", { length: 24 }).notNull(),
  referredPhone: varchar("referredPhone", { length: 24 }),
  referredOrderId: int("referredOrderId"),
  completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export const customerPoints = mysqlTable("customer_points", {
  id: int("id").autoincrement().primaryKey(),
  customerPhone: varchar("customerPhone", { length: 24 }).notNull().unique(),
  balance: int("balance").notNull().default(0),
  lifetimeEarned: int("lifetimeEarned").notNull().default(0),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export const pointTransactions = mysqlTable("point_transactions", {
  id: int("id").autoincrement().primaryKey(),
  customerPhone: varchar("customerPhone", { length: 24 }).notNull(),
  points: int("points").notNull().default(1),
  reason: mysqlEnum("reason", ["order_completed", "referral_completed", "reward_redeemed"]).notNull(),
  rewardPercent: int("rewardPercent"),
  orderId: int("orderId"),
  referralId: int("referralId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => ({ orderPointUnique: uniqueIndex("point_transactions_order_unique").on(table.orderId), referralPointUnique: uniqueIndex("point_transactions_referral_unique").on(table.referralId) }));
export const customerPresence = mysqlTable("customer_presence", {
  deviceId: varchar("deviceId", { length: 80 }).primaryKey(),
  lastSeen: timestamp("lastSeen").defaultNow().onUpdateNow().notNull(),
});

export const missingProductRequests = mysqlTable("missing_product_requests", {
  id: int("id").autoincrement().primaryKey(),
  customerName: varchar("customerName", { length: 80 }).notNull(),
  customerPhone: varchar("customerPhone", { length: 24 }).notNull(),
  productName: varchar("productName", { length: 180 }).notNull(),
  notes: varchar("notes", { length: 500 }),
  status: mysqlEnum("status", ["new", "contacted", "fulfilled", "closed"]).notNull().default("new"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const drivers = mysqlTable("drivers", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 80 }).notNull(),
  phone: varchar("phone", { length: 24 }).notNull().unique(),
  vehicleType: mysqlEnum("vehicleType", ["motorcycle", "car", "van"]).notNull().default("motorcycle"),
  region: varchar("region", { length: 120 }).notNull().default("منبج"),
  active: boolean("active").notNull().default(true),
  available: boolean("available").notNull().default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const orderAssignments = mysqlTable("order_assignments", {
  id: int("id").autoincrement().primaryKey(),
  orderId: int("orderId").notNull().unique().references(() => orders.id, { onDelete: "cascade" }),
  driverId: int("driverId").notNull().references(() => drivers.id, { onDelete: "restrict" }),
  status: mysqlEnum("status", ["assigned", "accepted", "picked_up", "delivered", "cancelled"]).notNull().default("assigned"),
  note: varchar("note", { length: 300 }),
  assignedAt: timestamp("assignedAt").defaultNow().notNull(),
  acceptedAt: timestamp("acceptedAt"),
  deliveredAt: timestamp("deliveredAt"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const inventoryMovements = mysqlTable("inventory_movements", {
  id: int("id").autoincrement().primaryKey(),
  catalogItemId: int("catalogItemId").notNull().references(() => catalogItems.id, { onDelete: "cascade" }),
  quantityDelta: int("quantityDelta").notNull(),
  reason: mysqlEnum("reason", ["purchase", "adjustment", "order_reserved", "order_released"]).notNull(),
  orderId: int("orderId").references(() => orders.id, { onDelete: "set null" }),
  note: varchar("note", { length: 300 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const financeEntries = mysqlTable("finance_entries", {
  id: int("id").autoincrement().primaryKey(),
  orderId: int("orderId").references(() => orders.id, { onDelete: "set null" }),
  kind: mysqlEnum("kind", ["order_income", "delivery_fee", "partner_payable", "driver_payable", "adjustment"]).notNull(),
  direction: mysqlEnum("direction", ["credit", "debit"]).notNull(),
  amount: int("amount").notNull().default(0),
  status: mysqlEnum("status", ["open", "settled", "void"]).notNull().default("open"),
  note: varchar("note", { length: 300 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  settledAt: timestamp("settledAt"),
});

export const notificationCampaigns = mysqlTable("notification_campaigns", {
  id: int("id").autoincrement().primaryKey(),
  kind: mysqlEnum("kind", ["offer", "event", "reminder"]).notNull(),
  title: varchar("title", { length: 120 }).notNull(),
  body: varchar("body", { length: 300 }).notNull(),
  targetPath: varchar("targetPath", { length: 180 }).notNull().default("/"),
  scheduledAt: timestamp("scheduledAt"),
  expiresAt: timestamp("expiresAt"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const customerNotifications = mysqlTable("customer_notifications", {
  id: int("id").autoincrement().primaryKey(),
  campaignId: int("campaignId").notNull().references(() => notificationCampaigns.id, { onDelete: "cascade" }),
  deviceId: varchar("deviceId", { length: 80 }).notNull().references(() => customerPresence.deviceId, { onDelete: "cascade" }),
  readAt: timestamp("readAt"),
  deliveredAt: timestamp("deliveredAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => ({ campaignDeviceUnique: uniqueIndex("customer_notifications_campaign_device_unique").on(table.campaignId, table.deviceId) }));

/** A durable in-app notification trail for an individual customer order. */
export const orderNotifications = mysqlTable("order_notifications", {
  id: int("id").autoincrement().primaryKey(),
  orderId: int("orderId").notNull().references(() => orders.id, { onDelete: "cascade" }),
  customerPhone: varchar("customerPhone", { length: 24 }).notNull(),
  status: mysqlEnum("status", ["pending", "confirmed", "preparing", "on_the_way", "completed", "cancelled", "rejected"]).notNull(),
  title: varchar("title", { length: 120 }).notNull(),
  body: varchar("body", { length: 300 }).notNull(),
  readAt: timestamp("readAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
