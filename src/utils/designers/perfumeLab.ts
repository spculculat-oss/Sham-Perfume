/**
 * «قسم المصممين — معمل محاكاة العطور»: the designer writes the formula (materials and their share of the perfume oil,
 * the concentration, the format) and the lab simulates it completely —
 *
 *  1. The result: its character (families), the pyramid balance, a timeline of what is smelled from the first spray
 *     to the dry-down, staying power, projection, and the maceration it needs.
 *  2. What it resembles: the world references in the site's library and the store's ready perfumes, by shared
 *     materials and character (a resemblance, never «a copy»).
 *  3. International standards: IFRA (Category 4, fine fragrance) limits per material and per restricted constituent,
 *     phototoxic citrus summed the IFRA way, prohibited materials, the EU allergens that must be printed on the label,
 *     and the formula's own sanity (sums, concentration vs. type, alcohol and water). Every failure says WHY and how to
 *     fix it.
 *  4. Creative tools: balance the pyramid, fix compliance automatically, boost staying power, convert the type, swap a
 *     restricted material for a compliant one, and «إلهام» variations.
 *
 * Pure and deterministic (the same formula → the same simulation). A simulation, not a lab test: the page says so.
 */
import type { LText } from '../../لغات/localize';
import {
  ALLERGEN_INCI, CONSTITUENT_LIMITS, LAYER_LABEL, PERFUME_MATERIALS, TAG_LABEL, findPerfumeMaterial, perfumeMaterial,
  type Allergen, type Layer, type PerfumeMaterial, type ScentTag,
} from './perfumeMaterials';

export type PerfumeType = 'extrait' | 'edp' | 'edt' | 'edc' | 'mist' | 'oil';
export const PERFUME_TYPES: PerfumeType[] = ['extrait', 'edp', 'edt', 'edc', 'mist', 'oil'];
/** The usual perfume-oil share of each type (% of the finished product). */
export const TYPE_RANGE: Record<PerfumeType, [number, number]> = { extrait: [20, 40], edp: [15, 22], edt: [8, 15], edc: [3, 6], mist: [1, 3], oil: [15, 30] };
export const TYPE_LABEL: Record<PerfumeType, LText> = {
  extrait: { ar: 'إكستريه (Extrait)', en: 'Extrait de parfum' }, edp: { ar: 'أو دو بارفان (EDP)', en: 'Eau de parfum (EDP)' },
  edt: { ar: 'أو دو تواليت (EDT)', en: 'Eau de toilette (EDT)' }, edc: { ar: 'كولونيا (EDC)', en: 'Eau de cologne (EDC)' },
  mist: { ar: 'بخاخ جسم (Mist)', en: 'Body mist' }, oil: { ar: 'عطر زيتي بدون كحول', en: 'Alcohol-free perfume oil' },
};

export interface DesignLine {
  /** The bank's material id, or undefined for a material the bank doesn't know (kept as the designer typed it). */
  materialId?: string;
  /** The designer's own name for it (shown when the bank doesn't know it). */
  label: string;
  /** Share of the perfume oil, %. */
  pct: number;
  /** Optional dilution the designer works with (e.g. 10 % in DPG): the active share = pct × dilution / 100. */
  dilution?: number;
}

export interface PerfumeDesign {
  title: string;
  type: PerfumeType;
  /** Perfume oil, % of the finished product. */
  concentration: number;
  bottleMl: number;
  bottles: number;
  /** % of the finished product. */
  water: number;
  fixative: number;
  lines: DesignLine[];
}

export const emptyPerfumeDesign = (): PerfumeDesign => ({ title: '', type: 'edp', concentration: 20, bottleMl: 50, bottles: 1, water: 0, fixative: 0, lines: [] });

/** A line from a typed name (the bank's material when it knows it). */
export function lineFor(label: string, pct: number): DesignLine {
  const m = findPerfumeMaterial(label);
  return m ? { materialId: m.id, label: m.name.en, pct } : { label: label.trim(), pct };
}

// ── The simulation ─────────────────────────────────────────────────────────────────────────────────────────────────
export type Status = 'pass' | 'warn' | 'fail' | 'info';
export interface Check { id: string; status: Status; title: LText; detail: LText; fix?: LText; materialId?: string }
export interface TimePoint { hours: number; intensity: number; layers: Record<Layer, number>; dominant: string[] }
export interface Resemblance { id: string; name: LText; score: number; shared: string[]; kind: 'world' | 'store'; slug?: string; price?: number }
export interface Allergens { inci: string; pct: number; label: boolean }

export interface PerfumeSimulation {
  total: number;
  /** Active share of the oil per line (after the designer's dilutions), normalised to 100. */
  active: { line: DesignLine; material?: PerfumeMaterial; oilPct: number; finishedPct: number }[];
  layers: Record<Layer, number>;
  families: { tag: ScentTag; share: number }[];
  character: LText;
  timeline: TimePoint[];
  longevityHours: number;
  projection: 1 | 2 | 3 | 4 | 5;
  macerationDays: number;
  resemblances: Resemblance[];
  checks: Check[];
  allergens: Allergens[];
  verdict: Exclude<Status, 'info'>;
  /** ml / g / drops for the batch (bottle × bottles). */
  batch: { materialId?: string; label: string; ml: number; grams: number; drops: number }[];
  carrier: { alcoholMl: number; waterMl: number; fixativeMl: number; oilMl: number; totalMl: number };
}

