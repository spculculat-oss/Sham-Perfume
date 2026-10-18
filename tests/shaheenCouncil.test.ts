/**
 * «مجلس شاهين» — the daily development meeting: briefing from the bots' reports, checked minutes, safe
 * actions only, tasks opened once and tracked through GitHub issues, and what the other bots take from it.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyMeeting, buildBriefing, cairoDate, checkAction, councilGoal, councilSeeds, councilStudy, duplicateOf, emptyCouncil, isCouncilFile,
  issueBody, parseMinutes, SEATS, selfMinutes, syncTasks, type Meeting,
} from '../scripts/shaheen-council/council';
import { councilQuestions, buildBank } from '../scripts/shaheen-school/school';
import { AI_TOOLS } from '../src/utils/aiTools';
import { PROBES } from '../scripts/shaheen-supervisor/probes';
import { reviewPrompt } from '../scripts/shaheen-supervisor/checks';

const NOW = Date.parse('2026-10-18T07:00:00Z');
const AT = new Date(NOW).toISOString();
const DATE = cairoDate(AT);

const live = {
  supervisor: { overall: 7, tools: {
    shaheen_chat: { nameAr: 'الخبير شاهين', score: 9, status: 'ok', issues: [] },
    seo_agent: { nameAr: 'منارة شاهين', score: 4, status: 'fail', issues: ['العناوين مكررة'] },
  } },
  school: { reliance: { score: 44, covered: 36, total: 82 }, pending: [{ q: 'ايه هو العنبر؟' }] },
  sources: { updatedAt: AT, sources: Array.from({ length: 10 }, (_, i) => ({ status: i < 8 ? 'rejected' : 'candidate' })) },
  review: { updatedAt: new Date(NOW - 20 * 3600_000).toISOString(), summary: { total: 100, ok: 80, warn: 10, hidden: 10, brokenImages: 2 } },
  seo: { audit: { score: 52, bySeverity: { critical: 2, major: 3 }, findings: [{ severity: 'critical', title: 'وصف مفقود', page: '/', fix: 'أضف وصفاً' }] } },
  news: { updatedAt: new Date(NOW - 40 * 3600_000).toISOString(), items: [1, 2] },
  quota: { engines: { openai: { pausedUntil: new Date(NOW + 3600_000).toISOString(), reason: 'credit' } } },
};

test('the council has five specialist seats, Shaheen first, and the date is Cairo time', () => {
  assert.equal(SEATS.length, 5);
  assert.equal(SEATS[0]!.id, 'manager');
  assert.equal(new Set(SEATS.map((s) => s.id)).size, 5);
  assert.equal(cairoDate('2026-10-17T22:30:00Z'), '2026-10-18');
});

test('the briefing turns the bots\' real reports into facts and signals with decisions', () => {
  const b = buildBriefing(live, NOW);
  assert.ok(b.facts.some((f) => f.includes('44%')));
  assert.ok(b.facts.some((f) => f.includes('openai')));
  const titles = b.signals.flatMap((s) => (s.decision ? [s.decision.title] : []));
  assert.ok(titles.includes('رفع جودة منارة شاهين'));
  assert.ok(titles.includes('إصلاح أهم ملاحظات الظهور في البحث'));
  assert.ok(titles.includes('تحسين قبول المتاجر الجديدة في كشّاف المصادر'));
  const rerun = b.signals.filter((s) => s.decision?.action?.type === 'rerun').map((s) => (s.decision!.action as { workflow: string }).workflow);
  assert.deepEqual(rerun.sort(), ['shaheen-import.yml', 'shaheen-news.yml']);
  assert.equal(b.signals.find((s) => s.text.includes('منارة'))?.decision?.tool, 'seo_agent');
  // Empty reports: still a meeting, never a crash.
  assert.ok(buildBriefing({}, NOW).facts.length >= 1);
});

test('only actions from the fixed list are accepted', () => {
  assert.deepEqual(checkAction({ type: 'rerun', workflow: 'shaheen-news.yml' }), { type: 'rerun', workflow: 'shaheen-news.yml' });
  assert.equal(checkAction({ type: 'rerun', workflow: 'pages.yml' }), undefined);
  assert.equal(checkAction({ type: 'shell', command: 'rm -rf /' }), undefined);
  assert.deepEqual(checkAction({ type: 'scout-seed', domain: 'https://www.Oud-Store.com/ar/' }), { type: 'scout-seed', domain: 'oud-store.com' });
  assert.equal(checkAction({ type: 'scout-seed', domain: 'not a domain' }), undefined);
  assert.equal(checkAction({ type: 'study', question: 'ايه أسعار العود اليوم؟' }), undefined, 'time-bound questions are never memorised');
  assert.deepEqual(checkAction({ type: 'study', question: 'ايه الفرق بين العود الكمبودي والهندي؟' }), { type: 'study', question: 'ايه الفرق بين العود الكمبودي والهندي؟' });
});

test('the chair\'s minutes are checked: bad actions become tasks, vendor names and unknown tools dropped', () => {
  const m = parseMinutes({
    summary: 'ملخص الاجتماع',
    decisions: [
      { title: 'شغّل الأخبار', detail: 'متأخرة', area: 'content', priority: 'high', kind: 'auto', action: { type: 'rerun', workflow: 'shaheen-news.yml' } },
      { title: 'انشر الموقع', detail: '…', kind: 'auto', action: { type: 'rerun', workflow: 'pages.yml' }, needsApproval: true },
      { title: 'x', detail: 'too short' },
      { title: 'تحسين صفحة المنتج', detail: 'أضف صوراً أكبر', area: 'weird', priority: 'urgent', kind: 'task', tool: 'no_such_tool' },
    ],
    toolGoals: { seo_agent: 'عناوين فريدة لكل صفحة منتج', shaheen_chat: 'استخدم Gemini أكثر', fake_tool: 'هدف طويل بما يكفي' },
  }, DATE)!;
  assert.equal(m.decisions.length, 3);
  assert.equal(m.decisions[0]!.kind, 'auto');
  assert.equal(m.decisions[1]!.kind, 'task', 'a non-whitelisted action becomes a task');
  assert.equal(m.decisions[1]!.needsApproval, true);
  assert.equal(m.decisions[2]!.area, 'reliability');
  assert.equal(m.decisions[2]!.priority, 'medium');
  assert.equal(m.decisions[2]!.tool, undefined);
  assert.deepEqual(Object.keys(m.toolGoals), ['seo_agent']);
  assert.equal(parseMinutes({}, DATE), null);
  assert.equal(parseMinutes('not json', DATE), null);
});

test('without any AI the minutes come from the briefing, urgent first, with tool goals', () => {
  const m = selfMinutes(buildBriefing(live, NOW), DATE);
  assert.ok(m.decisions.length >= 4);
  assert.equal(m.decisions[0]!.priority, 'high');
  assert.ok(m.toolGoals.seo_agent?.includes('العناوين مكررة'));
  assert.match(m.summaryAr, /بدون ذكاء اصطناعي/);
});

const meetingOf = (minutes: Pick<Meeting, 'summaryAr' | 'decisions' | 'toolGoals'>, at = AT): Meeting => ({ date: cairoDate(at), at, mode: 'self', seats: [], ...minutes });

test('applying a meeting: at most 2 reruns, a daily task cap, no duplicate tasks, goals kept', () => {
  const file = emptyCouncil();
  const minutes = parseMinutes({ summary: 's', decisions: [
    { title: 'شغّل الأخبار', kind: 'auto', action: { type: 'rerun', workflow: 'shaheen-news.yml' } },
    { title: 'شغّل المستورد', kind: 'auto', action: { type: 'rerun', workflow: 'shaheen-import.yml' } },
    { title: 'شغّل الكشّاف', kind: 'auto', action: { type: 'rerun', workflow: 'shaheen-discover.yml' } },
    { title: 'ذاكر العنبر', kind: 'auto', action: { type: 'study', question: 'ايه أنواع العنبر في العطور؟' } },
    { title: 'جرّب متجر', kind: 'auto', action: { type: 'scout-seed', domain: 'oudshop.example' } },
    { title: 'تحسين صور المنتجات', detail: 'd', priority: 'high', kind: 'task' },
    { title: 'إضافة فلتر بالعائلة العطرية', detail: 'd', priority: 'low', kind: 'task' },
  ], toolGoals: { seo_agent: 'عناوين فريدة لكل صفحة منتج' } }, DATE)!;
  const { reruns, newTasks } = applyMeeting(file, meetingOf(minutes), NOW, 1);
  assert.equal(reruns.length, 2);
  assert.equal(minutes.decisions.filter((d) => d.status === 'skipped').length, 2, 'the third rerun and the second task wait');
  assert.deepEqual(newTasks.map((t) => t.title), ['تحسين صور المنتجات']);
  assert.deepEqual(councilStudy(file, NOW), ['ايه أنواع العنبر في العطور؟']);
  assert.deepEqual(councilSeeds(file, NOW), ['oudshop.example']);
  assert.equal(councilGoal(file, 'seo_agent'), 'عناوين فريدة لكل صفحة منتج');
  assert.equal(file.meetings.length, 1);
  assert.ok(isCouncilFile(file));

  // Next day: the same task is not opened twice; old study requests expire.
  const tomorrow = NOW + 86_400_000;
  const again = parseMinutes({ summary: 's', decisions: [{ title: 'تحسين صور المنتجات', detail: 'd', kind: 'task' }] }, cairoDate(new Date(tomorrow).toISOString()))!;
  const second = applyMeeting(file, meetingOf(again, new Date(tomorrow).toISOString()), tomorrow);
  assert.equal(second.newTasks.length, 0);
  assert.match(again.decisions[0]!.note || '', /موجودة/);
  assert.equal(file.meetings.length, 2);
  assert.ok(duplicateOf(file.tasks, 'تحسين صور المنتجات', tomorrow));
  assert.deepEqual(councilStudy(file, NOW + 15 * 86_400_000), []);
});

test('tasks follow their GitHub issues (done, dropped) and carry a marker for the coding agent', () => {
  const file = emptyCouncil();
  const minutes = parseMinutes({ summary: 's', decisions: [
    { title: 'مهمة أولى للتطوير', detail: 'تفاصيل', kind: 'task', needsApproval: true },
    { title: 'مهمة ثانية مختلفة تماماً', detail: 'تفاصيل', kind: 'task' },
  ] }, DATE)!;
  const { newTasks } = applyMeeting(file, meetingOf(minutes), NOW);
  const [a, b] = newTasks;
  const body = issueBody(a!);
  assert.ok(body.includes(`<!-- shaheen-task:${a!.id} -->`));
  assert.ok(body.includes('نفذ مهام شاهين'));
  assert.ok(body.includes('موافقة'));
  const changed = syncTasks(file.tasks, [
    { number: 7, state: 'closed', state_reason: 'completed', closed_at: AT, html_url: 'u7', body },
    { number: 8, state: 'closed', state_reason: 'not_planned', closed_at: AT, html_url: 'u8', body: issueBody(b!) },
  ]);
  assert.equal(changed, 4);
  assert.equal(a!.status, 'done');
  assert.equal(a!.issue, 7);
  assert.equal(b!.status, 'dropped');
  assert.equal(syncTasks(file.tasks, []), 0);
});

test('the school studies the council\'s questions and the supervisor gets each tool\'s goal', () => {
  const qs = councilQuestions(['ايه الفرق بين العود والصندل؟', 'What is a chypre perfume?', 'قصير']);
  assert.deepEqual(qs.map((q) => [q.lang, q.origin]), [['ar', 'council'], ['en', 'council']]);
  assert.ok(buildBank([], ['ايه الفرق بين العود والصندل؟']).some((q) => q.origin === 'council'));
  const prompt = reviewPrompt([{ id: 'seo_agent', goal: 'عناوين فريدة لكل صفحة', probes: [] }]);
  assert.ok(prompt.includes('هدف التطوير من اجتماع شاهين اليومي: عناوين فريدة لكل صفحة'));
  assert.ok(!reviewPrompt([{ id: 'seo_agent', probes: [] }]).includes('هدف التطوير'));
});

test('the council is a supervised AI tool with its own probe', async () => {
  assert.ok(AI_TOOLS.some((t) => t.id === 'shaheen_council' && t.sources.includes('scripts/shaheen-council/run.mts')));
  assert.equal(typeof PROBES.shaheen_council, 'function');
});
