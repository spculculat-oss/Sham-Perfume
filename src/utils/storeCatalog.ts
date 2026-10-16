/**
 * «متجر شام» as «الخبير شاهين» trains it: the raw product list (src/data/products.json, filled by the
 * merchants' import scripts) plus Shaheen's enrichment (src/data/live/store-catalog.json, rewritten every
 * 12 hours by scripts/shaheen-store): clean Arabic/English names and descriptions, scent family, notes
 * (only for perfumes whose notes are publicly known), season, occasion and search words.
 * Pure and shared by the store page, the store advisor (server/store.ts) and the training script.
 * Visitors never receive supplier prices from here.
 */

export interface RawProduct {
  id: number | string; sku?: string; nameAr?: string; nameEn?: string; descriptionAr?: string; descriptionEn?: string;
  imageUrl?: string | null; category?: string; brand?: string; supplierPrice?: number; ourPrice?: number;
  stockStatus?: string; isFeatured?: boolean; isNew?: boolean; rating?: number; reviewCount?: number; createdAt?: string;
  /** Filled by «مستورد شاهين» (scripts/shaheen-import) from the supplier's real product page. */
  images?: string[]; slug?: string; url?: string | null; sizeMl?: number; concentration?: string; longevity?: string;
  notes?: { top?: string[]; heart?: string[]; base?: string[] }; families?: string[]; seasonsSource?: string[]; occasionsSource?: string[];
  supplierId?: string | null; supplierName?: string | null; supplierSku?: string;
  /** false = hidden by «مراجع الصفحات» (scripts/shaheen-import/review.ts) until the problem is fixed. */
  published?: boolean;
}

export const FAMILIES = ['oud', 'oriental', 'amber', 'woody', 'floral', 'fresh', 'citrus', 'aquatic', 'fruity', 'gourmand', 'musk', 'spicy', 'leather', 'powdery'] as const;
export type Family = typeof FAMILIES[number];
export const FAMILY_LABEL: Record<Family, { ar: string; en: string }> = {
  oud: { ar: 'عود', en: 'Oud' }, oriental: { ar: 'شرقي', en: 'Oriental' }, amber: { ar: 'عنبري', en: 'Amber' }, woody: { ar: 'خشبي', en: 'Woody' },
  floral: { ar: 'زهري', en: 'Floral' }, fresh: { ar: 'منعش', en: 'Fresh' }, citrus: { ar: 'حمضي', en: 'Citrus' }, aquatic: { ar: 'مائي', en: 'Aquatic' },
  fruity: { ar: 'فواكه', en: 'Fruity' }, gourmand: { ar: 'حلو', en: 'Gourmand' }, musk: { ar: 'مسكي', en: 'Musky' }, spicy: { ar: 'توابل', en: 'Spicy' },
  leather: { ar: 'جلدي', en: 'Leather' }, powdery: { ar: 'بودري', en: 'Powdery' },
};
export const GENDERS = ['men', 'women', 'unisex'] as const;
export type Gender = typeof GENDERS[number];
export const SEASONS = ['summer', 'winter', 'spring', 'autumn', 'all'] as const;
export type Season = typeof SEASONS[number];
export const OCCASIONS = ['daily', 'evening', 'work', 'special', 'gift'] as const;
export type Occasion = typeof OCCASIONS[number];
export const SEASON_LABEL: Record<Season, { ar: string; en: string }> = {
  summer: { ar: 'صيفي', en: 'Summer' }, winter: { ar: 'شتوي', en: 'Winter' }, spring: { ar: 'ربيعي', en: 'Spring' }, autumn: { ar: 'خريفي', en: 'Autumn' }, all: { ar: 'كل المواسم', en: 'All seasons' },
};
export const OCCASION_LABEL: Record<Occasion, { ar: string; en: string }> = {
  daily: { ar: 'يومي', en: 'Daily' }, evening: { ar: 'سهرات', en: 'Evening' }, work: { ar: 'عمل', en: 'Work' }, special: { ar: 'مناسبات', en: 'Special occasions' }, gift: { ar: 'هدية', en: 'Gift' },
};
export const GENDER_LABEL: Record<Gender, { ar: string; en: string }> = { men: { ar: 'رجالي', en: 'Men' }, women: { ar: 'نسائي', en: 'Women' }, unisex: { ar: 'للجنسين', en: 'Unisex' } };

