/**
 * «نشرة شاهين» — turns raw feed items into the news file the site shows, and the knowledge
 * the Sham services assistant learns from. Pure functions (tested in tests/shaheenNews.test.ts).
 */
import type { RawItem } from './feeds';

export type Bi = { ar: string; en: string };
export const NEWS_CATEGORIES = ['launch', 'industry', 'ingredients', 'market', 'events', 'regulation', 'culture'] as const;
export type NewsCategory = typeof NEWS_CATEGORIES[number];
export interface NewsItem {
  id: string; url: string; source: string; publishedAt?: string; category: NewsCategory; importance: number;
  original: string; lang: RawItem['lang']; title: Bi; summary: Bi; note?: Bi;
}
export interface NewsFile {
  version: 1; updatedAt: string; nextUpdateAt: string; intervalHours: number;
  /** 'shaheen' = written by the expert; 'feeds' = headlines only (no AI key answered this time). */
  editor: 'shaheen' | 'feeds';
  digest?: Bi; sources: { name: string; count: number }[]; items: NewsItem[];
}
export interface TrainingDoc { id: string; title: string; content: string; tags: string[]; origin: 'news' | 'curriculum' | 'gap'; updatedAt: string }
export interface TrainingFile { version: 1; updatedAt: string; docs: TrainingDoc[] }
export type Ask = (system: string, prompt: string) => Promise<string>;

export const INTERVAL_HOURS = 12;
const DAY = 86_400_000;
const VENDOR = /\b(?:gemini|openai|chatgpt|gpt-?\d|claude|anthropic|deepseek|openrouter|llama|mistral)\b/i;

const PERFUME = /(?:عطر|عطور|العطر|عطري|عطرية|عود|العود|بخور|مسك|المسك|عنبر|العنبر|عطار|perfum|fragran|parfum|cologne|eau de|scent|oud|agarwood|attar|musk|ambergris|ifra|essential oil|perfumer|nez |olfact)/i;
export const isPerfumeNews = (item: Pick<RawItem, 'title' | 'snippet'>) => PERFUME.test(`${item.title} ${item.snippet}`);

const words = (title: string) => new Set(title.toLowerCase().normalize('NFKC').replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter((w) => w.length > 2));
export function sameStory(a: string, b: string) {
  const x = words(a); const y = words(b);
  if (!x.size || !y.size) return a === b;
  let common = 0; x.forEach((w) => { if (y.has(w)) common++; });
  return common / Math.min(x.size, y.size) >= 0.7;
}
export function storyId(item: { url: string; title?: string; original?: string }) {
  const text = `${(item.original || item.title || '').toLowerCase()}|${item.url.replace(/[?#].*$/, '')}`;
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619) >>> 0;
  return `n${h.toString(36)}`;
}

/** Recent, perfume-related, de-duplicated candidates; no single feed may crowd out the rest. */
export function selectCandidates(items: RawItem[], now = Date.now(), max = 60, perFeed = 10): RawItem[] {
  const fresh = items
    .filter((i) => !i.publishedAt || (now - Date.parse(i.publishedAt) < 7 * DAY && Date.parse(i.publishedAt) < now + DAY))
    .filter(isPerfumeNews)
    .sort((a, b) => (b.publishedAt || '').localeCompare(a.publishedAt || ''));
  const picked: RawItem[] = [];
  const perFeedCount = new Map<string, number>();
  for (const item of fresh) {
    if ((perFeedCount.get(item.feed) || 0) >= perFeed) continue;
    if (picked.some((p) => p.url === item.url || sameStory(p.title, item.title))) continue;
    picked.push(item);
    perFeedCount.set(item.feed, (perFeedCount.get(item.feed) || 0) + 1);
    if (picked.length >= max) break;
  }
  return picked;
}

