import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { catalogSeed, categoryMeta, formatSyp, type LahzaCategory } from "@shared/lahza";
import { ArrowLeft, Bike, CarFront, ChevronLeft, CircleHelp, ClipboardList, CreditCard, Fuel, HandCoins, LocateFixed, MapPin, Minus, PackagePlus, Phone, Pill, Plus, ReceiptText, ShoppingBasket, Store, Trash2, Truck, UserRound, UtensilsCrossed, Wheat } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";

type Screen = "home" | "delivery" | "taxi" | "checkout";
type CartLine = {
  id: string;
  catalogItemId?: number;
  category: LahzaCategory;
  itemName: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  priceKnown: boolean;
};

type DeliveryQuote = {
  distanceMeters: number;
  distanceText: string;
  distanceKm: number;
  billableKm: number;
  pricePerKm: number;
  deliveryFee: number;
};

const heroImages = [
  "/assets/lahza-legumes.webp",
  "/assets/lahza-butcher.webp",
  "/assets/lahza-chicken.webp",
  "/assets/lahza-pharmacy.webp",
];

function getDeviceId() {
  const key = "lahza_device_id_v1";
  const existing = window.localStorage.getItem(key);
  if (existing) return existing;
  const next = crypto.randomUUID();
  window.localStorage.setItem(key, next);
  return next;
}

const categoryIcons = {
  groceries: Wheat,
  chicken: UtensilsCrossed,
  breakfast: UtensilsCrossed,
  lamb: UtensilsCrossed,
  butcher: Store,
  fuel: Fuel,
  pharmacy: Pill,
};

const categoryColors = {
  groceries: "from-amber-100 to-orange-50 text-amber-800",
  chicken: "from-red-100 to-rose-50 text-red-800",
  breakfast: "from-yellow-100 to-amber-50 text-amber-800",
  lamb: "from-orange-100 to-red-50 text-orange-800",
  butcher: "from-rose-100 to-pink-50 text-rose-800",
  fuel: "from-blue-100 to-sky-50 text-blue-800",
  pharmacy: "from-emerald-100 to-teal-50 text-emerald-800",
};

function lineTotal(line: Pick<CartLine, "quantity" | "unitPrice" | "unit">) {
  return line.unit === "جرام" ? Math.round((line.quantity / 1000) * line.unitPrice) : Math.round(line.quantity * line.unitPrice);
}

function Header({ onSecret, onCart, cartCount }: { onSecret: () => void; onCart: () => void; cartCount: number }) {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-100 bg-white/95 pt-9 backdrop-blur-xl">
      <div className="app-shell flex h-[72px] items-center justify-between gap-3">
        <a className="contact-pill" href="tel:0997311078" aria-label="اتصل بلحظة">
          <Phone className="h-4 w-4" />
          <span dir="ltr">0997311078</span>
        </a>
        <button className="brand-mark" onDoubleClick={onSecret} title="لحظة">
          <span className="brand-dot" />
          <span>لحظة</span>
        </button>
        <button className="relative grid h-10 w-10 place-items-center rounded-2xl bg-slate-50 text-slate-700 transition hover:bg-slate-100 active:scale-95" onClick={onCart} aria-label="عرض السلة">
          <ShoppingBasket className="h-5 w-5" />
          {cartCount > 0 ? <span className="cart-count">{cartCount}</span> : null}
        </button>
      </div>
    </header>
  );
}

function PageHeading({ eyebrow, title, detail, onBack }: { eyebrow: string; title: string; detail: string; onBack: () => void }) {
  return (
    <section className="app-shell pt-7 pb-5">
      <button className="back-link" onClick={onBack}><ArrowLeft className="h-4 w-4" /> رجوع</button>
      <p className="section-eyebrow mt-6">{eyebrow}</p>
      <h1 className="page-title">{title}</h1>
      <p className="page-detail">{detail}</p>
    </section>
  );
}

