/**
 * «سيرفر الروبوتات» — the rules of the robots' server, without any process, git or network of its own (the server,
 * server.mts, hands them in), so tests can check every decision: who is due, may it run, which steps, with which
 * environment, and what goes to the daily snapshot.
 */
import { GITHUB_SCHEDULES, nextCron, SCHEDULES, type RobotServerRun } from '../../src/utils/opsLive';
import { ownerDecision } from '../owner/gateRule.mjs';
import { inSnapshot, ROBOTS, robotOf, SECRET_NAMES, type FollowUp, type Robot, type RobotStep, type StepCtx } from './registry';

/** The robots the server runs: every timetable that left GitHub and has a server copy. */
export const SERVER_WORKFLOWS = Object.keys(SCHEDULES).filter((w) => !GITHUB_SCHEDULES[w] && robotOf(w));

/** The timetables that fired in (from, to] — each robot at most once, with the cron line that fired. */
export function dueRobots(from: number, to: number): { workflow: string; cron: string }[] {
  const out: { workflow: string; cron: string }[] = [];
  for (const workflow of SERVER_WORKFLOWS) {
    const fired = SCHEDULES[workflow].map((cron) => ({ cron, at: nextCron(cron, from) })).filter((x) => x.at <= to).sort((a, b) => a.at - b.at);
    if (fired.length) out.push({ workflow, cron: fired[fired.length - 1].cron });
  }
  return out;
}

/** The owner's switch for this robot, from the owner's files (the same rule as every workflow's first job). */
export function gate(robot: Robot, controls: unknown, stateOrders: unknown) {
  return ownerDecision(robot.bots, controls as object, stateOrders as object, true);
}

export interface ServerSettings {
  /** The owner's GitHub token for the robots (Render: ROBOTS_GITHUB_TOKEN). */
  token?: string;
  repo: string;
  runnerTemp: string;
}
/**
 * A robot's environment: the server's settings without any secret the robot did not ask for, then its own settings.
 * Every robot runs as «live on main» (the GitHub workflows' main-branch values) and keeps its results for the
 * daily snapshot instead of publishing them.
 */
export function robotEnv(robot: Robot, base: Record<string, string | undefined>, s: ServerSettings, extra: Record<string, string> = {}, cron?: string): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(base)) if (v !== undefined && !SECRET_NAMES.includes(k)) env[k] = v;
  for (const k of robot.secrets || []) if (base[k]) env[k] = base[k]!;
  if (robot.github && s.token) { env.GITHUB_TOKEN = s.token; env.GH_TOKEN = s.token; Object.assign(env, gitAuthEnv(s.token)); }
  Object.assign(env, {
    GITHUB_REPOSITORY: s.repo, GITHUB_REF: 'refs/heads/main', GITHUB_REF_NAME: 'main', RUNNER_TEMP: s.runnerTemp,
    SHAM_PUBLISH_MODE: 'batch', SHAM_ROBOT_SERVER: '1', CI: 'true',
    NODE_OPTIONS: base.ROBOTS_NODE_OPTIONS || '--max-old-space-size=384',
  });
  const ctx: StepCtx = { out: {}, env, cron };
  for (const [k, v] of Object.entries(robot.env || {})) { const val = typeof v === 'function' ? v(ctx) : v; if (val !== undefined) env[k] = val; }
  return { ...env, ...extra };
}

/** Git may push with the owner's token without writing it anywhere on disk (it lives in this process only). */
export function gitAuthEnv(token: string): Record<string, string> {
  return {
    GIT_CONFIG_COUNT: '1', GIT_CONFIG_KEY_0: 'http.https://github.com/.extraheader',
    GIT_CONFIG_VALUE_0: `AUTHORIZATION: basic ${Buffer.from(`x-access-token:${token}`).toString('base64')}`,
  };
}

export type StepVerdict = 'run' | 'heavy' | 'condition' | 'after-failure';
/** Whether a step runs now. */
export function stepVerdict(step: RobotStep, ctx: StepCtx, o: { heavy: boolean; failed: boolean }): StepVerdict {
  if (o.failed && !step.always) return 'after-failure';
  if (step.heavy && !o.heavy) return 'heavy';
  if (step.when && !step.when(ctx)) return 'condition';
  return 'run';
}
/** A step's own settings on top of the robot's environment. */
export function stepEnv(step: RobotStep, ctx: StepCtx): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(step.env || {})) { const val = typeof v === 'function' ? v(ctx) : v; if (val !== undefined && val !== null) env[k] = String(val); }
  return env;
}

/** What a step wrote to $GITHUB_OUTPUT (`name=value` lines and `name<<END` blocks). */
export function parseOutputs(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const heredoc = /^([\w-]+)<<(.+)$/.exec(lines[i]);
    if (heredoc) {
      const body: string[] = [];
      for (i++; i < lines.length && lines[i] !== heredoc[2]; i++) body.push(lines[i]);
      out[heredoc[1]] = body.join('\n');
      continue;
    }
    const eq = lines[i].indexOf('=');
    if (eq > 0) out[lines[i].slice(0, eq)] = lines[i].slice(eq + 1);
  }
  return out;
}

