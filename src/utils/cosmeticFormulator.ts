/**
 * «مصمم تركيبات التجميل» — the cosmetics formulator: product + skin type + goals + batch size → a complete formula
 * (percentages that add up to exactly 100, grams for the batch, phases A/B/C, method and safety warnings).
 *
 * Pure and browser-safe: the Cosmetics page and Shaheen (server/shaheen.ts, src/utils/chatStore.ts) share it, with no
 * AI service involved. The rules it never breaks (checked again by checkCosmeticFormula and the tests):
 *   • every level stays within the ingredient's maximum (the face maximum for leave-on face products);
 *   • water in the formula ⇒ a broad-spectrum preservative, always;
 *   • essential oils ≤ 0.5 % on the face, ≤ 1 % on the body, none on lips or for sensitive skin;
 *   • a patch test, hygiene and «not a medicine» on every formula.
 */
import { COSMETIC_INGREDIENTS, cosmeticIngredient, type CosmeticPhase } from './cosmeticIngredients';
import {
  COSMETIC_CONCERN_TEXT, COSMETIC_INGREDIENT_TEXT, COSMETIC_PHASE_TEXT, COSMETIC_PRODUCT_TEXT, COSMETIC_ROLE_TEXT,
  COSMETIC_SKIN_TEXT, COSMETIC_STEPS, COSMETIC_WARNINGS, COSMETICS_UI,
} from '../لغات/cosmeticsL10n';
import { loc } from '../لغات/localize';
import { formatLocalizedNumber } from '../لغات/numerals';
import type { SupportedLanguage } from '../types/i18n';

export type CosmeticProduct = 'face_cream' | 'body_lotion' | 'gel_serum' | 'face_oil' | 'body_butter' | 'lip_balm' | 'hair_oil' | 'face_wash';
export type SkinType = 'normal' | 'dry' | 'oily' | 'combination' | 'sensitive';
export type Concern = 'hydration' | 'glow' | 'acne' | 'soothing' | 'aging';

export const COSMETIC_PRODUCTS: CosmeticProduct[] = ['face_cream', 'body_lotion', 'gel_serum', 'face_oil', 'body_butter', 'lip_balm', 'hair_oil', 'face_wash'];
export const SKIN_TYPES: SkinType[] = ['normal', 'dry', 'oily', 'combination', 'sensitive'];
export const CONCERNS: Concern[] = ['hydration', 'glow', 'acne', 'soothing', 'aging'];

export interface CosmeticBrief {
  product: CosmeticProduct;
  skin: SkinType;
  concerns: Concern[];
  /** Batch size in grams (10–2000). */
  batch: number;
  scent?: boolean;
  nutFree?: boolean;
  vegan?: boolean;
}

export interface FormulaLine { id: string; phase: CosmeticPhase; pct: number; grams: number; qs?: boolean; filler?: boolean }
export interface CosmeticFormula {
  brief: CosmeticBrief;
  lines: FormulaLine[];
  hasWater: boolean;
  method: keyof typeof COSMETIC_STEPS;
  ph?: [number, number];
  /** °C both phases are heated to; undefined = cold process. */
  heatC?: [number, number];
  shelfMonths: [number, number];
  warnings: (keyof typeof COSMETIC_WARNINGS)[];
}

/** Products that stay on the face (the face maximums apply). */
const FACE_LEAVE_ON = new Set<CosmeticProduct>(['face_cream', 'gel_serum', 'face_oil']);
const WATER_BASED = new Set<CosmeticProduct>(['face_cream', 'body_lotion', 'gel_serum', 'face_wash']);
const NUT_SWAP: Record<string, string> = { argan: 'jojoba', almond: 'grapeseed', shea: 'mango' };

type Recipe = { lines: [string, number][]; filler: string };
const add = (lines: [string, number][], id: string, pct: number) => {
  const at = lines.findIndex(([x]) => x === id);
  if (at >= 0) lines[at] = [id, lines[at]![1] + pct]; else lines.push([id, pct]);
};

