import { HEADLINE_PUBLISHERS, localHeadlineEdition, WORLD_HEADLINE_EDITION, type HeadlineEdition, type HeadlinePublisher } from '../data/homeHeadlineEditions';
import { isCountry } from './pricing';

export const HEADLINE_REFRESH_MS = 5 * 60_000;
export const HEADLINE_RETRY_MS = 60_000;
export const HEADLINE_ROTATE_MS = 8000;
export const NEWS_DAY_MS = 86_400_000;
export type HeadlineStatus = 'fresh' | 'partial' | 'stale' | 'empty' | 'unavailable' | 'unsupported';
export interface HomeHeadline {
  title: string;
  url: string;
  publisher: HeadlinePublisher;
  // RSS publication date; GOV.UK Atom supplies the official update date instead.
  datedAt: string;
  dateKind: 'published' | 'updated' | 'date';
}
export interface HeadlineSection {
  status: HeadlineStatus;
  checkedAt: string | null;
  items: HomeHeadline[];
}
export interface HomeHeadlines {
  country: string | null;
  timeZone: string;
  asOf: number;
  day: string;
  local: HeadlineSection;
  world: HeadlineSection;
}
export const emptyHeadlines = (status: HeadlineStatus = 'unavailable', checkedAt: string | null = null): HeadlineSection => ({ status, checkedAt, items: [] });

const dayFormats = new Map<string, Intl.DateTimeFormat>();
function dayFormat(timeZone: string): Intl.DateTimeFormat {
  const cached = dayFormats.get(timeZone);
  if (cached) return cached;
  const format = new Intl.DateTimeFormat('en-CA', { timeZone, calendar: 'gregory', numberingSystem: 'latn', year: 'numeric', month: '2-digit', day: '2-digit' });
  if (dayFormats.size >= 64) dayFormats.clear();
  dayFormats.set(timeZone, format);
  return format;
}
export function headlineTimeZone(input: unknown): string | undefined {
  if (typeof input !== 'string' || !/^[a-z][a-z0-9_+/-]{0,63}$/i.test(input)) return;
  try { return dayFormat(input).resolvedOptions().timeZone; } catch { return undefined; }
}
export function headlineDay(epoch: number, timeZone: string): string {
  const parts = dayFormat(timeZone).formatToParts(epoch);
  return ['year', 'month', 'day'].map((kind) => parts.find((part) => part.type === kind)?.value).join('-');
}
/** The next local midnight can be 23, 24, or 25 hours away; never just add 24 hours. */
export function nextHeadlineDay(epoch: number, timeZone: string): number {
  const day = headlineDay(epoch, timeZone);
  let low = epoch;
  let high = epoch + 36 * 3600_000;
  while (high - low > 1) {
    const mid = Math.floor((low + high) / 2);
    if (headlineDay(mid, timeZone) === day) low = mid;
    else high = mid;
  }
  return high;
}

export function headlineLink(input: unknown, publisher: HeadlinePublisher): string | null {
  if (typeof input !== 'string' || input.length > 2500) return null;
  const source = HEADLINE_PUBLISHERS[publisher];
  try {
    const url = new URL(input, source.page);
    if (!['https:', 'http:'].includes(url.protocol) || !source.hosts.some((host) => host === url.hostname) || url.username || url.password || url.port || !source.path.test(url.pathname)) return null;
    url.protocol = 'https:';
    if (publisher === 'youm7') url.hostname = 'www.youm7.com';
    url.search = '';
    url.hash = '';
    url.pathname = url.pathname.replace(/\/$/, '');
    return url.href;
  } catch { return null; }
}

export const headlineTitle = (input: string) => input.replace(/[\s\u0000-\u001f\u007f\u200e\u200f\u202a-\u202e\u2066-\u2069]+/g, ' ').trim().slice(0, 400);
const normalizedTitle = (title: string) => title.normalize('NFKD').toLowerCase().replace(/\p{M}+/gu, '').replace(/[\p{P}\s]+/gu, ' ').trim();

/** Same URL (including Youm7's short/full links), or exactly the same normalized headline. */
export function distinctHeadlines(items: readonly HomeHeadline[]): HomeHeadline[] {
  const urls = new Set<string>();
  const titles = new Set<string>();
  return [...items].sort((a, b) => b.datedAt.localeCompare(a.datedAt)).filter((item) => {
    const id = item.publisher === 'youm7' ? `youm7:${item.url.split('/').at(-1)}` : item.url;
    const title = normalizedTitle(item.title);
    if (urls.has(id) || titles.has(title)) return false;
    urls.add(id);
    titles.add(title);
    return true;
  });
}

const dateIso = (value: unknown): string | null => typeof value === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value)
  && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value ? value : null;

/** The browser accepts only headlines for the declared edition and editorial day. */
export function readHeadlines(input: unknown): HomeHeadlines {
  if (!input || typeof input !== 'object') throw new Error('Invalid headline response');
  const raw = input as Partial<HomeHeadlines>;
  const timeZone = headlineTimeZone(raw.timeZone);
  const { country, asOf } = raw;
  if ((country !== null && !isCountry(country)) || !timeZone || typeof asOf !== 'number' || !Number.isSafeInteger(asOf)
    || asOf < Date.UTC(2020, 0, 1) || asOf >= Date.UTC(2100, 0, 1) || raw.day !== headlineDay(asOf, timeZone)) throw new Error('Invalid headline edition');
  const day = raw.day;
  const section = (rawSection: unknown, edition: HeadlineEdition | undefined): HeadlineSection => {
    if (!edition) return emptyHeadlines('unsupported');
    if (!rawSection || typeof rawSection !== 'object') return emptyHeadlines();
    const data = rawSection as Partial<HeadlineSection>;
    const checkedAt = dateIso(data.checkedAt);
    if (!checkedAt || Date.parse(checkedAt) > asOf) return emptyHeadlines();
    if (data.status === 'empty' || data.status === 'unavailable') return emptyHeadlines(data.status, checkedAt);
    if (!Array.isArray(data.items) || (data.status !== 'fresh' && data.status !== 'partial' && data.status !== 'stale')) return emptyHeadlines();
    const items = distinctHeadlines(data.items.flatMap((item) => {
      if (!item || !edition.feeds.some((feed) => feed.publisher === item.publisher) || typeof item.title !== 'string') return [];
      const url = headlineLink(item.url, item.publisher);
      const title = headlineTitle(item.title);
      const datedAt = dateIso(item.datedAt);
      const epoch = datedAt ? Date.parse(datedAt) : NaN;
      return url && title && datedAt && epoch <= asOf && headlineDay(epoch, timeZone) === day
        && (item.dateKind === 'published' || item.dateKind === 'updated' || item.dateKind === 'date')
        ? [{ title, url, datedAt, dateKind: item.dateKind, publisher: item.publisher }] : [];
    }));
    return items.length ? { status: data.status, checkedAt, items } : emptyHeadlines('unavailable', checkedAt);
  };
  return { country, timeZone, asOf, day, local: section(raw.local, localHeadlineEdition(country)), world: section(raw.world, WORLD_HEADLINE_EDITION) };
}
