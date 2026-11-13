import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';
import type { AddressInfo } from 'node:net';
import { strFromU8, unzipSync } from 'fflate';
import { askTurns, createWorkspaceRouter, htmlToText, isPrivateAddress, readPage, ReadError, workspaceInstruction } from '../server/workspace';
import { codeBlocks, fileNameFor, imageRequest, previewDocument, segments, stripImageRequest } from '../src/workspace/codeBlocks';
import { cellNumber, parseMarkdown, slidesOf, tablesOf } from '../src/workspace/markdownDoc';
import { printHtml, safeFileName, xlsxBytes } from '../src/workspace/officeWriters';
import { officeText, xlsxText, xmlText } from '../src/workspace/fileText';
import { fillRefs, parsePlan, runPlan, splitDocument, splitSave, type StepTools } from '../src/workspace/automation';
import { WS_STRINGS } from '../src/workspace/strings';
import { filterOf } from '../src/workspace/ImagesPanel';

const TEN = ['ar', 'en', 'fr', 'es', 'it', 'de', 'ru', 'zh', 'tr', 'fa'] as const;
const publicLookup = async () => ['93.184.216.34'];
const page = (body: string, init: ResponseInit = {}) => new Response(body, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' }, ...init });

test('workspace: private, loopback and reserved addresses are never fetched', () => {
  for (const a of ['127.0.0.1', '10.1.2.3', '172.16.0.1', '172.31.255.255', '192.168.1.1', '169.254.169.254', '100.64.0.1', '0.0.0.0', '224.0.0.1',
    '::1', '::', 'fc00::1', 'fd12::1', 'fe80::1', '::ffff:127.0.0.1', '::ffff:7f00:1', '::ffff:a9fe:a9fe', '64:ff9b::7f00:1', '2002:7f00:1::', 'not-an-ip']) {
    assert.equal(isPrivateAddress(a), true, a);
  }
  for (const a of ['93.184.216.34', '8.8.8.8', '172.32.0.1', '2606:4700::1111', '::ffff:5db8:d822']) assert.equal(isPrivateAddress(a), false, a);
});

test('workspace: a page is read as clean text (no scripts, menus or markup)', () => {
  const { title, text } = htmlToText(`<html><head><title>Sham &amp; Co</title><script>alert(1)</script></head><body><nav>Menu</nav>
    <main><h1>Oud guide</h1><p>Oud is <b>resin</b>&nbsp;wood.</p><ul><li>Agarwood</li><li>Smoke</li></ul></main><footer>© x</footer></body></html>`);
  assert.equal(title, 'Sham & Co');
  assert.match(text, /# Oud guide/);
  assert.match(text, /Oud is resin wood\./);
  assert.match(text, /- Agarwood\n- Smoke/);
  assert.doesNotMatch(text, /alert|Menu|©/);
});

test('workspace: readPage refuses private targets, including a redirect to one', async () => {
  await assert.rejects(readPage('http://127.0.0.1/admin', { fetch: (async () => page('x')) as typeof fetch, lookup: publicLookup }), (e: unknown) => e instanceof ReadError && e.code === 'PRIVATE_ADDRESS');
  await assert.rejects(readPage('http://localhost/', { fetch: (async () => page('x')) as typeof fetch, lookup: publicLookup }), (e: unknown) => e instanceof ReadError && e.code === 'PRIVATE_ADDRESS');
  await assert.rejects(readPage('http://[::ffff:127.0.0.1]/', { fetch: (async () => page('x')) as typeof fetch, lookup: publicLookup }), (e: unknown) => e instanceof ReadError && e.code === 'PRIVATE_ADDRESS');
  await assert.rejects(readPage('file:///etc/passwd', { lookup: publicLookup }), (e: unknown) => e instanceof ReadError && e.code === 'BAD_URL');
  await assert.rejects(readPage('http://example.com:8080/', { lookup: publicLookup }), (e: unknown) => e instanceof ReadError && e.code === 'BAD_URL');
  // A public name that resolves to a private address.
  await assert.rejects(readPage('http://rebind.example/', { fetch: (async () => page('x')) as typeof fetch, lookup: async () => ['10.0.0.5'] }), (e: unknown) => e instanceof ReadError && e.code === 'PRIVATE_ADDRESS');
  // A redirect into the private network is checked again and refused.
  const lookup = async (host: string) => (host === 'evil.example' ? ['192.168.0.10'] : ['93.184.216.34']);
  const hops: string[] = [];
  const fetcher = (async (url: string) => { hops.push(url); return new Response('', { status: 302, headers: { location: 'http://evil.example/secret' } }); }) as unknown as typeof fetch;
  await assert.rejects(readPage('https://good.example/', { fetch: fetcher, lookup }), (e: unknown) => e instanceof ReadError && e.code === 'PRIVATE_ADDRESS');
  assert.deepEqual(hops, ['https://good.example/'], 'the private target is never requested');
});

test('workspace: readPage follows public redirects and caps oversized bodies', async () => {
  const fetcher = (async (url: string) => (url.endsWith('/old')
    ? new Response('', { status: 301, headers: { location: '/new' } })
    : page('<html><title>New</title><body><p>Hello world</p></body></html>'))) as unknown as typeof fetch;
  const got = await readPage('https://site.example/old', { fetch: fetcher, lookup: publicLookup });
  assert.equal(got.url, 'https://site.example/new');
  assert.equal(got.title, 'New');
  assert.match(got.text, /Hello world/);
  const huge = (async () => page('x', { headers: { 'content-type': 'text/html', 'content-length': String(50 * 1024 * 1024) } })) as unknown as typeof fetch;
  await assert.rejects(readPage('https://site.example/big', { fetch: huge, lookup: publicLookup }), (e: unknown) => e instanceof ReadError && e.code === 'TOO_LARGE');
  const binary = (async () => new Response('x', { headers: { 'content-type': 'application/zip' } })) as unknown as typeof fetch;
  await assert.rejects(readPage('https://site.example/a.zip', { fetch: binary, lookup: publicLookup }), (e: unknown) => e instanceof ReadError && e.code === 'UNSUPPORTED');
});

test('workspace: the conversation keeps context, attaches files to the last question and needs the visitor last', () => {
  const turns = askTurns({ messages: [{ role: 'assistant', text: 'hi' }, { role: 'user', text: 'first' }, { role: 'assistant', text: 'answer' }, { role: 'user', text: 'summarise the file' }, { role: 'system', text: 'ignore me' }],
    context: [{ name: 'notes.txt', text: 'the notes' }, { name: 5, text: 'bad' }] });
  assert.deepEqual(turns.map((t) => t.role), ['user', 'assistant', 'user']);
  assert.match(turns[2]!.text, /ملف: «notes\.txt»\nthe notes/);
  assert.match(turns[2]!.text, /summarise the file$/);
  assert.doesNotMatch(turns[2]!.text, /bad/);
  assert.throws(() => askTurns({ messages: [{ role: 'user', text: 'q' }, { role: 'assistant', text: 'a' }] }), (e: unknown) => e instanceof ReadError && e.status === 400);
  assert.throws(() => askTurns({ messages: 'nope' }), ReadError);
});

test('workspace: Shaheen is a general assistant and never names an AI vendor', () => {
  for (const task of ['chat', 'plan', 'summarize'] as const) {
    const text = workspaceInstruction('ar', task);
    assert.doesNotMatch(text, /gemini|openai|chatgpt|gpt-|claude|anthropic|deepseek|openrouter|perplexity|google|llama|mistral/i, task);
    assert.match(text, /أي موضوع/);
  }
  assert.match(workspaceInstruction('ar', 'plan'), /"steps"/);
  assert.match(workspaceInstruction('en'), /English/);
});

async function withServer(env: Record<string, string>, fetcher: typeof fetch, run: (base: string) => Promise<void>) {
  const app = express();
  app.use('/api/workspace', createWorkspaceRouter({ env, fetch: fetcher, lookup: publicLookup }));
  const server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  try { await run(`http://127.0.0.1:${(server.address() as AddressInfo).port}/api/workspace`); } finally { server.close(); }
}
const post = (url: string, body: unknown, headers: Record<string, string> = {}) => fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });

test('workspace routes: status names no vendor; empty input is 400; no engine is 503; owner routes need the admin token', async () => {
  const offline = (async () => { throw new Error('no network'); }) as typeof fetch;
  await withServer({ SHAM_ADMIN_TOKEN: 'a-long-admin-token-123' }, offline, async (base) => {
    const status = await (await fetch(`${base}/status`)).json() as Record<string, unknown>;
    assert.deepEqual(Object.keys(status).sort(), ['ai', 'image', 'notion', 'search', 'slack']);
    assert.equal(status.ai, false);
    assert.equal(status.image, 'off');
    assert.equal((await post(`${base}/search`, { q: '  ' })).status, 400);
    assert.equal((await post(`${base}/image`, { prompt: '' })).status, 400);
    const image = await post(`${base}/image`, { prompt: 'a cat' });
    assert.equal(image.status, 503);
    assert.equal((await image.json() as { code: string }).code, 'NO_IMAGE_ENGINE');
    const asked = await post(`${base}/ask`, { messages: [{ role: 'user', text: 'hello' }] });
    assert.equal(asked.status, 503);
    assert.equal((await asked.json() as { code: string }).code, 'NO_ENGINE');
    assert.equal((await post(`${base}/ask`, { messages: [] })).status, 400);
    assert.equal((await post(`${base}/read`, { url: 'http://169.254.169.254/latest/meta-data' })).status, 400);
    // Search falls back to the encyclopedia (offline here: no results, still 200).
    const found = await (await post(`${base}/search`, { q: 'oud' })).json() as { kind: string; results: unknown[] };
    assert.equal(found.kind, 'encyclopedia');
    assert.equal((await post(`${base}/owner/slack/send`, { text: 'x' })).status, 401);
    assert.equal((await post(`${base}/owner/slack/send`, { text: 'x' }, { authorization: 'Bearer wrong-token-000000' })).status, 401);
    const slack = await post(`${base}/owner/slack/send`, { text: 'x' }, { authorization: 'Bearer a-long-admin-token-123' });
    assert.equal(slack.status, 503, 'the owner passes; Slack is simply not configured');
    assert.equal((await post(`${base}/owner/notion/search`, { q: 'x' }, { authorization: 'Bearer a-long-admin-token-123' })).status, 503);
  });
});

