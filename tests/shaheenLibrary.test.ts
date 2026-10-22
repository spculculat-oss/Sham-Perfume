/**
 * «مكتبة شاهين» — when no AI engine answers, Shaheen answers from what he already knows (materials encyclopaedia,
 * his lessons, his memory), says where it comes from, and puts the question on his study list.
 * Hand-written fixtures only (never the live files, which the bots rewrite).
 */
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { test } from 'node:test';
import express from 'express';
import { emptyMemory, remember } from '../src/utils/shaheenMemory';
import { libraryAnswer, materialKeys, referenceBlock, searchLibrary, type LibrarySources } from '../src/utils/shaheenLibrary';
import { ShaheenMemory } from '../server/core/memory';
import { Repository } from '../server/core/repository';
import { MemoryStore } from '../server/core/store';
import { createShaheenRouter, SHAHEEN_OFFLINE_GAP } from '../server/shaheen';

const LONG = 'عشان العطر يثبت أكتر رطّب جلدك الأول بكريم من غير ريحة، ورش على نقاط النبض، وماتفركش الرسغين في بعض لأن الفرك بيكسر النوتات العليا.';
const memory = emptyMemory();
remember(memory, { question: 'ازاي اخلي العطر يثبت على جلدي اكتر', lang: 'ar', mode: 'auto', answer: LONG, source: 'study' });
const SRC: LibrarySources = {
  materials: [{
    id: 'mat-ambroxan', nameAr: 'أمبروكسان نقي (Ambroxan Pure Crystals)', nameEn: 'Ambroxan', categoryAr: 'مثبتات عنبرية', olfactoryFamily: 'عنبري خشبي',
    scentProfile: 'عنبر نظيف ودافئ', pyramidPlacementAr: 'قاعدة', recommendedUsagePercent: '0.5% - 4% من الزيت العطري', precautions: 'يحتاج تذويب في الكحول',
  }, {
    id: 'mat-vanillin', nameAr: 'فانيلين نقي (Pure Vanillin)', nameEn: 'Vanillin', scentProfile: 'فانيليا دافئة', recommendedUsagePercent: '0.5% - 8%',
  }],
  lessons: [{
    id: 'maceration', title: 'التعتيق في صناعة العطر',
    content: '• التعتيق هو ترك خليط الزيت والكحول فترة عشان النوتات تندمج.\n• المدة المعتادة من أسبوعين لستة أسابيع حسب التركيز.\n• احفظ الزجاجة في مكان مظلم وبارد أثناء التعتيق.',
  }, { id: 'safety', title: 'السلامة في استخدام العطور', content: '• جرّب العطر على جزء صغير من الجلد قبل الاستخدام.\n• ابعد العطر عن العين والجروح.' }],
  memory,
};

test('a question about a material gets its fact card from the encyclopaedia', () => {
  assert.ok(materialKeys(SRC.materials[1]!).includes('فانيليا'), 'everyday names: «فانيليا» finds vanillin');
  const a = libraryAnswer(SRC, 'ايه هو الامبروكسان؟', 'ar')!;
  assert.equal(a.kind, 'material');
  assert.match(a.answer, /\*\*أمبروكسان نقي/);
  assert.match(a.answer, /النسبة المعتادة في التركيبة: 0\.5% - 4%/);
  assert.match(a.answer, /من مكتبة شاهين/, 'always says where it comes from');
  assert.equal(libraryAnswer(SRC, 'الفانيليا بتتحط بنسبة كام؟', 'ar')?.kind, 'material');
});

test('a lesson answers its topic; a close remembered question is shown as such', () => {
  const lesson = libraryAnswer(SRC, 'عاوز اعرف معلومات عن التعتيق', 'ar')!;
  assert.equal(lesson.kind, 'lesson');
  assert.match(lesson.answer, /\*\*التعتيق في صناعة العطر\*\*/);
  assert.match(lesson.answer, /من أسبوعين لستة أسابيع/);
  const near = libraryAnswer(SRC, 'العطر مش بيثبت على جلدي خالص', 'ar', { recorded: true })!;
  assert.equal(near.kind, 'memory');
  assert.match(near.answer, /أقرب سؤال جاوبته قبل كده: «ازاي اخلي العطر يثبت على جلدي اكتر»/);
  assert.match(near.answer, /سؤالك اتسجل عشان أذاكره/);
});

