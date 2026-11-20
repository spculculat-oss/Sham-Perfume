import { toLatinDigits } from '../../لغات/numerals';
import { QURAN_SURAHS } from './quranSurahs';

export const QURAN_ASSET = 'books/tanzil-uthmani-1.1.txt';
export const QURAN_INTEGRITY = 'sha256-S5H55uisZF0Dnk7YWzvkkueVIyoxzSLWaKxYI4ci4m8=';
export const QURAN_PAGE_SIZE = 16;
export const QURAN_BOOKMARK_KEY = 'sham_mushaf_bookmark_v1';
export const QURAN_SOURCE = 'https://tanzil.net/';
export interface QuranPlace { surah: number; ayah: number }
export type QuranText = readonly (readonly string[])[];
export const FIRST_AYAH: QuranPlace = { surah: 1, ayah: 1 };

export function quranPlace(surah: unknown, ayah: unknown): QuranPlace | undefined {
  if (typeof surah === 'string' && /^\d{1,3}$/.test(toLatinDigits(surah))) surah = Number(toLatinDigits(surah));
  if (typeof ayah === 'string' && /^\d{1,3}$/.test(toLatinDigits(ayah))) ayah = Number(toLatinDigits(ayah));
  if (typeof surah !== 'number' || !Number.isInteger(surah) || typeof ayah !== 'number' || !Number.isInteger(ayah)) return;
  const chapter = QURAN_SURAHS[surah - 1];
  if (chapter && ayah >= 1 && ayah <= chapter.verses) return { surah, ayah };
}

export function parseQuranBookmark(raw: string | null): QuranPlace | undefined {
  if (!raw) return;
  try {
    const value = JSON.parse(raw);
    return quranPlace(value?.surah, value?.ayah);
  } catch { return undefined; }
}

export function quranPage({ surah, ayah }: QuranPlace) {
  const chapter = QURAN_SURAHS[surah - 1];
  const start = Math.floor((ayah - 1) / QURAN_PAGE_SIZE) * QURAN_PAGE_SIZE + 1;
  const end = Math.min(chapter.verses, start + QURAN_PAGE_SIZE - 1);
  const previous = start > 1 ? { surah, ayah: start - QURAN_PAGE_SIZE }
    : quranPlace(surah - 1, QURAN_SURAHS[surah - 2]?.verses);
  const next = end < chapter.verses ? { surah, ayah: end + 1 } : quranPlace(surah + 1, 1);
  return { chapter, start, end, previous, next };
}

/** Tanzil Quran Text (Uthmani, Version 1.1) © 2007–2026 Tanzil Project · CC BY 3.0.
 * Parse only the row numbers, not the verse text. Don't display a partial, misnumbered or foreign file.
 * The publisher's unchanged copyright block is in the raw asset. https://tanzil.net/docs/text_license
 */
export function parseTanzilUthmani(raw: string): QuranText {
  const chapters: string[][] = QURAN_SURAHS.map(() => []);
  let surah = 1;
  let ayah = 1;
  let hasNotice = false;
  for (const line of raw.split(/\r?\n/)) {
    if (!line) continue;
    if (line.startsWith('#')) {
      if (line.includes('Tanzil Quran Text (Uthmani, Version 1.1)')) hasNotice = true;
      continue;
    }
    const row = /^(\d+)\|(\d+)\|([^|]+)$/.exec(line);
    if (!row || !chapters[surah - 1] || Number(row[1]) !== surah || Number(row[2]) !== ayah || !/[\u0621-\u064a]/.test(row[3])) {
      throw new Error('Invalid Tanzil verse or numbering');
    }
    chapters[surah - 1].push(row[3]);
    ayah++;
    if (ayah > QURAN_SURAHS[surah - 1].verses) { surah++; ayah = 1; }
  }
  if (surah !== QURAN_SURAHS.length + 1 || !hasNotice) throw new Error('Incomplete Tanzil text or notice');
  return chapters;
}
