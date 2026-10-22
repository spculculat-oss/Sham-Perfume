/**
 * «مكتبة شاهين» — Shaheen answers from what he already knows when no AI engine answers.
 *
 * His memory (src/utils/shaheenMemory.ts) only serves a question close to one he answered before. The library goes
 * further, with no AI and no key: it searches his own knowledge and builds an honest answer from it —
 *   1. the raw-materials encyclopaedia (src/data/rawMaterials.ts): a fact card for the material asked about;
 *   2. his training lessons (src/data/live/sham-training.json): the lesson lines that answer the question;
 *   3. his memory, more loosely: the closest question he answered before, shown as such.
 * Every library answer says where it comes from. Time-bound questions (news, prices, stock) and personal ones are
 * never answered from the library: it cannot know them.
 * Pure (no Node or DOM APIs): used by the server (server/shaheen.ts), the visitor's browser (src/utils/browserMemory.ts)
 * and «مدرسة شاهين» (scripts/shaheen-school), which also hands the same references to the teacher model.
 */
import { isPersonal, isTimeBound, meaningWords, normalizeQuestion, similarity, type MemoryFile } from './shaheenMemory';

export interface LibraryLesson { id: string; title: string; content: string; tags?: string[] }
export interface LibraryMaterial {
  id: string; nameAr: string; nameEn: string; categoryAr?: string; olfactoryFamily?: string; scentProfile?: string;
  pyramidPlacementAr?: string; recommendedUsagePercent?: string; roleInPerfume?: string; blendingPartners?: string; precautions?: string;
}
export interface LibrarySources { lessons: LibraryLesson[]; materials: LibraryMaterial[]; memory?: MemoryFile }
export interface LibraryReference { kind: 'material' | 'lesson' | 'memory'; id: string; title: string; text: string; score: number }
export interface LibraryAnswer { answer: string; kind: LibraryReference['kind']; references: LibraryReference[] }

/** Words every perfume question shares: they never decide what the question is about. */
const GENERIC = new Set([
  'عطر', 'عطور', 'عطري', 'عطريه', 'برفان', 'بارفان', 'برفيوم', 'perfume', 'perfumes', 'fragrance', 'fragrances', 'scent',
  'يعني', 'حدثني', 'اشرحلي', 'اشرح', 'معلومات', 'انواع', 'نوع', 'كل', 'شيء', 'حاجه', 'ايه', 'هو', 'هي', 'بيستخدم', 'استخدام',
  'ازاي', 'كيف', 'ليه', 'لماذا', 'امتي', 'متى', 'فين', 'اين', 'بتاع', 'بتاعه', 'بتاعت', 'افضل', 'احسن', 'شرح', 'about', 'tell', 'use', 'used',
  'why', 'when', 'where', 'which', 'best', 'does', 'do', 'it', 'this', 'that', 'explain', 'اعمل', 'اعمله', 'عمل', 'بعمل', 'ريحه', 'ريحته',
  'ريحتها', 'رائحه', 'بتاعي', 'بتاعتي', 'عندي', 'نفسي', 'make', 'smell',
]);
/** Words that describe a material's grade, not which material it is. */
const MATERIAL_FILLER = new Set([
  ...GENERIC, 'زيت', 'دهن', 'خلاصه', 'نقي', 'نقيه', 'طبيعي', 'عالي', 'نقاوه', 'معتق', 'مطلق', 'الذهبي', 'ذهبي', 'pure', 'natural', 'oil', 'essential',
  'absolute', 'grade', 'extract', 'solution', 'crystals', 'high', 'impact', 'blend', 'aged', 'seed', 'free', 'ex', 'wood', 'sweet',
]);
/** Everyday names people use for the materials in the encyclopaedia. */
const ALIASES: Record<string, string[]> = {
  'mat-vanillin': ['فانيليا', 'فانيلا', 'vanilla'], 'mat-oud-cambodi': ['عود', 'oud', 'agarwood'], 'mat-taif-rose': ['ورد', 'rose'],
  'mat-sandalwood-mysore': ['صندل', 'sandalwood'], 'mat-hojari-frankincense': ['لبان', 'بخور', 'frankincense'], 'mat-cedarwood-virginia': ['ارز', 'cedar', 'cedarwood'],
  'mat-vetiver-haiti': ['فيتيفر', 'نجيل', 'vetiver'], 'mat-tonka-coumarin': ['تونكا', 'كومارين', 'tonka'], 'mat-bergamot-fcf': ['برجموت', 'برغموت', 'bergamot'],
  'mat-ethanol-96': ['كحول', 'ايثانول', 'alcohol', 'ethanol'], 'mat-patchouli-indonesia': ['باتشولي', 'باتشولى', 'patchouli'],
  'mat-ambroxan': ['امبروكسان', 'امبروكس', 'ambroxan'], 'mat-iso-e-super': ['ايزو', 'iso'], 'mat-galaxolide': ['جالاكسوليد', 'galaxolide'],
};

