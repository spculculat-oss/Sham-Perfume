/**
 * «مستشار مصمم التجميل»: suggested edits, the specialist who takes the designer to the product he has in mind, and
 * Shaheen's consultation — all computed from the cosmetic lab's own simulation (see advisorTypes.ts).
 */
import type { LText } from '../../لغات/localize';
import { COSMETIC_CONCERN_TEXT, COSMETIC_PRODUCT_TEXT, COSMETIC_SKIN_TEXT } from '../../لغات/cosmeticsL10n';
import {
  KIND_LABEL, fixCosmeticCompliance, labIngredient, scaleCosmeticTo100, simulateCosmetic, topUpWithWater, type CosmeticArea, type CosmeticDesign,
  type CosmeticKind, type CosmeticSimulation, type LabIngredient,
} from './cosmeticLab';
import { formulateCosmetic, type Concern, type CosmeticProduct, type SkinType } from '../cosmeticFormulator';
import {
  VERDICT_TEXT, clamp, diffLines, gradeOf, msg, round1, verdictRank, type Consultation, type Effect, type GoalPlan, type GoalQuestion, type GoalStep,
  type Msg, type Suggestion,
} from './advisorTypes';

const idOf = (l: CosmeticDesign['lines'][number]) => l.ingredientId;
const ingOf = (l: CosmeticDesign['lines'][number]) => (l.ingredientId ? labIngredient(l.ingredientId) : undefined);
const sameLines = (a: CosmeticDesign, b: CosmeticDesign) => diffLines(a.lines, b.lines, idOf).length === 0 && a.area === b.area && a.rinseOff === b.rinseOff;
const nameOf = (id: string): LText => labIngredient(id)?.name || { ar: id, en: id };
const OILY = new Set<LabIngredient['role']>(['oil', 'butter']);
const SCENT = new Set<LabIngredient['role']>(['essential_oil', 'fragrance']);
const lineOf = (id: string, pct: number) => ({ ingredientId: id, label: labIngredient(id)!.name.en, pct });

/** Add (or raise) an ingredient, taking its share from the water when there is water, else from everything. */
function addIng(d: CosmeticDesign, id: string, pct: number): CosmeticDesign {
  const ing = labIngredient(id)!;
  const to = Math.min(pct, ing.max || pct);
  const has = d.lines.find((l) => l.ingredientId === id);
  const need = to - (has?.pct || 0);
  if (need <= 0) return d;
  const lines = has ? d.lines.map((l) => (l.ingredientId === id ? { ...l, pct: to } : l)) : [...d.lines, lineOf(id, to)];
  const water = lines.find((l) => l.ingredientId === 'water');
  if (water && water.pct - need >= 20) return { ...d, lines: lines.map((l) => (l === water ? { ...l, pct: round1((l.pct - need) * 1000) / 1000 } : l)) };
  return scaleCosmeticTo100({ ...d, lines });
}

function effects(before: CosmeticSimulation, after: CosmeticSimulation): Effect[] {
  const out: Effect[] = [];
  if (before.verdict !== after.verdict) out.push({ label: { ar: 'التوافق', en: 'Compliance' }, from: VERDICT_TEXT[before.verdict], to: VERDICT_TEXT[after.verdict], better: verdictRank(after.verdict) < verdictRank(before.verdict) });
  if (before.kind !== after.kind) out.push({ label: { ar: 'نوع المنتج', en: 'Product type' }, from: KIND_LABEL[before.kind], to: KIND_LABEL[after.kind], better: after.kind !== 'unknown' });
  if (Math.abs(before.texture.score - after.texture.score) >= 5) out.push({ label: { ar: 'القوام من 100', en: 'Texture of 100' }, from: before.texture.score, to: after.texture.score, better: true });
  if (before.shelfMonths[1] !== after.shelfMonths[1]) out.push({ label: { ar: 'الصلاحية (شهور)', en: 'Shelf life (months)' }, from: before.shelfMonths[1], to: after.shelfMonths[1], better: after.shelfMonths[1] > before.shelfMonths[1] });
  const fails = (s: CosmeticSimulation) => s.checks.filter((c) => c.status === 'fail').length;
  if (fails(before) !== fails(after)) out.push({ label: { ar: 'بنود مش مطابقة', en: 'Failing items' }, from: fails(before), to: fails(after), better: fails(after) < fails(before) });
  return out;
}

