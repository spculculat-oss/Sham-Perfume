/**
 * «كشّاف الشحن» — runs every 6 hours (`.github/workflows/shaheen-carriers.yml`).
 *
 * Reads the real files, opens each candidate carrier's own page (politely: robots.txt first, one page per site,
 * a small budget, a short timeout), and writes `src/data/live/carrier-scout.json`:
 *   · **أخطاء متكررة**: وجهة من غير تعريفة، تعريفة قديمة، شركة مالهاش مصدر، شركة قبولها للعطور مش متأكد،
 *     وشحن من غير هامش تجهيز.
 *   · **بدائل**: كل شركة عندها تعريفة موثّقة (سعر + مصدر + تاريخ) بتتقارن باللي بنستخدمه لكل وجهة.
 *   · **قراءة الصفحات**: اللي الكشّاف شافه بعينه (الصفحة فتحت؟ فيها كلام مواد خطرة؟) — من غير اختراع أي رقم.
 *
 * Usage: node --import tsx scripts/shaheen-carriers/run.mts [--offline]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import type { FxTable, ShippingCosts, ShippingTable } from '../../src/utils/pricing';
import {
  isCarrierScoutReport, scoutCarriers,
  type CarrierCandidate, type CarrierScoutReport, type CurrentCarrier,
} from './scout';

const env = process.env;
const read = (rel: string) => JSON.parse(readFileSync(new URL(`../../${rel}`, import.meta.url), 'utf8'));
const offline = process.argv.includes('--offline') || env.SCOUT_OFFLINE === '1';

const lanes = read('src/data/shipping-lanes.json') as { carriers: CurrentCarrier[] };
const costs = read('src/data/shipping-costs.json') as ShippingCosts;
const shipping = read('src/data/shipping.json') as ShippingTable;
const fx = read('src/data/live/fx-rates.json') as FxTable;
const trade = read('src/data/live/trade-lanes.json') as { destinations: { code: string; nameAr: string }[] };
const candidateFile = read('src/data/carrier-candidates.json') as { candidates: CarrierCandidate[] };

// ── قراءة صفحات الشركات: أدب أولاً (robots.txt)، وبعدين صفحة واحدة بس لكل شركة ─────────────────────
const MAX_FETCHES = 8;
const TIMEOUT_MS = 9000;
type Probe = NonNullable<CarrierScoutReport['probes']>[number];
const SIGNALS: { ar: string; re: RegExp }[] = [
  { ar: 'المواد الخطرة مذكورة في الصفحة', re: /dangerous\s*goods|hazardous|un1266|iata|class\s*3/i },
  { ar: 'العطور مذكورة في الصفحة', re: /perfume|fragrance|عطور|عطر/i },
  { ar: 'فيه أسعار/آلة حساب على الصفحة', re: /rate|price|pricing|quote|tariff|تعريفة|سعر/i },
  { ar: 'فيه صفحة/بند تتبع', re: /track|تتبع/i },
];

async function get(url: string): Promise<{ status: number; text: string } | null> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { 'user-agent': 'ShaheenCarrierScout/1.0 (+https://spculculat-oss.github.io/Sham-Perfume/)' },
      redirect: 'follow',
    });
    const text = (await res.text()).slice(0, 240_000);
    return { status: res.status, text };
  } catch { return null; }
}

const robotsAllowed = new Map<string, boolean>();
/** أدب أولاً: لو robots.txt بيمنع الكل («Disallow: /») مانلمسش الصفحة. */
async function mayRead(origin: string): Promise<boolean> {
  const known = robotsAllowed.get(origin);
  if (known !== undefined) return known;
  let allowed = true;
  const robots = await get(`${origin}/robots.txt`);
  if (robots && robots.status === 200) {
    let forAll = false;
    for (const line of robots.text.split(/\r?\n/)) {
      const text = line.replace(/#.*$/, '').trim();
      const [rawKey, ...rest] = text.split(':');
      const key = (rawKey || '').trim().toLowerCase();
      const value = rest.join(':').trim();
      if (key === 'user-agent') forAll = value === '*';
      else if (forAll && key === 'disallow' && (value === '/' || value === '/*')) allowed = false;
    }
  }
  robotsAllowed.set(origin, allowed);
  return allowed;
}

const probes: Probe[] = [];
if (!offline) {
  let budget = MAX_FETCHES;
  for (const c of candidateFile.candidates.slice(0, 4)) {
    if (budget <= 0) break;
    let origin = '';
    try { origin = new URL(c.ratesUrl).origin; } catch { continue; }
    budget -= 1; // robots.txt
    if (!(await mayRead(origin))) {
      probes.push({ id: c.id, url: c.ratesUrl, status: null, reached: false, signals: [], noteAr: 'robots.txt بيمنع القراءة — مالمسناش الصفحة' });
      continue;
    }
    if (budget <= 0) break;
    budget -= 1;
    const page = await get(c.ratesUrl);
    probes.push(page === null
      ? { id: c.id, url: c.ratesUrl, status: null, reached: false, signals: [], noteAr: 'الصفحة مافتتحتش من الشبكة — منعرفش حاجة عنها في التشغيل ده' }
      : { id: c.id, url: c.ratesUrl, status: page.status, reached: page.status >= 200 && page.status < 400, signals: SIGNALS.filter((s) => s.re.test(page.text)).map((s) => s.ar), noteAr: 'قراية صفحة الشركة نفسها — الأرقام مش بتتقرا آلياً، بتتسجل بإيد بمصدرها وتاريخها' });
  }
}

const report = scoutCarriers({
  now: Date.now(),
  costs,
  destinations: trade.destinations,
  carriers: lanes.carriers.map((c) => ({
    id: c.id, nameAr: c.nameAr, dg: c.dg, source: c.source ?? null, checkedAt: c.checkedAt ?? null,
    originCountry: c.originCountry ?? null, scope: c.scope,
  })),
  candidates: candidateFile.candidates,
  shipping,
  fx,
});

if (probes.length) report.probes = probes;
if (!isCarrierScoutReport(report)) { console.error('::error::carrier scout report is not valid'); process.exit(1); }

writeFileSync(new URL('../../src/data/live/carrier-scout.json', import.meta.url), `${JSON.stringify(report, null, 1)}\n`);

console.log(report.summaryAr);
console.log(`- الدرجة: ${report.score}/100 · الهامش على الشحن: ${report.rules.handlingPercent}% · التعريفة القديمة بعد ${report.rules.staleDays} يوم`);
for (const line of report.planAr) console.log(`- ${line}`);
for (const e of report.errors.slice(0, 12)) console.log(`${e.level === 'warn' ? '!' : '?'} ${e.whatAr}`);
if (report.probes?.length) for (const p of report.probes) console.log(`· ${p.id}: ${p.reached ? `HTTP ${p.status}` : 'مش متاح'}${p.signals.length ? ` — ${p.signals.join(' · ')}` : ''}`);

if (env.GITHUB_STEP_SUMMARY) {
  const errRows = report.errors.map((e) => `| ${e.level === 'warn' ? '⚠️' : 'ℹ️'} | ${e.whatAr} | ${e.fixAr} |`);
  const candRows = report.candidates.map((c) => `| ${c.nameAr} | ${c.originCountry} | ${c.state === 'verified' ? '✅ موثّقة' : c.state === 'rejected' ? '⛔ مرفوضة' : '⏳ من غير سعر موثّق'} | ${c.whyAr} | ${c.beatsCurrent} | ${c.savingEgp} |`);
  const saveRows = report.savings.rows.map((r) => `| ${r.nameAr} | ${r.currentEgp} | ${r.candidateEgp} | ${r.savingEgp} (${r.savingPercent}%) | ${r.candidateNameAr} |`);
  const probeRows = (report.probes || []).map((p) => `| ${p.id} | ${p.reached ? `HTTP ${p.status}` : 'مش متاح'} | ${p.signals.join(' · ') || '—'} |`);
  const lines = [
    '## كشّاف الشحن',
    '',
    report.summaryAr,
    '',
    `- الدرجة: **${report.score}/100** · وجهات بسعر موثّق: ${report.coverage.priced}/${report.coverage.destinations}`,
    `- التوفير الممكن: ${report.savings.totalEgp} ج.م في ${report.savings.destinations} وجهة`,
    '',
    '### البدائل',
    '| الشركة | المصدر | الحالة | ليه | بتكسب في | التوفير (ج.م) |',
    '|---|---|---|---|---|---|',
    candRows.join('\n') || '| — | — | — | — | — | — |',
    ...(saveRows.length ? ['', '### أرخص بديل لكل وجهة', '| الوجهة | بنستخدم (ج.م) | البديل (ج.م) | التوفير | الشركة |', '|---|---|---|---|---|', saveRows.join('\n')] : []),
    '',
    '### الأخطاء اللي اتلقت',
    '| | المشكلة | الإصلاح |',
    '|---|---|---|',
    errRows.join('\n') || '| — | مفيش | — |',
    ...(probeRows.length ? ['', '### قراية صفحات الشركات', '| الشركة | الصفحة | اللي شفناه |', '|---|---|---|', probeRows.join('\n')] : []),
  ];
  writeFileSync(env.GITHUB_STEP_SUMMARY, `${lines.join('\n')}\n`, { flag: 'a' });
}
if (env.GITHUB_ACTIONS) {
  const clip = (t: string) => t.replace(/[\r\n%]/g, ' ').slice(0, 2800);
  console.log(`::notice title=Shaheen carrier scout::${clip(report.summaryAr)}`);
  const bad = report.errors.filter((e) => e.level === 'warn').length;
  if (bad) console.log(`::warning title=Shaheen carrier scout::${clip(`${bad} خطأ في تسعير الشحن أو أمان المواد الخطرة — التقرير فيه الإصلاح`)}`);
}
