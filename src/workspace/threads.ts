/**
 * «سجل محادثات مساحة شاهين»: keeps the visitor's conversations on his own device (never uploaded), grouped by
 * recency so he can open, search, continue or delete any past thread at once — and remembers his light/dark look.
 */
import type { ChatItem } from './ChatPanel';
import { isGeneratedImageData } from './workspaceApi';

export interface ChatThread {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  items: ChatItem[];
}

export type ThreadGroupKey = 'today' | 'yesterday' | 'week' | 'older';
export type WorkspaceTheme = 'light' | 'dark';

const THREADS_KEY = 'sham_workspace_threads_v1';
const ACTIVE_KEY = 'sham_workspace_active_thread_v1';
const LEGACY_KEY = 'sham_workspace_chat_v1';
const THEME_KEY = 'sham_workspace_theme_v1';
const LIVE_OPEN_KEY = 'sham_workspace_live_open_v1';
const MAX_THREADS = 40;
const MAX_ITEMS_PER_THREAD = 60;
const DAY_MS = 86_400_000;

/** Cleans stored items: drops unfinished drafts, caps inline data-URL images, and flags stale external image links. */
export function sanitiseItemsForLoad(raw: unknown): ChatItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is ChatItem => Boolean(item && typeof item === 'object' && !item.streaming && (item.role === 'user' || item.role === 'assistant') && typeof item.text === 'string'))
    .slice(-MAX_ITEMS_PER_THREAD)
    .map((item) => (item.image && !isGeneratedImageData(item.image) ? { ...item, image: undefined, regenerateImage: true } : item));
}

export function sanitiseItemsForSave(items: readonly ChatItem[]): ChatItem[] {
  return items
    .filter((item) => !item.streaming)
    .slice(-MAX_ITEMS_PER_THREAD)
    .map((item) => (item.image && item.image.length > 150_000 ? { ...item, image: undefined } : item));
}

