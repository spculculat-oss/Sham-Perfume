/**
 * Keeps a signed-in member's account in step with what they do on the site (tiny on purpose: loaded with the
 * main page). Nothing happens for visitors without an account or when the community is off.
 */
import { cx, getSessionToken } from './api';
import type { SavedFormula } from '../types/perfume';

/** A recipe saved in the calculator also goes to «بوابتي» (private by default). */
export function syncRecipeToAccount(formula: SavedFormula) {
  if (!getSessionToken()) return;
  void cx('/community/me/recipes', { body: { title: formula.title, data: formula, notes: formula.notes || '', visibility: 'private' } }).catch(() => {});
}

const LEARNING: Record<string, { kind: 'guide' | 'tool' | 'material' | 'lesson'; ar: string; en: string }> = {
  guide: { kind: 'guide', ar: 'دليل صناعة العطور', en: 'Perfumery guide' },
  raw_materials: { kind: 'material', ar: 'موسوعة الخامات', en: 'Raw materials' },
  pyramid: { kind: 'tool', ar: 'الهرم العطري', en: 'Fragrance pyramid' },
  concentration: { kind: 'tool', ar: 'حاسبة التركيز', en: 'Concentration calculator' },
  alcohol: { kind: 'tool', ar: 'حاسبة الكحول', en: 'Alcohol calculator' },
  costing: { kind: 'tool', ar: 'حاسبة التكلفة', en: 'Costing calculator' },
  maceration_simulator: { kind: 'tool', ar: 'محاكي التعتيق', en: 'Maceration simulator' },
  world_perfumes: { kind: 'lesson', ar: 'عطور العالم', en: 'World perfumes' },
  master_ai: { kind: 'lesson', ar: 'الخبير شاهين', en: 'Shaheen the expert' },
};
const sent = new Map<string, number>();

/** Opening a learning section counts 30 %; staying two minutes counts it as studied (100 %). Returns a cleanup. */
export function trackLearning(tab: string, lang: string): () => void {
  const item = LEARNING[tab];
  if (!item || !getSessionToken()) return () => {};
  const title = lang === 'ar' ? item.ar : item.en;
  const send = (progress: number) => {
    if ((sent.get(tab) || 0) >= progress) return;
    sent.set(tab, progress);
    void cx('/community/me/learning', { body: { itemId: `section:${tab}`, kind: item.kind, title, progress } }).catch(() => {});
  };
  send(30);
  const timer = setTimeout(() => send(100), 120_000);
  return () => clearTimeout(timer);
}
