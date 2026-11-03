import { useState } from "react";
import { toast } from "sonner";
import { Building2, CalendarDays, Clock3, Copy, Download, Gift, ImagePlus, Info, ListChecks, Plus, ShieldCheck, Sparkles, Trophy, Users, Wallet as WalletIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { serverOrigin } from "@/lib/serverOrigin";
import { formatNewSyp, formatSyp, toNewSyp } from "@shared/lahza";

export type PaymentInfo = { shamCashAccountName: string; shamCashAccountNumber: string; shamCashImageUrl: string; officeAddress: string };

/** Uploaded images are absolute; the bundled default is served by the Lahza server so the app always shows the current one. */
const imageSrc = (url: string) => (/^https?:\/\//.test(url) ? url : `${serverOrigin()}${url}`);

/** Phone screenshots are large: shrink them before upload so slow connections still get through. */
export function readImageAsDataUrl(file: File, maxSide = 1600) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("تعذر قراءة الصورة"));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error("الملف المختار ليس صورة"));
      image.onload = () => {
        const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(image.width * scale);
        canvas.height = Math.round(image.height * scale);
        canvas.getContext("2d")?.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };
      image.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

/**
 * A QR on the same phone cannot be scanned, so the customer saves it and opens it from
 * Sham Cash's "scan from image". The Android app saves it to the gallery; older app
 * versions open it in the browser, and the website downloads it.
 */
async function saveQrImage(url: string) {
  const app = window.LahzaApp;
  if (app?.saveImage) {
    if (app.saveImage(url, "lahza-shamcash-qr.png")) { toast.success("تم حفظ صورة الباركود في الاستديو (مجلد Pictures/Lahza). افتح شام كاش واختر المسح من صورة."); return; }
    if (!app.openExternal) { toast.error("تعذر حفظ الصورة، جرّب مرة أخرى"); return; }
  }
  if (app?.openExternal) { app.openExternal(url); toast.message("اضغط مطولاً على الصورة واختر حفظ"); return; }
  try {
    const blob = await (await fetch(url)).blob();
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "lahza-shamcash-qr.png";
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 5000);
    toast.success("تم تحميل صورة الباركود");
  } catch {
    window.open(url, "_blank");
  }
}

export function ShamCashAccountCard({ info, amountNewSyp }: { info: PaymentInfo | undefined; amountNewSyp?: number | null }) {
  const [imageFailed, setImageFailed] = useState(false);
  if (!info) return null;
  const copy = () => {
    void navigator.clipboard?.writeText(info.shamCashAccountNumber).then(() => toast.success("تم نسخ رقم الحساب"), () => undefined);
  };
  return <div className="shamcash-card">
    <div className="shamcash-card-head"><span className="payment-icon payment-icon-lahza">ش</span><div><strong>حوّل عبر شام كاش</strong><small>{amountNewSyp ? `المبلغ المطلوب: ${formatNewSyp(amountNewSyp)}` : "امسح الرمز أو انسخ رقم الحساب"}</small></div></div>
    {imageFailed ? null : <><img src={imageSrc(info.shamCashImageUrl)} alt="رمز حساب شام كاش" className="shamcash-card-image" onError={() => setImageFailed(true)} /><button type="button" className="shamcash-save" onClick={() => void saveQrImage(imageSrc(info.shamCashImageUrl))}><Download className="h-4 w-4" /> حفظ صورة الباركود</button><small className="shamcash-hint">احفظ الصورة، ثم افتح شام كاش واختر «المسح من صورة».</small></>}
    {info.shamCashAccountName ? <p className="shamcash-card-line">اسم الحساب: <b>{info.shamCashAccountName}</b></p> : null}
    {info.shamCashAccountNumber ? <button type="button" className="shamcash-card-number" onClick={copy}><span dir="ltr">{info.shamCashAccountNumber}</span><Copy className="h-4 w-4" /></button> : null}
  </div>;
}

type WalletSummary = { balance: number; transactions: { id: number; amount: number; kind: string; orderId: number | null; note: string | null; createdAt: string | Date }[]; topups: { id: number; amount: number; method: "sham_cash" | "office_cash"; status: "pending" | "approved" | "rejected"; reviewNote: string | null; createdAt: string | Date }[] };

const topupStatus = { pending: "بانتظار المراجعة", approved: "تمت الإضافة", rejected: "مرفوض" } as const;

