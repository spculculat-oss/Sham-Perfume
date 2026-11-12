import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { LOCALE_MAP } from '../src/لغات/localize';
import { prepareShaheenSpeech, shaheenSpeechLocale, splitShaheenSpeech } from '../src/utils/shaheenVoice';

test('Shaheen speech uses the platform locale map, including Egyptian Arabic', () => {
  assert.equal(shaheenSpeechLocale('ar'), LOCALE_MAP.ar);
  assert.equal(shaheenSpeechLocale('en'), LOCALE_MAP.en);
  assert.equal(shaheenSpeechLocale('fa'), LOCALE_MAP.fa);
});

test('voice mode has a visible label on both Shaheen chat surfaces', () => {
  const button = readFileSync(new URL('../src/components/ShaheenVoiceModeButton.tsx', import.meta.url), 'utf8');
  assert.match(button, /voice_short:\s*\{\s*ar: 'صوت', en: 'Voice',/);
  assert.match(button, /<span className="relative whitespace-nowrap text-\[11px\] font-semibold">\{L\(voice\.active \? 'stop_short' : 'voice_short'\)\}<\/span>/);
  for (const path of ['../src/components/PerfumerAIChatbot.tsx', '../src/components/PerfumerMasterLabView.tsx']) {
    const source = readFileSync(new URL(path, import.meta.url), 'utf8');
    assert.match(source, /<ShaheenVoiceModeButton/);
  }
});

test('spoken replies keep readable Markdown while omitting formula blocks and URLs', () => {
  const answer = [
    '## النتيجة',
    '- **استخدم** `العود` و[الدليل](https://example.org/guide) للشرح.',
    '',
    '```json',
    '{"formula":{"oil":5}}',
    '```',
  ].join('\n');
  const spoken = prepareShaheenSpeech(answer);
  assert.equal(spoken, 'النتيجة استخدم العود والدليل للشرح.');
  assert.doesNotMatch(spoken, /https|formula|oil|```|json/i);
  assert.equal(prepareShaheenSpeech('نصيحة.\n```sham-tool\n{"tools":[{"tool":"store","search":"hidden"}]}\n```\nخلاص.'), 'نصيحة. خلاص.');
});

test('spoken equations are converted to readable math instead of raw LaTeX', () => {
  const spoken = prepareShaheenSpeech('النتيجة: $V_1 = 10 \\times 2$');
  assert.equal(spoken, 'النتيجة: V₁ = 10 × 2');
  assert.doesNotMatch(spoken, /\\times|\$/);
});

test('long answers split at sentence and word boundaries without exceeding the speech limit', () => {
  const answer = 'أهلاً بك. شاهين يرد بصوت واضح ومفيد، ويكمل كل التفاصيل بهدوء.';
  const chunks = splitShaheenSpeech(answer, 24);
  assert.ok(chunks.length > 1);
  assert.ok(chunks.every((chunk) => chunk.length <= 24));
  assert.equal(chunks.join(' '), prepareShaheenSpeech(answer));
  assert.deepEqual(splitShaheenSpeech('```sham-formula\n{}\n```'), []);
});

test('Shaheen reads replies with the most natural voice the device offers for the language', async () => {
  const { pickShaheenVoice } = await import('../src/utils/shaheenVoice');
  const voices = [
    { name: 'English Default', lang: 'en-US', default: true },
    { name: 'Maged', lang: 'ar-SA', localService: true },
    { name: 'Microsoft Salma Online (Natural) - Arabic (Egypt)', lang: 'ar-EG', localService: false },
    { name: 'eSpeak Arabic', lang: 'ar-EG' },
    { name: 'Google français', lang: 'fr_FR' },
  ];
  assert.equal(pickShaheenVoice(voices, 'ar-EG', 'ar')?.name, 'Microsoft Salma Online (Natural) - Arabic (Egypt)');
  // Another region of the same language beats nothing, and novelty voices lose to plain ones.
  assert.equal(pickShaheenVoice(voices.filter((voice) => voice.lang !== 'ar-EG' || /espeak/i.test(voice.name)), 'ar-EG', 'ar')?.name, 'Maged');
  assert.equal(pickShaheenVoice(voices, 'fr-FR', 'fr')?.name, 'Google français');
  // No voice for the language: let the engine choose for the utterance's lang.
  assert.equal(pickShaheenVoice(voices, 'ja-JP', 'ja'), undefined);
  assert.equal(pickShaheenVoice([], 'ar-EG', 'ar'), undefined);
});

test('the full-screen voice stage speaks the site\'s ten main languages and keeps the privacy promise', async () => {
  const { readFileSync } = await import('node:fs');
  const stage = readFileSync(new URL('../src/components/ShaheenVoiceStage.tsx', import.meta.url), 'utf8');
  const button = readFileSync(new URL('../src/components/ShaheenVoiceModeButton.tsx', import.meta.url), 'utf8');
  for (const source of [stage, button]) {
    const entries = source.split('\n').filter((line) => /^\s+[a-z_]+: \{ ar: /.test(line));
    assert.ok(entries.length >= 8);
    for (const line of entries) for (const lang of ['en', 'fr', 'es', 'it', 'de', 'ru', 'zh', 'tr', 'fa']) assert.match(line, new RegExp(` ${lang}: '`), line.slice(0, 40));
  }
  assert.match(stage, /interrupt/);
  assert.match(stage, /toggleMute/);
  assert.match(stage, /prefers-reduced-motion/);
  // The level meter only reads loudness on the device; it never records or sends the sound.
  assert.doesNotMatch(stage, /MediaRecorder|fetch\(|sendBeacon|XMLHttpRequest/);
  assert.match(button, /<ShaheenVoiceStage /);
});
