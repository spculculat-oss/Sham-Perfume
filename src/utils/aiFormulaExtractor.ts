import type { ConcentrationType, PyramidNote } from '../types/perfume';

export interface ExtractedAIPerfume {
  title: string;
  author: string;
  concentrationPercent: number;
  concentrationType: ConcentrationType;
  bottleVolumeMl: number;
  alcoholPercentage: number;
  waterPercent: number;
  fixativePercent: number;
  macerationDays: number;
  summary: string;
  pyramidNotes: PyramidNote[];
}

/*
 * Shaheen attaches a machine-readable formula so the site can show the calculator toolbar.
 * Canonical form:  ```sham-formula\n{…}\n```
 * Seen live (mostly in «تحليل معمّق», whose answers are long and compare alternatives): a ```json
 * label, the JSON on the fence line, a cut answer without the closing fence, Arabic digits, "20%"
 * strings, notes that add up to 99.9 or to the oil share of the whole product, and one block per
 * alternative. The raw JSON then showed under the answer and the toolbar disappeared.
 * Anything that is clearly a formula is read; anything that looks like one is hidden from the text.
 * Pure (no browser or server imports).
 */

const CONCENTRATION_TYPES: ConcentrationType[] = ['extrait', 'edp', 'edt', 'edc', 'eau_fraiche', 'aftershave', 'mist', 'oil_pure', 'custom'];
const TYPE_ALIASES: [RegExp, ConcentrationType][] = [
  [/^(extrait|parfum|pure parfum|extrait de parfum|elixir|برفان|اكستريت|إكستريه|خلاصة)/, 'extrait'],
  [/^(edp|eau de parfum|او دو بارفان|أو دو برفان|ماء العطر)/, 'edp'],
  [/^(edt|eau de toilette|او دو تواليت|أو دو تواليت|ماء التواليت)/, 'edt'],
  [/^(edc|cologne|eau de cologne|كولونيا)/, 'edc'],
  [/^(eau[ _]fraiche|eau fraîche)/, 'eau_fraiche'],
  [/^(after ?shave|افتر شيف|بعد الحلاقة)/, 'aftershave'],
  [/^(mist|body mist|hair mist|سبلاش|معطر الجسم)/, 'mist'],
  [/^(oil|oil_pure|pure oil|perfume oil|attar|زيت|دهن|عطر زيتي)/, 'oil_pure'],
];
const CATEGORY_ALIASES: Record<string, PyramidNote['category']> = {
  top: 'top', head: 'top', opening: 'top', 'top note': 'top', 'top notes': 'top',
  heart: 'heart', middle: 'heart', mid: 'heart', 'heart note': 'heart', 'heart notes': 'heart', 'middle notes': 'heart',
  base: 'base', bottom: 'base', dry: 'base', drydown: 'base', 'base note': 'base', 'base notes': 'base',
  'قمة': 'top', 'القمة': 'top', 'علوية': 'top', 'افتتاحية': 'top', 'رأس': 'top',
  'قلب': 'heart', 'القلب': 'heart', 'وسط': 'heart', 'وسطى': 'heart',
  'قاعدة': 'base', 'القاعدة': 'base', 'أساس': 'base', 'اساس': 'base', 'سفلية': 'base',
};
const DEFAULT_AUTHOR = 'شاهين — مقترح تجريبي';

const DIGITS: Record<string, string> = { '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4', '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
  '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4', '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9', '٫': '.', '،': ',' };

/** 20, "20", "20%", "٢٠٪", "20 ml" → 20. Anything else → NaN. */
function num(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : NaN;
  if (typeof value !== 'string') return NaN;
  const cleaned = value.replace(/[٠-٩۰-۹٫]/g, (c) => DIGITS[c]).trim()
    .replace(/\s*(%|٪|ml|مل|ملل|days?|يوم|أيام|ايام)\s*$/i, '').trim();
  return /^-?\d+(?:\.\d+)?$/.test(cleaned) ? Number(cleaned) : NaN;
}
const inRange = (value: number, min: number, max: number) => Number.isFinite(value) && value >= min && value <= max;
const text = (value: unknown, max = 2000): string =>
  typeof value === 'string' && value.trim() && value.length <= max ? value.trim() : '';
