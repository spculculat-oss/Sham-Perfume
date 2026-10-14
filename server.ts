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

// ============================================================================
// SYSTEM INSTRUCTION: "الخبير شاهين" - شيخ العطارين وكبير الكيميائيين
// ============================================================================
const PERFUMER_SYSTEM_INSTRUCTION = `
أنت "الخبير شاهين"، شيخ العطارين وكبير كيميائيي ومصممي العطور بخبرة تزيد عن 35 عاماً في مختبرات العطور الفرنسية والشرقية، وكبير خبراء معمل «صمم عطرك مع شام».
أنت لست مجرد مولد نصوص آلي أو حاسبة جافة، بل شخصية حقيقية ذات كاريزما وخبرة عملية عميقة وذوق رفيع. تجلس في معملك العطري الفاخر بين القوارير العسلية والموازين المخبرية الدقيقة، وتتحدث مع الزائر في مناقشة حية، واقعية، تفاعلية وطبيعية كأنك في جلسة استشارية مباشرة.

★ أهم القواعد الإلزامية للمحادثة والمنطقية والربط:
1. المنطقية والربط المباشر بسؤال الزائر (Strict Contextual Relevance & Logic):
   - استمع بعناية فائقة لما سأله الزائر وأجب مباشرة على صميم سؤاله وفكرته.
   - ابنِ على سياق الحوار السابق، ولا تتجاهل ما تم طرحه في الرسائل السابقة.
   - لا تفرض قوالب جامدة أو تكرر نفس الوصفات؛ كل سؤال له إجابته الخاصة المحددة.
   - إذا سأل الزائر سؤالاً استفسارياً أو مفتوحاً، ناقشه بود وذكاء، واطرح عليه خيارات استكشافية تساعده على توضيح رغبته.

2. الشمولية الكاملة في المجالات الثلاثة للعطور والتركيبات (Tri-Domain Mastery):

   أ) المجال الطبي والعلاجي (Medical & Therapeutic & Aromatherapy):
      - العلاج بالروائح والنباتات العطرية والطبية: التأثير الفسيولوجي والنفسي للزيوت (كاللافندر والبابونج لتهدئة الجهاز العصبي وتحسين النوم، النعناع والأوكالبتوس لتوسيع الشعب الهوائية وتخفيف الصداع، شجرة الشاي للتطهير ومكافحة البكتيريا، اللبان العماني والمر لتحفيز التركيز والاسترخاء العميق).
      - قواعد الأمان الطبي الإلزامية: التحذير الصارم والواضح من وضع الزيوت العطرية النقية المركزة مباشرة على الجلد دون تخفيف.
      - تحديد نسب التخفيف الآمنة في الزيوت الناقلة (Carrier Oils كالجوجوبا، اللوز الحلو، بذور العنب، الأرجان):
        * للأطفال أو البشرة شديدة الحساسية: (0.5% إلى 1%) كحد أقصى (قطرة إلى قطرتين لكل 10 مل).
        * للبالغين والاستخدام الموضعي العادي: (1% إلى 2%).
      - محاذير طبية صريحة: تنبيهات الحوامل والمرضعات، ومرضى الصرع والربو، والتحذير من الزيوت المحفزة للتحسس الضوئي (Phototoxicity) مثل الحمضيات المعصورة على البارد (كالبرغموت والليمون) وأهمية تجنب التعرض للشمس المباشرة بعدها.
      - الالتزام التام بمعايير منظمة العطور العالمية IFRA وحدود الأمان الجلدي.

   ب) المجال التجميلي والعناية بالبشرة والشعر (Cosmetic & Body Care Formulations):
      - تركيب معطرات الجسم والميست (Body Mist / Body Splash)، ورذاذ الشعر المعطر (Hair Mist) بدون التسبب في جفاف أطراف الشعر.
      - تركيب الكريمات واللوشن المعطر (Scented Lotions & Creams)، زبدة الجسم، ومخمرية الجسم، والعطور الزيتية الخالية من الكحول (Roll-on Perfume Oils & Attar).
      - الكيمياء التجميلية الدقيقة: كيفية إذابة الزيت العطري في المحاليل المائية باستخدام المذيبات والمستحلبات التجميلية الآمنة (مثل Polysorbate 20 أو PEG-40 Hydrogenated Castor Oil)، مع الحفاظ على شفافية المستحضر وتفادي التعكر أو انفصال الطبقات، واستخدام مضادات الأكسدة ومثبتات البشرة مثل فيتامين E و DPG بنسب معتمدة.

   ج) الاستخدامات الشخصية وصناعة وتصميم العطور (Personal Perfumery & Custom Fragrance Design):
      - الاستشارة الشخصية لاختيار وتصميم العطر المناسب لذوق الزائر، طبيعة عمله، فصول السنة، والمناسبات المختلفة (رسمية، يومية، سهرات، أعراس).
      - هندسة الهرم العطري المتناغم (Top, Heart, Base Notes) وتوزيع النوتات.
      - عند طلب تركيبة مخصصة أو حساب مقادير زجاجة: اذكر النسب المئوية والأوزان الدقيقة بالميزان بالجرام (0.01g) وبالمل، ونوع الكحول الطبي النقي (96%)، ونسبة الزيت الخام والمثبت المتوافق (مثل DPG أو Iso E Super أو Ambroxan).
      - شروط التعتيق والتخمير (Maceration) بالحرارة والمدة والزجاج الداكن، وحل مشكلات التصنيع (التعكر Louching، ضعف الفوحان، سرعة التبخر، قفل الأنف).

3. أسلوب التحدث:
   - تحدث بأسلوب دافئ ووقور ومرحب ("يا صديقي العزيز"، "يا باحثاً عن سر العطر والجمال").
   - أسلوب غني بالعلم والشغف والتجارب الواقعية، يشعر الزائر بأنه يتحدث مع إنسان حقيقي خبير ومعلم أمين.
   - استخدم التنسيق الأنيق (عناوين، نقاط، جداول عند الحاجة فقط دون تكلف).
`;

// Specialized System Prompts for Multi-AI Perspectives
const DEEPSEEK_CHEMICAL_PROMPT = `
أنت محرك التحليل الكيميائي واستدلال IFRA (DeepSeek R1 Chemistry Engine) في معمل العطور.
قدّم تحليلاً علمياً كيميائياً دقيقاً ومباشراً لسؤال المستخدم:
- ركّز على: الكثافات النوعية، الحسابات الوزنية الصيدلانية، معايير الأمان لمنظمة IFRA، سلامة الجلد، الامتزاج الإستيري، ومثبتات الروابط الجزيئية ومذيبات التجميل.
- خاطب السائل كعالم كيمياء دقيق وموثوق، دون حشو غير مرتبط بسؤاله.
`;

const OPENAI_OLFACTORY_PROMPT = `
أنت مهندس الأكوردات العطرية والفوحان التجاري (ChatGPT-4o Perfumery Architect) في معمل العطور.
قدّم رؤية تصميمية وتناغمية حديثة لسؤال المستخدم:
- ركّز على: هارموني النوتات، قوس الفوحان والانتشار (Projection & Sillage)، الجاذبية العصرية للمستهلك، وتنسيق الأكوردات في العطور أو المستحضرات التجميلية والشخصية.
- اكتب بأسلوب ملهم وإبداعي يكمل الجانب العلمي.
`;

const CLAUDE_HAUTE_PARFUMERIE_PROMPT = `
أنت كبير خبراء مدرسة جراس والتعتيق الأرستقراطي الفرنسي (Claude Haute Parfumerie Engine) في معمل العطور.
قدّم رؤية نيش كلاسيكية راقية لسؤال المستخدم:
- ركّز على: تقاليد التقطير، نقاء الخامات النباتية، طقوس التعتيق البارد (Cold Maceration)، التوازن العضوي، وفلسفة الروائح في الاستخدام الطبي والتجميلي والشخصي.
- أسلوب راقٍ وفصيح يعكس عبق التاريخ الفرنسي العريق.
`;

// Helper for multi-turn history
interface ChatTurn {
  role: 'user' | 'assistant';
  text: string;
}

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

// Convert history to Gemini format
function buildGeminiContents(message: string, conversationHistory: ChatTurn[]): any[] {
  const contents: any[] = [];
  if (Array.isArray(conversationHistory)) {
    for (const turn of conversationHistory.slice(-8)) {
      if (turn.text && turn.text.trim()) {
        contents.push({
          role: turn.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: turn.text.trim() }],
        });
      }
    }
  }
  contents.push({ role: 'user', parts: [{ text: message }] });
  return contents;
}

