import { and, eq } from "drizzle-orm";
import { drivers, partners } from "../drizzle/schema";
import { getDb } from "./db";
import { sendWahaText } from "./waha";

const DAMASCUS_TIME_ZONE = "Asia/Damascus";
const REMINDER_HOUR = 8;
let lastSentDate: string | null = null;

function getDamascusParts(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: DAMASCUS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const value = (type: string) => parts.find(part => part.type === type)?.value ?? "00";
  return { date: `${value("year")}-${value("month")}-${value("day")}`, hour: Number(value("hour")), minute: Number(value("minute")) };
}

export async function sendDailyReadinessReminders() {
  const db = await getDb();
  if (!db) return { sent: 0, skipped: true };
  const [activeDrivers, activePartners] = await Promise.all([
    db.select({ phone: drivers.phone }).from(drivers).where(eq(drivers.active, true)),
    db.select({ phone: partners.username }).from(partners).where(and(eq(partners.active, true))),
  ]);
  const driverMessage = "هل أنت جاهز؟ عند توفرك أرسل كلمة جاهز، وعند عدم توفرك أرسل كلمة غير جاهز.";
  const partnerMessage = "هل أنت جاهز لاستقبال الطلبات؟ يرجى مراجعة متجرك وأسعارك وإضافة أي صنف جديد غير موجود.";
  const results = await Promise.all([
    ...activeDrivers.map(driver => sendWahaText(driver.phone, { title: "تذكير المناديب اليومي", body: driverMessage })),
    ...activePartners.map(partner => sendWahaText(partner.phone, { title: "تذكير الشركاء اليومي", body: partnerMessage })),
  ]);
  return { sent: results.filter(result => result.sent).length, skipped: false };
}

export function startDailyReadinessReminders() {
  const tick = () => {
    const { date, hour, minute } = getDamascusParts();
    if (hour === REMINDER_HOUR && minute === 0 && lastSentDate !== date) {
      lastSentDate = date;
      void sendDailyReadinessReminders().catch(error => console.warn("Daily readiness reminders failed", error));
    }
  };
  tick();
  setInterval(tick, 30_000);
}
