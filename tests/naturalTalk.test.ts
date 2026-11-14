import assert from 'node:assert/strict';
import test from 'node:test';
import { NATURAL_TALK_INSTRUCTION, polishReply, revealStep, streamSafe } from '../src/utils/naturalTalk';
import { askWorkspace, workspaceInstruction, type AskEvent } from '../server/workspace';
import { systemInstruction, publicChatResult } from '../server/shaheen';
import { sseEvents } from '../src/workspace/workspaceApi';
import { spokenReply, speechTidy } from '../src/utils/spokenReply';

test('polishReply drops filler openers and closers, and nothing that carries meaning', () => {
  assert.equal(polishReply('بالتأكيد! إليك أفضل الخيارات: عود ومسك.'), 'إليك أفضل الخيارات: عود ومسك.');
  assert.equal(polishReply('سؤال رائع! السما زرقا بسبب تشتت الضوء.'), 'السما زرقا بسبب تشتت الضوء.');
  assert.equal(polishReply('Great question! The sky is blue because of scattering.'), 'The sky is blue because of scattering.');
  assert.equal(polishReply('Certainly! Here is the code you asked for.'), 'Here is the code you asked for.');
  assert.equal(polishReply('As an AI language model, I think the answer is 4.'), 'I think the answer is 4.');
  // A real answer that happens to start with the same word stays.
  for (const keep of ['بالتأكيد، ينفع تستخدمه كل يوم.', 'Sure, it works on dry skin too.', 'أكيد ينفع.', 'بالتأكيد!', 'Of course not — that would damage the bottle.']) assert.equal(polishReply(keep), keep);
  const body = 'العود بيثبت من ست لعشر ساعات على الجلد حسب التركيز ونوع البشرة.';
  assert.equal(polishReply(`${body} أتمنى أن يكون هذا مفيداً!`), body);
  assert.equal(polishReply(`${body}\n\nلا تتردد في طرح أي سؤال آخر.`), body);
  assert.equal(polishReply(`${body} I hope this helps!`), body);
  assert.equal(polishReply(`${body}\nLet me know if you have any other questions.`), body);
  // A real follow-up question, a short reply and a reply ending in code are left alone.
  for (const keep of [`${body} تحب أرشحلك نوع معين؟`, 'تمام. لا تتردد.', `${body}\n\`\`\`js\n// feel free to edit\n\`\`\``]) assert.equal(polishReply(keep), keep);
});

test('streamSafe never shows a half-written Shaheen block, fence marker, link or citation', () => {
  assert.equal(streamSafe('هرسملك الصورة.\n```sham-image\nA golden bottle'), 'هرسملك الصورة.');
  assert.equal(streamSafe('هرسملك الصورة.\n```sham'), 'هرسملك الصورة.');
  assert.equal(streamSafe('هرسملك الصورة.\n``'), 'هرسملك الصورة.');
  assert.equal(streamSafe('شوف [الموقع](https://exa'), 'شوف');
  assert.equal(streamSafe('ده مثبت [1'), 'ده مثبت');
  assert.equal(streamSafe('أول نقطة\n- '), 'أول نقطة');
  assert.equal(streamSafe('كلمة **'), 'كلمة');
  // Ordinary code is shown while it is being written, and finished text is untouched.
  const code = 'الكود:\n```python\nprint(1)';
  assert.equal(streamSafe(code), code);
  const whole = 'خلصت [1].\n```sham-image\nA bottle\n```';
  assert.equal(streamSafe(whole), whole);
});

test('revealStep keeps a steady pace, never cuts a word, catches up, and always finishes', () => {
  const text = 'العود مكوّن دافي وعميق بيدّي العطر ثبات طويل وفخامة واضحة في كل رشة 😀 والمسك بينعّمه.'.repeat(6);
  let shown = 0; let frames = 0;
  while (shown < text.length && frames < 5000) {
    const next = revealStep(shown, text, 16);
    assert.ok(next > shown, 'always moves forward');
    if (next < text.length) {
      assert.match(text[next]!, /\s/u, 'stops only between words');
      assert.ok(next - shown <= 40, 'no big jump at a normal pace');
    }
    shown = next; frames += 1;
  }
  assert.equal(shown, text.length);
  assert.ok(frames > 30, 'a long reply is written, not dropped');
  // A pile of waiting text is cleared in about a second, not at the slow pace.
  let behind = 0; let ms = 0;
  while (behind < text.length) { behind = revealStep(behind, text, 16, { done: true }); ms += 16; }
  assert.ok(ms < 1500, `finished in ${ms}ms`);
  assert.equal(revealStep(5, 'short', 16), 5);
  assert.equal(revealStep(0, '', 16), 0);
});

test('both chats are told the same talking manners (the spoken conversation keeps its own)', () => {
  assert.ok(workspaceInstruction('ar').includes(NATURAL_TALK_INSTRUCTION));
  assert.ok(systemInstruction('ar').includes(NATURAL_TALK_INSTRUCTION));
  assert.ok(!systemInstruction('ar', '', undefined, { voice: {} }).includes(NATURAL_TALK_INSTRUCTION));
  assert.doesNotMatch(NATURAL_TALK_INSTRUCTION, /gemini|openai|chatgpt|claude|deepseek/i);
  assert.equal(publicChatResult({ reply: 'بالتأكيد! إليك الطريقة: رش العطر على النبض.' }).reply, 'إليك الطريقة: رش العطر على النبض.');
});

