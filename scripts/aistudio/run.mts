/**
 * «استقبال تحديثات AI Studio» runner (.github/workflows/aistudio-intake.yml).
 *   node --import tsx scripts/aistudio/run.mts detect   → writes pending=<n> to $GITHUB_OUTPUT
 *   node --import tsx scripts/aistudio/run.mts review   → reviews them, writes src/data/live/aistudio-intake.json
 * Env: INTAKE_REF (commit the checks belong to, default HEAD), AISTUDIO_AUTHORS (comma list, default the owner's e-mail), CHECK_LINT / CHECK_TEST / CHECK_BUILD /
 * CHECK_PAGES (success|failure|skipped|pending), AISTUDIO_INTAKE_FILE (tests).
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import {
  DEFAULT_AUTHORS, authorsFrom, emptyIntake, gitIn, mergeIntake, pendingCommits, reviewCommit,
  type CheckState, type IntakeFile,
} from './review';

const FILE = process.env.AISTUDIO_INTAKE_FILE || 'src/data/live/aistudio-intake.json';
const authors = authorsFrom(process.env.AISTUDIO_AUTHORS).length ? authorsFrom(process.env.AISTUDIO_AUTHORS) : DEFAULT_AUTHORS;
const git = gitIn(process.cwd());
const mode = process.argv[2] || 'review';

const load = (): IntakeFile => {
  if (!existsSync(FILE)) return emptyIntake(authors);
  try { return { ...emptyIntake(authors), ...JSON.parse(readFileSync(FILE, 'utf8')) }; } catch { return emptyIntake(authors); }
};
const state = load();
// The version the checks belong to (the Pages run's commit); later commits get their own run.
const ref = process.env.INTAKE_REF || 'HEAD';
const pending = pendingCommits(git, state, authors, Date.now(), 14, ref);
const out = (line: string) => { if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `${line}\n`); };

if (mode === 'detect') {
  console.log(`AI Studio updates waiting for review: ${pending.length}`);
  for (const c of pending) console.log(`  ${c.sha.slice(0, 7)} ${c.date} ${c.subject}`);
  out(`pending=${pending.length}`);
  process.exit(0);
}

const check = (v?: string): CheckState => (['success', 'failure', 'skipped', 'pending'].includes(v || '') ? v as CheckState : 'skipped');
const checks = { lint: check(process.env.CHECK_LINT), test: check(process.env.CHECK_TEST), build: check(process.env.CHECK_BUILD), pages: check(process.env.CHECK_PAGES) };
const reviews = pending.map((c) => reviewCommit(git, c));
const head = git('rev-parse', ref).trim();
const next = mergeIntake(state, reviews, checks, head);
mkdirSync(dirname(FILE), { recursive: true });
writeFileSync(FILE, `${JSON.stringify(next, null, 1)}\n`);

// ── report (job summary + at most 10 annotations, the GitHub limit per step) ──
const fresh = next.commits.filter((c) => reviews.some((r) => r.sha === c.sha));
const VERDICT = { received: '✅ اتستلم', attention: '⚠️ محتاج مراجعة', broken: '❌ كسر الموقع' } as const;
const CHECK = { success: '✅', failure: '❌', skipped: '—', pending: '⏳' } as const;
const lines = [
  '## استقبال تحديثات AI Studio', '',
  `الفحص: ${CHECK[checks.lint]} الأنواع · ${CHECK[checks.test]} الاختبارات · ${CHECK[checks.build]} البناء · ${CHECK[checks.pages]} النشر على GitHub Pages`, '',
  fresh.length ? '| التحديث | النتيجة | الملفات | ملاحظات |' : 'مفيش تحديثات جديدة من AI Studio.',
  ...(fresh.length ? ['|---|---|---|---|'] : []),
  ...fresh.map((c) => `| \`${c.sha.slice(0, 7)}\` ${c.title.replace(/\|/g, '/')} | ${VERDICT[c.verdict]} | ${c.files} (+${c.additions} −${c.deletions}) | ${c.flags.filter((f) => f.level !== 'info').map((f) => `${f.file ? `\`${f.file}\`: ` : ''}${f.text}`).join('<br>').replace(/\|/g, '/') || '—'} |`),
];
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${lines.join('\n')}\n`);
console.log(lines.join('\n'));

let annotations = 0;
const annotate = (kind: 'error' | 'warning' | 'notice', title: string, text: string) => { if (annotations++ < 10) console.log(`::${kind} title=${title.replace(/[\n:,]/g, ' ')}::${text.replace(/\n/g, ' ')}`); };
for (const c of fresh) {
  const serious = c.flags.filter((f) => f.level === 'high' || f.level === 'medium');
  if (c.verdict === 'received' && !serious.length) annotate('notice', `AI Studio ${c.sha.slice(0, 7)}`, `${VERDICT[c.verdict]} — ${c.title}`);
  else for (const f of serious) annotate(f.level === 'high' ? 'error' : 'warning', `AI Studio ${c.sha.slice(0, 7)}`, `${f.file ? `${f.file}: ` : ''}${f.text}`);
}
if (checks.lint === 'failure' || checks.test === 'failure' || checks.build === 'failure') annotate('error', 'AI Studio intake', 'آخر تحديث كسر فحص الموقع (الأنواع أو الاختبارات أو البناء) — شوف خطوات الفحص في نفس التشغيل');
if (checks.pages === 'failure') annotate('error', 'AI Studio intake', 'النشر على GitHub Pages فشل لآخر نسخة');

// Red when something needs the owner: GitHub e-mails him, and the admin panel shows it too.
process.exitCode = fresh.some((c) => c.verdict !== 'received') || checks.pages === 'failure' ? 1 : 0;
