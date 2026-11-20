import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';
import type { AddressInfo } from 'node:net';
import {
  MAX_AUDIO_BASE64, MUSIC_DAILY_LIMIT, TRANSCRIBE_MODELS, createStudioVoiceRouter, musicFromReply, musicPrompt, readAudio, transcriptionFromReply, ttsText,
} from '../server/studioVoice';

const VENDOR = /gemini|google|lyria|openai|chatgpt|claude|anthropic/i;
const WAV = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(40), Buffer.alloc(320, 1)]);
const AUDIO_B64 = Buffer.alloc(64, 7).toString('base64');
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const textEngine = (text: string) => reply({ candidates: [{ content: { parts: [{ text }] } }] });
const audioEngine = (mimeType = 'audio/wav') => reply({ candidates: [{ content: { parts: [{ inlineData: { mimeType, data: WAV.toString('base64') } }] } }] });

async function withServer(env: Record<string, string>, fetcher: typeof fetch, run: (base: string) => Promise<void>) {
  const app = express();
  app.use(express.json({ limit: '8mb' }));
  app.use('/api/ai', createStudioVoiceRouter({ env, fetch: fetcher }));
  const server = app.listen(0);
  try { await run(`http://127.0.0.1:${(server.address() as AddressInfo).port}/api/ai`); } finally { server.close(); }
}
const post = (url: string, body: unknown) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

test('studio recordings: a data URL or bare base64 of real audio, nothing else', () => {
  assert.deepEqual(readAudio(`data:audio/webm;base64,${AUDIO_B64}`, undefined), { data: AUDIO_B64, mimeType: 'audio/webm' });
  assert.deepEqual(readAudio(AUDIO_B64, 'audio/mp4'), { data: AUDIO_B64, mimeType: 'audio/mp4' });
  assert.equal(readAudio(AUDIO_B64, undefined)?.mimeType, 'audio/webm', 'the recorder default');
  assert.equal(readAudio('data:image/png;base64,AAAA', undefined), undefined, 'a picture is not a recording');
  assert.equal(readAudio('not base64 at all !!', 'audio/webm'), undefined);
  assert.equal(readAudio('data:audio/webm;base64,AAAA', undefined), undefined, 'a one-byte clip is not speech');
  assert.equal(readAudio('x'.repeat(MAX_AUDIO_BASE64 + 8), 'audio/webm'), undefined, 'an oversized clip is refused before the engine');
  assert.equal(readAudio(undefined, undefined), undefined);
  assert.equal(readAudio(42, 'audio/webm'), undefined);
});

test('studio replies: only real spoken text is read back, never a thought or a vendor name', () => {
  assert.equal(transcriptionFromReply({ candidates: [{ content: { parts: [{ text: ' مرحبا ', thought: true }, { text: 'أهلاً بيك' }] } }] }), 'أهلاً بيك');
  assert.equal(transcriptionFromReply({ candidates: [] }), '');
  assert.equal(transcriptionFromReply(null), '');
  const music = musicFromReply({ candidates: [{ content: { parts: [{ text: 'lyrics', thought: true }, { inlineData: { mimeType: 'audio/wav', data: 'AAA' } }] } }] });
  assert.deepEqual(music, { audioBase64: 'AAA', mimeType: 'audio/wav', lyrics: '' });
  assert.equal(musicFromReply({ candidates: [{ content: { parts: [{ text: 'no audio' }] } }] }), undefined);
  assert.doesNotMatch(musicPrompt('warm oud', 'ليل', 'عود وعنبر'), VENDOR);
  assert.equal(musicPrompt('   ', 'x'), '', 'an empty prompt never reaches the engine');
  assert.ok(musicPrompt('warm oud', 'ليل', 'عود').length <= 700);
  assert.equal(ttsText('```js\nx\n```\n**أهلاً** [بك](http://a.b) | c'), 'أهلاً بك c');
  assert.equal(ttsText('   '), '');
});

