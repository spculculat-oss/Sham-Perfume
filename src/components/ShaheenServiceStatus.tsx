import type { SupportedLanguage } from '../types/i18n';
import { ApiError, isStaticHosting } from '../utils/api';
import { loc, type LText } from '../utils/localize';
import type { ShaheenEngine } from '../hooks/useShaheenModels';

const NO_KEY: LText = {
  ar: 'شاهين غير متصل الآن: لا يوجد محرك ذكاء اصطناعي مُفعّل على الخادم. على إدارة الموقع إضافة مفتاح خدمة صالح. لا تكتب أي مفتاح في المحادثة.',
  en: 'Shahin is offline: no AI engine is configured on the server. The site administration needs to add a valid key. Never paste keys into chat.',
};
const ENGINE_NO_KEY: LText = {
  ar: 'المحرك المختار غير مُفعّل الآن. اختر «تلقائي» ليستخدم شاهين أي محرك متاح.',
  en: 'The selected engine is not available right now. Choose “Auto” so Shahin uses any available engine.',
};
const DISABLED: LText = {
  ar: 'الخبير شاهين متوقف مؤقتاً من إدارة الموقع. جرّب لاحقاً، أو استخدم «مساعد شام» للطلبات والدعم.',
  en: 'Master Shahin is temporarily turned off by the site administration. Try later, or use the Sham assistant for orders and support.',
};
const TIMEOUT: LText = {
  ar: 'انتهت مهلة الرد قبل أن يكمل شاهين إجابته. أعد المحاولة، وإذا تكرر جرّب سؤالاً أقصر.',
  en: 'Shahin’s answer timed out. Try again, and if it repeats, ask a shorter question.',
};
const UNAVAILABLE: LText = {
  ar: 'محرك الذكاء الاصطناعي لم يُرجع رداً صالحاً الآن (قد تكون الخدمة مشغولة أو المفتاح يحتاج مراجعة). أعد المحاولة بعد قليل أو اختر «تلقائي».',
  en: 'The AI engine did not return a valid answer (the service may be busy or its key needs checking). Retry shortly or choose “Auto”.',
};
const RATE: LText = {
  ar: 'أرسلت رسائل كثيرة خلال دقيقة. انتظر قليلاً ثم أعد المحاولة.',
  en: 'Too many messages in a minute. Wait a moment, then retry.',
};
const NETWORK: LText = {
  ar: 'تعذّر الوصول إلى خادم شاهين. تأكد من اتصالك بالإنترنت ثم أعد المحاولة.',
  en: 'Could not reach Shahin’s server. Check your internet connection and retry.',
};
const INVALID: LText = {
  ar: 'تعذّر إرسال الرسالة بهذا الشكل. اختصر الرسالة أو امسح المحادثة ثم أعد المحاولة.',
  en: 'The message could not be sent as is. Shorten it or clear the chat, then retry.',
};
const GENERIC: LText = {
  ar: 'حدث خطأ غير متوقع في خدمة شاهين، ولم يُنشأ رد. أعد المحاولة بعد قليل.',
  en: 'Shahin’s service hit an unexpected error and no answer was created. Please retry shortly.',
};

/** A precise, actionable message per failure (never a generic “server or news” text). */
export function chatErrorText(language: SupportedLanguage, error: unknown) {
  if (error instanceof ApiError) {
    if (error.code === 'SHAHEEN_DISABLED') return loc(language, DISABLED);
    if (error.code === 'PROVIDER_NOT_CONFIGURED') return loc(language, NO_KEY);
    if (error.code === 'PROVIDER_UNAVAILABLE') return loc(language, UNAVAILABLE);
    if (error.status === 429) return loc(language, RATE);
    if (error.status === 504 || error.code === 'PROVIDER_TIMEOUT') return loc(language, TIMEOUT);
    if (error.status === 400) return loc(language, INVALID);
    return loc(language, GENERIC);
  }
  if (error instanceof DOMException && error.name === 'TimeoutError') return loc(language, TIMEOUT);
  if (error instanceof TypeError) return loc(language, NETWORK); // fetch() network / CORS failure
  return loc(language, GENERIC);
}

/** Banner above the chat. Hidden when everything is fine (or on a static build with its own notice). */
export function ShaheenServiceStatus({ language, models, failed, enabled = true, selected = 'auto' }: {
  language: SupportedLanguage; models: { id: string; hasApiKey: boolean }[] | null; failed: boolean;
  enabled?: boolean; selected?: string;
}) {
  if (isStaticHosting || !models && !failed) return null;
  let text: string | null = null;
  if (failed) text = loc(language, NETWORK);
  else if (!enabled) text = loc(language, DISABLED);
  else if (!models?.some((m) => m.hasApiKey)) text = loc(language, NO_KEY);
  else if (selected !== 'auto' && !models.find((m) => m.id === selected)?.hasApiKey) text = loc(language, ENGINE_NO_KEY);
  if (!text) return null;
  return <p role="status" className="shrink-0 border-b border-amber-300 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-950">{text}</p>;
}

