import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from '../src/types/i18n';
import { SEO_PAGES } from '../src/seo/pages';
import { TopPromoHub } from '../src/components/TopPromoHub';
import { localizedPlatformPromos, PLATFORM_PROMOS } from '../src/utils/platformPromos';

const src = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

const homeHub = src('../src/components/HomeHub.tsx');
const app = src('../src/App.tsx');
const communityApp = src('../src/community/CommunityApp.tsx');
const moleculeStudio = src('../src/components/MoleculeStudio.tsx');
const banner = src('../src/components/TopPromoHub.tsx');

test('cinematic page ads cover every indexable page and use its exact app tab and SEO URL', () => {
  const byId = new Map(PLATFORM_PROMOS.map((promo) => [promo.id, promo]));
  assert.equal(byId.size, PLATFORM_PROMOS.length, 'promo IDs must be unique');

  for (const page of SEO_PAGES) {
    const promo = byId.get(page.id);
    assert.ok(promo, `missing promo for SEO page ${page.id}`);
    assert.equal(promo.tab, page.tab, `${page.id} must navigate to its registered app tab`);
    assert.equal(promo.path, page.path, `${page.id} must retain its canonical static page path`);
    assert.deepEqual(promo.action, { type: 'tab', tab: page.tab });
  }

  const home = byId.get('home');
  assert.ok(home, 'the main hub needs its own promotion');
  assert.equal(home.tab, 'home');
});

test('every HomeHub portal and every top-level App page has a matching promotion', () => {
  const promoTabs = new Set(PLATFORM_PROMOS.map((promo) => promo.tab));
  const hubTabs = [...homeHub.matchAll(/targetTab:\s*'([^']+)'/g)].map((match) => match[1]);
  assert.ok(hubTabs.length >= 12, 'the portal navigation inventory should be read from HomeHub');
  for (const tab of hubTabs) assert.ok(promoTabs.has(tab), `HomeHub portal target ${tab} has no promo`);

  const appTabs = new Set([...app.matchAll(/activeTab === '([^']+)'/g)].map((match) => match[1]));
  appTabs.delete('productDetail'); // individual product pages are promoted by the existing per-product carousel.
  for (const tab of appTabs) assert.ok(promoTabs.has(tab), `App page ${tab} has no promo`);
});

test('all community navigation sections and settings-modal portals have the correct action', () => {
  const promoByTab = new Map(PLATFORM_PROMOS.map((promo) => [promo.tab, promo]));
  const navStart = communityApp.indexOf('const tabs:');
  const navEnd = communityApp.indexOf('];', navStart);
  assert.ok(navStart >= 0 && navEnd > navStart, 'CommunityApp primary navigation was found');
  const communityTabs = [...communityApp.slice(navStart, navEnd).matchAll(/\{ id: '([^']+)'/g)].map((match) => match[1]);
  assert.ok(communityTabs.length >= 8, 'the community navigation inventory should include its actual tabs');
  for (const tab of communityTabs) {
    const route = tab === 'social' ? 'community' : `community/${tab}`;
    assert.equal(promoByTab.get(route)?.action.type, 'tab', `community route ${route} must be advertised and navigable`);
  }
  assert.ok(communityApp.includes("onClick={() => go('stores')}"), 'the merchants’ market entry is in CommunityApp');
  assert.deepEqual(promoByTab.get('community/stores')?.action, { type: 'tab', tab: 'community/stores' });

  assert.deepEqual(promoByTab.get('country_modal')?.action, { type: 'environment-modal' });
  assert.deepEqual(promoByTab.get('privacy_modal')?.action, { type: 'privacy-modal' });
  assert.match(app, /onNavigateToTab=\{\(tab\) => navigateToTab\(tab\)\}/);
  assert.match(app, /onOpenEnvironmentModal=\{handleOpenEnvironmentModal\}/);
  assert.match(app, /onOpenPrivacyModal=\{handleOpenPrivacyModal\}/);
  assert.match(banner, /onClick=\{\(\) => openPlatformPromo\(activePromo\)\}/);
});

test('the cinematic reel exposes every page ad in its language-specific accessible navigation', () => {
  const esc = (value: string) => value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#x27;');

  for (const code of ['ar', 'en', 'fr', 'ja'] as SupportedLanguage[]) {
    const html = renderToString(React.createElement(TopPromoHub, { currentLang: code }));
    for (const promo of localizedPlatformPromos(code)) {
      assert.ok(html.includes(esc(promo.title)), `<${code}> reel navigation omitted ${promo.id}`);
    }
  }
});

test('product-detail destinations remain linked to their own catalogue entry', () => {
  assert.match(banner, /handleProductClick\(activeProduct\.id\)/);
  assert.match(banner, /window\.location\.hash = `#product=\$\{productId\}`/);
  assert.ok(app.includes('hash.match(/^product=(\\d+)$/)'));
  assert.ok(app.includes("activeTab === 'productDetail'"));
});

test('the molecule-studio promotion leads to the integrated composition, ratio-analysis, and preparation planner', () => {
  const promo = PLATFORM_PROMOS.find((item) => item.tab === 'molecule_studio');
  assert.ok(promo, 'molecule studio has a page ad');
  assert.deepEqual(promo.action, { type: 'tab', tab: 'molecule_studio' });
  assert.ok(homeHub.includes("onNavigate('molecule_studio')"), 'the hub exposes the composition studio');
  assert.ok(app.includes("activeTab === 'molecule_studio' && ("));
  assert.ok(app.includes('<MoleculeStudio'));

  for (const section of ["'compose'", "'analyze'", "'schedule'", "'references'"]) {
    assert.ok(moleculeStudio.includes(section), `molecule studio lost its ${section} section`);
  }
  for (const capability of ['percentageOfOil', 'analyzePyramidNotes', 'parsePerfumeIngredientList', 'calculateIngredientMassGrams', 'MacerationTimeSimulator', 'macerationStartDate', 'setMacerationDays']) {
    assert.ok(moleculeStudio.includes(capability), `molecule studio lost ${capability}`);
  }
});

test('platform promotions stay localized in every currently supported language', () => {
  assert.equal(localizedPlatformPromos('ar').length, PLATFORM_PROMOS.length);
  const arabicScriptHome = new Set<SupportedLanguage>(['ar', 'fa', 'ur', 'ps', 'sd']);
  const arabic = /[؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿]/;

  for (const { code } of SUPPORTED_LANGUAGES) {
    const promos = localizedPlatformPromos(code);
    assert.equal(promos.length, PLATFORM_PROMOS.length, `<${code}> lost a promo`);
    for (const promo of promos) {
      for (const field of [promo.tag, promo.title, promo.description]) {
        assert.ok(field.trim(), `<${code}:${promo.id}> has empty promo copy`);
        if (!arabicScriptHome.has(code)) assert.ok(!arabic.test(field), `<${code}:${promo.id}> leaked Arabic: ${field}`);
      }
    }
  }
});