function recipe(b: CosmeticBrief): Recipe {
  const c = new Set(b.concerns);
  const sensitive = b.skin === 'sensitive';
  const oilyish = b.skin === 'oily' || b.skin === 'combination';
  const lines: [string, number][] = [];
  const niacinamide = (high: number) => Math.min(sensitive ? 2 : high, 5);
  switch (b.product) {
    case 'face_cream': {
      const oils: Record<SkinType, [string, number][]> = {
        dry: [['shea', 4], ['argan', 4], ['squalane', 4], ['jojoba', 3]],
        normal: [['jojoba', 5], ['squalane', 4], ['shea', 2]],
        oily: [['squalane', 4], ['grapeseed', 3], ['jojoba', 2]],
        combination: [['squalane', 4], ['jojoba', 4], ['grapeseed', 2]],
        sensitive: [['squalane', 5], ['jojoba', 4], ['shea', 2]],
      };
      lines.push(['glycerin', oilyish ? 2 : 3], ['xanthan', 0.2], ['phytate', 0.1]);
      if (!sensitive && b.skin !== 'oily') lines.push(['rose_water', 10]);
      if (c.has('hydration') || b.skin === 'dry') lines.push(['hyaluronic', 0.2]);
      if (c.has('soothing') || c.has('acne') || sensitive) lines.push(['aloe', 5]);
      if (c.has('soothing') || sensitive) lines.push(['allantoin', 0.2]);
      lines.push(...oils[b.skin]);
      lines.push(['olive_emulsifier', b.skin === 'dry' ? 5 : oilyish ? 4 : 4.5], ['cetyl', b.skin === 'dry' ? 2 : oilyish ? 1 : 1.5]);
      lines.push(['vitamin_e', 0.5], ['panthenol', 2]);
      if (c.has('glow') || c.has('acne')) lines.push(['niacinamide', niacinamide(4)]);
      else if (c.has('aging')) lines.push(['niacinamide', niacinamide(3)]);
      if (c.has('acne')) lines.push(['zinc_pca', 0.5]);
      if (c.has('aging') && !oilyish) lines.push(['rosehip', 2]);
      if (c.has('soothing') || sensitive) lines.push(['bisabolol', 0.3]);
      if (b.scent && !sensitive) lines.push(['lavender', 0.2]);
      lines.push(['preservative', 1], ['citric', 0]);
      return { lines, filler: 'water' };
    }
    case 'body_lotion': {
      const oils: Record<SkinType, [string, number][]> = {
        dry: [['shea', 5], ['almond', 4], ['cct', 3]],
        normal: [['almond', 4], ['cct', 3], ['shea', 3]],
        oily: [['grapeseed', 4], ['cct', 3]],
        combination: [['almond', 4], ['cct', 3], ['shea', 2]],
        sensitive: [['cct', 4], ['jojoba', 3], ['shea', 3]],
      };
      lines.push(['glycerin', 4], ['xanthan', 0.2], ['phytate', 0.1]);
      if (c.has('soothing') || sensitive) lines.push(['aloe', 5], ['allantoin', 0.2]);
      lines.push(...oils[b.skin], ['olive_emulsifier', b.skin === 'oily' ? 4 : 4.5], ['cetyl', 1.5]);
      lines.push(['vitamin_e', 0.5], ['panthenol', 1]);
      if (b.skin === 'dry' || c.has('hydration')) lines.push(['urea', 3]);
      if (c.has('glow')) lines.push(['niacinamide', niacinamide(3)]);
      if (b.scent && !sensitive) lines.push(['lavender', 0.5]);
      lines.push(['preservative', 1], ['citric', 0]);
      return { lines, filler: 'water' };
    }
    case 'gel_serum': {
      lines.push(['aloe', 10], ['glycerin', 3], ['propanediol', 2], ['hyaluronic', 0.3], ['xanthan', 0.3], ['phytate', 0.1]);
      if (c.has('soothing') || sensitive) lines.push(['allantoin', 0.2]);
      lines.push(['panthenol', 2]);
      const n = c.has('glow') ? 5 : c.has('acne') || c.has('aging') ? 4 : 2;
      lines.push(['niacinamide', niacinamide(n)]);
      if (c.has('acne')) lines.push(['zinc_pca', 0.5]);
      lines.push(['preservative', 1], ['citric', 0]);
      return { lines, filler: 'water' };
    }
    case 'face_oil': {
      const blends: Record<SkinType, Recipe> = {
        dry: { lines: [['jojoba', 30], ['squalane', 25], ['rosehip', 9.5]], filler: 'argan' },
        normal: { lines: [['squalane', 30], ['argan', 29.5]], filler: 'jojoba' },
        oily: { lines: [['jojoba', 30], ['grapeseed', 24.5]], filler: 'squalane' },
        combination: { lines: [['jojoba', 30], ['grapeseed', 24.5]], filler: 'squalane' },
        sensitive: { lines: [['jojoba', 49.5]], filler: 'squalane' },
      };
      const r = blends[b.skin];
      lines.push(...r.lines);
      if (c.has('aging') && !sensitive && !lines.some(([x]) => x === 'rosehip')) lines.push(['rosehip', 10]);
      if (c.has('soothing') || sensitive) lines.push(['bisabolol', 0.3]);
      lines.push(['vitamin_e', 0.5]);
      if (b.scent && !sensitive) lines.push(['lavender', 0.3]);
      return { lines, filler: r.filler };
    }
    case 'body_butter': {
      if (b.nutFree) lines.push(['mango', 40], ['cocoa', 20], ['grapeseed', 20]);
      else lines.push(['shea', 50], ['mango', 15], ['almond', 20]);
      lines.push(['vitamin_e', 0.5]);
      if (b.scent && !sensitive) lines.push(['lavender', 0.5]);
      return { lines, filler: 'jojoba' };
    }
    case 'lip_balm': {
      if (b.vegan) lines.push(['candelilla', 12]); else lines.push(['beeswax', 25]);
      lines.push([b.nutFree ? 'mango' : 'shea', 20], ['cocoa', 15], ['castor', 20], ['vitamin_e', 0.5]);
      return { lines, filler: 'jojoba' };
    }
    case 'hair_oil': {
      const blends: Record<SkinType, Recipe> = {
        dry: { lines: [['argan', 30], ['jojoba', 25], ['castor', 10], ['black_seed', 3]], filler: 'cct' },
        normal: { lines: [['jojoba', 35], ['argan', 25], ['black_seed', 3]], filler: 'cct' },
        combination: { lines: [['jojoba', 35], ['argan', 25], ['black_seed', 3]], filler: 'cct' },
        oily: { lines: [['grapeseed', 40], ['jojoba', 35]], filler: 'cct' },
        sensitive: { lines: [['jojoba', 40], ['argan', 25]], filler: 'cct' },
      };
      const r = blends[b.skin];
      lines.push(...r.lines, ['vitamin_e', 0.5]);
      if (b.scent && !sensitive) lines.push(['lavender', 0.5]);
      return { lines, filler: r.filler };
    }
    case 'face_wash': {
      lines.push(['glycerin', 3], ['aloe', 10], ['xanthan', 0.6], ['phytate', 0.1], ['decyl_glucoside', 20], ['betaine', 10]);
      lines.push(['panthenol', 1]);
      if (c.has('acne') || b.skin === 'oily') lines.push(['zinc_pca', 0.5]);
      if (c.has('soothing') || sensitive) lines.push(['allantoin', 0.2]);
      lines.push(['preservative', 1], ['citric', 0]);
      return { lines, filler: 'water' };
    }
  }
}

