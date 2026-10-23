/**
 * «عقل شاهين الموصول» — the owner's complaint (2026-10-22): on his own, Shaheen «doesn't give logical answers, doesn't
 * connect the information, and doesn't give the store's perfumes». Three missing links, all fixed here:
 *
 *  1. The conversation: a follow-up («طب وللشتا؟»، «انهي فيهم أثبت؟»، «and for women?») is read with the question
 *     before it, instead of as a new question with no subject.
 *  2. The store: a shopping wish is answered from «متجر شام» itself — real products, their price, size, notes
 *     (top / heart / base), the season and occasion they suit and WHY each one fits — with the expert's reasoning
 *     for the direction (why warm perfumes suit winter…) and what the picks have in common.
 *  3. The designer: a formula he designs points to the ready perfumes of the store that share its notes.
 *
 * «وكيل شاهين» runs this on every question (src/utils/agentLink.ts: the direct link, under the State's eye).
 * Pure and browser-safe: the same answer on the server and in the visitor's browser; never an invented product,
 * price or note (only what the catalogue publishes).
 */
import { hasCriteria, parseWish, pickReasonLine, recommend, inferOccasions, inferSeasons, type Pick, type Wish } from './storeAdvisor';
import { FAMILY_LABEL, GENDER_LABEL, OCCASION_LABEL, SEASON_LABEL, concentrationAr, type Family, type Occasion, type Season, type StoreProduct } from './storeCatalog';
import { questionIntents } from './shaheenTools';
import { topicWords } from './shaheenLibrary';
import { greetingKind } from './shaheenGreeting';
import type { Design } from './shaheenDesigner';
import { cleanNote, noteAr, readableNotes } from './noteNames';
import { closeLine, readBuyer, type BuyerProfile } from './salesCraft';

export interface Turn { role: 'user' | 'assistant'; text: string }
type Lang = 'ar' | 'en';
const langOf = (language: string, text = ''): Lang => (/[\u0600-\u06FF]/.test(text) || ((language === 'ar' || language === 'fa') && !/[a-z]{3}/i.test(text)) ? 'ar' : 'en');

// ── 1. The conversation ─────────────────────────────────────────────────────────────────────────────────────────
export interface Context {
  /** The question as he works on it (a follow-up carries the subject of the question before it). */
  text: string;
  followUp: boolean;
  /** The visitor's question before this one, and Shaheen's reply to it. */
  previous?: string;
  lastReply?: string;
  /** Everything the visitor said in this conversation, oldest first, this message last — how the seller reads him. */
  said?: string[];
}

const LEAD_IN = /^(?:طب|طيب|طبعا|طيب و|طب و|ولو|وبالنسبة|بالنسبة|وماذا عن|وايه عن|وإيه عن|و|بس|يعني|what about|how about|and|also|so|ok(?:ay)?)(?=[\s،,]|$)[\s،,]*/i;
const ANAPHOR = /(?<![\u0600-\u06FF])(?:ده|دي|دا|دى|ديه|دول|هو|هي|هى|منه|منها|منهم|فيه|فيها|فيهم|بيه|بيها|عليه|عليها|انهي|أنهي|انهو|أنهو|ايهم|أيهم|ايهما|أيهما|التلاتة|الاتنين)(?![\u0600-\u06FF])|\b(?:it|that|this one|them|those|which one|these)\b/i;
const COPULA = /^(?:ايه|إيه|ايش|ما|مين|فين|إيش)\s+(?:هو|هي|هى|هما|هم)\s+(?=[\u0600-\u06FFa-z])/i;
const THANKS = /^(?:شكرا|شكراً|متشكر|تسلم|ميرسي|thanks?|thank you)[\s!.؟?]*$/i;

const lastOf = (history: Turn[], role: Turn['role']) => [...history].reverse().find((t) => t.role === role && t.text.trim())?.text;

/** Reads a message with the conversation before it. */
export function withContext(message: string, history: Turn[] = []): Context {
  const text = message.trim();
  const previous = lastOf(history, 'user');
  const lastReply = history[history.length - 1]?.role === 'assistant' ? history[history.length - 1].text : undefined;
  const said = [...history.filter((t) => t.role === 'user' && t.text.trim()).map((t) => t.text.trim()).slice(-5), text].filter(Boolean);
  const base: Context = { text, followUp: false, ...(previous ? { previous } : {}), ...(lastReply ? { lastReply } : {}), ...(said.length ? { said } : {}) };
  if (!previous || greetingKind(text) || THANKS.test(text) || greetingKind(previous)) return base;
  const own = topicWords(text.replace(LEAD_IN, ''));
  const lead = LEAD_IN.test(text);
  const short = text.length <= 60;
  // A full new question (its own subject, no lead-in, no «it/them») is a new topic.
  // «ايه هي الطاقة الشمسية» — «هي» there is the question's copula, not «it»; «طب وهي بتثبت؟» is «it».
  const anaphoric = ANAPHOR.test(text.replace(COPULA, ''));
  const follows = short && (lead || anaphoric || own.length <= 1);
  if (!follows) return base;
  const rest = text.replace(LEAD_IN, '').trim();
  // A shopping wish accumulates (the new criteria win: storeWish merges them); a knowledge question keeps its subject.
  if (wantsStore(previous)) return { ...base, followUp: true, text: `${previous} ${rest}` };
  const subject = topicWords(previous).filter((w) => !own.includes(w)).slice(0, 4).join(' ');
  return { ...base, followUp: true, text: subject ? `${rest} ${subject}`.trim() : rest };
}

