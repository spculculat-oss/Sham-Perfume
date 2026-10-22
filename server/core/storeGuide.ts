/**
 * «دليل متجر شام» — كل ما يعرفه «مساعد شام» عن المتجر، من نفس الملفات التي تبني به الصفحة نفسها:
 *
 *  - الكتالوج الحقيقي: `src/data/products.json` + إثراء شاهين `src/data/live/store-catalog.json`
 *    (نفس `mergeCatalog` الذي يستخدمه `server/store.ts` و«اسأل شاهين»)، فلا يعرض المساعد منتجاً
 *    أو سعراً غير موجود في المتجر.
 *  - حقائق الشراء: الدفع، الشحن، التوصيل، الإرجاع، تتبع الطلب، سوق التجار، التقييمات — مكتوبة مرة
 *    واحدة هنا وتُزرع كمستندات معرفة، فيستشهد بها المساعد حتى بلا أي مفتاح ذكاء اصطناعي.
 *  - لقطة حيّة (عدد المنتجات، الماركات، العائلات، نطاق السعر) تُضاف لتعليمات النموذج عند كل سؤال،
 *    فلا تتقادم الأرقام أبداً.
 *
 * قاعدة صارمة: هامش المنصة وسعر المورّد لا يظهران للزائر، ولا يُخترع منتج أو خصم أو مدة توصيل.
 */
import productsData from '../../src/data/products.json';
import {
  FAMILY_LABEL, GENDER_LABEL, OCCASION_LABEL, SEASON_LABEL, mergeCatalog, searchText,
  type Family, type RawProduct, type StoreProduct,
} from '../../src/utils/storeCatalog';
import { parseWish } from '../../src/utils/storeAdvisor';
import { liveStoreCatalog } from './liveData';
import { normalize, tokenize } from './text';
import { shippingBrief } from './platformGuide';
import type { KnowledgeDoc } from './types';

type Env = Record<string, string | undefined>;

export const STORE_TAB = 'store';

export interface StoreItem {
  /** The merchant's product id (the product page route is `#product=<id>`). */
  id: string;
  sku: string;
  nameAr: string;
  nameEn: string;
  brand: string;
  price: number;
  /** The catalog's own currency: the storefront converts it to the visitor's currency at checkout. */
  currency: 'EGP';
  sizeMl?: number;
  concentration?: string;
  families: Family[];
  gender?: keyof typeof GENDER_LABEL;
  seasons: (keyof typeof SEASON_LABEL)[];
  occasions: (keyof typeof OCCASION_LABEL)[];
  inStock: boolean;
  slug: string;
  /** Normalised text used for matching (built once per catalog version). */
  haystack: string;
}

export interface StoreSnapshot {
  total: number;
  inStock: number;
  newCount: number;
  featuredCount: number;
  withNotes: number;
  minPrice: number;
  maxPrice: number;
  brands: { name: string; count: number }[];
  families: { id: Family; count: number }[];
  categories: { name: string; count: number }[];
  updatedAt: string;
  /** True when the catalog itself is empty (nothing published yet) — never a reason to invent items. */
  empty: boolean;
}

/** The bundled merchant catalog; the storefront merges it with Shaheen's live enrichment. */
export const bundledProducts = ((productsData as { products?: RawProduct[] }).products || []) as RawProduct[];

const clean = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');

/** Storefront product → the light record the assistant works with (no supplier prices, ever). */
export function toItem(p: StoreProduct): StoreItem {
  return {
    id: String(p.id),
    sku: p.sku,
    nameAr: p.name.ar || p.name.en, nameEn: p.name.en || p.name.ar,
    brand: clean(p.brand, 60), price: Number(p.price) || 0, currency: 'EGP',
    sizeMl: p.sizeMl, concentration: p.concentration,
    families: p.families, gender: p.gender, seasons: p.seasons, occasions: p.occasions,
    inStock: p.inStock, slug: p.slug,
    haystack: normalize(`${p.name.ar} ${p.name.en} ${p.brand} ${p.category} ${searchText(p)}`),
  };
}

