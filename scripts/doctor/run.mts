/**
 * Entry of «طبيب شاهين» (see agent.ts). GitHub Actions runs it every 10 minutes:
 *   node --import tsx scripts/doctor/run.mts
 * DOCTOR_MODE=dry → probes and report to the console only (no remedies, no writes).
 */
import { GitHub } from './github';
import { makeAsk, runDoctor, shell } from './agent';

const env = process.env;
const mode = env.DOCTOR_MODE === 'live' ? 'live' : 'dry';
const repo = env.GITHUB_REPOSITORY || 'spculculat-oss/Sham-Perfume';
const github = new GitHub(repo, mode === 'live' ? env.GITHUB_TOKEN : env.GITHUB_TOKEN || undefined);
const runUrl = env.GITHUB_RUN_ID ? `${env.GITHUB_SERVER_URL || 'https://github.com'}/${repo}/actions/runs/${env.GITHUB_RUN_ID}` : undefined;

const result = await runDoctor({
  env, github, fetch, sh: shell(process.cwd()), ask: await makeAsk(env), root: process.cwd(), mode,
  runId: env.GITHUB_RUN_ID, runUrl,
});

if (env.GITHUB_STEP_SUMMARY) {
  const { appendFileSync } = await import('node:fs');
  appendFileSync(env.GITHUB_STEP_SUMMARY, `${result.body.replace(/<!-- doctor-state:[^>]+-->/, '')}\n`);
} else if (mode === 'dry') console.log(`\n${result.body.replace(/<!-- doctor-state:[^>]+-->/, '')}`);
for (const n of result.notes) console.log(`note: ${n}`);
