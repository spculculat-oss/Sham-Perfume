import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildAdminMerchantProductRecord,
  validateAdminMerchantProductDraft,
  type AdminMerchantProductDraft,
} from '../src/utils/adminMerchantProduct';

const validDraft = (): AdminMerchantProductDraft => ({
  nameAr: 'عطر عود',
  nameEn: 'Oud perfume',
  category: 'عطور',
  unit: 'زجاجة',
  costPrice: 100,
  stock: 8,
  minOrderQty: 2,
});

test('admin product creation requires both catalogue names and a positive wholesale price', () => {
  const draft = validDraft();
  assert.equal(validateAdminMerchantProductDraft({ ...draft, nameAr: ' ' }), 'product_names_required');
  assert.equal(validateAdminMerchantProductDraft({ ...draft, nameEn: '' }), 'product_names_required');
  assert.equal(validateAdminMerchantProductDraft({ ...draft, costPrice: 0 }), 'product_price_required');
  assert.equal(validateAdminMerchantProductDraft({ ...draft, costPrice: Number.NaN }), 'product_price_required');
  assert.equal(validateAdminMerchantProductDraft(draft), undefined);
});

test('admin product creation validates stock and minimum order as whole quantities', () => {
  const draft = validDraft();
  assert.equal(validateAdminMerchantProductDraft({ ...draft, stock: -1 }), 'product_inventory_invalid');
  assert.equal(validateAdminMerchantProductDraft({ ...draft, stock: 2.5 }), 'product_inventory_invalid');
  assert.equal(validateAdminMerchantProductDraft({ ...draft, minOrderQty: 0 }), 'product_inventory_invalid');
  assert.equal(validateAdminMerchantProductDraft({ ...draft, minOrderQty: 1.5 }), 'product_inventory_invalid');
});

test('created products preserve entered values, calculate platform pricing, and await approval', () => {
  const draft = validDraft();
  const product = buildAdminMerchantProductRecord('merchant-7', draft, { id: 'product-8', sku: 'SKU-8' });
  assert.equal(product.merchantId, 'merchant-7');
  assert.equal(product.id, 'product-8');
  assert.equal(product.sku, 'SKU-8');
  assert.equal(product.nameAr, 'عطر عود');
  assert.equal(product.nameEn, 'Oud perfume');
  assert.equal(product.category, 'عطور');
  assert.equal(product.unit, 'زجاجة');
  assert.equal(product.costPrice, 100);
  assert.equal(product.retailPrice, 125);
  assert.equal(product.platformMargin, 25);
  assert.equal(product.costCurrency, 'EGP');
  assert.equal(product.stock, 8);
  assert.equal(product.minOrderQty, 2);
  assert.equal(product.approvalStatus, 'pending');
  assert.equal(product.isActive, false);
});
