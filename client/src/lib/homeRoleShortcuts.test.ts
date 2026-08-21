import { describe, expect, it } from "vitest";
import { getConfirmedHomeRoleShortcuts, getHomeRoleShortcuts } from "./homeRoleShortcuts";

describe("getHomeRoleShortcuts", () => {
  it("يعرض اختصار لوحة التحكم للمالك", () => {
    expect(getHomeRoleShortcuts("owner")).toEqual([{ id: "owner", label: "لوحة التحكم", detail: "إدارة لحظة والمتاجر والطلبات", path: "/admin" }]);
  });

  it("يعرض اختصار لوحة الإشراف للمشرف", () => {
    expect(getHomeRoleShortcuts("supervisor")).toEqual([{ id: "supervisor", label: "لوحة الإشراف", detail: "متابعة الطلبات والتشغيل", path: "/admin" }]);
  });

  it("يعرض اختصار متجري للشريك ويحتفظ بالاختصارات المتزامنة", () => {
    expect(getHomeRoleShortcuts("owner", true).map(item => item.id)).toEqual(["owner", "partner"]);
    expect(getHomeRoleShortcuts(undefined, true)[0]?.path).toBe("/partner/store");
  });

  it("لا يعرض أي اختصار قبل تأكيد جلسات الأدوار أو لزائر عادي", () => {
    expect(getConfirmedHomeRoleShortcuts({ adminRole: "owner", hasPartnerSession: false, sessionsLoading: true })).toEqual([]);
    expect(getConfirmedHomeRoleShortcuts({ hasPartnerSession: false, sessionsLoading: false })).toEqual([]);
  });
});
