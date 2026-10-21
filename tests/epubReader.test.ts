import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { EpubReader, MAX_EPUB_BYTES, validEpubFile } from '../src/library/EpubReader';
import { LIBRARY_BOOKS } from '../src/library/catalog';

test('EPUB file validation rejects empty, oversized and unrelated files', () => {
  assert.ok(validEpubFile({ name: 'licensed.EPUB', size: 100 }));
  assert.ok(validEpubFile({ name: 'book.epub', size: MAX_EPUB_BYTES }));
  assert.equal(validEpubFile({ name: 'book.epub', size: 0 }), false);
  assert.equal(validEpubFile({ name: 'book.epub', size: MAX_EPUB_BYTES + 1 }), false);
  assert.equal(validEpubFile({ name: 'book.pdf', size: 100 }), false);
  assert.equal(validEpubFile({ name: 'book.epub.html', size: 100 }), false);
});
test('reader begins with an honest empty state and accessible local file controls', () => {
  const html = renderToStaticMarkup(React.createElement(EpubReader, { book: LIBRARY_BOOKS[0], currentLang: 'ar', onClose() {} }));
  assert.match(html, /<dialog/);
  assert.match(html, /aria-labelledby="epub-title"/);
  assert.ok(html.includes('لا يوجد ملف EPUB'));
  assert.match(html, /type="file"/);
  assert.match(html, /accept=".epub,application\/epub\+zip"/);
  assert.match(html, /disabled=""/);
  assert.ok(html.includes(LIBRARY_BOOKS[0].title));
});

test('published guide has a distinct immediate-reading state', () => {
  const html = renderToStaticMarkup(React.createElement(EpubReader, { book: { title: 'دليل القراءة' }, sourceUrl: '/books/sham-reading-guide.epub', currentLang: 'ar', onClose() {} }));
  assert.ok(html.includes('نسخة متاحة للقراءة المباشرة'));
  assert.ok(!html.includes('لا يوجد ملف EPUB مرفق'));
});

test('guide text is readable before EPUB finishes loading', () => {
  const html = renderToStaticMarkup(React.createElement(EpubReader, {
    book: { title: 'دليل' }, sourceUrl: '/books/sham-reading-guide.epub', currentLang: 'ar', onClose() {},
    fallbackText: { description: 'وصف أصلي', chapters: [{ title: 'فصل مقروء', paragraphs: ['نص احتياطي كامل'] }] },
  }));
  assert.match(html, /<article/);
  assert.ok(html.includes('نص احتياطي كامل'));
  assert.ok(html.includes('فصل مقروء'));
});
