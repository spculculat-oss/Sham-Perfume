/**
 * «الدورية بالتناوب» — GitHub Actions runs this every hour, one monitoring shift at a time; each role's records are
 * checked every 3 hours (.github/workflows/shaheen-patrol.yml):
 *   node --import tsx scripts/shaheen-patrol/run.mts
 * The selected shift's report/run/supervisor status plus its hands-on probes → safe fixes (approved workflows only)
 * → Shaheen for unresolved issues (AI when an engine answers; his recorded playbook otherwise, and the item waits)
 * → task forces for shared problems → expert reviews of finished workflows. Roles without a workflow, such as the
 * design expert, are monitored from existing supervisor records; this patrol does not invoke those agents.
 * Writes src/data/live/shaheen-patrol.json; GITHUB_OUTPUT reruns=<workflows> publish=true|false.
 * Env: PATROL_SHIFT=0|1|2|all (default: this hour's shift), PATROL_ACT=true (main only: issues; the workflow starts the reruns), PATROL_LIVE=false (skip the live
 * tests), GITHUB_TOKEN, GITHUB_REPOSITORY, the AI keys.
 */
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { SITE } from '../../src/seo/site';
import type { BotId } from '../../src/utils/shaheenOrg';
import { mergeCatalog, type RawProduct } from '../../src/utils/storeCatalog';
import { BUNDLED_FX, COUNTRY_CODES, currencyFor } from '../../src/utils/pricing';
import { getCountryMeta } from '../../src/utils/countryCurrencyMeta';
import { STORE_CORE_KEYS } from '../../src/لغات/storeKeys';
import { storeCoreCoverage } from '../../src/لغات/storeL10n';
import { SUPPORTED_LANGUAGES } from '../../src/types/i18n';
import { PRICE_MARKUP } from '../shaheen-import/transform';
import { configuredEngines, keyFingerprint, makeAsk, QuotaExhaustedError, quotaBook } from '../doctor/agent';
import { parseJson } from '../shaheen-supervisor/checks';
import { runPrecheck } from '../shaheen-council/precheck';
import { fetchRuns, readReports } from '../shaheen-council/runs';
import {
  ASKS_PER_SHIFT, isPatrolFile, isPatrolRerunnable, shiftAt, shiftOfBot, SHIFTS, type ProbeId, type ShiftIndex, MAX_TASKS_PER_DAY, parseShaheen, patrolIssue, issueMarker, probeCatalog, probeCurrency, probeFx, probeL10n, probeNewsFile,
  probePricing, PROBES, reviewerOf, runPatrol, shaheenPrompt, SHAHEEN_SYSTEM, shouldPublish, signatureOf, type PatrolFile, type ProbeResult, REVIEWERS,
} from './patrol';
import { liveProbes } from './probes';
import { duePrograms, patrolActions, runAndRecord } from '../shaheen-school/programs';
import { emptyBlocks, isBlocksFile, type BlocksFile } from '../../src/utils/shaheenBlocks';

const env = process.env;
const live = (name: string) => new URL(`../../src/data/live/${name}`, import.meta.url);
const FILE = live('shaheen-patrol.json');
const now = Date.now();
const at = new Date(now).toISOString();
const act = env.PATROL_ACT === 'true';
const notes: string[] = [];
const say = (line: string) => { console.log(line); notes.push(line); };
const previous: PatrolFile | undefined = (() => { try { const d: unknown = existsSync(FILE) ? JSON.parse(readFileSync(FILE, 'utf8')) : undefined; return isPatrolFile(d) ? d : undefined; } catch { return undefined; } })();

// ── 0. This hour's monitoring shift (each role every 3 hours, one probe group at a time) ─────────────────
const shiftEnv = (env.PATROL_SHIFT || '').trim();
const shift: ShiftIndex | 'all' = shiftEnv === 'all' ? 'all' : /^[012]$/.test(shiftEnv) ? (Number(shiftEnv) as ShiftIndex) : shiftAt(now);
const inShift = (id: BotId) => shift === 'all' || shiftOfBot(id) === shift;
say(`Shift: ${shift === 'all' ? 'all role records and probes (manual monitoring pass)' : `${SHIFTS[shift].nameEn} — ${SHIFTS[shift].bots.join(', ')}`}`);

