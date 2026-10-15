import React from 'react';
import { removeMediaBlocks } from '../utils/mediaBlock';
import { removeFormulaBlocks } from '../utils/aiFormulaExtractor';
import { removeToolBlocks } from '../utils/shaheenTools';
import { MATH_CLOSE, MATH_OPEN, plainMath } from '../utils/shaheenText';

/**
 * Small, safe Markdown renderer for Shaheen's answers (React elements only — never innerHTML).
 * Supports headings, bold/italic, inline code, bullet & numbered lists, tables, quotes, code blocks
 * and https links. The machine-readable ```sham-formula block is hidden: the formula card under the
 * message already presents it with its actions. The ```sham-media block (topics for real images and
 * videos) is hidden too: ShaheenMedia renders it. LaTeX math ($…$, $$…$$) is turned into readable
 * equations (V₁ = 70 × 1000 ÷ 96) shown left-to-right, and nested bullets under a numbered step stay nested.
 */
export function stripFormulaBlock(text: string): string {
  // Any formula-looking block (```json label, cut fence, bare JSON…), not only the canonical one.
  return removeToolBlocks(removeFormulaBlocks(removeMediaBlocks(text)))
    // Fences left behind once a block inside them was removed («```sham-formula» + «```json…```» + «```»),
    // empty blocks and a dangling closing fence: seen live as an empty black box under the answer.
    .replace(/^[ \t]*(```|~~~)[\w-]*[ \t]*\n(?:[ \t]*\n)*[ \t]*\1[ \t]*$/gm, '')
    .replace(/\n[ \t]*(```|~~~)[\w-]*[ \t]*$/, '')
    .replace(/\n{3,}/g, '\n\n').trim();
}

const INLINE = /(\u2045[^\u2046\n]*\u2046|\*\*[^*\n]+\*\*|__[^_\n]+__|`[^`\n]+`|\[[^\]\n]+\]\(https:\/\/[^)\s]+\)|\*[^*\s][^*\n]*\*)/g;

function inline(text: string, keyBase: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  let last = 0;
  let i = 0;
  for (const match of text.matchAll(INLINE)) {
    const token = match[0];
    const at = match.index ?? 0;
    if (at > last) out.push(text.slice(last, at));
    const key = `${keyBase}-${i++}`;
    if (token.startsWith(MATH_OPEN)) out.push(<span key={key} dir="ltr" className="mx-0.5 inline-block rounded-md bg-amber-50 px-1.5 py-0.5 font-semibold tabular-nums text-stone-800 ring-1 ring-amber-100">{token.slice(1, -1)}</span>);
    else if (token.startsWith('**') || token.startsWith('__')) out.push(<strong key={key} className="font-bold">{inline(token.slice(2, -2), key)}</strong>);
    else if (token.startsWith('`')) out.push(<code key={key} className="rounded bg-stone-100 px-1 py-0.5 font-mono text-[0.85em] text-stone-800" dir="ltr">{token.slice(1, -1)}</code>);
    else if (token.startsWith('[')) {
      const [, label, href] = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/) || [];
      out.push(<a key={key} href={href} target="_blank" rel="noopener noreferrer nofollow" className="text-amber-800 underline">{label}</a>);
    } else out.push(<em key={key}>{inline(token.slice(1, -1), key)}</em>);
    last = at + token.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

/** A list item whose wrapped lines (e.g. an equation under a step) keep their own line. */
const lineBreaks = (text: string, keyBase: string): React.ReactNode[] =>
  text.split('\n').flatMap((part, j) => (j ? [<br key={`${keyBase}br${j}`} />, ...inline(part, `${keyBase}l${j}`)] : inline(part, `${keyBase}l${j}`)));

const cells = (line: string) => line.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());

