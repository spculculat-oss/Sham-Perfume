import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import { readAloud } from '../src/utils/readAloud';

function nativeReader(t: TestContext) {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  class Utterance {
    constructor(public text: string) {}
    onend: (() => void) | null = null;
    onerror: (() => void) | null = null;
  }
  const queue: Utterance[] = [];
  let cancelled = 0;
  const synth = { getVoices: () => [{ name: 'Arabic', lang: 'ar-EG', localService: true, default: true }],
    speak: (utterance: Utterance) => { queue.push(utterance); }, cancel: () => { cancelled++; },
  };
  const descriptors = ['window', 'localStorage'].map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const);
  Object.defineProperties(globalThis, {
    window: { configurable: true, value: { speechSynthesis: synth, SpeechSynthesisUtterance: Utterance } },
    localStorage: { configurable: true, value: { getItem: () => null } },
  });
  const stops: (() => void)[] = [];
  t.after(() => { stops.forEach((stop) => stop()); for (const [key, value] of descriptors) { if (value) Object.defineProperty(globalThis, key, value); else Reflect.deleteProperty(globalThis, key); } });
  let ended = 0; let failed = 0;
  const start = (onEnd?: () => void) => {
    const stop = readAloud(('أهلا بكم في منصة شام، نرحب بكم معنا اليوم. ').repeat(16), { language: 'ar',
      onEnd: () => { ended++; onEnd?.(); }, onNoVoice: () => failed++,
    }); stops.push(stop); return stop;
  };
  return { queue, synth, start, counts: () => ({ ended, failed, cancelled }) };
}

test('native read-aloud ignores duplicate completion/errors from an earlier chunk', (t) => {
  const f = nativeReader(t); const stop = f.start(); const first = f.queue[0];
  first.onend?.(); assert.equal(f.queue.length, 2);
  first.onend?.(); first.onerror?.(); assert.equal(f.queue.length, 2);
  assert.equal(f.counts().ended, 0); assert.equal(f.counts().failed, 0);
  stop(); assert.equal(f.counts().ended, 1);
});

test('native reader timeout cancels its own queue before notifying completion', (t) => {
  const f = nativeReader(t); let cancelsAtCompletion = 0;
  f.start(() => { cancelsAtCompletion = f.counts().cancelled; });
  t.mock.timers.tick(120000);
  assert.equal(cancelsAtCompletion, 2); // initial cancel, then timeout cancel
  assert.equal(f.counts().ended, 1); assert.equal(f.counts().failed, 1);
});

test('a late callback and a second stop cannot end/cancel the next read-aloud', (t) => {
  const f = nativeReader(t); const oldStop = f.start(); const old = f.queue[0];
  oldStop(); const cancelsBefore = f.counts().cancelled;
  oldStop(); old.onend?.(); old.onerror?.();
  assert.equal(f.counts().cancelled, cancelsBefore);
  assert.equal(f.counts().ended, 1); assert.equal(f.counts().failed, 0);
});

test('native synthesis throwing reports a failure and settles once', (t) => {
  const f = nativeReader(t); f.synth.speak = () => { throw new Error('Voice unavailable'); };
  f.start(); assert.equal(f.counts().ended, 1); assert.equal(f.counts().failed, 1);
});
