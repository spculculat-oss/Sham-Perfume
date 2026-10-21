# Sham Core — نواة شام للذكاء الاصطناعي والخدمات

Sham Core هو مساعد الخدمات ولوحة الإدارة داخل موقع «صمم عطرك مع شام». يستقبل الزوار في كل الخدمات: الأدوات، المتجر، العطور المخصصة، الجملة، الاستشارات، والدعم. ويقدر يستقبل أي خدمة تجارية جديدة تضيفها الإدارة **من غير تعديل الكود**.

الهيكل مبني من الصفر داخل المستودع. البيانات، والمنطق، والأدوات، والذاكرة، والإدارة كلها ملك شام. النموذج اللغوي **مكوّن اختياري يمكن تبديله**، ومحرك شام الداخلي يشتغل حتى من غير أي مفتاح أو اتصال بأي منصة.

---

## 1) دراسة الهيكل البنائي للمنصات الخمس

> الملخص ده مبني على المعلن رسمياً والمنشور عن كل منصة. التفاصيل الداخلية الدقيقة لأغلب المنصات غير منشورة، فهنا نوصف الأنماط المعمارية العامة فقط.

| المنصة | ملامح الهيكل المعلنة | الفكرة اللي أخدناها | تنفيذها في Sham Core |
|---|---|---|---|
| **ChatGPT** (OpenAI) | نموذج Transformer مدرّب مسبقاً، وبعدها ضبط بالتعليمات وتعلم بالتعزيز من تقييم البشر (RLHF). مع النموذج: استدعاء أدوات (function calling)، ذاكرة للمستخدم، GPTs مخصصة، ومحادثات محفوظة | الأدوات المنظمة، الذاكرة، شخصيات قابلة للتخصيص | `tools.ts` سجل أدوات بمخطط ثابت • `Conversation.memory` (اسم الزائر، آخر خدمة، آخر رقم طلب) • الشخصية ورسالة الترحيب تتعدل من الإدارة |
| **Claude** (Anthropic) | Transformer مع «الذكاء الاصطناعي الدستوري» (Constitutional AI): مبادئ مكتوبة توجّه السلوك. سياق طويل، Projects بقاعدة معرفة، Artifacts كمخرجات منظمة، واستخدام أدوات | قواعد سلوك صريحة، مخرجات منظمة بدل نص حر، معرفة خاصة بالمشروع | `systemPrompt()` فيه قواعد صارمة (ممنوع اختراع أسعار، ممنوع ادعاء إتمام طلب، ممنوع طلب بيانات بطاقات) • **بطاقات إجراءات** (استمارة، منتجات، تتبع) بدل نص • قاعدة معرفة تديرها الإدارة |
| **Gemini** (Google) | نموذج متعدد الوسائط من الأساس، واستخدم معمارية Mixture-of-Experts (معلنة في Gemini 1.5)، وسياق طويل جداً، وتأسيس الإجابة على نتائج بحث Google مع مصادر | التأسيس (Grounding) مع ذكر المصادر | `retrieve_knowledge` باسترجاع BM25 على معرفة شام وخدماتها ومنتجاتها • كل رد يرجع ومعاه `citations` بتظهر للزائر |
| **DeepSeek** | V3: معمارية MoE (حوالي 671 مليار معامل، منها تقريباً 37 ملياراً نشطة لكل رمز)، Multi-head Latent Attention، وR1 للتفكير المدرّب بالتعزيز (GRPO). الأوزان مفتوحة وتكلفة التشغيل منخفضة | توجيه كل طلب لـ«خبير» متخصص، والاستضافة الذاتية لنموذج مفتوح | `router.ts` بوابة خبراء: الرسالة تتقيّم مقابل النوايا وكلمات كل خدمة، والأعلى يتولاها (درجات التوجيه تظهر للإدارة) • محرك `self_hosted` لأي خادم متوافق مع OpenAI API (Ollama / vLLM / LM Studio) بنماذج مفتوحة زي Qwen وLlama وDeepSeek • حذف `<think>` من نماذج التفكير |
| **Manus** | «وكيل عام» (General AI Agent): حلقة تخطيط ← تنفيذ ← ملاحظة، فوق نماذج أساس، وبيستخدم أدوات (متصفح، طرفية، ملفات) في بيئة سحابية معزولة، وقائمة مهام بيتابع تقدمها | حلقة الوكيل، ومسار تنفيذ قابل للفحص | `orchestrator.ts`: حراسة ← ذاكرة ← توجيه ← استرجاع ← خطة ← أدوات ← محرك ← تركيب ← حفظ • **مسار تنفيذ (trace)** كامل بالأزمنة لكل رد، بيظهر في لوحة الإدارة و«مختبر المساعد» |