const sse = (...pieces: string[]) => new Response(new ReadableStream({
  start(c) { for (const p of pieces) c.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ choices: [{ delta: { content: p } }] })}\n\n`)); c.enqueue(new TextEncoder().encode('data: [DONE]\n\n')); c.close(); },
}), { headers: { 'content-type': 'text/event-stream' } });

test('a workspace turn is written live: stages, pieces, then the polished final reply', async () => {
  const events: AskEvent[] = [];
  const request = (async () => sse('سؤال رائع! ', 'السما زرقا ', 'بسبب تشتت الضوء.')) as typeof fetch;
  const out = await askWorkspace({ messages: [{ role: 'user', text: 'ليه السما زرقا؟' }] }, { env: { OPENAI_API_KEY: 'test' }, fetch: request, onEvent: (e) => events.push(e) });
  assert.equal(out.reply, 'السما زرقا بسبب تشتت الضوء.');
  assert.deepEqual(events.map((e) => e.type), ['stage', 'delta', 'delta', 'delta']);
  assert.equal(events.filter((e) => e.type === 'delta').map((e) => (e as { text: string }).text).join(''), 'سؤال رائع! السما زرقا بسبب تشتت الضوء.');
});

test('a platform that breaks midway is dropped from the screen before the next one writes', async () => {
  const events: AskEvent[] = [];
  let calls = 0; let sentFirst = false;
  const request = (async () => {
    calls += 1;
    if (calls === 1) return new Response(new ReadableStream({ pull(c) { if (sentFirst) { c.error(new Error('cut')); return; } sentFirst = true; c.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ choices: [{ delta: { content: 'نص مقطو' } }] })}\n\n`)); } }), { headers: { 'content-type': 'text/event-stream' } });
    return sse('رد كامل وسليم.');
  }) as typeof fetch;
  const out = await askWorkspace({ messages: [{ role: 'user', text: 'اشرحلي الثقب الأسود' }] }, { env: { OPENAI_API_KEY: 'test' }, fetch: request, retryDelayMs: 0, onEvent: (e) => events.push(e) });
  assert.equal(out.reply, 'رد كامل وسليم.');
  const kinds = events.map((e) => e.type);
  assert.ok(kinds.indexOf('reset') > kinds.indexOf('delta'), kinds.join(','));
  assert.equal(kinds.lastIndexOf('delta') > kinds.indexOf('reset'), true);
});

test('JSON tasks are not streamed, and a search reports its stage and sources first', async () => {
  const events: AskEvent[] = [];
  const request = (async (url: string | URL | Request) => (new URL(String(url)).hostname.endsWith('wikipedia.org')
    ? Response.json({ query: { search: [{ title: 'صفحة', snippet: 'ملخص', pageid: 3 }] } })
    : sse('رد.'))) as typeof fetch;
  await askWorkspace({ messages: [{ role: 'user', text: 'إيه آخر أخبار مصر؟' }] }, { env: { OPENAI_API_KEY: 'test' }, fetch: request, onEvent: (e) => events.push(e) });
  assert.deepEqual(events.map((e) => (e.type === 'stage' ? e.stage : e.type)).slice(0, 3), ['searching', 'sources', 'writing']);
  events.length = 0;
  const plain = (async () => Response.json({ choices: [{ message: { content: '{"goal":"x","steps":[]}' } }] })) as typeof fetch;
  await askWorkspace({ messages: [{ role: 'user', text: 'خطة' }], task: 'plan' }, { env: { OPENAI_API_KEY: 'test' }, fetch: plain, onEvent: (e) => events.push(e) });
  assert.equal(events.some((e) => e.type === 'delta'), false);
});

test('the browser reads the stream in whatever pieces the network cuts it into', () => {
  const full = ': keep\n\ndata: {"type":"stage","stage":"writing"}\n\ndata: {"type":"delta","text":"أهلاً"}\n\ndata: {"type":"do';
  const a = sseEvents(full.slice(0, 40)); const b = sseEvents(a.rest + full.slice(40));
  assert.deepEqual([...a.events, ...b.events], [{ type: 'stage', stage: 'writing' }, { type: 'delta', text: 'أهلاً' }]);
  assert.equal(b.rest, 'data: {"type":"do');
  assert.deepEqual(sseEvents('data: {broken\n\ndata: {"type":"reset"}\r\n\r\n').events, [{ type: 'reset' }]);
});

test('the voice does not read source numbers or crossed-out words', () => {
  assert.equal(speechTidy('العود قوي [1] [2]. ~~غلط~~ صح¹.'), 'العود قوي. صح.');
  assert.equal(speechTidy('شوف [الموقع](https://x.y) و[3](https://z)'), 'شوف [الموقع](https://x.y) و[3](https://z)');
  const said = spokenReply('العود مكوّن قوي [1] [2]. (ملحوظة: ده تقريبي)', { language: 'ar', dialect: 'egyptian', words: Infinity }).say;
  assert.doesNotMatch(said, /واحد|اتنين|\[|^[،,]|\.\s*،/u);
  assert.match(said, /ملحوظة/u);
});
