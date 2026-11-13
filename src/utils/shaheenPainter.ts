/**
 * «مرسم شاهين» — Shaheen's own painter: a picture drawn by rules, with no AI engine, no key and no network.
 *
 * It reads the same idea «خيال شاهين» reads (src/utils/imageCraft.ts) and composes a vector scene from a
 * vocabulary it really knows: skies at four times of day, space with stars and nebulae, mountains, dunes,
 * sea, forest, city, garden, a studio surface — and subjects: a perfume bottle, roses, a falcon, a cat, a
 * camel, palms, a lantern, a mosque, a boat, a standing figure — in the weather and colours the idea names.
 *
 * It is an illustrator, not a photographic generator, and it says so: `missing` names a main subject that
 * is not in its vocabulary yet (the picture then shows the place and the mood only), and the school bench
 * (scripts/shaheen-imagination) lists those gaps as the next lessons. Pure: the same idea and seed always
 * give the same SVG; the browser turns it into a PNG (src/workspace/paint.ts).
 */
import { craftImagePrompt, detectLettering, type ImageAspect, type ImageStyleId } from './imageCraft';

export type PaintTime = 'night' | 'sunset' | 'dawn' | 'day';
export type PaintSetting = 'space' | 'desert' | 'sea' | 'mountains' | 'forest' | 'city' | 'garden' | 'studio' | 'abstract';
export type PaintSubject = 'bottle' | 'rose' | 'falcon' | 'cat' | 'camel' | 'palm' | 'lantern' | 'mosque' | 'boat' | 'figure';
export type PaintLook = 'flat' | 'watercolor' | 'sketch' | 'oil' | 'cinematic' | 'cartoon';

export interface Painting {
  svg: string; width: number; height: number;
  time: PaintTime; setting: PaintSetting; subjects: PaintSubject[]; look: PaintLook;
  /** A main subject the idea asks for that the painter cannot draw yet (English noun, for the report). */
  missing?: string;
}

export const PAINT_SIZES: Record<ImageAspect, [number, number]> = { '1:1': [1024, 1024], '3:4': [960, 1280], '4:3': [1280, 960], '9:16': [864, 1536], '16:9': [1536, 864] };

const fold = (value: string) => value.normalize('NFKC').replace(/[\u064B-\u065F\u0670\u0640]/g, '').replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').toLowerCase();

// ── Vocabulary: what the words ask for ────────────────────────────────────────────────────────────────────
const SETTINGS: [PaintSetting, RegExp][] = [
  ['space', /فضا|مجر|نجوم|كوكب|سديم|كوني|\bspace\b|\bgalax|\bnebula|\bcosmic\b|\bstars?\b|\bplanets?\b|\bastronaut/],
  ['desert', /صحرا|كثبان|رمال|\bdesert\b|\bdunes?\b|\bsand\b|\boasis\b|واحه/],
  ['sea', /بحر|محيط|شاط|امواج|بحيره|نهر|\bsea\b|\bocean\b|\bbeach\b|\bwaves?\b|\blake\b|\briver\b|\bshore\b/],
  ['mountains', /جبل|جبال|وادي|\bmountains?\b|\bpeaks?\b|\bvalley\b|\bhills?\b/],
  ['forest', /غابه|غابات|اشجار|\bforest\b|\bwoods\b|\bpines?\b|\btrees\b/],
  ['city', /مدينه|ابراج|ناطحات|شارع|\bcity\b|\bskyline\b|\bbuildings\b|\bstreet\b|\btown\b/],
  ['garden', /حديقه|بستان|مرج|حقل|\bgarden\b|\bmeadow\b|\bfield\b/],
  ['studio', /رخام|طاوله|ترابيزه|خشب|حرير|مخمل|استوديو|\bmarble\b|\btable\b|\bstudio\b|\bwood(?:en)?\b|\bsilk\b|\bvelvet\b|\bpedestal\b/],
];
const SUBJECTS: [PaintSubject, RegExp][] = [
  ['bottle', /عطر|عطور|زجاجه|قاروره|فلاكون|\bperfume\b|\bbottle\b|\bflacon\b|\bfragrance\b|\bcologne\b/],
  ['rose', /ورد|زهر|زهور|ياسمين|\broses?\b|\bflowers?\b|\bjasmine\b|\bblossoms?\b|\bpetals\b/],
  ['falcon', /صقر|شاهين|نسر|طائر|طير|عصفور|\bfalcon\b|\beagle\b|\bhawk\b|\bbirds?\b/],
  ['cat', /قطه|قط |قطط|\bcats?\b|\bkitten\b/],
  ['camel', /جمل|جمال |ناقه|ابل|\bcamels?\b/],
  ['palm', /نخل|نخيل|\bpalms?\b/],
  ['lantern', /فانوس|قنديل|مصباح|\blanterns?\b|\blamp\b/],
  ['mosque', /مسجد|جامع|مئذنه|قبه|\bmosque\b|\bminaret\b|\bdome\b/],
  ['boat', /مركب|قارب|سفينه|شراع|\bboat\b|\bship\b|\bsail(?:boat)?\b/],
  ['figure', /رجل|راجل|امراه|بنت|ولد|شخص|فارس|مسافر|رحاله|\bman\b|\bwoman\b|\bgirl\b|\bboy\b|\bperson\b|\bfigure\b|\btraveler\b|\btraveller\b|\bknight\b/],
];
/** Often asked for, not drawable yet — named honestly instead of drawn badly. */
const BEYOND: [string, RegExp][] = [
  ['dragon', /تنين|\bdragon\b/], ['horse', /حصان|خيل|\bhorses?\b/], ['dog', /كلب|\bdogs?\b/], ['lion', /اسد|\blion\b/],
  ['car', /سياره|عربيه|\bcars?\b/], ['food', /اكل|طبق|كيك|قهوه|\bfood\b|\bdish\b|\bcake\b|\bcoffee\b/],
  ['face portrait', /بورتريه|وجه|\bportrait\b|\bface\b/], ['logo', /شعار|لوجو|\blogo\b|\bicon\b/],
  ['animal', /حيوان|نمر|فيل|ذئب|ثعلب|حوت|سمك|\btiger\b|\belephant\b|\bwolf\b|\bfox\b|\bwhale\b|\bfish\b/],
  ['building', /قصر|قلعه|برج ايفل|\bpalace\b|\bcastle\b|\btower\b|\bhouse\b|بيت/], ['robot', /روبوت|\brobot\b/],
];
const TIMES: [PaintTime, RegExp][] = [
  ['night', /ليل|قمر|مظلم|نيون|\bnight\b|\bmidnight\b|\bmoon(?:lit|light)?\b|\bdark\b|\bneon\b/],
  ['sunset', /غروب|ساعه ذهبيه|مغرب|\bsunset\b|\bgolden hour\b|\bdusk\b/],
  ['dawn', /شروق|فجر|صباح|\bsunrise\b|\bdawn\b|\bmorning\b/],
  ['day', /نهار|ظهر|مشمس|\bday(?:light|time)?\b|\bsunny\b|\bnoon\b/],
];
const COLOURS: [string, RegExp][] = [
  ['#7c3aed', /بنفسج|ارجوان|\bpurple\b|\bviolet\b/], ['#2563eb', /ازرق|زرقا|\bblue\b/], ['#d4a017', /ذهب|\bgold(?:en)?\b|\bamber\b|عنبر/],
  ['#e0457b', /وردي|زهري|بمبي|\bpink\b|\brose-?colou?red\b/], ['#16a34a', /اخضر|خضرا|\bgreen\b|\bemerald\b/], ['#dc2626', /احمر|حمرا|\bred\b|\bcrimson\b/],
  ['#0ea5a4', /فيروز|تركواز|\bteal\b|\bturquoise\b|\bcyan\b/], ['#ea7a1f', /برتقال|\borange\b/], ['#e5e7eb', /فضي|ابيض|\bsilver\b|\bwhite\b/],
];