### فرق جوهري مقصود
المنصات العامة بتخلي النموذج يقرر وينفذ. في التجارة ده خطر، لأن النموذج ممكن يخترع سعر أو يأكد طلب مش موجود. علشان كده:
- **الأسعار والمخزون والإجماليات** بتتحسب على الخادم من الكتالوج فقط، وأي سعر جاي من المتصفح بيتجاهل.
- **أي إجراء بيغيّر حاجة** (طلب، عرض سعر، تذكرة) مش متاح لأي نموذج. بيتحول لاستمارة الزائر يأكدها بنفسه، ودي نسخة مبسطة من «موافقة الإنسان» في أنظمة الوكلاء.
- النموذج اللغوي **بيعيد صياغة** إجابة صحيحة جهّزها المنسق («SAFE DRAFT») من حقائق مسترجعة، وممنوع يضيف حقائق جديدة.

---

## 2) المعمارية

```
 الزائر (ShamAssistant widget)                     الإدارة (#admin)
        │  /api/assistant/*                              │  /api/admin/*  (Bearer SHAM_ADMIN_TOKEN)
        ▼                                                ▼
 ┌─────────────────────────── Orchestrator (حلقة الوكيل) ────────────────────────────┐
 │ guard → memory → router(experts) → retrieve(BM25) → plan → tools → engine → compose │
 └──────┬──────────────┬──────────────────┬───────────────────────┬───────────────────┘
        │              │                  │                       │
   Repository      Tool registry     Engine policy (failover)   Trace → admin
 (قواعد العمل)   retrieve_knowledge   self_hosted → gemini →
        │         search_catalog       openai → claude →
        ▼         prepare_request_form deepseek → sham_local ✅ دائماً
     Store        track_order
 file | firestore calc_concentration
   | memory       list_services
```

| الملف | الدور |
|---|---|
| `server/core/types.ts` | نماذج البيانات: الخدمة، المنتج، المستند، المحادثة، الطلب، الإعدادات |
| `server/core/text.ts` | تطبيع العربية (الهمزات، التاء المربوطة، التشكيل، الأرقام العربية) وجذع خفيف وفهرس BM25 |
| `server/core/router.ts` | توجيه النوايا والخدمات واستخراج الكيانات (رقم الطلب، الهاتف، البريد، الحجم، النسبة، الاسم) |
| `server/core/platformGuide.ts` | «دليل المنصة»: كل أداة وميزة يشوفها الزائر (اسمها، شرحها، تبويبها، كلمات بحثها)، ومستندات المعرفة اللي بتتزرع منها، وكتالوج النموذج، وجدول الشحن الحي |
| `server/core/tools.ts` | الأدوات. القراءة تلقائية، والكتابة لازم الزائر يأكدها |
| `server/core/engines.ts` | طبقة المحركات وحالة إعداد كل محرك |
| `server/core/orchestrator.ts` | حلقة الوكيل، والمركّب المحلي بالعربية والإنجليزية، وتعليمات النموذج (وفيها كتالوج المنصة وجدول الشحن) |
| `server/core/repository.ts` | الإضافة والتعديل والحذف، والتسعير على الخادم، وحجز المخزون وإرجاعه، وأرقام الطلبات، والتتبع الآمن |
| `server/core/store.ts` / `firestoreStore.ts` | التخزين: ملف JSON بكتابة ذرّية، وFirestore عبر REST بحساب خدمة، والذاكرة |
| `server/core/http.ts` | المسارات العامة ومسارات الإدارة، وتحديد المعدل، والتحقق من الرمز بزمن ثابت |
| `src/assistant/*` | ودجت الزائر: بطاقات الطلب والسلة والتتبع، والتحويل لموظف مع انتظار رده |
| `src/admin/*` | لوحة الإدارة (تُحمّل عند الطلب فقط) |

### «دليل المنصة» — المساعد ملم بكل جديد

المنصة بتتطور باستمرار، والمساعد لازم يعرف الأدوات والمكتبات والمجتمع زي ما الزائر بيشوفهم. عشان كده في
ملف واحد (`server/core/platformGuide.ts`) بيوصف كل ميزة:

