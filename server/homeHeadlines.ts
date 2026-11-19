import {
  HEADLINE_KEEP_MS, HEADLINE_LIMIT, HEADLINE_REFRESH_MS, HEADLINE_REGIONS, HEADLINE_SOURCE,
  emptyHeadlines, headlineImage, headlineLink,
  type HeadlineRegion, type HeadlineSection, type HomeHeadline, type HomeHeadlines,
} from '../src/utils/homeHeadlines';

const RETRY_MS = 60_000;
const XML_BYTES = 384 * 1024;
const HEAD_BYTES = 96 * 1024;
const STALE_STORY_MS = 7 * 86_400_000;
const USER_AGENT = 'ShamPerfumeHeadlineReader/1.0 (+https://spculculat-oss.github.io/Sham-Perfume/)';
const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', hellip: '…', ndash: '–', mdash: '—' };
const decode = (value: string) => value.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (entity, code: string) => {
  if (code.startsWith('#')) {
    const hex = code[1]?.toLowerCase() === 'x';
    const point = Number.parseInt(code.slice(hex ? 2 : 1), hex ? 16 : 10);
    return point > 0 && point <= 0x10ffff && !(point >= 0xd800 && point <= 0xdfff) ? String.fromCodePoint(point) : '';
  }
  return Object.hasOwn(ENTITIES, code.toLowerCase()) ? ENTITIES[code.toLowerCase()] : entity;
});
const unwrap = (value: string) => decode(value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')).trim();
const text = (value: string) => unwrap(value).replace(/<[^>]*>/g, ' ').replace(/[\s\u200e\u200f\u202a-\u202e\u2066-\u2069]+/g, ' ').trim();
const tag = (block: string, name: string) => block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}\\s*>`, 'i'))?.[1] ?? '';
function attributes(element: string): Record<string, string> {
  return Object.fromEntries(Array.from(element.matchAll(/\s([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>"']+))/g),
    ([, name, double, single, bare]) => [name.toLowerCase(), decode(double ?? single ?? bare ?? '')]));
}

// The publisher also emits dates like «الخميس، 19 نوفمبر 2026 02:23 ص».
// Resolve those in Egypt's IANA zone, not in the server's timezone (which may be UTC).
const EGYPT_MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
const cairoFields = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Africa/Cairo', calendar: 'gregory', numberingSystem: 'latn', hourCycle: 'h23',
  year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric',
});
function publicationDate(raw: string): string | null {
  const ascii = raw.replace(/[٠-٩۰-۹]/g, (d) => String(d.charCodeAt(0) & 15));
  const match = ascii.match(/(\d{1,2})\s+(\S+)\s+(\d{4})\s+(\d{1,2}):(\d{2})(?:\s*([صم]))?/);
  if (match) {
    const [, dd, mm, yyyy, hh, min, half] = match;
    const month = EGYPT_MONTHS.indexOf(mm);
    const hour = half ? Number(hh) % 12 + (half === 'م' ? 12 : 0) : Number(hh);
    if (month >= 0 && Number(dd) >= 1 && Number(dd) <= 31 && hour < 24 && Number(min) < 60) {
      const wall = Date.UTC(Number(yyyy), month, Number(dd), hour, Number(min));
      const parts = Object.fromEntries(cairoFields.formatToParts(wall).map((p) => [p.type, Number(p.value)]));
      const offset = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute) - wall;
      return new Date(wall - offset).toISOString();
    }
  }
  if (!/(?:Z|GMT|UTC|[+-]\d{2}:?\d{2})$/i.test(ascii)) return null;
  const epoch = Date.parse(ascii);
  return Number.isFinite(epoch) ? new Date(epoch).toISOString() : null;
}

function rssImage(block: string): string | null {
  for (const [element] of block.matchAll(/<(?:enclosure|media:(?:thumbnail|content))\b[^>]*>/gi)) {
    const a = attributes(element);
    if (a.type && !a.type.startsWith('image/')) continue;
    const image = headlineImage(a.url);
    if (image) return image;
  }
  // Some feeds provide a short HTML preview in their RSS description. Never render that HTML.
  for (const [element] of unwrap(tag(block, 'description')).matchAll(/<img\b[^>]*>/gi)) {
    const a = attributes(element);
    const image = headlineImage(a['data-src']) || headlineImage(a.src);
    if (image) return image;
  }
  return headlineImage(unwrap(tag(block, 'image')));
}

export function parseHomeHeadlineRss(xml: string, now: number): HomeHeadline[] {
  const candidates = new Map<string, HomeHeadline>();
  if (!/<rss\b/i.test(xml) || /<!DOCTYPE\b/i.test(xml)) return [];
  for (const [block] of xml.matchAll(/<item(?:\s[^>]*)?>[\s\S]*?<\/item\s*>/gi)) {
    const title = text(tag(block, 'title')).slice(0, 260);
    const url = headlineLink(unwrap(tag(block, 'link')));
    if (!title || !url) continue;
    const id = url.match(/\/(\d+)\/?$/)?.[1] ?? url;
    if (candidates.has(id)) continue;
    const publishedAt = publicationDate(text(tag(block, 'pubDate')));
    if (publishedAt && now - Date.parse(publishedAt) > STALE_STORY_MS) continue;
    candidates.set(id, { title, url, publishedAt, imageUrl: rssImage(block) });
  }
  return [...candidates.values()].sort((a, b) => (b.publishedAt ? Date.parse(b.publishedAt) : 0) - (a.publishedAt ? Date.parse(a.publishedAt) : 0)).slice(0, HEADLINE_LIMIT);
}

export function parseHeadlinePreview(head: string): string | null {
  for (const [raw] of head.split(/<\/head\s*>/i, 1)[0].matchAll(/<meta\b[^>]*>/gi)) {
    const a = attributes(raw);
    if (!['og:image', 'og:image:secure_url', 'twitter:image'].includes((a.property || a.name || '').toLowerCase())) continue;
    const image = headlineImage(a.content);
    if (image) return image;
  }
  return null;
}

async function boundedText(response: Response, cap: number, headOnly = false): Promise<string> {
  if (!response.body) return '';
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let length = 0;
  let result = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) return result + decoder.decode();
      const remaining = cap - length;
      if (value.byteLength > remaining && !headOnly) throw new Error('Feed exceeded byte limit');
      result += decoder.decode(value.subarray(0, remaining), { stream: true });
      length += value.byteLength;
      if (headOnly && (length >= cap || /<\/head\s*>/i.test(result) || parseHeadlinePreview(result))) return result;
    }
  } finally {
    void reader.cancel().catch(() => {});
  }
}

interface CacheEntry { lastGood?: HeadlineSection; retryAt: number; pending?: Promise<HeadlineSection> }

/** Request-time RSS only; no robot, no schedule and no republishing full articles.
 * Four link previews per section; media bytes stay on the publisher. Separate
 * caches let one section fail without blocking the other after the bounded fetch. */
export function createHomeHeadlines(request: typeof fetch = fetch, now: () => number = Date.now) {
  const cache: Record<HeadlineRegion, CacheEntry> = { egypt: { retryAt: 0 }, world: { retryAt: 0 } };
  const send = async (url: string, accept: string, timeout: number) => {
    const result = await request(url, { redirect: 'error', signal: AbortSignal.timeout(timeout), headers: { Accept: accept, 'User-Agent': USER_AGENT } });
    if (!result.ok) { void result.body?.cancel().catch(() => {}); throw new Error(`Publisher returned ${result.status}`); }
    return result;
  };
  const retained = (entry: CacheEntry): HeadlineSection => entry.lastGood?.checkedAt && now() - Date.parse(entry.lastGood.checkedAt) < HEADLINE_KEEP_MS
    ? { ...entry.lastGood, status: 'stale' } : emptyHeadlines();
  function load(region: HeadlineRegion): Promise<HeadlineSection> {
    const entry = cache[region];
    if (entry.pending) return entry.pending;
    if (entry.lastGood?.checkedAt && now() - Date.parse(entry.lastGood.checkedAt) < HEADLINE_REFRESH_MS) return Promise.resolve(entry.lastGood);
    if (now() < entry.retryAt) return Promise.resolve(retained(entry));
    entry.pending = (async () => {
      try {
        const feed = await send(HEADLINE_SOURCE.sections[region].feed, 'application/rss+xml, application/xml, text/xml', 3200);
        const items = parseHomeHeadlineRss(await boundedText(feed, XML_BYTES), now());
        if (!items.length) throw new Error('No recent headlines in feed');
        const oldImages = new Map(entry.lastGood?.items.map((story) => [story.url, story.imageUrl]));
        await Promise.all(items.map(async (story) => {
          story.imageUrl ||= oldImages.get(story.url) || null;
          if (story.imageUrl) return;
          try {
            // Same publisher + a validated story URL. Read only the public link-preview
            // metadata, never the article body; redirects are not followed.
            const page = await send(story.url, 'text/html', 2500);
            story.imageUrl = parseHeadlinePreview(await boundedText(page, HEAD_BYTES, true));
          } catch { /* Text headline still works without a preview image. */ }
        }));
        entry.lastGood = { status: 'fresh', checkedAt: new Date(now()).toISOString(), items };
        return entry.lastGood;
      } catch {
        entry.retryAt = now() + RETRY_MS;
        return retained(entry);
      }
    })().finally(() => { entry.pending = undefined; });
    return entry.pending;
  }
  return async (): Promise<HomeHeadlines> => {
    const [egypt, world] = await Promise.all(HEADLINE_REGIONS.map(load));
    return { egypt, world };
  };
}
