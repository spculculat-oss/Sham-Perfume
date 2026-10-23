/**
 * «مستشار مصمم العطور»: suggested edits, the specialist who takes the designer to the blend he has in mind, and
 * Shaheen's consultation — all computed from the perfume lab's own simulation (see advisorTypes.ts).
 */
import type { LText } from '../../لغات/localize';
import { TAG_LABEL, perfumeMaterial, type Layer, type PerfumeMaterial, type ScentTag } from './perfumeMaterials';
import {
  LAYER_TARGET, PERFUME_STARTERS, TYPE_LABEL, TYPE_RANGE, balancePyramid, boostLongevity, convertType, fixCompliance, materialsIn, scaleTo100,
  simulatePerfume, starterDesign, type PerfumeDesign, type PerfumeSimulation, type PerfumeType, type WorldReference,
} from './perfumeLab';
import {
  VERDICT_TEXT, clamp, diffLines, gradeOf, msg, round1, verdictRank, type Consultation, type Effect, type GoalPlan, type GoalQuestion, type GoalStep,
  type Msg, type Suggestion,
} from './advisorTypes';

const idOf = (l: PerfumeDesign['lines'][number]) => l.materialId;
const layerOf = (l: PerfumeDesign['lines'][number]): Layer => (l.materialId ? perfumeMaterial(l.materialId)?.layer : undefined) || 'heart';
const sim0 = (d: PerfumeDesign) => simulatePerfume(d);
const sameLines = (a: PerfumeDesign, b: PerfumeDesign) => diffLines(a.lines, b.lines, idOf).length === 0 && a.concentration === b.concentration && a.type === b.type;

/** The staying power a designer expects from each type, hours. */
export const EXPECTED_HOURS: Record<PerfumeType, number> = { extrait: 9, edp: 7, oil: 7, edt: 4, edc: 2, mist: 1.5 };
const EXPECTED_PROJECTION: Record<PerfumeType, number> = { extrait: 3, edp: 3, oil: 2, edt: 3, edc: 2, mist: 2 };
/** Materials that can carry a big share without shouting. */
const SOFT = new Set(['musk', 'galaxolide', 'iso_e', 'hedione', 'cashmeran', 'sandalwood', 'cedar', 'amber']);
const LAYER_WORD: Record<Layer, LText> = { top: { ar: 'الافتتاحية (القمة)', en: 'the opening (top)' }, heart: { ar: 'القلب', en: 'the heart' }, base: { ar: 'القاعدة', en: 'the base' } };

function effects(before: PerfumeSimulation, after: PerfumeSimulation): Effect[] {
  const out: Effect[] = [];
  if (before.verdict !== after.verdict) out.push({ label: { ar: 'التوافق', en: 'Compliance' }, from: VERDICT_TEXT[before.verdict], to: VERDICT_TEXT[after.verdict], better: verdictRank(after.verdict) < verdictRank(before.verdict) });
  if (Math.abs(before.longevityHours - after.longevityHours) >= 0.3) out.push({ label: { ar: 'الثبات (ساعة)', en: 'Staying power (h)' }, from: round1(before.longevityHours), to: round1(after.longevityHours), better: after.longevityHours > before.longevityHours });
  if (before.projection !== after.projection) out.push({ label: { ar: 'الفوحان من 5', en: 'Projection of 5' }, from: before.projection, to: after.projection, better: after.projection > before.projection });
  const dev = (s: PerfumeSimulation) => balanceDeviation(s.layers);
  if (Math.abs(dev(before) - dev(after)) >= 2) out.push({ label: { ar: 'بعد الهرم عن التوازن', en: 'Pyramid off balance' }, from: round1(dev(before)), to: round1(dev(after)), better: dev(after) < dev(before) });
  return out;
}

/** How far the pyramid is outside the classic ranges, in points of the oil. */
export function balanceDeviation(layers: Record<Layer, number>): number {
  return (Object.keys(LAYER_TARGET) as Layer[]).reduce((s, k) => { const [lo, hi] = LAYER_TARGET[k]; const v = layers[k]; return s + (v < lo ? lo - v : v > hi ? v - hi : 0); }, 0);
}

function addMaterial(d: PerfumeDesign, id: string, pct: number): PerfumeDesign {
  const m = perfumeMaterial(id)!;
  const has = d.lines.find((l) => l.materialId === id);
  const lines = has ? d.lines.map((l) => (l.materialId === id ? { ...l, pct: Math.max(l.pct, pct) } : l)) : [...d.lines, { materialId: id, label: m.name.en, pct }];
  const total = lines.reduce((s, l) => s + l.pct, 0);
  // Make room by taking from the others proportionally, so the new share stays what was asked.
  const others = total - (lines.find((l) => l.materialId === id)!.pct);
  const room = 100 - pct;
  return scaleTo100({ ...d, lines: lines.map((l) => (l.materialId === id ? l : { ...l, pct: others > 0 ? (l.pct / others) * room : l.pct })) });
}

function capLine(d: PerfumeDesign, index: number, to: number): PerfumeDesign {
  const freed = d.lines[index].pct - to;
  const rest = d.lines.reduce((s, l, i) => (i === index ? s : s + l.pct), 0) || 1;
  return scaleTo100({ ...d, lines: d.lines.map((l, i) => (i === index ? { ...l, pct: to } : { ...l, pct: l.pct + freed * (l.pct / rest) })) });
}