// ── 2. The store ────────────────────────────────────────────────────────────────────────────────────────────────
const PERFUME = /عطر|عطور|برفان|بارفان|برفيوم|ريحة|ريحه|رائحة|perfume|fragrance|scent|cologne/i;
const BEST = /(?:احسن|أحسن|افضل|أفضل|انسب|أنسب|ارخص|أرخص|اثبت|أثبت|اجمل|أجمل)\s+(?:\S+\s+){0,1}(?:عطر|عطور|برفان|برفيوم|ريحة)|\b(?:best|cheapest|nicest)\s+(?:\w+\s+)?(?:perfume|fragrance|scent)/i;
const PRICE = /بكام|سعر|اسعار|أسعار|\bprice\b|how much/i;
const DESIGN_OR_LAB = /صمم|صمّم|تصميم|تركيب[ةه]|ركب|خلط[ةه]|وصف[ةه]|نسب[ةه]?|نسبة|تخفيف|اعمل(?:لي| لي)? عطر|اصنع|formula|recipe|ratio|dilut|blend|make my own/i;
const NOTES_ASKED = /نوتات|نوته|نوتة|مكونات|اكورد|أكورد|\bnotes?\b|\baccords?\b/i;
const WANT = /(?:عايز|عايزة|عاوز|عاوزة|محتاج|محتاجة|ابغى|أبغى|اريد|أريد|بدور|ادور|أدور|دورلي|رشح|رشّح|انصحني|تنصحني|نفسي في)|\b(?:looking for|i want|i need|recommend|suggest)\b/i;
const KNOWLEDGE = /^(?:ما|ماهو|ما هو|ما هي|ايه هو|إيه هو|ايه هي|إيه هي|يعني ايه|ليه|لماذا|ازاي|إزاي|كيف|what is|what are|why|how (?:do|does|is))(?=[\s؟?]|$)/i;

/** Does the visitor want a ready perfume from the store (not a formula, not a lesson)? */
export function wantsStore(text: string): boolean {
  const t = text.trim();
  if (!t || DESIGN_OR_LAB.test(t) || NOTES_ASKED.test(t)) return false;
  if (questionIntents(t).includes('store') || BEST.test(t)) return true;
  if (PRICE.test(t) && PERFUME.test(t)) return true;
  // «محتاج عطر رجالي شتوي» / «عطر للشتا تحت 3000» — a perfume wished for with criteria, not a question about perfumery.
  const wish = parseWish(t);
  return PERFUME.test(t) && !KNOWLEDGE.test(t) && hasCriteria(wish) && (WANT.test(t) || wish.budgetMax !== undefined || wish.budgetMin !== undefined);
}

/** The wish of a conversation: the newest message's criteria win over the earlier ones («خليه للشتا» drops summer). */
export function storeWish(ctx: Context): Wish {
  if (!ctx.followUp || !ctx.previous) return parseWish(ctx.text);
  const before = parseWish(ctx.previous);
  const now = parseWish(ctx.text.slice(ctx.previous.length));
  return {
    gender: now.gender ?? before.gender,
    families: now.families.length ? [...new Set([...now.families, ...before.families])] : before.families,
    seasons: now.seasons.length ? now.seasons : before.seasons,
    occasions: now.occasions.length ? now.occasions : before.occasions,
    budgetMax: now.budgetMax ?? before.budgetMax, budgetMin: now.budgetMin ?? before.budgetMin,
    cheap: now.cheap || (before.cheap && !now.luxury), luxury: now.luxury || (before.luxury && !now.cheap),
    brands: now.brands.length ? now.brands : before.brands,
    words: [...new Set([...now.words, ...before.words])].slice(0, 12),
  };
}

const noteName = (note: string, lang: Lang) => (lang === 'ar' ? noteAr(note) || note.trim() : cleanNote(note));

/** Base notes that make a perfume last (the reason one perfume outlasts another). */
const FIXATIVE = /musk|amber|oud|agarwood|patchouli|sandalwood|vanilla|tonka|leather|ambroxan|benzoin|labdanum|vetiver|incense|frankincense|olibanum|myrrh|cashmeran|guaiac|resin|ambergris/i;
const FRESH_NOTE = /bergamot|lemon|lime|grapefruit|mandarin|orange|citrus|marine|mint|neroli|tangerine/i;
/** A rough, explainable staying power: the concentration, the published longevity and the fixatives in the base. */
export function staying(p: StoreProduct): number {
  const c = p.concentration || '';
  let s = /extrait|^\s*parfum\s*$/i.test(c) ? 4 : /eau de parfum|\bedp\b/i.test(c) ? 3 : /toilette|\bedt\b/i.test(c) ? 2 : /cologne|mist|spray|deodorant/i.test(c) ? 1 : 2.5;
  const hours = /(\d+)\s*-\s*(\d+)\s*hours?/i.exec(p.longevity || '');
  if (hours) s += Number(hours[2]) >= 9 ? 1.5 : 1;
  s += Math.min(3, p.notes.base.filter((n) => FIXATIVE.test(n)).length) * 0.6;
  return s;
}

