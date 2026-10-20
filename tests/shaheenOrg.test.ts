/**
 * «الهيكل الإداري لمنصة شام» — every robot and AI tool under Shaheen's umbrella, the pre-meeting full check,
 * the secretary deputising under pressure, and the help requests between the tools.
 */
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { AI_TOOLS } from '../src/utils/aiTools';
import { BOTS, DEPARTMENTS, LINKS, orgMermaid, SECRETARY, unplacedTools, botOf, LEGAL_DECISIONS } from '../src/utils/shaheenOrg';
import { findHandoffs, isPrecheckFile, nextMeeting, pressureOf, runPrecheck } from '../scripts/shaheen-council/precheck';
import { buildBriefing, cairoDate, emptyCouncil, recordDelegation, secretaryRoutine, selfMinutes, unreviewed, type Meeting } from '../scripts/shaheen-council/council';
import { orgDoc } from '../scripts/shaheen-council/org-doc';

const NOW = Date.parse('2026-10-18T04:30:00Z');
const ago = (h: number) => new Date(NOW - h * 3600_000).toISOString();

test('every robot (workflow) and every AI tool is placed under Shaheen — a new one must be registered', () => {
  const workflows = readdirSync(new URL('../.github/workflows/', import.meta.url)).filter((f) => /\.ya?ml$/.test(f));
  const placed = new Set(BOTS.map((b) => b.workflow));
  const missing = workflows.filter((w) => !placed.has(w));
  assert.deepEqual(missing, [], `Add these robots to BOTS in src/utils/shaheenOrg.ts: ${missing.join(', ')}`);
  for (const b of BOTS) if (b.workflow) assert.ok(workflows.includes(b.workflow), `${b.id}: ${b.workflow} does not exist`);
  assert.deepEqual(unplacedTools(), [], 'Every AI tool (src/utils/aiTools.ts) belongs to a bot in the structure');
  assert.equal(AI_TOOLS.length, new Set(BOTS.flatMap((b) => b.aiTools || [])).size);
});

test('the structure: unique ids, five departments each with bots, links between real bots, a secretary', () => {
  assert.equal(new Set(BOTS.map((b) => b.id)).size, BOTS.length);
  assert.equal(DEPARTMENTS.length, 5);
  for (const d of DEPARTMENTS) assert.ok(BOTS.some((b) => b.dept === d.id), d.id);
  for (const l of LINKS) { assert.ok(botOf(l.from) && botOf(l.to), `${l.from} → ${l.to}`); assert.notEqual(l.from, l.to); }
  assert.equal(botOf(SECRETARY.bot)?.dept, 'leadership');
  assert.equal(botOf('legal')?.dept, 'leadership');
  assert.equal(botOf('design_expert')?.dept, 'experience');
  assert.deepEqual(botOf('design_expert')?.aiTools, ['design_agent']);
  assert.ok(LINKS.some((link) => link.from === 'catalog' && link.to === 'design_expert'));
  for (const d of LEGAL_DECISIONS) assert.ok(botOf(d.bot), d.id);
  // Every bot works with at least one other (coordination, not islands) — except on-demand helpers.
  const linked = new Set(LINKS.flatMap((l) => [l.from, l.to]));
  const islands = BOTS.filter((b) => !linked.has(b.id) && !['store_advisor', 'admin_agent', 'images', 'catalog'].includes(b.id)).map((b) => b.id);
  assert.ok(islands.length <= 2, `bots without any cooperation link: ${islands.join(', ')}`);
  for (const b of BOTS) if (b.report) assert.match(b.report, /^[a-z-]+\.json$/);
  const m = orgMermaid();
  assert.match(m, /^flowchart TB/);
  for (const b of BOTS) assert.ok(m.includes(`${b.id}["`), b.id);
});

test('SHAHEEN_ORG.md is generated from the registry and up to date (node --import tsx scripts/shaheen-council/org-doc.mts)', () => {
  assert.equal(readFileSync(new URL('../SHAHEEN_ORG.md', import.meta.url), 'utf8'), orgDoc());
});