// ── 1. «تعديل مقترح» ──────────────────────────────────────────────────────────────────────────────────────────────
export function cosmeticSuggestions(d: CosmeticDesign, sim: CosmeticSimulation = simulateCosmetic(d)): Suggestion<CosmeticDesign>[] {
  if (!d.lines.some((l) => l.pct > 0)) return [];
  const out: Omit<Suggestion<CosmeticDesign>, 'design' | 'changes' | 'effects'>[] = [];
  const check = (id: string) => sim.checks.find((c) => c.id === id);
  const hasRole = (role: LabIngredient['role']) => sim.lines.some((x) => x.ing?.role === role && x.pct > 0);
  const watery = sim.water >= 20;

  if (Math.abs(sim.total - 100) > 0.5) out.push({ id: 'total', priority: 100, apply: (x) => (watery || x.lines.some((l) => l.ingredientId === 'water') ? topUpWithWater(x) : scaleCosmeticTo100(x)),
    title: msg(watery ? { ar: 'كمّل لـ 100% بالماء', en: 'Complete to 100% with water' } : { ar: 'كمّل النسب لـ 100%', en: 'Bring the shares to 100%' }),
    why: msg({ ar: 'مجموع التركيبة {n}% — لازم 100 عشان الجرامات تطلع صح.', en: 'The formula adds up to {n}% — it must be 100 for the grams to be right.' }, { n: round1(sim.total) }) });

  if (check('preservative')?.status === 'fail') out.push({ id: 'preservative', priority: 98, apply: (x) => addIng(x, 'preservative', 1),
    title: msg({ ar: 'ضيف {m} 1%', en: 'Add {m} 1%' }, { m: nameOf('preservative') }),
    why: msg({ ar: 'فيه ماء ({n}%) ومفيش حافظة — البكتيريا والفطريات بتبدأ في أيام حتى لو مش باينة. النسبة بتتاخد من الماء.', en: 'There is water ({n}%) and no preservative — bacteria and mould start within days even if unseen. The share comes from the water.' }, { n: round1(sim.water) }) });

  if (check('emulsion')?.status === 'fail') {
    const need = round1(Math.max(3, sim.oil * 0.25));
    const current = sim.lines.find((x) => x.ing?.role === 'emulsifier')?.line.ingredientId;
    const id = current || 'olive_emulsifier';
    out.push({ id: 'emulsion', priority: 96, apply: (x) => addIng(x, id, need),
      title: msg({ ar: 'خلّي {m} {n}%', en: 'Set {m} to {n}%' }, { m: nameOf(id), n: need }),
      why: msg({ ar: 'ماء وزيوت ({oil}%) من غير مستحلب كفاية — الكريم هينفصل لطبقتين. المطلوب حوالي ربع وزن الزيوت.', en: 'Water and oils ({oil}%) without enough emulsifier — it will split into two layers. About a quarter of the oils is needed.' }, { oil: round1(sim.oil) }) });
  }

  if (check('antioxidant')) out.push({ id: 'antioxidant', priority: 70, apply: (x) => addIng(x, 'vitamin_e', 0.5),
    title: msg({ ar: 'ضيف {m} 0.5%', en: 'Add {m} 0.5%' }, { m: nameOf('vitamin_e') }),
    why: msg({ ar: 'فيه زيوت غنية بالأحماض غير المشبعة بتزنخ وريحتها تتغير — فيتامين E بيحميها ويطوّل عمرها.', en: 'Oils rich in unsaturated fats go rancid and change smell — vitamin E protects them and extends their life.' }) });

  const handled = new Set(['total', 'preservative', 'emulsion', 'antioxidant', 'testing', 'allergens', 'fragrance-allergens']);
  const other = sim.checks.filter((c) => (c.status === 'fail' || c.status === 'warn') && !handled.has(c.id));
  if (other.length) out.push({ id: 'compliance', priority: 94, apply: fixCosmeticCompliance,
    title: msg({ ar: 'صلّح التوافق مع لائحة التجميل', en: 'Fix compliance with the cosmetics regulation' }),
    why: msg({ ar: 'فيه {n} بند يحتاج تعديل (مادة ممنوعة أو فوق حدها أو زيوت عطرية كتير). التعديل بيبدّل الممنوع وبينزّل الزيادة تحت الحد.', en: '{n} item(s) need a change (a prohibited ingredient, one over its limit or too much essential oil). The edit swaps the prohibited and brings the excess under the limit.' }, { n: other.length }) });

  if (watery && sim.kind !== 'wash' && !d.rinseOff && !hasRole('humectant')) out.push({ id: 'humectant', priority: 40, apply: (x) => addIng(x, 'glycerin', 3),
    title: msg({ ar: 'ضيف {m} 3%', en: 'Add {m} 3%' }, { m: nameOf('glycerin') }),
    why: msg({ ar: 'منتج مائي يتساب على الجلد ومفيهوش مرطب يشد الماء — الجلسرين بيخلّي الإحساس بالترطيب يدوم.', en: 'A water-based leave-on with no humectant to hold water — glycerin makes the moisture last.' }) });

  if (watery && sim.kind !== 'wash' && !d.lines.some((l) => l.ingredientId === 'phytate')) out.push({ id: 'chelator', priority: 30, apply: (x) => addIng(x, 'phytate', 0.1),
    title: msg({ ar: 'ضيف {m} 0.1%', en: 'Add {m} 0.1%' }, { m: nameOf('phytate') }),
    why: msg({ ar: 'المخلّب بيمسك المعادن اللي في الماء، فالحافظة تشتغل أحسن واللون والريحة مايتغيروش.', en: 'A chelator binds the minerals in water, so the preservative works better and colour and smell stay stable.' }) });

  const scent = sim.lines.filter((x) => x.ing && SCENT.has(x.ing.role)).reduce((s, x) => s + x.pct, 0);
  if (scent > 0 && d.area === 'lips' && !other.some((c) => c.id === 'eo')) out.push({ id: 'lips-scent', priority: 35, apply: (x) => ({ ...x, lines: x.lines.filter((l) => !(ingOf(l) && SCENT.has(ingOf(l)!.role))) }),
    title: msg({ ar: 'شيل العطر من منتج الشفايف', en: 'Remove the scent from the lip product' }),
    why: msg({ ar: 'الشفايف بتتبلع منها كمية بسيطة وبتتهيّج بسرعة — الأفضل من غير زيوت عطرية.', en: 'A little of a lip product is swallowed and lips irritate easily — better without essential oils.' }) });

  return out
    .map((s) => {
      const design = s.apply(d);
      if (sameLines(design, d)) return undefined;
      const after = simulateCosmetic(design);
      if (verdictRank(after.verdict) > verdictRank(sim.verdict)) return undefined;
      return { ...s, design, changes: diffLines(d.lines, design.lines, idOf), effects: effects(sim, after) };
    })
    .filter((s): s is Suggestion<CosmeticDesign> => Boolean(s))
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 6);
}