const pick = (o: Record<string, unknown>, ...keys: string[]) => {
  for (const k of keys) if (o[k] !== undefined && o[k] !== null && o[k] !== '') return o[k];
  return undefined;
};

function concentrationType(value: unknown): ConcentrationType | undefined {
  if (typeof value !== 'string' || !value.trim()) return undefined;
  const v = value.trim().toLowerCase().replace(/[.\-]/g, ' ').replace(/\s+/g, ' ');
  if ((CONCENTRATION_TYPES as string[]).includes(v.replace(/ /g, '_'))) return v.replace(/ /g, '_') as ConcentrationType;
  return TYPE_ALIASES.find(([re]) => re.test(v))?.[1] || 'custom';
}

/** JSON as models really write it: comments, trailing commas, smart quotes. */
function parseLoose(raw: string): unknown {
  const attempts = [raw];
  const repaired = raw.replace(/^\uFEFF/, '')
    .replace(/^\s*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/[“”]/g, '"').replace(/,\s*([}\]])/g, '$1');
  if (repaired !== raw) attempts.push(repaired);
  for (const attempt of attempts) {
    try { return JSON.parse(attempt); } catch { /* next */ }
  }
  return undefined;
}

/** End index (exclusive) of the JSON object starting at `from` ('{'), or -1. */
function objectEnd(source: string, from: number): number {
  let depth = 0;
  let inString = false;
  for (let i = from; i < source.length && i < from + 20000; i++) {
    const c = source[i];
    if (inString) {
      if (c === '\\') i++;
      else if (c === '"') inString = false;
    } else if (c === '"') inString = true;
    else if (c === '{') depth++;
    else if (c === '}' && --depth === 0) return i + 1;
  }
  return -1;
}

function notesFrom(value: unknown): unknown[] | undefined {
  if (Array.isArray(value)) return value;
  // {"top":[…],"heart":[…],"base":[…]}
  if (value && typeof value === 'object') {
    const out: unknown[] = [];
    for (const [key, list] of Object.entries(value as Record<string, unknown>)) {
      const category = CATEGORY_ALIASES[key.trim().toLowerCase()];
      if (!category || !Array.isArray(list)) return undefined;
      for (const note of list) out.push(note && typeof note === 'object' ? { category, ...(note as object) } : note);
    }
    return out;
  }
  return undefined;
}

