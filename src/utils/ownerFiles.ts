/**
 * «شاهين يشوف كل الملفات ويعدّل بموافقة صاحب الموقع» — the owner's choice (2026-10-21):
 *   - in the private room Shaheen can read every file of the site (the repository is public; keys and codes are never
 *     in it, so he never sees a secret);
 *   - he may propose changes; nothing is changed until the owner presses the button in his suite. That button opens a
 *     request on GitHub from the owner's own account (GitHub proves it is him), the owner's desk applies it, runs every
 *     check and only then puts it live. Big or sensitive changes are marked so on the card before he presses.
 *   - a few places stay out of Shaheen's reach whatever he proposes: the robots' workflows, the owner's own switches
 *     and these very rules, the legal manager's decisions, the robots' data, keys and lock files.
 * Shared by the browser (src/admin/OwnerRoom.tsx), the server prompt (server/ownerRoom.ts) and the desk that applies
 * the change (scripts/owner/apply-change.mts).
 */
import { maskSensitive, selfDevVerdict, type OwnerControls, type SelfDevVerdict } from './ownerAuthority';

export const SITE_REPO = 'spculculat-oss/Sham-Perfume';
export const SITE_BRANCH = 'main';
/** Every change request from the room starts with this, so the owner's desk knows it (and nothing else) is one. */
export const CHANGE_TITLE_PREFIX = '[شاهين] ';
export const FILE_LIMITS = { perFile: 16_000, total: 48_000, files: 3, index: 12_000, reads: 2 } as const;
export const CHANGE_LIMITS = { files: 8, lines: 400, urlChars: 7_500 } as const;

// ── Which files Shaheen may read and change ─────────────────────────────────────────────────────────────────
const TEXT_FILE = /\.(tsx?|mts|cts|mjs|cjs|jsx?|py|css|html?|json|md|ya?ml|sh|txt|svg|toml|example)$|(^|\/)(\.gitignore|\.nvmrc|AGENTS\.md|LICENSE)$/i;
const validPath = (p: string) => Boolean(p) && p.length < 300 && !p.startsWith('/') && !p.includes('\\') && !p.split('/').some((s) => !s || s === '.' || s === '..');
export const isReadablePath = (path: string) => validPath(path) && TEXT_FILE.test(path) && !/^\.env(?!\.example$)/.test(path) && !/\.(pem|key)$/i.test(path);

