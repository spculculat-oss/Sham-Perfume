import assert from 'node:assert/strict';
import test from 'node:test';
import { existsSync, statSync } from 'node:fs';
import { CLIP_GENDERS, HUMAN_CLIPS, clipGender, humanClipId, humanClipUrl, playHumanClip, type HumanClipId } from '../src/utils/humanVoiceClips';
import { askDoneLine, patienceLine } from '../src/utils/turnTaking';
import { lookupFiller, repeatLine } from '../src/utils/heardFix';

test('the recorded human lines are exactly the lines Shaheen speaks (Egyptian)', () => {
  assert.equal(humanClipId(askDoneLine('ar', 'egyptian')), 'ask-done');
  assert.equal(humanClipId(patienceLine('ar', 'egyptian')), 'patience');
  assert.equal(humanClipId(lookupFiller('ar', 'egyptian')), 'lookup');
  assert.equal(humanClipId(repeatLine('ar', 'egyptian')), 'repeat');
  assert.equal(humanClipId(askDoneLine('ar')), 'ask-done', 'Egyptian is the default dialect');
});

test('a clip plays only for the whole line, never for other words or languages', () => {
  assert.equal(humanClipId('  خلصت   ولا لسه ؟ '), 'ask-done', 'spacing and punctuation do not matter');
  assert.equal(humanClipId('خلصت ولا لسه؟ وكمان سؤال'), undefined);
  assert.equal(humanClipId(askDoneLine('en')), undefined);
  assert.equal(humanClipId(patienceLine('ar', 'gulf')), undefined, 'another dialect keeps the device voice');
  assert.equal(humanClipId(''), undefined);
});

test('every clip exists for both voices, small enough for any phone', () => {
  for (const gender of CLIP_GENDERS) {
    for (const id of Object.keys(HUMAN_CLIPS) as HumanClipId[]) {
      const path = `public/voice-clips/${gender}/${id}.mp3`;
      assert.ok(existsSync(path), path);
      const size = statSync(path).size;
      assert.ok(size > 2_000 && size < 60_000, `${path}: ${size} bytes`);
    }
  }
});

test('the voice follows the visitor: his gender choice, then his voice, then Shaheen’s own', () => {
  assert.equal(clipGender('female', 'male'), 'female');
  assert.equal(clipGender(undefined, 'female'), 'female');
  assert.equal(clipGender(), 'male');
  assert.equal(humanClipUrl('patience', 'female', '/Sham-Perfume/'), '/Sham-Perfume/voice-clips/female/patience.mp3');
  assert.equal(humanClipUrl('repeat', 'male', '/'), '/voice-clips/male/repeat.mp3');
});

test('a clip that cannot play reports an error (the device voice takes over), never hangs', async () => {
  const failed = await new Promise<boolean>((resolve) => { playHumanClip('/voice-clips/male/patience.mp3', { onEnd: () => resolve(false), onError: () => resolve(true) }); });
  assert.equal(failed, true, 'no Audio in node → error, not silence');
  const g = globalThis as { Audio?: unknown };
  class FakeAudio { preload = ''; playbackRate = 1; onplaying: (() => void) | null = null; onended: (() => void) | null = null; onerror: (() => void) | null = null;
    constructor(public src: string) {} play() { setTimeout(() => { this.onplaying?.(); this.onended?.(); }, 1); return Promise.resolve(); } pause() {} }
  g.Audio = FakeAudio;
  try {
    let started = false;
    const ok = await new Promise<boolean>((resolve) => { playHumanClip('/x.mp3', { rate: 3, onStart: () => { started = true; }, onEnd: () => resolve(true), onError: () => resolve(false) }); });
    assert.ok(ok && started);
  } finally { delete g.Audio; }
});
