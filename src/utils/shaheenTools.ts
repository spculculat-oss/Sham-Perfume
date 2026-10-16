import type { ConcentrationType } from '../types/perfume';
import type { ExtractedAIPerfume } from './aiFormulaExtractor';

/**
 * Links each Shaheen answer to the site's calculators — but only the ones that fit the question.
 *
 * 1. Understand the question first: its nature (designing a formula, oil/alcohol amounts, alcohol
 *    dilution, maceration/aging, costing, the pyramid, a raw material, fixatives) decides which tools
 *    are relevant. A short follow-up («طيب ولو 100 مل؟») inherits the previous question's nature.
 *    Greetings, medical questions and errors get no tools.
 * 2. Then read the values: from Shaheen's explicit ```sham-tool block when present, else from the
 *    question and the answer (Arabic or Latin digits, ranges, weeks/months → days). Values outside
 *    sane bounds are dropped, never invented; a tool without values just opens the tool.
 * Pure (no browser or server imports), shared by both chat surfaces and the tests.
 */

export type ShaheenTool = 'concentration' | 'pyramid' | 'maceration' | 'alcohol' | 'costing' | 'raw_materials' | 'guide' | 'store';
export type ShaheenIntent = 'formula' | ShaheenTool;

export interface ToolLink {
  tool: ShaheenTool;
  bottleVolumeMl?: number;
  concentrationPercent?: number;
  concentrationType?: ConcentrationType;
  alcoholPercentage?: number;
  waterPercent?: number;
  fixativePercent?: number;
  macerationDays?: number;
  /** Alcohol dilution: strength you have → strength you want, and the final volume. */
  alcoholFrom?: number;
  alcoholTo?: number;
  finalVolumeMl?: number;
  /** Raw-material encyclopedia search, or the visitor's wish for «اسأل شاهين» in the store. */
  search?: string;
}

const DIGITS: Record<string, string> = { '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4', '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
  '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4', '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9', '٫': '.', '٪': '%' };
export const normalizeDigits = (s: string) => s.replace(/[٠-٩۰-۹٫٪]/g, (c) => DIGITS[c]);

/* ---------------------------------- 1. the question's nature ---------------------------------- */

