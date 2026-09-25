import { describe, expect, it } from "vitest";
import { isPushCampaignDue } from "./notificationDelivery";

const now = new Date("2026-09-25T20:00:00.000Z");
const base = {
  active: true,
  scheduledAt: null as Date | string | null,
  expiresAt: null as Date | string | null,
  pushStatus: "pending" as const,
  pushAttempts: 0,
  pushLastAttemptAt: null as Date | string | null,
};

describe("scheduled phone notification delivery", () => {
  it("waits until the scheduled time", () => {
    expect(isPushCampaignDue({ ...base, scheduledAt: new Date(now.getTime() + 1) }, now)).toBe(false);
    expect(isPushCampaignDue({ ...base, scheduledAt: now }, now)).toBe(true);
    expect(isPushCampaignDue({ ...base, scheduledAt: new Date(now.getTime() - 1) }, now)).toBe(true);
  });

  it("does not send paused or expired campaigns", () => {
    expect(isPushCampaignDue({ ...base, active: false }, now)).toBe(false);
    expect(isPushCampaignDue({ ...base, expiresAt: new Date(now.getTime() - 1) }, now)).toBe(false);
  });

  it("retries transient failures no more than once per minute", () => {
    const lastAttempt = new Date(now.getTime() - 30_000);
    expect(isPushCampaignDue({ ...base, pushStatus: "retry", pushAttempts: 1, pushLastAttemptAt: lastAttempt }, now)).toBe(false);
    expect(isPushCampaignDue({ ...base, pushStatus: "retry", pushAttempts: 1, pushLastAttemptAt: new Date(now.getTime() - 60_000) }, now)).toBe(true);
  });

  it("recovers a worker claim left stale by a container restart", () => {
    expect(isPushCampaignDue({ ...base, pushStatus: "sending", pushAttempts: 1, pushLastAttemptAt: new Date(now.getTime() - 5 * 60_000) }, now)).toBe(true);
    expect(isPushCampaignDue({ ...base, pushStatus: "sending", pushAttempts: 1, pushLastAttemptAt: new Date(now.getTime() - 60_000) }, now)).toBe(false);
  });

  it("never sends a completed or exhausted campaign again", () => {
    expect(isPushCampaignDue({ ...base, pushStatus: "sent" }, now)).toBe(false);
    expect(isPushCampaignDue({ ...base, pushStatus: "failed" }, now)).toBe(false);
    expect(isPushCampaignDue({ ...base, pushAttempts: 5 }, now)).toBe(false);
  });
});
