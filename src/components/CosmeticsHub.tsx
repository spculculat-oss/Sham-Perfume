import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, BookOpen, Check, CheckCircle2, ChevronDown, Copy, FlaskConical, Leaf, MessageCircle, Printer, Search,
  ShieldCheck, Sparkles, Store, Thermometer, Timer, Droplets, PenLine, Bookmark, X,
} from 'lucide-react';
import { designersText } from '../لغات/designersL10n';
import type { SupportedLanguage } from '../types/i18n';
import { LocalizedNumberInput } from './LocalizedNumberInput';
import { loc } from '../لغات/localize';
import {
  COSMETIC_CONCERN_TEXT, COSMETIC_INGREDIENT_TEXT, COSMETIC_LESSONS, COSMETIC_PHASE_TEXT, COSMETIC_PRODUCT_TEXT, COSMETIC_ROLE_TEXT,
  COSMETIC_SKIN_TEXT, COSMETIC_STEPS, COSMETIC_WARNINGS, cosmeticsText, type CosmeticsUiKey,
} from '../لغات/cosmeticsL10n';
import { COSMETIC_INGREDIENTS, COSMETIC_ROLES, cosmeticIngredient, type CosmeticRole } from '../utils/cosmeticIngredients';
import {
  CONCERNS, COSMETIC_PRODUCTS, SKIN_TYPES, checkCosmeticFormula, cosmeticNumber, cosmeticReply, cosmeticTitle, formulateCosmetic,
  type Concern, type CosmeticProduct, type SkinType,
} from '../utils/cosmeticFormulator';

type View = 'formulator' | 'library' | 'science' | 'store';
const VIEWS: { id: View; key: CosmeticsUiKey; icon: React.ElementType }[] = [
  { id: 'formulator', key: 'tabFormulator', icon: FlaskConical },
  { id: 'library', key: 'tabLibrary', icon: Leaf },
  { id: 'science', key: 'tabScience', icon: BookOpen },
  { id: 'store', key: 'tabStore', icon: Store },
];
const PRODUCT_ICON: Record<CosmeticProduct, string> = {
  face_cream: '🧴', body_lotion: '🫧', gel_serum: '💧', face_oil: '🌿', body_butter: '🧈', lip_balm: '💋', hair_oil: '💆', face_wash: '🫧',
};
const PHASE_STYLE = { A: 'border-sky-200 bg-sky-50/60', B: 'border-amber-200 bg-amber-50/60', C: 'border-emerald-200 bg-emerald-50/60' } as const;

interface Props {
  currentLang: SupportedLanguage;
  onNavigate: (tab: string) => void;
}

