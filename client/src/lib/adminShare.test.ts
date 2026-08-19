import { describe, expect, it } from "vitest";
import { buildContactVCard, buildEmployeeOrderWhatsAppUrl, buildWhatsAppLocationUrl, mapUrlFromNotes } from "./adminShare";

describe("admin sharing helpers", () => {
  it("extracts a stored GPS map link from order notes", () => {
    expect(mapUrlFromNotes("عند الباب الخلفي\nرابط الخريطة: https://maps.google.com/?q=36.5,37.9")).toBe("https://maps.google.com/?q=36.5,37.9");
  });

  it("builds a WhatsApp link containing the customer location", () => {
    const url = buildWhatsAppLocationUrl("أحمد", "https://maps.google.com/?q=36.5,37.9");
    expect(decodeURIComponent(url)).toContain("موقع طلب أحمد لدى لحظة");
    expect(decodeURIComponent(url)).toContain("https://maps.google.com/?q=36.5,37.9");
  });

  it("creates a standard vCard for the Syrian customer number", () => {
    const card = buildContactVCard("سارة; خالد", "+963 944 123 456");
    expect(card).toContain("BEGIN:VCARD");
    expect(card).toContain("FN:سارة\\; خالد");
    expect(card).toContain("TEL;TYPE=CELL:+963944123456");
    expect(card).toContain("END:VCARD");
  });

  it("prepares the complete order text for a selected Lahza employee", () => {
    const url = buildEmployeeOrderWhatsAppUrl("+963944123456", {
      id: 42,
      customerName: "أحمد",
      customerPhone: "+963912345678",
      orderType: "delivery",
      taxiType: null,
      pickupLocation: null,
      destination: null,
      paymentMethod: "cash",
      totalAmount: 16,
      deliveryDistanceMeters: 1250,
      deliveryFee: 4,
      lines: [{ itemName: "حمص حب", quantity: 2, unit: "وحدة" }],
    }, "https://maps.google.com/?q=36.5,37.9");
    const message = decodeURIComponent(url);
    expect(message).toContain("طلب لحظة #42");
    expect(message).toContain("الهاتف: +963912345678");
    expect(message).toContain("رسوم التوصيل");
    expect(message).toContain("https://maps.google.com/?q=36.5,37.9");
  });
});
