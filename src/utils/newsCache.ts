import type { PerfumeNewsItem } from '../data/perfumeNews';

const CATEGORIES = new Set(['trends', 'exhibitions', 'harvests', 'ifra', 'niche']);

export function isNewsArticle(value: unknown): value is PerfumeNewsItem {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.id === 'string' && item.id.length > 0 &&
    typeof item.titleAr === 'string' &&
    typeof item.titleEn === 'string' &&
    typeof item.summaryAr === 'string' &&
    typeof item.categoryLabelAr === 'string' &&
    typeof item.category === 'string' && CATEGORIES.has(item.category) &&
    (item.tags === undefined || (Array.isArray(item.tags) && item.tags.every((tag) => typeof tag === 'string'))) &&
    ['badge', 'summaryEn', 'contentAr', 'contentEn', 'date', 'readTime', 'source', 'imageUrl',
      'marketImpact', 'impactEn', 'expertVerdict', 'verdictEn', 'author', 'location', 'fullArticleAr']
      .every((field) => item[field] === undefined || typeof item[field] === 'string') &&
    (item.keyNotes === undefined || (Array.isArray(item.keyNotes) && item.keyNotes.every((note) =>
      note && typeof note === 'object' && typeof note.nameAr === 'string' &&
      (note.nameEn === undefined || typeof note.nameEn === 'string') &&
      (note.type === undefined || typeof note.type === 'string') &&
      (note.percentageHint === undefined || (typeof note.percentageHint === 'number' && Number.isFinite(note.percentageHint)))
    )))
  );
}

/** Incoming articles win, without accumulating duplicate IDs in localStorage. */
export function mergeNewsArticles(current: PerfumeNewsItem[], incoming: PerfumeNewsItem[]): PerfumeNewsItem[] {
  const seen = new Set<string>();
  return [...incoming, ...current].filter((article) => {
    if (seen.has(article.id)) return false;
    seen.add(article.id);
    return true;
  });
}

/** A browser cache must never override updated bundled articles/translations. */
export function restoreNewsCache(raw: string | null, bundled: PerfumeNewsItem[]): PerfumeNewsItem[] {
  try {
    const cached: unknown = JSON.parse(raw ?? 'null');
    if (!Array.isArray(cached)) return bundled;

    const bundledIds = new Set(bundled.map((article) => article.id));
    const remoteArticles = cached.filter(isNewsArticle).filter((article) =>
      !bundledIds.has(article.id) &&
      // Older builds fabricated a new "daily" report after each failed request.
      !article.id.startsWith('shaheen-local-refresh-') &&
      !article.id.startsWith('shaheen-daily-'),
    );
    return mergeNewsArticles(bundled, remoteArticles);
  } catch {
    return bundled;
  }
}

/** Reject obsolete hashed assets and /src paths from older deployments/APIs. */
export function resolveNewsImage(imageUrl: string | undefined, currentImages: string[], fallback: string): string {
  if (imageUrl && (currentImages.includes(imageUrl) || /^(https?:\/\/|data:image\/)/i.test(imageUrl))) {
    return imageUrl;
  }
  return fallback;
}
