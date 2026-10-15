/**
 * Clean-ups for Shaheen's visible text (pure; used by the server and both chat surfaces).
 *
 * Seen live (inspection of «تحليل معمّق»): the model writes equations in LaTeX —
 * `$C_1 \times V_1 = C_2 \times V_2$`, `$$V_1 = \frac{70 \times 1000}{96} \approx 729.17 \text{ مل}$$` —
 * which visitors saw as raw code. They become readable math (V₁ = 70 × 1000 ÷ 96 ≈ 729.17 مل) wrapped in
 * ⁅…⁆ so the renderer can show them left-to-right inside Arabic text.
 * Also seen: answers opening with «أهلاً بك.» although the visitor asked a real question.
 */

export const MATH_OPEN = '\u2045';
export const MATH_CLOSE = '\u2046';

const SUB: Record<string, string> = { 0: '₀', 1: '₁', 2: '₂', 3: '₃', 4: '₄', 5: '₅', 6: '₆', 7: '₇', 8: '₈', 9: '₉', '+': '₊', '-': '₋' };
const SUP: Record<string, string> = { 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹', '+': '⁺', '-': '⁻' };
const SYMBOLS: [RegExp, string][] = [
  [/\\left|\\right(?![a-z])|\\displaystyle|\\limits/g, ''],
  [/\\times/g, '×'], [/\\cdot/g, '·'], [/\\div/g, '÷'], [/\\approx/g, '≈'], [/\\pm/g, '±'], [/\\leq?(?![a-z])/g, '≤'], [/\\geq?(?![a-z])/g, '≥'],
  [/\\neq/g, '≠'], [/\\to(?![a-z])|\\rightarrow|\\Rightarrow/g, '→'], [/\\%/g, '%'], [/\\infty/g, '∞'], [/\\degree|\^\{?\\circ\}?/g, '°'],
  [/\\rho/g, 'ρ'], [/\\Delta/g, 'Δ'], [/\\alpha/g, 'α'], [/\\beta/g, 'β'], [/\\mu/g, 'µ'], [/\\sum/g, 'Σ'],
  [/\\[,;:! ]|~/g, ' '], [/\\quad|\\qquad/g, '  '],
];

/** Index of the "}" matching the "{" at `open`, or -1. */
function closing(s: string, open: number): number {
  let depth = 0;
  for (let i = open; i < s.length; i++) {
    if (s[i] === '{') depth++;
    else if (s[i] === '}' && --depth === 0) return i;
  }
  return -1;
}

/** \cmd{a}{b}: replaces the first occurrence with fn(a, b); returns null when there is none. */
function replaceCommand(s: string, name: string, args: number, fn: (...parts: string[]) => string): string | null {
  const at = s.indexOf(`\\${name}{`);
  if (at < 0) return null;
  let pos = at + name.length + 1;
  const parts: string[] = [];
  for (let k = 0; k < args; k++) {
    while (s[pos] === ' ') pos++;
    if (s[pos] !== '{') return s.slice(0, at) + s.slice(at + name.length + 1); // malformed: drop the command name
    const end = closing(s, pos);
    if (end < 0) return s.slice(0, at) + s.slice(at + name.length + 1);
    parts.push(s.slice(pos + 1, end));
    pos = end + 1;
  }
  return s.slice(0, at) + fn(...parts) + s.slice(pos);
}

const simple = (x: string) => /^[\w.\u0600-\u06FF₀-₉]+$/.test(x.trim());
const group = (x: string) => (simple(x) ? x.trim() : `(${x.trim()})`);

/** LaTeX math → readable text: fractions, roots, sub/superscripts, \text{}, common symbols. */
export function latexToText(src: string): string {
  let s = src;
  for (let guard = 0; guard < 50; guard++) {
    const next = replaceCommand(s, 'frac', 2, (a, b) => `${group(latexToText(a))} ÷ ${group(latexToText(b))}`)
      ?? replaceCommand(s, 'dfrac', 2, (a, b) => `${group(latexToText(a))} ÷ ${group(latexToText(b))}`)
      ?? replaceCommand(s, 'sqrt', 1, (a) => `√${group(latexToText(a))}`)
      ?? replaceCommand(s, 'text', 1, (a) => a)
      ?? replaceCommand(s, 'mathrm', 1, (a) => a)
      ?? replaceCommand(s, 'textbf', 1, (a) => a)
      ?? replaceCommand(s, 'mathbf', 1, (a) => a)
      ?? replaceCommand(s, 'operatorname', 1, (a) => a)
      ?? replaceCommand(s, 'boxed', 1, (a) => a);
    if (next === null) break;
    s = next;
  }
  for (const [re, to] of SYMBOLS) s = s.replace(re, to);
  // Subscripts / superscripts: digits become ₁ ² …, words go in brackets (V_{water} → V(water)).
  s = s.replace(/_\{([^{}]*)\}|_([A-Za-z0-9])/g, (_m, g1, g2) => {
    const x = (g1 ?? g2).trim();
    return /^[0-9+-]+$/.test(x) ? [...x].map((c) => SUB[c]).join('') : `(${x})`;
  });
  s = s.replace(/\^\{([^{}]*)\}|\^([0-9])/g, (_m, g1, g2) => {
    const x = (g1 ?? g2).trim();
    return /^[0-9+-]+$/.test(x) ? [...x].map((c) => SUP[c]).join('') : `^(${x})`;
  });
  return s.replace(/\\([A-Za-z]+)/g, '$1').replace(/[{}]/g, '').replace(/\s{2,}/g, ' ').trim();
}

const looksLikeMath = (x: string) => /\\[A-Za-z]+|[_^]\{?[\w\\]|=/.test(x);

/** Replaces $…$, $$…$$, \(…\) and \[…\] math with readable ⁅…⁆ spans. Prices like "$5 or $10" are left alone. */
export function plainMath(text: string): string {
  if (!/[$\\]/.test(text)) return text;
  const wrap = (x: string) => `${MATH_OPEN}${latexToText(x)}${MATH_CLOSE}`;
  return text
    .replace(/\$\$([\s\S]+?)\$\$/g, (_m, x) => wrap(x))
    .replace(/\\\[([\s\S]+?)\\\]/g, (_m, x) => wrap(x))
    .replace(/\\\(([\s\S]+?)\\\)/g, (_m, x) => wrap(x))
    .replace(/\$([^$\n]+?)\$/g, (m, x) => (looksLikeMath(x) ? wrap(x) : m));
}

const GREETING = /^\s*(?:أهلاً|أهلا|اهلاً|اهلا|مرحباً|مرحبا|مرحبًا|أهلاً وسهلاً|أهلا وسهلا|يا هلا|هلا)(?:\s+(?:بك|بكِ|بيك|وسهلاً|وسهلا|بكم|يا صديقي|عزيزي|بحضرتك))*\s*[.!،,]\s*/;
const VISITOR_GREETS = /(مرحب|أهل|اهل|السلام|سلام|هاي|هلا|صباح|مساء|\b(hi|hello|hey)\b)/i;

/** Drops an opening «أهلاً بك.» when the visitor asked a question instead of greeting. */
export function stripOpeningGreeting(reply: string, question = ''): string {
  if (VISITOR_GREETS.test(question.slice(0, 40))) return reply;
  const m = reply.match(GREETING);
  if (!m) return reply;
  const rest = reply.slice(m[0].length);
  return rest.trim().length >= 20 ? rest : reply;
}
