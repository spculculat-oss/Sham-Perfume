import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';
import type { AddressInfo } from 'node:net';
import {
  audioFromReply, cleanSpeechRequest, createVoiceRouter, dailyVoiceLimit, speechBody, voiceModels, retryAfterMs, ModelRest, speechPrompt, speechStyle, speechText, VoiceBudget, voiceEnabled, voiceModel,
} from '../server/voiceSpeak';
import { ShaheenMemory } from '../server/core/memory';
import { MemoryStore } from '../server/core/store';
import { emptyMemory } from '../src/utils/shaheenMemory';
import { anchorPair, applySayWords, cleanSayPair, learnedLine, mergeSayWords, teachingPair } from '../src/utils/sayWords';
import { speechGroups } from '../src/utils/humanVoice';

const VENDOR = /gemini|google|openai|chatgpt|claude|anthropic|deepseek/i;
// A minimal 16 kHz WAV (44-byte header + a few samples), as the engine returns it.
const WAV = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(40), Buffer.alloc(320, 1)]);
const engineReply = () => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ inlineData: { mimeType: 'audio/wav', data: WAV.toString('base64') } }] } }] }), { status: 200, headers: { 'Content-Type': 'application/json' } });

async function withServer(env: Record<string, string>, fetcher: typeof fetch, run: (base: string) => Promise<void>, memory?: ShaheenMemory) {
  const app = express();
  app.use(express.json());
  app.use('/api/voice', createVoiceRouter({ env, fetch: fetcher, ...(memory ? { memory } : {}) }));
  const server = app.listen(0);
  try { await run(`http://127.0.0.1:${(server.address() as AddressInfo).port}/api/voice`); } finally { server.close(); }
}
const post = (url: string, body: unknown) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

test('human voice: on with the server key, off on request; a conversational model, a man or a woman, Egyptian by default', () => {
  assert.equal(voiceEnabled({}), false);
  assert.equal(voiceEnabled({ GEMINI_API_KEY: 'k' }), true);
  assert.equal(voiceEnabled({ GEMINI_API_KEY: 'k', SHAM_VOICE_ENGINE: 'off' }), false);
  assert.match(voiceModel({}), /tts/);
  assert.equal(dailyVoiceLimit({}), 400);
  assert.equal(dailyVoiceLimit({ SHAM_VOICE_DAILY_LIMIT: '99999' }), 5000);
  assert.match(speechStyle('ar'), /Egyptian/);
  assert.match(speechStyle('ar', 'gulf'), /Gulf/);
  assert.match(speechStyle('ar', 'egyptian', 'calm'), /calm/);
  assert.match(speechStyle('en', undefined, 'quick'), /brisk/);
  const male = speechBody({}, { text: 'أهلاً بيك', language: 'ar', gender: 'male' });
  const female = speechBody({}, { text: 'أهلاً بيك', language: 'ar', gender: 'female' });
  const voice = (b: typeof male) => b.generationConfig.speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName;
  assert.notEqual(voice(male), voice(female));
  assert.deepEqual(male.generationConfig.responseModalities, ['AUDIO']);
  assert.match(male.contents[0]!.parts[0]!.text, /Egyptian Arabic accent[^:]*: أهلاً بيك$/, 'a short delivery note, then the words exactly');
  assert.equal(voiceModels({})[0], voiceModel({}));
  assert.equal(voiceModels({ SHAM_VOICE_MODEL: 'x-tts' }).length, 4, 'the chosen model plus backups');
  assert.equal(voiceModels({}).length, 4, 'four free quotas used in turn');
});

test('human voice: only clean visitor text reaches the engine (no tags, bounded length)', () => {
  assert.equal(speechText('مرحبا <laugh> يا <b>صديقي</b>'), 'مرحبا laugh يا b صديقي /b');
  assert.equal(speechText('x'.repeat(900)).length, 500);
  assert.equal(cleanSpeechRequest({ text: '   ' }), undefined);
  assert.equal(cleanSpeechRequest({ text: '1234' }), undefined);
  assert.deepEqual(cleanSpeechRequest({ text: 'Hi', language: 'zz', gender: 'x', dialect: 'nope', mood: 'angry' }), { text: 'Hi', language: 'ar', gender: 'male' });
  assert.deepEqual(cleanSpeechRequest({ text: 'Hi', language: 'en', gender: 'female', mood: 'calm' }), { text: 'Hi', language: 'en', gender: 'female', mood: 'calm' });
  assert.equal(audioFromReply({ steps: [] }), undefined);
  assert.equal(audioFromReply(null), undefined);
  const pcm = Buffer.alloc(4800, 1);
  const wav = audioFromReply({ candidates: [{ content: { parts: [{ inlineData: { mimeType: 'audio/L16;codec=pcm;rate=24000', data: pcm.toString('base64') } }] } }] })!;
  assert.equal(wav.toString('ascii', 0, 4), 'RIFF', 'raw speech is wrapped so every browser can play it');
  assert.equal(wav.readUInt32LE(24), 24000);
  assert.equal(wav.length, 44 + pcm.length);
});

