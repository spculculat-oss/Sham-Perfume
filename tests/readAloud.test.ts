import assert from 'node:assert/strict';
import test from 'node:test';
import { readAloud } from '../src/utils/readAloud';
import { humanVoiceAvailable } from '../src/utils/humanVoice';

/** A browser with audio (each file «plays» and ends at once) and a stubbed voice server. */
class FakeAudio {
  static played: string[] = [];
  src = ''; preload = ''; playbackRate = 1; duration = 1; paused = true;
  onplaying: (() => void) | null = null; onended: (() => void) | null = null; onerror: (() => void) | null = null; onloadedmetadata: (() => void) | null = null;
  play() {
    if (!this.src.startsWith('data:')) FakeAudio.played.push(this.src);
    const src = this.src;
    setTimeout(() => { if (this.src !== src) return; this.onloadedmetadata?.(); this.onplaying?.(); this.onended?.(); }, 1);
    return Promise.resolve();
  }
  pause() {}
}
function browser(t: import('node:test').TestContext, server: (body: Record<string, unknown>) => Response) {
  const g = globalThis as Record<string, unknown>;
  const saved = ['window', 'localStorage', 'Audio', 'fetch'].map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const);
  const asked: Record<string, unknown>[] = [];
  Object.defineProperties(globalThis, {
    window: { configurable: true, value: { localStorage: { getItem: () => null, setItem: () => undefined } } },
    localStorage: { configurable: true, value: { getItem: () => null, setItem: () => undefined } },
    Audio: { configurable: true, writable: true, value: FakeAudio },
    fetch: { configurable: true, writable: true, value: async (url: string, init?: RequestInit) => {
      if (String(url).endsWith('/api/voice/say-words')) return new Response('{"words":{}}', { headers: { 'Content-Type': 'application/json' } });
      const body = JSON.parse(String(init?.body || '{}')) as Record<string, unknown>;
      asked.push(body);
      return server(body);
    } },
  });
  FakeAudio.played = [];
  t.after(() => { for (const [key, value] of saved) { if (value) Object.defineProperty(globalThis, key, value); else Reflect.deleteProperty(g, key); } });
  return asked;
}
const read = (text: string) => new Promise<{ failed: boolean }>((resolve) => {
  let failed = false;
  readAloud(text, { language: 'ar', dialect: 'egyptian', onNoVoice: () => { failed = true; }, onEnd: () => resolve({ failed }) });
});

test('read-aloud: no audio in this browser → told once, the written reply stays (never a robotic voice)', async () => {
  let ended = 0; let failed = 0;
  readAloud('أهلاً بيك', { language: 'ar', onEnd: () => ended++, onNoVoice: () => failed++ });
  await new Promise((r) => setTimeout(r, 5));
  assert.equal(ended, 1); assert.equal(failed, 1);
});

test('read-aloud: a recorded sentence plays from the site in the chosen voice, without asking the server', async (t) => {
  const asked = browser(t, () => new Response('no', { status: 500 }));
  const out = await read('تحب أكمّلك الباقي؟');
  assert.equal(out.failed, false);
  assert.equal(asked.length, 0);
  assert.deepEqual(FakeAudio.played, ['/voice-clips/male/more.mp3']);
});

test('read-aloud: other sentences in the server’s human voice; a busy server is reported, not replaced by the device', async (t) => {
  const asked = browser(t, () => new Response(new Blob([new Uint8Array(400)], { type: 'audio/wav' }), { headers: { 'Content-Type': 'audio/wav' } }));
  const ok = await read('العطر ده فيه عود وورد. ريحته بتدوم طول اليوم.');
  assert.equal(ok.failed, false);
  assert.equal(asked.length, 1, 'short sentences are said in one go');
  assert.equal(asked[0]!.gender, 'male');
  assert.equal(asked[0]!.dialect, 'egyptian');
  assert.equal(FakeAudio.played.length, 1);
  assert.match(FakeAudio.played[0]!, /^blob:/);
  const busy = browser(t, () => new Response('{"code":"voice_busy"}', { status: 503, headers: { 'Content-Type': 'application/json' } }));
  const out = await read('العطر ده فيه عود وورد.');
  assert.equal(out.failed, true);
  assert.equal(busy.length, 1);
  assert.equal(humanVoiceAvailable(), false, 'after «busy» the server rests a while');
});