const round = (n: number, d = 2) => Math.round(n * 10 ** d) / 10 ** d;
const METHOD: Record<CosmeticProduct, CosmeticFormula['method']> = {
  face_cream: 'emulsion', body_lotion: 'emulsion', gel_serum: 'gel', face_oil: 'anhydrous_oil', body_butter: 'butter',
  lip_balm: 'balm', hair_oil: 'anhydrous_oil', face_wash: 'wash',
};

/** Clamp and complete a brief so any input (a form, a chat message) gives a valid one. */
export function normaliseBrief(input: Partial<CosmeticBrief> & { product: CosmeticProduct }): CosmeticBrief {
  const batch = Number.isFinite(input.batch) ? Math.min(2000, Math.max(10, Math.round(Number(input.batch)))) : 100;
  const concerns = [...new Set((input.concerns || []).filter((x): x is Concern => CONCERNS.includes(x as Concern)))].slice(0, 3);
  return {
    product: input.product, skin: SKIN_TYPES.includes(input.skin as SkinType) ? input.skin as SkinType : 'normal', concerns, batch,
    scent: Boolean(input.scent), nutFree: Boolean(input.nutFree), vegan: Boolean(input.vegan),
  };
}

export function formulateCosmetic(input: Partial<CosmeticBrief> & { product: CosmeticProduct }): CosmeticFormula {
  const brief = normaliseBrief(input);
  const r = recipe(brief);
  let pairs = r.lines;
  let filler = r.filler;
  if (brief.nutFree) {
    pairs = pairs.map(([id, pct]) => [NUT_SWAP[id] || id, pct] as [string, number]);
    filler = NUT_SWAP[filler] || filler;
  }
  // The filler (water, or the main oil of a water-free product) takes whatever the other lines leave to 100 %.
  const merged: [string, number][] = [];
  for (const [id, pct] of pairs) if (id !== filler) add(merged, id, pct);
  const fillerPct = round(100 - merged.reduce((s, [, p]) => s + p, 0));
  const lines: FormulaLine[] = [];
  const phaseOf = (id: string): CosmeticPhase => {
    const ing = cosmeticIngredient(id);
    return ing.heatSensitive ? 'C' : ing.phase;
  };
  lines.push({ id: filler, phase: phaseOf(filler), pct: fillerPct, grams: round((fillerPct * brief.batch) / 100), filler: true });
  for (const [id, pct] of merged) {
    lines.push({ id, phase: phaseOf(id), pct: round(pct), grams: round((pct * brief.batch) / 100), ...(id === 'citric' ? { qs: true } : {}) });
  }
  const order: CosmeticPhase[] = ['A', 'B', 'C'];
  lines.sort((a, b) => order.indexOf(a.phase) - order.indexOf(b.phase));
  const hasWater = WATER_BASED.has(brief.product);
  const anyNut = lines.some((l) => cosmeticIngredient(l.id).nut);
  const anyEo = lines.some((l) => cosmeticIngredient(l.id).role === 'essential_oil');
  const warnings: CosmeticFormula['warnings'] = ['patch_test'];
  if (hasWater) warnings.push('preservative_required', 'vitamin_e_not_preservative', 'ph_check');
  warnings.push('hygiene');
  if (anyEo) warnings.push('essential_oils');
  if (brief.skin === 'sensitive' && brief.scent) warnings.push('sensitive_no_scent');
  if (anyNut) warnings.push('nut_allergy');
  if (brief.product === 'lip_balm') warnings.push('lips');
  if (FACE_LEAVE_ON.has(brief.product)) warnings.push('not_sunscreen');
  if (lines.some((l) => l.id === 'niacinamide' && l.pct >= 4)) warnings.push('niacinamide_start');
  if (brief.product !== 'body_butter' && brief.product !== 'lip_balm' && brief.product !== 'body_lotion') warnings.push('eyes');
  warnings.push(hasWater ? 'shelf_water' : 'shelf_anhydrous', 'not_medicine', 'selling');
  const heated = ['emulsion', 'butter', 'balm'].includes(METHOD[brief.product]);
  return {
    brief, lines, hasWater, method: METHOD[brief.product],
    ph: hasWater ? (brief.product === 'face_wash' || brief.product === 'face_cream' ? [5, 5.5] : [5, 6]) : undefined,
    heatC: heated ? (brief.product === 'lip_balm' ? [65, 70] : [70, 75]) : undefined,
    shelfMonths: hasWater ? [2, 3] : [6, 12],
    warnings,
  };
}

