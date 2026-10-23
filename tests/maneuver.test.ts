import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import {
  CHAT_SECTION, fieldSections, maneuverSummaryAr, mergeFindings, pageFindings, readManeuverReport, sectionHash, sectionStatus,
  type ManeuverReport, type PageProbe,
} from '../src/utils/maneuver';
import { MANEUVER_DRILLS, brainReply, gradeTurn, liveDrillsFor, runBrainDrills } from '../src/utils/maneuverDrills';
import { fieldAction, fieldMarker, fieldTask, fileField, stateSector } from '../src/utils/stateSectors';
import { readStateReport, STATE_LIMITS } from '../src/utils/platformState';
import { BOTS, LINKS } from '../src/utils/shaheenOrg';
import { SCHEDULES } from '../src/utils/opsLive';
import { mergeCatalog, type RawProduct } from '../src/utils/storeCatalog';
import productsData from '../src/data/products.json';

const products = mergeCatalog(((productsData as { products?: RawProduct[] }).products) || []);
const probe = (over: Partial<PageProbe> = {}): PageProbe => ({
  section: 'store', url: 'https://example.test/#store', ok: true, loadMs: 1800, pageErrors: [], consoleErrors: [], failed: [],
  textLength: 2400, rawText: [], overflowPx: 0, brokenImages: 0, imagesNoAlt: 0, unnamedButtons: 0, headings: 2, ...over,
});

