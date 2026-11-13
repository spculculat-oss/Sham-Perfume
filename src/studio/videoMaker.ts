/**
 * «استوديو شاهين — صانع الفيديو» (browser side): plays a storyboard on a canvas — every picture moves like a film
 * camera (zoom and pan), scenes melt into each other, the words appear on screen — with an original soundtrack made
 * from notes, and records it all into a real video file (WebM, or MP4 where the browser records MP4).
 * The pictures come from the image generator; everything else happens on the visitor's device, no server needed.
 */
import { ASPECT_SIZE, cameraAt, coverRect, frameAt, musicPlan, totalSeconds, wrapLines, type Storyboard } from './storyboard';

export type Picture = CanvasImageSource & { width: number; height: number };

/** A picture ready to draw on the canvas without «tainting» it (so the video can be recorded). */
export async function loadPicture(src: string, signal?: AbortSignal): Promise<Picture | null> {
  try {
    const response = await fetch(src, { signal, mode: 'cors' });
    if (!response.ok) throw new Error(String(response.status));
    return await createImageBitmap(await response.blob());
  } catch {
    if (signal?.aborted) return null;
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img as Picture);
      img.onerror = () => resolve(null);
      img.src = src;
    });
  }
}

/** The frame at second `t`. Pictures that failed are drawn as a soft gradient so the video never breaks. */
export function drawFrame(ctx: CanvasRenderingContext2D, board: Storyboard, pictures: Array<Picture | null>, t: number) {
  const [W, H] = [ctx.canvas.width, ctx.canvas.height];
  const f = frameAt(t, board.scenes);
  ctx.save();
  ctx.fillStyle = '#0c0a09';
  ctx.fillRect(0, 0, W, H);
  const paint = (i: number, p: number, alpha: number) => {
    const scene = board.scenes[i];
    if (!scene || alpha <= 0) return;
    ctx.globalAlpha = alpha;
    const pic = pictures[i];
    if (pic && pic.width && pic.height) {
      const [sx, sy, sw, sh] = coverRect(pic.width, pic.height, W, H, cameraAt(scene.motion, p));
      ctx.drawImage(pic, sx, sy, sw, sh, 0, 0, W, H);
    } else {
      const g = ctx.createLinearGradient(0, 0, W, H);
      g.addColorStop(0, `hsl(${(i * 67) % 360} 45% 28%)`);
      g.addColorStop(1, `hsl(${(i * 67 + 50) % 360} 55% 14%)`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }
  };
  if (f.index >= 0) {
    paint(f.index, f.p, 1);
    if (f.next >= 0 && f.mix > 0) paint(f.next, 0, f.mix);
  }
  ctx.globalAlpha = 1;
  // A gentle film vignette and a dark band behind the words.
  const v = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, W, H);
  const scene = board.scenes[f.mix > 0.5 && f.next >= 0 ? f.next : f.index];
  const local = f.mix > 0.5 ? 0 : f.p * (scene?.seconds || 1);
  if (scene?.caption) {
    const size = Math.round(Math.min(W, H) * (W < H ? 0.052 : 0.046));
    ctx.font = `800 ${size}px Cairo, Tajawal, "Noto Sans Arabic", system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.direction = board.dir;
    const lines = wrapLines(scene.caption, W < H ? 22 : 38);
    const fade = Math.min(1, local / 0.6, f.next >= 0 ? (1 - f.mix) * 2 : 1);
    const band = ctx.createLinearGradient(0, H * 0.62, 0, H);
    band.addColorStop(0, 'rgba(0,0,0,0)');
    band.addColorStop(1, 'rgba(0,0,0,0.7)');
    ctx.fillStyle = band;
    ctx.fillRect(0, H * 0.62, W, H * 0.38);
    ctx.globalAlpha = Math.max(0, fade);
    ctx.fillStyle = '#fff';
    ctx.shadowColor = 'rgba(0,0,0,.8)';
    ctx.shadowBlur = size * 0.4;
    const lift = (1 - Math.min(1, local / 0.6)) * size * 0.5;
    lines.forEach((line, i) => ctx.fillText(line, W / 2, H - size * 1.6 - (lines.length - 1 - i) * size * 1.35 + lift));
    ctx.shadowBlur = 0;
  }
  // The title over the first two seconds.
  if (board.title && t < 2.6) {
    const size = Math.round(Math.min(W, H) * 0.075);
    ctx.globalAlpha = Math.max(0, Math.min(1, t / 0.5, (2.6 - t) / 0.6));
    ctx.font = `900 ${size}px Cairo, Tajawal, "Noto Sans Arabic", system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.direction = board.dir;
    ctx.fillStyle = '#fff';
    ctx.shadowColor = 'rgba(0,0,0,.85)';
    ctx.shadowBlur = size * 0.5;
    wrapLines(board.title, W < H ? 16 : 28).forEach((line, i, all) => ctx.fillText(line, W / 2, H * 0.42 + (i - (all.length - 1) / 2) * size * 1.25));
  }
  // Fade from and to black.
  const end = totalSeconds(board.scenes);
  const black = Math.max(0, 1 - t / 0.6, 1 - (end - t) / 0.8);
  if (black > 0) { ctx.globalAlpha = Math.min(1, black); ctx.shadowBlur = 0; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); }
  ctx.restore();
}

