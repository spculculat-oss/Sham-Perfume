/**
 * «خزنة فهم الزوار» — what visitors, customers and members do on the platform, studied for the owner only.
 *
 * The owner's decision (2026-10-24): every interaction with the platform is recorded, stored and analysed —
 * tastes, buying behaviour, communication style, the culture of each country — so the store is built on
 * psychological, environmental and social understanding. The data lives on the server, behind the admin token,
 * and belongs to the administration alone.
 *
 * The lines that never move (the law of every country we sell to — Egypt 151/2020, GDPR, Saudi PDPL — and the
 * platform's own rules):
 *   - it is recorded only after the visitor accepts «التحليل» in the consent banner, and he can withdraw (and erase
 *     his record) at any time; the privacy policy says plainly what is studied;
 *   - no key, secret, password or card number is ever stored — a message that carries one keeps only its topic;
 *   - contact data (name, phone, e-mail, address) is not copied here: an e-mail or a phone typed in a search or a
 *     chat is masked; a member is linked by his account id, so his contact data stays in his account only;
 *   - nothing here is written to the public repository or sent to an AI platform;
 *   - no sensitive category (health, religion, ethnicity, politics, sexuality) is inferred or labelled;
 *   - the reading is a behavioural profile for serving him better (communication style, decision style, price
 *     comfort, scent temperament), never a clinical diagnosis, and it is never used to pressure him (no fake
 *     scarcity, no invented discounts — the honesty rules apply).
 * Pure: no React, no network. The server (server/insights.ts) stores profiles; the admin panel reads summaries.
 */
import { readBuyer, type BuyerMotive, type BuyerStyle } from './salesCraft';
import { questionIntents } from './shaheenTools';
import { FAMILY_LABEL, type Family, type StoreProduct } from './storeCatalog';

/** The consent text version: a visitor who accepted an older text is asked again. */
export const INSIGHTS_CONSENT_VERSION = '1.1';
export const INSIGHTS_RETENTION_DAYS = 365;

export const INSIGHT_EVENT_TYPES = ['section', 'product', 'search', 'chat', 'cart', 'checkout', 'purchase', 'language', 'country'] as const;
export type InsightEventType = typeof INSIGHT_EVENT_TYPES[number];
export interface InsightEvent { type: InsightEventType; at?: number; section?: string; sku?: string; text?: string; qty?: number; value?: string }
export interface InsightBatch {
  visitorId: string; accountId?: string; consent: string; country?: string; language?: string;
  device?: 'mobile' | 'tablet' | 'desktop'; hour?: number; events: InsightEvent[];
}

type Counter = Record<string, number>;
export interface InsightProfile {
  id: string; accountId?: string; firstSeen: string; lastSeen: string; days: string[]; events: number;
  country?: string; edgeCountry?: string; language?: string; device?: string;
  sections: Counter; products: Counter; families: Counter; genders: Counter; occasions: Counter; seasons: Counter; brands: Counter;
  price: { n: number; sum: number; min: number; max: number };
  searches: string[]; chats: string[];
  intents: Counter; styles: Counter; motives: Counter; stages: Counter; recipients: Counter;
  flags: { budget: number; connoisseur: number; urgent: number };
  funnel: { products: number; carts: number; checkouts: number; purchases: number };
  hours: number[];
  recent: { at: string; type: InsightEventType; ref?: string }[];
  consent: { version: string; at: string };
}

const VISITOR = /^[A-Za-z0-9_-]{8,80}$/;
const SAFE_ID = /^[A-Za-z0-9_.:@-]{1,80}$/;
const COUNTRY = /^[A-Z]{2}$/;
const MAX_EVENTS = 40;
const MAX_KEYS = 40;
const MAX_TEXTS = 30;

// ── Privacy guards ──────────────────────────────────────────────────────────────────────────────────────────────
/** A key, a secret, a password, a token — the whole text is dropped (only its topic would be kept). */
const SECRET = /(?:password|passwd|passcode|api[\s_-]?key|secret|token|bearer\s|sk-[a-z0-9]|ghp_|AIza[0-9A-Za-z_-]{10}|كلمة\s*(?:ال)?سر|كلمة\s*(?:ال)?مرور|باسورد|باسوورد|الرقم\s*السري|رمز\s*(?:ال)?تحقق|مفتاح\s*(?:ال)?api|كود\s*(?:ال)?تفعيل|OTP)/i;
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
/** Seven digits or more (phones, cards, IDs, account numbers), Western or Arabic-Indic, with spaces or dashes. */
const LONG_NUMBER = /(?:[0-9٠-٩][\s-]?){7,}/g;