export function WalletCard({ summary, onTopup }: { summary: WalletSummary | null | undefined; onTopup: () => void }) {
  const pending = summary?.topups.filter(topup => topup.status === "pending") ?? [];
  const recent = summary?.transactions.slice(0, 5) ?? [];
  return <section className="account-card wallet-card">
    <div className="account-card-heading"><div><p>رصيد لحظة</p><h2>{formatSyp(summary?.balance ?? 0)}</h2></div><WalletIcon className="h-6 w-6" /></div>
    <p className="account-card-note">ادفع طلباتك من رصيدك كلياً أو جزئياً. اشحنه عبر شام كاش أو نقداً في مكتب لحظة.</p>
    <button type="button" onClick={onTopup} className="account-action-primary wallet-topup-button"><Plus className="h-4 w-4" /> شحن الرصيد</button>
    {pending.length ? <div className="wallet-pending">{pending.map(topup => <span key={topup.id}>طلب شحن {formatSyp(topup.amount)} · {topup.method === "sham_cash" ? "شام كاش" : "نقداً في المكتب"} · {topupStatus.pending}</span>)}</div> : null}
    {recent.length ? <ul className="wallet-history">{recent.map(row => <li key={row.id}><span>{row.note || (row.amount > 0 ? "إضافة" : "خصم")}</span><b className={row.amount > 0 ? "wallet-plus" : "wallet-minus"}>{row.amount > 0 ? "+" : "−"} {formatSyp(Math.abs(row.amount))}</b></li>)}</ul> : null}
  </section>;
}

export function TopupDialog({ open, onOpenChange, info, onDone }: { open: boolean; onOpenChange: (open: boolean) => void; info: PaymentInfo | undefined; onDone: () => void }) {
  const [method, setMethod] = useState<"sham_cash" | "office_cash">("sham_cash");
  const [amount, setAmount] = useState("");
  const [proof, setProof] = useState<string | null>(null);
  const request = trpc.lahza.wallet.requestTopup.useMutation({
    onSuccess: () => {
      toast.success(method === "sham_cash" ? "وصل طلب الشحن، سنضيف الرصيد بعد التحقق من التحويل" : "وصل طلبك، ادفع المبلغ في مكتب لحظة ليُضاف إلى رصيدك");
      setAmount(""); setProof(null);
      onOpenChange(false);
      onDone();
    },
    onError: error => toast.error(error.message),
  });
  const amountNumber = Number(amount);
  const submit = () => {
    if (!Number.isInteger(amountNumber) || amountNumber < 1) { toast.error("أدخل مبلغ الشحن بالليرة"); return; }
    if (method === "sham_cash" && !proof) { toast.error("أرفق صورة إشعار التحويل من شام كاش"); return; }
    request.mutate({ amount: amountNumber, method, proofDataUrl: method === "sham_cash" ? proof ?? undefined : undefined });
  };
  const pickProof = async (file: File | undefined) => {
    if (!file) return;
    try { setProof(await readImageAsDataUrl(file)); } catch (error) { toast.error(error instanceof Error ? error.message : "تعذر قراءة الصورة"); }
  };
  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent dir="rtl" className="topup-dialog w-[calc(100%-2rem)] max-w-md rounded-3xl border-0 bg-white p-5 shadow-2xl">
      <DialogHeader><DialogTitle className="text-center text-xl">شحن رصيد لحظة</DialogTitle><DialogDescription className="text-center">اختر طريقة الشحن وأدخل المبلغ.</DialogDescription></DialogHeader>
      <div className="payment-grid mt-2">
        <button type="button" onClick={() => setMethod("sham_cash")} className={method === "sham_cash" ? "payment-active" : ""}><span className="payment-icon payment-icon-lahza">ش</span><span>شام كاش</span></button>
        <button type="button" onClick={() => setMethod("office_cash")} className={method === "office_cash" ? "payment-active" : ""}><Building2 className="h-5 w-5" /><span>نقداً في المكتب</span></button>
      </div>
      <label className="topup-field"><span>المبلغ (ل.س)</span><Input dir="ltr" inputMode="numeric" value={amount} onChange={event => setAmount(event.target.value.replace(/\D/g, "").slice(0, 8))} placeholder="مثال: 500" /></label>
      {method === "sham_cash" ? <>
        <ShamCashAccountCard info={info} amountNewSyp={amountNumber || null} />
        <label className="topup-proof"><ImagePlus className="h-5 w-5" /><span>{proof ? "تم إرفاق صورة الإشعار ✓" : "إرفاق صورة إشعار التحويل"}</span><input type="file" accept="image/*" hidden onChange={event => void pickProof(event.target.files?.[0])} /></label>
        <p className="topup-note">بعد التحويل اضغط «إرسال الطلب»، ويُضاف المبلغ لرصيدك فور التحقق منه.</p>
      </> : <div className="topup-office">
        <strong>ادفع في مكتب لحظة</strong>
        <p>{info?.officeAddress || "اسأل خدمة العملاء عن عنوان المكتب"}</p>
        <p className="topup-note">أرسل الطلب ثم ادفع المبلغ في المكتب، ويُضاف لرصيدك مباشرة.</p>
      </div>}
      <Button type="button" disabled={request.isPending} onClick={submit} className="mt-3 w-full rounded-xl bg-[#ff6b2b] py-6 text-white hover:bg-[#e85a1c]">{request.isPending ? "جارٍ الإرسال..." : "إرسال الطلب"}</Button>
    </DialogContent>
  </Dialog>;
}

