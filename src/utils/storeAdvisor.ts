/**
 * «اسأل شاهين» in the store, without any server: understands what the visitor is looking for
 * («عطر عود رجالي للشتا تحت 300 جنيه»، «هدية لمراتي»، «something fresh for summer») and ranks the
 * products Shaheen enriched (src/utils/storeCatalog.ts) with the reasons for each choice.
 * Instant and identical on GitHub Pages and Vercel; the AI advisor (server/store.ts) refines it when available.
 */
import { searchText, type Family, type Gender, type Occasion, type Season, type StoreProduct } from './storeCatalog';
import { storeReasonList, storeReasonText, type StoreReason } from '../لغات/storeL10n';
import type { SupportedLanguage } from '../types/i18n';

export interface Wish {
  gender?: Gender; families: Family[]; seasons: Season[]; occasions: Occasion[];
  budgetMax?: number; budgetMin?: number; cheap: boolean; luxury: boolean; brands: string[]; words: string[];
}
/** A reason is a template + its values, resolved by src/لغات/storeL10n.ts in the visitor's language. */
export interface Pick { product: StoreProduct; score: number; reasons: StoreReason[] }
/** The why-chips of one pick in one language («طابع عود · في حدود ميزانيتك (250 ج)»). */
export const pickReasons = (pick: Pick, lang: SupportedLanguage): string[] =>
  pick.reasons.map((reason) => storeReasonText(lang, reason));
export const pickReasonLine = (pick: Pick, lang: SupportedLanguage): string => storeReasonList(lang, pick.reasons);
export interface Advice { wish: Wish; picks: Pick[]; matched: boolean }

const DIGITS: Record<string, string> = { '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4', '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9', '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4', '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9' };
const digits = (s: string) => s.replace(/[٠-٩۰-۹]/g, (c) => DIGITS[c]);

const GENDER_WORDS: [Gender, RegExp][] = [
  ['unisex', /للجنسين|يونيسكس|مشترك|unisex|both/i],
  ['women', /نسائي|نسائى|حريمي|ستات|بنات|(?:ل|لـ)(?:مراتي|زوجتي|ماما|امي|أمي|اختي|أختي|خطيبتي|صاحبتي|بنتي)|\b(?:women|woman|her|wife|mother|girlfriend|feminine)\b/i],
  ['men', /رجالي|رجالى|رجالة|(?:ل|لـ)(?:جوزي|زوجي|بابا|ابويا|أبويا|اخويا|أخويا|خطيبي|صاحبي|ابني)|\b(?:men|man|him|husband|father|boyfriend|masculine)\b/i],
];
const FAMILY_WORDS: [Family, RegExp][] = [
  ['oud', /عود|أود|دهن|oud|agarwood/i], ['floral', /ورد|زهري|زهور|ياسمين|فل|floral|rose|jasmine|flower/i],
  ['gourmand', /حلو|سكري|فانيليا|فانيلا|عسل|كراميل|sweet|vanilla|honey|gourmand/i], ['musk', /مسك|مسكي|musk/i],
  ['amber', /عنبر|عنبري|amber/i], ['fresh', /منعش|فريش|خفيف|انتعاش|fresh|light|clean/i], ['citrus', /حمضي|ليمون|برتقال|citrus|lemon|bergamot/i],
  ['aquatic', /بحري|مائي|بحر|aquatic|marine|ocean/i], ['woody', /خشبي|خشب|صندل|woody|sandalwood|cedar/i],
  ['spicy', /توابل|حار|زعفران|بهارات|spicy|saffron|pepper/i], ['oriental', /شرقي|شرقى|oriental/i], ['leather', /جلد|جلدي|leather/i],
  ['fruity', /فواكه|فاكهي|فاكهة|fruity|fruit/i], ['powdery', /بودري|بودرة|powdery/i],
];
const SEASON_WORDS: [Season, RegExp][] = [
  ['summer', /صيف|صيفي|الحر|summer|hot weather/i], ['winter', /شتا|شتاء|شتوي|البرد|winter|cold/i],
  ['spring', /ربيع|ربيعي|spring/i], ['autumn', /خريف|خريفي|autumn|fall/i],
];
const OCCASION_WORDS: [Occasion, RegExp][] = [
  ['gift', /هدية|هديه|اهادي|أهادي|gift|present/i], ['evening', /سهرة|سهره|سهرات|خروجة|بالليل|evening|night out|date/i],
  ['work', /شغل|عمل|مكتب|جامعة|مدرسة|work|office|school/i], ['daily', /يومي|كل يوم|daily|everyday/i],
  ['special', /فرح|مناسبة|مناسبات|عيد|خطوبة|wedding|occasion|special/i],
];
const BRAND_ALIASES: [string, RegExp][] = [
  ['Lattafa', /لطافة|لطافه|lattafa/i], ['Rasasi', /رصاصي|راساسي|rasasi/i], ['Al-Rehab', /الرحاب|al.?rehab/i], ['Shama', /شاما|shama/i],
  ['Dior', /ديور|dior/i], ['Baccarat', /باكارا|بكارات|baccarat/i], ['YSL', /سان لوران|ysl|saint laurent/i], ['De Pronom', /de pronom/i],
];
const STOP = new Set(['عايز', 'عاوز', 'محتاج', 'نفسي', 'ممكن', 'اريد', 'أريد', 'ابغى', 'أبغى', 'عطر', 'برفان', 'ريحة', 'ريحه', 'حاجة', 'حاجه', 'يكون', 'تكون', 'ويكون', 'عشان', 'علشان', 'لاجل', 'جنيه', 'جنية', 'تحت', 'فوق', 'اقل', 'أقل', 'اكتر', 'أكثر', 'من', 'في', 'على', 'الى', 'إلى', 'مع', 'او', 'أو', 'ولا', 'want', 'need', 'perfume', 'fragrance', 'scent', 'something', 'with', 'for', 'and', 'the', 'under', 'below', 'over', 'above', 'a', 'an', 'me']);

