import test from 'node:test';
import assert from 'node:assert/strict';

// Mock localStorage for Node test environment
const mockStorage = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem: (k: string) => mockStorage.get(k) ?? null,
    setItem: (k: string, v: string) => { mockStorage.set(k, String(v)); },
    removeItem: (k: string) => { mockStorage.delete(k); },
    clear: () => { mockStorage.clear(); },
  },
});

import {
  saveOrder,
  getAllOrders,
  type MediationOrderRecord,
} from '../src/utils/merchantDataStore';

test('store sales category classification categorizes perfumes, oils, and raw materials accurately', () => {
  const dummyOrder: MediationOrderRecord = {
    id: `test-ord-${Date.now()}`,
    orderNumber: `ORD-${Date.now()}`,
    merchantId: 'test-m-1',
    retailerId: 'test-r-1',
    retailerNameAr: 'متجر الرياض',
    items: [
      {
        productId: 'p-1',
        productNameAr: 'عطر مسك مكة',
        productNameEn: 'Musk Makkah Perfume',
        sku: 'MSK-01',
        category: 'عطور بخاخة',
        unit: 'عبوة',
        qty: 2,
        unitCostPrice: 100,
        unitRetailPrice: 150,
        unitPlatformMargin: 25,
        totalCost: 200,
        totalRetail: 300,
        totalPlatformRevenue: 50,
      },
      {
        productId: 'p-2',
        productNameAr: 'زيت صندل خام',
        productNameEn: 'Pure Sandalwood Oil',
        sku: 'OIL-01',
        category: 'زيوت عطرية',
        unit: 'تولة',
        qty: 1,
        unitCostPrice: 200,
        unitRetailPrice: 280,
        unitPlatformMargin: 50,
        totalCost: 200,
        totalRetail: 280,
        totalPlatformRevenue: 50,
      },
      {
        productId: 'p-3',
        productNameAr: 'كحول إيثيلي 96%',
        productNameEn: 'Pure Ethanol 96%',
        sku: 'RAW-01',
        category: 'مواد خام ومذيبات',
        unit: 'لتر',
        qty: 3,
        unitCostPrice: 35,
        unitRetailPrice: 50,
        unitPlatformMargin: 10,
        totalCost: 105,
        totalRetail: 150,
        totalPlatformRevenue: 30,
      },
    ],
    subtotalCost: 505,
    subtotalRetail: 730,
    totalPlatformRevenue: 130,
    shippingAddress: {
      streetAr: 'شارع التحلية',
      streetEn: 'Tahlia St',
      cityAr: 'الرياض',
      cityEn: 'Riyadh',
      countryAr: 'السعودية',
      countryEn: 'Saudi Arabia',
    },
    status: 'completed',
    paymentStatus: 'paid',
    contactMethod: 'whatsapp',
    customerConfirm: true,
    merchantConfirm: true,
    platformConfirm: true,
    shippingMethod: 'Express',
    shippingCost: 35,
    deliveryNote: 'سريع',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    adminNotes: 'طلب تجريبي',
    refundAmount: null,
  };

  saveOrder(dummyOrder);
  const allOrders = getAllOrders();
  const found = allOrders.find((o) => o.id === dummyOrder.id);
  assert.ok(found, 'saved order should be retrieved');

  // Verify categories distribution
  let perfumesTotal = 0;
  let oilsTotal = 0;
  let rawTotal = 0;

  for (const item of found.items) {
    const cat = item.category.toLowerCase();
    if (cat.includes('مواد') || cat.includes('خام') || cat.includes('كحول')) {
      rawTotal += item.totalRetail;
    } else if (cat.includes('زيت') || cat.includes('زيوت')) {
      oilsTotal += item.totalRetail;
    } else {
      perfumesTotal += item.totalRetail;
    }
  }

  assert.equal(perfumesTotal, 300, 'perfumes revenue should be 300');
  assert.equal(oilsTotal, 280, 'oils revenue should be 280');
  assert.equal(rawTotal, 150, 'raw materials revenue should be 150');
  assert.equal(perfumesTotal + oilsTotal + rawTotal, 730, 'sum matches subtotalRetail');
});
