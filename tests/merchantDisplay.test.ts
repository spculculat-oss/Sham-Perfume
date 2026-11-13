import test from 'node:test';
import assert from 'node:assert/strict';
import {
  merchantCategoryLabel,
  merchantUnitLabel,
  normalizeMerchantCategory,
  normalizeMerchantUnit,
} from '../src/utils/merchantDisplay';

test('merchant product categories and units use the selected language', () => {
  assert.equal(merchantCategoryLabel('عطور', 'en'), 'Perfumes');
  assert.equal(merchantCategoryLabel('خامات', 'en'), 'Raw materials');
  assert.equal(merchantUnitLabel('زجاجة', 'en'), 'Bottle');
  assert.equal(merchantUnitLabel('لتر', 'en'), 'Litre');
});

test('legacy typos normalize to the intended perfume category and bottle unit', () => {
  assert.equal(normalizeMerchantCategory('ع스토랑'), 'عطور');
  assert.equal(normalizeMerchantUnit('زجةقة'), 'زجاجة');
  assert.equal(merchantCategoryLabel('ع스토랑', 'en'), 'Perfumes');
  assert.equal(merchantUnitLabel('زجةقة', 'en'), 'Bottle');
});

test('unknown category and unit values are preserved rather than hidden', () => {
  assert.equal(merchantCategoryLabel('custom category', 'en'), 'custom category');
  assert.equal(merchantUnitLabel('custom unit', 'en'), 'custom unit');
});