export const topicWords = (text: string) => meaningWords(text).filter((w) => !GENERIC.has(w) && !/^\d+$/.test(w));
const hasArabic = (text: string) => /[\u0600-\u06FF]/.test(text);
const clip = (text: string, max: number) => (text.length <= max ? text : `${text.slice(0, max - 1).replace(/\s+\S*$/, '')}…`);

/** The words that name a material (Arabic and Latin names, the words in brackets, the everyday aliases). */
export function materialKeys(m: LibraryMaterial): string[] {
  const names = `${m.nameAr} ${m.nameEn}`.replace(/[()\-/]/g, ' ');
  const words = meaningWords(names).filter((w) => w.length >= 3 && !MATERIAL_FILLER.has(w) && !/\d/.test(w));
  const alias = Object.entries(ALIASES).filter(([id]) => m.id === id).flatMap(([, a]) => a.map((x) => meaningWords(x)[0] || x));
  return [...new Set([...words, ...alias])];
}

function findMaterials(materials: LibraryMaterial[], words: string[]): LibraryReference[] {
  const asked = new Set(words);
  return materials.map((m) => {
    const keys = materialKeys(m);
    const hit = keys.filter((k) => asked.has(k));
    return { m, score: hit.length ? hit.length / Math.min(words.length, 3) + (hit.some((k) => k.length >= 6) ? 0.3 : 0) : 0 };
  }).filter((x) => x.score > 0).sort((a, b) => b.score - a.score).slice(0, 2)
    .map(({ m, score }) => ({ kind: 'material' as const, id: m.id, title: m.nameAr.replace(/\s*\(.*$/, ''), text: materialCard(m, 'ar'), score }));
}

/** A fact card from the encyclopaedia (its data is Arabic; the English card keeps only what is not). */
export function materialCard(m: LibraryMaterial, lang: string): string {
  if (lang !== 'ar') {
    return [`**${m.nameEn}**`, m.recommendedUsagePercent && !hasArabic(m.recommendedUsagePercent) ? `- Usual share in a formula: ${m.recommendedUsagePercent}` : ''].filter(Boolean).join('\n');
  }
  const line = (label: string, value?: string) => (value?.trim() ? `- ${label}: ${value.trim()}` : '');
  return [
    `**${m.nameAr}**`,
    line('النوع', [m.categoryAr, m.olfactoryFamily].filter(Boolean).join(' · ')),
    line('الرائحة', m.scentProfile), line('مكانه في الهرم العطري', m.pyramidPlacementAr),
    line('النسبة المعتادة في التركيبة', m.recommendedUsagePercent), line('دوره', m.roleInPerfume),
    line('بيتناسق مع', m.blendingPartners), line('تنبيه', m.precautions),
  ].filter(Boolean).join('\n');
}

/** Lessons ranked like a small search engine (BM25-style): rare words count more, the title counts three times. */
function findLessons(lessons: LibraryLesson[], words: string[]): LibraryReference[] {
  if (!lessons.length || !words.length) return [];
  const docs = lessons.map((l) => {
    const title = topicWords(l.title); const body = topicWords(`${l.content} ${(l.tags || []).join(' ')}`);
    const tf = new Map<string, number>();
    for (const w of title) tf.set(w, (tf.get(w) || 0) + 3);
    for (const w of body) tf.set(w, (tf.get(w) || 0) + 1);
    return { l, tf, title: new Set(title) };
  });
  const df = (w: string) => docs.filter((d) => d.tf.has(w)).length;
  return docs.map(({ l, tf, title }) => {
    let score = 0; let matched = 0; let inTitle = 0;
    for (const w of words) {
      const f = tf.get(w) || 0;
      if (!f) continue;
      matched++; if (title.has(w)) inTitle++;
      score += Math.log(1 + (docs.length - df(w) + 0.5) / (df(w) + 0.5)) * (f / (f + 1.2));
    }
    // About the question, not merely mentioning one of its words: a title word, or most of the question's words.
    const about = inTitle > 0 || (matched >= 2 && matched / words.length >= 0.6);
    return { kind: 'lesson' as const, id: l.id, title: l.title, text: lessonExcerpt(l.content, words), score: about ? score : 0 };
  }).filter((r) => r.score > 0.4).sort((a, b) => b.score - a.score).slice(0, 2);
}

/** The lesson lines that answer the question (its first line for context), at most ~1,100 characters. */
export function lessonExcerpt(content: string, words: string[]): string {
  const lines = content.split(/\n+|(?<=[.!؟?])\s+(?=•)/).map((l) => l.trim()).filter(Boolean);
  if (lines.join('\n').length <= 1100) return lines.join('\n');
  const asked = new Set(words);
  const ranked = lines.map((line, i) => ({ line, i, s: topicWords(line).filter((w) => asked.has(w)).length })).filter((x) => x.s > 0 || x.i === 0);
  const picked: typeof ranked = [];
  let size = 0;
  for (const x of [...ranked].sort((a, b) => b.s - a.s || a.i - b.i)) {
    if (size + x.line.length > 1100) continue;
    picked.push(x); size += x.line.length;
  }
  return picked.sort((a, b) => a.i - b.i).map((x) => x.line).join('\n');
}

/** Looser than memory recall: a question he answered that shares the topic words (shown as «the closest question»). */
function findMemory(memory: MemoryFile | undefined, question: string, lang: string, words: string[]): LibraryReference[] {
  if (!memory) return [];
  const asked = new Set(words);
  return memory.entries.filter((e) => e.lang === lang).map((e) => {
    const theirs = topicWords(e.question);
    const shared = theirs.filter((w) => asked.has(w)).length;
    const topic = shared ? (2 * shared) / (theirs.length + words.length) : 0;
    const score = Math.max(topic, similarity(question, e.question));
    return { kind: 'memory' as const, id: e.id, title: e.question, text: e.answer, score: shared && score >= 0.4 ? score : 0 };
  }).filter((r) => r.score > 0).sort((a, b) => b.score - a.score).slice(0, 3);
}

/** Everything in the library about a question, best first (also the teacher model's references). */
export function searchLibrary(src: LibrarySources, question: string, lang: string): LibraryReference[] {
  if (isPersonal(question)) return [];
  const words = topicWords(question);
  if (!words.length) return [];
  const arabic = lang === 'ar';
  return [
    ...(arabic ? findMaterials(src.materials, words) : []),
    ...(arabic ? findLessons(src.lessons, words) : []),
    ...findMemory(src.memory, question, lang, words),
  ];
}

/** The line under every library answer: where it comes from, and whether the question was kept for study. */
export function libraryNote(lang: string, recorded: boolean): string {
  if (lang === 'ar') return `\n\n_📚 من مكتبة شاهين — جمعت لك دي من معلوماتي ودروسي المحفوظة.${recorded ? ' سؤالك اتسجل عشان أذاكره وأرد عليه أحسن المرة الجاية.' : ''}_`;
  return `\n\n_📚 From Shaheen’s library — gathered from his saved knowledge and lessons.${recorded ? ' Your question was noted so he studies it for next time.' : ''}_`;
}

/**
 * The library's answer, or undefined when it has nothing solid (the visitor then gets an honest «I don't know yet»).
 * One main answer (a material card, a lesson excerpt or the closest remembered answer), plus the other topics the
 * library knows about the same subject, so the visitor can ask about them.
 */
export function libraryAnswer(src: LibrarySources, question: string, lang: string, options: { recorded?: boolean } = {}): LibraryAnswer | undefined {
  if (isTimeBound(question) || normalizeQuestion(question).length < 4) return undefined;
  const refs = searchLibrary(src, question, lang);
  const material = refs.find((r) => r.kind === 'material');
  const lesson = refs.find((r) => r.kind === 'lesson');
  const memory = refs.find((r) => r.kind === 'memory');
  // A question about one material gets its card; a remembered answer to almost the same question beats a lesson
  // excerpt; a material only mentioned in a wider question («عطر عود في البيت») comes last.
  const strongMaterial = material && material.score >= 0.6 ? material : undefined;
  const main = strongMaterial || (memory && memory.score >= 0.5 ? memory : lesson || memory || material);
  if (!main) return undefined;
  const ar = lang === 'ar';
  const body = main.kind === 'memory'
    ? `${ar ? 'أقرب سؤال جاوبته قبل كده' : 'The closest question I answered before'}: «${clip(main.title, 160)}»\n\n${main.text}`
    : main.kind === 'lesson' ? `**${main.title}**\n\n${main.text}` : main.text;
  const more = refs.filter((r) => r !== main && r.kind !== 'memory').map((r) => r.title)
    .concat(refs.filter((r) => r !== main && r.kind === 'memory').map((r) => `«${clip(r.title, 90)}»`)).slice(0, 3);
  const extra = more.length ? `\n\n${ar ? 'وعندي كمان عن' : 'I also know about'}: ${more.join(ar ? '، ' : ', ')}` : '';
  return { answer: `${body}${extra}${libraryNote(lang, Boolean(options.recorded))}`, kind: main.kind, references: refs };
}

/** References for the teacher model (school study): what the library says, so the answer stays grounded. */
export function referenceBlock(refs: LibraryReference[], max = 1800): string {
  let out = '';
  for (const r of refs) {
    const piece = `\n— ${r.title}:\n${clip(r.text, 700)}\n`;
    if (out.length + piece.length > max) break;
    out += piece;
  }
  return out.trim();
}

/**
 * «شاهين معتمد على نفسه»: nothing in his memory, library or open sources — he says so plainly instead of guessing,
 * notes the question to study it, and shows what he can do right now.
 */
export function unknownAnswer(lang: string, recorded: boolean): string {
  if (lang === 'ar' || lang === 'fa') return `السؤال ده لسه معنديش عنه معلومة أكيدة، ومش هخمّن عليك 🙏${recorded ? ' سجلته عندي عشان أذاكره وأرد عليك أحسن المرة الجاية.' : ''}\n\nأقدر أساعدك دلوقتي في:\n- **تصميم تركيبة**: اكتب مثلاً «صمم عطر شتوي رجالي فيه عود 50 مل»\n- **حسابات** التركيز وتخفيف الكحول والتعتيق\n- **المواد الخام**: اسألني عن مادة باسمها (عود، صندل، أمبروكسان…)\n- **ترشيح عطر جاهز** من «متجر شام»\n\nأو اكتب سؤالك بكلمات تانية.`;
  return `I don't have solid information on this yet, and I won't guess 🙏${recorded ? ' I noted it to study it and answer better next time.' : ''}\n\nRight now I can help with:\n- **designing a formula**: e.g. “design a warm men's winter perfume with oud, 50 ml”\n- **calculations**: concentration, alcohol dilution, maceration\n- **raw materials**: ask me about one by name (oud, sandalwood, ambroxan…)\n- **a ready perfume** from the Sham store\n\nOr rephrase your question.`;
}
