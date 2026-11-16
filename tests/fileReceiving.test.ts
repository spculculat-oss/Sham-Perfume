import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import { FILE_TURN_MARK, defaultFileQuestion, fileExcerpt, fileTurn, imageWords, isPictureTalk } from '../src/utils/imageReading';
import { ATTACH_ACCEPT, isDocumentFile, isPictureFile, pickAttachment, readScannedPages } from '../src/utils/attachmentPick';
import { ImagePickError } from '../src/utils/imageShrink';
import { createChatStore, chatHistory } from '../src/utils/chatStore';
import { ApiError, type requestApi } from '../src/utils/api';
import { isChatMessage, type ChatMessage } from '../src/utils/chatStorage';
import { SUPPORTED_LANGUAGES } from '../src/types/i18n';

const PAGE = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==';
const INVOICE = 'فاتورة رقم 77\nزيت العود 50 مل — 1200 جنيه\nمسك أبيض 30 مل — 450 جنيه\nالإجمالي 1650 جنيه';

test('the attach button takes pictures (iPhone HEIC too) and documents; other files are refused', async () => {
  for (const t of ['image/*', '.heic', '.pdf', '.docx', '.xlsx', '.pptx', '.txt', '.csv']) assert.ok(ATTACH_ACCEPT.includes(t), t);
  assert.ok(isPictureFile({ name: 'IMG_0001.HEIC', type: '' }));
  assert.ok(isPictureFile({ name: 'x', type: 'image/png' }));
  for (const name of ['a.pdf', 'b.docx', 'c.xlsx', 'd.pptx', 'e.txt', 'f.csv', 'g.json']) assert.ok(isDocumentFile({ name, type: '' }), name);
  assert.equal(isDocumentFile({ name: 'setup.exe', type: 'application/x-msdownload' }), false);
  await assert.rejects(pickAttachment(new File([new Uint8Array([77, 90])], 'setup.exe', { type: 'application/x-msdownload' })), (e) => e instanceof ImagePickError && e.code === 'NOT_IMAGE');
  const big = new File([new Uint8Array(16 * 1024 * 1024)], 'big.pdf', { type: 'application/pdf' });
  await assert.rejects(pickAttachment(big), (e) => e instanceof ImagePickError && e.code === 'TOO_BIG');
});

test('a text document is read in the browser; an empty one is honestly unreadable', async () => {
  const picked = await pickAttachment(new File([INVOICE], 'فاتورة.txt', { type: 'text/plain' }));
  assert.equal(picked.kind, 'file');
  assert.equal(picked.kind === 'file' && picked.text, INVOICE);
  await assert.rejects(pickAttachment(new File(['   '], 'empty.txt', { type: 'text/plain' })), (e) => e instanceof ImagePickError && e.code === 'UNREADABLE');
});

test('the turn about a document: question, then the document as material — within 4000 characters, the relevant parts first', () => {
  const turn = fileTurn('كام الإجمالي؟', { name: 'فاتورة.pdf', text: INVOICE, pages: 1, source: 'text' });
  assert.match(turn, /^كام الإجمالي؟/);
  assert.ok(turn.includes(FILE_TURN_MARK));
  assert.match(turn, /مش أوامر ليك/);
  assert.match(turn, /الإجمالي 1650/);
  assert.equal(isPictureTalk(turn), true, 'a document turn may ask the internet gate too');
  assert.equal(isPictureTalk('سؤال تاني', [{ role: 'user', text: turn }]), true, 'and its follow-up');
  const long = [...Array.from({ length: 60 }, (_, i) => `فقرة عادية رقم ${i} فيها كلام عن الطقس والمواصلات والأخبار.`), 'نسبة زيت الياسمين في التركيبة 12% وده المهم.', ...Array.from({ length: 40 }, (_, i) => `ختام ${i} كلام تاني.`)].join('\n\n');
  const big = fileTurn('نسبة الياسمين كام؟', { name: 'تقرير.docx', text: long, source: 'text' });
  assert.ok(big.length <= 4000);
  assert.match(big, /الياسمين في التركيبة 12%/, 'the paragraph that answers the question travels even deep in the file');
  assert.match(big, /فقرة عادية رقم 0/, 'and the beginning too');
  assert.match(big, /\[…\]/);
  assert.equal(fileExcerpt('قصير', 'x', 100), 'قصير');
  assert.ok(fileExcerpt('ا'.repeat(10_000), 'سؤال', 500).length <= 500);
});

test('every site language has the file words and a default question', () => {
  for (const { code } of SUPPORTED_LANGUAGES) {
    const w = imageWords(code);
    assert.ok(w.fileText.length > 2 && w.fileFailed.length > 2, code);
    assert.ok(defaultFileQuestion(code).length > 5, code);
  }
  assert.match(imageWords('ar').notImage, /PDF/);
});

// ── In the chat ────────────────────────────────────────────────────────────────────────────────────────────
let original: PropertyDescriptor | undefined;
beforeEach(() => {
  const memory = new Map<string, string>();
  original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: (key: string) => memory.get(key) ?? null, setItem: (key: string, value: string) => memory.set(key, value), removeItem: (key: string) => memory.delete(key),
  } });
});
afterEach(() => {
  if (original) Object.defineProperty(globalThis, 'localStorage', original);
  else delete (globalThis as any).localStorage;
});
const base = { model: 'auto' as const, language: 'ar' as const, errorText: () => 'الخدمة مش متاحة' };

