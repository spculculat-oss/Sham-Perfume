import React, { useEffect, useLayoutEffect, useReducer, useRef, useState } from 'react';
import { Eye, EyeOff, Move, RotateCcw, X } from 'lucide-react';
import type { SupportedLanguage } from '../types/i18n';
import { isRTL } from '../لغات/localizedContent';
import { makeT } from '../لغات/localize';
import {
  DRAG_THRESHOLD_PX,
  clampOffset,
  getDockStates,
  mountedDocks,
  moveDock,
  placementOf,
  registerDock,
  resetAllDocks,
  setDockHidden,
  showAllDocks,
  subscribeDocks,
  type FloatingDockId,
} from '../utils/floatingDocks';

const S = {
  hide: { ar: 'إخفاء الأيقونة (تقدر ترجعها من الشريط الجانبي)', en: 'Hide this icon (bring it back from the side tab)' },
  drag: { ar: 'اسحب الأيقونة لأي مكان', en: 'Drag the icon anywhere' },
  manager: { ar: 'الأيقونات العائمة', en: 'Floating icons' },
  manager_hint: { ar: 'اسحب أي أيقونة لمكان يريحك، أو اخفيها وارجعها من هنا.', en: 'Drag any icon where it suits you, or hide it and bring it back here.' },
  show: { ar: 'إظهار', en: 'Show' },
  hide_short: { ar: 'إخفاء', en: 'Hide' },
  show_all: { ar: 'إظهار الكل', en: 'Show all' },
  reset: { ar: 'رجّع كل الأيقونات لأماكنها الأصلية', en: 'Put every icon back in its place' },
  close: { ar: 'إغلاق', en: 'Close' },
  moved: { ar: 'متحركة من مكانها', en: 'moved' },
  hidden: { ar: 'مخفية', en: 'hidden' },
  dock_shaheen: { ar: 'شاهين خبير العطور', en: 'Shaheen, the perfume expert' },
  dock_assistant: { ar: 'مساعد شام للخدمات', en: 'Sham services assistant' },
  dock_specialists: { ar: 'مجلس المتخصصين', en: 'Specialists council' },
  dock_messenger: { ar: 'ماسنجر شام', en: 'Sham Messenger' },
  dock_spec_close: { ar: 'زرار قفل ورقة التصنيع', en: 'Spec sheet close button' },
};

const LABEL_KEY: Record<FloatingDockId, keyof typeof S> = {
  shaheen: 'dock_shaheen',
  assistant: 'dock_assistant',
  specialists: 'dock_specialists',
  messenger: 'dock_messenger',
  spec_close: 'dock_spec_close',
};

function useDockStore(): void {
  const [, bump] = useReducer((n: number) => n + 1, 0);
  useEffect(() => subscribeDocks(bump), []);
}

interface FloatingDockProps {
  id: FloatingDockId;
  lang: SupportedLanguage;
  /** The launcher's own position classes (fixed corner, z-index, flex…) — the dock only adds an offset. */
  className: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
}

/**
 * Wraps a floating launcher: drag it (mouse or finger) to move it, tap it to use it as before, and the small
 * eye button hides it. The spot and the hidden state are remembered in this browser.
 */
