import React from 'react';

/**
 * «شعار شاهين في المساحة»: a crisp minimal geometric falcon emblem inside a clean circular mark.
 * Breathes gently while Shaheen writes or speaks aloud.
 */
export function ShaheenAvatar({ size = 'md', active = false, speaking = false }: {
  size?: 'sm' | 'md' | 'lg';
  active?: boolean;
  speaking?: boolean;
}) {
  const box = size === 'lg' ? 'h-12 w-12' : size === 'sm' ? 'h-6 w-6' : 'h-8 w-8';
  const icon = size === 'lg' ? 'h-6 w-6' : size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4';
  return (
    <span
      className={`relative inline-grid shrink-0 place-items-center rounded-full border border-[var(--ws-border)] bg-[var(--ws-cta-bg)] text-[var(--ws-cta-ink)] shadow-xs transition-transform ${box} ${speaking ? 'scale-105' : ''}`}
      aria-hidden="true"
    >
      {(active || speaking) && (
        <span
          className={`pointer-events-none absolute -inset-1 rounded-full border motion-safe:animate-ping ${speaking ? 'border-emerald-400/60' : 'border-[var(--ws-muted)]/40'}`}
        />
      )}
      <svg viewBox="0 0 24 24" fill="none" className={icon}>
        <path
          d="M12 2.75L19.4 7.1a1.5 1.5 0 01.74 1.3v7.2a1.5 1.5 0 01-.74 1.3L12 21.25l-7.4-4.35a1.5 1.5 0 01-.74-1.3V8.4c0-.53.28-1.03.74-1.3L12 2.75z"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeOpacity="0.32"
        />
        <path
          d="M5.6 10.2c2.4-.2 4.5.7 6.4 2.4 1.9-1.7 4-2.6 6.4-2.4-1.1 2.2-2.9 3.7-5.2 4.3l1.1 3.1L12 16.3l-2.3 1.3 1.1-3.1c-2.3-.6-4.1-2.1-5.2-4.3z"
          fill="currentColor"
        />
        <path
          d="M12 6.2l1.65 2.45L12 10.1l-1.65-1.45L12 6.2z"
          fill="currentColor"
        />
      </svg>
    </span>
  );
}
