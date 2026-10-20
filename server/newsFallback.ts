/**
 * «مرصد العطور» when no AI engine can write today's editorial notes: instead of an error, the visitor gets the
 * real headlines «الخبير شاهين» collected from the web (src/data/live/shaheen-news.json, every 12 hours), each
 * with its own source and link. Nothing is invented and nothing is labelled as AI-written. Pure (tested in
 * tests/newsFallback.test.ts).
 */
import type { LiveNewsItem } from './core/liveData';

export type EditorialCategory = 'trends' | 'exhibitions' | 'harvests' | 'ifra' | 'niche';
export interface CollectedArticle {
  id: string; badge: string; titleAr: string; titleEn: string; category: EditorialCategory; categoryLabelAr: string;
  isHot: boolean; summaryAr: string; summaryEn?: string; contentAr: string; contentEn?: string; date: string;
  readTime: string; source: string; imageUrl: string; tags: string[]; author: string; location?: string;
}

const CATEGORY: Record<string, [EditorialCategory, string]> = {
  launch: ['niche', 'إطلاقات'], industry: ['trends', 'الصناعة'], ingredients: ['harvests', 'المواد الخام'],
  market: ['trends', 'السوق'], events: ['exhibitions', 'المعارض'], regulation: ['ifra', 'اللوائح'], culture: ['trends', 'ثقافة العطور'],
};

const text = (value: unknown, max: number) => (typeof value === 'string' ? value.trim().slice(0, max) : '');

/** The newest collected headlines as «مرصد العطور» articles (most important first, at most `limit`). */
export function articlesFromCollected(items: LiveNewsItem[], images: string[], todayArabic: string, limit = 6): CollectedArticle[] {
  return items
    .filter((item) => item && text(item.id, 80) && text(item.title?.ar, 300) && text(item.summary?.ar, 1200) && /^https:\/\//.test(item.url || ''))
    .sort((a, b) => (Number(b.importance) || 0) - (Number(a.importance) || 0) || Date.parse(b.publishedAt || '') - Date.parse(a.publishedAt || ''))
    .slice(0, limit)
    .map((item, index) => {
      const [category, label] = CATEGORY[item.category || ''] || ['trends', 'أخبار العطور'];
      const source = text(item.source, 80) || 'مصدر على الويب';
      const published = Date.parse(item.publishedAt || '');
      return {
        id: `collected-${text(item.id, 60).replace(/[^a-z0-9-]/gi, '')}`,
        badge: '📰 خبر من الويب',
        titleAr: text(item.title.ar, 200),
        titleEn: text(item.title.en, 200) || text(item.title.ar, 200),
        category, categoryLabelAr: label,
        isHot: index === 0,
        summaryAr: text(item.summary.ar, 600),
        summaryEn: text(item.summary.en, 600) || undefined,
        contentAr: `${text(item.summary.ar, 1200)}\n\nالمصدر: ${source} — ${item.url}`,
        contentEn: text(item.summary.en, 1200) ? `${text(item.summary.en, 1200)}\n\nSource: ${source} — ${item.url}` : undefined,
        date: Number.isFinite(published) ? new Date(published).toLocaleDateString('ar-EG', { day: 'numeric', month: 'long', year: 'numeric' }) : todayArabic,
        readTime: '2 دقائق',
        source,
        imageUrl: images[index % images.length] || '',
        tags: ['أخبار العطور', label],
        author: `نشرة شاهين — عن ${source}`,
      };
    });
}
