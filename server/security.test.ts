import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createRateLimiter, isAuthorizedWebhook } from "./security";
import { PHARMACY_PRICE_REPLY_PATTERN } from "./lahza";
import { normalizeWahaReply } from "./waha";

describe("createRateLimiter", () => {
  it("blocks a key after the limit until the window passes", () => {
    const limiter = createRateLimiter(2, 60_000);
    limiter.hit("+963900000001", 0);
    expect(limiter.blockedFor("+963900000001", 1_000)).toBe(0);
    limiter.hit("+963900000001", 1_000);
    expect(limiter.blockedFor("+963900000001", 1_000)).toBe(59);
    expect(limiter.blockedFor("+963900000002", 1_000)).toBe(0);
    expect(limiter.blockedFor("+963900000001", 60_000)).toBe(0);
  });

  it("clears a key on reset", () => {
    const limiter = createRateLimiter(1, 60_000);
    limiter.hit("owner", 0);
    limiter.reset("owner");
    expect(limiter.blockedFor("owner", 0)).toBe(0);
  });
});

describe("isAuthorizedWebhook", () => {
  const secret = "test-webhook-secret";

  it("accepts the shared token from the query or header", () => {
    expect(isAuthorizedWebhook(secret, { token: secret })).toBe(true);
    expect(isAuthorizedWebhook(secret, { headerToken: secret })).toBe(true);
  });

  it("accepts a valid WAHA HMAC signature", () => {
    const rawBody = Buffer.from('{"event":"message"}');
    const hmac = createHmac("sha512", secret).update(rawBody).digest("hex");
    expect(isAuthorizedWebhook(secret, { hmac, rawBody })).toBe(true);
  });

  it("rejects missing or wrong credentials", () => {
    const rawBody = Buffer.from('{"event":"message"}');
    expect(isAuthorizedWebhook(secret, {})).toBe(false);
    expect(isAuthorizedWebhook(secret, { token: "wrong" })).toBe(false);
    expect(isAuthorizedWebhook(secret, { hmac: "00", rawBody })).toBe(false);
  });
});

describe("pharmacy price replies", () => {
  it("recognises the price format sent in WhatsApp reminders", () => {
    expect(PHARMACY_PRICE_REPLY_PATTERN.test(normalizeWahaReply("السعر 50000"))).toBe(true);
    expect(PHARMACY_PRICE_REPLY_PATTERN.test(normalizeWahaReply("سعر: ٥٠٠٠٠"))).toBe(true);
    expect(PHARMACY_PRICE_REPLY_PATTERN.test(normalizeWahaReply("نعم"))).toBe(false);
  });
});