/** The checkout block under the payment methods: the wallet option and, for Sham Cash, where to transfer. */
export function CheckoutPaymentExtras({ payment, balance, useWallet, setUseWallet, totalNewSyp, info }: { payment: "sham_cash" | "cash"; balance: number; useWallet: boolean; setUseWallet: (value: boolean) => void; totalNewSyp: number | null; info: PaymentInfo | undefined }) {
  const balanceNewSyp = toNewSyp(balance);
  const fromWallet = useWallet && balanceNewSyp > 0 ? (totalNewSyp === null ? balanceNewSyp : Math.min(balanceNewSyp, totalNewSyp)) : 0;
  const remaining = totalNewSyp === null ? null : Math.max(0, totalNewSyp - fromWallet);
  return <>
    {balanceNewSyp > 0 ? <label className={`wallet-use ${useWallet ? "wallet-use-on" : ""}`}>
      <input type="checkbox" checked={useWallet} onChange={event => setUseWallet(event.target.checked)} />
      <WalletIcon className="h-5 w-5" />
      <span><b>الدفع من رصيدي</b><small>رصيدك {formatNewSyp(balanceNewSyp)}{useWallet ? totalNewSyp === null ? " · يُخصم ما يغطيه بعد حساب السعر" : remaining ? ` · يُخصم ${formatNewSyp(fromWallet)} والباقي ${formatNewSyp(remaining)} عند الاستلام` : ` · يغطي الطلب كاملاً` : ""}</small></span>
    </label> : null}
    {payment === "sham_cash" && remaining !== 0 ? <ShamCashAccountCard info={info} amountNewSyp={remaining} /> : null}
  </>;
}

export type { WalletSummary };

export type LaunchOffer = { title: string; startsAt: string | Date | null; endsAt: string | Date | null; winnersCount: number; minPersonalOrders: number; minReferrals: number; prizeText: string; rewardAmount: number; awarded: boolean; seatsTaken: number; personalOrders: number; referrals: number; rank: number | null; won: { rank: number; amount: number } | null };

const dayLabel = (value: string | Date | null) => value ? new Date(value).toLocaleDateString("ar-SY", { day: "numeric", month: "long" }) : "";

function Progress({ label, done, goal }: { label: string; done: number; goal: number }) {
  if (!goal) return null;
  return <div className="contest-progress"><div className="account-progress-labels"><span>{label}</span><span>{Math.min(done, goal)} / {goal}</span></div><div className="account-progress"><span style={{ width: `${Math.min(100, Math.round(done / goal * 100))}%` }} /></div></div>;
}

/** Where the contest stands right now, in one short line. */
export function contestStatus(offer: LaunchOffer) {
  const now = Date.now();
  if (offer.startsAt && new Date(offer.startsAt).getTime() > now) return { live: false, text: `تبدأ ${dayLabel(offer.startsAt)}` };
  if (offer.awarded || (offer.endsAt && new Date(offer.endsAt).getTime() < now)) return { live: false, text: "انتهت المسابقة" };
  if (offer.seatsTaken >= offer.winnersCount) return { live: false, text: `اكتمل الفائزون (${offer.winnersCount})` };
  const days = offer.endsAt ? Math.ceil((new Date(offer.endsAt).getTime() - now) / 86_400_000) : 0;
  return { live: true, text: offer.endsAt ? (days <= 1 ? "آخر يوم في المسابقة" : `باقي ${days} يوم`) : "المسابقة جارية" };
}

