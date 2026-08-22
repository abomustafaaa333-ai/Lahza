import { describe, expect, it } from "vitest";
import { summarizePartnerReportRows } from "./lahza";

describe("work report aggregation", () => {
  it("summarizes unique orders, excludes cancelled sales, and ranks products", () => {
    const result = summarizePartnerReportRows([
      { orderId: 1, status: "completed", totalAmount: 1200, itemName: "كنافة", quantity: "2" },
      { orderId: 1, status: "completed", totalAmount: 1200, itemName: "قهوة", quantity: "1" },
      { orderId: 2, status: "cancelled", totalAmount: 800, itemName: "كنافة", quantity: "3" },
      { orderId: 3, status: "confirmed", totalAmount: 500, itemName: "قهوة", quantity: "2" },
    ]);

    expect(result.orders).toBe(3);
    expect(result.completed).toBe(1);
    expect(result.cancelled).toBe(1);
    expect(result.sales).toBe(1700);
    expect(result.topProducts).toEqual([
      { name: "كنافة", quantity: 5 },
      { name: "قهوة", quantity: 3 },
    ]);
  });
});
