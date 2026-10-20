/**
 * «بوابة جوجل استوديو» runner (.github/workflows/aistudio-bridge.yml). Logic and rules: bridge.ts.
 *   node --import tsx scripts/aistudio/bridge.mts plan    → applies the filtered studio changes to the working tree,
 *                                                         writes $BRIDGE_PLAN and accepted=<n> / verdict=<v> to $GITHUB_OUTPUT
 *   node --import tsx scripts/aistudio/bridge.mts finish  → after the checks: publish on main (+ GitHub Pages), or park the
 *                                                         import on a branch with an issue; writes the report
 * Env: STUDIO_REPO, STUDIO_REF (fetched studio commit, default refs/remotes/studio/head), STUDIO_FOUND (true|false),
 * STUDIO_NOTE (why it was not found), BRIDGE_PUBLISH (true on main), CHECK_LINT / CHECK_TEST / CHECK_BUILD / CHECK_PAGES,
 * GH_TOKEN + GITHUB_REPOSITORY (issues, Pages dispatch), BRIDGE_AUTHOR ("Name <email>": the merchant), BRIDGE_FILE, BRIDGE_PLAN.
 */
import { execFileSync } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import {
  DEFAULT_STUDIO_REPO, emptyBridge, gitBytes, issueFor, planImport, recordRun, runOf,
  type BridgeFile, type BridgeRun, type BridgeStatus, type Plan,
} from './bridge';

const env = process.env;
const FILE = env.BRIDGE_FILE || 'src/data/live/aistudio-bridge.json';
const PLAN = env.BRIDGE_PLAN || `${env.RUNNER_TEMP || '/tmp'}/aistudio-bridge-plan.json`;
const repo = env.STUDIO_REPO?.trim() || DEFAULT_STUDIO_REPO;
const publish = env.BRIDGE_PUBLISH === 'true';
const mode = process.argv[2] || 'plan';
const run = gitBytes(process.cwd());
/** The merchant as author and committer: the intake review («استقبال تحديثات AI Studio») checks the import again. */
const owner = /^(.+?)\s*<([^>]+)>$/.exec(env.BRIDGE_AUTHOR?.trim() || '');
const asOwner = owner ? { ...env, GIT_AUTHOR_NAME: owner[1], GIT_AUTHOR_EMAIL: owner[2], GIT_COMMITTER_NAME: owner[1], GIT_COMMITTER_EMAIL: owner[2] } : env;
const git = (...args: string[]) => execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env: asOwner }).trim();
const tryGit = (...args: string[]) => { try { git(...args); return true; } catch (e) { console.log(String((e as { stderr?: string }).stderr || e).trim().split('\n').slice(-2).join(' / ')); return false; } };
const out = (line: string) => { if (env.GITHUB_OUTPUT) appendFileSync(env.GITHUB_OUTPUT, `${line}\n`); };
const summary = (lines: string[]) => { console.log(lines.join('\n')); if (env.GITHUB_STEP_SUMMARY) appendFileSync(env.GITHUB_STEP_SUMMARY, `${lines.join('\n')}\n`); };
const load = (): BridgeFile => { try { return { ...emptyBridge(repo), ...JSON.parse(readFileSync(FILE, 'utf8')) }; } catch { return emptyBridge(repo); } };
const save = (f: BridgeFile) => { mkdirSync(dirname(FILE), { recursive: true }); writeFileSync(FILE, `${JSON.stringify(f, null, 1)}\n`); };

type Saved = { kind: 'waiting'; note: string } | { kind: 'same'; head: string } | { kind: 'plan'; plan: Omit<Plan, 'files'> & { files: Omit<Plan['files'][number], 'content'>[] } };

if (mode === 'plan') {
  const state = load();
  let saved: Saved;
  if (env.STUDIO_FOUND !== 'true') {
    saved = { kind: 'waiting', note: env.STUDIO_NOTE?.trim() || `مستودع جوجل استوديو (${repo}) لسه مش موجود أو مش متاح` };
  } else {
    const head = git('rev-parse', env.STUDIO_REF || 'refs/remotes/studio/head');
    if (state.lastStudioSha === head) saved = { kind: 'same', head };
    else {
      const plan = planImport(run, { head, base: state.lastStudioSha });
      // Apply to the working tree: the checks run on exactly what would be published.
      for (const f of plan.files) {
        if (f.action === 'delete') rmSync(f.path, { force: true });
        else { mkdirSync(dirname(f.path), { recursive: true }); writeFileSync(f.path, f.content!); }
      }
      saved = { kind: 'plan', plan: { ...plan, files: plan.files.map(({ content: _c, ...rest }) => rest) } };
    }
  }
  writeFileSync(PLAN, JSON.stringify(saved));
  const accepted = saved.kind === 'plan' ? saved.plan.files.length : 0;
  out(`accepted=${accepted}`);
  out(`verdict=${saved.kind === 'plan' ? saved.plan.verdict : 'none'}`);
  if (saved.kind === 'waiting') console.log(`Studio not available: ${saved.note}`);
  else if (saved.kind === 'same') console.log(`Nothing new in the studio (${saved.head.slice(0, 7)} already imported)`);
  else {
    const p = saved.plan;
    console.log(`Studio ${p.head.slice(0, 7)} (${p.mode}): ${p.files.length} file(s) to bring (${p.verdict}), ${p.skipped.length} set aside`);
    for (const f of p.files) console.log(`  + ${f.path} [${f.cls}, ${f.how}]${f.reason ? ` — ${f.reason}` : ''}`);
    for (const s of p.skipped) console.log(`  − ${s.path} — ${s.reason}`);
  }
  process.exit(0);
}