/** A visitor's words as they may be kept: no secrets, no e-mails, no phone/card/ID numbers, short. */
export function scrubText(text: unknown, max = 160): string | undefined {
  if (typeof text !== 'string') return undefined;
  const clean = text.replace(/[\u0000-\u001f]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!clean || SECRET.test(clean)) return undefined;
  return clean.replace(EMAIL, '[بريد]').replace(LONG_NUMBER, '[رقم] ').replace(/\s+/g, ' ').trim().slice(0, max) || undefined;
}

/** True when a text was dropped because it carried a secret (only its topic is counted). */
export const carriesSecret = (text: unknown) => typeof text === 'string' && SECRET.test(text);

/** One batch from the browser, cleaned; undefined = refused (no consent, bad id, nothing to record). */
export function readBatch(raw: unknown): InsightBatch | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const b = raw as Record<string, unknown>;
  if (b.consent !== INSIGHTS_CONSENT_VERSION) return undefined;
  if (typeof b.visitorId !== 'string' || !VISITOR.test(b.visitorId)) return undefined;
  const events = (Array.isArray(b.events) ? b.events : []).slice(0, MAX_EVENTS).flatMap((e): InsightEvent[] => {
    if (!e || typeof e !== 'object') return [];
    const ev = e as Record<string, unknown>;
    if (!INSIGHT_EVENT_TYPES.includes(ev.type as InsightEventType)) return [];
    const type = ev.type as InsightEventType;
    const out: InsightEvent = { type };
    if (typeof ev.at === 'number' && Number.isFinite(ev.at)) out.at = ev.at;
    if (typeof ev.section === 'string' && SAFE_ID.test(ev.section)) out.section = ev.section;
    if (typeof ev.sku === 'string' && SAFE_ID.test(ev.sku)) out.sku = ev.sku;
    if (typeof ev.value === 'string' && SAFE_ID.test(ev.value)) out.value = ev.value;
    if (typeof ev.qty === 'number' && ev.qty > 0) out.qty = Math.min(99, Math.floor(ev.qty));
    if (type === 'search' || type === 'chat') {
      if (carriesSecret(ev.text)) out.value = 'secret-dropped';
      else { const text = scrubText(ev.text); if (text) out.text = text; else return []; }
    }
    return [out];
  });
  if (!events.length) return undefined;
  const country = typeof b.country === 'string' && COUNTRY.test(b.country) ? b.country : undefined;
  const language = typeof b.language === 'string' && /^[a-z]{2,3}(?:-[A-Za-z]{2,4})?$/.test(b.language) ? b.language : undefined;
  const device = b.device === 'mobile' || b.device === 'tablet' || b.device === 'desktop' ? b.device : undefined;
  const hour = typeof b.hour === 'number' && b.hour >= 0 && b.hour < 24 ? Math.floor(b.hour) : undefined;
  const accountId = typeof b.accountId === 'string' && SAFE_ID.test(b.accountId) ? b.accountId : undefined;
  return { visitorId: b.visitorId, consent: INSIGHTS_CONSENT_VERSION, events, ...(accountId ? { accountId } : {}), ...(country ? { country } : {}), ...(language ? { language } : {}), ...(device ? { device } : {}), ...(hour !== undefined ? { hour } : {}) };
}

// ── Recording ───────────────────────────────────────────────────────────────────────────────────────────────────
const bump = (c: Counter, key: string | undefined, by = 1) => {
  if (!key) return;
  c[key] = (c[key] || 0) + by;
  const keys = Object.keys(c);
  if (keys.length > MAX_KEYS) { const low = keys.sort((a, b) => c[a] - c[b])[0]; if (low !== key) delete c[low]; }
};
const day = (d: Date) => d.toISOString().slice(0, 10);

