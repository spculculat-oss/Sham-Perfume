# فيرسال — أعطال البناء: دليل التشخيص والإصلاح

Vercel (`sham-perfume-49bf`) هو **محرّك الموقع** (API وشاهين والدفع والمجتمع)، والموقع نفسه على GitHub Pages.
بس لو بناء Vercel وقع، الـ API والوظائف اللي بتعتمد عليه بيبقى معطّلين، فالتعامل مع الأعطال دي أولوية.

---

## 1. Vercel بيبني إيه وإمتى

| الحاجة | القيمة |
|---|---|
| المشروع الرئيسي | `sham-perfume-49bf` — **بيبني دايماً** على كل دفعة لـ `main` |
| المشروع الاحتياطي | `sham-perfume.vercel.app` — بيتبني بس لو ملفات الـ redirect اتغيّرت (`scripts/vercel-ignore.sh`) |
| التثبيت | `npx --yes bun@1.4.3 install --frozen-lockfile` (من `bun.lock`) |
| أمر البناء | `npm run build:vercel` = `vite build` + صفحات المنتجات + ملفات SEO + `scripts/build-vercel.mjs` |
| الفروع اللي بتتنشر | **`main` بس** (`git.deploymentEnabled: {"main": true, "**": false}`) |
| أي فرع تاني | مستبعد تلقائياً — `fix/…`, `agent/…`, `arena/…`, `feature/a/b`… أي اسم. `deploymentEnabled` **قائمة تعطيل مش قائمة سماح**: الفرع غير المذكور بيرجع `true` |

---

## 2. إعادة نفس البناء محلياً (أول خطوة في أي عطل)

```bash
npx --yes bun@1.4.3 install --frozen-lockfile   # نفس أمر Vercel بالحرف
npm run build:vercel                            # نفس أمر البناء بالحرف
```

- نجح محلياً وفشل على Vercel ⇒ العطل بيئة (متغيّر ناقص، ذاكرة، أو مؤقت) → `npm run build:vercel` مرة تانية، وبعدها إعادة نشر من لوحة Vercel.
- فشل محلياً ⇒ العطل في الكود، ورسالة الخطأ بتقول الملف والسطر.

> **متستخدمش `npm install`** في هذا المستودع: فيه تعارض peer بين `esbuild@^0.25` و`vite@8` (بيطلب `^0.27 || ^0.28`)،
> فـ `npm install` بيرمي `ERESOLVE` من غير `--legacy-peer-deps`. التثبيت المعتمد هو **bun** بالنَسخة المثبّتة في `package.json`.

---

## 3. قراءة رسالة الخطأ

### أخطاء JSX — السطر اللي في اللوج مش هو مكان المشكلة

```text
[builtin:vite-transform] Unexpected token. Did you mean `{'}'}` or `&rbrace;`?
╭─[ src/admin/ContractsPanel.tsx:232:8 ]
232 │     </>}
```

المُترجم بيكمل لحد أول رمز مش متوقَّع، فبيسجّل المكان اللي **وقف فيه** مش المكان اللي **ناقص فيه** الوسم.
في المثال ده الوسم الناقص كان `</section>` فوق بـ 8 سطور (كان فاتح `<section className={card}>` للمتاجر وخلص
بالقائمة من غير ما يقفلها). القاعدة: **دَوّر لفوق** على أول `<section>`/`<div>`/`<>` مفتوح من غير إغلاق.

```bash
# عدّ الفتح والقفل في الملف المشكوك فيه
grep -c '<section' src/admin/ContractsPanel.tsx; grep -c '</section>' src/admin/ContractsPanel.tsx
# فحص سريع للملف لوحده قبل ما تشغّل البناء كله
npx esbuild src/admin/ContractsPanel.tsx --outfile=/tmp/check.js
```

### أخطاء تانية شائعة

| الرسالة | المعنى | التصرف |
|---|---|---|
| `Cannot find module …` | حزمة مش مثبّتة أو مش في `bun.lock` | ضيف الاعتماد + `bun install` وارفع `bun.lock` معاه |
| `error TS####` | خطأ أنواع (مش بيوقف Vite عادةً لكن بيوقف `npm run lint`) | `npm run lint` |
| `Command "npm run build:vercel" exited with 1` | ده غلاف Vercel — السبب الحقيقي فوقه في اللوج | اقرأ أول خطأ فوق السطر ده |
| `[LAMBDA_SIZE_EXCEEDED] Total bundle size (…) exceeds the maximum` | فيرسال بنى دالة زيادة (زي Python من `api/`) فالحزمة عدّت 250 ميجا | شوف القسم اللي تحت — الحل `.vercelignore` |
| `ENOSPC` / `Killed` | ذاكرة أو مساحة | أعد النشر؛ لو اتكرر راجع حجم الأصول |