test('read-aloud: a one-off failure is asked again (it never silences him for minutes); only «busy» / «off» rests the voice', async (t) => {
  const { restFor } = await import('../src/utils/humanVoice');
  assert.equal(restFor({ status: 503, code: 'voice_failed' }), 0);
  assert.equal(restFor({ status: 500, code: '' }), 0);
  assert.ok(restFor({ status: 503, code: 'voice_busy' }) >= 60_000);
  assert.ok(restFor({ status: 503, code: 'voice_off' }) >= 60_000);
  assert.equal(restFor({ status: 429, code: 'rate_limited' }), 20_000);
  const { playHumanSpeech, unlockHumanVoice } = await import('../src/utils/humanVoice');
  let calls = 0;
  browser(t, () => (++calls === 1
    ? new Response('{"code":"voice_failed"}', { status: 503, headers: { 'Content-Type': 'application/json' } })
    : new Response(new Blob([new Uint8Array(400)], { type: 'audio/wav' }), { headers: { 'Content-Type': 'audio/wav' } })));
  assert.equal(humanVoiceAvailable(), false, 'still resting after the «busy» above');
  unlockHumanVoice();
  assert.equal(humanVoiceAvailable(), true, 'his own tap on the voice button gives it a fresh try');
  const out = await new Promise<string>((resolve) => {
    playHumanSpeech(['العطر ده فيه عود.'], { language: 'ar', gender: 'male', onEnd: () => resolve('end'), onError: () => resolve('error') });
  });
  assert.equal(out, 'end');
  assert.equal(calls, 2, 'asked once more after the glitch');
});

test('read-aloud: «busy for a few seconds» is waited, not cut; a long rest follows the time the server gave', async (t) => {
  const { restFor, unlockHumanVoice, playHumanSpeech, SHORT_WAIT_MS } = await import('../src/utils/humanVoice');
  assert.equal(restFor({ status: 503, code: 'voice_busy', retryMs: 3 * 3600_000 }), 3600_000, 'capped at an hour, then tried again');
  assert.ok(SHORT_WAIT_MS >= 10_000);
  let calls = 0;
  browser(t, () => (++calls === 1
    ? new Response('{"code":"voice_busy"}', { status: 503, headers: { 'Content-Type': 'application/json', 'Retry-After': '1' } })
    : new Response(new Blob([new Uint8Array(400)], { type: 'audio/wav' }), { headers: { 'Content-Type': 'audio/wav' } })));
  unlockHumanVoice();
  const out = await new Promise<string>((resolve) => {
    playHumanSpeech(['العطر ده فيه عود.'], { language: 'ar', gender: 'male', onEnd: () => resolve('end'), onError: () => resolve('error') });
  });
  assert.equal(out, 'end', 'he waited a second and went on');
  assert.equal(calls, 2);
});

test('read-aloud: a reply can be held exactly where it is and go on from there (he stops to listen, the sentence is kept)', async (t) => {
  const { unlockHumanVoice, playHumanSpeech } = await import('../src/utils/humanVoice');
  browser(t, () => new Response(new Blob([new Uint8Array(400)], { type: 'audio/wav' }), { headers: { 'Content-Type': 'audio/wav' } }));
  unlockHumanVoice();
  let ended = false;
  const handle = playHumanSpeech(['جملة أولى. جملة تانية.'], { language: 'ar', gender: 'male', onEnd: () => { ended = true; }, onError: () => { ended = true; } });
  handle.pause();
  assert.equal(handle.paused, true);
  await new Promise((r) => setTimeout(r, 40));
  assert.equal(ended, false, 'held, not finished or dropped');
  handle.duck(true);
  handle.resume();
  assert.equal(handle.paused, false);
  await new Promise((r) => setTimeout(r, 40));
  assert.equal(ended, true, 'went on to the end');
});