const round = (n: number, d = 2) => Math.round(n * 10 ** d) / 10 ** d;
const UNKNOWN: Pick<PerfumeMaterial, 'layer' | 'tags' | 'life' | 'strength' | 'density'> = { layer: 'heart', tags: [], life: 4, strength: 3, density: 0.95 };
const KEXP = 0.25;
const KTIME = 0.6;
const TIMES = [0, 0.25, 1, 2, 4, 6, 8, 12, 24];
const LAYER_TARGET: Record<Layer, [number, number]> = { top: [15, 30], heart: [30, 50], base: [25, 45] };
const DIFFUSIVE = new Set(['hedione', 'iso_e', 'ambroxan', 'cetalox', 'calone', 'damascenone', 'ethyl_maltol']);

export function simulatePerfume(d: PerfumeDesign, extra: { world?: WorldReference[]; store?: StoreReference[] } = {}): PerfumeSimulation {
  const lines = d.lines.filter((l) => l.pct > 0);
  const total = round(lines.reduce((s, l) => s + l.pct, 0));
  const activeRaw = lines.map((line) => ({ line, material: line.materialId ? perfumeMaterial(line.materialId) : undefined, raw: line.pct * (line.dilution && line.dilution > 0 && line.dilution < 100 ? line.dilution / 100 : 1) }));
  const sum = activeRaw.reduce((s, a) => s + a.raw, 0) || 1;
  // The share of the oil as designed (pct of the written formula); the active matter after dilutions drives the smell.
  const active = activeRaw.map((a) => ({ line: a.line, material: a.material, oilPct: (a.line.pct / (total || 1)) * 100, finishedPct: (a.raw / (total || 1)) * d.concentration, smell: (a.raw / sum) * 100 }));
  const props = (a: (typeof active)[number]) => a.material || UNKNOWN;

  // Pyramid balance (by the written shares).
  const layers: Record<Layer, number> = { top: 0, heart: 0, base: 0 };
  for (const a of active) layers[props(a).layer] += a.oilPct;
  (Object.keys(layers) as Layer[]).forEach((k) => { layers[k] = round(layers[k], 1); });

  // Character: families weighted by share × impact (a strong material colours more than its share).
  const tagWeight = new Map<ScentTag, number>();
  for (const a of active) {
    const p = props(a);
    const w = a.smell * Math.sqrt(p.strength);
    p.tags.forEach((t, i) => tagWeight.set(t, (tagWeight.get(t) || 0) + w * (i === 0 ? 1 : 0.6)));
  }
  const tagSum = [...tagWeight.values()].reduce((s, v) => s + v, 0) || 1;
  const families = [...tagWeight].map(([tag, v]) => ({ tag, share: round((v / tagSum) * 100, 1) })).sort((a, b) => b.share - a.share).slice(0, 6);

  // Timeline: each material emits share × impact × k·e^(−k·t), k = 1/life — the top flashes, the base glows for hours.
  const factor = d.type === 'oil' ? Math.min(1.6, d.concentration / 15) : d.concentration / 18;
  const timeline: TimePoint[] = TIMES.map((hours) => {
    const lay: Record<Layer, number> = { top: 0, heart: 0, base: 0 };
    const per: { id: string; v: number }[] = [];
    for (const a of active) {
      const p = props(a);
      const k = 1 / p.life;
      // What the nose notices at each moment leans on evaporation rate more than the faint skin tail does.
      const v = (a.smell / 100) * p.strength * Math.pow(k, KTIME) * Math.exp(-k * hours) * factor;
      lay[p.layer] += v;
      per.push({ id: a.material?.id || a.line.label, v });
    }
    const intensity = lay.top + lay.heart + lay.base;
    const dominant = per.sort((x, y) => y.v - x.v).filter((x) => x.v > intensity * 0.12).slice(0, 3).map((x) => x.id);
    return { hours, intensity: round(intensity, 3), layers: { top: round(lay.top, 3), heart: round(lay.heart, 3), base: round(lay.base, 3) }, dominant };
  });
  const peak = Math.max(...timeline.map((t) => t.intensity), 0.0001);
  timeline.forEach((t) => { t.intensity = round((t.intensity / peak) * 100, 1); (Object.keys(t.layers) as Layer[]).forEach((k) => { t.layers[k] = round((t.layers[k] / peak) * 100, 1); }); });
  // Staying power: when the scent falls under a skin-perceptible level (calibrated so a balanced 20 % EDP ≈ 7–9 h).
  const absolute = (hours: number) => active.reduce((s, a) => { const p = props(a); const k = 1 / p.life; return s + (a.smell / 100) * p.strength * Math.pow(k, KEXP) * Math.exp(-k * hours) * factor; }, 0);
  let longevityHours = 0;
  for (let h = 0; h <= 48; h += 0.25) { if (absolute(h) >= 0.5) longevityHours = h; else if (h > 0.5) break; }
  // Perceived staying power grows sub-linearly with the raw tail (heavy bases don't last 3× a fresh one on skin).
  longevityHours = round(Math.min(24, 2.2 * Math.pow(longevityHours, 0.55)), 1);
  const early = absolute(0.5);
  const diffusive = active.filter((a) => a.material && DIFFUSIVE.has(a.material.id)).reduce((s, a) => s + a.oilPct, 0);
  const projectionScore = early * 1.2 + (diffusive / 30) * factor;
  const projection = (projectionScore >= 3.2 ? 5 : projectionScore >= 2.2 ? 4 : projectionScore >= 1.3 ? 3 : projectionScore >= 0.6 ? 2 : 1) as PerfumeSimulation['projection'];

  // Maceration: heavier bases, resins, oud and vanilla need longer to marry.
  const heavy = active.filter((a) => a.material && ['oud', 'amber', 'vanilla', 'tonka', 'myrrh', 'patchouli', 'oakmoss', 'evernyl', 'leather', 'tobacco'].includes(a.material.id)).reduce((s, a) => s + a.oilPct, 0);
  const macerationDays = Math.round(Math.min(42, Math.max(d.type === 'mist' || d.type === 'edc' ? 7 : 14, 7 + layers.base * 0.3 + heavy * 0.3)));

  // Allergens in the finished product (EU: labelled above 0.001 % in leave-on products).
  const allergenPct = new Map<Allergen, number>();
  for (const a of active) for (const [k, f] of Object.entries(a.material?.has || {}) as [Allergen, number][]) allergenPct.set(k, (allergenPct.get(k) || 0) + a.finishedPct * f);
  const allergens: Allergens[] = [...allergenPct].map(([k, pct]) => ({ inci: ALLERGEN_INCI[k], pct: round(pct, 4), label: pct > 0.001 })).sort((a, b) => b.pct - a.pct);

  const checks = complianceChecks(d, active, layers, total, allergenPct, allergens);
  const verdict: Exclude<Status, 'info'> = checks.some((c) => c.status === 'fail') ? 'fail' : checks.some((c) => c.status === 'warn') ? 'warn' : 'pass';

  // The batch sheet.
  const totalMl = Math.max(0, d.bottleMl) * Math.max(1, d.bottles);
  const oilMl = totalMl * d.concentration / 100;
  const waterMl = d.type === 'oil' ? 0 : totalMl * d.water / 100;
  const fixativeMl = totalMl * d.fixative / 100;
  const alcoholMl = d.type === 'oil' ? 0 : Math.max(0, totalMl - oilMl - waterMl - fixativeMl);
  const batch = active.map((a) => { const ml = oilMl * a.oilPct / 100; return { materialId: a.material?.id, label: a.line.label, ml: round(ml, 2), grams: round(ml * props(a).density, 2), drops: Math.round(ml / 0.05) }; });

  const resemblances = [...resembleWorld(active, families, extra.world || []), ...resembleStore(active, extra.store || [])];
  return {
    total, active: active.map(({ line, material, oilPct, finishedPct }) => ({ line, material, oilPct: round(oilPct, 2), finishedPct: round(finishedPct, 4) })),
    layers, families, character: characterOf(families, layers, longevityHours), timeline, longevityHours, projection, macerationDays,
    resemblances, checks, allergens, verdict, batch, carrier: { alcoholMl: round(alcoholMl, 1), waterMl: round(waterMl, 1), fixativeMl: round(fixativeMl, 1), oilMl: round(oilMl, 1), totalMl: round(totalMl, 1) },
  };
}

