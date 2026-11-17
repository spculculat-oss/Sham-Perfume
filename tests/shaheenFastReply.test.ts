import assert from 'node:assert/strict';
import test from 'node:test';
import { callEngine, fastGeminiModel, GEMINI_FAST_MODEL } from '../server/core/engines';
import { askWorkspace, googleHelps, webSearch } from '../server/workspace';

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
const sse = (text: string) => new Response(`data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] })}\n\n`, { status: 200, headers: { 'content-type': 'text/event-stream' } });
const models = (...names: string[]) => json({ models: names.map((n) => ({ name: `models/${n}`, supportedGenerationMethods: ['generateContent'] })) });
/** A line that opens and then says nothing until the caller gives up (how an exhausted model sometimes behaved). */
const silent = (signal?: AbortSignal | null) => new Promise<Response>((_, reject) => {
  const keep = setTimeout(() => {}, 60_000); // the test's event loop stays alive while the line is silent
  signal?.addEventListener('abort', () => { clearTimeout(keep); reject(signal.reason ?? new DOMException('aborted', 'AbortError')); }, { once: true });
});

test('«سرعة شاهين»: chats start on the fast model unless the owner chose one', () => {
  assert.equal(GEMINI_FAST_MODEL, 'gemini-2.5-flash');
  assert.equal(fastGeminiModel({}), 'gemini-2.5-flash');
  assert.equal(fastGeminiModel({ SHAM_FAST_MODEL: 'gemini-flash-lite-latest' }), 'gemini-flash-lite-latest');
  assert.equal(fastGeminiModel({ GEMINI_MODEL: 'gemini-3.8-flash', SHAM_FAST_MODEL: 'x' }), 'gemini-3.8-flash', 'the owner’s own model wins');
});

test('a live answer that stays silent moves to another model within seconds, not after the whole timeout', async () => {
  const calls: string[] = [];
  const started = Date.now();
  const tokens: string[] = [];
  const reply = await callEngine('gemini', 'sys', [{ role: 'user', text: 'أهلاً' }], {
    env: { GEMINI_API_KEY: 'k', SHAM_FIRST_WORD_MS: '2000' }, temperature: 0.5, signal: AbortSignal.timeout(30_000), model: 'gemini-2.5-flash',
    onToken: (t) => tokens.push(t),
    fetch: (async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      calls.push(url.replace(/^.*\/v1beta\//, '').replace(/\?.*$/, ''));
      if (url.includes('/models?')) return models('gemini-2.5-flash', 'gemini-flash-lite-latest');
      if (url.includes('gemini-2.5-flash:')) return silent(init?.signal);
      return sse('أهلاً بيك');
    }) as typeof fetch,
  });
  assert.equal(reply, 'أهلاً بيك');
  assert.ok(Date.now() - started < 6_000, `took ${Date.now() - started} ms`);
  assert.equal(calls[0], 'models/gemini-2.5-flash:streamGenerateContent');
  assert.ok(calls.some((c) => c === 'models/gemini-flash-lite-latest:streamGenerateContent'), calls.join(' '));
});

test('Google is opened when facts are needed, not for a greeting, code, writing or feelings', () => {
  assert.equal(googleHelps('أهلاً، إزيك؟'), false);
  assert.equal(googleHelps('شكرا يا شاهين'), false);
  assert.equal(googleHelps('hello'), false);
  assert.equal(googleHelps('اكتبلي دالة بايثون بتعكس كلمة'), false);
  assert.equal(googleHelps('write a poem about the sea'), false);
  assert.equal(googleHelps('إيه الفرق بين القهوة التركي والإسبريسو؟'), true);
  assert.equal(googleHelps('مين رئيس وزراء الهند؟'), true);
  assert.equal(googleHelps('اشرحلي التضخم'), true);
});

test('the workspace chat answers a greeting on the fast model, without the search tool', async () => {
  const bodies: { url: string; search: boolean }[] = [];
  const out = await askWorkspace({ messages: [{ role: 'user', text: 'أهلاً يا شاهين' }], language: 'ar' } as never, {
    env: { GEMINI_API_KEY: 'k-greeting' }, retryDelayMs: 0, onEvent: () => {},
    fetch: (async (input: string | URL | Request, init?: RequestInit) => {
      bodies.push({ url: String(input), search: String(init?.body || '').includes('google_search') });
      return sse('أهلاً بيك! أقدر أساعدك في إيه؟');
    }) as typeof fetch,
  });
  assert.match(out.reply, /أهلاً بيك/);
  assert.match(bodies[0]!.url, /gemini-2\.5-flash:streamGenerateContent/);
  assert.equal(bodies[0]!.search, false);
});

test('Google search starts on the fast model and a stuck model does not end the search', async () => {
  const tried: string[] = [];
  const out = await webSearch('أخبار مصر النهارده', 'ar', {
    env: { GEMINI_API_KEY: 'k-search' }, live: true,
    fetch: (async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      const model = url.match(/models\/([^:]+):/)?.[1] || '';
      tried.push(model);
      if (model === 'gemini-2.5-flash') return silent(init?.signal);
      return json({ candidates: [{ content: { parts: [{ text: 'ملخص' }] }, groundingMetadata: { groundingChunks: [{ web: { uri: 'https://www.youm7.com/a', title: 'صفحة' } }] } }] });
    }) as typeof fetch,
  });
  assert.equal(tried[0], 'gemini-2.5-flash');
  assert.equal(tried[1], 'gemini-2.5-flash-lite', 'after a stuck model the next one is tried');
  assert.equal(out.kind, 'web');
  assert.equal(out.answer, 'ملخص');
});

