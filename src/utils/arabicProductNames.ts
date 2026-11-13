/**
 * «تنقية الأسماء العربية للمنتجات» — task #514/#503 (the council's catalog clean-up, approved by the owner on 2026-11-13).
 *
 * Shaheen's catalog editor wrote good Arabic for most products, but a review of all 1161 entries found:
 *   - one brand spelled up to ten ways (ميسون ألامبرا / مايسون أهلامبرا / ميصون الحمراء / «ميزون البهاما»…),
 *   - names read wrongly from English: «9AM Dive» → «نايت دايف», «Feroce» → «فيروس» (virus),
 *     «Rifaaqat» → «رفاهية», «Najdia Intense» → «نادي إنتنس», «Oud Mood» → «أمير العود» (another perfume),
 *   - three Arabic names left in Latin letters, and a few typos (الوطنحية، أرد الزعفران، لتافة…).
 *
 * The fixes are applied where the store reads an entry (mergeProduct) and where the robot writes one
 * (buildCatalogFile), so a later rewrite can never bring the old mistakes back. Facts only: a name is
 * corrected toward the product's own English name — nothing is added, no notes or claims are touched.
 */
import type { StoreEntry } from './storeCatalog';

const AR = '\\u0600-\\u06FF';
/** A whole Arabic word (`\b` does not work next to Arabic letters). */
const word = (alternatives: string) => new RegExp(`(?<![${AR}])(?:${alternatives})(?![${AR}])`, 'gu');

/** One spelling per brand, everywhere (names, descriptions, search words). */
export const BRAND_SPELLINGS: readonly [RegExp, string][] = [
  [word('(?:ميسون|ميزون|مايسون|ميصون) (?:ألامبرا|ألهامبرا|أهلامبرا|الحمراء|الهامبرا|الحمبرا|أهامبرا|البهاما)'), 'ميزون الحمراء'],
  [word('(?:ميسون|مايسون|ميصون) أسرار'), 'ميزون أسرار'],
  [word('ميصون'), 'ميزون'],
  [word('جراندور|جرانديور|غرانديور'), 'غراندور'],
  [word('بوجايرامي|بجيرامي'), 'بوجيرامي'],
  [word('الوطنعية|الوطنّية|الوطنحية'), 'الوطنية'],
  [word('أرد الزعفران'), 'أرض الزعفران'],
  [word('غلف أوركيد'), 'جلف أوركيد'],
  [word('زامايا'), 'زيمايا'],
  [word('بواسطة(?= زيمايا)'), 'من'],
  [word('فولار'), 'فولاري'],
  [word('للتافة|لتافة'), 'لطافة'],
  [word('سوبرماسي|سيبرماسي|سبريماسي|سوبريمسي'), 'سوبريماسي'],
  [word('بيندورا'), 'بندورا'],
  [word('سوفوفير'), 'سوفينير'],
  [word('إكسريت'), 'إكستريت'],
  [word('أ شن'), 'أديكشن'],
  [word('أدكشن'), 'أديكشن'],
  [word('بي ام'), 'بي إم'],
  [word('ناين ام|ناين إم'), 'ناين إيه إم'],
];

/** Product-specific corrections, checked against each product's English name. */
export const NAME_FIXES: Readonly<Record<string, { name?: string; swap?: readonly [string, string][] }>> = {
  'ALW-548': { name: 'تنزانيت من الوطنية نوال 100 مل ماء عطر' },
  'ALW-551': { name: 'سيلينا من الوطنية 100 مل للنساء', swap: [['سلينا', 'سيلينا']] },
  'ARD-554': { name: 'ليلى من أرض الزعفران 100 مل للنساء' },
  'LAT-052': { swap: [['أمير العود', 'عود مود']] },
  'AFN-397': { swap: [['نايت دايف', 'ناين إيه إم دايف']] },
  'AFN-395': { swap: [['نايت إلكسير', 'ناين بي إم إلكسير']] },
  'AFN-870': { swap: [['9 صباحاً', 'ناين إيه إم']] },
  'ARM-901': { swap: [['فيروس', 'فيروتشي']] },
  'PAR-982': { swap: [['رفاهية', 'رفاقات']] },
  'ARD-349': { swap: [['الإبداع من سيلفر', 'الإبداع سيلفر']] },
  'GRA-435': { name: 'بورت لا مير من غراندور إيليت', swap: [['فورت لا مير', 'بورت لا مير']] },
  'GRA-545': { swap: [['سافيو وود', 'سيفيور وود']] },
  'GRA-594': { swap: [['مادورون', 'مادرون']] },
  'RAS-092': { swap: [['برايف', 'برايفت']] },
  'LAT-121': { swap: [['نادي إنتنس', 'نجدية إنتنس']] },
  'LAT-241': { swap: [['سفير بلو', 'سافاير بلو']] },
  'LAT-095': { swap: [['خمري', 'خمرة'], ['ميرة', 'ميرا']] },
  'LAT-107': { swap: [['خمري', 'خمرة']] },
  'LAT-144': { swap: [['أنخيل', 'إنجل']] },
  'LAT-892': { swap: [['حياة مين', 'حياتي مين']] },
  'FRE-1114': { swap: [['أنونيموس', 'أنَنون']] },
  'RAY-1004': { swap: [['فاراوه', 'فرعون']] },
  'RUE-388': { swap: [['روب بروكا', 'رو بروكا']] },
  'MAI-331': { swap: [['دولتشيتا', 'دولتشيزا']] },
  'MAI-454': { swap: [['فلور أديكشن', 'فلاور أديكشن'], ['فلور أ شن', 'فلاور أديكشن']] },
};

const RAVE = word('راف|رايف');
const BY = word('باي');
const LATIN_ONLY = /^[^\u0600-\u06FF]*$/;

/** One Arabic text with the brand spellings unified (and «باي» → «من» in names). */
export function fixArabicText(text: string, sku = '', isName = false): string {
  let out = text;
  for (const [re, to] of BRAND_SPELLINGS) out = out.replace(re, to);
  if (sku.startsWith('RAV-')) out = out.replace(RAVE, 'ريف');
  if (isName) out = out.replace(BY, 'من');
  for (const [from, to] of NAME_FIXES[sku]?.swap || []) out = out.replace(word(from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), to);
  return out.replace(/\s{2,}/g, ' ').trim();
}

/** The entry with its Arabic name, description and search words cleaned. Nothing else changes. */
export function fixArabicEntry<E extends Pick<StoreEntry, 'nameAr' | 'descriptionAr' | 'tags'>>(sku: string, e: E): E {
  const fix = NAME_FIXES[sku];
  const nameAr = fix?.name || fixArabicText(e.nameAr, sku, true);
  const descriptionAr = fixArabicText(e.descriptionAr, sku);
  const tags = [...new Set((e.tags || []).map((t) => (/[\u0600-\u06FF]/.test(t) ? fixArabicText(t, sku) : t)))];
  if (nameAr === e.nameAr && descriptionAr === e.descriptionAr && tags.join('\u0001') === (e.tags || []).join('\u0001')) return e;
  return { ...e, nameAr, descriptionAr, tags };
}

/** An «Arabic» name with no Arabic letter in it. */
export const isLatinOnlyName = (name = ''): boolean => Boolean(name.trim()) && LATIN_ONLY.test(name);
