/**
 * «مكتب صاحب الموقع» — applying a change Shaheen proposed in the private room and the owner approved.
 *
 * The owner pressed «وافق» in his suite, which opened a GitHub request (issue) from his own account with the change
 * inside. This runs only for a request opened by the repository owner himself (GitHub proves who opened it), takes
 * the change, applies it to the newest main under the same rules as the suite (src/utils/ownerFiles.ts), runs every
 * check, and only then merges it and rebuilds the site. If anything fails nothing changes, and the request says why.
 * The request carries the change only — never the room's conversation.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { GitHub } from '../doctor/github';
import { OWNER, maskSensitive, readControls } from '../../src/utils/ownerAuthority';
import { CHANGE_TITLE_PREFIX, changeFromIssue, changeVerdict, decodeChange, planChange } from '../../src/utils/ownerFiles';

interface IssueEvent { issue?: { number: number; title: string; body: string | null; author_association?: string; user?: { login?: string } } }

/** What must pass before the change goes live (the same checks as every pull request, plus the Pages build). */
export const DESK_CHECKS = ['npm run lint', 'npm test', 'npm run build:pages', 'npm run build:vercel', 'npm run test:vercel'];

/** Only the owner's own request, with the room's title. Anyone else's issue is ignored silently. */
export function isOwnersRequest(e: IssueEvent, owner = OWNER.github): boolean {
  const i = e.issue;
  return Boolean(i && i.user?.login?.toLowerCase() === owner.toLowerCase() && i.author_association === 'OWNER' && i.title.startsWith(CHANGE_TITLE_PREFIX));
}

const sh = (command: string) => execFileSync('bash', ['-lc', command], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024, timeout: 20 * 60_000 });
const git = (...args: string[]) => execFileSync('git', ['-c', 'core.quotePath=false', ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const tail = (text: string, n = 25) => maskSensitive(text.split('\n').filter((l) => l.trim()).slice(-n).join('\n')).slice(-3000);

async function main() {
  const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH || '', 'utf8')) as IssueEvent;
  if (!isOwnersRequest(event)) { console.log('Not a change request from the owner — nothing to do.'); return; }
  const issue = event.issue!;
  const repo = process.env.GITHUB_REPOSITORY || '';
  const gh = new GitHub(repo, process.env.GITHUB_TOKEN);
  const reply = (body: string) => gh.comment(issue.number, body).catch((e) => console.log(`::warning::comment failed: ${(e as Error).message}`));
  const close = (reason: 'completed' | 'not_planned') => gh.api(`/repos/${repo}/issues/${issue.number}`, { method: 'PATCH', body: JSON.stringify({ state: 'closed', state_reason: reason }) }).catch(() => undefined);
  const refuse = async (why: string) => { await reply(`❌ **التعديل ماتنفذش — مفيش حاجة اتغيرت في الموقع.**\n\n${why}\n\nارجع لغرفة شاهين وقوله اللي حصل، وهو يظبط الاقتراح.`); await close('not_planned'); };

  try { await apply(issue, gh, repo, reply, close, refuse); }
  catch (error) {
    await reply(`⚠️ **حصلت مشكلة في المكتب وهو بينفذ التعديل.** لو التعديل ماظهرش في الموقع خلال ربع ساعة، ارجع لغرفة شاهين وابعته تاني.\n\n\`${maskSensitive((error as Error).message).slice(0, 300)}\``);
    throw error;
  }
}

