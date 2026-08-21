export type HomeRoleShortcut = {
  id: "owner" | "supervisor" | "partner";
  label: string;
  detail: string;
  path: string;
};

export function getHomeRoleShortcuts(adminRole?: "owner" | "supervisor", hasPartnerSession = false): HomeRoleShortcut[] {
  const shortcuts: HomeRoleShortcut[] = [];
  if (adminRole === "owner") shortcuts.push({ id: "owner", label: "لوحة التحكم", detail: "إدارة لحظة والمتاجر والطلبات", path: "/admin" });
  if (adminRole === "supervisor") shortcuts.push({ id: "supervisor", label: "لوحة الإشراف", detail: "متابعة الطلبات والتشغيل", path: "/admin" });
  if (hasPartnerSession) shortcuts.push({ id: "partner", label: "متجري", detail: "إدارة منتجاتك وعروضك", path: "/partner/store" });
  return shortcuts;
}
