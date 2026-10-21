/**
 * «المترجم الذكي» — the AI half of Shaheen's language agent (pure helpers; run.mts does the I/O).
 *
 * The deterministic audit (./audit.ts) measures; this part acts:
 *   1. finds every visitor string a language still shows in English (t() keys, store keys, and the
 *      inline {ar, en, …} dictionaries of the screens),
 *   2. asks an AI engine to translate them in batches, with the platform's own terms as a glossary,
 *   3. accepts a translation only if it passes strict checks (placeholders kept, the language's own
 *      script, no Arabic in a non-Arabic language, never a copy of the English, sane length),
 *   4. when a second engine is available, lets it review the batch and drops what it rejects,
 *   5. writes src/لغات/ai/<lang>.json, read by the site (src/لغات/aiPacks.ts).
 *
 * It also links the design department: the languages the design audit (Manus, manus-audit.json) found
 * half-translated are translated first, and the English phrases it quoted are located in the source.
 */

export type Pack = 'ui' | 'store' | 'text';
export interface TextUnit {
  pack: Pack;
  /** ui/store: the key; text: the English source itself. */
  key: string;
  en: string;
  /** 1 = interface and store words, 2 = screens' inline texts, 3 = long content. */
  tier: 1 | 2 | 3;
}
export interface AiPackFile { ui?: Record<string, string>; store?: Record<string, string>; text?: Record<string, string> }

// ─────────────────────────────────────────────────────────────── scripts

type Script = 'latn' | 'cyrl' | 'arab' | 'hebr' | 'grek' | 'geor' | 'armn' | 'ethi' | 'deva' | 'beng' | 'guru' | 'gujr' | 'orya'
  | 'taml' | 'telu' | 'knda' | 'mlym' | 'sinh' | 'mymr' | 'khmr' | 'laoo' | 'thai' | 'tibt' | 'hans' | 'jpan' | 'kore';
