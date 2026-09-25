import { and, asc, eq, gte, inArray, isNull, lt, lte, or, sql } from "drizzle-orm";
import { notificationCampaigns, pushTokens } from "../drizzle/schema";
import { getDb } from "./db";
import { sendPushNotification } from "./pushNotifications";

const RETRY_DELAY_MS = 60_000;
const STALE_CLAIM_MS = 5 * 60_000;
const MAX_ATTEMPTS = 5;
const MAX_CAMPAIGNS_PER_TICK = 50;

type CampaignPushState = "legacy" | "disabled" | "pending" | "sending" | "retry" | "sent" | "failed";

type CampaignSchedule = {
  active: boolean;
  scheduledAt: Date | string | null;
  expiresAt: Date | string | null;
  pushStatus: CampaignPushState;
  pushAttempts: number;
  pushLastAttemptAt: Date | string | null;
};

function asDate(value: Date | string | null) {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function isPushCampaignDue(campaign: CampaignSchedule, now: Date) {
  if (!campaign.active || campaign.pushAttempts >= MAX_ATTEMPTS || !["pending", "retry", "sending"].includes(campaign.pushStatus)) return false;
  const scheduledAt = asDate(campaign.scheduledAt);
  const expiresAt = asDate(campaign.expiresAt);
  const lastAttemptAt = asDate(campaign.pushLastAttemptAt);
  if (scheduledAt && scheduledAt > now) return false;
  if (expiresAt && expiresAt < now) return false;
  if (campaign.pushStatus === "pending") return true;
  if (campaign.pushStatus === "retry") return !lastAttemptAt || now.getTime() - lastAttemptAt.getTime() >= RETRY_DELAY_MS;
  return !lastAttemptAt || now.getTime() - lastAttemptAt.getTime() >= STALE_CLAIM_MS;
}

function isDuplicateColumnError(error: unknown) {
  const candidate = error as { code?: string; cause?: { code?: string; message?: string }; message?: string };
  const code = candidate.cause?.code ?? candidate.code ?? "";
  const message = `${candidate.message ?? ""} ${candidate.cause?.message ?? ""}`;
  return code === "ER_DUP_FIELDNAME" || code === "ER_DUP_COLUMN" || /duplicate column name/i.test(message);
}

export async function ensureScheduledPushSchema() {
  const db = await getDb();
  if (!db) return;
  const [rows] = await db.execute(sql.raw("SHOW COLUMNS FROM `notification_campaigns`"));
  const present = new Set(Array.isArray(rows) ? rows.map(row => String((row as { Field?: unknown }).Field ?? "")) : []);
  const additions: Array<[string, string]> = [
    ["pushStatus", "ENUM('legacy','disabled','pending','sending','retry','sent','failed') NOT NULL DEFAULT 'legacy'"],
    ["pushAttempts", "INT NOT NULL DEFAULT 0"],
    ["pushLastAttemptAt", "TIMESTAMP NULL DEFAULT NULL"],
    ["pushLastError", "VARCHAR(500) NULL"],
    ["pushSentCount", "INT NOT NULL DEFAULT 0"],
    ["pushFailedCount", "INT NOT NULL DEFAULT 0"],
  ];
  for (const [name, definition] of additions) {
    if (present.has(name)) continue;
    try {
      await db.execute(sql.raw(`ALTER TABLE \`notification_campaigns\` ADD COLUMN \`${name}\` ${definition}`));
    } catch (error) {
      if (!isDuplicateColumnError(error)) throw error;
    }
  }
  // Queue legacy campaigns that were explicitly scheduled after creation; never replay old immediate campaigns.
  await db.update(notificationCampaigns).set({ pushStatus: "pending" }).where(and(
    eq(notificationCampaigns.pushStatus, "legacy"),
    eq(notificationCampaigns.active, true),
    sql`${notificationCampaigns.scheduledAt} > ${notificationCampaigns.createdAt}`,
    or(isNull(notificationCampaigns.expiresAt), gte(notificationCampaigns.expiresAt, new Date())),
  ));
}

export type CampaignPushResult = {
  sent: number;
  failed: number;
  reason: "sent" | "some_failed" | "no_registered_devices" | "firebase_not_configured" | "firebase_send_error" | "scheduled" | "inactive" | "expired" | "already_processed";
  errorCodes?: string[];
};

export async function sendCampaignPushNow(campaignId: number, now = new Date()): Promise<CampaignPushResult> {
  const db = await getDb();
  if (!db) return { sent: 0, failed: 0, reason: "firebase_send_error" };
  const campaign = (await db.select().from(notificationCampaigns).where(eq(notificationCampaigns.id, campaignId)).limit(1))[0];
  if (!campaign || !campaign.active || campaign.pushStatus === "disabled") return { sent: 0, failed: 0, reason: "inactive" };
  const scheduledAt = asDate(campaign.scheduledAt);
  const expiresAt = asDate(campaign.expiresAt);
  if (scheduledAt && scheduledAt > now) return { sent: 0, failed: 0, reason: "scheduled" };
  if (expiresAt && expiresAt < now) return { sent: 0, failed: 0, reason: "expired" };
  if (!isPushCampaignDue(campaign, now)) return { sent: 0, failed: 0, reason: "already_processed" };

  const retryBefore = new Date(now.getTime() - RETRY_DELAY_MS);
  const staleBefore = new Date(now.getTime() - STALE_CLAIM_MS);
  const claimableStatus = or(
    eq(notificationCampaigns.pushStatus, "pending"),
    and(eq(notificationCampaigns.pushStatus, "retry"), or(isNull(notificationCampaigns.pushLastAttemptAt), lte(notificationCampaigns.pushLastAttemptAt, retryBefore))),
    and(eq(notificationCampaigns.pushStatus, "sending"), or(isNull(notificationCampaigns.pushLastAttemptAt), lte(notificationCampaigns.pushLastAttemptAt, staleBefore))),
  );
  const [claim] = await db.update(notificationCampaigns).set({
    pushStatus: "sending",
    pushLastAttemptAt: now,
    pushAttempts: sql`${notificationCampaigns.pushAttempts} + 1`,
    pushLastError: null,
  }).where(and(
    eq(notificationCampaigns.id, campaignId),
    eq(notificationCampaigns.active, true),
    lt(notificationCampaigns.pushAttempts, MAX_ATTEMPTS),
    claimableStatus,
    or(isNull(notificationCampaigns.scheduledAt), lte(notificationCampaigns.scheduledAt, now)),
    or(isNull(notificationCampaigns.expiresAt), gte(notificationCampaigns.expiresAt, now)),
  ));
  if (!Number((claim as { affectedRows?: number } | undefined)?.affectedRows ?? 0)) return { sent: 0, failed: 0, reason: "already_processed" };

  try {
    const tokens = await db.select({ token: pushTokens.token }).from(pushTokens).where(eq(pushTokens.active, true));
    const delivery = await sendPushNotification(tokens.map(row => row.token), campaign);
    if (delivery.failedTokens.length) await db.update(pushTokens).set({ active: false }).where(inArray(pushTokens.token, delivery.failedTokens));
    const completed = delivery.sent > 0;
    const permanentlyBlocked = delivery.reason === "no_registered_devices" || delivery.reason === "firebase_not_configured";
    const retry = !completed && !permanentlyBlocked && campaign.pushAttempts + 1 < MAX_ATTEMPTS;
    const errorDetail = delivery.reason === "some_failed" ? delivery.errorCodes?.join(", ") || "some devices failed" : completed ? null : delivery.reason;
    await db.update(notificationCampaigns).set({
      pushStatus: completed ? "sent" : retry ? "retry" : "failed",
      pushLastError: errorDetail?.slice(0, 500) ?? null,
      pushSentCount: delivery.sent,
      pushFailedCount: delivery.failed,
    }).where(eq(notificationCampaigns.id, campaignId));
    return { sent: delivery.sent, failed: delivery.failed, reason: delivery.reason, errorCodes: "errorCodes" in delivery ? delivery.errorCodes : [] };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn("Unable to deliver scheduled phone notification", { campaignId, error: message });
    await db.update(notificationCampaigns).set({
      pushStatus: campaign.pushAttempts + 1 < MAX_ATTEMPTS ? "retry" : "failed",
      pushLastError: message.slice(0, 500),
    }).where(eq(notificationCampaigns.id, campaignId));
    return { sent: 0, failed: 0, reason: "firebase_send_error" };
  }
}

export async function runScheduledPushNotifications(now = new Date()) {
  const db = await getDb();
  if (!db) return 0;
  const retryBefore = new Date(now.getTime() - RETRY_DELAY_MS);
  const staleBefore = new Date(now.getTime() - STALE_CLAIM_MS);
  const retryEligible = or(
    eq(notificationCampaigns.pushStatus, "pending"),
    and(eq(notificationCampaigns.pushStatus, "retry"), or(isNull(notificationCampaigns.pushLastAttemptAt), lte(notificationCampaigns.pushLastAttemptAt, retryBefore))),
    and(eq(notificationCampaigns.pushStatus, "sending"), or(isNull(notificationCampaigns.pushLastAttemptAt), lte(notificationCampaigns.pushLastAttemptAt, staleBefore))),
  );
  const candidates = await db.select({ id: notificationCampaigns.id, active: notificationCampaigns.active, scheduledAt: notificationCampaigns.scheduledAt, expiresAt: notificationCampaigns.expiresAt, pushStatus: notificationCampaigns.pushStatus, pushAttempts: notificationCampaigns.pushAttempts, pushLastAttemptAt: notificationCampaigns.pushLastAttemptAt }).from(notificationCampaigns).where(and(
    eq(notificationCampaigns.active, true),
    inArray(notificationCampaigns.pushStatus, ["pending", "retry", "sending"]),
    lt(notificationCampaigns.pushAttempts, MAX_ATTEMPTS),
    retryEligible,
    or(isNull(notificationCampaigns.scheduledAt), lte(notificationCampaigns.scheduledAt, now)),
    or(isNull(notificationCampaigns.expiresAt), gte(notificationCampaigns.expiresAt, now)),
  )).orderBy(asc(notificationCampaigns.scheduledAt), asc(notificationCampaigns.id)).limit(MAX_CAMPAIGNS_PER_TICK);

  let attempted = 0;
  for (const campaign of candidates) {
    if (!isPushCampaignDue(campaign, now)) continue;
    await sendCampaignPushNow(campaign.id, now);
    attempted += 1;
  }
  return attempted;
}
