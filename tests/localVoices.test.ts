import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createEspeak, encodeWav } from '@spelling-creator/spellophone';
import languages from '../src/data/localVoiceLanguages.json';
import { localVoiceLanguage, localVoiceOptions, resolveLocalVoice } from '../src/utils/localVoiceCatalog';
import { chosenVoice, DEFAULT_VOICE_CHOICE } from '../src/utils/voiceChoice';

test('local catalog exposes actual supported languages and twelve explicitly synthetic profiles', () => {
  assert.equal(localVoiceLanguage('ar-EG'), 'ar');
  assert.equal(localVoiceLanguage('en-GB'), 'en-gb');
  assert.equal(localVoiceLanguage('zh'), 'cmn');
  assert.equal(localVoiceLanguage('fr'), 'fr-fr');
  assert.equal(localVoiceLanguage('pt-BR'), 'pt-br');
  assert.equal(localVoiceLanguage('not-a-language'), undefined);
  assert.equal(localVoiceOptions('not-a-language').length, 0);
  const profiles = localVoiceOptions('ar');
  assert.equal(profiles.length, 12);
  assert.equal(new Set(profiles.map((voice) => voice.name)).size, 12);
  assert.equal(profiles.filter((voice) => voice.gender === 'female').length, 5);
  assert.ok(profiles.every((voice) => /آلي/.test(voice.label)));
  assert.equal(resolveLocalVoice(profiles[0]!.name, 'ar')?.engineVoice, 'ar+m1');
  assert.equal(resolveLocalVoice(profiles[0]!.name, 'en'), undefined);
  assert.equal(resolveLocalVoice('sham-local:ar:../../other', 'ar'), undefined);
});

test('a saved native voice with the wrong language cannot read an Arabic reply in English', () => {
  const voices = [{ name: 'English only', lang: 'en-US' }, { name: 'Arabic', lang: 'ar-EG' }];
  assert.equal(chosenVoice(voices, 'ar-EG', 'ar', { ...DEFAULT_VOICE_CHOICE, names: { ar: 'English only' } })?.name, 'Arabic');
});

test('installed local engine really produces distinct nonempty Arabic WAV profiles', async () => {
  const engine = await createEspeak();
  const waveforms: Buffer[] = [];
  for (const profile of localVoiceOptions('ar')) {
    engine.setVoice(resolveLocalVoice(profile.name, 'ar')!.engineVoice);
    const { samples, sampleRate } = engine.synthesize('أهلا وسهلا بكم في منصة شام.');
    const wav = Buffer.from(encodeWav(samples, sampleRate));
    assert.equal(wav.toString('ascii', 0, 4), 'RIFF');
    assert.equal(wav.toString('ascii', 8, 12), 'WAVE');
    assert.ok(wav.length > 1000);
    waveforms.push(wav);
  }
  assert.equal(new Set(waveforms.map((buffer) => buffer.toString('base64'))).size, 12);
});

test('bundled language manifest matches the exact installed engine', async () => {
  const engine = await createEspeak();
  const actual = [...new Set(engine.listVoices().flatMap((voice) => voice.languages.slice(0, 1).map((language) => language.name)))].sort();
  assert.deepEqual(languages, actual);
});
