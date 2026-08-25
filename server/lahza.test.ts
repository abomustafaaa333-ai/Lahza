import { describe, expect, it } from "vitest";
import { calculatePercentageDeliveryFeeNewSyp, catalogSeed, categoryMeta, DEFAULT_TICKER_PRIMARY, DEFAULT_TICKER_SECONDARY, formatNewSyp, formatSyp, normalizeTickerText, SYP_CONVERSION_FACTOR, toLegacySyp, toNewSyp } from "../shared/lahza";
import { getAdminHomeShortcut, getHomeShortcut } from "../shared/adminHomeShortcut";
import { isStoreClosedForCustomer } from "../shared/storeAvailability";
import { calculateDeliveryFee, calculateLineTotal, calculateOfferExpiry, calculatePercentageDeliveryFee, canReserveIntercityTrip, canShowFeaturedOffer, DELIVERY_PRICING_PENDING_NOTE, filterRestaurantStores, hasMatchingAuthRuntime, initialCustomerOrderStatus, isAuthRuntimeId, meetsMinimumDeliveryOrder, MINIMUM_DELIVERY_ORDER_SYP, normalizeProductSearchText, orderInputSchema, partnerOfferInput, partnerProductInput, pendingDeliveryCalculation, readTickerSettings, storeInput, supportContactInput, tickerSettingsInputSchema } from "./lahza";
import { isOfferExpiredAt } from "./expiredOffers";
import { demoProductTemplates } from "./demoCatalog";

describe("الأسعار التقديرية للكتالوج", () => {
  it("يمنح كل قالب منتج سعراً تقديرياً موجباً", () => {
    Object.values(demoProductTemplates).flat().forEach(product => {
      expect(product.estimatedPrice).toBeGreaterThan(0);
    });
  });
});

describe("بحث المنتجات", () => {
  it("ينقي عبارة البحث من المسافات والرموز الخاصة بالمطابقة", () => {
    expect(normalizeProductSearchText("  عدس_%  ")).toBe("عدس");
    expect(normalizeProductSearchText("فروج مشوي")).toBe("فروج مشوي");
  });
});

describe("جهات التواصل مع العملاء", () => {
  it("يقبل رقماً سورياً مع وسيلة تواصل واحدة على الأقل", () => {
    expect(supportContactInput.parse({ label: "خدمة العملاء", phone: "+963912345678", callEnabled: true, whatsappEnabled: false, active: true, sortOrder: 2 })).toMatchObject({ label: "خدمة العملاء", phone: "+963912345678" });
  });

  it("يرفض جهة بلا اتصال ولا واتساب", () => {
    expect(() => supportContactInput.parse({ label: "الدعم", phone: "+963912345678", callEnabled: false, whatsappEnabled: false, active: true, sortOrder: 0 })).toThrow("اختر الاتصال أو واتساب");
  });
});

	describe("اختصار الصفحة الرئيسية للإدارة", () => {
  it("يظهر لوحة التحكم للمالك ولوحة الإشراف للمشرف ولا يظهر للعميل", () => {
    expect(getAdminHomeShortcut("owner")).toMatchObject({ label: "لوحة التحكم", path: "/admin" });
    expect(getAdminHomeShortcut("supervisor")).toMatchObject({ label: "لوحة الإشراف", path: "/admin" });
    expect(getAdminHomeShortcut(null)).toBeNull();
  });

	it("يعطي جلسة الإدارة أولوية ويعرض متجري للشريك فقط", () => {
	  expect(getHomeShortcut({ adminRole: "owner", partnerActive: true })).toMatchObject({ label: "لوحة التحكم", path: "/admin" });
	  expect(getHomeShortcut({ adminRole: "supervisor", partnerActive: true })).toMatchObject({ label: "لوحة الإشراف", path: "/admin" });
	  expect(getHomeShortcut({ adminRole: null, partnerActive: true })).toMatchObject({ label: "متجري", path: "/partner/store" });
	});
	});

