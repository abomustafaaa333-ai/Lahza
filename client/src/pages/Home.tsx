import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { buildStoreShareUrl, parseSharedStoreId } from "@/lib/storeShare";
import { countryCallingCodes, DEFAULT_COUNTRY_CODE } from "@/lib/countryCallingCodes";
import { getCountryCallingCode, isValidPhoneNumber, type CountryCode } from "libphonenumber-js";
import { isNativeLahzaApp } from "@/lib/nativeRuntime";
import { QRCodeSVG } from "qrcode.react";
import { getDeliveryCheckoutGate, MINIMUM_DELIVERY_ORDER_NEW_SYP, remainingDeliveryAmountNewSyp } from "@/lib/deliveryCheckout";
import { buildPartnerGallerySlides, type PartnerGallerySlide } from "@/lib/partnerGallery";
import { calculatePercentageDeliveryFeeNewSyp, catalogSeed, categoryMeta, customerDeliveryCategories, formatNewSyp, formatSyp, restaurantTypeMeta, toLegacySyp, toNewSyp, type LahzaCategory, type RestaurantType } from "@shared/lahza";
import { getHomeShortcut } from "@shared/adminHomeShortcut";
import { isStoreClosedForCustomer } from "@shared/storeAvailability";
import { CITY_LABELS, CITY_KEYS, type CityKey } from "@shared/cities";
import { ArrowLeft, BadgePercent, BellRing, Bike, CakeSlice, CarFront, CheckCircle2, ChevronLeft, CircleHelp, ClipboardList, Clock3, CreditCard, Fuel, HandCoins, LayoutDashboard, Loader2, LocateFixed, LogOut, MapPinCheck, MessageCircle, Minus, PackageCheck, PackagePlus, Pencil, Phone, Pill, Plus, QrCode, Search, Share2, Shirt, ShoppingBasket, Smartphone, Sparkles, Store, Trash2, Truck, UserRound, UtensilsCrossed, Wheat, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";

type Screen = "home" | "delivery" | "stores" | "store" | "productQuantity" | "storeOffers" | "offerQuantity" | "taxi" | "intercity" | "offers" | "checkout" | "orderTracking" | "account";
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

type StoreOption = { id: number; name: string; category: LahzaCategory; imageUrl?: string | null; restaurantType?: RestaurantType; storeOpen?: boolean | null; ratingStars?: number; completedOrders?: number };
type CustomDeliveryCategory = { id: number; slug: string; title: string; subtitle: string };
type StoreProduct = { id: number; name: string; unit: string; unitPrice: number; available: boolean; imageUrl?: string | null };
type CustomerOffer = { id: number; text: string; partnerName: string; ratingStars?: number; completedOrders?: number; storeName?: string | null; storeId?: number | null; storeCategory?: string | null; catalogItemId?: number | null; productName?: string | null; productUnit?: string | null; productPrice?: number | null; originalProductPrice?: number | null; productImageUrl?: string | null; discountPercent?: number; offerPrice?: number; imageUrl?: string | null; storeOpen?: boolean | null; featuredStatus?: "none" | "pending" | "approved" | "rejected" };
type ProductSearchResult = { id: number; name: string; unit: string; price: number; available: boolean; storeId: number; storeName: string; storeCategory: LahzaCategory; storeImageUrl?: string | null; storeOpen: boolean };
type SupportContact = { id: number; label: string; phone: string; callEnabled: boolean; whatsappEnabled: boolean };
type CustomerAuthSession = { mode: "customer" | "guest"; phone?: string; name?: string; remember?: boolean };

function CitySelectionGate({ onSelect }: { onSelect: (city: CityKey) => void }) {
  return <main dir="rtl" className="city-selection-gate min-h-screen bg-[#fffaf6] px-5 py-10 text-[#4a2618]"><section className="mx-auto flex min-h-[78vh] max-w-lg flex-col items-center justify-center rounded-[2rem] border border-orange-100 bg-white p-6 text-center shadow-[0_20px_60px_rgba(99,48,27,0.12)]"><img src="/assets/lahza-logo.svg" alt="لحظة" className="h-20 w-44 object-contain" /><p className="mt-6 text-sm font-bold text-red-600">مرحبًا بك في لحظة</p><h1 className="mt-2 text-2xl font-black">اختر مدينتك</h1><p className="mt-3 max-w-sm text-sm leading-7 text-slate-500">اختر المدينة التي تريد تصفح متاجرها وعروضها. لن يظهر تبديل المدن بعد الدخول إلى التطبيق.</p><div className="mt-8 grid w-full gap-4 sm:grid-cols-2">{CITY_KEYS.map(city => <button key={city} type="button" onClick={() => onSelect(city)} className="group rounded-3xl border-2 border-orange-100 bg-orange-50/60 p-6 text-right transition hover:border-[#ff7a33] hover:bg-white hover:shadow-lg active:scale-[.98]"><span className="block text-xs font-bold text-[#ff7a33]">لحظة</span><strong className="mt-2 block text-2xl font-black text-[#4a2618]">{CITY_LABELS[city]}</strong><span className="mt-2 block text-xs leading-6 text-slate-500">متاجر وعروض وتوصيل {CITY_LABELS[city]}</span></button>)}</div></section></main>;
}

const CUSTOMER_AUTH_STORAGE_KEY = "lahza_customer_auth_v1";
const DEMO_OTP_CODE = "123456";
const DEMO_OWNER_PIN = "1212";
const isStaticDemo = import.meta.env.VITE_LAHZA_STATIC_DEMO === "true";
const demoAssetPrefix = isStaticDemo ? "." : "";
const demoGalleryImages = [
  `${demoAssetPrefix}/assets/lahza-offer-bakery.jpg`,
  `${demoAssetPrefix}/assets/lahza-offer-grocery.jpg`,
  `${demoAssetPrefix}/assets/lahza-offer-restaurant.jpg`,
];
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
const homeFeaturedStores: { id: number; name: string; category: LahzaCategory; note: string; ratingStars: number; storeOpen?: boolean | null }[] = [
  { id: -101, name: "مذاق الساحة", category: "restaurants", note: "وجبات ومشاوي", ratingStars: 3, storeOpen: true },
  { id: -102, name: "سوق الندى", category: "groceries", note: "مؤونة واحتياجات البيت", ratingStars: 3, storeOpen: true },
  { id: -103, name: "أفران الصباح", category: "bakery", note: "خبز ومعجنات طازجة", ratingStars: 3, storeOpen: true },
  { id: -104, name: "حلويات السعادة", category: "sweets", note: "ضيافة وحلويات شامية", ratingStars: 3, storeOpen: true },
];
const minimumDeliveryOrderSyp = MINIMUM_DELIVERY_ORDER_NEW_SYP;

const homeDiscoverCategories: { key: string; title: string; icon: string; category?: LahzaCategory }[] = [
  { key: "restaurants", title: "مطاعم", icon: "🍔", category: "restaurants" },
  { key: "groceries", title: "بقوليات ومواد غذائية", icon: "🛍️", category: "groceries" },
  { key: "sweets", title: "حلويات", icon: "🍰", category: "sweets" },
  { key: "gifts", title: "زهور وهدايا", icon: "🌸", category: "beauty_personal_care" },
  { key: "services", title: "خدمات", icon: "🔧" },
];

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
  household: "from-slate-100 to-rose-50 text-[#7a3b1d]",
  produce: "from-emerald-100 to-lime-50 text-emerald-800",
  bakery: "from-orange-100 to-amber-50 text-orange-800",
  gas: "from-rose-100 to-sky-50 text-[#7a3b1d]",
  baby: "from-sky-100 to-indigo-50 text-sky-800",
  school_stationery: "from-violet-100 to-indigo-50 text-violet-800",
  beauty_personal_care: "from-pink-100 to-rose-50 text-pink-800",
  chicken: "from-red-100 to-rose-50 text-red-800",
  breakfast: "from-yellow-100 to-amber-50 text-amber-800",
  lamb: "from-orange-100 to-red-50 text-orange-800",
  butcher: "from-rose-100 to-pink-50 text-rose-800",
  fuel: "from-rose-100 to-sky-50 text-[#7a3b1d]",
  pharmacy: "from-emerald-100 to-teal-50 text-emerald-800",
  other: "from-violet-100 to-indigo-50 text-indigo-800",
  offers: "from-red-100 to-orange-50 text-red-800",
  sweets: "from-pink-100 to-rose-50 text-pink-800",
  clothing: "from-fuchsia-100 to-purple-50 text-fuchsia-800",
  mobile_accessories: "from-cyan-100 to-rose-50 text-cyan-800",
  beauty_boutique: "from-amber-100 to-orange-50 text-amber-800",
};

function LahzaCategoryIcon({ category, className }: { category: LahzaCategory; className?: string }) {
  const Icon = categoryIcons[category] ?? Store;
  return <Icon className={className ?? "h-4 w-4"} strokeWidth={2.25} />;
}

function lineTotal(line: Pick<CartLine, "quantity" | "unitPrice" | "unit">) {
  return line.unit === "جرام" ? Math.round((line.quantity / 1000) * line.unitPrice) : Math.round(line.quantity * line.unitPrice);
}

function supportWhatsAppUrl(phone: string) {
  return `https://wa.me/${phone.replace(/\D/g, "")}?text=${encodeURIComponent("مرحباً، أحتاج مساعدة من فريق لحظة.")}`;
}

const lahzaSupportWhatsAppUrl = "https://wa.me/963997311078?text=" + encodeURIComponent("مرحباً، تم رفض حسابي في تطبيق لحظة وأريد المساعدة في تفعيله.");
const lahzaCustomerServiceWhatsAppUrl = "https://wa.me/963997311078?text=" + encodeURIComponent("مرحباً، أحتاج مساعدة من خدمة الزبائن في تطبيق لحظة.");

