import type { SupportedLanguage } from '../types/i18n';
import { ApiError, isStaticHosting } from '../utils/api';
import { loc } from '../utils/localize';
import { API_ERROR_NOTICE } from './StaticHostingNotice';

const NO_KEY = {
  ar: 'شاهين غير متصل: لا يوجد مفتاح خدمة للمحرك المطلوب. أضف مفتاحاً صالحاً في إعدادات الخادم. لا تكتب المفتاح في المحادثة.',
  en: 'Shahin is not connected: the requested provider has no API key. Configure a valid key on the server. Never paste keys into chat.',
};
const TIMEOUT = {
  ar: 'انتهت مهلة الاتصال بشاهين. لم يصل رد من الخدمة. أعد إرسال سؤالك للمحاولة مجدداً.',
  en: 'Shahin’s request timed out without an answer. Send your question again to retry.',
};
export function chatErrorText(language: SupportedLanguage, error: unknown) {
  if (error instanceof ApiError && error.code === 'PROVIDER_NOT_CONFIGURED') return loc(language, NO_KEY);
  if ((error instanceof ApiError && error.status === 504) || (error instanceof DOMException && error.name === 'TimeoutError')) {
    return loc(language, TIMEOUT);
  }
  return loc(language, API_ERROR_NOTICE);
}
export function ShaheenServiceStatus({ language, models, failed }: {
  language: SupportedLanguage; models: { id: string; hasApiKey: boolean }[] | null; failed: boolean;
}) {
  if (isStaticHosting || (models?.some((model) => model.hasApiKey) && !failed)) return null;
  const text = failed ? loc(language, API_ERROR_NOTICE) : models ? loc(language, NO_KEY) : loc(language, {
    ar: 'جارٍ التحقق من إعداد خدمة شاهين…', en: 'Checking Shahin’s service configuration…',
  });
  return <p role="status" className="shrink-0 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs leading-relaxed text-amber-950">{text}</p>;
}

export function ShaheenProviderMatrix({ language, models }: {
  language: SupportedLanguage; models: { id: string; hasApiKey: boolean }[] | null;
}) {
  const labels = { gemini: 'Google Gemini', deepseek: 'DeepSeek', openai: 'OpenAI', claude: 'Anthropic Claude' };
  return <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
    {Object.entries(labels).map(([id, name]) => {
      const configured = !isStaticHosting && models?.find((model) => model.id === id)?.hasApiKey;
      return <div key={id} className="rounded-xl border border-stone-700 bg-stone-950 p-2">
        <div className="font-bold text-stone-200">{name}</div>
        <div className={configured ? 'text-emerald-300' : 'text-stone-400'}>{loc(language, configured
          ? { ar: 'المفتاح مهيأ — التوفر الفعلي يُختبر عند الإرسال', en: 'Key configured — actual availability is checked when sending' }
          : { ar: 'غير مهيأ أو لم يتم التحقق بعد', en: 'Not configured or not checked yet' })}</div>
      </div>;
    })}
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
