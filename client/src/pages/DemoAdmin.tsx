import { ArrowRight, BadgePercent, CarFront, ClipboardList, Package, Settings2, UsersRound } from "lucide-react";
import { useLocation } from "wouter";

const sections = [
  { title: "الطلبات", detail: "لا توجد طلبات حقيقية في النسخة التجريبية.", icon: ClipboardList, tone: "bg-rose-50 text-[#63301b]" },
  { title: "الأسعار", detail: "الأسعار الظاهرة هي بيانات تجريبية محلية.", icon: Package, tone: "bg-red-50 text-red-700" },
  { title: "العروض", detail: "عرض طعميني وشريط العروض مفعّلان للمعاينة.", icon: BadgePercent, tone: "bg-amber-50 text-amber-800" },
  { title: "الرحلات", detail: "يمكنك معاينة خدمة منبج إلى جرابلس من الواجهة الرئيسية.", icon: CarFront, tone: "bg-indigo-50 text-indigo-800" },
  { title: "الشركاء", detail: "إدارة الشركاء تحتاج الخادم ولا تُحفظ في هذه التجربة.", icon: UsersRound, tone: "bg-emerald-50 text-emerald-800" },
  { title: "الإعدادات", detail: "هذه اللوحة مستقلة ولا تغيّر إعدادات لحظة الحية.", icon: Settings2, tone: "bg-slate-100 text-slate-700" },
];

export default function DemoAdmin() {
  const [, setLocation] = useLocation();
  return <main dir="rtl" className="min-h-screen bg-slate-50 text-slate-900"><header className="border-b border-slate-200 bg-white"><div className="mx-auto flex h-18 w-full max-w-3xl items-center justify-between px-4 py-4"><div><p className="text-xs font-bold text-red-600">لحظة — وضع تجريبي محلي</p><h1 className="mt-1 text-xl font-extrabold text-[#4a2618]">لوحة تحكم المالك</h1></div><button onClick={() => setLocation("/")} className="inline-flex items-center gap-2 rounded-xl bg-[#4a2618] px-3 py-2 text-xs font-bold text-white"><ArrowRight className="h-4 w-4" /> الواجهة الرئيسية</button></div></header><section className="mx-auto w-full max-w-3xl px-4 py-7"><div className="rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm leading-7 text-amber-900"><strong>تنبيه تجريبي:</strong> هذه اللوحة تعمل داخل APK فقط. لا تحفظ طلبات أو أسعاراً ولا تغيّر النسخة الحية أو أي قاعدة بيانات.</div><div className="mt-6 grid gap-3 sm:grid-cols-2">{sections.map(section => { const Icon = section.icon; return <article key={section.title} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><span className={`grid h-11 w-11 place-items-center rounded-2xl ${section.tone}`}><Icon className="h-5 w-5" /></span><h2 className="mt-4 text-base font-extrabold text-[#4a2618]">{section.title}</h2><p className="mt-2 text-xs leading-6 text-slate-500">{section.detail}</p></article>; })}</div></section></main>;
}