const reports = {
  'shaheen-council.json': { updatedAt: ago(22), meetings: [{ mode: 'self' }], tasks: [{ status: 'open', createdAt: ago(24 * 9) }] },
  'ai-supervisor.json': { updatedAt: ago(3), overall: 6.5, tools: { seo_agent: { nameAr: 'منارة شاهين', score: 4, status: 'fail' }, shaheen_chat: { nameAr: 'الخبير شاهين', score: 7 }, store_advisor: { nameAr: 'مستشار', score: 9 } } },
  'import-sources.json': { updatedAt: ago(30), sources: [{ status: 'active' }, { status: 'rejected', reason: 'صفحات غير مقروءة بدون ذكاء اصطناعي' }] },
  'store-review.json': { updatedAt: ago(1), summary: { total: 100, warn: 50, hidden: 20, brokenImages: 3 } },
  'shaheen-news.json': { updatedAt: ago(5), items: [] },
  'seo-agent.json': { updatedAt: ago(2), audit: { score: 55, findings: [{ area: 'meta', title: 'وصف مفقود' }] }, trust: { level: 'trainee' } },
  'shaheen-languages.json': { updatedAt: ago(10), score: 68, publicNumberInputs: ['x'], incompletePacks: [], bareLocaleFormatting: [1, 2] },
  'manus-audit.json': { updatedAt: ago(48), score: 62, issues: [1, 2, 3] },
  'shaheen-school.json': { updatedAt: ago(4), reliance: { score: 44 }, pending: [{ q: 'العنبر' }] },
  'ai-quota.json': { updatedAt: ago(1), engines: { openai: { pausedUntil: new Date(NOW + 3600_000).toISOString() } } },
  'aistudio-intake.json': { updatedAt: ago(100), checks: { at: ago(100), tests: 'failure', lint: 'success' } },
};
const runs = {
  'live-smoke.yml': { conclusion: 'failure', status: 'completed', at: ago(20), url: 'https://github.com/x/runs/1' },
  'pages.yml': { conclusion: 'success', status: 'completed', at: ago(2) },
  'shaheen-doctor.yml': { conclusion: 'cancelled', status: 'completed', at: ago(1) },
};

test('the full check: every bot gets a status with its problems, fixes and development ideas', () => {
  const r = runPrecheck(reports, runs, NOW);
  assert.ok(isPrecheckFile(r));
  assert.equal(r.bots.length, BOTS.length);
  assert.equal(r.meetingAt, '2026-10-18T06:30:00.000Z', 'two hours before the meeting');
  const by = (id: string) => r.bots.find((b) => b.id === id)!;
  assert.equal(by('live_check').status, 'fail');
  assert.ok(by('live_check').fixes.length);
  assert.equal(by('doctor').status, 'warn');
  assert.equal(by('deploy').status, 'ok');
  assert.equal(by('inspect').status, 'idle', 'no run and no report = no data, not a failure');
  assert.equal(by('scout').status, 'fail', 'report 30h old for a 6-hourly robot');
  assert.ok(by('scout').problems.some((p) => /متأخر/.test(p)));
  assert.equal(by('news').status, 'fail');
  assert.equal(by('seo').status, 'fail');
  assert.ok(by('seo').ideas.some((i) => /متدرب/.test(i)));
  assert.equal(by('languages').status, 'fail');
  assert.equal(by('school').status, 'fail');
  assert.equal(by('keys').status, 'warn');
  assert.equal(by('intake').status, 'fail');
  assert.ok(by('council').problems.some((p) => /أسبوع/.test(p)));
  assert.equal(by('importer').status, 'warn');
  assert.equal(by('chat').status, 'ok');
  assert.ok(by('chat').ideas.length, 'a 7/10 tool gets a development idea');
  assert.equal(r.counts.ok + r.counts.warn + r.counts.fail + r.counts.idle, BOTS.length);
  assert.ok(r.health > 0 && r.health < 100);
  assert.match(r.summaryAr, /الفحص الشامل/);
  assert.equal(nextMeeting(Date.parse('2026-10-18T07:00:00Z')), '2026-10-19T06:30:00.000Z');
});

test('help requests between the tools, and the secretary reruns a late robot (safe workflows only, once)', () => {
  const r = runPrecheck(reports, runs, NOW);
  const pairs = r.handoffs.map((h) => `${h.from}>${h.to}`);
  for (const p of ['importer>images', 'importer>catalog', 'seo>catalog', 'school>news', 'scout>importer', 'design_audit>languages', 'keys>secretary']) assert.ok(pairs.includes(p), p);
  const reruns = r.handoffs.filter((h) => h.action);
  assert.deepEqual(reruns.map((h) => h.action), [{ type: 'rerun', workflow: 'shaheen-discover.yml' }], 'the late scout is rerun; school shares its workflow → once');
  assert.deepEqual(findHandoffs({}, [], NOW), []);
  const design = findHandoffs({ 'manus-audit.json': { score: 60, issues: [{ area: 'design', problem: 'تباين ضعيف' }, { area: 'languages', problem: 'ترجمة ناقصة' }] } }, [], NOW);
  assert.ok(design.some((h) => h.from === 'design_audit' && h.to === 'design_expert'));
  assert.ok(design.some((h) => h.from === 'design_audit' && h.to === 'languages'));
});

test('the secretary deputises: no engine, quotas out, busy engines, the chair failing, or pressure', () => {
  assert.deepEqual(pressureOf({ engines: 2, spoke: 5, urgent: 1, failing: 0 }), { active: false, reasons: [] });
  assert.ok(pressureOf({ engines: 0, urgent: 0, failing: 0 }).active);
  assert.ok(pressureOf({ engines: 1, quotaOut: true, urgent: 0, failing: 0 }).active);
  assert.ok(pressureOf({ engines: 2, spoke: 1, urgent: 0, failing: 0 }).active);
  assert.ok(pressureOf({ engines: 2, spoke: 5, chairFailed: true, urgent: 0, failing: 0 }).active);
  assert.match(pressureOf({ engines: 2, spoke: 5, urgent: 6, failing: 0 }).reasons.join(), /ضغط/);
  assert.match(pressureOf({ engines: 2, spoke: 5, urgent: 0, failing: 3 }).reasons.join(), /روبوت/);
});