// ── 2. «متخصص يوصّلك لخلطتك» ──────────────────────────────────────────────────────────────────────────────────────
const PRODUCT_WORDS: [RegExp, CosmeticProduct][] = [
  [/شفايف|شفاه|ليب|lip/i, 'lip_balm'],
  [/غسول|منظف|صابون سائل|شامبو|wash|cleanser|shampoo/i, 'face_wash'],
  [/زيت (لل)?شعر|hair oil/i, 'hair_oil'],
  [/زيت (لل)?(وش|وجه|بشرة)|face oil|facial oil/i, 'face_oil'],
  [/زبدة|بادي بتر|butter/i, 'body_butter'],
  [/سيروم|سيرم|جل|serum|gel/i, 'gel_serum'],
  [/لوشن|lotion/i, 'body_lotion'],
  [/كريم|كريمة|مرطب|cream|moisturi[sz]er/i, 'face_cream'],
];
const SKIN_WORDS: [RegExp, SkinType][] = [
  [/حساس|حساسة|بتتهيج|sensitive/i, 'sensitive'], [/مختلط|مختلطة|combination/i, 'combination'],
  [/دهني|دهنية|بتلمع|oily/i, 'oily'], [/جاف|جافة|ناشف|ناشفة|dry/i, 'dry'],
];
const CONCERN_WORDS: [RegExp, Concern][] = [
  [/ترطيب|يرطب|مرطب|ناشف|جفاف|hydrat|moistur/i, 'hydration'],
  [/تفتيح|بقع|تصبغ|نضارة|نضارة|غمقان|اسمرار|توحيد|bright|glow|spot|pigment|even tone/i, 'glow'],
  [/حبوب|حب الشباب|بثور|مسام|رؤوس سودا|acne|pimple|blemish|pore/i, 'acne'],
  [/تهدئة|تهيج|احمرار|حكة|sooth|redness|calm|itch/i, 'soothing'],
  [/تجاعيد|شيخوخة|خطوط|شد|aging|ageing|wrinkle|fine line|firm/i, 'aging'],
];
/** What each concern adds to an existing formula: [ingredient, %, needs water]. */
const CONCERN_ADD: Record<Concern, [string, number, boolean][]> = {
  hydration: [['hyaluronic', 0.3, true], ['glycerin', 3, true], ['squalane', 5, false]],
  glow: [['niacinamide', 4, true], ['alpha_arbutin', 1, true]],
  acne: [['niacinamide', 4, true], ['zinc_pca', 0.5, true]],
  soothing: [['allantoin', 0.3, true], ['panthenol', 2, true], ['bisabolol', 0.3, false]],
  aging: [['ceramide', 0.5, false], ['vitamin_e', 0.5, false]],
};
const RE = {
  lighter: /خفيف|خفيفة|أخف|اخف|مش تقيل|مش دهني|مايلزقش|سريع الامتصاص|light|lighter|non.?greasy|fast.?absorb/i,
  richer: /تقيل|غني|أتقل|اتقل|للشتا|شتوي|مغذي|rich|richer|heavy|thick|nourish|winter/i,
  noScent: /(من غير|بدون|مش عايز|بلاش)\s*(ريحة|عطر|زيوت عطرية|ريحه)|fragrance.?free|unscented|no (fragrance|scent)/i,
  nutFree: /(من غير|بدون)\s*مكسرات|nut.?free/i,
  vegan: /نباتي|فيجان|vegan/i,
  face: /وش|وجه|face|facial/i, body: /جسم|جسد|body/i, hair: /شعر|hair/i,
};