export function emptyProfile(id: string, now: Date): InsightProfile {
  return {
    id, firstSeen: now.toISOString(), lastSeen: now.toISOString(), days: [], events: 0,
    sections: {}, products: {}, families: {}, genders: {}, occasions: {}, seasons: {}, brands: {},
    price: { n: 0, sum: 0, min: 0, max: 0 }, searches: [], chats: [],
    intents: {}, styles: {}, motives: {}, stages: {}, recipients: {}, flags: { budget: 0, connoisseur: 0, urgent: 0 },
    funnel: { products: 0, carts: 0, checkouts: 0, purchases: 0 }, hours: Array.from({ length: 24 }, () => 0), recent: [],
    consent: { version: INSIGHTS_CONSENT_VERSION, at: now.toISOString() },
  };
}

export interface ApplyContext { now: Date; edgeCountry?: string; product?: (sku: string) => StoreProduct | undefined }

/** One batch added to a visitor's profile (a new profile when there is none). */
export function applyBatch(previous: InsightProfile | undefined, batch: InsightBatch, ctx: ApplyContext): InsightProfile {
  const p: InsightProfile = previous ? structuredClone(previous) : emptyProfile(batch.visitorId, ctx.now);
  p.lastSeen = ctx.now.toISOString();
  p.consent = { version: batch.consent, at: p.consent?.at || ctx.now.toISOString() };
  const today = day(ctx.now);
  if (!p.days.includes(today)) p.days = [...p.days, today].slice(-90);
  if (batch.accountId) p.accountId = batch.accountId;
  if (batch.country) p.country = batch.country;
  if (ctx.edgeCountry && COUNTRY.test(ctx.edgeCountry)) p.edgeCountry = ctx.edgeCountry;
  if (batch.language) p.language = batch.language;
  if (batch.device) p.device = batch.device;
  if (batch.hour !== undefined) p.hours[batch.hour] = (p.hours[batch.hour] || 0) + batch.events.length;
  const said: string[] = [];
  for (const e of batch.events) {
    p.events += 1;
    let ref: string | undefined;
    if (e.type === 'section') { bump(p.sections, e.section); ref = e.section; }
    if ((e.type === 'product' || e.type === 'cart' || e.type === 'purchase') && e.sku) {
      ref = e.sku;
      const product = ctx.product?.(e.sku);
      const weight = e.type === 'product' ? 1 : e.type === 'cart' ? 3 : 5;
      bump(p.products, e.sku, weight);
      if (product) {
        product.families.forEach((f) => bump(p.families, f, weight));
        bump(p.genders, product.gender, weight);
        product.occasions.forEach((o) => bump(p.occasions, o, weight));
        product.seasons.forEach((s) => bump(p.seasons, s, weight));
        if (product.brand) bump(p.brands, product.brand, weight);
        if (product.price > 0) {
          p.price = { n: p.price.n + 1, sum: p.price.sum + product.price, min: p.price.n ? Math.min(p.price.min, product.price) : product.price, max: Math.max(p.price.max, product.price) };
        }
      }
    }
    if (e.type === 'product') p.funnel.products += 1;
    if (e.type === 'cart') p.funnel.carts += 1;
    if (e.type === 'checkout') p.funnel.checkouts += 1;
    if (e.type === 'purchase') p.funnel.purchases += 1;
    if (e.type === 'language' || e.type === 'country') ref = e.value;
    if (e.type === 'search' || e.type === 'chat') {
      if (e.text) {
        (e.type === 'search' ? p.searches : p.chats).push(e.text);
        said.push(e.text);
        questionIntents(e.text).forEach((intent) => bump(p.intents, intent));
      } else bump(p.intents, 'private');
      ref = e.type;
    }
    p.recent.push({ at: new Date(e.at && Math.abs(e.at - ctx.now.getTime()) < 86_400_000 ? e.at : ctx.now.getTime()).toISOString(), type: e.type, ...(ref ? { ref } : {}) });
  }
  p.searches = p.searches.slice(-MAX_TEXTS);
  p.chats = p.chats.slice(-MAX_TEXTS);
  p.recent = p.recent.slice(-60);
  if (said.length) {
    // How he talks and why he buys, read like Shaheen's seller reads a conversation (src/utils/salesCraft.ts).
    const buyer = readBuyer([...p.chats.slice(-6), ...said].slice(-6));
    bump(p.styles, buyer.style); bump(p.motives, buyer.motive); bump(p.stages, buyer.stage); bump(p.recipients, buyer.recipient);
    if (buyer.budgetSensitive) p.flags.budget += 1;
    if (buyer.connoisseur) p.flags.connoisseur += 1;
    if (buyer.urgent) p.flags.urgent += 1;
  }
  return p;
}