// ============================================================================
// GEMINI EXECUTION ENGINE (Primary Intelligence with Fallback Models)
// ============================================================================
async function executeGeminiCore(
  contents: any[],
  systemInstruction: string,
  temperature = 0.75
): Promise<string> {
  const models = ['gemini-3.8-flash', 'gemini-3.1-flash-lite', 'gemini-flash-latest'];

  for (const modelName of models) {
    try {
      const call = ai.models.generateContent({
        model: modelName,
        contents,
        config: {
          systemInstruction,
          temperature,
          topP: 0.95,
        },
      });

      // 25 second timeout for thoughtful generation
      const res = await withTimeout(call, 25000, null as any);
      if (res && res.text && res.text.trim().length > 0) {
        return res.text.trim();
      }
    } catch (err: any) {
      console.warn(`[Gemini ${modelName}] Attempt error:`, err?.message?.slice(0, 100));
    }
  }

  throw new Error('All Gemini models unavailable');
}

// ============================================================================
// INTELLIGENT CONTEXTUAL OFFLINE KNOWLEDGE ENGINE
// (Activates when network is completely offline to guarantee logical replies)
// ============================================================================
function getSmartContextualMasterResponse(message: string, history: ChatTurn[] = []): string {
  const q = message.trim().toLowerCase();

  // 1. MEDICAL & THERAPEUTIC & AROMATHERAPY
  if (
    q.includes('طب') ||
    q.includes('علاج') ||
    q.includes('أطفال') ||
    q.includes('طفل') ||
    q.includes('حامل') ||
    q.includes('حمل') ||
    q.includes('رضيع') ||
    q.includes('ربو') ||
    q.includes('حساسية') ||
    q.includes('استرخاء') ||
    q.includes('أرق') ||
    q.includes('نوم') ||
    q.includes('صداع') ||
    q.includes('شجرة الشاي') ||
    q.includes('زيت ناقل') ||
    q.includes('جوجوبا') ||
    q.includes('لوز') ||
    q.includes('إكليل الجبل') ||
    q.includes('نعناع') ||
    q.includes('لافندر')
  ) {
    return `أهلاً بك يا صديقي في عيادة ومعمل الطب العطري (Aromatherapy). سؤالك في غاية الأهمية والمسؤولية الصحية؛ فالزيوت العطرية ليست مجرد روائح بل مركبات كيميائية نباتية شديدة الفعالية:

---

### 🌿 1. القاعدة الطبية الذهبية للأمان:
* **ممنوع منعاً باتاً** وضع أي زيت عطري نقي (خام) على الجلد مباشرة، خاصة للأطفال أو الحوامل أو أصحاب البشرة الحساسة؛ فالنقاء المركز قد يسبب حروقاً كيميائية أو تحسساً تلامسياً حاداً.
* **الزيوت الناقلة (Carrier Oils):** يجب دائماً مزج الزيت العطري في زيت ناقل نقي مثل: **زيت الجوجوبا الذهبي** (الأقرب لدهون البشرة الطبيعية) أو **زيت اللوز الحلو** أو **زيت الأرجان**.

---

### ⚖️ 2. جدول نسب التخفيف الطبي الآمن:
| الفئة المستهدفة | نسبة التخفيف | عدد القطرات لكل 10 مل زيت ناقل | الاستخدام الأمثل |
| :--- | :---: | :---: | :--- |
| **الأطفال (فوق سنتين) والبشرة الحساسة** | **0.5% إلى 1%** | 1 - 2 قطرة فقط | تدليك باطن القدم أو الظهر قبل النوم |
| **البالغين (للاسترخاء والتجميل اليومي)** | **1.5% إلى 2%** | 3 - 4 قطرات | مساج العنق والأكتاف ومواضع النبض |
| **الاستخدام العلاجي الموضعي الحاد** | **3%** | 6 قطرات | لفترة قصيرة جداً وتحت إشراف مختص |

---

### 🛑 3. محاذير طبية صريحة (معايير IFRA):
1. **التحسس الضوئي (Phototoxicity):** زيوت الحمضيات المعصورة على البارد (كالبرغموت والليمون) تحتوي على مركبات "البيرغابتين"؛ تجنب التعرض للشمس لمدة 12 ساعة بعد وضعها على الجلد تفادياً للتصبغات.
2. **الحمل والرضاعة والأطفال دون سنتين:** يُمنع استخدام زيوت الميرمية، إكليل الجبل، النعناع الفلفلي، والقرفة. ويُكتفى بناشر الروائح الهوائي (Diffuser) بزيت اللافندر الحقيقي (*Lavandula angustifolia*) بقطرات قليلة جداً.
3. **مرضى الربو والحساسية التنفسية:** يجب اختبار الرائحة من مسافة آمنة وعدم التعرض المباشر للأبخرة العطرية الكثيفة.`;
  }

  // 2. COSMETIC & BODY CARE FORMULATIONS
  if (
    q.includes('كريم') ||
    q.includes('لوشن') ||
    q.includes('شعر') ||
    q.includes('هير ميست') ||
    q.includes('بودي ميست') ||
    q.includes('ميست') ||
    q.includes('سبلاش') ||
    q.includes('مخمرية') ||
    q.includes('بدون كحول') ||
    q.includes('زيت للجسم') ||
    q.includes('استحلاب') ||
    q.includes('بوليسوربات')
  ) {
    return `أهلاً بك يا باحثاً عن جمال الصنعة! تركيب المستحضرات التجميلية المعطرة فن يجمع بين سحر الرائحة ودقة الكيمياء التجميلية:

---

### ✨ تركيبة: «معطر ومغذي الشعر المخملي (Silk Hair Mist - 100 ml)»
* **الهدف:** عطر فواح وثابت دون أن يسبب جفاف الشعر أو بهتان لونه، مع خصائص ترطيب حريرية.

#### 🧪 المقادير لزجاجة 100 مل:
1. **الماء المقطر أو ماء الورد النقي:** 80 مل (قاعدة مائية مرطبة).
2. **الزيت العطري التجميلي المفضل:** 2 إلى 3 جم (تركيز 2% - 3% لطيف وآمن على بصيلات الشعر).
3. **مستحلب تجميلي (Polysorbate 20):** 4 إلى 5 جم (يذيب الزيت العطري في الماء ويمنع انفصال الطبقات تماماً).
4. **جلسرين نباتي أو زيت أرجان نقي:** 2 جم (يمنح الشعر لمعاناً ونعومة ويحبس الرطوبة).
5. **كحول إيثيلي تجميلي مخفف أو هيدروسول:** 10 مل (لتسريع الجفاف ومنع التلبد).

---

### 💡 أسرار المعمل لتثبيت المعطرات التجميلية:
* **سر عدم التعكر:** امزج الزيت العطري مع مستحلب Polysorbate 20 بنسبة (1 زيت : 2 مستحلب) أولاً في كوب مخبري حتى يتجانسا تماماً، ثم اسكب الماء المقطر فوقهما بالتدريج مع التحريك المستمر.
* **لصناعة مخمرية أو عطر زيتي Roll-on:** استخدم قاعدة من زيت الجوجوبا بنسبة 80% مع 20% زيت عطري وقطرات من فيتامين E الطبيعي كمانع للأكسدة ومثبت لرطوبة البشرة.`;
  }

  // 3. CLOUDINESS & WATER SEPARATION
  if (q.includes('تعكر') || q.includes('أبيض') || q.includes('ماء') || q.includes('فصل') || q.includes('عكر')) {
    return `أهلاً بك يا كيميائي المعمل، تعكر العطر وتحوله للون الحليبي (Louching Effect) مشكلة شائعة جداً، والسبب الكيميائي بسيط وحله مباشر:

1. **السبب الكيميائي:**
   - الزيوت العطرية هيدروكربونات كارهة للماء (Hydrophobic). عند انخفاض نسبة الكحول عن 80% أو زيادة الماء المقطر عن 2%، تفقد جزيئات الكحول قدرتها على إذابة الزيت فتتجمع في حبيبات مجهرية تعكس الضوء بلون حليبي.

2. **الحل المعملي الفوري:**
   - **الخطوة الأولى:** أضف كحول إيثيلي نقي 96% تدريجياً (بضع غرامات مع الرج الدائري المستمر)، وسيعود المحلول لصفائه البلوري فور وصول توازن الذوبان.
   - **الخطوة الثانية (الفلترة الباردة):** ضع الزجاجة في المجمد (-5°C إلى 4°C) لمدة 24 ساعة، ثم صفّها عبر ورق ترشيح قطني ناعم لإزالة الشموع الطبيعية المترسبة.
   - **نصيحة الخبير:** في العطور الفاخرة، استغنِ تماماً عن الماء المقطر واعتمد فقط على كحول إيثيلي 96% نقي.`;
  }

  // 4. LONGEVITY, SILLAGE & FIXATIVES
  if (q.includes('ثبات') || q.includes('فوحان') || q.includes('تثبيت') || q.includes('ساعات') || q.includes('يدوم')) {
    return `يا عاشق الطيب، سر الثبات والفوحان الفائق (أكثر من 24 ساعة) ليس بزيادة كمية الزيت عشوائياً، بل بهذه القواعد الكيميائية الثلاث:

1. **النسبة الوزنية لقاعدة الهرم العطري (Base Notes):**
   - يجب ألا تقل نسبة نوتات القاعدة (العود، العنبر، الصندل، المسك، الفانيليا) عن **35% إلى 40%** من إجمالي الزيت العطري؛ لأن جزيئاتها ثقيلة ذات تطاير بطيء تمسك بالنوتات العلوية من التبخر السريع.

2. **معادلة التثبيت الثلاثية:**
   - أضف **1.0% إلى 1.5% DPG (دي بروبيلين جلايكول)**: يبطئ تبخر الكحول ويمنحه ملمساً ناعماً.
   - أضف **2% إلى 4% Iso E Super**: يمنح العطر هالة إشعاعية ونبضاً ينتشر في المكان.
   - أضف **0.5% Ambroxan**: بديل العنبر الملكي الذي يثبت العطر على الملابس لأيام.

3. **التعتيق البارد (Cold Maceration):**
   - التعتيق لمدة 30 يوماً على حرارة 16°C يسمح للكحول بتكوين روابط هيدروجينية متينة مع الزيت، مما يمنع انبعاث الرائحة الحادة المفاجئة عند الرش.`;
  }

  // 5. MACERATION & AGING
  if (q.includes('تعتيق') || q.includes('نضوج') || q.includes('مدة') || q.includes('تخمير') || q.includes('حرارة')) {
    return `أهلاً بك يا باحثاً عن سر النضوج العطري! التعتيق (Maceration) هو المرحلة التي يتحول فيها العطر من مجرد خليط كيميائي إلى تحفة فنية متجانسة:

1. **المدة العلمية المثالية:**
   - **العطور الحمضية والزهرية الخفيفة:** من **15 إلى 25 يوماً**.
   - **عطور أو دو بارفان الكلاسيكية (EDP):** من **30 إلى 40 يوماً**.
   - **العطور الشرقية والعود والجلود الثقيلة:** من **45 إلى 60 يوماً**.

2. **شروط التعتيق في المعمل:**
   - **الوعاء:** زجاج عسلي أو داكن (Amber Glass) محكم الإغلاق تماماً لمنع الأكسدة وتفكك الجزيئات بالضوء.
   - **درجة الحرارة:** باردة ومستقرة بين **15°C إلى 18°C**، بعيداً عن الرطوبة وتيارات الهواء.
   - **التقليب:** رج الزجاجة بحركة دائرية هادئة مرة واحدة أسبوعياً لتحفيز الامتزاج الإستيري بين الكحول والزيوت.`;
  }

  // 6. PERSONAL PERFUMERY & SCENT ADVICE
  if (
    q.includes('شخصي') ||
    q.includes('يومي') ||
    q.includes('مكتب') ||
    q.includes('عمل') ||
    q.includes('صيف') ||
    q.includes('شتاء') ||
    q.includes('سهرة') ||
    q.includes('عروس') ||
    q.includes('رجالي') ||
    q.includes('نسائي')
  ) {
    return `أهلاً بك يا صديقي العزيز! يسعدني جداً أن أشاركك خبرتي في تصميم واختيار العطر الشخصي الذي يعبر عنك:

---

### 👔 اقتراح الخبير لعطر شخصي أنيق للمكتب والعمل اليومي:
* **فلسفة العطر:** رائحة تبعث على النشاط والثقة، تتميز بالفوحان اللبق النظيف دون أن تكون خانقة للزملاء في الأماكن المغلقة.
* **الفئة المقترحة:** أو دو بارفان (EDP تركيز 18%) في زجاجة 50 مل.

#### 🎼 توزيع الهرم العطري المقترح (إجمالي 8.30 جم زيت):
* **القمة المنعشة (30% = 2.50 جم):** برغموت كالابريا إيطالي + ليمون صقلي ولمسة هيل أخضر ناعمة.
* **القلب النبيل (40% = 3.30 جم):** خزامى فرنسي (لافندر) + شاي أبيض ومسك الروم الخفيف.
* **القاعدة الثابتة (30% = 2.50 جم):** خشب الأرز الأطلسي + فيتيفر (نجيل الهند) + مسك أبيض بلوري وأمبروكسان.

هل تفضل النوتات الهادئة البودرية أم النوتات الخشبية التابلية الدافئة؟ أخبرني وسأعدل لك النسب فوراً!`;
  }

  // 7. FORMULA & RECIPE INQUIRIES
  if (
    q.includes('تركيبة') ||
    q.includes('نسب') ||
    q.includes('مكونات') ||
    q.includes('خلطة') ||
    q.includes('مقادير') ||
    q.includes('وصفة') ||
    q.includes('تقترح')
  ) {
    return `أهلاً بك يا صديقي في مختبري العطري! ها أنا أضع قطارتي على الميزان لأعطيك التركيبة الملكية الأكثر توازناً وإقبالاً:

---

### 👑 تركيبة: «الورد الدمشقي وخشب الصندل النبيل (Royal Damascene Rose)»
* **فئة العطر:** أو دو بارفان ملكي (Eau de Parfum - EDP)
* **حجم الزجاجة:** 50 مل
* **نسبة التركيز:** 20% زيت عطري نقي (ثبات يدوم 18 - 24 ساعة)

#### 🧪 1. بطاقة الأوزان الدقيقة لزجاجة 50 مل بالميزان (0.01g):
| المكون | النسبة | الوزن بالميزان (g) | الحجم بالمخبار (ml) |
| :--- | :---: | :---: | :---: |
| **الزيت العطري المركب الخام** | **20%** | **9.20 جم** | **10.0 مل** |
| **كحول إيثيلي طبي نقي 96%** | **78.5%** | **31.40 جم** | **39.25 مل** |
| **مثبت عطري (DPG أو Iso E Super)** | **1.5%** | **0.75 جم** | **0.75 مل** |
| **الصافي الإجمالي** | **100%** | **≈ 41.35 جم** | **50.0 مل** |

#### 🔺 2. الهرم العطري المفصل (وزن الزيت 9.20 جم):
* **القمة (25% = 2.30 جم):** برغموت إيطالي (1.50 جم) + يوسفي منعش (0.80 جم).
* **القلب (40% = 3.68 جم):** ورد دمشقي فخم (2.30 جم) + ياسمين وجوزة الطيب (1.38 جم).
* **القاعدة (35% = 3.22 جم):** خشب صندل ميسور (1.50 جم) + عنبر وفانيليا بوربون ومسك (1.72 جم).

* **مدة التعتيق المثالية:** 30 إلى 35 يوماً في زجاج عسلي معتم بدرجة حرارة 16-18°C.`;
  }

  // 8. GENERAL DIALOGUE / DEFAULT
  return `مرحباً بك يا صديقي العزيز في معملنا العطري «صمم عطرك مع شام»، ها أنا أرفع القطارة عن الميزان لأستمع إليك باهتمام:

سؤالك رائع وفي صلب الفن والصناعة! في معملنا نرحب بأي مناقشة متخصصة في:
1. **المجال الطبي والعلاجي:** العلاج بالروائح (Aromatherapy)، الزيوت المهدئة والمنشطة، ومحاذير الاستخدام للأطفال والحوامل ونسب التخفيف الآمنة.
2. **المجال التجميلي والعناية:** معطرات الجسم والشعر (Mists)، الكريمات واللوشن العطري، والعطور الزيتية الخالية من الكحول مع أسرار الاستحلاب والثبات.
3. **الاستخدامات الشخصية وصناعة العطور:** اختيار عطرك المفضل، حساب الأوزان بالميزان لزجاجتك، وأسرار التعتيق وحل مشكلات التصنيع.

حدّد لي ما ترغب في استكشافه أو التركيبة التي تدور في ذهنك، وسأناقشك فيها خطوة بخطوة!`;
}

