import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SHAHIN_SIGNATURE, MOTION_SECONDS, motionFrame, videoMime, signCanvas, wantsMotion, recordMotion } from '../src/workspace/motion';
import { MotionCard } from '../src/workspace/MotionCard';
import { imageRequest, stripImageRequest } from '../src/workspace/codeBlocks';
import { workspaceInstruction } from '../server/workspace';
import { WS_STRINGS } from '../src/workspace/strings';

const ctx = () => ({ save() {}, restore() {}, translate() {}, scale() {}, clearRect() {}, drawImage() {}, strokeText() {}, fillText() {} }) as unknown as CanvasRenderingContext2D;

test('local animation pans/zooms continuously within canvas coverage and clamps invalid progress', () => {
  assert.equal(MOTION_SECONDS, 6);
  assert.notDeepEqual(motionFrame(0), motionFrame(1));
  assert.deepEqual(motionFrame(-5), motionFrame(0));
  assert.deepEqual(motionFrame(Infinity), motionFrame(0));
  assert.deepEqual(motionFrame(2), motionFrame(1));
  for (let i = 0; i <= 100; i++) {
    const frame = motionFrame(i / 100);
    assert.ok((frame.zoom - 1) / 2 >= Math.abs(frame.x));
    assert.ok((frame.zoom - 1) / 2 >= Math.abs(frame.y));
  }
});

test('signature is exactly the requested sharin ai, independent of any model/vendor name', () => {
  const calls: string[] = [];
  const context = ctx();
  context.fillText = (text) => { calls.push(text); };
  context.strokeText = (text) => { calls.push(text); };
  signCanvas(context, 1024, 768);
  assert.equal(SHAHIN_SIGNATURE, 'sharin ai');
  assert.deepEqual(calls, ['sharin ai', 'sharin ai']);
});

test('video MIME is chosen only from actual browser support; never rename WebM as MP4', () => {
  assert.equal(videoMime((mime) => mime === 'video/mp4'), 'video/mp4');
  assert.equal(videoMime((mime) => mime === 'video/webm'), 'video/webm');
  assert.equal(videoMime(() => false), undefined);
});

test('explicit motion requests work in Arabic/English without treating all video discussions as creation requests', () => {
  for (const text of ['اعملي فيديو متحرك لعطر', 'اعمل فيديو متحرك', 'حرك الصورة دي', 'حرّك الصورة', 'animate this image', 'Create an animated video']) assert.ok(wantsMotion(text), text);
  for (const text of ['What is video compression?', 'اشرح الفيديو ده', 'image of perfume']) assert.equal(wantsMotion(text), false, text);
});

test('video image instructions are hidden from prose, and still yield a real base image request', () => {
  const reply = 'Camera motion, not scene generation.\n```sham-video\nA luxury perfume bottle in warm light\n```';
  assert.equal(imageRequest(reply), 'A luxury perfume bottle in warm light');
  assert.equal(stripImageRequest(reply), 'Camera motion, not scene generation.');
  const instruction = workspaceInstruction('ar');
  assert.match(instruction, /sham-video/);
  assert.match(instruction, /مش توليد فيديو/);
  assert.match(instruction, /sharin ai/);
  assert.match(instruction, /لا تمح/);
});

test('motion controls disclose the actual limitations and translations cover every primary site language', () => {
  const html = renderToStaticMarkup(createElement(MotionCard, { src: 'data:image/png;base64,abc', lang: 'en' }));
  assert.match(html, /Not generative video/);
  assert.match(html, /Create motion clip/);
  assert.match(html, /disabled/); // not enabled before image successfully loads
  for (const key of ['motion_create', 'motion_download', 'motion_note', 'motion_recording', 'motion_unsupported', 'motion_failed', 'signed_image', 'motion_ready'] as const) {
    for (const lang of ['ar', 'en', 'fr', 'es', 'it', 'de', 'ru', 'zh', 'tr', 'fa'] as const) assert.ok(WS_STRINGS[key][lang]);
  }
});

test('unsupported recorder and already-aborted request cannot create a successful file', async () => {
  await assert.rejects(recordMotion({} as HTMLCanvasElement, new AbortController().signal), /VIDEO_UNSUPPORTED/);
  const controller = new AbortController(); controller.abort();
  await assert.rejects(recordMotion({} as HTMLCanvasElement, controller.signal), { name: 'AbortError' });
});

test('recording lifecycle gathers actual recorder data, draws frames, and closes tracks and timers', async (t) => {
  t.mock.timers.enable({ apis: ['setInterval', 'setTimeout'] });
  const savedDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const savedRecorder = Object.getOwnPropertyDescriptor(globalThis, 'MediaRecorder');
  let tracksStopped = 0; let draws = 0; let canvasProbes = 0;
  const stream = { getTracks: () => [{ stop: () => { tracksStopped++; } }] };
  const context = ctx(); context.drawImage = () => { draws++; };
  const canvas = { width: 0, height: 0, getContext: () => context, toDataURL: () => { canvasProbes++; return 'data:image/png;base64,test'; }, captureStream: () => stream };
  class Recorder {
    static isTypeSupported(mime: string) { return mime === 'video/webm'; }
    state = 'inactive'; mimeType = 'video/webm';
    ondataavailable?: (event: { data: Blob }) => void; onstop?: () => void; onerror?: () => void;
    start() { this.state = 'recording'; }
    stop() { this.state = 'inactive'; this.ondataavailable?.({ data: new Blob(['real-recorder-chunk']) }); this.onstop?.(); }
  }
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { createElement: () => canvas } });
  Object.defineProperty(globalThis, 'MediaRecorder', { configurable: true, value: Recorder });
  try {
    const controller = new AbortController();
    const recording = recordMotion({ width: 1024, height: 768, captureStream() {} } as unknown as HTMLCanvasElement, controller.signal);
    t.mock.timers.tick(6000);
    const blob = await recording;
    assert.equal(blob.type, 'video/webm');
    assert.equal(await blob.text(), 'real-recorder-chunk');
    assert.ok(draws > 1); assert.equal(canvasProbes, 1); assert.equal(tracksStopped, 1);
    const cancel = new AbortController();
    const cancelled = recordMotion({ width: 800, height: 800, captureStream() {} } as unknown as HTMLCanvasElement, cancel.signal);
    cancel.abort(); await assert.rejects(cancelled, { name: 'AbortError' });
    assert.equal(tracksStopped, 2);
    t.mock.timers.tick(20000); // no dangling callbacks after stop/cancel
  } finally {
    if (savedDocument) Object.defineProperty(globalThis, 'document', savedDocument); else delete (globalThis as any).document;
    if (savedRecorder) Object.defineProperty(globalThis, 'MediaRecorder', savedRecorder); else delete (globalThis as any).MediaRecorder;
    t.mock.timers.reset();
  }
});