// ── 1. «تعديل مقترح» ──────────────────────────────────────────────────────────────────────────────────────────────
export function perfumeSuggestions(d: PerfumeDesign, sim: PerfumeSimulation = sim0(d)): Suggestion<PerfumeDesign>[] {
  if (!d.lines.some((l) => l.pct > 0)) return [];
  const out: Omit<Suggestion<PerfumeDesign>, 'design' | 'changes' | 'effects'>[] = [];
  const nameOf = (id: string) => perfumeMaterial(id)!.name;

  if (Math.abs(sim.total - 100) > 0.5) out.push({ id: 'scale', priority: 100, apply: scaleTo100,
    title: msg({ ar: 'كمّل النسب لـ 100%', en: 'Bring the shares to 100%' }),
    why: msg({ ar: 'مجموع نسب الزيت {n}% — المحاكاة بتحسب على النسبة، لكن المعمل محتاج أرقام مجموعها 100 عشان الوزن يطلع صح.', en: 'The oil shares add up to {n}% — the simulation works on ratios, but the lab needs numbers that add up to 100 so the weights come out right.' }, { n: round1(sim.total) }) });

  if (sim.verdict === 'fail') {
    const fails = sim.checks.filter((c) => c.status === 'fail').length;
    out.push({ id: 'compliance', priority: 95, apply: fixCompliance,
      title: msg({ ar: 'صلّح التوافق مع IFRA', en: 'Fix IFRA compliance' }),
      why: msg({ ar: 'فيه {n} بند مش مطابق (مادة ممنوعة أو فوق الحد). التعديل بيبدّل الممنوع بالبديل المسموح وبينزّل المقيّد تحت حدّه، ويوزّع الفرق على باقي المواد.', en: '{n} item(s) fail (a prohibited material or one over its limit). The edit swaps the prohibited for its allowed alternative, brings the restricted under its limit and gives the difference to the other materials.' }, { n: fails }) });
  }

  const [rLo, rHi] = TYPE_RANGE[d.type];
  if (d.concentration < rLo || d.concentration > rHi) {
    const to = round1((rLo + rHi) / 2);
    out.push({ id: 'concentration', priority: 80, apply: (x) => ({ ...x, concentration: to }),
      title: msg({ ar: 'ظبط تركيز الزيت لـ {to}%', en: 'Set the oil concentration to {to}%' }, { to }),
      why: msg({ ar: 'التركيز {n}% بره المعتاد لنوع {type} ({lo}–{hi}%).', en: 'The concentration {n}% is outside the usual range for {type} ({lo}–{hi}%).' }, { n: d.concentration, type: TYPE_LABEL[d.type], lo: rLo, hi: rHi }) });
  }

  // Overdosed strong materials first (they flatten everything), then a big ordinary one.
  sim.active.forEach((a) => {
    const m = a.material;
    if (!m || m.ifra?.kind === 'prohibited') return;
    const i = d.lines.indexOf(a.line);
    if (i < 0) return;
    const limit = m.strength >= 8 ? 10 : m.strength >= 5 ? 22 : SOFT.has(m.id) ? 45 : 32;
    if (a.oilPct > limit + 0.5) {
      const to = round1(m.strength >= 8 ? Math.min(limit, a.oilPct * 0.6) : limit * 0.85);
      out.push({ id: `cap-${m.id}`, priority: m.strength >= 8 ? 85 : 60, apply: (x) => { const j = x.lines.findIndex((l) => l.materialId === m.id); return j < 0 ? x : capLine(x, j, to); },
        title: msg({ ar: 'نزّل «{m}» من {from}% لـ {to}%', en: 'Lower «{m}» from {from}% to {to}%' }, { m: m.name, from: round1(a.oilPct), to }),
        why: m.strength >= 8
          ? msg({ ar: 'مادة قوية جداً (قوتها {s} من 50): فوق {lim}% بتغطي على كل حاجة والعطر يبقى بلون واحد. الفرق بيتوزع على الباقي بنفس نسبهم.', en: 'A very strong material (impact {s} of 50): above {lim}% it covers everything and the perfume turns one-coloured. The difference goes to the rest in their own ratios.' }, { s: m.strength, lim: limit })
          : msg({ ar: 'مادة واحدة واخدة {from}% من الزيت — ده بيخلّي التركيبة على مادة واحدة. تقليلها بيدّي مساحة للباقي يبان.', en: 'One material takes {from}% of the oil — the formula becomes about one material. Lowering it gives the rest room to show.' }, { from: round1(a.oilPct) }) });
    }
  });

  const off = (Object.keys(LAYER_TARGET) as Layer[]).filter((k) => sim.layers[k] < LAYER_TARGET[k][0] - 2 || sim.layers[k] > LAYER_TARGET[k][1] + 2);
  const missingTop = sim.layers.top < 5;
  if (missingTop) {
    out.push({ id: 'add-top', priority: 70, apply: (x) => addMaterial(x, 'bergamot', 10),
      title: msg({ ar: 'زوّد افتتاحية: {m} 10%', en: 'Add an opening: {m} 10%' }, { m: nameOf('bergamot') }),
      why: msg({ ar: 'القمة {n}% بس — أول رشة هتطلع تقيلة ومكتومة. البرغموت الخالي من البيرجابتين بيفتح العطر ومسموح بأي نسبة.', en: 'The top is only {n}% — the first spray will feel heavy and muffled. Bergaptene-free bergamot opens the perfume and has no limit.' }, { n: round1(sim.layers.top) }) });
  } else if (off.length) {
    out.push({ id: 'balance', priority: 65, apply: balancePyramid,
      title: msg({ ar: 'وازن الهرم', en: 'Balance the pyramid' }),
      why: msg({ ar: 'الطبقات دلوقتي: قمة {t}% · قلب {h}% · قاعدة {b}%، والمعتاد قمة 15–30 · قلب 30–50 · قاعدة 25–45. أكتر طبقة بعيدة: {layer}.', en: 'The layers now: top {t}% · heart {h}% · base {b}%; the classic is top 15–30 · heart 30–50 · base 25–45. The furthest off: {layer}.' }, { t: round1(sim.layers.top), h: round1(sim.layers.heart), b: round1(sim.layers.base), layer: LAYER_WORD[off.sort((p, q) => distance(sim, q) - distance(sim, p))[0]] }) });
  }

  if (sim.longevityHours < EXPECTED_HOURS[d.type] - 0.5) out.push({ id: 'longevity', priority: 55, apply: boostLongevity,
    title: msg({ ar: 'زوّد الثبات', en: 'Boost the staying power' }),
    why: msg({ ar: 'الثبات المتوقع حوالي {h} ساعة، والمنتظر من {type} حوالي {exp} ساعة. التعديل بيضيف مثبتات قاعدة (أمبروكسان / مسك / إيزو إي) على حساب القمة والقلب.', en: 'Expected staying power is about {h} h; {type} is expected to last about {exp} h. The edit adds base fixatives (ambroxan / musk / Iso E) at the expense of the top and heart.' }, { h: round1(sim.longevityHours), exp: EXPECTED_HOURS[d.type], type: TYPE_LABEL[d.type] }) });

  if (sim.projection <= 2 && d.type !== 'oil' && d.type !== 'mist' && !d.lines.some((l) => l.materialId === 'hedione')) out.push({ id: 'projection', priority: 45, apply: (x) => addMaterial(x, 'hedione', 8),
    title: msg({ ar: 'زوّد الفوحان: {m} 8%', en: 'Lift the projection: {m} 8%' }, { m: nameOf('hedione') }),
    why: msg({ ar: 'الفوحان {p} من 5 — العطر هيفضل قريب من الجلد. الهيديون بيدّي إشراقة وانتشار من غير ما يغيّر الطابع.', en: 'Projection is {p} of 5 — it will stay close to the skin. Hedione adds radiance and diffusion without changing the character.' }, { p: sim.projection }) });

  const unknown = d.lines.filter((l) => !l.materialId && l.pct > 0);
  if (unknown.length) {
    const swaps = unknown.map((l) => ({ l, m: findClosest(l.label) })).filter((x) => x.m);
    if (swaps.length) out.push({ id: 'unknown', priority: 40, apply: (x) => ({ ...x, lines: x.lines.map((l) => { const s = !l.materialId && findClosest(l.label); return s ? { materialId: s.id, label: s.name.en, pct: l.pct } : l; }) }),
      title: msg({ ar: 'عرّف المواد الغريبة للبنك', en: 'Match unknown materials to the bank' }),
      why: msg({ ar: 'فيه {n} مادة البنك مش عارفها، فالمحاكاة مش بتحسب ثباتها ولا حدودها صح. لقيت أقرب مادة معروفة لكل واحدة.', en: '{n} material(s) are unknown to the bank, so their staying power and limits aren’t simulated. I found the closest known material for each.' }, { n: swaps.length }) });
  }

  return out
    .map((s) => {
      const design = s.apply(d);
      if (sameLines(design, d)) return undefined;
      const after = sim0(design);
      // Never offer an edit that makes the formula less compliant.
      if (verdictRank(after.verdict) > verdictRank(sim.verdict)) return undefined;
      return { ...s, design, changes: diffLines(d.lines, design.lines, idOf), effects: effects(sim, after) };
    })
    .filter((s): s is Suggestion<PerfumeDesign> => Boolean(s))
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 6);
}

