import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle, BookOpen, Check, CheckCircle2, Copy, Download, FlaskConical, Info, MessageCircle, Plus, Printer, RotateCcw,
  Scale, Search, ShieldCheck, Sparkles, Star, Trash2, Upload, Wand2, XCircle, Timer, Wind, Droplets, Layers, PenLine,
} from 'lucide-react';
import type { SupportedLanguage } from '../types/i18n';
import { SUPPORTED_LANGUAGES } from '../types/i18n';
import { LocalizedNumberInput } from './LocalizedNumberInput';
import { fmt, loc, type LText } from '../لغات/localize';
import { formatLocalizedNumber } from '../لغات/numerals';
import { designersText, type DesignersKey } from '../لغات/designersL10n';
import { COSMETIC_PHASE_TEXT, COSMETIC_PRODUCT_TEXT } from '../لغات/cosmeticsL10n';
import { LAYER_LABEL, PERFUME_MATERIALS, TAG_LABEL, findPerfumeMaterial, perfumeMaterial } from '../utils/designers/perfumeMaterials';
import {
  PERFUME_STARTERS, PERFUME_TYPES, TYPE_LABEL, TYPE_RANGE, balancePyramid, boostLongevity, convertType, emptyPerfumeDesign, fixCompliance,
  inspire, lineFor, scaleTo100, simulatePerfume, starterDesign, type PerfumeDesign, type PerfumeSimulation, type PerfumeType, type Status,
  type StoreReference, type WorldReference,
} from '../utils/designers/perfumeLab';
import {
  AREA_LABEL, COSMETIC_AREAS, KIND_LABEL, LAB_INGREDIENTS, cosmeticLineFor, cosmeticStarter, emptyCosmeticDesign, findLabIngredient,
  fixCosmeticCompliance, inspireCosmetic, labIngredient, roleLabel, scaleCosmeticTo100, simulateCosmetic, topUpWithWater,
  type CosmeticArea, type CosmeticDesign, type CosmeticSimulation,
} from '../utils/designers/cosmeticLab';
import { COSMETIC_PRODUCTS, type CosmeticProduct } from '../utils/cosmeticFormulator';
import { WORLD_PERFUMES } from '../data/worldPerfumes';
import { DesignerAdvisor } from './DesignerAdvisor';
import { consultPerfume, perfumeGoal, perfumeSuggestions } from '../utils/designers/perfumeAdvisor';
import { consultCosmetic, cosmeticGoal, cosmeticSuggestions } from '../utils/designers/cosmeticAdvisor';
import { loadStoreCatalog, productPageUrl } from '../utils/liveStore';
import { LAB_SIGNAL_NOTE } from '../utils/labSignals';
import { shareLabSignal } from '../utils/labSignalSend';
import { openFormulaInLab } from '../community/sync';
import {
  compareLines, deleteEntry, journalExport, journalImport, rateVersion, readJournal, saveVersion, type DesignerKind, type JournalEntry,
} from '../utils/designers/journal';

interface Props { kind: DesignerKind; currentLang: SupportedLanguage; onNavigate: (tab: string) => void }
type ResultTab = 'result' | 'resemble' | 'compliance' | 'lab' | 'journal';
const TABS: { id: ResultTab; key: DesignersKey; icon: React.ElementType }[] = [
  { id: 'result', key: 'tabResult', icon: Sparkles }, { id: 'resemble', key: 'tabResemble', icon: Search },
  { id: 'compliance', key: 'tabCompliance', icon: ShieldCheck }, { id: 'lab', key: 'tabLab', icon: FlaskConical }, { id: 'journal', key: 'tabJournal', icon: BookOpen },
];
const STATUS_STYLE: Record<Status, string> = { pass: 'border-emerald-200 bg-emerald-50', warn: 'border-amber-200 bg-amber-50', fail: 'border-red-200 bg-red-50', info: 'border-sky-200 bg-sky-50' };
const STATUS_ICON: Record<Status, React.ElementType> = { pass: CheckCircle2, warn: AlertTriangle, fail: XCircle, info: Info };
const STATUS_COLOR: Record<Status, string> = { pass: 'text-emerald-700', warn: 'text-amber-700', fail: 'text-red-700', info: 'text-sky-700' };
const LAYER_COLOR = { top: '#f59e0b', heart: '#e11d48', base: '#7c3aed' } as const;

/** «قسم المصممين»: the designer's interactive journal — write a formula, simulate it fully, check it, take it to the lab. */
export default function DesignersStudio({ kind, currentLang, onNavigate }: Props) {
  const lang = currentLang;
  const dt = (k: DesignersKey) => designersText(lang, k);
  const num = (n: number, d = 2) => formatLocalizedNumber(lang, n, { maximumFractionDigits: d });
  const rtl = SUPPORTED_LANGUAGES.find((l) => l.code === lang)?.dir === 'rtl';
  const perfume = kind === 'perfume';
  const accent = perfume ? 'amber' : 'rose';

  return (
    <div className="space-y-6" data-testid={`designers-${kind}`}>
      <section className={`relative overflow-hidden rounded-3xl border p-6 sm:p-10 shadow-xs ${perfume ? 'border-amber-200/70 bg-gradient-to-br from-amber-50 via-white to-stone-50' : 'border-rose-200/70 bg-gradient-to-br from-rose-50 via-white to-amber-50'}`}>
        <div className="relative space-y-3 max-w-4xl">
          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-white text-xs font-bold ${perfume ? 'bg-amber-700' : 'bg-rose-700'}`}>
            <PenLine className="w-3.5 h-3.5" /> {dt('badge')}
          </span>
          <h1 className="text-2xl sm:text-3xl font-black text-stone-900 leading-tight">{dt(perfume ? 'titlePerfume' : 'titleCosmetic')}</h1>
          <p className="text-sm sm:text-base text-stone-600 leading-relaxed">{dt(perfume ? 'subtitlePerfume' : 'subtitleCosmetic')}</p>
          <p className="text-xs text-stone-500 flex items-start gap-1.5"><ShieldCheck className="w-4 h-4 shrink-0" /> {dt(perfume ? 'disclaimerPerfume' : 'disclaimerCosmetic')}</p>
        </div>
      </section>
      {perfume
        ? <PerfumeStudio lang={lang} dt={dt} num={num} rtl={rtl} accent={accent} onNavigate={onNavigate} />
        : <CosmeticStudio lang={lang} dt={dt} num={num} rtl={rtl} accent={accent} onNavigate={onNavigate} />}
    </div>
  );
}

interface Inner { lang: SupportedLanguage; dt: (k: DesignersKey) => string; num: (n: number, d?: number) => string; rtl: boolean; accent: string; onNavigate: (tab: string) => void }

// ── Shared pieces ──────────────────────────────────────────────────────────────────────────────────────────────────
interface Option { id: string; label: string; sub: string; flag?: boolean }

function Picker({ options, onPick, dt, find }: { options: Option[]; onPick: (id: string | undefined, typed: string) => void; dt: Inner['dt']; find: (q: string) => string | undefined }) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return options.slice(0, 12);
    const best = find(q);
    const hits = options.filter((o) => o.label.toLowerCase().includes(s) || o.sub.toLowerCase().includes(s));
    const first = best ? options.filter((o) => o.id === best) : [];
    return [...first, ...hits.filter((o) => o.id !== best)].slice(0, 12);
  }, [q, options, find]);
  const pick = (id: string | undefined) => { onPick(id, q.trim()); setQ(''); setOpen(false); };
  return (
    <div className="relative">
      <div className="flex items-center gap-2 rounded-2xl border border-stone-200 bg-white px-3 py-2 focus-within:border-stone-400">
        <Search className="w-4 h-4 text-stone-400 shrink-0" />
        <input value={q} onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => { if (e.key === 'Enter' && q.trim()) { e.preventDefault(); pick(shown[0]?.id && find(q) ? shown[0].id : undefined); } }}
          placeholder={dt('searchPh')} aria-label={dt('addLine')} className="w-full bg-transparent text-sm outline-none" data-testid="designer-search" />
      </div>
      {open && (
        <ul className="absolute z-20 mt-1 w-full max-h-72 overflow-auto rounded-2xl border border-stone-200 bg-white shadow-lg">
          {shown.map((o) => (
            <li key={o.id}>
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => pick(o.id)} className="w-full text-start px-3 py-2 hover:bg-stone-50 cursor-pointer">
                <span className={`text-sm font-semibold ${o.flag ? 'text-red-700' : 'text-stone-800'}`}>{o.label}</span>
                <span className="block text-[11px] text-stone-500">{o.sub}</span>
              </button>
            </li>
          ))}
          {q.trim() && (
            <li><button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => pick(undefined)} className="w-full text-start px-3 py-2 text-sm text-stone-600 hover:bg-stone-50 cursor-pointer border-t border-stone-100">
              <Plus className="inline w-3.5 h-3.5" /> {dt('useTyped')}: «{q.trim()}» <span className="text-[11px] text-stone-400">({dt('notInBank')})</span>
            </button></li>
          )}
        </ul>
      )}
    </div>
  );
}

function ToolButton({ icon: Icon, label, onClick, testId }: { icon: React.ElementType; label: string; onClick: () => void; testId?: string }) {
  return (
    <button type="button" onClick={onClick} data-testid={testId}
      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-stone-200 bg-white hover:border-stone-400 text-xs font-bold text-stone-700 cursor-pointer">
      <Icon className="w-3.5 h-3.5" /> {label}
    </button>
  );
}

function NumberField({ lang, label, value, onValue, integer, min, max }: { lang: SupportedLanguage; label: string; value: number; onValue: (n: number) => void; integer?: boolean; min?: number; max?: number }) {
  return (
    <label className="block">
      <span className="block text-[11px] font-bold text-stone-500 mb-1">{label}</span>
      <LocalizedNumberInput lang={lang} value={value} integer={integer} min={min} max={max} ariaLabel={label}
        onValue={(n) => { if (Number.isFinite(n)) onValue(Math.max(min ?? -Infinity, Math.min(max ?? Infinity, n))); }}
        className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm" />
    </label>
  );
}

function Verdict({ verdict, dt }: { verdict: Exclude<Status, 'info'>; dt: Inner['dt'] }) {
  const Icon = STATUS_ICON[verdict];
  const key: DesignersKey = verdict === 'pass' ? 'verdictPass' : verdict === 'warn' ? 'verdictWarn' : 'verdictFail';
  return <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-sm font-black ${STATUS_STYLE[verdict]} ${STATUS_COLOR[verdict]}`} data-testid="designer-verdict"><Icon className="w-4 h-4" /> {dt(key)}</div>;
}

