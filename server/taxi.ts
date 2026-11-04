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
  })().catch(error => { schemaPromise = null; throw error; });
  return schemaPromise;
}

const rowsOf = <T>(result: unknown) => { const rows = Array.isArray(result) ? result[0] : []; return (Array.isArray(rows) ? rows : []) as T[]; };

/** The driver vehicle that serves each taxi type. */
export const taxiVehicle = (taxiType: TaxiType) => (taxiType === "van" ? "van" as const : "car" as const);

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
