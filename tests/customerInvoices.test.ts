import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { StoreInvoiceBreakdown } from '../src/components/StoreInvoiceBreakdown';
import { ProductCatalog } from '../src/components/ProductCatalog';
import { calculateMerchantPayout, calculatePlatformRevenue, calculateRetailPrice } from '../src/config/margin';
import { LEGAL_FINDINGS } from '../src/legal/legalExpert';
import { SUPPORTED_LANGUAGES } from '../src/types/i18n';
import { getProductById, saveMerchantProduct, type MerchantProductRecord } from '../src/utils/merchantDataStore';

const PRIVATE_BREAKDOWN = /هامش|ربح|عمول|تكلفة المورد|سعر الجملة|margin|markup|profit|commission|supplier cost|wholesale/i;
const catalogSource = readFileSync(new URL('../src/components/ProductCatalog.tsx', import.meta.url), 'utf8');

test('customer invoice markup contains no platform margin in any supported language', () => {
  for (const { code } of SUPPORTED_LANGUAGES) {
    const html = renderToStaticMarkup(createElement(StoreInvoiceBreakdown, {
      subtotal: 1000, shipping: 50, country: 'EG', currency: 'EGP', lang: code,
      money: (amount) => `${amount.toFixed(2)} EGP`,
    }));
    // Inspect the entire markup, not just visible text: CSS hiding is not sufficient.
    assert.doesNotMatch(html, PRIVATE_BREAKDOWN, code);
    assert.doesNotMatch(html, /25[-–]50%|25%|50%/, code);
    assert.match(html, /1000\.00 EGP/, code);
    assert.match(html, /50\.00 EGP/, code);
    assert.match(html, /140\.00 EGP/, code);
    assert.match(html, /1190\.00 EGP/, code);
  }
});

test('removing margin disclosure leaves invoice amounts, VAT and import estimates unchanged', () => {
  for (const [country, vat] of [['eg', 140], ['SA', 150], ['AE', 50], ['BH', 100], ['OM', 50],
    ['GB', 200], ['DE', 190], ['FR', 200], ['IT', 220], ['US', 0], ['CA', 0]] as const) {
    const amounts: number[] = [];
    const html = renderToStaticMarkup(createElement(StoreInvoiceBreakdown, {
      subtotal: 1000, shipping: 50, country, currency: 'EGP', lang: 'en',
      money: (amount) => { amounts.push(amount); return `${amount.toFixed(2)} EGP`; },
    }));
    assert.deepEqual(amounts, vat ? [1000, 50, vat, 1050 + vat] : [1000, 50, 1050], country);
    assert.match(html, /Items/);
    assert.match(html, /Shipping/);
    assert.match(html, /Est\. Total/);
    if (!vat) assert.match(html, /VAT\/customs at import \(estimated at customs\)/, country);
  }
});

test('customer invoices retain the estimate, actual-charge and official-invoice caveats', () => {
  const render = (lang?: 'ar' | 'en') => renderToStaticMarkup(createElement(StoreInvoiceBreakdown, {
    subtotal: 100, shipping: 20, country: 'EG', currency: 'EGP', money: String, lang,
  }));
  const arabic = render();
  assert.match(arabic, /dir="rtl"/);
  assert.match(arabic, /ليس فاتورة ضريبية أو مبلغاً محصّلاً/);
  assert.match(arabic, /مبلغ الدفع الفعلي يظهر في صفحة البوابة/);
  assert.match(arabic, /الفاتورة الرسمية عند وجوبها مسؤولية التاجر/);
  const english = render('en');
  assert.match(english, /dir="ltr"/);
  assert.match(english, /not a tax invoice or a collected amount/);
  assert.match(english, /gateway shows the actual charge/);
  assert.match(english, /merchant is responsible for any required official invoice/);
});