const INTENT_PATTERNS: [ShaheenIntent, RegExp][] = [
  ['formula', /(صمم|صمّم|ركب|ركّب|اقترح|اعمل|اعملي|ابتكر|كوّن|كون)\s*(لي|لى|ليا)?\s*(عطر|تركيبة|تركيبه|خلطة|خلطه|وصفة|وصفه|برفان)|تركيبة|تركيبه|خلطة|خلطه|وصفة عطر|\b(formula|recipe|blend|accord|design (?:a|me a) (?:perfume|fragrance))\b/i],
  ['alcohol', /تخفيف\s*(ال)?كحول|خفف\s*(ال)?كحول|أخفف\s*(ال)?كحول|اخفف\s*(ال)?كحول|تخفيف\s*الإيثانول|درجة\s*(ال)?كحول|كحول\s*\d+\s*%?\s*(إلى|الى|ل|لـ)\s*\d+|\b(dilut\w*\s+(the\s+)?(alcohol|ethanol)|(alcohol|ethanol)\s+dilution|proof|abv)\b/i],
  ['maceration', /تعتيق|التعتيق|عتّق|عتق|نقع|النقع|تخمير|يرتاح|راحة العطر|\b(macerat\w*|aging|ageing|mature|maturation|rest(ing)? (period|time))\b/i],
  ['costing', /تكلف|تكاليف|سعر|أسعار|اسعار|تسعير|ربح|أرباح|ارباح|هامش|بكام|بكم\s*(أبيع|ابيع)|\b(cost\w*|price|pricing|profit|margin)\b/i],
  ['concentration', /كم\s*(مل|ملل|جرام|غرام|جم)?\s*(من\s*)?(ال)?(زيت|كحول|ماء|مثبت)|كمية\s*(ال)?(زيت|كحول)|نسبة\s*(ال)?(تركيز|زيت|كحول|ماء)|تركيز|حاسبة التركيب|\b(how much (oil|alcohol|ethanol)|concentration|dilution rate|oil percentage|edp|edt|extrait)\b/i],
  ['pyramid', /هرم|نوتات|نوتة|نوته|\b(pyramid|top notes?|heart notes?|middle notes?|base notes?)\b/i],
  ['raw_materials', /مادة خام|مواد خام|المواد الخام|خامات|خامة|(ما هو|ما هي|ايه هو|إيه هو|ايه هي|إيه هي|معلومات عن)\s+(زيت|مادة|خامة)|\b(raw materials?|ingredients?|what (is|are) (an? )?[\w-]+ (oil|absolute)|essential oils?)\b/i],
  ['guide', /مثبت|مثبتات|ثبات|الثبات|فوحان|\b(fixative|fixation|longevity|sillage)\b/i],
  // Shopping: the visitor wants a ready perfume, not a formula → «متجر شام» with «اسأل شاهين».
  ['store', /(?<![\u0621-\u064A])(?:أشتري|اشتري|اشترى|هشتري|شراء|متجر|المتجر|عندكم|رشحلي|رشح لي|رشّح لي|ترشيح|ترشح لي|انصحني|تنصحني|هدية|هديه|اطلب عطر|أطلب عطر)(?![\u0621-\u064A])|(?:عايز|عايزة|عاوز|محتاج|محتاجة|ابغى|أبغى|أريد|اريد)\s+(?:عطر|برفان|برفيوم)(?!\s*(?:أركب|اركب|اعمل|أعمل))|\b(buy|shop|store|gift|recommend (?:me )?(?:a )?(?:perfume|fragrance|scent)|which perfume should)\b/i],
];
const COST_WORDS = /تكلف|تكاليف|ربح|أرباح|ارباح|هامش|تسعير|\b(cost\w*|profit|margin|pricing)\b/i;
const NO_TOOLS = /^(مرحبا|اهلا|أهلا|السلام عليكم|هاي|hi|hello|hey|شكرا|شكراً|thanks?|thank you)[\s!.؟?]*$/i;
const MEDICAL = /حامل|حوامل|رضيع|أطفال|اطفال|ربو|حساسية|علاج|دواء|جرعة|بلع|\b(pregnan\w*|baby|infant|asthma|allerg\w*|medical|dose|ingest\w*)\b/i;

/** The kinds of help a question asks for, most specific first. */
export function questionIntents(question: string, previousQuestion = ''): ShaheenIntent[] {
  const q = normalizeDigits(question || '').trim();
  if (!q || NO_TOOLS.test(q) || MEDICAL.test(q)) return [];
  let found = INTENT_PATTERNS.filter(([, re]) => re.test(q)).map(([intent]) => intent);
  // «بكام عطر العود عندكم؟» asks the store's price, not the production-cost calculator.
  if (found.includes('store') && !COST_WORDS.test(q)) found = found.filter((i) => i !== 'costing');
  // «طيب ولو 100 مل؟» / «and for 45 days?» — a short follow-up keeps the topic of the question before it.
  if (!found.length && previousQuestion && q.length <= 80) return questionIntents(previousQuestion);
  return found;
}

/* ----------------------------------------- 2. values ----------------------------------------- */

const inRange = (n: number | undefined, min: number, max: number) => n !== undefined && Number.isFinite(n) && n >= min && n <= max;
const firstNumber = (re: RegExp, text: string): number | undefined => {
  const m = text.match(re);
  return m ? Number(m[1]) : undefined;
};

export function volumeMl(text: string): number | undefined {
  const t = normalizeDigits(text);
  const ml = firstNumber(/(?<![\d.])(\d+(?:\.\d+)?)\s*(?:مللي|ملل|ملي|مل|ml|millilit\w*)(?![a-z\u0621-\u064A])/i, t);
  if (inRange(ml, 1, 10000)) return ml;
  const l = firstNumber(/(?<![\d.])(\d+(?:\.\d+)?)\s*(?:لتر|ليتر|liters?|litres?|l)(?![a-z\u0621-\u064A])/i, t);
  return l !== undefined && inRange(l * 1000, 1, 10000) ? l * 1000 : undefined;
}