function characterOf(families: { tag: ScentTag; share: number }[], layers: Record<Layer, number>, hours: number): LText {
  if (!families.length) return { ar: 'لسه مفيش مكونات كفاية تتحاكي.', en: 'Not enough materials to simulate yet.' };
  const [a, b, c] = families;
  const ar = [a, b, c].filter(Boolean).map((f) => TAG_LABEL[f.tag].ar);
  const en = [a, b, c].filter(Boolean).map((f) => TAG_LABEL[f.tag].en.toLowerCase());
  const body = layers.base >= 40 ? { ar: 'تقيل وعميق', en: 'rich and deep' } : layers.top >= 35 ? { ar: 'خفيف ومشرق', en: 'light and bright' } : { ar: 'متوازن', en: 'balanced' };
  const last = hours >= 9 ? { ar: 'وثباته قوي', en: 'with strong staying power' } : hours >= 5 ? { ar: 'وثباته متوسط لطويل', en: 'with medium-long staying power' } : { ar: 'وثباته خفيف', en: 'with light staying power' };
  return { ar: `عطر ${ar.join(' – ')}، ${body.ar} ${last.ar}.`, en: `A ${en.join(' – ')} perfume, ${body.en}, ${last.en}.` };
}

function complianceChecks(d: PerfumeDesign, active: { line: DesignLine; material?: PerfumeMaterial; oilPct: number; finishedPct: number }[], layers: Record<Layer, number>, total: number, allergenPct: Map<Allergen, number>, allergens: Allergens[]): Check[] {
  const checks: Check[] = [];
  const n2 = (n: number) => (n >= 1 ? round(n, 2) : round(n, 4));
  // 1. The formula adds up.
  checks.push(Math.abs(total - 100) <= 0.5
    ? { id: 'total', status: 'pass', title: { ar: 'مجموع التركيبة 100%', en: 'The formula adds up to 100%' }, detail: { ar: 'نسب المواد من الزيت العطري مظبوطة.', en: 'The material shares of the perfume oil are consistent.' } }
    : { id: 'total', status: total ? 'warn' : 'fail', title: { ar: `مجموع التركيبة ${total}% مش 100%`, en: `The formula adds up to ${total}%, not 100%` }, detail: { ar: 'المحاكاة بتحسب النسب كأنها اتوزعت على 100%، بس التدوين لازم يبقى دقيق.', en: 'The simulation scales the shares to 100%, but the written formula should be exact.' }, fix: { ar: 'اضغط «اضبط على 100%» في الأدوات.', en: 'Press “Scale to 100%” in the tools.' } });
  // 2. Concentration vs type.
  const [lo, hi] = TYPE_RANGE[d.type];
  checks.push(d.concentration >= lo && d.concentration <= hi
    ? { id: 'type', status: 'pass', title: { ar: 'التركيز مناسب للنوع', en: 'Concentration fits the type' }, detail: { ar: `${d.concentration}% داخل المعتاد لـ${TYPE_LABEL[d.type].ar} (${lo}–${hi}%).`, en: `${d.concentration}% is within the usual ${lo}–${hi}% for ${TYPE_LABEL[d.type].en}.` } }
    : { id: 'type', status: 'warn', title: { ar: 'التركيز مش مطابق للنوع المكتوب', en: 'The concentration does not match the type' }, detail: { ar: `${TYPE_LABEL[d.type].ar} عادة ${lo}–${hi}% زيت، وانت كاتب ${d.concentration}%. ده مش ممنوع، بس الاسم على الزجاجة لازم يوصف الحقيقة.`, en: `${TYPE_LABEL[d.type].en} is usually ${lo}–${hi}% oil; you wrote ${d.concentration}%. Not forbidden, but the label must describe it truthfully.` }, fix: { ar: 'غيّر النوع أو استخدم «حوّل النوع».', en: 'Change the type or use “Convert type”.' } });
  // 3. Alcohol / water.
  if (d.type !== 'oil') {
    if (d.water > 5 && d.concentration >= 15) checks.push({ id: 'water', status: 'warn', title: { ar: 'ماء كتير مع تركيز عالي', en: 'Too much water for a high concentration' }, detail: { ar: `${d.water}% ماء مع ${d.concentration}% زيت غالباً يعكّر العطر أو يفصله.`, en: `${d.water}% water with ${d.concentration}% oil usually clouds or separates the perfume.` }, fix: { ar: 'خلي الماء 0–3% في EDP والإكستريه.', en: 'Keep water at 0–3% in EDP and extrait.' } });
    if (d.concentration + d.water + d.fixative > 100) checks.push({ id: 'carrier', status: 'fail', title: { ar: 'مفيش مكان للكحول', en: 'No room left for the alcohol' }, detail: { ar: 'الزيت + الماء + المثبت أكتر من 100% من الزجاجة.', en: 'Oil + water + fixative exceed 100% of the bottle.' }, fix: { ar: 'قلل الماء أو المثبت.', en: 'Reduce the water or the fixative.' } });
    checks.push({ id: 'flammable', status: 'info', title: { ar: 'سائل قابل للاشتعال (للشحن والتخزين)', en: 'Flammable liquid (shipping and storage)' }, detail: { ar: 'العطر الكحولي مصنف UN1266 فئة 3 — بيتخزن بعيد عن الحرارة وبيتشحن بقواعد المواد الخطرة.', en: 'Alcohol perfume is UN1266, Class 3 — store away from heat; ship under dangerous-goods rules.' } });
  }
  // 4. Pyramid balance (a craft check, not a law).
  const off = (Object.keys(LAYER_TARGET) as Layer[]).filter((k) => layers[k] < LAYER_TARGET[k][0] - 5 || layers[k] > LAYER_TARGET[k][1] + 10);
  checks.push(off.length
    ? { id: 'balance', status: 'warn', title: { ar: 'الهرم مش متوازن', en: 'The pyramid is unbalanced' }, detail: { ar: `${off.map((k) => `${LAYER_LABEL[k].ar} ${layers[k]}% (المعتاد ${LAYER_TARGET[k][0]}–${LAYER_TARGET[k][1]}%)`).join('، ')}.`, en: `${off.map((k) => `${LAYER_LABEL[k].en} ${layers[k]}% (usual ${LAYER_TARGET[k][0]}–${LAYER_TARGET[k][1]}%)`).join(', ')}.` }, fix: { ar: 'اضغط «وازن الهرم» — أو سيبه لو ده مقصود في فكرتك.', en: 'Press “Balance the pyramid” — or keep it if it is intended.' } }
    : { id: 'balance', status: 'pass', title: { ar: 'الهرم متوازن', en: 'The pyramid is balanced' }, detail: { ar: `القمة ${layers.top}% · القلب ${layers.heart}% · القاعدة ${layers.base}%.`, en: `Top ${layers.top}% · heart ${layers.heart}% · base ${layers.base}%.` } });
  // 5. Unknown materials.
  for (const a of active.filter((x) => !x.material)) checks.push({ id: `unknown-${a.line.label}`, status: 'warn', title: { ar: `«${a.line.label}» مش في بنك المعمل`, en: `“${a.line.label}” is not in the lab bank` }, detail: { ar: 'المحاكاة اعتبرته مادة قلب متوسطة، ومفيش بيانات توافق ليه.', en: 'The simulation treats it as an average heart material, with no compliance data.' }, fix: { ar: 'اختار اسمه من القائمة، أو اتأكد من شهادة IFRA بتاعته من المورد.', en: 'Pick it from the list, or check its IFRA certificate with the supplier.' } });
  // 6. IFRA — prohibited and restricted materials.
  for (const a of active) {
    const m = a.material;
    if (!m) continue;
    const swap = m.swap ? perfumeMaterial(m.swap) : undefined;
    const swapText: LText | undefined = swap ? { ar: `استبدله بـ«${swap.name.ar}»`, en: `Replace it with “${swap.name.en}”` } : undefined;
    if (m.ifra?.kind === 'prohibited') {
      checks.push({ id: `ifra-${m.id}`, materialId: m.id, status: 'fail', title: { ar: `«${m.name.ar}» ممنوع`, en: `“${m.name.en}” is prohibited` }, detail: m.ifra.why, fix: swapText || { ar: 'شيله من التركيبة.', en: 'Remove it from the formula.' } });
      continue;
    }
    if (m.ifra && m.ifra.kind === 'restricted') {
      const over = a.finishedPct > m.ifra.limit;
      checks.push({ id: `ifra-${m.id}`, materialId: m.id, status: over ? 'fail' : 'pass', title: over ? { ar: `«${m.name.ar}» فوق حد IFRA`, en: `“${m.name.en}” is above the IFRA limit` } : { ar: `«${m.name.ar}» داخل حد IFRA`, en: `“${m.name.en}” is within the IFRA limit` },
        detail: { ar: `نسبته في المنتج النهائي ${n2(a.finishedPct)}% والحد ${m.ifra.limit}%${m.ifra.conservative ? ' (حد مرجعي محافظ)' : ''} — ${m.ifra.why.ar}.`, en: `${n2(a.finishedPct)}% of the finished product vs. a limit of ${m.ifra.limit}%${m.ifra.conservative ? ' (a conservative reference)' : ''} — ${m.ifra.why.en}.` },
        ...(over ? { fix: { ar: `نزّله لـ${n2(maxOilPct(m.ifra.limit, d.concentration))}% من الزيت أو أقل${swapText ? `، أو ${swapText.ar}` : ''}.`, en: `Lower it to ${n2(maxOilPct(m.ifra.limit, d.concentration))}% of the oil or less${swapText ? `, or ${swapText.en.toLowerCase()}` : ''}.` } } : {}) });
    }
  }
  // 7. IFRA — phototoxic citrus, summed (Σ concentration ÷ limit ≤ 1).
  const photo = active.filter((a) => a.material?.ifra?.kind === 'phototoxic');
  if (photo.length) {
    const ratio = photo.reduce((s, a) => s + a.finishedPct / (a.material!.ifra!.limit), 0);
    const names = photo.map((a) => a.material!.name);
    checks.push(ratio > 1
      ? { id: 'phototoxic', status: 'fail', title: { ar: 'حمضيات بتعمل حساسية للشمس فوق الحد', en: 'Sun-sensitising citrus above the limit' }, detail: { ar: `مجموع ${names.map((x) => `«${x.ar}»`).join(' و')} بالنسبة لحدودها = ${round(ratio, 2)} (لازم ≤ 1) — على الجلد في الشمس ممكن تعمل بقع وحروق.`, en: `${names.map((x) => `“${x.en}”`).join(' + ')} against their limits = ${round(ratio, 2)} (must be ≤ 1) — on sunlit skin they can cause marks and burns.` }, fix: { ar: 'استخدم برغموت FCF بدل المعصور، أو قلل الحمضيات المعصورة — «صلّح التوافق» بيعملها.', en: 'Use FCF bergamot instead of expressed, or reduce the expressed citrus — “Fix compliance” does it.' } }
      : { id: 'phototoxic', status: 'pass', title: { ar: 'الحمضيات داخل حد الحساسية الضوئية', en: 'Citrus within the phototoxicity limit' }, detail: { ar: `المجموع بالنسبة للحدود ${round(ratio, 2)} من 1.`, en: `Summed against the limits: ${round(ratio, 2)} of 1.` } });
  }
  // 8. IFRA — restricted constituents (citral, isoeugenol, coumarin, cinnamal, eugenol) from all materials together.
  for (const [k, rule] of Object.entries(CONSTITUENT_LIMITS) as [Allergen, { limit: number; conservative?: boolean }][]) {
    const pct = allergenPct.get(k) || 0;
    if (pct <= 0) continue;
    const sources = active.filter((a) => a.material?.has?.[k]).sort((x, y) => (y.finishedPct * (y.material!.has![k] || 0)) - (x.finishedPct * (x.material!.has![k] || 0))).map((a) => a.material!.name);
    const over = pct > rule.limit;
    checks.push({ id: `constituent-${k}`, status: over ? 'fail' : 'pass', title: over ? { ar: `${ALLERGEN_INCI[k]} فوق حد IFRA`, en: `${ALLERGEN_INCI[k]} above the IFRA limit` } : { ar: `${ALLERGEN_INCI[k]} داخل الحد`, en: `${ALLERGEN_INCI[k]} within the limit` },
      detail: { ar: `${n2(pct)}% في المنتج النهائي (الحد ${rule.limit}%${rule.conservative ? '، مرجع محافظ' : ''}) — جاي من ${sources.slice(0, 3).map((x) => `«${x.ar}»`).join(' و')}.`, en: `${n2(pct)}% of the finished product (limit ${rule.limit}%${rule.conservative ? ', conservative reference' : ''}) — from ${sources.slice(0, 3).map((x) => `“${x.en}”`).join(', ')}.` },
      ...(over ? { fix: { ar: `قلل ${sources[0] ? `«${sources[0].ar}»` : 'المصدر'} — «صلّح التوافق» بيحسبها.`, en: `Reduce ${sources[0] ? `“${sources[0].en}”` : 'the source'} — “Fix compliance” computes it.` } } : {}) });
  }
  // 9. Labelling: EU allergens above 0.001 % (leave-on).
  const labelled = allergens.filter((x) => x.label);
  checks.push(labelled.length
    ? { id: 'allergens', status: 'info', title: { ar: `${labelled.length} مادة لازم تتكتب على الملصق`, en: `${labelled.length} allergens must be printed on the label` }, detail: { ar: `حسب لائحة الاتحاد الأوروبي 1223/2009 (فوق 0.001% في المنتجات اللي بتفضل على الجلد): ${labelled.map((x) => x.inci).join('، ')}. القائمة اتوسعت بلائحة 2023/1545 للمنتجات الجديدة.`, en: `Under EU Regulation 1223/2009 (above 0.001% in leave-on products): ${labelled.map((x) => x.inci).join(', ')}. Regulation 2023/1545 extends the list for new products.` }, fix: { ar: 'ده مش رفض — بس لازم تكتبهم في المكونات على العبوة.', en: 'Not a rejection — they just must be listed on the pack.' } }
    : { id: 'allergens', status: 'pass', title: { ar: 'مفيش مسببات حساسية فوق حد الملصق', en: 'No allergens above the labelling threshold' }, detail: { ar: 'حسب المواد المعروفة في بنك المعمل.', en: 'As far as the lab bank knows the materials.' } });
  // 10. Material notes (methyl eugenol in rose, limonene oxidation…).
  for (const a of active) if (a.material?.note) checks.push({ id: `note-${a.material.id}`, materialId: a.material.id, status: 'info', title: { ar: `ملاحظة على «${a.material.name.ar}»`, en: `A note on “${a.material.name.en}”` }, detail: a.material.note });
  return checks;
}

