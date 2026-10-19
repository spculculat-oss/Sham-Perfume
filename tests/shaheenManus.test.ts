import assert from 'node:assert/strict';
import { test } from 'node:test';
import { manusCodeOf, manusConfigured, manusWhoAmI, runManusTask, ManusError } from '../server/core/manus';
import { AUDIT_SCHEMA, auditPrompt, cleanAudit, languagesForWeek, nextAuditFile, type AuditFile } from '../scripts/shaheen-manus/audit';
import type { LanguageConfig } from '../src/types/i18n';

type Call = { url: string; method: string; headers: Record<string, string>; body?: unknown };
function fakeManus(routes: Record<string, (call: Call) => { status?: number; body: unknown }>) {
  const calls: Call[] = [];
  const request = (async (url: string, init: RequestInit = {}) => {
    const call: Call = { url, method: init.method || 'GET', headers: init.headers as Record<string, string>, body: init.body ? JSON.parse(String(init.body)) : undefined };
    calls.push(call);
    const path = new URL(url).pathname;
    const route = routes[path];
    const out = route ? route(call) : { status: 404, body: { ok: false, error: { code: 'not_found' } } };
    return new Response(JSON.stringify(out.body), { status: out.status ?? 200, headers: { 'Content-Type': 'application/json' } });
  }) as unknown as typeof fetch;
  return { request, calls };
}
const noSleep = async () => {};

test('the Manus key is checked with the free read-only call, sent only in its own header', async () => {
  const { request, calls } = fakeManus({ '/v2/user.me': () => ({ body: { ok: true, id: 'u1' } }) });
  const r = await manusWhoAmI({ key: 'k-123', request });
  assert.equal(r.code, 'ok');
  assert.equal(calls[0].headers['x-manus-api-key'], 'k-123');
  assert.equal(calls[0].method, 'GET');
  const bad = fakeManus({ '/v2/user.me': () => ({ status: 401, body: { ok: false, error: { code: 'unauthenticated', message: 'bad key' } } }) });
  assert.equal((await manusWhoAmI({ key: 'x', request: bad.request })).code, 'invalid_key');
  assert.equal((await manusWhoAmI({ key: '', request: bad.request })).code, 'not_configured');
  assert.equal(manusConfigured({ MANUS_API_KEY: '  ' }), false);
});

test('Manus errors map to the site\'s fixed key codes', () => {
  assert.equal(manusCodeOf(429, { code: 'rate_limited' }), 'rate_limited');
  assert.equal(manusCodeOf(400, { code: 'invalid_argument', message: 'Insufficient credits' }), 'no_credit');
  assert.equal(manusCodeOf(403, { code: 'permission_denied' }), 'invalid_key');
  assert.equal(manusCodeOf(500, { code: 'internal' }), 'upstream_error');
});

test('a task is created with the schema, followed until the agent stops, and its structured result returned', async () => {
  let polls = 0;
  const { request, calls } = fakeManus({
    '/v2/task.create': () => ({ body: { ok: true, task_id: 'T1', task_url: 'https://manus.im/app/T1' } }),
    '/v2/task.detail': () => ({ body: { ok: true, task: { status: ++polls < 3 ? 'running' : 'stopped', credit_usage: 42 } } }),
    '/v2/task.listMessages': () => ({ body: { ok: true, messages: [
      { type: 'structured_output_result', structured_output_result: { success: true, value: { summaryAr: 'جيد', score: 80, strengthsAr: [], issues: [] } } },
      { type: 'assistant_message', assistant_message: { content: 'Done.' } },
    ] } }),
  });
  const r = await runManusTask({ key: 'k', request, title: 't', prompt: 'p', schema: AUDIT_SCHEMA, sleep: noSleep });
  assert.equal(r.status, 'stopped');
  assert.equal(r.credits, 42);
  assert.deepEqual(r.value, { summaryAr: 'جيد', score: 80, strengthsAr: [], issues: [] });
  assert.equal(r.text, 'Done.');
  const create = calls[0].body as Record<string, unknown>;
  assert.equal(create.agent_profile, 'lite', 'fewest credits unless asked otherwise');
  assert.equal(create.interactive_mode, false);
  assert.ok(create.structured_output_schema);
});