/** An original soundtrack: soft chords by mood (pads through a low-pass filter), fading in and out. */
export function scheduleMusic(audio: BaseAudioContext, out: AudioNode, board: Storyboard, start = audio.currentTime) {
  const seconds = totalSeconds(board.scenes);
  const master = audio.createGain();
  master.gain.setValueAtTime(0, start);
  master.gain.linearRampToValueAtTime(0.16, start + 1.2);
  master.gain.setValueAtTime(0.16, start + Math.max(1.3, seconds - 1.5));
  master.gain.linearRampToValueAtTime(0, start + seconds);
  const filter = audio.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = board.mood === 'epic' ? 1800 : board.mood === 'happy' ? 2400 : 1100;
  filter.connect(master);
  master.connect(out);
  const oscillators: OscillatorNode[] = [];
  for (const chord of musicPlan(board.mood, seconds)) {
    const at = start + chord.at;
    for (const [i, freq] of [...chord.freqs, chord.freqs[0]! / 2].entries()) {
      const osc = audio.createOscillator();
      osc.type = i === chord.freqs.length ? 'sine' : board.mood === 'epic' ? 'sawtooth' : 'triangle';
      osc.frequency.value = freq;
      osc.detune.value = (i % 2 ? 1 : -1) * 6;
      const g = audio.createGain();
      g.gain.setValueAtTime(0, at);
      g.gain.linearRampToValueAtTime(i === chord.freqs.length ? 0.5 : 0.22, at + Math.min(0.6, chord.length / 3));
      g.gain.linearRampToValueAtTime(0, at + chord.length + 0.3);
      osc.connect(g).connect(filter);
      osc.start(at);
      osc.stop(at + chord.length + 0.35);
      oscillators.push(osc);
    }
    if (board.mood === 'happy' || board.mood === 'epic') {
      // A soft pulse on every beat.
      for (let b = 0; b < 4; b += 1) {
        const when = at + (b * chord.length) / 4;
        if (when >= start + seconds - 0.2) break;
        const osc = audio.createOscillator();
        osc.frequency.setValueAtTime(board.mood === 'epic' ? 70 : 110, when);
        osc.frequency.exponentialRampToValueAtTime(40, when + 0.18);
        const g = audio.createGain();
        g.gain.setValueAtTime(board.mood === 'epic' ? 0.7 : 0.35, when);
        g.gain.exponentialRampToValueAtTime(0.001, when + 0.2);
        osc.connect(g).connect(master);
        osc.start(when);
        osc.stop(when + 0.22);
        oscillators.push(osc);
      }
    }
  }
  return () => { for (const o of oscillators) { try { o.stop(); } catch { /* already stopped */ } } master.disconnect(); };
}