/** Builds a clean short title from the first question in a conversation. */
export function threadTitle(items: readonly ChatItem[], fallback = '…'): string {
  const firstUser = items.find((m) => m.role === 'user' && m.text.trim());
  if (!firstUser) return fallback;
  const oneLine = firstUser.text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/[#>*_`~]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!oneLine) return fallback;
  return oneLine.length > 46 ? `${oneLine.slice(0, 45).trim()}…` : oneLine;
}

export function newThreadId(now = Date.now()): string {
  return `ws-t-${now.toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function loadThreads(now = Date.now()): ChatThread[] {
  try {
    const raw = localStorage.getItem(THREADS_KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const valid = parsed
          .flatMap((entry): ChatThread[] => {
            if (!entry || typeof entry !== 'object') return [];
            const obj = entry as Partial<ChatThread>;
            if (typeof obj.id !== 'string' || !obj.id) return [];
            const items = sanitiseItemsForLoad(obj.items);
            if (!items.length) return [];
            const createdAt = typeof obj.createdAt === 'number' && Number.isFinite(obj.createdAt) ? obj.createdAt : now;
            const updatedAt = typeof obj.updatedAt === 'number' && Number.isFinite(obj.updatedAt) ? obj.updatedAt : createdAt;
            const title = typeof obj.title === 'string' && obj.title.trim() ? obj.title.trim() : threadTitle(items);
            return [{ id: obj.id, title, createdAt, updatedAt, items }];
          })
          .sort((a, b) => b.updatedAt - a.updatedAt)
          .slice(0, MAX_THREADS);
        if (valid.length) return valid;
      }
    }
    // Seamless upgrade from the earlier single-chat storage so no conversation is lost.
    const legacy = sanitiseItemsForLoad(JSON.parse(localStorage.getItem(LEGACY_KEY) || '[]'));
    if (legacy.length) {
      const migrated: ChatThread = { id: newThreadId(now), title: threadTitle(legacy), createdAt: now, updatedAt: now, items: legacy };
      return [migrated];
    }
  } catch { /* private mode or SSR */ }
  return [];
}

export function saveThreads(threads: readonly ChatThread[]): void {
  try {
    const payload = threads
      .map((t) => {
        const items = sanitiseItemsForSave(t.items);
        return items.length ? { id: t.id, title: threadTitle(items, t.title), createdAt: t.createdAt, updatedAt: t.updatedAt, items } : null;
      })
      .filter((t): t is ChatThread => t !== null)
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, MAX_THREADS);
    localStorage.setItem(THREADS_KEY, JSON.stringify(payload));
  } catch { /* quota or blocked */ }
}

export function loadActiveThreadId(): string | null {
  try { return localStorage.getItem(ACTIVE_KEY) || null; } catch { return null; }
}

export function saveActiveThreadId(id: string | null): void {
  try {
    if (id) localStorage.setItem(ACTIVE_KEY, id);
    else localStorage.removeItem(ACTIVE_KEY);
  } catch { /* blocked */ }
}

/** Updates (or inserts) one thread with its newest finished messages; drops it if emptied. */
export function upsertThreadItems(threads: readonly ChatThread[], threadId: string, items: readonly ChatItem[], now = Date.now()): ChatThread[] {
  const saved = sanitiseItemsForSave(items);
  const existing = threads.find((t) => t.id === threadId);
  if (!saved.length) return threads.filter((t) => t.id !== threadId);
  // Keep updatedAt unchanged when the finished messages have not changed (avoids reordering when reading old chats).
  const sameContent = existing
    && existing.items.length === saved.length
    && existing.items.every((m, idx) => m.role === saved[idx]?.role && m.text === saved[idx]?.text && (m.sources?.length || 0) === (saved[idx]?.sources?.length || 0));
  const next: ChatThread = {
    id: threadId,
    title: threadTitle(saved, existing?.title),
    createdAt: existing?.createdAt ?? now,
    updatedAt: sameContent ? existing.updatedAt : now,
    items: saved,
  };
  return [next, ...threads.filter((t) => t.id !== threadId)]
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, MAX_THREADS);
}

export function removeThread(threads: readonly ChatThread[], threadId: string): ChatThread[] {
  return threads.filter((t) => t.id !== threadId);
}

/** Filters threads by title or message content (case- and Arabic-alef-insensitive). */
export function filterThreads(threads: readonly ChatThread[], query: string): ChatThread[] {
  const norm = (s: string) => s.normalize('NFKC').replace(/[\u064B-\u065F\u0670]/g, '').replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').toLowerCase().trim();
  const q = norm(query);
  if (!q) return [...threads];
  return threads.filter((t) => norm(t.title).includes(q) || t.items.some((m) => norm(m.text).includes(q)));
}

/** Groups threads into Today / Yesterday / Previous week / Older buckets, newest first. */
export function groupThreadsByRecency(threads: readonly ChatThread[], now = Date.now()): Array<{ group: ThreadGroupKey; threads: ChatThread[] }> {
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const t0 = todayStart.getTime();
  const buckets: Record<ThreadGroupKey, ChatThread[]> = { today: [], yesterday: [], week: [], older: [] };
  const sorted = [...threads].sort((a, b) => b.updatedAt - a.updatedAt);
  for (const thread of sorted) {
    if (thread.updatedAt >= t0) buckets.today.push(thread);
    else if (thread.updatedAt >= t0 - DAY_MS) buckets.yesterday.push(thread);
    else if (thread.updatedAt >= t0 - 7 * DAY_MS) buckets.week.push(thread);
    else buckets.older.push(thread);
  }
  return (['today', 'yesterday', 'week', 'older'] as const)
    .filter((group) => buckets[group].length > 0)
    .map((group) => ({ group, threads: buckets[group] }));
}

export function loadWorkspaceTheme(): WorkspaceTheme {
  try {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored === 'dark' || stored === 'light') return stored;
  } catch { /* SSR or blocked */ }
  return 'light';
}

export function saveWorkspaceTheme(theme: WorkspaceTheme): void {
  try { localStorage.setItem(THEME_KEY, theme); } catch { /* blocked */ }
}

export function loadLivePanelPref(): boolean {
  try { return localStorage.getItem(LIVE_OPEN_KEY) === '1'; } catch { return false; }
}

export function saveLivePanelPref(open: boolean): void {
  try { localStorage.setItem(LIVE_OPEN_KEY, open ? '1' : '0'); } catch { /* blocked */ }
}
