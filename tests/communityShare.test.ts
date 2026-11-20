import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  chatDraft, cleanDraft, defaultDestination, formulaDraft, postText, questionDraft, readShareDraft, registerShareable, SHARE_KEY,
  SHARE_LIMITS, SHARE_SECTIONS, SHARE_THREAD_CATEGORIES, shareableFor, storyCaption, threadCategory, threadDraft, type ShareDraft,
} from '../src/community/share';
import { sharedFormula } from '../src/community/sync';
import { CommunityShareBar } from '../src/components/CommunityShareBar';
import type { FormulationState, PyramidNote } from '../src/types/perfume';

const src = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const ARABIC = /[\u0600-\u06FF]/;

const formulation: FormulationState = {
  bottleVolumeMl: 50, batchCount: 1, concentrationPercent: 20, concentrationType: 'edp', alcoholPercentage: 96, waterPercent: 0,
  fixativePercent: 2, oilDensity: 0.95, alcoholDensity: 0.789, unitMode: 'grams',
};
const notes: PyramidNote[] = [
  { id: 'a', nameAr: 'برغموت', nameEn: 'Bergamot', category: 'top', percentageOfOil: 20 },
  { id: 'b', nameAr: 'ورد', nameEn: 'Rose', category: 'heart', percentageOfOil: 40 },
  { id: 'c', nameAr: 'عود', nameEn: 'Oud', category: 'base', percentageOfOil: 40 },
];

test('a formula from any section becomes readable text plus a card the community opens in the calculator again', () => {
  const d = formulaDraft('concentration', { title: 'Rose Oud', formulation, pyramidNotes: notes, macerationDays: 30, result: { oilWeightGrams: 9.5, alcoholWeightGrams: 30.2 } }, 'en');
  assert.equal(d.kind, 'creation');
  assert.match(d.body, /Bottle: 50 ml/);
  assert.match(d.body, /Oil concentration: 20% \(EDP\)/);
  assert.match(d.body, /Top: Bergamot 20%/);
  assert.match(d.body, /Base: Oud 40%/);
  assert.match(d.body, /Maceration: 30 days/);
  assert.ok(!ARABIC.test(d.body), 'an English visitor never gets Arabic');
  // «استخدم التركيبة دي» reads the very card that is posted.
  const back = sharedFormula(d.recipe!.title, d.recipe!.data);
  assert.ok(back);
  assert.equal(back.formulation.concentrationPercent, 20);
  assert.equal(back.pyramidNotes.length, 3);
  assert.equal(back.macerationDays, 30);
  const ar = formulaDraft('pyramid', { formulation, pyramidNotes: notes }, 'ar');
  assert.match(ar.title, /تركيبتي/);
  assert.match(ar.body, /القمة: برغموت 20%/);
});

test('the draft from storage is cleaned: known section, sane sizes, http links only, no oversized recipe', () => {
  assert.equal(cleanDraft({ source: '../x', title: 'a' }), null);
  assert.equal(cleanDraft({ source: 'pyramid' }), null, 'nothing to share');
  const big = cleanDraft({ source: 'pyramid', title: 'x'.repeat(999), body: 'y'.repeat(9999), link: 'javascript:alert(1)', recipe: { title: 't', data: { blob: 'z'.repeat(60_000) } } })!;
  assert.equal(big.title.length, SHARE_LIMITS.title);
  assert.equal(big.body.length, SHARE_LIMITS.body);
  assert.equal(big.link, undefined);
  assert.equal(big.recipe, undefined);
  assert.deepEqual(cleanDraft({ source: 'alcohol', kind: 'question' }), { source: 'alcohol', kind: 'question', title: '', body: '' }, 'a question may start empty');
});

test('each destination gets what it accepts: a signed post, a short story, a salon thread with a real title and shelf', () => {
  const d: ShareDraft = { source: 'maceration_simulator', kind: 'creation', title: 'My maceration plan', body: 'Day 1 … day 30', link: 'https://example.org/#maceration_simulator' };
  const post = postText(d, 'en');
  assert.match(post, /^My maceration plan\n\nDay 1 … day 30\n\n— From «Maceration simulator» on Sham\nhttps:\/\/example\.org\/#maceration_simulator$/);
  assert.ok(storyCaption({ ...d, title: 'x'.repeat(500) }, 'en').length <= SHARE_LIMITS.story);
  const th = threadDraft({ ...d, title: 'Hi' , body: '' }, 'en');
  assert.ok(th.title.length >= 5, 'the server asks for 5 letters at least');
  assert.equal(th.category, 'maceration');
  assert.deepEqual(th.tags, ['maceration-simulator']);
  for (const s of Object.keys(SHARE_SECTIONS)) assert.ok((SHARE_THREAD_CATEGORIES as readonly string[]).includes(threadCategory(s)), s);
  assert.equal(threadCategory('raw_materials'), 'materials');
  assert.equal(threadCategory('costing'), 'sourcing');
  assert.equal(defaultDestination(questionDraft('pyramid', 'ar')), 'discussion');
  assert.equal(defaultDestination(d), 'post');
  assert.match(questionDraft('cosmetics', 'ar').title, /مصمم التركيبات/);
});

test('a question to Shaheen goes with its answer (and the formula card when the answer had one)', () => {
  const d = chatDraft('How do I fix a rose that fades?', 'Add a base of musk.', 'en', { title: 'Rose', data: { formulation: { concentrationPercent: 18 } } });
  assert.equal(d.kind, 'question');
  assert.equal(d.title, 'How do I fix a rose that fades?');
  assert.match(d.body, /^Question: How do I fix a rose that fades\?\n\nShaheen’s answer:\nAdd a base of musk\.$/);
  assert.equal(d.recipe?.title, 'Rose');
});

test('sections with their own state register what they would share; the newest registration wins and cleans up', () => {
  const off = registerShareable('alcohol', () => ({ source: 'alcohol', kind: 'creation', title: 'A', body: 'b' }));
  assert.equal(shareableFor('alcohol')?.title, 'A');
  off();
  assert.equal(shareableFor('alcohol'), null);
  const broken = registerShareable('costing', () => { throw new Error('x'); });
  assert.equal(shareableFor('costing'), null, 'a broken section never breaks the bar');
  broken();
});

test('the draft waits in this tab only (sessionStorage) and comes back cleaned', () => {
  const store = new Map<string, string>();
  (globalThis as { sessionStorage?: unknown }).sessionStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => store.set(k, v), removeItem: (k: string) => store.delete(k) };
  store.set(SHARE_KEY, JSON.stringify({ source: 'cosmetics', kind: 'creation', title: 'Face cream', body: 'Phase A…', extra: 'dropped' }));
  assert.deepEqual(readShareDraft(), { source: 'cosmetics', kind: 'creation', title: 'Face cream', body: 'Phase A…' });
  store.set(SHARE_KEY, '{not json');
  assert.equal(readShareDraft(), null);
  delete (globalThis as { sessionStorage?: unknown }).sessionStorage;
});

