/**
 * «مجتمع شام» in the browser: the session token and every call to /api/community.
 * The token is the only thing kept on the device (no password, no private data); the server holds the
 * account, encrypted. Pages (GitHub) and Vercel use the same API through apiUrl().
 */
import { apiUrl, isStaticHosting } from '../utils/api';

export const SESSION_KEY = 'sham_community_session_v1';

export class CommunityApiError extends Error {
  constructor(public status: number, public code: string, public field?: string) { super(code); }
}

export function getSessionToken(): string {
  try { return localStorage.getItem(SESSION_KEY) || ''; } catch { return ''; }
}
export function setSessionToken(token: string) {
  try { if (token) localStorage.setItem(SESSION_KEY, token); else localStorage.removeItem(SESSION_KEY); } catch { /* storage blocked */ }
  window.dispatchEvent(new Event('sham-community-session'));
}

type Body = Record<string, unknown> | unknown[] | undefined;

export async function cx<T>(path: string, init: { method?: string; body?: Body; signal?: AbortSignal; timeoutMs?: number; token?: string } = {}): Promise<T> {
  if (isStaticHosting) throw new CommunityApiError(503, 'COMMUNITY_NOT_CONFIGURED');
  const token = init.token ?? getSessionToken();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), init.timeoutMs ?? 30_000);
  init.signal?.addEventListener('abort', () => controller.abort(), { once: true });
  try {
    const response = await fetch(apiUrl(`/api${path}` as `/api/${string}`), {
      method: init.method || (init.body !== undefined ? 'POST' : 'GET'),
      headers: { ...(init.body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      signal: controller.signal,
    });
    const data = (response.headers.get('content-type') || '').includes('application/json') ? await response.json() : null;
    if (!response.ok) {
      if (response.status === 401 && token && !path.startsWith('/community/auth/')) setSessionToken('');
      throw new CommunityApiError(response.status, data?.code || 'HTTP_ERROR', data?.code === 'INVALID_FIELD' ? data?.error : undefined);
    }
    return data as T;
  } catch (error) {
    if (error instanceof CommunityApiError) throw error;
    throw new CommunityApiError(0, controller.signal.aborted ? 'TIMEOUT' : 'NETWORK');
  } finally {
    clearTimeout(timer);
  }
}

/* --------------------------------------------- types --------------------------------------------- */

export interface PublicUser {
  id: string; handle: string; name: string; avatar: string | null; bio: string; country: string; craftLevel: string; role: string;
  merchant?: { slug: string; storeName: string } | null; online: boolean; lastSeen: string; mutual?: number;
}
export interface Me {
  id: string; handle: string; name: string; email: string; role: 'user' | 'merchant'; status: string; country: string; lang: string;
  craftLevel: string; bio: string; avatar: string | null; private: { phone?: string; city?: string; address?: string }; createdAt: string;
  merchant: { slug: string; storeName: string; status: 'pending' | 'approved' | 'suspended' | 'rejected'; note: string } | null;
  counts: { recipes: number; friends: number; orders: number; posts: number };
}
export interface Post {
  id: string; body: string; image: string | null; visibility: 'public' | 'friends'; createdAt: string; editedAt: string | null;
  author: PublicUser; mine: boolean; comments: number; reactions: Record<string, number>; myReaction: string | null;
  recipe: { id: string; title: string; data: Record<string, unknown> } | null;
}
export interface Comment { id: string; body: string; createdAt: string; author: PublicUser; mine: boolean }
export interface Notification { id: string; kind: string; ref: string; createdAt: string; read: boolean; actor: PublicUser | null }
export interface Recipe { id: string; title: string; data: Record<string, any>; notes: string; visibility: 'private' | 'friends' | 'public'; createdAt: string; updatedAt: string }
export interface Learning { itemId: string; kind: string; title: string; progress: number; updatedAt: string }
export interface Order {
  id: string; number: string; status: string; createdAt: string; country: string; items: { sku: string; name: string; qty: number; image?: string; unit?: number }[];
  total?: number; amount?: number; currency: string; store?: string;
}
export interface Pulse { messages: number; notifications: number; requests: number; lastAt: string | null; serverTime: string }
export interface ChatSummary {
  id: string; kind: 'direct' | 'group'; title: string; muted: boolean; unread: number; lastAt: string; members: PublicUser[]; typing: string[];
  last: { kind: string; text: string; mine: boolean; deleted: boolean; at: string } | null;
}
export interface Message {
  id: string; kind: 'text' | 'image' | 'voice' | 'recipe' | 'system'; senderId: string; mine: boolean; createdAt: string; editedAt: string | null; deleted: boolean;
  text: string; attachment: string | null; replyTo: { id: string; senderId: string; kind: string; text: string } | null;
  reactions: Record<string, number>; myReaction: string | null;
}
export interface ChatView {
  conversation: { id: string; kind: 'direct' | 'group'; title: string; muted: boolean };
  members: (PublicUser & { role: string; lastReadAt: string; typing: boolean })[];
  messages: Message[]; serverTime: string;
}
export interface MerchantFile {
  slug: string; storeName: string; about: string; logo: string | null; country: string; currency: string; status: string; note: string;
  legal: Record<string, string>; payout: Record<string, string>; createdAt: string; reviewedAt: string | null;
  stats: { products: number; published: number; pending: number; orders: number; earnings: number };
}
export interface MerchantProduct {
  id: string; name: string; description: string; category: string; images: string[]; price: number; currency: string; stock: number;
  status: 'pending' | 'approved' | 'rejected' | 'paused'; reviewNote: string; createdAt: string; updatedAt: string; source?: { links: string[]; notes: string };
}
export interface StoreSummary { slug: string; name: string; about: string; logo: string | null; country: string; products: number }
export interface StoreProduct { sku: string; id: string; name: string; description: string; category: string; images: string[]; priceEgp: number; inStock: boolean; store?: { slug: string; name: string } }
export interface StorePage { store: { slug: string; name: string; about: string; logo: string | null; country: string; since: string }; products: StoreProduct[] }
export interface AuthResult { token: string; expiresAt: string; me: Me }

/* -------------------------------------------- helpers -------------------------------------------- */

/** Resizes a picture in the browser before upload (JPEG, longest side `max`), so posts and chats stay light. */
export function resizeImage(file: File, max = 1280, quality = 0.82): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) { reject(new Error('not an image')); return; }
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('bad image'));
      img.onload = () => {
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale); canvas.height = Math.round(img.height * scale);
        const c2d = canvas.getContext('2d');
        if (!c2d) { reject(new Error('no canvas')); return; }
        c2d.fillStyle = '#fff'; c2d.fillRect(0, 0, canvas.width, canvas.height);
        c2d.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(blob);
  });
}