export const EDITOR_SYSTEM = `أنت «الخبير شاهين»، خبير العطور ورئيس تحرير نشرة أخبار العطور في منصة «صمم عطرك مع شام».
مهمتك: من قائمة عناوين أخبار حقيقية جُمعت الآن من الإنترنت، اختر الأخبار المتعلقة فعلاً بعالم العطور (إطلاقات عطور، دور العطور، المواد الخام، السوق والاقتصاد، المعارض، اللوائح مثل IFRA، ثقافة العطور والعود والبخور) واستبعد أي خبر لا علاقة له بالعطور أو مكرر أو إعلان أو جريمة أو شائعة.
لكل خبر مختار اكتب عنواناً عربياً واضحاً، وملخصاً من جملة أو جملتين، ونفس الشيء بالإنجليزية، وتعليقاً قصيراً منك كخبير (ماذا يعني هذا لمحبي العطور أو لمن يصنع عطره). التزم بما في العنوان والمقتطف فقط: لا تخترع أرقاماً أو أسماء أو تفاصيل غير موجودة.
لا تذكر أي اسم لنموذج ذكاء اصطناعي أو شركة تقنية تخصك. أعد JSON فقط بلا أي نص آخر.`;

export function editorPrompt(candidates: RawItem[], now = new Date()) {
  const lines = candidates.map((c, i) => `${i}. ${c.title} | ${c.source}${c.publishedAt ? ` | ${c.publishedAt.slice(0, 10)}` : ''}${c.snippet ? ` | ${c.snippet.slice(0, 280)}` : ''}`);
  return `تاريخ اليوم ${now.toISOString().slice(0, 10)}. العناوين:\n${lines.join('\n')}\n
اختر من 8 إلى 20 خبراً (الأهم أولاً) وأعد بالشكل:
{"digest":{"ar":"ثلاث جمل تلخص أبرز ما في النشرة","en":"..."},"items":[{"i":0,"category":"${NEWS_CATEGORIES.join('|')}","importance":1,"title":{"ar":"","en":""},"summary":{"ar":"","en":""},"note":{"ar":"","en":""}}]}
importance من 1 إلى 5 (5 = الأهم).`;
}

