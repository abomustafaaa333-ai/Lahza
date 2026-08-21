import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { IntercityBooking, type IntercityTripSelection } from "@/components/IntercityBooking";
import { trpc } from "@/lib/trpc";
import { getDeliveryCheckoutGate, MINIMUM_DELIVERY_ORDER_NEW_SYP, remainingDeliveryAmountNewSyp } from "@/lib/deliveryCheckout";
import { buildPartnerGallerySlides, type PartnerGallerySlide } from "@/lib/partnerGallery";
import { calculatePercentageDeliveryFeeNewSyp, catalogSeed, categoryMeta, DEFAULT_TICKER_PRIMARY, DEFAULT_TICKER_SECONDARY, formatNewSyp, formatSyp, normalizeTickerText, toNewSyp, type LahzaCategory } from "@shared/lahza";
import { getHomeShortcut } from "@shared/adminHomeShortcut";
import { isStoreClosedForCustomer } from "@shared/storeAvailability";
import { ArrowLeft, BadgePercent, Bike, CakeSlice, CarFront, ChevronLeft, CircleHelp, ClipboardList, CreditCard, Fuel, HandCoins, LayoutDashboard, LocateFixed, LogOut, MapPin, MessageCircle, Minus, PackagePlus, Phone, Pill, Plus, Route, Shirt, ShoppingBasket, Smartphone, Sparkles, Store, Trash2, Truck, UserRound, UtensilsCrossed, Wheat, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";

type Screen = "home" | "delivery" | "stores" | "store" | "productQuantity" | "storeOffers" | "offerQuantity" | "taxi" | "intercity" | "offers" | "checkout";
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

type StoreOption = { id: number; name: string; category: LahzaCategory; storeOpen?: boolean | null };
type StoreProduct = { id: number; name: string; unit: string; unitPrice: number; available: boolean };
type CustomerOffer = { id: number; text: string; partnerName: string; storeName?: string | null; storeId?: number | null; storeCategory?: string | null; catalogItemId?: number | null; productName?: string | null; productUnit?: string | null; productPrice?: number | null; imageUrl?: string | null; storeOpen?: boolean | null };

const isStaticDemo = import.meta.env.VITE_LAHZA_STATIC_DEMO === "true";
const demoAssetPrefix = isStaticDemo ? "." : "";
const demoGalleryImages = [
  `${demoAssetPrefix}/assets/lahza-legumes.webp`,
  `${demoAssetPrefix}/assets/lahza-butcher.webp`,
  `${demoAssetPrefix}/assets/lahza-chicken.webp`,
  `${demoAssetPrefix}/assets/lahza-pharmacy.webp`,
];
const lahzaWordmarkUrl = "https://lahzaapp-wge8gktc.manus.space/manus-storage/lahza-arabic-wordmark-cropped-v2_315134f0.png";
const minimumDeliveryOrderSyp = MINIMUM_DELIVERY_ORDER_NEW_SYP;

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
      <div className="app-shell flex h-[92px] items-center justify-between gap-3">
        <div className="contact-stack" aria-label="تواصل مع لحظة">
          <a className="contact-pill" href="tel:+963997311078" aria-label="اتصل بلحظة على الرقم +963997311078">
            <span dir="ltr">+963 997 311 078</span><Phone className="h-3.5 w-3.5" />
          </a>
          <a className="contact-pill contact-whatsapp" href="https://wa.me/963997311078" target="_blank" rel="noreferrer" aria-label="راسل لحظة عبر واتساب على الرقم +963997311078">
            <span dir="ltr">+963 997 311 078</span><MessageCircle className="h-3.5 w-3.5" />
          </a>
        </div>
        <button className="brand-mark" onDoubleClick={onSecret} title="انقر مرتين لدخول المالك أو المشرف أو الشريك">
          <span className="flex h-12 w-[138px] items-center justify-center rounded-xl bg-white"><img src={lahzaWordmarkUrl} alt="لحظة" className="h-12 w-full object-contain" /></span>
          <small>منبج بين يديك</small>
        </button>
        <button className="relative grid h-12 w-12 place-items-center rounded-2xl bg-slate-50 text-slate-700 shadow-sm transition hover:bg-slate-100 active:scale-95" onClick={onCart} aria-label="عرض السلة">
          <ShoppingBasket className="h-6 w-6" />
          {cartCount > 0 ? <span className="cart-count">{cartCount}</span> : null}
        </button>
      </div>
    </header>
  );
}

