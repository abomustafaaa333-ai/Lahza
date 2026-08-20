const DAY_MS = 24 * 60 * 60 * 1000;

export function offerDaysRemaining(expiresAt: Date | string | null, now = new Date()) {
  if (!expiresAt) return null;
  const expiresAtMs = new Date(expiresAt).getTime();
  if (!Number.isFinite(expiresAtMs)) return null;
  return Math.max(0, Math.ceil((expiresAtMs - now.getTime()) / DAY_MS));
}
