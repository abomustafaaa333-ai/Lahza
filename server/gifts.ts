import { randomBytes } from "node:crypto";
import { sql } from "drizzle-orm";
import type { getDb } from "./db";

type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;

/**
 * A delivery order sent as a gift. The sender pays up front; the recipient is told by WhatsApp
 * (when a driver takes it) and the driver calls them for their location, or the sender pinned it.
 */
export type GiftLocationMode = "recipient" | "map";
export type GiftSenderVisibility = "reveal" | "anonymous";
export type Gift = {
  orderId: number;
  recipientName: string;
  recipientPhone: string;
  message: string;
  locationMode: GiftLocationMode;
  senderVisibility: GiftSenderVisibility;
  wrap: boolean;
  wrapFee: number;
  scheduledAt: Date | null;
  dispatchedAt: Date | null;
  recipientNotifiedAt: Date | null;
  locationToken: string;
  locationSharedAt: Date | null;
  deliveredNotifiedAt: Date | null;
};
export type GiftSettings = { wrapEnabled: boolean; wrapFee: number };

let schemaPromise: Promise<void> | null = null;
export function ensureGiftSchema(db: Db) {
  schemaPromise ??= (async () => {
    await db.execute(sql.raw("CREATE TABLE IF NOT EXISTS `order_gifts` (`orderId` INT NOT NULL PRIMARY KEY, `recipientName` VARCHAR(80) NOT NULL, `recipientPhone` VARCHAR(24) NOT NULL, `message` VARCHAR(500) NOT NULL DEFAULT '', `locationMode` VARCHAR(12) NOT NULL DEFAULT 'recipient', `senderVisibility` VARCHAR(12) NOT NULL DEFAULT 'reveal', `wrap` BOOLEAN NOT NULL DEFAULT FALSE, `wrapFee` INT NOT NULL DEFAULT 0, `scheduledAt` TIMESTAMP NULL, `dispatchedAt` TIMESTAMP NULL, `recipientNotifiedAt` TIMESTAMP NULL, `locationToken` VARCHAR(40) NOT NULL, `locationSharedAt` TIMESTAMP NULL, `deliveredNotifiedAt` TIMESTAMP NULL, `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE KEY `order_gifts_token` (`locationToken`)) DEFAULT CHARSET=utf8mb4"));
    await db.execute(sql.raw("CREATE TABLE IF NOT EXISTS `gift_settings` (`id` INT NOT NULL PRIMARY KEY, `wrapEnabled` BOOLEAN NOT NULL DEFAULT TRUE, `wrapFee` INT NOT NULL DEFAULT 0) DEFAULT CHARSET=utf8mb4"));
    await db.execute(sql.raw("INSERT IGNORE INTO `gift_settings` (`id`) VALUES (1)"));
  })().catch(error => { schemaPromise = null; throw error; });
  return schemaPromise;
}

const rowsOf = <T>(result: unknown) => { const rows = Array.isArray(result) ? result[0] : []; return (Array.isArray(rows) ? rows : []) as T[]; };
const date = (value: unknown) => (value ? new Date(value as string) : null);
const toGift = (row: Record<string, unknown>): Gift => ({
  orderId: Number(row.orderId),
  recipientName: String(row.recipientName ?? ""),
  recipientPhone: String(row.recipientPhone ?? ""),
  message: String(row.message ?? ""),
  locationMode: row.locationMode === "map" ? "map" : "recipient",
  senderVisibility: row.senderVisibility === "anonymous" ? "anonymous" : "reveal",
  wrap: Boolean(row.wrap),
  wrapFee: Number(row.wrapFee ?? 0),
  scheduledAt: date(row.scheduledAt),
  dispatchedAt: date(row.dispatchedAt),
  recipientNotifiedAt: date(row.recipientNotifiedAt),
  locationToken: String(row.locationToken ?? ""),
  locationSharedAt: date(row.locationSharedAt),
  deliveredNotifiedAt: date(row.deliveredNotifiedAt),
});

export async function getGiftSettings(db: Db): Promise<GiftSettings> {
  await ensureGiftSchema(db);
  const row = rowsOf<Record<string, unknown>>(await db.execute(sql.raw("SELECT * FROM `gift_settings` WHERE `id` = 1")))[0] ?? {};
  return { wrapEnabled: row.wrapEnabled === undefined ? true : Boolean(row.wrapEnabled), wrapFee: Number(row.wrapFee ?? 0) };
}