export function parseWish(text: string): Wish {
  const t = digits(text || '').toLowerCase();
  const wish: Wish = { families: [], seasons: [], occasions: [], cheap: false, luxury: false, brands: [], words: [] };
  wish.gender = GENDER_WORDS.find(([, re]) => re.test(t))?.[0];
  wish.families = FAMILY_WORDS.filter(([, re]) => re.test(t)).map(([f]) => f);
  wish.seasons = SEASON_WORDS.filter(([, re]) => re.test(t)).map(([s]) => s);
  wish.occasions = OCCASION_WORDS.filter(([, re]) => re.test(t)).map(([o]) => o);
  wish.brands = BRAND_ALIASES.filter(([, re]) => re.test(t)).map(([b]) => b);
  const max = t.match(/(?:تحت|اقل من|أقل من|مش اكتر من|مش أكثر من|لحد|حدود|في حدود|بحد اقصى|بحد أقصى|ميزانيتي|ميزانية|budget|under|below|less than|max(?:imum)?|up to)\s*(?:ال)?\s*(\d{2,6})/i);
  if (max) wish.budgetMax = Number(max[1]);
  const min = t.match(/(?:فوق|اكتر من|أكثر من|over|above|more than)\s*(\d{2,6})/i);
  if (min) wish.budgetMin = Number(min[1]);
  wish.cheap = /رخيص|ارخص|أرخص|اقتصادي|سعر حلو|مش غالي|اقل سعر|أقل سعر|cheap|budget|affordable/i.test(t);
  wish.luxury = /فاخر|فخم|غالي|راقي|luxury|luxurious|premium|niche/i.test(t);
  wish.words = t.replace(/[^\p{L}\p{N}\s-]/gu, ' ').split(/\s+/).filter((w) => w.length >= 3 && !STOP.has(w) && !/^\d+$/.test(w)).slice(0, 12);
  return wish;
}

