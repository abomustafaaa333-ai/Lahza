import { describe, expect, it } from "vitest";
import { isWahaConfigured, normalizeWahaChatId } from "./waha";

describe("WAHA integration", () => {
  it("converts an international phone number to a WhatsApp chat id", () => {
    expect(normalizeWahaChatId("+963 997 123 456")).toBe("963997123456@c.us");
  });

  it("rejects an empty or invalid phone number", () => {
    expect(normalizeWahaChatId("---")).toBeNull();
    expect(normalizeWahaChatId("")).toBeNull();
  });

  it("only reports configured when URL and API key are present", () => {
    expect(isWahaConfigured({ WAHA_URL: "http://waha", WAHA_API_KEY: "secret" })).toBe(true);
    expect(isWahaConfigured({ WAHA_URL: "http://waha" })).toBe(false);
    expect(isWahaConfigured({ WAHA_API_KEY: "secret" })).toBe(false);
  });
});
