import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { isStaticHosting, requestApi } from '../utils/api';
import type { ShaheenModelChoice } from '../utils/chatStore';

export interface ShaheenEngine {
  id: ShaheenModelChoice;
  name: string;
  model?: string;
  hasApiKey: boolean;
}
interface ModelsState {
  models: ShaheenEngine[] | null;
  failed: boolean;
  enabled: boolean;
  allowVisitorChoice: boolean;
}

/**
 * One request to /api/models shared by every Shaheen surface. The answer reflects the server's live
 * settings (server/config/shaheen.ts + admin dashboard), so the GitHub Pages site and the Vercel site
 * show exactly the same engines.
 */
let state: ModelsState = { models: null, failed: false, enabled: true, allowVisitorChoice: true };
let inflight: Promise<void> | null = null;
let fetchedAt = 0;
const listeners = new Set<() => void>();
const publish = (next: ModelsState) => { state = next; listeners.forEach((l) => l()); };

const isEngine = (m: unknown): m is ShaheenEngine => Boolean(m && typeof (m as ShaheenEngine).id === 'string' &&
  typeof (m as ShaheenEngine).hasApiKey === 'boolean');

export function loadShaheenModels(force = false): Promise<void> {
  if (isStaticHosting) return Promise.resolve();
  if (!force && (inflight || (state.models && Date.now() - fetchedAt < 5 * 60_000))) return inflight || Promise.resolve();
  inflight = requestApi<{ models: unknown; enabled?: boolean; allowVisitorChoice?: boolean }>('/api/models', {}, 15000)
    .then((data) => {
      if (!Array.isArray(data.models) || !data.models.every(isEngine)) throw new Error('Invalid models response');
      fetchedAt = Date.now();
      publish({ models: data.models, failed: false, enabled: data.enabled !== false, allowVisitorChoice: data.allowVisitorChoice !== false });
    })
    .catch(() => publish({ ...state, failed: !state.models }))
    .finally(() => { inflight = null; });
  return inflight;
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  void loadShaheenModels();
  const refresh = () => { if (document.visibilityState === 'visible') void loadShaheenModels(); };
  document.addEventListener('visibilitychange', refresh);
  return () => { listeners.delete(listener); document.removeEventListener('visibilitychange', refresh); };
};
const getSnapshot = () => state;

const CHOICE_KEY = 'shaheen_engine_choice';
const readChoice = (): ShaheenModelChoice => {
  try { return (localStorage.getItem(CHOICE_KEY) as ShaheenModelChoice) || 'auto'; } catch { return 'auto'; }
};

export function useShaheenModels() {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const [choice, setChoiceState] = useState<ShaheenModelChoice>(readChoice);
  const find = (id: string) => snapshot.models?.find((m) => m.id === id);
  // Unknown until the list arrives (or when it cannot be fetched): don't block typing, the server decides.
  const isUnavailable = (id: string) => isStaticHosting || (snapshot.models ? find(id)?.hasApiKey !== true : false);

  // A remembered engine that the admin removed, or that lost its key, falls back to "auto".
  const valid = choice === 'auto' || (snapshot.allowVisitorChoice && (!snapshot.models || find(choice)?.hasApiKey === true));
  const selected: ShaheenModelChoice = valid ? choice : 'auto';
  useEffect(() => { if (!valid && snapshot.models) setChoiceState('auto'); }, [valid, snapshot.models]);

  const setSelected = useCallback((id: ShaheenModelChoice) => {
    setChoiceState(id);
    try { localStorage.setItem(CHOICE_KEY, id); } catch { /* private mode */ }
  }, []);

  /** Engines a visitor can pick: "auto" always, specific ones only when allowed. */
  const engines = (snapshot.models || []).filter((m) => m.id === 'auto' || snapshot.allowVisitorChoice);

  return { ...snapshot, engines, selected, setSelected, isUnavailable, reload: () => loadShaheenModels(true) };
}
