import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { test } from 'node:test';
import { HANDBOOK_EDITION, HANDBOOK_MARKUP, botCard, handbookBrief, handbookDoc, handbookSections, withHandbook } from '../src/utils/botHandbook';
import { BOTS, LEGAL_DECISIONS, LINKS } from '../src/utils/shaheenOrg';
import { SHIPPING } from '../src/utils/pricing';
import { PRICE_MARKUP } from '../scripts/shaheen-import/transform';
import { SHIFTS } from '../scripts/shaheen-patrol/shifts';
import { REVIEWERS } from '../scripts/shaheen-patrol/patrol';
import { JOURNEYS } from '../src/utils/opsMap';
import { makeAsk } from '../scripts/doctor/agent';
import { answerBook } from '../scripts/doctor/answers';

const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });

test('the new robots joined the organisation: the teacher, the library and the researcher, with links, a shift and a reviewer', () => {
  for (const id of ['teacher', 'library', 'researcher'] as const) {
    const bot = BOTS.find((b) => b.id === id);
    assert.ok(bot, `${id} is registered`);
    assert.ok(LINKS.some((l) => l.from === id) && LINKS.some((l) => l.to === id), `${id} helps and is helped`);
    assert.ok(SHIFTS.some((s) => s.bots.includes(id)), `${id} has a patrol shift`);
    assert.ok(REVIEWERS[id], `${id} has an expert reviewer`);
  }
  assert.ok(LINKS.some((l) => l.from === 'legal' && l.to === 'researcher'), 'the legal manager rules on the open sources');
  assert.ok(JOURNEYS.some((j) => ['library', 'researcher', 'teacher'].every((b) => j.steps.some((s) => s.bot === b))), 'the ops map shows the offline journey');
});

test('the handbook covers the platform: identity, policies, pricing, money, tools, work and onboarding', () => {
  const ids = handbookSections().map((s) => s.id);
  for (const id of ['identity', 'policies', 'pricing', 'money', 'tools', 'work', 'onboarding']) assert.ok(ids.includes(id), id);
  const policies = handbookSections().find((s) => s.id === 'policies')!.points.join('\n');
  for (const d of LEGAL_DECISIONS) assert.ok(policies.includes(d.textAr), `legal decision ${d.id} is in the book word for word`);
  assert.match(policies, /جوجل/);
  assert.match(policies, /كلمات سر/);
});

test("the handbook's pricing is the store's real rule and shipping table", () => {
  assert.equal(HANDBOOK_MARKUP, PRICE_MARKUP);
  const pricing = handbookSections().find((s) => s.id === 'pricing')!.points.join('\n');
  assert.ok(pricing.includes(`× ${PRICE_MARKUP}`));
  for (const z of [...SHIPPING.zones, SHIPPING.default]) assert.ok(pricing.includes(`${z.name.ar}: ${z.firstItem} ${SHIPPING.currency} لأول زجاجة + ${z.extraItem}`), z.id);
});

test('the handbook directory lists every robot, and SHAHEEN_HANDBOOK.md is up to date', () => {
  const doc = handbookDoc();
  for (const b of BOTS) assert.ok(doc.includes(`**${b.nameAr}**`), b.id);
  assert.ok(doc.includes(HANDBOOK_EDITION));
  assert.equal(readFileSync(new URL('../SHAHEEN_HANDBOOK.md', import.meta.url), 'utf8'), doc, 'run: node --import tsx scripts/shaheen-council/org-doc.mts');
});

test("every robot's brief is short, carries the policies and the robot's own card", () => {
  for (const b of BOTS) {
    const brief = handbookBrief(b.id);
    assert.ok(brief.length <= 2200, `${b.id}: ${brief.length}`);
    assert.ok(brief.includes(HANDBOOK_EDITION) && brief.includes('L-03') && brief.includes(`× ${PRICE_MARKUP}`), b.id);
    assert.ok(brief.includes(`«${b.nameAr}»`), `${b.id} meets itself`);
    assert.ok(botCard(b.id).includes(b.dutiesAr), `${b.id}'s card has its duties`);
  }
  assert.ok(handbookBrief('importer').includes(LEGAL_DECISIONS.find((d) => d.bot === 'importer')!.textAr.slice(0, 40)), 'the importer reads its legal decision');
  assert.ok(!/gemini|openai|claude|deepseek/i.test(handbookBrief()), 'no AI vendor names in the brief');
  assert.ok(withHandbook('seo', 'TASK').endsWith('TASK'));
});

test('makeAsk hands the book to the model with every request, and the answer cache stays keyed by the task', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'handbook-'));
  try {
    const systems: string[] = [];
    const request = (async (_url: string, init?: RequestInit) => {
      systems.push(JSON.stringify(JSON.parse(String(init?.body)).systemInstruction ?? ''));
      return json({ candidates: [{ content: { parts: [{ text: 'ok' }] }, finishReason: 'STOP' }] });
    }) as unknown as typeof fetch;
    const book = answerBook(pathToFileURL(join(dir, 'ai-memory.json')));
    const ask = (await makeAsk({ GEMINI_API_KEY: 'k' }, { bot: 'news', memory: book, request }))!;
    assert.equal(await ask('TASK-SYSTEM', 'prompt'), 'ok');
    assert.equal(systems.length, 1);
    assert.ok(systems[0].includes('كتيب روبوتات شام') && systems[0].includes('TASK-SYSTEM'), 'the model got the book and the task');
    assert.ok(systems[0].includes(BOTS.find((b) => b.id === 'news')!.nameAr), 'and the robot card');
    assert.equal(book.get('TASK-SYSTEM', 'prompt'), 'ok', 'cached under the task alone');
    const plain = (await makeAsk({ GEMINI_API_KEY: 'k' }, { handbook: false, request }))!;
    await plain('ONLY', 'p');
    assert.ok(!systems[1].includes('كتيب روبوتات شام'), 'handbook: false opts out');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
