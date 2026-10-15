import type { SupportedLanguage } from '../types/i18n';
import { loc, type LText } from '../utils/localize';
import type { ShaheenEngine } from '../hooks/useShaheenModels';
import type { ShaheenModelChoice } from '../utils/chatStore';

/**
 * Visitors only ever see «الخبير شاهين» and these response modes — never engine, vendor or model
 * names (the server does not even send them). Which engines serve each mode is an admin matter.
 */
export const SHAHEEN_MODE_IDS = ['auto', 'fast', 'deep', 'council'] as const;
export type ShaheenMode = typeof SHAHEEN_MODE_IDS[number];

const MODE_TEXT: Record<ShaheenMode, { short: LText; name: LText; desc: LText }> = {
  auto: {
    short: { ar: '⚡ تلقائي', en: '⚡ Auto', fr: '⚡ Auto', es: '⚡ Automático', it: '⚡ Automatico', de: '⚡ Automatisch', ru: '⚡ Авто', zh: '⚡ 自动', tr: '⚡ Otomatik', fa: '⚡ خودکار' },
    name: { ar: 'شاهين — اختيار تلقائي', en: 'Shahin — automatic', fr: 'Shahin — automatique', es: 'Shahin — automático', it: 'Shahin — automatico', de: 'Shahin — automatisch', ru: 'Шахин — автоматически', zh: 'Shahin — 自动', tr: 'Shahin — otomatik', fa: 'شاهین — خودکار' },
    desc: { ar: 'يختار شاهين أنسب طريقة للرد على سؤالك تلقائياً.', en: 'Shahin picks the best way to answer automatically.', fr: 'Shahin choisit automatiquement la meilleure façon de répondre.', es: 'Shahin elige automáticamente la mejor forma de responder.', it: 'Shahin sceglie automaticamente il modo migliore di rispondere.', de: 'Shahin wählt automatisch die beste Antwortweise.', ru: 'Шахин сам выбирает лучший способ ответа.', zh: 'Shahin 自动选择最合适的回答方式。', tr: 'Shahin en uygun yanıt biçimini otomatik seçer.', fa: 'شاهین به‌طور خودکار بهترین شیوه پاسخ را انتخاب می‌کند.' },
  },
  fast: {
    short: { ar: '🚀 رد سريع', en: '🚀 Quick reply', fr: '🚀 Réponse rapide', es: '🚀 Respuesta rápida', it: '🚀 Risposta rapida', de: '🚀 Schnelle Antwort', ru: '🚀 Быстрый ответ', zh: '🚀 快速回答', tr: '🚀 Hızlı yanıt', fa: '🚀 پاسخ سریع' },
    name: { ar: 'رد سريع', en: 'Quick reply', fr: 'Réponse rapide', es: 'Respuesta rápida', it: 'Risposta rapida', de: 'Schnelle Antwort', ru: 'Быстрый ответ', zh: '快速回答', tr: 'Hızlı yanıt', fa: 'پاسخ سریع' },
    desc: { ar: 'إجابة مباشرة ومختصرة بالنقاط الأهم.', en: 'A direct, short answer with the key points.', fr: 'Une réponse directe et courte avec l’essentiel.', es: 'Una respuesta directa y breve con lo esencial.', it: 'Una risposta diretta e breve con i punti chiave.', de: 'Eine direkte, kurze Antwort mit dem Wichtigsten.', ru: 'Прямой и короткий ответ с главным.', zh: '直接简短，只讲要点。', tr: 'Önemli noktalarla kısa ve doğrudan yanıt.', fa: 'پاسخی مستقیم و کوتاه با نکات اصلی.' },
  },
  deep: {
    short: { ar: '🔬 تحليل معمّق', en: '🔬 In-depth', fr: '🔬 Analyse approfondie', es: '🔬 Análisis a fondo', it: '🔬 Analisi approfondita', de: '🔬 Tiefenanalyse', ru: '🔬 Глубокий анализ', zh: '🔬 深度分析', tr: '🔬 Derin analiz', fa: '🔬 تحلیل عمیق' },
    name: { ar: 'تحليل معمّق', en: 'In-depth analysis', fr: 'Analyse approfondie', es: 'Análisis a fondo', it: 'Analisi approfondita', de: 'Tiefenanalyse', ru: 'Глубокий анализ', zh: '深度分析', tr: 'Derin analiz', fa: 'تحلیل عمیق' },
    desc: { ar: 'شرح مفصّل: المنطق والبدائل والمخاطر والحسابات خطوة بخطوة.', en: 'A detailed answer: reasoning, alternatives, risks and step-by-step numbers.', fr: 'Une réponse détaillée : raisonnement, alternatives, risques et calculs pas à pas.', es: 'Respuesta detallada: razonamiento, alternativas, riesgos y cálculos paso a paso.', it: 'Risposta dettagliata: ragionamento, alternative, rischi e calcoli passo passo.', de: 'Ausführlich: Begründung, Alternativen, Risiken und Rechnungen Schritt für Schritt.', ru: 'Подробно: логика, альтернативы, риски и расчёты по шагам.', zh: '详细解答：思路、替代方案、风险与逐步计算。', tr: 'Ayrıntılı yanıt: gerekçe, alternatifler, riskler ve adım adım hesaplar.', fa: 'پاسخ مفصل: منطق، گزینه‌ها، ریسک‌ها و محاسبات گام‌به‌گام.' },
  },
  council: {
    short: { ar: '👥 مجلس الخبراء', en: '👥 Expert council', fr: '👥 Conseil d’experts', es: '👥 Consejo de expertos', it: '👥 Consiglio di esperti', de: '👥 Expertenrat', ru: '👥 Совет экспертов', zh: '👥 专家委员会', tr: '👥 Uzmanlar kurulu', fa: '👥 شورای خبرگان' },
    name: { ar: 'مجلس الخبراء', en: 'Expert council', fr: 'Conseil d’experts', es: 'Consejo de expertos', it: 'Consiglio di esperti', de: 'Expertenrat', ru: 'Совет экспертов', zh: '专家委员会', tr: 'Uzmanlar kurulu', fa: 'شورای خبرگان' },
    desc: { ar: 'عدة مستشارين يناقشون سؤالك ثم يلخّص شاهين رأياً واحداً. يستغرق وقتاً أطول.', en: 'Several advisors discuss your question, then Shahin sums up one answer. Takes longer.', fr: 'Plusieurs conseillers débattent, puis Shahin résume une réponse. Plus long.', es: 'Varios asesores debaten y Shahin resume una respuesta. Tarda más.', it: 'Più consulenti discutono, poi Shahin riassume una risposta. Richiede più tempo.', de: 'Mehrere Berater diskutieren, dann fasst Shahin eine Antwort zusammen. Dauert länger.', ru: 'Несколько советников обсуждают вопрос, затем Шахин подводит итог. Дольше.', zh: '多位顾问讨论您的问题，再由 Shahin 汇总一个答案。耗时更长。', tr: 'Birkaç danışman tartışır, ardından Shahin tek yanıtta özetler. Daha uzun sürer.', fa: 'چند مشاور درباره سؤال شما بحث می‌کنند و شاهین یک پاسخ جمع‌بندی می‌کند. زمان بیشتری می‌برد.' },
  },
};