function PageHeading({ eyebrow, title, detail, onBack }: { eyebrow: string; title: string; detail: string; onBack: () => void }) {
  return (
    <section className="app-shell pt-7 pb-5">
      <p className="section-eyebrow">{eyebrow}</p>
      <h1 className="page-title">{title}</h1>
      <p className="page-detail">{detail}</p>
      <button className="mt-5 inline-flex min-h-12 items-center gap-2 rounded-2xl bg-blue-950 px-6 text-base font-black text-white shadow-md transition hover:bg-blue-900 active:scale-[0.97]" onClick={onBack}><ArrowLeft className="h-5 w-5" /> رجوع</button>
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
  const utils = trpc.useUtils();
  const [screen, setScreen] = useState<Screen>("home");
  const [selectedIntercityTrip, setSelectedIntercityTrip] = useState<IntercityTripSelection | null>(null);
  const [checkoutMode, setCheckoutMode] = useState<"delivery" | "taxi">("delivery");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [activeCategory, setActiveCategory] = useState<LahzaCategory | null>(null);
  const [selectedStore, setSelectedStore] = useState<StoreOption | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<StoreProduct | null>(null);
  const [selectedOffer, setSelectedOffer] = useState<CustomerOffer | null>(null);
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
  const deliveryFeesQuery = trpc.lahza.deliveryFees.get.useQuery(undefined, { enabled: !isStaticDemo, retry: false });
  const partnerOffersQuery = trpc.lahza.intercity.offers.useQuery(undefined, { enabled: !isStaticDemo, retry: false });
  const adminSessionQuery = trpc.lahza.admin.session.useQuery(undefined, { enabled: !isStaticDemo, retry: false });
  const partnerSessionQuery = trpc.lahza.partner.session.useQuery(undefined, { enabled: !isStaticDemo, retry: false });
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
      utils.lahza.admin.session.invalidate();
      setSecretOpen(false);
      toast.success("تم فتح لوحة الحساب بنجاح");
      setLocation("/admin");
    },
    onError: error => toast.error(error.message),
  });
  const partnerLogin = trpc.lahza.partner.login.useMutation({
    onSuccess: result => {
      utils.lahza.partner.session.invalidate();
      setSecretOpen(false);
      toast.success(`أهلاً بك في متجر ${result.name}`);
      setLocation("/");
    },
    onError: error => toast.error(error.message),
  });
  const adminHomeLogout = trpc.lahza.admin.logout.useMutation({
    onSuccess: () => {
      utils.lahza.admin.session.setData(undefined, null);
      toast.success("تم تسجيل الخروج من لوحة التحكم");
    },
    onError: error => toast.error(error.message),
  });
  const partnerHomeLogout = trpc.lahza.partner.logout.useMutation({
    onSuccess: () => {
      utils.lahza.partner.session.setData(undefined, null);
      toast.success("تم تسجيل الخروج من حساب الشريك");
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
  const deliveryPercent = selectedIntercityTrip ? (deliveryFeesQuery.data?.jarabulusPercent ?? 30) : (deliveryFeesQuery.data?.manbijPercent ?? 20);
  const deliveryFeeNewSyp = checkoutMode === "delivery" ? calculatePercentageDeliveryFeeNewSyp(total, deliveryPercent) : 0;
  const grandTotalNewSyp = toNewSyp(total) + deliveryFeeNewSyp;
  const hasPharmacy = cart.some(item => item.category === "pharmacy");
  const partnerOffers = isStaticDemo ? staticDemoProducts.filter(product => product.category === "offers").map(product => ({ id: product.id, text: product.unitPrice > 0 ? `${product.name} — ${formatSyp(product.unitPrice)}` : product.name, partnerName: "شريك لحظة", storeName: "متجر لحظة التجريبي", storeId: -1, storeCategory: "offers" })) : partnerOffersQuery.data ?? [];
  const tickerOffers: CustomerOffer[] = partnerOffers.length ? partnerOffers : [{ id: -1, text: "عروض متاجر لحظة — سيظهر أول عرض هنا فور نشره من المتجر", partnerName: "لحظة", imageUrl: null }];
  const partnerGallerySlides = isStaticDemo
    ? demoGalleryImages.map((imageUrl, index) => ({ id: 1004 + index, imageUrl, name: index === 0 ? "عرض طعميني — صحن حلويات" : "عرض متجر لحظة التجريبي", partnerName: "متجر لحظة التجريبي", storeId: -1, storeCategory: "offers", unitPrice: 0 }))
    : buildPartnerGallerySlides(partnerOffersQuery.data ?? []);
  const homeShortcut = !isStaticDemo && partnerSessionQuery.isLoading
    ? null
    : getHomeShortcut({ adminRole: adminSessionQuery.data?.role, partnerActive: Boolean(partnerSessionQuery.data) });
  const homeAccountKind = homeShortcut?.path === "/partner/store" ? "partner" : homeShortcut?.path === "/admin" ? "admin" : null;

  const addLine = (line: Omit<CartLine, "id">, returnTo: Screen = "store") => {
    setCart(current => [...current, { ...line, id: `${Date.now()}-${Math.random()}` }]);
    toast.success("أُضيف إلى السلة");
    setScreen(returnTo);
  };

  const removeLine = (id: string) => {
    setCart(current => current.filter(item => item.id !== id));
  };

  const openDeliveryCheckout = () => {
    const gate = getDeliveryCheckoutGate(cart.length, total);
    if (!gate.allowed) {
      toast.error(gate.message);
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
    const isTaxi = checkoutMode === "taxi";
    if (!isTaxi && toNewSyp(total) < minimumDeliveryOrderSyp) {
      toast.error(`الحد الأدنى لمجموع الطلب هو ${formatNewSyp(minimumDeliveryOrderSyp)}`);
      return;
    }
    if (!checkoutName.trim() || !customerLocation.trim() || !locationVerified || !customerLocationUrl || customerLat === null || customerLng === null) {
      toast.error("أدخل الاسم واضغط تحديد موقعي أولاً قبل إرسال الطلب");
      return;
    }
    if (!/^9\d{8}$/.test(checkoutPhone)) {
      toast.error("أدخل رقم هاتف سوري يبدأ بالرقم 9");
      return;
    }
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
    setSelectedProduct(null);
    setSelectedOffer(null);
    setSelectedIntercityTrip(null);
  };

  const openOfferLocation = (offer: PartnerGallerySlide) => {
    setSelectedGalleryOffer(null);
    setFocusedOfferId(offer.id);
    setScreen("offers");
  };

  const chooseOffer = (offer: CustomerOffer) => {
    setSelectedOffer(offer);
    setFocusedOfferId(null);
    setScreen("offerQuantity");
  };

  const handleAdminLogin = () => {
    if (secretRole === "partner") {
      partnerLogin.mutate({ username: username.trim(), password });
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
      <Header onSecret={() => setSecretOpen(true)} onCart={openDeliveryCheckout} cartCount={cart.length} />
      <div className="reward-ticker" aria-label="رسائل لحظة"><div className="reward-ticker-track"><span>{tickerPrimary}<b aria-hidden="true">★</b>{tickerSecondary}</span><span aria-hidden="true">{tickerPrimary}<b>★</b>{tickerSecondary}</span></div></div>
      <div className="partner-offer-ticker" aria-label="عروض المتاجر"><div className="partner-offer-label"><BadgePercent className="h-3.5 w-3.5" /> عروض المتاجر</div><div className="partner-offer-ticker-window"><div className="partner-offer-ticker-track">{[...tickerOffers, ...tickerOffers].map((offer, index) => <span key={`${offer.id}-${index}`}><button type="button" onClick={() => offer.id > 0 && setSelectedGalleryOffer({ id: offer.id, imageUrl: offer.imageUrl ?? "", name: offer.text, partnerName: offer.partnerName, storeId: offer.storeId ?? null, storeCategory: offer.storeCategory ?? null, unitPrice: offer.productPrice ?? 0, storeOpen: offer.storeOpen })} className="cursor-pointer text-right transition hover:text-red-700" aria-label={`فتح عرض ${offer.text}`}>{offer.partnerName} — {offer.text}</button><b aria-hidden="true">★</b></span>)}</div></div></div>

      <Dialog open={Boolean(selectedGalleryOffer)} onOpenChange={open => !open && setSelectedGalleryOffer(null)}><DialogContent showCloseButton={false} dir="rtl" className="w-[calc(100%-1.5rem)] max-w-lg overflow-hidden rounded-3xl border-0 bg-white p-0 shadow-2xl">{selectedGalleryOffer ? <><DialogClose aria-label="إغلاق العرض" className="absolute right-4 top-4 z-10 grid h-12 w-12 place-items-center rounded-full border border-white/70 bg-slate-950/50 text-white shadow-lg backdrop-blur-sm transition hover:scale-105 hover:bg-slate-950/70 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2"><X className="h-7 w-7" strokeWidth={3} /><span className="sr-only">إغلاق العرض</span></DialogClose>{selectedGalleryOffer.imageUrl ? <img src={selectedGalleryOffer.imageUrl} alt={`عرض ${selectedGalleryOffer.name}`} className="max-h-[52vh] w-full object-cover" /> : <div className="grid h-52 place-items-center bg-gradient-to-br from-red-600 to-orange-500 text-white"><BadgePercent className="h-14 w-14" /></div>}<div className="p-6"><DialogHeader><DialogTitle className="text-right text-xl text-blue-950">{selectedGalleryOffer.name}</DialogTitle><DialogDescription className="text-right text-sm font-bold text-red-600">{selectedGalleryOffer.partnerName}</DialogDescription></DialogHeader><p className="mt-4 text-sm leading-7 text-slate-600">انتقل إلى قسم العروض لرؤية تفاصيل العرض والطلب من المتجر.</p><Button onClick={() => openOfferLocation(selectedGalleryOffer)} className="mt-5 w-full rounded-2xl bg-red-600 py-6 text-base hover:bg-red-700"><ShoppingBasket className="h-5 w-5" /> اطلبه الآن</Button></div></> : null}</DialogContent></Dialog>

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
            {homeShortcut ? <div className="mt-5 space-y-2"><button type="button" onClick={() => setLocation(homeShortcut.path)} className="flex w-full items-center gap-3 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-right text-blue-950 shadow-sm transition hover:bg-blue-100 active:scale-[0.98]" aria-label={`فتح ${homeShortcut.label}`}><span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-900 text-white">{homeShortcut.path === "/partner/store" ? <Store className="h-5 w-5" /> : <LayoutDashboard className="h-5 w-5" />}</span><span className="flex min-w-0 flex-1 flex-col gap-1"><strong className="text-sm font-black">{homeShortcut.label}</strong><small className="text-xs font-medium text-slate-600">{homeShortcut.description}</small></span><ChevronLeft className="h-5 w-5 text-blue-900" /></button><button type="button" onClick={() => homeAccountKind === "partner" ? partnerHomeLogout.mutate() : adminHomeLogout.mutate()} disabled={partnerHomeLogout.isPending || adminHomeLogout.isPending} className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-red-100 bg-red-50 px-4 py-2.5 text-sm font-bold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed"><LogOut className="h-4 w-4" />{partnerHomeLogout.isPending || adminHomeLogout.isPending ? "جارٍ تسجيل الخروج..." : "تسجيل الخروج"}</button></div> : null}
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
                return <button key={category} onClick={() => { setSelectedStore(null); setSelectedProduct(null); setActiveCategory(category); setScreen("stores"); }} className="category-card">
                  <span className={`category-icon bg-gradient-to-br ${categoryColors[category]}`}><Icon className="h-5 w-5" /></span>
                  <span className="category-card-copy"><span>{meta.title}</span><small>{meta.subtitle}</small></span>
                  {count > 0 ? <span className="category-badge">{count}</span> : <Plus className="h-4 w-4 text-slate-300" />}
                </button>;
              })}
            </div>
          </section>
          <div className="bottom-cta"><div><span>السلة</span><strong>{cart.length ? `${cart.length} أصناف` : "فارغة"}</strong></div><Button disabled={!cart.length} onClick={openDeliveryCheckout} className="rounded-2xl bg-red-600 px-6 text-white hover:bg-red-700">متابعة <ChevronLeft className="mr-1 h-4 w-4" /></Button></div>
        </>
      ) : null}

      {screen === "stores" && activeCategory ? <StoresScreen category={activeCategory} stores={categoryStores} loading={categoryStoresQuery.isLoading && !isStaticDemo} onBack={() => { setScreen("delivery"); setActiveCategory(null); }} onChoose={store => { setSelectedStore(store); setScreen("store"); }} /> : null}
      {screen === "store" && selectedStore ? <StoreProductsScreen store={selectedStore} products={selectedStoreProducts} loading={storeProductsQuery.isLoading && !isStaticDemo} onBack={() => { setScreen("stores"); setSelectedProduct(null); }} onChooseProduct={product => { setSelectedProduct(product); setScreen("productQuantity"); }} onOpenOffers={() => setScreen("storeOffers")} /> : null}
      {screen === "productQuantity" && selectedStore && selectedProduct ? <ProductQuantityScreen store={selectedStore} product={selectedProduct} onBack={() => setScreen("store")} onAdd={quantity => { if (isStoreClosedForCustomer(selectedStore.storeOpen)) { toast.error("المتجر مغلق حالياً"); return; } addLine({ category: selectedStore.category, itemName: selectedProduct.name, quantity, unit: selectedProduct.unit, unitPrice: selectedProduct.unitPrice, catalogItemId: selectedProduct.id < 0 ? undefined : selectedProduct.id, priceKnown: selectedStore.category !== "pharmacy" && selectedProduct.unitPrice > 0 }, "store"); }} /> : null}
      {screen === "storeOffers" && selectedStore ? <StoreOffersScreen store={selectedStore} offers={(partnerOffers as CustomerOffer[]).filter(offer => offer.storeId === selectedStore.id)} loading={partnerOffersQuery.isLoading && !isStaticDemo} onBack={() => setScreen("store")} onChoose={chooseOffer} /> : null}

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
        <OfferDestinationScreen offers={partnerOffers as CustomerOffer[]} onBack={goHome} loading={partnerOffersQuery.isLoading && !isStaticDemo} focusedOfferId={focusedOfferId} onChoose={chooseOffer} />
      ) : null}

      {screen === "offerQuantity" && selectedOffer ? <OfferQuantityScreen offer={selectedOffer} onBack={() => setScreen(selectedStore && selectedOffer.storeId === selectedStore.id ? "storeOffers" : "offers")} onAdd={quantity => { if (isStoreClosedForCustomer(selectedOffer.storeOpen)) { toast.error("المتجر مغلق حالياً"); return; } const category = selectedOffer.storeCategory && selectedOffer.storeCategory in categoryMeta ? selectedOffer.storeCategory as LahzaCategory : "offers"; addLine({ category, catalogItemId: selectedOffer.catalogItemId ?? undefined, itemName: selectedOffer.productName ?? selectedOffer.text, quantity, unit: selectedOffer.productUnit ?? "وحدة", unitPrice: selectedOffer.productPrice ?? 0, priceKnown: Boolean(selectedOffer.productPrice && selectedOffer.productPrice > 0) }, selectedStore && selectedOffer.storeId === selectedStore.id ? "storeOffers" : "offers"); }} /> : null}

      {screen === "checkout" ? (
        <>
          <PageHeading eyebrow="تأكيد الطلب" title={checkoutMode === "delivery" ? "راجع طلبك" : "تأكيد رحلتك"} detail="أدخل بيانات التواصل وحدد موقعك، ثم أرسل طلبك." onBack={() => setScreen(checkoutMode === "delivery" ? "delivery" : "taxi")} />
          <section className="app-shell space-y-5 pb-10">
            <div className="checkout-card">
              <div className="checkout-card-title"><ClipboardList className="h-5 w-5 text-red-600" /><span>{checkoutMode === "delivery" ? "ملخص الطلب" : "تفاصيل الرحلة"}</span></div>
              {selectedIntercityTrip && checkoutMode === "delivery" ? <div className="mt-3 rounded-2xl bg-blue-50 p-3 text-sm text-blue-950"><strong>الحجز المختار: {selectedIntercityTrip.title}</strong><span className="mt-1 block text-xs text-slate-600">{selectedIntercityTrip.bookingCloseLabel} · {selectedIntercityTrip.arrivalLabel}</span></div> : null}
              {checkoutMode === "delivery" ? <CartPreview cart={cart} removeLine={removeLine} total={total} hasPharmacy={hasPharmacy} deliveryFeeNewSyp={deliveryFeeNewSyp} deliveryPercent={deliveryPercent} deliveryArea={selectedIntercityTrip ? "جرابلس" : "منبج"} grandTotalNewSyp={grandTotalNewSyp} /> : <div className="taxi-summary"><CarFront className="h-9 w-9 text-blue-900" /><div><strong>{taxiType === "van" ? "سيارة فان" : "تاكسي عادي"}</strong><span>{pickup || "موقع الانطلاق"} <ChevronLeft className="inline h-3 w-3" /> {destination || "الوجهة"}</span></div></div>}
            </div>
            <div className="checkout-card space-y-4">
              <div className="checkout-card-title"><UserRound className="h-5 w-5 text-red-600" /><span>بيانات التواصل وموقع الطلب</span></div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><div><Label htmlFor="customerName">الاسم</Label><Input id="customerName" value={checkoutName} onChange={e => setCheckoutName(e.target.value)} placeholder="اكتب الاسم" /></div><div><Label htmlFor="customerPhone">رقم الهاتف السوري</Label><div className="phone-entry" dir="ltr"><span>+963</span><Input id="customerPhone" inputMode="numeric" value={checkoutPhone} onChange={e => setCheckoutPhone(e.target.value.replace(/\D/g, "").slice(0, 9))} placeholder="9XXXXXXXX" /></div><small className="phone-help">اكتب الرقم ابتداءً من 9، من دون الصفر الأول.</small></div></div>
                <div><Label htmlFor="customerLocation">موقعك</Label><Input id="customerLocation" value={customerLocation} readOnly placeholder="استخدم زر تحديد موقعي" /><div className="location-actions"><button onClick={locateCustomer} disabled={locating}><LocateFixed className="h-4 w-4" />{locating ? "جارٍ التحديد..." : "تحديد موقعي"}</button></div>{locationVerified ? <p className="verified-location">تم التحقق من الموقع عبر GPS</p> : <p className="location-required-note">اضغط تحديد موقعي لتأكيد طلبك.</p>}</div>
                <div><Label htmlFor="notes">ملاحظات إضافية <span className="text-slate-400">(اختياري)</span></Label><Textarea id="notes" value={notes} onChange={e => setNotes(e.target.value)} placeholder="أي تفاصيل مفيدة للطلب أو للمندوب" /></div>
            </div>
            <div className="checkout-card"><div className="checkout-card-title"><CreditCard className="h-5 w-5 text-red-600" /><span>طريقة الدفع</span></div><div className="payment-grid"><button onClick={() => setPayment("sham_cash")} className={payment === "sham_cash" ? "payment-active" : ""}><span className="payment-icon payment-icon-blue">ش</span><span>شام كاش</span></button><button onClick={() => setPayment("cash")} className={payment === "cash" ? "payment-active" : ""}><HandCoins className="h-5 w-5" /><span>نقداً عند الاستلام</span></button></div></div>
            {checkoutMode === "delivery" && remainingDeliveryAmountNewSyp(total) > 0 ? <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-center text-sm font-bold leading-6 text-amber-900">الحد الأدنى لمجموع الطلب هو {formatNewSyp(minimumDeliveryOrderSyp)}. أضف منتجات بقيمة {formatNewSyp(remainingDeliveryAmountNewSyp(total))} أو أكثر لتأكيد الطلب.</p> : null}
            <button disabled={createOrder.isPending || (checkoutMode === "delivery" && remainingDeliveryAmountNewSyp(total) > 0)} onClick={submitCheckout} className="primary-full-button">{createOrder.isPending ? "جارٍ إرسال الطلب..." : "تأكيد وإرسال الطلب"}<ChevronLeft className="h-5 w-5" /></button>
          </section>
        </>
      ) : null}

      <footer className="app-shell pb-8 text-center text-xs font-medium tracking-wide text-slate-400" dir="ltr">Designed by Ahmad barho</footer>
      <Dialog open={secretOpen} onOpenChange={setSecretOpen}><DialogContent dir="rtl" className="w-[calc(100%-2rem)] max-w-sm rounded-3xl border-0 bg-white p-6 shadow-2xl"><DialogHeader><div className="admin-lock-icon">L</div><DialogTitle className="pt-2 text-center text-xl">اختر نوع الدخول</DialogTitle><DialogDescription className="text-center">اختر حسابك ثم أدخل بياناته في المكان الصحيح.</DialogDescription></DialogHeader><div className="mt-3 space-y-4"><div className="role-switch"><button onClick={() => setSecretRole("owner")} className={secretRole === "owner" ? "role-selected" : ""}>المالك</button><button onClick={() => setSecretRole("supervisor")} className={secretRole === "supervisor" ? "role-selected" : ""}>مشرف</button><button onClick={() => setSecretRole("partner")} className={secretRole === "partner" ? "role-selected" : ""}>شريك</button></div>{secretRole === "owner" ? <div><Label htmlFor="pin">رمز PIN للمالك</Label><Input id="pin" inputMode="numeric" type="password" value={pin} onChange={e => setPin(e.target.value)} placeholder="••••" /></div> : <><div><Label htmlFor="username">اسم المستخدم {secretRole === "partner" ? "للشريك" : "للمشرف"}</Label><Input id="username" dir="ltr" value={username} onChange={e => setUsername(e.target.value)} /></div><div><Label htmlFor="password">كلمة المرور {secretRole === "partner" ? "للشريك" : "للمشرف"}</Label><Input id="password" dir="ltr" type="password" value={password} onChange={e => setPassword(e.target.value)} /></div></>}<Button disabled={secretRole === "partner" ? partnerLogin.isPending || !username.trim() || !password : !isStaticDemo && (adminLogin.isPending || (secretRole === "owner" ? !pin : !username.trim() || !password))} className="w-full rounded-xl bg-blue-900 hover:bg-blue-950" onClick={handleAdminLogin}>{secretRole === "partner" ? partnerLogin.isPending ? "جارٍ فتح حساب الشريك..." : "دخول الشريك" : !isStaticDemo && adminLogin.isPending ? "جارٍ التحقق..." : "دخول آمن"}</Button></div></DialogContent></Dialog>
    </main>
  );
}

