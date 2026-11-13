/**
 * «مترجم ردود شاهين» — every reply in the visitor's language.
 *
 * The site opens in the language of the country the visitor comes from, or the one he picked himself
 * (src/utils/geoDetector.ts, getInitialLanguage), and the chat sends it with every message. The platforms already
 * answer in it; what Shaheen answers by himself (the store, his memory, the agent, the library, his honest «I don't know
 * yet») is written in Arabic or English. Those replies are translated here into the visitor's language — all the site's
 * languages — by whichever platform can, checked (links, numbers, code blocks kept; the right script), and remembered.
 * When nothing can translate: English stays English (every language's fallback on this site), and an Arabic reply is
 * shown with a short line in the visitor's language saying the translation is not available right now.
 */
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from '../../src/types/i18n';

export type Script = 'ar' | 'en' | 'other';

/** Languages written in the Arabic script (Arabic itself is the only one that needs no translation). */
const ARABIC_SCRIPT = new Set(['ar', 'fa', 'ur', 'ps', 'sd', 'ug', 'ku', 'ckb']);
const EN_WORDS = /\b(?:the|and|is|are|of|to|you|your|with|for|this|that|it|in|on|or)\b/gi;

/** What a text is written in: Arabic, English, or another language (by its letters and common English words). */
export function scriptOf(text: string): Script {
  const plain = text.replace(/```[\s\S]*?```/g, ' ').replace(/\]\([^)]*\)|https?:\/\/\S+/g, ' ');
  const letters = (plain.match(/\p{L}/gu) || []).length;
  if (!letters) return 'other';
  const arabic = (plain.match(/[\u0600-\u06FF]/g) || []).length;
  if (arabic / letters > 0.4) return 'ar';
  const latin = (plain.match(/[A-Za-z]/g) || []).length;
  const words = plain.split(/\s+/).filter(Boolean).length || 1;
  const english = (plain.match(EN_WORDS) || []).length;
  if (latin / letters > 0.9 && (english >= 3 || english / words > 0.08)) return 'en';
  return 'other';
}

/** Does this reply need translating for a visitor whose site language is `target`? */
export function needsTranslation(reply: string, target: string, message = ''): boolean {
  if (!reply.trim() || !SUPPORTED_LANGUAGES.some((l) => l.code === target)) return false;
  const written = scriptOf(reply);
  if (written === 'other') return false; // already in another language (a platform answered in it)
  if (written === target) return false;
  // He wrote in the reply's language himself (an Arabic question on a French page): he reads it — but a Persian or
  // Urdu question is in the Arabic letters too, and those visitors still need their own language.
  const ownScript = written === 'ar' && ARABIC_SCRIPT.has(target);
  if (!ownScript && message.trim() && scriptOf(message) === written) return false;
  // An English question on an Arabic page is answered in English, like a person would.
  if (target === 'ar' && written === 'en') return false;
  return true;
}

const languageName = (code: string) => {
  const l = SUPPORTED_LANGUAGES.find((x) => x.code === code);
  return l ? `${l.name} (${l.nativeName}, ${code})` : code;
};

/** The translator's instruction (the reply goes as the user's turn). */
export function translationInstruction(target: string): string {
  return [
    `Translate the user's text into ${languageName(target)}. Output only the translation, nothing before or after it.`,
    'Keep the Markdown exactly: headings, bold, lists, line breaks, and every link — translate the link text, never the URL.',
    'Copy unchanged: URLs, numbers and prices, currency codes, product and brand names in Latin letters, and every block between ``` fences.',
    'Natural, friendly wording for a perfume shop visitor. Never add notes, explanations or the name of any AI company or model.',
  ].join('\n');
}