const WHY_SEASON: Record<Exclude<Season, 'all'>, Record<Lang, string>> = {
  winter: { ar: 'في البرد الريحة بتتبخر أبطأ، فالعطور الدافية والتقيلة (عود، عنبر، فانيليا، توابل) بتبان وتثبت أكتر، والمنعشة الخفيفة بتختفي بسرعة.', en: 'Cold air slows evaporation, so warm, rich perfumes (oud, amber, vanilla, spices) project and last longer; light fresh ones fade fast.' },
  summer: { ar: 'في الحر الريحة بتفوح بسرعة وبتتقل، فالأنسب الحمضيات والمنعش والبحري والمسك النظيف؛ التقيلة ممكن تخنق.', en: 'Heat makes a scent bloom fast and feel heavy, so citrus, fresh, marine and clean musks suit it best; heavy ones can cloy.' },
  spring: { ar: 'الربيع بيناسبه الزهري والفواكه الخفيفة والمسك الناعم.', en: 'Spring suits florals, light fruits and soft musks.' },
  autumn: { ar: 'الخريف بيناسبه الخشبي والتوابل الخفيفة والعنبر الناعم.', en: 'Autumn suits woods, soft spices and gentle amber.' },
};
const WHY_OCCASION: Record<Occasion, Record<Lang, string>> = {
  evening: { ar: 'السهرة محتاجة فوحان أعلى وقاعدة دافية (عنبر، عود، فانيليا) لأنها بتبان أكتر بالليل وفي الأماكن المقفولة.', en: 'An evening wants more projection and a warm base (amber, oud, vanilla): they show best at night and indoors.' },
  work: { ar: 'للشغل والمكتب الأفضل عطر هادي ونظيف (مسك، حمضيات، خشبي خفيف) مايضايقش اللي حواليك.', en: 'For work, a calm clean scent (musk, citrus, light woods) that does not bother the people around you.' },
  daily: { ar: 'لليومي الأفضل عطر متوازن مش تقيل، ينفع الصبح وبالليل.', en: 'For every day, a balanced scent that is not heavy and works morning and night.' },
  gift: { ar: 'في الهدية الأضمن عطر محبوب عند أغلب الناس ومن ماركة معروفة، ومش متطرف في طابعه.', en: 'For a gift, the safest is a crowd-pleaser from a known house, not an extreme style.' },
  special: { ar: 'للمناسبات الخاصة الأفضل عطر مميز وفخم وثباته عالي.', en: 'For a special occasion, something distinctive, rich and long-lasting.' },
};
const WHY_FAMILY: Partial<Record<Family, Record<Lang, string>>> = {
  oud: { ar: 'العود قاعدة تقيلة ثباتها عالي جداً وبيدّي فخامة شرقية.', en: 'Oud is a heavy base with very high staying power and an oriental richness.' },
  amber: { ar: 'العنبر دافي وحلو شوية ومن أقوى المثبتات.', en: 'Amber is warm, slightly sweet and one of the strongest fixatives.' },
  musk: { ar: 'المسك ناعم ونظيف وبيطوّل عمر الريحة على الجلد.', en: 'Musk is soft and clean and makes a scent last on skin.' },
  fresh: { ar: 'المنعش بيفتح بسرعة ويدّي انتعاش، بس ثباته أقل، فالأحسن تجدده خلال اليوم.', en: 'Fresh scents open fast and lift, but last less — refresh during the day.' },
  citrus: { ar: 'الحمضيات مبهجة وخفيفة بس بتطير بسرعة؛ لو معاها مسك أو خشب بتثبت أكتر.', en: 'Citrus is bright and light but fleeting; with musk or woods it lasts longer.' },
  woody: { ar: 'الخشبي (صندل، أرز، فيتيفر) متوازن وراقي وينفع أغلب الأوقات.', en: 'Woods (sandalwood, cedar, vetiver) are balanced, refined and fit most moments.' },
  floral: { ar: 'الزهري (ورد، ياسمين) رقيق ومحبوب وبيناسب النهار والمناسبات.', en: 'Florals (rose, jasmine) are tender, loved and suit daytime and occasions.' },
  gourmand: { ar: 'الحلو (فانيليا، كراميل) دافي وجذاب وبيثبت كويس في البرد.', en: 'Gourmands (vanilla, caramel) are warm, inviting and last well in the cold.' },
  spicy: { ar: 'التوابل (زعفران، هيل، فلفل) بتدّي دفا وشخصية.', en: 'Spices (saffron, cardamom, pepper) add warmth and character.' },
  aquatic: { ar: 'البحري خفيف ومنعش ومناسب للحر.', en: 'Aquatic scents are light, fresh and made for heat.' },
  oriental: { ar: 'الشرقي غني ودافي (عود، ورد، عنبر، توابل) وبيبان في السهرات والبرد.', en: 'Orientals are rich and warm (oud, rose, amber, spice) and shine in evenings and cold.' },
  leather: { ar: 'الجلد ناشف وجريء وبيدّي شخصية قوية.', en: 'Leather is dry, bold and gives strong character.' },
  fruity: { ar: 'الفواكه مبهجة وشبابية، أغلبها في الافتتاحية.', en: 'Fruits are cheerful and youthful, mostly in the opening.' },
  powdery: { ar: 'البودري (سوسن، بنفسج) ناعم وأنيق وهادي.', en: 'Powdery notes (iris, violet) are soft, elegant and calm.' },
};

/** «فهمت طلبك»: the wish in plain words, so a wrong reading is visible. */
function wishLine(w: Wish, lang: Lang): string {
  const parts = [
    ...(w.gender ? [GENDER_LABEL[w.gender][lang]] : []),
    ...w.families.map((f) => (lang === 'ar' ? `طابع ${FAMILY_LABEL[f].ar}` : `${FAMILY_LABEL[f].en} style`)),
    ...w.seasons.map((s) => (lang === 'ar' ? `للموسم ${SEASON_LABEL[s].ar}` : `for ${SEASON_LABEL[s].en.toLowerCase()}`)),
    ...w.occasions.map((o) => (lang === 'ar' ? `لـ${OCCASION_LABEL[o].ar}` : `for ${OCCASION_LABEL[o].en.toLowerCase()}`)),
    ...w.brands.map((b) => (lang === 'ar' ? `من ${b}` : `by ${b}`)),
    ...(w.budgetMax ? [lang === 'ar' ? `في حدود ${w.budgetMax} جنيه` : `up to EGP ${w.budgetMax}`] : []),
    ...(w.budgetMin ? [lang === 'ar' ? `فوق ${w.budgetMin} جنيه` : `over EGP ${w.budgetMin}`] : []),
    ...(w.cheap ? [lang === 'ar' ? 'سعر اقتصادي' : 'budget-friendly'] : []), ...(w.luxury ? [lang === 'ar' ? 'فخم' : 'luxury'] : []),
  ];
  return parts.join(' · ');
}