- **الاسم والشرح وطريقة الاستخدام** بالعربي والإنجليزي، **وتبويب الموقع** اللي بيفتحها، وكلمات البحث.
- **مستند معرفة** لكل ميزة بيتزرع مع باقي قاعدة المعرفة، فالرد بالاسترجاع والمراجع شغال حتى من غير أي مفتاح.
- **توجيه**: سؤال زي «إزاي أستخدم معمل الجزيئات؟» أو «tell me about shipping» بيتحوّل لنية `platform_help`،
  والرد بيشرح الميزة بالظبط ويطلع **زر «افتح الصفحة»** على تبويبها — من غير ما الزائر يدوّر.
- **خريطة كاملة**: «دليل المنصة» أو «إيه الجديد في المنصة؟» بيرجّع كل الأقسام، والاقتراحات اللي تحت الرد
  بتفتح على الميزات القريبة.
- **كتالوج النموذج**: نص الميزات الحالي + **جدول الشحن الحقيقي** (`src/data/shipping.json`) بيتضافوا لتعليمات
  النموذج في كل سؤال، فأي تعديل في الدليل أو التسعير بيوصل فوراً من غير ما يتخزن نسخة قديمة.
- **ترقية المتاجر القديمة**: `KNOWLEDGE_SEED_VERSION` بيضمن إن مستندات الميزات الجديدة توصل للتخزين الموجود
  مرة واحدة، من غير ما تلمس مستند عدّله التاجر أو ترجّع واحد اتمسح.

**لما تضيف ميزة جديدة للزائر:** ضيفها في `PLATFORM_FEATURES` (وبنفس الـ`tab` بتاع `src/App.tsx`)، وزوّد
`KNOWLEDGE_SEED_VERSION` لو المستند جديد على متجر موجود، و`tests/shamCorePlatform.test.ts` بيتأكد إن كل
تبويب مذكور موجود فعلاً وإن الرد والزر شغالين.

### مسارات API
**عامة:** `GET /api/assistant/config` • `POST /api/assistant/chat` • `GET /api/assistant/conversations/:id?visitorId=` • `GET /api/assistant/products` • `POST /api/assistant/requests` • `POST /api/assistant/track`

الشات بيقبل `consult: true` عشان يطلب المجلس الاستشاري، و`config` بيرجّع `council.available`.

**إدارة:** `GET /overview` • إضافة وتعديل وحذف لـ `services` و`products` و`knowledge` • `GET/PATCH /requests` • `GET /conversations`، `POST /conversations/:id/reply`، `PATCH /conversations/:id` • `GET/PUT /settings` • `POST /test-chat` (مع trace) • `GET /export` (نسخة احتياطية JSON)

---

## 3) لوحة الإدارة (`/#admin`)
- **نظرة عامة:** الطلبات الجديدة، والتحويلات المفتوحة، ونشاط آخر 24 ساعة، والمخزون المنخفض، ونوايا الزوار، والمحركات اللي ردّت فعلاً، وقيمة طلبات المتجر، وتنبيه لو التخزين غير دائم.
- **الطلبات والعروض:** تصفية بالحالة، وتفاصيل العميل والحقول والأصناف، وتغيير الحالة (الإلغاء بيرجّع المخزون ومش بيتعاد فتحه)، وملاحظات داخلية بسجل زمني.
- **المحادثات:** كل محادثة ومعاها نيتها ومحركها ومسار تنفيذها. الموظف يرد بنفسه، والرد يظهر للزائر في نفس الودجت.
- **المنتجات وقاعدة المعرفة والخدمات:** إضافة وتعديل وحذف. أي **خدمة تجارية جديدة** بتتعمل بكلمات توجيه وحقول استمارة، والمساعد بيبدأ يوجّه ليها فوراً.
- **المحركات والإعدادات:** ترتيب المحركات وتفعيلها، ودرجة الإبداع، وهوية المساعد، ومواعيد العمل، والتواصل المباشر، ونسخة احتياطية.
- **المجلس الاستشاري** (جوه «المحركات والإعدادات»): المقاعد (المحرك، واسم النموذج، والزاوية)، والرئيس، وعدد جولات النقاش، والأنواع اللي بيجتمع فيها تلقائياً، وهل الزائر يشوف النقاش. التفاصيل في [`AI_TOOLS_REVERSE_ENGINEERING.md`](AI_TOOLS_REVERSE_ENGINEERING.md) القسم 11.
- **الخبير شاهين:** إعدادات محادثة الخبير على الموقعين: تفعيله، والسماح للزائر باختيار محرك، والمحركات المسموحة وترتيب «تلقائي»، واسم النموذج لكل محرك، ودرجة الإبداع، وأقصى طول للرد، وتعليمات إضافية. فيه كمان «اختبار الاتصال بالمحركات» (طلب صغير حقيقي لكل محرك)، و«الإعداد الدائم» جاهز للنسخ. الأساس في `server/config/shaheen.ts`، وتعديل اللوحة بيتخزن بس لو مختلف عنه.
- **استوديو التصميم:** خبير متعدد التخصصات تحت شاهين (40 مجالاً وخيار مخصص)، يبني موجزاً منظماً وملاحظات إنتاج وفحص، ويستخدم المنهج التخصصي وتقارير الدعم المتاحة. هوية أدوات الفريق المسجلة منفصلة عن التقارير المستخدمة، ولا ينشر أو يغير الموقع تلقائياً؛ قوائم التعاون والتعلّم والخصوصية ظاهرة مع النتيجة.
- **مختبر المساعد:** نفس مسار الزوار مع عرض كل خطوة، وعلامة «استشارة المجلس».