/** The most a material may be, as % of the oil, for a finished-product limit at this concentration. */
export const maxOilPct = (limitFinished: number, concentration: number) => (concentration > 0 ? (limitFinished / concentration) * 100 : 100);

// ── «يشبه إيه» ─────────────────────────────────────────────────────────────────────────────────────────────────────
export interface WorldReference { id: string; name: LText; notes: { name: string; pct: number }[] }
export interface StoreReference { slug: string; name: LText; price?: number; notes: string[] }

function resembleWorld(active: { material?: PerfumeMaterial; oilPct: number }[], families: { tag: ScentTag; share: number }[], world: WorldReference[]): Resemblance[] {
  const mine = new Map<string, number>();
  for (const a of active) if (a.material) mine.set(a.material.id, (mine.get(a.material.id) || 0) + a.oilPct);
  if (!mine.size) return [];
  const myTags = new Map(families.map((f) => [f.tag, f.share]));
  return world.map((w): Resemblance | undefined => {
    const theirs = new Map<string, number>();
    for (const n of w.notes) { const ms = materialsIn(n.name); ms.forEach((m) => theirs.set(m.id, (theirs.get(m.id) || 0) + n.pct / ms.length)); }
    if (!theirs.size) return undefined;
    let inter = 0, union = 0;
    for (const id of new Set([...mine.keys(), ...theirs.keys()])) { const a = mine.get(id) || 0, b = theirs.get(id) || 0; inter += Math.min(a, b); union += Math.max(a, b); }
    const tagsTheirs = new Map<ScentTag, number>();
    for (const [id, pct] of theirs) perfumeMaterial(id)!.tags.forEach((t, i) => tagsTheirs.set(t, (tagsTheirs.get(t) || 0) + pct * (i === 0 ? 1 : 0.6)));
    const cos = cosine(myTags, tagsTheirs);
    const score = Math.round((0.55 * (union ? inter / union : 0) + 0.45 * cos) * 100);
    return { id: w.id, name: w.name, score, shared: [...theirs.keys()].filter((id) => mine.has(id)), kind: 'world' };
  }).filter((r): r is Resemblance => Boolean(r && r.score >= 15)).sort((a, b) => b.score - a.score).slice(0, 3);
}