// ── Reading a person ────────────────────────────────────────────────────────────────────────────────────────────
type Text = { ar: string; en: string };
const top = (c: Counter): string | undefined => Object.entries(c).sort((a, b) => b[1] - a[1])[0]?.[0];
const topN = (c: Counter, n: number) => Object.entries(c).sort((a, b) => b[1] - a[1]).slice(0, n);
const total = (c: Counter) => Object.values(c).reduce((a, b) => a + b, 0);

export const STYLE_TEXT: Record<BuyerStyle, { label: Text; how: Text }> = {
  direct: { label: { ar: 'عملي ومباشر', en: 'Direct and practical' }, how: { ar: 'اختصر: ترشيح واحد والسعر وطريقة الطلب.', en: 'Be brief: one pick, the price, how to order.' } },
  analytical: { label: { ar: 'تحليلي بيدوّر على التفاصيل', en: 'Analytical, wants details' }, how: { ar: 'قدّم المكونات والثبات والمقارنة بالأرقام.', en: 'Give notes, longevity and comparisons with figures.' } },
  expressive: { label: { ar: 'عاطفي ومتحمس', en: 'Expressive and enthusiastic' }, how: { ar: 'احكي الإحساس والحضور والمناسبة.', en: 'Tell the feeling, the presence, the occasion.' } },
  cautious: { label: { ar: 'حذر ومحتاج يطمّن', en: 'Cautious, needs reassurance' }, how: { ar: 'اتكلم عن الضمانات وسياسة الإرجاع بصراحة ومن غير ضغط.', en: 'Speak candidly about guarantees and returns, no pressure.' } },
  friendly: { label: { ar: 'ودود (مافيش إشارة كفاية لسه)', en: 'Friendly (not enough signal yet)' }, how: { ar: 'سؤال واحد لطيف عن المناسبة أو الإحساس المطلوب.', en: 'One friendly question about the occasion or feeling.' } },
};
export const MOTIVE_TEXT: Record<BuyerMotive, Text> = {
  gift: { ar: 'بيشتري هدايا', en: 'Buys gifts' }, occasion: { ar: 'بيشتري لمناسبات', en: 'Buys for occasions' },
  signature: { ar: 'بيدوّر على عطر يميّزه', en: 'Looks for a signature scent' }, value: { ar: 'بيدوّر على أحسن قيمة', en: 'Looks for the best value' },
  self: { ar: 'بيشتري لنفسه', en: 'Buys for himself' },
};
/** Common associations in fragrance-preference research (tendencies, not traits — shown as such). */
const TEMPER: Partial<Record<Family, Text>> = {
  oud: { ar: 'بيحب الحضور القوي والطابع الشرقي التقليدي', en: 'Likes a strong presence and the traditional oriental style' },
  oriental: { ar: 'بيميل للدفء والفخامة', en: 'Leans to warmth and opulence' },
  amber: { ar: 'بيميل للدفء والراحة', en: 'Leans to warmth and comfort' },
  woody: { ar: 'بيحب الهدوء والثقة والرقي', en: 'Likes calm, confident refinement' },
  floral: { ar: 'بيميل للرومانسية والنعومة', en: 'Leans to romance and softness' },
  fresh: { ar: 'نشيط وبيحب البساطة والانتعاش', en: 'Energetic, likes simplicity and freshness' },
  citrus: { ar: 'مرح وبيحب الطاقة والخفة', en: 'Cheerful, likes energy and lightness' },
  aquatic: { ar: 'بيحب الهدوء والحرية والصيف', en: 'Likes calm, freedom and summer' },
  fruity: { ar: 'مرح وشبابي', en: 'Playful and youthful' },
  gourmand: { ar: 'بيدوّر على الدفء والحلاوة والراحة', en: 'Seeks warmth, sweetness and comfort' },
  musk: { ar: 'بيحب النظافة والقرب والنعومة', en: 'Likes clean, close, soft scents' },
  spicy: { ar: 'جريء وبيحب التميّز', en: 'Bold, likes to stand out' },
  leather: { ar: 'جريء وواثق وبيحب الطابع الكلاسيكي', en: 'Bold, confident, classic' },
  powdery: { ar: 'بيحب الأناقة الهادية والحنين', en: 'Likes quiet elegance and nostalgia' },
};