// Arabic words need real word edges: «مست» must not match «مستخدم / المستدمجة / مستوى» (seen live:
// a costing answer opened the calculator as «MIST»), and «دهن العود» is an ingredient, not a perfume oil.
const AR = '\\u0600-\\u06FF';
const arWord = (alternatives: string) => new RegExp(`(?<![${AR}])(?:وبال|بال|وال|لل|ال|و|ب|ل)?(?:${alternatives})(?![${AR}])`, 'i');
const TYPE_WORDS: [RegExp, ConcentrationType][] = [
  [/\bedp\b|eau de parfum|أو دو بارفان|او دي بارفان|أو دي بارفان|(?:او|أو) (?:دو|دي) برفان/i, 'edp'],
  [/extrait|parfum\b/i, 'extrait'], [arWord('إكستري|اكستريت|اكستريه|إكستريه|برفان'), 'extrait'],
  [/\bedt\b|eau de toilette/i, 'edt'], [arWord('تواليت'), 'edt'],
  [/\bedc\b|cologne/i, 'edc'], [arWord('كولونيا'), 'edc'],
  [/\b(?:body\s+)?mist\b|\bsplash\b/i, 'mist'], [arWord('مست|ميست|بودي مست|سبلاش|معطر جسم'), 'mist'],
  [/perfume oil|\battar\b/i, 'oil_pure'], [arWord('زيت عطري مركز|عطر زيتي|عطور زيتية|دهن(?! ?(?:ال)?عود)'), 'oil_pure'],
];
export const concentrationTypeIn = (text: string) => TYPE_WORDS.find(([re]) => re.test(text))?.[1];

/** Oil concentration: a percentage next to تركيز/زيت/concentration/EDP…, never the alcohol strength. */
export function concentrationPercentIn(text: string): number | undefined {
  const t = normalizeDigits(text);
  const near = t.match(/(?:تركيز|بتركيز|نسبة\s*(?:ال)?زيت|زيت\s*(?:بنسبة)?|concentration|oil)\D{0,20}?(\d+(?:\.\d+)?)\s*%/i)
    || t.match(/(\d+(?:\.\d+)?)\s*%\s*(?:تركيز|زيت|oil|concentration|edp|edt|extrait|parfum|إكستري|أو دو)/i);
  const n = near ? Number(near[1]) : undefined;
  return inRange(n, 0.5, 100) ? n : undefined;
}

/** Alcohol dilution: "من 96% إلى 70%", "96 to 80", "خفف كحول 95 لـ 75". Higher → lower only. */
export function alcoholDilutionIn(text: string): { from?: number; to?: number } {
  const t = normalizeDigits(text);
  const m = t.match(/(?<![\d.])(\d{2,3}(?:\.\d+)?)\s*%?\s*(?:إلى|الى|لحد|لـ|ل|→|->|to|into|down to)\s*(\d{1,2}(?:\.\d+)?)\s*%?/i);
  if (m) {
    const from = Number(m[1]);
    const to = Number(m[2]);
    if (inRange(from, 2, 100) && inRange(to, 1, 99) && from > to) return { from, to };
  }
  const strength = firstNumber(/(?:كحول|الكحول|إيثانول|ايثانول|alcohol|ethanol)\D{0,12}?(\d{2}(?:\.\d+)?)\s*%/i, t);
  return inRange(strength, 2, 100) ? { from: strength } : {};
}

/** Maceration in days: "45 يوم", "4-6 أسابيع" (→ 42, the safe end of a range), "شهرين", "2 months". */
export function macerationDaysIn(text: string): number | undefined {
  const t = normalizeDigits(text).replace(/شهرين|شهران/g, '2 أشهر').replace(/أسبوعين|اسبوعين|أسبوعان/g, '2 أسابيع');
  const m = t.match(/(\d+(?:\.\d+)?)(?:\s*(?:-|–|—|إلى|الى|او|أو|to|or)\s*(\d+(?:\.\d+)?))?\s*(يوم|يوماً|يوما|أيام|ايام|days?|أسبوع|اسبوع|أسابيع|اسابيع|weeks?|شهر|أشهر|اشهر|شهور|months?)/i);
  if (!m) return undefined;
  const n = Math.max(Number(m[1]), m[2] ? Number(m[2]) : 0);
  const unit = m[3].toLowerCase();
  const factor = /أسبوع|اسبوع|أسابيع|اسابيع|week/.test(unit) ? 7 : /شهر|أشهر|اشهر|شهور|month/.test(unit) ? 30 : 1;
  const days = Math.round(n * factor);
  return inRange(days, 1, 365) ? days : undefined;
}

