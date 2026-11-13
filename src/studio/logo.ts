/**
 * «استوديو شاهين — الشعار والهوية»: logos drawn as SVG on the device (no AI needed) — a monogram of the name in
 * several shapes and styles, in the brand's colours — and the safety check for an SVG written by an AI platform
 * (no scripts, no event handlers, no outside links), so it can sit inside the site and be downloaded.
 */
import { esc } from './siteRender';
import { paletteFrom, readableOn } from './palette';

export type LogoShape = 'circle' | 'rounded' | 'hexagon' | 'shield' | 'diamond' | 'leaf' | 'arch' | 'wordmark';
export const LOGO_SHAPES: LogoShape[] = ['circle', 'rounded', 'hexagon', 'shield', 'diamond', 'leaf', 'arch', 'wordmark'];

/** The letters of a monogram: «دار العطر» → «دع», «Maison Scent» → «MS», «Nour» → «N». Skips «ال» and «the». */
export function initials(name: string): string {
  const trimmed = name.trim();
  // One short Arabic word reads better whole than as one letter («الريف», «شام»).
  if (/^[\u0600-\u06FF]{2,6}$/.test(trimmed)) return trimmed;
  const words = name.trim().split(/\s+/).filter(Boolean).map((w) => w.replace(/^(?:ال|the$)/i, '') || w).filter((w) => !/^(?:the|of|and|&|و)$/i.test(w));
  const letters = words.slice(0, 2).map((w) => Array.from(w)[0] || '').join('');
  return (letters || Array.from(name.trim())[0] || 'S').toUpperCase();
}

const SHAPES: Record<Exclude<LogoShape, 'wordmark'>, string> = {
  circle: '<circle cx="60" cy="60" r="56"/>',
  rounded: '<rect x="6" y="6" width="108" height="108" rx="28"/>',
  hexagon: '<polygon points="60,4 110,32 110,88 60,116 10,88 10,32"/>',
  shield: '<path d="M60 4 108 20v34c0 32-21 52-48 62C33 106 12 86 12 54V20z"/>',
  diamond: '<polygon points="60,2 118,60 60,118 2,60"/>',
  leaf: '<path d="M8 112C8 50 50 8 112 8c0 62-42 104-104 104z"/>',
  arch: '<path d="M10 116V60a50 50 0 0 1 100 0v56z"/>',
};

/** One logo as SVG text. `variant` 0–3 changes the fill style (solid, outline, gradient, split). */
export function monogramSvg(name: string, { base = '#8a5a2b', shape = 'circle', variant = 0, font = 'Cairo, Tajawal, system-ui, sans-serif' }: { base?: string; shape?: LogoShape; variant?: number; font?: string } = {}): string {
  const p = paletteFrom(base);
  const text = initials(name);
  const id = `g${Math.abs([...name, shape, String(variant)].join('').split('').reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7)).toString(36)}`;
  if (shape === 'wordmark') {
    const width = Math.max(240, Math.min(720, Array.from(name).length * 34 + 60));
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} 120" role="img" aria-label="${esc(name)}"><defs><linearGradient id="${id}" x1="0" x2="1"><stop offset="0" stop-color="${p.primary}"/><stop offset="1" stop-color="${p.accent}"/></linearGradient></defs>`
      + `<text x="50%" y="62%" text-anchor="middle" font-family="${esc(font)}" font-size="58" font-weight="800" fill="${variant % 2 ? `url(#${id})` : p.primary}" letter-spacing="1">${esc(name)}</text>`
      + `<rect x="${width / 2 - 40}" y="96" width="80" height="6" rx="3" fill="${p.accent}"/></svg>`;
  }
  const v = ((variant % 4) + 4) % 4;
  const fill = v === 1 ? 'none' : v === 2 ? `url(#${id})` : p.primary;
  const stroke = v === 1 ? ` stroke="${p.primary}" stroke-width="6"` : '';
  const ink = v === 1 ? p.primary : readableOn(p.primary);
  const split = v === 3 ? `<clipPath id="${id}c">${SHAPES[shape]}</clipPath><g clip-path="url(#${id}c)"><rect x="0" y="60" width="120" height="60" fill="${p.accent}"/></g>` : '';
  const size = text.length > 4 ? 28 : text.length > 3 ? 34 : text.length > 2 ? 40 : text.length > 1 ? 46 : 62;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" role="img" aria-label="${esc(name)}"><defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${p.primary}"/><stop offset="1" stop-color="${p.accent}"/></linearGradient></defs>`
    + `<g fill="${fill}"${stroke}>${SHAPES[shape]}</g>${split}`
    + `<text x="60" y="61" text-anchor="middle" dominant-baseline="central" font-family="${esc(font)}" font-size="${size}" font-weight="800" fill="${ink}">${esc(text)}</text></svg>`;
}

/** Every shape × style for the name: the visitor picks one. */
export function logoChoices(name: string, base: string): { shape: LogoShape; variant: number; svg: string }[] {
  const out: { shape: LogoShape; variant: number; svg: string }[] = [];
  for (const shape of LOGO_SHAPES) for (const variant of shape === 'wordmark' ? [0, 1] : [0, 1, 2, 3]) out.push({ shape, variant, svg: monogramSvg(name, { base, shape, variant }) });
  return out;
}

/**
 * An SVG from outside (an AI platform, a file) made safe to show and embed: only drawing elements and attributes,
 * no script, no foreignObject, no event handlers, no links leaving the file. Returns '' when it is not an SVG.
 */
export function sanitizeSvg(raw: string): string {
  const m = String(raw || '').match(/<svg\b[\s\S]*<\/svg>/i);
  if (!m) return '';
  let svg = m[0].slice(0, 60_000);
  svg = svg.replace(/<!--[\s\S]*?-->/g, '').replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, '')
    .replace(/<(script|foreignObject|iframe|object|embed|audio|video|image|use|a|style|animate|set|animateTransform|animateMotion|handler|listener)\b[\s\S]*?(?:<\/\1\s*>|\/>)/gi, '')
    .replace(/<\/?(script|foreignObject|iframe|object|embed|audio|video|image|use|a|style|animate|set|animateTransform|animateMotion|handler|listener)\b[^>]*>/gi, '')
    .replace(/\s(on[a-z]+|style)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/\s(?:xlink:)?href\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, (attr, value: string) => (/^["']?#/.test(value) ? attr : ''))
    .replace(/(javascript|vbscript|data)\s*:/gi, '')
    .replace(/url\(\s*(['"]?)(?!#)[^)]*\)/gi, 'none');
  if (!/^<svg\b/i.test(svg)) return '';
  if (!/\sxmlns=/.test(svg.slice(0, 300))) svg = svg.replace(/^<svg\b/i, '<svg xmlns="http://www.w3.org/2000/svg"');
  return svg;
}