// ── 1. Each tool's own check (the pre-meeting rules) ──────────────────────────────────────────────────────
const repo = env.GITHUB_REPOSITORY || 'spculculat-oss/Sham-Perfume';
const token = env.GITHUB_TOKEN?.trim();
const precheck = runPrecheck(readReports(), await fetchRuns(repo, token), now);
say(`Self-checks: ${precheck.summaryAr}`);

// ── 2. Hands-on tests of every scope ─────────────────────────────────────────────────────────────────────
const readJson = (url: URL): unknown => { try { return JSON.parse(readFileSync(url, 'utf8')); } catch { return undefined; } };
const raw = ((readJson(new URL('../../src/data/products.json', import.meta.url)) as { products?: RawProduct[] } | undefined)?.products) || [];
const visible = mergeCatalog(raw, readJson(live('store-catalog.json')) as never);
// The expert reviewer of a bot (of this shift) that finished a run since its last review tests its whole
// scope with a bigger sample — even the tests that belong to another shift.
const finished = precheck.bots.filter((b) => inShift(b.id) && b.lastRun?.status === 'completed' && b.lastRun.at && previous?.reviewedRuns?.[b.id] !== b.lastRun.at);
const deep = Object.fromEntries(finished.flatMap((b) => reviewerOf(b.id).probes).map((p) => [p, true]));
const wanted = new Set<ProbeId>([...(shift === 'all' ? SHIFTS.flatMap((x) => x.probes) : SHIFTS[shift].probes), ...(Object.keys(deep) as ProbeId[])]);
const LOCAL: Partial<Record<ProbeId, () => ProbeResult>> = {
  pricing: () => probePricing(raw as never, PRICE_MARKUP),
  catalog: () => probeCatalog(visible),
  currency: () => probeCurrency(COUNTRY_CODES, (c) => getCountryMeta(c).currency, (c) => currencyFor(c), BUNDLED_FX.rates),
  fx: () => probeFx(BUNDLED_FX, now),
  l10n: () => probeL10n(Object.fromEntries(SUPPORTED_LANGUAGES.map((l) => [l.code, storeCoreCoverage(l.code)])), STORE_CORE_KEYS.length),
  news_file: () => probeNewsFile(readJson(live('shaheen-news.json')) as never, now),
};
const probes: ProbeResult[] = (Object.keys(LOCAL) as ProbeId[]).filter((id) => wanted.has(id)).map((id) => LOCAL[id]!());
const liveWanted = [...wanted].filter((id) => PROBES[id].live);
if (env.PATROL_LIVE !== 'false' && liveWanted.length) {
  probes.push(...await liveProbes({
    pages: SITE.url, engine: SITE.engineUrl, hour: Math.floor(now / (3 * 3_600_000)), deep,
    products: visible.map((p) => ({ sku: p.sku, slug: p.slug, price: p.price, images: p.images })),
  }, liveWanted));
} else if (env.PATROL_LIVE === 'false') say('Live tests skipped (PATROL_LIVE=false)');
for (const p of probes) say(`Test «${PROBES[p.id].nameAr}»${p.deep ? ' (expert, big sample)' : ''}: ${p.level} — ${p.noteAr}`);

// ── 3. Decide: fixes, Shaheen, task forces, reviews ──────────────────────────────────────────────────────
const quota = quotaBook(live('ai-quota.json'));
const engines = (await configuredEngines(env)).filter((id) => !quota.pausedUntil(id, keyFingerprint(env, id)));
const plan = runPatrol({ now, precheck, probes, previous, engineReady: engines.length > 0, shift });
const { file } = plan;
say(`Reviews: ${file.reviews.filter((r) => r.runAt && plan.file.reviewedRuns[r.bot] === r.runAt && !previous?.reviews.some((x) => x.bot === r.bot && x.runAt === r.runAt)).map((r) => `${r.reviewerAr} ← ${r.verdict}`).join('، ') || 'none'}`);

