/**
 * «الأيقونات العائمة» — every floating launcher on the site (Shaheen, the services assistant, the specialists
 * council, the messenger bubble, the spec sheet's quick-close) can be dragged anywhere on the screen and hidden or
 * shown again. The visitor's choice stays in this browser only (localStorage) — nothing is sent anywhere.
 */
export const FLOATING_DOCK_IDS = ['shaheen', 'assistant', 'specialists', 'messenger', 'spec_close'] as const;
export type FloatingDockId = (typeof FLOATING_DOCK_IDS)[number];

export interface DockPlacement { dx: number; dy: number; hidden: boolean }
export type DockStates = Partial<Record<FloatingDockId, DockPlacement>>;

export const FLOATING_DOCKS_KEY = 'sham_floating_docks_v1';
/** A press that moves less than this is a tap (opens the chat), more is a drag. */
export const DRAG_THRESHOLD_PX = 6;
const EDGE = 10;

const isId = (v: string): v is FloatingDockId => (FLOATING_DOCK_IDS as readonly string[]).includes(v);
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : 0);

export function readDockStates(raw: string | null | undefined): DockStates {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return {};
    const out: DockStates = {};
    for (const [id, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (!isId(id) || !v || typeof v !== 'object') continue;
      const p = v as Record<string, unknown>;
      out[id] = { dx: num(p.dx), dy: num(p.dy), hidden: p.hidden === true };
    }
    return out;
  } catch {
    return {};
  }
}

export interface Box { left: number; top: number; width: number; height: number }

/**
 * Keep the icon fully on screen: `base` is where it sits with no offset, (dx, dy) the wanted offset.
 * Returns the nearest offset that leaves the icon inside the viewport (a small edge margin around it).
 */
export function clampOffset(base: Box, dx: number, dy: number, vw: number, vh: number, edge = EDGE): { dx: number; dy: number } {
  const minDx = edge - base.left;
  const maxDx = vw - edge - (base.left + base.width);
  const minDy = edge - base.top;
  const maxDy = vh - edge - (base.top + base.height);
  const fit = (v: number, lo: number, hi: number) => (hi < lo ? lo : Math.min(hi, Math.max(lo, v)));
  return { dx: Math.round(fit(dx, minDx, maxDx)), dy: Math.round(fit(dy, minDy, maxDy)) };
}

// ── a tiny shared store: every dock and the manager read the same state and hear each other's changes ──
type Listener = () => void;
const listeners = new Set<Listener>();
const mounted = new Map<FloatingDockId, number>();
let cache: DockStates | undefined;

const storage = (): Storage | undefined => {
  try { return typeof window !== 'undefined' ? window.localStorage : undefined; } catch { return undefined; }
};

export function getDockStates(): DockStates {
  if (!cache) cache = readDockStates(storage()?.getItem(FLOATING_DOCKS_KEY));
  return cache;
}

function commit(next: DockStates): void {
  const clean: DockStates = {};
  for (const id of FLOATING_DOCK_IDS) {
    const p = next[id];
    if (p && (p.hidden || p.dx !== 0 || p.dy !== 0)) clean[id] = p;
  }
  cache = clean;
  try {
    const s = storage();
    if (Object.keys(clean).length) s?.setItem(FLOATING_DOCKS_KEY, JSON.stringify(clean));
    else s?.removeItem(FLOATING_DOCKS_KEY);
  } catch { /* private mode: keep it for this visit only */ }
  for (const l of [...listeners]) l();
}

export const placementOf = (id: FloatingDockId): DockPlacement => getDockStates()[id] || { dx: 0, dy: 0, hidden: false };

export function moveDock(id: FloatingDockId, dx: number, dy: number): void {
  commit({ ...getDockStates(), [id]: { ...placementOf(id), dx: Math.round(dx), dy: Math.round(dy) } });
}

export function setDockHidden(id: FloatingDockId, hidden: boolean): void {
  commit({ ...getDockStates(), [id]: { ...placementOf(id), hidden } });
}

export function showAllDocks(): void {
  const all = getDockStates();
  const next: DockStates = {};
  for (const id of FLOATING_DOCK_IDS) if (all[id]) next[id] = { ...all[id]!, hidden: false };
  commit(next);
}

export function resetAllDocks(): void {
  commit({});
}

export function subscribeDocks(listener: Listener): () => void {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === FLOATING_DOCKS_KEY) { cache = undefined; listener(); }
  };
  if (typeof window !== 'undefined') window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    if (typeof window !== 'undefined') window.removeEventListener('storage', onStorage);
  };
}

/** Which docks are on the page right now — the manager only offers to show what can actually appear. */
export function registerDock(id: FloatingDockId): () => void {
  mounted.set(id, (mounted.get(id) || 0) + 1);
  for (const l of [...listeners]) l();
  return () => {
    const n = (mounted.get(id) || 1) - 1;
    if (n <= 0) mounted.delete(id); else mounted.set(id, n);
    for (const l of [...listeners]) l();
  };
}

export const mountedDocks = (): FloatingDockId[] => FLOATING_DOCK_IDS.filter((id) => mounted.has(id));

/** Test hook: forget the in-memory copy so the next read comes from storage again. */
export function __resetDockCacheForTests(): void {
  cache = undefined;
  mounted.clear();
  listeners.clear();
}