// ── finish ────────────────────────────────────────────────────────────────────────────────────────────────
const saved: Saved = JSON.parse(readFileSync(PLAN, 'utf8'));
const state = load();
const siteRepo = env.GITHUB_REPOSITORY || 'spculculat-oss/Sham-Perfume';
const api = async (path: string, init: RequestInit = {}) => {
  if (!env.GH_TOKEN) return undefined;
  const res = await fetch(`https://api.github.com/repos/${siteRepo}${path}`, { ...init, headers: { Authorization: `Bearer ${env.GH_TOKEN}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' } }).catch(() => undefined);
  return res ? { ok: res.ok, status: res.status, data: await res.json().catch(() => ({})) as Record<string, unknown> } : undefined;
};
const configureGit = () => {
  git('config', 'user.name', 'Shaheen AI Studio bridge');
  git('config', 'user.email', '41898282+github-actions[bot]@users.noreply.github.com');
};
/** The report on main (robots' publish helper: survives other bots pushing at the same time). */
const publishReport = (next: BridgeFile, message: string) => {
  save(next);
  if (!publish) { console.log('Rehearsal: report not published'); return; }
  configureGit();
  execFileSync('node', ['scripts/ci/publish.mjs', message, FILE], { stdio: 'inherit' });
};
const stamp = new Date().toISOString().slice(0, 16) + 'Z';

if (saved.kind === 'waiting') {
  // Only a change of situation is written (no commit every half hour).
  if (state.status !== 'waiting_repo' || state.note !== saved.note || state.repo !== repo) {
    publishReport(recordRun(state, undefined, 'waiting_repo', { repo, note: saved.note }), `بوابة جوجل استوديو: في انتظار المستودع ${stamp}`);
  }
  summary(['## بوابة جوجل استوديو', '', `⏳ ${saved.note}`, '', `أول ما جوجل استوديو يرفع على \`${repo}\` التعديلات هتتفلتر وتتنشر لوحدها.`]);
  process.exit(0);
}
if (saved.kind === 'same') { summary(['## بوابة جوجل استوديو', '', 'مفيش تعديلات جديدة من جوجل استوديو.']); process.exit(0); }

const plan = saved.plan as Plan;
const checks = { lint: env.CHECK_LINT || 'skipped', test: env.CHECK_TEST || 'skipped', build: env.CHECK_BUILD || 'skipped', pages: env.CHECK_PAGES || 'skipped' };
const NAMES: Record<string, string> = { lint: 'فحص الأنواع', test: 'الاختبارات', build: 'بناء الموقع', pages: 'فحص صفحات الموقع' };
const failed = Object.entries(checks).filter(([, v]) => v === 'failure').map(([k]) => NAMES[k]);
const short = plan.head.slice(0, 7);
const paths = plan.files.map((f) => f.path);
const commitMessage = () => {
  const lines = [`جوجل استوديو: ${(plan.commits[0]?.subject || short).slice(0, 90)}`, '', `من ${repo}@${short} عبر «بوابة جوجل استوديو» (اتفلتر واتفحص).`,
    ...plan.commits.slice(0, 10).map((c) => `- ${c.sha.slice(0, 7)} ${c.subject}`)];
  return lines.join('\n');
};
let committed = false;
const commitFiles = () => {
  if (committed) return;
  configureGit();
  git('add', '-A', '--', ...paths);
  git('commit', '-q', '-m', commitMessage());
  git('reset', '-q', '--hard', 'HEAD'); // whatever the checks touched is dropped (a rebase needs a clean tree)
  committed = true;
};

let status: BridgeStatus = state.status;
let result: BridgeRun['result'] = 'nothing';
const extra: Record<string, unknown> = { checks };
const lines = ['## بوابة جوجل استوديو', '', `تعديلات الاستوديو: \`${short}\` (${plan.mode === 'first' ? 'أول استيراد' : 'تحديث'})`, ''];

if (plan.verdict === 'none') {
  status = 'idle'; result = 'nothing';
  lines.push('مفيش ملفات تدخل الموقع من التعديلات دي.');
} else if (!publish) {
  status = state.status; result = 'rehearsal';
  lines.push(`تجربة على فرع: ${plan.files.length} ملف كانوا هيدخلوا (${plan.verdict === 'auto' ? 'نشر تلقائي' : 'بعد الموافقة'})، والفحوص: ${failed.length ? `فشل ${failed.join('، ')}` : 'سليمة'}. مفيش حاجة اتنشرت.`);
} else if (plan.verdict === 'auto' && !failed.length) {
  commitFiles();
  let pushed = false;
  for (let attempt = 1; attempt <= 5 && !pushed; attempt++) {
    if (!tryGit('fetch', '-q', 'origin', 'main')) continue;
    if (!tryGit('rebase', '-q', 'origin/main')) { tryGit('rebase', '--abort'); break; }
    pushed = tryGit('push', '-q', 'origin', 'HEAD:main');
    if (!pushed) await new Promise((r) => setTimeout(r, attempt * 4000));
  }
  if (pushed) {
    status = 'published'; result = 'published'; extra.mainSha = git('rev-parse', 'HEAD');
    // GITHUB_TOKEN pushes start no workflow: the site's own pipeline is started here (checks + GitHub Pages).
    const d = await api('/actions/workflows/pages.yml/dispatches', { method: 'POST', body: JSON.stringify({ ref: 'main' }) });
    lines.push(`✅ اتنشر على الموقع: ${plan.files.length} ملف · ${d?.ok ? 'النشر على GitHub Pages اشتغل' : `⚠️ النشر ما اشتغلش لوحده (HTTP ${d?.status ?? '—'}) — هيتنشر مع أول تحديث جاي`}`);
  } else {
    // Could not land on main (a conflicting change arrived meanwhile): parked like a review.
    failed.push('الدمج مع آخر نسخة');
  }
}
if ((plan.verdict === 'review' || failed.length) && publish && plan.verdict !== 'none' && !extra.mainSha) {
  const branch = `aistudio/${short}`;
  commitFiles();
  const pushedBranch = tryGit('push', '-q', '-f', 'origin', `HEAD:refs/heads/${branch}`);
  git('reset', '-q', '--hard', 'HEAD~1');
  status = failed.length ? 'failed' : 'review'; result = failed.length ? 'failed' : 'review';
  extra.branch = pushedBranch ? branch : undefined;
  for (const [name, color, description] of [['shaheen-task', 'b8860b', 'مهمة تطوير من اجتماع شاهين اليومي'], ['needs-approval', 'd73a4a', 'تحتاج موافقة التاجر قبل التنفيذ'], ['aistudio', '4285f4', 'تحديث جاي من جوجل استوديو']] as const) {
    await api('/labels', { method: 'POST', body: JSON.stringify({ name, color, description }) });
  }
  const issue = issueFor(plan, { repo, branch, checksFailed: failed, siteRepo });
  const res = pushedBranch ? await api('/issues', { method: 'POST', body: JSON.stringify(issue) }) : undefined;
  const number = res?.ok ? Number(res.data.number) : undefined;
  if (number) extra.issue = number;
  lines.push(`${failed.length ? '❌ ما اتنشرش — فشل: ' + failed.join('، ') : '⏸️ محتاج موافقة قبل النشر'} · الفرع \`${branch}\`${number ? ` · المهمة #${number}` : ''}`,
    '', 'افتح شات وكيل البرمجة واكتب «نفذ مهام شاهين» علشان يراجعه وينشره.');
}

// The plan is recorded either way: the next run starts from this studio commit (a parked import keeps its branch).
const next = recordRun(state, runOf(plan, result, extra as Partial<BridgeRun>), status, { repo, lastStudioSha: publish ? plan.head : state.lastStudioSha });
if (plan.files.length) lines.push('', '| الملف | إزاي |', '|---|---|', ...plan.files.map((f) => `| \`${f.path}\` | ${f.action === 'delete' ? 'مسح' : f.how === 'merged' ? 'اتدمج مع شغل أحدث' : f.how === 'new' ? 'جديد' : 'نسخة الاستوديو'}${f.cls === 'review' ? ' · بعد الموافقة' : ''} |`));
if (plan.skipped.length) lines.push('', '**اتساب:**', ...plan.skipped.slice(0, 40).map((s) => `- \`${s.path}\` — ${s.reason}`));
summary(lines);
if (publish) publishReport(next, `بوابة جوجل استوديو: ${result === 'published' ? 'نشر' : result === 'nothing' ? 'مراجعة' : 'تحديث محتاج موافقة'} ${short} ${stamp}`);
else save(next);
if (result === 'failed') console.log(`::warning title=AI Studio bridge::التحديث ${short} ما اتنشرش (${failed.join('، ')}) — اتحفظ في فرع ومهمة`);
if (existsSync(PLAN)) rmSync(PLAN, { force: true });
