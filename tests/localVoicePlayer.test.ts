import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import { setImmediate as nextTurn } from 'node:timers/promises';
import { playLocalVoice } from '../src/utils/localVoicePlayer';

function setup(t: TestContext) {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const workers: FakeWorker[] = [];
  const nodes: FakeSource[] = [];
  let decode: () => Promise<{ duration: number }> = async () => ({ duration: 1 });
  let resume: () => Promise<void> = async () => undefined;
  let ends = 0; let errors = 0;
  const chunks: number[] = [];
  class FakeWorker {
    onmessage: ((event: { data: { audio?: ArrayBuffer } }) => void) | null = null;
    onerror: (() => void) | null = null;
    onmessageerror: (() => void) | null = null;
    terminated = false;
    posts: { text: string }[] = [];
    constructor() { workers.push(this); }
    postMessage(data: { text: string }) { this.posts.push(data); }
    terminate() { this.terminated = true; }
    reply() { this.onmessage?.({ data: { audio: new ArrayBuffer(80) } }); }
  }
  class FakeSource {
    buffer: unknown;
    onended: (() => void) | null = null;
    started = false; stopped = false; disconnected = false;
    constructor() { nodes.push(this); }
    connect() { /* Fake destination. */ }
    disconnect() { this.disconnected = true; }
    start() { this.started = true; }
    stop() { this.stopped = true; }
    end() { this.onended?.(); }
  }
  const audio = { state: 'running', destination: {}, resume: () => resume(), decodeAudioData: () => decode(), createBufferSource: () => new FakeSource() };
  const saved = ['window', 'AudioContext', 'Worker'].map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const);
  Object.defineProperties(globalThis, {
    window: { configurable: true, value: { location: { origin: 'https://voice.test' } } },
    AudioContext: { configurable: true, value: function () { return audio; } },
    Worker: { configurable: true, value: FakeWorker },
  });
  const stops: (() => void)[] = [];
  t.after(() => {
    stops.forEach((stop) => stop()); audio.state = 'closed';
    for (const [key, descriptor] of saved) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key); }
  });
  const start = (text = ['مرحبا', 'كيف الحال'], onChunk?: () => void) => {
    const stop = playLocalVoice(text, { name: 'sham-local:ar:m1', language: 'ar', rate: 1, pitch: 1,
      onChunk: (_, index) => { chunks.push(index); onChunk?.(); }, onEnd: () => ends++, onError: () => errors++,
    });
    stops.push(stop); return stop;
  };
  return { workers, nodes, chunks, audio, start, counts: () => ({ ends, errors }),
    setDecode: (fn: typeof decode) => { decode = fn; }, setResume: (fn: typeof resume) => { resume = fn; },
  };
}

test('local player plays each chunk once, snapshots its queue and ignores stale ended events', async (t) => {
  const f = setup(t); const queue = ['مرحبا', 'كيف الحال']; f.start(queue); queue[1] = 'mutated';
  f.workers[0].reply(); await nextTurn();
  const stale = f.nodes[0].onended!;
  f.nodes[0].end(); await nextTurn();
  assert.equal(f.workers[0].posts[1].text, 'كيف الحال');
  f.workers[0].reply(); await nextTurn(); stale(); await nextTurn();
  assert.equal(f.nodes[1].disconnected, false);
  f.nodes[1].end(); await nextTurn();
  assert.deepEqual(f.chunks, [0, 1]); assert.deepEqual(f.counts(), { ends: 1, errors: 0 });
  assert.ok(f.workers[0].terminated);
});

test('cancel while loading terminates the worker and ignores late data without callbacks', async (t) => {
  const f = setup(t); const stop = f.start(); const stale = f.workers[0].onmessage!;
  stop(); stale({ data: { audio: new ArrayBuffer(80) } }); await nextTurn();
  assert.ok(f.workers[0].terminated); assert.equal(f.nodes.length, 0);
  assert.deepEqual(f.counts(), { ends: 0, errors: 0 });
});

