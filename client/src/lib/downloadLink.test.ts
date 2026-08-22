import { describe, expect, it } from "vitest";
import { APP_DOWNLOAD_PATH, buildAppDownloadUrl } from "./downloadLink";

describe("رابط تحميل تطبيق لحظة", () => {
  it("يستخدم مسار التحميل الثابت دون ربطه بنطاق Manus أو Railway", () => {
    expect(APP_DOWNLOAD_PATH).toBe("/download");
    expect(buildAppDownloadUrl("https://lahza-production-e0af.up.railway.app")).toBe("https://lahza-production-e0af.up.railway.app/download");
  });

  it("يعمل على رابط متجر الشريك الذي يفتح من QR", () => {
    expect(buildAppDownloadUrl("https://lahza-production-e0af.up.railway.app/?store=42")).toBe("https://lahza-production-e0af.up.railway.app/download");
  });
});
