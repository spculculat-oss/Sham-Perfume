/**
 * «طبيب شاهين» — autonomous maintenance agent of «الخبير شاهين». One run (every 10 minutes, GitHub Actions):
 *   1. load memory from the maintenance issue
 *   2. probe the live site (light requests only — no load on visitors)
 *   3. decide remedies (playbook.ts) and carry them out:
 *        runtime reset through the admin API · re-run Pages / key-sync workflows · Vercel redeploy (token) or a
 *        deploy nudge commit · AI code fix verified by the full test suite, merged, watched, auto-reverted if worse
 *   4. update the status board, comment only on events.
 * Runs on GitHub's machines, never on the website's servers.
 */
import { execFile } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { COOLDOWN_MIN, canFix, cooled, decide, remember, type Action, type Capabilities, type DoctorState, type FixRecord } from './playbook';
import { runProbes, type Finding, type ProbeContext } from './probes';
import { ISSUE_LABEL, ISSUE_TITLE, eventComment, readState, renderBody, type ActionLog } from './report';
import { attemptFix, VERIFY_COMMANDS, type FixDeps } from './fixer';
import type { GitHub } from './github';
import type { AnswerBook } from './answers';

type Env = Record<string, string | undefined>;
export interface Shell { (command: string, timeoutMs?: number): Promise<{ ok: boolean; output: string }> }

export interface DoctorOptions {
  env: Env;
  github?: GitHub;
  fetch: typeof fetch;
  sh: Shell;
  ask?: (system: string, prompt: string) => Promise<string>;
  root: string;
  mode: 'live' | 'dry';
  runId?: string;
  runUrl?: string;
  now?: () => number;
  log?: (line: string) => void;
}

export function shell(root: string): Shell {
  return (command, timeoutMs = 15 * 60_000) => new Promise((resolve) => {
    execFile('bash', ['-lc', command], { cwd: root, timeout: timeoutMs, maxBuffer: 64 * 1024 * 1024, env: { ...process.env, CI: '1', FORCE_COLOR: '0' } },
      (error, stdout, stderr) => resolve({ ok: !error, output: `${stdout}\n${stderr}`.trim() }));
  });
}

