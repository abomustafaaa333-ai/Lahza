# إصدار Android الإنتاجي

تم إعداد مشروع Capacitor بمعرّف الحزمة النهائي `com.lahza.app`، وإدماج أيقونة لحظة المعتمدة داخل موارد Android.

## بناء النسخة

```bash
pnpm build:mobile
pnpm build
pnpm exec cap copy android
cd android
./gradlew assembleRelease
```

ينتج البناء ملفاً غير موقّع في:

```text
android/app/build/outputs/apk/release/app-release-unsigned.apk
```

## توقيع النسخة محلياً

لا تحفظ ملف keystore أو كلمات المرور داخل GitHub. استخدم ملف keystore جديداً محفوظاً خارج المشروع، ثم وقّع النسخة محلياً باستخدام Android Studio أو `apksigner`، واحتفظ بنسخة احتياطية من الملف وكلمة مروره في مكان آمن.

قبل أول رفع إلى Google Play يجب مراجعة `applicationId` و`versionCode` و`versionName` وتثبيت القيم النهائية. لا تغيّر معرّف الحزمة بعد نشر التطبيق.

## ملاحظات

- هذه النسخة تستخدم `com.lahza.app` بدلاً من معرّف الاختبار القديم.
- تستهدف Android API 36.
- أي تغيير في مفتاح التوقيع يجعلها تطبيقاً جديداً بالنسبة للنسخة التجريبية القديمة.
- بيانات الحسابات والطلبات تبقى في خادم Railway وقاعدة البيانات نفسها، بينما قد يحتاج مستخدمو النسخة القديمة إلى تثبيت نظيف.