export type DecisionStyle = 'new' | 'explorer' | 'decisive' | 'deliberate' | 'hesitant' | 'buyer';
export type PriceComfort = 'unknown' | 'budget' | 'mid' | 'premium';
export type Rhythm = 'unknown' | 'morning' | 'afternoon' | 'evening' | 'night';
export interface PersonReading {
  communication: { style: BuyerStyle; label: Text; how: Text };
  decision: DecisionStyle; price: PriceComfort; priceSensitive: boolean; averagePrice?: number;
  motive?: BuyerMotive; temperament: Text[]; families: { id: string; label: Text; share: number }[];
  loyalty: 'new' | 'returning' | 'loyal'; rhythm: Rhythm; connoisseur: boolean;
  approach: Text[]; confidence: 'low' | 'medium' | 'high';
}

export const DECISION_TEXT: Record<DecisionStyle, Text> = {
  new: { ar: 'جديد — لسه بيتعرف على المنصة', en: 'New — still getting to know the platform' },
  explorer: { ar: 'مستكشف — بيتفرج على أنواع كتير', en: 'Explorer — browses many kinds' },
  decisive: { ar: 'حاسم — بيقرر بسرعة', en: 'Decisive — decides quickly' },
  deliberate: { ar: 'متأني — بيرجع لنفس المنتجات قبل ما يقرر', en: 'Deliberate — returns to the same products before deciding' },
  hesitant: { ar: 'متردد — بيحط في السلة ومابيكملش', en: 'Hesitant — adds to cart but does not finish' },
  buyer: { ar: 'عميل — اشترى فعلاً', en: 'Customer — has bought' },
};
export const PRICE_TEXT: Record<PriceComfort, Text> = {
  unknown: { ar: 'مش معروف لسه', en: 'Unknown yet' }, budget: { ar: 'اقتصادي', en: 'Budget' }, mid: { ar: 'متوسط', en: 'Mid-range' }, premium: { ar: 'فاخر', en: 'Premium' },
};
export const RHYTHM_TEXT: Record<Rhythm, Text> = {
  unknown: { ar: 'مش معروف', en: 'Unknown' }, morning: { ar: 'الصبح', en: 'Morning' }, afternoon: { ar: 'الضهر', en: 'Afternoon' }, evening: { ar: 'بالليل', en: 'Evening' }, night: { ar: 'آخر الليل', en: 'Late night' },
};

/** Catalog price quartiles (EGP) — the yardstick for «اقتصادي / متوسط / فاخر». */
export function priceYardstick(products: Pick<StoreProduct, 'price'>[]): { low: number; high: number } {
  const prices = products.map((p) => p.price).filter((n) => n > 0).sort((a, b) => a - b);
  if (!prices.length) return { low: 0, high: 0 };
  return { low: prices[Math.floor(prices.length * 0.25)], high: prices[Math.floor(prices.length * 0.75)] };
}