/** Every bank material named in a combined note («Bergamot & Green Apple» → bergamot + apple). */
export function materialsIn(text: string): PerfumeMaterial[] {
  const hits = PERFUME_MATERIALS.filter((m) => m.ifra?.kind !== 'prohibited' && m.names.test(text));
  const best = findPerfumeMaterial(text);
  return hits.filter((m) => !(best && best.id !== m.id && best.swap === m.id) && !(best && m.swap === best.id && best.id !== m.id && !best.names.test(m.name.en)));
}

function resembleStore(active: { material?: PerfumeMaterial; oilPct: number }[], store: StoreReference[]): Resemblance[] {
  const mine = active.filter((a) => a.material?.storeRe).map((a) => ({ id: a.material!.id, re: a.material!.storeRe!, w: a.oilPct }));
  if (mine.length < 2) return [];
  const weight = mine.reduce((s, m) => s + m.w, 0) || 1;
  return store.map((p) => {
    const shared = mine.filter((m) => p.notes.some((n) => m.re.test(n)));
    // Both ways: how much of my formula is in it, and how much of its notes my formula covers.
    const covered = p.notes.filter((n) => mine.some((m) => m.re.test(n))).length / (p.notes.length || 1);
    const score = Math.round((shared.reduce((s, m) => s + m.w, 0) / weight) * 50 + covered * 50);
    return { id: p.slug, slug: p.slug, name: p.name, price: p.price, score, shared: [...new Set(shared.map((m) => m.id))], kind: 'store' as const };
  }).filter((r) => r.shared.length >= 2 && r.score >= 30).sort((a, b) => b.score - a.score).slice(0, 3);
}