test('the library never guesses: news, prices, personal or unrelated questions get nothing', () => {
  assert.equal(libraryAnswer(SRC, 'ايه اخبار العطور النهارده', 'ar'), undefined);
  assert.equal(libraryAnswer(SRC, 'سعر الامبروكسان كام', 'ar'), undefined, 'prices change: never from the library');
  assert.equal(libraryAnswer(SRC, 'ايه هي الطاقة الشمسية', 'ar'), undefined);
  assert.equal(libraryAnswer(SRC, 'عطر', 'ar'), undefined, 'one generic word is not a question');
  assert.deepEqual(searchLibrary(SRC, 'رقمي 01012345678 والامبروكسان', 'ar'), [], 'personal details: not searched');
  assert.equal(libraryAnswer(SRC, 'What is ambroxan?', 'en'), undefined, 'the Arabic encyclopaedia is not served as an English answer');
});

test('the teacher model gets the library references, bounded', () => {
  const block = referenceBlock(searchLibrary(SRC, 'ايه هو الامبروكسان', 'ar'), 300);
  assert.match(block, /أمبروكسان/);
  assert.ok(block.length <= 300);
});

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
test('every engine down: the server answers from the library and puts the question on the study list', async () => {
  const down = (async () => json({ error: { message: 'down' } }, 500)) as typeof fetch;
  const repo = new Repository(new MemoryStore(), {});
  const app = express();
  app.use(express.json());
  app.use('/api', createShaheenRouter({
    repo, env: { OPENAI_API_KEY: 'sk-test', SHAM_ANSWER_CACHE_MINUTES: '0' }, fetch: down,
    memory: new ShaheenMemory(new MemoryStore(), {}, down, emptyMemory()), library: async () => SRC,
  }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise((done) => server.once('listening', done));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
  const chat = (message: string, extra: Record<string, unknown> = {}) => fetch(`${base}/chat`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ model: 'auto', language: 'ar', conversationHistory: [], message, ...extra }),
  });
  try {
    const res = await chat('ايه هو الامبروكسان وبيتحط بكمية قد ايه');
    assert.equal(res.status, 200);
    const body = await res.json() as { reply: string; memory: string; engine: { provider: string } };
    assert.equal(body.memory, 'library');
    assert.equal(body.engine.provider, 'shaheen', 'still Shaheen, no vendor');
    assert.match(body.reply, /أمبروكسان/);
    assert.match(body.reply, /سؤالك اتسجل/);
    const gaps = await repo.gaps();
    assert.equal(gaps.length, 1);
    assert.equal(gaps[0]!.reason, SHAHEEN_OFFLINE_GAP);
    assert.equal((await chat('ايه هي الطاقة الشمسية')).status, 503, 'nothing in the library: the honest error');
    assert.equal((await repo.gaps()).length, 2, 'and the question still waits for study');
    const shop = await chat('عايز اشتري عطر هدية');
    assert.equal(shop.status, 200, 'shopping: answered from «متجر شام» itself by the linked brain (S-10)');
    assert.equal(((await shop.json()) as { memory: string }).memory, 'store');
    assert.equal((await chat('ايه هو الامبروكسان', { memory: false })).status, 503, 'the supervisor’s probes test the engines only');
    assert.equal((await chat('اسمي احمد ورقمي 01012345678 عايز اعرف عن الامبروكسان')).status, 503, 'personal details: not searched');
    assert.equal((await repo.gaps()).length, 2, 'shopping and personal questions are never put on the study list');
  } finally { await new Promise((done) => server.close(done)); }
});

