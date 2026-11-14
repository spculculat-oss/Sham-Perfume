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
