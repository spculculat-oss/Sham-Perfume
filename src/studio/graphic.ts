/**
 * «استوديو شاهين» — graphic design: social posts, stories, covers, thumbnails, posters, business cards and banners,
 * drawn as a clean SVG on the device (no AI, no network): the right size for each platform, six professional layouts,
 * a readable palette from one colour (WCAG contrast), fonts that carry the page's language, and Arabic laid out
 * right-to-left. A picture (drawn by the image engine or uploaded) can be the background, with a shade that keeps the
 * words readable. Pure: the panel does the drawing to PNG and the font embedding for downloads.
 */
import { fontPair, paletteFrom, readableOn, type Harmony, type Palette } from './palette';
import { jsonFrom } from './siteSpec';

export type GraphicFormat = 'post' | 'story' | 'x' | 'yt' | 'fb_cover' | 'banner' | 'poster' | 'card';
export const FORMATS: Record<GraphicFormat, { w: number; h: number }> = {
  post: { w: 1080, h: 1080 },      // Instagram / Facebook post
  story: { w: 1080, h: 1920 },     // Story, Reels, TikTok, Shorts cover
  x: { w: 1200, h: 675 },          // X / LinkedIn post, link preview
  yt: { w: 1280, h: 720 },         // YouTube thumbnail
  fb_cover: { w: 1640, h: 624 },   // Facebook page cover
  banner: { w: 1920, h: 640 },     // website banner
  poster: { w: 1240, h: 1754 },    // A4 poster / flyer (exported at 2×)
  card: { w: 1050, h: 600 },       // business card 3.5×2 in at 300 dpi
};
export const FORMAT_IDS = Object.keys(FORMATS) as GraphicFormat[];

export type GraphicLayout = 'center' | 'split' | 'band' | 'frame' | 'bold' | 'minimal';
export const LAYOUTS: GraphicLayout[] = ['center', 'split', 'band', 'frame', 'bold', 'minimal'];
export type GraphicBg = 'gradient' | 'solid' | 'pattern' | 'image';
export const BACKGROUNDS: GraphicBg[] = ['gradient', 'solid', 'pattern', 'image'];

export interface GraphicSpec {
  format: GraphicFormat; layout: GraphicLayout; bg: GraphicBg;
  base: string; harmony: Harmony; dark: boolean; font: string;
  headline: string; sub: string; cta: string; footer: string;
  /** A data: picture (or https while previewing). */
  image?: string;
  /** What to draw as the background picture (English, for the image engine). */
  imagePrompt?: string;
  decor: boolean;
}

export const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
export const isRtl = (s: string) => /[\u0590-\u08FF]/.test(s);
const isCjk = (s: string) => /[\u3040-\u30FF\u3400-\u9FFF\uAC00-\uD7AF]/.test(s);

/** About how wide one character is, as a share of the font size. */
const glyph = (s: string) => (isCjk(s) ? 1 : isRtl(s) ? 0.5 : 0.56);

/** Words into lines of at most `maxChars` (CJK breaks anywhere); at most `maxLines`, the last one ending with «…». */
export function wrapText(text: string, maxChars: number, maxLines = 4): string[] {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (!clean) return [];
  const limit = Math.max(4, Math.floor(maxChars));
  const units = isCjk(clean) ? [...clean] : clean.split(' ');
  const joiner = isCjk(clean) ? '' : ' ';
  const lines: string[] = [];
  let line = '';
  for (const u of units) {
    const next = line ? `${line}${joiner}${u}` : u;
    if ([...next].length <= limit || !line) line = next;
    else { lines.push(line); line = u; }
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    kept[maxLines - 1] = `${[...kept[maxLines - 1]!].slice(0, Math.max(1, limit - 1)).join('')}…`;
    return kept;
  }
  return lines;
}

/** The biggest font size (down to `min`) at which `text` fits `width` in `maxLines` lines. */
export function fitText(text: string, width: number, start: number, min: number, maxLines: number): { size: number; lines: string[] } {
  for (let size = start; size >= min; size = Math.floor(size * 0.92)) {
    const perLine = width / (size * glyph(text));
    const lines = wrapText(text, perLine, maxLines + 1);
    if (lines.length <= maxLines) return { size, lines };
  }
  return { size: min, lines: wrapText(text, width / (min * glyph(text)), maxLines) };
}

