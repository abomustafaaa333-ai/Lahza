import { describe, expect, it } from "vitest";
import { catalogSeed, categoryMeta, DEFAULT_TICKER_PRIMARY, DEFAULT_TICKER_SECONDARY, normalizeTickerText } from "../shared/lahza";
import { calculateDeliveryFee, calculateLineTotal, canReserveIntercityTrip, DELIVERY_PRICING_PENDING_NOTE, orderInputSchema, pendingDeliveryCalculation, readTickerSettings, storeInput, tickerSettingsInputSchema } from "./lahza";

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

  it("يُبقي الطلب قابلاً للحفظ عند تعذر خدمة الخرائط ويؤجل التسعير للإدارة", () => {
    expect(pendingDeliveryCalculation()).toEqual({ deliveryDistanceMeters: 0, deliveryFee: 0, deliveryPricingPending: true });
    expect(DELIVERY_PRICING_PENDING_NOTE).toContain("يحددها فريق لحظة لاحقاً");
  });
});

describe("سعة رحلة منبج إلى جرابلس", () => {
  it("تسمح بالحجز ما دامت السعة المتبقية موجبة", () => {
    expect(canReserveIntercityTrip(8, 7)).toBe(true);
  });

  it("ترفض الحجز عند امتلاء الرحلة أو وجود سعة غير صالحة", () => {
    expect(canReserveIntercityTrip(8, 8)).toBe(false);
    expect(canReserveIntercityTrip(0, 0)).toBe(false);
  });
});

describe("قسم الكازيات والغاز", () => {
  it("يعرض جرة غاز كوحدة قابلة للتسعير", () => {
    const gasCylinder = catalogSeed.find(item => item.name === "جرة غاز");
    expect(categoryMeta.fuel.title).toBe("الكازيات والغاز");
    expect(gasCylinder).toMatchObject({ category: "fuel", unit: "قنينة" });
  });
});

describe("الأقسام ومحتوى الواجهة الجديد", () => {
  it("يُعرّف قسمي منتجات أخرى والعروض للإدارة والعميل", () => {
    expect(categoryMeta.other.title).toBe("منتجات أخرى");
    expect(categoryMeta.offers.title).toBe("العروض");
    expect(categoryMeta.offers.priced).toBe(true);
  });

  it("يُعرّف أقسام المتاجر الجديدة لاختيار المتجر ثم منتجاته", () => {
    expect(categoryMeta.sweets.title).toBe("الحلويات والمعجنات");
    expect(categoryMeta.clothing.title).toBe("الألبسة");
    expect(categoryMeta.mobile_accessories.title).toBe("الموبايلات والإكسسوارات");
    expect(categoryMeta.beauty_boutique.title).toBe("مواد التجميل والبوتيك");
  });

  it("يوفر نصين افتراضيين منفصلين للشريط المتحرك", () => {
    expect(DEFAULT_TICKER_PRIMARY).toContain("١٠ طلبات");
    expect(DEFAULT_TICKER_SECONDARY).toContain("منبج");
  });

  it("يعيد النص الافتراضي عند غياب قيمة الشريط بدلاً من تعطل الواجهة", () => {
    expect(normalizeTickerText(undefined, DEFAULT_TICKER_PRIMARY)).toBe(DEFAULT_TICKER_PRIMARY);
    expect(normalizeTickerText("  نص محفوظ  ", DEFAULT_TICKER_PRIMARY)).toBe("نص محفوظ");
  });

  it("يحضّر قيم الشريطين قبل الحفظ ولا يمرر حقولاً فارغة إلى قاعدة البيانات", () => {
    expect(tickerSettingsInputSchema.parse({ tickerPrimary: "عرض اليوم", tickerSecondary: "توصيل سريع" })).toEqual({ tickerPrimary: "عرض اليوم", tickerSecondary: "توصيل سريع" });
    expect(tickerSettingsInputSchema.parse({})).toEqual({ tickerPrimary: DEFAULT_TICKER_PRIMARY, tickerSecondary: DEFAULT_TICKER_SECONDARY });
  });

  it("ينشئ قيمتي SQL صريحتين للشريطين حتى عند وصول مدخلات ناقصة", () => {
    expect(readTickerSettings({ tickerPrimary: "نص صالح" })).toEqual({
      tickerPrimary: "نص صالح",
      tickerSecondary: DEFAULT_TICKER_SECONDARY,
    });
  });
});

describe("تعيين الشريك للمتجر", () => {
  it("يقبل تعيين حساب شريك أو إزالة التعيين من بيانات المتجر", () => {
    expect(storeInput.parse({ name: "حلويات الشام", category: "sweets", partnerId: 7, active: true, sortOrder: 1 }).partnerId).toBe(7);
    expect(storeInput.parse({ name: "حلويات الشام", category: "sweets", partnerId: null, active: true, sortOrder: 1 }).partnerId).toBeNull();
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

  it("يقبل ربط سلة الطلب العادية بحجز جرابلس مختار", () => {
    const parsed = orderInputSchema.parse({
      orderType: "delivery",
      intercityTripId: 4,
      customerName: "أحمد",
      customerPhone: "+963912345678",
      paymentMethod: "cash",
      locationUrl: "https://www.google.com/maps/search/?api=1&query=36.12345,37.12345",
      locationLat: 36.12345,
      locationLng: 37.12345,
      lines: [{ category: "groceries", itemName: "عدس", quantity: 1, unit: "وحدة" }],
    });

    expect(parsed.intercityTripId).toBe(4);
  });

  it("يقبل طلب منتج من أحد الأقسام الجديدة", () => {
    const parsed = orderInputSchema.parse({
      orderType: "delivery",
      customerName: "أحمد",
      customerPhone: "+963912345678",
      paymentMethod: "cash",
      locationUrl: "https://www.google.com/maps/search/?api=1&query=36.12345,37.12345",
      locationLat: 36.12345,
      locationLng: 37.12345,
      lines: [{ category: "sweets", itemName: "كعكة شوكولا", quantity: 1, unit: "وحدة" }],
    });

    expect(parsed.lines[0]?.category).toBe("sweets");
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
