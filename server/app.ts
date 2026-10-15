import express from 'express';
import dotenv from 'dotenv';
import { createShaheenRouter } from './shaheen';
import { createMediaRouter } from './media';
import { createShamCore } from './core/http';
import { callEngine, engineStatuses } from './core/engines';
import { supervisorGuidance } from './core/liveData';
import { RateLimiter, clientKey } from './core/rateLimit';
import { corsMiddleware } from './cors';

dotenv.config();

const app = express();

// Rate limits use the client IP; trust exactly the configured number of proxy hops (Vercel = 1).
const trustProxy = process.env.SHAM_TRUST_PROXY ?? (process.env.VERCEL || process.env.SHAM_SERVERLESS ? '1' : '');
if (trustProxy) app.set('trust proxy', /^\d+$/.test(trustProxy) ? Number(trustProxy) : trustProxy);

// The GitHub Pages build calls this API cross-origin (see server/cors.ts). Must run before body parsing.
app.use('/api', corsMiddleware(process.env.SHAM_CORS_ORIGINS));
app.use(express.json({ limit: '128kb' }));
app.use((error: any, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (error?.type === 'entity.parse.failed' || error?.type === 'entity.too.large') {
    res.status(error.status || 400).json({ error: 'Invalid JSON request body', code: 'INVALID_REQUEST' });
    return;
  }
  next(error);
});

// Sham Core (services assistant + admin) and the shared settings store used by Shaheen as well.
const shamCore = createShamCore();

app.get('/api/health', (_req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  // `version` = deployed commit: the maintenance agent compares it with main to spot a stale deploy.
  res.json({ service: 'sham-perfume', status: 'ok', version: shamCore.runtime.version, uptimeS: Math.round((Date.now() - shamCore.runtime.startedAt) / 1000) });
});

// «الخبير شاهين»: GET /api/models + POST /api/chat. Settings come from server/config/shaheen.ts and the
// admin dashboard, so both sites (Vercel and GitHub Pages, which calls this API) behave the same.
app.use('/api', createShaheenRouter({ repo: shamCore.repo, runtime: shamCore.runtime }));
app.use('/api', createMediaRouter());

// ============================================================================
// DAILY PERFUME NEWS ENGINE (MASTER SHAHEEN AI CURATION & REFRESH)
// ============================================================================

const EDITORIAL_NEWS_IMAGES = [
  '/src/assets/images/niche_perfume_reveal_1791968798991.jpg',
  '/src/assets/images/fragrance_summit_expo_1791968814926.jpg',
  '/src/assets/images/botanical_harvest_raw_1791968832488.jpg',
  '/src/assets/images/perfume_news_global_trends_1791696027070.jpg',
  '/src/assets/images/grasse_rose_harvest_1791696039244.jpg',
  '/src/assets/images/luxury_perfume_exhibition_1791696134494.jpg',
  '/src/assets/images/perfume_lab_compounding_1791692420116.jpg',
  '/src/assets/images/perfume_ingredients_pyramid_1791692429360.jpg',
];

interface GeneratedNewsItem {
  id: string;
  badge?: string;
  titleAr: string;
  titleEn: string;
  category: 'trends' | 'exhibitions' | 'harvests' | 'ifra' | 'niche';
  categoryLabelAr: string;
  isHot?: boolean;
  isDailyRefreshed?: boolean;
  summaryAr: string;
  contentAr: string;
  date: string;
  readTime: string;
  source: string;
  imageUrl: string;
  tags: string[];
  keyNotes?: { nameAr: string; nameEn?: string; type?: string; percentageHint?: number }[];
  marketImpact?: string;
  expertVerdict?: string;
  author: string;
  location?: string;
}

let activeDailyNewsList: GeneratedNewsItem[] = [];
let lastNewsRefreshDate = '';

