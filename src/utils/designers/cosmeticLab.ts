/**
 * «قسم المصممين — معمل محاكاة التجميل»: the designer writes the formula (ingredients and their % w/w, where it is used,
 * leave-on or rinse-off, the batch size) and the lab simulates it —
 *
 *  1. The result: what product it actually is (cream, lotion, gel, oil, balm, butter, wash), its texture, the phases,
 *     the pH window it needs, how it must be preserved and how long it keeps.
 *  2. What it resembles: the closest of the site's eight classic formulas (the cosmetics formulator), and what differs.
 *  3. International standards (EU Cosmetics Regulation 1223/2009 and its annexes, as an approximate guide): every
 *     ingredient's maximum (lower on the face), the regulated actives (salicylic acid, retinol, kojic acid,
 *     alpha-arbutin, AHAs at pH ≥ 3.5, mineral UV filters), prohibited substances, preservation of water-based products,
 *     emulsion stability, essential-oil limits, allergens to label, nut origin — each failure with its reason.
 *  4. Creative tools: complete with water, fix compliance, add the missing emulsifier / preservative / antioxidant,
 *     classic starting formulas, and variations.
 *
 * Pure and deterministic. A simulation for teaching and workshop batches — never a licence to sell an untested product.
 */
import type { LText } from '../../لغات/localize';
import { COSMETIC_INGREDIENT_TEXT, COSMETIC_PRODUCT_TEXT, COSMETIC_ROLE_TEXT } from '../../لغات/cosmeticsL10n';
import { COSMETIC_INGREDIENTS, type CosmeticIngredient, type CosmeticPhase, type CosmeticRole } from '../cosmeticIngredients';
import { COSMETIC_PRODUCTS, formulateCosmetic, type CosmeticProduct } from '../cosmeticFormulator';
import type { Status } from './perfumeLab';

export type CosmeticArea = 'face' | 'body' | 'hair' | 'lips';
export const COSMETIC_AREAS: CosmeticArea[] = ['face', 'body', 'hair', 'lips'];
export const AREA_LABEL: Record<CosmeticArea, LText> = { face: { ar: 'الوش', en: 'Face' }, body: { ar: 'الجسم', en: 'Body' }, hair: { ar: 'الشعر', en: 'Hair' }, lips: { ar: 'الشفايف', en: 'Lips' } };

/** The lab's ingredient: the site's 41 documented ingredients plus regulated actives a designer may write. */
export interface LabIngredient extends Omit<CosmeticIngredient, 'role'> {
  role: CosmeticRole | 'uv_filter' | 'fragrance';
  name: LText;
  names?: RegExp;
  /** The pH window it needs (works or stays stable in). */
  ph?: [number, number];
  /** A regulated or prohibited substance: the limit and why (leave-on unless `rinseMax`). */
  rule?: { kind: 'restricted' | 'prohibited'; why: LText; bodyMax?: number; rinseMax?: number; swap?: string };
  /** EU fragrance allergens it carries (fraction of the ingredient). */
  allergens?: Record<string, number>;
  /** Rich in unsaturated fatty acids: goes rancid without an antioxidant. */
  unsaturated?: boolean;
  /** Only works as a preservative below this pH. */
  preservativeBelowPh?: number;
}

const X = (id: string, inci: string, role: LabIngredient['role'], phase: CosmeticPhase, typical: [number, number], max: number, name: LText, extra: Partial<LabIngredient> = {}): LabIngredient => ({ id, inci, role, phase, typical, max, name, ...extra });