/** Every rule checked again on the finished formula: [] means safe to show. */
export function checkCosmeticFormula(f: CosmeticFormula): string[] {
  const problems: string[] = [];
  const total = round(f.lines.reduce((s, l) => s + l.pct, 0));
  if (Math.abs(total - 100) > 0.011) problems.push(`total ${total}`);
  const face = FACE_LEAVE_ON.has(f.brief.product);
  for (const l of f.lines) {
    const ing = cosmeticIngredient(l.id);
    const max = face && ing.faceMax !== undefined ? ing.faceMax : ing.max;
    if (l.pct < 0 || l.pct > max) problems.push(`${l.id} ${l.pct}% > ${max}%`);
    if (f.brief.skin === 'sensitive' && ing.sensitiser) problems.push(`${l.id} in a sensitive-skin formula`);
    if (f.brief.nutFree && ing.nut) problems.push(`${l.id} in a nut-free formula`);
    if (face && ing.comedogenic && (f.brief.skin === 'oily' || f.brief.concerns.includes('acne'))) problems.push(`${l.id} clogs pores`);
  }
  if (f.hasWater && !f.lines.some((l) => cosmeticIngredient(l.id).role === 'preservative' && l.pct >= 0.5)) problems.push('water without a preservative');
  const eo = f.lines.filter((l) => cosmeticIngredient(l.id).role === 'essential_oil').reduce((s, l) => s + l.pct, 0);
  const eoMax = f.brief.product === 'lip_balm' ? 0 : face || f.brief.product === 'face_wash' ? 0.5 : 1;
  if (eo > eoMax) problems.push(`essential oils ${eo}% > ${eoMax}%`);
  if (!f.warnings.includes('patch_test') || !f.warnings.includes('not_medicine')) problems.push('missing the patch test or the medicine warning');
  return problems;
}

