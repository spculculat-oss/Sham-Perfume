/** «شاهين يشرحلك الخبر»: the button's words in the site's ten main languages (others read English). */
import type { SupportedLanguage } from '../types/i18n';

const TEXT = {
  explain: { ar: 'شاهين يشرحلك الخبر', en: 'Shaheen explains this story', fr: 'Shaheen vous explique', es: 'Shaheen te lo explica', it: 'Shaheen te lo spiega', de: 'Shaheen erklärt die Meldung', ru: 'Шахин объяснит новость', zh: 'Shaheen 为你解读', tr: 'Shaheen haberi açıklasın', fa: 'شاهین خبر را توضیح می‌دهد' },
  explaining: { ar: 'شاهين بيقرا الخبر…', en: 'Shaheen is reading the story…', fr: 'Shaheen lit l’article…', es: 'Shaheen está leyendo…', it: 'Shaheen sta leggendo…', de: 'Shaheen liest die Meldung…', ru: 'Шахин читает новость…', zh: 'Shaheen 正在阅读…', tr: 'Shaheen haberi okuyor…', fa: 'شاهین در حال خواندن خبر…' },
  by: { ar: 'شرح شاهين', en: 'Shaheen’s explanation', fr: 'L’explication de Shaheen', es: 'Explicación de Shaheen', it: 'La spiegazione di Shaheen', de: 'Shaheens Erklärung', ru: 'Объяснение Шахина', zh: 'Shaheen 的解读', tr: 'Shaheen’in açıklaması', fa: 'توضیح شاهین' },
  busy: { ar: 'شاهين مشغول دلوقتي — جرّب كمان دقيقة، أو افتح الخبر من مصدره.', en: 'Shaheen is busy right now — try again in a minute, or open the story at its source.', fr: 'Shaheen est occupé — réessayez dans une minute ou ouvrez la source.', es: 'Shaheen está ocupado; inténtalo en un minuto o abre la fuente.', it: 'Shaheen è occupato; riprova tra un minuto o apri la fonte.', de: 'Shaheen ist gerade beschäftigt – versuch es gleich noch einmal oder öffne die Quelle.', ru: 'Шахин занят — попробуйте через минуту или откройте источник.', zh: 'Shaheen 正忙，请稍后再试，或打开原文。', tr: 'Shaheen şu an meşgul — bir dakika sonra dene ya da kaynağı aç.', fa: 'شاهین الان مشغول است — یک دقیقه دیگر امتحان کنید یا منبع را باز کنید.' },
} as const;
export type NewsExplainKey = keyof typeof TEXT;
export const NEWS_EXPLAIN_TEXT = TEXT;
export const explainText = (lang: SupportedLanguage, key: NewsExplainKey): string => (TEXT[key] as Record<string, string>)[lang] || TEXT[key].en;
