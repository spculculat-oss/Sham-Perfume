/**
 * Finds Shaheen's visual-aid block in a reply, however the model happened to write it.
 * Canonical form:  ```sham-media\n{"images":[…],"videos":[…],"places":[…]}\n```
 * Seen live: a ```json label, a missing closing fence, or the bare JSON line. Any fence labelled
 * sham-media / json / nothing, or a bare line, whose JSON object only has media keys counts.
 * Pure (no browser or server imports): shared by the API (normalises replies) and the client.
 */
const MEDIA_KEYS = new Set(['images', 'image', 'videos', 'video', 'places', 'place']);

export interface MediaSpan { start: number; end: number; data?: Record<string, unknown> }

/** End index (exclusive) of the JSON object starting at `from` ('{'), or -1. */
function objectEnd(text: string, from: number): number {
  let depth = 0;
  let inString = false;
  for (let i = from; i < text.length && i < from + 4000; i++) {
    const c = text[i];
    if (inString) {
      if (c === '\\') i++;
      else if (c === '"') inString = false;
    } else if (c === '"') inString = true;
    else if (c === '{') depth++;
    else if (c === '}' && --depth === 0) return i + 1;
  }
  return -1;
}

const isMedia = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value) &&
  Object.keys(value as object).length > 0 && Object.keys(value as object).every((k) => MEDIA_KEYS.has(k));

export function findMediaBlocks(text: string): MediaSpan[] {
  if (!/"(images?|videos?|places?)"|sham-media/.test(text)) return [];
  const spans: MediaSpan[] = [];
  const starts = /```[ \t]*([\w-]*)[^\n]*\n|^[ \t]*(?=\{\s*"(?:images?|videos?|places?)")/gm;
  for (let m = starts.exec(text); m; m = starts.exec(text)) {
    if (m[0] === '') starts.lastIndex++; // zero-width (bare line) match
    const fenced = m[0].startsWith('```');
    const label = (m[1] || '').toLowerCase();
    if (fenced && !['sham-media', 'json', ''].includes(label)) continue;
    if (spans.some((s) => m!.index < s.end)) continue;
    let p = m.index + m[0].length;
    while (p < text.length && /\s/.test(text[p])) p++;
    const close = text.indexOf('```', p);
    if (text[p] === '{') {
      const end = objectEnd(text, p);
      let data: unknown;
      if (end > 0) try { data = JSON.parse(text.slice(p, end)); } catch { /* not JSON */ }
      if (end > 0 && isMedia(data)) {
        let stop = end;
        // Consume a closing fence right after the object (only when the block was fenced).
        const rest = text.slice(end).match(/^\s*```[ \t]*(?:\n|$)/);
        if (fenced && rest) stop = end + rest[0].length;
        else while (stop < text.length && text[stop] !== '\n' && /\s/.test(text[stop])) stop++;
        spans.push({ start: m.index, end: stop, data });
        starts.lastIndex = stop;
        continue;
      }
    }
    // A sham-media fence that is not valid media JSON is still hidden (up to its closing fence).
    if (fenced && label === 'sham-media') {
      const stop = close >= 0 ? close + 3 : text.length;
      spans.push({ start: m.index, end: stop });
      starts.lastIndex = stop;
    }
  }
  return spans;
}

/** Text without the media blocks. */
export function removeMediaBlocks(text: string): string {
  const spans = findMediaBlocks(text);
  if (!spans.length) return text;
  let out = '';
  let last = 0;
  for (const s of spans) { out += text.slice(last, s.start); last = s.end; }
  return (out + text.slice(last)).replace(/\n{3,}/g, '\n\n').trim();
}

/** Server side: rewrite whatever form the model used into one canonical, closed sham-media block. */
export function normalizeMediaBlocks(text: string): string {
  const spans = findMediaBlocks(text);
  if (!spans.length) return text;
  const merged: Record<string, unknown[]> = {};
  for (const s of spans) for (const [k, v] of Object.entries(s.data || {})) {
    const key = k.endsWith('s') ? k : `${k}s`;
    merged[key] = [...(merged[key] || []), ...(Array.isArray(v) ? v : [v])];
  }
  const body = removeMediaBlocks(text);
  return Object.keys(merged).length ? `\`\`\`sham-media\n${JSON.stringify(merged)}\n\`\`\`\n${body}` : body;
}
