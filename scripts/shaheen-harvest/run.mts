/**
 * «حصّاد شاهين» — the academy runs this every hour, after the school (.github/workflows/shaheen-school-clock.yml):
 *   node --import tsx scripts/shaheen-harvest/run.mts
 * Answers ahead of time, while a package has room, the questions visitors are likely to ask — the visitors' own
 * unanswered questions first (SHAM_ADMIN_TOKEN), then the everyday bank (src/data/shaheen-harvest-bank.json) — and keeps
 * the good answers in src/data/live/shaheen-memory.json, the memory the site answers from when no platform does.
 *   - 22:00–24:00 Pacific (the two hours before the daily renewal): the leftover of the day's package, regular models.
 *   - The rest of the day: only the open models that have their own quota, so the visitors' chat loses nothing.
 * Nothing is faked: a used-up package just ends the run («next hour»). Writes $GITHUB_OUTPUT kept=<n>.
 */
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { curateMemory, emptyMemory, isMemoryFile, remember, type MemoryFile } from '../../src/utils/shaheenMemory';
import { engineStatuses, geminiBody, rankGemmaModels, rankGeminiModels, type GeminiModelInfo } from '../../server/core/engines';
import { systemInstruction } from '../../server/shaheen';
import {
  bankQuestions, harvestBrief, harvestCheck, harvestMode, HARVEST_LIMITS, isHarvestReport, nextReport, pickHarvest, visitorHarvest,
  type HarvestQuestion, type HarvestReport,
} from './harvest';

const env = process.env;
const live = (name: string) => new URL(`../../src/data/live/${name}`, import.meta.url);
const read = <T,>(url: URL): T | undefined => { try { return existsSync(url) ? JSON.parse(readFileSync(url, 'utf8')) as T : undefined; } catch { return undefined; } };
const notes: string[] = [];
const say = (line: string) => { console.log(line); notes.push(line); };
const output = (kept: number) => { if (env.GITHUB_OUTPUT) appendFileSync(env.GITHUB_OUTPUT, `kept=${kept}\n`); };
const now = new Date();
const nowIso = now.toISOString();
const sleep = (ms: number) => new Promise((done) => setTimeout(done, ms));

const memoryRaw = read<unknown>(live('shaheen-memory.json'));
const memory: MemoryFile = isMemoryFile(memoryRaw) ? memoryRaw : emptyMemory();
const previousRaw = read<unknown>(live('shaheen-harvest.json'));
const previous: HarvestReport | undefined = isHarvestReport(previousRaw) ? previousRaw : undefined;
const bank = bankQuestions(read(new URL('../../src/data/shaheen-harvest-bank.json', import.meta.url)));
const harvested = () => memory.entries.filter((e) => e.source === 'harvest').length;
const waitingNow = () => pickHarvest(bank, memory, bank.length).length;

