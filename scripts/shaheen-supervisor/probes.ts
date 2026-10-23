/**
 * How Shaheen tests each AI tool: real requests to the live site (the same API GitHub Pages uses), or a
 * look at the files a tool publishes. Questions rotate every run, so answer caches do not hide problems.
 */
import { TRAINING_CASES } from '../shaheen-specialists/questions';
import { secretaryLocalSummary } from '../../src/utils/ownerRoom';
import { readFileSync } from 'node:fs';
import type { AiToolId } from '../../src/utils/aiTools';
import { readSeoState, stateSummary } from '../../src/seo/agentState';
import { inspectAnswer, type Probe } from './checks';
import { templateReply } from '../../server/contracts/assistant';
import { EMPTY_SENDER, checkLetter, type Sender } from '../../server/contracts/policy';
import type { DesignBriefResponse } from '../../src/types/design';

type Fetch = typeof fetch;
export interface ProbeContext { site: string; fetch: Fetch; run: number; adminToken?: string; now: number; liveDir: URL }

export const QUESTIONS: Record<'shaheen_chat' | 'sham_assistant' | 'store_advisor', { q: string; lang: 'ar' | 'en' }[]> = {
  shaheen_chat: [
    { q: 'صمم لي عطر شرقي بالعود والورد 50 مل تركيز EDP', lang: 'ar' },
    { q: 'عايز أخفف كحول 96% إلى 80% وأعمل منه 500 مل، أحط كام مية؟', lang: 'ar' },
    { q: 'كم يوم أعتق عطر فيه مسك وعنبر وعود؟', lang: 'ar' },
    { q: 'ايه الفرق بين EDP و EDT و Parfum في نسبة الزيت والثبات؟', lang: 'ar' },
    { q: 'اقترح نوتات لعطر صيفي منعش للرجال', lang: 'ar' },
    { q: 'ليه العطر بيختفي بسرعة على جلدي؟ وأزود الثبات ازاي؟', lang: 'ar' },
    { q: 'ايه آخر أخبار العطور؟', lang: 'ar' },
    { q: 'What fixative works best for a citrus cologne, and at what percentage?', lang: 'en' },
    { q: 'احسب تكلفة 100 زجاجة 50 مل تركيز 20% لو الزيت 3 جنيه للمل والكحول 0.2 جنيه للمل', lang: 'ar' },
    { q: 'ايه أفضل خلطة شتوية دافية؟', lang: 'ar' },
  ],
  sham_assistant: [
    { q: 'ايه الخدمات اللي عندكم؟', lang: 'ar' },
    { q: 'عايز أطلب عطر مخصص باسمي، أعمل ايه؟', lang: 'ar' },
    { q: 'ازاي أحفظ العطر عشان مايبوظش؟', lang: 'ar' },
    { q: 'عندكم عطور عود؟', lang: 'ar' },
    { q: 'ايه الفرق بين EDP و EDT؟', lang: 'ar' },
    { q: 'How can I track my order?', lang: 'en' },
    { q: 'ايه آخر أخبار العطور؟', lang: 'ar' },
    { q: 'عايز أكلم حد من فريق شام', lang: 'ar' },
  ],
  store_advisor: [
    { q: 'عايز عطر رجالي للصيف للشغل', lang: 'ar' },
    { q: 'هدية لمراتي عطر نسائي فخم', lang: 'ar' },
    { q: 'عود ثابت للسهرات تحت 300 جنيه', lang: 'ar' },
    { q: 'عطر منعش للجنسين للاستخدام اليومي', lang: 'ar' },
    { q: 'حاجة شبه سوفاج', lang: 'ar' },
    { q: 'A sweet vanilla perfume for winter evenings', lang: 'en' },
    { q: 'ارخص عطر عندكم', lang: 'ar' },
    { q: 'عطر مسك ناعم للبنات', lang: 'ar' },
  ],
};

/** A different slice of the question pool each run. */
export function rotate<T>(pool: T[], run: number, count: number): T[] {
  return Array.from({ length: Math.min(count, pool.length) }, (_, i) => pool[(run * count + i) % pool.length]);
}

const VISITOR = 'shaheen-supervisor-probe';
async function timed<T>(work: () => Promise<T>): Promise<{ value?: T; error?: string; ms: number }> {
  const start = Date.now();
  try { return { value: await work(), ms: Date.now() - start }; }
  catch (error) { return { error: (error as Error).message.slice(0, 160), ms: Date.now() - start }; }
}
async function json<T>(f: Fetch, url: string, init?: RequestInit, timeout = 60_000): Promise<T> {
  // One retry for a network blip or a cold-start 502/503, so a single hiccup does not fail a healthy tool.
  let response = await f(url, { ...init, signal: AbortSignal.timeout(timeout) }).catch(() => undefined);
  if (!response || response.status === 502 || response.status === 503) {
    await new Promise((r) => setTimeout(r, 3000));
    response = await f(url, { ...init, signal: AbortSignal.timeout(timeout) });
  }
  const body = await response.text();
  if (!response.ok) throw new Error(`HTTP ${response.status}${body ? ` ${body.slice(0, 120)}` : ''}`);
  return JSON.parse(body) as T;
}
const post = (body: unknown, headers: Record<string, string> = {}): RequestInit =>
  ({ method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });

async function chatProbes(ctx: ProbeContext): Promise<Probe[]> {
  const out: Probe[] = [];
  for (const { q, lang } of rotate(QUESTIONS.shaheen_chat, ctx.run, 3)) {
    const r = await timed(() => json<{ reply?: string }>(ctx.fetch, `${ctx.site}/api/chat`, post({ message: q, model: 'auto', language: lang, conversationHistory: [], visitorId: VISITOR, memory: false })));
    const answer = r.value?.reply || '';
    // memory:false — the supervisor tests the live engines, not «ذاكرة شاهين»'s saved answers.
    out.push({ tool: 'shaheen_chat', question: q, answer, ms: r.ms, ok: !r.error, error: r.error, findings: r.error ? [] : inspectAnswer(answer, { language: lang, ms: r.ms }) });
  }
  return out;
}

async function assistantProbes(ctx: ProbeContext): Promise<Probe[]> {
  const out: Probe[] = [];
  for (const { q, lang } of rotate(QUESTIONS.sham_assistant, ctx.run, 3)) {
    const r = await timed(() => json<{ reply?: string }>(ctx.fetch, `${ctx.site}/api/assistant/chat`, post({ message: q, language: lang, visitorId: VISITOR })));
    const answer = r.value?.reply || '';
    out.push({ tool: 'sham_assistant', question: q, answer, ms: r.ms, ok: !r.error, error: r.error, findings: r.error ? [] : inspectAnswer(answer, { language: lang, ms: r.ms, maxChars: 1800 }) });
  }
  // The test conversations are not real visitors: remove them from the admin's data.
  await ctx.fetch(`${ctx.site}/api/assistant/me?visitorId=${VISITOR}`, { method: 'DELETE', signal: AbortSignal.timeout(15_000) }).catch(() => undefined);
  return out;
}

async function newsArticleProbes(ctx: ProbeContext): Promise<Probe[]> {
  type Article = { titleAr?: string; summaryAr?: string; contentAr?: string };
  const r = await timed(() => json<{ success?: boolean; articles?: Article[] }>(ctx.fetch, `${ctx.site}/api/news`));
  const articles = (r.value?.articles || []).slice(0, 3);
  const answer = articles.map((a) => `## ${a.titleAr || ''}\n${a.summaryAr || ''}\n${(a.contentAr || '').slice(0, 500)}${(a.contentAr || '').length > 500 ? ' [اقتطاع من المشرف]' : ''}`).join('\n\n');
  const findings = r.error ? [] : articles.length ? inspectAnswer(answer, { language: 'ar', ms: r.ms }) : [{ severe: true, text: 'لا توجد مقالات' }];
  return [{ tool: 'news_articles', question: 'GET /api/news (مقالات اليوم)', answer, ms: r.ms, ok: !r.error && r.value?.success !== false, error: r.error, findings }];
}

async function mediaProbes(ctx: ProbeContext): Promise<Probe[]> {
  const image = await timed(() => json<{ images?: { title: string }[] }>(ctx.fetch, `${ctx.site}/api/media?type=image&q=agarwood`));
  const place = await timed(() => json<{ places?: { lat: number; lon: number; label: string }[] }>(ctx.fetch, `${ctx.site}/api/media?type=place&q=${encodeURIComponent('Grasse, France')}`));
  const images = image.value?.images || [];
  const p = place.value?.places?.[0];
  return [
    { tool: 'media', question: 'صور: agarwood', answer: images.map((i) => i.title).join(' · '), ms: image.ms, ok: !image.error, error: image.error,
      findings: image.error ? [] : images.length ? [] : [{ severe: true, text: 'لم يجد أي صورة لموضوع معروف' }] },
    { tool: 'media', question: 'خريطة: Grasse, France', answer: p ? `${p.label} (${p.lat}, ${p.lon})` : '', ms: place.ms, ok: !place.error, error: place.error,
      findings: place.error ? [] : !p ? [{ severe: true, text: 'لم يجد المكان على الخريطة' }]
        : p.lat > 43 && p.lat < 44.5 && p.lon > 6 && p.lon < 7.6 ? [] : [{ severe: true, text: `المكان في موضع خاطئ (${p.lat}, ${p.lon})` }] },
  ];
}

function readLive<T>(ctx: ProbeContext, file: string): T | undefined {
  try { return JSON.parse(readFileSync(new URL(file, ctx.liveDir), 'utf8')) as T; } catch { return undefined; }
}

function bulletinProbes(ctx: ProbeContext): Probe[] {
  type News = { updatedAt: string; editor: string; items: { title: { ar: string }; summary: { ar: string }; note?: { ar: string }; source: string }[] };
  const news = readLive<News>(ctx, 'shaheen-news.json');
  if (!news) return [{ tool: 'news_bulletin', question: 'ملف النشرة', answer: '', ms: 0, ok: false, error: 'الملف غير موجود', findings: [] }];
  const ageH = (ctx.now - Date.parse(news.updatedAt)) / 3600_000;
  const findings = [] as Probe['findings'];
  if (ageH > 13) findings.push({ severe: true, text: `النشرة متأخرة (آخر تحديث منذ ${Math.round(ageH)} ساعة)` });
  if (news.items.length < 8) findings.push({ severe: news.items.length === 0, text: `عدد الأخبار قليل (${news.items.length})` });
  if (news.editor !== 'shaheen') findings.push({ severe: false, text: 'آخر نشرة بلا ملخصات شاهين (عناوين فقط)' });
  const answer = news.items.slice(0, 6).map((i) => `- ${i.title.ar} (${i.source})\n  ${i.summary.ar}${i.note ? `\n  رأي شاهين: ${i.note.ar}` : ''}`).join('\n');
  return [{ tool: 'news_bulletin', question: `آخر نشرة (${news.items.length} خبر، منذ ${Math.max(0, Math.round(ageH))} ساعة)`, answer, ms: 0, ok: true, findings: [...findings, ...inspectAnswer(answer, { language: 'ar' }).filter((f) => f.severe)] }];
}

