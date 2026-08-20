import { createHash } from "node:crypto";

const MAX_IMAGE_DATA_URL_LENGTH = 8_000_000;

function cloudinaryConfig() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) return null;
  return { cloudName, apiKey, apiSecret };
}

function signature(values: Record<string, string | number>, apiSecret: string) {
  const signed = Object.entries(values)
    .filter(([, value]) => value !== "" && value !== undefined)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");
  return createHash("sha1").update(`${signed}${apiSecret}`).digest("hex");
}

export function isOfferImageDataUrl(value: string) {
  return value.length <= MAX_IMAGE_DATA_URL_LENGTH && /^data:image\/(png|jpe?g|webp);base64,/i.test(value);
}

export async function uploadOfferImage(dataUrl: string, storeId: number, token: string) {
  if (!isOfferImageDataUrl(dataUrl)) throw new Error("اختر صورة بصيغة PNG أو JPG أو WEBP وحجم مناسب");
  const config = cloudinaryConfig();
  if (!config) throw new Error("لم تُربط مساحة صور العروض بعد. أضف إعدادات Cloudinary أولاً.");

  const timestamp = Math.floor(Date.now() / 1000);
  const publicId = `lahza/offers/store-${storeId}/${token}`;
  const body = new FormData();
  body.set("file", dataUrl);
  body.set("api_key", config.apiKey);
  body.set("timestamp", String(timestamp));
  body.set("public_id", publicId);
  body.set("signature", signature({ public_id: publicId, timestamp }, config.apiSecret));

  const response = await fetch(`https://api.cloudinary.com/v1_1/${config.cloudName}/image/upload`, { method: "POST", body });
  const result = await response.json() as { secure_url?: string; public_id?: string; error?: { message?: string } };
  if (!response.ok || !result.secure_url || !result.public_id) throw new Error(result.error?.message || "تعذر رفع صورة العرض إلى التخزين السحابي");
  return { imageUrl: result.secure_url, imageStorageKey: result.public_id };
}

export async function deleteOfferImage(imageStorageKey: string) {
  const config = cloudinaryConfig();
  if (!config) return { deleted: false, reason: "not-configured" as const };

  const timestamp = Math.floor(Date.now() / 1000);
  const body = new FormData();
  body.set("public_id", imageStorageKey);
  body.set("api_key", config.apiKey);
  body.set("timestamp", String(timestamp));
  body.set("invalidate", "true");
  body.set("signature", signature({ invalidate: "true", public_id: imageStorageKey, timestamp }, config.apiSecret));

  const response = await fetch(`https://api.cloudinary.com/v1_1/${config.cloudName}/image/destroy`, { method: "POST", body });
  const result = await response.json() as { result?: string; error?: { message?: string } };
  if (!response.ok || !["ok", "not found"].includes(result.result ?? "")) {
    console.error("[Offers] Cloudinary image deletion failed", result.error?.message ?? result.result);
    return { deleted: false, reason: "request-failed" as const };
  }
  return { deleted: true, reason: "deleted" as const };
}
