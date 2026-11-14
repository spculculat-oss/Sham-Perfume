/**
 * «مرسم شاهين» — light, atmosphere and the imaginative vocabulary (stage two of the painter).
 *
 * Graphics: light shafts from the sun, haze between the layers, aurora, the milky way, shooting stars,
 * shaded planets with rings, faceted snow peaks, glowing motes and a dark foreground that frames the scene.
 * Imagination: pyramids, a castle, hot-air balloons, a lighthouse, floating islands, a waterfall, crystals,
 * butterflies, a great tree, a horse, a dragon and a whale. Pure string builders: no state, no network.
 */
export interface Stage {
  W: number; H: number; r: () => number; time: 'night' | 'sunset' | 'dawn' | 'day';
  tone: { sky: string[]; land: string; light: string; ink: string }; accent: string; second: string; horizon: number;
}

const n = (value: number) => String(Math.round(value * 10) / 10);
const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const mix = (a: string, b: string, t: number) => `#${rgb(a).map((c, i) => Math.round(c + (rgb(b)[i] - c) * t).toString(16).padStart(2, '0')).join('')}`;
const pts = (list: number[][]) => `M${list.map(([x, y]) => `${n(x)} ${n(y)}`).join('L')}Z`;
const horizonGlow = (c: Stage) => c.tone.sky[c.tone.sky.length - 1];

