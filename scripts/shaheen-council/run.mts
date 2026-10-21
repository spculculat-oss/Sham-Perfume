/**
 * «مجلس شاهين» — GitHub Actions runs this once a day (.github/workflows/shaheen-council.yml):
 *   node --import tsx scripts/shaheen-council/run.mts
 * Briefing from the bots' reports → each specialist seat's opinion (its own engine when several keys exist)
 * → Shaheen's minutes → safe decisions applied, development tasks opened as GitHub issues («shaheen-task»)
 * for the coding agent (see AGENTS.md: «نفذ مهام شاهين»). Without an AI engine the minutes come from the
 * briefing's rules. Writes src/data/live/shaheen-council.json; GITHUB_OUTPUT reruns=<workflows>.
 * Env: COUNCIL_FORCE=1 (meet again today), COUNCIL_ISSUES=true (open issues — main only), GITHUB_TOKEN,
 * GITHUB_REPOSITORY, the AI keys.
 */
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { configuredEngines, keyFingerprint, makeAsk, QuotaExhaustedError, quotaBook } from '../doctor/agent';
import { parseJson } from '../shaheen-supervisor/checks';
import {
  applyMeeting, buildBriefing, cairoDate, fieldOpinion, seatTitle, CHAIR_SYSTEM, chairPrompt, emptyCouncil, isCouncilFile, issueBody, parseMinutes, SEAT_SYSTEM,
  recordDelegation, seatPrompt, SEATS, secretaryRoutine, selfMinutes, syncTasks, unreviewed, type CouncilFile, type LiveData, type Meeting,
  type SeatOpinion, type Task,
} from './council';
import { isPrecheckFile, pressureOf, runPrecheck } from './precheck';
import { fetchRuns, readReports } from './runs';

const env = process.env;
const live = (name: string) => new URL(`../../src/data/live/${name}`, import.meta.url);
const read = (name: string): unknown => { try { return existsSync(live(name)) ? JSON.parse(readFileSync(live(name), 'utf8')) : undefined; } catch { return undefined; } };
const FILE = live('shaheen-council.json');
const now = Date.now();
const at = new Date(now).toISOString();
const date = cairoDate(at);
const notes: string[] = [];
const say = (line: string) => { console.log(line); notes.push(line); };

const raw = read('shaheen-council.json');
const file: CouncilFile = isCouncilFile(raw) ? raw : emptyCouncil();

