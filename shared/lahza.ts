export type LahzaCategory =
  | "restaurants"
  | "groceries"
  | "household"
  | "produce"
  | "bakery"
  | "butcher"
  | "gas"
  | "pharmacy"
  | "sweets"
  | "clothing"
  | "mobile_accessories"
  | "beauty_personal_care"
  | "baby"
  | "school_stationery"
  | "chicken"
  | "breakfast"
  | "lamb"
  | "fuel"
  | "beauty_boutique"
  | "other"
  | "offers";

export type CatalogSeed = {
  code: string;
  name: string;
  category: LahzaCategory;
  unit: "وحدة" | "جرام" | "ليتر" | "قنينة";
};

export const categoryMeta: Record<LahzaCategory, { title: string; subtitle: string; unit: string; priced: boolean }> = {
  restaurants: { title: "مطاعم ومأكولات", subtitle: "إفطار، فروج، مشاوي وسندويش", unit: "وحدة", priced: true },
  groceries: { title: "بقاليات ومواد غذائية", subtitle: "أرز ومعلبات وألبان ومنظفات", unit: "وحدة", priced: true },
  household: { title: "المواد المنزلية", subtitle: "منظفات وأدوات منزلية للاستخدام اليومي", unit: "وحدة", priced: true },
  produce: { title: "خضار وفواكه", subtitle: "خضار وفواكه طازجة", unit: "وحدة", priced: true },
  bakery: { title: "مخابز وأفران", subtitle: "خبز ومعجنات يومية", unit: "وحدة", priced: true },
  butcher: { title: "الملحمة ولحوم ودواجن", subtitle: "الكمية بالجرام", unit: "جرام", priced: true },
  gas: { title: "الغاز المنزلي", subtitle: "قناني غاز من مورد معتمد", unit: "قنينة", priced: true },
  pharmacy: { title: "صيدليات واحتياجات صحية", subtitle: "احتياجات صحية وعناية شخصية", unit: "طلب", priced: true },
  sweets: { title: "الحلويات والمعجنات", subtitle: "حلويات، كيك ومعجنات طازجة", unit: "وحدة", priced: true },
  clothing: { title: "الألبسة", subtitle: "ملابس وإكسسوارات متنوعة", unit: "وحدة", priced: true },
  mobile_accessories: { title: "موبايلات وإلكترونيات خفيفة", subtitle: "شواحن وسماعات وملحقات", unit: "وحدة", priced: true },
  beauty_personal_care: { title: "عناية شخصية وتجميل", subtitle: "عناية ومكياج وعطور", unit: "وحدة", priced: true },
  baby: { title: "مستلزمات الطفل", subtitle: "حفاضات ومناديل وعناية", unit: "وحدة", priced: true },
  school_stationery: { title: "أدوات مدرسية وقرطاسية", subtitle: "دفاتر وأقلام وحقائب وفنون", unit: "وحدة", priced: true },
  chicken: { title: "مطاعم فروج (قديم)", subtitle: "سيُنقل إلى مطاعم ومأكولات", unit: "وحدة", priced: true },
  breakfast: { title: "فلافل وإفطار (قديم)", subtitle: "سيُنقل إلى مطاعم ومأكولات", unit: "وحدة", priced: true },
  lamb: { title: "مطاعم لحم غنم (قديم)", subtitle: "سيُنقل إلى مطاعم ومأكولات", unit: "وحدة", priced: true },
  fuel: { title: "كازيات ووقود (قديم)", subtitle: "سيُنقل إلى الغاز المنزلي أو يُخفى", unit: "وحدة", priced: true },
  beauty_boutique: { title: "تجميل وبوتيك (قديم)", subtitle: "سيُنقل إلى عناية شخصية وتجميل", unit: "وحدة", priced: true },
  other: { title: "منتجات غير مصنفة", subtitle: "تصنيف إداري مؤقت", unit: "وحدة", priced: true },
  offers: { title: "عروض قديمة", subtitle: "تدار من مساحة العروض", unit: "وحدة", priced: true },
};

for (const legacyCategory of ["chicken", "breakfast", "lamb", "fuel", "beauty_boutique", "other", "offers"] as const) {
  Object.defineProperty(categoryMeta, legacyCategory, { enumerable: false });
}

