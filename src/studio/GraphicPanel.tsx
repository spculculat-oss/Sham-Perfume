/**
 * «استوديو شاهين» — graphic design: describe it (or fill it in), pick the size of the platform, the layout and the
 * colours, add a drawn or uploaded picture, and download a sharp PNG or an SVG with its fonts inside.
 */
import React, { useMemo, useRef, useState } from 'react';
import { Download, ImagePlus, Loader2, Sparkles, Upload } from 'lucide-react';
import type { SupportedLanguage } from '../types/i18n';
import { errorKey } from '../workspace/workspaceApi';
import { wsText } from '../workspace/strings';
import { downloadBlob, safeFileName } from '../workspace/officeWriters';
import { FONT_PAIRS, HARMONIES, fontPair, type Harmony } from './palette';
import { BACKGROUNDS, FORMAT_IDS, FORMATS, LAYOUTS, backgroundPrompt, cleanGraphic, embedFontCss, graphicFromReply, graphicSvg, isRtl, localGraphic, type GraphicBg, type GraphicFormat, type GraphicLayout, type GraphicSpec } from './graphic';
import { askDesign, drawPicture } from './studioApi';
import { dsText, type DesignKey } from './designStrings';
import { Chips, ColorPick, card, field, label, readPicture, soft, strong, svgToPng, useFontCss } from './designUi';
import type { T } from './StudioPanel';

const DRAFT = 'sham-studio-graphic-v1';
function loadDraft(lang: SupportedLanguage): GraphicSpec {
  const rtl = lang === 'ar' || lang === 'fa';
  const start: GraphicSpec = { format: 'post', layout: 'center', bg: 'gradient', base: '#8a5a2b', harmony: 'analogous', dark: false, font: rtl ? 'cairo' : 'poppins', headline: rtl ? 'عنوانك الكبير هنا' : 'Your big headline', sub: rtl ? 'جملة قصيرة بتشرح الفكرة' : 'One short line that explains it', cta: rtl ? 'اطلب الآن' : 'Order now', footer: '', decor: true };
  try { const raw = localStorage.getItem(DRAFT); return raw ? cleanGraphic(JSON.parse(raw), start) : start; } catch { return start; }
}

