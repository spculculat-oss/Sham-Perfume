/**
 * «المترجم الذكي» — the AI translations made by Shaheen's language agent (scripts/shaheen-languages).
 *
 * The packs here only fill what the hand-made packs are missing: a language that has no own text for a
 * string used to fall back to English; now it reads the agent's translation first. One JSON file per
 * language (src/لغات/ai/<lang>.json), loaded on demand only when a visitor picks that language
 * (aiPackLoader.ts), so the site never gets heavier for anybody else.
 *
 *   ui    → t() keys (i18n.ts)
 *   store → storeText() keys (storeL10n.ts)
 *   text  → any inline {ar, en, …} string, keyed by its English source (loc() / uiLabel())
 *
 * Every entry passed the agent's checks (placeholders kept, the language's own script, no Arabic in a
 * non-Arabic language, never a copy of the English) and, when a second engine was available, a review.
 * Arabic and English are never touched.
 */
export interface AiPack {
  ui?: Record<string, string>;
  store?: Record<string, string>;
  text?: Record<string, string>;
}

const PACKS = new Map<string, AiPack>();
const NEVER = new Set(['ar', 'en']);

export function registerAiPack(lang: string, pack: AiPack): void {
  if (NEVER.has(lang) || !pack || typeof pack !== 'object') return;
  PACKS.set(lang, pack);
}
export const hasAiPack = (lang: string): boolean => PACKS.has(lang);
export function clearAiPacks(): void { PACKS.clear(); }

export const aiUi = (lang: string, key: string): string | undefined => PACKS.get(lang)?.ui?.[key] || undefined;
export const aiStore = (lang: string, key: string): string | undefined => PACKS.get(lang)?.store?.[key] || undefined;
export const aiText = (lang: string, english: string | undefined): string | undefined =>
  (english ? PACKS.get(lang)?.text?.[english] : undefined) || undefined;