interface TextBlock { text: string; x: number; y: number; width: number; size: number; minSize: number; lines: number; weight: number; color: string; family: string; align: 'start' | 'middle'; rtl: boolean; lineGap?: number }
/** A block of wrapped lines; returns the SVG and where it ends. */
function textBlock(b: TextBlock): { svg: string; bottom: number } {
  if (!b.text.trim()) return { svg: '', bottom: b.y };
  const { size, lines } = fitText(b.text, b.width, b.size, b.minSize, b.lines);
  const gap = size * (b.lineGap ?? 1.22);
  const anchor = b.align === 'middle' ? 'middle' : 'start';
  const x = b.align === 'middle' ? b.x + b.width / 2 : b.rtl ? b.x + b.width : b.x;
  const dir = b.rtl ? ' direction="rtl" unicode-bidi="embed"' : '';
  const tspans = lines.map((l, i) => `<tspan x="${r(x)}" y="${r(b.y + size + i * gap)}">${esc(l)}</tspan>`).join('');
  return {
    svg: `<text font-family="${esc(b.family)}" font-size="${r(size)}" font-weight="${b.weight}" fill="${b.color}" text-anchor="${anchor}"${dir}>${tspans}</text>`,
    bottom: b.y + size + (lines.length - 1) * gap + size * 0.35,
  };
}
const r = (n: number) => Math.round(n * 10) / 10;

function pill(label: string, x: number, y: number, size: number, bg: string, fg: string, family: string, align: 'start' | 'middle', rtl: boolean, maxWidth: number): { svg: string; bottom: number } {
  if (!label.trim()) return { svg: '', bottom: y };
  const text = wrapText(label, maxWidth / (size * glyph(label)) - 2, 1)[0] || '';
  const w = Math.min(maxWidth, [...text].length * size * glyph(text) + size * 2.4);
  const h = size * 2.3;
  const left = align === 'middle' ? x - w / 2 : rtl ? x - w : x;
  return {
    svg: `<rect x="${r(left)}" y="${r(y)}" width="${r(w)}" height="${r(h)}" rx="${r(h / 2)}" fill="${bg}"/><text x="${r(left + w / 2)}" y="${r(y + h / 2 + size * 0.36)}" font-family="${esc(family)}" font-size="${r(size)}" font-weight="800" fill="${fg}" text-anchor="middle"${rtl ? ' direction="rtl"' : ''}>${esc(text)}</text>`,
    bottom: y + h,
  };
}

/** The colours of a design: the palette, plus what the words sit on. */
export function graphicColors(spec: Pick<GraphicSpec, 'base' | 'harmony' | 'dark' | 'bg' | 'layout'>): Palette & { ink: string; inkSoft: string; ctaBg: string; ctaFg: string; onColor: boolean } {
  const p = paletteFrom(spec.base, { harmony: spec.harmony, dark: spec.dark });
  // Words over the colour/picture (white or near-black) or over the page colour (the palette's text).
  const onColor = spec.layout !== 'minimal' && spec.layout !== 'split' && spec.bg !== 'pattern';
  const ink = onColor ? (spec.bg === 'image' ? '#ffffff' : readableOn(p.primary)) : p.text;
  const inkSoft = onColor ? ink : p.muted;
  const ctaBg = onColor ? (ink === '#ffffff' ? '#ffffff' : '#1c1917') : p.primary;
  const ctaFg = onColor ? (ink === '#ffffff' ? p.primary : '#ffffff') : p.onPrimary;
  return { ...p, ink, inkSoft, ctaBg, ctaFg, onColor };
}

