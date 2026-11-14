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

test('the in-chat voice bar speaks the site\'s ten main languages and keeps the privacy promise', async () => {
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
  // «جوه الشات نفسه»: docked above the messages of both chats, never a full-screen page over them.
  assert.doesNotMatch(button, /<ShaheenVoiceStage /);
  for (const path of ['../src/components/PerfumerAIChatbot.tsx', '../src/components/PerfumerMasterLabView.tsx']) {
    const host = readFileSync(new URL(path, import.meta.url), 'utf8');
    const dock = host.indexOf('<ShaheenVoiceStage ');
    assert.ok(dock > 0, path);
    assert.ok(dock < host.indexOf('overflow-y-auto', dock), 'the bar sits above the messages');
  }
  const main = stage.slice(stage.indexOf('export function ShaheenVoiceStage'), stage.indexOf('const PRINT_ASKED'));
  assert.doesNotMatch(main, /fixed inset-0|aria-modal|role="dialog"/, 'the conversation is not a page over the chat');
  assert.match(main, /sham-voice-dock/);
});

test('«يقف ويسمع ويتأكد»: a voice lowers him while it is judged, an unclear one holds the sentence, someone nearby lets him go on from the same word', () => {
  const hook = readFileSync(new URL('../src/hooks/useShaheenVoiceMode.ts', import.meta.url), 'utf8');
  const judge = hook.slice(hook.indexOf('const judgeCandidate = useCallback'), hook.indexOf('const judgeCandidateRef'));
  assert.match(judge, /verdict\.to === 'unsure'[^]*?replyHandleRef\.current\?\.pause\(\)/, 'unclear → he holds the sentence and listens');
  assert.match(judge, /replyHandleRef\.current\?\.resume\(\)[^]*?settleAside\(\)/, 'to someone nearby → on from the same word');
  assert.doesNotMatch(judge, /cancelSpeech\(\)/, 'judging never drops the reply');
  const consider = hook.slice(hook.indexOf('const considerBarge = useCallback'), hook.indexOf('const considerBargeRef'));
  assert.match(consider, /duck\(true\)/, 'a voice lowers him while it is judged');
  assert.match(consider, /now - aside\.at < 8000/, 'a side conversation does not stop him again and again');
});
