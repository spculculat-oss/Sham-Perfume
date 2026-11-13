import { resolveLocalVoice } from './localVoiceCatalog';
let context: AudioContext | undefined;
/** Called from the visitor's click, before the lazy package/network work. No autoplay before opt-in. */
export function unlockLocalAudio(): AudioContext {
  if (!context || context.state === 'closed') context = new AudioContext();
  void context.resume().catch(() => undefined);
  return context;
}
export function playLocalVoice(chunks: string[], options: {
  name: string; language: string; rate: number; pitch: number;
  onChunk?: (text: string, index: number) => void; onEnd: () => void; onError: () => void;
}): () => void {
  let worker: Worker | undefined;
  let source: AudioBufferSourceNode | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let stopped = false;
  let rejectPending: ((error: Error) => void) | undefined;
  const cleanup = () => {
    clearTimeout(timer); worker?.terminate(); worker = undefined;
    if (source) { source.onended = null; try { source.stop(); } catch { /* Already ended. */ } source.disconnect(); source = undefined; }
    rejectPending?.(new Error('Stopped')); rejectPending = undefined;
  };
  const finish = (failed: boolean) => { if (stopped) return; stopped = true; cleanup(); if (failed) options.onError(); else options.onEnd(); };
  void (async () => {
    try {
      if (!resolveLocalVoice(options.name, options.language) || !chunks.length) throw new Error('No local voice');
      const audio = unlockLocalAudio();
      worker = new Worker(new URL('./localVoice.worker.ts', import.meta.url), { type: 'module' });
      const engineUrl = new URL(`${import.meta.env?.BASE_URL || '/'}voice-engine/dist/browser.js`, window.location.origin).href;
      for (let index = 0; index < chunks.length; index++) {
        if (stopped) return;
        const bytes = await new Promise<ArrayBuffer>((resolve, reject) => {
          rejectPending = reject;
          timer = setTimeout(() => reject(new Error('Synthesis timeout')), 45000);
          worker!.onerror = () => reject(new Error('Speech worker failed'));
          worker!.onmessage = (event: MessageEvent<{ audio?: ArrayBuffer; error?: string }>) => {
            clearTimeout(timer); rejectPending = undefined;
            if (event.data.audio instanceof ArrayBuffer) resolve(event.data.audio); else reject(new Error('No audio'));
          };
          worker!.postMessage({ engineUrl, voice: options.name, language: options.language, text: chunks[index], rate: options.rate, pitch: options.pitch });
        });
        if (stopped) return;
        const buffer = await audio.decodeAudioData(bytes);
        if (stopped) return;
        if (audio.state !== 'running') throw new Error('Audio playback blocked');
        await new Promise<void>((resolve, reject) => {
          rejectPending = reject;
          source = audio.createBufferSource(); source.buffer = buffer; source.connect(audio.destination);
          source.onended = () => { clearTimeout(timer); source?.disconnect(); source = undefined; rejectPending = undefined; resolve(); };
          timer = setTimeout(() => reject(new Error('Playback timed out')), Math.ceil(buffer.duration * 1000) + 10000);
          options.onChunk?.(chunks[index], index); source.start();
        });
      }
      finish(false);
    } catch { if (!stopped) finish(true); }
  })();
  return () => { if (!stopped) { stopped = true; cleanup(); } };
}
