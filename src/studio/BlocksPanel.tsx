/**
 * «استوديو شاهين» — code blocks: tap blocks to stack a page, style them from one colour, add a custom block described
 * in words, preview on desktop or phone, and take the code as HTML, React or Vue.
 */
import React, { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Code2, Download, Loader2, Monitor, Plus, Smartphone, Sparkles, Trash2 } from 'lucide-react';
import type { SupportedLanguage } from '../types/i18n';
import { downloadBlob, safeFileName } from '../workspace/officeWriters';
import { FONT_PAIRS, HARMONIES, type Harmony } from './palette';
import { BLOCK_IDS, blockCode, blockFromReply, blocksFor, blocksPage, toReact, toVue, type BlockCode, type BlockId, type BlockOptions } from './blocks';
import { askDesign } from './studioApi';
import { dsText, type DesignKey } from './designStrings';
import { Chips, CodeBox, ColorPick, CopyButton, card, field, label, soft, strong } from './designUi';
import type { T } from './StudioPanel';

interface Item { key: string; id?: BlockId; custom?: BlockCode }
type Format = 'html' | 'react' | 'vue';
let seq = 0;

export function BlocksPanel({ lang, st, ai, onOpenCode }: { lang: SupportedLanguage; st: T; ai: boolean; onOpenCode: (code: string) => void }) {
  const d = (k: DesignKey) => dsText(lang, k);
  const [opts, setOpts] = useState<BlockOptions>({ brand: '', base: '#8a5a2b', harmony: 'complementary', dark: false, radius: 'soft', font: lang === 'ar' ? 'cairo' : 'poppins', rtl: lang === 'ar' });
  const [items, setItems] = useState<Item[]>(() => (['navbar', 'hero', 'features', 'cta', 'footer'] as BlockId[]).map((id) => ({ key: `b${seq++}`, id })));
  const [format, setFormat] = useState<Format>('html');
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [ask, setAsk] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const set = <K extends keyof BlockOptions>(k: K, v: BlockOptions[K]) => setOpts((o) => ({ ...o, [k]: v }));

  const ids = items.flatMap((i) => (i.id ? [i.id] : []));
  const page = useMemo(() => {
    // Keep the chosen order, custom blocks included.
    const codes = items.map((i) => (i.custom ? i.custom : blockCode(i.id!, opts)));
    return blocksPage([], opts, codes);
  }, [items, opts]);
  const combined: BlockCode = useMemo(() => {
    const codes = items.map((i) => (i.custom ? i.custom : blockCode(i.id!, opts)));
    return { html: codes.map((c) => c.html).join('\n'), css: [...new Set(codes.map((c) => c.css))].join('\n') };
  }, [items, opts]);
  const code = format === 'react' ? toReact(combined, opts, 'ShaheenPage') : format === 'vue' ? toVue(combined, opts) : page;
  const ext = format === 'react' ? 'jsx' : format === 'vue' ? 'vue' : 'html';

  const add = (id: BlockId) => setItems((list) => [...list, { key: `b${seq++}`, id }]);
  const move = (i: number, by: number) => setItems((list) => { const next = [...list]; const j = i + by; if (j < 0 || j >= next.length) return list; [next[i], next[j]] = [next[j]!, next[i]!]; return next; });
  const remove = (i: number) => setItems((list) => list.filter((_, n) => n !== i));
  const custom = async () => {
    if (!ask.trim() || busy) return;
    setBusy(true); setNote('');
    const look = `${ask}\n\n(brand: ${opts.brand || '-'}; main colour ${opts.base}; ${opts.rtl ? 'Arabic, dir=rtl' : 'English, dir=ltr'}; use the CSS variables --p --a --bg --sf --tx --mu --on --r and the classes sb sb-in sb-title sb-btn sb-card sb-grid sb-field)`;
    const reply = await askDesign('block', look, lang, { ai }).catch(() => undefined);
    const block = reply ? blockFromReply(reply) : undefined;
    if (block) { setItems((list) => [...list, { key: `c${seq++}`, custom: block }]); setNote(d('done_ai')); setAsk(''); }
    else {
      const found = blocksFor(ask);
      if (found.length) setItems((list) => [...list, ...found.map((id) => ({ key: `b${seq++}`, id }))]);
      setNote(d('b_no_ai'));
    }
    setBusy(false);
  };
  const name = (i: Item) => (i.id ? d(`blk_${i.id}` as DesignKey) : d('b_custom'));

  return (
    <div className="space-y-3" data-testid="studio-blocks">
      <p className="text-[12.5px] leading-relaxed text-stone-600">{d('b_intro')}</p>
      <div className={card}>
        <div className="flex flex-wrap items-end gap-3">
          <label className={`${label} grow`}>{st('brand')}<input className={`${field} mt-1`} value={opts.brand} maxLength={40} onChange={(e) => set('brand', e.target.value)} /></label>
          <label className="inline-flex items-center gap-1.5 pb-2 text-[12.5px] font-bold text-stone-700"><input type="checkbox" checked={opts.rtl} onChange={(e) => set('rtl', e.target.checked)} />{d('b_arabic')}</label>
          <label className="inline-flex items-center gap-1.5 pb-2 text-[12.5px] font-bold text-stone-700"><input type="checkbox" checked={opts.dark} onChange={(e) => set('dark', e.target.checked)} />{st('dark')}</label>
        </div>
        <ColorPick title={st('color')} value={opts.base} onChange={(v) => set('base', v)} />
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-[12.5px] font-bold text-stone-700">{st('harmony')}{' '}
            <select className="rounded-lg border border-stone-200 bg-white px-2 py-1 text-[12.5px]" value={opts.harmony} onChange={(e) => set('harmony', e.target.value as Harmony)}>{HARMONIES.map((h) => <option key={h} value={h}>{d(`h_${h}` as DesignKey)}</option>)}</select>
          </label>
          <label className="text-[12.5px] font-bold text-stone-700">{st('font')}{' '}
            <select className="rounded-lg border border-stone-200 bg-white px-2 py-1 text-[12.5px]" value={opts.font} onChange={(e) => set('font', e.target.value)}>{FONT_PAIRS.filter((f) => !opts.rtl || f.arabic).map((f) => <option key={f.id} value={f.id}>{f.heading}</option>)}</select>
          </label>
          <span className="text-[12.5px] font-bold text-stone-700">{d('b_radius')}</span>
          <Chips name={d('b_radius')} value={opts.radius} onChange={(v) => set('radius', v)} options={[{ id: 'sharp', label: '▢' }, { id: 'soft', label: '▢̃' }, { id: 'round', label: '◯' }]} />
        </div>
      </div>

      <div className={card}>
        <div className="flex flex-wrap gap-1.5">
          {BLOCK_IDS.map((id) => (
            <button key={id} type="button" onClick={() => add(id)} className="inline-flex items-center gap-1 rounded-full border border-stone-200 bg-white px-3 py-1.5 text-[12px] font-bold text-stone-700 hover:border-amber-400 cursor-pointer">
              <Plus className="h-3.5 w-3.5" />{d(`blk_${id}` as DesignKey)}{ids.includes(id) ? ' ✓' : ''}
            </button>
          ))}
        </div>
        <label className={label}>{d('b_ai')}
          <div className="mt-1 flex gap-2">
            <input className={field} value={ask} maxLength={600} onChange={(e) => setAsk(e.target.value)} placeholder={d('b_ai_ph')} onKeyDown={(e) => { if (e.key === 'Enter') void custom(); }} />
            <button type="button" className={strong} disabled={!ask.trim() || busy} onClick={() => void custom()}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}{d('idea_go')}</button>
          </div>
        </label>
        {note && <p className="rounded-xl bg-amber-50 px-3 py-2 text-[12.5px] font-bold text-amber-900" role="status">{note}</p>}
      </div>

      <div className="grid gap-3 lg:grid-cols-[240px_1fr]">
        <div className={card}>
          <p className={label}>{d('b_page')}</p>
          {!items.length && <p className="text-[12px] text-stone-500">{d('b_empty')}</p>}
          <ol className="space-y-1">
            {items.map((it, i) => (
              <li key={it.key} className="flex items-center gap-1 rounded-lg bg-stone-50 px-2 py-1 text-[12.5px] font-bold text-stone-700">
                <span className="grow truncate">{i + 1}. {name(it)}</span>
                <button type="button" aria-label={st('move_up')} title={st('move_up')} onClick={() => move(i, -1)} className="rounded p-1 hover:bg-stone-200 cursor-pointer"><ArrowUp className="h-3.5 w-3.5" /></button>
                <button type="button" aria-label={st('move_down')} title={st('move_down')} onClick={() => move(i, 1)} className="rounded p-1 hover:bg-stone-200 cursor-pointer"><ArrowDown className="h-3.5 w-3.5" /></button>
                <button type="button" aria-label={st('remove')} title={st('remove')} onClick={() => remove(i)} className="rounded p-1 text-red-700 hover:bg-red-50 cursor-pointer"><Trash2 className="h-3.5 w-3.5" /></button>
              </li>
            ))}
          </ol>
        </div>
        <div className="space-y-2">
          <div className="flex items-center gap-1.5">
            <span className="text-[12.5px] font-black text-stone-800">{d('preview')}</span>
            <button type="button" aria-label="desktop" onClick={() => setDevice('desktop')} className={`rounded-lg p-1.5 cursor-pointer ${device === 'desktop' ? 'bg-stone-900 text-white' : 'bg-white text-stone-600 border border-stone-200'}`}><Monitor className="h-4 w-4" /></button>
            <button type="button" aria-label="mobile" onClick={() => setDevice('mobile')} className={`rounded-lg p-1.5 cursor-pointer ${device === 'mobile' ? 'bg-stone-900 text-white' : 'bg-white text-stone-600 border border-stone-200'}`}><Smartphone className="h-4 w-4" /></button>
          </div>
          <div className="flex justify-center rounded-2xl border border-stone-200 bg-stone-100 p-2">
            <iframe title={d('b_page')} srcDoc={page} sandbox="allow-forms" className="h-[520px] rounded-lg border border-stone-200 bg-white" style={{ width: device === 'mobile' ? 390 : '100%' }} data-testid="blocks-preview" />
          </div>
          <div className={card}>
            <div className="flex flex-wrap items-center gap-2">
              <span className={label}>{d('b_format')}</span>
              <Chips name={d('b_format')} value={format} onChange={setFormat} options={[{ id: 'html', label: `HTML · ${d('b_whole')}` }, { id: 'react', label: 'React (JSX)' }, { id: 'vue', label: 'Vue' }]} />
            </div>
            <CodeBox code={code} rows={9} />
            <div className="flex flex-wrap gap-2">
              <CopyButton text={code} label={d('copy')} done={d('copied')} />
              <button type="button" className={soft} onClick={() => downloadBlob(new Blob([code], { type: 'text/plain;charset=utf-8' }), safeFileName(opts.brand || 'shaheen-page', ext))}><Download className="h-4 w-4" />{d('download')} .{ext}</button>
              <button type="button" className={soft} onClick={() => onOpenCode(page)}><Code2 className="h-4 w-4" />{d('open_code')}</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