/** The whole shop as the assistant sees it: merchant data + Shaheen's enrichment, cached per version. */
let catalogCache: { key: string; items: StoreItem[]; snapshot: StoreSnapshot } | undefined;

export async function storefrontCatalog(env: Env = process.env, request: typeof fetch = fetch): Promise<{ items: StoreItem[]; snapshot: StoreSnapshot }> {
  const file = await liveStoreCatalog(env, request).catch(() => undefined);
  const key = `${file?.updatedAt || 'bundled'}:${bundledProducts.length}`;
  if (catalogCache?.key === key) return catalogCache;
  const products = mergeCatalog(bundledProducts, file);
  const items = products.map(toItem);
  catalogCache = { key, items, snapshot: buildSnapshot(items, file?.updatedAt || '') };
  return catalogCache;
}

function buildSnapshot(items: StoreItem[], updatedAt: string): StoreSnapshot {
  const prices = items.map((i) => i.price).filter((n) => n > 0);
  const tally = <T extends string>(values: T[]) => {
    const map = new Map<T, number>();
    for (const value of values) map.set(value, (map.get(value) || 0) + 1);
    return [...map.entries()].sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])));
  };
  const raw = bundledProducts.filter((p) => p.published !== false);
  return {
    total: items.length,
    inStock: items.filter((i) => i.inStock).length,
    newCount: items.filter((i) => (i as { isNew?: boolean }).isNew).length,
    featuredCount: raw.filter((p) => p.isFeatured).length,
    withNotes: items.filter((i) => i.families.length > 0).length,
    minPrice: prices.length ? Math.min(...prices) : 0,
    maxPrice: prices.length ? Math.max(...prices) : 0,
    brands: tally(items.map((i) => i.brand).filter(Boolean)).slice(0, 8).map(([name, count]) => ({ name, count })),
    families: tally(items.flatMap((i) => i.families)).slice(0, 8).map(([id, count]) => ({ id, count })),
    categories: tally(items.map((i) => i.nameAr && (i as { category?: string }).category).filter((c): c is string => Boolean(c))).slice(0, 6).map(([name, count]) => ({ name, count })),
    updatedAt,
    empty: items.length === 0,
  };
}

const GENERIC = new Set([
  'عطر', 'عطور', 'برفان', 'منتج', 'منتجات', 'متجر', 'عايز', 'عاوز', 'محتاج', 'ممكن', 'عندكم', 'فيه', 'في', 'من', 'علي', 'عن', 'ايه', 'إيه', 'ايه؟', 'كل', 'أي', 'اي', 'شام',
  // A question about prices in general is not a product name: it gets the real spread instead of four picks.
  'سعر', 'سعره', 'اسعار', 'أسعار', 'بكام', 'كام', 'الاسعار', 'رخيص', 'ارخص', 'غالي', 'ميزانيه',
  'perfume', 'perfumes', 'product', 'products', 'prices', 'price', 'cost', 'costs', 'cheap', 'cheapest', 'expensive', 'budget',
  'want', 'need', 'looking', 'for', 'any', 'the', 'and', 'with', 'how', 'much', 'what', 'are', 'is', 'do', 'you', 'have',
]);

/**
 * Finds real products for a message. Uses the same wish parser as the store page (gender, family,
 * season, occasion, budget) plus whole-word matching on the enriched text — no invented item, and an
 * empty result stays empty.
 */
/** Generic words compared as stems: «prices» → «pric», «المنتجات» → «منتج», so a price question stays generic. */
const GENERIC_STEMS = new Set([...GENERIC].flatMap((w) => tokenize(w)));

