/**
 * Shaheen's background agent (Manus): one mission per run, chosen by the schedule (or by hand).
 *   design  — languages & design audit (Wednesdays and Saturdays) → src/data/live/manus-audit.json
 *   tour    — «جولة الزائر», a phone shopping journey (daily, before the pre-meeting check) → manus-missions.json
 *   verify  — «المراجع الخارجي», the council tasks marked done, checked on the live site → manus-missions.json
 *   node --import tsx scripts/shaheen-manus/run.mts
 * Env: MANUS_API_KEY (secret), MANUS_MISSION (design | tour | verify; empty = rehearsal: every brief is
 * built and checked, no task is created and no credit spent), MANUS_PROFILE (lite | standard | max; default
 * lite), MANUS_WAIT_MIN (default 30), MANUS_MONTHLY_CREDITS (shared monthly budget, default 2000; 0 = none).
 */
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import { ManusError, manusConfigured, runManusTask } from '../../server/core/manus';
import { AUDIT_SCHEMA, auditPrompt, cleanAudit, languagesForWeek, nextAuditFile, weekNumber, type AuditFile } from './audit';
import {
  STEP_AR, TOUR_SCHEMA, VERIFY_SCHEMA, budgetAllows, cleanTour, cleanVerify, creditsThisMonth, emptyMissions, isMissionsFile,
  missionFor, recordRun, tasksToVerify, tourPrompt, verifyPrompt, type MissionsFile, type MissionRun,
} from './missions';

const AUDIT = new URL('../../src/data/live/manus-audit.json', import.meta.url);
const MISSIONS = new URL('../../src/data/live/manus-missions.json', import.meta.url);
const COUNCIL = new URL('../../src/data/live/shaheen-council.json', import.meta.url);
const notes: string[] = [];
const say = (line: string) => { console.log(line); notes.push(line); };
const finish = (code = 0) => {
  if (process.env.GITHUB_ACTIONS) for (const n of notes.slice(-9)) console.log(`::notice title=وكيل شاهين الخلفي (Manus)::${n.replace(/\r?\n/g, ' ').slice(0, 900)}`);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## وكيل شاهين الخلفي (Manus)\n\n${notes.map((n) => `- ${n}`).join('\n')}\n`);
  process.exit(code);
};
const readJson = (url: URL): unknown => { try { return JSON.parse(readFileSync(url, 'utf8')); } catch { return undefined; } };
const write = (url: URL, data: unknown) => writeFileSync(url, `${JSON.stringify(data, null, 1)}\n`);

const now = new Date();
const at = now.toISOString();
const mission = missionFor(process.env.MANUS_SCHEDULE, process.env.MANUS_MISSION);
const previousAudit = readJson(AUDIT) as AuditFile | undefined;
const raw = readJson(MISSIONS);
let missions: MissionsFile = isMissionsFile(raw) ? raw : emptyMissions();
const council = readJson(COUNCIL) as { tasks?: { id: string; title: string; detail: string; status: string; closedAt?: string; url?: string }[] } | undefined;
const languages = languagesForWeek(weekNumber(now));
const toVerify = tasksToVerify(council?.tasks || [], missions.verified, now.getTime());

const briefs = {
  design: () => ({ title: `Sham Perfume — languages & design audit ${at.slice(0, 10)}`, prompt: auditPrompt(languages, previousAudit), schema: AUDIT_SCHEMA }),
  tour: () => ({ title: `Sham Perfume — shopper tour ${at.slice(0, 10)}`, prompt: tourPrompt(missions.tour), schema: TOUR_SCHEMA }),
  verify: () => ({ title: `Sham Perfume — verify done tasks ${at.slice(0, 10)}`, prompt: verifyPrompt(toVerify), schema: VERIFY_SCHEMA }),
};

const budget = Number(process.env.MANUS_MONTHLY_CREDITS ?? 2000);
const used = creditsThisMonth(missions.runs, at);