const q = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`;

export async function runDoctor(o: DoctorOptions) {
  const now = o.now || Date.now;
  const log = o.log || ((line: string) => console.log(line));
  const env = o.env;
  const site = (env.DOCTOR_SITE_URL || 'https://sham-perfume-49bf.vercel.app').replace(/\/+$/, '');
  const pages = env.DOCTOR_PAGES_URL || 'https://spculculat-oss.github.io/Sham-Perfume/';
  const vercelProject = env.DOCTOR_VERCEL_PROJECT || 'sham-perfume-49bf';
  const live = o.mode === 'live';
  const caps: Capabilities = {
    adminToken: Boolean(env.SHAM_ADMIN_TOKEN?.trim()),
    vercelToken: Boolean(env.VERCEL_TOKEN?.trim()),
    ai: Boolean(o.ask),
    write: live && Boolean(o.github?.canWrite),
  };

  // 1) memory
  let issue: Awaited<ReturnType<GitHub['findIssue']>>;
  try { issue = await o.github?.findIssue(ISSUE_LABEL); } catch (error) { log(`::warning title=Doctor::cannot read the maintenance issue: ${(error as Error).message}`); }
  const state: DoctorState = readState(issue?.body);
  const previous = state.history.at(-1);

  // 2) probes
  let main: ProbeContext['main'];
  try { main = await o.github?.head('main'); } catch { /* deploy check is skipped */ }
  const ctx: ProbeContext = {
    site, pages, pagesOrigin: new URL(pages).origin, vercelProject, visitorId: 'sham-doctor-probe', adminToken: env.SHAM_ADMIN_TOKEN?.trim() || undefined,
    github: o.github, main, fetch: o.fetch, now: now(),
  };
  const findings = await runProbes(ctx);
  for (const f of findings) log(`${f.status.toUpperCase().padEnd(4)} ${f.id.padEnd(8)} ${f.summary}`);
  remember(state, findings, now());

  // 3) remedies
  const { actions, notes } = decide(findings, state, caps, now());
  const done: ActionLog[] = [];
  const queue = [...actions];
  while (queue.length) {
    const action = queue.shift()!;
    const at = new Date(now()).toISOString();
    state.lastActions[action.kind === 'ai_fix' ? `ai_fix:${action.problem}` : action.kind] = at;
    let result: { ok: boolean; detail: string; then?: Action };
    try { result = await execute(action, { o, ctx, state, findings, caps, main, site, vercelProject, log }); }
    catch (error) { result = { ok: false, detail: `خطأ: ${(error as Error).message.slice(0, 300)}` }; }
    log(`${result.ok ? 'DONE' : 'FAIL'} ${action.kind}: ${result.detail}`);
    done.push({ at, kind: action.kind, reason: action.reason, ok: result.ok, detail: result.detail });
    const next = result.then;
    if (next && !queue.some((a) => a.kind === next.kind)) {
      // Follow-ups obey the same limits as planned remedies (cooldowns, one pending fix, daily cap).
      const allowed = next.kind === 'ai_fix' ? canFix(state, caps, now()) && cooled(state, `ai_fix:${next.problem}`, COOLDOWN_MIN.ai_fix, now())
        : cooled(state, next.kind, COOLDOWN_MIN[next.kind], now());
      if (allowed) queue.push(next);
      else notes.push(`${next.reason} — مؤجل (حدود الأمان: فترة تهدئة أو إصلاح سابق تحت المراقبة)`);
    }
  }

  // 4) report
  const body = renderBody(findings, state, { notes, actions: done, site, runUrl: o.runUrl, mode: o.mode });
  if (o.github && live) {
    try {
      if (!issue) {
        await o.github.ensureLabel(ISSUE_LABEL, '0E8A16', 'سجل طبيب شاهين (صيانة تلقائية)');
        issue = await o.github.createIssue(ISSUE_TITLE, body, [ISSUE_LABEL]);
      } else await o.github.updateIssue(issue.number, body);
      const comment = eventComment(findings, previous, state, done, notes);
      if (comment && issue) await o.github.comment(issue.number, comment);
    } catch (error) { log(`::warning title=Doctor::cannot update the maintenance issue: ${(error as Error).message}`); }
  }
  return { findings, actions: done, notes, state, body };
}

interface ExecContext {
  o: DoctorOptions; ctx: ProbeContext; state: DoctorState; findings: Finding[]; caps: Capabilities;
  main?: { sha: string; date: string }; site: string; vercelProject: string; log: (line: string) => void;
}

async function execute(action: Action, x: ExecContext): Promise<{ ok: boolean; detail: string; then?: Action }> {
  const { o } = x;
  const gh = o.github!;
  switch (action.kind) {
    case 'reset_runtime': {
      const actions = ['reset_provider_gate', 'refresh_model_list', ...(action.reason.includes('فاضي') ? ['clear_answer_cache'] : [])];
      const response = await o.fetch(`${x.site}/api/admin/maintenance`, {
        method: 'POST', headers: { authorization: `Bearer ${o.env.SHAM_ADMIN_TOKEN?.trim()}`, 'content-type': 'application/json' },
        body: JSON.stringify({ actions }), signal: AbortSignal.timeout(15_000),
      });
      return { ok: response.ok, detail: response.ok ? `صفّيت حالة المزوّدين وقائمة الموديلات على الخادم (${actions.join('، ')})` : `واجهة الصيانة ردّت HTTP ${response.status}` };
    }
    case 'rerun_pages':
      await gh.dispatch('pages.yml');
      return { ok: true, detail: 'شغّلت بناء ونشر GitHub Pages من جديد' };
    case 'rerun_keys':
      await gh.dispatch('shaheen-keys.yml');
      return { ok: true, detail: 'شغّلت فحص ومزامنة مفاتيح الذكاء الاصطناعي' };
    case 'redeploy_vercel':
      return redeployVercel(x);
    case 'nudge_deploy':
      return nudgeDeploy(x, action.reason);
    case 'verify_build': {
      const build = await o.sh('npm run build:vercel && npm run test:vercel');
      if (build.ok) {
        return { ok: true, detail: 'البناء عندي نجح — العطل كان مؤقت في Vercel', then: x.caps.vercelToken ? { kind: 'redeploy_vercel', reason: 'إعادة نشر بعد عطل مؤقت' } : { kind: 'nudge_deploy', reason: 'إعادة نشر بعد عطل مؤقت' } };
      }
      return { ok: true, detail: 'البناء فشل عندي كمان — المشكلة في الكود', then: { kind: 'ai_fix', problem: `build:${x.main?.sha.slice(0, 12)}`, reason: 'بناء Vercel فشل', evidence: build.output.slice(-10_000) } };
    }
    case 'ai_fix':
      return aiFix(action, x);
    case 'revert':
      return revert(action, x);
  }
  return { ok: false, detail: 'إجراء غير معروف' };
}

async function redeployVercel(x: ExecContext) {
  const token = x.o.env.VERCEL_TOKEN!.trim();
  const scope = x.o.env.VERCEL_SCOPE || 'sham-de37';
  const api = async (path: string, init: RequestInit = {}) => {
    const response = await x.o.fetch(`https://api.vercel.com${path}${path.includes('?') ? '&' : '?'}slug=${encodeURIComponent(scope)}`, {
      ...init, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(30_000),
    });
    const data = await response.json().catch(() => ({})) as any;
    if (!response.ok) throw new Error(`Vercel ${response.status} ${data?.error?.code || ''} ${data?.error?.message || ''}`.trim());
    return data;
  };
  const repoId = await x.o.github!.repoId();
  const created = await api('/v13/deployments?forceNew=1', {
    method: 'POST',
    body: JSON.stringify({ name: x.vercelProject, project: x.vercelProject, target: 'production', gitSource: { type: 'github', repoId, ref: 'main', ...(x.main ? { sha: x.main.sha } : {}) } }),
  });
  return { ok: true, detail: `بدأت نشر جديد على Vercel لـ ${x.main?.sha.slice(0, 7) || 'main'} (${created.url ? `https://${created.url}` : created.id})` };
}

