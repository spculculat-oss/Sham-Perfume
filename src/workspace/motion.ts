/** Local image animation, not generative text-to-video. No upload, microphone, or camera. */
export const SHAHIN_SIGNATURE = 'sharin ai';
export const MOTION_SECONDS = 6;
export const VIDEO_TYPES = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4'];
export function videoMime(supported: (mime: string) => boolean): string | undefined { return VIDEO_TYPES.find(supported); }
export function motionFrame(progress: number) {
  const p = Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 0));
  const ease = p * p * (3 - 2 * p);
  return { zoom: 1.04 + 0.12 * ease, x: -0.015 + 0.03 * ease, y: 0.01 - 0.02 * ease };
}
export function wantsMotion(text: string) {
  return /(?:اعمل|اعملى|اعملي|اعمللي|اصنع|أنشئ|انشئ|حول|حوّل|حرك|حرّك|خل.?ها|make|create|animate|turn).{0,100}(?:فيديو|متحرك|حرك|video|animation|animate)|^(?:حرك|حرّك)\s+(?:الصورة|الصوره|دي|دى)|\banimate\s+(?:this|the|my)\s+(?:image|photo|picture)/i.test(text);
}
export function signCanvas(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const size = Math.max(14, Math.round(Math.min(width, height) * 0.035));
  ctx.save(); ctx.filter = 'none'; ctx.direction = 'ltr';
  ctx.font = `600 ${size}px system-ui, sans-serif`; ctx.textAlign = 'right'; ctx.textBaseline = 'bottom';
  ctx.lineWidth = Math.max(2, size / 7); ctx.strokeStyle = 'rgba(0,0,0,0.75)'; ctx.fillStyle = '#fff';
  ctx.strokeText(SHAHIN_SIGNATURE, width - size * 0.6, height - size * 0.5);
  ctx.fillText(SHAHIN_SIGNATURE, width - size * 0.6, height - size * 0.5); ctx.restore();
}
export function canvasBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    try { canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Image export failed')), 'image/png'); }
    catch { reject(new Error('Image export blocked by browser/CORS')); }
  });
}
export async function recordMotion(source: HTMLCanvasElement, signal: AbortSignal): Promise<Blob> {
  signal.throwIfAborted();
  if (typeof MediaRecorder === 'undefined' || typeof source.captureStream !== 'function') throw new Error('VIDEO_UNSUPPORTED');
  const mime = videoMime((value) => MediaRecorder.isTypeSupported(value));
  if (!mime) throw new Error('VIDEO_UNSUPPORTED');
  const canvas = document.createElement('canvas');
  const scale = Math.min(1, 1280 / Math.max(source.width, source.height));
  canvas.width = Math.max(2, Math.round(source.width * scale / 2) * 2);
  canvas.height = Math.max(2, Math.round(source.height * scale / 2) * 2);
  const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('CANVAS_UNSUPPORTED');
  const draw = (p: number) => {
    const f = motionFrame(p); const { width: w, height: h } = canvas;
    ctx.clearRect(0, 0, w, h); ctx.save(); ctx.translate(w / 2 + f.x * w, h / 2 + f.y * h);
    ctx.scale(f.zoom, f.zoom); ctx.drawImage(source, -w / 2, -h / 2, w, h); ctx.restore();
    signCanvas(ctx, w, h);
  };
  draw(0);
  // Throws for tainted canvases before creating a stream; no fake success or silent remote upload.
  canvas.toDataURL('image/png');
  const stream = canvas.captureStream(24);
  let recorder: MediaRecorder | undefined;
  let frame: ReturnType<typeof setInterval> | undefined;
  let finish: ReturnType<typeof setTimeout> | undefined;
  let watchdog: ReturnType<typeof setTimeout> | undefined;
  let cancel: (() => void) | undefined;
  try {
    recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 2500000 });
    const output = await new Promise<Blob>((resolve, reject) => {
      const chunks: Blob[] = []; let bytes = 0;
      const rec = recorder!;
      cancel = () => reject(new DOMException('Cancelled', 'AbortError'));
      signal.addEventListener('abort', cancel, { once: true });
      if (signal.aborted) { cancel(); return; }
      rec.ondataavailable = (event) => {
        if (event.data.size) { bytes += event.data.size; chunks.push(event.data); }
        if (bytes > 16000000) reject(new Error('Video too large'));
      };
      rec.onerror = () => reject(new Error('Video recording failed'));
      rec.onstop = () => signal.aborted ? cancel!() : bytes ? resolve(new Blob(chunks, { type: rec.mimeType || mime })) : reject(new Error('Empty recording'));
      rec.start(250);
      const started = performance.now();
      frame = setInterval(() => { try { draw((performance.now() - started) / (MOTION_SECONDS * 1000)); } catch { reject(new Error('Frame failed')); } }, 1000 / 24);
      finish = setTimeout(() => { if (rec.state !== 'inactive') rec.stop(); }, MOTION_SECONDS * 1000);
      watchdog = setTimeout(() => reject(new Error('Video recording timed out')), 12000);
    });
    signal.throwIfAborted(); return output;
  } finally {
    if (frame) clearInterval(frame); if (finish) clearTimeout(finish); if (watchdog) clearTimeout(watchdog);
    if (cancel) signal.removeEventListener('abort', cancel);
    if (recorder) { recorder.onstop = null; recorder.onerror = null; recorder.ondataavailable = null; if (recorder.state !== 'inactive') recorder.stop(); }
    stream.getTracks().forEach((track) => track.stop());
  }
}