/** Before Shaheen has trained a product: the classic season/occasion of its scent family. */
const WARM: Family[] = ['oud', 'amber', 'gourmand', 'spicy', 'leather', 'oriental'];
const COOL: Family[] = ['fresh', 'citrus', 'aquatic'];
export function inferSeasons(p: StoreProduct): Season[] {
  if (p.seasons.length) return p.seasons;
  const warm = p.families.some((f) => WARM.includes(f)); const cool = p.families.some((f) => COOL.includes(f));
  return warm && !cool ? ['winter', 'autumn'] : cool && !warm ? ['summer', 'spring'] : [];
}
export function inferOccasions(p: StoreProduct): Occasion[] {
  if (p.occasions.length) return p.occasions;
  const warm = p.families.some((f) => WARM.includes(f)); const cool = p.families.some((f) => COOL.includes(f));
  return warm && !cool ? ['evening', 'special'] : cool && !warm ? ['daily', 'work'] : [];
}

const hasCriteria = (w: Wish) => Boolean(w.gender || w.families.length || w.seasons.length || w.occasions.length || w.budgetMax || w.budgetMin || w.cheap || w.luxury || w.brands.length);

export function recommend(products: StoreProduct[], text: string, limit = 6): Advice {
  const wish = parseWish(text);
  const prices = products.map((p) => p.price).filter((n) => n > 0);
  const top = Math.max(1, ...prices);
  const picks: Pick[] = [];
  for (const product of products) {
    const reasons: StoreReason[] = [];
    let score = 0;
    if (!product.inStock) score -= 3;
    if (wish.gender) {
      if (product.gender === wish.gender) { score += 3; reasons.push({ key: 'reason_gender', vars: { value: wish.gender } }); }
      else if (product.gender === 'unisex' || !product.gender) score += 0.5;
      else continue; // a men's perfume is not a gift for «مراتي»
    }
    for (const f of wish.families) if (product.families.includes(f)) { score += 3; reasons.push({ key: 'reason_family', vars: { value: f } }); }
    const seasons = inferSeasons(product); const occasions = inferOccasions(product);
    for (const s of wish.seasons) if (seasons.includes(s) || seasons.includes('all')) { score += 2; reasons.push({ key: `season_${s}` as StoreReason['key'] }); }
    for (const o of wish.occasions) if (occasions.includes(o)) { score += 2; reasons.push({ key: 'reason_occasion', vars: { value: o } }); }
    if (wish.brands.length) {
      if (wish.brands.includes(product.brand)) { score += 4; reasons.push({ key: 'reason_brand', vars: { value: product.brand } }); }
      else score -= 1;
    }
    if (wish.budgetMax !== undefined) {
      if (product.price > wish.budgetMax) continue;
      score += 1; reasons.push({ key: 'reason_budget', vars: { value: product.price } });
    }
    if (wish.budgetMin !== undefined && product.price < wish.budgetMin) continue;
    if (wish.cheap) {
      score += 3 * (1 - product.price / top);
      if (product.price <= top / 3) reasons.push({ key: 'reason_cheap', vars: { value: product.price } });
    }
    if (wish.luxury) {
      score += 2 * (product.price / top);
      if (product.price >= top / 2) reasons.push({ key: 'reason_luxury' });
    }
    const haystack = searchText(product);
    const hits = wish.words.filter((w) => haystack.includes(w)).length;
    score += Math.min(4, hits * 1.5);
    if (hits && !reasons.length) reasons.push({ key: 'reason_words' });
    score += 0.3 * ((product.rating || 3) - 3) + (product.isFeatured ? 0.3 : 0) + (product.enrichedBy === 'shaheen' ? 0.2 : 0);
    picks.push({ product, score, reasons });
  }
  picks.sort((a, b) => b.score - a.score || a.product.price - b.product.price);
  const matched = picks.some((p) => p.reasons.length) && (hasCriteria(wish) || picks[0]?.score >= 1.5);
  const chosen = (matched ? picks.filter((p) => p.reasons.length) : picks).slice(0, limit);
  // No exact match: still say why each one is shown.
  for (const p of chosen) if (!p.reasons.length && p.product.rating) p.reasons.push({ key: 'reason_rated', vars: { value: p.product.rating } });
  return { wish, matched, picks: chosen };
}