/** Regulated actives and common designer ingredients that the basic formulator does not use. */
export const LAB_EXTRAS: LabIngredient[] = [
  X('salicylic', 'Salicylic Acid', 'active', 'C', [0.5, 2], 2, { ar: 'حمض الساليسيليك (BHA)', en: 'Salicylic acid (BHA)' }, { names: /ساليسيليك|salicylic|bha/i, ph: [3, 4], rule: { kind: 'restricted', rinseMax: 3, why: { ar: 'الاتحاد الأوروبي (الملحق III): حده 2% في المنتجات اللي بتفضل على الجلد و3% في الشامبو، ومش للأطفال تحت 3 سنين', en: 'EU Annex III: 2% in leave-on products, 3% in rinse-off hair products, not for children under 3' } } }),
  X('retinol', 'Retinol', 'active', 'C', [0.05, 0.3], 0.3, { ar: 'ريتينول (فيتامين أ)', en: 'Retinol (vitamin A)' }, { names: /ريتينول|رتينول|retinol/i, heatSensitive: true, ph: [5, 6.5], rule: { kind: 'restricted', bodyMax: 0.05, why: { ar: 'لائحة الاتحاد الأوروبي 2024/996: حده 0.3% في منتجات الوش والإيدين و0.05% في لوشن الجسم', en: 'EU Regulation 2024/996: 0.3% in face and hand products, 0.05% in body lotions' } } }),
  X('kojic', 'Kojic Acid', 'active', 'C', [0.5, 1], 1, { ar: 'حمض الكوجيك', en: 'Kojic acid' }, { names: /كوجيك|kojic/i, ph: [3, 5], rule: { kind: 'restricted', bodyMax: 0, why: { ar: 'لائحة الاتحاد الأوروبي 2024/996: حده 1% وفي منتجات الوش بس', en: 'EU Regulation 2024/996: 1%, face products only' } } }),
  X('alpha_arbutin', 'Alpha-Arbutin', 'active', 'C', [0.5, 2], 2, { ar: 'ألفا أربوتين', en: 'Alpha-arbutin' }, { names: /أربوتين|اربوتين|arbutin/i, ph: [3.5, 6.5], rule: { kind: 'restricted', bodyMax: 0.5, why: { ar: 'لائحة الاتحاد الأوروبي 2024/996: حده 2% في كريم الوش و0.5% في لوشن الجسم', en: 'EU Regulation 2024/996: 2% in face creams, 0.5% in body lotions' } } }),
  X('glycolic', 'Glycolic Acid', 'active', 'C', [2, 8], 10, { ar: 'حمض الجليكوليك (AHA)', en: 'Glycolic acid (AHA)' }, { names: /جليكوليك|جلايكوليك|glycolic|aha/i, ph: [3.5, 4.2], rule: { kind: 'restricted', why: { ar: 'حد الأمان المعتمد للمستهلك: لحد 10% بحموضة 3.5 أو أعلى، ومعاه تحذير الشمس', en: 'the accepted consumer limit: up to 10% at pH 3.5 or higher, with a sun warning' } } }),
  X('lactic', 'Lactic Acid', 'active', 'C', [2, 8], 10, { ar: 'حمض اللاكتيك (AHA)', en: 'Lactic acid (AHA)' }, { names: /لاكتيك|lactic/i, ph: [3.5, 4.5], rule: { kind: 'restricted', why: { ar: 'حد الأمان المعتمد للمستهلك: لحد 10% بحموضة 3.5 أو أعلى', en: 'the accepted consumer limit: up to 10% at pH 3.5 or higher' } } }),
  X('vitamin_c', 'Ascorbic Acid', 'active', 'C', [5, 15], 20, { ar: 'فيتامين سي (حمض الأسكوربيك)', en: 'Vitamin C (ascorbic acid)' }, { names: /فيتامين ?سي|فيتامين ?c|ascorbic|vitamin ?c/i, heatSensitive: true, ph: [2.5, 3.5] }),
  X('caffeine', 'Caffeine', 'active', 'A', [0.5, 3], 5, { ar: 'كافيين', en: 'Caffeine' }, { names: /كافيين|caffeine/i }),
  X('ceramide', 'Ceramide NP', 'active', 'B', [0.1, 1], 2, { ar: 'سيراميد', en: 'Ceramide' }, { names: /سيراميد|ceramide/i }),
  X('zinc_oxide', 'Zinc Oxide', 'uv_filter', 'B', [5, 20], 25, { ar: 'أكسيد الزنك (فلتر شمس)', en: 'Zinc oxide (UV filter)' }, { names: /أكسيد الزنك|اكسيد الزنك|zinc oxide/i, rule: { kind: 'restricted', why: { ar: 'فلتر شمس مسموح لحد 25% (الملحق VI)، ومينفعش في البخاخ', en: 'a UV filter allowed up to 25% (Annex VI), not in sprays' } } }),
  X('titanium_dioxide', 'Titanium Dioxide', 'uv_filter', 'B', [3, 15], 25, { ar: 'ثاني أكسيد التيتانيوم (فلتر شمس)', en: 'Titanium dioxide (UV filter)' }, { names: /تيتانيوم|titanium/i, rule: { kind: 'restricted', why: { ar: 'فلتر شمس مسموح لحد 25% (الملحق VI)، والبودرة منه ممنوع تتشم', en: 'a UV filter allowed up to 25% (Annex VI); never in an inhalable powder' } } }),
  X('sodium_benzoate', 'Sodium Benzoate', 'preservative', 'C', [0.3, 0.5], 0.5, { ar: 'بنزوات الصوديوم', en: 'Sodium benzoate' }, { names: /بنزوات|benzoate/i, preservativeBelowPh: 5.5, rule: { kind: 'restricted', rinseMax: 2.5, why: { ar: 'الملحق V: حده 0.5% في المنتجات اللي بتفضل على الجلد و2.5% في الغسول', en: 'Annex V: 0.5% leave-on, 2.5% rinse-off' } } }),
  X('potassium_sorbate', 'Potassium Sorbate', 'preservative', 'C', [0.1, 0.3], 0.6, { ar: 'سوربات البوتاسيوم', en: 'Potassium sorbate' }, { names: /سوربات|sorbate/i, preservativeBelowPh: 5.5, rule: { kind: 'restricted', why: { ar: 'الملحق V: حده 0.6% (كحمض)', en: 'Annex V: 0.6% (as acid)' } } }),
  X('peppermint', 'Mentha Piperita Oil', 'essential_oil', 'C', [0.1, 0.5], 1, { ar: 'زيت النعناع', en: 'Peppermint oil' }, { names: /نعناع|peppermint|mint oil/i, faceMax: 0.5, sensitiser: true, allergens: { Limonene: 0.03, Linalool: 0.005 } }),
  X('fragrance', 'Parfum', 'fragrance', 'C', [0.2, 1], 1, { ar: 'عطر (بارفان)', en: 'Fragrance (parfum)' }, { names: /^عطر|بارفان|برفان|parfum|fragrance|perfume/i, faceMax: 0.5, sensitiser: true }),
  X('hydroquinone', 'Hydroquinone', 'active', 'C', [0, 0], 0, { ar: 'هيدروكينون', en: 'Hydroquinone' }, { names: /هيدروكينون|hydroquinone/i, rule: { kind: 'prohibited', swap: 'alpha_arbutin', why: { ar: 'ممنوع في مستحضرات التجميل في الاتحاد الأوروبي ومصر (دواء بروشتة بس) — بيسبب اسوداد دائم (أوكرونوزس)', en: 'banned in EU cosmetics (prescription medicine only) — it can cause permanent darkening (ochronosis)' } } }),
  X('mercury', 'Mercury compounds', 'active', 'C', [0, 0], 0, { ar: 'زئبق / مركبات زئبقية', en: 'Mercury compounds' }, { names: /زئبق|mercury|mercur/i, rule: { kind: 'prohibited', swap: 'niacinamide', why: { ar: 'ممنوع عالمياً (اتفاقية ميناماتا) — سام للكلى والأعصاب', en: 'banned worldwide (Minamata Convention) — toxic to kidneys and nerves' } } }),
  X('methylisothiazolinone', 'Methylisothiazolinone', 'preservative', 'C', [0, 0.0015], 0, { ar: 'ميثيل أيزوثيازولينون (MIT)', en: 'Methylisothiazolinone (MIT)' }, { names: /ميثيل ?ايزو|ميثيل ?أيزو|methylisothiazolinone|\bmit\b/i, rule: { kind: 'prohibited', rinseMax: 0.0015, swap: 'preservative', why: { ar: 'ممنوع في المنتجات اللي بتفضل على الجلد في الاتحاد الأوروبي (بيسبب حساسية تلامسية)، ومسموح 0.0015% في الغسول بس', en: 'banned in EU leave-on products (contact allergy); 0.0015% in rinse-off only' } } }),
  X('benzoyl_peroxide', 'Benzoyl Peroxide', 'active', 'C', [0, 0], 0, { ar: 'بنزويل بيروكسايد', en: 'Benzoyl peroxide' }, { names: /بنزويل|benzoyl/i, rule: { kind: 'prohibited', swap: 'salicylic', why: { ar: 'ده دواء لعلاج حب الشباب مش مستحضر تجميل — مكانه الصيدلية', en: 'an acne medicine, not a cosmetic ingredient — it belongs in a pharmacy' } } }),
];

