import React from 'react';
import { removeMediaBlocks } from '../utils/mediaBlock';

/**
 * Small, safe Markdown renderer for Shaheen's answers (React elements only — never innerHTML).
 * Supports headings, bold/italic, inline code, bullet & numbered lists, tables, quotes, code blocks
 * and https links. The machine-readable ```sham-formula block is hidden: the formula card under the
 * message already presents it with its actions. The ```sham-media block (topics for real images and
 * videos) is hidden too: ShaheenMedia renders it.
 */
export function stripFormulaBlock(text: string): string {
  return removeMediaBlocks(text).replace(/```sham-formula\s*\n[\s\S]*?```/g, '').replace(/\n{3,}/g, '\n\n').trim();
}

const INLINE = /(\*\*[^*\n]+\*\*|__[^_\n]+__|`[^`\n]+`|\[[^\]\n]+\]\(https:\/\/[^)\s]+\)|\*[^*\s][^*\n]*\*)/g;

function inline(text: string, keyBase: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  let last = 0;
  let i = 0;
  for (const match of text.matchAll(INLINE)) {
    const token = match[0];
    const at = match.index ?? 0;
    if (at > last) out.push(text.slice(last, at));
    const key = `${keyBase}-${i++}`;
    if (token.startsWith('**') || token.startsWith('__')) out.push(<strong key={key} className="font-bold">{token.slice(2, -2)}</strong>);
    else if (token.startsWith('`')) out.push(<code key={key} className="rounded bg-stone-100 px-1 py-0.5 font-mono text-[0.85em] text-stone-800" dir="ltr">{token.slice(1, -1)}</code>);
    else if (token.startsWith('[')) {
      const [, label, href] = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/) || [];
      out.push(<a key={key} href={href} target="_blank" rel="noopener noreferrer nofollow" className="text-amber-800 underline">{label}</a>);
    } else out.push(<em key={key}>{token.slice(1, -1)}</em>);
    last = at + token.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

const cells = (line: string) => line.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());

export function ShaheenMarkdown({ text, className = '' }: { text: string; className?: string }) {
  const lines = stripFormulaBlock(text).split('\n');
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
      blocks.push(<pre key={key} dir="ltr" className="overflow-x-auto rounded-xl bg-stone-900 p-3 text-[11px] leading-relaxed text-stone-100"><code>{body.join('\n')}</code></pre>);
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
      const items: string[] = [];
      while (i < lines.length) {
        const t = lines[i].trim();
        const m = ordered ? t.match(/^\d+[.)]\s+(.*)$/) : t.match(/^[-*•]\s+(.*)$/);
        if (m) { items.push(m[1]); i++; continue; }
        // A wrapped continuation line belongs to the previous item.
        if (t && items.length && /^\s{2,}/.test(lines[i])) { items[items.length - 1] += ` ${t}`; i++; continue; }
        break;
      }
      const List = ordered ? 'ol' : 'ul';
      blocks.push(<List key={key} className={`${ordered ? 'list-decimal' : 'list-disc'} space-y-1 ps-5`}>{items.map((it, j) => <li key={j}>{inline(it, `${key}-${j}`)}</li>)}</List>);
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