// ── GitHub issues: the bridge to the coding agent ─────────────────────────────────────────────────────────
const repo = env.GITHUB_REPOSITORY || 'spculculat-oss/Sham-Perfume';
const token = env.GITHUB_TOKEN?.trim();
const gh = async (path: string, init: RequestInit = {}) => {
  const r = await fetch(`https://api.github.com/repos/${repo}${path}`, {
    ...init, headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`, 'X-GitHub-Api-Version': '2022-11-28', 'Content-Type': 'application/json', ...(init.headers || {}) },
    signal: AbortSignal.timeout(20_000),
  });
  return { ok: r.ok, status: r.status, data: await r.json().catch(() => undefined) as unknown };
};
if (token) {
  const res = await gh('/issues?labels=shaheen-task&state=all&per_page=100').catch(() => undefined);
  if (res?.ok && Array.isArray(res.data)) {
    const changed = syncTasks(file.tasks, res.data as never);
    if (changed) say(`Development tasks: ${changed} status updates from GitHub`);
  }
}

if (!env.COUNCIL_FORCE && file.meetings[0]?.date === date) {
  say(`Today's meeting (${date}) already took place — nothing to do`);
  writeFileSync(FILE, `${JSON.stringify(file, null, 1)}\n`);
  process.exit(0);
}

// ── 1. Briefing ───────────────────────────────────────────────────────────────────────────────────────────
const data: LiveData = {
  supervisor: read('ai-supervisor.json'), school: read('shaheen-school.json'), sources: read('import-sources.json'), review: read('store-review.json'),
  seo: read('seo-agent.json'), news: read('shaheen-news.json'), quota: read('ai-quota.json'), skills: read('shaheen-skills.json'), manus: read('manus-audit.json'), intake: read('aistudio-intake.json'),
  languages: read('shaheen-languages.json'), missions: read('manus-missions.json'),
};
// «الفحص الشامل قبل الاجتماع» ran two hours ago (shaheen-precheck.yml); if it is missing or old, check now.
const stored = read('shaheen-precheck.json');
const precheck = isPrecheckFile(stored) && now - Date.parse(stored.updatedAt) < 8 * 3600_000
  ? stored
  : runPrecheck(readReports(), await fetchRuns(repo, token), now);
data.precheck = precheck;
say(`Pre-meeting check${precheck === stored ? '' : ' (run now)'}: ${precheck.summaryAr}`);
const openTasks = file.tasks.filter((t) => t.status === 'open');
const briefing = buildBriefing(data, now, openTasks);
say(`Briefing: ${briefing.facts.length} facts, ${briefing.signals.length} signals (${briefing.signals.filter((s) => s.priority === 'high').length} urgent)`);

// ── 2. Opinions (each seat its own engine when several are configured) ────────────────────────────────────
const quota = quotaBook(live('ai-quota.json'));
const engines = (await configuredEngines(env)).filter((id) => !quota.pausedUntil(id, keyFingerprint(env, id)));
const opinions: SeatOpinion[] = [];
let quotaOut = false;
for (const [i, seat] of SEATS.entries()) {
  if (!engines.length || quotaOut) { opinions.push({ seat: seat.id, ok: false, text: '' }); continue; }
  let engine: string | undefined;
  const ask = await makeAsk(env, { bot: 'council', quota, prefer: engines[i % engines.length], maxWaitMs: 60_000, onEngine: (id) => { engine = id; } }).catch(() => undefined);
  try {
    const text = ask ? (await ask(SEAT_SYSTEM(seat), seatPrompt(briefing, file.meetings[0]))).trim() : '';
    opinions.push({ seat: seat.id, engine, ok: text.length > 40, text: text.slice(0, 4000) });
  } catch (error) {
    if (error instanceof QuotaExhaustedError) quotaOut = true;
    opinions.push({ seat: seat.id, ok: false, text: '' });
  }
}
// «المستشار الميداني»: the background agent tried the live site this morning and wrote his opinion before the meeting.
const field = fieldOpinion(data.missions, now);
opinions.push(field ?? { seat: 'field', ok: false, text: '' });
const spoke = opinions.filter((x) => x.ok);
say(`Opinions: ${spoke.length}/${SEATS.length + 1} seats spoke${spoke.length ? ` (${[...new Set(spoke.map((x) => x.engine))].join(', ')})` : ''}`);

// ── 3. Minutes ────────────────────────────────────────────────────────────────────────────────────────────
let minutes: ReturnType<typeof parseMinutes> = null;
let chairEngine: string | undefined;
let chairFailed = false;
if (spoke.length >= 2 && !quotaOut) {
  const ask = await makeAsk(env, { bot: 'council', quota, prefer: engines[0], maxWaitMs: 60_000, onEngine: (id) => { chairEngine = id; } }).catch(() => undefined);
  try { minutes = ask ? parseMinutes(parseJson(await ask(CHAIR_SYSTEM, chairPrompt(briefing, opinions, openTasks, unreviewed(file)))), date) : null; }
  catch (error) { say(`Chair: ${(error as Error).message.slice(0, 120)} — the secretary takes the meeting`); }
  chairFailed = !minutes;
}
// The secretary («مشرف شاهين») deputises: it chairs when Shaheen cannot, and takes the routine under pressure.
const pressure = pressureOf({ engines: engines.length, quotaOut, chairFailed, spoke: spoke.length, urgent: briefing.signals.filter((s) => s.priority === 'high').length, failing: precheck.counts.fail });
const mode: Meeting['mode'] = minutes ? 'ai' : 'self';
const chair: Meeting['chair'] = minutes ? 'shaheen' : 'secretary';
if (!minutes) minutes = selfMinutes(briefing, date, pressure.reasons.length ? pressure.reasons : ['مفيش محرك ذكاء اصطناعي متاح']);
else if (pressure.active) minutes.decisions.push(...secretaryRoutine(briefing, date, minutes.decisions));
if (pressure.active) say(`Secretary ${chair === 'secretary' ? 'chaired the meeting' : 'took the routine'}: ${pressure.reasons.join(' / ')}`);
quota.save();
const meeting: Meeting = { date, at, mode, ...minutes, seats: opinions, ...(chairEngine && chair === 'shaheen' ? { chairEngine } : {}), chair, ...(pressure.active ? { deputyReasons: pressure.reasons } : {}) };

// ── 4. Apply ──────────────────────────────────────────────────────────────────────────────────────────────
const { reruns, newTasks } = applyMeeting(file, meeting, now, Math.max(0, Number(env.COUNCIL_MAX_TASKS ?? 3)));
recordDelegation(file, meeting);
say(`Minutes (${mode === 'ai' ? 'discussion' : 'from the reports, no AI'}): ${meeting.decisions.length} decisions — ${meeting.decisions.filter((d) => d.status === 'applied').length} applied, ${newTasks.length} new tasks, ${Object.keys(meeting.toolGoals).length} tool goals`);

// New tasks, plus earlier ones whose issue could not be opened (or were noted during a branch rehearsal).
const unopened = file.tasks.filter((t) => t.status === 'open' && !t.issue);
if (unopened.length && token && env.COUNCIL_ISSUES === 'true') {
  // Labels once (422 = already there).
  for (const [name, color, description] of [['shaheen-task', 'b8860b', 'مهمة تطوير من اجتماع شاهين اليومي'], ['needs-approval', 'd73a4a', 'تحتاج موافقة التاجر قبل التنفيذ'], ['priority-high', 'b60205', ''], ['priority-medium', 'fbca04', ''], ['priority-low', '0e8a16', '']] as const) {
    await gh('/labels', { method: 'POST', body: JSON.stringify({ name, color, description }) }).catch(() => undefined);
  }
  for (const t of unopened) {
    const res = await gh('/issues', { method: 'POST', body: JSON.stringify({ title: `مهمة شاهين: ${t.title}`, body: issueBody(t), labels: ['shaheen-task', `priority-${t.priority}`, ...(t.needsApproval ? ['needs-approval'] : [])] }) }).catch(() => undefined);
    const issue = res?.data as { number?: number; html_url?: string } | undefined;
    if (res?.ok && issue?.number) { t.issue = issue.number; t.url = issue.html_url; say(`Task #${issue.number}: ${t.title}`); }
    else say(`Task «${t.title}» kept in the file (issue not created: HTTP ${res?.status ?? 'error'})`);
  }
} else if (newTasks.length) say(`Rehearsal: ${newTasks.length} tasks not opened as issues — ${newTasks.map((t: Task) => t.title).join(' | ')}`);

writeFileSync(FILE, `${JSON.stringify(file, null, 1)}\n`);

if (env.GITHUB_OUTPUT) appendFileSync(env.GITHUB_OUTPUT, `reruns=${reruns.join(' ')}\n`);
if (env.GITHUB_ACTIONS) {
  const clip = (t: string) => t.replace(/[\r\n%]/g, ' ').slice(0, 3000);
  console.log(`::notice title=اجتماع شاهين ${date}::${clip(`${meeting.summaryAr} | ${notes.join(' | ')}`)}`);
  console.log(`::notice title=قرارات الاجتماع::${clip(meeting.decisions.map((d) => `[${d.priority}/${d.kind}] ${d.title} — ${d.note || d.status}`).join(' | '))}`);
}
if (env.GITHUB_STEP_SUMMARY) {
  appendFileSync(env.GITHUB_STEP_SUMMARY, `## اجتماع شاهين اليومي — ${date}\n\n${meeting.summaryAr}\n\n### التقرير\n${briefing.facts.map((f) => `- ${f}`).join('\n')}\n\n### الآراء\n${opinions.map((x) => `- **${seatTitle(x.seat)}** (${x.engine || '—'}): ${x.ok ? x.text.slice(0, 600).replace(/\n+/g, ' ') : 'لم يشارك'}`).join('\n')}\n\n### القرارات\n${meeting.decisions.map((d) => `- [${d.priority}] **${d.title}** (${d.kind}) — ${d.note || d.status}\n  ${d.detail.replace(/\n/g, ' ')}`).join('\n')}\n`);
}