/** The causes a robot wrote as `::error title=…::…` (the same lines the GitHub map reads), clipped. */
export function errorLines(log: string): string[] {
  const out: string[] = [];
  for (const m of log.matchAll(/^::error(?: title=([^:]*))?::(.*)$/gm)) {
    const line = [m[1], m[2]].filter(Boolean).join(' — ').trim().slice(0, 180);
    if (line && !out.includes(line)) out.push(line);
  }
  return out.slice(0, 4);
}

export interface ExecResult { code: number; log: string; outputs: Record<string, string>; env: Record<string, string>; timedOut?: boolean }
/** Runs one bash command with its environment and a time limit (the server gives the real one; tests a fake). */
export type Exec = (cmd: string, env: Record<string, string>, timeoutMs: number, onLine?: (line: string) => void) => Promise<ExecResult>;

export interface RobotResult {
  conclusion: 'success' | 'failure' | 'timed_out';
  failedStep?: string; errors?: string[]; skipped: string[]; followUps: FollowUp[]; outputs: Record<string, Record<string, string>>;
}

/** One robot, step by step, like its workflow job: stops at the first failed step that is not optional. */
export async function runRobot(robot: Robot, env: Record<string, string>, exec: Exec, o: { heavy: boolean; cron?: string; onStep?: (name: string) => void }): Promise<RobotResult> {
  const ctx: StepCtx = { out: {}, env: { ...env }, cron: o.cron };
  const skipped: string[] = [];
  const errors: string[] = [];
  let failed: RobotResult['conclusion'] | undefined;
  let failedStep: string | undefined;
  const started = Date.now();
  for (const step of robot.steps) {
    const verdict = stepVerdict(step, ctx, { heavy: o.heavy, failed: Boolean(failed) });
    if (verdict === 'heavy') { skipped.push(`${step.name} — ${step.heavy}`); continue; }
    if (verdict !== 'run') continue;
    o.onStep?.(step.name);
    const left = robot.timeoutMin * 60_000 - (Date.now() - started);
    const limit = Math.max(30_000, Math.min(left, (step.timeoutMin || robot.timeoutMin) * 60_000));
    const r = await exec(step.run, { ...(ctx.env as Record<string, string>), ...stepEnv(step, ctx) }, limit);
    if (step.id) ctx.out[step.id] = r.outputs;
    Object.assign(ctx.env, r.env); // what the step wrote to $GITHUB_ENV
    if (r.code !== 0 && !step.optional && !failed) {
      failed = r.timedOut ? 'timed_out' : 'failure';
      failedStep = step.name;
      errors.push(...errorLines(r.log));
    }
  }
  if (failed) return { conclusion: failed, failedStep, ...(errors.length ? { errors } : {}), skipped, followUps: [], outputs: ctx.out };
  return { conclusion: 'success', skipped, followUps: robot.then?.(ctx) || [], outputs: ctx.out };
}

/** The changed files the daily snapshot carries: the robots' results only, never code. */
export const snapshotFiles = (changed: string[]) => changed.filter(inSnapshot);

/** The last finished run of each robot, in the shape the pre-meeting check and the patrol read (runs.ts → serverRuns). */
export function lastFinished(runs: RobotServerRun[], url: string): Record<string, { conclusion: string | null; status: string; at: string; url: string; failedStep?: string; errors?: string[] }> {
  const out: ReturnType<typeof lastFinished> = {};
  for (const r of [...runs].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))) {
    if (r.status !== 'completed' || r.conclusion === 'skipped' || out[r.workflow]) continue;
    out[r.workflow] = { conclusion: r.conclusion, status: r.status, at: r.updatedAt, url: `${url}/status`, ...(r.failedStep ? { failedStep: r.failedStep } : {}), ...(r.errors?.length ? { errors: r.errors } : {}) };
  }
  return out;
}

/** The next daily snapshot time (UTC hour `hour`, minute 30) after `now`. */
export function nextSnapshotAt(now: number, hour: number): number {
  const d = new Date(now);
  const at = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), hour, 30);
  return at > now ? at : at + 86_400_000;
}

/**
 * The server's own public address: Render gives RENDER_EXTERNAL_URL, a Hugging Face Space gives SPACE_HOST
 * (sham3331-sham-robots.hf.space). Empty when neither (a local run): then it never visits itself.
 */
export function selfUrl(e: Record<string, string | undefined>): string {
  if (e.RENDER_EXTERNAL_URL?.trim()) return e.RENDER_EXTERNAL_URL.trim().replace(/\/$/, '');
  const host = e.SPACE_HOST?.trim().replace(/^https?:\/\//, '').replace(/\/$/, '');
  return host ? `https://${host}` : '';
}

export { ROBOTS };
