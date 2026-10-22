/**
 * «مصمم شاهين الذاتي» — Shaheen designs a trial perfume formula by himself, with no AI platform: he reads the request
 * (season, mood, who it is for, the materials named, bottle size, concentration), picks materials from his own
 * palette layer by layer (top / heart / base), balances the proportions inside each material's usual range, and
 * writes the formula with its amounts and a ```sham-formula block the calculator opens.
 *
 * Honest by design: a trial proposal that needs a small test batch and the supplier's IFRA certificate; he asks
 * one short question when the request gives no direction at all instead of guessing. Pure and browser-safe: the
 * same answer in the visitor's browser and on the server.
 */
import { asciiDigits } from './shaheenQuickApps';

type Layer = 'top' | 'heart' | 'base';
type Tag =
  | 'citrus' | 'fresh' | 'aromatic' | 'aquatic' | 'green' | 'spicy' | 'warm' | 'floral' | 'white' | 'rose' | 'powdery'
  | 'sweet' | 'gourmand' | 'woody' | 'oud' | 'amber' | 'oriental' | 'incense' | 'smoky' | 'leather' | 'musky' | 'clean'
  | 'earthy' | 'balsamic' | 'fruity' | 'fougere' | 'creamy';

interface Material {
  id: string; ar: string; en: string; layer: Layer; tags: Tag[];
  /** Usual weight inside its layer, and the most this palette ever gives it (% of the oil). */
  weight: number; max: number;
  /** How a visitor may name it. */
  names: RegExp;
}

