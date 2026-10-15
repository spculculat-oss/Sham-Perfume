/**
 * «الخبير شاهين» visual aids: real images and videos for a perfumery topic.
 *
 * Shaheen never writes media links itself (models invent URLs). It only asks for a topic — a short
 * search phrase in a ```sham-media block — and this module looks it up:
 * - images: Wikimedia Commons (free, no key, every result has a license and an author credit);
 * - videos: YouTube Data API v3 when a key is available (YOUTUBE_API_KEY, else the Google key in
 *   GEMINI_API_KEY if that project has the YouTube API enabled); otherwise a YouTube search link.
 * - places: OpenStreetMap geocoding (Nominatim, Photon as fallback) for the map under the answer.
 * Results are cached, filtered for safety, and contain no AI vendor names.
 */
import express from 'express';
import { RateLimiter, clientKey } from './core/rateLimit';

type Env = Record<string, string | undefined>;

export interface MediaImage {
  title: string;
  /** 500px preview served by Wikimedia (a standard thumbnail size). */
  thumb: string;
  /** Bigger version for the enlarged view (Wikimedia's 2x responsive URL). */
  large?: string;
  width: number;
  height: number;
  /** File page on Wikimedia Commons (license, author, full resolution). */
  page: string;
  license: string;
  author: string;
}
export interface MediaVideo { id: string; title: string; channel: string; thumb: string }
export interface ImageResult { images: MediaImage[]; source: 'wikimedia' }
export interface VideoResult { videos: MediaVideo[]; searchUrl: string; source: 'youtube' | 'link' }
export interface MediaPlace {
  /** The topic as Shaheen named it (e.g. "Grasse, France"). */
  name: string;
  /** Full place name from OpenStreetMap, in the visitor's language when available. */
  label: string;
  lat: number;
  lon: number;
  /** OpenStreetMap page centred on the place. */
  osm: string;
}
export interface PlaceResult { places: MediaPlace[]; source: 'openstreetmap' }
type AnyResult = ImageResult | VideoResult | PlaceResult;

const UA = 'ShamPerfume/1.0 (https://spculculat-oss.github.io/Sham-Perfume/; perfume design platform)';
/** Titles that must never be shown next to a perfumery answer, whatever the search returned. */
const UNSAFE = /\b(nude|naked|nsfw|sex|porn|erotic|genital|penis|vagina|breast|topless|lingerie|corpse|gore|blood|execution|nazi|swastika)\b/i;

