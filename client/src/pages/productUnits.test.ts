import { describe, expect, it } from "vitest";
import { productUnitMinimum, productUnitsForCategory, productUnitStep } from "@shared/productUnits";

describe("product units", () => {
  it("offers broad weight, capacity, length, and packaging units for every category", () => {
    for (const category of ["groceries", "clothing", "pharmacy"] as const) {
      const units = productUnitsForCategory(category);
      for (const unit of ["كيلوغرام", "كيلو", "طن", "ملليلتر", "جالون", "متر مربع", "قطعة", "صندوق"]) {
        expect(units).toContain(unit);
      }
    }
  });

  it("keeps legacy units at the top when editing existing products", () => {
    expect(productUnitsForCategory("produce", "وحدة").slice(0, 2)).toEqual(["وحدة", "كيلوغرام"]);
  });

  it("chooses sensible fractional quantity steps", () => {
    expect(productUnitStep("جرام")).toBe(50);
    expect(productUnitStep("غرام")).toBe(50);
    expect(productUnitStep("كيلوغرام")).toBe(0.25);
    expect(productUnitStep("طن")).toBe(0.1);
    expect(productUnitMinimum("ليتر")).toBe(0.1);
    expect(productUnitStep("قطعة")).toBe(1);
  });
});
