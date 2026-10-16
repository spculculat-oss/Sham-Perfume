import type { SupportedLanguage } from '../types/i18n';
import { ApiError, isStaticHosting } from '../utils/api';
import { loc, type LText } from '../لغات/localize';
import type { ShaheenEngine } from '../hooks/useShaheenModels';
import { visibleEngines } from './shaheenEngines';

const NO_KEY: LText = {
  ar: 'الخبير شاهين غير متاح الآن. جرّب بعد قليل، أو استخدم «مساعد شام» للطلبات والدعم. لا تكتب أي بيانات سرية في المحادثة.',
  en: 'Master Shahin is not available right now. Try again shortly, or use the Sham assistant for orders and support. Never share secrets in chat.',
  fr: 'Maître Shahin est indisponible pour le moment. Réessayez bientôt ou utilisez l’assistant Sham.',
  es: 'El Maestro Shahin no está disponible ahora. Inténtalo en breve o usa el asistente de Sham.',
  it: 'Il Maestro Shahin non è disponibile ora. Riprova tra poco o usa l’assistente Sham.',
  de: 'Meister Shahin ist gerade nicht verfügbar. Versuchen Sie es gleich erneut oder nutzen Sie den Sham-Assistenten.',
  ru: 'Мастер Шахин сейчас недоступен. Попробуйте позже или воспользуйтесь помощником Sham.',
  zh: 'Shahin 大师暂时无法使用。请稍后再试，或使用 Sham 助手。',
  tr: 'Usta Shahin şu anda kullanılamıyor. Biraz sonra tekrar deneyin veya Sham asistanını kullanın.',
  fa: 'استاد شاهین اکنون در دسترس نیست. کمی بعد دوباره امتحان کنید یا از دستیار شام استفاده کنید.',
};
const ENGINE_NO_KEY: LText = {
  ar: 'هذا الوضع غير متاح الآن. اختر «تلقائي» ليجيبك شاهين بأي طريقة متاحة.',
  en: 'This mode is not available right now. Choose “Auto” and Shahin will answer any way it can.',
  fr: 'Ce mode n’est pas disponible. Choisissez « Auto ».', es: 'Este modo no está disponible ahora. Elige «Automático».',
  it: 'Questa modalità non è disponibile ora. Scegli «Automatico».', de: 'Dieser Modus ist gerade nicht verfügbar. Wählen Sie „Automatisch“.',
  ru: 'Этот режим сейчас недоступен. Выберите «Авто».', zh: '该模式暂不可用，请选择“自动”。',
  tr: 'Bu mod şu anda kullanılamıyor. “Otomatik”i seçin.', fa: 'این حالت اکنون در دسترس نیست. «خودکار» را انتخاب کنید.',
};
const COUNCIL_OFF: LText = {
  ar: 'مجلس الخبراء غير متاح الآن. جرّب «تحليل معمّق» للحصول على إجابة مفصّلة.',
  en: 'The expert council is not available right now. Try “In-depth” for a detailed answer.',
  fr: 'Le conseil d’experts est indisponible. Essayez « Analyse approfondie ».', es: 'El consejo de expertos no está disponible. Prueba «Análisis a fondo».',
  it: 'Il consiglio di esperti non è disponibile. Prova «Analisi approfondita».', de: 'Der Expertenrat ist nicht verfügbar. Versuchen Sie „Tiefenanalyse“.',
  ru: 'Совет экспертов недоступен. Попробуйте «Глубокий анализ».', zh: '专家委员会暂不可用，请尝试“深度分析”。',
  tr: 'Uzmanlar kurulu şu anda kullanılamıyor. “Derin analiz”i deneyin.', fa: 'شورای خبرگان در دسترس نیست. «تحلیل عمیق» را امتحان کنید.',
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
  ar: 'لم يتمكن شاهين من إكمال الرد الآن (الخدمة مشغولة). أعد المحاولة بعد قليل أو اختر «تلقائي».',
  en: 'Shahin could not finish the answer right now (the service is busy). Retry shortly or choose “Auto”.',
};
const BUSY_WAIT: LText = {
  ar: 'شاهين يرد الآن على عدد كبير من الزوار — سؤالك في الدور وسيصلك الرد تلقائياً خلال لحظات.',
  en: 'Shaheen is answering many visitors right now — your question is in line and the reply will arrive by itself shortly.',
  fr: 'Shaheen répond à de nombreux visiteurs en ce moment — votre question est en file et la réponse arrivera d’elle-même.',
  es: 'Shaheen está atendiendo a muchos visitantes — tu pregunta está en cola y la respuesta llegará sola en breve.',
  it: 'Shaheen sta rispondendo a molti visitatori — la tua domanda è in coda e la risposta arriverà da sola a breve.',
  de: 'Shaheen beantwortet gerade viele Besucher — Ihre Frage ist in der Warteschlange, die Antwort kommt gleich von selbst.',
  ru: 'Шахин сейчас отвечает многим посетителям — ваш вопрос в очереди, ответ придёт автоматически.',
  zh: 'Shaheen 正在同时回答许多访客——您的问题已在排队，回复将很快自动送达。',
  tr: 'Shaheen şu anda çok sayıda ziyaretçiye yanıt veriyor — sorunuz sırada, yanıt birazdan kendiliğinden gelecek.',
  fa: 'شاهین هم‌اکنون به بازدیدکنندگان زیادی پاسخ می‌دهد — پرسش شما در نوبت است و پاسخ به‌زودی خودکار می‌رسد.',
};
const BUSY_GAVE_UP: LText = {
  ar: 'الضغط على شاهين كبير جداً الآن بسبب عدد الزوار. أعد المحاولة بعد دقيقة.',
  en: 'Shaheen is very busy right now because of the number of visitors. Please retry in a minute.',
};
/** Shown inside the "preparing the answer" bubble while the store waits in line by itself. */
export const busyNoteText = (language: SupportedLanguage) => loc(language, BUSY_WAIT);

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
    if (error.code === 'COUNCIL_UNAVAILABLE') return loc(language, COUNCIL_OFF);
    if (error.code === 'SHAHEEN_BUSY') return loc(language, BUSY_GAVE_UP);
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

