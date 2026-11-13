import React, { useMemo, useState } from 'react';
import { Check, Copy, Download, Globe, Loader2, Sparkles } from 'lucide-react';
import type { SupportedLanguage } from '../types/i18n';
import { errorKey } from '../workspace/workspaceApi';
import { wsText } from '../workspace/strings';
import { downloadBlob, safeFileName } from '../workspace/officeWriters';
import { FONT_PAIRS, HARMONIES, MOODS, paletteFrom } from './palette';
import { cloneSpec, type SiteSpec } from './siteSpec';
import { logoChoices } from './logo';
import { drawPicture } from './studioApi';
import type { T } from './StudioPanel';

const btn = 'inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-[12.5px] font-black cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed';
const soft = `${btn} border border-stone-200 bg-white text-stone-700 hover:border-amber-400`;
const strong = `${btn} bg-amber-800 text-white hover:bg-amber-900`;
const field = 'w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-[13px] focus:border-amber-500 focus:outline-none';
const svgUrl = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

/** The SVG drawn on a canvas as a PNG of `size` pixels. */
function svgToPng(svg: string, size = 1024): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const ratio = img.width && img.height ? img.width / img.height : 1;
      const c = document.createElement('canvas');
      c.width = ratio >= 1 ? size : Math.round(size * ratio);
      c.height = ratio >= 1 ? Math.round(size / ratio) : size;
      c.getContext('2d')?.drawImage(img, 0, 0, c.width, c.height);
      c.toBlob((b) => (b ? resolve(b) : reject(new Error('png'))), 'image/png');
    };
    img.onerror = () => reject(new Error('svg'));
    img.src = svgUrl(svg);
  });
}

