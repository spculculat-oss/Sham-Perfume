/**
 * «غرفة شاهين الخاصة» — the owner's private room with Shaheen and his secretary.
 *
 * Who can read it: the owner (he opens it with the admin code), Shaheen (answers him) and the secretary (keeps the
 * notebook of decisions and tasks). Nobody else:
 *   - the conversation is kept only in the owner's own browser, sealed with AES-GCM under a key derived from his
 *     admin code (PBKDF2-SHA256) — never in the public repository, the site's database, Shaheen's public memory or
 *     the robots' reports;
 *   - the server endpoint (/api/admin/owner-room) answers only with the admin code and keeps nothing;
 *   - card/ID/IBAN numbers are hidden before anything leaves the browser.
 * Shared by the browser (src/admin/OwnerRoom.tsx) and the server (server/ownerRoom.ts).
 */
import { maskSensitive } from './ownerAuthority';

export type RoomSpeaker = 'owner' | 'shaheen' | 'secretary';
export interface RoomMessage { id: string; by: RoomSpeaker; text: string; at: string; offline?: boolean }
export interface RoomNote { id: string; text: string; at: string; done?: boolean }
export interface RoomData { version: 1; messages: RoomMessage[]; notes: RoomNote[] }

export const ROOM_LIMITS = { messages: 300, history: 24, chars: 4000 } as const;
export const emptyRoom = (): RoomData => ({ version: 1, messages: [], notes: [] });

/** The turns sent to the server: the last ones only, numbers hidden, never longer than the limits. */
export function roomHistory(messages: RoomMessage[]): { by: RoomSpeaker; text: string }[] {
  return messages.slice(-ROOM_LIMITS.history).map((m) => ({ by: m.by, text: maskSensitive(m.text).slice(0, ROOM_LIMITS.chars) }));
}

// ── The secretary's notebook (works without any AI) ─────────────────────────────────────────────────────────
/** An order or a request from the owner: «عايز / اعمل / خلي / ضيف / صلح / وقف…». */
const ORDER = /(?:^|[\s،,.!؟?])(?:عايز|عاوز|عايزه|عاوزه|أريد|اريد|محتاج|اعمل|اعملي|اعملى|إعمل|خلي|خلى|ضيف|زود|شيل|امسح|صلح|صلّح|غير|غيّر|وقف|وقّف|شغل|شغّل|كمل|ابدأ|ابدا|راجع|جهز|جهّز|صمم|ابعت|انشر|ركز|لازم|ياريت|please|add|fix|remove|stop|start|make|build|create|check|review|change)(?=$|[\s،,.!؟?])/iu;
/** A decision: «قررت / موافق / ماتعملش / ممنوع…». */
const DECISION = /(?:^|[\s،,.!؟?])(?:قررت|قرار|موافق|مش موافق|اعتمد|ممنوع|ماتعملش|متعملش|بلاش|خلاص|نهائي|approved|decided|never|always)(?=$|[\s،,.!؟?])/iu;

const clip = (t: string, n = 220) => (t.length <= n ? t : `${t.slice(0, n - 1).replace(/\s+\S*$/, '')}…`);

/** What the secretary writes down from the owner's messages: his orders and decisions, newest last. */
export function secretaryNotes(messages: RoomMessage[]): { orders: string[]; decisions: string[] } {
  const orders: string[] = []; const decisions: string[] = [];
  for (const m of messages) {
    if (m.by !== 'owner') continue;
    const text = clip(maskSensitive(m.text).replace(/\s+/g, ' ').trim());
    if (!text) continue;
    if (DECISION.test(text)) decisions.push(text);
    else if (ORDER.test(text)) orders.push(text);
  }
  return { orders: orders.slice(-12), decisions: decisions.slice(-12) };
}

