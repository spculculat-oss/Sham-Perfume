/**
 * How Shaheen tests each AI tool: real requests to the live site (the same API GitHub Pages uses), or a
 * look at the files a tool publishes. Questions rotate every run, so answer caches do not hide problems.
 */
import { readFileSync } from 'node:fs';
import type { AiToolId } from '../../src/utils/aiTools';
import { inspectAnswer, type Probe } from './checks';

type Fetch = typeof fetch;
export interface ProbeContext { site: string; fetch: Fetch; run: number; adminToken?: string; now: number; liveDir: URL }

export const QUESTIONS: Record<'shaheen_chat' | 'sham_assistant', { q: string; lang: 'ar' | 'en' }[]> = {
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
    const r = await timed(() => json<{ reply?: string }>(ctx.fetch, `${ctx.site}/api/chat`, post({ message: q, model: 'auto', language: lang, conversationHistory: [], visitorId: VISITOR })));
    const answer = r.value?.reply || '';
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
  const answer = articles.map((a) => `## ${a.titleAr || ''}\n${a.summaryAr || ''}\n${(a.contentAr || '').slice(0, 500)}`).join('\n\n');
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
  const answer = sample.map((d) => `## ${d.title}\n${d.content.slice(0, 900)}`).join('\n\n');
  return [{ tool: 'assistant_training', question: `أحدث الدروس (${lessons.length} درس)`, answer, ms: 0, ok: true, findings: [...findings, ...(answer ? inspectAnswer(answer, { language: 'ar' }) : [])] }];
}

async function adminProbes(ctx: ProbeContext): Promise<Probe[]> {
  if (!ctx.adminToken) return [];
  const r = await timed(() => json<{ summary?: string; sections?: { title: string }[] }>(ctx.fetch, `${ctx.site}/api/admin/agent`, post({ message: 'تقرير اليوم' }, { Authorization: `Bearer ${ctx.adminToken}` })));
  const answer = `${r.value?.summary || ''}\n${(r.value?.sections || []).map((s) => `- ${s.title}`).join('\n')}`.trim();
  return [{ tool: 'admin_agent', question: 'تقرير اليوم', answer, ms: r.ms, ok: !r.error, error: r.error, findings: r.error ? [] : inspectAnswer(answer, { language: 'ar', ms: r.ms, vendorNamesAllowed: true }) }];
}

export const PROBES: Record<AiToolId, (ctx: ProbeContext) => Probe[] | Promise<Probe[]>> = {
  shaheen_chat: chatProbes,
  sham_assistant: assistantProbes,
  news_articles: newsArticleProbes,
  news_bulletin: bulletinProbes,
  assistant_training: trainingProbes,
  media: mediaProbes,
  admin_agent: adminProbes,
};
