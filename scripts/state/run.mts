/**
 * «دولة المنصة» at work (src/utils/platformState.ts, rule O-11) — every hour, while the owner handed it the approvals:
 *   1. council tasks waiting for approval (`needs-approval`): the members vote; approved → `approved-by-state` (the
 *      coding agent carries it out), refused → stays for the owner with the reasons;
 *   2. robots' pull requests waiting for approval: the members vote on the real files and lines; approved → every
 *      check on the newest main, then merged and the site rebuilt; refused or a failed check → stays for the owner;
 *   3. its log and its supervision of the robots → src/data/live/platform-state.json (the owner's suite reads it).
 * The owner is above it: a frozen site, a switch other than `state`, or an answer of his already given → nothing here.
 * Never run end to end locally: it merges into main.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { GitHub } from '../doctor/github';
import { runChecks } from '../owner/apply-change.mts';
import { OWNER_APPROVAL_LABEL, readControls } from '../../src/utils/ownerAuthority';
import { TASK_APPROVAL_LABEL, requestTrailer } from '../../src/utils/ownerDesk';
import {
  STATE, STATE_LABELS, STATE_LIMITS, readStateReport, stateActive, stateComment, stateTrailer, stateVote, type StateRecord, type StateReport,
} from '../../src/utils/platformState';

const REPORT = 'src/data/live/platform-state.json';
const CONTROLS = 'src/data/owner/controls.json';
interface Issue { number: number; title: string; body: string | null; html_url: string; labels: { name: string }[]; pull_request?: unknown; created_at: string }
interface PrFile { filename: string; status: string; additions: number; deletions: number; patch?: string }

const git = (...args: string[]) => execFileSync('git', ['-c', 'core.quotePath=false', ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const tryGit = (...args: string[]) => { try { git(...args); return true; } catch { return false; } };
const say = (s: string) => console.log(s);

/** What the robots' supervisor sees: the precheck's health and every robot reporting a failure. */
export function supervision(precheck: unknown): StateReport['supervision'] {
  const p = (precheck && typeof precheck === 'object' ? precheck : {}) as { health?: number; bots?: { id: string; status: string; problems?: string[] }[] };
  const problems = (p.bots || []).filter((b) => b.status === 'fail' || b.status === 'warn').map((b) => `${b.id}: ${(b.problems || [])[0] || b.status}`).slice(0, 10);
  return { ...(typeof p.health === 'number' ? { health: p.health } : {}), problems };
}