// ── 3b. «بلوكات شاهين»: the due block programs run here for real — above all «إدارة الذكاء الذاتي»:
// Shaheen measures his self-reliance and answers memory → library → local model → an honest note, with no
// external AI app. The site-care programme reports from this hour's probes only (never guessed).
const blocksRaw = readJson(live('shaheen-blocks.json'));
const blocks: BlocksFile = isBlocksFile(blocksRaw) ? blocksRaw : emptyBlocks();
const schoolReport = readJson(live('shaheen-school.json')) as {
  reliance?: { score: number; covered: number; total: number; fromMemory: number; fromLibrary: number };
  localTaughtTotal?: number; pending?: unknown[]; spelling?: { score: number };
} | undefined;
const probeNotes = Object.fromEntries(probes.map((p) => [p.id, `${PROBES[p.id].nameAr}: ${p.level === 'ok' ? 'سليم ✅' : p.level === 'warn' ? 'بملاحظات ⚠️' : p.level === 'skip' ? 'متخطى ⏭️' : 'فشل ❌'} — ${p.noteAr}`]));
const due = duePrograms(blocks, 'patrol', now);
if (due.length) {
  const actions = patrolActions({
    reliance: schoolReport?.reliance || { score: 0, covered: 0, total: 0, fromMemory: 0, fromLibrary: 0 },
    localTaught: schoolReport?.localTaughtTotal || 0,
    pending: (schoolReport?.pending || []).length,
    spellingScore: schoolReport?.spelling?.score,
    probes: probeNotes,
    openIssues: file.open.length,
  });
  for (const program of due) {
    const report = await runAndRecord(program, actions, blocks, {
      externalEngineUp: engines.length > 0,
      siteUp: (probes.find((p) => p.id === 'site')?.level ?? 'ok') !== 'fail',
      gaps: (schoolReport?.pending || []).length,
    }, new Date(now));
    const failed = report.steps.filter((s) => s.status === 'failed');
    say(`البرنامج «${program.title}»: ${report.ok ? 'اشتغل بالكامل' : `مع ${failed.length} خطوة فاشلة`} (${report.steps.length} خطوة)`);
    for (const step of report.steps) if (step.detail) say(`  ${step.label}: ${step.detail}`);
  }
  blocks.updatedAt = at;
  writeFileSync(live('shaheen-blocks.json'), `${JSON.stringify(blocks, null, 1)}\n`);
} else say('بلوكات شاهين: لا برامج مستحقة هذه الجولة — مواعيدها لسه ما جاش');

