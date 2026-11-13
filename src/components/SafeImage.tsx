import React, { useEffect, useMemo, useState } from 'react';
import { Package } from 'lucide-react';
import { storeImageSrc } from '../utils/liveStore';

/**
 * A product photo that never shows a blank box (#169). It tries each photo the product has, in order; when
 * every one fails (supplier CDN down, hot-link blocked, slow mobile network) it shows a neutral placeholder.
 */
export function photoSources(...lists: (string | undefined | readonly string[])[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of lists.flat()) {
    const src = typeof item === 'string' ? item.trim() : '';
    if (src && !seen.has(src)) { seen.add(src); out.push(src); }
  }
  return out;
}

/** Stock photos fill the frame; product shots sit on white without cropping. */
export const photoFit = (src: string) => (/unsplash\.com/.test(src) ? 'object-cover' : 'object-contain bg-white');

interface SafeImageProps {
  sources: readonly string[];
  alt: string;
  className: string;
  /** Turns a catalog path into a URL (defaults to the store's own resolver); lets the gallery ask for bigger photos. */
  resolve?: (src: string) => string;
  loading?: 'lazy' | 'eager';
  testId?: string;
  placeholderClassName?: string;
  iconClassName?: string;
}

export function SafeImage({ sources, alt, className, resolve = storeImageSrc, loading = 'lazy', testId, placeholderClassName, iconClassName }: SafeImageProps) {
  const key = sources.join('|');
  const list = useMemo(() => photoSources(sources), [key]); // eslint-disable-line react-hooks/exhaustive-deps
  const [index, setIndex] = useState(0);
  useEffect(() => { setIndex(0); }, [key]);
  const src = list[index];
  if (!src) {
    return (
      <div role="img" aria-label={alt} data-testid={testId ? `${testId}-placeholder` : 'photo-placeholder'}
        className={`${className} ${placeholderClassName || 'bg-gradient-to-br from-amber-50 to-stone-100'} flex items-center justify-center`}>
        <Package className={iconClassName || 'w-1/2 h-1/2 max-w-12 max-h-12 text-amber-300/70'} aria-hidden="true" />
      </div>
    );
  }
  return (
    <img
      key={src}
      src={resolve(src)}
      alt={alt}
      loading={loading}
      decoding="async"
      data-testid={testId}
      onError={() => setIndex((i) => i + 1)}
      className={`${className} ${photoFit(src)}`}
    />
  );
}