// ── Reading a chat message ────────────────────────────────────────────────────────────────────────────────────────

const AR_DIGITS = (s: string) => s.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));
const MAKE = /صمم|صمّم|تصميم|تركيب[ةه]|ركّب|ركب\s?لي|ركبلي|وصف[ةه]|فورمولا|اعمل|اعملي|اعمللي|اعمل لي|أعمل|ازاي اعمل|إزاي أعمل|طريقة عمل|طريقه عمل|تحضير|حضّر|حضر لي|نسب[ةه]? |\bformula|\brecipe|\bmake\b|\bmaking\b|\bdiy\b|\bformulate|\bhow (?:do i|to|can i) make\b/i;
const PRODUCT_WORDS: [CosmeticProduct, RegExp][] = [
  ['lip_balm', /(?:مرطب|بلسم|زبد[ةه]|كريم)\s*(?:لل|ال)?(?:شفايف|شفاه|شفاة)|lip\s*balm/i],
  ['hair_oil', /زيت\s*(?:لل|ال)?(?:شعر|فرو[ةه])|hair\s*oil/i],
  ['body_butter', /زبد[ةه]\s*(?:لل|ال)?(?:جسم|بشر[ةه])|body\s*butter/i],
  ['face_oil', /زيت\s*(?:لل|ال)?(?:وش|وجه|بشر[ةه])|face\s*oil|facial\s*oil/i],
  ['face_wash', /غسول|منظف\s*(?:لل|ال)?(?:وش|وجه|بشر[ةه])|face\s*wash|cleanser/i],
  ['gel_serum', /سيروم|سيرم|serum/i],
  ['body_lotion', /لوشن|لوسيون|كريم\s*(?:لل|ال)?(?:جسم|ايد|إيد|يد|ايدين|رجل)|(?:body|hand)\s*(?:lotion|cream)|\blotion/i],
  ['face_cream', /كريم|مرطب|moisturi[sz]er|face\s*cream|\bcream\b/i],
];
const SKIN_WORDS: [SkinType, RegExp][] = [
  ['sensitive', /حساس[ةه]|sensitive/i], ['combination', /مختلط[ةه]|combination/i], ['oily', /دهني[ةه]|زيتي[ةه]|oily/i],
  ['dry', /جاف[ةه]|ناشف[ةه]|جفاف|\bdry\b/i], ['normal', /عادي[ةه]|normal/i],
];
const CONCERN_WORDS: [Concern, RegExp][] = [
  ['hydration', /ترطيب|جفاف|رطوب[ةه]|hydrat|moistur/i], ['glow', /نضار[ةه]|تفتيح|توحيد|بقع|اسمرار|glow|bright|even tone|dark spot/i],
  ['acne', /حبوب|حب الشباب|بثور|رؤوس سوداء|acne|blemish|breakout|pimple/i], ['soothing', /تهدئ[ةه]|احمرار|تهيج|هرش|sooth|redness|calm/i],
  ['aging', /تجاعيد|خطوط|شيخوخ[ةه]|عمر|wrinkle|fine line|aging|ageing|anti-age/i],
];

