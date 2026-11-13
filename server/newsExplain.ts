/**
 * «نشرة شاهين — شاهين يشرحلك الخبر»: a visitor presses the button under a story and Shaheen explains it in the
 * visitor's language — a clear title, two or three sentences on what happened, and what it means for perfume
 * lovers — from the headline and snippet only (nothing invented). The robot writes the bulletin every run; this
 * makes every story readable at once even when that run had no AI editor (headlines only).
 *   POST /api/news/explain  { id, language }  →  { title, summary, note }
 * Only stories in the published bulletin can be explained (the server reads the file itself, never the visitor's
 * text), answers are cached per story and language, and visitors never see an AI vendor's name.
 */
import express from 'express';
import { callEngine } from './core/engines';
import { RateLimiter, clientKey } from './core/rateLimit';
import { configuredEngines } from './workspace';
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from '../src/types/i18n';
import type { NewsFile, NewsItem } from '../scripts/shaheen-news/curate';
import bundled from '../src/data/live/shaheen-news.json';

type Env = Record<string, string | undefined>;
export interface Explained { title: string; summary: string; note: string }
const LIVE_NEWS_URL = 'https://raw.githubusercontent.com/spculculat-oss/Sham-Perfume/main/src/data/live/shaheen-news.json';
const LANGS = new Set<string>(SUPPORTED_LANGUAGES.map((l) => l.code));
const isNewsFile = (data: unknown): data is NewsFile => {
  const d = data as NewsFile;
  return Boolean(d && typeof d === 'object' && typeof d.updatedAt === 'string' && Array.isArray(d.items)
    && d.items.every((i) => i && typeof i.id === 'string' && typeof i.url === 'string' && typeof i.original === 'string' && typeof i.title?.ar === 'string'));
};

const VENDOR = /\b(?:gemini|openai|chatgpt|gpt-?\d|claude|anthropic|deepseek|openrouter|perplexity|llama|mistral|google ai)\b/i;
const LANGUAGE_NAMES: Partial<Record<SupportedLanguage, string>> = {
  ar: 'العربية بلهجة مصرية بسيطة ومفهومة', en: 'English', fr: 'French', es: 'Spanish', it: 'Italian', de: 'German', ru: 'Russian', zh: 'Simplified Chinese', tr: 'Turkish', fa: 'Persian',
};
export const languageName = (lang: SupportedLanguage) => LANGUAGE_NAMES[lang] || new Intl.DisplayNames(['en'], { type: 'language' }).of(lang) || 'English';

export function explainSystem(lang: SupportedLanguage): string {
  return `أنت «الخبير شاهين»، خبير العطور في منصة «شام». زائر طلب منك تشرح له خبر عطور حقيقي.
اكتب بلغة: ${languageName(lang)}.
- عنوان واضح بلغة الزائر (أسماء الماركات والأشخاص زي ما هي بالحروف اللاتينية لو مالهاش اسم مشهور بلغته).
- ملخص من جملتين أو تلاتة: إيه اللي حصل، مين، وفين — من العنوان والمقتطف والمصدر بس.
- تعليق قصير منك كخبير: الخبر ده يعني إيه لمحب العطور أو لحد بيصمم عطره.
ممنوع تخترع أرقام أو أسعار أو تواريخ أو تفاصيل مش موجودة. لو المعلومة ناقصة قول كده بوضوح وباختصار.
ماتذكرش أي اسم لنموذج ذكاء اصطناعي أو شركة تقنية تخصك. رد بـ JSON بس بالشكل: {"title":"","summary":"","note":""}`;
}
export function explainPrompt(item: NewsItem): string {
  const snippet = item.summary.en && item.summary.en !== item.original ? item.summary.en.slice(0, 600) : '';
  return `العنوان الأصلي: ${item.original}\nالمصدر: ${item.source}${item.publishedAt ? `\nتاريخ النشر: ${item.publishedAt.slice(0, 10)}` : ''}${snippet ? `\nالمقتطف: ${snippet}` : ''}`;
}