const ENGINE_NAMES: Record<string, string> = {
  gemini: 'Google Gemini', deepseek: 'DeepSeek', openai: 'OpenAI', claude: 'Anthropic Claude',
  self_hosted: 'Sham Open Model', openrouter: 'OpenRouter',
};
export const engineName = (id: string, fallback?: string) => ENGINE_NAMES[id] || fallback || id;

/** The engines the server actually allows, with their real state (no hard-coded list, no fake “connected”). */
export function ShaheenProviderMatrix({ language, models }: { language: SupportedLanguage; models: ShaheenEngine[] | null }) {
  const list = (models || []).filter((m) => m.id !== 'auto');
  if (!models) {
    return <p className="text-xs text-stone-400">{loc(language, { ar: 'جارٍ التحقق من المحركات…', en: 'Checking engines…' })}</p>;
  }
  return <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
    {list.map((m) => {
      const configured = !isStaticHosting && m.hasApiKey;
      return <div key={m.id} className="rounded-xl border border-stone-700 bg-stone-950 p-2">
        <div className="flex items-center gap-1.5 font-bold text-stone-200">
          <span className={`h-2 w-2 rounded-full ${configured ? 'bg-emerald-400' : 'bg-stone-600'}`} />
          {engineName(m.id, m.name)}
          {m.model && <span className="font-mono text-[10px] font-normal text-stone-500" dir="ltr">{m.model}</span>}
        </div>
        <div className={configured ? 'text-emerald-300' : 'text-stone-400'}>{loc(language, configured
          ? { ar: 'مُفعّل على الخادم — التوفر الفعلي يُختبر عند الإرسال', en: 'Enabled on the server — real availability is checked when sending' }
          : { ar: 'غير مُفعّل (لا يوجد مفتاح على الخادم)', en: 'Not enabled (no key on the server)' })}</div>
      </div>;
    })}
    {!list.length && <p className="text-stone-400">{loc(language, { ar: 'لا توجد محركات مسموح بها في الإعدادات.', en: 'No engines are allowed in the settings.' })}</p>}
  </div>;
}

export function shaheenWelcome(language: SupportedLanguage) {
  return loc(language, {
    ar: 'مرحباً! أنا شاهين، مساعد ذكاء اصطناعي لتصميم العطور والحسابات. اذكر الحجم والتركيز والمكونات المتاحة وسأساعدك خطوة بخطوة. المقترحات تجريبية وليست شهادة سلامة أو نصيحة طبية. تُحفظ المحادثة في هذا المتصفح لمدة 30 يوماً.',
    en: 'Hello! I’m Shahin, an AI assistant for perfume design and calculations. Tell me your volume, concentration and available ingredients. Suggestions are experimental, not safety certification or medical advice. Chat is saved in this browser for 30 days.',
    fr: 'Bonjour ! Je suis Shahin, assistant IA pour la création de parfums et les calculs. Indiquez le volume, la concentration et les ingrédients. Les propositions sont expérimentales, sans certification de sécurité ni conseil médical. Le dialogue est conservé ici pendant 30 jours.',
    es: '¡Hola! Soy Shahin, asistente de IA para diseñar perfumes y hacer cálculos. Indica el volumen, concentración e ingredientes. Las propuestas son experimentales, no una certificación de seguridad ni consejo médico. El chat se guarda en este navegador 30 días.',
    it: 'Ciao! Sono Shahin, assistente IA per progettare profumi e fare calcoli. Indica volume, concentrazione e ingredienti. I suggerimenti sono sperimentali, non certificazioni di sicurezza o consigli medici. La chat resta nel browser per 30 giorni.',
    de: 'Hallo! Ich bin Shahin, ein KI-Assistent für Parfümdesign und Berechnungen. Nennen Sie Volumen, Konzentration und Zutaten. Vorschläge sind experimentell, keine Sicherheitszertifizierung oder medizinische Beratung. Der Chat bleibt 30 Tage in diesem Browser.',
    ru: 'Здравствуйте! Я Шахин, ИИ-помощник по созданию духов и расчётам. Укажите объём, концентрацию и ингредиенты. Предложения экспериментальные, не сертификат безопасности и не медицинский совет. Чат хранится в браузере 30 дней.',
    zh: '你好！我是 Shahin，香水设计与计算 AI 助手。请告诉我容量、浓度和可用原料。建议仅供实验，不代表安全认证或医疗建议。聊天记录在此浏览器保存 30 天。',
    tr: 'Merhaba! Ben parfüm tasarımı ve hesaplamalar için YZ asistanı Shahin. Hacmi, konsantrasyonu ve bileşenleri belirtin. Öneriler deneyseldir; güvenlik sertifikası veya tıbbi tavsiye değildir. Sohbet bu tarayıcıda 30 gün saklanır.',
    fa: 'سلام! من شاهین، دستیار هوش مصنوعی طراحی عطر و محاسبات هستم. حجم، غلظت و مواد موجود را بگویید. پیشنهادها آزمایشی هستند، نه گواهی ایمنی یا توصیه پزشکی. گفتگو ۳۰ روز در این مرورگر ذخیره می‌شود.',
  });
}
