/**
 * «شاهين البيّاع المقنع» — how he presents a product the visitor asked about. The owner (2026-10-23) showed the reply
 * he got about «طقم هدايا سبريماسي نوار اند بيربل»: a label read aloud («القاعدة: Spicy، Musky SUPREMACY PURPLE»),
 * the weakness first («خفيف لمتوسط، جدّده في اليوم»), two more product cards, and a closing menu that planted the
 * objections («لو السعر مش مريحك قولّي غالي…») — «دة رد مش احترافى».
 *
 * A seasoned merchant's pitch instead (the craft is src/utils/salesCraft.ts):
 *  1. The hook — what it gives him, said for his motive (a gift, himself, an occasion) and his style.
 *  2. The scent as an experience — the first spray, what follows, what stays — in clean Arabic note names
 *     (src/utils/noteNames.ts), the families when the catalogue lists no notes.
 *  3. Benefits, not specifications — staying power framed honestly with a tip, where it shines, who it suits, a gift
 *     set ready to give, the value per ml for the buyer who counts — and real proof only.
 *  4. At most ONE alternative, and only with a reason (cheaper for the budget-minded, longer-lasting when it is
 *     light, the closest in stock when it is sold out).
 *  5. One soft close in his language — one question at most and the one step to order.
 * Never an invented discount, scarcity, review or countdown. Pure and browser-safe.
 */
import { askedProducts, closeTo, money, nameOf, nextStep, staying, type Context, type StoreAnswer } from './shaheenBrain';
import { otherSizes, proofLine, valueLine } from './shaheenSeller';
import { readBuyer, type BuyerProfile } from './salesCraft';
import { readableNotes } from './noteNames';
import { inferOccasions, inferSeasons } from './storeAdvisor';
import { FAMILY_LABEL, OCCASION_LABEL, SEASON_LABEL, concentrationAr, type Family, type StoreProduct } from './storeCatalog';

type Lang = 'ar' | 'en';
type Link = (slug: string) => string | undefined;
const langOf = (language: string, text = ''): Lang => (/[\u0600-\u06FF]/.test(text) || ((language === 'ar' || language === 'fa') && !/[a-z]{3}/i.test(text)) ? 'ar' : 'en');

/** What each family feels like (the noun), and what it does for the one who wears it (the benefit). */
const FEEL: Record<Family, { ar: string; en: string; gives: { ar: string; en: string } }> = {
  oud: { ar: 'فخامة العود', en: 'the richness of oud', gives: { ar: 'حضور شرقي فخم بيتحس من أول ما تدخل المكان', en: 'a rich oriental presence felt the moment you walk in' } },
  amber: { ar: 'دفا العنبر', en: 'the warmth of amber', gives: { ar: 'دفا ناعم بيقرّب الناس منك', en: 'a soft warmth that draws people closer' } },
  musk: { ar: 'نعومة المسك', en: 'the softness of musk', gives: { ar: 'ريحة نظيفة وناعمة بتفضل لاصقة في الهدوم', en: 'a clean, soft scent that clings to your clothes' } },
  fresh: { ar: 'الانتعاش', en: 'freshness', gives: { ar: 'إحساس إنك لسه خارج من الشاور طول اليوم', en: 'that just-showered feeling all day' } },
  citrus: { ar: 'بهجة الحمضيات', en: 'the sparkle of citrus', gives: { ar: 'طاقة وبهجة من أول بخة', en: 'energy and brightness from the first spray' } },
  woody: { ar: 'رُقي الأخشاب', en: 'the elegance of woods', gives: { ar: 'ثقة هادية ورُقي ينفع في أي مكان', en: 'quiet confidence and polish that fit anywhere' } },
  floral: { ar: 'رقة الزهور', en: 'the tenderness of flowers', gives: { ar: 'أناقة رقيقة محبوبة', en: 'a tender, well-loved elegance' } },
  gourmand: { ar: 'الحلاوة الدافية', en: 'a warm sweetness', gives: { ar: 'جاذبية دافية بتخلي اللي جنبك يسألك لابس إيه', en: 'an inviting warmth that makes people ask what you wear' } },
  spicy: { ar: 'دفا التوابل', en: 'the warmth of spices', gives: { ar: 'شخصية واثقة ودافية مش عادية', en: 'a confident, warm and uncommon character' } },
  aquatic: { ar: 'النسمة البحرية', en: 'a sea breeze', gives: { ar: 'خفة وانتعاش في عز الحر', en: 'lightness and freshness in the heat' } },
  oriental: { ar: 'الغنى الشرقي', en: 'oriental richness', gives: { ar: 'فخامة دافية بتلمع في السهرات', en: 'a warm luxury that shines in the evening' } },
  leather: { ar: 'جرأة الجلد', en: 'the boldness of leather', gives: { ar: 'شخصية قوية وجريئة', en: 'a strong, bold personality' } },
  fruity: { ar: 'بهجة الفواكه', en: 'the joy of fruits', gives: { ar: 'روح شبابية مبهجة', en: 'a cheerful, youthful spirit' } },
  powdery: { ar: 'النعومة البودرية', en: 'a powdery softness', gives: { ar: 'أناقة هادية وناعمة', en: 'a calm, soft elegance' } },
};

