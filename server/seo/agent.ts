/**
 * «منارة شاهين» — the thinking half of the SEO agent.
 *
 * One cycle: audit the deployed site → study the next methodology lesson → propose/apply safe on-page copy
 * → ask «الخبير شاهين» to grade the cycle and decide readiness → write the media report → submit changed
 * URLs to search engines → save the learning history. It works with no AI key (audit + curriculum + files)
 * and gets better with one; every AI output is filtered by the same deterministic guardrails.
 */
import {
  advanceTrust, localMediaReport, proposeCopy, publishedPages, readPagesFile, readSeoState, recordRun, regression,
  rollbackLastApplied, submissionPlan, type SeoMediaReport, type SeoPageCopy, type SeoPagesFile, type SeoRun, type SeoState,
} from '../../src/seo/agentState';
import { auditLiveSite, type LiveAudit } from './auditLive';
import { nextLesson, SEO_AREAS, type SeoArea } from '../../src/seo/curriculum';
import { SEO_PAGES, HOME_PAGE, seoPage } from '../../src/seo/pages';
import { SITE, SEO_AGENT, absoluteUrl } from '../../src/seo/site';
import { topFixes, validateSeoCopy } from '../../src/seo/audit';
import {
  probeCrawlerAccess, probePageSpeed, submitBing, submitGoogleSitemap, submitIndexNow, submitWebSub,
  type SubmitResult,
} from './search';
import { feedFingerprint } from '../../src/seo/discovery';
import { renderFeed } from '../../src/seo/artifacts';

type Env = Record<string, string | undefined>;
export type SeoAsk = (system: string, prompt: string) => Promise<string>;
export interface CycleInput {
  state: SeoState;
  pagesFile?: SeoPagesFile;
  siteUrl: string;
  env?: Env;
  ask?: SeoAsk;
  /** Label of the engine that answered, for the admin-only diagnostics. */
  engine?: string;
  /** Guidance from Shaheen's independent supervisor (server/core/liveData → supervisorGuidance('seo_agent')). */
  guidance?: string;
  /** Submit URLs to search engines. Off in local dev and branch rehearsals. */
  submit?: boolean;
  fetch?: typeof fetch;
  now?: Date;
  trigger?: SeoRun['trigger'];
  liveAudit?: LiveAudit;
  log?: (line: string) => void;
}
export interface CycleResult {
  state: SeoState;
  pagesFile: SeoPagesFile;
  audit: LiveAudit;
  summary: string;
  submissions: SubmitResult[];
  next: string;
}

const VENDOR = /\b(?:Gemini|DeepSeek|ChatGPT|GPT-\d|Claude|OpenAI|Anthropic|OpenRouter|Llama|Qwen|Mistral|Copilot)\b/i;
const LINK = /(?:https?:\/\/|www\.)/i;
const ABSOLUTE = /(?:الأفضل|الأولى? في|الأول في|رقم\s*1|مضمون|نتائج مضمونة|guaranteed|number one|best in)/i;
const FAKE_PROOF = /(?:آلاف|ملايين|جائزة|شهادة|معتمد من|مرخص من|4[.,]9)/i;
const ARABIC = /[\u0600-\u06FF]/;

