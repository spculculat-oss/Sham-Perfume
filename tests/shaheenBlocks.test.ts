/**
 * «بلوكات شاهين» — building programming blocks and scheduling them (src/utils/shaheenBlocks.ts).
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildProgram, describeSchedule, emptyBlocks, isBlocksFile, nextRun, parseSchedule,
  programChecklist, runProgram, validateProgram, type BlockActions,
} from '../src/utils/shaheenBlocks';

const AT = Date.parse('2026-10-21T10:00:00Z'); // Wednesday

test('parseSchedule understands the whole grammar (words, Arabic and cron)', () => {
  assert.deepEqual(parseSchedule('every 30 minutes'), { kind: 'every', minutes: 30 });
  assert.deepEqual(parseSchedule('every 6 hours'), { kind: 'every', minutes: 360 });
  assert.deepEqual(parseSchedule('every 1 day'), { kind: 'every', minutes: 1440 });
  assert.deepEqual(parseSchedule('كل 6 ساعات'), { kind: 'every', minutes: 360 });
  assert.deepEqual(parseSchedule('كل نص ساعة'), null, 'a half hour needs a number');
  assert.deepEqual(parseSchedule('كل 15 دقيقة'), { kind: 'every', minutes: 15 });
  assert.deepEqual(parseSchedule('daily 08:00'), { kind: 'daily', hour: 8, minute: 0 });
  assert.deepEqual(parseSchedule('يومياً 08:00'), { kind: 'daily', hour: 8, minute: 0 });
  assert.deepEqual(parseSchedule('weekly sat 09:30'), { kind: 'weekly', day: 6, hour: 9, minute: 30 });
  assert.deepEqual(parseSchedule('weekly الجمعة 10:00'), { kind: 'weekly', day: 5, hour: 10, minute: 0 });
  assert.deepEqual(parseSchedule('17 */6 * * *'), { kind: 'cron', minute: 17, hour: { every: 6 }, dayOfMonth: 'star', month: 'star', dayOfWeek: 'star' });
  assert.deepEqual(parseSchedule('0 8 * * 1'), { kind: 'cron', minute: 0, hour: 8, dayOfMonth: 'star', month: 'star', dayOfWeek: 1 });
  assert.equal(parseSchedule('tomorrow'), null);
  assert.equal(parseSchedule(''), null);
  assert.equal(parseSchedule('every 0 minutes'), null);
  assert.equal(parseSchedule('daily 25:00'), null);
});

test('nextRun returns the first moment strictly after the given time', () => {
  const iso = (d: Date | null) => d?.toISOString();
  assert.equal(iso(nextRun('every 30 minutes', AT)!), '2026-10-21T10:30:00.000Z');
  assert.equal(iso(nextRun('every 6 hours', AT)!), '2026-10-21T16:00:00.000Z');
  assert.equal(iso(nextRun('daily 08:00', AT)!), '2026-10-22T08:00:00.000Z', 'already past 08:00 today → tomorrow');
  assert.equal(iso(nextRun('daily 12:00', AT)!), '2026-10-21T12:00:00.000Z');
  assert.equal(iso(nextRun('weekly sat 09:00', AT)!), '2026-10-24T09:00:00.000Z', 'Wednesday → next Saturday');
  assert.equal(iso(nextRun('weekly wed 12:00', AT)!), '2026-10-21T12:00:00.000Z', 'later today counts');
  assert.equal(iso(nextRun('17 */6 * * *', AT)!), '2026-10-21T12:17:00.000Z', '17 minutes past the next 6-hour mark');
  assert.equal(nextRun('nope', AT), null);
});

test('describeSchedule speaks Arabic', () => {
  assert.equal(describeSchedule('every 30 minutes'), 'كل 30 دقيقة');
  assert.equal(describeSchedule('every 6 hours'), 'كل 6 ساعة');
  assert.equal(describeSchedule('every 2 day'), 'كل 2 يوم');
  assert.equal(describeSchedule('daily 08:00'), 'يومياً الساعة 08:00');
  assert.equal(describeSchedule('weekly sat 09:30'), 'أسبوعياً (السبت) 09:30');
  assert.match(describeSchedule('17 */6 * * *'), /حسب الجدولة/);
  assert.match(describeSchedule('bad'), /غير مجدولة/);
});