const distance = (sim: PerfumeSimulation, k: Layer) => { const [lo, hi] = LAYER_TARGET[k]; const v = sim.layers[k]; return v < lo ? lo - v : v > hi ? v - hi : 0; };
function findClosest(label: string): PerfumeMaterial | undefined { return materialsIn(label)[0]; }

/** «طبّق الكل»: the edits one after another, each on the result of the one before. */
export function applyAll<D>(d: D, suggestions: Suggestion<D>[]): D { return suggestions.reduce((x, s) => s.apply(x), d); }

// ── 2. «متخصص يوصّلك لخلطتك» ──────────────────────────────────────────────────────────────────────────────────────
const TAG_WORDS: [RegExp, ScentTag[]][] = [
  [/حمض|ليمون|برتقال|يوسف|سيترس|citrus|lemon|orange|zesty/i, ['citrus', 'fresh']],
  [/منعش|فريش|انتعاش|fresh|refresh/i, ['fresh']],
  [/بحر|مائي|محيط|aquatic|marine|ocean|sea\b/i, ['aquatic', 'fresh']],
  [/أخضر|اخضر|عشب|ورق شجر|green|herbal|grassy/i, ['green']],
  [/عطري|لافند|خزام|aromatic|lavender/i, ['aromatic']],
  [/فوجير|fougere|fougère|barbershop/i, ['fougere', 'aromatic']],
  [/زهر|ورود|فلورال|floral|flower/i, ['floral']],
  [/ورد|rose/i, ['rose', 'floral']],
  [/ياسمين|فل\b|فلّ|زهور بيضا|white floral|jasmine|tuberose/i, ['white', 'floral']],
  [/بودر|بودي|ناعم زي البودرة|powder/i, ['powdery']],
  [/حلو|سكر|جورماند|فانيل|كراميل|sweet|gourmand|vanilla|caramel|candy/i, ['sweet', 'gourmand']],
  [/قهوة|coffee/i, ['gourmand']],
  [/فاكه|فواكه|تفاح|fruity|fruit|apple/i, ['fruity']],
  [/توابل|بهار|حار|حرّاق|spicy|spice|pepper|cinnamon/i, ['spicy']],
  [/دافي|دافئ|دفا|warm|cozy/i, ['warm']],
  [/خشب|woody|wood/i, ['woody']],
  [/صندل|sandal/i, ['woody', 'creamy']],
  [/عود|oud/i, ['oud']],
  [/عنبر|امبر|amber/i, ['amber', 'warm']],
  [/شرقي|عربي|خليجي|oriental|arabian/i, ['oriental', 'amber']],
  [/بخور|لبان|مستكة|incense|frankincense/i, ['incense']],
  [/دخان|مدخن|تبغ|معسل|smoky|smoke|tobacco/i, ['smoky']],
  [/جلد|leather/i, ['leather']],
  [/مسك|musk/i, ['musky']],
  [/نظيف|صابون|غسيل|clean|soapy|laundry/i, ['clean', 'musky']],
  [/تراب|أرض|باتشول|earthy|patchouli/i, ['earthy']],
  [/كريمي|creamy/i, ['creamy']],
];

