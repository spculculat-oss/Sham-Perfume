import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MerchantKYCNotice } from '../src/components/MerchantKYCNotice';
import { SUPPORTED_LANGUAGES } from '../src/types/i18n';
import { money, resolveCommunityLanguage, timeAgo, tx } from '../src/community/ui';

test('community routes retain every supported platform language instead of collapsing to ar/en', () => {
  for (const { code } of SUPPORTED_LANGUAGES) {
    assert.equal(resolveCommunityLanguage(code), code, `${code} should remain available for locale-aware formatting`);
  }
  assert.equal(resolveCommunityLanguage('not-a-language'), 'en', 'unknown input safely falls back to English');
});

test('community copy has an explicit Arabic/English fallback while number and currency formatting use the retained locale', () => {
  assert.equal(tx('ar')('عربي', 'English'), 'عربي');
  assert.equal(tx('is')('عربي', 'English'), 'English');
  assert.equal(tx('ps')('عربي', 'English'), 'English');
  assert.match(money(1234.5, 'EUR', 'de'), /1\.234,50/);
  assert.match(timeAgo(new Date(Date.now() - 5 * 60_000).toISOString(), 'de'), /5m/);
});

test('the bilingual merchant verification notice uses the direction of the copy actually shown', () => {
  const arabic = renderToStaticMarkup(React.createElement(MerchantKYCNotice, { currentLang: 'ar' }));
  assert.match(arabic, /dir="rtl"/);
  const pashtoFallback = renderToStaticMarkup(React.createElement(MerchantKYCNotice, { currentLang: 'ps' }));
  assert.match(pashtoFallback, /dir="ltr"/);
  assert.ok(pashtoFallback.includes('Verification required before selling'));
});