export function FloatingDock({ id, lang, className, children, style }: FloatingDockProps) {
  useDockStore();
  const L = makeT(lang, S);
  const rtl = isRTL(lang);
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; dx: number; dy: number; pointer: number; moving: boolean; base?: DOMRect } | null>(null);
  const swallowClick = useRef(false);
  const { dx, dy, hidden } = placementOf(id);

  useEffect(() => registerDock(id), [id]);

  // A rotated phone or a smaller window must never leave an icon off screen.
  useLayoutEffect(() => {
    if (hidden) return undefined;
    const fit = () => {
      const el = ref.current;
      if (!el) return;
      const p = placementOf(id);
      if (!p.dx && !p.dy) return;
      const r = el.getBoundingClientRect();
      if (!r.width && !r.height) return;
      const base = { left: r.left - p.dx, top: r.top - p.dy, width: r.width, height: r.height };
      const c = clampOffset(base, p.dx, p.dy, window.innerWidth, window.innerHeight);
      if (c.dx !== p.dx || c.dy !== p.dy) moveDock(id, c.dx, c.dy);
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [id, hidden]);

  if (hidden) return null;

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    if ((e.target as HTMLElement).closest('[data-dock-control]')) return;
    const el = ref.current;
    if (!el) return;
    const d = { x: e.clientX, y: e.clientY, dx, dy, pointer: e.pointerId, moving: false, base: undefined as DOMRect | undefined };
    drag.current = d;

    // Followed on the window, not the icon: a quick finger leaves the icon before the first move event arrives.
    const move = (ev: PointerEvent) => {
      if (ev.pointerId !== d.pointer) return;
      const mx = ev.clientX - d.x;
      const my = ev.clientY - d.y;
      if (!d.moving) {
        if (Math.hypot(mx, my) < DRAG_THRESHOLD_PX) return;
        d.moving = true;
        const r = el.getBoundingClientRect();
        d.base = new DOMRect(r.left - d.dx, r.top - d.dy, r.width, r.height);
        el.dataset.dragging = 'true';
      }
      ev.preventDefault();
      const c = clampOffset(d.base!, d.dx + mx, d.dy + my, window.innerWidth, window.innerHeight);
      // Moved straight on the element while dragging (no re-render of the chat on every pixel); saved on release.
      el.style.transform = `translate3d(${c.dx}px, ${c.dy}px, 0)`;
      el.dataset.dx = String(c.dx);
      el.dataset.dy = String(c.dy);
    };
    const end = (ev: PointerEvent) => {
      if (ev.pointerId !== d.pointer) return;
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
      drag.current = null;
      if (!d.moving) return;
      swallowClick.current = true;
      window.setTimeout(() => { swallowClick.current = false; }, 0);
      delete el.dataset.dragging;
      moveDock(id, Number(el.dataset.dx) || 0, Number(el.dataset.dy) || 0);
    };
    window.addEventListener('pointermove', move, { passive: false });
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
  };

  return (
    <div
      ref={ref}
      data-floating-dock={id}
      className={`${className} group/dock touch-none select-none data-[dragging=true]:cursor-grabbing data-[dragging=true]:opacity-90`}
      style={{ ...style, transform: dx || dy ? `translate3d(${dx}px, ${dy}px, 0)` : undefined }}
      onPointerDown={onPointerDown}
      onClickCapture={(e) => {
        // The release after a drag is not a tap: the chat must not open because the visitor moved it.
        if (swallowClick.current) { e.preventDefault(); e.stopPropagation(); swallowClick.current = false; }
      }}
      title={L('drag')}
    >
      {children}
      <button
        type="button"
        data-dock-control
        onClick={(e) => { e.stopPropagation(); setDockHidden(id, true); }}
        aria-label={L('hide')}
        title={L('hide')}
        className={`absolute -top-2 ${rtl ? '-right-2' : '-left-2'} z-10 flex h-6 w-6 items-center justify-center rounded-full border border-stone-300 bg-white/95 text-stone-600 shadow-md transition hover:bg-stone-900 hover:text-white cursor-pointer pointer-fine:opacity-0 pointer-fine:group-hover/dock:opacity-100 focus-visible:opacity-100`}
      >
        <EyeOff className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

/**
 * The slim side tab that appears only when an icon was hidden or moved: show any hidden icon again, show all,
 * or put every icon back in its original place.
 */
export function FloatingDockManager({ lang }: { lang: SupportedLanguage }) {
  useDockStore();
  const L = makeT(lang, S);
  const rtl = isRTL(lang);
  const [open, setOpen] = useState(false);
  const states = getDockStates();
  const onPage = mountedDocks();
  const hiddenIds = onPage.filter((id) => states[id]?.hidden);
  const movedIds = onPage.filter((id) => states[id] && (states[id]!.dx || states[id]!.dy));
  const listed = onPage.filter((id) => hiddenIds.includes(id) || movedIds.includes(id));

  useEffect(() => { if (!listed.length) setOpen(false); }, [listed.length]);
  if (!listed.length) return null;

  const side = rtl ? 'right-0' : 'left-0';
  return (
    <div className={`fixed top-1/2 ${side} z-[90] -translate-y-1/2 no-print sham-floating`} dir={rtl ? 'rtl' : 'ltr'} data-testid="floating-dock-manager">
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={L('manager')}
          title={L('manager')}
          className={`flex items-center gap-1 bg-stone-900/85 text-amber-200 shadow-lg px-1.5 py-3 cursor-pointer hover:bg-stone-900 ${rtl ? 'rounded-l-xl' : 'rounded-r-xl'}`}
        >
          {hiddenIds.length ? <Eye className="h-4 w-4" /> : <Move className="h-4 w-4" />}
          {hiddenIds.length > 0 && <span className="text-[10px] font-bold">{hiddenIds.length}</span>}
        </button>
      ) : (
        <div className={`w-64 max-w-[85vw] bg-white border border-stone-200 shadow-2xl p-3 ${rtl ? 'rounded-l-2xl' : 'rounded-r-2xl'}`}>
          <div className="flex items-center justify-between gap-2 mb-1">
            <p className="text-sm font-bold text-stone-900">{L('manager')}</p>
            <button type="button" onClick={() => setOpen(false)} aria-label={L('close')} className="rounded-full p-1 text-stone-500 hover:bg-stone-100 cursor-pointer"><X className="h-4 w-4" /></button>
          </div>
          <p className="text-[11px] text-stone-500 mb-2">{L('manager_hint')}</p>
          <ul className="space-y-1.5 mb-2">
            {listed.map((id) => {
              const isHidden = hiddenIds.includes(id);
              return (
                <li key={id} className="flex items-center justify-between gap-2 rounded-lg bg-stone-50 px-2 py-1.5">
                  <span className="min-w-0">
                    <span className="block truncate text-xs font-semibold text-stone-800">{L(LABEL_KEY[id])}</span>
                    <span className="block text-[10px] text-stone-500">{isHidden ? L('hidden') : L('moved')}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setDockHidden(id, !isHidden)}
                    className="shrink-0 inline-flex items-center gap-1 rounded-full bg-stone-900 px-2.5 py-1 text-[11px] font-bold text-white cursor-pointer hover:bg-amber-800"
                  >
                    {isHidden ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                    {isHidden ? L('show') : L('hide_short')}
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="flex flex-col gap-1.5">
            {hiddenIds.length > 1 && (
              <button type="button" onClick={showAllDocks} className="rounded-xl bg-amber-700 px-3 py-1.5 text-xs font-bold text-white cursor-pointer hover:bg-amber-800">{L('show_all')}</button>
            )}
            <button type="button" onClick={() => { resetAllDocks(); setOpen(false); }} className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-stone-300 px-3 py-1.5 text-xs font-semibold text-stone-700 cursor-pointer hover:bg-stone-100">
              <RotateCcw className="h-3.5 w-3.5" />{L('reset')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default FloatingDock;
