/**
 * «الفحص الشامل قبل الاجتماع» — GitHub Actions runs this two hours before «مجلس شاهين»
 * (.github/workflows/shaheen-precheck.yml):  node --import tsx scripts/shaheen-council/precheck.mts
 * Every robot under Shaheen's umbrella is checked on its own report and its last run; the secretary routes the
 * help requests between the tools. Writes src/data/live/shaheen-precheck.json — the meeting's agenda.
 * Env: GITHUB_TOKEN (actions:read), GITHUB_REPOSITORY.
 */
import { appendFileSync, writeFileSync } from 'node:fs';
import { botOf } from '../../src/utils/shaheenOrg';
import { runPrecheck } from './precheck';
import { loadOwnerControls } from '../owner/load';
import { fetchRuns, readReports } from './runs';

const env = process.env;
const repo = env.GITHUB_REPOSITORY || 'spculculat-oss/Sham-Perfume';
const runs = await fetchRuns(repo, env.GITHUB_TOKEN?.trim());
const result = runPrecheck(readReports(), runs, Date.now(), loadOwnerControls());
writeFileSync(new URL('../../src/data/live/shaheen-precheck.json', import.meta.url), `${JSON.stringify(result, null, 1)}\n`);

const icon = { ok: '🟢', warn: '🟡', fail: '🔴', idle: '⚪' } as const;
console.log(result.summaryAr);
console.log(`Runs read: ${Object.keys(runs).length}`);
for (const b of result.bots) console.log(`${icon[b.status]} ${botOf(b.id)?.nameEn}: ${b.problems.join(' | ') || 'ok'}`);
if (env.GITHUB_ACTIONS) {
  const clip = (t: string) => t.replace(/[\r\n%]/g, ' ').slice(0, 3000);
  console.log(`::notice title=الفحص الشامل قبل الاجتماع::${clip(result.summaryAr)}`);
  const broken = result.bots.filter((b) => b.status === 'fail');
  if (broken.length) console.log(`::warning title=أدوات فيها عطل::${clip(broken.map((b) => `${botOf(b.id)?.nameAr}: ${b.problems.join('، ')}`).join(' | '))}`);
  if (result.handoffs.length) console.log(`::notice title=طلبات المساعدة بين الأدوات::${clip(result.handoffs.map((h) => `${botOf(h.from)?.nameAr} ← ${botOf(h.to)?.nameAr}: ${h.textAr}`).join(' | '))}`);
}
if (env.GITHUB_STEP_SUMMARY) {
  const rows = result.bots.map((b) => `| ${icon[b.status]} | ${botOf(b.id)?.nameAr} | ${b.problems.join('<br>') || '—'} | ${b.fixes.join('<br>') || '—'} | ${b.ideas.join('<br>') || '—'} |`);
  appendFileSync(env.GITHUB_STEP_SUMMARY, `## الفحص الشامل قبل اجتماع شاهين\n\n${result.summaryAr}\n\n| | الأداة | المشاكل | الإصلاح | التطوير |\n|---|---|---|---|---|\n${rows.join('\n')}\n\n### قرارات المدير القانوني (ملزمة)\n${[...new Set(result.bots.flatMap((b) => b.legal || []))].map((x) => `- ${x}`).join('\n') || '- لا يوجد'}\n\n### التعاون بين الأدوات\n${result.handoffs.map((h) => `- ${botOf(h.from)?.nameAr} ← ${botOf(h.to)?.nameAr}: ${h.textAr}`).join('\n') || '- لا يوجد'}\n`);
}