test('workspace routes: the ask route answers with the engine and adds numbered web sources on request', async () => {
  const calls: string[] = [];
  const fetcher = (async (url: string, init?: RequestInit) => {
    calls.push(String(url));
    if (String(url).includes('wikipedia.org')) return new Response(JSON.stringify({ query: { search: [{ title: 'Agarwood', snippet: '<b>Oud</b> resin' }] } }), { headers: { 'content-type': 'application/json' } });
    if (String(url).includes('openai')) {
      const body = JSON.parse(String(init?.body || '{}')) as { messages?: Array<{ content: string }> };
      const last = body.messages?.[body.messages.length - 1]?.content || '';
      assert.match(last, /\[1\] Agarwood — https:\/\/en\.wikipedia\.org\/wiki\/Agarwood/);
      return new Response(JSON.stringify({ choices: [{ message: { content: 'Oud comes from agarwood [1].' } }] }), { headers: { 'content-type': 'application/json' } });
    }
    return new Response('{}', { status: 404 });
  }) as unknown as typeof fetch;
  await withServer({ OPENAI_API_KEY: 'sk-test-key-123456789' }, fetcher, async (base) => {
    const out = await post(`${base}/ask`, { messages: [{ role: 'user', text: 'what is oud' }], language: 'en', search: true });
    assert.equal(out.status, 200);
    const data = await out.json() as { reply: string; sources: Array<{ url: string }> };
    assert.equal(data.reply, 'Oud comes from agarwood [1].');
    assert.equal(data.sources[0]!.url, 'https://en.wikipedia.org/wiki/Agarwood');
    const limited = await Promise.all(Array.from({ length: 32 }, () => post(`${base}/ask`, { messages: [] })));
    assert.ok(limited.some((r) => r.status === 429), 'the ask route is rate limited');
  });
  assert.ok(calls.some((u) => u.includes('openai')));
});

