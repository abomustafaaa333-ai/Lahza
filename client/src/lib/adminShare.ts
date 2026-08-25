export type ShareableOrder = {
  id: number;
  customerName: string;
  customerPhone: string;
  orderType: "delivery" | "taxi";
  taxiType: "standard" | "van" | null;
  pickupLocation: string | null;
  destination: string | null;
  paymentMethod: "sham_cash" | "cash";
  totalAmount: number;
  deliveryDistanceMeters?: number;
  deliveryFee?: number;
  lines: Array<{ itemName: string; quantity: string | number; unit: string }>;
};

declare global {
  interface Window {
    LahzaNativeShare?: {
      shareBase64: (base64: string, fileName: string, mimeType: string) => void;
    };
  }
}

export function mapUrlFromNotes(notes: string | null) {
  return notes?.match(/رابط الخريطة:\s*(https?:\/\/[^\s]+)/)?.[1] ?? null;
}

export function buildWhatsAppLocationUrl(customerName: string, mapUrl: string) {
  const text = `موقع طلب ${customerName} لدى لحظة:\n${mapUrl}`;
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

export function buildEmployeeOrderWhatsAppUrl(employeePhone: string, order: ShareableOrder, mapUrl: string | null) {
  const orderRows = order.orderType === "taxi"
    ? [`الرحلة: ${order.taxiType === "van" ? "فان" : "تاكسي"}`, `من: ${order.pickupLocation ?? "غير محدد"}`, `إلى: ${order.destination ?? "غير محدد"}`]
    : order.lines.map(line => `• ${line.itemName} × ${line.quantity} ${line.unit}`);
  const message = [
    `طلب لحظة #${order.id}`,
    `العميل: ${order.customerName}`,
    `الهاتف: ${order.customerPhone}`,
    ...orderRows,
    order.orderType === "delivery" && order.deliveryDistanceMeters ? `مسافة الطريق: ${(order.deliveryDistanceMeters / 1000).toFixed(1)} كم` : "",
    order.orderType === "delivery" && order.deliveryFee !== undefined ? `رسوم التوصيل: ${formatSyp(order.deliveryFee)}` : "",
    `الإجمالي: ${formatSyp(order.totalAmount)}`,
    mapUrl ? `الموقع: ${mapUrl}` : "الموقع: لا يتوفر رابط GPS لهذا الطلب",
  ].filter(Boolean).join("\n");
  return `https://wa.me/${employeePhone.replace(/\D/g, "")}?text=${encodeURIComponent(message)}`;
}

function vCardValue(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/([;,])/g, "\\$1").replace(/[\r\n]+/g, " ");
}

export function buildContactVCard(customerName: string, customerPhone: string) {
  return [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `FN:${vCardValue(customerName)}`,
    `TEL;TYPE=CELL:${customerPhone.replace(/\s/g, "")}`,
    "NOTE:عميل لحظة — منبج",
    "END:VCARD",
    "",
  ].join("\r\n");
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function blobToBase64(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? "");
      resolve(result.includes(",") ? result.split(",", 2)[1] ?? "" : result);
    };
    reader.onerror = () => reject(reader.error ?? new Error("تعذر تجهيز الملف للمشاركة"));
    reader.readAsDataURL(blob);
  });
}

export type ShareResult = "native" | "web" | "download";

export async function shareBlob(blob: Blob, fileName: string, title: string): Promise<ShareResult> {
  if (window.LahzaNativeShare) {
    window.LahzaNativeShare.shareBase64(await blobToBase64(blob), fileName, blob.type || "application/octet-stream");
    return "native";
  }

  const file = new File([blob], fileName, { type: blob.type || "application/octet-stream" });
  if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
    await navigator.share({ files: [file], title });
    return "web";
  }

  downloadBlob(blob, fileName);
  return "download";
}

function roundedRect(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  const r = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + r, y);
  context.lineTo(x + width - r, y);
  context.quadraticCurveTo(x + width, y, x + width, y + r);
  context.lineTo(x + width, y + height - r);
  context.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  context.lineTo(x + r, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - r);
  context.lineTo(x, y + r);
  context.quadraticCurveTo(x, y, x + r, y);
  context.closePath();
}