/** The expert's reasoning for the direction asked (season, occasion, families): at most three lines. */
function whyLines(w: Wish, lang: Lang): string[] {
  const lines = [
    ...w.seasons.filter((s): s is Exclude<Season, 'all'> => s !== 'all').map((s) => WHY_SEASON[s][lang]),
    ...w.occasions.map((o) => WHY_OCCASION[o][lang]),
    ...w.families.map((f) => WHY_FAMILY[f]?.[lang]).filter((x): x is string => Boolean(x)),
  ];
  // A wish that pulls two ways (oud for summer, citrus for winter): the expert says how to make it work.
  const heavy = w.families.some((f) => ['oud', 'amber', 'gourmand', 'oriental', 'spicy', 'leather'].includes(f));
  const light = w.families.some((f) => ['fresh', 'citrus', 'aquatic'].includes(f));
  if (heavy && w.seasons.includes('summer')) lines.unshift(lang === 'ar' ? 'الروايح التقيلة في الصيف تنفع بكمية قليلة أو بالليل، والأحسن نسخة أخف فيها حمضيات أو مسك نظيف.' : 'Heavy scents work in summer in small doses or at night; better a lighter take with citrus or clean musk.');
  if (light && w.seasons.includes('winter')) lines.unshift(lang === 'ar' ? 'المنعش في الشتا بيختفي بسرعة، فاختار واحد قاعدته فيها خشب أو مسك علشان يثبت.' : 'Fresh scents fade fast in winter — pick one with a woody or musky base so it lasts.');
  return [...new Set(lines)].slice(0, 3);
}

export const money = (n: number, lang: Lang) => (lang === 'ar' ? `${Math.round(n).toLocaleString('en-US')} جنيه` : `EGP ${Math.round(n).toLocaleString('en-US')}`);
export const nameOf = (p: StoreProduct, lang: Lang) => ((lang === 'ar' ? p.name.ar : p.name.en) || p.name.en || p.name.ar).replace(/[[\]*]/g, '');
const listNotes = (notes: string[], lang: Lang, max = 4) => readableNotes(notes, lang, max).join(lang === 'ar' ? '، ' : ', ');

/** One product as a few lines: link, price, size, concentration, notes by layer, what it suits and why it was picked. */
function productBlock(p: StoreProduct, i: number, lang: Lang, link: (slug: string) => string | undefined, why?: string): string {
  const url = link(p.slug);
  const title = url ? `[${nameOf(p, lang)}](${url})` : `**${nameOf(p, lang)}**`;
  const facts = [p.price > 0 ? money(p.price, lang) : '', p.sizeMl ? (lang === 'ar' ? `${p.sizeMl} مل` : `${p.sizeMl} ml`) : '',
    p.concentration ? (lang === 'ar' ? concentrationAr(p.concentration) || p.concentration : p.concentration) : '',
    p.inStock ? '' : (lang === 'ar' ? 'غير متوفر حالياً' : 'out of stock')].filter(Boolean).join(' · ');
  const lines = [`${i}. ${title}${facts ? ` — ${facts}` : ''}`];
  // Cleaned and translated: «Musky SUPREMACY PURPLE» is an import artefact, never read aloud to a customer.
  const [top, heart, base] = [p.notes.top, p.notes.heart, p.notes.base].map((l) => (readableNotes(l, lang).length ? l : []));
  if (top.length || heart.length || base.length) {
    const layers = lang === 'ar'
      ? [top.length ? `الافتتاحية: ${listNotes(top, lang)}` : '', heart.length ? `القلب: ${listNotes(heart, lang)}` : '', base.length ? `القاعدة: ${listNotes(base, lang)}` : '']
      : [top.length ? `top: ${listNotes(top, lang)}` : '', heart.length ? `heart: ${listNotes(heart, lang)}` : '', base.length ? `base: ${listNotes(base, lang)}` : ''];
    lines.push(`   - ${lang === 'ar' ? 'المكونات' : 'Notes'}: ${layers.filter(Boolean).join(' · ')}`);
  }
  const suits = [...inferSeasons(p).map((s) => SEASON_LABEL[s][lang]), ...inferOccasions(p).map((o) => OCCASION_LABEL[o][lang])];
  const fam = p.families.slice(0, 3).map((f) => FAMILY_LABEL[f][lang]);
  const about = [fam.length ? `${lang === 'ar' ? 'الطابع' : 'Style'}: ${fam.join(lang === 'ar' ? '، ' : ', ')}` : '', suits.length ? `${lang === 'ar' ? 'يناسب' : 'Suits'}: ${[...new Set(suits)].join(lang === 'ar' ? '، ' : ', ')}` : ''].filter(Boolean);
  if (about.length) lines.push(`   - ${about.join(' · ')}`);
  if (why) lines.push(`   - ${lang === 'ar' ? 'ليه اخترته' : 'Why'}: ${why}`);
  return lines.join('\n');
}

