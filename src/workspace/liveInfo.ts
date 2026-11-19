/**
 * «شاشة المعلومات الحية في مساحة شاهين»: reads an assistant reply as it arrives (and while Shaheen speaks it) and
 * turns only what is truly written into scannable live elements — key points, prominent figures, tables, runnable
 * code blocks, images and web sources — plus live matching against the sentence being spoken right now.
 * Never invents a word, number or source.
 */
import { removeFormulaBlocks } from '../utils/aiFormulaExtractor';
import { removeMediaBlocks } from '../utils/mediaBlock';
import { removeToolBlocks } from '../utils/shaheenTools';
import { plainMath, MATH_CLOSE, MATH_OPEN } from '../utils/shaheenText';
import { codeBlocks, stripImageRequest, type CodeBlock } from './codeBlocks';
import type { WsSource } from './workspaceApi';

export interface LiveSource {
  index: number;
  title: string;
  url: string;
  domain: string;
  snippet: string;
}

export interface LiveFact {
  value: string;
  label: string;
}

export interface LiveTable {
  title?: string;
  headers: string[];
  rows: string[][];
}

export interface LiveSection {
  heading?: string;
  points: string[];
}

export interface LiveInfoSnapshot {
  title: string;
  sections: LiveSection[];
  keyPoints: string[];
  facts: LiveFact[];
  tables: LiveTable[];
  codeBlocks: CodeBlock[];
  sources: LiveSource[];
  image?: string;
  wordCount: number;
  hasStructuredInfo: boolean;
}