const clean = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/[\u0590-\u05FF]/g, '').replace(/\s+/g, ' ').trim().slice(0, max) : '');
/** The engine's JSON as a safe explanation (no vendor names, sensible lengths), or undefined. */
export function readExplanation(reply: string): Explained | undefined {
  const body = reply.replace(/```(?:json)?/gi, '');
  const start = body.indexOf('{'); const end = body.lastIndexOf('}');
  if (start < 0 || end <= start) return undefined;
  try {
    const data = JSON.parse(body.slice(start, end + 1)) as Record<string, unknown>;
    const out = { title: clean(data.title, 200), summary: clean(data.summary, 700), note: clean(data.note, 400) };
    if (!out.title || !out.summary || VENDOR.test(`${out.title} ${out.summary} ${out.note}`)) return undefined;
    return out;
  } catch { return undefined; }
}

/** The bulletin as published: the repository copy when it is newer than the one built in (checked every 10 min). */
export function newsSource({ fetch: request = fetch, now = () => Date.now() }: { fetch?: typeof fetch; now?: () => number } = {}) {
  let live: NewsFile | undefined;
  let checkedAt = 0;
  return async (): Promise<NewsFile> => {
    const built = bundled as unknown as NewsFile;
    if (now() - checkedAt > 10 * 60_000) {
      checkedAt = now();
      try {
        const response = await request(LIVE_NEWS_URL, { signal: AbortSignal.timeout(8000) });
        const data: unknown = response.ok ? await response.json() : undefined;
        if (isNewsFile(data)) live = data;
      } catch { /* the built-in copy is still real news */ }
    }
    return live && Date.parse(live.updatedAt) > Date.parse(built.updatedAt) ? live : built;
  };
}

export function createNewsRouter(options: { env?: Env; fetch?: typeof fetch; news?: () => Promise<NewsFile> } = {}) {
  const env = options.env || process.env;
  const request = options.fetch || fetch;
  const news = options.news || newsSource({ fetch: request });
  const limiter = new RateLimiter(20, 60_000);
  const cache = new Map<string, Explained>();
  const router = express.Router();

  router.post('/explain', async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const body = (req.body && typeof req.body === 'object' ? req.body : {}) as Record<string, unknown>;
    const id = typeof body.id === 'string' && /^n[a-z0-9]{1,16}$/.test(body.id) ? body.id : '';
    const language = typeof body.language === 'string' && LANGS.has(body.language) ? body.language as SupportedLanguage : 'ar';
    if (!id) { res.status(400).json({ error: 'Unknown story', code: 'BAD_REQUEST' }); return; }
    const key = `${id}:${language}`;
    const cached = cache.get(key);
    if (cached) { res.json({ ...cached, cached: true }); return; }
    if (!limiter.allow(clientKey(req))) { res.status(429).json({ error: 'Too many requests, wait a minute', code: 'RATE_LIMITED' }); return; }
    const item = (await news()).items.find((i) => i.id === id);
    if (!item) { res.status(404).json({ error: 'This story is no longer in the bulletin', code: 'NOT_FOUND' }); return; }
    const engines = configuredEngines(env);
    if (!engines.length) { res.status(503).json({ error: 'Shaheen can’t explain stories right now', code: 'NO_ENGINE' }); return; }
    for (const engine of engines) {
      try {
        const reply = await callEngine(engine, explainSystem(language), [{ role: 'user', text: explainPrompt(item) }], {
          env, fetch: request, signal: AbortSignal.timeout(30_000), temperature: 0.3, maxTokens: 700, maxChars: 4000,
        });
        const out = typeof reply === 'string' ? readExplanation(reply) : undefined;
        if (out) {
          if (cache.size > 600) cache.delete(cache.keys().next().value!);
          cache.set(key, out);
          res.json(out);
          return;
        }
      } catch { /* the next platform */ }
    }
    res.status(503).json({ error: 'Shaheen is busy, try again in a minute', code: 'ENGINES_BUSY' });
  });
  return router;
}