/** What the picks have in common, and what it means (the link between them). */
function connection(products: StoreProduct[], lang: Lang): string | undefined {
  if (products.length < 2) return undefined;
  const counts = new Map<string, number>();
  for (const p of products) for (const n of new Set(p.notes.base.map((x) => x.trim().toLowerCase()))) counts.set(n, (counts.get(n) || 0) + 1);
  const shared = [...counts].filter(([, c]) => c >= 2).sort((a, b) => b[1] - a[1]).map(([n]) => n);
  const fix = shared.filter((n) => FIXATIVE.test(n)).slice(0, 3);
  const longest = [...products].sort((a, b) => staying(b) - staying(a))[0];
  const cheapest = [...products].filter((p) => p.price > 0).sort((a, b) => a.price - b.price)[0];
  const parts: string[] = [];
  if (fix.length) parts.push(lang === 'ar' ? `أغلبهم قاعدتهم فيها ${fix.map((n) => noteName(n, lang)).join(' و')}، ودي مثبتات، فثباتهم كويس.` : `Most share ${fix.join(', ')} in the base — fixatives, so they last well.`);
  if (longest) parts.push(lang === 'ar' ? `الأثبت فيهم غالباً «${nameOf(longest, lang)}» (تركيزه وقاعدته أتقل).` : `The longest-lasting is likely “${nameOf(longest, lang)}” (stronger concentration and base).`);
  if (cheapest && cheapest !== longest) parts.push(lang === 'ar' ? `والأوفر «${nameOf(cheapest, lang)}» بـ${money(cheapest.price, lang)}.` : `The best value is “${nameOf(cheapest, lang)}” at ${money(cheapest.price, lang)}.`);
  return parts.length ? parts.join(' ') : undefined;
}

const PRICE_NOTE: Record<Lang, string> = {
  ar: '_بنشحن لأي دولة في العالم 🌍 — الأسعار هنا بعملة بلدك، وتكلفة الشحن لبلدك بتظهر في صفحة الدفع._',
  en: '_We ship to any country in the world 🌍 — prices here are in your local currency, and shipping to your country shows at checkout._',
};
/**
 * «التاجر الشاطر»: one clear next step, said the way this buyer listens (src/utils/salesCraft.ts closeLine) — never a
 * menu that plants the objections («لو السعر مش مريحك قولّي غالي…», the owner's complaint of 2026-10-23). The seller
 * still answers «غالي» and «مش متأكد» when the visitor says them (src/utils/shaheenSeller.ts). No pressure, no
 * invented offer.
 */
export function nextStep(main: StoreProduct | undefined, lang: Lang, buyer?: BuyerProfile, alt?: StoreProduct): string {
  if (!main) return PRICE_NOTE[lang];
  const close = closeLine({ name: nameOf(main, lang), buyer: buyer || readBuyer([]), lang, ...(alt ? { alt: nameOf(alt, lang) } : {}) });
  return `${lang === 'ar' ? '**الخطوة الجاية:**' : '**Next step:**'} ${close}\n\n${PRICE_NOTE[lang]}`;
}

/** An alternative in one line (the main pick gets the full card): link, price, size and why it's here. */
function altLine(p: StoreProduct, i: number, lang: Lang, link: (slug: string) => string | undefined, why?: string): string {
  const url = link(p.slug);
  const title = url ? `[${nameOf(p, lang)}](${url})` : `**${nameOf(p, lang)}**`;
  const facts = [p.price > 0 ? money(p.price, lang) : '', p.sizeMl ? (lang === 'ar' ? `${p.sizeMl} مل` : `${p.sizeMl} ml`) : '', p.inStock ? '' : (lang === 'ar' ? 'غير متوفر حالياً' : 'out of stock')].filter(Boolean).join(' · ');
  return `${i}. ${title}${facts ? ` — ${facts}` : ''}${why ? `\n   - ${lang === 'ar' ? 'ليه ممكن يناسبك' : 'Why it may suit you'}: ${why}` : ''}`;
}
const ASK_MORE: Record<Lang, string> = {
  ar: 'عشان أرشحلك صح من غير تخمين، قولّي: **لمين** (رجالي/نسائي/للجنسين)؟ **لإمتى** (صيف/شتا/سهرة/شغل)؟ **الطابع** (عود، منعش، حلو، زهري…)؟ و**الميزانية**؟',
  en: 'To recommend without guessing, tell me: **for whom** (men/women/unisex)? **when** (summer/winter/evening/work)? **style** (oud, fresh, sweet, floral…)? and **budget**?',
};

/** «فيهم / منهم / انهي / which one» — about the perfumes just shown. */
const AMONG = /(?<![\u0600-\u06FF])(?:فيهم|منهم|انهي|أنهي|انهو|أنهو|ايهم|أيهم|ايهما|أيهما|التلاتة|الاتنين|دول)(?![\u0600-\u06FF])|\b(?:which one|of them|of these|among them)\b/i;
const COMPARATIVE = /(?<![\u0600-\u06FF])(?:اثبت|أثبت|ارخص|أرخص|اوفر|أوفر|اغلى|أغلى|افخم|أفخم)(?![\u0600-\u06FF])|\b(?:longest|cheapest|most expensive)\b/i;

export interface StoreAnswer { reply: string; picks: StoreProduct[]; matched: boolean }

