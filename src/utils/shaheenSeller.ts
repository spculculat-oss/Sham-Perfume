/**
 * «شاهين التاجر المحنك» — the owner (2026-10-23): «حوّل شاهين لتاجر محنك يقدر يقنع الزبون بالشراء، ميشتتش انتباهه،
 * ولما يشتري حاجة يعرض عليه حاجة تانية» — with every technique of a good merchant, and none of a bad one.
 *
 * What a good merchant does, and what this module does:
 *  1. Focus: one main pick and at most two alternatives, then ONE clear next step (src/utils/shaheenBrain.ts nextStep);
 *     a named product gets a full pitch for the buyer who asks (src/utils/shaheenPitch.ts, src/utils/salesCraft.ts).
 *  2. «هاخده / ازاي اطلبه / I'll take it»: he closes — the product, why it's a good choice, how to order it in a
 *     minute (the real buying steps and payment methods of the store) — then offers what completes it.
 *  3. «غالي / too expensive»: he never argues; he shows the value honestly (price per ml) and the cheaper road:
 *     the same perfume in a smaller size, or a close perfume for less.
 *  4. «مش متأكد / هفكر / not sure»: no pressure — the facts (what it suits, how long it lasts, the real return policy
 *     for sealed items) and one question that decides.
 *  5. After a purchase (or an add to the cart): «يكمّل طلبك» — the same scent in a travel size, a perfume for the
 *     opposite season, a soft musk to layer under it — each with an honest reason, never more than three.
 *
 * Honesty is the law here (the store guide: «مفيش خصم بيتقال في المحادثة»): no invented discount, no fake scarcity
 * («فاضل 2 بس»), no «الناس كلها بتاخده» without real reviews, no countdown. Only what the catalogue publishes.
 * Pure and browser-safe: the chat server, the browser fallback and the store page use the same logic.
 */
import { closeTo, money, namedProducts, nameOf, scentKey, staying, type Context, type StoreAnswer } from './shaheenBrain';
import { inferOccasions, inferSeasons } from './storeAdvisor';
import { FAMILY_LABEL, OCCASION_LABEL, SEASON_LABEL, type StoreProduct } from './storeCatalog';
import { RECIPIENT_LABEL, readBuyer, type BuyerProfile } from './salesCraft';

type Lang = 'ar' | 'en';
type Link = (slug: string) => string | undefined;
const langOf = (language: string, text = ''): Lang => (/[\u0600-\u06FF]/.test(text) || ((language === 'ar' || language === 'fa') && !/[a-z]{3}/i.test(text)) ? 'ar' : 'en');

