/**
 * Decisions of «طبيب شاهين»: findings + memory of previous runs → remedies.
 *
 * Rules of thumb (so it never makes things worse while nobody is watching):
 *  - act on a problem only when it repeats (2 runs ≈ 20 minutes), except a red build of main;
 *  - every remedy has a cooldown, code fixes are capped per day, and only one code fix may be awaiting
 *    verification at a time;
 *  - a merged fix is watched after it goes live: if new problems appear it is reverted automatically.
 */
import type { CheckId, Finding } from './probes';

export type ActionKind = 'reset_runtime' | 'rerun_pages' | 'rerun_keys' | 'redeploy_vercel' | 'nudge_deploy' | 'ai_fix' | 'revert' | 'verify_build';
export interface Action { kind: ActionKind; reason: string; problem?: string; evidence?: string; sha?: string; check?: CheckId }

export interface FixRecord { at: string; problem: string; result: 'merged' | 'failed' | 'verified' | 'reverted' | 'unverified'; sha?: string; url?: string; summary?: string }
export interface DoctorState {
  version: 1;
  runs: number;
  lastRunAt?: string;
  streaks: Partial<Record<CheckId, number>>;
  lastStatus: Partial<Record<CheckId, Finding['status']>>;
  lastActions: Partial<Record<string, string>>;
  fixes: FixRecord[];
  pending?: { sha: string; at: string; liveAt?: string; baseline: CheckId[]; problem: string; badRuns?: number };
  history: { at: string; fails: CheckId[]; warns: CheckId[] }[];
}

export const emptyState = (): DoctorState => ({ version: 1, runs: 0, streaks: {}, lastStatus: {}, lastActions: {}, fixes: [], history: [] });

export interface Capabilities { adminToken: boolean; vercelToken: boolean; ai: boolean; write: boolean }

const MIN = 60_000;
export const COOLDOWN_MIN: Record<ActionKind, number> = {
  reset_runtime: 30, rerun_pages: 60, rerun_keys: 6 * 60, redeploy_vercel: 3 * 60, nudge_deploy: 24 * 60, ai_fix: 60, revert: 30, verify_build: 3 * 60,
};
export const MAX_FIXES_PER_DAY = 3;
export const VERIFY_AFTER_LIVE_MIN = 30;
const RATE_LIMIT_WAIT_MIN = 24 * 60 + 10; // Vercel: "retry in 24 hours"

/** Updates streaks/history with this run's findings (mutates and returns the state). */
export function remember(state: DoctorState, findings: Finding[], now = Date.now()): DoctorState {
  state.runs++;
  state.lastRunAt = new Date(now).toISOString();
  for (const f of findings) {
    state.streaks[f.id] = f.status === 'fail' ? (state.streaks[f.id] || 0) + 1 : 0;
    state.lastStatus[f.id] = f.status;
  }
  state.history.push({ at: state.lastRunAt, fails: findings.filter((f) => f.status === 'fail').map((f) => f.id), warns: findings.filter((f) => f.status === 'warn').map((f) => f.id) });
  if (state.history.length > 36) state.history.splice(0, state.history.length - 36);
  return state;
}

export const cooled = (state: DoctorState, key: string, minutes: number, now: number) => {
  const last = state.lastActions[key];
  return !last || now - Date.parse(last) >= minutes * MIN;
};
const fixesToday = (state: DoctorState, now: number) => state.fixes.filter((f) => f.result !== 'failed' && now - Date.parse(f.at) < 24 * 60 * MIN).length
  + state.fixes.filter((f) => f.result === 'failed' && now - Date.parse(f.at) < 24 * 60 * MIN).length / 2; // failed attempts count half

export const canFix = (state: DoctorState, caps: Capabilities, now: number) =>
  caps.ai && caps.write && !state.pending && fixesToday(state, now) < MAX_FIXES_PER_DAY;

