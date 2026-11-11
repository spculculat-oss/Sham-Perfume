import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Keyboard, Mic, MicOff, X } from 'lucide-react';
import type { SupportedLanguage } from '../types/i18n';
import { isRTL } from '../لغات/localizedContent';
import { makeT, type LText } from '../لغات/localize';
import type { useShaheenVoiceMode } from '../hooks/useShaheenVoiceMode';

type VoiceModeState = ReturnType<typeof useShaheenVoiceMode>;

const COPY = {
  title: { ar: 'التحدث مع شاهين', en: 'Talking with Shaheen', fr: 'Conversation avec Shaheen', es: 'Hablando con Shaheen', it: 'Parli con Shaheen', de: 'Gespräch mit Shaheen', ru: 'Разговор с Шахином', zh: '与 Shaheen 语音对话', tr: 'Shaheen ile konuşma', fa: 'گفتگو با شاهین' },
  listening: { ar: 'بسمعك…', en: 'Listening…', fr: 'Je vous écoute…', es: 'Te escucho…', it: 'Ti ascolto…', de: 'Ich höre zu…', ru: 'Слушаю…', zh: '正在聆听…', tr: 'Dinliyorum…', fa: 'گوش می‌دهم…' },
  speak_now: { ar: 'اتكلم براحتك، وأول ما تسكت هبعت كلامك.', en: 'Speak naturally — I’ll send it when you pause.', fr: 'Parlez naturellement, j’envoie dès que vous faites une pause.', es: 'Habla con calma; lo envío cuando hagas una pausa.', it: 'Parla con calma: invio quando fai una pausa.', de: 'Sprich ganz normal – ich sende, sobald du eine Pause machst.', ru: 'Говорите спокойно — отправлю, когда вы замолчите.', zh: '请自然地说话，停顿后我会发送。', tr: 'Rahatça konuş; durduğunda gönderirim.', fa: 'راحت صحبت کنید؛ وقتی مکث کنید می‌فرستم.' },
  thinking: { ar: 'شاهين بيفكّر…', en: 'Shaheen is thinking…', fr: 'Shaheen réfléchit…', es: 'Shaheen está pensando…', it: 'Shaheen sta pensando…', de: 'Shaheen denkt nach…', ru: 'Шахин думает…', zh: 'Shaheen 正在思考…', tr: 'Shaheen düşünüyor…', fa: 'شاهین در حال فکر کردن است…' },
  speaking: { ar: 'شاهين بيتكلم', en: 'Shaheen is speaking', fr: 'Shaheen parle', es: 'Shaheen está hablando', it: 'Shaheen sta parlando', de: 'Shaheen spricht', ru: 'Шахин говорит', zh: 'Shaheen 正在说话', tr: 'Shaheen konuşuyor', fa: 'شاهین صحبت می‌کند' },
  interrupt_hint: { ar: 'اضغط على شاهين عشان تقاطعه وتتكلم', en: 'Tap Shaheen to interrupt and speak', fr: 'Touchez Shaheen pour l’interrompre et parler', es: 'Toca a Shaheen para interrumpir y hablar', it: 'Tocca Shaheen per interromperlo e parlare', de: 'Tippe auf Shaheen, um zu unterbrechen und zu sprechen', ru: 'Нажмите на Шахина, чтобы перебить и говорить', zh: '点按 Shaheen 即可打断并开始说话', tr: 'Sözünü kesip konuşmak için Shaheen’e dokun', fa: 'برای قطع کردن و صحبت، روی شاهین بزنید' },
  muted: { ar: 'الميكروفون مقفول', en: 'Microphone muted', fr: 'Micro coupé', es: 'Micrófono silenciado', it: 'Microfono disattivato', de: 'Mikrofon stumm', ru: 'Микрофон выключен', zh: '麦克风已静音', tr: 'Mikrofon kapalı', fa: 'میکروفون خاموش است' },
  muted_hint: { ar: 'اضغط على الميكروفون أو على شاهين عشان تكمّل الكلام.', en: 'Tap the microphone or Shaheen to keep talking.', fr: 'Touchez le micro ou Shaheen pour reprendre.', es: 'Toca el micrófono o a Shaheen para seguir hablando.', it: 'Tocca il microfono o Shaheen per continuare.', de: 'Tippe auf das Mikrofon oder Shaheen, um weiterzusprechen.', ru: 'Нажмите на микрофон или Шахина, чтобы продолжить.', zh: '点按麦克风或 Shaheen 继续对话。', tr: 'Devam etmek için mikrofona veya Shaheen’e dokun.', fa: 'برای ادامه روی میکروفون یا شاهین بزنید.' },
  you: { ar: 'إنت:', en: 'You:', fr: 'Vous :', es: 'Tú:', it: 'Tu:', de: 'Du:', ru: 'Вы:', zh: '你：', tr: 'Sen:', fa: 'شما:' },
  mute: { ar: 'اقفل الميكروفون', en: 'Mute microphone', fr: 'Couper le micro', es: 'Silenciar micrófono', it: 'Disattiva microfono', de: 'Mikrofon stummschalten', ru: 'Выключить микрофон', zh: '静音麦克风', tr: 'Mikrofonu kapat', fa: 'خاموش کردن میکروفون' },
  unmute: { ar: 'افتح الميكروفون', en: 'Unmute microphone', fr: 'Réactiver le micro', es: 'Activar micrófono', it: 'Riattiva microfono', de: 'Mikrofon einschalten', ru: 'Включить микрофон', zh: '取消静音', tr: 'Mikrofonu aç', fa: 'روشن کردن میکروفون' },
  type: { ar: 'اكتب بدل الكلام', en: 'Type instead', fr: 'Écrire plutôt', es: 'Escribir en su lugar', it: 'Scrivi invece', de: 'Lieber tippen', ru: 'Написать текстом', zh: '改为打字', tr: 'Yazarak devam et', fa: 'به‌جای صحبت بنویسید' },
  end: { ar: 'إنهاء المحادثة الصوتية', en: 'End voice chat', fr: 'Terminer la conversation vocale', es: 'Terminar chat de voz', it: 'Termina chat vocale', de: 'Sprachchat beenden', ru: 'Завершить голосовой чат', zh: '结束语音对话', tr: 'Sesli sohbeti bitir', fa: 'پایان گفتگوی صوتی' },
  orb_listen: { ar: 'شاهين بيسمعك', en: 'Shaheen is listening', fr: 'Shaheen vous écoute', es: 'Shaheen te escucha', it: 'Shaheen ti ascolta', de: 'Shaheen hört zu', ru: 'Шахин слушает', zh: 'Shaheen 正在聆听', tr: 'Shaheen dinliyor', fa: 'شاهین گوش می‌دهد' },
  private: { ar: 'الصوت مش بيتسجّل ولا بيترفع؛ الكلام بيتحول لنص بس.', en: 'Audio is never recorded or uploaded — only the text is used.', fr: 'L’audio n’est ni enregistré ni envoyé : seul le texte est utilisé.', es: 'El audio no se graba ni se sube; solo se usa el texto.', it: 'L’audio non viene registrato né caricato: si usa solo il testo.', de: 'Audio wird weder aufgezeichnet noch hochgeladen – nur der Text zählt.', ru: 'Звук не записывается и не загружается — используется только текст.', zh: '不会录制或上传音频，只使用转写的文字。', tr: 'Ses kaydedilmez ve yüklenmez; yalnızca metin kullanılır.', fa: 'صدا ضبط یا بارگذاری نمی‌شود؛ فقط متن استفاده می‌شود.' },
} satisfies Record<string, LText>;

