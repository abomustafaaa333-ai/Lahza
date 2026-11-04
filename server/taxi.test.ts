import { describe, expect, it } from "vitest";
import { mapLink, taxiTypeLabel, taxiVehicle } from "./taxi";

describe("taxi rides", () => {
  it("sends vans to van drivers and taxis to car drivers", () => {
    expect(taxiVehicle("van")).toBe("van");
    expect(taxiVehicle("standard")).toBe("car");
  });
  it("labels the vehicle for messages", () => {
    expect(taxiTypeLabel("van")).toBe("فان");
    expect(taxiTypeLabel("standard")).toBe("تاكسي عادي");
    expect(taxiTypeLabel(null)).toBe("تاكسي عادي");
  });
  it("builds a map link for the driver", () => {
    expect(mapLink(36.5276, 37.9545)).toBe("https://maps.google.com/?q=36.527600,37.954500");
  });
});
