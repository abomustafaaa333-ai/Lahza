import { boolean, int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

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

export const catalogItems = mysqlTable("catalog_items", {
  id: int("id").autoincrement().primaryKey(),
  code: varchar("code", { length: 80 }).notNull().unique(),
  name: varchar("name", { length: 160 }).notNull(),
  category: mysqlEnum("category", ["groceries", "chicken", "breakfast", "lamb", "butcher", "fuel", "pharmacy"]).notNull(),
  unit: varchar("unit", { length: 16 }).notNull(),
  unitPrice: int("unitPrice").notNull().default(0),
  available: boolean("available").notNull().default(true),
  deleted: boolean("deleted").notNull().default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const orders = mysqlTable("orders", {
  id: int("id").autoincrement().primaryKey(),
  orderType: mysqlEnum("orderType", ["delivery", "taxi"]).notNull(),
  customerName: varchar("customerName", { length: 80 }).notNull(),
  customerPhone: varchar("customerPhone", { length: 24 }).notNull(),
  paymentMethod: mysqlEnum("paymentMethod", ["sham_cash", "cash"]).notNull(),
  totalAmount: int("totalAmount").notNull().default(0),
  deliveryDistanceMeters: int("deliveryDistanceMeters").notNull().default(0),
  deliveryFee: int("deliveryFee").notNull().default(0),
  status: mysqlEnum("status", ["pending", "confirmed", "preparing", "on_the_way", "completed", "cancelled"]).notNull().default("pending"),
  taxiType: mysqlEnum("taxiType", ["standard", "van"]),
  pickupLocation: varchar("pickupLocation", { length: 220 }),
  destination: varchar("destination", { length: 220 }),
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
  originLatE6: int("originLatE6").notNull().default(36528100),
  originLngE6: int("originLngE6").notNull().default(37954900),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const supervisors = mysqlTable("supervisors", {
  id: int("id").autoincrement().primaryKey(),
  username: varchar("username", { length: 64 }).notNull().unique(),
  passwordHash: varchar("passwordHash", { length: 255 }).notNull(),
  active: boolean("active").notNull().default(true),
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

export const customerPresence = mysqlTable("customer_presence", {
  deviceId: varchar("deviceId", { length: 80 }).primaryKey(),
  lastSeen: timestamp("lastSeen").defaultNow().onUpdateNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
