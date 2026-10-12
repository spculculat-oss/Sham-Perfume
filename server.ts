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
const ai = new GoogleGenAI({ apiKey });

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

// API Chat Endpoint
app.post('/api/chat', async (req, res) => {
  try {
    const { message, conversationHistory } = req.body;

    if (!message || typeof message !== 'string') {
      res.status(400).json({ error: 'Message is required' });
      return;
    }

    // Try Google Gemini models in cascade
    let reply = '';
    const candidateModels = ['gemini-3.8-flash', 'gemini-flash-latest'];

    for (const modelName of candidateModels) {
      try {
        const contents: any[] = [];
        if (Array.isArray(conversationHistory)) {
          for (const turn of conversationHistory.slice(-6)) {
            if (turn.role === 'user' || turn.role === 'assistant') {
              contents.push({
                role: turn.role === 'assistant' ? 'model' : 'user',
                parts: [{ text: turn.text }],
              });
            }
          }
        }
        contents.push({
          role: 'user',
          parts: [{ text: message }],
        });

        const response = await ai.models.generateContent({
          model: modelName,
          contents: contents,
          config: {
            systemInstruction: PERFUMER_SYSTEM_INSTRUCTION,
            temperature: 0.7,
            topP: 0.95,
          },
        });

        if (response.text && response.text.trim().length > 0) {
          reply = response.text;
          break;
        }
      } catch (geminiError: any) {
        console.warn(`Model ${modelName} call failed:`, geminiError?.message?.slice(0, 100));
        // Continue to fallback knowledge engine
      }
    }

    // If Gemini models were rate-limited or unavailable, use the Master Formulation Engine
    if (!reply) {
      reply = getMasterKnowledgeResponse(message);
    }

    res.json({ reply });
  } catch (error: any) {
    console.error('Server chat error:', error);
    const reply = getMasterKnowledgeResponse(req.body?.message || '');
    res.json({ reply });
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
