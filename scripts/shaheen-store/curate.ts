/**
 * «شاهين يدرّب المتجر» — pure logic (tested in tests/shaheenStore.test.ts):
 * audit every product the merchants imported, ask Shaheen to rewrite the weak ones (clean names, real
 * descriptions, scent family, publicly known notes only, season, occasion, search words) and build
 * src/data/live/store-catalog.json. Without an AI key the rule-based clean-up still fixes garbled text.
 */
import {
  cleanText, FAMILIES, GENDERS, isGarbled, isGenericDescription, OCCASIONS, productHash, ruleEntry, SEASONS, skuOf,
  type Family, type Gender, type Occasion, type RawProduct, type Season, type StoreCatalogFile, type StoreEntry,
} from '../../src/utils/storeCatalog';

export const STORE_INTERVAL_HOURS = 12;
export const BATCH = 14;
const VENDOR = /\b(?:gemini|openai|chat ?gpt|claude|anthropic|deepseek|openrouter)\b/i;

/** What is wrong with a product as the merchants imported it (Arabic, for the admin report). */
export function auditProduct(p: RawProduct): string[] {
  const issues: string[] = [];
  if (isGarbled(p.nameAr)) issues.push('الاسم العربي فيه حروف غريبة من لغات أخرى');
  if (isGarbled(p.descriptionAr) || isGarbled(p.descriptionEn)) issues.push('الوصف فيه حروف غريبة من لغات أخرى');
  if (isGenericDescription(p.descriptionAr)) issues.push('الوصف عام ولا يصف الرائحة');
  if (/(^|\s)(\S+)\s+\2(\s|$)/u.test(p.descriptionAr || '')) issues.push('كلمة مكررة في الوصف');
  if (!p.brand || p.brand === 'Unknown') issues.push('العلامة التجارية غير معروفة');
  if (!(Number(p.ourPrice) > 0)) issues.push('بدون سعر بيع');
  else if (Number(p.supplierPrice) > 0 && Number(p.ourPrice) <= Number(p.supplierPrice)) issues.push('سعر البيع لا يزيد عن سعر التوريد');
  if (!p.imageUrl || !/^https:\/\//.test(p.imageUrl)) issues.push('بدون صورة');
  if (p.rating && !p.reviewCount) issues.push('تقييم بدون مراجعات');
  return issues;
}

/** Products Shaheen should (re)write this run: new or changed ones first, then the rule-based ones. */
export function staleProducts(products: RawProduct[], previous: StoreCatalogFile | undefined, limit = BATCH * 4): RawProduct[] {
  const old = previous?.entries || {};
  const rank = (p: RawProduct) => {
    const e = old[skuOf(p)];
    if (!e || e.sourceHash !== productHash(p)) return 0;
    return e.editor === 'rules' ? 1 : 2;
  };
  return products.filter((p) => rank(p) < 2).sort((a, b) => rank(a) - rank(b)).slice(0, limit);
}

export const STORE_SYSTEM = `أنت «الخبير شاهين»، خبير العطور في منصة «صمم عطرك مع شام»، وتدرّب «متجر شام» ليعرض منتجاته بشكل احترافي ويساعد الزوار في الاختيار.
لكل منتج ستكتب: اسماً عربياً صحيحاً ونظيفاً (بدون حروف من لغات أخرى)، واسماً إنجليزياً، ووصفاً عربياً جذاباً وصادقاً من جملتين، ووصفاً إنجليزياً قصيراً، والجنس، والعائلة العطرية، والمواسم، والمناسبات، وكلمات بحث.
قواعد صارمة:
- النوتات (top/heart/base) فقط إذا كان العطر تجارياً مشهوراً ونوتاته منشورة ومعروفة (مثل Dior Sauvage أو Baccarat Rouge 540 أو Lattafa Ameer Al Oudh). إن لم تكن متأكداً اترك القوائم فارغة. لا تخترع نوتات أبداً.
- لا تدّعِ ثباتاً بالساعات ولا أنه أصلي أو مقلد، ولا تذكر أسعاراً أو خصومات أو شحناً.
- إذا كان الاسم العربي مشوهاً فاكتب الاسم الصحيح بالعربية اعتماداً على الاسم الإنجليزي والعلامة (مثل «لطافة أمير العود»).
- استنتج العائلة والجنس من الاسم والفئة والوصف بحذر؛ عطور «عود» و«هندي» و«دهن» عائلتها oud.
- لا تذكر أسماء شركات أو نماذج ذكاء اصطناعي، ولا روابط.
أعد JSON فقط.`;

export function storePrompt(products: RawProduct[]) {
  const lines = products.map((p) => JSON.stringify({
    sku: skuOf(p), nameAr: p.nameAr, nameEn: p.nameEn, brand: p.brand, category: p.category, descriptionAr: (p.descriptionAr || '').slice(0, 200), descriptionEn: (p.descriptionEn || '').slice(0, 160),
  }));
  return `المنتجات (سطر لكل منتج):
${lines.join('\n')}

أعد بالشكل:
{"products":[{"sku":"...","nameAr":"...","nameEn":"...","descriptionAr":"...","descriptionEn":"...","gender":"${GENDERS.join('|')}","families":["${FAMILIES.join('|')}"],"notes":{"top":["English note"],"heart":[],"base":[]},"seasons":["${SEASONS.join('|')}"],"occasions":["${OCCASIONS.join('|')}"],"tags":["كلمة بحث","search word"]}]}
families من 1 إلى 3، وseasons وoccasions من 1 إلى 3، وtags من 3 إلى 8. اكتب منتجاً لكل sku بالضبط.`;
}

export function parseJson(text: string): unknown {
  const body = text.replace(/```(?:json)?/gi, '').trim();
  const start = body.indexOf('{'); const end = body.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('No JSON object in the reply');
  return JSON.parse(body.slice(start, end + 1));
}

const pickEnum = <T extends string>(values: readonly T[], input: unknown, max: number): T[] =>
  [...new Set((Array.isArray(input) ? input : []).map((v) => String(v).trim().toLowerCase()).filter((v): v is T => (values as readonly string[]).includes(v)))].slice(0, max);
const words = (input: unknown, max: number, len = 40) =>
  [...new Set((Array.isArray(input) ? input : []).filter((v): v is string => typeof v === 'string').map((v) => cleanText(v, len)).filter((v) => v.length >= 2 && !VENDOR.test(v)))].slice(0, max);

/** Shaheen's reply → validated entries for the products that were asked (anything else is ignored). */
export function entriesFromShaheen(reply: unknown, asked: RawProduct[], now: string): Record<string, StoreEntry> {
  const list = (reply as { products?: unknown })?.products;
  const bySku = new Map(asked.map((p) => [skuOf(p), p]));
  const out: Record<string, StoreEntry> = {};
  for (const raw of Array.isArray(list) ? list : []) {
    if (!raw || typeof raw !== 'object') continue;
    const r = raw as Record<string, unknown>;
    const p = bySku.get(String(r.sku));
    if (!p) continue;
    const base = ruleEntry(p, now);
    const nameAr = cleanText(r.nameAr, 120);
    const nameEn = cleanText(r.nameEn, 120);
    const descriptionAr = cleanText(r.descriptionAr, 400);
    const descriptionEn = cleanText(r.descriptionEn, 300);
    const okAr = (s: string) => s.length >= 2 && /[\u0600-\u06FF]/.test(s) && !isGarbled(s) && !VENDOR.test(s);
    const notes = (r.notes && typeof r.notes === 'object' ? r.notes : {}) as Record<string, unknown>;
    const gender = (GENDERS as readonly string[]).includes(String(r.gender)) ? r.gender as Gender : base.gender;
    out[skuOf(p)] = {
      ...base,
      editor: 'shaheen',
      nameAr: okAr(nameAr) ? nameAr : base.nameAr,
      nameEn: nameEn && !isGarbled(nameEn) && !VENDOR.test(nameEn) ? nameEn : base.nameEn,
      descriptionAr: okAr(descriptionAr) && descriptionAr.length >= 25 ? descriptionAr : base.descriptionAr,
      descriptionEn: descriptionEn.length >= 20 && !isGarbled(descriptionEn) && !VENDOR.test(descriptionEn) ? descriptionEn : base.descriptionEn,
      gender,
      families: pickEnum<Family>(FAMILIES, r.families, 3).length ? pickEnum<Family>(FAMILIES, r.families, 3) : base.families,
      notes: { top: words(notes.top, 6), heart: words(notes.heart, 6), base: words(notes.base, 6) },
      seasons: pickEnum<Season>(SEASONS, r.seasons, 3),
      occasions: pickEnum<Occasion>(OCCASIONS, r.occasions, 3),
      tags: words(r.tags, 8, 30),
    };
  }
  return out;
}

/**
 * The new catalog: Shaheen's fresh entries, then previous entries that still match the merchant's text,
 * then the rule-based clean-up for everything else. Products that left the store are dropped.
 */
export function buildCatalogFile(products: RawProduct[], previous: StoreCatalogFile | undefined, fresh: Record<string, StoreEntry>, now = new Date()): StoreCatalogFile {
  const at = now.toISOString();
  const entries: Record<string, StoreEntry> = {};
  for (const p of products) {
    const sku = skuOf(p);
    const old = previous?.entries?.[sku];
    // Shaheen's work is kept while the merchant's text is unchanged; the rules are recomputed every run.
    entries[sku] = fresh[sku] || (old && old.editor === 'shaheen' && old.sourceHash === productHash(p) ? old : ruleEntry(p, at));
  }
  const issues = products.map((p) => ({ sku: skuOf(p), issues: auditProduct(p) })).filter((i) => i.issues.length);
  const shaheen = Object.values(entries).filter((e) => e.editor === 'shaheen').length;
  return {
    version: 1, updatedAt: at, nextUpdateAt: new Date(now.getTime() + STORE_INTERVAL_HOURS * 3600_000).toISOString(),
    editor: shaheen > products.length / 2 ? 'shaheen' : 'rules', entries, audit: { checked: products.length, issues },
  };
}
