/**
 * «دولة المنصة» at work (src/utils/platformState.ts, rule O-11) — every hour, and within a minute of an order from
 * the owner's room, while the owner handed it the approvals:
 *   0. the owner's orders from the State's room (issues «[الدولة] …» opened by his own account): the State judges each
 *      one again (src/utils/stateRoom.ts), carries out what it accepts (pause / resume / run now / add or repeal a
 *      law), answers on the request and closes it;
 *   1. council tasks waiting for approval (`needs-approval`): the members vote; approved → `approved-by-state` (the
 *      coding agent carries it out), refused → the State closes it itself with the reasons;
 *   2. robots' pull requests waiting for approval: the members vote on the real files and lines; approved → every
 *      check on the newest main, then merged and the site rebuilt; refused or a failed check → closed with the reasons;
 *   2b. «مناورة التخصصات» (scripts/shaheen-maneuver/run.mts): every finding of the field maneuver filed under its
 *      sector and robot (src/utils/stateSectors.ts); a serious error becomes a task after the members vote (at most
 *      3 an hour, never twice for the same finding), the rest is watched or kept in the sector's ideas list;
 *   3. its own orders: a robot whose last check failed is run again (at most once a day per robot);
 *   4. its log and its supervision of the robots → src/data/live/platform-state.json, its orders and the platform's
 *      laws → src/data/owner/state-orders.json (and the robots' handbook, which carries the laws).
 * It never goes back to the owner (his decision, 2026-10-22). The owner is above it: a frozen site or a switch other
 * than `state` → nothing here. Never run end to end locally: it merges into main.
 */
import { execFileSync } from 'node:child_process';
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { GitHub } from '../doctor/github';
import { runChecks } from '../owner/apply-change.mts';
import { BOTS } from '../../src/utils/shaheenOrg';
import { OWNER, OWNER_APPROVAL_LABEL, readControls, stoppedByOwner } from '../../src/utils/ownerAuthority';
import { TASK_APPROVAL_LABEL, requestTrailer } from '../../src/utils/ownerDesk';
import {
  STATE, STATE_LABELS, STATE_LIMITS, STATE_ORDERS_FILE, readStateOrders, readStateReport, stateActive, stateComment, stateTrailer, stateVote,
  type StateOrders, type StateRecord, type StateReport,
} from '../../src/utils/platformState';
import { readManeuverReport } from '../../src/utils/maneuver';
import { fieldTask, fileField, fieldMarker } from '../../src/utils/stateSectors';
import { STATE_ISSUE_PREFIX, applyStateOrder, judgeStateOrder, parseStateOrder, stateOrderableBots, type StateOrder } from '../../src/utils/stateRoom';

const REPORT = 'src/data/live/platform-state.json';
const CONTROLS = 'src/data/owner/controls.json';
const PRECHECK = 'src/data/live/shaheen-precheck.json';
const MANEUVER = 'src/data/live/shaheen-maneuver.json';
const DOCS = ['SHAHEEN_HANDBOOK.md', 'SHAHEEN_ORG.md'];
interface Issue { number: number; title: string; body: string | null; html_url: string; labels: { name: string }[]; pull_request?: unknown; created_at: string; user?: { login?: string }; author_association?: string }
interface PrFile { filename: string; status: string; additions: number; deletions: number; patch?: string }

