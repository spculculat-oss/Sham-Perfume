/**
 * AI code fixer of «طبيب شاهين».
 *
 *   problem + evidence (CI log, failing check) → relevant files → the model proposes edits (JSON)
 *   → edits applied (guarded paths) → full verification (lint, tests, Vercel build + test, EdgeOne check)
 *   → failed? errors go back to the model (up to 3 attempts) → still failing? every file is restored.
 *
 * It can create and change files, but it cannot touch its own code, workflows, secrets, dependencies or the
 * existing tests (it may ADD tests) — so it can never "fix" a problem by weakening the checks that guard it.
 */
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';

export interface Edit { path: string; find?: string; replace?: string; content?: string }
export interface ModelPlan { summary: string; edits: Edit[] }
export interface FixInput { problem: string; reason: string; evidence: string }
export interface FixDeps {
  root: string;
  ask: (system: string, prompt: string) => Promise<string>;
  sh: (command: string) => Promise<{ ok: boolean; output: string }>;
  trackedFiles: () => Promise<string[]>;
  log?: (line: string) => void;
}
export interface FixResult { ok: boolean; summary: string; changed: string[]; attempts: number; log: string[] }

export const VERIFY_COMMANDS = ['npm run lint', 'npm test', 'npm run build:vercel', 'npm run test:vercel', 'npm run check:edgeone'];
const ALLOWED = [/^server\//, /^src\//, /^scripts\//, /^tests\//, /^cloud-functions\//, /^README\.md$/, /^EDGEONE\.md$/, /^index\.html$/];
const FORBIDDEN = [/^scripts\/doctor\//, /^\.github\//, /^\.env/, /(^|\/)package(-lock)?\.json$/, /bun\.lockb?$/, /^docs\//, /^node_modules\//, /\.(pem|key)$/];
const MAX_FILE_BYTES = 300_000;
const MAX_CHANGED_LINES = 400;
const MAX_FILES = 8;

export function checkPath(path: string, existed: boolean): string | undefined {
  const clean = normalize(path).replace(/\\/g, '/');
  if (!path || clean !== path.replace(/^\.\//, '') || clean.startsWith('..') || clean.startsWith('/')) return `invalid path ${path}`;
  if (FORBIDDEN.some((r) => r.test(clean))) return `${clean} is protected (doctor code, workflows, secrets, dependencies, built site)`;
  if (!ALLOWED.some((r) => r.test(clean))) return `${clean} is outside the editable source folders`;
  if (/^tests\//.test(clean) && existed) return `${clean}: existing tests cannot be changed (new test files are allowed)`;
  return undefined;
}

export function parsePlan(text: string): ModelPlan {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = (fenced ? fenced[1] : text).trim();
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end < start) throw new Error('model reply has no JSON object');
  const plan = JSON.parse(raw.slice(start, end + 1)) as ModelPlan;
  if (!plan || !Array.isArray(plan.edits)) throw new Error('JSON must have an "edits" array');
  plan.summary = String(plan.summary || '').slice(0, 500);
  return plan;
}

const lines = (s: string) => (s ? s.split('\n').length : 0);

/** Applies edits atomically; returns originals (undefined = file did not exist) so they can be restored. */
export function applyEdits(root: string, edits: Edit[]): { originals: Map<string, string | undefined>; changedLines: number } {
  if (!edits.length) throw new Error('no edits proposed');
  if (new Set(edits.map((e) => e.path)).size > MAX_FILES) throw new Error(`too many files (max ${MAX_FILES})`);
  const originals = new Map<string, string | undefined>();
  const next = new Map<string, string>();
  let changedLines = 0;
  for (const edit of edits) {
    const file = join(root, edit.path);
    const existed = next.has(edit.path) || originals.get(edit.path) !== undefined || existsSync(file);
    const problem = checkPath(edit.path, existsSync(file));
    if (problem) throw new Error(problem);
    if (!originals.has(edit.path)) originals.set(edit.path, existsSync(file) ? readFileSync(file, 'utf8') : undefined);
    const current = next.get(edit.path) ?? originals.get(edit.path);
    let updated: string;
    if (typeof edit.content === 'string') {
      updated = edit.content;
      changedLines += Math.max(lines(current || ''), lines(updated));
    } else if (typeof edit.find === 'string' && typeof edit.replace === 'string') {
      if (current === undefined || !existed) throw new Error(`${edit.path} does not exist (use "content" to create it)`);
      const count = current.split(edit.find).length - 1;
      if (!edit.find || count === 0) throw new Error(`${edit.path}: "find" text not found exactly (copy it verbatim from the file)`);
      if (count > 1) throw new Error(`${edit.path}: "find" text appears ${count} times, include more context`);
      updated = current.replace(edit.find, () => edit.replace!);
      changedLines += Math.max(lines(edit.find), lines(edit.replace));
    } else throw new Error(`${edit.path}: each edit needs "content", or "find" + "replace"`);
    if (Buffer.byteLength(updated) > MAX_FILE_BYTES) throw new Error(`${edit.path} would be too large`);
    next.set(edit.path, updated);
  }
  if (changedLines > MAX_CHANGED_LINES) throw new Error(`change too large (${changedLines} lines, max ${MAX_CHANGED_LINES}) — make a smaller, targeted fix`);
  for (const [path, content] of next) {
    const file = join(root, path);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, content);
  }
  return { originals, changedLines };
}

export function restore(root: string, originals: Map<string, string | undefined>) {
  for (const [path, content] of originals) {
    const file = join(root, path);
    if (content === undefined) rmSync(file, { force: true });
    else writeFileSync(file, content);
  }
}

/** Files named in the evidence (paths, or stack frames), plus sensible defaults for the problem. */
export function pickFiles(input: FixInput, tracked: string[]): string[] {
  const source = tracked.filter((f) => /\.(ts|tsx|mts|mjs|cts|js|json|md)$/.test(f) && !/^docs\/|^public\/|bun\.lock/.test(f));
  const mentioned = source.filter((f) => input.evidence.includes(f));
  const defaults: Record<string, string[]> = {
    vendor_leak: ['server/shaheen.ts', 'server/core/text.ts'],
    vendor_leak_modes: ['server/shaheen.ts', 'server/config/shaheen.ts'],
    cors: ['server/cors.ts', 'server/app.ts'],
    empty_reply: ['server/shaheen.ts', 'server/core/engines.ts'],
  };
  const extra = defaults[input.problem.split(':')[0]] || [];
  return [...new Set([...mentioned, ...extra])].filter((f) => tracked.includes(f)).slice(0, 10);
}

const SYSTEM = `You are «طبيب شاهين», the autonomous maintenance engineer of the Sham Perfume website
(React 19 + Vite + Tailwind 4 front end, Express 4 TypeScript API on Vercel, GitHub Pages front end calling it,
Tencent EdgeOne build). «الخبير شاهين» is the site's AI perfume expert chat.
Fix the reported problem with the SMALLEST correct change. Rules:
- Never weaken, skip or delete tests or checks; never edit existing files under tests/ (you may add new test files).
- Visitors must never see AI vendor or model names; Shaheen presents itself as the site's own expert.
- Keep Arabic/English texts and existing behaviour; do not reformat unrelated code; no new dependencies.
- Never put secrets or API keys in files.
Reply with ONLY one JSON object:
{"summary": "<one Arabic sentence: what was wrong and what you changed>",
 "edits": [{"path": "server/x.ts", "find": "<exact existing text, unique in the file>", "replace": "<new text>"},
           {"path": "server/new.ts", "content": "<full content of a new or rewritten file>"}]}`;

function filesBlock(root: string, files: string[], budget = 70_000): string {
  const parts: string[] = [];
  let used = 0;
  for (const f of files) {
    const path = join(root, f);
    if (!existsSync(path) || statSync(path).size > MAX_FILE_BYTES) continue;
    let text = readFileSync(path, 'utf8');
    if (used + text.length > budget) text = `${text.slice(0, Math.max(2000, budget - used))}\n… (truncated)`;
    parts.push(`=== FILE ${f} ===\n${text}`);
    used += text.length;
    if (used >= budget) break;
  }
  return parts.join('\n\n');
}

export async function attemptFix(input: FixInput, deps: FixDeps, maxAttempts = 3): Promise<FixResult> {
  const log: string[] = [];
  const say = (line: string) => { log.push(line); deps.log?.(line); };
  const tracked = await deps.trackedFiles();
  let files = pickFiles(input, tracked);
  let feedback = '';
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const prompt = [
      `PROBLEM: ${input.reason}`,
      `EVIDENCE:\n${input.evidence.slice(-12_000)}`,
      feedback && `YOUR PREVIOUS ATTEMPT FAILED:\n${feedback.slice(-8000)}`,
      `REPOSITORY FILES:\n${tracked.filter((f) => !/^docs\/|^public\//.test(f)).join('\n').slice(0, 12_000)}`,
      files.length ? `RELEVANT FILES:\n${filesBlock(deps.root, files)}` : '',
    ].filter(Boolean).join('\n\n');
    let plan: ModelPlan;
    try {
      plan = parsePlan(await deps.ask(SYSTEM, prompt));
    } catch (error) {
      feedback = `Invalid reply: ${(error as Error).message}. Reply with the JSON object only.`;
      say(`محاولة ${attempt}: رد غير صالح من النموذج (${(error as Error).message})`);
      continue;
    }
    let applied: ReturnType<typeof applyEdits>;
    try {
      applied = applyEdits(deps.root, plan.edits);
    } catch (error) {
      feedback = `Edits rejected: ${(error as Error).message}`;
      say(`محاولة ${attempt}: التعديلات اترفضت — ${(error as Error).message}`);
      // let the model see files it tried to edit
      files = [...new Set([...files, ...plan.edits.map((e) => e.path).filter((p) => tracked.includes(p))])].slice(0, 10);
      continue;
    }
    const changed = [...applied.originals.keys()];
    say(`محاولة ${attempt}: ${plan.summary || 'تعديل'} (${changed.join('، ')})`);
    let failure = '';
    for (const command of VERIFY_COMMANDS) {
      const result = await deps.sh(command);
      if (!result.ok) { failure = `\`${command}\` failed:\n${result.output.slice(-6000)}`; break; }
    }
    if (!failure) {
      say(`محاولة ${attempt}: كل الفحوص نجحت (${VERIFY_COMMANDS.length})`);
      return { ok: true, summary: plan.summary, changed, attempts: attempt, log };
    }
    restore(deps.root, applied.originals);
    feedback = `${failure}\nThe files were restored to their original content.`;
    say(`محاولة ${attempt}: الفحوص فشلت — ${failure.split('\n')[0]}`);
    files = [...new Set([...files, ...changed.filter((p) => tracked.includes(p))])].slice(0, 10);
  }
  return { ok: false, summary: 'ما قدرتش أوصل لإصلاح بيعدّي كل الفحوص', changed: [], attempts: maxAttempts, log };
}
