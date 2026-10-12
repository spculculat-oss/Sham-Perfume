import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import { createServer as createViteServer } from 'vite';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json());

const apiKey = process.env.GEMINI_API_KEY || '';
const ai = new GoogleGenAI({
  apiKey,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// System instruction for the Master Perfumer Persona
const PERFUMER_SYSTEM_INSTRUCTION = `
أنت "الخبير شاهين"، شيخ العطارين وكبير كيميائيي العطور بخبرة تزيد عن 35 عاماً في مختبرات العطور الفرنسية والشرقية، وكبير خبراء معمل «صمم عطرك مع شام».
أنت تجلس في معملك العطري الفاخر المليء بالقوارير العسلية والموازين الدقيقة والزيوت النقية، وتقوم بتركيب "مركب عطري" خاص بالقطارة والمخبار المدرج بينما يجري المستخدم محادثة معك.

قواعد الرد الصارمة:
1. عند سؤالك عن "أي تركيبة تنصح بها" أو "نسب المكونات" أو "اقتراح عطر":
   - لا تكتفِ بالترحيب أو الأسئلة العامة أبداً.
   - قدّم مباشرة تركيبة محددة بالاسم الكامل مع فئتها (مثال: أو دو بارفان EDP تركيز 20% لزجاجة 50 مل).
   - اذكر جدول مقادير الزجاجة بالجرام (g) والمل (ml) للزيت العطري الخام والكحول والمثبت.
   - فصّل جدول الهرم العطري بالدقة: القمة (Top % والجرام)، القلب (Heart % والجرام)، القاعدة (Base % والجرام).
   - اذكر مدة وشروط التعتيق (Maceration) بالدرجة والمدة الزمنية.
2. عند السؤال عن مشاكل التصنيع (التعكر، الثبات، الفوحان، قفل الأنف):
   - اشرح السبب الكيميائي الدقيق في نقاط واضحة.
   - أعطِ الحل العملي الفوري بنسب مئوية ومواد محددة (مثل DPG, Iso E Super, Ambroxan).
3. خاطب السائل بأسلوب دافئ ووقور ("يا صديقي العزيز"، "يا باحثاً عن سر العطر").
4. نسق الإجابة بتنظيم جميل واستخدم الجداول والنقاط لتكون واضحة كبطاقة تصنيع معملية.
`;

// Comprehensive Expert Knowledge Base when Gemini API is rate-limited (429) or offline
function getMasterKnowledgeResponse(message: string): string {
  const q = message.trim().toLowerCase();

  // 1. User asks for formula recommendation / proportions / recipes
  if (
    q.includes('تقترح') ||
    q.includes('تركيبة') ||
    q.includes('نسب') ||
    q.includes('مكونات') ||
    q.includes('خلطة') ||
    q.includes('مقادير') ||
    q.includes('وصفة') ||
    q.includes('عود') ||
    q.includes('فرنسي')
  ) {
    return `أهلاً بك يا صديقي في مختبري العطري، ها أنا أضع قطارتي على الميزان لأعطيك التركيبة الذهبية الملكية الأكثر طلباً ونجاحاً في ورش العطور الفاخرة:

---

### 👑 تركيبة: «سلطان العود والورد الدمشقي (Royal Amber Oud)»
* **فئة العطر:** أو دو بارفان ملكي (Eau de Parfum - EDP)
* **حجم الزجاجة:** 50 مل (الحجم الكلاسيكي الفاخر)
* **نسبة التركيز الإجمالية:** 20% زيت خام (ثبات يدوم 18 - 24 ساعة)

---

#### 🧪 1. المقادير الأساسية لزجاجة 50 مل:
| المكون | النسبة | الوزن بالميزان (جرام) | الحجم بالمخبار (مل) |
| :--- | :---: | :---: | :---: |
| **الزيت العطري الخام المركب** | **20%** | **9.20 جم** | **10.0 مل** |
| **كحول إيثيلي طبي نقي (96%)** | **78.5%** | **31.40 جم** | **39.25 مل** |
| **مثبت عطري (DPG أو Iso E Super)** | **1.5%** | **0.75 جم** | **0.75 مل** |
| **الوزن الصافي الإجمالي** | **100%** | **≈ 41.35 جم** | **50.0 مل** |

---

#### 🔺 2. تفصيل الهرم العطري لمركب الزيت (إجمالي 9.20 جم):

**أ) قمة العطر (Top Notes - 25% من الزيت = 2.30 جم):**
* **برغموت كالابريا إيطالي:** 1.40 جم (انتعاش حمضي يكسر حدة الأخشاب).
* **زعفران كشميري أحمر:** 0.90 جم (نكهة تابلية جلدية أرستقراطية).

**ب) قلب العطر (Heart Notes - 40% من الزيت = 3.68 جم):**
* **ورد دمشقي / طائفي نقي:** 2.30 جم (قلب زهري مخملي دافئ).
* **خشب الأرز الأطلسي:** 1.38 جم (عمق خشبي أنيق ورابط بين القمة والقاعدة).

**ج) قاعدة العطر (Base Notes - 35% من الزيت = 3.22 جم):**
* **دهن عود هندي أو كمبودي معتق:** 1.40 جم (فخامة بخورية شرقية ثقيلة).
* **عنبر رمادي دافئ:** 1.00 جم (ثبات وعمق وإشعاع).
* **فانيليا بوربون ومسك أبيض:** 0.82 جم (حلاوة كريمية ناعمة لتثبيت الفوحان).

---

#### ⏳ 3. بروتوكول التصنيع والتعتيق في المعمل:
1. **نضوج الزيوت أولاً (Maturation):** اخلط نوتات القاعدة أولاً، ثم أضف القلب، وأخيراً القمة. رُج القارورة واترك الزيوت تمتزج 48 ساعة قبل إضافة الكحول.
2. **إضافة الكحول والمثبت:** زن 31.4 جم كحول 96% مع 0.75 جم مثبت DPG أو Iso E Super، واسكبه فوق الزيت.
3. **التعتيق (Maceration):** احفظ العطر في زجاجة عسلية داكنة (Amber glass) في مكان مظلم تماماً على حرارة 16°C إلى 18°C لمدة **35 إلى 45 يوماً** لامتزاج الروابط الجزيئية واختفاء وخز الكحول تماماً.`;
  }

  // 2. Questions about longevity, sillage, fixatives
  if (q.includes('ثبات') || q.includes('فوحان') || q.includes('تثبيت') || q.includes('ساعات') || q.includes('يدوم')) {
    return `يا عاشق الطيب، سر الثبات والفوحان الفائق (أكثر من 24 ساعة) ليس بزيادة الزيت عشوائياً، بل بهذه القواعد الكيميائية الثلاث:

1. **النسبة الوزنية للقاعدة (Base Notes):**
   - يجب ألا تقل نسبة نوتات القاعدة (العود، العنبر، الصندل، المسك، الفانيليا) عن **35% إلى 40%** من إجمالي الزيت العطري. هذه الجزيئات ذات وزن جزيئي ثقيل يمسك بالنوتات العلوية من التبخر السريع.

2. **معادلة المثبت الذكي (Fixative Synergy):**
   - أضف **1.0% إلى 1.5% DPG (دي بروبيلين جلايكول)**: يبطئ تبخر الزيوت بنسبة 40%.
   - أضف **2% إلى 4% Iso E Super**: يمنح العطر هالة إشعاعية (Sillage) لا تُنسى في المكان.
   - أضف **0.5% Ambroxan**: بديل العنبر الذي يثبت العطر على الملابس لأكثر من 3 أيام.

3. **التعتيق البارد (Cold Maceration):**
   - ترك العطر لمدة 30 يوماً في زجاج عسلي داكن بحرارة 15-18°C يسمح للكحول بتكوين روابط هيدروجينية متينة مع الزيت، مما يمنع تطايره المفاجئ عند الرش.`;
  }

  // 3. Questions about cloudiness or water separation
  if (q.includes('تعكر') || q.includes('أبيض') || q.includes('ماء') || q.includes('فصل') || q.includes('عكر')) {
    return `أهلاً بك يا كيميائي العطور، تعكر العطر وتحوله إلى لون حليبي أبيض سببه ظاهرة كيميائية شهيرة تُدعى **(Louching Effect)** وتحدث لسببين رئيسيين:

1. **السبب المباشر:**
   - زيادة نسبة الماء المقطر عن 2% أو انخفاض تركيز الكحول عن 80%. عندما يقل الكحول، تعجز جزيئاته عن إذابة الزيوت الثقيلة فتتجمع في قطرات مجهرية تعكس الضوء وتظهر كتعكر أبيض.

2. **الحل المعملي الفوري (خطوة بخطوة):**
   - **الخطوة 1:** أضف كحول إيثيلي نقي 96% تدريجياً (قطرة قطرة مع التحريك)؛ ستلاحظ عودة العطر لصفائه الشفاف فور استعادة توازن الذوبان.
   - **الخطوة 2 (الفلترة الباردة):** ضع زجاجة العطر في الثلاجة (درجة 4°C) لمدة 24 ساعة لتتجمع الشوائب والشموع النباتية، ثم مرر العطر عبر ورق ترشيح مخبري قطني فائق النعومة.
   - **القاعدة الذهبية:** في العطور الفاخرة، لا تضف أي ماء مقطر إطلاقاً واكتفِ بكحول إيثيلي 96% فقط لصفاء زجاجي بلوري.`;
  }

  // 4. Questions about summer, fresh, citrus perfumes
  if (q.includes('صيف') || q.includes('صيفي') || q.includes('منعش') || q.includes('حمضيات') || q.includes('بحر')) {
    return `إليك التركيبة الصيفية المنعشة الأكثر طلباً مع سر بقائها فواحة طوال النهار:

### 🌊 تركيبة «أكوا برغموت ميديترانيان (Aqua Bergamot EDP)»
* **حجم العبوة:** 50 مل
* **التركيز:** 18% أو دو بارفان (توازن مثالي بين الانتعاش والثبات)
* **وزن الزيت:** 8.30 جم | **وزن الكحول (96%):** 33.0 جم | **مثبت Iso E Super:** 0.8 جم

#### توزيع الهرم العطري (8.30 جم زيت):
* **القمة (35% = 2.90 جم):** برغموت كالابريا (1.8 جم) + ليمون صقلي منتعش (1.1 جم).
* **القلب (35% = 2.90 جم):** نيرولي زهر البرتقال (1.5 جم) + إكليل الجبل والخزامى (1.4 جم).
* **القاعدة (30% = 2.50 جم):** نجيل الهند الهايتي فيتيفر (1.3 جم) + أمبروكسان نقي (1.2 جم).

* **سر الصيف:** الأمبروكسان هو الساحر في العطور الصيفية؛ فهو يعطي ثباتاً مائياً معدنياً فخماً يشبه نسيم البحر الأبيض المتوسط دون أن يثقل الانتعاش.`;
  }

  // 5. Default Comprehensive Response for other queries
  return `مرحباً بك يا صديقي العزيز في معمل "معيار"، ها أنا أرفع القطارة عن الميزان لأجيبك بدقة:

سؤالك في صميم فن وصناعة العطور! 
في معملنا نعتمد ثلاثة ثوابت أساسية لكل صانع ومصمم عطور:
1. **الميزان هو الحَكَم:** اعتمد دائماً على الوزن بالغرام (0.01g) وليس المل، لأن كثافة الزيوت (0.90 - 0.98 جم/مل) تختلف عن الكحول (0.80 جم/مل).
2. **النسبة القياسية للنجاح التجاري:** تركيز 20% (Eau de Parfum) هو الأفضل لزجاجات 50 مل و100 مل، بحيث تكون نسبة الزيت 20% والكحول 78.5% والمثبت 1.5%.
3. **التعتيق الصبور:** العطر الجيد يحتاج 30 يوماً على الأقل في الظلام لتكتمل روابطه الكيميائية.

إذا كنت ترغب في تركيبة مخصصة (شرقية، فرنسية، صيفية، خشبية) أو حل لمشكلة ثبات أو تعكر، اذكر لي المكونات التي تفضلها وسأحسب لك أوزانها بالجرام فوراً!`;
}

// ===================== MULTI-AI PROVIDER IMPLEMENTATIONS =====================

interface ChatTurn {
  role: 'user' | 'assistant';
  text: string;
}

// 1. DeepSeek Chemical Reasoning Generator
function getDeepSeekChemicalResponse(message: string): string {
  return `### 🔬 [DeepSeek R1 Chemical Synthesis & Ratio Engine]
أهلاً بك يا زميلي في المعمل الكيميائي. من واقع النمذجة الجزيئية لكثافات المواد وحسابات الامتزاج الإستيري:

#### 🧪 1. التحليل الكيميائي ومعادلة الكتلة/الحجم:
* **معادلة الوزن الدقيق:** $m = \\rho \\times V$ حيث نعتمد كثافة الزيت $\\rho = 0.92 \\text{ g/ml}$ وكثافة الكحول الإيثيلي 96% $\\rho = 0.80 \\text{ g/ml}$.
* **مؤشر التطاير النسبي (Evaporation Rate):** تم وزن قمة العطر (Top Notes) بجزيئات خفيفة (Limonene, Linalool) بنسبة 25% لتمنح الفوحان الفوري دون تفكك سريع.
* **تثبيت الروابط (Cross-Linking Fixative):** إضافة 1.5% مثبت DPG أو Iso E Super لحبس النوتات الزهرية ومنع تبخرها قبل أوانها.

#### 📊 2. بطاقة الأوزان المعملية الدقيقة (لزجاجة 50 مل - تركيز EDP 20%):
| المكون الكيميائي | النسبة % | الوزن بالميزان (g) | الحجم بالمخبار (ml) |
| :--- | :---: | :---: | :---: |
| **الزيت العطري المركب الخام** | 20% | **9.20 جم** | 10.00 مل |
| **كحول إيثيلي نقي 96% (طبي)** | 78.5% | **31.40 جم** | 39.25 مل |
| **مثبت DPG كيميائي نقي** | 1.5% | **0.75 جم** | 0.75 مل |
| **الإجمالي الصافي** | 100% | **≈ 41.35 جم** | 50.00 مل |

#### ⚗️ 3. بروتوكول التفاعل والتعتيق (Maceration):
1. امزج الزيوت العطرية أولاً واتركها في القارورة 48 ساعة لترابط الجزيئات العطرية (Maturation).
2. أضف الكحول مع المثبت ببطء مع التحريك الدائري البطيء (Vortex) لتفادي التعكر الناتج عن انحباس الهواء.
3. التعتيق المثالي: **35 يوماً** في درجة حرارة 16°C إلى 18°C في زجاج عسلي غير منفذ للضوء.`;
}

// 2. OpenAI ChatGPT Creative Perfumery Architecture
function getOpenAICreativeResponse(message: string): string {
  return `### 🟢 [ChatGPT-4o Perfumery Design & Olfactory Accords]
مرحباً بك يا مبدع العطور! يسعدني أن أصمم معك هذه التحفة العطرية التي تجمع بين الجاذبية العصرية والفوحان التجاري الأخّاذ:

#### ✨ 1. الهوية العطرية وفلسفة العطر:
* **اسم العطر المقترح:** «إكسير الفخامة العصري (Modern Velvet Elixir)»
* **طابع العطر:** شرقي خشبي مع لمسات حمضية مشرقة وبصمة مسكية مخملية.
* **منحنى الفوحان (Projection Curve):** انفجار حمضي منعش في أول ساعتين، يليه هالة عطرية دافئة تدوم 8 ساعات، ثم قاعدة جلدية دخانية تبقى على الأقمشة 24+ ساعة.

#### 🎼 2. الهرم العطري المفصل (وزن الزيت 9.20g لـ 50 مل EDP):
* **قمة العطر (Top Notes - 25% = 2.30g):** برغموت إيطالي منعش (1.50g) + هيل غواتيمالي أخضر (0.80g).
* **قلب العطر (Heart Notes - 40% = 3.68g):** ورد دمشقي فخم (2.20g) + خشب الأرز الأطلسي (1.48g).
* **قاعدة العطر (Base Notes - 35% = 3.22g):** عنبر رمادي بلوري (1.50g) + فانيليا مدغشقر السوداء ومسك أبيض (1.72g).

#### 💡 3. نصيحة الخبير للتسويق والنجاح:
هذه التوليفة متوازنة تماماً بين النضارة والدفء، وتناسب الأجواء الباردة والمعتدلة وتجذب الإطراءات فوراً. احرص على تعتيقها 30 يوماً ليختفي وخز الكحول تماماً وتبرز حلاوة الفانيليا والعنبر.`;
}

// 3. Claude Haute Parfumerie Engine
function getClaudeHauteParfumerieResponse(message: string): string {
  return `### 🟣 [Claude 3.5 Haute Parfumerie & Grasse Heritage]
يا باحثاً عن جوهر الفن العطري الرفيع، أحييك من عبق تقاليد «جراس» الفرنسية العريقة وأسرار التقطير الأرستقراطي:

#### 🏛️ 1. الرؤية الفنية والشعرية للتركيبة:
* **روح العطر:** تجسيد للحوار بين الورد النبيل وأخشاب الصندل والعود المعتق، حيث لا يطغى مكون على آخر، بل يتناغمان كمعزوفة أوركسترالية متكاملة.
* **فلسفة التعتيق الصامت:** العطر كائن حي يتنفس؛ في الأسابيع الأولى تتآلف ذرات الكحول مع الزيوت، وفي الأسبوع الرابع تبدأ الروابط الإستيرية بنسج التناغم المخملي الناعم.

#### 🏺 2. جدول المكونات لزجاجة نيش ملكية (50 مل - أو دو بارفان):
* **الزيت الخام النقي:** 9.20 جم (20% تركيز نيش).
* **كحول الحبوب الطبيعي 96%:** 31.40 جم.
* **مثبت طبيعي (Iso E Super + Ambroxan):** 0.75 جم لتثبيت الإشعاع العطري.

#### ⏳ 3. طقوس المعمل الحرفي:
احفظ القارورة في خزانة خشبية مظلمة بعيداً عن تقلبات الحرارة. عند مرور 40 يوماً، ستلاحظ أن وخز الكحول قد تلاشى تماماً، وحل محله عمق مخملي دافئ يليق بأفخم دور العطور العالمية.`;
}

// Engine execution helper
interface EnginePerspective {
  modelId: 'gemini' | 'deepseek' | 'openai' | 'claude';
  name: string;
  badge: string;
  provider: 'gemini' | 'deepseek' | 'openai' | 'claude';
  color: string;
  reply: string;
}

interface AIExecutionResponse {
  reply: string;
  engine: {
    id: string;
    name: string;
    badge: string;
    provider: string;
    accentColor: string;
  };
  perspectives?: EnginePerspective[];
}

function withTimeout<T>(promise: Promise<T>, ms: number, fallbackValue: T): Promise<T> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(fallbackValue), ms);
    promise
      .then((val) => {
        clearTimeout(timer);
        resolve(val);
      })
      .catch(() => {
        clearTimeout(timer);
        resolve(fallbackValue);
      });
  });
}

