import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Code2, Download, ExternalLink, FilePlus2, FolderOpen, ImagePlus, Loader2, Monitor, Redo2, Save, Smartphone, Sparkles, Trash2, Undo2, Upload, Wand2 } from 'lucide-react';
import type { SupportedLanguage } from '../types/i18n';
import { errorKey } from '../workspace/workspaceApi';
import { wsText } from '../workspace/strings';
import { saveFile } from '../workspace/fileStore';
import { downloadBlob, safeFileName } from '../workspace/officeWriters';
import { FONT_PAIRS, HARMONIES, paletteFrom } from './palette';
import { briefToSpec, cloneSpec, missingImages, newId, SECTION_TYPES, type ImageRef, type Section, type SectionType, type SiteSpec } from './siteSpec';
import { renderPage, singleFile } from './siteRender';
import { openSite, zipSite } from './siteZip';
import { buildSite, drawPicture, editSite } from './studioApi';
import type { SiteHistory, T } from './StudioPanel';

const btn = 'inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-[12.5px] font-black cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed';
const soft = `${btn} border border-stone-200 bg-white text-stone-700 hover:border-amber-400`;
const strong = `${btn} bg-amber-800 text-white hover:bg-amber-900`;
const field = 'w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-[13px] focus:border-amber-500 focus:outline-none';

/** Every picture reference in the site, so one can be found again after the site changed. */
function eachImage(spec: SiteSpec, fn: (ref: ImageRef) => void) {
  for (const p of spec.pages) for (const s of p.sections) { if (s.image) fn(s.image); for (const it of s.items || []) if (it.image) fn(it.image); }
}

