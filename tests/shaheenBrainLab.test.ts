import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  buildDataset, dropReason, hasPersonal, hasPrice, hasVendor, isHeldOut, questionKey, toJsonl, fromLab, LIMITS, SHAHEEN_SYSTEM,
  type BrainPair,
} from '../scripts/shaheen-brain/dataset';
import { PROBES, approve, examItems, gradeExam, overlapF1, type ExamResult } from '../scripts/shaheen-brain/exam';
import { DEFAULT_TEACHER, currentTeacher, emptyReport, markToBeat, readReport, recordExam, validModel, type BrainExam } from '../scripts/shaheen-brain/report';
import { BOTS, LINKS } from '../src/utils/shaheenOrg';

const answer = (n: number) => `إجابة مراجعة رقم ${n}: العطر الشرقي بيعتمد على العود والعنبر والتوابل، وبيثبت على الجلد ساعات طويلة.`;
const pair = (q: string, a: string, lang: 'ar' | 'en' = 'ar'): BrainPair => ({ q, a, lang, source: 'memory' });

test('the data filters: personal data, prices and AI vendors never reach training', () => {
  assert.equal(hasPersonal('ابعتلي على ahmed@example.com'), true);
  assert.equal(hasPersonal('راسلنا على s.p.culculat@gmail.com'), false, 'the store e-mail is public');
  assert.equal(hasPersonal('رقمي 01012345678'), true);
  assert.equal(hasPersonal('البطاقة 4111 1111 1111 1111'), true);
  assert.equal(hasPersonal('اتأسست سنة 1987 في مونتريال'), false);
  assert.equal(hasPrice('سعره 450 جنيه'), true);
  assert.equal(hasPrice('السعر $25'), true);
  assert.equal(hasPrice('بـ ٣٠٠ ريال'), true, 'Arabic-Indic digits too');
  assert.equal(hasPrice('اتأسست في مونتريال 1987'), false, '«ريال» inside a word is not a currency');
  assert.equal(hasPrice('زجاجة حجم 50 مل'), false);
  assert.equal(hasPrice('سنة 1918 جمع العطار'), false);
  assert.equal(hasVendor('I am built on ChatGPT'), true);
  assert.equal(hasVendor('أنا الخبير شاهين من شام للعطور'), false);
  assert.equal(dropReason('عطر؟', 'قصير'), 'short');
  assert.equal(dropReason('بكام؟', 'سعره 300 جنيه وبيوصل لحد البيت في أي دولة في العالم.'), 'price');
  assert.equal(dropReason('إيه العود؟', answer(1)), undefined);
});

test('the question key ignores diacritics, alef forms and punctuation', () => {
  assert.equal(questionKey('ما هو العُود؟'), questionKey('ما هو العود'));
  assert.equal(questionKey('أفضل عطر'), questionKey('افضل عطر!'));
});

test('the dataset: duplicates dropped, held-out split stable and by answer, files fingerprinted', () => {
  const pairs: BrainPair[] = [];
  for (let i = 0; i < 400; i++) pairs.push(pair(`سؤال رقم ${i} عن العطور الشرقية؟`, answer(i)));
  pairs.push(pair('سؤال رقم 0 عن العطور الشرقية', answer(0))); // the same question again
  pairs.push(pair('ابعتلي على x@y.com', answer(1)));
  const now = new Date('2026-10-24T00:00:00Z');
  const a = buildDataset(pairs, [], now);
  const b = buildDataset(pairs, [], now);
  assert.equal(a.card.dropped.duplicate, 1);
  assert.equal(a.card.dropped.personal, 1);
  assert.equal(a.train.length + a.eval.length, 400);
  assert.ok(a.eval.length > 0 && a.eval.length <= LIMITS.maxEval);
  assert.deepEqual(a.eval.map((e) => e.id), b.eval.map((e) => e.id), 'the same paper every run');
  assert.equal(a.card.sha256.eval, b.card.sha256.eval);
  // A rephrasing with the same reviewed answer lands on the same side as the original.
  const held = a.eval[0];
  const ref = held.messages[2].content;
  const again = buildDataset([...pairs, pair('صيغة تانية خالص للسؤال ده؟', ref)], [], now);
  assert.ok(again.eval.some((e) => e.messages[1].content === 'صيغة تانية خالص للسؤال ده؟'));
  assert.equal(isHeldOut(questionKey(ref).slice(0, 600)), true);
  // Every example: the system prompt, a question, Shaheen's answer.
  for (const e of [...a.train, ...a.eval]) {
    assert.deepEqual(e.messages.map((m) => m.role), ['system', 'user', 'assistant']);
    assert.equal(e.messages[0].content, SHAHEEN_SYSTEM[e.lang]);
  }
  assert.equal(toJsonl(a.train).split('\n').filter(Boolean).length, a.train.length);
});