const prizeLine = (offer: LaunchOffer) => [offer.prizeText, offer.rewardAmount ? `${formatSyp(offer.rewardAmount)} رصيد في محفظة لحظة` : ""].filter(Boolean).join(" + ");

/** The full contest page: what it is, how to join, the rules, the prizes, and where this customer stands. */
export function ContestDialog({ offer, open, onOpenChange, signedIn, onJoin }: { offer: LaunchOffer | null | undefined; open: boolean; onOpenChange: (open: boolean) => void; signedIn: boolean; onJoin?: () => void }) {
  if (!offer) return null;
  const status = contestStatus(offer);
  const prize = prizeLine(offer);
  const seatsLeft = Math.max(0, offer.winnersCount - offer.seatsTaken);
  const steps = [
    "أنشئ رمز الإحالة الخاص بك من صفحة «حسابي».",
    offer.minReferrals ? `شارك رمزك مع أصدقائك، ويجب أن يُكمل ${offer.minReferrals} منهم على الأقل طلباً باستخدام رمزك.` : "",
    offer.minPersonalOrders ? `أكمل أنت ${offer.minPersonalOrders} طلبات أو أكثر من التطبيق.` : "",
    `أول ${offer.winnersCount} عملاء يحققون الشروط يفوزون بالجوائز.`,
  ].filter(Boolean);
  const rules = [
    offer.startsAt || offer.endsAt ? `تُحسب فقط الطلبات المكتملة خلال مدة المسابقة${offer.startsAt ? ` من ${dayLabel(offer.startsAt)}` : ""}${offer.endsAt ? ` حتى ${dayLabel(offer.endsAt)}` : ""}.` : "تُحسب فقط الطلبات المكتملة خلال مدة المسابقة.",
    "الطلبات الملغاة أو المرفوضة لا تُحسب.",
    "كل صديق يُحسب مرة واحدة مهما كرر الطلب.",
    "الترتيب حسب الأسبقية: من يكمل الشرطين أولاً يحجز مركزه.",
    "يراجع فريق لحظة النتائج ويعتمد الفائزين، ويُعلَن عنهم بعد انتهاء المسابقة.",
  ];
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent dir="rtl" className="contest-dialog w-[calc(100%-1.5rem)] max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl border-0 bg-white p-0 shadow-2xl">
    <div className="contest-hero">
      <span className="contest-hero-trophy" aria-hidden="true"><Trophy className="h-9 w-9" /></span>
      <DialogHeader><DialogTitle className="text-center text-2xl font-black text-white">{offer.title}</DialogTitle><DialogDescription className="text-center text-sm font-bold text-amber-100">أول {offer.winnersCount} يحققون الشروط يفوزون</DialogDescription></DialogHeader>
      <span className={`contest-status-chip${status.live ? " contest-status-live" : ""}`}><Clock3 className="h-4 w-4" />{status.text}</span>
    </div>
    <div className="contest-body">
      {prize ? <section className="contest-section contest-prize-box"><h3><Gift className="h-5 w-5" /> الجوائز</h3><p>{prize}</p><small>لكل فائز من الفائزين الـ{offer.winnersCount}</small></section> : null}
      <section className="contest-section"><h3><ListChecks className="h-5 w-5" /> كيف تشارك؟</h3><ol className="contest-steps">{steps.map((step, index) => <li key={index}><b>{index + 1}</b><span>{step}</span></li>)}</ol></section>
      <section className="contest-section"><h3><Users className="h-5 w-5" /> وضع المسابقة الآن</h3>
        <div className="contest-stats"><article><strong>{offer.winnersCount}</strong><span>عدد الجوائز</span></article><article><strong>{offer.seatsTaken}</strong><span>حققوا الشروط</span></article><article><strong>{seatsLeft}</strong><span>مراكز متبقية</span></article></div>
        {offer.startsAt || offer.endsAt ? <p className="contest-dates"><CalendarDays className="h-4 w-4" />{offer.startsAt ? `من ${dayLabel(offer.startsAt)}` : ""}{offer.startsAt && offer.endsAt ? " " : ""}{offer.endsAt ? `حتى ${dayLabel(offer.endsAt)}` : ""}</p> : null}
      </section>
      <section className="contest-section"><h3><Sparkles className="h-5 w-5" /> تقدّمك</h3>
        {!signedIn ? <p className="account-card-note">سجّل الدخول برقم هاتفك لتشارك وتتابع تقدّمك.</p>
          : offer.won ? <p className="launch-offer-won">مبروك! فزت بالمركز {offer.won.rank} 🎉</p>
          : offer.rank ? <p className="launch-offer-won">حققت الشروط! مركزك {offer.rank} من {offer.winnersCount}.</p>
          : <><Progress label="طلباتك المكتملة" done={offer.personalOrders} goal={offer.minPersonalOrders} /><Progress label="أصدقاء طلبوا برمزك" done={offer.referrals} goal={offer.minReferrals} /></>}
      </section>
      <section className="contest-section"><h3><ShieldCheck className="h-5 w-5" /> الشروط</h3><ul className="contest-rules">{rules.map((rule, index) => <li key={index}>{rule}</li>)}</ul></section>
      {onJoin && status.live ? <Button type="button" onClick={() => { onOpenChange(false); onJoin(); }} className="contest-join">{signedIn ? "أنشئ رمز إحالتك وشارك الآن" : "سجّل وشارك الآن"}</Button> : null}
    </div>
  </DialogContent></Dialog>;
}