/** Whether a message asks for a cosmetic formula (also used by the perfume designer to step aside). */
export function looksCosmetic(text: string): boolean {
  const clean = AR_DIGITS(text).replace(/\s+/g, ' ');
  return MAKE.test(clean) && PRODUCT_WORDS.some(([, re]) => re.test(clean)) && !/عطر|برفان|perfume|fragrance|parfum|cologne|كولونيا/i.test(clean);
}

export function readCosmeticBrief(text: string): CosmeticBrief | undefined {
  const clean = AR_DIGITS(text).replace(/\s+/g, ' ').trim();
  if (clean.length < 6 || clean.length > 600 || !looksCosmetic(clean)) return undefined;
  const product = PRODUCT_WORDS.find(([, re]) => re.test(clean))![0];
  const skin = SKIN_WORDS.find(([, re]) => re.test(clean))?.[0];
  const concerns = CONCERN_WORDS.filter(([, re]) => re.test(clean)).map(([c]) => c);
  const size = clean.match(/(\d{1,4})\s*(?:جرام|جم|غرام|grams?|gm?\b|مل|ملي|ml)/i);
  return normaliseBrief({
    product, skin: skin || (concerns.includes('acne') ? 'oily' : 'normal'), concerns: skin === 'dry' && !concerns.includes('hydration') ? [...concerns, 'hydration' as Concern] : concerns,
    batch: size ? Number(size[1]) : 100,
    scent: /ريح[ةه]|معطر|زيت عطري|لافندر|scent|fragranced|lavender/i.test(clean) && !/من غير ريح|بدون ريح|unscented|fragrance.free/i.test(clean),
    nutFree: /حساسي[ةه] (?:من )?(?:ال)?مكسرات|بدون مكسرات|من غير مكسرات|nut.free|nut allergy/i.test(clean),
    vegan: /نباتي|فيجان|vegan/i.test(clean),
  });
}

// ── The formula as text (chat reply, copy, print) ─────────────────────────────────────────────────────────────────

export const cosmeticNumber = (n: number, lang: SupportedLanguage) => formatLocalizedNumber(lang, n, { maximumFractionDigits: 2 });
const num = cosmeticNumber;

/** Products whose formula does not depend on the skin type (it is left out of their title). */
const SKINLESS = new Set<CosmeticProduct>(['lip_balm', 'body_butter']);

export function cosmeticTitle(f: CosmeticFormula, lang: SupportedLanguage): string {
  const product = loc(lang, COSMETIC_PRODUCT_TEXT[f.brief.product]!.name);
  const skin = SKINLESS.has(f.brief.product) && f.brief.skin !== 'sensitive' ? '' : ` — ${loc(lang, COSMETIC_SKIN_TEXT[f.brief.skin]!)}`;
  const goals = f.brief.concerns.map((c) => loc(lang, COSMETIC_CONCERN_TEXT[c]!)).join(lang === 'ar' ? '، ' : ', ');
  return `${product}${skin}${goals ? ` — ${goals}` : ''} — ${num(f.brief.batch, lang)} ${lang === 'ar' ? 'جرام' : 'g'}`;
}