/** الأقسام المتاحة لإنشاء متجر أو منتج جديد. */
export const storeCategories = ["restaurants", "groceries", "household", "produce", "bakery", "butcher", "gas", "pharmacy", "sweets", "clothing", "mobile_accessories", "beauty_personal_care", "baby", "school_stationery"] as const satisfies readonly LahzaCategory[];

/** الأقسام الظاهرة للعميل في صفحة طلبك للبيت. */
export const customerDeliveryCategories = ["restaurants", "groceries", "household", "produce", "pharmacy", "bakery", "sweets", "butcher", "baby", "school_stationery", "beauty_personal_care", "mobile_accessories", "clothing", "gas"] as const satisfies readonly LahzaCategory[];

export type RestaurantType = "all" | "breakfast" | "chicken" | "grills" | "sandwiches";
export const restaurantTypeMeta: Record<RestaurantType, string> = {
  all: "كل المطاعم",
  breakfast: "إفطار",
  chicken: "فروج",
  grills: "مشاوي",
  sandwiches: "سندويش",
};

export const DEFAULT_TICKER_PRIMARY = "حقق ١٠ طلبات واربح معنا هدية";
export const DEFAULT_TICKER_SECONDARY = "لحظة — منبج بين يديك";
export const SYP_CONVERSION_FACTOR = 100;

export function normalizeTickerText(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim().length >= 2 ? value.trim() : fallback;
}

const makeSeed = (category: LahzaCategory, unit: CatalogSeed["unit"], names: string[]): CatalogSeed[] =>
  names.map((name, index) => ({ code: `${category}-${index + 1}`, name, category, unit }));

export const catalogSeed: CatalogSeed[] = [
  ...makeSeed("groceries", "وحدة", ["عدس أصفر", "عدس أسود", "حمص حب", "فاصولياء بيضاء", "فول يابس", "برغل أبيض ناعم", "برغل أبيض خشن", "برغل أحمر", "أرز مصري", "أرز كبسة طويل", "فريك", "ذرة", "سميد"]),
  ...makeSeed("restaurants", "وحدة", ["فروج مشوي", "فروج بروستد", "شاورما فروج عربي", "ساندويش شاورما فروج", "صحن فلافل", "ساندويش فلافل", "صحن فول", "كباب غنم مشوي", "ساندويش شاورما لحم", "لحم بعجين منبجي"]),
  ...makeSeed("butcher", "جرام", ["لحم غنم", "لحم فروج"]),
  { code: "gas-cylinder", name: "جرة غاز", category: "gas", unit: "قنينة" },
];

function safeMoneyValue(value: number) {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

/** يحوّل القيمة المخزّنة إلى ليرات سورية جديدة صحيحة، بلا أجزاء عشرية. */
export const toNewSyp = (legacyValue: number) => Math.round(safeMoneyValue(legacyValue) / SYP_CONVERSION_FACTOR);

/** يحوّل مبلغاً صحيحاً بالليرة الجديدة إلى قيمة التخزين التاريخية. */
export const toLegacySyp = (newValue: number) => Math.round(safeMoneyValue(newValue)) * SYP_CONVERSION_FACTOR;

export const formatNewSyp = (value: number) => `${new Intl.NumberFormat("ar-SY", { maximumFractionDigits: 0 }).format(Math.round(safeMoneyValue(value)))} ل.س جديدة`;

/** تحسب رسوم التوصيل من مبلغ المنتجات المعروض بالليرة الجديدة، ثم تقرّبها إلى ليرة صحيحة. */
export const calculatePercentageDeliveryFeeNewSyp = (itemsTotalInLegacySyp: number, percentage: number) => Math.round(toNewSyp(itemsTotalInLegacySyp) * Math.max(0, Math.min(100, Math.round(Number(percentage) || 0))) / 100);

/** يعرض القيم التاريخية المخزنة دائماً بالليرة السورية الجديدة. */
export const formatSyp = (legacyValue: number) => formatNewSyp(toNewSyp(legacyValue));

export const orderStatusLabels = {
  pending: "جديد",
  confirmed: "مؤكد",
  preparing: "قيد التنفيذ",
  on_the_way: "بالطريق",
  completed: "مكتمل",
  cancelled: "ملغي",
  rejected: "مرفوض",
} as const;
