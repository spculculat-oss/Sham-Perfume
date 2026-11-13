import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { StoreProduct } from '../src/utils/storeCatalog';
import { filterShowcase, isStockPhoto, matchesCategory, matchesQuery, rankShowcase, thumbWindow } from '../src/utils/promoShowcase';

const product = (over: Partial<StoreProduct> & { sku: string }): StoreProduct => ({
  id: over.sku, name: { ar: over.sku, en: over.sku }, description: { ar: '', en: '' }, brand: '', category: '',
  families: [], notes: { top: [], heart: [], base: [] }, seasons: [], occasions: [], tags: [], price: 100,
  imageUrl: `https://www.shamperfume.com/cdn/${over.sku}.jpg`, images: [], slug: over.sku, inStock: true,
  isFeatured: false, isNew: false, enrichedBy: 'rules', ...over,
});

test('product banner: real, in-stock products lead; demo stock photos and sold-out items go last', () => {
  const demo = product({ sku: 'DEMO', imageUrl: 'https://images.unsplash.com/photo-1?w=300', isFeatured: true });
  const sold = product({ sku: 'SOLD', inStock: false });
  const real = product({ sku: 'REAL' });
  const fresh = product({ sku: 'NEW', isNew: true });
  assert.deepEqual(rankShowcase([demo, sold, real, fresh]).map((p) => p.sku), ['NEW', 'REAL', 'SOLD', 'DEMO']);
  assert.equal(isStockPhoto(demo.imageUrl), true);
  assert.equal(isStockPhoto(real.imageUrl), false);
});

test('product banner: gender filter uses the cleaned gender, then the category text', () => {
  assert.equal(matchesCategory(product({ sku: 'A', gender: 'men', category: 'عود' }), 'men'), true);
  assert.equal(matchesCategory(product({ sku: 'B', gender: 'women' }), 'men'), false);
  assert.equal(matchesCategory(product({ sku: 'C', category: 'مختلط' }), 'unisex'), true);
  assert.equal(matchesCategory(product({ sku: 'D' }), 'all'), true);
});

test('product banner: search folds Arabic letter variants and needs every word', () => {
  const p = product({ sku: 'X', name: { ar: 'عطر أمير العود', en: 'Amir Oud' }, brand: 'Lattafa' });
  assert.equal(matchesQuery(p, 'امير'), true);
  assert.equal(matchesQuery(p, 'lattafa oud'), true);
  assert.equal(matchesQuery(p, 'lattafa rose'), false);
  assert.deepEqual(filterShowcase([p, product({ sku: 'FREE', price: 0 })], 'all', '').map((x) => x.sku), ['X']);
});

test('product banner: thumbnails wrap around the list and never repeat', () => {
  assert.deepEqual(thumbWindow(10, 0), [8, 9, 0, 1, 2]);
  assert.deepEqual(thumbWindow(10, 9), [7, 8, 9, 0, 1]);
  assert.deepEqual(thumbWindow(3, 1), [0, 1, 2]);
  assert.deepEqual(thumbWindow(0, 0), []);
});

test('product banner: the 3 MB product list is never imported eagerly by the banner', () => {
  const src = readFileSync(new URL('../src/components/TopPromoHub.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /^import\s+\w+\s+from\s+['"][^'"]*data\/products\.json['"]/m);
  assert.match(src, /loadStoreCatalog\(/);
});