/** A raw material asked about: «ما هو زيت الصندل؟», «what is ambroxan?». */
export function materialIn(text: string): string | undefined {
  const t = text.trim();
  const m = t.match(/(?:ما هو|ما هي|ايه هو|إيه هو|ايه هي|إيه هي|عرفني على|معلومات عن)\s+(?:زيت|مادة|خامة|ال)?\s*([^\s؟?.!,،]+(?:\s+[^\s؟?.!,،]+)?)/)
    || t.match(/\bwhat (?:is|are)\s+(?:an?\s+)?([a-z][\w-]*(?:\s+(?!oil\b)[a-z][\w-]*)?)(?:\s+oil)?/i);
  const name = m?.[1]?.replace(/^ال(?=\S{3,})/, '').trim();
  return name && name.length >= 2 && name.length <= 40 ? name : undefined;
}

/* ------------------------------- explicit blocks from Shaheen -------------------------------- */

const TOOL_FENCE = /```[ \t]*sham[-_ ]?tools?[^\n]*\n([\s\S]*?)(?:```|$)/gi;
const TOOLS: ShaheenTool[] = ['concentration', 'pyramid', 'maceration', 'alcohol', 'costing', 'raw_materials', 'guide', 'store'];
const CONCENTRATION_TYPES: ConcentrationType[] = ['extrait', 'edp', 'edt', 'edc', 'eau_fraiche', 'aftershave', 'mist', 'oil_pure', 'custom'];

function sanitize(raw: Record<string, unknown>): ToolLink | null {
  const tool = String(raw.tool || '').trim().toLowerCase().replace(/[\s-]+/g, '_') as ShaheenTool;
  if (!TOOLS.includes(tool)) return null;
  const n = (k: string) => {
    const v = raw[k];
    const num = typeof v === 'number' ? v : typeof v === 'string' ? Number(normalizeDigits(v).replace(/[%\s]|ml|مل/gi, '')) : NaN;
    return Number.isFinite(num) ? num : undefined;
  };
  const link: ToolLink = { tool };
  const put = <K extends keyof ToolLink>(key: K, value: ToolLink[K] | undefined, ok: boolean) => { if (value !== undefined && ok) link[key] = value; };
  const vol = n('bottleVolumeMl'); put('bottleVolumeMl', vol, inRange(vol, 1, 10000));
  const conc = n('concentrationPercent'); put('concentrationPercent', conc, inRange(conc, 0.01, 100));
  const alc = n('alcoholPercentage'); put('alcoholPercentage', alc, inRange(alc, 1, 100));
  const water = n('waterPercent'); put('waterPercent', water, inRange(water, 0, 100));
  const fix = n('fixativePercent'); put('fixativePercent', fix, inRange(fix, 0, 100));
  const days = n('macerationDays'); put('macerationDays', days === undefined ? undefined : Math.round(days), inRange(days, 1, 365));
  const from = n('alcoholFrom'); const to = n('alcoholTo');
  if (inRange(from, 2, 100) && (to === undefined || (inRange(to, 1, 99) && to < from!))) { link.alcoholFrom = from; if (to !== undefined) link.alcoholTo = to; }
  const fv = n('finalVolumeMl'); put('finalVolumeMl', fv, inRange(fv, 1, 100000));
  if (typeof raw.concentrationType === 'string') {
    const ct = raw.concentrationType.trim().toLowerCase();
    const type = (CONCENTRATION_TYPES as string[]).includes(ct) ? ct as ConcentrationType : concentrationTypeIn(ct);
    if (type) link.concentrationType = type;
  }
  if (typeof raw.search === 'string' && raw.search.trim().length >= 2 && raw.search.length <= (tool === 'store' ? 160 : 60)) link.search = raw.search.trim();
  return link;
}

