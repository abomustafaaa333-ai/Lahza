import { describe, expect, it } from "vitest";
import { isNativeLahzaApp } from "./nativeRuntime";

describe("بيئة تطبيق لحظة المثبت", () => {
  it("يتعرف على جسر Android عندما يوفّر رقم الإصدار", () => {
    expect(isNativeLahzaApp({ LahzaApp: { getVersionCode: () => 210 } })).toBe(true);
  });

  it("يتعرف على جسر Android عندما يوفّر فتح الروابط الخارجية", () => {
    expect(isNativeLahzaApp({ LahzaApp: { openExternal: () => undefined } })).toBe(true);
  });

  it("لا يعامل المتصفح العادي كنسخة تطبيق مثبّتة", () => {
    expect(isNativeLahzaApp({})).toBe(false);
  });
});