export interface CosmeticIntent { product?: CosmeticProduct; skin?: SkinType; concerns: Concern[]; lighter: boolean; richer: boolean; noScent: boolean; nutFree: boolean; vegan: boolean; area?: CosmeticArea }

export function readCosmeticGoal(text: string): CosmeticIntent {
  let product = PRODUCT_WORDS.find(([re]) => re.test(text))?.[1];
  const area: CosmeticArea | undefined = RE.hair.test(text) ? 'hair' : RE.body.test(text) ? 'body' : RE.face.test(text) ? 'face' : product === 'lip_balm' ? 'lips' : undefined;
  if (product === 'face_cream' && area === 'body') product = 'body_lotion';
  if ((product === 'face_oil' || (!product && /زيت|oil/i.test(text))) && area === 'hair') product = 'hair_oil';
  if (!product && /زيت|oil/i.test(text)) product = area === 'body' ? undefined : 'face_oil';
  return {
    product, area, skin: SKIN_WORDS.find(([re]) => re.test(text))?.[1],
    concerns: CONCERN_WORDS.filter(([re]) => re.test(text)).map(([, c]) => c).filter((c, i, a) => a.indexOf(c) === i),
    lighter: RE.lighter.test(text), richer: RE.richer.test(text), noScent: RE.noScent.test(text), nutFree: RE.nutFree.test(text), vegan: RE.vegan.test(text),
  };
}

function designOf(product: CosmeticProduct, it: Partial<CosmeticIntent>, base: CosmeticDesign): CosmeticDesign {
  const f = formulateCosmetic({ product, skin: it.skin || 'normal', concerns: it.concerns || [], scent: !it.noScent, nutFree: it.nutFree, vegan: it.vegan, batch: base.batch });
  const area: CosmeticArea = product === 'lip_balm' ? 'lips' : product === 'hair_oil' ? 'hair' : product === 'body_lotion' || product === 'body_butter' ? 'body' : 'face';
  return { ...base, area: it.area && product !== 'lip_balm' ? it.area : area, rinseOff: product === 'face_wash', lines: f.lines.filter((l) => l.pct > 0 && labIngredient(l.id)).map((l) => lineOf(l.id, l.pct)) };
}