/** Tool links Shaheen attached himself (```sham-tool {"tools":[…]}), already validated. */
export function explicitToolLinks(answer: string): ToolLink[] {
  const out: ToolLink[] = [];
  for (const m of (answer || '').matchAll(TOOL_FENCE)) {
    try {
      const data = JSON.parse(m[1].trim());
      const list = Array.isArray(data) ? data : Array.isArray(data?.tools) ? data.tools : [data];
      for (const raw of list) if (raw && typeof raw === 'object') { const l = sanitize(raw); if (l) out.push(l); }
    } catch { /* ignore a broken block */ }
  }
  return out;
}

/** Answer text without the machine-readable tool block. */
export function removeToolBlocks(text: string): string {
  return text.replace(TOOL_FENCE, '').replace(/\n{3,}/g, '\n\n').trim();
}

/* ------------------------------------------ linking ------------------------------------------ */

export interface LinkInput {
  question: string;
  previousQuestion?: string;
  answer: string;
  /** Formulas found in the answer: the formula toolbar already covers the lab, pyramid and costing for them. */
  formulas?: ExtractedAIPerfume[];
}

const ORDER: ShaheenTool[] = ['store', 'concentration', 'alcohol', 'maceration', 'pyramid', 'costing', 'raw_materials', 'guide'];

/** The calculators this answer should open, with the values the question and answer give. */
export function linkTools({ question, previousQuestion = '', answer, formulas = [] }: LinkInput): ToolLink[] {
  const explicit = explicitToolLinks(answer);
  const intents = questionIntents(question, previousQuestion);
  if (!explicit.length && !intents.length) return [];
  const q = normalizeDigits(question || '');
  const a = normalizeDigits(removeToolBlocks(answer || ''));
  const both = `${q}\n${a}`;
  const links = new Map<ShaheenTool, ToolLink>();
  for (const l of explicit) links.set(l.tool, l);
  const hasFormula = formulas.length > 0;

  for (const intent of intents) {
    if (intent === 'formula') continue; // the formula toolbar handles a full recipe
    if (links.has(intent)) continue;
    // With a full formula, the lab / pyramid / costing buttons of the formula toolbar already apply it.
    if (hasFormula && (intent === 'concentration' || intent === 'pyramid' || intent === 'costing')) continue;
    const link: ToolLink = { tool: intent };
    if (intent === 'concentration' || intent === 'costing') {
      // The question states what the visitor has; the answer may complete it.
      const vol = volumeMl(q) ?? volumeMl(a);
      const conc = concentrationPercentIn(q) ?? concentrationPercentIn(a);
      const type = concentrationTypeIn(q) ?? concentrationTypeIn(a);
      if (vol !== undefined) link.bottleVolumeMl = vol;
      if (conc !== undefined) link.concentrationPercent = conc;
      if (type) link.concentrationType = type;
    } else if (intent === 'alcohol') {
      const { from, to } = alcoholDilutionIn(q).to !== undefined ? alcoholDilutionIn(q) : alcoholDilutionIn(both);
      if (from !== undefined) link.alcoholFrom = from;
      if (to !== undefined) link.alcoholTo = to;
      const vol = volumeMl(q);
      if (vol !== undefined) link.finalVolumeMl = vol;
    } else if (intent === 'maceration') {
      // The recommendation is in the answer; a number in the question is what the visitor asks about.
      const days = macerationDaysIn(a) ?? macerationDaysIn(q);
      if (days !== undefined) link.macerationDays = days;
    } else if (intent === 'raw_materials') {
      const name = materialIn(question);
      if (name) link.search = name;
    } else if (intent === 'store') {
      const wish = (question || '').replace(/\s+/g, ' ').trim().slice(0, 160);
      if (wish.length >= 2) link.search = wish;
    }
    links.set(intent, link);
  }

  // A full formula also carries its maceration: offer the simulator with the formula's own days.
  if (hasFormula && !links.has('maceration') && formulas[0].macerationDays > 0) {
    links.set('maceration', { tool: 'maceration', macerationDays: formulas[0].macerationDays });
  }
  return ORDER.filter((t) => links.has(t)).map((t) => links.get(t)!).slice(0, 4);
}
