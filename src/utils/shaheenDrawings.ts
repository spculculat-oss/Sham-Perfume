/**
 * «رسومات شاهين في المحادثة» — the pictures Shaheen draws in the «اسأل شاهين» chat.
 *
 * A reply that ends with a ```sham-image line is a drawing order. The picture is drawn once, when the reply
 * arrives (`freshReplies`), through the same route as the workspace (/api/workspace/image → «خيال شاهين»),
 * and kept for this visit only: saved chats keep the words, and a reopened chat offers «ارسم الصورة» instead
 * of spending quota by itself. The chat is shown in two places at once (the page and the floating window),
 * so one shared record guarantees one drawing per reply.
 */
import { parseImageRequest } from './imageCraft';

export type DrawingNote = 'image_unavailable' | 'image_quota' | 'image_refused' | 'rate_limited' | 'image_failed';
export type Drawing = { status: 'busy' } | { status: 'done'; src: string; painted?: 'whole' | 'partial' } | { status: 'error'; note: DrawingNote };
/** `painted`: Shaheen's own painter drew it (the engine was not there) — whole, or the place and mood only. */
export type Draw = (prompt: string, previous?: string) => Promise<string | { src: string; painted?: 'whole' | 'partial' }>;

/** Replies that arrived during this visit (not restored from storage). */
export const freshReplies = new Set<string>();

const drawings = new Map<string, Drawing>();
const listeners = new Set<() => void>();
const publish = (id: string, drawing: Drawing) => { drawings.set(id, drawing); for (const listener of listeners) listener(); };

export const drawingOf = (id: string): Drawing | undefined => drawings.get(id);
export function subscribeDrawings(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
export function forgetDrawings(): void { drawings.clear(); freshReplies.clear(); for (const listener of listeners) listener(); }

/** The picture an «EDIT: …» order changes: the last one drawn before this reply. */
export function previousDrawing(ids: readonly string[], before: string): string | undefined {
  const at = ids.indexOf(before);
  for (let i = (at < 0 ? ids.length : at) - 1; i >= 0; i--) {
    const drawing = drawings.get(ids[i]);
    if (drawing?.status === 'done') return drawing.src;
  }
  return undefined;
}

/**
 * Draw the order of one reply. Asked twice (two views, a double click) it still draws once; a failure can be
 * retried. `note` turns the route's error into the sentence the visitor reads.
 */
export async function drawReply(id: string, line: string, draw: Draw, note: (error: unknown) => DrawingNote, previous?: string): Promise<Drawing> {
  const now = drawings.get(id);
  if (now && now.status !== 'error') return now;
  publish(id, { status: 'busy' });
  const order = parseImageRequest(line);
  try {
    const out = await draw(order.prompt, order.mode === 'edit' ? previous : undefined);
    publish(id, typeof out === 'string' ? { status: 'done', src: out } : { status: 'done', src: out.src, ...(out.painted ? { painted: out.painted } : {}) });
  } catch (error) {
    publish(id, { status: 'error', note: note(error) });
  }
  return drawings.get(id)!;
}
