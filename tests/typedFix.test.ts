import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import { keysTouch, meantText, planTypedTurn, typedDistance, typedNote, withoutNote } from '../src/utils/typedFix';
import { createChatStore, chatHistory } from '../src/utils/chatStore';
import type { requestApi } from '../src/utils/api';

const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
beforeEach(() => {
  const memory = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => memory.set(key, value),
    removeItem: (key: string) => memory.delete(key),
  } });
});
afterEach(() => {
  if (original) Object.defineProperty(globalThis, 'localStorage', original);
  else delete (globalThis as { localStorage?: unknown }).localStorage;
});

test('neighbouring keys on the Arabic keyboard cost less than any other letter', () => {
  assert.equal(keysTouch('ن', 'م'), true); // k / l
  assert.equal(keysTouch('ل', 'ر'), true); // g / v (the row below sits half a key over)
  assert.equal(keysTouch('ض', 'د'), false); // q / ] — two ends of the row
  assert.equal(typedDistance('عمبل', 'عنبر'), 1.5);
  assert.equal(typedDistance('عنبرر', 'عنبر'), 0.5, 'a doubled letter is a light slip');
  assert.equal(typedDistance('ياسمن', 'ياسمين'), 1, 'a missing letter');
});

test('a typed message is read again: missing, doubled and swapped letters, and the English keyboard', () => {
  const read = (text: string) => planTypedTurn(text, { language: 'ar' });
  assert.deepEqual(read('عايز عطر فيه ياسمبن'), { action: 'send', text: 'عايز عطر فيه ياسمين', changed: true });
  assert.deepEqual(read('عنبرر'), { action: 'send', text: 'عنبر', changed: true });
  assert.deepEqual(read('زعفرام'), { action: 'send', text: 'زعفران', changed: true });
  assert.deepEqual(read("u'v ukfv"), { action: 'send', text: 'عطر عنبر', changed: true });
  assert.deepEqual(planTypedTurn('i want vanila', { language: 'en' }), { action: 'send', text: 'i want vanilla', changed: true });
});

test('right words, names and attached pronouns are left exactly as typed', () => {
  for (const text of ['عندكم كريد افينتوس', 'عايز عطر يفكرني بريحة جدتي', 'عايز عطر شانيل', 'محمد صلاح بيستخدم عطر ايه',
    'الشحن للسعوديه', 'شلونك شو عندك عطور', 'زعفران وعنبر', 'عايز فانيليا وتونكا', 'ابغى عطر فخم للمناسبات',
    'what is the best long lasting perfume']) {
    assert.deepEqual(planTypedTurn(text, { language: 'ar' }), { action: 'send', text, changed: false }, text);
  }
});

test('not sure about a perfume word: «قصدك «عنبر»؟» first, then «أيوه» / «لا» / «لا، مسك» decide', () => {
  const plan = planTypedTurn('عطر فيه عمبل', { language: 'ar' });
  assert.equal(plan.action, 'ask');
  if (plan.action !== 'ask') return;
  assert.equal(plan.say, 'قصدك «عنبر»؟');
  assert.equal((planTypedTurn('عطر فيه عمبل', { language: 'ar', dialect: 'gulf' }) as { say?: string }).say, 'تقصد «عنبر»؟');
  const pending = plan.pending;
  assert.deepEqual(planTypedTurn('أيوه', { language: 'ar', pending }), { action: 'send', text: 'عطر فيه عنبر', changed: true });
  assert.deepEqual(planTypedTurn('لا', { language: 'ar', pending }), { action: 'send', text: 'عطر فيه عمبل', changed: false });
  assert.deepEqual(planTypedTurn('لا مسك', { language: 'ar', pending }), { action: 'send', text: 'عطر فيه مسك', changed: true });
  // Something else: a new message (the question is dropped).
  assert.deepEqual(planTypedTurn('عايز حاجة تانية', { language: 'ar', pending }), { action: 'send', text: 'عايز حاجة تانية', changed: false });
});

test('the «✍️» line: in every language, and the conversation carries what he meant', () => {
  assert.equal(typedNote('ar', 'عطر عنبر'), '✍️ فهمت سؤالك كده: «عطر عنبر»');
  for (const lang of ['ar', 'en', 'fr', 'es', 'it', 'de', 'ru', 'zh', 'tr', 'fa'] as const) {
    const note = typedNote(lang, 'X Y');
    assert.equal(meantText(`typed\n\n${note}`), 'X Y', lang);
  }
  assert.equal(meantText('plain'), 'plain');
  assert.equal(withoutNote('عود\n\n🎧 سمعت «عوض» وفهمتها «عود»'), 'عود');
});

test('the chat: a mistyped word is corrected before the server sees it; an unsure one is asked first', async () => {
  const sent: string[] = [];
  const request = (async (_path: string, init: RequestInit) => {
    sent.push(JSON.parse(String(init.body)).message);
    return { reply: 'جواب', engine: { id: 'auto', name: 'الخبير شاهين', badge: 'شاهين', provider: 'shaheen' } };
  }) as unknown as typeof requestApi;
  const store = createChatStore(request);
  const ask = { model: 'auto' as const, language: 'ar' as const, errorText: () => 'x' };
  await store.send({ ...ask, text: 'عايز عطر فيه ياسمبن' });
  assert.deepEqual(sent, ['عايز عطر فيه ياسمين']);
  const shown = store.getSnapshot().messages.at(-2)!;
  assert.equal(shown.text, 'عايز عطر فيه ياسمبن\n\n✍️ فهمت سؤالك كده: «عايز عطر فيه ياسمين»');
  assert.equal(chatHistory([shown]).at(-1)!.text, 'عايز عطر فيه ياسمين');

  // Unsure: the question is asked here and nothing is sent.
  assert.equal(await store.send({ ...ask, text: 'عطر فيه عمبل' }), true);
  assert.equal(sent.length, 1);
  assert.equal(store.getSnapshot().messages.at(-1)!.text, 'قصدك «عنبر»؟');
  await store.send({ ...ask, text: 'ايوه' });
  assert.deepEqual(sent, ['عايز عطر فيه ياسمين', 'عطر فيه عنبر']);
  assert.equal(store.getSnapshot().messages.at(-2)!.text, 'ايوه\n\n✍️ فهمت سؤالك كده: «عطر فيه عنبر»');

  // A spoken turn was already read by the voice mode: sent as it is.
  await store.send({ ...ask, text: 'عطر فيه عمبل', voice: {} });
  assert.equal(sent.at(-1), 'عطر فيه عمبل');
});
