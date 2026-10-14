import express from 'express';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import { ChatError, executeChat, getChatModels, validateChatRequest } from './shaheen';
import { createShamCore } from './core/http';

dotenv.config();

const app = express();

// Rate limits use the client IP; trust exactly the configured number of proxy hops (Vercel = 1).
const trustProxy = process.env.SHAM_TRUST_PROXY ?? (process.env.VERCEL ? '1' : '');
if (trustProxy) app.set('trust proxy', /^\d+$/.test(trustProxy) ? Number(trustProxy) : trustProxy);

app.use(express.json({ limit: '128kb' }));
app.use((error: any, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (error?.type === 'entity.parse.failed' || error?.type === 'entity.too.large') {
    res.status(error.status || 400).json({ error: 'Invalid JSON request body', code: 'INVALID_REQUEST' });
    return;
  }
  next(error);
});

const apiKey = process.env.GEMINI_API_KEY || '';
const ai = apiKey ? new GoogleGenAI({
  apiKey,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
}) : null;

function withTimeout<T>(promise: Promise<T>, ms: number, fallbackValue: T): Promise<T> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(fallbackValue), ms);
    promise
      .then((val) => {
        clearTimeout(timer);
        resolve(val);
      })
      .catch(() => {
        clearTimeout(timer);
        resolve(fallbackValue);
      });
  });
}

app.get('/api/health', (_req, res) => {
  res.json({ service: 'sham-perfume', status: 'ok' });
});

// Shahin routes: strict inputs, actual provider attribution, no canned AI impersonation.
app.get('/api/models', (_req, res) => {
  res.json({ models: getChatModels(process.env) });
});

app.post('/api/chat', async (req, res) => {
  const controller = new AbortController();
  const cancel = () => { if (!res.writableEnded) controller.abort(); };
  res.on('close', cancel);
  try {
    const input = validateChatRequest(req.body);
    const result = await executeChat(input, { signal: controller.signal });
    if (!res.destroyed) res.json(result);
  } catch (error) {
    if (res.destroyed) return;
    if (error instanceof ChatError) {
      res.status(error.status).json({ error: error.message, code: error.code });
    } else {
      res.status(500).json({ error: 'Chat service failed', code: 'CHAT_FAILED' });
    }
  } finally {
    res.off('close', cancel);
  }
});

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

