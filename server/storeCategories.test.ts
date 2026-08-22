import { describe, expect, it } from "vitest";
import { categoryMeta, customerDeliveryCategories, storeCategories } from "../shared/lahza";

describe("أقسام متاجر لحظة", () => {
  it("يعرض الأقسام الجديدة للعميل ويخفي التصنيفات القديمة والعروض", () => {
    expect(customerDeliveryCategories).toContain("restaurants");
    expect(customerDeliveryCategories).toContain("produce");
    expect(customerDeliveryCategories).toContain("school_stationery");
    expect(customerDeliveryCategories).not.toContain("fuel");
    expect(customerDeliveryCategories).not.toContain("other");
    expect(customerDeliveryCategories).not.toContain("offers");
  });

  it("لا يعرض التصنيفات التاريخية في قوائم الإدارة الجديدة", () => {
    expect(Object.keys(categoryMeta)).toEqual(storeCategories);
    expect(categoryMeta.restaurants.title).toBe("مطاعم ومأكولات");
    expect(categoryMeta.groceries.title).toBe("بقاليات ومواد غذائية");
  });
});
