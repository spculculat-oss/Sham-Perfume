/**
 * «بصمة صوت العميل»: a small numeric summary of how the visitor's voice sounds — the pitch he speaks at and the
 * shape of his voice across the frequencies (where the energy of his vowels sits). Compared with what the microphone
 * hears, it tells his voice from a television, a radio or other people in the room, so they do not cut Shaheen off
 * or get answered.
 *
 * Privacy (Egypt 151/2020, GDPR art. 9 — a voice print is biometric data): made only when the visitor asks for it,
 * kept only in his own browser (localStorage), never sent to the server or anywhere else, deletable with one tap.
 * No sound is ever recorded: each 40 ms slice is reduced to these numbers on the spot and thrown away.
 *
 * Pure maths (no DOM): src/utils/voiceEar.ts feeds it the microphone; the tests feed it synthetic voices.
 */

/** Band centres (Hz), spaced like the ear hears (mel), over the range that carries a voice's character. */
export const BAND_CENTRES = (() => {
  const mel = (f: number) => 2595 * Math.log10(1 + f / 700);
  const hz = (m: number) => 700 * (10 ** (m / 2595) - 1);
  const lo = mel(150); const hi = mel(4200); const count = 16;
  return Array.from({ length: count }, (_, i) => Math.round(hz(lo + ((hi - lo) * i) / (count - 1))));
})();

export interface VoiceFrame {
  rms: number;
  /** The pitch (Hz) when the slice is voiced (a vowel), else undefined. */
  f0?: number;
  /** Loudness-free shape: log energy per band minus their mean. */
  bands: number[];
}

/** Power of one frequency in a slice (Goertzel: cheaper than a full FFT for a few frequencies). */
const windows = new Map<number, Float32Array>();
/** A Hann window (kept per slice length): keeps one strong band from leaking into its neighbours. */
function hann(length: number): Float32Array {
  let w = windows.get(length);
  if (!w) {
    w = new Float32Array(length);
    for (let i = 0; i < length; i += 1) w[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / Math.max(1, length - 1));
    windows.set(length, w);
  }
  return w;
}
function goertzel(samples: ArrayLike<number>, sampleRate: number, frequency: number): number {
  const w = (2 * Math.PI * frequency) / sampleRate;
  const coeff = 2 * Math.cos(w);
  const window = hann(samples.length);
  let s1 = 0; let s2 = 0;
  for (let i = 0; i < samples.length; i += 1) {
    const s0 = samples[i]! * window[i]! + coeff * s1 - s2;
    s2 = s1; s1 = s0;
  }
  return Math.max(1e-12, s1 * s1 + s2 * s2 - coeff * s1 * s2);
}

/** The pitch of a slice by autocorrelation (75–400 Hz), on a 4× thinned copy; undefined when not clearly voiced. */
export function pitchOf(samples: ArrayLike<number>, sampleRate: number): number | undefined {
  const step = Math.max(1, Math.round(sampleRate / 12000));
  const rate = sampleRate / step;
  const thin: number[] = [];
  for (let i = 0; i + step <= samples.length; i += step) {
    let sum = 0;
    for (let k = 0; k < step; k += 1) sum += samples[i + k]!;
    thin.push(sum / step);
  }
  const mean = thin.reduce((a, b) => a + b, 0) / (thin.length || 1);
  for (let i = 0; i < thin.length; i += 1) thin[i]! -= mean;
  const energy = thin.reduce((a, b) => a + b * b, 0);
  if (energy <= 1e-9) return undefined;
  const minLag = Math.floor(rate / 400); const maxLag = Math.min(Math.ceil(rate / 75), thin.length - 8);
  const corr: number[] = [];
  let best = -1; let bestLag = 0;
  for (let lag = minLag; lag <= maxLag; lag += 1) {
    let sum = 0;
    for (let i = 0; i + lag < thin.length; i += 1) sum += thin[i]! * thin[i + lag]!;
    // Normalised by the overlap so long lags are not penalised.
    const value = sum / energy * (thin.length / (thin.length - lag));
    corr[lag] = value;
    if (value > best) { best = value; bestLag = lag; }
  }
  if (best < 0.45 || !bestLag) return undefined;
  // Octave check: a lag half as long that correlates almost as well is the real period.
  const half = Math.round(bestLag / 2);
  if (half >= minLag && (corr[half] ?? 0) > best * 0.85) bestLag = half;
  return rate / bestLag;
}

/** One slice of sound reduced to numbers (the slice itself is not kept). */
export function frameFeatures(samples: ArrayLike<number>, sampleRate: number): VoiceFrame {
  let sum = 0;
  for (let i = 0; i < samples.length; i += 1) sum += samples[i]! * samples[i]!;
  const rms = Math.sqrt(sum / (samples.length || 1));
  const logs = BAND_CENTRES.map((centre) => {
    const width = centre * 0.08;
    return Math.log10(goertzel(samples, sampleRate, centre - width) + goertzel(samples, sampleRate, centre) + goertzel(samples, sampleRate, centre + width));
  });
  const mean = logs.reduce((a, b) => a + b, 0) / logs.length;
  return { rms, f0: rms > 0.003 ? pitchOf(samples, sampleRate) : undefined, bands: logs.map((v) => v - mean) };
}