const TAG_PICK: Record<ScentTag, string[]> = {
  citrus: ['bergamot', 'mandarin', 'lemongrass'], fresh: ['bergamot', 'hedione', 'lavender'], aromatic: ['lavender', 'clary_sage', 'cardamom'],
  aquatic: ['calone'], green: ['clary_sage', 'violet', 'lemongrass'], spicy: ['pink_pepper', 'cardamom', 'black_pepper'], warm: ['amber', 'tonka'],
  floral: ['jasmine', 'rose', 'orange_blossom'], white: ['jasmine', 'orange_blossom', 'ylang'], rose: ['rose', 'geranium'], powdery: ['iris', 'violet'],
  sweet: ['vanilla', 'tonka', 'mandarin'], gourmand: ['vanilla', 'tonka', 'coffee'], woody: ['sandalwood', 'cedar', 'vetiver'], oud: ['oud'],
  amber: ['amber', 'ambroxan'], oriental: ['amber', 'rose', 'cardamom'], incense: ['frankincense', 'myrrh'], smoky: ['frankincense', 'vetiver', 'tobacco'],
  leather: ['leather', 'saffron'], musky: ['musk'], clean: ['musk', 'hedione'], earthy: ['patchouli', 'vetiver'], balsamic: ['amber', 'myrrh'],
  fruity: ['apple', 'pink_pepper', 'mandarin'], fougere: ['lavender', 'coumarin', 'geranium'], creamy: ['sandalwood'],
};
/** Families that read as «heavy» — lightened first when the designer wants it lighter. */
const HEAVY: ScentTag[] = ['oud', 'leather', 'smoky', 'gourmand', 'balsamic', 'earthy'];
const RE = {
  lighter: /أخف|اخف|خفيف|خفيفه|خفيفة|هادي|هاديه|هادية|light|lighter|soft|subtle|airy/i,
  stronger: /أقوى|اقوى|أتقل|اتقل|أثقل|تقيل|فواح|فوّاح|ثابت|أثبت|اثبت|ثبات|يثبت|يعيش|strong|heavier|long.?last|longevity|beast|projection|loud|lasting/i,
  summer: /صيف|حر\b|الحر|summer|hot weather/i,
  winter: /شتا|شتوي|شتاء|برد|winter|cold weather/i,
  night: /سهر|سهرة|بالليل|مسائي|evening|night|date/i,
  day: /شغل|مكتب|يومي|نهار|جامعة|office|work|daily|everyday|day\b/i,
  men: /رجالي|رجال|للرجل|شباب|men\b|male|masculine|for him/i,
  women: /حريمي|نسائي|ستات|بنات|للبنت|women|female|feminine|for her/i,
  modify: /خلّي|خلي|خليه|خليها|زوّد|زود|ضيف|قلّل|قلل|شيل|غيّر|غير|عدّل|عدل|نفس|بتاعتي|تركيبتي|make it|add|remove|more|less|keep/i,
  except: /(?:من غير|بدون|مش عايز|ماعدا|ما عدا|بلاش|without|except|\bno\b|not)\s+([^،,.؛;!?؟]+)/gi,
  like: /(?:زي|شبه|يشبه|قريب من|على طريقة|like|similar to|close to|inspired by)\s+([^،,.؛;!?؟]+)/i,
};
const TYPE_WORDS: [RegExp, PerfumeType][] = [
  [/إكستري|اكستري|اكسترا|extrait|parfum\b/i, 'extrait'], [/او دو بارفان|أو دو بارفان|بارفان|edp|eau de parfum/i, 'edp'],
  [/تواليت|edt|eau de toilette/i, 'edt'], [/كولونيا|edc|cologne/i, 'edc'], [/بخاخ جسم|ميست|mist|body spray/i, 'mist'], [/زيتي|دهن|بدون كحول|oil\b|alcohol.?free/i, 'oil'],
];
const STOP = new Set(['accord', 'perfume', 'parfum', 'eau', 'pour', 'homme', 'femme', 'intense', 'maison', 'مستوحى', 'من', 'عطر', 'ريحة', 'بارفان']);

export interface PerfumeIntent {
  tags: ScentTag[];
  materials: string[];
  excludeTags: ScentTag[];
  excludeMaterials: string[];
  lighter: boolean;
  stronger: boolean;
  season?: 'summer' | 'winter';
  time?: 'day' | 'night';
  gender?: 'men' | 'women';
  type?: PerfumeType;
  like?: WorldReference;
  modify: boolean;
}

function tagsIn(text: string): ScentTag[] { const s = new Set<ScentTag>(); for (const [re, tags] of TAG_WORDS) if (re.test(text)) tags.forEach((t) => s.add(t)); return [...s]; }

function worldMatch(text: string, world: WorldReference[], need: number): WorldReference | undefined {
  const t = text.toLowerCase();
  let best: { w: WorldReference; hits: number } | undefined;
  for (const w of world) {
    const words = `${w.name.en} ${w.name.ar}`.toLowerCase().replace(/[()\-–:·]/g, ' ').split(/\s+/).filter((x) => x.length >= 4 && !STOP.has(x));
    const hits = new Set(words.filter((x) => t.includes(x))).size;
    if (hits >= need && (!best || hits > best.hits)) best = { w, hits };
  }
  return best?.w;
}

/** What the designer wants, read from his own words (Arabic, Egyptian or English). */
export function readPerfumeGoal(text: string, world: WorldReference[] = []): PerfumeIntent {
  const excludeTags = new Set<ScentTag>(), excludeMaterials = new Set<string>();
  let rest = text;
  for (const m of text.matchAll(RE.except)) {
    tagsIn(m[1]).forEach((t) => excludeTags.add(t));
    materialsIn(m[1]).forEach((x) => excludeMaterials.add(x.id));
    rest = rest.replace(m[0], ' ');
  }
  const likeText = RE.like.exec(rest)?.[1] || '';
  const like = likeText ? worldMatch(likeText, world, 1) : worldMatch(rest, world, 2);
  const season = RE.summer.test(rest) ? 'summer' : RE.winter.test(rest) ? 'winter' : undefined;
  const time = RE.night.test(rest) ? 'night' : RE.day.test(rest) ? 'day' : undefined;
  const gender = RE.men.test(rest) ? 'men' : RE.women.test(rest) ? 'women' : undefined;
  const type = TYPE_WORDS.find(([re]) => re.test(rest))?.[1];
  const tags = like ? [] : tagsIn(rest).filter((t) => !excludeTags.has(t));
  const materials = like ? [] : materialsIn(rest).map((m) => m.id).filter((id) => !excludeMaterials.has(id));
  return {
    tags, materials, excludeTags: [...excludeTags], excludeMaterials: [...excludeMaterials],
    lighter: RE.lighter.test(rest) && !/مش خفيف|not light/i.test(rest), stronger: RE.stronger.test(rest), season, time, gender, type, like, modify: RE.modify.test(rest),
  };
}

const SEASON_TEXT = { summer: { ar: 'للصيف', en: 'for summer' }, winter: { ar: 'للشتا', en: 'for winter' } } as const;
const TIME_TEXT = { day: { ar: 'للنهار والشغل', en: 'for day and work' }, night: { ar: 'للسهرة', en: 'for the evening' } } as const;
const GENDER_TEXT = { men: { ar: 'رجالي', en: 'masculine' }, women: { ar: 'حريمي', en: 'feminine' } } as const;

/** How much of the formula speaks the wanted families, 0–100. */
function matchOf(sim: PerfumeSimulation, want: ScentTag[], avoid: ScentTag[]): number {
  if (!want.length && !avoid.length) return 0;
  const share = (t: ScentTag) => sim.families.find((f) => f.tag === t)?.share || 0;
  const got = want.length ? want.reduce((s, t) => s + Math.min(1, share(t) / 15), 0) / want.length : 1;
  const bad = avoid.reduce((s, t) => s + share(t), 0);
  return Math.round(clamp(got * 100 - bad * 2, 0, 100));
}

