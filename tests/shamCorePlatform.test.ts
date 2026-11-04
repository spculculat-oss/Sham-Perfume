/**
 * «دليل المنصة» — the Sham assistant must know the platform as it is today, not as it was when the
 * seed was first written: every visitor-facing tool gets a knowledge document, a direct answer and an
 * «open page» card, existing stores receive the new documents once, and nothing the merchant edited or
 * deleted is touched.
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { Repository } from '../server/core/repository';
import { MemoryStore } from '../server/core/store';
import { Orchestrator } from '../server/core/orchestrator';
import { route, extractEntities } from '../server/core/router';
import { defaultKnowledge, defaultServices, defaultSettings, knowledgeSeedAdditions, KNOWLEDGE_SEED_VERSION } from '../server/core/seed';
import { matchPlatformFeature, PLATFORM_FEATURES, platformCatalog, shippingBrief } from '../server/core/platformGuide';

const visitor = 'visitor-platform-001';
const freshRepo = () => new Repository(new MemoryStore(), { SHAM_SEED_DEMO: 'true' });

test('every platform tab the guide links to really exists in the app shell', async () => {
  const app = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8');
  const tabs = new Set([...app.matchAll(/activeTab === '([a-zA-Z_]+)'/g)].map((m) => m[1]));
  assert.ok(tabs.has('store') && tabs.has('molecule_studio'), 'the shell still uses the same tab ids');
  for (const feature of PLATFORM_FEATURES) {
    if (!feature.tab) continue;
    const base = feature.tab.split('/')[0];
    assert.ok(tabs.has(base), `${feature.id}: tab “${feature.tab}” is not a route in src/App.tsx`);
  }
  const ids = PLATFORM_FEATURES.map((f) => f.id);
  assert.equal(new Set(ids).size, ids.length, 'feature ids are unique');
  const docIds = PLATFORM_FEATURES.map((f) => f.docId);
  assert.equal(new Set(docIds).size, docIds.length, 'no two features share a knowledge document');
});

test('the seed ships a document for each platform feature, including the ones added later', async () => {
  const docs = new Map(defaultKnowledge().map((doc) => [doc.id, doc]));
  for (const feature of PLATFORM_FEATURES) {
    assert.ok(docs.has(feature.docId), `missing knowledge for ${feature.id} (${feature.docId})`);
    assert.ok(docs.get(feature.docId)!.content.length > 80, `${feature.docId} explains the feature`);
  }
  for (const id of ['kb-platform-molecule-studio', 'kb-platform-books', 'kb-platform-community', 'kb-platform-formulas', 'kb-platform-shipping', 'kb-platform-account', 'kb-platform-guide']) {
    assert.ok(docs.has(id), `missing ${id}`);
  }
  // The Arabic docs stay searchable in English too (the visitor may ask in English).
  assert.match(docs.get('kb-platform-molecule-studio')!.tags.join(' '), /molecule studio/i);
  // The model prompt gets the live map and the real shipping table, never a copied list.
  assert.match(platformCatalog('en'), /Molecule Studio/);
  assert.match(platformCatalog('ar'), /حاسبة التركيز/);
  assert.match(shippingBrief('ar'), /UN1266/);
  assert.match(shippingBrief('en'), /first bottle/);
});

test('an existing store is upgraded once: new guides arrive, edits survive, deletions are not resurrected', async () => {
  const store = new MemoryStore();
  const { shaheen: _shaheen, ...settings } = defaultSettings();
  const legacy = { ...settings, id: 'core' } as Record<string, unknown>;
  delete legacy.knowledgeSeedVersion; // a store seeded before the platform guide existed
  await store.put('settings', 'core', legacy as never);

  const old = defaultKnowledge().filter((d) => !d.id.startsWith('kb-platform-'));
  const edited = { ...old.find((d) => d.id === 'kb-about')!, content: 'نص عدّله التاجر بنفسه' };
  await store.put('knowledge', 'kb-about', edited);
  // kb-pyramid was deleted by the merchant before the upgrade: it must NOT come back.
  for (const doc of old.filter((d) => d.id !== 'kb-pyramid' && d.id !== 'kb-about')) await store.put('knowledge', doc.id, doc);

  const repo = new Repository(store, {});
  await repo.ready();
  const docs = await repo.knowledge();
  assert.equal(docs.find((d) => d.id === 'kb-about')!.content, edited.content, 'admin edits are never overwritten');
  assert.equal(docs.find((d) => d.id === 'kb-pyramid'), undefined, 'a deleted document is not resurrected');
  assert.ok(docs.some((d) => d.id === 'kb-platform-community'), 'the new platform guide reached the old store');
  assert.equal((await store.get('settings', 'core'))!.knowledgeSeedVersion, KNOWLEDGE_SEED_VERSION);

  // Upgrading again (a restart) changes nothing, even after deleting a platform document on purpose.
  await repo.remove('knowledge', 'kb-platform-books');
  const restarted = new Repository(store, {});
  await restarted.ready();
  assert.equal((await restarted.knowledge()).find((d) => d.id === 'kb-platform-books'), undefined, 'a second boot does not re-add');
});

test('knowledgeSeedAdditions only lists what a given version introduced', () => {
  const fresh = knowledgeSeedAdditions(1);
  assert.ok(fresh.length >= 12);
  assert.ok(fresh.every((d) => d.id.startsWith('kb-platform-') || d.id.startsWith('kb-store-')), 'only the guides added after v1');
  assert.ok(fresh.some((d) => d.id.startsWith('kb-platform-')), 'the platform guide is in the upgrade');
  assert.deepEqual(knowledgeSeedAdditions(KNOWLEDGE_SEED_VERSION), []);
  // A store that only has the platform guide still receives the store guide.
  assert.ok(knowledgeSeedAdditions(2).every((d) => d.id.startsWith('kb-store-')), 'v3 adds the store guide only');
});

test('the router recognises platform questions and never reads an English word as an order reference', () => {
  const services = defaultServices();
  const cases: [string, string | undefined][] = [
    ['إزاي أستخدم حاسبة التركيز؟', 'concentration'],
    ['عايز أعرف عن معمل الجزيئات', 'molecule_studio'],
    ['فين مكتبة الكتب؟', 'books'],
    ['إزاي أستخدم بريد شام', 'community'],
    ['إيه هو مجتمع شام؟', 'community'],
    ['الشحن بكام لمصر؟', 'shipping'],
    ['سؤال عام عن الشحن', 'shipping'],
    ['how do I use the book library?', 'books'],
    ['what is molecule studio', 'molecule_studio'],
    ['tell me about shipping', 'shipping'],
    ['how do I sign in with a passkey', 'account'],
    ['دليل المنصة', undefined],
    ['إيه الجديد في المنصة؟', undefined],
  ];
  for (const [message, feature] of cases) {
    const routed = route(message, services);
    assert.equal(routed.intent, 'platform_help', message);
    assert.equal(routed.platformId, feature, message);
  }
  // Words that used to become a fake SH reference («shipping» → SH-IPPING) are just words now.
  assert.equal(extractEntities('tell me about shipping').ref, undefined);
  assert.equal(extractEntities('عايز أعرف الشحن').ref, undefined);
  assert.equal(extractEntities('طلبي SH-ABC234').ref, 'SH-ABC234');
  // Real service requests and perfumery questions keep their old routes.
  assert.equal(route('عايز أشتري عطر مخصص هدية', services).intent, 'service_request');
  assert.equal(route('عايز اشتري زيت عود', services).serviceId, 'store');
  assert.equal(route('بتقدموا خدمات ايه؟', services).intent, 'list_services');
  assert.equal(route('يعني ايه تعتيق العطر؟', services).intent, 'question');
  assert.equal(matchPlatformFeature('ما هو المسك والعنبر؟'), undefined, 'perfumery talk is not a platform page');
});

test('a platform question is answered directly, in the visitor’s language, with an «open page» card', async () => {
  const repo = freshRepo();
  const bot = new Orchestrator(repo, { env: {} });

  const ar = await bot.chat({ message: 'إزاي أستخدم معمل الجزيئات؟', visitorId: visitor, language: 'ar' });
  assert.equal(ar.intent, 'platform_help');
  assert.match(ar.reply, /معمل الجزيئات/);
  assert.match(ar.reply, /افتح الصفحة/);
  assert.ok(ar.actions.some((a) => a.type === 'open_tab' && a.tab === 'molecule_studio'));
  assert.ok(ar.citations.some((c) => c.id === 'kb-platform-molecule-studio'), 'the answer cites the right guide');
  assert.ok(ar.suggestions.length > 0 && ar.suggestions.every((s) => /إزاي أستخدم|بتقدموا/.test(s)));

  const en = await bot.chat({ message: 'how do I use the book library?', visitorId: visitor, language: 'en' });
  assert.match(en.reply, /Book library/);
  assert.match(en.reply, /Open page/);
  assert.ok(en.actions.some((a) => a.type === 'open_tab' && a.tab === 'world_perfumes'));

  // Platform questions are not knowledge gaps: the guide always has an answer.
  assert.deepEqual(await repo.gaps(), []);
});

test('the platform overview names the current tools instead of guessing', async () => {
  const repo = freshRepo();
  const bot = new Orchestrator(repo, { env: {} });
  const out = await bot.chat({ message: 'دليل المنصة', visitorId: visitor, language: 'ar' });
  assert.equal(out.intent, 'platform_help');
  for (const name of ['حاسبة التركيز', 'معمل الجزيئات', 'مكتبة الكتب', 'مجتمع شام', 'المتجر']) {
    assert.match(out.reply, new RegExp(name));
  }
  assert.ok(out.citations.some((c) => c.id === 'kb-platform-guide'));

  const english = await bot.chat({ message: 'platform guide', visitorId: visitor, language: 'en' });
  assert.match(english.reply, /Molecule Studio/);
  assert.match(english.reply, /Sham Community/);
});
