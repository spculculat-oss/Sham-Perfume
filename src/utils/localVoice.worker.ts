// SPDX-License-Identifier: GPL-3.0-or-later
/// <reference lib="webworker" />
/** Separate optional speech executable. No microphone or remote TTS endpoint. */
import { resolveLocalVoice } from './localVoiceCatalog';
import type { Espeak } from '@spelling-creator/spellophone/core';
type EngineModule = typeof import('@spelling-creator/spellophone/browser');
let engine: Promise<{ instance: Espeak; encodeWav: EngineModule['encodeWav'] }> | undefined;
self.onmessage = async (event: MessageEvent<{ engineUrl: string; voice: string; language: string; text: string; rate: number; pitch: number }>) => {
  try {
    const input = event.data;
    const voice = resolveLocalVoice(input.voice, input.language);
    if (!voice || typeof input.text !== 'string' || input.text.length > 600 || !input.text.trim()) throw new Error('Invalid synthesis request');
    const url = new URL(input.engineUrl);
    if (url.origin !== self.location.origin || !url.pathname.endsWith('/voice-engine/dist/browser.js')) throw new Error('Invalid engine location');
    engine ??= import(/* @vite-ignore */ url.href).then(async (module: EngineModule) => ({
      instance: await module.createEspeak({ dataUrl: new URL('../espeak-ng-data/', url), wasmUrl: new URL('../wasm/espeak-ng.wasm', url) }),
      encodeWav: module.encodeWav,
    }));
    const { instance, encodeWav } = await engine;
    await instance.loadVoice(voice.engineVoice);
    instance.setVoice(voice.engineVoice);
    instance.setParameter('rate', Math.round(175 * Math.min(1.3, Math.max(0.7, input.rate || 1))));
    instance.setParameter('pitch', Math.round(50 * Math.min(1.5, Math.max(0.6, input.pitch || 1))));
    const { samples, sampleRate } = instance.synthesize(input.text);
    const bytes = encodeWav(samples, sampleRate);
    if (bytes.length < 44 || bytes.length > 8000000) throw new Error('Invalid synthesized audio');
    self.postMessage({ audio: bytes.buffer }, { transfer: [bytes.buffer] });
  } catch { engine = undefined; self.postMessage({ error: 'LOCAL_VOICE_FAILED' }); }
};
