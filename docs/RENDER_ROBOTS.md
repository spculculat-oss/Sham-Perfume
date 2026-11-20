# تشغيل روبوتات شام على Render (خطوات صاحب الموقع)

الروبوتات كلها (32 روبوت على مواعيدهم) بقت بتشتغل على **سيرفر واحد مجاني على Render** بدل GitHub.
الملف اللي بيوصف السيرفر: `render.yaml`، والكود في `scripts/robots/`.

> **من غير فيزا؟** نفس السيرفر يشتغل على Hugging Face ببلاش ومن غير كارت: الخطوات في `docs/HUGGINGFACE_ROBOTS.md`.

## ١) مفتاح GitHub للروبوتات (مرة واحدة)

1. افتح: https://github.com/settings/personal-access-tokens/new
2. **Token name** (اسم المفتاح): `sham-robots`
3. **Expiration** (مدة الصلاحية): اختار سنة (أو المدة اللي تريحك، وتجدده لما يخلص).
4. **Repository access** (الوصول للمستودعات): اختار **Only select repositories** (مستودعات محددة بس) واختار `Sham-Perfume`.
5. **Permissions** (الصلاحيات) ← **Repository permissions**:
   - **Contents** (الملفات): `Read and write` (قراءة وكتابة) — عشان اللقطة اليومية.
   - **Issues** (المهام): `Read and write`.
   - **Pull requests** (طلبات الدمج): `Read and write` — لدولة المنصة.
   - **Actions**: `Read-only` (قراءة بس) — عشان الفحص الشامل يشوف الشغل.
6. اضغط **Generate token** (اعمل المفتاح) وانسخه. ماتبعتهوش لحد، هتحطه في Render بنفسك بس.

## ٢) إنشاء السيرفر على Render — الطريقة السهلة (من غير فيزا)

1. افتح: https://dashboard.render.com/web/new — أو **New** (جديد) ← **Web Service** (خدمة ويب).
2. اختار المستودع `Sham-Perfume` واضغط **Connect** (توصيل).
3. **Name** (الاسم): `sham-robots` — **Language**: هيختار `Docker` لوحده — **Instance Type** (نوع السيرفر): **Free**.
4. **Environment Variables** (الإعدادات السرية): `ROBOTS_GITHUB_TOKEN` و`GEMINI_API_KEY` و`SHAM_ADMIN_TOKEN`.
5. **Deploy Web Service** (شغّل الخدمة). مفيش أي مسار محتاج يتكتب.
6. بعد ما يشتغل (اختياري): **Settings** (الإعدادات) ← **Auto-Deploy** (التحديث التلقائي) ← `Off`.

## ٢-ب) أو بالمخطط (Blueprint) — ممكن يطلب فيزا للتأكيد

1. افتح: https://dashboard.render.com/blueprints
2. اضغط **New Blueprint Instance** (نسخة جديدة من المخطط).
3. اختار المستودع `spculculat-oss/Sham-Perfume`.
   لو مش ظاهر: اضغط **Configure account** (ضبط الحساب) واسمح لـ Render يشوف المستودع ده بس.
4. **Blueprint Name** (الاسم): `sham-robots` — والفرع **main**.
5. هيطلب منك القيم دي (الباقي سيبه فاضي):
   - `ROBOTS_GITHUB_TOKEN`: المفتاح اللي عملته في الخطوة ١.
   - `GEMINI_API_KEY`: نفس مفتاح Gemini اللي في GitHub / Vercel.
   - `SHAM_ADMIN_TOKEN`: نفس رمز الإدارة اللي في Vercel.
   - أي مفتاح تاني عندك (اختياري): `GSC_SERVICE_ACCOUNT_JSON`، `BING_WEBMASTER_API_KEY`، …
6. اضغط **Apply** (تطبيق). البناء بياخد من 5 لـ 10 دقايق.
7. لما يخلص افتح: https://sham-robots.onrender.com
   هتلاقي صفحة «سيرفر روبوتات شام 🤖» فيها كل روبوت اشتغل إمتى ونتيجته.
   (لو Render اداك عنوان مختلف، ابعتهولي في الشات وأنا أظبط خريطة التشغيل عليه.)

## ٣) إزاي بيشتغل

- كل روبوت بيشتغل في ميعاده، واحد ورا التاني.
- قبل كل تشغيل السيرفر بيقرا **مفاتيحك** (فرامل الطوارئ والإيقاف) وأوامر **دولة المنصة** من GitHub — لو وقفت روبوت، مش هيشتغل.
- النتايج بتتجمع على السيرفر وتتنشر على الموقع **مرة واحدة في اليوم** (الساعة 4:30 الفجر بتوقيت مصر تقريباً) — ده التزامنا مع GitHub.
- إيقاف الوقفة المؤقتة للاستيراد (L-03) لسه شغال زي ما هو.
- كل روبوت بياخد المفاتيح اللي يحتاجها بس.

## حدود السيرفر المجاني

- 512 ميجا ذاكرة: الحاجات التقيلة (المعلم المحلي، منقّح الصور، فحص الموبايل بالمتصفح، بوابة جوجل استوديو) **مش بتشتغل** وبيتكتب ده على صفحة السيرفر.
  لو حبيت تشغلها بعدين: ترقّي الخطة من Render وتغيّر `ROBOTS_HEAVY` لـ `1`.
- السيرفر المجاني بينام بعد 15 دقيقة من غير زيارة؛ هو بيزور نفسه كل 10 دقايق عشان يفضل صاحي.
- الإعدادات المفيدة (Render ← الخدمة ← **Environment**):
  - `ROBOTS_ENABLED` = `0` يوقف كل المواعيد (فرامل من Render نفسه).
  - `ROBOTS_RUN_NOW` = `shaheen-doctor.yml,shaheen-patrol.yml` يشغّلهم مرة أول ما السيرفر يقوم (للتجربة).
  - `ROBOTS_SNAPSHOT_HOUR` = ساعة اللقطة اليومية بتوقيت UTC (الافتراضي 2).