async function generateFreshDailyNewsWithShaheen(): Promise<GeneratedNewsItem[]> {
  if (!ai) throw new Error('News refresh requires GEMINI_API_KEY.');
  const models = ['gemini-3.1-flash-lite', 'gemini-3.8-flash', 'gemini-flash-latest'];
  const todayArabic = getTodayArabicDateString();

  const prompt = `أنت "الخبير شاهين"، شيخ العطارين وكبير كيميائيي العطور بخبرة 35 عاماً، ورئيس تحرير مرصد أخبار العطور العالمية.
تاريخ اليوم هو: ${todayArabic}.
المطلوب منك: صياغة 3 تقارير إخبارية ومعملية حصرية وحديثة جداً لليوم في عالم وصناعة العطور، موثقة بالتحليلات الكيميائية والفنية.
يجب أن تتناول التقارير:
1. تقرير عن ابتكار عطري نيش حديث أو كيمياء خضراء مستدامة أو معطرات تجميلية ذكية.
2. تقرير عن المعارض الدولية الكبرى والصفقات في ميلانو أو باريس أو دبي (Esxence, Beautyworld, Fragrance Summit).
3. تقرير عن مواسم حصاد المواد الخام النقية (الورد، اللبان، العود، الزعفران، الحمضيات) ونتائج فحص النقاء المعملي (GC-MS).

أرجع الإجابة بتنسيق JSON فقط عبارة عن مصفوفة من الكائنات بالشكل التالي:
[
  {
    "id": "slug-id",
    "badge": "⚡ رصد الخبير شاهين اليومي",
    "titleAr": "عنوان التقرير بالعربية بشكل جذاب ورسمي",
    "titleEn": "English Title",
    "category": "niche" | "exhibitions" | "harvests" | "trends" | "ifra",
    "categoryLabelAr": "تصنيف بالعربية",
    "summaryAr": "ملخص شامل في سطرين أو ثلاثة",
    "contentAr": "تفاصيل التقرير الكامل في فقرتين تشمل التحليل المعملي والنصيحة",
    "readTime": "3 دقائق",
    "source": "المصدر الرسمي واسم المدينة",
    "marketImpact": "الأثر الاقتصادي أو الصناعي في السوق",
    "expertVerdict": "قول مأثور أو حكم معملي للخبير شاهين",
    "tags": ["تاج1", "تاج2", "تاج3"],
    "keyNotes": [
      { "nameAr": "نوتة 1", "nameEn": "Note 1", "type": "top", "percentageHint": 30 },
      { "nameAr": "نوتة 2", "nameEn": "Note 2", "type": "heart", "percentageHint": 35 },
      { "nameAr": "نوتة 3", "nameEn": "Note 3", "type": "base", "percentageHint": 35 }
    ]
  }
]`;

  for (const model of models) {
    try {
      const call = ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          systemInstruction: 'أنت الخبير شاهين، رئيس تحرير مرصد أخبار العطور العالمي. أخرج فقط مصفوفة JSON نقية وصالحة دون أي كود Markdown.',
          temperature: 0.7,
          responseMimeType: 'application/json',
        },
      });

      const res = await withTimeout(call, 18000, null as any);
      if (res && res.text) {
        let cleanText = res.text.trim();
        if (cleanText.startsWith('```json')) {
          cleanText = cleanText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
        } else if (cleanText.startsWith('```')) {
          cleanText = cleanText.replace(/^```\s*/, '').replace(/\s*```$/, '');
        }
        const parsed = JSON.parse(cleanText);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((item: any, index: number) => ({
            id: item.id || `shaheen-ai-${Date.now()}-${index}`,
            badge: item.badge || '⚡ رصد الخبير شاهين اليومي',
            titleAr: item.titleAr || 'تقرير الخبير شاهين اليومي',
            titleEn: item.titleEn || 'Master Shaheen Daily Report',
            category: item.category || 'niche',
            categoryLabelAr: item.categoryLabelAr || 'ابتكارات النيش',
            isHot: index === 0,
            isDailyRefreshed: true,
            summaryAr: item.summaryAr || '',
            contentAr: item.contentAr || item.summaryAr || '',
            date: `اليوم · ${todayArabic}`,
            readTime: item.readTime || '3 دقائق',
            source: item.source || 'مختبر الخبير شاهين · معمل شام',
            imageUrl: EDITORIAL_NEWS_IMAGES[index % EDITORIAL_NEWS_IMAGES.length],
            tags: Array.isArray(item.tags) ? item.tags : ['عطور', 'أخبار اليوم'],
            keyNotes: Array.isArray(item.keyNotes) ? item.keyNotes : undefined,
            marketImpact: item.marketImpact || 'تأثير إيجابي ملحوظ في صياغة التركيبات العطرية الحديثة.',
            expertVerdict: item.expertVerdict ? (item.expertVerdict.includes('شاهين') ? item.expertVerdict : `«${item.expertVerdict}» - الخبير شاهين`) : '«العطر علمٌ وفن، وسلامة المكونات هي تاج كل تركيبة ناجحة» - الخبير شاهين.',
            author: 'الخبير شاهين (شيخ العطارين)',
            location: item.location || 'معمل شام الدولي',
          }));
        }
      }
    } catch (err: any) {
      console.warn(`[News Refresh] Model ${model} attempt failed:`, err?.message?.slice(0, 80));
    }
  }

  throw new Error('No news provider returned valid articles.');
}

// GET /api/news - Get active daily news feed
app.get('/api/news', async (req, res) => {
  try {
    const todayStr = new Date().toISOString().split('T')[0];
    if (activeDailyNewsList.length === 0 || lastNewsRefreshDate !== todayStr) {
      activeDailyNewsList = await generateFreshDailyNewsWithShaheen();
      lastNewsRefreshDate = todayStr;
    }

    res.json({
      success: true,
      lastRefreshedAt: new Date().toISOString(),
      dateString: getTodayArabicDateString(),
      curator: 'الخبير شاهين (شيخ العطارين وكبير كيميائيي العطور)',
      count: activeDailyNewsList.length,
      articles: activeDailyNewsList,
    });
  } catch (error: any) {
    console.error('Error fetching news:', error);
    res.status(503).json({
      success: false,
      error: 'News service is unavailable. Existing articles have not been changed.',
    });
  }
});

// POST /api/news/refresh - Explicit Daily Refresh by Master Shaheen
app.post('/api/news/refresh', async (req, res) => {
  try {
    const freshArticles = await generateFreshDailyNewsWithShaheen();
    activeDailyNewsList = freshArticles;
    lastNewsRefreshDate = new Date().toISOString().split('T')[0];

    res.json({
      success: true,
      message: 'تم تحديث النشرة اليومية بنجاح عبر الخبير شاهين ونشرها بالصور الكاملة.',
      refreshedAt: new Date().toISOString(),
      dateString: getTodayArabicDateString(),
      curator: 'الخبير شاهين (شيخ العطارين وكبير كيميائيي العطور)',
      count: freshArticles.length,
      articles: freshArticles,
    });
  } catch (error: any) {
    console.error('Error refreshing news:', error);
    res.status(503).json({
      success: false,
      error: 'News refresh failed. Existing articles have not been changed.',
    });
  }
});

// Sham Core: provider-independent services assistant + management API.
const shamCore = createShamCore();
app.use('/api/assistant', shamCore.assistant);
app.use('/api/admin', shamCore.admin);

app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'API route not found' });
});

// Importing this app never binds a port or starts the Vite development server.
export default app;