// ── Small tools ───────────────────────────────────────────────────────────────────────────────────────────
function seeded(text: string, seed: number) {
  let h = 2166136261 ^ seed;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
  let a = h >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t ^= t + Math.imul(t ^ (t >>> 7), 61 | t); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const n = (value: number) => String(Math.round(value * 10) / 10);
const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const mix = (a: string, b: string, t: number) => `#${rgb(a).map((c, i) => Math.round(c + (rgb(b)[i] - c) * t).toString(16).padStart(2, '0')).join('')}`;
const esc = (text: string) => text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

const SKY: Record<PaintTime, { sky: string[]; land: string; light: string; ink: string }> = {
  night: { sky: ['#040714', '#0b1640', '#243a7a'], land: '#0a1026', light: '#dfe8ff', ink: '#050814' },
  sunset: { sky: ['#2a1250', '#a8366c', '#f7833d', '#ffd98a'], land: '#3a1a3c', light: '#fff1c9', ink: '#1c0b22' },
  dawn: { sky: ['#2b4775', '#d99aa5', '#ffe4bd'], land: '#3c4466', light: '#fff6e2', ink: '#1d2240' },
  day: { sky: ['#2a78d6', '#86c3f4', '#e4f3ff'], land: '#3f6f4a', light: '#ffffff', ink: '#1f3a2a' },
};

interface Ctx { W: number; H: number; r: () => number; time: PaintTime; setting: PaintSetting; tone: typeof SKY[PaintTime]; accent: string; second: string; horizon: number; outline: boolean }

// ── Background layers ─────────────────────────────────────────────────────────────────────────────────────
function sky(c: Ctx): string {
  const stops = c.setting === 'space' ? ['#02020a', '#0d0826', '#231043'] : c.tone.sky;
  const grad = stops.map((s, i) => `<stop offset="${n(i / (stops.length - 1))}" stop-color="${s}"/>`).join('');
  return `<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">${grad}</linearGradient></defs><rect width="${c.W}" height="${c.H}" fill="url(#sky)"/>`;
}
function stars(c: Ctx, count: number, maxY: number): string {
  let out = '';
  for (let i = 0; i < count; i++) {
    const x = c.r() * c.W, y = c.r() * maxY, s = 0.5 + c.r() * c.r() * 2.6, o = 0.35 + c.r() * 0.65;
    out += `<circle cx="${n(x)}" cy="${n(y)}" r="${n(s)}" fill="#fff" opacity="${n(o)}"/>`;
    if (s > 2.3) out += `<path d="M${n(x - s * 5)} ${n(y)}H${n(x + s * 5)}M${n(x)} ${n(y - s * 5)}V${n(y + s * 5)}" stroke="#fff" stroke-width="0.8" opacity="0.6"/>`;
  }
  return out;
}
function nebula(c: Ctx): string {
  let out = '<g filter="url(#blur-xl)" style="mix-blend-mode:screen">';
  const hues = [c.accent, c.second, mix(c.accent, '#ffffff', 0.35), mix(c.second, '#0ea5e9', 0.5)];
  for (let i = 0; i < 7; i++) {
    const x = c.W * (0.1 + c.r() * 0.8), y = c.H * (0.1 + c.r() * 0.7), rx = c.W * (0.14 + c.r() * 0.22), ry = c.H * (0.08 + c.r() * 0.16);
    out += `<ellipse cx="${n(x)}" cy="${n(y)}" rx="${n(rx)}" ry="${n(ry)}" fill="${hues[i % hues.length]}" opacity="${n(0.28 + c.r() * 0.3)}" transform="rotate(${n(c.r() * 180)} ${n(x)} ${n(y)})"/>`;
  }
  return `${out}</g>`;
}
function galaxy(c: Ctx, x: number, y: number, size: number): string {
  let dots = '';
  for (let arm = 0; arm < 2; arm++) for (let i = 0; i < 90; i++) {
    const t = i / 90, angle = t * 4.6 + arm * Math.PI, radius = size * (0.08 + t * 0.92), jitter = (c.r() - 0.5) * size * 0.16;
    dots += `<circle cx="${n(x + Math.cos(angle) * radius + jitter)}" cy="${n(y + Math.sin(angle) * radius * 0.42 + jitter * 0.4)}" r="${n(0.8 + c.r() * 2.4)}" fill="${c.r() > 0.5 ? '#fff' : mix(c.accent, '#ffffff', 0.6)}" opacity="${n(0.9 - t * 0.6)}"/>`;
  }
  return `<g transform="rotate(-24 ${n(x)} ${n(y)})"><ellipse cx="${n(x)}" cy="${n(y)}" rx="${n(size)}" ry="${n(size * 0.42)}" fill="${c.accent}" opacity="0.28" filter="url(#blur-l)"/>${dots}<ellipse cx="${n(x)}" cy="${n(y)}" rx="${n(size * 0.2)}" ry="${n(size * 0.12)}" fill="#fff6dc" filter="url(#blur-m)"/></g>`;
}
function orb(c: Ctx, x: number, y: number, radius: number): string {
  const moon = c.time === 'night';
  const fill = moon ? '#f4f1e4' : c.time === 'day' ? '#fff7d1' : '#ffe9a8';
  const craters = moon ? [[-0.3, -0.2, 0.18], [0.25, 0.1, 0.13], [-0.05, 0.38, 0.1]].map(([dx, dy, s]) => `<circle cx="${n(x + dx * radius)}" cy="${n(y + dy * radius)}" r="${n(s * radius)}" fill="#d9d4c0" opacity="0.7"/>`).join('') : '';
  return `<circle cx="${n(x)}" cy="${n(y)}" r="${n(radius * 2.6)}" fill="${fill}" opacity="${moon ? 0.16 : 0.34}" filter="url(#blur-l)"/><circle cx="${n(x)}" cy="${n(y)}" r="${n(radius)}" fill="${fill}"/>${craters}`;
}
function clouds(c: Ctx, count: number, top: number, bottom: number): string {
  const fill = c.time === 'night' ? '#31406e' : c.time === 'day' ? '#ffffff' : mix(c.tone.light, c.tone.sky[1], 0.3);
  let out = `<g filter="url(#blur-s)" opacity="${c.time === 'night' ? 0.55 : 0.85}">`;
  for (let i = 0; i < count; i++) {
    const x = c.r() * c.W, y = top + c.r() * (bottom - top), w = c.W * (0.08 + c.r() * 0.1);
    for (let k = 0; k < 5; k++) out += `<ellipse cx="${n(x + (k - 2) * w * 0.45)}" cy="${n(y + (k % 2) * w * 0.1)}" rx="${n(w * (0.5 - Math.abs(k - 2) * 0.09))}" ry="${n(w * (0.24 - Math.abs(k - 2) * 0.04))}" fill="${fill}"/>`;
  }
  return `${out}</g>`;
}
function ridge(c: Ctx, base: number, height: number, fill: string, rough: number): string {
  const p1 = c.r() * 9, p2 = c.r() * 9, p3 = c.r() * 9;
  let d = `M0 ${c.H}`;
  for (let i = 0; i <= 48; i++) {
    const t = i / 48;
    const y = base - height * (0.5 + 0.3 * Math.sin(t * 5.2 + p1) + 0.14 * Math.sin(t * 13 + p2) + rough * 0.06 * Math.sin(t * 41 + p3));
    d += `L${n(t * c.W)} ${n(y)}`;
  }
  return `<path d="${d}L${c.W} ${c.H}Z" fill="${fill}"/>`;
}
function dunes(c: Ctx): string {
  const sand = c.time === 'night' ? '#27305a' : c.time === 'day' ? '#e7bd72' : '#d9853f';
  let out = '';
  for (let i = 0; i < 4; i++) {
    const y = c.horizon + (c.H - c.horizon) * (i / 4) * 0.9, lift = c.H * (0.05 + c.r() * 0.05), peak = c.W * (0.15 + c.r() * 0.7);
    const tone = mix(mix(sand, c.tone.sky[c.tone.sky.length - 1], 0.45 - i * 0.14), c.tone.ink, i * 0.1);
    out += `<path d="M0 ${n(y + lift * 0.4)}Q${n(peak * 0.5)} ${n(y + lift * 0.2)} ${n(peak)} ${n(y - lift)}T${c.W} ${n(y + lift * 0.3)}V${c.H}H0Z" fill="${tone}"/>`;
    out += `<path d="M${n(peak)} ${n(y - lift)}Q${n(peak + c.W * 0.1)} ${n(y + lift * 0.6)} ${n(peak + c.W * 0.32)} ${n(y + lift * 1.1)}L${n(peak - c.W * 0.05)} ${n(y + lift * 1.3)}Z" fill="${c.tone.ink}" opacity="0.18"/>`;
  }
  return out;
}
function sea(c: Ctx, orbX: number): string {
  const top = mix(c.tone.sky[c.tone.sky.length - 1], '#1d5f8a', 0.55), deep = mix('#0b2a4a', c.tone.ink, 0.4);
  let out = `<defs><linearGradient id="sea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${top}"/><stop offset="1" stop-color="${deep}"/></linearGradient></defs><rect y="${n(c.horizon)}" width="${c.W}" height="${n(c.H - c.horizon)}" fill="url(#sea)"/>`;
  for (let i = 0; i < 16; i++) {
    const t = i / 16, y = c.horizon + (c.H - c.horizon) * t * t + 6, w = c.W * (0.02 + t * 0.16);
    out += `<ellipse cx="${n(orbX + (c.r() - 0.5) * w * 0.6)}" cy="${n(y)}" rx="${n(w)}" ry="${n(2 + t * 7)}" fill="${c.tone.light}" opacity="${n(0.75 - t * 0.5)}"/>`;
  }
  for (let i = 0; i < 26; i++) {
    const t = c.r(), y = c.horizon + (c.H - c.horizon) * t, x = c.r() * c.W, w = 20 + t * 110;
    out += `<path d="M${n(x)} ${n(y)}q${n(w / 4)} ${n(-4 - t * 6)} ${n(w / 2)} 0t${n(w / 2)} 0" stroke="${c.tone.light}" stroke-width="${n(1 + t * 2)}" fill="none" opacity="${n(0.12 + t * 0.2)}"/>`;
  }
  return out;
}
function pines(c: Ctx, base: number, count: number, size: number, fill: string): string {
  let out = '';
  for (let i = 0; i < count; i++) {
    const x = (i + c.r() * 0.8) * (c.W / count), h = size * (0.7 + c.r() * 0.6), w = h * 0.36, y = base + c.r() * size * 0.12;
    out += `<path d="M${n(x)} ${n(y - h)}L${n(x + w * 0.5)} ${n(y - h * 0.55)}H${n(x + w * 0.28)}L${n(x + w * 0.75)} ${n(y - h * 0.2)}H${n(x + w * 0.4)}L${n(x + w)} ${n(y)}H${n(x - w)}L${n(x - w * 0.4)} ${n(y - h * 0.2)}H${n(x - w * 0.75)}L${n(x - w * 0.28)} ${n(y - h * 0.55)}H${n(x - w * 0.5)}Z" fill="${fill}"/>`;
  }
  return out;
}
function skyline(c: Ctx): string {
  let out = '';
  for (let layer = 0; layer < 2; layer++) {
    const fill = mix(c.tone.ink, c.tone.sky[c.tone.sky.length - 1], layer ? 0.08 : 0.4);
    let x = -20;
    while (x < c.W) {
      const w = c.W * (0.035 + c.r() * 0.06), h = c.H * (layer ? 0.12 + c.r() * 0.26 : 0.18 + c.r() * 0.3), y = c.horizon + c.H * 0.06 - h;
      out += `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(c.H - y)}" fill="${fill}"/>`;
      if (layer && c.time !== 'day') for (let wy = y + 12; wy < c.horizon; wy += 22) for (let wx = x + 8; wx < x + w - 10; wx += 16) if (c.r() > 0.45) out += `<rect x="${n(wx)}" y="${n(wy)}" width="7" height="10" fill="${c.r() > 0.3 ? '#ffd98a' : mix(c.accent, '#ffffff', 0.5)}" opacity="${n(0.6 + c.r() * 0.4)}"/>`;
      x += w + c.r() * 6;
    }
  }
  return out;
}
function meadow(c: Ctx): string {
  const grass = c.time === 'night' ? '#12301f' : c.time === 'day' ? '#4f9d55' : '#5b7a3a';
  let out = `<path d="M0 ${n(c.horizon + 30)}Q${n(c.W * 0.3)} ${n(c.horizon - 20)} ${n(c.W * 0.6)} ${n(c.horizon + 20)}T${c.W} ${n(c.horizon)}V${c.H}H0Z" fill="${grass}"/><path d="M0 ${n(c.horizon + c.H * 0.12)}Q${n(c.W * 0.5)} ${n(c.horizon + c.H * 0.04)} ${c.W} ${n(c.horizon + c.H * 0.14)}V${c.H}H0Z" fill="${mix(grass, c.tone.ink, 0.25)}"/>`;
  for (let i = 0; i < 46; i++) {
    const t = c.r(), x = c.r() * c.W, y = c.horizon + 40 + (c.H - c.horizon - 40) * t;
    out += rose(x, y, 5 + t * 20, c.r() > 0.5 ? c.accent : c.second, c.r() > 0.4);
  }
  return out;
}
function surface(c: Ctx, words: string): string {
  const marble = /رخام|marble/.test(words), wood = /خشب|wood/.test(words);
  const top = marble ? '#efece6' : wood ? '#8a5a33' : mix(c.accent, '#141018', 0.72), low = marble ? '#cfc9bd' : wood ? '#5c3a1f' : mix(c.accent, '#07060a', 0.86);
  let out = `<defs><linearGradient id="floor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${top}"/><stop offset="1" stop-color="${low}"/></linearGradient></defs><rect y="${n(c.horizon)}" width="${c.W}" height="${n(c.H - c.horizon)}" fill="url(#floor)"/>`;
  if (marble) for (let i = 0; i < 9; i++) {
    const y = c.horizon + c.r() * (c.H - c.horizon), x = c.r() * c.W;
    out += `<path d="M${n(x)} ${n(y)}q${n(60 + c.r() * 90)} ${n(-30 + c.r() * 60)} ${n(170 + c.r() * 160)} ${n(-10 + c.r() * 50)}t${n(160 + c.r() * 150)} ${n(-20 + c.r() * 60)}" stroke="${i % 3 ? '#a59c8b' : '#c8a24a'}" stroke-width="${n(1 + c.r() * 2.5)}" fill="none" opacity="0.5"/>`;
  }
  if (wood) for (let i = 0; i < 12; i++) out += `<path d="M0 ${n(c.horizon + (c.H - c.horizon) * (i / 12))}h${c.W}" stroke="#3d2513" stroke-width="2" opacity="0.35"/>`;
  return `${out}<rect y="${n(c.horizon - 3)}" width="${c.W}" height="6" fill="${c.tone.light}" opacity="0.18"/>`;
}

// ── Subjects ──────────────────────────────────────────────────────────────────────────────────────────────
function rose(x: number, y: number, size: number, colour: string, stem = true): string {
  let out = stem ? `<path d="M${n(x)} ${n(y)}q${n(size * 0.3)} ${n(size * 1.2)} 0 ${n(size * 2.4)}" stroke="#2f6b3a" stroke-width="${n(Math.max(1, size * 0.14))}" fill="none"/><ellipse cx="${n(x + size * 0.5)}" cy="${n(y + size * 1.3)}" rx="${n(size * 0.5)}" ry="${n(size * 0.2)}" fill="#3b8048" transform="rotate(-28 ${n(x + size * 0.5)} ${n(y + size * 1.3)})"/>` : '';
  for (let i = 0; i < 6; i++) out += `<ellipse cx="${n(x + Math.cos(i * 1.05) * size * 0.42)}" cy="${n(y + Math.sin(i * 1.05) * size * 0.42)}" rx="${n(size * 0.62)}" ry="${n(size * 0.5)}" fill="${mix(colour, '#000000', 0.06 * (i % 3))}" transform="rotate(${n(i * 60)} ${n(x)} ${n(y)})"/>`;
  return `${out}<circle cx="${n(x)}" cy="${n(y)}" r="${n(size * 0.5)}" fill="${mix(colour, '#ffffff', 0.18)}"/><path d="M${n(x - size * 0.25)} ${n(y)}a${n(size * 0.25)} ${n(size * 0.25)} 0 1 1 ${n(size * 0.3)} ${n(size * 0.22)}" stroke="${mix(colour, '#000000', 0.35)}" stroke-width="${n(Math.max(0.8, size * 0.08))}" fill="none"/>`;
}
function bottle(c: Ctx, x: number, base: number, h: number, lettering: string | undefined, floating: boolean): string {
  const shape = Math.floor(c.r() * 3), w = h * (shape === 1 ? 0.62 : 0.5), bodyH = h * 0.66, top = base - bodyH, neckW = w * 0.26, neckH = h * 0.1, capH = h * 0.2, capW = w * (shape === 2 ? 0.34 : 0.42);
  const body = shape === 0
    ? `M${n(x - w / 2)} ${n(base - 14)}V${n(top + h * 0.08)}Q${n(x - w / 2)} ${n(top)} ${n(x - neckW)} ${n(top)}H${n(x + neckW)}Q${n(x + w / 2)} ${n(top)} ${n(x + w / 2)} ${n(top + h * 0.08)}V${n(base - 14)}Q${n(x + w / 2)} ${n(base)} ${n(x + w / 2 - 14)} ${n(base)}H${n(x - w / 2 + 14)}Q${n(x - w / 2)} ${n(base)} ${n(x - w / 2)} ${n(base - 14)}Z`
    : shape === 1
      ? `M${n(x - neckW)} ${n(top)}C${n(x - w * 0.75)} ${n(top + bodyH * 0.1)} ${n(x - w * 0.7)} ${n(base)} ${n(x - w * 0.2)} ${n(base)}H${n(x + w * 0.2)}C${n(x + w * 0.7)} ${n(base)} ${n(x + w * 0.75)} ${n(top + bodyH * 0.1)} ${n(x + neckW)} ${n(top)}Z`
      : `M${n(x - neckW)} ${n(top)}L${n(x - w / 2)} ${n(top + bodyH * 0.24)}L${n(x - w * 0.42)} ${n(base - bodyH * 0.12)}L${n(x - w * 0.2)} ${n(base)}H${n(x + w * 0.2)}L${n(x + w * 0.42)} ${n(base - bodyH * 0.12)}L${n(x + w / 2)} ${n(top + bodyH * 0.24)}L${n(x + neckW)} ${n(top)}Z`;
  const id = `b${Math.floor(x)}`, liquid = c.accent, gold = '#d9b25a';
  let out = `<defs><linearGradient id="${id}l" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${mix(liquid, '#ffffff', 0.45)}"/><stop offset="0.55" stop-color="${liquid}"/><stop offset="1" stop-color="${mix(liquid, '#000000', 0.45)}"/></linearGradient><linearGradient id="${id}g" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0.75"/><stop offset="0.25" stop-color="#fff" stop-opacity="0.08"/><stop offset="0.8" stop-color="#fff" stop-opacity="0.05"/><stop offset="1" stop-color="#fff" stop-opacity="0.45"/></linearGradient><linearGradient id="${id}c" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#8a6a22"/><stop offset="0.35" stop-color="#fff0b8"/><stop offset="0.7" stop-color="${gold}"/><stop offset="1" stop-color="#7a5a18"/></linearGradient><clipPath id="${id}k"><path d="${body}"/></clipPath></defs>`;
  if (floating) out += `<ellipse cx="${n(x)}" cy="${n(base - h * 0.5)}" rx="${n(w * 1.5)}" ry="${n(h * 0.75)}" fill="${mix(liquid, '#ffffff', 0.4)}" opacity="0.3" filter="url(#blur-l)"/>`;
  else out += `<ellipse cx="${n(x)}" cy="${n(base + 4)}" rx="${n(w * 0.75)}" ry="${n(h * 0.035)}" fill="#000" opacity="0.38" filter="url(#blur-s)"/><g opacity="0.2" transform="translate(0 ${n(base * 2)}) scale(1 -1)"><path d="${body}" fill="url(#${id}l)"/></g>`;
  out += `<path d="${body}" fill="#ffffff" opacity="0.2"/><g clip-path="url(#${id}k)"><rect x="${n(x - w)}" y="${n(top + bodyH * 0.2)}" width="${n(w * 2)}" height="${n(bodyH)}" fill="url(#${id}l)" opacity="0.92"/><ellipse cx="${n(x)}" cy="${n(top + bodyH * 0.2)}" rx="${n(w * 0.6)}" ry="${n(h * 0.018)}" fill="#fff" opacity="0.45"/>`;
  if (floating) for (let i = 0; i < 26; i++) out += `<circle cx="${n(x + (c.r() - 0.5) * w * 0.9)}" cy="${n(top + bodyH * (0.25 + c.r() * 0.72))}" r="${n(0.8 + c.r() * 2.2)}" fill="#fff" opacity="${n(0.5 + c.r() * 0.5)}"/>`;
  out += `<rect x="${n(x - w)}" y="${n(top)}" width="${n(w * 2)}" height="${n(bodyH)}" fill="url(#${id}g)"/></g><path d="${body}" fill="none" stroke="${c.outline ? '#1a1320' : '#ffffff'}" stroke-width="${c.outline ? 5 : 2.5}" opacity="${c.outline ? 0.9 : 0.6}"/>`;
  out += `<rect x="${n(x - neckW)}" y="${n(top - neckH)}" width="${n(neckW * 2)}" height="${n(neckH + 2)}" fill="url(#${id}c)"/><rect x="${n(x - neckW * 1.25)}" y="${n(top - 6)}" width="${n(neckW * 2.5)}" height="9" rx="3" fill="url(#${id}c)"/>`;
  out += shape === 2 ? `<path d="M${n(x)} ${n(top - neckH - capH)}L${n(x + capW / 2)} ${n(top - neckH - capH * 0.5)}L${n(x + capW * 0.32)} ${n(top - neckH)}H${n(x - capW * 0.32)}L${n(x - capW / 2)} ${n(top - neckH - capH * 0.5)}Z" fill="url(#${id}c)"/>` : `<rect x="${n(x - capW / 2)}" y="${n(top - neckH - capH)}" width="${n(capW)}" height="${n(capH)}" rx="${shape ? n(capW / 2) : '7'}" fill="url(#${id}c)"/>`;
  const labelY = top + bodyH * 0.56, labelW = w * 0.6;
  out += `<rect x="${n(x - labelW / 2)}" y="${n(labelY - h * 0.07)}" width="${n(labelW)}" height="${n(h * 0.14)}" rx="6" fill="#fbf6ea" stroke="${gold}" stroke-width="2.5" opacity="0.96"/>`;
  out += lettering
    ? `<text x="${n(x)}" y="${n(labelY + h * 0.022)}" text-anchor="middle" font-family="'Amiri','Noto Naskh Arabic','Times New Roman',serif" font-weight="700" font-size="${n(Math.min(h * 0.075, (labelW * 1.5) / Math.max(2, lettering.length)))}" fill="#3a2a12">${esc(lettering)}</text>`
    : `<path d="M${n(x - labelW * 0.28)} ${n(labelY)}h${n(labelW * 0.56)}M${n(x)} ${n(labelY - h * 0.035)}l${n(h * 0.02)} ${n(h * 0.035)}l${n(-h * 0.02)} ${n(h * 0.035)}l${n(-h * 0.02)} ${n(-h * 0.035)}Z" stroke="${gold}" stroke-width="2.5" fill="none"/>`;
  return out;
}
function falcon(x: number, y: number, s: number, fill: string): string {
  return `<g transform="translate(${n(x)} ${n(y)}) scale(${n(s)})" fill="${fill}"><path d="M0 4C-18-14-52-26-104-12C-74-12-48-4-28 10C-18 16-10 20-6 26L-12 44L0 36L12 44L6 26C10 20 18 16 28 10C48-4 74-12 104-12C52-26 18-14 0 4Z"/><path d="M-6 2C-6-8 6-8 6 2L12-2L5 8H-5Z"/></g>`;
}
function flock(c: Ctx, count: number, fill: string): string {
  let out = '';
  for (let i = 0; i < count; i++) {
    const x = c.W * (0.1 + c.r() * 0.8), y = c.H * (0.1 + c.r() * 0.3), s = 6 + c.r() * 10;
    out += `<path d="M${n(x - s)} ${n(y)}q${n(s / 2)} ${n(-s * 0.7)} ${n(s)} 0q${n(s / 2)} ${n(-s * 0.7)} ${n(s)} 0" stroke="${fill}" stroke-width="2.2" fill="none" opacity="0.8"/>`;
  }
  return out;
}
function cat(c: Ctx, x: number, base: number, h: number, fill: string, helmet: boolean): string {
  const s = h / 200;
  let out = `<g transform="translate(${n(x)} ${n(base)}) scale(${n(s)})"><path d="M38-18C92-22 96-96 62-104" stroke="${fill}" stroke-width="15" fill="none" stroke-linecap="round"/><path d="M-46 0C-58-52-44-112-8-126C24-132 52-96 50-44C49-22 46-8 42 0Z" fill="${fill}"/><circle cx="-6" cy="-150" r="36" fill="${fill}"/><path d="M-38-164L-36-204L-10-180ZM26-164L28-204L0-180Z" fill="${fill}"/><ellipse cx="-19" cy="-152" rx="6" ry="8" fill="${c.tone.light}"/><ellipse cx="9" cy="-152" rx="6" ry="8" fill="${c.tone.light}"/><ellipse cx="-19" cy="-152" rx="2" ry="7" fill="#111"/><ellipse cx="9" cy="-152" rx="2" ry="7" fill="#111"/>`;
  if (helmet) out += `<circle cx="-6" cy="-156" r="62" fill="#bfe3ff" opacity="0.18" stroke="#eaf6ff" stroke-width="5"/><path d="M-48-186a58 58 0 0 1 40-28" stroke="#fff" stroke-width="6" fill="none" opacity="0.8" stroke-linecap="round"/><rect x="-44" y="-102" width="76" height="16" rx="8" fill="#d7dde8"/>`;
  return `${out}</g>`;
}
function camel(x: number, base: number, h: number, fill: string): string {
  const s = h / 200;
  return `<g transform="translate(${n(x)} ${n(base)}) scale(${n(s)})" fill="${fill}" stroke="${fill}"><path d="M-78-92C-70-128-44-132-30-112C-20-150 8-152 20-112C36-124 60-118 66-92C70-76 60-66 44-64H-58C-72-66-82-76-78-92Z"/><path d="M58-88C76-104 82-132 80-158" stroke-width="16" fill="none" stroke-linecap="round"/><ellipse cx="92" cy="-164" rx="22" ry="11" transform="rotate(14 92 -164)"/><path d="M-60-70L-66 0M-36-66L-30 0M30-66L26 0M52-70L60 0" stroke-width="9" stroke-linecap="round"/><path d="M-78-88Q-92-70-88-50" stroke-width="5" fill="none"/></g>`;
}
function palm(c: Ctx, x: number, base: number, h: number, fill: string): string {
  const lean = (c.r() - 0.5) * h * 0.3, tx = x + lean, ty = base - h;
  let out = `<path d="M${n(x)} ${n(base)}Q${n(x + lean * 0.2)} ${n(base - h * 0.5)} ${n(tx)} ${n(ty)}" stroke="${fill}" stroke-width="${n(h * 0.045)}" fill="none" stroke-linecap="round"/>`;
  for (let i = 0; i < 9; i++) {
    const a = -Math.PI * (0.04 + (i / 8) * 0.92), len = h * (0.36 + c.r() * 0.12), ex = tx + Math.cos(a) * len, ey = ty + Math.sin(a) * len * 0.62 + len * 0.3;
    out += `<path d="M${n(tx)} ${n(ty)}Q${n(tx + Math.cos(a) * len * 0.6)} ${n(ty + Math.sin(a) * len * 0.7)} ${n(ex)} ${n(ey)}Q${n(tx + Math.cos(a) * len * 0.5)} ${n(ty + Math.sin(a) * len * 0.42)} ${n(tx)} ${n(ty)}Z" fill="${fill}"/>`;
  }
  return out;
}
function lantern(c: Ctx, x: number, base: number, h: number): string {
  const w = h * 0.42, glow = '#ffcf6b';
  return `<circle cx="${n(x)}" cy="${n(base - h * 0.45)}" r="${n(h * 0.9)}" fill="${glow}" opacity="0.3" filter="url(#blur-l)"/><path d="M${n(x)} ${n(base - h)}v${n(-h * 0.25)}" stroke="#7a5a18" stroke-width="4"/><path d="M${n(x - w * 0.3)} ${n(base - h * 0.84)}L${n(x)} ${n(base - h)}L${n(x + w * 0.3)} ${n(base - h * 0.84)}Z" fill="#b8892c"/><path d="M${n(x - w * 0.3)} ${n(base - h * 0.84)}L${n(x - w / 2)} ${n(base - h * 0.5)}L${n(x - w * 0.34)} ${n(base - h * 0.1)}H${n(x + w * 0.34)}L${n(x + w / 2)} ${n(base - h * 0.5)}L${n(x + w * 0.3)} ${n(base - h * 0.84)}Z" fill="${glow}" stroke="#7a5a18" stroke-width="5"/><path d="M${n(x)} ${n(base - h * 0.84)}V${n(base - h * 0.1)}M${n(x - w / 2)} ${n(base - h * 0.5)}H${n(x + w / 2)}" stroke="#7a5a18" stroke-width="3"/><ellipse cx="${n(x)}" cy="${n(base - h * 0.42)}" rx="${n(w * 0.12)}" ry="${n(h * 0.12)}" fill="#fff8dc"/><rect x="${n(x - w * 0.4)}" y="${n(base - h * 0.1)}" width="${n(w * 0.8)}" height="${n(h * 0.1)}" rx="4" fill="#b8892c"/>`;
}
function mosque(c: Ctx, x: number, base: number, h: number, fill: string): string {
  const w = h * 1.5, lit = c.time === 'day' ? '' : `<path d="M${n(x - w * 0.07)} ${n(base)}v${n(-h * 0.2)}a${n(w * 0.07)} ${n(w * 0.09)} 0 0 1 ${n(w * 0.14)} 0v${n(h * 0.2)}Z" fill="#ffd98a"/>`;
  const tower = (tx: number) => `<rect x="${n(tx - w * 0.035)}" y="${n(base - h)}" width="${n(w * 0.07)}" height="${n(h)}" fill="${fill}"/><rect x="${n(tx - w * 0.055)}" y="${n(base - h * 0.74)}" width="${n(w * 0.11)}" height="${n(h * 0.05)}" fill="${fill}"/><path d="M${n(tx - w * 0.04)} ${n(base - h)}Q${n(tx)} ${n(base - h * 1.22)} ${n(tx + w * 0.04)} ${n(base - h)}Z" fill="${fill}"/>`;
  return `${tower(x - w * 0.42)}${tower(x + w * 0.42)}<rect x="${n(x - w * 0.34)}" y="${n(base - h * 0.36)}" width="${n(w * 0.68)}" height="${n(h * 0.36)}" fill="${fill}"/><path d="M${n(x - w * 0.22)} ${n(base - h * 0.36)}C${n(x - w * 0.26)} ${n(base - h * 0.78)} ${n(x - w * 0.04)} ${n(base - h * 0.8)} ${n(x)} ${n(base - h * 0.94)}C${n(x + w * 0.04)} ${n(base - h * 0.8)} ${n(x + w * 0.26)} ${n(base - h * 0.78)} ${n(x + w * 0.22)} ${n(base - h * 0.36)}Z" fill="${fill}"/><path d="M${n(x)} ${n(base - h * 0.94)}v${n(-h * 0.1)}" stroke="${fill}" stroke-width="4"/><path d="M${n(x + 2)} ${n(base - h * 1.1)}a${n(h * 0.045)} ${n(h * 0.045)} 0 1 0 ${n(h * 0.04)} ${n(h * 0.06)}a${n(h * 0.036)} ${n(h * 0.036)} 0 1 1 ${n(-h * 0.04)} ${n(-h * 0.06)}Z" fill="${c.time === 'day' ? fill : '#ffe9a8'}"/>${lit}`;
}
function boat(x: number, base: number, h: number, fill: string, sail: string): string {
  return `<path d="M${n(x - h * 0.6)} ${n(base - h * 0.16)}H${n(x + h * 0.6)}L${n(x + h * 0.4)} ${n(base)}H${n(x - h * 0.42)}Z" fill="${fill}"/><path d="M${n(x)} ${n(base - h * 0.16)}V${n(base - h)}" stroke="${fill}" stroke-width="5"/><path d="M${n(x + 6)} ${n(base - h * 0.96)}L${n(x + h * 0.48)} ${n(base - h * 0.24)}H${n(x + 6)}Z" fill="${sail}"/><path d="M${n(x - 6)} ${n(base - h * 0.82)}L${n(x - h * 0.36)} ${n(base - h * 0.24)}H${n(x - 6)}Z" fill="${sail}" opacity="0.85"/>`;
}
function figure(x: number, base: number, h: number, fill: string): string {
  return `<circle cx="${n(x)}" cy="${n(base - h * 0.9)}" r="${n(h * 0.085)}" fill="${fill}"/><path d="M${n(x - h * 0.1)} ${n(base - h * 0.8)}Q${n(x)} ${n(base - h * 0.86)} ${n(x + h * 0.1)} ${n(base - h * 0.8)}L${n(x + h * 0.2)} ${n(base)}H${n(x - h * 0.17)}Z" fill="${fill}"/>`;
}
function weather(c: Ctx, words: string): string {
  let out = '';
  if (/مطر|ممطر|\brain|\bstorm/.test(words)) for (let i = 0; i < 220; i++) { const x = c.r() * c.W, y = c.r() * c.H, l = 16 + c.r() * 26; out += `<path d="M${n(x)} ${n(y)}l${n(-l * 0.25)} ${n(l)}" stroke="#dbeafe" stroke-width="1.6" opacity="${n(0.25 + c.r() * 0.35)}"/>`; }
  if (/ثلج|\bsnow/.test(words)) for (let i = 0; i < 200; i++) out += `<circle cx="${n(c.r() * c.W)}" cy="${n(c.r() * c.H)}" r="${n(1.5 + c.r() * 3.5)}" fill="#fff" opacity="${n(0.5 + c.r() * 0.5)}"/>`;
  if (/ضباب|بخور|دخان|\bfog|\bmist|\bsmoke|\bincense|\bhaze/.test(words)) { out += '<g filter="url(#blur-xl)" opacity="0.5">'; for (let i = 0; i < 6; i++) out += `<ellipse cx="${n(c.r() * c.W)}" cy="${n(c.horizon + (c.r() - 0.4) * c.H * 0.3)}" rx="${n(c.W * 0.3)}" ry="${n(c.H * 0.05)}" fill="${c.tone.light}"/>`; out += '</g>'; }
  return out;
}

const LOOK_OF: Partial<Record<ImageStyleId | 'pixel' | 'flat' | 'ornament' | 'free', PaintLook>> = { watercolor: 'watercolor', sketch: 'sketch', oil: 'oil', cinematic: 'cinematic', photo: 'cinematic', fantasy: 'cinematic', anime: 'cartoon', cartoon3d: 'cartoon' };

/** Paint the idea. The same idea, look and seed always give the same picture. */
export function paintScene(idea: string, choice: { style?: ImageStyleId; aspect?: ImageAspect; seed?: number } = {}): Painting {
  const brief = craftImagePrompt(idea, { style: choice.style, aspect: choice.aspect });
  // A brief Shaheen already crafted carries his own direction lines: only the person's idea is painted.
  const own = idea.match(/«([\s\S]*)»/)?.[1];
  const words = `${fold(idea.startsWith('Create one original image.') && own ? own : idea)} `;
  const [W, H] = PAINT_SIZES[brief.aspect || '4:3'];
  const r = seeded(words, choice.seed ?? 1);
  const subjects = SUBJECTS.filter(([, re]) => re.test(words)).map(([id]) => id);
  let setting = SETTINGS.find(([, re]) => re.test(words))?.[0];
  const beyond = BEYOND.find(([, re]) => re.test(words))?.[0];
  if (!setting) setting = subjects.includes('bottle') || (subjects.includes('lantern') && subjects.length === 1) ? 'studio' : subjects.includes('mosque') ? 'city' : subjects.includes('camel') || subjects.includes('palm') ? 'desert' : subjects.includes('boat') ? 'sea' : subjects.includes('rose') ? 'garden' : subjects.length ? 'mountains' : 'abstract';
  const time: PaintTime = setting === 'space' ? 'night' : TIMES.find(([, re]) => re.test(words))?.[0] || (setting === 'studio' ? 'night' : setting === 'desert' ? 'sunset' : 'day');
  const named = COLOURS.filter(([, re]) => re.test(words)).map(([hex]) => hex);
  const fallback = setting === 'space' ? ['#7c3aed', '#2563eb'] : subjects.includes('rose') ? ['#e0457b', '#f59e0b'] : /فخم|فاخر|ملكي|lux|royal|premium/.test(words) ? ['#d4a017', '#7c2d12'] : time === 'sunset' ? ['#ea7a1f', '#a8366c'] : ['#d4a017', '#0ea5a4'];
  const accent = named[0] || fallback[0], second = named[1] || (named[0] ? mix(named[0], '#ffffff', 0.4) : fallback[1]);
  const look: PaintLook = LOOK_OF[brief.style] || 'flat';
  const tone = SKY[time];
  const c: Ctx = { W, H, r, time, setting, tone, accent, second, horizon: H * (setting === 'studio' ? 0.68 : setting === 'sea' ? 0.56 : 0.62), outline: look === 'cartoon' };
  const lettering = detectLettering(idea).words;
  const silhouette = time === 'day' ? mix(tone.ink, '#000000', 0.1) : tone.ink;
  const orbX = W * (0.22 + r() * 0.56), orbY = setting === 'sea' || setting === 'desert' ? c.horizon - H * (time === 'sunset' || time === 'dawn' ? 0.06 : 0.3) : H * (0.16 + r() * 0.12);

  // 1) The place.
  let back = sky(c);
  if (setting === 'space') back += stars(c, 420, H) + nebula(c) + (/مجر|galax/.test(words) || r() > 0.4 ? galaxy(c, W * (0.25 + r() * 0.5), H * (0.2 + r() * 0.2), Math.min(W, H) * 0.24) : '') + stars(c, 60, H);
  else if (setting === 'abstract') back += nebula(c) + clouds(c, 4, H * 0.1, H * 0.8);
  else if (setting === 'studio') back += `<ellipse cx="${n(W / 2)}" cy="${n(c.horizon - H * 0.2)}" rx="${n(W * 0.55)}" ry="${n(H * 0.42)}" fill="${mix(accent, '#ffffff', 0.25)}" opacity="0.4" filter="url(#blur-xl)"/>`;
  else {
    if (time === 'night') back += stars(c, 230, c.horizon);
    back += orb(c, orbX, orbY, Math.min(W, H) * (time === 'night' ? 0.055 : 0.07));
    if (!/صافي|clear sky/.test(words)) back += clouds(c, time === 'night' ? 3 : 5, H * 0.06, c.horizon * 0.62);
  }
  const far = (t: number) => mix(silhouette, tone.sky[tone.sky.length - 1], t);
  if (setting === 'mountains') back += ridge(c, c.horizon + H * 0.02, H * 0.36, far(0.62), 1) + ridge(c, c.horizon + H * 0.1, H * 0.3, far(0.36), 2) + ridge(c, H * 0.92, H * 0.24, far(0.08), 3);
  if (setting === 'forest') back += ridge(c, c.horizon, H * 0.22, far(0.6), 1) + pines(c, c.horizon + H * 0.06, 26, H * 0.2, far(0.42)) + pines(c, c.horizon + H * 0.2, 16, H * 0.34, far(0.2)) + `<rect y="${n(c.horizon + H * 0.2)}" width="${W}" height="${n(H)}" fill="${far(0.05)}"/>` + pines(c, H * 1.02, 9, H * 0.5, far(0));
  if (setting === 'city') back += (subjects.includes('mosque') ? '' : skyline(c)) + `<rect y="${n(c.horizon + H * 0.06)}" width="${W}" height="${n(H)}" fill="${far(0.02)}"/>`;
  if (setting === 'desert') back += ridge(c, c.horizon + H * 0.01, H * 0.1, far(0.6), 0) + dunes(c);
  if (setting === 'sea') back += sea(c, orbX);
  if (setting === 'garden') back += ridge(c, c.horizon + H * 0.02, H * 0.16, far(0.6), 1) + meadow(c);
  if (setting === 'studio') back += surface(c, words);

  // 2) The subjects, the main one on a third.
  const ground = setting === 'space' || setting === 'abstract' ? H * 0.78 : setting === 'studio' ? c.horizon + (H - c.horizon) * 0.42 : setting === 'sea' ? c.horizon + H * 0.1 : c.horizon + (H - c.horizon) * 0.45;
  const main = subjects.includes('mosque') && subjects[0] === 'lantern' ? 'mosque' : subjects[0], side = W * (r() > 0.5 ? 0.34 : 0.66), other = W - side;
  let front = '';
  if (subjects.includes('mosque')) front += mosque(c, main === 'mosque' ? W / 2 : other, c.horizon + H * 0.03, H * (main === 'mosque' ? 0.36 : 0.22), silhouette);
  if (subjects.includes('palm')) { const count = main === 'palm' ? 3 : 2; for (let i = 0; i < count; i++) front += palm(c, W * (i ? 0.08 + r() * 0.2 + (i - 1) * 0.66 : 0.86), ground + H * 0.04, H * (0.3 + r() * 0.14), silhouette); }
  if (subjects.includes('boat')) front += boat(main === 'boat' ? side : other, c.horizon + H * (main === 'boat' ? 0.12 : 0.05), H * (main === 'boat' ? 0.24 : 0.1), silhouette, time === 'day' ? '#ffffff' : mix(tone.light, accent, 0.25));
  if (subjects.includes('camel')) { const count = main === 'camel' ? 3 : 1; for (let i = 0; i < count; i++) front += camel(side + (i - (count - 1) / 2) * H * 0.24, ground - i * H * 0.006, H * (0.2 - i * 0.02), silhouette); }
  if (subjects.includes('figure')) front += figure(main === 'figure' ? side : other, ground, H * (main === 'figure' ? 0.3 : 0.2), silhouette);
  if (subjects.includes('falcon')) front += flock(c, 5, silhouette) + falcon(main === 'falcon' ? W / 2 : other, H * (main === 'falcon' ? 0.34 : 0.22), (Math.min(W, H) / 1000) * (main === 'falcon' ? 2.3 : 1.1), time === 'day' ? '#3a2a1c' : silhouette);
  if (subjects.includes('lantern')) front += lantern(c, main === 'lantern' ? W / 2 : other, ground, H * (main === 'lantern' ? 0.44 : 0.24));
  if (subjects.includes('cat')) front += cat(c, main === 'cat' ? W / 2 : other, ground, H * (main === 'cat' ? 0.4 : 0.24), setting === 'space' ? '#e8842c' : silhouette, setting === 'space');
  if (subjects.includes('bottle')) {
    const floating = setting === 'space' || setting === 'abstract' || setting === 'sea';
    const alone = main === 'bottle';
    front += bottle(c, alone ? W / 2 : other, floating && setting !== 'sea' ? H * 0.82 : ground, H * (alone ? 0.56 : 0.34), lettering, setting === 'space' || setting === 'abstract');
    if (subjects.includes('rose')) for (let i = 0; i < 5; i++) front += rose((alone ? W / 2 : other) + (i - 2) * H * 0.09 + (r() - 0.5) * 20, ground + H * 0.03 + r() * H * 0.04, H * (0.028 + r() * 0.014), i % 2 ? accent : second, false);
  } else if (subjects.includes('rose') && setting !== 'garden') for (let i = 0; i < 5; i++) front += rose(W * (0.2 + i * 0.15), ground - H * (0.12 + r() * 0.1), H * (0.05 + r() * 0.03), i % 2 ? accent : second);
  front += weather(c, words);
  if (lettering && !subjects.includes('bottle')) front += `<text x="${n(W / 2)}" y="${n(H * 0.93)}" text-anchor="middle" font-family="'Amiri','Noto Naskh Arabic','Times New Roman',serif" font-weight="700" font-size="${n(Math.min(H * 0.08, (W * 1.3) / Math.max(4, lettering.length)))}" fill="${tone.light}" stroke="${tone.ink}" stroke-width="1.5">${esc(lettering)}</text>`;

  // 3) The look.
  const defs = `<defs><filter id="blur-s" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="6"/></filter><filter id="blur-m" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="14"/></filter><filter id="blur-l" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="34"/></filter><filter id="blur-xl" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${n(Math.min(W, H) * 0.06)}"/></filter>`
    + `<filter id="wash" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency="0.012" numOctaves="3" seed="${Math.floor(r() * 90)}" result="t"/><feDisplacementMap in="SourceGraphic" in2="t" scale="${look === 'oil' ? 16 : 30}" xChannelSelector="R" yChannelSelector="G"/>${look === 'watercolor' ? '<feGaussianBlur stdDeviation="1.4"/>' : ''}</filter>`
    + '<filter id="ink"><feColorMatrix type="matrix" values="0.3 0.5 0.2 0 0.1  0.29 0.49 0.19 0 0.09  0.26 0.44 0.17 0 0.06  0 0 0 1 0"/></filter>'
    + `<filter id="grain" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="${look === 'watercolor' || look === 'sketch' ? 0.035 : 0.8}" numOctaves="2" seed="7"/><feColorMatrix type="matrix" values="0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 0 0.5  0.9 0 0 -0.32 0"/></filter>`
    + '<radialGradient id="vignette" cx="0.5" cy="0.5" r="0.75"><stop offset="0.55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.55"/></radialGradient></defs>';
  const scene = `${back}${front}`;
  const body = look === 'watercolor' || look === 'oil' ? `<g filter="url(#wash)"><g transform="translate(${n(-W * 0.04)} ${n(-H * 0.04)}) scale(1.08)">${scene}</g></g>` : look === 'sketch' ? `<g filter="url(#ink)">${scene}</g>` : scene;
  const finish = (look === 'flat' || look === 'cartoon' ? '' : `<rect width="${W}" height="${H}" filter="url(#grain)" opacity="${look === 'watercolor' || look === 'sketch' ? 0.5 : 0.22}" style="mix-blend-mode:${look === 'watercolor' || look === 'sketch' ? 'multiply' : 'overlay'}"/>`)
    + (look === 'cinematic' || setting === 'studio' ? `<rect width="${W}" height="${H}" fill="url(#vignette)"/>` : '');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${defs}<rect width="${W}" height="${H}" fill="${look === 'sketch' ? '#f3efe6' : tone.sky[0]}"/>${body}${finish}</svg>`;
  // The main thing asked for is beyond the vocabulary when nothing drawable was named, or an undrawable noun leads.
  const missing = beyond && (!subjects.length || beyond === 'face portrait' || brief.subject === 'emblem' || brief.subject === 'food' || (brief.subject === 'animal' && !subjects.some((s) => s === 'cat' || s === 'falcon' || s === 'camel'))) ? beyond
    : !subjects.length && setting === 'abstract' ? 'subject' : undefined;
  return { svg, width: W, height: H, time, setting, subjects, look, ...(missing ? { missing } : {}) };
}