/** «متجر شام» answering a wish: real products with the expert's reasoning, or an honest question back. */
export function storeAnswer(products: StoreProduct[], ctx: Context, language: string, link: (slug: string) => string | undefined): StoreAnswer | undefined {
  if (!products.length) return undefined;
  const lang = langOf(language, ctx.text);
  const wish = storeWish(ctx);
  // A follow-up about the perfumes just shown («انهي فيهم أثبت؟») is answered about them.
  // («وللصيف؟» is a new wish — the season changes — not a question about the perfumes shown.)
  const asked = ctx.followUp && ctx.previous ? ctx.text.slice(ctx.previous.length) : ctx.text;
  const about = ctx.followUp && ctx.lastReply && (AMONG.test(asked) || COMPARATIVE.test(asked)) ? shownIn(ctx.lastReply, products) : [];
  if (about.length >= 2) {
    const followed = comparePicks(about, asked, lang, link);
    if (followed) return followed;
  }
  const criteria = hasCriteria(wish);
  const { picks, matched } = recommend(products, ctx.text, 3, wish);
  const inStock = picks.filter((p) => p.product.inStock);
  const shown: Pick[] = (inStock.length ? inStock : picks).slice(0, 3);
  if (!shown.length) return undefined;
  const out: string[] = [];
  if (!criteria) {
    out.push(ASK_MORE[lang], '', lang === 'ar' ? '**ولحد ما تقولّي، دول من الأعلى تقييماً في المتجر:**' : '**Meanwhile, top-rated in the store:**');
  } else {
    out.push(`${lang === 'ar' ? '**فهمت طلبك:**' : '**Your request:**'} ${wishLine(wish, lang)}`);
    const why = whyLines(wish, lang);
    if (why.length) out.push('', `${lang === 'ar' ? '**ليه الاتجاه ده؟**' : '**Why this direction?**'}`, ...why.map((l) => `- ${l}`));
    out.push('', matched ? (lang === 'ar' ? '**اختياري الأول ليك من متجر شام:**' : '**My first pick for you from the Sham store:**')
      : (lang === 'ar' ? '**مالقيتش حاجة مطابقة بالظبط، ودي الأقرب لطلبك:**' : '**Nothing matches exactly; this is the closest:**'));
  }
  // One main pick with its full card (the focus), at most two alternatives in a line each — no wall of products.
  const [first, ...rest] = shown;
  out.push(productBlock(first.product, 1, lang, link, criteria ? pickReasonLine(first, lang) : undefined));
  if (rest.length) {
    out.push('', lang === 'ar' ? '**ولو حابب تقارن، بديلين:**' : '**If you want to compare, two alternatives:**');
    rest.forEach((p, i) => out.push(altLine(p.product, i + 2, lang, link, criteria ? pickReasonLine(p, lang) : undefined)));
  }
  const link2 = connection(shown.map((p) => p.product), lang);
  if (link2) out.push('', `${lang === 'ar' ? '**الربط بينهم:**' : '**How they compare:**'} ${link2}`);
  out.push('', nextStep(first.product, lang, readBuyer(ctx.said || [ctx.text])));
  return { reply: out.join('\n'), picks: shown.map((p) => p.product), matched: criteria && matched };
}

/** The store products a previous reply showed (by their page link or their name). */
export function shownIn(reply: string, products: StoreProduct[]): StoreProduct[] {
  const slugs = new Set([...reply.matchAll(/\/p\/([a-z0-9-]+)\.html/g)].map((m) => m[1]));
  const names = [...reply.matchAll(/\[([^\]]{3,})\]\(|\*\*([^*]{3,})\*\*/g)].map((m) => (m[1] || m[2]).trim());
  return products.filter((p) => slugs.has(p.slug) || names.includes(nameOf(p, 'ar')) || names.includes(nameOf(p, 'en'))).slice(0, 6);
}

/** «انهي فيهم أثبت / أرخص / أنسب للشتا؟» about the perfumes just shown. */
function comparePicks(products: StoreProduct[], question: string, lang: Lang, link: (slug: string) => string | undefined): StoreAnswer | undefined {
  const q = question.toLowerCase();
  let ranked: StoreProduct[] | undefined; let head = ''; let reason: (p: StoreProduct) => string = () => '';
  if (/اثبت|أثبت|ثبات|يثبت|يدوم|longest|last|longevity/i.test(q)) {
    ranked = [...products].sort((a, b) => staying(b) - staying(a));
    head = lang === 'ar' ? 'بالترتيب من الأثبت للأخف:' : 'From longest-lasting to lightest:';
    reason = (p) => {
      const fx = p.notes.base.filter((n) => FIXATIVE.test(n)).slice(0, 3).map((n) => noteName(n, lang));
      const conc = p.concentration ? (lang === 'ar' ? concentrationAr(p.concentration) || p.concentration : p.concentration) : '';
      return lang === 'ar' ? [conc ? `تركيزه ${conc}` : '', p.longevity ? `الثبات المنشور: ${p.longevity}` : '', fx.length ? `قاعدته فيها ${fx.join(' و')}` : 'قاعدته أخف'].filter(Boolean).join('، ')
        : [conc, p.longevity || '', fx.length ? `base of ${fx.join(', ')}` : 'lighter base'].filter(Boolean).join(', ');
    };
  } else if (/ارخص|أرخص|اوفر|أوفر|cheap|price|سعر/i.test(q)) {
    ranked = [...products].filter((p) => p.price > 0).sort((a, b) => a.price - b.price);
    head = lang === 'ar' ? 'بالترتيب من الأوفر للأغلى:' : 'From best value to priciest:';
    reason = (p) => money(p.price, lang);
  } else if (/اغلى|أغلى|افخم|أفخم|luxur|expensive/i.test(q)) {
    ranked = [...products].filter((p) => p.price > 0).sort((a, b) => b.price - a.price);
    head = lang === 'ar' ? 'بالترتيب من الأفخم:' : 'From the most luxurious:';
    reason = (p) => money(p.price, lang);
  } else {
    const w = parseWish(question);
    if (w.seasons.length || w.occasions.length || w.gender) {
      const scored = recommend(products, question, products.length, w).picks;
      if (!scored.length) return undefined;
      ranked = scored.map((s) => s.product);
      head = lang === 'ar' ? `بالترتيب حسب «${wishLine(w, lang)}»:` : `Ranked for “${wishLine(w, lang)}”:`;
      const why = new Map(scored.map((s) => [s.product.sku, pickReasonLine(s, lang)]));
      reason = (p) => why.get(p.sku) || (lang === 'ar' ? 'أقل مناسبة للطلب ده' : 'a weaker fit for this');
    }
  }
  if (!ranked?.length) return undefined;
  const lines = ranked.map((p, i) => `${i + 1}. ${link(p.slug) ? `[${nameOf(p, lang)}](${link(p.slug)})` : `**${nameOf(p, lang)}**`} — ${reason(p)}`);
  const pickLine = lang === 'ar' ? `**اختياري:** «${nameOf(ranked[0], lang)}».` : `**My pick:** “${nameOf(ranked[0], lang)}”.`;
  return { reply: [lang === 'ar' ? 'من اللي رشحتهملك:' : 'Of the ones I suggested:', head, ...lines, '', pickLine].join('\n'), picks: ranked, matched: true };
}