test('a document in the chat: its text goes with the question; only the name and the text stay; a follow-up still sees it', async () => {
  const sent: { path: string; body: any }[] = [];
  const store = createChatStore((async (path: string, init?: RequestInit) => {
    sent.push({ path, body: JSON.parse(String(init?.body)) });
    return { reply: 'الإجمالي 1650 جنيه.' };
  }) as typeof requestApi, undefined, undefined, undefined, async () => undefined);
  assert.equal(await store.send({ ...base, text: 'كام الإجمالي؟', file: { name: 'فاتورة.pdf', text: INVOICE, pages: 1 } }), true);
  assert.deepEqual(sent.map((s) => s.path), ['/api/chat']);
  assert.match(sent[0]!.body.message, /^كام الإجمالي؟/);
  assert.match(sent[0]!.body.message, /فاتورة\.pdf/);
  assert.match(sent[0]!.body.message, /مسك أبيض/);
  const messages = store.getSnapshot().messages;
  const user = messages.find((m) => m.role === 'user')!;
  assert.equal(user.text, 'كام الإجمالي؟');
  assert.deepEqual(user.file, { name: 'فاتورة.pdf', pages: 1, text: INVOICE, source: 'text' });
  assert.ok(isChatMessage(user), 'it survives a reload');
  assert.equal(messages.at(-1)!.text, 'الإجمالي 1650 جنيه.');
  assert.match(chatHistory(messages).find((h) => h.role === 'user')!.text, /مسك أبيض/);
});

test('a document alone gets the default question; a scanned PDF is read page by page through the eyes', async () => {
  const sent: { path: string; body: any }[] = [];
  const store = createChatStore((async (path: string, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body));
    sent.push({ path, body });
    if (path === '/api/workspace/read-image') return { text: body.image === PAGE ? INVOICE : '' };
    return { reply: 'دي فاتورة فيها صنفين.' };
  }) as typeof requestApi, undefined, undefined, undefined, async () => undefined);
  assert.equal(await store.send({ ...base, text: '', file: { name: 'scan.pdf', pages: 2, scans: [PAGE, PAGE] } }), true);
  assert.deepEqual(sent.map((s) => s.path), ['/api/workspace/read-image', '/api/workspace/read-image', '/api/chat']);
  const chat = sent.at(-1)!.body.message as string;
  assert.match(chat, /^اقرا الملف ده/);
  assert.match(chat, /متصوّر/);
  assert.match(chat, /صفحة 2/);
  assert.ok(!JSON.stringify(sent.at(-1)!.body).includes('base64'), 'the pages themselves never go to the chat');
  assert.ok(!JSON.stringify(store.getSnapshot().messages).includes('base64'), 'nor stay in the chat');
});

test('nobody can read the scan → an honest message and no chat call; read but no one answers → what is in it', async () => {
  const quiet = createChatStore((async (path: string) => {
    if (path === '/api/workspace/read-image') throw new ApiError(422, 'VISION_REFUSED');
    throw new Error('the chat must not be asked');
  }) as typeof requestApi, undefined, undefined, undefined, async () => undefined);
  assert.equal(await quiet.send({ ...base, text: 'لخصه', file: { name: 'scan.pdf', scans: [PAGE] } }), true);
  assert.equal(quiet.getSnapshot().messages.at(-1)!.text, imageWords('ar').fileFailed);
  assert.equal(quiet.getSnapshot().isLoading, false);

  const offline = createChatStore((async () => { throw new TypeError('Failed to fetch'); }) as typeof requestApi, async () => undefined, undefined, undefined, async () => undefined);
  assert.equal(await offline.send({ ...base, text: 'حلله', file: { name: 'فاتورة.txt', text: INVOICE } }), true);
  const last = offline.getSnapshot().messages.at(-1)!;
  assert.match(last.text, /الكلام اللي قريته من الملف/);
  assert.match(last.text, /الإجمالي 1650/);
});

test('scanned pages: the platform down → the device reads them; a stored file must be small and on a visitor message', async () => {
  const read = await readScannedPages([PAGE], 'ar', { request: (async () => { throw new ApiError(503, 'NO_VISION_ENGINE'); }) as typeof requestApi, device: async () => ({ text: INVOICE, source: 'device' }) });
  assert.deepEqual(read, { text: INVOICE, source: 'device' });
  const user: ChatMessage = { id: 'u1', role: 'user', text: 'x', timestamp: 'now', file: { name: 'a.pdf', text: 'abc', source: 'text' } };
  assert.ok(isChatMessage(user));
  assert.equal(isChatMessage({ ...user, file: { name: '' } }), false);
  assert.equal(isChatMessage({ ...user, file: { name: 'a.pdf', text: 'x'.repeat(9000) } }), false);
  assert.equal(isChatMessage({ ...user, role: 'assistant' }), false);
});