export interface VoicePrint {
  v: 1;
  /** Average voice shape over voiced slices. */
  bands: number[];
  /** Median pitch (Hz) and how widely it moves (ratio between the 80th and 20th percentiles). */
  f0: number;
  spread: number;
  /** How many voiced slices it was made from. */
  frames: number;
}
const median = (values: number[]) => { const s = [...values].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)]! : 0; };
const quantile = (values: number[], q: number) => { const s = [...values].sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.floor(s.length * q))]! : 0; };

/** The print of a stretch of speech: only voiced slices count; undefined when there is too little voice. */
export function summarize(frames: readonly VoiceFrame[], minFrames = 12): VoicePrint | undefined {
  const voiced = frames.filter((frame) => frame.f0 !== undefined);
  if (voiced.length < minFrames) return undefined;
  const bands = BAND_CENTRES.map((_, i) => voiced.reduce((sum, frame) => sum + frame.bands[i]!, 0) / voiced.length);
  const pitches = voiced.map((frame) => frame.f0!);
  return { v: 1, bands, f0: median(pitches), spread: Math.max(1, quantile(pitches, 0.8) / Math.max(1, quantile(pitches, 0.2))), frames: voiced.length };
}

/** How alike two prints are (0–1): the voice's shape (correlation) and its pitch (on the musical scale). */
export function matchScore(saved: VoicePrint, heard: VoicePrint): number {
  const a = saved.bands; const b = heard.bands;
  let ab = 0; let aa = 0; let bb = 0;
  for (let i = 0; i < a.length; i += 1) { ab += a[i]! * b[i]!; aa += a[i]! * a[i]!; bb += b[i]! * b[i]!; }
  const shape = aa && bb ? Math.max(0, ab / Math.sqrt(aa * bb)) : 0.5;
  // Pitch moves with mood and stress, so the allowed distance grows with how widely he moved it when enrolling.
  const octaves = Math.abs(Math.log2(heard.f0 / saved.f0));
  const allowed = 0.25 + 0.5 * Math.log2(saved.spread);
  const pitch = Math.exp(-((octaves / allowed) ** 2));
  return 0.55 * shape + 0.45 * pitch;
}

/**
 * Is it him? 'yes' / 'no' / 'unsure'. Only a clear 'no' is acted on (ignored as another voice): a wrong 'no' would
 * leave him unheard, so doubtful cases count as him.
 */
export function samePerson(saved: VoicePrint, heard: VoicePrint | undefined): 'yes' | 'no' | 'unsure' {
  if (!heard) return 'unsure';
  const score = matchScore(saved, heard);
  if (score >= 0.72) return 'yes';
  // Short samples are noisy: a 'no' needs a clearly different voice and enough of it.
  if (score < (heard.frames >= 25 ? 0.5 : 0.4)) return 'no';
  return 'unsure';
}

/** Several enrolment sentences into one print (their slices together). */
export function enrolPrint(takes: readonly (readonly VoiceFrame[])[]): VoicePrint | undefined {
  return summarize(takes.flat(), 40);
}

export const isVoicePrint = (value: unknown): value is VoicePrint => {
  const p = value as VoicePrint;
  return Boolean(p && p.v === 1 && Array.isArray(p.bands) && p.bands.length === BAND_CENTRES.length && p.bands.every((x) => Number.isFinite(x))
    && Number.isFinite(p.f0) && p.f0 > 40 && p.f0 < 600 && Number.isFinite(p.spread) && p.spread >= 1);
};

/** The sentences read to make the print (varied vowels, natural length), per language. */
export const ENROL_SENTENCES: Record<string, string[]> = {
  ar: ['أنا بدوّر على عطر ثابت وريحته حلوة.', 'بحب ريحة العود والورد والمسك في الشتا.', 'شاهين، رشّحلي حاجة تنفع هدية.'],
  en: ['I am looking for a perfume that lasts all day.', 'I love the smell of oud, roses and soft musk.', 'Shaheen, please suggest something for a gift.'],
  fr: ['Je cherche un parfum qui tient toute la journée.', 'J’aime l’odeur du oud, des roses et du musc.', 'Shaheen, propose-moi une idée de cadeau.'],
  es: ['Busco un perfume que dure todo el día.', 'Me encanta el olor del oud, las rosas y el almizcle.', 'Shaheen, sugiéreme algo para regalar.'],
  it: ['Cerco un profumo che duri tutto il giorno.', 'Adoro il profumo di oud, rose e muschio.', 'Shaheen, suggeriscimi qualcosa da regalare.'],
  de: ['Ich suche ein Parfum, das den ganzen Tag hält.', 'Ich liebe den Duft von Oud, Rosen und Moschus.', 'Shaheen, schlag mir bitte ein Geschenk vor.'],
  ru: ['Я ищу стойкий аромат на весь день.', 'Мне нравится запах уда, розы и мускуса.', 'Шахин, подскажи что-нибудь в подарок.'],
  zh: ['我在找一款能留香一整天的香水。', '我喜欢沉香、玫瑰和麝香的味道。', 'Shaheen，请推荐一款适合送礼的香水。'],
  tr: ['Bütün gün kalıcı bir parfüm arıyorum.', 'Ud, gül ve misk kokusunu çok seviyorum.', 'Shaheen, hediye için bir şey öner.'],
  fa: ['دنبال عطری هستم که تمام روز بماند.', 'بوی عود و گل رز و مشک را دوست دارم.', 'شاهین، یک پیشنهاد برای هدیه بده.'],
};