function trainingProbes(ctx: ProbeContext): Probe[] {
  type Training = { updatedAt: string; docs: { id: string; title: string; content: string; updatedAt: string }[] };
  const file = readLive<Training>(ctx, 'sham-training.json');
  if (!file) return [{ tool: 'assistant_training', question: 'ملف الدروس', answer: '', ms: 0, ok: false, error: 'الملف غير موجود', findings: [] }];
  const lessons = file.docs.filter((d) => d.id.startsWith('shaheen-curriculum-') || d.id.startsWith('shaheen-gap-'))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const findings = [] as Probe['findings'];
  if (!lessons.length) findings.push({ severe: true, text: 'لا توجد دروس لمساعد شام بعد' });
  if ((ctx.now - Date.parse(file.updatedAt)) / 3600_000 > 13) findings.push({ severe: false, text: 'الدروس لم تتحدث منذ أكثر من 13 ساعة' });
  const sample = rotate(lessons, ctx.run, 2);
  const answer = sample.map((d) => `## ${d.title}\n${d.content.slice(0, 900)}${d.content.length > 900 ? ' [اقتطاع من المشرف]' : ''}`).join('\n\n');
  return [{ tool: 'assistant_training', question: `أحدث الدروس (${lessons.length} درس)`, answer, ms: 0, ok: true, findings: [...findings, ...(answer ? inspectAnswer(answer, { language: 'ar' }) : [])] }];
}

async function adminProbes(ctx: ProbeContext): Promise<Probe[]> {
  if (!ctx.adminToken) return [];
  const r = await timed(() => json<{ summary?: string; sections?: { title: string }[] }>(ctx.fetch, `${ctx.site}/api/admin/agent`, post({ message: 'تقرير اليوم' }, { Authorization: `Bearer ${ctx.adminToken}` })));
  const answer = `${r.value?.summary || ''}\n${(r.value?.sections || []).map((s) => `- ${s.title}`).join('\n')}`.trim();
  return [{ tool: 'admin_agent', question: 'تقرير اليوم', answer, ms: r.ms, ok: !r.error, error: r.error, findings: r.error ? [] : inspectAnswer(answer, { language: 'ar', ms: r.ms, vendorNamesAllowed: true }) }];
}

/** «غرفة شاهين الخاصة»: checked on a made-up room only — no robot ever reads the owner's room (O-07). */
function ownerRoomProbes(): Probe[] {
  const sample = [
    { id: '1', by: 'owner' as const, text: 'عايز تقرير أسبوعي عن الطلبات', at: '' },
    { id: '2', by: 'owner' as const, text: 'قررت نأجل حملة العيد، والكارت 4111 1111 1111 1111', at: '' },
  ];
  const answer = secretaryLocalSummary(sample);
  const findings: Probe['findings'] = [...inspectAnswer(answer, { language: 'ar' })];
  if (/4111/.test(answer)) findings.push({ severe: true, text: 'مفكرة السكرتير كررت رقم شكله رقم بطاقة' });
  if (!/تقرير أسبوعي/.test(answer) || !/قررت/.test(answer)) findings.push({ severe: true, text: 'مفكرة السكرتير ماسجلتش طلب أو قرار صاحب الموقع' });
  return [{ tool: 'owner_room', question: 'مفكرة السكرتير على غرفة تجريبية', answer, ms: 0, ok: true, findings }];
}

async function storeAdvisorProbes(ctx: ProbeContext): Promise<Probe[]> {
  const out: Probe[] = [];
  for (const { q, lang } of rotate(QUESTIONS.store_advisor, ctx.run, 2)) {
    const r = await timed(() => json<{ source?: string; reply?: string; picks?: { id: string; why: string }[] }>(ctx.fetch, `${ctx.site}/api/store/advise`, post({ message: q, language: lang })));
    const picks = r.value?.picks || [];
    const answer = `${r.value?.reply || ''}\n${picks.map((p) => `- ${p.id}: ${p.why}`).join('\n')}`.trim();
    const findings = r.error ? [] : [
      ...(picks.length ? [] : [{ severe: true, text: 'لم يرشّح أي منتج' }]),
      ...(r.value?.source === 'shaheen' ? [] : [{ severe: false, text: 'الرد من الفلتر المحلي فقط (المحركات لم ترد)' }]),
      ...inspectAnswer(answer, { language: lang, ms: r.ms, maxChars: 1800 }),
    ];
    out.push({ tool: 'store_advisor', question: q, answer, ms: r.ms, ok: !r.error, error: r.error, findings });
  }
  return out;
}