export function decide(findings: Finding[], state: DoctorState, caps: Capabilities, now = Date.now()): { actions: Action[]; notes: string[] } {
  const by = Object.fromEntries(findings.map((f) => [f.id, f])) as Record<CheckId, Finding>;
  const streak = (id: CheckId) => state.streaks[id] || 0;
  const actions: Action[] = [];
  const notes: string[] = [];
  const add = (action: Action, key: string = action.kind) => {
    if (actions.some((a) => a.kind === action.kind)) return;
    if (!cooled(state, key, COOLDOWN_MIN[action.kind], now)) { notes.push(`«${action.reason}» — الإجراء ${action.kind} اتعمل من قريب، مستني فترة التهدئة`); return; }
    actions.push(action);
  };
  const fix = (action: Omit<Action, 'kind'>) => {
    if (!caps.ai) { notes.push(`${action.reason} — محتاج إصلاح في الكود، ومفيش مفتاح ذكاء اصطناعي للطبيب`); return; }
    if (state.pending) { notes.push(`${action.reason} — في انتظار التأكد من الإصلاح السابق (${state.pending.sha.slice(0, 7)}) قبل أي إصلاح جديد`); return; }
    if (!canFix(state, caps, now)) { notes.push(`${action.reason} — وصلت للحد اليومي للإصلاحات (${MAX_FIXES_PER_DAY})`); return; }
    add({ kind: 'ai_fix', ...action }, `ai_fix:${action.problem}`);
  };

  // 1) A fix that went live: keep it only if it did not make things worse.
  const pending = state.pending;
  if (pending) {
    const live = String(by.deploy?.data?.live || '');
    const isLive = by.deploy?.status === 'ok' && live && pending.sha.startsWith(live.slice(0, 7));
    if (isLive) {
      pending.liveAt ||= new Date(now).toISOString();
      const fresh = findings.filter((f) => f.status === 'fail' && !pending.baseline.includes(f.id) && f.id !== 'deploy').map((f) => f.id);
      pending.badRuns = fresh.length ? (pending.badRuns || 0) + 1 : 0;
      if (pending.badRuns >= 2) {
        add({ kind: 'revert', sha: pending.sha, reason: `الإصلاح ${pending.sha.slice(0, 7)} ظهر بعده مشاكل جديدة: ${fresh.join('، ')}` });
      } else if (now - Date.parse(pending.liveAt) >= VERIFY_AFTER_LIVE_MIN * MIN && !fresh.length) {
        const record = state.fixes.find((f) => f.sha === pending.sha);
        if (record) record.result = 'verified';
        notes.push(`✅ الإصلاح ${pending.sha.slice(0, 7)} شغال على الموقع ${VERIFY_AFTER_LIVE_MIN} دقيقة من غير مشاكل جديدة`);
        state.pending = undefined;
      }
    } else if (now - Date.parse(pending.at) > 26 * 60 * MIN) {
      const record = state.fixes.find((f) => f.sha === pending.sha);
      if (record) record.result = 'unverified';
      notes.push(`الإصلاح ${pending.sha.slice(0, 7)} ما اتنشرش على Vercel خلال 26 ساعة — اتقفل من غير تأكيد`);
      state.pending = undefined;
    }
  }

  // A fix that made things worse is undone first and alone: other remedies wait for the next run.
  if (actions.some((a) => a.kind === 'revert')) return caps.write ? { actions, notes } : { actions: [], notes: [...notes, '(وضع المراجعة فقط) كنت هرجّع الإصلاح'] };

  // 2) Red build/tests on main = code problem (acts at once).
  if (by.ci?.status === 'fail') {
    const sha = String(by.ci.data?.sha || '');
    if (state.pending && sha && state.pending.sha.startsWith(sha.slice(0, 7))) add({ kind: 'revert', sha: state.pending.sha, reason: 'الإصلاح الأخير كسر فحص main' });
    else fix({ problem: `ci:${sha.slice(0, 12)}`, check: 'ci', reason: `فحص وبناء main فشل (${sha.slice(0, 7)})`, evidence: `run ${by.ci.data?.runId}` });
  }

  // 3) Live site not on main.
  const deploy = by.deploy;
  if (deploy && (deploy.status === 'fail' || deploy.status === 'warn')) {
    const reason = deploy.data?.reason;
    const age = Number(deploy.data?.statusAgeMin || 0);
    if (reason === 'rate_limited') {
      if (age >= RATE_LIMIT_WAIT_MIN) {
        if (caps.vercelToken) add({ kind: 'redeploy_vercel', reason: 'حد النشر في Vercel اتصفّر — بعيد نشر آخر نسخة' });
        else if (caps.write) add({ kind: 'nudge_deploy', reason: 'حد النشر في Vercel اتصفّر — بعمل نشر جديد لآخر نسخة' });
      } else notes.push(`Vercel رافض النشر بسبب الحد اليومي — هعيد المحاولة تلقائيًا بعد ${Math.max(0, RATE_LIMIT_WAIT_MIN - age)} دقيقة`);
    } else if (reason === 'build_failed') {
      add({ kind: 'verify_build', reason: 'بناء Vercel فشل — بجرب البناء بنفسي علشان أعرف هل المشكلة في الكود' });
    } else if ((reason === 'stuck' || reason === 'no_deploy' || reason === 'mismatch') && deploy.status === 'warn') {
      if (caps.vercelToken) add({ kind: 'redeploy_vercel', reason: `النشر مش بيتقدم (${reason})` });
      else notes.push(`النشر مش بيتقدم (${reason}) — هستنى؛ مع VERCEL_TOKEN أقدر أعيد النشر بنفسي`);
    }
  }

  // 4) Visitors cannot get answers.
  const chat = by.chat;
  if (chat?.status === 'fail' && streak('chat') >= 2) {
    const problem = chat.data?.problem;
    if (problem === 'vendor_leak') fix({ problem: 'vendor_leak', check: 'chat', reason: 'رد شاهين بيظهر اسم مزوّد للزوار', evidence: `Reply excerpt:\n${chat.data?.excerpt || ''}` });
    else {
      if (caps.adminToken) add({ kind: 'reset_runtime', reason: `أسئلة الزوار بتفشل (${chat.summary})` });
      add({ kind: 'rerun_keys', reason: 'بعيد فحص مفاتيح الذكاء الاصطناعي ومزامنتها' });
      if (problem === 'empty' && streak('chat') >= 6) fix({ problem: 'empty_reply', check: 'chat', reason: 'شاهين بيرجّع ردود فاضية من ساعة', evidence: JSON.stringify(chat.data) });
    }
  }
  if (by.runtime?.status === 'fail' && streak('runtime') >= 2 && caps.adminToken) add({ kind: 'reset_runtime', reason: by.runtime.summary });
  if (by.modes?.status === 'fail' && streak('modes') >= 2) {
    if (by.modes.data?.leak) fix({ problem: 'vendor_leak_modes', check: 'modes', reason: by.modes.summary, evidence: JSON.stringify(by.modes.data) });
    else add({ kind: 'rerun_keys', reason: by.modes.summary });
  }

  // 5) Site / Pages / CORS.
  if (by.api?.status === 'fail' && streak('api') >= 2) {
    if (caps.vercelToken) add({ kind: 'redeploy_vercel', reason: 'الـ API واقف' });
    else notes.push('الـ API واقف — مع VERCEL_TOKEN أقدر أعيد النشر بنفسي');
  }
  if (by.pages?.status === 'fail' && streak('pages') >= 2) add({ kind: 'rerun_pages', reason: by.pages.summary });
  if (by.cors?.status === 'fail' && streak('cors') >= 2) {
    if (by.cors.data?.current) fix({ problem: 'cors', check: 'cors', reason: by.cors.summary, evidence: JSON.stringify(by.cors.data) });
  }

  if (!caps.write) {
    const planned = actions.map((a) => a.kind).join('، ');
    return { actions: [], notes: [...notes, ...(planned ? [`(وضع المراجعة فقط) كنت هعمل: ${planned}`] : [])] };
  }
  return { actions, notes };
}

export function overall(findings: Finding[]): 'ok' | 'warn' | 'fail' {
  if (findings.some((f) => f.status === 'fail')) return 'fail';
  if (findings.some((f) => f.status === 'warn')) return 'warn';
  return 'ok';
}
