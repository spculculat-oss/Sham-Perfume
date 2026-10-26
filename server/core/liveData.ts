/**
 * What «الخبير شاهين» publishes every 12 hours (scripts/shaheen-news): the perfume news and the lessons
 * he wrote for «مساعد شام», and his quality guidance for every AI tool (scripts/shaheen-supervisor). The files ship inside the build and are refreshed at run time from the
 * repository, so the server learns each update without waiting for a redeploy.
 */
import bundledNews from '../../src/data/live/shaheen-news.json';
import bundledTraining from '../../src/data/live/sham-training.json';
import bundledSupervisor from '../../src/data/live/ai-supervisor.json';
import bundledStore from '../../src/data/live/store-catalog.json';
import bundledTrade from '../../src/data/live/trade-lanes.json';
import bundledGraph from '../../src/data/live/shaheen-graph.json';
import { isCatalogFile, type StoreCatalogFile } from '../../src/utils/storeCatalog';
import { isShaheenGraph, type ShaheenGraph } from '../../src/utils/shaheenGraph';
import { guidanceBlock, type AiToolId } from '../../src/utils/aiTools';
import type { KnowledgeDoc } from './types';

type Env = Record<string, string | undefined>;
export interface LiveNewsItem { id: string; url: string; source: string; publishedAt?: string; category?: string; importance?: number; title: { ar: string; en: string }; summary: { ar: string; en: string } }
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

/** Any other published file (e.g. «ذاكرة شاهين»): the bundled copy, refreshed from the repository like the rest. */
export const loadLive = load;

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

interface SupervisorFile { updatedAt: string; tools: Partial<Record<AiToolId, { guidance?: { text?: string } }>> }
const isSupervisor = (d: unknown): d is SupervisorFile => Boolean(d && typeof d === 'object' && typeof (d as SupervisorFile).updatedAt === 'string' && (d as SupervisorFile).tools && typeof (d as SupervisorFile).tools === 'object');

/**
 * The quality guidance «الخبير شاهين» wrote for one AI tool after reviewing its real answers, as a block
 * to append to that tool's instructions ('' when there is none, and always '' in tests and dev).
 */
export async function supervisorGuidance(tool: AiToolId, env: Env = process.env, request: typeof fetch = fetch): Promise<string> {
  if (!liveDataEnabled(env)) return '';
  const file = await load('ai-supervisor.json', bundledSupervisor as SupervisorFile, isSupervisor, env, request).catch(() => undefined);
  const text = file?.tools?.[tool]?.guidance?.text;
  return typeof text === 'string' ? guidanceBlock(text.slice(0, 1200)) : '';
}

/** Shaheen's enrichment of the store products (scripts/shaheen-store); the bundled copy in tests and dev. */
/** «الشحن والتجارة»: the trade robot's own report — the only source the board may quote for a shipping price. */
export interface TradeLanesFile {
  updatedAt: string;
  destinations: {
    code: string; nameAr: string; lane: string; promise: string;
    /** What the visitor paid with the old zone prices (kept for the comparison). */
    chargedEgp: number;
    /** What the visitor pays now: the carrier's real cost + the merchant's handling margin (`null` = no published rate). */
    proposedChargedEgp?: number | null;
    /** The carrier's real cost for the first bottle; `[low, high]` for 500 g → 1 kg. */
    costEgp?: [number, number] | null;
    /** The carrier that actually carries this lane, with the published source it came from. */
    carrier?: { id: string; nameAr: string; source?: string | null } | null;
    customs: { verified: boolean; vatPercent: number | null; dutyPercent: [number, number] | null; deMinimis: string | null; restricted: string | null; noteAr: string };
  }[];
  platforms: { id: string; nameAr: string; fulfilment: string; originCountry: string | null; shipsTo: string[]; products: number }[];
  origins: { code: string; nameAr: string; products: number }[];
  shippingProposal: { nameAr: string; currentFirstItem: number; currency: string }[];
  money?: {
    profitPerBottleEgp: number; pricedDestinations: number; keptWholeDestinations: number;
    marginEatenDestinations: number; costBasedDestinations: number; uncoveredDestinations: number;
    medianShippingMarginEgp: number | null;
  };
}

export async function liveTradeLanes(env: Env = process.env, request: typeof fetch = fetch): Promise<TradeLanesFile | undefined> {
  const file = await load('trade-lanes.json', bundledTrade as TradeLanesFile, (d): d is TradeLanesFile => Boolean(d && typeof d === 'object' && typeof (d as TradeLanesFile).updatedAt === 'string' && Array.isArray((d as TradeLanesFile).destinations)), env, request);
  return file;
}

/** «شبكة عقل شاهين»: the mind itself — nodes, edges (each with its source and date) and the mind's score. */
export async function liveMindGraph(env: Env = process.env, request: typeof fetch = fetch): Promise<ShaheenGraph | undefined> {
  const file = await load('shaheen-graph.json', bundledGraph as ShaheenGraph, isShaheenGraph, env, request);
  return file;
}

export async function liveStoreCatalog(env: Env = process.env, request: typeof fetch = fetch): Promise<StoreCatalogFile> {
  return load('store-catalog.json', bundledStore as unknown as StoreCatalogFile, isCatalogFile, env, request);
}
