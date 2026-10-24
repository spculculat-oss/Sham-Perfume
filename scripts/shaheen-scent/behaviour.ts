/**
 * «روبوت سلوك الزائر العطري» (bot `scent_behavior`, workflow `.github/workflows/shaheen-scent.yml`,
 * report `src/data/live/scent-behavior.json`) — the pure brain.
 *
 * What it studies, honestly:
 *   1. The anonymous counters of the designs visitors chose to share in «معمل المصممين» (material ids, type and a
 *      coarse concentration band only — `src/utils/labSignals.ts`; nothing personal, no titles, no free text).
 *   2. The lab's own material bank (`src/utils/designers/perfumeMaterials.ts`) and the raw-materials encyclopedia
 *      (`src/data/rawMaterials.ts`), to see which of the visitors' favourite families the lab cannot yet build.
 *   3. The storefront's published families (`src/utils/storeCatalog.ts`), so the lab offers what the shop sells.
 *
 * What it produces: the most-used materials, the family mix, the bank materials nobody uses, the materials the
 * visitors' own designs needed and the bank lacks, and a short list of concrete materials to add — each with a
 * reason and a real id from the encyclopedia. With no counters it says so plainly and plans from content only:
 * no invented numbers, no fake visits.
 *
 * Pure (no files, no network): `tests/scentBehavior.test.ts` drives it with fixtures and `run.mts` does the I/O.
 */
import type { LabAggregate } from '../../src/utils/labSignals';

export interface BankMaterial {
  id: string;
  name: { ar: string; en: string };
  layer: string;
  tags: string[];
}

export interface RawMaterial {
  id: string;
  nameAr: string;
  nameEn: string;
  category: string;
  categoryAr: string;
  olfactoryFamily: string;
  pyramidPlacement: string;
}

export interface CatalogueProduct {
  families: string[];
  inStock?: boolean;
}

export interface BehaviourInput {
  now: number;
  aggregate: LabAggregate;
  /** Did the robot really read the live counters? (An unreachable endpoint is «not read», never zero designs.) */
  signalsRead: boolean;
  signalsNoteAr: string;
  bank: BankMaterial[];
  raw: RawMaterial[];
  /** The storefront's product families (the shop's own taxonomy). */
  storeFamilies: string[];
  products: CatalogueProduct[];
}

export type Band = 'edc' | 'edt' | 'edp' | 'extrait' | 'oil';

export interface BehaviourReport {
  version: 1;
  agent: 'scent-behavior';
  updatedAt: string;
  signals: {
    read: boolean;
    noteAr: string;
    /** Designs counted by the server (each one a deliberate share). */
    designs: number;
    materialsCounted: number;
    types: { type: string; designs: number; share: number }[];
    bands: { band: string; designs: number; share: number }[];
  };
  top: { id: string; nameAr: string; nameEn: string; designs: number; share: number; layer: string; tags: string[] }[];
  families: { tag: string; nameAr: string; share: number }[];
  /** Bank materials no shared design used — a balance idea, not a fault. */
  unused: { id: string; nameAr: string; tags: string[] }[];
  /** Materials the visitors typed that the bank does not know. */
  unknownTyped: { label: string; designs: number }[];
  proposals: { rawId: string; nameAr: string; nameEn: string; family: string; category: string; reasonAr: string; score: number }[];
  /** Store families the lab can barely build (0 or 1 bank materials). */
  coverage: { family: string; nameAr: string; products: number; bankMaterials: number }[];
  planAr: string[];
  notes: string[];
  score: number;
  summaryAr: string;
}

/** Family words → the lab's scent tags (Arabic and English, as the encyclopedia writes them). */
const TAG_WORDS: Record<string, RegExp> = {
  citrus: /حمض|ليمون|برغموت|يوسفي|جريب|ليم|citrus|lemon|bergamot|orange|grapefruit|lime/i,
  fresh: /منعش|نضير|هوائي|fresh|ozonic|airy/i,
  aromatic: /عشبي|لافندر|روزماري|أرומטי|herbal|lavender|rosemary|aromatic/i,
  aquatic: /مائي|بحري|marine|aquatic|oceanic/i,
  green: /أخضر|عشب|green|grass|leaf/i,
  spicy: /توابل|فلفل|هيل|قرفة|قرنفل|زنجبيل|spicy|pepper|cardamom|cinnamon|clove|ginger/i,
  warm: /دافئ|warm|hot/i,
  floral: /زهري|زهر|floral|flower/i,
  white: /أبيض|white|jasmine|ياسمين|tub|توبروز|gardenia|freesia/i,
  rose: /ورد|rose|rosy/i,
  powdery: /بودري|powder|iris|iris|سوسن/i,
  sweet: /حلو|سكر|sweet|sugar|candy/i,
  gourmand: /جورماند|كراميل|شوكولا|فانيليا|gourmand|caramel|chocolate|vanilla/i,
  woody: /خشب|أرز|صندل|wood|cedar|sandal|guaiac/i,
  oud: /عود|oud|agar/i,
  amber: /عنبر|amber|ambrox/i,
  oriental: /شرقي|oriental|balsam|بلسم/i,
  incense: /بخور|لبان|incense|frankincense|olibanum/i,
  smoky: /مدخن|دخان|smok|birch|tar/i,
  leather: /جلد|leather|suede/i,
  musky: /مسك|musk/i,
  clean: /نظيف|clean|soap|cotton/i,
  earthy: /تراب|earth|moss|patchouli|باتشولي|طحلب/i,
  balsamic: /بلسم|balsam|resin|راتنج/i,
  fruity: /فاكه|fruit|apple|berry|تفاح|توت/i,
  fougere: /فوجير|fougère|fougere|fern/i,
  creamy: /كريمي|creamy|milky|حليبي/i,
};

