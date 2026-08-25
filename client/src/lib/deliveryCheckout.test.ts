import { describe, expect, it } from "vitest";
import { getDeliveryCheckoutGate, MINIMUM_DELIVERY_ORDER_NEW_SYP, remainingDeliveryAmountNewSyp } from "./deliveryCheckout";

describe("الانتقال من السلة إلى تأكيد الطلب", () => {
  it("يرفض فتح التأكيد عندما تكون السلة فارغة", () => {
    expect(getDeliveryCheckoutGate(0, 0)).toMatchObject({ allowed: false, message: expect.stringContaining("السلة فارغة") });
  });

  it("يرفض مجموعاً أقل من 300 ل.س", () => {
    expect(getDeliveryCheckoutGate(1, 5_008)).toMatchObject({ allowed: false, totalNewSyp: 50 });
    expect(remainingDeliveryAmountNewSyp(5_008)).toBe(250);
  });

  it("يسمح بالانتقال المباشر إلى التأكيد عند بلوغ الحد الأدنى", () => {
    expect(getDeliveryCheckoutGate(1, MINIMUM_DELIVERY_ORDER_NEW_SYP * 100)).toEqual({ allowed: true, totalNewSyp: 300 });
  });
});