test('the maneuver is a registered robot that works for the State', () => {
  const bot = BOTS.find((b) => b.id === 'maneuver');
  assert.ok(bot);
  assert.equal(bot.dept, 'leadership');
  assert.equal(bot.workflow, 'shaheen-maneuver.yml');
  assert.equal(bot.report, 'shaheen-maneuver.json');
  assert.ok(existsSync('.github/workflows/shaheen-maneuver.yml'));
  assert.ok(SCHEDULES['shaheen-maneuver.yml']?.length);
  assert.ok(LINKS.some((l) => l.from === 'maneuver' && l.to === 'state'));
  assert.match(readFileSync('.github/workflows/owner-control.yml', 'utf8'), /- maneuver\n/);
  const wf = readFileSync('.github/workflows/shaheen-maneuver.yml', 'utf8');
  assert.match(wf, /gate\.mjs maneuver/);
  assert.match(wf, /MANEUVER_ACT: \$\{\{ github\.ref == 'refs\/heads\/main'/);
  assert.doesNotMatch(wf, /toJSON\(secrets\)/);
  for (const uses of wf.match(/uses: \S+/g) || []) assert.match(uses, /@[0-9a-f]{40}$/, uses);
});

test('every public section is walked — never the admin panel; the product page opens a real product', () => {
  const ids = fieldSections().map((s) => s.id);
  assert.ok(!ids.includes('admin_panel'));
  assert.ok(ids.includes('store') && ids.includes('productDetail') && ids.includes('master_ai'));
  assert.equal(sectionHash('store'), '#store');
  assert.equal(sectionHash('productDetail', 12), '#product=12');
  assert.equal(sectionHash('productDetail'), undefined);
});

test('a healthy page gives nothing; a broken one gives each error once with its severity', () => {
  assert.deepEqual(pageFindings(probe()), []);
  const bad = pageFindings(probe({
    pageErrors: ['TypeError: x is undefined', 'TypeError: x is undefined'], consoleErrors: ['favicon.ico 404', 'Failed to load chunk'],
    failed: [{ status: 500, url: 'https://sham-perfume-49bf.vercel.app/api/chat' }, { status: 404, url: 'https://example.test/img/a.webp' }],
    textLength: 20, rawText: ['undefined', 'NaN'], overflowPx: 40, brokenImages: 2, loadMs: 12_000,
  }));
  const codes = bad.map((f) => f.code);
  for (const c of ['page-error', 'console', 'http', 'asset-missing', 'blank', 'raw-text', 'overflow', 'broken-image', 'slow']) assert.ok(codes.includes(c as never), c);
  assert.equal(bad.find((f) => f.code === 'page-error')?.titleAr.includes('(1)'), true, 'the same error is counted once');
  assert.equal(bad.find((f) => f.code === 'console')?.detailAr?.includes('favicon'), false, 'browser noise is not the site\'s fault');
  assert.equal(sectionStatus(bad), 'fail');
  const ideas = pageFindings(probe({ imagesNoAlt: 3, unnamedButtons: 2, headings: 0, loadMs: 6500 }));
  assert.ok(ideas.length >= 4 && ideas.every((f) => f.kind === 'idea'));
  assert.equal(sectionStatus(ideas), 'ok');
  assert.equal(pageFindings(probe({ ok: false, failure: 'timeout' }))[0].code, 'unreachable');
});

test('findings keep their first sighting, count runs in a row, resolve only when their source looked again', () => {
  const at1 = '2026-10-23T01:41:00.000Z'; const at2 = '2026-10-23T07:41:00.000Z';
  const page = pageFindings(probe({ overflowPx: 30 }));
  const chat = gradeTurn({ drill: MANEUVER_DRILLS[0], index: 1, reply: 'شوف https://x/p/abc.html', route: 'store', source: 'brain', offline: true });
  const first = mergeFindings(undefined, [...page, ...chat], new Set(['browser', 'brain']), at1);
  const r1: ManeuverReport = { updatedAt: at1, run: { ms: 1, browser: true, pages: 1, drills: 1, live: 0, ai: false }, sections: [], findings: first.findings, resolved: [] };
  // Second run: the browser did not run (its finding is kept as it was), the chat error is gone (resolved).
  const second = mergeFindings(r1, [], new Set(['brain']), at2);
  assert.equal(second.findings.length, page.length);
  assert.equal(second.findings[0].firstSeen, at1);
  assert.ok(second.resolved.some((r) => r.id === chat[0].id));
  // Third: the browser sees it again → seen twice, first sighting kept.
  const third = mergeFindings({ ...r1, findings: second.findings }, page, new Set(['browser']), at2);
  assert.equal(third.findings[0].seen, 2);
  assert.equal(third.findings[0].firstSeen, at1);
});

test('the drills run against his own brain in the server order and grade what a good answer must do', () => {
  const card = brainReply(products, 'رقم الكارت 4111 1111 1111 1111', [], 'ar');
  assert.match(card?.route || '', /^quick:/, 'a card number is answered before anything else');
  const late = brainReply(products, 'الطلب اتأخر جداً', [], 'ar');
  assert.equal(late?.route, 'relations:late');
  const run = runBrainDrills(products);
  assert.ok(run.turns >= MANEUVER_DRILLS.length);
  assert.ok(run.findings.every((f) => f.section === CHAT_SECTION.id && f.id.startsWith(`${CHAT_SECTION.id}:`)));
  // The controls work today and must keep working.
  for (const id of ['late-order', 'buy-close', 'english-buy']) assert.ok(!run.findings.some((f) => f.id.includes(`:${id}:`)), id);
  const ids = run.findings.map((f) => f.id);
  assert.equal(new Set(ids).size, ids.length, 'each finding once');
});

test('grading: vendor names, repetition, the wrong language and missing answers are caught', () => {
  const drill = MANEUVER_DRILLS.find((d) => d.id === 'english-buy')!;
  const f = gradeTurn({ drill, index: 0, reply: 'Powered by gemini — أهلاً', previousReply: 'Powered by gemini — أهلاً', source: 'chat-live', offline: false });
  const codes = f.map((x) => x.code);
  assert.ok(codes.includes('chat-vendor') && codes.includes('chat-repeat') && codes.includes('chat-lang'));
  assert.equal(gradeTurn({ drill, index: 0, reply: '', source: 'chat-live', offline: false })[0].code, 'chat-empty');
  const own = MANEUVER_DRILLS.find((d) => d.id === 'group-gifts')!;
  assert.equal(gradeTurn({ drill: own, index: 0, reply: '', source: 'brain', offline: true })[0].code, 'chat-own');
});

test('the live drills rotate and stay few', () => {
  const a = liveDrillsFor(new Date('2026-10-23T01:41:00Z'), 3);
  const b = liveDrillsFor(new Date('2026-10-23T07:41:00Z'), 3);
  assert.equal(a.length, 3);
  assert.notDeepEqual(a.map((d) => d.id), b.map((d) => d.id));
});

test('the State decides the sector and the robot of each finding', () => {
  assert.deepEqual([stateSector({ code: 'broken-image', section: 'productDetail', kind: 'error' }).dept, stateSector({ code: 'broken-image', section: 'productDetail', kind: 'error' }).bot], ['store', 'images']);
  assert.equal(stateSector({ code: 'overflow', section: 'store', kind: 'error' }).bot, 'design_expert');
  assert.equal(stateSector({ code: 'page-error', section: 'pyramid', kind: 'error' }).dept, 'reliability');
  assert.equal(stateSector({ code: 'asset-missing', section: 'home', kind: 'error' }).bot, 'deploy');
  assert.equal(stateSector({ code: 'chat-expect', topic: 'store', section: CHAT_SECTION.id, kind: 'error' }).bot, 'store_advisor');
  assert.equal(stateSector({ code: 'chat-expect', topic: 'relations', section: CHAT_SECTION.id, kind: 'error' }).bot, 'chat');
  assert.equal(stateSector({ code: 'chat-lang', section: CHAT_SECTION.id, kind: 'error' }).bot, 'languages');
  assert.equal(stateSector({ code: 'chat-vendor', section: CHAT_SECTION.id, kind: 'error' }).bot, 'legal');
  assert.equal(stateSector({ code: 'ai-idea', section: 'perfume_news', kind: 'idea' }).bot, 'news');
  assert.equal(stateSector({ code: 'ai-idea', section: 'molecule_studio', kind: 'idea' }).dept, 'innovation');
  assert.ok(stateSector({ code: 'blank', section: 'library', kind: 'error' }).reasonAr.length > 10);
  assert.equal(fieldAction({ kind: 'error', severity: 'high', seen: 1 }), 'task');
  assert.equal(fieldAction({ kind: 'error', severity: 'medium', seen: 1 }), 'watch');
  assert.equal(fieldAction({ kind: 'error', severity: 'medium', seen: 3 }), 'task');
  assert.equal(fieldAction({ kind: 'idea', severity: 'low', seen: 9 }), 'backlog');
});

test('the State files the report, opens each task once, and keeps it in its own report', () => {
  const at = '2026-10-23T01:41:00.000Z';
  const merged = mergeFindings(undefined, [...pageFindings(probe({ section: 'productDetail', brokenImages: 1, pageErrors: ['boom'], imagesNoAlt: 1 }))], new Set(['browser']), at);
  const report: ManeuverReport = { updatedAt: at, run: { ms: 1, browser: true, pages: 1, drills: 0, live: 0, ai: false }, sections: [], findings: merged.findings, resolved: [] };
  const first = fileField(report, undefined, at, STATE_LIMITS.perRun.maneuver);
  assert.equal(first.field?.items.length, 3);
  assert.equal(first.due.length, 1, 'only the high error becomes a task now');
  const task = fieldTask(first.due[0].item, first.due[0].finding);
  assert.match(task.title, /^مهمة شاهين: \[/);
  assert.ok(task.body.includes(fieldMarker(first.due[0].item.id)));
  assert.ok(task.body.includes('الروبوت المسؤول'));
  // Opened as #301 → never due again while the finding lasts.
  const field = { ...first.field!, items: first.field!.items.map((i) => (i.id === first.due[0].item.id ? { ...i, issue: 301 } : i)) };
  const again = fileField(report, field, at, 3);
  assert.equal(again.due.length, 0);
  assert.equal(again.field?.items.find((i) => i.issue)?.issue, 301);
  const read = readStateReport(JSON.parse(JSON.stringify({ updatedAt: at, active: true, decisions: [], supervision: { problems: [] }, field: again.field })));
  assert.equal(read.field?.items.length, 3);
  assert.equal(read.field?.items.find((i) => i.issue === 301)?.dept, 'reliability');
  assert.equal(readStateReport({ updatedAt: at }).field, undefined);
});

test('the report file reads back, and broken input never throws', () => {
  assert.equal(readManeuverReport(null), undefined);
  assert.equal(readManeuverReport({ findings: 'x' }), undefined);
  const raw = JSON.parse(readFileSync('src/data/live/shaheen-maneuver.json', 'utf8'));
  const r = readManeuverReport(raw)!;
  assert.ok(r && r.findings.every((f) => f.id && f.titleAr));
  assert.match(maneuverSummaryAr(r), /^مناورة التخصصات:/);
  const junk = readManeuverReport({ updatedAt: 'x', findings: [{ id: 'a' }, { id: 'b', titleAr: 't', section: 'store', kind: 'error', severity: 'nope' }] })!;
  assert.equal(junk.findings.length, 1);
  assert.equal(junk.findings[0].severity, 'low');
});