/** Out of Shaheen's reach even with the owner's click — each with the reason shown on the card. */
const BLOCKED: [RegExp, string][] = [
  [/^\.git\//, 'ملفات git نفسها'],
  [/^\.github\//, 'ملفات تشغيل الروبوتات (workflows) — بتتعدل من شات وكيل البرمجة بس'],
  [/^src\/data\/owner\/|^scripts\/owner\/|(^|\/)owner(Authority|Files|Desk)\.ts$/, 'مفاتيح صاحب الموقع وقواعد صلاحيات شاهين نفسها — مايقدرش يغيّرها لنفسه'],
  [/^docs\/|^src\/legal\/|^server\/legal\/|^scripts\/shaheen-import\/guard\.ts$/, 'قرارات المدير القانوني والمستندات — بتتغير بعد مراجعة قانونية بس'],
  [/^src\/data\/live\/|^src\/لغات\/ai\/|^public\/(store-images|p)\//, 'بيانات وتقارير الروبوتات — الروبوتات بس اللي بتكتبها'],
  [/^scripts\/doctor\//, 'طبيب شاهين نفسه'],
  [/(^|\/)(bun\.lockb?|package-lock\.json|yarn\.lock|pnpm-lock\.yaml|package\.json)$/, 'المكتبات وملفات القفل — بتتغير من شات وكيل البرمجة بس'],
  [/^\.env(?!\.example$)|\.(pem|key)$/i, 'ملفات سرية'],
  [/^(node_modules|dist|pages-dist|build|coverage|\.vercel|\.data)\//, 'نسخة مبنية أو ملفات مؤقتة'],
];

export type FileRule = { allowed: true } | { allowed: false; reasonAr: string };
export function changeRule(path: string): FileRule {
  if (!validPath(path)) return { allowed: false, reasonAr: 'مسار غير صالح' };
  for (const [re, reasonAr] of BLOCKED) if (re.test(path)) return { allowed: false, reasonAr };
  if (!isReadablePath(path)) return { allowed: false, reasonAr: 'نوع ملف مش نص' };
  return { allowed: true };
}

// ── The list of files Shaheen sees (from the repository tree) ───────────────────────────────────────────────
/** One line per folder: «src/components: Footer.tsx, Header.tsx…». Robots' data and translations packs left out. */
export function fileIndex(paths: string[], max: number = FILE_LIMITS.index): string {
  const byDir = new Map<string, string[]>();
  for (const p of paths) {
    if (!isReadablePath(p) || /^(src\/data\/|src\/لغات\/|public\/)/.test(p)) continue;
    const i = p.lastIndexOf('/');
    const dir = i < 0 ? '.' : p.slice(0, i);
    byDir.set(dir, [...(byDir.get(dir) || []), p.slice(i + 1)]);
  }
  const lines = [...byDir.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([d, f]) => `${d}: ${f.sort().join(', ')}`);
  let out = '';
  for (const line of lines) { if (out.length + line.length + 1 > max) { out += '\n…'; break; } out += `${out ? '\n' : ''}${line}`; }
  return out;
}

/** Files the owner names in his message: a full path, or a file name that only one file has. */
export function mentionedFiles(text: string, paths: string[]): string[] {
  const set = new Set(paths);
  const found: string[] = [];
  for (const m of text.matchAll(/[\p{L}\p{N}_.\-/]+\.[a-z]{1,5}\b/giu)) {
    const token = m[0].replace(/^\.?\//, '');
    let hit = set.has(token) ? token : undefined;
    if (!hit) { const same = paths.filter((p) => p === token || p.endsWith(`/${token}`)); if (same.length === 1) hit = same[0]; }
    if (hit && isReadablePath(hit) && !found.includes(hit)) found.push(hit);
  }
  return found.slice(0, FILE_LIMITS.files);
}

// ── What Shaheen writes back: read requests and change proposals ────────────────────────────────────────────
const READ_MARK = /\[\[\s*(?:اقرأ|اقرا|إقرأ|read)\s*:\s*([^\]\n]+?)\s*\]\]/giu;
export function readRequests(reply: string): string[] {
  const out: string[] = [];
  for (const m of reply.matchAll(READ_MARK)) { const p = m[1]!.trim().replace(/^`|`$/g, '').replace(/^\.?\//, ''); if (!out.includes(p)) out.push(p); }
  return out.slice(0, FILE_LIMITS.files);
}

export interface FileEdit { path: string; search: string; replace: string }
const BLOCK = /\[\[\s*(?:تعديل|edit)\s*:\s*([^\]\n]+?)\s*\]\]([\s\S]*?)(?:\[\[\s*\/\s*(?:تعديل|edit)\s*\]\]|(?=\[\[\s*(?:تعديل|edit)\s*:)|$)/giu;
const PAIR = /<{7} SEARCH\r?\n([\s\S]*?)\r?\n?={7}\r?\n([\s\S]*?)\r?\n?>{7} REPLACE/g;

/** The change blocks in a reply (one or more SEARCH/REPLACE pairs per file). */
export function parseChanges(reply: string): FileEdit[] {
  const edits: FileEdit[] = [];
  for (const b of reply.matchAll(BLOCK)) {
    const path = b[1]!.trim().replace(/^`|`$/g, '').replace(/^\.?\//, '');
    const body = b[2]!.replace(/^\s*```[\w-]*\s*$/gm, '');
    for (const p of body.matchAll(PAIR)) edits.push({ path, search: p[1]!, replace: p[2]! });
  }
  return edits;
}

/** The reply as the owner reads it: change blocks become a one-line pointer to the card, read marks a short note. */
export function displayReply(reply: string): string {
  return reply
    .replace(BLOCK, (_m, path: string) => `\n> 🛠️ اقتراح تعديل على \`${path.trim()}\` — التفاصيل في الكارت تحت.\n`)
    .replace(READ_MARK, (_m, path: string) => `📂 \`${path.trim()}\``)
    .replace(/\n{3,}/g, '\n\n').trim();
}

const count = (hay: string, needle: string) => { let n = 0; let i = hay.indexOf(needle); while (i >= 0) { n++; i = hay.indexOf(needle, i + needle.length); } return n; };
const lineCount = (s: string) => (s ? s.split('\n').length : 0);

export interface PlannedChange { path: string; before?: string; after: string; lines: number }
export interface ChangePlan { files: PlannedChange[]; problems: string[]; lines: number }

/**
 * Applies the edits to the current files. Every SEARCH must match exactly once (an empty SEARCH creates a new file).
 * Used twice: in the suite to show the card, and on the owner's desk on the newest main before anything is saved.
 */
export function planChange(edits: FileEdit[], read: (path: string) => string | undefined): ChangePlan {
  const problems: string[] = [];
  const current = new Map<string, string | undefined>();
  const original = new Map<string, string | undefined>();
  let lines = 0;
  for (const e of edits) {
    const rule = changeRule(e.path);
    if (!rule.allowed) { problems.push(`${e.path}: ${rule.reasonAr}`); continue; }
    if (!current.has(e.path)) { const text = read(e.path); current.set(e.path, text); original.set(e.path, text); }
    const text = current.get(e.path);
    if (!e.search.trim()) {
      if (text !== undefined) { problems.push(`${e.path}: الملف موجود — التعديل لازم يحدد الجزء القديم`); continue; }
      current.set(e.path, e.replace.endsWith('\n') ? e.replace : `${e.replace}\n`);
      lines += lineCount(e.replace);
      continue;
    }
    if (text === undefined) { problems.push(`${e.path}: الملف مش موجود`); continue; }
    const n = count(text, e.search);
    if (n !== 1) { problems.push(`${e.path}: ${n ? 'الجزء القديم متكرر أكتر من مرة' : 'الجزء القديم مش موجود في الملف (يمكن الملف اتغير)'}`); continue; }
    current.set(e.path, text.replace(e.search, () => e.replace));
    lines += lineCount(e.search) + lineCount(e.replace);
  }
  const files: PlannedChange[] = [...current.entries()]
    .filter(([p, after]) => after !== undefined && after !== original.get(p))
    .map(([path, after]) => ({ path, before: original.get(path), after: after!, lines: 0 }));
  for (const f of files) f.lines = edits.filter((e) => e.path === f.path).reduce((s, e) => s + lineCount(e.search) + lineCount(e.replace), 0);
  if (files.length > CHANGE_LIMITS.files) problems.push(`تعديل كبير أوي (${files.length} ملفات) — الحد ${CHANGE_LIMITS.files}`);
  if (lines > CHANGE_LIMITS.lines) problems.push(`تعديل كبير أوي (${lines} سطر) — الحد ${CHANGE_LIMITS.lines}`);
  if (!edits.length) problems.push('مفيش تعديل مفهوم في الرد');
  return { files, problems, lines };
}

/** Small and safe → it goes live after the checks; big or sensitive → the card says so before the owner presses. */
export function changeVerdict(controls: OwnerControls, plan: ChangePlan): SelfDevVerdict {
  const v = selfDevVerdict(controls, { paths: plan.files.map((f) => f.path), lines: plan.lines });
  // Before the desk runs anything, «عدّى كل الفحوص» is not true yet.
  return { ...v, reasonAr: v.reasonAr.replace(/\s*وعدّى كل الفحوص/, '') };
}

// ── Carrying the change to the owner's desk (a GitHub request opened from his own account) ──────────────────
export interface ChangeRequest { v: 1; summary: string; edits: FileEdit[] }

const toB64Url = (bytes: Uint8Array) => { let s = ''; for (const b of bytes) s += String.fromCharCode(b); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
const fromB64Url = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
async function pipe(data: Uint8Array, mode: 'gzip' | 'gunzip') {
  const stream = (mode === 'gzip' ? new CompressionStream('gzip') : new DecompressionStream('gzip')) as unknown as ReadableWritablePair<Uint8Array, Uint8Array>;
  return new Uint8Array(await new Response(new Blob([data as unknown as ArrayBuffer]).stream().pipeThrough(stream)).arrayBuffer());
}
/** Any desk request as a short, link-safe text (JSON → gzip → base64url). */
export async function encodePayload(value: unknown): Promise<string> {
  return toB64Url(await pipe(new TextEncoder().encode(JSON.stringify(value)), 'gzip'));
}
export async function decodePayload(encoded: string): Promise<unknown> {
  try { return JSON.parse(new TextDecoder().decode(await pipe(fromB64Url(encoded.trim()), 'gunzip'))); } catch { return undefined; }
}
export const encodeChange = (req: ChangeRequest) => encodePayload(req);
/** A change request (version 1, or a desk request of kind «change»). */
export function readChange(x: unknown): ChangeRequest | undefined {
  const r = x as { v?: number; kind?: string; summary?: unknown; edits?: unknown };
  if (!r || !(r.v === 1 || (r.v === 2 && r.kind === 'change')) || typeof r.summary !== 'string' || !Array.isArray(r.edits)) return undefined;
  const edits = (r.edits as FileEdit[]).filter((e) => e && typeof e.path === 'string' && typeof e.search === 'string' && typeof e.replace === 'string');
  return edits.length === r.edits.length && edits.length ? { v: 1, summary: r.summary.slice(0, 300), edits } : undefined;
}
export async function decodeChange(encoded: string): Promise<ChangeRequest | undefined> { return readChange(await decodePayload(encoded)); }

const FENCE = 'shaheen-change';
/** The request's title and body. Only the change itself goes in — never the room's conversation. */
export function changeIssue(summary: string, plan: ChangePlan, verdict: SelfDevVerdict, encoded: string): { title: string; body: string } {
  const clean = maskSensitive(summary.replace(/\s+/g, ' ').trim()).slice(0, 90) || 'تعديل من غرفة شاهين';
  return {
    title: `${CHANGE_TITLE_PREFIX}${clean}`,
    body: [
      '🦅 **تعديل اقترحه شاهين في غرفة صاحب الموقع، وصاحب الموقع وافق عليه.**', '',
      `**الملفات:** ${plan.files.map((f) => `\`${f.path}\``).join('، ')} (${plan.lines} سطر)`,
      `**الحكم:** ${verdict.auto ? '✅' : '🔑'} ${verdict.reasonAr}`, '',
      'مكتب صاحب الموقع هيطبّق التعديل على آخر نسخة، ويشغّل كل الفحوص، ولو عدّت كلها هينشره ويرد هنا. لو فحص واحد وقع، مفيش حاجة هتتغير.', '',
      `\`\`\`${FENCE}`, encoded, '```',
    ].join('\n'),
  };
}
export const changeFromIssue = (body: string) => body.match(new RegExp(`\`\`\`${FENCE}\\s*\\n([A-Za-z0-9_-]+)\\s*\\n\`\`\``))?.[1];
export const newIssueUrl = (title: string, body: string) =>
  `https://github.com/${SITE_REPO}/issues/new?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`;
export const changesListUrl = () => `https://github.com/${SITE_REPO}/issues?q=${encodeURIComponent(`is:issue "${CHANGE_TITLE_PREFIX.trim()}" in:title`)}`;

// ── Reading files in the browser (public repository; no key needed) ─────────────────────────────────────────
const encodePath = (p: string) => p.split('/').map(encodeURIComponent).join('/');
export const rawFileUrl = (path: string) => `https://raw.githubusercontent.com/${SITE_REPO}/${SITE_BRANCH}/${encodePath(path)}`;
export const treeUrl = () => `https://api.github.com/repos/${SITE_REPO}/git/trees/${SITE_BRANCH}?recursive=1`;

/** A file as Shaheen gets it: masked, and cut (with a note) when it is longer than the limit. */
export function fileForShaheen(path: string, text: string, max: number = FILE_LIMITS.perFile): { path: string; content: string } {
  const masked = maskSensitive(text);
  if (masked.length <= max) return { path, content: masked };
  const cut = masked.slice(0, max);
  return { path, content: `${cut.slice(0, cut.lastIndexOf('\n') > 0 ? cut.lastIndexOf('\n') : max)}\n[… الملف أطول من كده — اتقطع هنا عند سطر ${cut.split('\n').length} من ${masked.split('\n').length}]` };
}

/** A one-line title for the request: the first sentence of Shaheen's explanation. */
export function changeSummary(reply: string): string {
  // The explanation right before the first change block says what changes; «شفت الفوتر.» before it does not.
  const start = reply.search(/\[\[\s*(?:تعديل|edit)\s*:/iu);
  const before = displayReply(start > 0 ? reply.slice(0, start) : reply);
  const sentences = before.split('\n').map((l) => l.replace(/^[>#*\-\s\d.)]+/, '').replace(/[*_`]/g, '').trim())
    .filter((l) => !l.startsWith('🛠️') && !l.startsWith('📂')).flatMap((l) => l.split(/(?<=[.!؟?])\s+/)).map((x) => x.trim()).filter((x) => x.length > 6);
  return (sentences.at(-1) || '').slice(0, 90);
}