test('an agent still working after the wait is reported as running, a rejected key throws a coded error', async () => {
  const slow = fakeManus({
    '/v2/task.create': () => ({ body: { ok: true, task_id: 'T2' } }),
    '/v2/task.detail': () => ({ body: { ok: true, task: { status: 'running' } } }),
  });
  const r = await runManusTask({ key: 'k', request: slow.request, title: 't', prompt: 'p', waitMs: 0, sleep: noSleep });
  assert.equal(r.status, 'running');
  assert.equal(r.value, undefined);
  const denied = fakeManus({ '/v2/task.create': () => ({ status: 402, body: { ok: false, error: { code: 'x', message: 'no credits' } } }) });
  await assert.rejects(runManusTask({ key: 'k', request: denied.request, title: 't', prompt: 'p', sleep: noSleep }), (e) => e instanceof ManusError && e.code === 'no_credit');
});

test('every week checks Arabic and English plus rotating languages, one of them right-to-left', () => {
  const langs = ['ar', 'en', 'fr', 'de', 'es', 'it', 'ur', 'fa'].map((code) => ({ code, dir: ['ar', 'ur', 'fa'].includes(code) ? 'rtl' : 'ltr' }) as LanguageConfig);
  const w1 = languagesForWeek(1, langs);
  assert.deepEqual(w1.slice(0, 2), ['ar', 'en']);
  assert.equal(w1.length, 5);
  assert.ok(w1.slice(2).some((c) => c === 'ur' || c === 'fa'));
  assert.notDeepEqual(languagesForWeek(2, langs), w1, 'rotates');
  assert.ok(auditPrompt(w1).includes('do not buy anything'));
});

test('the structured schema follows Manus rules: every object closed with all properties required', () => {
  const check = (s: Record<string, unknown>) => {
    if (s.type === 'object') {
      assert.equal(s.additionalProperties, false);
      assert.deepEqual([...(s.required as string[])].sort(), Object.keys(s.properties as object).sort());
      for (const v of Object.values(s.properties as Record<string, Record<string, unknown>>)) check(v);
    }
    if (s.type === 'array') check(s.items as Record<string, unknown>);
  };
  check(AUDIT_SCHEMA);
});

test('the agent\'s report is cleaned, and a failed run keeps the last good report', () => {
  const result = cleanAudit({ summaryAr: 'ملخص', score: 140, strengthsAr: ['سريع'], issues: [
    { area: 'languages', severity: 'high', language: 'fr', page: 'المتجر', problem: 'زر غير مترجم «Add to cart»', fix: 'Ajouter au panier' },
    { area: 'hack', severity: 'urgent', language: '', page: '', problem: 'x', fix: '' },
    { area: 'design', severity: 'low', language: 'ar', page: 'p', problem: '   ', fix: 'f' },
  ] });
  assert.ok(result);
  assert.equal(result.score, 100);
  assert.equal(result.issues.length, 2);
  assert.deepEqual([result.issues[1].area, result.issues[1].severity, result.issues[1].language], ['design', 'low', 'all']);
  assert.equal(cleanAudit({}), undefined);
  const done = nextAuditFile(undefined, { at: '2026-10-17T06:15:00Z', languages: ['ar', 'en'], status: 'done', taskId: 'T', result });
  assert.equal(done.history.length, 1);
  const failed: AuditFile = nextAuditFile(done, { at: '2026-10-24T06:15:00Z', languages: ['ar', 'en', 'fr'], status: 'failed' });
  assert.equal(failed.status, 'failed');
  assert.equal(failed.summaryAr, 'ملخص');
  assert.equal(failed.issues.length, 2);
});

// ── The background agent's missions: visitor tour, external reviewer, shared monthly budget ──
import { readFileSync } from 'node:fs';
import {
  SCHEDULES, TOUR_SCHEMA, VERIFY_SCHEMA, budgetAllows, cleanTour, cleanVerify, creditsThisMonth, emptyMissions, missionFor,
  recordRun, tasksToVerify, tourPrompt, verifyPrompt,
} from '../scripts/shaheen-manus/missions';
import { runPrecheck } from '../scripts/shaheen-council/precheck';
import { buildBriefing, chairPrompt, fieldOpinion, selfMinutes } from '../scripts/shaheen-council/council';
import { cleanAdvisor, ranToday } from '../scripts/shaheen-manus/missions';

