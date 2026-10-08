import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ImagePlus, Plus } from "lucide-react";
import { useState } from "react";

const clothingSizeGroups = [
  { label: "ملابس · قياس عالمي", values: ["XS", "S", "M", "L", "XL", "XXL", "3XL", "4XL", "5XL"] },
  { label: "ملابس · قياس رقمي", values: Array.from({ length: 16 }, (_, index) => String(34 + index * 2)) },
  { label: "أحذية", values: Array.from({ length: 12 }, (_, index) => `حذاء ${35 + index}`) },
  { label: "أطفال", values: ["0–3 أشهر", "3–6 أشهر", "6–9 أشهر", "9–12 شهراً", "12–18 شهراً", "18–24 شهراً", "2–3 سنوات", "3–4 سنوات", "5–6 سنوات", "7–8 سنوات", "9–10 سنوات", "11–12 سنة", "13–14 سنة"] },
];

type VariantUpload = { size: string; color: string; dataUrls: string[] };
type Props = {
  sizes: string[];
  onSizesChange: (sizes: string[]) => void;
  colors: string[];
  onColorsChange: (colors: string[]) => void;
  variantDataUrls: VariantUpload[];
  onAddVariantImages: (size: string, color: string, files: FileList | null) => void;
};

export default function ClothingProductFields({ sizes, onSizesChange, colors, onColorsChange, variantDataUrls, onAddVariantImages }: Props) {
  const [customSize, setCustomSize] = useState("");
  const [chest, setChest] = useState("");
  const [waist, setWaist] = useState("");
  const [hip, setHip] = useState("");
  const [length, setLength] = useState("");
  const [sleeve, setSleeve] = useState("");
  const toggleSize = (size: string) => onSizesChange(sizes.includes(size) ? sizes.filter(value => value !== size) : [...sizes, size]);
  const addMeasuredSize = () => {
    const label = customSize.trim();
    if (!label) return;
    const measurements = [
      chest && `صدر ${chest} سم`,
      waist && `خصر ${waist} سم`,
      hip && `ورك ${hip} سم`,
      length && `طول ${length} سم`,
      sleeve && `كم ${sleeve} سم`,
    ].filter(Boolean);
    const value = measurements.length ? `${label} — ${measurements.join(" · ")}` : label;
    if (!sizes.includes(value)) onSizesChange([...sizes, value]);
    setCustomSize("");
    setChest("");
    setWaist("");
    setHip("");
    setLength("");
    setSleeve("");
  };
  const colorList = colors.map(color => color.trim()).filter(Boolean);

  return <section className="mt-4 space-y-4 rounded-2xl border border-purple-100 bg-purple-50 p-4">
    <div>
      <Label>قسم الألبسة والقياسات</Label>
      <p className="mt-1 text-xs leading-6 text-slate-600">اختر القياسات المناسبة لنوع المنتج، أو أضف قياساً مخصصاً بالسنتيمتر. يستطيع العميل اختيار المقاس واللون قبل الطلب.</p>
    </div>
    {clothingSizeGroups.map(group => <div key={group.label}>
      <strong className="text-xs font-black text-purple-900">{group.label}</strong>
      <div className="mt-2 flex flex-wrap gap-2">{group.values.map(size => <button type="button" key={size} onClick={() => toggleSize(size)} className={`rounded-xl px-3 py-2 text-xs font-black ${sizes.includes(size) ? "bg-purple-700 text-white" : "bg-white text-slate-600"}`}>{size}</button>)}</div>
    </div>)}
    <div className="rounded-xl border border-purple-100 bg-white p-3">
      <Label>إضافة قياس خاص أو دليل قياسات (سم)</Label>
      <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        <Input value={customSize} onChange={event => setCustomSize(event.target.value)} placeholder="المقاس، مثلاً: 40 أو XXL" />
        <Input inputMode="decimal" value={chest} onChange={event => setChest(event.target.value.replace(/[^0-9.]/g, ""))} placeholder="محيط الصدر" />
        <Input inputMode="decimal" value={waist} onChange={event => setWaist(event.target.value.replace(/[^0-9.]/g, ""))} placeholder="محيط الخصر" />
        <Input inputMode="decimal" value={hip} onChange={event => setHip(event.target.value.replace(/[^0-9.]/g, ""))} placeholder="محيط الورك" />
        <Input inputMode="decimal" value={length} onChange={event => setLength(event.target.value.replace(/[^0-9.]/g, ""))} placeholder="طول القطعة" />
        <Input inputMode="decimal" value={sleeve} onChange={event => setSleeve(event.target.value.replace(/[^0-9.]/g, ""))} placeholder="طول الكم" />
      </div>
      <Button type="button" variant="outline" disabled={!customSize.trim()} onClick={addMeasuredSize} className="mt-2 rounded-lg border-purple-200 text-purple-900"><Plus className="h-4 w-4" /> إضافة القياس</Button>
    </div>
    {sizes.length ? <div className="rounded-xl bg-white p-3"><strong className="text-xs text-slate-700">المقاسات المضافة</strong><div className="mt-2 flex flex-wrap gap-2">{sizes.map(size => <button type="button" key={size} onClick={() => toggleSize(size)} title="إزالة المقاس" className="rounded-lg bg-purple-100 px-2.5 py-1.5 text-xs font-bold text-purple-900">{size} ×</button>)}</div></div> : null}
    <div>
      <Label>الألوان المتاحة</Label>
      <Input value={colors.join(", ")} onChange={event => onColorsChange(Array.from(new Set(event.target.value.split(",").map(item => item.trim()).filter(Boolean))))} placeholder="أسود، أبيض، كحلي، أحمر" className="mt-1 bg-white" />
      <small className="mt-1 block text-xs text-slate-500">افصل بين الألوان بفاصلة.</small>
    </div>
    {sizes.length && colorList.length ? <div className="rounded-xl border border-dashed border-purple-200 bg-white p-3">
      <Label>صور خاصة بالمقاس واللون (اختياري)</Label>
      <p className="mt-1 text-xs text-slate-500">ارفع صوراً مختلفة لكل تركيبة؛ تظهر للعميل بعد اختيار المقاس واللون.</p>
      {sizes.flatMap(size => colorList.map(color => <label key={`${size}-${color}`} className="mt-2 flex cursor-pointer items-center justify-between gap-3 rounded-xl bg-purple-50 px-3 py-2 text-xs font-black text-purple-800"><span>{size} · {color} {variantDataUrls.some(item => item.size === size && item.color === color) ? "— تم إرفاق صور" : "— إضافة صور"}</span><span className="inline-flex items-center gap-1"><ImagePlus className="h-4 w-4" /> اختيار صور</span><input type="file" multiple accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={event => onAddVariantImages(size, color, event.target.files)} /></label>))}
    </div> : null}
  </section>;
}
