# نشر واجهة لحظة على Netlify

من إعدادات موقع Netlify، اترك **Base directory** فارغاً (جذر المشروع)، واجعل **Build command** هو `pnpm run build:netlify`، واجعل **Publish directory** هو `client/dist`.

> لا تضبط `client` كـ Base directory في Netlify: الاعتماديات المستخدمة لبناء الواجهة موجودة في جذر المشروع. الملف `client/package.json` موجود للبناء المحلي فقط؛ أمر `npm run build` داخل `client` يعمل بعد تثبيت الاعتماديات من جذر المشروع.

يتضمن المجلد `public/_redirects` قاعدة إعادة توجيه لمسارات React، بما فيها `/download`.

> هذه الحزمة تبني واجهة العميل فقط. تحتاج واجهات الطلبات والفاتورة والإدارة إلى خادم API وقاعدة بيانات متوافقين مع `/api/trpc` قبل أن تعمل تلك الوظائف على نطاق Netlify خارجي.