/** Plays the video on a canvas in the page (with music when `sound`). Returns a function that stops it. */
export function play(canvas: HTMLCanvasElement, board: Storyboard, pictures: Array<Picture | null>, { sound = true, onTime, onEnd }: { sound?: boolean; onTime?: (t: number) => void; onEnd?: () => void } = {}): () => void {
  const [W, H] = ASPECT_SIZE[board.aspect];
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return () => {};
  const end = totalSeconds(board.scenes);
  let audio: AudioContext | undefined;
  let stopMusic = () => {};
  if (sound && typeof AudioContext !== 'undefined') { audio = new AudioContext(); stopMusic = scheduleMusic(audio, audio.destination, board); }
  const started = performance.now();
  let frame = 0;
  let stopped = false;
  const tick = () => {
    if (stopped) return;
    const t = (performance.now() - started) / 1000;
    drawFrame(ctx, board, pictures, Math.min(t, end));
    onTime?.(Math.min(t, end));
    if (t >= end) { stop(); onEnd?.(); return; }
    frame = requestAnimationFrame(tick);
  };
  const stop = () => { if (stopped) return; stopped = true; cancelAnimationFrame(frame); stopMusic(); void audio?.close().catch(() => {}); };
  frame = requestAnimationFrame(tick);
  return stop;
}

/** The best video format this browser can record. */
export function recordingType(): { mime: string; ext: 'webm' | 'mp4' } | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined;
  for (const [mime, ext] of [['video/webm;codecs=vp9,opus', 'webm'], ['video/webm;codecs=vp8,opus', 'webm'], ['video/webm', 'webm'], ['video/mp4;codecs=avc1,mp4a', 'mp4'], ['video/mp4', 'mp4']] as const) {
    if (MediaRecorder.isTypeSupported(mime)) return { mime, ext };
  }
  return undefined;
}
export const canRecord = () => typeof HTMLCanvasElement !== 'undefined' && 'captureStream' in HTMLCanvasElement.prototype && Boolean(recordingType());

/** Records the whole video in real time (it takes as long as the video) into a file. */
export async function record(board: Storyboard, pictures: Array<Picture | null>, { music = true, onProgress, signal }: { music?: boolean; onProgress?: (fraction: number) => void; signal?: AbortSignal } = {}): Promise<{ blob: Blob; ext: 'webm' | 'mp4' }> {
  const type = recordingType();
  if (!type) throw new Error('NO_RECORDER');
  const [W, H] = ASPECT_SIZE[board.aspect];
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('NO_CANVAS');
  drawFrame(ctx, board, pictures, 0);
  const stream = canvas.captureStream(30);
  let audio: AudioContext | undefined;
  let stopMusic = () => {};
  if (music && typeof AudioContext !== 'undefined') {
    audio = new AudioContext();
    const dest = audio.createMediaStreamDestination();
    stopMusic = scheduleMusic(audio, dest, board, audio.currentTime + 0.05);
    for (const track of dest.stream.getAudioTracks()) stream.addTrack(track);
  }
  const recorder = new MediaRecorder(stream, { mimeType: type.mime, videoBitsPerSecond: 6_000_000 });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
  const end = totalSeconds(board.scenes);
  const done = new Promise<void>((resolve) => { recorder.onstop = () => resolve(); });
  recorder.start(500);
  const started = performance.now();
  // A timer, not animation frames: recording keeps going if the visitor switches tabs.
  await new Promise<void>((resolve) => {
    const timer = setInterval(() => {
      const t = (performance.now() - started) / 1000;
      drawFrame(ctx, board, pictures, Math.min(t, end));
      onProgress?.(Math.min(1, t / end));
      if (t >= end + 0.3 || signal?.aborted) { clearInterval(timer); resolve(); }
    }, 1000 / 30);
  });
  recorder.stop();
  await done;
  stopMusic();
  for (const track of stream.getTracks()) track.stop();
  void audio?.close().catch(() => {});
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
  return { blob: new Blob(chunks, { type: type.mime.split(';')[0] }), ext: type.ext };
}

/** One still frame as a picture (the video's cover / thumbnail). */
export function posterOf(board: Storyboard, pictures: Array<Picture | null>, t = 3): string {
  const [W, H] = ASPECT_SIZE[board.aspect];
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  drawFrame(ctx, board, pictures, t);
  try { return canvas.toDataURL('image/jpeg', 0.9); } catch { return ''; }
}