/** The design as one SVG document (`fontCss` = an embedded @font-face block for downloads). */
export function graphicSvg(spec: GraphicSpec, { fontCss = '' }: { fontCss?: string } = {}): string {
  const { w: W, h: H } = FORMATS[spec.format] || FORMATS.post;
  const rtl = isRtl(`${spec.headline}${spec.sub}`);
  const pair = fontPair(spec.font, rtl);
  const head = `'${pair.heading}', ${rtl ? "'Noto Sans Arabic', Tahoma" : 'Inter, Arial'}, sans-serif`;
  const body = `'${pair.body}', ${rtl ? "'Noto Sans Arabic', Tahoma" : 'Inter, Arial'}, sans-serif`;
  const c = graphicColors(spec);
  const short = Math.min(W, H);
  const m = short * 0.08;
  const wide = W / H > 1.6;
  const parts: string[] = [];
  const defs: string[] = [];

  // ── background ──
  const fill = (x: number, y: number, w: number, h: number) => {
    if (spec.bg === 'image' && spec.image) {
      parts.push(`<image href="${esc(spec.image)}" x="${r(x)}" y="${r(y)}" width="${r(w)}" height="${r(h)}" preserveAspectRatio="xMidYMid slice"/>`);
      parts.push(`<rect x="${r(x)}" y="${r(y)}" width="${r(w)}" height="${r(h)}" fill="url(#shade)"/>`);
    } else if (spec.bg === 'solid') parts.push(`<rect x="${r(x)}" y="${r(y)}" width="${r(w)}" height="${r(h)}" fill="${c.primary}"/>`);
    else if (spec.bg === 'pattern') {
      parts.push(`<rect x="${r(x)}" y="${r(y)}" width="${r(w)}" height="${r(h)}" fill="${c.bg}"/><rect x="${r(x)}" y="${r(y)}" width="${r(w)}" height="${r(h)}" fill="url(#dots)"/>`);
    } else parts.push(`<rect x="${r(x)}" y="${r(y)}" width="${r(w)}" height="${r(h)}" fill="url(#grad)"/>`);
  };
  defs.push(`<linearGradient id="grad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c.primary}"/><stop offset="1" stop-color="${c.accent}"/></linearGradient>`);
  defs.push(`<linearGradient id="shade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity="0.15"/><stop offset="0.55" stop-color="#000" stop-opacity="0.45"/><stop offset="1" stop-color="#000" stop-opacity="0.78"/></linearGradient>`);
  const dot = short / 40;
  defs.push(`<pattern id="dots" width="${r(dot * 3)}" height="${r(dot * 3)}" patternUnits="userSpaceOnUse"><circle cx="${r(dot)}" cy="${r(dot)}" r="${r(dot * 0.35)}" fill="${c.accent}" fill-opacity="0.35"/></pattern>`);

  // ── layout ──
  const minimalOnImage = spec.layout === 'minimal' && spec.bg === 'image' && Boolean(spec.image);
  let area = { x: m, y: m, w: W - 2 * m, h: H - 2 * m };
  let align: 'start' | 'middle' = 'middle';
  let headScale = 1;
  if (spec.layout === 'split') {
    // Picture/colour on one side, words on the other (the far side for right-to-left).
    const side = wide ? W * 0.44 : W;
    const sideH = wide ? H : H * 0.46;
    const sx = wide ? (rtl ? 0 : W - side) : 0;
    parts.push(`<rect width="${W}" height="${H}" fill="${c.surface}"/>`);
    fill(sx, 0, side, sideH);
    area = wide ? { x: rtl ? side + m : m, y: m, w: W - side - 2 * m, h: H - 2 * m } : { x: m, y: sideH + m * 0.8, w: W - 2 * m, h: H - sideH - 1.8 * m };
    align = 'start';
  } else if (spec.layout === 'minimal') {
    // Minimal on a picture: the picture fills it and the small words sit on its shade.
    if (minimalOnImage) fill(0, 0, W, H); else parts.push(`<rect width="${W}" height="${H}" fill="${c.bg}"/>`);
    parts.push(`<rect x="${r(rtl ? W - m - short * 0.12 : m)}" y="${r(m)}" width="${r(short * 0.12)}" height="${r(short * 0.012)}" fill="${c.accent}"/>`);
    area = { x: m, y: H * (wide ? 0.3 : 0.42), w: W - 2 * m, h: H * (wide ? 0.6 : 0.5) };
    align = 'start';
  } else {
    fill(0, 0, W, H);
    if (spec.layout === 'band') {
      const bandY = H * (wide ? 0.38 : 0.52);
      parts.push(`<rect x="0" y="${r(bandY)}" width="${W}" height="${r(H - bandY)}" fill="${c.surface}" fill-opacity="${spec.dark ? 0.94 : 0.96}"/>`);
      parts.push(`<rect x="0" y="${r(bandY)}" width="${W}" height="${r(short * 0.012)}" fill="${c.accent}"/>`);
      area = { x: m, y: bandY + m * 0.7, w: W - 2 * m, h: H - bandY - 1.6 * m };
      align = 'start';
    } else if (spec.layout === 'frame') {
      const inset = m * 0.55;
      parts.push(`<rect x="${r(inset)}" y="${r(inset)}" width="${r(W - 2 * inset)}" height="${r(H - 2 * inset)}" fill="none" stroke="${c.ink}" stroke-opacity="0.85" stroke-width="${r(short * 0.006)}"/>`);
      area = { x: m * 1.4, y: m * 1.4, w: W - 2.8 * m, h: H - 2.8 * m };
    } else if (spec.layout === 'bold') {
      align = 'start';
      headScale = 1.35;
      area = { x: m, y: m, w: W - 2 * m, h: H - 2 * m };
    } else {
      area = { x: m, y: H * (wide ? 0.2 : 0.3), w: W - 2 * m, h: H * 0.6 };
    }
  }
  // Words on the band / split / minimal sit on the page colour, so they take the palette's text colours.
  const onPage = spec.layout === 'band' || spec.layout === 'split' || (spec.layout === 'minimal' && !minimalOnImage) || spec.bg === 'pattern';
  const ink = onPage ? c.text : c.ink;
  const soft = onPage ? c.muted : c.ink;
  const ctaBg = onPage ? c.primary : c.ctaBg;
  const ctaFg = onPage ? c.onPrimary : c.ctaFg;

  if (spec.decor && spec.layout !== 'minimal') {
    const s = short;
    parts.push(`<circle cx="${r(rtl ? s * 0.06 : W - s * 0.06)}" cy="${r(s * 0.06)}" r="${r(s * 0.2)}" fill="${c.accent}" fill-opacity="0.22"/>`);
    parts.push(`<circle cx="${r(rtl ? W - s * 0.02 : s * 0.02)}" cy="${r(H - s * 0.02)}" r="${r(s * 0.14)}" fill="${onPage ? c.primary : '#ffffff'}" fill-opacity="0.12"/>`);
  }

  // ── words ──
  const unit = short / 1080;
  const headStart = (wide ? 96 : spec.format === 'story' ? 118 : 104) * unit * headScale * (spec.format === 'card' ? 0.8 : 1);
  const h1 = textBlock({ text: spec.headline, x: area.x, y: area.y, width: area.w, size: headStart, minSize: 34 * unit, lines: spec.layout === 'bold' ? 4 : 3, weight: 900, color: ink, family: head, align, rtl, lineGap: 1.12 });
  parts.push(h1.svg);
  let y = h1.bottom + 22 * unit;
  const h2 = textBlock({ text: spec.sub, x: area.x, y, width: area.w * (align === 'middle' ? 0.9 : 1), size: 44 * unit, minSize: 24 * unit, lines: 3, weight: 500, color: soft, family: body, align, rtl, lineGap: 1.35 });
  if (align === 'middle' && h2.svg) parts.push(h2.svg.replace(/x="([\d.]+)"/g, (_m, v) => `x="${r(Number(v) + area.w * 0.05)}"`));
  else parts.push(h2.svg);
  y = (h2.svg ? h2.bottom : y) + 34 * unit;
  const ctaX = align === 'middle' ? area.x + area.w / 2 : rtl ? area.x + area.w : area.x;
  const cta = pill(spec.cta, ctaX, y, 34 * unit, ctaBg, ctaFg, head, align, rtl, area.w);
  parts.push(cta.svg);
  if (spec.footer.trim()) {
    const fs = 28 * unit;
    const fy = H - m * 0.55;
    const fx = align === 'middle' ? W / 2 : rtl ? W - m : m;
    const fInk = spec.layout === 'split' && !wide ? c.muted : onPage ? c.muted : c.ink;
    parts.push(`<text x="${r(fx)}" y="${r(fy)}" font-family="${esc(body)}" font-size="${r(fs)}" font-weight="600" fill="${fInk}" fill-opacity="0.9" text-anchor="${align === 'middle' ? 'middle' : 'start'}"${rtl ? ' direction="rtl"' : ''}>${esc(wrapText(spec.footer, (W - 2 * m) / (fs * glyph(spec.footer)), 1)[0] || '')}</text>`);
  }

  const style = fontCss ? `<style>${fontCss}</style>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">${style}<defs>${defs.join('')}</defs>${parts.join('')}</svg>`;
}