function cosine<K>(a: Map<K, number>, b: Map<K, number>): number {
  let dot = 0, na = 0, nb = 0;
  for (const [k, v] of a) { dot += v * (b.get(k) || 0); na += v * v; }
  for (const v of b.values()) nb += v * v;
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}

// ── Creative tools ─────────────────────────────────────────────────────────────────────────────────────────────────
const layerOf = (l: DesignLine): Layer => (l.materialId ? perfumeMaterial(l.materialId)?.layer : undefined) || 'heart';
const tidy = (lines: DesignLine[]) => {
  const out = lines.filter((l) => l.pct > 0.0005).map((l) => ({ ...l, pct: round(l.pct, 2) }));
  const diff = round(100 - out.reduce((s, l) => s + l.pct, 0), 2);
  if (out.length && Math.abs(diff) > 0 && Math.abs(diff) < 1) { const big = out.reduce((a, b) => (b.pct > a.pct ? b : a)); big.pct = round(big.pct + diff, 2); }
  return out;
};

/** «اضبط على 100%»: the same proportions, summing to exactly 100. */
export function scaleTo100(d: PerfumeDesign): PerfumeDesign {
  const total = d.lines.reduce((s, l) => s + Math.max(0, l.pct), 0);
  if (!total) return d;
  return { ...d, lines: tidy(d.lines.map((l) => ({ ...l, pct: (Math.max(0, l.pct) / total) * 100 }))) };
}