test('each schedule runs its own mission, a manual choice wins, and a push only rehearses', () => {
  const wf = readFileSync(new URL('../.github/workflows/shaheen-manus.yml', import.meta.url), 'utf8');
  for (const cron of Object.keys(SCHEDULES)) assert.ok(wf.includes(`- cron: '${cron}'`), cron);
  assert.equal(missionFor('20 5 * * *'), 'tour');
  assert.ok(/workflow_run:\s*\n\s*workflows: \['Shaheen pre-meeting full check'\]/.test(wf), 'the tour follows the pre-meeting check');
  const pre = readFileSync(new URL('../.github/workflows/shaheen-precheck.yml', import.meta.url), 'utf8');
  assert.match(pre, /^name: Shaheen pre-meeting full check$/m);
  assert.equal(missionFor('15 6 * * 3,6'), 'design');
  assert.equal(missionFor('0 8 * * 1,4'), 'verify');
  assert.equal(missionFor('20 5 * * *', 'verify'), 'verify');
  assert.equal(missionFor('', ''), undefined);
  assert.equal(missionFor(undefined, 'buy-things'), undefined);
});

test('the monthly credit budget is shared: the tour gives way at 70%, the others at 100%', () => {
  const runs = [
    { at: '2026-10-02T03:00:00Z', mission: 'tour' as const, status: 'done' as const, credits: 600 },
    { at: '2026-10-05T06:15:00Z', mission: 'design' as const, status: 'done' as const, credits: 900 },
    { at: '2026-09-30T03:00:00Z', mission: 'tour' as const, status: 'done' as const, credits: 5000 },
  ];
  const used = creditsThisMonth(runs, '2026-10-19T03:00:00Z');
  assert.equal(used, 1500);
  assert.equal(budgetAllows('tour', used, 2000).ok, false);
  assert.equal(budgetAllows('design', used, 2000).ok, true);
  assert.equal(budgetAllows('verify', 2000, 2000).ok, false);
  assert.equal(budgetAllows('tour', 99999, 0).ok, true);
});