---

## 4. حد الـ 250 ميجا — `LAMBDA_SIZE_EXCEEDED` (حادثة 2026‑11‑14)

```text
23:02:29  Vercel output ready: static React site + isolated Node.js API function.   ← الموقع نجح
23:02:30  Installing required dependencies from api/requirements.txt...
23:02:31  Error: [LAMBDA_SIZE_EXCEEDED] Total bundle size (235.01 MB) exceeds the maximum size
```

**السبب:** فيرسال بيكتشف تلقائياً أي `.py` جوّه `api/` كـ Python Serverless Function، وينزّل
`api/requirements.txt` (`fastapi` + `uvicorn[standard]` + `pydantic` + `starlette`). والموقع مش بيستخدم
الفولدر ده أصلاً: `api/main.py` هو سيرفر FastAPI للتشغيل المحلي بس (`API_README.md`)، والـ API الحقيقي
هو `server/vercel-entry.cts` → `.vercel/output/functions/api.func`.

**الإصلاح:** `.vercelignore` في جذر المستودع بيمنع رفع `api/` خالص:

```gitignore
api/
test_scraper.py
test_order_manager.py
```

- الملفات بتفضل في المستودع (التشغيل المحلي شغال زي ما هو)، بس مش بتترفع على فيرسال.
- `.vercelignore` شغّال بمنطق `.gitignore`، والاستثناءات الافتراضية (`node_modules`, `.git`) بتفضل مطبقة.
- الحرس: `tests/vercelIgnore.test.ts` بيتأكد إن `api/` في الملف وإن مدخل الدالة على فيرسال لسه Node.

**قاعدة:** أي فولدر `.py` جديد في الجذر أو في `api/` لازم يتضاف لـ `.vercelignore` أو يتنقل لاسم
مش `api/` — وإلا الدالة البايثون ترجع والحزمة تعدّي الحد تاني.

---

## 5. نشر فروع العمل + `vercel-ignore.sh: No such file or directory` (2026‑11‑27 و2026‑11‑28)

```text
15:33:25.720 Cloning … (Branch: agent/approved-store-design-arabic-2026-11-27, Commit: 62f2d84)
15:33:30.406 Found .vercelignore (repository root)          ← إصلاح الـ Python شغّال
15:33:30.428 Removed 5 ignored files defined in .vercelignore
15:33:30.663 Running "sh scripts/vercel-ignore.sh"
15:33:30.699 sh: scripts/vercel-ignore.sh: No such file or directory
```

**السبب:** الفرع `agent/…` اتفرّع من `main` **قبل** الكوميت اللي ضاف `scripts/vercel-ignore.sh`،
فـ `vercel.json` فيه بيطلب ملف مش موجود في الفرع ده. النشر على `main` نفسه سليم — `/api/health`
بيرد `ok` من نفس المشروع.

**ليه الفرع ده اتنشر أصلاً؟** لأن `git.deploymentEnabled` في `vercel.json` **قائمة تعطيل مش قائمة سماح**:
أي فرع **مش مذكور** فيها بيتنشر عادي. ولما المشروع الرئيسي يبني من فرع عمل، ممكن تدفعة واحدة تبقى
هي الـ production.

**الإصلاح الأول (ناقص):** ضفنا `agent/**` و`preview/**`. لكن ده ماحلّش المشكلة، لأن **كل جلسة بتختار
اسم فرع جديد** — والدليل حادثة اليوم اللي بعده.

### التكملة: 2026‑11‑28 — `fix/shaheen-faster-turns-stable-language-2026-11-28`

```text
01:53:21.267 Running "sh scripts/vercel-ignore.sh"
01:53:21.303 sh: scripts/vercel-ignore.sh: No such file or directory
01:53:21.3xx → البناء كمّل عادي (193 سطر) ونجح
```

لاحظ حاجتين:
1. السطر التحذيري **مش فشل نشر** — الأمر خرج بكود ≠ 0 والبناء كمّل.
2. الفرع `fix/…` **مطابقش** `agent/**` ولا `preview/**` ⇒ اتنشر رغم إنه فرع عمل، والإنتاج ممكن يتلوّث.