/** Facts for the documented ingredients that the formulator keeps elsewhere (pH, allergens, rancidity). */
const BASE_FACTS: Record<string, Partial<LabIngredient>> = {
  niacinamide: { ph: [5, 7] }, hyaluronic: { ph: [4, 8] }, xanthan: { ph: [3, 12] }, decyl_glucoside: { ph: [5, 7.5] }, betaine: { ph: [4.5, 7.5] },
  preservative: { ph: [3, 10] }, urea: { ph: [5, 7.5] }, zinc_pca: { ph: [4, 7] }, panthenol: { ph: [4, 7.5] },
  rosehip: { unsaturated: true }, grapeseed: { unsaturated: true }, almond: { unsaturated: true }, argan: { unsaturated: true }, black_seed: { unsaturated: true }, olive: { unsaturated: true },
  lavender: { allergens: { Linalool: 0.35, Limonene: 0.01, Geraniol: 0.005, Coumarin: 0.001 } }, tea_tree: { allergens: { Limonene: 0.01, Linalool: 0.005 } },
};

export const LAB_INGREDIENTS: LabIngredient[] = [
  ...COSMETIC_INGREDIENTS.map((i) => ({ ...i, name: COSMETIC_INGREDIENT_TEXT[i.id]?.name || { ar: i.inci, en: i.inci }, ...BASE_FACTS[i.id] })),
  ...LAB_EXTRAS,
];
const BY_ID = new Map(LAB_INGREDIENTS.map((i) => [i.id, i]));
export const labIngredient = (id: string): LabIngredient | undefined => BY_ID.get(id);

export function findLabIngredient(text: string): LabIngredient | undefined {
  const t = text.trim().toLowerCase();
  if (!t) return undefined;
  return LAB_INGREDIENTS.find((i) => i.id === t || i.inci.toLowerCase() === t || i.name.ar === text.trim() || i.name.en.toLowerCase() === t)
    || LAB_INGREDIENTS.find((i) => i.names?.test(text))
    || LAB_INGREDIENTS.find((i) => t.length >= 3 && (i.name.ar.includes(text.trim()) || i.name.en.toLowerCase().includes(t) || i.inci.toLowerCase().includes(t)))
    || byWords(text);
}

/** «زيت جوجوبا» → «زيت الجوجوبا»: every meaningful word of the text found in the name (Arabic «ال» ignored). */
const GENERIC = /^(?:زيت|زبد[ةه]|شمع|ماء|مية|oil|butter|wax|water|extract)$/i;
const stem = (w: string) => w.toLowerCase().replace(/^(?:ال|لل)/, '').replace(/[ةه]$/, '');
function byWords(text: string): LabIngredient | undefined {
  const words = text.split(/[\s,،/()]+/).filter((w) => w.length >= 3 && !GENERIC.test(w)).map(stem);
  if (!words.length) return undefined;
  return LAB_INGREDIENTS.find((i) => {
    const hay = `${i.name.ar} ${i.name.en} ${i.inci}`.split(/[\s,،/()]+/).map(stem);
    return words.every((w) => hay.some((h) => h === w || (w.length >= 4 && h.startsWith(w))));
  });
}

export const roleLabel = (role: LabIngredient['role']): LText => COSMETIC_ROLE_TEXT[role] || (role === 'uv_filter' ? { ar: 'فلتر شمس', en: 'UV filter' } : { ar: 'عطر', en: 'Fragrance' });

// ── The design ─────────────────────────────────────────────────────────────────────────────────────────────────────
export interface CosmeticLine { ingredientId?: string; label: string; pct: number }
export interface CosmeticDesign { title: string; area: CosmeticArea; rinseOff: boolean; batch: number; lines: CosmeticLine[] }
export const emptyCosmeticDesign = (): CosmeticDesign => ({ title: '', area: 'face', rinseOff: false, batch: 100, lines: [] });
export function cosmeticLineFor(label: string, pct: number): CosmeticLine {
  const i = findLabIngredient(label);
  return i ? { ingredientId: i.id, label: i.name.en, pct } : { label: label.trim(), pct };
}

export type CosmeticKind = 'cream' | 'lotion' | 'gel' | 'serum' | 'oil' | 'balm' | 'butter' | 'wash' | 'unknown';
export const KIND_LABEL: Record<CosmeticKind, LText> = {
  cream: { ar: 'كريم (مستحلب زيت في ماء)', en: 'Cream (oil-in-water emulsion)' }, lotion: { ar: 'لوشن خفيف (مستحلب)', en: 'Light lotion (emulsion)' },
  gel: { ar: 'جل مائي', en: 'Water gel' }, serum: { ar: 'سيروم مائي سائل', en: 'Liquid water serum' }, oil: { ar: 'زيت من غير ماء', en: 'Water-free oil' },
  balm: { ar: 'بلسم شمعي صلب', en: 'Solid wax balm' }, butter: { ar: 'زبدة', en: 'Butter' }, wash: { ar: 'غسول / منظف', en: 'Wash / cleanser' }, unknown: { ar: 'مش واضح لسه', en: 'Not clear yet' },
};

export interface CosmeticCheck { id: string; status: Status; title: LText; detail: LText; fix?: LText; ingredientId?: string }
export interface CosmeticSimulation {
  total: number;
  lines: { line: CosmeticLine; ing?: LabIngredient; pct: number; phase: CosmeticPhase; grams: number }[];
  kind: CosmeticKind;
  texture: { score: number; label: LText };
  phases: Record<CosmeticPhase, number>;
  water: number; oil: number; emulsifier: number; surfactant: number;
  ph?: [number, number];
  heatC?: [number, number];
  shelfMonths: [number, number];
  closest: { product: CosmeticProduct; name: LText; score: number; missing: string[]; extra: string[] }[];
  checks: CosmeticCheck[];
  allergens: { inci: string; pct: number; label: boolean }[];
  verdict: Exclude<Status, 'info'>;
  steps: LText[];
}

const round = (n: number, d = 2) => Math.round(n * 10 ** d) / 10 ** d;
const AQUEOUS = new Set(['water', 'rose_water', 'aloe']);
const OILY_ROLES = new Set<LabIngredient['role']>(['oil', 'butter', 'wax', 'fatty_alcohol', 'essential_oil', 'fragrance']);
const nameOf = (l: CosmeticLine, i?: LabIngredient): LText => (i ? i.name : { ar: l.label, en: l.label });

