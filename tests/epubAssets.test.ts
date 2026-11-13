import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { READING_GUIDE, epubAssetUrl } from '../src/library/epubAssets';
test('EPUB paths work on project Pages and reject untrusted paths', () => {
  assert.equal(epubAssetUrl(READING_GUIDE.file, '/Sham-Perfume/'), '/Sham-Perfume/books/sham-reading-guide.epub');
  assert.equal(epubAssetUrl(READING_GUIDE.file, '/'), '/books/sham-reading-guide.epub');
  for (const path of ['https://example.com/book.epub', '../book.epub', 'books/../book.epub']) assert.throws(() => epubAssetUrl(path, '/'));
  assert.ok(existsSync(new URL(`../public/${READING_GUIDE.file}`, import.meta.url)));
});
