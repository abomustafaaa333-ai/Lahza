import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { buildStoreShareUrl, parseSharedStoreId } from "@/lib/storeShare";
import { countryCallingCodes, DEFAULT_COUNTRY_CODE } from "@/lib/countryCallingCodes";
import { getCountryCallingCode, isValidPhoneNumber, type CountryCode } from "libphonenumber-js";
import { Capacitor } from "@capacitor/core";
import { Geolocation } from "@capacitor/geolocation";
import { PushNotifications } from "@capacitor/push-notifications";
import { isNativeLahzaApp } from "@/lib/nativeRuntime";
import { LAHZA_APK_FILE_NAME, LAHZA_APK_URL } from "@/lib/appDownload";
import { QRCodeSVG } from "qrcode.react";
import { getDeliveryCheckoutGate, MINIMUM_DELIVERY_ORDER_NEW_SYP, remainingDeliveryAmountNewSyp } from "@/lib/deliveryCheckout";
import { buildPartnerGallerySlides, type PartnerGallerySlide } from "@/lib/partnerGallery";
import { catalogSeed, categoryMeta, customerDeliveryCategories, formatNewSyp, formatSyp, orderStatusLabels, toLegacySyp, toNewSyp, type LahzaCategory, type RestaurantType } from "@shared/lahza";
import { getHomeShortcut } from "@shared/adminHomeShortcut";
import { isStoreClosedForCustomer } from "@shared/storeAvailability";
import { CITY_LABELS, CITY_KEYS, type CityKey } from "@shared/cities";
import { ArrowLeft, BadgePercent, BellRing, Bike, CakeSlice, CarFront, CheckCircle2, ChevronLeft, CircleHelp, ClipboardList, Clock3, CreditCard, Download, Fuel, HandCoins, LayoutDashboard, Loader2, LocateFixed, LogOut, MapPinCheck, MessageCircle, Minus, PackageCheck, PackagePlus, Pencil, Phone, Pill, Plus, QrCode, Search, Share2, Shirt, ShoppingBasket, Smartphone, Sparkles, Store, Trash2, Truck, UserRound, UtensilsCrossed, Wheat, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

declare global {
  interface Window {
    LahzaAndroidPermissionResult?: (granted: boolean) => void;
    LahzaAndroid?: { openLocationSettings?: () => void };
  }
}

type Screen = "home" | "delivery" | "stores" | "store" | "productQuantity" | "storeOffers" | "offerQuantity" | "taxi" | "intercity" | "offers" | "checkout" | "wosselLi" | "driverSearch" | "account" | "customerOrders";
type PromotionPreview = { code: string; kind: "discount" | "referral"; percent: number; discountAmount: number; itemsTotal: number };
type SubmittedOrder = { id: number; customerPhone: string; orderType: "delivery" | "taxi" | "wossel_li"; customerName: string; status: "pending" | "confirmed" | "preparing" | "on_the_way" | "completed" | "cancelled" | "rejected"; totalAmount: number; deliveryFee: number; deliveryAddress: string; paymentMethod: "cash" | "sham_cash"; eta: string; lines: CartLine[]; notes: string };
type CustomerHistoryOrder = Pick<SubmittedOrder, "id" | "status" | "orderType" | "customerName" | "totalAmount" | "deliveryFee" | "paymentMethod" | "notes"> & { locationText: string | null; createdAt: string | Date; updatedAt: string | Date; lines: Array<{ id: number; itemName: string; quantity: string; unit: string; lineTotal: number }> };

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

type StoreOption = { id: number; name: string; category: LahzaCategory; imageUrl?: string | null; restaurantType?: RestaurantType; storeOpen?: boolean | null; ratingStars?: number; completedOrders?: number; locationLat?: number | null; locationLng?: number | null };
type CustomDeliveryCategory = { id: number; slug: string; title: string; subtitle: string };
type StoreProduct = { id: number; name: string; unit: string; unitPrice: number; available: boolean; imageUrl?: string | null };
type CustomerOffer = { id: number; text: string; partnerName: string; ratingStars?: number; completedOrders?: number; storeName?: string | null; storeId?: number | null; storeCategory?: string | null; catalogItemId?: number | null; productName?: string | null; productUnit?: string | null; productPrice?: number | null; originalProductPrice?: number | null; productImageUrl?: string | null; discountPercent?: number; offerPrice?: number; imageUrl?: string | null; storeOpen?: boolean | null; featuredStatus?: "none" | "pending" | "approved" | "rejected" };
type ProductSearchResult = { id: number; name: string; unit: string; price: number; available: boolean; storeId: number; storeName: string; storeCategory: LahzaCategory; storeImageUrl?: string | null; storeOpen: boolean };
type SupportContact = { id: number; label: string; phone: string; callEnabled: boolean; whatsappEnabled: boolean };
type CustomerAuthSession = { mode: "customer" | "guest"; phone?: string; name?: string; city?: CityKey; remember?: boolean };

function CitySelectionGate({ onSelect }: { onSelect: (city: CityKey) => void }) {
  return <main dir="rtl" className="city-selection-gate min-h-screen bg-[#fffaf6] px-5 py-10 text-[#4a2618]"><section className="mx-auto flex min-h-[78vh] max-w-lg flex-col items-center justify-center rounded-[2rem] border border-orange-100 bg-white p-6 text-center shadow-[0_20px_60px_rgba(99,48,27,0.12)]"><img src="/assets/lahza-logo.svg" alt="لحظة" className="h-20 w-44 object-contain" /><p className="mt-6 text-sm font-bold text-red-600">مرحبًا بك في لحظة</p><h1 className="mt-2 text-2xl font-black">اختر مدينتك</h1><p className="mt-3 max-w-sm text-sm leading-7 text-slate-500">اختر المدينة التي تريد تصفح متاجرها وعروضها. لن يظهر تبديل المدن بعد الدخول إلى التطبيق.</p><div className="mt-8 grid w-full gap-4 sm:grid-cols-2">{CITY_KEYS.map(city => <button key={city} type="button" onClick={() => onSelect(city)} className="group rounded-3xl border-2 border-orange-100 bg-orange-50/60 p-6 text-right transition hover:border-[#ff7a33] hover:bg-white hover:shadow-lg active:scale-[.98]"><span className="block text-xs font-bold text-[#ff7a33]">لحظة</span><strong className="mt-2 block text-2xl font-black text-[#4a2618]">{CITY_LABELS[city]}</strong><span className="mt-2 block text-xs leading-6 text-slate-500">متاجر وعروض وتوصيل {CITY_LABELS[city]}</span></button>)}</div></section></main>;
}

const CUSTOMER_AUTH_STORAGE_KEY = "lahza_customer_auth_v1";
const CART_CHECKOUT_STORAGE_KEY = "lahza_cart_checkout_v1";

type PersistedCheckout = {
  cart: CartLine[];
  screen: Screen;
  checkoutMode: "delivery" | "taxi" | "wossel_li";
  checkoutStep: 1 | 2 | 3;
  checkoutName: string;
  checkoutPhone: string;
  customerLocation: string;
  customerLocationUrl: string;
  customerLat: number | null;
  customerLng: number | null;
  locationVerified: boolean;
  notes: string;
  deliveryAddress: string;
  payment: "sham_cash" | "cash";
  taxiType: "standard" | "van";
  pickup: string;
  destination: string;
};
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
  { key: "pharmacy", title: "صيدليات", icon: "💊", category: "pharmacy" },
  { key: "household", title: "مستلزمات منزلية", icon: "🏠", category: "household" },
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

function ServiceIntroCarousel({ onActiveChange, onExplore, onGateway, city }: { onActiveChange: (index: number) => void; onExplore: () => void; onGateway: () => void; city: CityKey }) {
  const slides = [
    { title: "وصّل لي", detail: "عندك غرض بدك نوصلك ياه؟ منستلمه عنك ومنوصله لبيتك بأمان." },
    { title: "اطلب أي منتج لباب بيتك", detail: "اختار طلبك من متاجر منبج وخليه يوصلك لباب بيتك بسهولة." },
    { title: "اطلب سيارة", detail: "بتجيك وين ما كنت في منبج وبتاخدك لوين ما بدك." },
  ];
  const [active, setActive] = useState(0);
  const changeActive = (index: number) => { setActive(index); onActiveChange(index); };
  useEffect(() => {
    const timer = window.setInterval(() => setActive(value => { const next = (value + 1) % slides.length; onActiveChange(next); return next; }), 5000);
    return () => window.clearInterval(timer);
  }, [slides.length]);
  const slide = slides[active];
  return <section className="service-intro-panel" aria-label="خدمات لحظة"><div className="service-intro-copy"><span className="service-intro-kicker">خدمات لحظة</span><span className="service-intro-tagline">{CITY_LABELS[city]} بين يديك</span><strong>{slide.title}</strong><small>{slide.detail}</small><button type="button" className="service-intro-cta" onClick={onExplore}>اكتشف خدمات لحظة <ChevronLeft className="h-4 w-4" /></button></div><div className="service-intro-dots">{slides.map((item, index) => <button key={item.title} type="button" className={index === active ? "service-intro-dot-active" : ""} onClick={() => changeActive(index)} aria-label={`الشريحة ${index + 1}`} />)}</div></section>;
}

function ServiceDirectoryDialog({ open, onOpenChange, onDelivery, onWosselLi, onTaxi }: { open: boolean; onOpenChange: (open: boolean) => void; onDelivery: () => void; onWosselLi: () => void; onTaxi: () => void }) {
  const services = [
    { title: "توصيل الطلبات", detail: "اطلب من المطاعم والبقاليات والصيدليات والمتاجر المحلية، وسنوصّل طلبك إلى باب بيتك داخل منبج.", icon: ShoppingBasket, action: onDelivery },
    { title: "وصّل لي", detail: "عندك غرض بدك نوصلك ياه؟ أدخل مكان الاستلام وعنوان التسليم، وسيتولى مندوب لحظة نقله بأمان.", icon: PackageCheck, action: onWosselLi },
    { title: "طلب سيارة أجرة", detail: "اطلب سيارة من موقعك داخل منبج، وسيأتيك المندوب ليأخذك إلى المكان الذي تريده.", icon: CarFront, action: onTaxi },
  ];
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent dir="rtl" className="service-directory-dialog w-[calc(100%-1.5rem)] max-w-lg rounded-[2rem] border-0 bg-white p-5 shadow-2xl"><DialogHeader><DialogTitle className="text-right text-2xl font-black text-[#173d3f]">استكشف خدمات لحظة</DialogTitle><DialogDescription className="text-right leading-7">اختر الخدمة المناسبة، وسننقلك مباشرة إلى القسم الخاص بها.</DialogDescription></DialogHeader><div className="service-directory-grid">{services.map(service => { const Icon = service.icon; return <button key={service.title} type="button" onClick={service.action} className="service-directory-card"><span className="service-directory-icon"><Icon className="h-7 w-7" /></span><span className="service-directory-copy"><strong>{service.title}</strong><small>{service.detail}</small><b>انتقل إلى الخدمة <ChevronLeft className="h-4 w-4" /></b></span></button>; })}</div></DialogContent></Dialog>;
}

function PersistentCartButton({ onCart, cartCount }: { onCart: () => void; cartCount: number }) {
  return <button type="button" className="persistent-cart-button" onClick={onCart} aria-label={`فتح السلة${cartCount ? `، ${cartCount} عناصر` : ""}`}><ShoppingBasket className="h-5 w-5" /><span>السلة</span>{cartCount > 0 ? <b>{cartCount}</b> : null}</button>;
}

function Header({ onSearch, onExplore, onGateway, searchPlaceholder, city }: { onSearch: () => void; onExplore: () => void; onGateway: () => void; searchPlaceholder: string; city: CityKey }) {
  const [serviceTheme, setServiceTheme] = useState(0);
  return (
    <header className={`relative z-30 border-b border-[#ff6b2d] pt-3 backdrop-blur-xl header-service-theme-${serviceTheme}`}>
      <div className="app-shell header-top-row flex h-[76px] items-center justify-end gap-3">
        <a className="current-location-button" href={lahzaCustomerServiceWhatsAppUrl} target="_blank" rel="noreferrer" title="خدمة الزبائن عبر واتساب" aria-label="خدمة الزبائن عبر واتساب"><span className="current-location-label" aria-label="خدمة الزبائن"><MessageCircle className="h-5 w-5" /><span>خدمة الزبائن</span><ChevronLeft className="h-4 w-4 rotate-90" /></span></a>
      </div>
      <div className="app-shell header-search-wrap"><button className="header-search-button" onClick={onSearch} aria-label="البحث عن منتج"><span key={searchPlaceholder} className="search-placeholder-rotate">{searchPlaceholder}</span><Search className="h-5 w-5" /></button></div><ServiceIntroCarousel onActiveChange={setServiceTheme} onExplore={onExplore} onGateway={onGateway} city={city} />
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


function CustomerAuthScreen({ onAuthenticated, onStaffLogin }: { onAuthenticated: (session: CustomerAuthSession) => void; onStaffLogin: (phone: string, role: "owner" | "supervisor" | "partner" | "driver", password: string) => void }) {
    const [step, setStep] = useState<"choices" | "phone" | "otp" | "staff-password">("choices");
  const [mode, setMode] = useState<"login" | "register">("login");
  const [phone, setPhone] = useState("");
  const [countryCode, setCountryCode] = useState<CountryCode>(DEFAULT_COUNTRY_CODE);
  const [name, setName] = useState("");
  const [registerCity, setRegisterCity] = useState<CityKey>("manbij");
  const [otp, setOtp] = useState("");
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [staffRole, setStaffRole] = useState<"owner" | "supervisor" | "partner" | "driver" | null>(null);
  const [staffPhone, setStaffPhone] = useState("");
  const [staffPassword, setStaffPassword] = useState("");
  const requestOtp = trpc.lahza.customerAccounts.requestOtp.useMutation();
  const verifyOtpCode = trpc.lahza.customerAccounts.verifyOtp.useMutation();
  const registerAccount = trpc.lahza.customerAccounts.register.useMutation();
  const callingCode = getCountryCallingCode(countryCode);
  const selectedCountry = countryCallingCodes.find(country => country.code === countryCode) ?? countryCallingCodes[0];
  const normalizedPhone = phone.replace(/\D/g, "").replace(new RegExp(`^${callingCode}`), "").replace(/^0/, "");
  const fullPhone = `+${callingCode}${normalizedPhone}`;
  const validPhone = normalizedPhone.length > 0 && isValidPhoneNumber(fullPhone, countryCode);
  const customerStatusQuery = trpc.lahza.customerAccounts.status.useQuery({ phone: fullPhone }, { enabled: !isStaticDemo && mode === "login" && step === "phone" && validPhone, staleTime: 10_000 });
  const staffLookupQuery = trpc.lahza.admin.staffLookup.useQuery({ phone: fullPhone }, { enabled: false, retry: false, staleTime: 10_000 });
  const startFlow = (nextMode: "login" | "register") => {
    setMode(nextMode);
    setStep("phone");
    setError("");
  };
  const sendOtp = async () => {
    if (!validPhone) { setError(`أدخل رقم هاتف صحيحاً لـ${selectedCountry.name}.`); return; }
    if (name.trim().length < 2) { setError("اكتب اسمك لننشئ حسابك في لحظة."); return; }
    try {
      setError("");
      await requestOtp.mutateAsync({ phone: fullPhone });
      setOtp("");
      setOtpSent(true);
      setStep("otp");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "تعذر إرسال رمز التحقق حالياً.");
    }
  };
  const loginDirectly = async () => {
    if (!validPhone) { setError(`أدخل رقم هاتف صحيحاً لـ${selectedCountry.name}.`); return; }
    if (isStaticDemo) {
      onAuthenticated({ mode: "customer", phone: fullPhone, city: "manbij", remember });
      return;
    }
    setError("");
    const staffResult = await staffLookupQuery.refetch();
    if (staffResult.data) { setStaffPhone(fullPhone); setStaffRole(staffResult.data.role); setStaffPassword(""); setStep("staff-password"); return; }
    const result = await customerStatusQuery.refetch();
    const account = result.data;
    if (!account || String(account.status) === "new") { setError("هذا الرقم غير مسجل بعد. اختر «التسجيل» لإنشاء حساب جديد."); return; }
    if (account.status === "rejected" || account.status === "suspended") { setError("لا يمكن الدخول بهذا الحساب حالياً. تواصل مع فريق لحظة."); return; }
    const testCity = fullPhone === "+963997777777" ? window.sessionStorage.getItem("lahza_selected_city") : null;
    onAuthenticated({ mode: "customer", phone: fullPhone, name: account.name || undefined, city: testCity === "jarabulus" ? "jarabulus" : account.city === "جرابلس" ? "jarabulus" : "manbij", remember });
  };
  const verifyOtp = async () => {
    try {
      await verifyOtpCode.mutateAsync({ phone: fullPhone, code: otp });
    } catch (verifyError) {
      setError(verifyError instanceof Error ? verifyError.message : "رمز التحقق غير صحيح.");
      return;
    }
    if (mode === "register" && !isStaticDemo) {
      try {
        await registerAccount.mutateAsync({ phone: fullPhone, name: name.trim(), city: registerCity === "jarabulus" ? "جرابلس" : "منبج" });
      } catch (registrationError) {
        setError(registrationError instanceof Error ? registrationError.message : "تعذر إنشاء الحساب حالياً.");
        return;
      }
    }
    onAuthenticated({ mode: "customer", phone: fullPhone, name: name.trim() || undefined, city: registerCity, remember });
  };
  return <main className="customer-auth-page" dir="rtl">{!Capacitor.isNativePlatform() && !isNativeLahzaApp() ? <div className="flex w-full max-w-md justify-end px-4 pb-3"><a href={LAHZA_APK_URL} download={LAHZA_APK_FILE_NAME} className="inline-flex items-center gap-2 rounded-xl bg-[#ff6b2d] px-3 py-2 text-xs font-black text-white shadow-sm" title="تحميل تطبيق لحظة"><Download className="h-4 w-4" /> تحميل التطبيق</a></div> : null}<div className="customer-auth-card"><button type="button" className="customer-auth-brand" title="فتح دخول الإدارة" aria-label="شعار لحظة"><span className="customer-auth-brand-lockup"><img className="customer-auth-primary-logo" src="/assets/lahza-primary-logo-display.png" alt="لحظة" /></span></button>{step === "choices" ? <div className="customer-auth-art" aria-hidden="true"><div className="customer-auth-art-orb customer-auth-art-orb-pink" /><div className="customer-auth-art-tile customer-auth-art-tile-teal"><ShoppingBasket className="customer-auth-art-icon" /><Sparkles className="customer-auth-art-icon customer-auth-art-icon-small" /></div><div className="customer-auth-art-tile customer-auth-art-tile-light"><PackageCheck className="customer-auth-art-icon" /></div><div className="customer-auth-art-tile customer-auth-art-tile-rose"><BadgePercent className="customer-auth-art-icon" /></div><div className="customer-auth-art-orb customer-auth-art-orb-blue"><MapPinCheck className="customer-auth-art-icon" /></div></div> : null}{step === "choices" ? <><div className="customer-auth-heading"><p>أهلاً بك في لحظة</p><h1>كل طلباتك أقرب إليك</h1><span>سجّل دخولك لتتابع طلباتك وتحصل على تجربة أسرع.</span></div><div className="customer-auth-services-card"><strong>متاجر وعروض وتوصيل</strong><small>كل خدمات لحظة بين يديك</small></div><div className="customer-auth-actions"><button type="button" onClick={() => startFlow("login")} className="customer-auth-primary">تسجيل الدخول <ChevronLeft className="h-5 w-5" /></button><button type="button" onClick={() => startFlow("register")} className="customer-auth-secondary">التسجيل إذا لم تمتلك حسابًا بعد <Plus className="h-5 w-5" /></button><button type="button" onClick={() => onAuthenticated({ mode: "guest" })} className="customer-auth-guest">الدخول كزائر <UserRound className="h-5 w-5" /></button></div><p className="customer-auth-note">يمكنك متابعة التصفح كزائر، وإنشاء حسابك لاحقًا في أي وقت.</p></> : step === "phone" ? <><button type="button" className="customer-auth-back" onClick={() => { setStep("choices"); setError(""); }}><ArrowLeft className="h-4 w-4" /> العودة للخيارات</button><div className="customer-auth-heading"><p>{mode === "login" ? "تسجيل الدخول" : "إنشاء حساب جديد"}</p><h1>{mode === "login" ? "أدخل رقم هاتفك" : "لنبدأ حسابك في لحظة"}</h1><span>{mode === "login" ? "إذا كان رقمك مسجلًا من قبل، ستدخل مباشرة إلى حسابك." : "أدخل اسمك ورقم هاتفك لإنشاء حسابك."}</span></div><div className="customer-auth-form">{mode === "register" ? <><label><span>الاسم</span><Input value={name} onChange={event => setName(event.target.value)} placeholder="اكتب اسمك" autoComplete="name" /></label><label><span>المدينة</span><select value={registerCity} onChange={event => setRegisterCity(event.target.value as CityKey)} className="form-select" aria-label="مدينة العميل"><option value="manbij">منبج</option><option value="jarabulus">جرابلس</option></select></label></> : null}<label><span>رقم الهاتف</span><div className="customer-auth-phone"><select aria-label="رمز الدولة" value={countryCode} onChange={event => { setCountryCode(event.target.value as CountryCode); setPhone(""); setError(""); }}><option value="SY">سوريا (+963)</option>{countryCallingCodes.filter(country => country.code !== "SY").map(country => <option key={country.code} value={country.code}>{country.name} (+{country.dialCode})</option>)}</select><Input dir="ltr" inputMode="tel" value={phone} onChange={event => setPhone(event.target.value.replace(/\D/g, "").slice(0, 15))} placeholder={countryCode === "SY" ? "9XXXXXXXX" : "رقم الهاتف"} autoComplete="tel-national" /></div><small className="customer-auth-phone-hint">الدولة المختارة: {selectedCountry.name} · +{callingCode}</small></label><label className="customer-auth-remember"><input type="checkbox" checked={remember} onChange={event => setRemember(event.target.checked)} /><span>حفظ معلومات التسجيل على هذا الجهاز</span></label><button type="button" onClick={() => { void (mode === "login" ? loginDirectly() : sendOtp()); }} disabled={customerStatusQuery.isFetching} className="customer-auth-primary">{mode === "login" ? (customerStatusQuery.isFetching ? "جارٍ التحقق من الرقم..." : "دخول برقم الهاتف") : "إرسال رمز التحقق"} <ChevronLeft className="h-5 w-5" /></button>{error ? <p className="customer-auth-error">{error}</p> : null}<p className="customer-auth-demo-hint">{mode === "login" ? "استخدم رقم هاتفك المسجل للدخول مباشرة." : <>سيصلك رمز تحقق حقيقي عبر واتساب</>}</p></div></> : null}{step === "staff-password" ? <div className="customer-auth-otp-panel"><button type="button" className="customer-auth-back" onClick={() => { setStep("phone"); setStaffPassword(""); setError(""); }}><ArrowLeft className="h-4 w-4" /> تعديل رقم الهاتف</button><div className="customer-auth-heading"><p>{staffRole === "owner" ? "دخول المالك" : staffRole === "supervisor" ? "دخول المشرف" : staffRole === "driver" ? "دخول المندوب" : "دخول الشريك"}</p><h1>أدخل كلمة المرور</h1><span>تم التعرف على رقم الحساب <b dir="ltr">{staffPhone}</b>.</span></div><label className="customer-auth-otp-field"><span>كلمة المرور</span><Input dir="ltr" type="password" inputMode="numeric" autoFocus value={staffPassword} onChange={event => setStaffPassword(event.target.value)} onKeyDown={event => { if (event.key === "Enter" && staffPassword && staffRole) onStaffLogin(staffPhone, staffRole, staffPassword); }} placeholder="0000" /></label><button type="button" onClick={() => { if (staffRole && staffPassword) onStaffLogin(staffPhone, staffRole, staffPassword); }} disabled={!staffRole || !staffPassword} className="customer-auth-primary">دخول <CheckCircle2 className="h-5 w-5" /></button>{error ? <p className="customer-auth-error">{error}</p> : null}</div> : null}{step === "otp" ? <div className="customer-auth-otp-panel"><button type="button" className="customer-auth-back" onClick={() => { setStep("phone"); setError(""); }}><ArrowLeft className="h-4 w-4" /> تعديل رقم الهاتف</button><div className="customer-auth-heading"><p>التحقق من الرقم</p><h1>أدخل رمز OTP</h1><span>أرسلنا رمز التحقق إلى <b dir="ltr">{fullPhone}</b>.</span></div><label className="customer-auth-otp-field"><span>رمز التحقق</span><Input dir="ltr" inputMode="numeric" maxLength={6} value={otp} onChange={event => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="أدخل الرمز" autoFocus /></label><button type="button" onClick={() => { void verifyOtp(); }} disabled={registerAccount.isPending} className="customer-auth-primary">{registerAccount.isPending ? "جارٍ إنشاء الحساب..." : "تحقق ودخول"} <CheckCircle2 className="h-5 w-5" /></button>{error ? <p className="customer-auth-error">{error}</p> : null}<button type="button" className="customer-auth-resend" onClick={() => { void sendOtp(); }}>إعادة إرسال الرمز التجريبي</button><p className="customer-auth-demo-hint">الرمز صالح لمدة 5 دقائق ولا يستخدم إلا مرة واحدة</p></div> : null}</div></main>;
}

function AdminAccessDialog({ open, onOpenChange, secretRole, setSecretRole, pin, setPin, username, setUsername, password, setPassword, onLogin, adminPending, partnerPending }: { open: boolean; onOpenChange: (open: boolean) => void; secretRole: "owner" | "supervisor" | "partner"; setSecretRole: (role: "owner" | "supervisor" | "partner") => void; pin: string; setPin: (value: string) => void; username: string; setUsername: (value: string) => void; password: string; setPassword: (value: string) => void; onLogin: () => void; adminPending: boolean; partnerPending: boolean }) {
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent dir="rtl" className="w-[calc(100%-2rem)] max-w-sm rounded-3xl border-0 bg-white p-6 shadow-2xl"><DialogHeader><div className="admin-lock-icon">L</div><DialogTitle className="pt-2 text-center text-xl">اختر نوع الدخول</DialogTitle><DialogDescription className="text-center">اختر حسابك ثم أدخل بياناته في المكان الصحيح.</DialogDescription></DialogHeader><div className="mt-3 space-y-4"><div className="role-switch"><button onClick={() => setSecretRole("owner")} className={secretRole === "owner" ? "role-selected" : ""}>المالك</button><button onClick={() => setSecretRole("supervisor")} className={secretRole === "supervisor" ? "role-selected" : ""}>مشرف</button><button onClick={() => setSecretRole("partner")} className={secretRole === "partner" ? "role-selected" : ""}>شريك</button></div>{<><div><Label htmlFor="management-phone">رقم الهاتف</Label><Input id="management-phone" dir="ltr" inputMode="tel" value={username} onChange={e => setUsername(e.target.value)} placeholder="0997311078" /></div><div><Label htmlFor="management-password">كلمة المرور</Label><Input id="management-password" dir="ltr" type="password" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && password) onLogin(); }} placeholder="0000" /></div></>}<Button disabled={secretRole === "partner" ? partnerPending || !password : !isStaticDemo && (adminPending || (!username.trim() || !password))} className="w-full rounded-xl bg-[#63301b] hover:bg-[#4a2618]" onClick={onLogin}>{secretRole === "partner" ? partnerPending ? "جارٍ فتح حساب الشريك..." : "دخول الشريك" : !isStaticDemo && adminPending ? "جارٍ التحقق..." : "دخول آمن"}</Button></div></DialogContent></Dialog>;
}

