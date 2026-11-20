import { ISLAMIC_BOOKS, ISLAMIC_SHELVES, type IslamicBook, type IslamicShelf } from './catalog';
import { ISLAMIC_LIBRARY_HASH } from './entry';
import { FIRST_AYAH, quranPlace, type QuranPlace } from './quran';

export const ISLAMIC_BOOKS_BY_ID = new Map<string, { book: IslamicBook; shelf: IslamicShelf }>(
  ISLAMIC_SHELVES.flatMap((shelf) => ISLAMIC_BOOKS[shelf.id].map((book) => [book.id, { book, shelf }] as const)),
);

export function islamicBookHash(bookId: string, place?: QuranPlace): string {
  const query = new URLSearchParams({ book: bookId });
  if (place && bookId === 'mushaf') {
    query.set('surah', String(place.surah));
    query.set('ayah', String(place.ayah));
  }
  return `${ISLAMIC_LIBRARY_HASH}?${query}`;
}

export function readIslamicBookHash(hash: string) {
  const queryStart = hash.indexOf('?');
  if (queryStart < 0 || hash.slice(0, queryStart) !== ISLAMIC_LIBRARY_HASH) return;
  const params = new URLSearchParams(hash.slice(queryStart + 1));
  const entry = ISLAMIC_BOOKS_BY_ID.get(params.get('book') || '');
  if (!entry) return;
  const surah = params.get('surah') || '1';
  const place = quranPlace(surah, params.get('ayah') || '1') || quranPlace(surah, 1) || FIRST_AYAH;
  return { ...entry, place: entry.book.access.kind === 'mushaf' ? place : undefined };
}