const HARMONY_IDS: Harmony[] = ['complementary', 'analogous', 'triadic', 'split', 'mono'];
const pick = <T extends string>(v: unknown, list: readonly T[], fallback: T): T => (typeof v === 'string' && (list as readonly string[]).includes(v) ? v as T : fallback);
const str = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');
const hex = (v: unknown, fallback: string) => (typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v.trim()) ? v.trim().toLowerCase() : fallback);

/** Anything (the AI's JSON, a saved draft) made into a safe, complete design. */
export function cleanGraphic(raw: unknown, base: Partial<GraphicSpec> = {}): GraphicSpec {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const image = typeof o.image === 'string' && /^(data:image\/(png|jpe?g|webp|gif);base64,|https:\/\/)/i.test(o.image) ? o.image : base.image;
  return {
    format: pick(o.format, FORMAT_IDS, base.format || 'post'),
    layout: pick(o.layout, LAYOUTS, base.layout || 'center'),
    bg: pick(o.bg, BACKGROUNDS, base.bg || 'gradient'),
    base: hex(o.base, base.base || '#8a5a2b'),
    harmony: pick(o.harmony, HARMONY_IDS, base.harmony || 'complementary'),
    dark: typeof o.dark === 'boolean' ? o.dark : Boolean(base.dark),
    font: str(o.font, 20) || base.font || 'cairo',
    headline: str(o.headline, 120) || base.headline || '',
    sub: str(o.sub, 240) || (o.sub === '' ? '' : base.sub || ''),
    cta: str(o.cta, 40) || (o.cta === '' ? '' : base.cta || ''),
    footer: str(o.footer, 90) || (o.footer === '' ? '' : base.footer || ''),
    ...(image ? { image } : {}),
    ...(str(o.imagePrompt, 400) ? { imagePrompt: str(o.imagePrompt, 400) } : base.imagePrompt ? { imagePrompt: base.imagePrompt } : {}),
    decor: typeof o.decor === 'boolean' ? o.decor : base.decor ?? true,
  };
}

