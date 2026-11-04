import { sql } from "drizzle-orm";
import type { getDb } from "./db";

type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;

export type TaxiType = "standard" | "van";

let schemaPromise: Promise<void> | null = null;
export function ensureTaxiSchema(db: Db) {
  schemaPromise ??= (async () => {
    // Where the ride ends, in millionths of a degree like `locationLat`; the pickup lives in `locationLat`/`locationLng`.
    await db.execute(sql.raw("ALTER TABLE `orders` ADD COLUMN IF NOT EXISTS `destinationLat` INT NULL"));
    await db.execute(sql.raw("ALTER TABLE `orders` ADD COLUMN IF NOT EXISTS `destinationLng` INT NULL"));
    // The vehicle a وصّل لي customer asked for: "motorcycle" or "car".
    await db.execute(sql.raw("ALTER TABLE `orders` ADD COLUMN IF NOT EXISTS `requestedVehicle` VARCHAR(20) NULL"));
  })().catch(error => { schemaPromise = null; throw error; });
  return schemaPromise;
}

const rowsOf = <T>(result: unknown) => { const rows = Array.isArray(result) ? result[0] : []; return (Array.isArray(rows) ? rows : []) as T[]; };

/** The driver vehicle that serves each taxi type. */
export const taxiVehicle = (taxiType: TaxiType) => (taxiType === "van" ? "van" as const : "car" as const);

export type DriverVehicle = "motorcycle" | "car" | "van";
export type WosselVehicle = "motorcycle" | "car";

/**
 * Which drivers an order goes to: store and Lahza deliveries by motorbike, taxis by car or van as the
 * customer chose, and وصّل لي by the vehicle the customer picked (motorbike unless they asked for a car).
 */
export function vehicleForOrder(order: { orderType: string; taxiType?: string | null }, wosselVehicle?: string | null): DriverVehicle {
  if (order.orderType === "taxi") return taxiVehicle(order.taxiType === "van" ? "van" : "standard");
  if (order.orderType === "wossel_li") return wosselVehicle === "car" ? "car" : "motorcycle";
  return "motorcycle";
}

export const vehicleLabel = (vehicle: DriverVehicle) => (vehicle === "van" ? "فان" : vehicle === "car" ? "سيارة" : "دراجة نارية");

export async function saveRequestedVehicle(db: Db, orderId: number, vehicle: WosselVehicle) {
  await ensureTaxiSchema(db);
  await db.execute(sql`UPDATE \`orders\` SET \`requestedVehicle\` = ${vehicle} WHERE \`id\` = ${orderId}`);
}

export async function requestedVehicles(db: Db, orderIds: number[]): Promise<Map<number, WosselVehicle>> {
  await ensureTaxiSchema(db);
  if (!orderIds.length) return new Map();
  const rows = rowsOf<{ id: number; requestedVehicle: string | null }>(await db.execute(sql`SELECT \`id\`, \`requestedVehicle\` FROM \`orders\` WHERE \`id\` IN (${sql.join(orderIds.map(id => sql`${id}`), sql`, `)})`));
  return new Map(rows.map(row => [Number(row.id), row.requestedVehicle === "car" ? "car" as const : "motorcycle" as const]));
}

export const taxiTypeLabel = (taxiType: TaxiType | null | undefined) => (taxiType === "van" ? "فان" : "تاكسي عادي");

export const mapLink = (lat: number, lng: number) => `https://maps.google.com/?q=${lat.toFixed(6)},${lng.toFixed(6)}`;

export async function saveTaxiDestination(db: Db, orderId: number, lat: number, lng: number) {
  await ensureTaxiSchema(db);
  await db.execute(sql`UPDATE \`orders\` SET \`destinationLat\` = ${Math.round(lat * 1_000_000)}, \`destinationLng\` = ${Math.round(lng * 1_000_000)} WHERE \`id\` = ${orderId}`);
}

export async function taxiDestination(db: Db, orderId: number): Promise<{ lat: number; lng: number } | null> {
  await ensureTaxiSchema(db);
  const row = rowsOf<{ destinationLat: number | null; destinationLng: number | null }>(await db.execute(sql`SELECT \`destinationLat\`, \`destinationLng\` FROM \`orders\` WHERE \`id\` = ${orderId}`))[0];
  if (!row || row.destinationLat === null || row.destinationLng === null) return null;
  return { lat: Number(row.destinationLat) / 1_000_000, lng: Number(row.destinationLng) / 1_000_000 };
}