function storeCatalogProbes(ctx: ProbeContext): Probe[] {
  type Catalog = { updatedAt: string; editor: string; entries: Record<string, { editor: string; nameAr: string; descriptionAr: string; families: string[]; notes: { top: string[]; heart: string[]; base: string[] } }>; audit: { checked: number; issues: { sku: string; issues: string[] }[] } };
  const file = readLive<Catalog>(ctx, 'store-catalog.json');
  if (!file) return [{ tool: 'store_catalog', question: 'ملف كتالوج المتجر', answer: '', ms: 0, ok: false, error: 'الملف غير موجود', findings: [] }];
  const entries = Object.entries(file.entries);
  const trained = entries.filter(([, e]) => e.editor === 'shaheen');
  const ageH = (ctx.now - Date.parse(file.updatedAt)) / 3600_000;
  const findings = [] as Probe['findings'];
  if (ageH > 13) findings.push({ severe: false, text: `الكتالوج لم يتحدث منذ ${Math.round(ageH)} ساعة` });
  if (!trained.length) findings.push({ severe: false, text: 'لم يراجع شاهين أي منتج بعد (بيانات بالقواعد فقط)' });
  if (file.audit.issues.length) findings.push({ severe: false, text: `${file.audit.issues.length} منتج فيها ملاحظات بيانات للتاجر` });
  const sample = rotate(trained.length ? trained : entries, ctx.run, 3);
  const answer = sample.map(([sku, e]) => `## ${sku} ${e.nameAr || ''}\n${e.descriptionAr || ''}\nالعائلة: ${e.families.join('/')} — النوتات: ${[...e.notes.top, ...e.notes.heart, ...e.notes.base].join(', ')}`).join('\n\n');
  return [{ tool: 'store_catalog', question: `كتالوج المتجر (${trained.length}/${entries.length} راجعها شاهين)`, answer, ms: 0, ok: true, findings: [...findings, ...(answer ? inspectAnswer(answer, { language: 'ar' }).filter((f) => f.severe) : [])] }];
}

function storeImportProbes(ctx: ProbeContext): Probe[] {
  type Review = {
    updatedAt: string; summary: { total: number; imported: number; ok: number; warn: number; hidden: number; imagesChecked: number; brokenImages: number };
    import?: { rate?: number; aiResumeAt?: string; sources?: { id: string; added?: number; refreshed?: number; failedCount?: number; viaShaheen?: number; sitemapProducts?: number }[] };
    items: { sku: string; name: string; status: string; issues: string[] }[];
  };
  const file = readLive<Review>(ctx, 'store-review.json');
  if (!file) return [{ tool: 'store_import', question: 'تقرير مستورد شاهين ومراجع الصفحات', answer: '', ms: 0, ok: false, error: 'التقرير غير موجود (لم يعمل المستورد بعد)', findings: [] }];
  const s = file.summary;
  const ageH = (ctx.now - Date.parse(file.updatedAt)) / 3600_000;
  const findings = [] as Probe['findings'];
  if (ageH > 13) findings.push({ severe: false, text: `المراجعة لم تتحدث منذ ${Math.round(ageH)} ساعة` });
  if (s.hidden) findings.push({ severe: s.hidden > Math.max(5, s.imported * 0.2), text: `${s.hidden} منتج مخفي لعيوب حرجة` });
  if (s.brokenImages) findings.push({ severe: s.brokenImages > Math.max(5, s.imagesChecked * 0.2), text: `${s.brokenImages}/${s.imagesChecked} صورة لا تفتح` });
  if (file.import?.aiResumeAt && Date.parse(file.import.aiResumeAt) > ctx.now) findings.push({ severe: false, text: `باقات الذكاء الاصطناعي خلصت؛ الاستيراد يكمل بعد التجديد ${file.import.aiResumeAt}` });
  for (const src of file.import?.sources || []) {
    if (src.sitemapProducts === 0) findings.push({ severe: true, text: `خريطة موقع المورد ${src.id} لم تُقرأ` });
    if ((src.failedCount || 0) > 5) findings.push({ severe: false, text: `${src.failedCount} صفحة منتج تعذرت قراءتها عند ${src.id}` });
  }
  const answer = [`${s.total} منتج (${s.imported} مستورد): ${s.ok} سليم، ${s.warn} بملاحظات، ${s.hidden} مخفي.`,
    ...(file.import?.sources || []).map((x) => `${x.id}: +${x.added ?? 0} جديد، ${x.refreshed ?? 0} محدّث، ${x.failedCount ?? 0} تعذر، ${x.viaShaheen ?? 0} قرأها شاهين`),
    ...rotate(file.items, ctx.run, 3).map((i) => `${i.sku} ${i.name}: ${i.issues.join('، ')}`)].join('\n');
  return [{ tool: 'store_import', question: 'مستورد شاهين ومراجع الصفحات', answer, ms: 0, ok: true, findings }];
}

function schoolProbes(ctx: ProbeContext): Probe[] {
  type School = { updatedAt: string; reliance: { score: number; covered: number; total: number }; lastStudied: { q: string; lang: string }[] };
  type Memory = { entries: { question: string; lang: string; answer: string; source: string }[] };
  const school = readLive<School>(ctx, 'shaheen-school.json');
  if (!school) return [{ tool: 'shaheen_school', question: 'تقرير مدرسة شاهين', answer: '', ms: 0, ok: false, error: 'التقرير غير موجود (لم تعمل المدرسة بعد)', findings: [] }];
  const findings = [] as Probe['findings'];
  const ageH = (ctx.now - Date.parse(school.updatedAt)) / 3600_000;
  if (ageH > 13) findings.push({ severe: false, text: `المدرسة لم تعمل منذ ${Math.round(ageH)} ساعة` });
  if (school.reliance.score < 50) findings.push({ severe: false, text: `شاهين يرد وحده على ${school.reliance.score}% فقط من أسئلة الامتحان` });
  // What he studied is what visitors get when every engine is down: the answers are checked like any other.
  const memory = readLive<Memory>(ctx, 'shaheen-memory.json');
  const studied = (memory?.entries || []).filter((e) => e.source === 'study');
  const sample = rotate(studied, ctx.run, 2);
  for (const e of sample) findings.push(...inspectAnswer(e.answer, { language: e.lang === 'en' ? 'en' : 'ar' }).filter((f) => f.severe));
  const answer = [`يرد وحده على ${school.reliance.covered}/${school.reliance.total} (${school.reliance.score}%) — ${studied.length} إجابة مذاكرة في ذاكرته`,
    ...sample.map((e) => `## ${e.question}\n${e.answer}`)].join('\n\n');
  return [{ tool: 'shaheen_school', question: 'مدرسة شاهين', answer, ms: 0, ok: true, findings }];
}

