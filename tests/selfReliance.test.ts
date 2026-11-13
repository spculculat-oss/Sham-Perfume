/**
 * «شاهين معتمد على نفسه» (rule O-10) — with the owner's switch off, no outside AI platform is ever called:
 * hosted engines and Manus count as not configured, only a model on our own machine may answer, and the chat
 * still answers (his designer, his library, or an honest «مش متأكد»).
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import { test } from 'node:test';
import express from 'express';
import { AI_PLATFORMS_VAR, isOwnMachine, platformsOff } from '../server/core/selfReliance';
import { callEngine, engineStatuses } from '../server/core/engines';
import { manusConfigured } from '../server/core/manus';
import { createShaheenRouter, getPublicModes } from '../server/shaheen';
import { Repository } from '../server/core/repository';
import { MemoryStore } from '../server/core/store';
import { SHAHEEN_SITE_SETTINGS } from '../server/config/shaheen';
import { applyOwnerCommand, OWNER_ACTIONS, OWNER_RULES, readControls } from '../src/utils/ownerAuthority';
import { unknownAnswer } from '../src/utils/shaheenLibrary';
import controls from '../src/data/owner/controls.json';

const OFF = { [AI_PLATFORMS_VAR]: 'off' };
const KEYS = { GEMINI_API_KEY: 'g', OPENAI_API_KEY: 'o', ANTHROPIC_API_KEY: 'a', DEEPSEEK_API_KEY: 'd', OPENROUTER_API_KEY: 'r', PERPLEXITY_API_KEY: 'p', MANUS_API_KEY: 'm' };

test('the owner\'s platform switch is read (now «تلقائي»: tests/platformsAuto.test.ts); «off» still closes everything', () => {
  assert.equal(readControls(controls).aiPlatforms, 'auto');
  assert.equal(readControls({ aiPlatforms: 'off' }).aiPlatforms, 'off');
  assert.equal(readControls({}).aiPlatforms, 'on'); // an old file keeps the old behaviour
  assert.ok(platformsOff(OFF));
  assert.ok(!platformsOff({}));
  assert.ok(OWNER_RULES.some((r) => r.id === 'O-10' && /منصات الذكاء الاصطناعي/.test(r.textAr) && /يقفل المنصات خالص/.test(r.textAr)));
});

test('off: every hosted engine and Manus are closed, whatever keys exist', () => {
  const statuses = engineStatuses({ ...KEYS, ...OFF });
  for (const s of statuses.filter((x) => x.kind === 'hosted')) assert.equal(s.configured, false, s.id);
  assert.equal(statuses.find((s) => s.id === 'sham_local')?.configured, true);
  assert.equal(manusConfigured({ ...KEYS, ...OFF }), false);
  // On: the keys work as before.
  assert.ok(engineStatuses(KEYS).find((s) => s.id === 'gemini')?.configured);
  assert.ok(manusConfigured(KEYS));
});

test('off: only a model served on our own machine may answer (the teacher), never a gateway or a remote one', () => {
  const local = engineStatuses({ ...OFF, SHAM_LLM_BASE_URL: 'http://127.0.0.1:8080/v1' }).find((s) => s.id === 'self_hosted');
  assert.equal(local?.configured, true);
  const remote = engineStatuses({ ...OFF, SHAM_LLM_BASE_URL: 'https://llm.example.com/v1' }).find((s) => s.id === 'self_hosted');
  assert.equal(remote?.configured, false);
  const gateway = engineStatuses({ ...OFF, AI_GATEWAY_API_KEY: 'k' }).find((s) => s.id === 'self_hosted');
  assert.equal(gateway?.configured, false);
  assert.ok(isOwnMachine('http://localhost:11434'));
  assert.ok(isOwnMachine('http://[::1]:8080/v1'));
  assert.ok(!isOwnMachine('https://localhost.example.com'));
  assert.ok(!isOwnMachine('not a url'));
});

test('off: a closed platform is never called, even when asked for by name', async () => {
  let calls = 0;
  const fetch = (async () => { calls++; return new Response('{}'); }) as unknown as typeof globalThis.fetch;
  const reply = await callEngine('openai', 'x', [{ role: 'user', text: 'hi' }], { env: { ...KEYS, ...OFF }, fetch, signal: AbortSignal.timeout(2000), temperature: 0 });
  assert.equal(reply, undefined);
  assert.equal(calls, 0);
});

test('off: the visitor modes stay ready (his own brain), the council is not offered', () => {
  const modes = Object.fromEntries(getPublicModes(OFF, SHAHEEN_SITE_SETTINGS).map((m) => [m.id, m.hasApiKey]));
  assert.equal(modes.auto, true);
  assert.equal(modes.fast, true);
  assert.equal(modes.deep, true);
  assert.equal(modes.council, false);
});

async function chat(body: Record<string, unknown>, onFetch: () => void) {
  const fetch = (async () => { onFetch(); throw new Error('no network in tests'); }) as unknown as typeof globalThis.fetch;
  const app = express();
  app.use(express.json());
  app.use('/api', createShaheenRouter({ repo: new Repository(new MemoryStore(), {}), env: { ...KEYS, ...OFF }, fetch }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise((done) => server.once('listening', done));
  try {
    const res = await globalThis.fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}/api/chat`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ model: 'auto', language: 'ar', conversationHistory: [], ...body }),
    });
    return { status: res.status, data: await res.json() as { reply?: string; designer?: boolean; memory?: string; code?: string } };
  } finally { await new Promise((done) => server.close(done)); }
}

test('off: a design request is answered by his own designer, with no platform call', async () => {
  let platformCalls = 0;
  const { status, data } = await chat({ message: 'صمم لي خلطة شتوية فيها عود' }, () => { platformCalls++; });
  assert.equal(status, 200);
  assert.equal(data.designer, true);
  assert.match(data.reply || '', /sham-formula/);
  assert.equal(platformCalls, 0);
});

test('off: a follow-up to his formula changes that formula', async () => {
  const first = await chat({ message: 'صمم عطر شتوي رجالي فيه عود' }, () => {});
  const { data } = await chat({ message: 'خليه أحلى', conversationHistory: [
    { role: 'user', text: 'صمم عطر شتوي رجالي فيه عود' }, { role: 'assistant', text: first.data.reply },
  ] }, () => {});
  assert.equal(data.designer, true);
  assert.match(data.reply || '', /حلو/);
  assert.match(data.reply || '', /عود/);
});

test('off: nothing known → an honest «I am not sure» (200), never a guess or «unavailable»', async () => {
  const { status, data } = await chat({ message: 'zqxv blorptian kwemfa vrandolith' }, () => {});
  assert.equal(status, 200);
  assert.ok(data.memory === 'unknown' || data.memory === 'library', data.memory);
  if (data.memory === 'unknown') assert.match(data.reply || '', /مش هخمّن/);
  assert.match(unknownAnswer('ar', true), /سجلته/);
  assert.doesNotMatch(unknownAnswer('ar', false), /سجلته/);
  assert.match(unknownAnswer('en', false), /won't guess/);
});

test('the owner desk can turn the platforms off and on; Shaheen cannot', () => {
  assert.ok('self_reliant' in OWNER_ACTIONS && 'platforms_on' in OWNER_ACTIONS);
  const on = readControls({});
  const off = applyOwnerCommand(on, 'self_reliant', undefined, 'owner');
  assert.equal(off.controls.aiPlatforms, 'off');
  assert.ok(off.changed);
  assert.equal(applyOwnerCommand(off.controls, 'platforms_on', undefined, 'owner').controls.aiPlatforms, 'on');
  const workflow = readFileSync('.github/workflows/owner-control.yml', 'utf8');
  assert.match(workflow, /- self_reliant/);
  assert.match(workflow, /- platforms_on/);
  // A pause without a robot is a warning, not a broken desk (#217, #220).
  const control = readFileSync('scripts/owner/control.mts', 'utf8');
  assert.match(control, /::warning title=أمر صاحب الموقع::/);
  assert.match(control, /out\('changed', 'false'\);\n {2}process\.exit\(0\);/);
});