test('a recording is transcribed server-side and the words come back without a vendor name', async () => {
  await withServer({ GEMINI_API_KEY: 'k' }, async () => textEngine('أهلاً بيك'), async (base) => {
    const bad = await post(`${base}/transcribe`, {});
    assert.equal(bad.status, 400);
    assert.equal((await bad.json()).code, 'INVALID_AUDIO');
    const ok = await post(`${base}/transcribe`, { audio: `data:audio/webm;base64,${AUDIO_B64}` });
    assert.equal(ok.status, 200);
    const body = await ok.json();
    assert.equal(body.transcription, 'أهلاً بيك');
    assert.deepEqual(Object.keys(body), ['transcription'], 'nothing about the engine leaks');
  });
  // A model whose quota is spent falls through to the next one; when all are spent the page is told plainly.
  let attempts = 0;
  await withServer({ GEMINI_API_KEY: 'k' }, async () => { attempts += 1; return attempts === 1 ? reply({ error: { code: 429 } }, 429) : textEngine('تمام'); }, async (base) => {
    const r = await post(`${base}/transcribe`, { audio: AUDIO_B64, mimeType: 'audio/webm' });
    assert.equal(r.status, 200, 'the second model answers when the first is out of quota');
    assert.equal((await r.json()).transcription, 'تمام');
  });
  assert.equal(attempts, 2);
  let tries = 0;
  await withServer({ GEMINI_API_KEY: 'k' }, async () => { tries += 1; return reply({}, 429); }, async (base) => {
    const r = await post(`${base}/transcribe`, { audio: AUDIO_B64, mimeType: 'audio/webm' });
    assert.equal(r.status, 502);
    assert.equal((await r.json()).code, 'TRANSCRIBE_FAILED');
  });
  assert.equal(tries, TRANSCRIBE_MODELS.length, 'every model with its own quota is tried in turn');
  await withServer({}, async () => textEngine('x'), async (base) => {
    assert.equal((await post(`${base}/transcribe`, { audio: AUDIO_B64, mimeType: 'audio/webm' })).status, 503, 'no key: the feature is off, not broken');
  });
  await withServer({ GEMINI_API_KEY: 'k', SHAM_TRANSCRIBE: 'off' }, async () => textEngine('x'), async (base) => {
    assert.equal((await post(`${base}/transcribe`, { audio: AUDIO_B64, mimeType: 'audio/webm' })).status, 503);
  });
});

test('a recording the engine could not understand is told apart from an engine that failed', async () => {
  await withServer({ GEMINI_API_KEY: 'k' }, async () => textEngine('   '), async (base) => {
    const r = await post(`${base}/transcribe`, { audio: AUDIO_B64, mimeType: 'audio/webm' });
    assert.equal(r.status, 422);
    assert.equal((await r.json()).code, 'NO_SPEECH');
  });
});

test('music is generated on the studio route and a paid-only key is explained instead of retried', async () => {
  let sentPrompt = '';
  await withServer({ GEMINI_API_KEY: 'k' }, async (_url, init) => {
    const sent = JSON.parse(String(init?.body));
    sentPrompt = sent.contents[0].parts[0].text;
    return audioEngine();
  }, async (base) => {
    const r = await post(`${base}/music`, { prompt: 'warm oud', scentName: 'ليل', scentNotes: 'عود' });
    assert.equal(r.status, 200);
    const body = await r.json();
    assert.equal(body.mimeType, 'audio/wav');
    assert.equal(body.duration, '30s_clip');
    assert.doesNotMatch(JSON.stringify(body), VENDOR);
    assert.match(sentPrompt, /ليل/, 'the fragrance travels into the prompt');
    assert.equal((await post(`${base}/music`, { prompt: '  ' })).status, 400);
  });
  await withServer({ GEMINI_API_KEY: 'k' }, async () => reply({}, 403), async (base) => {
    const r = await post(`${base}/music`, { prompt: 'warm oud' });
    assert.equal(r.status, 402);
    assert.equal((await r.json()).code, 'PAID_KEY_REQUIRED', 'the page then plays its own harmonics instead of hanging');
  });
  await withServer({ GEMINI_API_KEY: 'k', SHAM_MUSIC: 'off' }, async () => audioEngine(), async (base) => {
    assert.equal((await post(`${base}/music`, { prompt: 'x' })).status, 503);
  });
});

test('studio speech uses the same human voice as the rest of the site', async () => {
  await withServer({ GEMINI_API_KEY: 'k' }, async () => audioEngine(), async (base) => {
    const r = await post(`${base}/tts`, { text: '**أهلاً** بيك في دار شام', language: 'ar', gender: 'female' });
    assert.equal(r.status, 200);
    const body = await r.json();
    assert.equal(body.mimeType, 'audio/wav');
    assert.equal(Buffer.from(body.audioBase64, 'base64').subarray(0, 4).toString('ascii'), 'RIFF', 'a WAV every browser plays');
    assert.doesNotMatch(JSON.stringify(body), VENDOR);
    assert.equal((await post(`${base}/tts`, { text: '   ' })).status, 400);
  });
  await withServer({}, async () => audioEngine(), async (base) => {
    assert.equal((await post(`${base}/tts`, { text: 'hello' })).status, 503, 'no key: off, never a paid fallback');
  });
  // The status the studio buttons read: which of the three are available right now.
  await withServer({ GEMINI_API_KEY: 'k' }, async () => audioEngine(), async (base) => {
    const status = await (await fetch(`${base}/voice/status`)).json();
    assert.deepEqual(status, { transcribe: true, music: true, speech: true });
    assert.doesNotMatch(JSON.stringify(status), VENDOR);
  });
  assert.ok(MUSIC_DAILY_LIMIT > 0);
});