/** A behavioural reading of one person — for serving him better, never a diagnosis. */
export function readPerson(p: InsightProfile, yardstick: { low: number; high: number }): PersonReading {
  const style = (top(p.styles) as BuyerStyle | undefined) || 'friendly';
  const views = p.funnel.products;
  const distinct = Object.keys(p.products).length;
  const repeats = Object.values(p.products).filter((n) => n >= 3).length;
  const decision: DecisionStyle = p.funnel.purchases > 0 ? 'buyer'
    : p.funnel.carts > 0 && p.funnel.checkouts === 0 && p.days.length >= 2 ? 'hesitant'
      : p.funnel.carts > 0 && views <= 3 ? 'decisive'
        : repeats >= 2 ? 'deliberate'
          : distinct >= 6 || Object.keys(p.families).length >= 5 ? 'explorer'
            : 'new';
  const averagePrice = p.price.n ? Math.round(p.price.sum / p.price.n) : undefined;
  const price: PriceComfort = !averagePrice || !yardstick.high ? 'unknown' : averagePrice <= yardstick.low ? 'budget' : averagePrice >= yardstick.high ? 'premium' : 'mid';
  const famTotal = total(p.families);
  const families = topN(p.families, 3).map(([id, n]) => ({ id, label: FAMILY_LABEL[id as Family] || { ar: id, en: id }, share: famTotal ? Math.round((n / famTotal) * 100) : 0 }));
  const temperament = families.flatMap((f) => (TEMPER[f.id as Family] ? [TEMPER[f.id as Family]!] : [])).slice(0, 2);
  const loyalty = p.days.length >= 5 ? 'loyal' : p.days.length >= 2 ? 'returning' : 'new';
  const h = p.hours.map((n, i) => [i, n] as const).sort((a, b) => b[1] - a[1])[0];
  const rhythm: Rhythm = !h || !h[1] ? 'unknown' : h[0] >= 5 && h[0] < 12 ? 'morning' : h[0] >= 12 && h[0] < 17 ? 'afternoon' : h[0] >= 17 && h[0] < 23 ? 'evening' : 'night';
  const motive = top(p.motives) as BuyerMotive | undefined;
  const priceSensitive = p.flags.budget > 0;
  const approach: Text[] = [STYLE_TEXT[style].how];
  if (decision === 'hesitant') approach.push({ ar: 'فكّره بالسلة مرة واحدة بلطف، ووضّح الإرجاع والشحن — من غير خصم مخترع.', en: 'Remind him of the cart once, gently, with returns and shipping clear — no invented discount.' });
  if (decision === 'explorer') approach.push({ ar: 'اعرض مقارنة قصيرة بين اختيارين من العائلة اللي بيرجع لها.', en: 'Offer a short comparison of two picks from the family he returns to.' });
  if (decision === 'deliberate') approach.push({ ar: 'ابعتله تفاصيل المنتج اللي بيرجع له (الثبات والمكونات والمراجعات الحقيقية).', en: 'Send the details of the product he returns to (longevity, notes, real reviews).' });
  if (motive === 'gift') approach.push({ ar: 'ساعده في الهدية: لمين والمناسبة، واقترح تغليف لو متاح.', en: 'Help with the gift: for whom and which occasion; suggest wrapping if available.' });
  if (price === 'premium') approach.push({ ar: 'احكي الحرفة والمكونات النادرة بدل السعر.', en: 'Tell the craft and rare ingredients rather than the price.' });
  if (price === 'budget' || priceSensitive) approach.push({ ar: 'ابدأ بأحسن قيمة في ميزانيته وقول السعر بوضوح.', en: 'Lead with the best value in his budget and state the price clearly.' });
  const confidence = p.events >= 40 ? 'high' : p.events >= 12 ? 'medium' : 'low';
  return {
    communication: { style, label: STYLE_TEXT[style].label, how: STYLE_TEXT[style].how }, decision, price, priceSensitive,
    ...(averagePrice ? { averagePrice } : {}), ...(motive ? { motive } : {}), temperament, families, loyalty, rhythm,
    connoisseur: p.flags.connoisseur > 0, approach: approach.slice(0, 4), confidence,
  };
}

// ── Reading a country ───────────────────────────────────────────────────────────────────────────────────────────
export interface CountryCulture {
  country: string; visitors: number; returning: number; customers: number;
  families: { id: string; label: Text; share: number }[]; genders: Counter; price: Record<PriceComfort, number>; averagePrice?: number;
  giftShare: number; styles: Counter; decisions: Counter; rhythm: Counter; languages: Counter; devices: Counter;
  funnel: { products: number; carts: number; checkouts: number; purchases: number };
  words: { word: string; n: number }[]; insights: Text[];
}

const STOP = new Set(['عايز', 'عاوز', 'عايزة', 'ممكن', 'محتاج', 'انا', 'أنا', 'في', 'من', 'على', 'عن', 'الى', 'إلى', 'ده', 'دي', 'اللي', 'ايه', 'إيه', 'عطر', 'عطور', 'the', 'and', 'for', 'with', 'want', 'perfume', 'perfumes', 'what', 'how', 'you', 'have', 'need', 'please', 'une', 'pour', 'des', 'les', 'parfum', '[رقم]', '[بريد]']);

