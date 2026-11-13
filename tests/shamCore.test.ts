import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import express from 'express';
import { createShamCore } from '../server/core/http';
import { Repository, ValidationError } from '../server/core/repository';
import { FileStore, MemoryStore, createStore } from '../server/core/store';
import { FirestoreStore } from '../server/core/firestoreStore';
import { Orchestrator, AssistantError, validateChatInput } from '../server/core/orchestrator';
import { route, extractEntities } from '../server/core/router';
import { Bm25Index, normalize, tokenize } from '../server/core/text';
import { defaultServices } from '../server/core/seed';
import { storefrontCatalog } from '../server/core/storeGuide';

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
const visitor = 'visitor-test-0001';
const freshRepo = (env: Record<string, string> = {}) => new Repository(new MemoryStore(), { SHAM_SEED_DEMO: 'true', ...env });

test('Arabic normalisation and light stemming make variants match', () => {
  assert.equal(normalize('إِلَى العُطُورِ ١٢'), 'الي العطور 12');
  assert.deepEqual(tokenize('العطور'), tokenize('عطر'));
  const index = new Bm25Index([
    { id: 'a', title: 'التعتيق', text: 'ترك العطر فترة ليتجانس', kind: 'knowledge' },
    { id: 'b', title: 'الشحن', text: 'مدة التوصيل', kind: 'knowledge' },
  ]);
  assert.equal(index.search('ما هو تعتيق العطور؟')[0].doc.id, 'a');
  assert.deepEqual(index.search('كلمات لا علاقة لها إطلاقاً xyz'), []);
});

test('router picks the right expert and extracts entities', () => {
  const services = defaultServices();
  assert.equal(route('السلام عليكم', services).intent, 'greeting');
  assert.equal(route('بتقدموا خدمات ايه؟', services).intent, 'list_services');
  assert.deepEqual([route('عايز اطلب عطر مخصص هدية', services).intent, route('عايز اطلب عطر مخصص هدية', services).serviceId], ['service_request', 'custom-formula']);
  assert.equal(route('محتاج عرض سعر جملة لمصنع', services).serviceId, 'b2b');
  assert.equal(route('عايز اكلم موظف', services).intent, 'handoff');
  assert.equal(route('فين طلبي sh-ab12cd', services).intent, 'track_order');
  assert.equal(route('50 مل بتركيز 20%', services).intent, 'calculate');
  assert.equal(route('I want to buy oud oil', services).serviceId, 'store');
  const e = extractEntities('اسمي منى ورقمي ٠١٠١٢٣٤٥٦٧٨ وطلبي SH-ABC234');
  assert.equal(e.name, 'منى'); assert.equal(e.ref, 'SH-ABC234'); assert.ok(e.phone?.includes('01012345678'));
});

test('seeding is idempotent and never ships fake products unless demo is requested', async () => {
  const plain = new Repository(new MemoryStore(), {});
  assert.equal((await plain.products(true)).length, 0);
  assert.ok((await plain.services()).length >= 6);
  await plain.saveService({ id: 'store', nameAr: 'متجر شام' }, 'store');
  plain['seeded'] = undefined;
  await plain.ready();
  assert.equal((await plain.services()).find((s) => s.id === 'store')?.nameAr, 'متجر شام');
});

test('orders are priced on the server, reserve stock, and cancellation restocks once', async () => {
  const repo = freshRepo();
  const [oud] = (await repo.products()).filter((p) => p.sku === 'DEMO-OUD-30');
  const request = await repo.createRequest({
    serviceId: 'store', contact: { name: 'Mona', phone: '+20 101 234 5678' },
    fields: { address: 'Giza', payment: 'cash_on_delivery' },
    items: [{ productId: oud.id, quantity: 2, unitPrice: 1 }, { productId: oud.id, quantity: 1 }], total: 1,
  });
  assert.match(request.ref, /^SH-[A-Z2-9]{6}$/);
  assert.equal(request.total, oud.price * 3);
  assert.equal(request.items?.length, 1);
  assert.equal((await repo.products()).find((p) => p.id === oud.id)?.stock, oud.stock - 3);
  await assert.rejects(repo.createRequest({ serviceId: 'store', contact: { name: 'x', email: 'x@y.co' }, fields: { address: 'a', payment: 'wallet' }, items: [{ productId: oud.id, quantity: 999 }] }), (e: ValidationError) => e.status === 409);
  await repo.updateRequest(request.id, { status: 'cancelled' });
  assert.equal((await repo.products()).find((p) => p.id === oud.id)?.stock, oud.stock);
  await assert.rejects(repo.updateRequest(request.id, { status: 'new' }), ValidationError);
  assert.equal((await repo.products()).find((p) => p.id === oud.id)?.stock, oud.stock);
});