/** A search phrase from the model: letters (any script), digits, spaces and a few separators; 2–80 chars. */
export function sanitizeQuery(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const q = raw.normalize('NFKC').replace(/[^\p{L}\p{N}\s'&+.,-]/gu, ' ').replace(/\s+/g, ' ').trim();
  return q.length >= 2 && q.length <= 80 && /\p{L}/u.test(q) ? q : undefined;
}

const stripHtml = (s: unknown) => (typeof s === 'string' ? s.replace(/<[^>]*>/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim() : '');

/** Wikimedia media hosts only (thumbnails moved to thumb.wikimedia.org in 2026); tracking params dropped. */
function wikimediaUrl(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined;
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:' || !/^(upload|thumb)\.wikimedia\.org$/.test(url.hostname)) return undefined;
    for (const key of [...url.searchParams.keys()]) if (key.startsWith('utm_')) url.searchParams.delete(key);
    return url.href;
  } catch { return undefined; }
}

interface CommonsPage {
  index?: number; title?: string;
  imageinfo?: { thumburl?: string; width?: number; responsiveUrls?: Record<string, string>; thumbwidth?: number; thumbheight?: number; descriptionurl?: string; mime?: string;
    extmetadata?: Record<string, { value?: unknown }> }[];
}

async function commonsSearch(query: string, options: { fetch?: typeof fetch; signal?: AbortSignal; limit?: number }): Promise<MediaImage[]> {
  const request = options.fetch || fetch;
  const params = new URLSearchParams({
    action: 'query', format: 'json', formatversion: '1', generator: 'search', gsrnamespace: '6', gsrlimit: '16',
    gsrsearch: `${query} filetype:bitmap`, prop: 'imageinfo', iiprop: 'url|size|mime|extmetadata', iiurlwidth: '500',
    iiextmetadatafilter: 'LicenseShortName|Artist', origin: '*',
  });
  const response = await request(`https://commons.wikimedia.org/w/api.php?${params}`, { headers: { 'User-Agent': UA, 'Api-User-Agent': UA }, signal: options.signal });
  if (!response.ok) throw new Error(`Wikimedia HTTP ${response.status}`);
  const data = await response.json() as { query?: { pages?: Record<string, CommonsPage> } };
  const images = Object.values(data.query?.pages || {})
    .sort((a, b) => (a.index ?? 99) - (b.index ?? 99))
    .map((p): MediaImage | undefined => {
      const info = p.imageinfo?.[0];
      const title = (p.title || '').replace(/^File:/, '').replace(/\.[a-z0-9]{2,5}$/i, '').replace(/_/g, ' ').trim();
      const thumb = wikimediaUrl(info?.thumburl);
      if (!info || !thumb) return undefined;
      if (!/^image\/(jpeg|png|webp)$/.test(info.mime || '')) return undefined;
      if ((info.thumbwidth || 0) < 200 || (info.thumbheight || 0) < 150 || UNSAFE.test(title)) return undefined;
      const meta = info.extmetadata || {};
      return {
        title: title.slice(0, 120), thumb, width: info.thumbwidth || 500, height: info.thumbheight || 375,
        ...(wikimediaUrl(info.responsiveUrls?.['2']) ? { large: wikimediaUrl(info.responsiveUrls?.['2']) } : {}),
        page: info.descriptionurl && /^https:\/\/commons\.wikimedia\.org\//.test(info.descriptionurl) ? info.descriptionurl : 'https://commons.wikimedia.org/',
        license: stripHtml(meta.LicenseShortName?.value).slice(0, 40) || 'Wikimedia Commons',
        author: stripHtml(meta.Artist?.value).slice(0, 80),
      };
    })
    .filter((x): x is MediaImage => Boolean(x))
    // Commons expands synonyms (oud → Dutch place names): keep files whose title names the topic.
    .filter((img) => !terms(query).length || terms(query).some((t) => terms(img.title).includes(t)))
    .slice(0, options.limit ?? 4);
  return images;
}

const terms = (text: string) => text.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((t) => t.length >= 3).map((t) => t.replace(/s$/, ''));

/** Commons needs every word to match: an empty multi-word search is retried with fewer words. */
export async function searchImages(query: string, options: { fetch?: typeof fetch; signal?: AbortSignal; limit?: number } = {}): Promise<ImageResult> {
  const words = query.split(' ');
  for (let n = words.length; n >= Math.max(1, words.length - 2); n--) {
    const images = await commonsSearch(words.slice(0, n).join(' '), options);
    if (images.length) return { images, source: 'wikimedia' };
  }
  return { images: [], source: 'wikimedia' };
}

/** YouTube key: its own, else the Google AI key (works only if that project enabled the YouTube API). */
function youtubeKey(env: Env): string | undefined {
  const own = env.YOUTUBE_API_KEY?.trim();
  if (own && !/^MY_|placeholder/i.test(own)) return own;
  const google = env.GEMINI_API_KEY?.trim();
  return google && !/^MY_|placeholder/i.test(google) ? google : undefined;
}
// A key that YouTube refused (API not enabled / quota) is not retried for a while.
const refused: Map<string, number> = ((globalThis as { __shamYoutubeRefused?: Map<string, number> }).__shamYoutubeRefused ??= new Map());

export async function searchVideos(query: string, options: { env?: Env; fetch?: typeof fetch; signal?: AbortSignal; lang?: string; limit?: number } = {}): Promise<VideoResult> {
  const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
  const key = youtubeKey(options.env || process.env);
  if (!key || (refused.get(key) || 0) > Date.now()) return { videos: [], searchUrl, source: 'link' };
  const params = new URLSearchParams({
    part: 'snippet', type: 'video', maxResults: '6', safeSearch: 'strict', videoEmbeddable: 'true', q: query,
    ...(options.lang && /^[a-z]{2}$/.test(options.lang) ? { relevanceLanguage: options.lang } : {}),
  });
  try {
    // The key travels in a header, never in the URL (URLs end up in logs).
    const response = await (options.fetch || fetch)(`https://www.googleapis.com/youtube/v3/search?${params}`, { headers: { 'x-goog-api-key': key }, signal: options.signal });
    if (response.status === 403 || response.status === 400 || response.status === 429) {
      refused.set(key, Date.now() + 6 * 3600_000);
      return { videos: [], searchUrl, source: 'link' };
    }
    if (!response.ok) return { videos: [], searchUrl, source: 'link' };
    const data = await response.json() as { items?: { id?: { videoId?: string }; snippet?: { title?: string; channelTitle?: string; thumbnails?: Record<string, { url?: string }> } }[] };
    const videos = (data.items || []).map((item): MediaVideo | undefined => {
      const id = item.id?.videoId;
      const title = stripHtml(item.snippet?.title);
      if (!id || !/^[\w-]{11}$/.test(id) || !title || UNSAFE.test(title)) return undefined;
      return { id, title: title.slice(0, 140), channel: stripHtml(item.snippet?.channelTitle).slice(0, 60), thumb: `https://i.ytimg.com/vi/${id}/mqdefault.jpg` };
    }).filter((x): x is MediaVideo => Boolean(x)).slice(0, options.limit ?? 2);
    return { videos, searchUrl, source: videos.length ? 'youtube' : 'link' };
  } catch (error) {
    if (options.signal?.aborted) throw error;
    return { videos: [], searchUrl, source: 'link' };
  }
}

const validCoord = (lat: number, lon: number) => Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180 && !(lat === 0 && lon === 0);
const osmLink = (lat: number, lon: number) => `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=9/${lat}/${lon}`;
// Nominatim allows one request per second per application: requests are spaced on this instance.
const geo: { next: number } = ((globalThis as { __shamGeoThrottle?: { next: number } }).__shamGeoThrottle ??= { next: 0 });
/** Waits for this instance's Nominatim slot; false when the queue is too long (use the fallback instead). */
async function geoTurn(signal?: AbortSignal): Promise<boolean> {
  const now = Date.now();
  const wait = Math.max(0, geo.next - now);
  if (wait > 4000) return false;
  geo.next = Math.max(now, geo.next) + 1100;
  if (wait) await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, wait);
    signal?.addEventListener('abort', () => { clearTimeout(timer); reject(signal.reason); }, { once: true });
  });
  return true;
}

