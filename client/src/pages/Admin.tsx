import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { buildEmployeeOrderWhatsAppUrl, buildWhatsAppLocationUrl, mapUrlFromNotes, shareCustomerContact, shareOrderImage } from "@/lib/adminShare";
import { categoryMeta, DEFAULT_TICKER_PRIMARY, DEFAULT_TICKER_SECONDARY, formatSyp, normalizeTickerText, orderStatusLabels, restaurantTypeMeta, storeCategories, toNewSyp, type LahzaCategory, type RestaurantType } from "@shared/lahza";
import { Archive, ArrowRight, BadgeDollarSign, BellRing, CarFront, CheckCircle2, CircleDollarSign, ClipboardList, KeyRound, Loader2, LogOut, MapPinned, Menu, PackagePlus, PackageSearch, Pencil, Phone, RefreshCw, Route, Settings2, Share2, ShieldCheck, Store, Trash2, UserPlus, UsersRound, X, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";

const lahzaWordmarkUrl = "https://lahzaapp-wge8gktc.manus.space/manus-storage/lahza-arabic-wordmark-cropped-v2_315134f0.png";

type Tab = "orders" | "intercityOrders" | "taxiOrders" | "archive" | "catalog" | "expiredOffers" | "stores" | "delivery" | "customers" | "missingProducts" | "employees" | "team" | "partners" | "intercity" | "settings";

function RestaurantTypeSelect({ value, onChange }: { value: RestaurantType; onChange: (value: RestaurantType) => void }) {
  return <select value={value} onChange={event => onChange(event.target.value as RestaurantType)} className="form-select">{(Object.keys(restaurantTypeMeta) as RestaurantType[]).map(type => <option key={type} value={type}>{restaurantTypeMeta[type]}</option>)}</select>;
}

const tabs: { id: Tab; label: string; icon: typeof ClipboardList; ownerOnly?: boolean }[] = [
  { id: "orders", label: "طلبات التوصيل", icon: ClipboardList },
  { id: "intercityOrders", label: "طلبات جرابلس", icon: Route },
  { id: "taxiOrders", label: "طلبات سيارات الأجرة", icon: CarFront },
  { id: "archive", label: "الأرشيف", icon: Archive },
  { id: "catalog", label: "الأسعار", icon: BadgeDollarSign },
  { id: "expiredOffers", label: "عروض منتهية", icon: BellRing },
  { id: "stores", label: "المتاجر", icon: Store, ownerOnly: true },
  { id: "delivery", label: "رسوم التوصيل", icon: MapPinned },
  { id: "customers", label: "الحضور", icon: UsersRound, ownerOnly: true },
  { id: "missingProducts", label: "طلبات خاصة", icon: PackageSearch },
  { id: "employees", label: "موظفو لحظة", icon: UsersRound, ownerOnly: true },
  { id: "team", label: "المشرفون", icon: UsersRound, ownerOnly: true },
  { id: "partners", label: "الشركاء", icon: Store, ownerOnly: true },
  { id: "intercity", label: "رحلات جرابلس", icon: Route, ownerOnly: true },
  { id: "settings", label: "الإعدادات", icon: Settings2, ownerOnly: true },
];

export default function Admin() {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const [tab, setTab] = useState<Tab>("orders");
  const [menuOpen, setMenuOpen] = useState(false);
  const sessionQuery = trpc.lahza.admin.session.useQuery(undefined, { refetchOnMount: "always" });
  const session = sessionQuery.data;
  const logout = trpc.lahza.admin.logout.useMutation({ onSuccess: () => { utils.lahza.admin.session.setData(undefined, null); toast.success("تم تسجيل الخروج من لوحة التحكم"); setLocation("/"); } });
  const isOwner = session?.role === "owner";
  const availableTabs = tabs.filter(item => !item.ownerOnly || isOwner);

  if (sessionQuery.isLoading || (sessionQuery.isFetching && !session)) return <div dir="rtl" className="admin-loading"><Loader2 className="h-7 w-7 animate-spin text-red-600" /><span>جارٍ التحقق من الصلاحيات...</span></div>;
  if (!session) return <div dir="rtl" className="admin-loading"><ShieldCheck className="h-9 w-9 text-blue-900" /><h1>لوحة الإدارة محمية</h1><p>افتحها عبر النقر المزدوج على شعار «لحظة» في الصفحة الرئيسية.</p><Button onClick={() => setLocation("/")} className="mt-3 rounded-xl bg-red-600 hover:bg-red-700"><ArrowRight className="h-4 w-4" /> العودة للرئيسية</Button></div>;

  return <div dir="rtl" className="admin-app">
    <aside className={`admin-sidebar ${menuOpen ? "sidebar-open" : ""}`}>
      <div className="admin-logo"><span className="h-9 w-28 overflow-hidden rounded-xl bg-white"><img src={lahzaWordmarkUrl} alt="لحظة" className="h-9 w-full object-contain" /></span><small>إدارة الخدمات</small></div>
      <div className="admin-role"><ShieldCheck className="h-4 w-4" /><span>{isOwner ? "حساب المالك" : "حساب مشرف"}</span></div>
      <nav>{availableTabs.map(item => { const Icon = item.icon; return <button key={item.id} onClick={() => { setTab(item.id); setMenuOpen(false); }} className={tab === item.id ? "admin-nav-active" : ""}><Icon className="h-4 w-4" /><span>{item.label}</span></button>; })}</nav>
      <div className="admin-sidebar-footer"><Button variant="ghost" onClick={() => logout.mutate()} className="w-full justify-start rounded-xl text-slate-500 hover:bg-red-50 hover:text-red-600"><LogOut className="h-4 w-4" />تسجيل الخروج</Button><span>لحظة · منبج</span></div>
    </aside>
    {menuOpen ? <button className="admin-backdrop" onClick={() => setMenuOpen(false)} aria-label="إغلاق القائمة" /> : null}
    <section className="admin-content">
      <header className="admin-topbar"><button className="admin-menu-button" onClick={() => setMenuOpen(true)}><Menu className="h-5 w-5" /></button><div><p>لوحة التحكم</p><h1>{availableTabs.find(item => item.id === tab)?.label}</h1></div><div className="mr-auto flex items-center gap-2"><button className="admin-home-link mr-0" onClick={() => setLocation("/")}><span>الصفحة الرئيسية</span><ArrowRight className="h-4 w-4" /></button><button type="button" onClick={() => logout.mutate()} disabled={logout.isPending} className="inline-flex items-center gap-1 rounded-lg border border-red-100 bg-red-50 px-2.5 py-2 text-[0.63rem] font-bold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed"><LogOut className="h-4 w-4" /><span>{logout.isPending ? "جارٍ الخروج..." : "تسجيل الخروج"}</span></button></div></header>
      <div className="admin-page">{tab === "orders" ? <OrdersPanel scope="delivery" /> : null}{tab === "intercityOrders" ? <OrdersPanel scope="intercity" /> : null}{tab === "taxiOrders" ? <OrdersPanel scope="taxi" /> : null}{tab === "archive" ? <OrdersPanel scope="archive" /> : null}{tab === "catalog" ? <CatalogPanel /> : null}{tab === "expiredOffers" ? <ExpiredOffersPanel /> : null}{tab === "stores" && isOwner ? <StoresPanel /> : null}{tab === "delivery" ? <DeliverySettingsPanel /> : null}{tab === "customers" && isOwner ? <CustomersPanel /> : null}{tab === "missingProducts" ? <MissingProductRequestsPanel /> : null}{tab === "employees" && isOwner ? <EmployeesPanel /> : null}{tab === "team" && isOwner ? <TeamPanel /> : null}{tab === "partners" && isOwner ? <PartnersPanel /> : null}{tab === "intercity" && isOwner ? <IntercityPanel /> : null}{tab === "settings" && isOwner ? <SettingsPanel /> : null}</div>
    </section>
  </div>;
}

function ExpiredOffersPanel() {
  const utils = trpc.useUtils();
  const offersQuery = trpc.lahza.admin.offers.expired.useQuery();
  const remove = trpc.lahza.admin.offers.removeExpired.useMutation({
    onSuccess: () => { utils.lahza.admin.offers.expired.invalidate(); toast.success("تم حذف العرض وصورته من التخزين السحابي"); },
    onError: error => toast.error(error.message),
  });
  if (offersQuery.isLoading) return <PanelLoading text="جارٍ فحص العروض المنتهية" />;
  const offers = offersQuery.data ?? [];
  return <div className="space-y-5"><section className="admin-section"><div className="admin-section-heading"><div><p>تنبيه إداري</p><h2>العروض المنتهية</h2></div><BellRing className="h-5 w-5 text-red-600" /></div><p className="settings-copy">تُخفى العروض المنتهية من العملاء تلقائياً، بينما تبقى صورها محفوظة حتى يحذفها المالك أو المشرف من هنا يدوياً.</p>{offers.length ? <div className="mt-5 space-y-3">{offers.map(offer => <article key={offer.id} className="rounded-2xl border border-red-100 bg-red-50/40 p-4"><div className="flex gap-3">{offer.imageUrl ? <img src={offer.imageUrl} alt="" className="h-16 w-16 rounded-xl object-cover" /> : <div className="grid h-16 w-16 place-items-center rounded-xl bg-white text-red-400"><BellRing className="h-5 w-5" /></div>}<div className="min-w-0 flex-1"><strong className="block text-sm text-blue-950">{offer.text}</strong><span className="mt-1 block text-xs text-slate-500">{offer.storeName} · {offer.partnerName}</span><span className="mt-1 block text-xs font-bold text-red-600">انتهى في {offer.expiresAt ? new Date(offer.expiresAt).toLocaleDateString("ar-SY", { year: "numeric", month: "long", day: "numeric" }) : "تاريخ غير محدد"}</span></div></div><Button disabled={remove.isPending} onClick={() => { if (confirm(`حذف العرض «${offer.text}» وصورته نهائياً من التخزين السحابي؟`)) remove.mutate({ id: offer.id }); }} className="mt-4 rounded-xl bg-red-600 hover:bg-red-700"><Trash2 className="h-4 w-4" /> حذف العرض والصورة</Button></article>)}</div> : <Empty icon={BellRing} title="لا توجد عروض منتهية" text="ستظهر هنا العروض فور انتهاء مدتها كي تحذفها الإدارة يدوياً." />}</section></div>;
}

type OrderScope = "delivery" | "intercity" | "taxi" | "archive";

const orderScopeCopy: Record<OrderScope, { title: string; eyebrow: string; empty: string }> = {
  delivery: { title: "طلبات التوصيل الحديثة", eyebrow: "متابعة مباشرة", empty: "لا توجد طلبات توصيل حديثة" },
  intercity: { title: "طلبات جرابلس الحديثة", eyebrow: "طلبات مرتبطة بحجز جرابلس", empty: "لا توجد طلبات جرابلس حديثة" },
  taxi: { title: "طلبات سيارات الأجرة الحديثة", eyebrow: "تاكسي وفان", empty: "لا توجد طلبات سيارات أجرة حديثة" },
  archive: { title: "أرشيف الطلبات", eyebrow: "طلبات مضى على إنشائها 24 ساعة أو أكثر", empty: "لا توجد طلبات مؤرشفة حالياً" },
};

function OrdersPanel({ scope }: { scope: OrderScope }) {
  const utils = trpc.useUtils();
  const ordersQuery = trpc.lahza.orders.list.useQuery();
  const employeesQuery = trpc.lahza.admin.employees.list.useQuery();
  const [recipientByOrder, setRecipientByOrder] = useState<Record<number, string>>({});
  const [editingOrderId, setEditingOrderId] = useState<number | null>(null);
  const updateStatus = trpc.lahza.orders.updateStatus.useMutation({ onSuccess: () => { utils.lahza.orders.list.invalidate(); toast.success("تم تحديث حالة الطلب"); }, onError: error => toast.error(error.message) });
  const updateOrder = trpc.lahza.orders.update.useMutation({ onSuccess: () => { utils.lahza.orders.list.invalidate(); setEditingOrderId(null); toast.success("تم حفظ تعديل الطلب"); }, onError: error => toast.error(error.message) });
  if (ordersQuery.isLoading) return <PanelLoading text="جارٍ تحميل الطلبات" />;
  const orders = ordersQuery.data ?? [];
  const employees = (employeesQuery.data ?? []).filter(employee => employee.active);
  const visibleOrders = orders.filter(order => {
    if (scope === "archive") return order.archived;
    if (order.archived) return false;
    if (scope === "taxi") return order.orderType === "taxi";
    if (scope === "intercity") return order.orderType === "delivery" && Boolean(order.intercityTripId);
    return order.orderType === "delivery" && !order.intercityTripId;
  });
  const active = visibleOrders.filter(order => !["completed", "cancelled", "rejected"].includes(order.status));
  const completed = visibleOrders.filter(order => order.status === "completed");
  const copy = orderScopeCopy[scope];
  const announceShare = (result: "native" | "web" | "download", fallback: string) => toast.success(result === "download" ? fallback : "اختر واتساب من نافذة المشاركة");
  const requestStatusChange = (id: number, status: "cancelled" | "rejected") => {
    const label = status === "rejected" ? "رفض" : "إلغاء";
    const reason = window.prompt(`سبب ${label} الطلب (اختياري):`) ?? undefined;
    if (reason === undefined) return;
    updateStatus.mutate({ id, status, reason: reason.trim() || undefined });
  };

  return <div className="space-y-5">
    <section className="admin-overview"><div><span>ضمن هذا القسم</span><strong>{visibleOrders.length}</strong></div><div><span>طلبات حية</span><strong>{active.length}</strong></div><div><span>مكتملة</span><strong>{completed.length}</strong></div></section>
    <section className="admin-section">
      <div className="admin-section-heading"><div><p>{copy.eyebrow}</p><h2>{copy.title}</h2></div>{scope !== "archive" ? <span className="live-dot">محدّث</span> : <span className="admin-note">يُحذف تلقائياً بعد 7 أيام</span>}</div>
      {visibleOrders.length ? <div className="orders-list">{visibleOrders.map(order => {
        const gpsUrl = order.locationUrl || mapUrlFromNotes(order.notes);
        const locationShareUrl = gpsUrl ? buildWhatsAppLocationUrl(order.customerName, gpsUrl) : null;
        const selectedEmployee = employees.find(employee => String(employee.id) === recipientByOrder[order.id]);
        const employeeShareUrl = selectedEmployee ? buildEmployeeOrderWhatsAppUrl(selectedEmployee.phone, order, gpsUrl) : null;
        const isClosed = ["completed", "cancelled", "rejected"].includes(order.status);
        return <article key={order.id} className="order-card">
          <div className="order-card-head"><div><span className="order-number">#{order.id}</span><span className={`status-pill status-${order.status}`}>{orderStatusLabels[order.status]}</span></div><time>{new Date(order.createdAt).toLocaleString("ar-SY", { dateStyle: "medium", timeStyle: "short" })}</time></div>
          <div className="order-customer"><div className="customer-avatar">{order.customerName.slice(0, 1)}</div><div><strong>{order.customerName}</strong><a dir="ltr" href={`tel:${order.customerPhone}`}><Phone className="h-3 w-3" /> {order.customerPhone}</a><div className="order-contact-actions">
            <button type="button" className="contact-share" onClick={async () => { try { announceShare(await shareCustomerContact(order.customerName, order.customerPhone), "تم تنزيل بطاقة جهة الاتصال"); } catch { toast.error("تعذرت مشاركة جهة الاتصال"); } }}><Share2 className="h-3 w-3" /> جهة اتصال</button>
            {locationShareUrl ? <a className="location-share" href={locationShareUrl}><MapPinned className="h-3 w-3" /> مشاركة الموقع</a> : <button type="button" className="location-share" disabled title="الموقع مكتوب يدوياً"><MapPinned className="h-3 w-3" /> موقع يدوي</button>}
            <button type="button" className="image-share" onClick={async () => { try { announceShare(await shareOrderImage(order), "تم تنزيل صورة الطلب"); } catch { toast.error("تعذرت مشاركة صورة الطلب"); } }}><Share2 className="h-3 w-3" /> صورة الطلب</button>
          </div></div><span className="order-kind">{order.orderType === "taxi" ? "سيارة أجرة" : order.intercityTripId ? "جرابلس" : "توصيل"}</span></div>
          {order.orderType === "taxi" ? <div className="order-route"><span>{order.taxiType === "van" ? "فان" : "تاكسي"}</span><b>{order.pickupLocation}</b><ArrowRight className="h-3 w-3" /><b>{order.destination}</b></div> : <div className="order-items">{order.lines.map(line => <span key={line.id}>{line.itemName} <small>× {line.quantity} {line.unit}</small></span>)}</div>}
          {order.locationMode === "manual" && order.locationText ? <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs font-bold text-amber-900"><MapPinned className="ml-1 inline h-3.5 w-3.5" /> موقع مكتوب يدوياً: {order.locationText}</p> : null}
          {order.statusReason ? <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-xs font-bold text-red-700">سبب الحالة: {order.statusReason}</p> : null}
          {order.notes ? <p className="order-notes">{order.notes}</p> : null}
          {!isClosed && scope !== "archive" ? <div className="mt-3 flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => setEditingOrderId(order.id)}><Pencil className="h-3.5 w-3.5" /> تعديل الطلب</Button><Button size="sm" variant="outline" onClick={() => requestStatusChange(order.id, "rejected")} className="border-orange-200 text-orange-700 hover:bg-orange-50"><XCircle className="h-3.5 w-3.5" /> رفض</Button><Button size="sm" variant="outline" onClick={() => requestStatusChange(order.id, "cancelled")} className="border-red-200 text-red-700 hover:bg-red-50"><Trash2 className="h-3.5 w-3.5" /> إلغاء</Button></div> : null}
          {editingOrderId === order.id ? <OrderEditCard order={order} saving={updateOrder.isPending} onClose={() => setEditingOrderId(null)} onSave={values => updateOrder.mutate(values)} /> : null}
          {scope !== "archive" ? <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl bg-slate-50 p-2"><select value={recipientByOrder[order.id] ?? ""} onChange={event => setRecipientByOrder(current => ({ ...current, [order.id]: event.target.value }))} className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs font-bold text-slate-700"><option value="">اختر موظف لحظة لإرسال التفاصيل</option>{employees.map(employee => <option key={employee.id} value={employee.id}>{employee.name} · {employee.phone}</option>)}</select>{employeeShareUrl ? <a href={employeeShareUrl} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white">فتح واتساب للموظف</a> : <button type="button" disabled className="rounded-lg bg-slate-200 px-3 py-2 text-xs font-bold text-slate-400">إرسال للموظف</button>}</div> : null}
          <div className="order-card-footer"><div><span>{order.paymentMethod === "sham_cash" ? "شام كاش" : "نقداً عند الاستلام"}</span>{order.orderType === "delivery" ? <strong>{formatSyp(order.totalAmount)}</strong> : <strong>يحدد السعر لاحقاً</strong>}</div>{scope !== "archive" ? <select value={order.status} onChange={e => updateStatus.mutate({ id: order.id, status: e.target.value as keyof typeof orderStatusLabels })} aria-label="تغيير الحالة">{Object.entries(orderStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select> : <span className="text-xs font-bold text-slate-400">في الأرشيف</span>}</div>
        </article>;
      })}</div> : <Empty icon={scope === "taxi" ? CarFront : scope === "archive" ? Archive : ClipboardList} title={copy.empty} text={scope === "archive" ? "تُنقل الطلبات هنا تلقائياً بعد مرور 24 ساعة، ثم تحذف نهائياً بعد 7 أيام." : "ستظهر الطلبات الجديدة هنا فور إرسالها من التطبيق."} />}
    </section>
  </div>;
}

function OrderEditCard({ order, saving, onClose, onSave }: { order: { id: number; customerName: string; customerPhone: string; paymentMethod: "cash" | "sham_cash"; locationMode: "gps" | "manual"; locationText: string | null; pickupLocation: string | null; destination: string | null; notes: string | null }; saving: boolean; onClose: () => void; onSave: (values: { id: number; customerName: string; customerPhone: string; paymentMethod: "cash" | "sham_cash"; locationMode: "gps" | "manual"; locationText?: string; pickupLocation?: string; destination?: string; notes?: string }) => void }) {
  const [customerName, setCustomerName] = useState(order.customerName);
  const [customerPhone, setCustomerPhone] = useState(order.customerPhone.replace("+963", ""));
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "sham_cash">(order.paymentMethod);
  const [locationMode, setLocationMode] = useState<"gps" | "manual">(order.locationMode);
  const [locationText, setLocationText] = useState(order.locationText ?? "");
  const [pickupLocation, setPickupLocation] = useState(order.pickupLocation ?? "");
  const [destination, setDestination] = useState(order.destination ?? "");
  const [notes, setNotes] = useState(order.notes ?? "");
  return <div className="mt-4 space-y-3 rounded-2xl border border-blue-100 bg-blue-50/50 p-4"><div className="flex items-center justify-between"><strong className="text-sm text-blue-950">تعديل بيانات الطلب</strong><button type="button" onClick={onClose} className="rounded-lg p-1 text-slate-500 hover:bg-white"><X className="h-4 w-4" /></button></div><div className="grid gap-3 md:grid-cols-2"><div><Label>اسم العميل</Label><Input value={customerName} onChange={event => setCustomerName(event.target.value)} /></div><div><Label>رقم الهاتف</Label><Input dir="ltr" value={customerPhone} onChange={event => setCustomerPhone(event.target.value.replace(/\D/g, "").slice(0, 9))} placeholder="9xxxxxxxx" /></div><div><Label>الدفع</Label><select value={paymentMethod} onChange={event => setPaymentMethod(event.target.value as "cash" | "sham_cash")} className="form-select"><option value="cash">نقداً عند الاستلام</option><option value="sham_cash">شام كاش</option></select></div><div><Label>طريقة الموقع</Label><select value={locationMode} onChange={event => setLocationMode(event.target.value as "gps" | "manual")} className="form-select"><option value="gps">الموقع المحدد سابقاً</option><option value="manual">موقع مكتوب يدوياً</option></select></div>{locationMode === "manual" ? <div className="md:col-span-2"><Label>الموقع اليدوي</Label><Input value={locationText} onChange={event => setLocationText(event.target.value)} placeholder="مثال: منبج، قرب دوار الساعة، بجانب الصيدلية" /></div> : null}{order.pickupLocation !== null || order.destination !== null ? <><div><Label>الانطلاق</Label><Input value={pickupLocation} onChange={event => setPickupLocation(event.target.value)} /></div><div><Label>الوجهة</Label><Input value={destination} onChange={event => setDestination(event.target.value)} /></div></> : null}<div className="md:col-span-2"><Label>ملاحظات</Label><Input value={notes} onChange={event => setNotes(event.target.value)} placeholder="أي توضيح خاص بالطلب" /></div></div><div className="flex gap-2"><Button disabled={saving || customerName.trim().length < 2 || customerPhone.length !== 9 || (locationMode === "manual" && locationText.trim().length < 3)} onClick={() => onSave({ id: order.id, customerName: customerName.trim(), customerPhone: `+963${customerPhone}`, paymentMethod, locationMode, locationText: locationMode === "manual" ? locationText.trim() : undefined, pickupLocation: pickupLocation.trim() || undefined, destination: destination.trim() || undefined, notes: notes.trim() || undefined })} className="rounded-xl bg-blue-900 hover:bg-blue-950">{saving ? "جارٍ الحفظ..." : "حفظ التعديل"}</Button><Button variant="outline" onClick={onClose} className="rounded-xl">إلغاء</Button></div></div>;
}

function CustomersPanel() {
  const customersQuery = trpc.lahza.customers.dashboard.useQuery();
  if (customersQuery.isLoading) return <PanelLoading text="جارٍ تحميل بيانات العملاء" />;
  const data = customersQuery.data;
  if (!data) return <Empty icon={UsersRound} title="تعذر تحميل بيانات العملاء" text="أعد فتح هذا القسم أو تحقق من اتصالك." />;
  return <div className="space-y-5"><section className="admin-overview"><div><span>داخل التطبيق الآن</span><strong className="text-emerald-600">{data.activeVisitors}</strong></div><div><span>نافذة النشاط</span><strong className="text-base">دقيقتان</strong></div><div><span>حسابات العملاء</span><strong>ملغاة</strong></div></section><section className="admin-section"><div className="admin-section-heading"><div><p>حضور مباشر</p><h2>المتواجدون في التطبيق</h2></div><Button variant="outline" size="sm" onClick={() => customersQuery.refetch()}><RefreshCw className="h-3.5 w-3.5" /> تحديث</Button></div><p className="text-sm leading-7 text-slate-500">يعرض العداد الأجهزة التي كانت نشطة خلال آخر دقيقتين، من دون حفظ حسابات للعملاء.</p></section></div>;
}

function CatalogPanel() {
  const utils = trpc.useUtils();
  const catalogQuery = trpc.lahza.catalog.list.useQuery();
  const [category, setCategory] = useState<LahzaCategory | "all">("all");
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState<LahzaCategory>("groceries");
  const [newUnit, setNewUnit] = useState<"وحدة" | "جرام" | "ليتر" | "قنينة" | "طلب">("وحدة");
  const [newPrice, setNewPrice] = useState("");
  const refresh = () => utils.lahza.catalog.list.invalidate();
  const create = trpc.lahza.catalog.create.useMutation({ onSuccess: () => { refresh(); setNewName(""); setNewPrice(""); toast.success("تمت إضافة الصنف"); }, onError: error => toast.error(error.message) });
  const update = trpc.lahza.catalog.update.useMutation({ onSuccess: () => { refresh(); toast.success("تم تحديث الصنف"); }, onError: error => toast.error(error.message) });
  const remove = trpc.lahza.catalog.remove.useMutation({ onSuccess: () => { refresh(); toast.success("تم حذف الصنف من القائمة"); }, onError: error => toast.error(error.message) });
  if (catalogQuery.isLoading) return <PanelLoading text="جارٍ تحميل قائمة المنتجات" />;
  const products = (catalogQuery.data ?? []).filter(item => category === "all" || item.category === category);
  const saving = create.isPending || update.isPending || remove.isPending;
  return <div className="space-y-5"><section className="admin-section"><div className="admin-section-heading"><div><p>صلاحية المالك والمشرف</p><h2>إضافة صنف جديد</h2></div><UserPlus className="h-5 w-5 text-red-600" /></div><div className="grid gap-3 md:grid-cols-4"><div><Label>اسم الصنف</Label><Input value={newName} onChange={event => setNewName(event.target.value)} placeholder="مثال: قنينة غاز" /></div><div><Label>القسم</Label><select value={newCategory} onChange={event => setNewCategory(event.target.value as LahzaCategory)} className="form-select">{(Object.keys(categoryMeta) as LahzaCategory[]).map(key => <option key={key} value={key}>{categoryMeta[key].title}</option>)}</select></div><div><Label>وحدة البيع</Label><select value={newUnit} onChange={event => setNewUnit(event.target.value as typeof newUnit)} className="form-select"><option value="وحدة">وحدة</option><option value="جرام">جرام</option><option value="ليتر">ليتر</option><option value="قنينة">قنينة</option><option value="طلب">طلب</option></select></div><div><Label>السعر (ل.س جديدة)</Label><Input inputMode="numeric" value={newPrice} onChange={event => setNewPrice(event.target.value.replace(/\D/g, ""))} placeholder="0" /></div></div><Button disabled={saving || !newName.trim() || newPrice === ""} onClick={() => create.mutate({ name: newName.trim(), category: newCategory, unit: newUnit, price: Number(newPrice), available: true })} className="mt-4 rounded-xl bg-red-600 hover:bg-red-700"><UserPlus className="h-4 w-4" /> إضافة إلى القسم</Button></section><section className="admin-section"><div className="admin-section-heading"><div><p>إدارة الأقسام</p><h2>المنتجات والأسعار</h2></div><span className="admin-note">جميع الأسعار بالليرة السورية الجديدة.</span></div><div className="catalog-filter"><button onClick={() => setCategory("all")} className={category === "all" ? "filter-active" : ""}>الكل</button>{(Object.keys(categoryMeta) as LahzaCategory[]).map(key => <button key={key} onClick={() => setCategory(key)} className={category === key ? "filter-active" : ""}>{categoryMeta[key].title}</button>)}</div><div className="space-y-3">{products.map(product => <CatalogRow key={product.id} product={product} onSave={values => update.mutate(values)} onRemove={() => { if (confirm(`حذف الصنف ${product.name}؟`)) remove.mutate({ id: product.id }); }} saving={saving} />)}</div></section></div>;
}

function StoresPanel() {
  return <PartnerStoreManagement />;

  const utils = trpc.useUtils();
  const storesQuery = trpc.lahza.admin.stores.list.useQuery();
  const catalogQuery = trpc.lahza.catalog.list.useQuery();
  const [newStoreName, setNewStoreName] = useState("");
  const [newStoreCategory, setNewStoreCategory] = useState<LahzaCategory>("groceries");
  const [newStoreOrder, setNewStoreOrder] = useState("0");
  const [selectedStoreId, setSelectedStoreId] = useState<number | null>(null);
  const [productName, setProductName] = useState("");
  const [productUnit, setProductUnit] = useState<"وحدة" | "جرام" | "ليتر" | "قنينة" | "طلب">("وحدة");
  const [productPrice, setProductPrice] = useState("");
  const refresh = () => { utils.lahza.admin.stores.list.invalidate(); utils.lahza.catalog.list.invalidate(); };
  const createStore = trpc.lahza.admin.stores.create.useMutation({ onSuccess: () => { refresh(); setNewStoreName(""); setNewStoreOrder("0"); toast.success("تمت إضافة المتجر"); }, onError: error => toast.error(error.message) });
  const updateStore = trpc.lahza.admin.stores.update.useMutation({ onSuccess: () => { refresh(); toast.success("تم تحديث المتجر"); }, onError: error => toast.error(error.message) });
  const removeStore = trpc.lahza.admin.stores.remove.useMutation({ onSuccess: () => { refresh(); setSelectedStoreId(null); toast.success("تم حذف المتجر"); }, onError: error => toast.error(error.message) });
  const createProduct = trpc.lahza.catalog.create.useMutation({ onSuccess: () => { refresh(); setProductName(""); setProductPrice(""); toast.success("تمت إضافة المنتج إلى المتجر"); }, onError: error => toast.error(error.message) });
  const updateProduct = trpc.lahza.catalog.update.useMutation({ onSuccess: () => { refresh(); toast.success("تم تحديث المنتج"); }, onError: error => toast.error(error.message) });
  const removeProduct = trpc.lahza.catalog.remove.useMutation({ onSuccess: () => { refresh(); toast.success("تم حذف المنتج"); }, onError: error => toast.error(error.message) });
  if (storesQuery.isLoading || catalogQuery.isLoading) return <PanelLoading text="جارٍ تحميل المتاجر ومنتجاتها" />;
  const stores = storesQuery.data ?? [];
  const selectedStore: typeof stores[number] = stores.find(store => store.id === selectedStoreId) ?? stores[0]!;
  const storeProducts = selectedStore ? (catalogQuery.data ?? []).filter(product => product.storeId === selectedStore.id) : [];
  const saving = createStore.isPending || updateStore.isPending || removeStore.isPending || createProduct.isPending || updateProduct.isPending || removeProduct.isPending;
  return <div className="space-y-5"><section className="admin-section"><div className="admin-section-heading"><div><p>صلاحية المالك فقط</p><h2>إضافة متجر جديد</h2></div><Store className="h-5 w-5 text-red-600" /></div><p className="settings-copy">اختر القسم الذي ينتمي إليه المتجر. سيظهر المتجر للعميل عند فتح ذلك القسم فقط.</p><div className="grid gap-3 md:grid-cols-3"><div><Label>اسم المتجر</Label><Input value={newStoreName} onChange={event => setNewStoreName(event.target.value)} placeholder="مثال: حلويات الشام" /></div><div><Label>القسم</Label><select value={newStoreCategory} onChange={event => setNewStoreCategory(event.target.value as LahzaCategory)} className="form-select">{(Object.keys(categoryMeta) as LahzaCategory[]).map(category => <option key={category} value={category}>{categoryMeta[category].title}</option>)}</select></div><div><Label>ترتيب الظهور</Label><Input inputMode="numeric" value={newStoreOrder} onChange={event => setNewStoreOrder(event.target.value.replace(/\D/g, ""))} placeholder="0" /></div></div><Button disabled={createStore.isPending || !newStoreName.trim()} onClick={() => createStore.mutate({ name: newStoreName.trim(), category: newStoreCategory, active: true, sortOrder: Number(newStoreOrder || 0) })} className="mt-4 rounded-xl bg-red-600 hover:bg-red-700"><Store className="h-4 w-4" /> إضافة متجر</Button></section><section className="admin-section"><div className="admin-section-heading"><div><p>الخطوة الأولى للعميل</p><h2>المتاجر الحالية</h2></div><span className="admin-note">اختر متجراً لإدارة منتجاته</span></div>{stores.length ? <div className="grid gap-3 md:grid-cols-2">{stores.map(store => <StoreRow key={store.id} store={store} selected={selectedStore?.id === store.id} saving={saving} onSelect={() => setSelectedStoreId(store.id)} onSave={values => updateStore.mutate(values)} onRemove={() => { if (confirm(`حذف متجر ${store.name}؟ ستبقى منتجاته محفوظة من دون متجر.`)) removeStore.mutate({ id: store.id }); }} />)}</div> : <Empty icon={Store} title="لا توجد متاجر بعد" text="أضف أول متجر ثم أدخل منتجاته. لن يظهر القسم للعميل إلا بعد إضافة متجر إليه." />}</section>{selectedStore ? <section className="admin-section"><div className="admin-section-heading"><div><p>{categoryMeta[selectedStore.category].title}</p><h2>منتجات {selectedStore.name}</h2></div><Button variant="outline" size="sm" onClick={() => setSelectedStoreId(null)}>تغيير المتجر</Button></div><div className="grid gap-3 md:grid-cols-4"><div><Label>اسم المنتج</Label><Input value={productName} onChange={event => setProductName(event.target.value)} placeholder="مثال: كعكة شوكولا" /></div><div><Label>وحدة البيع</Label><select value={productUnit} onChange={event => setProductUnit(event.target.value as typeof productUnit)} className="form-select"><option value="وحدة">وحدة</option><option value="جرام">جرام</option><option value="ليتر">ليتر</option><option value="قنينة">قنينة</option><option value="طلب">طلب</option></select></div><div><Label>السعر (ل.س)</Label><Input inputMode="numeric" value={productPrice} onChange={event => setProductPrice(event.target.value.replace(/\D/g, ""))} placeholder="0" /></div><div className="flex items-end"><Button disabled={createProduct.isPending || !productName.trim() || productPrice === ""} onClick={() => createProduct.mutate({ name: productName.trim(), category: selectedStore.category, storeId: selectedStore.id, unit: productUnit, price: Number(productPrice), available: true })} className="w-full rounded-xl bg-blue-900 hover:bg-blue-950"><UserPlus className="h-4 w-4" /> إضافة المنتج</Button></div></div><div className="mt-5 space-y-3">{storeProducts.length ? storeProducts.map(product => <CatalogRow key={product.id} product={product} onSave={values => updateProduct.mutate({ ...values, storeId: selectedStore.id })} onRemove={() => { if (confirm(`حذف المنتج ${product.name}؟`)) removeProduct.mutate({ id: product.id }); }} saving={saving} />) : <Empty icon={PackageSearch} title="لا توجد منتجات في هذا المتجر" text="أضف أول منتج ليظهر للعميل بعد اختيار المتجر." />}</div></section> : null}</div>;
}

function PartnerStoreManagement() {
  const utils = trpc.useUtils();
  const storesQuery = trpc.lahza.admin.stores.list.useQuery();
  const partnersQuery = trpc.lahza.admin.partners.list.useQuery();
  const catalogQuery = trpc.lahza.catalog.list.useQuery();
  const [name, setName] = useState("");
  const [category, setCategory] = useState<LahzaCategory>("groceries");
  const [restaurantType, setRestaurantType] = useState<RestaurantType>("all");
  const [partnerId, setPartnerId] = useState("");
  const [sortOrder, setSortOrder] = useState("0");
  const [selectedStoreId, setSelectedStoreId] = useState<number | null>(null);
  const [productName, setProductName] = useState("");
  const [productPrice, setProductPrice] = useState("");
  const refresh = () => { utils.lahza.admin.stores.list.invalidate(); utils.lahza.admin.partners.list.invalidate(); utils.lahza.catalog.list.invalidate(); };
  const create = trpc.lahza.admin.stores.create.useMutation({ onSuccess: () => { refresh(); setName(""); setPartnerId(""); setSortOrder("0"); toast.success("تمت إضافة المتجر وتعيين الشريك"); }, onError: error => toast.error(error.message) });
  const update = trpc.lahza.admin.stores.update.useMutation({ onSuccess: () => { refresh(); toast.success("تم تحديث تعيين المتجر"); }, onError: error => toast.error(error.message) });
  const remove = trpc.lahza.admin.stores.remove.useMutation({ onSuccess: () => { refresh(); setSelectedStoreId(null); toast.success("تم حذف المتجر"); }, onError: error => toast.error(error.message) });
  const createProduct = trpc.lahza.catalog.create.useMutation({ onSuccess: () => { refresh(); setProductName(""); setProductPrice(""); toast.success("تمت إضافة المنتج"); }, onError: error => toast.error(error.message) });
  const updateProduct = trpc.lahza.catalog.update.useMutation({ onSuccess: () => { refresh(); toast.success("تم تحديث المنتج"); }, onError: error => toast.error(error.message) });
  const removeProduct = trpc.lahza.catalog.remove.useMutation({ onSuccess: () => { refresh(); toast.success("تم حذف المنتج"); }, onError: error => toast.error(error.message) });
  if (storesQuery.isLoading || partnersQuery.isLoading || catalogQuery.isLoading) return <PanelLoading text="جارٍ تحميل المتاجر والشركاء" />;
  const stores = storesQuery.data ?? [];
  const partners = (partnersQuery.data ?? []).filter(partner => partner.active);
  const selectedStore = stores.find(store => store.id === selectedStoreId) ?? null;
  const productList = selectedStore ? (catalogQuery.data ?? []).filter(product => product.storeId === selectedStore.id) : [];
  const saving = create.isPending || update.isPending || remove.isPending || createProduct.isPending || updateProduct.isPending || removeProduct.isPending;
  return <div className="space-y-5">
    <section className="admin-section">
      <div className="admin-section-heading"><div><p>صلاحية المالك فقط</p><h2>إنشاء متجر وتعيين شريك</h2></div><Store className="h-5 w-5 text-red-600" /></div>
      <p className="settings-copy">اختر الشريك الذي سيدخل إلى هذا المتجر فقط. يمكن ترك المتجر بلا شريك إلى أن تعيّن حساباً مناسباً.</p>
      <div className="grid gap-3 md:grid-cols-4">
        <div><Label>اسم المتجر</Label><Input value={name} onChange={event => setName(event.target.value)} placeholder="مثال: حلويات الشام" /></div>
        <div><Label>القسم</Label><select value={category} onChange={event => setCategory(event.target.value as LahzaCategory)} className="form-select">{(Object.keys(categoryMeta) as LahzaCategory[]).map(key => <option key={key} value={key}>{categoryMeta[key].title}</option>)}</select></div>
        {category === "restaurants" ? <div><Label>نوع المطعم</Label><RestaurantTypeSelect value={restaurantType} onChange={setRestaurantType} /></div> : null}
        <div><Label>الشريك المعيّن</Label><select value={partnerId} onChange={event => setPartnerId(event.target.value)} className="form-select"><option value="">من دون شريك حالياً</option>{partners.map(partner => <option key={partner.id} value={partner.id}>{partner.name} · {partner.username}</option>)}</select></div>
        <div><Label>ترتيب الظهور</Label><Input inputMode="numeric" value={sortOrder} onChange={event => setSortOrder(event.target.value.replace(/\D/g, ""))} /></div>
      </div>
      <Button disabled={create.isPending || !name.trim()} onClick={() => create.mutate({ name: name.trim(), category, restaurantType, partnerId: partnerId ? Number(partnerId) : null, active: true, sortOrder: Number(sortOrder || 0) })} className="mt-4 rounded-xl bg-red-600 hover:bg-red-700"><Store className="h-4 w-4" /> إضافة المتجر</Button>
    </section>
    <section className="admin-section">
      <div className="admin-section-heading"><div><p>صلاحيات المتاجر</p><h2>المتاجر والشركاء المعيّنون</h2></div><span className="admin-note">اختر متجراً لإدارة منتجاته</span></div>
      {stores.length ? <div className="grid gap-3 lg:grid-cols-2">{stores.map(store => <AssignedStoreRow key={store.id} store={store} partners={partners} selected={selectedStore?.id === store.id} saving={saving} onSelect={() => setSelectedStoreId(store.id)} onSave={values => update.mutate(values)} onRemove={() => { if (confirm(`حذف متجر ${store.name}؟`)) remove.mutate({ id: store.id }); }} />)}</div> : <Empty icon={Store} title="لا توجد متاجر بعد" text="أنشئ متجراً ثم عيّن شريكاً له ليتمكن من الدخول وإدارة منتجاته." />}
    </section>
    {selectedStore ? <section className="admin-section">
      <div className="admin-section-heading"><div><p>{categoryMeta[selectedStore.category].title}</p><h2>منتجات {selectedStore.name}</h2></div><Button variant="outline" size="sm" onClick={() => setSelectedStoreId(null)}>تغيير المتجر</Button></div>
      <div className="grid gap-3 md:grid-cols-3"><div><Label>اسم المنتج</Label><Input value={productName} onChange={event => setProductName(event.target.value)} /></div><div><Label>السعر (ل.س جديدة)</Label><Input inputMode="numeric" value={productPrice} onChange={event => setProductPrice(event.target.value.replace(/\D/g, ""))} /></div><div className="flex items-end"><Button disabled={createProduct.isPending || !productName.trim() || productPrice === ""} onClick={() => createProduct.mutate({ name: productName.trim(), category: selectedStore.category, storeId: selectedStore.id, unit: "وحدة", price: Number(productPrice), available: true })} className="w-full rounded-xl bg-blue-900 hover:bg-blue-950"><PackagePlus className="h-4 w-4" /> إضافة المنتج</Button></div></div>
      <div className="mt-5 space-y-3">{productList.length ? productList.map(product => <CatalogRow key={product.id} product={product} onSave={values => updateProduct.mutate({ ...values, storeId: selectedStore.id })} onRemove={() => removeProduct.mutate({ id: product.id })} saving={saving} />) : <Empty icon={PackageSearch} title="لا توجد منتجات في هذا المتجر" text="أضف منتجات للمتجر ليظهر محتواها للعميل وللشريك المعيّن." />}</div>
    </section> : null}
  </div>;
}

function AssignedStoreRow({ store, partners, selected, saving, onSelect, onSave, onRemove }: { store: { id: number; name: string; category: LahzaCategory; restaurantType: RestaurantType; partnerId: number | null; active: boolean; sortOrder: number }; partners: Array<{ id: number; name: string; username: string }>; selected: boolean; saving: boolean; onSelect: () => void; onSave: (values: { id: number; name: string; category: LahzaCategory; restaurantType: RestaurantType; partnerId: number | null; active: boolean; sortOrder: number }) => void; onRemove: () => void }) {
  const [name, setName] = useState(store.name);
  const [category, setCategory] = useState<LahzaCategory>(store.category);
  const [restaurantType, setRestaurantType] = useState<RestaurantType>(store.restaurantType);
  const [partnerId, setPartnerId] = useState(store.partnerId ? String(store.partnerId) : "");
  const [sortOrder, setSortOrder] = useState(String(store.sortOrder));
  const values = (active = store.active) => ({ id: store.id, name: name.trim(), category, restaurantType, partnerId: partnerId ? Number(partnerId) : null, active, sortOrder: Number(sortOrder || 0) });
  return <article className={`rounded-2xl border p-4 ${selected ? "border-blue-300 bg-blue-50" : "border-slate-100 bg-white"}`}>
    <div className="grid gap-2 md:grid-cols-2">
      <div><Label>اسم المتجر</Label><Input value={name} onChange={event => setName(event.target.value)} /></div>
      <div><Label>القسم</Label><select value={category} onChange={event => setCategory(event.target.value as LahzaCategory)} className="form-select">{(Object.keys(categoryMeta) as LahzaCategory[]).map(key => <option key={key} value={key}>{categoryMeta[key].title}</option>)}</select></div>
      {category === "restaurants" ? <div><Label>نوع المطعم</Label><RestaurantTypeSelect value={restaurantType} onChange={setRestaurantType} /></div> : null}
      <div><Label>الشريك المعيّن</Label><select value={partnerId} onChange={event => setPartnerId(event.target.value)} className="form-select"><option value="">من دون شريك</option>{partners.map(partner => <option key={partner.id} value={partner.id}>{partner.name} · {partner.username}</option>)}</select></div>
      <div><Label>ترتيب الظهور</Label><Input inputMode="numeric" value={sortOrder} onChange={event => setSortOrder(event.target.value.replace(/\D/g, ""))} /></div>
    </div>
    <div className="mt-3 flex flex-wrap gap-2"><button type="button" disabled={saving || !name.trim()} onClick={() => onSave(values())} className="rounded-lg bg-blue-50 px-3 py-2 text-xs font-bold text-blue-900">حفظ التعيين</button><button type="button" disabled={saving} onClick={onSelect} className="rounded-lg bg-blue-900 px-3 py-2 text-xs font-bold text-white">إدارة المنتجات</button><button type="button" disabled={saving} onClick={() => onSave(values(!store.active))} className={`rounded-lg px-3 py-2 text-xs font-bold ${store.active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{store.active ? "ظاهر للعميل" : "مخفي عن العميل"}</button><button type="button" disabled={saving} onClick={onRemove} className="rounded-lg bg-red-50 px-3 py-2 text-red-600"><Trash2 className="h-4 w-4" /></button></div>
  </article>;
}

function StoreRow({ store, selected, saving, onSelect, onSave, onRemove }: { store: { id: number; name: string; category: LahzaCategory; active: boolean; sortOrder: number }; selected: boolean; saving: boolean; onSelect: () => void; onSave: (values: { id: number; name: string; category: LahzaCategory; active: boolean; sortOrder: number }) => void; onRemove: () => void }) {
  const [name, setName] = useState(store.name);
  const [category, setCategory] = useState<LahzaCategory>(store.category);
  const [sortOrder, setSortOrder] = useState(String(store.sortOrder));
  return <div className={`rounded-2xl border p-4 ${selected ? "border-blue-300 bg-blue-50" : "border-slate-100 bg-white"}`}><div className="grid gap-2 sm:grid-cols-[1.2fr_1fr_86px_auto_auto]"><Input value={name} onChange={event => setName(event.target.value)} /><select value={category} onChange={event => setCategory(event.target.value as LahzaCategory)} className="form-select">{(Object.keys(categoryMeta) as LahzaCategory[]).map(key => <option key={key} value={key}>{categoryMeta[key].title}</option>)}</select><Input inputMode="numeric" value={sortOrder} onChange={event => setSortOrder(event.target.value.replace(/\D/g, ""))} /><button type="button" disabled={saving || !name.trim()} onClick={() => onSave({ id: store.id, name: name.trim(), category, active: store.active, sortOrder: Number(sortOrder || 0) })} className="rounded-lg bg-blue-50 px-3 py-2 text-xs font-bold text-blue-900">حفظ</button><button type="button" disabled={saving} onClick={onRemove} className="rounded-lg bg-red-50 px-3 py-2 text-red-600"><Trash2 className="h-4 w-4" /></button></div><div className="mt-3 flex flex-wrap items-center gap-2"><button type="button" onClick={onSelect} className="rounded-lg bg-blue-900 px-3 py-2 text-xs font-bold text-white">إدارة المنتجات</button><button type="button" disabled={saving} onClick={() => onSave({ id: store.id, name, category, active: !store.active, sortOrder: Number(sortOrder || 0) })} className={`rounded-lg px-3 py-2 text-xs font-bold ${store.active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{store.active ? "ظاهر للعميل" : "مخفي عن العميل"}</button></div></div>;
}

function CatalogRow({ product, onSave, onRemove, saving }: { product: { id: number; name: string; category: LahzaCategory; unit: string; unitPrice: number; available: boolean }; onSave: (values: { id: number; name: string; category: LahzaCategory; unit: "وحدة" | "جرام" | "ليتر" | "قنينة" | "طلب"; price: number; available: boolean }) => void; onRemove: () => void; saving: boolean }) {
  const [name, setName] = useState(product.name);
  const [category, setCategory] = useState<LahzaCategory>(product.category);
  const [unit, setUnit] = useState<"وحدة" | "جرام" | "ليتر" | "قنينة" | "طلب">(product.unit as "وحدة" | "جرام" | "ليتر" | "قنينة" | "طلب");
  const [price, setPrice] = useState(String(toNewSyp(product.unitPrice)));
  const save = (available = product.available) => onSave({ id: product.id, name: name.trim(), category, unit, price: Number(price || 0), available });
  return <div className="rounded-xl border border-slate-100 p-3"><div className="grid gap-2 md:grid-cols-[1.35fr_1fr_1fr_1fr_auto_auto_auto]"><Input value={name} onChange={event => setName(event.target.value)} /><select value={category} onChange={event => setCategory(event.target.value as LahzaCategory)} className="form-select">{(Object.keys(categoryMeta) as LahzaCategory[]).map(key => <option key={key} value={key}>{categoryMeta[key].title}</option>)}</select><select value={unit} onChange={event => setUnit(event.target.value as typeof unit)} className="form-select"><option value="وحدة">وحدة</option><option value="جرام">جرام</option><option value="ليتر">ليتر</option><option value="قنينة">قنينة</option><option value="طلب">طلب</option></select><div className="price-input"><Input value={price} inputMode="numeric" onChange={event => setPrice(event.target.value.replace(/\D/g, ""))} /><span>ل.س جديدة</span></div><button type="button" disabled={saving || !name.trim()} onClick={() => save()} className="rounded-lg bg-blue-50 px-3 py-2 text-xs font-bold text-blue-900">حفظ</button><button type="button" disabled={saving} onClick={() => save(!product.available)} className={product.available ? "availability-on" : "availability-off"}>{product.available ? "متاح" : "موقوف"}</button><button type="button" disabled={saving} onClick={onRemove} className="rounded-lg bg-red-50 px-3 py-2 text-xs font-bold text-red-600"><Trash2 className="h-4 w-4" /></button></div></div>;
}

function DeliverySettingsPanel() {
  const settingsQuery = trpc.lahza.admin.deliverySettings.get.useQuery();
  const [manbijPercent, setManbijPercent] = useState("");
  const [jarabulusPercent, setJarabulusPercent] = useState("");
  const update = trpc.lahza.admin.deliverySettings.update.useMutation({ onSuccess: () => { settingsQuery.refetch(); toast.success("تم حفظ نسب رسوم التوصيل"); }, onError: error => toast.error(error.message) });
  useEffect(() => {
    if (!settingsQuery.data) return;
    setManbijPercent(String(settingsQuery.data.manbijPercent));
    setJarabulusPercent(String(settingsQuery.data.jarabulusPercent));
  }, [settingsQuery.data]);
  if (settingsQuery.isLoading) return <PanelLoading text="جارٍ تحميل إعدادات التوصيل" />;
  return <section className="admin-section"><div className="admin-section-heading"><div><p>صلاحية المالك والمشرف</p><h2>نسب رسوم التوصيل</h2></div><MapPinned className="h-5 w-5 text-blue-900" /></div><p className="settings-copy">تحسب الرسوم من قيمة المنتجات فقط، ثم تضاف إلى الإجمالي النهائي. لا تدخل رسوم التوصيل في الحد الأدنى البالغ 300 ليرة سورية جديدة.</p><div className="grid gap-3 sm:grid-cols-2"><div><Label>نسبة رسوم طلبات منبج (%)</Label><Input inputMode="numeric" value={manbijPercent} onChange={event => setManbijPercent(event.target.value.replace(/\D/g, ""))} placeholder="15" /></div><div><Label>نسبة رسوم طلبات جرابلس (%)</Label><Input inputMode="numeric" value={jarabulusPercent} onChange={event => setJarabulusPercent(event.target.value.replace(/\D/g, ""))} placeholder="30" /></div></div><Button disabled={update.isPending || !manbijPercent || !jarabulusPercent} onClick={() => update.mutate({ manbijPercent: Number(manbijPercent), jarabulusPercent: Number(jarabulusPercent) })} className="mt-4 rounded-xl bg-blue-900 hover:bg-blue-950"><MapPinned className="h-4 w-4" /> {update.isPending ? "جارٍ الحفظ..." : "حفظ نسب التوصيل"}</Button></section>;
}

function EmployeesPanel() {
  const utils = trpc.useUtils();
  const employeesQuery = trpc.lahza.admin.employees.list.useQuery();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const create = trpc.lahza.admin.employees.create.useMutation({ onSuccess: () => { utils.lahza.admin.employees.list.invalidate(); setName(""); setPhone(""); toast.success("تمت إضافة موظف لحظة"); }, onError: error => toast.error(error.message) });
  const update = trpc.lahza.admin.employees.update.useMutation({ onSuccess: () => { utils.lahza.admin.employees.list.invalidate(); toast.success("تم تحديث بيانات الموظف"); }, onError: error => toast.error(error.message) });
  const remove = trpc.lahza.admin.employees.remove.useMutation({ onSuccess: () => { utils.lahza.admin.employees.list.invalidate(); toast.success("تم حذف الموظف"); }, onError: error => toast.error(error.message) });
  return <div className="space-y-5"><section className="admin-section"><div className="admin-section-heading"><div><p>صلاحية المالك فقط</p><h2>إضافة موظف لحظة</h2></div><UserPlus className="h-5 w-5 text-red-600" /></div><p className="settings-copy">هذه الأرقام تظهر للمشرف والمالك عند اختيار الجهة التي ستُفتح لها رسالة واتساب الجاهزة للطلب.</p><div className="team-form"><div><Label>اسم الموظف</Label><Input value={name} onChange={event => setName(event.target.value)} placeholder="مثال: محمد — مندوب التوصيل" /></div><div><Label>رقم الهاتف السوري</Label><div className="phone-entry" dir="ltr"><span>+963</span><Input inputMode="numeric" value={phone} onChange={event => setPhone(event.target.value.replace(/\D/g, "").slice(0, 9))} placeholder="9XXXXXXXX" /></div></div><Button disabled={create.isPending || !name.trim() || !/^9\d{8}$/.test(phone)} onClick={() => create.mutate({ name: name.trim(), phone: `+963${phone}` })} className="rounded-xl bg-red-600 hover:bg-red-700"><UserPlus className="h-4 w-4" /> إضافة</Button></div></section><section className="admin-section"><div className="admin-section-heading"><div><p>جهات الإرسال المحفوظة</p><h2>موظفو لحظة الحاليون</h2></div></div>{employeesQuery.isLoading ? <PanelLoading text="جارٍ تحميل الموظفين" /> : employeesQuery.data?.length ? <div className="staff-list">{employeesQuery.data.map(employee => <EmployeeRow key={employee.id} employee={employee} saving={update.isPending} onSave={values => update.mutate(values)} onRemove={() => { if (confirm(`حذف الموظف ${employee.name}؟`)) remove.mutate({ id: employee.id }); }} />)}</div> : <Empty icon={UsersRound} title="لا يوجد موظفون محفوظون" text="أضف الأسماء والأرقام التي يريد المدير أو المشرف إرسال الطلبات إليها." />}</section></div>;
}

function EmployeeRow({ employee, saving, onSave, onRemove }: { employee: { id: number; name: string; phone: string; active: boolean }; saving: boolean; onSave: (values: { id: number; name: string; phone: string; active: boolean }) => void; onRemove: () => void }) {
  const [name, setName] = useState(employee.name);
  const [phone, setPhone] = useState(employee.phone.replace(/^\+963/, ""));
  return <div className="rounded-xl border border-slate-100 p-3"><div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto_auto]"><Input value={name} onChange={event => setName(event.target.value)} /><div className="phone-entry" dir="ltr"><span>+963</span><Input inputMode="numeric" value={phone} onChange={event => setPhone(event.target.value.replace(/\D/g, "").slice(0, 9))} /></div><button type="button" onClick={() => onSave({ id: employee.id, name: name.trim(), phone: `+963${phone}`, active: employee.active })} disabled={saving || !name.trim() || !/^9\d{8}$/.test(phone)} className="rounded-lg bg-blue-50 px-3 py-2 text-xs font-bold text-blue-900">حفظ</button><button type="button" onClick={onRemove} className="rounded-lg bg-red-50 px-3 py-2 text-xs font-bold text-red-600">حذف</button></div><button type="button" onClick={() => onSave({ id: employee.id, name, phone: `+963${phone}`, active: !employee.active })} disabled={saving} className={`mt-2 rounded-lg px-3 py-1.5 text-[11px] font-bold ${employee.active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{employee.active ? "نشط للإرسال — اضغط للإيقاف" : "موقوف — اضغط للتفعيل"}</button></div>;
}

function TeamPanel() {
  const utils = trpc.useUtils();
  const staffQuery = trpc.lahza.admin.staff.list.useQuery();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const create = trpc.lahza.admin.staff.create.useMutation({ onSuccess: () => { utils.lahza.admin.staff.list.invalidate(); setUsername(""); setPassword(""); toast.success("تمت إضافة المشرف"); }, onError: error => toast.error(error.message) });
  const remove = trpc.lahza.admin.staff.remove.useMutation({ onSuccess: () => { utils.lahza.admin.staff.list.invalidate(); toast.success("تم حذف حساب المشرف"); }, onError: error => toast.error(error.message) });
  return <div className="space-y-5"><section className="admin-section"><div className="admin-section-heading"><div><p>صلاحية المالك فقط</p><h2>إضافة مشرف جديد</h2></div><UserPlus className="h-5 w-5 text-red-600" /></div><div className="team-form"><div><Label>اسم المستخدم</Label><Input dir="ltr" value={username} onChange={e => setUsername(e.target.value)} placeholder="supervisor_1" /></div><div><Label>كلمة المرور</Label><Input dir="ltr" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="4 أحرف على الأقل" /></div><Button disabled={create.isPending} onClick={() => create.mutate({ username, password })} className="rounded-xl bg-red-600 hover:bg-red-700"><UserPlus className="h-4 w-4" /> إضافة</Button></div></section><section className="admin-section"><div className="admin-section-heading"><div><p>حسابات التشغيل</p><h2>المشرفون الحاليون</h2></div></div>{staffQuery.isLoading ? <PanelLoading text="جارٍ تحميل الحسابات" /> : staffQuery.data?.length ? <div className="staff-list">{staffQuery.data.map(member => <div key={member.id} className="staff-row"><div className="staff-avatar">{member.username.slice(0, 1).toUpperCase()}</div><div><strong dir="ltr">{member.username}</strong><small>{member.active ? "نشط" : "موقوف"} · أُنشئ {new Date(member.createdAt).toLocaleDateString("ar-SY")}</small></div><button onClick={() => { if (confirm(`حذف حساب ${member.username}؟`)) remove.mutate({ id: member.id }); }} aria-label="حذف المشرف"><Trash2 className="h-4 w-4" /></button></div>)}</div> : <Empty icon={UsersRound} title="لا يوجد مشرفون" text="أضف أول مشرف لمنح فريق العمل صلاحيات التشغيل." />}</section></div>;
}

function PartnersPanel() {
  const utils = trpc.useUtils();
  const partnersQuery = trpc.lahza.admin.partners.list.useQuery();
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const create = trpc.lahza.admin.partners.create.useMutation({ onSuccess: () => { utils.lahza.admin.partners.list.invalidate(); setName(""); setUsername(""); setPassword(""); toast.success("تم إنشاء حساب الشريك"); }, onError: error => toast.error(error.message) });
  const update = trpc.lahza.admin.partners.update.useMutation({ onSuccess: () => { utils.lahza.admin.partners.list.invalidate(); toast.success("تم حفظ بيانات الشريك"); }, onError: error => toast.error(error.message) });
  const remove = trpc.lahza.admin.partners.remove.useMutation({ onSuccess: () => { utils.lahza.admin.partners.list.invalidate(); toast.success("تم حذف حساب الشريك"); }, onError: error => toast.error(error.message) });
  return <div className="space-y-5"><section className="admin-section"><div className="admin-section-heading"><div><p>صلاحية المالك فقط</p><h2>تعيين شريك جديد</h2></div><Store className="h-5 w-5 text-red-600" /></div><p className="settings-copy">يحصل الشريك على حساب مستقل لإدارة منتجاته وعروضه وحالة التجهيز، ويدخل من نافذة شعار لحظة في الصفحة الرئيسية من دون رابط منفصل داخل هذه اللوحة.</p><div className="team-form"><div><Label>اسم المتجر</Label><Input value={name} onChange={event => setName(event.target.value)} placeholder="مثال: طعميني" /></div><div><Label>اسم المستخدم</Label><Input dir="ltr" value={username} onChange={event => setUsername(event.target.value)} placeholder="tameeni" /></div><div><Label>كلمة المرور</Label><Input dir="ltr" type="password" value={password} onChange={event => setPassword(event.target.value)} placeholder="4 أحرف على الأقل" /></div><Button disabled={create.isPending || !name.trim() || !username.trim() || password.length < 4} onClick={() => create.mutate({ name: name.trim(), username: username.trim(), password })} className="rounded-xl bg-red-600 hover:bg-red-700"><UserPlus className="h-4 w-4" /> إنشاء الحساب</Button></div></section><section className="admin-section"><div className="admin-section-heading"><div><p>حسابات المتاجر</p><h2>الشركاء الحاليون</h2></div></div>{partnersQuery.isLoading ? <PanelLoading text="جارٍ تحميل الشركاء" /> : partnersQuery.data?.length ? <div className="staff-list">{partnersQuery.data.map(partner => <PartnerRow key={partner.id} partner={partner} saving={update.isPending} onSave={values => update.mutate(values)} onRemove={() => { if (confirm(`حذف حساب ${partner.name}؟`)) remove.mutate({ id: partner.id }); }} />)}</div> : <Empty icon={Store} title="لا توجد حسابات شريك" text="أنشئ حساب المتجر الأول ليتولى إدارة منتجاته وعروضه." />}</section></div>;
}

function PartnerRow({ partner, saving, onSave, onRemove }: { partner: { id: number; name: string; active: boolean; storeOpen: boolean; preparationMinutes: number; username: string }; saving: boolean; onSave: (values: { id: number; name: string; active: boolean; storeOpen: boolean; preparationMinutes: number }) => void; onRemove: () => void }) {
  const [name, setName] = useState(partner.name);
  const [preparationMinutes, setPreparationMinutes] = useState(String(partner.preparationMinutes));
  const save = (patch: Partial<Pick<typeof partner, "active" | "storeOpen">> = {}) => onSave({ id: partner.id, name: name.trim(), active: patch.active ?? partner.active, storeOpen: patch.storeOpen ?? partner.storeOpen, preparationMinutes: Number(preparationMinutes || 0) });
  return <div className="rounded-xl border border-slate-100 p-3"><div className="grid gap-2 md:grid-cols-[1fr_1fr_150px_auto_auto_auto]"><Input value={name} onChange={event => setName(event.target.value)} /><div className="rounded-lg bg-slate-50 px-3 py-2 text-sm font-bold text-slate-600" dir="ltr">{partner.username}</div><Input inputMode="numeric" value={preparationMinutes} onChange={event => setPreparationMinutes(event.target.value.replace(/\D/g, ""))} placeholder="دقائق" /><button type="button" disabled={saving || !name.trim()} onClick={() => save()} className="rounded-lg bg-blue-50 px-3 py-2 text-xs font-bold text-blue-900">حفظ</button><button type="button" disabled={saving} onClick={() => save({ storeOpen: !partner.storeOpen })} className={`rounded-lg px-3 py-2 text-xs font-bold ${partner.storeOpen ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{partner.storeOpen ? "المتجر مفتوح" : "المتجر مغلق"}</button><button type="button" disabled={saving} onClick={onRemove} className="rounded-lg bg-red-50 px-3 py-2 text-red-600"><Trash2 className="h-4 w-4" /></button></div><button type="button" disabled={saving} onClick={() => save({ active: !partner.active })} className={`mt-2 rounded-lg px-3 py-1.5 text-[11px] font-bold ${partner.active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{partner.active ? "الحساب نشط — اضغط للإيقاف" : "الحساب موقوف — اضغط للتفعيل"}</button></div>;
}

const intercityStatusLabel = { open: "مفتوحة للحجز", closed: "مغلقة", dispatching: "انطلقت", arrived: "وصلت" } as const;
const intercityOrderStatusLabel = { new: "بانتظار الشريك", accepted: "قُبل", ready: "جاهز", collected: "ضمن الرحلة", delivered: "تم التسليم", cancelled: "ملغى" } as const;

function IntercityPanel() {
  const utils = trpc.useUtils();
  const tripsQuery = trpc.lahza.admin.intercity.trips.list.useQuery();
  const ordersQuery = trpc.lahza.admin.intercity.orders.list.useQuery();
  const [title, setTitle] = useState("رحلة منبج إلى جرابلس");
  const [close, setClose] = useState("");
  const [arrival, setArrival] = useState("");
  const [capacity, setCapacity] = useState("8");
  const [pickupFee, setPickupFee] = useState("50");
  const [doorstepFee, setDoorstepFee] = useState("100");
  const create = trpc.lahza.admin.intercity.trips.create.useMutation({ onSuccess: () => { utils.lahza.admin.intercity.trips.list.invalidate(); setClose(""); setArrival(""); toast.success("تم إنشاء رحلة جرابلس"); }, onError: error => toast.error(error.message) });
  const updateTrip = trpc.lahza.admin.intercity.trips.update.useMutation({ onSuccess: () => { utils.lahza.admin.intercity.trips.list.invalidate(); toast.success("تم تحديث الرحلة"); }, onError: error => toast.error(error.message) });
  const updateOrder = trpc.lahza.admin.intercity.orders.updateStatus.useMutation({ onSuccess: () => { utils.lahza.admin.intercity.orders.list.invalidate(); toast.success("تم تحديث حالة طلب الرحلة"); }, onError: error => toast.error(error.message) });
  return <div className="space-y-5"><section className="admin-section"><div className="admin-section-heading"><div><p>صلاحية المالك فقط</p><h2>إنشاء رحلة منبج إلى جرابلس</h2></div><Route className="h-5 w-5 text-red-600" /></div><div className="grid gap-3 md:grid-cols-3"><div><Label>اسم الرحلة</Label><Input value={title} onChange={event => setTitle(event.target.value)} /></div><div><Label>إغلاق الحجز</Label><Input value={close} onChange={event => setClose(event.target.value)} placeholder="مثال: مساء الخميس" /></div><div><Label>الوصول المتوقع</Label><Input value={arrival} onChange={event => setArrival(event.target.value)} placeholder="مثال: صباح الجمعة" /></div><div><Label>السعة</Label><Input inputMode="numeric" value={capacity} onChange={event => setCapacity(event.target.value.replace(/\D/g, ""))} /></div><div><Label>رسم نقطة الاستلام (ل.س جديدة)</Label><Input inputMode="numeric" value={pickupFee} onChange={event => setPickupFee(event.target.value.replace(/\D/g, ""))} /></div><div><Label>رسم توصيل العنوان (ل.س جديدة)</Label><Input inputMode="numeric" value={doorstepFee} onChange={event => setDoorstepFee(event.target.value.replace(/\D/g, ""))} /></div></div><Button disabled={create.isPending || !title.trim() || !close.trim() || !arrival.trim() || !capacity} onClick={() => create.mutate({ title: title.trim(), bookingCloseLabel: close.trim(), arrivalLabel: arrival.trim(), capacity: Number(capacity), pickupFee: Number(pickupFee || 0), doorstepFee: Number(doorstepFee || 0), status: "open", active: true })} className="mt-4 rounded-xl bg-red-600 hover:bg-red-700"><Route className="h-4 w-4" /> إنشاء رحلة مفتوحة</Button></section><section className="admin-section"><div className="admin-section-heading"><div><p>تشغيل الرحلة</p><h2>الرحلات الحالية</h2></div></div>{tripsQuery.isLoading ? <PanelLoading text="جارٍ تحميل الرحلات" /> : tripsQuery.data?.length ? <div className="space-y-3">{tripsQuery.data.map(trip => <TripRow key={trip.id} trip={trip} saving={updateTrip.isPending} onSave={values => updateTrip.mutate(values)} />)}</div> : <Empty icon={Route} title="لا توجد رحلات" text="أنشئ أول رحلة لتظهر للعملاء في واجهة جرابلس." />}</section><section className="admin-section"><div className="admin-section-heading"><div><p>متابعة التشغيل</p><h2>طلبات رحلات جرابلس</h2></div></div>{ordersQuery.isLoading ? <PanelLoading text="جارٍ تحميل طلبات الرحلات" /> : ordersQuery.data?.length ? <div className="orders-list">{ordersQuery.data.map(order => <article key={order.id} className="order-card"><div className="order-card-head"><span className="order-number">#{order.id}</span><span className="status-pill status-pending">{intercityOrderStatusLabel[order.status]}</span></div><div className="order-customer"><div className="customer-avatar">{order.customerName.slice(0, 1)}</div><div><strong>{order.customerName}</strong><span dir="ltr" className="mt-1 block text-xs text-slate-500">{order.customerPhone}</span></div><span className="order-kind">جرابلس</span></div><p className="mt-3 text-sm font-bold">{order.itemName} · {order.quantity}</p><p className="mt-1 text-xs text-slate-500">{order.deliveryChoice === "doorstep" ? "توصيل إلى العنوان" : "نقطة استلام"} · رسم الرحلة {formatSyp(order.tripFee)}</p><select value={order.status} onChange={event => updateOrder.mutate({ id: order.id, status: event.target.value as keyof typeof intercityOrderStatusLabel })} className="form-select mt-3"><option value="new">بانتظار الشريك</option><option value="accepted">قُبل</option><option value="ready">جاهز</option><option value="collected">ضمن الرحلة</option><option value="delivered">تم التسليم</option><option value="cancelled">ملغى</option></select></article>)}</div> : <Empty icon={ClipboardList} title="لا توجد طلبات رحلة بعد" text="ستظهر هنا طلبات العملاء فور حجزهم في أي رحلة مفتوحة." />}</section></div>;
}

function TripRow({ trip, saving, onSave }: { trip: { id: number; title: string; bookingCloseLabel: string; arrivalLabel: string; capacity: number; pickupFee: number; doorstepFee: number; status: keyof typeof intercityStatusLabel; active: boolean }; saving: boolean; onSave: (values: { id: number; title: string; bookingCloseLabel: string; arrivalLabel: string; capacity: number; pickupFee: number; doorstepFee: number; status: keyof typeof intercityStatusLabel; active: boolean }) => void }) {
  const [title, setTitle] = useState(trip.title);
  const [close, setClose] = useState(trip.bookingCloseLabel);
  const [arrival, setArrival] = useState(trip.arrivalLabel);
  const [capacity, setCapacity] = useState(String(trip.capacity));
  const [pickupFee, setPickupFee] = useState(String(toNewSyp(trip.pickupFee)));
  const [doorstepFee, setDoorstepFee] = useState(String(toNewSyp(trip.doorstepFee)));
  const [status, setStatus] = useState<keyof typeof intercityStatusLabel>(trip.status);
  const save = (active = trip.active) => onSave({ id: trip.id, title: title.trim(), bookingCloseLabel: close.trim(), arrivalLabel: arrival.trim(), capacity: Number(capacity || 1), pickupFee: Number(pickupFee || 0), doorstepFee: Number(doorstepFee || 0), status, active });
  return <div className="rounded-2xl border border-slate-100 p-4"><div className="grid gap-2 md:grid-cols-3"><Input value={title} onChange={event => setTitle(event.target.value)} /><Input value={close} onChange={event => setClose(event.target.value)} /><Input value={arrival} onChange={event => setArrival(event.target.value)} /><Input inputMode="numeric" value={capacity} onChange={event => setCapacity(event.target.value.replace(/\D/g, ""))} placeholder="السعة" /><Input inputMode="numeric" value={pickupFee} onChange={event => setPickupFee(event.target.value.replace(/\D/g, ""))} placeholder="نقطة استلام" /><Input inputMode="numeric" value={doorstepFee} onChange={event => setDoorstepFee(event.target.value.replace(/\D/g, ""))} placeholder="عنوان" /></div><div className="mt-3 flex flex-wrap gap-2"><select value={status} onChange={event => setStatus(event.target.value as keyof typeof intercityStatusLabel)} className="form-select w-auto"><option value="open">مفتوحة للحجز</option><option value="closed">مغلقة</option><option value="dispatching">انطلقت</option><option value="arrived">وصلت</option></select><Button disabled={saving || !title.trim() || !close.trim() || !arrival.trim()} onClick={() => save()} className="rounded-xl bg-blue-900 hover:bg-blue-950">حفظ الرحلة</Button><button disabled={saving} onClick={() => save(!trip.active)} className={`rounded-xl px-3 py-2 text-xs font-bold ${trip.active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{trip.active ? "ظاهرة للعميل" : "مخفية"}</button></div></div>;
}

function SettingsPanel() {
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const utils = trpc.useUtils();
  const interfaceSettingsQuery = trpc.lahza.admin.interfaceSettings.get.useQuery();
  const [tickerPrimary, setTickerPrimary] = useState("");
  const [tickerSecondary, setTickerSecondary] = useState("");
  const changePin = trpc.lahza.admin.changePin.useMutation({ onSuccess: () => { setCurrentPin(""); setNewPin(""); toast.success("تم تغيير رمز PIN بنجاح"); }, onError: error => toast.error(error.message) });
  const updateInterface = trpc.lahza.admin.interfaceSettings.update.useMutation({ onSuccess: result => { setTickerPrimary(result.tickerPrimary); setTickerSecondary(result.tickerSecondary); utils.lahza.interfaceSettings.get.setData(undefined, { tickerPrimary: result.tickerPrimary, tickerSecondary: result.tickerSecondary }); void utils.lahza.interfaceSettings.get.invalidate(); void interfaceSettingsQuery.refetch(); toast.success("تم حفظ نصي الشريط المتحرك"); }, onError: error => toast.error(error.message) });
  useEffect(() => {
    if (!interfaceSettingsQuery.data) return;
    setTickerPrimary(normalizeTickerText(interfaceSettingsQuery.data.tickerPrimary, DEFAULT_TICKER_PRIMARY));
    setTickerSecondary(normalizeTickerText(interfaceSettingsQuery.data.tickerSecondary, DEFAULT_TICKER_SECONDARY));
  }, [interfaceSettingsQuery.data]);
  return <div className="space-y-5"><section className="admin-section"><div className="admin-section-heading"><div><p>محتوى واجهة العميل</p><h2>الشريطان المتحركان</h2></div><Settings2 className="h-5 w-5 text-red-600" /></div><p className="settings-copy">يظهر النصان في شريط واحد أعلى التطبيق، ويفصل بينهما رمز نجمة تلقائياً.</p>{interfaceSettingsQuery.isLoading ? <PanelLoading text="جارٍ تحميل نصوص الشريط" /> : <div className="pin-form"><div><Label>نص الشريط الأول</Label><Input value={tickerPrimary} onChange={event => setTickerPrimary(event.target.value.slice(0, 220))} placeholder="حقق ١٠ طلبات واربح معنا هدية" /></div><div><Label>نص الشريط الثاني</Label><Input value={tickerSecondary} onChange={event => setTickerSecondary(event.target.value.slice(0, 220))} placeholder="لحظة — منبج بين يديك" /></div><Button disabled={updateInterface.isPending || tickerPrimary.trim().length < 2 || tickerSecondary.trim().length < 2} onClick={() => updateInterface.mutate({ tickerPrimary: tickerPrimary.trim(), tickerSecondary: tickerSecondary.trim() })} className="rounded-xl bg-red-600 hover:bg-red-700"><Settings2 className="h-4 w-4" /> {updateInterface.isPending ? "جارٍ الحفظ..." : "حفظ نصي الشريط"}</Button></div>}</section><section className="admin-section"><div className="admin-section-heading"><div><p>حماية لوحة التحكم</p><h2>تغيير رمز PIN للمالك</h2></div><KeyRound className="h-5 w-5 text-blue-900" /></div><p className="settings-copy">لا تشارك رمز الدخول مع المشرفين. لديهم حسابات مستقلة تُنشأ من هذه اللوحة.</p><div className="pin-form"><div><Label>رمز PIN الحالي</Label><Input type="password" inputMode="numeric" value={currentPin} onChange={e => setCurrentPin(e.target.value)} /></div><div><Label>رمز PIN الجديد</Label><Input type="password" inputMode="numeric" value={newPin} onChange={e => setNewPin(e.target.value)} /></div><Button disabled={changePin.isPending} onClick={() => changePin.mutate({ currentPin, newPin })} className="rounded-xl bg-blue-900 hover:bg-blue-950"><KeyRound className="h-4 w-4" /> حفظ الرمز الجديد</Button></div></section></div>;
}

function MissingProductRequestsPanel() {
  const utils = trpc.useUtils();
  const requestsQuery = trpc.lahza.missingProducts.list.useQuery();
  const updateStatus = trpc.lahza.missingProducts.updateStatus.useMutation({ onSuccess: () => { void utils.lahza.missingProducts.list.invalidate(); toast.success("تم تحديث حالة الطلب الخاص"); }, onError: error => toast.error(error.message) });
  if (requestsQuery.isLoading) return <PanelLoading text="جارٍ تحميل طلبات المنتجات" />;
  const requests = requestsQuery.data ?? [];
  const statusLabel = { new: "جديد", contacted: "تم التواصل", fulfilled: "تم توفيره", closed: "مغلق" } as const;
  return <div className="space-y-5"><section className="admin-section"><div className="admin-section-heading"><div><p>إشارات الطلب من العملاء</p><h2>طلبات المنتجات غير الموجودة</h2></div><PackageSearch className="h-5 w-5 text-red-600" /></div><p className="settings-copy">راجع الطلبات المتكررة قبل إضافة متجر أو قسم جديد. لا تعد العميل بالتوفر قبل تأكيد الشريك.</p>{requests.length ? <div className="space-y-3">{requests.map(request => <article key={request.id} className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><strong className="block text-sm text-blue-950">{request.productName}</strong><span className="mt-1 block text-xs font-bold text-slate-700">{request.customerName}</span><a dir="ltr" href={`tel:${request.customerPhone}`} className="mt-1 inline-flex items-center gap-1 text-xs text-blue-800"><Phone className="h-3 w-3" /> {request.customerPhone}</a>{request.notes ? <p className="mt-2 text-xs leading-6 text-slate-600">{request.notes}</p> : null}<small className="mt-2 block text-[0.68rem] text-slate-400">{new Date(request.createdAt).toLocaleString("ar-SY", { dateStyle: "medium", timeStyle: "short" })}</small></div><select value={request.status} disabled={updateStatus.isPending} onChange={event => updateStatus.mutate({ id: request.id, status: event.target.value as "new" | "contacted" | "fulfilled" | "closed" })} className="form-select w-auto text-xs"><option value="new">{statusLabel.new}</option><option value="contacted">{statusLabel.contacted}</option><option value="fulfilled">{statusLabel.fulfilled}</option><option value="closed">{statusLabel.closed}</option></select></div></article>)}</div> : <Empty icon={PackageSearch} title="لا توجد طلبات خاصة بعد" text="ستظهر هنا المنتجات التي يبحث عنها العملاء ولم يجدوها في الأقسام الحالية." />}</section></div>;
}

function Empty({ icon: Icon, title, text }: { icon: typeof ClipboardList; title: string; text: string }) { return <div className="admin-empty"><Icon className="h-7 w-7" /><h3>{title}</h3><p>{text}</p></div>; }
function PanelLoading({ text }: { text: string }) { return <div className="panel-loading"><Loader2 className="h-5 w-5 animate-spin" />{text}</div>; }
