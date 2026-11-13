/**
 * «استوديو شاهين»: Shaheen's creation studio inside the workspace — a website builder (pages, design, pictures,
 * editing by words, ZIP to publish anywhere), an imaginative-video maker (storyboard → drawn scenes → camera motion,
 * words and original music → a real video file) and a logo & identity designer. The site being built is kept here so
 * the logo made in one tab can go into the site in another, and «تراجع» works across both.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Clapperboard, Globe, Palette as PaletteIcon } from 'lucide-react';
import type { SupportedLanguage } from '../types/i18n';
import { cleanSiteSpec, type SiteSpec } from './siteSpec';
import { stText, type StudioKey } from './studioStrings';
import { SitePanel } from './SitePanel';
import { VideoPanel } from './VideoPanel';
import { LogoPanel } from './LogoPanel';

type Sub = 'site' | 'video' | 'logo';
const SUBS: Array<{ id: Sub; key: StudioKey; icon: typeof Globe }> = [
  { id: 'site', key: 'st_site', icon: Globe },
  { id: 'video', key: 'st_video', icon: Clapperboard },
  { id: 'logo', key: 'st_logo', icon: PaletteIcon },
];
const DRAFT = 'sham-studio-site-v1';

export interface SiteHistory { spec: SiteSpec | null; past: SiteSpec[]; future: SiteSpec[] }
function loadDraft(): SiteHistory {
  try {
    const raw = localStorage.getItem(DRAFT);
    const spec = raw ? cleanSiteSpec(JSON.parse(raw)) : undefined;
    return { spec: spec || null, past: [], future: [] };
  } catch { return { spec: null, past: [], future: [] }; }
}

export default function StudioPanel({ lang, ai, onOpenCode }: { lang: SupportedLanguage; ai: boolean; onOpenCode: (code: string) => void }) {
  const st = useCallback((k: StudioKey, vars?: Record<string, string | number>) => stText(lang, k, vars), [lang]);
  const [sub, setSub] = useState<Sub>('site');
  const [history, setHistory] = useState<SiteHistory>(loadDraft);

  // Keep the draft (pictures included when they fit; the browser's storage is small).
  useEffect(() => {
    if (!history.spec) { try { localStorage.removeItem(DRAFT); } catch { /* private mode */ } return; }
    const timer = setTimeout(() => {
      try { localStorage.setItem(DRAFT, JSON.stringify(history.spec)); } catch {
        try { localStorage.setItem(DRAFT, JSON.stringify(history.spec, (k, v) => (k === 'src' && typeof v === 'string' && v.startsWith('data:') ? undefined : v))); } catch { /* full */ }
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [history.spec]);

  /** Every change goes through here, so it can be undone (the last 30). */
  const commit = useCallback((next: SiteSpec | null) => setHistory((h) => ({ spec: next, past: h.spec ? [...h.past.slice(-29), h.spec] : h.past, future: [] })), []);
  /** Small live changes (typing in a field) replace the present without a new undo step each letter. */
  const replace = useCallback((next: SiteSpec) => setHistory((h) => ({ ...h, spec: next })), []);
  /** After live typing: the state before it becomes one undo step. */
  const checkpoint = useCallback((before: SiteSpec) => setHistory((h) => (h.spec === before ? h : { ...h, past: [...h.past.slice(-29), before], future: [] })), []);
  const undo = useCallback(() => setHistory((h) => (h.past.length ? { spec: h.past[h.past.length - 1]!, past: h.past.slice(0, -1), future: h.spec ? [h.spec, ...h.future] : h.future } : h)), []);
  const redo = useCallback(() => setHistory((h) => (h.future.length ? { spec: h.future[0]!, past: h.spec ? [...h.past, h.spec] : h.past, future: h.future.slice(1) } : h)), []);

  return (
    <div className="space-y-3" data-testid="studio-panel">
      <p className="text-[13px] leading-relaxed text-stone-600">{st('intro')}</p>
      <div className="flex gap-1.5 overflow-x-auto" role="tablist" aria-label={st('tab')}>
        {SUBS.map(({ id, key, icon: Icon }) => (
          <button key={id} type="button" role="tab" aria-selected={sub === id} onClick={() => setSub(id)} data-testid={`studio-${id}`}
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-[12.5px] font-black cursor-pointer ${sub === id ? 'bg-stone-900 text-white' : 'border border-stone-200 bg-white text-stone-700 hover:border-amber-400'}`}>
            <Icon className="h-4 w-4" />{st(key)}
          </button>
        ))}
      </div>
      {sub === 'site' && <SitePanel lang={lang} st={st} ai={ai} history={history} commit={commit} replace={replace} checkpoint={checkpoint} undo={undo} redo={redo} onOpenCode={onOpenCode} />}
      {sub === 'video' && <VideoPanel lang={lang} st={st} ai={ai} />}
      {sub === 'logo' && <LogoPanel lang={lang} st={st} spec={history.spec} commit={commit} onDone={() => setSub('site')} />}
    </div>
  );
}
export type T = (k: StudioKey, vars?: Record<string, string | number>) => string;