const FAMILY_TAGS: Record<string, string[]> = {
  oud: ['oud', 'woody'], oriental: ['oriental', 'amber'], amber: ['amber', 'balsamic'], woody: ['woody', 'earthy'],
  floral: ['floral', 'white', 'rose'], fresh: ['fresh', 'clean', 'aquatic'], citrus: ['citrus', 'fresh'],
  aquatic: ['aquatic', 'fresh'], fruity: ['fruity', 'sweet'], gourmand: ['gourmand', 'sweet'],
  musk: ['musky', 'clean'], spicy: ['spicy', 'warm'], leather: ['leather', 'smoky'], powdery: ['powdery', 'creamy'],
};

const FAMILY_AR: Record<string, string> = {
  oud: 'عود', oriental: 'شرقي', amber: 'عنبري', woody: 'خشبي', floral: 'زهري', fresh: 'منعش', citrus: 'حمضي',
  aquatic: 'مائي', fruity: 'فاكهي', gourmand: 'جورماند', musk: 'مسكي', spicy: 'توابل', leather: 'جلدي', powdery: 'بودري',
};

const TAG_AR: Record<string, string> = {
  citrus: 'حمضي', fresh: 'منعش', aromatic: 'عشبي', aquatic: 'مائي', green: 'أخضر', spicy: 'توابل', warm: 'دافئ',
  floral: 'زهري', white: 'زهور بيضاء', rose: 'وردي', powdery: 'بودري', sweet: 'حلو', gourmand: 'جورماند', woody: 'خشبي',
  oud: 'عود', amber: 'عنبري', oriental: 'شرقي', incense: 'بخوري', smoky: 'مدخّن', leather: 'جلدي', musky: 'مسكي',
  clean: 'نظيف', earthy: 'ترابي', balsamic: 'بلسمي', fruity: 'فاكهي', fougere: 'فوجير', creamy: 'كريمي',
};

const norm = (text: string) => text.toLowerCase().replace(/[\u064B-\u0652]/g, '').replace(/[\s()\[\]،,./\\|+&-]+/g, ' ').trim();
const words = (text: string) => new Set(norm(text).split(' ').filter((w) => w.length > 2));

/** Tags of an encyclopedia material, from the family words it is described with. */
export function tagsOfRaw(raw: RawMaterial): string[] {
  const text = `${raw.nameAr} ${raw.nameEn} ${raw.olfactoryFamily} ${raw.categoryAr}`;
  return Object.entries(TAG_WORDS).filter(([, re]) => re.test(text)).map(([tag]) => tag);
}

/** Words that say nothing about which material it is («oil», «absolute» …) — ignored when matching names. */
const NAME_STOP = new Set(['oil', 'oils', 'absolute', 'extract', 'extraction', 'essence', 'pure', 'natural', 'grade', 'solution',
  'crystals', 'synthetic', 'resin', 'resinoid', 'concentrate', 'fragrance', 'perfume', 'material', 'type', 'the', 'and',
  'زيت', 'خلاصة', 'دهن', 'نقي', 'طبيعي', 'مادة', 'عطر', 'مركز']);

const distinctive = (text: string) => new Set([...words(text.replace(/\(.*?\)/g, ' '))]
  .filter((w) => !NAME_STOP.has(w) && (/^[a-z]{4,}$/.test(w) || (/[\u0600-\u06FF]/.test(w) && w.length >= 3))));

/** Is this encyclopedia material already represented in the lab's bank (by name, either language)? */
export function inBank(raw: RawMaterial, bankNames: string[]): boolean {
  const target = distinctive(`${raw.nameEn} ${raw.nameAr}`);
  const full = norm(raw.nameEn.replace(/\(.*?\)/g, ' '));
  return bankNames.some((name) => {
    const normalized = norm(name);
    if (normalized.length > 4 && (normalized.includes(full) || full.includes(normalized))) return true;
    for (const token of distinctive(name)) if (target.has(token)) return true;
    return false;
  });
}

