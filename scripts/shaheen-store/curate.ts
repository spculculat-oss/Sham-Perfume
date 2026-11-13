/**
 * «شاهين يدرّب المتجر» — pure logic (tested in tests/shaheenStore.test.ts):
 * audit every product the merchants imported, ask Shaheen to rewrite the weak ones (clean names, real
 * descriptions, scent family, publicly known notes only, season, occasion, search words) and build
 * src/data/live/store-catalog.json. Without an AI key the rule-based clean-up still fixes garbled text.
 */
import {
  cleanText, FAMILIES, GENDERS, honestEntry, isGarbled, isGenericDescription, OCCASIONS, productHash, ruleEntry, SEASONS, skuOf,
  thinSource, withDocumentedNotes,
  type Family, type Gender, type Occasion, type RawProduct, type Season, type StoreCatalogFile, type StoreEntry,
} from '../../src/utils/storeCatalog';
import { stripClaims } from '../../src/utils/honestClaims';

export const STORE_INTERVAL_HOURS = 12;
export const BATCH = 14;
/** 2 = neutral wording, no scent prose without documented notes (the 2026-10-21 council task). */
export const STORE_STYLE = 2;
const VENDOR = /\b(?:gemini|openai|chat ?gpt|claude|anthropic|deepseek|openrouter|perplexity)\b/i;

/** What is wrong with a product as the merchants imported it (Arabic, for the admin report). */
export function auditProduct(p: RawProduct): string[] {
  const issues: string[] = [];
  if (isGarbled(p.nameAr)) issues.push('الاسم العربي فيه حروف غريبة من لغات أخرى');
  if (isGarbled(p.descriptionAr) || isGarbled(p.descriptionEn)) issues.push('الوصف فيه حروف غريبة من لغات أخرى');
  // Imported products arrive with the supplier's English description; Shaheen writes the Arabic one. A product whose
  // supplier published neither notes nor a description (thin source) can only be described by its published facts —
  // asking for scent prose there is asking for invented notes (the council's style-2 rule), so it is not a fault.
  if (!thinSource(p) && isGenericDescription(p.descriptionAr) && !(p.url && (p.descriptionEn || '').length > 60)) issues.push('الوصف عام ولا يصف الرائحة');
  if (/(^|\s)(\S+)\s+\2(\s|$)/u.test(p.descriptionAr || '')) issues.push('كلمة مكررة في الوصف');
  if (!p.brand || p.brand === 'Unknown') issues.push('العلامة التجارية غير معروفة');
  if (!(Number(p.ourPrice) > 0)) issues.push('بدون سعر بيع');
  else if (Number(p.supplierPrice) > 0 && Number(p.ourPrice) <= Number(p.supplierPrice)) issues.push('سعر البيع لا يزيد عن سعر التوريد');
  // A photo cleaned by «منقّح الصور» lives in the site itself (store-images/…), not on another server.
  if (!p.imageUrl || !/^(?:https:\/\/|store-images\/)/.test(p.imageUrl)) issues.push('بدون صورة');
  if (p.rating && !p.reviewCount) issues.push('تقييم بدون مراجعات');
  return issues;
}

/** Products Shaheen should (re)write this run: new or changed ones first, then the rule-based ones. */
export function staleProducts(products: RawProduct[], previous: StoreCatalogFile | undefined, limit = BATCH * 4): RawProduct[] {
  const old = previous?.entries || {};
  const rank = (p: RawProduct) => {
    const e = old[skuOf(p)];
    if (!e || e.sourceHash !== productHash(p)) return 0;
    if (e.editor === 'rules') return 1;
    // Written under older, more promotional rules: rewritten in turn after the rule-based ones.
    return (e.style || 1) < STORE_STYLE ? 1.5 : 2;
  };
  return products.filter((p) => rank(p) < 2).sort((a, b) => rank(a) - rank(b)).slice(0, limit);
}