test('buildProgram gives every block a stable id; validateProgram catches every mistake', () => {
  const p = buildProgram({
    id: 'demo', title: 'تجربة', goal: 'اختبار', schedule: 'daily 08:00',
    blocks: [
      { kind: 'action', label: 'فحص', action: 'check' },
      {
        kind: 'condition', label: 'لو شغال', when: { fact: 'siteUp', equals: true },
        children: [{ kind: 'loop', label: 'ثلاث مرات', repeat: 3, children: [{ kind: 'action', label: 'عينة', action: 'sample' }] }],
      },
      { kind: 'note', label: 'ملاحظة', note: 'تمام' },
      { kind: 'wait', label: 'استراحة', minutes: 5 },
      { kind: 'schedule', label: 'مراجعة الموعد', every: 'every 6 hours' },
    ],
  }, new Date(AT));
  assert.deepEqual(validateProgram(p), []);
  assert.equal(p.blocks[0].id, 'b1');
  assert.equal(p.blocks[1].id, 'b2');
  assert.equal(p.blocks[1].children![0].id, 'b2.1');
  assert.equal(p.blocks[1].children![0].children![0].id, 'b2.1.1');
  assert.equal(p.createdAt, new Date(AT).toISOString());

  assert.ok(validateProgram({ ...p, schedule: 'كل وقت' }).some((e) => /جدولة/.test(e)), 'unknown schedule');
  assert.ok(validateProgram({ ...p, blocks: [] }).some((e) => /بدون بلوكات/.test(e)), 'no blocks');
  assert.ok(validateProgram({ ...p, blocks: [{ id: 'b1', kind: 'action', label: '  ' }] }).some((e) => /بدون وصف/.test(e)), 'empty label');
  assert.ok(validateProgram({ ...p, blocks: [{ id: 'b1', kind: 'action', label: 'فحص' }] }).some((e) => /بدون اسم إجراء/.test(e)), 'action without a name');
  assert.ok(validateProgram({ ...p, blocks: [{ id: 'b1', kind: 'loop', label: 'تكرار', repeat: 99 }] }).some((e) => /1 إلى 20/.test(e)), 'loop over the cap');
  assert.ok(validateProgram({ ...p, blocks: [{ id: 'b1', kind: 'condition', label: 'شرط', when: { fact: 'x', atLeast: 3 } }] }).length === 0, 'a fact check is enough');
  assert.ok(validateProgram({ ...p, blocks: [{ id: 'b1', kind: 'condition', label: 'شرط', when: { fact: '' } }] }).some((e) => /بدون حقيقة/.test(e)), 'empty condition');
  assert.ok(validateProgram({ ...p, blocks: [{ id: 'b1', kind: 'wait', label: 'انتظار', minutes: -1 }] }).some((e) => /انتظار/.test(e)), 'bad wait');
  assert.ok(validateProgram({ ...p, blocks: [{ id: 'b1', kind: 'mystery' as never, label: '؟' }] }).some((e) => /غير معروف/.test(e)), 'unknown kind');
});

test('programChecklist flattens the tree with its steps in order', () => {
  const p = buildProgram({
    id: 'x', title: 'قائمة', goal: 'اختبار',
    blocks: [
      { kind: 'action', label: 'فحص', action: 'check' },
      { kind: 'condition', label: 'لو شغال', when: { fact: 'siteUp', equals: true }, children: [{ kind: 'action', label: 'نسخة', action: 'backup' }] },
    ],
  });
  const lines = programChecklist(p);
  assert.equal(lines.length, 3);
  assert.match(lines[0], /^b1\. فحص \(إجراء\)/);
  assert.match(lines[1], /^b2\. لو شغال \(شرط\)/);
  assert.match(lines[2], /^\s+b2\.1\. نسخة \(إجراء\)/);
});

test('runProgram only runs whitelisted actions and reports every step', async () => {
  const p = buildProgram({
    id: 'run', title: 'تشغيل', goal: 'اختبار',
    blocks: [
      { kind: 'action', label: 'فحص', action: 'check' },
      { kind: 'action', label: 'إجراء مجهول', action: 'ghost' },
      { kind: 'action', label: 'فشل', action: 'boom' },
      {
        kind: 'condition', label: 'لو شغال', when: { fact: 'siteUp', equals: true },
        children: [
          { kind: 'action', label: 'نسخة', action: 'backup' },
          { kind: 'loop', label: 'عينات', repeat: 3, children: [{ kind: 'action', label: 'عينة', action: 'sample' }] },
        ],
      },
      {
        kind: 'condition', label: 'لو وقع', when: { fact: 'siteUp', equals: false },
        children: [{ kind: 'action', label: 'بلاغ', action: 'alert' }],
      },
      { kind: 'wait', label: 'انتظار', minutes: 10 },
      { kind: 'schedule', label: 'مراجعة الموعد', every: 'every 6 hours' },
      { kind: 'note', label: 'ملاحظة', note: 'آخر الخطوات' },
    ],
  });
  const calls: string[] = [];
  const actions: BlockActions = {
    check: () => 'سليم',
    backup: () => { calls.push('backup'); },
    sample: () => { calls.push('sample'); },
    alert: () => { calls.push('alert'); },
    boom: () => { throw new Error('انفجار'); },
  };
  const report = await runProgram(p, actions, { facts: { siteUp: true } });
  assert.equal(report.ok, false, 'the unknown action and the boom failed');
  assert.equal(report.steps.filter((s) => s.status === 'failed').length, 2);
  assert.equal(calls.filter((c) => c === 'sample').length, 3, 'the loop is capped and exact');
  assert.equal(calls.includes('alert'), false, 'the false condition skipped its children');
  assert.equal(calls.includes('backup'), true);
  const skipped = report.steps.find((s) => s.label === 'لو وقع')!;
  assert.equal(skipped.status, 'skipped');
  const waited = report.steps.find((s) => s.label === 'انتظار')!;
  assert.equal(waited.status, 'waited');
  assert.match(report.steps.find((s) => s.label === 'مراجعة الموعد')!.detail!, /2026|التشغيل القادم/);
  assert.equal(report.steps.find((s) => s.label === 'ملاحظة')!.detail, 'آخر الخطوات');
  assert.equal(report.program, 'run');

  const clean = await runProgram(buildProgram({
    id: 'ok', title: 'سليم', goal: 'اختبار', blocks: [{ kind: 'action', label: 'فحص', action: 'check' }],
  }), actions);
  assert.equal(clean.ok, true);
});

test('emptyBlocks and isBlocksFile guard the live file', () => {
  const f = emptyBlocks();
  assert.equal(f.version, 1);
  assert.deepEqual(f.programs, []);
  assert.ok(isBlocksFile(f));
  assert.ok(isBlocksFile({ version: 1, updatedAt: 'x', programs: [], runs: [] }));
  assert.ok(!isBlocksFile({ version: 2, updatedAt: 'x', programs: [], runs: [] }));
  assert.ok(!isBlocksFile(null));
  assert.ok(!isBlocksFile({ version: 1, updatedAt: 'x' }));
});