test('in the browser, with no server at all: the library answers after the memory, and never instead of the store picks', async () => {
  const { createChatStore } = await import('../src/utils/chatStore');
  const offline = (async () => { throw new TypeError('Failed to fetch'); }) as never;
  const asked: string[] = [];
  const mem = {
    learn: () => {}, recall: async () => undefined,
    library: async (q: string, lang: string) => { asked.push(q); return libraryAnswer(SRC, q, lang)?.answer; },
  };
  const store = createChatStore(offline, async () => {}, mem, async () => 'store picks');
  const opts = { model: 'fast' as const, language: 'ar' as const, errorText: () => 'unavailable' };
  await store.send({ ...opts, text: 'ايه هو الامبروكسان' });
  const last = store.getSnapshot().messages.at(-1)!;
  assert.match(last.text, /أمبروكسان/);
  assert.equal(last.kind, undefined);
  await store.send({ ...opts, text: 'عايز اشتري عطر هدية' });
  assert.equal(store.getSnapshot().messages.at(-1)!.text, 'store picks');
  assert.deepEqual(asked, ['ايه هو الامبروكسان'], 'shopping questions go to the store picks');
  await store.send({ ...opts, text: 'ايه هي الطاقة الشمسية' });
  assert.equal(store.getSnapshot().messages.at(-1)!.kind, 'error', 'nothing known: the honest error');
});

test('the school: visitors’ unanswered questions first, the encyclopaedia learned without AI, the local teacher grounded and checked', async () => {
  const school = await import('../scripts/shaheen-school/school');
  const visitors = school.visitorQuestions([
    { question: 'ازاي اعمل عطر بريحة المطر', status: 'open', reason: SHAHEEN_OFFLINE_GAP, count: 1 },
    { question: 'ايه افضل مثبت طبيعي للعطر', status: 'open', reason: SHAHEEN_OFFLINE_GAP, count: 4 },
    { question: 'ايه اخبار العطور النهارده', status: 'open', reason: SHAHEEN_OFFLINE_GAP },
    { question: 'رقمي 01012345678 عايز عطر', status: 'open', reason: SHAHEEN_OFFLINE_GAP },
    { question: 'سؤال اتقفل خلاص عن العطور', status: 'closed', reason: SHAHEEN_OFFLINE_GAP },
    { question: 'سؤال من مساعد المتجر عن الشحن', status: 'open', reason: 'no indexed source matched' },
  ]);
  assert.deepEqual(visitors.map((v) => v.q), ['ايه افضل مثبت طبيعي للعطر', 'ازاي اعمل عطر بريحة المطر'], 'most asked first; news, personal, closed and other gaps left out');
  const bank = school.buildBank([], [], visitors, SRC.materials as never);
  assert.equal(bank[0]!.origin, 'visitors');
  assert.ok(bank.some((b) => b.q === 'ايه هو أمبروكسان نقي؟'));
  assert.ok(bank.length > 120, 'an advanced curriculum for the teacher to work through');
  const picked = school.pickStudy(school.exam(bank, emptyMemory(), []).results, 3);
  assert.deepEqual(picked.slice(0, 2).map((p) => p.q), visitors.map((v) => v.q), 'the teacher studies visitors’ questions first');

  // A material question is learned from its card, with no AI.
  const docs = school.materialDocs(SRC.materials as never);
  const r = school.examOne({ q: 'ايه هو أمبروكسان نقي؟', lang: 'ar', topic: 'materials', origin: 'library' }, emptyMemory(), docs);
  assert.match(school.selfLesson(r)!.answer, /0\.5% - 4%/);

  // The teacher's prompt carries his library; its answer is checked like any other.
  const b = { q: 'ازاي اعمل عطر عنبري دافي', lang: 'ar' as const, topic: 'design', origin: 'curriculum' as const };
  assert.match(school.studyPrompt(b, 'أمبروكسان: 0.5% - 4%'), /مراجع من مكتبة شاهين[\s\S]*0\.5% - 4%/);
  const good = 'العطر العنبري الدافي بيعتمد على قاعدة من الأمبروكسان (من نص لأربعة في المية من الزيت) مع الفانيليا والصندل، وقلب من الورد والقرفة، وتعتقه أسبوعين في مكان مظلم.';
  assert.ok(school.parseStudy(JSON.stringify({ answer: good, paraphrases: ['اعمل عطر عنبري دافئ ازاي', '红色 عطر عنبري'] }), b));
  assert.deepEqual(school.parseStudy(JSON.stringify({ answer: good, paraphrases: ['اعمل عطر عنبري دافئ ازاي', '红色 عطر عنبري'] }), b)!.paraphrases, ['اعمل عطر عنبري دافئ ازاي']);
  assert.equal(school.parseStudy(JSON.stringify({ answer: `${good} 这是很好的香水` }), b), null, 'a slip into another script: thrown away');
  assert.equal(school.parseStudy(JSON.stringify({ answer: `${good} This amber accord uses Ambroxan, vanilla absolute, sandalwood, cinnamon bark and rose otto in a classic structure that lasts all night long.` }), b), null, 'an Arabic answer must be Arabic');
});