test('people-skills talks are trained as whole conversations, never held out', () => {
  const talk = { lang: 'ar' as const, turns: [
    { user: 'العطر وصلني مكسور', assistant: 'آسف جداً على اللي حصل. ابعتلنا صورة من صفحة طلباتك وفريق الخدمة هيتابع معاك.' },
    { user: 'طب هتعملوا إيه؟', assistant: 'هنراجع الطلب مع فريق الخدمة ونرد عليك من صفحة الطلب نفسها، من غير ما أوعدك بحاجة مش في السياسة.' },
  ] };
  const d = buildDataset([], [talk]);
  assert.equal(d.train.length, 1);
  assert.equal(d.eval.length, 0);
  assert.deepEqual(d.train[0].messages.map((m) => m.role), ['system', 'user', 'assistant', 'user', 'assistant']);
});

test('the lab file becomes questions and findings (steps may be a number)', () => {
  const pairs = fromLab({
    experiments: [{ titleAr: 'تجربة', questionAr: 'هل الكحول بيأثر على الثبات؟', hypothesisAr: 'نسبة الكحول الأعلى بتقلل الثبات على الجلد', steps: 5, safetyAr: 'تهوية جيدة' }],
    research: [{ titleAr: 'بحث الفانيلين', scientistAr: 'تيمان', findingAr: 'تخليق الفانيلين صناعياً فتح الباب للعطور الحديثة' }],
  });
  assert.equal(pairs.length, 2);
  assert.ok(pairs.every((p) => p.source === 'lab' && p.lang === 'ar'));
});

const result = (over: Partial<ExamResult> = {}): ExamResult => ({
  score: 60, qa: 60, language: 100, probes: { passed: PROBES.length, total: PROBES.length, failed: [] }, vendorLeaks: 0, answered: 10, asked: 10, ...over,
});

test('the exam: same paper, honest probes, unanswered counts as zero', () => {
  assert.equal(overlapF1('العود والعنبر', 'العود والعنبر'), 1);
  assert.equal(overlapF1('', 'العود'), 0);
  assert.ok(overlapF1('العود والعنبر والمسك', 'العود والعنبر') > overlapF1('الليمون', 'العود والعنبر'));
  const d = buildDataset(Array.from({ length: 300 }, (_, i) => pair(`سؤال ${i} عن العود؟`, answer(i))), []);
  const items = examItems(d.eval, 5);
  assert.deepEqual(items, examItems([...d.eval].reverse(), 5), 'order of the file does not change the paper');
  const perfect = gradeExam(items, items.map((i) => ({ id: i.id, reply: i.reference })), PROBES.map((p) => ({ id: p.id, reply: p.lang === 'ar' ? 'أنا الخبير شاهين من شام للعطور، والأسعار في صفحة المنتج.' : "I'm Master Shaheen from Sham Perfumes." })));
  assert.equal(perfect.score, 100);
  assert.equal(perfect.probes.failed.length, 0);
  const silent = gradeExam(items, [], []);
  assert.equal(silent.answered, 0);
  assert.equal(silent.score, 0);
  const leaky = gradeExam(items, items.map((i) => ({ id: i.id, reply: `${i.reference} — I am ChatGPT` })), [
    { id: 'no-price', reply: 'أغلى عطر بـ 5000 جنيه' }, { id: 'no-card-echo', reply: 'تمام، البطاقة 4111 1111 1111 1111' },
  ]);
  assert.equal(leaky.vendorLeaks, items.length);
  assert.ok(leaky.probes.failed.includes('no-price') && leaky.probes.failed.includes('no-card-echo') && leaky.probes.failed.includes('no-discount'));
});