/** Extracts a readable host name (`en.wikipedia.org` or `youm7.com`) from a source URL without throwing. */
export function domainOf(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./i, '') || url;
  } catch {
    return url.replace(/^https?:\/\/(?:www\.)?/i, '').split(/[/?#]/)[0] || url;
  }
}

/** Strips Markdown syntax, citation numbers and internal math markers for crisp card display. */
export function cleanMarkdownInline(raw: string): string {
  return plainMath(raw)
    .replace(new RegExp(`[${MATH_OPEN}${MATH_CLOSE}]`, 'g'), '')
    .replace(/\[([^\]]+)\]\(https?:\/\/[^)\s]+\)/g, '$1')
    .replace(/\[(\d{1,2})\]/g, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/(^|\s)\*([^*\n]+)\*/g, '$1$2')
    .replace(/~~([^~]+)~~/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const stripFences = (text: string) =>
  text
    .replace(/```[\s\S]*?```/g, '\n')
    .replace(/```[\s\S]*$/g, '\n');

const parseRow = (line: string) =>
  line.trim().replace(/^\||\|$/g, '').split('|').map((cell) => cleanMarkdownInline(cell));

/** Normalises Arabic and Latin words so a spoken sentence finds its written line reliably. */
function normWords(text: string): string[] {
  const cleaned = cleanMarkdownInline(text)
    .normalize('NFKC')
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .toLowerCase();
  return (cleaned.match(/[\p{L}\p{N}]{2,}/gu) || []).filter((w) => w.length >= 2);
}

/**
 * Finds which line/point in `items` matches the phrase Shaheen is speaking right now (`spokenChunk`).
 * Returns the 0-based index, or `-1` when nothing matches confidently.
 */
export function matchSpokenSegment(items: readonly string[], spokenChunk: string): number {
  if (!items.length || !spokenChunk.trim()) return -1;
  const spoken = normWords(spokenChunk);
  if (!spoken.length) return -1;
  const spokenSet = new Set(spoken);
  let bestIndex = -1;
  let bestScore = 0;

  for (let i = 0; i < items.length; i += 1) {
    const words = normWords(items[i] || '');
    if (!words.length) continue;
    let shared = 0;
    for (const word of words) {
      if (spokenSet.has(word)) shared += 1;
    }
    if (!shared) continue;
    const itemRecall = shared / words.length;
    const spokenRecall = shared / spoken.length;
    const score = Math.max(itemRecall * 0.75 + spokenRecall * 0.25, spokenRecall * 0.75 + itemRecall * 0.25);
    const minShared = Math.min(2, spoken.length, words.length);
    if (shared >= minShared && score > bestScore && score >= 0.34) {
      bestScore = score;
      bestIndex = i;
    }
  }
  return bestIndex;
}

/** Returns true when a single block of Markdown is the one Shaheen is voicing right now. */
export function isBlockSpoken(blockText: string, spokenChunk?: string): boolean {
  if (!spokenChunk?.trim() || !blockText.trim()) return false;
  return matchSpokenSegment([blockText], spokenChunk) === 0;
}

/** Estimates how far through a written reply the current spoken chunk sits (0 to 100). */
export function spokenProgress(fullText: string, spokenChunk: string): number {
  if (!fullText.trim() || !spokenChunk.trim()) return 0;
  const cleanFull = stripFences(removeToolBlocks(removeFormulaBlocks(removeMediaBlocks(stripImageRequest(fullText)))));
  const sentences = cleanFull
    .split(/(?:\n+|[.!?؟。]\s+)/)
    .map((part) => cleanMarkdownInline(part))
    .filter((part) => part.length >= 4);
  if (!sentences.length) return 0;
  const index = matchSpokenSegment(sentences, spokenChunk);
  if (index < 0) return 0;
  return Math.min(100, Math.max(8, Math.round(((index + 1) / sentences.length) * 100)));
}

/** Unit/measure/percentage/currency pattern for genuine quantitative facts (never bare list indices or citations). */
const FACT_RE = /(?:(?:\$|€|£|¥)\s?\d[\d,.\u0660-\u0669\u06F0-\u06F9]*|\d[\d,.\u0660-\u0669\u06F0-\u06F9]*\s*(?:%|٪|°[CF]?|م°|درجة|جنيه|ج\.م|ريال|درهم|دولار|يورو|مل|ملي|جم|جرام|كجم|كيلو|كم|متر|ساعة|ساعات|دقيقة|دقائق|دقايق|ثانية|ثواني|يوم|أيام|ايام|أسبوع|أسابيع|شهر|شهور|أشهر|سنة|سنوات|سنين|مليون|مليار|ألف|EGP|USD|EUR|SAR|AED|GBP|ml|mg|kg|km|GB|MB|KB|TB|ms|Hz|kHz|GHz|W|kW|hours?|hrs?|mins?|minutes?|seconds?|days?|weeks?|months?|years?|million|billion))/giu;

function extractFacts(lines: readonly string[]): LiveFact[] {
  const seen = new Set<string>();
  const facts: LiveFact[] = [];
  for (const raw of lines) {
    const cleaned = cleanMarkdownInline(raw.replace(/^(?:#{1,6}\s+|[-*•]\s+|\d+[.)]\s+|>\s*)/, ''));
    if (cleaned.length < 6 || cleaned.length > 260) continue;
    for (const match of cleaned.matchAll(FACT_RE)) {
      const value = match[0].trim();
      const key = value.toLowerCase();
      if (seen.has(key)) continue;
      const at = match.index ?? 0;
      // Pick the clause holding this figure so the card shows real context, never invented text.
      const clauses = cleaned.split(/[،,؛;:.—–()]/).map((c) => c.trim()).filter(Boolean);
      let cursor = 0;
      let context = clauses[0] || cleaned;
      for (const clause of clauses) {
        const pos = cleaned.indexOf(clause, cursor);
        if (pos >= 0 && at >= pos && at <= pos + clause.length) {
          context = clause;
          break;
        }
        if (pos >= 0) cursor = pos + clause.length;
      }
      const label = context.replace(value, '').replace(/^[\s:–—-]+|[\s:–—-]+$/g, '').replace(/\s{2,}/g, ' ').trim();
      if (label.length < 3) continue;
      seen.add(key);
      facts.push({ value, label: label.length > 64 ? `${label.slice(0, 62).trim()}…` : label });
      if (facts.length >= 6) return facts;
    }
  }
  return facts;
}

/** Builds the live information snapshot from an assistant message (partial while streaming, or complete). */
export function extractLiveInfo(text: string, rawSources?: readonly WsSource[], image?: string): LiveInfoSnapshot {
  const safe = removeToolBlocks(removeFormulaBlocks(removeMediaBlocks(stripImageRequest(text || ''))));
  const blocks = codeBlocks(safe);
  const prose = stripFences(safe);
  const lines = prose.split('\n');

  const sources: LiveSource[] = (rawSources || [])
    .filter((s) => s && typeof s.url === 'string' && /^https?:\/\//i.test(s.url))
    .map((s, idx) => ({
      index: idx + 1,
      title: (s.title || '').trim() || domainOf(s.url),
      url: s.url,
      domain: domainOf(s.url),
      snippet: (s.snippet || '').trim(),
    }));

  let title = '';
  let currentHeading: string | undefined;
  const sections: LiveSection[] = [];
  const bulletPoints: string[] = [];
  const paragraphs: string[] = [];
  const tables: LiveTable[] = [];
  const factLines: string[] = [];

  const pushPoint = (point: string) => {
    const clean = cleanMarkdownInline(point);
    if (clean.length < 3) return;
    bulletPoints.push(clean);
    factLines.push(clean);
    const last = sections[sections.length - 1];
    if (last && last.heading === currentHeading) last.points.push(clean);
    else sections.push({ ...(currentHeading ? { heading: currentHeading } : {}), points: [clean] });
  };

  let i = 0;
  while (i < lines.length) {
    const raw = lines[i] || '';
    const trimmed = raw.trim();
    if (!trimmed || /^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) { i += 1; continue; }

    const heading = trimmed.match(/^#{1,6}\s+(.*)$/);
    if (heading) {
      const h = cleanMarkdownInline((heading[1] || '').replace(/#+$/, ''));
      if (h) {
        if (!title) title = h;
        currentHeading = h;
      }
      i += 1;
      continue;
    }

    if (/^\|.*\|$/.test(trimmed) && i + 1 < lines.length && /^\|?\s*:?-{2,}/.test((lines[i + 1] || '').trim())) {
      const headers = parseRow(trimmed).filter((c, idx, arr) => c || idx < arr.length);
      const rows: string[][] = [];
      i += 2;
      while (i < lines.length && /^\|.*\|$/.test((lines[i] || '').trim())) {
        const row = parseRow(lines[i] || '');
        if (row.some(Boolean)) rows.push(row);
        i += 1;
      }
      if (headers.some(Boolean) && rows.length > 0) {
        tables.push({ ...(currentHeading ? { title: currentHeading } : {}), headers, rows });
      }
      continue;
    }

    const bullet = trimmed.match(/^(?:[-*•]|\d+[.)])\s+(.*)$/);
    if (bullet) {
      pushPoint(bullet[1] || '');
      i += 1;
      continue;
    }

    const quote = trimmed.replace(/^>\s*/, '');
    const clean = cleanMarkdownInline(quote);
    if (clean) {
      paragraphs.push(clean);
      factLines.push(clean);
    }
    i += 1;
  }

  // If the answer has no explicit bullet list, split prose into crisp takeaway sentences for the live view.
  const sentenceFallbacks = bulletPoints.length
    ? []
    : paragraphs
        .flatMap((p) => p.split(/(?<=[.!?؟。])\s+/u))
        .map((s) => s.trim())
        .filter((s) => s.length >= 14 && s.length <= 240);

  const keyPoints = (bulletPoints.length ? bulletPoints : sentenceFallbacks).slice(0, 8);
  if (!title && paragraphs[0]) {
    const first = paragraphs[0].split(/[.!?؟:\n]/)[0]?.trim() || '';
    title = first.length > 68 ? `${first.slice(0, 66).trim()}…` : first;
  }

  const facts = extractFacts(factLines);
  const wordCount = (cleanMarkdownInline(prose).match(/\S+/g) || []).length;
  const hasStructuredInfo = Boolean(
    sources.length > 0
    || tables.length > 0
    || blocks.length > 0
    || facts.length > 0
    || bulletPoints.length >= 2
    || image,
  );

  return {
    title,
    sections: sections.slice(0, 6),
    keyPoints,
    facts,
    tables,
    codeBlocks: blocks,
    sources,
    ...(image ? { image } : {}),
    wordCount,
    hasStructuredInfo,
  };
}
