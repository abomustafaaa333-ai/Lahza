import { describe, expect, it } from "vitest";
import { isOfferImageDataUrl } from "./offerMedia";

describe("تحقق صور عروض المتاجر", () => {
  it("يقبل صور PNG وJPG وWEBP بصيغة data URL", () => {
    expect(isOfferImageDataUrl("data:image/png;base64,aGVsbG8=")).toBe(true);
    expect(isOfferImageDataUrl("data:image/jpeg;base64,aGVsbG8=")).toBe(true);
    expect(isOfferImageDataUrl("data:image/webp;base64,aGVsbG8=")).toBe(true);
  });

  it("يرفض صيغة غير صورة أو نصاً كبيراً جداً", () => {
    expect(isOfferImageDataUrl("data:text/plain;base64,aGVsbG8=")).toBe(false);
    expect(isOfferImageDataUrl(`data:image/png;base64,${"a".repeat(8_000_000)}`)).toBe(false);
  });
});