// ── What the visitor is telling the seller ─────────────────────────────────────────────────────────────────────
export type SaleMove = 'buy' | 'price' | 'doubt';
/** Arabic letters and marks only — «؟» and «،» are in the Arabic block too, and they end a word. */
const AR_LETTER = '\u0621-\u063A\u0640-\u065F\u0670-\u06D3';
const W = (words: string) => new RegExp(`(?<![${AR_LETTER}])(?:${words})(?![${AR_LETTER}])`, 'i');
/** «هاخده / اطلبهولي / ازاي اطلبه» — an object pronoun or «how do I order»: a bare «هشتري عطر» is a wish, not a close. */
const BUY_AR = W('هاخده|هاخدها|هخده|هخدها|حاخده|حاخدها|خلاص هاخد|هشتريه|هشتريها|اشتريه|اشتريها|اطلبه|اطلبها|اطلبهولي|اطلبهالي|احجزه|احجزها|ضيفه|ضيفها|ضيفهولي|(?:عايز|عايزة|عاوز|عاوزة|حابب|حابة) (?:اطلبه|اطلبها|اشتريه|اشتريها|اخده|اخدها|اجيبه|اجيبها)|(?:ازاي|إزاي|كيف) (?:اطلب|اشتري|ادفع|اطلبه|اشتريه|اطلبها|اشتريها)');
const BUY_EN = /\b(?:i'?ll take (?:it|this|that|them)|i'?ll buy (?:it|this|that)|buy it|order it|how (?:do i|can i|to) (?:order|buy|pay)|add (?:it|this|that) to (?:the |my )?cart|i want (?:to (?:buy|order) )?(?:it|this one|that one))\b/i;
/** «غالي / مكلف / فوق ميزانيتي» — the price objection («أرخص فيهم» among the picks is a comparison, not this). */
const PRICE_AR = W('ارخص منه|ارخص منها|حاجة ارخص|حاجه ارخص|بديل ارخص|بديل اوفر|حاجة اوفر|حاجه اوفر|غالي|غالى|غاليه|غالية|غاليين|مكلف|مكلفه|مكلفة|سعره عالي|سعرها عالي|سعره كبير|كتير عليا|كتير عليّ|فوق ميزانيتي|اكبر من ميزانيتي|أكبر من ميزانيتي|مش في ميزانيتي|مش معايا فلوسه');
const PRICE_EN = /\b(?:too expensive|expensive|pricey|over my budget|out of my budget|too much money|costs too much)\b/i;
/** «مش متأكد / محتار / هفكر» — hesitation. */
const DOUBT_AR = W('مش متأكد|مش متأكده|مش متأكدة|مش متاكد|محتار|محتارة|محتاره|متردد|مترددة|متردده|هفكر|هفكّر|خليني افكر|مش مقتنع|مقتنعتش|يستاهل|يستاهل سعره|مش عارف اختار|مش عارفة اختار|مش عارفه اختار');
const DOUBT_EN = /\b(?:not sure|unsure|hesitant|let me think|think about it|is it worth|worth it|can't decide|cannot decide)\b/i;

/** The move a message makes (buy, a price objection, doubt), or nothing. */
export function saleMove(text: string): SaleMove | undefined {
  // «إزاي أطلبه؟» and «ازاي اطلبه» are the same words: the hamza forms of alef are read as plain alef.
  const t = text.trim().replace(/[أإآ]/g, 'ا');
  if (!t || t.length > 140) return undefined;
  if (BUY_AR.test(t) || BUY_EN.test(t)) return 'buy';
  if (PRICE_AR.test(t) || PRICE_EN.test(t)) return 'price';
  if (DOUBT_AR.test(t) || DOUBT_EN.test(t)) return 'doubt';
  return undefined;
}

/** The store products a previous reply showed, in the order it showed them (the first is the main pick). */
export function shownInOrder(reply: string, products: StoreProduct[]): StoreProduct[] {
  const at = (p: StoreProduct) => {
    const bySlug = reply.indexOf(`/p/${p.slug}.html`);
    if (bySlug >= 0) return bySlug;
    const marks = [nameOf(p, 'ar'), nameOf(p, 'en')].filter((n) => n.length >= 3).flatMap((n) => [`[${n}]`, `**${n}**`, `«${n}»`, `“${n}”`]);
    const hits = marks.map((m) => reply.indexOf(m)).filter((i) => i >= 0);
    return hits.length ? Math.min(...hits) : -1;
  };
  return products.map((p) => ({ p, i: at(p) })).filter((x) => x.i >= 0).sort((a, b) => a.i - b.i).map((x) => x.p).slice(0, 6);
}

/** The product the visitor is talking about: named in the message, else the main pick of the reply before. */
export function focusOf(products: StoreProduct[], message: string, lastReply?: string): StoreProduct | undefined {
  return namedProducts(products, message, 1)[0] || (lastReply ? shownInOrder(lastReply, products)[0] : undefined);
}

// ── Honest value framing ─────────────────────────────────────────────────────────────────────────────────────────
/** «≈ 49 جنيه للمل، وحوالي 300 بخة» — about 10 sprays per ml, always said as an approximation. */
export function valueLine(p: StoreProduct, lang: Lang): string {
  if (!(p.price > 0) || !p.sizeMl) return p.price > 0 ? money(p.price, lang) : '';
  const perMl = Math.max(1, Math.round(p.price / p.sizeMl));
  const sprays = Math.round(p.sizeMl * 10);
  return lang === 'ar'
    ? `${money(p.price, lang)} لـ${p.sizeMl} مل (حوالي ${perMl} جنيه للمل، يعني تقريباً ${sprays} بخة)`
    : `${money(p.price, lang)} for ${p.sizeMl} ml (about EGP ${perMl} per ml — roughly ${sprays} sprays)`;
}

const stayingLine = (p: StoreProduct, lang: Lang) => {
  const s = staying(p);
  return s >= 6 ? (lang === 'ar' ? 'ثباته قوي — تركيزه وقاعدته فيها مثبتات، فبخات قليلة بتكفي اليوم.' : 'strong staying power — its concentration and base carry fixatives, so a few sprays last the day.')
    : s >= 4 ? (lang === 'ar' ? 'ثباته كويس، متوسط لطويل.' : 'good staying power, medium to long.')
      : (lang === 'ar' ? 'خفيف لمتوسط — حلو للنهار وبيتجدد بسهولة.' : 'light to medium — easy for daytime, refresh it during the day.');
};

/** What it is good for, in the visitor's words: its style and when it shines (the benefit, not the specification). */
export function benefitLine(p: StoreProduct, lang: Lang): string {
  const fam = p.families.slice(0, 2).map((f) => FAMILY_LABEL[f][lang]);
  const when = [...new Set([...inferSeasons(p).map((s) => SEASON_LABEL[s][lang]), ...inferOccasions(p).map((o) => OCCASION_LABEL[o][lang])])].slice(0, 3);
  const sep = lang === 'ar' ? '، ' : ', ';
  const parts = [fam.length ? (lang === 'ar' ? `طابعه ${fam.join(' و')}` : `a ${fam.join(' and ').toLowerCase()} character`) : '', when.length ? (lang === 'ar' ? `ومناسب لـ: ${when.join(sep)}` : `suited to: ${when.join(sep).toLowerCase()}`) : ''].filter(Boolean);
  return parts.join(lang === 'ar' ? '، ' : ', ');
}

/** Real social proof only: the published rating with at least three reviews — otherwise nothing is claimed. */
export function proofLine(p: StoreProduct, lang: Lang): string {
  if (!p.rating || !p.reviewCount || p.reviewCount < 3) return '';
  const r = Math.round(p.rating * 10) / 10;
  return lang === 'ar' ? `تقييمه ${r} من 5 من ${p.reviewCount} تقييم حقيقي في المتجر.` : `Rated ${r}/5 from ${p.reviewCount} real store reviews.`;
}

const titleOf = (p: StoreProduct, lang: Lang, link: Link) => { const url = link(p.slug); return url ? `[${nameOf(p, lang)}](${url})` : `**${nameOf(p, lang)}**`; };
const sizeOf = (p: StoreProduct, lang: Lang) => (p.sizeMl ? (lang === 'ar' ? `${p.sizeMl} مل` : `${p.sizeMl} ml`) : '');

/** The same perfume in another size (in stock): the smaller one first when asked for. */
export function otherSizes(products: StoreProduct[], p: StoreProduct): StoreProduct[] {
  const key = scentKey(p);
  return products.filter((q) => q.sku !== p.sku && q.inStock && q.sizeMl && p.sizeMl && q.sizeMl !== p.sizeMl && scentKey(q) === key).sort((a, b) => (a.sizeMl || 0) - (b.sizeMl || 0));
}

// ── «يكمّل طلبك»: what completes a purchase ──────────────────────────────────────────────────────────────────────
export interface Complement { product: StoreProduct; kind: 'travel' | 'season' | 'layer'; reason: { ar: string; en: string } }

const WARM: ReadonlySet<string> = new Set(['winter', 'autumn']);
const isWarm = (p: StoreProduct) => { const s = inferSeasons(p); return s.some((x) => WARM.has(x)) && !s.includes('summer'); };
const isFresh = (p: StoreProduct) => { const s = inferSeasons(p); return s.includes('summer') && !s.some((x) => WARM.has(x)); };
const genderFits = (p: StoreProduct, q: StoreProduct) => !p.gender || !q.gender || q.gender === 'unisex' || p.gender === 'unisex' || p.gender === q.gender;
/** Nearest in price to the purchase first (a complement shouldn't jump the budget), then the longer-lasting. */
const byBudget = (p: StoreProduct) => (a: StoreProduct, b: StoreProduct) => Math.abs(a.price - p.price) - Math.abs(b.price - p.price) || staying(b) - staying(a);

/**
 * What completes what the visitor bought (or put in the cart) — at most `limit`, each with an honest reason:
 * the same scent smaller (travel), a perfume for the opposite season, and a soft musk to layer under it.
 * Never something already bought, never out of stock, never above 1.3× the purchase.
 */
export function complementsFor(products: StoreProduct[], bought: StoreProduct[], limit = 3): Complement[] {
  if (!bought.length) return [];
  const taken = new Set(bought.map((p) => p.sku));
  const keys = new Set(bought.map(scentKey));
  const out: Complement[] = [];
  const free = (q: StoreProduct) => q.inStock && q.price > 0 && !taken.has(q.sku) && !out.some((c) => c.product.sku === q.sku);
  const main = [...bought].sort((a, b) => b.price - a.price)[0];
  const cap = main.price * 1.3;
  const n = (lang: Lang) => nameOf(main, lang);
  // 1. The same scent for the bag: a smaller bottle of what he bought.
  const travel = otherSizes(products, main).filter((q) => free(q) && (q.sizeMl || 0) < (main.sizeMl || 0) && (q.sizeMl || 0) <= 50)[0];
  if (travel) out.push({ product: travel, kind: 'travel', reason: { ar: `نفس ريحة «${n('ar')}» بحجم ${travel.sizeMl} مل — للشنطة والسفر والشغل من غير ما تشيل الزجاجة الكبيرة.`, en: `The same “${n('en')}” scent in ${travel.sizeMl} ml — for the bag, travel and work without carrying the big bottle.` } });
  // 2. The other half of the year.
  const pool = products.filter((q) => free(q) && !keys.has(scentKey(q)) && genderFits(main, q) && q.price <= cap);
  const warm = isWarm(main), fresh = isFresh(main);
  if (warm || fresh) {
    const other = pool.filter((q) => (warm ? isFresh(q) : isWarm(q))).sort(byBudget(main))[0];
    if (other) out.push({ product: other, kind: 'season', reason: warm
      ? { ar: `«${n('ar')}» دافي وتقيل للبرد، ودي منعشة للصيف والحر — كده يبقى عندك عطر لكل السنة.`, en: `“${n('en')}” is warm and rich for the cold; this one is fresh for summer heat — a perfume for the whole year.` }
      : { ar: `«${n('ar')}» منعش للحر، ودي دافية وتثبت في الشتا والسهرات — كده يبقى عندك عطر لكل السنة.`, en: `“${n('en')}” is fresh for the heat; this one is warm and lasts in winter and evenings — a perfume for the whole year.` } });
  }
  // 3. A soft musk to layer under it (not when he bought a musk already).
  if (!main.families.includes('musk')) {
    const musk = pool.filter((q) => q.families.includes('musk') && !out.some((c) => c.product.sku === q.sku) && q.price <= main.price).sort((a, b) => a.price - b.price || staying(b) - staying(a))[0];
    if (musk) out.push({ product: musk, kind: 'layer', reason: { ar: `مسك ناعم تحطه طبقة تحت «${n('ar')}» — بيساعد الريحة تثبت أطول ويدّيها نعومة، وينفع لوحده للنهار.`, en: `A soft musk to layer under “${n('en')}” — it helps the scent last longer and softens it, and works alone for daytime.` } });
  }
  // Cosmetics with the same notes join here once the cosmetics section has products (it is «قريباً» for now).
  return out.slice(0, limit);
}

function complementBlock(products: StoreProduct[], bought: StoreProduct[], lang: Lang, link: Link, limit = 2): string[] {
  const extras = complementsFor(products, bought, limit);
  if (!extras.length) return [];
  return [
    '', lang === 'ar' ? '**يكمّل معاه (اختياري خالص):**' : '**Goes well with it (entirely optional):**',
    ...extras.map((c) => `- ${titleOf(c.product, lang, link)} — ${money(c.product.price, lang)}${sizeOf(c.product, lang) ? ` · ${sizeOf(c.product, lang)}` : ''}\n  ${c.reason[lang]}`),
    '', lang === 'ar' ? 'تحب أضيفلك واحد منهم؟ ولو هتكتفي بيه لوحده، فاختيارك ممتاز كده.' : 'Want me to add one of them? If you keep it to this one, it is an excellent choice on its own.',
  ];
}

// ── The replies ──────────────────────────────────────────────────────────────────────────────────────────────────
const HOW_TO_ORDER: Record<Lang, string[]> = {
  ar: [
    '**إزاي تطلبه في دقيقة:**',
    '1. افتح صفحته من اللينك واضغط «شراء مباشر» (أو ضيفه للسلة لو هتطلب معاه حاجة تانية).',
    '2. اكتب عنوان التوصيل واختار الدفع: عند الاستلام، إنستاباي، تحويل بنكي، محفظة أو بطاقة — اللي متاح لبلدك بيظهر في صفحة الدفع.',
    '3. السعر النهائي بعملة بلدك والشحن بيظهروا قبل التأكيد، وبعدها بتاخد رقم طلب (بيبدأ بـ SH-) تتابع بيه.',
  ],
  en: [
    '**How to order it in a minute:**',
    '1. Open its page from the link and press “Buy now” (or add it to the cart if you are ordering more).',
    '2. Enter the delivery address and choose how to pay: cash on delivery, InstaPay, bank transfer, wallet or card — the ones available in your country show on the payment page.',
    '3. The final price in your currency and the shipping show before you confirm, then you get an order number (starting with SH-) to track it.',
  ],
};

function buyReply(products: StoreProduct[], p: StoreProduct, lang: Lang, link: Link, buyer: BuyerProfile = readBuyer([])): string {
  if (!p.inStock) {
    const instead = otherSizes(products, p)[0] || closeTo(products, p, 1)[0];
    const out = [lang === 'ar' ? `بصراحة «${nameOf(p, lang)}» غير متوفر حالياً في المتجر، ومش هوعدك بميعاد مش متأكد منه.` : `Honestly, “${nameOf(p, lang)}” is out of stock right now, and I won't promise a date I'm not sure of.`];
    if (instead) out.push('', lang === 'ar' ? `الأقرب ليه والمتوفر دلوقتي: ${titleOf(instead, lang, link)} — ${valueLine(instead, lang)}.` : `The closest one in stock now: ${titleOf(instead, lang, link)} — ${valueLine(instead, lang)}.`, '', ...HOW_TO_ORDER[lang]);
    return out.join('\n');
  }
  const out = [lang === 'ar' ? `**اختيار موفق 👌 ${titleOf(p, lang, link)}**` : `**Great choice 👌 ${titleOf(p, lang, link)}**`];
  const benefit = benefitLine(p, lang);
  out.push(`- ${lang === 'ar' ? 'ليه هيبسطك' : 'Why you will enjoy it'}: ${[benefit, stayingLine(p, lang)].filter(Boolean).join(lang === 'ar' ? '، ' : '; ')}`);
  const value = valueLine(p, lang);
  if (value) out.push(`- ${lang === 'ar' ? 'السعر' : 'Price'}: ${value}`);
  const proof = proofLine(p, lang);
  if (proof) out.push(`- ${proof}`);
  out.push('', ...HOW_TO_ORDER[lang]);
  // Said for this buyer: the gift's recipient, the cautious one's guarantee, the date for the one in a hurry.
  if (buyer.recipient) out.push('', lang === 'ar' ? `ولو هدية لـ${RECIPIENT_LABEL[buyer.recipient].ar}: المنتج المختوم ينفع يتبدل في المدة القانونية لو الذوق ماجاش مظبوط.` : `If it is a gift for ${RECIPIENT_LABEL[buyer.recipient].en}: a sealed item can be exchanged within the legal window if the taste is not right.`);
  else if (buyer.style === 'cautious') out.push('', lang === 'ar' ? 'وعشان تطمن: المنتج المختوم ليه حق إرجاع أو استبدال في المدة القانونية لبلدك (في مصر 14 يوم للشراء عن بعد).' : 'For peace of mind: a sealed item can be returned or exchanged within your country\'s legal window (Egypt: 14 days for distance selling).');
  if (buyer.urgent) out.push(lang === 'ar' ? '_محتاجه قريب؟ مدة التوصيل لبلدك بتظهر في صفحة الدفع قبل ما تأكد._' : '_Need it soon? The delivery time to your country shows on the payment page before you confirm._');
  // «لما يشتري حاجة يعرض عليه حاجة تانية» — one or two optional complements (one for the buyer in a hurry).
  out.push(...complementBlock(products, [p], lang, link, buyer.style === 'direct' ? 1 : 2));
  return out.join('\n');
}

function priceReply(products: StoreProduct[], p: StoreProduct, lang: Lang, link: Link): string {
  const out = [lang === 'ar' ? 'فاهمك — الميزانية مهمة، ومفيش داعي تدفع أكتر من اللي يريحك.' : 'I understand — the budget matters, and there is no reason to pay more than you are comfortable with.'];
  const value = valueLine(p, lang);
  if (value) out.push(`- ${titleOf(p, lang, link)}: ${value}.${staying(p) >= 6 ? (lang === 'ar' ? ' وثباته العالي معناه بخات أقل في اليوم، فالزجاجة بتعيش معاك أطول.' : ' Its strong staying power means fewer sprays a day, so the bottle lasts longer.') : ''}`);
  const smaller = otherSizes(products, p).filter((q) => (q.sizeMl || 0) < (p.sizeMl || 0) && q.price < p.price);
  const cheaperOf = (pool: StoreProduct[]) => pool.filter((q) => q.inStock && q.price > 0 && q.price < p.price * 0.9 && !smaller.some((s) => s.sku === q.sku) && scentKey(q) !== scentKey(p));
  // The closest in style and base first; otherwise the same character (a shared family, the same gender) for less.
  const alike = cheaperOf(closeTo(products, p, 12));
  const sameStyle = alike.length ? [] : cheaperOf(products.filter((q) => q.families.some((f) => p.families.slice(0, 2).includes(f)) && genderFits(p, q)));
  const cheaper = [...alike, ...sameStyle].sort((a, b) => b.price - a.price).slice(0, 2 - Math.min(1, smaller.length));
  const perMl = (q: StoreProduct) => (q.sizeMl ? q.price / q.sizeMl : Infinity);
  // Honest even when it costs the sale a little: a lower price can still be dearer per ml.
  const dearerPerMl = cheaper.concat(smaller.slice(0, 1)).some((q) => q.sizeMl && p.sizeMl && perMl(q) > perMl(p) * 1.05);
  if (smaller.length || cheaper.length) {
    out.push('', lang === 'ar' ? '**الطريق الأوفر:**' : '**The better-value road:**');
    for (const s of smaller.slice(0, 1)) out.push(lang === 'ar' ? `- نفس العطر بحجم ${s.sizeMl} مل: ${titleOf(s, lang, link)} — ${money(s.price, lang)} (تجربه الأول بأقل تكلفة).` : `- The same perfume in ${s.sizeMl} ml: ${titleOf(s, lang, link)} — ${money(s.price, lang)} (try it first for less).`);
    for (const c of cheaper) out.push(alike.includes(c)
      ? (lang === 'ar' ? `- قريب منه في الطابع والقاعدة: ${titleOf(c, lang, link)} — ${valueLine(c, lang)}.` : `- Close to it in style and base: ${titleOf(c, lang, link)} — ${valueLine(c, lang)}.`)
      : (lang === 'ar' ? `- من نفس الطابع بسعر أقل: ${titleOf(c, lang, link)} — ${valueLine(c, lang)}.` : `- The same character for less: ${titleOf(c, lang, link)} — ${valueLine(c, lang)}.`));
    if (dearerPerMl) out.push(lang === 'ar' ? `_للأمانة: البدائل دي أقل في الدفعة الواحدة، بس لو حسبتها بالمل «${nameOf(p, lang)}» أوفر على المدى الطويل._` : `_To be fair: these cost less up front, but per ml “${nameOf(p, lang)}” is better value in the long run._`);
  } else {
    out.push('', lang === 'ar' ? 'بصراحة مالقيتش في المتجر دلوقتي حاجة قريبة منه بسعر أقل. قولّي ميزانيتك بالرقم وأنا أرشحلك أحسن حاجة على قدها.' : 'Honestly, the store has nothing close to it for less right now. Tell me your budget as a number and I will pick the best within it.');
  }
  out.push('', lang === 'ar' ? 'قولّي أنهي واحد يريحك، أو اكتب «هاخده» وأنا أقولك تطلبه إزاي. _ومفيش خصومات بتتقال في المحادثة — أي كود خصم حقيقي بيظهر في صفحة الدفع._' : 'Tell me which one suits you, or write “I\'ll take it” and I will show you how to order. _No discounts are promised in chat — any real discount code shows on the payment page._');
  return out.join('\n');
}

function doubtReply(products: StoreProduct[], p: StoreProduct, lang: Lang, link: Link): string {
  const out = [lang === 'ar' ? `طبيعي تحتار، والقرار ده يستاهل تاخد وقتك فيه. خليني أسهّلهولك بالحقيقة عن ${titleOf(p, lang, link)}:` : `It's natural to hesitate, and it is worth taking your time. Here are the facts about ${titleOf(p, lang, link)}:`];
  const benefit = benefitLine(p, lang);
  if (benefit) out.push(`- ${lang === 'ar' ? 'مناسب لإيه' : 'What it suits'}: ${benefit}.`);
  out.push(`- ${lang === 'ar' ? 'الثبات' : 'Staying power'}: ${stayingLine(p, lang)}`);
  const proof = proofLine(p, lang);
  if (proof) out.push(`- ${proof}`);
  const smaller = otherSizes(products, p).find((q) => (q.sizeMl || 0) < (p.sizeMl || 0));
  if (smaller) out.push(lang === 'ar' ? `- عايز تجربه الأول؟ موجود بحجم ${smaller.sizeMl} مل: ${titleOf(smaller, lang, link)} — ${money(smaller.price, lang)}.` : `- Want to try it first? It comes in ${smaller.sizeMl} ml: ${titleOf(smaller, lang, link)} — ${money(smaller.price, lang)}.`);
  out.push(lang === 'ar'
    ? '- لو قلقان: المنتج المختوم اللي متفتحش ينفع يترجع أو يتبدل في المدة القانونية لبلدك (في مصر 14 يوم للشراء عن بعد)، أما العطر المفتوح فمبيترجعش لأسباب صحية — والتفاصيل في «مركز القوانين ← الإرجاع والاسترداد».'
    : '- If you are worried: a sealed, unopened item can be returned or exchanged within your country\'s legal window (Egypt: 14 days for distance selling); opened perfumes cannot, for health reasons — details in the Legal Centre → Returns & Refunds.');
  out.push('', lang === 'ar' ? 'سؤال واحد يحسمها: هتلبسه أكتر في **الشغل والنهار** ولا في **السهرات والخروج**؟ وأنا أقولك بصراحة لو هو الأنسب ليك ولا في اللي أحسن منه.' : 'One question settles it: will you wear it more for **work and daytime** or for **evenings and going out**? I will tell you honestly whether it is the best fit or something else is.');
  return out.join('\n');
}

/**
 * The seller's turn in the chat: a close («هاخده»), a price objection («غالي») or doubt («مش متأكد») about a product
 * the visitor named or was just shown. Anything else is not his turn (undefined) and the store/brain answers.
 */
export function salesAnswer(products: StoreProduct[], ctx: Context, language: string, link: Link): StoreAnswer | undefined {
  if (!products.length) return undefined;
  const asked = ctx.followUp && ctx.previous && ctx.text.startsWith(ctx.previous) ? ctx.text.slice(ctx.previous.length).trim() : ctx.text;
  const move = saleMove(asked);
  if (!move) return undefined;
  // The perfume on the screen: named now, else the main pick of the reply before — or of a recent one that showed
  // products («فيه خصم عليه؟» → «غالي شوية» is still about it).
  const p = focusOf(products, asked, ctx.lastReply) || (ctx.shownReply ? shownInOrder(ctx.shownReply, products)[0] : undefined);
  if (!p) return undefined;
  const lang = langOf(language, asked);
  const buyer = readBuyer(ctx.said || [asked]);
  const reply = move === 'buy' ? buyReply(products, p, lang, link, buyer) : move === 'price' ? priceReply(products, p, lang, link) : doubtReply(products, p, lang, link);
  return { reply, picks: [p], matched: true };
}