function Checks({ checks, lang, dt, onSwap }: { checks: { id: string; status: Status; title: LText; detail: LText; fix?: LText }[]; lang: SupportedLanguage; dt: Inner['dt']; onSwap?: (checkId: string) => void }) {
  const order: Status[] = ['fail', 'warn', 'info', 'pass'];
  return (
    <ul className="space-y-2">
      {[...checks].sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status)).map((c) => {
        const Icon = STATUS_ICON[c.status];
        return (
          <li key={c.id} className={`rounded-2xl border p-3 ${STATUS_STYLE[c.status]}`} data-testid={`check-${c.status}`}>
            <p className={`text-sm font-bold flex items-start gap-2 ${STATUS_COLOR[c.status]}`}><Icon className="w-4 h-4 mt-0.5 shrink-0" /> {loc(lang, c.title)}</p>
            <p className="text-xs text-stone-700 mt-1 leading-relaxed">{loc(lang, c.detail)}</p>
            {c.fix && <p className="text-xs text-stone-600 mt-1"><b>{dt('howToFix')}:</b> {loc(lang, c.fix)} {onSwap && c.status === 'fail' && <button type="button" onClick={() => onSwap(c.id)} className="ms-1 underline font-bold cursor-pointer">{dt('toolFix')}</button>}</p>}
          </li>
        );
      })}
    </ul>
  );
}

function Bar({ value, max = 100, color }: { value: number; max?: number; color: string }) {
  return <div className="h-2 rounded-full bg-stone-100 overflow-hidden"><div className="h-full rounded-full" style={{ width: `${Math.max(0, Math.min(100, (value / max) * 100))}%`, background: color }} /></div>;
}

function useCopy() {
  const [done, setDone] = useState(false);
  return { done, copy: (text: string) => { void navigator.clipboard?.writeText(text).then(() => { setDone(true); setTimeout(() => setDone(false), 1500); }).catch(() => undefined); } };
}

function useHistory<D>(initial: D) {
  const [value, setValue] = useState<D>(initial);
  const past = useRef<D[]>([]);
  return {
    value,
    set: (next: D | ((d: D) => D)) => setValue((cur) => { past.current = [cur, ...past.current].slice(0, 30); return typeof next === 'function' ? (next as (d: D) => D)(cur) : next; }),
    undo: () => { const prev = past.current.shift(); if (prev) setValue(prev); },
    canUndo: () => past.current.length > 0,
  };
}

