/**
 * «مكتب صاحب الموقع» — carrying out what the owner approved («شاهين الوكيل المسؤول تحت إشرافه», src/utils/ownerDesk.ts).
 *
 * The owner pressed «وافق» (or «ارفض» / «رجّعه بملاحظة» / «رجّع») in his suite, which opened a GitHub request (issue)
 * from his own account. This runs only for a request opened by the repository owner himself (GitHub proves who
 * opened it) and does exactly what it says:
 *   change — applies Shaheen's change to the newest main, runs every check, merges, rebuilds the site;
 *   order  — pauses / resumes a robot, stops / restarts all of them, or runs one now;
 *   decide — merges (after every check) or closes a robot's pull request; approves, refuses or annotates a council task;
 *   revert — undoes what an earlier request changed (found by its «Owner-Request: #n» trailer), after every check —
 *            or what «دولة المنصة» put live for robot change #n («State-Decision: #n»): the owner is above it.
 * If anything fails nothing changes, and the request says why. The request never carries the room's conversation.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { GitHub, GitHubError } from '../doctor/github';
import { OWNER, OWNER_APPROVAL_LABEL, applyOwnerCommand, maskSensitive, readControls } from '../../src/utils/ownerAuthority';
import { CHANGE_TITLE_PREFIX, changeFromIssue, changeVerdict, planChange } from '../../src/utils/ownerFiles';
import { stateTrailer } from '../../src/utils/platformState';
import {
  DECISIONS, TASK_APPROVAL_LABEL, TASK_APPROVED_LABEL, botName, decodeDesk, orderText, requestTrailer, workflowOf, type DeskRequest,
} from '../../src/utils/ownerDesk';

interface IssueEvent { issue?: { number: number; title: string; body: string | null; author_association?: string; user?: { login?: string } } }
type Issue = NonNullable<IssueEvent['issue']>;

/** What must pass before anything goes live (the same checks as every pull request, plus the Pages build). */
export const DESK_CHECKS = ['npm run lint', 'npm test', 'npm run build:pages', 'npm run build:vercel', 'npm run test:vercel'];
const CONTROLS = 'src/data/owner/controls.json';

/** Only the owner's own request, with the room's title. Anyone else's issue is ignored silently. */
export function isOwnersRequest(e: IssueEvent, owner = OWNER.github): boolean {
  const i = e.issue;
  return Boolean(i && i.user?.login?.toLowerCase() === owner.toLowerCase() && i.author_association === 'OWNER' && i.title.startsWith(CHANGE_TITLE_PREFIX));
}