async function git(x: ExecContext, command: string) {
  const r = await x.o.sh(command, 5 * 60_000);
  if (!r.ok) throw new Error(`${command.split(' ').slice(0, 3).join(' ')}: ${r.output.slice(-400)}`);
  return r.output.trim();
}

async function prepareGit(x: ExecContext) {
  await git(x, 'git config user.name "Shaheen Doctor" && git config user.email "41898282+github-actions[bot]@users.noreply.github.com"');
  await git(x, 'git fetch --quiet --depth=50 origin main && git checkout --quiet -B main origin/main');
}

async function nudgeDeploy(x: ExecContext, reason: string) {
  await prepareGit(x);
  await git(x, `git commit --quiet --allow-empty -m ${q(`chore(doctor): redeploy — ${reason}`)} && git push --quiet origin HEAD:main`);
  return { ok: true, detail: 'عملت كومِت فاضي على main علشان Vercel ينشر آخر نسخة' };
}

/** Commit the working-tree change as a PR and merge it (falls back to a direct push), then rebuild Pages. */
async function ship(x: ExecContext, files: string[] | 'committed', title: string, body: string): Promise<{ sha: string; url?: string }> {
  const gh = x.o.github!;
  const branch = `doctor/${x.o.runId || Date.now()}`;
  await git(x, `git checkout --quiet -B ${branch}`);
  if (files !== 'committed') {
    await git(x, `git add -A -- ${files.map(q).join(' ')}`);
    await git(x, `git commit --quiet -m ${q(title)} -m ${q(body.slice(0, 3000))}`);
  }
  let sha: string; let url: string | undefined;
  try {
    await git(x, `git push --quiet origin HEAD:refs/heads/${branch}`);
    const pr = await gh.createPull(branch, title, body);
    url = pr.html_url;
    sha = (await gh.mergePull(pr.number, `${title} (#${pr.number})`)).sha;
    await gh.deleteBranch(branch);
  } catch (error) {
    x.log(`::warning title=Doctor::PR route failed (${(error as Error).message.slice(0, 200)}) — pushing to main directly`);
    await gh.deleteBranch(branch);
    await git(x, 'git push --quiet origin HEAD:main');
    sha = await git(x, 'git rev-parse HEAD');
    url = `https://github.com/${gh.repo}/commit/${sha}`;
  }
  await git(x, 'git checkout --quiet main');
  // Pushes made with the workflow token do not trigger other workflows: start the Pages build ourselves.
  await gh.dispatch('pages.yml').catch(() => undefined);
  return { sha, url };
}