test('workspace code: blocks, runnable kinds, preview pages and the image request', () => {
  const reply = 'Here:\n```python\nprint(1)\n```\nand a page\n```html\n<div>Hi</div>\n```\n```sham-formula\n{}\n```\n```sham-image\na red   fox\n```';
  const blocks = codeBlocks(reply);
  assert.deepEqual(blocks.map((b) => [b.lang, b.runnable]), [['python', 'python'], ['html', 'html']]);
  assert.match(previewDocument(blocks[1]!, true), /<html dir="rtl">[\s\S]*<div>Hi<\/div>/);
  assert.equal(previewDocument({ lang: 'html', code: '<!doctype html><html><body>x</body></html>' }), '<!doctype html><html><body>x</body></html>');
  assert.equal(imageRequest(reply), 'a red fox');
  assert.doesNotMatch(stripImageRequest(reply), /sham-image|red fox/);
  assert.equal(fileNameFor({ lang: 'html' }), 'index.html');
  assert.equal(fileNameFor({ lang: 'python' }, 2), 'code-2.py');
  const parts = segments('Intro\n```js\nconsole.log(1)\n```\nOutro\n```py\nunclosed = 1');
  assert.deepEqual(parts.map((p) => (p.kind === 'code' ? `code:${p.block.runnable}` : 'text')), ['text', 'code:javascript', 'text', 'code:python']);
});

test('workspace documents: Markdown becomes a document, slides and sheets (right-to-left for Arabic)', () => {
  const md = '# تقرير المبيعات\n\nمقدمة قصيرة.\n\n## الأرقام\n\n| المنتج | الكمية |\n|---|---|\n| عود | 1,250 |\n| مسك | ٣٥ |\n\n## الخطة\n\n- نقطة **أولى**\n- نقطة ثانية\n\n```python\nprint(1)\n```';
  const model = parseMarkdown(md);
  assert.equal(model.title, 'تقرير المبيعات');
  assert.equal(model.rtl, true);
  assert.deepEqual(model.blocks.map((b) => b.type), ['heading', 'paragraph', 'heading', 'table', 'heading', 'list', 'code']);
  const slides = slidesOf(model);
  assert.deepEqual(slides.map((s) => s.title), ['تقرير المبيعات', 'الأرقام', 'الخطة']);
  assert.deepEqual(slides[2]!.bullets, ['نقطة أولى', 'نقطة ثانية']);
  assert.equal(slides[1]!.table?.length, 3);
  const [sheet] = tablesOf(model);
  assert.equal(sheet!.name, 'الأرقام');
  assert.equal(cellNumber('1,250'), 1250);
  assert.equal(cellNumber('٣٥'), 35);
  assert.equal(cellNumber('20%'), undefined);
  const html = printHtml(model);
  assert.match(html, /<html dir="rtl" lang="ar">/);
  assert.match(html, /<th>المنتج<\/th>/);
  assert.equal(safeFileName('a/b:c?', 'docx'), 'a b c.docx');
});

test('workspace documents: the Excel workbook is a valid package that reads back the same cells', () => {
  const bytes = xlsxBytes([{ name: 'Sales/2026', rows: [['Product', 'Qty'], ['Oud <&>', '1,250'], ['Musk', '35']] }], true);
  const files = unzipSync(bytes);
  for (const part of ['[Content_Types].xml', '_rels/.rels', 'xl/workbook.xml', 'xl/_rels/workbook.xml.rels', 'xl/styles.xml', 'xl/worksheets/sheet1.xml']) assert.ok(files[part], part);
  const sheet = strFromU8(files['xl/worksheets/sheet1.xml']!);
  assert.match(sheet, /rightToLeft="1"/);
  assert.match(sheet, /<v>1250<\/v>/);
  assert.match(sheet, /Oud &lt;&amp;&gt;/);
  assert.match(strFromU8(files['xl/workbook.xml']!), /name="Sales 2026"/);
  assert.equal(xlsxText(files), 'Product\tQty\nOud <&>\t1250\nMusk\t35');
  assert.equal(officeText(bytes, 'book.xlsx'), 'Product\tQty\nOud <&>\t1250\nMusk\t35');
});

test('workspace files: Word and PowerPoint text is read from their XML', () => {
  assert.equal(xmlText('<w:p><w:r><w:t>Hello</w:t></w:r><w:r><w:t xml:space="preserve"> world &amp; co</w:t></w:r></w:p><w:p><w:r><w:t>Line 2</w:t></w:r></w:p>', 'w'), 'Hello world & co\nLine 2');
  assert.equal(xmlText('<a:p><a:r><a:t>Slide</a:t></a:r></a:p>', 'a'), 'Slide');
});

