import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { CheckCircle2, Route } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export type IntercityTripSelection = {
  id: number;
  title: string;
  bookingCloseLabel: string;
  arrivalLabel: string;
  pickupFee: number;
  doorstepFee: number;
};

type Trip = IntercityTripSelection & {
  capacity: number;
  reservedCount: number;
  status: "open" | "closed" | "dispatching" | "arrived";
  active: boolean;
};

const demoTrips: Trip[] = [{ id: 1, title: "حجز منبج إلى جرابلس", bookingCloseLabel: "إغلاق الحجز: مساء الخميس", arrivalLabel: "وصول متوقع: صباح الجمعة", capacity: 8, reservedCount: 0, pickupFee: 5000, doorstepFee: 10000, status: "open", active: true }];

export function IntercityBooking({ onBack, onChooseTrip, isStaticDemo }: { onBack: () => void; onChooseTrip: (trip: IntercityTripSelection) => void; isStaticDemo: boolean }) {
  const [selectedTripId, setSelectedTripId] = useState<number | null>(null);
  const tripsQuery = trpc.lahza.intercity.trips.useQuery(undefined, { enabled: !isStaticDemo });
  const trips = (isStaticDemo ? demoTrips : tripsQuery.data ?? []) as Trip[];
  const selectedTrip = trips.find(trip => trip.id === selectedTripId) ?? null;
  const isBookable = Boolean(selectedTrip && selectedTrip.status === "open" && selectedTrip.active && selectedTrip.reservedCount < selectedTrip.capacity);

  const continueToManbijCatalog = () => {
    if (!selectedTrip || !isBookable) {
      toast.error("اختر حجزاً مفتوحاً أولاً");
      return;
    }
    onChooseTrip({ id: selectedTrip.id, title: selectedTrip.title, bookingCloseLabel: selectedTrip.bookingCloseLabel, arrivalLabel: selectedTrip.arrivalLabel, pickupFee: selectedTrip.pickupFee, doorstepFee: selectedTrip.doorstepFee });
  };

  return <>
    <section className="app-shell pt-7 pb-5"><button className="back-link" onClick={onBack}>رجوع</button><p className="section-eyebrow mt-6">اطلب من جرابلس</p><h1 className="page-title">اختر حجزك المتاح</h1><p className="page-detail">بعد اختيار الحجز، ستنتقل إلى أقسام منبج العادية لتضيف ما تحتاجه إلى السلة.</p></section>
    <section className="app-shell space-y-5 pb-12"><div className="intercity-panel"><span className="intercity-panel-icon"><Route /></span><p className="section-eyebrow">الحجوزات الحالية</p><h2>اختر الحجز المناسب لك</h2><div className="mt-5 grid gap-3">{tripsQuery.isLoading && !isStaticDemo ? <p className="text-sm text-slate-500">جارٍ تحميل الحجوزات...</p> : trips.length ? trips.map(trip => { const open = trip.status === "open" && trip.active && trip.capacity > trip.reservedCount; return <button key={trip.id} onClick={() => setSelectedTripId(trip.id)} className={`rounded-2xl border p-4 text-right ${selectedTrip?.id === trip.id ? "border-blue-800 bg-blue-50 ring-2 ring-blue-100" : "border-slate-200 bg-white"}`}><div className="flex items-start justify-between gap-3"><div><strong className="text-base text-blue-950">{trip.title}</strong><span className="mt-1 block text-xs text-slate-500">{trip.bookingCloseLabel} · {trip.arrivalLabel}</span></div><span className={`rounded-full px-3 py-1 text-xs font-bold ${open ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{open ? `${Math.max(0, trip.capacity - trip.reservedCount)} أماكن متبقية` : "الحجز مغلق"}</span></div></button>; }) : <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">لا توجد حجوزات متاحة حالياً. تابع لحظة لمعرفة موعد الحجز التالي.</p>}</div></div>
      <div className="rounded-3xl border border-blue-100 bg-blue-50 p-5"><div className="flex gap-3"><CheckCircle2 className="h-6 w-6 shrink-0 text-blue-900" /><div><h2 className="font-black text-blue-950">ماذا بعد اختيار الحجز؟</h2><p className="mt-2 text-sm leading-7 text-slate-600">ستفتح لك أقسام طلبات منبج نفسها. أضف أي منتجات إلى السلة ثم أرسل الطلب، وسيُسجل ضمن الحجز الذي اخترته.</p></div></div><Button disabled={!isBookable} onClick={continueToManbijCatalog} className="mt-5 h-12 w-full rounded-2xl bg-blue-950 hover:bg-blue-900">الانتقال إلى أقسام منبج</Button></div>
    </section>
  </>;
}
