# «توليد روبوت جديد» — the pattern every robot follows

كل روبوت في منصة شام بيتولد بنفس الشكل، عشان يبقى تحت إشراف شاهين ودولة المنصة من أول يوم، ويتفحص
ويتوقف بأمر صاحب الموقع زي أي روبوت قديم. الفكرة: **عقل نقي + مشغّل + تقرير + تسجيل + اختبار + سير عمل**.

## 1. العقل النقي (pure brain)

مجلد `scripts/<name>/` فيه ملف منطق بدون شبكة ولا ملفات (مثال: `scripts/shaheen-scent/behaviour.ts`،
`scripts/shaheen-localization/audit.ts`، `scripts/shaheen-finance/shield.ts`).
المدخلات كلها معاملات (جداول، مصادر، أعداد)، والمخرجات تقرير كامل + درجة + خطة بالعربي + `summaryAr`.
القاعدة: **مفيش رقم مخترع**. لو مصدر مش مقروء، التقرير يقول كده صريح (`signals.read = false`).

## 2. المشغّل (runner)

`scripts/<name>/run.mts` هو اللي بيقرأ الملفات وواجهات القراءة فقط (admin token عند اللزوم)، وبينادي العقل،
وبيكتب `src/data/live/<report>.json` بـ `JSON.stringify(report, null, 1)`، وبيطبع ملخص عربي لـ GitHub Step Summary.
أي واجهة إدارية جديدة تتضاف في `server/core/http.ts` تحت مفتاح `admin` (توكن `SHAM_ADMIN_TOKEN`).

## 3. السجل (org + refuge + precheck)

1. `src/utils/shaheenOrg.ts`: أضف الـ id في `BotId`، وبوت في `BOTS` (قسم + ملف سير عمل + تقرير + `everyHours` +
   `dutiesAr`)، وروابط تعاون في `LINKS` (كل روبوت بيتعاون مع واحد على الأقل).
2. `node --import tsx scripts/shaheen-council/org-doc.mts` لإعادة توليد `SHAHEEN_ORG.md` و`SHAHEEN_HANDBOOK.md`.
3. `src/utils/shaheenRefuge.ts`: سجّل التقرير في `REPORT_OWNER` و`REPORT_NAMES`، والسير عمل في
   `WORKFLOW_OWNER` و`WORKFLOW_NAMES` (اختبار الملجأ بيفشل لو ملف حقيقي مش مفهرس).
4. `scripts/shaheen-council/precheck.ts`: حالة `case '<id>'` في `ownChecks` تقرأ أرقام التقرير وتطلع
   مشكلة + إصلاح + فكرة تطوير.
5. `scripts/shaheen-patrol/shifts.ts`: ضيف البوت لوردية (بحد أقصى 20 دور لكل وردية).
6. `.github/workflows/owner-control.yml`: ضيف الـ id في قائمة `bot` عشان صاحب الموقع يقدر يوقفه.
7. `src/utils/opsLive.ts`: ضيف نفس سطر cron في `SCHEDULES` (اختبار `opsLive` بيقارن بالملفات حرفياً).

## 4. سير العمل (workflow)

`.github/workflows/<name>.yml` بنفس هيكل الروبوتات:
`owner` job يشغل `node scripts/owner/gate.mjs <bot id>`، ثم job رئيسي `needs: owner` و
`if: needs.owner.outputs.allowed == 'true'`، فيه: checkout، Node، Bun، `bun install --frozen-lockfile`،
تشغيل المشغّل، اختبارات السلوك، ثم `node scripts/ci/publish.mjs "..." src/data/live/<report>.json` على `main` بس.
اختار دقيقة cron فاضية (شوف التعليق فوق كل ملف) وتجنب `0` و`10` و`27` و`37` و`47` و`52`.

## 5. الاختبارات

`tests/<name>.test.ts` لازم تغطي:
- الحالة السليمة، والحالة المكسورة (كل نوع عطل)،
- قاعدة الصدق: مصدر مش مقروء ≠ صفر، ومفيش أرقام وهمية،
- إن التقرير موجود في `src/data/live` والملجأ بيفهرسه،
- أي عقد ثابت (زي `server/checkout.ts` لازم ينادي الحارس قبل الدفع) يتأكد من الملف نفسه.

## 6. الخصوصية والقواعد الثابتة

- ممنوع أي بيانات شخصية في التقرير: مفيش أسماء، عناوين، بريد، IP، عناوين تركيبات، أو مبالغ طلبات حقيقية.
- أي إشارة من الزوار لازم تكون **بمبادرة منه** (زرار صريح) وبأقل شكل ممكن (أسماء خامات/أكواد بس).
- العملة والأرقام تتبع لغة الموقع وبلد الزائر — مفيش `<input type="number">` ولا `.toLocaleString()` عريان.
- الأسعار والعمولات تتحسب على السيرفر بس (`src/utils/pricing.ts` + `src/finance/shield.ts`).