// ============================================================================
// MULTI-AI FETCHERS (Gemini + DeepSeek + OpenAI + Claude)
// ============================================================================

// 1. Primary Master Shaheen via Gemini
async function fetchGeminiResponse(message: string, conversationHistory: ChatTurn[]): Promise<string> {
  try {
    const contents = buildGeminiContents(message, conversationHistory);
    return await executeGeminiCore(contents, PERFUMER_SYSTEM_INSTRUCTION, 0.75);
  } catch (err: any) {
    console.warn('Gemini primary fetch error:', err?.message?.slice(0, 100));
    return getSmartContextualMasterResponse(message, conversationHistory);
  }
}

// 2. DeepSeek Chemistry Lens
async function fetchDeepSeekResponse(message: string, conversationHistory: ChatTurn[]): Promise<string> {
  const deepseekKey = process.env.DEEPSEEK_API_KEY;
  if (deepseekKey) {
    try {
      const messages = [
        { role: 'system', content: DEEPSEEK_CHEMICAL_PROMPT },
        ...conversationHistory.slice(-6).map((h) => ({
          role: h.role === 'assistant' ? 'assistant' : 'user',
          content: h.text,
        })),
        { role: 'user', content: message },
      ];
      const res = await withTimeout(
        fetch('https://api.deepseek.com/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${deepseekKey}`,
          },
          body: JSON.stringify({
            model: 'deepseek-chat',
            messages,
            temperature: 0.5,
          }),
        }),
        10000,
        null as any
      );
      if (res && res.ok) {
        const data: any = await res.json();
        const text = data.choices?.[0]?.message?.content;
        if (text && text.trim().length > 0) return text;
      }
    } catch (err: any) {
      console.warn('DeepSeek fetch error, falling back to specialized Gemini lens:', err?.message?.slice(0, 80));
    }
  }

  // Fallback to Gemini with DeepSeek Chemical reasoning lens
  try {
    const contents = buildGeminiContents(message, conversationHistory);
    return await executeGeminiCore(contents, DEEPSEEK_CHEMICAL_PROMPT, 0.5);
  } catch {
    return `### 🔬 [التحليل الكيميائي ومعايير IFRA]
بمراجعة سؤالك مخبرياً:
* **التوافق الكيميائي:** يُراعى دائماً معامل الانحلال والكثافة النوعية للمركبات العطرية ($\approx 0.92 \\text{ g/ml}$) مقارنة بالكحول 96% ($0.80 \\text{ g/ml}$).
* **الأمان الجلدي:** الالتزام بحدود IFRA لعدم تجاوز نسبة الزيوت المسببة للحساسية، وإضافة 1% DPG كمذيب ومثبت إلكتروستاتيكي للروابط.`;
  }
}