test('catalog price cards show the selling price, never the supplier cost or platform revenue', () => {
  const previousStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const data = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { data.set(key, String(value)); },
  } });
  try {
    const cost = 321.12;
    const product: MerchantProductRecord = {
      id: 'invoice-price-fixture', merchantId: 'invoice-merchant-fixture', sku: 'INVOICE-TEST',
      nameAr: 'عطر اختبار', nameEn: 'Invoice Test Perfume', category: 'fragrance', unit: 'bottle',
      costPrice: cost, retailPrice: calculateRetailPrice(cost), platformMargin: calculatePlatformRevenue(cost),
      costCurrency: 'EGP', stock: 3, minOrderQty: 1, descriptionAr: '', descriptionEn: '',
      isActive: true, approvalStatus: 'approved', notes: '', createdAt: '', updatedAt: '',
    };
    saveMerchantProduct(product);
    for (const { code } of SUPPORTED_LANGUAGES) {
      const html = renderToStaticMarkup(createElement(ProductCatalog, {
        onClose: () => {}, currentLang: code, retailerId: 'invoice-retailer-fixture',
      }));
      assert.match(html, /INVOICE-TEST/, 'the fixture product must actually be rendered');
      assert.match(html, /401\.4/, 'the original selling price remains displayed');
      assert.doesNotMatch(html, PRIVATE_BREAKDOWN, code);
      assert.doesNotMatch(html, /321\.12|80\.28/, 'no supplier cost or margin in text, attributes or hidden nodes');
    }
    // Rendering must not remove the values needed by bookkeeping.
    const stored = getProductById(product.id)!;
    assert.equal(stored.costPrice, 321.12);
    assert.equal(stored.platformMargin, 80.28);
    assert.equal(stored.retailPrice, 401.4);
    assert.equal(calculateMerchantPayout(cost), cost);
  } finally {
    if (previousStorage) Object.defineProperty(globalThis, 'localStorage', previousStorage);
    else Reflect.deleteProperty(globalThis, 'localStorage');
  }
});

test('every catalog view omits internal pricing fields while order accounting retains them', () => {
  // This also guards the interactive cart/success branches, which are not mounted during SSR.
  const viewStart = catalogSource.indexOf('  if (orderSuccess)');
  assert.ok(viewStart > 0);
  const view = catalogSource.slice(viewStart);
  assert.doesNotMatch(view, /costPrice|platformMargin|cartTotalCost|cartPlatformRevenue|subtotalCost|totalPlatformRevenue|PLATFORM_MARGIN_PERCENT/);
  assert.doesNotMatch(view, /product_card_cost_price|product_card_platform_revenue|cart_total_cost|cart_platform_revenue_total|margin_info/);
  assert.match(view, /item\.product\.retailPrice \* item\.qty/);
  assert.match(view, /formatLocalizedNumber\(currentLang, cartTotalRetail,/);

  const bookkeeping = catalogSource.slice(0, viewStart);
  assert.match(bookkeeping, /unitCostPrice: item\.product\.costPrice/);
  assert.match(bookkeeping, /unitPlatformMargin: item\.product\.platformMargin/);
  assert.match(bookkeeping, /totalPlatformRevenue: item\.product\.platformMargin \* item\.qty/);
  assert.match(bookkeeping, /subtotalCost: cartTotalCost/);
  assert.match(bookkeeping, /subtotalRetail: cartTotalRetail/);
  assert.match(bookkeeping, /totalPlatformRevenue: cartPlatformRevenue/);
  assert.match(bookkeeping, /incrementRetailerOrder\(retailerId, cartTotalRetail, cartPlatformRevenue\)/);
});

test('invoice audit guidance keeps margin accounting internal rather than recommending a margin line', () => {
  const finding = LEGAL_FINDINGS.find((item) => item.id === 'L-09')!;
  assert.ok(finding);
  assert.match(finding.solutionAr, /للحسابات الداخلية فقط، ولا تظهر في الفواتير/);
  assert.match(finding.solutionEn, /internal accounting only, never on invoices/);
  assert.match(finding.solutionEn, /applicable taxes\/fees and the total/);
  assert.doesNotMatch(finding.solutionAr, /مورد \+ هامش/);
  assert.doesNotMatch(finding.solutionEn, /supplier \+ margin/i);
});