test('human voice: a model that refuses or is busy hands the line to the next one', async () => {
  const urls: string[] = [];
  const flaky = (async (url: string) => {
    urls.push(String(url));
    return urls.length === 1 ? new Response('{"error":{}}', { status: 400 }) : engineReply();
  }) as unknown as typeof fetch;
  await withServer({ GEMINI_API_KEY: 'k' }, flaky, async (base) => {
    const res = await post(`${base}/speak`, { text: 'أهلاً بيك', language: 'ar' });
    assert.equal(res.status, 200);
    assert.equal(urls.length, 2);
    assert.match(urls[0]!, /models\/gemini-[^/]+-tts:generateContent$/);
    assert.notEqual(urls[0], urls[1]);
  });
});

test('human voice: the day budget runs out and an engine «quota» pauses it', () => {
  const budget = new VoiceBudget(2);
  const now = Date.parse('2026-11-14T10:00:00Z');
  assert.equal(budget.take(now), true);
  assert.equal(budget.take(now), true);
  assert.equal(budget.take(now), false);
  assert.equal(budget.take(now + 24 * 3600_000), true, 'a new day');
  budget.pause(60_000, now + 24 * 3600_000);
  assert.equal(budget.available(now + 24 * 3600_000 + 1000), false);
});

test('human voice: the server returns audio, caches a repeated line, and says «busy» honestly (device voice takes over)', async () => {
  let calls = 0;
  const ok = (async () => { calls += 1; return engineReply(); }) as typeof fetch;
  await withServer({ GEMINI_API_KEY: 'k' }, ok, async (base) => {
    assert.deepEqual(await (await fetch(`${base}/status`)).json(), { human: true });
    const first = await post(`${base}/speak`, { text: 'خلصت ولا لسه؟', language: 'ar', gender: 'female' });
    assert.equal(first.status, 200);
    assert.equal(first.headers.get('content-type'), 'audio/wav');
    assert.equal(Buffer.from(await first.arrayBuffer()).length, WAV.length);
    await post(`${base}/speak`, { text: 'خلصت ولا لسه؟', language: 'ar', gender: 'female' });
    assert.equal(calls, 1, 'the same line is said from memory');
    assert.equal((await post(`${base}/speak`, { text: '' })).status, 400);
  });
  const quota = (async () => new Response('{"error":{"message":"Resource exhausted for gemini"}}', { status: 429 })) as typeof fetch;
  await withServer({ GEMINI_API_KEY: 'k' }, quota, async (base) => {
    const busy = await post(`${base}/speak`, { text: 'أهلاً', language: 'ar' });
    assert.equal(busy.status, 503);
    const body = await busy.text();
    assert.doesNotMatch(body, VENDOR, 'no vendor name or upstream text reaches a visitor');
    assert.deepEqual(JSON.parse(body), { code: 'voice_busy' });
    assert.deepEqual(await (await fetch(`${base}/status`)).json(), { human: false });
  });
  await withServer({}, ok, async (base) => {
    assert.equal((await post(`${base}/speak`, { text: 'أهلاً' })).status, 503);
  });
});

test('pronunciation: visitors teach how a word is said, in Arabic and other languages — never a different word', () => {
  assert.deepEqual(teachingPair('لا، اسمها شانيل مش تشانيل'), { from: 'تشانيل', to: 'شانيل' });
  assert.deepEqual(teachingPair('مش تشانيل، اسمها شانيل'), { from: 'تشانيل', to: 'شانيل' });
  assert.deepEqual(teachingPair('كركدجيان بتتنطق كوركجان'), { from: 'كركدجيان', to: 'كوركجان' });
  assert.deepEqual(teachingPair('Kurkdjian is pronounced Kurkjan'), { from: 'Kurkdjian', to: 'Kurkjan' });
  assert.deepEqual(teachingPair('Guerlain se prononce Guerlan'), { from: 'Guerlain', to: 'Guerlan' });
  assert.equal(teachingPair('اسمه عود مش مسك'), undefined, 'a different perfume, not a pronunciation');
  assert.equal(teachingPair('عايز عطر خشبي مش زهري'), undefined);
  assert.equal(teachingPair('قوله عطر مش غالي'), undefined);
  assert.equal(cleanSayPair('Dior', 'https://x'), undefined);
  assert.equal(cleanSayPair('a', 'b'), undefined);
  assert.deepEqual(cleanSayPair('Dior', 'ديور'), { from: 'Dior', to: 'ديور' }, 'a Latin name with how it sounds');
  assert.equal(applySayWords('عطر تشانيل من Maison Kurkdjian.', { 'تشانيل': 'شانيل', kurkdjian: 'كوركجان' }), 'عطر شانيل من Maison كوركجان.');
  assert.equal(applySayWords('عطر تشانيلات', { 'تشانيل': 'شانيل' }), 'عطر تشانيلات', 'whole words only');
  assert.deepEqual(mergeSayWords({ dior: 'ديور' }, { dior: 'ديوغ' }), { dior: 'ديوغ' }, 'his own lesson wins');
  assert.deepEqual(anchorPair({ from: 'كركجيان', to: 'كوركجان' }, 'جرب ميزون فرانسيس كركدجيان باكارات روج.'), { from: 'كركدجيان', to: 'كوركجان' });
  assert.match(learnedLine('ar', 'egyptian', 'شانيل'), /هقولها «شانيل»/);
  assert.match(learnedLine('ja', undefined, 'x'), /from now on/);
});