export function countryCultures(profiles: InsightProfile[], yardstick: { low: number; high: number }): CountryCulture[] {
  const groups = new Map<string, InsightProfile[]>();
  for (const p of profiles) { const c = p.edgeCountry || p.country || '??'; groups.set(c, [...(groups.get(c) || []), p]); }
  return [...groups.entries()].map(([country, list]) => {
    const families: Counter = {}; const genders: Counter = {}; const styles: Counter = {}; const decisions: Counter = {}; const rhythm: Counter = {};
    const languages: Counter = {}; const devices: Counter = {}; const words: Counter = {};
    const price: Record<PriceComfort, number> = { unknown: 0, budget: 0, mid: 0, premium: 0 };
    const funnel = { products: 0, carts: 0, checkouts: 0, purchases: 0 };
    let priceSum = 0; let priceN = 0; let gifts = 0;
    for (const p of list) {
      const r = readPerson(p, yardstick);
      Object.entries(p.families).forEach(([k, n]) => bump(families, k, n));
      Object.entries(p.genders).forEach(([k, n]) => bump(genders, k, n));
      bump(styles, r.communication.style); bump(decisions, r.decision); bump(rhythm, r.rhythm); bump(languages, p.language); bump(devices, p.device);
      price[r.price] += 1;
      priceSum += p.price.sum; priceN += p.price.n;
      if (r.motive === 'gift' || (p.occasions.gift || 0) > 0) gifts += 1;
      funnel.products += p.funnel.products; funnel.carts += p.funnel.carts; funnel.checkouts += p.funnel.checkouts; funnel.purchases += p.funnel.purchases;
      for (const text of [...p.searches, ...p.chats]) {
        for (const w of text.toLowerCase().split(/[^\p{L}\p{N}[\]]+/u)) if (w.length >= 3 && !STOP.has(w)) words[w] = (words[w] || 0) + 1;
      }
    }
    const famTotal = total(families);
    const fam = topN(families, 5).map(([id, n]) => ({ id, label: FAMILY_LABEL[id as Family] || { ar: id, en: id }, share: famTotal ? Math.round((n / famTotal) * 100) : 0 }));
    const averagePrice = priceN ? Math.round(priceSum / priceN) : undefined;
    const giftShare = list.length ? Math.round((gifts / list.length) * 100) : 0;
    const insights: Text[] = [];
    if (fam[0]) insights.push({ ar: `الذوق الغالب: ${fam.slice(0, 3).map((f) => `${f.label.ar} ${f.share}%`).join('، ')}`, en: `Leading taste: ${fam.slice(0, 3).map((f) => `${f.label.en} ${f.share}%`).join(', ')}` });
    if (averagePrice) insights.push({ ar: `متوسط سعر اللي بيتفرجوا عليه: ${averagePrice} جنيه (${PRICE_TEXT[averagePrice <= yardstick.low ? 'budget' : averagePrice >= yardstick.high ? 'premium' : 'mid'].ar})`, en: `Average price viewed: EGP ${averagePrice} (${PRICE_TEXT[averagePrice <= yardstick.low ? 'budget' : averagePrice >= yardstick.high ? 'premium' : 'mid'].en})` });
    if (giftShare >= 20) insights.push({ ar: `ثقافة الهدايا قوية: ${giftShare}% بيدوروا على هدية`, en: `Strong gifting culture: ${giftShare}% look for gifts` });
    const s = top(styles) as BuyerStyle | undefined;
    if (s && s !== 'friendly') insights.push({ ar: `أسلوب الكلام الغالب: ${STYLE_TEXT[s].label.ar} — ${STYLE_TEXT[s].how.ar}`, en: `Prevailing style: ${STYLE_TEXT[s].label.en} — ${STYLE_TEXT[s].how.en}` });
    const peak = top(rhythm) as Rhythm | undefined;
    if (peak && peak !== 'unknown') insights.push({ ar: `أنشط وقت: ${RHYTHM_TEXT[peak].ar}`, en: `Most active: ${RHYTHM_TEXT[peak].en}` });
    if (funnel.carts && !funnel.checkouts) insights.push({ ar: 'بيحطوا في السلة ومابيكملوش الدفع — راجع طرق الدفع والشحن المتاحة للبلد ده', en: 'They add to cart but do not check out — review the payment and shipping options for this country' });
    return {
      country, visitors: list.length, returning: list.filter((p) => p.days.length >= 2).length, customers: list.filter((p) => p.funnel.purchases > 0).length,
      families: fam, genders, price, ...(averagePrice ? { averagePrice } : {}), giftShare, styles, decisions, rhythm, languages, devices, funnel,
      words: topN(words, 12).map(([word, n]) => ({ word, n })), insights,
    };
  }).sort((a, b) => b.visitors - a.visitors);
}