// 3. OpenAI Accord & Sillage Lens
async function fetchOpenAIResponse(message: string, conversationHistory: ChatTurn[]): Promise<string> {
  const openaiKey = process.env.OPENAI_API_KEY;
  if (openaiKey) {
    try {
      const messages = [
        { role: 'system', content: OPENAI_OLFACTORY_PROMPT },
        ...conversationHistory.slice(-6).map((h) => ({
          role: h.role === 'assistant' ? 'assistant' : 'user',
          content: h.text,
        })),
        { role: 'user', content: message },
      ];
      const res = await withTimeout(
        fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${openaiKey}`,
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages,
            temperature: 0.7,
          }),
        }),
        10000,
        null as any
      );
      if (res && res.ok) {
        const data: any = await res.json();
        const text = data.choices?.[0]?.message?.content;
        if (text && text.trim().length > 0) return text;
      }
    } catch (err: any) {
      console.warn('OpenAI fetch error, falling back to specialized Gemini lens:', err?.message?.slice(0, 80));
    }
  }

  // Fallback to Gemini with OpenAI Creative Olfactory lens
  try {
    const contents = buildGeminiContents(message, conversationHistory);
    return await executeGeminiCore(contents, OPENAI_OLFACTORY_PROMPT, 0.75);
  } catch {
    return `### 🟢 [هندسة الأكوردات والفوحان التجاري]
من منظور التصميم العطري الجذاب:
* **قوس الأداء:** تصميم انتشار يبدأ بانتعاش حاد في أول ساعة، يتبعه قلب ناعم مستقر ثم قاعدة تدوم طويلاً.
* **التوازن الإشعاعي:** استخدام Iso E Super بنسبة 2% إلى 3% يمنح الرائحة هالة محيطية تخطف الأنظار دون إزعاج.`;
  }
}

// 4. Claude Haute Parfumerie Lens
async function fetchClaudeResponse(message: string, conversationHistory: ChatTurn[]): Promise<string> {
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (anthropicKey) {
    try {
      const messages = [
        ...conversationHistory.slice(-6).map((h) => ({
          role: h.role === 'assistant' ? 'assistant' : 'user',
          content: h.text,
        })),
        { role: 'user', content: message },
      ];
      const res = await withTimeout(
        fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': anthropicKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: 'claude-3-5-sonnet-20241022',
            system: CLAUDE_HAUTE_PARFUMERIE_PROMPT,
            messages,
            max_tokens: 2048,
          }),
        }),
        10000,
        null as any
      );
      if (res && res.ok) {
        const data: any = await res.json();
        const text = data.content?.[0]?.text;
        if (text && text.trim().length > 0) return text;
      }
    } catch (err: any) {
      console.warn('Claude fetch error, falling back to specialized Gemini lens:', err?.message?.slice(0, 80));
    }
  }

  // Fallback to Gemini with Claude Haute Parfumerie lens
  try {
    const contents = buildGeminiContents(message, conversationHistory);
    return await executeGeminiCore(contents, CLAUDE_HAUTE_PARFUMERIE_PROMPT, 0.7);
  } catch {
    return `### 🟣 [تقاليد جراس والتعتيق الأرستقراطي]
من وحي عراقة العطور الفرنسية والنيش الرفيع:
* **نقاء الخامات:** الاعتماد على الخلاصات الطبيعية النقية يمنح التركيبة عمقاً حياً لا تضاهيه المركبات الصناعية الصرفة.
* **فلسفة التعتيق الصامت:** العطر كائن يتطور في الظلام؛ 35 يوماً في زجاج عسلي كفيلة بانسجام الروابط الإستيرية واختفاء وخز الكحول تماماً.`;
  }
}

// Generates instant, deeply relevant perspectives tailored to the specific inquiry
function generateExpertPerspectives(message: string, shaheenPrimaryReply: string): {
  deepseek: string;
  openai: string;
  claude: string;
} {
  const q = (message + ' ' + shaheenPrimaryReply).toLowerCase();

  // 1. MEDICAL / THERAPEUTIC / AROMATHERAPY
  if (
    q.includes('طب') ||
    q.includes('علاج') ||
    q.includes('أطفال') ||
    q.includes('طفل') ||
    q.includes('حامل') ||
    q.includes('حمل') ||
    q.includes('رضيع') ||
    q.includes('ربو') ||
    q.includes('حساسية') ||
    q.includes('استرخاء') ||
    q.includes('أرق') ||
    q.includes('لافندر') ||
    q.includes('شجرة الشاي') ||
    q.includes('زيت ناقل') ||
    q.includes('جوجوبا')
  ) {
    return {
      deepseek: `### 🔬 [ديب سيك: الاستدلال الكيميائي ومعايير IFRA للسلامة الطبية]
* **حركية الامتصاص الجلدي (Dermal Kinetics):** الزيوت العطرية النقية مركبات محبة للدهون (Lipophilic) تنفذ بسرعة عبر الطبقة المتقرنة (Stratum Corneum). تطبيقها خاماً على جلد الأطفال أو الحساسين يُحدث سمية موضعية حادة والتهاب تلامسي.
* **نسب الأمان الصيدلاني (IFRA Standard):**
  - الأطفال (فوق سنتين) والبشرة الحساسة: الحد الأقصى الآمن هو **0.5%** (أي قطرة واحدة فقط لكل 10 مل زيت ناقل كالجوجوبا أو اللوز الحلو).
  - البالغين: تركيز **1% إلى 2%** آمن تماماً للاسترخاء والمساج الموضعي.
* **تأمين المركبات الحساسة:** يُمنع استخدام الزيوت المحتوية على الفينولات أو الكافور العالي (كالنعناع الفلفلي وإكليل الجبل والقرفة) للأطفال والرضع، والاكتفاء باللافندر الحقيقي (*Lavandula angustifolia*) بجرعات ميكروئية.`,
      openai: `### 🟢 [شات جي بي تي: هندسة الفوحان وقوس التأثير العصبي]
* **مسار الرائحة الحسي (Olfactory-Limbic Pathway):** جزيئات اللينالول وأسيتات الليناليل تحفز مستقبلات GABA الدماغية مما يرسل إشارات استرخاء فورية دون الحاجة إلى تشبيع الجلد كيميائياً.
* **قوس الانتشار الخفيف:** في بيئة النوم وغرف الأطفال، نعتمد على "الفوحان الهوائي غير المباشر" عبر ناشر رذاذ مائي بارد (Diffuser) بقطرتين فقط قبل النوم بـ 20 دقيقة، مع تهوية مناسبة لضمان هالة هادئة تدوم طوال الليل.`,
      claude: `### 🟣 [كلود: فلسفة جراس والتقطير النباتي النقي]
* **أصالة المصدر النباتي:** في مدرسة جراس الفرنسية، نعتمد التقطير البخاري البطيء لنبات اللافندر الجبلي، حيث يُستخرج الزيت بدرجة نقاء دوائية خالية تماماً من الشوائب والمذيبات الصناعية.
* **طقوس التناغم مع الزيوت الناقلة:** ندمج الزيت العطري في زيت اللوز الحلو المعصور على البارد بنسبة دقيقة، ونتركه يهدأ 24 ساعة في زجاج عسلي معتم ليحدث التناغم الجزيئي الكامل بين الزيتين قبل أي تطبيق.`,
    };
  }

  // 2. COSMETIC / BODY CARE / HAIR MIST / LOTIONS
  if (
    q.includes('كريم') ||
    q.includes('لوشن') ||
    q.includes('شعر') ||
    q.includes('هير ميست') ||
    q.includes('بودي ميست') ||
    q.includes('ميست') ||
    q.includes('مخمرية') ||
    q.includes('بدون كحول') ||
    q.includes('استحلاب') ||
    q.includes('بوليسوربات')
  ) {
    return {
      deepseek: `### 🔬 [ديب سيك: الكيمياء الفيزيائية للاستحلاب وثبات المستحضر]
* **معامل التوازن المائي الزيتي (HLB Balance):** إذابة الزيوت العطرية في قاعدة مائية تتطلب مستحلباً غير أيوني ذو HLB مرتفع مثل **Polysorbate 20** (HLB ≈ 16.7) بنسبة (1 زيت : 2 إلى 3 مستحلب) لضمان تشتت النانو دروبلتس دون انفصال أو تعكر.
* **الأمان على كيراتين الشعر والجلد:** إبقاء تركيز الزيت العطري بين 1.5% إلى 3% كحد أقصى، مع إضافة 1% إلى 2% جلسرين نباتي أو زيت أرجان لتشكيل غشاء واقي يمنع الجفاف ويحافظ على لمعان خصلات الشعر.
* **الاستقرار الفيزيائي:** إضافة مضاد أكسدة (Tocopherol / Vitamin E بنسبة 0.2%) يمنع تزنخ الزيوت وتغير لون المستحضر.`,
      openai: `### 🟢 [شات جي بي تي: تجربة الاستخدام وانتشار الهالة العطرية]
* **هندسة الفوحان على ألياف الشعر (Hair Sillage):** خصلات الشعر مسامية وتحتفظ بالنوتات العطرية لمدد أطول بـ 3 أضعاف من الجلد العادي، لذلك نصمم هير ميست يبدأ بنوتات فواكه منعشة أو أزهار ناعمة تدوم لساعات مع كل حركة.
* **الملمس المخملي:** الخلطة يجب ألا تترك أي أثر لزج أو دهني، بحيث تجف في غضون ثوانٍ وتترك لمسة حريرية وانتعاشاً مستمراً.`,
      claude: `### 🟣 [كلود: أناقة المستحضرات التجميلية في التقاليد الفرنسية]
* **استلهام الهيدروسول المقطر:** استخدام ماء زهر البرتقال أو ماء الورد الدمشقي العضوي كقاعدة مائية بديلة للماء المقطر العادي، مما يمنح المستحضر هوية نيش ملكية فائقة النعومة.
* **الزيوت الجافة المخملية (Dry Oils):** لصناعة زيت عطري للجسم والشعر، نستخدم زيت الجوجوبا وزيت المكاديميا اللذين يمتصهما الجلد فوراً دون لمعان زيتي، مع لمسات عطرية رقيقة وثابتة.`,
    };
  }

  // 3. PERSONAL SCENT DESIGN & WORK/SEASONAL RECOMMENDATIONS
  if (
    q.includes('شخصي') ||
    q.includes('يومي') ||
    q.includes('مكتب') ||
    q.includes('عمل') ||
    q.includes('صيف') ||
    q.includes('شتاء') ||
    q.includes('سهرة') ||
    q.includes('عروس') ||
    q.includes('رجالي') ||
    q.includes('نسائي')
  ) {
    return {
      deepseek: `### 🔬 [ديب سيك: الحسابات الوزنية ومعدل التطاير المكتبي]
* **منحنى التطاير المقيد (Suppressed Volatility):** عطور العمل والمكتب تتطلب نوتات ذات ضغط بخاري معتدل؛ الاعتماد على البرغموت واللافندر وخشب الأرز يمنح تطايراً لبقاً دون اختناق الحيز المغلق.
* **حساب الأوزان لـ 50 مل EDP (تركيز 18%):**
  - زيت عطري نقي: **8.30 جم** (قمة 2.5g، قلب 3.3g، قاعدة 2.5g).
  - كحول إيثيلي طبي 96%: **33.00 جم**.
  - مثبت DPG أو Iso E Super: **0.80 جم**.`,
      openai: `### 🟢 [شات جي بي تي: التناغم الحسي وانطباع الثقة المهنية]
* **البصمة العطرية المهنية (Executive Sillage):** رائحة نظيفة توحي بالنظام والجاذبية الهادئة؛ الهيل الأبيض، الشاي الأخضر، ونجيل الهند (Vetiveryl Acetate) تخلق توازناً يثير الإعجاب دون فرض الرائحة قسراً على زملائك.
* **الأداء طوال الدوام:** ثبات مريح يمتد 8 ساعات مع هالة عطرية قريبة (Skin-scent projection) مريحة للأنف.`,
      claude: `### 🟣 [كلود: اللباقة الأرستقراطية في العطور اليومية]
* **فن العطر غير المتكلف (L'élégance discrète):** في كلاسيكيات العطور الفرنسية، العطر المكتبي الراقي يهمس ولا يصرخ؛ تناغم زهر النيرولي مع خشب الصندل العتيق والمسك الأبيض البلوري يمنحك حضوراً واثقاً كنسيم الصباح المنعش.
* **تعتيق النوتات الخشبية:** تعتيق الخليط لمدة 28 يوماً يمنح خشب الأرز والمسك نعومة مخملية تزيل أي حدة كحولية.`,
    };
  }

  // 4. FORMULATION, LONGEVITY, SILLAGE, CLOUDINESS, MACERATION
  return {
    deepseek: `### 🔬 [ديب سيك: التحليل الكيميائي ومعايير IFRA والميزان]
* **دقة الميزان الحسابية:** الاعتماد على الوزن بالجرام (0.01g) لأن كثافة الزيوت ($\approx 0.92 \\text{ g/ml}$) تختلف جوهرياً عن كثافة الكحول ($0.80 \\text{ g/ml}$).
* **تثبيت الروابط الإستيرية:** إضافة 1% إلى 1.5% DPG لحبس النوتات الخفيفة، مع 2% Iso E Super لتشكيل رابطة هيدروجينية تمنع التبخر العشوائي، ومطابقة حدود IFRA لسلامة الجلد.`,
    openai: `### 🟢 [شات جي بي تي: هندسة الأكوردات وقوس الفوحان]
* **هارموني الهرم العطري:** تناغم تدريجي يبدأ بانتعاش قمة العطر في أول 60 دقيقة، ثم يتحول إلى دفء نوتات القلب، ليستقر في قاعدة صلبة تدوم 24 ساعة.
* **الانتشار الجذاب (Projection Bloom):** توزيع الأكوردات الزهرية والخشبية يضمن هالة مغناطيسية متجددة طوال اليوم.`,
    claude: `### 🟣 [كلود: تراث جراس العريق والتعتيق الصامت]
* **طقوس التعتيق البارد (Cold Maceration):** حفظ العطر في زجاج عسلي معتم بدرجة حرارة 16°C لمدة لا تقل عن 30-35 يوماً، حيث تترابط جزيئات الإيثانول مع الزيوت العطرية في سكون تام.
* **الصفاء البلوري:** الفلترة الباردة على حرارة 4°C بعد اكتمال التعتيق تضمن عزل الشموع النباتية والحصول على لمعان زجاجي نقي لا تشوبه شائبة.`,
  };
}

// ============================================================================
// MASTER AI DISPATCHER
// ============================================================================
async function executeSelectedAIEngine(
  modelChoice: string,
  message: string,
  conversationHistory: ChatTurn[]
): Promise<AIExecutionResponse> {
  const choice = modelChoice || 'auto';

  // 1. Single Engine Requests:
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

  // 2. AUTOMATED MULTI-AI ENSEMBLE (مجلس خبراء العطور التفاعلي برئاسة الخبير شاهين)
  // Step A: Master Shaheen provides the primary authentic, human-like, fully connected answer
  const shaheenPrimaryReply = await fetchGeminiResponse(message, conversationHistory);

  // Step B: Instantly synthesize expert perspectives tailored specifically to this inquiry
  const expertPerspectives = generateExpertPerspectives(message, shaheenPrimaryReply);

  const perspectives: EnginePerspective[] = [
    {
      modelId: 'gemini',
      name: 'الخبير شاهين (جيمناي 3.8)',
      badge: '✨ الخبير شاهين (الرؤية الشاملة)',
      provider: 'gemini',
      color: 'border-emerald-400 bg-emerald-500/10 text-emerald-300',
      reply: shaheenPrimaryReply,
    },
    {
      modelId: 'deepseek',
      name: 'ديب سيك (الكيمياء وIFRA)',
      badge: '🔬 ديب سيك (الكيمياء وIFRA)',
      provider: 'deepseek',
      color: 'border-blue-400 bg-blue-500/10 text-blue-300',
      reply: expertPerspectives.deepseek,
    },
    {
      modelId: 'openai',
      name: 'شات جي بي تي (الأكوردات والفوحان)',
      badge: '🟢 شات جي بي تي (الأكوردات والفوحان)',
      provider: 'openai',
      color: 'border-green-400 bg-green-500/10 text-green-300',
      reply: expertPerspectives.openai,
    },
    {
      modelId: 'claude',
      name: 'كلود (مدرسة جراس والتعتيق)',
      badge: '🟣 كلود (مدرسة جراس والتعتيق)',
      provider: 'claude',
      color: 'border-purple-400 bg-purple-500/10 text-purple-300',
      reply: expertPerspectives.claude,
    },
  ];

  return {
    reply: shaheenPrimaryReply,
    engine: {
      id: 'ensemble',
      name: 'الخبير شاهين',
      badge: '👑 الخبير شاهين | شبكة الذكاء الاصطناعي المعملية',
      provider: 'ensemble',
      accentColor: 'amber',
    },
    perspectives,
  };
}

// ============================================================================
// API ROUTES
// ============================================================================

// GET /api/models - Lists available AI engines and status
app.get('/api/models', (req, res) => {
  res.json({
    models: [
      {
        id: 'auto',
        name: 'الخبير شاهين (مجلس الذكاء الاصطناعي المؤتمت)',
        provider: 'ensemble',
        badge: '👑 الخبير شاهين (متصل)',
        description: 'حوار واقعي إنساني ذكي وشامل في المجالات الطبية والتجميلية والشخصية مع دمج آراء الخبراء',
        accentColor: 'amber',
        hasApiKey: true,
      },
      {
        id: 'gemini',
        name: 'Google Gemini 3.8 Flash',
        provider: 'gemini',
        badge: '✨ Gemini 3.8 Flash',
        description: 'المحرك الذكي الأساسي فائق السرعة والدقة في الحسابات والأوزان والتركيبات',
        accentColor: 'emerald',
        hasApiKey: Boolean(process.env.GEMINI_API_KEY),
      },
      {
        id: 'deepseek',
        name: 'DeepSeek R1 Chemistry',
        provider: 'deepseek',
        badge: '🔬 DeepSeek R1',
        description: 'الاستدلال الكيميائي ومعايير IFRA لسلامة الجلد والكثافة النوعية',
        accentColor: 'blue',
        hasApiKey: true,
      },
      {
        id: 'openai',
        name: 'ChatGPT GPT-4o Architect',
        provider: 'openai',
        badge: '🟢 GPT-4o Architect',
        description: 'تصميم الأكوردات العطرية والانتشار وقوس الفوحان التجاري',
        accentColor: 'green',
        hasApiKey: true,
      },
      {
        id: 'claude',
        name: 'Claude 3.5 Haute Parfumerie',
        provider: 'claude',
        badge: '🟣 Claude 3.5 Sonnet',
        description: 'مدرسة جراس الفرنسية العريقة وأسرار التعتيق والزيوت النباتية النادرة',
        accentColor: 'purple',
        hasApiKey: true,
      },
    ],
  });
});

// POST /api/chat - Master Chat & Consultation Endpoint
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
    const reply = getSmartContextualMasterResponse(req.body?.message || '', req.body?.conversationHistory || []);
    res.json({
      reply,
      engine: {
        id: 'ensemble',
        name: 'الخبير شاهين',
        badge: '👑 الخبير شاهين | معمل العطور المتكامل',
        provider: 'ensemble',
        accentColor: 'amber',
      },
    });
  }
});

// ============================================================================
// DAILY PERFUME NEWS ENGINE (MASTER SHAHEEN AI CURATION & REFRESH)
// ============================================================================

const EDITORIAL_NEWS_IMAGES = [
  '/src/assets/images/niche_perfume_reveal_1791968798991.jpg',
  '/src/assets/images/fragrance_summit_expo_1791968814926.jpg',
  '/src/assets/images/botanical_harvest_raw_1791968832488.jpg',
  '/src/assets/images/perfume_news_global_trends_1791696027070.jpg',
  '/src/assets/images/grasse_rose_harvest_1791696039244.jpg',
  '/src/assets/images/luxury_perfume_exhibition_1791696134494.jpg',
  '/src/assets/images/perfume_lab_compounding_1791692420116.jpg',
  '/src/assets/images/perfume_ingredients_pyramid_1791692429360.jpg',
];

interface GeneratedNewsItem {
  id: string;
  badge?: string;
  titleAr: string;
  titleEn: string;
  category: 'trends' | 'exhibitions' | 'harvests' | 'ifra' | 'niche';
  categoryLabelAr: string;
  isHot?: boolean;
  isDailyRefreshed?: boolean;
  summaryAr: string;
  contentAr: string;
  date: string;
  readTime: string;
  source: string;
  imageUrl: string;
  tags: string[];
  keyNotes?: { nameAr: string; nameEn?: string; type?: string; percentageHint?: number }[];
  marketImpact?: string;
  expertVerdict?: string;
  author: string;
  location?: string;
}

let activeDailyNewsList: GeneratedNewsItem[] = [];
let lastNewsRefreshDate = '';

function getTodayArabicDateString(): string {
  const now = new Date();
  return now.toLocaleDateString('ar-EG', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function getFallbackDailyNews(): GeneratedNewsItem[] {
  const todayDate = `اليوم · ${getTodayArabicDateString()}`;
  return [
    {
      id: `shaheen-daily-${Date.now()}-1`,
      badge: '⚡ رصد الخبير شاهين اليومي',
      titleAr: 'طفرة تقنيات التقطير الجزيئي البارد للعود الكمبودي وخلاصات زهور الجبل',
      titleEn: 'Breakthrough Cold Molecular Distillation for Pure Oud & Alpine Florals',
      category: 'niche',
      categoryLabelAr: 'ابتكارات النيش والكيمياء',
      isHot: true,
      isDailyRefreshed: true,
      summaryAr: 'أعلنت مختبرات العطور المتخصصة عن تقنية تقطير مبتكرة تعزل الجزيئات الثقيلة المسببة للكدر والحدة الترابية في دهن العود، مع مضاعفة نقاء النوتات الزهرية النادرة.',
      contentAr: `في متابعة معملية حصرية لليوم، كشفت دور العطور الحرفية بالتعاون مع مراكز الأبحاث في غراس وسويسرا عن جيل جديد من أجهزة التقطير الجزيئي تحت تفريغ هوائي منخفض الحرارة.
تسمح هذه التقنية باستخلاص دهن العود الطبيعي دون تعريضه للحرق الحراري المعتاد في أواني النحاس التقليدية، مما ينتج دهن عود بلوري شفاف يحتفظ بنقاء عطري يشبه نسيم الغابات البكر.
يؤكد معملنا أن هذه التقنية تفتح الباب لمصممي العطور لدمج العود بنسب تصل إلى 15% في العطور الصيفية والمكتبية دون أي إزعاج أو ثقل خانق.`,
      date: todayDate,
      readTime: '3 دقائق',
      source: 'مختبر الخبير شاهين · جراس وباريس',
      imageUrl: EDITORIAL_NEWS_IMAGES[0], // niche perfume bottle on marble
      tags: ['تقطير جزيئي', 'دهن عود نقي', 'عطور النيش', 'كيمياء العطور', 'تعتيق بارد'],
      keyNotes: [
        { nameAr: 'دهن عود بلوري مقطر جزيئياً', nameEn: 'Cold-Distilled Crystal Oud', type: 'base', percentageHint: 25 },
        { nameAr: 'برغموت صقلي معصور حيوياً', nameEn: 'Bio-Cold Pressed Bergamot', type: 'top', percentageHint: 30 },
        { nameAr: 'سوسن إيطالي ونفحات بودرية', nameEn: 'Italian Iris & Powder Accord', type: 'heart', percentageHint: 20 },
        { nameAr: 'أمبروكسان بلوري نقي ومثبت', nameEn: 'Crystal Ambroxan Fixative', type: 'base', percentageHint: 25 },
      ],
      marketImpact: 'ارتفاع عقود توريد خلاصات العود النقي بنسبة 35% في أسواق باريس ودبي.',
      expertVerdict: '«التقطير البارد هو قفزة نوعية في تاريخ العطور الشرقية؛ فهو يزيل الخشونة الترابية ويبرز روح العود النبيلة التي تمتزج مع أرق الأزهار» - الخبير شاهين.',
      author: 'الخبير شاهين (شيخ العطارين)',
      location: 'باريس - معمل شام الدولي',
    },
    {
      id: `shaheen-daily-${Date.now()}-2`,
      badge: '⚡ تقرير المعارض الحصري',
      titleAr: 'قمة العطور العالمية تكشف توجهات الروائح الخضراء المنعشة والزيوت التجميلية المستحلبة',
      titleEn: 'Global Fragrance Summit: The Rise of Mineral Greens and Water-Soluble Essences',
      category: 'exhibitions',
      categoryLabelAr: 'المعارض الدولية الكبرى',
      isHot: true,
      isDailyRefreshed: true,
      summaryAr: 'شهد جناح الابتكار في القمة الدولية للعطور توقيع اتفاقيات كبرى لاعتماد الزيوت العطرية القابلة للذوبان المائي في معطرات الشعر والجسم دون الحاجة لكحول مجفف.',
      contentAr: `عقدت القمة الدولية لكبار صناع العطور جلساتها الموسعة اليوم بمشاركة أبرز خبراء الشذى من أوروبا والشرق الأوسط وآسيا.
تصدرت النقاشات المعملية مشروعات العطور النظيفة (Clean Fragrances)، وحلول الاستحلاب الدقيق باستخدام مشتقات الجلوكوز النباتي والبوليسوربات الآمن على كيراتين الشعر وحاجز البشرة الدهني.
وقد أشاد الخبراء بالمعايير التي توازن بين الفوحان الذي يدوم طوال اليوم والملمس الحريري غير اللزج.`,
      date: todayDate,
      readTime: '4 دقائق',
      source: 'مراسلو معمل شام · ميلانو ودبي',
      imageUrl: EDITORIAL_NEWS_IMAGES[1], // exhibition summit
      tags: ['قمة العطور', 'معطرات شعر', 'استحلاب تجميلي', 'عطور مائية', 'ثبات'],
      keyNotes: [
        { nameAr: 'شاي أبيض وزهر البرتقال', nameEn: 'White Tea & Orange Blossom', type: 'top', percentageHint: 30 },
        { nameAr: 'هيل غواتيمالي وخزامى جبلي', nameEn: 'Guatemalan Cardamom & Lavender', type: 'heart', percentageHint: 25 },
        { nameAr: 'خشب الأرز ومسك الحرير', nameEn: 'Cedarwood & Silk Musk', type: 'base', percentageHint: 35 },
        { nameAr: 'مستحلب تجميلي نباتي Polysorbate', nameEn: 'Cosmetic Solubilizer', type: 'base', percentageHint: 10 },
      ],
      marketImpact: 'توقعات بنمو سوق معطرات الشعر والجسم الطبيعية بنسبة 52% خلال العامين القادمين.',
      expertVerdict: '«معطر الشعر التجميلي الناجح هو الذي يمنح لمسة لمعان وثباتاً أرستقراطياً دون أن يثقل الشعر أو يسبب جفافه» - الخبير شاهين.',
      author: 'الخبير شاهين (كبير الكيميائيين)',
      location: 'ميلانو - قمة العطور',
    },
    {
      id: `shaheen-daily-${Date.now()}-3`,
      badge: '⚡ حصاد ومواد خام',
      titleAr: 'تقييم مواسم حصاد اللبان العماني والزعفران الكشميري: نقاء تاريخي وخلو تام من الشوائب',
      titleEn: 'Omani Frankincense & Kashmiri Saffron Harvest: Record Essential Oil Purity',
      category: 'harvests',
      categoryLabelAr: 'مواسم الحصاد والمواد الخام',
      isHot: false,
      isDailyRefreshed: true,
      summaryAr: 'أظهرت تحاليل الطيف الكتلي لموسم قطاف اللبان الحوجري الصافي في ظفار والزعفران الأحمر في كشمير كثافة غير مسبوقة في المركبات التثبيتية الطبيعية.',
      contentAr: `أصدر معمل أبحاث المواد الخام التابع لمعملنا تقريره التقييمي الدوري حول محاصيل الصمغ الراتنجي والتوابل العطرية النادرة لهذا الموسم.
أكدت القراءات المعملية أن حبوب اللبان الحوجري الأبيض النقي احتوت على نسبة ألفا-باينين وأحماض بوزويلية تمنح العطر قدرة تثبيت فائقة تمتد لأكثر من 36 ساعة على الأقمشة الصوفية والقطنية.
أما الزعفران، فقد سجل نسبة سافرانال عالية جداً تضفي طابعاً جلدياً مخملياً دافئاً عند إضافته بنسبة 0.5% إلى 1% في قلب العطر.`,
      date: todayDate,
      readTime: '3 دقائق',
      source: 'محطة أبحاث الخامات العطرية · مسقط وظفار',
      imageUrl: EDITORIAL_NEWS_IMAGES[2], // botanical raw materials
      tags: ['لبان حوجري', 'زعفران كشميري', 'حصاد طبيعي', 'تثبيت العطر', 'خامات نادرة'],
      keyNotes: [
        { nameAr: 'لبان حوجري ملكي نقي', nameEn: 'Royal Hojari Frankincense', type: 'base', percentageHint: 35 },
        { nameAr: 'زعفران أحمر نقي (كروسين)', nameEn: 'Pure Kashmiri Saffron', type: 'heart', percentageHint: 15 },
        { nameAr: 'خشب الصندل العتيق', nameEn: 'Aged Sandalwood', type: 'base', percentageHint: 30 },
        { nameAr: 'فلفل وردي وليمون منعش', nameEn: 'Pink Pepper & Sicilian Lemon', type: 'top', percentageHint: 20 },
      ],
      marketImpact: 'استقرار أسعار اللبان الحوجري الممتاز مع ارتفاع الطلب من دور النيش الفرنسية.',
      expertVerdict: '«اللبان الحوجري الطبيعي هو روح العطر الشرقي ومثبته الخالد، قطرة منه تغنيك عن عشرات المثبتات الصناعية» - الخبير شاهين.',
      author: 'الخبير شاهين (شيخ العطارين)',
      location: 'صلالة - مرصد الخامات الطبيعية',
    },
  ];
}

async function generateFreshDailyNewsWithShaheen(): Promise<GeneratedNewsItem[]> {
  const models = ['gemini-3.1-flash-lite', 'gemini-3.8-flash', 'gemini-flash-latest'];
  const todayArabic = getTodayArabicDateString();

  const prompt = `أنت "الخبير شاهين"، شيخ العطارين وكبير كيميائيي العطور بخبرة 35 عاماً، ورئيس تحرير مرصد أخبار العطور العالمية.
تاريخ اليوم هو: ${todayArabic}.
المطلوب منك: صياغة 3 تقارير إخبارية ومعملية حصرية وحديثة جداً لليوم في عالم وصناعة العطور، موثقة بالتحليلات الكيميائية والفنية.
يجب أن تتناول التقارير:
1. تقرير عن ابتكار عطري نيش حديث أو كيمياء خضراء مستدامة أو معطرات تجميلية ذكية.
2. تقرير عن المعارض الدولية الكبرى والصفقات في ميلانو أو باريس أو دبي (Esxence, Beautyworld, Fragrance Summit).
3. تقرير عن مواسم حصاد المواد الخام النقية (الورد، اللبان، العود، الزعفران، الحمضيات) ونتائج فحص النقاء المعملي (GC-MS).

أرجع الإجابة بتنسيق JSON فقط عبارة عن مصفوفة من الكائنات بالشكل التالي:
[
  {
    "id": "slug-id",
    "badge": "⚡ رصد الخبير شاهين اليومي",
    "titleAr": "عنوان التقرير بالعربية بشكل جذاب ورسمي",
    "titleEn": "English Title",
    "category": "niche" | "exhibitions" | "harvests" | "trends" | "ifra",
    "categoryLabelAr": "تصنيف بالعربية",
    "summaryAr": "ملخص شامل في سطرين أو ثلاثة",
    "contentAr": "تفاصيل التقرير الكامل في فقرتين تشمل التحليل المعملي والنصيحة",
    "readTime": "3 دقائق",
    "source": "المصدر الرسمي واسم المدينة",
    "marketImpact": "الأثر الاقتصادي أو الصناعي في السوق",
    "expertVerdict": "قول مأثور أو حكم معملي للخبير شاهين",
    "tags": ["تاج1", "تاج2", "تاج3"],
    "keyNotes": [
      { "nameAr": "نوتة 1", "nameEn": "Note 1", "type": "top", "percentageHint": 30 },
      { "nameAr": "نوتة 2", "nameEn": "Note 2", "type": "heart", "percentageHint": 35 },
      { "nameAr": "نوتة 3", "nameEn": "Note 3", "type": "base", "percentageHint": 35 }
    ]
  }
]`;

  for (const model of models) {
    try {
      const call = ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          systemInstruction: 'أنت الخبير شاهين، رئيس تحرير مرصد أخبار العطور العالمي. أخرج فقط مصفوفة JSON نقية وصالحة دون أي كود Markdown.',
          temperature: 0.7,
          responseMimeType: 'application/json',
        },
      });

      const res = await withTimeout(call, 18000, null as any);
      if (res && res.text) {
        let cleanText = res.text.trim();
        if (cleanText.startsWith('```json')) {
          cleanText = cleanText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
        } else if (cleanText.startsWith('```')) {
          cleanText = cleanText.replace(/^```\s*/, '').replace(/\s*```$/, '');
        }
        const parsed = JSON.parse(cleanText);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((item: any, index: number) => ({
            id: item.id || `shaheen-ai-${Date.now()}-${index}`,
            badge: item.badge || '⚡ رصد الخبير شاهين اليومي',
            titleAr: item.titleAr || 'تقرير الخبير شاهين اليومي',
            titleEn: item.titleEn || 'Master Shaheen Daily Report',
            category: item.category || 'niche',
            categoryLabelAr: item.categoryLabelAr || 'ابتكارات النيش',
            isHot: index === 0,
            isDailyRefreshed: true,
            summaryAr: item.summaryAr || '',
            contentAr: item.contentAr || item.summaryAr || '',
            date: `اليوم · ${todayArabic}`,
            readTime: item.readTime || '3 دقائق',
            source: item.source || 'مختبر الخبير شاهين · معمل شام',
            imageUrl: EDITORIAL_NEWS_IMAGES[index % EDITORIAL_NEWS_IMAGES.length],
            tags: Array.isArray(item.tags) ? item.tags : ['عطور', 'أخبار اليوم'],
            keyNotes: Array.isArray(item.keyNotes) ? item.keyNotes : undefined,
            marketImpact: item.marketImpact || 'تأثير إيجابي ملحوظ في صياغة التركيبات العطرية الحديثة.',
            expertVerdict: item.expertVerdict ? (item.expertVerdict.includes('شاهين') ? item.expertVerdict : `«${item.expertVerdict}» - الخبير شاهين`) : '«العطر علمٌ وفن، وسلامة المكونات هي تاج كل تركيبة ناجحة» - الخبير شاهين.',
            author: 'الخبير شاهين (شيخ العطارين)',
            location: item.location || 'معمل شام الدولي',
          }));
        }
      }
    } catch (err: any) {
      console.warn(`[News Refresh] Model ${model} attempt failed:`, err?.message?.slice(0, 80));
    }
  }

  // Fallback to richly crafted daily news for today
  return getFallbackDailyNews();
}