test('an answer stuck in a loop is stopped and written again plainly, without the search tool', async () => {
  const { runaway } = await import('../server/core/engines');
  assert.equal(runaway(`| المعيار | أ |\n|:${'-'.repeat(200)}`), true);
  assert.equal(runaway('سطر مكرر هنا تمام\n'.repeat(8)), true);
  assert.equal(runaway('| أ | ب |\n|:---|:---|\n| 1 | 2 |\n| 3 | 4 |'), false);
  const calls: boolean[] = [];
  const out = await askWorkspace({ messages: [{ role: 'user', text: 'إيه الفرق بين الشاي الأخضر والشاي الأسود؟' }], language: 'ar' } as never, {
    env: { GEMINI_API_KEY: 'k-loop' }, retryDelayMs: 0, onEvent: () => {},
    fetch: (async (_input: string | URL | Request, init?: RequestInit) => {
      const search = String(init?.body || '').includes('google_search');
      calls.push(search);
      return search ? sse(`| المعيار | الأخضر | الأسود |\n|:${'-'.repeat(400)}`) : sse('| المعيار | الأخضر | الأسود |\n|:---|:---|:---|\n| التخمير | لا | نعم |');
    }) as typeof fetch,
  });
  assert.deepEqual(calls, [true, false]);
  assert.match(out.reply, /التخمير/);
});

test('Google search refused by its own limit: the same model answers at once without it', async () => {
  const calls: string[] = [];
  const reply = await callEngine('gemini', 'sys', [{ role: 'user', text: 'مين رئيس وزراء الهند؟' }], {
    env: { GEMINI_API_KEY: 'k-search-limit' }, temperature: 0.5, signal: AbortSignal.timeout(10_000), model: 'gemini-2.5-flash', googleSearch: true, onToken: () => {},
    fetch: (async (input: string | URL | Request, init?: RequestInit) => {
      const search = String(init?.body || '').includes('google_search');
      calls.push(`${String(input).match(/models\/([^:?]+)/)?.[1] || 'list'}${search ? '+search' : ''}`);
      if (search) return json({ error: { code: 429, status: 'RESOURCE_EXHAUSTED' } }, 429);
      return sse('ناريندرا مودي.');
    }) as typeof fetch,
  });
  assert.equal(reply, 'ناريندرا مودي.');
  assert.deepEqual(calls, ['gemini-2.5-flash+search', 'gemini-2.5-flash']);
});
