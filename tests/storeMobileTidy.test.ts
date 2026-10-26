/**
 * Shaheen tasks #294 / #346: the store on a phone in one language, without repeats — notes in Arabic on the Arabic
 * page, the price filter's bands taken from the catalogue, «رجالي» / «نسائي» showing his own perfumes first.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { noteAr } from '../src/utils/noteNames';

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('the store catalogue notes have Arabic names (the product page shows them in Arabic)', () => {
  const catalog = JSON.parse(read('src/data/live/store-catalog.json')) as { entries: Record<string, { notes: { top: string[]; heart: string[]; base: string[] } }> };
  let all = 0; let known = 0;
  for (const e of Object.values(catalog.entries)) for (const n of [...e.notes.top, ...e.notes.heart, ...e.notes.base]) { all += 1; if (noteAr(n)) known += 1; }
  assert.ok(all > 1000);
  assert.ok(known / all >= 0.97, `only ${known}/${all} notes have an Arabic name`);
  for (const [en, ar] of [['Pomegranate', 'رمان'], ['Rose Water', 'ماء الورد'], ['Carnation', 'قرنفل']]) assert.equal(noteAr(en), ar);
  const detail = read('src/components/ProductDetail.tsx');
  assert.ok(detail.includes("currentLang === 'ar' ? noteAr(n)"), 'the product page translates the notes on the Arabic page');
});

test('the store grid: price bands from the catalogue, own gender first, no payment box repeated on every phone card', () => {
  const store = read('src/components/Storefront.tsx');
  assert.doesNotMatch(store, /p\.price >= 200|money\.price\(200\)/, 'no fixed 200/500 bands');
  assert.ok(store.includes('priceRange === \'under200\' && p.price >= bands.a'));
  assert.ok(store.includes('own(a) - own(b)'), '«رجالي» lists men\'s perfumes before the unisex ones');
  assert.ok(/<div className="hidden sm:block"><ProductPayMethods/.test(store), 'the per-card payment box is hidden on a phone');
});
