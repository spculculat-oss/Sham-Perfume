/**
 * «استوديو شاهين» — the designer's toolbox, worked out on the device (no AI, no network): a full palette with tints
 * and shades, a WCAG contrast checker, gradients, shadows, a type scale and a spacing scale — each exported as CSS
 * variables, a Tailwind theme or JSON, ready to paste into any project.
 */
import { contrast, hexToHsl, hslToHex, normalizeHex, paletteFrom, type Harmony, type Palette } from './palette';

/** Eleven steps from almost white (50) to almost black (950) of one colour — the scale design systems use. */
export const SHADE_STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const;
export function shades(hex: string): Record<(typeof SHADE_STEPS)[number], string> {
  const [h, s] = hexToHsl(normalizeHex(hex));
  const light = [0.97, 0.94, 0.86, 0.76, 0.64, 0.52, 0.43, 0.35, 0.27, 0.2, 0.12];
  const out = {} as Record<(typeof SHADE_STEPS)[number], string>;
  SHADE_STEPS.forEach((step, i) => { out[step] = hslToHex(h, Math.min(1, s * (i < 2 ? 0.9 : 1)), light[i]!); });
  return out;
}

export interface ContrastReport { ratio: number; aa: boolean; aaLarge: boolean; aaa: boolean }
/** How readable `fg` is on `bg`: 4.5 for body text (AA), 3 for big headings, 7 for the best (AAA). */
export function contrastReport(fg: string, bg: string): ContrastReport {
  const ratio = Math.round(contrast(normalizeHex(fg), normalizeHex(bg)) * 100) / 100;
  return { ratio, aa: ratio >= 4.5, aaLarge: ratio >= 3, aaa: ratio >= 7 };
}

export type PaletteExport = 'css' | 'tailwind' | 'json' | 'scss';
/** The palette (with the primary's shades) in the format a project needs. */
export function exportPalette(p: Palette, format: PaletteExport): string {
  const named: Record<string, string> = { primary: p.primary, accent: p.accent, background: p.bg, surface: p.surface, text: p.text, muted: p.muted, 'on-primary': p.onPrimary };
  const scale = shades(p.primary);
  if (format === 'json') return JSON.stringify({ ...named, primaryScale: scale }, null, 2);
  if (format === 'scss') return [...Object.entries(named).map(([k, v]) => `$${k}: ${v};`), ...Object.entries(scale).map(([k, v]) => `$primary-${k}: ${v};`)].join('\n');
  if (format === 'tailwind') {
    const scaleLines = Object.entries(scale).map(([k, v]) => `          ${k}: '${v}',`).join('\n');
    return `// tailwind.config.js  (Tailwind 4: put the same colours under @theme as --color-*)
export default {
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '${p.primary}',
${scaleLines}
        },
        accent: '${p.accent}',
        background: '${p.bg}',
        surface: '${p.surface}',
        ink: '${p.text}',
        muted: '${p.muted}',
      },
    },
  },
};`;
  }
  return `:root {\n${[...Object.entries(named).map(([k, v]) => `  --color-${k}: ${v};`), ...Object.entries(scale).map(([k, v]) => `  --color-primary-${k}: ${v};`)].join('\n')}\n}`;
}

export interface GradientSpec { kind: 'linear' | 'radial' | 'conic'; angle: number; colors: string[] }
/** A CSS gradient (2–5 colours, spread evenly). */
export function gradientCss(g: GradientSpec): string {
  const colors = g.colors.map((c) => normalizeHex(c)).slice(0, 5);
  const list = (colors.length >= 2 ? colors : [colors[0] || '#8a5a2b', '#ffffff']).map((c, i, a) => `${c} ${Math.round((i / (a.length - 1)) * 100)}%`).join(', ');
  const angle = ((Math.round(g.angle) % 360) + 360) % 360;
  if (g.kind === 'radial') return `radial-gradient(circle at center, ${list})`;
  if (g.kind === 'conic') return `conic-gradient(from ${angle}deg, ${list})`;
  return `linear-gradient(${angle}deg, ${list})`;
}
/** Gradients that suit a palette. */
export function gradientIdeas(base: string, harmony: Harmony = 'analogous'): GradientSpec[] {
  const p = paletteFrom(base, { harmony });
  const [h, s] = hexToHsl(p.primary);
  return [
    { kind: 'linear', angle: 135, colors: [p.primary, p.accent] },
    { kind: 'linear', angle: 90, colors: [hslToHex(h, s, 0.25), p.primary, hslToHex(h + 40, Math.max(s, 0.5), 0.6)] },
    { kind: 'radial', angle: 0, colors: [hslToHex(h, s, 0.7), p.primary] },
    { kind: 'linear', angle: 180, colors: [hslToHex(h, 0.3, 0.97), hslToHex(h, 0.4, 0.88)] },
    { kind: 'conic', angle: 0, colors: [p.primary, p.accent, hslToHex(h + 90, 0.6, 0.55), p.primary] },
  ];
}