/** «وازن الهرم»: each present layer scaled into its classic share (top 22 · heart 43 · base 35), keeping its inner ratios. */
export function balancePyramid(d: PerfumeDesign): PerfumeDesign {
  const target: Record<Layer, number> = { top: 22, heart: 43, base: 35 };
  const present = (Object.keys(target) as Layer[]).filter((k) => d.lines.some((l) => layerOf(l) === k && l.pct > 0));
  if (!present.length) return d;
  const sumTarget = present.reduce((s, k) => s + target[k], 0);
  const lines = d.lines.map((l) => {
    const k = layerOf(l);
    const inLayer = d.lines.filter((x) => layerOf(x) === k).reduce((s, x) => s + x.pct, 0) || 1;
    return { ...l, pct: (l.pct / inLayer) * (target[k] / sumTarget) * 100 };
  });
  return { ...d, lines: tidy(lines) };
}

/**
 * «صلّح التوافق»: prohibited materials swapped for their compliant alternative (or removed), restricted ones brought
 * to 95 % of their limit, phototoxic citrus scaled until their sum is under 1, restricted constituents capped — and
 * the freed share given back to the unrestricted materials of the same layer (else all of them).
 */
export function fixCompliance(d: PerfumeDesign): PerfumeDesign {
  let lines = d.lines.map((l) => ({ ...l }));
  // Prohibited → swap.
  lines = lines.flatMap((l) => {
    const m = l.materialId ? perfumeMaterial(l.materialId) : undefined;
    if (m?.ifra?.kind !== 'prohibited') return [l];
    const swap = m.swap ? perfumeMaterial(m.swap) : undefined;
    return swap ? [{ materialId: swap.id, label: swap.name.en, pct: l.pct }] : [];
  });
  const capOf = (l: DesignLine): number => {
    const m = l.materialId ? perfumeMaterial(l.materialId) : undefined;
    if (!m) return Infinity;
    const caps: number[] = [];
    if (m.ifra?.kind === 'restricted') caps.push(maxOilPct(m.ifra.limit, d.concentration) * 0.95);
    for (const [k, f] of Object.entries(m.has || {}) as [Allergen, number][]) { const rule = CONSTITUENT_LIMITS[k]; if (rule && f > 0) caps.push(maxOilPct(rule.limit / f, d.concentration) * 0.9); }
    return caps.length ? Math.min(...caps) : Infinity;
  };
  for (let pass = 0; pass < 4; pass++) {
    const total = lines.reduce((s, l) => s + l.pct, 0) || 1;
    lines = lines.map((l) => ({ ...l, pct: (l.pct / total) * 100 }));
    let freed = 0;
    const frozen = new Set<number>();
    lines.forEach((l, i) => { const cap = capOf(l); if (l.pct > cap) { freed += l.pct - cap; l.pct = cap; frozen.add(i); } });
    // Phototoxic sum.
    const photo = lines.map((l, i) => ({ l, i, m: l.materialId ? perfumeMaterial(l.materialId) : undefined })).filter((x) => x.m?.ifra?.kind === 'phototoxic');
    const ratio = photo.reduce((s, x) => s + (x.l.pct * d.concentration / 100) / x.m!.ifra!.limit, 0);
    if (ratio > 0.95) { const k = 0.9 / ratio; photo.forEach((x) => { freed += x.l.pct * (1 - k); x.l.pct *= k; frozen.add(x.i); }); }
    if (freed < 0.001) break;
    // Give the freed share back to unrestricted materials (no cap) — same layer first.
    const free = lines.map((l, i) => ({ l, i })).filter((x) => !frozen.has(x.i) && capOf(x.l) === Infinity && !(x.l.materialId && perfumeMaterial(x.l.materialId)?.ifra));
    if (!free.length) break;
    const pool = free.reduce((s, x) => s + x.l.pct, 0) || free.length;
    free.forEach((x) => { x.l.pct += freed * ((x.l.pct || 1) / pool); });
  }
  return { ...d, lines: tidy(lines) };
}

