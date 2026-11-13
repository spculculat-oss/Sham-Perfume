import type { NewsFile, NewsItem } from '../../scripts/shaheen-news/curate';

export type { NewsFile, NewsItem };

/**
 * The news «الخبير شاهين» collects every 12 hours. The copy inside the build is the fallback; the
 * repository copy is newer between deploys and needs no server, so it also works on GitHub Pages.
 */
export const LIVE_NEWS_URL = 'https://raw.githubusercontent.com/spculculat-oss/Sham-Perfume/main/src/data/live/shaheen-news.json';

export function isNewsFile(data: unknown): data is NewsFile {
  const d = data as NewsFile;
  return Boolean(d && typeof d === 'object' && typeof d.updatedAt === 'string' && Array.isArray(d.items) &&
    d.items.every((i) => i && typeof i.url === 'string' && /^https?:\/\//.test(i.url) && typeof i.title?.ar === 'string' && typeof i.title?.en === 'string'));
}

let pending: Promise<NewsFile> | undefined;
export function loadLiveNews(request: typeof fetch = fetch): Promise<NewsFile> {
  return pending ??= (async () => {
    const bundled = (await import('../data/live/shaheen-news.json')).default as unknown as NewsFile;
    try {
      const response = await request(LIVE_NEWS_URL, { cache: 'no-cache', signal: AbortSignal.timeout(8000) });
      const data: unknown = response.ok ? await response.json() : undefined;
      if (isNewsFile(data) && Date.parse(data.updatedAt) > Date.parse(bundled.updatedAt)) return data;
    } catch { /* offline or blocked: the bundled copy is still real news */ }
    return bundled;
  })();
}

/** «منذ 3 ساعات» / "3 hours ago" without a date library. */
export function relativeTime(iso: string | undefined, lang: string, now = Date.now()): string {
  if (!iso || Number.isNaN(Date.parse(iso))) return '';
  const seconds = Math.round((Date.parse(iso) - now) / 1000);
  const units: [Intl.RelativeTimeFormatUnit, number][] = [['day', 86400], ['hour', 3600], ['minute', 60]];
  const format = new Intl.RelativeTimeFormat(lang, { numeric: 'auto' });
  for (const [unit, size] of units) if (Math.abs(seconds) >= size) return format.format(Math.round(seconds / size), unit);
  return format.format(0, 'minute');
}