type StagePhase = 'muted' | 'speaking' | 'thinking' | 'listening';

function stagePhase(voice: VoiceModeState): StagePhase {
  if (voice.speaking) return 'speaking';
  if (voice.waiting) return 'thinking';
  if (voice.muted) return 'muted';
  return 'listening';
}

/** Phones share one microphone between apps badly; only a desktop pointer gets the live level meter. */
function canMeterMicrophone(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  if (!navigator.mediaDevices?.getUserMedia || typeof window.AudioContext === 'undefined') return false;
  if (/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || '')) return false;
  return window.matchMedia?.('(pointer: fine)').matches ?? false;
}

/**
 * A live loudness reading (0–1) of the visitor's microphone, used only to move the orb with their voice.
 * The sound is analysed on the device in real time: nothing is stored, recorded or sent anywhere.
 */
function useMicrophoneLevel(enabled: boolean) {
  const levelRef = useRef<number | null>(null);
  useEffect(() => {
    levelRef.current = null;
    if (!enabled || !canMeterMicrophone()) return undefined;
    let cancelled = false;
    let stream: MediaStream | null = null;
    let context: AudioContext | null = null;
    let frame = 0;
    void navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }).then((media) => {
      if (cancelled) { media.getTracks().forEach((track) => track.stop()); return; }
      stream = media;
      context = new AudioContext();
      const analyser = context.createAnalyser();
      analyser.fftSize = 512;
      context.createMediaStreamSource(media).connect(analyser);
      const samples = new Uint8Array(analyser.fftSize);
      const read = () => {
        analyser.getByteTimeDomainData(samples);
        let sum = 0;
        for (const sample of samples) { const centred = (sample - 128) / 128; sum += centred * centred; }
        levelRef.current = Math.min(1, Math.sqrt(sum / samples.length) * 5);
        frame = requestAnimationFrame(read);
      };
      read();
    }).catch(() => { levelRef.current = null; });
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      stream?.getTracks().forEach((track) => track.stop());
      void context?.close().catch(() => undefined);
      levelRef.current = null;
    };
  }, [enabled]);
  return levelRef;
}

