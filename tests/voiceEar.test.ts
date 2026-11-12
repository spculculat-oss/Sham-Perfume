import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import { activeVoicePrint, bargeDecision, deleteVoicePrint, EAR_AUDIO, judgeBurst, otherVoice, savedVoicePrint, saveVoicePrint,
  setVoicePrintOn, VoiceGate, type Burst } from '../src/utils/voiceEar';
import { BAND_CENTRES, type VoiceFrame, type VoicePrint } from '../src/utils/voicePrint';

const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
let saved: Map<string, string>;
beforeEach(() => {
  saved = new Map();
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: (key: string) => saved.get(key) ?? null, setItem: (key: string, value: string) => saved.set(key, value), removeItem: (key: string) => saved.delete(key),
  } });
});
afterEach(() => {
  if (original) Object.defineProperty(globalThis, 'localStorage', original);
  else delete (globalThis as { localStorage?: unknown }).localStorage;
});

const flat = BAND_CENTRES.map(() => 0);
const shape = (tilt: number) => BAND_CENTRES.map((_, i) => tilt * (i - 7.5) / 7.5 + Math.sin(i * tilt));
const quiet = (): VoiceFrame => ({ rms: 0.003, bands: flat });
const vowel = (f0 = 120, bands = shape(1)): VoiceFrame => ({ rms: 0.08, f0, bands });
const knock = (): VoiceFrame => ({ rms: 0.2, bands: flat });
const me: VoicePrint = { v: 1, bands: shape(1), f0: 120, spread: 1.15, frames: 80 };

/** Feeds slices 40 ms apart; returns the events with their times. */
function run(gate: VoiceGate, frames: VoiceFrame[], speaking = false, from = 0) {
  return frames.map((frame, i) => ({ t: from + i * 40, event: gate.push({ t: from + i * 40, frame }, speaking) })).filter((x) => x.event);
}

test('a voice starting is noticed within 80 ms; it ends after a short quiet', () => {
  const gate = new VoiceGate();
  const events = run(gate, [...Array(20).fill(0).map(quiet), ...Array(15).fill(0).map(() => vowel()), ...Array(10).fill(0).map(quiet)]);
  assert.equal(events[0]!.event!.type, 'start');
  assert.equal(events[0]!.t - 20 * 40, 40, 'the second loud slice (80 ms of voice)');
  const end = events[1]!.event!;
  assert.equal(end.type, 'end');
  if (end.type === 'end') { assert.ok(end.burst.voicedMs >= 500); assert.equal(judgeBurst(end.burst, true), 'speech'); }
});

test('the room\'s steady noise becomes the floor; Shaheen\'s own voice from the speakers does not cut him off', () => {
  const gate = new VoiceGate();
  // A fan: steady 0.01 for two seconds is the room, not a voice.
  assert.equal(run(gate, Array(50).fill(0).map(() => ({ rms: 0.01, bands: flat }))).length, 0);
  // While he speaks, his own voice comes back at ~0.05: learned first, then never a «start».
  gate.startSpeaking();
  for (let i = 0; i < 11; i += 1) gate.learnEcho(0.03 + 0.02 * Math.abs(Math.sin(i)));
  assert.equal(run(gate, Array(40).fill(0).map((_, i) => ({ rms: 0.03 + 0.02 * Math.abs(Math.sin(i)), f0: 150, bands: flat })), true).length, 0);
  // The visitor talking louder over it is noticed.
  assert.equal(run(gate, Array(3).fill(0).map(() => vowel()), true, 2000)[0]?.event?.type, 'start');
});

test('what a sound heard while he talks is: speech stops him, a knock or a cough lets him go on', () => {
  const burst = (frames: VoiceFrame[]): Burst => ({ ms: frames.length * 40, voicedMs: frames.filter((f) => f.f0).length * 40, frames });
  assert.equal(judgeBurst(burst(Array(8).fill(0).map(() => vowel())), false), 'speech');
  assert.equal(judgeBurst(burst([knock(), knock(), knock()]), true), 'noise', 'a knock: short, no voice');
  assert.equal(judgeBurst(burst([knock(), knock()]), false), 'wait');
  assert.equal(judgeBurst(burst(Array(31).fill(0).map(knock)), false), 'noise', 'a long hum with no voice');
  // Without a print, a real voice interrupts at once; with one, a clear «not him» is ignored, doubt counts as him.
  const talk = burst(Array(8).fill(0).map(() => vowel()));
  assert.equal(bargeDecision(talk, false, undefined, 300), 'interrupt');
  assert.equal(bargeDecision(burst([knock(), knock(), knock()]), true, undefined, 200), 'resume');
  const tv = burst(Array(24).fill(0).map(() => vowel(230, shape(-1.3))));
  assert.equal(bargeDecision(tv, false, me, 900), 'ignore');
  assert.equal(bargeDecision(burst(Array(24).fill(0).map(() => vowel(122))), false, me, 900), 'interrupt');
  assert.equal(bargeDecision(talk, false, me, 300), 'wait', 'too little voice to judge yet: he stays quiet and listens on');
  assert.equal(bargeDecision(burst(Array(30).fill(0).map(() => vowel())), false, me, 1200), 'interrupt');
  assert.equal(otherVoice(me, Array(30).fill(0).map(() => vowel(230, shape(-1.3)))), true);
  assert.equal(otherVoice(me, Array(10).fill(0).map(() => vowel(230, shape(-1.3)))), false, 'a short sentence is never thrown away');
  assert.equal(otherVoice(undefined, Array(30).fill(0).map(() => vowel(230))), false);
});

test('the print stays in this browser: saved, switched off, deleted with one tap', () => {
  assert.deepEqual(EAR_AUDIO, { echoCancellation: true, noiseSuppression: true, autoGainControl: true });
  assert.equal(savedVoicePrint(), undefined);
  saveVoicePrint(me);
  assert.equal(savedVoicePrint()?.f0, 120);
  assert.equal(activeVoicePrint()?.f0, 120);
  setVoicePrintOn(false);
  assert.equal(activeVoicePrint(), undefined);
  assert.ok(savedVoicePrint(), 'off is not deleted');
  deleteVoicePrint();
  assert.equal(savedVoicePrint(), undefined);
  assert.equal(saved.size, 0, 'nothing left behind');
  saved.set('sham_voice_print_v1', '{"v":1,"bands":[1],"f0":5}');
  assert.equal(savedVoicePrint(), undefined, 'a broken print is not used');
});

test('nothing of the voice leaves the browser', async () => {
  const { readFileSync } = await import('node:fs');
  for (const file of ['../src/utils/voiceEar.ts', '../src/utils/voicePrint.ts']) {
    const source = readFileSync(new URL(file, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /MediaRecorder|fetch\(|sendBeacon|XMLHttpRequest|requestApi|WebSocket/, file);
  }
});
