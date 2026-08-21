import { formatNewSyp, toNewSyp } from "@shared/lahza";

export const MINIMUM_DELIVERY_ORDER_NEW_SYP = 300;

export type DeliveryCheckoutGate =
  | { allowed: true; totalNewSyp: number }
  | { allowed: false; message: string; totalNewSyp: number };

export function getDeliveryCheckoutGate(cartCount: number, totalInLegacySyp: number): DeliveryCheckoutGate {
  const totalNewSyp = toNewSyp(totalInLegacySyp);
  if (cartCount < 1) {
    return { allowed: false, totalNewSyp, message: "السلة فارغة. أضف صنفاً واحداً على الأقل قبل المتابعة." };
  }
  if (totalNewSyp < MINIMUM_DELIVERY_ORDER_NEW_SYP) {
    return {
      allowed: false,
      totalNewSyp,
      message: `الحد الأدنى لمجموع الطلب هو ${formatNewSyp(MINIMUM_DELIVERY_ORDER_NEW_SYP)}. أضف منتجات أخرى قبل المتابعة.`,
    };
  }
  return { allowed: true, totalNewSyp };
}

export function remainingDeliveryAmountNewSyp(totalInLegacySyp: number) {
  return Math.max(0, MINIMUM_DELIVERY_ORDER_NEW_SYP - toNewSyp(totalInLegacySyp));
}
