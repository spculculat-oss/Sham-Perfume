/**
 * «استوديو شاهين» — the designer's toolbox: palette with shades, contrast checker, gradients, shadows, type scale,
 * spacing, and the whole design system as CSS — all worked out on the device.
 */
import React, { useMemo, useState } from 'react';
import { Download, Wand2 } from 'lucide-react';
import type { SupportedLanguage } from '../types/i18n';
import { downloadBlob } from '../workspace/officeWriters';
import { HARMONIES, ensureContrast, paletteFrom, type Harmony } from './palette';
import { RATIOS, SHADE_STEPS, contrastReport, designTokens, exportPalette, gradientCss, gradientIdeas, shades, shadowCss, shadowPresets, spacingCss, spacingScale, typeScale, typeScaleCss, type GradientSpec, type PaletteExport } from './designTools';
import { dsText, type DesignKey } from './designStrings';
import { Chips, CodeBox, ColorPick, CopyButton, card, label, soft } from './designUi';
import type { T } from './StudioPanel';

export function ToolsPanel({ lang, st }: { lang: SupportedLanguage; st: T }) {
  const d = (k: DesignKey) => dsText(lang, k);
  const [base, setBase] = useState('#8a5a2b');
  const [harmony, setHarmony] = useState<Harmony>('complementary');
  const [dark, setDark] = useState(false);
  const [format, setFormat] = useState<PaletteExport>('css');
  const [fg, setFg] = useState('#78716c');
  const [bg, setBg] = useState('#ffffff');
  const [grad, setGrad] = useState<GradientSpec>({ kind: 'linear', angle: 135, colors: ['#8a5a2b', '#0e7490'] });
  const [typeBase, setTypeBase] = useState(16);
  const [ratio, setRatio] = useState('major-third');
  const [unit, setUnit] = useState(4);

  const p = useMemo(() => paletteFrom(base, { harmony, dark }), [base, harmony, dark]);
  const scale = useMemo(() => shades(p.primary), [p.primary]);
  const report = contrastReport(fg, bg);
  const ideas = useMemo(() => gradientIdeas(base, harmony), [base, harmony]);
  const shadows = useMemo(() => shadowPresets(p.primary), [p.primary]);
  const steps = useMemo(() => typeScale(typeBase, RATIOS[ratio] || 1.25), [typeBase, ratio]);
  const space = useMemo(() => spacingScale(unit), [unit]);
  const tokens = useMemo(() => designTokens(base, { harmony, dark, typeBase, ratio: RATIOS[ratio] || 1.25, unit }), [base, harmony, dark, typeBase, ratio, unit]);
  const badge = (ok: boolean, text: string) => <span className={`rounded-full px-2.5 py-1 text-[11.5px] font-black ${ok ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>{ok ? '✓' : '✗'} {text}</span>;
  const gradCss = gradientCss(grad);

  return (
    <div className="space-y-3" data-testid="studio-tools">
      <div className={card}>
        <p className={label}>{d('tl_palette')}</p>
        <ColorPick title={st('color')} value={base} onChange={setBase} />
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-[12.5px] font-bold text-stone-700">{st('harmony')}{' '}
            <select className="rounded-lg border border-stone-200 bg-white px-2 py-1 text-[12.5px]" value={harmony} onChange={(e) => setHarmony(e.target.value as Harmony)}>{HARMONIES.map((h) => <option key={h} value={h}>{d(`h_${h}` as DesignKey)}</option>)}</select>
          </label>
          <label className="inline-flex items-center gap-1.5 text-[12.5px] font-bold text-stone-700"><input type="checkbox" checked={dark} onChange={(e) => setDark(e.target.checked)} />{st('dark')}</label>
        </div>
        <div className="flex overflow-hidden rounded-xl border border-stone-200" dir="ltr">
          {([['primary', p.primary, p.onPrimary], ['accent', p.accent, '#fff'], ['bg', p.bg, p.text], ['surface', p.surface, p.text], ['text', p.text, p.bg], ['muted', p.muted, p.bg]] as const).map(([n, c, on]) => (
            <span key={n} className="grid h-14 grow place-items-center text-center text-[10px] font-bold leading-tight" style={{ background: c, color: on }}>{n}<br />{c}</span>
          ))}
        </div>
        <div className="flex overflow-hidden rounded-xl border border-stone-200" dir="ltr">
          {SHADE_STEPS.map((s) => <span key={s} title={scale[s]} className="grid h-9 grow place-items-center text-[9.5px] font-bold" style={{ background: scale[s], color: s >= 500 ? '#fff' : '#1c1917' }}>{s}</span>)}
        </div>
        <Chips name="format" value={format} onChange={setFormat} options={[{ id: 'css', label: 'CSS' }, { id: 'tailwind', label: 'Tailwind' }, { id: 'scss', label: 'SCSS' }, { id: 'json', label: 'JSON' }]} />
        <CodeBox code={exportPalette(p, format)} rows={6} />
        <CopyButton text={exportPalette(p, format)} label={d('copy')} done={d('copied')} />
      </div>

      <div className={card}>
        <p className={label}>{d('tl_contrast')}</p>
        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex items-center gap-2 text-[12.5px] font-bold text-stone-700">{d('tl_fg')}<input type="color" value={fg} onChange={(e) => setFg(e.target.value)} className="h-8 w-10 cursor-pointer rounded border border-stone-200" /></label>
          <label className="inline-flex items-center gap-2 text-[12.5px] font-bold text-stone-700">{d('tl_bgc')}<input type="color" value={bg} onChange={(e) => setBg(e.target.value)} className="h-8 w-10 cursor-pointer rounded border border-stone-200" /></label>
          <span className="text-2xl font-black text-stone-900" dir="ltr">{report.ratio}:1</span>
        </div>
        <div className="rounded-xl p-3" style={{ background: bg, color: fg }}><b className="text-lg">Aa — {st('f_title')}</b><p className="text-[13px]">{d('tl_body_ok')} · The quick brown fox · الخط واضح؟</p></div>
        <div className="flex flex-wrap gap-1.5">{badge(report.aa, `${d('tl_body_ok')} (AA 4.5)`)}{badge(report.aaLarge, `${d('tl_large_ok')} (3)`)}{badge(report.aaa, `${d('tl_best')} (AAA 7)`)}</div>
        {!report.aa && <button type="button" className={soft} onClick={() => setFg(ensureContrast(fg, bg, 4.5))}><Wand2 className="h-4 w-4" />{d('tl_fix')}</button>}
      </div>

      <div className={card}>
        <p className={label}>{d('tl_gradient')}</p>
        <div className="grid grid-cols-5 gap-1.5">
          {ideas.map((g, i) => <button key={i} type="button" aria-label={`${d('tl_gradient')} ${i + 1}`} onClick={() => setGrad(g)} className="h-12 rounded-xl border border-stone-200 cursor-pointer" style={{ background: gradientCss(g) }} />)}
        </div>
        <div className="h-24 rounded-xl border border-stone-200" style={{ background: gradCss }} />
        <div className="flex flex-wrap items-center gap-3">
          <Chips name="kind" value={grad.kind} onChange={(kind) => setGrad({ ...grad, kind })} options={[{ id: 'linear', label: d('g_linear') }, { id: 'radial', label: d('g_radial') }, { id: 'conic', label: d('g_conic') }]} />
          {grad.colors.map((c, i) => <input key={i} type="color" aria-label={`colour ${i + 1}`} value={c} onChange={(e) => setGrad({ ...grad, colors: grad.colors.map((x, n) => (n === i ? e.target.value : x)) })} className="h-8 w-10 cursor-pointer rounded border border-stone-200" />)}
          {grad.colors.length < 5 && <button type="button" className={soft} onClick={() => setGrad({ ...grad, colors: [...grad.colors, '#ffffff'] })}>+</button>}
          {grad.colors.length > 2 && <button type="button" className={soft} onClick={() => setGrad({ ...grad, colors: grad.colors.slice(0, -1) })}>−</button>}
          <label className="inline-flex items-center gap-2 text-[12.5px] font-bold text-stone-700">{d('tl_angle')}<input type="range" min={0} max={359} value={grad.angle} onChange={(e) => setGrad({ ...grad, angle: Number(e.target.value) })} /><span dir="ltr">{grad.angle}°</span></label>
        </div>
        <CodeBox code={`background: ${gradCss};`} rows={2} />
        <CopyButton text={`background: ${gradCss};`} label={d('copy')} done={d('copied')} />
      </div>

      <div className={card}>
        <p className={label}>{d('tl_shadow')}</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {Object.entries(shadows).map(([name, s]) => (
            <div key={name} className="space-y-1.5 text-center">
              <div className="mx-auto grid h-20 w-full place-items-center rounded-2xl bg-white text-[12px] font-bold text-stone-600" style={{ boxShadow: shadowCss(s) }}>{d(`sh_${name}` as DesignKey)}</div>
              <CopyButton text={`box-shadow: ${shadowCss(s)};`} label={d('copy')} done={d('copied')} />
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className={card}>
          <p className={label}>{d('tl_type')}</p>
          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex items-center gap-2 text-[12.5px] font-bold text-stone-700">{d('tl_base')}<input type="range" min={12} max={22} value={typeBase} onChange={(e) => setTypeBase(Number(e.target.value))} /><span dir="ltr">{typeBase}px</span></label>
            <label className="text-[12.5px] font-bold text-stone-700">{d('tl_ratio')}{' '}
              <select className="rounded-lg border border-stone-200 bg-white px-2 py-1 text-[12.5px]" value={ratio} onChange={(e) => setRatio(e.target.value)}>{Object.entries(RATIOS).map(([k, v]) => <option key={k} value={k}>{k} ({v})</option>)}</select>
            </label>
          </div>
          <div className="max-h-64 space-y-1 overflow-y-auto">
            {[...steps].reverse().map((s) => <div key={s.name} className="flex items-baseline gap-2 overflow-hidden whitespace-nowrap"><span className="w-16 shrink-0 text-[11px] text-stone-500" dir="ltr">{s.name} · {s.px}</span><span style={{ fontSize: s.px, lineHeight: s.lineHeight }} className="font-bold text-stone-800">Aa شام</span></div>)}
          </div>
          <CopyButton text={typeScaleCss(steps)} label={d('copy')} done={d('copied')} />
        </div>
        <div className={card}>
          <p className={label}>{d('tl_spacing')}</p>
          <label className="inline-flex items-center gap-2 text-[12.5px] font-bold text-stone-700"><input type="range" min={2} max={12} value={unit} onChange={(e) => setUnit(Number(e.target.value))} /><span dir="ltr">{unit}px</span></label>
          <div className="max-h-64 space-y-1 overflow-y-auto" dir="ltr">
            {space.map((s) => <div key={s.name} className="flex items-center gap-2"><span className="w-20 shrink-0 text-[11px] text-stone-500">{s.name} · {s.px}px</span><span className="h-3 rounded bg-amber-500" style={{ width: Math.min(s.px, 260) }} /></div>)}
          </div>
          <CopyButton text={spacingCss(space)} label={d('copy')} done={d('copied')} />
        </div>
      </div>

      <div className={card}>
        <p className={label}>{d('tl_tokens')}</p>
        <CodeBox code={tokens} rows={8} />
        <div className="flex flex-wrap gap-2">
          <CopyButton text={tokens} label={d('copy')} done={d('copied')} />
          <button type="button" className={soft} onClick={() => downloadBlob(new Blob([tokens], { type: 'text/css;charset=utf-8' }), 'design-tokens.css')}><Download className="h-4 w-4" />{d('download')} tokens.css</button>
        </div>
      </div>
    </div>
  );
}
