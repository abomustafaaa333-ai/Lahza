export function parseSharedStoreId(search: string) {
  const value = new URLSearchParams(search).get("store");
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export function buildStoreShareUrl(origin: string, storeId: number) {
  const url = new URL("/", origin);
  url.searchParams.set("store", String(storeId));
  return url.toString();
}