/** Shaheen's palette: well-known perfumery materials with conservative shares of the perfume oil. */
const PALETTE: Material[] = [
  // ── top ──
  { id: 'bergamot', ar: 'برغموت (خالي من البيرجابتين FCF)', en: 'Bergamot (FCF)', layer: 'top', tags: ['citrus', 'fresh', 'aromatic'], weight: 5, max: 25, names: /برغموت|برجموت|bergamot/i },
  { id: 'lemon', ar: 'ليمون', en: 'Lemon', layer: 'top', tags: ['citrus', 'fresh'], weight: 3, max: 12, names: /ليمون|lemon/i },
  { id: 'mandarin', ar: 'يوسفي (ماندرين)', en: 'Mandarin', layer: 'top', tags: ['citrus', 'sweet', 'fresh', 'fruity'], weight: 4, max: 18, names: /يوسف|ماندرين|mandarin|tangerine/i },
  { id: 'grapefruit', ar: 'جريب فروت', en: 'Grapefruit', layer: 'top', tags: ['citrus', 'fresh'], weight: 3, max: 12, names: /جريب ?فروت|grapefruit/i },
  { id: 'neroli', ar: 'نيرولي', en: 'Neroli', layer: 'top', tags: ['citrus', 'floral', 'fresh', 'white'], weight: 2, max: 8, names: /نيرولي|neroli/i },
  { id: 'lavender', ar: 'لافندر', en: 'Lavender', layer: 'top', tags: ['aromatic', 'fresh', 'fougere', 'floral'], weight: 4, max: 18, names: /لافندر|لافندير|خزامى|lavender/i },
  { id: 'pink_pepper', ar: 'فلفل وردي', en: 'Pink pepper', layer: 'top', tags: ['spicy', 'fresh', 'fruity'], weight: 2, max: 6, names: /فلفل وردي|pink pepper/i },
  { id: 'black_pepper', ar: 'فلفل أسود', en: 'Black pepper', layer: 'top', tags: ['spicy', 'woody', 'fresh'], weight: 2, max: 5, names: /فلفل(?! ?وردي)|black pepper|(?<!pink )pepper/i },
  { id: 'cardamom', ar: 'هيل (حبهان)', en: 'Cardamom', layer: 'top', tags: ['spicy', 'warm', 'aromatic', 'oriental'], weight: 2, max: 6, names: /هيل|حبهان|cardamom/i },
  { id: 'saffron', ar: 'زعفران (أكورد)', en: 'Saffron accord', layer: 'top', tags: ['spicy', 'oriental', 'leather', 'warm'], weight: 1, max: 3, names: /زعفران|saffron/i },
  { id: 'apple', ar: 'تفاح (أكورد)', en: 'Apple accord', layer: 'top', tags: ['fruity', 'fresh', 'sweet', 'green'], weight: 2, max: 6, names: /تفاح|apple/i },
  { id: 'calone', ar: 'كالون (نسمة البحر)', en: 'Calone', layer: 'top', tags: ['aquatic', 'fresh', 'clean'], weight: 1, max: 1.5, names: /كالون|calone|بحري|marine/i },
  // ── heart ──
  { id: 'rose', ar: 'ورد طائفي', en: 'Taif rose', layer: 'heart', tags: ['floral', 'rose', 'oriental'], weight: 5, max: 15, names: /(?<!فلفل ?)ورد|روز|(?<!pink pepper )rose/i },
  { id: 'jasmine', ar: 'ياسمين', en: 'Jasmine', layer: 'heart', tags: ['floral', 'white', 'sweet'], weight: 3, max: 8, names: /ياسمين|(?<![\u0600-\u06FF])(?:و|ب|ل|لل|ال|بال|وال)?فل(?![\u0600-\u06FF])|jasmin/i },
  { id: 'orange_blossom', ar: 'زهر البرتقال', en: 'Orange blossom', layer: 'heart', tags: ['floral', 'white', 'fresh'], weight: 3, max: 8, names: /زهر البرتقال|زهر الليمون|orange blossom/i },
  { id: 'hedione', ar: 'هيديون (إشراقة الياسمين)', en: 'Hedione', layer: 'heart', tags: ['floral', 'fresh', 'clean'], weight: 4, max: 20, names: /هيديون|hedione/i },
  { id: 'iris', ar: 'سوسن (أوريس)', en: 'Iris (orris)', layer: 'heart', tags: ['powdery', 'floral'], weight: 2, max: 5, names: /سوسن|ايريس|إيريس|اوريس|iris|orris/i },
  { id: 'violet', ar: 'بنفسج', en: 'Violet', layer: 'heart', tags: ['powdery', 'floral', 'green'], weight: 2, max: 5, names: /بنفسج|violet/i },
  { id: 'ylang', ar: 'يلانج يلانج', en: 'Ylang-ylang', layer: 'heart', tags: ['floral', 'white', 'sweet'], weight: 2, max: 6, names: /يلانج|ylang/i },
  { id: 'geranium', ar: 'جيرانيوم (عطرة)', en: 'Geranium', layer: 'heart', tags: ['floral', 'green', 'rose', 'aromatic'], weight: 3, max: 8, names: /جيرانيوم|عطرة|geranium/i },
  { id: 'clary_sage', ar: 'مريمية', en: 'Clary sage', layer: 'heart', tags: ['aromatic', 'green', 'fresh'], weight: 2, max: 5, names: /مريمي|sage/i },
  { id: 'frankincense', ar: 'لبان حوجري', en: 'Hojari frankincense', layer: 'heart', tags: ['incense', 'smoky', 'oriental', 'fresh'], weight: 3, max: 8, names: /لبان|بخور|frankincense|olibanum|incense/i },
  { id: 'cinnamon', ar: 'قرفة', en: 'Cinnamon', layer: 'heart', tags: ['spicy', 'warm', 'gourmand', 'oriental'], weight: 1, max: 1, names: /قرف[ةه]|cinnamon/i },
  { id: 'clove', ar: 'قرنفل', en: 'Clove', layer: 'heart', tags: ['spicy', 'warm', 'oriental'], weight: 1, max: 1.5, names: /قرنفل|clove/i },
  { id: 'coffee', ar: 'قهوة', en: 'Coffee', layer: 'heart', tags: ['gourmand', 'warm', 'smoky'], weight: 2, max: 5, names: /قهو[ةه]|(?<![\u0600-\u06FF])(?:و|ب|ل|لل|ال|بال|وال)?بن(?![\u0600-\u06FF])|coffee/i },
  { id: 'cashmeran', ar: 'كشميران', en: 'Cashmeran', layer: 'heart', tags: ['woody', 'musky', 'warm', 'creamy'], weight: 2, max: 5, names: /كشميران|cashmeran/i },
  // ── base ──
  { id: 'oud', ar: 'عود', en: 'Oud', layer: 'base', tags: ['oud', 'woody', 'smoky', 'oriental', 'warm'], weight: 4, max: 12, names: /عود|oud|agarwood/i },
  { id: 'sandalwood', ar: 'صندل', en: 'Sandalwood', layer: 'base', tags: ['woody', 'creamy', 'warm'], weight: 5, max: 15, names: /صندل|sandal/i },
  { id: 'cedar', ar: 'خشب الأرز', en: 'Cedarwood', layer: 'base', tags: ['woody', 'fresh', 'aromatic'], weight: 5, max: 15, names: /ارز|أرز|سيدر|cedar/i },
  { id: 'vetiver', ar: 'نجيل الهند (فيتيفر)', en: 'Vetiver', layer: 'base', tags: ['woody', 'earthy', 'smoky', 'fresh'], weight: 3, max: 8, names: /نجيل|فيتيفر|vetiver/i },
  { id: 'patchouli', ar: 'باتشولي', en: 'Patchouli', layer: 'base', tags: ['earthy', 'woody', 'oriental'], weight: 3, max: 10, names: /باتشول|patchouli/i },
  { id: 'amber', ar: 'عنبر (أكورد لابدانوم وبنزوين)', en: 'Amber accord', layer: 'base', tags: ['amber', 'warm', 'oriental', 'sweet', 'balsamic'], weight: 5, max: 12, names: /عنبر|امبر|أمبر|amber/i },
  { id: 'vanilla', ar: 'فانيليا', en: 'Vanilla', layer: 'base', tags: ['gourmand', 'sweet', 'warm', 'balsamic'], weight: 4, max: 8, names: /فانيل|vanill/i },
  { id: 'tonka', ar: 'تونكا', en: 'Tonka bean', layer: 'base', tags: ['gourmand', 'sweet', 'warm', 'fougere'], weight: 3, max: 6, names: /تونكا|tonka/i },
  { id: 'musk', ar: 'مسك أبيض', en: 'White musk', layer: 'base', tags: ['musky', 'clean', 'powdery'], weight: 5, max: 15, names: /مسك|musk/i },
  { id: 'ambroxan', ar: 'أمبروكسان', en: 'Ambroxan', layer: 'base', tags: ['amber', 'woody', 'clean', 'fresh'], weight: 2, max: 4, names: /امبروكسان|أمبروكسان|ambrox/i },
  { id: 'iso_e', ar: 'إيزو إي سوبر', en: 'Iso E Super', layer: 'base', tags: ['woody', 'clean'], weight: 4, max: 15, names: /ايزو|إيزو|iso e/i },
  { id: 'leather', ar: 'جلد (أكورد)', en: 'Leather accord', layer: 'base', tags: ['leather', 'smoky', 'warm'], weight: 2, max: 5, names: /جلد|ليذر|leather/i },
  { id: 'tobacco', ar: 'تبغ (أكورد)', en: 'Tobacco accord', layer: 'base', tags: ['warm', 'sweet', 'smoky'], weight: 2, max: 4, names: /تبغ|دخان|توباكو|tobacco/i },
  { id: 'myrrh', ar: 'مر (مُر)', en: 'Myrrh', layer: 'base', tags: ['incense', 'balsamic', 'oriental'], weight: 2, max: 5, names: /(?<![\u0600-\u06FF])(?:و|ال|وال|بال)?مر(?![\u0600-\u06FF])|مُر|myrrh/i },
  { id: 'moss', ar: 'طحلب (بديل طحلب السنديان)', en: 'Oakmoss substitute', layer: 'base', tags: ['earthy', 'green', 'woody'], weight: 1, max: 3, names: /طحلب|moss|شيبر|chypre/i },
];

