import { describe, expect, it } from "vitest";
import { calculatePointsReward } from "./lahza";

describe("calculatePointsReward", () => {
  it("applies the owner percentage to products only", () => {
    expect(calculatePointsReward(2000, 10)).toBe(200);
  });

  it("never returns a negative or oversized reward", () => {
    expect(calculatePointsReward(200, 100)).toBe(200);
    expect(calculatePointsReward(0, 10)).toBe(0);
    expect(calculatePointsReward(2000, 0)).toBe(0);
  });
});