/** «زوّد الثبات»: a base under 30 % gets fixatives (ambroxan, musk, Iso E Super) taken proportionally from the top. */
export function boostLongevity(d: PerfumeDesign): PerfumeDesign {
  const base = d.lines.filter((l) => layerOf(l) === 'base').reduce((s, l) => s + l.pct, 0);
  const add: { id: string; pct: number }[] = [];
  const has = (id: string) => d.lines.some((l) => l.materialId === id);
  const need = Math.max(6, 32 - base);
  if (!has('ambroxan')) add.push({ id: 'ambroxan', pct: Math.min(3, need * 0.25) });
  if (!has('musk')) add.push({ id: 'musk', pct: need * 0.45 });
  if (!has('iso_e')) add.push({ id: 'iso_e', pct: need * 0.3 });
  if (!add.length) return { ...d, lines: tidy(d.lines.map((l) => (layerOf(l) === 'base' ? { ...l, pct: l.pct * 1.15 } : l))) };
  const taking = add.reduce((s, a) => s + a.pct, 0);
  const donors = d.lines.filter((l) => layerOf(l) !== 'base');
  const donorSum = donors.reduce((s, l) => s + l.pct, 0) || 1;
  const lines = d.lines.map((l) => (layerOf(l) !== 'base' ? { ...l, pct: Math.max(0, l.pct - taking * (l.pct / donorSum)) } : l));
  for (const a of add) lines.push({ materialId: a.id, label: perfumeMaterial(a.id)!.name.en, pct: a.pct });
  return scaleTo100({ ...d, lines });
}

/** «حوّل النوع»: the type with its middle concentration (the formula of the oil stays the same). */
export function convertType(d: PerfumeDesign, type: PerfumeType): PerfumeDesign {
  const [lo, hi] = TYPE_RANGE[type];
  return { ...d, type, concentration: round((lo + hi) / 2, 1), water: type === 'oil' ? 0 : type === 'mist' || type === 'edc' ? Math.max(d.water, 5) : Math.min(d.water, 3) };
}

/** «إلهام»: a variation — one material swapped for a close sibling and the shares nudged (deterministic per seed). */
export function inspire(d: PerfumeDesign, seed: number): PerfumeDesign {
  const rnd = mulberry(seed);
  const known = d.lines.map((l, i) => ({ l, i, m: l.materialId ? perfumeMaterial(l.materialId) : undefined })).filter((x) => x.m && x.m.ifra?.kind !== 'prohibited');
  const lines = d.lines.map((l) => ({ ...l, pct: l.pct * (0.85 + rnd() * 0.3) }));
  if (known.length) {
    const pick = known[Math.floor(rnd() * known.length)];
    const used = new Set(d.lines.map((l) => l.materialId));
    const siblings = PERFUME_MATERIALS.filter((m) => !used.has(m.id) && !m.ifra && m.layer === pick.m!.layer && m.tags.some((t) => pick.m!.tags.includes(t)));
    const swap = siblings[Math.floor(rnd() * siblings.length)];
    if (swap) lines[pick.i] = { materialId: swap.id, label: swap.name.en, pct: lines[pick.i].pct };
  }
  return scaleTo100({ ...d, lines });
}

function mulberry(seed: number) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** Starting points: accords a designer can drop in and edit. */
export const PERFUME_STARTERS: { id: string; name: LText; lines: [string, number][] }[] = [
  { id: 'oriental_oud', name: { ar: 'شرقي عود وورد', en: 'Oriental oud & rose' }, lines: [['saffron', 2], ['bergamot', 10], ['cardamom', 4], ['rose', 18], ['jasmine', 5], ['frankincense', 6], ['cashmeran', 4], ['oud', 10], ['amber', 14], ['sandalwood', 12], ['musk', 15]] },
  { id: 'fresh_citrus', name: { ar: 'حمضي منعش صيفي', en: 'Fresh summer citrus' }, lines: [['bergamot', 14], ['lemon', 4], ['grapefruit', 6], ['pink_pepper', 2], ['lavender', 4], ['hedione', 20], ['clary_sage', 4], ['geranium', 4], ['cedar', 12], ['ambroxan', 3], ['musk', 15], ['iso_e', 12]] },
  { id: 'fougere', name: { ar: 'فوجير كلاسيكي', en: 'Classic fougère' }, lines: [['bergamot', 12], ['lavender', 14], ['geranium', 10], ['clary_sage', 6], ['hedione', 10], ['coumarin', 4], ['tonka', 3], ['evernyl', 2], ['vetiver', 8], ['cedar', 12], ['musk', 19]] },
  { id: 'gourmand', name: { ar: 'جورماند فانيليا', en: 'Vanilla gourmand' }, lines: [['mandarin', 12], ['pink_pepper', 3], ['jasmine', 8], ['orange_blossom', 6], ['hedione', 11], ['ethyl_maltol', 2], ['coffee', 5], ['vanilla', 12], ['tonka', 4], ['amber', 12], ['sandalwood', 12], ['musk', 13]] },
  { id: 'white_floral', name: { ar: 'زهري أبيض', en: 'White floral' }, lines: [['neroli', 6], ['mandarin', 10], ['jasmine', 10], ['orange_blossom', 10], ['ylang', 4], ['hedione', 20], ['iris', 4], ['sandalwood', 12], ['musk', 24]] },
];

export const starterDesign = (id: string): PerfumeDesign | undefined => {
  const s = PERFUME_STARTERS.find((x) => x.id === id);
  if (!s) return undefined;
  return scaleTo100({ ...emptyPerfumeDesign(), title: s.name.en, lines: s.lines.map(([mid, pct]) => ({ materialId: mid, label: perfumeMaterial(mid)!.name.en, pct })) });
};
