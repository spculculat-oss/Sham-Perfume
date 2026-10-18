/**
 * «مشرف شاهين» — GitHub Actions runs this every 12 hours after the news bulletin (.github/workflows/shaheen-news.yml):
 *   node --import tsx scripts/shaheen-supervisor/run.mts
 * 1. Tests every AI tool registered in src/utils/aiTools.ts with real requests to the live site (or the files it publishes).
 * 2. Automatic checks on every answer (empty, broken, wrong language, vendor names, slow…).
 * 3. «الخبير شاهين» reads the samples, scores each tool and writes quality guidance for it.
 * 4. Guidance is adopted when a tool is weak, kept while it helps and rolled back if the tool gets worse.
 * Writes src/data/live/ai-supervisor.json: the tools read their guidance from it at run time (server/core/liveData.ts),
 * and the admin panel shows the report. Works without an AI key too (automatic checks only).
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { AI_TOOLS, type AiToolId } from '../../src/utils/aiTools';
import { councilGoal, readCouncil } from '../shaheen-council/council';
import { buildReport, INTERVAL_HOURS, parseJson, readReview, REVIEW_SYSTEM, reviewPrompt, type Ask, type Probe, type Review, type SupervisorFile } from './checks';
import { PROBES, QUESTIONS } from './probes';
import { curateMemory, emptyMemory, isMemoryFile, remember, type MemoryFile } from '../../src/utils/shaheenMemory';
import { makeAsk } from '../doctor/agent';

const env = process.env;
const DIR = new URL('../../src/data/live/', import.meta.url);
const FILE = new URL('ai-supervisor.json', DIR);
const site = (env.SHAM_SITE_URL || 'https://sham-perfume-49bf.vercel.app').replace(/\/$/, '');
const now = new Date();
const previous = (() => { try { return existsSync(FILE) ? JSON.parse(readFileSync(FILE, 'utf8')) as SupervisorFile : undefined; } catch { return undefined; } })();

// 1–2) Test every tool
const probes: Partial<Record<AiToolId, Probe[]>> = {};
const ctx = { site, fetch, run: Math.floor(now.getTime() / (INTERVAL_HOURS * 3600_000)), adminToken: env.SHAM_ADMIN_TOKEN?.trim() || undefined, now: now.getTime(), liveDir: DIR };
for (const tool of AI_TOOLS) {
  try { probes[tool.id] = await PROBES[tool.id](ctx); }
  catch (error) { probes[tool.id] = [{ tool: tool.id, question: 'الفحص', answer: '', ms: 0, ok: false, error: (error as Error).message.slice(0, 160), findings: [] }]; }
  const list = probes[tool.id]!;
  console.log(`${tool.id}: ${list.length ? list.map((p) => `${p.ok ? '✓' : '✗'} ${Math.round(p.ms / 100) / 10}s ${p.findings.map((f) => f.text).join('; ')}`).join(' | ') : 'skipped'}`);
}

// 3) Shaheen reviews (one request for all tools)
let review: Review | undefined;
let reviewNote = '';
let ask: Ask | undefined;
try { ask = await makeAsk(env); } catch { ask = undefined; }
// The daily meeting's development goal for each tool («مجلس شاهين»).
const council = readCouncil();
const reviewed = AI_TOOLS.filter((t) => probes[t.id]?.some((p) => p.ok && p.answer));
if (ask && reviewed.length) {
  try {
    const reply = await ask(REVIEW_SYSTEM, reviewPrompt(reviewed.map((t) => ({ id: t.id, guidance: previous?.tools[t.id]?.guidance?.text, goal: councilGoal(council, t.id), probes: probes[t.id]! }))));
    review = readReview(parseJson(reply));
    console.log(`Shaheen reviewed ${Object.keys(review.tools).length} tools`);
  } catch (error) { reviewNote = `Shaheen's review failed (${(error as Error).message.slice(0, 160)}): automatic checks only`; }
} else reviewNote = ask ? 'Nothing to review' : 'No AI engine configured: automatic checks only';
if (reviewNote) console.log(reviewNote);

// 4) Report + guidance
const report = buildReport({ previous, probes, review, now });
mkdirSync(DIR, { recursive: true });
writeFileSync(FILE, `${JSON.stringify(report, null, 1)}\n`);

// 5) «ذاكرة شاهين» learns the probe answers that passed every check (asked again later = no AI call).
const MEMORY = new URL('shaheen-memory.json', DIR);
const memory: MemoryFile = (() => { try { const d: unknown = JSON.parse(readFileSync(MEMORY, 'utf8')); return isMemoryFile(d) ? d : emptyMemory(); } catch { return emptyMemory(); } })();
let learned = 0;
for (const p of probes.shaheen_chat || []) {
  const lang = QUESTIONS.shaheen_chat.find((x) => x.q === p.question)?.lang;
  if (lang && p.ok && p.answer && !p.findings.some((f) => f.severe) && remember(memory, { question: p.question, lang, mode: 'auto', answer: p.answer, source: 'probe' }, now)) learned++;
}
if (learned) { writeFileSync(MEMORY, `${JSON.stringify(curateMemory(memory, now.getTime()).file, null, 1)}\n`); console.log(`Shaheen's memory learned ${learned} checked answers`); }

const rows = AI_TOOLS.map((t) => ({ t, r: report.tools[t.id] })).filter(({ r }) => r);
const icon = { ok: '✅', warn: '⚠️', fail: '❌', skipped: '⏭️' } as const;
const event = { updated: 'توجيهات جديدة', rolled_back: 'تراجع عن التوجيهات', kept: 'التوجيهات مستمرة', none: '—' } as const;
if (env.GITHUB_STEP_SUMMARY) {
  const table = rows.map(({ t, r }) => `| ${icon[r!.status]} ${t.nameAr} | ${r!.score ?? '—'} | ${r!.autoScore ?? '—'} | ${event[r!.lastEvent]} | ${r!.issues.slice(0, 3).join('<br>') || '—'} |`);
  appendFileSync(env.GITHUB_STEP_SUMMARY, `## مشرف شاهين على أدوات الذكاء الاصطناعي — ${report.updatedAt}\n\n${report.summaryAr}\n\nالمتوسط: **${report.overall ?? '—'}/10**${review ? '' : ' (فحص آلي فقط)'}\n\n| الأداة | التقييم | الفحص الآلي | التوجيهات | ملاحظات |\n|---|---|---|---|---|\n${table.join('\n')}\n`);
}
if (env.GITHUB_ACTIONS) {
  const clean = (t: string) => t.replace(/[\r\n%]/g, ' ').slice(0, 400);
  console.log(`::notice title=Shaheen supervisor::${clean(`${report.overall ?? '—'}/10 — ${review ? 'reviewed by Shaheen' : 'automatic checks only'} — ${report.summaryAr}`)}`);
  if (reviewNote) console.log(`::warning title=Shaheen review::${clean(reviewNote)}`);
  for (const { t, r } of rows) {
    const line = clean(`${r!.score ?? '—'}/10 ${r!.status} · ${event[r!.lastEvent]} · ${r!.issues.slice(0, 2).join(' · ') || 'سليم'}`);
    console.log(`::${r!.status === 'fail' ? 'warning' : 'notice'} title=${t.id}::${line}`);
  }
}
