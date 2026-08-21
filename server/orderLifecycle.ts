import { lte } from "drizzle-orm";
import { intercityOrders, orders } from "../drizzle/schema";
import { getDb } from "./db";

export const ORDER_ARCHIVE_AFTER_MS = 24 * 60 * 60 * 1000;
export const ORDER_DELETE_AFTER_MS = 7 * 24 * 60 * 60 * 1000;

export function isOrderArchived(createdAt: Date, now = new Date()) {
  return now.getTime() - createdAt.getTime() >= ORDER_ARCHIVE_AFTER_MS;
}

export function isOrderExpired(createdAt: Date, now = new Date()) {
  return now.getTime() - createdAt.getTime() >= ORDER_DELETE_AFTER_MS;
}

export function archiveCutoff(now = new Date()) {
  return new Date(now.getTime() - ORDER_ARCHIVE_AFTER_MS);
}

export function deletionCutoff(now = new Date()) {
  return new Date(now.getTime() - ORDER_DELETE_AFTER_MS);
}

export async function cleanExpiredOrders(now = new Date()) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً");
  const cutoff = deletionCutoff(now);
  const deletedDelivery = await db.delete(orders).where(lte(orders.createdAt, cutoff));
  const deletedLegacyIntercity = await db.delete(intercityOrders).where(lte(intercityOrders.createdAt, cutoff));
  return {
    cutoff,
    deliveryDeleted: Number(deletedDelivery[0]?.affectedRows ?? 0),
    legacyIntercityDeleted: Number(deletedLegacyIntercity[0]?.affectedRows ?? 0),
  };
}