export async function updateGiftSettings(db: Db, settings: GiftSettings) {
  await ensureGiftSchema(db);
  await db.execute(sql`UPDATE \`gift_settings\` SET \`wrapEnabled\` = ${settings.wrapEnabled}, \`wrapFee\` = ${settings.wrapFee} WHERE \`id\` = 1`);
}

export async function saveGift(db: Db, gift: Omit<Gift, "dispatchedAt" | "recipientNotifiedAt" | "locationToken" | "locationSharedAt" | "deliveredNotifiedAt"> & { dispatched: boolean }) {
  await ensureGiftSchema(db);
  const token = randomBytes(18).toString("base64url");
  await db.execute(sql`INSERT INTO \`order_gifts\` (\`orderId\`, \`recipientName\`, \`recipientPhone\`, \`message\`, \`locationMode\`, \`senderVisibility\`, \`wrap\`, \`wrapFee\`, \`scheduledAt\`, \`dispatchedAt\`, \`locationToken\`) VALUES (${gift.orderId}, ${gift.recipientName}, ${gift.recipientPhone}, ${gift.message}, ${gift.locationMode}, ${gift.senderVisibility}, ${gift.wrap}, ${gift.wrapFee}, ${gift.scheduledAt}, ${gift.dispatched ? new Date() : null}, ${token})`);
  return token;
}

export async function giftsForOrders(db: Db, orderIds: number[]): Promise<Map<number, Gift>> {
  await ensureGiftSchema(db);
  if (!orderIds.length) return new Map();
  const rows = rowsOf<Record<string, unknown>>(await db.execute(sql`SELECT * FROM \`order_gifts\` WHERE \`orderId\` IN (${sql.join(orderIds.map(id => sql`${id}`), sql`, `)})`));
  return new Map(rows.map(row => [Number(row.orderId), toGift(row)]));
}

export async function giftForOrder(db: Db, orderId: number) {
  return (await giftsForOrders(db, [orderId])).get(orderId) ?? null;
}

export async function giftByToken(db: Db, token: string) {
  await ensureGiftSchema(db);
  const row = rowsOf<Record<string, unknown>>(await db.execute(sql`SELECT * FROM \`order_gifts\` WHERE \`locationToken\` = ${token} LIMIT 1`))[0];
  return row ? toGift(row) : null;
}

/** Marks a moment once; returns false when it was already marked (so messages go out a single time). */
export async function markGift(db: Db, orderId: number, column: "dispatchedAt" | "recipientNotifiedAt" | "locationSharedAt" | "deliveredNotifiedAt") {
  await ensureGiftSchema(db);
  const result = await db.execute(sql`UPDATE \`order_gifts\` SET ${sql.raw(`\`${column}\``)} = NOW() WHERE \`orderId\` = ${orderId} AND ${sql.raw(`\`${column}\``)} IS NULL`);
  const header = Array.isArray(result) ? result[0] : result;
  return Number((header as { affectedRows?: number } | undefined)?.affectedRows ?? 0) > 0;
}

/** Scheduled gifts whose time has come (they go out to drivers 40 minutes before the chosen time). */
export async function dueScheduledGifts(db: Db) {
  await ensureGiftSchema(db);
  const rows = rowsOf<Record<string, unknown>>(await db.execute(sql.raw("SELECT g.* FROM `order_gifts` g INNER JOIN `orders` o ON o.`id` = g.`orderId` WHERE g.`dispatchedAt` IS NULL AND g.`scheduledAt` IS NOT NULL AND g.`scheduledAt` <= NOW() + INTERVAL 40 MINUTE AND o.`status` IN ('pending', 'confirmed') LIMIT 50")));
  return rows.map(toGift);
}

/** The name the recipient sees: the sender's, unless they chose to stay anonymous. */
export const giftFromLabel = (gift: Pick<Gift, "senderVisibility">, senderName: string) =>
  gift.senderVisibility === "anonymous" || !senderName.trim() ? "شخص يحبك" : senderName.trim();

export const giftScheduleLabel = (when: Date) =>
  when.toLocaleString("ar-SY", { timeZone: "Asia/Damascus", weekday: "long", day: "numeric", month: "long", hour: "numeric", minute: "2-digit" });
