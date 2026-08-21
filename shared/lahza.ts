export type LahzaCategory =
  | "groceries"
  | "chicken"
  | "breakfast"
  | "lamb"
  | "butcher"
  | "fuel"
  | "pharmacy"
  | "other"
  | "offers"
  | "sweets"
  | "clothing"
  | "mobile_accessories"
  | "beauty_boutique";

export type CatalogSeed = {
  code: string;
  name: string;
  category: LahzaCategory;
  unit: "وحدة" | "جرام" | "ليتر" | "قنينة";
};

export const categoryMeta: Record<LahzaCategory, { title: string; subtitle: string; unit: string; priced: boolean }> = {
  groceries: { title: "البقوليات", subtitle: "حبوب وأرز وبرغل", unit: "وحدة", priced: true },
  chicken: { title: "مطاعم فروج", subtitle: "وجبات وسندويش", unit: "وحدة", priced: true },
  breakfast: { title: "فلافل وإفطار", subtitle: "وجبات صباحية", unit: "وحدة", priced: true },
  lamb: { title: "مطاعم لحم غنم", subtitle: "مشاوي ولحم بعجين", unit: "وحدة", priced: true },
  butcher: { title: "الملحمة", subtitle: "الكمية بالجرام", unit: "جرام", priced: true },
  fuel: { title: "الكازيات والغاز", subtitle: "وقود بالليتر أو قناني غاز", unit: "ليتر", priced: true },
  pharmacy: { title: "الصيدليات", subtitle: "أضف أسماء الأدوية", unit: "طلب", priced: false },
  other: { title: "منتجات أخرى", subtitle: "منتجات متنوعة تضيفها الإدارة", unit: "وحدة", priced: true },
  offers: { title: "العروض", subtitle: "عروض مميزة يضيفها المدير", unit: "وحدة", priced: true },
  sweets: { title: "الحلويات والمعجنات", subtitle: "حلويات، كيك ومعجنات طازجة", unit: "وحدة", priced: true },
  clothing: { title: "الألبسة", subtitle: "ملابس وإكسسوارات متنوعة", unit: "وحدة", priced: true },
  mobile_accessories: { title: "الموبايلات والإكسسوارات", subtitle: "هواتف وملحقات وأجهزة", unit: "وحدة", priced: true },
  beauty_boutique: { title: "مواد التجميل والبوتيك", subtitle: "عناية شخصية ومستحضرات تجميل", unit: "وحدة", priced: true },
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
  ...makeSeed("chicken", "وحدة", ["فروج مشوي", "فروج بروستد", "شاورما فروج عربي", "ساندويش شاورما فروج", "ساندويش بروستد", "ساندويش شيش طاووق", "وجبة شيش طاووق", "ساندويش كريسبي", "وجبة كريسبي", "ساندويش فاهيتا", "ساندويش فرنسي"]),
  ...makeSeed("breakfast", "وحدة", ["صحن فلافل", "ساندويش فلافل", "صحن فول", "صحن حمص/مسبحة", "صحن فتة بالسمنة", "صحن فتة بالزيت"]),
  ...makeSeed("lamb", "وحدة", ["كباب غنم مشوي", "شقف لحم غنم", "ساندويش كباب غنم", "ساندويش شاورما لحم", "وجبة شاورما لحم", "شرحات لحم غنم", "لحم بعجين منبجي"]),
  ...makeSeed("butcher", "جرام", ["لحم غنم", "لحم فروج"]),
  ...makeSeed("fuel", "ليتر", ["بنزين", "مازوت"]),
  { code: "fuel-gas-cylinder", name: "جرة غاز", category: "fuel", unit: "قنينة" },
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