// ── The administration's summary ────────────────────────────────────────────────────────────────────────────────
export interface ProfileRow {
  id: string; accountId?: string; country?: string; language?: string; device?: string; lastSeen: string; days: number; events: number;
  decision: DecisionStyle; style: BuyerStyle; price: PriceComfort; topFamily?: string; purchases: number;
}
export interface InsightsSummary {
  generatedAt: string; profiles: number; members: number; returning: number; customers: number; events: number;
  funnel: { products: number; carts: number; checkouts: number; purchases: number };
  decisions: Counter; styles: Counter; prices: Counter; motives: Counter; families: { id: string; label: Text; share: number }[];
  countries: CountryCulture[]; recent: ProfileRow[];
}

export function profileRow(p: InsightProfile, yardstick: { low: number; high: number }): ProfileRow {
  const r = readPerson(p, yardstick);
  return {
    id: p.id, ...(p.accountId ? { accountId: p.accountId } : {}), ...(p.edgeCountry || p.country ? { country: p.edgeCountry || p.country } : {}),
    ...(p.language ? { language: p.language } : {}), ...(p.device ? { device: p.device } : {}), lastSeen: p.lastSeen, days: p.days.length, events: p.events,
    decision: r.decision, style: r.communication.style, price: r.price, ...(r.families[0] ? { topFamily: r.families[0].id } : {}), purchases: p.funnel.purchases,
  };
}

/** Profiles older than the retention period (the privacy policy's promise) — the server erases them. */
export const expired = (p: InsightProfile, now: Date) => now.getTime() - Date.parse(p.lastSeen) > INSIGHTS_RETENTION_DAYS * 86_400_000;

export function insightsSummary(profiles: InsightProfile[], products: Pick<StoreProduct, 'price'>[], now = new Date()): InsightsSummary {
  const yardstick = priceYardstick(products);
  const live = profiles.filter((p) => !expired(p, now));
  const decisions: Counter = {}; const styles: Counter = {}; const prices: Counter = {}; const motives: Counter = {}; const families: Counter = {};
  const funnel = { products: 0, carts: 0, checkouts: 0, purchases: 0 };
  let events = 0;
  for (const p of live) {
    const r = readPerson(p, yardstick);
    bump(decisions, r.decision); bump(styles, r.communication.style); bump(prices, r.price); bump(motives, r.motive);
    Object.entries(p.families).forEach(([k, n]) => bump(families, k, n));
    funnel.products += p.funnel.products; funnel.carts += p.funnel.carts; funnel.checkouts += p.funnel.checkouts; funnel.purchases += p.funnel.purchases;
    events += p.events;
  }
  const famTotal = total(families);
  return {
    generatedAt: now.toISOString(), profiles: live.length, members: live.filter((p) => p.accountId).length,
    returning: live.filter((p) => p.days.length >= 2).length, customers: live.filter((p) => p.funnel.purchases > 0).length, events, funnel,
    decisions, styles, prices, motives,
    families: topN(families, 8).map(([id, n]) => ({ id, label: FAMILY_LABEL[id as Family] || { ar: id, en: id }, share: famTotal ? Math.round((n / famTotal) * 100) : 0 })),
    countries: countryCultures(live, yardstick),
    recent: [...live].sort((a, b) => b.lastSeen.localeCompare(a.lastSeen)).slice(0, 60).map((p) => profileRow(p, yardstick)),
  };
}