async function main() {
  const controls = readControls(JSON.parse(readFileSync(CONTROLS, 'utf8')));
  const before = readStateReport(existsSync(REPORT) ? JSON.parse(readFileSync(REPORT, 'utf8')) : {});
  const active = stateActive(controls);
  const records: StateRecord[] = [];
  const repo = process.env.GITHUB_REPOSITORY || '';
  const token = process.env.GITHUB_TOKEN;
  // Only the live run decides (branch pushes and local runs rehearse: they read, decide nothing, publish nothing).
  const act = process.env.STATE_ACT === 'true' && Boolean(repo && token);

  if (!active) say(controls.frozen ? 'All robots are frozen by the owner — the State waits too.' : `The owner keeps the approvals himself (${controls.selfDevelopment}) — nothing to decide.`);
  else if (!act) say('Rehearsal (not the live run): nothing is decided.');
  else {
    const gh = new GitHub(repo, token!);
    const path = `/repos/${repo}`;
    for (const [name, color, description] of [[STATE_LABELS.approvedTask, '1d76db', 'دولة المنصة وافقت — وكيل البرمجة ينفذها'], [STATE_LABELS.reviewed, 'c5def5', 'دولة المنصة راجعت الموضوع ده'], [STATE_LABELS.refused, 'b60205', 'دولة المنصة رفضته — القرار لصاحب الموقع']] as const) {
      await gh.ensureLabel(name, color, description).catch(() => undefined);
    }
    const fresh = (i: Issue) => !i.labels.some((l) => l.name === STATE_LABELS.reviewed);
    const now = () => new Date().toISOString();

    // 1. Council tasks.
    const tasks = (await gh.api<Issue[]>(`${path}/issues?state=open&per_page=50&labels=${encodeURIComponent(`shaheen-task,${TASK_APPROVAL_LABEL}`)}`).catch(() => [] as Issue[]))
      .filter((i) => !i.pull_request && fresh(i)).sort((a, b) => a.number - b.number).slice(0, STATE_LIMITS.perRun.tasks);
    for (const t of tasks) {
      const d = stateVote({ kind: 'task', title: t.title.replace(/^مهمة شاهين:\s*/, ''), body: t.body });
      if (d.approved) {
        await gh.api(`${path}/issues/${t.number}/labels/${encodeURIComponent(TASK_APPROVAL_LABEL)}`, { method: 'DELETE' }).catch(() => undefined);
        await gh.addLabels(t.number, [STATE_LABELS.approvedTask, STATE_LABELS.reviewed]).catch(() => undefined);
      } else await gh.addLabels(t.number, [STATE_LABELS.reviewed, STATE_LABELS.refused]).catch(() => undefined);
      await gh.comment(t.number, stateComment(d, d.approved ? ['وكيل البرمجة هينفذها لما صاحب الموقع يكتبله «نفذ مهام شاهين»، وكل تعديل منها بيعدّي كل الفحوص.'] : [])).catch(() => undefined);
      records.push({ at: now(), number: t.number, kind: 'task', title: t.title.replace(/^مهمة شاهين:\s*/, '').slice(0, 140), outcome: d.approved ? 'approved' : 'refused', summaryAr: d.summaryAr, tally: d.tally, url: t.html_url });
      say(`Task #${t.number}: ${d.summaryAr}`);
    }

    // 2. Robots' pull requests (oldest first, a couple per hour: each one runs every check).
    const pulls = (await gh.api<Issue[]>(`${path}/issues?state=open&per_page=50&labels=${encodeURIComponent(OWNER_APPROVAL_LABEL)}`).catch(() => [] as Issue[]))
      .filter((i) => i.pull_request && fresh(i)).sort((a, b) => a.number - b.number).slice(0, STATE_LIMITS.perRun.pulls);
    // Back to where the run started after each review (main, by name — the log is published from it).
    const branch = git('rev-parse', '--abbrev-ref', 'HEAD');
    const home = branch === 'HEAD' ? git('rev-parse', 'HEAD') : branch;
    for (const p of pulls) {
      const files = await gh.api<PrFile[]>(`${path}/pulls/${p.number}/files?per_page=100`).catch(() => [] as PrFile[]);
      const added = files.map((f) => (f.patch || '').split('\n').filter((l) => l.startsWith('+') && !l.startsWith('+++')).join('\n')).join('\n');
      const d = stateVote({ kind: 'pull', title: p.title, body: p.body, paths: files.map((f) => f.filename), lines: files.reduce((s, f) => s + f.additions + f.deletions, 0), deletedFiles: files.filter((f) => f.status === 'removed').length, added });
      const record: StateRecord = { at: now(), number: p.number, kind: 'pull', title: p.title.slice(0, 140), outcome: 'refused', summaryAr: d.summaryAr, tally: d.tally, url: p.html_url };
      if (!d.approved) {
        await gh.addLabels(p.number, [STATE_LABELS.reviewed, STATE_LABELS.refused]).catch(() => undefined);
        await gh.comment(p.number, stateComment(d)).catch(() => undefined);
        records.push(record); say(`Pull #${p.number}: ${d.summaryAr}`);
        continue;
      }
      // S-04: approved by the vote — now every check on the robot's version brought up to the newest main.
      const pr = await gh.api<{ head: { ref: string }; title: string }>(`${path}/pulls/${p.number}`);
      git('fetch', '-q', '--depth=300', 'origin', `+refs/heads/${pr.head.ref}:refs/remotes/origin/state-review`, 'main');
      git('checkout', '-q', '-f', '-B', 'state-review', 'origin/state-review');
      git('config', 'user.name', 'Platform State');
      git('config', 'user.email', '41898282+github-actions[bot]@users.noreply.github.com');
      if (!tryGit('merge', '-q', '--no-edit', 'origin/main')) tryGit('merge', '--abort');
      const checks = runChecks();
      git('checkout', '-q', '-f', home);
      if (!checks.ok) {
        record.outcome = 'failed';
        record.summaryAr = `الأعضاء وافقوا بس الفحص «${checks.check}» وقع — مستني صاحب الموقع.`;
        await gh.addLabels(p.number, [STATE_LABELS.reviewed, STATE_LABELS.refused]).catch(() => undefined);
        await gh.comment(p.number, stateComment(d, [`⚠️ **بس الفحص \`${checks.check}\` وقع، فمادمجتوش.** القرار لصاحب الموقع.`])).catch(() => undefined);
        records.push(record); say(`Pull #${p.number}: check ${checks.check} failed`);
        continue;
      }
      const message = `Approved by ${STATE.nameEn} (${d.tally.approve} votes for, ${d.tally.refuse} against) after every check.\n\n${stateTrailer(p.number)}\n${requestTrailer(p.number)}`;
      try {
        const merged = await gh.mergePull(p.number, `${pr.title} (#${p.number})`, message);
        record.outcome = 'merged'; record.sha = merged.sha;
        await gh.addLabels(p.number, [STATE_LABELS.reviewed]).catch(() => undefined);
        await gh.comment(p.number, stateComment(d, [`✅ **عدّى كل الفحوص واتدمج** (${merged.sha.slice(0, 7)}). صاحب الموقع يقدر يرجّعه بزرار «رجّع» في جناحه.`])).catch(() => undefined);
        await gh.dispatch('pages.yml').catch(() => undefined);
      } catch (e) {
        record.outcome = 'failed';
        record.summaryAr = `الأعضاء وافقوا بس GitHub مارضيش يدمجه (${(e as Error).message.slice(0, 80)}) — مستني صاحب الموقع.`;
        await gh.addLabels(p.number, [STATE_LABELS.reviewed, STATE_LABELS.refused]).catch(() => undefined);
      }
      records.push(record); say(`Pull #${p.number}: ${record.outcome}`);
    }
  }

  const precheck = existsSync('src/data/live/shaheen-precheck.json') ? JSON.parse(readFileSync('src/data/live/shaheen-precheck.json', 'utf8')) : {};
  const report: StateReport = { updatedAt: new Date().toISOString(), active, decisions: [...records, ...before.decisions].slice(0, 40), supervision: supervision(precheck) };
  // Published when it decided something, when its state changed, or twice a day (so its report never looks late).
  const stale = Date.now() - Date.parse(before.updatedAt) > 12 * 3600_000;
  if (records.length || before.active !== active || stale || JSON.stringify(before.supervision) !== JSON.stringify(report.supervision)) {
    writeFileSync(REPORT, `${JSON.stringify(report, null, 1)}\n`);
    if (act) {
      git('config', 'user.name', 'Platform State');
      git('config', 'user.email', '41898282+github-actions[bot]@users.noreply.github.com');
      execFileSync('node', ['scripts/ci/publish.mjs', `دولة المنصة: ${records.length} قرار`, REPORT], { stdio: 'inherit' });
    }
  }
  if (process.env.GITHUB_STEP_SUMMARY) {
    const { appendFileSync } = await import('node:fs');
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## 🏛️ ${STATE.nameAr}\n\n${active ? 'بتوافق بالنيابة عن صاحب الموقع.' : 'صاحب الموقع ماسك الموافقات بنفسه دلوقتي.'}\n\n${records.map((r) => `- #${r.number} (${r.kind === 'pull' ? 'تعديل روبوت' : 'مهمة'}): ${r.summaryAr}`).join('\n') || '- مفيش حاجة مستنية قرار.'}\n`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => { console.error(`::error title=${STATE.nameEn}::${(error as Error).message}`); process.exit(1); });
}
