import { describe, expect, it } from "vitest";
import { catalogSeed, categoryMeta } from "../shared/lahza";
import { calculateDeliveryFee, calculateLineTotal, orderInputSchema } from "./lahza";

describe("حساب إجمالي السطر", () => {
  it("يحسب الأصناف العادية بعدد الوحدات", () => {
    expect(calculateLineTotal(3, 12500, "وحدة")).toBe(37500);
  });

  it("يحوّل الجرامات إلى جزء من سعر الكيلو غرام", () => {
    expect(calculateLineTotal(750, 80000, "جرام")).toBe(60000);
  });

  it("يمنع ظهور تكلفة للصيدلية عند سعر صفري", () => {
    expect(calculateLineTotal(2, 0, "طلب")).toBe(0);
  });
});

describe("حساب رسوم التوصيل", () => {
  it("يحتسب الكيلومترات الجزئية ككيلومتر كامل للتوصيل", () => {
    expect(calculateDeliveryFee(1250, 2)).toEqual({ billableKm: 2, deliveryFee: 4 });
  });

  it("يحافظ على حد أدنى كيلومتر واحد عند وصول مسافة طريق صالحة", () => {
    expect(calculateDeliveryFee(350, 2)).toEqual({ billableKm: 1, deliveryFee: 2 });
  });
});

describe("قسم الكازيات والغاز", () => {
  it("يعرض جرة غاز كوحدة قابلة للتسعير", () => {
    const gasCylinder = catalogSeed.find(item => item.name === "جرة غاز");
    expect(categoryMeta.fuel.title).toBe("الكازيات والغاز");
    expect(gasCylinder).toMatchObject({ category: "fuel", unit: "قنينة" });
  });
});

describe("بيانات الطلب الإلزامية", () => {
  it("يقبل الطلب برقم سوري صحيح وموقع GPS", () => {
    const parsed = orderInputSchema.parse({
      orderType: "delivery",
      customerName: "أحمد",
      customerPhone: "+963912345678",
      paymentMethod: "cash",
      locationUrl: "https://www.google.com/maps/search/?api=1&query=36.12345,37.12345",
      locationLat: 36.12345,
      locationLng: 37.12345,
      lines: [{ category: "pharmacy", itemName: "فيتامين C", quantity: 1, unit: "طلب" }],
    });

    expect(parsed.customerName).toBe("أحمد");
    expect(parsed.customerPhone).toBe("+963912345678");
  });

  it("يرفض الطلب من دون رابط موقع GPS", () => {
    const parsed = orderInputSchema.safeParse({
      orderType: "delivery",
      customerName: "أحمد",
      customerPhone: "+963912345678",
      paymentMethod: "cash",
      locationLat: 36.12345,
      locationLng: 37.12345,
      lines: [{ category: "pharmacy", itemName: "فيتامين C", quantity: 1, unit: "طلب" }],
    });

    expect(parsed.success).toBe(false);
  });
  it("يرفض الرقم الذي لا يبدأ بالرقم 9 بعد النداء السوري", () => {
    const parsed = orderInputSchema.safeParse({
      orderType: "delivery",
      customerName: "أحمد",
      customerPhone: "+963812345678",
      paymentMethod: "cash",
      locationUrl: "https://www.google.com/maps/search/?api=1&query=36.12345,37.12345",
      locationLat: 36.12345,
      locationLng: 37.12345,
      lines: [{ category: "pharmacy", itemName: "فيتامين C", quantity: 1, unit: "طلب" }],
    });

    expect(parsed.success).toBe(false);
  });
});