export function simulateCosmetic(d: CosmeticDesign): CosmeticSimulation {
  const raw = d.lines.filter((l) => l.pct > 0);
  const total = round(raw.reduce((s, l) => s + l.pct, 0), 3);
  const batch = Math.max(1, d.batch);
  const lines = raw.map((line) => {
    const ing = line.ingredientId ? labIngredient(line.ingredientId) : undefined;
    const pct = total ? (line.pct / total) * 100 : 0;
    const phase: CosmeticPhase = ing ? (ing.heatSensitive ? 'C' : ing.phase) : 'C';
    return { line, ing, pct, phase, grams: round((pct * batch) / 100, 2) };
  });
  const sumBy = (f: (x: (typeof lines)[number]) => boolean) => round(lines.filter(f).reduce((s, x) => s + x.pct, 0), 2);
  const water = sumBy((x) => Boolean(x.ing && AQUEOUS.has(x.ing.id)));
  const oil = sumBy((x) => Boolean(x.ing && OILY_ROLES.has(x.ing.role)));
  const wax = sumBy((x) => x.ing?.role === 'wax');
  const butter = sumBy((x) => x.ing?.role === 'butter');
  const emulsifier = sumBy((x) => x.ing?.role === 'emulsifier');
  const surfactant = sumBy((x) => x.ing?.role === 'surfactant');
  const thickener = sumBy((x) => x.ing?.role === 'thickener');
  const fattyAlcohol = sumBy((x) => x.ing?.role === 'fatty_alcohol');
  const phases: Record<CosmeticPhase, number> = { A: sumBy((x) => x.phase === 'A'), B: sumBy((x) => x.phase === 'B'), C: sumBy((x) => x.phase === 'C') };

  // What it is.
  const hasWater = water >= 20;
  const kind: CosmeticKind = !lines.length ? 'unknown'
    : hasWater && surfactant >= 5 ? 'wash'
    : hasWater && oil + emulsifier >= 3 ? (oil >= 15 || thickener * 60 + fattyAlcohol * 9 + emulsifier * 4 + oil * 0.8 >= 45 ? 'cream' : 'lotion')
    : hasWater ? (thickener >= 0.2 ? 'gel' : 'serum')
    : wax >= 10 ? 'balm' : butter >= 35 ? 'butter' : oil >= 50 ? 'oil' : 'unknown';
  // Texture 0 (water-thin) … 100 (solid stick).
  const score = Math.max(0, Math.min(100, Math.round(kind === 'balm' ? 80 + wax : kind === 'butter' ? 60 + butter / 4 : kind === 'oil' ? 10 : thickener * 60 + fattyAlcohol * 9 + emulsifier * 4 + oil * 0.8 + (kind === 'wash' ? 15 : 0))));
  const texture = { score, label: score >= 80 ? { ar: 'صلب زي الاستيك', en: 'Solid, stick-like' } : score >= 55 ? { ar: 'تقيل وغني', en: 'Thick and rich' } : score >= 30 ? { ar: 'كريمي متوسط', en: 'Medium, creamy' } : score >= 12 ? { ar: 'خفيف وسهل الفرد', en: 'Light and easy to spread' } : { ar: 'سائل', en: 'Fluid' } };

  // pH window: the intersection of what every ingredient needs (water-based only).
  let ph: [number, number] | undefined;
  const phConflicts: string[] = [];
  if (hasWater) {
    ph = kind === 'wash' ? [5, 6.5] : [4.5, 6.5];
    const needs = lines.filter((x) => x.ing?.ph);
    for (const x of needs) ph = [Math.max(ph[0], x.ing!.ph![0]), Math.min(ph[1], x.ing!.ph![1])];
    if (needs.some((x) => x.ing!.ph![1] <= 4.5)) ph = [Math.max(...needs.map((x) => x.ing!.ph![0]), 2.5), Math.min(...needs.map((x) => x.ing!.ph![1]))];
    if (ph[0] > ph[1]) {
      for (const a of needs) for (const b of needs) if (a !== b && a.ing!.ph![1] < b.ing!.ph![0]) phConflicts.push(`${a.ing!.id}|${b.ing!.id}`);
      ph = undefined;
    }
  }
  const heated = (hasWater && (oil + emulsifier >= 3)) || kind === 'balm' || kind === 'butter';
  const heatC: [number, number] | undefined = heated ? (kind === 'balm' ? [65, 70] : [70, 75]) : undefined;
  const preserved = lines.some((x) => x.ing?.role === 'preservative' && x.ing.rule?.kind !== 'prohibited' && x.pct >= (x.ing.id === 'preservative' ? 0.5 : 0.1));
  const unsaturated = sumBy((x) => Boolean(x.ing?.unsaturated));
  const vitE = sumBy((x) => x.ing?.id === 'vitamin_e');
  const shelfMonths: [number, number] = hasWater ? (preserved ? [3, 6] : [0, 0]) : unsaturated >= 5 && vitE < 0.2 ? [2, 4] : [6, 12];

  // Allergens (EU labelling: 0.001 % leave-on, 0.01 % rinse-off).
  const threshold = d.rinseOff ? 0.01 : 0.001;
  const al = new Map<string, number>();
  for (const x of lines) for (const [k, f] of Object.entries(x.ing?.allergens || {})) al.set(k, (al.get(k) || 0) + x.pct * f);
  const allergens = [...al].map(([inci, pct]) => ({ inci, pct: round(pct, 4), label: pct > threshold })).sort((a, b) => b.pct - a.pct);

  const checks = cosmeticChecks(d, lines, { total, water, oil, emulsifier, surfactant, hasWater, kind, preserved, unsaturated, vitE, ph, phConflicts, allergens });
  const verdict: Exclude<Status, 'info'> = checks.some((c) => c.status === 'fail') ? 'fail' : checks.some((c) => c.status === 'warn') ? 'warn' : 'pass';

  return {
    total, lines: lines.map((x) => ({ ...x, pct: round(x.pct, 3) })), kind, texture, phases, water, oil, emulsifier, surfactant, ph, heatC, shelfMonths,
    closest: closestClassic(lines), checks, allergens, verdict, steps: stepsFor(kind, heated, lines.some((x) => x.phase === 'C'), Boolean(ph)),
  };
}

