import { useState } from "react";
import { toast } from "sonner";
import { Building2, Copy, ImagePlus, Plus, Wallet as WalletIcon } from "lucide-react";
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

export function ShamCashAccountCard({ info, amountNewSyp }: { info: PaymentInfo | undefined; amountNewSyp?: number | null }) {
  const [imageFailed, setImageFailed] = useState(false);
  if (!info) return null;
  const copy = () => {
    void navigator.clipboard?.writeText(info.shamCashAccountNumber).then(() => toast.success("تم نسخ رقم الحساب"), () => undefined);
  };
  return <div className="shamcash-card">
    <div className="shamcash-card-head"><span className="payment-icon payment-icon-lahza">ش</span><div><strong>حوّل عبر شام كاش</strong><small>{amountNewSyp ? `المبلغ المطلوب: ${formatNewSyp(amountNewSyp)}` : "امسح الرمز أو انسخ رقم الحساب"}</small></div></div>
    {imageFailed ? null : <img src={imageSrc(info.shamCashImageUrl)} alt="رمز حساب شام كاش" className="shamcash-card-image" onError={() => setImageFailed(true)} />}
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
  const [reference, setReference] = useState("");
  const [proof, setProof] = useState<string | null>(null);
  const request = trpc.lahza.wallet.requestTopup.useMutation({
    onSuccess: () => {
      toast.success(method === "sham_cash" ? "وصل طلب الشحن، سنضيف الرصيد بعد التحقق من التحويل" : "وصل طلبك، ادفع المبلغ في مكتب لحظة ليُضاف إلى رصيدك");
      setAmount(""); setReference(""); setProof(null);
      onOpenChange(false);
      onDone();
    },
    onError: error => toast.error(error.message),
  });
  const amountNumber = Number(amount);
  const submit = () => {
    if (!Number.isInteger(amountNumber) || amountNumber < 1) { toast.error("أدخل مبلغ الشحن بالليرة"); return; }
    if (method === "sham_cash" && !reference.trim() && !proof) { toast.error("أدخل رقم عملية التحويل أو أرفق صورة الإشعار"); return; }
    request.mutate({ amount: amountNumber, method, reference: reference.trim() || undefined, proofDataUrl: proof ?? undefined });
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
        <label className="topup-field"><span>رقم عملية التحويل</span><Input dir="ltr" value={reference} onChange={event => setReference(event.target.value.slice(0, 120))} placeholder="من إشعار شام كاش" /></label>
        <label className="topup-proof"><ImagePlus className="h-5 w-5" /><span>{proof ? "تم إرفاق صورة الإشعار ✓" : "إرفاق صورة إشعار التحويل (اختياري)"}</span><input type="file" accept="image/*" hidden onChange={event => void pickProof(event.target.files?.[0])} /></label>
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