/** Validates (and gently normalises) one parsed object. Never invents ingredients or proportions. */
export function normalizeFormula(value: unknown): ExtractedAIPerfume | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const f = value as Record<string, unknown>;
  const title = text(pick(f, 'title', 'name', 'nameAr', 'nameEn'), 200);
  const type = concentrationType(pick(f, 'concentrationType', 'type'));
  const concentrationPercent = num(pick(f, 'concentrationPercent', 'concentration', 'oilPercent'));
  const bottleVolumeMl = num(pick(f, 'bottleVolumeMl', 'bottleVolume', 'volumeMl', 'volume'));
  const alcoholPercentage = num(pick(f, 'alcoholPercentage', 'alcoholPercent', 'alcoholStrength'));
  const waterPercent = f.waterPercent === undefined ? 0 : num(f.waterPercent);
  const fixativePercent = f.fixativePercent === undefined ? 0 : num(f.fixativePercent);
  const macerationDays = num(pick(f, 'macerationDays', 'maceration', 'agingDays'));
  if (!title || !type || !inRange(concentrationPercent, 0.01, 100) || !inRange(bottleVolumeMl, 1, 10000) ||
    !inRange(alcoholPercentage, 0, 100) || !inRange(waterPercent, 0, 100) || !inRange(fixativePercent, 0, 100) ||
    !inRange(macerationDays, 0, 365) || concentrationPercent + waterPercent + fixativePercent > 100) return null;

  const rawNotes = notesFrom(pick(f, 'pyramidNotes', 'notes', 'ingredients'));
  if (!rawNotes?.length || rawNotes.length > 50) return null;
  const notes: PyramidNote[] = [];
  for (const [index, entry] of rawNotes.entries()) {
    if (!entry || typeof entry !== 'object') return null;
    const n = entry as Record<string, unknown>;
    const nameAr = text(pick(n, 'nameAr', 'arabic', 'name', 'nameEn'), 200);
    const nameEn = text(pick(n, 'nameEn', 'english', 'name', 'nameAr'), 200);
    const category = CATEGORY_ALIASES[String(pick(n, 'category', 'layer', 'type') ?? '').trim().toLowerCase()];
    const share = num(pick(n, 'percentageOfOil', 'percentage', 'percent', 'share'));
    if (!nameAr || !nameEn || !category || !inRange(share, 0.01, 100)) return null;
    notes.push({ id: `shaheen-note-${index}`, nameAr, nameEn, category, percentageOfOil: share });
  }

  // The calculator needs shares of the oil that add up to 100. Rounding (99.9) or shares of the whole
  // product (they add up to the concentration) keep their proportions; anything else is a broken recipe.
  const sum = notes.reduce((total, note) => total + note.percentageOfOil, 0);
  const ofProduct = Math.abs(sum - concentrationPercent) <= Math.max(0.05, concentrationPercent * 0.02);
  if (Math.abs(sum - 100) > 0.01) {
    if (Math.abs(sum - 100) > 2 && !ofProduct) return null;
    let assigned = 0;
    notes.forEach((note, i) => {
      note.percentageOfOil = i === notes.length - 1
        ? Math.round((100 - assigned) * 100) / 100
        : Math.round((note.percentageOfOil * 100 / sum) * 100) / 100;
      assigned += note.percentageOfOil;
    });
    if (notes.some((note) => note.percentageOfOil <= 0)) return null;
  }

  return { title, author: text(f.author, 200) || DEFAULT_AUTHOR, summary: text(f.summary) || title,
    concentrationType: type, concentrationPercent, bottleVolumeMl, alcoholPercentage, waterPercent, fixativePercent,
    macerationDays, pyramidNotes: notes };
}

interface FormulaSpan { start: number; end: number; formula: ExtractedAIPerfume | null }

const FENCE = /^([ \t]*)(`{3,}|~{3,})[ \t]*([^\n`]*)$/gm;
const FORMULA_LABEL = /sham[-_ ]?formula|^formula$/i;
const LOOSE_LABEL = /^(json5?|jsonc|js|javascript|text|txt|)$/i;
const looksLikeFormula = (body: string) => /"?(pyramidNotes|concentrationPercent)"?\s*:/.test(body);