function cosmeticChecks(d: CosmeticDesign, lines: CosmeticSimulation['lines'], s: { total: number; water: number; oil: number; emulsifier: number; surfactant: number; hasWater: boolean; kind: CosmeticKind; preserved: boolean; unsaturated: number; vitE: number; ph?: [number, number]; phConflicts: string[]; allergens: CosmeticSimulation['allergens'] }): CosmeticCheck[] {
  const checks: CosmeticCheck[] = [];
  const face = d.area === 'face' && !d.rinseOff;
  checks.push(Math.abs(s.total - 100) <= 0.1
    ? { id: 'total', status: 'pass', title: { ar: 'المجموع 100%', en: 'The total is 100%' }, detail: { ar: 'النسب مكتوبة صح.', en: 'The percentages add up.' } }
    : { id: 'total', status: s.total ? 'warn' : 'fail', title: { ar: `المجموع ${round(s.total, 2)}% مش 100%`, en: `The total is ${round(s.total, 2)}%, not 100%` }, detail: { ar: 'المحاكاة وزعت النسب على 100%، بس التركيبة المكتوبة لازم تبقى دقيقة.', en: 'The simulation scaled it to 100%, but the written formula should be exact.' }, fix: { ar: 'اضغط «كمّل بالماء» أو «اضبط على 100%».', en: 'Press “Top up with water” or “Scale to 100%”.' } });

  for (const x of lines) {
    const i = x.ing;
    if (!i) { checks.push({ id: `unknown-${x.line.label}`, status: 'warn', title: { ar: `«${x.line.label}» مش في بنك المعمل`, en: `“${x.line.label}” is not in the lab bank` }, detail: { ar: 'ملوش بيانات حدود أو مرحلة، فالمحاكاة حطته في مرحلة التبريد.', en: 'No limit or phase data, so the simulation put it in the cool-down phase.' }, fix: { ar: 'اختاره من القائمة أو اطلب من المورد شهادة السلامة (SDS) والحد المسموح.', en: 'Pick it from the list, or ask the supplier for its SDS and allowed level.' } }); continue; }
    const swap = i.rule?.swap ? labIngredient(i.rule.swap) : undefined;
    if (i.rule?.kind === 'prohibited' && !(d.rinseOff && i.rule.rinseMax && x.pct <= i.rule.rinseMax)) {
      checks.push({ id: `rule-${i.id}`, ingredientId: i.id, status: 'fail', title: { ar: `«${i.name.ar}» ممنوع`, en: `“${i.name.en}” is prohibited` }, detail: i.rule.why, fix: swap ? { ar: `استبدله بـ«${swap.name.ar}».`, en: `Replace it with “${swap.name.en}”.` } : { ar: 'شيله.', en: 'Remove it.' } });
      continue;
    }
    let max = d.rinseOff && i.rule?.rinseMax !== undefined ? i.rule.rinseMax : face && i.faceMax !== undefined ? i.faceMax : i.max;
    if (!d.rinseOff && d.area === 'body' && i.rule?.bodyMax !== undefined) max = i.rule.bodyMax;
    if (x.pct > max + 1e-9) {
      const where = max === 0 ? { ar: `مش مسموح في منتجات ${AREA_LABEL[d.area].ar}`, en: `not allowed in ${AREA_LABEL[d.area].en.toLowerCase()} products` } : { ar: `الحد ${max}%`, en: `the limit is ${max}%` };
      checks.push({ id: `max-${i.id}`, ingredientId: i.id, status: 'fail', title: { ar: `«${i.name.ar}» فوق الحد`, en: `“${i.name.en}” is above its limit` }, detail: { ar: `${round(x.pct, 2)}% — ${where.ar}${i.rule ? ` (${i.rule.why.ar})` : ''}.`, en: `${round(x.pct, 2)}% — ${where.en}${i.rule ? ` (${i.rule.why.en})` : ''}.` }, fix: max > 0 ? { ar: `نزّله لـ${max}% أو أقل — «صلّح التوافق» بيعملها.`, en: `Lower it to ${max}% or less — “Fix compliance” does it.` } : { ar: 'شيله من التركيبة دي.', en: 'Remove it from this formula.' } });
    } else if (i.rule?.kind === 'restricted') {
      checks.push({ id: `rule-${i.id}`, ingredientId: i.id, status: 'pass', title: { ar: `«${i.name.ar}» داخل الحد المسموح`, en: `“${i.name.en}” is within its limit` }, detail: { ar: `${round(x.pct, 2)}% من ${max}% — ${i.rule.why.ar}.`, en: `${round(x.pct, 2)}% of ${max}% — ${i.rule.why.en}.` } });
    }
    if (i.role === 'uv_filter') checks.push({ id: `spf-${i.id}`, ingredientId: i.id, status: 'warn', title: { ar: 'متكتبش «واقي شمس» أو SPF', en: 'Do not claim “sunscreen” or SPF' }, detail: { ar: 'عامل الحماية مايتحسبش من النسبة — لازم اختبار معتمد (ISO 24444 / ISO 24443) قبل أي ادعاء.', en: 'SPF cannot be calculated from the percentage — it needs accredited testing (ISO 24444 / ISO 24443) before any claim.' } });
    if (face && i.comedogenic) checks.push({ id: `comedo-${i.id}`, ingredientId: i.id, status: 'info', title: { ar: `«${i.name.ar}» ممكن يسد المسام`, en: `“${i.name.en}” may clog pores` }, detail: { ar: 'مش مناسب للبشرة الدهنية أو المعرضة للحبوب.', en: 'Not ideal for oily or blemish-prone skin.' } });
    if (i.nut) checks.push({ id: `nut-${i.id}`, ingredientId: i.id, status: 'info', title: { ar: `«${i.name.ar}» من أصل مكسرات`, en: `“${i.name.en}” is of nut origin` }, detail: { ar: 'اكتبها بوضوح لأصحاب حساسية المكسرات.', en: 'State it clearly for people with nut allergies.' } });
  }

  // Water needs a preservative; a preservative that only works at low pH needs that pH.
  if (s.hasWater) {
    checks.push(s.preserved
      ? { id: 'preservative', status: 'pass', title: { ar: 'فيه مادة حافظة', en: 'A preservative is present' }, detail: { ar: 'أي منتج فيه ماء لازم حافظة واسعة المجال عشان البكتيريا والفطريات.', en: 'Every water-based product needs a broad-spectrum preservative against bacteria and mould.' } }
      : { id: 'preservative', status: 'fail', title: { ar: 'فيه ماء ومفيش مادة حافظة', en: 'Water but no preservative' }, detail: { ar: 'البكتيريا والفطريات بتنمو في المنتج خلال أيام حتى لو شكله سليم — وفيتامين E مش حافظة.', en: 'Bacteria and mould grow within days even if it looks fine — and vitamin E is not a preservative.' }, fix: { ar: 'زوّد «فينوكسي إيثانول وإيثيل هكسيل جلسرين» 1% — «صلّح التوافق» بيضيفها.', en: 'Add phenoxyethanol & ethylhexylglycerin at 1% — “Fix compliance” adds it.' } });
    const lowPh = lines.find((x) => x.ing?.preservativeBelowPh);
    if (lowPh && s.ph && s.ph[0] > lowPh.ing!.preservativeBelowPh!) checks.push({ id: 'preservative-ph', status: 'warn', title: { ar: `«${lowPh.ing!.name.ar}» مش هيشتغل في الحموضة دي`, en: `“${lowPh.ing!.name.en}” won't work at this pH` }, detail: { ar: `محتاج pH أقل من ${lowPh.ing!.preservativeBelowPh}.`, en: `It needs a pH below ${lowPh.ing!.preservativeBelowPh}.` } });
  } else if (lines.length) checks.push({ id: 'anhydrous', status: 'info', title: { ar: 'من غير ماء — مش محتاج حافظة', en: 'Water-free — no preservative needed' }, detail: { ar: 'بشرط إنه مايتلمسش بإيد مبلولة ولا يدخله ماء.', en: 'As long as wet fingers and water never get into it.' } });

  // Emulsion stability.
  if (s.hasWater && s.oil >= 3 && s.kind !== 'wash') {
    const need = round(Math.max(3, s.oil * 0.22), 1);
    checks.push(s.emulsifier >= need
      ? { id: 'emulsion', status: 'pass', title: { ar: 'المستحلب كفاية', en: 'Enough emulsifier' }, detail: { ar: `${s.emulsifier}% مستحلب لـ${s.oil}% زيوت (المطلوب حوالي ${need}% أو أكتر).`, en: `${s.emulsifier}% emulsifier for ${s.oil}% oils (about ${need}% or more needed).` } }
      : { id: 'emulsion', status: 'fail', title: { ar: s.emulsifier ? 'المستحلب قليل — هينفصل' : 'ماء وزيت من غير مستحلب — هينفصل', en: s.emulsifier ? 'Too little emulsifier — it will separate' : 'Water and oil with no emulsifier — it will separate' }, detail: { ar: `${s.oil}% زيوت محتاجة حوالي ${need}% مستحلب، والموجود ${s.emulsifier}%.`, en: `${s.oil}% oils need about ${need}% emulsifier; there is ${s.emulsifier}%.` }, fix: { ar: 'زوّد مستحلب الزيتون — «صلّح التوافق» بيحسبه.', en: 'Add olive emulsifier — “Fix compliance” computes it.' } });
  }
  if (s.kind === 'wash' && s.surfactant > 30) checks.push({ id: 'harsh', status: 'warn', title: { ar: 'منظفات كتير — هينشف البشرة', en: 'Too much surfactant — it will dry the skin' }, detail: { ar: `${s.surfactant}% منظفات؛ الغسول اللطيف عادة 15–25%.`, en: `${s.surfactant}% surfactants; a gentle wash is usually 15–25%.` } });

  // pH.
  if (s.ph || s.phConflicts.length) {
    if (s.phConflicts.length) {
      const [a, b] = s.phConflicts[0].split('|').map((id) => labIngredient(id)!);
      checks.push({ id: 'ph', status: 'warn', title: { ar: 'مكونات محتاجة حموضة مختلفة', en: 'Ingredients that need different pH' }, detail: { ar: `«${a.name.ar}» محتاج pH ${a.ph![0]}–${a.ph![1]} و«${b.name.ar}» محتاج ${b.ph![0]}–${b.ph![1]} — واحد فيهم مش هيشتغل كويس.`, en: `“${a.name.en}” needs pH ${a.ph![0]}–${a.ph![1]} and “${b.name.en}” needs ${b.ph![0]}–${b.ph![1]} — one of them won't work well.` }, fix: { ar: 'افصلهم في منتجين (صباح ومساء).', en: 'Split them into two products (morning and evening).' } });
    } else if (s.ph) checks.push({ id: 'ph', status: 'pass', title: { ar: `الحموضة المطلوبة pH ${s.ph[0]}–${s.ph[1]}`, en: `Target pH ${s.ph[0]}–${s.ph[1]}` }, detail: { ar: 'قيسها بجهاز أو شرايط بعد ما يبرد، واضبطها بمحلول حمض الستريك.', en: 'Measure it with a meter or strips once cool, and adjust with citric acid solution.' } });
  }
  const acids = lines.filter((x) => x.ing && ['glycolic', 'lactic', 'salicylic'].includes(x.ing.id));
  if (acids.length && lines.some((x) => x.ing?.id === 'retinol')) checks.push({ id: 'acid-retinol', status: 'warn', title: { ar: 'أحماض مع ريتينول في نفس المنتج', en: 'Acids with retinol in one product' }, detail: { ar: 'التهيج بيزيد جداً، والريتينول مش ثابت في الحموضة دي.', en: 'Irritation rises sharply and retinol is unstable at that pH.' }, fix: { ar: 'خلي الأحماض بالليل في منتج والريتينول في منتج تاني.', en: 'Keep acids and retinol in separate products.' } });
  if (acids.length || lines.some((x) => x.ing?.id === 'retinol')) checks.push({ id: 'sun', status: 'info', title: { ar: 'لازم تحذير الشمس على العبوة', en: 'A sun warning is required on the pack' }, detail: { ar: 'الأحماض والريتينول بيزودوا حساسية الجلد للشمس — اكتب «استخدم واقي شمس».', en: 'Acids and retinol increase sun sensitivity — print “use sunscreen”.' } });

  // Rancidity.
  if (s.unsaturated >= 3 && s.vitE < 0.2) checks.push({ id: 'antioxidant', status: 'warn', title: { ar: 'زيوت بتزنخ من غير مضاد أكسدة', en: 'Oils that go rancid without an antioxidant' }, detail: { ar: `${s.unsaturated}% زيوت غنية بالأحماض غير المشبعة.`, en: `${s.unsaturated}% oils rich in unsaturated fatty acids.` }, fix: { ar: 'زوّد فيتامين E من 0.2 لـ 0.5%.', en: 'Add vitamin E at 0.2–0.5%.' } });

  // Essential oils and fragrance.
  const eo = round(lines.filter((x) => x.ing && (x.ing.role === 'essential_oil' || x.ing.role === 'fragrance')).reduce((t, x) => t + x.pct, 0), 2);
  const eoMax = d.area === 'lips' ? 0.5 : face ? 0.5 : d.rinseOff ? 1.5 : 1;
  if (eo > eoMax) checks.push({ id: 'eo', status: 'fail', title: { ar: 'زيوت عطرية / عطر أكتر من الآمن', en: 'More essential oil / fragrance than is safe' }, detail: { ar: `${eo}% والحد العملي لمنتجات ${AREA_LABEL[d.area].ar} ${eoMax}% — بتسبب تحسس.`, en: `${eo}% vs. a practical ${eoMax}% for ${AREA_LABEL[d.area].en.toLowerCase()} products — they sensitise.` }, fix: { ar: `نزّلها لـ${eoMax}%.`, en: `Lower to ${eoMax}%.` } });
  if (lines.some((x) => x.ing?.id === 'fragrance')) checks.push({ id: 'fragrance-allergens', status: 'info', title: { ar: 'العطر محتاج قائمة مسببات الحساسية', en: 'The fragrance needs its allergen list' }, detail: { ar: 'اطلب من مورد العطر شهادة IFRA وقائمة المواد اللي لازم تتكتب (لائحة الاتحاد الأوروبي 2023/1545).', en: 'Ask the fragrance supplier for the IFRA certificate and the allergens to label (EU Regulation 2023/1545).' } });
  const labelled = s.allergens.filter((x) => x.label);
  if (labelled.length) checks.push({ id: 'allergens', status: 'info', title: { ar: `${labelled.length} مادة لازم تتكتب على الملصق`, en: `${labelled.length} allergens must be printed on the label` }, detail: { ar: `${labelled.map((x) => x.inci).join('، ')} — فوق ${d.rinseOff ? '0.01' : '0.001'}% (الاتحاد الأوروبي 1223/2009).`, en: `${labelled.map((x) => x.inci).join(', ')} — above ${d.rinseOff ? '0.01' : '0.001'}% (EU 1223/2009).` } });
  checks.push({ id: 'testing', status: 'info', title: { ar: 'قبل البيع', en: 'Before selling' }, detail: { ar: 'المحاكاة مش بديل عن اختبار الثبات والتحدي الميكروبي وتقييم السلامة والتسجيل في هيئة الدواء.', en: 'The simulation does not replace stability, challenge and safety testing and registration with the authority.' } });
  return checks;
}