// ── 3. The designer and the store ───────────────────────────────────────────────────────────────────────────────
/** The catalogue's note words for each designer material. */
const MATERIAL_NOTE: Record<string, RegExp> = {
  bergamot: /bergamot/i, lemon: /lemon/i, mandarin: /mandarin|tangerine/i, grapefruit: /grapefruit/i, neroli: /neroli/i, lavender: /lavender/i,
  pink_pepper: /pink pepper/i, black_pepper: /black pepper/i, cardamom: /cardamom/i, saffron: /saffron/i, apple: /apple/i, calone: /marine|aquatic|sea/i,
  rose: /\brose\b/i, jasmine: /jasmine/i, orange_blossom: /orange blossom/i, hedione: /jasmine|hedione/i, iris: /iris|orris/i, violet: /violet/i,
  ylang: /ylang/i, geranium: /geranium/i, clary_sage: /sage/i, frankincense: /frankincense|olibanum|incense/i, cinnamon: /cinnamon/i, clove: /clove/i,
  coffee: /coffee/i, cashmeran: /cashmeran|cashmere/i, oud: /oud|agarwood/i, sandalwood: /sandalwood/i, cedar: /cedar/i, vetiver: /vetiver/i,
  patchouli: /patchouli/i, amber: /\bamber\b/i, vanilla: /vanilla/i, tonka: /tonka/i, musk: /musk/i, ambroxan: /ambrox|ambergris/i, iso_e: /iso e|woody notes/i,
  leather: /leather/i, tobacco: /tobacco/i, myrrh: /myrrh/i, moss: /moss/i,
};

/** Ready perfumes of the store that share the most notes with a designed formula. */
export function closeToDesign(products: StoreProduct[], design: Design, limit = 3): { product: StoreProduct; shared: string[] }[] {
  const wanted = design.notes.map((n) => ({ id: n.id, re: MATERIAL_NOTE[n.id] })).filter((x): x is { id: string; re: RegExp } => Boolean(x.re));
  const scored = products.filter((p) => p.inStock).map((p) => {
    const all = [...p.notes.top, ...p.notes.heart, ...p.notes.base];
    const shared = wanted.filter((w) => all.some((n) => w.re.test(n)));
    return { product: p, shared: shared.map((w) => w.id), score: shared.length + (FRESH_NOTE.test(all.join(' ')) && design.brief.fresh ? 0.3 : 0) };
  }).filter((x) => x.shared.length >= 2).sort((a, b) => b.score - a.score || a.product.price - b.product.price);
  return scored.slice(0, limit).map(({ product, shared }) => ({ product, shared }));
}

/** The lines added under a formula: «ولو عايز عطر جاهز قريب منها، من متجر شام: …». */
export function designStoreNote(products: StoreProduct[], design: Design, lang: Lang, link: (slug: string) => string | undefined): string {
  const close = closeToDesign(products, design);
  if (!close.length) return '';
  const names = new Map(design.notes.map((n) => [n.id, lang === 'ar' ? n.nameAr.replace(/\s*\(.*\)$/, '') : n.nameEn.replace(/\s*\(.*\)$/, '')]));
  const lines = close.map(({ product, shared }, i) => {
    const url = link(product.slug);
    return `${i + 1}. ${url ? `[${nameOf(product, lang)}](${url})` : `**${nameOf(product, lang)}**`} — ${product.price > 0 ? `${money(product.price, lang)} — ` : ''}${lang === 'ar' ? 'مشترك معاها' : 'shares'}: ${shared.map((id) => names.get(id) || id).join(lang === 'ar' ? '، ' : ', ')}`;
  });
  return `\n\n${lang === 'ar' ? '**ولو عايز عطر جاهز قريب من التركيبة دي، من متجر شام:**' : '**Ready perfumes in the Sham store close to this formula:**'}\n${lines.join('\n')}`;
}

/** Product page links: relative on the site itself, absolute (the main site) when written by the server. */
export const SITE_PAGES = 'https://spculculat-oss.github.io/Sham-Perfume/';
export const productLink = (base = SITE_PAGES) => (slug: string) => (/^[a-z0-9-]+$/.test(slug) ? `${base.replace(/\/?$/, '/')}p/${slug}.html` : undefined);

