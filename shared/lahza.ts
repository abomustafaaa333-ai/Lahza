export type LahzaCategory =
  | "groceries"
  | "chicken"
  | "breakfast"
  | "lamb"
  | "butcher"
  | "fuel"
  | "pharmacy";

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
};

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

export const formatSyp = (value: number) => `${new Intl.NumberFormat("ar-SY").format(value)} ل.س`;

export const orderStatusLabels = {
  pending: "جديد",
  confirmed: "مؤكد",
  preparing: "قيد التنفيذ",
  on_the_way: "بالطريق",
  completed: "مكتمل",
  cancelled: "ملغي",
} as const;