test('the share bar speaks the visitor\'s language and offers «share the result» only where there is one', () => {
  const en = renderToStaticMarkup(React.createElement(CommunityShareBar, { tab: 'concentration', lang: 'en', navigate: () => {}, fallback: () => null }));
  assert.match(en, /Share the result/);
  assert.match(en, /Ask the community/);
  assert.ok(!ARABIC.test(en));
  const ar = renderToStaticMarkup(React.createElement(CommunityShareBar, { tab: 'guide', lang: 'ar', navigate: () => {} }));
  assert.match(ar, /اسأل المجتمع/);
  assert.doesNotMatch(ar, /شارك النتيجة/, 'a section with nothing made only asks');
});

test('every section of the site is wired to the community', () => {
  const app = src('src/App.tsx');
  for (const tab of Object.keys(SHARE_SECTIONS).filter((t) => t !== 'chat')) assert.ok(app.includes(`activeTab === '${tab}'`), `${tab} is a real section`);
  assert.match(app, /<CommunityShareBar/);
  assert.match(app, /SHARE_SECTIONS\[activeTab\]/);
  const community = src('src/community/CommunityApp.tsx');
  assert.match(community, /page === 'share'\) body = <SharePage/);
  assert.match(community, /go\(readShareDraft\(\) \? 'share'/, 'after signing in the draft is still there');
  const page = src('src/community/SharePage.tsx');
  for (const endpoint of ["'/community/posts'", "'/community/discussions'", "'/community/stories'", "'/community/me/recipes'"]) assert.ok(page.includes(endpoint), endpoint);
  assert.match(page, /clearShareDraft\(\)/);
  assert.match(src('src/components/PerfumerAIChatbot.tsx'), /<ShareToCommunityButton[\s\S]*chatDraft\(/);
  assert.match(src('src/components/CosmeticsHub.tsx'), /useShareable\('cosmetics'/);
  assert.match(src('src/components/CosmeticsHub.tsx'), /<ShareToCommunityButton/);
  assert.match(src('src/components/AlcoholDilutionCalculator.tsx'), /useShareable\('alcohol'/);
  assert.match(src('src/components/CostCalculator.tsx'), /useShareable\('costing'/);
  assert.match(src('src/components/DesignersStudio.tsx'), /useShareable\('perfume_designers'/);
  assert.match(src('src/components/DesignersStudio.tsx'), /useShareable\('cosmetic_designers'/);
  assert.match(src('src/components/ProductDetail.tsx'), /useShareable\('productDetail'/);
  assert.match(src('src/components/FormulaLibrary.tsx'), /formulaDraft\('library'/);
});

test('the share page shows the draft, the three places it can go and a preview — nothing is sent before «انشر»', async () => {
  const store = new Map<string, string>();
  (globalThis as { sessionStorage?: unknown }).sessionStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => store.set(k, v), removeItem: (k: string) => store.delete(k) };
  const calls: unknown[] = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (...args: unknown[]) => { calls.push(args); throw new Error('no network'); }) as typeof fetch;
  try {
    // The community's components use the automatic JSX runtime of the site's build; the test renderer needs React in scope.
    (globalThis as { React?: unknown }).React = React;
    const { SharePage } = await import('../src/community/SharePage');
    store.set(SHARE_KEY, JSON.stringify(formulaDraft('pyramid', { title: 'Rose Oud', formulation, pyramidNotes: notes }, 'en')));
    const html = renderToStaticMarkup(React.createElement(SharePage, { lang: 'en', go: () => {}, toast: () => {} }));
    assert.match(html, /Sharing from «Fragrance pyramid»/);
    for (const dest of ['post', 'discussion', 'story']) assert.match(html, new RegExp(`data-testid="share-dest-${dest}"`));
    assert.match(html, /Attach the formula card/);
    assert.match(html, /— From «Fragrance pyramid» on Sham/);
    assert.ok(!ARABIC.test(html), 'an English member reads English');
    store.clear();
    const empty = renderToStaticMarkup(React.createElement(SharePage, { lang: 'ar', go: () => {}, toast: () => {} }));
    assert.match(empty, /مفيش حاجة مستنية المشاركة/);
    assert.equal(calls.length, 0, 'opening the page sends nothing');
  } finally {
    globalThis.fetch = realFetch;
    delete (globalThis as { sessionStorage?: unknown }).sessionStorage;
  }
});
