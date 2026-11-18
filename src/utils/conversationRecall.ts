/**
 * Extractive long-conversation retrieval. It never summarizes or rewrites turns: it returns indices of
 * whole, earlier user/assistant exchanges that share meaningful terms with the current question.
 */
export interface RecallTurn { role: 'user' | 'assistant'; text: string }

const STOP = new Set([
  'في', 'من', 'على', 'عن', 'الي', 'الى', 'او', 'و', 'ثم', 'هل', 'ما', 'ماذا', 'كيف', 'هو', 'هي', 'انا', 'انت',
  'عايز', 'عاوز', 'اريد', 'ممكن', 'لو', 'يا', 'ده', 'دي', 'دا', 'اللي', 'هذا', 'هذه', 'كان', 'كانت', 'بس',
  'the', 'a', 'an', 'of', 'to', 'in', 'on', 'for', 'and', 'or', 'is', 'are', 'i', 'you', 'me', 'my', 'want', 'can', 'please', 'how', 'what', 'do',
]);
const stem = (word: string) => {
  let out = word.replace(/^(?:وال|بال|كال|فال|لل|ال)(?=\p{L}{3,})/u, '');
  out = out.replace(/(?:ات|تين|تين|تي|ون|ين|ها|هم|كم|نا|ه|ي)$/u, (suffix) => out.length - suffix.length >= 3 ? '' : suffix);
  if (out.length === 4 && out[2] === 'و') out = out[0] + out[1] + out[3];
  return out;
};
const words = (text: string) => [...new Set(text.toLowerCase()
  .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
  .replace(/[إأآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه')
  .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
  .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
  .replace(/[^\p{L}\p{N}%]+/gu, ' ')
  .split(/\s+/).map(stem).filter((word) => word.length > 1 && !STOP.has(word)))];

const SENSITIVE = /(?:\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b|(?:\+?\d[\d\s().-]{7,}\d)|\b(?:\d[ -]?){13,19}\b)/i;

export interface RecallOptions {
  /** Keep the current tail under its legacy policy; search only before this boundary. */
  recentTurnCount?: number;
  /** Maximum number of whole old turns to add (a user turn and its answer count as two). */
  maxTurns?: number;
  /** Maximum total characters across selected old turns. An exchange is skipped whole if it does not fit. */
  maxChars?: number;
}

/** Returns chronological indices; no text, IDs, scores, or personal data are logged or retained here. */
export function selectRelevantExchangeIndices(
  turns: readonly RecallTurn[],
  query: string,
  options: RecallOptions = {},
): number[] {
  const recentTurnCount = Math.max(0, options.recentTurnCount ?? 24);
  const maxTurns = Math.max(0, options.maxTurns ?? 8);
  const maxChars = Math.max(0, options.maxChars ?? 6000);
  const boundary = Math.max(0, turns.length - recentTurnCount);
  const queryWords = words(query);
  if (!boundary || !queryWords.length || !maxTurns || !maxChars) return [];
  const querySet = new Set(queryWords);
  const exchanges: { indices: number[]; score: number; start: number; chars: number }[] = [];

  for (let i = 0; i < boundary; i++) {
    if (turns[i].role !== 'user') continue;
    const indices = [i];
    const nextUser = turns.findIndex((turn, index) => index > i && turn.role === 'user');
    const stop = nextUser < 0 ? turns.length : nextUser;
    const answer = turns.findIndex((turn, index) => index > i && index < stop && turn.role === 'assistant');
    // Do not split an exchange across the recent-window boundary or retrieve an unanswered turn.
    if (answer < 0 || answer >= boundary) continue;
    indices.push(answer);
    const content = indices.map((index) => turns[index].text).join(' ');
    if (SENSITIVE.test(content)) continue;
    const matched = words(content).filter((term) => querySet.has(term));
    if (!matched.length) continue;
    // Numeric matches are especially discriminative (e.g. a budget or bottle size).
    const score = new Set(matched).size + matched.filter((term) => /\d/.test(term)).length * 2;
    exchanges.push({ indices, score, start: i, chars: indices.reduce((n, index) => n + turns[index].text.length, 0) });
  }

  exchanges.sort((a, b) => b.score - a.score || b.start - a.start);
  const selected: number[] = [];
  let chars = 0;
  for (const exchange of exchanges) {
    if (selected.length + exchange.indices.length > maxTurns || chars + exchange.chars > maxChars) continue;
    selected.push(...exchange.indices);
    chars += exchange.chars;
  }
  return selected.sort((a, b) => a - b);
}
