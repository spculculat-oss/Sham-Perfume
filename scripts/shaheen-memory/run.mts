/**
 * «ذاكرة شاهين» — GitHub Actions runs this every 2 hours (.github/workflows/shaheen-import.yml):
 *   node --import tsx scripts/shaheen-memory/run.mts
 * 1. Collects what the live server learned from visitors' questions (GET /api/admin/shaheen-memory, needs the
 *    SHAM_ADMIN_TOKEN secret — skipped without it; the supervisor's checked answers are learned anyway).
 * 2. Merges it into src/data/live/shaheen-memory.json, the shared memory every server instance and every
 *    visitor's browser use: repeated questions without an AI call, and answers while no engine is reachable.
 * 3. Keeps it healthy: unused answers expire, answers failing the checks are dropped, most-asked first.
 * No AI call here.
 */
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import { curateMemory, emptyMemory, isMemoryFile, mergeMemory, MEMORY_LIMITS, type MemoryFile } from '../../src/utils/shaheenMemory';

const env = process.env;
const FILE = new URL('../../src/data/live/shaheen-memory.json', import.meta.url);
const site = (env.SHAM_SITE_URL || 'https://sham-perfume-49bf.vercel.app').replace(/\/$/, '');
const token = env.SHAM_ADMIN_TOKEN?.trim();
const notes: string[] = [];
const say = (line: string) => { console.log(line); notes.push(line); };

const read = (): MemoryFile => { try { const d: unknown = JSON.parse(readFileSync(FILE, 'utf8')); return isMemoryFile(d) ? d : emptyMemory(); } catch { return emptyMemory(); } };
const before = read();
let file = before;

if (token) {
  try {
    const response = await fetch(`${site}/api/admin/shaheen-memory`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(30_000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data: unknown = await response.json();
    if (!isMemoryFile(data)) throw new Error('unexpected reply');
    const known = new Set(file.entries.map((e) => e.id));
    file = mergeMemory(file, data);
    say(`From the live server: ${data.entries.length} answers (${data.entries.filter((e) => !known.has(e.id)).length} new)`);
  } catch (error) { say(`Live server memory not collected (${(error as Error).message.slice(0, 120)})`); }
} else say('SHAM_ADMIN_TOKEN not set: visitors\' answers stay on the server; the supervisor\'s checked answers are still learned');

const { file: curated, removed } = curateMemory(file);
if (removed) say(`Forgot ${removed} answers (unused for ${MEMORY_LIMITS.ttlDays} days, failing the checks, or beyond ${MEMORY_LIMITS.maxEntries})`);
const changed = JSON.stringify(curated.entries) !== JSON.stringify(before.entries);
if (changed) writeFileSync(FILE, `${JSON.stringify(curated, null, 1)}\n`);
const hits = curated.entries.reduce((n, e) => n + e.hits, 0);
say(`Shaheen's memory: ${curated.entries.length} answers, used ${hits} times without an AI call${changed ? '' : ' (no change)'}`);

if (env.GITHUB_ACTIONS) for (const n of notes.slice(0, 8)) console.log(`::notice title=ذاكرة شاهين::${n}`);
if (env.GITHUB_STEP_SUMMARY) {
  const top = [...curated.entries].sort((a, b) => b.hits - a.hits).slice(0, 10)
    .map((e) => `| ${e.question.replace(/\|/g, '¦').slice(0, 80)} | ${e.lang} | ${e.hits} | ${e.source} |`);
  appendFileSync(env.GITHUB_STEP_SUMMARY, `## ذاكرة شاهين\n\n${notes.map((n) => `- ${n}`).join('\n')}\n\n${top.length ? `| السؤال | اللغة | مرات الاستخدام | المصدر |\n|---|---|---|---|\n${top.join('\n')}\n` : ''}`);
}
