/** «مرسم شاهين»: the local painter draws what it knows, admits what it does not, and the training bank stays green. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { PAINT_SIZES, paintScene } from '../src/utils/shaheenPainter';
import { painterStepsIn } from '../src/workspace/paint';
import { PAINT_LESSONS } from '../scripts/shaheen-imagination/lessons';
import { formatPaintReport, runPaintTraining, soundSvg } from '../scripts/shaheen-imagination/bench';
import { ApiError, ApiUnavailableError } from '../src/utils/api';
import { WS_STRINGS } from '../src/workspace/strings';

test('the painter training bank passes: known ideas are understood, gaps are admitted', () => {
  const report = runPaintTraining(PAINT_LESSONS);
  assert.equal(report.fail, 0, formatPaintReport(report));
  assert.ok(report.known >= 29);
  assert.ok(report.gaps.length >= 5);
  assert.equal(new Set(PAINT_LESSONS.map((l) => l.id)).size, PAINT_LESSONS.length);
});

test('a painting is deterministic, sound, sized by the aspect and changes with the seed', () => {
  const a = paintScene('زجاجة عطر في الفضاء', { seed: 3, aspect: '16:9' });
  assert.deepEqual([a.width, a.height], PAINT_SIZES['16:9']);
  assert.deepEqual(soundSvg(a), []);
  assert.equal(paintScene('زجاجة عطر في الفضاء', { seed: 3, aspect: '16:9' }).svg, a.svg);
  assert.notEqual(paintScene('زجاجة عطر في الفضاء', { seed: 4, aspect: '16:9' }).svg, a.svg);
});

test('an idea outside the vocabulary still gives a sound picture and names what is missing', () => {
  const p = paintScene('أسد في الصحراء');
  assert.equal(p.missing, 'lion');
  assert.equal(p.setting, 'desert');
  assert.deepEqual(soundSvg(p), []);
  assert.equal(paintScene('جمل في الصحراء').missing, undefined);
});

test('hostile text in the idea never reaches the SVG as markup', () => {
  const p = paintScene('بحر بالليل مكتوب عليه "<script>alert(1)</script>" <image href="http://x.test/a.png"/>');
  assert.deepEqual(soundSvg(p), []);
  assert.ok(!p.svg.includes('<script'));
});

test('the painter steps in only when the engine is not there, never for refusals, edits or real photos', () => {
  const doc = (globalThis as { document?: unknown }).document;
  (globalThis as { document?: unknown }).document = {};
  try {
    assert.equal(painterStepsIn(new ApiError(503, 'NO_IMAGE_ENGINE'), false), true);
    assert.equal(painterStepsIn(new ApiError(503, 'IMAGE_QUOTA'), false), true);
    assert.equal(painterStepsIn(new ApiError(502, 'IMAGE_ENGINE_UNREACHABLE'), false), true);
    assert.equal(painterStepsIn(new ApiError(422, 'IMAGE_REFUSED'), false), false);
    assert.equal(painterStepsIn(new ApiError(429, 'RATE_LIMITED'), false), false);
    assert.equal(painterStepsIn(new Error('REAL_PHOTO_REQUIRES_SEARCH'), false), false);
    assert.equal(painterStepsIn(new ApiUnavailableError(), true), false);
  } finally { (globalThis as { document?: unknown }).document = doc; }
});

test('the painter notes say honestly that it is an illustration', () => {
  assert.match(WS_STRINGS.painter_note.ar, /مش صورة واقعية/);
  assert.match(WS_STRINGS.painter_partial.ar, /المكان والجو بس/);
});

test('stage two: the painter imagines extras, draws the new subjects and keeps every size sound', () => {
  const dream = paintScene('قلعة في عالم خيالي بالليل', { seed: 2 });
  assert.deepEqual(dream.subjects, ['castle']);
  for (const extra of ['milky way', 'giant moon', 'floating islands', 'fireflies']) assert.ok(dream.extras.includes(extra), extra);
  assert.equal(dream.missing, undefined);
  assert.ok(!paintScene('قلعة وقت الغروب', { seed: 2 }).extras.includes('floating islands'));
  assert.ok(paintScene('جبال وقت الغروب').extras.includes('light rays'));
  for (const aspect of ['1:1', '3:4', '4:3', '9:16', '16:9'] as const) {
    const p = paintScene('تنين ينفث النار فوق جزر طائرة وشلال وكوكب ومناطيد وفراشات وحصان وحوت وفنار واهرامات وكريستال وشجرة', { aspect, seed: 5 });
    assert.deepEqual(soundSvg(p), [], aspect);
    assert.equal(p.subjects.length, 12);
    assert.equal(new Set(p.svg.match(/ id="[^"]+"/g)).size, (p.svg.match(/ id="[^"]+"/g) || []).length, 'duplicate ids');
  }
});

test('words inside other words do not summon subjects', () => {
  assert.ok(!paintScene('صورة تخيلية لبحر').subjects.includes('horse'));
  assert.ok(!paintScene('حوت يطير فوق البحر').subjects.includes('falcon'));
  assert.ok(!paintScene('فنار على البحر').extras.includes('fire'));
  assert.ok(!paintScene('رجل قصير في حديقة').subjects.includes('castle'));
});
