import { SignedImage } from './SignedImage';
import { realPhotoReply } from '../utils/realPhotos';
import { extractMediaRequest, stripMediaBlock } from '../utils/shaheenMedia';
import { ShaheenMedia } from '../components/ShaheenMedia';
import { MotionCard } from './MotionCard';
import { canvasBlob, fitForUpload, signCanvas } from './motion';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Download, FlipHorizontal, ImagePlus, Loader2, RotateCw, Save, Sparkles, Undo2, Wand2 } from 'lucide-react';
import type { SupportedLanguage } from '../types/i18n';
import { imageErrorKey, makeImage } from './workspaceApi';
import { IMAGE_STYLES, type ImageAspect, type ImageStyleId } from '../utils/imageCraft';
import { saveFile } from './fileStore';
import { downloadBlob } from './officeWriters';
import { wsText, type WsKey } from './strings';

interface Adjust { brightness: number; contrast: number; saturate: number; blur: number; grayscale: boolean; sepia: boolean; rotate: number; flip: boolean; text: string; textSize: number; textColor: string }
const START: Adjust = { brightness: 100, contrast: 100, saturate: 100, blur: 0, grayscale: false, sepia: false, rotate: 0, flip: false, text: '', textSize: 6, textColor: '#ffffff' };
export const filterOf = (a: Pick<Adjust, 'brightness' | 'contrast' | 'saturate' | 'blur' | 'grayscale' | 'sepia'>) =>
  `brightness(${a.brightness}%) contrast(${a.contrast}%) saturate(${a.saturate}%)${a.blur ? ` blur(${a.blur}px)` : ''}${a.grayscale ? ' grayscale(1)' : ''}${a.sepia ? ' sepia(1)' : ''}`;

/** The frame shapes offered as words (no digits to localise); «شاهين يختار» lets the idea decide. */
export const IMAGE_SIZES: { key: WsKey; aspect?: ImageAspect }[] = [
  { key: 'style_auto' }, { key: 'size_square', aspect: '1:1' }, { key: 'size_portrait', aspect: '3:4' },
  { key: 'size_landscape', aspect: '4:3' }, { key: 'size_story', aspect: '9:16' }, { key: 'size_wide', aspect: '16:9' },
];
const chip = (on: boolean) => `rounded-full border px-2.5 py-1 text-[11px] font-bold cursor-pointer ${on ? 'border-amber-700 bg-amber-700 text-white' : 'border-stone-300 bg-white text-stone-700'}`;