// Shaheen diagnoses what the tools could not fix (one question per shift — the visitors' quota comes first).
let quotaOut = false;
for (const item of plan.ask.slice(0, ASKS_PER_SHIFT)) {
  if (quotaOut) break;
  let engine = '';
  const ask = await makeAsk(env, { bot: 'patrol', quota, prefer: engines[0], maxWaitMs: 30_000, onEngine: (id) => { engine = id; } }).catch(() => undefined);
  if (!ask) break;
  try {
    const answer = parseShaheen(parseJson(await ask(SHAHEEN_SYSTEM, shaheenPrompt(item))), at);
    const target = file.open.find((i) => i.key === item.key)!;
    if (answer) {
      target.shaheen = answer; target.status = 'shaheen';
      target.nextAr = `شاهين شخّصها: ${answer.diagnosisAr.slice(0, 160)}`;
      say(`Shaheen (${engine}) on «${item.textAr.slice(0, 60)}»: ${answer.diagnosisAr.slice(0, 120)}`);
      // His safe rerun, if the robot was not started in the last hours.
      if (answer.rerun && !plan.reruns.includes(answer.rerun) && !file.reruns.some((r) => r.workflow === answer.rerun && now - Date.parse(r.at) < 6 * 3_600_000)) {
        plan.reruns.push(answer.rerun);
        file.reruns.push({ at, workflow: answer.rerun, key: item.key });
        target.tries.push({ at, workflow: answer.rerun });
        target.status = 'fixing';
        target.nextAr = `شاهين شغّل ${answer.rerun} — الدورية الجاية تتأكد بالتجربة`;
      }
      if (answer.needsCode && target.level === 'fail' && !target.issue && !plan.tasks.some((t) => t.key === target.key)) plan.tasks.push(target);
    } else { target.status = 'waiting_shaheen'; say(`Shaheen's answer on «${item.textAr.slice(0, 60)}» was not usable — the item waits`); }
  } catch (error) {
    if (error instanceof QuotaExhaustedError) quotaOut = true;
    const target = file.open.find((i) => i.key === item.key);
    if (target) { target.status = 'waiting_shaheen'; target.nextAr = `${target.nextAr.split(' — ')[0]} — شاهين ماقدرش يرد دلوقتي (${quotaOut ? 'الباقة خلصت' : 'المحرك ماردش'})، المشكلة مستنياه للتجديد`; }
    say(`Shaheen could not answer (${String((error as Error)?.message || error).slice(0, 80)})`);
  }
}
if (!engines.length) say('No AI engine works now — Shaheen answers from his recorded playbook; items needing a diagnosis wait for him');

