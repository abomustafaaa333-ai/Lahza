import { describe, expect, it } from "vitest";
import { shouldOfferUpdate, updateTarget } from "./AppUpdateNotice";

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

describe("updateTarget", () => {
  it("sends Google Play installs to the store listing", () => {
    expect(updateTarget("com.android.vending", "/download/x.apk", "https://lahza.example")).toBe("https://play.google.com/store/apps/details?id=com.lahza.app");
  });
  it("sends website installs to the APK", () => {
    expect(updateTarget("", "/download/x.apk", "https://lahza.example")).toBe("https://lahza.example/download/x.apk");
  });
});