type Issue = NonNullable<IssueEvent['issue']>;
async function apply(issue: Issue, gh: GitHub, repo: string, reply: (b: string) => Promise<unknown>, close: (r: 'completed' | 'not_planned') => Promise<unknown>, refuse: (why: string) => Promise<void>) {
  void repo;
  const encoded = changeFromIssue(issue.body || '');
  const change = encoded ? await decodeChange(encoded) : undefined;
  if (!change) { await refuse('مش لاقي التعديل جوه الطلب (يمكن اتمسح أو اتغير وهو بيتلصق).'); return; }

  const plan = planChange(change.edits, (p) => (existsSync(p) ? readFileSync(p, 'utf8') : undefined));
  if (plan.problems.length) { await refuse(plan.problems.map((p) => `- ${p}`).join('\n')); return; }
  const controls = readControls(JSON.parse(readFileSync('src/data/owner/controls.json', 'utf8')));
  const verdict = changeVerdict(controls, plan);
  for (const f of plan.files) { mkdirSync(dirname(f.path), { recursive: true }); writeFileSync(f.path, f.after); }
  console.log(`Applied ${plan.files.length} file(s), ${plan.lines} line(s): ${plan.files.map((f) => f.path).join(', ')}`);

  for (const check of DESK_CHECKS) {
    console.log(`::group::${check}`);
    let output = '';
    let ok = true;
    try { output = sh(`${check} 2>&1`); } catch (e) { ok = false; output = String((e as { stdout?: string }).stdout || (e as Error).message); }
    // The test runner's own count is the judge (a failing test must never slip through).
    if (check === 'npm test' && !/^# fail 0$/m.test(output)) ok = false;
    console.log(output.slice(-20_000));
    console.log('::endgroup::');
    if (!ok) {
      git('checkout', '--', '.'); git('clean', '-fdq', '--', ...plan.files.filter((f) => f.before === undefined).map((f) => f.path));
      await refuse(`الفحص \`${check}\` وقع بعد التعديل، فرجّعت كل حاجة زي ما كانت. آخر سطور الفحص:\n\n\`\`\`\n${tail(output)}\n\`\`\``);
      return;
    }
  }

  // Everything passed: save it on main through a pull request (a direct push if the request route is closed).
  const title = `${issue.title.slice(CHANGE_TITLE_PREFIX.length).trim() || 'تعديل من غرفة شاهين'} (طلب صاحب الموقع #${issue.number})`;
  const branch = `owner-change/${issue.number}`;
  git('config', 'user.name', 'Owner desk');
  git('config', 'user.email', '41898282+github-actions[bot]@users.noreply.github.com');
  git('checkout', '-q', '-B', branch);
  git('add', '-A', '--', ...plan.files.map((f) => f.path));
  git('commit', '-q', '-m', `owner-room: ${title}`, '-m', `Proposed by Shaheen in the owner's private room, approved by ${OWNER.github} in #${issue.number}.`);
  let where = '';
  try {
    git('push', '-q', 'origin', `HEAD:refs/heads/${branch}`);
    const pr = await gh.createPull(branch, `owner-room: ${title}`, `تعديل من غرفة شاهين وافق عليه صاحب الموقع في #${issue.number}. عدّى: ${DESK_CHECKS.map((c) => `\`${c}\``).join('، ')}.`);
    const merged = await gh.mergePull(pr.number, `owner-room: ${title} (#${pr.number})`);
    await gh.deleteBranch(branch);
    where = `${pr.html_url} (${merged.sha.slice(0, 7)})`;
  } catch (error) {
    console.log(`::warning::PR route failed (${(error as Error).message.slice(0, 200)}) — pushing to main`);
    await gh.deleteBranch(branch);
    git('fetch', '-q', 'origin', 'main');
    git('rebase', '-q', 'origin/main');
    git('push', '-q', 'origin', 'HEAD:main');
    where = git('rev-parse', '--short', 'HEAD');
  }
  // Pushes made with the workflow token start no other workflow: rebuild the site ourselves.
  await gh.dispatch('pages.yml').catch(() => undefined);
  await reply([
    '✅ **التعديل اتنفذ وعدّى كل الفحوص.**', '',
    `**الملفات:** ${plan.files.map((f) => `\`${f.path}\``).join('، ')} (${plan.lines} سطر)`,
    `**الحكم:** ${verdict.reasonAr}`,
    `**اتحفظ في:** ${where}`, '',
    'الموقع الأساسي بيتحدث خلال حوالي 5 دقايق. لو حاجة مش عاجباك قول لشاهين في الغرفة يرجّعها.',
  ].join('\n'));
  await close('completed');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => { console.error(`::error title=Owner change::${(error as Error).message}`); process.exit(1); });
}
