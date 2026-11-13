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

/* «استخدم التركيبة دي» — a recipe shared in «مجتمع شام» (a post, a profile) opens in the site's own calculator.
   The recipe comes from another member, so only known fields with sane numbers pass; App.tsx merges them onto
   the current calculator settings and opens the concentration calculator. */
export const LOAD_FORMULA_EVENT = 'sham-load-formula';
const CONCENTRATION_TYPES = ['extrait', 'edp', 'edt', 'edc', 'eau_fraiche', 'aftershave', 'mist', 'oil_pure', 'custom'];
const num = (v: unknown, min: number, max: number) => (typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max ? v : undefined);

export interface SharedFormula { title: string; notes: string; macerationDays?: number; formulation: Partial<SavedFormula['formulation']>; pyramidNotes: SavedFormula['pyramidNotes'] }

export function sharedFormula(title: string, data: unknown): SharedFormula | null {
  const d = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>;
  const f = (d.formulation && typeof d.formulation === 'object' ? d.formulation : {}) as Record<string, unknown>;
  const formulation: Partial<SavedFormula['formulation']> = {};
  const set = <K extends keyof SavedFormula['formulation']>(k: K, v: SavedFormula['formulation'][K] | undefined) => { if (v !== undefined) formulation[k] = v; };
  set('bottleVolumeMl', num(f.bottleVolumeMl, 1, 100000));
  set('batchCount', num(f.batchCount, 1, 100000));
  set('concentrationPercent', num(f.concentrationPercent, 0, 100));
  set('alcoholPercentage', num(f.alcoholPercentage, 0, 100));
  set('waterPercent', num(f.waterPercent, 0, 100));
  set('fixativePercent', num(f.fixativePercent, 0, 100));
  set('oilDensity', num(f.oilDensity, 0.1, 5));
  set('alcoholDensity', num(f.alcoholDensity, 0.1, 5));
  if (typeof f.concentrationType === 'string' && CONCENTRATION_TYPES.includes(f.concentrationType)) formulation.concentrationType = f.concentrationType as SavedFormula['formulation']['concentrationType'];
  if (f.unitMode === 'grams' || f.unitMode === 'ml') formulation.unitMode = f.unitMode;
  const notes = Array.isArray(d.pyramidNotes) ? d.pyramidNotes : [];
  const pyramidNotes = notes.slice(0, 60).flatMap((n, i) => {
    const o = (n && typeof n === 'object' ? n : {}) as Record<string, unknown>;
    const nameAr = typeof o.nameAr === 'string' ? o.nameAr.slice(0, 80) : '';
    const nameEn = typeof o.nameEn === 'string' ? o.nameEn.slice(0, 80) : '';
    const pct = num(o.percentageOfOil, 0, 100);
    if ((!nameAr && !nameEn) || pct === undefined) return [];
    const category = o.category === 'top' || o.category === 'heart' || o.category === 'base' ? o.category : 'heart';
    return [{ id: `shared-${i}`, nameAr: nameAr || nameEn, nameEn: nameEn || nameAr, category, percentageOfOil: pct } as SavedFormula['pyramidNotes'][number]];
  });
  if (!Object.keys(formulation).length && !pyramidNotes.length) return null;
  return { title: title.slice(0, 120), notes: typeof d.notes === 'string' ? d.notes.slice(0, 2000) : '', macerationDays: num(d.macerationDays, 0, 3650), formulation, pyramidNotes };
}

/** Opens a shared recipe in the calculator; false when the recipe has nothing the calculator can use. */
export function openFormulaInLab(title: string, data: unknown): boolean {
  const formula = sharedFormula(title, data);
  if (!formula) return false;
  window.dispatchEvent(new CustomEvent(LOAD_FORMULA_EVENT, { detail: formula }));
  return true;
}
