export type AdminHomeRole = "owner" | "supervisor";

export type AdminHomeShortcut = {
  label: string;
  description: string;
  path: "/admin";
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
