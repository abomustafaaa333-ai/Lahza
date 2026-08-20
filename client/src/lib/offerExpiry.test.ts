import { describe, expect, it } from "vitest";
import { offerDaysRemaining } from "./offerExpiry";

describe("الأيام المتبقية للعرض", () => {
  const now = new Date("2026-08-21T12:00:00.000Z");

  it("يعرض عدد الأيام المتبقية بالتقريب إلى اليوم التالي", () => {
    expect(offerDaysRemaining("2026-08-24T12:00:00.000Z", now)).toBe(3);
    expect(offerDaysRemaining("2026-08-21T13:00:00.000Z", now)).toBe(1);
  });

  it("يعرض صفراً للعرض المنتهي ولا يتعطل عند غياب التاريخ", () => {
    expect(offerDaysRemaining("2026-08-21T11:59:59.000Z", now)).toBe(0);
    expect(offerDaysRemaining(null, now)).toBeNull();
  });
});