export interface ShadowSpec { x: number; y: number; blur: number; spread: number; color: string; opacity: number; inset?: boolean }
const rgba = (hex: string, a: number) => {
  const h = normalizeHex(hex);
  return `rgba(${parseInt(h.slice(1, 3), 16)}, ${parseInt(h.slice(3, 5), 16)}, ${parseInt(h.slice(5, 7), 16)}, ${Math.round(Math.min(1, Math.max(0, a)) * 100) / 100})`;
};
export function shadowCss(s: ShadowSpec | ShadowSpec[]): string {
  return (Array.isArray(s) ? s : [s]).map((x) => `${x.inset ? 'inset ' : ''}${Math.round(x.x)}px ${Math.round(x.y)}px ${Math.round(Math.max(0, x.blur))}px ${Math.round(x.spread)}px ${rgba(x.color, x.opacity)}`).join(', ');
}
/** Ready shadows: soft, medium, deep, glow (in the brand colour) and pressed. */
export function shadowPresets(color: string): Record<'soft' | 'medium' | 'deep' | 'glow' | 'inset', ShadowSpec[]> {
  return {
    soft: [{ x: 0, y: 1, blur: 3, spread: 0, color: '#000000', opacity: 0.08 }, { x: 0, y: 1, blur: 2, spread: 0, color: '#000000', opacity: 0.04 }],
    medium: [{ x: 0, y: 10, blur: 25, spread: -5, color: '#000000', opacity: 0.12 }, { x: 0, y: 4, blur: 10, spread: -6, color: '#000000', opacity: 0.08 }],
    deep: [{ x: 0, y: 25, blur: 50, spread: -12, color: '#000000', opacity: 0.3 }],
    glow: [{ x: 0, y: 0, blur: 24, spread: 2, color, opacity: 0.55 }],
    inset: [{ x: 0, y: 2, blur: 6, spread: 0, color: '#000000', opacity: 0.15, inset: true }],
  };
}

/** Classic type-scale ratios. */
export const RATIOS: Record<string, number> = { 'minor-second': 1.067, 'major-second': 1.125, 'minor-third': 1.2, 'major-third': 1.25, 'perfect-fourth': 1.333, 'augmented-fourth': 1.414, 'perfect-fifth': 1.5, golden: 1.618 };
export interface TypeStep { name: string; px: number; rem: number; lineHeight: number }
/** Font sizes from small print to the biggest heading, each `ratio` times the one before. */
export function typeScale(base = 16, ratio = 1.25): TypeStep[] {
  const names = ['xs', 'sm', 'base', 'lg', 'xl', '2xl', '3xl', '4xl', '5xl'];
  const b = Math.min(28, Math.max(10, base));
  const r = Math.min(2, Math.max(1.05, ratio));
  return names.map((name, i) => {
    const px = Math.round(b * r ** (i - 2) * 10) / 10;
    return { name, px, rem: Math.round((px / 16) * 1000) / 1000, lineHeight: px >= 30 ? 1.15 : px >= 20 ? 1.3 : 1.6 };
  });
}
export const typeScaleCss = (steps: TypeStep[]) => `:root {\n${steps.map((s) => `  --text-${s.name}: ${s.rem}rem; /* ${s.px}px */\n  --leading-${s.name}: ${s.lineHeight};`).join('\n')}\n}`;

/** Spacing on a 4/8-point grid. */
export function spacingScale(unit = 4): Array<{ name: string; px: number }> {
  const u = Math.min(12, Math.max(2, Math.round(unit)));
  return [0.5, 1, 1.5, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24].map((m) => ({ name: String(m).replace('.', '_'), px: Math.round(u * m * 2) / 2 }));
}
export const spacingCss = (scale: Array<{ name: string; px: number }>) => `:root {\n${scale.map((s) => `  --space-${s.name}: ${s.px / 16}rem; /* ${s.px}px */`).join('\n')}\n}`;

/** Everything at once — the starter of a design system for one brand colour. */
export function designTokens(base: string, { harmony = 'complementary', dark = false, typeBase = 16, ratio = 1.25, unit = 4 }: { harmony?: Harmony; dark?: boolean; typeBase?: number; ratio?: number; unit?: number } = {}): string {
  const p = paletteFrom(base, { harmony, dark });
  const sh = shadowPresets(p.primary);
  return [
    exportPalette(p, 'css'),
    typeScaleCss(typeScale(typeBase, ratio)),
    spacingCss(spacingScale(unit)),
    `:root {\n  --radius-sm: 6px;\n  --radius-md: 12px;\n  --radius-lg: 20px;\n  --shadow-soft: ${shadowCss(sh.soft)};\n  --shadow-medium: ${shadowCss(sh.medium)};\n  --shadow-deep: ${shadowCss(sh.deep)};\n  --gradient-brand: ${gradientCss({ kind: 'linear', angle: 135, colors: [p.primary, p.accent] })};\n}`,
  ].join('\n\n');
}