function getTodayArabicDateString(): string {
  const now = new Date();
  return now.toLocaleDateString('ar-EG', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

const NEWS_CATEGORIES = ['trends', 'exhibitions', 'harvests', 'ifra', 'niche'] as const;
const text = (value: unknown, max: number, fallback = '') => (typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : fallback);

/**
 * Daily bulletin written by the same engines Shaheen uses (order/models from its settings). These are
 * AI-written editorial explainers, not verified news: the prompt forbids invented deals, figures,
 * lab results or quotes, and the site labels them as AI-generated.
 */
async function generateFreshDailyNewsWithShaheen(): Promise<GeneratedNewsItem[]> {
  const shaheen = (await shamCore.repo.settings()).shaheen;
  const configured = new Set(engineStatuses(process.env).filter((s) => s.configured).map((s) => s.id));
  const engines = shaheen.enabled ? shaheen.engines.filter((id) => configured.has(id)) : [];
  if (!engines.length) throw new Error('News refresh requires a configured AI engine.');
  const todayArabic = getTodayArabicDateString();

  const system = 'أنت الخبير شاهين، محرر تحريري تثقيفي في عالم العطور. أخرج فقط مصفوفة JSON صالحة دون أي شرح أو Markdown.'
    + await supervisorGuidance('news_articles', process.env).catch(() => '');
  const prompt = `تاريخ اليوم: ${todayArabic}.
اكتب 3 مقالات تحريرية تثقيفية قصيرة لقسم «مرصد العطور» في منصة شام:
1. اتجاه عام في تصميم العطور أو الكيمياء الخضراء أو العطور النيش.
2. معلومة عن المعارض والفعاليات الدولية للعطور بشكل عام (دون ادعاء صفقات أو أرقام).
3. معلومة عن مواسم المواد الخام (الورد، اللبان، العود، الزعفران، الحمضيات) وكيف تُفحص جودتها عادةً.
قواعد صارمة: هذه ليست أخباراً عاجلة ولا تقارير موثقة. لا تختلق أرقاماً أو صفقات أو أسعاراً أو نتائج فحوص أو تصريحات أو أسماء جزيئات أو شركات أو أحداثاً بتواريخ محددة. استخدم صياغة عامة مثل «يتجه كثير من المصممين…». لا تذكر مصدراً غير حقيقي.
الشكل المطلوب (مصفوفة فقط):
[{"id":"slug-id","titleAr":"عنوان","titleEn":"English title","category":"niche|exhibitions|harvests|trends|ifra","categoryLabelAr":"تصنيف","summaryAr":"ملخص في سطرين","contentAr":"فقرتان","readTime":"3 دقائق","marketImpact":"أثر عام متوقع","expertVerdict":"نصيحة عملية قصيرة","tags":["وسم"],"keyNotes":[{"nameAr":"نوتة","nameEn":"Note","type":"top|heart|base","percentageHint":30}]}]`;

  for (const id of engines) {
    try {
      const raw = await callEngine(id, system, [{ role: 'user', text: prompt }], {
        signal: AbortSignal.timeout(25000), temperature: 0.6, model: shaheen.models[id], maxTokens: 4096, maxChars: 40000,
      });
      if (!raw) continue;
      const json = raw.slice(raw.indexOf('['), raw.lastIndexOf(']') + 1);
      const parsed = JSON.parse(json);
      if (!Array.isArray(parsed) || !parsed.length) continue;
      const items = parsed.slice(0, 6).filter((item) => item && typeof item === 'object' && text(item.titleAr, 200) && text(item.summaryAr, 600));
      if (!items.length) continue;
      return items.map((item: any, index: number): GeneratedNewsItem => {
        const category = NEWS_CATEGORIES.includes(item.category) ? item.category : 'trends';
        const verdict = text(item.expertVerdict, 300);
        return {
          id: `shaheen-${new Date().toISOString().slice(0, 10)}-${index}-${text(item.id, 60, 'note').replace(/[^a-z0-9-]/gi, '').slice(0, 40)}`,
          badge: '✨ مقال تحريري مولّد بالذكاء الاصطناعي',
          titleAr: text(item.titleAr, 200),
          titleEn: text(item.titleEn, 200, 'Shaheen editorial note'),
          category,
          categoryLabelAr: text(item.categoryLabelAr, 60, 'اتجاهات'),
          isHot: index === 0,
          isDailyRefreshed: true,
          summaryAr: text(item.summaryAr, 600),
          contentAr: text(item.contentAr, 4000, text(item.summaryAr, 600)),
          date: `اليوم · ${todayArabic}`,
          readTime: text(item.readTime, 30, '3 دقائق'),
          source: 'محتوى تحريري مولّد بالذكاء الاصطناعي — للتثقيف وليس خبراً موثقاً',
          imageUrl: EDITORIAL_NEWS_IMAGES[index % EDITORIAL_NEWS_IMAGES.length],
          tags: Array.isArray(item.tags) ? item.tags.map((t: unknown) => text(t, 40)).filter(Boolean).slice(0, 6) : ['عطور'],
          keyNotes: Array.isArray(item.keyNotes) ? item.keyNotes.slice(0, 6).filter((n: any) => n && text(n.nameAr, 60)).map((n: any) => ({
            nameAr: text(n.nameAr, 60), nameEn: text(n.nameEn, 60) || undefined,
            type: ['top', 'heart', 'base'].includes(n.type) ? n.type : undefined,
            percentageHint: Number.isFinite(Number(n.percentageHint)) ? Math.min(100, Math.max(0, Number(n.percentageHint))) : undefined,
          })) : undefined,
          marketImpact: text(item.marketImpact, 400) || undefined,
          expertVerdict: verdict ? `«${verdict.replace(/^«|»$/g, '')}» — الخبير شاهين` : undefined,
          author: 'الخبير شاهين (محتوى مولّد بالذكاء الاصطناعي)',
          location: 'منصة شام',
        };
      });
    } catch (err: any) {
      console.warn(`[News Refresh] engine ${id} failed:`, String(err?.message || err).slice(0, 80));
    }
  }
  throw new Error('No news provider returned valid articles.');
}

// Each generation is a paid model call: one at a time, at most once per cooldown for everyone,
// and a per-visitor cap on manual refreshes.
let newsInFlight: Promise<GeneratedNewsItem[]> | null = null;
let lastNewsGeneratedAt = 0;
const NEWS_COOLDOWN_MS = 10 * 60_000;
const newsRefreshLimiter = new RateLimiter(3, 60 * 60_000);
const generateNewsOnce = () => {
  newsInFlight ||= generateFreshDailyNewsWithShaheen()
    .then((articles) => {
      activeDailyNewsList = articles;
      lastNewsRefreshDate = new Date().toISOString().split('T')[0];
      lastNewsGeneratedAt = Date.now();
      return articles;
    })
    .finally(() => { newsInFlight = null; });
  return newsInFlight;
};
const newsPayload = (extra: Record<string, unknown> = {}) => ({
  success: true,
  lastRefreshedAt: new Date(lastNewsGeneratedAt || Date.now()).toISOString(),
  dateString: getTodayArabicDateString(),
  curator: 'الخبير شاهين (محتوى مولّد بالذكاء الاصطناعي)',
  aiGenerated: true,
  count: activeDailyNewsList.length,
  articles: activeDailyNewsList,
  ...extra,
});

// GET /api/news - Get active daily news feed
app.get('/api/news', async (_req, res) => {
  try {
    const todayStr = new Date().toISOString().split('T')[0];
    if (activeDailyNewsList.length === 0 || lastNewsRefreshDate !== todayStr) await generateNewsOnce();
    res.json(newsPayload());
  } catch (error: any) {
    console.error('Error fetching news:', error?.message || error);
    res.status(503).json({ success: false, error: 'News service is unavailable. Existing articles have not been changed.' });
  }
});

// POST /api/news/refresh - Explicit refresh (cooldown + per-visitor limit)
app.post('/api/news/refresh', async (req, res) => {
  try {
    if (activeDailyNewsList.length && Date.now() - lastNewsGeneratedAt < NEWS_COOLDOWN_MS) {
      res.json(newsPayload({ refreshedAt: new Date(lastNewsGeneratedAt).toISOString(), cached: true,
        message: 'النشرة محدّثة منذ دقائق، وهذه أحدث نسخة.' }));
      return;
    }
    if (!newsRefreshLimiter.allow(clientKey(req))) {
      res.status(429).json({ success: false, code: 'RATE_LIMITED', error: 'Too many refreshes, please try again later.' });
      return;
    }
    const articles = await generateNewsOnce();
    res.json(newsPayload({ refreshedAt: new Date().toISOString(), count: articles.length, articles,
      message: 'تم تحديث النشرة اليومية عبر الخبير شاهين (محتوى مولّد بالذكاء الاصطناعي).' }));
  } catch (error: any) {
    console.error('Error refreshing news:', error?.message || error);
    res.status(503).json({ success: false, error: 'News refresh failed. Existing articles have not been changed.' });
  }
});

// Sham Core: provider-independent services assistant + management API.
app.use('/api/assistant', shamCore.assistant);
app.use('/api/admin', shamCore.admin);

app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'API route not found' });
});

// Importing this app never binds a port or starts the Vite development server.
export default app;