/** «المترجم الذكي»: is it running, how much is still English, and samples of its translations for Shaheen to judge. */
function languageAgentProbes(ctx: ProbeContext): Probe[] {
  type Report = { updatedAt: string; translation?: { status: string; remaining: number; covered: number; run: { calls: number; translated: number; rejected: number; droppedByReview: number; languages: string[] } } };
  const report = readLive<Report>(ctx, 'shaheen-languages.json');
  const t = report?.translation;
  if (!report || !t) return [{ tool: 'language_agent', question: 'تقرير المترجم الذكي', answer: '', ms: 0, ok: false, error: 'المترجم الذكي لم يعمل بعد (src/data/live/shaheen-languages.json)', findings: [] }];
  const findings = [] as Probe['findings'];
  const ageH = (ctx.now - Date.parse(report.updatedAt)) / 3600_000;
  if (ageH > 30) findings.push({ severe: false, text: `وكيل اللغات لم يعمل منذ ${Math.round(ageH)} ساعة` });
  if (t.status === 'no_engine') findings.push({ severe: false, text: 'مفيش محرك ذكاء اصطناعي شغال للترجمة' });
  if (t.status === 'engines_failed') findings.push({ severe: false, text: 'المحركات مردتش على طلبات الترجمة' });
  const tried = t.run.translated + t.run.rejected;
  if (tried >= 20 && t.run.rejected / tried > 0.4) findings.push({ severe: false, text: `نسبة رفض عالية للترجمات (${t.run.rejected}/${tried})` });
  // Samples from the newest packs: the reviewer judges real wording.
  const samples: string[] = [];
  for (const lang of rotate(t.run.languages.length ? t.run.languages : ['fr', 'de', 'tr'], ctx.run, 2)) {
    try {
      const pack = JSON.parse(readFileSync(new URL(`../../لغات/ai/${lang}.json`, ctx.liveDir), 'utf8')) as Record<string, Record<string, string>>;
      const pairs = Object.entries(pack.text || {}).concat(Object.entries(pack.ui || {}));
      for (const [en, tr] of rotate(pairs, ctx.run, 3)) samples.push(`[${lang}] ${en.slice(0, 120)} → ${tr.slice(0, 160)}`);
    } catch { /* no pack yet for this language */ }
  }
  const answer = [`الحالة: ${t.status} — لسه بالإنجليزي ${t.remaining}، مغطّى ${t.covered}، آخر دورة: ${t.run.translated} مترجمة و${t.run.rejected} مرفوضة (${t.run.droppedByReview} رفضها المراجع) في ${t.run.calls} طلب.`,
    ...samples].join('\n');
  return [{ tool: 'language_agent', question: 'المترجم الذكي (عينات من ترجماته)', answer, ms: 0, ok: true, findings }];
}

/** «مجلس شاهين»: did today's meeting take place, with real decisions, and are its tasks moving? */
function councilProbes(ctx: ProbeContext): Probe[] {
  type Council = { meetings: { date: string; at: string; mode: string; summaryAr: string; seats: { ok: boolean }[]; decisions: { title: string; kind: string; status: string; priority: string }[] }[]; tasks: { status: string; createdAt: string }[] };
  const file = readLive<Council>(ctx, 'shaheen-council.json');
  const last = file?.meetings?.[0];
  if (!last) return [{ tool: 'shaheen_council', question: 'محضر الاجتماع اليومي', answer: '', ms: 0, ok: false, error: 'لم يُعقد أي اجتماع بعد (src/data/live/shaheen-council.json)', findings: [] }];
  const findings = [] as Probe['findings'];
  const ageH = (ctx.now - Date.parse(last.at)) / 3600_000;
  if (ageH > 26) findings.push({ severe: ageH > 50, text: `آخر اجتماع منذ ${Math.round(ageH)} ساعة` });
  if (last.mode !== 'ai') findings.push({ severe: false, text: 'اجتماع اليوم بدون نقاش (لا يوجد محرك متاح) — المحضر من قواعد التقارير' });
  if (!last.decisions.length) findings.push({ severe: false, text: 'الاجتماع بلا قرارات' });
  const stale = (file!.tasks || []).filter((t) => t.status === 'open' && ctx.now - Date.parse(t.createdAt) > 7 * 86_400_000).length;
  if (stale) findings.push({ severe: false, text: `${stale} مهمة تطوير مفتوحة منذ أكثر من أسبوع (اكتب في الشات «نفذ مهام شاهين»)` });
  findings.push(...inspectAnswer(last.summaryAr, { language: 'ar', vendorNamesAllowed: true }).filter((f) => f.severe));
  const answer = [`${last.date} — ${last.seats.filter((s) => s.ok).length}/${last.seats.length} خبراء شاركوا`, last.summaryAr,
    ...last.decisions.map((d) => `- [${d.priority}/${d.kind}/${d.status}] ${d.title}`)].join('\n');
  return [{ tool: 'shaheen_council', question: 'محضر الاجتماع اليومي', answer, ms: 0, ok: true, findings }];
}