/** What a request says about the perfume wanted → the scent families that fit. */
const MOODS: { re: RegExp; tags: Tag[]; ar: string; en: string; warm?: boolean; fresh?: boolean }[] = [
  { re: /شت[اوي]|شتاء|شتوي|برد|winter|cold weather/i, tags: ['warm', 'spicy', 'amber', 'oriental', 'woody', 'gourmand'], ar: 'شتوي دافي', en: 'warm winter', warm: true },
  { re: /صيف|صيفي|(?<![\u0600-\u06FF])(?:و|ب|ل|لل|ال|بال|وال)?حر(?![\u0600-\u06FF])|حرارة|summer|hot weather/i, tags: ['fresh', 'citrus', 'aquatic', 'green', 'clean'], ar: 'صيفي منعش', en: 'fresh summer', fresh: true },
  { re: /ربيع|spring/i, tags: ['floral', 'green', 'citrus', 'fresh'], ar: 'ربيعي', en: 'spring' },
  { re: /خريف|autumn|fall\b/i, tags: ['woody', 'spicy', 'warm', 'earthy'], ar: 'خريفي', en: 'autumn', warm: true },
  { re: /رجال|رجالي|للرجل|شباب|men\b|male|masculine|for him/i, tags: ['woody', 'aromatic', 'spicy', 'leather', 'fresh'], ar: 'رجالي', en: 'masculine' },
  { re: /نسائي|حريمي|ستات|للمرأ|بنات|بناتي|women|female|feminine|for her/i, tags: ['floral', 'sweet', 'powdery', 'white', 'fruity'], ar: 'نسائي', en: 'feminine' },
  { re: /سهر|مساء|مسائي|ليل|ليلي|evening|night/i, tags: ['oriental', 'amber', 'oud', 'sweet', 'warm'], ar: 'للسهرة', en: 'evening', warm: true },
  { re: /يومي|شغل|مكتب|جامع|دوام|daily|office|work/i, tags: ['fresh', 'clean', 'musky', 'citrus'], ar: 'يومي هادي', en: 'everyday', fresh: true },
  { re: /شرقي|خليجي|عربي|oriental|arabian/i, tags: ['oud', 'rose', 'amber', 'incense', 'spicy', 'oriental'], ar: 'شرقي', en: 'oriental', warm: true },
  { re: /منعش|فريش|انتعاش|fresh/i, tags: ['fresh', 'citrus', 'aquatic', 'green'], ar: 'منعش', en: 'fresh', fresh: true },
  { re: /حلو|[أا]حلى|سكري|جورماند|gourmand|sweet/i, tags: ['gourmand', 'sweet'], ar: 'حلو', en: 'sweet' },
  { re: /خشب|[أا]نشف|ناشف|dry|drier|woody/i, tags: ['woody'], ar: 'خشبي', en: 'woody' },
  { re: /زهري|زهور|ورود|floral|flowers/i, tags: ['floral'], ar: 'زهري', en: 'floral' },
  { re: /نظيف|صابون|clean|soapy/i, tags: ['clean', 'musky'], ar: 'نظيف', en: 'clean', fresh: true },
  { re: /مدخن|smoky/i, tags: ['smoky', 'incense'], ar: 'مدخن', en: 'smoky', warm: true },
  { re: /بودر|powdery/i, tags: ['powdery'], ar: 'بودري', en: 'powdery' },
  { re: /حار|حراق|توابل|بهارات|spicy/i, tags: ['spicy', 'warm'], ar: 'حار بالتوابل', en: 'spicy', warm: true },
  { re: /فواكه|فاكهي|fruity/i, tags: ['fruity', 'sweet'], ar: 'فاكهي', en: 'fruity' },
  { re: /ثابت|ثبات|يدوم|long ?lasting/i, tags: ['amber', 'musky', 'woody'], ar: 'ثابت', en: 'long-lasting' },
];