const sh = (command: string) => execFileSync('bash', ['-lc', command], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024, timeout: 20 * 60_000 });
const git = (...args: string[]) => execFileSync('git', ['-c', 'core.quotePath=false', ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const tryGit = (...args: string[]) => { try { git(...args); return true; } catch { return false; } };
const tail = (text: string, n = 25) => maskSensitive(text.split('\n').filter((l) => l.trim()).slice(-n).join('\n')).slice(-3000);

class Refused extends Error {}

interface Desk {
  issue: Issue; repo: string; gh: GitHub;
  reply(body: string): Promise<unknown>;
  close(reason: 'completed' | 'not_planned'): Promise<unknown>;
}

/** Every check in turn; the first failure stops (and says which one, with its last lines). */
export function runChecks(): { ok: true } | { ok: false; check: string; output: string } {
  for (const check of DESK_CHECKS) {
    console.log(`::group::${check}`);
    let output = ''; let ok = true;
    try { output = sh(`${check} 2>&1`); } catch (e) { ok = false; output = String((e as { stdout?: string }).stdout || (e as Error).message); }
    // The test runner's own count is the judge (a failing test must never slip through).
    if (check === 'npm test' && !/^# fail 0$/m.test(output)) ok = false;
    console.log(output.slice(-20_000));
    console.log('::endgroup::');
    if (!ok) return { ok: false, check, output };
  }
  return { ok: true };
}

function configureGit() {
  git('config', 'user.name', 'Owner desk');
  git('config', 'user.email', '41898282+github-actions[bot]@users.noreply.github.com');
}

/** Saves the current commit on main through a pull request (a direct push if that route is closed), then rebuilds. */
async function land(d: Desk, branch: string, title: string, message: string): Promise<string> {
  let where = '';
  try {
    git('push', '-q', '-f', 'origin', `HEAD:refs/heads/${branch}`);
    const pr = await d.gh.createPull(branch, title, message);
    const merged = await d.gh.mergePull(pr.number, `${title} (#${pr.number})`, message);
    await d.gh.deleteBranch(branch);
    where = `${pr.html_url} (${merged.sha.slice(0, 7)})`;
  } catch (error) {
    console.log(`::warning::PR route failed (${(error as Error).message.slice(0, 200)}) — pushing to main`);
    await d.gh.deleteBranch(branch);
    let pushed = false;
    for (let attempt = 1; attempt <= 4 && !pushed; attempt++) {
      if (tryGit('fetch', '-q', 'origin', 'main') && tryGit('rebase', '-q', 'origin/main')) pushed = tryGit('push', '-q', 'origin', 'HEAD:main');
      else tryGit('rebase', '--abort');
      if (!pushed) await new Promise((r) => setTimeout(r, attempt * 4000));
    }
    if (!pushed) throw new Refused('مقدرتش أحفظ التغيير على آخر نسخة (حاجة تانية اتغيرت في نفس الوقت). ابعت الطلب تاني.');
    where = git('rev-parse', '--short', 'HEAD');
  }
  // Pushes made with the workflow token start no other workflow: rebuild the site ourselves.
  await d.gh.dispatch('pages.yml').catch(() => undefined);
  return where;
}

const done = async (d: Desk, lines: string[]) => { await d.reply(lines.join('\n')); await d.close('completed'); };

// ── change ─────────────────────────────────────────────────────────────────────────────────────────────────
async function doChange(d: Desk, req: Extract<DeskRequest, { kind: 'change' }>) {
  const plan = planChange(req.edits, (p) => (existsSync(p) ? readFileSync(p, 'utf8') : undefined));
  if (plan.problems.length) throw new Refused(plan.problems.map((p) => `- ${p}`).join('\n'));
  const verdict = changeVerdict(readControls(JSON.parse(readFileSync(CONTROLS, 'utf8'))), plan);
  for (const f of plan.files) { mkdirSync(dirname(f.path), { recursive: true }); writeFileSync(f.path, f.after); }
  console.log(`Applied ${plan.files.length} file(s), ${plan.lines} line(s): ${plan.files.map((f) => f.path).join(', ')}`);
  const checks = runChecks();
  if (!checks.ok) {
    git('checkout', '--', '.');
    const created = plan.files.filter((f) => f.before === undefined).map((f) => f.path);
    if (created.length) git('clean', '-fdq', '--', ...created);
    throw new Refused(`الفحص \`${checks.check}\` وقع بعد التعديل، فرجّعت كل حاجة زي ما كانت. آخر سطور الفحص:\n\n\`\`\`\n${tail(checks.output)}\n\`\`\``);
  }
  const title = `owner-room: ${d.issue.title.slice(CHANGE_TITLE_PREFIX.length).trim() || 'تعديل من غرفة شاهين'}`;
  const message = `Proposed by Shaheen in the owner's private room, approved by ${OWNER.github} in #${d.issue.number}.\n\n${requestTrailer(d.issue.number)}`;
  configureGit();
  git('checkout', '-q', '-B', `owner-change/${d.issue.number}`);
  git('add', '-A', '--', ...plan.files.map((f) => f.path));
  git('commit', '-q', '-m', title, '-m', message);
  const where = await land(d, `owner-change/${d.issue.number}`, title, message);
  await done(d, ['✅ **التعديل اتنفذ وعدّى كل الفحوص.**', '',
    `**الملفات:** ${plan.files.map((f) => `\`${f.path}\``).join('، ')} (${plan.lines} سطر)`, `**الحكم:** ${verdict.reasonAr}`, `**اتحفظ في:** ${where}`, '',
    'الموقع الأساسي بيتحدث خلال حوالي 5 دقايق. لو حاجة مش عاجباك اضغط «رجّع» قدام الطلب ده في سجل الجناح.']);
}

// ── order ──────────────────────────────────────────────────────────────────────────────────────────────────
async function doOrder(d: Desk, req: Extract<DeskRequest, { kind: 'order' }>) {
  const { order } = req;
  if (order.action === 'run') {
    const workflow = workflowOf(order.bot!);
    if (!workflow) throw new Refused('الروبوت ده مالوش تشغيل.');
    try { await d.gh.dispatch(workflow); }
    catch (e) { throw new Refused(`الروبوت ماقبلش يشتغل دلوقتي (${e instanceof GitHubError ? e.status : 'خطأ'}). يمكن مالوش زرار تشغيل يدوي.`); }
    await done(d, [`✅ **${orderText(order)}** — اشتغل دلوقتي.`, '', 'هيخلص في خلال دقايق، وتقدر تتابعه من «خريطة التشغيل» في الجناح.']);
    return;
  }
  const before = readControls(JSON.parse(readFileSync(CONTROLS, 'utf8')));
  const { controls, changed, noteAr } = applyOwnerCommand(before, order.action, order.bot, `${OWNER.github} (#${d.issue.number})`);
  if (!changed) { await done(d, [`ℹ️ **${orderText(order)}:** ${noteAr}.`]); return; }
  writeFileSync(CONTROLS, `${JSON.stringify(controls, null, 1)}\n`);
  configureGit();
  try {
    execFileSync('node', ['scripts/ci/publish.mjs', `أمر صاحب الموقع (جهّزه شاهين): ${orderText(order)}\n\n${requestTrailer(d.issue.number)}`, CONTROLS], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e) { throw new Refused(`مقدرتش أحفظ الأمر (${tail(String((e as { stdout?: string }).stdout || ''), 3)}).`); }
  await done(d, [`✅ **${orderText(order)}:** ${noteAr}.`, '', 'كل روبوت بيسأل المكتب قبل ما يشتغل، فالأمر ساري من أول دورة جاية.']);
}

// ── decide ─────────────────────────────────────────────────────────────────────────────────────────────────
interface Target { number: number; title: string; html_url: string; state: string; labels: { name: string }[]; pull_request?: unknown; body?: string | null }

async function doDecide(d: Desk, req: Extract<DeskRequest, { kind: 'decide' }>) {
  const repoPath = `/repos/${d.repo}`;
  let t: Target;
  try { t = await d.gh.api<Target>(`${repoPath}/issues/${req.target}`); } catch { throw new Refused(`مش لاقي #${req.target}.`); }
  if (t.state !== 'open') throw new Refused(`#${req.target} اتقفل قبل كده — مفيش حاجة تتعمل.`);
  const labels = t.labels.map((l) => l.name);
  const note = req.note ? `\n\n**ملاحظة صاحب الموقع:** ${req.note}` : '';
  const comment = (n: number, body: string) => d.gh.comment(n, body).catch(() => undefined);
  await d.gh.ensureLabel(TASK_APPROVED_LABEL, '0e8a16', 'صاحب الموقع وافق — وكيل البرمجة ينفذها').catch(() => undefined);

  if (t.pull_request && labels.includes(OWNER_APPROVAL_LABEL)) {
    if (req.decision === 'reject') {
      await comment(t.number, `❌ صاحب الموقع رفض التعديل ده (#${d.issue.number}).${note}`);
      await d.gh.api(`${repoPath}/pulls/${t.number}`, { method: 'PATCH', body: JSON.stringify({ state: 'closed' }) });
      await done(d, [`✅ اتقفل التعديل #${t.number} من غير ما يتنفذ.`]);
      return;
    }
    if (req.decision === 'return') {
      // Back to Shaheen with the owner's note: a task for the coding agent, and this version is closed.
      const task = await d.gh.createIssue(`مهمة شاهين: راجع «${t.title.slice(0, 70)}» حسب ملاحظة صاحب الموقع`,
        `صاحب الموقع رجّع التعديل #${t.number} بملاحظة. اعمل نسخة جديدة منه تراعي الملاحظة، وهتستنى موافقته تاني.\n\n**ملاحظة صاحب الموقع:** ${req.note}\n\n---\n- للتنفيذ: افتح شات وكيل البرمجة واكتب «نفذ مهام شاهين». التعليمات في AGENTS.md.`,
        ['shaheen-task', TASK_APPROVED_LABEL]).catch(() => undefined);
      await comment(t.number, `↩️ صاحب الموقع رجّع التعديل ده لشاهين بملاحظة (#${d.issue.number})${task ? ` — المهمة #${task.number}` : ''}.${note}`);
      await d.gh.api(`${repoPath}/pulls/${t.number}`, { method: 'PATCH', body: JSON.stringify({ state: 'closed' }) });
      await done(d, [`✅ التعديل #${t.number} رجع لشاهين بملاحظتك${task ? ` (المهمة #${task.number})` : ''}.`]);
      return;
    }
    // Approve: every check on the robot's version brought up to the newest main, then the merge itself on GitHub.
    const pr = await d.gh.api<{ head: { ref: string; sha: string }; title: string; mergeable?: boolean | null }>(`${repoPath}/pulls/${t.number}`);
    git('fetch', '-q', '--depth=300', 'origin', `+refs/heads/${pr.head.ref}:refs/remotes/origin/pr-head`);
    git('checkout', '-q', '-B', 'owner-review', 'origin/pr-head');
    configureGit();
    if (!tryGit('merge', '-q', '--no-edit', 'origin/main')) { tryGit('merge', '--abort'); console.log('::notice::Checking the robot\'s version as it is (no local merge)'); }
    const checks = runChecks();
    if (!checks.ok) throw new Refused(`التعديل #${t.number} ماعدّاش الفحص \`${checks.check}\`، فمادمجتوش. آخر سطور الفحص:\n\n\`\`\`\n${tail(checks.output)}\n\`\`\``);
    const message = `Approved by ${OWNER.github} in #${d.issue.number} after every check.\n\n${requestTrailer(d.issue.number)}`;
    let sha = '';
    try { sha = (await d.gh.mergePull(t.number, `${pr.title} (#${t.number})`, message)).sha; }
    catch (e) { throw new Refused(`GitHub مارضيش يدمج #${t.number} (${e instanceof GitHubError ? e.status : 'خطأ'}) — يمكن بقى متعارض مع تعديل أحدث. قول لشاهين يعمل نسخة جديدة.`); }
    await d.gh.dispatch('pages.yml').catch(() => undefined);
    await comment(t.number, `✅ صاحب الموقع وافق (#${d.issue.number}) واتدمج بعد كل الفحوص.`);
    await done(d, [`✅ **التعديل #${t.number} اتنفذ وعدّى كل الفحوص** (${sha.slice(0, 7)}).`, '', 'الموقع بيتحدث خلال حوالي 5 دقايق. لو مش عاجبك اضغط «رجّع» قدام الطلب ده في سجل الجناح.']);
    return;
  }

  if (!t.pull_request && labels.includes('shaheen-task')) {
    if (req.decision === 'reject') {
      await comment(t.number, `❌ صاحب الموقع رفض المهمة دي (#${d.issue.number}).${note}`);
      await d.gh.api(`${repoPath}/issues/${t.number}`, { method: 'PATCH', body: JSON.stringify({ state: 'closed', state_reason: 'not_planned' }) });
      await done(d, [`✅ المهمة #${t.number} اتلغت.`]);
      return;
    }
    await d.gh.api(`${repoPath}/issues/${t.number}/labels/${encodeURIComponent(TASK_APPROVAL_LABEL)}`, { method: 'DELETE' }).catch(() => undefined);
    await d.gh.addLabels(t.number, [TASK_APPROVED_LABEL]).catch(() => undefined);
    await comment(t.number, req.decision === 'return'
      ? `↩️ صاحب الموقع وافق بشرط ملاحظته (#${d.issue.number}) — نفذها مع الملاحظة دي.${note}`
      : `✅ صاحب الموقع وافق على المهمة دي (#${d.issue.number}).`);
    await done(d, [`✅ المهمة #${t.number} ${req.decision === 'return' ? 'اتوافق عليها بملاحظتك' : 'اتوافق عليها'}. وكيل البرمجة هينفذها لما تكتبله «نفذ مهام شاهين»، وكل تعديل منها هيرجعلك للموافقة.`]);
    return;
  }
  throw new Refused(`#${req.target} مش حاجة مستنية موافقتك (${DECISIONS[req.decision]}).`);
}

// ── revert ─────────────────────────────────────────────────────────────────────────────────────────────────
async function doRevert(d: Desk, req: Extract<DeskRequest, { kind: 'revert' }>) {
  const trailers = [requestTrailer(req.request), stateTrailer(req.request)];
  const shas = [...new Set(trailers.flatMap((trailer) => git('log', '--format=%H', '-F', `--grep=${trailer}`, 'HEAD').split('\n').filter(Boolean)))]
    .filter((sha) => git('log', '-1', '--format=%B', sha).split('\n').some((l) => trailers.includes(l.trim())));
  if (!shas.length) throw new Refused(`الطلب #${req.request} ماغيّرش أي ملف في الموقع (أو قديم أوي)، فمفيش حاجة ترجع.`);
  configureGit();
  git('checkout', '-q', '-B', `owner-revert/${d.issue.number}`);
  for (const sha of shas) {
    if (!tryGit('revert', '--no-edit', '--no-commit', sha)) { tryGit('revert', '--abort'); git('reset', '-q', '--hard', 'HEAD'); throw new Refused('التعديل ده اتغير بعده حاجات تانية في نفس المكان، فمينفعش يرجع لوحده. قول لشاهين يعمل تعديل يرجّعه.'); }
  }
  const changed = git('diff', '--cached', '--name-only').split('\n').filter(Boolean);
  if (!changed.length) throw new Refused(`اللي غيّره الطلب #${req.request} راجع أصلاً.`);
  const onlyControls = changed.every((p) => p === CONTROLS);
  if (!onlyControls) {
    const checks = runChecks();
    if (!checks.ok) { git('reset', '-q', '--hard', 'HEAD'); throw new Refused(`بعد الرجوع الفحص \`${checks.check}\` وقع، فسبت كل حاجة زي ما هي.\n\n\`\`\`\n${tail(checks.output)}\n\`\`\``); }
  }
  const title = `owner-desk: رجوع عن الطلب #${req.request}`;
  const message = `Reverted at ${OWNER.github}'s request in #${d.issue.number}.\n\n${requestTrailer(d.issue.number)}`;
  git('commit', '-q', '-m', title, '-m', message);
  const where = await land(d, `owner-revert/${d.issue.number}`, title, message);
  await done(d, [`✅ **رجعت كل اللي غيّره الطلب #${req.request}**${onlyControls ? '' : ' وعدّى كل الفحوص'}.`, '', `**الملفات:** ${changed.map((p) => `\`${p}\``).join('، ')}`, `**اتحفظ في:** ${where}`]);
}

// ── the request ────────────────────────────────────────────────────────────────────────────────────────────
async function main() {
  const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH || '', 'utf8')) as IssueEvent;
  if (!isOwnersRequest(event)) { console.log('Not a request from the owner — nothing to do.'); return; }
  const issue = event.issue!;
  const repo = process.env.GITHUB_REPOSITORY || '';
  const gh = new GitHub(repo, process.env.GITHUB_TOKEN);
  const d: Desk = {
    issue, repo, gh,
    reply: (body) => gh.comment(issue.number, body).catch((e) => console.log(`::warning::comment failed: ${(e as Error).message}`)),
    close: (reason) => gh.api(`/repos/${repo}/issues/${issue.number}`, { method: 'PATCH', body: JSON.stringify({ state: 'closed', state_reason: reason }) }).catch(() => undefined),
  };
  const encoded = changeFromIssue(issue.body || '');
  const req = encoded ? await decodeDesk(encoded) : undefined;
  try {
    if (!req) throw new Refused('مش لاقي الطلب جوه الصفحة (يمكن اتمسح أو اتغير وهو بيتلصق).');
    console.log(`Request #${issue.number}: ${req.kind}${req.kind === 'order' ? ` ${req.order.action} ${req.order.bot ? botName(req.order.bot) : ''}` : ''}`);
    if (req.kind === 'change') await doChange(d, req);
    else if (req.kind === 'order') await doOrder(d, req);
    else if (req.kind === 'decide') await doDecide(d, req);
    else await doRevert(d, req);
  } catch (error) {
    if (error instanceof Refused) {
      await d.reply(`❌ **الطلب ماتنفذش — مفيش حاجة اتغيرت في الموقع.**\n\n${error.message}\n\nلو محتاج، ارجع لغرفة شاهين وقوله اللي حصل.`);
      await d.close('not_planned');
      return;
    }
    await d.reply(`⚠️ **حصلت مشكلة في المكتب وهو بينفذ الطلب.** لو ماظهرش أثره خلال ربع ساعة، ابعته تاني من الجناح.\n\n\`${maskSensitive((error as Error).message).slice(0, 300)}\``);
    throw error;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => { console.error(`::error title=Owner desk::${(error as Error).message}`); process.exit(1); });
}