export const STORE_SYSTEM = `أنت «الخبير شاهين»، خبير العطور في منصة «صمم عطرك مع شام»، وتدرّب «متجر شام» ليعرض منتجاته بشكل احترافي ويساعد الزوار في الاختيار.
لكل منتج ستكتب: اسماً عربياً صحيحاً ونظيفاً (بدون حروف من لغات أخرى)، واسماً إنجليزياً، ووصفاً عربياً محايداً ودقيقاً من جملتين يصف الرائحة كما هي، ووصفاً إنجليزياً قصيراً بنفس الحياد، والجنس، والعائلة العطرية، والمواسم، والمناسبات، وكلمات بحث.
قواعد صارمة:
- إذا وصلتك supplierNotes من صفحة المنتج الأصلية فهي موثقة: انقلها كما هي إلى notes (بالإنجليزية). وإذا كانت فارغة والوصف الإنجليزي يذكر النوتات صراحة في كلامه (افتتاحية/قلب/قاعدة) فاستخرجها منه بنفس كلماته الإنجليزية. وإذا وصل وصف إنجليزي طويل فلخّصه بالعربية بأمانة دون إضافة معلومات.
- النوتات (top/heart/base) فقط إذا كان العطر تجارياً مشهوراً ونوتاته منشورة ومعروفة (مثل Dior Sauvage أو Baccarat Rouge 540 أو Lattafa Ameer Al Oudh). إن لم تكن متأكداً اترك القوائم فارغة. لا تخترع نوتات أبداً.
- لا تدّعِ ثباتاً بالساعات ولا أنه أصلي أو مقلد، ولا تذكر أسعاراً أو خصومات أو شحناً.
- لغة محايدة: لا صفات مبالغة أو تسويقية مثل «فاخر» و«ساحر» و«آسر» و«راقٍ» و«لا يُنسى» و«يمنحك إحساساً بـ» ولا luxurious أو alluring أو captivating أو seductive.
- إذا لم تصلك supplierNotes ولا وصف إنجليزي يذكر الرائحة فلا تصف الرائحة أبداً: اكتب ما هو معروف فقط (العلامة والحجم والتركيز والجنس).
- لا عبارات ترويجية غير مسندة: لا «يدوم طويلاً/طوال اليوم» ولا «ثبات عالٍ» ولا «الأفضل» ولا «لا يقاوم» ولا «مثالي». صف الرائحة نفسها بصدق.
- إذا كان الاسم العربي مشوهاً فاكتب الاسم الصحيح بالعربية اعتماداً على الاسم الإنجليزي والعلامة (مثل «لطافة أمير العود»).
- استنتج العائلة والجنس من الاسم والفئة والوصف بحذر؛ عطور «عود» و«هندي» و«دهن» عائلتها oud.
- لا تذكر أسماء شركات أو نماذج ذكاء اصطناعي، ولا روابط.
أعد JSON فقط.`;

export function storePrompt(products: RawProduct[]) {
  const lines = products.map((p) => JSON.stringify({
    sku: skuOf(p), nameAr: p.nameAr, nameEn: p.nameEn, brand: p.brand, category: p.category, descriptionAr: (p.descriptionAr || '').slice(0, 200),
    // Imported products carry the supplier's full description and its documented notes and family.
    descriptionEn: (p.descriptionEn || '').slice(0, p.url ? 700 : 160),
    ...(p.url ? { supplierNotes: p.notes, supplierFamily: p.families, size: p.sizeMl ? `${p.sizeMl}ml` : undefined, concentration: p.concentration } : {}),
  }));
  return `المنتجات (سطر لكل منتج):
${lines.join('\n')}

أعد بالشكل:
{"products":[{"sku":"...","nameAr":"...","nameEn":"...","descriptionAr":"...","descriptionEn":"...","gender":"${GENDERS.join('|')}","families":["${FAMILIES.join('|')}"],"notes":{"top":["English note"],"heart":[],"base":[]},"seasons":["${SEASONS.join('|')}"],"occasions":["${OCCASIONS.join('|')}"],"tags":["كلمة بحث","search word"]}]}
families من 1 إلى 3، وseasons وoccasions من 1 إلى 3، وtags من 3 إلى 8. اكتب منتجاً لكل sku بالضبط.`;
}

/**
 * Reads the JSON object in an AI reply. Common slips (seen in real runs: a trailing comma before «}»,
 * «Expected double-quoted property name») are repaired; anything else still throws, so the batch is retried.
 */