const DESIGN_VERB = /صمم|صمّم|تصميم|تركيب[ةه]|ركّب|ركب لي|ركبلي|خلط[ةه]|وصف[ةه]|فورمولا|اعمل(?:لي| لي)? عطر|اعملي عطر|اخترع(?:لي)? عطر|ابتكر|\bformula\b|\brecipe\b|\bblend\b|design (?:a|me|my)|create (?:a|me) (?:perfume|fragrance|scent)|make (?:me )?a (?:perfume|fragrance|scent)/i;
/** Questions about a formula, not requests for one («إيه هي التركيبة الهرمية؟», «ازاي احسب التركيز؟»). */
const NOT_A_REQUEST = /^(?:ما|ماهي|ما هي|ايه|إيه|يعني ايه|شو|ازاي|إزاي|كيف|هل|ليه|لماذا|what(?:'s| is| are)|how (?:do|to|does)|why|is|are)(?=[\s؟?،,]|$)/i;
/** «ازاي/كيف اعمل (لي) عطر …» — a how-to that asks for a perfume to be made. */
const HOW_TO_MAKE = /^(?:ازاي|إزاي|ازاى|كيف|how (?:do|can) i (?:make|create))\s+(?:(?:ممكن|اقدر|أقدر)\s+)?(?:اعمل|أعمل|نعمل|اصنع|أصنع|نصنع|اركب|أركب|make|create)?\s*(?:لي|لى)?\s*(?:عطر|برفان|perfume|fragrance)\s+\S/i;
const AFTER = '(?![a-zA-Z\\u0600-\\u06FF])';

export interface DesignBrief { tags: Tag[]; moods: string[]; named: string[]; bottleMl: number; concentration: number; type: 'extrait' | 'edp' | 'edt' | 'edc'; warm: boolean; fresh: boolean; explicitSize: boolean }

/** Reads a design request; undefined when the text is not one. */
export function readBrief(text: string, lang: 'ar' | 'en' = 'ar'): DesignBrief | undefined {
  const clean = asciiDigits(text).replace(/\s+/g, ' ').trim();
  // «ازاي اعمل عطر عود؟» asks for a formula (a how-to that names what the perfume should smell of); «ازاي احسب التركيز؟» does not.
  const howToMake = HOW_TO_MAKE.test(clean);
  if (clean.length < 4 || clean.length > 600 || !DESIGN_VERB.test(clean) || (NOT_A_REQUEST.test(clean) && !howToMake)) return undefined;
  const tags = new Set<Tag>(); const moods: string[] = []; let warm = false; let fresh = false;
  for (const m of MOODS) {
    if (!m.re.test(clean)) continue;
    m.tags.forEach((t) => tags.add(t));
    const name = lang === 'ar' ? m.ar : m.en;
    if (!moods.some((x) => x.includes(name))) moods.push(name);
    warm ||= Boolean(m.warm); fresh ||= Boolean(m.fresh);
  }
  const named = PALETTE.filter((m) => m.names.test(clean)).map((m) => m.id);
  // Only materials named: their own families guide the rest of the formula.
  if (!tags.size && named.length) for (const id of named) PALETTE.find((m) => m.id === id)!.tags.slice(0, 3).forEach((t) => tags.add(t));
  if (howToMake && NOT_A_REQUEST.test(clean) && !tags.size) return undefined;
  const size = clean.match(new RegExp(`(\\d{1,4}(?:\\.\\d+)?)\\s*(?:مل|ملي|مللي|ml)${AFTER}`, 'i'));
  const bottleMl = size ? Math.min(1000, Math.max(5, Number(size[1]))) : 50;
  const type = /extrait|اكستريه|إكستريه|برفان|parfum\b|بيور/i.test(clean) ? 'extrait'
    : /\bedt\b|تواليت|toilette/i.test(clean) ? 'edt' : /\bedc\b|كولونيا|cologne/i.test(clean) ? 'edc' : 'edp';
  const pct = clean.match(/(?:تركيز|concentration)\D{0,6}(\d{1,2}(?:\.\d+)?)\s*%?|(\d{1,2}(?:\.\d+)?)\s*%/i);
  const asked = pct ? Number(pct[1] ?? pct[2]) : NaN;
  const concentration = asked >= 3 && asked <= 40 ? asked : { extrait: 25, edp: 20, edt: 12, edc: 5 }[type];
  return { tags: [...tags], moods, named, bottleMl, concentration, type, warm, fresh, explicitSize: Boolean(size) };
}

export interface DesignedNote { id: string; nameAr: string; nameEn: string; category: Layer; percentageOfOil: number }
export interface Design { title: string; notes: DesignedNote[]; brief: DesignBrief; macerationDays: number }

const LAYER_COUNT: Record<Layer, number> = { top: 3, heart: 3, base: 3 };
const LAYER_DEFAULTS: Record<Layer, string[]> = { top: ['bergamot', 'mandarin', 'pink_pepper'], heart: ['hedione', 'rose', 'jasmine'], base: ['musk', 'cedar', 'ambroxan'] };

/** Picks the materials and balances them: the same request always gives the same formula. */
export function composeDesign(brief: DesignBrief, lang: 'ar' | 'en' = 'ar'): Design {
  const want = new Set(brief.tags);
  const named = new Set(brief.named);
  const picks: Material[] = [];
  // Warm perfumes rest on their base; fresh ones open wide.
  const shares: Record<Layer, number> = brief.warm && !brief.fresh ? { top: 15, heart: 35, base: 50 }
    : brief.fresh && !brief.warm ? { top: 35, heart: 40, base: 25 } : { top: 25, heart: 40, base: 35 };
  for (const layer of ['top', 'heart', 'base'] as Layer[]) {
    const pool = PALETTE.filter((m) => m.layer === layer)
      .map((m) => ({ m, score: (named.has(m.id) ? 1000 : 0) + m.tags.filter((t) => want.has(t)).length * 10 + m.weight * 0.1
        // A fresh request keeps away from heavy, smoky and sweet materials (and a warm one from the sea breeze).
        - (brief.fresh && !brief.warm && !named.has(m.id) && m.tags.some((t) => t === 'smoky' || t === 'gourmand' || t === 'oud' || t === 'leather') ? 50 : 0)
        - (brief.warm && !brief.fresh && !named.has(m.id) && m.tags.includes('aquatic') ? 50 : 0) }))
      .sort((a, b) => b.score - a.score || a.m.id.localeCompare(b.m.id));
    const count = Math.max(LAYER_COUNT[layer], pool.filter((p) => named.has(p.m.id)).length);
    const chosen: Material[] = [];
    let citrus = 0; let accents = 0;
    for (const { m, score } of pool) {
      if (chosen.length >= Math.min(count, 4)) break;
      if (score < 5 && want.size) continue;
      // One strong accent per layer (cinnamon, clove, saffron… are used in drops), unless the visitor named more.
      if (m.max < 3 && !named.has(m.id) && accents >= 1) continue;
      if (m.max < 3) accents++;
      // At most two citrus notes: a third adds nothing but a sharper opening.
      if (m.tags.includes('citrus') && !named.has(m.id) && citrus >= 2) continue;
      if (m.tags.includes('citrus')) citrus++;
      chosen.push(m);
    }
    for (const id of LAYER_DEFAULTS[layer]) {
      if (chosen.length >= LAYER_COUNT[layer]) break;
      const m = PALETTE.find((x) => x.id === id)!;
      if (!chosen.includes(m)) chosen.push(m);
    }
    // Strong accents (cinnamon, clove, saffron…) are used in drops: the layer gets more materials until it can
    // carry its share without pushing any of them past its usual maximum.
    for (const { m } of pool) {
      if (chosen.reduce((sum, x) => sum + x.max, 0) >= shares[layer] * 1.3 || chosen.length >= 5) break;
      if (!chosen.includes(m) && m.max >= 5 && !(brief.fresh && !brief.warm && m.tags.some((t) => t === 'smoky' || t === 'oud'))) chosen.push(m);
    }
    picks.push(...chosen);
  }
  const raw = new Map<string, number>();
  let spill = 0;
  for (const layer of ['top', 'heart', 'base'] as Layer[]) {
    const group = picks.filter((m) => m.layer === layer);
    let left = shares[layer] + (layer === 'base' ? spill : 0);
    let open = [...group];
    // Shares by weight, capped at each material's maximum; what a capped one can't take goes to the others.
    for (let round = 0; round < 4 && open.length && left > 0.001; round++) {
      const total = open.reduce((s, m) => s + m.weight * (named.has(m.id) ? 1.5 : 1), 0);
      const next: Material[] = [];
      let used = 0;
      for (const m of open) {
        const give = left * (m.weight * (named.has(m.id) ? 1.5 : 1)) / total;
        const room = m.max - (raw.get(m.id) || 0);
        const take = Math.min(give, room);
        raw.set(m.id, (raw.get(m.id) || 0) + take); used += take;
        if (take >= give - 1e-9) next.push(m);
      }
      left -= used; open = next;
    }
    if (left > 0.001) spill += left;
  }
  // Anything the caps left over goes to the roomiest materials, base first (musk, cedar, sandalwood…).
  if (spill > 0.001) {
    const rank: Record<Layer, number> = { base: 0, heart: 1, top: 2 };
    for (const m of [...picks].sort((a, b) => rank[a.layer] - rank[b.layer] || (b.max - (raw.get(b.id) || 0)) - (a.max - (raw.get(a.id) || 0)))) {
      const take = Math.min(spill, m.max - (raw.get(m.id) || 0));
      raw.set(m.id, (raw.get(m.id) || 0) + take); spill -= take;
      if (spill <= 0.001) break;
    }
  }
  const notes = roundTo100(picks.map((m) => ({ m, v: raw.get(m.id) || 0 })).filter((x) => x.v > 0));
  const mood = brief.moods.slice(0, 2).join(lang === 'ar' ? ' و' : ' & ');
  const star = picks.find((m) => named.has(m.id)) || picks.find((m) => m.layer === 'base')!;
  const title = lang === 'ar'
    ? `عطر ${mood ? `${mood} ` : ''}بلمسة ${star.ar.replace(/\s*\(.*\)$/, '')} — مقترح شاهين`
    : `${mood ? `${mood[0]!.toUpperCase()}${mood.slice(1)} perfume` : 'Perfume'} with ${star.en.replace(/\s*\(.*\)$/, '')} — Shaheen's proposal`;
  return { title, brief, macerationDays: brief.warm && !brief.fresh ? 45 : brief.fresh && !brief.warm ? 21 : 30,
    notes: notes.map(({ m, v }) => ({ id: m.id, nameAr: m.ar, nameEn: m.en, category: m.layer, percentageOfOil: v })) };
}

/** Whole percentages that add up to exactly 100 (largest remainder), never below 1. */
function roundTo100(list: { m: Material; v: number }[]): { m: Material; v: number }[] {
  const total = list.reduce((s, x) => s + x.v, 0) || 1;
  const scaled = list.map((x) => ({ ...x, exact: (x.v * 100) / total }));
  const out = scaled.map((x) => ({ m: x.m, v: Math.max(1, Math.floor(x.exact)), rest: x.exact - Math.floor(x.exact) }));
  let diff = 100 - out.reduce((s, x) => s + x.v, 0);
  const order = [...out].sort((a, b) => (diff > 0 ? b.rest - a.rest : a.rest - b.rest));
  // A whole percent more only where the material still has room under its maximum.
  for (let i = 0; diff !== 0 && i < order.length * 20; i++) {
    const x = order[i % order.length]!;
    if (diff > 0 && x.v + 1 <= Math.max(1, x.m.max)) { x.v++; diff--; } else if (diff < 0 && x.v > 1) { x.v--; diff++; }
  }
  // Every material already at its maximum: the last percent goes to the gentlest, roomiest one (musk, cedar…).
  if (diff > 0) out.reduce((a, b) => (b.m.max > a.m.max ? b : a)).v += diff;
  return out.map(({ m, v }) => ({ m, v }));
}

const fmt = (n: number, lang: 'ar' | 'en') => new Intl.NumberFormat(lang === 'ar' ? 'ar-EG' : 'en-GB', { maximumFractionDigits: 1 }).format(n);
const LAYER_NAME: Record<Layer, { ar: string; en: string }> = { top: { ar: 'القمة', en: 'Top' }, heart: { ar: 'القلب', en: 'Heart' }, base: { ar: 'القاعدة', en: 'Base' } };

/** The full answer: explanation, the table with amounts, safety, the calculator block and two short questions. */
export function designReply(design: Design, lang: 'ar' | 'en' = 'ar'): string {
  const { brief } = design;
  const oilMl = (brief.bottleMl * brief.concentration) / 100;
  const alcoholMl = brief.bottleMl - oilMl;
  const ar = lang === 'ar';
  const rows = design.notes.map((n) => `| ${ar ? n.nameAr : n.nameEn} | ${LAYER_NAME[n.category][lang]} | ${fmt(n.percentageOfOil, lang)}% | ${fmt(Math.round(oilMl * n.percentageOfOil) / 100, lang)} ${ar ? 'مل' : 'ml'} |`);
  const typeName = { extrait: ar ? 'إكستريه' : 'Extrait', edp: 'EDP', edt: 'EDT', edc: 'EDC' }[brief.type];
  const formula = {
    title: design.title, author: ar ? 'شاهين — مقترح تجريبي' : 'Shaheen — trial proposal', concentrationPercent: brief.concentration, concentrationType: brief.type,
    bottleVolumeMl: brief.bottleMl, alcoholPercentage: 96, waterPercent: 0, fixativePercent: 0, macerationDays: design.macerationDays,
    summary: ar ? 'مقترح تجريبي يحتاج مراجعة السلامة واختبار صغير' : 'A trial proposal that needs a safety review and a small test',
    pyramidNotes: design.notes.map((n, i) => ({ id: `note-${i + 1}`, nameAr: n.nameAr, nameEn: n.nameEn, category: n.category, percentageOfOil: n.percentageOfOil })),
  };
  const tools = { tools: [
    { tool: 'concentration', bottleVolumeMl: brief.bottleMl, concentrationPercent: brief.concentration, concentrationType: brief.type, alcoholPercentage: 96, waterPercent: 0, fixativePercent: 0 },
    { tool: 'maceration', macerationDays: design.macerationDays },
  ] };
  const assumed = brief.explicitSize ? '' : ar ? ' (الحجم مش مذكور فاخترت 50 مل — تقدر تغيّره)' : ' (no size given, so 50 ml — you can change it)';
  const lines = ar ? [
    `### ${design.title}`,
    `تركيبة ${brief.moods.length ? `${brief.moods.join('، ')} ` : ''}بتركيز ${typeName} ${fmt(brief.concentration, lang)}% في زجاجة ${fmt(brief.bottleMl, lang)} مل${assumed}.`,
    '', '| المادة | الطبقة | من الزيت | الكمية |', '|---|---|---|---|', ...rows, '',
    `**الحساب:** زيت عطري = ${fmt(brief.bottleMl, lang)} × ${fmt(brief.concentration, lang)} ÷ 100 = **${fmt(oilMl, lang)} مل**، والباقي كحول 96% = **${fmt(alcoholMl, lang)} مل**.`,
    `**التعتيق:** ${fmt(design.macerationDays, lang)} يوم في مكان بارد ومظلم، مع رجّ خفيف كل كام يوم.`,
    '', '**قبل ما تبدأ:** دي تركيبة تجريبية. جرّبها الأول بكمية صغيرة (10 مل)، والتزم بحدود IFRA وشهادة المورد لكل مادة — خصوصاً القرفة والقرنفل والحمضيات — ومتحطش الزيوت مركّزة على الجلد.',
    '', 'تحب أخليها **أحلى** ولا **أنشف**؟ ولا أزوّد **الثبات** بعنبر أو مسك أكتر؟',
  ] : [
    `### ${design.title}`,
    `A ${brief.moods.length ? `${brief.moods.join(', ')} ` : ''}formula at ${typeName} ${fmt(brief.concentration, lang)}% in a ${fmt(brief.bottleMl, lang)} ml bottle${assumed}.`,
    '', '| Material | Layer | Of the oil | Amount |', '|---|---|---|---|', ...rows, '',
    `**Calculation:** perfume oil = ${fmt(brief.bottleMl, lang)} × ${fmt(brief.concentration, lang)} ÷ 100 = **${fmt(oilMl, lang)} ml**, the rest is 96% alcohol = **${fmt(alcoholMl, lang)} ml**.`,
    `**Maceration:** ${fmt(design.macerationDays, lang)} days somewhere cool and dark, shaking gently every few days.`,
    '', '**Before you start:** this is a trial formula. Test a small batch first (10 ml), keep within IFRA limits and each supplier\'s certificate — especially cinnamon, clove and citrus oils — and never put concentrated oils on skin.',
    '', 'Would you like it **sweeter** or **drier**? Or more **longevity** with extra amber or musk?',
  ];
  return `${lines.join('\n')}\n\n\`\`\`sham-formula\n${JSON.stringify(formula)}\n\`\`\`\n\n\`\`\`sham-tool\n${JSON.stringify(tools)}\n\`\`\``;
}

/** When the request names no direction at all: one short question with choices, instead of a guess. */
function askDirection(lang: 'ar' | 'en'): string {
  return lang === 'ar'
    ? 'أكيد أصممهولك 🌿 بس قولي اتجاهه الأول علشان ميطلعش تخمين:\n\n- **منعش** (حمضيات وبحري) ولا **دافي** (عنبر وتوابل) ولا **شرقي** (عود وورد) ولا **حلو** (فانيليا)؟\n- لمين: **رجالي** ولا **نسائي** ولا للاتنين؟\n- وكام مل؟ (لو مقلتش هعمله 50 مل EDP 20%)\n\nمثال: «صمم عطر شتوي رجالي فيه عود 50 مل».'
    : "Happy to design it 🌿 — just tell me its direction first so it isn't a guess:\n\n- **fresh** (citrus, marine), **warm** (amber, spice), **oriental** (oud, rose) or **sweet** (vanilla)?\n- for **men**, **women** or both?\n- and how many ml? (otherwise 50 ml EDP 20%)\n\nExample: “design a warm men's winter perfume with oud, 50 ml”.";
}

/**
 * The designer's answer to a message, or undefined when it is not a design request. `previous`: the visitor's
 * last request when he is refining a formula Shaheen just gave («خليه صيفي»).
 */
export function designAnswer(message: string, language: string, previous?: string): string | undefined {
  // He answers in the language the visitor wrote in (Arabic letters → Arabic, whatever the site language).
  const lang: 'ar' | 'en' = /[\u0600-\u06FF]/.test(message) || ((language === 'ar' || language === 'fa') && !/[a-z]{3}/i.test(message)) ? 'ar' : 'en';
  let brief = readBrief(message, lang);
  if (!brief && previous) {
    const before = readBrief(previous, lang);
    const now = readBrief(`صمم ${message}`, lang);
    if (before && now && (now.tags.length || now.named.length || now.explicitSize)) {
      // The new wish wins: «خليه صيفي» after a winter formula drops the warm side instead of mixing both.
      const turned = (now.fresh && before.warm) || (now.warm && before.fresh);
      brief = { ...before,
        tags: [...new Set([...now.tags, ...before.tags.filter((t) => !conflicts(t, now))])],
        moods: [...new Set([...now.moods, ...(turned ? [] : before.moods)])].slice(0, 3),
        named: [...new Set([...before.named, ...now.named])],
        bottleMl: now.explicitSize ? now.bottleMl : before.bottleMl, explicitSize: now.explicitSize || before.explicitSize,
        concentration: /تركيز|concentration|%/.test(asciiDigits(message)) || now.type !== 'edp' ? now.concentration : before.concentration,
        type: now.type !== 'edp' ? now.type : before.type,
        warm: now.warm || (before.warm && !now.fresh), fresh: now.fresh || (before.fresh && !now.warm) };
    }
  }
  if (!brief) return undefined;
  if (!brief.tags.length && !brief.named.length) return askDirection(lang);
  return designReply(composeDesign(brief, lang), lang);
}
const conflicts = (t: Tag, now: DesignBrief) => (now.fresh && ['warm', 'amber', 'gourmand', 'oud', 'smoky'].includes(t)) || (now.warm && ['aquatic', 'fresh', 'citrus'].includes(t));
