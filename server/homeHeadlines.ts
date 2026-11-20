import { SaxesParser } from 'saxes';
import { geoDetailsFromHeaders, resolveVisitorEntryLocation } from '../src/data/worldEntryGazetteer';
import { localHeadlineEdition, WORLD_HEADLINE_EDITION, type HeadlineEdition, type HeadlineFeed } from '../src/data/homeHeadlineEditions';
import {
  HEADLINE_REFRESH_MS, HEADLINE_RETRY_MS, NEWS_DAY_MS, distinctHeadlines, emptyHeadlines,
  headlineAuthor, headlineDay, headlineLink, headlineNeedsByline, headlineTimeZone, headlineTitle, type HeadlineSection, type HomeHeadline, type HomeHeadlines,
} from '../src/utils/homeHeadlines';
import type { HeadlinePhoto } from '../src/utils/headlinePhoto';
import { commonsHeadlineQuery, findGlobalVoicesPhoto, readCommonsHeadlinePhotos, type HeadlinePhotoCandidate } from './homeHeadlineMedia';
import { isCountry } from '../src/utils/pricing';
import { countryFromHeaders } from './core/replyMoney';

const XML_BYTES = 1024 * 1024;
const PHOTO_HTML_CHARS = 65_536;
const PHOTO_LOOKUP_BYTES = 128 * 1024;
const USER_AGENT = 'ShamPerfumeHeadlineReader/3.0 (+https://spculculat-oss.github.io/Sham-Perfume/)';
interface EntryEdition { country: string | null; timeZone: string }

/** Only entry-network metadata; never the site's language, checkout country, or GPS weather. */
export function headlineEntry(headers: Record<string, string | string[] | undefined>): EntryEdition {
  const geo = geoDetailsFromHeaders(headers);
  const timeZone = headlineTimeZone(geo.timezone);
  const code = geo.country?.toUpperCase();
  const byZone = timeZone ? resolveVisitorEntryLocation({ timezone: timeZone }).country : undefined;
  const edge = countryFromHeaders(headers);
  const country = edge || (isCountry(code) ? code : isCountry(byZone) ? byZone : null);
  return { country, timeZone: timeZone || localHeadlineEdition(country)?.timeZone || WORLD_HEADLINE_EDITION.timeZone };
}

const EGYPT_MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
const cairoFields = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Africa/Cairo', calendar: 'gregory', numberingSystem: 'latn', hourCycle: 'h23',
  year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric',
});
const cairoWall = (epoch: number) => {
  const p = Object.fromEntries(cairoFields.formatToParts(epoch).map((part) => [part.type, Number(part.value)]));
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
};

function datedEpoch(value: string, publisher: HeadlineFeed['publisher']): number {
  const ascii = value.trim().replace(/[٠-٩۰-۹]/g, (digit) => String(digit.charCodeAt(0) & 15));
  // Youm7 uses Arabic wall time with no offset. Match it in Cairo, including DST.
  if (publisher === 'youm7') {
    const arabic = ascii.match(/^(?:[^\d,،]+[,،]\s*)?(\d{1,2})\s+(\S+)\s+(\d{4})\s+(\d{1,2}):(\d{2})\s*([صم])?$/);
    if (arabic) {
      const [, dd, mm, yy, hh, min, marker] = arabic;
      const month = EGYPT_MONTHS.indexOf(mm);
      const hour = marker ? Number(hh) % 12 + (marker === 'م' ? 12 : 0) : Number(hh);
      if (month < 0 || Number(dd) < 1 || Number(dd) > 31 || Number(min) > 59 || hour > 23
        || (marker && (Number(hh) < 1 || Number(hh) > 12))) return NaN;
      const wall = Date.UTC(Number(yy), month, Number(dd), hour, Number(min));
      if (new Date(wall).getUTCMonth() !== month) return NaN;
      const at = wall - (cairoWall(wall) - wall);
      return cairoWall(at) === wall ? at : NaN;
    }
  }
  // Never parse a timezone-free date as the server's time or manufacture a date from the URL.
  return /(?:Z|GMT|UTC|[+-]\d{2}:?\d{2})$/i.test(ascii) ? Date.parse(ascii) : NaN;
}

const XML_ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', ndash: '–', mdash: '—', hellip: '…' };
const cdataText = (value: string) => value.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (entity, code: string) => {
  if (!code.startsWith('#')) return Object.hasOwn(XML_ENTITIES, code.toLowerCase()) ? XML_ENTITIES[code.toLowerCase()] : entity;
  const point = code[1]?.toLowerCase() === 'x' ? Number.parseInt(code.slice(2), 16) : Number(code.slice(1));
  return point > 0 && point <= 0x10ffff && !(point >= 0xd800 && point <= 0xdfff) ? String.fromCodePoint(point) : '';
});

type ParsedHeadline = HomeHeadline & { photoCandidate?: HeadlinePhotoCandidate };

