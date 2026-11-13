import assert from 'node:assert/strict';
import { test } from 'node:test';
import { addressee, askDoneLine, EMPTY_BARGE_MEMORY, finishedAnswer, joinTurn, learnBarge, patienceLine, restOfReply, saveBargeMemory, savedBargeMemory, settleUnsure, turnState } from '../src/utils/turnTaking';

test('a paused sentence: finished, still going, or not clear (then «خلصت ولا لسه؟»)', () => {
  for (const said of ['عندكم عود بكام؟', 'عندكم عود بكام', 'بكام الشحن للسعودية', 'عايز عطر هادي للشغل ويكون ثباته عالي', 'what is the best oud', 'ايوه', 'شكرا', 'لا']) assert.equal(turnState(said), 'done', said);
  for (const said of ['انا عايز عطر يكون', 'انا عايز', 'عايز حاجة فريش عشان', 'I want a perfume and', 'هو العود ولا']) assert.equal(turnState(said), 'more', said);
  for (const said of ['عطر للشغل', 'عود']) assert.equal(turnState(said), 'unsure', said);
  // Answering a question he just asked: a short answer is the whole turn.
  assert.equal(turnState('رجالي', { answering: true }), 'done');
  assert.equal(turnState('رجالي بس', { answering: true }), 'more');
});

test('«خلصت ولا لسه؟» is answered in any words', () => {
  for (const said of ['خلصت', 'اه خلاص', 'بس كده', 'ايوه', 'yes', "that's it"]) assert.equal(finishedAnswer(said), 'done', said);
  for (const said of ['لسه', 'لا استنى', 'ثانية', 'not yet']) assert.equal(finishedAnswer(said), 'more', said);
  // Neither: it is simply more of his sentence.
  assert.equal(finishedAnswer('عايز كمان ريحته تكون خفيفة'), undefined);
  assert.equal(askDoneLine('ar', 'egyptian'), 'خلصت ولا لسه؟');
  assert.equal(askDoneLine('ar', 'gulf'), 'خلصت ولا باقي شي؟');
  assert.equal(askDoneLine('hi' as never), 'Are you done, or is there more?');
  assert.equal(patienceLine('ar'), 'اصبر عليا شوية، براجع البيانات.');
});

test('words heard while Shaheen talks: to him, or to someone near the visitor', () => {
  for (const said of ['استنى', 'شاهين', 'wait']) assert.deepEqual([said, addressee(said).to, addressee(said).strong], [said, 'shaheen', true]);
  for (const said of ['طب بكام ده', 'لا انا عايز حاجه ارخص', 'فيه شحن للسعودية', 'what about the price']) assert.equal(addressee(said).to, 'shaheen', said);
  for (const said of ['يا ماما هاتي الشاي', 'اقفل الباب يا احمد', 'هات التليفون', 'ايوه جاي']) assert.equal(addressee(said).to, 'other', said);
  // Not clear: he goes on (a reply cut for nothing is worse), unless this visitor taught him otherwise.
  assert.equal(addressee('حاضر').to, 'unsure');
  assert.equal(settleUnsure(), 'other');
});

test('he learns this visitor’s way: a missed interruption and a stop for nothing both teach him', () => {
  let memory = EMPTY_BARGE_MEMORY;
  assert.equal(addressee('حاضر', memory).to, 'unsure');
  // «حاضر» was for Shaheen twice (he went on, the visitor insisted): next time it stops him.
  memory = learnBarge(learnBarge(memory, 'حاضر', 'missed'), 'حاضر', 'missed');
  assert.equal(addressee('حاضر', memory).to, 'shaheen');
  // «طب» said to the kids twice (he stopped, nobody spoke): it no longer counts as to him.
  let other = EMPTY_BARGE_MEMORY;
  for (let i = 0; i < 4; i += 1) other = learnBarge(other, 'طب استنوا بره', 'false');
  assert.notEqual(addressee('طب استنوا بره', other).to, 'shaheen');
  assert.ok(other.bias < 0);
  // Missed many times: when unsure, he now stops for this visitor.
  let eager = EMPTY_BARGE_MEMORY;
  for (let i = 0; i < 3; i += 1) eager = learnBarge(eager, 'كلمة', 'missed');
  assert.equal(settleUnsure(eager), 'shaheen');
});

test('the memory stays in this browser and is checked when read', () => {
  const store = new Map<string, string>();
  (globalThis as { localStorage?: unknown }).localStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => store.set(k, v), removeItem: (k: string) => store.delete(k) };
  try {
    assert.deepEqual(savedBargeMemory(), { bias: 0, words: {} });
    saveBargeMemory({ bias: 0.3, words: { حاضر: 2 } });
    assert.deepEqual(savedBargeMemory(), { bias: 0.3, words: { حاضر: 2 } });
    store.set('sham_barge_memory_v1', JSON.stringify({ bias: 50, words: { a: 'x', b: 1 } }));
    assert.deepEqual(savedBargeMemory(), { bias: 1, words: { b: 1 } });
  } finally {
    delete (globalThis as { localStorage?: unknown }).localStorage;
  }
});

test('his turn is gathered in order, and the answer goes on from the word he was on', () => {
  assert.equal(joinTurn(['انا عايز عطر', 'عطر يكون هادي', 'للشغل']), 'انا عايز عطر يكون هادي للشغل');
  assert.equal(joinTurn(['عايز', 'عايز عود']), 'عايز عود');
  assert.equal(restOfReply(['أهلا بيك يا فندم.', 'العود حلو.'], 0, 7), 'بيك يا فندم. العود حلو.');
  assert.equal(restOfReply(['أهلا بيك.', 'العود حلو.'], 1, 0), 'العود حلو.');
});
