import { createHmac, timingSafeEqual } from "node:crypto";

type RateLimitBucket = { count: number; resetAt: number };

/**
 * Fixed-window in-memory limiter. Keys are usually phone numbers so that the
 * limit cannot be bypassed by rotating IP addresses behind a proxy.
 */
export function createRateLimiter(limit: number, windowMs: number) {
  const buckets = new Map<string, RateLimitBucket>();
  const prune = (now: number) => {
    if (buckets.size < 5_000) return;
    for (const [key, bucket] of Array.from(buckets)) if (bucket.resetAt <= now) buckets.delete(key);
  };
  return {
    /** Returns the remaining wait in seconds when the key is blocked, otherwise 0. */
    blockedFor(key: string, now = Date.now()) {
      const bucket = buckets.get(key);
      if (!bucket || bucket.resetAt <= now || bucket.count < limit) return 0;
      return Math.ceil((bucket.resetAt - now) / 1000);
    },
    hit(key: string, now = Date.now()) {
      prune(now);
      const bucket = buckets.get(key);
      if (!bucket || bucket.resetAt <= now) buckets.set(key, { count: 1, resetAt: now + windowMs });
      else bucket.count += 1;
    },
    reset(key: string) {
      buckets.delete(key);
    },
  };
}

export type RateLimiter = ReturnType<typeof createRateLimiter>;

export function formatWait(seconds: number) {
  const minutes = Math.ceil(seconds / 60);
  return minutes <= 1 ? "دقيقة واحدة" : `${minutes} دقائق`;
}

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

/**
 * Accepts either a shared token (query `?token=` or `x-lahza-webhook-token`)
 * or WAHA's HMAC signature (`x-webhook-hmac`, SHA-512 of the raw body).
 */
export function isAuthorizedWebhook(secret: string, request: { token?: unknown; headerToken?: unknown; hmac?: unknown; rawBody?: Buffer }) {
  const tokens = [request.token, request.headerToken].filter((value): value is string => typeof value === "string" && value.length > 0);
  if (tokens.some(token => safeEqual(token, secret))) return true;
  if (typeof request.hmac === "string" && request.hmac && request.rawBody) {
    const expected = createHmac("sha512", secret).update(request.rawBody).digest("hex");
    return safeEqual(request.hmac.toLowerCase(), expected);
  }
  return false;
}
