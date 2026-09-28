import { describe, expect, it } from "vitest";
import { isWahaConfigured, normalizeWahaChatId, normalizeWahaReply } from "./waha";

describe("WAHA integration", () => {
  it("converts an international phone number to a WhatsApp chat id", () => {
    expect(normalizeWahaChatId("+963 997 123 456")).toBe("963997123456@c.us");
  });

  it("rejects an empty or invalid phone number", () => {
    expect(normalizeWahaChatId("---")).toBeNull();
    expect(normalizeWahaChatId("")).toBeNull();
  });
  it("normalizes legacy Syrian local and 00-prefixed phone numbers", () => {
    expect(normalizeWahaChatId("0997123456")).toBe("963997123456@c.us");
    expect(normalizeWahaChatId("00963997123456")).toBe("963997123456@c.us");
  });

  it("only reports configured when URL and API key are present", () => {
    expect(isWahaConfigured({ WAHA_URL: "http://waha", WAHA_API_KEY: "secret" })).toBe(true);
    expect(isWahaConfigured({ WAHA_URL: "http://waha" })).toBe(false);
    expect(isWahaConfigured({ WAHA_API_KEY: "secret" })).toBe(false);
  });

  it("normalizes order replies without confusing them with readiness replies", () => {
    expect(normalizeWahaReply("نعم،")).toBe("نعم");
    expect(normalizeWahaReply("لا")).toBe("لا");
    expect(normalizeWahaReply("أنا جاهز")).toBe("جاهز");
    expect(normalizeWahaReply("غير جاهز")).toBe("غير جاهز");
    expect(normalizeWahaReply("١٠")).toBe("10");
    expect(normalizeWahaReply("رقم 10")).toBe("10");
    expect(normalizeWahaReply("الرقم ١٠")).toBe("10");
  });
});
