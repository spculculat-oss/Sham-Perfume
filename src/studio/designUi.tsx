/** «استوديو شاهين» — small shared pieces of the design tools' screens. */
import React, { useEffect, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { MOODS } from './palette';

export const btn = 'inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-[12.5px] font-black cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed';
export const soft = `${btn} border border-stone-200 bg-white text-stone-700 hover:border-amber-400`;
export const strong = `${btn} bg-amber-800 text-white hover:bg-amber-900`;
export const field = 'w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-[13px] focus:border-amber-500 focus:outline-none';
export const card = 'rounded-2xl border border-stone-200 bg-white p-3 space-y-2';
export const label = 'block text-[12.5px] font-black text-stone-800';
export const svgUrl = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

/** A row of choices (one selected). */
export function Chips<V extends string>({ value, options, onChange, name }: { value: V; options: Array<{ id: V; label: string }>; onChange: (v: V) => void; name: string }) {
  return (
    <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={name}>
      {options.map((o) => (
        <button key={o.id} type="button" role="radio" aria-checked={value === o.id} onClick={() => onChange(o.id)}
          className={`rounded-full px-3 py-1.5 text-[12px] font-bold cursor-pointer ${value === o.id ? 'bg-stone-900 text-white' : 'border border-stone-200 bg-white text-stone-700 hover:border-amber-400'}`}>{o.label}</button>
      ))}
    </div>
  );
}

/** The colour picker with the ready mood colours. */
export function ColorPick({ value, onChange, title }: { value: string; onChange: (v: string) => void; title: string }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <label className="inline-flex items-center gap-2 text-[12.5px] font-bold text-stone-700">{title}
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="h-8 w-10 cursor-pointer rounded border border-stone-200" />
      </label>
      {Object.entries(MOODS).map(([mood, color]) => (
        <button key={mood} type="button" aria-label={mood} title={mood} onClick={() => onChange(color)}
          className={`h-6 w-6 rounded-full border-2 cursor-pointer ${value === color ? 'border-stone-900' : 'border-white shadow'}`} style={{ background: color }} />
      ))}
    </div>
  );
}

/** Copy a text, with a short «copied ✓». */
export function CopyButton({ text, label: text1, done }: { text: string; label: string; done: string }) {
  const [ok, setOk] = useState(false);
  useEffect(() => { if (!ok) return undefined; const t = setTimeout(() => setOk(false), 1500); return () => clearTimeout(t); }, [ok]);
  return (
    <button type="button" className={soft} onClick={() => { void navigator.clipboard?.writeText(text).then(() => setOk(true), () => undefined); }}>
      {ok ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}{ok ? done : text1}
    </button>
  );
}

/** A code box (read-only, left-to-right). */
export function CodeBox({ code, rows = 8 }: { code: string; rows?: number }) {
  return <textarea readOnly dir="ltr" spellCheck={false} value={code} rows={rows} className="w-full rounded-xl border border-stone-800 bg-stone-950 p-3 font-mono text-[11.5px] leading-relaxed text-amber-100" onFocus={(e) => e.currentTarget.select()} />;
}

/** The SVG drawn on a canvas as a PNG `scale` times its size. */
export function svgToPng(svg: string, width: number, height: number, scale = 1): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = Math.round(width * scale); c.height = Math.round(height * scale);
      const ctx = c.getContext('2d');
      if (!ctx) { reject(new Error('canvas')); return; }
      ctx.drawImage(img, 0, 0, c.width, c.height);
      c.toBlob((b) => (b ? resolve(b) : reject(new Error('png'))), 'image/png');
    };
    img.onerror = () => reject(new Error('svg'));
    img.src = svgUrl(svg);
  });
}

/** Load a Google Fonts stylesheet once, so on-page previews show the real letters. */
export function useFontCss(href: string) {
  useEffect(() => {
    if (!href || document.querySelector(`link[data-studio-font="${CSS.escape(href)}"]`)) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet'; link.href = href; link.dataset.studioFont = href;
    document.head.appendChild(link);
  }, [href]);
}

/** A picked file as a data: URL (pictures only, up to 8 MB). */
export function readPicture(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!/^image\/(png|jpe?g|webp|gif)$/.test(file.type) || file.size > 8 * 1024 * 1024) { reject(new Error('type')); return; }
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('read'));
    reader.readAsDataURL(file);
  });
}
