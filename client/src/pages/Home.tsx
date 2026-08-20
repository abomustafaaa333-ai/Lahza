import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { IntercityBooking, type IntercityTripSelection } from "@/components/IntercityBooking";
import { trpc } from "@/lib/trpc";
import { buildPartnerGallerySlides, type PartnerGallerySlide } from "@/lib/partnerGallery";
import { catalogSeed, categoryMeta, DEFAULT_TICKER_PRIMARY, DEFAULT_TICKER_SECONDARY, formatSyp, normalizeTickerText, type LahzaCategory } from "@shared/lahza";
import { ArrowLeft, BadgePercent, Bike, CakeSlice, CarFront, ChevronLeft, CircleHelp, ClipboardList, CreditCard, Fuel, HandCoins, LocateFixed, MapPin, MessageCircle, Minus, PackagePlus, Phone, Pill, Plus, Route, Shirt, ShoppingBasket, Smartphone, Sparkles, Store, Trash2, Truck, UserRound, UtensilsCrossed, Wheat } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";

type Screen = "home" | "delivery" | "taxi" | "intercity" | "offers" | "checkout";
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

type StoreOption = { id: number; name: string; category: LahzaCategory };

const isStaticDemo = import.meta.env.VITE_LAHZA_STATIC_DEMO === "true";
const demoAssetPrefix = isStaticDemo ? "." : "";
const demoGalleryImages = [
  `${demoAssetPrefix}/assets/lahza-legumes.webp`,
  `${demoAssetPrefix}/assets/lahza-butcher.webp`,
  `${demoAssetPrefix}/assets/lahza-chicken.webp`,
  `${demoAssetPrefix}/assets/lahza-pharmacy.webp`,
];

const staticDemoProducts: { id: number; name: string; category: LahzaCategory; unit: string; unitPrice: number; available: boolean }[] = [
  { id: 1001, name: "عدس أحمر", category: "groceries", unit: "كغ", unitPrice: 25000, available: true },
  { id: 1002, name: "فروج طازج", category: "chicken", unit: "كغ", unitPrice: 45000, available: true },
  { id: 1003, name: "جرة غاز منزلية", category: "fuel", unit: "قنينة", unitPrice: 0, available: true },
  { id: 1004, name: "عرض طعميني — صحن حلويات", category: "offers", unit: "وحدة", unitPrice: 30000, available: true },
  { id: 1005, name: "عرض منبج — خصم على التوصيل", category: "offers", unit: "وحدة", unitPrice: 0, available: true },
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
  other: PackagePlus,
  offers: BadgePercent,
  sweets: CakeSlice,
  clothing: Shirt,
  mobile_accessories: Smartphone,
  beauty_boutique: Sparkles,
};

const categoryColors = {
  groceries: "from-amber-100 to-orange-50 text-amber-800",
  chicken: "from-red-100 to-rose-50 text-red-800",
  breakfast: "from-yellow-100 to-amber-50 text-amber-800",
  lamb: "from-orange-100 to-red-50 text-orange-800",
  butcher: "from-rose-100 to-pink-50 text-rose-800",
  fuel: "from-blue-100 to-sky-50 text-blue-800",
  pharmacy: "from-emerald-100 to-teal-50 text-emerald-800",
  other: "from-violet-100 to-indigo-50 text-indigo-800",
  offers: "from-red-100 to-orange-50 text-red-800",
  sweets: "from-pink-100 to-rose-50 text-pink-800",
  clothing: "from-fuchsia-100 to-purple-50 text-fuchsia-800",
  mobile_accessories: "from-cyan-100 to-blue-50 text-cyan-800",
  beauty_boutique: "from-amber-100 to-orange-50 text-amber-800",
};

function lineTotal(line: Pick<CartLine, "quantity" | "unitPrice" | "unit">) {
  return line.unit === "جرام" ? Math.round((line.quantity / 1000) * line.unitPrice) : Math.round(line.quantity * line.unitPrice);
}

