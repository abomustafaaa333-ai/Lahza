import { sql } from "drizzle-orm";
import type { getDb } from "./db";

type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;

export type TaxiType = "standard" | "van";

/** Taxi prices in new Syrian pounds. A price per km of 0 means "not set yet": the team agrees the fare by phone. */
export type TaxiPricing = {
  standardPricePerKm: number;
  standardMinFare: number;
  vanPricePerKm: number;
  vanMinFare: number;
};

let schemaPromise: Promise<void> | null = null;
export function ensureTaxiSchema(db: Db) {
  schemaPromise ??= (async () => {
    await db.execute(sql.raw("CREATE TABLE IF NOT EXISTS `taxi_settings` (`id` INT NOT NULL PRIMARY KEY, `standardPricePerKm` INT NOT NULL DEFAULT 0, `standardMinFare` INT NOT NULL DEFAULT 0, `vanPricePerKm` INT NOT NULL DEFAULT 0, `vanMinFare` INT NOT NULL DEFAULT 0) DEFAULT CHARSET=utf8mb4"));
    await db.execute(sql.raw("INSERT IGNORE INTO `taxi_settings` (`id`) VALUES (1)"));
    // Where the ride ends, in millionths of a degree like `locationLat`; the pickup lives in `locationLat`/`locationLng`.
    await db.execute(sql.raw("ALTER TABLE `orders` ADD COLUMN IF NOT EXISTS `destinationLat` INT NULL"));
    await db.execute(sql.raw("ALTER TABLE `orders` ADD COLUMN IF NOT EXISTS `destinationLng` INT NULL"));
  })().catch(error => { schemaPromise = null; throw error; });
  return schemaPromise;
}

const rowsOf = <T>(result: unknown) => { const rows = Array.isArray(result) ? result[0] : []; return (Array.isArray(rows) ? rows : []) as T[]; };

export async function getTaxiPricing(db: Db): Promise<TaxiPricing> {
  await ensureTaxiSchema(db);
  const row = rowsOf<Record<string, unknown>>(await db.execute(sql.raw("SELECT * FROM `taxi_settings` WHERE `id` = 1")))[0] ?? {};
  return {
    standardPricePerKm: Number(row.standardPricePerKm ?? 0),
    standardMinFare: Number(row.standardMinFare ?? 0),
    vanPricePerKm: Number(row.vanPricePerKm ?? 0),
    vanMinFare: Number(row.vanMinFare ?? 0),
  };
}

export async function updateTaxiPricing(db: Db, pricing: TaxiPricing) {
  await ensureTaxiSchema(db);
  await db.execute(sql`UPDATE \`taxi_settings\` SET \`standardPricePerKm\` = ${pricing.standardPricePerKm}, \`standardMinFare\` = ${pricing.standardMinFare}, \`vanPricePerKm\` = ${pricing.vanPricePerKm}, \`vanMinFare\` = ${pricing.vanMinFare} WHERE \`id\` = 1`);
}

/** The fare in new Syrian pounds for a road distance, or null while the owner has not priced this vehicle. */
export function taxiFareNewSyp(distanceMeters: number, taxiType: TaxiType, pricing: TaxiPricing): number | null {
  const perKm = taxiType === "van" ? pricing.vanPricePerKm : pricing.standardPricePerKm;
  const minFare = taxiType === "van" ? pricing.vanMinFare : pricing.standardMinFare;
  if (!(perKm > 0)) return null;
  const km = Math.max(1, Math.ceil(Math.max(0, distanceMeters) / 1000));
  return Math.max(Math.round(minFare) || 0, km * Math.round(perKm));
}

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
