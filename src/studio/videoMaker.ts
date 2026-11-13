/**
 * «استوديو شاهين — صانع الفيديو» (browser side): plays a storyboard on a canvas — every picture moves like a film
 * camera (zoom and pan), scenes melt into each other, the words appear on screen — with an original soundtrack made
 * from notes, and records it all into a real video file (WebM, or MP4 where the browser records MP4).
 * The pictures come from the image generator; everything else happens on the visitor's device, no server needed.
 */
import { ASPECT_SIZE, cameraAt, coverRect, frameAt, GRADE, musicPlan, particlesAt, totalSeconds, wordsShown, wrapLines, type Effect, type Storyboard } from './storyboard';

export type Picture = CanvasImageSource & { width: number; height: number };
/** What a scene shows: a drawn picture, or a real moving clip from the professional engine. */
export type Visual = Picture | HTMLVideoElement;
const isVideo = (v: Visual): v is HTMLVideoElement => typeof HTMLVideoElement !== 'undefined' && v instanceof HTMLVideoElement;
const sizeOf = (v: Visual): [number, number] => (isVideo(v) ? [v.videoWidth, v.videoHeight] : [v.width, v.height]);

/** A reusable off-screen layer (for the near layer of the depth effect and the film grain). */
const layers = new Map<string, HTMLCanvasElement>();
function layer(name: string, W: number, H: number): HTMLCanvasElement {
  let c = layers.get(name);
  if (!c) { c = document.createElement('canvas'); layers.set(name, c); }
  if (c.width !== W || c.height !== H) { c.width = W; c.height = H; }
  return c;
}
let grain: HTMLCanvasElement | null = null;
function grainTile(): HTMLCanvasElement {
  if (grain) return grain;
  grain = document.createElement('canvas');
  grain.width = grain.height = 160;
  const g = grain.getContext('2d')!;
  const img = g.createImageData(160, 160);
  for (let i = 0; i < img.data.length; i += 4) { const v = Math.random() * 255; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 22; }
  g.putImageData(img, 0, 0);
  return grain;
}

/** A soft round glow drawn once per colour and reused (far cheaper than a gradient for every particle). */
const glows = new Map<string, HTMLCanvasElement>();
function glow(color: string): HTMLCanvasElement {
  let c = glows.get(color);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, `rgba(${color},1)`);
  r.addColorStop(0.35, `rgba(${color},0.55)`);
  r.addColorStop(1, `rgba(${color},0)`);
  g.fillStyle = r;
  g.fillRect(0, 0, 64, 64);
  glows.set(color, c);
  return c;
}