const git = (...args: string[]) => execFileSync('git', ['-c', 'core.quotePath=false', ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const tryGit = (...args: string[]) => { try { git(...args); return true; } catch { return false; } };
const say = (s: string) => console.log(s);
const readJson = (file: string) => (existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {});

/** What the robots' supervisor sees: the precheck's health and every robot reporting a failure. */
export function supervision(precheck: unknown): StateReport['supervision'] {
  const p = (precheck && typeof precheck === 'object' ? precheck : {}) as { health?: number; bots?: { id: string; status: string; problems?: string[] }[] };
  const problems = (p.bots || []).filter((b) => b.status === 'fail' || b.status === 'warn').map((b) => `${b.id}: ${(b.problems || [])[0] || b.status}`).slice(0, 10);
  return { ...(typeof p.health === 'number' ? { health: p.health } : {}), problems };
}

/** Robots the State runs again on its own (S-08): failed in the last check, free to run, not run by it in 24 hours. */
export function rerunCandidates(precheck: unknown, orders: StateOrders, controls: ReturnType<typeof readControls>, now = Date.now()): string[] {
  const p = (precheck && typeof precheck === 'object' ? precheck : {}) as { bots?: { id: string; status: string }[] };
  const orderable = new Set(stateOrderableBots().map((b) => b.id as string));
  const recent = new Set(orders.log.filter((e) => e.action === 'run' && now - Date.parse(e.at) < 24 * 3600_000).map((e) => BOTS.find((b) => b.id === e.target)?.workflow));
  const seen = new Set<string>();
  const out: string[] = [];
  for (const b of p.bots || []) {
    const bot = BOTS.find((x) => x.id === b.id);
    if (b.status !== 'fail' || !bot?.workflow || !orderable.has(bot.id) || stoppedByOwner(controls, bot.id) || orders.paused.includes(bot.id)) continue;
    if (recent.has(bot.workflow) || seen.has(bot.workflow)) continue;
    seen.add(bot.workflow); out.push(bot.id);
  }
  return out.slice(0, STATE_LIMITS.perRun.reruns);
}

async function main() {
  const controls = readControls(readJson(CONTROLS));
  const before = readStateReport(readJson(REPORT));
  const ordersBefore = readStateOrders(readJson(STATE_ORDERS_FILE));
  let orders = ordersBefore;
  const precheck = readJson(PRECHECK);
  const active = stateActive(controls);
  const records: StateRecord[] = [];
  const repo = process.env.GITHUB_REPOSITORY || '';
  const token = process.env.GITHUB_TOKEN;
  // Only the live run decides (branch pushes and local runs rehearse: they read, decide nothing, publish nothing).
  const act = process.env.STATE_ACT === 'true' && Boolean(repo && token);
  const notes: string[] = [];
  // «مناورة التخصصات»: every finding of the field maneuver filed under its sector and robot (src/utils/stateSectors.ts).
  const filed = fileField(readManeuverReport(readJson(MANEUVER)), before.field, new Date().toISOString(), STATE_LIMITS.perRun.maneuver);
  let field = filed.field;
  if (field && field.maneuverAt !== before.field?.maneuverAt) {
    const by = new Map<string, number>();
    for (const i of field.items) by.set(i.deptAr, (by.get(i.deptAr) || 0) + 1);
    say(`Maneuver report filed: ${[...by].map(([d, n]) => `${d} ${n}`).join('، ') || 'nothing found'}`);
  }

  if (act) {
    const gh = new GitHub(repo, token!);
    const path = `/repos/${repo}`;
    const close = (n: number, reason: 'completed' | 'not_planned') => gh.api(`${path}/issues/${n}`, { method: 'PATCH', body: JSON.stringify({ state: 'closed', state_reason: reason }) }).catch(() => undefined);

    // 0. The owner's orders from the State's room (only his own requests; anyone can open an issue on a public repo).
    const requests = (await gh.api<Issue[]>(`${path}/issues?state=open&per_page=30&creator=${encodeURIComponent(OWNER.github)}`).catch(() => [] as Issue[]))
      .filter((i) => !i.pull_request && i.title.startsWith(STATE_ISSUE_PREFIX) && i.user?.login?.toLowerCase() === OWNER.github.toLowerCase())
      .sort((a, b) => a.number - b.number).slice(0, STATE_LIMITS.perRun.orders);
    for (const r of requests) {
      const order = parseStateOrder(r.body);
      if (!order) { await gh.comment(r.number, `🏛️ **${STATE.nameAr}:** مش لاقية أمر واضح في الطلب ده — ابعته تاني من غرفة الدولة في جناحك.`).catch(() => undefined); await close(r.number, 'not_planned'); continue; }
      const verdict = judgeStateOrder(order, { controls, orders });
      if (!verdict.ok) {
        await gh.comment(r.number, `🏛️ **${STATE.nameAr}:** ❌ مش هنفذ الأمر ده: ${verdict.reasonAr}`).catch(() => undefined);
        await close(r.number, 'not_planned'); notes.push(`#${r.number}: رفضت — ${verdict.reasonAr}`); continue;
      }
      const done = await carryOut(gh, order, verdict.reasonAr);
      if (!done.ok) {
        await gh.comment(r.number, `🏛️ **${STATE.nameAr}:** ⚠️ وافقت على الأمر بس مقدرتش أنفذه: ${done.noteAr}`).catch(() => undefined);
        await close(r.number, 'not_planned'); notes.push(`#${r.number}: ${done.noteAr}`); continue;
      }
      await gh.comment(r.number, `🏛️ **${STATE.nameAr}:** ✅ ${done.noteAr}`).catch(() => undefined);
      await close(r.number, 'completed'); notes.push(`#${r.number}: ${done.noteAr}`);
    }
    if (active) {
      for (const [name, color, description] of [[STATE_LABELS.approvedTask, '1d76db', 'دولة المنصة وافقت — وكيل البرمجة ينفذها'], [STATE_LABELS.reviewed, 'c5def5', 'دولة المنصة راجعت الموضوع ده'], [STATE_LABELS.refused, 'b60205', 'دولة المنصة رفضته وقفلته']] as const) {
        await gh.ensureLabel(name, color, description).catch(() => undefined);
      }
      const fresh = (i: Issue) => !i.labels.some((l) => l.name === STATE_LABELS.reviewed);
      const now = () => new Date().toISOString();

      // 1. Council tasks.
      const tasks = (await gh.api<Issue[]>(`${path}/issues?state=open&per_page=50&labels=${encodeURIComponent(`shaheen-task,${TASK_APPROVAL_LABEL}`)}`).catch(() => [] as Issue[]))
        .filter((i) => !i.pull_request && fresh(i)).sort((a, b) => a.number - b.number).slice(0, STATE_LIMITS.perRun.tasks);
      for (const t of tasks) {
        const d = stateVote({ kind: 'task', title: t.title.replace(/^مهمة شاهين:\s*/, ''), body: t.body });
        await gh.api(`${path}/issues/${t.number}/labels/${encodeURIComponent(TASK_APPROVAL_LABEL)}`, { method: 'DELETE' }).catch(() => undefined);
        if (d.approved) await gh.addLabels(t.number, [STATE_LABELS.approvedTask, STATE_LABELS.reviewed]).catch(() => undefined);
        else await gh.addLabels(t.number, [STATE_LABELS.reviewed, STATE_LABELS.refused]).catch(() => undefined);
        await gh.comment(t.number, stateComment(d, d.approved ? ['وكيل البرمجة هينفذها لما صاحب الموقع يكتبله «نفذ مهام شاهين»، وكل تعديل منها بيعدّي كل الفحوص.'] : ['الدولة قفلت المهمة دي.'])).catch(() => undefined);
        if (!d.approved) await close(t.number, 'not_planned');
        records.push({ at: now(), number: t.number, kind: 'task', title: t.title.replace(/^مهمة شاهين:\s*/, '').slice(0, 140), outcome: d.approved ? 'approved' : 'refused', summaryAr: d.summaryAr, tally: d.tally, url: t.html_url });
        say(`Task #${t.number}: ${d.summaryAr}`);
      }

      // 2. Robots' pull requests (oldest first, a few per hour: each one runs every check).
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
        const refuse = async (extra: string[]) => {
          await gh.addLabels(p.number, [STATE_LABELS.reviewed, STATE_LABELS.refused]).catch(() => undefined);
          await gh.comment(p.number, stateComment(d, [...extra, 'الدولة قفلت التعديل ده. الروبوت يقدر يبعت نسخة جديدة تراعي الأسباب.'])).catch(() => undefined);
          await close(p.number, 'not_planned');
        };
        if (!d.approved) { await refuse([]); records.push(record); say(`Pull #${p.number}: ${d.summaryAr}`); continue; }
        // S-04: approved by the vote — now every check on the robot's version brought up to the newest main.
        const pr = await gh.api<{ head: { ref: string }; title: string }>(`${path}/pulls/${p.number}`);
        git('fetch', '-q', '--depth=300', 'origin', `+refs/heads/${pr.head.ref}:refs/remotes/origin/state-review`, 'main');
        git('checkout', '-q', '-f', '-B', 'state-review', 'origin/state-review');
        configureGit();
        if (!tryGit('merge', '-q', '--no-edit', 'origin/main')) tryGit('merge', '--abort');
        const checks = runChecks();
        git('checkout', '-q', '-f', home);
        if (!checks.ok) {
          record.outcome = 'failed';
          record.summaryAr = `الأعضاء وافقوا بس الفحص «${checks.check}» وقع — الدولة قفلت التعديل.`;
          await refuse([`⚠️ **بس الفحص \`${checks.check}\` وقع، فمادمجتوش.**`]);
          records.push(record); say(`Pull #${p.number}: check ${checks.check} failed`);
          continue;
        }
        const message = `Approved by ${STATE.nameEn} (${d.tally.approve} votes for, ${d.tally.refuse} against) after every check.\n\n${stateTrailer(p.number)}\n${requestTrailer(p.number)}`;
        try {
          const merged = await gh.mergePull(p.number, `${pr.title} (#${p.number})`, message);
          record.outcome = 'merged'; record.sha = merged.sha;
          await gh.addLabels(p.number, [STATE_LABELS.reviewed]).catch(() => undefined);
          await gh.comment(p.number, stateComment(d, [`✅ **عدّى كل الفحوص واتدمج** (${merged.sha.slice(0, 7)}).`])).catch(() => undefined);
          await gh.dispatch('pages.yml').catch(() => undefined);
        } catch (e) {
          record.outcome = 'failed';
          record.summaryAr = `الأعضاء وافقوا بس GitHub مارضيش يدمجه (${(e as Error).message.slice(0, 80)}) — الدولة قفلته.`;
          await refuse([`⚠️ GitHub مارضيش يدمجه.`]);
        }
        records.push(record); say(`Pull #${p.number}: ${record.outcome}`);
      }

      // 2b. «مناورة التخصصات»: the serious errors become tasks (the members vote first; the marker keeps each one single).
      if (filed.due.length && field) {
        await gh.ensureLabel('shaheen-task', '0e8a16', 'مهمة تطوير من شاهين').catch(() => undefined);
        const open = await gh.api<Issue[]>(`${path}/issues?state=open&per_page=100&labels=shaheen-task`).catch(() => [] as Issue[]);
        const items = new Map(field.items.map((i) => [i.id, i]));
        for (const { item, finding } of filed.due) {
          const existing = open.find((i) => (i.body || '').includes(fieldMarker(item.id)));
          if (existing) { items.set(item.id, { ...item, issue: existing.number }); continue; }
          const task = fieldTask(item, finding);
          const d = stateVote({ kind: 'task', title: task.title.replace(/^مهمة شاهين:\s*/, ''), body: task.body });
          if (!d.approved) {
            items.set(item.id, { ...item, refused: true });
            notes.push(`مناورة التخصصات: مافتحتش مهمة «${item.titleAr.slice(0, 60)}» — ${d.summaryAr}`);
            continue;
          }
          const created = await gh.api<{ number: number; html_url: string }>(`${path}/issues`, {
            method: 'POST', body: JSON.stringify({ title: task.title, body: `${task.body}\n\n${stateComment(d, ['وكيل البرمجة هينفذها لما صاحب الموقع يكتبله «نفذ مهام شاهين».'])}`, labels: ['shaheen-task', STATE_LABELS.approvedTask, STATE_LABELS.reviewed] }),
          }).catch((e) => { notes.push(`مقدرتش أفتح مهمة «${item.titleAr.slice(0, 60)}» (${(e as Error).message.slice(0, 60)})`); return undefined; });
          if (!created) continue;
          items.set(item.id, { ...item, issue: created.number });
          records.push({ at: now(), number: created.number, kind: 'task', title: task.title.replace(/^مهمة شاهين:\s*/, '').slice(0, 140), outcome: 'approved', summaryAr: d.summaryAr, tally: d.tally, url: created.html_url });
          say(`Maneuver task #${created.number}: [${item.deptAr}] ${item.titleAr}`);
        }
        field = { ...field, items: field.items.map((i) => items.get(i.id) || i) };
      }

      // 3. Its own orders: run again the robots whose last check failed.
      for (const id of rerunCandidates(precheck, orders, controls)) {
        const done = await carryOut(gh, { action: 'run', target: id, whyAr: 'آخر فحص ليه وقع، فشغّلته تاني بنفسي.' }, '');
        notes.push(done.noteAr);
      }
    }

    /** Carries out one accepted order: robots' runs through GitHub, everything else in the orders file. */
    async function carryOut(client: GitHub, order: StateOrder, why: string): Promise<{ ok: boolean; noteAr: string }> {
      const o = { ...order, whyAr: order.whyAr || why };
      if (o.action === 'run') {
        const wf = BOTS.find((b) => b.id === o.target)?.workflow;
        try { await client.dispatch(wf!); } catch (e) { return { ok: false, noteAr: `GitHub مارضيش يشغّل «${wf}» (${(e as Error).message.slice(0, 60)}).` }; }
      }
      const applied = applyStateOrder(orders, o);
      orders = applied.orders;
      return { ok: applied.changed, noteAr: applied.noteAr };
    }
  } else say(active ? 'Rehearsal (not the live run): nothing is decided.' : controls.frozen ? 'All robots are frozen by the owner — the State waits too.' : `The owner keeps the approvals himself (${controls.selfDevelopment}) — nothing to decide.`);

  const report: StateReport = { updatedAt: new Date().toISOString(), active, decisions: [...records, ...before.decisions].slice(0, 40), supervision: supervision(precheck), ...(field ? { field } : {}) };
  const publish: string[] = [];
  // Published when it decided something, when its state changed, or twice a day (so its report never looks late).
  const stale = Date.now() - Date.parse(before.updatedAt) > 12 * 3600_000;
  if (records.length || notes.length || before.active !== active || stale || JSON.stringify(before.supervision) !== JSON.stringify(report.supervision)
    || JSON.stringify(before.field?.items ?? null) !== JSON.stringify(report.field?.items ?? null)) {
    writeFileSync(REPORT, `${JSON.stringify(report, null, 1)}\n`); publish.push(REPORT);
  }
  if (JSON.stringify(orders) !== JSON.stringify(ordersBefore)) {
    writeFileSync(STATE_ORDERS_FILE, `${JSON.stringify(orders, null, 1)}\n`); publish.push(STATE_ORDERS_FILE);
    // The laws live in the robots' handbook too: regenerated with them, so nobody reads an old copy.
    if (JSON.stringify(orders.laws) !== JSON.stringify(ordersBefore.laws)) { execFileSync('node', ['--import', 'tsx', 'scripts/shaheen-council/org-doc.mts'], { stdio: 'inherit' }); publish.push(...DOCS); }
  }
  if (act && publish.length) {
    configureGit();
    execFileSync('node', ['scripts/ci/publish.mjs', `دولة المنصة: ${records.length} قرار، ${notes.length} أمر`, ...publish], { stdio: 'inherit' });
  }
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## 🏛️ ${STATE.nameAr}\n\n${active ? 'ماسكة كل الموافقات وبتقرر وبتنفذ بنفسها.' : 'صاحب الموقع ماسك الموافقات بنفسه دلوقتي.'}\n\n${[...records.map((r) => `- #${r.number} (${r.kind === 'pull' ? 'تعديل روبوت' : 'مهمة'}): ${r.summaryAr}`), ...notes.map((x) => `- ${x}`)].join('\n') || '- مفيش حاجة مستنية قرار.'}\n`);
  }
}

function configureGit() {
  git('config', 'user.name', 'Platform State');
  git('config', 'user.email', '41898282+github-actions[bot]@users.noreply.github.com');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => { console.error(`::error title=${STATE.nameEn}::${(error as Error).message}`); process.exit(1); });
}
