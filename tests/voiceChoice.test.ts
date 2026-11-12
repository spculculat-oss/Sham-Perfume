import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chosenVoice, DEFAULT_VOICE_CHOICE, saveVoiceChoice, savedVoiceChoice, voiceGender, voiceLabel, voiceOptions } from '../src/utils/voiceChoice';

const v = (name: string, lang: string) => ({ name, lang, localService: true, default: false, voiceURI: name });
const VOICES = [
  v('Microsoft Shakir Online (Natural) - Arabic (Egypt)', 'ar-EG'),
  v('Microsoft Salma Online (Natural) - Arabic (Egypt)', 'ar-EG'),
  v('Microsoft Zariyah Online (Natural) - Arabic (Saudi Arabia)', 'ar-SA'),
  v('Microsoft Hamed Online (Natural) - Arabic (Saudi Arabia)', 'ar-SA'),
  v('Google العربية', 'ar-SA'),
  v('Microsoft Jenny Online (Natural) - English (United States)', 'en-US'),
  v('Microsoft Guy Online (Natural) - English (United States)', 'en-US'),
];

test('every device voice of the language is offered, male and female, the visitor’s accent first', () => {
  const options = voiceOptions(VOICES, 'ar-EG', 'ar');
  assert.equal(options.length, 5, 'Arabic only');
  assert.deepEqual(options.slice(0, 2).map((option) => option.lang), ['ar-EG', 'ar-EG']);
  assert.equal(options.find((option) => option.name.includes('Shakir'))?.gender, 'male');
  assert.equal(options.find((option) => option.name.includes('Salma'))?.gender, 'female');
  assert.equal(options.find((option) => option.name.includes('Google'))?.gender, undefined, 'a name that does not say');
  assert.equal(voiceLabel(VOICES[0]!), 'Shakir · ar-EG');
  assert.equal(voiceGender({ name: 'Microsoft Guy Online' }), 'male');
});

test('the chosen voice is used; a gender picks its best voice; nothing chosen keeps Shaheen’s usual voice', () => {
  const usual = chosenVoice(VOICES, 'ar-EG', 'ar', DEFAULT_VOICE_CHOICE);
  assert.ok(usual);
  const salma = chosenVoice(VOICES, 'ar-EG', 'ar', { ...DEFAULT_VOICE_CHOICE, names: { ar: VOICES[1]!.name } });
  assert.equal(salma?.name, VOICES[1]!.name);
  assert.equal(voiceGender(chosenVoice(VOICES, 'ar-EG', 'ar', { ...DEFAULT_VOICE_CHOICE, gender: 'female' })!), 'female');
  assert.equal(voiceGender(chosenVoice(VOICES, 'ar-EG', 'ar', { ...DEFAULT_VOICE_CHOICE, gender: 'male' })!), 'male');
  // Chosen for Arabic only: English still gets an English voice.
  assert.equal(chosenVoice(VOICES, 'en-US', 'en', { ...DEFAULT_VOICE_CHOICE, names: { ar: VOICES[1]!.name } })?.lang, 'en-US');
  // A voice this device does not have (chosen on another device): Shaheen's usual voice.
  assert.equal(chosenVoice(VOICES, 'ar-EG', 'ar', { ...DEFAULT_VOICE_CHOICE, names: { ar: 'Gone' } })?.name, usual?.name);
});

test('the choice is kept in this browser, within safe limits', () => {
  const store = new Map<string, string>();
  (globalThis as { localStorage?: unknown }).localStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, value: string) => store.set(k, value), removeItem: (k: string) => store.delete(k) };
  try {
    assert.deepEqual(savedVoiceChoice(), DEFAULT_VOICE_CHOICE);
    saveVoiceChoice({ names: { ar: 'Microsoft Salma' }, gender: 'female', pitch: 1.2, rate: 1.1 });
    assert.deepEqual(savedVoiceChoice(), { names: { ar: 'Microsoft Salma' }, gender: 'female', pitch: 1.2, rate: 1.1 });
    store.set('sham_voice_choice_v1', JSON.stringify({ names: { ar: 5 }, gender: 'robot', pitch: 9, rate: -3 }));
    assert.deepEqual(savedVoiceChoice(), { names: {}, pitch: 1.5, rate: 0.7 });
    store.set('sham_voice_choice_v1', '{broken');
    assert.deepEqual(savedVoiceChoice(), DEFAULT_VOICE_CHOICE);
  } finally {
    delete (globalThis as { localStorage?: unknown }).localStorage;
  }
});