export function GraphicPanel({ lang, st, ai }: { lang: SupportedLanguage; st: T; ai: boolean }) {
  const d = (k: DesignKey) => dsText(lang, k);
  const [spec, setSpecRaw] = useState<GraphicSpec>(() => loadDraft(lang));
  const [idea, setIdea] = useState('');
  const [busy, setBusy] = useState<'' | 'idea' | 'draw' | 'png' | 'svg'>('');
  const [note, setNote] = useState('');
  const uploadRef = useRef<HTMLInputElement>(null);
  const setSpec = (next: GraphicSpec) => {
    setSpecRaw(next);
    try { localStorage.setItem(DRAFT, JSON.stringify(next.image?.startsWith('data:') && next.image.length > 1_500_000 ? { ...next, image: undefined } : next)); } catch { /* full */ }
  };
  const set = <K extends keyof GraphicSpec>(k: K, v: GraphicSpec[K]) => setSpec({ ...spec, [k]: v });
  const rtl = isRtl(`${spec.headline}${spec.sub}`);
  const pair = fontPair(spec.font, rtl);
  useFontCss(pair.css);
  const svg = useMemo(() => graphicSvg(spec), [spec]);
  const size = FORMATS[spec.format];

  const design = async () => {
    if (!idea.trim() || busy) return;
    setBusy('idea'); setNote('');
    const reply = await askDesign('graphic', idea, lang, { ai }).catch(() => undefined);
    const next = reply ? graphicFromReply(reply, spec) : undefined;
    setSpec(next || localGraphic(idea, spec));
    setNote(next ? d('done_ai') : d('done_local'));
    setBusy('');
  };
  const draw = async () => {
    if (busy) return;
    setBusy('draw'); setNote('');
    try {
      const { w, h } = FORMATS[spec.format];
      const src = await drawPicture(backgroundPrompt(spec), w, h);
      setSpec({ ...spec, image: src, bg: 'image' });
    } catch (error) { setNote(wsText(lang, errorKey(error))); }
    setBusy('');
  };
  const upload = async (file: File | undefined) => {
    if (!file) return;
    try { const src = await readPicture(file); setSpec({ ...spec, image: src, bg: 'image' }); } catch { setNote(wsText(lang, 'failed')); }
  };
  const fileName = (ext: string) => safeFileName(spec.headline || 'design', ext);
  const download = async (kind: 'png' | 'svg') => {
    setBusy(kind); setNote('');
    try {
      const fontCss = await embedFontCss(spec.font, rtl);
      const full = graphicSvg(spec, { fontCss });
      if (kind === 'svg') downloadBlob(new Blob([full], { type: 'image/svg+xml' }), fileName('svg'));
      else downloadBlob(await svgToPng(full, size.w, size.h, spec.format === 'poster' ? 2 : 1), fileName('png'));
    } catch { setNote(wsText(lang, 'failed')); }
    setBusy('');
  };

  const formatKey = (f: GraphicFormat) => `f_${f}` as DesignKey;
  const fonts = FONT_PAIRS.filter((f) => !rtl || f.arabic);
  return (
    <div className="space-y-3" data-testid="studio-graphic">
      <div className={card}>
        <label className={label}>{d('g_idea')}
          <textarea className={`${field} mt-1 min-h-[70px]`} value={idea} maxLength={1500} onChange={(e) => setIdea(e.target.value)} placeholder={d('g_idea_ph')} />
        </label>
        <button type="button" className={strong} disabled={!idea.trim() || Boolean(busy)} onClick={() => void design()}>
          {busy === 'idea' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}{busy === 'idea' ? d('working') : d('idea_go')}
        </button>
      </div>
      {note && <p className="rounded-xl bg-amber-50 px-3 py-2 text-[12.5px] font-bold text-amber-900" role="status">{note}</p>}

      <div className="grid gap-3 lg:grid-cols-[1fr_340px]">
        <div className="space-y-2">
          <div className="grid place-items-center rounded-2xl border border-stone-200 bg-[repeating-conic-gradient(#f5f5f4_0_25%,#fff_0_50%)] bg-[length:20px_20px] p-3">
            {/* Our own SVG (every word escaped, the picture checked) — inline so the page's fonts draw it. */}
            <div className="w-full max-w-[560px] overflow-hidden rounded-lg shadow-lg [&>svg]:block [&>svg]:h-auto [&>svg]:w-full" style={{ maxHeight: 640, aspectRatio: `${size.w} / ${size.h}`, maxWidth: size.h > size.w ? 360 : 560 }}
              role="img" aria-label={spec.headline} dangerouslySetInnerHTML={{ __html: svg }} />
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={strong} disabled={Boolean(busy)} onClick={() => void download('png')}>{busy === 'png' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}{st('download_png')}</button>
            <button type="button" className={soft} disabled={Boolean(busy)} onClick={() => void download('svg')}>{busy === 'svg' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}{st('download_svg')}</button>
            <span className="self-center text-[11.5px] text-stone-500" dir="ltr">{size.w}×{size.h}{spec.format === 'poster' ? ' (×2)' : ''}</span>
          </div>
        </div>

        <div className="space-y-2">
          <div className={card}>
            <p className={label}>{d('g_format')}</p>
            <Chips name={d('g_format')} value={spec.format} onChange={(v) => set('format', v)} options={FORMAT_IDS.map((f) => ({ id: f, label: d(formatKey(f)) }))} />
            <p className={label}>{d('g_layout')}</p>
            <Chips name={d('g_layout')} value={spec.layout} onChange={(v: GraphicLayout) => set('layout', v)} options={LAYOUTS.map((l) => ({ id: l, label: d(`l_${l}` as DesignKey) }))} />
          </div>
          <div className={card}>
            <label className={label}>{d('g_headline')}<input className={`${field} mt-1`} value={spec.headline} maxLength={120} onChange={(e) => set('headline', e.target.value)} /></label>
            <label className={label}>{d('g_sub')}<textarea className={`${field} mt-1`} rows={2} value={spec.sub} maxLength={240} onChange={(e) => set('sub', e.target.value)} /></label>
            <label className={label}>{d('g_cta')}<input className={`${field} mt-1`} value={spec.cta} maxLength={40} onChange={(e) => set('cta', e.target.value)} /></label>
            <label className={label}>{d('g_footer')}<input className={`${field} mt-1`} value={spec.footer} maxLength={90} onChange={(e) => set('footer', e.target.value)} /></label>
          </div>
          <div className={card}>
            <ColorPick title={st('color')} value={spec.base} onChange={(v) => set('base', v)} />
            <div className="flex flex-wrap items-center gap-3">
              <label className="text-[12.5px] font-bold text-stone-700">{st('harmony')}{' '}
                <select className="rounded-lg border border-stone-200 bg-white px-2 py-1 text-[12.5px]" value={spec.harmony} onChange={(e) => set('harmony', e.target.value as Harmony)}>
                  {HARMONIES.map((h) => <option key={h} value={h}>{d(`h_${h}` as DesignKey)}</option>)}
                </select>
              </label>
              <label className="inline-flex items-center gap-1.5 text-[12.5px] font-bold text-stone-700"><input type="checkbox" checked={spec.dark} onChange={(e) => set('dark', e.target.checked)} />{st('dark')}</label>
              <label className="inline-flex items-center gap-1.5 text-[12.5px] font-bold text-stone-700"><input type="checkbox" checked={spec.decor} onChange={(e) => set('decor', e.target.checked)} />{d('g_decor')}</label>
            </div>
            <label className="text-[12.5px] font-bold text-stone-700">{st('font')}{' '}
              <select className="rounded-lg border border-stone-200 bg-white px-2 py-1 text-[12.5px]" value={pair.id} onChange={(e) => set('font', e.target.value)}>
                {fonts.map((f) => <option key={f.id} value={f.id}>{f.heading}{f.body !== f.heading ? ` + ${f.body}` : ''}</option>)}
              </select>
            </label>
          </div>
          <div className={card}>
            <p className={label}>{d('g_bg')}</p>
            <Chips name={d('g_bg')} value={spec.bg} onChange={(v: GraphicBg) => set('bg', v)} options={BACKGROUNDS.map((b) => ({ id: b, label: d(`bg_${b}` as DesignKey) }))} />
            <label className={label}>{d('g_bg_prompt')}<input className={`${field} mt-1`} value={spec.imagePrompt || ''} maxLength={400} onChange={(e) => set('imagePrompt', e.target.value)} /></label>
            <div className="flex flex-wrap gap-2">
              <button type="button" className={soft} disabled={Boolean(busy)} onClick={() => void draw()}>{busy === 'draw' ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}{d('g_draw_bg')}</button>
              <button type="button" className={soft} onClick={() => uploadRef.current?.click()}><Upload className="h-4 w-4" />{d('g_upload')}</button>
              <input ref={uploadRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={(e) => { void upload(e.target.files?.[0]); e.target.value = ''; }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
