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
| الفروع | `arena/**` متعطّلة على Vercel (`vercel.json` → `git.deploymentEnabled`) — بتتحقق عندنا في GitHub Actions |

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

## 5. حادثة 2026‑10‑20 (مرجع)

- **الدفعة اللي فشلت:** `06b235a` (دمج PR #165) — `src/admin/ContractsPanel.tsx:232` وسم `</section>` ناقص
  (ضاع أثناء حل تعارض الدمج)، فالبناء وقع في 2.2 ثانية عند `vite build`.
- **الإصلاح:** `0df446d` — سطرين بس: `</section>` + سطر فاضي.
- **التأكيد:** `19bb1b0` على `main` — «Build, test and deploy Pages» نجح، وحالة Vercel على نفس الدفعة
  `Deployment has completed` للـ production.
- **الدرس:** الخطأ مكنش في Vercel ولا في الاعتمادات — كان **وسم JSX واحد**، وGitHub Actions كانت كاشفة الفشل
  في نفس اللحظة (`pages.yml` → Type check + Build)، فالبناء المحلي هو أسرع طريق للتأكيد.

---

## 6. منع التكرار

1. أي PR مايتدمجش قبل ما يبقى «Build, test and deploy Pages / Check and build React» **أخضر**
   (Settings → Branches → Branch protection rules → Require status checks to pass).
   الإصلاحات الصغيرة اللي بتتكتب مباشرة على `main` بتعدّي من الحماية دي، فالمراجعة اليدوية للـ diff مهمة.
2. تعارضات الدمج بتتحل في محرر، وبعدها **لازم** `npm run lint && npm run build:vercel` قبل الـ merge —
   الوسوم الناقصة مش بتظهر في `git diff` كخطأ.
3. `Shaheen Doctor` (`.github/workflows/shaheen-doctor.yml`) بيراقب النشر؛ ومتغيّر `VERCEL_TOKEN` في الأسرار
   بيسمح له يعيد النشر لوحده (`redeploy_vercel` في `scripts/doctor/agent.ts`). من غيره بيطلب من صاحب الموقع
   يعيد النشر يدوياً.
