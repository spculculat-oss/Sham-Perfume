/**
 * «بحث جوجل»: whether Shaheen's Google searches work right now, and the last reason one failed — counts and safe
 * structured reasons only (status, quota name), never a question, a page or a key. Shown in the owner's
 * «بوابة الإنترنت» card, so a dead search is found in a minute instead of by a visitor.
 */
import type { GoogleSearchHealth } from '../../src/utils/netGate';

type Via = 'chat' | 'search';
const state = ((globalThis as { __shamGoogleHealth?: GoogleSearchHealth }).__shamGoogleHealth ??= { ok: 0, failed: 0 });

export const googleHealth = {
  ok(model: string, via: Via) { state.ok++; state.lastOk = { at: new Date().toISOString(), model, via }; },
  fail(model: string, status: number, detail: string, via: Via) {
    state.failed++;
    state.lastError = { at: new Date().toISOString(), model, status, via, ...(detail ? { detail: detail.slice(0, 200) } : {}) };
  },
  snapshot(): GoogleSearchHealth { return JSON.parse(JSON.stringify(state)) as GoogleSearchHealth; },
  /** Tests only. */
  reset() { state.ok = 0; state.failed = 0; delete state.lastOk; delete state.lastError; },
};