/** «قسم مستحضرات التجميل»: the formulator, the ingredient library, the science and the store — at the perfume standard. */
export default function CosmeticsHub({ currentLang, onNavigate }: Props) {
  const lang = currentLang;
  const ct = (k: CosmeticsUiKey) => cosmeticsText(lang, k);
  const [view, setView] = useState<View>('formulator');

  return (
    <div className="space-y-6" data-testid="cosmetics-hub">
      <section className="relative overflow-hidden rounded-3xl border border-rose-200/70 bg-gradient-to-br from-rose-50 via-white to-amber-50 p-6 sm:p-10 shadow-xs">
        <div className="absolute -top-16 -end-16 w-64 h-64 rounded-full bg-rose-200/30 blur-3xl" aria-hidden />
        <div className="relative space-y-4 max-w-3xl">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-700 text-white text-xs font-bold">
            <Sparkles className="w-3.5 h-3.5" /> {ct('badge')}
          </span>
          <h1 className="text-2xl sm:text-4xl font-black text-stone-900 leading-tight">{ct('title')}</h1>
          <p className="text-sm sm:text-base text-stone-600 leading-relaxed">{ct('subtitle')}</p>
          <div className="flex flex-wrap gap-3 pt-1">
            {[
              [COSMETIC_INGREDIENTS.length, 'statIngredients'],
              [COSMETIC_PRODUCTS.length, 'statProducts'],
              [COSMETIC_LESSONS.length, 'statLessons'],
            ].map(([n, k]) => (
              <div key={k as string} className="px-4 py-2 rounded-2xl bg-white/80 border border-rose-100 shadow-2xs">
                <span className="text-xl font-black text-rose-800">{cosmeticNumber(n as number, lang)}</span>
                <span className="ms-1.5 text-xs font-semibold text-stone-600">{ct(k as CosmeticsUiKey)}</span>
              </div>
            ))}
            <button type="button" onClick={() => onNavigate('master_ai')}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-stone-900 hover:bg-stone-800 text-white text-sm font-bold cursor-pointer">
              <MessageCircle className="w-4 h-4" /> {ct('askShaheen')}
            </button>
            <button type="button" onClick={() => onNavigate('cosmetic_designers')} data-testid="cosmetics-designers"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-rose-700 hover:bg-rose-800 text-white text-sm font-bold cursor-pointer">
              <PenLine className="w-4 h-4" /> {designersText(lang, 'hubButton')}
            </button>
          </div>
        </div>
      </section>

      <nav className="flex gap-2 overflow-x-auto pb-1" aria-label={ct('nav')}>
        {VIEWS.map(({ id, key, icon: Icon }) => (
          <button key={id} type="button" onClick={() => setView(id)} aria-pressed={view === id} data-testid={`cosmetics-tab-${id}`}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-bold whitespace-nowrap border transition-all cursor-pointer ${
              view === id ? 'bg-rose-700 text-white border-rose-700 shadow-xs' : 'bg-white text-stone-700 border-stone-200 hover:border-rose-300'}`}>
            <Icon className="w-4 h-4" /> {ct(key)}
          </button>
        ))}
      </nav>

      {view === 'formulator' && <Formulator lang={lang} onNavigate={onNavigate} />}
      {view === 'library' && <Library lang={lang} />}
      {view === 'science' && <Science lang={lang} />}
      {view === 'store' && (
        <section className="text-center py-14 bg-gradient-to-b from-rose-50 to-white rounded-3xl border border-rose-200/70 p-8 space-y-3" data-testid="cosmetics-store-soon">
          <Store className="w-10 h-10 mx-auto text-rose-400" />
          <h2 className="text-lg font-black text-stone-900">{ct('storeTitle')} — {ct('comingSoon')}</h2>
          <p className="text-sm text-stone-600 max-w-xl mx-auto leading-relaxed">{ct('comingSoonText')}</p>
          <button type="button" onClick={() => onNavigate('store?section=cosmetics')}
            className="px-5 py-2.5 rounded-xl bg-rose-700 hover:bg-rose-800 text-white text-sm font-bold cursor-pointer">{ct('openStore')}</button>
        </section>
      )}
    </div>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={on}
      className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
        on ? 'bg-rose-700 text-white border-rose-700' : 'bg-white text-stone-700 border-stone-200 hover:border-rose-300'}`}>
      {children}
    </button>
  );
}

/** One saved formula: only the choices, so it is rebuilt with the current, checked rules when reopened. */
export interface SavedCosmetic { product: CosmeticProduct; skin: SkinType; concerns: Concern[]; batch: number; scent: boolean; nutFree: boolean; vegan: boolean; at: number }
export const COSMETICS_SAVED_KEY = 'sham-cosmetics-saved-v1';
const SAVED_MAX = 20;

/** Reads the saved list from this device; anything broken or unknown is dropped, never trusted. */
export function readSavedCosmetics(raw: string | null): SavedCosmetic[] {
  try {
    const list = JSON.parse(raw || '[]');
    if (!Array.isArray(list)) return [];
    return list.filter((x): x is SavedCosmetic => Boolean(x) && (COSMETIC_PRODUCTS as string[]).includes(x.product) && (SKIN_TYPES as string[]).includes(x.skin)
      && Array.isArray(x.concerns) && x.concerns.every((c: unknown) => (CONCERNS as unknown[]).includes(c)) && Number.isFinite(x.batch))
      .map((x) => ({ ...x, batch: Math.min(2000, Math.max(10, Math.round(x.batch))), concerns: x.concerns.slice(0, 3), scent: Boolean(x.scent), nutFree: Boolean(x.nutFree), vegan: Boolean(x.vegan), at: Number(x.at) || 0 }))
      .slice(0, SAVED_MAX);
  } catch { return []; }
}

/** Adds a formula on top; the same choices saved twice stay one entry. */
export function addSavedCosmetic(list: SavedCosmetic[], item: SavedCosmetic): SavedCosmetic[] {
  const same = (a: SavedCosmetic) => a.product === item.product && a.skin === item.skin && a.batch === item.batch && a.scent === item.scent
    && a.nutFree === item.nutFree && a.vegan === item.vegan && a.concerns.join() === item.concerns.join();
  return [item, ...list.filter((x) => !same(x))].slice(0, SAVED_MAX);
}

function loadSaved(): SavedCosmetic[] {
  try { return readSavedCosmetics(localStorage.getItem(COSMETICS_SAVED_KEY)); } catch { return []; }
}

function Formulator({ lang, onNavigate }: { lang: SupportedLanguage; onNavigate: (tab: string) => void }) {
  const ct = (k: CosmeticsUiKey) => cosmeticsText(lang, k);
  const [product, setProduct] = useState<CosmeticProduct>('face_cream');
  const [skin, setSkin] = useState<SkinType>('normal');
  const [concerns, setConcerns] = useState<Concern[]>(['hydration']);
  const [batch, setBatch] = useState(100);
  const [scent, setScent] = useState(false);
  const [nutFree, setNutFree] = useState(false);
  const [vegan, setVegan] = useState(false);
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState<SavedCosmetic[]>(loadSaved);
  const [justSaved, setJustSaved] = useState(false);
  useEffect(() => { try { localStorage.setItem(COSMETICS_SAVED_KEY, JSON.stringify(saved)); } catch { /* storage blocked */ } }, [saved]);
  const save = () => {
    setSaved((list) => addSavedCosmetic(list, { product, skin, concerns, batch, scent, nutFree, vegan, at: Date.now() }));
    setJustSaved(true); setTimeout(() => setJustSaved(false), 1800);
  };
  const reopen = (x: SavedCosmetic) => { setProduct(x.product); setSkin(x.skin); setConcerns(x.concerns); setBatch(x.batch); setScent(x.scent); setNutFree(x.nutFree); setVegan(x.vegan); };
  const formula = useMemo(() => formulateCosmetic({ product, skin, concerns, batch, scent, nutFree, vegan }), [product, skin, concerns, batch, scent, nutFree, vegan]);
  const problems = useMemo(() => checkCosmeticFormula(formula), [formula]);
  const toggle = (c: Concern) => setConcerns((list) => (list.includes(c) ? list.filter((x) => x !== c) : [...list, c].slice(-3)));
  const copy = async () => {
    try { await navigator.clipboard.writeText(cosmeticReply(formula, lang)); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { /* clipboard blocked */ }
  };

  return (
    <div className="grid lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] gap-6" data-testid="cosmetics-formulator">
      <section className="bg-white rounded-3xl border border-stone-200/80 p-5 shadow-xs space-y-5 h-fit print:hidden">
        <div>
          <h2 className="text-lg font-black text-stone-900">{ct('formTitle')}</h2>
          <p className="text-xs text-stone-500 leading-relaxed mt-1">{ct('formHint')}</p>
        </div>
        <div className="space-y-2">
          <p className="text-xs font-bold text-stone-700">{ct('product')}</p>
          <div className="grid grid-cols-2 gap-2">
            {COSMETIC_PRODUCTS.map((p) => (
              <button key={p} type="button" onClick={() => setProduct(p)} aria-pressed={product === p} data-testid={`cos-product-${p}`}
                className={`text-start p-2.5 rounded-2xl border transition-all cursor-pointer ${
                  product === p ? 'border-rose-500 bg-rose-50 ring-2 ring-rose-200' : 'border-stone-200 hover:border-rose-300'}`}>
                <span className="text-lg" aria-hidden>{PRODUCT_ICON[p]}</span>
                <span className="block text-xs font-bold text-stone-900 leading-snug">{loc(lang, COSMETIC_PRODUCT_TEXT[p]!.name)}</span>
              </button>
            ))}
          </div>
          <p className="text-[11px] text-stone-500">{loc(lang, COSMETIC_PRODUCT_TEXT[product]!.about)}</p>
        </div>
        <div className="space-y-2">
          <p className="text-xs font-bold text-stone-700">{ct('skin')}</p>
          <div className="flex flex-wrap gap-1.5">
            {SKIN_TYPES.map((s) => <Chip key={s} on={skin === s} onClick={() => setSkin(s)}>{loc(lang, COSMETIC_SKIN_TEXT[s]!)}</Chip>)}
          </div>
        </div>
        <div className="space-y-2">
          <p className="text-xs font-bold text-stone-700">{ct('concerns')}</p>
          <div className="flex flex-wrap gap-1.5">
            {CONCERNS.map((c) => <Chip key={c} on={concerns.includes(c)} onClick={() => toggle(c)}>{loc(lang, COSMETIC_CONCERN_TEXT[c]!)}</Chip>)}
          </div>
        </div>
        <label className="block space-y-1.5">
          <span className="text-xs font-bold text-stone-700">{ct('batch')}</span>
          <LocalizedNumberInput lang={lang} integer min={10} max={2000} value={batch} name="cos-batch" ariaLabel={ct('batch')}
            onValue={(n) => setBatch(Math.min(2000, Math.max(10, Math.round(n) || 100)))}
            className="w-full px-3 py-2 rounded-xl border border-stone-200 text-sm font-bold focus:outline-hidden focus:ring-2 focus:ring-rose-200" />
          <span className="flex gap-1.5 pt-1">
            {[50, 100, 250, 500].map((g) => (
              <button key={g} type="button" onClick={() => setBatch(g)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer ${batch === g ? 'bg-rose-100 text-rose-800' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}>
                {cosmeticNumber(g, lang)}
              </button>
            ))}
          </span>
        </label>
        <div className="space-y-2">
          {([[scent, setScent, 'scent'], [nutFree, setNutFree, 'nutFree'], ...(product === 'lip_balm' ? [[vegan, setVegan, 'vegan']] : [])] as [boolean, (v: boolean) => void, CosmeticsUiKey][]).map(([v, set, k]) => (
            <label key={k} className="flex items-center gap-2 text-xs font-semibold text-stone-700 cursor-pointer">
              <input type="checkbox" checked={v} onChange={(e) => set(e.target.checked)} className="accent-rose-700 w-4 h-4" /> {ct(k)}
            </label>
          ))}
        </div>
        {saved.length > 0 && (
          <div className="space-y-2 border-t border-stone-100 pt-4" data-testid="cos-saved">
            <p className="text-xs font-bold text-stone-700">{ct('savedTitle')}</p>
            <div className="flex flex-wrap gap-1.5">
              {saved.map((x) => (
                <span key={x.at} className="inline-flex items-center rounded-xl border border-rose-200 bg-white text-[11px] font-bold text-rose-800">
                  <button type="button" onClick={() => reopen(x)} className="px-2.5 py-1.5 hover:bg-rose-50 rounded-s-xl cursor-pointer">
                    {PRODUCT_ICON[x.product]} {cosmeticTitle(formulateCosmetic(x), lang)}
                  </button>
                  <button type="button" aria-label={ct('savedRemove')} title={ct('savedRemove')} onClick={() => setSaved((list) => list.filter((y) => y.at !== x.at))} className="px-1.5 py-1.5 text-stone-400 hover:text-red-700 cursor-pointer">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="bg-white rounded-3xl border border-stone-200/80 p-5 sm:p-6 shadow-xs space-y-5" data-testid="cosmetics-sheet">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-rose-700">{ct('sheetTitle')}</p>
            <h3 className="text-lg sm:text-xl font-black text-stone-900">{cosmeticTitle(formula, lang)}</h3>
          </div>
          <div className="flex gap-2 print:hidden">
            <button type="button" onClick={copy} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-stone-200 text-xs font-bold hover:bg-stone-50 cursor-pointer">
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />} {ct(copied ? 'copied' : 'copy')}
            </button>
            <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-stone-200 text-xs font-bold hover:bg-stone-50 cursor-pointer">
              <Printer className="w-3.5 h-3.5" /> {ct('print')}
            </button>
            <button type="button" onClick={save} data-testid="cos-save" className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-rose-200 bg-rose-50 text-rose-800 text-xs font-bold hover:bg-rose-100 cursor-pointer">
              {justSaved ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Bookmark className="w-3.5 h-3.5" />} {ct(justSaved ? 'savedOk' : 'save')}
            </button>
          </div>
        </div>

        <p className={`flex items-center gap-2 text-xs font-bold px-3 py-2 rounded-xl ${problems.length ? 'bg-red-50 text-red-800' : 'bg-emerald-50 text-emerald-800'}`} data-testid="cos-check">
          {problems.length ? <AlertTriangle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
          {ct(problems.length ? 'checksBad' : 'checksOk')}
        </p>

        {(['A', 'B', 'C'] as const).map((phase) => {
          const rows = formula.lines.filter((l) => l.phase === phase);
          if (!rows.length) return null;
          return (
            <div key={phase} className={`rounded-2xl border ${PHASE_STYLE[phase]} overflow-hidden`}>
              <p className="px-4 py-2 text-sm font-black text-stone-900">{loc(lang, COSMETIC_PHASE_TEXT[phase])}</p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs bg-white/70">
                  <thead>
                    <tr className="text-stone-500 text-start">
                      <th className="px-3 py-2 text-start font-bold">{ct('colIngredient')}</th>
                      <th className="px-3 py-2 text-start font-bold hidden sm:table-cell">{ct('colInci')}</th>
                      <th className="px-3 py-2 text-start font-bold">{ct('colRole')}</th>
                      <th className="px-3 py-2 text-end font-bold">{ct('colPct')}</th>
                      <th className="px-3 py-2 text-end font-bold">{ct('colGrams')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((l) => {
                      const ing = cosmeticIngredient(l.id);
                      return (
                        <tr key={l.id} className="border-t border-stone-100">
                          <td className="px-3 py-2 font-bold text-stone-900">{loc(lang, COSMETIC_INGREDIENT_TEXT[l.id]!.name)}</td>
                          <td className="px-3 py-2 text-stone-500 hidden sm:table-cell" dir="ltr">{ing.inci}</td>
                          <td className="px-3 py-2 text-stone-600">{loc(lang, COSMETIC_ROLE_TEXT[ing.role]!)}</td>
                          <td className="px-3 py-2 text-end font-bold tabular-nums">{l.qs ? ct('qs') : `${cosmeticNumber(l.pct, lang)}%`}{l.filler && <span className="block text-[10px] font-semibold text-stone-400">{ct('rest')}</span>}</td>
                          <td className="px-3 py-2 text-end tabular-nums">{l.qs ? '—' : cosmeticNumber(l.grams, lang)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
        <div className="flex justify-end text-xs font-black text-stone-900 px-1">
          {ct('total')}: {cosmeticNumber(100, lang)}% · {cosmeticNumber(formula.brief.batch, lang)} {ct('colGrams')}
        </div>

        <div className="grid sm:grid-cols-3 gap-2">
          <Fact icon={Thermometer} label={ct('heat')} value={formula.heatC ? `${cosmeticNumber(formula.heatC[0], lang)}–${cosmeticNumber(formula.heatC[1], lang)} °C` : ct('noHeat')} />
          <Fact icon={Droplets} label={ct('phTarget')} value={formula.ph ? `${cosmeticNumber(formula.ph[0], lang)}–${cosmeticNumber(formula.ph[1], lang)}` : '—'} />
          <Fact icon={Timer} label={ct('shelf')} value={`${cosmeticNumber(formula.shelfMonths[0], lang)}–${cosmeticNumber(formula.shelfMonths[1], lang)} ${ct('months')}`} />
        </div>

        <div className="space-y-2">
          <h4 className="text-sm font-black text-stone-900">{ct('steps')}</h4>
          <ol className="space-y-1.5">
            {COSMETIC_STEPS[formula.method]!.map((s, i) => (
              <li key={i} className="flex gap-2.5 text-sm text-stone-700 leading-relaxed">
                <span className="shrink-0 w-6 h-6 rounded-full bg-rose-100 text-rose-800 text-xs font-black flex items-center justify-center">{cosmeticNumber(i + 1, lang)}</span>
                <span>{loc(lang, s)}</span>
              </li>
            ))}
          </ol>
        </div>

        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 space-y-2" data-testid="cos-warnings">
          <h4 className="flex items-center gap-2 text-sm font-black text-amber-950"><ShieldCheck className="w-4 h-4" /> {ct('safety')}</h4>
          <ul className="space-y-1.5">
            {formula.warnings.map((w) => (
              <li key={w} className="flex gap-2 text-xs text-amber-950 leading-relaxed"><AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {loc(lang, COSMETIC_WARNINGS[w]!)}</li>
            ))}
          </ul>
        </div>
        <p className="text-[11px] text-stone-500 italic">{ct('trial')}</p>
        <button type="button" onClick={() => onNavigate('master_ai')} className="print:hidden inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold cursor-pointer">
          <MessageCircle className="w-4 h-4" /> {ct('askShaheen')}
        </button>
      </section>
    </div>
  );
}

function Fact({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2.5 p-3 rounded-2xl bg-stone-50 border border-stone-200/70">
      <Icon className="w-4 h-4 text-rose-700 shrink-0" />
      <div>
        <p className="text-[10px] font-bold text-stone-500">{label}</p>
        <p className="text-sm font-black text-stone-900">{value}</p>
      </div>
    </div>
  );
}

function Library({ lang }: { lang: SupportedLanguage }) {
  const ct = (k: CosmeticsUiKey) => cosmeticsText(lang, k);
  const [q, setQ] = useState('');
  const [role, setRole] = useState<CosmeticRole | 'all'>('all');
  const list = COSMETIC_INGREDIENTS.filter((x) => {
    if (role !== 'all' && x.role !== role) return false;
    const words = q.trim().toLowerCase();
    if (!words) return true;
    const text = COSMETIC_INGREDIENT_TEXT[x.id]!;
    return [x.inci, x.id, loc(lang, text.name), text.name.ar, text.name.en].join(' ').toLowerCase().includes(words);
  });
  return (
    <section className="space-y-4" data-testid="cosmetics-library">
      <div className="bg-white rounded-3xl border border-stone-200/80 p-5 shadow-xs space-y-3">
        <h2 className="text-lg font-black text-stone-900">{ct('libraryTitle')}</h2>
        <p className="text-xs text-stone-500">{ct('libraryHint')}</p>
        <div className="relative">
          <Search className="w-4 h-4 text-stone-400 absolute top-1/2 -translate-y-1/2 start-3" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={ct('search')}
            className="w-full ps-9 pe-3 py-2.5 rounded-xl border border-stone-200 text-sm focus:outline-hidden focus:ring-2 focus:ring-rose-200" />
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          <Chip on={role === 'all'} onClick={() => setRole('all')}>{ct('allRoles')}</Chip>
          {COSMETIC_ROLES.filter((r) => COSMETIC_INGREDIENTS.some((x) => x.role === r)).map((r) => (
            <Chip key={r} on={role === r} onClick={() => setRole(r)}>{loc(lang, COSMETIC_ROLE_TEXT[r]!)}</Chip>
          ))}
        </div>
      </div>
      {list.length ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {list.map((x) => {
            const text = COSMETIC_INGREDIENT_TEXT[x.id]!;
            return (
              <article key={x.id} className="bg-white rounded-2xl border border-stone-200/80 p-4 shadow-2xs space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-black text-stone-900">{loc(lang, text.name)}</h3>
                    <p className="text-[11px] text-stone-500" dir="ltr">{x.inci}</p>
                  </div>
                  <span className="shrink-0 px-2 py-0.5 rounded-lg bg-rose-50 text-rose-800 text-[10px] font-bold">{loc(lang, COSMETIC_ROLE_TEXT[x.role]!)}</span>
                </div>
                <p className="text-xs text-stone-700 leading-relaxed">{loc(lang, text.does)}</p>
                <div className="flex flex-wrap gap-1.5 text-[10px] font-bold">
                  <span className="px-2 py-0.5 rounded-md bg-stone-100 text-stone-700">{ct('typical')}: {cosmeticNumber(x.typical[0], lang)}–{cosmeticNumber(x.typical[1], lang)}%</span>
                  <span className="px-2 py-0.5 rounded-md bg-stone-100 text-stone-700">{ct('maxLevel')}: {cosmeticNumber(x.max, lang)}%</span>
                  {x.faceMax !== undefined && <span className="px-2 py-0.5 rounded-md bg-stone-100 text-stone-700">{ct('faceMax')}: {cosmeticNumber(x.faceMax, lang)}%</span>}
                  <span className="px-2 py-0.5 rounded-md bg-stone-100 text-stone-700">{ct('phaseLabel')}: {loc(lang, COSMETIC_PHASE_TEXT[x.heatSensitive ? 'C' : x.phase])}</span>
                </div>
                <div className="flex flex-wrap gap-1.5 text-[10px] font-bold">
                  {x.sensitiser && <span className="px-2 py-0.5 rounded-md bg-red-50 text-red-800">{ct('flagSensitiser')}</span>}
                  {x.nut && <span className="px-2 py-0.5 rounded-md bg-orange-50 text-orange-800">{ct('flagNut')}</span>}
                  {x.comedogenic && <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-800">{ct('flagComedogenic')}</span>}
                  {x.heatSensitive && <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800">{ct('flagHeat')}</span>}
                </div>
                <p className="text-[11px] text-stone-600 leading-relaxed border-t border-stone-100 pt-2 flex gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 shrink-0 text-amber-700 mt-0.5" /> {loc(lang, text.note)}
                </p>
              </article>
            );
          })}
        </div>
      ) : (
        <p className="text-center text-sm font-bold text-stone-500 py-10">{ct('noMatch')}</p>
      )}
    </section>
  );
}

function Science({ lang }: { lang: SupportedLanguage }) {
  const ct = (k: CosmeticsUiKey) => cosmeticsText(lang, k);
  const [open, setOpen] = useState<string | null>(COSMETIC_LESSONS[0]?.id ?? null);
  return (
    <section className="space-y-4" data-testid="cosmetics-science">
      <div className="bg-white rounded-3xl border border-stone-200/80 p-5 shadow-xs">
        <h2 className="text-lg font-black text-stone-900">{ct('scienceTitle')}</h2>
        <p className="text-xs text-stone-500 mt-1">{ct('scienceHint')}</p>
        <p className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-50 text-rose-800 text-[11px] font-bold">
          <BookOpen className="w-3.5 h-3.5" /> {ct('expert')}
        </p>
      </div>
      <div className="space-y-2">
        {COSMETIC_LESSONS.map((l, i) => (
          <article key={l.id} className="bg-white rounded-2xl border border-stone-200/80 shadow-2xs overflow-hidden">
            <button type="button" onClick={() => setOpen(open === l.id ? null : l.id)} aria-expanded={open === l.id}
              className="w-full flex items-center justify-between gap-3 p-4 text-start cursor-pointer hover:bg-stone-50">
              <span className="flex items-center gap-3">
                <span className="shrink-0 w-7 h-7 rounded-full bg-rose-100 text-rose-800 text-xs font-black flex items-center justify-center">{cosmeticNumber(i + 1, lang)}</span>
                <span>
                  <span className="block text-sm font-black text-stone-900">{loc(lang, l.title)}</span>
                  <span className="block text-xs text-stone-500">{loc(lang, l.question)}</span>
                </span>
              </span>
              <ChevronDown className={`w-4 h-4 shrink-0 text-stone-400 transition-transform ${open === l.id ? 'rotate-180' : ''}`} />
            </button>
            {open === l.id && <p className="px-4 pb-4 text-sm text-stone-700 leading-loose">{loc(lang, l.answer)}</p>}
          </article>
        ))}
      </div>
    </section>
  );
}