/** The closest of the eight classic formulas (normal skin), by weighted ingredient overlap. */
function closestClassic(lines: { ing?: LabIngredient; pct: number }[]): CosmeticSimulation['closest'] {
  const mine = new Map<string, number>();
  for (const x of lines) if (x.ing) mine.set(x.ing.id, (mine.get(x.ing.id) || 0) + x.pct);
  if (!mine.size) return [];
  return COSMETIC_PRODUCTS.map((product) => {
    const f = formulateCosmetic({ product, skin: 'normal', concerns: [] });
    const theirs = new Map(f.lines.map((l) => [l.id, l.pct]));
    let inter = 0, union = 0;
    for (const id of new Set([...mine.keys(), ...theirs.keys()])) { const a = mine.get(id) || 0, b = theirs.get(id) || 0; inter += Math.min(a, b); union += Math.max(a, b); }
    const missing = [...theirs.keys()].filter((id) => !mine.has(id) && (theirs.get(id) || 0) >= 0.2);
    const extra = [...mine.keys()].filter((id) => !theirs.has(id));
    return { product, name: COSMETIC_PRODUCT_TEXT[product].name, score: Math.round((union ? inter / union : 0) * 100), missing, extra };
  }).sort((a, b) => b.score - a.score).slice(0, 2);
}