function StoresScreen({ category, stores, loading, onBack, onChoose }: { category: LahzaCategory; stores: StoreOption[]; loading: boolean; onBack: () => void; onChoose: (store: StoreOption) => void }) {
  const meta = categoryMeta[category];
  return <><PageHeading eyebrow="متاجر القسم" title={`متاجر ${meta.title}`} detail="اختر متجراً لعرض منتجاته وعروضه في صفحة مستقلة." onBack={onBack} /><section className="app-shell pb-12">{loading ? <div className="rounded-3xl bg-slate-50 p-6 text-center text-sm text-slate-500">جارٍ تحميل المتاجر...</div> : stores.length ? <div className="grid gap-3 sm:grid-cols-2">{stores.map(store => <button key={store.id} onClick={() => onChoose(store)} className="rounded-3xl border border-slate-100 bg-gradient-to-bl from-white to-slate-50 p-5 text-right shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md active:scale-[.98]"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-900"><Store className="h-5 w-5" /></span><strong className="mt-4 block text-lg text-blue-950">{store.name}</strong><small className="mt-1 block text-xs text-slate-500">فتح صفحة المتجر</small></button>)}</div> : <EmptyStoreList categoryTitle={meta.title} />}</section></>;
}

function StoreProductsScreen({ store, products, loading, onBack, onChooseProduct, onOpenOffers }: { store: StoreOption; products: StoreProduct[]; loading: boolean; onBack: () => void; onChooseProduct: (product: StoreProduct) => void; onOpenOffers: () => void }) {
  return <><PageHeading eyebrow="صفحة المتجر" title={store.name} detail="اختر منتجاً لتحديد كميته، أو افتح عروض المتجر." onBack={onBack} /><section className="app-shell pb-12"><button onClick={onOpenOffers} className="mb-5 flex w-full items-center justify-between rounded-3xl bg-gradient-to-l from-red-600 to-rose-600 p-5 text-right text-white shadow-lg shadow-red-100"><span><strong className="block text-lg">عروض {store.name}</strong><small className="mt-1 block text-red-100">افتح صفحة عروض المتجر</small></span><BadgePercent className="h-7 w-7" /></button>{loading ? <div className="rounded-3xl bg-slate-50 p-6 text-center text-sm text-slate-500">جارٍ تحميل المنتجات...</div> : products.filter(product => product.available).length ? <div className="grid gap-3 sm:grid-cols-2">{products.filter(product => product.available).map(product => <button key={product.id} onClick={() => onChooseProduct(product)} className="rounded-3xl border border-slate-100 bg-white p-4 text-right shadow-sm transition hover:border-blue-200 hover:shadow-md active:scale-[.98]"><strong className="block text-base text-blue-950">{product.name}</strong><span className="mt-2 block text-sm font-bold text-red-600">{store.category === "pharmacy" || !product.unitPrice ? "يحدد السعر عند التأكيد" : formatSyp(product.unitPrice)}</span><small className="mt-1 block text-xs text-slate-500">اضغط لاختيار الكمية</small></button>)}</div> : <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center"><PackagePlus className="mx-auto h-7 w-7 text-slate-400" /><strong className="mt-3 block text-blue-950">لا توجد منتجات متاحة حالياً</strong></div>}</section></>;
}

function ProductQuantityScreen({ store, product, onBack, onAdd }: { store: StoreOption; product: StoreProduct; onBack: () => void; onAdd: (quantity: number) => void }) {
  const [quantity, setQuantity] = useState("1");
  const parsed = Number(quantity);
  const add = () => { if (!Number.isFinite(parsed) || parsed <= 0) return toast.error("أدخل كمية صالحة"); onAdd(parsed); };
  return <><PageHeading eyebrow={store.name} title="حدد الكمية" detail="اختر كمية المنتج ثم أضفه إلى السلة." onBack={onBack} /><section className="app-shell pb-12"><div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm"><p className="text-xs font-bold text-slate-400">الصنف المختار</p><h2 className="mt-1 text-xl font-black text-blue-950">{product.name}</h2><p className="mt-2 text-sm font-bold text-red-600">{store.category === "pharmacy" || !product.unitPrice ? "يحدد السعر عند التأكيد" : formatSyp(product.unitPrice)}</p><div className="mt-6"><Label>الكمية {product.unit !== "وحدة" ? `(${product.unit})` : ""}</Label><div className="quantity-control mt-2"><button onClick={() => setQuantity(value => String(Math.max(product.unit === "ليتر" ? 0.1 : 1, Number(value || 1) - (product.unit === "جرام" ? 50 : 1))))}><Minus className="h-4 w-4" /></button><Input type="number" min={product.unit === "ليتر" ? "0.1" : "1"} step={product.unit === "جرام" ? "50" : "1"} value={quantity} onChange={event => setQuantity(event.target.value)} /><button onClick={() => setQuantity(value => String(Number(value || 0) + (product.unit === "جرام" ? 50 : 1)))}><Plus className="h-4 w-4" /></button></div></div><Button onClick={add} className="mt-6 w-full rounded-2xl bg-red-600 py-6 hover:bg-red-700"><ShoppingBasket className="h-5 w-5" /> أضف إلى السلة</Button></div></section></>;
}

function StoreOffersScreen({ store, offers, loading, onBack, onChoose }: { store: StoreOption; offers: CustomerOffer[]; loading: boolean; onBack: () => void; onChoose: (offer: CustomerOffer) => void }) {
  return <><PageHeading eyebrow="عروض المتجر" title={`عروض ${store.name}`} detail="اضغط على العرض المختار ثم حدّد كميته فقط." onBack={onBack} /><section className="app-shell pb-12">{loading ? <div className="rounded-3xl bg-slate-50 p-6 text-center text-sm text-slate-500">جارٍ تحميل العروض...</div> : offers.length ? <div className="grid gap-4 sm:grid-cols-2">{offers.map(offer => <button key={offer.id} onClick={() => onChoose(offer)} className="overflow-hidden rounded-3xl border border-amber-200 bg-gradient-to-l from-amber-50 to-white text-right shadow-sm transition hover:-translate-y-0.5 active:scale-[.98]">{offer.imageUrl ? <img src={offer.imageUrl} alt="" className="h-40 w-full object-cover" /> : null}<span className="block p-5"><span className="inline-flex rounded-full bg-amber-200 px-3 py-1 text-xs font-black text-amber-950">عرض نشط</span><strong className="mt-4 block text-lg text-blue-950">{offer.text}</strong><small className="mt-2 block text-red-600">اضغط لاختيار الكمية</small></span></button>)}</div> : <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center"><BadgePercent className="mx-auto h-7 w-7 text-red-600" /><h2 className="mt-3 text-lg font-black text-blue-950">لا توجد عروض نشطة لهذا المتجر</h2></div>}</section></>;
}

function OfferQuantityScreen({ offer, onBack, onAdd }: { offer: CustomerOffer; onBack: () => void; onAdd: (quantity: number) => void }) {
  const [quantity, setQuantity] = useState("1");
  const parsed = Number(quantity);
  const add = () => { if (!Number.isFinite(parsed) || parsed <= 0) return toast.error("أدخل كمية صالحة"); onAdd(parsed); };
  const productName = offer.productName ?? offer.text;
  return <><PageHeading eyebrow={offer.storeName ?? offer.partnerName} title="حدد كمية العرض" detail="وصف العرض ظاهر أدناه، بينما أُختير صنفه من متجر الشريك مسبقاً." onBack={onBack} /><section className="app-shell pb-12"><div className="rounded-3xl border border-amber-200 bg-gradient-to-l from-amber-50 to-white p-5 shadow-sm">{offer.imageUrl ? <img src={offer.imageUrl} alt="" className="mb-5 h-44 w-full rounded-2xl object-cover" /> : null}<Label>وصف العرض</Label><div className="mt-2 rounded-2xl border border-amber-200 bg-white px-4 py-3 font-bold text-slate-700">{offer.text}</div><Label className="mt-5 block">صنف العرض</Label><div className="mt-2 rounded-2xl border border-amber-200 bg-white px-4 py-3 text-lg font-black text-blue-950">{productName}</div><p className="mt-2 text-xs text-slate-500">تم تحديد الصنف من منتجات المتجر؛ عدّل الكمية فقط.</p>{offer.productPrice ? <p className="mt-3 text-sm font-bold text-red-600">{formatSyp(offer.productPrice)}</p> : null}<div className="mt-6"><Label>الكمية {offer.productUnit && offer.productUnit !== "وحدة" ? `(${offer.productUnit})` : ""}</Label><div className="quantity-control mt-2"><button onClick={() => setQuantity(value => String(Math.max(1, Number(value || 1) - 1)))}><Minus className="h-4 w-4" /></button><Input type="number" min="1" step="1" value={quantity} onChange={event => setQuantity(event.target.value)} /><button onClick={() => setQuantity(value => String(Number(value || 0) + 1))}><Plus className="h-4 w-4" /></button></div></div><Button onClick={add} className="mt-6 w-full rounded-2xl bg-red-600 py-6 hover:bg-red-700"><ShoppingBasket className="h-5 w-5" /> أضف الصنف إلى السلة</Button></div></section></>;
}

function EmptyStoreList({ categoryTitle }: { categoryTitle: string }) { return <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center"><Store className="mx-auto h-7 w-7 text-slate-400" /><strong className="mt-3 block text-blue-950">لا توجد متاجر مضافة بعد</strong><p className="mt-2 text-sm leading-6 text-slate-500">سيظهر أي متجر يضيفه المالك إلى قسم {categoryTitle} هنا.</p></div>; }

function CartPreview({ cart, removeLine, total, hasPharmacy, deliveryFeeNewSyp, deliveryPercent, deliveryArea, grandTotalNewSyp }: { cart: CartLine[]; removeLine: (id: string) => void; total: number; hasPharmacy: boolean; deliveryFeeNewSyp: number; deliveryPercent: number; deliveryArea: "منبج" | "جرابلس"; grandTotalNewSyp: number }) {
  return <div className="mt-3"><div className="divide-y divide-slate-100">{cart.map(item => <div key={item.id} className="cart-line"><div><strong>{item.itemName}</strong><span>{item.quantity} {item.unit}</span></div><div className="flex items-center gap-3">{item.priceKnown ? <strong className="text-sm text-blue-900">{formatSyp(lineTotal(item))}</strong> : <small className="text-slate-400">السعر عند التأكيد</small>}<button onClick={() => removeLine(item.id)} aria-label="حذف"><Trash2 className="h-4 w-4 text-red-400" /></button></div></div>)}</div>{hasPharmacy ? <p className="pharmacy-note"><Pill className="h-4 w-4" />الأدوية لا تدخل في المجموع، ويؤكد سعرها المندوب.</p> : null}<p className="mt-3 text-center text-[11px] leading-5 text-slate-400">يُحسب الحد الأدنى 300 ل.س جديدة من قيمة المنتجات فقط، قبل رسوم التوصيل.</p><div className="total-row"><span>إجمالي المنتجات</span><strong>{formatSyp(total)}</strong></div><div className="total-row"><span>رسوم توصيل {deliveryArea} ({deliveryPercent}%)</span><strong>{formatNewSyp(deliveryFeeNewSyp)}</strong></div><div className="total-row border-t-2 border-blue-100 pt-3 text-base"><span>الإجمالي النهائي</span><strong>{formatNewSyp(grandTotalNewSyp)}</strong></div></div>;
}

function OfferDestinationScreen({ offers, loading, onBack, focusedOfferId, onChoose }: { offers: CustomerOffer[]; loading: boolean; onBack: () => void; focusedOfferId: number | null; onChoose: (offer: CustomerOffer) => void }) {
  return <><PageHeading eyebrow="عروض الشركاء" title="عروض متاجر لحظة" detail="اختر عرضاً ثم عدّل الكمية وأضفه إلى السلة مباشرةً." onBack={onBack} /><section className="app-shell pb-12">{loading ? <div className="rounded-3xl bg-slate-50 p-6 text-center text-sm text-slate-500">جارٍ تحميل العروض...</div> : offers.length ? <div className="grid gap-4 sm:grid-cols-2">{offers.map(offer => <button key={offer.id} onClick={() => onChoose(offer)} className={`overflow-hidden rounded-3xl border bg-gradient-to-l from-amber-50 to-white text-right shadow-sm transition hover:-translate-y-0.5 active:scale-[.98] ${focusedOfferId === offer.id ? "border-red-500 ring-4 ring-red-100" : "border-amber-200"}`}>{offer.imageUrl ? <img src={offer.imageUrl} alt="" className="h-40 w-full object-cover" /> : null}<span className="block p-5"><span className="inline-flex rounded-full bg-amber-200 px-3 py-1 text-xs font-black text-amber-950">عرض نشط</span><strong className="mt-4 block text-xl text-blue-950">{offer.text}</strong><span className="mt-2 block text-sm font-bold leading-7 text-red-600">{offer.storeName ?? offer.partnerName}</span><span className="mt-4 block text-xs font-bold text-blue-900">اضغط لاختيار الكمية</span></span></button>)}</div> : <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center"><BadgePercent className="mx-auto h-7 w-7 text-red-600" /><h2 className="mt-3 text-lg font-black text-blue-950">لا توجد عروض نشطة الآن</h2><p className="mt-2 text-sm leading-7 text-slate-500">سيظهر العرض هنا فور إضافته وتفعيله من لوحة الشريك.</p></div>}</section></>;
}

function PartnerOffersScreen({ offers, loading, onBack }: { offers: Array<{ id: number; text: string; partnerName: string }>; loading: boolean; onBack: () => void }) {
  return <><PageHeading eyebrow="عروض الشركاء" title="عروض متاجر لحظة" detail="تظهر العروض النشطة فور تفعيلها من المتجر الشريك." onBack={onBack} /><section className="app-shell pb-12">{loading ? <div className="rounded-3xl bg-slate-50 p-6 text-center text-sm text-slate-500">جارٍ تحميل العروض...</div> : offers.length ? <div className="grid gap-4 sm:grid-cols-2">{offers.map(offer => <article key={offer.id} className="rounded-3xl border border-amber-200 bg-gradient-to-l from-amber-50 to-white p-5 shadow-sm"><span className="inline-flex rounded-full bg-amber-200 px-3 py-1 text-xs font-black text-amber-950">عرض نشط</span><h2 className="mt-4 text-xl font-black text-blue-950">{offer.partnerName}</h2><p className="mt-2 text-sm leading-7 text-slate-700">{offer.text}</p><span className="mt-5 block text-xs font-bold text-red-600">يظهر أيضاً في شريط عروض المتاجر</span></article>)}</div> : <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center"><BadgePercent className="mx-auto h-7 w-7 text-red-600" /><h2 className="mt-3 text-lg font-black text-blue-950">لا توجد عروض نشطة الآن</h2><p className="mt-2 text-sm leading-7 text-slate-500">سيظهر العرض هنا فور إضافته وتفعيله من لوحة الشريك.</p></div>}</section></>;
}
