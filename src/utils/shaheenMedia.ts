import { requestApi } from './api';
import { findMediaBlocks, removeMediaBlocks } from './mediaBlock';

/**
 * Shaheen asks for visual aids with a hidden ```sham-media block at the end of a reply:
 *   {"images":["agarwood"],"videos":["steam distillation of essential oils"],"places":["Grasse, France"]}
 * The block holds search topics only (never links); the site looks them up through /api/media.
 */
export interface MediaRequest { images: string[]; videos: string[]; places?: string[] }
export interface MediaImage { title: string; thumb: string; large?: string; width: number; height: number; page: string; license: string; author: string }
export interface MediaVideo { id: string; title: string; channel: string; thumb: string }
export interface ImageResult { images: MediaImage[] }
export interface VideoResult { videos: MediaVideo[]; searchUrl: string }
export interface MediaPlace { name: string; label: string; lat: number; lon: number; osm: string }
export interface PlaceResult { places: MediaPlace[] }


const cleanTopic = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const q = value.replace(/https?:\/\/\S+/g, ' ').replace(/[^\p{L}\p{N}\s'&+.,-]/gu, ' ').replace(/\s+/g, ' ').trim();
  return q.length >= 2 && q.length <= 80 && /\p{L}/u.test(q) ? q : undefined;
};
const topics = (value: unknown, max: number) =>
  [...new Set((Array.isArray(value) ? value : typeof value === 'string' ? [value] : []).map(cleanTopic).filter((x): x is string => Boolean(x)))].slice(0, max);

/**
 * Places only belong on a map when the question is about geography (origin, farms, cities, museums…)
 * or the answer itself talks about that place. Seen live: «Metzingen, Germany» (a brand's head office)
 * pinned under an answer that had nothing to do with places.
 */
const GEO_QUESTION = /(?:منشا|منشأ|موطن|مزارع|مزرعه|مزرعة|حقول|حقل|يزرع|تزرع|يُزرع|تُزرع|زراع|ينبت|تنبت|يستخرج|يُستخرج|تستخرج|يتصنع|اين|أين|وين|فين|مكان|اماكن|أماكن|خريط|خرائط|دوله|دولة|دول(?=\s|$)|بلد|بلاد|مدينه|مدينة|مدن|منطقه|منطقة|مناطق|متحف|متاحف|سوق|اسواق|أسواق|رحله|رحلة|اسافر|أسافر|ازور|أزور|where|origin|map|farm|field|grown|grow|harvest|countr|city|cities|region|museum|market|visit|travel|located)/i;
const AR_PLACES: Record<string, string> = {
  grasse: 'غراس|جراس|غراسي', taif: 'طائف|الطايف', kannauj: 'كنوج|قنوج|كانوج', kazanlak: 'كازانلك|كازانلاك', bulgaria: 'بلغاريا',
  isparta: 'اسبارطة|إسبارطة|إسبرطة', turkey: 'تركيا', assam: 'آسام|اسام|أسام', india: 'الهند|هند', madagascar: 'مدغشقر',
  oman: 'عمان|عُمان', dhofar: 'ظفار', salalah: 'صلالة', yemen: 'اليمن', somalia: 'الصومال', ethiopia: 'إثيوبيا|اثيوبيا|الحبشة',
  indonesia: 'إندونيسيا|اندونيسيا', java: 'جاوة|جاوا', cambodia: 'كمبوديا', laos: 'لاوس', vietnam: 'فيتنام', thailand: 'تايلاند',
  china: 'الصين', hainan: 'هاينان', 'sri lanka': 'سريلانكا|سيريلانكا', morocco: 'المغرب', egypt: 'مصر', tunisia: 'تونس',
  damascus: 'دمشق|الشام', syria: 'سوريا', iran: 'إيران|ايران', paris: 'باريس', provence: 'بروفانس', france: 'فرنسا',
  calabria: 'كالابريا', sicily: 'صقلية', italy: 'إيطاليا|ايطاليا', mysore: 'ميسور', haiti: 'هايتي', reunion: 'ريونيون',
  comoros: 'القمر', 'saudi arabia': 'السعودية', mecca: 'مكة', medina: 'المدينة', dubai: 'دبي', uae: 'الإمارات|الامارات',
};
const fold = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
function placeInAnswer(place: string, answer: string) {
  const text = fold(answer);
  return place.split(',').map((part) => fold(part).trim()).filter((part) => part.length >= 3).some((part) => {
    const escaped = part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (new RegExp(`(?<!\\p{L})${escaped}(?!\\p{L})`, 'u').test(text)) return true;
    const arabic = AR_PLACES[part];
    return Boolean(arabic && new RegExp(`(?:${arabic})`).test(answer));
  });
}
export function relevantPlaces(places: string[], question: string, answer: string) {
  if (GEO_QUESTION.test(question)) return places;
  return places.filter((place) => placeInAnswer(place, removeMediaBlocks(answer)));
}

/**
 * Topics requested in a reply (at most 2 image, 1 video and 5 place searches), or undefined.
 * With the visitor's `question`, places that do not fit it are left off the map.
 */
export function extractMediaRequest(text: string, question?: string): MediaRequest | undefined {
  const images: string[] = [];
  const videos: string[] = [];
  const places: string[] = [];
  for (const { data } of findMediaBlocks(text)) {
    if (!data) continue;
    images.push(...topics(data.images ?? data.image, 2));
    videos.push(...topics(data.videos ?? data.video, 1));
    places.push(...topics(data.places ?? data.place, 5));
  }
  const request: MediaRequest = { images: [...new Set(images)].slice(0, 2), videos: [...new Set(videos)].slice(0, 1) };
  let uniquePlaces = [...new Set(places)].slice(0, 5);
  if (question !== undefined) uniquePlaces = relevantPlaces(uniquePlaces, question, text);
  if (uniquePlaces.length) request.places = uniquePlaces;
  return request.images.length || request.videos.length || uniquePlaces.length ? request : undefined;
}

/** Hide the block (and an unfinished one at the very end) from the visible / spoken / copied text. */
export function stripMediaBlock(text: string): string {
  return removeMediaBlocks(text);
}

const cache = new Map<string, Promise<unknown>>();
/** Cached per page load; a failed lookup is forgotten so it can be retried later. */
export function fetchMedia(type: 'image', q: string, lang: string): Promise<ImageResult>;
export function fetchMedia(type: 'video', q: string, lang: string): Promise<VideoResult>;
export function fetchMedia(type: 'place', q: string, lang: string): Promise<PlaceResult>;
export function fetchMedia(type: 'image' | 'video' | 'place', q: string, lang: string): Promise<unknown> {
  const key = `${type}:${lang}:${q.toLowerCase()}`;
  let pending = cache.get(key);
  if (!pending) {
    const params = new URLSearchParams({ type, q, ...(lang ? { lang: lang.slice(0, 2) } : {}) });
    pending = requestApi(`/api/media?${params}`, undefined, 15000);
    pending.catch(() => cache.delete(key));
    cache.set(key, pending);
  }
  return pending;
}

/** OpenStreetMap search for a place name (used when the API is unreachable). */
export const osmSearchUrl = (q: string) => `https://www.openstreetmap.org/search?query=${encodeURIComponent(q)}`;
export const youtubeSearchUrl = (q: string) => `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;