function wrapText(context: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (context.measureText(candidate).width <= maxWidth || !current) current = candidate;
    else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function dataRows(order: ShareableOrder) {
  const orderRows = order.orderType === "taxi"
    ? [
      `رحلة ${order.taxiType === "van" ? "فان" : "تاكسي"}`,
      `من: ${order.pickupLocation ?? "غير محدد"}`,
      `إلى: ${order.destination ?? "غير محدد"}`,
    ]
    : order.lines.map(line => `${line.itemName} × ${line.quantity} ${line.unit}`);
  return [
    `العميل: ${order.customerName}`,
    `الهاتف: ${order.customerPhone}`,
    ...orderRows,
    order.orderType === "delivery" && order.deliveryDistanceMeters ? `مسافة الطريق: ${(order.deliveryDistanceMeters / 1000).toFixed(1)} كم` : "",
    order.orderType === "delivery" && order.deliveryFee !== undefined ? `رسوم التوصيل: ${formatSyp(order.deliveryFee)}` : "",
    `الدفع: ${order.paymentMethod === "sham_cash" ? "شام كاش" : "نقداً عند الاستلام"}`,
    order.orderType === "delivery" ? `الإجمالي المبدئي: ${formatSyp(order.totalAmount)}` : "السعر: يحدد لاحقاً",
  ];
}

export async function buildOrderImage(order: ShareableOrder) {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) throw new Error("تعذر إنشاء صورة الطلب");

  const width = 1080;
  const padding = 72;
  const textWidth = width - padding * 2;
  context.font = "600 31px sans-serif";
  const rows = dataRows(order).flatMap(row => wrapText(context, row, textWidth));
  const height = 290 + rows.length * 56 + 88;
  canvas.width = width;
  canvas.height = height;

  context.fillStyle = "#f8fafc";
  context.fillRect(0, 0, width, height);
  context.fillStyle = "#1e3a8a";
  context.fillRect(0, 0, width, 165);
  context.fillStyle = "#ff742d";
  context.fillRect(0, 165, width, 13);

  context.textAlign = "right";
  context.fillStyle = "#ffffff";
  context.font = "800 52px sans-serif";
  context.fillText("لحظة", width - padding, 72);
  context.font = "600 26px sans-serif";
  context.fillStyle = "#dbeafe";
  context.fillText("بطاقة طلب للمشاركة", width - padding, 118);

  context.fillStyle = "#ffffff";
  roundedRect(context, padding, 212, width - padding * 2, height - 260, 26);
  context.fill();
  context.fillStyle = "#ff742d";
  context.font = "800 34px sans-serif";
  context.fillText(`الطلب #${order.id}`, width - padding - 36, 270);
  context.fillStyle = "#64748b";
  context.font = "600 24px sans-serif";
  context.fillText(order.orderType === "taxi" ? "سيارة أجرة" : "توصيل للبيت", width - padding - 36, 314);

  let y = 380;
  context.fillStyle = "#334155";
  context.font = "600 31px sans-serif";
  rows.forEach((row, index) => {
    if (index === 2) {
      context.strokeStyle = "#e2e8f0";
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(padding + 36, y - 30);
      context.lineTo(width - padding - 36, y - 30);
      context.stroke();
    }
    context.fillText(row, width - padding - 36, y);
    y += 56;
  });

  context.fillStyle = "#94a3b8";
  context.font = "600 20px sans-serif";
  context.fillText("خدمات لحظة · منبج", width - padding, height - 34);

  const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("تعذر حفظ صورة الطلب");
  return blob;
}

export async function shareOrderImage(order: ShareableOrder) {
  return shareBlob(await buildOrderImage(order), `lahza-order-${order.id}.png`, `طلب لحظة #${order.id}`);
}

export async function shareCustomerContact(customerName: string, customerPhone: string) {
  const safeName = customerName.replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, "-").slice(0, 32) || "customer";
  const file = new Blob([buildContactVCard(customerName, customerPhone)], { type: "text/vcard" });
  return shareBlob(file, `lahza-contact-${safeName}.vcf`, `جهة اتصال ${customerName}`);
}
import { formatSyp } from "@shared/lahza";
