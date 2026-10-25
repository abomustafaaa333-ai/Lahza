import { describe, expect, it } from "vitest";
import { categoryMeta, customerDeliveryCategories, isProductFirstCategory, productFirstCategories, storeCategories } from "../shared/lahza";

describe("أقسام متاجر لحظة", () => {
  it("يعرض الأقسام الجديدة للعميل ويخفي التصنيفات القديمة والعروض", () => {
    expect(customerDeliveryCategories).toContain("restaurants");
    expect(customerDeliveryCategories).toContain("produce");
    expect(customerDeliveryCategories).toContain("household");
    expect(customerDeliveryCategories).toContain("school_stationery");
    expect(customerDeliveryCategories).not.toContain("fuel");
    expect(customerDeliveryCategories).not.toContain("other");
    expect(customerDeliveryCategories).not.toContain("offers");
  });

  it("لا يعرض التصنيفات التاريخية في قوائم الإدارة الجديدة", () => {
    expect(Object.keys(categoryMeta)).toEqual(storeCategories);
    expect(categoryMeta.restaurants.title).toBe("مطاعم ومأكولات");
    expect(categoryMeta.groceries.title).toBe("بقاليات ومواد غذائية");
    expect(categoryMeta.household.title).toBe("المواد المنزلية");
  });

  it("يعرض الاحتياجات اليومية بالمنتج ويبقي المطاعم والصيدليات بالمتجر", () => {
    expect(isProductFirstCategory("groceries")).toBe(true);
    expect(isProductFirstCategory("household")).toBe(true);
    expect(isProductFirstCategory("restaurants")).toBe(false);
    expect(isProductFirstCategory("pharmacy")).toBe(false);
    for (const category of productFirstCategories) expect(customerDeliveryCategories).toContain(category);
  });
});
