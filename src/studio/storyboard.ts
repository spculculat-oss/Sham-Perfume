/**
 * «استوديو شاهين — صانع الفيديو»: an imagined video as a storyboard (scenes: words on screen, the picture to draw,
 * how long, how the camera moves), and the timing maths the player and the recorder share. The AI platforms write the
 * storyboard when they are open (server task «storyboard»); otherwise it is written here from the idea itself.
 * Pure (no DOM), so it is tested on its own.
 */
export type Motion = 'zoom-in' | 'zoom-out' | 'pan-left' | 'pan-right' | 'pan-up' | 'still';
export const MOTIONS: Motion[] = ['zoom-in', 'zoom-out', 'pan-left', 'pan-right', 'pan-up', 'still'];
export type Aspect = '16:9' | '9:16' | '1:1';
export type Mood = 'calm' | 'epic' | 'happy' | 'mystery';
export const MOODS_LIST: Mood[] = ['calm', 'epic', 'happy', 'mystery'];
export type VideoStyle = 'cinematic' | 'anime' | 'watercolor' | '3d' | 'fantasy' | 'photo' | 'retro';
export const VIDEO_STYLES: VideoStyle[] = ['cinematic', 'anime', 'watercolor', '3d', 'fantasy', 'photo', 'retro'];
export interface Scene { id: string; caption: string; prompt: string; seconds: number; motion: Motion; image?: string }
export interface Storyboard { title: string; aspect: Aspect; style: VideoStyle; mood: Mood; scenes: Scene[]; dir: 'rtl' | 'ltr' }

export const ASPECT_SIZE: Record<Aspect, [number, number]> = { '16:9': [1280, 720], '9:16': [720, 1280], '1:1': [1080, 1080] };
const STYLE_WORDS: Record<VideoStyle, string> = {
  cinematic: 'cinematic film still, dramatic lighting, wide angle, highly detailed, 35mm',
  anime: 'anime style illustration, vibrant colors, studio quality, detailed background',
  watercolor: 'soft watercolor painting, delicate brush strokes, paper texture',
  '3d': '3d render, octane, soft global illumination, pixar style, detailed',
  fantasy: 'epic fantasy concept art, magical atmosphere, glowing light, highly detailed',
  photo: 'professional photograph, natural light, sharp focus, realistic',
  retro: 'retro 80s synthwave illustration, neon glow, grain',
};
export const stylePrompt = (prompt: string, style: VideoStyle) => `${prompt.trim()}, ${STYLE_WORDS[style]}`;

let n = 0;
const sceneId = () => `sc${Date.now().toString(36)}${(n++).toString(36)}`;
const str = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max) : '');
const clampSeconds = (v: unknown) => { const x = Number(v); return Number.isFinite(x) ? Math.min(12, Math.max(2, Math.round(x * 2) / 2)) : 4; };

/** Any JSON (an AI reply, a saved draft) → a safe storyboard, or undefined. */
export function cleanStoryboard(v: unknown, defaults: Partial<Storyboard> = {}): Storyboard | undefined {
  if (!v || typeof v !== 'object') return undefined;
  const r = v as Record<string, unknown>;
  const scenes = (Array.isArray(r.scenes) ? r.scenes : []).slice(0, 16).flatMap((s): Scene[] => {
    if (!s || typeof s !== 'object') return [];
    const x = s as Record<string, unknown>;
    const caption = str(x.caption ?? x.text, 160);
    const prompt = str(x.prompt ?? x.image, 500);
    if (!caption && !prompt) return [];
    const image = typeof x.src === 'string' && /^(?:https:|data:image\/(?:png|jpe?g|webp);base64,|blob:)/.test(x.src) ? x.src : undefined;
    return [{ id: sceneId(), caption, prompt: prompt || caption, seconds: clampSeconds(x.seconds), motion: MOTIONS.includes(x.motion as Motion) ? x.motion as Motion : MOTIONS[(n + 1) % 5]!, ...(image ? { image } : {}) }];
  });
  if (!scenes.length) return undefined;
  const title = str(r.title, 100) || defaults.title || '';
  const aspect = (['16:9', '9:16', '1:1'] as Aspect[]).includes(r.aspect as Aspect) ? r.aspect as Aspect : defaults.aspect || '16:9';
  const style = VIDEO_STYLES.includes(r.style as VideoStyle) ? r.style as VideoStyle : defaults.style || 'cinematic';
  const mood = MOODS_LIST.includes(r.mood as Mood) ? r.mood as Mood : defaults.mood || 'calm';
  const text = `${title} ${scenes.map((s) => s.caption).join(' ')}`;
  return { title, aspect, style, mood, scenes, dir: /[\u0600-\u06FF]/.test(text) ? 'rtl' : 'ltr' };
}

