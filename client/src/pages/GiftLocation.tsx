import { useState } from "react";
import { useParams } from "wouter";
import { CheckCircle2, Gift, Loader2, LocateFixed } from "lucide-react";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";

/** Opened from the WhatsApp link Lahza sends the recipient: they share their location for the gift, without seeing what it is. */
export default function GiftLocation() {
  const { token = "" } = useParams<{ token: string }>();
  const info = trpc.lahza.gift.info.useQuery({ token }, { retry: false, enabled: token.length >= 10 });
  const share = trpc.lahza.gift.shareLocation.useMutation();
  const [note, setNote] = useState("");
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState("");

  const sendLocation = () => {
    setError("");
    if (!navigator.geolocation) { setError("هذا المتصفح لا يدعم تحديد الموقع. أخبر المندوب بموقعك عندما يتصل بك."); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(position => {
      share.mutate({ token, lat: position.coords.latitude, lng: position.coords.longitude, note: note.trim() || undefined }, {
        onSettled: () => setLocating(false),
        onError: mutationError => setError(mutationError.message),
      });
    }, geoError => {
      setLocating(false);
      setError(geoError.code === 1 ? "لم يُسمح بالوصول إلى الموقع. اسمح به من نافذة المتصفح ثم أعد المحاولة، أو أخبر المندوب بموقعك عندما يتصل." : "تعذر تحديد موقعك الآن. فعّل الموقع (GPS) وأعد المحاولة.");
    }, { enableHighAccuracy: true, timeout: 30_000, maximumAge: 60_000 });
  };

  const done = share.isSuccess || info.data?.shared;
  return <main dir="rtl" className="gift-page">
    <section className="gift-page-card">
      <img src="/assets/lahza-primary-logo-display.png" alt="لحظة" className="gift-page-logo" />
      {info.isLoading ? <p className="gift-page-text"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></p>
        : info.error ? <><h1>الرابط غير صالح</h1><p className="gift-page-text">تأكد من فتح الرابط كما وصلك في رسالة لحظة.</p></>
        : info.data?.closed ? <><span className="gift-page-icon"><Gift className="h-10 w-10" /></span><h1>هذه الهدية لم تعد بانتظار التوصيل</h1><p className="gift-page-text">إن كانت قد وصلتك، فنتمنى أن تكون أسعدتك 💛</p></>
        : done ? <><span className="gift-page-icon gift-page-icon-ok"><CheckCircle2 className="h-10 w-10" /></span><h1>وصلنا موقعك ✓</h1><p className="gift-page-text">سيصل إليك مندوب لحظة بهديتك قريباً، وقد يتصل بك قبل الوصول.</p></>
        : <>
          <span className="gift-page-icon"><Gift className="h-10 w-10" /></span>
          <h1>{info.data?.recipientName ? `${info.data.recipientName}، ` : ""}لديك هدية 🎁</h1>
          <p className="gift-page-text">من {info.data?.from ?? "شخص يحبك"} عبر لحظة. شارك موقعك ليصل إليك المندوب بها.</p>
          <label className="gift-page-note"><span>وصف المكان (اختياري)</span><Input value={note} onChange={event => setNote(event.target.value.slice(0, 200))} placeholder="مثال: البناء الأزرق، الطابق الثاني" /></label>
          <button type="button" className="gift-page-button" onClick={sendLocation} disabled={locating || share.isPending}>{locating || share.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <LocateFixed className="h-5 w-5" />} شارك موقعي</button>
          {error ? <p className="gift-page-error">{error}</p> : null}
          <p className="gift-page-small">لن نعرض محتوى الهدية ولا سعرها، ولا يُطلب منك أي مبلغ.</p>
        </>}
    </section>
  </main>;
}