/** One place → coordinates. Nominatim (OpenStreetMap) first, Photon (also OpenStreetMap data) as fallback. */
export async function searchPlace(query: string, options: { fetch?: typeof fetch; signal?: AbortSignal; lang?: string } = {}): Promise<PlaceResult> {
  const request = options.fetch || fetch;
  const lang = options.lang && /^[a-z]{2}$/.test(options.lang) ? options.lang : 'en';
  const found = (lat: number, lon: number, label: string): PlaceResult => ({ source: 'openstreetmap', places: [{
    name: query, label: stripHtml(label).slice(0, 140) || query, lat: Math.round(lat * 1e5) / 1e5, lon: Math.round(lon * 1e5) / 1e5, osm: '',
  }].map((p) => ({ ...p, osm: osmLink(p.lat, p.lon) })) });
  try {
    if (!(await geoTurn(options.signal))) throw new Error('Nominatim queue is full');
    const params = new URLSearchParams({ format: 'jsonv2', limit: '1', q: query, 'accept-language': `${lang},en` });
    const response = await request(`https://nominatim.openstreetmap.org/search?${params}`, { headers: { 'User-Agent': UA, Referer: 'https://spculculat-oss.github.io/Sham-Perfume/' }, signal: options.signal });
    if (response.ok) {
      const hit = ((await response.json()) as { lat?: string; lon?: string; display_name?: string }[])[0];
      const lat = Number(hit?.lat); const lon = Number(hit?.lon);
      if (hit && validCoord(lat, lon)) return found(lat, lon, hit.display_name || query);
      if (!hit) return { places: [], source: 'openstreetmap' }; // OpenStreetMap does not know it
    }
  } catch (error) {
    if (options.signal?.aborted) throw error;
  }
  // Nominatim busy or blocked from this host: Photon (komoot) serves the same OpenStreetMap data.
  const params = new URLSearchParams({ q: query, limit: '1', ...(['en', 'de', 'fr'].includes(lang) ? { lang } : {}) });
  const response = await request(`https://photon.komoot.io/api/?${params}`, { headers: { 'User-Agent': UA }, signal: options.signal });
  if (!response.ok) throw new Error(`Photon HTTP ${response.status}`);
  const feature = ((await response.json()) as { features?: { geometry?: { coordinates?: number[] }; properties?: Record<string, string> }[] }).features?.[0];
  const [lon, lat] = feature?.geometry?.coordinates || [];
  if (!feature || !validCoord(Number(lat), Number(lon))) return { places: [], source: 'openstreetmap' };
  const p = feature.properties || {};
  return found(Number(lat), Number(lon), [p.name, p.city !== p.name ? p.city : '', p.state, p.country].filter(Boolean).join(', '));
}