export default function Home() {
  const [, setLocation] = useLocation();
  const [screen, setScreen] = useState<Screen>("home");
  const [checkoutMode, setCheckoutMode] = useState<"delivery" | "taxi">("delivery");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [activeCategory, setActiveCategory] = useState<LahzaCategory | null>(null);
  const [secretOpen, setSecretOpen] = useState(false);
  const [secretRole, setSecretRole] = useState<"owner" | "supervisor">("owner");
  const [pin, setPin] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [checkoutName, setCheckoutName] = useState("");
  const [checkoutPhone, setCheckoutPhone] = useState("");
  const [customerLocation, setCustomerLocation] = useState("");
  const [customerLocationUrl, setCustomerLocationUrl] = useState("");
  const [customerLat, setCustomerLat] = useState<number | null>(null);
  const [customerLng, setCustomerLng] = useState<number | null>(null);
  const [locationVerified, setLocationVerified] = useState(false);
  const [locating, setLocating] = useState(false);
  const [notes, setNotes] = useState("");
  const [payment, setPayment] = useState<"sham_cash" | "cash">("cash");
  const [deliveryQuote, setDeliveryQuote] = useState<DeliveryQuote | null>(null);
  const [taxiType, setTaxiType] = useState<"standard" | "van">("standard");
  const [pickup, setPickup] = useState("");
  const [destination, setDestination] = useState("");

  const catalogQuery = trpc.lahza.catalog.list.useQuery();
  const products = catalogQuery.data ?? [];
  const adminLogin = trpc.lahza.admin.login.useMutation({
    onSuccess: () => {
      setSecretOpen(false);
      toast.success("تم فتح لوحة التحكم بنجاح");
      setLocation("/admin");
    },
    onError: error => toast.error(error.message),
  });
  const createOrder = trpc.lahza.orders.create.useMutation({
    onSuccess: result => {
      toast.success(`تم إرسال الطلب رقم #${result.orderId} بنجاح`);
      setCart([]);
      setNotes("");
      setPickup("");
      setDestination("");
      setScreen("home");
    },
    onError: error => toast.error(error.message),
  });
  const requestDeliveryQuote = trpc.lahza.delivery.quote.useMutation({
    onSuccess: quote => {
      setDeliveryQuote(quote);
      toast.success(`مسافة الطريق ${quote.distanceKm} كم ورسوم التوصيل ${formatSyp(quote.deliveryFee)}`);
    },
    onError: error => toast.error(error.message),
  });
  const touchPresence = trpc.lahza.customers.touch.useMutation();

  useEffect(() => {
    const deviceId = getDeviceId();
    const reportPresence = () => touchPresence.mutate({ deviceId });
    reportPresence();
    window.addEventListener("focus", reportPresence);
    window.addEventListener("pointerdown", reportPresence);
    return () => {
      window.removeEventListener("focus", reportPresence);
      window.removeEventListener("pointerdown", reportPresence);
    };
  }, []);

  const total = useMemo(() => cart.reduce((sum, item) => sum + lineTotal(item), 0), [cart]);
  const hasPharmacy = cart.some(item => item.category === "pharmacy");

  const addLine = (line: Omit<CartLine, "id">) => {
    setCart(current => [...current, { ...line, id: `${Date.now()}-${Math.random()}` }]);
    setDeliveryQuote(null);
    toast.success("أُضيف إلى السلة");
    setActiveCategory(null);
  };

  const removeLine = (id: string) => {
    setCart(current => current.filter(item => item.id !== id));
    setDeliveryQuote(null);
  };

  const openCheckout = () => {
    if (screen === "delivery" && !cart.length) {
      toast.error("أضف صنفاً واحداً على الأقل قبل المتابعة");
      return;
    }
    setCheckoutMode("delivery");
    setScreen("checkout");
  };

  const openTaxiCheckout = () => {
    if (!pickup.trim() || !destination.trim()) {
      toast.error("أدخل موقع الانطلاق والوجهة قبل المتابعة");
      return;
    }
    setCheckoutMode("taxi");
    setScreen("checkout");
  };

  const locateCustomer = () => {
    if (!navigator.geolocation) {
      toast.error("لا يدعم هذا الجهاز تحديد الموقع");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(position => {
      const { latitude, longitude } = position.coords;
      setCustomerLocation(`موقعي الحالي (${latitude.toFixed(5)}, ${longitude.toFixed(5)})`);
      setCustomerLocationUrl(`https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`);
      setCustomerLat(latitude);
      setCustomerLng(longitude);
      setDeliveryQuote(null);
      setLocationVerified(true);
      setLocating(false);
      toast.success("تم تحديد موقعك بنجاح");
      if (checkoutMode === "delivery" && cart.length) requestDeliveryQuote.mutate({ locationLat: latitude, locationLng: longitude });
    }, () => {
      setLocating(false);
      toast.error("تعذر تحديد الموقع. تحقق من إذن الموقع ثم حاول مجدداً.");
    }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 });
  };

  const requestInvoice = () => {
    if (checkoutMode !== "delivery") return;
    if (customerLat === null || customerLng === null || !locationVerified) {
      toast.message("حدد موقعك أولاً لحساب فاتورة التوصيل");
      locateCustomer();
      return;
    }
    requestDeliveryQuote.mutate({ locationLat: customerLat, locationLng: customerLng });
  };

  const submitCheckout = () => {
    if (!checkoutName.trim() || !customerLocation.trim() || !locationVerified || !customerLocationUrl || customerLat === null || customerLng === null) {
      toast.error("أدخل الاسم واضغط تحديد موقعي أولاً قبل إرسال الطلب");
      return;
    }
    if (!/^9\d{8}$/.test(checkoutPhone)) {
      toast.error("أدخل رقم هاتف سوري يبدأ بالرقم 9");
      return;
    }
    const isTaxi = checkoutMode === "taxi";
    if (!isTaxi && !deliveryQuote) {
      toast.error("اضغط الاستعلام عن الفاتورة لحساب سعر التوصيل قبل إرسال الطلب");
      return;
    }
    if (isTaxi && (!pickup.trim() || !destination.trim())) {
      toast.error("أكمل موقع الانطلاق والوجهة");
      return;
    }
    createOrder.mutate({
      orderType: isTaxi ? "taxi" : "delivery",
      customerName: checkoutName.trim(),
      customerPhone: `+963${checkoutPhone}`,
      locationUrl: customerLocationUrl,
      locationLat: customerLat,
      locationLng: customerLng,
      paymentMethod: payment,
      notes: [notes.trim(), `الموقع: ${customerLocation.trim()}`, customerLocationUrl ? `رابط الخريطة: ${customerLocationUrl}` : ""].filter(Boolean).join("\n") || undefined,
      taxiType: isTaxi ? taxiType : undefined,
      pickupLocation: isTaxi ? pickup : undefined,
      destination: isTaxi ? destination : undefined,
      lines: isTaxi ? [] : cart.map(({ catalogItemId, category, itemName, quantity, unit }) => ({ catalogItemId, category, itemName, quantity, unit })),
    });
  };

  const goHome = () => {
    setScreen("home");
    setActiveCategory(null);
  };

  return (
    <main dir="rtl" className="min-h-screen bg-white text-slate-950">
      <Header onSecret={() => setSecretOpen(true)} onCart={() => screen === "delivery" ? openCheckout() : setScreen("delivery")} cartCount={cart.length} />
      <div className="reward-ticker" aria-label="عرض المكافأة"><div className="reward-ticker-track"><span>حقق ١٠ طلبات واربح معنا هدية</span><span aria-hidden="true">حقق ١٠ طلبات واربح معنا هدية</span></div></div>

      {screen === "home" ? (
        <>
          <section className="app-shell pt-7 pb-8">
            <div className="hero-panel">
              <div className="hero-orb hero-orb-one" /><div className="hero-orb hero-orb-two" />
              <div className="hero-image-frame" aria-label="صور أقسام الخدمات">
                {heroImages.map((image, index) => <img key={image} src={image} alt="" className="hero-image hero-image-cycle" style={{ animationDelay: `${index}s` }} />)}
              </div>
              <div className="relative z-10 max-w-[54%]">
                <p className="section-eyebrow text-red-100">خدمات منبج على بُعد لحظة</p>
                <h1 className="hero-title">كل ما تحتاجه،<br /><span>بخطوة واحدة.</span></h1>
                <p className="hero-copy">توصيل الطلبات وحجز السيارة بسهولة وبواجهة مصمّمة للمدينة.</p>
              </div>
              <div className="hero-ticket"><MapPin className="h-4 w-4" /><span>منبج</span></div>
            </div>
          </section>
          <section className="app-shell pb-10">
            <div className="mb-5 flex items-end justify-between"><div><p className="section-eyebrow">اختر خدمتك</p><h2 className="section-title">كيف نساعدك اليوم؟</h2></div><CircleHelp className="mb-1 h-5 w-5 text-slate-300" /></div>
            <div className="service-stack">
              <button className="service-card service-card-delivery" onClick={() => setScreen("delivery")}>
                <span className="service-card-icon"><Truck /></span>
                <span className="service-content"><span className="service-title">طلبك للبيت</span><span className="service-subtitle">مطاعم، بقاليات، صيدليات والمزيد</span></span>
                <ChevronLeft className="service-arrow" />
                <span className="service-watermark">01</span>
              </button>
              <button className="service-card service-card-taxi" onClick={() => setScreen("taxi")}>
                <span className="service-card-icon"><CarFront /></span>
                <span className="service-content"><span className="service-title">سيارة أجرة</span><span className="service-subtitle">تاكسي عادي أو فان عند الحاجة</span></span>
                <ChevronLeft className="service-arrow" />
                <span className="service-watermark">02</span>
              </button>
            </div>
            <div className="mt-8 flex items-center justify-center gap-2 text-xs text-slate-400"><Bike className="h-4 w-4 text-red-600" /><span>خدمة محلية مخصصة لمنبج</span></div>
          </section>
        </>
      ) : null}

      {screen === "delivery" ? (
        <>
          <PageHeading eyebrow="طلبك للبيت" title="اختر احتياجك" detail="أضف المنتجات من القسم المناسب، ثم راجع طلبك قبل الإرسال." onBack={goHome} />
          <section className="app-shell pb-32">
            <div className="category-grid">
              {(Object.keys(categoryMeta) as LahzaCategory[]).map(category => {
                const meta = categoryMeta[category];
                const Icon = categoryIcons[category];
                const count = cart.filter(line => line.category === category).length;
                return <button key={category} onClick={() => setActiveCategory(category)} className="category-card">
                  <span className={`category-icon bg-gradient-to-br ${categoryColors[category]}`}><Icon className="h-5 w-5" /></span>
                  <span className="category-card-copy"><span>{meta.title}</span><small>{meta.subtitle}</small></span>
                  {count > 0 ? <span className="category-badge">{count}</span> : <Plus className="h-4 w-4 text-slate-300" />}
                </button>;
              })}
            </div>
          </section>
          <div className="bottom-cta"><div><span>السلة</span><strong>{cart.length ? `${cart.length} أصناف` : "فارغة"}</strong></div><Button disabled={!cart.length} onClick={openCheckout} className="rounded-2xl bg-red-600 px-6 text-white hover:bg-red-700">متابعة <ChevronLeft className="mr-1 h-4 w-4" /></Button></div>
        </>
      ) : null}

      {screen === "taxi" ? (
        <>
          <PageHeading eyebrow="سيارة أجرة" title="إلى أين تريد الذهاب؟" detail="حدد نوع السيارة ومسار رحلتك لنرسل طلبك فوراً." onBack={goHome} />
          <section className="app-shell pb-10">
            <div className="vehicle-toggle">
              <button onClick={() => setTaxiType("standard")} className={taxiType === "standard" ? "vehicle-active" : ""}><CarFront /><span>تاكسي عادي</span><small>حتى 4 ركاب</small></button>
              <button onClick={() => setTaxiType("van")} className={taxiType === "van" ? "vehicle-active" : ""}><Truck /><span>سيارة فان</span><small>للمجموعات والأمتعة</small></button>
            </div>
            <div className="route-form mt-7">
              <div className="route-dot route-dot-start" /><div className="route-line" /><div className="route-dot route-dot-end" />
              <div className="route-field"><Label htmlFor="pickup">موقع الانطلاق</Label><Input id="pickup" value={pickup} onChange={e => setPickup(e.target.value)} placeholder="مثال: دوار الساعة" /></div>
              <div className="route-field"><Label htmlFor="destination">الوجهة</Label><Input id="destination" value={destination} onChange={e => setDestination(e.target.value)} placeholder="إلى أين تريد الذهاب؟" /></div>
            </div>
            <button onClick={openTaxiCheckout} className="primary-full-button mt-7">متابعة إلى تأكيد الرحلة <ChevronLeft className="h-5 w-5" /></button>
          </section>
        </>
      ) : null}

      {screen === "checkout" ? (
        <>
          <PageHeading eyebrow="تأكيد الطلب" title={checkoutMode === "delivery" ? "راجع طلبك" : "تأكيد رحلتك"} detail="أدخل بيانات التواصل وحدد موقعك، ثم أرسل طلبك." onBack={() => setScreen(checkoutMode === "delivery" ? "delivery" : "taxi")} />
          <section className="app-shell space-y-5 pb-10">
            <div className="checkout-card">
              <div className="checkout-card-title"><ClipboardList className="h-5 w-5 text-red-600" /><span>{checkoutMode === "delivery" ? "ملخص الطلب" : "تفاصيل الرحلة"}</span></div>
              {checkoutMode === "delivery" ? <CartPreview cart={cart} removeLine={removeLine} total={total} hasPharmacy={hasPharmacy} quote={deliveryQuote} onInvoice={requestInvoice} calculating={locating || requestDeliveryQuote.isPending} /> : <div className="taxi-summary"><CarFront className="h-9 w-9 text-blue-900" /><div><strong>{taxiType === "van" ? "سيارة فان" : "تاكسي عادي"}</strong><span>{pickup || "موقع الانطلاق"} <ChevronLeft className="inline h-3 w-3" /> {destination || "الوجهة"}</span></div></div>}
            </div>
            <div className="checkout-card space-y-4">
              <div className="checkout-card-title"><UserRound className="h-5 w-5 text-red-600" /><span>بيانات التواصل وموقع الطلب</span></div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><div><Label htmlFor="customerName">الاسم</Label><Input id="customerName" value={checkoutName} onChange={e => setCheckoutName(e.target.value)} placeholder="اكتب الاسم" /></div><div><Label htmlFor="customerPhone">رقم الهاتف السوري</Label><div className="phone-entry" dir="ltr"><span>+963</span><Input id="customerPhone" inputMode="numeric" value={checkoutPhone} onChange={e => setCheckoutPhone(e.target.value.replace(/\D/g, "").slice(0, 9))} placeholder="9XXXXXXXX" /></div><small className="phone-help">اكتب الرقم ابتداءً من 9، من دون الصفر الأول.</small></div></div>
                <div><Label htmlFor="customerLocation">موقعك</Label><Input id="customerLocation" value={customerLocation} readOnly placeholder="استخدم زر تحديد موقعي" /><div className="location-actions"><button onClick={locateCustomer} disabled={locating}><LocateFixed className="h-4 w-4" />{locating ? "جارٍ التحديد..." : "تحديد موقعي"}</button></div>{locationVerified ? <p className="verified-location">تم التحقق من الموقع عبر GPS</p> : <p className="location-required-note">اضغط تحديد موقعي لتأكيد طلبك.</p>}</div>
                <div><Label htmlFor="notes">ملاحظات إضافية <span className="text-slate-400">(اختياري)</span></Label><Textarea id="notes" value={notes} onChange={e => setNotes(e.target.value)} placeholder="أي تفاصيل مفيدة للطلب أو للمندوب" /></div>
            </div>
            <div className="checkout-card"><div className="checkout-card-title"><CreditCard className="h-5 w-5 text-red-600" /><span>طريقة الدفع</span></div><div className="payment-grid"><button onClick={() => setPayment("sham_cash")} className={payment === "sham_cash" ? "payment-active" : ""}><span className="payment-icon payment-icon-blue">ش</span><span>شام كاش</span></button><button onClick={() => setPayment("cash")} className={payment === "cash" ? "payment-active" : ""}><HandCoins className="h-5 w-5" /><span>نقداً عند الاستلام</span></button></div></div>
            <button disabled={createOrder.isPending} onClick={submitCheckout} className="primary-full-button">{createOrder.isPending ? "جارٍ إرسال الطلب..." : "تأكيد وإرسال الطلب"}<ChevronLeft className="h-5 w-5" /></button>
          </section>
        </>
      ) : null}

      <footer className="app-shell pb-8 text-center text-xs font-medium tracking-wide text-slate-400" dir="ltr">Designed by Ahmad barho</footer>
      <CategoryDialog category={activeCategory} products={products} onClose={() => setActiveCategory(null)} onAdd={addLine} />
      <Dialog open={secretOpen} onOpenChange={setSecretOpen}><DialogContent dir="rtl" className="w-[calc(100%-2rem)] max-w-sm rounded-3xl border-0 bg-white p-6 shadow-2xl"><DialogHeader><div className="admin-lock-icon">L</div><DialogTitle className="pt-2 text-center text-xl">دخول الإدارة</DialogTitle><DialogDescription className="text-center">هذه المساحة مخصصة للمالك والمشرفين.</DialogDescription></DialogHeader><div className="mt-3 space-y-4"><div className="role-switch"><button onClick={() => setSecretRole("owner")} className={secretRole === "owner" ? "role-selected" : ""}>المالك</button><button onClick={() => setSecretRole("supervisor")} className={secretRole === "supervisor" ? "role-selected" : ""}>مشرف</button></div>{secretRole === "owner" ? <div><Label htmlFor="pin">رمز PIN</Label><Input id="pin" inputMode="numeric" type="password" value={pin} onChange={e => setPin(e.target.value)} placeholder="••••" /></div> : <><div><Label htmlFor="username">اسم المستخدم</Label><Input id="username" dir="ltr" value={username} onChange={e => setUsername(e.target.value)} /></div><div><Label htmlFor="password">كلمة المرور</Label><Input id="password" dir="ltr" type="password" value={password} onChange={e => setPassword(e.target.value)} /></div></>}<Button disabled={adminLogin.isPending} className="w-full rounded-xl bg-blue-900 hover:bg-blue-950" onClick={() => secretRole === "owner" ? adminLogin.mutate({ role: "owner", pin }) : adminLogin.mutate({ role: "supervisor", username, password })}>{adminLogin.isPending ? "جارٍ التحقق..." : "دخول آمن"}</Button></div></DialogContent></Dialog>
    </main>
  );
}