/** The AI's reply (JSON with the words and look) → a design, keeping what it did not mention. */
export function graphicFromReply(reply: string, current: GraphicSpec): GraphicSpec | undefined {
  const data = jsonFrom(reply);
  if (!data || typeof data !== 'object') return undefined;
  const next = cleanGraphic(data, current);
  return next.headline ? next : undefined;
}

/** Without the AI: the idea's own words become the design (the first sentence is the headline). */
export function localGraphic(idea: string, current: GraphicSpec): GraphicSpec {
  const text = idea.replace(/\s+/g, ' ').trim();
  const quoted = text.match(/[«"“]([^»"”]{2,80})[»"”]/)?.[1];
  const sentences = text.split(/(?<=[.!؟?،,])\s+|\n/).map((s) => s.trim()).filter(Boolean);
  const headline = quoted || (sentences[0] || text).replace(/^(اعمل|اعملي|صمم|صممي|عايز|عاوز|محتاج|ابغى|أبغى|أريد|اريد|design|make|create)\s+(لي\s+)?/i, '').slice(0, 80);
  const sub = sentences.slice(1, 3).join(' ').slice(0, 200);
  const phone = text.match(/(?:\+?\d[\d\s-]{7,}\d)/)?.[0]?.replace(/\s+/g, ' ');
  const web = text.match(/\b(?:https?:\/\/)?[\w-]+\.(?:com|net|org|eg|sa|ae|io|co)(?:\/\S*)?/i)?.[0];
  const format: GraphicFormat = /ستوري|story|ريلز|reel|تيك|tiktok/i.test(text) ? 'story' : /يوتيوب|youtube|thumbnail/i.test(text) ? 'yt' : /غلاف|cover/i.test(text) ? 'fb_cover' : /بوستر|poster|فلاير|flyer|a4/i.test(text) ? 'poster' : /كارت|بطاقة|business card/i.test(text) ? 'card' : /بانر|banner/i.test(text) ? 'banner' : current.format;
  return cleanGraphic({ ...current, format, headline: headline || current.headline, sub, footer: [phone, web].filter(Boolean).join('  ·  ') || current.footer });
}

/** The prompt that asks the image engine for a background that leaves room for words. */
export const backgroundPrompt = (spec: Pick<GraphicSpec, 'imagePrompt' | 'headline' | 'base' | 'format'>) =>
  `${spec.imagePrompt || `atmospheric background photo that illustrates: ${spec.headline}`}, professional advertising photography, soft depth of field, colour palette around ${spec.base}, plenty of calm empty space for text, no text, no letters, no logos, no watermark, ${FORMATS[spec.format].w >= FORMATS[spec.format].h ? 'wide landscape composition' : 'tall portrait composition'}`;

/** Every Google Fonts file the design uses, embedded so the downloaded PNG/SVG keeps its letters. */
export async function embedFontCss(fontId: string, rtl: boolean, request: typeof fetch = fetch): Promise<string> {
  try {
    const pair = fontPair(fontId, rtl);
    const css = await (await request(pair.css)).text();
    const urls = [...new Set([...css.matchAll(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/g)].map((m) => m[1]!))].slice(0, 12);
    let out = css;
    for (const url of urls) {
      const buf = new Uint8Array(await (await request(url)).arrayBuffer());
      let bin = '';
      for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
      out = out.split(url).join(`data:font/woff2;base64,${btoa(bin)}`);
    }
    return out;
  } catch { return ''; }
}
