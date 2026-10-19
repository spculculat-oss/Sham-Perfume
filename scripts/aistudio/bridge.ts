/**
 * «بوابة جوجل استوديو» — Google AI Studio gets its own repository (the studio, by default
 * spculculat-oss/Sham-Perfume-Studio) where it can push freely: no robots, no workflows, nothing that makes
 * its «Finalizing commit» step fail. This bridge (.github/workflows/aistudio-bridge.yml) brings the
 * merchant's real changes from there into the site:
 *
 *   1. what changed in the studio since the last import (its own history: base → head);
 *   2. the filter — robots' data, workflows, legal documents, build output, lock files, keys and card numbers
 *      never come in; server / scripts / tests / config changes wait for approval (an issue for the coding agent);
 *      deletions always wait for approval;
 *   3. each file is merged with the site's current version (three-way: a change made on an older copy does not
 *      undo newer work; overlapping edits are set aside, never forced);
 *   4. the result is checked (types, tests, Pages build) and published — or parked on a branch + issue.
 *
 * The first import (no base yet) only takes files whose studio content never existed on main (a file equal to an
 * older main version is a stale copy) and always waits for approval: AI Studio adapts some files to its runtime.
 * Pure logic here (tests/aistudioBridge.test.ts); the runner is bridge.mts.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { scanSecrets } from './review';

export const DEFAULT_STUDIO_REPO = 'spculculat-oss/Sham-Perfume-Studio';
/** Largest file the bridge carries (photos for the site are fine; videos and archives are not). */
export const MAX_FILE_BYTES = 5 * 1024 * 1024;

export type PathClass = 'auto' | 'review' | 'blocked';