/** «منارة شاهين»: does the SEO/media agent actually run, learn, stay honest and keep its files fresh? */
function seoAgentProbes(ctx: ProbeContext): Probe[] {
  const file = readLive<unknown>(ctx, 'seo-agent.json');
  if (!file) return [{ tool: 'seo_agent', question: 'ملف حالة الوكيل', answer: '', ms: 0, ok: false, error: 'src/data/live/seo-agent.json غير موجود', findings: [] }];
  const state = readSeoState(file);
  const ageH = (ctx.now - Date.parse(state.updatedAt)) / 3600_000;
  const findings = [] as Probe['findings'];
  if (state.trust.cycles > 0 && ageH > 8) findings.push({ severe: true, text: `لم يحدّث الوكيل حالته منذ ${Math.round(ageH)} ساعة` });
  if (state.audit.score < 60) findings.push({ severe: true, text: `تقييم الموقع ${state.audit.score}/100` });
  else if (state.audit.score < 75) findings.push({ severe: false, text: `تقييم الموقع ${state.audit.score}/100 يحتاج تحسيناً` });
  if (state.audit.bySeverity.critical > 2) findings.push({ severe: true, text: `${state.audit.bySeverity.critical} ملاحظات SEO حرجة` });
  else if (state.audit.bySeverity.critical > 0) findings.push({ severe: false, text: `${state.audit.bySeverity.critical} ملاحظة حرجة قيد المعالجة` });
  if (state.trust.cycles >= 6 && state.trust.level === 'trainee') findings.push({ severe: false, text: 'ما زال في التدريب بعد 6 دورات (لا يوجد محرك أو تقييم من شاهين)' });
  if (state.curriculum.studied.length < Math.min(state.trust.cycles, 24)) findings.push({ severe: false, text: `درس ${state.curriculum.studied.length} فقط من 24` });
  if (!state.mediaReport || (ctx.now - Date.parse(state.mediaReport.at)) / 3600_000 > 30) findings.push({ severe: false, text: 'تقرير المندوب الإعلامي غير محدّث' });
  if (state.trust.cycles > 0 && !state.submissions.some((s) => s.ok)) findings.push({ severe: false, text: 'لا يوجد إرسال ناجح لمحركات البحث بعد' });
  if (!state.audit.at) findings.push({ severe: true, text: 'لا يوجد فحص موثّق للموقع' });
  const last = state.runs.at(-1);
  const answer = [
    `المرحلة: ${state.trust.level} · ${stateSummary(state)}`,
    `آخر دورة: ${last ? `${last.lessonId || '—'} في ${last.at} — ${last.notes.join(' · ') || 'بلا ملاحظات'}` : 'لم تُسجل دورة بعد'}`,
    `آخر درس: ${state.curriculum.notes.at(-1)?.titleAr || '—'} — ${state.curriculum.notes.at(-1)?.takeaway || '—'}`,
    `تقييم شاهين: ${state.coach?.score ?? '—'}/10${state.coach?.guidance ? ` — ${state.coach.guidance}` : ''}`,
    `التقرير الإعلامي: ${state.mediaReport?.headline || '—'}`,
  ].join('\n');
  return [{ tool: 'seo_agent', question: 'حالة منارة شاهين (SEO والمندوب الإعلامي)', answer, ms: 0, ok: true, findings: [...findings, ...(state.audit.bySeverity.critical > 0 ? [{ severe: false, text: state.audit.findings.find((f) => f.severity === 'critical')?.title || '' }].filter((f) => f.text) : [])] }];
}

/** Only a redacted health status reaches the supervisor's public report. Never export the ledger. */
async function financeProbes(ctx: ProbeContext): Promise<Probe[]> {
  if (!ctx.adminToken) return [];
  const r = await timed(() => json<{ persistent: boolean; overdue: boolean; criticalIssues: number; lastRunAt: string | null }>(ctx.fetch,
    `${ctx.site}/api/admin/finance/status`, { headers: { Authorization: `Bearer ${ctx.adminToken}` } }, 15000));
  const findings: Probe['findings'] = [];
  if (r.value && !r.value.persistent) findings.push({ severe: true, text: 'الإدارة المالية بلا تخزين دائم — الدفع الحي محجوب' });
  if (r.value?.overdue) findings.push({ severe: false, text: 'الفحص المالي الدوري لم يعمل أو تجاوز 36 ساعة' });
  if (r.value?.criticalIssues) findings.push({ severe: true, text: 'توجد ملاحظات مالية حرجة في لوحة الإدارة الخاصة' });
  return [{ tool: 'finance_agent', question: 'سلامة الإدارة المالية والجدولة', answer: r.value ? 'فحص حالة أمين شاهين فقط؛ التفاصيل المالية وبيانات الطلبات لا تخرج من لوحة الإدارة.' : '',
    ms: r.ms, ok: Boolean(r.value), error: r.error ? 'تعذّر فحص الإدارة المالية' : undefined, findings }];
}

