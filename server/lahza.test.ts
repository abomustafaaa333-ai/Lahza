import { describe, expect, it } from "vitest";
import { calculatePercentageDeliveryFeeNewSyp, catalogSeed, categoryMeta, DEFAULT_TICKER_PRIMARY, DEFAULT_TICKER_SECONDARY, formatNewSyp, formatSyp, normalizeTickerText, SYP_CONVERSION_FACTOR, toLegacySyp, toNewSyp } from "../shared/lahza";
import { getAdminHomeShortcut, getHomeShortcut } from "../shared/adminHomeShortcut";
import { isStoreClosedForCustomer } from "../shared/storeAvailability";
import { calculateDeliveryFee, calculateLineTotal, calculateOfferExpiry, calculatePercentageDeliveryFee, canReserveIntercityTrip, DELIVERY_PRICING_PENDING_NOTE, meetsMinimumDeliveryOrder, MINIMUM_DELIVERY_ORDER_SYP, orderInputSchema, partnerOfferInput, pendingDeliveryCalculation, readTickerSettings, storeInput, tickerSettingsInputSchema } from "./lahza";
import { isOfferExpiredAt } from "./expiredOffers";

describe("اختصار الصفحة الرئيسية للإدارة", () => {
  it("يظهر لوحة التحكم للمالك ولوحة الإشراف للمشرف ولا يظهر للعميل", () => {
    expect(getAdminHomeShortcut("owner")).toMatchObject({ label: "لوحة التحكم", path: "/admin" });
    expect(getAdminHomeShortcut("supervisor")).toMatchObject({ label: "لوحة الإشراف", path: "/admin" });
    expect(getAdminHomeShortcut(null)).toBeNull();
  });

  it("يعرض متجري للشريك بدلاً من أي اختصار إداري متبقٍ", () => {
    expect(getHomeShortcut({ adminRole: "owner", partnerActive: true })).toMatchObject({ label: "متجري", path: "/partner/store" });
    expect(getHomeShortcut({ adminRole: "supervisor", partnerActive: true })).toMatchObject({ label: "متجري", path: "/partner/store" });
    expect(getHomeShortcut({ adminRole: "owner", partnerActive: false })).toMatchObject({ label: "لوحة التحكم", path: "/admin" });
  });
});

describe("حالة المتجر للعميل", () => {
  it("تسمح بالتصفح مع منع الإضافة إلى السلة فقط عند إغلاق المتجر", () => {
    expect(isStoreClosedForCustomer(false)).toBe(true);
    expect(isStoreClosedForCustomer(true)).toBe(false);
    expect(isStoreClosedForCustomer(undefined)).toBe(false);
  });
});

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

describe("الحد الأدنى للطلب", () => {
  it("يرفض مجموعاً أقل من 300 ليرة سورية جديدة", () => {
    expect(meetsMinimumDeliveryOrder(MINIMUM_DELIVERY_ORDER_SYP * SYP_CONVERSION_FACTOR - 51)).toBe(false);
  });

  it("يقبل مجموعاً يساوي 300 ليرة سورية جديدة أو يتجاوزه", () => {
    expect(meetsMinimumDeliveryOrder(MINIMUM_DELIVERY_ORDER_SYP * SYP_CONVERSION_FACTOR)).toBe(true);
    expect(meetsMinimumDeliveryOrder((MINIMUM_DELIVERY_ORDER_SYP + 1) * SYP_CONVERSION_FACTOR)).toBe(true);
  });
});

describe("الليرة السورية الجديدة", () => {
  it("يحوّل القيم التاريخية إلى ليرات جديدة صحيحة من دون كسور", () => {
    expect(toNewSyp(100_000)).toBe(1_000);
    expect(toLegacySyp(1_000)).toBe(100_000);
    expect(toNewSyp(5_008)).toBe(50);
    expect(toLegacySyp(50.08)).toBe(5_000);
  });

  it("يعرض السعر دائماً بوصفه ليرة سورية جديدة صحيحة بلا فاصلة", () => {
    expect(formatSyp(50_000)).toContain("ل.س جديدة");
    expect(formatNewSyp(300)).toContain("ل.س جديدة");
    expect(formatNewSyp(50.08)).not.toContain("٫");
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

  it("يحسب 20% لمنبج و30% لجرابلس من قيمة المنتجات فقط", () => {
    const itemsTotal = 30_000;
    expect(calculatePercentageDeliveryFeeNewSyp(itemsTotal, 20)).toBe(60);
    expect(calculatePercentageDeliveryFeeNewSyp(itemsTotal, 30)).toBe(90);
    expect(calculatePercentageDeliveryFee(itemsTotal, 20)).toBe(6_000);
    expect(calculatePercentageDeliveryFee(itemsTotal, 30)).toBe(9_000);
  });

  it("لا يجعل رسم التوصيل طلباً أدنى مؤهلاً بمفرده", () => {
    const productsTotal = 25_000;
    const deliveryFee = calculatePercentageDeliveryFee(productsTotal, 30);
    expect(meetsMinimumDeliveryOrder(productsTotal)).toBe(false);
    expect(meetsMinimumDeliveryOrder(productsTotal + deliveryFee)).toBe(true);
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

describe("عروض المتاجر", () => {
  it("يربط العرض بمتجر الشريك ويجعل صورته اختيارية مع مدة إلزامية", () => {
    expect(partnerOfferInput.parse({ storeId: 3, catalogItemId: 12, text: "خصم اليوم على المعمول", durationDays: 30, active: true })).toMatchObject({ storeId: 3, catalogItemId: 12, text: "خصم اليوم على المعمول", durationDays: 30, active: true });
    expect(partnerOfferInput.parse({ storeId: 3, catalogItemId: 12, text: "خصم اليوم على المعمول", imageUrl: "https://images.example.com/offer.jpg", imageStorageKey: "lahza/offers/store-3/a1", durationDays: 7, active: true }).imageStorageKey).toBe("lahza/offers/store-3/a1");
  });

  it("يرفض عرضاً بلا مدة أو مدة خارج الحدود المسموحة", () => {
    expect(() => partnerOfferInput.parse({ storeId: 3, text: "خصم اليوم على المعمول", active: true })).toThrow();
    expect(() => partnerOfferInput.parse({ storeId: 3, text: "خصم اليوم على المعمول", durationDays: 366, active: true })).toThrow();
  });

  it("يحسب تاريخ الانتهاء بعد عدد الأيام المختار", () => {
    const createdAt = new Date("2026-08-21T00:00:00.000Z");
    expect(calculateOfferExpiry(7, createdAt).toISOString()).toBe("2026-08-28T00:00:00.000Z");
  });

  it("يُظهر التنبيه الإداري بعد انتهاء العرض دون اعتباره منتهياً قبله", () => {
    const now = new Date("2026-08-21T12:00:00.000Z");
    expect(isOfferExpiredAt(new Date("2026-08-21T12:00:00.000Z"), now)).toBe(true);
    expect(isOfferExpiredAt(new Date("2026-08-21T12:00:01.000Z"), now)).toBe(false);
    expect(isOfferExpiredAt(null, now)).toBe(false);
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
