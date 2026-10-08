# إصدار Android الإنتاجي

معرّف الحزمة النهائي هو `com.lahza.app`. إصدار Android الحالي هو `2.3.2` برقم بناء `40`، وموقّع بمفتاح الإصدار المتوافق مع APK المنشور سابقاً؛ لذلك يمكن تثبيته كتحديث فوق النسخة الموجودة.

## بناء النسخة

```bash
pnpm install --frozen-lockfile
pnpm build:mobile
pnpm exec cap sync android
cd android
./gradlew app:assembleRelease
```

لإنتاج نسخة موقّعة، مرّر خصائص Gradle التالية من بيئة آمنة خارج المستودع، ولا تكتب قيمها في الملفات أو سجل Git:

- `lahzaKeystoreFile`
- `lahzaKeystorePassword`
- `lahzaKeyAlias`
- `lahzaKeyPassword`

يدعم المشروع تمريرها عبر متغيرات البيئة ذات البادئة `ORG_GRADLE_PROJECT_`. عند إعدادها، ينتج APK الموقّع في:

```text
android/app/build/outputs/apk/release/app-release.apk
```

بعد التحقق من التوقيع ورقم الإصدار، احفظ نسخة التنزيل في:

```text
server/downloads/Lahza-v2.3.2-release-signed.apk
```

ويضمّن أمر `pnpm build` هذا الملف في `dist/public/download`، بينما يشير زر تنزيل التطبيق إلى النسخة نفسها.

## الإشعارات

يبقى `android/app/google-services.json` وملحق Capacitor للإشعارات الفورية مفعّلين في بناء Android. ويرسل الخادم إشعارات FCM باستخدام إعداد `FIREBASE_SERVICE_ACCOUNT_JSON` أو `FIREBASE_SERVICE_ACCOUNT_JSON_BASE64`؛ حافظ على متغيرات البيئة الحالية في الاستضافة عند النشر.

## حماية التوقيع

- لا تحفظ ملف keystore أو كلمات مروره داخل المستودع.
- حافظ على مفتاح التوقيع نفسه بين الإصدارات؛ تغيير المفتاح يمنع تثبيت النسخة كتحديث فوق النسخة السابقة.
- لا تغيّر معرّف الحزمة `com.lahza.app` بعد النشر.
- تستهدف النسخة Android API 36 والحد الأدنى API 24.
