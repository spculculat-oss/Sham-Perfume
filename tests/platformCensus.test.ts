import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BOTS, LINKS, botOf } from '../src/utils/shaheenOrg';
import { SHIFTS } from '../scripts/shaheen-patrol/shifts';
import { findRefuge } from '../src/utils/shaheenRefuge';
import { findBot, stateOrderableBots, stateReply } from '../src/utils/stateRoom';
import { readControls } from '../src/utils/ownerAuthority';
import { readStateOrders, readStateReport } from '../src/utils/platformState';
import { MemoryStore } from '../server/core/store';
import { createCensusService, isBotUserAgent } from '../server/census';
import {
  CENSUS_BOT,
  COUNTRY_COORDS,
  buildPublicStatement,
  csvStatement,
  emptyCensusReport,
  enrichCountries,
  mergeCensusReports,
  plainTextStatement,
  projectWorldPoint,
  readCensusReport,
  recordCensusVisit,
  sanitizeCensusSection,
  worldAtlasPoints,
} from '../src/utils/platformCensus';

test('census robot is registered inside Platform State leadership, refuge, patrol shifts, and StateRoom', () => {
  const bot = botOf('census');
  assert.ok(bot, 'census bot must exist in BOTS');
  assert.equal(bot.dept, 'leadership');
  assert.equal(bot.workflow, 'platform-census.yml');
  assert.equal(bot.report, 'platform-census.json');

  assert.ok(LINKS.some((l) => l.from === 'state' && l.to === 'census'), 'state delegates to census');
  assert.ok(LINKS.some((l) => l.from === 'census' && l.to === 'owner_desk'), 'census reports to owner_desk');
  assert.ok(SHIFTS.some((s) => s.bots.includes('census')), 'census assigned to a patrol shift');

  const hit = findRefuge('وين ألاقي خانة التعداد وخريطة العالم الحرارية؟');
  assert.ok(hit && (hit.entry.owner === 'census' || hit.entry.id.includes('census')));

  assert.ok(stateOrderableBots().some((b) => b.id === 'census'), 'Platform State can issue orders to census bot');
  const found = findBot('شغل روبوت التعداد دلوقتي');
  assert.equal(found.bot?.id, 'census');
});

test('committed platform-census.json starts honestly at 0 visits with zero fabricated numbers', () => {
  const raw = JSON.parse(readFileSync(new URL('../src/data/live/platform-census.json', import.meta.url), 'utf8'));
  const report = readCensusReport(raw);
  assert.equal(report.version, 1);
  assert.equal(report.totals.visits, 0);
  assert.equal(report.totals.uniqueVisitors, 0);
  assert.equal(report.byCountry.length, 0);

  const st = buildPublicStatement(report);
  assert.match(st.headlineAr, /0 زيارة/);
  assert.equal(st.ledger.length, 0);
});

test('recording visits, filtering admin routes, monotonic merging, heatmap projection, and open statement export', () => {
  assert.equal(sanitizeCensusSection('#admin'), undefined);
  assert.equal(sanitizeCensusSection('#owner'), undefined);
  assert.equal(sanitizeCensusSection('#ops'), undefined);
  assert.equal(sanitizeCensusSection('#store'), 'store');
  assert.equal(sanitizeCensusSection('#product=12'), 'product');

  const t1 = new Date('2026-10-23T10:00:00.000Z');
  let r = emptyCensusReport(t1.toISOString());

  // Admin route is ignored
  r = recordCensusVisit(r, { country: 'EG', section: '#admin', at: t1 });
  assert.equal(r.totals.visits, 0);

  // Real international visits across multiple continents
  r = recordCensusVisit(r, { country: 'EG', section: 'home', device: 'mobile', lang: 'ar', isUniqueToday: true, at: t1 });
  r = recordCensusVisit(r, { country: 'EG', section: 'store', device: 'mobile', lang: 'ar', isUniqueToday: false, at: t1 });
  r = recordCensusVisit(r, { country: 'SA', section: 'pyramid', device: 'desktop', lang: 'ar', isUniqueToday: true, at: t1 });
  r = recordCensusVisit(r, { country: 'DE', section: 'concentration', device: 'desktop', lang: 'de', isUniqueToday: true, at: t1 });
  r = recordCensusVisit(r, { country: 'JP', section: 'library', device: 'tablet', lang: 'ja', isUniqueToday: true, at: t1 });

  assert.equal(r.totals.visits, 5);
  assert.equal(r.totals.uniqueVisitors, 4);
  assert.equal(r.totals.todayVisits, 5);
  assert.equal(r.totals.countriesCount, 4);
  assert.equal(r.totals.regionsCount, 3); // arab (EG, SA), europe (DE), asia (JP)
  assert.equal(r.byRegion.arab.visits, 3);
  assert.equal(r.byDevice.mobile, 2);
  assert.equal(r.byDevice.desktop, 2);
  assert.equal(r.byDevice.tablet, 1);

  // Heatmap enrichment & projection bounds
  const enriched = enrichCountries(r, 'total');
  assert.equal(enriched[0]?.code, 'EG');
  assert.equal(enriched[0]?.visits, 2);
  assert.equal(enriched[0]?.sharePercent, 40);
  assert.notEqual(enriched[0]?.heatLevel, 'none');
  for (const [code, [lat, lon]] of Object.entries(COUNTRY_COORDS)) {
    const pt = projectWorldPoint(lat, lon, 1000, 500);
    assert.ok(pt.x >= 0 && pt.x <= 1000, `${code} x out of bounds: ${pt.x}`);
    assert.ok(pt.y >= 0 && pt.y <= 500, `${code} y out of bounds: ${pt.y}`);
  }
  const fullAtlas = worldAtlasPoints(r, 'total');
  assert.ok(fullAtlas.length >= 150, 'world atlas includes global countries');

  // Monotonic merge preserves historical maxima
  let other = emptyCensusReport(t1.toISOString());
  other = recordCensusVisit(other, { country: 'BR', section: 'store', device: 'mobile', lang: 'pt', isUniqueToday: true, at: t1 });
  const merged = mergeCensusReports(r, other, t1);
  assert.equal(merged.totals.countriesCount, 5);
  assert.equal(merged.totals.visits, 6);

  // Certified public statement & StateRoom reply
  const textAr = plainTextStatement(merged, 'ar', t1);
  assert.match(textAr, /الكشف العلني/);
  assert.match(textAr, /مصر/);
  assert.match(textAr, /البرازيل/);
  const csv = csvStatement(merged, t1);
  assert.match(csv, /"EG"/);
  assert.match(csv, /"BR"/);

  const reply = stateReply('عايز تقرير التعداد والكشف العلني للزيارات', {
    controls: readControls({}),
    orders: readStateOrders({}),
    report: readStateReport({}),
    census: merged,
  });
  assert.match(reply.text, /الكشف العلني/);
  assert.match(reply.text, /6 زيارة/);
});

