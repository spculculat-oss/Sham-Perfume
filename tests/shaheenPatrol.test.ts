/**
 * «الدورية بالتناوب»: each role has one monitoring shift; hands-on probes run only for that shift's scope.
 * Roles without workflows are monitored from existing records rather than automatically invoked. The patrol fixes
 * only approved work, escalates honestly to Shaheen, creates task forces for shared problems, and reviews completed runs.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { BOTS, botOf } from '../src/utils/shaheenOrg';
import type { BotCheck, PrecheckFile } from '../scripts/shaheen-council/precheck';
import {
  emptyPatrol, issueMarker, MAX_TRIES, parseShaheen, PATROL_RERUNNABLE, patrolIssue, probeCatalog, probeCurrency, probeFx, probeL10n, probeNewsFile,
  probePricing, REVIEWERS, reviewerOf, runPatrol, shouldPublish, TEAMS, type PatrolFile, type ProbeResult,
  SHIFTS, shiftAt, shiftOfBot, nextShiftAt, PROBES,
} from '../scripts/shaheen-patrol/patrol';
import { abs, liveProbes, probeImages, probeProductPages, sample } from '../scripts/shaheen-patrol/probes';

const NOW = Date.parse('2026-10-20T12:37:00Z');
const H = 3_600_000;
const iso = (t: number) => new Date(t).toISOString();

function precheck(bots: Partial<BotCheck>[], handoffs: PrecheckFile['handoffs'] = []): PrecheckFile {
  const list: BotCheck[] = BOTS.map((b) => ({ id: b.id, status: 'ok', problems: [], fixes: [], ideas: [], ...bots.find((x) => x.id === b.id) }));
  return { version: 1, updatedAt: iso(NOW), meetingAt: iso(NOW + 20 * H), health: 90, counts: { ok: list.length, warn: 0, fail: 0, idle: 0 }, summaryAr: '', bots: list, handoffs };
}
const ok = (id: ProbeResult['id']): ProbeResult => ({ id, level: 'ok', checked: 5, failed: 0, noteAr: 'سليم' });

test('hands-on tests: pricing rule +50%, catalogue integrity, one currency per country, fresh rates, languages, news', () => {
  assert.equal(probePricing([{ sku: 'A', supplierPrice: 100, ourPrice: 150 }, { sku: 'B', supplierPrice: 35, ourPrice: 52.5 }]).level, 'ok');
  const bad = probePricing([{ sku: 'A', supplierPrice: 100, ourPrice: 150 }, { sku: 'C', supplierPrice: 100, ourPrice: 120 }, { sku: 'D', supplierPrice: 10, ourPrice: 0 }]);
  assert.equal(bad.level, 'fail'); assert.equal(bad.failed, 2); assert.match(bad.samples!.join(' '), /C: 120 بدل 150/);

  const p = (sku: string, slug = sku.toLowerCase(), extra = {}) => ({ sku, slug, price: 100, name: { ar: 'عطر', en: 'Scent' }, imageUrl: 'x.jpg', ...extra });
  assert.equal(probeCatalog([p('A'), p('B')]).level, 'ok');
  assert.equal(probeCatalog([p('A'), p('B', 'b', { imageUrl: undefined })]).level, 'warn');
  assert.equal(probeCatalog([p('A'), p('A', 'a2')]).level, 'fail');
  assert.equal(probeCatalog([p('A', 'a', { price: 0 })]).level, 'fail');

  const rates = { SGD: 0.027, USD: 0.02 };
  assert.equal(probeCurrency(['SG', 'US'], (c) => (c === 'SG' ? 'SGD' : 'USD'), (c) => (c === 'SG' ? 'SGD' : 'USD'), rates).level, 'ok');
  const cur = probeCurrency(['SG', 'SA'], (c) => (c === 'SG' ? 'SGD' : 'SAR'), () => 'SGD', rates);
  assert.equal(cur.level, 'fail'); assert.deepEqual(cur.samples, ['SA: SAR ≠ SGD']);

  assert.equal(probeFx({ updatedAt: iso(NOW - 10 * H), rates: { USD: 1 } }, NOW).level, 'ok');
  assert.equal(probeFx({ updatedAt: iso(NOW - 40 * H), rates: { USD: 1 } }, NOW).level, 'warn');
  assert.equal(probeFx({ updatedAt: iso(NOW - 80 * H), rates: { USD: 1 } }, NOW).level, 'fail');
  assert.equal(probeFx(undefined, NOW).level, 'fail');
  assert.equal(probeL10n({ ar: 30, en: 30 }, 30).level, 'ok');
  assert.equal(probeL10n({ ar: 30, fr: 29 }, 30).level, 'fail');
  assert.equal(probeNewsFile({ updatedAt: iso(NOW - H), items: [1] }, NOW).level, 'ok');
  assert.equal(probeNewsFile({ updatedAt: iso(NOW - H), items: [] }, NOW).level, 'fail');
});

test('a late robot is fixed automatically (rerun), not twice within 6 h, and goes to Shaheen after the tries', () => {
  const late = precheck([{ id: 'seo', status: 'warn', problems: ['التقرير متأخر (15 ساعة، المفروض كل 6)'], lastRun: { conclusion: 'success', status: 'completed', at: iso(NOW - 15 * H) } }]);
  const first = runPatrol({ now: NOW, precheck: late, probes: [ok('site')], engineReady: false, shift: 'all' });
  assert.deepEqual(first.reruns, ['shaheen-seo.yml']);
  const item = first.file.open.find((i) => i.bot === 'seo')!;
  assert.equal(item.status, 'fixing'); assert.equal(item.tries.length, 1);
  assert.match(item.nextAr, /اتشغل تاني/);

  // An hour later, still late (the number changed — same problem): waits for the rerun, no new start.
  const again = precheck([{ id: 'seo', status: 'warn', problems: ['التقرير متأخر (16 ساعة، المفروض كل 6)'], lastRun: { conclusion: 'success', status: 'completed', at: iso(NOW - 15 * H) } }]);
  const second = runPatrol({ now: NOW + H, precheck: again, probes: [ok('site')], previous: first.file, engineReady: false, shift: 'all' });
  assert.deepEqual(second.reruns, []);
  assert.equal(second.file.open.find((i) => i.bot === 'seo')!.status, 'waiting_fix');

  // After the second try still broken → Shaheen. No AI engine: his playbook, the item waits honestly.
  const third = runPatrol({ now: NOW + 7 * H, precheck: again, probes: [ok('site')], previous: second.file, engineReady: false, shift: 'all' });
  assert.deepEqual(third.reruns, ['shaheen-seo.yml']);
  const fourth = runPatrol({ now: NOW + 14 * H, precheck: again, probes: [ok('site')], previous: third.file, engineReady: false, shift: 'all' });
  const stuck = fourth.file.open.find((i) => i.bot === 'seo')!;
  assert.equal(stuck.tries.length, MAX_TRIES);
  assert.deepEqual(fourth.reruns, []);
  assert.equal(stuck.status, 'waiting_shaheen');
  assert.equal(stuck.shaheen?.by, 'playbook');
  assert.match(stuck.nextAr, /مش هنعمل إصلاح وهمي/);
  assert.deepEqual(fourth.ask, [], 'no engine → nobody is asked');
  // With an engine, Shaheen is asked (once a day per problem).
  const withAi = runPatrol({ now: NOW + 15 * H, precheck: again, probes: [ok('site')], previous: fourth.file, engineReady: true, shift: 'all' });
  assert.equal(withAi.ask.length, 1);
  assert.equal(withAi.file.open.find((i) => i.bot === 'seo')!.status, 'waiting_shaheen', '«عند شاهين» only once he really answered');

  // Fixed: it disappears and is logged as resolved after the rerun, verified by this patrol's tests.
  const fixed = runPatrol({ now: NOW + 16 * H, precheck: precheck([]), probes: [ok('site')], previous: fourth.file, engineReady: false, shift: 'all' });
  assert.equal(fixed.file.open.length, 0);
  assert.match(fixed.file.resolved[0].howAr, /اتصلح بعد إعادة تشغيل shaheen-seo.yml/);
});

test('reruns are limited: at most 3 robots per patrol, only safe robots, and never for the owner\'s decisions', () => {
  const failing = precheck(['scout', 'importer', 'news', 'seo', 'languages'].map((id) => ({ id: id as BotCheck['id'], status: 'fail' as const, problems: ['آخر تشغيل فشل'] })));
  const plan = runPatrol({ now: NOW, precheck: failing, probes: [], engineReady: false, shift: 'all' });
  assert.equal(plan.reruns.length, 3);
  for (const w of plan.reruns) assert.ok((PATROL_RERUNNABLE as readonly string[]).includes(w));
  assert.equal(plan.file.open.filter((i) => i.status === 'waiting_fix').length, 2);
  // A robot that is not safe to rerun (the finance robot) goes straight to Shaheen.
  const fin = runPatrol({ now: NOW, precheck: precheck([{ id: 'council', status: 'fail', problems: ['آخر تشغيل فشل'] }]), probes: [], engineReady: false, shift: 'all' });
  assert.deepEqual(fin.reruns, []);
  assert.equal(fin.file.open[0].status, 'waiting_shaheen');
  // Payment methods / AI credit: the owner's decision — no rerun, no Shaheen, no task.
  const owner = runPatrol({ now: NOW, precheck: precheck([{ id: 'keys', status: 'warn', problems: ['محركات متوقفة مؤقتاً: openai'] }]), probes: [{ id: 'payments', level: 'warn', checked: 1, failed: 1, owner: true, noteAr: 'مفيش طريقة دفع' }], engineReady: true, shift: 'all' });
  assert.deepEqual(owner.reruns, []); assert.deepEqual(owner.ask, []); assert.deepEqual(owner.tasks, []);
  assert.ok(owner.file.open.every((i) => i.status === 'owner'));
});

test('a problem across several tools gets a task force, each tool with its own part', () => {
  const plan = runPatrol({ now: NOW, precheck: precheck([]), probes: [{ id: 'images', level: 'fail', checked: 12, failed: 5, noteAr: '5 من 12 صورة مش بتفتح', samples: ['LAT-1: 404'] }], engineReady: false, shift: 'all' });
  const item = plan.file.open[0];
  assert.deepEqual(item.team!.map((p) => p.bot), ['images', 'importer', 'product_pages']);
  assert.ok(item.team!.every((p) => p.roleAr.length > 5));
  assert.deepEqual(plan.reruns, ['shaheen-import.yml']);
  assert.equal(plan.file.teams.length, 1);
  for (const parts of Object.values(TEAMS)) for (const p of parts) assert.ok(botOf(p.bot), p.bot);
  // From the pre-check's help requests too.
  const h = runPatrol({ now: NOW, precheck: precheck([{ id: 'design_audit', status: 'warn', problems: ['تقييم التصميم 60/100'] }], [{ from: 'design_audit', to: 'languages', textAr: 'ملاحظات ترجمة' }]), probes: [], engineReady: false, shift: 'all' });
  assert.deepEqual(h.file.open[0].team!.map((p) => p.bot), ['design_audit', 'languages']);
});

test('every finished run is tested by an expert reviewer of the same scope — once — and rejected on defects', () => {
  const run = { conclusion: 'success', status: 'completed', at: iso(NOW - 0.5 * H) };
  const pc = precheck([{ id: 'importer', lastRun: run }, { id: 'news', lastRun: run }]);
  const probes: ProbeResult[] = [ok('pricing'), ok('catalog'), ok('fx'), { id: 'images', level: 'fail', checked: 40, failed: 12, noteAr: '12 من 40 صورة مش بتفتح', deep: true }, ok('product_pages'), ok('news_file'), ok('news_api')];
  const plan = runPatrol({ now: NOW, precheck: pc, probes, engineReady: false, shift: 'all' });
  const importer = plan.file.reviews.find((r) => r.bot === 'importer')!;
  assert.equal(importer.reviewerAr, REVIEWERS.importer!.nameAr);
  assert.equal(importer.verdict, 'rejected');
  assert.ok(importer.tested.some((t) => t.deep));
  assert.equal(plan.file.reviews.find((r) => r.bot === 'news')!.verdict, 'approved');
  assert.deepEqual(plan.file.open.find((i) => i.probe === 'images')!.rejectedBy, ['importer']);
  // The same run is not reviewed again next hour.
  const next = runPatrol({ now: NOW + H, precheck: pc, probes, previous: plan.file, engineReady: false, shift: 'all' });
  assert.equal(next.file.reviews.filter((r) => r.bot === 'importer').length, 1);
  // Every bot with a robot has a reviewer; every reviewer test is a known probe.
  for (const b of BOTS) if (b.workflow) assert.ok(reviewerOf(b.id).nameAr.startsWith('خبير فحص'), b.id);
});

test('what stays broken becomes a development task (deduplicated by a marker) — and Shaheen\'s answer is checked', () => {
  const pc = precheck([]);
  const broken: ProbeResult = { id: 'pricing', level: 'fail', checked: 100, failed: 2, noteAr: '2 منتج سعره مخالف' };
  const first = runPatrol({ now: NOW, precheck: pc, probes: [broken], engineReady: false, shift: 'all' });
  assert.deepEqual(first.tasks, [], 'not a task in the first hours');
  const later = runPatrol({ now: NOW + 7 * H, precheck: pc, probes: [broken], previous: first.file, engineReady: false, shift: 'all' });
  assert.equal(later.tasks.length, 1);
  const issue = patrolIssue(later.tasks[0]);
  assert.ok(issue.body.startsWith(issueMarker('probe:pricing')));
  assert.deepEqual(issue.labels, ['shaheen-task', 'shaheen-patrol', 'priority-high']);
  assert.match(issue.body, /Closes #/);

  const at = iso(NOW);
  assert.equal(parseShaheen({ diagnosisAr: 'x' }, at), undefined);
  const a = parseShaheen({ diagnosisAr: 'السبب كذا https://evil.example', stepsAr: ['خطوة'], needsCode: false, rerun: 'shaheen-finance.yml' }, at)!;
  assert.equal(a.rerun, undefined, 'only safe robots');
  assert.doesNotMatch(a.diagnosisAr, /https?:/);
  assert.equal(parseShaheen({ diagnosisAr: 'د', stepsAr: ['خ'], rerun: 'pages.yml' }, at)!.rerun, 'pages.yml');
});

test('the log is published on change or every 3 hours — not a commit every hour', () => {
  const pc = precheck([]);
  const a = runPatrol({ now: NOW, precheck: pc, probes: [ok('site')], engineReady: false, shift: 'all' }).file;
  assert.equal(shouldPublish(a, undefined, NOW), true);
  const published: PatrolFile = { ...a, publishedAt: iso(NOW) };
  const b = runPatrol({ now: NOW + H, precheck: pc, probes: [ok('site')], previous: published, engineReady: false, shift: 'all' }).file;
  assert.equal(b.signature, a.signature);
  assert.equal(shouldPublish(b, published, NOW + H), false);
  assert.equal(shouldPublish(b, published, NOW + 3 * H), true);
  const c = runPatrol({ now: NOW + H, precheck: pc, probes: [{ ...ok('site'), level: 'fail' }], previous: published, engineReady: false, shift: 'all' }).file;
  assert.equal(shouldPublish(c, published, NOW + H), true);
  assert.equal(runPatrol({ now: NOW, precheck: pc, probes: [], previous: emptyPatrol(), engineReady: false, shift: 'all' }).file.version, 1);
});

test('live tests open real pages like a visitor (fake network): price matches the catalogue, photos open', async () => {
  const pages = 'https://example.test/site/';
  const products = [{ sku: 'A', slug: 'a', price: 150, images: ['https://img.test/a.jpg'] }, { sku: 'B', slug: 'b', price: 90, images: ['photos/b.jpg'] }];
  const request = (async (input: string | URL | Request) => {
    const url = String(input);
    const html = (body: string, status = 200) => new Response(body, { status, headers: { 'content-type': 'text/html' } });
    if (url === pages) return html('<div id="root"></div><script type="module" src="/site/assets/index-1.js"></script>');
    if (url === 'https://example.test/site/assets/index-1.js') return new Response('', { status: 200 });
    if (url.endsWith('p/money.json')) return new Response(JSON.stringify({ rates: { EGP: 1 } }), { status: 200 });
    if (url.endsWith('p/a.html')) return html('<p class="price" data-price="150">150</p>');
    if (url.endsWith('p/b.html')) return html('<p class="price" data-price="80">80</p>');
    if (url === 'https://img.test/a.jpg') return new Response('x', { status: 206, headers: { 'content-type': 'image/jpeg' } });
    if (url === 'https://example.test/site/photos/b.jpg') return new Response('nope', { status: 404, headers: { 'content-type': 'text/html' } });
    if (url.endsWith('sitemap.xml')) return new Response('<loc>https://example.test/site/p/a.html</loc><loc>https://example.test/site/p/b.html</loc>', { status: 200 });
    if (url.endsWith('api/health')) return new Response(JSON.stringify({ status: 'ok' }), { status: 200 });
    if (url.endsWith('api/news')) return new Response(JSON.stringify({ articles: [1, 2] }), { status: 200 });
    if (url.includes('api/store/payments')) return new Response(JSON.stringify({ methods: [], direct: [] }), { status: 200 });
    return new Response('', { status: 404 });
  }) as typeof fetch;
  const t = { pages, engine: 'https://engine.test/', products, hour: 0, request };
  const pp = await probeProductPages(t);
  assert.equal(pp.level, 'warn'); assert.match(pp.noteAr, /سعرها لسه القديم/);
  const img = await probeImages(t);
  assert.equal(img.failed, 1); assert.deepEqual(img.samples, ['B: 404']);
  const all = await liveProbes(t);
  const by = Object.fromEntries(all.map((r) => [r.id, r]));
  assert.equal(by.site.level, 'ok'); assert.equal(by.sitemap.level, 'ok'); assert.equal(by.engine.level, 'ok'); assert.equal(by.news_api.level, 'ok');
  assert.equal(by.payments.owner, true);
  // A dead network is a failed test, never an exception.
  const dead = await liveProbes({ ...t, request: (async () => { throw new TypeError('fetch failed'); }) as typeof fetch });
  assert.ok(dead.every((r) => r.level === 'fail'));
  assert.deepEqual(sample([1, 2, 3, 4, 5], 2, 1), [3, 4]);
  // The main site lives in a folder: «/Sham-Perfume/assets/x.js» from the origin, «photos/x.jpg» from the folder.
  const site = 'https://spculculat-oss.github.io/Sham-Perfume/';
  assert.equal(abs(site, '/Sham-Perfume/assets/index.js'), 'https://spculculat-oss.github.io/Sham-Perfume/assets/index.js');
  assert.equal(abs(site, 'photos/a.jpg'), 'https://spculculat-oss.github.io/Sham-Perfume/photos/a.jpg');
  assert.equal(abs(site, './p/money.json'), 'https://spculculat-oss.github.io/Sham-Perfume/p/money.json');
});

test('rotating shifts: one group per hour, every role and probe assigned once; advisory roles are monitored, not invoked', () => {
  const all = SHIFTS.flatMap((x) => x.bots);
  assert.equal(new Set(all).size, all.length, 'a role in two shifts');
  assert.deepEqual([...all].sort(), BOTS.map((b) => b.id).sort(), 'every role has a monitoring shift');
  assert.equal(botOf('design_expert')?.workflow, undefined, 'the design specialist is not an automatically run workflow');
  assert.equal(shiftOfBot('design_expert'), 1, 'its supervisor-recorded health belongs to the content/design shift');
  const tests = SHIFTS.flatMap((x) => x.probes);
  assert.deepEqual([...tests].sort(), Object.keys(PROBES).sort());
  for (const x of SHIFTS) assert.ok(x.bots.length <= 17 && x.probes.length <= 7, x.nameEn);
  // Consecutive hours → consecutive shifts; the same shift comes back after 3 hours, also across midnight.
  const h0 = Date.parse('2026-10-20T22:52:00Z');
  const seq = [0, 1, 2, 3, 4, 5].map((i) => shiftAt(h0 + i * H));
  assert.deepEqual(seq.slice(3), seq.slice(0, 3));
  assert.equal(new Set(seq.slice(0, 3)).size, 3);
  assert.equal(Date.parse(nextShiftAt(shiftAt(h0), h0)) - Math.floor(h0 / H) * H, 3 * H);

  // A shift checks only its own tools: another shift's problem waits untouched (not resolved, not rerun).
  const seoShift = shiftOfBot('seo'); const storeShift = shiftOfBot('importer');
  assert.notEqual(seoShift, storeShift);
  const t0 = h0 + ((seoShift - shiftAt(h0) + 3) % 3) * H;
  const late = precheck([{ id: 'seo', status: 'warn', problems: ['التقرير متأخر (15 ساعة، المفروض كل 6)'] }, { id: 'importer', status: 'fail', problems: ['آخر تشغيل فشل'] }]);
  const a = runPatrol({ now: t0, precheck: late, probes: [], engineReady: false });
  assert.equal(a.file.shift?.index, seoShift);
  assert.deepEqual(a.file.open.map((i) => i.bot), ['seo'], 'the importer waits for its own shift');
  assert.deepEqual(a.reruns, ['shaheen-seo.yml']);
  const next = t0 + ((storeShift - seoShift + 3) % 3) * H;
  const b = runPatrol({ now: next, precheck: late, probes: [], previous: a.file, engineReady: false });
  assert.equal(b.file.shift?.index, storeShift);
  assert.deepEqual(b.file.open.map((i) => i.bot).sort(), ['importer', 'seo']);
  assert.equal(b.file.open.find((i) => i.bot === 'seo')!.tries.length, 1, 'the seo item is carried, not retried');
  assert.equal(b.file.resolved.length, 0, 'not checked ≠ fixed');
  assert.deepEqual(b.reruns, ['shaheen-import.yml']);
  // The other shifts' last test results stay visible.
  const c = runPatrol({ now: next + 3 * H, precheck: late, probes: [ok('pricing')], previous: { ...b.file, probes: [{ ...ok('site'), at: iso(t0) }] }, engineReady: false });
  assert.deepEqual(c.file.probes.map((p) => p.id), ['pricing', 'site']);
});

test('the patrol robot is in the structure, runs hourly, pinned, and starts only safe robots', () => {
  const bot = botOf('patrol')!;
  assert.equal(bot.workflow, 'shaheen-patrol.yml');
  assert.equal(bot.report, 'shaheen-patrol.json');
  const wf = readFileSync(new URL('../.github/workflows/shaheen-patrol.yml', import.meta.url), 'utf8');
  assert.match(wf, /cron: '52 \* \* \* \*'/);
  assert.match(wf, /PATROL_SHIFT/);
  assert.match(wf, /actions: write/);
  for (const line of wf.split('\n').filter((l) => /uses:/.test(l))) assert.match(line, /@[0-9a-f]{40} #/);
  assert.doesNotMatch(wf, /toJSON\(secrets\)/);
  const allowed = wf.match(/^\s+(shaheen-import\.yml\|[^)]+)\)/m)![1].split('|').sort();
  assert.deepEqual(allowed, [...PATROL_RERUNNABLE].sort());
});