async function evidenceFor(action: Action, x: ExecContext): Promise<string> {
  const gh = x.o.github!;
  const ci = x.findings.find((f) => f.id === 'ci');
  if (action.problem?.startsWith('ci:') && ci?.data?.runId) {
    const jobs = await gh.failedJobs(Number(ci.data.runId));
    const parts: string[] = [];
    for (const job of jobs.slice(0, 2)) {
      const notes = await gh.annotations(job.id);
      parts.push(`JOB ${job.name} · failed steps: ${job.steps.join(', ')}`);
      if (notes.length) parts.push(notes.map((n) => `${n.path}:${n.start_line} ${n.annotation_level} ${n.title || ''} ${n.message}`).join('\n'));
      parts.push(await gh.jobLog(job.id, 9000));
    }
    return parts.join('\n\n') || action.evidence || '';
  }
  return action.evidence || '';
}

async function aiFix(action: Action, x: ExecContext) {
  const { o, state } = x;
  await prepareGit(x);
  const evidence = await evidenceFor(action, x);
  const deps: FixDeps = {
    root: o.root, ask: o.ask!, log: (line) => x.log(`  fixer: ${line}`),
    sh: (command) => o.sh(command, 15 * 60_000),
    trackedFiles: async () => (await git(x, 'git ls-files')).split('\n').filter(Boolean),
  };
  // Known recipe, no AI needed: a lockfile that no longer matches package.json (e.g. a commit made from stale
  // files) breaks every install. Regenerate it from package.json, verify everything, ship only bun.lock.
  if (LOCKFILE_BROKEN.test(evidence)) return repairLockfile(action, x);
  const result = await attemptFix({ problem: action.problem || 'unknown', reason: action.reason, evidence }, deps);
  const record: FixRecord = { at: new Date().toISOString(), problem: action.problem || action.reason, result: 'failed', summary: result.summary };
  if (!result.ok) {
    state.fixes.push(record); state.fixes.splice(0, Math.max(0, state.fixes.length - 20));
    await o.sh('git checkout --quiet -- . && git checkout --quiet main');
    return { ok: false, detail: `${result.summary} (${result.attempts} محاولات)\n  ${result.log.join('\n  ')}` };
  }
  const baseline = x.findings.filter((f) => f.status === 'fail').map((f) => f.id);
  const body = [`🩺 إصلاح تلقائي من طبيب شاهين`, '', `**المشكلة:** ${action.reason}`, `**الإصلاح:** ${result.summary}`, '',
    `**الفحوص اللي عدّت قبل الدمج:** ${VERIFY_COMMANDS.map((c) => `\`${c}\``).join('، ')}`, '', '**السجل:**', ...result.log.map((l) => `- ${l}`), '',
    'الطبيب هيراقب الموقع بعد النشر، ولو ظهرت مشاكل جديدة هيرجّع التغيير ده تلقائيًا.'].join('\n');
  const shipped = await ship(x, result.changed, `fix(doctor): ${result.summary.slice(0, 90) || action.reason}`, body);
  Object.assign(record, { result: 'merged', sha: shipped.sha, url: shipped.url });
  state.fixes.push(record); state.fixes.splice(0, Math.max(0, state.fixes.length - 20));
  state.pending = { sha: shipped.sha, at: record.at, baseline, problem: record.problem };
  return { ok: true, detail: `${result.summary} — اتدمج ${shipped.sha.slice(0, 7)} بعد ما عدّى كل الفحوص${shipped.url ? ` (${shipped.url})` : ''}` };
}

const LOCKFILE_BROKEN = /lockfile had changes|lockfile is frozen|failed steps: [^\n]*Install locked dependencies/i;

async function repairLockfile(action: Action, x: ExecContext) {
  const { o, state } = x;
  const record: FixRecord = { at: new Date().toISOString(), problem: action.problem || 'lockfile', result: 'failed', summary: 'إعادة توليد bun.lock من package.json' };
  const keep = () => { state.fixes.push(record); state.fixes.splice(0, Math.max(0, state.fixes.length - 20)); };
  const install = await o.sh('bun install', 10 * 60_000);
  const changed = (await o.sh('git status --porcelain -- bun.lock')).output.trim();
  if (!install.ok || !changed) { keep(); return { ok: false, detail: `ما قدرتش أصلّح bun.lock (${install.ok ? 'مفيش تغيير' : install.output.slice(-200)})` }; }
  for (const command of ['bun install --frozen-lockfile', ...VERIFY_COMMANDS]) {
    const r = await o.sh(command);
    if (!r.ok) { await o.sh('git checkout --quiet -- bun.lock'); keep(); return { ok: false, detail: `bun.lock الجديد ما عدّاش \`${command}\`` }; }
  }
  const body = ['🩺 إصلاح تلقائي من طبيب شاهين', '', `**المشكلة:** ${action.reason} — ملف القفل bun.lock مش متطابق مع package.json، فالتثبيت بيفشل في GitHub وVercel.`,
    '**الإصلاح:** إعادة توليد bun.lock من package.json (من غير تغيير أي اعتمادية).', '', `**الفحوص:** ${VERIFY_COMMANDS.map((c) => `\`${c}\``).join('، ')}`].join('\n');
  const shipped = await ship(x, ['bun.lock'], 'fix(doctor): regenerate bun.lock from package.json', body);
  Object.assign(record, { result: 'merged', sha: shipped.sha, url: shipped.url });
  keep();
  state.pending = { sha: shipped.sha, at: record.at, baseline: x.findings.filter((f) => f.status === 'fail').map((f) => f.id), problem: record.problem };
  return { ok: true, detail: `ملف القفل اتصلّح واتدمج ${shipped.sha.slice(0, 7)} بعد ما عدّى كل الفحوص${shipped.url ? ` (${shipped.url})` : ''}` };
}

async function revert(action: Action, x: ExecContext) {
  const { o, state } = x;
  await prepareGit(x);
  const sha = action.sha!;
  const parents = (await git(x, `git rev-list --parents -n 1 ${sha}`)).split(' ').length - 1;
  await git(x, `git revert --no-edit ${parents > 1 ? '-m 1 ' : ''}${sha}`);
  for (const command of ['npm run lint', 'npm test']) {
    const r = await o.sh(command);
    if (!r.ok) { await o.sh('git reset --quiet --hard origin/main'); return { ok: false, detail: `الرجوع ما عدّاش \`${command}\` — هسيبه وأبلّغ` }; }
  }
  const shipped = await ship(x, 'committed', `revert(doctor): ${sha.slice(0, 7)}`, `↩️ رجوع تلقائي: ${action.reason}`);
  const record = state.fixes.find((f) => f.sha === sha);
  if (record) record.result = 'reverted';
  state.pending = undefined;
  return { ok: true, detail: `رجّعت ${sha.slice(0, 7)} (${shipped.url || shipped.sha.slice(0, 7)})` };
}