/** Never imported: what the robots, the workflows, the legal manager and the build own. */
const BLOCKED: [RegExp, string][] = [
  [/^\.github\//, 'ملفات النشر والروبوتات (workflows) — بتتعدل من شات وكيل البرمجة بس'],
  [/^src\/data\/live\//, 'تقارير وبيانات الروبوتات — الروبوتات بس اللي بتكتبها'],
  [/^docs\//, 'المستندات القانونية والتصميم — المدير القانوني بس'],
  [/^src\/لغات\/ai\//, 'حزم المترجم الذكي — بيكتبها الروبوت'],
  [/^public\/(store-images|p)\//, 'صور ومنتجات الروبوتات'],
  [/^(pages-dist|dist|build|coverage|node_modules|\.data|\.vercel|\.edgeone)\//, 'نسخة مبنية أو ملفات مؤقتة'],
  [/^(bun\.lock|bun\.lockb|package-lock\.json|yarn\.lock|pnpm-lock\.yaml)$/, 'ملف قفل المكتبات — بيتعمل من package.json'],
  [/^\.env(?!\.example$)/, 'ملف إعدادات سرية'],
  [/^metadata\.json$/, 'ملف إعدادات جوجل استوديو نفسه (مش جزء من الموقع)'],
  [/(^|\/)\.DS_Store$|\.log$/, 'ملف مؤقت'],
];

/** Imported only after approval: the engine, the robots' code, the checks and the build setup. */
const REVIEW: [RegExp, string][] = [
  [/^(server|api|cloud-functions|scripts|tests)\//, 'كود السيرفر أو الروبوتات أو الاختبارات'],
  [/^src\/(admin|community|updates|contracts)\//, 'لوحة الإدارة أو المجتمع أو التعاقدات'],
  [/^(package\.json|vite\.config\.[a-z]+|tsconfig[^/]*\.json|vercel\.json|index\.html|server\.ts|\.gitignore|\.nvmrc|AGENTS\.md)$/, 'إعدادات البناء والتشغيل (جوجل استوديو بيغيّرها علشان بيئته)'],
];

export function classifyPath(path: string): { cls: PathClass; reason?: string } {
  if (!path || path.startsWith('/') || path.split('/').includes('..')) return { cls: 'blocked', reason: 'مسار غير صالح' };
  for (const [re, reason] of BLOCKED) if (re.test(path)) return { cls: 'blocked', reason };
  for (const [re, reason] of REVIEW) if (re.test(path)) return { cls: 'review', reason };
  // The site itself: pages, components, texts, styles, photos.
  if (/^(src|public)\//.test(path)) return { cls: 'auto' };
  return { cls: 'review', reason: 'ملف برّه كود الموقع' };
}

export interface PlannedFile {
  path: string;
  action: 'write' | 'delete';
  /** How it was decided: the studio's version as is, merged with newer site work, or a new file. */
  how: 'studio' | 'merged' | 'new' | 'delete';
  cls: Exclude<PathClass, 'blocked'>;
  reason?: string;
  /** The file to write (write only). */
  content?: Buffer;
}
export interface SkippedFile { path: string; reason: string }
export interface Plan {
  mode: 'first' | 'update';
  base?: string;
  head: string;
  files: PlannedFile[];
  skipped: SkippedFile[];
  /** The studio commits this import covers (newest first, at most 20). */
  commits: { sha: string; subject: string }[];
  /** 'auto' = can go live after the checks; 'review' = waits for approval; 'none' = nothing to bring. */
  verdict: 'auto' | 'review' | 'none';
}

type Run = (args: string[], input?: Buffer) => Buffer;
/** git in a working directory; returns raw bytes (files may be photos). */
export const gitBytes = (cwd: string): Run => (args) => execFileSync('git', args, { cwd, maxBuffer: 256 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
const text = (b: Buffer) => b.toString('utf8');
const tryRun = (run: Run, args: string[]): Buffer | undefined => { try { return run(args); } catch { return undefined; } };

export const isBinary = (b: Buffer) => b.subarray(0, 8000).includes(0);
/** A file's bytes at a commit (undefined when it does not exist there). */
export const blobAt = (run: Run, ref: string, path: string) => tryRun(run, ['show', `${ref}:${path}`]);
const blobId = (run: Run, ref: string, path: string) => { const b = tryRun(run, ['rev-parse', '--verify', '--quiet', `${ref}:${path}`]); return b ? text(b).trim() : undefined; };

/** Changed paths between two commits (no rename detection: a rename is a delete + a new file). */
export function changedPaths(run: Run, from: string, to: string): { status: string; path: string }[] {
  return text(run(['diff', '--no-renames', '--name-status', '-z', from, to])).split('\0').filter(Boolean)
    .reduce<{ status: string; path: string }[]>((out, part, i, all) => { if (i % 2 === 0) out.push({ status: part[0], path: all[i + 1] }); return out; }, [])
    .filter((c) => c.path);
}

/** Every version a file ever had on main (blob ids), to recognise a stale copy. */
function mainVersions(run: Run, main: string, path: string): Set<string> {
  const raw = tryRun(run, ['log', '--format=', '--raw', '--no-abbrev', '--no-renames', '-n', '400', main, '--', path]);
  const ids = new Set<string>();
  for (const line of raw ? text(raw).split('\n') : []) { const m = line.match(/^:\d+ \d+ ([0-9a-f]+) ([0-9a-f]+) /); if (m) { ids.add(m[1]); ids.add(m[2]); } }
  return ids;
}

/** Three-way merge of one text file (git merge-file): the merged text, or undefined on overlapping edits. */
export function mergeText(ours: string, base: string, theirs: string): string | undefined {
  const dir = mkdtempSync(join(tmpdir(), 'bridge-'));
  try {
    const [o, b, t] = ['ours', 'base', 'theirs'].map((n) => join(dir, n));
    writeFileSync(o, ours); writeFileSync(b, base); writeFileSync(t, theirs);
    try { return execFileSync('git', ['merge-file', '-p', o, b, t], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] }); } catch { return undefined; }
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

/** Keys or real card numbers the studio added to a text file. */
function secretsAdded(path: string, before: string, after: string): string | undefined {
  const old = new Set(before.split('\n'));
  const flags = scanSecrets(after.split('\n').filter((l) => !old.has(l)).map((line) => ({ file: path, line })));
  const bad = flags.find((f) => f.level === 'high');
  return bad ? `فيه ${bad.kind === 'card' ? 'رقم بطاقة حقيقي' : 'مفتاح سري'} — اتشال ومش هيتنشر` : undefined;
}

/**
 * The import plan: what comes from the studio (head) into the site (main), and why the rest does not.
 * `base` = the studio commit imported last time (absent = first import).
 */
export function planImport(run: Run, opts: { head: string; base?: string; main?: string }): Plan {
  const main = opts.main || 'HEAD';
  const head = text(run(['rev-parse', opts.head])).trim();
  // A rewritten studio history (force push) has no usable base: treated as a first import.
  const base = opts.base && tryRun(run, ['merge-base', '--is-ancestor', opts.base, head]) !== undefined ? opts.base : undefined;
  const mode: Plan['mode'] = base ? 'update' : 'first';
  const files: PlannedFile[] = [];
  const skipped: SkippedFile[] = [];
  const commits = text(run(['log', '--format=%H%x1f%s', '-n', '20', ...(base ? [`${base}..${head}`] : [head])])).split('\n').filter(Boolean)
    .map((l) => { const [sha, subject] = l.split('\x1f'); return { sha, subject }; });

  const changes = base ? changedPaths(run, base, head) : changedPaths(run, main, head).filter((c) => c.status !== 'D');
  for (const { status, path } of changes) {
    const where = classifyPath(path);
    if (where.cls === 'blocked') { skipped.push({ path, reason: where.reason! }); continue; }
    const cls = where.cls;
    const theirs = blobAt(run, head, path);
    const ours = blobAt(run, main, path);

    if (status === 'D' || !theirs) {
      if (!ours) continue; // already gone from the site
      const before = base ? blobAt(run, base, path) : undefined;
      if (before && !ours.equals(before)) { skipped.push({ path, reason: 'اتمسح في جوجل استوديو، بس الموقع عدّله بعد كده — مش هيتمسح' }); continue; }
      files.push({ path, action: 'delete', how: 'delete', cls: 'review', reason: 'مسح ملف — محتاج موافقة' });
      continue;
    }
    if (theirs.length > MAX_FILE_BYTES) { skipped.push({ path, reason: `ملف كبير (${(theirs.length / 1048576).toFixed(1)} ميجا) — الحد ${MAX_FILE_BYTES / 1048576} ميجا` }); continue; }
    if (ours?.equals(theirs)) continue; // the site already has it

    const binary = isBinary(theirs) || (ours ? isBinary(ours) : false);
    if (!binary) {
      const secret = secretsAdded(path, ours ? text(ours) : '', text(theirs));
      if (secret) { skipped.push({ path, reason: secret }); continue; }
    }

    if (!base) {
      // First import: a copy equal to an older site version is stale; anything else waits for approval.
      const id = blobId(run, head, path);
      if (ours && id && mainVersions(run, main, path).has(id)) { skipped.push({ path, reason: 'نسخة قديمة من الملف (الموقع عنده أحدث)' }); continue; }
      files.push({ path, action: 'write', how: ours ? 'studio' : 'new', cls: 'review', reason: 'أول استيراد — محتاج موافقة', content: theirs });
      continue;
    }

    const before = blobAt(run, base, path);
    if (!ours || (before && ours.equals(before))) {
      // The site did not touch it since: the studio's version as is.
      files.push({ path, action: 'write', how: ours ? 'studio' : 'new', cls, ...(where.reason ? { reason: where.reason } : {}), content: theirs });
      continue;
    }
    if (binary || !before) { skipped.push({ path, reason: 'الموقع والاستوديو الاتنين غيّروا الملف ده — محتاج دمج يدوي' }); continue; }
    const merged = mergeText(text(ours), text(before), text(theirs));
    if (merged === undefined) { skipped.push({ path, reason: 'تعديل جوجل استوديو بيتعارض مع تعديل أحدث في الموقع — اتساب علشان ما يمسحش شغل' }); continue; }
    if (merged === text(ours)) continue;
    files.push({ path, action: 'write', how: 'merged', cls, ...(where.reason ? { reason: where.reason } : {}), content: Buffer.from(merged) });
  }

  const verdict: Plan['verdict'] = !files.length ? 'none' : files.some((f) => f.cls === 'review') ? 'review' : 'auto';
  return { mode, ...(base ? { base } : {}), head, files, skipped, commits, verdict };
}

// ── the report (src/data/live/aistudio-bridge.json, admin → «بيئة التحديثات») ──────────────────────────────

export type BridgeStatus = 'waiting_repo' | 'idle' | 'published' | 'review' | 'failed';
export interface BridgeRun {
  at: string;
  studioSha: string;
  mode: Plan['mode'];
  result: 'published' | 'review' | 'failed' | 'nothing' | 'rehearsal';
  commits: { sha: string; subject: string }[];
  files: { path: string; how: PlannedFile['how']; cls: PlannedFile['cls']; reason?: string }[];
  skipped: SkippedFile[];
  checks?: Record<string, string>;
  mainSha?: string;
  branch?: string;
  issue?: number;
}
export interface BridgeFile {
  version: 1;
  updatedAt: string;
  repo: string;
  status: BridgeStatus;
  /** Why the bridge is waiting / failing, in plain Arabic. */
  note?: string;
  lastStudioSha?: string;
  runs: BridgeRun[];
}

export const emptyBridge = (repo = DEFAULT_STUDIO_REPO): BridgeFile => ({ version: 1, updatedAt: new Date(0).toISOString(), repo, status: 'waiting_repo', runs: [] });

/** The report after one run (newest run first, 30 kept). */
export function recordRun(file: BridgeFile, run: BridgeRun | undefined, status: BridgeStatus, opts: { repo: string; note?: string; lastStudioSha?: string; now?: Date }): BridgeFile {
  const runs = run ? [run, ...file.runs.filter((r) => r.studioSha !== run.studioSha || r.result !== run.result)].slice(0, 30) : file.runs;
  return {
    version: 1, updatedAt: (opts.now || new Date()).toISOString(), repo: opts.repo, status,
    ...(opts.note ? { note: opts.note } : {}),
    ...(opts.lastStudioSha ?? file.lastStudioSha ? { lastStudioSha: opts.lastStudioSha ?? file.lastStudioSha } : {}),
    runs,
  };
}

/** The report entry for a plan (file contents are never stored). */
export function runOf(plan: Plan, result: BridgeRun['result'], extra: Partial<BridgeRun> = {}, now = new Date()): BridgeRun {
  return {
    at: now.toISOString(), studioSha: plan.head, mode: plan.mode, result, commits: plan.commits,
    files: plan.files.map(({ path, how, cls, reason }) => ({ path, how, cls, ...(reason ? { reason } : {}) })),
    skipped: plan.skipped, ...extra,
  };
}

/** The issue the coding agent picks up («نفذ مهام شاهين») when an import waits for approval or failed its checks. */
export function issueFor(plan: Plan, opts: { repo: string; branch: string; checksFailed: string[]; siteRepo: string }): { title: string; body: string; labels: string[] } {
  const first = plan.commits[0]?.subject || plan.head.slice(0, 7);
  const lines = [
    `تحديث من جوجل استوديو (${opts.repo}@${plan.head.slice(0, 7)}) ${opts.checksFailed.length ? 'كسر فحوص الموقع' : 'محتاج موافقة قبل النشر'}.`,
    '',
    `- الفرع الجاهز: \`${opts.branch}\` — https://github.com/${opts.siteRepo}/compare/main...${encodeURIComponent(opts.branch)}`,
    ...(opts.checksFailed.length ? [`- الفحوص اللي فشلت: ${opts.checksFailed.join('، ')}`] : []),
    '',
    '**الملفات:**',
    ...plan.files.map((f) => `- \`${f.path}\` — ${f.action === 'delete' ? 'مسح' : f.how === 'merged' ? 'اتدمج مع شغل أحدث في الموقع' : f.how === 'new' ? 'ملف جديد' : 'نسخة الاستوديو'}${f.reason ? ` (${f.reason})` : ''}`),
    ...(plan.skipped.length ? ['', '**اتساب (مش هيدخل الموقع):**', ...plan.skipped.slice(0, 30).map((s) => `- \`${s.path}\` — ${s.reason}`)] : []),
    '',
    '**تعديلات جوجل استوديو:**',
    ...plan.commits.slice(0, 10).map((c) => `- ${c.sha.slice(0, 7)} ${c.subject}`),
    '',
    '---',
    '- للتنفيذ: افتح شات وكيل البرمجة واكتب «نفذ مهام شاهين». راجع الفرق، ادمج الفرع في فرع الجلسة، وافتح طلب دمج (AGENTS.md).',
    '- من «بوابة جوجل استوديو» (scripts/aistudio/bridge.ts).',
  ];
  return { title: `تحديث من جوجل استوديو: ${first.slice(0, 80)}`, body: lines.join('\n'), labels: ['shaheen-task', 'aistudio', ...(opts.checksFailed.length ? [] : ['needs-approval'])] };
}