export function perfumeGoal(text: string, current: PerfumeDesign, world: WorldReference[] = []): GoalPlan<PerfumeDesign> {
  const goal = text.trim();
  const it = readPerfumeGoal(goal, world);
  const understood: Msg[] = [];
  const empty: GoalPlan<PerfumeDesign> = { understood, questions: [], steps: [], effects: [] };
  if (it.like) understood.push(msg({ ar: 'عايز ريحة قريبة من «{name}»', en: 'You want something close to «{name}»' }, { name: it.like.name }));
  if (it.tags.length) understood.push(msg({ ar: 'الطابع: {tags}', en: 'Character: {tags}' }, { tags: joinTags(it.tags) }));
  if (it.materials.length) understood.push(msg({ ar: 'مواد لازم تبقى موجودة: {m}', en: 'Materials to keep in: {m}' }, { m: joinNames(it.materials) }));
  if (it.excludeTags.length || it.excludeMaterials.length) understood.push(msg({ ar: 'من غير: {x}', en: 'Without: {x}' }, { x: [joinTags(it.excludeTags), joinNames(it.excludeMaterials)].filter((s) => s.ar).reduce((a, b) => ({ ar: `${a.ar}، ${b.ar}`, en: `${a.en}, ${b.en}` })) }));
  if (it.lighter) understood.push(msg({ ar: 'أخف وأهدى', en: 'Lighter and softer' }));
  if (it.stronger) understood.push(msg({ ar: 'أثبت وأفوح', en: 'Longer-lasting, more projection' }));
  if (it.season) understood.push(msg(SEASON_TEXT[it.season]));
  if (it.time) understood.push(msg(TIME_TEXT[it.time]));
  if (it.gender) understood.push(msg(GENDER_TEXT[it.gender]));
  if (it.type) understood.push(msg({ ar: 'النوع: {type}', en: 'Type: {type}' }, { type: TYPE_LABEL[it.type] }));

  const hasCurrent = current.lines.filter((l) => l.pct > 0).length >= 3;
  const clear = Boolean(it.like || it.tags.length || it.materials.length || it.excludeMaterials.length || it.excludeTags.length || it.season || it.time || it.gender);
  const tweakOnly = !clear && (it.lighter || it.stronger || it.type);
  if (!goal || (!clear && !(tweakOnly && hasCurrent))) return { ...empty, questions: perfumeQuestions(it) };

  // The wanted families: what he said, else what the season / time / gender suggest.
  const want = new Set<ScentTag>(it.tags);
  if (!want.size && !it.like && !(tweakOnly && hasCurrent)) {
    if (it.season === 'summer') ['citrus', 'fresh'].forEach((t) => want.add(t as ScentTag));
    if (it.season === 'winter') ['amber', 'warm'].forEach((t) => want.add(t as ScentTag));
    if (it.time === 'day') ['fresh', 'clean'].forEach((t) => want.add(t as ScentTag));
    if (it.time === 'night') ['amber', 'oriental'].forEach((t) => want.add(t as ScentTag));
    if (it.gender === 'men') ['woody', 'aromatic'].forEach((t) => want.add(t as ScentTag));
    if (it.gender === 'women') ['floral'].forEach((t) => want.add(t as ScentTag));
  } else if (it.season === 'summer' && !it.stronger) want.add('fresh');
  const avoid = [...it.excludeTags];
  const wantList = [...want].filter((t) => !avoid.includes(t));
  const lighter = it.lighter || (it.season === 'summer' && !it.stronger) || (it.time === 'day' && !it.stronger);

  const steps: GoalStep<PerfumeDesign>[] = [];
  let d: PerfumeDesign = current;
  const push = (say: Msg, next: PerfumeDesign) => { if (!sameLines(next, d) || next.type !== d.type) { steps.push({ say, design: next, changes: diffLines(d.lines, next.lines, idOf) }); d = next; } };

  // Step 1 — where to start from.
  const currentSim = sim0(current);
  const fits = hasCurrent && (it.modify || tweakOnly || wantList.some((t) => currentSim.families.slice(0, 4).some((f) => f.tag === t)));
  if (it.like) {
    const lines = new Map<string, number>();
    for (const n of it.like.notes) { const ms = materialsIn(n.name); ms.forEach((m) => lines.set(m.id, (lines.get(m.id) || 0) + n.pct / ms.length)); }
    if (lines.size >= 3) push(msg({ ar: 'بنيت الأساس على نوتات «{name}» من مكتبة عطور العالم (تشابه مش نسخة).', en: 'I built the base on the notes of «{name}» from the world library (a resemblance, not a copy).' }, { name: it.like.name }),
      scaleTo100({ ...current, title: current.title, lines: [...lines].map(([id, pct]) => ({ materialId: id, label: perfumeMaterial(id)!.name.en, pct })) }));
  } else if (!fits) {
    const starter = bestStarter(wantList, avoid);
    if (starter) push(msg({ ar: 'تركيبتك الحالية بعيدة عن الهدف، فبدأت من نقطة بداية «{name}» لأنها أقرب طابع.', en: 'Your current formula is far from the goal, so I started from «{name}», the closest character.' }, { name: starter.name }),
      { ...starterDesign(starter.id)!, title: current.title, type: current.type, concentration: current.concentration, bottleMl: current.bottleMl, bottles: current.bottles, water: current.water, fixative: current.fixative });
  } else if (hasCurrent) {
    understood.push(msg({ ar: 'هشتغل على تركيبتك الحالية', en: 'I’ll work on your current formula' }));
  }

  // Step 2 — take out what he doesn't want.
  const drop = d.lines.filter((l) => { const m = l.materialId ? perfumeMaterial(l.materialId) : undefined; return m && (it.excludeMaterials.includes(m.id) || m.tags.slice(0, 2).some((t) => avoid.includes(t))); });
  if (drop.length) push(msg({ ar: 'شلت {m} زي ما طلبت.', en: 'Removed {m} as you asked.' }, { m: joinNames(drop.map((l) => l.materialId!)) }), scaleTo100({ ...d, lines: d.lines.filter((l) => !drop.includes(l)) }));

  // Step 3 — the materials he named.
  for (const id of it.materials) {
    if (d.lines.some((l) => l.materialId === id)) continue;
    const m = perfumeMaterial(id)!;
    push(msg({ ar: 'ضفت «{m}» {n}% لأنك طلبتها بالاسم.', en: 'Added «{m}» {n}% because you named it.' }, { m: m.name, n: amountFor(m) }), addMaterial(d, id, amountFor(m)));
  }

  // Step 4 — the families that are still weak.
  let added = 0;
  const used = new Set<string>(it.materials);
  for (const t of wantList) {
    if (added >= 3) break;
    // A material he named already speaks for its families.
    if (it.materials.some((id) => perfumeMaterial(id)!.tags.slice(0, 2).includes(t))) continue;
    const share = sim0(d).families.find((f) => f.tag === t)?.share || 0;
    if (share >= 12) continue;
    const pick = TAG_PICK[t].map((id) => perfumeMaterial(id)!).find((m) => m && !used.has(m.id) && !it.excludeMaterials.includes(m.id) && !m.tags.some((x) => avoid.includes(x)) && !(lighter && HEAVY.includes(m.tags[0]) && !HEAVY.includes(t)));
    if (pick) used.add(pick.id);
    if (!pick) continue;
    const has = d.lines.find((l) => l.materialId === pick.id);
    const to = round1(Math.max(amountFor(pick), (has?.pct || 0) * 1.6));
    push(has
      ? msg({ ar: 'زوّدت «{m}» لـ {n}% عشان طابع {tag} يبان (كان {share}% بس).', en: 'Raised «{m}» to {n}% so the {tag} side shows (it was only {share}%).' }, { m: pick.name, n: to, tag: TAG_LABEL[t], share: Math.round(share) })
      : msg({ ar: 'ضفت «{m}» {n}% عشان طابع {tag}.', en: 'Added «{m}» {n}% for the {tag} side.' }, { m: pick.name, n: to, tag: TAG_LABEL[t] }), addMaterial(d, pick.id, to));
    added++;
  }

  // Step 5 — weight: lighter or stronger.
  if (lighter && !it.stronger) {
    const heavy = d.lines.filter((l) => { const m = l.materialId ? perfumeMaterial(l.materialId) : undefined; return m && !used.has(m.id) && !wantList.includes(m.tags[0]) && (m.tags.slice(0, 2).some((t) => HEAVY.includes(t)) || (m.layer === 'base' && m.strength >= 5)); });
    if (heavy.length) push(msg({ ar: 'خففت المواد التقيلة ({m}) بحوالي الثلث عشان الريحة تبقى أخف.', en: 'Eased the heavy materials ({m}) by about a third so it reads lighter.' }, { m: joinNames(heavy.map((l) => l.materialId!)) }),
      scaleTo100({ ...d, lines: d.lines.map((l) => (heavy.includes(l) ? { ...l, pct: l.pct * 0.65 } : l)) }));
    const [lo] = TYPE_RANGE[d.type];
    if (!it.type && d.type === 'extrait') push(msg({ ar: 'حوّلت النوع لـ {type} — أنسب للخفة.', en: 'Changed the type to {type} — better for a light scent.' }, { type: TYPE_LABEL.edp }), convertType(d, 'edp'));
    else if (!it.type && d.type === 'edp' && it.season === 'summer') push(msg({ ar: 'حوّلت النوع لـ {type} — الصيف عايز تركيز أقل.', en: 'Changed the type to {type} — summer wants a lower concentration.' }, { type: TYPE_LABEL.edt }), convertType(d, 'edt'));
    else if (d.concentration > lo + 1) push(msg({ ar: 'نزّلت تركيز الزيت لـ {n}%.', en: 'Lowered the oil concentration to {n}%.' }, { n: lo + 1 }), { ...d, concentration: lo + 1 });
  }
  if (it.stronger) {
    const boosted = boostLongevity(d);
    push(msg({ ar: 'قوّيت القاعدة بمثبتات (أمبروكسان / مسك / إيزو إي) عشان الثبات.', en: 'Strengthened the base with fixatives (ambroxan / musk / Iso E) for staying power.' }), boosted);
    const [, hi] = TYPE_RANGE[d.type];
    if (d.concentration < hi - 1 && !it.type) push(msg({ ar: 'رفعت تركيز الزيت لـ {n}%.', en: 'Raised the oil concentration to {n}%.' }, { n: hi - 1 }), { ...d, concentration: hi - 1 });
  }
  if (it.type && it.type !== d.type) push(msg({ ar: 'حوّلت النوع لـ {type} زي ما طلبت.', en: 'Changed the type to {type} as you asked.' }, { type: TYPE_LABEL[it.type] }), convertType(d, it.type));

  // Step 6 — the craft: pyramid and compliance.
  if (!it.stronger && !lighter && balanceDeviation(sim0(d).layers) > 8) push(msg({ ar: 'وازنت الهرم (قمة / قلب / قاعدة) عشان الريحة تتطور صح.', en: 'Balanced the pyramid (top / heart / base) so the scent unfolds properly.' }), balancePyramid(d));
  if (sim0(d).verdict === 'fail') push(msg({ ar: 'ظبطت التوافق مع IFRA (بدّلت الممنوع ونزّلت المقيّد تحت حده).', en: 'Fixed IFRA compliance (swapped the prohibited, brought the restricted under its limit).' }), fixCompliance(d));

  const before = sim0(current), after = sim0(d);
  if (!steps.length) understood.push(msg({ ar: 'تركيبتك أصلاً قريبة من اللي طالبه — مفيش خطوة لازمة.', en: 'Your formula is already close to what you want — no step needed.' }));
  return {
    understood, questions: [], steps,
    design: steps.length ? d : undefined,
    match: wantList.length || avoid.length ? { from: matchOf(before, wantList, avoid), to: matchOf(after, wantList, avoid) } : undefined,
    effects: steps.length ? effects(before, after) : [],
  };
}

