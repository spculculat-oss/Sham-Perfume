/**
 * What «الخبير شاهين» publishes every 12 hours (scripts/shaheen-news): the perfume news and the lessons
 * he wrote for «مساعد شام». The files ship inside the build and are refreshed at run time from the
 * repository, so the server learns each update without waiting for a redeploy.
 */
import bundledNews from '../../src/data/live/shaheen-news.json';
import bundledTraining from '../../src/data/live/sham-training.json';
import type { KnowledgeDoc } from './types';

type Env = Record<string, string | undefined>;
export interface LiveNewsItem { id: string; url: string; source: string; publishedAt?: string; title: { ar: string; en: string }; summary: { ar: string; en: string } }
export interface LiveNews { updatedAt: string; items: LiveNewsItem[] }
interface TrainingFile { updatedAt: string; docs: { id: string; title: string; content: string; tags: string[]; updatedAt: string }[] }

export const LIVE_DATA_BASE = 'https://raw.githubusercontent.com/spculculat-oss/Sham-Perfume/main/src/data/live/';
const FRESH_MS = 30 * 60_000;
const RETRY_MS = 10 * 60_000;

/** On by default where the site is really served (Vercel / production); off in tests and dev unless SHAM_LIVE_DATA=on. */
export function liveDataEnabled(env: Env) {
  const flag = env.SHAM_LIVE_DATA?.trim().toLowerCase();
  if (flag === 'off') return false;
  return flag === 'on' || Boolean(env.VERCEL) || env.NODE_ENV === 'production';
}

type Entry<T> = { at: number; data: T; pending?: Promise<void> };
const cache = ((globalThis as { __shamLiveData?: Map<string, Entry<unknown>> }).__shamLiveData ??= new Map());

const newer = <T extends { updatedAt: string }>(a: T, b: T) => (Date.parse(b.updatedAt) > Date.parse(a.updatedAt) ? b : a);

async function load<T extends { updatedAt: string }>(file: string, bundled: T, valid: (data: unknown) => data is T, env: Env, request: typeof fetch): Promise<T> {
  if (!liveDataEnabled(env)) return bundled;
  let entry = cache.get(file) as Entry<T> | undefined;
  if (!entry) { entry = { at: 0, data: bundled }; cache.set(file, entry); }
  if (Date.now() - entry.at > FRESH_MS && !entry.pending) {
    const current = entry;
    current.pending = (async () => {
      try {
        const base = env.SHAM_LIVE_DATA_URL?.trim() || LIVE_DATA_BASE;
        const response = await request(`${base.replace(/\/?$/, '/')}${file}`, { signal: AbortSignal.timeout(3000) });
        const data: unknown = response.ok ? await response.json() : undefined;
        if (valid(data)) { current.data = newer(current.data, data); current.at = Date.now(); }
        else current.at = Date.now() - FRESH_MS + RETRY_MS;
      } catch { current.at = Date.now() - FRESH_MS + RETRY_MS; }
      finally { current.pending = undefined; }
    })();
    // The first request after a cold start waits briefly; later ones answer from the cache while it refreshes.
    if (current.data === bundled) await current.pending;
  }
  return entry.data;
}

const isTraining = (d: unknown): d is TrainingFile => Boolean(d && typeof d === 'object' && typeof (d as TrainingFile).updatedAt === 'string' && Array.isArray((d as TrainingFile).docs));
const isNews = (d: unknown): d is LiveNews => Boolean(d && typeof d === 'object' && typeof (d as LiveNews).updatedAt === 'string' && Array.isArray((d as LiveNews).items));

/** Lessons Shaheen wrote for the Sham assistant, as read-only knowledge documents. */
export async function trainedKnowledge(env: Env = process.env, request: typeof fetch = fetch): Promise<KnowledgeDoc[]> {
  // Off in tests and dev (deterministic answers); the published lessons change every 12 hours.
  if (!liveDataEnabled(env)) return [];
  const file = await load('sham-training.json', bundledTraining as TrainingFile, isTraining, env, request);
  return file.docs
    .filter((d) => d && typeof d.id === 'string' && typeof d.title === 'string' && typeof d.content === 'string')
    .map((d) => ({ id: d.id, title: d.title, content: d.content, tags: Array.isArray(d.tags) ? d.tags.filter((t) => typeof t === 'string') : [], updatedAt: d.updatedAt || file.updatedAt }));
}

export async function liveNews(env: Env = process.env, request: typeof fetch = fetch): Promise<LiveNews> {
  return load('shaheen-news.json', bundledNews as LiveNews, isNews, env, request);
}

const NEWS_QUESTION = /(?:اخبار|أخبار|خبر|جديد|الجديد|احدث|أحدث|اخر|آخر|ترند|تريند|صيحات|موضه|موضة|اطلاق|إطلاق|news|latest|newest|recent|trend|launch|nouveaut|actualit|novedad|neuheit|haber|yeni)/i;
export const asksForNews = (question: string) => NEWS_QUESTION.test(question);

/** A short block of today's real headlines for Shaheen's prompt, only when the visitor asks about news. */
export async function newsContext(question: string, language: string, env: Env = process.env, request: typeof fetch = fetch): Promise<string> {
  if (!liveDataEnabled(env) || !asksForNews(question)) return '';
  const news = await liveNews(env, request).catch(() => undefined);
  if (!news?.items.length) return '';
  const lines = news.items.slice(0, 10).map((i) => `- ${language === 'ar' ? i.title.ar : i.title.en} (${i.source}${i.publishedAt ? `، ${i.publishedAt.slice(0, 10)}` : ''})`);
  return `\nآخر أخبار العطور الحقيقية التي جمعتَها من الإنترنت بتاريخ ${news.updatedAt.slice(0, 10)} (استخدمها إذا سأل المستخدم عن الأخبار أو الجديد، ولا تخترع أخباراً غيرها، وأحِله لصفحة «أخبار العطور» في الموقع للتفاصيل):\n${lines.join('\n')}`;
}