const urls = (text: string) => [...text.matchAll(/https?:\/\/[^\s)\]]+/g)].map((m) => m[0]).sort();
const fences = (text: string) => (text.match(/```/g) || []).length;
const digits = (text: string) => (text.replace(/```[\s\S]*?```/g, '').replace(/https?:\/\/\S+/g, '').match(/\d+/g) || []).length;
const VENDOR = /\b(?:gemini|gemma|openai|chatgpt|gpt-?\d|claude|anthropic|deepseek|perplexity|llama|qwen|mistral)\b/i;

/** A translation is used only when it kept everything that matters and is really in the target language. */
export function checkTranslation(source: string, translated: string, target: string): boolean {
  const t = translated.trim();
  if (!t || t === source.trim()) return false;
  const ratio = t.length / Math.max(1, source.trim().length);
  if (ratio < 0.3 || ratio > 3.5) return false;
  if (urls(t).join(' ') !== urls(source).join(' ')) return false;
  if (fences(t) !== fences(source)) return false;
  if (Math.abs(digits(t) - digits(source)) > Math.max(2, digits(source) * 0.25)) return false;
  if (VENDOR.test(t) && !VENDOR.test(source)) return false;
  const written = scriptOf(t);
  if (target !== 'ar' && !ARABIC_SCRIPT.has(target) && written === 'ar') return false;
  if (target !== 'en' && written === 'en') return false;
  if (target === 'en' && written !== 'en') return false;
  if (ARABIC_SCRIPT.has(target) && !/[\u0600-\u06FF]/.test(t)) return false;
  return true;
}

/** «The translation is not available right now — here is the answer in Arabic» in the visitor's language. */
const UNTRANSLATED: Partial<Record<string, string>> = {
  en: 'Translation is not available right now — here is the answer in Arabic:',
  fr: 'La traduction n’est pas disponible pour le moment — voici la réponse en arabe :',
  es: 'La traducción no está disponible ahora mismo; aquí tienes la respuesta en árabe:',
  it: 'La traduzione non è disponibile al momento: ecco la risposta in arabo:',
  de: 'Die Übersetzung ist gerade nicht verfügbar – hier ist die Antwort auf Arabisch:',
  ru: 'Перевод сейчас недоступен — вот ответ на арабском:',
  zh: '目前无法翻译——以下是阿拉伯语回答：',
  tr: 'Çeviri şu anda kullanılamıyor — yanıt Arapça olarak aşağıda:',
  fa: 'ترجمه در حال حاضر در دسترس نیست — پاسخ به زبان عربی:',
  hi: 'अनुवाद अभी उपलब्ध नहीं है — उत्तर अरबी में है:',
  pt: 'A tradução não está disponível agora — aqui está a resposta em árabe:',
  id: 'Terjemahan belum tersedia saat ini — berikut jawabannya dalam bahasa Arab:',
  ja: '現在翻訳を利用できません。アラビア語の回答です：',
  ko: '지금은 번역을 사용할 수 없습니다. 아랍어 답변입니다:',
  ur: 'ترجمہ اس وقت دستیاب نہیں — جواب عربی میں ہے:',
  ms: 'Terjemahan tidak tersedia sekarang — inilah jawapan dalam bahasa Arab:',
  nl: 'Vertaling is nu niet beschikbaar — hier is het antwoord in het Arabisch:',
  pl: 'Tłumaczenie jest teraz niedostępne — oto odpowiedź po arabsku:',
  uk: 'Переклад зараз недоступний — ось відповідь арабською:',
  bn: 'এখন অনুবাদ পাওয়া যাচ্ছে না — উত্তর আরবিতে:',
  he: 'התרגום אינו זמין כרגע — הנה התשובה בערבית:',
};

/** What the visitor gets when no translation could be made. */
export function untranslatedReply(reply: string, target: string): string {
  if (scriptOf(reply) !== 'ar') return reply; // English is every language's fallback on this site
  const line = UNTRANSLATED[target] || UNTRANSLATED.en!;
  return `_${line}_\n\n${reply}`;
}

export type TranslateFn = (text: string, target: SupportedLanguage, signal: AbortSignal) => Promise<string | undefined>;

/** Translations already made (the same store answer or saved answer is asked again and again). */
export class TranslationCache {
  private map = new Map<string, string>();
  constructor(private max = 400) {}
  private key(text: string, target: string) { return `${target}\u0000${text}`; }
  get(text: string, target: string) { return this.map.get(this.key(text, target)); }
  set(text: string, target: string, value: string) {
    const k = this.key(text, target);
    this.map.delete(k); this.map.set(k, value);
    while (this.map.size > this.max) this.map.delete(this.map.keys().next().value!);
  }
}

/**
 * The reply in the visitor's language: from the cache, or translated (checked), or — when nothing could translate —
 * the reply as it is with the «not available right now» line. `translated` tells whether a translation was used.
 */
export async function localizeReply(reply: string, target: SupportedLanguage, message: string, translate: TranslateFn, cache: TranslationCache, budgetMs: number): Promise<{ reply: string; translated: boolean; changed: boolean }> {
  if (!needsTranslation(reply, target, message)) return { reply, translated: false, changed: false };
  const cached = cache.get(reply, target);
  if (cached) return { reply: cached, translated: true, changed: true };
  if (budgetMs >= 3000) {
    const signal = AbortSignal.timeout(budgetMs);
    const out = await translate(reply, target, signal).catch(() => undefined);
    const clean = out?.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
    if (clean && checkTranslation(reply, clean, target)) {
      cache.set(reply, target, clean);
      return { reply: clean, translated: true, changed: true };
    }
  }
  const fallback = untranslatedReply(reply, target);
  return { reply: fallback, translated: false, changed: fallback !== reply };
}
