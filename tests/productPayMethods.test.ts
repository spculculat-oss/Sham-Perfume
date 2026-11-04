/**
 * «وسائل الدفع» on a product: the research directory keeps both sides of a name («تقسيط البنوك / Bank
 * installments») so it stays citable, but the visitor reads one language only — Arabic in Arabic mode,
 * Latin otherwise. A brand name with no Arabic side («Apple Pay») keeps its own spelling everywhere.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { ProductPayMethods } from '../src/bank/ProductPayMethods';

const ARABIC = /[؀-ۿݐ-ݿࢠ-ࣿ]/;
const LATIN = /[A-Za-z]{3,}/;
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/g, ' ').replace(/\s+/g, ' ').trim();
const render = (lang: 'ar' | 'en', country: string) => text(renderToString(React.createElement(ProductPayMethods, { lang, country })));

test('the Arabic store shows payment methods in Arabic only — no «Bank installments» next to «تقسيط»', () => {
  const ar = render('ar', 'EG');
  assert.ok(ARABIC.test(ar), 'the Arabic panel lost its Arabic');
  assert.ok(ar.includes('تقسيط'), `the instalment method is missing: ${ar}`);
  assert.ok(!/Bank installments|Egyptian wallets|\bCards\b/.test(ar), `English left inside the Arabic panel: ${ar}`);
});

test('a non-Arabic store keeps the Latin side and never shows Arabic letters', () => {
  const en = render('en', 'EG');
  assert.ok(!ARABIC.test(en), `Arabic leaked into the English panel: ${en}`);
  assert.match(en, /Cards|installments/i);
});

test('a brand name with no Arabic side keeps its own spelling in both languages', () => {
  // «Apple Pay / Google Pay» has an Arabic rendering, «iDEAL / Wero» does not: neither loses its brands.
  const ar = render('ar', 'NL');
  const en = render('en', 'NL');
  // A brand-only method survives in both languages — the Arabic panel is not emptied of it.
  assert.ok(/iDEAL/.test(ar) && /iDEAL/.test(en), 'a brand-only method lost its name');
  // The two-sided pair reads in the visitor's own script: Arabic here, Latin in the English panel.
  assert.match(ar, /آبل باي/);
  assert.match(en, /Apple Pay/);
});