/** The secretary's summary when no AI engine is available (honest about being a notebook, not an analysis). */
export function secretaryLocalSummary(messages: RoomMessage[], notes: RoomNote[] = []): string {
  const { orders, decisions } = secretaryNotes(messages);
  const open = notes.filter((n) => !n.done).map((n) => n.text);
  if (!orders.length && !decisions.length && !open.length) return '📒 لسه مفيش أوامر أو قرارات اتكتبت في الغرفة. أول ما تطلب حاجة هسجلها هنا.';
  const part = (title: string, list: string[]) => (list.length ? [`**${title}**`, ...list.map((x) => `- ${x}`), ''] : []);
  return ['📒 **مفكرة السكرتير**', '', ...part('قراراتك:', decisions), ...part('طلباتك:', orders), ...part('مهام مفتوحة في المفكرة:', open),
    '_ملخص من المفكرة نفسها — التحليل الكامل بيرجع أول ما محركات الذكاء ترجع._'].join('\n').trim();
}

// ── Sealing the room in the owner's browser ─────────────────────────────────────────────────────────────────
export const ROOM_STORAGE_KEY = 'sham_owner_room_v1';
export const ROOM_KDF_ITERATIONS = 210_000;
export interface SealedRoom { v: 1; kdf: 'PBKDF2-SHA256'; iter: number; salt: string; iv: string; data: string }

const b64 = (bytes: Uint8Array) => { let s = ''; for (const b of bytes) s += String.fromCharCode(b); return btoa(s); };
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const subtle = () => { const s = globalThis.crypto?.subtle; if (!s) throw new Error('This browser cannot encrypt (no Web Crypto)'); return s; };

/** Typed arrays as the plain buffers Web Crypto takes (works with the DOM and the Node typings alike). */
const buf = (u: Uint8Array) => u as unknown as ArrayBuffer;

async function roomKey(code: string, salt: Uint8Array, iter: number) {
  const base = await subtle().importKey('raw', new TextEncoder().encode(code.trim().normalize('NFC')), 'PBKDF2', false, ['deriveKey']);
  return subtle().deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt: buf(salt), iterations: iter }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

export const isSealedRoom = (x: unknown): x is SealedRoom => {
  const s = x as SealedRoom;
  return Boolean(s && s.v === 1 && s.kdf === 'PBKDF2-SHA256' && Number.isInteger(s.iter) && s.iter >= 100_000 && typeof s.salt === 'string' && typeof s.iv === 'string' && typeof s.data === 'string');
};

/** Seals the room with the owner's code (a fresh salt and IV every time). */
export async function sealRoom(code: string, room: RoomData, iter = ROOM_KDF_ITERATIONS): Promise<SealedRoom> {
  if (!code.trim()) throw new Error('No code');
  const salt = globalThis.crypto.getRandomValues(new Uint8Array(16));
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const key = await roomKey(code, salt, iter);
  const data = new Uint8Array(await subtle().encrypt({ name: 'AES-GCM', iv: buf(iv) }, key, new TextEncoder().encode(JSON.stringify(room))));
  return { v: 1, kdf: 'PBKDF2-SHA256', iter, salt: b64(salt), iv: b64(iv), data: b64(data) };
}

/** Opens a sealed room; undefined when the code is not the one it was sealed with (or the data was changed). */
export async function openRoom(code: string, sealed: SealedRoom): Promise<RoomData | undefined> {
  try {
    const key = await roomKey(code, unb64(sealed.salt), sealed.iter);
    const plain = await subtle().decrypt({ name: 'AES-GCM', iv: buf(unb64(sealed.iv)) }, key, buf(unb64(sealed.data)));
    return readRoom(JSON.parse(new TextDecoder().decode(plain)));
  } catch { return undefined; }
}

const SPEAKERS = new Set<RoomSpeaker>(['owner', 'shaheen', 'secretary']);
export function readRoom(x: unknown): RoomData {
  const d = (x && typeof x === 'object' ? x : {}) as Partial<RoomData>;
  const messages = (Array.isArray(d.messages) ? d.messages : [])
    .filter((m): m is RoomMessage => Boolean(m && SPEAKERS.has(m.by) && typeof m.text === 'string' && typeof m.id === 'string' && typeof m.at === 'string'))
    .slice(-ROOM_LIMITS.messages);
  const notes = (Array.isArray(d.notes) ? d.notes : [])
    .filter((n): n is RoomNote => Boolean(n && typeof n.text === 'string' && typeof n.id === 'string' && typeof n.at === 'string'))
    .slice(-100);
  return { version: 1, messages, notes };
}