const cleanup = (text: string) => text.replace(/<[^>]+>/g, ' ').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').replace(/\s+/g, ' ').trim();
/** Arabic advice that cannot carry a link, a vendor name, a fabricated proof or an absolute promise. */
export function cleanAgentText(value: unknown, max = 400, opts: { allowDigits?: boolean } = {}): string | undefined {
  if (typeof value !== 'string') return undefined;
  const text = cleanup(value).slice(0, max);
  if (text.length < 12 || !ARABIC.test(text) || VENDOR.test(text) || LINK.test(text) || ABSOLUTE.test(text) || FAKE_PROOF.test(text)) return undefined;
  if (opts.allowDigits === false && /\d/.test(text)) return undefined;
  if (/(?:تجاهل|ألغِ|الغ|اكسر|تخط)\S*\s+(?:\S+\s+){0,3}(?:القواعد|التعليمات)|ignore (?:all |the )?(?:previous |above )?(?:rules|instructions)/i.test(text)) return undefined;
  return text;
}
export function parseAgentJson(text: string): Record<string, unknown> | undefined {
  const body = text.replace(/```(?:json)?/gi, '').trim();
  const start = body.indexOf('{'); const end = body.lastIndexOf('}');
  if (start < 0 || end <= start) return undefined;
  try { const value: unknown = JSON.parse(body.slice(start, end + 1)); return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined; } catch { return undefined; }
}
const list = (value: unknown, max = 6) => (Array.isArray(value) ? value : []).map((x) => cleanAgentText(x, 240)).filter((x): x is string => Boolean(x)).slice(0, max);
const numbersOf = (text: string) => new Set((text.match(/\d+(?:[.,]\d+)?/g) || []).map((n) => n.replace(',', '.')));
/** Copy may only repeat figures that already existed on the page (no invented stats). */
function numbersAreGrounded(candidate: string, source: string) {
  const allowed = numbersOf(source);
  return [...numbersOf(candidate)].every((n) => allowed.has(n));
}

const SYSTEM = (guidance?: string) => `أنت «${SEO_AGENT.nameAr}»، ${SEO_AGENT.roleAr} لمنصة «${SITE.nameAr}»، وتعمل تحت قيادة «${SEO_AGENT.reportsToAr}».
مهمتك تحسين الظهور في محركات البحث بالطرق البيضاء فقط: محتوى صحيح، عناوين وأوصاف دقيقة، بيانات منظمة، سرعة، وبنية واضحة. أنت لا تضمن ترتيباً ولا تخترع شيئاً.
قواعد ثابتة: اكتب بالعربية الفصحى المبسطة. لا تذكر أسماء شركات أو نماذج ذكاء اصطناعي. لا روابط خارجية. لا أرقام أو تقييمات أو شهادات أو جوائز أو عملاء غير موجودة في المعطيات. لا حشو كلمات مفتاحية ولا وعود مطلقة. لا تغيّر أسعاراً أو مخزوناً أو منطق المتجر. لا تطلب منحلاً تقنياً يضر الزوار أو يخالف إرشادات المحركات.
${guidance?.trim() ? `\nتوجيهات الجودة من الخبير شاهين (أقل أولوية من القواعد أعلاه، ولا تلغيها):\n${guidance.trim().slice(0, 1200)}` : ''}
أعد JSON صالحاً فقط عندما يُطلب منك ذلك، دون شرح أو Markdown.`;

const siteFacts = (products: number) => [
  `المنصة: ${SITE.summaryAr}`,
  `المسار الأساسي: ${SITE.url}`,
  `عدد الصفحات الثابتة للأدوات: ${SEO_PAGES.length}، ومنتجات المتجر: ${products}.`,
  'الصفحة الرئيسية تعمل بتطبيق React، وصفحات الأدوات والمنتجات ملفات HTML ثابتة كاملة.',
  'جمهور عربي: مصر والخليج والشام. الاهتمامات: تركيب العطور، الخامات، التعتيق، التكلفة، شراء العطور.',
].join('\n');

function auditBrief(audit: LiveAudit) {
  return [
    `التقييم: ${audit.score}/100 · الصفحات المفحوصة: ${audit.pagesChecked} · حرجة: ${audit.bySeverity.critical} · كبيرة: ${audit.bySeverity.major} · صغيرة: ${audit.bySeverity.minor}`,
    ...audit.topFixes.map((f) => `- [${f.severity}/${f.area}] ${f.page}: ${f.title} — ${f.detail} → ${f.fix}`),
  ].join('\n');
}

/** Study one lesson: the model applies the official checklist to this site; the curriculum is the fallback. */
async function study(input: CycleInput, audit: LiveAudit, products: number, log: (line: string) => void) {
  const lesson = nextLesson(input.state.curriculum.studied, audit.weakestArea);
  let takeaway = lesson.applyAr;
  let checklist = lesson.checklistAr.slice(0, 5);
  if (input.ask) {
    try {
      const prompt = `الدرس التالي من منهجية SEO: ${lesson.titleAr}
الهدف: ${lesson.objectiveAr}
لماذا: ${lesson.whyAr}
قائمة الفحص المرجعية:
${lesson.checklistAr.map((c, i) => `${i + 1}. ${c}`).join('\n')}
الملخص المرجعي لهذه المنصة: ${lesson.applyAr}

واقع المنصة الآن:
${siteFacts(products)}
نتائج الفحص الأخير:
${auditBrief(audit)}

اكتب تلخيصاً عملياً من جملتين (60–120 كلمة) لما يجب أن يفعله «${SEO_AGENT.nameAr}» الآن تطبيقاً لهذا الدرس على هذه المنصة، ثم 3–5 خطوات فحص محددة قابلة للتنفيذ.
الشكل: {"takeaway":"…","checklist":["…","…"]}`;
      const raw = await input.ask(SYSTEM(input.guidance), prompt);
      const data = parseAgentJson(raw);
      const cleaned = cleanAgentText(data?.takeaway, 700);
      const items = list(data?.checklist, 5);
      if (cleaned) takeaway = cleaned;
      if (items.length) checklist = items;
      log(`دراسة ${lesson.id}: ${lesson.titleAr}${cleaned ? ' — بمساهمة المحرك' : ' — من المنهج'}`);
    } catch { log(`دراسة ${lesson.id}: المحرك لم يجب، اعتمد المنهج المرجعي.`); }
  }
  return { lesson, takeaway, checklist };
}

/** Improved title/description for a page whose audit complained. One AI request for up to two pages. */
async function writeCopy(input: CycleInput, audit: LiveAudit, state: SeoState, log: (line: string) => void) {
  const candidates = SEO_PAGES.filter((page) => audit.findings.some((f) => f.page.endsWith(page.path) && (f.area === 'titles' || f.id.includes('title') || f.id.includes('description')))).slice(0, 2);
  if (!input.ask || !candidates.length) return 0;
  const current = candidates.map((page) => {
    const override = state.proposals[page.id];
    return { id: page.id, path: page.path, h1: override?.h1 || page.h1, intent: page.intent, keywords: page.keywords, title: override?.title || page.title, description: override?.description || page.description };
  });
  const prompt = `هذه صفحات منصة شام تحتاج تحسين عنوانها/وصفها وفق فحص SEO:
${current.map((p) => `- ${p.id} (${p.path}) · نية: ${p.intent} · كلمات: ${p.keywords.join('، ')}
  العنوان الحالي (${p.title.length}): ${p.title}
  الوصف الحالي (${p.description.length}): ${p.description}`).join('\n')}
ملاحظات الفحص:
${audit.topFixes.filter((f) => candidates.some((p) => f.page.endsWith(p.path))).map((f) => `- ${f.title}: ${f.fix}`).join('\n') || 'العنوان أو الوصف خارج الطول المستهدف.'}

اكتب عنواناً جديداً 50–60 حرفاً ووصفاً 130–160 حرفاً لكل صفحة. التزم بالوقائع: لا أرقام جديدة، لا وعود، لا «الأفضل»، لا حشو. اذكر اسم «شام» فقط إذا بقي العنوان ≤60 حرفاً. اجعل كل صفحة مختلفة.
الشكل: {"pages":{"<id>":{"title":"…","description":"…"}}}`;
  let applied = 0;
  try {
    const data = parseAgentJson(await input.ask(SYSTEM(input.guidance), prompt));
    const pages = (data?.pages && typeof data.pages === 'object' ? data.pages : {}) as Record<string, Record<string, unknown>>;
    for (const candidate of candidates) {
      const proposed = pages[candidate.id];
      if (!proposed || typeof proposed.title !== 'string' || typeof proposed.description !== 'string') continue;
      const page = seoPage(candidate.id)!;
      const copy: SeoPageCopy = {
        title: cleanup(proposed.title), description: cleanup(proposed.description),
        source: 'ai', at: (input.now || new Date()).toISOString(),
      };
      const problems = validateSeoCopy(copy, { maxDesc: 165 });
      const grounded = numbersAreGrounded(`${copy.title} ${copy.description}`, `${candidate.title} ${candidate.description} ${page.h1}`);
      if (problems.length || !grounded) {
        state.notes.push(`${copy.at}: رُفض نص مقترح لـ ${page.path} (${[...problems, ...(grounded ? [] : ['أرقام غير موجودة في الصفحة'])].join('، ')}).`);
        continue;
      }
      // A trainee only proposes; guided/autonomous publishes after the same guardrails.
      if (state.trust.level === 'trainee') {
        state.proposals[page.id] = copy;
        log(`اقتراح نص لـ ${page.path} (لم يُنشر: المرحلة الحالية تدريب).`);
      } else {
        proposeCopy(state, page.id, page.path, copy, { title: candidate.title, description: candidate.description }, 'تحسين عنوان/وصف بناءً على فحص SEO وتوجيهات شاهين', input.now);
        applied++;
        log(`نُشر نص محسّن لـ ${page.path}.`);
      }
    }
  } catch { log('كتابة النصوص: المحرك لم يجب هذه الدورة.'); }
  return applied;
}

/** Shaheen grades the agent. The deterministic trust rules can never be overridden by a claim alone. */
async function coach(input: CycleInput, audit: LiveAudit, lessonTitle: string, applied: number, log: (line: string) => void) {
  if (!input.ask) return undefined;
  const state = input.state;
  const prompt = `أنت «${SEO_AGENT.reportsToAr}»، الخبير المشرف على «${SEO_AGENT.nameAr}». راجع عمل الوكيل في هذه الدورة بصرامة وإنصاف، واحكم هل يستحق الانتقال من «${state.trust.level}» إلى مرحلة أعلى.
المرحلة الحالية: ${state.trust.level} · الدورات: ${state.trust.cycles} · الدروس: ${state.curriculum.studied.length}/24 · نشر تحسينات: ${state.applied.filter((a) => !a.reverted).length} · دورة الدرس: ${lessonTitle} · تحسينات هذه الدورة: ${applied}
الفحص:
${auditBrief(audit)}
سجل التقييمات (آخر 5): ${state.history.slice(-5).map((h) => h.score).join(' → ') || 'لا يوجد'}
التوجيه السابق للوكيل: ${state.coach?.guidance || 'لا يوجد'}

شروط الاعتماد على النفس: 20 درساً على الأقل، 4 دورات في مرحلة التوجيه، تقييم فحص 85+، تقييمك 8.5+، وسجل بلا هبوط بعد تغيير منشور. كن متحفظاً: لا توافق إن وُجدت ملاحظة حرجة أو ادعاء غير موثق.
أعد JSON: {"score":1-10,"strengths":["…"],"issues":["…"],"guidance":"3–6 نقاط عربية قصيرة بصيغة الأمر لتحسين أداء الوكيل","readyForAutonomy":true|false,"note":"جملة واحدة"}
score: 10 فقط لدورة كاملة بلا ملاحظة. اكتب guidance مبنية على ما حدث فعلاً، بلا ذكر أي شركة أو نموذج ذكاء اصطناعي، وبلا روابط.`;
  try {
    const data = parseAgentJson(await input.ask(SYSTEM(undefined), prompt));
    const score = Number(data?.score);
    const guidance = cleanAgentText(data?.guidance, 900);
    const strengths = list(data?.strengths, 5);
    const issues = list(data?.issues, 6);
    const ready = data?.readyForAutonomy === true;
    if (!Number.isFinite(score) || score < 1 || score > 10) return undefined;
    log(`تقييم شاهين: ${score}/10 · ${ready ? 'يرى أنه جاهز للاعتماد على النفس' : 'يرى استمرار التوجيه'}.`);
    return {
      at: (input.now || new Date()).toISOString(), score: Math.round(score * 10) / 10,
      strengths, issues, guidance, readyForAutonomy: ready, note: cleanAgentText(data?.note, 300),
    };
  } catch { log('تقييم شاهين: المحرك لم يجب هذه الدورة.'); return undefined; }
}

/** Prioritized actions: AI reads the real findings; a deterministic list is the fallback. */
async function planActions(input: CycleInput, audit: LiveAudit, lessonTitle: string, log: (line: string) => void) {
  const fallback = topFixes(audit.findings, 6).map((f) => ({ textAr: f.fix, area: f.area as string, severity: f.severity as 'critical' | 'major' | 'minor' }));
  if (!input.ask) return fallback;
  try {
    const prompt = `هذه نتائج فحص SEO الحقيقية للموقع:
${auditBrief(audit)}
درس اليوم: ${lessonTitle}
اقترح 3–5 إجراءات عملية مرتبة بالأولوية يمكن تنفيذها داخل هذا الموقع (صفحات ثابتة، عناوين وأوصاف، بيانات منظمة، خريطة موقع، سرعة، محتوى أدوات). لكل إجراء جملة عربية قصيرة (≤160 حرفاً) تصف ما سيُفعل، مع المجال والخطورة من الفحص.
الشكل: {"summary":"جملة عن حالة الظهور اليوم","actions":[{"text":"…","area":"titles","severity":"critical|major|minor"}]}`;
    const data = parseAgentJson(await input.ask(SYSTEM(input.guidance), prompt));
    const raw = Array.isArray(data?.actions) ? data.actions : [];
    const areas = Object.keys(SEO_AREAS);
    const actions = raw.slice(0, 5).map((a) => {
      if (!a || typeof a !== 'object') return undefined;
      const o = a as Record<string, unknown>;
      const text = cleanAgentText(o.text, 220);
      if (!text) return undefined;
      const area = areas.includes(String(o.area)) ? String(o.area) : 'content';
      const severity = o.severity === 'critical' || o.severity === 'major' ? o.severity : 'minor';
      return { textAr: text, area, severity } as { textAr: string; area: string; severity: 'critical' | 'major' | 'minor' };
    }).filter((a): a is { textAr: string; area: string; severity: 'critical' | 'major' | 'minor' } => Boolean(a));
    if (actions.length) { log(`خطة ${actions.length} إجراءات من المحرك.`); return actions; }
  } catch { log('الخطة: المحرك لم يجب، استُخدمت إصلاحات الفحص.'); }
  return fallback;
}

/** Weekly media report, strictly from platform facts and the current audit. */
async function mediaReport(input: CycleInput, audit: LiveAudit, products: number, log: (line: string) => void): Promise<SeoMediaReport> {
  const fallback = localMediaReport(input.state, input.now);
  if (!input.ask) return fallback;
  try {
    const prompt = `اكتب تقرير المندوب الإعلامي الأسبوعي لمنصة شام اعتماداً على المعطيات التالية فقط:
${siteFacts(products)}
الحالة الفنية: ${audit.score}/100 (حرجة ${audit.bySeverity.critical}، كبيرة ${audit.bySeverity.major}).
أهم الأولويات: ${audit.topFixes.slice(0, 4).map((f) => f.title).join('، ') || 'لا توجد ملاحظات كبيرة'}.
الجمهور: عشاق العطور العرب، من يريد تركيب عطر في المنزل، وأصحاب مشاريع عطور صغيرة.

أعد JSON: {"headline":"عنوان صادق ≤120 حرفاً","paragraphs":["2–3 فقرات ≤600 حرف لكل فقرة"],"boilerplate":"نبذة رسمية ≤300 حرف","social":["3 منشورات ≤240 حرفاً لكل منشور"],"ideas":["فكرتان لمحتوى أو تعاون صحفي"]}
ممنوع تماماً: أرقام غير مذكورة أعلاه، أسعار، شهادات، جوائز، وعود بانتصار أو صدارة، أسماء شركات أو نماذج ذكاء اصطناعي، روابط، أو ادعاء أخبار حديثة. اكتب بلغة عربية واضحة.`;
    const data = parseAgentJson(await input.ask(SYSTEM(input.guidance), prompt));
    const headline = cleanAgentText(data?.headline, 160, { allowDigits: false });
    const paragraphs = list(data?.paragraphs, 3).map((p) => cleanAgentText(p, 650, { allowDigits: false })).filter((p): p is string => Boolean(p));
    const boilerplate = cleanAgentText(data?.boilerplate, 320, { allowDigits: false });
    const social = list(data?.social, 5).map((s) => cleanAgentText(s, 260, { allowDigits: false })).filter((s): s is string => Boolean(s));
    const ideas = list(data?.ideas, 4).map((s) => cleanAgentText(s, 200, { allowDigits: false })).filter((s): s is string => Boolean(s));
    if (!headline || paragraphs.length < 1 || !boilerplate || social.length < 1) return fallback;
    log('تقرير المندوب الإعلامي: كتبه المحرك واجتاز الفحص.');
    return { at: (input.now || new Date()).toISOString(), headline, paragraphs, boilerplate, social, ideas, source: 'ai' };
  } catch { log('تقرير المندوب: المحرك لم يجب، استُخدم تقرير محلي.'); return fallback; }
}

function applySubmissionState(state: SeoState, at: string, results: { indexNow?: SubmitResult; bing?: SubmitResult; google?: SubmitResult }, env: Env) {
  const mark = (ids: string[], status: 'submitted' | 'ready', detail?: string) => {
    for (const e of state.searchEngines) if (ids.includes(e.id)) { e.status = status; e.at = at; e.detail = detail; }
  };
  if (results.indexNow?.ok) mark(['bing', 'yandex', 'naver', 'seznam', 'yep', 'duckduckgo', 'ecosia', 'yahoo', 'copilot'], 'submitted', `IndexNow: ${results.indexNow.submitted} رابطاً`);
  if (results.bing?.ok) mark(['bing'], 'submitted', 'Bing Webmaster API');
  if (results.google?.ok) mark(['google'], 'submitted', 'Search Console: خريطة الموقع');
  else if (env.GSC_SERVICE_ACCOUNT_JSON?.trim()) mark(['google'], 'ready', 'حساب الخدمة مضبوط؛ يُعاد الإرسال في الدورة القادمة.');
  // Without any account Google still discovers the site: sitemap + feed declared in robots.txt, honest lastmod.
  else mark(['google'], 'ready', 'خريطة + خلاصة معلنتان في robots.txt — الوصول لا يحتاج حساباً.');
}

export async function runSeoCycle(input: CycleInput): Promise<CycleResult> {
  const now = input.now || new Date();
  const at = now.toISOString();
  const log = input.log || ((line: string) => console.log(line));
  const env = input.env || {};
  const started = Date.now();
  const state = structuredClone(readSeoState(input.state, now));
  const pagesFile = readPagesFile(input.pagesFile || publishedPages(state, undefined, now));
  const notes: string[] = [];

  // 1) audit the real deployment
  const audit = input.liveAudit || await auditLiveSite({ siteUrl: input.siteUrl, fetch: input.fetch, now, products: [] });
  state.audit = {
    at: audit.at, score: audit.score, bySeverity: audit.bySeverity, byArea: audit.byArea,
    findings: audit.findings.slice(0, 120), pagesChecked: audit.pagesChecked,
  };
  log(`الفحص: ${audit.score}/100 (${audit.findings.length} ملاحظة، ${audit.pagesChecked} صفحات).`);

  // 1b) prove the crawler's view from outside: status, headers and robots directives of the key pages.
  state.discovery.crawl = await probeCrawlerAccess({
    urls: [input.siteUrl, absoluteUrl('tools/', input.siteUrl), absoluteUrl(SEO_PAGES[0]?.path || 'tools/', input.siteUrl)],
    fetch: input.fetch, limit: 3,
  });
  const blocked = state.discovery.crawl.checked - state.discovery.crawl.ok;
  log(`وصول الزاحف: ${state.discovery.crawl.ok}/${state.discovery.crawl.checked} صفحة متاحة${blocked ? ` · ${blocked} محجوبة` : ''}.`);

  // 2) study
  const studyResult = await study(input, audit, audit.sitemapUrls.filter((u) => /\/p\//.test(u.loc)).length, log);
  if (!state.curriculum.studied.includes(studyResult.lesson.id)) state.curriculum.studied.push(studyResult.lesson.id);
  state.curriculum.notes = [...state.curriculum.notes, {
    id: studyResult.lesson.id, titleAr: studyResult.lesson.titleAr, at, takeaway: studyResult.takeaway, checklist: studyResult.checklist,
  }].slice(-60);
  if (state.curriculum.studied.length >= 24 && !state.curriculum.completedAt) state.curriculum.completedAt = at;
  state.engines = { ...state.engines, aiAvailable: Boolean(input.ask), studies: state.engines.studies + 1 };
  if (input.engine) state.engines.lastEngine = input.engine;

  // 3) apply only what the guardrails and the trust level allow
  const applied = await writeCopy(input, audit, state, log);

  // 4) Shaheen's review, then the deterministic trust ladder
  const coachReview = await coach(input, audit, studyResult.lesson.titleAr, applied, log);
  if (coachReview) {
    state.coach = coachReview;
    state.coachHistory = [...state.coachHistory, { at: at, score: coachReview.score, readyForAutonomy: coachReview.readyForAutonomy }].slice(-60);
  }
  const previousLevel = state.trust.level;
  if (regression(state.history, audit.score, applied)) {
    const undone = rollbackLastApplied(state, now);
    if (undone) notes.push(`تراجع تلقائي عن آخر تغيير (${undone.field} في ${undone.pagePath}) بعد هبوط التقييم.`);
    if (state.trust.level === 'autonomous') {
      state.trust = { ...state.trust, level: 'guided', since: at, cyclesAtLevel: 0, noteAr: 'هبط التقييم بعد تغيير منشور: الاتهام بالتحفظ وعودة مؤقتة إلى التوجيه.' };
      state.notes.push(`${at}: عودة إلى التوجيه بعد انحدار التقييم.`);
    }
  }
  state.trust = { ...state.trust, cycles: state.trust.cycles + 1 };
  const trust = advanceTrust(state, { coachScore: coachReview?.score, readyForAutonomy: coachReview?.readyForAutonomy, now });
  if (trust.changed) log(`المرحلة: ${previousLevel} → ${trust.level} (${trust.noteAr})`);

  // 5) prioritized actions + media report
  state.nextActions = await planActions(input, audit, studyResult.lesson.titleAr, log);
  const mediaAge = state.mediaReport ? now.getTime() - Date.parse(state.mediaReport.at) : Infinity;
  if (mediaAge > 20 * 3600_000) {
    state.mediaReport = await mediaReport(input, audit, audit.sitemapUrls.filter((u) => /\/p\//.test(u.loc)).length, log);
  }

  // 6) discovery submissions
  const results: SubmitResult[] = [];
  let submitted = 0;
  let indexNowResult: SubmitResult | undefined;
  let bingResult: SubmitResult | undefined;
  let googleResult: SubmitResult | undefined;
  if (input.submit) {
    const plan = submissionPlan(state, audit.sitemapUrls, now);
    if (plan.urls.length) {
      indexNowResult = await submitIndexNow({ siteUrl: input.siteUrl, urls: plan.urls, fetch: input.fetch });
      results.push(indexNowResult);
      submitted += indexNowResult.submitted;
      state.submissions = [...state.submissions, { engine: 'IndexNow (Bing, Yandex, Naver, Seznam, Yep)', method: 'indexnow' as const, at, urls: indexNowResult.submitted, ok: indexNowResult.ok, detail: indexNowResult.detail }].slice(-80);
      if (indexNowResult.ok) state.submissionBook = { lastIndexNowAt: at, urls: [...new Set([...plan.urls, ...state.submissionBook.urls])].slice(-600) };
      log(`IndexNow: ${indexNowResult.ok ? `${indexNowResult.submitted} رابطاً` : indexNowResult.detail}`);
    } else { notes.push(plan.reason); log(plan.reason); }
    // The feed is a second sitemap and a WebSub publisher: ping the hubs only when its content changed.
    const feedHash = feedFingerprint(renderFeed({ siteUrl: input.siteUrl, products: [], now: new Date(0) }));
    if (state.discovery.webSub?.feedHash !== feedHash) {
      const webSub = await submitWebSub({ siteUrl: input.siteUrl, env, fetch: input.fetch });
      state.discovery.webSub = { at, ok: webSub.ok, feedHash, hubs: webSub.hubs };
      results.push({ ok: webSub.ok, status: webSub.status, detail: webSub.detail, submitted: webSub.submitted });
      state.submissions = [...state.submissions, { engine: 'WebSub (خلاصة RSS)', method: 'websub' as const, at, urls: webSub.submitted, ok: webSub.ok, detail: webSub.detail }].slice(-80);
      log(`WebSub: ${webSub.detail}`);
    } else { log('WebSub: الخلاصة لم تتغيّر منذ آخر إشعار — لا إشعار مكرر.'); }

    // Performance is measured once a day at most: the public endpoint is rate-limited and keyless.
    const psiAge = state.discovery.pageSpeed ? now.getTime() - Date.parse(state.discovery.pageSpeed.at) : Infinity;
    if (!state.discovery.pageSpeed || psiAge > 24 * 3600_000) {
      const psi = await probePageSpeed({ url: input.siteUrl, fetch: input.fetch });
      state.discovery.pageSpeed = {
        at: psi.at, ok: psi.ok, url: psi.url, status: psi.status, scores: psi.scores, vitals: psi.vitals, detail: psi.detail,
      };
      log(`الأداء: ${psi.ok ? `أداء ${psi.scores.performance ?? '—'}/100 · SEO ${psi.scores.seo ?? '—'}/100` : psi.detail}`);
    }

    if (env.BING_WEBMASTER_API_KEY?.trim()) {
      bingResult = await submitBing({ siteUrl: input.siteUrl, urls: audit.sitemapUrls.map((u) => u.loc).slice(0, 400), env, fetch: input.fetch });
      results.push(bingResult);
      state.submissions = [...state.submissions, { engine: 'Bing Webmaster API', method: 'bing-api' as const, at, urls: bingResult.submitted, ok: bingResult.ok, detail: bingResult.detail }].slice(-80);
      log(`Bing: ${bingResult.ok ? `${bingResult.submitted} رابطاً` : bingResult.detail}`);
    }
    if (env.GSC_SERVICE_ACCOUNT_JSON?.trim()) {
      googleResult = await submitGoogleSitemap({ siteUrl: input.siteUrl, env, fetch: input.fetch });
      results.push(googleResult);
      state.submissions = [...state.submissions, { engine: 'Google Search Console', method: 'gsc' as const, at, urls: googleResult.submitted, ok: googleResult.ok, detail: googleResult.detail }].slice(-80);
      log(`Google: ${googleResult.ok ? 'أُرسلت الخريطة' : googleResult.detail}`);
    }
    applySubmissionState(state, at, { indexNow: indexNowResult, bing: bingResult, google: googleResult }, env);
  } else {
    notes.push('الإرسال إلى المحركات متوقف في هذه الدورة (تشغيل محلي أو فرع تجريبي).');
  }

  // 7) persist + summary
  state.nextActions = state.nextActions.slice(0, 6);
  const run: SeoRun = {
    at, trigger: input.trigger || 'manual', auditScore: audit.score, findings: audit.findings.length,
    applied, lessonId: studyResult.lesson.id, engine: input.engine, submitted, notes: [...notes, ...audit.notes].slice(0, 12), ms: Date.now() - started,
  };
  recordRun(state, run, now);
  state.updatedAt = at;
  const pages = publishedPages(state, pagesFile, now);
  const summary = [
    `الفحص ${audit.score}/100 (${audit.findings.length} ملاحظة)`,
    `المرحلة ${trust.level}`,
    `درس ${studyResult.lesson.id}`,
    applied ? `${applied} تحسيناً منشوراً` : 'لا تغيير منشور هذه الدورة',
    submitted ? `${submitted} رابطاً أُرسل` : 'لا إرسال',
    state.discovery.crawl ? `وصول الزاحف ${state.discovery.crawl.ok}/${state.discovery.crawl.checked}` : '',
  ].filter(Boolean).join(' · ');
  log(summary);
  return { state, pagesFile: pages, audit, summary, submissions: results, next: state.nextRunAt };
}