/** Parse direct RSS/Atom metadata and inspect Global Voices' embedded captions. No DTD,
 * retained article content, or requests to article pages. */
export function parseHomeHeadlineFeed(xml: string, feed: HeadlineFeed): ParsedHeadline[] {
  const parser = new SaxesParser({ xmlns: false });
  const items: ParsedHeadline[] = [];
  const fields = new Set(['title', 'link', 'pubdate', 'dc:date', 'published', 'updated']);
  if (headlineNeedsByline(feed.publisher)) fields.add('dc:creator');
  if (feed.publisher === 'agencia-brasil') fields.add('author');
  if (feed.publisher === 'global-voices') fields.add('content:encoded');
  let depth = 0;
  let atom = false;
  let inChannel = false;
  let hasContainer = false;
  let item: Map<string, string> | undefined;
  let field: string | undefined;
  let entryDepth = 3;
  parser.on('doctype', () => { throw new Error('A feed must not contain a DTD'); });
  parser.on('opentag', ({ name, attributes }) => {
    depth += 1;
    name = name.toLowerCase();
    if (depth === 1) {
      if (name !== 'rss' && name !== 'feed') throw new Error('Expected RSS or Atom');
      atom = name === 'feed';
      hasContainer = atom;
      entryDepth = atom ? 2 : 3;
    } else if (depth === 2 && name === 'channel' && !atom) {
      inChannel = true;
      hasContainer = true;
    }
    if (depth === entryDepth && (atom ? name === 'entry' : inChannel && name === 'item')) item = new Map();
    if (item && depth === entryDepth + 1 && fields.has(name)) {
      if (atom && name === 'link') {
        if (attributes.href && (!attributes.rel || attributes.rel === 'alternate') && !item.has('link')) item.set('link', attributes.href);
      } else {
        field = name;
      }
    }
  });
  const collect = (value: string) => {
    if (item && field) item.set(field, ((item.get(field) || '') + value).slice(0, field === 'content:encoded' ? PHOTO_HTML_CHARS : 5000));
  };
  parser.on('text', collect);
  parser.on('cdata', (value) => collect(field === 'title' ? cdataText(value).replace(/<[^>]*>/g, ' ') : value));
  parser.on('closetag', ({ name }) => {
    if (depth === entryDepth + 1) field = undefined;
    if (depth === entryDepth && item) {
      const title = headlineTitle(item.get('title') || '');
      const url = headlineLink(item.get('link')?.trim(), feed.publisher);
      const pub = datedEpoch(item.get(atom ? 'published' : 'pubdate') || '', feed.publisher);
      // Service Public emits a dated bulletin rather than a publication time; GOV.UK labels updated entries.
      const dateKind = Number.isFinite(pub) ? 'published' : feed.publisher === 'service-public' ? 'date' : 'updated';
      const dated = dateKind === 'published' ? pub
        : dateKind === 'date' ? datedEpoch(item.get('dc:date') || '', feed.publisher)
          : atom && feed.publisher === 'gov-uk' ? datedEpoch(item.get('updated') || '', feed.publisher) : NaN;
      if (title && url && Number.isFinite(dated)) {
        const datedAt = new Date(dated).toISOString();
        const author = feed.publisher === 'european-parliament' ? `© European Union, ${datedAt.slice(0, 4)} – EP`
          : headlineAuthor(item.get('dc:creator') || item.get('author'), feed.publisher);
        if (!headlineNeedsByline(feed.publisher) || author) {
          const photoCandidate = feed.publisher === 'global-voices' ? findGlobalVoicesPhoto(item.get('content:encoded') || '') : undefined;
          items.push({ title, url, datedAt, dateKind, publisher: feed.publisher, ...(author ? { author } : {}), ...(photoCandidate ? { photoCandidate } : {}) });
        }
      }
      item = undefined;
    }
    if (depth === 2 && name.toLowerCase() === 'channel' && !atom) inChannel = false;
    depth -= 1;
  });
  // An RSS-looking error page shouldn't clear a good edition as if it were an empty feed.
  parser.write(xml).close();
  if (!hasContainer) throw new Error('Missing feed channel');
  return items;
}

async function boundedHeadlineBody(response: Response, limit: number): Promise<string> {
  if (!response.body) throw new Error('Missing feed body');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let length = 0;
  let result = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) return result + decoder.decode();
      length += value.byteLength;
      if (length > limit) throw new Error('Response exceeded byte limit');
      result += decoder.decode(value, { stream: true });
    }
  } finally {
    void reader.cancel().catch(() => {});
  }
}

/** One bounded, best-effort Commons lookup per refreshed Global Voices feed. Photos are
 * optional: a failure (or no verified license) never suppresses or stales the source's titles. */