// ── 4. Development tasks for what stays broken (issues, main only; deduplicated; 2 a day) ────────────────
const gh = async (path: string, init: RequestInit = {}) => {
  const r = await fetch(`https://api.github.com/repos/${repo}${path}`, {
    ...init, headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`, 'X-GitHub-Api-Version': '2022-11-28', 'Content-Type': 'application/json', ...(init.headers || {}) },
    signal: AbortSignal.timeout(20_000),
  });
  return { ok: r.ok, status: r.status, data: await r.json().catch(() => undefined) as unknown };
};
type Issue = { number: number; state: string; body?: string; created_at: string; pull_request?: unknown };
if (token && act) {
  const res = await gh('/issues?labels=shaheen-patrol&state=all&per_page=100').catch(() => undefined);
  const issues = (res?.ok && Array.isArray(res.data) ? res.data as Issue[] : []).filter((i) => !i.pull_request);
  // Items whose task is still open stay linked; a closed task re-tested broken may get a new one.
  for (const item of file.open) {
    const linked = issues.find((i) => i.state === 'open' && i.body?.includes(issueMarker(item.key)));
    if (linked) { item.issue = linked.number; item.status = 'task'; item.nextAr = `مهمة تطوير #${linked.number} لوكيل البرمجة («نفذ مهام شاهين»)`; }
    else if (item.issue && issues.some((i) => i.number === item.issue && i.state === 'closed')) { item.issue = undefined; }
  }
  let budget = MAX_TASKS_PER_DAY - issues.filter((i) => now - Date.parse(i.created_at) < 86_400_000).length;
  if (plan.tasks.length && budget > 0) {
    for (const [name, color, description] of [['shaheen-task', 'b8860b', 'مهمة تطوير من اجتماع شاهين اليومي'], ['shaheen-patrol', '5319e7', 'من الدورية كل ساعة'], ['priority-high', 'b60205', ''], ['priority-medium', 'fbca04', '']] as const) {
      await gh('/labels', { method: 'POST', body: JSON.stringify({ name, color, description }) }).catch(() => undefined);
    }
  }
  for (const item of plan.tasks) {
    if (budget <= 0) { say(`Task for «${item.textAr.slice(0, 60)}» waits for tomorrow's quota (${MAX_TASKS_PER_DAY} a day)`); continue; }
    const target = file.open.find((i) => i.key === item.key);
    if (!target || target.issue) continue;
    const res = await gh('/issues', { method: 'POST', body: JSON.stringify(patrolIssue(target)) }).catch(() => undefined);
    const issue = res?.data as { number?: number } | undefined;
    if (res?.ok && issue?.number) { budget--; target.issue = issue.number; target.status = 'task'; target.nextAr = `مهمة تطوير #${issue.number} لوكيل البرمجة («نفذ مهام شاهين»)`; say(`Task #${issue.number}: ${target.textAr.slice(0, 80)}`); }
    else say(`Task for «${target.textAr.slice(0, 60)}» not opened (HTTP ${res?.status ?? 'error'})`);
  }
} else if (plan.tasks.length) say(`Rehearsal: ${plan.tasks.length} task(s) not opened — ${plan.tasks.map((t) => t.textAr.slice(0, 60)).join(' | ')}`);

// ── 5. Write, and tell the workflow what to run and whether to publish ───────────────────────────────────
const reruns = plan.reruns.filter(isPatrolRerunnable);
if (!act) {
  // Rehearsal: nothing was started, so nothing is recorded as tried.
  file.reruns = previous?.reruns || [];
  for (const i of file.open) i.tries = i.tries.filter((t) => t.at !== at);
}
file.signature = signatureOf(file);
const publish = shouldPublish(file, previous, now);
if (publish) file.publishedAt = at;
writeFileSync(FILE, `${JSON.stringify(file, null, 1)}\n`);
say(file.summaryAr);
say(`Reruns: ${reruns.join(' ') || 'none'} · publish: ${publish}`);

if (env.GITHUB_OUTPUT) appendFileSync(env.GITHUB_OUTPUT, `reruns=${act ? reruns.join(' ') : ''}\npublish=${publish}\n`);
if (env.GITHUB_ACTIONS) {
  const clip = (t: string) => t.replace(/[\r\n%]/g, ' ').slice(0, 3000);
  console.log(`::notice title=${file.shift?.nameAr || 'الدورية الكاملة'}::${clip(file.summaryAr)}`);
  console.log(`::notice title=الاختبارات العملية::${clip(file.probes.map((p) => `${p.id}=${p.level}${p.deep ? '*' : ''} (${p.noteAr})`).join(' | '))}`);
  console.log(`::notice title=شاهين والمراجعات::${clip(notes.filter((n) => /^(Shaheen|Reviews|Task|Rehearsal|No AI)/.test(n)).join(' | ') || '—')}`);
  for (const i of file.open.filter((x) => x.level === 'fail').slice(0, 8)) console.log(`::warning title=${clip(i.textAr.slice(0, 80))}::${clip(i.nextAr)}`);
}
if (env.GITHUB_STEP_SUMMARY) {
  const reviewed = file.reviews.filter((r) => !previous?.reviews.some((x) => x.bot === r.bot && x.runAt === r.runAt));
  appendFileSync(env.GITHUB_STEP_SUMMARY, [
    `## ${file.shift?.nameAr || 'الدورية الكاملة'} — ${at.slice(0, 16).replace('T', ' ')} UTC`, '', file.summaryAr, '',
    '### الاختبارات العملية', ...file.probes.map((p) => `- ${p.level === 'ok' ? '✅' : p.level === 'skip' ? '⏭️' : p.level === 'warn' ? '⚠️' : '❌'} **${PROBES[p.id].nameAr}**${p.deep ? ' (فحص خبير)' : ''}: ${p.noteAr}`), '',
    '### المشاكل المفتوحة', ...(file.open.length ? file.open.map((i) => `- [${i.level}] ${i.textAr}\n  ← ${i.nextAr}${i.team ? `\n  فريق العمل: ${i.team.map((p) => `${p.bot} (${p.roleAr})`).join('، ')}` : ''}`) : ['- مفيش']), '',
    '### مراجعات الخبراء', ...(reviewed.length ? reviewed.map((r) => `- **${r.reviewerAr}** ← ${r.verdict === 'approved' ? 'اتقبل ✅' : `اترفض ❌: ${r.defects.join('؛ ')}`}`) : ['- مفيش شغل جديد']), '',
    `خبراء الفحص المعتمدين: ${Object.keys(REVIEWERS).length}`, '',
  ].join('\n'));
}
