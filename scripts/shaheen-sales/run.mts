/**
 * «مدير المبيعات» — GitHub Actions runs this every 6 hours
 * (`.github/workflows/shaheen-sales.yml`):  node --import tsx scripts/shaheen-sales/run.mts
 *
 * Reads the sales desk through the admin API (read-only) and writes `src/data/live/shaheen-sales.json`.
 * Only counts leave the server: no amounts, no deal titles, no customer labels, no order references and no
 * contact details. Without a token (or when the server is down) it still studies the curriculum from the
 * local playbook and says plainly that the live desk was not read — no invented number.
 * Env: SHAM_SALES_API_URL, SHAM_ADMIN_TOKEN, SALES_PUBLISH.
 */
import { writeFileSync } from 'node:fs';
import { buildSalesReport, type DeskFacts } from './desk';
import { lessonOfDay } from '../../src/sales/playbook';
import type { SalesDashboard } from '../../server/sales/service';

const env = process.env;
const origin = (env.SHAM_SALES_API_URL || 'https://sham-perfume-49bf.vercel.app').trim();
const token = env.SHAM_ADMIN_TOKEN?.trim() || '';
const now = Date.now();

class ApiError extends Error {
  constructor(public code: string) { super(code); }
}

async function readDesk(): Promise<SalesDashboard> {
  const response = await fetch(new URL('/api/admin/finance/sales', origin), {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    signal: AbortSignal.timeout(20_000),
    redirect: 'error',
  });
  if (!response.ok) throw new ApiError(`HTTP_${response.status}`);
  return await response.json() as SalesDashboard;
}

const failed: string[] = [];
let facts: DeskFacts | null = null;
let results: SalesDashboard['study']['results'] = [];

let url: URL | undefined;
try { url = new URL(origin); } catch { url = undefined; }
// https everywhere; plain http only for a loopback rehearsal on the developer's own machine.
const loopback = Boolean(url && url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname));
const originOk = Boolean(url && (url.protocol === 'https:' || loopback) && !url.username && !url.password && !url.search && !url.hash && url.pathname === '/');

if (!token || token.length < 12) failed.push('token:NO_ADMIN_TOKEN');
else if (!originOk) failed.push('origin:INVALID_ORIGIN');
else {
  try {
    const desk = await readDesk();
    results = Array.isArray(desk.study?.results) ? desk.study.results : [];
    const todayLesson = lessonOfDay(now).id;
    const todayKey = new Date(now).toISOString().slice(0, 10);
    facts = {
      paidOrdersToday: (desk.live?.today || []).reduce((n, row) => n + Math.max(0, Number(row.paidOrders) || 0), 0),
      paidOrdersMonth: (desk.live?.month || []).reduce((n, row) => n + Math.max(0, Number(row.paidOrders) || 0), 0),
      waitingConfirmation: Number(desk.live?.waitingConfirmation) || 0,
      awaitingTransfer: Number(desk.live?.awaitingTransfer) || 0,
      openDeals: desk.pipeline.openCount, overdue: desk.pipeline.overdueCount, withoutNextStep: desk.pipeline.withoutNextStep,
      silent: Number(desk.pipeline.silentCount) || 0,
      won: desk.pipeline.wonCount, lost: desk.pipeline.lostCount, winRate: desk.pipeline.winRate,
      bestSellers: (desk.live?.bestSellers || []).map((p) => ({ sku: String(p.sku), units: Number(p.units) || 0 })),
      targets: (desk.targetsPace || []).map((t) => ({ currency: String(t.currency), pace: t.pace, daysLeft: Number(t.daysLeft) || 0 })),
      health: { score: Number(desk.health?.score) || 0, labelAr: String(desk.health?.labelAr || '') },
      // Counts only: the week against the week before, straight from the desk's review.
      ordersThisWeek: (desk.review?.compare || []).reduce((n, row) => n + Math.max(0, Number(row.thisOrders) || 0), 0),
      ordersLastWeek: (desk.review?.compare || []).reduce((n, row) => n + Math.max(0, Number(row.lastOrders) || 0), 0),
      studyAnsweredToday: results.some((r) => r.lessonId === todayLesson && String(r.at).slice(0, 10) === todayKey),
    };
  } catch (error) {
    failed.push(error instanceof ApiError ? error.code : (error as Error)?.name === 'TimeoutError' ? 'TIMEOUT' : 'NETWORK');
  }
}

const report = buildSalesReport({ now, live: { checked: Boolean(facts), at: new Date(now).toISOString(), failed }, facts, results });
writeFileSync(new URL('../../src/data/live/shaheen-sales.json', import.meta.url), `${JSON.stringify(report, null, 1)}\n`);

console.log(report.summaryAr);
console.log(`Curriculum: ${report.curriculum.lessons} lessons · ${report.curriculum.handbookSections.length} handbook sections · ${report.curriculum.principles} principles · ${report.curriculum.pitfalls} pitfalls`);
console.log(`Live desk: ${report.live.checked ? 'read' : 'not read'}${report.live.failed.length ? ` — ${report.live.failed.join(', ')}` : ''}`);
for (const finding of report.findings) console.log(`- [${finding.level}] ${finding.textAr}`);
for (const line of report.planAr) console.log(`  ${line}`);

if (env.GITHUB_STEP_SUMMARY) {
  const lines = [
    `## مدير المبيعات — ${report.updatedAt}`,
    '',
    report.summaryAr,
    '',
    '### المنهج',
    `- الدروس: ${report.curriculum.lessons} · أقسام الكتيب: ${report.curriculum.handbookSections.join('، ')}`,
    `- درس النهارده: «${report.study.titleAr}» (${report.study.module}) — ${report.study.handbook.join('، ')}`,
    `- دراسة: ${report.study.progress.studied} إجابة · ${report.study.progress.percent ?? 0}% صحيحة${report.study.answeredToday === null ? '' : report.study.answeredToday ? ' · درس النهارده اتجاوب' : ' · درس النهارده لسه'}`,
    '',
    '### الملاحظات',
    ...report.findings.map((f) => `- **${f.level}** — ${f.textAr}`),
    '',
    '### خطة المذاكرة',
    ...report.planAr.map((line) => `- ${line}`),
    '',
    '> التقرير أعداد بس: مفيش مبالغ ولا أسماء عملاء ولا أرقام طلبات — المبالغ في سجل «بنك شام» الخاص.',
  ];
  writeFileSync(env.GITHUB_STEP_SUMMARY, `${lines.join('\n')}\n`, { flag: 'a' });
}
if (env.GITHUB_ACTIONS) {
  const clip = (text: string) => text.replace(/[\r\n%]/g, ' ').slice(0, 2800);
  console.log(`::notice title=Sales desk::${clip(report.summaryAr)}`);
  if (report.findings.some((f) => f.level === 'fail')) console.log(`::warning title=Sales desk::${clip(report.findings.filter((f) => f.level === 'fail').map((f) => f.textAr).join(' | '))}`);
}