**الدرس:** تعداد أنماط الفروع واحد واحد **مستحيل يلاحق** أسماء الجلسات. فالقاعدة اتعكست:

```json
"git": { "deploymentEnabled": { "main": true, "**": false } }
```

- `**` بتغطي أي فرع (بما فيها `feature/a/b`)، و`main: true` بترجّح لأن فيرسال بيقول:
  «If a branch matches multiple rules and at least one rule is `true`, a deployment will occur.»
- النتيجة: **`main` بس** هو اللي بيوصل للإنتاج، وأي فرع جديد بيبقى مستبعد تلقائياً من غير تعديل.

**تنضيف السكربت:** المشروع الرئيسي بقى بيتحدد **قبل** أي أمر git. زمان كان الأمر بيوصل لـ
`git diff --quiet HEAD^ HEAD` في clone مقطوع (shallow) فيطبع `fatal: bad revision 'HEAD^'` ثم يكمّل.
دلوقتي المقارنة (للمشروع الاحتياطي بس) بقت على `$VERCEL_GIT_PREVIOUS_SHA` بدل `HEAD^`، ومفيش `fatal`
بيوصل للوج. (`tests/vercelIgnore.test.ts` بيثبت ده.)

**قواعد:**
- متضيفش أنماط فروع فردية تاني — `**` مع `main: true` هي القاعدة، وأي استثناء مستقبلي يتكتب صريح.
- الملف اللي `vercel.json` بينده لازم يكون موجود في **كل** فرع بيتبني: أي إعادة تسمية لـ
  `scripts/vercel-ignore.sh` تتزامن مع `ignoreCommand` في نفس الكوميت (الاختبار بيمنع الانفصال).
- أي فرع عمل قديم اتفرّع قبل السكربت: يتعمله rebase على `main` أو يتشال — أو من لوحة فيرسال:
  **Settings → Build and Deployment → Ignored Build Step → Automatic** (بيلغي قراءة `ignoreCommand`).

---

## 6. حادثة 2026‑10‑20 (مرجع)

- **الدفعة اللي فشلت:** `06b235a` (دمج PR #165) — `src/admin/ContractsPanel.tsx:232` وسم `</section>` ناقص
  (ضاع أثناء حل تعارض الدمج)، فالبناء وقع في 2.2 ثانية عند `vite build`.
- **الإصلاح:** `0df446d` — سطرين بس: `</section>` + سطر فاضي.
- **التأكيد:** `19bb1b0` على `main` — «Build, test and deploy Pages» نجح، وحالة Vercel على نفس الدفعة
  `Deployment has completed` للـ production.
- **الدرس:** الخطأ مكنش في Vercel ولا في الاعتمادات — كان **وسم JSX واحد**، وGitHub Actions كانت كاشفة الفشل
  في نفس اللحظة (`pages.yml` → Type check + Build)، فالبناء المحلي هو أسرع طريق للتأكيد.

---

## 7. منع التكرار

1. أي PR مايتدمجش قبل ما يبقى «Build, test and deploy Pages / Check and build React» **أخضر**
   (Settings → Branches → Branch protection rules → Require status checks to pass).
   الإصلاحات الصغيرة اللي بتتكتب مباشرة على `main` بتعدّي من الحماية دي، فالمراجعة اليدوية للـ diff مهمة.
2. تعارضات الدمج بتتحل في محرر، وبعدها **لازم** `npm run lint && npm run build:vercel` قبل الـ merge —
   الوسوم الناقصة مش بتظهر في `git diff` كخطأ.
3. `Shaheen Doctor` (`.github/workflows/shaheen-doctor.yml`) بيراقب النشر؛ ومتغيّر `VERCEL_TOKEN` في الأسرار
   بيسمح له يعيد النشر لوحده (`redeploy_vercel` في `scripts/doctor/agent.ts`). من غيره بيطلب من صاحب الموقع
   يعيد النشر يدوياً.
4. متشغّلش build من فرع عمل على المشروع الرئيسي: `main` بس هو اللي بيغذّي الإنتاج (`**` معطّلة)،
   وفرع العمل اللي محتاج معاينة يترفع على مشروع Vercel منفصل (Branch Tracking) مش على `sham-perfume-49bf`.
5. أي فرع عمل قديم اتنشر قبل القاعدة دي: اتمسح أو اتعمله rebase، وإلا هيفضل يحمل `vercel.json` قديم
   ويفضل يطبع `No such file or directory` كل مرة.
