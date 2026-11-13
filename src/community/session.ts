/**
 * The signed-in member, shared by every part of the portal (React useSyncExternalStore), and the «pulse»:
 * one light request every few seconds that tells the header and the tabs about new messages,
 * notifications and friend requests.
 */
import { useSyncExternalStore } from 'react';
import { cx, getSessionToken, setSessionToken, CommunityApiError, type AuthResult, type Me, type PendingLogin, type Pulse } from './api';

export interface SessionState {
  status: 'loading' | 'disabled' | 'guest' | 'member' | 'offline';
  me?: Me;
  pulse?: Pulse;
  /** Why the community is off on this server (`database` / `key`) — shown to the administration only. */
  reason?: string;
}

let state: SessionState = { status: 'loading' };
const listeners = new Set<() => void>();
const publish = (next: SessionState) => { state = next; listeners.forEach((l) => l()); };

let loading: Promise<void> | undefined;
export function refreshSession(): Promise<void> {
  return (loading ||= (async () => {
    try {
      const status = await cx<{ enabled: boolean; reason?: string }>('/community/status');
      if (!status.enabled) { publish({ status: 'disabled', reason: status.reason }); return; }
      if (!getSessionToken()) { publish({ status: 'guest' }); return; }
      const me = await cx<Me>('/community/me');
      publish({ status: 'member', me, pulse: state.pulse });
      void pulseNow();
    } catch (error) {
      if (error instanceof CommunityApiError && error.status === 401) publish({ status: 'guest' });
      else if (error instanceof CommunityApiError && error.code === 'COMMUNITY_NOT_CONFIGURED') publish({ status: 'disabled' });
      else publish({ status: state.me ? 'member' : 'offline', me: state.me });
    } finally { loading = undefined; }
  })());
}

export async function pulseNow() {
  if (!getSessionToken() || state.status !== 'member') return;
  try { publish({ ...state, pulse: await cx<Pulse>('/community/pulse', { timeoutMs: 12_000 }) }); } catch { /* next tick */ }
}

export function setMe(me: Me) { publish({ ...state, status: 'member', me }); }

/** Two-factor accounts stop the password step here; the caller finishes it with `completePendingLogin`. */
export class PendingLoginError extends Error {
  constructor(public pending: PendingLogin) { super('totp_required'); }
}

export async function signIn(email: string, password: string): Promise<Me> {
  const result = await cx<AuthResult | PendingLogin>('/community/auth/login', { body: { email, password } });
  if ('pending' in result) throw new PendingLoginError(result);
  setSessionToken(result.token);
  publish({ status: 'member', me: result.me });
  return result.me;
}

export async function completePendingLogin(pendingToken: string, code: string): Promise<Me> {
  const result = await cx<AuthResult>('/community/auth/login/2fa', { body: { pendingToken, code } });
  setSessionToken(result.token);
  publish({ status: 'member', me: result.me });
  return result.me;
}

export async function signUp(input: Record<string, unknown>): Promise<Me> {
  const result = await cx<AuthResult>('/community/auth/register', { body: input });
  setSessionToken(result.token);
  publish({ status: 'member', me: result.me });
  return result.me;
}

export async function signOut(everywhere = false) {
  try { await cx('/community/auth/logout', { body: { everywhere } }); } catch { /* the token is dropped anyway */ }
  setSessionToken('');
  publish({ status: 'guest' });
}

let timer: ReturnType<typeof setInterval> | undefined;
let fast = 0;
/** Faster pulses while the messenger is open (it calls this with true on mount, false on unmount). */
export function setFastPulse(on: boolean) { fast = Math.max(0, fast + (on ? 1 : -1)); }

/** Only part of the session (e.g. the member and the status): the page re-renders only when that part changes. */
export function useSessionPick<T>(pick: (s: SessionState) => T): T {
  return useSyncExternalStore(subscribe, () => pick(state), () => pick(state));
}

export function useSession(): SessionState {
  return useSyncExternalStore(subscribe, () => state, () => state);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) {
    if (state.status === 'loading') void refreshSession();
    let tick = 0;
    timer = setInterval(() => {
      tick++;
      if (document.visibilityState === 'hidden') return;
      if (fast > 0 || tick % 4 === 0) void pulseNow(); // every 4 s in the messenger, every 16 s elsewhere
    }, 4_000);
    window.addEventListener('sham-community-session', onSessionEvent);
  }
  return () => {
    listeners.delete(listener);
    if (!listeners.size) { clearInterval(timer); window.removeEventListener('sham-community-session', onSessionEvent); }
  };
}

/** The site's sign-in window (AuthModal) and other tabs change the token too: follow them. */
function onSessionEvent() {
  if (!getSessionToken()) { if (state.status === 'member') publish({ status: 'guest' }); }
  else if (state.status !== 'member' && state.status !== 'loading') void refreshSession();
}