---

## 4) التشغيل والنشر

| المتغير | الغرض |
|---|---|
| `SHAM_ADMIN_TOKEN` | رمز الإدارة، 12 حرفاً على الأقل. من غيره لوحة الإدارة مقفولة (503) |
| `SHAM_STORE` | `file` أو `firestore` أو `memory`. الافتراضي `file` على Node، و`memory` على Vercel لو مفيش إعداد |
| `SHAM_DATA_FILE` | مسار ملف البيانات (الافتراضي `.data/sham-core.json`، وهو مستثنى من Git) |
| `FIREBASE_PROJECT_ID` / `FIREBASE_CLIENT_EMAIL` / `FIREBASE_PRIVATE_KEY` | بيانات حساب خدمة Firestore |
| `SHAM_LLM_BASE_URL` / `SHAM_LLM_MODEL` / `SHAM_LLM_API_KEY` | نموذج مفتوح مستضاف ذاتياً، مثلاً `http://127.0.0.1:11434/v1` و`qwen2.5:7b-instruct` |
| `GEMINI_API_KEY` وغيره | اختيارية تماماً. لو موجودة بتدخل في سياسة المحركات |
| `OPENROUTER_API_KEY` / `OPENROUTER_MODEL` | مفتاح واحد لنماذج كتير من شركات مختلفة، مفيد لمقاعد المجلس |
| `PERPLEXITY_API_KEY` / `PERPLEXITY_PRESET` | ردود مبنية على بحث حي في النت (واجهة الوكيل `/v1/agent`، الإعداد الافتراضي `fast`؛ ممكن `low` أو `medium` أو `high`)، بيتسعر بالطلب |
| `SHAM_COUNCIL_RATE_PER_HOUR` | حد ردود المجلس لكل زائر في الساعة (الافتراضي 12) |
| `SHAM_SEED_DEMO=true` | منتجات تجريبية مُعلَّمة «تجريبي» للمعاينة فقط |
| `SHAM_CORS_ORIGINS` | المواقع المسموح لها تكلّم الـ API من دومين تاني (الافتراضي GitHub Pages؛ `none` يقفلها) |
| `AI_GATEWAY_API_KEY` | بوابة نماذج Tencent EdgeOne (متوافقة مع OpenAI، فيها توكنز مجانية). المحرك «نموذج مفتوح» بيستخدمها لو `SHAM_LLM_BASE_URL` فاضي. التفاصيل في [`EDGEONE.md`](EDGEONE.md) |
| `SHAM_SHAHEEN_RATE_PER_MIN` | حد رسائل «الخبير شاهين» لكل زائر في الدقيقة (الافتراضي 10) |
| `SHAM_CHAT_RATE_PER_MIN` / `SHAM_TRUST_PROXY` | حد الرسائل لكل IP في الدقيقة، وعدد البروكسيات الموثوقة (الافتراضي على Vercel = 1) |