export function SitePanel({ lang, st, ai, history, commit, replace, checkpoint, undo, redo, onOpenCode }: {
  lang: SupportedLanguage; st: T; ai: boolean; history: SiteHistory; commit: (s: SiteSpec | null) => void; replace: (s: SiteSpec) => void; checkpoint: (before: SiteSpec) => void; undo: () => void; redo: () => void; onOpenCode: (code: string) => void;
}) {
  const spec = history.spec;
  const [brief, setBrief] = useState('');
  const [onePage, setOnePage] = useState(false);
  const [busy, setBusy] = useState<'' | 'build' | 'edit' | 'draw'>('');
  const [progress, setProgress] = useState({ n: 0, total: 0 });
  const [note, setNote] = useState('');
  const [instruction, setInstruction] = useState('');
  const [page, setPage] = useState('index');
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [selected, setSelected] = useState<string>('');
  const frame = useRef<HTMLIFrameElement>(null);
  const openRef = useRef<HTMLInputElement>(null);
  const uploadRef = useRef<HTMLInputElement>(null);
  const abort = useRef<AbortController | null>(null);
  const latest = useRef(spec);
  latest.current = spec;
  /** The site before live typing started (one undo step when the field is left). */
  const before = useRef<SiteSpec | null>(null);
  const startTyping = () => { if (!before.current && latest.current) before.current = latest.current; };
  const endTyping = () => { if (before.current) checkpoint(before.current); before.current = null; };
  useEffect(() => () => abort.current?.abort(), []);

  const currentPage = spec?.pages.find((p) => p.slug === page) || spec?.pages[0];
  useEffect(() => { if (spec && !spec.pages.some((p) => p.slug === page)) setPage('index'); }, [spec, page]);
  const html = useMemo(() => (spec ? renderPage(spec, currentPage?.slug || 'index', 'preview') : ''), [spec, currentPage?.slug]);

  // Links between pages inside the preview open that page here.
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.source !== frame.current?.contentWindow) return;
      const p = (e.data as { shamStudioPage?: unknown })?.shamStudioPage;
      if (typeof p === 'string' && latest.current?.pages.some((x) => x.slug === p)) setPage(p);
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  /** Draws every picture still missing, one by one, showing each as soon as it is ready. */
  const drawAll = useCallback(async (start?: SiteSpec) => {
    const base = start || latest.current;
    if (!base) return;
    const todo = missingImages(base).map((r) => r.prompt!).filter(Boolean);
    if (!todo.length) return;
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    setBusy('draw');
    setProgress({ n: 0, total: todo.length });
    let failed = false;
    for (const [i, prompt] of todo.entries()) {
      if (controller.signal.aborted) break;
      try {
        const hero = base.pages.some((p) => p.sections.some((s) => s.type === 'hero' && s.image?.prompt === prompt));
        const src = await drawPicture(prompt, hero ? 1600 : 1024, hero ? 900 : 768, controller.signal);
        const next = cloneSpec(latest.current || base);
        eachImage(next, (ref) => { if (ref.prompt === prompt && !ref.src) ref.src = src; });
        replace(next);
      } catch (error) {
        if (controller.signal.aborted) break;
        failed = true;
        setNote(wsText(lang, errorKey(error)));
        break;
      }
      setProgress({ n: i + 1, total: todo.length });
    }
    if (failed) setProgress({ n: 0, total: 0 });
    setBusy('');
  }, [lang, replace]);

  const build = async () => {
    if (!brief.trim() || busy) return;
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    setBusy('build'); setNote('');
    try {
      const out = await buildSite(brief.trim(), lang, { ai, onePage }, controller.signal);
      commit(out.spec);
      setPage('index'); setSelected('');
      setNote(out.by === 'ai' ? st('built') : st('built_local'));
      setBusy('');
      void drawAll(out.spec);
    } catch (error) {
      if (!controller.signal.aborted) setNote(wsText(lang, errorKey(error)));
      setBusy('');
    }
  };

  const applyEdit = async () => {
    if (!spec || !instruction.trim() || busy) return;
    setBusy('edit'); setNote('');
    try {
      const out = await editSite(instruction.trim(), spec, currentPage?.slug || 'index', lang, { ai });
      if (!out) setNote(st('not_understood'));
      else {
        commit(out.spec);
        setInstruction('');
        setNote(st('edited'));
        setBusy('');
        if (missingImages(out.spec).length) void drawAll(out.spec);
        return;
      }
    } catch (error) { setNote(wsText(lang, errorKey(error))); }
    setBusy('');
  };

  const change = (fn: (draft: SiteSpec) => void, live = false) => {
    if (!spec) return;
    const next = cloneSpec(spec);
    fn(next);
    (live ? replace : commit)(next);
  };
  const pageOf = (draft: SiteSpec) => draft.pages.find((p) => p.slug === currentPage?.slug) || draft.pages[0]!;
  const moveSection = (id: string, by: -1 | 1) => change((d) => {
    const list = pageOf(d).sections;
    const i = list.findIndex((s) => s.id === id);
    const j = i + by;
    if (i < 0 || j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j]!, list[i]!];
  });
  const removeSection = (id: string) => change((d) => { const p = pageOf(d); if (p.sections.length > 1) p.sections = p.sections.filter((s) => s.id !== id); });
  const addSection = (type: SectionType) => {
    if (!spec) return;
    const sample = briefToSpec(spec.name, { language: spec.lang, onePage: true }).pages[0]!.sections.find((s) => s.type === type);
    const section: Section = sample ? { ...sample, id: newId() } : { id: newId(), type, title: st(`sec_${type}`), text: '…' };
    change((d) => { const list = pageOf(d).sections; const at = list.findIndex((s) => s.type === 'contact'); if (at >= 0 && type !== 'contact') list.splice(at, 0, section); else list.push(section); });
    setSelected(section.id);
    if (section.image?.prompt || section.items?.some((it) => it.image?.prompt)) setTimeout(() => void drawAll(), 50);
  };
  const sel = currentPage?.sections.find((s) => s.id === selected);
  const editSel = (fn: (s: Section) => void, live = true) => change((d) => { const s = pageOf(d).sections.find((x) => x.id === selected); if (s) fn(s); }, live);
  const redraw = async () => {
    if (!sel?.image?.prompt || busy) return;
    setBusy('draw'); setNote('');
    try {
      const src = await drawPicture(sel.image.prompt, sel.type === 'hero' ? 1600 : 1024, sel.type === 'hero' ? 900 : 768);
      editSel((s) => { if (s.image) s.image.src = src; }, false);
    } catch (error) { setNote(wsText(lang, errorKey(error))); }
    setBusy('');
  };
  const upload = (file?: File) => {
    if (!file || !file.type.startsWith('image/') || file.size > 8 * 1024 * 1024) return;
    const reader = new FileReader();
    reader.onload = () => {
      const src = String(reader.result || '');
      const img = new Image();
      img.onload = () => {
        // Large photos are made lighter so the site stays fast.
        const scale = Math.min(1, 1600 / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
        c.getContext('2d')?.drawImage(img, 0, 0, c.width, c.height);
        const out = c.toDataURL('image/jpeg', 0.86);
        editSel((s) => { s.image = { ...(s.image || {}), src: out, alt: s.image?.alt || s.title || '' }; }, false);
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
  };

  const download = () => { if (spec) downloadBlob(new Blob([zipSite(spec) as BlobPart], { type: 'application/zip' }), safeFileName(spec.name, 'zip')); };
  const save = async () => {
    if (!spec) return;
    try { await saveFile(safeFileName(spec.name, 'zip'), new Blob([zipSite(spec) as BlobPart], { type: 'application/zip' })); setNote(wsText(lang, 'saved')); } catch { setNote(wsText(lang, 'failed')); }
  };
  const openNew = () => { if (!spec) return; const url = URL.createObjectURL(new Blob([singleFile(spec)], { type: 'text/html' })); window.open(url, '_blank', 'noopener'); setTimeout(() => URL.revokeObjectURL(url), 60_000); };
  const openFile = async (file?: File) => {
    if (!file) return;
    const next = openSite(new Uint8Array(await file.arrayBuffer()), lang);
    if (next) { commit(next); setPage('index'); setSelected(''); setNote(st('edited')); } else setNote(wsText(lang, 'failed'));
  };

  const palette = spec ? paletteFrom(spec.theme.base, { harmony: spec.theme.harmony, dark: spec.theme.dark }) : null;
  const fonts = FONT_PAIRS.filter((f) => f.arabic === (spec?.dir === 'rtl'));

  return (
    <div className="space-y-3">
      {/* 1. Describe and build */}
      <div className="rounded-2xl border border-stone-200 bg-white p-3 space-y-2">
        <label className="block text-[13px] font-black text-stone-800" htmlFor="studio-brief">{st('brief')}</label>
        <textarea id="studio-brief" className={`${field} min-h-[84px]`} value={brief} onChange={(e) => setBrief(e.target.value)} placeholder={st('brief_ph')} maxLength={3000} />
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className={strong} onClick={build} disabled={!brief.trim() || Boolean(busy)} data-testid="studio-build">
            {busy === 'build' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}{busy === 'build' ? st('building') : st('build')}
          </button>
          <label className="inline-flex items-center gap-1.5 text-[12.5px] font-bold text-stone-700"><input type="checkbox" checked={onePage} onChange={(e) => setOnePage(e.target.checked)} />{st('one_page')}</label>
          <button type="button" className={soft} onClick={() => openRef.current?.click()}><FolderOpen className="h-4 w-4" />{st('open_site')}</button>
          {spec && <button type="button" className={soft} onClick={() => { commit(null); setNote(''); }}><FilePlus2 className="h-4 w-4" />{st('new_site')}</button>}
          <input ref={openRef} type="file" accept=".zip,.json,application/zip,application/json" className="hidden" onChange={(e) => { void openFile(e.target.files?.[0]); e.target.value = ''; }} />
        </div>
      </div>
      {note && <p className="rounded-xl bg-amber-50 px-3 py-2 text-[12.5px] font-bold text-amber-900" role="status">{note}</p>}
      {busy === 'draw' && progress.total > 0 && <p className="flex items-center gap-2 text-[12.5px] font-bold text-stone-600"><Loader2 className="h-4 w-4 animate-spin" />{st('drawing_n', { n: progress.n, total: progress.total })}</p>}

      {spec && currentPage && palette && (
        <>
          {/* 2. Edit by words */}
          <div className="rounded-2xl border border-stone-200 bg-white p-3 space-y-2">
            <label className="block text-[13px] font-black text-stone-800" htmlFor="studio-edit">{st('edit')}</label>
            <div className="flex gap-2">
              <input id="studio-edit" className={field} value={instruction} onChange={(e) => setInstruction(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void applyEdit(); }} placeholder={st('edit_ph')} maxLength={600} />
              <button type="button" className={strong} onClick={applyEdit} disabled={!instruction.trim() || Boolean(busy)}>{busy === 'edit' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}{st('apply')}</button>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" className={soft} onClick={undo} disabled={!history.past.length}><Undo2 className="h-4 w-4" />{st('undo')}</button>
              <button type="button" className={soft} onClick={redo} disabled={!history.future.length}><Redo2 className="h-4 w-4" />{st('redo')}</button>
              {missingImages(spec).length > 0 && busy !== 'draw' && <button type="button" className={soft} onClick={() => void drawAll()}><ImagePlus className="h-4 w-4" />{st('draw_images')}</button>}
            </div>
          </div>

          {/* 3. Preview */}
          <div className="rounded-2xl border border-stone-200 bg-white p-2 space-y-2">
            <div className="flex flex-wrap items-center gap-1.5">
              {spec.pages.map((p) => (
                <button key={p.slug} type="button" onClick={() => { setPage(p.slug); setSelected(''); }} className={`rounded-lg px-2.5 py-1 text-[12px] font-black cursor-pointer ${p.slug === currentPage.slug ? 'bg-stone-900 text-white' : 'bg-stone-100 text-stone-700'}`}>{p.title}</button>
              ))}
              <span className="grow" />
              <button type="button" aria-label={st('desktop')} title={st('desktop')} onClick={() => setDevice('desktop')} className={`rounded-lg p-1.5 cursor-pointer ${device === 'desktop' ? 'bg-amber-100 text-amber-900' : 'text-stone-500'}`}><Monitor className="h-4 w-4" /></button>
              <button type="button" aria-label={st('mobile')} title={st('mobile')} onClick={() => setDevice('mobile')} className={`rounded-lg p-1.5 cursor-pointer ${device === 'mobile' ? 'bg-amber-100 text-amber-900' : 'text-stone-500'}`}><Smartphone className="h-4 w-4" /></button>
            </div>
            <div className="flex justify-center rounded-xl bg-stone-100 p-1">
              <iframe ref={frame} title={spec.name} srcDoc={html} sandbox="allow-scripts allow-forms allow-popups allow-modals" data-testid="studio-preview"
                className="h-[560px] rounded-lg border border-stone-200 bg-white transition-all" style={{ width: device === 'mobile' ? 390 : '100%' }} />
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" className={strong} onClick={download} data-testid="studio-zip"><Download className="h-4 w-4" />{st('download_zip')}</button>
              <button type="button" className={soft} onClick={() => void save()}><Save className="h-4 w-4" />{st('save_site')}</button>
              <button type="button" className={soft} onClick={openNew}><ExternalLink className="h-4 w-4" />{st('open_new')}</button>
              <button type="button" className={soft} onClick={() => onOpenCode(singleFile(spec))}><Code2 className="h-4 w-4" />{st('to_editor')}</button>
            </div>
            <p className="text-[11.5px] text-stone-500">{st('publish_hint')}</p>
          </div>

          {/* 4. Design */}
          <div className="rounded-2xl border border-stone-200 bg-white p-3 space-y-3">
            <h3 className="text-[13px] font-black text-stone-800">{st('design')}</h3>
            <div className="flex flex-wrap items-center gap-4">
              <label className="inline-flex items-center gap-2 text-[12.5px] font-bold text-stone-700">{st('color')}
                <input type="color" value={spec.theme.base} onFocus={startTyping} onChange={(e) => { startTyping(); change((d) => { d.theme.base = e.target.value; }, true); }} onBlur={endTyping} className="h-8 w-10 cursor-pointer rounded border border-stone-200" />
              </label>
              <label className="inline-flex items-center gap-1.5 text-[12.5px] font-bold text-stone-700"><input type="checkbox" checked={spec.theme.dark} onChange={(e) => change((d) => { d.theme.dark = e.target.checked; })} />{st('dark')}</label>
              <div className="flex items-center gap-1" role="group" aria-label={st('corners')}>
                <span className="text-[12.5px] font-bold text-stone-700">{st('corners')}</span>
                {(['sharp', 'soft', 'round'] as const).map((r) => (
                  <button key={r} type="button" aria-label={`${st('corners')} ${r}`} aria-pressed={spec.theme.radius === r} onClick={() => change((d) => { d.theme.radius = r; })}
                    className={`h-7 w-7 border-2 cursor-pointer ${spec.theme.radius === r ? 'border-amber-700 bg-amber-100' : 'border-stone-300 bg-white'}`} style={{ borderRadius: r === 'sharp' ? 2 : r === 'soft' ? 7 : 14 }} />
                ))}
              </div>
            </div>
            <div className="space-y-1">
              <span className="text-[12.5px] font-bold text-stone-700">{st('harmony')}</span>
              <div className="flex flex-wrap gap-2">
                {HARMONIES.map((h) => { const p = paletteFrom(spec.theme.base, { harmony: h, dark: spec.theme.dark }); return (
                  <button key={h} type="button" aria-label={`${st('harmony')}: ${h}`} aria-pressed={spec.theme.harmony === h} onClick={() => change((d) => { d.theme.harmony = h; })}
                    className={`flex overflow-hidden rounded-lg border-2 cursor-pointer ${spec.theme.harmony === h ? 'border-amber-700' : 'border-stone-200'}`}>
                    {[p.primary, p.accent, p.bg, p.text].map((c, i) => <span key={i} className="h-6 w-6" style={{ background: c }} />)}
                  </button>
                ); })}
              </div>
            </div>
            <label className="flex items-center gap-2 text-[12.5px] font-bold text-stone-700">{st('font')}
              <select className="rounded-lg border border-stone-200 bg-white px-2 py-1 text-[12.5px]" value={fonts.some((f) => f.id === spec.theme.font) ? spec.theme.font : fonts[0]!.id} onChange={(e) => change((d) => { d.theme.font = e.target.value; })}>
                {fonts.map((f) => <option key={f.id} value={f.id}>{f.heading === f.body ? f.heading : `${f.heading} + ${f.body}`}</option>)}
              </select>
            </label>
          </div>

          {/* 5. Sections of this page */}
          <div className="rounded-2xl border border-stone-200 bg-white p-3 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-[13px] font-black text-stone-800">{st('sections')} — {currentPage.title}</h3>
              <select className="rounded-lg border border-stone-200 bg-white px-2 py-1 text-[12.5px] font-bold" value="" onChange={(e) => { if (e.target.value) addSection(e.target.value as SectionType); }} aria-label={st('add_section')}>
                <option value="">＋ {st('add_section')}</option>
                {SECTION_TYPES.map((type) => <option key={type} value={type}>{st(`sec_${type}`)}</option>)}
              </select>
            </div>
            <ul className="space-y-1.5">
              {currentPage.sections.map((s, i) => (
                <li key={s.id} className={`flex items-center gap-1.5 rounded-xl border px-2 py-1.5 ${selected === s.id ? 'border-amber-500 bg-amber-50' : 'border-stone-200'}`}>
                  <button type="button" className="min-w-0 grow text-start cursor-pointer" onClick={() => setSelected(selected === s.id ? '' : s.id)}>
                    <span className="text-[11px] font-black text-amber-800">{st(`sec_${s.type}`)}</span>
                    <span className="block truncate text-[12.5px] font-bold text-stone-800">{s.title || s.text || '—'}</span>
                  </button>
                  <button type="button" aria-label={st('move_up')} title={st('move_up')} disabled={i === 0} onClick={() => moveSection(s.id, -1)} className="rounded p-1 text-stone-500 hover:bg-stone-100 disabled:opacity-30 cursor-pointer"><ArrowUp className="h-4 w-4" /></button>
                  <button type="button" aria-label={st('move_down')} title={st('move_down')} disabled={i === currentPage.sections.length - 1} onClick={() => moveSection(s.id, 1)} className="rounded p-1 text-stone-500 hover:bg-stone-100 disabled:opacity-30 cursor-pointer"><ArrowDown className="h-4 w-4" /></button>
                  <button type="button" aria-label={st('remove')} title={st('remove')} disabled={currentPage.sections.length < 2} onClick={() => removeSection(s.id)} className="rounded p-1 text-rose-600 hover:bg-rose-50 disabled:opacity-30 cursor-pointer"><Trash2 className="h-4 w-4" /></button>
                </li>
              ))}
            </ul>
            {sel && (
              <div className="space-y-2 rounded-xl bg-stone-50 p-2.5" onFocus={startTyping} onBlur={endTyping}>
                <label className="block text-[12px] font-bold text-stone-600">{st('f_title')}<input className={field} value={sel.title || ''} maxLength={160} onChange={(e) => editSel((s) => { s.title = e.target.value; })} /></label>
                <label className="block text-[12px] font-bold text-stone-600">{st('f_text')}<textarea className={`${field} min-h-[70px]`} value={sel.text || ''} maxLength={2400} onChange={(e) => editSel((s) => { s.text = e.target.value; })} /></label>
                {sel.type === 'contact' && (
                  <div className="grid gap-1.5 sm:grid-cols-2">
                    {([['email', '✉️', 120], ['phone', '📞', 25], ['whatsapp', '💬', 25], ['address', '📍', 240]] as const).map(([k, icon, max]) => (
                      <label key={k} className="flex items-center gap-1.5 text-[13px]"><span aria-hidden>{icon}</span>
                        <input className={field} dir={k === 'address' ? undefined : 'ltr'} inputMode={k === 'phone' || k === 'whatsapp' ? 'tel' : k === 'email' ? 'email' : undefined} aria-label={k} value={sel[k] || ''} maxLength={max} onChange={(e) => editSel((s) => { s[k] = e.target.value; })} />
                      </label>
                    ))}
                  </div>
                )}
                {(sel.type === 'products' || sel.type === 'gallery') && sel.items?.some((it) => it.image?.prompt) && (
                  <button type="button" className={soft} disabled={Boolean(busy)} onClick={() => { const next = cloneSpec(spec); const s = pageOf(next).sections.find((x) => x.id === selected); s?.items?.forEach((it) => { if (it.image?.prompt) delete it.image.src; }); commit(next); void drawAll(next); }}>
                    <Sparkles className="h-4 w-4" />{st('redraw')}
                  </button>
                )}
                {(sel.type === 'hero' || sel.type === 'cta' || sel.type === 'about') && <label className="block text-[12px] font-bold text-stone-600">{st('f_button')}<input className={field} value={sel.button || ''} maxLength={60} onChange={(e) => editSel((s) => { s.button = e.target.value; })} /></label>}
                {(sel.type === 'hero' || sel.type === 'about') && (
                  <div className="space-y-1.5">
                    <label className="block text-[12px] font-bold text-stone-600">{st('f_image')}<input className={field} value={sel.image?.prompt || ''} maxLength={400} onChange={(e) => editSel((s) => { s.image = { ...(s.image || {}), prompt: e.target.value }; })} /></label>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" className={soft} disabled={!sel.image?.prompt || Boolean(busy)} onClick={() => void redraw()}>{busy === 'draw' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}{st('redraw')}</button>
                      <button type="button" className={soft} onClick={() => uploadRef.current?.click()}><Upload className="h-4 w-4" />{st('upload_image')}</button>
                      <input ref={uploadRef} type="file" accept="image/*" className="hidden" onChange={(e) => { upload(e.target.files?.[0]); e.target.value = ''; }} />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
