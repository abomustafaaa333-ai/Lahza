import { describe, expect, it } from "vitest";
import { createGoogleDirectionsUrl } from "./maps";

describe("رابط حساب مسافة Google Maps الخارجي", () => {
  it("ينشئ رابطاً مشفراً يتضمن مفتاح الخدمة ونقطتي الطريق", () => {
    const url = createGoogleDirectionsUrl({
      origin: "36.5281,37.9549",
      destination: "36.6000,38.0000",
      mode: "driving",
      language: "ar",
      region: "sy",
    }, "test-key");

    expect(url.origin).toBe("https://maps.googleapis.com");
    expect(url.pathname).toBe("/maps/api/directions/json");
    expect(url.searchParams.get("key")).toBe("test-key");
    expect(url.searchParams.get("origin")).toBe("36.5281,37.9549");
    expect(url.searchParams.get("destination")).toBe("36.6000,38.0000");
  });
});