/** Rain, snow, embers, stars, dust, fog, sparkles or sun rays over the scene. */
export function drawEffect(ctx: CanvasRenderingContext2D, effect: Effect | undefined, t: number, seed: number, alpha: number) {
  if (!effect || effect === 'none' || alpha <= 0) return;
  const [W, H] = [ctx.canvas.width, ctx.canvas.height];
  ctx.save();
  if (effect === 'light') {
    // Soft sun rays from the top corner, slowly breathing.
    ctx.globalCompositeOperation = 'screen';
    const breathe = 0.75 + 0.25 * Math.sin(t * 0.9);
    for (let i = 0; i < 5; i += 1) {
      const angle = -0.35 + i * 0.17 + Math.sin(t * 0.2 + i) * 0.03;
      const g = ctx.createLinearGradient(W * 0.85, -H * 0.1, W * 0.85 - Math.sin(angle + 0.6) * W, H);
      g.addColorStop(0, `rgba(255,224,160,${0.22 * breathe * alpha})`);
      g.addColorStop(1, 'rgba(255,224,160,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(W * 0.85, -H * 0.1);
      ctx.lineTo(W * (0.15 - i * 0.12), H);
      ctx.lineTo(W * (0.3 - i * 0.12), H);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
    return;
  }
  const color = effect === 'embers' ? '255,150,60' : effect === 'dust' ? '235,205,160' : effect === 'sparkles' ? '255,240,190' : effect === 'fog' ? '220,220,225' : '255,255,255';
  if (effect === 'embers' || effect === 'sparkles') ctx.globalCompositeOperation = 'screen';
  for (const q of particlesAt(effect, t, seed)) {
    const a = q.a * alpha;
    if (a <= 0.01) continue;
    if (effect === 'rain') {
      ctx.strokeStyle = `rgba(${color},${a})`;
      ctx.lineWidth = Math.max(1, H * q.r);
      ctx.beginPath();
      ctx.moveTo(q.x * W, q.y * H);
      ctx.lineTo(q.x * W - (q.len || 0.04) * H * 0.12, q.y * H - (q.len || 0.04) * H);
      ctx.stroke();
    } else if (effect === 'fog') {
      ctx.globalAlpha = Math.min(1, a);
      ctx.drawImage(glow(color), q.x * W - q.r * H * 1.6, q.y * H - q.r * H * 1.6, q.r * H * 3.2, q.r * H * 3.2);
      ctx.globalAlpha = 1;
    } else {
      const r = Math.max(0.6, q.r * H);
      if (effect === 'embers' || effect === 'sparkles' || effect === 'stars') {
        ctx.globalAlpha = Math.min(1, a);
        ctx.drawImage(glow(color), q.x * W - r * 3, q.y * H - r * 3, r * 6, r * 6);
        ctx.globalAlpha = 1;
      } else {
        ctx.fillStyle = `rgba(${color},${a})`;
        ctx.beginPath();
        ctx.arc(q.x * W, q.y * H, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  ctx.restore();
}

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
export function drawFrame(ctx: CanvasRenderingContext2D, board: Storyboard, pictures: Array<Visual | null>, t: number) {
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
    const [iw, ih] = pic ? sizeOf(pic) : [0, 0];
    if (pic && iw && ih && isVideo(pic)) {
      // Real footage already moves: drawn as it is, covering the frame.
      const [sx, sy, sw, sh] = coverRect(iw, ih, W, H, { scale: 1, x: 0, y: 0 });
      ctx.drawImage(pic, sx, sy, sw, sh, 0, 0, W, H);
    } else if (pic && iw && ih) {
      const cam = cameraAt(scene.motion, p);
      const [sx, sy, sw, sh] = coverRect(iw, ih, W, H, cam);
      ctx.drawImage(pic, sx, sy, sw, sh, 0, 0, W, H);
      if (board.depth !== false && scene.motion !== 'still') {
        // Depth: the middle of the picture (usually the subject) moves a little more than the background, on its own
        // layer with soft edges — the eye reads it as near and far, like a filmed shot.
        // Starts identical and drifts apart only a little, so the eye feels depth without seeing a doubled edge.
        const near = { scale: cam.scale * (1 + 0.022 * p), x: cam.x * 1.22, y: cam.y * 1.22 };
        const [nx, ny, nw, nh] = coverRect(iw, ih, W, H, near);
        const c = layer('near', W, H);
        const l = c.getContext('2d')!;
        l.globalCompositeOperation = 'source-over';
        l.clearRect(0, 0, W, H);
        l.drawImage(pic, nx, ny, nw, nh, 0, 0, W, H);
        l.globalCompositeOperation = 'destination-in';
        const m = l.createRadialGradient(W / 2, H * 0.55, Math.min(W, H) * 0.12, W / 2, H * 0.55, Math.min(W, H) * 0.48);
        m.addColorStop(0, 'rgba(0,0,0,1)');
        m.addColorStop(1, 'rgba(0,0,0,0)');
        l.fillStyle = m;
        l.fillRect(0, 0, W, H);
        ctx.drawImage(c, 0, 0);
      }
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
  // Atmosphere of the scene (and of the next one as it fades in).
  if (f.index >= 0) {
    const seed = board.seed || 1;
    drawEffect(ctx, board.scenes[f.index]!.effect, t, seed, 1 - f.mix);
    if (f.next >= 0 && f.mix > 0) drawEffect(ctx, board.scenes[f.next]!.effect, t, seed + 1, f.mix);
  }
  // Colour grading by mood, and a fine film grain.
  const grade = GRADE[board.mood];
  ctx.save();
  ctx.globalCompositeOperation = grade.mode;
  ctx.globalAlpha = grade.alpha;
  ctx.fillStyle = grade.color;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
  if (typeof document !== 'undefined') {
    const tile = grainTile();
    const pattern = ctx.createPattern(tile, 'repeat');
    if (pattern) {
      ctx.save();
      ctx.translate(-((t * 997) % 160), -((t * 613) % 160));
      ctx.fillStyle = pattern;
      ctx.fillRect(0, 0, W + 160, H + 160);
      ctx.restore();
    }
  }
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
    // Word by word, at the pace of speech: the words not said yet wait faintly, the said ones light up.
    let shown = wordsShown(scene.caption, local, scene.seconds);
    const base = ctx.globalAlpha;
    lines.forEach((line, i) => {
      const y = H - size * 1.6 - (lines.length - 1 - i) * size * 1.35 + lift;
      const words = line.split(/\s+/).filter(Boolean);
      const said = words.slice(0, Math.max(0, shown)).join(' ');
      shown -= words.length;
      if (said.length >= line.length) { ctx.fillText(line, W / 2, y); return; }
      ctx.globalAlpha = base * 0.38;
      ctx.fillText(line, W / 2, y);
      if (!said) { ctx.globalAlpha = base; return; }
      ctx.globalAlpha = base;
      const fw = ctx.measureText(line).width;
      ctx.textAlign = 'start';
      ctx.fillText(said, board.dir === 'rtl' ? W / 2 + fw / 2 : W / 2 - fw / 2, y);
      ctx.textAlign = 'center';
    });
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

/** Real clips of the scenes that have one, as video elements ready to draw (others keep their picture). */
export async function withClips(board: Storyboard, pictures: Array<Visual | null>, sound?: { audio: AudioContext; out: AudioNode }): Promise<{ visuals: Array<Visual | null>; videos: Array<HTMLVideoElement | null> }> {
  const videos = await Promise.all(board.scenes.map((scene) => new Promise<HTMLVideoElement | null>((resolve) => {
    if (!scene.clip || typeof document === 'undefined') { resolve(null); return; }
    const v = document.createElement('video');
    v.playsInline = true;
    v.preload = 'auto';
    v.loop = true;
    v.muted = !sound;
    const done = (ok: boolean) => { v.onloadeddata = null; v.onerror = null; resolve(ok ? v : null); };
    v.onloadeddata = () => done(true);
    v.onerror = () => done(false);
    setTimeout(() => done(v.readyState >= 2), 15_000);
    v.src = scene.clip;
  })));
  if (sound) for (const v of videos) { if (v) { try { sound.audio.createMediaElementSource(v).connect(sound.out); } catch { v.muted = true; } } }
  return { visuals: board.scenes.map((_, i) => videos[i] || pictures[i] || null), videos };
}
/** Keeps every clip playing only while its scene is on screen, from the right moment. */
export function syncClips(videos: Array<HTMLVideoElement | null>, board: Storyboard, t: number) {
  const f = frameAt(t, board.scenes);
  let start = 0;
  board.scenes.forEach((scene, i) => {
    const v = videos[i];
    if (v) {
      const on = i === f.index || i === f.next && f.mix > 0;
      if (on) {
        const local = Math.max(0, t - start);
        if (v.paused) { if (v.duration) v.currentTime = local % v.duration; void v.play().catch(() => {}); }
      } else if (!v.paused) v.pause();
    }
    start += scene.seconds;
  });
}
const stopClips = (videos: Array<HTMLVideoElement | null>) => { for (const v of videos) if (v) { v.pause(); v.removeAttribute('src'); v.load(); } };

/** Shaheen reads each scene's words aloud as it starts (the browser's own voices; preview only). */
function narrator(board: Storyboard) {
  const synth = typeof speechSynthesis !== 'undefined' ? speechSynthesis : undefined;
  if (!synth) return { at: (_t: number) => {}, stop: () => {} };
  const lang = board.dir === 'rtl' ? 'ar' : 'en';
  const voice = synth.getVoices().find((v) => v.lang.toLowerCase().startsWith(lang === 'ar' ? 'ar-eg' : 'en-us')) || synth.getVoices().find((v) => v.lang.toLowerCase().startsWith(lang));
  let said = -1;
  return {
    at(t: number) {
      const f = frameAt(t, board.scenes);
      if (f.index === said || f.index < 0) return;
      said = f.index;
      const text = board.scenes[f.index]!.caption.trim();
      if (!text) return;
      synth.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = voice?.lang || (lang === 'ar' ? 'ar-EG' : 'en-US');
      if (voice) u.voice = voice;
      u.rate = 0.95;
      synth.speak(u);
    },
    stop() { synth.cancel(); },
  };
}

/** Plays the video on a canvas in the page (music when `sound`, Shaheen's voice when `narrate`). Returns a stop function. */
export function play(canvas: HTMLCanvasElement, board: Storyboard, pictures: Array<Visual | null>, { sound = true, narrate = false, onTime, onEnd }: { sound?: boolean; narrate?: boolean; onTime?: (t: number) => void; onEnd?: () => void } = {}): () => void {
  const [W, H] = ASPECT_SIZE[board.aspect];
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return () => {};
  const end = totalSeconds(board.scenes);
  let audio: AudioContext | undefined;
  let stopMusic = () => {};
  let videos: Array<HTMLVideoElement | null> = [];
  const voice = narrate ? narrator(board) : undefined;
  let frame = 0;
  let stopped = false;
  const stop = () => { if (stopped) return; stopped = true; cancelAnimationFrame(frame); stopMusic(); stopClips(videos); voice?.stop(); void audio?.close().catch(() => {}); };
  if (sound && typeof AudioContext !== 'undefined') audio = new AudioContext();
  void withClips(board, pictures, audio ? { audio, out: audio.destination } : undefined).then(({ visuals, videos: v }) => {
    videos = v;
    if (stopped) { stopClips(v); return; }
    if (audio) stopMusic = scheduleMusic(audio, audio.destination, board);
    const started = performance.now();
    const tick = () => {
      if (stopped) return;
      const t = (performance.now() - started) / 1000;
      syncClips(videos, board, Math.min(t, end));
      voice?.at(t);
      drawFrame(ctx, board, visuals, Math.min(t, end));
      onTime?.(Math.min(t, end));
      if (t >= end) { stop(); onEnd?.(); return; }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
  });
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
export async function record(board: Storyboard, pictures: Array<Visual | null>, { music = true, onProgress, signal }: { music?: boolean; onProgress?: (fraction: number) => void; signal?: AbortSignal } = {}): Promise<{ blob: Blob; ext: 'webm' | 'mp4' }> {
  const type = recordingType();
  if (!type) throw new Error('NO_RECORDER');
  const [W, H] = ASPECT_SIZE[board.aspect];
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('NO_CANVAS');
  const stream = canvas.captureStream(30);
  let audio: AudioContext | undefined;
  let stopMusic = () => {};
  let dest: MediaStreamAudioDestinationNode | undefined;
  if (typeof AudioContext !== 'undefined' && (music || board.scenes.some((s) => s.clip))) {
    audio = new AudioContext();
    dest = audio.createMediaStreamDestination();
    for (const track of dest.stream.getAudioTracks()) stream.addTrack(track);
  }
  // Real clips bring their own sound (the professional engine makes it with the picture); it goes into the file too.
  const { visuals, videos } = await withClips(board, pictures, audio && dest ? { audio, out: dest } : undefined);
  if (audio && dest && music) stopMusic = scheduleMusic(audio, dest, board, audio.currentTime + 0.05);
  drawFrame(ctx, board, visuals, 0);
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
      syncClips(videos, board, Math.min(t, end));
      drawFrame(ctx, board, visuals, Math.min(t, end));
      onProgress?.(Math.min(1, t / end));
      if (t >= end + 0.3 || signal?.aborted) { clearInterval(timer); resolve(); }
    }, 1000 / 30);
  });
  recorder.stop();
  await done;
  stopMusic();
  stopClips(videos);
  for (const track of stream.getTracks()) track.stop();
  void audio?.close().catch(() => {});
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
  return { blob: new Blob(chunks, { type: type.mime.split(';')[0] }), ext: type.ext };
}

/** One still frame as a picture (the video's cover / thumbnail). */
export function posterOf(board: Storyboard, pictures: Array<Visual | null>, t = 3): string {
  const [W, H] = ASPECT_SIZE[board.aspect];
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  drawFrame(ctx, board, pictures, t);
  try { return canvas.toDataURL('image/jpeg', 0.9); } catch { return ''; }
}