function Header({ onSecret, onCart, cartCount }: { onSecret: () => void; onCart: () => void; cartCount: number }) {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-100 bg-white/95 pt-9 backdrop-blur-xl">
      <div className="app-shell flex h-[72px] items-center justify-between gap-3">
        <div className="contact-stack" aria-label="تواصل مع لحظة">
          <a className="contact-pill" href="tel:+963997311078" aria-label="اتصل بلحظة على الرقم +963997311078">
            <span dir="ltr">+963 997 311 078</span><Phone className="h-3.5 w-3.5" />
          </a>
          <a className="contact-pill contact-whatsapp" href="https://wa.me/963997311078" target="_blank" rel="noreferrer" aria-label="راسل لحظة عبر واتساب على الرقم +963997311078">
            <span dir="ltr">+963 997 311 078</span><MessageCircle className="h-3.5 w-3.5" />
          </a>
        </div>
        <button className="brand-mark" onDoubleClick={onSecret} title="انقر مرتين لدخول المالك أو المشرف أو الشريك">
          <span className="brand-logo-line"><span className="brand-dot" /><span>لحظة</span></span>
          <small>منبج بين يديك</small>
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

function PartnerOfferGallery({ slides, onOpen }: { slides: PartnerGallerySlide[]; onOpen: (slide: PartnerGallerySlide) => void }) {
  const [activeIndex, setActiveIndex] = useState(0);
  useEffect(() => {
    setActiveIndex(0);
    if (slides.length < 2) return;
    const timer = window.setInterval(() => setActiveIndex(index => (index + 1) % slides.length), 4800);
    return () => window.clearInterval(timer);
  }, [slides.length]);
  const activeSlide = slides[activeIndex] ?? null;
  return <div className="hero-image-frame" aria-label="عروض مصورة من متاجر لحظة">{activeSlide ? <><button type="button" onClick={() => onOpen(activeSlide)} className="block w-full cursor-zoom-in text-right" aria-label={`فتح عرض ${activeSlide.name}`}><img key={activeSlide.id} src={activeSlide.imageUrl} alt={`عرض ${activeSlide.name} من ${activeSlide.partnerName}`} className="hero-offer-image" /><div className="hero-offer-caption"><strong>{activeSlide.name}</strong><span>{activeSlide.partnerName}{activeSlide.unitPrice ? ` · ${formatSyp(activeSlide.unitPrice)}` : ""}</span></div></button>{slides.length > 1 ? <div className="hero-gallery-dots" aria-label="صور العروض">{slides.map((slide, index) => <button key={slide.id} type="button" onClick={() => setActiveIndex(index)} aria-label={`عرض الصورة ${index + 1}`} aria-current={index === activeIndex} className={index === activeIndex ? "hero-gallery-dot-active" : ""} />)}</div> : null}</> : <div className="hero-gallery-empty"><BadgePercent className="h-7 w-7" /><strong>عروض المتاجر</strong><span>ستظهر صور العروض النشطة هنا فور إضافتها.</span></div>}</div>;
}

export default function Home() {
  const [, setLocation] = useLocation();
  const [screen, setScreen] = useState<Screen>("home");
  const [selectedIntercityTrip, setSelectedIntercityTrip] = useState<IntercityTripSelection | null>(null);
  const [checkoutMode, setCheckoutMode] = useState<"delivery" | "taxi">("delivery");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [activeCategory, setActiveCategory] = useState<LahzaCategory | null>(null);
  const [selectedStore, setSelectedStore] = useState<StoreOption | null>(null);
  const [selectedGalleryOffer, setSelectedGalleryOffer] = useState<PartnerGallerySlide | null>(null);
  const [focusedOfferId, setFocusedOfferId] = useState<number | null>(null);
  const [secretOpen, setSecretOpen] = useState(false);
  const [secretRole, setSecretRole] = useState<"owner" | "supervisor" | "partner">("owner");
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
  const [taxiType, setTaxiType] = useState<"standard" | "van">("standard");
  const [pickup, setPickup] = useState("");
  const [destination, setDestination] = useState("");

  const catalogQuery = trpc.lahza.catalog.list.useQuery(undefined, { enabled: !isStaticDemo, retry: false });
  const interfaceSettingsQuery = trpc.lahza.interfaceSettings.get.useQuery(undefined, { enabled: !isStaticDemo, retry: false });
  const partnerOffersQuery = trpc.lahza.intercity.offers.useQuery(undefined, { enabled: !isStaticDemo, retry: false });
  const categoryStoresQuery = trpc.lahza.storefront.stores.useQuery({ category: activeCategory ?? "groceries" }, { enabled: !isStaticDemo && Boolean(activeCategory), retry: false });
  const storeProductsQuery = trpc.lahza.storefront.products.useQuery({ storeId: selectedStore?.id ?? 1 }, { enabled: !isStaticDemo && Boolean(selectedStore), retry: false });
  const products = isStaticDemo ? staticDemoProducts : catalogQuery.data ?? [];
  const categoryStores: StoreOption[] = isStaticDemo && activeCategory
    ? [{ id: -1, name: "متجر لحظة التجريبي", category: activeCategory }]
    : categoryStoresQuery.data ?? [];
  const selectedStoreProducts = isStaticDemo
    ? products.filter(product => product.category === activeCategory)
    : storeProductsQuery.data?.products ?? [];
  const tickerPrimary = normalizeTickerText(interfaceSettingsQuery.data?.tickerPrimary, DEFAULT_TICKER_PRIMARY);
  const tickerSecondary = normalizeTickerText(interfaceSettingsQuery.data?.tickerSecondary, DEFAULT_TICKER_SECONDARY);
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
      setSelectedIntercityTrip(null);
      setScreen("home");
    },
    onError: error => toast.error(error.message),
  });
  const touchPresence = trpc.lahza.customers.touch.useMutation();

  useEffect(() => {
    if (isStaticDemo) return;
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
  const partnerOffers = isStaticDemo ? staticDemoProducts.filter(product => product.category === "offers").map(product => ({ id: product.id, text: product.unitPrice > 0 ? `${product.name} — ${formatSyp(product.unitPrice)}` : product.name, partnerName: "شريك لحظة", storeName: "متجر لحظة التجريبي", storeId: -1, storeCategory: "offers" })) : partnerOffersQuery.data ?? [];
  const offerTickerMessages = partnerOffers.length ? partnerOffers.map(offer => `${offer.partnerName} — ${offer.text}`) : ["عروض متاجر لحظة — سيظهر أول عرض هنا فور نشره من المتجر"];
  const partnerGallerySlides = isStaticDemo
    ? demoGalleryImages.map((imageUrl, index) => ({ id: 1004 + index, imageUrl, name: index === 0 ? "عرض طعميني — صحن حلويات" : "عرض متجر لحظة التجريبي", partnerName: "متجر لحظة التجريبي", storeId: -1, storeCategory: "offers", unitPrice: 0 }))
    : buildPartnerGallerySlides(partnerOffersQuery.data ?? []);

  const addLine = (line: Omit<CartLine, "id">) => {
    setCart(current => [...current, { ...line, id: `${Date.now()}-${Math.random()}` }]);
    toast.success("أُضيف إلى السلة");
    setActiveCategory(null);
    setSelectedStore(null);
  };

  const removeLine = (id: string) => {
    setCart(current => current.filter(item => item.id !== id));
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
      setLocationVerified(true);
      setLocating(false);
      toast.success("تم تحديد موقعك بنجاح");
    }, () => {
      setLocating(false);
      toast.error("تعذر تحديد الموقع. تحقق من إذن الموقع ثم حاول مجدداً.");
    }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 });
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
    if (isTaxi && (!pickup.trim() || !destination.trim())) {
      toast.error("أكمل موقع الانطلاق والوجهة");
      return;
    }
    if (isStaticDemo) {
      toast.success("تم تسجيل الطلب كتجربة محلية فقط ولن يُرسل إلى أي جهة.");
      setCart([]);
      setNotes("");
      setPickup("");
      setDestination("");
      setSelectedIntercityTrip(null);
      setScreen("home");
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
      intercityTripId: selectedIntercityTrip?.id,
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
    setSelectedStore(null);
    setSelectedIntercityTrip(null);
  };

  const openOfferLocation = (offer: PartnerGallerySlide) => {
    setSelectedGalleryOffer(null);
    setFocusedOfferId(offer.id);
    setScreen("offers");
  };

  const openOfferStore = (offer: { storeId?: number | null; storeCategory?: string | null; storeName?: string | null; partnerName: string }) => {
    if (!offer.storeId || !offer.storeCategory || !(offer.storeCategory in categoryMeta)) {
      toast.error("متجر هذا العرض غير متاح حالياً.");
      return;
    }
    const category = offer.storeCategory as LahzaCategory;
    setFocusedOfferId(null);
    setScreen("delivery");
    setActiveCategory(category);
    setSelectedStore({ id: offer.storeId, name: offer.storeName ?? offer.partnerName, category });
  };

  const handleAdminLogin = () => {
    if (secretRole === "partner") {
      setSecretOpen(false);
      setLocation("/partner");
      return;
    }
    if (isStaticDemo) {
      if (secretRole !== "owner") {
        toast.error("لوحة المشرف غير مفعّلة في النسخة التجريبية المحلية.");
        return;
      }
      if (pin !== "1122") {
        toast.error("رمز المالك غير صحيح.");
        return;
      }
      setSecretOpen(false);
      toast.success("تم فتح لوحة المالك التجريبية.");
      setLocation("/admin");
      return;
    }
    if (secretRole === "owner") adminLogin.mutate({ role: "owner", pin });
    else adminLogin.mutate({ role: "supervisor", username, password });
  };

  return (
    <main dir="rtl" className="min-h-screen bg-white text-slate-950">
      <Header onSecret={() => setSecretOpen(true)} onCart={() => screen === "delivery" ? openCheckout() : setScreen("delivery")} cartCount={cart.length} />
      <div className="reward-ticker" aria-label="رسائل لحظة"><div className="reward-ticker-track"><span>{tickerPrimary}<b aria-hidden="true">★</b>{tickerSecondary}</span><span aria-hidden="true">{tickerPrimary}<b>★</b>{tickerSecondary}</span></div></div>
      <div className="partner-offer-ticker" aria-label="عروض المتاجر"><div className="partner-offer-label"><BadgePercent className="h-3.5 w-3.5" /> عروض المتاجر</div><div className="partner-offer-ticker-window"><div className="partner-offer-ticker-track">{[...offerTickerMessages, ...offerTickerMessages].map((message, index) => <span key={`${message}-${index}`}>{message}<b aria-hidden="true">★</b></span>)}</div></div></div>

      <Dialog open={Boolean(selectedGalleryOffer)} onOpenChange={open => !open && setSelectedGalleryOffer(null)}><DialogContent dir="rtl" className="w-[calc(100%-1.5rem)] max-w-lg overflow-hidden rounded-3xl border-0 bg-white p-0 shadow-2xl">{selectedGalleryOffer ? <><img src={selectedGalleryOffer.imageUrl} alt={`عرض ${selectedGalleryOffer.name}`} className="max-h-[52vh] w-full object-cover" /><div className="p-6"><DialogHeader><DialogTitle className="text-right text-xl text-blue-950">{selectedGalleryOffer.name}</DialogTitle><DialogDescription className="text-right text-sm font-bold text-red-600">{selectedGalleryOffer.partnerName}</DialogDescription></DialogHeader><p className="mt-4 text-sm leading-7 text-slate-600">انتقل إلى قسم العروض لرؤية تفاصيل العرض والطلب من المتجر.</p><Button onClick={() => openOfferLocation(selectedGalleryOffer)} className="mt-5 w-full rounded-2xl bg-red-600 py-6 text-base hover:bg-red-700"><ShoppingBasket className="h-5 w-5" /> اطلبه الآن</Button></div></> : null}</DialogContent></Dialog>

      {screen === "home" ? (
        <>
          <section className="app-shell pt-7 pb-8">
            <div className="hero-panel">
              <div className="hero-orb hero-orb-one" /><div className="hero-orb hero-orb-two" />
              <PartnerOfferGallery slides={partnerGallerySlides} onOpen={setSelectedGalleryOffer} />
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
              <button className="service-card service-card-intercity" onClick={() => setScreen("intercity")}>
                <span className="service-card-icon"><Route /></span>
                <span className="service-content"><span className="service-title">اطلب من جرابلس</span><span className="service-subtitle">اختر حجزاً ثم اطلب من أقسام منبج</span></span>
                <ChevronLeft className="service-arrow" />
                <span className="service-watermark">03</span>
              </button>
              <button className="service-card service-card-offers" onClick={() => setScreen("offers")}>
                <span className="service-card-icon"><BadgePercent /></span>
                <span className="service-content"><span className="service-title">العروض</span><span className="service-subtitle">اكتشف عروض متاجر لحظة المتاحة الآن</span></span>
                <ChevronLeft className="service-arrow" />
                <span className="service-watermark">04</span>
              </button>
            </div>
            <div className="mt-8 flex items-center justify-center gap-2 text-xs text-slate-400"><Bike className="h-4 w-4 text-red-600" /><span>خدمة محلية مخصصة لمنبج</span></div>
          </section>
        </>
      ) : null}

      {screen === "delivery" ? (
        <>
          <PageHeading eyebrow={selectedIntercityTrip ? "اطلب من جرابلس" : "طلبك للبيت"} title="اختر احتياجك" detail={selectedIntercityTrip ? `طلبك سيُسجل ضمن ${selectedIntercityTrip.title}. أضف المنتجات من أقسام منبج ثم أرسل السلة.` : "أضف المنتجات من القسم المناسب، ثم راجع طلبك قبل الإرسال."} onBack={goHome} />
          <section className="app-shell pb-32">
            <div className="category-grid">
              {(Object.keys(categoryMeta) as LahzaCategory[]).map(category => {
                const meta = categoryMeta[category];
                const Icon = categoryIcons[category];
                const count = cart.filter(line => line.category === category).length;
                return <button key={category} onClick={() => { setSelectedStore(null); setActiveCategory(category); }} className="category-card">
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

      {screen === "intercity" ? (
        <IntercityBooking onBack={goHome} isStaticDemo={isStaticDemo} onChooseTrip={trip => { setSelectedIntercityTrip(trip); setScreen("delivery"); toast.success("تم اختيار الحجز. أضف منتجاتك من أقسام منبج."); }} />
      ) : null}

      {screen === "offers" ? (
        <OfferDestinationScreen offers={partnerOffers} onBack={goHome} loading={partnerOffersQuery.isLoading && !isStaticDemo} focusedOfferId={focusedOfferId} onOrder={openOfferStore} />
      ) : null}

      {screen === "checkout" ? (
        <>
          <PageHeading eyebrow="تأكيد الطلب" title={checkoutMode === "delivery" ? "راجع طلبك" : "تأكيد رحلتك"} detail="أدخل بيانات التواصل وحدد موقعك، ثم أرسل طلبك." onBack={() => setScreen(checkoutMode === "delivery" ? "delivery" : "taxi")} />
          <section className="app-shell space-y-5 pb-10">
            <div className="checkout-card">
              <div className="checkout-card-title"><ClipboardList className="h-5 w-5 text-red-600" /><span>{checkoutMode === "delivery" ? "ملخص الطلب" : "تفاصيل الرحلة"}</span></div>
              {selectedIntercityTrip && checkoutMode === "delivery" ? <div className="mt-3 rounded-2xl bg-blue-50 p-3 text-sm text-blue-950"><strong>الحجز المختار: {selectedIntercityTrip.title}</strong><span className="mt-1 block text-xs text-slate-600">{selectedIntercityTrip.bookingCloseLabel} · {selectedIntercityTrip.arrivalLabel}</span></div> : null}
              {checkoutMode === "delivery" ? <CartPreview cart={cart} removeLine={removeLine} total={total} hasPharmacy={hasPharmacy} /> : <div className="taxi-summary"><CarFront className="h-9 w-9 text-blue-900" /><div><strong>{taxiType === "van" ? "سيارة فان" : "تاكسي عادي"}</strong><span>{pickup || "موقع الانطلاق"} <ChevronLeft className="inline h-3 w-3" /> {destination || "الوجهة"}</span></div></div>}
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
      <StorePickerDialog category={selectedStore ? null : activeCategory} stores={categoryStores} loading={categoryStoresQuery.isLoading && !isStaticDemo} onChoose={store => setSelectedStore(store)} onClose={() => { setActiveCategory(null); setSelectedStore(null); }} />
      <CategoryDialog category={selectedStore ? activeCategory : null} storeName={selectedStore?.name ?? ""} products={selectedStoreProducts} loading={storeProductsQuery.isLoading && !isStaticDemo} onBack={() => setSelectedStore(null)} onClose={() => { setActiveCategory(null); setSelectedStore(null); }} onAdd={addLine} />
      <Dialog open={secretOpen} onOpenChange={setSecretOpen}><DialogContent dir="rtl" className="w-[calc(100%-2rem)] max-w-sm rounded-3xl border-0 bg-white p-6 shadow-2xl"><DialogHeader><div className="admin-lock-icon">L</div><DialogTitle className="pt-2 text-center text-xl">اختر نوع الدخول</DialogTitle><DialogDescription className="text-center">اختر حسابك ثم أدخل بياناته في المكان الصحيح.</DialogDescription></DialogHeader><div className="mt-3 space-y-4"><div className="role-switch"><button onClick={() => setSecretRole("owner")} className={secretRole === "owner" ? "role-selected" : ""}>المالك</button><button onClick={() => setSecretRole("supervisor")} className={secretRole === "supervisor" ? "role-selected" : ""}>مشرف</button><button onClick={() => setSecretRole("partner")} className={secretRole === "partner" ? "role-selected" : ""}>شريك</button></div>{secretRole === "owner" ? <div><Label htmlFor="pin">رمز PIN للمالك</Label><Input id="pin" inputMode="numeric" type="password" value={pin} onChange={e => setPin(e.target.value)} placeholder="••••" /></div> : secretRole === "supervisor" ? <><div><Label htmlFor="username">اسم المستخدم للمشرف</Label><Input id="username" dir="ltr" value={username} onChange={e => setUsername(e.target.value)} /></div><div><Label htmlFor="password">كلمة مرور المشرف</Label><Input id="password" dir="ltr" type="password" value={password} onChange={e => setPassword(e.target.value)} /></div></> : <div className="rounded-2xl bg-blue-50 p-4 text-center text-sm leading-6 text-blue-950">ستفتح لك صفحة الشريك لإدخال اسم المستخدم وكلمة المرور اللذين أنشأهما المالك.</div>}<Button disabled={secretRole !== "partner" && !isStaticDemo && adminLogin.isPending} className="w-full rounded-xl bg-blue-900 hover:bg-blue-950" onClick={handleAdminLogin}>{secretRole === "partner" ? "الانتقال إلى دخول الشريك" : !isStaticDemo && adminLogin.isPending ? "جارٍ التحقق..." : "دخول آمن"}</Button></div></DialogContent></Dialog>
    </main>
  );
}

function StorePickerDialog({ category, stores, loading, onChoose, onClose }: { category: LahzaCategory | null; stores: StoreOption[]; loading: boolean; onChoose: (store: StoreOption) => void; onClose: () => void }) {
  if (!category) return null;
  const meta = categoryMeta[category];
  return <Dialog open={Boolean(category)} onOpenChange={open => !open && onClose()}><DialogContent dir="rtl" className="w-[calc(100%-1.5rem)] max-w-lg rounded-3xl border-0 bg-white p-6 shadow-2xl"><DialogHeader><DialogTitle className="text-right text-xl">متاجر {meta.title}</DialogTitle><DialogDescription className="text-right">اختر المتجر الذي تريد الطلب منه، ثم أضف المنتجات إلى السلة.</DialogDescription></DialogHeader><div className="mt-4">{loading ? <div className="rounded-2xl bg-slate-50 p-5 text-center text-sm text-slate-500">جارٍ تحميل المتاجر...</div> : stores.length ? <div className="grid gap-3 sm:grid-cols-2">{stores.map(store => <button key={store.id} type="button" onClick={() => onChoose(store)} className="rounded-2xl border border-slate-100 bg-gradient-to-bl from-white to-slate-50 p-4 text-right shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md active:scale-[.98]"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-900"><Store className="h-5 w-5" /></span><strong className="mt-3 block text-base text-blue-950">{store.name}</strong><small className="mt-1 block text-xs text-slate-500">عرض منتجات المتجر</small></button>)}</div> : <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center"><Store className="mx-auto h-7 w-7 text-slate-400" /><strong className="mt-3 block text-blue-950">لا توجد متاجر مضافة بعد</strong><p className="mt-2 text-sm leading-6 text-slate-500">سيظهر أي متجر يضيفه المالك إلى قسم {meta.title} هنا.</p></div>}</div></DialogContent></Dialog>;
}

function CategoryDialog({ category, storeName, products, loading, onBack, onClose, onAdd }: { category: LahzaCategory | null; storeName: string; products: { id: number; name: string; unit: string; unitPrice: number; available: boolean }[]; loading: boolean; onBack: () => void; onClose: () => void; onAdd: (line: Omit<CartLine, "id">) => void }) {
  const [selectedId, setSelectedId] = useState("");
  const [manualName, setManualName] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [medicine, setMedicine] = useState("");
  if (!category) return null;
  const meta = categoryMeta[category];
  const options = products.filter(product => product.available);
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

function CartPreview({ cart, removeLine, total, hasPharmacy }: { cart: CartLine[]; removeLine: (id: string) => void; total: number; hasPharmacy: boolean }) {
  return <div className="mt-3"><div className="divide-y divide-slate-100">{cart.map(item => <div key={item.id} className="cart-line"><div><strong>{item.itemName}</strong><span>{item.quantity} {item.unit}</span></div><div className="flex items-center gap-3">{item.priceKnown ? <strong className="text-sm text-blue-900">{formatSyp(lineTotal(item))}</strong> : <small className="text-slate-400">السعر عند التأكيد</small>}<button onClick={() => removeLine(item.id)} aria-label="حذف"><Trash2 className="h-4 w-4 text-red-400" /></button></div></div>)}</div>{hasPharmacy ? <p className="pharmacy-note"><Pill className="h-4 w-4" />الأدوية لا تدخل في المجموع، ويؤكد سعرها المندوب.</p> : null}<p className="mt-3 text-center text-[11px] leading-5 text-slate-400">رسوم التوصيل يحددها المندوب بعد استلام الطلب.</p><div className="total-row"><span>إجمالي المنتجات المبدئي</span><strong>{formatSyp(total)}</strong></div></div>;
}

function OfferDestinationScreen({ offers, loading, onBack, focusedOfferId, onOrder }: { offers: Array<{ id: number; text: string; partnerName: string; storeName?: string | null; storeId?: number | null; storeCategory?: string | null }>; loading: boolean; onBack: () => void; focusedOfferId: number | null; onOrder: (offer: { storeId?: number | null; storeCategory?: string | null; storeName?: string | null; partnerName: string }) => void }) {
  return <><PageHeading eyebrow="عروض الشركاء" title="عروض متاجر لحظة" detail="اختر عرضاً ثم اطلبه مباشرة من متجره." onBack={onBack} /><section className="app-shell pb-12">{loading ? <div className="rounded-3xl bg-slate-50 p-6 text-center text-sm text-slate-500">جارٍ تحميل العروض...</div> : offers.length ? <div className="grid gap-4 sm:grid-cols-2">{offers.map(offer => <article key={offer.id} className={`rounded-3xl border bg-gradient-to-l from-amber-50 to-white p-5 shadow-sm transition ${focusedOfferId === offer.id ? "border-red-500 ring-4 ring-red-100" : "border-amber-200"}`}><span className="inline-flex rounded-full bg-amber-200 px-3 py-1 text-xs font-black text-amber-950">عرض نشط</span><h2 className="mt-4 text-xl font-black text-blue-950">{offer.text}</h2><p className="mt-2 text-sm font-bold leading-7 text-red-600">{offer.storeName ?? offer.partnerName}</p><Button onClick={() => onOrder(offer)} className="mt-5 w-full rounded-xl bg-red-600 hover:bg-red-700"><ShoppingBasket className="h-4 w-4" /> اطلب من المتجر</Button></article>)}</div> : <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center"><BadgePercent className="mx-auto h-7 w-7 text-red-600" /><h2 className="mt-3 text-lg font-black text-blue-950">لا توجد عروض نشطة الآن</h2><p className="mt-2 text-sm leading-7 text-slate-500">سيظهر العرض هنا فور إضافته وتفعيله من لوحة الشريك.</p></div>}</section></>;
}

function PartnerOffersScreen({ offers, loading, onBack }: { offers: Array<{ id: number; text: string; partnerName: string }>; loading: boolean; onBack: () => void }) {
  return <><PageHeading eyebrow="عروض الشركاء" title="عروض متاجر لحظة" detail="تظهر العروض النشطة فور تفعيلها من المتجر الشريك." onBack={onBack} /><section className="app-shell pb-12">{loading ? <div className="rounded-3xl bg-slate-50 p-6 text-center text-sm text-slate-500">جارٍ تحميل العروض...</div> : offers.length ? <div className="grid gap-4 sm:grid-cols-2">{offers.map(offer => <article key={offer.id} className="rounded-3xl border border-amber-200 bg-gradient-to-l from-amber-50 to-white p-5 shadow-sm"><span className="inline-flex rounded-full bg-amber-200 px-3 py-1 text-xs font-black text-amber-950">عرض نشط</span><h2 className="mt-4 text-xl font-black text-blue-950">{offer.partnerName}</h2><p className="mt-2 text-sm leading-7 text-slate-700">{offer.text}</p><span className="mt-5 block text-xs font-bold text-red-600">يظهر أيضاً في شريط عروض المتاجر</span></article>)}</div> : <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center"><BadgePercent className="mx-auto h-7 w-7 text-red-600" /><h2 className="mt-3 text-lg font-black text-blue-950">لا توجد عروض نشطة الآن</h2><p className="mt-2 text-sm leading-7 text-slate-500">سيظهر العرض هنا فور إضافته وتفعيله من لوحة الشريك.</p></div>}</section></>;
}