function stepsFor(kind: CosmeticKind, heated: boolean, cool: boolean, ph: boolean): LText[] {
  const s: LText[] = [{ ar: 'عقّم الأدوات والعبوات بكحول 70% والبس جوانتي.', en: 'Sanitise tools and jars with 70% alcohol and wear gloves.' }];
  if (kind === 'balm' || kind === 'butter') s.push({ ar: 'سيّح الشمع والزبدات في حمام مائي على 65–70°م.', en: 'Melt the waxes and butters in a water bath at 65–70 °C.' }, { ar: 'شيله من على النار وزوّد الزيوت السائلة.', en: 'Take it off the heat and add the liquid oils.' });
  else if (heated) s.push({ ar: 'سخّن المرحلة (أ) والمرحلة (ب) كل واحدة لوحدها لحد 70–75°م.', en: 'Heat phase A and phase B separately to 70–75 °C.' }, { ar: 'صب الزيت على الماء وانت بتخلط بخلاط يدوي 2–3 دقايق.', en: 'Pour the oil into the water while blending with a stick blender for 2–3 minutes.' }, { ar: 'كمّل تقليب بالهدوء لحد ما يبرد.', en: 'Keep stirring gently while it cools.' });
  else if (kind === 'oil') s.push({ ar: 'اخلط الزيوت على البارد في كوباية زجاج نضيفة.', en: 'Mix the oils cold in a clean glass beaker.' });
  else s.push({ ar: 'ذوّب مكونات المرحلة (أ) على البارد، ورش المكثف وانت بتقلب لحد ما يبقى جل.', en: 'Dissolve phase A cold, and sprinkle in the thickener while stirring until it gels.' });
  if (cool) s.push({ ar: 'تحت 40°م زوّد المرحلة (ج): الفعالات والحافظة والزيوت العطرية.', en: 'Below 40 °C add phase C: actives, preservative and essential oils.' });
  if (ph) s.push({ ar: 'قيس الحموضة واضبطها، وبعدين عبّي في عبوات نضيفة واكتب التاريخ.', en: 'Measure and adjust the pH, then fill clean containers and date them.' });
  else s.push({ ar: 'عبّي في عبوات نضيفة ناشفة واكتب التاريخ.', en: 'Fill clean, dry containers and date them.' });
  s.push({ ar: 'جرّبه على جزء صغير من الدراع 48 ساعة قبل الاستخدام.', en: 'Patch-test on the inner arm for 48 hours before use.' });
  return s;
}

// ── Creative tools ─────────────────────────────────────────────────────────────────────────────────────────────────
const tidy = (lines: CosmeticLine[]) => lines.filter((l) => l.pct > 0.0001).map((l) => ({ ...l, pct: round(l.pct, 3) }));
const lineOf = (id: string, pct: number): CosmeticLine => ({ ingredientId: id, label: labIngredient(id)!.name.en, pct });

export function scaleCosmeticTo100(d: CosmeticDesign): CosmeticDesign {
  const total = d.lines.reduce((s, l) => s + Math.max(0, l.pct), 0);
  return total ? { ...d, lines: tidy(d.lines.map((l) => ({ ...l, pct: (Math.max(0, l.pct) / total) * 100 }))) } : d;
}

/** «كمّل بالماء»: water takes whatever is left to 100 % (added when missing). */
export function topUpWithWater(d: CosmeticDesign): CosmeticDesign {
  const others = d.lines.filter((l) => l.ingredientId !== 'water').reduce((s, l) => s + Math.max(0, l.pct), 0);
  if (others >= 100) return scaleCosmeticTo100(d);
  const rest = round(100 - others, 3);
  const has = d.lines.some((l) => l.ingredientId === 'water');
  return { ...d, lines: has ? d.lines.map((l) => (l.ingredientId === 'water' ? { ...l, pct: rest } : l)) : [lineOf('water', rest), ...d.lines] };
}

