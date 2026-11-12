/**
 * «ودن شاهين»: listens to the microphone's loudness itself (not waiting for the speech engine's words), so Shaheen
 * notices the visitor starting to talk within a fraction of a second:
 *   - `VoiceGate` (pure, tested) turns 40 ms slices into «a voice started» / «it ended» against a noise floor that
 *     follows the room (a fan, the street) and, while Shaheen talks, against his own voice coming back from the
 *     speakers;
 *   - `openEar` (browser) opens the microphone with echo cancellation, noise suppression and automatic gain, and
 *     feeds the gate. Nothing is recorded: every slice becomes a few numbers and is thrown away at once.
 *   - the visitor's voice print (made only when he asks, see voicePrint.ts) is kept in this browser only.
 */
import { frameFeatures, isVoicePrint, samePerson, summarize, type VoiceFrame, type VoicePrint } from './voicePrint';

/** One slice's reading, as the gate sees it. */
export interface EarSlice { t: number; frame: VoiceFrame }
/** A stretch of sound the gate heard (so far, or finished). */
export interface Burst {
  /** From its first loud slice until now / its end (ms). */
  ms: number;
  /** How long of it was voiced — a vowel with a pitch — (ms): a cough, a knock or a clap has almost none. */
  voicedMs: number;
  frames: VoiceFrame[];
}
export type GateEvent = { type: 'start' } | { type: 'end'; burst: Burst };

const SLICE_MS = 40;
/** Loud slices in a row before «a voice started» (80 ms: one click or pop is not a voice). */
const ONSET = 2;
/** Quiet time before «it ended». */
const HANG_MS = 280;

export class VoiceGate {
  /** The room's own noise (rms), followed slowly. */
  floor = 0.004;
  /** Shaheen's voice as the microphone hears it from the speakers (followed while he talks). */
  echo = 0;
  private loud = 0;
  private burst: { start: number; lastLoud: number; frames: VoiceFrame[]; voiced: number } | undefined;

  /** The level a slice must pass to count as someone speaking. */
  threshold(speaking: boolean): number {
    const room = Math.max(0.009, this.floor * 3);
    return speaking ? Math.max(room, this.echo * 1.4) : room;
  }

  /** Shaheen starts talking: his voice from the speakers is learned again from scratch. */
  startSpeaking() { this.echo = 0; this.reset(); }
  /** The first moments of his talking: only learned (his own voice must not cut him off). */
  learnEcho(level: number) { this.echo = Math.max(level, this.echo * 0.98); this.reset(); }

  /** The stretch being heard now (undefined in silence). */
  current(t: number): Burst | undefined {
    const b = this.burst;
    return b && { ms: t - b.start + SLICE_MS, voicedMs: b.voiced * SLICE_MS, frames: b.frames };
  }

  /** Forget the current stretch (e.g. Shaheen just stopped talking, his echo is gone). */
  reset() { this.burst = undefined; this.loud = 0; }

  push({ t, frame }: EarSlice, speaking: boolean): GateEvent | undefined {
    const level = frame.rms;
    const limit = this.threshold(speaking);
    if (!this.burst) {
      if (level > limit) {
        this.loud += 1;
        if (this.loud >= ONSET) {
          this.burst = { start: t - (ONSET - 1) * SLICE_MS, lastLoud: t, frames: [frame], voiced: frame.f0 ? 1 : 0 };
          this.loud = 0;
          return { type: 'start' };
        }
        return undefined;
      }
      this.loud = 0;
      // Quiet: learn the room (fast down, slow up, so a voice does not become «the room»).
      this.floor = level < this.floor ? this.floor * 0.9 + level * 0.1 : Math.min(0.05, this.floor * 0.995 + level * 0.005);
      this.floor = Math.max(0.002, this.floor);
      // His voice comes and goes with every word: its loud moments are what a visitor's voice must beat.
      if (speaking) this.echo = Math.max(level, this.echo * 0.98);
      return undefined;
    }
    const b = this.burst;
    if (b.frames.length < 400) b.frames.push(frame);
    if (frame.f0) b.voiced += 1;
    if (level > limit * 0.6) b.lastLoud = t;
    if (t - b.lastLoud >= HANG_MS) {
      const burst = { ms: b.lastLoud - b.start + SLICE_MS, voicedMs: b.voiced * SLICE_MS, frames: b.frames };
      this.burst = undefined;
      return { type: 'end', burst };
    }
    return undefined;
  }
}

/**
 * What a stretch of sound heard while Shaheen talks is:
 *   - 'speech': someone talking for real (enough voiced sound) → he stops and listens;
 *   - 'noise': too short or not voiced (a cough, a knock, a door) → he goes on from the same word;
 *   - 'wait': not decided yet.
 */
export function judgeBurst(burst: Burst, ended: boolean): 'speech' | 'noise' | 'wait' {
  if (burst.voicedMs >= 240 && burst.voicedMs >= burst.ms * 0.4) return 'speech';
  if (ended) return 'noise';
  // A long stretch with almost no voice in it (music without singing, a hairdryer): not a person talking.
  if (burst.ms >= 1200) return burst.voicedMs >= 200 ? 'speech' : 'noise';
  return 'wait';
}

/** The print of a stretch (undefined when there is too little voice in it to judge). */
export const burstPrint = (burst: Burst | undefined, minFrames = 12): VoicePrint | undefined => (burst ? summarize(burst.frames, minFrames) : undefined);

