import { describe, expect, it } from "vitest";
import { shouldOfferUpdate } from "./AppUpdateNotice";

describe("تنبيه تحديث تطبيق لحظة", () => {
  it("يظهر عندما يكون ملف الإصدار أحدث ورابط التحميل آمناً", () => {
    expect(shouldOfferUpdate(11, {
      versionCode: 12,
      versionName: "1.8.0",
      downloadUrl: "https://example.com/lahza.apk",
    })).toBe(true);
  });

  it("لا يظهر عندما تكون النسخة المثبتة هي الأحدث أو مطابقة", () => {
    expect(shouldOfferUpdate(12, {
      versionCode: 12,
      versionName: "1.8.0",
      downloadUrl: "https://example.com/lahza.apk",
    })).toBe(false);
  });

  it("يرفض روابط التنزيل غير الآمنة", () => {
    expect(shouldOfferUpdate(11, {
      versionCode: 12,
      versionName: "1.8.0",
      downloadUrl: "http://example.com/lahza.apk",
    })).toBe(false);
  });
});