/**
 * The AI packages (free tiers, credit) as Shaheen's batch jobs see them: an engine whose quota ran out is
 * paused until the provider says it renews, the pause is saved (src/data/live/ai-quota.json) so the next run
 * does not waste requests, and the job continues where it stopped once the quota is back.
 */
export interface QuotaFile {
  updatedAt: string;
  engines: Record<string, { pausedUntil: string; reason: string; detail?: string; key?: string }>;
  /** Requests the bots made today on the engines with a free DAILY quota (the day starts at the 08:05 UTC renewal). */
  used?: { day: string; counts: Record<string, number> };
}

/**
 * «الشات أولاً»: the free daily quota (Gemini) is shared with the visitors' chat on the site. The bots take at
 * most this many requests a day, then leave the rest to the chat until the renewal (SHAHEEN_BOT_DAILY_GEMINI;
 * 0 = the bots never use it, -1 = no limit).
 */
export const BOT_DAILY_DEFAULT: Record<string, number> = { gemini: 10 };
export function botDailyCap(env: Env, id: string): number {
  const raw = env[`SHAHEEN_BOT_DAILY_${id.toUpperCase()}`]?.trim();
  const n = raw === undefined || raw === '' ? BOT_DAILY_DEFAULT[id] : Number(raw);
  if (n === undefined || !Number.isFinite(n) || n < 0) return Infinity;
  return Math.floor(n);
}
/** The quota day: from one 08:05 UTC renewal to the next. */
export const quotaDay = (now: number) => new Date(now - (8 * 60 + 5) * 60_000).toISOString().slice(0, 10);

