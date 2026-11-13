import { resolveLocalVoice } from './localVoiceCatalog';
let context: AudioContext | undefined;
/** Called from the visitor's click, before lazy network work. Resume must start inside the user gesture. */
export function unlockLocalAudio(): AudioContext {
  if (!context || context.state === 'closed') context = new AudioContext();
  void context.resume().catch(() => undefined);
  return context;
}
export function playLocalVoice(chunks: string[], options: {
  name: string; language: string; rate: number; pitch: number;
  onChunk?: (text: string, index: number) => void; onEnd: () => void; onError: () => void;
}): () => void {
  const queue = [...chunks];
  let worker: Worker | undefined;
  let source: AudioBufferSourceNode | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let stopped = false;
  let rejectPending: ((error: Error) => void) | undefined;
  const cleanup = () => {
    clearTimeout(timer);
    if (worker) { worker.onmessage = null; worker.onmessageerror = null; worker.onerror = null; worker.terminate(); worker = undefined; }
    if (source) { source.onended = null; try { source.stop(); } catch { /* Already ended. */ } source.disconnect(); source = undefined; }
    rejectPending?.(new Error('Stopped')); rejectPending = undefined;
  };
  const finish = (failed: boolean) => { if (stopped) return; stopped = true; cleanup(); if (failed) options.onError(); else options.onEnd(); };
  /** Every asynchronous stage, including decoding/resuming, must time out and remain cancellable. */
  const waitFor = <T>(operation: () => Promise<T>, timeout: number) => new Promise<T>((resolve, reject) => {
    rejectPending = reject;
    timer = setTimeout(() => reject(new Error('Speech stage timed out')), timeout);
    try { operation().then(resolve, reject); } catch (error) { reject(error); }
  }).finally(() => { clearTimeout(timer); rejectPending = undefined; });
  void (async () => {
    try {
      if (!resolveLocalVoice(options.name, options.language) || !queue.length || queue.some((chunk) => typeof chunk !== 'string' || !chunk.trim() || chunk.length > 600)) throw new Error('Invalid local speech');
      const audio = unlockLocalAudio();
      worker = new Worker(new URL('./localVoice.worker.ts', import.meta.url), { type: 'module' });
      const engineUrl = new URL(`${import.meta.env?.BASE_URL || '/'}voice-engine/dist/browser.js`, window.location.origin).href;
      for (let index = 0; index < queue.length; index++) {
        if (stopped) return;
        const bytes = await waitFor(() => new Promise<ArrayBuffer>((resolve, reject) => {
          worker!.onerror = () => reject(new Error('Speech worker failed'));
          worker!.onmessageerror = () => reject(new Error('Invalid speech worker message'));
          worker!.onmessage = (event: MessageEvent<{ audio?: ArrayBuffer; error?: string }>) => {
            // Ignore duplicate/stale messages during decoding or playback of this chunk.
            if (worker) worker.onmessage = null;
            if (event.data?.audio instanceof ArrayBuffer) resolve(event.data.audio); else reject(new Error('No audio'));
          };
          worker!.postMessage({ engineUrl, voice: options.name, language: options.language, text: queue[index], rate: options.rate, pitch: options.pitch });
        }), 45000);
        if (stopped) return;
        const buffer = await waitFor(() => audio.decodeAudioData(bytes), 10000);
        if (stopped) return;
        // Mobile browsers can suspend the audio session while the dictionary loads or the microphone opens.
        if (audio.state !== 'running') await waitFor(() => audio.resume(), 10000);
        if (stopped) return;
        if (audio.state !== 'running' || !Number.isFinite(buffer.duration) || buffer.duration <= 0) throw new Error('Audio playback blocked');
        await waitFor(() => new Promise<void>((resolve) => {
          const node = audio.createBufferSource(); source = node;
          node.buffer = buffer; node.connect(audio.destination);
          node.onended = () => {
            if (stopped || source !== node) return;
            node.disconnect(); source = undefined; resolve();
          };
          node.start();
          options.onChunk?.(queue[index], index);
        }), Math.ceil(buffer.duration * 1000) + 10000);
      }
      finish(false);
    } catch { if (!stopped) finish(true); }
  })();
  return () => { if (!stopped) { stopped = true; cleanup(); } };
}