const SCRIPT_RE: Record<Script, RegExp> = {
  latn: /\p{Script=Latin}/u, cyrl: /\p{Script=Cyrillic}/u, arab: /\p{Script=Arabic}/u, hebr: /\p{Script=Hebrew}/u, grek: /\p{Script=Greek}/u,
  geor: /\p{Script=Georgian}/u, armn: /\p{Script=Armenian}/u, ethi: /\p{Script=Ethiopic}/u, deva: /\p{Script=Devanagari}/u,
  beng: /\p{Script=Bengali}/u, guru: /\p{Script=Gurmukhi}/u, gujr: /\p{Script=Gujarati}/u, orya: /\p{Script=Oriya}/u, taml: /\p{Script=Tamil}/u,
  telu: /\p{Script=Telugu}/u, knda: /\p{Script=Kannada}/u, mlym: /\p{Script=Malayalam}/u, sinh: /\p{Script=Sinhala}/u, mymr: /\p{Script=Myanmar}/u,
  khmr: /\p{Script=Khmer}/u, laoo: /\p{Script=Lao}/u, thai: /\p{Script=Thai}/u, tibt: /\p{Script=Tibetan}/u, hans: /\p{Script=Han}/u,
  jpan: /[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u, kore: /\p{Script=Hangul}/u,
};
const SCRIPT_OF: Record<string, Script[]> = {
  ru: ['cyrl'], uk: ['cyrl'], bg: ['cyrl'], mk: ['cyrl'], be: ['cyrl'], kk: ['cyrl'], mn: ['cyrl'], ky: ['cyrl'], tg: ['cyrl'],
  sr: ['cyrl', 'latn'], // Serbian is written in both alphabets
  ar: ['arab'], fa: ['arab'], ur: ['arab'], ps: ['arab'], sd: ['arab'], he: ['hebr'], el: ['grek'], ka: ['geor'], hy: ['armn'],
  am: ['ethi'], ti: ['ethi'], hi: ['deva'], ne: ['deva'], mr: ['deva'], bn: ['beng'], as: ['beng'], pa: ['guru'], gu: ['gujr'],
  or: ['orya'], ta: ['taml'], te: ['telu'], kn: ['knda'], ml: ['mlym'], si: ['sinh'], my: ['mymr'], km: ['khmr'], lo: ['laoo'],
  th: ['thai'], bo: ['tibt'], dz: ['tibt'], zh: ['hans'], ja: ['jpan'], ko: ['kore'],
};
export const scriptsOf = (lang: string): Script[] => SCRIPT_OF[lang] || ['latn'];
const ARABIC = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;

const placeholders = (s: string) => (s.match(/\{\w+\}/g) || []).sort().join(',');
const words = (s: string) => s.replace(/\{\w+\}/g, ' ').split(/\s+/).filter((w) => /\p{L}{2,}/u.test(w));
const tags = (s: string) => (s.match(/<\/?[a-z][^>]*>/gi) || []).length;

/** Why a translation cannot be used (undefined = it passes). */
export function validateTranslation(lang: string, en: string, text: unknown): string | undefined {
  if (typeof text !== 'string') return 'not_text';
  const t = text.trim();
  if (!t) return 'empty';
  if (t.length > en.length * 3 + 40) return 'too_long';
  if (placeholders(en) !== placeholders(t)) return 'placeholders';
  if (tags(en) !== tags(t)) return 'markup';
  if (/\n/.test(t) && !/\n/.test(en)) return 'extra_lines';
  const scripts = scriptsOf(lang);
  if (!scripts.includes('arab') && ARABIC.test(t)) return 'arabic_in_non_arabic_language';
  const multiWord = words(en).length >= 2;
  if (multiWord && !scripts.some((s) => SCRIPT_RE[s].test(t))) return 'wrong_script';
  if (multiWord && t.toLowerCase() === en.trim().toLowerCase() && !(lang === 'en')) return 'copy_of_english';
  if (/^(?:translation|note|sure|here is)\b/i.test(t) && !/^(?:translation|note|sure|here is)\b/i.test(en)) return 'chatter';
  return undefined;
}

// ─────────────────────────────────────────────────────────────── gaps

/** A string the language shows in English today (and the agent has not translated yet). */
export function missingFor(lang: string, units: readonly TextUnit[], own: (u: TextUnit) => string | undefined, ai: AiPackFile): TextUnit[] {
  return units.filter((u) => {
    if (ai[u.pack]?.[u.key]) return false;
    const mine = own(u);
    if (!mine) return true;
    // A hand-made «translation» that is only the English copied over (several words) counts as missing.
    return words(u.en).length >= 2 && mine.trim() === u.en.trim();
  });
}

const STR = String.raw`(?:'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"|\`((?:[^\`\\$\n]|\\.)*)\`)`;
const EN_RE = new RegExp(String.raw`(?:^|[\s{,])en:\s*` + STR);
const unescape = (s: string) => s.replace(/\\(u[0-9a-fA-F]{4}|.)/g, (_, c: string) => (c.length === 5 ? String.fromCharCode(parseInt(c.slice(1), 16)) : c === 'n' ? '\n' : c === 't' ? '\t' : c));

/** The one-line {ar, en, …} dictionaries of a source file: the English text and the languages present. */
export function harvestInlineTexts(source: string): { en: string; langs: Set<string>; line: number }[] {
  const out: { en: string; langs: Set<string>; line: number }[] = [];
  source.split('\n').forEach((line, i) => {
    if (!/(?:^|[\s{,])ar:\s*['"`]/.test(line)) return;
    const m = EN_RE.exec(line);
    if (!m) return;
    const en = unescape(m[1] ?? m[2] ?? m[3] ?? '').trim();
    if (!en || !/\p{L}{2,}/u.test(en)) return;
    const langs = new Set([...line.matchAll(/(?:^|[\s{,])([a-z]{2}):\s*['"`]/g)].map((x) => x[1]));
    out.push({ en, langs, line: i + 1 });
  });
  return out;
}

// ─────────────────────────────────────────────────────────────── the design department's findings

interface AuditIssue { area?: string; language?: string; problem?: string; fix?: string; page?: string }
/** Languages the design audit found half-translated: translated first. */
export function auditLanguages(audit: unknown, supported: readonly string[]): string[] {
  const issues = ((audit as { issues?: AuditIssue[] })?.issues || []).filter((i) => i?.area === 'languages');
  const out: string[] = [];
  for (const i of issues) for (const code of String(i.language || '').split(/[\s,،]+/)) {
    if (supported.includes(code) && code !== 'ar' && code !== 'en' && !out.includes(code)) out.push(code);
  }
  return out;
}
const IGNORED_PHRASES = /^(?:RTL|LTR|WCAG|SAR|SGD|EGP|USD|ml|g|AI|API|Sham|SHAM|Shaheen|Pashto|Albanian|Icelandic|Arabic|English)$/i;
/** English phrases the audit quoted as «shown in English» (2+ words or a long word). */
export function auditPhrases(audit: unknown): string[] {
  const issues = ((audit as { issues?: AuditIssue[] })?.issues || []).filter((i) => i?.area === 'languages' || i?.area === 'store' || i?.area === 'shaheen');
  const found = new Set<string>();
  for (const i of issues) {
    for (const m of `${i.problem || ''} ${i.fix || ''}`.matchAll(/[A-Za-z][A-Za-z'’-]*(?:[ ·&][A-Za-z][A-Za-z'’-]*)*/g)) {
      const phrase = m[0].replace(/^[\s·&]+|[\s·&]+$/g, '').trim();
      const n = phrase.split(/\s+/).filter((w) => /[A-Za-z]{2,}/.test(w)).length;
      if ((n >= 2 || phrase.length >= 9) && !IGNORED_PHRASES.test(phrase) && !/\b(?:is|sq|ps)\b\/?/.test(phrase)) found.add(phrase);
    }
  }
  return [...found].slice(0, 20);
}
/**
 * Is this line really showing English to a visitor? A line that carries an inline dictionary's English copy
 * (`en: 'Live Sync'`) is the translation source, not a hard-coded label, and a phrase used only as a key or a
 * JSX attribute name (`placeholder={L('placeholder')}`) never reaches the screen either. Both used to be
 * reported as «English text on the screen» (seen live: «Live Sync» in HomeHub.tsx, «placeholder» in
 * ShamAssistant.tsx) and sent translators after phantom work.
 */
export function isVisibleEnglishLine(line: string, phrase: string): boolean {
  if (/\ben\s*:\s*['"`]/.test(line)) return false; // the English copy of an inline {ar, en, …} dictionary
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const hits = [...line.matchAll(new RegExp(escaped, 'gi'))];
  if (!hits.length) return false;
  return hits.some((m) => {
    const at = m.index ?? 0;
    const before = line.slice(Math.max(0, at - 32), at);
    const after = line.slice(at + m[0].length);
    if (/^\s*=/.test(after)) return false; // a JSX attribute name, not a label
    if (/(?:\bL|\bT|\bloc|\btx)\(\s*['"`]$/.test(before)) return false; // a translation key
    return true;
  });
}

/** Where those phrases live in the visitor code (file:line), so the fix is one click away. */
export function locatePhrases(phrases: readonly string[], files: readonly { file: string; source: string }[]): { phrase: string; file: string; line: number }[] {
  const out: { phrase: string; file: string; line: number }[] = [];
  for (const phrase of phrases) {
    const needle = phrase.toLowerCase().replace(/\s*·\s*/g, ' ');
    let hits = 0;
    for (const { file, source } of files) {
      const lines = source.split('\n');
      for (let i = 0; i < lines.length && hits < 3; i++) {
        if (/^\s*(?:\/\/|\*|\/\*|\{\/\*)/.test(lines[i])) continue; // comments are not on the screen
        if (!lines[i].toLowerCase().replace(/\s*·\s*/g, ' ').includes(needle)) continue;
        if (!isVisibleEnglishLine(lines[i], phrase)) continue;
        out.push({ phrase, file, line: i + 1 }); hits++;
      }
    }
  }
  return out;
}

/** Physical left/right classes break the mirrored layout of the right-to-left languages (design signal). */
export function findPhysicalDirection(source: string): number {
  const classes = source.match(/className=(?:"[^"]*"|'[^']*'|\{`[^`]*`\})/g) || [];
  let n = 0;
  for (const c of classes) n += (c.match(/(?:^|[\s"'`:])(?:-?m[lr]-|p[lr]-|left-|right-|text-(?:left|right)\b|rounded-[lr]\b|rounded-[tb][lr]-|border-[lr]\b|border-[lr]-)/g) || []).length;
  return n;
}

// ─────────────────────────────────────────────────────────────── batches and prompts

export interface WorkItem { lang: string; tier: number; units: TextUnit[] }
/**
 * The run's work, cheapest-to-most-visible first: interface/store words for every language before the
 * screens' long texts; inside a tier the design audit's languages come first, then the platform order.
 */
export function planWork(gaps: Record<string, TextUnit[]>, order: readonly string[], priority: readonly string[], maxUnits = 120, maxChars = 6000): WorkItem[] {
  const langs = [...new Set([...priority, ...order])].filter((l) => gaps[l]?.length);
  const items: WorkItem[] = [];
  for (const tier of [1, 2, 3]) {
    for (const lang of langs) {
      const units = gaps[lang].filter((u) => u.tier === tier);
      let batch: TextUnit[] = []; let chars = 0;
      for (const u of units) {
        if (batch.length && (batch.length >= maxUnits || chars + u.en.length > maxChars)) { items.push({ lang, tier, units: batch }); batch = []; chars = 0; }
        batch.push(u); chars += u.en.length;
      }
      if (batch.length) items.push({ lang, tier, units: batch });
    }
  }
  return items;
}

export function translateSystem(langName: string, native: string, code: string, guidance = ''): string {
  return `You are the senior localizer of «Sham» (صمم عطرك مع شام), a perfume-formulation and fragrance shop platform.
Translate interface texts from English into ${langName} (${native}, language code "${code}") for real visitors.
Rules:
- Natural, correct ${langName} as a native professional would write it for a website, short like the English.
- Keep every {placeholder} exactly as written. Keep HTML tags, numbers, units (ml, %, g), emoji and symbols.
- Brand names stay recognizable: «Sham» and «Shaheen/Shahin» may be transliterated into the ${langName} script; perfume and material names (oud, musk, ambergris…) use the usual ${langName} perfumery words.
- Write in the normal script of ${langName}. Never answer in English or Arabic, never add notes or explanations.
- Return ONLY a JSON object mapping each id to its translation.${guidance}`;
}

export function translatePrompt(units: readonly TextUnit[], glossary: readonly [string, string][]): string {
  const items = Object.fromEntries(units.map((u, i) => [String(i + 1), u.en]));
  const terms = glossary.length ? `Terms already used on the site in this language (keep them consistent):\n${glossary.map(([en, t]) => `- ${en} → ${t}`).join('\n')}\n\n` : '';
  return `${terms}Translate these texts (JSON, id → English):\n${JSON.stringify(items, null, 0)}\n\nAnswer with JSON only: {"1": "…", "2": "…"}`;
}

export function parseJsonObject(text: string): Record<string, unknown> | undefined {
  const body = text.replace(/```(?:json)?/gi, '').trim();
  const start = body.indexOf('{'); const end = body.lastIndexOf('}');
  if (start < 0 || end <= start) return undefined;
  try {
    const value = JSON.parse(body.slice(start, end + 1));
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
  } catch { return undefined; }
}

export function readTranslations(lang: string, units: readonly TextUnit[], reply: string): { accepted: { unit: TextUnit; text: string }[]; rejected: { unit: TextUnit; reason: string }[] } {
  const data = parseJsonObject(reply) || {};
  const accepted: { unit: TextUnit; text: string }[] = []; const rejected: { unit: TextUnit; reason: string }[] = [];
  units.forEach((unit, i) => {
    const raw = data[String(i + 1)];
    const text = typeof raw === 'string' ? raw.trim().replace(/^["«“](.*)["»”]$/s, '$1').trim() : raw;
    const reason = validateTranslation(lang, unit.en, text);
    if (reason) rejected.push({ unit, reason: raw === undefined ? 'missing' : reason });
    else accepted.push({ unit, text: text as string });
  });
  return { accepted, rejected };
}

export function reviewSystem(langName: string): string {
  return `You review website translations from English into ${langName} for a perfume platform. Flag only real problems:
wrong meaning, wrong language, broken or unnatural text a native speaker would not accept, offensive words, or added content.
Return ONLY JSON: {"bad": {"<id>": "short reason"}} — {"bad": {}} when everything is acceptable.`;
}
export function reviewPrompt(pairs: readonly { en: string; text: string }[]): string {
  return JSON.stringify(Object.fromEntries(pairs.map((p, i) => [String(i + 1), { en: p.en, translation: p.text }])));
}
export function readReview(reply: string, count: number): Set<number> | undefined {
  const data = parseJsonObject(reply);
  if (!data || typeof data.bad !== 'object' || data.bad === null) return undefined; // unreadable review: not a verdict
  const bad = new Set<number>();
  for (const id of Object.keys(data.bad as object)) { const n = Number(id); if (Number.isInteger(n) && n >= 1 && n <= count) bad.add(n - 1); }
  return bad;
}

/** Merge accepted translations into a language file, keys sorted (stable diffs). */
export function mergePack(pack: AiPackFile, accepted: readonly { unit: TextUnit; text: string }[]): AiPackFile {
  const next: AiPackFile = { ui: { ...pack.ui }, store: { ...pack.store }, text: { ...pack.text } };
  for (const { unit, text } of accepted) next[unit.pack]![unit.key] = text;
  const sorted = (o: Record<string, string> = {}) => Object.fromEntries(Object.entries(o).sort(([a], [b]) => a.localeCompare(b)));
  const out: AiPackFile = {};
  for (const p of ['ui', 'store', 'text'] as const) if (Object.keys(next[p] || {}).length) out[p] = sorted(next[p]);
  return out;
}

/** A few terms the language already has (hand-made), to keep the AI consistent with the site. */
export function glossaryFor(own: Record<string, string> | undefined, en: Record<string, string>, keys: readonly string[]): [string, string][] {
  const out: [string, string][] = [];
  for (const k of keys) if (own?.[k] && en[k] && own[k] !== en[k]) out.push([en[k], own[k]]);
  return out.slice(0, 12);
}