/** Arabic/English text folded for name matching (alef forms, taa marbuta, yaa, case, punctuation). */
const foldName = (s: string) => ` ${s.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f\u064B-\u065F\u0670]/g, '')
  .replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/[\u060C\u061B\u061F\u0640\u066A-\u066D\u06D4]/g, ' ')
  .replace(/[^a-z0-9\u0600-\u06FF]+/g, ' ').trim()} `;

/**
 * The store products a message names («لطافة بلاك عود ثابت؟», «Rasasi Hawas»): the full name, or the name without the
 * brand when that part is distinctive on its own (two words or more, or a long single word). The longest names win.
 */
export function namedProducts(products: StoreProduct[], text: string, limit = 2): StoreProduct[] {
  const t = foldName(text);
  if (t.trim().length < 4) return [];
  const hits: { p: StoreProduct; len: number }[] = [];
  for (const p of products) {
    const brand = foldName(p.brand && p.brand !== 'Unknown' ? p.brand : '').trim();
    const brandSaid = Boolean(brand) && t.includes(` ${brand} `);
    let best = 0;
    for (const raw of new Set([p.name.en, p.name.ar])) {
      if (!raw) continue;
      const core = coreName(raw, brand);
      if (!core) continue;
      // «سبريماسي نوار اند بيربل» names «طقم هدايا سبريماسي نوار اند بيربل» too: the set's own name without «طقم هدايا».
      const bare = core.replace(/^(?:gift set|giftset|coffret|set|طقم هدايا|طقم|مجموعه هدايا) /, '').trim();
      for (const name of new Set([core, bare])) {
        const distinctive = name.includes(' ') ? name.length >= 6 : name.length >= (brandSaid ? 4 : 7);
        if (distinctive && t.includes(` ${name} `)) best = Math.max(best, name.length + (brandSaid ? 50 : 0) + (name === core ? 1 : 0));
      }
    }
    if (best) hits.push({ p, len: best });
  }
  hits.sort((a, b) => b.len - a.len || Number(b.p.inStock) - Number(a.p.inStock) || (b.p.rating || 0) - (a.p.rating || 0));
  const top = hits[0]?.len || 0;
  // Only the most specific name («Hawas Ice» over «Hawas»); its sizes and editions stay together.
  return hits.filter((h) => h.len === top).slice(0, limit).map((h) => h.p);
}

/** «Hawas Ice by Rasasi 100ml EDP» → «hawas ice»: the name without the brand, size, concentration and who it's for. */
/** The same perfume in every size: brand + core name («Club de Nuit Untold» 10 ml and 105 ml share one key). */
export const scentKey = (p: StoreProduct) => {
  const brand = foldName(p.brand && p.brand !== 'Unknown' ? p.brand : '').trim();
  return `${brand}|${coreName(p.name.en || p.name.ar, brand)}`;
};

function coreName(raw: string, brand: string): string {
  let n = foldName(raw);
  if (brand) n = n.split(` by ${brand} `).join(' ').split(` ${brand} `).join(' ');
  n = n.replace(/ \d+(?:\.\d+)? ?(?:ml|مل)(?= )/g, ' ').replace(/ by [a-z0-9 ]+$/g, ' ').replace(/ من [\u0600-\u06FF ]+$/g, ' ')
    .replace(/ (?:eau de parfum|eau de toilette|extrait de parfum|extrait|parfum|perfume|edp|edt|edc|cologne|spray|tester|unisex|men|women|man|woman|for him|for her|homme|femme|pour homme|pour femme|intense|oil|attar)(?= )/g, ' ');
  return n.replace(/\s+/g, ' ').trim();
}

/** Store perfumes close to one product: the same style and shared base notes (what makes them smell alike). */
export function closeTo(products: StoreProduct[], p: StoreProduct, limit = 2): StoreProduct[] {
  const base = new Set(p.notes.base.map((n) => n.trim().toLowerCase()));
  const all = new Set([...p.notes.top, ...p.notes.heart, ...p.notes.base].map((n) => n.trim().toLowerCase()));
  return products.filter((q) => q.inStock && q.sku !== p.sku && foldName(q.name.en) !== foldName(p.name.en)).map((q) => {
    const fam = q.families.filter((f) => p.families.includes(f)).length;
    const sharedBase = q.notes.base.filter((n) => base.has(n.trim().toLowerCase())).length;
    const shared = [...q.notes.top, ...q.notes.heart].filter((n) => all.has(n.trim().toLowerCase())).length;
    const sameGender = !p.gender || !q.gender || p.gender === q.gender || q.gender === 'unisex' ? 0.5 : -2;
    return { q, score: fam * 1.2 + sharedBase * 1.5 + shared * 0.5 + sameGender };
  }).filter((x) => x.score >= 3).sort((a, b) => b.score - a.score || a.q.price - b.q.price).slice(0, limit).map((x) => x.q);
}

/**
 * The store products the visitor is asking about by name («لطافة بلاك عود ثابت؟»، «رأيك في طقم سبريماسي؟») — or none
 * when the question belongs to the designer, the lab or the library. The pitch itself is src/utils/shaheenPitch.ts.
 */
export function askedProducts(products: StoreProduct[], ctx: Context): StoreProduct[] {
  const asked = ctx.followUp && ctx.previous ? ctx.text.slice(ctx.previous.length) : ctx.text;
  // «اعملي تركيبة زي …» belongs to the designer and the lab, not to the product card.
  if (DESIGN_OR_LAB.test(asked)) return [];
  // «ازاي استخدم ورد طائفي؟» is a question about the material, not about the product of that name — unless the
  // price or the name in Latin letters says it is the product.
  if (KNOWLEDGE.test(asked.trim()) && !PRICE.test(asked) && !/[a-z]{3}/i.test(asked)) return [];
  return namedProducts(products, asked);
}