function SupportContactsDialog({ open, onOpenChange, contacts }: { open: boolean; onOpenChange: (open: boolean) => void; contacts: SupportContact[] }) {
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent dir="rtl" className="w-[calc(100%-1.5rem)] max-w-md rounded-3xl border-0 bg-white p-5 shadow-2xl"><DialogHeader><DialogTitle className="flex items-center gap-2 text-right text-xl text-[#4a2618]"><Phone className="h-5 w-5 text-[#ff8438]" /> تواصل معنا</DialogTitle><DialogDescription className="text-right">اختر الطريقة المناسبة، وسيصل اتصالك مباشرة إلى فريق لحظة.</DialogDescription></DialogHeader><div className="mt-3 space-y-3">{contacts.length ? contacts.map(contact => <article key={contact.id} className="rounded-2xl border border-rose-100 bg-[#ffffff] p-4"><strong className="block text-sm text-[#4a2618]">{contact.label}</strong><span dir="ltr" className="mt-1 block text-xs font-bold text-slate-500">{contact.phone}</span><div className="mt-3 flex flex-wrap gap-2">{contact.callEnabled ? <a href={`tel:${contact.phone}`} className="inline-flex items-center gap-2 rounded-xl bg-[#63301b] px-3 py-2 text-xs font-black text-white transition hover:bg-[#4a2618]"><Phone className="h-4 w-4" /> اتصال</a> : null}{contact.whatsappEnabled ? <a href={supportWhatsAppUrl(contact.phone)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-black text-white transition hover:bg-emerald-700"><MessageCircle className="h-4 w-4" /> واتساب</a> : null}</div></article>) : <div className="rounded-2xl border border-dashed border-rose-200 bg-rose-50 p-4 text-center text-sm font-bold leading-7 text-[#63301b]">لا توجد أرقام تواصل منشورة حالياً. سيضيفها مدير لحظة من لوحة التحكم قريباً.</div>}</div></DialogContent></Dialog>;
}

function CustomerAuthRequiredDialog({ open, onContinue, onCancel }: { open: boolean; onContinue: () => void; onCancel: () => void }) {
  return <Dialog open={open} onOpenChange={value => !value && onCancel()}><DialogContent dir="rtl" className="w-[calc(100%-1.5rem)] max-w-md rounded-3xl border-0 bg-white p-6 shadow-2xl"><DialogHeader><DialogTitle className="flex items-center gap-2 text-right text-xl text-[#173d3f]"><ShoppingBasket className="h-5 w-5 text-[#ff6b2b]" /> سجّل الآن لإضافة المنتجات</DialogTitle><DialogDescription className="text-right leading-7">يمكنك التصفح كزائر، لكن إضافة المنتجات إلى السلة وإرسال الطلبات متاحة للعملاء المسجلين فقط.</DialogDescription></DialogHeader><div className="mt-4 grid gap-2"><Button type="button" onClick={onContinue} className="w-full rounded-2xl bg-[#ff6b2b] py-6 font-black text-white hover:bg-[#f4511e]">سجّل الآن <ChevronLeft className="h-5 w-5" /></Button><Button type="button" variant="outline" onClick={onCancel} className="w-full rounded-2xl py-6 font-black text-[#00666b]">متابعة التصفح</Button></div></DialogContent></Dialog>;
}

function AboutLahzaDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent dir="rtl" className="w-[calc(100%-1.5rem)] max-w-md rounded-3xl border-0 bg-white p-5 shadow-2xl"><DialogHeader><DialogTitle className="flex items-center gap-2 text-right text-xl text-[#4a2618]"><CircleHelp className="h-5 w-5 text-[#ff8438]" /> حول التطبيق</DialogTitle><DialogDescription className="text-right">لحظة — خدمات توصيل منبج.</DialogDescription></DialogHeader><div className="mt-3 rounded-2xl bg-[#ffffff] p-4 text-sm leading-8 text-slate-600"><strong className="block text-base text-[#63301b]">كل ما تحتاجه في لحظة</strong><p className="mt-2">يساعدك تطبيق لحظة على استكشاف المتاجر المحلية وطلب المنتجات، مع متابعة حالة الطلب والتواصل السهل مع فريق الخدمة عند الحاجة.</p><p className="mt-2">تغطي الخدمة حالياً مدينة منبج، ويجري تطوير المزيد من الخدمات تدريجياً.</p></div></DialogContent></Dialog>;
}

function SupportHelpCard({ onOpen, contactCount }: { onOpen: () => void; contactCount: number }) {
  return <div className="flex items-center gap-3 rounded-2xl border border-rose-100 bg-[#ffffff] p-4"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#63301b] text-white"><Phone className="h-5 w-5" /></span><div className="min-w-0 flex-1"><strong className="block text-sm text-[#4a2618]">تحتاج مساعدة قبل التأكيد؟</strong><small className="mt-1 block text-xs font-medium leading-5 text-slate-600">{contactCount ? `تتوفر ${contactCount} ${contactCount === 1 ? "جهة تواصل" : "جهات تواصل"} لخدمتك.` : "تواصل مع فريق لحظة عند نشر أرقام الدعم."}</small></div><button type="button" onClick={onOpen} className="shrink-0 rounded-xl border border-rose-200 bg-white px-3 py-2 text-xs font-black text-[#63301b] transition hover:bg-rose-50">تواصل معنا</button></div>;
}

function ServiceIntroCarousel({ onActiveChange, onExplore, city }: { onActiveChange: (index: number) => void; onExplore: () => void; city: CityKey }) {
  const slides = [
    { icon: Bike, title: "توصيل سريع إلى بابك", detail: "اطلب احتياجاتك من متاجرك المحلية بسهولة." },
    { icon: BadgePercent, title: "عروض مميزة كل يوم", detail: "اكتشف خصومات مختارة من متاجر لحظة." },
    { icon: Store, title: "متاجر متنوعة في مكان واحد", detail: "مطاعم، بقاليات، صيدليات وخدمات قريبة منك." },
    { icon: MapPinCheck, title: "خدمة تصل إلى موقعك", detail: "حدد موقعك ودع فريق لحظة يتابع طلبك." },
  ];
  const [active, setActive] = useState(0);
  const changeActive = (index: number) => { setActive(index); onActiveChange(index); };
  useEffect(() => {
    const timer = window.setInterval(() => setActive(value => { const next = (value + 1) % slides.length; onActiveChange(next); return next; }), 5000);
    return () => window.clearInterval(timer);
  }, [slides.length]);
  const slide = slides[active];
  const Icon = slide.icon;
  return <section className="service-intro-panel" aria-label="خدمات لحظة"><div className="service-intro-copy"><span className="service-intro-kicker">خدمات لحظة</span><span className="service-intro-tagline">{CITY_LABELS[city]} بين يديك</span><strong>{slide.title}</strong><small>{slide.detail}</small><button type="button" className="service-intro-cta" onClick={onExplore}>استكشف الآن <ChevronLeft className="h-4 w-4" /></button></div><div className="service-intro-offer-mark" aria-label="أقوى العروض لدى لحظة"><span className="service-intro-offer-mark-icon"><BadgePercent className="h-5 w-5" /></span><strong>أقوى العروض</strong><b>لدى لحظة</b></div><div className="service-intro-dots">{slides.map((item, index) => <button key={item.title} type="button" className={index === active ? "service-intro-dot-active" : ""} onClick={() => changeActive(index)} aria-label={`الشريحة ${index + 1}`} />)}</div></section>;
}

function PersistentCartButton({ onCart, cartCount }: { onCart: () => void; cartCount: number }) {
  return <button type="button" className="persistent-cart-button" onClick={onCart} aria-label={`فتح السلة${cartCount ? `، ${cartCount} عناصر` : ""}`}><ShoppingBasket className="h-5 w-5" /><span>السلة</span>{cartCount > 0 ? <b>{cartCount}</b> : null}</button>;
}

function Header({ onSearch, onExplore, searchPlaceholder, city }: { onSearch: () => void; onExplore: () => void; searchPlaceholder: string; city: CityKey }) {
  const [serviceTheme, setServiceTheme] = useState(0);
  return (
    <header className={`relative z-30 border-b border-[#ff6b2d] pt-3 backdrop-blur-xl header-service-theme-${serviceTheme}`}>
      <div className="app-shell header-top-row flex h-[76px] items-center justify-end gap-3">
        <a className="current-location-button" href={lahzaCustomerServiceWhatsAppUrl} target="_blank" rel="noreferrer" title="خدمة الزبائن عبر واتساب" aria-label="خدمة الزبائن عبر واتساب"><span className="current-location-label" aria-label="خدمة الزبائن"><MessageCircle className="h-5 w-5" /><span>خدمة الزبائن</span><ChevronLeft className="h-4 w-4 rotate-90" /></span></a>
      </div>
      <div className="app-shell header-search-wrap"><button className="header-search-button" onClick={onSearch} aria-label="البحث عن منتج"><span key={searchPlaceholder} className="search-placeholder-rotate">{searchPlaceholder}</span><Search className="h-5 w-5" /></button></div><ServiceIntroCarousel onActiveChange={setServiceTheme} onExplore={onExplore} city={city} />
    </header>
  );
}

function PageHeading({ eyebrow, title, detail, onBack }: { eyebrow: string; title: string; detail: string; onBack: () => void }) {
  return (
    <section className="app-shell pt-7 pb-5">
      <p className="section-eyebrow">{eyebrow}</p>
      <h1 className="page-title">{title}</h1>
      <p className="page-detail">{detail}</p>
      <button className="mt-5 inline-flex min-h-12 items-center gap-2 rounded-2xl bg-[#4a2618] px-6 text-base font-black text-white shadow-md transition hover:bg-[#63301b] active:scale-[0.97]" onClick={onBack}><ArrowLeft className="h-5 w-5" /> رجوع</button>
    </section>
  );
}

function PartnerOfferGallery({ slides, onOpen }: { slides: PartnerGallerySlide[]; onOpen: () => void }) {
  const fallbackImages = ["/assets/lahza-offer-bakery.jpg", "/assets/lahza-offer-grocery.jpg", "/assets/lahza-offer-restaurant.jpg"];
  const [activeIndex, setActiveIndex] = useState(0);
  useEffect(() => {
    setActiveIndex(index => slides.length ? index % slides.length : 0);
    if (slides.length < 2) return;
    const timer = window.setInterval(() => setActiveIndex(index => (index + 1) % slides.length), 6200);
    return () => window.clearInterval(timer);
  }, [slides.length]);
  const activeSlide = slides[activeIndex] ?? null;
  const fallback = activeSlide ? (activeSlide.fallbackImageUrl || fallbackImages[activeIndex % fallbackImages.length]) : fallbackImages[0];
  return <div className="hero-image-frame" aria-label="عروض مصورة من متاجر لحظة">{activeSlide ? <><button key={activeSlide.id} type="button" onClick={onOpen} className="hero-gallery-slide block h-full w-full cursor-pointer text-right" aria-label={`فتح العرض: ${activeSlide.name}`}><img src={activeSlide.imageUrl} alt={`عرض ${activeSlide.name} من ${activeSlide.partnerName}`} onError={event => { event.currentTarget.src = fallback; }} className="hero-offer-image" /><span className="hero-offer-phosphor-layer" aria-hidden="true" /><span className="hero-offer-store-badge">{activeSlide.partnerName}</span>{activeSlide.discountPercent ? <span className="hero-offer-discount-inline">خصم {activeSlide.discountPercent}%</span> : null}<div className="hero-offer-caption"><strong className="hero-offer-copy-badge">{activeSlide.name}</strong>{activeSlide.originalProductPrice || activeSlide.offerPrice || activeSlide.unitPrice ? <span className="hero-offer-prices hero-offer-price-badge"><del>{formatSyp(activeSlide.originalProductPrice || activeSlide.unitPrice)}</del><b>فقط {formatSyp(activeSlide.offerPrice || activeSlide.unitPrice)}</b></span> : null}<span className="hero-offer-cta">شاهد العرض</span></div></button>{slides.length > 1 ? <div className="hero-gallery-dots" aria-label="صور العروض">{slides.map((slide, index) => <button key={slide.id} type="button" onClick={() => setActiveIndex(index)} aria-label={`عرض الصورة ${index + 1}`} aria-current={index === activeIndex} className={index === activeIndex ? "hero-gallery-dot-active" : ""} />)}</div> : null}</> : <div className="hero-gallery-empty"><BadgePercent className="h-9 w-9" /><strong>عروض لحظة</strong><span>ترقّبوا أحدث العروض من متاجركم المفضلة</span><button type="button" onClick={onOpen} className="hero-gallery-cta">اكتشف العروض</button></div>}</div>;
}
function EntryGateDialog({ open, onChoose }: { open: boolean; onChoose: (role: "owner" | "partner" | "guest") => void }) {
  return <Dialog open={open} onOpenChange={() => undefined}><DialogContent showCloseButton={false} dir="rtl" className="w-[calc(100%-1.5rem)] max-w-md overflow-hidden rounded-[2rem] border-0 bg-gradient-to-b from-[#ffffff] to-white p-0 shadow-2xl"><div className="entry-gate-hero"><div className="entry-gate-brand"><img src="/assets/lahza-logo.svg" alt="لحظة" /><span>كل شيء في لحظة</span></div><p>مرحباً بك في خدمات لحظة</p><small>اختر طريقة الدخول للمتابعة</small></div><div className="grid gap-3 p-5"><button type="button" onClick={() => onChoose("owner")} className="entry-gate-option"><span className="entry-gate-option-icon"><LayoutDashboard className="h-5 w-5" /></span><span><strong>دخول المالك</strong><small>إدارة التطبيق والطلبات والمتاجر</small></span><ChevronLeft className="h-5 w-5" /></button><button type="button" onClick={() => onChoose("partner")} className="entry-gate-option"><span className="entry-gate-option-icon"><Store className="h-5 w-5" /></span><span><strong>دخول الشريك</strong><small>إدارة متجرك ومنتجاتك وعروضك</small></span><ChevronLeft className="h-5 w-5" /></button><button type="button" onClick={() => onChoose("guest")} className="entry-gate-option entry-gate-option-guest"><span className="entry-gate-option-icon"><UserRound className="h-5 w-5" /></span><span><strong>الدخول كزائر</strong><small>تصفح المتاجر والعروض واطلب بسهولة</small></span><ChevronLeft className="h-5 w-5" /></button></div></DialogContent></Dialog>;
}


function CustomerAuthScreen({ onAuthenticated, onSecret }: { onAuthenticated: (session: CustomerAuthSession) => void; onSecret: () => void }) {
  const lastBrandTap = useRef(0);
  const handleBrandTap = () => {
    const now = Date.now();
    if (now - lastBrandTap.current < 520) {
      lastBrandTap.current = 0;
      onSecret();
      return;
    }
    lastBrandTap.current = now;
  };
  const [step, setStep] = useState<"choices" | "phone" | "otp">("choices");
  const [mode, setMode] = useState<"login" | "register">("login");
  const [phone, setPhone] = useState("");
  const [countryCode, setCountryCode] = useState<CountryCode>(DEFAULT_COUNTRY_CODE);
  const [name, setName] = useState("");
  const [otp, setOtp] = useState("");
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const registerAccount = trpc.lahza.customerAccounts.register.useMutation();
  const callingCode = getCountryCallingCode(countryCode);
  const selectedCountry = countryCallingCodes.find(country => country.code === countryCode) ?? countryCallingCodes[0];
  const normalizedPhone = phone.replace(/\D/g, "").replace(new RegExp(`^${callingCode}`), "").replace(/^0/, "");
  const fullPhone = `+${callingCode}${normalizedPhone}`;
  const validPhone = normalizedPhone.length > 0 && isValidPhoneNumber(fullPhone, countryCode);
  const customerStatusQuery = trpc.lahza.customerAccounts.status.useQuery({ phone: fullPhone }, { enabled: !isStaticDemo && mode === "login" && step === "phone" && validPhone, staleTime: 10_000 });
  const startFlow = (nextMode: "login" | "register") => {
    setMode(nextMode);
    setStep("phone");
    setError("");
  };
  const sendOtp = () => {
    if (!validPhone) { setError(`أدخل رقم هاتف صحيحاً لـ${selectedCountry.name}.`); return; }
    if (name.trim().length < 2) { setError("اكتب اسمك لننشئ حسابك في لحظة."); return; }
    setError("");
    setOtp("");
    setOtpSent(true);
    setStep("otp");
  };
  const loginDirectly = async () => {
    if (!validPhone) { setError(`أدخل رقم هاتف صحيحاً لـ${selectedCountry.name}.`); return; }
    if (isStaticDemo) {
      onAuthenticated({ mode: "customer", phone: fullPhone, remember });
      return;
    }
    setError("");
    const result = await customerStatusQuery.refetch();
    const account = result.data;
    if (!account || String(account.status) === "new") { setError("هذا الرقم غير مسجل بعد. اختر «التسجيل» لإنشاء حساب جديد."); return; }
    if (account.status === "rejected" || account.status === "suspended") { setError("لا يمكن الدخول بهذا الحساب حالياً. تواصل مع فريق لحظة."); return; }
    onAuthenticated({ mode: "customer", phone: fullPhone, name: account.name || undefined, remember });
  };
  const verifyOtp = async () => {
    if (otp !== DEMO_OTP_CODE) { setError("رمز التحقق التجريبي غير صحيح. استخدم 123456."); return; }
    if (mode === "register" && !isStaticDemo) {
      try {
        await registerAccount.mutateAsync({ phone: fullPhone, name: name.trim() });
      } catch (registrationError) {
        setError(registrationError instanceof Error ? registrationError.message : "تعذر إنشاء الحساب حالياً.");
        return;
      }
    }
    onAuthenticated({ mode: "customer", phone: fullPhone, name: name.trim() || undefined, remember });
  };
  return <main className="customer-auth-page" dir="rtl"><div className="customer-auth-card"><button type="button" className="customer-auth-brand" onClick={handleBrandTap} title="انقر مرتين لدخول الإدارة" aria-label="شعار لحظة، انقر مرتين لدخول الإدارة"><span className="customer-auth-brand-lockup"><img className="customer-auth-primary-logo" src="/assets/lahza-primary-logo-display.png" alt="لحظة" /></span><span>لحظة بين يديك</span></button>{step === "choices" ? <div className="customer-auth-art" aria-hidden="true"><div className="customer-auth-art-orb customer-auth-art-orb-pink" /><div className="customer-auth-art-tile customer-auth-art-tile-teal"><ShoppingBasket className="customer-auth-art-icon" /><Sparkles className="customer-auth-art-icon customer-auth-art-icon-small" /></div><div className="customer-auth-art-tile customer-auth-art-tile-light"><PackageCheck className="customer-auth-art-icon" /></div><div className="customer-auth-art-tile customer-auth-art-tile-rose"><BadgePercent className="customer-auth-art-icon" /></div><div className="customer-auth-art-orb customer-auth-art-orb-blue"><MapPinCheck className="customer-auth-art-icon" /></div></div> : null}{step === "choices" ? <><div className="customer-auth-heading"><p>أهلاً بك في لحظة</p><h1>كل طلباتك أقرب إليك</h1><span>سجّل دخولك لتتابع طلباتك وتحصل على تجربة أسرع.</span></div><div className="customer-auth-actions"><button type="button" onClick={() => startFlow("login")} className="customer-auth-primary">تسجيل الدخول <ChevronLeft className="h-5 w-5" /></button><button type="button" onClick={() => startFlow("register")} className="customer-auth-secondary">التسجيل إذا لم تمتلك حسابًا بعد <Plus className="h-5 w-5" /></button><button type="button" onClick={() => onAuthenticated({ mode: "guest" })} className="customer-auth-guest">الدخول كزائر <UserRound className="h-5 w-5" /></button></div><p className="customer-auth-note">يمكنك متابعة التصفح كزائر، وإنشاء حسابك لاحقًا في أي وقت.</p></> : step === "phone" ? <><button type="button" className="customer-auth-back" onClick={() => { setStep("choices"); setError(""); }}><ArrowLeft className="h-4 w-4" /> العودة للخيارات</button><div className="customer-auth-heading"><p>{mode === "login" ? "تسجيل الدخول" : "إنشاء حساب جديد"}</p><h1>{mode === "login" ? "أدخل رقم هاتفك" : "لنبدأ حسابك في لحظة"}</h1><span>{mode === "login" ? "إذا كان رقمك مسجلًا من قبل، ستدخل مباشرة إلى حسابك." : "أدخل اسمك ورقم هاتفك لإنشاء حسابك."}</span></div><div className="customer-auth-form">{mode === "register" ? <label><span>الاسم</span><Input value={name} onChange={event => setName(event.target.value)} placeholder="اكتب اسمك" autoComplete="name" /></label> : null}<label><span>رقم الهاتف</span><div className="customer-auth-phone"><select aria-label="رمز الدولة" value={countryCode} onChange={event => { setCountryCode(event.target.value as CountryCode); setPhone(""); setError(""); }}><option value="SY">سوريا (+963)</option>{countryCallingCodes.filter(country => country.code !== "SY").map(country => <option key={country.code} value={country.code}>{country.name} (+{country.dialCode})</option>)}</select><Input dir="ltr" inputMode="tel" value={phone} onChange={event => setPhone(event.target.value.replace(/\D/g, "").slice(0, 15))} placeholder={countryCode === "SY" ? "9XXXXXXXX" : "رقم الهاتف"} autoComplete="tel-national" /></div><small className="customer-auth-phone-hint">الدولة المختارة: {selectedCountry.name} · +{callingCode}</small></label><label className="customer-auth-remember"><input type="checkbox" checked={remember} onChange={event => setRemember(event.target.checked)} /><span>حفظ معلومات التسجيل على هذا الجهاز</span></label><button type="button" onClick={() => { void (mode === "login" ? loginDirectly() : sendOtp()); }} disabled={customerStatusQuery.isFetching} className="customer-auth-primary">{mode === "login" ? (customerStatusQuery.isFetching ? "جارٍ التحقق من الرقم..." : "دخول برقم الهاتف") : "إرسال رمز التحقق"} <ChevronLeft className="h-5 w-5" /></button>{error ? <p className="customer-auth-error">{error}</p> : null}<p className="customer-auth-demo-hint">{mode === "login" ? "استخدم رقم هاتفك المسجل للدخول مباشرة." : <>نسخة تجريبية: استخدم الرمز <b dir="ltr">123456</b></>}</p></div></> : null}{step === "otp" ? <div className="customer-auth-otp-panel"><button type="button" className="customer-auth-back" onClick={() => { setStep("phone"); setError(""); }}><ArrowLeft className="h-4 w-4" /> تعديل رقم الهاتف</button><div className="customer-auth-heading"><p>التحقق من الرقم</p><h1>أدخل رمز OTP</h1><span>أرسلنا رمزًا تجريبيًا إلى <b dir="ltr">{fullPhone}</b>.</span></div><label className="customer-auth-otp-field"><span>رمز التحقق</span><Input dir="ltr" inputMode="numeric" maxLength={6} value={otp} onChange={event => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="123456" autoFocus /></label><button type="button" onClick={() => { void verifyOtp(); }} disabled={registerAccount.isPending} className="customer-auth-primary">{registerAccount.isPending ? "جارٍ إنشاء الحساب..." : "تحقق ودخول"} <CheckCircle2 className="h-5 w-5" /></button>{error ? <p className="customer-auth-error">{error}</p> : null}<button type="button" className="customer-auth-resend" onClick={() => { setOtp(""); setError(""); setOtpSent(true); }}>إعادة إرسال الرمز التجريبي</button><p className="customer-auth-demo-hint">الرمز التجريبي: <b dir="ltr">123456</b>{otpSent ? " · صالح لهذه الجلسة" : ""}</p></div> : null}</div></main>;
}

function AdminAccessDialog({ open, onOpenChange, secretRole, setSecretRole, pin, setPin, username, setUsername, password, setPassword, onLogin, adminPending, partnerPending }: { open: boolean; onOpenChange: (open: boolean) => void; secretRole: "owner" | "supervisor" | "partner"; setSecretRole: (role: "owner" | "supervisor" | "partner") => void; pin: string; setPin: (value: string) => void; username: string; setUsername: (value: string) => void; password: string; setPassword: (value: string) => void; onLogin: () => void; adminPending: boolean; partnerPending: boolean }) {
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent dir="rtl" className="w-[calc(100%-2rem)] max-w-sm rounded-3xl border-0 bg-white p-6 shadow-2xl"><DialogHeader><div className="admin-lock-icon">L</div><DialogTitle className="pt-2 text-center text-xl">اختر نوع الدخول</DialogTitle><DialogDescription className="text-center">اختر حسابك ثم أدخل بياناته في المكان الصحيح.</DialogDescription></DialogHeader><div className="mt-3 space-y-4"><div className="role-switch"><button onClick={() => setSecretRole("owner")} className={secretRole === "owner" ? "role-selected" : ""}>المالك</button><button onClick={() => setSecretRole("supervisor")} className={secretRole === "supervisor" ? "role-selected" : ""}>مشرف</button><button onClick={() => setSecretRole("partner")} className={secretRole === "partner" ? "role-selected" : ""}>شريك</button></div>{secretRole === "owner" ? <div><Label htmlFor="pin">رمز PIN للمالك</Label><Input id="pin" inputMode="numeric" type="password" value={pin} onChange={e => setPin(e.target.value)} placeholder="••••" /></div> : secretRole === "partner" ? <div><Label htmlFor="password">كلمة مرور الشريك</Label><Input id="password" dir="ltr" type="password" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && password) onLogin(); }} placeholder="كلمة المرور التي أعطاها لك المالك" /></div> : <><div><Label htmlFor="username">اسم المستخدم للمشرف</Label><Input id="username" dir="ltr" value={username} onChange={e => setUsername(e.target.value)} /></div><div><Label htmlFor="password">كلمة المرور للمشرف</Label><Input id="password" dir="ltr" type="password" value={password} onChange={e => setPassword(e.target.value)} /></div></>}<Button disabled={secretRole === "partner" ? partnerPending || !password : !isStaticDemo && (adminPending || (secretRole === "owner" ? !pin : !username.trim() || !password))} className="w-full rounded-xl bg-[#63301b] hover:bg-[#4a2618]" onClick={onLogin}>{secretRole === "partner" ? partnerPending ? "جارٍ فتح حساب الشريك..." : "دخول الشريك" : !isStaticDemo && adminPending ? "جارٍ التحقق..." : "دخول آمن"}</Button></div></DialogContent></Dialog>;
}

export default function Home() {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const [screen, setScreen] = useState<Screen>("home");
  const [customerAuthReady, setCustomerAuthReady] = useState(false);
  const [customerAuth, setCustomerAuth] = useState<CustomerAuthSession | null>(null);
  const [selectedCity, setSelectedCity] = useState<CityKey | null>(() => {
    const saved = typeof window !== "undefined" ? window.sessionStorage.getItem("lahza_selected_city") : null;
    return saved === "manbij" || saved === "jarabulus" ? saved : null;
  });
  const interfaceSettingsQuery = trpc.lahza.interfaceSettings.get.useQuery(undefined, { retry: false });
  useEffect(() => {
    if (!selectedCity || isStaticDemo) return;
    void utils.invalidate();
  }, [selectedCity]);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>("default");
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
  const [entryOpen, setEntryOpen] = useState(false);
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
  const [customerAuthRequiredOpen, setCustomerAuthRequiredOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchPlaceholderIndex, setSearchPlaceholderIndex] = useState(0);
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(CUSTOMER_AUTH_STORAGE_KEY);
      if (saved) setCustomerAuth(JSON.parse(saved) as CustomerAuthSession);
    } catch {
      window.localStorage.removeItem(CUSTOMER_AUTH_STORAGE_KEY);
    } finally {
      setCustomerAuthReady(true);
    }
  }, []);
  const completeCustomerAuth = (session: CustomerAuthSession) => {
    if (session.mode === "customer" && session.remember) window.localStorage.setItem(CUSTOMER_AUTH_STORAGE_KEY, JSON.stringify(session));
    else window.localStorage.removeItem(CUSTOMER_AUTH_STORAGE_KEY);
    setCustomerAuth(session);
  };
  const pullStartY = useRef<number | null>(null);
  const searchPlaceholders = ["ابحث عن شاورما...", "ابحث عن مواد غذائية...", "ابحث عن صيدلية...", "ابحث عن خدمة توصيل..."];
  const searchPlaceholder = searchPlaceholders[searchPlaceholderIndex];
  const canPullRefresh = screen === "home" || screen === "stores" || screen === "offers" || screen === "storeOffers";
  const handleTouchStart = (event: React.TouchEvent<HTMLElement>) => {
    if (canPullRefresh && window.scrollY <= 2) pullStartY.current = event.touches[0]?.clientY ?? null;
  };
  const handleTouchMove = (event: React.TouchEvent<HTMLElement>) => {
    if (pullStartY.current === null || refreshing) return;
    const distance = Math.max(0, Math.min(104, event.touches[0].clientY - pullStartY.current));
    setPullDistance(distance);
  };
  const handleTouchEnd = () => {
    const shouldRefresh = pullDistance >= 72 && !refreshing;
    pullStartY.current = null;
    setPullDistance(0);
    if (!shouldRefresh) return;
    setRefreshing(true);
    void utils.invalidate().finally(() => window.setTimeout(() => setRefreshing(false), 450));
  };
  const [searchText, setSearchText] = useState("");
  const [missingRequesterName, setMissingRequesterName] = useState("");
  const [missingProductName, setMissingProductName] = useState("");
  const [missingProductPhone, setMissingProductPhone] = useState("");
  const [missingProductNotes, setMissingProductNotes] = useState("");
  const [supportOpen, setSupportOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [sharedStoreId] = useState(() => parseSharedStoreId(window.location.search));

  const catalogQuery = trpc.lahza.catalog.list.useQuery(undefined, { enabled: !isStaticDemo, retry: false });
  const deliveryFeesQuery = trpc.lahza.deliveryFees.get.useQuery(undefined, { enabled: !isStaticDemo, retry: false });
  const partnerOffersQuery = trpc.lahza.publicFeaturedOffers.useQuery(undefined, { enabled: !isStaticDemo, retry: false });
  const popularProductsQuery = trpc.lahza.storefront.popularProducts.useQuery(undefined, { enabled: !isStaticDemo, retry: false });
  const storeOffersQuery = trpc.lahza.intercity.offers.useQuery({ storeId: selectedStore?.id ?? 1 }, { enabled: !isStaticDemo && Boolean(selectedStore), retry: false });
  const trackStoreVisit = trpc.lahza.traffic.track.useMutation();
  const customCategoriesQuery = trpc.lahza.customCategories.listActive.useQuery(undefined, { enabled: !isStaticDemo, retry: false });
  const supportContactsQuery = trpc.lahza.support.contacts.useQuery(undefined, { enabled: !isStaticDemo, retry: false });
  const normalizedSearchText = searchText.trim();
  const productSearchInput = useMemo(() => ({ query: normalizedSearchText }), [normalizedSearchText]);
  const productSearchQuery = trpc.lahza.storefront.searchProducts.useQuery(productSearchInput, { enabled: !isStaticDemo && searchOpen && normalizedSearchText.length >= 2, retry: false });
  const orderTrackingInput = useMemo(() => ({ orderId: submittedOrder?.id ?? 1, customerPhone: submittedOrder?.customerPhone ?? "+963900000000" }), [submittedOrder?.id, submittedOrder?.customerPhone]);
  const orderTrackingQuery = trpc.lahza.orders.track.useQuery(orderTrackingInput, { enabled: !isStaticDemo && Boolean(submittedOrder), retry: false, refetchInterval: screen === "orderTracking" ? 15_000 : false });
  const adminSessionQuery = trpc.lahza.admin.session.useQuery(undefined, { enabled: !isStaticDemo, retry: false });
  const partnerSessionQuery = trpc.lahza.partner.session.useQuery(undefined, { enabled: !isStaticDemo, retry: false });
  const pointsQuery = trpc.lahza.customers.points.balance.useQuery({ phone: `+963${checkoutPhone}` }, { enabled: !isStaticDemo && /^9\d{8}$/.test(checkoutPhone), retry: false });
  const updateCustomerPhone = trpc.lahza.customerAccounts.updatePhone.useMutation({ onSuccess: (_result, variables) => { updateCustomerSessionPhone(variables.newPhone); toast.success("تم تحديث رقم هاتفك بنجاح"); }, onError: error => toast.error(error.message) });
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
  const supportContacts = supportContactsQuery.data ?? [];
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
    setSelectedStore({ id: sharedStore.id, name: sharedStore.name, category: sharedStore.category as LahzaCategory, imageUrl: sharedStore.imageUrl, storeOpen: sharedStore.storeOpen });
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
    onSuccess: async result => {
      await utils.lahza.partner.session.invalidate();
      setSecretOpen(false);
      toast.success(`أهلاً بك في متجر ${result.name}`);
      setLocation("/partner/store");
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
  const deviceId = useMemo(() => getDeviceId(), []);
  const notificationsQuery = trpc.lahza.notifications.feed.useQuery({ deviceId }, { enabled: !isStaticDemo, refetchInterval: 60_000, staleTime: 30_000 });
  const markNotificationRead = trpc.lahza.notifications.markRead.useMutation({ onSuccess: () => { void notificationsQuery.refetch(); } });

  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) setNotificationPermission(window.Notification.permission);
  }, []);

  const enableCustomerNotifications = async () => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      toast.error("الإشعارات الأصلية غير مدعومة في هذا المتصفح حالياً");
      return;
    }
    const permission = await window.Notification.requestPermission();
    setNotificationPermission(permission);
    toast[permission === "granted" ? "success" : "error"](permission === "granted" ? "تم تفعيل تنبيهات لحظة" : "لم يتم تفعيل الإشعارات");
  };

  useEffect(() => {
    const timer = window.setInterval(() => setSearchPlaceholderIndex(index => (index + 1) % searchPlaceholders.length), 3200);
    return () => window.clearInterval(timer);
  }, [searchPlaceholders.length]);

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
  const partnerOffers = isStaticDemo ? staticDemoProducts.filter(product => product.category === "offers").map(product => ({ id: product.id, text: product.unitPrice > 0 ? `${product.name} — ${formatSyp(product.unitPrice)}` : product.name, partnerName: "شريك لحظة", storeName: "متجر لحظة التجريبي", storeId: -1, storeCategory: "offers", ratingStars: 3, featuredStatus: "approved" as const })) : partnerOffersQuery.data ?? [];
  const homePopularProducts = isStaticDemo ? [] : (popularProductsQuery.data ?? []);
  const featuredStoreCards = useMemo(() => {
    if (isStaticDemo) return homeFeaturedStores;
    const uniqueStores = new Map<number, { id: number; name: string; category: LahzaCategory; note: string; ratingStars: number; storeOpen?: boolean | null }>();
    for (const offer of partnerOffers) {
      const storeId = Number(offer.storeId ?? 0);
      const category = offer.storeCategory as LahzaCategory;
      if (storeId > 0 && !uniqueStores.has(storeId) && categoryImageByKey[category]) uniqueStores.set(storeId, { id: storeId, name: offer.storeName || "متجر مميز", category, note: "لديه عروض مميزة نشطة", ratingStars: offer.ratingStars ?? 3 });
    }
    return Array.from(uniqueStores.values());
  }, [isStaticDemo, partnerOffers]);
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

  const addLine = (line: Omit<CartLine, "id">, returnTo: Screen = "store") => {
    if (customerAuth?.mode !== "customer") {
      setCustomerAuthRequiredOpen(true);
      return;
    }
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
    if (customerAuth?.mode !== "customer") {
      setCustomerAuthRequiredOpen(true);
      return;
    }
    setCheckoutMode("delivery");
    setCheckoutStep(1);
    setScreen("checkout");
  };
  const openMyOrder = () => {
    if (submittedOrder && cart.length === 0) {
      setScreen("orderTracking");
      return;
    }
    openCart();
  };
  const openAccount = () => setScreen("account");
  const logoutCustomer = () => {
    window.localStorage.removeItem(CUSTOMER_AUTH_STORAGE_KEY);
    setCustomerAuth(null);
    setScreen("home");
  };
  const updateCustomerSessionPhone = (newPhone: string) => {
    setCustomerAuth(previous => {
      if (!previous) return previous;
      const next = { ...previous, phone: newPhone };
      if (next.mode === "customer" && next.remember) window.localStorage.setItem(CUSTOMER_AUTH_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
    setCheckoutPhone(newPhone.replace("+963", ""));
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

  const submitCheckout = async () => {
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
    setSelectedStore({ id: result.storeId, name: result.storeName, category: result.storeCategory, imageUrl: result.storeImageUrl, storeOpen: result.storeOpen });
    setScreen("store");
  };

  const openFeaturedOffers = () => {
    setSelectedGalleryOffer(null);
    setFocusedOfferId(null);
    setScreen("offers");
  };

  const chooseOffer = (offer: CustomerOffer) => {
    setSelectedOffer(offer);
    setFocusedOfferId(null);
    setScreen("offerQuantity");
  };

  const handleAdminLogin = () => {
    if (secretRole === "partner") {
      partnerLogin.mutate({ password });
      return;
    }
    if (isStaticDemo) {
      if (secretRole !== "owner") {
        toast.error("لوحة المشرف غير مفعّلة في النسخة التجريبية المحلية.");
        return;
      }
      if (pin !== DEMO_OWNER_PIN) {
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

  if (!customerAuthReady) return <main className="customer-auth-loading" dir="rtl"><img src="/assets/lahza-logo.svg" alt="لحظة" /><span>جارٍ تجهيز لحظتك...</span></main>;
  const staffSessionLoading = !isStaticDemo && (adminSessionQuery.isLoading || partnerSessionQuery.isLoading);
  const hasStaffSession = Boolean(adminSessionQuery.data?.role || partnerSessionQuery.data);
  if (!customerAuth && staffSessionLoading) return <main className="customer-auth-loading" dir="rtl"><img src="/assets/lahza-logo.svg" alt="لحظة" /><span>جارٍ التحقق من الحساب...</span></main>;
  const adminAccessDialog = <AdminAccessDialog open={secretOpen} onOpenChange={setSecretOpen} secretRole={secretRole} setSecretRole={setSecretRole} pin={pin} setPin={setPin} username={username} setUsername={setUsername} password={password} setPassword={setPassword} onLogin={handleAdminLogin} adminPending={adminLogin.isPending} partnerPending={partnerLogin.isPending} />;
  if (!customerAuth && !hasStaffSession) return <><CustomerAuthScreen onAuthenticated={completeCustomerAuth} onSecret={() => setSecretOpen(true)} />{adminAccessDialog}</>;
  if (customerAuth && !selectedCity) return <CitySelectionGate onSelect={city => { window.sessionStorage.setItem("lahza_selected_city", city); setSelectedCity(city); void utils.invalidate(); }} />;

  return (
    <main dir="rtl" className="lahza-app-shell min-h-screen text-slate-950" onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}>
      <div className={`pull-refresh-indicator ${pullDistance > 0 || refreshing ? "pull-refresh-indicator-visible" : ""}`} style={{ transform: `translate(-50%, ${refreshing ? 12 : Math.min(62, pullDistance * .72) - 44}px)` }} role="status" aria-live="polite"><span className={refreshing ? "pull-refresh-spinner" : ""}><ArrowLeft className="h-4 w-4 -rotate-90" /></span><small>{refreshing ? "جارٍ التحديث" : pullDistance >= 72 ? "اترك للتحديث" : "اسحب للتحديث"}</small></div>
      <PersistentCartButton onCart={openCart} cartCount={cart.length} />
      {screen === "home" ? <Header onSearch={() => setSearchOpen(true)} onExplore={openFeaturedOffers} searchPlaceholder={searchPlaceholder} city={selectedCity ?? "manbij"} /> : null}
      {screen === "home" && !isStaticDemo && (notificationsQuery.data ?? []).some(notification => notification.unread) ? <section className="app-shell mt-3"><div className="rounded-3xl border border-orange-200 bg-gradient-to-l from-orange-50 via-white to-amber-50 p-4 shadow-[0_12px_30px_rgba(232,105,38,0.12)]"><div className="mb-3 flex items-center gap-2 text-[#63301b]"><span className="grid h-9 w-9 place-items-center rounded-xl bg-[#ff7a33] text-white"><BellRing className="h-4 w-4" /></span><div className="min-w-0 flex-1"><strong className="block text-sm font-black">تنبيهات لحظة</strong><small className="text-[11px] text-[#a9471b]">عروض وأخبار جديدة لك</small></div>{notificationPermission !== "granted" && "Notification" in window ? <button type="button" onClick={enableCustomerNotifications} className="rounded-xl bg-[#63301b] px-3 py-2 text-[11px] font-black text-white transition hover:bg-[#4a2618]">تفعيل</button> : null}</div><div className="space-y-2">{(notificationsQuery.data ?? []).filter(notification => notification.unread).slice(0, 3).map(notification => <button key={notification.id} type="button" onClick={() => { markNotificationRead.mutate({ deviceId, campaignId: notification.id }); if (notification.targetPath === "/offers") setScreen("offers"); }} className="w-full rounded-2xl border border-orange-100 bg-white/85 p-3 text-right transition hover:border-orange-300 hover:shadow-sm"><span className="flex items-start justify-between gap-3"><span className="min-w-0"><strong className="block text-sm text-[#4a2618]">{notification.title}</strong><small className="mt-1 block leading-5 text-slate-600">{notification.body}</small></span><span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#ff6b2d]" aria-label="إشعار جديد" /></span></button>)}</div></div></section> : null}

      <Dialog open={Boolean(selectedGalleryOffer)} onOpenChange={open => !open && setSelectedGalleryOffer(null)}><DialogContent showCloseButton={false} dir="rtl" className="w-[calc(100%-1.5rem)] max-w-lg overflow-hidden rounded-3xl border-0 bg-white p-0 shadow-2xl">{selectedGalleryOffer ? <><DialogClose aria-label="إغلاق العرض" className="absolute right-4 top-4 z-10 grid h-12 w-12 place-items-center rounded-full border border-white/70 bg-slate-950/50 text-white shadow-lg backdrop-blur-sm transition hover:scale-105 hover:bg-slate-950/70 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2"><X className="h-7 w-7" strokeWidth={3} /><span className="sr-only">إغلاق العرض</span></DialogClose>{selectedGalleryOffer.imageUrl ? <img src={selectedGalleryOffer.imageUrl} alt={`عرض ${selectedGalleryOffer.name}`} className="max-h-[52vh] w-full object-cover" /> : <div className="grid h-52 place-items-center bg-gradient-to-br from-red-600 to-orange-500 text-white"><BadgePercent className="h-14 w-14" /></div>}<div className="p-6"><DialogHeader><DialogTitle className="text-right text-xl text-[#4a2618]">{selectedGalleryOffer.name}</DialogTitle><DialogDescription className="text-right text-sm font-bold text-red-600">{selectedGalleryOffer.partnerName}</DialogDescription></DialogHeader><p className="mt-4 text-sm leading-7 text-slate-600">انتقل إلى قسم العروض لرؤية تفاصيل العرض والطلب من المتجر.</p><Button onClick={openFeaturedOffers} className="mt-5 w-full rounded-2xl bg-red-600 py-6 text-base hover:bg-red-700"><ShoppingBasket className="h-5 w-5" /> اطلبه الآن</Button></div></> : null}</DialogContent></Dialog>

      <Dialog open={searchOpen} onOpenChange={open => { setSearchOpen(open); if (!open) setSearchText(""); }}><DialogContent dir="rtl" className="w-[calc(100%-1.5rem)] max-w-lg rounded-3xl bg-white p-5"><DialogHeader><DialogTitle className="flex items-center gap-2 text-right text-xl text-[#4a2618]"><Search className="h-5 w-5 text-red-600" /> البحث عن منتج</DialogTitle><DialogDescription className="text-right">اكتب اسم المنتج أو المتجر، وستظهر لك الأسعار وحالة التوفر.</DialogDescription></DialogHeader><div className="mt-3"><Label htmlFor="product-search">اسم المنتج أو المتجر</Label><Input id="product-search" autoFocus value={searchText} onChange={event => setSearchText(event.target.value)} placeholder="مثال: فروج، عدس، حلويات..." className="mt-2 h-12 border-slate-200 bg-white text-base shadow-sm" /></div><div className="mt-4 max-h-[52vh] space-y-2 overflow-y-auto pr-1">{normalizedSearchText.length < 2 ? <div className="rounded-2xl bg-slate-50 p-5 text-center text-sm text-slate-500">اكتب حرفين على الأقل لبدء البحث.</div> : productSearchQuery.isLoading ? <div className="rounded-2xl bg-slate-50 p-5 text-center text-sm text-slate-500">جارٍ البحث عن المنتجات...</div> : productSearchQuery.data?.length ? productSearchQuery.data.map(result => <button key={result.id} type="button" onClick={() => openSearchResult(result as ProductSearchResult)} className="w-full rounded-2xl border border-slate-100 bg-white p-4 text-right shadow-sm transition hover:border-rose-200 hover:bg-rose-50 active:scale-[0.99]"><span className="flex items-start justify-between gap-3"><span className="min-w-0"><strong className="block truncate text-base text-[#4a2618]">{result.name}</strong><small className="mt-1 block truncate text-xs font-bold text-slate-500">من متجر: {result.storeName}</small></span><span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${result.available ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>{result.available ? "متاح" : "غير متاح"}</span></span><span className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm"><strong className="text-red-600">{result.price > 0 ? `سعر تقديري: ${formatNewSyp(result.price)}` : "السعر عند التأكيد"}</strong><small className={result.storeOpen ? "text-slate-500" : "font-bold text-amber-700"}>{result.storeOpen ? "فتح صفحة المتجر" : "المتجر مغلق حالياً"}</small></span></button>) : <div className="rounded-2xl bg-slate-50 p-5 text-center text-sm text-slate-500">لم نجد منتجات أو متاجر مطابقة. يمكنك استخدام «لم تجد ما تريد؟» لطلب المنتج من الإدارة.</div>}</div></DialogContent></Dialog>
      <SupportContactsDialog open={supportOpen} onOpenChange={setSupportOpen} contacts={supportContacts} />
      <AboutLahzaDialog open={aboutOpen} onOpenChange={setAboutOpen} />
      <CustomerAuthRequiredDialog open={customerAuthRequiredOpen} onContinue={() => { setCustomerAuthRequiredOpen(false); setCustomerAuth(null); }} onCancel={() => setCustomerAuthRequiredOpen(false)} />
      

      <div key={screen === "checkout" ? `checkout-${checkoutStep}` : screen} className={`screen-transition ${screen === "home" ? "screen-transition-home" : "screen-transition-internal"}`}>
      {screen === "home" ? (
        <>
          <div className="city-welcome-ticker" role="status"><div className="city-welcome-ticker-track"><span>{interfaceSettingsQuery.data?.tickerPrimary ?? "لم يفوتك أي جديد"}</span><span>{interfaceSettingsQuery.data?.tickerSecondary ?? `اهلا بكم في مدينة ${CITY_LABELS[selectedCity ?? "manbij"]}`}</span><span>{interfaceSettingsQuery.data?.tickerPrimary ?? "لم يفوتك أي جديد"}</span></div></div>
          <section className="app-shell pb-10 home-discover-section">
            <div className="home-section-heading"><div><h2 className="section-title">اكتشف ما تحتاجه</h2></div><button type="button" onClick={() => setScreen("delivery")}>عرض الكل <ChevronLeft className="h-4 w-4" /></button></div>
            <div className="home-category-row" dir="rtl" aria-label="أقسام لحظة">
              {homeDiscoverCategories.map(item => <button key={item.key} type="button" className="home-category-card" onClick={() => { if (!item.category) { setScreen("delivery"); return; } setSelectedStore(null); setSelectedProduct(null); setRestaurantFilter("all"); setActiveCustomCategory(null); setActiveCategory(item.category); setScreen("stores"); }}><span className="home-category-emoji" aria-hidden="true">{item.icon}</span><span>{item.title}</span></button>)}
              <button type="button" className="home-category-card home-category-all" onClick={() => setScreen("delivery")}><span className="home-category-all-grid" aria-hidden="true"><span /><span /><span /><span /></span><span className="home-category-all-label">الكل</span></button>
            </div>
            <div className="home-offers-heading"><BadgePercent className="h-5 w-5" /><h2>العروض الحالية</h2></div><div className="global-offer-bar home-offer-gallery"><PartnerOfferGallery slides={partnerGallerySlides} onOpen={openFeaturedOffers} /></div>
            <section className="home-showcase-block"><div className="home-section-heading"><div><h2 className="section-title">المتاجر المميزة</h2></div><button type="button" onClick={() => setScreen("delivery")}>عرض الكل <ChevronLeft className="h-4 w-4" /></button></div><div className="home-featured-row">{featuredStoreCards.length ? featuredStoreCards.map(store => <button key={`${store.id}-${store.name}`} type="button" className="home-featured-store" onClick={() => { setActiveCategory(store.category); setActiveCustomCategory(null); setSelectedProduct(null); setSelectedStore({ id: store.id, name: store.name, category: store.category, storeOpen: store.storeOpen }); setScreen("store"); window.scrollTo({ top: 0, behavior: "smooth" }); }}><img src={categoryImageByKey[store.category]} alt="" loading="lazy" /><strong>{store.name}</strong><span className="home-store-rating" aria-label={`تقييم ${store.ratingStars ?? 3} من 5`}>{"★".repeat(store.ratingStars ?? 3)}{"☆".repeat(5 - (store.ratingStars ?? 3))}</span><small>{store.note}</small><span className="home-store-open">لديه عروض</span></button>) : <div className="home-featured-empty">لا توجد متاجر لديها عروض مميزة حالياً</div>}</div></section>
            {homePopularProducts.length ? <section className="home-showcase-block"><div className="home-section-heading"><div><p className="section-eyebrow">مختارة من الكتالوج</p><h2 className="section-title">الأكثر طلباً</h2></div><button type="button" onClick={() => setScreen("delivery")}>عرض الكل <ChevronLeft className="h-4 w-4" /></button></div><div className="home-popular-grid">{homePopularProducts.map(product => <button key={`${product.catalogItemId ?? product.name}-${product.category}`} type="button" className="home-popular-product" onClick={() => { setActiveCategory(product.category); setActiveCustomCategory(null); setSelectedStore(null); setScreen("stores"); }}><img src={product.imageUrl || categoryImageByKey[product.category]} alt="" loading="lazy" /><span className="home-product-favorite"><Sparkles className="h-3.5 w-3.5" /></span><span className="home-product-plus"><Plus className="h-4 w-4" /></span><strong>{product.name}</strong></button>)}</div></section> : null}
            {homeShortcut ? <div className="mt-5 space-y-2"><button type="button" onClick={() => setLocation(homeShortcut.path)} className="flex w-full items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-right text-[#4a2618] shadow-sm transition hover:bg-rose-100 active:scale-[0.98]" aria-label={`فتح ${homeShortcut.label}`}><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#63301b] text-white">{homeShortcut.path === "/partner/store" ? <Store className="h-5 w-5" /> : <LayoutDashboard className="h-5 w-5" />}</span><span className="flex min-w-0 flex-1 flex-col gap-1"><strong className="text-sm font-black">{homeShortcut.label}</strong><small className="text-xs font-medium text-slate-600">{homeShortcut.description}</small></span><ChevronLeft className="h-5 w-5 text-[#63301b]" /></button><button type="button" onClick={() => homeAccountKind === "partner" ? partnerHomeLogout.mutate() : adminHomeLogout.mutate()} disabled={partnerHomeLogout.isPending || adminHomeLogout.isPending} className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-red-100 bg-red-50 px-4 py-2.5 text-sm font-bold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed"><LogOut className="h-4 w-4" />{partnerHomeLogout.isPending || adminHomeLogout.isPending ? "جارٍ تسجيل الخروج..." : "تسجيل الخروج"}</button></div> : null}
            <div className="mt-7 flex flex-wrap items-center justify-center gap-2"><button type="button" onClick={() => setSupportOpen(true)} className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-white px-3 py-2 text-xs font-black text-[#63301b] transition hover:bg-rose-50"><Phone className="h-4 w-4 text-[#ff8438]" /> تواصل معنا</button><button type="button" onClick={() => setAboutOpen(true)} className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold text-slate-500 transition hover:bg-slate-50 hover:text-[#63301b]"><CircleHelp className="h-4 w-4" /> حول التطبيق</button></div><div className="mt-5 flex items-center justify-center gap-2 text-xs text-slate-400"><Bike className="h-4 w-4 text-red-600" /><span>خدمة محلية مخصصة لـ {CITY_LABELS[selectedCity ?? "manbij"]}</span></div>
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
                const color = item.custom ? "from-slate-100 to-rose-50 text-[#7a3b1d]" : categoryColors[item.category];
                const image = categoryImageByKey[item.category];
                return <button key={item.key} onClick={() => { setSelectedStore(null); setSelectedProduct(null); setRestaurantFilter("all"); setActiveCustomCategory(item.custom); setActiveCategory(item.category); setScreen("stores"); }} className={`category-card ${activeCategory === item.category && (item.custom?.id ? activeCustomCategory?.id === item.custom.id : !activeCustomCategory) ? "category-card-active" : ""}`}>
                  {image ? <span className="category-card-image"><img src={image} alt="" loading="lazy" onError={event => { event.currentTarget.style.display = "none"; }} /></span> : null}
                  <span className={`category-icon bg-gradient-to-br ${color}`}><Icon className="h-5 w-5" /></span>
                  <span className="category-card-copy"><span>{item.title}</span><small>{item.subtitle}</small></span>
                  {count > 0 ? <span className="category-badge">{count}</span> : <Plus className="h-4 w-4 text-slate-300" />}
                </button>;
              })}
            </div>
            <button type="button" onClick={() => setMissingProductOpen(true)} className="mt-5 flex w-full items-center gap-3 rounded-2xl border border-dashed border-rose-300 bg-rose-50/70 px-4 py-4 text-right text-[#4a2618] transition hover:bg-rose-100"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#63301b] text-white"><CircleHelp className="h-5 w-5" /></span><span className="flex min-w-0 flex-1 flex-col gap-1"><strong className="text-sm font-black">لم تجد ما تريد؟</strong><small className="text-xs font-medium text-slate-600">اطلب منتجاً غير موجود وسنبحث عن متجر يوفره.</small></span><ChevronLeft className="h-5 w-5" /></button>
          </section>
        </>
      ) : null}

      {screen === "stores" && activeCategory ? <StoresScreen category={activeCategory} categoryTitle={activeCustomCategory?.title} stores={categoryStores} loading={categoryStoresQuery.isLoading && !isStaticDemo} restaurantFilter={restaurantFilter} onRestaurantFilterChange={setRestaurantFilter} onBack={() => { setScreen("delivery"); setActiveCategory(null); setActiveCustomCategory(null); }} onChoose={store => { if (!isStaticDemo) trackStoreVisit.mutate({ storeId: store.id, source: "direct" }); setSelectedStore(store); window.scrollTo({ top: 0, behavior: "smooth" }); setScreen("store"); }} /> : null}

      <Dialog open={missingProductOpen} onOpenChange={setMissingProductOpen}><DialogContent dir="rtl" className="w-[calc(100%-1.5rem)] max-w-md rounded-3xl bg-white"><DialogHeader><DialogTitle className="text-right text-xl text-[#4a2618]">اطلب منتجاً غير موجود</DialogTitle><DialogDescription className="text-right">اكتب ما تحتاجه وسيتابع فريق لحظة إمكانية توفيره أو إضافة متجر مناسب.</DialogDescription></DialogHeader><div className="grid gap-3 rounded-2xl bg-slate-50 p-4"><div><Label>اسمك</Label><Input className="mt-1 border-slate-200 bg-white shadow-sm" value={missingRequesterName} onChange={event => setMissingRequesterName(event.target.value)} placeholder="الاسم" /></div><div><Label>رقم الهاتف</Label><Input className="mt-1 border-slate-200 bg-white shadow-sm" dir="ltr" inputMode="tel" value={missingProductPhone} onChange={event => setMissingProductPhone(event.target.value)} placeholder="+9639xxxxxxxx" /></div><div><Label>اسم المنتج المطلوب</Label><Input className="mt-1 border-slate-200 bg-white shadow-sm" value={missingProductName} onChange={event => setMissingProductName(event.target.value)} placeholder="مثال: حقيبة مدرسية للصف الخامس" /></div><div><Label>تفاصيل إضافية (اختياري)</Label><Textarea className="mt-1 border-slate-200 bg-white shadow-sm" value={missingProductNotes} onChange={event => setMissingProductNotes(event.target.value)} placeholder="اللون أو المقاس أو العلامة التجارية" /></div><Button disabled={createMissingProductRequest.isPending || missingRequesterName.trim().length < 2 || missingProductName.trim().length < 2 || !/^\+9639\d{8}$/.test(missingProductPhone)} onClick={() => createMissingProductRequest.mutate({ customerName: missingRequesterName.trim(), customerPhone: missingProductPhone.trim(), productName: missingProductName.trim(), notes: missingProductNotes.trim() || undefined })} className="mt-1 rounded-2xl bg-red-600 py-6 hover:bg-red-700">{createMissingProductRequest.isPending ? "جارٍ الإرسال..." : "إرسال الطلب"}</Button></div></DialogContent></Dialog>
      {screen === "store" && selectedStore ? <StoreProductsScreen store={selectedStore} products={selectedStoreProducts} loading={storeProductsQuery.isLoading && !isStaticDemo} onBack={() => { setScreen("stores"); setSelectedProduct(null); }} onChooseProduct={product => { setSelectedProduct(product); setScreen("productQuantity"); }} onOpenOffers={() => setScreen("storeOffers")} /> : null}
      {screen === "productQuantity" && selectedStore && selectedProduct ? <ProductQuantityScreen store={selectedStore} product={selectedProduct} storeOpen={selectedStore.storeOpen} onBack={() => setScreen("store")} onAdd={quantity => { void addFromStore(selectedStore.id, () => addLine({ category: selectedStore.category, itemName: selectedProduct.name, quantity, unit: selectedProduct.unit, unitPrice: selectedProduct.unitPrice, catalogItemId: selectedProduct.id < 0 ? undefined : selectedProduct.id, priceKnown: selectedProduct.unitPrice > 0 }, "store")); }} /> : null}
      {screen === "storeOffers" && selectedStore ? <StoreOffersScreen store={selectedStore} offers={(isStaticDemo ? partnerOffers : (storeOffersQuery.data ?? [])) as CustomerOffer[]} loading={storeOffersQuery.isLoading && !isStaticDemo} onBack={() => setScreen("store")} onChoose={chooseOffer} /> : null}

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
        <OfferDestinationScreen offers={partnerOffers as CustomerOffer[]} onBack={goHome} loading={partnerOffersQuery.isLoading && !isStaticDemo} focusedOfferId={focusedOfferId} onChoose={chooseOffer} />
      ) : null}

      {screen === "offerQuantity" && selectedOffer ? <OfferQuantityScreen offer={selectedOffer} storeOpen={selectedOffer.storeOpen} onBack={() => setScreen(selectedStore && selectedOffer.storeId === selectedStore.id ? "storeOffers" : "offers")} onAdd={quantity => { void addFromStore(selectedOffer.storeId, () => { const category = selectedOffer.storeCategory && selectedOffer.storeCategory in categoryMeta ? selectedOffer.storeCategory as LahzaCategory : "offers"; addLine({ category, catalogItemId: selectedOffer.catalogItemId ?? undefined, itemName: selectedOffer.productName ?? selectedOffer.text, quantity, unit: selectedOffer.productUnit ?? "وحدة", unitPrice: selectedOffer.productPrice ?? 0, priceKnown: Boolean(selectedOffer.productPrice && selectedOffer.productPrice > 0) }, selectedStore && selectedOffer.storeId === selectedStore.id ? "storeOffers" : "offers"); }); }} /> : null}

      {screen === "orderTracking" && submittedOrder ? <OrderTrackingScreen order={orderTrackingQuery.data ? { id: orderTrackingQuery.data.id, customerPhone: orderTrackingQuery.data.customerPhone, orderType: orderTrackingQuery.data.orderType, customerName: orderTrackingQuery.data.customerName, status: orderTrackingQuery.data.status, totalAmount: orderTrackingQuery.data.totalAmount, deliveryFee: orderTrackingQuery.data.deliveryFee, deliveryAddress: orderTrackingQuery.data.locationText || submittedOrder.deliveryAddress, paymentMethod: orderTrackingQuery.data.paymentMethod, eta: submittedOrder.eta, lines: orderTrackingQuery.data.lines.map(line => ({ id: String(line.id), catalogItemId: line.catalogItemId ?? undefined, category: "groceries" as LahzaCategory, itemName: line.itemName, quantity: Number(line.quantity), unit: line.unit, unitPrice: line.unitPrice, priceKnown: line.priceKnown })), notes: orderTrackingQuery.data.notes || submittedOrder.notes } : submittedOrder} loading={orderTrackingQuery.isLoading} onHome={goHome} onOpenCart={openCart} /> : null}
      {screen === "account" && customerAuth ? <CustomerAccountScreen session={customerAuth} onBack={goHome} onLogout={logoutCustomer} onPhoneSubmit={newPhone => { if (customerAuth.mode === "customer" && customerAuth.phone) updateCustomerPhone.mutate({ currentPhone: customerAuth.phone, newPhone }); }} savingPhone={updateCustomerPhone.isPending} onOpenOrder={submittedOrder ? () => setScreen("orderTracking") : undefined} /> : null}

      {screen === "checkout" ? (
        <>
          <PageHeading eyebrow={checkoutMode === "delivery" ? `إتمام الطلب · الخطوة ${checkoutStep} من 3` : "تأكيد الرحلة"} title={checkoutMode === "delivery" ? checkoutStep === 1 ? "ملخص طلبك" : checkoutStep === 2 ? "بيانات التوصيل" : "راجع واطلب الآن" : "تأكيد رحلتك"} detail={checkoutMode === "delivery" ? checkoutStep === 1 ? "تحقق من السلة وطبّق رمز خصم أو إحالة إن وجد." : checkoutStep === 2 ? "أدخل بيانات التواصل وأكّد موقعك عبر زر تحديد موقعي. العنوان اليدوي اختياري." : "راجع كل تفاصيل طلبك واختر طريقة الدفع ثم أرسله." : "أدخل بيانات التواصل وحدد موقعك أو اكتبه يدوياً، ثم أرسل طلبك."} onBack={() => checkoutMode === "delivery" && checkoutStep > 1 ? setCheckoutStep(step => (step - 1) as 1 | 2 | 3) : setScreen(checkoutMode === "delivery" ? "delivery" : "taxi")} />
          {checkoutMode === "delivery" ? <section className="app-shell pb-1"><div className="checkout-flow checkout-flow-steps" aria-label="مراحل تأكيد الطلب"><button type="button" onClick={() => setCheckoutStep(1)} className={checkoutStep === 1 ? "checkout-flow-active" : ""}><b>1</b> الملخص</button><button type="button" onClick={() => checkoutStep > 1 && setCheckoutStep(2)} className={checkoutStep === 2 ? "checkout-flow-active" : ""}><b>2</b> التوصيل</button><button type="button" disabled={checkoutStep < 3} onClick={() => checkoutStep === 3 && setCheckoutStep(3)} className={checkoutStep === 3 ? "checkout-flow-active" : ""}><b>3</b> التأكيد</button></div></section> : null}
          {checkoutMode === "delivery" && checkoutStep === 1 ? <section className="app-shell space-y-5 pb-10"><div className="checkout-card checkout-cart-card"><div className="checkout-card-title"><ClipboardList className="h-5 w-5 text-[#f26d31]" /><span>ملخص الطلب</span></div><CartPreview cart={cart} removeLine={removeLine} updateQuantity={updateLineQuantity} total={total} hasPharmacy={hasPharmacy} deliveryFeeNewSyp={cartDeliveryFeeNewSyp} deliveryPercent={deliveryPercent} deliveryArea="منبج" grandTotalNewSyp={cartGrandTotalNewSyp} onContinueShopping={() => setScreen("delivery")} /></div><div className="checkout-card promotion-card"><div className="checkout-card-title"><BadgePercent className="h-5 w-5 text-[#f26d31]" /><span>خصم على طلبك</span></div><div className="promotion-help"><article><BadgePercent className="h-4 w-4" /><div><strong>رمز الخصم</strong><span>رمز تقدمه لحظة يمنحك خصماً على الطلب.</span></div></article><article><Share2 className="h-4 w-4" /><div><strong>رمز الإحالة</strong><span>رمز يرسله لك عميل لحظة. استخدم رمزاً واحداً فقط.</span></div></article></div><div className="promotion-input-row"><div><Label htmlFor="discountCode">رمز الخصم</Label><Input id="discountCode" value={discountCode} onChange={event => { setDiscountCode(event.target.value.toUpperCase()); setDiscountPreview(null); }} placeholder="مثال: LAHZA10" dir="ltr" /></div><Button type="button" variant="outline" onClick={() => void applyPromotion("discount")} disabled={previewPromotion.isPending || !discountCode.trim()} className="promotion-verify-button">{previewPromotion.isPending ? "جارٍ التحقق" : "تحقق"}</Button></div><div className="promotion-input-row"><div><Label htmlFor="referralCode">رمز الإحالة</Label><Input id="referralCode" value={referralCode} onChange={event => { setReferralCode(event.target.value.toUpperCase()); setReferralPreview(null); }} placeholder="مثال: LHZ-AB12" dir="ltr" /></div><Button type="button" variant="outline" onClick={() => void applyPromotion("referral")} disabled={previewPromotion.isPending || !referralCode.trim()} className="promotion-verify-button">{previewPromotion.isPending ? "جارٍ التحقق" : "تحقق"}</Button></div>{activePromotion ? <div className="promotion-applied"><span>تم تطبيق {activePromotion.kind === "discount" ? "رمز الخصم" : "رمز الإحالة"} {activePromotion.code} بنسبة {activePromotion.percent}%</span><strong>- {formatNewSyp(toNewSyp(activePromotion.discountAmount))}</strong></div> : null}</div>{remainingDeliveryAmountNewSyp(discountedCartTotal) > 0 ? <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-center text-sm font-bold leading-6 text-amber-900">الحد الأدنى بعد الخصم هو {formatNewSyp(minimumDeliveryOrderSyp)}. أضف منتجات بقيمة {formatNewSyp(remainingDeliveryAmountNewSyp(discountedCartTotal))} أو أكثر.</p> : null}<button disabled={remainingDeliveryAmountNewSyp(discountedCartTotal) > 0} onClick={continueDeliveryCheckout} className="primary-full-button">التالي إلى بيانات التوصيل <ChevronLeft className="h-5 w-5" /></button></section> : null}
          {checkoutMode === "delivery" && checkoutStep === 2 ? <section className="app-shell space-y-5 pb-10"><div className="delivery-estimate-card"><span className="delivery-estimate-icon"><Bike className="h-5 w-5" /></span><div><strong>وقت وصول تقديري</strong><p>يصل طلبك عادة خلال <b>{deliveryEta}</b> بعد تأكيد المتجر والموقع.</p></div><span className="delivery-estimate-status">توصيل لحظة</span></div><div className="checkout-card space-y-4"><div className="checkout-card-title"><UserRound className="h-5 w-5 text-[#f26d31]" /><span>بيانات التواصل</span></div><div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><div><Label htmlFor="customerName">اسم المستلم</Label><Input id="customerName" value={checkoutName} onChange={event => setCheckoutName(event.target.value)} placeholder="اكتب الاسم" /></div><div><Label htmlFor="customerPhone">رقم الهاتف السوري</Label><div className="phone-entry" dir="ltr"><span>+963</span><Input id="customerPhone" inputMode="numeric" value={checkoutPhone} onChange={event => setCheckoutPhone(event.target.value.replace(/\D/g, "").slice(0, 9))} placeholder="9XXXXXXXX" /></div><small className="phone-help">اكتب الرقم ابتداءً من 9، من دون الصفر الأول.</small></div></div><div className="delivery-location-card"><div className="delivery-field-heading"><span><LocateFixed className="h-4 w-4" /> العنوان وموقع التوصيل</span><small>الموقع مطلوب · العنوان اختياري</small></div><Label htmlFor="deliveryAddress">العنوان التفصيلي <span className="text-slate-400">(اختياري)</span></Label><Textarea id="deliveryAddress" value={deliveryAddress} onChange={event => setDeliveryAddress(event.target.value)} placeholder="مثال: منبج، حي السرب، قرب دوار الساعة، بناء 12" /><div className="location-actions"><button type="button" onClick={locateCustomer} disabled={locating}><LocateFixed className="h-4 w-4" />{locating ? "جارٍ طلب إذن الموقع..." : locationVerified ? "تم تأكيد موقعك" : "السماح بالوصول للموقع"}</button></div>{locationVerified ? <p className="verified-location">تم تأكيد موقعك عبر GPS، ويمكنك الآن متابعة الطلب.</p> : <p className="location-required-note">ستظهر نافذة إذن من هاتفك عند الضغط على الزر. وافق عليها لتأكيد موقع التوصيل.</p>}</div></div><button onClick={continueDeliveryCheckout} className="primary-full-button">التالي إلى مراجعة الطلب <ChevronLeft className="h-5 w-5" /></button></section> : null}
          {checkoutMode === "delivery" && checkoutStep === 3 ? <section className="app-shell space-y-5 pb-10"><div className="delivery-estimate-card"><span className="delivery-estimate-icon"><Bike className="h-5 w-5" /></span><div><strong>وقت وصول تقديري</strong><p>سيصل طلبك خلال <b>{deliveryEta}</b> إلى {deliveryAddress.trim() || "الموقع المحدد عبر GPS"}.</p></div><span className="delivery-estimate-status">جاهز للإرسال</span></div><div className="checkout-card checkout-cart-card"><div className="checkout-card-title"><ClipboardList className="h-5 w-5 text-[#f26d31]" /><span>مراجعة طلبك</span></div><CartPreview cart={cart} removeLine={removeLine} updateQuantity={updateLineQuantity} total={total} hasPharmacy={hasPharmacy} deliveryFeeNewSyp={cartDeliveryFeeNewSyp} deliveryPercent={deliveryPercent} deliveryArea="منبج" grandTotalNewSyp={cartGrandTotalNewSyp} onContinueShopping={() => setScreen("delivery")} /><div className="order-review-address"><span><LocateFixed className="h-4 w-4" /> التوصيل إلى</span><strong>{deliveryAddress.trim() || "الموقع المحدد عبر GPS"}</strong><small>{checkoutName} · +963{checkoutPhone}</small></div></div><div className="checkout-card"><div className="checkout-card-title"><CreditCard className="h-5 w-5 text-[#f26d31]" /><span>طريقة الدفع</span></div><div className="payment-grid"><button onClick={() => setPayment("sham_cash")} className={payment === "sham_cash" ? "payment-active" : ""}><span className="payment-icon payment-icon-lahza">ش</span><span>شام كاش</span></button><button onClick={() => setPayment("cash")} className={payment === "cash" ? "payment-active" : ""}><HandCoins className="h-5 w-5" /><span>نقداً عند الاستلام</span></button></div></div><div className="checkout-card"><div className="checkout-card-title"><PackagePlus className="h-5 w-5 text-[#f26d31]" /><span>عند عدم توفر أحد المنتجات</span></div><div className="unavailable-choice-grid"><button type="button" onClick={() => setUnavailablePreference("cancel")} className={unavailablePreference === "cancel" ? "unavailable-choice-active" : ""}><span>إلغاء الطلب</span><small>عند عدم توفر أي صنف</small></button><button type="button" onClick={() => setUnavailablePreference("replace")} className={unavailablePreference === "replace" ? "unavailable-choice-active" : ""}><span>بديل من متجر آخر</span><small>بعد أخذ موافقتي</small></button><button type="button" onClick={() => setUnavailablePreference("call")} className={unavailablePreference === "call" ? "unavailable-choice-active" : ""}><span>تواصل معي</span><small>قبل أي تغيير</small></button></div><div className="mt-4"><Label htmlFor="notes">ملاحظات إضافية <span className="text-slate-400">(اختياري)</span></Label><Textarea id="notes" value={notes} onChange={event => setNotes(event.target.value)} placeholder="أي تفاصيل مفيدة للطلب أو للمندوب" /></div></div><SupportHelpCard onOpen={() => setSupportOpen(true)} contactCount={supportContacts.length} /><button disabled={createOrder.isPending || remainingDeliveryAmountNewSyp(discountedCartTotal) > 0} onClick={() => void submitCheckout()} className="primary-full-button">{createOrder.isPending ? "جارٍ إرسال الطلب..." : `اطلب الآن · ${formatNewSyp(cartGrandTotalNewSyp)}`}<ChevronLeft className="h-5 w-5" /></button></section> : null}
          {checkoutMode === "taxi" ? <section className="app-shell space-y-5 pb-10"><div className="checkout-card"><div className="checkout-card-title"><ClipboardList className="h-5 w-5 text-[#f26d31]" /><span>تفاصيل الرحلة</span></div><div className="taxi-summary"><CarFront className="h-9 w-9 text-[#63301b]" /><div><strong>{taxiType === "van" ? "سيارة فان" : "تاكسي عادي"}</strong><span>{pickup || "موقع الانطلاق"} <ChevronLeft className="inline h-3 w-3" /> {destination || "الوجهة"}</span></div></div></div><div className="checkout-card space-y-4"><div className="checkout-card-title"><UserRound className="h-5 w-5 text-[#f26d31]" /><span>بيانات التواصل</span></div><div><Label htmlFor="customerName">الاسم</Label><Input id="customerName" value={checkoutName} onChange={event => setCheckoutName(event.target.value)} placeholder="اكتب الاسم" /></div><div><Label htmlFor="customerPhone">رقم الهاتف السوري</Label><div className="phone-entry" dir="ltr"><span>+963</span><Input id="customerPhone" inputMode="numeric" value={checkoutPhone} onChange={event => setCheckoutPhone(event.target.value.replace(/\D/g, "").slice(0, 9))} placeholder="9XXXXXXXX" /></div></div><div><Label htmlFor="customerLocation">موقعك</Label><Input id="customerLocation" value={customerLocation} readOnly placeholder="استخدم زر تحديد موقعي" /><div className="location-actions"><button type="button" onClick={locateCustomer} disabled={locating}><LocateFixed className="h-4 w-4" />{locating ? "جارٍ التحديد..." : "تحديد موقعي"}</button></div></div></div><div className="checkout-card"><div className="checkout-card-title"><CreditCard className="h-5 w-5 text-[#f26d31]" /><span>طريقة الدفع</span></div><div className="payment-grid"><button onClick={() => setPayment("sham_cash")} className={payment === "sham_cash" ? "payment-active" : ""}><span className="payment-icon payment-icon-lahza">ش</span><span>شام كاش</span></button><button onClick={() => setPayment("cash")} className={payment === "cash" ? "payment-active" : ""}><HandCoins className="h-5 w-5" /><span>نقداً عند الاستلام</span></button></div></div><SupportHelpCard onOpen={() => setSupportOpen(true)} contactCount={supportContacts.length} /><button disabled={createOrder.isPending} onClick={() => void submitCheckout()} className="primary-full-button">{createOrder.isPending ? "جارٍ إرسال الطلب..." : "تأكيد وإرسال الطلب"}<ChevronLeft className="h-5 w-5" /></button></section> : null}
        </>
      ) : null}

      </div>
      {screen !== "checkout" ? <nav className="home-bottom-nav" aria-label="التنقل الرئيسي"><button type="button" className={screen === "home" ? "home-bottom-nav-active" : ""} onClick={goHome}><LayoutDashboard className="h-5 w-5" /><span>الرئيسية</span></button><button type="button" className={screen === "delivery" || screen === "stores" || screen === "store" ? "home-bottom-nav-active" : ""} onClick={() => setScreen("delivery")}><Store className="h-5 w-5" /><span>المتاجر</span></button><button type="button" className={screen === "offers" || screen === "storeOffers" ? "home-bottom-nav-active" : ""} onClick={() => setScreen("offers")}><BadgePercent className="h-5 w-5" /><span>العروض</span></button><button type="button" className={screen === "taxi" ? "home-bottom-nav-active" : ""} onClick={() => setScreen("taxi")} aria-label="طلب سيارة أجرة"><CarFront className="h-5 w-5" /><span className="home-bottom-nav-taxi-label">طلب سيارة أجرة</span></button><button type="button" className={screen === "account" ? "home-bottom-nav-active" : ""} onClick={openAccount} aria-label="فتح حسابي"><UserRound className="h-5 w-5" /><span>حسابي</span></button></nav> : null}
      <footer className="app-shell pb-8 text-center text-xs font-medium tracking-wide text-slate-400" dir="ltr">Designed by Ahmad barho</footer>
      {adminAccessDialog}
    </main>
  );
}

function CustomerAccountScreen({ session, onBack, onLogout, onPhoneSubmit, savingPhone, onOpenOrder }: { session: CustomerAuthSession; onBack: () => void; onLogout: () => void; onPhoneSubmit: (phone: string) => void; savingPhone: boolean; onOpenOrder?: () => void }) {
  const isGuest = session.mode === "guest";
  const phone = session.phone ?? "";
  const [phoneEditOpen, setPhoneEditOpen] = useState(false);
  const [phoneChangeStep, setPhoneChangeStep] = useState<"phone" | "otp">("phone");
  const [phoneChangeOtp, setPhoneChangeOtp] = useState("");
  const [pendingPhone, setPendingPhone] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const pointsQuery = trpc.lahza.customers.points.balance.useQuery({ phone: phone || "+963900000000" }, { enabled: !isStaticDemo && !isGuest && /^\+9639\d{8}$/.test(phone), retry: false });
  const createReferralCode = trpc.lahza.customers.referral.getOrCreate.useMutation({ onSuccess: result => { setReferralCode(result.code); void navigator.clipboard?.writeText(result.code); toast.success("تم إنشاء رمز الإحالة ونسخه"); }, onError: error => toast.error(error.message) });
  useEffect(() => {
    setNewPhone(phone.replace(/^\+963/, ""));
  }, [phone]);
  const points = isGuest ? 0 : (pointsQuery.data?.balance ?? 0);
  const lifetimeEarned = isGuest ? 0 : (pointsQuery.data?.lifetimeEarned ?? 0);
  const rewardTarget = 10;
  const remainingForReward = Math.max(0, rewardTarget - points);
  const rewardPercent = pointsQuery.data?.rewardPercent ?? 0;
  const handleCreateReferral = () => {
    if (isGuest) return;
    if (isStaticDemo) {
      const code = `LHZ-DEMO-${phone.slice(-4) || "0997"}`;
      setReferralCode(code);
      void navigator.clipboard?.writeText(code);
      toast.success("تم إنشاء رمز الإحالة التجريبي ونسخه");
      return;
    }
    if (/^\+9639\d{8}$/.test(phone)) createReferralCode.mutate({ phone });
  };
  const submitPhone = () => {
    const normalized = newPhone.replace(/\D/g, "").replace(/^963/, "").replace(/^0/, "").slice(0, 9);
    if (!/^9\d{8}$/.test(normalized)) {
      toast.error("أدخل رقم هاتف سوري يبدأ بالرقم 9");
      return;
    }
    setPendingPhone(`+963${normalized}`);
    setPhoneChangeOtp("");
    setPhoneChangeStep("otp");
  };
  const verifyPhoneChange = () => {
    if (phoneChangeOtp !== DEMO_OTP_CODE) {
      toast.error("رمز التحقق غير صحيح. استخدم الرمز التجريبي 123456");
      return;
    }
    onPhoneSubmit(pendingPhone);
    setPhoneEditOpen(false);
    setPhoneChangeStep("phone");
    setPhoneChangeOtp("");
  };
  if (isGuest) return <section className="app-shell account-screen pb-12"><PageHeading eyebrow="حسابي" title="أنشئ حسابك في لحظة" detail="سجّل برقم هاتفك لتحتفظ ببياناتك وتجمع النقاط وتستخدم الإحالات." onBack={onBack} /><div className="account-guest-card"><div className="account-guest-icon"><UserRound className="h-7 w-7" /></div><h2>أنت تتصفح كزائر</h2><p>يمكنك متابعة التصفح، لكن النقاط والإحالات والطلبات تحتاج إلى حساب عميل مسجل.</p><button type="button" className="primary-full-button" onClick={onLogout}>تسجيل الدخول أو إنشاء حساب <ChevronLeft className="h-5 w-5" /></button></div></section>;
  return <section className="app-shell account-screen pb-12"><PageHeading eyebrow="حسابي" title={`أهلاً ${session.name || "بك في لحظة"}`} detail="تابع بياناتك ونقاطك ومكافآتك من مكان واحد." onBack={onBack} /><div className="account-hero"><div className="account-avatar"><UserRound className="h-7 w-7" /></div><div className="min-w-0 flex-1"><strong>{session.name || "عميل لحظة"}</strong><span dir="ltr">{phone}</span></div><span className="account-status">حساب عميل</span></div><div className="account-stat-grid"><article><Sparkles className="h-5 w-5" /><strong>{points}</strong><span>نقاطك الحالية</span></article><article><CheckCircle2 className="h-5 w-5" /><strong>{lifetimeEarned}</strong><span>إجمالي النقاط المكتسبة</span></article><article><ShoppingBasket className="h-5 w-5" /><strong>{onOpenOrder ? "متاح" : "—"}</strong><span>آخر طلب</span></article></div><section className="account-card"><div className="account-card-heading"><div><p>مكافأة الحسم</p><h2>{remainingForReward ? `تبقى ${remainingForReward} نقاط` : "المكافأة متاحة لك"}</h2></div><BadgePercent className="h-6 w-6" /></div><div className="account-progress"><span style={{ width: `${Math.min(100, points / rewardTarget * 100)}%` }} /></div><div className="account-progress-labels"><span>{points} نقاط</span><span>{rewardTarget} نقاط للحصول على رمز الحسم</span></div>{rewardPercent > 0 ? <p className="account-card-note">يمكنك استخدام المكافأة للحصول على خصم {rewardPercent}% عند استيفاء الشروط.</p> : <p className="account-card-note">اجمع نقاطًا من الطلبات المكتملة والإحالات الناجحة لتحصل على مكافأة الحسم.</p>}</section><section className="account-card"><div className="account-card-heading"><div><p>رمز الإحالة</p><h2>{referralCode || "شارك لحظة مع أصدقائك"}</h2></div><Share2 className="h-6 w-6" /></div><p className="account-card-note">أنشئ رمزًا خاصًا بك وشاركه، وستحصل على نقاط عند اكتمال طلب الإحالة.</p><div className="account-card-actions"><button type="button" onClick={handleCreateReferral} disabled={createReferralCode.isPending} className="account-action-primary"><Share2 className="h-4 w-4" />{createReferralCode.isPending ? "جارٍ الإنشاء..." : referralCode ? "إنشاء ونسخ الرمز" : "إنشاء رمز الإحالة"}</button>{referralCode ? <button type="button" onClick={() => { void navigator.clipboard?.writeText(referralCode); toast.success("تم نسخ رمز الإحالة"); }} className="account-action-secondary">نسخ الرمز</button> : null}</div></section><section className="account-card"><div className="account-card-heading"><div><p>بيانات الحساب</p><h2>رقم الهاتف</h2></div><Phone className="h-6 w-6" /></div><div className="account-phone-row"><span dir="ltr">{phone}</span><button type="button" onClick={() => setPhoneEditOpen(open => !open)} className="account-edit-button"><Pencil className="h-4 w-4" /> تغيير الرقم</button></div>{phoneEditOpen ? <div className="account-phone-edit">{phoneChangeStep === "phone" ? <><Input dir="ltr" inputMode="numeric" value={newPhone} onChange={event => setNewPhone(event.target.value.replace(/\D/g, "").replace(/^963/, "").replace(/^0/, "").slice(0, 9))} placeholder="9XXXXXXXX" /><button type="button" disabled={savingPhone} onClick={submitPhone} className="account-action-primary">إرسال رمز التحقق</button></> : <><div className="account-phone-otp-copy"><span>أدخل رمز OTP لتأكيد الرقم الجديد</span><small dir="ltr">{pendingPhone}</small><Input dir="ltr" inputMode="numeric" maxLength={6} autoFocus value={phoneChangeOtp} onChange={event => setPhoneChangeOtp(event.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="123456" /></div><button type="button" disabled={savingPhone || phoneChangeOtp.length !== 6} onClick={verifyPhoneChange} className="account-action-primary">{savingPhone ? "جارٍ الحفظ..." : "تحقق وحفظ"}</button><button type="button" onClick={() => setPhoneChangeStep("phone")} className="account-action-secondary">تعديل الرقم</button></>}</div> : null}</section>{onOpenOrder ? <button type="button" onClick={onOpenOrder} className="account-order-button"><ClipboardList className="h-5 w-5" /> عرض آخر طلب وتتبع حالته <ChevronLeft className="h-5 w-5" /></button> : null}<button type="button" onClick={onLogout} className="account-logout-button"><LogOut className="h-5 w-5" /> تسجيل الخروج</button></section>;
}

function StoresScreen({ category, categoryTitle, stores, loading, restaurantFilter, onRestaurantFilterChange, onBack, onChoose }: { category: LahzaCategory; categoryTitle?: string; stores: StoreOption[]; loading: boolean; restaurantFilter: RestaurantType; onRestaurantFilterChange: (filter: RestaurantType) => void; onBack: () => void; onChoose: (store: StoreOption) => void }) {
  const meta = categoryMeta[category];
  const title = categoryTitle ?? meta.title;
  const visual = categoryImageByKey[category];
  return <><PageHeading eyebrow="متاجر القسم" title={`متاجر ${title}`} detail="اختر متجراً لفتح صفحته ومنتجاته في المكان نفسه." onBack={onBack} /><section className="app-shell pb-12">{category === "restaurants" ? <div className="mb-5 flex flex-wrap gap-2" aria-label="فلترة أنواع المطاعم">{(Object.keys(restaurantTypeMeta) as RestaurantType[]).map(type => <button key={type} type="button" onClick={() => onRestaurantFilterChange(type)} className={`rounded-full px-4 py-2 text-sm font-bold transition ${restaurantFilter === type ? "bg-[#71351d] text-white shadow-sm" : "border border-rose-100 bg-white text-slate-700 hover:border-rose-300 hover:bg-rose-50"}`}>{restaurantTypeMeta[type]}</button>)}</div> : null}{loading ? <div className="rounded-3xl bg-slate-50 p-6 text-center text-sm text-slate-500">جارٍ تحميل المتاجر...</div> : stores.length ? <div className="store-card-grid">{stores.map(store => <button key={store.id} onClick={() => onChoose(store)} className="store-identity-card"><span className="store-identity-image">{store.imageUrl || visual ? <img src={store.imageUrl || visual} alt="" loading="lazy" /> : <Store className="h-7 w-7" />}</span><span className="store-identity-avatar"><Store className="h-5 w-5" /></span><span className="store-identity-rating" aria-label={`تقييم ${store.ratingStars ?? 3} من 5`}>{"★".repeat(store.ratingStars ?? 3)}{"☆".repeat(5 - (store.ratingStars ?? 3))}</span><span className="store-identity-copy"><strong>{store.name}</strong><small>{title} · منتجات وعروض مختارة</small></span><ChevronLeft className="store-identity-arrow h-5 w-5" /></button>)}</div> : <EmptyStoreList categoryTitle={title} />}</section></>;
}

function StoreShareCard({ store }: { store: StoreOption }) {
  const [qrOpen, setQrOpen] = useState(false);
  const storeUrl = buildStoreShareUrl(window.location.origin, store.id);
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
  return <><section className="app-shell pb-2"><div className="rounded-3xl border border-rose-100 bg-gradient-to-l from-rose-50 to-white p-4 shadow-sm"><div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#63301b] text-white"><Share2 className="h-5 w-5" /></span><div className="min-w-0 flex-1"><strong className="block text-sm text-[#4a2618]">رابط الدخول إلى المتجر</strong><small className="mt-1 block text-xs leading-5 text-slate-600">شارك المتجر مع من تحب أو اعرض رمز QR لفتحه مباشرة.</small></div></div><div className="mt-4 grid grid-cols-2 gap-2"><Button type="button" onClick={() => void shareStore()} className="rounded-2xl bg-[#63301b] hover:bg-[#4a2618]"><Share2 className="h-4 w-4" /> مشاركة الرابط</Button><Button type="button" variant="outline" onClick={() => setQrOpen(true)} className="rounded-2xl border-rose-200 bg-white text-[#4a2618] hover:bg-rose-50"><QrCode className="h-4 w-4" /> رمز QR</Button></div></div></section><Dialog open={qrOpen} onOpenChange={setQrOpen}><DialogContent dir="rtl" className="w-[calc(100%-2rem)] max-w-sm rounded-3xl bg-white text-center"><DialogHeader><DialogTitle className="text-center text-xl text-[#4a2618]">رمز متجر {store.name}</DialogTitle><DialogDescription className="text-center">امسح الرمز لفتح صفحة المتجر والمنتجات مباشرة.</DialogDescription></DialogHeader><div className="mx-auto mt-3 rounded-3xl border border-slate-100 bg-white p-4 shadow-sm"><QRCodeSVG value={storeUrl} size={220} level="M" includeMargin /></div><p dir="ltr" className="mt-3 break-all text-center text-[0.68rem] text-slate-400">{storeUrl}</p><Button type="button" onClick={() => void shareStore()} className="mt-3 w-full rounded-2xl bg-red-600 hover:bg-red-700"><Share2 className="h-4 w-4" /> مشاركة رابط المتجر</Button></DialogContent></Dialog></>;
}

function StoreProductsScreen({ store, products, loading, onBack, onChooseProduct, onOpenOffers }: { store: StoreOption; products: StoreProduct[]; loading: boolean; onBack: () => void; onChooseProduct: (product: StoreProduct) => void; onOpenOffers: () => void }) {
  const [need, setNeed] = useState("");
  const visual = store.imageUrl || categoryImageByKey[store.category];
  const categoryTitle = categoryMeta[store.category].title;
  const storeClosed = store.storeOpen === false;
  const availableProducts = products.filter(product => product.available);
  const normalizedNeed = need.trim().toLocaleLowerCase("ar");
  const visibleProducts = normalizedNeed ? availableProducts.filter(product => product.name.toLocaleLowerCase("ar").includes(normalizedNeed)) : availableProducts;
  return <div className="store-reveal-shell"><section className="store-hero"><div className="store-hero-visual">{visual ? <img src={visual} alt={`صورة متجر ${store.name}`} /> : null}</div><div className="store-hero-shade" /><button type="button" onClick={onBack} className="store-hero-back" aria-label="العودة إلى المتاجر"><ArrowLeft className="h-5 w-5" /></button><button type="button" onClick={onOpenOffers} className="store-hero-offer" aria-label="عروض المتجر"><BadgePercent className="h-5 w-5" /></button><div className="store-hero-copy"><span className="store-hero-avatar">{store.imageUrl ? <img src={store.imageUrl} alt="" /> : <Store className="h-7 w-7" />}</span><p>{categoryTitle}</p><h1>{store.name}</h1><span>منتجات مختارة بعناية ضمن هوية لحظة</span></div></section><section className="app-shell pb-12">{storeClosed ? <div className="store-closed-banner" role="status"><strong>مغلق الآن</strong><span>يمكنك تصفح المنتجات، لكن لا يمكن إضافة أي منتج إلى السلة حتى يفتح المتجر.</span></div> : null}<div className="store-status-row"><span><Bike className="h-4 w-4" /> توصيل لحظة</span><span><Sparkles className="h-4 w-4" /> متجر موثوق</span><span><BadgePercent className="h-4 w-4" /> عروض خاصة</span></div><div className="store-products-heading"><div><p className="section-eyebrow">تسوّق من المتجر</p><h2 className="section-title">منتجات {store.name}</h2></div><button type="button" onClick={onOpenOffers}>العروض <ChevronLeft className="h-4 w-4" /></button></div><label className="store-product-search"><Search className="h-5 w-5" /><input value={need} onChange={event => setNeed(event.target.value)} placeholder="ماذا تحتاج؟" aria-label="ابحث داخل منتجات المتجر" />{need ? <button type="button" onClick={() => setNeed("")} aria-label="مسح البحث"><X className="h-4 w-4" /></button> : null}</label>{loading ? <div className="rounded-3xl bg-slate-50 p-6 text-center text-sm text-slate-500">جارٍ تحميل المنتجات...</div> : visibleProducts.length ? <div className="product-image-grid">{visibleProducts.map(product => <button key={product.id} disabled={storeClosed} aria-disabled={storeClosed} onClick={() => onChooseProduct(product)} className={`product-image-card ${storeClosed ? "cursor-not-allowed opacity-70" : ""}`}><span className="product-image-wrap">{product.imageUrl ? <img src={product.imageUrl} alt={product.name} loading="lazy" onError={event => { event.currentTarget.style.display = "none"; }} /> : <PackagePlus className="h-8 w-8 text-[#71351d]" />}</span><strong>{product.name}</strong><small>{product.unit}</small><span className="product-card-price">{product.unitPrice ? `سعر تقديري · ${formatSyp(product.unitPrice)}` : "السعر عند التأكيد"}</span><span className="product-add-circle">{storeClosed ? "مغلق" : <Plus className="h-5 w-5" />}</span></button>)}</div> : <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center"><PackagePlus className="mx-auto h-7 w-7 text-slate-400" /><strong className="mt-3 block text-[#4a2618]">{need ? `لا توجد نتيجة لـ «${need}»` : "لا توجد منتجات متاحة حالياً"}</strong><p className="mt-2 text-xs text-slate-500">جرّب كتابة اسم منتج آخر أو مسح البحث.</p></div>}</section></div>;
}
function ProductQuantityScreen({ store, product, storeOpen, onBack, onAdd }: { store: StoreOption; product: StoreProduct; storeOpen?: boolean | null; onBack: () => void; onAdd: (quantity: number) => void }) {
  const [quantity, setQuantity] = useState("1");
  const parsed = Number(quantity);
  const storeClosed = storeOpen === false;
  const add = () => { if (storeClosed) return toast.error("المتجر مغلق حالياً"); if (!Number.isFinite(parsed) || parsed <= 0) return toast.error("أدخل كمية صالحة"); onAdd(parsed); };
  return <><PageHeading eyebrow={store.name} title="حدد الكمية" detail="اختر كمية المنتج ثم أضفه إلى السلة." onBack={onBack} /><section className="app-shell pb-12"><div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">{storeClosed ? <div className="store-closed-banner" role="status"><strong>مغلق الآن</strong><span>التصفح متاح، والإضافة إلى السلة متوقفة حتى يفتح المتجر.</span></div> : null}<p className="text-xs font-bold text-slate-400">الصنف المختار</p><h2 className="mt-1 text-xl font-black text-[#4a2618]">{product.name}</h2><p className="mt-2 text-sm font-bold text-red-600">{product.unitPrice ? `سعر تقديري: ${formatSyp(product.unitPrice)}` : "يحدد السعر عند التأكيد"}</p><div className="mt-6"><Label>الكمية {product.unit !== "وحدة" ? `(${product.unit})` : ""}</Label><div className="quantity-control mt-2"><button disabled={storeClosed} onClick={() => setQuantity(value => String(Math.max(product.unit === "ليتر" ? 0.1 : 1, Number(value || 1) - (product.unit === "جرام" ? 50 : 1))))}><Minus className="h-4 w-4" /></button><Input disabled={storeClosed} type="number" min={product.unit === "ليتر" ? "0.1" : "1"} step={product.unit === "جرام" ? "50" : "1"} value={quantity} onChange={event => setQuantity(event.target.value)} /><button disabled={storeClosed} onClick={() => setQuantity(value => String(Number(value || 0) + (product.unit === "جرام" ? 50 : 1)))}><Plus className="h-4 w-4" /></button></div></div><Button disabled={storeClosed} onClick={add} className="mt-6 w-full rounded-2xl bg-red-600 py-6 hover:bg-red-700"><ShoppingBasket className="h-5 w-5" /> {storeClosed ? "المتجر مغلق" : "أضف إلى السلة"}</Button></div></section></>;
}
function StoreOffersScreen({ store, offers, loading, onBack, onChoose }: { store: StoreOption; offers: CustomerOffer[]; loading: boolean; onBack: () => void; onChoose: (offer: CustomerOffer) => void }) {
  const storeClosed = store.storeOpen === false;
  return <><PageHeading eyebrow="عروض المتجر" title={`عروض ${store.name}`} detail="تصفح عروض المتجر، وتصبح الإضافة متاحة عند فتحه." onBack={onBack} /><section className="app-shell pb-12">{storeClosed ? <div className="store-closed-banner" role="status"><strong>مغلق الآن</strong><span>يمكنك مشاهدة العروض، لكن لا يمكن إضافتها إلى السلة حالياً.</span></div> : null}{loading ? <div className="rounded-3xl bg-slate-50 p-6 text-center text-sm text-slate-500">جارٍ تحميل العروض...</div> : offers.length ? <div className="grid gap-4 sm:grid-cols-2">{offers.map(offer => <button key={offer.id} disabled={storeClosed} aria-disabled={storeClosed} onClick={() => onChoose(offer)} className={`overflow-hidden rounded-3xl border border-amber-200 bg-white text-right shadow-sm transition hover:-translate-y-0.5 active:scale-[.98] ${storeClosed ? "cursor-not-allowed opacity-70" : ""}`}><CustomerOfferArtwork offer={offer} compact /><span className="block p-4"><span className="inline-flex rounded-full bg-red-100 px-3 py-1 text-xs font-black text-red-800">عرض مميز</span><small className={storeClosed ? "mt-3 block font-bold text-amber-700" : "mt-3 block text-red-600"}>{storeClosed ? "المتجر مغلق" : "اضغط لاختيار الكمية"}</small></span></button>)}</div> : <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center"><BadgePercent className="mx-auto h-7 w-7 text-red-600" /><h2 className="mt-3 text-lg font-black text-[#4a2618]">لا توجد عروض نشطة لهذا المتجر</h2></div>}</section></>;
}
function OfferQuantityScreen({ offer, storeOpen, onBack, onAdd }: { offer: CustomerOffer; storeOpen?: boolean | null; onBack: () => void; onAdd: (quantity: number) => void }) {
  const [quantity, setQuantity] = useState("1");
  const parsed = Number(quantity);
  const storeClosed = storeOpen === false;
  const add = () => { if (storeClosed) return toast.error("المتجر مغلق حالياً"); if (!Number.isFinite(parsed) || parsed <= 0) return toast.error("أدخل كمية صالحة"); onAdd(parsed); };
  const productName = offer.productName ?? offer.text;
  return <><PageHeading eyebrow={offer.storeName ?? offer.partnerName} title="حدد كمية العرض" detail="وصف العرض ظاهر أدناه، بينما أُختير صنفه من متجر الشريك مسبقاً." onBack={onBack} /><section className="app-shell pb-12"><div className="rounded-3xl border border-amber-200 bg-gradient-to-l from-amber-50 to-white p-5 shadow-sm">{storeClosed ? <div className="store-closed-banner" role="status"><strong>مغلق الآن</strong><span>يمكنك مشاهدة تفاصيل العرض، لكن لا يمكن إضافته إلى السلة حتى يفتح المتجر.</span></div> : null}<CustomerOfferArtwork offer={offer} /><Label className="mt-5 block">وصف العرض</Label><div className="mt-2 rounded-2xl border border-amber-200 bg-white px-4 py-3 font-bold text-slate-700">{offer.text}</div><Label className="mt-5 block">صنف العرض</Label><div className="mt-2 rounded-2xl border border-amber-200 bg-white px-4 py-3 text-lg font-black text-[#4a2618]">{productName}</div><p className="mt-2 text-xs text-slate-500">تم تحديد الصنف من منتجات المتجر؛ عدّل الكمية فقط.</p>{offer.productPrice ? <p className="mt-3 text-sm font-bold text-red-600">{formatSyp(offer.productPrice)}</p> : null}<div className="mt-6"><Label>الكمية {offer.productUnit && offer.productUnit !== "وحدة" ? `(${offer.productUnit})` : ""}</Label><div className="quantity-control mt-2"><button disabled={storeClosed} onClick={() => setQuantity(value => String(Math.max(1, Number(value || 1) - 1)))}><Minus className="h-4 w-4" /></button><Input disabled={storeClosed} type="number" min="1" step="1" value={quantity} onChange={event => setQuantity(event.target.value)} /><button disabled={storeClosed} onClick={() => setQuantity(value => String(Number(value || 0) + 1))}><Plus className="h-4 w-4" /></button></div></div><Button disabled={storeClosed} onClick={add} className="mt-6 w-full rounded-2xl bg-red-600 py-6 hover:bg-red-700"><ShoppingBasket className="h-5 w-5" /> {storeClosed ? "المتجر مغلق" : "أضف الصنف إلى السلة"}</Button></div></section></>;
}
function EmptyStoreList({ categoryTitle }: { categoryTitle: string }) { return <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center"><Store className="mx-auto h-7 w-7 text-slate-400" /><strong className="mt-3 block text-[#4a2618]">لا توجد متاجر مضافة بعد</strong><p className="mt-2 text-sm leading-6 text-slate-500">سيظهر أي متجر يضيفه المالك إلى قسم {categoryTitle} هنا.</p></div>; }

function CartPreview({ cart, removeLine, updateQuantity, total, hasPharmacy, deliveryFeeNewSyp, deliveryPercent, deliveryArea, grandTotalNewSyp, onContinueShopping }: { cart: CartLine[]; removeLine: (id: string) => void; updateQuantity: (id: string, quantity: number) => void; total: number; hasPharmacy: boolean; deliveryFeeNewSyp: number; deliveryPercent: number; deliveryArea: "منبج" | "جرابلس"; grandTotalNewSyp: number; onContinueShopping: () => void }) {
  return <div className="cart-preview"><div className="cart-preview-intro"><span className="cart-preview-icon"><ShoppingBasket className="h-5 w-5" /></span><div><strong>سلتك في لحظة</strong><p>{cart.length ? `${cart.length} ${cart.length === 1 ? "صنف" : "أصناف"} جاهزة للطلب` : "سلتك فارغة حالياً"}</p></div><button type="button" onClick={onContinueShopping}>{cart.length ? "إضافة منتجات" : "ابدأ التسوق"}</button></div>{cart.length ? <><div className="cart-lines">{cart.map(item => { const step = item.unit === "جرام" ? 50 : item.unit === "ليتر" ? .1 : 1; return <div key={item.id} className="cart-line"><span className="cart-line-category" aria-hidden="true"><LahzaCategoryIcon category={item.category} className="h-4 w-4" /></span><div className="cart-line-copy"><strong>{item.itemName}</strong><span>{item.unit === "جرام" ? `${item.quantity} غرام` : `${item.quantity} ${item.unit}`}</span><div className="cart-inline-quantity"><button type="button" onClick={() => updateQuantity(item.id, Number((item.quantity - step).toFixed(2)))} aria-label={`إنقاص كمية ${item.itemName}`}><Minus className="h-3.5 w-3.5" /></button><b>{item.quantity}</b><button type="button" onClick={() => updateQuantity(item.id, Number((item.quantity + step).toFixed(2)))} aria-label={`زيادة كمية ${item.itemName}`}><Plus className="h-3.5 w-3.5" /></button></div></div><div className="cart-line-actions">{item.priceKnown ? <strong>{formatSyp(lineTotal(item))}</strong> : <small>السعر عند التأكيد</small>}<button type="button" onClick={() => removeLine(item.id)} aria-label={`حذف ${item.itemName}`}><Trash2 className="h-4 w-4" /></button></div></div>; })}</div>{hasPharmacy ? <p className="pharmacy-note"><Pill className="h-4 w-4" />تتضمن السلة منتجات صحية؛ يؤكدها المتجر قبل التجهيز.</p> : null}<div className="cart-totals"><div className="total-row"><span>إجمالي المنتجات</span><strong>{formatSyp(total)}</strong></div><div className="total-row"><span>رسوم توصيل {deliveryArea} ({deliveryPercent}%)</span><strong>{formatNewSyp(deliveryFeeNewSyp)}</strong></div><div className="total-row total-row-grand"><span>الإجمالي النهائي</span><strong>{formatNewSyp(grandTotalNewSyp)}</strong></div></div></> : <div className="cart-empty-state"><ShoppingBasket className="h-8 w-8" /><strong>لا توجد منتجات في السلة</strong><span>اختر ما تحتاجه من أي متجر، وستظهر تفاصيل طلبك هنا مباشرة.</span></div>}</div>;
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

function CustomerOfferArtwork({ offer, compact = false }: { offer: CustomerOffer; compact?: boolean }) {
  const productImage = offer.imageUrl || offer.productImageUrl || "";
  const discountedPrice = offer.offerPrice || offer.productPrice || 0;
  const originalPrice = offer.originalProductPrice || 0;
  return <div className={`lahza-offer-artwork ${compact ? "lahza-offer-artwork-compact" : ""}`}><div className="lahza-offer-artwork-glow" /><span className="lahza-offer-artwork-brand">لحظة</span><span className="lahza-offer-artwork-badge">خصم {offer.discountPercent || "—"}%</span><div className="lahza-offer-artwork-copy"><small>{offer.storeName ?? offer.partnerName}</small><strong>{offer.text}</strong><span>{offer.productName ?? "عرض مميز"}</span><div className="lahza-offer-artwork-prices">{originalPrice > 0 ? <span className="lahza-offer-price-old"><i>قبل العرض</i><del>{formatSyp(originalPrice)}</del></span> : null}{discountedPrice > 0 ? <span className="lahza-offer-price-new"><i>فقط</i><b>{formatSyp(discountedPrice)}</b></span> : null}</div></div><div className="lahza-offer-artwork-product">{productImage ? <img src={productImage} alt={offer.productName ?? offer.text} /> : <BadgePercent className="h-12 w-12" />}</div></div>;
}

function OfferDestinationScreen({ offers, loading, onBack, focusedOfferId, onChoose }: { offers: CustomerOffer[]; loading: boolean; onBack: () => void; focusedOfferId: number | null; onChoose: (offer: CustomerOffer) => void }) {
  const offerCard = (offer: CustomerOffer) => <button key={offer.id} onClick={() => onChoose(offer)} className={`overflow-hidden rounded-3xl border bg-white text-right shadow-sm transition hover:-translate-y-0.5 active:scale-[.98] ${focusedOfferId === offer.id ? "border-red-500 ring-4 ring-red-100" : "border-amber-200"}`}><CustomerOfferArtwork offer={offer} /><span className="block p-4"><span className="inline-flex rounded-full bg-red-100 px-3 py-1 text-xs font-black text-red-800">عرض مميز معتمد</span><span className="mt-3 block text-xs font-bold text-[#63301b]">اضغط لاختيار الكمية</span></span></button>;
  return <><PageHeading eyebrow="عروض لحظة" title="العروض المميزة" detail="هذه العروض اعتمدها فريق لحظة. اختر العرض ثم حدّد الكمية وأضفه إلى السلة." onBack={onBack} /><section className="app-shell pb-12">{loading ? <div className="rounded-3xl bg-slate-50 p-6 text-center text-sm text-slate-500">جارٍ تحميل العروض المميزة...</div> : offers.length ? <div className="grid gap-4 sm:grid-cols-2">{offers.map(offerCard)}</div> : <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center"><BadgePercent className="mx-auto h-7 w-7 text-red-600" /><h2 className="mt-3 text-lg font-black text-[#4a2618]">لا توجد عروض مميزة الآن</h2><p className="mt-2 text-sm leading-7 text-slate-500">سيظهر هنا كل عرض بعد اعتماده كعرض مميز من فريق لحظة.</p></div>}</section></>;
}

function PartnerOffersScreen({ offers, loading, onBack }: { offers: Array<{ id: number; text: string; partnerName: string }>; loading: boolean; onBack: () => void }) {
  return <><PageHeading eyebrow="عروض الشركاء" title="عروض متاجر لحظة" detail="تظهر العروض النشطة فور تفعيلها من المتجر الشريك." onBack={onBack} /><section className="app-shell pb-12">{loading ? <div className="rounded-3xl bg-slate-50 p-6 text-center text-sm text-slate-500">جارٍ تحميل العروض...</div> : offers.length ? <div className="grid gap-4 sm:grid-cols-2">{offers.map(offer => <article key={offer.id} className="rounded-3xl border border-amber-200 bg-gradient-to-l from-amber-50 to-white p-5 shadow-sm"><span className="inline-flex rounded-full bg-amber-200 px-3 py-1 text-xs font-black text-amber-950">عرض نشط</span><h2 className="mt-4 text-xl font-black text-[#4a2618]">{offer.partnerName}</h2><p className="mt-2 text-sm leading-7 text-slate-700">{offer.text}</p><span className="mt-5 block text-xs font-bold text-red-600">يظهر أيضاً في شريط عروض المتاجر</span></article>)}</div> : <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center"><BadgePercent className="mx-auto h-7 w-7 text-red-600" /><h2 className="mt-3 text-lg font-black text-[#4a2618]">لا توجد عروض نشطة الآن</h2><p className="mt-2 text-sm leading-7 text-slate-500">سيظهر العرض هنا فور إضافته وتفعيله من لوحة الشريك.</p></div>}</section></>;
}