test('request validation: required fields, select options, contact and info services', async () => {
  const repo = freshRepo();
  const ok = { serviceId: 'b2b', contact: { name: 'Co', email: 'buyer@shop.com' }, fields: { company: 'Shop', quantity: '500', products: 'oils' } };
  await repo.createRequest(ok);
  for (const bad of [
    { ...ok, serviceId: 'platform-tools' }, { ...ok, serviceId: 'nope' }, { ...ok, contact: { name: 'Co' } },
    { ...ok, contact: { name: 'Co', email: 'bad' } }, { ...ok, fields: { company: 'Shop' } },
    { serviceId: 'custom-formula', contact: { name: 'a', phone: '0101234567' }, fields: { family: 'plastic', volume_ml: '50' } },
    { serviceId: 'custom-formula', contact: { name: 'a', phone: '0101234567' }, fields: { family: 'oud', volume_ml: 'lots' } },
    { serviceId: 'store', contact: { name: 'a', phone: '0101234567' }, fields: { address: 'x', payment: 'wallet' }, items: [] },
  ]) await assert.rejects(repo.createRequest(bad), ValidationError);
});

test('tracking requires the reference AND the matching phone or email', async () => {
  const repo = freshRepo();
  const r = await repo.createRequest({ serviceId: 'support', contact: { name: 'A', phone: '+20 100 000 1234', email: 'a@b.com' }, fields: { subject: 's', message: 'm' } });
  assert.ok(await repo.trackRequest(r.ref.toLowerCase(), '01000001234'));
  assert.ok(await repo.trackRequest(r.ref, 'A@B.com'));
  assert.equal(await repo.trackRequest(r.ref, '01099999999'), undefined);
  assert.equal(await repo.trackRequest(r.ref, ''), undefined);
  assert.equal(await repo.trackRequest('SH-XXXXXX', '01000001234'), undefined);
});

test('built-in engine answers with zero keys, grounded with citations and cards', async () => {
  const repo = freshRepo();
  const bot = new Orchestrator(repo, { env: {} });
  const kb = await bot.chat({ message: 'يعني ايه تعتيق العطر؟', visitorId: visitor, language: 'ar' }, { debug: true });
  assert.equal(kb.engine.id, 'sham_local');
  assert.match(kb.reply, /التعتيق/);
  assert.ok(kb.citations.some((c) => c.id === 'kb-maceration'));
  assert.ok(kb.trace?.some((t) => t.stage === 'retrieve'));

  const buy = await bot.chat({ message: 'عايز اشتري زيت عود', visitorId: visitor, conversationId: kb.conversationId, language: 'ar' });
  assert.equal(buy.conversationId, kb.conversationId);
  assert.ok(buy.actions.some((a) => a.type === 'request_form' && a.serviceId === 'store'));
  // The shop's real catalog answers first (server/core/catalog.ts): a product that exists, at its own price.
  const { items } = await storefrontCatalog({});
  assert.ok(items.some((i) => buy.reply.includes(i.nameAr) && buy.reply.includes(String(i.price))), 'quotes a real storefront product');

  const unknown = await bot.chat({ message: 'كم سعر الذهب في البورصة', visitorId: visitor, language: 'ar' });
  assert.doesNotMatch(unknown.reply, /ذهب.*\d+ جنيه/);

  const calc = await bot.chat({ message: '100 ml at 15%', visitorId: visitor, language: 'en' });
  assert.match(calc.reply, /15 ml/);
});