function CategoryDialog({ category, products, onClose, onAdd }: { category: LahzaCategory | null; products: { id: number; name: string; category: LahzaCategory; unit: string; unitPrice: number; available: boolean }[]; onClose: () => void; onAdd: (line: Omit<CartLine, "id">) => void }) {
  const [selectedId, setSelectedId] = useState("");
  const [manualName, setManualName] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [medicine, setMedicine] = useState("");
  if (!category) return null;
  const meta = categoryMeta[category];
  const localFallback = catalogSeed.filter(item => item.category === category).map((item, index) => ({ id: -index - 1, ...item, unitPrice: 0, available: true }));
  const available = products.filter(product => product.category === category && product.available);
  const options = available.length ? available : localFallback;
  const selected = options.find(item => String(item.id) === selectedId);
  const isPharmacy = category === "pharmacy";
  const selectedUnit = selectedId === "manual" ? meta.unit : selected?.unit ?? meta.unit;
  const addCurrent = () => {
    if (isPharmacy) {
      if (!medicine.trim()) return toast.error("أدخل اسم الدواء أو ما تحتاجه من الصيدلية");
      onAdd({ category, itemName: medicine.trim(), quantity: 1, unit: "طلب", unitPrice: 0, priceKnown: false });
      setMedicine("");
      return;
    }
    const parsed = Number(quantity);
    const name = selectedId === "manual" ? manualName.trim() : selected?.name;
    if (!name || !Number.isFinite(parsed) || parsed <= 0) return toast.error("اختر الصنف وأدخل كمية صالحة");
    const unit = selectedUnit;
    onAdd({ category, itemName: name, quantity: parsed, unit, unitPrice: selectedId === "manual" ? 0 : selected?.unitPrice ?? 0, catalogItemId: selectedId === "manual" || (selected?.id ?? 0) < 0 ? undefined : selected?.id, priceKnown: selectedId !== "manual" && (selected?.unitPrice ?? 0) > 0 });
    setSelectedId(""); setManualName(""); setQuantity("1");
  };
  return <Dialog open={Boolean(category)} onOpenChange={open => !open && onClose()}><DialogContent dir="rtl" className="w-[calc(100%-1.5rem)] max-w-lg rounded-3xl border-0 bg-white p-6 shadow-2xl"><DialogHeader><DialogTitle className="text-right text-xl">{meta.title}</DialogTitle><DialogDescription className="text-right">{isPharmacy ? "اكتب أسماء الأدوية أو المستلزمات المطلوبة. لا تظهر أسعار هذا القسم." : "اختر صنفاً وأدخل الكمية المناسبة."}</DialogDescription></DialogHeader>{isPharmacy ? <div className="mt-4 space-y-4"><Textarea value={medicine} onChange={e => setMedicine(e.target.value)} placeholder="مثال: دواء سعال للأطفال، فيتامين C..." /><Button onClick={addCurrent} className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-700"><Plus className="h-4 w-4" /> إضافة طلب الصيدلية</Button></div> : <div className="mt-4 space-y-4"><div><Label>الصنف</Label><select value={selectedId} onChange={e => setSelectedId(e.target.value)} className="form-select"><option value="">اختر من القائمة</option>{options.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}<option value="manual">صنف غير موجود — إدخال يدوي</option></select></div>{selectedId === "manual" ? <div><Label>اسم الصنف</Label><Input value={manualName} onChange={e => setManualName(e.target.value)} placeholder="اكتب اسم الصنف" /></div> : null}<div><Label>الكمية {selectedUnit !== "وحدة" ? `(${selectedUnit})` : ""}</Label><div className="quantity-control"><button onClick={() => setQuantity(value => String(Math.max(selectedUnit === "ليتر" ? 0.1 : 1, Number(value || 1) - (selectedUnit === "جرام" ? 50 : 1))))}><Minus className="h-4 w-4" /></button><Input type="number" min={selectedUnit === "ليتر" ? "0.1" : "1"} step={selectedUnit === "جرام" ? "50" : "1"} value={quantity} onChange={e => setQuantity(e.target.value)} /><button onClick={() => setQuantity(value => String(Number(value || 0) + (selectedUnit === "جرام" ? 50 : 1)))}><Plus className="h-4 w-4" /></button></div></div>{selected && selected.unitPrice > 0 ? <div className="price-note"><span>السعر الحالي</span><strong>{formatSyp(selected.unitPrice)} {selected.unit === "جرام" ? "/ كغ" : selected.unit === "ليتر" ? "/ ليتر" : selected.unit === "قنينة" ? "/ قنينة" : ""}</strong></div> : <div className="price-note price-note-muted">يحدد السعر النهائي من لوحة الإدارة عند توفره.</div>}<Button onClick={addCurrent} className="w-full rounded-xl bg-red-600 hover:bg-red-700"><PackagePlus className="h-4 w-4" /> أضف إلى السلة</Button></div>}</DialogContent></Dialog>;
}

function CartPreview({ cart, removeLine, total, hasPharmacy, quote, onInvoice, calculating }: { cart: CartLine[]; removeLine: (id: string) => void; total: number; hasPharmacy: boolean; quote: DeliveryQuote | null; onInvoice: () => void; calculating: boolean }) {
  const finalTotal = total + (quote?.deliveryFee ?? 0);
  return <div className="mt-3"><div className="divide-y divide-slate-100">{cart.map(item => <div key={item.id} className="cart-line"><div><strong>{item.itemName}</strong><span>{item.quantity} {item.unit}</span></div><div className="flex items-center gap-3">{item.priceKnown ? <strong className="text-sm text-blue-900">{formatSyp(lineTotal(item))}</strong> : <small className="text-slate-400">السعر عند التأكيد</small>}<button onClick={() => removeLine(item.id)} aria-label="حذف"><Trash2 className="h-4 w-4 text-red-400" /></button></div></div>)}</div>{hasPharmacy ? <p className="pharmacy-note"><Pill className="h-4 w-4" />الأدوية لا تدخل في المجموع، ويؤكد سعرها المندوب.</p> : null}<button type="button" onClick={onInvoice} disabled={calculating} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-900 px-4 py-3 text-xs font-bold text-white transition hover:bg-blue-950 disabled:opacity-60"><ReceiptText className="h-4 w-4" />{calculating ? "جارٍ حساب الفاتورة..." : "الاستعلام عن الفاتورة"}</button>{quote ? <div className="mt-3 rounded-xl border border-blue-100 bg-blue-50 p-3 text-xs text-blue-950"><div className="flex items-center justify-between"><span>مسافة الطريق من مركز منبج</span><strong>{quote.distanceKm} كم</strong></div><div className="mt-2 flex items-center justify-between"><span>سعر التوصيل ({quote.pricePerKm} ل.س × {quote.billableKm} كم)</span><strong>{formatSyp(quote.deliveryFee)}</strong></div></div> : <p className="mt-3 text-center text-[11px] leading-5 text-slate-400">حدد موقعك ثم اضغط الاستعلام عن الفاتورة لإظهار رسوم التوصيل.</p>}<div className="total-row"><span>{quote ? "الإجمالي مع التوصيل" : "إجمالي المنتجات المبدئي"}</span><strong>{formatSyp(finalTotal)}</strong></div></div>;
}