export function cosmeticGoal(text: string, current: CosmeticDesign): GoalPlan<CosmeticDesign> {
  const goal = text.trim();
  const it = readCosmeticGoal(goal);
  const understood: Msg[] = [];
  if (it.product) understood.push(msg({ ar: 'المنتج: {p}', en: 'Product: {p}' }, { p: COSMETIC_PRODUCT_TEXT[it.product].name }));
  if (it.skin) understood.push(msg({ ar: 'البشرة: {s}', en: 'Skin: {s}' }, { s: COSMETIC_SKIN_TEXT[it.skin] }));
  if (it.concerns.length) understood.push(msg({ ar: 'الهدف: {c}', en: 'Goal: {c}' }, { c: { ar: it.concerns.map((c) => COSMETIC_CONCERN_TEXT[c].ar).join('، '), en: it.concerns.map((c) => COSMETIC_CONCERN_TEXT[c].en).join(', ') } }));
  if (it.lighter) understood.push(msg({ ar: 'قوام أخف وسريع الامتصاص', en: 'A lighter, fast-absorbing texture' }));
  if (it.richer) understood.push(msg({ ar: 'قوام أغنى ومغذي', en: 'A richer, nourishing texture' }));
  if (it.noScent) understood.push(msg({ ar: 'من غير ريحة', en: 'Fragrance-free' }));
  if (it.nutFree) understood.push(msg({ ar: 'من غير زيوت مكسرات', en: 'Nut-free' }));
  if (it.vegan) understood.push(msg({ ar: 'نباتي بالكامل', en: 'Fully vegan' }));

  const hasCurrent = current.lines.filter((l) => l.pct > 0).length >= 3;
  const anything = Boolean(it.product || it.skin || it.concerns.length || it.lighter || it.richer || it.noScent || it.nutFree || it.vegan);
  if (!goal || !anything || (!it.product && !hasCurrent)) return { understood, questions: cosmeticQuestions(it), steps: [], effects: [] };

  const steps: GoalStep<CosmeticDesign>[] = [];
  let d = current;
  const push = (say: Msg, next: CosmeticDesign) => { if (!sameLines(next, d)) { steps.push({ say, design: next, changes: diffLines(d.lines, next.lines, idOf) }); d = next; } };

  if (it.product) {
    push(msg({ ar: 'بدأت من تركيبة {p} أساسية مجرّبة.', en: 'I started from a proven basic {p} formula.' }, { p: COSMETIC_PRODUCT_TEXT[it.product].name }), designOf(it.product, { area: it.area }, current));
    if (it.skin || it.concerns.length || it.noScent || it.nutFree || it.vegan) push(msg({ ar: 'ظبطت المكونات على طلبك (نوع البشرة والهدف والقيود).', en: 'Adjusted the ingredients to your brief (skin type, goal and limits).' }), designOf(it.product, it, current));
  } else {
    understood.push(msg({ ar: 'هشتغل على تركيبتك الحالية', en: 'I’ll work on your current formula' }));
    const watery = simulateCosmetic(d).water >= 20;
    const concerns = [...it.concerns, ...(it.skin === 'dry' ? ['hydration' as Concern] : it.skin === 'oily' ? ['acne' as Concern] : it.skin === 'sensitive' ? ['soothing' as Concern] : [])];
    for (const c of concerns.filter((x, i, a) => a.indexOf(x) === i)) {
      const adds = CONCERN_ADD[c].filter(([, , w]) => watery || !w).filter(([id]) => !(id === 'alpha_arbutin' && d.area !== 'face'));
      let next = d;
      for (const [id, pct] of adds) next = addIng(next, id, pct);
      push(msg({ ar: 'ضفت {m} عشان {c}.', en: 'Added {m} for {c}.' }, { m: { ar: adds.map(([id]) => nameOf(id).ar).join('، '), en: adds.map(([id]) => nameOf(id).en).join(', ') }, c: COSMETIC_CONCERN_TEXT[c] }), next);
    }
    if (it.noScent) push(msg({ ar: 'شلت العطر والزيوت العطرية.', en: 'Removed the fragrance and essential oils.' }), topUpWithWater({ ...d, lines: d.lines.filter((l) => !(ingOf(l) && SCENT.has(ingOf(l)!.role))) }));
  }
  const sim = simulateCosmetic(d);
  if (it.lighter && sim.water >= 20 && sim.oil > 3) push(msg({ ar: 'قلّلت الزيوت والزبدة بحوالي الثلث (الماء خد مكانهم) عشان القوام يبقى أخف ويتمتص أسرع.', en: 'Cut the oils and butters by about a third (water took their place) for a lighter, faster-absorbing texture.' }),
    topUpWithWater({ ...d, lines: d.lines.map((l) => (ingOf(l) && OILY.has(ingOf(l)!.role) ? { ...l, pct: l.pct * 0.65 } : l)) }));
  if (it.richer && sim.water >= 20 && sim.kind !== 'wash') push(msg({ ar: 'ضفت {m} وزوّدت الزيوت شوية عشان قوام أغنى ومغذي.', en: 'Added {m} and a little more oil for a richer, nourishing texture.' }, { m: nameOf('shea') }),
    addIng({ ...d, lines: d.lines.map((l) => (ingOf(l)?.role === 'oil' ? { ...l, pct: l.pct * 1.3 } : l)) }, 'shea', 4));
  // The craft: whatever the lab says still needs a fix.
  const fixed = fixCosmeticCompliance(d);
  if (simulateCosmetic(d).verdict !== 'pass' && verdictRank(simulateCosmetic(fixed).verdict) <= verdictRank(simulateCosmetic(d).verdict)) push(msg({ ar: 'ظبطت التوافق والسلامة (الحافظة / المستحلب / الحدود) وكمّلت لـ 100%.', en: 'Fixed compliance and safety (preservative / emulsifier / limits) and completed to 100%.' }), fixed);

  const before = simulateCosmetic(current), after = simulateCosmetic(d);
  if (!steps.length) understood.push(msg({ ar: 'تركيبتك أصلاً ماشية مع طلبك — مفيش خطوة لازمة.', en: 'Your formula already matches your request — no step needed.' }));
  return { understood, questions: [], steps, design: steps.length ? d : undefined, effects: steps.length ? effects(before, after) : [] };
}

