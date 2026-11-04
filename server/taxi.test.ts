import { describe, expect, it } from "vitest";
import { mapLink, taxiTypeLabel, taxiVehicle, vehicleForOrder } from "./taxi";

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

describe("which drivers get an order", () => {
  it("store deliveries go to motorbikes", () => {
    expect(vehicleForOrder({ orderType: "delivery" })).toBe("motorcycle");
  });
  it("taxis go to cars or vans as chosen", () => {
    expect(vehicleForOrder({ orderType: "taxi", taxiType: "standard" })).toBe("car");
    expect(vehicleForOrder({ orderType: "taxi", taxiType: "van" })).toBe("van");
  });
  it("وصّل لي goes to the vehicle the customer picked, motorbike by default", () => {
    expect(vehicleForOrder({ orderType: "wossel_li" }, "car")).toBe("car");
    expect(vehicleForOrder({ orderType: "wossel_li" }, "motorcycle")).toBe("motorcycle");
    expect(vehicleForOrder({ orderType: "wossel_li" }, null)).toBe("motorcycle");
  });
});
