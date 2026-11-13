/**
 * «استقبال تحديثات AI Studio» — every change made in Google AI Studio reaches main as a commit by the owner
 * (author = committer = the owner's e-mail, one parent, not a merge). This reviews each new one before it is
 * counted as received: did it put back an older copy of a file (silently undoing newer work), delete important
 * files, leak a key or a real card number, add very heavy images or new libraries? The whole site is then
 * checked (types, tests, build) and the GitHub Pages deploy of that version is confirmed.
 * Results: src/data/live/aistudio-intake.json → admin «بيئة التحديثات». Run: scripts/aistudio/run.mts.
 */
import { execFileSync } from 'node:child_process';

export type Level = 'high' | 'medium' | 'low' | 'info';
export interface Flag { level: Level; kind: string; text: string; file?: string }
export type Verdict = 'received' | 'attention' | 'broken';
export type CheckState = 'success' | 'failure' | 'skipped' | 'pending';

export interface CommitMeta {
  sha: string; parents: string[]; authorName: string; authorEmail: string; committerEmail: string;
  date: string; subject: string; body: string;
}
export interface FileChange { path: string; status: string; additions: number; deletions: number; binary: boolean; from?: string }
export interface CommitReview {
  sha: string; date: string; title: string; summary: string;
  files: number; additions: number; deletions: number;
  added: string[]; deleted: string[]; modified: number;
  flags: Flag[]; verdict: Verdict;
}
export interface IntakeFile {
  updatedAt: string;
  head?: string;
  authors: string[];
  checks: { lint: CheckState; test: CheckState; build: CheckState; pages: CheckState; at?: string; sha?: string };
  commits: CommitReview[];
  reviewed: string[];
}

export const DEFAULT_AUTHORS = ['s.p.culculat@gmail.com'];
/** Paths whose deletion breaks the server, the bots or the safety net. */
const PROTECTED = /^(server\/|\.github\/|scripts\/|tests\/|docs\/legal\/|src\/community\/|src\/admin\/|src\/updates\/|vercel\.json$|package\.json$|bun\.lock$|index\.html$|vite\.config\.)/;
/** Public payment test cards (Stripe, Kashier, Visa/Mastercard docs) — fine to appear in code. */
const TEST_CARDS = new Set(['4242424242424242', '4000056655665556', '5555555555554444', '4111111111111111', '4012000033330026', '5123450000000008',
  '4508750015741019', '378282246310005', '6011111111111117', '5200828282828210', '4000000000000002', '4012888888881881']);

export const authorsFrom = (value?: string) => (value || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);

/** A change made in AI Studio: the owner is both author and committer, one parent (merges and bots excluded). */
export function isAiStudioCommit(c: CommitMeta, authors: string[]): boolean {
  const a = c.authorEmail.toLowerCase();
  return c.parents.length === 1 && authors.includes(a) && c.committerEmail.toLowerCase() === a;
}

export function luhn(digits: string): boolean {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let d = Number(digits[digits.length - 1 - i]);
    if (i % 2) { d *= 2; if (d > 9) d -= 9; }
    sum += d;
  }
  return sum % 10 === 0;
}

const mask = (s: string) => `${s.slice(0, 4)}…${s.slice(-2)}`;