function cosmeticQuestions(it: CosmeticIntent): GoalQuestion[] {
  const qs: GoalQuestion[] = [];
  if (!it.product) qs.push({ id: 'product', q: msg({ ar: 'عايز تعمل منتج إيه؟', en: 'Which product do you want to make?' }), options: [
    { label: COSMETIC_PRODUCT_TEXT.face_cream.name, add: { ar: 'كريم للوش', en: 'face cream' } },
    { label: COSMETIC_PRODUCT_TEXT.gel_serum.name, add: { ar: 'سيروم', en: 'serum' } },
    { label: COSMETIC_PRODUCT_TEXT.body_lotion.name, add: { ar: 'لوشن للجسم', en: 'body lotion' } },
    { label: COSMETIC_PRODUCT_TEXT.lip_balm.name, add: { ar: 'مرطب شفايف', en: 'lip balm' } },
    { label: COSMETIC_PRODUCT_TEXT.hair_oil.name, add: { ar: 'زيت للشعر', en: 'hair oil' } },
    { label: COSMETIC_PRODUCT_TEXT.face_wash.name, add: { ar: 'غسول', en: 'cleanser' } },
  ] });
  if (!it.skin && !it.concerns.length) qs.push({ id: 'skin', q: msg({ ar: 'لأنهي بشرة أو هدف؟', en: 'For which skin or goal?' }), options: [
    { label: COSMETIC_SKIN_TEXT.dry, add: { ar: 'لبشرة جافة', en: 'for dry skin' } },
    { label: COSMETIC_SKIN_TEXT.oily, add: { ar: 'لبشرة دهنية', en: 'for oily skin' } },
    { label: COSMETIC_SKIN_TEXT.sensitive, add: { ar: 'لبشرة حساسة', en: 'for sensitive skin' } },
    { label: COSMETIC_CONCERN_TEXT.glow, add: { ar: 'للنضارة والتفتيح', en: 'for glow' } },
    { label: COSMETIC_CONCERN_TEXT.aging, add: { ar: 'للخطوط الرفيعة', en: 'for fine lines' } },
  ] });
  return qs;
}

