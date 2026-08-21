import { describe, expect, it } from "vitest";
import { ORDER_ARCHIVE_AFTER_MS, ORDER_DELETE_AFTER_MS, archiveCutoff, deletionCutoff, isOrderArchived, isOrderExpired } from "./orderLifecycle";

describe("دورة حياة أرشيف الطلبات", () => {
  const now = new Date("2026-08-22T12:00:00.000Z");

  it("ينقل الطلب إلى الأرشيف بعد 24 ساعة كاملة", () => {
    expect(isOrderArchived(new Date(now.getTime() - ORDER_ARCHIVE_AFTER_MS), now)).toBe(true);
    expect(isOrderArchived(new Date(now.getTime() - ORDER_ARCHIVE_AFTER_MS + 1), now)).toBe(false);
    expect(archiveCutoff(now).toISOString()).toBe("2026-08-21T12:00:00.000Z");
  });

  it("يعتبر الطلب منتهياً للحذف بعد سبعة أيام كاملة", () => {
    expect(isOrderExpired(new Date(now.getTime() - ORDER_DELETE_AFTER_MS), now)).toBe(true);
    expect(isOrderExpired(new Date(now.getTime() - ORDER_DELETE_AFTER_MS + 1), now)).toBe(false);
    expect(deletionCutoff(now).toISOString()).toBe("2026-08-15T12:00:00.000Z");
  });
});