type Cached = { at: number; data: AnyResult };
const cache: Map<string, Cached> = ((globalThis as { __shamMediaCache?: Map<string, Cached> }).__shamMediaCache ??= new Map());
// Empty image results and a plain search link (no key / key refused) are rechecked hourly so enabling the YouTube API shows up soon.
const ttl = (data: AnyResult) => {
  if (('images' in data && !data.images.length) || ('places' in data && !data.places.length) || ('source' in data && data.source === 'link')) return 3600_000;
  return 'places' in data ? 7 * 24 * 3600_000 : 24 * 3600_000; // places do not move
};

/** Public route: GET /api/media?type=image|video&q=…&lang=xx (rate limited, cached for a day). */
export function createMediaRouter(options: { env?: Env; fetch?: typeof fetch } = {}) {
  const env = options.env || process.env;
  const router = express.Router();
  const limiter = new RateLimiter(Number(env.SHAM_MEDIA_RATE_PER_MIN) || 40, 60_000);
  router.get('/media', async (req, res) => {
    const type = req.query.type === 'video' || req.query.type === 'image' || req.query.type === 'place' ? req.query.type : undefined;
    const q = sanitizeQuery(req.query.q);
    const lang = typeof req.query.lang === 'string' && /^[a-z]{2,3}$/.test(req.query.lang) ? req.query.lang : undefined;
    if (!type || !q) { res.status(400).json({ error: 'type (image|video|place) and a short q are required', code: 'INVALID_MEDIA_QUERY' }); return; }
    const key = `${type}:${lang || ''}:${q.toLowerCase()}`;
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < ttl(hit.data)) { res.setHeader('Cache-Control', 'public, max-age=3600'); res.json(hit.data); return; }
    if (!limiter.allow(clientKey(req))) { res.status(429).json({ error: 'Too many media lookups, please wait a minute', code: 'RATE_LIMITED' }); return; }
    try {
      const signal = AbortSignal.timeout(type === 'place' ? 10_000 : 8000);
      const data = type === 'image'
        ? await searchImages(q, { fetch: options.fetch, signal })
        : type === 'place'
          ? await searchPlace(q, { fetch: options.fetch, signal, lang: lang?.slice(0, 2) })
          : await searchVideos(q, { env, fetch: options.fetch, signal, lang: lang?.slice(0, 2) });
      if (cache.size > 500) cache.delete(cache.keys().next().value!);
      cache.set(key, { at: Date.now(), data });
      res.setHeader('Cache-Control', 'public, max-age=3600');
      res.json(data);
    } catch {
      res.status(502).json({ error: 'Media search is unavailable right now', code: 'MEDIA_UNAVAILABLE' });
    }
  });
  return router;
}