/** «مسؤول التعاقدات»: the approved answers must pass the legal manager's checks (offline), and the live status (counts only). */
const SAMPLE_SENDER: Sender = { ...EMPTY_SENDER, name: 'Sample Sender', title: 'Partnerships', entityName: 'Sample', email: 'team@example.org', platformName: 'Sample Platform' };
const CONTRACT_QUESTIONS = ['How much margin do you add on our prices?', 'هل أنت روبوت؟ وفين رابط موقعكم؟', 'Can we stop anytime? Is it exclusive?'];
async function contractsProbes(ctx: ProbeContext): Promise<Probe[]> {
  const probes: Probe[] = CONTRACT_QUESTIONS.map((q) => {
    const answer = templateReply(q, SAMPLE_SENDER);
    const check = checkLetter(answer, 'reply', SAMPLE_SENDER);
    return { tool: 'contracts_agent', question: q, answer, ms: 0, ok: check.ok, findings: check.problems.map((p) => ({ severe: true, text: `الرد الجاهز يخالف ${p.id}: ${p.textAr}` })) };
  });
  if (!ctx.adminToken) return probes;
  const r = await timed(() => json<{ ready: boolean; emailProvider: string; senderMissing: string[]; counts: Record<string, number> }>(ctx.fetch,
    `${ctx.site}/api/admin/contracts/status`, { headers: { Authorization: `Bearer ${ctx.adminToken}` } }, 15000));
  const findings: Probe['findings'] = [];
  if (r.value && !r.value.ready) findings.push({ severe: false, text: 'التعاقدات محتاجة قاعدة بيانات المجتمع على الخادم' });
  if (r.value?.senderMissing?.length) findings.push({ severe: false, text: 'بيانات المرسل في تبويب «التعاقدات» ناقصة' });
  if (r.value?.ready && !r.value.emailProvider) findings.push({ severe: false, text: 'مفيش مزود إيميل: التوقيع بيتأكد برد الإيميل بدل الكود' });
  if (r.value?.counts?.signed) findings.push({ severe: false, text: `${r.value.counts.signed} اتفاقية موقّعة مستنية اعتماد المدير القانوني` });
  probes.push({ tool: 'contracts_agent', question: 'حالة نظام التعاقدات', answer: r.value ? `جاهز: ${r.value.ready ? 'نعم' : 'لا'} · الأعداد فقط: ${JSON.stringify(r.value.counts || {})}` : '',
    ms: r.ms, ok: Boolean(r.value), error: r.error ? 'تعذّر فحص حالة التعاقدات' : undefined, findings });
  return probes;
}