/** The secrets each engine reads: a pause is tied to the key it happened with. */
const ENGINE_SECRETS: Record<string, string[]> = {
  gemini: ['GEMINI_API_KEY'], openai: ['OPENAI_API_KEY'], claude: ['ANTHROPIC_API_KEY'], deepseek: ['DEEPSEEK_API_KEY'],
  openrouter: ['OPENROUTER_API_KEY'], perplexity: ['PERPLEXITY_API_KEY'], self_hosted: ['SHAM_LLM_BASE_URL', 'SHAM_LLM_API_KEY', 'AI_GATEWAY_API_KEY'],
};
/**
 * A short one-way fingerprint of the engine's key (8 hex characters of a SHA-256 — the key itself can never be
 * recovered from it). When the owner puts a new key in GitHub, the fingerprint changes and the pause ends at once.
 */
export function keyFingerprint(env: Env, id: string): string {
  const parts = (ENGINE_SECRETS[id] || []).map((name) => (env[name] || '').trim());
  if (!parts.some(Boolean)) return '';
  return createHash('sha256').update(parts.join('\u0000')).digest('hex').slice(0, 8);
}
/** The engines that have a key here, in the order the bots use them. */
export async function configuredEngines(env: Env): Promise<string[]> {
  const { engineStatuses } = await import('../../server/core/engines');
  return ['gemini', 'perplexity', 'deepseek', 'openai', 'claude', 'openrouter', 'self_hosted'].filter((id) => engineStatuses(env).find((e) => e.id === id)?.configured);
}
export class QuotaExhaustedError extends Error {
  constructor(public resumeAt: number) { super(`AI quota exhausted until ${new Date(resumeAt).toISOString()}`); this.name = 'QuotaExhaustedError'; }
}

/** When a refused engine can be tried again: the provider's «retry in Ns», else the next daily/minute window. */
export function pauseUntil(status: number, failure: string, detail: string, now: number): number | undefined {
  // A rejected key is set aside for an hour (a new key ends the pause at once — see keyFingerprint).
  if (failure === 'invalid_key') return now + 60 * 60_000;
  if (status !== 429 && status !== 402 && failure !== 'no_credit' && failure !== 'rate_limited') return undefined;
  const retry = detail.match(/retry in (\d+(?:\.\d+)?)s/i);
  if (retry) return now + Math.max(30, Math.ceil(Number(retry[1]))) * 1000 + 30_000;
  if (/PerDay|per day|daily/i.test(detail) || status === 402 || failure === 'no_credit') {
    // Daily free-tier quotas renew at midnight Pacific time (07:00–08:00 UTC): wait for 08:05 UTC.
    const next = new Date(now); next.setUTCHours(8, 5, 0, 0);
    if (next.getTime() <= now) next.setUTCDate(next.getUTCDate() + 1);
    return next.getTime();
  }
  return now + 65_000; // per-minute limits
}

export function quotaBook(path?: URL, now: () => number = Date.now) {
  let file: QuotaFile = { updatedAt: new Date(now()).toISOString(), engines: {} };
  if (path) {
    try { file = JSON.parse(readFileSync(path, 'utf8')) as QuotaFile; file.engines ||= {}; } catch { /* first run */ }
  }
  return {
    file: () => file,
    /** `key`: the engine's current key fingerprint — a pause made with another key no longer applies. */
    pausedUntil: (id: string, key?: string) => {
      const entry = file.engines[id];
      if (key && entry?.key && entry.key !== key) return 0;
      const t = Date.parse(entry?.pausedUntil || ''); return Number.isFinite(t) && t > now() ? t : 0;
    },
    pause(id: string, until: number, reason: string, detail?: string, key?: string) {
      file.engines[id] = { pausedUntil: new Date(until).toISOString(), reason, ...(detail ? { detail: detail.slice(0, 200) } : {}), ...(key ? { key } : {}) };
      file.updatedAt = new Date(now()).toISOString();
    },
    clear(id: string) { if (file.engines[id]) { delete file.engines[id]; file.updatedAt = new Date(now()).toISOString(); } },
    /** Counts one bot request on a daily-quota engine; returns today's total. */
    use(id: string): number {
      const day = quotaDay(now());
      if (file.used?.day !== day) file.used = { day, counts: {} };
      file.used.counts[id] = (file.used.counts[id] || 0) + 1;
      file.updatedAt = new Date(now()).toISOString();
      return file.used.counts[id];
    },
    usedToday: (id: string) => (file.used?.day === quotaDay(now()) ? file.used.counts[id] || 0 : 0),
    save() { if (path) writeFileSync(path, `${JSON.stringify(file, null, 1)}\n`); },
  };
}
export type QuotaBook = ReturnType<typeof quotaBook>;

