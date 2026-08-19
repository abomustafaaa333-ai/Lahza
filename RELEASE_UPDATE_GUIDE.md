# تحديث إصدارات Android — لحظة

يعرض تطبيق لحظة تنبيه التحديث عند فتحه فقط إذا كان `versionCode` داخل `client/public/app-update.json` أعلى من رقم APK المثبت، وكان `downloadUrl` رابط HTTPS صالحاً.

## خطوات إصدار APK جديد

1. ارفع `versionCode` و`versionName` في `lahza-apk/app/build.gradle.kts`، مع المحافظة على مفتاح التوقيع نفسه.
2. ابنِ APK Release الموقع وارفعه إلى رابط HTTPS ثابت.
3. حدّث `client/public/app-update.json` بالقيم الجديدة:

```json
{
  "versionCode": 13,
  "versionName": "1.9.0",
  "downloadUrl": "https://your-public-domain.example/Lahza-v1.9.0-release-signed.apk",
  "message": "تتوفر نسخة أحدث من تطبيق لحظة. حمّلها الآن للاستفادة من التحسينات الجديدة."
}
```

4. حدّث رابط واسم الإصدار الظاهرين في `client/src/pages/DownloadApp.tsx`، ثم ابنِ الواجهة وانشرها في الرابط الذي يفتحه التطبيق.
5. اختبر تثبيت APK الجديد فوق النسخة السابقة على هاتف Android فعلي.

> لا يُثبت Android ملفات APK تلقائياً؛ يفتح زر التنبيه رابط الحزمة، ويكمل العميل التثبيت بعد موافقته.

## حدود التحقق في هذا الإصدار

نجح بناء APK 1.8.0 الموقّع، والتحقق من TypeScript، و17 اختبار Vitest، بما فيها ثلاثة اختبارات لوحدة مقارنة الإصدارات. يتطلب التحقق الكامل من نافذة التنبيه وفتح رابط التحميل على هاتف Android فعلي تثبيت الملف واختباره يدوياً.