test('a store with no merchant catalog still answers from the real storefront — and invents nothing', async () => {
  // The production case: the admin catalog was never filled. The shop is not empty, so the assistant must not
  // pretend it is: it quotes the real storefront and offers a form whose products all exist.
  const bot = new Orchestrator(new Repository(new MemoryStore(), {}), { env: {} });
  const out = await bot.chat({ message: 'عايز اشتري زيت عود بكام', visitorId: visitor, language: 'ar' });
  assert.doesNotMatch(out.reply, /مفيش منتجات|لسه بيتجهز/);
  const { items } = await storefrontCatalog({});
  const prices = new Set(items.map((i) => Math.round(i.price)));
  for (const match of out.reply.matchAll(/(\d+)\s*جنيه/g)) assert.ok(prices.has(Number(match[1])), `invented price ${match[1]}`);
  const form = out.actions.find((a) => a.type === 'request_form' && a.serviceId === 'store');
  assert.ok(form, 'the store request form is offered');
  const card = out.actions.find((a) => a.type === 'products') as { products?: { sku: string }[] } | undefined;
  const skus = new Set(items.map((i) => i.sku));
  assert.ok(card?.products?.length, 'the form has products to pick');
  for (const product of card!.products!) assert.ok(skus.has(product.sku), `${product.sku} is not a real storefront product`);
});

test('card numbers are redacted before storage and conversations are isolated per visitor', async () => {
  const repo = freshRepo();
  const bot = new Orchestrator(repo, { env: {} });
  const out = await bot.chat({ message: 'بطاقتي 4111 1111 1111 1111 عايز ادفع', visitorId: visitor, language: 'ar' });
  const saved = await repo.conversation(out.conversationId);
  assert.ok(!JSON.stringify(saved).includes('4111 1111'));
  const other = await bot.chat({ message: 'مرحبا', visitorId: 'visitor-intruder-01', conversationId: out.conversationId, language: 'ar' });
  assert.notEqual(other.conversationId, out.conversationId);
});

test('self-hosted open model is used first, gets grounded context, and fails over to the next engine', async () => {
  const repo = freshRepo();
  const calls: { url: string; body: any }[] = [];
  const fetchMock = (async (url: string | URL, init?: RequestInit) => {
    calls.push({ url: String(url), body: JSON.parse(String(init?.body)) });
    if (String(url).startsWith('http://llm.internal')) return json({ error: 'down' }, 500);
    return json({ choices: [{ message: { content: '<think>secret</think>رد من OpenAI' } }] });
  }) as typeof fetch;
  const bot = new Orchestrator(repo, { env: { SHAM_LLM_BASE_URL: 'http://llm.internal:11434/v1/', OPENAI_API_KEY: 'k' }, fetch: fetchMock });
  const out = await bot.chat({ message: 'يعني ايه تعتيق العطر؟', visitorId: visitor, language: 'ar' }, { debug: true });
  assert.equal(calls[0].url, 'http://llm.internal:11434/v1/chat/completions');
  assert.equal(calls[1].url, 'https://api.openai.com/v1/chat/completions');
  assert.match(calls[0].body.messages[0].content, /retrieve_knowledge/);
  assert.match(calls[0].body.messages[0].content, /Use ONLY facts in CONTEXT/);
  assert.equal(out.engine.id, 'openai');
  assert.equal(out.reply, 'رد من OpenAI');

  const allDown = new Orchestrator(repo, { env: { OPENAI_API_KEY: 'k' }, fetch: (async () => { throw new Error('network'); }) as typeof fetch });
  const fallback = await allDown.chat({ message: 'يعني ايه تعتيق العطر؟', visitorId: visitor, language: 'ar' });
  assert.equal(fallback.engine.id, 'sham_local');
});

test('admin engine policy is respected (disabled engines are never called)', async () => {
  const repo = freshRepo();
  await repo.updateSettings({ enginePolicy: ['sham_local'] });
  let called = false;
  const bot = new Orchestrator(repo, { env: { OPENAI_API_KEY: 'k' }, fetch: (async () => { called = true; return json({}); }) as typeof fetch });
  await bot.chat({ message: 'بتقدموا خدمات ايه', visitorId: visitor, language: 'ar' });
  assert.equal(called, false);
  await assert.rejects(repo.updateSettings({ enginePolicy: ['skynet' as never] }), ValidationError);
});