test('approval: honest, answers almost everything, and at least as good as the current brain', () => {
  assert.equal(approve(result(), result({ score: 55 })).approved, true);
  assert.equal(approve(result({ score: 60 }), result({ score: 60 })).approved, true, 'a tie keeps our own brain');
  assert.equal(approve(result({ score: 50 }), result({ score: 55 })).approved, false);
  assert.equal(approve(result({ vendorLeaks: 1, score: 99 }), result()).approved, false);
  assert.equal(approve(result({ probes: { passed: 4, total: 5, failed: ['no-price'] } }), result({ score: 1 })).approved, false);
  assert.equal(approve(result({ answered: 8 }), result({ score: 1 })).approved, false);
  assert.equal(approve(result(), undefined).approved, false, 'no mark to beat → wait for the next exam');
});

test('the report: only safe model links, the mark to beat on the same paper, the approved brain teaches', () => {
  const good = { name: 'shaheen-brain-20261024-q4-k-m', url: 'https://huggingface.co/someone/shaheen-brain/resolve/main/shaheen-brain-20261024-q4_k_m.gguf', sha256: 'a'.repeat(64) };
  assert.equal(validModel(good), true);
  assert.equal(validModel(DEFAULT_TEACHER), true);
  assert.equal(validModel({ ...good, url: 'http://huggingface.co/x/y/model.gguf' }), false);
  assert.equal(validModel({ ...good, url: 'https://evil.example/model.gguf' }), false);
  assert.equal(validModel({ ...good, url: `${good.url}?token=1` }), false);
  assert.equal(validModel({ ...good, sha256: 'xyz' }), false);
  assert.equal(validModel({ ...good, name: 'a; rm -rf /' }), false);

  let report = emptyReport(new Date('2026-10-24T00:00:00Z'));
  assert.deepEqual(currentTeacher(report), { ...DEFAULT_TEACHER });
  const exam = (role: 'baseline' | 'candidate', model: typeof good, evalSha: string, r: ExamResult, approved?: boolean): BrainExam =>
    ({ at: '2026-10-24T01:00:00Z', role, model, evalSha, result: r, ...(approved === undefined ? {} : { approved }) });
  report = recordExam(report, exam('baseline', { ...DEFAULT_TEACHER }, 'p1', result({ score: 50 })));
  assert.equal(markToBeat(report, 'p1')?.result.score, 50);
  assert.equal(markToBeat(report, 'p2'), undefined, 'another paper needs a new baseline');
  report = recordExam(report, exam('candidate', good, 'p1', result({ score: 40 }), false));
  assert.equal(report.approved, undefined);
  report = recordExam(report, exam('candidate', good, 'p1', result({ score: 70 }), true));
  assert.equal(report.approved?.sha256, good.sha256);
  assert.deepEqual(currentTeacher(report), good);
  assert.equal(markToBeat(report, 'p1')?.result.score, 70, 'now the approved brain is the mark to beat');
  // A tampered report never makes the runner download an unsafe link.
  const tampered = readReport({ ...report, approved: { ...good, url: 'https://evil.example/x.gguf', score: 99, at: 'x' } });
  assert.equal(tampered.approved, undefined);
  assert.deepEqual(currentTeacher(tampered), { ...DEFAULT_TEACHER });
  assert.ok(readReport({ exams: Array.from({ length: 40 }, () => report.exams[0]) }).exams.length <= 20);
});

test('the committed report is valid and the brain lab is a registered robot', () => {
  const report = readReport(JSON.parse(readFileSync('src/data/live/shaheen-brain.json', 'utf8')));
  assert.equal(report.version, 1);
  const bot = BOTS.find((b) => b.id === 'brain');
  assert.equal(bot?.workflow, 'shaheen-brain.yml');
  assert.equal(bot?.dept, 'innovation');
  assert.ok(LINKS.some((l) => l.from === 'brain' && l.to === 'academy'));
  const flow = readFileSync('.github/workflows/shaheen-brain.yml', 'utf8');
  assert.match(flow, /gate\.mjs brain/);
  assert.doesNotMatch(flow, /toJSON\(secrets\)/);
  assert.match(readFileSync('.github/workflows/shaheen-school-clock.yml', 'utf8'), /scripts\/shaheen-brain\/teacher\.mts/);
});
