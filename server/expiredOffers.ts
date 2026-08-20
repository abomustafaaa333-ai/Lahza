import { and, eq, isNotNull, lte } from "drizzle-orm";
import { partnerOffers } from "../drizzle/schema";
import { getDb } from "./db";
import { deleteOfferImage } from "./offerMedia";

type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;

const expiryColumns = [
  ["imageStorageKey", "VARCHAR(500) NULL"],
  ["imageDeletePending", "BOOLEAN NOT NULL DEFAULT FALSE"],
  ["durationDays", "INT NULL"],
  ["expiresAt", "TIMESTAMP NULL"],
  ["deletedAt", "TIMESTAMP NULL"],
] as const;

export async function ensureOfferExpiryColumns(db: Db) {
  const [rows] = await db.execute("SHOW COLUMNS FROM `partner_offers`");
  const present = new Set(Array.isArray(rows) ? rows.map(row => String((row as { Field?: unknown }).Field ?? "")) : []);
  for (const [name, definition] of expiryColumns) {
    if (present.has(name)) continue;
    await db.execute(`ALTER TABLE \`partner_offers\` ADD COLUMN \`${name}\` ${definition}`);
  }
}

export async function expireOffers(db: Db, now = new Date()) {
  const expired = await db.select({ id: partnerOffers.id, imageStorageKey: partnerOffers.imageStorageKey })
    .from(partnerOffers)
    .where(and(eq(partnerOffers.active, true), lte(partnerOffers.expiresAt, now)));

  for (const offer of expired) {
    await db.update(partnerOffers).set({
      active: false,
      deletedAt: now,
      imageDeletePending: Boolean(offer.imageStorageKey),
    }).where(eq(partnerOffers.id, offer.id));
  }
  return expired.length;
}

export async function deletePendingOfferImages(db: Db) {
  const pending = await db.select({ id: partnerOffers.id, imageStorageKey: partnerOffers.imageStorageKey })
    .from(partnerOffers)
    .where(and(eq(partnerOffers.imageDeletePending, true), isNotNull(partnerOffers.imageStorageKey)));

  let deleted = 0;
  for (const offer of pending) {
    const result = await deleteOfferImage(offer.imageStorageKey!);
    if (!result.deleted) continue;
    await db.update(partnerOffers).set({
      imageUrl: null,
      imageStorageKey: null,
      imageDeletePending: false,
    }).where(eq(partnerOffers.id, offer.id));
    deleted += 1;
  }
  return deleted;
}

export async function cleanExpiredOffers(now = new Date()) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً");
  await ensureOfferExpiryColumns(db);
  const expired = await expireOffers(db, now);
  const imagesDeleted = await deletePendingOfferImages(db);
  return { expired, imagesDeleted };
}