/** Shaheen's response modes and whether each can answer now (no engine or vendor names). */
export function ShaheenModesPanel({ language, models }: { language: SupportedLanguage; models: ShaheenEngine[] | null }) {
  if (!models) {
    return <p className="text-xs text-stone-400">{loc(language, { ar: 'جارٍ التحقق من الأوضاع المتاحة…', en: 'Checking available modes…' })}</p>;
  }
  const modes = visibleEngines(models.map((m) => ({ ...m, hasApiKey: true })), language);
  return <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
    {modes.map((m) => {
      const ready = !isStaticHosting && models.find((x) => x.id === m.id)?.hasApiKey === true;
      return <div key={m.id} className="rounded-xl border border-stone-700 bg-stone-950 p-2">
        <div className="flex items-center gap-1.5 font-bold text-stone-200">
          <span className={`h-2 w-2 rounded-full ${ready ? 'bg-emerald-400' : 'bg-stone-600'}`} />
          {m.short}
        </div>
        <div className="text-stone-400">{m.desc}</div>
        <div className={ready ? 'text-emerald-300' : 'text-stone-500'}>{loc(language, ready
          ? { ar: 'متاح الآن', en: 'Available now', fr: 'Disponible', es: 'Disponible', it: 'Disponibile', de: 'Verfügbar', ru: 'Доступно', zh: '可用', tr: 'Kullanılabilir', fa: 'در دسترس' }
          : { ar: 'غير متاح حالياً', en: 'Not available right now', fr: 'Indisponible', es: 'No disponible', it: 'Non disponibile', de: 'Nicht verfügbar', ru: 'Недоступно', zh: '暂不可用', tr: 'Şu an kullanılamıyor', fa: 'فعلاً در دسترس نیست' })}</div>
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