export interface StoreEntry {
  /** Hash of the merchant's text: when it changes, Shaheen rewrites the entry. */
  sourceHash: string;
  editor: 'shaheen' | 'rules';
  updatedAt: string;
  nameAr: string; nameEn: string;
  descriptionAr: string; descriptionEn: string;
  gender?: Gender;
  families: Family[];
  /** Only for perfumes whose notes are publicly documented; empty otherwise (never invented). */
  notes: { top: string[]; heart: string[]; base: string[] };
  seasons: Season[]; occasions: Occasion[];
  /** Extra search words (Arabic and English), e.g. «خشبي، ثابت، هدية». */
  tags: string[];
}

export interface StoreCatalogFile {
  version: 1; updatedAt: string; nextUpdateAt: string; editor: 'shaheen' | 'rules';
  entries: Record<string, StoreEntry>;
  audit: { checked: number; issues: { sku: string; issues: string[] }[] };
}

/** What the store shows: merchant data + Shaheen's enrichment, without supplier prices. */
export interface StoreProduct {
  id: number | string; sku: string; name: { ar: string; en: string }; description: { ar: string; en: string };
  brand: string; category: string; gender?: Gender; families: Family[]; notes: StoreEntry['notes'];
  seasons: Season[]; occasions: Occasion[]; tags: string[]; price: number; imageUrl?: string;
  /** Every photo of the product (the first one is imageUrl). */
  images: string[]; slug: string; sizeMl?: number; concentration?: string; longevity?: string;
  inStock: boolean; rating?: number; reviewCount?: number; isFeatured: boolean; isNew: boolean; createdAt?: string;
  enrichedBy: 'shaheen' | 'rules';
}

export const skuOf = (p: RawProduct) => String(p.sku || p.id);

export const slugify = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
  .replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'perfume';
/** Every product's own shareable page: p/<slug>.html (generated at build time by scripts/product-pages.mts). */
export function productSlug(p: RawProduct): string {
  if (typeof p.slug === 'string' && /^[a-z0-9-]+$/.test(p.slug)) return p.slug;
  const name = slugify(p.nameEn || '');
  // Names without real words («1», Arabic only) use the brand and SKU instead.
  return `${/[a-z]{3,}/.test(name) ? name : slugify(`${p.brand && p.brand !== 'Unknown' ? p.brand : ''} ${skuOf(p)}`)}-${String(p.id)}`;
}

/** Characters that only appear when an import script garbled a name (CJK, Hangul, Cyrillic, Hebrew, emoji…). */
const FOREIGN = /[\u0400-\u04FF\u0590-\u05FF\u3040-\u30FF\u3400-\u9FFF\uAC00-\uD7AF\u1100-\u11FF\uFF00-\uFFEF]|\p{Extended_Pictographic}/u;
export const isGarbled = (text = '') => FOREIGN.test(text) || /[\u0600-\u06FF][A-Za-z\u00C0-\u024F]|[A-Za-z\u00C0-\u024F][\u0600-\u06FF]|[؟?]\S/.test(text);