function perfumeQuestions(it: PerfumeIntent): GoalQuestion[] {
  const qs: GoalQuestion[] = [];
  if (!it.tags.length && !it.like) qs.push({ id: 'family', q: msg({ ar: 'عايز الريحة طابعها إيه؟', en: 'Which character do you want?' }), options: [
    { label: { ar: 'شرقي عود وعنبر', en: 'Oriental oud & amber' }, add: { ar: 'شرقي عود وعنبر', en: 'oriental oud and amber' } },
    { label: { ar: 'منعش حمضي', en: 'Fresh citrus' }, add: { ar: 'منعش حمضي', en: 'fresh citrus' } },
    { label: { ar: 'زهري ورد وياسمين', en: 'Floral rose & jasmine' }, add: { ar: 'زهري ورد وياسمين', en: 'floral rose and jasmine' } },
    { label: { ar: 'خشبي', en: 'Woody' }, add: { ar: 'خشبي', en: 'woody' } },
    { label: { ar: 'حلو فانيليا', en: 'Sweet vanilla' }, add: { ar: 'حلو فانيليا', en: 'sweet vanilla' } },
    { label: { ar: 'مسك نظيف', en: 'Clean musk' }, add: { ar: 'مسك نظيف', en: 'clean musk' } },
  ] });
  if (!it.season && !it.time) qs.push({ id: 'when', q: msg({ ar: 'هتتلبس إمتى؟', en: 'When will it be worn?' }), options: [
    { label: { ar: 'صيف ونهار', en: 'Summer, daytime' }, add: { ar: 'للصيف', en: 'for summer' } },
    { label: { ar: 'شتا وسهرات', en: 'Winter, evenings' }, add: { ar: 'للشتا والسهرة', en: 'for winter evenings' } },
    { label: { ar: 'شغل يومي', en: 'Daily work' }, add: { ar: 'للشغل اليومي', en: 'for daily work' } },
  ] });
  if (!it.lighter && !it.stronger) qs.push({ id: 'weight', q: msg({ ar: 'قوتها تبقى إزاي؟', en: 'How strong should it be?' }), options: [
    { label: { ar: 'خفيفة وهادية', en: 'Light and soft' }, add: { ar: 'خفيفة', en: 'light' } },
    { label: { ar: 'ثابتة وفواحة', en: 'Long-lasting, projecting' }, add: { ar: 'ثابتة وفواحة', en: 'long-lasting with projection' } },
  ] });
  return qs;
}

