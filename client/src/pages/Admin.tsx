import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { buildEmployeeOrderWhatsAppUrl, buildWhatsAppLocationUrl, mapUrlFromNotes, shareCustomerContact, shareOrderImage } from "@/lib/adminShare";
import { categoryMeta, DEFAULT_TICKER_PRIMARY, DEFAULT_TICKER_SECONDARY, formatSyp, normalizeTickerText, orderStatusLabels, type LahzaCategory } from "@shared/lahza";
import { ArrowRight, BadgeDollarSign, CheckCircle2, CircleDollarSign, ClipboardList, KeyRound, Loader2, LogOut, MapPinned, Menu, PackageSearch, Phone, RefreshCw, Route, Settings2, Share2, ShieldCheck, Store, Trash2, UserPlus, UsersRound, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";

type Tab = "orders" | "catalog" | "delivery" | "customers" | "employees" | "team" | "partners" | "intercity" | "settings";
const tabs: { id: Tab; label: string; icon: typeof ClipboardList; ownerOnly?: boolean }[] = [
  { id: "orders", label: "الطلبات", icon: ClipboardList },
  { id: "catalog", label: "الأسعار", icon: BadgeDollarSign },
  { id: "delivery", label: "رسوم التوصيل", icon: MapPinned },
  { id: "customers", label: "الحضور", icon: UsersRound, ownerOnly: true },
  { id: "employees", label: "موظفو لحظة", icon: UsersRound, ownerOnly: true },
  { id: "team", label: "المشرفون", icon: UsersRound, ownerOnly: true },
  { id: "partners", label: "الشركاء", icon: Store, ownerOnly: true },
  { id: "intercity", label: "رحلات جرابلس", icon: Route, ownerOnly: true },
  { id: "settings", label: "الإعدادات", icon: Settings2, ownerOnly: true },
];

export default function Admin() {
  const [, setLocation] = useLocation();
  const [tab, setTab] = useState<Tab>("orders");
  const [menuOpen, setMenuOpen] = useState(false);
  const sessionQuery = trpc.lahza.admin.session.useQuery();
  const session = sessionQuery.data;
  const logout = trpc.lahza.admin.logout.useMutation({ onSuccess: () => { toast.success("تم تسجيل الخروج من لوحة التحكم"); setLocation("/"); } });
  const isOwner = session?.role === "owner";
  const availableTabs = tabs.filter(item => !item.ownerOnly || isOwner);

  if (sessionQuery.isLoading) return <div dir="rtl" className="admin-loading"><Loader2 className="h-7 w-7 animate-spin text-red-600" /><span>جارٍ التحقق من الصلاحيات...</span></div>;
  if (!session) return <div dir="rtl" className="admin-loading"><ShieldCheck className="h-9 w-9 text-blue-900" /><h1>لوحة الإدارة محمية</h1><p>افتحها عبر النقر المزدوج على شعار «لحظة» في الصفحة الرئيسية.</p><Button onClick={() => setLocation("/")} className="mt-3 rounded-xl bg-red-600 hover:bg-red-700"><ArrowRight className="h-4 w-4" /> العودة للرئيسية</Button></div>;

  return <div dir="rtl" className="admin-app">
    <aside className={`admin-sidebar ${menuOpen ? "sidebar-open" : ""}`}>
      <div className="admin-logo"><span className="brand-dot" /><span>لحظة</span><small>إدارة الخدمات</small></div>
      <div className="admin-role"><ShieldCheck className="h-4 w-4" /><span>{isOwner ? "حساب المالك" : "حساب مشرف"}</span></div>
      <nav>{availableTabs.map(item => { const Icon = item.icon; return <button key={item.id} onClick={() => { setTab(item.id); setMenuOpen(false); }} className={tab === item.id ? "admin-nav-active" : ""}><Icon className="h-4 w-4" /><span>{item.label}</span></button>; })}</nav>
      <div className="admin-sidebar-footer"><Button variant="ghost" onClick={() => logout.mutate()} className="w-full justify-start rounded-xl text-slate-500 hover:bg-red-50 hover:text-red-600"><LogOut className="h-4 w-4" />تسجيل الخروج</Button><span>لحظة · منبج</span></div>
    </aside>
    {menuOpen ? <button className="admin-backdrop" onClick={() => setMenuOpen(false)} aria-label="إغلاق القائمة" /> : null}
    <section className="admin-content">
      <header className="admin-topbar"><button className="admin-menu-button" onClick={() => setMenuOpen(true)}><Menu className="h-5 w-5" /></button><div><p>لوحة التحكم</p><h1>{availableTabs.find(item => item.id === tab)?.label}</h1></div><button className="admin-home-link" onClick={() => setLocation("/")}><span>واجهة العميل</span><ArrowRight className="h-4 w-4" /></button></header>
      <div className="admin-page">{tab === "orders" ? <OrdersPanel /> : null}{tab === "catalog" ? <CatalogPanel /> : null}{tab === "delivery" ? <DeliverySettingsPanel /> : null}{tab === "customers" && isOwner ? <CustomersPanel /> : null}{tab === "employees" && isOwner ? <EmployeesPanel /> : null}{tab === "team" && isOwner ? <TeamPanel /> : null}{tab === "partners" && isOwner ? <PartnersPanel /> : null}{tab === "intercity" && isOwner ? <IntercityPanel /> : null}{tab === "settings" && isOwner ? <SettingsPanel /> : null}</div>
    </section>
  </div>;
}

function OrdersPanel() {
  const utils = trpc.useUtils();
  const ordersQuery = trpc.lahza.orders.list.useQuery();
  const employeesQuery = trpc.lahza.admin.employees.list.useQuery();
  const [recipientByOrder, setRecipientByOrder] = useState<Record<number, string>>({});
  const updateStatus = trpc.lahza.orders.updateStatus.useMutation({ onSuccess: () => { utils.lahza.orders.list.invalidate(); toast.success("تم تحديث حالة الطلب"); }, onError: error => toast.error(error.message) });
  if (ordersQuery.isLoading) return <PanelLoading text="جارٍ تحميل الطلبات" />;
  const orders = ordersQuery.data ?? [];
  const employees = (employeesQuery.data ?? []).filter(employee => employee.active);
  const active = orders.filter(order => !["completed", "cancelled"].includes(order.status));
  const announceShare = (result: "native" | "web" | "download", fallback: string) => toast.success(result === "download" ? fallback : "اختر واتساب من نافذة المشاركة");

  return <div className="space-y-5">
    <section className="admin-overview"><div><span>إجمالي الطلبات</span><strong>{orders.length}</strong></div><div><span>طلبات حية</span><strong>{active.length}</strong></div><div><span>مكتملة</span><strong>{orders.filter(order => order.status === "completed").length}</strong></div></section>
    <section className="admin-section">
      <div className="admin-section-heading"><div><p>متابعة مباشرة</p><h2>الطلبات الواردة</h2></div><span className="live-dot">محدّث</span></div>
      {orders.length ? <div className="orders-list">{orders.map(order => {
        const mapUrl = mapUrlFromNotes(order.notes);
        const locationShareUrl = mapUrl ? buildWhatsAppLocationUrl(order.customerName, mapUrl) : null;
        const selectedEmployee = employees.find(employee => String(employee.id) === recipientByOrder[order.id]);
        const employeeShareUrl = selectedEmployee ? buildEmployeeOrderWhatsAppUrl(selectedEmployee.phone, order, mapUrl) : null;
        return <article key={order.id} className="order-card">
          <div className="order-card-head"><div><span className="order-number">#{order.id}</span><span className={`status-pill status-${order.status}`}>{orderStatusLabels[order.status]}</span></div><time>{new Date(order.createdAt).toLocaleString("ar-SY", { dateStyle: "medium", timeStyle: "short" })}</time></div>
          <div className="order-customer"><div className="customer-avatar">{order.customerName.slice(0, 1)}</div><div><strong>{order.customerName}</strong><a dir="ltr" href={`tel:${order.customerPhone}`}><Phone className="h-3 w-3" /> {order.customerPhone}</a><div className="order-contact-actions">
            <button type="button" className="contact-share" onClick={async () => { try { announceShare(await shareCustomerContact(order.customerName, order.customerPhone), "تم تنزيل بطاقة جهة الاتصال"); } catch { toast.error("تعذرت مشاركة جهة الاتصال"); } }}><Share2 className="h-3 w-3" /> جهة اتصال</button>
            {locationShareUrl ? <a className="location-share" href={locationShareUrl}><MapPinned className="h-3 w-3" /> مشاركة الموقع</a> : <button type="button" className="location-share" disabled title="لم يتوفر رابط GPS صالح لهذا الطلب"><MapPinned className="h-3 w-3" /> مشاركة الموقع</button>}
            <button type="button" className="image-share" onClick={async () => { try { announceShare(await shareOrderImage(order), "تم تنزيل صورة الطلب"); } catch { toast.error("تعذرت مشاركة صورة الطلب"); } }}><Share2 className="h-3 w-3" /> صورة الطلب</button>
          </div></div><span className="order-kind">{order.orderType === "taxi" ? "سيارة أجرة" : "توصيل"}</span></div>
          {order.orderType === "taxi" ? <div className="order-route"><span>{order.taxiType === "van" ? "فان" : "تاكسي"}</span><b>{order.pickupLocation}</b><ArrowRight className="h-3 w-3" /><b>{order.destination}</b></div> : <div className="order-items">{order.lines.map(line => <span key={line.id}>{line.itemName} <small>× {line.quantity} {line.unit}</small></span>)}</div>}
          {order.orderType === "delivery" && order.deliveryDistanceMeters > 0 ? <div className="mt-3 flex items-center justify-between rounded-lg bg-blue-50 px-3 py-2 text-xs font-bold text-blue-950"><span>مسافة الطريق {(order.deliveryDistanceMeters / 1000).toFixed(1)} كم</span><span>رسوم التوصيل {formatSyp(order.deliveryFee)}</span></div> : null}
          {order.notes ? <p className="order-notes">{order.notes}</p> : null}
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl bg-slate-50 p-2"><select value={recipientByOrder[order.id] ?? ""} onChange={event => setRecipientByOrder(current => ({ ...current, [order.id]: event.target.value }))} className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs font-bold text-slate-700"><option value="">اختر موظف لحظة لإرسال التفاصيل</option>{employees.map(employee => <option key={employee.id} value={employee.id}>{employee.name} · {employee.phone}</option>)}</select>{employeeShareUrl ? <a href={employeeShareUrl} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white">فتح واتساب للموظف</a> : <button type="button" disabled className="rounded-lg bg-slate-200 px-3 py-2 text-xs font-bold text-slate-400">إرسال للموظف</button>}</div>
          <div className="order-card-footer"><div><span>{order.paymentMethod === "sham_cash" ? "شام كاش" : "نقداً عند الاستلام"}</span>{order.orderType === "delivery" ? <strong>{formatSyp(order.totalAmount)}</strong> : <strong>يحدد السعر لاحقاً</strong>}</div><select value={order.status} onChange={e => updateStatus.mutate({ id: order.id, status: e.target.value as keyof typeof orderStatusLabels })} aria-label="تغيير الحالة">{Object.entries(orderStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
        </article>;
      })}</div> : <Empty icon={ClipboardList} title="لا توجد طلبات بعد" text="ستظهر الطلبات الجديدة هنا فور إرسالها من التطبيق." />}
    </section>
  </div>;
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
  return <div className="space-y-5"><section className="admin-section"><div className="admin-section-heading"><div><p>صلاحية المالك والمشرف</p><h2>إضافة صنف جديد</h2></div><UserPlus className="h-5 w-5 text-red-600" /></div><div className="grid gap-3 md:grid-cols-4"><div><Label>اسم الصنف</Label><Input value={newName} onChange={event => setNewName(event.target.value)} placeholder="مثال: قنينة غاز" /></div><div><Label>القسم</Label><select value={newCategory} onChange={event => setNewCategory(event.target.value as LahzaCategory)} className="form-select">{(Object.keys(categoryMeta) as LahzaCategory[]).map(key => <option key={key} value={key}>{categoryMeta[key].title}</option>)}</select></div><div><Label>وحدة البيع</Label><select value={newUnit} onChange={event => setNewUnit(event.target.value as typeof newUnit)} className="form-select"><option value="وحدة">وحدة</option><option value="جرام">جرام</option><option value="ليتر">ليتر</option><option value="قنينة">قنينة</option><option value="طلب">طلب</option></select></div><div><Label>السعر (ل.س)</Label><Input inputMode="numeric" value={newPrice} onChange={event => setNewPrice(event.target.value.replace(/\D/g, ""))} placeholder="0" /></div></div><Button disabled={saving || !newName.trim() || newPrice === ""} onClick={() => create.mutate({ name: newName.trim(), category: newCategory, unit: newUnit, price: Number(newPrice), available: true })} className="mt-4 rounded-xl bg-red-600 hover:bg-red-700"><UserPlus className="h-4 w-4" /> إضافة إلى القسم</Button></section><section className="admin-section"><div className="admin-section-heading"><div><p>إدارة الأقسام</p><h2>المنتجات والأسعار</h2></div><span className="admin-note">عدّل أو احذف أي صنف حسب القسم</span></div><div className="catalog-filter"><button onClick={() => setCategory("all")} className={category === "all" ? "filter-active" : ""}>الكل</button>{(Object.keys(categoryMeta) as LahzaCategory[]).map(key => <button key={key} onClick={() => setCategory(key)} className={category === key ? "filter-active" : ""}>{categoryMeta[key].title}</button>)}</div><div className="space-y-3">{products.map(product => <CatalogRow key={product.id} product={product} onSave={values => update.mutate(values)} onRemove={() => { if (confirm(`حذف الصنف ${product.name}؟`)) remove.mutate({ id: product.id }); }} saving={saving} />)}</div></section></div>;
}

function CatalogRow({ product, onSave, onRemove, saving }: { product: { id: number; name: string; category: LahzaCategory; unit: string; unitPrice: number; available: boolean }; onSave: (values: { id: number; name: string; category: LahzaCategory; unit: "وحدة" | "جرام" | "ليتر" | "قنينة" | "طلب"; price: number; available: boolean }) => void; onRemove: () => void; saving: boolean }) {
  const [name, setName] = useState(product.name);
  const [category, setCategory] = useState<LahzaCategory>(product.category);
  const [unit, setUnit] = useState<"وحدة" | "جرام" | "ليتر" | "قنينة" | "طلب">(product.unit as "وحدة" | "جرام" | "ليتر" | "قنينة" | "طلب");
  const [price, setPrice] = useState(String(product.unitPrice));
  const save = (available = product.available) => onSave({ id: product.id, name: name.trim(), category, unit, price: Number(price || 0), available });
  return <div className="rounded-xl border border-slate-100 p-3"><div className="grid gap-2 md:grid-cols-[1.35fr_1fr_1fr_1fr_auto_auto_auto]"><Input value={name} onChange={event => setName(event.target.value)} /><select value={category} onChange={event => setCategory(event.target.value as LahzaCategory)} className="form-select">{(Object.keys(categoryMeta) as LahzaCategory[]).map(key => <option key={key} value={key}>{categoryMeta[key].title}</option>)}</select><select value={unit} onChange={event => setUnit(event.target.value as typeof unit)} className="form-select"><option value="وحدة">وحدة</option><option value="جرام">جرام</option><option value="ليتر">ليتر</option><option value="قنينة">قنينة</option><option value="طلب">طلب</option></select><div className="price-input"><Input value={price} inputMode="numeric" onChange={event => setPrice(event.target.value.replace(/\D/g, ""))} /><span>ل.س</span></div><button type="button" disabled={saving || !name.trim()} onClick={() => save()} className="rounded-lg bg-blue-50 px-3 py-2 text-xs font-bold text-blue-900">حفظ</button><button type="button" disabled={saving} onClick={() => save(!product.available)} className={product.available ? "availability-on" : "availability-off"}>{product.available ? "متاح" : "موقوف"}</button><button type="button" disabled={saving} onClick={onRemove} className="rounded-lg bg-red-50 px-3 py-2 text-xs font-bold text-red-600"><Trash2 className="h-4 w-4" /></button></div></div>;
}

function DeliverySettingsPanel() {
  const settingsQuery = trpc.lahza.admin.deliverySettings.get.useQuery();
  const [pricePerKm, setPricePerKm] = useState("");
  const [originLat, setOriginLat] = useState("");
  const [originLng, setOriginLng] = useState("");
  const update = trpc.lahza.admin.deliverySettings.update.useMutation({ onSuccess: () => { settingsQuery.refetch(); toast.success("تم حفظ رسوم التوصيل ونقطة الانطلاق"); }, onError: error => toast.error(error.message) });
  useEffect(() => {
    if (!settingsQuery.data) return;
    setPricePerKm(String(settingsQuery.data.pricePerKm));
    setOriginLat(String(settingsQuery.data.originLat));
    setOriginLng(String(settingsQuery.data.originLng));
  }, [settingsQuery.data]);
  if (settingsQuery.isLoading) return <PanelLoading text="جارٍ تحميل إعدادات التوصيل" />;
  return <section className="admin-section"><div className="admin-section-heading"><div><p>صلاحية المالك والمشرف</p><h2>رسوم التوصيل والمسافة</h2></div><MapPinned className="h-5 w-5 text-blue-900" /></div><p className="settings-copy">يحسب التطبيق مسافة طريق فعلية من نقطة الانطلاق إلى العميل، ثم يقرّب أي جزء من الكيلومتر إلى كيلومتر فوترة كامل.</p><div className="grid gap-3 sm:grid-cols-3"><div><Label>سعر الكيلومتر (ل.س)</Label><Input inputMode="numeric" value={pricePerKm} onChange={event => setPricePerKm(event.target.value.replace(/[^0-9]/g, ""))} /></div><div><Label>خط العرض — مركز منبج</Label><Input dir="ltr" inputMode="decimal" value={originLat} onChange={event => setOriginLat(event.target.value)} /></div><div><Label>خط الطول — مركز منبج</Label><Input dir="ltr" inputMode="decimal" value={originLng} onChange={event => setOriginLng(event.target.value)} /></div></div><Button disabled={update.isPending || !pricePerKm || !originLat || !originLng} onClick={() => update.mutate({ pricePerKm: Number(pricePerKm), originLat: Number(originLat), originLng: Number(originLng) })} className="mt-4 rounded-xl bg-blue-900 hover:bg-blue-950"><MapPinned className="h-4 w-4" /> {update.isPending ? "جارٍ الحفظ..." : "حفظ إعدادات التوصيل"}</Button></section>;
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
  return <div className="space-y-5"><section className="admin-section"><div className="admin-section-heading"><div><p>صلاحية المالك فقط</p><h2>تعيين شريك جديد</h2></div><Store className="h-5 w-5 text-red-600" /></div><p className="settings-copy">يحصل الشريك على حساب مستقل عبر المسار <b dir="ltr">/partner</b> لإدارة منتجاته وعروضه وحالة التجهيز، من دون الوصول إلى لوحة المالك.</p><div className="team-form"><div><Label>اسم المتجر</Label><Input value={name} onChange={event => setName(event.target.value)} placeholder="مثال: طعميني" /></div><div><Label>اسم المستخدم</Label><Input dir="ltr" value={username} onChange={event => setUsername(event.target.value)} placeholder="tameeni" /></div><div><Label>كلمة المرور</Label><Input dir="ltr" type="password" value={password} onChange={event => setPassword(event.target.value)} placeholder="4 أحرف على الأقل" /></div><Button disabled={create.isPending || !name.trim() || !username.trim() || password.length < 4} onClick={() => create.mutate({ name: name.trim(), username: username.trim(), password })} className="rounded-xl bg-red-600 hover:bg-red-700"><UserPlus className="h-4 w-4" /> إنشاء الحساب</Button></div></section><section className="admin-section"><div className="admin-section-heading"><div><p>حسابات المتاجر</p><h2>الشركاء الحاليون</h2></div></div>{partnersQuery.isLoading ? <PanelLoading text="جارٍ تحميل الشركاء" /> : partnersQuery.data?.length ? <div className="staff-list">{partnersQuery.data.map(partner => <PartnerRow key={partner.id} partner={partner} saving={update.isPending} onSave={values => update.mutate(values)} onRemove={() => { if (confirm(`حذف حساب ${partner.name}؟`)) remove.mutate({ id: partner.id }); }} />)}</div> : <Empty icon={Store} title="لا توجد حسابات شريك" text="أنشئ حساب المتجر الأول ليتولى إدارة منتجاته وعروضه." />}</section></div>;
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
  const [pickupFee, setPickupFee] = useState("5000");
  const [doorstepFee, setDoorstepFee] = useState("10000");
  const create = trpc.lahza.admin.intercity.trips.create.useMutation({ onSuccess: () => { utils.lahza.admin.intercity.trips.list.invalidate(); setClose(""); setArrival(""); toast.success("تم إنشاء رحلة جرابلس"); }, onError: error => toast.error(error.message) });
  const updateTrip = trpc.lahza.admin.intercity.trips.update.useMutation({ onSuccess: () => { utils.lahza.admin.intercity.trips.list.invalidate(); toast.success("تم تحديث الرحلة"); }, onError: error => toast.error(error.message) });
  const updateOrder = trpc.lahza.admin.intercity.orders.updateStatus.useMutation({ onSuccess: () => { utils.lahza.admin.intercity.orders.list.invalidate(); toast.success("تم تحديث حالة طلب الرحلة"); }, onError: error => toast.error(error.message) });
  return <div className="space-y-5"><section className="admin-section"><div className="admin-section-heading"><div><p>صلاحية المالك فقط</p><h2>إنشاء رحلة منبج إلى جرابلس</h2></div><Route className="h-5 w-5 text-red-600" /></div><div className="grid gap-3 md:grid-cols-3"><div><Label>اسم الرحلة</Label><Input value={title} onChange={event => setTitle(event.target.value)} /></div><div><Label>إغلاق الحجز</Label><Input value={close} onChange={event => setClose(event.target.value)} placeholder="مثال: مساء الخميس" /></div><div><Label>الوصول المتوقع</Label><Input value={arrival} onChange={event => setArrival(event.target.value)} placeholder="مثال: صباح الجمعة" /></div><div><Label>السعة</Label><Input inputMode="numeric" value={capacity} onChange={event => setCapacity(event.target.value.replace(/\D/g, ""))} /></div><div><Label>رسم نقطة الاستلام</Label><Input inputMode="numeric" value={pickupFee} onChange={event => setPickupFee(event.target.value.replace(/\D/g, ""))} /></div><div><Label>رسم توصيل العنوان</Label><Input inputMode="numeric" value={doorstepFee} onChange={event => setDoorstepFee(event.target.value.replace(/\D/g, ""))} /></div></div><Button disabled={create.isPending || !title.trim() || !close.trim() || !arrival.trim() || !capacity} onClick={() => create.mutate({ title: title.trim(), bookingCloseLabel: close.trim(), arrivalLabel: arrival.trim(), capacity: Number(capacity), pickupFee: Number(pickupFee || 0), doorstepFee: Number(doorstepFee || 0), status: "open", active: true })} className="mt-4 rounded-xl bg-red-600 hover:bg-red-700"><Route className="h-4 w-4" /> إنشاء رحلة مفتوحة</Button></section><section className="admin-section"><div className="admin-section-heading"><div><p>تشغيل الرحلة</p><h2>الرحلات الحالية</h2></div></div>{tripsQuery.isLoading ? <PanelLoading text="جارٍ تحميل الرحلات" /> : tripsQuery.data?.length ? <div className="space-y-3">{tripsQuery.data.map(trip => <TripRow key={trip.id} trip={trip} saving={updateTrip.isPending} onSave={values => updateTrip.mutate(values)} />)}</div> : <Empty icon={Route} title="لا توجد رحلات" text="أنشئ أول رحلة لتظهر للعملاء في واجهة جرابلس." />}</section><section className="admin-section"><div className="admin-section-heading"><div><p>متابعة التشغيل</p><h2>طلبات رحلات جرابلس</h2></div></div>{ordersQuery.isLoading ? <PanelLoading text="جارٍ تحميل طلبات الرحلات" /> : ordersQuery.data?.length ? <div className="orders-list">{ordersQuery.data.map(order => <article key={order.id} className="order-card"><div className="order-card-head"><span className="order-number">#{order.id}</span><span className="status-pill status-pending">{intercityOrderStatusLabel[order.status]}</span></div><div className="order-customer"><div className="customer-avatar">{order.customerName.slice(0, 1)}</div><div><strong>{order.customerName}</strong><span dir="ltr" className="mt-1 block text-xs text-slate-500">{order.customerPhone}</span></div><span className="order-kind">جرابلس</span></div><p className="mt-3 text-sm font-bold">{order.itemName} · {order.quantity}</p><p className="mt-1 text-xs text-slate-500">{order.deliveryChoice === "doorstep" ? "توصيل إلى العنوان" : "نقطة استلام"} · رسم الرحلة {formatSyp(order.tripFee)}</p><select value={order.status} onChange={event => updateOrder.mutate({ id: order.id, status: event.target.value as keyof typeof intercityOrderStatusLabel })} className="form-select mt-3"><option value="new">بانتظار الشريك</option><option value="accepted">قُبل</option><option value="ready">جاهز</option><option value="collected">ضمن الرحلة</option><option value="delivered">تم التسليم</option><option value="cancelled">ملغى</option></select></article>)}</div> : <Empty icon={ClipboardList} title="لا توجد طلبات رحلة بعد" text="ستظهر هنا طلبات العملاء فور حجزهم في أي رحلة مفتوحة." />}</section></div>;
}

function TripRow({ trip, saving, onSave }: { trip: { id: number; title: string; bookingCloseLabel: string; arrivalLabel: string; capacity: number; pickupFee: number; doorstepFee: number; status: keyof typeof intercityStatusLabel; active: boolean }; saving: boolean; onSave: (values: { id: number; title: string; bookingCloseLabel: string; arrivalLabel: string; capacity: number; pickupFee: number; doorstepFee: number; status: keyof typeof intercityStatusLabel; active: boolean }) => void }) {
  const [title, setTitle] = useState(trip.title);
  const [close, setClose] = useState(trip.bookingCloseLabel);
  const [arrival, setArrival] = useState(trip.arrivalLabel);
  const [capacity, setCapacity] = useState(String(trip.capacity));
  const [pickupFee, setPickupFee] = useState(String(trip.pickupFee));
  const [doorstepFee, setDoorstepFee] = useState(String(trip.doorstepFee));
  const [status, setStatus] = useState<keyof typeof intercityStatusLabel>(trip.status);
  const save = (active = trip.active) => onSave({ id: trip.id, title: title.trim(), bookingCloseLabel: close.trim(), arrivalLabel: arrival.trim(), capacity: Number(capacity || 1), pickupFee: Number(pickupFee || 0), doorstepFee: Number(doorstepFee || 0), status, active });
  return <div className="rounded-2xl border border-slate-100 p-4"><div className="grid gap-2 md:grid-cols-3"><Input value={title} onChange={event => setTitle(event.target.value)} /><Input value={close} onChange={event => setClose(event.target.value)} /><Input value={arrival} onChange={event => setArrival(event.target.value)} /><Input inputMode="numeric" value={capacity} onChange={event => setCapacity(event.target.value.replace(/\D/g, ""))} placeholder="السعة" /><Input inputMode="numeric" value={pickupFee} onChange={event => setPickupFee(event.target.value.replace(/\D/g, ""))} placeholder="نقطة استلام" /><Input inputMode="numeric" value={doorstepFee} onChange={event => setDoorstepFee(event.target.value.replace(/\D/g, ""))} placeholder="عنوان" /></div><div className="mt-3 flex flex-wrap gap-2"><select value={status} onChange={event => setStatus(event.target.value as keyof typeof intercityStatusLabel)} className="form-select w-auto"><option value="open">مفتوحة للحجز</option><option value="closed">مغلقة</option><option value="dispatching">انطلقت</option><option value="arrived">وصلت</option></select><Button disabled={saving || !title.trim() || !close.trim() || !arrival.trim()} onClick={() => save()} className="rounded-xl bg-blue-900 hover:bg-blue-950">حفظ الرحلة</Button><button disabled={saving} onClick={() => save(!trip.active)} className={`rounded-xl px-3 py-2 text-xs font-bold ${trip.active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{trip.active ? "ظاهرة للعميل" : "مخفية"}</button></div></div>;
}

function SettingsPanel() {
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const interfaceSettingsQuery = trpc.lahza.admin.interfaceSettings.get.useQuery();
  const [tickerPrimary, setTickerPrimary] = useState("");
  const [tickerSecondary, setTickerSecondary] = useState("");
  const changePin = trpc.lahza.admin.changePin.useMutation({ onSuccess: () => { setCurrentPin(""); setNewPin(""); toast.success("تم تغيير رمز PIN بنجاح"); }, onError: error => toast.error(error.message) });
  const updateInterface = trpc.lahza.admin.interfaceSettings.update.useMutation({ onSuccess: result => { setTickerPrimary(result.tickerPrimary); setTickerSecondary(result.tickerSecondary); interfaceSettingsQuery.refetch(); toast.success("تم حفظ نصي الشريط المتحرك"); }, onError: error => toast.error(error.message) });
  useEffect(() => {
    if (!interfaceSettingsQuery.data) return;
    setTickerPrimary(normalizeTickerText(interfaceSettingsQuery.data.tickerPrimary, DEFAULT_TICKER_PRIMARY));
    setTickerSecondary(normalizeTickerText(interfaceSettingsQuery.data.tickerSecondary, DEFAULT_TICKER_SECONDARY));
  }, [interfaceSettingsQuery.data]);
  return <div className="space-y-5"><section className="admin-section"><div className="admin-section-heading"><div><p>محتوى واجهة العميل</p><h2>الشريطان المتحركان</h2></div><Settings2 className="h-5 w-5 text-red-600" /></div><p className="settings-copy">يظهر النصان في شريط واحد أعلى التطبيق، ويفصل بينهما رمز نجمة تلقائياً.</p>{interfaceSettingsQuery.isLoading ? <PanelLoading text="جارٍ تحميل نصوص الشريط" /> : <div className="pin-form"><div><Label>نص الشريط الأول</Label><Input value={tickerPrimary} onChange={event => setTickerPrimary(event.target.value.slice(0, 220))} placeholder="حقق ١٠ طلبات واربح معنا هدية" /></div><div><Label>نص الشريط الثاني</Label><Input value={tickerSecondary} onChange={event => setTickerSecondary(event.target.value.slice(0, 220))} placeholder="لحظة — منبج بين يديك" /></div><Button disabled={updateInterface.isPending || tickerPrimary.trim().length < 2 || tickerSecondary.trim().length < 2} onClick={() => updateInterface.mutate({ tickerPrimary: tickerPrimary.trim(), tickerSecondary: tickerSecondary.trim() })} className="rounded-xl bg-red-600 hover:bg-red-700"><Settings2 className="h-4 w-4" /> {updateInterface.isPending ? "جارٍ الحفظ..." : "حفظ نصي الشريط"}</Button></div>}</section><section className="admin-section"><div className="admin-section-heading"><div><p>حماية لوحة التحكم</p><h2>تغيير رمز PIN للمالك</h2></div><KeyRound className="h-5 w-5 text-blue-900" /></div><p className="settings-copy">لا تشارك رمز الدخول مع المشرفين. لديهم حسابات مستقلة تُنشأ من هذه اللوحة.</p><div className="pin-form"><div><Label>رمز PIN الحالي</Label><Input type="password" inputMode="numeric" value={currentPin} onChange={e => setCurrentPin(e.target.value)} /></div><div><Label>رمز PIN الجديد</Label><Input type="password" inputMode="numeric" value={newPin} onChange={e => setNewPin(e.target.value)} /></div><Button disabled={changePin.isPending} onClick={() => changePin.mutate({ currentPin, newPin })} className="rounded-xl bg-blue-900 hover:bg-blue-950"><KeyRound className="h-4 w-4" /> حفظ الرمز الجديد</Button></div></section></div>;
}

function Empty({ icon: Icon, title, text }: { icon: typeof ClipboardList; title: string; text: string }) { return <div className="admin-empty"><Icon className="h-7 w-7" /><h3>{title}</h3><p>{text}</p></div>; }
function PanelLoading({ text }: { text: string }) { return <div className="panel-loading"><Loader2 className="h-5 w-5 animate-spin" />{text}</div>; }