// ── 3. «استشارة شاهين» ────────────────────────────────────────────────────────────────────────────────────────────
const WANTS_EMULSION: CosmeticKind[] = ['cream', 'lotion'];

export function consultCosmetic(d: CosmeticDesign, sim: CosmeticSimulation = simulateCosmetic(d)): Consultation | undefined {
  if (!d.lines.some((l) => l.pct > 0)) return undefined;
  const strengths: Msg[] = [], weaknesses: Msg[] = [], advice: Msg[] = [];
  const check = (id: string) => sim.checks.find((c) => c.id === id);
  const roles = new Set(sim.lines.map((x) => x.ing?.role).filter(Boolean));
  const watery = sim.water >= 20;

  const fails = sim.checks.filter((c) => c.status === 'fail').length, warns = sim.checks.filter((c) => c.status === 'warn').length;
  const safety = clamp(100 - fails * 30 - warns * 8, 0, 100);
  if (!fails && !warns) strengths.push(msg({ ar: 'مطابقة للائحة التجميل الأوروبية في كل البنود اللي بنراجعها.', en: 'Compliant with the EU cosmetics regulation on every item we check.' }));
  if (fails) weaknesses.push(msg({ ar: '{n} بند مش مطابق — لازم يتصلّح قبل ما المنتج يلمس جلد حد.', en: '{n} failing item(s) — must be fixed before it touches anyone’s skin.' }, { n: fails }));
  else if (warns) weaknesses.push(msg({ ar: '{n} ملاحظة تستاهل مراجعة في تبويب «التوافق».', en: '{n} note(s) worth reviewing in the «Compliance» tab.' }, { n: warns }));

  let preservation = 100;
  if (watery) {
    if (check('preservative')?.status === 'pass') strengths.push(msg({ ar: 'محفوظة كويس — مادة حافظة مناسبة للماء اللي فيها.', en: 'Well preserved — a suitable preservative for its water.' }));
    else { preservation = 0; weaknesses.push(msg({ ar: 'فيها ماء ومش محفوظة كفاية — ده أخطر عيب في أي منتج مائي.', en: 'Water without enough preservation — the most serious flaw of any water-based product.' })); }
    if (check('preservative-ph')?.status === 'fail' || check('preservative-ph')?.status === 'warn') preservation = Math.min(preservation, 50);
  } else strengths.push(msg({ ar: 'من غير ماء — مش محتاجة حافظة، وعمرها أطول.', en: 'Water-free — no preservative needed and a longer life.' }));
  if (check('antioxidant')) { preservation -= 25; weaknesses.push(msg({ ar: 'زيوت بتزنخ من غير مضاد أكسدة.', en: 'Oils that go rancid without an antioxidant.' })); }

  let structure = 100;
  if (Math.abs(sim.total - 100) > 0.5) { structure -= 25; weaknesses.push(msg({ ar: 'المجموع {n}% مش 100.', en: 'The total is {n}%, not 100.' }, { n: round1(sim.total) })); }
  if (check('emulsion')?.status === 'fail') { structure -= 50; weaknesses.push(msg({ ar: 'المستحلب مش كفاية — هتنفصل لطبقتين.', en: 'Not enough emulsifier — it will split.' })); }
  else if (WANTS_EMULSION.includes(sim.kind)) strengths.push(msg({ ar: 'المستحلب كفاية — {kind} ثابت ومش هينفصل.', en: 'Enough emulsifier — a stable {kind}.' }, { kind: KIND_LABEL[sim.kind] }));
  if (sim.kind === 'unknown') { structure -= 30; weaknesses.push(msg({ ar: 'نوع المنتج مش واضح من التركيبة — حدّد هل هو كريم ولا جل ولا زيت.', en: 'The product type isn’t clear — decide whether it’s a cream, a gel or an oil.' })); }

  const scent = sim.lines.filter((x) => x.ing && SCENT.has(x.ing.role)).reduce((s, x) => s + x.pct, 0);
  let gentleness = 100;
  if (scent > (d.rinseOff ? 1.5 : d.area === 'face' || d.area === 'lips' ? 0.5 : 1)) { gentleness -= 40; weaknesses.push(msg({ ar: 'زيوت عطرية / عطر {n}% — كتير على الجلد.', en: 'Essential oils / fragrance at {n}% — a lot for skin.' }, { n: round1(scent) })); }
  else if (!scent) strengths.push(msg({ ar: 'من غير عطر — ألطف للبشرة الحساسة.', en: 'Fragrance-free — kinder to sensitive skin.' }));
  if (check('harsh')) gentleness -= 30;

  const goodies = ['active', 'humectant', 'soothing', 'antioxidant'].filter((r) => roles.has(r as LabIngredient['role'])).length;
  const anhydrous = !watery && ['oil', 'balm', 'butter'].includes(sim.kind);
  const oils = new Set(sim.lines.filter((x) => x.ing && OILY.has(x.ing.role)).map((x) => x.ing!.id)).size;
  const efficacy = anhydrous ? clamp(50 + oils * 15 + (roles.has('antioxidant') ? 15 : 0), 0, 100) : clamp([45, 70, 85, 100, 100][goodies], 0, 100);
  if (efficacy >= 85) strengths.push(msg({ ar: 'مكونات فعّالة متنوعة بتشتغل مع بعض.', en: 'Varied active ingredients that work together.' }));
  else if (efficacy < 70) weaknesses.push(anhydrous ? msg({ ar: 'زيت واحد بس — مزج زيتين أو تلاتة بيدّي فايدة وإحساس أحسن.', en: 'Only one oil — two or three oils give better benefit and feel.' }) : msg({ ar: 'التركيبة أساس بس — مفيهاش مكون فعّال واضح (مرطب أو مهدئ أو فعّال).', en: 'Just a base — no clear active (humectant, soother or active).' }));

  const parts = [
    { label: { ar: 'الأمان والتوافق', en: 'Safety & compliance' }, value: safety },
    { label: { ar: 'الحفظ والثبات', en: 'Preservation & stability' }, value: clamp(preservation, 0, 100) },
    { label: { ar: 'البنية والقوام', en: 'Structure & texture' }, value: clamp(structure, 0, 100) },
    { label: { ar: 'اللطف على الجلد', en: 'Gentleness' }, value: clamp(gentleness, 0, 100) },
    { label: { ar: 'الفعالية', en: 'Efficacy' }, value: efficacy },
  ];
  const weights = [0.3, 0.2, 0.2, 0.1, 0.2];
  let score = parts.reduce((s, p, i) => s + p.value * weights[i], 0) / 10;
  if (fails) score = Math.min(score, 4.9);

  if (sim.heatC) advice.push(msg({ ar: 'سخّن المرحلتين لـ {a}–{b} °C وامزجهم وهم في نفس الحرارة، وضيف المرحلة C تحت 40 °C.', en: 'Heat both phases to {a}–{b} °C, mix them at the same temperature, and add phase C below 40 °C.' }, { a: sim.heatC[0], b: sim.heatC[1] }));
  if (sim.ph) advice.push(msg({ ar: 'قيس الـ pH بعد ما تبرد وظبطه بين {a} و{b}.', en: 'Measure the pH once cool and adjust it to {a}–{b}.' }, { a: sim.ph[0], b: sim.ph[1] }));
  advice.push(msg({ ar: 'اعمل اختبار حساسية: حط شوية ورا الودن أو على باطن الدراع 48 ساعة قبل الاستخدام.', en: 'Patch test: a little behind the ear or inside the arm for 48 hours before use.' }));
  advice.push(msg({ ar: 'سيب عيّنة في مكان دافي أسبوعين وراقب الانفصال أو تغيّر اللون والريحة قبل ما تعمل كمية كبيرة.', en: 'Keep a sample somewhere warm for two weeks and watch for splitting or colour/smell changes before a big batch.' }));
  if (weaknesses.length) advice.push(msg({ ar: 'دوس «تعديل مقترح» عشان تشوف تعديلات جاهزة تتطبّق بضغطة لكل نقطة ضعف.', en: 'Press «Suggested edit» to see ready one-click edits for each weak point.' }));

  return { score: round1(clamp(score, 0, 10)), grade: gradeOf(score), parts, strengths, weaknesses, advice };
}
