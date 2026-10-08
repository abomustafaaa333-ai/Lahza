import type { LahzaCategory } from "./lahza";

export type ProductUnitGroup = {
  label: string;
  options: readonly string[];
};

export const PRODUCT_UNIT_GROUPS: readonly ProductUnitGroup[] = [
  { label: "الوزن", options: ["طن", "كيلوغرام", "كيلو غرام", "كيلو", "كغ", "كجم", "غرام", "جرام", "مليغرام", "ملغ"] },
  { label: "السعة", options: ["لتر", "ليتر", "ملليلتر", "مليلتر", "مل", "جالون", "كوب"] },
  { label: "الطول والمساحة", options: ["كيلومتر", "متر", "سنتيمتر", "ملم", "قدم", "بوصة", "متر مربع", "سنتيمتر مربع"] },
  { label: "العدّ والملابس", options: ["وحدة", "حبة", "قطعة", "زوج", "طقم", "مجموعة", "شريحة", "ورقة"] },
  { label: "التعبئة والتغليف", options: ["عبوة", "علبة", "كيس", "باكيت", "شريط", "كرتون", "كرتونة", "صندوق", "ربطة", "حزمة", "رول", "لفة", "لفافة", "قنينة", "قارورة", "زجاجة", "بخاخ", "صفيحة", "أسطوانة"] },
  { label: "الأطعمة والطلبات", options: ["وجبة", "صحن", "طبق", "ساندويش", "حصة", "رغيف", "شريحة", "صينية", "طلب"] },
  { label: "الخدمات", options: ["ساعة", "يوم", "جلسة", "زيارة"] },
];

export const ALL_PRODUCT_UNITS = Array.from(
  new Set(PRODUCT_UNIT_GROUPS.flatMap(group => group.options)),
);

const CATEGORY_UNITS: Partial<Record<LahzaCategory, readonly string[]>> = {
  restaurants: ["وجبة", "صحن", "طبق", "ساندويش", "حصة", "قطعة", "رغيف"],
  groceries: ["كيلوغرام", "كيلو", "كغ", "غرام", "جرام", "عبوة", "علبة", "كيس", "باكيت", "كرتونة", "وحدة"],
  household: ["قطعة", "وحدة", "عبوة", "علبة", "كرتونة", "صندوق", "رول", "متر"],
  produce: ["كيلوغرام", "كيلو", "كغ", "غرام", "جرام", "ربطة", "صندوق", "قطعة"],
  bakery: ["قطعة", "ربطة", "كيلوغرام", "كيلو", "كغ", "علبة", "صينية", "رغيف"],
  butcher: ["كيلوغرام", "كيلو", "كغ", "غرام", "جرام", "قطعة"],
  gas: ["قنينة", "قارورة", "أسطوانة", "وحدة"],
  pharmacy: ["طلب", "علبة", "شريط", "عبوة", "قطعة", "ملليلتر", "مل", "بخاخ"],
  sweets: ["قطعة", "كيلوغرام", "كيلو", "كغ", "غرام", "جرام", "علبة", "صينية"],
  clothing: ["قطعة", "طقم", "زوج", "مجموعة"],
  mobile_accessories: ["قطعة", "زوج", "علبة", "وحدة", "مجموعة"],
  beauty_personal_care: ["قطعة", "عبوة", "علبة", "ملليلتر", "مل", "بخاخ"],
  baby: ["قطعة", "عبوة", "علبة", "كرتونة", "مجموعة"],
  school_stationery: ["قطعة", "علبة", "طقم", "كرتونة", "مجموعة", "ورقة"],
};

/** كل الوحدات متاحة، مع وضع الأكثر صلة بالقسم في بداية القائمة. */
export function productUnitsForCategory(category: LahzaCategory, current?: string) {
  const preferred = CATEGORY_UNITS[category] ?? ["وحدة", "قطعة", "علبة"];
  return Array.from(new Set([
    ...(current ? [current] : []),
    ...preferred,
    ...ALL_PRODUCT_UNITS,
  ]));
}

/** الزيادات الملائمة عند إدخال كميات قابلة للتجزئة. */
export function productUnitStep(unit: string) {
  const normalized = unit.trim().toLocaleLowerCase();
  if (["جرام", "غرام"].includes(normalized)) return 50;
  if (["كيلوغرام", "كيلو غرام", "كيلو", "كغ", "كجم", "kg"].includes(normalized)) return 0.25;
  if (normalized === "طن") return 0.1;
  if (["لتر", "ليتر"].includes(normalized)) return 0.1;
  if (["ملليلتر", "مليلتر", "مل"].includes(normalized)) return 100;
  if (["مليغرام", "ملغ"].includes(normalized)) return 100;
  if (["متر", "سنتيمتر", "متر مربع", "سنتيمتر مربع"].includes(normalized)) return 0.5;
  if (normalized === "كيلومتر") return 0.1;
  return 1;
}

export function productUnitMinimum(unit: string) {
  return productUnitStep(unit) < 1 ? productUnitStep(unit) : 1;
}