const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 1000) / 10 : 0);

export function analyzeScentBehaviour(input: BehaviourInput): BehaviourReport {
  const { bank, raw, signalsRead } = input;
  // «العدّاد مش مقروء» = مفيش أرقام: counters that were not read are treated as empty, never as zero designs shown.
  const aggregate: LabAggregate = signalsRead
    ? input.aggregate
    : { version: 1, designs: 0, materials: {}, typed: {}, types: {}, bands: {} };
  const designs = aggregate.designs;
  const bankById = new Map(bank.map((m) => [m.id, m]));
  const bankNames = bank.map((m) => `${norm(m.name.ar)}|${norm(m.name.en)}`).flatMap((x) => x.split('|'));

  // ── What the visitors used ──
  const usage = Object.entries(aggregate.materials)
    .filter(([id]) => bankById.has(id))
    .map(([id, count]) => ({ id, count }))
    .sort((a, b) => b.count - a.count);
  const top = usage.slice(0, 20).map(({ id, count }) => {
    const m = bankById.get(id)!;
    return { id, nameAr: m.name.ar, nameEn: m.name.en, designs: count, share: pct(count, designs), layer: m.layer, tags: m.tags };
  });

  // ── The family mix: every material of a design votes once, weighted by how often it was used ──
  const tagCounts: Record<string, number> = {};
  for (const { id, count } of usage) for (const tag of bankById.get(id)!.tags) tagCounts[tag] = (tagCounts[tag] || 0) + count;
  const tagTotal = Object.values(tagCounts).reduce((a, b) => a + b, 0);
  let families = Object.entries(tagCounts).sort((a, b) => b[1] - a[1])
    .map(([tag, count]) => ({ tag, nameAr: TAG_AR[tag] || tag, share: pct(count, tagTotal) }));

  // With no counters: the storefront's own families, labelled as the shop's demand (never as visitor designs).
  if (!families.length) {
    const counts: Record<string, number> = {};
    for (const p of input.products) for (const f of p.families || []) counts[f] = (counts[f] || 0) + 1;
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    families = Object.entries(counts).sort((a, b) => b[1] - a[1])
      .map(([f, count]) => ({ tag: f, nameAr: FAMILY_AR[f] || f, share: pct(count, total) }));
  }

  // ── Coverage: can the lab build every family the shop sells? ──
  const bankTags = new Set(bank.flatMap((m) => m.tags));
  const coverage = input.storeFamilies.map((family) => {
    const tags = FAMILY_TAGS[family] || [family];
    const bankMaterials = bank.filter((m) => m.tags.some((t) => tags.includes(t))).length;
    const products = input.products.filter((p) => (p.families || []).includes(family)).length;
    return { family, nameAr: FAMILY_AR[family] || family, products, bankMaterials };
  }).filter((row) => row.products > 0).sort((a, b) => a.bankMaterials - b.bankMaterials || b.products - a.products);

  // ── Materials the visitors' designs asked for and the bank does not have ──
  const unknownTyped = Object.entries(aggregate.typed)
    .map(([label, count]) => ({ label: label.replace(/_/g, ' ').slice(0, 60), designs: count }))
    .sort((a, b) => b.designs - a.designs).slice(0, 15);

  // ── Proposals: real encyclopedia materials, ranked by the demand they answer ──
  const priorityTags = new Set(families.slice(0, 6).map((f) => f.tag));
  const typedWords = new Set(unknownTyped.flatMap((u) => [...words(u.label)]));
  const thinFamilies = new Set(coverage.filter((c) => c.bankMaterials <= 1).map((c) => c.family));
  const proposals = raw
    .filter((r) => !inBank(r, bankNames))
    .map((r) => {
      const tags = tagsOfRaw(r);
      let score = 0;
      const reasons: string[] = [];
      const matchingTag = tags.find((t) => priorityTags.has(t));
      if (matchingTag) {
        score += families.find((f) => f.tag === matchingTag)?.share ?? 0;
        reasons.push(`من العائلات اللي عليها طلب (${TAG_AR[matchingTag] || matchingTag})`);
      }
      const familyHit = [...thinFamilies].find((f) => (FAMILY_TAGS[f] || []).some((t) => tags.includes(t)));
      if (familyHit) {
        score += 8;
        reasons.push(`المعمل عنده خامة واحدة بس في عائلة «${FAMILY_AR[familyHit] || familyHit}» والتجار بتبيعها`);
      }
      const typedHit = [...words(`${r.nameAr} ${r.nameEn}`)].find((w) => typedWords.has(w));
      if (typedHit) {
        score += 10;
        reasons.push('الزوار كتبوا اسم قريب منه والمعمل ماكانش عارفه');
      }
      if (!reasons.length) return undefined;
      return { rawId: r.id, nameAr: r.nameAr, nameEn: r.nameEn, family: r.olfactoryFamily, category: r.categoryAr, score: Math.round(score * 10) / 10, reasonAr: reasons.join('، ') };
    })
    .filter((x): x is NonNullable<typeof x> => Boolean(x))
    .sort((a, b) => b.score - a.score || a.rawId.localeCompare(b.rawId))
    .slice(0, 8);

  const unused = signalsRead && designs > 0
    ? bank.filter((m) => !aggregate.materials[m.id]).map((m) => ({ id: m.id, nameAr: m.name.ar, tags: m.tags }))
    : [];

  // ── Score ──
  const thin = coverage.filter((c) => c.bankMaterials <= 1);
  const score = Math.max(10, Math.min(100, Math.round(
    100
    - Math.min(25, unknownTyped.length * 4)
    - Math.min(24, thin.length * 4)
    - Math.min(14, unused.length)
    - (signalsRead ? 0 : 8),
  )));

  const notes: string[] = [];
  if (!signalsRead) notes.push('مفيش عدّاد حي مقروء من المعمل: التقرير مبني على محتوى المعمل والمتجر بس، ومن غير أي أرقام مخترعة.');
  else if (!designs) notes.push('العداد شغال ومفيش ولا تركيبة اتشاركت لحد الآن — الزوار مش بيبعتوا حاجة غير لما يدوسوا «شارك التركيبة مجهولة» بنفسهم.');
  if (signalsRead && designs > 0 && unused.length) notes.push(`${unused.length} خامة في بنك المعمل محدش استخدمها في أي تركيبة اتشاركت — مرشحة للتبسيط أو للحملات التعليمية.`);
  if (!raw.length) notes.push('موسوعة الخامات فاضية — مش هينفع نقترح مواد جديدة.');

  const planAr = [
    signalsRead && designs > 0
      ? `أكثر ${Math.min(3, top.length)} خامات استخداماً: ${top.slice(0, 3).map((t) => `${t.nameAr} (${t.share}%)`).join('، ')}.`
      : `أكثر العائلات طلباً في المتجر: ${families.slice(0, 3).map((f) => f.nameAr).join('، ')}.`,
    ...(thin.length ? [`عائلات المعمل واقف فيها على خامة واحدة أو مفيش: ${thin.slice(0, 4).map((c) => `${c.nameAr} (${c.bankMaterials} مقابل ${c.products} منتج)`).join('، ')}.`] : []),
    ...(unknownTyped.length ? [`أسماء خامات طلبها الزوار ومش في البنك: ${unknownTyped.slice(0, 4).map((u) => u.label).join('، ')}.`] : []),
    ...(proposals.length ? [`مرشحون للإضافة: ${proposals.slice(0, 4).map((p) => p.nameAr.split(' (')[0]).join('، ')}.`] : []),
  ];

  const summaryAr = signalsRead
    ? (designs
      ? `سلوك المعمل: ${designs} تركيبة اتشاركت مجهولة من الزوار${top.length ? `، وأكثر خامة «${top[0].nameAr}» (${top[0].share}% من التركيبات)` : ''}. ${proposals.length ? `فيه ${proposals.length} مادة جديدة مرشحة للإضافة.` : 'مفيش اقتراحات مواد جديدة دلوقتي.'}`
      : 'سلوك المعمل: العدّاد شغال ومفيش تركيبة اتشاركت لحد الآن — مفيش أرقام تُذكر، والتقرير مبني على محتوى البنك والمتجر.')
    : 'سلوك المعمل: العدّاد الحي مش مقروء — التحليل من محتوى المعمل والمتجر بس، ومن غير أرقام مخترعة.';

  return {
    version: 1,
    agent: 'scent-behavior',
    updatedAt: new Date(input.now).toISOString(),
    signals: {
      read: signalsRead,
      noteAr: input.signalsNoteAr,
      designs,
      materialsCounted: Object.keys(aggregate.materials).length,
      types: Object.entries(aggregate.types).map(([type, count]) => ({ type, designs: count, share: pct(count, designs) })).sort((a, b) => b.designs - a.designs),
      bands: Object.entries(aggregate.bands).map(([band, count]) => ({ band, designs: count, share: pct(count, designs) })).filter((b) => (['edc', 'edt', 'edp', 'extrait', 'oil'] as string[]).includes(b.band)),
    },
    top,
    families,
    unused: unused.slice(0, 30),
    unknownTyped,
    proposals,
    coverage,
    planAr,
    notes,
    score,
    summaryAr,
  };
}