export function ShaheenMarkdown({ text, className = '' }: { text: string; className?: string }) {
  const lines = plainMath(stripFormulaBlock(text)).split('\n');
  const blocks: React.ReactNode[] = [];
  let i = 0;
  let k = 0;
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();
    const key = `b${k++}`;
    if (!trimmed) { i++; continue; }

    const fence = trimmed.match(/^```(\S*)/);
    if (fence) {
      const body: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) body.push(lines[i++]);
      i++;
      const content = body.join('\n').trim();
      // Visitors never see an empty box or machine JSON. Anything else in a fence is almost always a
      // calculation or a note, so it reads as text in a soft box — not as a black «code» panel.
      if (!content || /^[[{]/.test(content)) continue;
      blocks.push(
        <div key={key} dir="auto" className="whitespace-pre-wrap rounded-xl border border-amber-100 bg-amber-50/60 px-3 py-2 text-stone-800 tabular-nums">
          {lineBreaks(content, key)}
        </div>,
      );
      continue;
    }

    const heading = trimmed.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      const size = heading[1].length <= 2 ? 'text-[15px]' : 'text-[14px]';
      blocks.push(<p key={key} className={`${size} font-bold text-amber-950 pt-1`}>{inline(heading[2].replace(/#+$/, '').trim(), key)}</p>);
      i++;
      continue;
    }

    if (/^\|.*\|$/.test(trimmed) && i + 1 < lines.length && /^\|?\s*:?-{2,}/.test(lines[i + 1].trim())) {
      const head = cells(trimmed);
      const rows: string[][] = [];
      i += 2;
      while (i < lines.length && /^\|.*\|$/.test(lines[i].trim())) rows.push(cells(lines[i++]));
      blocks.push(
        <div key={key} className="overflow-x-auto">
          <table className="min-w-full border-collapse text-[12px]">
            <thead><tr>{head.map((c, j) => <th key={j} className="border border-stone-200 bg-amber-50 px-2 py-1 text-start font-bold">{inline(c, `${key}h${j}`)}</th>)}</tr></thead>
            <tbody>{rows.map((r, ri) => <tr key={ri}>{r.map((c, j) => <td key={j} className="border border-stone-200 px-2 py-1 align-top">{inline(c, `${key}r${ri}c${j}`)}</td>)}</tr>)}</tbody>
          </table>
        </div>,
      );
      continue;
    }

    if (/^([-*•])\s+/.test(trimmed) || /^\d+[.)]\s+/.test(trimmed)) {
      const ordered = /^\d+[.)]\s+/.test(trimmed);
      const start = ordered ? Number(trimmed.match(/^(\d+)/)?.[1] || 1) : 1;
      const baseIndent = line.length - line.trimStart().length;
      const items: { text: string; sub: string[] }[] = [];
      while (i < lines.length) {
        const raw = lines[i];
        const t = raw.trim();
        const indent = raw.length - raw.trimStart().length;
        const marker = t.match(/^(?:[-*•]|\d+[.)])\s+(.*)$/);
        // Indented bullets under a step are its sub-points (models write "1. المعطيات:\n   * …").
        if (marker && items.length && indent >= baseIndent + 2) { items[items.length - 1].sub.push(marker[1]); i++; continue; }
        const m = ordered ? t.match(/^\d+[.)]\s+(.*)$/) : t.match(/^[-*•]\s+(.*)$/);
        if (m) { items.push({ text: m[1], sub: [] }); i++; continue; }
        // A wrapped continuation line belongs to the previous item (or its last sub-point).
        if (t && items.length && indent >= 2) {
          const last = items[items.length - 1];
          if (last.sub.length) last.sub[last.sub.length - 1] += `\n${t}`; else last.text += `\n${t}`;
          i++; continue;
        }
        // A blank line between items of the same list does not end it.
        if (!t && i + 1 < lines.length) {
          const nextRaw = lines[i + 1];
          const nextT = nextRaw.trim();
          const nextIndent = nextRaw.length - nextRaw.trimStart().length;
          const sameList = (ordered ? /^\d+[.)]\s+/ : /^[-*•]\s+/).test(nextT);
          const subPoint = items.length > 0 && nextIndent >= baseIndent + 2 && /^(?:[-*•]|\d+[.)])\s+/.test(nextT);
          if (sameList || subPoint) { i++; continue; }
        }
        break;
      }
      const List = ordered ? 'ol' : 'ul';
      blocks.push(
        <List key={key} start={ordered && start !== 1 ? start : undefined} className={`${ordered ? 'list-decimal' : 'list-disc'} space-y-1 ps-5`}>
          {items.map((it, j) => (
            <li key={j}>
              {lineBreaks(it.text, `${key}-${j}`)}
              {it.sub.length > 0 && <ul className="mt-1 list-[circle] space-y-0.5 ps-5">{it.sub.map((s, n) => <li key={n}>{lineBreaks(s, `${key}-${j}-${n}`)}</li>)}</ul>}
            </li>
          ))}
        </List>,
      );
      continue;
    }

    if (trimmed.startsWith('>')) {
      const quote: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('>')) quote.push(lines[i++].trim().replace(/^>\s?/, ''));
      blocks.push(<blockquote key={key} className="border-s-4 border-amber-300 bg-amber-50/60 px-3 py-1.5 text-stone-700">{inline(quote.join(' '), key)}</blockquote>);
      continue;
    }

    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) { blocks.push(<hr key={key} className="border-stone-200" />); i++; continue; }

    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^(#{1,6}\s|```|[-*•]\s|\d+[.)]\s|>|\|.*\|$)/.test(lines[i].trim())) para.push(lines[i++].trim());
    if (!para.length) { para.push(trimmed); i++; }
    blocks.push(<p key={key}>{para.flatMap((p, j) => (j ? [<br key={`${key}br${j}`} />, ...inline(p, `${key}-${j}`)] : inline(p, `${key}-${j}`)))}</p>);
  }
  return <div dir="auto" className={`space-y-2 break-words ${className}`}>{blocks}</div>;
}