function bestStarter(want: ScentTag[], avoid: ScentTag[]) {
  let best: { s: (typeof PERFUME_STARTERS)[number]; score: number } | undefined;
  for (const s of PERFUME_STARTERS) {
    const score = matchOf(sim0(starterDesign(s.id)!), want, avoid);
    if (!best || score > best.score) best = { s, score };
  }
  return best?.s;
}

function amountFor(m: PerfumeMaterial): number {
  const base = m.layer === 'base' ? 10 : 8;
  return round1(clamp(base * clamp(4 / m.strength, 0.15, 1.4), 0.5, 14));
}
function joinTags(tags: ScentTag[]): LText { return { ar: tags.map((t) => TAG_LABEL[t].ar).join('، '), en: tags.map((t) => TAG_LABEL[t].en).join(', ') }; }
function joinNames(ids: string[]): LText { const ms = ids.map((id) => perfumeMaterial(id)!).filter(Boolean); return { ar: ms.map((m) => m.name.ar).join('، '), en: ms.map((m) => m.name.en).join(', ') }; }

// ── 3. «استشارة شاهين» ────────────────────────────────────────────────────────────────────────────────────────────
const CLASHES: [ScentTag, ScentTag, LText][] = [
  ['aquatic', 'gourmand', { ar: 'البحري مع الحلو (الجورماند)', en: 'aquatic with gourmand' }],
  ['aquatic', 'oud', { ar: 'البحري مع العود', en: 'aquatic with oud' }],
  ['citrus', 'leather', { ar: 'الحمضيات الكتير مع الجلد', en: 'heavy citrus with leather' }],
  ['fruity', 'smoky', { ar: 'الفاكهي مع المدخن', en: 'fruity with smoky' }],
];

