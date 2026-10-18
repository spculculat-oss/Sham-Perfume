/**
 * The bridge between «مجلس شاهين» and the coding agent in the chat («نفذ مهام شاهين», see AGENTS.md):
 *   node --import tsx scripts/shaheen-council/tasks.mts          # open tasks, most urgent first
 *   node --import tsx scripts/shaheen-council/tasks.mts --all    # with finished/dropped ones
 * Reads the GitHub issues labelled «shaheen-task» (gh CLI); without gh it falls back to the latest
 * src/data/live/shaheen-council.json on main (or the local copy).
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { isCouncilFile, type Task } from './council';

const all = process.argv.includes('--all');
const order = { high: 0, medium: 1, low: 2 } as const;
type Issue = { number: number; title: string; url: string; state: string; labels: { name: string }[]; body: string };

let issues: Issue[] | undefined;
try {
  issues = JSON.parse(execFileSync('gh', ['issue', 'list', '--label', 'shaheen-task', '--state', all ? 'all' : 'open', '--limit', '100', '--json', 'number,title,url,state,labels,body'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })) as Issue[];
} catch { issues = undefined; }

if (issues) {
  const pri = (i: Issue) => order[(i.labels.find((l) => l.name.startsWith('priority-'))?.name.slice(9) || 'low') as keyof typeof order] ?? 2;
  issues.sort((a, b) => pri(a) - pri(b) || a.number - b.number);
  console.log(issues.length ? `${issues.length} Shaheen task(s):\n` : 'No open Shaheen tasks.');
  for (const i of issues) {
    const approval = i.labels.some((l) => l.name === 'needs-approval');
    console.log(`#${i.number} [${i.state.toLowerCase()}] ${approval ? '[NEEDS MERCHANT APPROVAL] ' : ''}${i.title}\n  ${i.url}\n${i.body.replace(/<!--[\s\S]*?-->/g, '').trim().split('\n').map((l) => `  ${l}`).join('\n')}\n`);
  }
} else {
  let text = '';
  try { text = await (await fetch(`https://raw.githubusercontent.com/spculculat-oss/Sham-Perfume/main/src/data/live/shaheen-council.json?t=${Date.now()}`, { signal: AbortSignal.timeout(15_000) })).text(); }
  catch { text = readFileSync(new URL('../../src/data/live/shaheen-council.json', import.meta.url), 'utf8'); }
  const file: unknown = JSON.parse(text);
  const tasks: Task[] = isCouncilFile(file) ? file.tasks.filter((t) => all || t.status === 'open') : [];
  tasks.sort((a, b) => order[a.priority] - order[b.priority]);
  console.log(tasks.length ? `${tasks.length} Shaheen task(s) (from the council file; gh not available):\n` : 'No open Shaheen tasks.');
  for (const t of tasks) console.log(`${t.issue ? `#${t.issue} ` : ''}[${t.status}] [${t.priority}] ${t.needsApproval ? '[NEEDS MERCHANT APPROVAL] ' : ''}${t.title}\n  ${t.detail.split('\n').join('\n  ')}\n`);
}
