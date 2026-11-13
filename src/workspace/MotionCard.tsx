import React, { useEffect, useRef, useState } from 'react';
import type { SupportedLanguage } from '../types/i18n';
import { wsText } from './strings';
import { canvasBlob, recordMotion, signCanvas } from './motion';
import { downloadBlob } from './officeWriters';

/** One signed export path for generated chat images and local motion clips. */
export function MotionCard({ src, lang }: { src: string; lang: SupportedLanguage }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const raw = useRef<HTMLCanvasElement | null>(null);
  const abort = useRef<AbortController | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [video, setVideo] = useState<{ url: string; blob: Blob } | null>(null);
  const w = (key: Parameters<typeof wsText>[1]) => wsText(lang, key);
  useEffect(() => {
    let live = true; setReady(false); setError(''); setVideo(null); setBusy(false);
    const image = new Image(); image.crossOrigin = 'anonymous';
    image.onload = () => {
      if (!live || !canvas.current) return;
      const c = canvas.current;
      const ratio = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight));
      c.width = Math.max(1, Math.round(image.naturalWidth * ratio)); c.height = Math.max(1, Math.round(image.naturalHeight * ratio));
      const ctx = c.getContext('2d'); if (!ctx) { setError(w('motion_failed')); return; }
      ctx.drawImage(image, 0, 0, c.width, c.height);
      const original = document.createElement('canvas'); original.width = c.width; original.height = c.height;
      original.getContext('2d')?.drawImage(c, 0, 0); raw.current = original;
      signCanvas(ctx, c.width, c.height); setReady(true);
    };
    image.onerror = () => { if (live) setError(w('image_failed')); }; image.src = src;
    return () => { live = false; image.onload = null; image.onerror = null; abort.current?.abort(); };
  }, [src]);
  useEffect(() => () => { if (video) URL.revokeObjectURL(video.url); }, [video]);
  const animate = async () => {
    if (!canvas.current || !ready || busy) return;
    const controller = new AbortController(); abort.current = controller; setBusy(true); setError('');
    try {
      const blob = await recordMotion(raw.current || canvas.current, controller.signal);
      if (!controller.signal.aborted) setVideo({ url: URL.createObjectURL(blob), blob });
    } catch (error) {
      if (!controller.signal.aborted) setError(error instanceof Error && error.message === 'VIDEO_UNSUPPORTED' ? w('motion_unsupported') : w('motion_failed'));
    } finally { if (!controller.signal.aborted) setBusy(false); }
  };
  return <div className="mt-2 space-y-2" data-testid="ws-motion">
    <canvas ref={canvas} aria-label={w('signed_image')} className="max-h-[65vh] max-w-full rounded-xl border border-stone-200 object-contain" />
    <p className="text-xs text-stone-600">{w('motion_note')}</p>
    <div className="flex flex-wrap gap-2 text-xs">
      <button type="button" disabled={!ready || busy} onClick={() => { if (canvas.current) void canvasBlob(canvas.current).then((blob) => downloadBlob(blob, 'sharing-ai.png')).catch(() => setError(w('image_failed'))); }} className="rounded-lg border px-3 py-2 disabled:opacity-50">{w('download')}</button>
      <button type="button" disabled={!ready || busy} onClick={() => void animate()} className="rounded-lg bg-amber-800 px-3 py-2 text-white disabled:opacity-50">{busy ? w('motion_recording') : w('motion_create')}</button>
      {busy && <button type="button" onClick={() => { abort.current?.abort(); setBusy(false); }} className="rounded-lg border px-3 py-2">{w('stop')}</button>}
    </div>
    {video && <><video src={video.url} controls playsInline className="max-h-[65vh] max-w-full rounded-xl" /><button type="button" className="rounded-lg border px-3 py-2 text-xs" onClick={() => downloadBlob(video.blob, `sharing-ai.${video.blob.type.includes('mp4') ? 'mp4' : 'webm'}`)}>{w('motion_download')}</button></>}
    {error && <p role="alert" className="text-xs text-rose-700">{error}</p>}
  </div>;
}