export function LogoPanel({ lang, st, spec, commit, onDone }: { lang: SupportedLanguage; st: T; spec: SiteSpec | null; commit: (s: SiteSpec) => void; onDone: () => void }) {
  const [name, setName] = useState(spec?.name || '');
  const [base, setBase] = useState(spec?.theme.base || '#8a5a2b');
  const [picked, setPicked] = useState<string>('');
  const [aiLogo, setAiLogo] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [copied, setCopied] = useState('');
  const choices = useMemo(() => (name.trim() ? logoChoices(name.trim(), base) : []), [name, base]);
  const rtl = /[\u0600-\u06FF]/.test(name);

  const useInSite = () => {
    if (!spec || !picked) return;
    const next = cloneSpec(spec);
    next.logo = picked;
    next.theme.base = base;
    if (name.trim()) next.name = name.trim();
    commit(next);
    onDone();
  };
  const drawAi = async () => {
    if (!name.trim() || busy) return;
    setBusy(true); setNote('');
    try {
      setAiLogo(await drawPicture(`minimal modern flat vector logo for a brand named "${name.trim()}", brand colour ${base}, simple iconic symbol, clean white background, centered, professional, no mockup`, 1024, 1024));
    } catch (error) { setNote(wsText(lang, errorKey(error))); }
    setBusy(false);
  };
  const copy = async (text: string, id: string) => { try { await navigator.clipboard.writeText(text); setCopied(id); setTimeout(() => setCopied(''), 1500); } catch { /* no clipboard */ } };

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-stone-200 bg-white p-3 space-y-2">
        <div className="flex flex-wrap items-end gap-3">
          <label className="block grow text-[13px] font-black text-stone-800">{st('brand')}<input className={field} value={name} maxLength={40} onChange={(e) => { setName(e.target.value); setPicked(''); }} /></label>
          <label className="inline-flex items-center gap-2 text-[12.5px] font-bold text-stone-700">{st('color')}<input type="color" value={base} onChange={(e) => { setBase(e.target.value); setPicked(''); }} className="h-9 w-11 cursor-pointer rounded border border-stone-200" /></label>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(MOODS).map(([mood, color]) => <button key={mood} type="button" aria-label={mood} title={mood} onClick={() => { setBase(color); setPicked(''); }} className={`h-7 w-7 rounded-full border-2 cursor-pointer ${base === color ? 'border-stone-900' : 'border-white shadow'}`} style={{ background: color }} />)}
        </div>
      </div>
      {note && <p className="rounded-xl bg-amber-50 px-3 py-2 text-[12.5px] font-bold text-amber-900" role="status">{note}</p>}

      {choices.length > 0 && (
        <div className="rounded-2xl border border-stone-200 bg-white p-3 space-y-2">
          <h3 className="text-[13px] font-black text-stone-800">{st('pick_logo')}</h3>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 md:grid-cols-6">
            {choices.map((c) => (
              <button key={`${c.shape}-${c.variant}`} type="button" onClick={() => setPicked(c.svg)} aria-pressed={picked === c.svg} aria-label={`${c.shape} ${c.variant + 1}`}
                className={`grid aspect-square place-items-center rounded-xl border-2 bg-stone-50 p-2 cursor-pointer ${picked === c.svg ? 'border-amber-600 bg-amber-50' : 'border-transparent hover:border-stone-300'} ${c.shape === 'wordmark' ? 'col-span-2 aspect-auto' : ''}`}>
                <img src={svgUrl(c.svg)} alt="" className="max-h-24 w-full object-contain" />
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={strong} disabled={!picked || !spec} onClick={useInSite}><Globe className="h-4 w-4" />{st('use_in_site')}</button>
            <button type="button" className={soft} disabled={!picked} onClick={() => downloadBlob(new Blob([picked], { type: 'image/svg+xml' }), safeFileName(name, 'svg'))}><Download className="h-4 w-4" />{st('download_svg')}</button>
            <button type="button" className={soft} disabled={!picked} onClick={() => { void svgToPng(picked).then((b) => downloadBlob(b, safeFileName(name, 'png')), () => setNote(wsText(lang, 'failed'))); }}><Download className="h-4 w-4" />{st('download_png')}</button>
            <button type="button" className={soft} disabled={busy} onClick={() => void drawAi()}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}{st('ai_logo')}</button>
          </div>
          {aiLogo && <img src={aiLogo} alt={name} className="mx-auto max-h-72 rounded-xl border border-stone-200" />}
        </div>
      )}

      <div className="rounded-2xl border border-stone-200 bg-white p-3 space-y-2">
        <h3 className="text-[13px] font-black text-stone-800">{st('palette')}</h3>
        {HARMONIES.map((h) => {
          const p = paletteFrom(base, { harmony: h });
          const colors = [p.primary, p.accent, p.bg, p.surface, p.text, p.muted];
          return (
            <div key={h} className="flex items-center gap-2">
              <div className="flex grow overflow-hidden rounded-lg border border-stone-200">
                {colors.map((c, i) => <span key={i} className="h-9 grow grid place-items-center text-[9.5px] font-bold" style={{ background: c, color: i === 0 ? p.onPrimary : i >= 4 ? p.bg : p.text }} dir="ltr">{c}</span>)}
              </div>
              <button type="button" aria-label={st('copy_colors')} title={st('copy_colors')} onClick={() => void copy(colors.join(', '), h)} className="rounded-lg p-2 text-stone-500 hover:bg-stone-100 cursor-pointer">{copied === h ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}</button>
            </div>
          );
        })}
      </div>

      <div className="rounded-2xl border border-stone-200 bg-white p-3 space-y-1.5">
        <h3 className="text-[13px] font-black text-stone-800">{st('fonts')}</h3>
        <ul className="grid gap-1.5 sm:grid-cols-2">
          {FONT_PAIRS.filter((f) => f.arabic === rtl || !rtl).map((f) => (
            <li key={f.id} className="rounded-xl bg-stone-50 px-3 py-2 text-[12.5px]"><b>{f.heading}</b>{f.body !== f.heading ? ` + ${f.body}` : ''}{f.arabic ? ' · ع' : ''}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
