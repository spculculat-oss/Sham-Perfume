import assert from 'node:assert/strict';
import { test } from 'node:test';
import { useCleanPhotos, type ImageRegistry } from '../scripts/shaheen-import/transform';
import { productImages, type RawProduct } from '../src/utils/storeCatalog';

const MARKED = 'https://supplier.example/cdn/large/angham-1.jpg';
const PLAIN = 'https://supplier.example/cdn/large/angham-2.jpg';
const registry: ImageRegistry = { images: {
  [MARKED]: { s: 'edited', f: 'store-images/angham-1-1a2b3c4d.jpg' },
  [PLAIN]: 'ok',
  'https://supplier.example/unclear.jpg': { s: 'review' },
} };

test('a refreshed product gets the cleaned copy of a photo that carried contact marks, every other photo stays', () => {
  const products = [
    { id: 1, imageUrl: MARKED, images: [MARKED, PLAIN, 'https://supplier.example/unclear.jpg'] },
    { id: 2, imageUrl: PLAIN, images: [PLAIN] },
  ] as unknown as RawProduct[];
  assert.equal(useCleanPhotos(products, registry), 1);
  assert.equal(products[0].imageUrl, 'store-images/angham-1-1a2b3c4d.jpg');
  assert.deepEqual(products[0].images, ['store-images/angham-1-1a2b3c4d.jpg', PLAIN, 'https://supplier.example/unclear.jpg']);
  assert.equal(products[1].imageUrl, PLAIN);
  assert.equal(useCleanPhotos(products, registry), 0, 'already clean: nothing changes');
  assert.equal(useCleanPhotos(products, undefined), 0, 'no registry yet: nothing breaks');
});

test('the store shows a cleaned photo kept in the site, and still refuses other relative or insecure links', () => {
  const shown = productImages({ imageUrl: 'store-images/angham-1-1a2b3c4d.jpg', images: ['store-images/angham-1-1a2b3c4d.jpg', PLAIN, 'http://x.example/a.jpg', '../secret.jpg'] } as unknown as RawProduct);
  assert.deepEqual(shown, ['store-images/angham-1-1a2b3c4d.jpg', PLAIN]);
});
