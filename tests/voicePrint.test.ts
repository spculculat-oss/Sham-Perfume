import assert from 'node:assert/strict';
import { test } from 'node:test';
import { adaptPrint, BAND_CENTRES, ENROL_SENTENCES, enrolPrint, frameFeatures, isVoicePrint, matchScore, pitchOf, samePerson, summarize, type VoiceFrame } from '../src/utils/voicePrint';

// Synthetic voices: a pitch with its harmonics, shaped by three formants (where a voice's vowels put their energy).
const SR = 48000; const N = 2048;
function voice(f0: number, formants: number[], frames: number, seed = 7): VoiceFrame[] {
  let s = seed; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const out: VoiceFrame[] = [];
  for (let f = 0; f < frames; f += 1) {
    const pitch = f0 * (1 + 0.04 * Math.sin(f / 3) + (rnd() - 0.5) * 0.02);
    const samples = new Float32Array(N);
    for (let h = 1; pitch * h < 5000; h += 1) {
      const fr = pitch * h;
      const amp = formants.reduce((a, F) => a + Math.exp(-(((fr - F) / 150) ** 2)), 0.02) / Math.sqrt(h);
      const phase = rnd() * 2 * Math.PI;
      for (let i = 0; i < N; i += 1) samples[i] += 0.05 * amp * Math.sin((2 * Math.PI * fr * i) / SR + phase);
    }
    for (let i = 0; i < N; i += 1) samples[i] += (rnd() - 0.5) * 0.002;
    out.push(frameFeatures(samples, SR));
  }
  return out;
}
const noise = (frames: number) => {
  let s = 3; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  return Array.from({ length: frames }, () => frameFeatures(Float32Array.from({ length: N }, () => (rnd() - 0.5) * 0.2), SR));
};

test('the pitch of a voiced slice is found (and its octave is not mistaken)', () => {
  const tone = Float32Array.from({ length: N }, (_, i) => Math.sin((2 * Math.PI * 140 * i) / SR) + 0.5 * Math.sin((2 * Math.PI * 280 * i) / SR));
  assert.ok(Math.abs(pitchOf(tone, SR)! - 140) < 4);
  assert.equal(pitchOf(new Float32Array(N), SR), undefined, 'silence has no pitch');
  assert.equal(BAND_CENTRES.length, 16);
});

test('the same voice is recognised; another voice is a clear no; noise and silence are never a no', () => {
  const me = enrolPrint([voice(120, [500, 1500, 2500], 30), voice(125, [520, 1450, 2450], 30, 11)])!;
  assert.ok(isVoicePrint(me));
  assert.equal(samePerson(me, summarize(voice(118, [510, 1480, 2520], 30, 23))), 'yes');
  assert.equal(samePerson(me, summarize(voice(210, [800, 1200, 2800], 30, 29))), 'no', 'a different (higher, other vowels) voice');
  // Too little voice to judge (a cough, a knock, the hum of a fan): unsure — counted as him, never ignored.
  assert.equal(summarize(noise(30)), undefined);
  assert.equal(samePerson(me, summarize(noise(30))), 'unsure');
  assert.equal(samePerson(me, summarize(voice(210, [800, 1200, 2800], 5))), 'unsure');
  assert.ok(matchScore(me, summarize(voice(118, [510, 1480, 2520], 30, 31))!) > matchScore(me, summarize(voice(125, [700, 1100, 2400], 30, 37))!));
});

test('enrolment needs enough voice, and a stored print is checked before use', () => {
  assert.equal(enrolPrint([voice(120, [500, 1500, 2500], 10)]), undefined, 'one short sentence is not enough');
  assert.equal(isVoicePrint({ v: 1, bands: [1, 2], f0: 120, spread: 1.1 }), false);
  assert.equal(isVoicePrint(null), false);
  for (const [lang, sentences] of Object.entries(ENROL_SENTENCES)) assert.equal(sentences.length, 3, lang);
  assert.equal(Object.keys(ENROL_SENTENCES).length, 10);
});

test('the print slowly follows his voice today, and still tells another voice apart', () => {
  const me = enrolPrint([voice(120, [500, 1500, 2500], 30), voice(125, [520, 1450, 2450], 30, 11)])!;
  let print = me;
  // A hoarse evening: a little lower, the same vowels — each sentence that is clearly him moves the print a little.
  for (let k = 0; k < 8; k += 1) {
    const now = summarize(voice(108, [490, 1470, 2480], 30, 40 + k))!;
    assert.equal(samePerson(print, now), 'yes');
    print = adaptPrint(print, now);
  }
  assert.ok(isVoicePrint(print));
  assert.ok(print.f0 < me.f0 && print.f0 > 108, 'moved towards today, not jumped to it');
  assert.equal(samePerson(print, summarize(voice(210, [800, 1200, 2800], 30, 29))), 'no', 'another voice is still not him');
});