export function findStorefront(items: StoreItem[], message: string, limit = 4): { picks: StoreItem[]; matched: boolean } {
  const wish = parseWish(message);
  const words = [...new Set(tokenize(message))].filter((w) => !GENERIC_STEMS.has(w) && !GENERIC.has(w));
  const scored: { item: StoreItem; score: number }[] = [];
  for (const item of items) {
    let score = 0;
    for (const word of words) if (item.haystack.includes(word)) score += item.haystack.includes(` ${word} `) ? 2 : 1;
    if (wish.gender && item.gender === wish.gender) score += 2;
    for (const family of wish.families) if (item.families.includes(family)) score += 3;
    for (const season of wish.seasons) if (item.seasons.includes(season)) score += 1;
    for (const occasion of wish.occasions) if (item.occasions.includes(occasion)) score += 1;
    for (const brand of wish.brands) if (item.brand && normalize(item.brand).includes(normalize(brand))) score += 3;
    if (wish.budgetMax !== undefined) score += item.price > 0 && item.price <= wish.budgetMax ? 2 : -2;
    if (wish.budgetMin !== undefined) score += item.price >= wish.budgetMin ? 1 : -3;
    if (wish.cheap) score += item.price > 0 ? Math.max(0, 2 - item.price / 500) : 0;
    if (!item.inStock) score -= 1;
    if (score > 0) scored.push({ item, score });
  }
  const picks = scored.sort((a, b) => b.score - a.score || a.item.price - b.item.price).slice(0, limit).map((s) => s.item);
  return { picks, matched: picks.length > 0 && (words.length > 0 || wish.families.length > 0 || Boolean(wish.gender) || Boolean(wish.brands.length)) };
}

/** The product a visitor has open (a product page hash carries the merchant id). */
export function findProductById(items: StoreItem[], id?: string): StoreItem | undefined {
  if (!id) return undefined;
  const clean = String(id).trim();
  return items.find((i) => String(i.id) === clean) || items.find((i) => String(i.sku) === clean);
}

/**
 * The real price picture of the store, spread across the range: the cheapest available, something in the
 * middle and one near the top — so a vague «إيه أسعار المنتجات؟» gets an honest, useful answer instead of
 * four arbitrary items (which used to be the most expensive ones, because that is the catalog order).
 */
export function priceDigest(items: StoreItem[], limit = 4): { min: number; max: number; picks: StoreItem[] } {
  const available = items.filter((i) => i.price > 0 && i.inStock).sort((a, b) => a.price - b.price);
  const pool = available.length ? available : items.filter((i) => i.price > 0).sort((a, b) => a.price - b.price);
  if (!pool.length) return { min: 0, max: 0, picks: [] };
  const min = pool[0].price;
  const max = pool[pool.length - 1].price;
  const targets = limit <= 1 ? [0] : Array.from({ length: limit }, (_, i) => min + ((max - min) * i) / (limit - 1));
  const picks: StoreItem[] = [];
  for (const target of targets) {
    let best: StoreItem | undefined;
    for (const item of pool) {
      if (picks.some((p) => p.sku === item.sku)) continue;
      if (!best || Math.abs(item.price - target) < Math.abs(best.price - target)) best = item;
    }
    if (best) picks.push(best);
  }
  return { min, max, picks: picks.sort((a, b) => a.price - b.price) };
}

/** One product line, in the visitor's language, with the catalog price and size only. */
export function storeLine(item: StoreItem, lang: 'ar' | 'en'): string {
  const name = lang === 'ar' ? item.nameAr : item.nameEn;
  const brand = item.brand ? ` (${item.brand})` : '';
  const size = item.sizeMl ? ` — ${item.sizeMl} ml` : '';
  const price = item.price > 0 ? ` — ${item.price} ${lang === 'ar' ? 'جنيه مصري' : 'EGP'}` : '';
  const stock = item.inStock ? '' : lang === 'ar' ? ' — غير متوفر حالياً' : ' — out of stock';
  return `• ${name}${brand}${size}${price}${stock}`;
}

