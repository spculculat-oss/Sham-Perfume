import { useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';

const GUTTER = 8;
const clamp = (n: number, available: number) => Math.max(GUTTER, Math.min(n, available - GUTTER));
interface Point { left: number; top: number }

export function useFloatingCalculator(minimized: boolean) {
  const windowRef = useRef<HTMLElement>(null);
  const restoreRef = useRef<HTMLButtonElement>(null);
  const drag = useRef<(Point & { pointer: number; x: number; y: number }) | null>(null);
  const [position, setPosition] = useState<Point | undefined>();
  const [dragging, setDragging] = useState(false);
  const contain = (left: number, top: number, el: HTMLElement) => ({
    left: clamp(left, window.innerWidth - el.offsetWidth), top: clamp(top, window.innerHeight - el.offsetHeight),
  });

  useLayoutEffect(() => {
    if (minimized) { restoreRef.current?.focus({ preventScroll: true }); return; }
    // Focus the window, not the expression: don't pop a phone's software keyboard on open.
    windowRef.current?.focus({ preventScroll: true });
  }, [minimized]);

  useLayoutEffect(() => {
    if (minimized || !windowRef.current) return;
    const el = windowRef.current;
    const keepVisible = () => setPosition((current) => {
      if (!current) return current;
      const next = contain(current.left, current.top, el);
      return next.top === current.top && next.left === current.left ? current : next;
    });
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(keepVisible) : undefined;
    observer?.observe(el);
    window.addEventListener('resize', keepVisible);
    keepVisible();
    return () => { observer?.disconnect(); window.removeEventListener('resize', keepVisible); };
  }, [minimized]);

  const pointerDown = (event: PointerEvent<HTMLElement>) => {
    const button = (event.target as Element).closest('button');
    const el = windowRef.current;
    if (event.button !== 0 || !event.isPrimary || (button && !button.hasAttribute('data-cw-grip')) || !el) return;
    const rect = el.getBoundingClientRect();
    drag.current = { left: rect.left, top: rect.top, pointer: event.pointerId, x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const pointerMove = (event: PointerEvent<HTMLElement>) => {
    const from = drag.current;
    if (!from || event.pointerId !== from.pointer || !windowRef.current) return;
    const dx = event.clientX - from.x;
    const dy = event.clientY - from.y;
    if (!dragging && Math.abs(dx) + Math.abs(dy) < 3) return;
    setDragging(true);
    setPosition(contain(from.left + dx, from.top + dy, windowRef.current));
  };
  const pointerEnd = (event: PointerEvent<HTMLElement>) => {
    if (drag.current?.pointer !== event.pointerId) return;
    drag.current = null;
    setDragging(false);
  };
  const reset = () => setPosition(undefined);
  const gripKey = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'Home') { event.preventDefault(); event.stopPropagation(); reset(); return; }
    const delta = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] }[event.key];
    const el = windowRef.current;
    if (!delta || !el) return;
    event.preventDefault();
    event.stopPropagation();
    const { left, top } = el.getBoundingClientRect();
    const step = event.shiftKey ? 48 : 16;
    setPosition(contain(left + delta[0] * step, top + delta[1] * step, el));
  };
  return { windowRef, restoreRef, position, dragging, pointerDown, pointerMove, pointerEnd, reset, gripKey };
}