export function consultPerfume(d: PerfumeDesign, sim: PerfumeSimulation = sim0(d)): Consultation | undefined {
  const lines = d.lines.filter((l) => l.pct > 0);
  if (!lines.length) return undefined;
  const strengths: Msg[] = [], weaknesses: Msg[] = [], advice: Msg[] = [];
  const share = (t: ScentTag) => sim.families.find((f) => f.tag === t)?.share || 0;

  // Safety
  const fails = sim.checks.filter((c) => c.status === 'fail').length, warns = sim.checks.filter((c) => c.status === 'warn').length;
  const safety = sim.verdict === 'pass' ? 100 : sim.verdict === 'warn' ? clamp(85 - warns * 8, 55, 85) : clamp(35 - (fails - 1) * 10, 0, 35);
  if (sim.verdict === 'pass') strengths.push(msg({ ar: 'مطابقة لحدود IFRA — مفيش مادة ممنوعة ولا فوق حدها.', en: 'Within IFRA limits — nothing prohibited or over its limit.' }));
  else if (sim.verdict === 'fail') weaknesses.push(msg({ ar: 'فيها {n} بند مش مطابق لـ IFRA — لازم يتصلّح قبل أي بيع أو إهداء.', en: '{n} item(s) fail IFRA — must be fixed before selling or gifting.' }, { n: fails }));
  else weaknesses.push(msg({ ar: 'فيها {n} ملاحظة في التوافق تستاهل مراجعة.', en: '{n} compliance note(s) worth reviewing.' }, { n: warns }));

  // Balance
  const dev = balanceDeviation(sim.layers);
  const balance = Math.round(clamp(100 - dev * 3.5, 0, 100));
  if (dev <= 3) strengths.push(msg({ ar: 'الهرم متوازن (قمة {t}% · قلب {h}% · قاعدة {b}%) — الريحة هتتطور بسلاسة.', en: 'A balanced pyramid (top {t}% · heart {h}% · base {b}%) — it will unfold smoothly.' }, { t: round1(sim.layers.top), h: round1(sim.layers.heart), b: round1(sim.layers.base) }));
  else {
    const worst = (Object.keys(LAYER_TARGET) as Layer[]).sort((p, q) => distance(sim, q) - distance(sim, p))[0];
    const low = sim.layers[worst] < LAYER_TARGET[worst][0];
    weaknesses.push(low
      ? msg({ ar: '{layer} ضعيفة ({n}%) — ده هيبان في الريحة.', en: '{layer} is weak ({n}%) — it will show in the scent.' }, { layer: LAYER_WORD[worst], n: round1(sim.layers[worst]) })
      : msg({ ar: '{layer} زيادة ({n}%) وبتغطي على الباقي.', en: '{layer} is too big ({n}%) and covers the rest.' }, { layer: LAYER_WORD[worst], n: round1(sim.layers[worst]) }));
  }

  // Staying power and projection
  const exp = EXPECTED_HOURS[d.type];
  const longevity = Math.round(clamp((sim.longevityHours / exp) * 100, 0, 100));
  if (sim.longevityHours >= exp) strengths.push(msg({ ar: 'ثبات كويس لنوعها: حوالي {h} ساعة.', en: 'Good staying power for its type: about {h} h.' }, { h: round1(sim.longevityHours) }));
  else weaknesses.push(msg({ ar: 'الثبات حوالي {h} ساعة، أقل من المنتظر لـ {type} ({exp} ساعة).', en: 'Staying power is about {h} h, below what {type} should give ({exp} h).' }, { h: round1(sim.longevityHours), type: TYPE_LABEL[d.type], exp }));
  const projection = Math.round(clamp((sim.projection / EXPECTED_PROJECTION[d.type]) * 100, 0, 100));
  if (sim.projection >= 4) strengths.push(msg({ ar: 'فوحان قوي ({p} من 5) — هتتلاحظ من بعيد.', en: 'Strong projection ({p} of 5) — noticed from a distance.' }, { p: sim.projection }));
  else if (sim.projection < EXPECTED_PROJECTION[d.type]) weaknesses.push(msg({ ar: 'الفوحان {p} من 5 — قريبة من الجلد.', en: 'Projection {p} of 5 — stays close to the skin.' }, { p: sim.projection }));

  // Harmony: a clear idea, no clashing families.
  const clear = sim.families.filter((f) => f.share >= 10).length;
  let harmony = clear === 0 ? 50 : clear <= 4 ? 100 : clear === 5 ? 80 : 60;
  const clashes = CLASHES.filter(([a, b]) => share(a) >= 12 && share(b) >= 12);
  harmony = clamp(harmony - clashes.length * 20, 0, 100);
  if (clear >= 1 && clear <= 4 && !clashes.length) strengths.push(msg({ ar: 'فكرة واضحة: {tags}.', en: 'A clear idea: {tags}.' }, { tags: joinTags(sim.families.slice(0, Math.max(1, clear)).map((f) => f.tag)) }));
  if (clear >= 6) weaknesses.push(msg({ ar: 'عائلات كتير بنفس القوة ({n}) — الريحة ممكن تطلع «مزحومة» من غير شخصية.', en: 'Too many families at the same strength ({n}) — it may read crowded without a personality.' }, { n: clear }));
  clashes.forEach(([, , what]) => weaknesses.push(msg({ ar: 'مزيج صعب: {what} — محتاج جسر بينهم أو تقليل واحد.', en: 'A hard pairing: {what} — needs a bridge or less of one.' }, { what })));

  // Craft
  const unknown = lines.filter((l) => !l.materialId).length;
  const biggest = [...sim.active].sort((a, b) => b.oilPct - a.oilPct)[0];
  let craft = 100;
  if (lines.length < 4) { craft -= 30; weaknesses.push(msg({ ar: 'مواد قليلة ({n}) — الريحة هتطلع بسيطة؛ 6–15 مادة بيدّوا عمق.', en: 'Few materials ({n}) — it will smell simple; 6–15 give depth.' }, { n: lines.length })); }
  else if (lines.length >= 6 && lines.length <= 25) strengths.push(msg({ ar: 'عدد مواد مناسب ({n}) يدّي عمق من غير زحمة.', en: 'A good number of materials ({n}) — depth without crowding.' }, { n: lines.length }));
  if (unknown) { craft -= unknown * 8; weaknesses.push(msg({ ar: '{n} مادة مش في البنك — نتيجتها في المحاكاة تقريبية.', en: '{n} material(s) not in the bank — their simulation is approximate.' }, { n: unknown })); }
  if (Math.abs(sim.total - 100) > 0.5) craft -= 15;
  if (biggest?.material && biggest.material.strength >= 8 && biggest.oilPct > 10) { craft -= 20; weaknesses.push(msg({ ar: '«{m}» قوية جداً وواخدة {n}% — هتغطي على الباقي.', en: '«{m}» is very strong at {n}% — it will cover the rest.' }, { m: biggest.material.name, n: round1(biggest.oilPct) })); }
  craft = clamp(craft, 0, 100);

  const parts = [
    { label: { ar: 'الأمان والتوافق', en: 'Safety & compliance' }, value: safety },
    { label: { ar: 'توازن الهرم', en: 'Pyramid balance' }, value: balance },
    { label: { ar: 'الثبات', en: 'Staying power' }, value: longevity },
    { label: { ar: 'الفوحان', en: 'Projection' }, value: projection },
    { label: { ar: 'انسجام الفكرة', en: 'Harmony' }, value: harmony },
    { label: { ar: 'الصنعة', en: 'Craft' }, value: craft },
  ];
  const weights = [0.25, 0.2, 0.2, 0.1, 0.15, 0.1];
  let score = parts.reduce((s, p, i) => s + p.value * weights[i], 0) / 10;
  if (sim.verdict === 'fail') score = Math.min(score, 4.9);

  // Practical advice
  advice.push(msg({ ar: 'سيب الخلطة تتعتّق حوالي {days} يوم في مكان ضلمة وبارد قبل ما تحكم عليها.', en: 'Let the blend mature about {days} days somewhere dark and cool before judging it.' }, { days: sim.macerationDays }));
  advice.push(msg({ ar: 'جرّبها على الجلد مش على الورق: احكم على الافتتاحية بعد 10 دقايق، والقلب بعد ساعة، والقاعدة بعد 4 ساعات.', en: 'Test on skin, not paper: judge the opening after 10 minutes, the heart after an hour, the base after 4 hours.' }));
  const fresh = share('citrus') + share('fresh') + share('aquatic') + share('green');
  const warm = share('oud') + share('amber') + share('gourmand') + share('warm') + share('leather') + share('incense');
  advice.push(fresh > warm * 1.3
    ? msg({ ar: 'طابعها منعش — أنسب للصيف والنهار. لو عايزها للشتا زوّد لمسة دافية (عنبر أو تونكا).', en: 'A fresh character — best for summer and daytime. For winter add a warm touch (amber or tonka).' })
    : warm > fresh * 1.3
      ? msg({ ar: 'طابعها دافي — أنسب للشتا والسهرات. في الصيف رشّة واحدة كفاية.', en: 'A warm character — best for winter and evenings. In summer one spray is enough.' })
      : msg({ ar: 'طابعها متوازن بين المنعش والدافي — تنفع أغلب السنة.', en: 'Balanced between fresh and warm — wearable most of the year.' }));
  if (weaknesses.length) advice.push(msg({ ar: 'دوس «تعديل مقترح» عشان تشوف تعديلات جاهزة تتطبّق بضغطة لكل نقطة ضعف.', en: 'Press «Suggested edit» to see ready one-click edits for each weak point.' }));
  if (sim.allergens.some((a) => a.label)) advice.push(msg({ ar: 'فيه مسببات حساسية لازم تتكتب على الملصق — شوفها في تبويب «التوافق».', en: 'Some allergens must be printed on the label — see the «Compliance» tab.' }));

  return { score: round1(clamp(score, 0, 10)), grade: gradeOf(score), parts, strengths, weaknesses, advice };
}