// ── Journal (shared) ───────────────────────────────────────────────────────────────────────────────────────────────
function JournalPanel<D extends { title: string; lines: { label: string; pct: number }[] }>({ kind, lang, dt, num, design, summary, onLoad, current, setCurrent }: {
  kind: DesignerKind; lang: SupportedLanguage; dt: Inner['dt']; num: Inner['num']; design: D; summary: { verdict: Exclude<Status, 'info'>; score?: number };
  onLoad: (d: D, id: string) => void; current?: string; setCurrent: (id: string | undefined) => void;
}) {
  const [entries, setEntries] = useState<JournalEntry<D>[]>(() => readJournal<D>(kind));
  const [flash, setFlash] = useState('');
  const [rating, setRating] = useState<Record<string, { r: number; n: string }>>({});
  const refresh = () => setEntries(readJournal<D>(kind));
  const save = (asNew: boolean) => {
    const id = saveVersion<D>(kind, { id: asNew ? undefined : current, title: design.title, design, summary });
    setCurrent(id); refresh(); setFlash(dt('saved')); setTimeout(() => setFlash(''), 1800);
  };
  const exportFile = () => {
    const blob = new Blob([journalExport(kind, entries)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `sham-designer-${kind}.json`; a.click(); URL.revokeObjectURL(a.href);
  };
  const importFile = (file?: File) => { if (!file) return; void file.text().then((t) => { const n = journalImport<D>(kind, t); refresh(); setFlash(`${dt('imported')}: ${num(n, 0)}`); setTimeout(() => setFlash(''), 1800); }); };
  return (
    <div className="space-y-4" data-testid="designer-journal">
      <div className="flex flex-wrap gap-2 items-center">
        {current && <button type="button" onClick={() => save(false)} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-stone-900 text-white text-xs font-bold cursor-pointer"><Check className="w-3.5 h-3.5" /> {dt('saveVersion')}</button>}
        <button type="button" onClick={() => save(true)} data-testid="journal-save" className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-stone-300 bg-white text-xs font-bold cursor-pointer"><Plus className="w-3.5 h-3.5" /> {dt('saveNew')}</button>
        <button type="button" onClick={exportFile} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-stone-200 bg-white text-xs font-bold cursor-pointer"><Download className="w-3.5 h-3.5" /> {dt('exportJson')}</button>
        <label className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-stone-200 bg-white text-xs font-bold cursor-pointer"><Upload className="w-3.5 h-3.5" /> {dt('importJson')}
          <input type="file" accept="application/json" className="hidden" onChange={(e) => importFile(e.target.files?.[0])} /></label>
        {flash && <span className="text-xs font-bold text-emerald-700">{flash}</span>}
      </div>
      <p className="text-[11px] text-stone-500">{dt('journalLocal')}</p>
      {!entries.length && <p className="text-sm text-stone-500">{dt('journalEmpty')}</p>}
      <ul className="space-y-3">
        {entries.map((e) => {
          const [latest, prev] = e.versions;
          const diff = prev ? compareLines(prev.design.lines, latest.design.lines) : [];
          const r = rating[e.id] || { r: latest.rating || 0, n: latest.notes || '' };
          return (
            <li key={e.id} className={`rounded-2xl border p-3 bg-white ${current === e.id ? 'border-stone-900' : 'border-stone-200'}`}>
              <div className="flex flex-wrap items-center gap-2 justify-between">
                <div>
                  <p className="text-sm font-black text-stone-900">{e.title}</p>
                  <p className="text-[11px] text-stone-500">{new Date(e.updated).toLocaleString(lang)} · {num(e.versions.length, 0)} {dt('versions')}{latest.summary.score !== undefined ? ` · ${num(latest.summary.score, 1)}` : ''}</p>
                </div>
                <div className="flex gap-2 items-center">
                  <span className={`text-[11px] font-bold ${STATUS_COLOR[latest.summary.verdict]}`}>{dt(latest.summary.verdict === 'pass' ? 'verdictPass' : latest.summary.verdict === 'warn' ? 'verdictWarn' : 'verdictFail')}</span>
                  <button type="button" onClick={() => { onLoad(latest.design, e.id); }} className="px-2.5 py-1 rounded-lg bg-stone-900 text-white text-[11px] font-bold cursor-pointer">{dt('load')}</button>
                  <button type="button" onClick={() => { deleteEntry(kind, e.id); if (current === e.id) setCurrent(undefined); refresh(); }} aria-label={dt('delete')} className="p-1 text-stone-400 hover:text-red-600 cursor-pointer"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
              {prev && (
                <div className="mt-2 text-[11px] text-stone-600"><b>{dt('compare')}:</b> {diff.length ? diff.map((x) => `${x.label} ${x.from === undefined ? '+' : num(x.from)}→${x.to === undefined ? '×' : num(x.to)}`).join(' · ') : dt('noChanges')}</div>
              )}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-bold text-stone-500">{dt('rate')}</span>
                {[1, 2, 3, 4, 5].map((s) => (
                  <button key={s} type="button" aria-label={num(s, 0)} onClick={() => setRating({ ...rating, [e.id]: { ...r, r: s } })} className="cursor-pointer">
                    <Star className={`w-4 h-4 ${s <= r.r ? 'fill-amber-400 text-amber-500' : 'text-stone-300'}`} />
                  </button>
                ))}
                <input value={r.n} onChange={(ev) => setRating({ ...rating, [e.id]: { ...r, n: ev.target.value } })} placeholder={dt('notesPh')} className="flex-1 min-w-40 rounded-lg border border-stone-200 px-2 py-1 text-xs" />
                <button type="button" onClick={() => { rateVersion(kind, e.id, 0, r.r || 1, r.n); refresh(); }} className="px-2 py-1 rounded-lg border border-stone-300 text-[11px] font-bold cursor-pointer">{dt('saveRating')}</button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ── Perfume ────────────────────────────────────────────────────────────────────────────────────────────────────────
const WORLD: WorldReference[] = WORLD_PERFUMES.map((w) => ({ id: w.id, name: { ar: w.nameAr, en: w.nameEn }, notes: w.pyramidNotes.map((n) => ({ name: `${n.nameAr} ${n.nameEn}`, pct: n.percentageOfOil })) }));
/** Hands a question to the site's assistant (it uses the AI platforms when they work, its own brain otherwise). */
const askText = (text: string) => window.dispatchEvent(new CustomEvent('open-sham-assistant', { detail: text }));
const PERFUME_DRAFT = 'sham_designer_draft_perfume';
const COSMETIC_DRAFT = 'sham_designer_draft_cosmetic';
const readDraft = <D,>(key: string, fallback: D): D => { try { const raw = localStorage.getItem(key); return raw ? { ...fallback, ...(JSON.parse(raw) as D) } : fallback; } catch { return fallback; } };

function PerfumeStudio({ lang, dt, num, onNavigate }: Inner) {
  const h = useHistory<PerfumeDesign>(readDraft(PERFUME_DRAFT, { ...(starterDesign(PERFUME_STARTERS[0].id) || emptyPerfumeDesign()), title: loc(lang, PERFUME_STARTERS[0].name) }));
  const d = h.value;
  const [tab, setTab] = useState<ResultTab>('result');
  const [store, setStore] = useState<StoreReference[]>([]);
  const [seed, setSeed] = useState(1);
  const [shared, setShared] = useState<'idle' | 'shared' | 'failed'>('idle');
  const [current, setCurrent] = useState<string | undefined>();
  const { done, copy } = useCopy();
  useEffect(() => { try { localStorage.setItem(PERFUME_DRAFT, JSON.stringify(d)); } catch { /* private mode */ } }, [d]);
  useEffect(() => {
    let alive = true;
    loadStoreCatalog().then((items) => { if (alive) setStore(items.filter((p) => p.inStock).map((p) => ({ slug: p.slug, name: p.name, price: p.price, notes: [...p.notes.top, ...p.notes.heart, ...p.notes.base] })).filter((p) => p.notes.length > 0)); }).catch(() => undefined);
    return () => { alive = false; };
  }, []);
  const sim = useMemo(() => simulatePerfume(d, { world: WORLD, store }), [d, store]);
  const options = useMemo<Option[]>(() => PERFUME_MATERIALS.map((m) => ({ id: m.id, label: loc(lang, m.name), sub: `${loc(lang, LAYER_LABEL[m.layer])} · ${m.tags.map((t) => loc(lang, TAG_LABEL[t])).join(dt('listSep'))}`, flag: m.ifra?.kind === 'prohibited' })), [lang]);
  const nameOf = (l: PerfumeDesign['lines'][number]) => { const m = l.materialId ? perfumeMaterial(l.materialId) : undefined; return m ? loc(lang, m.name) : l.label; };
  const setLine = (i: number, patch: Partial<PerfumeDesign['lines'][number]>) => h.set((x) => ({ ...x, lines: x.lines.map((l, j) => (j === i ? { ...l, ...patch } : l)) }));
  const formulaText = () => `${d.title || '—'} · ${loc(lang, TYPE_LABEL[d.type])} ${num(d.concentration)}%\n${d.lines.map((l) => `${nameOf(l)}: ${num(l.pct)}%`).join('\n')}`;
  const verdictText = dt(sim.verdict === 'pass' ? 'verdictPass' : sim.verdict === 'warn' ? 'verdictWarn' : 'verdictFail');
  const suggestions = useMemo(() => perfumeSuggestions(d, sim), [d, sim]);
  const consult = useMemo(() => consultPerfume(d, sim), [d, sim]);
  const formulaLine = () => `${loc(lang, TYPE_LABEL[d.type])} ${num(d.concentration)}% — ${d.lines.map((l) => `${nameOf(l)} ${num(l.pct)}%`).join(dt('listSep')) || '—'}`;
  const ask = () => window.dispatchEvent(new CustomEvent('open-sham-assistant', { detail: fmt(dt('askPerfume'), { formula: d.lines.map((l) => `${nameOf(l)} ${num(l.pct)}%`).join(dt('listSep')), verdict: verdictText }) }));
  const sendToLab = () => openFormulaInLab(d.title || loc(lang, TYPE_LABEL[d.type]), {
    notes: loc(lang, sim.character), macerationDays: sim.macerationDays,
    formulation: { concentrationPercent: d.concentration, concentrationType: d.type === 'oil' ? 'oil_pure' : d.type, bottleVolumeMl: d.bottleMl, batchCount: d.bottles, waterPercent: d.water, fixativePercent: d.fixative, alcoholPercentage: d.type === 'oil' ? 0 : Math.max(0, 100 - d.concentration - d.water - d.fixative) },
    pyramidNotes: sim.active.map((a) => ({ nameAr: a.material?.name.ar || a.line.label, nameEn: a.material?.name.en || a.line.label, category: a.material?.layer || 'heart', percentageOfOil: Math.round(a.oilPct * 100) / 100 })),
  });

  return (
    <div className="grid lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] gap-6 items-start">
      <section className="rounded-3xl border border-stone-200 bg-white p-4 sm:p-6 space-y-4 shadow-2xs" data-testid="designer-editor">
        <h2 className="text-lg font-black text-stone-900 flex items-center gap-2"><PenLine className="w-5 h-5 text-amber-700" /> {dt('editorTitle')}</h2>
        <label className="block"><span className="block text-[11px] font-bold text-stone-500 mb-1">{dt('formulaName')}</span>
          <input value={d.title} onChange={(e) => h.set({ ...d, title: e.target.value.slice(0, 80) })} placeholder={dt('formulaNamePh')} className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm" /></label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <label className="block"><span className="block text-[11px] font-bold text-stone-500 mb-1">{dt('type')}</span>
            <select value={d.type} onChange={(e) => h.set({ ...d, type: e.target.value as PerfumeType })} className="w-full rounded-xl border border-stone-200 bg-white px-2 py-2 text-sm">
              {PERFUME_TYPES.map((t) => <option key={t} value={t}>{loc(lang, TYPE_LABEL[t])}</option>)}
            </select></label>
          <NumberField lang={lang} label={dt('concentration')} value={d.concentration} min={0.5} max={100} onValue={(n) => h.set({ ...d, concentration: n })} />
          {d.type !== 'oil' && <NumberField lang={lang} label={dt('water')} value={d.water} min={0} max={50} onValue={(n) => h.set({ ...d, water: n })} />}
          <NumberField lang={lang} label={dt('fixative')} value={d.fixative} min={0} max={20} onValue={(n) => h.set({ ...d, fixative: n })} />
          <NumberField lang={lang} label={dt('bottle')} value={d.bottleMl} min={1} max={5000} integer onValue={(n) => h.set({ ...d, bottleMl: n })} />
          <NumberField lang={lang} label={dt('bottles')} value={d.bottles} min={1} max={10000} integer onValue={(n) => h.set({ ...d, bottles: n })} />
        </div>
        <Picker options={options} dt={dt} find={(q) => findPerfumeMaterial(q)?.id}
          onPick={(id, typed) => h.set((x) => ({ ...x, lines: [...x.lines, id ? { materialId: id, label: perfumeMaterial(id)!.name.en, pct: 5 } : lineFor(typed, 5)] }))} />
        {!d.lines.length && <p className="text-sm text-stone-500">{dt('empty')}</p>}
        {d.lines.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-[11px] text-stone-500 text-start"><th className="text-start py-1">{dt('colMaterial')}</th><th className="text-start">{dt('colLayer')}</th><th className="text-start w-24">{dt('colPctOil')}</th><th className="text-start w-20">{dt('dilution')}</th><th /></tr></thead>
              <tbody>
                {d.lines.map((l, i) => {
                  const m = l.materialId ? perfumeMaterial(l.materialId) : undefined;
                  return (
                    <tr key={`${l.materialId || l.label}-${i}`} className="border-t border-stone-100" data-testid="designer-line">
                      <td className={`py-1.5 pe-2 font-semibold ${m?.ifra?.kind === 'prohibited' ? 'text-red-700' : m ? 'text-stone-800' : 'text-stone-500 italic'}`}>{nameOf(l)}</td>
                      <td className="pe-2 text-[11px]"><span className="inline-block w-2 h-2 rounded-full me-1" style={{ background: LAYER_COLOR[m?.layer || 'heart'] }} />{loc(lang, LAYER_LABEL[m?.layer || 'heart'])}</td>
                      <td className="pe-2"><LocalizedNumberInput lang={lang} value={l.pct} min={0} max={100} ariaLabel={dt('colPctOil')} onValue={(n) => { if (Number.isFinite(n)) setLine(i, { pct: Math.max(0, Math.min(100, n)) }); }} className="w-20 rounded-lg border border-stone-200 px-2 py-1 text-sm" /></td>
                      <td className="pe-2"><LocalizedNumberInput lang={lang} value={l.dilution ?? 100} min={0.1} max={100} ariaLabel={dt('dilution')} onValue={(n) => { if (Number.isFinite(n)) setLine(i, { dilution: n >= 100 ? undefined : Math.max(0.1, n) }); }} className="w-16 rounded-lg border border-stone-200 px-2 py-1 text-sm" /></td>
                      <td><button type="button" aria-label={dt('remove')} onClick={() => h.set((x) => ({ ...x, lines: x.lines.filter((_, j) => j !== i) }))} className="p-1 text-stone-400 hover:text-red-600 cursor-pointer"><Trash2 className="w-4 h-4" /></button></td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot><tr className="border-t border-stone-200 font-black"><td className="py-1.5">{dt('total')}</td><td /><td className={Math.abs(sim.total - 100) > 0.5 ? 'text-red-700' : 'text-emerald-700'}>{num(sim.total)}%</td><td colSpan={2} /></tr></tfoot>
            </table>
          </div>
        )}
        <div className="space-y-2">
          <p className="text-xs font-black text-stone-700 flex items-center gap-1.5"><Wand2 className="w-4 h-4" /> {dt('toolsTitle')}</p>
          <div className="flex flex-wrap gap-2">
            <select aria-label={dt('toolStart')} value="" onChange={(e) => { const s = starterDesign(e.target.value); if (s) { h.set({ ...s, title: loc(lang, PERFUME_STARTERS.find((x) => x.id === e.target.value)!.name), bottleMl: d.bottleMl, bottles: d.bottles }); setCurrent(undefined); } }}
              className="rounded-xl border border-stone-200 bg-white px-2 py-2 text-xs font-bold text-stone-700" data-testid="tool-starter">
              <option value="">{dt('toolStart')}</option>
              {PERFUME_STARTERS.map((s) => <option key={s.id} value={s.id}>{loc(lang, s.name)}</option>)}
            </select>
            <ToolButton icon={Scale} label={dt('toolScale')} onClick={() => h.set(scaleTo100(d))} testId="tool-scale" />
            <ToolButton icon={Layers} label={dt('toolBalance')} onClick={() => h.set(balancePyramid(d))} testId="tool-balance" />
            <ToolButton icon={ShieldCheck} label={dt('toolFix')} onClick={() => h.set(fixCompliance(d))} testId="tool-fix" />
            <ToolButton icon={Timer} label={dt('toolBoost')} onClick={() => h.set(boostLongevity(d))} testId="tool-boost" />
            <ToolButton icon={Sparkles} label={dt('toolInspire')} onClick={() => { h.set(inspire(d, seed)); setSeed(seed + 1); }} testId="tool-inspire" />
            <select aria-label={dt('toolConvert')} value="" onChange={(e) => { if (e.target.value) h.set(convertType(d, e.target.value as PerfumeType)); }} className="rounded-xl border border-stone-200 bg-white px-2 py-2 text-xs font-bold text-stone-700">
              <option value="">{dt('toolConvert')}</option>
              {PERFUME_TYPES.map((t) => <option key={t} value={t}>{loc(lang, TYPE_LABEL[t])} ({num(TYPE_RANGE[t][0], 0)}–{num(TYPE_RANGE[t][1], 0)}%)</option>)}
            </select>
            <ToolButton icon={RotateCcw} label={dt('toolUndo')} onClick={h.undo} />
            <ToolButton icon={Trash2} label={dt('toolClear')} onClick={() => { h.set(emptyPerfumeDesign()); setCurrent(undefined); }} />
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-stone-200 bg-white p-4 sm:p-6 space-y-4 shadow-2xs" data-testid="designer-result">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Verdict verdict={sim.verdict} dt={dt} />
          <button type="button" onClick={ask} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-stone-900 text-white text-xs font-bold cursor-pointer"><MessageCircle className="w-3.5 h-3.5" /> {dt('askShaheen')}</button>
        </div>
        <DesignerAdvisor<PerfumeDesign> lang={lang} dt={dt} num={num} accent="amber" hasLines={d.lines.length > 0} design={d} suggestions={suggestions} consult={consult}
          plan={(g) => perfumeGoal(g, d, WORLD)} goalPlaceholder={dt('goalPhPerfume')} formula={formulaLine} onApply={(x) => h.set(x)} onUndo={h.undo} onAsk={askText}
          changeName={(c) => { const m = c.id ? perfumeMaterial(c.id) : undefined; return m ? loc(lang, m.name) : c.label; }} />
        <nav className="flex gap-1.5 overflow-x-auto pb-1">
          {TABS.map(({ id, key, icon: Icon }) => (
            <button key={id} type="button" onClick={() => setTab(id)} aria-pressed={tab === id} data-testid={`designer-tab-${id}`}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap border cursor-pointer ${tab === id ? 'bg-amber-700 text-white border-amber-700' : 'bg-white text-stone-700 border-stone-200'}`}>
              <Icon className="w-3.5 h-3.5" /> {dt(key)}
            </button>
          ))}
        </nav>
        {!d.lines.length && tab !== 'journal' ? <p className="text-sm text-stone-500">{dt('noLines')}</p> : (
          <>
            {tab === 'result' && <PerfumeResult sim={sim} lang={lang} dt={dt} num={num} />}
            {tab === 'resemble' && (
              <div className="space-y-4">
                <p className="text-xs text-stone-500">{dt('resembleNote')}</p>
                {(['world', 'store'] as const).map((k) => {
                  const list = sim.resemblances.filter((r) => r.kind === k);
                  return (
                    <div key={k} className="space-y-2">
                      <h3 className="text-sm font-black text-stone-800">{dt(k === 'world' ? 'resembleWorld' : 'resembleStore')}</h3>
                      {!list.length && <p className="text-xs text-stone-500">{dt('resembleNone')}</p>}
                      {list.map((r) => (
                        <div key={r.id} className="rounded-2xl border border-stone-200 p-3 space-y-1.5" data-testid={`resemble-${k}`}>
                          <div className="flex justify-between gap-2 text-sm font-bold"><span>{loc(lang, r.name)}</span><span className="text-amber-700">{num(r.score, 0)}%</span></div>
                          <Bar value={r.score} color="#b45309" />
                          <p className="text-[11px] text-stone-600">{dt('shared')}: {r.shared.map((id) => { const m = perfumeMaterial(id); return m ? loc(lang, m.name) : id; }).join(dt('listSep'))}</p>
                          {r.slug && <a href={productPageUrl(r.slug)} className="text-[11px] font-bold text-amber-800 underline">{dt('openProduct')}</a>}
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            )}
            {tab === 'compliance' && (
              <div className="space-y-4">
                <Checks checks={sim.checks} lang={lang} dt={dt} onSwap={() => h.set(fixCompliance(d))} />
                {sim.allergens.length > 0 && (
                  <div>
                    <h3 className="text-sm font-black text-stone-800 mb-2">{dt('allergens')}</h3>
                    <table className="w-full text-xs"><tbody>
                      {sim.allergens.map((a) => <tr key={a.inci} className="border-t border-stone-100"><td className="py-1 font-semibold" dir="ltr">{a.inci}</td><td>{num(a.pct, 4)}%</td><td className={a.label ? 'text-amber-700 font-bold' : 'text-stone-400'}>{dt(a.label ? 'mustLabel' : 'belowLabel')}</td></tr>)}
                    </tbody></table>
                  </div>
                )}
                <p className="text-[11px] text-stone-500 flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5" /> {dt('checkSupplier')}</p>
              </div>
            )}
            {tab === 'lab' && (
              <div className="space-y-4">
                <h3 className="text-sm font-black text-stone-800">{dt('labTitle')} — {num(sim.carrier.totalMl, 1)} {dt('ml')}</h3>
                <div className="overflow-x-auto"><table className="w-full text-xs" data-testid="designer-batch">
                  <thead><tr className="text-stone-500"><th className="text-start py-1">{dt('colMaterial')}</th><th className="text-start">{dt('ml')}</th><th className="text-start">{dt('grams')}</th><th className="text-start">{dt('drops')}</th></tr></thead>
                  <tbody>{sim.batch.map((b, i) => <tr key={`${b.label}-${i}`} className="border-t border-stone-100"><td className="py-1 font-semibold">{b.materialId ? loc(lang, perfumeMaterial(b.materialId)!.name) : b.label}</td><td>{num(b.ml)}</td><td>{num(b.grams)}</td><td>{num(b.drops, 0)}</td></tr>)}</tbody>
                  <tfoot>
                    <tr className="border-t border-stone-300 font-bold"><td className="py-1">{dt('oilTotal')}</td><td>{num(sim.carrier.oilMl, 1)}</td><td colSpan={2} /></tr>
                    {sim.carrier.alcoholMl > 0 && <tr><td className="py-1">{dt('alcohol')}</td><td>{num(sim.carrier.alcoholMl, 1)}</td><td colSpan={2} /></tr>}
                    {sim.carrier.waterMl > 0 && <tr><td className="py-1">{dt('waterShare')}</td><td>{num(sim.carrier.waterMl, 1)}</td><td colSpan={2} /></tr>}
                    {sim.carrier.fixativeMl > 0 && <tr><td className="py-1">{dt('fixative')}</td><td>{num(sim.carrier.fixativeMl, 1)}</td><td colSpan={2} /></tr>}
                  </tfoot>
                </table></div>
                <p className="text-[11px] text-stone-500">{dt('dropNote')} · {dt('maceration')}: {num(sim.macerationDays, 0)} {dt('days')}</p>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => { if (sendToLab()) onNavigate('concentration'); }} data-testid="designer-send-lab" className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-700 text-white text-xs font-bold cursor-pointer"><FlaskConical className="w-3.5 h-3.5" /> {dt('sendLab')}</button>
                  <ToolButton icon={done ? Check : Copy} label={dt(done ? 'copied' : 'copy')} onClick={() => copy(formulaText())} />
                  <ToolButton icon={Printer} label={dt('print')} onClick={() => window.print()} />
                  {/* «شارك تركيبك مجهولاً»: one deliberate press — material ids and the concentration type only. */}
                  <button type="button" data-testid="designer-share-anonymous" title={loc(lang, LAB_SIGNAL_NOTE)}
                    onClick={() => { void shareLabSignal(d).then((r) => setShared(r === 'shared' ? 'shared' : 'failed')); }}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-stone-300 bg-white text-xs font-bold cursor-pointer">
                    <Wind className="w-3.5 h-3.5" /> {shared === 'shared' ? loc(lang, { ar: 'اتشاركت مجهولة — شكراً', en: 'Shared anonymously — thank you' }) : loc(lang, { ar: 'شارك التركيبة مجهولة', en: 'Share this formula anonymously' })}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
        {tab === 'journal' && (
          <JournalPanel<PerfumeDesign> kind="perfume" lang={lang} dt={dt} num={num} design={d} summary={{ verdict: sim.verdict, score: sim.longevityHours }} current={current} setCurrent={setCurrent}
            onLoad={(x, id) => { h.set(x); setCurrent(id); setTab('result'); }} />
        )}
      </section>
    </div>
  );
}

function PerfumeResult({ sim, lang, dt, num }: { sim: PerfumeSimulation; lang: SupportedLanguage; dt: Inner['dt']; num: Inner['num'] }) {
  const W = 560, H = 170, pad = 24;
  const n = sim.timeline.length;
  const x = (i: number) => pad + (i * (W - pad * 2)) / (n - 1);
  const y = (v: number) => H - pad - (v / 100) * (H - pad * 2);
  const area = (k: 'top' | 'heart' | 'base', below: ('top' | 'heart' | 'base')[]) => {
    const upper = sim.timeline.map((t, i) => `${x(i)},${y(below.reduce((s, b) => s + t.layers[b], 0) + t.layers[k])}`);
    const lower = sim.timeline.map((t, i) => `${x(i)},${y(below.reduce((s, b) => s + t.layers[b], 0))}`).reverse();
    return `M${upper.join(' L')} L${lower.join(' L')} Z`;
  };
  const label = (id: string) => { const m = perfumeMaterial(id); return m ? loc(lang, m.name).split(' (')[0] : id; };
  return (
    <div className="space-y-5" data-testid="perfume-result">
      <p className="text-base font-bold text-stone-900 leading-relaxed">{loc(lang, sim.character)}</p>
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-2xl border border-stone-200 p-3 text-center"><Timer className="w-4 h-4 mx-auto text-amber-700" /><p className="text-lg font-black">{num(sim.longevityHours, 1)}</p><p className="text-[11px] text-stone-500">{dt('longevity')} ({dt('hours')})</p></div>
        <div className="rounded-2xl border border-stone-200 p-3 text-center"><Wind className="w-4 h-4 mx-auto text-amber-700" /><p className="text-lg font-black">{num(sim.projection, 0)}/{num(5, 0)}</p><p className="text-[11px] text-stone-500">{dt('projection')}</p></div>
        <div className="rounded-2xl border border-stone-200 p-3 text-center"><Droplets className="w-4 h-4 mx-auto text-amber-700" /><p className="text-lg font-black">{num(sim.macerationDays, 0)}</p><p className="text-[11px] text-stone-500">{dt('maceration')} ({dt('days')})</p></div>
      </div>
      <div className="space-y-2">
        <h3 className="text-sm font-black text-stone-800">{dt('pyramid')}</h3>
        {(['top', 'heart', 'base'] as const).map((k) => (
          <div key={k} className="space-y-1">
            <div className="flex justify-between text-xs"><span className="font-bold">{loc(lang, LAYER_LABEL[k])}</span><span>{num(sim.layers[k], 1)}% <span className="text-stone-400">({dt('usual')} {k === 'top' ? '15–30' : k === 'heart' ? '30–50' : '25–45'})</span></span></div>
            <Bar value={sim.layers[k]} color={LAYER_COLOR[k]} />
          </div>
        ))}
      </div>
      <div className="space-y-2">
        <h3 className="text-sm font-black text-stone-800">{dt('families')}</h3>
        <div className="flex flex-wrap gap-2">{sim.families.map((f) => <span key={f.tag} className="px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200 text-xs font-bold text-amber-900">{loc(lang, TAG_LABEL[f.tag])} {num(f.share, 0)}%</span>)}</div>
      </div>
      <div className="space-y-2">
        <h3 className="text-sm font-black text-stone-800">{dt('timeline')}</h3>
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label={dt('timeline')} data-testid="perfume-timeline">
          <path d={area('base', [])} fill={LAYER_COLOR.base} opacity={0.55} />
          <path d={area('heart', ['base'])} fill={LAYER_COLOR.heart} opacity={0.5} />
          <path d={area('top', ['base', 'heart'])} fill={LAYER_COLOR.top} opacity={0.55} />
          {sim.timeline.map((t, i) => <text key={t.hours} x={x(i)} y={H - 6} fontSize="10" textAnchor="middle" fill="#57534e">{num(t.hours, 2)}{dt('hoursShort')}</text>)}
        </svg>
        <ul className="grid sm:grid-cols-2 gap-1 text-[11px] text-stone-600">
          {sim.timeline.filter((t) => [0, 1, 4, 8].includes(t.hours)).map((t) => <li key={t.hours}><b>{num(t.hours, 2)} {dt('hoursShort')}:</b> {t.dominant.map(label).join(dt('listSep')) || '—'}</li>)}
        </ul>
      </div>
    </div>
  );
}

// ── Cosmetics ──────────────────────────────────────────────────────────────────────────────────────────────────────
function CosmeticStudio({ lang, dt, num, onNavigate }: Inner) {
  const h = useHistory<CosmeticDesign>(readDraft(COSMETIC_DRAFT, { ...cosmeticStarter('face_cream'), title: loc(lang, COSMETIC_PRODUCT_TEXT.face_cream.name) }));
  const d = h.value;
  const [tab, setTab] = useState<ResultTab>('result');
  const [seed, setSeed] = useState(1);
  const [current, setCurrent] = useState<string | undefined>();
  const { done, copy } = useCopy();
  useEffect(() => { try { localStorage.setItem(COSMETIC_DRAFT, JSON.stringify(d)); } catch { /* private mode */ } }, [d]);
  const sim: CosmeticSimulation = useMemo(() => simulateCosmetic(d), [d]);
  const options = useMemo<Option[]>(() => LAB_INGREDIENTS.map((i) => ({ id: i.id, label: loc(lang, i.name), sub: `${loc(lang, roleLabel(i.role))} · ${i.inci}`, flag: i.rule?.kind === 'prohibited' })), [lang]);
  const nameOf = (l: CosmeticDesign['lines'][number]) => { const i = l.ingredientId ? labIngredient(l.ingredientId) : undefined; return i ? loc(lang, i.name) : l.label; };
  const setLine = (i: number, pct: number) => h.set((x) => ({ ...x, lines: x.lines.map((l, j) => (j === i ? { ...l, pct } : l)) }));
  const verdictText = dt(sim.verdict === 'pass' ? 'verdictPass' : sim.verdict === 'warn' ? 'verdictWarn' : 'verdictFail');
  const suggestions = useMemo(() => cosmeticSuggestions(d, sim), [d, sim]);
  const consult = useMemo(() => consultCosmetic(d, sim), [d, sim]);
  const formulaLine = () => `${loc(lang, KIND_LABEL[sim.kind])} — ${d.lines.map((l) => `${nameOf(l)} ${num(l.pct)}%`).join(dt('listSep')) || '—'}`;
  const ask = () => window.dispatchEvent(new CustomEvent('open-sham-assistant', { detail: fmt(dt('askCosmetic'), { formula: d.lines.map((l) => `${nameOf(l)} ${num(l.pct)}%`).join(dt('listSep')), verdict: verdictText }) }));
  const formulaText = () => `${d.title || '—'} · ${loc(lang, KIND_LABEL[sim.kind])} · ${num(d.batch, 0)} ${dt('grams')}\n${sim.lines.map((x) => `${loc(lang, COSMETIC_PHASE_TEXT[x.phase]).split(':')[0]} · ${nameOf(x.line)}: ${num(x.pct)}% = ${num(x.grams)} ${dt('grams')}`).join('\n')}`;

  return (
    <div className="grid lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] gap-6 items-start">
      <section className="rounded-3xl border border-stone-200 bg-white p-4 sm:p-6 space-y-4 shadow-2xs" data-testid="designer-editor">
        <h2 className="text-lg font-black text-stone-900 flex items-center gap-2"><PenLine className="w-5 h-5 text-rose-700" /> {dt('editorTitle')}</h2>
        <label className="block"><span className="block text-[11px] font-bold text-stone-500 mb-1">{dt('formulaName')}</span>
          <input value={d.title} onChange={(e) => h.set({ ...d, title: e.target.value.slice(0, 80) })} placeholder={dt('formulaNamePh')} className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm" /></label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 items-end">
          <label className="block"><span className="block text-[11px] font-bold text-stone-500 mb-1">{dt('area')}</span>
            <select value={d.area} onChange={(e) => h.set({ ...d, area: e.target.value as CosmeticArea })} className="w-full rounded-xl border border-stone-200 bg-white px-2 py-2 text-sm">
              {COSMETIC_AREAS.map((a) => <option key={a} value={a}>{loc(lang, AREA_LABEL[a])}</option>)}
            </select></label>
          <NumberField lang={lang} label={dt('batch')} value={d.batch} min={10} max={5000} integer onValue={(n) => h.set({ ...d, batch: n })} />
          <label className="flex items-center gap-2 text-xs font-bold text-stone-600 pb-2"><input type="checkbox" checked={d.rinseOff} onChange={(e) => h.set({ ...d, rinseOff: e.target.checked })} /> {dt('rinseOff')}</label>
        </div>
        <Picker options={options} dt={dt} find={(q) => findLabIngredient(q)?.id}
          onPick={(id, typed) => h.set((x) => ({ ...x, lines: [...x.lines, id ? { ingredientId: id, label: labIngredient(id)!.name.en, pct: Math.min(labIngredient(id)!.typical[1] || 1, 5) } : cosmeticLineFor(typed, 1)] }))} />
        {!d.lines.length && <p className="text-sm text-stone-500">{dt('empty')}</p>}
        {d.lines.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-[11px] text-stone-500"><th className="text-start py-1">{dt('colMaterial')}</th><th className="text-start">{dt('colRole')}</th><th className="text-start w-24">{dt('colPct')}</th><th /></tr></thead>
              <tbody>
                {d.lines.map((l, i) => {
                  const ing = l.ingredientId ? labIngredient(l.ingredientId) : undefined;
                  return (
                    <tr key={`${l.ingredientId || l.label}-${i}`} className="border-t border-stone-100" data-testid="designer-line">
                      <td className={`py-1.5 pe-2 font-semibold ${ing?.rule?.kind === 'prohibited' ? 'text-red-700' : ing ? 'text-stone-800' : 'text-stone-500 italic'}`}>{nameOf(l)}</td>
                      <td className="pe-2 text-[11px] text-stone-600">{ing ? loc(lang, roleLabel(ing.role)) : '—'}</td>
                      <td className="pe-2"><LocalizedNumberInput lang={lang} value={l.pct} min={0} max={100} ariaLabel={dt('colPct')} onValue={(n) => { if (Number.isFinite(n)) setLine(i, Math.max(0, Math.min(100, n))); }} className="w-20 rounded-lg border border-stone-200 px-2 py-1 text-sm" /></td>
                      <td><button type="button" aria-label={dt('remove')} onClick={() => h.set((x) => ({ ...x, lines: x.lines.filter((_, j) => j !== i) }))} className="p-1 text-stone-400 hover:text-red-600 cursor-pointer"><Trash2 className="w-4 h-4" /></button></td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot><tr className="border-t border-stone-200 font-black"><td className="py-1.5">{dt('total')}</td><td /><td className={Math.abs(sim.total - 100) > 0.1 ? 'text-red-700' : 'text-emerald-700'}>{num(sim.total)}%</td><td /></tr></tfoot>
            </table>
          </div>
        )}
        <div className="space-y-2">
          <p className="text-xs font-black text-stone-700 flex items-center gap-1.5"><Wand2 className="w-4 h-4" /> {dt('toolsTitle')}</p>
          <div className="flex flex-wrap gap-2">
            <select aria-label={dt('toolStart')} value="" onChange={(e) => { if (e.target.value) { const s = cosmeticStarter(e.target.value as CosmeticProduct); h.set({ ...s, title: loc(lang, COSMETIC_PRODUCT_TEXT[e.target.value].name), batch: d.batch }); setCurrent(undefined); } }}
              className="rounded-xl border border-stone-200 bg-white px-2 py-2 text-xs font-bold text-stone-700" data-testid="tool-starter">
              <option value="">{dt('toolStart')}</option>
              {COSMETIC_PRODUCTS.map((p) => <option key={p} value={p}>{loc(lang, COSMETIC_PRODUCT_TEXT[p].name)}</option>)}
            </select>
            <ToolButton icon={Droplets} label={dt('toolWater')} onClick={() => h.set(topUpWithWater(d))} testId="tool-water" />
            <ToolButton icon={Scale} label={dt('toolScale')} onClick={() => h.set(scaleCosmeticTo100(d))} testId="tool-scale" />
            <ToolButton icon={ShieldCheck} label={dt('toolFix')} onClick={() => h.set(fixCosmeticCompliance(d))} testId="tool-fix" />
            <ToolButton icon={Sparkles} label={dt('toolInspire')} onClick={() => { h.set(inspireCosmetic(d, seed)); setSeed(seed + 1); }} testId="tool-inspire" />
            <ToolButton icon={RotateCcw} label={dt('toolUndo')} onClick={h.undo} />
            <ToolButton icon={Trash2} label={dt('toolClear')} onClick={() => { h.set(emptyCosmeticDesign()); setCurrent(undefined); }} />
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-stone-200 bg-white p-4 sm:p-6 space-y-4 shadow-2xs" data-testid="designer-result">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Verdict verdict={sim.verdict} dt={dt} />
          <button type="button" onClick={ask} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-stone-900 text-white text-xs font-bold cursor-pointer"><MessageCircle className="w-3.5 h-3.5" /> {dt('askShaheen')}</button>
        </div>
        <DesignerAdvisor<CosmeticDesign> lang={lang} dt={dt} num={num} accent="rose" hasLines={d.lines.length > 0} design={d} suggestions={suggestions} consult={consult}
          plan={(g) => cosmeticGoal(g, d)} goalPlaceholder={dt('goalPhCosmetic')} formula={formulaLine} onApply={(x) => h.set(x)} onUndo={h.undo} onAsk={askText}
          changeName={(c) => { const i = c.id ? labIngredient(c.id) : undefined; return i ? loc(lang, i.name) : c.label; }} />
        <nav className="flex gap-1.5 overflow-x-auto pb-1">
          {TABS.map(({ id, key, icon: Icon }) => (
            <button key={id} type="button" onClick={() => setTab(id)} aria-pressed={tab === id} data-testid={`designer-tab-${id}`}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap border cursor-pointer ${tab === id ? 'bg-rose-700 text-white border-rose-700' : 'bg-white text-stone-700 border-stone-200'}`}>
              <Icon className="w-3.5 h-3.5" /> {dt(key)}
            </button>
          ))}
        </nav>
        {!d.lines.length && tab !== 'journal' ? <p className="text-sm text-stone-500">{dt('noLines')}</p> : (
          <>
            {tab === 'result' && (
              <div className="space-y-4" data-testid="cosmetic-result">
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-2xl border border-stone-200 p-3"><p className="text-[11px] text-stone-500">{dt('kind')}</p><p className="text-sm font-black">{loc(lang, KIND_LABEL[sim.kind])}</p></div>
                  <div className="rounded-2xl border border-stone-200 p-3"><p className="text-[11px] text-stone-500">{dt('texture')}</p><p className="text-sm font-black">{loc(lang, sim.texture.label)}</p><Bar value={sim.texture.score} color="#be123c" /></div>
                  <div className="rounded-2xl border border-stone-200 p-3"><p className="text-[11px] text-stone-500">{dt('ph')}</p><p className="text-sm font-black" dir="ltr">{sim.ph ? `${num(sim.ph[0], 1)} – ${num(sim.ph[1], 1)}` : '—'}</p></div>
                  <div className="rounded-2xl border border-stone-200 p-3"><p className="text-[11px] text-stone-500">{dt('shelf')}</p><p className="text-sm font-black">{sim.shelfMonths[1] ? `${num(sim.shelfMonths[0], 0)}–${num(sim.shelfMonths[1], 0)} ${dt('months')}` : dt('noShelf')}</p></div>
                  <div className="rounded-2xl border border-stone-200 p-3"><p className="text-[11px] text-stone-500">{dt('heat')}</p><p className="text-sm font-black">{sim.heatC ? `${num(sim.heatC[0], 0)}–${num(sim.heatC[1], 0)} °C` : dt('noHeat')}</p></div>
                  <div className="rounded-2xl border border-stone-200 p-3 space-y-1"><p className="text-[11px] text-stone-500">{dt('waterShare')} / {dt('oilShare')}</p><p className="text-sm font-black">{num(sim.water, 1)}% / {num(sim.oil, 1)}%</p></div>
                </div>
                <div className="space-y-1.5">
                  <h3 className="text-sm font-black text-stone-800">{dt('phases')}</h3>
                  {(['A', 'B', 'C'] as const).filter((p) => sim.phases[p] > 0).map((p) => (
                    <div key={p} className="space-y-1"><div className="flex justify-between text-xs"><span className="font-bold">{loc(lang, COSMETIC_PHASE_TEXT[p])}</span><span>{num(sim.phases[p], 1)}%</span></div><Bar value={sim.phases[p]} color={p === 'A' ? '#0284c7' : p === 'B' ? '#d97706' : '#059669'} /></div>
                  ))}
                </div>
              </div>
            )}
            {tab === 'resemble' && (
              <div className="space-y-3">
                <h3 className="text-sm font-black text-stone-800">{dt('closestClassic')}</h3>
                {!sim.closest.length && <p className="text-xs text-stone-500">{dt('resembleNone')}</p>}
                {sim.closest.map((c) => (
                  <div key={c.product} className="rounded-2xl border border-stone-200 p-3 space-y-1.5" data-testid="resemble-classic">
                    <div className="flex justify-between text-sm font-bold"><span>{loc(lang, c.name)}</span><span className="text-rose-700">{num(c.score, 0)}%</span></div>
                    <Bar value={c.score} color="#be123c" />
                    {c.missing.length > 0 && <p className="text-[11px] text-stone-600"><b>{dt('missing')}:</b> {c.missing.map((id) => loc(lang, labIngredient(id)?.name)).join(dt('listSep'))}</p>}
                    {c.extra.length > 0 && <p className="text-[11px] text-stone-600"><b>{dt('extraIng')}:</b> {c.extra.map((id) => loc(lang, labIngredient(id)?.name)).join(dt('listSep'))}</p>}
                  </div>
                ))}
                <p className="text-xs text-stone-500">{dt('kind')}: <b>{loc(lang, KIND_LABEL[sim.kind])}</b></p>
              </div>
            )}
            {tab === 'compliance' && (
              <div className="space-y-4">
                <Checks checks={sim.checks} lang={lang} dt={dt} onSwap={() => h.set(fixCosmeticCompliance(d))} />
                {sim.allergens.length > 0 && (
                  <table className="w-full text-xs"><tbody>
                    {sim.allergens.map((a) => <tr key={a.inci} className="border-t border-stone-100"><td className="py-1 font-semibold" dir="ltr">{a.inci}</td><td>{num(a.pct, 4)}%</td><td className={a.label ? 'text-amber-700 font-bold' : 'text-stone-400'}>{dt(a.label ? 'mustLabel' : 'belowLabel')}</td></tr>)}
                  </tbody></table>
                )}
              </div>
            )}
            {tab === 'lab' && (
              <div className="space-y-4">
                <h3 className="text-sm font-black text-stone-800">{dt('labTitle')} — {num(d.batch, 0)} {dt('grams')}</h3>
                {(['A', 'B', 'C'] as const).filter((p) => sim.lines.some((x) => x.phase === p)).map((p) => (
                  <div key={p} className="rounded-2xl border border-stone-200 p-3" data-testid="designer-batch">
                    <p className="text-xs font-black mb-1">{loc(lang, COSMETIC_PHASE_TEXT[p])}</p>
                    <table className="w-full text-xs"><tbody>
                      {sim.lines.filter((x) => x.phase === p).map((x, i) => <tr key={`${x.line.label}-${i}`} className="border-t border-stone-100"><td className="py-1 font-semibold">{nameOf(x.line)}</td><td className="text-[11px] text-stone-500" dir="ltr">{x.ing?.inci || ''}</td><td>{num(x.pct)}%</td><td>{num(x.grams)} {dt('grams')}</td></tr>)}
                    </tbody></table>
                  </div>
                ))}
                <div>
                  <h3 className="text-sm font-black text-stone-800 mb-1">{dt('steps')}</h3>
                  <ol className="list-decimal ps-5 space-y-1 text-xs text-stone-700">{sim.steps.map((s, i) => <li key={i}>{loc(lang, s)}</li>)}</ol>
                </div>
                <div className="flex flex-wrap gap-2">
                  <ToolButton icon={done ? Check : Copy} label={dt(done ? 'copied' : 'copy')} onClick={() => copy(formulaText())} />
                  <ToolButton icon={Printer} label={dt('print')} onClick={() => window.print()} />
                  <ToolButton icon={FlaskConical} label={dt('openCosmetics')} onClick={() => onNavigate('cosmetics')} />
                </div>
              </div>
            )}
          </>
        )}
        {tab === 'journal' && (
          <JournalPanel<CosmeticDesign> kind="cosmetic" lang={lang} dt={dt} num={num} design={d} summary={{ verdict: sim.verdict, score: sim.texture.score }} current={current} setCurrent={setCurrent}
            onLoad={(x, id) => { h.set(x); setCurrent(id); setTab('result'); }} />
        )}
      </section>
    </div>
  );
}