/** The doctor thinks with the same AI engines (and keys) as Shaheen, in the admin's failover order. */
/**
 * `prefer`: this engine is asked first (the daily council gives each seat its own engine when several are set).
 * `onEngine`: told which engine answered (the admin panel shows it; visitors never see engine names).
 */
export async function makeAsk(env: Env, options: { quota?: QuotaBook; memory?: AnswerBook; maxWaitMs?: number; sleep?: (ms: number) => Promise<void>; request?: typeof fetch; prefer?: string; onEngine?: (id: string) => void } = {}): Promise<DoctorOptions['ask']> {
  const { callEngine, engineStatuses } = await import('../../server/core/engines');
  const order = ['gemini', 'perplexity', 'deepseek', 'openai', 'claude', 'openrouter', 'self_hosted'] as const;
  const configured = order.filter((id) => engineStatuses(env).find((e) => e.id === id)?.configured);
  const ready = options.prefer && configured.includes(options.prefer as typeof configured[number]) ? [options.prefer as typeof configured[number], ...configured.filter((id) => id !== options.prefer)] : configured;
  const memory = options.memory;
  // With memory, a question the bots already asked is answered even with no engine configured.
  if (!ready.length && !memory) return undefined;
  const quota = options.quota;
  const sleep = options.sleep || ((ms: number) => new Promise((r) => setTimeout(r, ms)));
  let waited = 0;
  const ask = async (system: string, prompt: string): Promise<string> => {
    const known = memory?.get(system, prompt);
    if (known) return known;
    for (const id of ready) {
      if (quota?.pausedUntil(id, keyFingerprint(env, id))) continue;
      // «الشات أولاً»: past the bots' daily share, the free quota stays for the visitors until the renewal.
      const cap = botDailyCap(env, id);
      if (quota && cap !== Infinity && quota.usedToday(id) >= cap) {
        quota.pause(id, pauseUntil(429, 'no_credit', 'daily', Date.now())!, 'chat_reserve', `bots used ${quota.usedToday(id)}/${cap} today`, keyFingerprint(env, id));
        continue;
      }
      if (quota && cap !== Infinity) quota.use(id);
      let refused: { until: number; reason: string; detail: string } | undefined;
      const reply = await callEngine(id, system, [{ role: 'user', text: prompt }], {
        // The local teacher (an open model on the runner's CPU) writes slowly and has a small context window.
        env, fetch: options.request, signal: AbortSignal.timeout(id === 'self_hosted' ? Number(env.SHAM_LLM_TIMEOUT_MS) || 600_000 : 180_000),
        temperature: 0.2, maxTokens: id === 'self_hosted' ? Number(env.SHAM_LLM_MAX_TOKENS) || 2000 : 16_000, maxChars: 200_000,
        onFailure: (failure, status, detail) => {
          const until = quota ? pauseUntil(status, failure, detail, Date.now()) : undefined;
          if (until) refused = { until, reason: failure, detail };
        },
      }).catch(() => undefined);
      if (reply?.trim()) { quota?.clear(id); memory?.put(system, prompt, reply); options.onEngine?.(id); return reply; }
      if (refused && quota) quota.pause(id, refused.until, refused.reason, refused.detail, keyFingerprint(env, id));
    }
    if (quota && ready.length) {
      const paused = ready.map((id) => quota.pausedUntil(id, keyFingerprint(env, id))).filter(Boolean);
      if (paused.length === ready.length) {
        const resumeAt = Math.min(...paused);
        // A per-minute limit is waited out inside the run; a daily one ends the run (the next run continues).
        const wait = resumeAt - Date.now();
        if (wait <= 90_000 && waited + wait <= (options.maxWaitMs ?? 5 * 60_000)) {
          waited += Math.max(0, wait);
          await sleep(Math.max(0, wait));
          return ask(system, prompt);
        }
        throw new QuotaExhaustedError(resumeAt);
      }
    }
    throw new Error('no AI engine answered');
  };
  return ask;
}