/**
 * «صلّح التوافق»: prohibited → their compliant alternative, every level capped to 95 % of its limit for this area,
 * essential oils to the area's limit, a preservative for water, an emulsifier for water + oil, vitamin E for
 * unsaturated oils — then the formula is completed with water (water-based) or the main oil (water-free).
 */
export function fixCosmeticCompliance(d: CosmeticDesign): CosmeticDesign {
  const face = d.area === 'face' && !d.rinseOff;
  let lines: CosmeticLine[] = d.lines.flatMap((l) => {
    const i = l.ingredientId ? labIngredient(l.ingredientId) : undefined;
    if (i?.rule?.kind !== 'prohibited' || (d.rinseOff && i.rule.rinseMax && l.pct <= i.rule.rinseMax)) return [l];
    const swap = i.rule.swap ? labIngredient(i.rule.swap) : undefined;
    return swap ? [lineOf(swap.id, Math.min(l.pct || swap.typical[1], swap.typical[1]))] : [];
  });
  lines = lines.map((l) => {
    const i = l.ingredientId ? labIngredient(l.ingredientId) : undefined;
    if (!i) return l;
    let max = d.rinseOff && i.rule?.rinseMax !== undefined ? i.rule.rinseMax : face && i.faceMax !== undefined ? i.faceMax : i.max;
    if (!d.rinseOff && d.area === 'body' && i.rule?.bodyMax !== undefined) max = i.rule.bodyMax;
    return l.pct > max ? { ...l, pct: max * 0.95 } : l;
  });
  const eoIds = (l: CosmeticLine) => { const r = l.ingredientId ? labIngredient(l.ingredientId)?.role : undefined; return r === 'essential_oil' || r === 'fragrance'; };
  const eo = lines.filter(eoIds).reduce((s, l) => s + l.pct, 0);
  const eoMax = d.area === 'lips' || face ? 0.5 : d.rinseOff ? 1.5 : 1;
  if (eo > eoMax) lines = lines.map((l) => (eoIds(l) ? { ...l, pct: l.pct * (eoMax * 0.95) / eo } : l));
  const sim = simulateCosmetic({ ...d, lines });
  const has = (id: string) => lines.some((l) => l.ingredientId === id);
  if (sim.water >= 20 && !sim.checks.find((c) => c.id === 'preservative' && c.status === 'pass')) {
    lines = lines.filter((l) => !(l.ingredientId && labIngredient(l.ingredientId)?.role === 'preservative' && labIngredient(l.ingredientId)?.rule?.kind === 'prohibited'));
    if (!has('preservative')) lines.push(lineOf('preservative', 1)); else lines = lines.map((l) => (l.ingredientId === 'preservative' ? { ...l, pct: 1 } : l));
  }
  if (sim.water >= 20 && sim.oil >= 3 && sim.kind !== 'wash') {
    const need = Math.max(3, sim.oil * 0.25);
    if (sim.emulsifier < need * 0.88) {
      const at = lines.findIndex((l) => l.ingredientId && labIngredient(l.ingredientId)?.role === 'emulsifier');
      if (at >= 0) lines[at] = { ...lines[at], pct: Math.min(labIngredient(lines[at].ingredientId!)!.max, need) }; else lines.push(lineOf('olive_emulsifier', Math.min(8, need)));
    }
  }
  if (sim.checks.some((c) => c.id === 'antioxidant')) { if (has('vitamin_e')) lines = lines.map((l) => (l.ingredientId === 'vitamin_e' ? { ...l, pct: 0.5 } : l)); else lines.push(lineOf('vitamin_e', 0.5)); }
  // Complete to 100 with the filler.
  const filler = sim.water >= 20 ? 'water' : [...lines].filter((l) => l.ingredientId && labIngredient(l.ingredientId)?.role === 'oil').sort((a, b) => b.pct - a.pct)[0]?.ingredientId;
  const others = lines.filter((l) => l.ingredientId !== filler).reduce((s, l) => s + l.pct, 0);
  if (filler && others < 100) {
    const rest = 100 - others;
    lines = lines.some((l) => l.ingredientId === filler) ? lines.map((l) => (l.ingredientId === filler ? { ...l, pct: rest } : l)) : [lineOf(filler, rest), ...lines];
  }
  return scaleCosmeticTo100({ ...d, lines: tidy(lines) });
}

/** A classic formula from the site's formulator as a starting point. */
export function cosmeticStarter(product: CosmeticProduct): CosmeticDesign {
  const f = formulateCosmetic({ product, skin: 'normal', concerns: product === 'gel_serum' ? ['glow'] : [] });
  const area: CosmeticArea = product === 'lip_balm' ? 'lips' : product === 'hair_oil' ? 'hair' : product === 'body_lotion' || product === 'body_butter' ? 'body' : 'face';
  return { title: COSMETIC_PRODUCT_TEXT[product].name.en, area, rinseOff: product === 'face_wash', batch: 100, lines: f.lines.filter((l) => l.pct > 0).map((l) => lineOf(l.id, l.pct)) };
}

/** «إلهام»: one ingredient swapped for a sibling of the same role (allowed here) and the levels nudged within range. */
export function inspireCosmetic(d: CosmeticDesign, seed: number): CosmeticDesign {
  let a = seed >>> 0;
  const rnd = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const used = new Set(d.lines.map((l) => l.ingredientId));
  const swappable = d.lines.map((l, i) => ({ l, i, ing: l.ingredientId ? labIngredient(l.ingredientId) : undefined })).filter((x) => x.ing && ['oil', 'butter', 'humectant', 'soothing', 'active'].includes(x.ing.role));
  const lines = d.lines.map((l) => ({ ...l }));
  if (swappable.length) {
    const pick = swappable[Math.floor(rnd() * swappable.length)];
    const siblings = LAB_INGREDIENTS.filter((i) => !used.has(i.id) && i.role === pick.ing!.role && !i.rule && !(d.area === 'face' && i.comedogenic));
    const s = siblings[Math.floor(rnd() * siblings.length)];
    if (s) lines[pick.i] = lineOf(s.id, Math.min(s.typical[1], Math.max(s.typical[0], pick.l.pct)));
  }
  const filler = lines.find((l) => l.ingredientId === 'water') ? 'water' : undefined;
  if (filler) return topUpWithWater({ ...d, lines });
  return scaleCosmeticTo100({ ...d, lines });
}

export const cosmeticNameOf = nameOf;
