import { useCallback, useEffect, useRef, useState } from 'react';
import { mergeRuns, ROBOTS_SERVER_URLS, serverRunsAsGh, type GhJob, type GhRun, type GhWorkflow, type RobotServerStatus } from '../utils/opsLive';

/**
 * Live GitHub Actions state of the public repository, read in the admin's browser without any key.
 * «خريطة عمل لحظية» (the owner's request, 2026-10-22): every 30 seconds while GitHub's keyless allowance is
 * comfortable, slowing down by itself as it shrinks (GitHub allows 60 keyless reads an hour per address and says how
 * many are left on every answer): 2 minutes under 30 left, 5 minutes under 10. The workflow switches every 15
 * minutes, the steps of at most 2 running runs when they start and on every other refresh — and nothing while the tab
 * is hidden. `cache: 'no-cache'` revalidates with the ETag; an unchanged answer (304) costs nothing.
 * When the allowance runs out it waits for GitHub's reset time and says so; the map keeps the report data.
 */
const API = 'https://api.github.com/repos/spculculat-oss/Sham-Perfume/actions';
export const RUNS_EVERY_MS = 120_000;
export const FAST_MS = 30_000;
const SLOW_MS = 300_000;
/** How long to wait before the next refresh, from what GitHub says is left of the keyless allowance. */
export const paceMs = (remaining?: number) => (remaining === undefined || remaining >= 30 ? FAST_MS : remaining >= 10 ? RUNS_EVERY_MS : SLOW_MS);
const WORKFLOWS_EVERY_MS = 15 * 60_000;
const MAX_JOB_READS = 2;

export interface OpsLiveState {
  runs: GhRun[];
  workflows?: GhWorkflow[];
  jobs: Record<number, GhJob[]>;
  /** Last successful refresh. */
  at?: number;
  /** GitHub's keyless allowance is used up until this time. */
  limitedUntil?: number;
  /** The current pace between refreshes (adapts to the allowance left). */
  everyMs: number;
  error?: boolean;
  loading: boolean;
  /** The robots' server (Render) answered on the last refresh: its runs are in `runs` too. */
  robotServer?: RobotServerStatus;
}

/**
 * The robots' server's own page (no key, no limit). A sleeping free server wakes up on this call and answers on a
 * later refresh; until then the map says it is waiting for the server.
 */
/** The step a server run is on, in the shape of GitHub's jobs (the map shows it the same way). */
const serverJobs = (server?: RobotServerStatus): Record<number, GhJob[]> => Object.fromEntries((server?.runs || [])
  .filter((r) => r.status === 'in_progress' && r.step)
  .map((r) => [r.id, [{ name: r.workflow, status: 'in_progress', conclusion: null, steps: [{ name: r.step!, status: 'in_progress', conclusion: null, number: 1 }] }]]));

/** The address that answered last (asked first next time). */
let serverUrl = ROBOTS_SERVER_URLS[0];
async function robotServer(): Promise<RobotServerStatus | undefined> {
  for (const url of [serverUrl, ...ROBOTS_SERVER_URLS.filter((u) => u !== serverUrl)]) {
    try {
      const r = await fetch(`${url}/status`, { cache: 'no-store', signal: AbortSignal.timeout(8_000) });
      const s = r.ok ? await r.json() as RobotServerStatus : undefined;
      if (s && Array.isArray(s.runs)) { serverUrl = url; return s; }
    } catch { /* asleep or not there: the next address */ }
  }
  return undefined;
}

class Limited extends Error { constructor(public until: number) { super('rate limited'); } }

/** What GitHub said is left of the keyless allowance on its last answer. */
let remaining: number | undefined;
async function gh<T>(path: string): Promise<T> {
  const r = await fetch(`${API}${path}`, { cache: 'no-cache', headers: { Accept: 'application/vnd.github+json' } });
  const left = Number(r.headers.get('x-ratelimit-remaining'));
  if (r.headers.has('x-ratelimit-remaining') && Number.isFinite(left)) remaining = left;
  if ((r.status === 403 || r.status === 429) && r.headers.get('x-ratelimit-remaining') === '0') {
    throw new Limited(Number(r.headers.get('x-ratelimit-reset') || 0) * 1000 || Date.now() + 15 * 60_000);
  }
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json() as Promise<T>;
}

export function useOpsLive(enabled = true): OpsLiveState & { refresh: () => void } {
  const [state, setState] = useState<OpsLiveState>({ runs: [], jobs: {}, loading: false, everyMs: FAST_MS });
  const tick = useRef(0);
  const workflowsAt = useRef(0);
  const busy = useRef(false);
  const limitedUntil = useRef(0);
  const lastAt = useRef(0);
  const seenJobs = useRef<Set<number>>(new Set());

  const refresh = useCallback(async () => {
    if (busy.current || Date.now() < limitedUntil.current) return;
    busy.current = true; tick.current++; lastAt.current = Date.now();
    setState((s) => ({ ...s, loading: true }));
    try {
      const [ghRuns, server] = await Promise.all([gh<{ workflow_runs?: GhRun[] }>('/runs?per_page=100&branch=main&exclude_pull_requests=true'), robotServer()]);
      const githubRuns = ghRuns.workflow_runs || [];
      const runs = mergeRuns(githubRuns, serverRunsAsGh(server, serverUrl));
      let workflows: GhWorkflow[] | undefined;
      if (Date.now() - workflowsAt.current > WORKFLOWS_EVERY_MS) {
        workflows = (await gh<{ workflows?: GhWorkflow[] }>('/workflows?per_page=100')).workflows;
        workflowsAt.current = Date.now();
      }
      // Steps are read for GitHub's runs only (the server's run already says its step).
      const running = githubRuns.filter((r) => r.status === 'in_progress').slice(0, MAX_JOB_READS);
      const jobs: Record<number, GhJob[]> = {};
      if (tick.current % 2 === 1 || running.some((r) => !seenJobs.current.has(r.id))) {
        for (const r of running) { jobs[r.id] = (await gh<{ jobs?: GhJob[] }>(`/runs/${r.id}/jobs?per_page=20`)).jobs || []; seenJobs.current.add(r.id); }
      }
      setState((s) => ({
        runs, robotServer: server, workflows: workflows || s.workflows, at: Date.now(), loading: false, error: false, limitedUntil: undefined, everyMs: paceMs(remaining),
        // Keep the steps of runs still running when they were not re-read this time.
        jobs: { ...Object.fromEntries(Object.entries(s.jobs).filter(([id]) => running.some((r) => String(r.id) === id))), ...jobs, ...serverJobs(server) },
      }));
    } catch (e) {
      if (e instanceof Limited) limitedUntil.current = e.until;
      setState((s) => ({ ...s, loading: false, error: !(e instanceof Limited), limitedUntil: e instanceof Limited ? e.until : s.limitedUntil, everyMs: paceMs(remaining) }));
    } finally { busy.current = false; }
  }, []);

  useEffect(() => {
    if (!enabled) return undefined;
    // Coming back to the tab refreshes too, but never more than once in 25 seconds.
    const run = () => { if (document.visibilityState === 'visible' && Date.now() - lastAt.current > 25_000) void refresh(); };
    // A timer chain, not a fixed interval: each wait follows what GitHub says is left of the allowance.
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;
    const loop = () => { if (stopped) return; run(); timer = setTimeout(loop, paceMs(remaining)); };
    loop();
    document.addEventListener('visibilitychange', run);
    return () => { stopped = true; if (timer) clearTimeout(timer); document.removeEventListener('visibilitychange', run); };
  }, [enabled, refresh]);

  return { ...state, refresh: () => void refresh() };
}