test('the briefs follow the Manus schema rules and forbid paying, accounts and forms', () => {
  for (const schema of [TOUR_SCHEMA, VERIFY_SCHEMA]) {
    const walk = (s: Record<string, unknown>) => {
      if (s.type === 'object') {
        assert.equal(s.additionalProperties, false);
        assert.deepEqual([...(s.required as string[])].sort(), Object.keys(s.properties as object).sort());
        for (const v of Object.values(s.properties as Record<string, Record<string, unknown>>)) walk(v);
      }
      if (s.type === 'array') walk(s.items as Record<string, unknown>);
    };
    walk(schema as Record<string, unknown>);
  }
  const tour = tourPrompt();
  assert.match(tour, /never pay/);
  assert.match(tour, /do not create accounts/);
  const verify = verifyPrompt([{ id: 'T-1', title: 'إصلاح السلة', detail: 'زر السلة لا يعمل' }]);
  assert.match(verify, /### T-1/);
});

test('the tour report is cleaned: known steps once, bounded numbers, trimmed text', () => {
  const t = cleanTour({ summaryAr: 'تمام', score: 140, journey: [
    { step: 'home', ok: true, seconds: 3, noteAr: 'سريع' }, { step: 'home', ok: false, seconds: 1, noteAr: 'مكرر' },
    { step: 'checkout', ok: false, seconds: -5, noteAr: 'زر الدفع لا يفتح' }, { step: 'hack', ok: true, seconds: 1, noteAr: 'x' },
  ], issues: [{ area: 'weird', severity: 'urgent', problem: 'صورة مكسورة', fix: '' }, { problem: '' }] }, '2026-10-19T03:20:00Z')!;
  assert.equal(t.score, 100);
  assert.deepEqual(t.journey.map((s) => s.step), ['home', 'checkout']);
  assert.equal(t.journey[1].seconds, 0);
  assert.deepEqual(t.issues.map((i) => [i.area, i.severity]), [['store', 'low']]);
  assert.equal(cleanTour(null, 'x'), undefined);
});

test('the reviewer checks only this week\'s done tasks, once fixed they are not checked again', () => {
  const now = Date.parse('2026-10-19T08:00:00Z');
  const tasks = [
    { id: 'a', title: 'A', detail: '', status: 'done', closedAt: '2026-10-18T10:00:00Z', url: 'u' },
    { id: 'b', title: 'B', detail: '', status: 'done', closedAt: '2026-10-01T10:00:00Z' },
    { id: 'c', title: 'C', detail: '', status: 'open' },
    { id: 'd', title: 'D', detail: '', status: 'done', closedAt: '2026-10-17T10:00:00Z' },
  ];
  const due = tasksToVerify(tasks, [], now);
  assert.deepEqual(due.map((t) => t.id), ['a', 'd']);
  const v = cleanVerify({ summaryAr: 'ok', checks: [{ id: 'a', verdict: 'fixed', evidenceAr: 'تمام' }, { id: 'd', verdict: '???', evidenceAr: '' }, { id: 'zzz', verdict: 'fixed', evidenceAr: '' }] }, due, '2026-10-19T08:30:00Z')!;
  assert.deepEqual(v.checks.map((c) => [c.id, c.verdict]), [['a', 'fixed'], ['d', 'cannot_tell']]);
  const file = recordRun(emptyMissions(), { at: v.at, mission: 'verify', status: 'done', credits: 30 }, { verify: v });
  assert.deepEqual(file.verified, ['a']);
  assert.deepEqual(tasksToVerify(tasks, file.verified, now).map((t) => t.id), ['d']);
});

test('the pre-meeting check and the meeting read the tour and the reviewer; a broken checkout is urgent', () => {
  const NOW = Date.parse('2026-10-19T04:30:00Z');
  const missions = {
    version: 1, updatedAt: '2026-10-19T03:25:00Z', verified: [], runs: [],
    tour: { at: '2026-10-19T03:25:00Z', summaryAr: 'الدفع واقع', score: 55, journey: [{ step: 'home', ok: true, seconds: 2, noteAr: '' }, { step: 'checkout', ok: false, seconds: 9, noteAr: 'صفحة الدفع فاضية' }], issues: [{ area: 'store', severity: 'high', language: 'ar', page: '#store', problem: 'صورة', fix: '' }] },
    verify: { at: '2026-10-18T08:30:00Z', summaryAr: '', checks: [{ id: 'x', title: 'إصلاح السلة', verdict: 'not_fixed', evidenceAr: 'لسه' }] },
  };
  const pre = runPrecheck({ 'manus-missions.json': missions }, {}, NOW);
  const tour = pre.bots.find((b) => b.id === 'visitor_tour')!;
  assert.equal(tour.status, 'fail');
  assert.equal(tour.reportAt, missions.tour.at);
  assert.equal(pre.bots.find((b) => b.id === 'verifier')!.status, 'warn');
  assert.ok(pre.handoffs.some((h) => h.from === 'visitor_tour' && h.to === 'product_pages'));
  const b = buildBriefing({ missions, manus: { score: 62 } }, Date.parse('2026-10-19T07:30:00Z'));
  assert.ok(b.facts.some((f) => f.includes('62/100')));
  assert.ok(b.signals.some((s) => s.priority === 'high' && s.decision?.title.includes('checkout')));
  assert.ok(b.signals.some((s) => s.decision?.title === 'إعادة فتح: إصلاح السلة'));
});

test('«المستشار الميداني»: his proposals are cleaned — no AI names, no links, nothing against the legal manager', () => {
  const a = cleanAdvisor({ opinionAr: 'جربت الموقع من الموبايل الصبح ولقيت صفحة الدفع بطيئة جداً وصور كتير مش ظاهرة في المتجر https://x.y', proposals: [
    { title: 'تسريع صفحة الدفع', detail: 'بتاخد 9 ثواني', area: 'experience', priority: 'high', rerun: 'none' },
    { title: 'استئناف نقل المنتجات من المورد', detail: 'شغّل المستورد', area: 'store', priority: 'high', rerun: 'shaheen-import.yml' },
    { title: 'استخدام Gemini في الشات', detail: '', area: 'ai-tools', priority: 'low', rerun: 'none' },
    { title: 'تحديث الأخبار', detail: 'النشرة قديمة', area: 'weird', priority: 'now', rerun: 'shaheen-news.yml' },
    { title: 'x', detail: '', area: 'store', priority: 'low', rerun: 'rm -rf' },
  ] })!;
  assert.equal(a.opinionAr.includes('http'), false);
  assert.deepEqual(a.proposals.map((p) => [p.title, p.area, p.priority, p.rerun]), [
    ['تسريع صفحة الدفع', 'experience', 'high', undefined], ['تحديث الأخبار', 'experience', 'medium', 'shaheen-news.yml']]);
  assert.equal(cleanAdvisor({ opinionAr: 'قصير', proposals: [] }), undefined);
  const prompt = tourPrompt(undefined, { problems: ['Importer: آخر تشغيل فشل'], openTasks: ['إصلاح عطل: منظف الصور'], legal: ['L-03: وقف نقل المنتجات'] });
  assert.match(prompt, /PART 2/);
  assert.match(prompt, /Importer: آخر تشغيل فشل/);
  assert.match(prompt, /do not propose them again/);
  assert.match(prompt, /L-03/);
});

test('the field advisor sits at the meeting as a sixth seat, and his proposals reach the agenda and the secretary', () => {
  const at = '2026-10-19T05:30:00Z';
  const missions = { version: 1, updatedAt: at, verified: [], runs: [], tour: { at, summaryAr: 'تمام', score: 80, journey: [{ step: 'cart', ok: false, seconds: 4, noteAr: 'زر السلة' }], issues: [],
    advisor: { opinionAr: 'جربت الموقع من الموبايل الصبح: المتجر سريع لكن زر الإضافة للسلة مش بيستجيب من أول مرة، وده أهم حاجة النهارده.', proposals: [
      { title: 'إصلاح زر الإضافة للسلة', detail: 'محتاج ضغطتين', area: 'store', priority: 'high' },
      { title: 'تحديث الأخبار', detail: 'النشرة قديمة', area: 'content', priority: 'low', rerun: 'shaheen-news.yml' }] } } };
  const meetingAt = Date.parse('2026-10-19T06:30:00Z');
  const seat = fieldOpinion(missions, meetingAt)!;
  assert.equal(seat.seat, 'field');
  assert.equal(seat.ok, true);
  assert.match(seat.text, /إصلاح زر الإضافة للسلة/);
  assert.match(seat.text, /خطوات واقعة: cart/);
  assert.equal(fieldOpinion(missions, meetingAt + 12 * 3600_000), undefined, 'yesterday\'s opinion is not read');
  const b = buildBriefing({ missions }, meetingAt);
  const mine = b.signals.filter((s) => s.text.startsWith('المستشار الميداني'));
  assert.equal(mine.length, 2);
  assert.equal(mine[1].decision?.kind, 'auto');
  assert.deepEqual(mine[1].decision?.action, { type: 'rerun', workflow: 'shaheen-news.yml' });
  assert.match(chairPrompt(b, [seat], []), /### المستشار الميداني/);
  assert.ok(selfMinutes(b, '2026-10-19', ['مفيش محرك']).decisions.some((d) => d.title === 'إصلاح زر الإضافة للسلة'));
});

test('a mission runs once a day: a done or still-running task is not started again, a failed one may retry', () => {
  const now = '2026-10-19T05:20:00Z';
  assert.equal(ranToday([{ at: '2026-10-19T04:45:00Z', mission: 'tour', status: 'running' }], 'tour', now), true);
  assert.equal(ranToday([{ at: '2026-10-19T04:45:00Z', mission: 'tour', status: 'failed' }], 'tour', now), false);
  assert.equal(ranToday([{ at: '2026-10-18T04:45:00Z', mission: 'tour', status: 'done' }], 'tour', now), false);
  assert.equal(ranToday([{ at: '2026-10-19T04:45:00Z', mission: 'verify', status: 'done' }], 'tour', now), false);
});