/** Removes garbage characters and import artefacts («عطر عطر», stray slashes, double spaces). */
export function cleanText(text: unknown, max = 600): string {
  if (typeof text !== 'string') return '';
  return text
    .replace(new RegExp(FOREIGN.source, 'gu'), ' ')
    .replace(/[\u200B-\u200F\uFEFF]/g, '')
    .replace(/(^|\s)(\S+)(\s+\2)+(?=\s|$)/gu, '$1$2')
    .replace(/\s*\/\s*/g, ' ')
    .replace(/\s+([،,.!؟?])/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .slice(0, max);
}

const GENERIC = /جودة عالية و\s*(?:سعر|اسعار|أسعار) مميز|high quality at special price/i;
export const isGenericDescription = (text = '') => !text.trim() || GENERIC.test(text) || text.trim().length < 25;

/** Small stable hash (djb2) of the merchant's own text for a product. */
export function productHash(p: RawProduct): string {
  const s = [p.nameAr, p.nameEn, p.descriptionAr, p.descriptionEn, p.brand, p.category].map((v) => v || '').join('|');
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

const FAMILY_WORDS: [Family, RegExp][] = [
  ['oud', /عود|أود|اود|دهن|هندي|كمبودي|oud|oudh|agar/i],
  ['floral', /ورد|زهر|ياسمين|فل|rose|flower|floral|jasmin|bloom/i],
  ['gourmand', /عسل|فانيل|حلو|كراميل|honey|vanilla|sweet|caramel|gourmand/i],
  ['musk', /مسك|musk|misk/i],
  ['amber', /عنبر|amber|ambre/i],
  ['fresh', /منعش|خفيف|fresh|light|cool/i],
  ['citrus', /حمض|ليمون|برتقال|citrus|lemon|bergamot/i],
  ['aquatic', /بحر|ماء|مائي|ocean|aqua|sea|marine/i],
  ['woody', /خشب|صندل|wood|sandal|cedar/i],
  ['spicy', /حار|توابل|زعفران|بهار|spic|saffron/i],
  ['oriental', /شرقي|oriental/i],
  ['leather', /جلد|leather/i],
  ['fruity', /فواكه|فاكهة|رمان|تفاح|fruit|apple|pomegranate/i],
  ['powdery', /بودر|powder|iris|orris/i],
];
const SEASON_WORDS: [Season, RegExp][] = [['summer', /summer|صيف/i], ['winter', /winter|شتا/i], ['spring', /spring|ربيع/i], ['autumn', /fall|autumn|خريف/i], ['all', /all seasons|year.?round|كل المواسم/i]];
const OCCASION_WORDS: [Occasion, RegExp][] = [
  ['daily', /daily|casual|يومي/i], ['work', /office|work|عمل/i], ['evening', /evening|night|dinner|سهر/i],
  ['special', /special|event|party|wedding|مناسب/i], ['gift', /gift|هدي/i],
];
const pick = <T,>(words: [T, RegExp][], text: string, max: number) => words.filter(([, re]) => re.test(text)).map(([v]) => v).slice(0, max);
/** Notes the supplier publishes on the product page (real, not guessed). */
const sourceNotes = (p: RawProduct): StoreEntry['notes'] => {
  const clean = (l?: string[]) => (Array.isArray(l) ? l : []).map((n) => cleanText(n, 40)).filter(Boolean).slice(0, 8);
  return { top: clean(p.notes?.top), heart: clean(p.notes?.heart), base: clean(p.notes?.base) };
};
const hasNotes = (n: StoreEntry['notes']) => Boolean(n.top.length || n.heart.length || n.base.length);
/** Photos the store can show: https URLs, or files mirrored into the site (store/…). */
export const productImages = (p: RawProduct): string[] => [...new Set([p.imageUrl, ...(Array.isArray(p.images) ? p.images : [])]
  .filter((u): u is string => typeof u === 'string' && (/^https:\/\//.test(u) || /^store\/[\w./-]+$/.test(u))))].slice(0, 8);
const genderOf = (p: RawProduct): Gender | undefined => {
  const t = `${p.category || ''} ${p.nameAr || ''} ${p.nameEn || ''} ${p.descriptionAr || ''}`;
  if (/مختلط|للجنسين|unisex/i.test(t)) return 'unisex';
  if (/نسائي|نسائى|women|femme|her\b|libre/i.test(t)) return 'women';
  if (/رجالي|رجالى|\bmen\b|homme|him\b/i.test(t)) return 'men';
  return undefined;
};

/** Without any AI engine: honest, rule-based clean-up (no invented notes). */
export function ruleEntry(p: RawProduct, now = new Date().toISOString()): StoreEntry {
  const text = `${p.nameAr || ''} ${p.nameEn || ''} ${p.descriptionAr || ''} ${p.descriptionEn || ''} ${p.category || ''}`;
  // The supplier's own family words come first; the name/description words fill the rest.
  const declared = (p.families || []).join(' ');
  const families = [...new Set([...pick(FAMILY_WORDS, declared, 3), ...pick(FAMILY_WORDS, text, 3)])].slice(0, 3);
  const nameEn = cleanText(p.nameEn, 120) || cleanText(p.nameAr, 120);
  // A garbled Arabic name is worse than the clean English one.
  const nameAr = !p.nameAr || isGarbled(p.nameAr) ? nameEn : cleanText(p.nameAr, 120);
  const brand = p.brand && p.brand !== 'Unknown' ? p.brand : '';
  const gender = genderOf(p);
  const descAr = isGenericDescription(p.descriptionAr) || isGarbled(p.descriptionAr)
    ? [`${nameAr.startsWith('عطر') ? '' : 'عطر '}${nameAr}`, brand && `من ${brand}`, gender && GENDER_LABEL[gender].ar, families.length ? `بطابع ${families.map((f) => FAMILY_LABEL[f].ar).join(' و')}` : ''].filter(Boolean).join(' ') + '.'
    : cleanText(p.descriptionAr);
  const descEn = isGenericDescription(p.descriptionEn) || isGarbled(p.descriptionEn)
    ? [`${nameEn}`, brand && `by ${brand}`, gender && `for ${GENDER_LABEL[gender].en.toLowerCase()}`, families.length ? `with ${/^[aeiou]/i.test(families[0]) ? 'an' : 'a'} ${families.map((f) => FAMILY_LABEL[f].en.toLowerCase()).join(' and ')} character` : ''].filter(Boolean).join(' ') + '.'
    : cleanText(p.descriptionEn, 900);
  return {
    sourceHash: productHash(p), editor: 'rules', updatedAt: now, nameAr, nameEn, descriptionAr: descAr, descriptionEn: descEn,
    gender, families, notes: sourceNotes(p),
    seasons: pick(SEASON_WORDS, (p.seasonsSource || []).join(' '), 4), occasions: pick(OCCASION_WORDS, (p.occasionsSource || []).join(' '), 4), tags: [],
  };
}

export function mergeProduct(p: RawProduct, entry?: StoreEntry): StoreProduct {
  // An entry written for older merchant text is not trusted: rules until Shaheen rewrites it (next run).
  const fresh = entry && entry.sourceHash === productHash(p) ? entry : undefined;
  const e = fresh || ruleEntry(p);
  const images = productImages(p);
  return {
    id: p.id, sku: skuOf(p), name: { ar: e.nameAr, en: e.nameEn }, description: { ar: e.descriptionAr, en: e.descriptionEn },
    brand: p.brand && p.brand !== 'Unknown' ? p.brand : '', category: cleanText(p.category, 40), gender: e.gender, families: e.families,
    // Notes published by the supplier win over an empty list (Shaheen never invents notes).
    notes: hasNotes(e.notes) ? e.notes : sourceNotes(p), seasons: e.seasons, occasions: e.occasions, tags: e.tags,
    price: Number(p.ourPrice) || 0, imageUrl: images[0], images,
    slug: productSlug(p), sizeMl: Number(p.sizeMl) > 0 ? Number(p.sizeMl) : undefined, concentration: cleanText(p.concentration, 40) || undefined,
    longevity: cleanText(p.longevity, 40) || undefined,
    inStock: p.stockStatus !== 'out_of_stock', rating: p.rating, reviewCount: p.reviewCount,
    isFeatured: Boolean(p.isFeatured), isNew: Boolean(p.isNew), createdAt: p.createdAt, enrichedBy: e.editor,
  };
}

export function mergeCatalog(products: RawProduct[], file?: Pick<StoreCatalogFile, 'entries'>): StoreProduct[] {
  return products.filter((p) => p && (p.nameAr || p.nameEn) && p.published !== false).map((p) => mergeProduct(p, file?.entries?.[skuOf(p)]));
}

export function isCatalogFile(data: unknown): data is StoreCatalogFile {
  const d = data as StoreCatalogFile;
  return Boolean(d && typeof d === 'object' && typeof d.updatedAt === 'string' && d.entries && typeof d.entries === 'object' && !Array.isArray(d.entries));
}

/** Everything a visitor might type to find this product (used by search and the advisor). */
export function searchText(p: StoreProduct): string {
  return [p.name.ar, p.name.en, p.brand, p.category, p.description.ar, p.description.en, ...p.tags,
    ...p.families.flatMap((f) => [FAMILY_LABEL[f].ar, FAMILY_LABEL[f].en]), ...p.notes.top, ...p.notes.heart, ...p.notes.base,
    ...p.seasons.map((s) => SEASON_LABEL[s].ar), ...p.occasions.map((o) => OCCASION_LABEL[o].ar), p.gender ? GENDER_LABEL[p.gender].ar : '']
    .join(' ').toLowerCase();
}

export const LIVE_STORE_URL = 'https://raw.githubusercontent.com/spculculat-oss/Sham-Perfume/main/src/data/live/store-catalog.json';
