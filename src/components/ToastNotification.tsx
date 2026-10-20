import React from 'react';
import { Check } from 'lucide-react';

/** Short-lived status feedback that stays below the sticky header and never captures pointer input. */
export function ToastNotification({ message }: { message: string | null }) {
  if (!message) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="pointer-events-none fixed left-1/2 z-50 flex w-max max-w-[calc(100vw-1.5rem)] -translate-x-1/2 items-start gap-2 rounded-2xl border border-stone-800 bg-stone-900 px-4 py-3 text-xs font-semibold leading-relaxed text-white shadow-xl animate-in fade-in slide-in-from-top-2"
      style={{ top: 'calc(var(--sham-global-header-height, 5rem) + env(safe-area-inset-top, 0px) + 0.75rem)' }}
    >
      <Check aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
      <span dir="auto" className="min-w-0 break-words">{message}</span>
    </div>
  );
}