test('workspace automation: plans are parsed safely, steps chain their results and a failure does not stop the rest', async () => {
  assert.equal(parsePlan('no json here'), undefined);
  assert.equal(parsePlan('{"steps":[{"tool":"rm -rf","input":"/"}]}'), undefined, 'unknown tools are dropped');
  const plan = parsePlan('Sure!\n```json\n{"goal":"Report","steps":[{"tool":"search","input":"solar egypt"},{"tool":"python","input":"boom"},{"tool":"ask","input":"Summarise {{1}}"},{"tool":"document","input":"pptx: {{3}}"},{"tool":"save","input":"notes.md: {{3}}"}]}\n```');
  assert.ok(plan);
  assert.equal(plan.goal, 'Report');
  assert.equal(plan.steps.length, 5);
  assert.equal(parsePlan(JSON.stringify({ steps: Array.from({ length: 20 }, () => ({ tool: 'ask', input: 'x' })) }))!.steps.length, 8);
  assert.equal(fillRefs('a {{1}} b {{ 2 }} c {{9}}', ['one', 'two']), 'a one b two c {{9}}');
  assert.deepEqual(splitDocument('Excel: rows'), { kind: 'xlsx', content: 'rows' });
  assert.deepEqual(splitDocument('just text'), { kind: 'docx', content: 'just text' });
  assert.deepEqual(splitSave('report.md: hello'), { name: 'report.md', content: 'hello' });
  assert.deepEqual(splitSave('../../etc: x'), { name: 'shaheen-result.md', content: '../../etc: x' });
  const seen: string[] = [];
  const tools: StepTools = {
    search: async (q) => { seen.push(`search:${q}`); return 'RESULTS'; },
    read: async () => '',
    ask: async (p) => { seen.push(`ask:${p}`); return 'SUMMARY'; },
    image: async () => '',
    python: async () => { throw new Error('bad code'); },
    document: async (kind, content) => { seen.push(`document:${kind}:${content}`); return 'deck.pptx'; },
    save: async (name, content) => { seen.push(`save:${name}:${content}`); return name; },
  };
  const { results, states } = await runPlan(plan, tools);
  assert.deepEqual(states.map((s) => s.status), ['done', 'failed', 'done', 'done', 'done']);
  assert.deepEqual(seen, ['search:solar egypt', 'ask:Summarise RESULTS', 'document:pptx:SUMMARY', 'save:notes.md:SUMMARY']);
  assert.equal(results[1], '');
});

test('workspace: every word is written in the ten main languages; image filters are well formed', () => {
  for (const [key, text] of Object.entries(WS_STRINGS)) {
    for (const l of TEN) assert.ok((text as Record<string, string>)[l]?.trim(), `${key}.${l}`);
    assert.doesNotMatch(Object.values(text).join(' '), /gemini|openai|chatgpt|claude|deepseek|perplexity|pollinations/i, key);
  }
  assert.equal(filterOf({ brightness: 100, contrast: 120, saturate: 100, blur: 0, grayscale: true, sepia: false }), 'brightness(100%) contrast(120%) saturate(100%) grayscale(1)');
});

test('workspace documents: Word and PowerPoint files are built and read back', async () => {
  const { docxBlob, pptxBlob } = await import('../src/workspace/officeWriters');
  const model = parseMarkdown('# تقرير\n\nمقدمة.\n\n## الأرقام\n\n| المنتج | الكمية |\n|---|---|\n| عود | 12 |\n\n## الخطة\n\n- أولى\n- ثانية\n');
  const word = officeText(new Uint8Array(await (await docxBlob(model)).arrayBuffer()), 'r.docx');
  for (const w of ['تقرير', 'مقدمة.', 'المنتج', 'عود', 'أولى', 'ثانية']) assert.ok(word.includes(w), w);
  const deck = officeText(new Uint8Array(await (await pptxBlob(model)).arrayBuffer()), 'r.pptx');
  assert.match(deck, /## 1\n[\s\S]*تقرير/);
  for (const w of ['الأرقام', 'الخطة', 'عود']) assert.ok(deck.includes(w), w);
});