const isMode = (id: unknown): id is ShaheenMode => (SHAHEEN_MODE_IDS as readonly unknown[]).includes(id);

/** Toolbar chip colours (dark toolbar). */
export const ENGINE_CHIP: Record<string, string> = {
  auto: 'border-amber-400 bg-amber-500/20 text-amber-300',
  fast: 'border-emerald-400 bg-emerald-500/20 text-emerald-300',
  deep: 'border-sky-400 bg-sky-500/20 text-sky-300',
  council: 'border-purple-400 bg-purple-500/20 text-purple-300',
};

/** Message badge colours (light bubble). */
export const ENGINE_BADGE: Record<string, string> = {
  fast: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  deep: 'bg-sky-50 text-sky-800 border-sky-200',
  council: 'bg-purple-50 text-purple-800 border-purple-200',
};

export interface EngineChip { id: ShaheenModelChoice; short: string; name: string; desc: string; color: string }

/** Modes to show in a toolbar: "auto" always, the others only when the server says they can answer. */
export function visibleEngines(engines: ShaheenEngine[], language: SupportedLanguage): EngineChip[] {
  const list = engines.length ? engines : [{ id: 'auto', hasApiKey: false } as ShaheenEngine];
  return list
    .filter((e) => isMode(e.id) && (e.id === 'auto' || e.hasApiKey))
    .map((e) => {
      const text = MODE_TEXT[e.id as ShaheenMode];
      return { id: e.id, short: loc(language, text.short), name: loc(language, text.name), desc: loc(language, text.desc), color: ENGINE_CHIP[e.id] || ENGINE_CHIP.auto };
    });
}

/**
 * Label of the mode that produced a reply. Anything else (e.g. messages saved by older versions
 * with an engine id) is shown simply as Shahin — never as a vendor.
 */
export function modeBadge(id: string | undefined, language: SupportedLanguage): { label: string; mode?: ShaheenMode } {
  const shahin = loc(language, { ar: 'شاهين', en: 'Shahin', fr: 'Shahin', es: 'Shahin', it: 'Shahin', de: 'Shahin', ru: 'Шахин', zh: 'Shahin', tr: 'Shahin', fa: 'شاهین' });
  if (!isMode(id) || id === 'auto') return { label: shahin };
  return { label: `${shahin} · ${loc(language, MODE_TEXT[id].name)}`, mode: id };
}

/** Message time; the welcome message is stored with a fixed Arabic «الآن», shown in the visitor's language. */
export function messageTime(timestamp: string, language: SupportedLanguage): string {
  if (timestamp !== 'الآن') return timestamp;
  return loc(language, { ar: 'الآن', en: 'Now', fr: 'Maintenant', es: 'Ahora', it: 'Ora', de: 'Jetzt', ru: 'Сейчас', zh: '刚刚', tr: 'Şimdi', fa: 'اکنون' });
}

/**
 * Scroll only the chat's own scroll box to its end. `scrollIntoView` also scrolls
 * the page/window, which made the lab page jump down on open and on every reply.
 */
export function scrollChatToEnd(marker: HTMLElement | null, smooth = true): void {
  let box = marker?.parentElement ?? null;
  while (box && box !== document.body) {
    const overflow = getComputedStyle(box).overflowY;
    if ((overflow === 'auto' || overflow === 'scroll') && box.scrollHeight > box.clientHeight) {
      box.scrollTo({ top: box.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
      return;
    }
    box = box.parentElement;
  }
}
