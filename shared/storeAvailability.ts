export type StoreDayKey = "sunday" | "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday";
export type StoreDayHours = { closed: boolean; from: string; to: string };
export type StoreHours = Record<StoreDayKey, StoreDayHours>;

export const STORE_DAY_KEYS: StoreDayKey[] = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
export const STORE_DAY_LABELS: Record<StoreDayKey, string> = { sunday: "الأحد", monday: "الاثنين", tuesday: "الثلاثاء", wednesday: "الأربعاء", thursday: "الخميس", friday: "الجمعة", saturday: "السبت" };
export const DEFAULT_STORE_HOURS: StoreHours = Object.fromEntries(STORE_DAY_KEYS.map(day => [day, { closed: false, from: "09:00", to: "23:00" }])) as StoreHours;

const timePattern = /^([01]\d|2[0-3]):([0-5]\d)$/;
export function normalizeStoreHours(value: unknown): StoreHours | null {
  if (!value || typeof value !== "object") return null;
  const source = value as Record<string, unknown>;
  const result = {} as StoreHours;
  for (const day of STORE_DAY_KEYS) {
    const row = source[day] && typeof source[day] === "object" ? source[day] as Record<string, unknown> : {};
    const from = typeof row.from === "string" && timePattern.test(row.from) ? row.from : DEFAULT_STORE_HOURS[day].from;
    const to = typeof row.to === "string" && timePattern.test(row.to) ? row.to : DEFAULT_STORE_HOURS[day].to;
    result[day] = { closed: row.closed === true, from, to };
  }
  return result;
}
export function parseStoreHours(value: unknown): StoreHours | null {
  if (typeof value !== "string" || !value.trim()) return normalizeStoreHours(value);
  try { return normalizeStoreHours(JSON.parse(value)); } catch { return null; }
}
function timeToMinutes(value: string) { const [hour, minute] = value.split(":").map(Number); return hour * 60 + minute; }
export function isWithinStoreHours(workHours: unknown, now = new Date()) {
  const hours = normalizeStoreHours(workHours);
  if (!hours) return true;
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Damascus", weekday: "long", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(now);
  const weekday = parts.find(part => part.type === "weekday")?.value.toLowerCase() as StoreDayKey | undefined;
  const hour = Number(parts.find(part => part.type === "hour")?.value ?? 0) % 24;
  const minute = Number(parts.find(part => part.type === "minute")?.value ?? 0);
  const today = weekday && hours[weekday];
  if (!today || today.closed) return false;
  const current = hour * 60 + minute;
  const from = timeToMinutes(today.from);
  const to = timeToMinutes(today.to);
  if (from === to) return true;
  if (from < to) return current >= from && current < to;
  return current >= from || current < to;
}
export function isStoreClosedForCustomer(storeOpen: boolean | null | undefined, workHours?: unknown, now = new Date()) {
  return storeOpen === false || !isWithinStoreHours(workHours, now);
}
