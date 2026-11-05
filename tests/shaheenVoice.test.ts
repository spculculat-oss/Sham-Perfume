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
  assert.match(button, /voice_short:\s*\{\s*ar: 'صوت', en: 'Voice'\s*\}/);
  assert.match(button, /<span className="whitespace-nowrap text-\[11px\] font-semibold">\{L\(voice\.active \? 'stop_short' : 'voice_short'\)\}<\/span>/);
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