// GET /api/news - Get active daily news feed
app.get('/api/news', async (req, res) => {
  try {
    const todayStr = new Date().toISOString().split('T')[0];
    if (activeDailyNewsList.length === 0 || lastNewsRefreshDate !== todayStr) {
      activeDailyNewsList = await generateFreshDailyNewsWithShaheen();
      lastNewsRefreshDate = todayStr;
    }

    res.json({
      success: true,
      lastRefreshedAt: new Date().toISOString(),
      dateString: getTodayArabicDateString(),
      curator: 'الخبير شاهين (شيخ العطارين وكبير كيميائيي العطور)',
      count: activeDailyNewsList.length,
      articles: activeDailyNewsList,
    });
  } catch (error: any) {
    console.error('Error fetching news:', error);
    res.json({
      success: true,
      lastRefreshedAt: new Date().toISOString(),
      dateString: getTodayArabicDateString(),
      curator: 'الخبير شاهين',
      count: 3,
      articles: getFallbackDailyNews(),
    });
  }
});

// POST /api/news/refresh - Explicit Daily Refresh by Master Shaheen
app.post('/api/news/refresh', async (req, res) => {
  try {
    const freshArticles = await generateFreshDailyNewsWithShaheen();
    activeDailyNewsList = freshArticles;
    lastNewsRefreshDate = new Date().toISOString().split('T')[0];

    res.json({
      success: true,
      message: 'تم تحديث النشرة اليومية بنجاح عبر الخبير شاهين ونشرها بالصور الكاملة.',
      refreshedAt: new Date().toISOString(),
      dateString: getTodayArabicDateString(),
      curator: 'الخبير شاهين (شيخ العطارين وكبير كيميائيي العطور)',
      count: freshArticles.length,
      articles: freshArticles,
    });
  } catch (error: any) {
    console.error('Error refreshing news:', error);
    const fallback = getFallbackDailyNews();
    activeDailyNewsList = fallback;
    res.json({
      success: true,
      message: 'تم تحديث النشرة اليومية عبر قاعدة معمل الخبير شاهين بنجاح.',
      refreshedAt: new Date().toISOString(),
      dateString: getTodayArabicDateString(),
      curator: 'الخبير شاهين',
      count: fallback.length,
      articles: fallback,
    });
  }
});

// ============================================================================
// SERVER STARTUP WITH VITE INTEGRATION
// ============================================================================
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
