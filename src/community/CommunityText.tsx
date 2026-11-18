import React, { type ReactNode } from 'react';

const URL_TOKEN = /(?:https?:\/\/|www\.)[^\s<>{}"']+/giu;
const TRAILING_PUNCTUATION = /[.,!?،؛:…]+$/u;

/** Safe plain-text rendering for member-authored content; only HTTP(S) links become anchors. */
export function CommunityText({ text, hashtags = false }: { text: string; hashtags?: boolean }) {
  const parts: ReactNode[] = [];
  let cursor = 0;
  for (const match of text.matchAll(URL_TOKEN)) {
    const index = match.index ?? 0;
    const raw = match[0];
    let candidate = raw;
    let suffix = '';
    while (TRAILING_PUNCTUATION.test(candidate)) {
      suffix = candidate.slice(-1) + suffix;
      candidate = candidate.slice(0, -1);
    }
    if (index > cursor) parts.push(...plainParts(text.slice(cursor, index), cursor, hashtags));
    const href = candidate.toLowerCase().startsWith('www.') ? `https://${candidate}` : candidate;
    try {
      const parsed = new URL(href);
      if ((parsed.protocol === 'https:' || parsed.protocol === 'http:') && parsed.hostname.includes('.')) {
        parts.push(<a key={`url-${index}`} href={parsed.href} target="_blank" rel="noopener noreferrer nofollow" className="break-all font-medium text-sky-700 underline decoration-sky-400 underline-offset-2 hover:text-sky-900">{candidate}</a>);
      } else parts.push(candidate);
    } catch { parts.push(candidate); }
    if (suffix) parts.push(suffix);
    cursor = index + raw.length;
  }
  if (cursor < text.length) parts.push(...plainParts(text.slice(cursor), cursor, hashtags));
  return <>{parts}</>;
}

function plainParts(value: string, offset: number, hashtags: boolean): ReactNode[] {
  if (!hashtags) return [value];
  const pieces: ReactNode[] = [];
  const hash = /#[^\s#]+/gu;
  let cursor = 0;
  for (const match of value.matchAll(hash)) {
    const index = match.index ?? 0;
    if (index > cursor) pieces.push(value.slice(cursor, index));
    pieces.push(<span key={`tag-${offset + index}`} className="font-bold text-amber-800">{match[0]}</span>);
    cursor = index + match[0].length;
  }
  if (cursor < value.length) pieces.push(value.slice(cursor));
  return pieces;
}
