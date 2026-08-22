import { buildStoreShareUrl, parseSharedStoreId } from "./storeShare";
import { describe, expect, it } from "vitest";

describe("مشاركة رابط المتجر", () => {
  it("يبني رابطاً ثابتاً يفتح المتجر المحدد", () => {
    expect(buildStoreShareUrl("https://lahza.example", 42)).toBe("https://lahza.example/?store=42");
  });

  it("يقبل معرّف متجر صحيحاً ويرفض القيم غير الصالحة", () => {
    expect(parseSharedStoreId("?store=42")).toBe(42);
    expect(parseSharedStoreId("?store=0")).toBeNull();
    expect(parseSharedStoreId("?store=abc")).toBeNull();
  });
});