test('chat input validation', () => {
  for (const bad of [null, {}, { message: 'hi' }, { message: 'hi', visitorId: 'short' }, { message: ' ', visitorId: visitor },
    { message: 'x'.repeat(2001), visitorId: visitor }, { message: 'hi', visitorId: visitor, language: 'xx' }, { message: 'hi', visitorId: visitor, conversationId: '../etc' }]) {
    assert.throws(() => validateChatInput(bad), AssistantError);
  }
});

test('FileStore persists atomically across instances', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'sham-core-'));
  try {
    const file = path.join(dir, 'nested', 'data.json');
    const a = new Repository(new FileStore(file), {});
    await a.saveKnowledge({ title: 'سياسة الشحن', content: 'التوصيل خلال 3 أيام عمل داخل القاهرة' });
    const b = new Repository(new FileStore(file), {});
    assert.ok((await b.knowledge()).some((d) => d.title === 'سياسة الشحن'));
    assert.ok(JSON.parse(await readFile(file, 'utf8')).knowledge);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('store selection follows hosting: file on Node, memory on Vercel without config, firestore when requested', () => {
  assert.equal(createStore({ SHAM_DATA_FILE: path.join(tmpdir(), 'x.json') }).kind, 'file');
  assert.equal(createStore({ VERCEL: '1' }).kind, 'memory');
  assert.throws(() => createStore({ SHAM_STORE: 'firestore' }), /FIREBASE_PROJECT_ID/);
});

test('FirestoreStore signs a service-account JWT and stores JSON documents', async () => {
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048, privateKeyEncoding: { type: 'pkcs8', format: 'pem' }, publicKeyEncoding: { type: 'spki', format: 'pem' } });
  const docs = new Map<string, string>();
  const calls: string[] = [];
  const fetchMock = (async (url: string | URL, init?: RequestInit) => {
    const u = String(url); calls.push(`${init?.method || 'GET'} ${u}`);
    if (u === 'https://oauth2.googleapis.com/token') {
      assert.match(String(init?.body), /assertion=[\w-]+\.[\w-]+\.[\w-]+/);
      return json({ access_token: 'tok', expires_in: 3600 });
    }
    assert.equal((init?.headers as Record<string, string>).Authorization, 'Bearer tok');
    const key = u.split('?')[0];
    if (init?.method === 'PATCH') { docs.set(key, JSON.parse(String(init.body)).fields.json.stringValue); return json({}); }
    if (u.includes('?pageSize')) return json({ documents: [...docs].filter(([k]) => k.startsWith(`${key}/`)).map(([, v]) => ({ fields: { json: { stringValue: v } } })) });
    return docs.has(key) ? json({ fields: { json: { stringValue: docs.get(key) } } }) : json({}, 404);
  }) as typeof fetch;
  const store = new FirestoreStore({ projectId: 'p1', clientEmail: 'svc@p1.iam.gserviceaccount.com', privateKey, prefix: 'sham_core_', fetch: fetchMock });
  const repo = new Repository(store, {});
  await repo.ready();
  assert.ok((await repo.services()).length >= 6);
  assert.ok(calls.some((c) => c.includes('/documents/sham_core_services/store')));
  assert.equal(calls.filter((c) => c.includes('oauth2')).length, 1, 'token is cached');
});

