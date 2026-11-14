import { useEffect, useRef, useState } from 'react';
import { polishReply, revealStep, streamSafe } from '../utils/naturalTalk';

export interface SmoothTextOptions {
  /** Drop a filler opener while the text is arriving (only where the server polishes the final reply the same way). */
  polish?: boolean;
  /** The reply arrived whole a moment ago: write it out once, quickly, instead of dropping it as a block. */
  fresh?: boolean;
}

/**
 * Shows a reply at a steady, readable pace. `text` is everything received so far; while `streaming` the hook
 * returns the part to show now, and it keeps going until the whole text is out after streaming ends.
 * People who asked their device for less motion get the text as it is.
 */
export function useSmoothText(text: string, streaming: boolean, { polish = false, fresh = false }: SmoothTextOptions = {}): string {
  const target = streaming ? streamSafe(polish ? polishReply(text) : text) : text;
  const animate = streaming || fresh;
  const [shown, setShown] = useState(animate ? 0 : target.length);
  const state = useRef({ target, streaming, shown: animate ? 0 : target.length, active: animate, left: 0 });
  state.current.target = target;
  state.current.streaming = streaming;
  if (streaming) state.current.active = true;

  useEffect(() => {
    const s0 = state.current;
    if (!s0.active || typeof window === 'undefined') return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { s0.active = false; s0.shown = s0.target.length; setShown(s0.target.length); return; }
    let frame = 0; let last = performance.now();
    // A whole reply is written out in about its reading-glance time: short ones at once, long ones within two seconds.
    s0.left = Math.min(2, Math.max(0.35, s0.target.length / 500));
    const tick = (now: number) => {
      const s = state.current;
      const dt = Math.min(250, now - last); last = now;
      // The first words wait a moment so a filler opener can be dropped before anyone sees it.
      if (!s.streaming || !polish || s.target.length >= 28) {
        s.left = Math.max(0.12, s.left - dt / 1000);
        const next = revealStep(Math.min(s.shown, s.target.length), s.target, dt, s.streaming ? {} : { done: true, drainSec: s.left });
        if (next !== s.shown) { s.shown = next; setShown(next); }
      }
      if (s.streaming || s.shown < s.target.length) frame = requestAnimationFrame(tick);
      else { s.active = false; setShown(s.target.length); }
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
    // The loop reads the newest text from the ref; it only restarts when streaming starts or stops.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streaming]);

  return state.current.active ? target.slice(0, Math.min(shown, target.length)) : target;
}
