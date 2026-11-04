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
import { COUNTRY_POLYGON_MAP, WORLD_COUNTRY_POLYGONS } from '../src/data/worldCountryPolygons';
import { geoDetailsFromHeaders, resolveVisitorEntryLocation } from '../src/data/worldEntryGazetteer';
import {
  COUNTRY_COORDS,
  SITE_CREATED_AT,
  buildPublicStatement,
  countryPolygonStyle,
  csvStatement,
  dayPartBreakdown,
  emptyCensusReport,
  enrichCountries,
  enrichPlaces,
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
  assert.equal(report.siteCreatedAt, SITE_CREATED_AT);
  assert.equal(report.totals.visits, 0);
  assert.equal(report.totals.uniqueVisitors, 0);
  assert.equal(report.byCountry.length, 0);
  assert.equal(report.byPlace.length, 0);

  const st = buildPublicStatement(report);
  assert.match(st.headlineAr, /0 زيارة/);
  assert.equal(st.ledger.length, 0);
});

test('world country boundary dataset separates 182 countries with distinct thermal slot colors and valid bounding boxes', () => {
  assert.ok(WORLD_COUNTRY_POLYGONS.length >= 180, 'should contain 180+ real country polygons');
  for (const c of ['EG', 'SA', 'AE', 'US', 'DE', 'FR', 'GB', 'JP', 'BR', 'MA', 'KW', 'QA']) {
    const poly = COUNTRY_POLYGON_MAP.get(c);
    assert.ok(poly, `missing polygon for ${c}`);
    assert.ok(poly.d.startsWith('M'), `invalid SVG path for ${c}`);
    assert.ok(poly.slot >= 0 && poly.slot <= 7, `invalid color slot for ${c}`);
    assert.ok(poly.bbox[2] > poly.bbox[0] && poly.bbox[3] > poly.bbox[1], `invalid bbox for ${c}`);
  }
  // Neighboring Egypt, Sudan, Libya must have distinct base thermal separation slots
  const eg = COUNTRY_POLYGON_MAP.get('EG')!;
  const sd = COUNTRY_POLYGON_MAP.get('SD')!;
  const ly = COUNTRY_POLYGON_MAP.get('LY')!;
  assert.notEqual(eg.slot, sd.slot);
  assert.notEqual(eg.slot, ly.slot);

  const idleDark = countryPolygonStyle({ slot: eg.slot, intensity: 0, visits: 0, theme: 'dark' });
  const hotDark = countryPolygonStyle({ slot: eg.slot, intensity: 0.95, visits: 40, theme: 'dark' });
  assert.notEqual(idleDark.fill, hotDark.fill);
});

test('exact sub-country visitor entry gazetteer resolves edge coordinates, cities/governorates, and timezones', () => {
  // 1. Edge headers with exact Giza coordinates inside Egypt
  const gizaHeaders = geoDetailsFromHeaders({
    'x-vercel-ip-country-region': 'GZ',
    'x-vercel-ip-city': 'Giza',
    'x-vercel-ip-latitude': '30.0131',
    'x-vercel-ip-longitude': '31.2089',
  });
  const gizaLoc = resolveVisitorEntryLocation({
    country: 'EG',
    cityHeader: gizaHeaders.city,
    regionHeader: gizaHeaders.region,
    latHeader: gizaHeaders.lat,
    lonHeader: gizaHeaders.lon,
  });
  assert.equal(gizaLoc.country, 'EG');
  assert.equal(gizaLoc.cityAr, 'الجيزة');
  assert.equal(gizaLoc.precision, 'edge-coords');
  assert.ok(Math.abs(gizaLoc.lat - 30.01) < 0.05);

  // 2. City header without coordinates resolves to exact city coords in gazetteer
  const alexLoc = resolveVisitorEntryLocation({ country: 'EG', cityHeader: 'Alexandria' });
  assert.equal(alexLoc.cityAr, 'الإسكندرية');
  assert.equal(alexLoc.precision, 'edge-city');
  assert.ok(Math.abs(alexLoc.lat - 31.2) < 0.1);

  // 3. Timezone hint when no edge city header is present (e.g. client static fetch)
  const riyadhTz = resolveVisitorEntryLocation({ timezone: 'Asia/Riyadh' });
  assert.equal(riyadhTz.country, 'SA');
  assert.match(riyadhTz.cityAr, /الرياض/);
  assert.equal(riyadhTz.precision, 'timezone');
});