test('pronunciation: shared with everyone only after several different people taught it', async () => {
  const memory = new ShaheenMemory(new MemoryStore(), {}, fetch, emptyMemory());
  await withServer({}, fetch, async (base) => {
    assert.equal((await post(`${base}/say-words`, { from: 'مسك', to: 'عود' })).status, 400);
    for (let i = 0; i < 5; i += 1) assert.equal((await post(`${base}/say-words`, { from: 'تشانيل', to: 'شانيل' })).status, 200);
    assert.deepEqual((await (await fetch(`${base}/say-words`)).json()).words, {}, 'one visitor repeating it is one lesson');
  }, memory);
  await memory.learnSayWord('تشانيل', 'شانيل');
  await memory.learnSayWord('تشانيل', 'شانيل');
  assert.deepEqual(await memory.sayWords(), { 'تشانيل': 'شانيل' });
});

test('human voice: a short first group (he starts sooner), then longer ones', () => {
  const groups = speechGroups(['أهلاً بيك.', 'أنا شاهين.', 'x'.repeat(170), 'y'.repeat(200), 'z'.repeat(200)]);
  assert.equal(groups[0], 'أهلاً بيك. أنا شاهين.');
  assert.ok(groups[0]!.length <= 180);
  assert.equal(groups[1], `${'x'.repeat(170)} ${'y'.repeat(200)}`);
  assert.equal(groups[2], 'z'.repeat(200));
  assert.equal(groups.length, 3);
});

test('human voice: an Arabic line reaches the engine with no Latin words left, and the note stays English (never read aloud)', () => {
  const prompt = speechPrompt({ text: 'الـ top notes فيها bergamot، جرب Ombre Nomade. SKU: LAT-095', language: 'ar', gender: 'male' });
  assert.match(prompt, /^Say this in a Egyptian Arabic accent/);
  const said = prompt.slice(prompt.indexOf(': ') + 2);
  assert.doesNotMatch(said, /[A-Za-z]/, said);
  assert.match(said, /النوتات العليا/);
  assert.match(said, /برغموت/);
  assert.doesNotMatch(said, /095/, 'a product code is for the screen');
  assert.equal(speechPrompt({ text: 'Try Ombre Nomade', language: 'en', gender: 'male' }).endsWith(': Try Ombre Nomade'), true, 'other languages untouched');
});

test('human voice: a model that says «quota» rests until the time it gave; the next one speaks; all resting → busy with Retry-After', async () => {
  assert.equal(retryAfterMs({ error: { details: [{ '@type': 'x.RetryInfo', retryDelay: '37s' }] } }), 37_000);
  assert.equal(retryAfterMs({ error: { details: [{ retryDelay: '62180s' }] } }), 62_180_000);
  assert.equal(retryAfterMs(undefined), 60_000);
  const rest = new ModelRest();
  rest.rest('a', 5000, 0);
  assert.equal(rest.ready('a', 1000), false);
  assert.equal(rest.wait(['a', 'b'], 1000), 0, 'another model is ready');
  assert.equal(rest.wait(['a'], 1000), 4000);
  const asked: string[] = [];
  const quota = (url: string) => new Response(JSON.stringify({ error: { details: [{ retryDelay: url.includes('lite') ? '62000s' : '20s' }] } }), { status: 429 });
  let n = 0;
  const engine = (async (url: string) => {
    asked.push(String(url));
    n += 1;
    return n < 3 ? quota(String(url)) : engineReply();
  }) as unknown as typeof fetch;
  await withServer({ GEMINI_API_KEY: 'k' }, engine, async (base) => {
    assert.equal((await post(`${base}/speak`, { text: 'أهلاً بيك', language: 'ar' })).status, 200, 'the third model spoke');
    asked.length = 0;
    assert.equal((await post(`${base}/speak`, { text: 'تاني', language: 'ar' })).status, 200);
    assert.equal(asked.length >= 1 && !asked[0]!.includes('3.8-flash-lite'), true, 'a resting model is not asked again');
  });
  const allBusy = (async (url: string) => quota(String(url))) as unknown as typeof fetch;
  await withServer({ GEMINI_API_KEY: 'k' }, allBusy, async (base) => {
    const res = await post(`${base}/speak`, { text: 'أهلاً', language: 'ar' });
    assert.equal(res.status, 503);
    assert.deepEqual(await res.json(), { code: 'voice_busy' });
    assert.equal(res.headers.get('retry-after'), '20', 'the page is told how long');
    assert.deepEqual(await (await fetch(`${base}/status`)).json(), { human: false });
  });
});