export function parseJson(text: string): unknown {
  const body = text.replace(/```(?:json)?/gi, '').trim();
  const start = body.indexOf('{'); const end = body.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('No JSON object in the reply');
  const raw = body.slice(start, end + 1);
  try {
    return JSON.parse(raw);
  } catch (error) {
    const repaired = raw
      .replace(/[\u201C\u201D]/g, '"')
      .replace(/^\s*\/\/.*$/gm, '')
      .replace(/,(\s*[}\]])/g, '$1');
    try { return JSON.parse(repaired); } catch { throw error; }
  }
}

const pickEnum = <T extends string>(values: readonly T[], input: unknown, max: number): T[] =>
  [...new Set((Array.isArray(input) ? input : []).map((v) => String(v).trim().toLowerCase()).filter((v): v is T => (values as readonly string[]).includes(v)))].slice(0, max);
const words = (input: unknown, max: number, len = 40) =>
  [...new Set((Array.isArray(input) ? input : []).filter((v): v is string => typeof v === 'string').map((v) => cleanText(v, len)).filter((v) => v.length >= 2 && !VENDOR.test(v)))].slice(0, max);

/**
 * Notes: the supplier's published pyramid wins. For an imported product without one, Shaheen may pick the
 * notes its description names in prose — each must literally appear in that description (never invented).
 */
export function notesFor(p: RawProduct, supplier: StoreEntry['notes'], fromShaheen: StoreEntry['notes']): StoreEntry['notes'] {
  if (supplier.top.length || supplier.heart.length || supplier.base.length) return supplier;
  if (!p.url) return fromShaheen;
  const text = (p.descriptionEn || '').toLowerCase();
  const inText = (list: string[]) => list.filter((n) => n.length >= 3 && text.includes(n.toLowerCase()));
  return { top: inText(fromShaheen.top), heart: inText(fromShaheen.heart), base: inText(fromShaheen.base) };
}

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
    // «مراجع الصفحات»: a claim that slipped through (hours, «the best», «irresistible») is removed before it is saved.
    const descriptionAr = stripClaims(cleanText(r.descriptionAr, 400), 'ar');
    const descriptionEn = stripClaims(cleanText(r.descriptionEn, 300), 'en');
    const okAr = (s: string) => s.length >= 2 && /[\u0600-\u06FF]/.test(s) && !isGarbled(s) && !VENDOR.test(s);
    const notes = (r.notes && typeof r.notes === 'object' ? r.notes : {}) as Record<string, unknown>;
    const gender = (GENDERS as readonly string[]).includes(String(r.gender)) ? r.gender as Gender : base.gender;
    out[skuOf(p)] = honestEntry(p, {
      ...base,
      editor: 'shaheen', style: STORE_STYLE,
      nameAr: okAr(nameAr) ? nameAr : base.nameAr,
      nameEn: nameEn && !isGarbled(nameEn) && !VENDOR.test(nameEn) ? nameEn : base.nameEn,
      descriptionAr: okAr(descriptionAr) && descriptionAr.length >= 25 ? descriptionAr : base.descriptionAr,
      descriptionEn: descriptionEn.length >= 20 && !isGarbled(descriptionEn) && !VENDOR.test(descriptionEn) ? descriptionEn : base.descriptionEn,
      gender,
      families: pickEnum<Family>(FAMILIES, r.families, 3).length ? pickEnum<Family>(FAMILIES, r.families, 3) : base.families,
      notes: notesFor(p, base.notes, { top: words(notes.top, 6), heart: words(notes.heart, 6), base: words(notes.base, 6) }),
      seasons: pickEnum<Season>(SEASONS, r.seasons, 3).length ? pickEnum<Season>(SEASONS, r.seasons, 3) : base.seasons,
      occasions: pickEnum<Occasion>(OCCASIONS, r.occasions, 3).length ? pickEnum<Occasion>(OCCASIONS, r.occasions, 3) : base.occasions,
      tags: words(r.tags, 8, 30),
    });
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
    // A kept entry written before the thin-source rule loses the scent prose it could not support.
    entries[sku] = fresh[sku] || (old && old.editor === 'shaheen' && old.sourceHash === productHash(p)
      ? withDocumentedNotes(p, honestEntry(p, old))
      : ruleEntry(p, at));
  }
  const issues = products.map((p) => ({ sku: skuOf(p), issues: auditProduct(p) })).filter((i) => i.issues.length);
  const shaheen = Object.values(entries).filter((e) => e.editor === 'shaheen').length;
  return {
    version: 1, updatedAt: at, nextUpdateAt: new Date(now.getTime() + STORE_INTERVAL_HOURS * 3600_000).toISOString(),
    editor: shaheen > products.length / 2 ? 'shaheen' : 'rules', entries, audit: { checked: products.length, issues },
  };
}