async function attachHeadlinePhotos(items: ParsedHeadline[], request: typeof fetch, now: number): Promise<HomeHeadline[]> {
  const files = [...new Set(items.flatMap(({ photoCandidate, datedAt }) => {
    const age = now - Date.parse(datedAt);
    return photoCandidate && age >= 0 && age < NEWS_DAY_MS + 2 * 3600_000 ? [photoCandidate.title] : [];
  }))].slice(0, 12);
  let photos: Map<string, HeadlinePhoto> | undefined;
  if (files.length) {
    try {
      const response = await request(commonsHeadlineQuery(files), {
        redirect: 'error', signal: AbortSignal.timeout(1600), headers: { Accept: 'application/json', 'User-Agent': USER_AGENT },
      });
      if (response.ok) photos = readCommonsHeadlinePhotos(JSON.parse(await boundedHeadlineBody(response, PHOTO_LOOKUP_BYTES)));
      else void response.body?.cancel().catch(() => {});
    } catch { /* Best effort. Return the same headlines without photos. */ }
  }
  return items.map(({ photoCandidate, ...headline }) => {
    const photo = photoCandidate && photos?.get(photoCandidate.title);
    return photo && photo.license === photoCandidate.license ? { ...headline, photo: { ...photo, alt: photoCandidate.alt } } : headline;
  });
}

interface FeedSnapshot { checkedAt: number; items: HomeHeadline[] }
interface CacheEntry { good?: FeedSnapshot; triedAt?: number; pending?: Promise<void> }

/** Only configured feeds are fetched, coalesced per source on this instance. Daily filtering is
 * done after retrieval, so a warm world feed cannot leak one visitor's calendar day to another. */
export function createHomeHeadlines(request: typeof fetch = fetch, now: () => number = Date.now) {
  const cache = new Map<string, CacheEntry>();
  async function fetchFeed(feed: HeadlineFeed): Promise<FeedSnapshot> {
    const response = await request(feed.url, { redirect: 'error', signal: AbortSignal.timeout(4200), headers: {
      Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml', 'User-Agent': USER_AGENT,
    } });
    if (!response.ok) {
      void response.body?.cancel().catch(() => {});
      throw new Error(`Publisher returned ${response.status}`);
    }
    const parsed = parseHomeHeadlineFeed(await boundedHeadlineBody(response, XML_BYTES), feed);
    const items = feed.publisher === 'global-voices' ? await attachHeadlinePhotos(parsed, request, now()) : parsed;
    return { checkedAt: now(), items };
  }
  async function load(feed: HeadlineFeed): Promise<CacheEntry> {
    let entry = cache.get(feed.url);
    if (!entry) {
      entry = {};
      cache.set(feed.url, entry);
    }
    const failed = entry.triedAt !== entry.good?.checkedAt;
    if (!entry.pending && (entry.triedAt === undefined || now() - entry.triedAt >= (failed ? HEADLINE_RETRY_MS : HEADLINE_REFRESH_MS))) {
      const cached = entry;
      cached.pending = fetchFeed(feed).then((snapshot) => {
        cached.good = snapshot;
        cached.triedAt = snapshot.checkedAt;
      }, () => { cached.triedAt = now(); }).finally(() => { cached.pending = undefined; });
    }
    await entry.pending;
    return entry;
  }
  return async ({ country, timeZone }: EntryEdition, enabled = true): Promise<HomeHeadlines> => {
    const local = localHeadlineEdition(country);
    const [localEntries, worldEntries] = enabled ? await Promise.all([
      Promise.all(local?.feeds.map(load) ?? []), Promise.all(WORLD_HEADLINE_EDITION.feeds.map(load)),
    ]) : [[], []];
    const asOf = now();
    const day = headlineDay(asOf, timeZone);
    function section(edition: HeadlineEdition | undefined, entries: CacheEntry[]): HeadlineSection {
      if (!edition) return emptyHeadlines('unsupported');
      if (!entries.length) return emptyHeadlines();
      const fresh = entries.filter((entry) => entry.good && entry.triedAt === entry.good.checkedAt);
      const recent = entries.flatMap((entry) => entry.good && asOf - entry.good.checkedAt < NEWS_DAY_MS ? [entry.good] : []);
      const items = distinctHeadlines(recent.flatMap(({ items }) => items.filter((item) => {
        const epoch = Date.parse(item.datedAt);
        return epoch <= asOf && headlineDay(epoch, timeZone) === day;
      })));
      const last = Math.max(...recent.map((snapshot) => snapshot.checkedAt));
      const checkedAt = Number.isFinite(last) ? new Date(last).toISOString() : null;
      if (!items.length) return emptyHeadlines(fresh.length === entries.length ? 'empty' : 'unavailable', checkedAt);
      const status = fresh.length === entries.length ? 'fresh' : fresh.length ? 'partial' : 'stale';
      return { status, checkedAt, items };
    }
    return { country, timeZone, asOf, day, local: section(local, localEntries), world: section(WORLD_HEADLINE_EDITION, worldEntries) };
  };
}
