/**
 * Language-aware text utilities (Arabic + Latin scripts). Pure functions, no provider.
 */

const ARABIC_DIACRITICS = /[\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g;

export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(ARABIC_DIACRITICS, '')
    .replace(/[إأآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const STOP = new Set([
  'في', 'من', 'علي', 'على', 'الي', 'الى', 'عن', 'مع', 'او', 'و', 'ثم', 'هل', 'ما', 'ماذا', 'كيف', 'هو', 'هي', 'انا', 'انت',
  'عايز', 'عاوز', 'اريد', 'ابغي', 'ممكن', 'لو', 'يا', 'ده', 'دي', 'دا', 'اللي', 'التي', 'الذي', 'هذا', 'هذه', 'ان', 'كان', 'بس',
  'the', 'a', 'an', 'of', 'to', 'in', 'on', 'for', 'and', 'or', 'is', 'are', 'i', 'you', 'me', 'my', 'want', 'can', 'please', 'how', 'what', 'do',
]);

/** Light Arabic stemmer: strips the most common prefixes/suffixes so "العطور" ≈ "عطور" ≈ "عطر". */
function stem(token: string): string {
  if (/^[a-z0-9-]+$/.test(token)) {
    return token.length > 4 ? token.replace(/(ing|ies|es|s)$/, '') : token;
  }
  let t = token;
  for (const prefix of ['وال', 'بال', 'كال', 'فال', 'لل', 'ال']) {
    if (t.startsWith(prefix) && t.length - prefix.length >= 2) { t = t.slice(prefix.length); break; }
  }
  for (const suffix of ['ات', 'ون', 'ين', 'ها', 'هم', 'كم', 'نا', 'ه', 'ي']) {
    if (t.endsWith(suffix) && t.length - suffix.length >= 3) { t = t.slice(0, -suffix.length); break; }
  }
  // Broken plural "عطور" -> "عطر" (common فعول pattern).
  if (t.length === 4 && t[2] === 'و') t = t[0] + t[1] + t[3];
  return t;
}

export function tokenize(text: string): string[] {
  return normalize(text)
    .split(' ')
    .filter((token) => token.length > 1 && !STOP.has(token))
    .map(stem)
    .filter(Boolean);
}

export function detectScriptLanguage(text: string): 'ar' | 'en' {
  const arabic = (text.match(/[\u0600-\u06FF]/g) || []).length;
  const latin = (text.match(/[A-Za-z]/g) || []).length;
  return arabic >= latin ? 'ar' : 'en';
}

export interface IndexedDoc { id: string; title: string; text: string; kind: 'knowledge' | 'product' | 'service' }

/** Okapi BM25 — the classic lexical retrieval used for grounded answers (RAG) without any external embedding API. */
export class Bm25Index {
  private docs: { doc: IndexedDoc; tf: Map<string, number>; length: number }[] = [];
  private df = new Map<string, number>();
  private avgLength = 0;

  constructor(docs: IndexedDoc[], private k1 = 1.4, private b = 0.75) {
    for (const doc of docs) {
      const tokens = tokenize(`${doc.title} ${doc.title} ${doc.text}`);
      const tf = new Map<string, number>();
      for (const token of tokens) tf.set(token, (tf.get(token) || 0) + 1);
      for (const token of tf.keys()) this.df.set(token, (this.df.get(token) || 0) + 1);
      this.docs.push({ doc, tf, length: tokens.length });
    }
    this.avgLength = this.docs.reduce((sum, d) => sum + d.length, 0) / (this.docs.length || 1);
  }

  search(query: string, limit = 4, minScore = 0.5): { doc: IndexedDoc; score: number }[] {
    const terms = [...new Set(tokenize(query))];
    if (!terms.length) return [];
    const n = this.docs.length;
    const results = this.docs.map(({ doc, tf, length }) => {
      let score = 0;
      for (const term of terms) {
        const f = tf.get(term) || 0;
        if (!f) continue;
        const df = this.df.get(term) || 0;
        const idf = Math.log(1 + (n - df + 0.5) / (df + 0.5));
        score += idf * ((f * (this.k1 + 1)) / (f + this.k1 * (1 - this.b + this.b * (length / (this.avgLength || 1)))));
      }
      return { doc, score };
    });
    return results.filter((r) => r.score >= minScore).sort((a, b) => b.score - a.score).slice(0, limit);
  }
}

export function excerpt(text: string, query: string, max = 420): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  const terms = tokenize(query);
  const sentences = clean.split(/(?<=[.!؟?。])\s+/);
  const scored = sentences.map((sentence, index) => ({
    index,
    score: tokenize(sentence).filter((token) => terms.includes(token)).length,
  }));
  const best = scored.sort((a, b) => b.score - a.score)[0]?.index ?? 0;
  let out = '';
  for (let i = best; i < sentences.length && out.length < max; i++) out += (out ? ' ' : '') + sentences[i];
  return out.length > max ? `${out.slice(0, max - 1)}…` : out;
}