test('cancel during decoding prevents late decoded audio from starting', async (t) => {
  const f = setup(t); let decoded!: (value: { duration: number }) => void;
  f.setDecode(() => new Promise((resolve) => { decoded = resolve; }));
  const stop = f.start(); f.workers[0].reply(); await nextTurn(); stop(); decoded({ duration: 1 }); await nextTurn();
  assert.equal(f.nodes.length, 0); assert.deepEqual(f.counts(), { ends: 0, errors: 0 });
});

test('cancel synchronously from onChunk stops the source and leaves no timeout callbacks', async (t) => {
  const f = setup(t); const stop = f.start(undefined, () => stop());
  f.workers[0].reply(); await nextTurn(); t.mock.timers.tick(120000); await nextTurn();
  assert.ok(f.nodes[0].stopped); assert.ok(f.nodes[0].disconnected);
  assert.deepEqual(f.counts(), { ends: 0, errors: 0 }); assert.equal(f.workers[0].posts.length, 1);
});

for (const event of ['onerror', 'onmessageerror'] as const) test(`worker ${event} reports one failure and cleans up`, async (t) => {
  const f = setup(t); f.start(); f.workers[0][event]?.(); await nextTurn(); t.mock.timers.tick(120000); await nextTurn();
  assert.deepEqual(f.counts(), { ends: 0, errors: 1 }); assert.ok(f.workers[0].terminated);
});

test('a synthesis timeout does not leave a speaking session alive', async (t) => {
  const f = setup(t); f.start(); t.mock.timers.tick(45000); await nextTurn();
  assert.deepEqual(f.counts(), { ends: 0, errors: 1 }); assert.ok(f.workers[0].terminated);
});

test('a decoder that never settles times out and releases the speech worker', async (t) => {
  const f = setup(t); f.setDecode(() => new Promise(() => undefined)); f.start(); f.workers[0].reply(); await nextTurn();
  t.mock.timers.tick(10000); await nextTurn();
  assert.deepEqual(f.counts(), { ends: 0, errors: 1 }); assert.ok(f.workers[0].terminated);
});

test('corrupt audio fails exactly once without starting a source', async (t) => {
  const f = setup(t); f.setDecode(async () => { throw new Error('Bad WAV'); }); f.start(); f.workers[0].reply(); await nextTurn();
  assert.equal(f.nodes.length, 0); assert.deepEqual(f.counts(), { ends: 0, errors: 1 });
});

test('suspended mobile audio is resumed after loading before playback starts', async (t) => {
  const f = setup(t); let attempts = 0; f.audio.state = 'suspended';
  f.setResume(async () => { if (++attempts >= 2) f.audio.state = 'running'; });
  f.start(['مرحبا']); f.workers[0].reply(); await nextTurn();
  assert.equal(attempts, 2); assert.ok(f.nodes[0].started); f.nodes[0].end(); await nextTurn();
  assert.deepEqual(f.counts(), { ends: 1, errors: 0 });
});

test('an autoplay-blocked resume that never resolves is bounded', async (t) => {
  const f = setup(t); f.audio.state = 'suspended'; f.setResume(() => new Promise(() => undefined));
  f.start(); f.workers[0].reply(); await nextTurn(); t.mock.timers.tick(10000); await nextTurn();
  assert.deepEqual(f.counts(), { ends: 0, errors: 1 }); assert.equal(f.nodes.length, 0);
});

test('a missing audio-ended event times out and stops its source', async (t) => {
  const f = setup(t); f.start(); f.workers[0].reply(); await nextTurn(); t.mock.timers.tick(11000); await nextTurn();
  assert.ok(f.nodes[0].stopped); assert.deepEqual(f.counts(), { ends: 0, errors: 1 });
});

test('invalid or empty chunks are rejected before opening an audio context or worker', async (t) => {
  const f = setup(t); f.start(['']); await nextTurn(); assert.equal(f.workers.length, 0);
  assert.deepEqual(f.counts(), { ends: 0, errors: 1 });
});