/** «دفا التوابل مع نعومة المسك ولمسة من بهجة الفواكه — شخصية واثقة ودافية مش عادية». */
export function character(p: StoreProduct, lang: Lang): string {
  return familyCharacter(p.families, lang);
}

/** The same from the families alone (the product page's record on the server has no notes). */
export function familyCharacter(families: readonly Family[], lang: Lang): string {
  const fam = families.filter((f) => FEEL[f]).slice(0, 3);
  if (!fam.length) return '';
  const [a, b, c] = fam.map((f) => FEEL[f]);
  const nouns = lang === 'ar'
    ? `${a.ar}${b ? ` مع ${b.ar}` : ''}${c ? ` ولمسة من ${c.ar}` : ''}`
    : `${a.en}${b ? ` with ${b.en}` : ''}${c ? ` and a touch of ${c.en}` : ''}`;
  return `${nouns} — ${a.gives[lang]}`;
}

/** Base notes that make a perfume last. */
const FIXATIVE = /musk|amber|oud|agarwood|patchouli|sandalwood|vanilla|tonka|leather|ambroxan|benzoin|labdanum|vetiver|incense|frankincense|olibanum|myrrh|cashmeran|guaiac|resin|ambergris/i;
const isGiftSet = (p: StoreProduct) => /gift\s*set|coffret|\bset\b|طقم|مجموعة هدايا/i.test(`${p.name.en} ${p.name.ar}`);
const sep = (lang: Lang) => (lang === 'ar' ? '، ' : ', ');
const and = (items: string[], lang: Lang) => (items.length <= 1 ? items.join('') : lang === 'ar' ? `${items.slice(0, -1).join('، ')} و${items[items.length - 1]}` : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`);
const concOf = (p: StoreProduct, lang: Lang) => (p.concentration ? (lang === 'ar' ? concentrationAr(p.concentration) || p.concentration : p.concentration) : '');

/** The scent as an experience: the first spray, what follows, what stays — or its style when no notes are listed. */
export function scentStory(p: StoreProduct, lang: Lang, labelled = false): string {
  const [top, heart, base] = [p.notes.top, p.notes.heart, p.notes.base].map((l) => readableNotes(l, lang, 3));
  if (!top.length && !heart.length && !base.length) return '';
  if (labelled) {
    const parts = lang === 'ar'
      ? [top.length ? `الافتتاحية ${and(top, lang)}` : '', heart.length ? `القلب ${and(heart, lang)}` : '', base.length ? `القاعدة ${and(base, lang)}` : '']
      : [top.length ? `top: ${and(top, lang)}` : '', heart.length ? `heart: ${and(heart, lang)}` : '', base.length ? `base: ${and(base, lang)}` : ''];
    return parts.filter(Boolean).join(' · ');
  }
  if (lang === 'ar') {
    const steps = [top.length ? `أول بخة ${and(top, lang)}` : '', heart.length ? `${top.length ? 'بعدها بشوية بيهدى على' : 'قلبه'} ${and(heart, lang)}` : '',
      base.length ? (top.length || heart.length ? `واللي بيفضل معاك على الجلد والهدوم ${and(base, lang)}` : `${and(base, lang)} — ودي اللي بتفضل معاك على الجلد والهدوم`) : ''];
    return steps.filter(Boolean).join(' ← ');
  }
  [top, heart, base].forEach((l) => l.forEach((n, i) => { l[i] = n.toLowerCase(); }));
  const steps = [top.length ? `it opens with ${and(top, lang)}` : '', heart.length ? `${top.length ? 'then settles into' : 'its heart is'} ${and(heart, lang)}` : '',
    base.length ? (top.length || heart.length ? `and what stays on skin and clothes is ${and(base, lang)}` : `${and(base, lang)} — what stays with you on skin and clothes`) : ''];
  return steps.filter(Boolean).join(' → ');
}

/** Staying power said as a benefit — the weakness honestly, with the tip that fixes it (never «جدّده»). */
export function stayingPitch(p: StoreProduct, lang: Lang): string {
  const hours = /(\d+)\s*-\s*(\d+)\s*hours?/i.exec(p.longevity || '');
  const conc = concOf(p, lang);
  const s = staying(p);
  if (hours) return lang === 'ar' ? `ثباته المنشور ${hours[1]}–${hours[2]} ساعات — بخّات قليلة الصبح بتكفي يومك.` : `published longevity ${hours[1]}–${hours[2]} hours — a few sprays in the morning carry your day.`;
  if (s >= 6) return lang === 'ar' ? `ثباته قوي — ${conc ? `تركيزه ${conc} و` : ''}قاعدته فيها مثبتات، فبخّتين الصبح بيكفّوا يومك.` : `strong staying power — ${conc ? `${conc} and ` : ''}a base of fixatives, so two morning sprays carry your day.`;
  // No published concentration or longevity: only what the base says, never a verdict the catalogue can't back.
  const fixatives = readableNotes(p.notes.base.filter((n) => FIXATIVE.test(n)), lang, 2);
  if (!p.concentration && s < 4 && fixatives.length) {
    return lang === 'ar' ? `قاعدته فيها ${and(fixatives, lang)}، ودي من المثبتات اللي بتفضل على الهدوم — ولثبات أطول رشّه على الهدوم أو بعد مرطّب من غير ريحة.`
      : `its base carries ${and(fixatives.map((f) => f.toLowerCase()), lang)}, fixatives that stay on clothes — for longer wear, spray it on clothes or over an unscented moisturiser.`;
  }
  if (s >= 4) return lang === 'ar' ? 'ثباته كويس — بيعيش معاك ساعات، وعلى الهدوم أطول.' : 'good staying power — it stays with you for hours, longer on clothes.';
  return lang === 'ar' ? 'خفيف وراقي ومش بيخنق اللي حواليك — ولو حابب يعيش أطول، رشّه على الهدوم أو بعد مرطّب من غير ريحة.' : 'light and refined, never overwhelming — for longer wear, spray it on clothes or over an unscented moisturiser.';
}

/** Where it shines, in the visitor's words («السهرات وعزومات الشتا»), and who it suits. */
function whenLine(p: StoreProduct, lang: Lang): string {
  const when = [...new Set([...inferOccasions(p).filter((o) => o !== 'gift').map((o) => OCCASION_LABEL[o][lang]), ...inferSeasons(p).filter((s) => s !== 'all').map((s) => SEASON_LABEL[s][lang])])].slice(0, 3);
  const allYear = inferSeasons(p).includes('all') || inferSeasons(p).length >= 4;
  const parts = [when.length ? and(when, lang).toLowerCase() : '', allYear ? (lang === 'ar' ? (when.length ? 'وينفع طول السنة' : 'طول السنة') : (when.length ? 'and works all year' : 'all year round')) : ''].filter(Boolean);
  const who = p.gender === 'unisex' ? (lang === 'ar' ? 'للراجل والست' : 'for him and her') : '';
  return [parts.join(' '), who].filter(Boolean).join(lang === 'ar' ? ' — ' : ' — ');
}

/** The one alternative worth showing, and why — or none (a focused pitch beats a catalogue). */
function oneAlternative(products: StoreProduct[], p: StoreProduct, buyer: BuyerProfile): { alt: StoreProduct; why: 'stock' | 'cheaper' | 'stronger' } | undefined {
  const near = closeTo(products, p, 8);
  if (!p.inStock) return near[0] ? { alt: near[0], why: 'stock' } : undefined;
  if (buyer.style === 'direct' || buyer.stage === 'ready') return undefined;
  if (buyer.budgetSensitive || buyer.style === 'analytical' || buyer.stage === 'comparing') {
    const cheaper = near.filter((q) => q.price > 0 && q.price < p.price * 0.85).sort((a, b) => b.price - a.price)[0];
    if (cheaper) return { alt: cheaper, why: 'cheaper' };
  }
  if (staying(p) < 4) {
    const stronger = near.filter((q) => staying(q) >= staying(p) + 1.5 && q.price <= p.price * 1.4)[0];
    if (stronger) return { alt: stronger, why: 'stronger' };
  }
  return undefined;
}

/** The pitch for one product, for this buyer (the reply's lines; the close is added by the caller). */
export function pitch(products: StoreProduct[], p: StoreProduct, buyer: BuyerProfile, lang: Lang, link: Link): { lines: string[]; alt?: StoreProduct } {
  const ar = lang === 'ar';
  const url = link(p.slug);
  const title = url ? `[${nameOf(p, lang)}](${url})` : `**${nameOf(p, lang)}**`;
  const brand = p.brand && p.brand !== 'Unknown' ? p.brand : '';
  const size = p.sizeMl ? (ar ? `${p.sizeMl} مل` : `${p.sizeMl} ml`) : '';
  const facts = [p.price > 0 ? money(p.price, lang) : '', size, buyer.style === 'analytical' || buyer.connoisseur ? concOf(p, lang) : ''].filter(Boolean).join(' · ');
  const feel = character(p, lang);
  const gift = isGiftSet(p);
  const out: string[] = [];

  // 1. The hook.
  let hook: string;
  if (buyer.motive === 'gift') hook = gift ? (ar ? `هدية جاهزة في علبتها${brand ? ` من ${brand}` : ''}` : `a gift ready in its box${brand ? ` from ${brand}` : ''}`) : (ar ? `هدية بتفرّح${brand ? ` من ${brand}` : ''}` : `a gift that delights${brand ? ` from ${brand}` : ''}`);
  else if (buyer.style === 'expressive') hook = ar ? 'عطر ليه حضور' : 'a scent with presence';
  else hook = brand ? (ar ? `من ${brand}` : `by ${brand}`) : '';
  out.push(`**${title}**${facts ? ` — ${facts}` : ''}`);
  const lead = [hook, feel].filter(Boolean).join(ar ? ': ' : ': ');
  if (lead) out.push(`${lead.charAt(0).toUpperCase()}${lead.slice(1)}.`);
  if (!p.inStock) out.push(ar ? '_بصراحة هو غير متوفر حالياً، ومش هوعدك بميعاد مش متأكد منه — والأقرب ليه المتوفر تحت._' : '_Honestly, it is out of stock right now and I will not promise a date I am not sure of — the closest one in stock is below._');

  // 2. The scent as an experience (the analyst and the connoisseur get the layers by name).
  const story = scentStory(p, lang, buyer.style === 'analytical' || buyer.connoisseur);
  const lines: string[] = [];
  if (story) lines.push(`${ar ? '**ريحته:**' : '**The scent:**'} ${story}.`);
  else if (!feel && p.families.length) lines.push(`${ar ? '**طابعه:**' : '**Style:**'} ${p.families.slice(0, 3).map((f) => FAMILY_LABEL[f][lang]).join(sep(lang))}.`);

  // 3. Benefits, not specifications.
  if (buyer.style !== 'direct') lines.push(`${ar ? '**الثبات:**' : '**Staying power:**'} ${stayingPitch(p, lang)}`);
  const when = whenLine(p, lang);
  if (when && buyer.style !== 'direct') lines.push(`${ar ? '**يناسب:**' : '**Suits:**'} ${when}.`);
  if (gift) lines.push(ar ? '**جاهز للإهداء:** طقم في علبته الأصلية، مش محتاج تغليف.' : '**Ready to give:** a set in its original box, no wrapping needed.');
  if ((buyer.budgetSensitive || buyer.style === 'analytical' || buyer.motive === 'value') && !gift) {
    const value = valueLine(p, lang);
    if (value) lines.push(`${ar ? '**القيمة:**' : '**Value:**'} ${value}.`);
  }
  const proof = proofLine(p, lang);
  if (proof) lines.push(proof);
  const smaller = otherSizes(products, p).find((q) => (q.sizeMl || 0) < (p.sizeMl || 0));
  if (smaller && (buyer.style === 'cautious' || buyer.budgetSensitive)) {
    const su = link(smaller.slug);
    lines.push(ar ? `عايز تجربه الأول؟ موجود بحجم ${smaller.sizeMl} مل: ${su ? `[${nameOf(smaller, lang)}](${su})` : `«${nameOf(smaller, lang)}»`} — ${money(smaller.price, lang)}.`
      : `Want to try it first? It comes in ${smaller.sizeMl} ml: ${su ? `[${nameOf(smaller, lang)}](${su})` : `“${nameOf(smaller, lang)}”`} — ${money(smaller.price, lang)}.`);
  }
  // The hurried buyer gets the pitch in two lines: the scent (or nothing) and the staying power in one.
  if (buyer.style === 'direct') lines.splice(1, 0, `${ar ? '**الثبات:**' : '**Staying power:**'} ${stayingPitch(p, lang)}`);
  out.push(...lines.map((l) => `- ${l}`));

  // 4. At most one alternative, with its reason.
  const choice = oneAlternative(products, p, buyer);
  if (choice) {
    const { alt, why } = choice;
    const au = link(alt.slug);
    const at = au ? `[${nameOf(alt, lang)}](${au})` : `**${nameOf(alt, lang)}**`;
    const af = [alt.price > 0 ? money(alt.price, lang) : '', alt.sizeMl ? (ar ? `${alt.sizeMl} مل` : `${alt.sizeMl} ml`) : ''].filter(Boolean).join(' · ');
    const head = why === 'stock' ? (ar ? '**الأقرب ليه والمتوفر دلوقتي:**' : '**The closest one in stock now:**')
      : why === 'cheaper' ? (ar ? '**ولو حابب نفس الروح بسعر أقل:**' : '**The same spirit for less:**')
        : (ar ? '**ولو عايز ثبات أعلى بنفس الطابع:**' : '**The same style with more staying power:**');
    out.push('', `${head} ${at}${af ? ` — ${af}` : ''}`);
  }
  return { lines: out, ...(choice ? { alt: choice.alt } : {}) };
}

/**
 * «متجر شام» answering about a product the visitor named — from the catalogue with live prices, so it never needs an
 * AI platform: the pitch for this buyer, at most one alternative, and one soft close.
 */
export function productAnswer(products: StoreProduct[], ctx: Context, language: string, link: Link): StoreAnswer | undefined {
  const named = askedProducts(products, ctx);
  if (!named.length) return undefined;
  const lang = langOf(language, ctx.text);
  const buyer = readBuyer(ctx.said || [ctx.text]);
  // Sizes and editions of one name: the one in stock leads (the other size is offered by the pitch when it helps).
  const main = [...named].sort((a, b) => Number(b.inStock) - Number(a.inStock))[0];
  const { lines, alt } = pitch(products, main, buyer, lang, link);
  const target = main.inStock ? main : alt;
  const out = [...lines, '', nextStep(target, lang, buyer, main.inStock ? alt : undefined)];
  return { reply: out.join('\n'), picks: [main, ...(alt ? [alt] : [])], matched: true };
}
