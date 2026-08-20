import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { formatSyp } from "@shared/lahza";
import { CheckCircle2, LocateFixed, MapPin, Route, Store, Truck } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

type DemoTrip = { id: number; title: string; bookingCloseLabel: string; arrivalLabel: string; capacity: number; reservedCount: number; pickupFee: number; doorstepFee: number; status: "open" | "closed" | "dispatching" | "arrived"; active: boolean };
type DemoProduct = { id: number; name: string; partnerName: string; unitPrice: number; unit: string; imageUrl: string | null };

const demoTrips: DemoTrip[] = [{ id: 1, title: "رحلة منبج إلى جرابلس", bookingCloseLabel: "إغلاق الحجز: مساء الخميس", arrivalLabel: "وصول متوقع: صباح الجمعة", capacity: 8, reservedCount: 0, pickupFee: 5000, doorstepFee: 10000, status: "open", active: true }];
const demoProducts: DemoProduct[] = [{ id: 1, name: "علبة معمول", partnerName: "طعميني", unitPrice: 35000, unit: "وحدة", imageUrl: null }, { id: 2, name: "لوازم منزلية", partnerName: "متجر منبج", unitPrice: 22000, unit: "وحدة", imageUrl: null }];

export function IntercityBooking({ onBack, isStaticDemo }: { onBack: () => void; isStaticDemo: boolean }) {
  const [selectedTripId, setSelectedTripId] = useState<number | null>(null);
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [deliveryChoice, setDeliveryChoice] = useState<"pickup_point" | "doorstep">("pickup_point");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [locationUrl, setLocationUrl] = useState("");
  const [locationLabel, setLocationLabel] = useState("");
  const [locating, setLocating] = useState(false);
  const [notes, setNotes] = useState("");
  const tripsQuery = trpc.lahza.intercity.trips.useQuery(undefined, { enabled: !isStaticDemo });
  const productsQuery = trpc.lahza.intercity.products.useQuery(undefined, { enabled: !isStaticDemo });
  const reserve = trpc.lahza.intercity.createOrder.useMutation({
    onSuccess: result => { toast.success(`تم حجز طلبك في الرحلة بنجاح #${result.orderId}`); setName(""); setPhone(""); setLocationUrl(""); setLocationLabel(""); setNotes(""); setSelectedProductId(null); },
    onError: error => toast.error(error.message),
  });

  const trips = (isStaticDemo ? demoTrips : tripsQuery.data ?? []) as DemoTrip[];
  const products = (isStaticDemo ? demoProducts : productsQuery.data ?? []) as DemoProduct[];
  const selectedTrip = trips.find(trip => trip.id === selectedTripId) ?? trips.find(trip => trip.status === "open") ?? null;
  const selectedProduct = products.find(product => product.id === selectedProductId) ?? null;
  const remaining = selectedTrip ? Math.max(0, selectedTrip.capacity - selectedTrip.reservedCount) : 0;
  const tripFee = selectedTrip ? (deliveryChoice === "doorstep" ? selectedTrip.doorstepFee : selectedTrip.pickupFee) : 0;
  const total = (selectedProduct?.unitPrice ?? 0) + tripFee;
  const canReserve = Boolean(selectedTrip && selectedTrip.status === "open" && remaining > 0 && selectedProduct);

  const locate = () => {
    if (!navigator.geolocation) return toast.error("لا يدعم هذا الجهاز تحديد الموقع");
    setLocating(true);
    navigator.geolocation.getCurrentPosition(position => {
      const { latitude, longitude } = position.coords;
      setLocationLabel(`موقعي الحالي (${latitude.toFixed(5)}, ${longitude.toFixed(5)})`);
      setLocationUrl(`https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`);
      setLocating(false);
      toast.success("تم تحديد موقعك بنجاح");
    }, () => { setLocating(false); toast.error("تعذر تحديد الموقع. تحقق من إذن الموقع ثم حاول مجدداً."); }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 });
  };

  const submit = () => {
    if (!selectedTrip || !selectedProduct || !canReserve) return toast.error("اختر رحلة مفتوحة ومنتجاً متاحاً أولاً");
    if (!name.trim() || !/^9\d{8}$/.test(phone) || !locationUrl) return toast.error("أدخل الاسم ورقم الهاتف السوري واضغط تحديد موقعي أولاً");
    if (isStaticDemo) { toast.success("تم حجز الطلب كتجربة محلية فقط."); return; }
    reserve.mutate({ tripId: selectedTrip.id, catalogItemId: selectedProduct.id, customerName: name.trim(), customerPhone: `+963${phone}`, locationUrl, itemName: selectedProduct.name, quantity: "1", deliveryChoice, notes: [notes.trim(), locationLabel ? `الموقع: ${locationLabel}` : ""].filter(Boolean).join("\n") || undefined });
  };

  return <>
    <section className="app-shell pt-7 pb-5"><button className="back-link" onClick={onBack}>رجوع</button><p className="section-eyebrow mt-6">رحلات منبج إلى جرابلس</p><h1 className="page-title">اجمع طلبك في رحلة منظمة</h1><p className="page-detail">تُجهّز المتاجر طلبك في منبج، ثم يوصله فريق لحظة في الرحلة المحددة إلى جرابلس.</p></section>
    <section className="app-shell space-y-5 pb-12">
      <div className="intercity-panel"><span className="intercity-panel-icon"><Route /></span><p className="section-eyebrow">رحلات حالية</p><h2>اختر رحلتك القادمة</h2><div className="mt-5 grid gap-3">{tripsQuery.isLoading && !isStaticDemo ? <p className="text-sm text-slate-500">جارٍ تحميل الرحلات...</p> : trips.length ? trips.map(trip => { const open = trip.status === "open" && trip.capacity > trip.reservedCount; return <button key={trip.id} onClick={() => setSelectedTripId(trip.id)} className={`rounded-2xl border p-4 text-right ${selectedTrip?.id === trip.id ? "border-blue-800 bg-blue-50 ring-2 ring-blue-100" : "border-slate-200 bg-white"}`}><div className="flex items-start justify-between gap-3"><div><strong className="text-base text-blue-950">{trip.title}</strong><span className="mt-1 block text-xs text-slate-500">{trip.bookingCloseLabel} · {trip.arrivalLabel}</span></div><span className={`rounded-full px-3 py-1 text-xs font-bold ${open ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{open ? `${Math.max(0, trip.capacity - trip.reservedCount)} أماكن متبقية` : "الحجز مغلق"}</span></div></button>; }) : <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">لا توجد رحلة متاحة حالياً. تابع لحظة لمعرفة موعد الرحلة التالية.</p>}</div></div>
      <div className="rounded-3xl border border-slate-200 bg-white p-5"><div className="flex items-center gap-3"><Store className="h-5 w-5 text-red-600" /><div><p className="section-eyebrow">منتجات الشركاء</p><h2 className="text-xl font-black text-blue-950">اختر ما تحتاجه من منبج</h2></div></div><div className="mt-4 grid gap-3 sm:grid-cols-2">{productsQuery.isLoading && !isStaticDemo ? <p className="text-sm text-slate-500">جارٍ تحميل منتجات الشركاء...</p> : products.length ? products.map(product => <button key={product.id} onClick={() => setSelectedProductId(product.id)} className={`overflow-hidden rounded-2xl border p-3 text-right ${selectedProductId === product.id ? "border-red-500 bg-red-50 ring-2 ring-red-100" : "border-slate-200"}`}><div className="flex gap-3">{product.imageUrl ? <img src={product.imageUrl} alt="" className="h-14 w-14 rounded-xl object-cover" /> : <span className="grid h-14 w-14 place-items-center rounded-xl bg-slate-100 text-blue-900"><Store className="h-5 w-5" /></span>}<div><span className="text-xs font-bold text-red-600">{product.partnerName}</span><strong className="mt-1 block">{product.name}</strong><span className="mt-1 block text-xs text-slate-500">{formatSyp(product.unitPrice)} / {product.unit}</span></div></div></button>) : <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">لا توجد منتجات شريك متاحة حالياً.</p>}</div></div>
      <div className="grid gap-3 sm:grid-cols-2"><button onClick={() => setDeliveryChoice("pickup_point")} className={`rounded-3xl border p-5 text-right ${deliveryChoice === "pickup_point" ? "border-blue-800 bg-blue-50 ring-2 ring-blue-100" : "border-slate-200 bg-white"}`}><MapPin className="h-5 w-5 text-blue-900" /><strong className="mt-3 block">استلام من نقطة جرابلس</strong><span className="mt-1 block text-xs text-slate-500">رسم الرحلة: {formatSyp(selectedTrip?.pickupFee ?? 0)}</span></button><button onClick={() => setDeliveryChoice("doorstep")} className={`rounded-3xl border p-5 text-right ${deliveryChoice === "doorstep" ? "border-blue-800 bg-blue-50 ring-2 ring-blue-100" : "border-slate-200 bg-white"}`}><Truck className="h-5 w-5 text-blue-900" /><strong className="mt-3 block">توصيل إلى العنوان</strong><span className="mt-1 block text-xs text-slate-500">رسم الرحلة: {formatSyp(selectedTrip?.doorstepFee ?? 0)}</span></button></div>
      <div className="checkout-card space-y-4"><div className="checkout-card-title"><CheckCircle2 className="h-5 w-5 text-red-600" /><span>تأكيد حجز الرحلة</span></div><div className="grid gap-3 sm:grid-cols-2"><div><Label>الاسم</Label><Input value={name} onChange={event => setName(event.target.value)} placeholder="اكتب الاسم" /></div><div><Label>رقم الهاتف السوري</Label><div className="phone-entry" dir="ltr"><span>+963</span><Input inputMode="numeric" value={phone} onChange={event => setPhone(event.target.value.replace(/\D/g, "").slice(0, 9))} placeholder="9XXXXXXXX" /></div></div></div><div><Label>موقعك في جرابلس</Label><Input value={locationLabel} readOnly placeholder="استخدم زر تحديد موقعي" /><div className="location-actions"><button onClick={locate} disabled={locating}><LocateFixed className="h-4 w-4" />{locating ? "جارٍ التحديد..." : "تحديد موقعي"}</button></div></div><div><Label>ملاحظات إضافية <span className="text-slate-400">(اختياري)</span></Label><Textarea value={notes} onChange={event => setNotes(event.target.value)} placeholder="لون أو مقاس أو أي تفصيل للمتجر" /></div></div>
      <div className="rounded-3xl bg-blue-950 p-5 text-white"><div className="flex items-center justify-between"><span>الإجمالي المبدئي</span><strong className="text-xl">{formatSyp(total)}</strong></div><p className="mt-2 text-xs leading-6 text-blue-100">يشمل سعر المنتج ورسم الرحلة. يؤكد الشريك توفر المنتج قبل التجهيز.</p><Button disabled={!canReserve || reserve.isPending} onClick={submit} className="mt-4 h-12 w-full rounded-2xl bg-red-600 hover:bg-red-700">{reserve.isPending ? "جارٍ الحجز..." : "تأكيد حجز الرحلة"}</Button></div>
    </section>
  </>;
}
