import { Gift as GiftIcon, MapPin, MessageCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatNewSyp } from "@shared/lahza";

export type GiftDraft = {
  enabled: boolean;
  recipientName: string;
  recipientPhone: string; // local Syrian digits after +963
  message: string;
  locationMode: "recipient" | "map";
  anonymous: boolean;
  wrap: boolean;
  when: "now" | "later";
  scheduledAt: string; // datetime-local value
};

export const emptyGiftDraft: GiftDraft = { enabled: false, recipientName: "", recipientPhone: "", message: "", locationMode: "recipient", anonymous: false, wrap: false, when: "now", scheduledAt: "" };

export const giftRecipientPhone = (draft: GiftDraft) => `+963${draft.recipientPhone}`;

/** What is still missing before a gift can be sent, or null when it is complete. */
export function giftDraftProblem(draft: GiftDraft, mapPointChosen: boolean): string | null {
  if (!draft.enabled) return null;
  if (draft.recipientName.trim().length < 2) return "اكتب اسم الشخص الذي ستصله الهدية";
  if (!/^9\d{8}$/.test(draft.recipientPhone)) return "اكتب رقم هاتف المُهدى إليه (9 أرقام تبدأ بـ 9)";
  if (draft.locationMode === "map" && !mapPointChosen) return "حدّد موقع المُهدى إليه على الخريطة";
  if (draft.when === "later") {
    const at = new Date(draft.scheduledAt).getTime();
    if (!draft.scheduledAt || Number.isNaN(at)) return "اختر موعد توصيل الهدية";
    if (at < Date.now() + 30 * 60_000) return "اختر موعداً بعد نصف ساعة على الأقل";
  }
  return null;
}

/** The gift options on the delivery checkout: who receives it, where, when, and the card. */
export function GiftCheckoutCard({ draft, onChange, mapPointChosen, onPickOnMap, wrapEnabled, wrapFeeNewSyp }: {
  draft: GiftDraft;
  onChange: (next: GiftDraft) => void;
  mapPointChosen: boolean;
  onPickOnMap: () => void;
  wrapEnabled: boolean;
  wrapFeeNewSyp: number;
}) {
  const set = (patch: Partial<GiftDraft>) => onChange({ ...draft, ...patch });
  return <div className={`checkout-card gift-card${draft.enabled ? " gift-card-on" : ""}`}>
    <button type="button" className="gift-toggle" onClick={() => set({ enabled: !draft.enabled })} aria-pressed={draft.enabled}>
      <span className="gift-toggle-icon"><GiftIcon className="h-5 w-5" /></span>
      <span className="gift-toggle-copy"><strong>أرسلها هدية 🎁</strong><small>تصل لشخص آخر، مع بطاقة إهداء ومفاجأة</small></span>
      <span className={`gift-switch${draft.enabled ? " gift-switch-on" : ""}`} aria-hidden="true"><span /></span>
    </button>
    {draft.enabled ? <div className="gift-body">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div><Label htmlFor="giftName">اسم المُهدى إليه</Label><Input id="giftName" value={draft.recipientName} onChange={event => set({ recipientName: event.target.value.slice(0, 80) })} placeholder="مثال: أمي، أحمد" /></div>
        <div><Label htmlFor="giftPhone">رقم هاتفه</Label><div className="phone-entry" dir="ltr"><span className="phone-entry-prefix">+963</span><Input id="giftPhone" dir="ltr" inputMode="numeric" value={draft.recipientPhone} onChange={event => set({ recipientPhone: event.target.value.replace(/\D/g, "").replace(/^963/, "").replace(/^0/, "").slice(0, 9) })} placeholder="9XXXXXXXX" /></div></div>
      </div>
      <div><Label htmlFor="giftMessage">بطاقة الإهداء <span className="text-slate-400">(اختياري)</span></Label><Textarea id="giftMessage" value={draft.message} onChange={event => set({ message: event.target.value.slice(0, 300) })} placeholder="مثال: كل عام وأنتِ بخير يا أمي ❤️" /></div>

      <div className="gift-section"><span className="gift-section-title">كيف نعرف موقعه؟</span>
        <div className="gift-choice-grid">
          <button type="button" onClick={() => set({ locationMode: "recipient" })} className={draft.locationMode === "recipient" ? "gift-choice-active" : ""}><MessageCircle className="h-5 w-5" /><strong>نتواصل معه</strong><small>تصله رسالة من لحظة أن لديه هدية، ويتصل به المندوب ليعرف موقعه</small></button>
          <button type="button" onClick={() => set({ locationMode: "map" })} className={draft.locationMode === "map" ? "gift-choice-active" : ""}><MapPin className="h-5 w-5" /><strong>أحدده أنا</strong><small>أضع موقعه على الخريطة، فتبقى الهدية مفاجأة كاملة</small></button>
        </div>
        {draft.locationMode === "map" ? <button type="button" className={`taxi-point-button${mapPointChosen ? " taxi-point-set" : ""}`} onClick={onPickOnMap}><MapPin className="h-4 w-4" />{mapPointChosen ? "تم تحديد موقع المُهدى إليه ✓ تعديل" : "حدّد موقعه على الخريطة"}</button> : <p className="gift-note">رسوم التوصيل تقديرية داخل المدينة.</p>}
      </div>

      <div className="gift-section"><span className="gift-section-title">متى تصل؟</span>
        <div className="gift-choice-grid gift-choice-compact">
          <button type="button" onClick={() => set({ when: "now" })} className={draft.when === "now" ? "gift-choice-active" : ""}><strong>الآن</strong></button>
          <button type="button" onClick={() => set({ when: "later" })} className={draft.when === "later" ? "gift-choice-active" : ""}><strong>في موعد محدد</strong></button>
        </div>
        {draft.when === "later" ? <Input type="datetime-local" dir="ltr" value={draft.scheduledAt} onChange={event => set({ scheduledAt: event.target.value })} /> : null}
      </div>

      <label className="gift-check"><input type="checkbox" checked={draft.anonymous} onChange={event => set({ anonymous: event.target.checked })} /><span><strong>إهداء مجهول</strong><small>لا يظهر اسمك للمُهدى إليه أبداً. بدونه يُكشف اسمك عند التسليم</small></span></label>
      {wrapEnabled ? <label className="gift-check"><input type="checkbox" checked={draft.wrap} onChange={event => set({ wrap: event.target.checked })} /><span><strong>تغليف هدية {wrapFeeNewSyp > 0 ? `(+${formatNewSyp(wrapFeeNewSyp)})` : "(مجاني)"}</strong><small>يغلّف المتجر الطلب ويرفق بطاقة الإهداء</small></span></label> : null}
      <p className="gift-note">الهدية تُدفع مسبقاً (شام كاش أو رصيد لحظة)، ولا يُطلب أي مبلغ من المُهدى إليه.</p>
    </div> : null}
  </div>;
}