export default function Home() {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const queryClient = useQueryClient();
  const [screen, setScreen] = useState<Screen>("home");
  const [customerAuthReady, setCustomerAuthReady] = useState(false);
  const [customerAuth, setCustomerAuth] = useState<CustomerAuthSession | null>(null);
  const [selectedCity, setSelectedCity] = useState<CityKey | null>(() => {
    const saved = typeof window !== "undefined" ? window.sessionStorage.getItem("lahza_selected_city") : null;
    return saved === "manbij" || saved === "jarabulus" ? saved : null;
  });
  const interfaceSettingsQuery = trpc.lahza.interfaceSettings.get.useQuery(undefined, { enabled: Boolean(customerAuth), retry: false, staleTime: 300_000 });
  const categorySettingsQuery = trpc.lahza.categorySettings.get.useQuery(undefined, { enabled: Boolean(customerAuth), retry: false, staleTime: 300_000 });
  useEffect(() => {
    if (!selectedCity || isStaticDemo) return;
    queryClient.removeQueries({ predicate: query => {
      const key = JSON.stringify(query.queryKey);
      return key.includes("storefront") || key.includes("publicFeaturedOffers") || key.includes("catalog") || key.includes("customCategories") || key.includes("gatewayStores") || key.includes("interfaceSettings");
    }});
    setActiveCategory(null);
    setActiveCustomCategory(null);
    setSelectedStore(null);
    setSelectedProduct(null);
    setSelectedOffer(null);
    setSelectedGalleryOffer(null);
    setFocusedOfferId(null);
    setScreen("home");
  }, [selectedCity, queryClient]);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>("default");
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [serviceDirectoryOpen, setServiceDirectoryOpen] = useState(false);
  const [checkoutMode, setCheckoutMode] = useState<"delivery" | "taxi" | "wossel_li">("delivery");
  const [wosselPickupContactPhone, setWosselPickupContactPhone] = useState("");
  const [wosselPickupAddress, setWosselPickupAddress] = useState("");
  const [wosselItemDescription, setWosselItemDescription] = useState("");
  const [wosselItemWeight, setWosselItemWeight] = useState("");
  const [checkoutStep, setCheckoutStep] = useState<1 | 2 | 3>(1);
  const [discountPreview, setDiscountPreview] = useState<PromotionPreview | null>(null);
  const [referralPreview, setReferralPreview] = useState<PromotionPreview | null>(null);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [activeCategory, setActiveCategory] = useState<LahzaCategory | null>(null);
  const [activeCustomCategory, setActiveCustomCategory] = useState<CustomDeliveryCategory | null>(null);
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
  const [promotionInfo, setPromotionInfo] = useState<"discount" | "referral" | null>(null);
  const [myReferralCode, setMyReferralCode] = useState("");
  const [usePointsReward, setUsePointsReward] = useState(false);
  const [customerLocation, setCustomerLocation] = useState("");
  const [customerLocationUrl, setCustomerLocationUrl] = useState("");
  const [customerLat, setCustomerLat] = useState<number | null>(null);
  const [customerLng, setCustomerLng] = useState<number | null>(null);
  const [locationVerified, setLocationVerified] = useState(false);
  const [deliveryQuoteData, setDeliveryQuoteData] = useState<{ distanceMeters: number; billableKm: number; deliveryFeeNewSyp: number; durationMinutes: number } | null>(null);
  const [deliveryQuoteStatus, setDeliveryQuoteStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
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
  const [checkoutRestored, setCheckoutRestored] = useState(false);
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(CUSTOMER_AUTH_STORAGE_KEY);
      if (saved) {
        const session = JSON.parse(saved) as CustomerAuthSession;
        setCustomerAuth(session);
        if (session.mode === "customer" && session.city) {
          window.sessionStorage.setItem("lahza_selected_city", session.city);
          setSelectedCity(session.city);
        }
      }
    } catch {
      window.localStorage.removeItem(CUSTOMER_AUTH_STORAGE_KEY);
    } finally {
      setCustomerAuthReady(true);
    }
  }, []);
  useEffect(() => {
    if (customerAuth?.mode !== "customer" || !customerAuth.phone) return;
    setCheckoutPhone(customerAuth.phone);
    if (customerAuth.name) setCheckoutName(current => current || customerAuth.name || "");
  }, [customerAuth?.mode, customerAuth?.phone, customerAuth?.name]);
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(CART_CHECKOUT_STORAGE_KEY);
      if (saved) {
        const checkout = JSON.parse(saved) as PersistedCheckout;
        if (Array.isArray(checkout.cart) && checkout.cart.length > 0) {
          setCart(checkout.cart);
          setScreen(checkout.screen === "checkout" ? "checkout" : "home");
          setCheckoutMode(checkout.checkoutMode);
          setCheckoutStep(checkout.checkoutStep);
          setCheckoutName(checkout.checkoutName || "");
          setCheckoutPhone(checkout.checkoutPhone || "");
          setCustomerLocation(checkout.customerLocation || "");
          setCustomerLocationUrl(checkout.customerLocationUrl || "");
          setCustomerLat(checkout.customerLat ?? null);
          setCustomerLng(checkout.customerLng ?? null);
          setLocationVerified(Boolean(checkout.locationVerified));
          setNotes(checkout.notes || "");
          setDeliveryAddress(checkout.deliveryAddress || "");
          setPayment(checkout.payment || "cash");
          setTaxiType(checkout.taxiType || "standard");
          setPickup(checkout.pickup || "");
          setDestination(checkout.destination || "");
        }
      }
    } catch {
      window.localStorage.removeItem(CART_CHECKOUT_STORAGE_KEY);
    } finally {
      setCheckoutRestored(true);
    }
  }, []);
  useEffect(() => {
    if (!checkoutRestored) return;
    if (!cart.length) {
      window.localStorage.removeItem(CART_CHECKOUT_STORAGE_KEY);
      return;
    }
    const checkout: PersistedCheckout = { cart, screen, checkoutMode, checkoutStep, checkoutName, checkoutPhone, customerLocation, customerLocationUrl, customerLat, customerLng, locationVerified, notes, deliveryAddress, payment, taxiType, pickup, destination };
    window.localStorage.setItem(CART_CHECKOUT_STORAGE_KEY, JSON.stringify(checkout));
  }, [checkoutRestored, cart, screen, checkoutMode, checkoutStep, checkoutName, checkoutPhone, customerLocation, customerLocationUrl, customerLat, customerLng, locationVerified, notes, deliveryAddress, payment, taxiType, pickup, destination]);
  const completeCustomerAuth = (session: CustomerAuthSession) => {
    if (session.mode === "customer" && session.remember) window.localStorage.setItem(CUSTOMER_AUTH_STORAGE_KEY, JSON.stringify(session));
    else window.localStorage.removeItem(CUSTOMER_AUTH_STORAGE_KEY);
    if (session.mode === "customer" && session.city) {
      window.sessionStorage.setItem("lahza_selected_city", session.city);
      setSelectedCity(session.city);
    } else if (session.mode === "guest") {
      window.sessionStorage.removeItem("lahza_selected_city");
      setSelectedCity(null);
    }
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
  const [missingProductName, setMissingProductName] = useState("");
  const [missingProductNotes, setMissingProductNotes] = useState("");
  const [supportOpen, setSupportOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [sharedStoreId] = useState(() => parseSharedStoreId(window.location.search));
  const [gatewayMode, setGatewayMode] = useState(false);

  const deliveryFeesQuery = trpc.lahza.deliveryFees.get.useQuery(undefined, { enabled: !isStaticDemo && Boolean(customerAuth) && screen === "checkout", retry: false });
  const deliveryQuote = trpc.lahza.delivery.quote.useMutation();
  const partnerOffersQuery = trpc.lahza.publicFeaturedOffers.useQuery(undefined, { enabled: !isStaticDemo && Boolean(customerAuth), retry: false, staleTime: 120_000 });
  const popularProductsQuery = trpc.lahza.storefront.popularProducts.useQuery(undefined, { enabled: !isStaticDemo && Boolean(customerAuth), retry: false, staleTime: 300_000 });
  const storeOffersQuery = trpc.lahza.intercity.offers.useQuery({ storeId: selectedStore?.id ?? 1 }, { enabled: !isStaticDemo && Boolean(selectedStore), retry: false });
  const trackStoreVisit = trpc.lahza.traffic.track.useMutation();
  const customCategoriesQuery = trpc.lahza.customCategories.listActive.useQuery(undefined, { enabled: !isStaticDemo && Boolean(customerAuth) && (screen === "delivery" || screen === "stores"), retry: false });
  const supportContactsQuery = trpc.lahza.support.contacts.useQuery(undefined, { enabled: !isStaticDemo && Boolean(customerAuth) && (screen === "checkout" || supportOpen), retry: false });
  const normalizedSearchText = searchText.trim();
  const productSearchInput = useMemo(() => ({ query: normalizedSearchText }), [normalizedSearchText]);
  const productSearchQuery = trpc.lahza.storefront.searchProducts.useQuery(productSearchInput, { enabled: !isStaticDemo && searchOpen && normalizedSearchText.length >= 2, retry: false });
  const orderNotificationPhone = customerAuth?.phone || (checkoutPhone.length === 9 ? `+963${checkoutPhone}` : "");
  const orderNotificationsQuery = trpc.lahza.notifications.orderFeed.useQuery({ customerPhone: orderNotificationPhone, unreadOnly: true }, { enabled: !isStaticDemo && /^\+[1-9]\d{6,14}$/.test(orderNotificationPhone), retry: false, refetchInterval: 15_000 });
  const markOrderNotificationRead = trpc.lahza.notifications.markOrderRead.useMutation({ onSuccess: () => { void orderNotificationsQuery.refetch(); } });
  const staffSessionEnabled = !isStaticDemo && (!customerAuth || secretOpen);
  const adminSessionQuery = trpc.lahza.admin.session.useQuery(undefined, { enabled: staffSessionEnabled, retry: false, staleTime: 60_000 });
  const partnerSessionQuery = trpc.lahza.partner.session.useQuery(undefined, { enabled: staffSessionEnabled, retry: false, staleTime: 60_000 });
  const driverSessionQuery = trpc.lahza.driverAuth.session.useQuery(undefined, { enabled: !isStaticDemo, retry: false, staleTime: 30_000 });
  const driverLogin = trpc.lahza.driverAuth.login.useMutation({ onSuccess: () => { void driverSessionQuery.refetch(); }, onError: error => toast.error(error.message) });
  const driverLogout = trpc.lahza.driverAuth.logout.useMutation({ onSuccess: () => { void driverSessionQuery.refetch(); } });
  const pointsQuery = trpc.lahza.customers.points.balance.useQuery({ phone: `+963${checkoutPhone}` }, { enabled: !isStaticDemo && /^9\d{8}$/.test(checkoutPhone), retry: false });
  const customerOrderHistoryQuery = trpc.lahza.orders.history.useQuery({ customerPhone: customerAuth?.phone ?? "+963900000000" }, { enabled: !isStaticDemo && customerAuth?.mode === "customer" && Boolean(customerAuth.phone), retry: false });
  const updateCustomerPhone = trpc.lahza.customerAccounts.updatePhone.useMutation({ onSuccess: (_result, variables) => { updateCustomerSessionPhone(variables.newPhone); toast.success("تم تحديث رقم هاتفك بنجاح"); }, onError: error => toast.error(error.message) });
  const createReferralCode = trpc.lahza.customers.referral.getOrCreate.useMutation({ onSuccess: result => { setMyReferralCode(result.code); void navigator.clipboard?.writeText(result.code); toast.success(`رمز إحالتك: ${result.code}`); }, onError: error => toast.error(error.message) });
  const createMissingProductRequest = trpc.lahza.missingProducts.create.useMutation({
    onSuccess: () => {
      setMissingProductOpen(false);
      setMissingProductName("");
      setMissingProductNotes("");
      toast.success("تم إرسال طلبك للإدارة، وسنتابع توفر المنتج.");
    },
    onError: error => toast.error(error.message),
  });
  const categoryStoresInput = useMemo(() => ({ category: activeCategory ?? "groceries", customCategorySlug: activeCategory === "other" ? activeCustomCategory?.slug : undefined }), [activeCategory, activeCustomCategory?.slug]);
  const categoryStoresQuery = trpc.lahza.storefront.stores.useQuery(categoryStoresInput, { enabled: !isStaticDemo && Boolean(customerAuth) && Boolean(activeCategory), retry: false, staleTime: 60_000 });
  const gatewayStoresQuery = trpc.lahza.storefront.gatewayStores.useQuery(undefined, { enabled: !isStaticDemo && Boolean(customerAuth) && selectedCity === "jarabulus", retry: false });
  const storeProductsQuery = trpc.lahza.storefront.products.useQuery({ storeId: selectedStore?.id ?? 1 }, { enabled: !isStaticDemo && Boolean(customerAuth) && Boolean(selectedStore), retry: false, staleTime: 60_000 });
  const sharedStoreQuery = trpc.lahza.storefront.products.useQuery({ storeId: sharedStoreId ?? 1 }, { enabled: !isStaticDemo && Boolean(customerAuth) && Boolean(sharedStoreId), retry: false, staleTime: 120_000 });
  const products = isStaticDemo ? staticDemoProducts : [];
  const supportContacts = supportContactsQuery.data ?? [];
  const gatewayStores = (gatewayStoresQuery.data ?? []) as StoreOption[];
  const categoryStores: StoreOption[] = isStaticDemo && activeCategory
    ? [{ id: -1, name: "متجر لحظة التجريبي", category: activeCategory }]
    : categoryStoresQuery.data ?? [];
  const deliveryCategories = useMemo(() => [
    ...(categorySettingsQuery.data ?? customerDeliveryCategories.map((category, index) => ({ key: category, title: categoryMeta[category].title, subtitle: categoryMeta[category].subtitle, active: true, sortOrder: index }))).filter(category => category.active).sort((a, b) => a.sortOrder - b.sortOrder).map(category => ({ key: category.key, category: category.key as LahzaCategory, title: category.title, subtitle: category.subtitle, custom: null as CustomDeliveryCategory | null })),
    ...(customCategoriesQuery.data ?? []).map(category => ({ key: `custom-${category.id}`, category: "other" as LahzaCategory, title: category.title, subtitle: category.subtitle, custom: category as CustomDeliveryCategory })),
  ], [customCategoriesQuery.data, categorySettingsQuery.data]);
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
  useEffect(() => {
    if (isStaticDemo || checkoutMode !== "delivery" || !selectedStore?.locationLat || !selectedStore.locationLng || customerLat === null || customerLng === null) {
      setDeliveryQuoteData(null);
      setDeliveryQuoteStatus("idle");
      return;
    }
    setDeliveryQuoteData(null);
    setDeliveryQuoteStatus("loading");
    let active = true;
    void deliveryQuote.mutateAsync({
      locationLat: customerLat,
      locationLng: customerLng,
      originLat: selectedStore.locationLat / 1_000_000,
      originLng: selectedStore.locationLng / 1_000_000,
    }).then(result => {
      if (active) {
        setDeliveryQuoteData({ distanceMeters: result.distanceMeters, billableKm: result.billableKm, deliveryFeeNewSyp: result.deliveryFeeNewSyp, durationMinutes: result.durationMinutes });
        setDeliveryQuoteStatus("ready");
      }
    }).catch(() => {
      if (active) {
        setDeliveryQuoteData(null);
        setDeliveryQuoteStatus("error");
        toast.error("تعذر حساب مسافة الطريق الحقيقية. أعد تحديد الموقع للمحاولة مجدداً.");
      }
    });
    return () => { active = false; };
  }, [isStaticDemo, checkoutMode, selectedStore?.id, selectedStore?.locationLat, selectedStore?.locationLng, customerLat, customerLng]);
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
      setSubmittedOrder({ id: result.orderId, customerPhone: checkoutCustomerPhone, orderType: checkoutMode, customerName: checkoutName.trim(), status: checkoutMode === "delivery" ? "preparing" : "confirmed", totalAmount: result.totalAmount, deliveryFee: result.deliveryFee, deliveryAddress: checkoutMode === "delivery" ? (deliveryAddress.trim() || "الموقع المحدد عبر GPS") : checkoutMode === "wossel_li" ? deliveryAddress.trim() : `${pickup} ← ${destination}`, paymentMethod: payment, eta: checkoutMode === "wossel_li" ? `${result.preparationMinutes} دقيقة تقريباً` : deliveryEta, lines: [...cart], notes });
      setCart([]);
      setNotes("");
      setDeliveryAddress("");
      setDiscountPreview(null);
      setReferralPreview(null);
      setCheckoutStep(1);
      setPickup("");
      setDestination("");
      setWosselPickupAddress("");
      setWosselPickupContactPhone("");
      setWosselItemWeight("");
      setWosselItemDescription("");
      setScreen("driverSearch");
    },
    onError: error => {
      const rawMessage = error.message || "";
      const message = /failed query|insert into `orders`|params:/i.test(rawMessage)
        ? "تعذر إنشاء الطلب حالياً. تم تسجيل المشكلة، حاول مرة أخرى بعد لحظات."
        : rawMessage;
      toast.error(message || "تعذر إرسال الطلب حالياً");
    },
  });
  const checkStoreAvailability = trpc.lahza.storefront.availability.useMutation({ onError: error => toast.error(error.message) });
  const touchPresence = trpc.lahza.customers.touch.useMutation();
  const deviceId = useMemo(() => getDeviceId(), []);
  const notificationsQuery = trpc.lahza.notifications.feed.useQuery({ deviceId }, { enabled: !isStaticDemo && Boolean(customerAuth), refetchInterval: 60_000, staleTime: 30_000 });
  const markNotificationRead = trpc.lahza.notifications.markRead.useMutation({ onSuccess: () => { void notificationsQuery.refetch(); } });
  const registerPushToken = trpc.lahza.notifications.registerPushToken.useMutation();

  // Firebase is optional for this APK. Do not call PushNotifications.register()
  // unless a google-services.json is bundled; otherwise the Capacitor plugin
  // throws because FirebaseApp has not been initialized and can crash the app.

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
  const deliveryPricePerKm = deliveryFeesQuery.data?.pricePerKm ?? 2;
  const storeLat = selectedStore?.locationLat ? selectedStore.locationLat / 1_000_000 : null;
  const storeLng = selectedStore?.locationLng ? selectedStore.locationLng / 1_000_000 : null;
  const deliveryDistanceMeters = deliveryQuoteData?.distanceMeters ?? 0;
  const billableDeliveryKm = deliveryQuoteData?.billableKm ?? 0;
  const deliveryFeeNewSyp = checkoutMode === "delivery" ? (deliveryQuoteData?.deliveryFeeNewSyp ?? 0) : 0;
  const grandTotalNewSyp = toNewSyp(total) + deliveryFeeNewSyp;
  const hasPharmacy = cart.some(item => item.category === "pharmacy");
  const cartDeliveryFeeNewSyp = deliveryQuoteData?.deliveryFeeNewSyp ?? 0;
  const cartGrandTotalNewSyp = toNewSyp(discountedCartTotal) + cartDeliveryFeeNewSyp;
  const deliveryEta = deliveryQuoteData ? `${deliveryQuoteData.durationMinutes} دقيقة تقريباً` : deliveryQuoteStatus === "loading" ? "جارٍ حساب مسافة الطريق..." : deliveryQuoteStatus === "error" ? "تعذر حساب مسافة الطريق" : "يتم الحساب بعد تحديد موقعك";
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
    if (!checkoutPhoneIsValid) { toast.error("رقم الهاتف المسجل غير صالح"); return; }
    if (!locationVerified || !customerLocationUrl || customerLat === null || customerLng === null) { toast.error("اضغط «تحديد موقعي» لتأكيد موقع التوصيل قبل المتابعة"); return; }
    if (referralPreview && !isStaticDemo) {
      try {
        const result = await previewPromotion.mutateAsync({ code: referralPreview.code, kind: "referral", customerPhone: checkoutCustomerPhone, lines: cartOrderLines });
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
      setScreen("account");
      return;
    }
    openCart();
  };
  const openAccount = () => setScreen("account");
  const logoutCustomer = () => {
    window.localStorage.removeItem(CUSTOMER_AUTH_STORAGE_KEY);
    window.sessionStorage.removeItem("lahza_selected_city");
    setSelectedCity(null);
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
    setCheckoutPhone(newPhone);
  };

  const checkoutCustomerPhone = customerAuth?.mode === "customer" && customerAuth.phone
    ? customerAuth.phone
    : checkoutPhone.startsWith("+") ? checkoutPhone : `+963${checkoutPhone}`;
  const checkoutPhoneIsValid = isValidPhoneNumber(checkoutCustomerPhone);

  const openTaxiCheckout = () => {
    if (!pickup.trim() || !destination.trim()) {
      toast.error("أدخل موقع الانطلاق والوجهة قبل المتابعة");
      return;
    }
    setCheckoutMode("taxi");
    setScreen("checkout");
  };

  const locateCustomer = async () => {
    const nativeApp = Capacitor.isNativePlatform() || isNativeLahzaApp();
    if (!nativeApp && !navigator.geolocation) {
      toast.error("لا يدعم هذا الجهاز تحديد الموقع");
      return;
    }
    if (!window.isSecureContext && !nativeApp) {
      toast.error("يتطلب تحديد الموقع فتح التطبيق عبر اتصال آمن HTTPS.");
      return;
    }
    setLocating(true);
    try {
      let coords: { latitude: number; longitude: number };
      if (nativeApp) {
        let permission = await Geolocation.checkPermissions();
        if (permission.location !== "granted") permission = await Geolocation.requestPermissions();
        if (permission.location !== "granted") throw new Error("LOCATION_PERMISSION_DENIED");
        let position;
        try {
          // A cold GPS fix can take longer than the default Android timeout.
          // Try the actual GPS provider first, then fall back to the network provider.
          position = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 90000, maximumAge: 0 });
        } catch (firstError) {
          try {
            position = await Geolocation.getCurrentPosition({ enableHighAccuracy: false, timeout: 60000, maximumAge: 120000 });
          } catch (secondError) {
            const firstCode = typeof firstError === "object" && firstError && "code" in firstError ? Number(firstError.code) : undefined;
            const secondCode = typeof secondError === "object" && secondError && "code" in secondError ? Number(secondError.code) : undefined;
            const locationError = new Error("LOCATION_UNAVAILABLE");
            (locationError as Error & { code?: number }).code = secondCode ?? firstCode;
            throw locationError;
          }
        }
        coords = position.coords;
      } else {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: false, timeout: 60000, maximumAge: 30000 }));
        coords = position.coords;
      }
      const { latitude, longitude } = coords;
      setCustomerLocation(`موقعي الحالي (${latitude.toFixed(5)}, ${longitude.toFixed(5)})`);
      setCustomerLocationUrl(`https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`);
      setCustomerLat(latitude);
      setCustomerLng(longitude);
      setLocationVerified(true);
      setUseManualLocation(false);
      setLocating(false);
      toast.success("تم السماح بالموقع وتأكيد عنوان التوصيل.");
    } catch (error) {
      setLocating(false);
      const code = typeof error === "object" && error && "code" in error ? Number(error.code) : undefined;
      if (error instanceof Error && error.message === "LOCATION_PERMISSION_DENIED" || code === 1) {
        toast.error("لم يتم منح إذن الموقع. عند ظهور نافذة الهاتف اختر «سماح أثناء الاستخدام»، ثم اضغط الزر مرة أخرى.");
        return;
      }
      if (code === 2) {
        if (nativeApp) window.LahzaAndroid?.openLocationSettings?.();
        toast.error("خدمة الموقع في الهاتف غير متاحة. فعّل «الموقع» من إعدادات الهاتف ثم أعد المحاولة.");
        return;
      }
      if (code === 3) {
        if (nativeApp) window.LahzaAndroid?.openLocationSettings?.();
        toast.error("تعذر الحصول على إحداثيات الموقع. فعّل GPS/الموقع، اخرج إلى مكان مفتوح، ثم أعد المحاولة.");
        return;
      }
      if (nativeApp) window.LahzaAndroid?.openLocationSettings?.();
      toast.info("جارٍ تحديد الموقع");
    }
  };

  const submitCheckout = async () => {
    const isTaxi = checkoutMode === "taxi";
    const isWosselLi = checkoutMode === "wossel_li";
    if (checkoutMode === "delivery" && !deliveryQuoteData) {
      toast.error("حدد موقع التوصيل أولاً وانتظر حساب المسافة ورسوم التوصيل الحقيقية");
      setCheckoutStep(2);
      return;
    }
    if (isWosselLi && (!/^\+9639\d{8}$/.test(wosselPickupContactPhone) || !wosselPickupAddress.trim() || !wosselItemDescription.trim() || !customerLat || !customerLng)) {
      toast.error("أدخل رقم جهة الاستلام، وعنوان الاستلام، ونوع الغرض، وحدد موقع التسليم على الخريطة");
      return;
    }
    if (!isTaxi && !isWosselLi && toNewSyp(total) < minimumDeliveryOrderSyp) {
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
    if (!checkoutPhoneIsValid) {
      toast.error("رقم الهاتف المسجل غير صالح");
      return;
    }
    if (isTaxi && (!pickup.trim() || !destination.trim())) {
      toast.error("أكمل موقع الانطلاق والوجهة");
      return;
    }
    if (isStaticDemo) {
      const demoOrderId = Math.floor(Date.now() / 1000);
      toast.success("تم تسجيل الطلب كتجربة محلية فقط ولن يُرسل إلى أي جهة.");
      setSubmittedOrder({ id: demoOrderId, customerPhone: checkoutCustomerPhone, orderType: isTaxi ? "taxi" : isWosselLi ? "wossel_li" : "delivery", customerName: checkoutName.trim(), status: isTaxi || isWosselLi ? "confirmed" : "preparing", totalAmount: toLegacySyp(isTaxi ? 0 : cartGrandTotalNewSyp), deliveryFee: toLegacySyp(isTaxi ? 0 : cartDeliveryFeeNewSyp), deliveryAddress: isTaxi ? `${pickup} ← ${destination}` : (deliveryAddress.trim() || "الموقع المحدد عبر GPS"), paymentMethod: payment, eta: deliveryEta, lines: [...cart], notes });
      setCart([]);
      setNotes("");
      setDeliveryAddress("");
      setDiscountPreview(null);
      setReferralPreview(null);
      setCheckoutStep(1);
      setPickup("");
      setDestination("");
      setWosselPickupAddress("");
      setWosselPickupContactPhone("");
      setWosselItemWeight("");
      setWosselItemDescription("");
      setScreen("account");
      return;
    }
    createOrder.mutate({
      orderType: isTaxi ? "taxi" : isWosselLi ? "wossel_li" : "delivery",
      orderCity: selectedCity ?? "manbij",
      customerName: checkoutName.trim(),
      customerPhone: checkoutCustomerPhone,
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
      pickupLocation: isTaxi ? pickup : isWosselLi ? wosselPickupAddress.trim() : undefined,
      pickupContactPhone: isWosselLi ? wosselPickupContactPhone : undefined,
      itemDescription: isWosselLi ? wosselItemDescription.trim() : undefined,
      itemWeight: isWosselLi && wosselItemWeight.trim() ? `${wosselItemWeight.trim()} كغ` : undefined,
      destination: isTaxi ? destination : undefined,
      lines: isTaxi || isWosselLi ? [] : cartOrderLines,
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

  const openDeliveryService = () => { setServiceDirectoryOpen(false); setActiveCategory(null); setActiveCustomCategory(null); setSelectedStore(null); setSelectedProduct(null); setScreen("delivery"); };
  const openWosselLiService = () => { setServiceDirectoryOpen(false); setCheckoutMode("wossel_li"); setScreen("checkout"); };
  const openTaxiService = () => { setServiceDirectoryOpen(false); setCheckoutMode("taxi"); setScreen("taxi"); };

  const chooseOffer = (offer: CustomerOffer) => {
    setSelectedOffer(offer);
    setFocusedOfferId(null);
    setScreen("offerQuantity");
  };

  const handleAdminLogin = () => {
    const normalizedManagementPhone = username.replace(/\D/g, "").replace(/^963/, "").replace(/^0/, "");
    const managementPhone = `+963${normalizedManagementPhone}`;
    if (secretRole === "partner") {
      partnerLogin.mutate({ phone: managementPhone, password });
      return;
    }
    if (isStaticDemo) {
      if (secretRole !== "owner") {
        toast.error("لوحة المشرف غير مفعّلة في النسخة التجريبية المحلية.");
        return;
      }
      if (password !== DEMO_OWNER_PIN) {
        toast.error("رمز المالك غير صحيح.");
        return;
      }
      setSecretOpen(false);
      toast.success("تم فتح لوحة المالك التجريبية.");
      setLocation("/admin");
      return;
    }
    if (secretRole === "owner") adminLogin.mutate({ role: "owner", phone: managementPhone, password });
    else adminLogin.mutate({ role: "supervisor", phone: managementPhone, password });
  };

    if (!customerAuthReady) return <main className="customer-auth-loading" dir="rtl"><img src="/assets/lahza-logo.svg" alt="لحظة" /><span>جارٍ تجهيز لحظتك...</span></main>;
  const hasStaffSession = Boolean(adminSessionQuery.data?.role || partnerSessionQuery.data);
  const handleStaffLogin = (phone: string, role: "owner" | "supervisor" | "partner" | "driver", staffPassword: string) => {
    if (role === "driver") { driverLogin.mutate({ phone, password: staffPassword }); return; }
    if (role === "partner") partnerLogin.mutate({ phone, password: staffPassword });
    else adminLogin.mutate({ role, phone, password: staffPassword });
  };
  if (driverSessionQuery.data) return <DriverDashboard session={driverSessionQuery.data} onLogout={() => driverLogout.mutate()} />;
  if (!customerAuth && !hasStaffSession) return <CustomerAuthScreen onAuthenticated={completeCustomerAuth} onStaffLogin={handleStaffLogin} />;
  if (customerAuth?.mode === "guest" && !selectedCity) return <CitySelectionGate onSelect={city => { window.sessionStorage.setItem("lahza_selected_city", city); setSelectedCity(city); void utils.invalidate(); }} />;

  return (
    <main dir="rtl" className="lahza-app-shell min-h-screen text-slate-950" onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}>
      <div className={`pull-refresh-indicator ${pullDistance > 0 || refreshing ? "pull-refresh-indicator-visible" : ""}`} style={{ transform: `translate(-50%, ${refreshing ? 12 : Math.min(62, pullDistance * .72) - 44}px)` }} role="status" aria-live="polite"><span className={refreshing ? "pull-refresh-spinner" : ""}><ArrowLeft className="h-4 w-4 -rotate-90" /></span><small>{refreshing ? "جارٍ التحديث" : pullDistance >= 72 ? "اترك للتحديث" : "اسحب للتحديث"}</small></div>
      <div className="top-action-cluster" dir="ltr"><PersistentCartButton onCart={openCart} cartCount={cart.length} /><button type="button" className="persistent-notifications-button" onClick={() => setNotificationsOpen(true)} aria-label="فتح الإشعارات"><BellRing className="h-5 w-5" />{((notificationsQuery.data ?? []).filter(notification => notification.unread).length + (orderNotificationsQuery.data ?? []).length) > 0 ? <b>{(notificationsQuery.data ?? []).filter(notification => notification.unread).length + (orderNotificationsQuery.data ?? []).length}</b> : null}</button></div>
      {screen === "home" ? <Header onSearch={() => setSearchOpen(true)} onExplore={() => setServiceDirectoryOpen(true)} onGateway={() => { setGatewayMode(true); setScreen("stores"); }} searchPlaceholder={searchPlaceholder} city={selectedCity ?? "manbij"} /> : null}
      {screen === "home" && !isStaticDemo && (notificationsQuery.data ?? []).some(notification => notification.unread) ? <section className="app-shell mt-3"><div className="rounded-3xl border border-orange-200 bg-gradient-to-l from-orange-50 via-white to-amber-50 p-4 shadow-[0_12px_30px_rgba(232,105,38,0.12)]"><div className="mb-3 flex items-center gap-2 text-[#63301b]"><span className="grid h-9 w-9 place-items-center rounded-xl bg-[#ff7a33] text-white"><BellRing className="h-4 w-4" /></span><div className="min-w-0 flex-1"><strong className="block text-sm font-black">تنبيهات لحظة</strong><small className="text-[11px] text-[#a9471b]">عروض وأخبار جديدة لك</small></div>{notificationPermission !== "granted" && "Notification" in window ? <button type="button" onClick={enableCustomerNotifications} className="rounded-xl bg-[#63301b] px-3 py-2 text-[11px] font-black text-white transition hover:bg-[#4a2618]">تفعيل</button> : null}</div><div className="space-y-2">{(notificationsQuery.data ?? []).filter(notification => notification.unread).slice(0, 3).map(notification => <button key={notification.id} type="button" onClick={() => { markNotificationRead.mutate({ deviceId, campaignId: notification.id }); if (notification.targetPath === "/offers") setScreen("offers"); }} className="w-full rounded-2xl border border-orange-100 bg-white/85 p-3 text-right transition hover:border-orange-300 hover:shadow-sm"><span className="flex items-start justify-between gap-3"><span className="min-w-0"><strong className="block text-sm text-[#4a2618]">{notification.title}</strong><small className="mt-1 block leading-5 text-slate-600">{notification.body}</small></span><span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#ff6b2d]" aria-label="إشعار جديد" /></span></button>)}</div></div></section> : null}
      {screen === "home" && (orderNotificationsQuery.data ?? []).length ? <section className="app-shell mt-3"><div className="rounded-3xl border border-teal-200 bg-teal-50 p-4"><div className="mb-3 flex items-center gap-2 text-teal-900"><span className="grid h-9 w-9 place-items-center rounded-xl bg-teal-600 text-white"><BellRing className="h-4 w-4" /></span><div><strong className="block text-sm font-black">إشعارات طلباتك</strong><small className="text-[11px]">تحديثات جديدة من فريق لحظة</small></div></div><div className="space-y-2">{(orderNotificationsQuery.data ?? []).slice(0, 3).map(notification => <button key={notification.id} type="button" onClick={() => markOrderNotificationRead.mutate({ id: notification.id, customerPhone: orderNotificationPhone })} className="w-full rounded-2xl border border-teal-100 bg-white p-3 text-right"><strong className="block text-sm text-[#4a2618]">{notification.title}</strong><small className="mt-1 block leading-5 text-slate-600">{notification.body}</small></button>)}</div></div></section> : null}

      <Dialog open={notificationsOpen} onOpenChange={setNotificationsOpen}><DialogContent dir="rtl" className="notification-dialog"><DialogHeader><DialogTitle className="flex items-center gap-2 text-right"><BellRing className="h-5 w-5 text-[#00666b]" /> إشعارات لحظة</DialogTitle><DialogDescription className="text-right">العروض وتحديثات حالة طلباتك في مكان واحد.</DialogDescription></DialogHeader><div className="notification-dialog-list">{(notificationsQuery.data ?? []).filter(notification => notification.unread).map(notification => <button key={`campaign-${notification.id}`} type="button" className="notification-dialog-item" onClick={() => { markNotificationRead.mutate({ deviceId, campaignId: notification.id }); if (notification.targetPath === "/offers") setScreen("offers"); setNotificationsOpen(false); }}><span className="notification-dialog-icon notification-dialog-icon-orange"><BellRing className="h-4 w-4" /></span><span><strong>{notification.title}</strong><small>{notification.body}</small></span></button>)}{(orderNotificationsQuery.data ?? []).map(notification => <button key={`order-${notification.id}`} type="button" className="notification-dialog-item" onClick={() => { markOrderNotificationRead.mutate({ id: notification.id, customerPhone: orderNotificationPhone }); setNotificationsOpen(false); }}><span className="notification-dialog-icon"><PackageCheck className="h-4 w-4" /></span><span><strong>{notification.title}</strong><small>{notification.body}</small></span></button>)}{!(notificationsQuery.data ?? []).some(notification => notification.unread) && !(orderNotificationsQuery.data ?? []).length ? <div className="notification-dialog-empty"><BellRing className="h-7 w-7" /><span>لا توجد إشعارات جديدة حالياً.</span></div> : null}</div></DialogContent></Dialog>
      <ServiceDirectoryDialog open={serviceDirectoryOpen} onOpenChange={setServiceDirectoryOpen} onDelivery={openDeliveryService} onWosselLi={openWosselLiService} onTaxi={openTaxiService} />
      <Dialog open={Boolean(selectedGalleryOffer)} onOpenChange={open => !open && setSelectedGalleryOffer(null)}><DialogContent showCloseButton={false} dir="rtl" className="w-[calc(100%-1.5rem)] max-w-lg overflow-hidden rounded-3xl border-0 bg-white p-0 shadow-2xl">{selectedGalleryOffer ? <><DialogClose aria-label="إغلاق العرض" className="absolute right-4 top-4 z-10 grid h-12 w-12 place-items-center rounded-full border border-white/70 bg-slate-950/50 text-white shadow-lg backdrop-blur-sm transition hover:scale-105 hover:bg-slate-950/70 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2"><X className="h-7 w-7" strokeWidth={3} /><span className="sr-only">إغلاق العرض</span></DialogClose>{selectedGalleryOffer.imageUrl ? <img src={selectedGalleryOffer.imageUrl} alt={`عرض ${selectedGalleryOffer.name}`} className="max-h-[52vh] w-full object-cover" /> : <div className="grid h-52 place-items-center bg-gradient-to-br from-red-600 to-orange-500 text-white"><BadgePercent className="h-14 w-14" /></div>}<div className="p-6"><DialogHeader><DialogTitle className="text-right text-xl text-[#4a2618]">{selectedGalleryOffer.name}</DialogTitle><DialogDescription className="text-right text-sm font-bold text-red-600">{selectedGalleryOffer.partnerName}</DialogDescription></DialogHeader><p className="mt-4 text-sm leading-7 text-slate-600">انتقل إلى قسم العروض لرؤية تفاصيل العرض والطلب من المتجر.</p><Button onClick={openFeaturedOffers} className="mt-5 w-full rounded-2xl bg-red-600 py-6 text-base hover:bg-red-700"><ShoppingBasket className="h-5 w-5" /> اطلبه الآن</Button></div></> : null}</DialogContent></Dialog>

      <Dialog open={searchOpen} onOpenChange={open => { setSearchOpen(open); if (!open) setSearchText(""); }}><DialogContent dir="rtl" className="w-[calc(100%-1.5rem)] max-w-lg rounded-3xl bg-white p-5"><DialogHeader><DialogTitle className="flex items-center gap-2 text-right text-xl text-[#4a2618]"><Search className="h-5 w-5 text-red-600" /> البحث عن منتج</DialogTitle><DialogDescription className="text-right">اكتب اسم المنتج أو المتجر، وستظهر لك الأسعار وحالة التوفر.</DialogDescription></DialogHeader><div className="mt-3"><Label htmlFor="product-search">اسم المنتج أو المتجر</Label><Input id="product-search" autoFocus value={searchText} onChange={event => setSearchText(event.target.value)} placeholder="مثال: فروج، عدس، حلويات..." className="mt-2 h-12 border-slate-200 bg-white text-base shadow-sm" /></div><div className="mt-4 max-h-[52vh] space-y-2 overflow-y-auto pr-1">{normalizedSearchText.length < 2 ? <div className="rounded-2xl bg-slate-50 p-5 text-center text-sm text-slate-500">اكتب حرفين على الأقل لبدء البحث.</div> : productSearchQuery.isLoading ? <div className="rounded-2xl bg-slate-50 p-5 text-center text-sm text-slate-500">جارٍ البحث عن المنتجات...</div> : productSearchQuery.data?.length ? productSearchQuery.data.map(result => <button key={result.id} type="button" onClick={() => openSearchResult(result as ProductSearchResult)} className="w-full rounded-2xl border border-slate-100 bg-white p-4 text-right shadow-sm transition hover:border-rose-200 hover:bg-rose-50 active:scale-[0.99]"><span className="flex items-start justify-between gap-3"><span className="min-w-0"><strong className="block truncate text-base text-[#4a2618]">{result.name}</strong><small className="mt-1 block truncate text-xs font-bold text-slate-500">من متجر: {result.storeName}</small></span><span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${result.available ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>{result.available ? "متاح" : "غير متاح"}</span></span><span className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm"><strong className="text-red-600">{result.price > 0 ? `سعر تقديري: ${formatNewSyp(result.price)}` : "السعر عند التأكيد"}</strong><small className={result.storeOpen ? "text-slate-500" : "font-bold text-amber-700"}>{result.storeOpen ? "فتح صفحة المتجر" : "المتجر مغلق حالياً"}</small></span></button>) : <div className="rounded-2xl bg-slate-50 p-5 text-center text-sm text-slate-500">لم نجد منتجات أو متاجر مطابقة. يمكنك استخدام «لم تجد ما تريد؟» لطلب المنتج من الإدارة.</div>}</div></DialogContent></Dialog>
      <SupportContactsDialog open={supportOpen} onOpenChange={setSupportOpen} contacts={supportContacts} />
      <AboutLahzaDialog open={aboutOpen} onOpenChange={setAboutOpen} />
      <CustomerAuthRequiredDialog open={customerAuthRequiredOpen} onContinue={() => { setCustomerAuthRequiredOpen(false); setCustomerAuth(null); }} onCancel={() => setCustomerAuthRequiredOpen(false)} />
      

      <div key={screen === "checkout" ? `checkout-${checkoutStep}` : screen} className={`screen-transition ${screen === "home" ? "screen-transition-home" : "screen-transition-internal"}`}>
      {screen === "home" ? (
        <>
          <button type="button" className="wossel-li-callout" onClick={() => { setCheckoutMode("wossel_li"); setScreen("checkout"); }}><span className="wossel-li-callout-copy">عندك غرض بدك نوصلك ياه لبيتك؟</span><span className="wossel-li-callout-action"><PackagePlus className="h-5 w-5" /><strong>وصّل لي</strong></span></button>
          <section className="app-shell pb-10 home-discover-section">
            <div className="home-section-heading"><div><h2 className="section-title">اكتشف ما تحتاجه</h2></div><button type="button" onClick={() => setScreen("delivery")}>عرض الكل <ChevronLeft className="h-4 w-4" /></button></div>
            <div className="home-category-row" dir="rtl" aria-label="أقسام لحظة">
              {homeDiscoverCategories.map(item => <button key={item.key} type="button" className="home-category-card" onClick={() => { if (!item.category) { setScreen("delivery"); return; } setSelectedStore(null); setSelectedProduct(null); setActiveCustomCategory(null); setActiveCategory(item.category); setScreen("stores"); }}><span className="home-category-emoji" aria-hidden="true">{item.category && categoryImageByKey[item.category] ? <img src={categoryImageByKey[item.category]} alt="" loading="lazy" /> : item.icon}</span><span>{item.title}</span></button>)}
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
                const image = item.custom ? undefined : categoryImageByKey[item.category];
                const count = cart.filter(line => line.category === item.category).length;
                const color = item.custom ? "from-slate-100 to-rose-50 text-[#7a3b1d]" : categoryColors[item.category];
                return <button key={item.key} onClick={() => { setSelectedStore(null); setSelectedProduct(null); setActiveCustomCategory(item.custom); setActiveCategory(item.category); setScreen("stores"); }} className={`category-card ${activeCategory === item.category && (item.custom?.id ? activeCustomCategory?.id === item.custom.id : !activeCustomCategory) ? "category-card-active" : ""}`}>
                  <span className={`category-icon bg-gradient-to-br ${color}`}>{image ? <img src={image} alt="" loading="lazy" /> : <Icon className="h-5 w-5" />}</span>
                  <span className="category-card-copy"><span>{item.title}</span><small>{item.subtitle}</small></span>
                  {count > 0 ? <span className="category-badge">{count}</span> : <Plus className="h-4 w-4 text-slate-300" />}
                </button>;
              })}
            </div>
            <button type="button" onClick={() => { if (customerAuth?.mode !== "customer") { setCustomerAuthRequiredOpen(true); return; } setMissingProductOpen(true); }} className="mt-5 flex w-full items-center gap-3 rounded-2xl border border-dashed border-rose-300 bg-rose-50/70 px-4 py-4 text-right text-[#4a2618] transition hover:bg-rose-100"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#63301b] text-white"><CircleHelp className="h-5 w-5" /></span><span className="flex min-w-0 flex-1 flex-col gap-1"><strong className="text-sm font-black">لم تجد ما تريد؟</strong><small className="text-xs font-medium text-slate-600">اطلب منتجاً غير موجود وسنبحث عن متجر يوفره.</small></span><ChevronLeft className="h-5 w-5" /></button>
          </section>
        </>
      ) : null}

      {screen === "stores" && (gatewayMode || activeCategory) ? <StoresScreen category={gatewayMode ? "other" : activeCategory!} categoryTitle={gatewayMode ? "طلبات منبج" : activeCustomCategory?.title} stores={gatewayMode ? gatewayStores : categoryStores} loading={gatewayMode ? gatewayStoresQuery.isLoading && !isStaticDemo : categoryStoresQuery.isLoading && !isStaticDemo} onBack={() => { setScreen(gatewayMode ? "home" : "delivery"); setGatewayMode(false); setActiveCategory(null); setActiveCustomCategory(null); }} onChoose={store => { if (!isStaticDemo) trackStoreVisit.mutate({ storeId: store.id, source: "direct" }); setSelectedStore(store); window.scrollTo({ top: 0, behavior: "smooth" }); setScreen("store"); }} /> : null}

      <Dialog open={missingProductOpen} onOpenChange={setMissingProductOpen}><DialogContent dir="rtl" className="w-[calc(100%-1.5rem)] max-w-md rounded-3xl bg-white"><DialogHeader><DialogTitle className="text-right text-xl text-[#4a2618]">اطلب منتجاً غير موجود</DialogTitle><DialogDescription className="text-right">اكتب ما تحتاجه وسيتابع فريق لحظة إمكانية توفيره أو إضافة متجر مناسب.</DialogDescription></DialogHeader><div className="grid gap-3 rounded-2xl bg-slate-50 p-4"><p className="rounded-xl bg-white px-3 py-2 text-xs font-bold leading-6 text-slate-600">سيتم استخدام اسمك ورقم هاتفك المحفوظين في حسابك تلقائياً.</p><div><Label>اسم المنتج المطلوب</Label><Input className="mt-1 border-slate-200 bg-white shadow-sm" value={missingProductName} onChange={event => setMissingProductName(event.target.value)} placeholder="مثال: حقيبة مدرسية للصف الخامس" /></div><div><Label>تفاصيل إضافية (اختياري)</Label><Textarea className="mt-1 border-slate-200 bg-white shadow-sm" value={missingProductNotes} onChange={event => setMissingProductNotes(event.target.value)} placeholder="اللون أو المقاس أو العلامة التجارية" /></div><Button disabled={createMissingProductRequest.isPending || missingProductName.trim().length < 2 || !customerAuth?.phone || !customerAuth.name} onClick={() => { if (!customerAuth?.phone || !customerAuth.name) return; createMissingProductRequest.mutate({ customerName: customerAuth.name.trim(), customerPhone: customerAuth.phone, productName: missingProductName.trim(), notes: missingProductNotes.trim() || undefined }); }} className="mt-1 rounded-2xl bg-red-600 py-6 hover:bg-red-700">{createMissingProductRequest.isPending ? "جارٍ الإرسال..." : "إرسال الطلب"}</Button></div></DialogContent></Dialog>
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

      {screen === "driverSearch" && submittedOrder ? <DriverSearchScreen orderId={submittedOrder.id} onExit={goHome} /> : null}
      {screen === "account" && customerAuth ? <CustomerAccountScreen session={customerAuth} orders={(customerOrderHistoryQuery.data ?? []) as CustomerHistoryOrder[]} onBack={goHome} onLogout={logoutCustomer} onPhoneSubmit={newPhone => { if (customerAuth.mode === "customer" && customerAuth.phone) updateCustomerPhone.mutate({ currentPhone: customerAuth.phone, newPhone }); }} savingPhone={updateCustomerPhone.isPending} onOpenOrders={() => setScreen("customerOrders")}  /> : null}
      {screen === "customerOrders" && customerAuth ? <CustomerOrdersScreen orders={(customerOrderHistoryQuery.data ?? []) as CustomerHistoryOrder[]} onBack={() => setScreen("account")} /> : null}

      {screen === "checkout" ? (
        <>
          <PageHeading eyebrow={checkoutMode === "delivery" ? `إتمام الطلب · الخطوة ${checkoutStep} من 3` : checkoutMode === "wossel_li" ? "خدمة وصّل لي" : "طلب سيارة"} title={checkoutMode === "delivery" ? checkoutStep === 1 ? "ملخص طلبك" : checkoutStep === 2 ? "بيانات التوصيل" : "راجع واطلب الآن" : checkoutMode === "wossel_li" ? "أرسل غرضك" : "تأكيد طلب السيارة"} detail={checkoutMode === "delivery" ? checkoutStep === 1 ? "تحقق من السلة وطبّق رمز خصم أو إحالة إن وجد." : checkoutStep === 2 ? "أدخل بيانات التواصل وأكّد موقعك عبر زر تحديد موقعي. العنوان اليدوي اختياري." : "راجع كل تفاصيل طلبك واختر طريقة الدفع ثم أرسله." : checkoutMode === "wossel_li" ? "أدخل بيانات الاستلام والتسليم والغرض المطلوب نقله." : "أدخل بيانات التواصل وحدد مسار السيارة ثم أرسل طلبك."} onBack={() => checkoutMode === "delivery" && checkoutStep > 1 ? setCheckoutStep(step => (step - 1) as 1 | 2 | 3) : setScreen(checkoutMode === "delivery" ? "delivery" : checkoutMode === "wossel_li" ? "home" : "taxi")} />
          {checkoutMode === "delivery" ? <section className="app-shell pb-1"><div className="checkout-flow checkout-flow-steps" aria-label="مراحل تأكيد الطلب"><button type="button" onClick={() => setCheckoutStep(1)} className={checkoutStep === 1 ? "checkout-flow-active" : ""}><b>1</b> الملخص</button><button type="button" onClick={() => checkoutStep > 1 && setCheckoutStep(2)} className={checkoutStep === 2 ? "checkout-flow-active" : ""}><b>2</b> التوصيل</button><button type="button" disabled={checkoutStep < 3} onClick={() => checkoutStep === 3 && setCheckoutStep(3)} className={checkoutStep === 3 ? "checkout-flow-active" : ""}><b>3</b> التأكيد</button></div></section> : null}
          {checkoutMode === "delivery" && checkoutStep === 1 ? <section className="app-shell space-y-5 pb-10"><div className="checkout-card checkout-cart-card"><div className="checkout-card-title"><ClipboardList className="h-5 w-5 text-[#f26d31]" /><span>ملخص الطلب</span></div><CartPreview cart={cart} removeLine={removeLine} updateQuantity={updateLineQuantity} total={total} hasPharmacy={hasPharmacy} deliveryFeeNewSyp={cartDeliveryFeeNewSyp} deliveryDistanceKm={billableDeliveryKm} routeDistanceKm={deliveryDistanceMeters / 1000} deliveryPricePerKm={deliveryPricePerKm} deliveryArea="منبج" grandTotalNewSyp={cartGrandTotalNewSyp} deliveryQuoteReady={Boolean(deliveryQuoteData)} onContinueShopping={() => setScreen("delivery")} /></div><div className="checkout-card promotion-card"><div className="checkout-card-title"><BadgePercent className="h-5 w-5 text-[#f26d31]" /><span>خصم على طلبك</span></div><div className="promotion-help"><button type="button" onClick={() => setPromotionInfo("discount")} className="text-right"><BadgePercent className="h-4 w-4" /><div><strong>رمز الخصم <CircleHelp className="mr-1 inline h-4 w-4" /></strong><span>رمز تقدمه لحظة يمنحك خصماً على الطلب.</span></div></button><button type="button" onClick={() => setPromotionInfo("referral")} className="text-right"><Share2 className="h-4 w-4" /><div><strong>رمز الإحالة <CircleHelp className="mr-1 inline h-4 w-4" /></strong><span>رمز يرسله لك عميل لحظة. استخدم رمزاً واحداً فقط.</span></div></button></div><div className="promotion-input-row"><div><Label htmlFor="discountCode">رمز الخصم</Label><Input id="discountCode" value={discountCode} onChange={event => { setDiscountCode(event.target.value.toUpperCase()); setDiscountPreview(null); }} placeholder="مثال: LAHZA10" dir="ltr" /></div><Button type="button" variant="outline" onClick={() => void applyPromotion("discount")} disabled={previewPromotion.isPending || !discountCode.trim()} className="promotion-verify-button">{previewPromotion.isPending ? "جارٍ التحقق" : "تحقق"}</Button></div><div className="promotion-input-row"><div><Label htmlFor="referralCode">رمز الإحالة</Label><Input id="referralCode" value={referralCode} onChange={event => { setReferralCode(event.target.value.toUpperCase()); setReferralPreview(null); }} placeholder="مثال: LHZ-AB12" dir="ltr" /></div><Button type="button" variant="outline" onClick={() => void applyPromotion("referral")} disabled={previewPromotion.isPending || !referralCode.trim()} className="promotion-verify-button">{previewPromotion.isPending ? "جارٍ التحقق" : "تحقق"}</Button></div>{activePromotion ? <div className="promotion-applied"><span>تم تطبيق {activePromotion.kind === "discount" ? "رمز الخصم" : "رمز الإحالة"} {activePromotion.code} بنسبة {activePromotion.percent}%</span><strong>- {formatNewSyp(toNewSyp(activePromotion.discountAmount))}</strong></div> : null}</div><Dialog open={promotionInfo !== null} onOpenChange={open => { if (!open) setPromotionInfo(null); }}><DialogContent dir="rtl" className="border-teal-200 bg-teal-50 text-teal-950 shadow-2xl"><DialogHeader><DialogTitle className="text-teal-950">{promotionInfo === "referral" ? "ما هو رمز الإحالة؟" : "ما هو رمز الخصم؟"}</DialogTitle><DialogDescription className="text-teal-900">{promotionInfo === "referral" ? "رمز الإحالة هو رمز تنشئه من صفحة حسابك ثم ترسله إلى صديقك ليضعه في طلبه. عند استخدام الرمز وإكمال الطلب، تستفيد أنت من نقطة إضافية." : "رمز الخصم هو رمز خاص بتطبيق لحظة. عند وضعه في طلبك تحصل على خصومات على قيمة الطلب ورسوم التوصيل، بحسب شروط الرمز وصلاحيته."}</DialogDescription></DialogHeader><DialogClose asChild><Button type="button" className="mt-2 rounded-xl bg-teal-700 text-white hover:bg-teal-800">فهمت</Button></DialogClose></DialogContent></Dialog><div className="mt-2 text-center text-xs font-bold text-slate-500">اضغط على أيقونة التعريف لمعرفة المزيد عن الرمز.</div>{remainingDeliveryAmountNewSyp(discountedCartTotal) > 0 ? <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-center text-sm font-bold leading-6 text-amber-900">الحد الأدنى بعد الخصم هو {formatNewSyp(minimumDeliveryOrderSyp)}. أضف منتجات بقيمة {formatNewSyp(remainingDeliveryAmountNewSyp(discountedCartTotal))} أو أكثر.</p> : null}<button disabled={remainingDeliveryAmountNewSyp(discountedCartTotal) > 0} onClick={continueDeliveryCheckout} className="primary-full-button">التالي إلى بيانات التوصيل <ChevronLeft className="h-5 w-5" /></button></section> : null}
          {checkoutMode === "delivery" && checkoutStep === 2 ? <section className="app-shell space-y-5 pb-10"><div className="delivery-estimate-card"><span className="delivery-estimate-icon"><Bike className="h-5 w-5" /></span><div><strong>وقت وصول تقديري</strong><p>يصل طلبك عادة خلال <b>{deliveryEta}</b> بعد تأكيد المتجر والموقع.</p></div><span className="delivery-estimate-status">توصيل لحظة</span></div><div className="checkout-card space-y-4"><div className="checkout-card-title"><UserRound className="h-5 w-5 text-[#f26d31]" /><span>بيانات التواصل</span></div><div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><div><Label htmlFor="customerName">اسم المستلم</Label><Input id="customerName" value={checkoutName} onChange={event => setCheckoutName(event.target.value)} placeholder="اكتب الاسم" /></div><div><Label htmlFor="customerPhone">رقم الهاتف</Label><div className="phone-entry" dir="ltr"><Input id="customerPhone" dir="ltr" value={checkoutCustomerPhone} readOnly={Boolean(customerAuth?.phone)} onChange={event => setCheckoutPhone(event.target.value)} placeholder="+رمز الدولة ورقم الهاتف" /></div><small className="phone-help">تم تثبيت رقمك الدولي من حسابك.</small></div></div><div className="delivery-location-card"><div className="delivery-field-heading"><span><LocateFixed className="h-4 w-4" /> العنوان وموقع التوصيل</span><small>الموقع مطلوب · العنوان اختياري</small></div><Label htmlFor="deliveryAddress">العنوان التفصيلي <span className="text-slate-400">(اختياري)</span></Label><Textarea id="deliveryAddress" value={deliveryAddress} onChange={event => setDeliveryAddress(event.target.value)} placeholder="مثال: منبج، حي السرب، قرب دوار الساعة، بناء 12" /><div className="location-actions"><button type="button" onClick={locateCustomer} disabled={locating}><LocateFixed className="h-4 w-4" />{locating ? "جارٍ طلب إذن الموقع..." : locationVerified ? "تم تأكيد موقعك" : "السماح بالوصول للموقع"}</button></div>{locationVerified ? <p className="verified-location">تم تأكيد موقعك عبر GPS، ويمكنك الآن متابعة الطلب.</p> : <p className="location-required-note">ستظهر نافذة إذن من هاتفك عند الضغط على الزر. وافق عليها لتأكيد موقع التوصيل.</p>}</div></div><button onClick={continueDeliveryCheckout} className="primary-full-button">التالي إلى مراجعة الطلب <ChevronLeft className="h-5 w-5" /></button></section> : null}
          {checkoutMode === "delivery" && checkoutStep === 3 ? <section className="app-shell space-y-5 pb-10"><div className="delivery-estimate-card"><span className="delivery-estimate-icon"><Bike className="h-5 w-5" /></span><div><strong>وقت وصول تقديري</strong><p>سيصل طلبك خلال <b>{deliveryEta}</b> إلى {deliveryAddress.trim() || "الموقع المحدد عبر GPS"}.</p></div><span className="delivery-estimate-status">جاهز للإرسال</span></div><div className="checkout-card checkout-cart-card"><div className="checkout-card-title"><ClipboardList className="h-5 w-5 text-[#f26d31]" /><span>مراجعة طلبك</span></div><CartPreview cart={cart} removeLine={removeLine} updateQuantity={updateLineQuantity} total={total} hasPharmacy={hasPharmacy} deliveryFeeNewSyp={cartDeliveryFeeNewSyp} deliveryDistanceKm={billableDeliveryKm} routeDistanceKm={deliveryDistanceMeters / 1000} deliveryPricePerKm={deliveryPricePerKm} deliveryArea="منبج" grandTotalNewSyp={cartGrandTotalNewSyp} deliveryQuoteReady={Boolean(deliveryQuoteData)} onContinueShopping={() => setScreen("delivery")} /><div className="order-review-address"><span><LocateFixed className="h-4 w-4" /> التوصيل إلى</span><strong>{deliveryAddress.trim() || "الموقع المحدد عبر GPS"}</strong><small>{checkoutName} · {checkoutCustomerPhone}</small></div></div><div className="checkout-card"><div className="checkout-card-title"><CreditCard className="h-5 w-5 text-[#f26d31]" /><span>طريقة الدفع</span></div><div className="payment-grid"><button onClick={() => setPayment("sham_cash")} className={payment === "sham_cash" ? "payment-active" : ""}><span className="payment-icon payment-icon-lahza">ش</span><span>شام كاش</span></button><button onClick={() => setPayment("cash")} className={payment === "cash" ? "payment-active" : ""}><HandCoins className="h-5 w-5" /><span>نقداً عند الاستلام</span></button></div></div><div className="checkout-card"><div className="checkout-card-title"><PackagePlus className="h-5 w-5 text-[#f26d31]" /><span>عند عدم توفر أحد المنتجات</span></div><div className="unavailable-choice-grid"><button type="button" onClick={() => setUnavailablePreference("cancel")} className={unavailablePreference === "cancel" ? "unavailable-choice-active" : ""}><span>إلغاء الطلب</span><small>عند عدم توفر أي صنف</small></button><button type="button" onClick={() => setUnavailablePreference("replace")} className={unavailablePreference === "replace" ? "unavailable-choice-active" : ""}><span>بديل من متجر آخر</span><small>بعد أخذ موافقتي</small></button><button type="button" onClick={() => setUnavailablePreference("call")} className={unavailablePreference === "call" ? "unavailable-choice-active" : ""}><span>تواصل معي</span><small>قبل أي تغيير</small></button></div><div className="mt-4"><Label htmlFor="notes">ملاحظات إضافية <span className="text-slate-400">(اختياري)</span></Label><Textarea id="notes" value={notes} onChange={event => setNotes(event.target.value)} placeholder="أي تفاصيل مفيدة للطلب أو للمندوب" /></div></div><SupportHelpCard onOpen={() => setSupportOpen(true)} contactCount={supportContacts.length} /><button disabled={createOrder.isPending || remainingDeliveryAmountNewSyp(discountedCartTotal) > 0} onClick={() => void submitCheckout()} className="primary-full-button">{createOrder.isPending ? "جارٍ إرسال الطلب..." : `اطلب الآن · ${formatNewSyp(cartGrandTotalNewSyp)}`}<ChevronLeft className="h-5 w-5" /></button></section> : null}
          {checkoutMode === "wossel_li" ? <section className="app-shell space-y-5 pb-10"><div className="delivery-estimate-card"><span className="delivery-estimate-icon"><PackagePlus className="h-5 w-5" /></span><div><strong>وصّل لي</strong><p>أرسل غرضاً من مكان إلى مكان. سيحسب السعر من مركز منبج ذهاباً وإياباً.</p></div></div><div className="checkout-card space-y-4 border-r-4 border-amber-500"><div className="checkout-card-title"><span className="grid h-10 w-10 place-items-center rounded-2xl bg-amber-100 text-amber-700"><MapPinCheck className="h-5 w-5" /></span><div><strong>مكان الاستلام</strong><small className="block text-xs font-medium text-slate-500">أين سيستلم المندوب الغرض؟</small></div></div><div><Label>عنوان الاستلام بالتفصيل <span className="text-red-600">(إلزامي)</span></Label><Textarea required value={wosselPickupAddress} onChange={event => setWosselPickupAddress(event.target.value)} placeholder="اكتب عنوان الاستلام: الحي، الشارع، وأقرب معلم" /></div><div><Label>رقم هاتف جهة الاستلام <span className="text-red-600">(إلزامي)</span></Label><div className="phone-entry" dir="ltr"><span className="phone-entry-prefix">+963</span><Input dir="ltr" inputMode="numeric" value={wosselPickupContactPhone.replace(/^\+963/, "")} onChange={event => { const local = event.target.value.replace(/\D/g, "").replace(/^963/, "").replace(/^0/, "").slice(0, 9); setWosselPickupContactPhone(local ? `+963${local}` : ""); }} placeholder="9XXXXXXXX" /></div></div></div><div className="checkout-card space-y-4 border-r-4 border-sky-500"><div className="checkout-card-title"><span className="grid h-10 w-10 place-items-center rounded-2xl bg-sky-100 text-sky-700"><PackageCheck className="h-5 w-5" /></span><div><strong>مكان التسليم</strong><small className="block text-xs font-medium text-slate-500">حدد الموقع من الخريطة بدقة</small></div></div><button type="button" onClick={locateCustomer} disabled={locating} className="location-actions"><LocateFixed className="h-4 w-4" />{locating ? "جارٍ تحديد الموقع..." : "تحديد موقع التسليم على الخريطة"}</button>{customerLocation ? <p className="rounded-xl bg-sky-50 px-3 py-2 text-xs font-bold text-sky-800">تم تحديد موقع التسليم عبر GPS</p> : <p className="text-xs font-medium text-slate-500">العنوان اليدوي غير مطلوب هنا؛ استخدم زر الخريطة.</p>}</div><div className="checkout-card space-y-4"><div className="checkout-card-title"><PackagePlus className="h-5 w-5 text-[#f26d31]" /><span>تفاصيل الغرض</span></div><div><Label>نوع الغرض</Label><Textarea value={wosselItemDescription} onChange={event => setWosselItemDescription(event.target.value)} placeholder="اكتب نوع الغرض بالتفصيل" /></div><div><Label>الوزن بالكيلوغرام (اختياري)</Label><div className="flex items-center gap-2" dir="ltr"><Input type="number" min="0" step="0.1" inputMode="decimal" value={wosselItemWeight} onChange={event => setWosselItemWeight(event.target.value.replace(/[^0-9.]/g, ""))} placeholder="مثال: 3" /><span className="rounded-xl bg-slate-100 px-4 py-2.5 font-black text-slate-700">كغ</span></div></div></div><div className="checkout-card space-y-4"><div className="checkout-card-title"><UserRound className="h-5 w-5 text-[#f26d31]" /><span>بيانات العميل</span></div><Input value={checkoutName} onChange={event => setCheckoutName(event.target.value)} placeholder="الاسم" /><Input dir="ltr" value={checkoutCustomerPhone} readOnly placeholder="+9639xxxxxxxx" /><div className="payment-grid"><button onClick={() => setPayment("cash")} className={payment === "cash" ? "payment-active" : ""}><HandCoins className="h-5 w-5" /><span>نقداً عند التسليم</span></button><button onClick={() => setPayment("sham_cash")} className={payment === "sham_cash" ? "payment-active" : ""}><span className="payment-icon payment-icon-lahza">ش</span><span>شام كاش</span></button></div></div><button disabled={createOrder.isPending} onClick={() => void submitCheckout()} className="primary-full-button">{createOrder.isPending ? "جارٍ حساب السعر وإرسال الطلب..." : "إتمام الطلب وحساب السعر"}<ChevronLeft className="h-5 w-5" /></button></section> : null}
          {checkoutMode === "taxi" ? <section className="app-shell space-y-5 pb-10"><div className="checkout-card"><div className="checkout-card-title"><ClipboardList className="h-5 w-5 text-[#f26d31]" /><span>تفاصيل الرحلة</span></div><div className="taxi-summary"><CarFront className="h-9 w-9 text-[#63301b]" /><div><strong>{taxiType === "van" ? "سيارة فان" : "تاكسي عادي"}</strong><span>{pickup || "موقع الانطلاق"} <ChevronLeft className="inline h-3 w-3" /> {destination || "الوجهة"}</span></div></div></div><div className="checkout-card space-y-4"><div className="checkout-card-title"><UserRound className="h-5 w-5 text-[#f26d31]" /><span>بيانات التواصل</span></div><div><Label htmlFor="customerName">الاسم</Label><Input id="customerName" value={checkoutName} onChange={event => setCheckoutName(event.target.value)} placeholder="اكتب الاسم" /></div><div><Label htmlFor="customerPhone">رقم الهاتف</Label><div className="phone-entry" dir="ltr"><Input id="customerPhone" dir="ltr" value={checkoutCustomerPhone} readOnly={Boolean(customerAuth?.phone)} onChange={event => setCheckoutPhone(event.target.value)} placeholder="+رمز الدولة ورقم الهاتف" /></div></div><div><Label htmlFor="customerLocation">موقعك</Label><Input id="customerLocation" value={customerLocation} readOnly placeholder="استخدم زر تحديد موقعي" /><div className="location-actions"><button type="button" onClick={locateCustomer} disabled={locating}><LocateFixed className="h-4 w-4" />{locating ? "جارٍ التحديد..." : "تحديد موقعي"}</button></div></div></div><div className="checkout-card"><div className="checkout-card-title"><CreditCard className="h-5 w-5 text-[#f26d31]" /><span>طريقة الدفع</span></div><div className="payment-grid"><button onClick={() => setPayment("sham_cash")} className={payment === "sham_cash" ? "payment-active" : ""}><span className="payment-icon payment-icon-lahza">ش</span><span>شام كاش</span></button><button onClick={() => setPayment("cash")} className={payment === "cash" ? "payment-active" : ""}><HandCoins className="h-5 w-5" /><span>نقداً عند الاستلام</span></button></div></div><SupportHelpCard onOpen={() => setSupportOpen(true)} contactCount={supportContacts.length} /><button disabled={createOrder.isPending} onClick={() => void submitCheckout()} className="primary-full-button">{createOrder.isPending ? "جارٍ إرسال الطلب..." : "تأكيد وإرسال الطلب"}<ChevronLeft className="h-5 w-5" /></button></section> : null}
        </>
      ) : null}

      </div>
      {screen !== "checkout" && screen !== "driverSearch" ? <nav className="home-bottom-nav" aria-label="التنقل الرئيسي"><button type="button" className={screen === "home" ? "home-bottom-nav-active" : ""} onClick={goHome}><LayoutDashboard className="h-5 w-5" /><span>الرئيسية</span></button><button type="button" className={screen === "delivery" || screen === "stores" || screen === "store" ? "home-bottom-nav-active" : ""} onClick={() => setScreen("delivery")}><Store className="h-5 w-5" /><span>المتاجر</span></button><button type="button" className={screen === "offers" || screen === "storeOffers" ? "home-bottom-nav-active" : ""} onClick={() => setScreen("offers")}><BadgePercent className="h-5 w-5" /><span>العروض</span></button><button type="button" className={screen === "wosselLi" ? "home-bottom-nav-active" : ""} onClick={openWosselLiService} aria-label="خدمة وصّل لي"><PackageCheck className="h-5 w-5" /><span>وصّل لي</span></button><button type="button" className={screen === "taxi" ? "home-bottom-nav-active" : ""} onClick={() => setScreen("taxi")} aria-label="طلب سيارة أجرة"><CarFront className="h-5 w-5" /><span className="home-bottom-nav-taxi-label">طلب سيارة أجرة</span></button><button type="button" className={screen === "account" ? "home-bottom-nav-active" : ""} onClick={openAccount} aria-label="فتح حسابي"><UserRound className="h-5 w-5" /><span>حسابي</span></button></nav> : null}
      <footer className="app-shell pb-8 text-center text-xs font-medium tracking-wide text-slate-400" dir="ltr">Designed by Ahmad barho</footer>
    </main>
  );
}

function CustomerAccountScreen({ session, orders, onBack, onLogout, onPhoneSubmit, savingPhone, onOpenOrders }: { session: CustomerAuthSession; orders: CustomerHistoryOrder[]; onBack: () => void; onLogout: () => void; onPhoneSubmit: (phone: string) => void; savingPhone: boolean; onOpenOrders: () => void }) {
  const isGuest = session.mode === "guest";
  const phone = session.phone ?? "";
  const [phoneEditOpen, setPhoneEditOpen] = useState(false);
  const [phoneChangeStep, setPhoneChangeStep] = useState<"phone" | "otp">("phone");
  const [phoneChangeOtp, setPhoneChangeOtp] = useState("");
  const [pendingPhone, setPendingPhone] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const pointsQuery = trpc.lahza.customers.points.balance.useQuery({ phone: phone || "+963900000000" }, { enabled: !isStaticDemo && !isGuest && /^\+[1-9]\d{6,14}$/.test(phone), retry: false });
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
    if (/^\+[1-9]\d{6,14}$/.test(phone)) createReferralCode.mutate({ phone });
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
  return <section className="app-shell account-screen pb-12"><PageHeading eyebrow="حسابي" title={`أهلاً ${session.name || "بك في لحظة"}`} detail="تابع بياناتك ونقاطك ومكافآتك من مكان واحد." onBack={onBack} /><div className="account-hero"><div className="account-avatar"><UserRound className="h-7 w-7" /></div><div className="min-w-0 flex-1"><strong>{session.name || "عميل لحظة"}</strong><span dir="ltr">{phone}</span></div><span className="account-status">حساب عميل</span></div><div className="account-stat-grid"><article><Sparkles className="h-5 w-5" /><strong>{points}</strong><span>نقاطك الحالية</span></article><article><CheckCircle2 className="h-5 w-5" /><strong>{lifetimeEarned}</strong><span>إجمالي النقاط المكتسبة</span></article><article><ShoppingBasket className="h-5 w-5" /><strong>{orders.length ? "متاح" : "—"}</strong><span>آخر طلب</span></article></div><section className="account-card"><div className="account-card-heading"><div><p>سجل الطلبات</p><h2>{orders.length ? `${orders.length} طلب محفوظ` : "لا توجد طلبات بعد"}</h2></div><ClipboardList className="h-6 w-6" /></div>{orders.length ? <div className="space-y-2">{orders.map(order => <div key={order.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-3"><div className="flex items-center justify-between gap-3"><strong className="text-sm text-[#4a2618]">طلب #{order.id}</strong><span className="rounded-full bg-white px-2 py-1 text-[11px] font-bold text-teal-700">{orderStatusLabels[order.status]}</span></div><div className="mt-2 flex items-center justify-between gap-3 text-xs text-slate-500"><span>{order.orderType === "taxi" ? "تاكسي" : "توصيل"} · {new Date(order.createdAt).toLocaleDateString("ar-SY")}</span><strong className="text-[#63301b]">{formatSyp(order.totalAmount)}</strong></div></div>)}</div> : <p className="account-card-note">ستظهر هنا جميع طلباتك حتى بعد تسجيل الخروج والعودة لاحقًا.</p>}</section><section className="account-card"><div className="account-card-heading"><div><p>مكافأة الحسم</p><h2>{remainingForReward ? `تبقى ${remainingForReward} نقاط` : "المكافأة متاحة لك"}</h2></div><BadgePercent className="h-6 w-6" /></div><div className="account-progress"><span style={{ width: `${Math.min(100, points / rewardTarget * 100)}%` }} /></div><div className="account-progress-labels"><span>{points} نقاط</span><span>{rewardTarget} نقاط للحصول على رمز الحسم</span></div>{rewardPercent > 0 ? <p className="account-card-note">يمكنك استخدام المكافأة للحصول على خصم {rewardPercent}% عند استيفاء الشروط.</p> : <p className="account-card-note">اجمع نقاطًا من الطلبات المكتملة والإحالات الناجحة لتحصل على مكافأة الحسم.</p>}</section><section className="account-card"><div className="account-card-heading"><div><p>رمز الإحالة</p><h2>{referralCode || "شارك لحظة مع أصدقائك"}</h2></div><Share2 className="h-6 w-6" /></div><p className="account-card-note">أنشئ رمزًا خاصًا بك وشاركه، وستحصل على نقاط عند اكتمال طلب الإحالة.</p><div className="account-card-actions"><button type="button" onClick={handleCreateReferral} disabled={createReferralCode.isPending} className="account-action-primary"><Share2 className="h-4 w-4" />{createReferralCode.isPending ? "جارٍ الإنشاء..." : referralCode ? "إنشاء ونسخ الرمز" : "إنشاء رمز الإحالة"}</button>{referralCode ? <button type="button" onClick={() => { void navigator.clipboard?.writeText(referralCode); toast.success("تم نسخ رمز الإحالة"); }} className="account-action-secondary">نسخ الرمز</button> : null}</div></section><section className="account-card"><div className="account-card-heading"><div><p>بيانات الحساب</p><h2>رقم الهاتف</h2></div><Phone className="h-6 w-6" /></div><div className="account-phone-row"><span dir="ltr">{phone}</span><button type="button" onClick={() => setPhoneEditOpen(open => !open)} className="account-edit-button"><Pencil className="h-4 w-4" /> تغيير الرقم</button></div>{phoneEditOpen ? <div className="account-phone-edit">{phoneChangeStep === "phone" ? <><Input dir="ltr" inputMode="numeric" value={newPhone} onChange={event => setNewPhone(event.target.value.replace(/\D/g, "").replace(/^963/, "").replace(/^0/, "").slice(0, 9))} placeholder="9XXXXXXXX" /><button type="button" disabled={savingPhone} onClick={submitPhone} className="account-action-primary">إرسال رمز التحقق</button></> : <><div className="account-phone-otp-copy"><span>أدخل رمز OTP لتأكيد الرقم الجديد</span><small dir="ltr">{pendingPhone}</small><Input dir="ltr" inputMode="numeric" maxLength={6} autoFocus value={phoneChangeOtp} onChange={event => setPhoneChangeOtp(event.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="123456" /></div><button type="button" disabled={savingPhone || phoneChangeOtp.length !== 6} onClick={verifyPhoneChange} className="account-action-primary">{savingPhone ? "جارٍ الحفظ..." : "تحقق وحفظ"}</button><button type="button" onClick={() => setPhoneChangeStep("phone")} className="account-action-secondary">تعديل الرقم</button></>}</div> : null}</section><button type="button" onClick={onOpenOrders} className="account-order-button"><ClipboardList className="h-5 w-5" /> طلباتي <ChevronLeft className="h-5 w-5" /></button><button type="button" onClick={onLogout} className="account-logout-button"><LogOut className="h-5 w-5" /> تسجيل الخروج</button></section>;
}


function CustomerOrdersScreen({ orders, onBack }: { orders: CustomerHistoryOrder[]; onBack: () => void }) {
  const [selectedOrder, setSelectedOrder] = useState<CustomerHistoryOrder | null>(null);
  const active = orders.filter(order => ["pending", "confirmed", "preparing", "on_the_way"].includes(order.status));
  const completed = orders.filter(order => order.status === "completed");
  const rejected = orders.filter(order => ["cancelled", "rejected"].includes(order.status));
  const statusLabel = (status: CustomerHistoryOrder["status"]) => status === "completed" ? "مكتمل" : status === "cancelled" ? "ملغى" : status === "rejected" ? "مرفوض" : status === "on_the_way" ? "في الطريق" : status === "preparing" ? "قيد التجهيز" : status === "confirmed" ? "مؤكد" : "غير مكتمل";
  const renderGroup = (title: string, group: CustomerHistoryOrder[], tone: string) => <section className="account-card"><div className="account-card-heading"><div><p>{title}</p><h2>{group.length} طلب</h2></div><ClipboardList className="h-6 w-6" /></div>{group.length ? <div className="space-y-2">{group.map(order => <button type="button" key={order.id} onClick={() => setSelectedOrder(order)} className="w-full rounded-2xl border border-slate-100 bg-slate-50 p-3 text-right transition hover:border-teal-200 hover:bg-teal-50"><div className="flex items-center justify-between gap-3"><strong className="text-sm text-[#4a2618]">طلب #{order.id}</strong><span className={`rounded-full px-2 py-1 text-[11px] font-bold ${tone}`}>{statusLabel(order.status)}</span></div><div className="mt-2 flex items-center justify-between gap-3 text-xs text-slate-500"><span>{new Date(order.createdAt).toLocaleDateString("ar-SY")}</span><strong className="text-[#63301b]">{formatSyp(order.totalAmount)}</strong></div></button>)}</div> : <p className="account-card-note">لا توجد طلبات في هذه الخانة.</p>}</section>;
  return <section className="app-shell account-screen pb-12"><PageHeading eyebrow="حسابي" title="طلباتي" detail="تابع الطلبات الجارية والمكتملة والمرفوضة من مكان واحد." onBack={onBack} />{renderGroup("الطلبات الجارية", active, "bg-blue-50 text-blue-700")}{renderGroup("الطلبات المكتملة", completed, "bg-emerald-50 text-emerald-700")}{renderGroup("الطلبات المرفوضة أو الملغاة", rejected, "bg-red-50 text-red-700")}<Dialog open={selectedOrder !== null} onOpenChange={open => { if (!open) setSelectedOrder(null); }}><DialogContent dir="rtl" className="border-teal-200 bg-teal-50 text-teal-950"><DialogHeader><DialogTitle>تفاصيل الطلب #{selectedOrder?.id}</DialogTitle><DialogDescription className="text-teal-900">{selectedOrder ? `${statusLabel(selectedOrder.status)} · ${new Date(selectedOrder.createdAt).toLocaleString("ar-SY")}` : ""}</DialogDescription></DialogHeader>{selectedOrder ? <div className="space-y-3 text-sm"><div className="rounded-xl bg-white/70 p-3"><strong>الأصناف</strong>{selectedOrder.lines.length ? selectedOrder.lines.map(line => <div key={line.id} className="mt-2 flex justify-between gap-3"><span>{line.itemName} × {line.quantity} {line.unit}</span><b>{formatSyp(line.lineTotal)}</b></div>) : <p className="mt-2 text-slate-600">لا توجد تفاصيل أصناف.</p>}</div><div className="rounded-xl bg-white/70 p-3"><p><b>العميل:</b> {selectedOrder.customerName}</p><p><b>العنوان:</b> {selectedOrder.locationText || "الموقع المحدد عبر GPS"}</p><p><b>الدفع:</b> {selectedOrder.paymentMethod === "sham_cash" ? "شام كاش" : "نقداً عند الاستلام"}</p><p><b>الإجمالي:</b> {formatSyp(selectedOrder.totalAmount)}</p>{selectedOrder.notes ? <p><b>ملاحظات:</b> {selectedOrder.notes}</p> : null}</div></div> : null}</DialogContent></Dialog></section>;
}

function StoresScreen({ category, categoryTitle, stores, loading, onBack, onChoose }: { category: LahzaCategory; categoryTitle?: string; stores: StoreOption[]; loading: boolean; onBack: () => void; onChoose: (store: StoreOption) => void }) {
  const meta = categoryMeta[category];
  const title = categoryTitle ?? meta.title;
  const visual = categoryImageByKey[category];
  return <><PageHeading eyebrow="متاجر القسم" title={`متاجر ${title}`} detail="اختر متجراً لفتح صفحته ومنتجاته في المكان نفسه." onBack={onBack} /><section className="app-shell pb-12">{loading ? <div className="rounded-3xl bg-slate-50 p-6 text-center text-sm text-slate-500">جارٍ تحميل المتاجر...</div> : stores.length ? <div className="store-card-grid">{stores.map(store => <button key={store.id} onClick={() => onChoose(store)} className="store-identity-card"><span className="store-identity-image">{store.imageUrl || visual ? <img src={store.imageUrl || visual} alt="" loading="lazy" /> : <Store className="h-7 w-7" />}</span><span className="store-identity-avatar"><Store className="h-5 w-5" /></span><span className="store-identity-rating" aria-label={`تقييم ${store.ratingStars ?? 3} من 5`}>{"★".repeat(store.ratingStars ?? 3)}{"☆".repeat(5 - (store.ratingStars ?? 3))}</span><span className="store-identity-copy"><strong>{store.name}</strong><small>{title} · منتجات وعروض مختارة</small></span><ChevronLeft className="store-identity-arrow h-5 w-5" /></button>)}</div> : <EmptyStoreList categoryTitle={title} />}</section></>;
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

function CartPreview({ cart, removeLine, updateQuantity, total, hasPharmacy, deliveryFeeNewSyp, deliveryDistanceKm, deliveryPricePerKm, deliveryArea, grandTotalNewSyp, deliveryQuoteReady, routeDistanceKm, onContinueShopping }: { cart: CartLine[]; removeLine: (id: string) => void; updateQuantity: (id: string, quantity: number) => void; total: number; hasPharmacy: boolean; deliveryFeeNewSyp: number; deliveryDistanceKm: number; deliveryPricePerKm: number; deliveryArea: "منبج" | "جرابلس"; grandTotalNewSyp: number; deliveryQuoteReady: boolean; routeDistanceKm: number; onContinueShopping: () => void }) {
  return <div className="cart-preview"><div className="cart-preview-intro"><span className="cart-preview-icon"><ShoppingBasket className="h-5 w-5" /></span><div><strong>سلتك في لحظة</strong><p>{cart.length ? `${cart.length} ${cart.length === 1 ? "صنف" : "أصناف"} جاهزة للطلب` : "سلتك فارغة حالياً"}</p></div><button type="button" onClick={onContinueShopping}>{cart.length ? "إضافة منتجات" : "ابدأ التسوق"}</button></div>{cart.length ? <><div className="cart-lines">{cart.map(item => { const step = item.unit === "جرام" ? 50 : item.unit === "ليتر" ? .1 : 1; return <div key={item.id} className="cart-line"><span className="cart-line-category" aria-hidden="true"><LahzaCategoryIcon category={item.category} className="h-4 w-4" /></span><div className="cart-line-copy"><strong>{item.itemName}</strong><span>{item.unit === "جرام" ? `${item.quantity} غرام` : `${item.quantity} ${item.unit}`}</span><div className="cart-inline-quantity"><button type="button" onClick={() => updateQuantity(item.id, Number((item.quantity - step).toFixed(2)))} aria-label={`إنقاص كمية ${item.itemName}`}><Minus className="h-3.5 w-3.5" /></button><b>{item.quantity}</b><button type="button" onClick={() => updateQuantity(item.id, Number((item.quantity + step).toFixed(2)))} aria-label={`زيادة كمية ${item.itemName}`}><Plus className="h-3.5 w-3.5" /></button></div></div><div className="cart-line-actions">{item.priceKnown ? <strong>{formatSyp(lineTotal(item))}</strong> : <small>السعر عند التأكيد</small>}<button type="button" onClick={() => removeLine(item.id)} aria-label={`حذف ${item.itemName}`}><Trash2 className="h-4 w-4" /></button></div></div>; })}</div>{hasPharmacy ? <p className="pharmacy-note"><Pill className="h-4 w-4" />تتضمن السلة منتجات صحية؛ يؤكدها المتجر قبل التجهيز.</p> : null}<div className="cart-totals"><div className="total-row"><span>إجمالي المنتجات</span><strong>{formatSyp(total)}</strong></div><div className="total-row"><span>مسافة الطريق (OpenRouteService)</span><strong>{deliveryQuoteReady ? `${routeDistanceKm.toFixed(1)} كم` : "بانتظار تحديد الموقع"}</strong></div><div className="total-row"><span>رسوم التوصيل (بعد تحديد الموقع)</span><strong>{deliveryQuoteReady ? formatNewSyp(deliveryFeeNewSyp) : "حدد موقعك لحسابها"}</strong></div><div className="total-row total-row-grand"><span>الإجمالي النهائي</span><strong>{deliveryQuoteReady ? formatNewSyp(grandTotalNewSyp) : "بانتظار تحديد الموقع"}</strong></div></div></> : <div className="cart-empty-state"><ShoppingBasket className="h-8 w-8" /><strong>لا توجد منتجات في السلة</strong><span>اختر ما تحتاجه من أي متجر، وستظهر تفاصيل طلبك هنا مباشرة.</span></div>}</div>;
}

function DriverSearchScreen({ orderId, onExit }: { orderId: number; onExit: () => void }) {
  return <main dir="rtl" className="min-h-[70vh] bg-slate-50 px-4 py-8"><section className="mx-auto flex min-h-[60vh] w-full max-w-md flex-col items-center justify-center rounded-[2rem] border border-rose-100 bg-white p-6 text-center shadow-sm"><div className="grid h-24 w-24 place-items-center rounded-full bg-orange-50 text-[#e95e2a] shadow-inner"><Loader2 className="h-12 w-12 animate-spin" aria-label="جارٍ البحث عن مندوب" /></div><h1 className="mt-7 text-2xl font-black text-[#4a2618]">جارٍ البحث عن مندوب</h1><p className="mt-3 max-w-xs text-sm font-bold leading-7 text-slate-500">سيتم إعلامك بحالة طلبك أولاً بأول.</p><p className="mt-2 text-xs font-bold text-slate-400">رقم الطلب #{orderId}</p><button type="button" onClick={onExit} className="mt-7 rounded-2xl border border-rose-200 bg-white px-6 py-3 text-sm font-black text-[#63301b] transition hover:bg-rose-50">الخروج</button></section></main>;
}

type DriverDashboardSession = { name: string; phone: string; available: boolean; driverPercent: number; completedOrdersTotal: number; assignments: Array<{ orderId: number; assignmentStatus: string; orderStatus: string; customerName: string; locationText: string | null; createdAt: string | Date }>; completedOrders: Array<{ orderId: number; customerName: string; totalAmount: number; deliveryFee: number; driverFee: number; deliveredAt: string | Date | null }> };
function DriverDashboard({ session, onLogout }: { session: DriverDashboardSession; onLogout: () => void }) {
  const driverSessionQuery = trpc.lahza.driverAuth.session.useQuery(undefined, { refetchInterval: 15_000, retry: false });
  const [view, setView] = useState<"active" | "completed">("active");
  const assignments = driverSessionQuery.data?.assignments ?? session.assignments;
  const completedOrders = driverSessionQuery.data?.completedOrders ?? session.completedOrders;
  const driverPercent = driverSessionQuery.data?.driverPercent ?? session.driverPercent;
  const completedOrdersTotal = driverSessionQuery.data?.completedOrdersTotal ?? session.completedOrdersTotal;
  return <main dir="rtl" className="min-h-screen bg-[#fffaf6] px-4 py-8 text-[#4a2618]"><section className="mx-auto max-w-lg space-y-5"><div className="rounded-[2rem] bg-[#63301b] p-6 text-white shadow-xl"><p className="text-sm font-bold text-orange-100">لحظة · بوابة المندوب</p><h1 className="mt-2 text-2xl font-black">مرحباً {session.name}</h1><p className="mt-2 text-sm text-orange-100" dir="ltr">{session.phone}</p><div className="mt-5 rounded-2xl bg-white/10 p-4"><p className="text-xs text-orange-100">جرد عمولتك اليوم</p><div className="mt-2 flex items-end justify-between gap-3"><strong className="text-3xl font-black">{formatSyp(completedOrdersTotal)}</strong><span className="text-sm font-bold text-orange-100">نسبة العمولة {driverPercent}%</span></div></div></div><div className="grid grid-cols-2 gap-3"><button type="button" onClick={() => setView("active")} className={`rounded-2xl px-4 py-3 text-sm font-black ${view === "active" ? "bg-[#63301b] text-white" : "border border-orange-100 bg-white text-slate-500"}`}>الطلبات الحالية</button><button type="button" onClick={() => setView("completed")} className={`rounded-2xl px-4 py-3 text-sm font-black ${view === "completed" ? "bg-emerald-700 text-white" : "border border-orange-100 bg-white text-slate-500"}`}>طلبات اليوم المكتملة ({completedOrders.length})</button></div><section className="rounded-3xl border border-orange-100 bg-white p-5 shadow-sm">{view === "active" ? <>{assignments.length ? <div className="space-y-3">{assignments.map(order => <article key={order.orderId} className="rounded-2xl bg-slate-50 p-4"><div className="flex items-center justify-between gap-3"><strong>طلب #{order.orderId}</strong><span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-teal-700">{order.assignmentStatus === "accepted" ? "مقبول" : order.assignmentStatus === "picked_up" ? "تم الاستلام" : "مسند"}</span></div><p className="mt-2 text-sm font-bold text-slate-600">العميل: {order.customerName}</p><p className="mt-1 text-xs leading-6 text-slate-500">{order.locationText || "موقع التسليم محدد"}</p></article>)}</div> : <p className="text-center text-sm font-bold leading-7 text-slate-500">لا توجد طلبات نشطة حالياً.</p>}</> : <>{completedOrders.length ? <div className="space-y-3">{completedOrders.map(order => <article key={order.orderId} className="rounded-2xl bg-emerald-50 p-4"><div className="flex items-center justify-between gap-3"><strong>طلب #{order.orderId}</strong><strong className="text-emerald-700">عمولتك {formatSyp(order.driverFee)}</strong></div><p className="mt-2 text-sm font-bold text-slate-600">العميل: {order.customerName}</p><div className="mt-2 flex justify-between text-xs text-slate-500"><span>رسوم التوصيل: {formatSyp(order.deliveryFee)}</span><span>{order.deliveredAt ? new Date(order.deliveredAt).toLocaleTimeString("ar-SY", { hour: "2-digit", minute: "2-digit" }) : "اليوم"}</span></div></article>)}</div> : <p className="text-center text-sm font-bold leading-7 text-slate-500">لم تُكمل أي طلب اليوم بعد.</p>}</>}</section><button type="button" onClick={onLogout} className="flex w-full items-center justify-center gap-2 rounded-2xl border border-rose-200 bg-white px-5 py-3 text-sm font-black text-[#63301b]"><LogOut className="h-4 w-4" /> تسجيل الخروج</button></section></main>;
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