// ── Light and atmosphere ──────────────────────────────────────────────────────────────────────────────────
export function rays(c: Stage, x: number, y: number): string {
  const reach = Math.hypot(c.W, c.H);
  // Each shaft is cut to the canvas by hand: a bounded shape blurs the same in every renderer.
  let out = `<g filter="url(#blur-m)" style="mix-blend-mode:screen" opacity="${c.time === 'day' ? 0.2 : c.time === 'night' ? 0.14 : 0.4}">`;
  const inside = ([px, py]: number[]) => [Math.max(0, Math.min(c.W, px)), Math.max(0, Math.min(c.H, py))];
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + c.r() * 0.4, spread = 0.025 + c.r() * 0.06, steps = 6;
    const edge = (angle: number) => Array.from({ length: steps }, (_, k) => inside([x + Math.cos(angle) * reach * ((k + 1) / steps), y + Math.sin(angle) * reach * ((k + 1) / steps)]));
    out += `<path d="${pts([inside([x, y]), ...edge(a - spread), ...edge(a + spread).reverse()])}" fill="${c.tone.light}" opacity="${n(0.25 + c.r() * 0.5)}"/>`;
  }
  return `${out}</g>`;
}
export function haze(c: Stage, y: number, height: number, colour: string, opacity: number): string {
  return `<rect x="-80" y="${n(y - height / 2)}" width="${c.W + 160}" height="${n(height)}" fill="${colour}" opacity="${n(opacity)}" filter="url(#blur-l)"/>`;
}
export function aurora(c: Stage): string {
  const hues = ['#3dffb0', '#35d6ff', '#a56bff'];
  let out = `<defs>${hues.map((h, i) => `<linearGradient id="au${i}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${h}" stop-opacity="0"/><stop offset="0.78" stop-color="${h}" stop-opacity="0.85"/><stop offset="1" stop-color="${h}" stop-opacity="0"/></linearGradient>`).join('')}</defs><g filter="url(#blur-s)" style="mix-blend-mode:screen" opacity="0.8">`;
  for (let b = 0; b < 3; b++) {
    const p = c.r() * 6, baseY = c.H * (0.2 + b * 0.07), step = c.W / 70;
    for (let i = 0; i < 70; i++) {
      const t = i / 70, bottom = baseY + Math.sin(t * 5 + p) * c.H * 0.05 + Math.sin(t * 13 + p) * c.H * 0.015, h = c.H * (0.17 + 0.08 * Math.sin(t * 9 + p * 2));
      out += `<rect x="${n(i * step)}" y="${n(bottom - h)}" width="${n(step + 2)}" height="${n(h)}" fill="url(#au${b})"/>`;
    }
  }
  return `${out}</g>`;
}
export function milkyWay(c: Stage): string {
  const cx = c.W / 2, cy = c.H * 0.28;
  let out = `<g transform="rotate(-28 ${n(cx)} ${n(cy)})"><ellipse cx="${n(cx)}" cy="${n(cy)}" rx="${n(c.W * 0.8)}" ry="${n(c.H * 0.1)}" fill="#aebcff" opacity="0.2" filter="url(#blur-l)"/><ellipse cx="${n(cx)}" cy="${n(cy)}" rx="${n(c.W * 0.5)}" ry="${n(c.H * 0.045)}" fill="#ffe6cf" opacity="0.2" filter="url(#blur-l)"/>`;
  for (let i = 0; i < 300; i++) out += `<circle cx="${n(cx + (c.r() - 0.5) * c.W * 1.5)}" cy="${n(cy + (c.r() + c.r() + c.r() - 1.5) * c.H * 0.1)}" r="${n(0.4 + c.r() * 1.3)}" fill="#fff" opacity="${n(0.3 + c.r() * 0.6)}"/>`;
  return `${out}<ellipse cx="${n(cx)}" cy="${n(cy)}" rx="${n(c.W * 0.45)}" ry="${n(c.H * 0.012)}" fill="#04050d" opacity="0.4" filter="url(#blur-s)"/></g>`;
}
export function shootingStar(c: Stage): string {
  const x = c.W * (0.3 + c.r() * 0.6), y = c.H * (0.08 + c.r() * 0.2), len = c.W * (0.1 + c.r() * 0.08);
  return `<path d="${pts([[x, y - 2.2], [x + len, y - len * 0.42], [x, y + 2.2]])}" fill="#fff" opacity="0.75"/><circle cx="${n(x)}" cy="${n(y)}" r="9" fill="#fff" opacity="0.5" filter="url(#blur-s)"/><circle cx="${n(x)}" cy="${n(y)}" r="3" fill="#fff"/>`;
}
export function planet(c: Stage, x: number, y: number, radius: number, colour: string, ring: boolean, id: string, craters = false): string {
  const tilt = `rotate(-18 ${n(x)} ${n(y)})`, ringTone = mix(colour, '#ffffff', 0.6), a = radius * 1.95, b = radius * 0.44, sw = n(radius * 0.17);
  let out = `<defs><radialGradient id="pl${id}" cx="0.33" cy="0.3" r="0.85"><stop offset="0" stop-color="${mix(colour, '#ffffff', 0.6)}"/><stop offset="0.5" stop-color="${colour}"/><stop offset="1" stop-color="${mix(colour, '#000000', 0.8)}"/></radialGradient><clipPath id="pc${id}"><circle cx="${n(x)}" cy="${n(y)}" r="${n(radius)}"/></clipPath></defs>`;
  out += `<circle cx="${n(x)}" cy="${n(y)}" r="${n(radius * 1.45)}" fill="${colour}" opacity="0.22" filter="url(#blur-l)"/>`;
  if (ring) out += `<ellipse cx="${n(x)}" cy="${n(y)}" rx="${n(a)}" ry="${n(b)}" fill="none" stroke="${ringTone}" stroke-width="${sw}" opacity="0.55" transform="${tilt}"/>`;
  out += `<circle cx="${n(x)}" cy="${n(y)}" r="${n(radius)}" fill="url(#pl${id})"/><g clip-path="url(#pc${id})">`;
  if (craters) for (let i = 0; i < 9; i++) { const s = radius * (0.06 + c.r() * 0.12); out += `<circle cx="${n(x + (c.r() - 0.5) * radius * 1.5)}" cy="${n(y + (c.r() - 0.5) * radius * 1.5)}" r="${n(s)}" fill="${mix(colour, '#000000', 0.22)}" opacity="0.5"/>`; }
  else for (let i = 0; i < 5; i++) out += `<ellipse cx="${n(x)}" cy="${n(y + (i - 2) * radius * 0.36 + (c.r() - 0.5) * radius * 0.1)}" rx="${n(radius * 1.2)}" ry="${n(radius * (0.04 + c.r() * 0.07))}" fill="${i % 2 ? mix(colour, '#000000', 0.35) : mix(colour, '#ffffff', 0.35)}" opacity="0.4" transform="${tilt}"/>`;
  out += '</g>';
  if (ring) out += `<path d="M${n(x - a)} ${n(y)}A${n(a)} ${n(b)} 0 0 0 ${n(x + a)} ${n(y)}" fill="none" stroke="${ringTone}" stroke-width="${sw}" opacity="0.9" transform="${tilt}"/>`;
  return out;
}
export function motes(c: Stage, count: number, colour: string, top: number, bottom: number): string {
  let out = '<g style="mix-blend-mode:screen">';
  for (let i = 0; i < count; i++) {
    const x = c.r() * c.W, y = top + c.r() * (bottom - top), s = 1.2 + c.r() * c.r() * 5;
    out += `<circle cx="${n(x)}" cy="${n(y)}" r="${n(s * 3.2)}" fill="${colour}" opacity="${n(0.08 + c.r() * 0.12)}"/><circle cx="${n(x)}" cy="${n(y)}" r="${n(s)}" fill="${mix(colour, '#ffffff', 0.6)}" opacity="${n(0.55 + c.r() * 0.45)}"/>`;
  }
  return `${out}</g>`;
}
export function foreground(c: Stage, fill: string): string {
  let out = `<path d="M0 ${c.H}V${n(c.H * 0.93)}Q${n(c.W * 0.16)} ${n(c.H * 0.9)} ${n(c.W * 0.34)} ${n(c.H * 0.985)}T${n(c.W * 0.7)} ${n(c.H * 0.975)}Q${n(c.W * 0.88)} ${n(c.H * 0.91)} ${c.W} ${n(c.H * 0.94)}V${c.H}Z" fill="${fill}"/>`;
  for (let i = 0; i < 110; i++) {
    const x = c.r() * c.W, edge = Math.abs(x / c.W - 0.5) * 2, h = c.H * (0.02 + c.r() * 0.05 + edge * 0.05), lean = (c.r() - 0.5) * h * 0.9, base = c.H * (1 - 0.02 - edge * 0.03);
    out += `<path d="M${n(x - 3)} ${n(base + 20)}Q${n(x + lean * 0.3)} ${n(base - h * 0.6)} ${n(x + lean)} ${n(base - h)}Q${n(x + lean * 0.5 + 3)} ${n(base - h * 0.5)} ${n(x + 4)} ${n(base + 20)}Z" fill="${fill}"/>`;
  }
  return out;
}
export function peaks(c: Stage, base: number, height: number, fill: string, lit: string, snow: string | undefined, count: number, litLeft: boolean): string {
  let out = '';
  for (let i = 0; i < count; i++) {
    const cx = c.W * ((i + 0.5) / count + (c.r() - 0.5) * 0.14), h = height * (0.6 + c.r() * 0.5), w = h * (0.85 + c.r() * 0.5), top = base - h, d = litLeft ? 1 : -1;
    out += `<path d="${pts([[cx - w, base], [cx, top], [cx + w, base]])}" fill="${lit}"/>`;
    if (snow) out += `<path d="${pts([[cx, top], [cx + w * 0.3, base - h * 0.7], [cx + w * 0.15, base - h * 0.64], [cx + w * 0.07, base - h * 0.75], [cx - w * 0.05, base - h * 0.62], [cx - w * 0.17, base - h * 0.74], [cx - w * 0.3, base - h * 0.7]])}" fill="${snow}"/>`;
    out += `<path d="${pts([[cx, top], [cx + d * w, base], [cx + d * w * 0.1, base], [cx + d * w * 0.16, base - h * 0.42], [cx - d * w * 0.03, base - h * 0.6]])}" fill="${fill}" opacity="0.72"/>`;
  }
  return `${out}<rect y="${n(base - 1)}" width="${c.W}" height="${n(c.H - base + 1)}" fill="${mix(lit, fill, 0.6)}"/>`;
}