const listOr = (values: string[], lang: 'ar' | 'en', empty: string) => (values.length ? values.join(' · ') : empty);

/** The live store facts added to the model prompt on every question (compact, always current). */
export function storeBrief(lang: 'ar' | 'en', snapshot: StoreSnapshot): string {
  const ar = lang === 'ar';
  if (snapshot.empty) {
    return ar
      ? 'المتجر: لا توجد منتجات منشورة الآن. لا تخترع منتجات أو أسعاراً؛ اقترح طلباً مخصصاً أو ترك رسالة للدعم.'
      : 'Store: no published products yet. Never invent products or prices; offer a bespoke request or a support message.';
  }
  const brands = listOr(snapshot.brands.map((b) => b.name), lang, '—');
  const families = listOr(snapshot.families.map((f) => `${FAMILY_LABEL[f.id][lang]} (${f.count})`), lang, '—');
  const range = `${snapshot.minPrice}–${snapshot.maxPrice} ${ar ? 'جنيه مصري' : 'EGP'}`;
  return ar
    ? `المتجر الآن: ${snapshot.total} منتج منشور (${snapshot.inStock} متوفر) — ${snapshot.featuredCount} مميّز و${snapshot.newCount} جديد · نطاق السعر ${range} · ماركات: ${brands} · عائلات: ${families}.\n` +
      'الأسعار بالجنيه المصري وتُحوّل لعملة الزائر في صفحة الدفع، والشحن يُحسب حسب بلده. لا تذكر هامش المنصة أو سعر المورّد إطلاقاً، ولا تخترع خصماً أو منتجاً أو مدة توصيل.'
    : `Store now: ${snapshot.total} published products (${snapshot.inStock} in stock) — ${snapshot.featuredCount} featured, ${snapshot.newCount} new · price range ${range} · brands: ${brands} · families: ${families}.\n` +
      'Prices are in EGP and converted to the visitor’s currency at checkout; shipping depends on their country. Never reveal the platform margin or supplier price, and never invent a discount, product or delivery time.';
}

/** Playbook topics → knowledge documents (kb-store-*): the visitor-facing truth about buying from Sham. */
interface PlaybookTopic { id: string; title: { ar: string; en: string }; body: { ar: string; en: string }; tags: string[] }