/** A complete markdown answer: phases as tables, method, safety. */
export function cosmeticReply(f: CosmeticFormula, lang: SupportedLanguage, opts: { assumedSkin?: boolean; assumedBatch?: boolean } = {}): string {
  const ct = (k: keyof typeof COSMETICS_UI) => loc(lang, COSMETICS_UI[k]);
  const out: string[] = [`### 🧴 ${cosmeticTitle(f, lang)}`, loc(lang, COSMETIC_PRODUCT_TEXT[f.brief.product]!.about)];
  if (opts.assumedSkin || opts.assumedBatch) {
    out.push(lang === 'ar'
      ? `_${[opts.assumedSkin ? 'نوع البشرة مش مذكور فاعتبرتها عادية' : '', opts.assumedBatch ? 'الكمية مش مذكورة فحسبت 100 جرام' : ''].filter(Boolean).join('، ')} — تقدر تقولّي وأعدّلها._`
      : `_${[opts.assumedSkin ? 'No skin type given, so normal' : '', opts.assumedBatch ? 'no batch size given, so 100 g' : ''].filter(Boolean).join('; ')} — tell me and I’ll adjust it._`);
  }
  for (const phase of ['A', 'B', 'C'] as const) {
    const rows = f.lines.filter((l) => l.phase === phase);
    if (!rows.length) continue;
    out.push('', `**${loc(lang, COSMETIC_PHASE_TEXT[phase])}**`, '', `| ${ct('colIngredient')} | ${ct('colRole')} | ${ct('colPct')} | ${ct('colGrams')} |`, '|---|---|---|---|');
    for (const l of rows) {
      const ing = cosmeticIngredient(l.id);
      const name = loc(lang, COSMETIC_INGREDIENT_TEXT[l.id]!.name);
      const pct = l.qs ? ct('qs') : `${num(l.pct, lang)}%${l.filler ? ` (${ct('rest')})` : ''}`;
      out.push(`| ${name} | ${loc(lang, COSMETIC_ROLE_TEXT[ing.role]!)} | ${pct} | ${l.qs ? '—' : num(l.grams, lang)} |`);
    }
  }
  const facts: string[] = [];
  facts.push(`${ct('heat')}: ${f.heatC ? `${num(f.heatC[0], lang)}–${num(f.heatC[1], lang)}${lang === 'ar' ? '°م' : ' °C'}` : ct('noHeat')}`);
  if (f.ph) facts.push(`${ct('phTarget')}: ${num(f.ph[0], lang)}–${num(f.ph[1], lang)}`);
  facts.push(`${ct('shelf')}: ${num(f.shelfMonths[0], lang)}–${num(f.shelfMonths[1], lang)} ${ct('months')}`);
  out.push('', facts.join(' · '));
  out.push('', `**${ct('steps')}**`, ...COSMETIC_STEPS[f.method]!.map((s, i) => `${i + 1}. ${loc(lang, s)}`));
  out.push('', `**⚠️ ${ct('safety')}**`, ...f.warnings.map((w) => `- ${loc(lang, COSMETIC_WARNINGS[w]!)}`));
  out.push('', `_${ct('trial')}_`);
  return out.join('\n');
}

/** Shaheen's entry point: a cosmetic formula request in a chat message → the reply, or undefined. */
export function cosmeticFor(message: string, language: string): { reply: string; formula: CosmeticFormula; lang: 'ar' | 'en' } | undefined {
  const brief = readCosmeticBrief(message);
  if (!brief) return undefined;
  const lang: 'ar' | 'en' = /[\u0600-\u06FF]/.test(message) || ((language === 'ar' || language === 'fa') && !/[a-z]{3}/i.test(message)) ? 'ar' : 'en';
  const clean = AR_DIGITS(message);
  const formula = formulateCosmetic(brief);
  const assumedSkin = !SKIN_WORDS.some(([, re]) => re.test(clean)) && !brief.concerns.includes('acne') && !['lip_balm', 'body_butter'].includes(brief.product);
  const assumedBatch = !/\d{1,4}\s*(?:جرام|جم|غرام|grams?|gm?\b|مل|ملي|ml)/i.test(clean);
  return { reply: cosmeticReply(formula, lang, { assumedSkin, assumedBatch }), formula, lang };
}

export const COSMETIC_INGREDIENT_COUNT = COSMETIC_INGREDIENTS.length;
