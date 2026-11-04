import { describe, expect, it } from "vitest";
import { taxiFareNewSyp, taxiVehicle, type TaxiPricing } from "./taxi";

const pricing: TaxiPricing = { standardPricePerKm: 10, standardMinFare: 50, vanPricePerKm: 20, vanMinFare: 100 };

describe("taxi fare", () => {
  it("charges per started kilometre", () => {
    expect(taxiFareNewSyp(7_200, "standard", pricing)).toBe(80);
    expect(taxiFareNewSyp(7_200, "van", pricing)).toBe(160);
  });
  it("never goes below the minimum fare", () => {
    expect(taxiFareNewSyp(900, "standard", pricing)).toBe(50);
    expect(taxiFareNewSyp(0, "van", pricing)).toBe(100);
  });
  it("is unknown while the vehicle has no price", () => {
    expect(taxiFareNewSyp(5_000, "standard", { ...pricing, standardPricePerKm: 0 })).toBeNull();
  });
  it("sends vans to van drivers and taxis to car drivers", () => {
    expect(taxiVehicle("van")).toBe("van");
    expect(taxiVehicle("standard")).toBe("car");
  });
});