test('the meeting takes the check as its agenda; the secretary chairs or takes the routine; Shaheen reviews it', () => {
  const pre = runPrecheck(reports, runs, NOW);
  const now = NOW + 2 * 3600_000;
  const b = buildBriefing({ precheck: pre }, now);
  assert.ok(b.facts.includes(pre.summaryAr));
  assert.ok(b.facts.some((f) => f.startsWith('تعاون:')));
  assert.ok(b.facts.some((f) => f.startsWith('أفكار تطوير')));
  assert.ok(b.facts.some((f) => f.startsWith('قرارات المدير القانوني السارية') && f.includes('L-03')), 'the meeting is told the legal decisions are binding');
  assert.ok(!b.signals.some((s) => /المدير القانوني|L-03/.test(s.text)), 'no signal / task to work around a legal decision');
  const fixes = b.signals.filter((s) => s.decision?.title.startsWith('إصلاح عطل'));
  assert.ok(fixes.some((s) => /فحص شاهين على الموقع الحي/.test(s.decision!.title)));
  assert.ok(!fixes.some((s) => /كشّاف/.test(s.decision!.title)), 'a merely late robot is rerun, not a task');
  assert.ok(b.signals.some((s) => s.decision?.action?.type === 'rerun'));
  // An old check is ignored (the meeting runs it again).
  assert.equal(buildBriefing({ precheck: pre }, NOW + 20 * 3600_000).facts.includes(pre.summaryAr), false);

  const date = cairoDate(new Date(now).toISOString());
  const reasons = pressureOf({ engines: 0, urgent: 0, failing: 0 }).reasons;
  const sm = selfMinutes(b, date, reasons);
  assert.match(sm.summaryAr, /السكرتير/);
  assert.ok(sm.decisions.every((d) => d.by === 'secretary'));
  const file = emptyCouncil();
  const m1: Meeting = { date, at: new Date(now).toISOString(), mode: 'self', ...sm, seats: [], chair: 'secretary', deputyReasons: reasons };
  recordDelegation(file, m1);
  assert.equal(unreviewed(file).length, 1);
  // Next day Shaheen chairs: the routine is taken by the secretary, and its earlier work is marked reviewed.
  const routine = secretaryRoutine(b, '2026-10-19', []);
  assert.ok(routine.length && routine.every((d) => d.by === 'secretary' && d.kind === 'auto'));
  assert.deepEqual(secretaryRoutine(b, '2026-10-19', routine), []);
  recordDelegation(file, { date: '2026-10-19', at: '2026-10-19T06:30:00Z', mode: 'ai', summaryAr: '', decisions: routine, toolGoals: {}, seats: [], chair: 'shaheen' });
  assert.equal(unreviewed(file).length, 0);
  assert.equal(file.delegations!.length, 2);
});

test('Shaheen council receives a safe design-specific handoff when the supervised design agent needs improvement', () => {
  const privateFinding = 'PRIVATE-DRAFT-OR-USER-DETAIL';
  const r = runPrecheck({ 'ai-supervisor.json': { updatedAt: ago(1), tools: { design_agent: {
    status: 'fail', checkedAt: ago(1), score: 4, issues: [privateFinding, 'missing accessibility review'],
  } } } }, {}, NOW);
  assert.equal(r.bots.find((bot) => bot.id === 'design_expert')?.status, 'warn');
  const handoff = r.handoffs.find((item) => item.from === 'design_expert' && item.to === 'council');
  assert.ok(handoff);
  assert.match(handoff!.textAr, /4\/10/);
  assert.match(handoff!.textAr, /2 ملاحظة جودة/);
  assert.doesNotMatch(JSON.stringify(r), new RegExp(privateFinding));
});

test('finance joins Shaheen leadership without publishing ledger content or inventing a healthy check', () => {
  assert.equal(botOf('finance')?.dept, 'leadership');
  assert.equal(botOf('finance')?.workflow, 'shaheen-finance.yml');
  for (const tool of [undefined, { status: 'skipped' }, { status: 'ok', checkedAt: ago(40), score: 10 }]) {
    const r = runPrecheck({ 'ai-supervisor.json': { updatedAt: ago(1), tools: { finance_agent: tool } } }, {}, NOW);
    assert.equal(r.bots.find((b) => b.id === 'finance')?.status, 'warn');
  }
  const r = runPrecheck({ 'ai-supervisor.json': { updatedAt: ago(1), tools: { finance_agent: {
    status: 'fail', checkedAt: ago(1), score: 3, issues: ['PRIVATE-LEDGER-NOTE'], amount: 123456,
  } } } }, {}, NOW);
  assert.equal(r.bots.find((b) => b.id === 'finance')?.status, 'fail');
  assert.ok(r.handoffs.some((h) => h.from === 'finance' && h.to === 'secretary' && !h.action));
  assert.ok(!JSON.stringify(r).includes('PRIVATE-LEDGER-NOTE')); assert.ok(!JSON.stringify(r).includes('123456'));
});
