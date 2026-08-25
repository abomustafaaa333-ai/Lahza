import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { buildStoreShareUrl, parseSharedStoreId } from "@/lib/storeShare";
import { buildAppDownloadUrl } from "@/lib/downloadLink";
import { isNativeLahzaApp } from "@/lib/nativeRuntime";
import { QRCodeSVG } from "qrcode.react";
import { getDeliveryCheckoutGate, MINIMUM_DELIVERY_ORDER_NEW_SYP, remainingDeliveryAmountNewSyp } from "@/lib/deliveryCheckout";
import { buildPartnerGallerySlides, type PartnerGallerySlide } from "@/lib/partnerGallery";
import { calculatePercentageDeliveryFeeNewSyp, catalogSeed, categoryMeta, customerDeliveryCategories, formatNewSyp, formatSyp, restaurantTypeMeta, toLegacySyp, toNewSyp, type LahzaCategory, type RestaurantType } from "@shared/lahza";
import { getHomeShortcut } from "@shared/adminHomeShortcut";
import { isStoreClosedForCustomer } from "@shared/storeAvailability";
import { ArrowLeft, BadgePercent, Bike, CakeSlice, CarFront, CheckCircle2, ChevronLeft, CircleHelp, ClipboardList, Clock3, CreditCard, Fuel, HandCoins, LayoutDashboard, LocateFixed, LogOut, MapPinCheck, Minus, PackageCheck, PackagePlus, Pencil, Phone, Pill, Plus, QrCode, Search, Share2, Shirt, ShoppingBasket, Smartphone, Sparkles, Store, Trash2, Truck, UserRound, UtensilsCrossed, Wheat, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";

type Screen = "home" | "delivery" | "stores" | "store" | "productQuantity" | "storeOffers" | "offerQuantity" | "taxi" | "intercity" | "offers" | "checkout" | "orderTracking";
type PromotionPreview = { code: string; kind: "discount" | "referral"; percent: number; discountAmount: number; itemsTotal: number };
type SubmittedOrder = { id: number; customerPhone: string; orderType: "delivery" | "taxi"; customerName: string; status: "pending" | "confirmed" | "preparing" | "on_the_way" | "completed" | "cancelled" | "rejected"; totalAmount: number; deliveryFee: number; deliveryAddress: string; paymentMethod: "cash" | "sham_cash"; eta: string; lines: CartLine[]; notes: string };

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

type StoreOption = { id: number; name: string; category: LahzaCategory; restaurantType?: RestaurantType; storeOpen?: boolean | null };
type CustomDeliveryCategory = { id: number; slug: string; title: string; subtitle: string };
type StoreProduct = { id: number; name: string; unit: string; unitPrice: number; available: boolean; imageUrl?: string | null };
type CustomerOffer = { id: number; text: string; partnerName: string; storeName?: string | null; storeId?: number | null; storeCategory?: string | null; catalogItemId?: number | null; productName?: string | null; productUnit?: string | null; productPrice?: number | null; imageUrl?: string | null; storeOpen?: boolean | null; featuredStatus?: "none" | "pending" | "approved" | "rejected" };
type ProductSearchResult = { id: number; name: string; unit: string; price: number; available: boolean; storeId: number; storeName: string; storeCategory: LahzaCategory; storeOpen: boolean };

const isStaticDemo = import.meta.env.VITE_LAHZA_STATIC_DEMO === "true";
const demoAssetPrefix = isStaticDemo ? "." : "";
const demoGalleryImages = [
  `${demoAssetPrefix}/assets/lahza-offer-bakery.jpg`,
  `${demoAssetPrefix}/assets/lahza-offer-grocery.jpg`,
  `${demoAssetPrefix}/assets/lahza-offer-restaurant.jpg`,
];
const homeCategoryEmoji: Partial<Record<LahzaCategory, string>> = { restaurants: "🍔", groceries: "🛒", produce: "🥬", bakery: "🥐", sweets: "🍰", butcher: "🥩", pharmacy: "💊", household: "🧼", baby: "🧸", school_stationery: "✏️", beauty_personal_care: "✨", mobile_accessories: "📱", clothing: "👕", gas: "🔥" };
const categoryImageByKey: Partial<Record<LahzaCategory, string>> = {
  restaurants: `${demoAssetPrefix}/assets/lahza-category-restaurants.jpg`,
  groceries: `${demoAssetPrefix}/assets/lahza-category-groceries.jpg`,
  produce: `${demoAssetPrefix}/assets/lahza-category-groceries.jpg`,
  household: `${demoAssetPrefix}/assets/lahza-category-household.jpg`,
  pharmacy: `${demoAssetPrefix}/assets/lahza-category-pharmacy.jpg`,
  bakery: `${demoAssetPrefix}/assets/lahza-category-bakery.jpg`,
  sweets: `${demoAssetPrefix}/assets/lahza-category-bakery.jpg`,
  butcher: `${demoAssetPrefix}/assets/lahza-category-butcher.jpg`,
  gas: `${demoAssetPrefix}/assets/lahza-category-gas.jpg`,
  baby: `${demoAssetPrefix}/assets/lahza-category-baby.jpg`,
  school_stationery: `${demoAssetPrefix}/assets/lahza-category-stationery.jpg`,
  beauty_personal_care: `${demoAssetPrefix}/assets/lahza-category-beauty.jpg`,
  mobile_accessories: `${demoAssetPrefix}/assets/lahza-category-mobile.jpg`,
  clothing: `${demoAssetPrefix}/assets/lahza-category-clothing.jpg`,
};
const homeFeaturedStores: { name: string; category: LahzaCategory; note: string }[] = [
  { name: "مذاق الساحة", category: "restaurants", note: "وجبات ومشاوي" },
  { name: "سوق الندى", category: "groceries", note: "مؤونة واحتياجات البيت" },
  { name: "أفران الصباح", category: "bakery", note: "خبز ومعجنات طازجة" },
  { name: "حلويات السعادة", category: "sweets", note: "ضيافة وحلويات شامية" },
];
const homePopularProducts: { name: string; category: LahzaCategory; note: string }[] = [
  { name: "وجبة شاورما دجاج", category: "restaurants", note: "خيار يومي محبوب" },
  { name: "زيت زيتون بكر", category: "groceries", note: "من أساسيات المؤونة" },
  { name: "كنافة ناعمة", category: "sweets", note: "للضيافة والمناسبات" },
  { name: "حفاضات أطفال", category: "baby", note: "احتياج عائلي متكرر" },
  { name: "سائل جلي", category: "household", note: "للبيت يومياً" },
  { name: "شاحن سريع", category: "mobile_accessories", note: "إكسسوار مطلوب" },
];
const minimumDeliveryOrderSyp = MINIMUM_DELIVERY_ORDER_NEW_SYP;

const staticDemoProducts: { id: number; name: string; category: LahzaCategory; unit: string; unitPrice: number; available: boolean }[] = [
  { id: 1001, name: "عدس أحمر", category: "groceries", unit: "كغ", unitPrice: 25000, available: true },
  { id: 1002, name: "فروج طازج", category: "restaurants", unit: "كغ", unitPrice: 45000, available: true },
  { id: 1003, name: "جرة غاز منزلية", category: "gas", unit: "قنينة", unitPrice: 600000, available: true },
  { id: 1004, name: "عرض طعميني — صحن حلويات", category: "offers", unit: "وحدة", unitPrice: 30000, available: true },
  { id: 1005, name: "عرض منبج — خصم على التوصيل", category: "offers", unit: "وحدة", unitPrice: 10000, available: true },
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
  restaurants: UtensilsCrossed,
  groceries: Wheat,
  household: ShoppingBasket,
  produce: Store,
  bakery: CakeSlice,
  gas: Fuel,
  baby: PackagePlus,
  school_stationery: ClipboardList,
  beauty_personal_care: Sparkles,
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
  restaurants: "from-red-100 to-rose-50 text-red-800",
  groceries: "from-amber-100 to-orange-50 text-amber-800",
  household: "from-slate-100 to-rose-50 text-[#7a1430]",
  produce: "from-emerald-100 to-lime-50 text-emerald-800",
  bakery: "from-orange-100 to-amber-50 text-orange-800",
  gas: "from-rose-100 to-sky-50 text-[#7a1430]",
  baby: "from-sky-100 to-indigo-50 text-sky-800",
  school_stationery: "from-violet-100 to-indigo-50 text-violet-800",
  beauty_personal_care: "from-pink-100 to-rose-50 text-pink-800",
  chicken: "from-red-100 to-rose-50 text-red-800",
  breakfast: "from-yellow-100 to-amber-50 text-amber-800",
  lamb: "from-orange-100 to-red-50 text-orange-800",
  butcher: "from-rose-100 to-pink-50 text-rose-800",
  fuel: "from-rose-100 to-sky-50 text-[#7a1430]",
  pharmacy: "from-emerald-100 to-teal-50 text-emerald-800",
  other: "from-violet-100 to-indigo-50 text-indigo-800",
  offers: "from-red-100 to-orange-50 text-red-800",
  sweets: "from-pink-100 to-rose-50 text-pink-800",
  clothing: "from-fuchsia-100 to-purple-50 text-fuchsia-800",
  mobile_accessories: "from-cyan-100 to-rose-50 text-cyan-800",
  beauty_boutique: "from-amber-100 to-orange-50 text-amber-800",
};

function lineTotal(line: Pick<CartLine, "quantity" | "unitPrice" | "unit">) {
  return line.unit === "جرام" ? Math.round((line.quantity / 1000) * line.unitPrice) : Math.round(line.quantity * line.unitPrice);
}

function Header({ onSecret, onCart, onSearch, cartCount }: { onSecret: () => void; onCart: () => void; onSearch: () => void; cartCount: number }) {
  return (
    <header className="sticky top-0 z-30 border-b border-rose-100 bg-[#fffaf5]/95 pt-3 backdrop-blur-xl">
      <div className="app-shell flex h-[76px] items-center justify-between gap-3">
        <button className="header-menu-button" onClick={onSecret} aria-label="فتح القائمة"><span /><span /><span /></button>
        <button className="brand-mark" onDoubleClick={onSecret} title="انقر مرتين لدخول المالك أو المشرف أو الشريك"><span className="lahza-text-logo"><b>ل</b>حظة</span><small>كل شيء في لحظة</small></button>
        <button className="header-cart-button" onClick={onCart} aria-label="فتح سلة التسوق"><ShoppingBasket className="h-5 w-5" /><span>السلة</span>{cartCount > 0 ? <b className="cart-count">{cartCount}</b> : null}</button>
      </div>
      <div className="app-shell header-search-wrap"><button className="header-search-button" onClick={onSearch} aria-label="البحث عن منتج"><span>ابحث عن مطعم، منتج أو خدمة...</span><Search className="h-5 w-5" /></button></div>
    </header>
  );
}

function PageHeading({ eyebrow, title, detail, onBack }: { eyebrow: string; title: string; detail: string; onBack: () => void }) {
  return (
    <section className="app-shell pt-7 pb-5">
      <p className="section-eyebrow">{eyebrow}</p>
      <h1 className="page-title">{title}</h1>
      <p className="page-detail">{detail}</p>
      <button className="mt-5 inline-flex min-h-12 items-center gap-2 rounded-2xl bg-[#54162a] px-6 text-base font-black text-white shadow-md transition hover:bg-[#6f1028] active:scale-[0.97]" onClick={onBack}><ArrowLeft className="h-5 w-5" /> رجوع</button>
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
  return <div className="hero-image-frame" aria-label="عروض مصورة من متاجر لحظة">{activeSlide ? <><button type="button" onClick={() => onOpen(activeSlide)} className="block w-full cursor-zoom-in text-right" aria-label={`فتح عرض ${activeSlide.name}`}><img key={activeSlide.id} src={activeSlide.imageUrl} alt={`عرض ${activeSlide.name} من ${activeSlide.partnerName}`} onError={event => { event.currentTarget.style.display = "none"; }} className="hero-offer-image" /><div className="hero-offer-caption"><strong>{activeSlide.name}</strong><span>{activeSlide.partnerName}{activeSlide.unitPrice ? ` · ${formatSyp(activeSlide.unitPrice)}` : ""}</span></div></button>{slides.length > 1 ? <div className="hero-gallery-dots" aria-label="صور العروض">{slides.map((slide, index) => <button key={slide.id} type="button" onClick={() => setActiveIndex(index)} aria-label={`عرض الصورة ${index + 1}`} aria-current={index === activeIndex} className={index === activeIndex ? "hero-gallery-dot-active" : ""} />)}</div> : null}</> : <div className="hero-gallery-empty"><BadgePercent className="h-9 w-9" /><strong>عروض لحظة</strong><span>ترقّبوا أحدث العروض من متاجركم المفضلة</span><button type="button" onClick={() => onOpen({ id: -1, imageUrl: "", name: "العروض المميزة", partnerName: "لحظة", storeId: null, storeCategory: "offers", unitPrice: 0 })} className="hero-gallery-cta">اكتشف العروض</button></div>}</div>;
}

export default function Home() {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const [screen, setScreen] = useState<Screen>("home");
  const [checkoutMode, setCheckoutMode] = useState<"delivery" | "taxi">("delivery");
  const [checkoutStep, setCheckoutStep] = useState<1 | 2 | 3>(1);
  const [discountPreview, setDiscountPreview] = useState<PromotionPreview | null>(null);
  const [referralPreview, setReferralPreview] = useState<PromotionPreview | null>(null);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [activeCategory, setActiveCategory] = useState<LahzaCategory | null>(null);
  const [activeCustomCategory, setActiveCustomCategory] = useState<CustomDeliveryCategory | null>(null);
  const [restaurantFilter, setRestaurantFilter] = useState<RestaurantType>("all");
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
  const [discountCode, setDiscountCode] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [myReferralCode, setMyReferralCode] = useState("");
  const [usePointsReward, setUsePointsReward] = useState(false);
  const [customerLocation, setCustomerLocation] = useState("");
  const [customerLocationUrl, setCustomerLocationUrl] = useState("");
  const [customerLat, setCustomerLat] = useState<number | null>(null);
  const [customerLng, setCustomerLng] = useState<number | null>(null);
  const [locationVerified, setLocationVerified] = useState(false);
  const [useManualLocation, setUseManualLocation] = useState(false);
  const [locating, setLocating] = useState(false);
  const [notes, setNotes] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [unavailablePreference, setUnavailablePreference] = useState<"cancel" | "replace" | "call">("call");
  const [payment, setPayment] = useState<"sham_cash" | "cash">("cash");
  const [taxiType, setTaxiType] = useState<"standard" | "van">("standard");
  const [pickup, setPickup] = useState("");
  const [destination, setDestination] = useState("");
  const [submittedOrder, setSubmittedOrder] = useState<SubmittedOrder | null>(null);
  const [missingProductOpen, setMissingProductOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [missingRequesterName, setMissingRequesterName] = useState("");
  const [missingProductName, setMissingProductName] = useState("");
  const [missingProductPhone, setMissingProductPhone] = useState("");
  const [missingProductNotes, setMissingProductNotes] = useState("");
  const [sharedStoreId] = useState(() => parseSharedStoreId(window.location.search));

  const catalogQuery = trpc.lahza.catalog.list.useQuery(undefined, { enabled: !isStaticDemo, retry: false });
  const deliveryFeesQuery = trpc.lahza.deliveryFees.get.useQuery(undefined, { enabled: !isStaticDemo, retry: false });
  const partnerOffersQuery = trpc.lahza.intercity.offers.useQuery(undefined, { enabled: !isStaticDemo, retry: false });
  const allOffersQuery = trpc.lahza.intercity.offers.useQuery({ includeRegular: true }, { enabled: !isStaticDemo, retry: false });
  const storeOffersQuery = trpc.lahza.intercity.offers.useQuery({ storeId: selectedStore?.id ?? 1 }, { enabled: !isStaticDemo && Boolean(selectedStore), retry: false });
  const trackStoreVisit = trpc.lahza.traffic.track.useMutation();
  const customCategoriesQuery = trpc.lahza.customCategories.listActive.useQuery(undefined, { enabled: !isStaticDemo, retry: false });
  const normalizedSearchText = searchText.trim();
  const productSearchInput = useMemo(() => ({ query: normalizedSearchText }), [normalizedSearchText]);
  const productSearchQuery = trpc.lahza.storefront.searchProducts.useQuery(productSearchInput, { enabled: !isStaticDemo && searchOpen && normalizedSearchText.length >= 2, retry: false });
  const orderTrackingInput = useMemo(() => ({ orderId: submittedOrder?.id ?? 1, customerPhone: submittedOrder?.customerPhone ?? "+963900000000" }), [submittedOrder?.id, submittedOrder?.customerPhone]);
  const orderTrackingQuery = trpc.lahza.orders.track.useQuery(orderTrackingInput, { enabled: !isStaticDemo && Boolean(submittedOrder), retry: false, refetchInterval: screen === "orderTracking" ? 15_000 : false });
  const adminSessionQuery = trpc.lahza.admin.session.useQuery(undefined, { enabled: !isStaticDemo, retry: false });
  const partnerSessionQuery = trpc.lahza.partner.session.useQuery(undefined, { enabled: !isStaticDemo, retry: false });
  const pointsQuery = trpc.lahza.customers.points.balance.useQuery({ phone: `+963${checkoutPhone}` }, { enabled: !isStaticDemo && /^9\d{8}$/.test(checkoutPhone), retry: false });
  const createReferralCode = trpc.lahza.customers.referral.getOrCreate.useMutation({ onSuccess: result => { setMyReferralCode(result.code); void navigator.clipboard?.writeText(result.code); toast.success(`رمز إحالتك: ${result.code}`); }, onError: error => toast.error(error.message) });
  const createMissingProductRequest = trpc.lahza.missingProducts.create.useMutation({
    onSuccess: () => {
      setMissingProductOpen(false);
      setMissingRequesterName("");
      setMissingProductName("");
      setMissingProductPhone("");
      setMissingProductNotes("");
      toast.success("تم إرسال طلبك للإدارة، وسنتابع توفر المنتج.");
    },
    onError: error => toast.error(error.message),
  });
  const categoryStoresInput = useMemo(() => ({ category: activeCategory ?? "groceries", restaurantType: activeCategory === "restaurants" ? restaurantFilter : undefined, customCategorySlug: activeCategory === "other" ? activeCustomCategory?.slug : undefined }), [activeCategory, restaurantFilter, activeCustomCategory?.slug]);
  const categoryStoresQuery = trpc.lahza.storefront.stores.useQuery(categoryStoresInput, { enabled: !isStaticDemo && Boolean(activeCategory), retry: false });
  const storeProductsQuery = trpc.lahza.storefront.products.useQuery({ storeId: selectedStore?.id ?? 1 }, { enabled: !isStaticDemo && Boolean(selectedStore), retry: false });
  const sharedStoreQuery = trpc.lahza.storefront.products.useQuery({ storeId: sharedStoreId ?? 1 }, { enabled: !isStaticDemo && Boolean(sharedStoreId), retry: false });
  const products = isStaticDemo ? staticDemoProducts : catalogQuery.data ?? [];
  const categoryStores: StoreOption[] = isStaticDemo && activeCategory
    ? [{ id: -1, name: "متجر لحظة التجريبي", category: activeCategory }]
    : categoryStoresQuery.data ?? [];
  const deliveryCategories = useMemo(() => [
    ...customerDeliveryCategories.map(category => ({ key: category, category, title: categoryMeta[category].title, subtitle: categoryMeta[category].subtitle, custom: null as CustomDeliveryCategory | null })),
    ...(customCategoriesQuery.data ?? []).map(category => ({ key: `custom-${category.id}`, category: "other" as LahzaCategory, title: category.title, subtitle: category.subtitle, custom: category as CustomDeliveryCategory })),
  ], [customCategoriesQuery.data]);
  const selectedStoreProducts = isStaticDemo
    ? products.filter(product => product.category === activeCategory)
    : storeProductsQuery.data?.products ?? [];
  useEffect(() => {
    const sharedStore = sharedStoreQuery.data?.store;
    if (!sharedStore || selectedStore?.id === sharedStore.id) return;
    setActiveCategory(sharedStore.category as LahzaCategory);
    if (!isStaticDemo) trackStoreVisit.mutate({ storeId: sharedStore.id, source: "qr" });
    setSelectedStore({ id: sharedStore.id, name: sharedStore.name, category: sharedStore.category as LahzaCategory, storeOpen: sharedStore.storeOpen });
    setScreen("store");
  }, [sharedStoreQuery.data, selectedStore?.id]);
  const adminLogin = trpc.lahza.admin.login.useMutation({
    onSuccess: result => {
      utils.lahza.admin.session.setData(undefined, { role: result.role });
      void utils.lahza.admin.session.invalidate();
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
  const previewPromotion = trpc.lahza.orders.previewPromotion.useMutation();
  const createOrder = trpc.lahza.orders.create.useMutation({
    onSuccess: result => {
      toast.success(`تم إرسال الطلب رقم #${result.orderId} بنجاح`);
      setSubmittedOrder({ id: result.orderId, customerPhone: `+963${checkoutPhone}`, orderType: checkoutMode, customerName: checkoutName.trim(), status: checkoutMode === "delivery" ? "preparing" : "confirmed", totalAmount: result.totalAmount, deliveryFee: result.deliveryFee, deliveryAddress: checkoutMode === "delivery" ? (deliveryAddress.trim() || "الموقع المحدد عبر GPS") : `${pickup} ← ${destination}`, paymentMethod: payment, eta: deliveryEta, lines: [...cart], notes });
      setCart([]);
      setNotes("");
      setDeliveryAddress("");
      setDiscountPreview(null);
      setReferralPreview(null);
      setCheckoutStep(1);
      setPickup("");
      setDestination("");
      setScreen("orderTracking");
    },
    onError: error => toast.error(error.message),
  });
  const checkStoreAvailability = trpc.lahza.storefront.availability.useMutation({ onError: error => toast.error(error.message) });
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
  const activePromotion = discountPreview ?? referralPreview;
  const promotionDiscount = activePromotion?.discountAmount ?? 0;
  const discountedCartTotal = Math.max(0, total - promotionDiscount);
  const deliveryPercent = deliveryFeesQuery.data?.manbijPercent ?? 20;
  const deliveryFeeNewSyp = checkoutMode === "delivery" ? calculatePercentageDeliveryFeeNewSyp(total, deliveryPercent) : 0;
  const grandTotalNewSyp = toNewSyp(total) + deliveryFeeNewSyp;
  const hasPharmacy = cart.some(item => item.category === "pharmacy");
  const cartDeliveryFeeNewSyp = calculatePercentageDeliveryFeeNewSyp(total, deliveryPercent);
  const cartGrandTotalNewSyp = toNewSyp(discountedCartTotal) + cartDeliveryFeeNewSyp;
  const deliveryEta = cart.length >= 6 ? "40–55 دقيقة" : cart.length >= 3 ? "35–50 دقيقة" : "30–45 دقيقة";
  const partnerOffers = isStaticDemo ? staticDemoProducts.filter(product => product.category === "offers").map(product => ({ id: product.id, text: product.unitPrice > 0 ? `${product.name} — ${formatSyp(product.unitPrice)}` : product.name, partnerName: "شريك لحظة", storeName: "متجر لحظة التجريبي", storeId: -1, storeCategory: "offers", featuredStatus: "approved" as const })) : partnerOffersQuery.data ?? [];
  const allOffers = isStaticDemo ? partnerOffers : allOffersQuery.data ?? [];
  const generatedOfferSlides = demoGalleryImages.map((imageUrl, index) => ({
    id: 1004 + index,
    imageUrl,
    name: ["خصم 25% على المخبوزات", "سلة البيت الطازجة", "وجبة العائلة بسعر خاص"][index],
    partnerName: ["مخبز الصباح", "سوق البيت", "مطعم مذاق الشام"][index],
    storeId: -1,
    storeCategory: "offers",
    unitPrice: 0,
  }));
  const partnerGallerySlides = isStaticDemo
    ? generatedOfferSlides
    : (buildPartnerGallerySlides(partnerOffersQuery.data ?? []).length ? buildPartnerGallerySlides(partnerOffersQuery.data ?? []) : generatedOfferSlides);
  const homeShortcut = !isStaticDemo && partnerSessionQuery.isLoading
    ? null
    : getHomeShortcut({ adminRole: adminSessionQuery.data?.role, partnerActive: Boolean(partnerSessionQuery.data) });
  const homeAccountKind = homeShortcut?.path === "/partner/store" ? "partner" : homeShortcut?.path === "/admin" ? "admin" : null;
  const appDownloadUrl = buildAppDownloadUrl(window.location.origin);
  const nativeApp = isNativeLahzaApp();

  const addLine = (line: Omit<CartLine, "id">, returnTo: Screen = "store") => {
    setDiscountPreview(null);
    setReferralPreview(null);
    setCart(current => [...current, { ...line, id: `${Date.now()}-${Math.random()}` }]);
    toast.success("أُضيف إلى السلة");
    setScreen(returnTo);
  };

  const addFromStore = async (storeId: number | null | undefined, add: () => void) => {
    if (isStaticDemo || !storeId || storeId < 0) {
      add();
      return;
    }
    try {
      const availability = await checkStoreAvailability.mutateAsync({ storeId });
      if (isStoreClosedForCustomer(availability.storeOpen)) {
        toast.error("المتجر مغلق حالياً");
        return;
      }
      add();
    } catch {
      // رسالة الخطأ تظهر عبر طفرة التحقق، ولا تُضاف أي مادة عند فشل التحقق.
    }
  };

  const removeLine = (id: string) => {
    setDiscountPreview(null);
    setReferralPreview(null);
    setCart(current => current.filter(item => item.id !== id));
  };
  const updateLineQuantity = (id: string, quantity: number) => {
    if (!Number.isFinite(quantity) || quantity <= 0) { removeLine(id); return; }
    setDiscountPreview(null);
    setReferralPreview(null);
    setCart(current => current.map(item => item.id === id ? { ...item, quantity } : item));
  };

  const cartOrderLines = cart.map(({ catalogItemId, category, itemName, quantity, unit }) => ({ catalogItemId, category, itemName, quantity, unit }));
  const applyPromotion = async (kind: "discount" | "referral") => {
    const code = (kind === "discount" ? discountCode : referralCode).trim().toUpperCase();
    if (!code) { toast.error(kind === "discount" ? "اكتب رمز الخصم أولاً" : "اكتب رمز الإحالة أولاً"); return; }
    if (!cartOrderLines.length) { toast.error("أضف منتجاً واحداً على الأقل قبل التحقق"); return; }
    try {
      if (isStaticDemo) {
        if (code !== "LAHZA10") throw new Error("رمز تجريبي غير صالح");
        const result: PromotionPreview = { code, kind, percent: 10, discountAmount: Math.floor(total * .1), itemsTotal: total };
        if (kind === "discount") { setDiscountPreview(result); setReferralPreview(null); setReferralCode(""); } else { setReferralPreview(result); setDiscountPreview(null); setDiscountCode(""); }
      } else {
        const result = await previewPromotion.mutateAsync({ code, kind, customerPhone: /^9\d{8}$/.test(checkoutPhone) ? `+963${checkoutPhone}` : undefined, lines: cartOrderLines });
        const preview: PromotionPreview = result;
        if (kind === "discount") { setDiscountCode(result.code); setDiscountPreview(preview); setReferralPreview(null); setReferralCode(""); } else { setReferralCode(result.code); setReferralPreview(preview); setDiscountPreview(null); setDiscountCode(""); }
      }
      toast.success(`تم تطبيق ${kind === "discount" ? "رمز الخصم" : "رمز الإحالة"} بنجاح`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "تعذر التحقق من الرمز";
      toast.error(message);
      if (kind === "discount") setDiscountPreview(null); else setReferralPreview(null);
    }
  };
  const continueDeliveryCheckout = async () => {
    if (checkoutStep === 1) { setCheckoutStep(2); return; }
    if (!checkoutName.trim()) { toast.error("اكتب اسم المستلم قبل المتابعة"); return; }
    if (!/^9\d{8}$/.test(checkoutPhone)) { toast.error("أدخل رقم هاتف سوري يبدأ بالرقم 9"); return; }
    if (!locationVerified || !customerLocationUrl || customerLat === null || customerLng === null) { toast.error("اضغط «تحديد موقعي» لتأكيد موقع التوصيل قبل المتابعة"); return; }
    if (referralPreview && !isStaticDemo) {
      try {
        const result = await previewPromotion.mutateAsync({ code: referralPreview.code, kind: "referral", customerPhone: `+963${checkoutPhone}`, lines: cartOrderLines });
        setReferralPreview(result);
      } catch (error) {
        setReferralPreview(null);
        setReferralCode("");
        toast.error(error instanceof Error ? error.message : "تعذر التحقق من رمز الإحالة لهذا الرقم");
        return;
      }
    }
    setCheckoutStep(3);
  };

  const openDeliveryCheckout = () => {
    const gate = getDeliveryCheckoutGate(cart.length, total);
    if (!gate.allowed) {
      toast.error(gate.message);
      return;
    }
    setCheckoutMode("delivery");
    setCheckoutStep(1);
    setScreen("checkout");
  };
  const openCart = () => {
    setCheckoutMode("delivery");
    setCheckoutStep(1);
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
    if (!window.isSecureContext && !isNativeLahzaApp()) {
      toast.error("يتطلب تحديد الموقع فتح التطبيق عبر اتصال آمن HTTPS.");
      return;
    }
    // يستدعي المتصفح مباشرة من ضغطة العميل كي تظهر نافذة السماح في الهاتف.
    setLocating(true);
    navigator.geolocation.getCurrentPosition(position => {
      const { latitude, longitude } = position.coords;
      setCustomerLocation(`موقعي الحالي (${latitude.toFixed(5)}, ${longitude.toFixed(5)})`);
      setCustomerLocationUrl(`https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`);
      setCustomerLat(latitude);
      setCustomerLng(longitude);
      setLocationVerified(true);
      setUseManualLocation(false);
      setLocating(false);
      toast.success("تم السماح بالموقع وتأكيد عنوان التوصيل.");
    }, error => {
      setLocating(false);
      if (error.code === error.PERMISSION_DENIED) {
        toast.error("لم يتم منح إذن الموقع. عند ظهور نافذة الهاتف اختر «سماح أثناء الاستخدام»، ثم اضغط الزر مرة أخرى.");
        return;
      }
      if (error.code === error.POSITION_UNAVAILABLE) {
        toast.error("خدمة الموقع في الهاتف غير متاحة. فعّل «الموقع» من إعدادات الهاتف ثم أعد المحاولة.");
        return;
      }
      toast.error("انتهت مهلة تحديد الموقع. تأكد من الإنترنت أو GPS ثم أعد المحاولة.");
    }, { enableHighAccuracy: false, timeout: 20000, maximumAge: 0 });
  };

  const submitCheckout = () => {
    const isTaxi = checkoutMode === "taxi";
    if (!isTaxi && toNewSyp(total) < minimumDeliveryOrderSyp) {
      toast.error(`الحد الأدنى لمجموع الطلب هو ${formatNewSyp(minimumDeliveryOrderSyp)}`);
      return;
    }
    const hasGpsLocation = locationVerified && Boolean(customerLocationUrl) && customerLat !== null && customerLng !== null;
    if (!checkoutName.trim()) {
      toast.error("اكتب اسم المستلم قبل إرسال الطلب");
      return;
    }
    if (!isTaxi && !hasGpsLocation) {
      toast.error("اضغط «تحديد موقعي» لتأكيد موقع التوصيل قبل الإرسال");
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
      const demoOrderId = Math.floor(Date.now() / 1000);
      toast.success("تم تسجيل الطلب كتجربة محلية فقط ولن يُرسل إلى أي جهة.");
      setSubmittedOrder({ id: demoOrderId, customerPhone: `+963${checkoutPhone}`, orderType: isTaxi ? "taxi" : "delivery", customerName: checkoutName.trim(), status: isTaxi ? "confirmed" : "preparing", totalAmount: toLegacySyp(isTaxi ? 0 : cartGrandTotalNewSyp), deliveryFee: toLegacySyp(isTaxi ? 0 : cartDeliveryFeeNewSyp), deliveryAddress: isTaxi ? `${pickup} ← ${destination}` : (deliveryAddress.trim() || "الموقع المحدد عبر GPS"), paymentMethod: payment, eta: deliveryEta, lines: [...cart], notes });
      setCart([]);
      setNotes("");
      setDeliveryAddress("");
      setDiscountPreview(null);
      setReferralPreview(null);
      setCheckoutStep(1);
      setPickup("");
      setDestination("");
      setScreen("orderTracking");
      return;
    }
    createOrder.mutate({
      orderType: isTaxi ? "taxi" : "delivery",
      customerName: checkoutName.trim(),
      customerPhone: `+963${checkoutPhone}`,
      locationMode: isTaxi && !hasGpsLocation ? "manual" : "gps",
      locationText: isTaxi ? (customerLocation.trim() || pickup.trim()) : (deliveryAddress.trim() || customerLocation.trim() || "الموقع المحدد عبر GPS"),
      locationUrl: hasGpsLocation ? customerLocationUrl : undefined,
      locationLat: hasGpsLocation ? customerLat ?? undefined : undefined,
      locationLng: hasGpsLocation ? customerLng ?? undefined : undefined,
      paymentMethod: payment,
      discountCode: discountPreview?.code || undefined,
      referralCode: referralPreview?.code || undefined,
      usePointsReward: usePointsReward && checkoutMode === "delivery",
      notes: [notes.trim(), !isTaxi && deliveryAddress.trim() ? `العنوان المكتوب: ${deliveryAddress.trim()}` : "", !isTaxi ? `تفضيل عدم التوفر: ${unavailablePreference === "cancel" ? "إلغاء الطلب كاملاً عند عدم توفر أي صنف" : unavailablePreference === "replace" ? "البحث عن بديل من متجر آخر بعد موافقة العميل" : "التواصل مع العميل أولاً"}` : "", hasGpsLocation && customerLocationUrl ? `رابط الخريطة: ${customerLocationUrl}` : ""].filter(Boolean).join("\n") || undefined,
      taxiType: isTaxi ? taxiType : undefined,
      pickupLocation: isTaxi ? pickup : undefined,
      destination: isTaxi ? destination : undefined,
      lines: isTaxi ? [] : cartOrderLines,
    });
  };

  const goHome = () => {
    setScreen("home");
    setActiveCategory(null);
    setActiveCustomCategory(null);
    setSelectedStore(null);
    setSelectedProduct(null);
    setSelectedOffer(null);
  };

  const openSearchResult = (result: ProductSearchResult) => {
    setSearchOpen(false);
    setSearchText("");
    setActiveCategory(result.storeCategory);
    setActiveCustomCategory(null);
    setSelectedProduct(null);
    setSelectedStore({ id: result.storeId, name: result.storeName, category: result.storeCategory, storeOpen: result.storeOpen });
    setScreen("store");
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
    <main dir="rtl" className="lahza-app-shell min-h-screen text-slate-950">
      <Header onSecret={() => setSecretOpen(true)} onCart={openCart} onSearch={() => setSearchOpen(true)} cartCount={cart.length} />
      {screen !== "store" && screen !== "productQuantity" && screen !== "storeOffers" && screen !== "checkout" ? <div className="global-offer-bar"><PartnerOfferGallery slides={partnerGallerySlides} onOpen={setSelectedGalleryOffer} /></div> : null}

      <Dialog open={Boolean(selectedGalleryOffer)} onOpenChange={open => !open && setSelectedGalleryOffer(null)}><DialogContent showCloseButton={false} dir="rtl" className="w-[calc(100%-1.5rem)] max-w-lg overflow-hidden rounded-3xl border-0 bg-white p-0 shadow-2xl">{selectedGalleryOffer ? <><DialogClose aria-label="إغلاق العرض" className="absolute right-4 top-4 z-10 grid h-12 w-12 place-items-center rounded-full border border-white/70 bg-slate-950/50 text-white shadow-lg backdrop-blur-sm transition hover:scale-105 hover:bg-slate-950/70 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2"><X className="h-7 w-7" strokeWidth={3} /><span className="sr-only">إغلاق العرض</span></DialogClose>{selectedGalleryOffer.imageUrl ? <img src={selectedGalleryOffer.imageUrl} alt={`عرض ${selectedGalleryOffer.name}`} className="max-h-[52vh] w-full object-cover" /> : <div className="grid h-52 place-items-center bg-gradient-to-br from-red-600 to-orange-500 text-white"><BadgePercent className="h-14 w-14" /></div>}<div className="p-6"><DialogHeader><DialogTitle className="text-right text-xl text-[#54162a]">{selectedGalleryOffer.name}</DialogTitle><DialogDescription className="text-right text-sm font-bold text-red-600">{selectedGalleryOffer.partnerName}</DialogDescription></DialogHeader><p className="mt-4 text-sm leading-7 text-slate-600">انتقل إلى قسم العروض لرؤية تفاصيل العرض والطلب من المتجر.</p><Button onClick={() => openOfferLocation(selectedGalleryOffer)} className="mt-5 w-full rounded-2xl bg-red-600 py-6 text-base hover:bg-red-700"><ShoppingBasket className="h-5 w-5" /> اطلبه الآن</Button></div></> : null}</DialogContent></Dialog>

      <Dialog open={searchOpen} onOpenChange={open => { setSearchOpen(open); if (!open) setSearchText(""); }}><DialogContent dir="rtl" className="w-[calc(100%-1.5rem)] max-w-lg rounded-3xl bg-white p-5"><DialogHeader><DialogTitle className="flex items-center gap-2 text-right text-xl text-[#54162a]"><Search className="h-5 w-5 text-red-600" /> البحث عن منتج</DialogTitle><DialogDescription className="text-right">اكتب اسم المنتج أو المتجر، وستظهر لك الأسعار وحالة التوفر.</DialogDescription></DialogHeader><div className="mt-3"><Label htmlFor="product-search">اسم المنتج أو المتجر</Label><Input id="product-search" autoFocus value={searchText} onChange={event => setSearchText(event.target.value)} placeholder="مثال: فروج، عدس، حلويات..." className="mt-2 h-12 border-slate-200 bg-white text-base shadow-sm" /></div><div className="mt-4 max-h-[52vh] space-y-2 overflow-y-auto pr-1">{normalizedSearchText.length < 2 ? <div className="rounded-2xl bg-slate-50 p-5 text-center text-sm text-slate-500">اكتب حرفين على الأقل لبدء البحث.</div> : productSearchQuery.isLoading ? <div className="rounded-2xl bg-slate-50 p-5 text-center text-sm text-slate-500">جارٍ البحث عن المنتجات...</div> : productSearchQuery.data?.length ? productSearchQuery.data.map(result => <button key={result.id} type="button" onClick={() => openSearchResult(result as ProductSearchResult)} className="w-full rounded-2xl border border-slate-100 bg-white p-4 text-right shadow-sm transition hover:border-rose-200 hover:bg-rose-50 active:scale-[0.99]"><span className="flex items-start justify-between gap-3"><span className="min-w-0"><strong className="block truncate text-base text-[#54162a]">{result.name}</strong><small className="mt-1 block truncate text-xs font-bold text-slate-500">من متجر: {result.storeName}</small></span><span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${result.available ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>{result.available ? "متاح" : "غير متاح"}</span></span><span className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm"><strong className="text-red-600">{result.price > 0 ? `سعر تقديري: ${formatNewSyp(result.price)}` : "السعر عند التأكيد"}</strong><small className={result.storeOpen ? "text-slate-500" : "font-bold text-amber-700"}>{result.storeOpen ? "فتح صفحة المتجر" : "المتجر مغلق حالياً"}</small></span></button>) : <div className="rounded-2xl bg-slate-50 p-5 text-center text-sm text-slate-500">لم نجد منتجات أو متاجر مطابقة. يمكنك استخدام «لم تجد ما تريد؟» لطلب المنتج من الإدارة.</div>}</div></DialogContent></Dialog>

      <div key={screen === "checkout" ? `checkout-${checkoutStep}` : screen} className="screen-transition">
      {screen === "home" ? (
        <>
          <section className="app-shell home-hero-section pt-4 pb-2"><div className="home-mini-welcome"><span>تسوّق من لحظة</span><strong>اختيارات يومك في مكان واحد</strong></div></section>
          <section className="app-shell pb-10">
            <div className="home-section-heading"><div><p className="section-eyebrow">تسوّق حسب الفئة</p><h2 className="section-title">اكتشف ما تحتاجه</h2></div><button type="button" onClick={() => setScreen("delivery")}>عرض الكل <ChevronLeft className="h-4 w-4" /></button></div>
            <div className="home-category-row" aria-label="أقسام لحظة">
              <button type="button" className="home-category-card home-category-all" onClick={() => setScreen("delivery")}><span className="home-category-icon"><LayoutDashboard /></span><span>الكل</span></button>
              {deliveryCategories.slice(0, 6).map(item => { const Icon = item.custom ? Store : categoryIcons[item.category]; const emoji = !item.custom ? homeCategoryEmoji[item.category] : null; return <button key={item.key} type="button" className="home-category-card" onClick={() => { setSelectedStore(null); setSelectedProduct(null); setRestaurantFilter("all"); setActiveCustomCategory(item.custom); setActiveCategory(item.category); setScreen("stores"); }}><span className="home-category-icon">{emoji ? <span className="home-category-emoji">{emoji}</span> : <Icon />}</span><span>{item.title}</span></button>; })}
            </div>
            <section className="home-showcase-block"><div className="home-section-heading"><div><p className="section-eyebrow">اختيارات لحظة</p><h2 className="section-title">المتاجر المميزة</h2></div><button type="button" onClick={() => setScreen("delivery")}>عرض الكل <ChevronLeft className="h-4 w-4" /></button></div><div className="home-featured-row">{homeFeaturedStores.map(store => <button key={store.name} type="button" className="home-featured-store" onClick={() => { setActiveCategory(store.category); setActiveCustomCategory(null); setSelectedStore(null); setScreen("stores"); }}><img src={categoryImageByKey[store.category]} alt="" loading="lazy" /><span className="home-store-icon">{homeCategoryEmoji[store.category]}</span><strong>{store.name}</strong><small>{store.note}</small><span className="home-store-open">متاح الآن</span></button>)}</div></section>
            <section className="home-showcase-block"><div className="home-section-heading"><div><p className="section-eyebrow">مختارة من الكتالوج</p><h2 className="section-title">الأكثر طلباً</h2></div><button type="button" onClick={() => setScreen("delivery")}>عرض الكل <ChevronLeft className="h-4 w-4" /></button></div><div className="home-popular-grid">{homePopularProducts.map(product => <button key={product.name} type="button" className="home-popular-product" onClick={() => { setActiveCategory(product.category); setActiveCustomCategory(null); setSelectedStore(null); setScreen("stores"); }}><img src={categoryImageByKey[product.category]} alt="" loading="lazy" /><span className="home-product-favorite">♡</span><span className="home-product-plus"><Plus className="h-4 w-4" /></span><strong>{product.name}</strong><small>{product.note}</small></button>)}</div></section>
            {!nativeApp ? <a href={appDownloadUrl} className="mt-7 flex w-full items-center gap-3 rounded-2xl border border-red-200 bg-gradient-to-l from-red-600 to-rose-600 px-4 py-3 text-right text-white shadow-md shadow-red-100 transition hover:from-red-700 hover:to-rose-700 active:scale-[0.98]" aria-label="تحميل تطبيق لحظة"><span className="grid h-10 w-10 place-items-center rounded-xl bg-white/15"><Smartphone className="h-5 w-5" /></span><span className="flex min-w-0 flex-1 flex-col gap-1"><strong className="text-sm font-black">تحميل تطبيق لحظة</strong><small className="text-xs font-medium text-red-100">نسخة Android الرسمية — افتح صفحة التحميل</small></span><ChevronLeft className="h-5 w-5" /></a> : null}
            {homeShortcut ? <div className="mt-5 space-y-2"><button type="button" onClick={() => setLocation(homeShortcut.path)} className="flex w-full items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-right text-[#54162a] shadow-sm transition hover:bg-rose-100 active:scale-[0.98]" aria-label={`فتح ${homeShortcut.label}`}><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#6f1028] text-white">{homeShortcut.path === "/partner/store" ? <Store className="h-5 w-5" /> : <LayoutDashboard className="h-5 w-5" />}</span><span className="flex min-w-0 flex-1 flex-col gap-1"><strong className="text-sm font-black">{homeShortcut.label}</strong><small className="text-xs font-medium text-slate-600">{homeShortcut.description}</small></span><ChevronLeft className="h-5 w-5 text-[#6f1028]" /></button><button type="button" onClick={() => homeAccountKind === "partner" ? partnerHomeLogout.mutate() : adminHomeLogout.mutate()} disabled={partnerHomeLogout.isPending || adminHomeLogout.isPending} className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-red-100 bg-red-50 px-4 py-2.5 text-sm font-bold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed"><LogOut className="h-4 w-4" />{partnerHomeLogout.isPending || adminHomeLogout.isPending ? "جارٍ تسجيل الخروج..." : "تسجيل الخروج"}</button></div> : null}
            <div className="mt-8 flex items-center justify-center gap-2 text-xs text-slate-400"><Bike className="h-4 w-4 text-red-600" /><span>خدمة محلية مخصصة لمنبج</span></div>
          </section>
        </>
      ) : null}

      {screen === "delivery" ? (
        <>
          <PageHeading eyebrow="التسوق" title="اختر احتياجك" detail="أضف المنتجات من القسم المناسب، ثم راجع طلبك قبل الإرسال." onBack={goHome} />
          <section className="app-shell pb-32">
            <div className="stores-page-heading"><p className="section-eyebrow">متاجر لحظة</p><h2 className="section-title">اختر متجرك المفضل</h2><p>تصفح الأقسام واكتشف المتاجر والعروض القريبة منك.</p></div>
            <div className="category-grid">
              {deliveryCategories.map(item => {
                const Icon = item.custom ? Store : categoryIcons[item.category];
                const count = cart.filter(line => line.category === item.category).length;
                const color = item.custom ? "from-slate-100 to-rose-50 text-[#7a1430]" : categoryColors[item.category];
                const image = categoryImageByKey[item.category];
                return <button key={item.key} onClick={() => { setSelectedStore(null); setSelectedProduct(null); setRestaurantFilter("all"); setActiveCustomCategory(item.custom); setActiveCategory(item.category); setScreen("stores"); }} className="category-card">
                  {image ? <span className="category-card-image"><img src={image} alt="" loading="lazy" onError={event => { event.currentTarget.style.display = "none"; }} /></span> : null}
                  <span className={`category-icon bg-gradient-to-br ${color}`}><Icon className="h-5 w-5" /></span>
                  <span className="category-card-copy"><span>{item.title}</span><small>{item.subtitle}</small></span>
                  {count > 0 ? <span className="category-badge">{count}</span> : <Plus className="h-4 w-4 text-slate-300" />}
                </button>;
              })}
            </div>
            <button type="button" onClick={() => setMissingProductOpen(true)} className="mt-5 flex w-full items-center gap-3 rounded-2xl border border-dashed border-rose-300 bg-rose-50/70 px-4 py-4 text-right text-[#54162a] transition hover:bg-rose-100"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#6f1028] text-white"><CircleHelp className="h-5 w-5" /></span><span className="flex min-w-0 flex-1 flex-col gap-1"><strong className="text-sm font-black">لم تجد ما تريد؟</strong><small className="text-xs font-medium text-slate-600">اطلب منتجاً غير موجود وسنبحث عن متجر يوفره.</small></span><ChevronLeft className="h-5 w-5" /></button>
          </section>
        </>
      ) : null}

      {screen === "stores" && activeCategory ? <StoresScreen category={activeCategory} categoryTitle={activeCustomCategory?.title} stores={categoryStores} loading={categoryStoresQuery.isLoading && !isStaticDemo} restaurantFilter={restaurantFilter} onRestaurantFilterChange={setRestaurantFilter} onBack={() => { setScreen("delivery"); setActiveCategory(null); setActiveCustomCategory(null); }} onChoose={store => { if (!isStaticDemo) trackStoreVisit.mutate({ storeId: store.id, source: "direct" }); setSelectedStore(store); window.scrollTo({ top: 0, behavior: "smooth" }); setScreen("store"); }} /> : null}

      <Dialog open={missingProductOpen} onOpenChange={setMissingProductOpen}><DialogContent dir="rtl" className="w-[calc(100%-1.5rem)] max-w-md rounded-3xl bg-white"><DialogHeader><DialogTitle className="text-right text-xl text-[#54162a]">اطلب منتجاً غير موجود</DialogTitle><DialogDescription className="text-right">اكتب ما تحتاجه وسيتابع فريق لحظة إمكانية توفيره أو إضافة متجر مناسب.</DialogDescription></DialogHeader><div className="grid gap-3 rounded-2xl bg-slate-50 p-4"><div><Label>اسمك</Label><Input className="mt-1 border-slate-200 bg-white shadow-sm" value={missingRequesterName} onChange={event => setMissingRequesterName(event.target.value)} placeholder="الاسم" /></div><div><Label>رقم الهاتف</Label><Input className="mt-1 border-slate-200 bg-white shadow-sm" dir="ltr" inputMode="tel" value={missingProductPhone} onChange={event => setMissingProductPhone(event.target.value)} placeholder="+9639xxxxxxxx" /></div><div><Label>اسم المنتج المطلوب</Label><Input className="mt-1 border-slate-200 bg-white shadow-sm" value={missingProductName} onChange={event => setMissingProductName(event.target.value)} placeholder="مثال: حقيبة مدرسية للصف الخامس" /></div><div><Label>تفاصيل إضافية (اختياري)</Label><Textarea className="mt-1 border-slate-200 bg-white shadow-sm" value={missingProductNotes} onChange={event => setMissingProductNotes(event.target.value)} placeholder="اللون أو المقاس أو العلامة التجارية" /></div><Button disabled={createMissingProductRequest.isPending || missingRequesterName.trim().length < 2 || missingProductName.trim().length < 2 || !/^\+9639\d{8}$/.test(missingProductPhone)} onClick={() => createMissingProductRequest.mutate({ customerName: missingRequesterName.trim(), customerPhone: missingProductPhone.trim(), productName: missingProductName.trim(), notes: missingProductNotes.trim() || undefined })} className="mt-1 rounded-2xl bg-red-600 py-6 hover:bg-red-700">{createMissingProductRequest.isPending ? "جارٍ الإرسال..." : "إرسال الطلب"}</Button></div></DialogContent></Dialog>
      {screen === "store" && selectedStore ? <StoreProductsScreen store={selectedStore} products={selectedStoreProducts} loading={storeProductsQuery.isLoading && !isStaticDemo} onBack={() => { setScreen("stores"); setSelectedProduct(null); }} onChooseProduct={product => { setSelectedProduct(product); setScreen("productQuantity"); }} onOpenOffers={() => setScreen("storeOffers")} /> : null}
      {screen === "productQuantity" && selectedStore && selectedProduct ? <ProductQuantityScreen store={selectedStore} product={selectedProduct} onBack={() => setScreen("store")} onAdd={quantity => { void addFromStore(selectedStore.id, () => addLine({ category: selectedStore.category, itemName: selectedProduct.name, quantity, unit: selectedProduct.unit, unitPrice: selectedProduct.unitPrice, catalogItemId: selectedProduct.id < 0 ? undefined : selectedProduct.id, priceKnown: selectedProduct.unitPrice > 0 }, "store")); }} /> : null}
      {screen === "storeOffers" && selectedStore ? <StoreOffersScreen store={selectedStore} offers={(isStaticDemo ? partnerOffers : storeOffersQuery.data ?? []) as CustomerOffer[]} loading={storeOffersQuery.isLoading && !isStaticDemo} onBack={() => setScreen("store")} onChoose={chooseOffer} /> : null}

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

      {screen === "offers" ? (
        <OfferDestinationScreen offers={allOffers as CustomerOffer[]} onBack={goHome} loading={allOffersQuery.isLoading && !isStaticDemo} focusedOfferId={focusedOfferId} onChoose={chooseOffer} />
      ) : null}

      {screen === "offerQuantity" && selectedOffer ? <OfferQuantityScreen offer={selectedOffer} onBack={() => setScreen(selectedStore && selectedOffer.storeId === selectedStore.id ? "storeOffers" : "offers")} onAdd={quantity => { void addFromStore(selectedOffer.storeId, () => { const category = selectedOffer.storeCategory && selectedOffer.storeCategory in categoryMeta ? selectedOffer.storeCategory as LahzaCategory : "offers"; addLine({ category, catalogItemId: selectedOffer.catalogItemId ?? undefined, itemName: selectedOffer.productName ?? selectedOffer.text, quantity, unit: selectedOffer.productUnit ?? "وحدة", unitPrice: selectedOffer.productPrice ?? 0, priceKnown: Boolean(selectedOffer.productPrice && selectedOffer.productPrice > 0) }, selectedStore && selectedOffer.storeId === selectedStore.id ? "storeOffers" : "offers"); }); }} /> : null}

      {screen === "orderTracking" && submittedOrder ? <OrderTrackingScreen order={orderTrackingQuery.data ? { id: orderTrackingQuery.data.id, customerPhone: orderTrackingQuery.data.customerPhone, orderType: orderTrackingQuery.data.orderType, customerName: orderTrackingQuery.data.customerName, status: orderTrackingQuery.data.status, totalAmount: orderTrackingQuery.data.totalAmount, deliveryFee: orderTrackingQuery.data.deliveryFee, deliveryAddress: orderTrackingQuery.data.locationText || submittedOrder.deliveryAddress, paymentMethod: orderTrackingQuery.data.paymentMethod, eta: submittedOrder.eta, lines: orderTrackingQuery.data.lines.map(line => ({ id: String(line.id), catalogItemId: line.catalogItemId ?? undefined, category: "groceries" as LahzaCategory, itemName: line.itemName, quantity: Number(line.quantity), unit: line.unit, unitPrice: line.unitPrice, priceKnown: line.priceKnown })), notes: orderTrackingQuery.data.notes || submittedOrder.notes } : submittedOrder} loading={orderTrackingQuery.isLoading} onHome={goHome} onOpenCart={openCart} /> : null}

      {screen === "checkout" ? (
        <>
          <PageHeading eyebrow={checkoutMode === "delivery" ? `إتمام الطلب · الخطوة ${checkoutStep} من 3` : "تأكيد الرحلة"} title={checkoutMode === "delivery" ? checkoutStep === 1 ? "ملخص طلبك" : checkoutStep === 2 ? "بيانات التوصيل" : "راجع واطلب الآن" : "تأكيد رحلتك"} detail={checkoutMode === "delivery" ? checkoutStep === 1 ? "تحقق من السلة وطبّق رمز خصم أو إحالة إن وجد." : checkoutStep === 2 ? "أدخل بيانات التواصل وأكّد موقعك عبر زر تحديد موقعي. العنوان اليدوي اختياري." : "راجع كل تفاصيل طلبك واختر طريقة الدفع ثم أرسله." : "أدخل بيانات التواصل وحدد موقعك أو اكتبه يدوياً، ثم أرسل طلبك."} onBack={() => checkoutMode === "delivery" && checkoutStep > 1 ? setCheckoutStep(step => (step - 1) as 1 | 2 | 3) : setScreen(checkoutMode === "delivery" ? "delivery" : "taxi")} />
          {checkoutMode === "delivery" ? <section className="app-shell pb-1"><div className="checkout-flow checkout-flow-steps" aria-label="مراحل تأكيد الطلب"><button type="button" onClick={() => setCheckoutStep(1)} className={checkoutStep === 1 ? "checkout-flow-active" : ""}><b>1</b> الملخص</button><button type="button" onClick={() => checkoutStep > 1 && setCheckoutStep(2)} className={checkoutStep === 2 ? "checkout-flow-active" : ""}><b>2</b> التوصيل</button><button type="button" disabled={checkoutStep < 3} onClick={() => checkoutStep === 3 && setCheckoutStep(3)} className={checkoutStep === 3 ? "checkout-flow-active" : ""}><b>3</b> التأكيد</button></div></section> : null}
          {checkoutMode === "delivery" && checkoutStep === 1 ? <section className="app-shell space-y-5 pb-10"><div className="checkout-card checkout-cart-card"><div className="checkout-card-title"><ClipboardList className="h-5 w-5 text-[#d45b51]" /><span>ملخص الطلب</span></div><CartPreview cart={cart} removeLine={removeLine} updateQuantity={updateLineQuantity} total={total} hasPharmacy={hasPharmacy} deliveryFeeNewSyp={cartDeliveryFeeNewSyp} deliveryPercent={deliveryPercent} deliveryArea="منبج" grandTotalNewSyp={cartGrandTotalNewSyp} onContinueShopping={() => setScreen("delivery")} /></div><div className="checkout-card promotion-card"><div className="checkout-card-title"><BadgePercent className="h-5 w-5 text-[#d45b51]" /><span>خصم على طلبك</span></div><div className="promotion-help"><article><BadgePercent className="h-4 w-4" /><div><strong>رمز الخصم</strong><span>رمز تقدمه لحظة يمنحك خصماً على الطلب.</span></div></article><article><Share2 className="h-4 w-4" /><div><strong>رمز الإحالة</strong><span>رمز يرسله لك عميل لحظة. استخدم رمزاً واحداً فقط.</span></div></article></div><div className="promotion-input-row"><div><Label htmlFor="discountCode">رمز الخصم</Label><Input id="discountCode" value={discountCode} onChange={event => { setDiscountCode(event.target.value.toUpperCase()); setDiscountPreview(null); }} placeholder="مثال: LAHZA10" dir="ltr" /></div><Button type="button" variant="outline" onClick={() => void applyPromotion("discount")} disabled={previewPromotion.isPending || !discountCode.trim()} className="promotion-verify-button">{previewPromotion.isPending ? "جارٍ التحقق" : "تحقق"}</Button></div><div className="promotion-input-row"><div><Label htmlFor="referralCode">رمز الإحالة</Label><Input id="referralCode" value={referralCode} onChange={event => { setReferralCode(event.target.value.toUpperCase()); setReferralPreview(null); }} placeholder="مثال: LHZ-AB12" dir="ltr" /></div><Button type="button" variant="outline" onClick={() => void applyPromotion("referral")} disabled={previewPromotion.isPending || !referralCode.trim()} className="promotion-verify-button">{previewPromotion.isPending ? "جارٍ التحقق" : "تحقق"}</Button></div>{activePromotion ? <div className="promotion-applied"><span>تم تطبيق {activePromotion.kind === "discount" ? "رمز الخصم" : "رمز الإحالة"} {activePromotion.code} بنسبة {activePromotion.percent}%</span><strong>- {formatNewSyp(toNewSyp(activePromotion.discountAmount))}</strong></div> : null}</div>{remainingDeliveryAmountNewSyp(discountedCartTotal) > 0 ? <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-center text-sm font-bold leading-6 text-amber-900">الحد الأدنى بعد الخصم هو {formatNewSyp(minimumDeliveryOrderSyp)}. أضف منتجات بقيمة {formatNewSyp(remainingDeliveryAmountNewSyp(discountedCartTotal))} أو أكثر.</p> : null}<button disabled={remainingDeliveryAmountNewSyp(discountedCartTotal) > 0} onClick={continueDeliveryCheckout} className="primary-full-button">التالي إلى بيانات التوصيل <ChevronLeft className="h-5 w-5" /></button></section> : null}
          {checkoutMode === "delivery" && checkoutStep === 2 ? <section className="app-shell space-y-5 pb-10"><div className="delivery-estimate-card"><span className="delivery-estimate-icon"><Bike className="h-5 w-5" /></span><div><strong>وقت وصول تقديري</strong><p>يصل طلبك عادة خلال <b>{deliveryEta}</b> بعد تأكيد المتجر والموقع.</p></div><span className="delivery-estimate-status">توصيل لحظة</span></div><div className="checkout-card space-y-4"><div className="checkout-card-title"><UserRound className="h-5 w-5 text-[#d45b51]" /><span>بيانات التواصل</span></div><div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><div><Label htmlFor="customerName">اسم المستلم</Label><Input id="customerName" value={checkoutName} onChange={event => setCheckoutName(event.target.value)} placeholder="اكتب الاسم" /></div><div><Label htmlFor="customerPhone">رقم الهاتف السوري</Label><div className="phone-entry" dir="ltr"><span>+963</span><Input id="customerPhone" inputMode="numeric" value={checkoutPhone} onChange={event => setCheckoutPhone(event.target.value.replace(/\D/g, "").slice(0, 9))} placeholder="9XXXXXXXX" /></div><small className="phone-help">اكتب الرقم ابتداءً من 9، من دون الصفر الأول.</small></div></div><div className="delivery-location-card"><div className="delivery-field-heading"><span><LocateFixed className="h-4 w-4" /> العنوان وموقع التوصيل</span><small>الموقع مطلوب · العنوان اختياري</small></div><Label htmlFor="deliveryAddress">العنوان التفصيلي <span className="text-slate-400">(اختياري)</span></Label><Textarea id="deliveryAddress" value={deliveryAddress} onChange={event => setDeliveryAddress(event.target.value)} placeholder="مثال: منبج، حي السرب، قرب دوار الساعة، بناء 12" /><div className="location-actions"><button type="button" onClick={locateCustomer} disabled={locating}><LocateFixed className="h-4 w-4" />{locating ? "جارٍ طلب إذن الموقع..." : locationVerified ? "تم تأكيد موقعك" : "السماح بالوصول للموقع"}</button></div>{locationVerified ? <p className="verified-location">تم تأكيد موقعك عبر GPS، ويمكنك الآن متابعة الطلب.</p> : <p className="location-required-note">ستظهر نافذة إذن من هاتفك عند الضغط على الزر. وافق عليها لتأكيد موقع التوصيل.</p>}</div></div><button onClick={continueDeliveryCheckout} className="primary-full-button">التالي إلى مراجعة الطلب <ChevronLeft className="h-5 w-5" /></button></section> : null}
          {checkoutMode === "delivery" && checkoutStep === 3 ? <section className="app-shell space-y-5 pb-10"><div className="delivery-estimate-card"><span className="delivery-estimate-icon"><Bike className="h-5 w-5" /></span><div><strong>وقت وصول تقديري</strong><p>سيصل طلبك خلال <b>{deliveryEta}</b> إلى {deliveryAddress.trim() || "الموقع المحدد عبر GPS"}.</p></div><span className="delivery-estimate-status">جاهز للإرسال</span></div><div className="checkout-card checkout-cart-card"><div className="checkout-card-title"><ClipboardList className="h-5 w-5 text-[#d45b51]" /><span>مراجعة طلبك</span></div><CartPreview cart={cart} removeLine={removeLine} updateQuantity={updateLineQuantity} total={total} hasPharmacy={hasPharmacy} deliveryFeeNewSyp={cartDeliveryFeeNewSyp} deliveryPercent={deliveryPercent} deliveryArea="منبج" grandTotalNewSyp={cartGrandTotalNewSyp} onContinueShopping={() => setScreen("delivery")} /><div className="order-review-address"><span><LocateFixed className="h-4 w-4" /> التوصيل إلى</span><strong>{deliveryAddress.trim() || "الموقع المحدد عبر GPS"}</strong><small>{checkoutName} · +963{checkoutPhone}</small></div></div><div className="checkout-card"><div className="checkout-card-title"><CreditCard className="h-5 w-5 text-[#d45b51]" /><span>طريقة الدفع</span></div><div className="payment-grid"><button onClick={() => setPayment("sham_cash")} className={payment === "sham_cash" ? "payment-active" : ""}><span className="payment-icon payment-icon-lahza">ش</span><span>شام كاش</span></button><button onClick={() => setPayment("cash")} className={payment === "cash" ? "payment-active" : ""}><HandCoins className="h-5 w-5" /><span>نقداً عند الاستلام</span></button></div></div><div className="checkout-card"><div className="checkout-card-title"><PackagePlus className="h-5 w-5 text-[#d45b51]" /><span>عند عدم توفر أحد المنتجات</span></div><div className="unavailable-choice-grid"><button type="button" onClick={() => setUnavailablePreference("cancel")} className={unavailablePreference === "cancel" ? "unavailable-choice-active" : ""}><span>إلغاء الطلب</span><small>عند عدم توفر أي صنف</small></button><button type="button" onClick={() => setUnavailablePreference("replace")} className={unavailablePreference === "replace" ? "unavailable-choice-active" : ""}><span>بديل من متجر آخر</span><small>بعد أخذ موافقتي</small></button><button type="button" onClick={() => setUnavailablePreference("call")} className={unavailablePreference === "call" ? "unavailable-choice-active" : ""}><span>تواصل معي</span><small>قبل أي تغيير</small></button></div><div className="mt-4"><Label htmlFor="notes">ملاحظات إضافية <span className="text-slate-400">(اختياري)</span></Label><Textarea id="notes" value={notes} onChange={event => setNotes(event.target.value)} placeholder="أي تفاصيل مفيدة للطلب أو للمندوب" /></div></div><button disabled={createOrder.isPending || remainingDeliveryAmountNewSyp(discountedCartTotal) > 0} onClick={submitCheckout} className="primary-full-button">{createOrder.isPending ? "جارٍ إرسال الطلب..." : `اطلب الآن · ${formatNewSyp(cartGrandTotalNewSyp)}`}<ChevronLeft className="h-5 w-5" /></button></section> : null}
          {checkoutMode === "taxi" ? <section className="app-shell space-y-5 pb-10"><div className="checkout-card"><div className="checkout-card-title"><ClipboardList className="h-5 w-5 text-[#d45b51]" /><span>تفاصيل الرحلة</span></div><div className="taxi-summary"><CarFront className="h-9 w-9 text-[#6f1028]" /><div><strong>{taxiType === "van" ? "سيارة فان" : "تاكسي عادي"}</strong><span>{pickup || "موقع الانطلاق"} <ChevronLeft className="inline h-3 w-3" /> {destination || "الوجهة"}</span></div></div></div><div className="checkout-card space-y-4"><div className="checkout-card-title"><UserRound className="h-5 w-5 text-[#d45b51]" /><span>بيانات التواصل</span></div><div><Label htmlFor="customerName">الاسم</Label><Input id="customerName" value={checkoutName} onChange={event => setCheckoutName(event.target.value)} placeholder="اكتب الاسم" /></div><div><Label htmlFor="customerPhone">رقم الهاتف السوري</Label><div className="phone-entry" dir="ltr"><span>+963</span><Input id="customerPhone" inputMode="numeric" value={checkoutPhone} onChange={event => setCheckoutPhone(event.target.value.replace(/\D/g, "").slice(0, 9))} placeholder="9XXXXXXXX" /></div></div><div><Label htmlFor="customerLocation">موقعك</Label><Input id="customerLocation" value={customerLocation} readOnly placeholder="استخدم زر تحديد موقعي" /><div className="location-actions"><button type="button" onClick={locateCustomer} disabled={locating}><LocateFixed className="h-4 w-4" />{locating ? "جارٍ التحديد..." : "تحديد موقعي"}</button></div></div></div><div className="checkout-card"><div className="checkout-card-title"><CreditCard className="h-5 w-5 text-[#d45b51]" /><span>طريقة الدفع</span></div><div className="payment-grid"><button onClick={() => setPayment("sham_cash")} className={payment === "sham_cash" ? "payment-active" : ""}><span className="payment-icon payment-icon-lahza">ش</span><span>شام كاش</span></button><button onClick={() => setPayment("cash")} className={payment === "cash" ? "payment-active" : ""}><HandCoins className="h-5 w-5" /><span>نقداً عند الاستلام</span></button></div></div><button disabled={createOrder.isPending} onClick={submitCheckout} className="primary-full-button">{createOrder.isPending ? "جارٍ إرسال الطلب..." : "تأكيد وإرسال الطلب"}<ChevronLeft className="h-5 w-5" /></button></section> : null}
        </>
      ) : null}

      </div>
      {screen !== "checkout" ? <nav className="home-bottom-nav" aria-label="التنقل الرئيسي"><button type="button" className={screen === "home" ? "home-bottom-nav-active" : ""} onClick={goHome}><LayoutDashboard className="h-5 w-5" /><span>الرئيسية</span></button><button type="button" className={screen === "delivery" || screen === "stores" || screen === "store" ? "home-bottom-nav-active" : ""} onClick={() => setScreen("delivery")}><Store className="h-5 w-5" /><span>المتاجر</span></button><button type="button" className={screen === "offers" || screen === "storeOffers" ? "home-bottom-nav-active" : ""} onClick={() => setScreen("offers")}><BadgePercent className="h-5 w-5" /><span>العروض</span></button><button type="button" className={screen === "taxi" ? "home-bottom-nav-active" : ""} onClick={() => setScreen("taxi")}><CarFront className="h-5 w-5" /><span>أجرة</span></button></nav> : null}
      <footer className="app-shell pb-8 text-center text-xs font-medium tracking-wide text-slate-400" dir="ltr">Designed by Ahmad barho</footer>
      <Dialog open={secretOpen} onOpenChange={setSecretOpen}><DialogContent dir="rtl" className="w-[calc(100%-2rem)] max-w-sm rounded-3xl border-0 bg-white p-6 shadow-2xl"><DialogHeader><div className="admin-lock-icon">L</div><DialogTitle className="pt-2 text-center text-xl">اختر نوع الدخول</DialogTitle><DialogDescription className="text-center">اختر حسابك ثم أدخل بياناته في المكان الصحيح.</DialogDescription></DialogHeader><div className="mt-3 space-y-4"><div className="role-switch"><button onClick={() => setSecretRole("owner")} className={secretRole === "owner" ? "role-selected" : ""}>المالك</button><button onClick={() => setSecretRole("supervisor")} className={secretRole === "supervisor" ? "role-selected" : ""}>مشرف</button><button onClick={() => setSecretRole("partner")} className={secretRole === "partner" ? "role-selected" : ""}>شريك</button></div>{secretRole === "owner" ? <div><Label htmlFor="pin">رمز PIN للمالك</Label><Input id="pin" inputMode="numeric" type="password" value={pin} onChange={e => setPin(e.target.value)} placeholder="••••" /></div> : <><div><Label htmlFor="username">اسم المستخدم {secretRole === "partner" ? "للشريك" : "للمشرف"}</Label><Input id="username" dir="ltr" value={username} onChange={e => setUsername(e.target.value)} /></div><div><Label htmlFor="password">كلمة المرور {secretRole === "partner" ? "للشريك" : "للمشرف"}</Label><Input id="password" dir="ltr" type="password" value={password} onChange={e => setPassword(e.target.value)} /></div></>}<Button disabled={secretRole === "partner" ? partnerLogin.isPending || !username.trim() || !password : !isStaticDemo && (adminLogin.isPending || (secretRole === "owner" ? !pin : !username.trim() || !password))} className="w-full rounded-xl bg-[#6f1028] hover:bg-[#54162a]" onClick={handleAdminLogin}>{secretRole === "partner" ? partnerLogin.isPending ? "جارٍ فتح حساب الشريك..." : "دخول الشريك" : !isStaticDemo && adminLogin.isPending ? "جارٍ التحقق..." : "دخول آمن"}</Button></div></DialogContent></Dialog>
    </main>
  );
}

function StoresScreen({ category, categoryTitle, stores, loading, restaurantFilter, onRestaurantFilterChange, onBack, onChoose }: { category: LahzaCategory; categoryTitle?: string; stores: StoreOption[]; loading: boolean; restaurantFilter: RestaurantType; onRestaurantFilterChange: (filter: RestaurantType) => void; onBack: () => void; onChoose: (store: StoreOption) => void }) {
  const meta = categoryMeta[category];
  const title = categoryTitle ?? meta.title;
  const visual = categoryImageByKey[category];
  return <><PageHeading eyebrow="متاجر القسم" title={`متاجر ${title}`} detail="اختر متجراً لفتح صفحته ومنتجاته في المكان نفسه." onBack={onBack} /><section className="app-shell pb-12">{category === "restaurants" ? <div className="mb-5 flex flex-wrap gap-2" aria-label="فلترة أنواع المطاعم">{(Object.keys(restaurantTypeMeta) as RestaurantType[]).map(type => <button key={type} type="button" onClick={() => onRestaurantFilterChange(type)} className={`rounded-full px-4 py-2 text-sm font-bold transition ${restaurantFilter === type ? "bg-[#79122f] text-white shadow-sm" : "border border-rose-100 bg-white text-slate-700 hover:border-rose-300 hover:bg-rose-50"}`}>{restaurantTypeMeta[type]}</button>)}</div> : null}{loading ? <div className="rounded-3xl bg-slate-50 p-6 text-center text-sm text-slate-500">جارٍ تحميل المتاجر...</div> : stores.length ? <div className="store-card-grid">{stores.map(store => <button key={store.id} onClick={() => onChoose(store)} className="store-identity-card"><span className="store-identity-image">{visual ? <img src={visual} alt="" loading="lazy" /> : <Store className="h-7 w-7" />}</span><span className="store-identity-avatar"><Store className="h-5 w-5" /></span><span className="store-identity-copy"><strong>{store.name}</strong><small>{title} · منتجات وعروض مختارة</small></span><ChevronLeft className="store-identity-arrow h-5 w-5" /></button>)}</div> : <EmptyStoreList categoryTitle={title} />}</section></>;
}

function StoreShareCard({ store }: { store: StoreOption }) {
  const [qrOpen, setQrOpen] = useState(false);
  const storeUrl = buildStoreShareUrl(window.location.origin, store.id);
  const appDownloadUrl = buildAppDownloadUrl(window.location.origin);
  const nativeApp = isNativeLahzaApp();
  const shareStore = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: `متجر ${store.name} على لحظة`, text: `اطلب من ${store.name} عبر لحظة`, url: storeUrl });
        return;
      }
      await navigator.clipboard.writeText(storeUrl);
      toast.success("تم نسخ رابط المتجر");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      toast.error("تعذرت مشاركة الرابط، انسخه من رمز QR أو أعد المحاولة");
    }
  };
  return <><section className="app-shell pb-2"><div className="rounded-3xl border border-rose-100 bg-gradient-to-l from-rose-50 to-white p-4 shadow-sm"><div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#6f1028] text-white"><Share2 className="h-5 w-5" /></span><div className="min-w-0 flex-1"><strong className="block text-sm text-[#54162a]">رابط الدخول إلى المتجر</strong><small className="mt-1 block text-xs leading-5 text-slate-600">شارك المتجر مع من تحب أو اعرض رمز QR لفتحه مباشرة.</small></div></div><div className="mt-4 grid grid-cols-2 gap-2"><Button type="button" onClick={() => void shareStore()} className="rounded-2xl bg-[#6f1028] hover:bg-[#54162a]"><Share2 className="h-4 w-4" /> مشاركة الرابط</Button><Button type="button" variant="outline" onClick={() => setQrOpen(true)} className="rounded-2xl border-rose-200 bg-white text-[#54162a] hover:bg-rose-50"><QrCode className="h-4 w-4" /> رمز QR</Button></div>{!nativeApp ? <a href={appDownloadUrl} className="mt-2 flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-black text-red-700 transition hover:bg-red-100 active:scale-[0.98]" aria-label="تحميل تطبيق لحظة من صفحة المتجر"><Smartphone className="h-4 w-4" /> تحميل تطبيق لحظة</a> : null}</div></section><Dialog open={qrOpen} onOpenChange={setQrOpen}><DialogContent dir="rtl" className="w-[calc(100%-2rem)] max-w-sm rounded-3xl bg-white text-center"><DialogHeader><DialogTitle className="text-center text-xl text-[#54162a]">رمز متجر {store.name}</DialogTitle><DialogDescription className="text-center">امسح الرمز لفتح صفحة المتجر والمنتجات مباشرة.</DialogDescription></DialogHeader><div className="mx-auto mt-3 rounded-3xl border border-slate-100 bg-white p-4 shadow-sm"><QRCodeSVG value={storeUrl} size={220} level="M" includeMargin /></div><p dir="ltr" className="mt-3 break-all text-center text-[0.68rem] text-slate-400">{storeUrl}</p><Button type="button" onClick={() => void shareStore()} className="mt-3 w-full rounded-2xl bg-red-600 hover:bg-red-700"><Share2 className="h-4 w-4" /> مشاركة رابط المتجر</Button></DialogContent></Dialog></>;
}

function StoreProductsScreen({ store, products, loading, onBack, onChooseProduct, onOpenOffers }: { store: StoreOption; products: StoreProduct[]; loading: boolean; onBack: () => void; onChooseProduct: (product: StoreProduct) => void; onOpenOffers: () => void }) {
  const [need, setNeed] = useState("");
  const visual = categoryImageByKey[store.category];
  const categoryTitle = categoryMeta[store.category].title;
  const availableProducts = products.filter(product => product.available);
  const normalizedNeed = need.trim().toLocaleLowerCase("ar");
  const visibleProducts = normalizedNeed ? availableProducts.filter(product => product.name.toLocaleLowerCase("ar").includes(normalizedNeed)) : availableProducts;
  return <div className="store-reveal-shell"><section className="store-hero"><div className="store-hero-visual">{visual ? <img src={visual} alt="" /> : null}</div><div className="store-hero-shade" /><button type="button" onClick={onBack} className="store-hero-back" aria-label="العودة إلى المتاجر"><ArrowLeft className="h-5 w-5" /></button><button type="button" onClick={onOpenOffers} className="store-hero-offer" aria-label="عروض المتجر"><BadgePercent className="h-5 w-5" /></button><div className="store-hero-copy"><span className="store-hero-avatar"><Store className="h-7 w-7" /></span><p>{categoryTitle}</p><h1>{store.name}</h1><span>منتجات مختارة بعناية ضمن هوية لحظة</span></div></section><section className="app-shell pb-12"><div className="store-status-row"><span><Bike className="h-4 w-4" /> توصيل لحظة</span><span><Sparkles className="h-4 w-4" /> متجر موثوق</span><span><BadgePercent className="h-4 w-4" /> عروض خاصة</span></div><div className="store-products-heading"><div><p className="section-eyebrow">تسوّق من المتجر</p><h2 className="section-title">منتجات {store.name}</h2></div><button type="button" onClick={onOpenOffers}>العروض <ChevronLeft className="h-4 w-4" /></button></div><label className="store-product-search"><Search className="h-5 w-5" /><input value={need} onChange={event => setNeed(event.target.value)} placeholder="ماذا تحتاج؟" aria-label="ابحث داخل منتجات المتجر" />{need ? <button type="button" onClick={() => setNeed("")} aria-label="مسح البحث"><X className="h-4 w-4" /></button> : null}</label>{loading ? <div className="rounded-3xl bg-slate-50 p-6 text-center text-sm text-slate-500">جارٍ تحميل المنتجات...</div> : visibleProducts.length ? <div className="product-image-grid">{visibleProducts.map(product => <button key={product.id} onClick={() => onChooseProduct(product)} className="product-image-card"><span className="product-image-wrap">{product.imageUrl ? <img src={product.imageUrl} alt={product.name} loading="lazy" onError={event => { event.currentTarget.style.display = "none"; }} /> : <PackagePlus className="h-8 w-8 text-[#79122f]" />}</span><strong>{product.name}</strong><small>{product.unit}</small><span className="product-card-price">{product.unitPrice ? `سعر تقديري · ${formatSyp(product.unitPrice)}` : "السعر عند التأكيد"}</span><span className="product-add-circle"><Plus className="h-5 w-5" /></span></button>)}</div> : <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center"><PackagePlus className="mx-auto h-7 w-7 text-slate-400" /><strong className="mt-3 block text-[#54162a]">{need ? `لا توجد نتيجة لـ «${need}»` : "لا توجد منتجات متاحة حالياً"}</strong><p className="mt-2 text-xs text-slate-500">جرّب كتابة اسم منتج آخر أو مسح البحث.</p></div>}</section></div>;
}

function ProductQuantityScreen({ store, product, onBack, onAdd }: { store: StoreOption; product: StoreProduct; onBack: () => void; onAdd: (quantity: number) => void }) {
  const [quantity, setQuantity] = useState("1");
  const parsed = Number(quantity);
  const add = () => { if (!Number.isFinite(parsed) || parsed <= 0) return toast.error("أدخل كمية صالحة"); onAdd(parsed); };
  return <><PageHeading eyebrow={store.name} title="حدد الكمية" detail="اختر كمية المنتج ثم أضفه إلى السلة." onBack={onBack} /><section className="app-shell pb-12"><div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm"><p className="text-xs font-bold text-slate-400">الصنف المختار</p><h2 className="mt-1 text-xl font-black text-[#54162a]">{product.name}</h2><p className="mt-2 text-sm font-bold text-red-600">{product.unitPrice ? `سعر تقديري: ${formatSyp(product.unitPrice)}` : "يحدد السعر عند التأكيد"}</p><div className="mt-6"><Label>الكمية {product.unit !== "وحدة" ? `(${product.unit})` : ""}</Label><div className="quantity-control mt-2"><button onClick={() => setQuantity(value => String(Math.max(product.unit === "ليتر" ? 0.1 : 1, Number(value || 1) - (product.unit === "جرام" ? 50 : 1))))}><Minus className="h-4 w-4" /></button><Input type="number" min={product.unit === "ليتر" ? "0.1" : "1"} step={product.unit === "جرام" ? "50" : "1"} value={quantity} onChange={event => setQuantity(event.target.value)} /><button onClick={() => setQuantity(value => String(Number(value || 0) + (product.unit === "جرام" ? 50 : 1)))}><Plus className="h-4 w-4" /></button></div></div><Button onClick={add} className="mt-6 w-full rounded-2xl bg-red-600 py-6 hover:bg-red-700"><ShoppingBasket className="h-5 w-5" /> أضف إلى السلة</Button></div></section></>;
}

function StoreOffersScreen({ store, offers, loading, onBack, onChoose }: { store: StoreOption; offers: CustomerOffer[]; loading: boolean; onBack: () => void; onChoose: (offer: CustomerOffer) => void }) {
  return <><PageHeading eyebrow="عروض المتجر" title={`عروض ${store.name}`} detail="اضغط على العرض المختار ثم حدّد كميته فقط." onBack={onBack} /><section className="app-shell pb-12">{loading ? <div className="rounded-3xl bg-slate-50 p-6 text-center text-sm text-slate-500">جارٍ تحميل العروض...</div> : offers.length ? <div className="grid gap-4 sm:grid-cols-2">{offers.map(offer => <button key={offer.id} onClick={() => onChoose(offer)} className="overflow-hidden rounded-3xl border border-amber-200 bg-gradient-to-l from-amber-50 to-white text-right shadow-sm transition hover:-translate-y-0.5 active:scale-[.98]">{offer.imageUrl ? <img src={offer.imageUrl} alt="" className="h-40 w-full object-cover" /> : null}<span className="block p-5"><span className="inline-flex rounded-full bg-amber-200 px-3 py-1 text-xs font-black text-amber-950">عرض نشط</span><strong className="mt-4 block text-lg text-[#54162a]">{offer.text}</strong><small className="mt-2 block text-red-600">اضغط لاختيار الكمية</small></span></button>)}</div> : <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center"><BadgePercent className="mx-auto h-7 w-7 text-red-600" /><h2 className="mt-3 text-lg font-black text-[#54162a]">لا توجد عروض نشطة لهذا المتجر</h2></div>}</section></>;
}

function OfferQuantityScreen({ offer, onBack, onAdd }: { offer: CustomerOffer; onBack: () => void; onAdd: (quantity: number) => void }) {
  const [quantity, setQuantity] = useState("1");
  const parsed = Number(quantity);
  const add = () => { if (!Number.isFinite(parsed) || parsed <= 0) return toast.error("أدخل كمية صالحة"); onAdd(parsed); };
  const productName = offer.productName ?? offer.text;
  return <><PageHeading eyebrow={offer.storeName ?? offer.partnerName} title="حدد كمية العرض" detail="وصف العرض ظاهر أدناه، بينما أُختير صنفه من متجر الشريك مسبقاً." onBack={onBack} /><section className="app-shell pb-12"><div className="rounded-3xl border border-amber-200 bg-gradient-to-l from-amber-50 to-white p-5 shadow-sm">{offer.imageUrl ? <img src={offer.imageUrl} alt="" className="mb-5 h-44 w-full rounded-2xl object-cover" /> : null}<Label>وصف العرض</Label><div className="mt-2 rounded-2xl border border-amber-200 bg-white px-4 py-3 font-bold text-slate-700">{offer.text}</div><Label className="mt-5 block">صنف العرض</Label><div className="mt-2 rounded-2xl border border-amber-200 bg-white px-4 py-3 text-lg font-black text-[#54162a]">{productName}</div><p className="mt-2 text-xs text-slate-500">تم تحديد الصنف من منتجات المتجر؛ عدّل الكمية فقط.</p>{offer.productPrice ? <p className="mt-3 text-sm font-bold text-red-600">{formatSyp(offer.productPrice)}</p> : null}<div className="mt-6"><Label>الكمية {offer.productUnit && offer.productUnit !== "وحدة" ? `(${offer.productUnit})` : ""}</Label><div className="quantity-control mt-2"><button onClick={() => setQuantity(value => String(Math.max(1, Number(value || 1) - 1)))}><Minus className="h-4 w-4" /></button><Input type="number" min="1" step="1" value={quantity} onChange={event => setQuantity(event.target.value)} /><button onClick={() => setQuantity(value => String(Number(value || 0) + 1))}><Plus className="h-4 w-4" /></button></div></div><Button onClick={add} className="mt-6 w-full rounded-2xl bg-red-600 py-6 hover:bg-red-700"><ShoppingBasket className="h-5 w-5" /> أضف الصنف إلى السلة</Button></div></section></>;
}

function EmptyStoreList({ categoryTitle }: { categoryTitle: string }) { return <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center"><Store className="mx-auto h-7 w-7 text-slate-400" /><strong className="mt-3 block text-[#54162a]">لا توجد متاجر مضافة بعد</strong><p className="mt-2 text-sm leading-6 text-slate-500">سيظهر أي متجر يضيفه المالك إلى قسم {categoryTitle} هنا.</p></div>; }

function CartPreview({ cart, removeLine, updateQuantity, total, hasPharmacy, deliveryFeeNewSyp, deliveryPercent, deliveryArea, grandTotalNewSyp, onContinueShopping }: { cart: CartLine[]; removeLine: (id: string) => void; updateQuantity: (id: string, quantity: number) => void; total: number; hasPharmacy: boolean; deliveryFeeNewSyp: number; deliveryPercent: number; deliveryArea: "منبج" | "جرابلس"; grandTotalNewSyp: number; onContinueShopping: () => void }) {
  return <div className="cart-preview"><div className="cart-preview-intro"><span className="cart-preview-icon"><ShoppingBasket className="h-5 w-5" /></span><div><strong>سلتك في لحظة</strong><p>{cart.length ? `${cart.length} ${cart.length === 1 ? "صنف" : "أصناف"} جاهزة للطلب` : "سلتك فارغة حالياً"}</p></div><button type="button" onClick={onContinueShopping}>{cart.length ? "إضافة منتجات" : "ابدأ التسوق"}</button></div>{cart.length ? <><div className="cart-lines">{cart.map(item => { const step = item.unit === "جرام" ? 50 : item.unit === "ليتر" ? .1 : 1; return <div key={item.id} className="cart-line"><span className="cart-line-category" aria-hidden="true">{homeCategoryEmoji[item.category] ?? "🛍️"}</span><div className="cart-line-copy"><strong>{item.itemName}</strong><span>{item.unit === "جرام" ? `${item.quantity} غرام` : `${item.quantity} ${item.unit}`}</span><div className="cart-inline-quantity"><button type="button" onClick={() => updateQuantity(item.id, Number((item.quantity - step).toFixed(2)))} aria-label={`إنقاص كمية ${item.itemName}`}><Minus className="h-3.5 w-3.5" /></button><b>{item.quantity}</b><button type="button" onClick={() => updateQuantity(item.id, Number((item.quantity + step).toFixed(2)))} aria-label={`زيادة كمية ${item.itemName}`}><Plus className="h-3.5 w-3.5" /></button></div></div><div className="cart-line-actions">{item.priceKnown ? <strong>{formatSyp(lineTotal(item))}</strong> : <small>السعر عند التأكيد</small>}<button type="button" onClick={() => removeLine(item.id)} aria-label={`حذف ${item.itemName}`}><Trash2 className="h-4 w-4" /></button></div></div>; })}</div>{hasPharmacy ? <p className="pharmacy-note"><Pill className="h-4 w-4" />تتضمن السلة منتجات صحية؛ يؤكدها المتجر قبل التجهيز.</p> : null}<div className="cart-totals"><div className="total-row"><span>إجمالي المنتجات</span><strong>{formatSyp(total)}</strong></div><div className="total-row"><span>رسوم توصيل {deliveryArea} ({deliveryPercent}%)</span><strong>{formatNewSyp(deliveryFeeNewSyp)}</strong></div><div className="total-row total-row-grand"><span>الإجمالي النهائي</span><strong>{formatNewSyp(grandTotalNewSyp)}</strong></div></div></> : <div className="cart-empty-state"><ShoppingBasket className="h-8 w-8" /><strong>لا توجد منتجات في السلة</strong><span>اختر ما تحتاجه من أي متجر، وستظهر تفاصيل طلبك هنا مباشرة.</span></div>}</div>;
}

function OrderTrackingScreen({ order, loading, onHome, onOpenCart }: { order: SubmittedOrder; loading: boolean; onHome: () => void; onOpenCart: () => void }) {
  const stages = [
    { key: "received", title: "تم استلام طلبك", detail: "وصل طلبك إلى لحظة", icon: ClipboardList },
    { key: "preparing", title: "جاري التجهيز", detail: "يجري تأكيد المنتجات وتحضيرها", icon: PackageCheck },
    { key: "on_the_way", title: "جاري التوصيل", detail: "سيتحرك المندوب نحو عنوانك", icon: Bike },
    { key: "completed", title: "تم التسليم", detail: "نتمنى أن تنال الخدمة رضاك", icon: CheckCircle2 },
  ];
  const currentIndex = order.status === "completed" ? 3 : order.status === "on_the_way" ? 2 : order.status === "preparing" || order.status === "confirmed" ? 1 : 0;
  const statusTitle = order.status === "on_the_way" ? "طلبك في الطريق إليك" : order.status === "completed" ? "تم تسليم طلبك" : order.status === "cancelled" || order.status === "rejected" ? "تعذر متابعة الطلب" : "طلبك قيد التجهيز";
  return <><PageHeading eyebrow={`متابعة الطلب #${order.id}`} title={statusTitle} detail={loading ? "جارٍ تحديث حالة طلبك..." : "سنحدّث هذه الصفحة تلقائياً عند انتقال طلبك إلى مرحلة جديدة."} onBack={onHome} /><section className="app-shell space-y-5 pb-10"><div className="tracking-hero"><span><Clock3 className="h-6 w-6" /></span><div><strong>{order.status === "on_the_way" ? "المندوب في الطريق" : "وقت الوصول التقديري"}</strong><b>{order.eta}</b><small>{order.orderType === "delivery" ? `التوصيل إلى: ${order.deliveryAddress}` : order.deliveryAddress}</small></div><span className="tracking-live">{loading ? "تحديث" : "مباشر"}</span></div><div className="tracking-card"><div className="tracking-card-title"><PackageCheck className="h-5 w-5" /><span>حالة طلبك</span></div><div className="tracking-steps">{stages.map((stage, index) => { const Icon = stage.icon; const active = index <= currentIndex; return <div key={stage.key} className={active ? "tracking-step tracking-step-active" : "tracking-step"}><span><Icon className="h-4 w-4" /></span><div><strong>{stage.title}</strong><small>{stage.detail}</small></div></div>; })}</div></div><div className="tracking-card"><div className="tracking-card-title"><ClipboardList className="h-5 w-5" /><span>تقرير الطلب</span></div><div className="tracking-lines">{order.lines.length ? order.lines.map(line => <div key={line.id}><span>{line.itemName} <small>× {line.quantity} {line.unit}</small></span><strong>{line.priceKnown ? formatSyp(lineTotal(line)) : "يؤكد لاحقاً"}</strong></div>) : <p>طلب سيارة أجرة — يحدد السائق تفاصيل الرحلة عند التأكيد.</p>}</div><div className="tracking-total"><span>إجمالي الطلب</span><strong>{formatSyp(order.totalAmount)}</strong></div></div><div className="tracking-info-grid"><article><LocateFixed className="h-5 w-5" /><span>عنوان التوصيل</span><strong>{order.deliveryAddress}</strong></article><article><CreditCard className="h-5 w-5" /><span>الدفع</span><strong>{order.paymentMethod === "sham_cash" ? "شام كاش" : "نقداً عند الاستلام"}</strong></article></div>{order.notes ? <div className="tracking-note"><CircleHelp className="h-4 w-4" />{order.notes}</div> : null}<div className="grid grid-cols-2 gap-3"><button type="button" onClick={onHome} className="tracking-secondary-button">الرئيسية</button><button type="button" onClick={onOpenCart} className="primary-full-button">طلب جديد <Plus className="h-4 w-4" /></button></div></section></>;
}

function OfferDestinationScreen({ offers, loading, onBack, focusedOfferId, onChoose }: { offers: CustomerOffer[]; loading: boolean; onBack: () => void; focusedOfferId: number | null; onChoose: (offer: CustomerOffer) => void }) {
  const featuredOffers = offers.filter(offer => offer.featuredStatus === "approved");
  const regularOffers = offers.filter(offer => offer.featuredStatus !== "approved");
  const offerCard = (offer: CustomerOffer) => <button key={offer.id} onClick={() => onChoose(offer)} className={`overflow-hidden rounded-3xl border bg-gradient-to-l from-amber-50 to-white text-right shadow-sm transition hover:-translate-y-0.5 active:scale-[.98] ${focusedOfferId === offer.id ? "border-red-500 ring-4 ring-red-100" : "border-amber-200"}`}>{offer.imageUrl ? <img src={offer.imageUrl} alt="" className="h-40 w-full object-cover" /> : null}<span className="block p-5"><span className={`inline-flex rounded-full px-3 py-1 text-xs font-black ${offer.featuredStatus === "approved" ? "bg-red-100 text-red-800" : "bg-amber-200 text-amber-950"}`}>{offer.featuredStatus === "approved" ? "عرض مميز" : "عرض عادي"}</span><strong className="mt-4 block text-xl text-[#54162a]">{offer.text}</strong><span className="mt-2 block text-sm font-bold leading-7 text-red-600">{offer.storeName ?? offer.partnerName}</span><span className="mt-4 block text-xs font-bold text-[#6f1028]">اضغط لاختيار الكمية</span></span></button>;
  return <><PageHeading eyebrow="عروض الشركاء" title="العروض المميزة والعادية" detail="استعرض العروض المعتمدة والعروض المتاحة من المتاجر، ثم اختر الكمية وأضفها إلى السلة." onBack={onBack} /><section className="app-shell pb-12">{loading ? <div className="rounded-3xl bg-slate-50 p-6 text-center text-sm text-slate-500">جارٍ تحميل العروض...</div> : offers.length ? <div className="space-y-8">{featuredOffers.length ? <section><div className="mb-3 flex items-center gap-2"><BadgePercent className="h-5 w-5 text-red-600" /><h2 className="text-lg font-black text-[#54162a]">العروض المميزة</h2></div><div className="grid gap-4 sm:grid-cols-2">{featuredOffers.map(offerCard)}</div></section> : null}{regularOffers.length ? <section><div className="mb-3 flex items-center gap-2"><BadgePercent className="h-5 w-5 text-amber-600" /><h2 className="text-lg font-black text-[#54162a]">العروض العادية</h2></div><div className="grid gap-4 sm:grid-cols-2">{regularOffers.map(offerCard)}</div></section> : null}</div> : <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center"><BadgePercent className="mx-auto h-7 w-7 text-red-600" /><h2 className="mt-3 text-lg font-black text-[#54162a]">لا توجد عروض نشطة الآن</h2><p className="mt-2 text-sm leading-7 text-slate-500">سيظهر العرض هنا فور إضافته وتفعيله من المتجر الشريك.</p></div>}</section></>;
}

function PartnerOffersScreen({ offers, loading, onBack }: { offers: Array<{ id: number; text: string; partnerName: string }>; loading: boolean; onBack: () => void }) {
  return <><PageHeading eyebrow="عروض الشركاء" title="عروض متاجر لحظة" detail="تظهر العروض النشطة فور تفعيلها من المتجر الشريك." onBack={onBack} /><section className="app-shell pb-12">{loading ? <div className="rounded-3xl bg-slate-50 p-6 text-center text-sm text-slate-500">جارٍ تحميل العروض...</div> : offers.length ? <div className="grid gap-4 sm:grid-cols-2">{offers.map(offer => <article key={offer.id} className="rounded-3xl border border-amber-200 bg-gradient-to-l from-amber-50 to-white p-5 shadow-sm"><span className="inline-flex rounded-full bg-amber-200 px-3 py-1 text-xs font-black text-amber-950">عرض نشط</span><h2 className="mt-4 text-xl font-black text-[#54162a]">{offer.partnerName}</h2><p className="mt-2 text-sm leading-7 text-slate-700">{offer.text}</p><span className="mt-5 block text-xs font-bold text-red-600">يظهر أيضاً في شريط عروض المتاجر</span></article>)}</div> : <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center"><BadgePercent className="mx-auto h-7 w-7 text-red-600" /><h2 className="mt-3 text-lg font-black text-[#54162a]">لا توجد عروض نشطة الآن</h2><p className="mt-2 text-sm leading-7 text-slate-500">سيظهر العرض هنا فور إضافته وتفعيله من لوحة الشريك.</p></div>}</section></>;
}