export const STORE_PLAYBOOK: PlaybookTopic[] = [
  {
    id: 'kb-store-buying',
    title: { ar: 'إزاي تشتري من متجر شام', en: 'How buying from the Sham store works' },
    body: {
      ar: 'الشراء من تبويب «المتجر»: ابحث بالاسم أو الماركة أو العائلة العطرية أو الفئة، افتح صفحة المنتج (تفاصيله وصوره وتقييماته)، ضيفه للسلة أو اضغط «شراء مباشر» لمنتج واحد من غير ما تغيّر السلة. بعدها صفحة إتمام الطلب: بيانات التوصيل ووسيلة الدفع، ويظهر السعر النهائي والشحن قبل التأكيد. بعد تأكيد الطلب بتاخد رقم طلب، وفريق شام بيتابعه معاك.',
      en: 'Buying happens in the Store tab: search by name, brand, scent family or category, open the product page (details, photos, reviews), then add to cart or press “buy now” for a single item without touching the cart. The checkout page collects delivery details and the payment method, and shows the final price and shipping before you confirm. After confirming you get an order reference and the Sham team follows it with you.',
    },
    tags: ['شراء', 'سلة', 'شراء مباشر', 'إتمام الطلب', 'buy', 'cart', 'checkout', 'order'],
  },
  {
    id: 'kb-store-payment',
    title: { ar: 'وسائل الدفع', en: 'Payment methods' },
    body: {
      ar: 'المتجر بيقبل الدفع عند الاستلام، إنستاباي، التحويل البنكي، المحفظة الإلكترونية، والبطاقة البنكية عبر بوابة الدفع المعتمدة — والوسائل المتاحة بتظهر حسب بلدك في صفحة الدفع. بطاقة الدفع بتتكتب في صفحة البوابة المؤمّنة فقط، وممنوع كتابتها في المحادثة. أي خصم أو كود يتم التأكد منه من صفحة الدفع، ومفيش خصم بيتقال في المحادثة.',
      en: 'The store accepts cash on delivery, InstaPay, bank transfer, mobile wallet and a bank card through the approved payment gateway — the methods shown depend on your country on the checkout page. Card details are entered only on the secured gateway page and must never be typed in chat. Any discount or code is confirmed at checkout; no discount is ever promised in chat.',
    },
    tags: ['دفع', 'الدفع عند الاستلام', 'إنستاباي', 'تحويل بنكي', 'محفظة', 'بطاقة', 'payment', 'instapay', 'cash on delivery', 'card'],
  },
  {
    id: 'kb-store-shipping-guide',
    title: { ar: 'الشحن والتوصيل والتغليف', en: 'Shipping, delivery and packaging' },
    body: {
      ar: 'الشحن بيتحسب حسب منطقة بلدك وعدد الزجاجات، والمدة التقديرية بتظهر مع الشحن في صفحة الدفع قبل التأكيد. العطور سائل قابل للاشتعال (UN1266 — Class 3) فالشحن الجوي محدود وبعض الدول بتقيّد استيراد العطور الكحولية أو مواد معيّنة، والرسوم الجمركية والضرائب المحلية مسؤولية المستلم وبتظهر بوضوح. المنتج بيتغلّف بعناية، ولو وصل تالف صوّره وتواصل مع الدعم فوراً.',
      en: 'Shipping depends on your country’s zone and the number of bottles, and the estimated time is shown with the shipping cost at checkout before you confirm. Perfume is a flammable liquid (UN1266 — Class 3), so air shipping is limited and some countries restrict alcohol perfumes or certain materials; customs duties and local taxes are the recipient’s responsibility and are shown clearly. Items are packed with care; if something arrives damaged, photograph it and contact support straight away.',
    },
    tags: ['شحن', 'توصيل', 'مدة التوصيل', 'جمارك', 'تغليف', 'shipping', 'delivery', 'customs', 'packaging'],
  },
  {
    id: 'kb-store-tracking',
    title: { ar: 'تتبع الطلب وحالته', en: 'Tracking your order' },
    body: {
      ar: 'تتبع الطلب محتاج رقم الطلب (بيبدأ بـ SH-) ومعاه رقم الهاتف أو البريد اللي استخدمته في الطلب، لحماية بياناتك. تقدر تكتبهم في صندوق التتبع في المحادثة أو تسأل «فين طلبي». حالات الطلب: جديد، قيد التنفيذ، تم إرسال عرض سعر، مؤكد، مكتمل، ملغي. لو الطلب اتأخر، اطلب التحويل لموظف والفريق هيتابع معاك.',
      en: 'Tracking needs the order reference (starts with SH-) together with the phone or e-mail used in the order, to protect your data. Enter them in the tracking box in the chat or ask “where is my order”. Statuses: new, in progress, quoted, confirmed, completed, cancelled. If an order is late, ask for a human and the team will follow up with you.',
    },
    tags: ['تتبع', 'حالة الطلب', 'رقم الطلب', 'tracking', 'order status', 'where is my order'],
  },
  {
    id: 'kb-store-returns-guide',
    title: { ar: 'الإرجاع والاستبدال', en: 'Returns and exchanges' },
    body: {
      ar: 'المنتج لازم يكون مختوم وغير مفتوح وغير مستخدم وفي عبوته الأصلية. مفيش إرجاع للعطور المفتوحة أو المخصصة/المركبة حسب الطلب لأسباب صحية، ولا للمنتجات اللي اتضررت باستخدام العميل. المدة القانونية بتختلف بالبلد (مصر 14 يوم حق عدول عن البيع عن بعد + 30 يوم للعيب، السعودية 7 أيام، الاتحاد الأوروبي 14 يوم)، والاسترداد بيتم بنفس وسيلة الدفع بعد الفحص. التفاصيل الكاملة في «المركز القانوني» ← الإرجاع والاسترداد.',
      en: 'The item must be sealed, unopened, unused and in its original packaging. Opened perfumes and bespoke/made-to-order blends cannot be returned for health reasons, nor can items damaged by the customer. The legal window varies by country (Egypt: 14 days for distance selling plus 30 days for a defect; Saudi Arabia: 7 days; EU: 14 days), and refunds go back to the original payment method after inspection. Full details live in the Legal Centre → Returns & Refunds.',
    },
    tags: ['إرجاع', 'استبدال', 'استرداد', 'ضمان', 'returns', 'refund', 'exchange'],
  },
  {
    id: 'kb-store-merchant-market',
    title: { ar: 'سوق التجار ومتاجر شام', en: 'The merchants’ market' },
    body: {
      ar: '«متاجر شام» بيعرض متاجر التجار المعتمدين: كل تاجر بيضيف منتجاته بسعره، والإدارة بتراجع المتجر وكل منتج قبل النشر، وروابط وأرقام الموردين بتتشال من النص العام. الشراء من صفحة المتجر بنفس بوابة الدفع. أي تاجر عايز يفتح متجر: «بوابة التجار» من تبويب المجتمع ← ملف المتجر ← إضافة منتجات، والمنتجات بتتنشر بعد الاعتماد.',
      en: 'Sham Stores lists approved merchant shops: each merchant adds products at their own price, the administration reviews the store and every product before publishing, and supplier links or phone numbers are stripped from public text. Buying happens on the store page through the same payment gateway. Merchants open a shop from the Community tab → Merchant portal → store file → add products; items go live after approval.',
    },
    tags: ['سوق التجار', 'متاجر شام', 'تاجر', 'merchant', 'marketplace', 'store'],
  },
  {
    id: 'kb-store-product-facts',
    title: { ar: 'أسعار المتجر والمخزون والصور', en: 'Store prices, stock and photos' },
    body: {
      ar: 'الأسعار والمخزون اللي بتشوفها في المتجر وفي ردود المساعد هي اللي في نظام شام لحظة السؤال، وبالجنيه المصري مع التحويل لعملة بلدك في صفحة الدفع. بعض المنتجات بيكون فيها نوتاتها معروفة من مصادر عامة، والبعض الآخر بيظهر بنوعه وعائلته فقط لأن النوتات مش موثقة — ومفيش نوتات مخترعة. لو منتج ظهر «غير متوفر»، تقدر تسأل عن بديل بنفس العائلة العطرية.',
      en: 'The prices and stock you see in the store and in the assistant’s replies are Sham’s own data at the moment you ask, in EGP with conversion to your currency at checkout. Some products have publicly documented notes; others show only type and family because their notes are not confirmed — no note is ever invented. If an item shows out of stock, ask for an alternative in the same scent family.',
    },
    tags: ['سعر', 'أسعار', 'مخزون', 'متوفر', 'نوتات', 'صور', 'price', 'stock', 'availability', 'notes', 'photos'],
  },
];

export function storeKnowledge(): KnowledgeDoc[] {
  const updatedAt = new Date().toISOString();
  return STORE_PLAYBOOK.map((topic) => ({
    id: topic.id,
    title: topic.title.ar,
    content: `${topic.body.ar} || ${topic.body.en}`.replace(' || ', ' '),
    tags: [...topic.tags, topic.title.en],
    updatedAt,
    serviceId: 'store',
  }));
}

export const storeTopic = (id: string) => STORE_PLAYBOOK.find((t) => t.id === id);
