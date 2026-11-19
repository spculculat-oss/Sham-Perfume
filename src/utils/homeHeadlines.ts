export const HEADLINE_REGIONS = ['egypt', 'world'] as const;
export type HeadlineRegion = typeof HEADLINE_REGIONS[number];

// These are publisher-provided, separate editorial sections (not perfume news).
export const HEADLINE_SOURCE = {
  name: { ar: 'اليوم السابع', en: 'Youm7' },
  lang: 'ar',
  sections: {
    egypt: { feed: 'https://www.youm7.com/rss/SectionRss?SectionID=97', page: 'https://www.youm7.com/Section/تقارير-مصرية/97/1' },
    world: { feed: 'https://www.youm7.com/rss/SectionRss?SectionID=286', page: 'https://www.youm7.com/Section/أخبار-عالمية/286/1' },
  },
} as const;

export const HEADLINE_LIMIT = 4;
export const HEADLINE_REFRESH_MS = 5 * 60_000;
export const HEADLINE_KEEP_MS = 24 * 60 * 60_000;
export interface HomeHeadline { title: string; url: string; publishedAt: string | null; imageUrl: string | null }
export interface HeadlineSection {
  status: 'fresh' | 'stale' | 'unavailable';
  checkedAt: string | null;
  items: HomeHeadline[];
}
export type HomeHeadlines = Record<HeadlineRegion, HeadlineSection>;
export const emptyHeadlines = (): HeadlineSection => ({ status: 'unavailable', checkedAt: null, items: [] });

function publisherUrl(input: unknown, hosts: string[]): URL | null {
  if (typeof input !== 'string' || input.length > 2500) return null;
  try {
    const url = new URL(input, 'https://www.youm7.com');
    if (!['https:', 'http:'].includes(url.protocol) || !hosts.includes(url.hostname) || url.username || url.password || url.port) return null;
    url.protocol = 'https:';
    url.hash = '';
    return url;
  } catch { return null; }
}

export function headlineLink(input: unknown): string | null {
  const url = publisherUrl(input, ['www.youm7.com', 'youm7.com']);
  if (!url || !/^\/(?:story\/\d{4}\/\d{1,2}\/\d{1,2}\/[^/]+\/)?\d+\/?$/i.test(url.pathname)) return null;
  url.hostname = 'www.youm7.com';
  url.search = '';
  return url.href;
}

export function headlineImage(input: unknown): string | null {
  const url = publisherUrl(input, ['img.youm7.com', 'www.youm7.com', 'youm7.com']);
  return url && /\.(?:jpe?g|png|webp|avif)$/i.test(url.pathname) ? url.href : null;
}

const timestamp = (input: unknown): string | null => typeof input === 'string' && input.length < 50 && Number.isFinite(Date.parse(input)) ? new Date(input).toISOString() : null;

/** The same URL constraints apply when reading an API response on static hosting. */
export function readHeadlines(input: unknown): HomeHeadlines {
  if (!input || typeof input !== 'object' || !('egypt' in input) || !('world' in input)) throw new Error('Invalid headline response');
  function section(raw: unknown): HeadlineSection {
    if (!raw || typeof raw !== 'object') return emptyHeadlines();
    const data = raw as Partial<HeadlineSection>;
    const checkedAt = timestamp(data.checkedAt);
    if (!checkedAt || !Array.isArray(data.items) || (data.status !== 'fresh' && data.status !== 'stale')) return emptyHeadlines();
    const items = data.items.slice(0, HEADLINE_LIMIT).flatMap((item) => {
      const url = headlineLink(item?.url);
      return url && typeof item.title === 'string' && item.title.trim()
        ? [{ title: item.title.trim().slice(0, 260), url, publishedAt: timestamp(item.publishedAt), imageUrl: headlineImage(item.imageUrl) }] : [];
    });
    return items.length ? { status: data.status, checkedAt, items } : emptyHeadlines();
  }
  return { egypt: section(input.egypt), world: section(input.world) };
}