/**
 * The full-screen voice conversation: a living golden orb that breathes while it listens, follows the
 * visitor's voice, swirls while Shaheen thinks and pulses with every spoken word — with live captions and
 * mute / type / end controls. Tapping the orb while Shaheen speaks cuts him off and listens.
 */
export function ShaheenVoiceStage({ language, voice, avatarSrc }: {
  language: SupportedLanguage;
  voice: VoiceModeState;
  avatarSrc?: string;
}) {
  const L = makeT(language, COPY);
  const rtl = isRTL(language);
  const phase = stagePhase(voice);
  const stageRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLButtonElement>(null);
  const micLevel = useMicrophoneLevel(voice.active && !voice.muted);

  // Everything the animation loop reads lives in refs so the loop never restarts on a re-render.
  const live = useRef({ phase, hearing: voice.hearing });
  live.current.phase = phase;
  live.current.hearing = voice.hearing;
  const energy = useRef(0);
  useEffect(() => { energy.current = Math.max(energy.current, 0.85); }, [voice.speechBeat]);
  useEffect(() => { if (voice.interim) energy.current = Math.max(energy.current, 0.55); }, [voice.interim]);

  useEffect(() => {
    const node = stageRef.current;
    if (!node || typeof window === 'undefined') return undefined;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      node.style.setProperty('--sham-voice-level', '0.2');
      return undefined;
    }
    let level = 0;
    let frame = 0;
    const tick = (time: number) => {
      const t = time / 1000;
      const { phase: current, hearing } = live.current;
      energy.current *= 0.9;
      let target: number;
      if (current === 'muted') target = 0.02;
      else if (current === 'thinking') target = 0.16 + 0.06 * Math.sin(t * 3.2);
      else if (current === 'speaking') target = 0.24 + 0.1 * Math.sin(t * 7) + energy.current * 0.6;
      else {
        const measured = micLevel.current;
        target = measured !== null
          ? 0.08 + measured * 0.9
          : (hearing ? 0.42 + 0.18 * Math.sin(t * 9) : 0.1 + 0.05 * Math.sin(t * 2.2)) + energy.current * 0.35;
      }
      level += (Math.max(0, Math.min(1, target)) - level) * 0.16;
      node.style.setProperty('--sham-voice-level', level.toFixed(3));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [micLevel]);

  // Escape ends the conversation; the end button takes focus so keyboard users land on a control.
  useEffect(() => {
    endRef.current?.focus();
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') voice.stop(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [voice.stop]);

  const onOrb = () => {
    if (voice.speaking) voice.interrupt();
    else if (voice.muted) voice.toggleMute();
  };

  const status = phase === 'speaking' ? L('speaking') : phase === 'thinking' ? L('thinking') : phase === 'muted' ? L('muted') : L('listening');
  let caption: ReactNode;
  if (phase === 'speaking') caption = voice.spokenText ? <p className="text-lg leading-relaxed text-white sm:text-xl">{voice.spokenText}</p> : null;
  else if (phase === 'thinking') caption = voice.lastHeard ? <p className="text-base leading-relaxed text-amber-100/70"><span className="font-semibold text-amber-200/90">{L('you')}</span> {voice.lastHeard}</p> : null;
  else if (phase === 'muted') caption = <p className="text-base text-stone-300">{L('muted_hint')}</p>;
  else caption = voice.interim
    ? <p className="text-lg leading-relaxed text-white sm:text-xl">{voice.interim}</p>
    : <p className="text-base text-stone-300">{L('speak_now')}</p>;

  const stage = (
    <div
      ref={stageRef}
      className="sham-voice-stage fixed inset-0 z-[150] flex flex-col items-center justify-between overflow-hidden px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))] text-white"
      data-phase={phase}
      dir={rtl ? 'rtl' : 'ltr'}
      role="dialog"
      aria-modal="true"
      aria-label={L('title')}
    >
      <div className="sham-voice-backdrop pointer-events-none absolute inset-0" aria-hidden="true" />

      <header className="relative flex w-full max-w-xl items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          {avatarSrc && <img src={avatarSrc} alt="" className="h-9 w-9 rounded-full border border-amber-300/70 object-cover object-top" />}
          <div>
            <p className="text-sm font-bold text-amber-100">{L('title')}</p>
            <p className="flex items-center gap-1.5 text-xs text-stone-300" role="status" aria-live="polite">
              <span className={`h-1.5 w-1.5 rounded-full ${phase === 'listening' ? 'bg-emerald-400 motion-safe:animate-pulse' : phase === 'speaking' ? 'bg-amber-300' : phase === 'thinking' ? 'bg-sky-300 motion-safe:animate-pulse' : 'bg-stone-500'}`} aria-hidden="true" />
              {status}
            </p>
          </div>
        </div>
        <button type="button" onClick={voice.stop} className="rounded-full p-2 text-stone-300 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300" aria-label={L('end')} title={L('end')}>
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
      </header>

      <div className="relative flex flex-1 flex-col items-center justify-center gap-8">
        <button
          type="button"
          onClick={onOrb}
          className="sham-voice-orb group relative grid h-52 w-52 place-items-center rounded-full focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-300/60 sm:h-60 sm:w-60"
          aria-label={phase === 'speaking' ? L('interrupt_hint') : phase === 'muted' ? L('unmute') : L('orb_listen')}
          title={phase === 'speaking' ? L('interrupt_hint') : undefined}
        >
          <span className="sham-voice-halo" aria-hidden="true" />
          <span className="sham-voice-ring" aria-hidden="true" />
          <span className="sham-voice-core" aria-hidden="true">
            <span className="sham-voice-sheen" />
            <span className="sham-voice-bars">
              {[0, 1, 2, 3, 4].map((bar) => <i key={bar} style={{ animationDelay: `${bar * -0.17}s` }} />)}
            </span>
          </span>
        </button>

        <div className="min-h-[5.5rem] w-full max-w-xl text-center" aria-live="polite">
          {caption && <div className="sham-voice-caption line-clamp-4 break-words">{caption}</div>}
          {phase === 'speaking' && <p className="mt-3 text-xs text-amber-200/70">{L('interrupt_hint')}</p>}
        </div>
      </div>

      <footer className="relative flex w-full max-w-xl flex-col items-center gap-4">
        <div className="flex items-center justify-center gap-5">
          <button type="button" onClick={voice.stop} className="grid h-14 w-14 place-items-center rounded-full bg-white/10 text-stone-100 backdrop-blur transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300" aria-label={L('type')} title={L('type')}>
            <Keyboard className="h-6 w-6" aria-hidden="true" />
          </button>
          <button type="button" onClick={voice.toggleMute} aria-pressed={voice.muted} className={`grid h-16 w-16 place-items-center rounded-full transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 ${voice.muted ? 'bg-white text-stone-900 hover:bg-stone-200' : 'bg-white/15 text-white backdrop-blur hover:bg-white/25'}`} aria-label={voice.muted ? L('unmute') : L('mute')} title={voice.muted ? L('unmute') : L('mute')}>
            {voice.muted ? <MicOff className="h-7 w-7" aria-hidden="true" /> : <Mic className="h-7 w-7" aria-hidden="true" />}
          </button>
          <button ref={endRef} type="button" onClick={voice.stop} className="grid h-14 w-14 place-items-center rounded-full bg-rose-600 text-white shadow-lg shadow-rose-900/40 transition hover:bg-rose-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300" aria-label={L('end')} title={L('end')}>
            <X className="h-6 w-6" aria-hidden="true" />
          </button>
        </div>
        <p className="text-center text-[11px] text-stone-400">{L('private')}</p>
      </footer>
    </div>
  );

  return typeof document === 'undefined' ? stage : createPortal(stage, document.body);
}