test('server census service deduplicates daily unique visitors without storing IPs and filters bots', async () => {
  assert.equal(isBotUserAgent('Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'), true);
  assert.equal(isBotUserAgent('curl/8.4.0'), true);
  assert.equal(isBotUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15'), false);

  const store = new MemoryStore();
  const fixedNow = new Date('2026-10-23T14:30:00.000Z');
  const svc = createCensusService({ store, baseline: emptyCensusReport(fixedNow.toISOString()), now: () => fixedNow });

  // Bot UA is ignored
  const botRes = await svc.record({
    headers: { 'user-agent': 'Googlebot/2.1', 'x-vercel-ip-country': 'US' },
    ipKey: '203.0.113.10',
    body: { section: 'home' },
  });
  assert.equal(botRes.recorded, false);

  // Same visitor hits two pages: 2 visits, 1 unique visitor, IP never stored in DB
  const v1 = await svc.record({
    headers: { 'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X)', 'x-vercel-ip-country': 'EG' },
    ipKey: '198.51.100.42',
    body: { section: 'home', lang: 'ar' },
  });
  assert.equal(v1.recorded, true);
  assert.equal(v1.country, 'EG');

  const v2 = await svc.record({
    headers: { 'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X)', 'x-vercel-ip-country': 'EG' },
    ipKey: '198.51.100.42',
    body: { section: 'store', lang: 'ar' },
  });
  assert.equal(v2.report.totals.visits, 2);
  assert.equal(v2.report.totals.uniqueVisitors, 1);

  const rawSaved = JSON.stringify(await store.get('census', 'state'));
  assert.doesNotMatch(rawSaved, /198\.51\.100\.42/, 'visitor IP must never be persisted');
});

test('PlatformStatePanel, OwnerSuite, and AdminApp wire the census slot & world heatmap in administration', () => {
  const statePanel = readFileSync(new URL('../src/admin/PlatformStatePanel.tsx', import.meta.url), 'utf8');
  const ownerSuite = readFileSync(new URL('../src/admin/OwnerSuite.tsx', import.meta.url), 'utf8');
  const adminApp = readFileSync(new URL('../src/admin/AdminApp.tsx', import.meta.url), 'utf8');
  const censusPanel = readFileSync(new URL('../src/admin/PlatformCensusPanel.tsx', import.meta.url), 'utf8');

  assert.match(statePanel, /PlatformCensusPanel/);
  assert.match(ownerSuite, /PlatformCensusPanel/);
  assert.match(adminApp, /PlatformCensusPanel/);
  assert.match(censusPanel, /WorldVisitHeatmap/);
});

test('Operations Map page (#ops), OpsControlRoom, and ShaheenOpsMapPanel project the world thermal heatmap in the background', () => {
  const opsGate = readFileSync(new URL('../src/admin/OpsMapGate.tsx', import.meta.url), 'utf8');
  const opsPanel = readFileSync(new URL('../src/admin/ShaheenOpsMapPanel.tsx', import.meta.url), 'utf8');
  const opsRoom = readFileSync(new URL('../src/admin/OpsControlRoom.tsx', import.meta.url), 'utf8');
  const worldMap = readFileSync(new URL('../src/admin/WorldVisitHeatmap.tsx', import.meta.url), 'utf8');

  assert.match(worldMap, /export function WorldHeatmapSvgLayer/);
  assert.match(worldMap, /export function WorldHeatmapPageBackdrop/);
  assert.match(opsGate, /<WorldHeatmapPageBackdrop\s+report=\{censusReport\}\s*\/>/);
  assert.match(opsRoom, /<WorldHeatmapSvgLayer[\s\S]*?idPrefix="ocr-world-hm"/);
  assert.match(opsPanel, /<WorldHeatmapSvgLayer[\s\S]*?idPrefix="ops-map-hm"/);
  assert.match(opsPanel, /<PlatformCensusPanel\s+embedded\s*\/>/);
});