/**
 * Shaheen went quiet the moment a sound started (`duckedMs` ago). Now:
 *   - 'interrupt': it is the visitor talking → he stops for good and listens;
 *   - 'resume': a short noise (a cough, a knock) → he goes on from the same word;
 *   - 'ignore': another voice (the visitor's print says clearly «not him»: a television, someone nearby) → he goes on;
 *   - 'wait': not decided yet (he stays quiet meanwhile).
 * Without a print every real voice counts as the visitor. With one, only a clear «not him» on enough voice is ignored;
 * anything doubtful counts as him.
 */
export function bargeDecision(burst: Burst, ended: boolean, print: VoicePrint | undefined, duckedMs: number): 'interrupt' | 'resume' | 'ignore' | 'wait' {
  const kind = judgeBurst(burst, ended);
  if (print && kind !== 'noise') {
    const heard = burstPrint(burst, 20);
    const who = samePerson(print, heard);
    if (who === 'no') return 'ignore';
    if (kind === 'speech' && (who === 'yes' || ended || burst.ms >= 1200 || duckedMs >= 1200)) return 'interrupt';
    return duckedMs >= 2000 ? 'resume' : 'wait';
  }
  if (kind === 'speech') return 'interrupt';
  if (kind === 'noise') return 'resume';
  return duckedMs >= 1500 ? 'resume' : 'wait';
}

/** A whole sentence heard while listening: ignored only when the print clearly says it was someone else. */
export function otherVoice(print: VoicePrint | undefined, voiced: readonly VoiceFrame[]): boolean {
  if (!print) return false;
  return samePerson(print, summarize(voiced, 25)) === 'no';
}

// ── The microphone (browser only) ───────────────────────────────────────────────────────────────────────────────
/** Only on a computer: phones share one microphone badly between the speech engine and a second listener. */
export function earSupported(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  if (!navigator.mediaDevices?.getUserMedia || typeof window.AudioContext === 'undefined') return false;
  if (/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || '')) return false;
  return window.matchMedia?.('(pointer: fine)').matches ?? false;
}

/** The microphone constraints: his voice clean, Shaheen's own voice and the room's noise taken out by the browser. */
export const EAR_AUDIO: MediaTrackConstraints = { echoCancellation: true, noiseSuppression: true, autoGainControl: true };

export interface Ear { close(): void; level(): number }
/**
 * Opens the microphone and calls `onSlice` every 40 ms with that slice's numbers. Slices well below the noise floor
 * skip the (heavier) pitch and voice-shape maths. Resolves undefined when the microphone cannot be opened.
 */
export async function openEar(onSlice: (slice: EarSlice) => void, quietBelow: () => number = () => 0): Promise<Ear | undefined> {
  if (!earSupported()) return undefined;
  let stream: MediaStream;
  try { stream = await navigator.mediaDevices.getUserMedia({ audio: EAR_AUDIO }); } catch { return undefined; }
  let context: AudioContext;
  try { context = new AudioContext(); } catch { stream.getTracks().forEach((track) => track.stop()); return undefined; }
  const analyser = context.createAnalyser();
  analyser.fftSize = 2048;
  const source = context.createMediaStreamSource(stream);
  source.connect(analyser);
  const samples = new Float32Array(analyser.fftSize);
  let last = 0;
  const timer = setInterval(() => {
    analyser.getFloatTimeDomainData(samples);
    let sum = 0;
    for (let i = 0; i < samples.length; i += 1) sum += samples[i]! * samples[i]!;
    const rms = Math.sqrt(sum / samples.length);
    last = rms;
    const frame: VoiceFrame = rms < quietBelow() ? { rms, bands: [] } : frameFeatures(samples, context.sampleRate);
    onSlice({ t: performance.now(), frame });
  }, SLICE_MS);
  return {
    level: () => last,
    close() {
      clearInterval(timer);
      try { source.disconnect(); } catch { /* Already disconnected. */ }
      stream.getTracks().forEach((track) => track.stop());
      void context.close().catch(() => undefined);
    },
  };
}

// ── «بصمتي»: kept in this browser only ─────────────────────────────────────────────────────────────────────────
const PRINT_KEY = 'sham_voice_print_v1';
const PRINT_ON_KEY = 'sham_voice_print_on_v1';
const store = () => { try { return globalThis.localStorage; } catch { return undefined; } };
export function savedVoicePrint(): VoicePrint | undefined {
  try {
    const value: unknown = JSON.parse(store()?.getItem(PRINT_KEY) || 'null');
    return isVoicePrint(value) ? value : undefined;
  } catch { return undefined; }
}
export function saveVoicePrint(print: VoicePrint) {
  try { store()?.setItem(PRINT_KEY, JSON.stringify({ ...print, bands: print.bands.map((x) => Math.round(x * 1000) / 1000) })); store()?.setItem(PRINT_ON_KEY, 'on'); } catch { /* Private mode. */ }
}
/** One tap: the print is gone from this browser (it never was anywhere else). */
export function deleteVoicePrint() {
  try { store()?.removeItem(PRINT_KEY); store()?.removeItem(PRINT_ON_KEY); } catch { /* Private mode. */ }
}
export function voicePrintOn(): boolean {
  try { return store()?.getItem(PRINT_ON_KEY) !== 'off'; } catch { return true; }
}
export function setVoicePrintOn(on: boolean) {
  try { store()?.setItem(PRINT_ON_KEY, on ? 'on' : 'off'); } catch { /* Private mode. */ }
}
/** The print to listen with now: saved and switched on. */
export const activeVoicePrint = () => (voicePrintOn() ? savedVoicePrint() : undefined);
