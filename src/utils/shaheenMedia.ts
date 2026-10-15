import { requestApi } from './api';

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

const BLOCK = /```sham-media[^\n]*\n([\s\S]*?)```/g;

const cleanTopic = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const q = value.replace(/https?:\/\/\S+/g, ' ').replace(/[^\p{L}\p{N}\s'&+.,-]/gu, ' ').replace(/\s+/g, ' ').trim();
  return q.length >= 2 && q.length <= 80 && /\p{L}/u.test(q) ? q : undefined;
};
const topics = (value: unknown, max: number) =>
  [...new Set((Array.isArray(value) ? value : typeof value === 'string' ? [value] : []).map(cleanTopic).filter((x): x is string => Boolean(x)))].slice(0, max);

/** Topics requested in a reply (at most 2 image, 1 video and 5 place searches), or undefined. */
export function extractMediaRequest(text: string): MediaRequest | undefined {
  const images: string[] = [];
  const videos: string[] = [];
  const places: string[] = [];
  for (const match of text.matchAll(BLOCK)) {
    try {
      const data = JSON.parse(match[1].trim()) as Record<string, unknown>;
      if (!data || typeof data !== 'object') continue;
      images.push(...topics(data.images ?? data.image, 2));
      videos.push(...topics(data.videos ?? data.video, 1));
      places.push(...topics(data.places ?? data.place, 5));
    } catch { /* A malformed block is simply ignored. */ }
  }
  const request: MediaRequest = { images: [...new Set(images)].slice(0, 2), videos: [...new Set(videos)].slice(0, 1) };
  const uniquePlaces = [...new Set(places)].slice(0, 5);
  if (uniquePlaces.length) request.places = uniquePlaces;
  return request.images.length || request.videos.length || uniquePlaces.length ? request : undefined;
}

/** Hide the block (and an unfinished one at the very end) from the visible / spoken / copied text. */
export function stripMediaBlock(text: string): string {
  if (!text.includes('```sham-media')) return text;
  return text.replace(BLOCK, '').replace(/```sham-media[\s\S]*$/, '').replace(/\n{3,}/g, '\n\n').trim();
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