/** Keys, tokens and real card numbers in added lines. Never returns the secret itself (masked). */
export function scanSecrets(addedLines: { file: string; line: string }[]): Flag[] {
  const flags: Flag[] = [];
  const patterns: [RegExp, string][] = [
    [/AIza[0-9A-Za-z_-]{35}/, 'مفتاح Google (Gemini / AI Studio)'],
    [/\bsk-(?:proj-|ant-)?[A-Za-z0-9_-]{24,}/, 'مفتاح ذكاء اصطناعي (OpenAI / Anthropic / DeepSeek)'],
    [/\bgh[pousr]_[A-Za-z0-9]{36}\b/, 'رمز GitHub'],
    [/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/, 'مفتاح خاص'],
    [/\bxox[baprs]-[A-Za-z0-9-]{10,}/, 'رمز Slack'],
    [/\bpostgres(?:ql)?:\/\/[^:\s'"]+:[^@\s'"]{6,}@/, 'رابط قاعدة بيانات بكلمة سر'],
  ];
  for (const { file, line } of addedLines) {
    if (/\.(lock|svg|map)$|(^|\/)bun\.lock$/.test(file)) continue;
    for (const [re, label] of patterns) {
      const m = line.match(re);
      if (m) flags.push({ level: 'high', kind: 'secret', file, text: `${label} مكتوب في الكود (${mask(m[0])}) — لازم يتشال ويتغيّر فوراً` });
    }
    for (const m of line.matchAll(/(?<![\d.])(?:\d[ -]?){12,18}\d(?![\d.])/g)) {
      const digits = m[0].replace(/[ -]/g, '');
      if (digits.length < 13 || digits.length > 19 || !/^[3-6]/.test(digits) || TEST_CARDS.has(digits) || /^(\d)\1+$/.test(digits) || !luhn(digits)) continue;
      flags.push(/^tests\/|\.test\.|__tests__/.test(file)
        ? { level: 'low', kind: 'card', file, text: `رقم شكله بطاقة في ملف اختبار (${mask(digits)}) — غالباً رقم تجريبي، الأفضل يكون من أرقام الاختبار المعروفة` }
        : { level: 'high', kind: 'card', file, text: `رقم بطاقة حقيقي شكله مكتوب في الكود (${mask(digits)}) — أرقام البطاقات مكانها بوابة الدفع بس` });
    }
  }
  return dedupe(flags);
}

function dedupe(flags: Flag[]): Flag[] {
  const seen = new Set<string>();
  return flags.filter((f) => { const k = `${f.kind}|${f.file}|${f.text}`; if (seen.has(k)) return false; seen.add(k); return true; });
}

/** Dependencies added or removed between two package.json texts. */
export function dependencyChanges(before: string, after: string): { added: string[]; removed: string[] } {
  const deps = (t: string) => { try { const p = JSON.parse(t); return { ...(p.dependencies || {}), ...(p.devDependencies || {}) } as Record<string, string>; } catch { return {}; } };
  const a = deps(before); const b = deps(after);
  return { added: Object.keys(b).filter((k) => !(k in a)).sort(), removed: Object.keys(a).filter((k) => !(k in b)).sort() };
}

export function verdictOf(flags: Flag[], checksFailed: boolean): Verdict {
  if (checksFailed) return 'broken';
  return flags.some((f) => f.level === 'high') ? 'attention' : 'received';
}

// ───────────────────────── git ─────────────────────────

export type Git = (...args: string[]) => string;
export const gitIn = (cwd: string): Git => (...args) => execFileSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
const tryGit = (git: Git, ...args: string[]) => { try { return git(...args).trim(); } catch { return ''; } };

const SEP = '\x1f'; const END = '\x1e';
export function listCommits(git: Git, ref = 'HEAD', max = 300): CommitMeta[] {
  const out = tryGit(git, 'log', `-n${max}`, `--format=%H${SEP}%P${SEP}%an${SEP}%ae${SEP}%ce${SEP}%cI${SEP}%s${SEP}%b${END}`, ref);
  return out.split(END).map((r) => r.replace(/^\n/, '')).filter(Boolean).map((r) => {
    const [sha, parents, authorName, authorEmail, committerEmail, date, subject, body] = r.split(SEP);
    return { sha, parents: parents ? parents.split(' ') : [], authorName, authorEmail, committerEmail, date, subject, body: (body || '').trim() };
  });
}

export function fileChanges(git: Git, sha: string): FileChange[] {
  // -z: paths are NUL-separated and never quoted; a rename is «status\0old\0new» / «a\td\t\0old\0new».
  const status = tryGit(git, 'diff-tree', '--no-commit-id', '-r', '-M', '-z', '--name-status', sha).split('\0');
  const numstat = tryGit(git, 'diff-tree', '--no-commit-id', '-r', '-M', '-z', '--numstat', sha).split('\0');
  const nums = new Map<string, { a: number; d: number; bin: boolean }>();
  for (let i = 0; i < numstat.length; i++) {
    const m = numstat[i].match(/^(-|\d+)\t(-|\d+)\t(.*)$/);
    if (!m) continue;
    let path = m[3];
    if (!path) { path = numstat[i + 2]; i += 2; } // rename: old, new follow
    nums.set(path, { a: Number(m[1]) || 0, d: Number(m[2]) || 0, bin: m[1] === '-' });
  }
  const out: FileChange[] = [];
  for (let i = 0; i < status.length; i++) {
    const code = status[i];
    if (!/^[ACDMRTU]\d*$/.test(code)) continue;
    const s = code[0];
    let path = status[++i]; let from: string | undefined;
    if (s === 'R' || s === 'C') { from = path; path = status[++i]; }
    const n = nums.get(path) || { a: 0, d: 0, bin: false };
    out.push({ path, status: s, additions: n.a, deletions: n.d, binary: n.bin, from });
  }
  return out;
}

/**
 * The file now holds exactly the content it had at an older commit, although newer commits changed it in
 * between: the change was made on a stale copy and silently undid those newer commits.
 */
export function revertedTo(git: Git, sha: string, path: string, depth = 40): { from: string; lost: { sha: string; subject: string }[] } | undefined {
  const blob = tryGit(git, 'rev-parse', `${sha}:${path}`);
  if (!blob) return undefined;
  const history = tryGit(git, 'log', `-n${depth}`, '--format=%H%x1f%s', `${sha}^`, '--', path).split('\n').filter(Boolean).map((l) => { const [h, s] = l.split('\x1f'); return { sha: h, subject: s }; });
  // history[0] is the version this commit changed; an older entry with the same content means a revert.
  for (let i = 1; i < history.length; i++) {
    if (tryGit(git, 'rev-parse', `${history[i].sha}:${path}`) === blob) return { from: history[i].sha, lost: history.slice(0, i) };
  }
  return undefined;
}

function addedLines(git: Git, sha: string): { file: string; line: string }[] {
  const patch = tryGit(git, 'show', '--format=', '--unified=0', '--no-color', '--no-ext-diff', sha);
  const out: { file: string; line: string }[] = [];
  let file = '';
  for (const l of patch.split('\n')) {
    if (l.startsWith('+++ ')) file = l.replace(/^\+\+\+ (b\/)?/, '');
    else if (l.startsWith('+') && !l.startsWith('+++')) out.push({ file, line: l.slice(1) });
  }
  return out;
}

// docs/ holds only the hand-written legal and design documents now (the Pages build went to pages-dist/).
const isGenerated = (p: string) => /^(docs\/(?!legal\/|design\/)|pages-dist\/|src\/data\/live\/|public\/p\/)/.test(p);

/** Everything the intake checks in one AI Studio commit (the whole-site checks come separately). */
export function reviewCommit(git: Git, c: CommitMeta): Omit<CommitReview, 'verdict'> {
  const changes = fileChanges(git, c.sha);
  const flags: Flag[] = [];
  const isBot = (s: string) => /bot:|شاهين:|نشرة|مستورد|مشرف|تدقيق/.test(s);

  for (const f of changes) {
    if (f.status === 'D') {
      flags.push(PROTECTED.test(f.path)
        ? { level: 'high', kind: 'deleted', file: f.path, text: 'اتمسح ملف أساسي (السيرفر أو الإدارة أو المجتمع أو الفحوصات)' }
        : { level: 'medium', kind: 'deleted', file: f.path, text: 'اتمسح ملف' });
      continue;
    }
    if (f.status === 'M' && !f.binary && !isGenerated(f.path)) {
      const r = revertedTo(git, c.sha, f.path);
      if (r) {
        const lost = r.lost.filter((x) => !isBot(x.subject)).map((x) => `${x.sha.slice(0, 7)} «${x.subject.slice(0, 60)}»`);
        flags.push({ level: lost.length ? 'high' : 'medium', kind: 'reverted', file: f.path,
          text: `الملف رجع لنسخة قديمة (${r.from.slice(0, 7)})${lost.length ? ` ولغى تعديلات أحدث: ${lost.slice(0, 3).join('، ')}` : ''}` });
        continue;
      }
      if (f.deletions >= 150 && f.deletions > 3 * f.additions) {
        const before = Number(tryGit(git, 'cat-file', '-s', `${c.sha}^:${f.path}`)) || 0;
        const linesBefore = before ? tryGit(git, 'show', `${c.sha}^:${f.path}`).split('\n').length : 0;
        if (linesBefore && f.deletions / linesBefore > 0.5) flags.push({ level: 'medium', kind: 'shrunk', file: f.path, text: `اتشال أكتر من نص الملف (${f.deletions} سطر) — اتأكد إن ده مقصود` });
      }
    }
    if ((f.status === 'A' || f.status === 'M') && f.binary) {
      const size = Number(tryGit(git, 'cat-file', '-s', `${c.sha}:${f.path}`)) || 0;
      if (size > 400 * 1024) flags.push({ level: 'low', kind: 'heavy', file: f.path, text: `صورة/ملف تقيل ${(size / 1024 / 1024).toFixed(1)} ميجا — بيبطّأ الموقع على الموبايل` });
    }
  }

  flags.push(...scanSecrets(addedLines(git, c.sha)));

  if (changes.some((f) => f.path === 'package.json')) {
    const d = dependencyChanges(tryGit(git, 'show', `${c.sha}^:package.json`), tryGit(git, 'show', `${c.sha}:package.json`));
    if (d.added.length) flags.push({ level: 'info', kind: 'dependency', text: `مكتبات جديدة: ${d.added.join('، ')}` });
    if (d.removed.length) flags.push({ level: 'medium', kind: 'dependency', text: `مكتبات اتشالت: ${d.removed.join('، ')}` });
  }
  const tests = changes.filter((f) => /^tests\/.*\.test\./.test(f.path) && f.status !== 'D');
  if (tests.length) flags.push({ level: 'info', kind: 'tests', text: `ضاف/حدّث ${tests.length} ملف اختبارات` });

  const real = changes.filter((f) => !isGenerated(f.path));
  return {
    sha: c.sha, date: c.date, title: c.subject.slice(0, 160), summary: c.body.split('\n')[0].slice(0, 300),
    files: real.length,
    additions: real.reduce((n, f) => n + f.additions, 0), deletions: real.reduce((n, f) => n + f.deletions, 0),
    added: real.filter((f) => f.status === 'A').map((f) => f.path).slice(0, 12),
    deleted: real.filter((f) => f.status === 'D').map((f) => f.path).slice(0, 12),
    modified: real.filter((f) => f.status === 'M' || f.status === 'R').length,
    flags: dedupe(flags),
  };
}

/** New AI Studio commits (oldest first) not reviewed yet; the first run looks back `backfillDays`. */
export function pendingCommits(git: Git, state: IntakeFile, authors: string[], now = Date.now(), backfillDays = 14, ref = 'HEAD'): CommitMeta[] {
  const seen = new Set(state.reviewed);
  const since = state.reviewed.length ? 0 : now - backfillDays * 86_400_000;
  return listCommits(git, ref).filter((c) => isAiStudioCommit(c, authors) && !seen.has(c.sha) && Date.parse(c.date) >= since).reverse();
}

export const emptyIntake = (authors: string[]): IntakeFile => ({
  updatedAt: new Date(0).toISOString(), authors, checks: { lint: 'skipped', test: 'skipped', build: 'skipped', pages: 'skipped' }, commits: [], reviewed: [],
});

/** Folds this run into the state: new reviews first (newest on top), whole-site checks applied to the batch. */
export function mergeIntake(state: IntakeFile, reviews: Omit<CommitReview, 'verdict'>[], checks: IntakeFile['checks'], head: string, now = new Date()): IntakeFile {
  const failed = [checks.lint, checks.test, checks.build].includes('failure');
  const fresh = reviews.map((r) => ({ ...r, verdict: verdictOf(r.flags, failed) }));
  const commits = [...fresh.reverse(), ...state.commits.filter((c) => !reviews.some((r) => r.sha === c.sha))].slice(0, 60);
  return {
    ...state, updatedAt: now.toISOString(), head, checks: { ...checks, at: now.toISOString(), sha: head }, commits,
    reviewed: [...new Set([...reviews.map((r) => r.sha), ...state.reviewed])].slice(0, 400),
  };
}