/** «صور»: draw an image from words, then edit it (or one from the device) — light, colour, turn, flip, words on it. */
export function ImagesPanel({ lang, aiImages, incoming, onIncomingUsed }: { lang: SupportedLanguage; aiImages: boolean; incoming: Blob | null; onIncomingUsed: () => void }) {
  const w = (k: WsKey) => wsText(lang, k);
  const [prompt, setPrompt] = useState('');
  const [style, setStyle] = useState<ImageStyleId>('auto');
  const [aspect, setAspect] = useState<ImageAspect | undefined>();
  const [busy, setBusy] = useState<'' | 'make' | 'edit'>('');
  const [photoReply, setPhotoReply] = useState('');
  const [gallery, setGallery] = useState<string[]>([]);
  const [source, setSource] = useState<HTMLImageElement | null>(null);
  const [adjust, setAdjust] = useState<Adjust>(START);
  const [editPrompt, setEditPrompt] = useState('');
  const [note, setNote] = useState('');
  const [motionSource, setMotionSource] = useState('');
  const canvas = useRef<HTMLCanvasElement>(null);
  const unsigned = useRef<HTMLCanvasElement | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback((src: string) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => { setSource(img); setAdjust(START); setNote(''); setMotionSource(''); };
    img.onerror = () => setNote(w('image_failed'));
    img.src = src;
  }, [lang]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!incoming) return;
    const url = URL.createObjectURL(incoming);
    load(url);
    onIncomingUsed();
  }, [incoming, load, onIncomingUsed]);

  useEffect(() => {
    const c = canvas.current;
    if (!c || !source) return;
    const turned = adjust.rotate % 180 !== 0;
    const scale = Math.min(1, 1600 / Math.max(source.naturalWidth, source.naturalHeight));
    const iw = Math.round(source.naturalWidth * scale);
    const ih = Math.round(source.naturalHeight * scale);
    c.width = turned ? ih : iw;
    c.height = turned ? iw : ih;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.save();
    ctx.filter = filterOf(adjust);
    ctx.translate(c.width / 2, c.height / 2);
    ctx.rotate((adjust.rotate * Math.PI) / 180);
    if (adjust.flip) ctx.scale(-1, 1);
    ctx.drawImage(source, -iw / 2, -ih / 2, iw, ih);
    ctx.restore();
    if (adjust.text.trim()) {
      const size = Math.round((Math.min(c.width, c.height) * adjust.textSize) / 100);
      ctx.font = `bold ${size}px system-ui, Tahoma, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.direction = /[\u0600-\u06FF]/.test(adjust.text) ? 'rtl' : 'ltr';
      ctx.lineWidth = Math.max(2, size / 8);
      ctx.strokeStyle = 'rgba(0,0,0,0.65)';
      ctx.fillStyle = adjust.textColor;
      ctx.strokeText(adjust.text, c.width / 2, c.height - size * 0.6);
      ctx.fillText(adjust.text, c.width / 2, c.height - size * 0.6);
    }
    const original = document.createElement('canvas'); original.width = c.width; original.height = c.height;
    original.getContext('2d')?.drawImage(c, 0, 0); unsigned.current = original;
    signCanvas(ctx, c.width, c.height);
  }, [source, adjust]);

  const generate = async () => {
    if (!prompt.trim() || busy) return;
    const found = realPhotoReply(prompt, [], lang);
    if (found) { setPhotoReply(found); setNote(stripMediaBlock(found)); setSource(null); setGallery([]); setMotionSource(''); return; }
    setPhotoReply('');
    setBusy('make'); setNote('');
    try { const out = await makeImage(prompt.trim(), undefined, undefined, { style, aspect }); load(out.src); setGallery((g) => [out.src, ...g].slice(0, 12)); } catch (e) { setNote(w(imageErrorKey(e))); } finally { setBusy(''); }
  };
  const blob = async () => {
    try {
      const original = canvas.current; if (!original) return null;
      const signed = document.createElement('canvas'); signed.width = original.width; signed.height = original.height;
      const ctx = signed.getContext('2d'); if (!ctx) return null;
      ctx.drawImage(original, 0, 0); return await canvasBlob(signed);
    } catch { return null; }
  };
  const exportImage = async (to: 'download' | 'save') => {
    const b = await blob();
    if (!b) { setNote(w('image_failed')); return; }
    const name = `sharing-ai-${Date.now().toString(36)}.png`;
    if (to === 'download') downloadBlob(b, name); else { await saveFile(name, b, 'image/png'); setNote(w('saved')); }
  };
  const aiEdit = async () => {
    if (!editPrompt.trim() || !canvas.current || busy) return;
    setBusy('edit'); setNote('');
    try {
      const data = (unsigned.current || canvas.current).toDataURL('image/png');
      const out = await makeImage(editPrompt.trim(), await fitForUpload(data));
      load(out.src);
    } catch (e) { setNote(w(imageErrorKey(e))); } finally { setBusy(''); }
  };
  const slider = (key: 'brightness' | 'contrast' | 'saturate' | 'blur', label: string, min: number, max: number) => (
    <label className="flex items-center gap-2 text-[12px] text-stone-700">
      <span className="w-20 shrink-0 font-bold">{label}</span>
      <input type="range" min={min} max={max} value={adjust[key]} onChange={(e) => setAdjust({ ...adjust, [key]: Number(e.target.value) })} className="flex-1 accent-amber-700" />
    </label>
  );

  return (
    <div className="space-y-4" data-testid="ws-images">
      <div className="flex gap-2">
        <input value={prompt} onChange={(e) => setPrompt(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void generate(); }} dir="auto" placeholder={w('image_ph')}
          className="flex-1 rounded-xl border border-stone-300 px-3 py-2 text-sm outline-none focus:border-amber-500" />
        <button type="button" onClick={() => { void generate(); }} disabled={!prompt.trim() || Boolean(busy)} className="inline-flex items-center gap-1 rounded-xl bg-amber-800 px-4 py-2 text-sm font-black text-white disabled:opacity-50 cursor-pointer">
          {busy === 'make' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}{w('generate')}
        </button>
      </div>
      <div className="space-y-1.5" data-testid="ws-image-look">
        <div role="group" aria-label={w('style_label')} className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-black text-stone-500">{w('style_label')}</span>
          {IMAGE_STYLES.map((id) => (
            <button type="button" key={id} aria-pressed={style === id} onClick={() => setStyle(id)} className={chip(style === id)}>{w(`style_${id}`)}</button>
          ))}
        </div>
        <div role="group" aria-label={w('size_label')} className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-black text-stone-500">{w('size_label')}</span>
          {IMAGE_SIZES.map((size) => (
            <button type="button" key={size.key} aria-pressed={aspect === size.aspect} onClick={() => setAspect(size.aspect)} className={chip(aspect === size.aspect)}>{w(size.key)}</button>
          ))}
        </div>
        <p className="text-[11px] text-stone-500">{w('image_hint')}</p>
      </div>
      {!aiImages && <p role="status" className="text-xs text-stone-600">{w('image_unavailable')}</p>}
      {photoReply && extractMediaRequest(photoReply) && <ShaheenMedia request={extractMediaRequest(photoReply)!} lang={lang} />}
      {busy === 'make' && <p className="text-[12px] text-stone-500">{w('drawing')}</p>}
      {gallery.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {gallery.map((src, i) => (
            <button type="button" key={src + i} onClick={() => load(src)} className="overflow-hidden rounded-xl border border-stone-200 bg-stone-50 cursor-pointer" title={w('edit_image')}>
              <SignedImage src={src} lang={lang} />
            </button>
          ))}
        </div>
      )}
      <div>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) load(URL.createObjectURL(f)); e.target.value = ''; }} />
        <button type="button" onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-1.5 rounded-xl border border-stone-300 px-3 py-1.5 text-[12px] font-bold text-stone-700 cursor-pointer"><ImagePlus className="h-3.5 w-3.5" />{w('edit_image')}</button>
      </div>
      {source && (
        <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
          <canvas ref={canvas} className="max-h-[70vh] w-full rounded-xl border border-stone-200 bg-[repeating-conic-gradient(#f5f5f4_0_25%,#fff_0_50%)] bg-[length:16px_16px] object-contain" />
          <div className="space-y-2.5">
            {slider('brightness', w('brightness'), 30, 200)}
            {slider('contrast', w('contrast'), 30, 200)}
            {slider('saturate', w('saturation'), 0, 250)}
            {slider('blur', w('blur'), 0, 12)}
            <div className="flex flex-wrap gap-1.5">
              <button type="button" aria-pressed={adjust.grayscale} onClick={() => setAdjust({ ...adjust, grayscale: !adjust.grayscale })} className={`rounded-lg border px-2 py-1 text-[11px] font-bold cursor-pointer ${adjust.grayscale ? 'border-amber-600 bg-amber-50' : 'border-stone-200'}`}>{w('grayscale')}</button>
              <button type="button" aria-pressed={adjust.sepia} onClick={() => setAdjust({ ...adjust, sepia: !adjust.sepia })} className={`rounded-lg border px-2 py-1 text-[11px] font-bold cursor-pointer ${adjust.sepia ? 'border-amber-600 bg-amber-50' : 'border-stone-200'}`}>{w('sepia')}</button>
              <button type="button" onClick={() => setAdjust({ ...adjust, rotate: (adjust.rotate + 90) % 360 })} className="inline-flex items-center gap-1 rounded-lg border border-stone-200 px-2 py-1 text-[11px] font-bold cursor-pointer"><RotateCw className="h-3 w-3" />{w('rotate')}</button>
              <button type="button" onClick={() => setAdjust({ ...adjust, flip: !adjust.flip })} className="inline-flex items-center gap-1 rounded-lg border border-stone-200 px-2 py-1 text-[11px] font-bold cursor-pointer"><FlipHorizontal className="h-3 w-3" />{w('flip')}</button>
              <button type="button" onClick={() => setAdjust(START)} className="inline-flex items-center gap-1 rounded-lg border border-stone-200 px-2 py-1 text-[11px] font-bold cursor-pointer"><Undo2 className="h-3 w-3" />{w('reset')}</button>
            </div>
            <label className="block text-[12px] font-bold text-stone-700">{w('add_text')}
              <div className="mt-1 flex gap-1.5">
                <input value={adjust.text} onChange={(e) => setAdjust({ ...adjust, text: e.target.value })} dir="auto" className="min-w-0 flex-1 rounded-lg border border-stone-300 px-2 py-1 text-sm font-normal" />
                <input type="color" value={adjust.textColor} onChange={(e) => setAdjust({ ...adjust, textColor: e.target.value })} aria-label={w('add_text')} className="h-8 w-9 rounded border border-stone-300" />
              </div>
              <input type="range" min={3} max={16} value={adjust.textSize} onChange={(e) => setAdjust({ ...adjust, textSize: Number(e.target.value) })} className="mt-1 w-full accent-amber-700" aria-label={w('add_text')} />
            </label>
            {aiImages && (
              <div className="space-y-1.5 border-t border-stone-200 pt-2">
                <input value={editPrompt} onChange={(e) => setEditPrompt(e.target.value)} dir="auto" placeholder={w('ai_edit_ph')} className="w-full rounded-lg border border-stone-300 px-2 py-1.5 text-[12px]" />
                <button type="button" onClick={() => { void aiEdit(); }} disabled={!editPrompt.trim() || Boolean(busy)} className="inline-flex items-center gap-1 rounded-lg bg-violet-700 px-2.5 py-1 text-[11px] font-bold text-white disabled:opacity-50 cursor-pointer">
                  {busy === 'edit' ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wand2 className="h-3 w-3" />}{w('ai_edit')}
                </button>
              </div>
            )}
            <div className="flex flex-wrap gap-1.5 border-t border-stone-200 pt-2">
              <button type="button" onClick={() => { try { if (canvas.current) setMotionSource((unsigned.current || canvas.current).toDataURL('image/png')); } catch { setNote(w('motion_failed')); } }} className="rounded-lg border border-amber-500 px-3 py-1 text-xs font-bold">{w('motion_create')}</button>
              <button type="button" onClick={() => { void exportImage('download'); }} className="inline-flex items-center gap-1 rounded-lg bg-stone-900 px-2.5 py-1 text-[11px] font-bold text-white cursor-pointer"><Download className="h-3 w-3" />{w('download')}</button>
              <button type="button" onClick={() => { void exportImage('save'); }} className="inline-flex items-center gap-1 rounded-lg border border-stone-300 px-2.5 py-1 text-[11px] font-bold cursor-pointer"><Save className="h-3 w-3" />{w('save_file')}</button>
            </div>
          </div>
        </div>
      )}
      {motionSource && <MotionCard src={motionSource} lang={lang} />}
      {note && <p className="rounded-xl bg-stone-100 p-2.5 text-[12px] text-stone-700">{note}</p>}
    </div>
  );
}