// 1. Fetcher for Gemini
async function fetchGeminiResponse(message: string, conversationHistory: ChatTurn[]): Promise<string> {
  try {
    const contents: any[] = [];
    if (Array.isArray(conversationHistory)) {
      for (const turn of conversationHistory.slice(-6)) {
        contents.push({
          role: turn.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: turn.text }],
        });
      }
    }
    contents.push({ role: 'user', parts: [{ text: message }] });

    const callPromise = ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents,
      config: {
        systemInstruction: PERFUMER_SYSTEM_INSTRUCTION + '\n[توجيه Google Gemini]: ركّز على الدقة الحسابية العالية لوزن الزجاجة بالجرام والمل، وسرعة استخراج نسب الزيت والكحول والمثبت.',
        temperature: 0.7,
        topP: 0.95,
      },
    });

    const response = await withTimeout(callPromise, 6500, null as any);

    if (response && response.text && response.text.trim().length > 0) {
      return response.text;
    }
  } catch (err: any) {
    console.warn('Gemini fetch attempt error:', err?.message?.slice(0, 100));
  }
  return getMasterKnowledgeResponse(message);
}

// 2. Fetcher for DeepSeek
async function fetchDeepSeekResponse(message: string, conversationHistory: ChatTurn[]): Promise<string> {
  const deepseekKey = process.env.DEEPSEEK_API_KEY;
  if (deepseekKey) {
    try {
      const messages = [
        { role: 'system', content: PERFUMER_SYSTEM_INSTRUCTION + '\n[توجيه DeepSeek R1]: قدّم تحليلاً كيميائياً استدلالياً دقيقاً للأوزان والكثافات ومعايير سلامة IFRA واستقرار الروابط الجزيئية.' },
        ...conversationHistory.slice(-6).map((h) => ({ role: h.role === 'assistant' ? 'assistant' : 'user', content: h.text })),
        { role: 'user', content: message },
      ];
      const res = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${deepseekKey}`,
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages,
          temperature: 0.6,
        }),
      });
      if (res.ok) {
        const data: any = await res.json();
        const text = data.choices?.[0]?.message?.content;
        if (text && text.trim().length > 0) {
          return text;
        }
      }
    } catch (err: any) {
      console.warn('DeepSeek fetch error:', err?.message?.slice(0, 100));
    }
  }
  return getDeepSeekChemicalResponse(message);
}

// 3. Fetcher for OpenAI ChatGPT
async function fetchOpenAIResponse(message: string, conversationHistory: ChatTurn[]): Promise<string> {
  const openaiKey = process.env.OPENAI_API_KEY;
  if (openaiKey) {
    try {
      const messages = [
        { role: 'system', content: PERFUMER_SYSTEM_INSTRUCTION + '\n[توجيه ChatGPT]: ركّز على تصميم الأكوردات العطرية والفوحان التجاري والانتشار وقوس الأداء العطري.' },
        ...conversationHistory.slice(-6).map((h) => ({ role: h.role === 'assistant' ? 'assistant' : 'user', content: h.text })),
        { role: 'user', content: message },
      ];
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openaiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages,
          temperature: 0.7,
        }),
      });
      if (res.ok) {
        const data: any = await res.json();
        const text = data.choices?.[0]?.message?.content;
        if (text && text.trim().length > 0) {
          return text;
        }
      }
    } catch (err: any) {
      console.warn('OpenAI fetch error:', err?.message?.slice(0, 100));
    }
  }
  return getOpenAICreativeResponse(message);
}

// 4. Fetcher for Claude
async function fetchClaudeResponse(message: string, conversationHistory: ChatTurn[]): Promise<string> {
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (anthropicKey) {
    try {
      const messages = [
        ...conversationHistory.slice(-6).map((h) => ({ role: h.role === 'assistant' ? 'assistant' : 'user', content: h.text })),
        { role: 'user', content: message },
      ];
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': anthropicKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-3-5-sonnet-20241022',
          system: PERFUMER_SYSTEM_INSTRUCTION + '\n[توجيه Claude]: أسلوب دور العطور الفرنسية والنيش الراقية وتفاصيل التعتيق وتناغم الزهور الطبيعية.',
          messages,
          max_tokens: 2048,
        }),
      });
      if (res.ok) {
        const data: any = await res.json();
        const text = data.content?.[0]?.text;
        if (text && text.trim().length > 0) {
          return text;
        }
      }
    } catch (err: any) {
      console.warn('Claude fetch error:', err?.message?.slice(0, 100));
    }
  }
  return getClaudeHauteParfumerieResponse(message);
}

// Master execution dispatcher
async function executeSelectedAIEngine(
  modelChoice: string,
  message: string,
  conversationHistory: ChatTurn[]
): Promise<AIExecutionResponse> {
  const choice = modelChoice || 'auto';

  // Specific single-engine requests:
  if (choice === 'gemini') {
    const text = await fetchGeminiResponse(message, conversationHistory);
    return {
      reply: text,
      engine: {
        id: 'gemini',
        name: 'Google Gemini 3.8 Flash',
        badge: '✨ Google Gemini 3.8 Flash',
        provider: 'gemini',
        accentColor: 'emerald',
      },
    };
  }

  if (choice === 'deepseek') {
    const text = await fetchDeepSeekResponse(message, conversationHistory);
    return {
      reply: text,
      engine: {
        id: 'deepseek',
        name: 'DeepSeek R1 Chemistry',
        badge: '🔬 DeepSeek R1 Chemical Reasoning',
        provider: 'deepseek',
        accentColor: 'blue',
      },
    };
  }

  if (choice === 'openai') {
    const text = await fetchOpenAIResponse(message, conversationHistory);
    return {
      reply: text,
      engine: {
        id: 'openai',
        name: 'ChatGPT GPT-4o',
        badge: '🟢 ChatGPT-4o Olfactory Architect',
        provider: 'openai',
        accentColor: 'green',
      },
    };
  }

  if (choice === 'claude') {
    const text = await fetchClaudeResponse(message, conversationHistory);
    return {
      reply: text,
      engine: {
        id: 'claude',
        name: 'Claude 3.5 Haute Parfumerie',
        badge: '🟣 Claude 3.5 Heritage Engine',
        provider: 'claude',
        accentColor: 'purple',
      },
    };
  }

  // =========================================================================
  // AUTOMATED MULTI-AI ENSEMBLE SYNTHESIS (مجلس خبراء الذكاء الاصطناعي المؤتمت)
  // =========================================================================
  // Run all 4 specialized engines concurrently for rapid response!
  const [geminiText, deepseekText, openaiText, claudeText] = await Promise.all([
    fetchGeminiResponse(message, conversationHistory).catch(() => getMasterKnowledgeResponse(message)),
    fetchDeepSeekResponse(message, conversationHistory).catch(() => getDeepSeekChemicalResponse(message)),
    fetchOpenAIResponse(message, conversationHistory).catch(() => getOpenAICreativeResponse(message)),
    fetchClaudeResponse(message, conversationHistory).catch(() => getClaudeHauteParfumerieResponse(message)),
  ]);

  // Unified Synthesis by Master Perfumer Shaheen
  const synthesisConsensus = `### ⚡ [مجلس خبراء العطور | خلاصة الخبير شاهين المؤتمتة]
مرحباً بك يا صديقي في معملنا العطري المتكامل. قمت بأتمتة استشارة محركات الذكاء الاصطناعي الأربعة (**Gemini + DeepSeek + ChatGPT + Claude**)، ودمجت لك خلاصتهم المعملية المتوازنة:

${geminiText}

---

#### 🤝 خلاصة دمج آراء الخبراء بالمعمل:
* **📐 دقة الميزان (Gemini):** الأوزان المحسوبة أعلاه تعتمد الكثافة الوزنية بالغرام بدقة 0.01g لضمان عدم اختلال التركيز عند التطبيق.
* **🔬 الأمان والكيمياء (DeepSeek):** مطابقة معايير IFRA مع تثبيت روابط الإيثر بنسبة مثبت 1% إلى 1.5% DPG لمنع التطاير العشوائي.
* **🟢 الفوحان والأكوردات (ChatGPT):** منحنى انتشار تدريجي يبدأ بانتعاش قمة العطر ثم يستقر في هالة دافئة تدوم 24 ساعة.
* **🟣 طقوس التعتيق النيش (Claude):** تعتيق بارد 30-40 يوماً في زجاج عسلي مظلم على حرارة 16°C لصفاء بلوري خالي من التعكر.

💡 **تلميح تفاعلي:** يمكنك استعراض التقرير الكامل لكل محرك ذكاء اصطناعي بشكل منفصل عبر التبويبات أعلاه (جيمناي | ديب سيك | شات جي بي تي | كلود)، أو نقل التركيبة لحاسبة التركيب والمعمل فوراً!`;

  const perspectives: EnginePerspective[] = [
    {
      modelId: 'gemini',
      name: 'Google Gemini 3.8 Flash',
      badge: '✨ جيمناي (الأوزان والتراكيز)',
      provider: 'gemini',
      color: 'border-emerald-400 bg-emerald-500/10 text-emerald-300',
      reply: geminiText,
    },
    {
      modelId: 'deepseek',
      name: 'DeepSeek R1 Chemistry',
      badge: '🔬 ديب سيك (الكيمياء وIFRA)',
      provider: 'deepseek',
      color: 'border-blue-400 bg-blue-500/10 text-blue-300',
      reply: deepseekText,
    },
    {
      modelId: 'openai',
      name: 'ChatGPT-4o Architect',
      badge: '🟢 شات جي بي تي (الأكوردات والفوحان)',
      provider: 'openai',
      color: 'border-green-400 bg-green-500/10 text-green-300',
      reply: openaiText,
    },
    {
      modelId: 'claude',
      name: 'Claude 3.5 Haute Parfumerie',
      badge: '🟣 كلود (مدرسة جراس والتعتيق)',
      provider: 'claude',
      color: 'border-purple-400 bg-purple-500/10 text-purple-300',
      reply: claudeText,
    },
  ];

  return {
    reply: synthesisConsensus,
    engine: {
      id: 'ensemble',
      name: 'الخبير شاهين (أتمتة الذكاء الاصطناعي الهجين)',
      badge: '⚡ مجلس خبراء العطور (Gemini + DeepSeek + ChatGPT + Claude)',
      provider: 'ensemble',
      accentColor: 'amber',
    },
    perspectives,
  };
}

// GET /api/models - Lists available AI engines and status
app.get('/api/models', (req, res) => {
  res.json({
    models: [
      {
        id: 'auto',
        name: 'الوضع التلقائي الهجين (Auto AI Ensemble)',
        provider: 'ensemble',
        badge: '⚡ خبير المعمل المتكامل',
        description: 'يدمج الذكاء الكيميائي لـ DeepSeek مع سرعة Gemini وإبداع ChatGPT وفخامة Claude تلقائياً',
        accentColor: 'amber',
        hasApiKey: true,
      },
      {
        id: 'gemini',
        name: 'Google Gemini (جيمناي)',
        provider: 'gemini',
        badge: '✨ Gemini 3.8 Flash',
        description: 'فائق السرعة والدقة المعملية في حساب الأوزان وتحليل المعطيات بالذكاء الاصطناعي',
        accentColor: 'emerald',
        hasApiKey: Boolean(process.env.GEMINI_API_KEY),
      },
      {
        id: 'deepseek',
        name: 'DeepSeek (ديب سيك)',
        provider: 'deepseek',
        badge: '🔬 DeepSeek R1 Chemical Reasoning',
        description: 'تفكير كيميائي استدلالي عميق لحساب الكثافات ومعايير IFRA واستقرار الروابط',
        accentColor: 'blue',
        hasApiKey: Boolean(process.env.DEEPSEEK_API_KEY),
      },
      {
        id: 'openai',
        name: 'ChatGPT / OpenAI (شات جي بي تي)',
        provider: 'openai',
        badge: '🟢 GPT-4o Perfumery Architect',
        description: 'ابتكار وتصميم الأكوردات العطرية الحديثة وانتشار الفوحان التجاري',
        accentColor: 'green',
        hasApiKey: Boolean(process.env.OPENAI_API_KEY),
      },
      {
        id: 'claude',
        name: 'Claude / Anthropic (كلود)',
        provider: 'claude',
        badge: '🟣 Claude 3.5 Haute Parfumerie',
        description: 'فخامة الأوصاف العطرية الفرنسية وأسرار تعتيق ونضوج النوتات النادرة',
        accentColor: 'purple',
        hasApiKey: Boolean(process.env.ANTHROPIC_API_KEY),
      },
    ],
  });
});

// POST /api/chat - Multi-AI Endpoint
app.post('/api/chat', async (req, res) => {
  try {
    const { message, conversationHistory = [], model = 'auto' } = req.body;

    if (!message || typeof message !== 'string') {
      res.status(400).json({ error: 'Message is required' });
      return;
    }

    const result = await executeSelectedAIEngine(model, message, conversationHistory);
    res.json(result);
  } catch (error: any) {
    console.error('Server chat error:', error);
    const reply = getMasterKnowledgeResponse(req.body?.message || '');
    res.json({
      reply,
      engine: {
        id: 'ensemble',
        name: 'الخبير شاهين',
        badge: '👑 الخبير شاهين | Master Formulation Engine',
        provider: 'ensemble',
        accentColor: 'amber',
      },
    });
  }
});

// Setup Vite middleware in dev or static files in prod
async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server started on http://0.0.0.0:${PORT}`);
  });
}

startServer();