test('recording visits computes all 6 counters (all-time, monthly, weekly, daily, day-part, places) & exports open statement', () => {
  assert.equal(sanitizeCensusSection('#admin'), undefined);
  assert.equal(sanitizeCensusSection('#owner'), undefined);
  assert.equal(sanitizeCensusSection('#ops'), undefined);
  assert.equal(sanitizeCensusSection('#store'), 'store');
  assert.equal(sanitizeCensusSection('#product=12'), 'product');

  const dPrevMonth = new Date('2026-09-29T08:00:00.000Z'); // Cairo 11:00 (morning, Sept)
  const dEightDaysAgo = new Date('2026-10-16T12:00:00.000Z'); // Cairo 15:00 (afternoon, Oct, >7d ago)
  const dThreeDaysAgo = new Date('2026-10-23T18:00:00.000Z'); // Cairo 21:00 (evening, within 7d)
  const dTodayDawn = new Date('2026-10-26T01:00:00.000Z'); // Cairo 04:00 (dawn today)
  const dTodayEvening = new Date('2026-10-26T17:00:00.000Z'); // Cairo 20:00 (evening today)

  let r = emptyCensusReport(dTodayEvening.toISOString());

  // Admin route is ignored
  r = recordCensusVisit(r, { country: 'EG', section: '#admin', at: dTodayEvening });
  assert.equal(r.totals.visits, 0);

  // Record across months, weeks, days, day-parts, and sub-country cities
  r = recordCensusVisit(r, { country: 'DE', city: 'Berlin', section: 'concentration', device: 'desktop', lang: 'de', isUniqueToday: true, at: dPrevMonth });
  r = recordCensusVisit(r, { country: 'JP', city: 'Tokyo', section: 'library', device: 'tablet', lang: 'ja', isUniqueToday: true, at: dEightDaysAgo });
  r = recordCensusVisit(r, { country: 'SA', city: 'Jeddah', section: 'pyramid', device: 'desktop', lang: 'ar', isUniqueToday: true, at: dThreeDaysAgo });
  r = recordCensusVisit(r, { country: 'EG', city: 'Giza', region: 'GZ', lat: 30.0131, lon: 31.2089, section: 'home', device: 'mobile', lang: 'ar', isUniqueToday: true, at: dTodayDawn });
  r = recordCensusVisit(r, { country: 'EG', city: 'Alexandria', lat: 31.2001, lon: 29.9187, section: 'store', device: 'mobile', lang: 'ar', isUniqueToday: false, at: dTodayEvening });

  // Verify the counters:
  assert.equal(r.totals.visits, 5, 'Since creation counter = 5');
  assert.equal(r.totals.thisMonthVisits, 4, 'Monthly counter (2026-10) = 4');
  assert.equal(r.totals.last30DaysVisits, 5, 'Rolling 30d = 5');
  assert.equal(r.totals.last7DaysVisits, 3, 'Weekly counter (last 7d) = 3');
  assert.equal(r.totals.todayVisits, 2, 'Daily counter (2026-10-26) = 2');
  assert.equal(r.totals.placesCount, 5, '5 distinct city entry points');

  // Verify Day-Part breakdown (`عداد تقسيم اليوم`)
  const todaySplit = dayPartBreakdown(r, 'today');
  assert.equal(todaySplit.total, 2);
  assert.equal(todaySplit.parts.find((p) => p.id === 'dawn')?.visits, 1);
  assert.equal(todaySplit.parts.find((p) => p.id === 'evening')?.visits, 1);

  const allSplit = dayPartBreakdown(r, 'all');
  assert.equal(allSplit.total, 5);

  // Verify Sub-Country Places (`enrichPlaces`) & `recentEntries`
  const egPlaces = enrichPlaces(r, { country: 'EG' });
  assert.equal(egPlaces.length, 2);
  assert.ok(egPlaces.some((p) => p.cityAr === 'الجيزة'));
  assert.ok(egPlaces.some((p) => p.cityAr === 'الإسكندرية'));
  assert.equal(r.recentEntries.length, 5);
  assert.equal(r.recentEntries[0]?.cityAr, 'الإسكندرية');

  // Heatmap enrichment & projection bounds
  const enriched = enrichCountries(r, 'total');
  assert.equal(enriched[0]?.code, 'EG');
  assert.equal(enriched[0]?.visits, 2);
  for (const [code, [lat, lon]] of Object.entries(COUNTRY_COORDS)) {
    const pt = projectWorldPoint(lat, lon, 1000, 500);
    assert.ok(pt.x >= 0 && pt.x <= 1000, `${code} x out of bounds: ${pt.x}`);
    assert.ok(pt.y >= 0 && pt.y <= 500, `${code} y out of bounds: ${pt.y}`);
  }
  const fullAtlas = worldAtlasPoints(r, 'total');
  assert.ok(fullAtlas.length >= 150, 'world atlas includes global countries');

  // Monotonic merge preserves sub-country places, months, and hours
  let other = emptyCensusReport(dTodayEvening.toISOString());
  other = recordCensusVisit(other, { country: 'BR', city: 'Sao Paulo', section: 'store', device: 'mobile', lang: 'pt', isUniqueToday: true, at: dTodayEvening });
  const merged = mergeCensusReports(r, other, dTodayEvening);
  assert.equal(merged.totals.countriesCount, 5);
  assert.equal(merged.totals.visits, 6);
  assert.equal(merged.totals.placesCount, 6);

  // Certified public statement & StateRoom reply
  const textAr = plainTextStatement(merged, 'ar', dTodayEvening);
  assert.match(textAr, /الكشف العلني/);
  assert.match(textAr, /مصر/);
  assert.match(textAr, /البرازيل/);
  const csv = csvStatement(merged, dTodayEvening);
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

test('server census service tracks live real-time presence, handles heartbeats without inflating visits, and never stores raw IPs', async () => {
  assert.equal(isBotUserAgent('Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'), true);
  assert.equal(isBotUserAgent('curl/8.4.0'), true);
  assert.equal(isBotUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15'), false);

  const store = new MemoryStore();
  let clockMs = Date.parse('2026-10-26T14:30:00.000Z');
  const svc = createCensusService({
    store,
    baseline: emptyCensusReport(new Date(clockMs).toISOString()),
    now: () => new Date(clockMs),
  });

  // Bot UA is ignored
  const botRes = await svc.record({
    headers: { 'user-agent': 'Googlebot/2.1', 'x-vercel-ip-country': 'US' },
    ipKey: '203.0.113.10',
    body: { section: 'home' },
  });
  assert.equal(botRes.recorded, false);

  // Visitor 1 from Giza, Egypt
  const v1 = await svc.record({
    headers: {
      'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X)',
      'x-vercel-ip-country': 'EG',
      'x-vercel-ip-city': 'Giza',
      'x-vercel-ip-latitude': '30.0131',
      'x-vercel-ip-longitude': '31.2089',
    },
    ipKey: '198.51.100.42',
    body: { section: 'home', lang: 'ar', tz: 'Africa/Cairo' },
  });
  assert.equal(v1.recorded, true);
  assert.equal(v1.country, 'EG');
  assert.equal(v1.cityAr, 'الجيزة');
  assert.equal(v1.liveNow.activeVisitors, 1);
  assert.equal(v1.liveNow.last5mVisits, 1);

  // Visitor 2 from Riyadh, Saudi Arabia 20s later
  clockMs += 20_000;
  const v2 = await svc.record({
    headers: {
      'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
      'x-vercel-ip-country': 'SA',
      'x-vercel-ip-city': 'Riyadh',
    },
    ipKey: '198.51.100.99',
    body: { section: 'store', lang: 'ar', tz: 'Asia/Riyadh' },
  });
  assert.equal(v2.report.totals.visits, 2);
  assert.equal(v2.liveNow.activeVisitors, 2, '2 live active visitors online simultaneously');
  assert.equal(v2.liveNow.last5mVisits, 2);

  // Heartbeat 45s later keeps Visitor 1 alive WITHOUT increasing total visit count
  clockMs += 45_000;
  const hb = await svc.record({
    headers: {
      'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X)',
      'x-vercel-ip-country': 'EG',
      'x-vercel-ip-city': 'Giza',
    },
    ipKey: '198.51.100.42',
    body: { kind: 'heartbeat', section: 'home', lang: 'ar' },
  });
  assert.equal(hb.recorded, false);
  assert.equal(hb.report.totals.visits, 2, 'heartbeat must not inflate visit counter');
  assert.equal(hb.liveNow.activeVisitors, 2);

  // 90s later: Visitor 2 (>120s idle) drops off liveNow, Visitor 1 (90s since heartbeat) stays active
  clockMs += 90_000;
  const liveSnap = svc.liveNow();
  assert.equal(liveSnap.activeVisitors, 1);
  assert.equal(liveSnap.last5mVisits, 2);

  const rawSaved = JSON.stringify(await store.get('census', 'state'));
  assert.doesNotMatch(rawSaved, /198\.51\.100\.42/, 'visitor IP must never be persisted');
});

test('PlatformStatePanel, OwnerSuite, and AdminApp wire the census slot, 6 counters & colored world heatmap', () => {
  const statePanel = readFileSync(new URL('../src/admin/PlatformStatePanel.tsx', import.meta.url), 'utf8');
  const ownerSuite = readFileSync(new URL('../src/admin/OwnerSuite.tsx', import.meta.url), 'utf8');
  const adminApp = readFileSync(new URL('../src/admin/AdminApp.tsx', import.meta.url), 'utf8');
  const censusPanel = readFileSync(new URL('../src/admin/PlatformCensusPanel.tsx', import.meta.url), 'utf8');

  assert.match(statePanel, /PlatformCensusPanel/);
  assert.match(ownerSuite, /PlatformCensusPanel/);
  assert.match(adminApp, /PlatformCensusPanel/);
  assert.match(censusPanel, /WorldVisitHeatmap/);
  assert.match(censusPanel, /six-census-counters/);
});

test('Operations Map page (#ops), OpsControlRoom, and ShaheenOpsMapPanel project the colored world thermal heatmap', () => {
  const opsGate = readFileSync(new URL('../src/admin/OpsMapGate.tsx', import.meta.url), 'utf8');
  const opsPanel = readFileSync(new URL('../src/admin/ShaheenOpsMapPanel.tsx', import.meta.url), 'utf8');
  const opsRoom = readFileSync(new URL('../src/admin/OpsControlRoom.tsx', import.meta.url), 'utf8');
  const worldMap = readFileSync(new URL('../src/admin/WorldVisitHeatmap.tsx', import.meta.url), 'utf8');

  assert.match(worldMap, /export function WorldHeatmapSvgLayer/);
  assert.match(worldMap, /export function WorldHeatmapPageBackdrop/);
  assert.match(worldMap, /WORLD_COUNTRY_POLYGONS/);
  assert.match(opsGate, /<WorldHeatmapPageBackdrop\s+report=\{censusReport\}/);
  assert.match(opsRoom, /<WorldHeatmapSvgLayer[\s\S]*?idPrefix="ocr-world-hm"/);
  assert.match(opsPanel, /<WorldHeatmapSvgLayer[\s\S]*?idPrefix="ops-map-hm"/);
  assert.match(opsPanel, /<PlatformCensusPanel\s+embedded\s*\/>/);
});