export function parseJson(text: string): unknown {
  const body = text.replace(/```(?:json)?/gi, '').trim();
  const start = body.indexOf('{'); const end = body.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('No JSON object in the reply');
  return JSON.parse(body.slice(start, end + 1));
}
const str = (v: unknown, max: number) => (typeof v === 'string' && !VENDOR.test(v) ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');
const bi = (v: unknown, max: number): Bi | undefined => {
  const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
  const ar = str(o.ar, max); const en = str(o.en, max);
  return ar || en ? { ar: ar || en, en: en || ar } : undefined;
};

/** Validated items from the expert's JSON; anything malformed or invented (unknown index) is dropped. */
export function itemsFromEditor(reply: unknown, candidates: RawItem[]): { items: NewsItem[]; digest?: Bi } {
  const data = (reply && typeof reply === 'object' ? reply : {}) as { items?: unknown; digest?: unknown };
  const seen = new Set<number>();
  const items: NewsItem[] = [];
  for (const raw of Array.isArray(data.items) ? data.items : []) {
    const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
    const i = Number(r.i);
    const c = candidates[i];
    if (!Number.isInteger(i) || !c || seen.has(i)) continue;
    const title = bi(r.title, 180);
    if (!title || !/[\u0600-\u06FF]/.test(title.ar)) continue;
    seen.add(i);
    items.push({
      id: storyId(c), url: c.url, source: c.source, publishedAt: c.publishedAt, original: c.title, lang: c.lang,
      category: NEWS_CATEGORIES.includes(r.category as NewsCategory) ? r.category as NewsCategory : guessCategory(c.title),
      importance: Math.min(5, Math.max(1, Math.round(Number(r.importance)) || 2)),
      title, summary: bi(r.summary, 420) || { ar: title.ar, en: title.en }, note: bi(r.note, 300),
    });
  }
  return { items, digest: bi(data.digest, 700) };
}

export function guessCategory(text: string): NewsCategory {
  const t = text.toLowerCase();
  if (/launch|new fragrance|unveil|introduc|lance|يطلق|إطلاق|اطلاق|جديد/.test(t)) return 'launch';
  if (/ifra|regulat|ban|law|حظر|قانون|لائحة|تنظيم/.test(t)) return 'regulation';
  if (/ingredient|oil|harvest|agarwood|vanilla|rose|jasmine|مواد|حصاد|زيت|ورد|ياسمين|فانيليا/.test(t)) return 'ingredients';
  if (/market|sales|revenue|acqui|invest|stock|سوق|مبيعات|استحواذ|استثمار/.test(t)) return 'market';
  if (/fair|expo|festival|award|exhibit|معرض|مهرجان|جائزة/.test(t)) return 'events';
  if (/oud|bakhoor|incense|history|museum|عود|بخور|تاريخ|متحف|تراث/.test(t)) return 'culture';
  return 'industry';
}

/** Headlines without the expert (no AI key answered): still real, linked news. */
export function itemsFromFeeds(candidates: RawItem[], max = 20): NewsItem[] {
  return candidates.slice(0, max).map((c) => ({
    id: storyId(c), url: c.url, source: c.source, publishedAt: c.publishedAt, original: c.title, lang: c.lang,
    category: guessCategory(`${c.title} ${c.snippet}`), importance: 2,
    title: { ar: c.title, en: c.title }, summary: { ar: c.snippet || c.title, en: c.snippet || c.title },
  }));
}

/** New stories first, then still-recent stories from the last run (so a thin run never empties the page). */
export function mergeNews(fresh: NewsItem[], previous: NewsItem[] = [], now = Date.now(), max = 30): NewsItem[] {
  const out: NewsItem[] = [];
  for (const item of [...fresh, ...previous]) {
    if (item.publishedAt && now - Date.parse(item.publishedAt) > 10 * DAY) continue;
    if (out.some((o) => o.id === item.id || o.url === item.url || sameStory(o.original, item.original))) continue;
    out.push(item);
    if (out.length >= max) break;
  }
  return out;
}

export function buildNewsFile(items: NewsItem[], editor: NewsFile['editor'], digest: Bi | undefined, now = new Date()): NewsFile {
  const counts = new Map<string, number>();
  items.forEach((i) => counts.set(i.source, (counts.get(i.source) || 0) + 1));
  return {
    version: 1, updatedAt: now.toISOString(), nextUpdateAt: new Date(now.getTime() + INTERVAL_HOURS * 3600_000).toISOString(),
    intervalHours: INTERVAL_HOURS, editor, ...(digest ? { digest } : {}),
    sources: [...counts].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
    items,
  };
}

// ---------------------------------------------------------------- training the Sham assistant

/** What Shaheen teaches the services assistant, a few lessons per run, then refreshes the oldest. */
export const CURRICULUM: { id: string; topic: string }[] = [
  { id: 'concentrations', topic: 'الفرق بين Parfum وEDP وEDT وEDC ونسب تركيز الزيت في كل نوع ومدة ثباتها' },
  { id: 'maceration', topic: 'التعتيق (Maceration): ما هو، ولماذا يحتاجه العطر، ومدته المناسبة حسب نوع العطر' },
  { id: 'storage', topic: 'طريقة حفظ العطر وزيوت العطور بعيداً عن الحرارة والضوء والهواء وصلاحيتها' },
  { id: 'alcohol', topic: 'الكحول المستخدم في العطور: الإيثانول 96% ونزع الطعم، ولماذا لا يُستخدم كحول الإيثيل الصناعي أو الميثانول' },
  { id: 'fixatives', topic: 'المثبتات في العطور ودورها في الثبات ونسبها المعتادة' },
  { id: 'pyramid', topic: 'الهرم العطري: نوتات القمة والقلب والقاعدة ومدة ظهور كل منها' },
  { id: 'longevity', topic: 'لماذا يختفي العطر بسرعة على الجلد، والفرق بين الثبات والفوحان وكيف نحسنهما' },
  { id: 'safety', topic: 'السلامة: اختبار الحساسية، معايير IFRA، والمواد المسببة للتحسس، والحذر مع الأطفال والحوامل' },
  { id: 'oud', topic: 'دهن العود ومصادره وأنواعه (هندي، كمبودي، ماليزي) وكيف يُستخدم في العطور' },
  { id: 'musk-amber', topic: 'المسك والعنبر: الطبيعي والصناعي، وأشهر أنواعهما في العطور الشرقية' },
  { id: 'families', topic: 'العائلات العطرية: شرقي، زهري، خشبي، حمضي، فوجير، شيبر، وأمثلة لكل عائلة' },
  { id: 'seasons', topic: 'اختيار العطر حسب الفصل والمناسبة: عطور الصيف والشتاء والعمل والسهرات' },
  { id: 'application', topic: 'الطريقة الصحيحة لاستخدام العطر ونقاط النبض وعدد الرشات' },
  { id: 'oils-vs-sprays', topic: 'الزيوت العطرية المركزة مقابل العطور الكحولية: المميزات والعيوب' },
  { id: 'spoilage', topic: 'علامات فساد العطر وتغير رائحته ولونه وكيف نتجنب ذلك' },
  { id: 'layering', topic: 'دمج العطور (Layering) وقواعده البسيطة' },
  { id: 'niche', topic: 'الفرق بين العطور النيش والتجارية ودور العطور المستقلة' },
  { id: 'bakhoor', topic: 'البخور والمعمول والعود الخشب: طريقة الاستخدام والأنواع' },
  { id: 'dilution', topic: 'كيف نخفف الكحول من 96% إلى تركيز أقل ونحسب كمية الماء' },
  { id: 'costing', topic: 'كيف نحسب تكلفة زجاجة عطر من الزيت والكحول والزجاجة والتغليف ونحدد سعر البيع' },
  { id: 'testing', topic: 'كيف نجرب العطر قبل الشراء: ورق الاختبار والجلد وانتظار تطور النوتات' },
  { id: 'raw-materials', topic: 'أشهر المواد الخام في العطور (الورد الطائفي، الياسمين، الفانيليا، الباتشولي، الصندل) واستخداماتها' },
];

export const TRAINER_SYSTEM = `أنت «الخبير شاهين»، خبير العطور في منصة «صمم عطرك مع شام»، وتدرّب زميلك «مساعد شام للخدمات» بكتابة دروس قصيرة يرجع إليها عندما يسأله العملاء.
اكتب بالعربية الفصحى المبسطة، بمعلومات صحيحة ومتفق عليها في صناعة العطور، بنقاط عملية وأرقام شائعة حين تفيد، ومن 400 إلى 1200 حرف لكل درس. لا تذكر أسعاراً أو سياسات أو عروضاً خاصة بشام (هذه يعرفها المساعد من بيانات المتجر)، ولا تَعِد بنتائج طبية، ولا تذكر أي اسم لنموذج ذكاء اصطناعي أو شركة تقنية. أعد JSON فقط.`;

export function lessonPrompt(lessons: { id: string; topic: string }[]) {
  return `اكتب درساً لكل موضوع:\n${lessons.map((l) => `- ${l.id}: ${l.topic}`).join('\n')}\n
أعد: {"docs":[{"id":"معرّف الموضوع كما هو","title":"عنوان قصير بالعربية","content":"نص الدرس","keywords":["كلمات بحث عربية وإنجليزية"]}]}`;
}

export function gapPrompt(questions: string[]) {
  return `هذه أسئلة سألها عملاء «مساعد شام» ولم يجد لها إجابة في قاعدة معرفته:\n${questions.map((q, i) => `${i}. ${q}`).join('\n')}\n
أجب فقط عن الأسئلة العامة عن العطور التي تعرف إجابتها الصحيحة؛ وتجاهل الأسئلة التي تحتاج بيانات شام نفسها (أسعار، طلبات، شحن، مخزون، سياسات) أو غير الواضحة.
أعد: {"docs":[{"i":0,"title":"صياغة السؤال كعنوان","content":"الإجابة من 200 إلى 900 حرف","keywords":["..."]}]}`;
}

export function docsFromTrainer(reply: unknown, origin: 'curriculum' | 'gap', ids: string[], now = new Date()): TrainingDoc[] {
  const data = (reply && typeof reply === 'object' ? reply : {}) as { docs?: unknown };
  const out: TrainingDoc[] = [];
  for (const raw of Array.isArray(data.docs) ? data.docs : []) {
    const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
    const id = origin === 'curriculum' ? (ids.includes(String(r.id)) ? String(r.id) : '') : ids[Number(r.i)] || '';
    const title = str(r.title, 160); const content = typeof r.content === 'string' && !VENDOR.test(r.content) ? r.content.trim().slice(0, 2500) : '';
    if (!id || !title || content.length < 150 || !/[\u0600-\u06FF]/.test(content) || out.some((d) => d.id.endsWith(id))) continue;
    const keywords = (Array.isArray(r.keywords) ? r.keywords : []).map((k) => str(k, 40)).filter(Boolean).slice(0, 12);
    out.push({ id: `shaheen-${origin}-${id}`, title, content, tags: ['شاهين', ...keywords], origin, updatedAt: now.toISOString() });
  }
  return out;
}

/** The lessons to (re)write this run: unwritten topics first, then the oldest ones. */
export function nextLessons(previous: TrainingDoc[], count = 4) {
  const written = new Map(previous.filter((d) => d.origin === 'curriculum').map((d) => [d.id.replace('shaheen-curriculum-', ''), d.updatedAt]));
  return [...CURRICULUM].sort((a, b) => (written.get(a.id) || '').localeCompare(written.get(b.id) || '')).slice(0, count);
}

/** The «latest news» lesson, so «ايه آخر أخبار العطور؟» is answered from what Shaheen just collected. */
export function newsDoc(file: NewsFile): TrainingDoc | undefined {
  if (!file.items.length) return undefined;
  const date = file.updatedAt.slice(0, 10);
  const lines = file.items.slice(0, 10).map((i) => `- ${i.title.ar} (${i.source}${i.publishedAt ? `، ${i.publishedAt.slice(0, 10)}` : ''})`);
  return {
    id: 'shaheen-news-latest', origin: 'news', updatedAt: file.updatedAt,
    title: 'آخر أخبار عالم العطور',
    content: `آخر أخبار العطور كما جمعها الخبير شاهين من الإنترنت بتاريخ ${date} (تتحدث كل ${file.intervalHours} ساعة، والتفاصيل في صفحة «أخبار العطور» بالموقع):\n${file.digest?.ar ? `${file.digest.ar}\n` : ''}${lines.join('\n')}`,
    tags: ['أخبار', 'اخبار', 'آخر الأخبار', 'جديد', 'الجديد', 'نشرة', 'عطور', 'news', 'latest', 'new', 'launch', 'trends'],
  };
}

export function buildTrainingFile(previous: TrainingDoc[], fresh: TrainingDoc[], now = new Date()): TrainingFile {
  const byId = new Map(previous.map((d) => [d.id, d]));
  fresh.forEach((d) => byId.set(d.id, d));
  // Gap answers are kept for 90 days, lessons and the news digest until they are rewritten.
  const docs = [...byId.values()].filter((d) => d.origin !== 'gap' || now.getTime() - Date.parse(d.updatedAt) < 90 * DAY)
    .sort((a, b) => a.origin.localeCompare(b.origin) || a.id.localeCompare(b.id)).slice(0, 120);
  return { version: 1, updatedAt: now.toISOString(), docs };
}