/** The contest as a slide in the home offers gallery. */
export function ContestSlide({ offer, onOpen }: { offer: LaunchOffer; onOpen: () => void }) {
  const status = contestStatus(offer);
  const prize = prizeLine(offer);
  return <button type="button" onClick={onOpen} className="hero-gallery-slide contest-slide block h-full w-full cursor-pointer text-right" aria-label={`فتح ${offer.title}`}>
    <span className="contest-slide-glow" aria-hidden="true" />
    <span className="contest-slide-trophy" aria-hidden="true"><Trophy className="h-10 w-10" /></span>
    <span className="contest-slide-copy">
      <small>🏆 {status.text}</small>
      <strong>{offer.title}</strong>
      <span>{prize ? `الجائزة: ${prize}` : `أول ${offer.winnersCount} يفوزون بجوائز لحظة`}</span>
      <em>شاهد الشروط وشارك</em>
    </span>
  </button>;
}

/** The contest and this customer's progress toward both targets. */
export function LaunchOfferCard({ offer, onDetails }: { offer: LaunchOffer | null | undefined; onDetails?: () => void }) {
  if (!offer) return null;
  const status = contestStatus(offer);
  const prize = prizeLine(offer);
  return <section className="account-card launch-offer-card">
    <div className="account-card-heading"><div><p>🏆 {offer.title}</p><h2>أول {offer.winnersCount} يفوزون</h2></div>{onDetails ? <button type="button" className="contest-info-button" onClick={onDetails} aria-label="معلومات المسابقة وشروطها"><Info className="h-5 w-5" /></button> : <Trophy className="h-6 w-6" />}</div>
    <span className={`contest-status-chip contest-status-inline${status.live ? " contest-status-live" : ""}`}><Clock3 className="h-4 w-4" />{status.text}</span>
    {prize ? <p className="contest-prize">🎁 {prize}</p> : null}
    {offer.won ? <p className="launch-offer-won">مبروك! فزت بالمركز {offer.won.rank} 🎉</p>
      : offer.rank ? <p className="launch-offer-won">حققت الشروط! مركزك {offer.rank} من {offer.winnersCount}، وسيعتمد فريق لحظة الفائزين.</p>
      : <>
        <Progress label="طلباتك المكتملة" done={offer.personalOrders} goal={offer.minPersonalOrders} />
        <Progress label="أصدقاء طلبوا برمزك" done={offer.referrals} goal={offer.minReferrals} />
        <p className="account-card-note">{status.live ? `بقي ${Math.max(0, offer.winnersCount - offer.seatsTaken)} مراكز من ${offer.winnersCount}.` : status.text}</p>
      </>}
    {onDetails ? <button type="button" className="account-action-secondary contest-details-link" onClick={onDetails}><Info className="h-4 w-4" /> شرح المسابقة والشروط</button> : null}
  </section>;
}