test('HTTP: public assistant API and admin protection', async () => {
  const core = createShamCore({ env: { SHAM_STORE: 'memory', SHAM_SEED_DEMO: 'true', SHAM_ADMIN_TOKEN: 'correct-horse-battery' } });
  const app = express();
  app.use(express.json());
  app.use('/api/assistant', core.assistant);
  app.use('/api/admin', core.admin);
  const server = app.listen(0, '127.0.0.1');
  await new Promise((r) => server.once('listening', r));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
  try {
    const config = await (await fetch(`${base}/assistant/config`)).json();
    assert.equal(config.modelEnhanced, false);
    assert.ok(config.services.every((s: Record<string, unknown>) => !('keywords' in s)));

    const chat = await fetch(`${base}/assistant/chat`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ message: 'عايز اكلم موظف', visitorId: visitor }) });
    const reply = await chat.json();
    assert.equal(reply.status, 'handoff');
    assert.equal(reply.trace, undefined, 'trace is admin-only');

    assert.equal((await fetch(`${base}/admin/overview`)).status, 401);
    assert.equal((await fetch(`${base}/admin/overview`, { headers: { Authorization: 'Bearer wrong' } })).status, 401);
    const auth = { Authorization: 'Bearer correct-horse-battery', 'content-type': 'application/json' };
    const overview = await (await fetch(`${base}/admin/overview`, { headers: auth })).json();
    assert.equal(overview.counts.handoffsOpen, 1);

    await fetch(`${base}/admin/conversations/${reply.conversationId}/reply`, { method: 'POST', headers: auth, body: JSON.stringify({ text: 'أهلاً، معك سارة من فريق شام' }) });
    const polled = await (await fetch(`${base}/assistant/conversations/${reply.conversationId}?visitorId=${visitor}`)).json();
    assert.equal(polled.messages.at(-1).engine, 'human');
    assert.equal((await fetch(`${base}/assistant/conversations/${reply.conversationId}?visitorId=visitor-other-001`)).status, 404);

    const created = await fetch(`${base}/admin/services`, { method: 'POST', headers: auth, body: JSON.stringify({ nameAr: 'تغليف هدايا', nameEn: 'Gift wrapping', kind: 'custom', keywords: ['تغليف', 'gift wrap'], formFields: [{ name: 'occasion', labelAr: 'المناسبة', labelEn: 'Occasion', type: 'text', required: true }] }) });
    assert.equal(created.status, 201);
    const sandbox = await (await fetch(`${base}/admin/test-chat`, { method: 'POST', headers: auth, body: JSON.stringify({ message: 'عايز اطلب تغليف هدايا' }) })).json();
    assert.equal(sandbox.actions.find((a: { type: string }) => a.type === 'request_form')?.serviceId, 'gift-wrapping');
    assert.ok(sandbox.trace.length > 3);
  } finally { server.close(); }

  const disabled = createShamCore({ env: { SHAM_STORE: 'memory', SHAM_ADMIN_TOKEN: 'short' } });
  const app2 = express(); app2.use('/api/admin', disabled.admin);
  const s2 = app2.listen(0, '127.0.0.1'); await new Promise((r) => s2.once('listening', r));
  try {
    const res = await fetch(`http://127.0.0.1:${(s2.address() as AddressInfo).port}/api/admin/overview`, { headers: { Authorization: 'Bearer short' } });
    assert.equal(res.status, 503);
  } finally { s2.close(); }
});

test('identity questions are answered by Sham itself, without calling any model or naming a vendor', async () => {
  let modelCalls = 0;
  const repo = freshRepo({ SHAM_LLM_BASE_URL: 'http://llm.test/v1', SHAM_LLM_MODEL: 'main' });
  const bot = new Orchestrator(repo, { env: { SHAM_LLM_BASE_URL: 'http://llm.test/v1', SHAM_LLM_MODEL: 'main' },
    fetch: (async () => { modelCalls++; return json({ choices: [{ message: { content: 'I am ChatGPT by OpenAI' } }] }); }) as typeof fetch });
  const control = await bot.chat({ message: 'ازاي اعمل عطر ثابت؟', visitorId: visitor, language: 'ar' });
  assert.ok(modelCalls > 0 && control.engine.id !== 'sham_local', 'the model is wired up for normal questions');
  modelCalls = 0;
  for (const message of ['انت شغال بأنهي ذكاء اصطناعي؟ ChatGPT ولا Gemini؟', 'انت مين؟', 'Who made you? Are you Claude?']) {
    const out = await bot.chat({ message, visitorId: visitor, language: /[a-z]/i.test(message[0]) ? 'en' : 'ar' });
    assert.match(out.reply, /مساعد شام|Sham assistant/);
    assert.doesNotMatch(out.reply, /gemini|openai|chatgpt|claude|anthropic|deepseek|google/i);
  }
  assert.equal(modelCalls, 0);
  assert.equal(route('عطر شغال على العود', defaultServices()).intent === 'identity', false, 'perfume talk is not an identity question');
});
