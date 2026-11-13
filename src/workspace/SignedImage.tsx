import React, { useEffect, useRef, useState } from 'react';
import type { SupportedLanguage } from '../types/i18n';
import { signCanvas } from './motion';
import { wsText } from './strings';

/** Generated gallery preview: add our signature without altering embedded provider/provenance marks. */
export function SignedImage({ src, lang }: { src: string; lang: SupportedLanguage }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let live = true; setFailed(false);
    const image = new Image(); image.crossOrigin = 'anonymous';
    image.onload = () => {
      if (!live || !canvas.current) return;
      const c = canvas.current;
      const ratio = Math.min(1, 400 / Math.max(image.naturalWidth, image.naturalHeight));
      c.width = Math.max(1, Math.round(image.naturalWidth * ratio)); c.height = Math.max(1, Math.round(image.naturalHeight * ratio));
      const ctx = c.getContext('2d');
      if (!ctx) { setFailed(true); return; }
      ctx.drawImage(image, 0, 0, c.width, c.height); signCanvas(ctx, c.width, c.height);
    };
    image.onerror = () => { if (live) setFailed(true); };
    image.src = src;
    return () => { live = false; image.onload = null; image.onerror = null; };
  }, [src]);
  return failed ? <span role="status">{wsText(lang, 'image_failed')}</span> : <canvas ref={canvas} aria-label={wsText(lang, 'signed_image')} className="aspect-square w-full object-contain" />;
}
