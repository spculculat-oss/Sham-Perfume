/**
 * Weekly: Shaheen sends his background agent (Manus) to audit the live site's languages and design,
 * and keeps the report in src/data/live/manus-audit.json (admin data, never shown to visitors).
 *   node --import tsx scripts/shaheen-manus/run.mts
 * Env: MANUS_API_KEY (secret), MANUS_PROFILE (lite | standard | max; default lite = fewest credits),
 * MANUS_WAIT_MIN (minutes to wait for the agent, default 30).
 */
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import { ManusError, manusConfigured, runManusTask } from '../../server/core/manus';
import { AUDIT_SCHEMA, auditPrompt, cleanAudit, languagesForWeek, nextAuditFile, weekNumber, type AuditFile } from './audit';

const FILE = new URL('../../src/data/live/manus-audit.json', import.meta.url);
const notes: string[] = [];
const say = (line: string) => { console.log(line); notes.push(line); };
const finish = (code = 0) => {
  if (process.env.GITHUB_ACTIONS) for (const n of notes.slice(-9)) console.log(`::notice title=تدقيق شاهين (Manus)::${n.replace(/\r?\n/g, ' ').slice(0, 900)}`);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## تدقيق اللغات والتصميم (Manus)\n\n${notes.map((n) => `- ${n}`).join('\n')}\n`);
  process.exit(code);
};

if (!manusConfigured()) { say('MANUS_API_KEY not set: the audit waits for the key'); finish(); }

let previous: AuditFile | undefined;
try { previous = JSON.parse(readFileSync(FILE, 'utf8')) as AuditFile; } catch { previous = undefined; }
const now = new Date();
const languages = languagesForWeek(weekNumber(now));
say(`Languages this week: ${languages.join(', ')}`);

try {
  const run = await runManusTask({
    title: `Sham Perfume — languages & design audit ${now.toISOString().slice(0, 10)}`,
    prompt: auditPrompt(languages, previous),
    schema: AUDIT_SCHEMA,
    profile: process.env.MANUS_PROFILE || 'lite',
    waitMs: Number(process.env.MANUS_WAIT_MIN || 30) * 60_000,
  });
  const result = cleanAudit(run.value);
  const status = result ? 'done' : run.status === 'running' ? 'running' : 'failed';
  const file = nextAuditFile(previous, { at: now.toISOString(), languages, status, taskId: run.taskId, credits: run.credits, result });
  writeFileSync(FILE, `${JSON.stringify(file, null, 1)}\n`);
  say(`Agent ${run.status} in ${Math.round(run.ms / 1000)}s${run.credits !== undefined ? `, ${run.credits} credits` : ''}${run.taskUrl ? ` — ${run.taskUrl}` : ''}`);
  if (result) {
    say(`Score ${result.score}/100 · ${result.issues.length} issues (${result.issues.filter((i) => i.severity === 'high').length} high) — ${result.summaryAr}`);
    for (const i of result.issues.slice(0, 5)) say(`[${i.severity}/${i.area}/${i.language}] ${i.page}: ${i.problem} → ${i.fix}`);
  } else say(status === 'running' ? 'The agent is still working: the result stays in the Manus account; last report kept' : `No usable report (${run.text ? run.text.slice(0, 200) : 'empty'}); last report kept`);
} catch (e) {
  const code = e instanceof ManusError ? e.code : 'unreachable';
  writeFileSync(FILE, `${JSON.stringify(nextAuditFile(previous, { at: now.toISOString(), languages, status: 'failed' }), null, 1)}\n`);
  say(`Manus did not run: ${code}${code === 'no_credit' ? ' (no credits left: waits for the renewal)' : ''}`);
}
finish();
