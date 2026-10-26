/**
 * «تلقائي» — the owner's switch of 2026-10-22: «طول ما هما شغالين خليه يتعلم منهم ويعتمد عليهم، لو مش شغالين يعتمد ذاتي».
 * While an AI platform answers, Shaheen uses it and keeps the answer in his memory; when none answers (no key, no
 * credit, a limit, an outage) he answers on his own at once — designer, agent, library, memory — never an error page,
 * and never waiting on an engine known to be down.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import { test } from 'node:test';
import express from 'express';
import { AI_PLATFORMS_VAR, platformsAuto, platformsMode, platformsOff } from '../server/core/selfReliance';
import { createShaheenRouter, getPublicModes, platformsReady } from '../server/shaheen';
import { EngineHealth } from '../server/core/engineHealth';
import { Repository } from '../server/core/repository';
import { MemoryStore } from '../server/core/store';
import { ShaheenMemory } from '../server/core/memory';
import { SHAHEEN_SITE_SETTINGS } from '../server/config/shaheen';
import { applyOwnerCommand, OWNER_ACTIONS, OWNER_RULES, readControls } from '../src/utils/ownerAuthority';
import { emptyMemory } from '../src/utils/shaheenMemory';
import { teacherPreference } from '../scripts/shaheen-school/school';
import controls from '../src/data/owner/controls.json';

const AUTO = { [AI_PLATFORMS_VAR]: 'auto' };
const ANSWER = 'لتثبيت العطر رشه على جلد مرطب وعلى نقاط النبض، واختار تركيز او دو بارفان، وخزن الزجاجة بعيد عن الحرارة والشمس.';
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });

test('the owner chose «تلقائي», and the switch is read', () => {
  assert.equal(readControls(controls).aiPlatforms, 'auto');
  // Newer owner orders (freeze/unfreeze of all robots) may top the log; the auto-switch order stays on record.
  assert.ok(readControls(controls).log.some((e) => e.action === 'platforms_auto'), 'the «تلقائي» order is recorded');
  assert.equal(readControls({ aiPlatforms: 'auto' }).aiPlatforms, 'auto');
  assert.equal(readControls({ aiPlatforms: 'weird' }).aiPlatforms, 'on');
  assert.equal(platformsMode(AUTO), 'auto');
  assert.ok(platformsAuto(AUTO) && !platformsOff(AUTO));
  assert.equal(platformsMode({ [AI_PLATFORMS_VAR]: 'off' }), 'off');
  assert.equal(platformsMode({}), 'on');
  assert.ok(OWNER_RULES.some((r) => r.id === 'O-10' && /تلقائي/.test(r.textAr) && /بيرد بنفسه/.test(r.textAr)));
});

test('the owner desk has the «تلقائي» order (and can still close or open the platforms)', () => {
  assert.ok('platforms_auto' in OWNER_ACTIONS);
  const off = applyOwnerCommand(readControls({}), 'self_reliant', undefined, 'owner').controls;
  const auto = applyOwnerCommand(off, 'platforms_auto', undefined, 'owner');
  assert.equal(auto.controls.aiPlatforms, 'auto');
  assert.match(auto.noteAr, /تلقائي/);
  assert.equal(applyOwnerCommand(auto.controls, 'self_reliant', undefined, 'owner').controls.aiPlatforms, 'off');
  assert.match(readFileSync('.github/workflows/owner-control.yml', 'utf8'), /- platforms_auto/);
});

test('«تلقائي»: a platform counts only while it works; the visitor modes stay ready either way', () => {
  const env = { ...AUTO, GEMINI_API_KEY: 'g' };
  const health = new EngineHealth();
  assert.equal(platformsReady(SHAHEEN_SITE_SETTINGS, env, health), true);
  health.fail('gemini', 'invalid_key');
  assert.equal(platformsReady(SHAHEEN_SITE_SETTINGS, env, health), false, 'a parked platform is not waited on');
  health.ok('gemini');
  assert.equal(platformsReady(SHAHEEN_SITE_SETTINGS, env, health), true, 'back the moment it works');
  assert.equal(platformsReady(SHAHEEN_SITE_SETTINGS, AUTO, health), false, 'no key at all');
  const modes = Object.fromEntries(getPublicModes(AUTO, SHAHEEN_SITE_SETTINGS).map((m) => [m.id, m.hasApiKey]));
  assert.equal(modes.auto, true, 'no key: his own brain still answers');
  assert.equal(modes.fast, true);
});

test('«تلقائي»: the school studies with the platforms first, the local teacher when they stop', () => {
  assert.equal(teacherPreference({ ...AUTO, SCHOOL_PREFER: 'self_hosted' }), undefined);
  assert.equal(teacherPreference({ [AI_PLATFORMS_VAR]: 'off', SCHOOL_PREFER: 'self_hosted' }), 'self_hosted');
  assert.equal(teacherPreference({ SCHOOL_PREFER: 'self_hosted' }), 'self_hosted');
  assert.equal(teacherPreference({ ...AUTO, SCHOOL_PREFER: 'gemini' }), 'gemini');
});

async function withChat(env: Record<string, string>, fetch: typeof globalThis.fetch, memory: ShaheenMemory, run: (ask: (message: string) => Promise<{ status: number; data: Record<string, unknown> }>) => Promise<void>) {
  const app = express();
  app.use(express.json());
  app.use('/api', createShaheenRouter({ repo: new Repository(new MemoryStore(), {}), env: { ...AUTO, SHAM_ANSWER_CACHE_MINUTES: '0', SHAM_WEB_RESEARCH: '0', ...env }, fetch, memory }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise((done) => server.once('listening', done));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
  try {
    await run(async (message) => {
      const res = await globalThis.fetch(`${base}/chat`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ model: 'auto', language: 'ar', conversationHistory: [], message }) });
      return { status: res.status, data: await res.json() as Record<string, unknown> };
    });
  } finally { await new Promise((done) => server.close(done)); }
}

test('«تلقائي»: while a platform works it answers, and Shaheen learns the answer', async () => {
  let calls = 0;
  const fetch = (async () => { calls++; return json({ choices: [{ message: { role: 'assistant', content: ANSWER } }] }); }) as unknown as typeof globalThis.fetch;
  const memory = new ShaheenMemory(new MemoryStore(), {}, fetch, emptyMemory());
  await withChat({ OPENAI_API_KEY: 'sk-test' }, fetch, memory, async (ask) => {
    const { status, data } = await ask('ازاي اخلي العطر يثبت على جلدي اكتر');
    assert.equal(status, 200);
    assert.equal(data.reply, ANSWER);
    assert.ok(calls >= 1);
    const learned = (await memory.learned()).entries;
    assert.ok(learned.some((e) => e.answer === ANSWER), 'the platform’s answer is now his own');
    // Next time, the same question costs no platform call: he answers from what he learned.
    const before = calls;
    const again = await ask('ازاي اخلي العطر يثبت على جلدي اكتر؟');
    assert.equal(again.data.memory, 'exact');
    assert.equal(calls, before);
  });
});

test('«تلقائي»: the platform fails — Shaheen answers on his own at once, never an error page', async () => {
  let calls = 0;
  const fetch = (async () => { calls++; return json({ error: { message: 'insufficient_quota' } }, 429); }) as unknown as typeof globalThis.fetch;
  const memory = new ShaheenMemory(new MemoryStore(), {}, fetch, emptyMemory());
  await withChat({ OPENAI_API_KEY: 'sk-test' }, fetch, memory, async (ask) => {
    const design = await ask('صمم لي خلطة شتوية فيها عود');
    assert.equal(design.status, 200);
    assert.equal(design.data.designer, true, 'his own designer');
    const logic = await ask('ايه هي المغالطة المنطقية؟');
    assert.equal(logic.status, 200);
    assert.equal(logic.data.memory, 'agent', 'his own agent and school');
    const unknown = await ask('zqxv blorptian kwemfa vrandolith');
    assert.equal(unknown.status, 200, 'nothing known: an honest «مش متأكد», not «unavailable»');
    assert.ok(unknown.data.memory === 'unknown' || unknown.data.memory === 'library', String(unknown.data.memory));
    assert.doesNotMatch(JSON.stringify([design.data, logic.data, unknown.data]), /openai|gpt|chatgpt/i, 'no vendor shown to the visitor');
  });
});

test('«تلقائي» with no key at all: no platform is ever called, Shaheen answers himself', async () => {
  let calls = 0;
  const fetch = (async () => { calls++; throw new Error('no network in tests'); }) as unknown as typeof globalThis.fetch;
  const memory = new ShaheenMemory(new MemoryStore(), {}, fetch, emptyMemory());
  await withChat({}, fetch, memory, async (ask) => {
    const { status, data } = await ask('ايه الفرق بين الاستنتاج والاستقراء؟');
    assert.equal(status, 200);
    assert.equal(data.memory, 'agent');
    assert.equal(calls, 0);
  });
});