if (!mission) {
  // Rehearsal (a push): every brief is built and checked; nothing is sent, no credit is spent.
  for (const [name, brief] of Object.entries(briefs)) {
    const b = brief();
    if (!b.prompt.includes('Sham Perfume') || !b.schema.required.length) { say(`Rehearsal: the ${name} brief is broken`); finish(1); }
    say(`Rehearsal: ${name} brief ready (${b.prompt.length} chars)`);
  }
  say(`Tasks waiting for the external reviewer: ${toVerify.length} · credits this month: ${used}/${budget || '∞'}`);
  finish();
}
const m = mission!;
say(`Mission: ${m}`);

const keep = (run: MissionRun, result?: Parameters<typeof recordRun>[2]) => { missions = recordRun(missions, run, result); write(MISSIONS, missions); };

if (!manusConfigured()) { say('MANUS_API_KEY not set: the mission waits for the key'); finish(); }
const allowed = budgetAllows(m, used, budget);
if (!allowed.ok) { keep({ at, mission: m, status: 'skipped', note: `budget: ${allowed.why}` }); say(`Skipped to save credits: ${allowed.why}`); finish(); }
if (m === 'verify' && !toVerify.length) { say('No council task was closed this week: nothing to verify, no credit spent'); finish(); }
if (m === 'design') say(`Languages this week: ${languages.join(', ')}`);
if (m === 'verify') say(`Verifying ${toVerify.length} task(s): ${toVerify.map((t) => t.title).join(' · ')}`);

try {
  const run = await runManusTask({ ...briefs[m](), profile: process.env.MANUS_PROFILE || 'lite', waitMs: Number(process.env.MANUS_WAIT_MIN || 30) * 60_000 });
  say(`Agent ${run.status} in ${Math.round(run.ms / 1000)}s${run.credits !== undefined ? `, ${run.credits} credits` : ''}${run.taskUrl ? ` — ${run.taskUrl}` : ''}`);
  const base = { at, mission: m, credits: run.credits } as const;
  const unfinished = run.status === 'running' ? 'running' : 'failed';
  if (m === 'design') {
    const result = cleanAudit(run.value);
    write(AUDIT, nextAuditFile(previousAudit, { at, languages, status: result ? 'done' : unfinished, taskId: run.taskId, credits: run.credits, result }));
    keep({ ...base, status: result ? 'done' : unfinished });
    if (result) {
      say(`Score ${result.score}/100 · ${result.issues.length} issues (${result.issues.filter((i) => i.severity === 'high').length} high) — ${result.summaryAr}`);
      for (const i of result.issues.slice(0, 5)) say(`[${i.severity}/${i.area}/${i.language}] ${i.page}: ${i.problem} → ${i.fix}`);
    } else say('No usable report: the last one is kept');
  } else if (m === 'tour') {
    const tour = cleanTour(run.value, at);
    keep({ ...base, status: tour ? 'done' : unfinished }, tour ? { tour: { ...tour, taskId: run.taskId, credits: run.credits } } : undefined);
    if (tour) {
      say(`Tour ${tour.score}/100 — ${tour.summaryAr}`);
      for (const s of tour.journey.filter((x) => !x.ok)) say(`✗ ${STEP_AR[s.step]}: ${s.noteAr}`);
    } else say('No usable tour report: the last one is kept');
  } else {
    const verify = cleanVerify(run.value, toVerify, at);
    keep({ ...base, status: verify ? 'done' : unfinished }, verify ? { verify: { ...verify, taskId: run.taskId, credits: run.credits } } : undefined);
    if (verify) for (const c of verify.checks) say(`${c.verdict === 'fixed' ? '✓' : c.verdict === 'not_fixed' ? '✗' : '?'} ${c.title}: ${c.evidenceAr}`);
    else say('No usable verdicts: the tasks wait for the next review');
  }
} catch (e) {
  const code = e instanceof ManusError ? e.code : 'unreachable';
  if (m === 'design') write(AUDIT, nextAuditFile(previousAudit, { at, languages, status: 'failed' }));
  keep({ at, mission: m, status: 'failed', note: code });
  say(`Manus did not run: ${code}${code === 'no_credit' ? ' (no credits left: waits for the renewal)' : ''}`);
}
finish();