/** Every formula-looking block in a reply (fenced with any label, cut short, or a bare JSON line). */
export function findFormulaBlocks(source: string): FormulaSpan[] {
  if (typeof source !== 'string' || !/sham[-_ ]?formula|pyramidNotes|concentrationPercent/i.test(source)) return [];
  const spans: FormulaSpan[] = [];
  FENCE.lastIndex = 0;
  for (let m = FENCE.exec(source); m; m = FENCE.exec(source)) {
    const marker = m[2];
    const lineEnd = m.index + m[0].length;
    const inline = m[3].indexOf('{');
    // ```sham-formula {"title":…}  (JSON on the fence line)
    const label = (inline >= 0 ? m[3].slice(0, inline) : m[3]).trim();
    const bodyStart = inline >= 0 ? lineEnd - m[3].length + inline : Math.min(lineEnd + 1, source.length);
    const closeRe = new RegExp(`^[ \\t]*\\${marker[0]}{${marker.length},}[ \\t]*$`, 'm');
    const rest = source.slice(bodyStart);
    const closeAt = rest.search(closeRe);
    const closeEnd = closeAt >= 0 ? bodyStart + closeAt + rest.slice(closeAt).match(closeRe)![0].length : -1;
    const body = closeAt >= 0 ? rest.slice(0, closeAt) : rest;
    const named = FORMULA_LABEL.test(label);
    if (!named && !(LOOSE_LABEL.test(label) && looksLikeFormula(body))) {
      FENCE.lastIndex = closeEnd > 0 ? closeEnd : lineEnd;
      continue;
    }
    const open = body.indexOf('{');
    const objEnd = open >= 0 ? objectEnd(body, open) : -1;
    const parsed = open >= 0 ? parseLoose(body.slice(open, objEnd > 0 ? objEnd : undefined)) : undefined;
    let end = closeEnd > 0 ? closeEnd : source.length;
    if (objEnd > 0) {
      // `}```` on the same line, or a cut fence: stop right after the object, never swallow the answer.
      const after = rest.slice(objEnd).match(new RegExp(`^[ \\t]*\\${marker[0]}{${marker.length},}`));
      if (after) end = bodyStart + objEnd + after[0].length;
      else if (closeEnd < 0) end = bodyStart + objEnd;
    }
    spans.push({ start: m.index, end, formula: normalizeFormula(parsed) });
    FENCE.lastIndex = Math.max(end, lineEnd);
  }
  // A bare JSON object on its own line (no fence at all).
  const bare = /^[ \t]*\{[ \t]*"(?:title|pyramidNotes|concentrationPercent)"/gm;
  for (let m = bare.exec(source); m; m = bare.exec(source)) {
    if (spans.some((s) => m!.index >= s.start && m!.index < s.end)) continue;
    const open = source.indexOf('{', m.index);
    const stop = objectEnd(source, open);
    const body = source.slice(open, stop > 0 ? stop : undefined);
    if (!looksLikeFormula(body)) continue;
    spans.push({ start: m.index, end: stop > 0 ? stop : source.length, formula: normalizeFormula(parseLoose(body)) });
    bare.lastIndex = stop > 0 ? stop : source.length;
  }
  return spans.sort((a, b) => a.start - b.start);
}

const fingerprint = (f: ExtractedAIPerfume) => JSON.stringify({ ...f, pyramidNotes: f.pyramidNotes.map(({ id: _id, ...n }) => n) });

/** All distinct transferable formulas in a reply, in order (a deep analysis may offer alternatives). */
export function extractFormulasFromAIMessage(source: string): ExtractedAIPerfume[] {
  const seen = new Set<string>();
  const out: ExtractedAIPerfume[] = [];
  for (const span of findFormulaBlocks(source)) {
    if (!span.formula) continue;
    const key = fingerprint(span.formula);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(span.formula);
  }
  return out.slice(0, 6);
}

/**
 * The one formula of a reply, for "apply it to the calculator" commands. Several different
 * formulas are ambiguous there, so none is picked; general advice never becomes a recipe.
 */
export function extractFormulaFromAIMessage(source: string): ExtractedAIPerfume | null {
  const formulas = extractFormulasFromAIMessage(source);
  return formulas.length === 1 ? formulas[0] : null;
}

/** Reply text without any formula block (the toolbar under the message presents it). */
export function removeFormulaBlocks(source: string): string {
  const spans = findFormulaBlocks(source);
  if (!spans.length) return source;
  let out = '';
  let last = 0;
  for (const s of spans) {
    if (s.start < last) continue;
    out += source.slice(last, s.start);
    last = s.end;
  }
  return (out + source.slice(last)).replace(/\n{3,}/g, '\n\n').trim();
}

/** Only an explicit transfer command may apply an older recipe instead of asking the AI. */
export function isFormulaTransferCommand(text: string): boolean {
  const command = text.trim().replace(/[.!؟]+$/, '').replace(/\s+/g, ' ');
  return /^(?:من فضلك )?(?:طبق|انقل|حوّل|حول)(?: (?:هذه|التركيبة|الوصفة|التوليفة|السابقة|الأخيرة))* (?:(?:على|في|إلى|الى) (?:ال)?حاسبة(?: التركيز)?|للحاسبة)$/.test(command) ||
    /^(?:please )?(?:apply|transfer|send) (?:(?:this|the|last|previous) )?(?:formula|recipe|blend) to (?:the )?calculator$/i.test(command);
}