- **سيرفر Node / VPS:** `SHAM_STORE=file` تخزين دائم على القرص. ممكن تشغّل Ollama على نفس السيرفر وتضبط `SHAM_LLM_BASE_URL`.
- **Vercel:** الدوال مالهاش قرص دائم، فاستخدم `SHAM_STORE=firestore`. من غيره البيانات بتتمسح عند إعادة التشغيل، واللوحة بتنبّه لده.
- **Tencent EdgeOne:** نفس التطبيق كواجهة ودالة سحابية (`cloud-functions/api/[[default]].ts`)، مجاني. التخزين في الذاكرة لكل نسخة لو مفيش `SHAM_STORE=firestore`. الخطوات في [`EDGEONE.md`](EDGEONE.md).
- **Firebase:** حساب الخدمة بيتخطى `firestore.rules`، والقواعد الحالية بتفضل قافلة الوصول من المتصفح. المجموعات بتبدأ بـ `sham_core_`.
- **GitHub Pages:** نسخة ثابتة مالهاش خادم. الـ workflow بيبنيها بـ `VITE_API_BASE_URL` (متغير المستودع `PAGES_API_BASE_URL`، والافتراضي `https://sham-perfume-49bf.vercel.app`)، فالشات بوتات (مساعد شام وشاهين) ولوحة الإدارة بيكلّموا خادم Vercel مباشرة. الخادم بيسمح بده بس للمواقع المكتوبة في `SHAM_CORS_ORIGINS` (الافتراضي `https://spculculat-oss.github.io`)، ومن غير كوكيز. لو حطيت `PAGES_API_BASE_URL=none`، النسخة الثابتة بترجع تقفل مزايا الخادم وتعرض تنبيه.

---

## 5) حدود صريحة وخطوات تالية
- محرك شام الذاتي **مش نموذج لغوي توليدي**. بيجاوب من قاعدة المعرفة والكتالوج والأدوات وبيرفض التخمين، وبيدعم العربية والإنجليزية. لردود حرة بكل اللغات فعّل نموذجاً مفتوحاً مستضافاً ذاتياً (يفضل بـ GPU؛ التشغيل على CPU أبطأ بكتير).
- مفيش بوابة دفع إلكتروني لسه. الطلبات بتتسجل والفريق يأكد الدفع والشحن. الخطوة الجاية بوابة محلية (Paymob أو Fawry مثلاً) وإشعارات بريد/واتساب للطلبات الجديدة.
- تحديد المعدل وذاكرة الفهرس بيتعملوا لكل نسخة خادم. للتوسع الأفقي: Redis مشترك.
- التتبع بيطلب رقم الطلب **ومعاه** الهاتف أو البريد. رمز الإدارة مكانه متغيرات الخادم فقط، ومش بيتحط أبداً في `VITE_*` أو في Git.

## Visitor anonymity (Shaheen modes)

Visitors only ever meet «الخبير شاهين». The public API never returns engine, vendor or model names:

| Visitor mode | Behaviour (admin-only detail) |
|---|---|
| `auto` — تلقائي | admin engine order with failover |
| `fast` — رد سريع | quick engines first, short answer (≤ 1024 tokens) |
| `deep` — تحليل معمّق | careful engines first, step-by-step analysis |
| `council` — مجلس الخبراء | advisory council (needs ≥ 2 working seats, else `503 COUNCIL_UNAVAILABLE`), 12/h per visitor |

- `GET /api/models` → `{ models: [{ id, hasApiKey }], enabled, allowVisitorChoice }`.
- `POST /api/chat` → `{ reply, mode, engine: { id: mode, provider: 'shaheen', … } }`.
- Sham assistant replies are labelled `sham_ai` / `sham_local`; council advisors are shown as letters only.
- Both system prompts forbid naming any model or company. The admin dashboard still shows real engines, probes and usage.
- `tests/honestCopy.test.ts` fails the build if a vendor name appears in visitor-facing code (`src/admin/` is exempt).

### «صحة المحركات» — automatic parking of failing engines

`server/core/engineHealth.ts` remembers, per server instance, which engine failed and why. A failing engine is parked and moved to the end of the line (still a last resort); the working engines answer meanwhile; after the pause the next message tries it again and the first success restores it.

| Failure | Parked for |
|---|---|
| `invalid_key` | 30 min |
| `no_credit` | 1 h (daily quota: until 08:05 UTC, re-checked at least every 12 h) |
| `region_blocked` | 6 h |
| `model_not_found` | 1 h |
| `rate_limited` | provider's «retry in Ns» (≥ 30 s), else 1 min |
| `upstream_error` / `timeout` / `empty` / `bad_request` | after 2 failures in a row: 2 min, growing to 10 min |

A visitor leaving or the whole answer running out of time is never counted against an engine. The admin «اختبار الاتصال بالمحركات» button updates the record at once, the Shaheen tab shows «شغال / متأجل لحد HH:MM (السبب)» per engine, and `reset_provider_gate` clears it. The bots (`makeAsk`) pause a rejected key for an hour and tie every pause to a one-way fingerprint of the key (8 hex chars of SHA-256), so a key replaced in GitHub is used at once.