test('the school reads a small model’s JSON even with line breaks inside the answer', async () => {
  const { parseStudy } = await import('../scripts/shaheen-school/school');
  const b = { q: 'ليه العطر اللي عملته ريحته اختفت بسرعة؟', lang: 'ar' as const, topic: 'problems', origin: 'curriculum' as const };
  const reply = '```json\n{"answer":"العطر بيختفي بسرعة لما البشرة تكون جافة أو التركيز يكون خفيف، والنوتات العليا بطبيعتها بتطير بسرعة.\n1. رطّب جلدك بكريم من غير ريحة.\n2. رش على نقاط النبض.","paraphrases":["ليه عطري مش بيثبت؟","سبب اختفاء ريحة العطر بسرعة"]}\n```';
  const lesson = parseStudy(reply, b)!;
  assert.ok(lesson);
  assert.match(lesson.answer, /\n1\. رطّب/);
  assert.equal(lesson.paraphrases.length, 2);
});

test('a broken JSON reply still gives its answer; a slip into another script is reported as such', async () => {
  const { studyCheck } = await import('../scripts/shaheen-school/school');
  const b = { q: 'العطر بتاعي ريحته كحول قوية اعمل ايه؟', lang: 'ar' as const, topic: 'problems', origin: 'curriculum' as const };
  const answer = 'ريحة الكحول القوية معناها إن العطر محتاج تعتيق أطول: سيبه في مكان مظلم وبارد من أسبوعين لشهر، وبعد كده جربه تاني.';
  const broken = `{"answer":"${answer}" "paraphrases":["ريحة الكحول في العطر عالية" "ازاي اقلل ريحة الكحول في العطر"]}`;
  const ok = studyCheck(broken, b);
  assert.ok('lesson' in ok && ok.lesson.answer === answer);
  const slip = studyCheck(JSON.stringify({ answer: `${answer} 酒精` }), b);
  assert.ok('reason' in slip && /another script/.test(slip.reason));
});

test('the review keeps a local lesson only on a clear OK', async () => {
  const { parseReview } = await import('../scripts/shaheen-school/school');
  assert.deepEqual(parseReview('OK'), { ok: true, reason: '' });
  assert.deepEqual(parseReview('**OK** الإجابة سليمة'), { ok: true, reason: '' });
  assert.equal(parseReview('REJECT: مسح العطر بقماشة نصيحة غير منطقية').ok, false);
  assert.match(parseReview('REJECT: مسح العطر بقماشة نصيحة غير منطقية').reason, /قماشة/);
  assert.equal(parseReview('الإجابة جيدة نوعا ما لكن').ok, false, 'no clear OK: not kept');
  assert.equal(parseReview('').ok, false);
});

test('a reply whose JSON closes the answer with a stray bracket is still read', async () => {
  const { studyCheck } = await import('../scripts/shaheen-school/school');
  const b = { q: 'ليه العطر اللي عملته ريحته اختفت بسرعة؟', lang: 'ar' as const, topic: 'problems', origin: 'curriculum' as const };
  const answer = 'الأنف بيتعود على الريحة بعد شوية، فبتحس إن العطر اختفى وهو لسه موجود؛ رش على نقاط النبض ورطب جلدك الأول.';
  const r = studyCheck(`{"answer":"${answer}"]}`, b);
  assert.ok('lesson' in r && r.lesson.answer === answer);
});