/** The design specialist is admin-only; without the configured admin credential it is honestly skipped. */
async function designAgentProbes(ctx: ProbeContext): Promise<Probe[]> {
  if (!ctx.adminToken) return [];
  const question = 'راجع تجربة شراء عطر على الهاتف، واقترح بنية صفحة متجاوبة واضحة وسهلة الوصول باتجاه RTL دون اختراع بيانات أو تعديل الموقع.';
  const r = await timed(() => json<DesignBriefResponse>(ctx.fetch, `${ctx.site}/api/admin/design/brief`, post({
    brief: question,
    specialty: 'ui_ux',
    platform: 'website_page',
    objective: 'usability',
    language: 'ar',
    audience: 'متسوقو العطور عبر الهاتف',
  }, { Authorization: `Bearer ${ctx.adminToken}` }), 42_000));
  const c = r.value?.creative;
  const answer = c ? [c.title, c.concept, c.format, c.strategy, c.audience, c.visualDirection, c.informationArchitecture, c.layout,
    ...c.palette.map((x) => `${x.name} ${x.hex}: ${x.use}`), c.typography, c.experienceFlow, c.interactionNotes, c.responsiveNotes,
    c.accessibilityNotes, c.productionNotes, c.successCriteria, c.headline, c.caption, c.cta, c.assetDirection, c.altText,
    ...c.qualityChecklist].filter(Boolean).join('\n') : '';
  const findings = r.error ? [] : !c
    ? [{ severe: true, text: 'لم يرجع تصور تصميم متكامل' }]
    : [
      ...inspectAnswer(answer, { language: 'ar', ms: r.ms, maxChars: 9000 }),
      ...(c.specialty !== 'ui_ux' ? [{ severe: true, text: 'التخصص المعاد لا يطابق طلب تجربة المستخدم' }] : []),
      ...(c.palette.length < 3 || c.palette.some((color) => !/^#[\da-f]{6}$/i.test(color.hex)) ? [{ severe: true, text: 'لوحة الألوان ناقصة أو رمز HEX غير صالح' }] : []),
      ...([c.strategy, c.informationArchitecture, c.experienceFlow, c.responsiveNotes, c.accessibilityNotes, c.productionNotes, c.successCriteria].some((value) => !value.trim()) ? [{ severe: true, text: 'حقول الخطة أو الاستجابة أو الإتاحة ناقصة' }] : []),
      ...(c.qualityChecklist.length < 2 ? [{ severe: true, text: 'قائمة فحص التصميم قصيرة أو مفقودة' }] : []),
      ...((c.caption || '').length > 500 ? [{ severe: false, text: 'النص الإعلاني أطول من الحد المقترح' }] : []),
    ];
  return [{ tool: 'design_agent', question, answer, ms: r.ms, ok: !r.error && Boolean(c), error: r.error, findings }];
}


function platformOwnerProbes(): Probe[] {
  // وكيل ملك المنصة يشتغل من الشات (مِثل وكيل البرمجة)، وليس له نقطة نهاية HTTP خاصة به.
  // المستكشف يتحقق من إن الأداة مسجلة ومن إن تعليمات الجودة مقبولة.
  return [{ tool: 'platform_owner_agent', question: 'تأكيد تسجيل وكيل ملك المنصة تحت إدارة شاهين', answer: 'مسجل تحت قسم القيادة، خاضع لدولة المنصة، وأوامر صاحب الموقع فوق أوامره.', ms: 0, ok: true, findings: [] }];
};

/**
 * «وكيل مجلس المتخصصين»: المجلس وأدواته، وأسئلة من **بنك تدريب المجلس نفسه** — فأداة الإشراف بتقيس
 * على الموقع الحي نفس الحالات اللي الوكيل متدرّب عليها في `scripts/shaheen-specialists/questions.ts`،
 * مش أسئلة تانية. كل سؤال لازم يوصل لمتخصصه، ويشغّل أداة واحدة على الأقل، ويرد من معلومة مكتوبة
 * (مش فجوة). الحالات اللي محتاجة سياق (سؤال قبلها، أو متخصص اختاره الزائر، أو ذاكرة محفوظة)
 * بتتقاس في الاختبارات مش هنا — لأن الاستكشاف بيبعت سؤال واحد من غير تاريخ.
 */
const SPECIALIST_QUESTIONS: { q: string; lang: 'ar' | 'en'; specialist?: string; expect: 'solid' | 'any' }[] = TRAINING_CASES
  .filter((c) => c.expect.ok !== false && !c.previous && !c.specialistId && !c.memory)
  .map((c) => ({
    q: c.ask,
    lang: c.lang || 'ar',
    ...(typeof c.expect.specialist === 'string' ? { specialist: c.expect.specialist } : {}),
    expect: 'solid' as const,
  }));

async function specialistsProbes(ctx: ProbeContext): Promise<Probe[]> {
  const out: Probe[] = [];
  type Board = { specialists?: { id: string }[]; tools?: { id: string }[]; ai?: boolean };
  const board = await timed(() => json<Board>(ctx.fetch, `${ctx.site}/api/specialists/board`));
  const b = board.value;
  const boardFindings: Probe['findings'] = [];
  if (!board.error) {
    if ((b?.specialists?.length || 0) < 10) boardFindings.push({ severe: true, text: `المجلس ناقص متخصصين (${b?.specialists?.length || 0})` });
    if ((b?.tools?.length || 0) < 20) boardFindings.push({ severe: true, text: `صندوق أدوات الوكيل ناقص (${b?.tools?.length || 0} أداة)` });
    if (b?.ai === false) boardFindings.push({ severe: false, text: 'الوكيل بيرد من أدواته بس (مفيش محرك متاح دلوقتي)' });
  }
  out.push({
    tool: 'specialists_agent', question: 'GET /api/specialists/board (المجلس وأدواته)',
    answer: b ? `${b.specialists?.length || 0} متخصصين · ${b.tools?.length || 0} أداة · وكيل بمحرك: ${b.ai ? 'نعم' : 'لأ'}` : '',
    ms: board.ms, ok: !board.error && (b?.specialists?.length || 0) >= 10 && (b?.tools?.length || 0) >= 20, error: board.error, findings: boardFindings,
  });
  type Consult = { answer?: string; source?: string; ok?: boolean; ai?: boolean; specialist?: { id: string; nameAr?: string }; tools?: { tool: string; ok: boolean }[] };
  for (const { q, lang, specialist, expect } of rotate(SPECIALIST_QUESTIONS, ctx.run, 3)) {
    const r = await timed(() => json<Consult>(ctx.fetch, `${ctx.site}/api/specialists/consult`, post({ question: q, language: lang, visitorId: VISITOR })));
    const v = r.value;
    const answer = v?.answer || '';
    const findings: Probe['findings'] = r.error ? [] : inspectAnswer(answer, { language: lang, ms: r.ms, maxChars: 3000 });
    if (!r.error) {
      if (specialist && v?.specialist?.id !== specialist) findings.push({ severe: false, text: `السؤال اتوجّه لـ«${v?.specialist?.id || '؟'}» بدل «${specialist}»` });
      if (!(v?.tools || []).some((t) => t.ok)) findings.push({ severe: true, text: 'الوكيل رد من غير ما يشتغل أي أداة' });
      if (expect === 'solid' && v?.source === 'gap') findings.push({ severe: true, text: 'سؤال من منهج المدرسة أو الموسوعة رجع فجوة — الأدوات مالحقتش تذاكره' });
      if (answer && !/من |From /i.test(answer)) findings.push({ severe: false, text: 'الرد من غير سطر مصدر' });
    }
    out.push({ tool: 'specialists_agent', question: q, answer, ms: r.ms, ok: !r.error && Boolean(answer), error: r.error, findings });
  }
  return out;
}

export const PROBES: Record<AiToolId, (ctx: ProbeContext) => Probe[] | Promise<Probe[]>> = {
  finance_agent: financeProbes,
  contracts_agent: contractsProbes,
  shaheen_chat: chatProbes,
  sham_assistant: assistantProbes,
  specialists_agent: specialistsProbes,
  news_articles: newsArticleProbes,
  news_bulletin: bulletinProbes,
  assistant_training: trainingProbes,
  media: mediaProbes,
  admin_agent: adminProbes,
  owner_room: ownerRoomProbes,
  store_advisor: storeAdvisorProbes,
  store_catalog: storeCatalogProbes,
  store_import: storeImportProbes,
  shaheen_school: schoolProbes,
  seo_agent: seoAgentProbes,
  design_agent: designAgentProbes,
  shaheen_council: councilProbes,
  language_agent: languageAgentProbes,
  platform_owner_agent: platformOwnerProbes,
};