/** Common things people imagine, Arabic → English, so the free image generator (best in English) draws them. */
const VISUAL_WORDS: Record<string, string> = {
  صحراء: 'desert', صحرا: 'desert', بحر: 'sea', محيط: 'ocean', شاطئ: 'beach', قمر: 'moon', شمس: 'sun', نجوم: 'stars', نجمة: 'star', سماء: 'sky', سما: 'sky',
  غابة: 'forest', شجرة: 'tree', جبل: 'mountain', جبال: 'mountains', نهر: 'river', مطر: 'rain', ثلج: 'snow', ليل: 'night', فجر: 'dawn', غروب: 'sunset',
  مدينة: 'city', قصر: 'palace', قلعة: 'castle', بيت: 'house', شارع: 'street', سوق: 'market', مسجد: 'mosque', هرم: 'pyramid', اهرامات: 'pyramids', الأهرامات: 'pyramids',
  نيل: 'Nile river', النيل: 'Nile river', القاهرة: 'Cairo', مصر: 'Egypt', فضاء: 'outer space', كوكب: 'planet', صاروخ: 'rocket', روبوت: 'robot', سيارة: 'car', طيارة: 'airplane', طائرة: 'airplane',
  حصان: 'horse', خيل: 'horses', جمل: 'camel', أسد: 'lion', اسد: 'lion', صقر: 'falcon', نسر: 'eagle', شاهين: 'falcon', قطة: 'cat', قط: 'cat', كلب: 'dog', فراشة: 'butterfly', طائر: 'bird', عصفور: 'bird', تنين: 'dragon',
  ولد: 'boy', بنت: 'girl', رجل: 'man', راجل: 'man', امرأة: 'woman', ست: 'woman', طفل: 'child', أطفال: 'children', عائلة: 'family', فارس: 'knight', ملك: 'king', ملكة: 'queen', أميرة: 'princess',
  عطر: 'perfume bottle', عطور: 'perfume bottles', ورد: 'roses', وردة: 'rose', زهور: 'flowers', عود: 'agarwood', بخور: 'incense smoke', ذهب: 'gold', ذهبي: 'golden', نور: 'light', ضوء: 'light', نار: 'fire', دخان: 'smoke',
  حلم: 'dream', سحر: 'magic', سحري: 'magical', مستقبل: 'futuristic', قديم: 'ancient', قديمة: 'ancient', جميل: 'beautiful', جميلة: 'beautiful', كبير: 'giant', صغير: 'small', أزرق: 'blue', ازرق: 'blue', أحمر: 'red', احمر: 'red', أخضر: 'green', اخضر: 'green',
  رحلة: 'journey', طريق: 'road', باب: 'door', مفتاح: 'key', كتاب: 'book', سفينة: 'ship', مركب: 'boat', جزيرة: 'island', كهف: 'cave', شلال: 'waterfall', حديقة: 'garden', قهوة: 'coffee', شاي: 'tea',
};
export function visualPrompt(text: string): string {
  if (!/[\u0600-\u06FF]/.test(text)) return text.trim();
  const words = text.replace(/[^\p{L}\s]/gu, ' ').split(/\s+/).map((w) => VISUAL_WORDS[w] || VISUAL_WORDS[w.replace(/^(?:و|ب|ف|ل|ال|وال|بال|فال|لل)/, '')] || VISUAL_WORDS[`ال${w}`]).filter(Boolean);
  return [...new Set(words)].join(', ') || 'dreamlike imaginative scene';
}

const ARC_AR = ['البداية', 'الرحلة', 'اللحظة الكبيرة', 'النهاية'];
const ARC_EN = ['The beginning', 'The journey', 'The big moment', 'The ending'];
const ARC_PROMPT = ['establishing wide shot', 'moving through the scene, detailed', 'dramatic climax, close up, glowing light', 'peaceful final shot, golden hour'];
/** A storyboard from the idea alone (no AI): its sentences become scenes; a short idea gets a four-part arc. */
export function localStoryboard(idea: string, { aspect = '16:9', style = 'cinematic', mood = 'calm', seconds = 20 }: { aspect?: Aspect; style?: VideoStyle; mood?: Mood; seconds?: number } = {}): Storyboard {
  const text = idea.trim() || 'A dream';
  const ar = /[\u0600-\u06FF]/.test(text);
  let parts = text.split(/[.!?؟\n]+|[،,؛;]\s*|\s+(?:ثم|وبعدين|بعد كده|then|and then)\s+/u).map((s) => s.trim()).filter((s) => s.length > 1);
  if (parts.length > 10) parts = parts.slice(0, 10);
  const subject = visualPrompt(text);
  const scenes: Scene[] = parts.length >= 3
    ? parts.map((p) => ({ id: sceneId(), caption: p.slice(0, 120), prompt: visualPrompt(p) === 'dreamlike imaginative scene' ? subject : visualPrompt(p), seconds: 4, motion: 'zoom-in' as Motion }))
    : ARC_PROMPT.map((shot, i) => ({ id: sceneId(), caption: i === 0 ? text.slice(0, 120) : (ar ? ARC_AR : ARC_EN)[i]!, prompt: `${subject}, ${shot}`, seconds: 4, motion: 'zoom-in' as Motion }));
  const each = Math.min(12, Math.max(2, Math.round((seconds / scenes.length) * 2) / 2));
  scenes.forEach((s, i) => { s.seconds = each; s.motion = (['zoom-in', 'pan-left', 'zoom-out', 'pan-right', 'pan-up'] as Motion[])[i % 5]!; });
  return { title: text.slice(0, 60), aspect, style, mood, scenes, dir: ar ? 'rtl' : 'ltr' };
}