const mode = harvestMode(now, env);
const gemini = engineStatuses(env).find((e) => e.id === 'gemini');
const key = env.GEMINI_API_KEY?.trim();
const finish = (asked: number, keptList: { q: string; from: HarvestQuestion['from'] }[], stopped?: string) => {
  const report = nextReport(previous, { at: nowIso, mode, asked, kept: keptList.length, ...(stopped ? { stopped } : {}) }, keptList, harvested(), waitingNow());
  writeFileSync(live('shaheen-harvest.json'), `${JSON.stringify(report, null, 1)}\n`);
  output(keptList.length);
  if (env.GITHUB_ACTIONS) console.log(`::notice title=حصّاد شاهين::${notes.join(' | ').replace(/[\r\n%]/g, ' ').slice(0, 900)}`);
  if (env.GITHUB_STEP_SUMMARY) appendFileSync(env.GITHUB_STEP_SUMMARY, `## حصّاد شاهين — ${nowIso}\n\n${notes.map((n) => `- ${n}`).join('\n')}\n\n${keptList.length ? `### اتحفظت إجاباتها\n${keptList.map((k) => `- ${k.q}`).join('\n')}\n` : ''}`);
};

if (mode === 'off' || !gemini?.configured || !key) {
  // Platforms closed by the owner («شاهين معتمد على نفسه») or no key: nothing to harvest, nothing changes.
  say(mode === 'off' ? 'Harvest off (HARVEST_MODE=off)' : 'No platform open for the harvest (closed by the owner or no key) — nothing to do');
  output(0);
  process.exit(0);
}

// ── The questions: visitors' unanswered ones first, then the school's open ones, then the everyday bank ──────
const candidates: HarvestQuestion[] = [];
const site = (env.SHAM_SITE_URL || 'https://sham-perfume-49bf.vercel.app').replace(/\/$/, '');
if (env.SHAM_ADMIN_TOKEN?.trim()) {
  try {
    const response = await fetch(`${site}/api/admin/gaps`, { headers: { Authorization: `Bearer ${env.SHAM_ADMIN_TOKEN.trim()}` }, signal: AbortSignal.timeout(20_000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const visitors = visitorHarvest(((await response.json()) as { items?: [] }).items || []);
    candidates.push(...visitors);
    say(`Visitors' unanswered questions: ${visitors.length}`);
  } catch (error) { say(`Visitors' questions not collected (${(error as Error).message.slice(0, 80)})`); }
}
const school = read<{ pending?: { q?: string; lang?: string; topic?: string }[] }>(live('shaheen-school.json'));
for (const p of school?.pending || []) if (typeof p.q === 'string') candidates.push({ q: p.q, lang: p.lang === 'en' ? 'en' : 'ar', topic: p.topic || 'school', from: 'school' });
candidates.push(...bank);

const cap = Math.max(0, Number(env.HARVEST_MAX?.trim() || (mode === 'leftover' ? HARVEST_LIMITS.leftover : HARVEST_LIMITS.open)) || 0);
const todo = pickHarvest(candidates, memory, cap);
if (!todo.length) {
  say(`Nothing new to harvest (${harvested()} answers already kept)`);
  finish(0, []);
  process.exit(0);
}

// ── The models: open ones with their own quota, or (last two hours) the leftover of the regular package ──────
let models: string[] = [];
try {
  const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000', { headers: { 'x-goog-api-key': key }, signal: AbortSignal.timeout(15_000) });
  const list = response.ok ? ((await response.json()) as { models?: GeminiModelInfo[] }).models || [] : [];
  const open = rankGemmaModels(list).slice(0, 2);
  const regular = rankGeminiModels(list).filter((id) => !/(preview|exp|image|tts|audio|live|embedding)/.test(id)).slice(0, 3);
  models = mode === 'leftover' ? [...regular, ...open] : open;
} catch (error) { say(`Model list not read (${(error as Error).message.slice(0, 60)})`); }
if (!models.length) {
  say(mode === 'open' ? 'No open model available to this key — waiting for the last two hours of the day' : 'No model available to this key');
  finish(0, [], 'no-model');
  process.exit(0);
}

/** One question to one model, without the chat's fallbacks (the open models must never spill into the chat's quota). */
async function ask(model: string, q: HarvestQuestion): Promise<{ text?: string; status: number }> {
  const system = systemInstruction(q.lang, harvestBrief(q.lang), 'deep');
  const body = geminiBody(model, system, [{ role: 'user', text: q.q }], 0.3, 1800);
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key! }, body: JSON.stringify(body), signal: AbortSignal.timeout(90_000),
  });
  if (!response.ok) { await response.body?.cancel().catch(() => {}); return { status: response.status }; }
  const data = await response.json() as { candidates?: { finishReason?: string; content?: { parts?: { text?: string; thought?: boolean }[] } }[] };
  const c = data.candidates?.[0];
  // A cut answer (token limit, safety) is never kept.
  if (c?.finishReason && c.finishReason !== 'STOP') { console.log(`${model}: stopped by ${c.finishReason}`); return { status: 206 }; }
  const text = (c?.content?.parts || []).filter((p) => !p.thought).map((p) => p.text || '').join('').replace(/<think>[\s\S]*?<\/think>/g, '').trim();
  return { text, status: 200 };
}

const kept: { q: string; from: HarvestQuestion['from'] }[] = [];
let asked = 0; let stopped: string | undefined; let rejected = 0;
const why = new Map<string, number>();
const reject = (reason: string) => { rejected++; why.set(reason, (why.get(reason) || 0) + 1); };
const alive = [...models];
const started = Date.now();
const budgetMs = Math.max(1, Number(env.HARVEST_BUDGET_MIN?.trim() || 12)) * 60_000;
for (const q of todo) {
  if (Date.now() - started > budgetMs) { stopped = 'time'; break; }
  let answered = false;
  while (alive.length && !answered) {
    const model = alive[0]!;
    asked++;
    let r = await ask(model, q).catch(() => ({ status: 0 } as { text?: string; status: number }));
    // Busy for a moment (5xx, network): once more after a short pause, then the next model.
    if (r.status >= 500 || r.status === 0) { await sleep(8000); r = await ask(model, q).catch(() => ({ status: 0 } as { text?: string; status: number })); }
    if (r.status >= 500 || r.status === 0) { console.log(`${model}: HTTP ${r.status} twice — next model`); reject(`${model}:http-${r.status}`); alive.shift(); continue; }
    if (r.status === 429 || r.status === 404 || r.status === 403 || r.status === 400) { console.log(`${model}: HTTP ${r.status} — next model`); alive.shift(); continue; } // out for today, or not for this use
    if (r.status === 200 && r.text) {
      const check = harvestCheck(q.q, r.text);
      if (!check.ok) reject(check.why || 'check');
      else if (remember(memory, { question: q.q, lang: q.lang, mode: 'auto', answer: r.text, source: 'harvest' }, new Date())) kept.push({ q: q.q, from: q.from });
      else reject('not-kept');
      console.log(`«${q.q}» → ${model}: ${check.ok ? 'kept' : `rejected (${check.why})`} — ${r.text.length} chars, ends «${r.text.slice(-40).replace(/\s+/g, ' ')}»`);
    } else { reject(r.status === 206 ? 'cut' : `http-${r.status}`); console.log(`«${q.q}» → ${model}: HTTP ${r.status}`); }
    answered = true;
  }
  if (!alive.length) { stopped = 'quota'; break; }
  // The open models allow a few thousand tokens a minute: spaced so they never refuse.
  if (mode === 'open') await sleep(Number(env.HARVEST_GAP_MS?.trim() || 20_000));
}

say(`Mode: ${mode === 'leftover' ? 'leftover of the daily package (last two hours)' : 'open models (own quota)'} [${models.join(', ')}]; asked ${asked}, kept ${kept.length}, rejected ${rejected}${rejected ? ` (${[...why].map(([k, n]) => `${k} ×${n}`).join(', ')})` : ''}${stopped ? `, stopped (${stopped})` : ''}`);
if (kept.length) {
  const { file } = curateMemory(memory);
  memory.entries = file.entries; memory.updatedAt = file.updatedAt;
  writeFileSync(live('shaheen-memory.json'), `${JSON.stringify(memory, null, 1)}\n`);
}
say(`Harvest answers in memory: ${harvested()}; everyday questions still waiting: ${waitingNow()}`);
finish(asked, kept, stopped);