describe("حماية جلسات الأدوار", () => {
  const activeRuntime = "59f19ed6-e89b-4e4f-b2e0-1fd1e358cac6";

  it("يقبل فقط معرّف تشغيل صالحاً ويطابق تماماً معرّف الجلسة الموقّعة", () => {
    expect(isAuthRuntimeId(activeRuntime)).toBe(true);
    expect(isAuthRuntimeId("قصير")).toBe(false);
    expect(hasMatchingAuthRuntime(activeRuntime, activeRuntime)).toBe(true);
  });

  it("يرفض جلسة المالك أو المشرف أو الشريك عند إعادة فتح التطبيق بمعرّف تشغيل مختلف", () => {
    expect(hasMatchingAuthRuntime("6d1e628a-c54c-4e79-b995-6680d1bbcd67", activeRuntime)).toBe(false);
    expect(hasMatchingAuthRuntime(undefined, activeRuntime)).toBe(false);
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

  it("يعرض السعر دائماً بوصفه ل.س صحيحة بلا فاصلة", () => {
    expect(formatSyp(50_000)).toContain("ل.س");
    expect(formatNewSyp(300)).toContain("ل.س");
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

describe("قسم الغاز المنزلي", () => {
  it("يعرض جرة غاز كوحدة قابلة للتسعير من دون إظهار الوقود القديم", () => {
    const gasCylinder = catalogSeed.find(item => item.name === "جرة غاز");
    expect(categoryMeta.gas.title).toBe("الغاز المنزلي");
    expect(gasCylinder).toMatchObject({ category: "gas", unit: "قنينة" });
  });
});

describe("الأقسام ومحتوى الواجهة الجديد", () => {
  it("يبقي التصنيفات القديمة للتاريخ ويخفيها من قوائم الإنشاء والعميل", () => {
    expect(categoryMeta.other.title).toBe("منتجات غير مصنفة");
    expect(categoryMeta.offers.title).toBe("عروض قديمة");
    expect(Object.keys(categoryMeta)).not.toContain("other");
    expect(Object.keys(categoryMeta)).not.toContain("offers");
  });

  it("يُعرّف أقسام المتاجر الجديدة بالأسماء المعتمدة", () => {
    expect(categoryMeta.sweets.title).toBe("الحلويات والمعجنات");
    expect(categoryMeta.clothing.title).toBe("الألبسة");
    expect(categoryMeta.mobile_accessories.title).toBe("موبايلات وإلكترونيات خفيفة");
    expect(categoryMeta.beauty_personal_care.title).toBe("عناية شخصية وتجميل");
    expect(categoryMeta.school_stationery.title).toBe("أدوات مدرسية وقرطاسية");
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

  it("يقبل نوع المطعم ويضع «كل المطاعم» افتراضياً للمتجر الجديد", () => {
    const base = { name: "مطعم الشام", category: "restaurants" as const, partnerId: null, active: true, sortOrder: 1 };
    expect(storeInput.parse(base).restaurantType).toBe("all");
    expect(storeInput.parse({ ...base, restaurantType: "grills" }).restaurantType).toBe("grills");
  });

  it("يقبل القسم المنزلي وربط متجر بقسم مخصص", () => {
    const base = { name: "متجر المنزل", partnerId: null, active: true, sortOrder: 1 };
    expect(storeInput.parse({ ...base, category: "household" }).category).toBe("household");
    expect(storeInput.parse({ ...base, category: "other", customCategoryId: 9 }).customCategoryId).toBe(9);
  });

  it("يفلتر نوع المطعم ويبقي المتاجر العامة ظاهرة ضمن كل نوع", () => {
    const stores = [
      { id: 1, restaurantType: "all" as const },
      { id: 2, restaurantType: "grills" as const },
      { id: 3, restaurantType: "breakfast" as const },
    ];
    expect(filterRestaurantStores(stores, "restaurants", "grills").map(store => store.id)).toEqual([1, 2]);
    expect(filterRestaurantStores(stores, "restaurants", "all").map(store => store.id)).toEqual([1, 2, 3]);
  });
});

describe("عروض المتاجر", () => {
  it("يربط العرض بمتجر الشريك ويجعل صورته اختيارية مع مدة إلزامية", () => {
    expect(partnerOfferInput.parse({ storeId: 3, catalogItemId: 12, text: "خصم اليوم على المعمول", durationDays: 30, offerPrice: 240, active: true })).toMatchObject({ storeId: 3, catalogItemId: 12, text: "خصم اليوم على المعمول", durationDays: 30, offerPrice: 240, active: true });
    expect(partnerOfferInput.parse({ storeId: 3, catalogItemId: 12, text: "خصم اليوم على المعمول", imageUrl: "https://images.example.com/offer.jpg", imageStorageKey: "lahza/offers/store-3/a1", durationDays: 7, offerPrice: 210, active: true }).imageStorageKey).toBe("lahza/offers/store-3/a1");
  });

  it("يرفض عرضاً بلا مدة أو مدة خارج الحدود المسموحة", () => {
    expect(() => partnerOfferInput.parse({ storeId: 3, text: "خصم اليوم على المعمول", active: true })).toThrow();
    expect(() => partnerOfferInput.parse({ storeId: 3, catalogItemId: 12, text: "خصم اليوم على المعمول", durationDays: 30, active: true })).toThrow();
    expect(() => partnerOfferInput.parse({ storeId: 3, catalogItemId: 12, text: "خصم اليوم على المعمول", durationDays: 30, offerPrice: 0, active: true })).toThrow();
    expect(() => partnerOfferInput.parse({ storeId: 3, catalogItemId: 12, text: "خصم اليوم على المعمول", durationDays: 366, offerPrice: 240, active: true })).toThrow();
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

describe("صور منتجات الشريك", () => {
  it("يقبل المنتج رابط صورة HTTPS اختياري لتظهر معاينته داخل المتجر", () => {
    expect(partnerProductInput.parse({ name: "علبة معمول", category: "sweets", storeId: 3, unit: "وحدة", price: 500, available: true, imageUrl: "https://images.example.com/maamoul.jpg" }).imageUrl).toContain("maamoul.jpg");
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

  it("يقبل الطلب عند كتابة موقع يدوي واضح من دون إحداثيات GPS", () => {
    const parsed = orderInputSchema.parse({
      orderType: "delivery",
      customerName: "أحمد",
      customerPhone: "+963912345678",
      paymentMethod: "cash",
      locationMode: "manual",
      locationText: "منبج، قرب دوار الساعة، بجانب الصيدلية",
      lines: [{ category: "pharmacy", itemName: "فيتامين C", quantity: 1, unit: "طلب" }],
    });

    expect(parsed.locationMode).toBe("manual");
    expect(parsed.locationText).toContain("دوار الساعة");
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

  it("ينقل طلب المنتجات المتاحة والمسعّرة إلى التجهيز مباشرة", () => {
    expect(initialCustomerOrderStatus("delivery", [{ priceKnown: true, unitPrice: 300 }])).toBe("preparing");
    expect(initialCustomerOrderStatus("delivery", [{ priceKnown: true, unitPrice: 300 }, { priceKnown: true, unitPrice: 150 }])).toBe("preparing");
  });

  it("يبقي الأصناف غير المسعّرة أو غير المتاحة وطلبات التاكسي ضمن المراجعة", () => {
    expect(initialCustomerOrderStatus("delivery", [{ priceKnown: false, unitPrice: 0 }])).toBe("pending");
    expect(initialCustomerOrderStatus("delivery", [{ priceKnown: true, unitPrice: 0 }])).toBe("pending");
    expect(initialCustomerOrderStatus("taxi", [])).toBe("pending");
  });

  it("يعرض العرض المميز بعد الاعتماد فقط ما دام نشطاً وغير منتهٍ", () => {
    const now = new Date("2026-08-22T12:00:00Z");
    expect(canShowFeaturedOffer("approved", true, new Date("2026-08-23T12:00:00Z"), now)).toBe(true);
    expect(canShowFeaturedOffer("pending", true, new Date("2026-08-23T12:00:00Z"), now)).toBe(false);
    expect(canShowFeaturedOffer("approved", false, new Date("2026-08-23T12:00:00Z"), now)).toBe(false);
    expect(canShowFeaturedOffer("approved", true, new Date("2026-08-21T12:00:00Z"), now)).toBe(false);
  });
});