// ── Timing (shared by the preview player and the recorder) ──────────────────────────────────────────────────
export const TRANSITION = 0.8;
export const totalSeconds = (scenes: Scene[]) => scenes.reduce((sum, s) => sum + s.seconds, 0);
/** Where the video is at second `t`: which scene, how far into it (0–1), and the crossfade into the next one. */
export function frameAt(t: number, scenes: Scene[], transition = TRANSITION): { index: number; p: number; next: number; mix: number } {
  if (!scenes.length) return { index: -1, p: 0, next: -1, mix: 0 };
  let start = 0;
  for (let i = 0; i < scenes.length; i += 1) {
    const d = scenes[i]!.seconds;
    if (t < start + d || i === scenes.length - 1) {
      const local = Math.min(Math.max(t - start, 0), d);
      const tail = i < scenes.length - 1 ? Math.max(0, local - (d - transition)) / transition : 0;
      return { index: i, p: d ? local / d : 1, next: i < scenes.length - 1 ? i + 1 : -1, mix: Math.min(1, tail) };
    }
    start += d;
  }
  return { index: scenes.length - 1, p: 1, next: -1, mix: 0 };
}
const ease = (x: number) => x * x * (3 - 2 * x);
/** The camera at progress `p`: scale and offset (fractions of the frame). */
export function cameraAt(motion: Motion, p: number): { scale: number; x: number; y: number } {
  const e = ease(Math.min(1, Math.max(0, p)));
  switch (motion) {
    case 'zoom-in': return { scale: 1.04 + 0.16 * e, x: 0, y: 0 };
    case 'zoom-out': return { scale: 1.2 - 0.16 * e, x: 0, y: 0 };
    case 'pan-left': return { scale: 1.18, x: 0.07 - 0.14 * e, y: 0 };
    case 'pan-right': return { scale: 1.18, x: -0.07 + 0.14 * e, y: 0 };
    case 'pan-up': return { scale: 1.18, x: 0, y: 0.07 - 0.14 * e };
    default: return { scale: 1.06, x: 0, y: 0 };
  }
}
/** The source rectangle that covers a W×H frame (like CSS object-fit: cover), zoomed and moved by the camera. */
export function coverRect(iw: number, ih: number, W: number, H: number, cam: { scale: number; x: number; y: number }): [number, number, number, number] {
  const ratio = Math.max(W / iw, H / ih) * cam.scale;
  const sw = W / ratio; const sh = H / ratio;
  const sx = Math.min(Math.max((iw - sw) / 2 - cam.x * sw, 0), iw - sw);
  const sy = Math.min(Math.max((ih - sh) / 2 - cam.y * sh, 0), ih - sh);
  return [sx, sy, sw, sh];
}
/** Words broken into lines of at most `max` characters (never mid-word unless one word is longer). */
export function wrapLines(text: string, max: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/).filter(Boolean)) {
    if (!line) line = word;
    else if ((line + ' ' + word).length <= max) line += ` ${word}`;
    else { lines.push(line); line = word; }
  }
  if (line) lines.push(line);
  return lines.slice(0, 4);
}

// ── Music (an original soundtrack made from notes, no samples, no licence needed) ───────────────────────────
const NOTE = (semitones: number) => 220 * 2 ** (semitones / 12);
/** Chords by mood, as semitones above A3. */
const PROGRESSIONS: Record<Mood, number[][]> = {
  calm: [[3, 7, 10], [-2, 2, 5], [0, 3, 7], [-4, 0, 3]],
  epic: [[0, 3, 7], [-4, 0, 3], [-9, -5, -2], [-2, 2, 5]],
  happy: [[3, 7, 10], [10, 14, 17], [0, 3, 7], [8, 12, 15]],
  mystery: [[0, 3, 7], [1, 5, 8], [-2, 1, 5], [0, 3, 6]],
};
export const TEMPO: Record<Mood, number> = { calm: 3.2, epic: 2.4, happy: 2, mystery: 3.6 };
/** The chords of the soundtrack: when each starts and its frequencies. */
export function musicPlan(mood: Mood, seconds: number): { at: number; length: number; freqs: number[] }[] {
  const bar = TEMPO[mood];
  const chords = PROGRESSIONS[mood];
  const out: { at: number; length: number; freqs: number[] }[] = [];
  for (let at = 0, i = 0; at < seconds; at += bar, i += 1) out.push({ at, length: Math.min(bar, seconds - at), freqs: chords[i % chords.length]!.map(NOTE) });
  return out;
}