// ── Imaginative vocabulary ────────────────────────────────────────────────────────────────────────────────
export function pyramids(c: Stage, x: number, base: number, h: number): string {
  const sand = c.time === 'night' ? '#3a4474' : c.time === 'day' ? '#e2b566' : '#e08a45';
  const lit = mix(sand, c.tone.light, 0.25), dark = mix(sand, c.tone.ink, 0.6);
  let out = '';
  for (const [dx, k] of [[-0.95, 0.5], [0.85, 0.68], [0, 1]]) {
    const px = x + dx * h, ph = h * k, hw = ph * 0.8, by = base - (1 - k) * h * 0.04;
    out += `<path d="${pts([[px - hw, by], [px, by - ph], [px + hw * 0.3, by]])}" fill="${lit}"/><path d="${pts([[px + hw * 0.3, by], [px, by - ph], [px + hw, by]])}" fill="${dark}"/>`;
    for (let i = 1; i < 7; i++) out += `<path d="M${n(px - hw * (1 - i / 7))} ${n(by - ph * (i / 7))}L${n(px + hw * 0.3 * (1 - i / 7))} ${n(by - ph * (i / 7))}" stroke="${dark}" stroke-width="1.2" opacity="0.25"/>`;
  }
  return out;
}
export function castle(c: Stage, x: number, base: number, h: number, fill: string): string {
  const w = h * 1.1, glow = '#ffd98a', lit = c.time !== 'day';
  const tower = (tx: number, tw: number, th: number) => {
    let t = `<rect x="${n(tx - tw / 2)}" y="${n(base - th)}" width="${n(tw)}" height="${n(th)}" fill="${fill}"/><path d="${pts([[tx - tw * 0.72, base - th], [tx, base - th - tw * 1.7], [tx + tw * 0.72, base - th]])}" fill="${fill}"/><path d="M${n(tx)} ${n(base - th - tw * 1.7)}v${n(-tw * 0.7)}l${n(tw * 0.6)} ${n(tw * 0.2)}l${n(-tw * 0.6)} ${n(tw * 0.2)}" fill="${c.accent}" stroke="${fill}" stroke-width="2"/>`;
    if (lit) for (let k = 1; k <= 3; k++) t += `<rect x="${n(tx - tw * 0.12)}" y="${n(base - th + (th * k) / 4.5)}" width="${n(tw * 0.24)}" height="${n(tw * 0.42)}" rx="${n(tw * 0.12)}" fill="${glow}"/>`;
    return t;
  };
  let out = `<path d="M${n(x - w * 0.95)} ${n(base + h * 0.06)}Q${n(x)} ${n(base - h * 0.16)} ${n(x + w * 0.95)} ${n(base + h * 0.06)}Z" fill="${fill}"/>`;
  out += tower(x - w * 0.34, w * 0.13, h * 0.62) + tower(x + w * 0.34, w * 0.13, h * 0.58) + tower(x - w * 0.14, w * 0.1, h * 0.74) + tower(x + w * 0.12, w * 0.16, h * 0.84);
  out += `<rect x="${n(x - w * 0.34)}" y="${n(base - h * 0.4)}" width="${n(w * 0.68)}" height="${n(h * 0.42)}" fill="${fill}"/>`;
  for (let i = 0; i < 9; i++) out += `<rect x="${n(x - w * 0.34 + (i * w * 0.68) / 8.4)}" y="${n(base - h * 0.44)}" width="${n(w * 0.04)}" height="${n(h * 0.05)}" fill="${fill}"/>`;
  if (lit) out += `<path d="M${n(x - w * 0.05)} ${n(base)}v${n(-h * 0.16)}a${n(w * 0.05)} ${n(w * 0.06)} 0 0 1 ${n(w * 0.1)} 0v${n(h * 0.16)}Z" fill="${glow}"/><circle cx="${n(x)}" cy="${n(base - h * 0.1)}" r="${n(h * 0.3)}" fill="${glow}" opacity="0.2" filter="url(#blur-l)"/>`;
  return out;
}
export function balloon(c: Stage, x: number, y: number, size: number, a: string, b: string, id: string): string {
  const s = size / 170, env = 'M0-100C60-100 82-40 60 0C45 30 20 50 14 62H-14C-20 50-45 30-60 0C-82-40-60-100 0-100Z';
  return `<g transform="translate(${n(x)} ${n(y)}) scale(${n(s)})"><defs><clipPath id="bn${id}"><path d="${env}"/></clipPath><linearGradient id="bs${id}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0.35"/><stop offset="0.45" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.4"/></linearGradient></defs>`
    + `<g clip-path="url(#bn${id})"><rect x="-90" y="-110" width="180" height="180" fill="${a}"/><ellipse cx="0" cy="-20" rx="56" ry="92" fill="${b}"/><ellipse cx="0" cy="-20" rx="33" ry="92" fill="${a}"/><ellipse cx="0" cy="-20" rx="11" ry="92" fill="${b}"/><rect x="-90" y="-110" width="180" height="180" fill="url(#bs${id})"/></g>`
    + `<path d="M-14 62L-10 78M14 62L10 78" stroke="#3b2a1c" stroke-width="2"/><rect x="-12" y="76" width="24" height="18" rx="3" fill="#6b4a2c"/><rect x="-12" y="76" width="24" height="5" fill="#8a6238"/></g>`;
}
export function lighthouse(c: Stage, x: number, base: number, h: number, dir: number): string {
  const hw = (t: number) => h * (0.095 - 0.045 * t), wall = c.time === 'night' ? '#b9bdd0' : '#f3efe6', lampY = base - h * 0.84, glow = '#ffe9a8';
  const band = (t1: number, t2: number) => `<path d="${pts([[x - hw(t1), base - h * t1], [x - hw(t2), base - h * t2], [x + hw(t2), base - h * t2], [x + hw(t1), base - h * t1]])}" fill="${c.accent}"/>`;
  let out = `<path d="M${n(x - h * 0.42)} ${n(base + h * 0.05)}Q${n(x - h * 0.2)} ${n(base - h * 0.1)} ${n(x)} ${n(base - h * 0.04)}T${n(x + h * 0.42)} ${n(base + h * 0.05)}Z" fill="${c.tone.ink}"/>`;
  if (c.time !== 'day') out += `<g style="mix-blend-mode:screen" filter="url(#blur-s)"><path d="${pts([[x, lampY], [x + dir * c.W * 0.7, lampY - h * 0.2], [x + dir * c.W * 0.7, lampY + h * 0.1]])}" fill="${glow}" opacity="0.32"/></g><circle cx="${n(x)}" cy="${n(lampY)}" r="${n(h * 0.22)}" fill="${glow}" opacity="0.4" filter="url(#blur-l)"/>`;
  out += `<path d="${pts([[x - hw(0), base - h * 0.02], [x - hw(0.78), base - h * 0.78], [x + hw(0.78), base - h * 0.78], [x + hw(0), base - h * 0.02]])}" fill="${wall}"/>${band(0.14, 0.3)}${band(0.46, 0.62)}`;
  out += `<path d="${pts([[x, base - h * 0.02], [x + hw(0), base - h * 0.02], [x + hw(0.78), base - h * 0.78], [x + hw(0.78) * 0.2, base - h * 0.78]])}" fill="#000" opacity="0.22"/>`;
  out += `<rect x="${n(x - h * 0.075)}" y="${n(base - h * 0.795)}" width="${n(h * 0.15)}" height="${n(h * 0.02)}" fill="${c.tone.ink}"/><rect x="${n(x - h * 0.04)}" y="${n(base - h * 0.89)}" width="${n(h * 0.08)}" height="${n(h * 0.095)}" fill="${glow}"/><path d="${pts([[x - h * 0.06, base - h * 0.89], [x, base - h * 0.97], [x + h * 0.06, base - h * 0.89]])}" fill="${c.tone.ink}"/>`;
  return out;
}
export function island(c: Stage, x: number, y: number, w: number, depth: number, fall: boolean): string {
  const far = horizonGlow(c), night = c.time === 'night';
  const grass = mix(night ? '#1f4a34' : '#58a55c', far, depth), rock = mix(night ? '#2a2f52' : '#7a6656', far, depth), shade = mix(rock, c.tone.ink, 0.5), tree = mix(night ? '#143524' : '#2f6b3a', far, depth);
  let out = `<path d="${pts([[x - w, y], [x - w * 0.7, y + w * 0.25], [x - w * 0.45, y + w * 0.3], [x - w * 0.3, y + w * 0.62], [x - w * 0.1, y + w * 0.5], [x + w * 0.05, y + w * 0.95], [x + w * 0.25, y + w * 0.5], [x + w * 0.5, y + w * 0.42], [x + w * 0.7, y + w * 0.18], [x + w, y]])}" fill="${rock}"/>`;
  out += `<path d="${pts([[x + w * 0.05, y], [x + w * 0.05, y + w * 0.95], [x + w * 0.25, y + w * 0.5], [x + w * 0.5, y + w * 0.42], [x + w * 0.7, y + w * 0.18], [x + w, y]])}" fill="${shade}" opacity="0.6"/>`;
  if (fall) out += `<rect x="${n(x - w * 0.52)}" y="${n(y)}" width="${n(w * 0.1)}" height="${n(w * 1.5)}" fill="url(#fall)"/><ellipse cx="${n(x - w * 0.47)}" cy="${n(y + w * 1.5)}" rx="${n(w * 0.3)}" ry="${n(w * 0.12)}" fill="#fff" opacity="0.4" filter="url(#blur-m)"/>`;
  out += `<path d="M${n(x - w * 1.04)} ${n(y + w * 0.03)}Q${n(x - w * 0.5)} ${n(y - w * 0.16)} ${n(x)} ${n(y - w * 0.1)}Q${n(x + w * 0.6)} ${n(y - w * 0.18)} ${n(x + w * 1.04)} ${n(y + w * 0.03)}Q${n(x)} ${n(y + w * 0.12)} ${n(x - w * 1.04)} ${n(y + w * 0.03)}Z" fill="${grass}"/>`;
  for (let i = 0; i < 4; i++) {
    const tx = x + (i - 1.5) * w * 0.38 + (c.r() - 0.5) * w * 0.1, th = w * (0.28 + c.r() * 0.22), ty = y - w * 0.07;
    out += `<path d="${pts([[tx, ty - th], [tx + th * 0.26, ty - th * 0.4], [tx + th * 0.14, ty - th * 0.4], [tx + th * 0.34, ty], [tx - th * 0.34, ty], [tx - th * 0.14, ty - th * 0.4], [tx - th * 0.26, ty - th * 0.4]])}" fill="${tree}"/>`;
  }
  return out;
}
export const FALL_DEF = '<defs><linearGradient id="fall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0.95"/><stop offset="0.7" stop-color="#dff3ff" stop-opacity="0.6"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient></defs>';
export function waterfall(c: Stage, x: number, top: number, h: number, w: number, cliff: string): string {
  let out = `<path d="${pts([[x - w * 3.2, top + h * 0.02], [x - w * 1.2, top - h * 0.06], [x + w * 1.6, top - h * 0.03], [x + w * 3.4, top + h * 0.05], [x + w * 4.2, top + h * 1.05], [x - w * 4, top + h * 1.05]])}" fill="${cliff}"/>`;
  out += `<path d="${pts([[x + w * 0.6, top - h * 0.04], [x + w * 3.4, top + h * 0.05], [x + w * 4.2, top + h * 1.05], [x + w * 0.9, top + h * 1.05]])}" fill="${c.tone.ink}" opacity="0.35"/>`;
  out += `<rect x="${n(x - w / 2)}" y="${n(top - h * 0.03)}" width="${n(w)}" height="${n(h * 1.06)}" fill="#eaf7ff" opacity="0.92"/>`;
  for (let i = 0; i < 7; i++) out += `<path d="M${n(x - w / 2 + (w * (i + 0.5)) / 7)} ${n(top + c.r() * h * 0.2)}v${n(h * (0.4 + c.r() * 0.5))}" stroke="#9cc9e6" stroke-width="${n(Math.max(1, w * 0.04))}" opacity="0.6"/>`;
  return `${out}<ellipse cx="${n(x)}" cy="${n(top + h * 1.03)}" rx="${n(w * 2.6)}" ry="${n(h * 0.14)}" fill="#fff" opacity="0.75" filter="url(#blur-m)"/>`;
}
export function crystals(c: Stage, x: number, base: number, h: number, colour: string): string {
  let out = `<ellipse cx="${n(x)}" cy="${n(base - h * 0.45)}" rx="${n(h * 0.7)}" ry="${n(h * 0.7)}" fill="${colour}" opacity="0.35" filter="url(#blur-l)"/>`;
  for (const [dx, k, tilt] of [[-0.34, 0.55, -0.16], [0.36, 0.62, 0.18], [-0.14, 0.8, -0.05], [0.16, 0.72, 0.08], [0, 1, 0]]) {
    const bx = x + dx * h, sh = h * k, sw = sh * 0.26, t = tilt * sh, tone = mix(colour, '#ffffff', 0.15 + c.r() * 0.2);
    out += `<path d="${pts([[bx - sw / 2, base], [bx - sw / 2 + t * 0.8, base - sh * 0.8], [bx + t, base - sh], [bx + sw / 2 + t * 0.8, base - sh * 0.78], [bx + sw / 2, base]])}" fill="${tone}"/>`;
    out += `<path d="${pts([[bx - sw / 2, base], [bx - sw / 2 + t * 0.8, base - sh * 0.8], [bx + t, base - sh], [bx, base]])}" fill="#fff" opacity="0.38"/><path d="${pts([[bx, base], [bx + t, base - sh], [bx + sw / 2 + t * 0.8, base - sh * 0.78], [bx + sw / 2, base]])}" fill="${mix(colour, '#000000', 0.5)}" opacity="0.4"/>`;
  }
  return out;
}
export function butterflies(c: Stage, count: number, a: string, b: string, top: number, bottom: number): string {
  let out = '';
  for (let i = 0; i < count; i++) {
    const x = c.W * (0.08 + c.r() * 0.84), y = top + c.r() * (bottom - top), s = (0.9 + c.r() * 1.6) * (c.H / 900), col = i % 2 ? a : b;
    out += `<g transform="translate(${n(x)} ${n(y)}) rotate(${n(-30 + c.r() * 60)}) scale(${n(s)})"><ellipse cx="-9" cy="-6" rx="9" ry="12" fill="${col}" transform="rotate(-28 -9 -6)"/><ellipse cx="9" cy="-6" rx="9" ry="12" fill="${col}" transform="rotate(28 9 -6)"/><ellipse cx="-7" cy="8" rx="6" ry="8" fill="${mix(col, '#ffffff', 0.3)}" transform="rotate(20 -7 8)"/><ellipse cx="7" cy="8" rx="6" ry="8" fill="${mix(col, '#ffffff', 0.3)}" transform="rotate(-20 7 8)"/><path d="M0-12V14" stroke="#1c1420" stroke-width="2.4" stroke-linecap="round"/></g>`;
  }
  return out;
}
export function tree(c: Stage, x: number, base: number, h: number, trunk: string, leaf: string): string {
  const p = (dx: number, dy: number) => `${n(x + dx * h)} ${n(base - dy * h)}`;
  let out = `<path d="M${p(-0.06, 0)}C${p(-0.03, 0.3)} ${p(-0.06, 0.4)} ${p(-0.2, 0.56)}L${p(-0.15, 0.6)}C${p(-0.05, 0.48)} ${p(-0.01, 0.44)} ${p(0, 0.56)}C${p(0.02, 0.44)} ${p(0.08, 0.48)} ${p(0.18, 0.62)}L${p(0.22, 0.58)}C${p(0.09, 0.4)} ${p(0.04, 0.3)} ${p(0.07, 0)}Z" fill="${trunk}"/>`;
  for (let i = 0; i < 22; i++) {
    const a = c.r() * Math.PI * 2, d = Math.sqrt(c.r()), cx = x + Math.cos(a) * d * h * 0.36, cy = base - h * 0.74 + Math.sin(a) * d * h * 0.2, rad = h * (0.1 + c.r() * 0.08);
    out += `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(rad)}" fill="${mix(leaf, cy < base - h * 0.76 ? c.tone.light : c.tone.ink, 0.1 + c.r() * 0.25)}"/>`;
  }
  return out;
}
export function horse(x: number, base: number, h: number, fill: string, flip: boolean): string {
  const s = h / 215;
  return `<g transform="translate(${n(x)} ${n(base)}) scale(${n(flip ? -s : s)} ${n(s)})" fill="${fill}"><ellipse cx="-10" cy="-112" rx="62" ry="30"/><ellipse cx="-52" cy="-116" rx="30" ry="32"/><ellipse cx="38" cy="-114" rx="28" ry="32"/>`
    + '<path d="M26-128C38-164 56-186 78-198L98-176C82-160 72-136 64-98Z"/><path d="M72-198C86-208 102-202 110-186L128-158C130-149 121-145 114-150L92-168L80-174Z"/><path d="M79-200L83-218L92-201Z"/>'
    + '<path d="M30-136C30-168 50-194 76-204C62-186 52-166 50-138Z"/><path d="M40-98L80-64L106-54L110-45L97-42L70-50L28-84Z"/><path d="M30-92L54-50L52-8L62 0L44 0L40-44L16-84Z"/>'
    + '<path d="M-62-98L-86-56L-72-10L-60 0L-78 0L-100-52L-82-106Z"/><path d="M-46-92L-28-54L-52-14L-42-2L-58-4L-68-16L-46-52L-66-88Z"/><path d="M-74-132C-112-144-138-110-126-58C-118-90-104-108-74-112Z"/></g>';
}
export function dragon(c: Stage, x: number, y: number, size: number, fill: string, fire: boolean): string {
  const s = size / 300;
  let out = `<g transform="translate(${n(x)} ${n(y)}) scale(${n(s)})">`;
  if (fire) out += '<g style="mix-blend-mode:screen"><path d="M150-54Q200-70 262-40Q214-40 204-10Q190-34 150-46Z" fill="#ff7a1a" filter="url(#blur-s)"/><path d="M150-54Q190-62 232-44Q200-42 190-24Q178-40 150-48Z" fill="#ffe08a"/></g>';
  out += `<g fill="${fill}"><path d="M-120 20C-80-30-30 30 20-10C50-34 70-50 96-56" fill="none" stroke="${fill}" stroke-width="26" stroke-linecap="round"/><path d="M-116 22C-150 52-172 30-196 52" fill="none" stroke="${fill}" stroke-width="11" stroke-linecap="round"/><path d="M-196 52L-222 44L-206 70Z"/>`
    + '<path d="M84-74L132-70L154-56L130-44L92-40Z"/><path d="M100-70L82-98L110-74Z"/><path d="M114-70L104-94L124-72Z"/><path d="M-20 4L-30 44L-14 40L-4 8Z"/><path d="M34-12L40 26L54 20L50-16Z"/>'
    + `<path d="M0-4L-48-128L-12-104L28-168L44-108L104-146L78-82L118-88L52-12Z"/></g><circle cx="126" cy="-60" r="3.4" fill="${fire ? '#ffd27a' : c.tone.light}"/></g>`;
  return out;
}
export function whale(c: Stage, x: number, y: number, size: number, fill: string): string {
  const s = size / 300, belly = mix(fill, c.tone.light, 0.45);
  return `<g transform="translate(${n(x)} ${n(y)}) scale(${n(s)})"><path d="M-130 0C-108-56 20-66 92-22C112-10 126-8 138-30L152-56L158-16L180 6L144 6C120 24 60 44-20 40C-84 38-124 22-130 0Z" fill="${fill}"/><path d="M-128 6C-90 30-20 40 60 26C10 46-90 44-128 6Z" fill="${belly}" opacity="0.8"/><path d="M-24 34L-50 82L12 42Z" fill="${fill}"/><circle cx="-92" cy="-6" r="4" fill="${c.tone.light}"/><path d="M-60-44q-6-30-22-36M-56-44q6-28 24-32" stroke="${c.tone.light}" stroke-width="4" fill="none" opacity="0.7" stroke-linecap="round"/></g>`;
}
