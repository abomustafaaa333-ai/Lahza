export type AdminHomeRole = "owner" | "supervisor";

export type AdminHomeShortcut = {
  label: string;
  description: string;
  path: "/admin" | "/partner/store";
};

export function getAdminHomeShortcut(role: AdminHomeRole | null | undefined): AdminHomeShortcut | null {
  if (role === "owner") {
    return { label: "لوحة التحكم", description: "إدارة لحظة والمتاجر والطلبات", path: "/admin" };
  }

  if (role === "supervisor") {
    return { label: "لوحة الإشراف", description: "متابعة الطلبات والأسعار", path: "/admin" };
  }

  return null;
}

export function getHomeShortcut(input: { adminRole: AdminHomeRole | null | undefined; partnerActive: boolean }): AdminHomeShortcut | null {
  const adminShortcut = getAdminHomeShortcut(input.adminRole);
  if (adminShortcut) {
    return adminShortcut;
  }

  if (input.partnerActive) {
    return { label: "متجري", description: "إدارة منتجاتك وعروضك", path: "/partner/store" };
  }

  return null;
}
