import { useCallback, useEffect, useRef, useState } from 'react';
import { MAX_ADHAN_DURATION_SECONDS } from '../../data/adhanVoices';

export type AdhanTrack = { name: string } & ({ url: string } | { file: Blob });
type PlaybackKind = 'preview' | 'reminder';
type PlaybackStatus = { state: 'idle' } | { state: 'loading' | 'playing' | 'blocked' | 'error'; kind: PlaybackKind; name: string };
type AudioJob = { request: AbortController; node?: AudioBufferSourceNode; kind: PlaybackKind };

/** Web Audio is unlocked from an explicit click. No silent loop, hidden media,
 * automatic permission request, or audio download is needed to show the schedule. */
export function useAdhanAudio() {
  const context = useRef<AudioContext | null>(null);
  const job = useRef<AudioJob | null>(null);
  const [status, setStatus] = useState<PlaybackStatus>({ state: 'idle' });
  const stopJob = useCallback((kind?: PlaybackKind) => {
    const current = job.current;
    if (!current || (kind && current.kind !== kind)) return false;
    job.current = null;
    current.request.abort();
    if (current.node) {
      current.node.onended = null;
      try { current.node.stop(); } catch { /* Already stopped. */ }
      current.node.disconnect();
    }
    return true;
  }, []);
  const stop = useCallback((kind?: PlaybackKind) => {
    stopJob(kind);
    setStatus((old) => old.state === 'idle' || (kind && old.kind !== kind) ? old : { state: 'idle' });
  }, [stopJob]);

  const unlock = useCallback(async (): Promise<boolean> => {
    let timer: number | undefined;
    try {
      const Audio = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Audio) return false;
      const audio = context.current ??= new Audio();
      if (audio.state === 'running') return true;
      return await Promise.race([
        audio.resume().then(() => audio.state === 'running'),
        new Promise<boolean>((resolve) => { timer = window.setTimeout(() => resolve(false), 1700); }),
      ]);
    } catch { return false; }
    finally { if (timer !== undefined) window.clearTimeout(timer); }
  }, []);

  const play = useCallback(async (track: AdhanTrack, kind: PlaybackKind): Promise<void> => {
    stopJob();
    const current: AudioJob = { request: new AbortController(), kind };
    job.current = current;
    setStatus({ state: 'loading', kind, name: track.name });
    let timer: number | undefined;
    try {
      if ((kind === 'preview' && !await unlock()) || context.current?.state !== 'running') {
        if (job.current === current) setStatus({ state: 'blocked', kind, name: track.name });
        return;
      }
      if (job.current !== current) return;
      const audio = context.current;
      timer = window.setTimeout(() => current.request.abort(), 15_000);
      const bytes = 'file' in track ? await track.file.arrayBuffer() : await (async () => {
        const response = await fetch(track.url, { signal: current.request.signal });
        if (!response.ok) throw new Error('Unavailable adhan recording');
        return response.arrayBuffer();
      })();
      if (job.current !== current) return;
      const buffer = await audio.decodeAudioData(bytes);
      if (job.current !== current) return;
      if (!(buffer.duration > 0 && buffer.duration <= MAX_ADHAN_DURATION_SECONDS)) throw new Error('Adhan recording duration');
      if (audio.state !== 'running') { setStatus({ state: 'blocked', kind, name: track.name }); return; }
      const node = audio.createBufferSource();
      current.node = node;
      node.buffer = buffer;
      node.connect(audio.destination);
      node.onended = () => {
        if (job.current !== current) return;
        job.current = null;
        node.disconnect();
        setStatus({ state: 'idle' });
      };
      node.start();
      setStatus({ state: 'playing', kind, name: track.name });
    } catch {
      if (job.current === current) { stopJob(); setStatus({ state: 'error', kind, name: track.name }); }
    } finally {
      if (timer !== undefined) window.clearTimeout(timer);
      if (job.current === current && !current.node) job.current = null;
    }
  }, [stopJob, unlock]);

  useEffect(() => () => {
    stopJob();
    const audio = context.current;
    context.current = null;
    if (audio) void audio.close().catch(() => {});
  }, [stopJob]);
  return { status, unlock, play, stop };
}
