/**
 * «استوديو شاهين» — colour and type, worked out on the device (no AI, no network): a palette from one colour with
 * colour theory, readable text on every colour (WCAG contrast), and font pairs that suit the page's language.
 */
export interface Palette { primary: string; accent: string; bg: string; surface: string; text: string; muted: string; onPrimary: string; dark: boolean }

const clamp = (n: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, n));
export function normalizeHex(value: string, fallback = '#8a5a2b'): string {
  const v = (value || '').trim().replace(/^#?/, '#').toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(v)) return v;
  if (/^#[0-9a-f]{3}$/.test(v)) return `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}`;
  return fallback;
}
export function hexToHsl(hex: string): [number, number, number] {
  const h = normalizeHex(hex);
  const r = parseInt(h.slice(1, 3), 16) / 255; const g = parseInt(h.slice(3, 5), 16) / 255; const b = parseInt(h.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b); const min = Math.min(r, g, b); const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const hue = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [hue * 60, s, l];
}
export function hslToHex(h: number, s: number, l: number): string {
  const hue = ((h % 360) + 360) % 360; const sat = clamp(s); const lig = clamp(l);
  const c = (1 - Math.abs(2 * lig - 1)) * sat; const x = c * (1 - Math.abs(((hue / 60) % 2) - 1)); const m = lig - c / 2;
  const [r, g, b] = hue < 60 ? [c, x, 0] : hue < 120 ? [x, c, 0] : hue < 180 ? [0, c, x] : hue < 240 ? [0, x, c] : hue < 300 ? [x, 0, c] : [c, 0, x];
  const to = (v: number) => Math.round((v + m) * 255).toString(16).padStart(2, '0');
  return `#${to(r)}${to(g)}${to(b)}`;
}
function luminance(hex: string): number {
  const h = normalizeHex(hex);
  const ch = [1, 3, 5].map((i) => { const v = parseInt(h.slice(i, i + 2), 16) / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * ch[0]! + 0.7152 * ch[1]! + 0.0722 * ch[2]!;
}
/** WCAG contrast ratio (1–21). 4.5 is the minimum for body text, 3 for large headings. */
export function contrast(a: string, b: string): number {
  const x = luminance(a); const y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
/** White or near-black, whichever reads better on this colour. */
export const readableOn = (bg: string) => (contrast(bg, '#ffffff') >= contrast(bg, '#1c1917') ? '#ffffff' : '#1c1917');
/** The same hue made dark or light enough to reach `ratio` against `bg`. */
export function ensureContrast(color: string, bg: string, ratio = 4.5): string {
  let [h, s, l] = hexToHsl(color);
  const darker = luminance(bg) > 0.4;
  for (let i = 0; i < 40 && contrast(hslToHex(h, s, l), bg) < ratio; i += 1) l = clamp(l + (darker ? -0.025 : 0.025));
  return hslToHex(h, s, l);
}

export type Harmony = 'complementary' | 'analogous' | 'triadic' | 'split' | 'mono';
export const HARMONIES: Harmony[] = ['complementary', 'analogous', 'triadic', 'split', 'mono'];
/** A full, readable palette from one colour. */
export function paletteFrom(base: string, { harmony = 'complementary', dark = false }: { harmony?: Harmony; dark?: boolean } = {}): Palette {
  const [h, s, l] = hexToHsl(base);
  const shift = { complementary: 180, analogous: 32, triadic: 120, split: 150, mono: 0 }[harmony];
  const bg = dark ? hslToHex(h, Math.min(s, 0.25), 0.08) : hslToHex(h, Math.min(s, 0.35), 0.975);
  const surface = dark ? hslToHex(h, Math.min(s, 0.22), 0.13) : '#ffffff';
  const primary = ensureContrast(hslToHex(h, Math.max(s, 0.45), dark ? Math.max(l, 0.6) : Math.min(l, 0.42)), bg, 4.5);
  const accentRaw = harmony === 'mono' ? hslToHex(h, Math.max(s - 0.15, 0.3), dark ? 0.75 : 0.32) : hslToHex(h + shift, Math.max(s, 0.5), dark ? 0.65 : 0.45);
  const accent = ensureContrast(accentRaw, bg, 3);
  const text = dark ? hslToHex(h, 0.15, 0.93) : hslToHex(h, 0.2, 0.12);
  const muted = ensureContrast(dark ? hslToHex(h, 0.1, 0.7) : hslToHex(h, 0.1, 0.4), bg, 4.5);
  return { primary, accent, bg, surface, text, muted, onPrimary: readableOn(primary), dark };
}

/** Ready palettes by mood (base colours). */
export const MOODS: Record<string, string> = {
  luxury: '#8a5a2b', ocean: '#0e7490', forest: '#2f6b3a', rose: '#be185d', royal: '#4338ca', sunset: '#c2410c', midnight: '#1e293b', mint: '#0f766e', gold: '#a16207', berry: '#7e22ce',
};

export interface FontPair { id: string; heading: string; body: string; arabic: boolean; css: string }
const gf = (families: string[]) => `https://fonts.googleapis.com/css2?${families.map((f) => `family=${f.replace(/ /g, '+')}:wght@400;600;800`).join('&')}&display=swap`;
/** Font pairs (Google Fonts, free licences). Arabic pages get fonts that have Arabic letters. */
export const FONT_PAIRS: FontPair[] = [
  { id: 'cairo', heading: 'Cairo', body: 'Cairo', arabic: true, css: gf(['Cairo']) },
  { id: 'tajawal', heading: 'Tajawal', body: 'Tajawal', arabic: true, css: gf(['Tajawal']) },
  { id: 'amiri', heading: 'Amiri', body: 'Noto Sans Arabic', arabic: true, css: gf(['Amiri', 'Noto Sans Arabic']) },
  { id: 'reem', heading: 'Reem Kufi', body: 'IBM Plex Sans Arabic', arabic: true, css: gf(['Reem Kufi', 'IBM Plex Sans Arabic']) },
  { id: 'playfair', heading: 'Playfair Display', body: 'Inter', arabic: false, css: gf(['Playfair Display', 'Inter']) },
  { id: 'poppins', heading: 'Poppins', body: 'Inter', arabic: false, css: gf(['Poppins', 'Inter']) },
  { id: 'serif', heading: 'DM Serif Display', body: 'DM Sans', arabic: false, css: gf(['DM Serif Display', 'DM Sans']) },
  { id: 'grotesk', heading: 'Space Grotesk', body: 'Inter', arabic: false, css: gf(['Space Grotesk', 'Inter']) },
];
export const fontPair = (id: string | undefined, rtl: boolean): FontPair =>
  FONT_PAIRS.find((f) => f.id === id && (!rtl || f.arabic)) || FONT_PAIRS.find((f) => f.arabic === rtl)!;
