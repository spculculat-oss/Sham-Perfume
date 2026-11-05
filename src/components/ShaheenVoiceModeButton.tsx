import { useState } from 'react';
import { LoaderCircle, Mic, MicOff, ShieldCheck, Volume2, X } from 'lucide-react';
import type { SupportedLanguage } from '../types/i18n';
import { isRTL } from '../لغات/localizedContent';
import { makeT, type LText } from '../لغات/localize';
import type { useShaheenVoiceMode } from '../hooks/useShaheenVoiceMode';

type VoiceModeState = ReturnType<typeof useShaheenVoiceMode>;

const COPY = {
  start: { ar: 'ابدأ التحدث مع شاهين', en: 'Start voice chat with Shaheen' },
  stop: { ar: 'إنهاء وضع التحدث', en: 'Stop voice chat' },
  unsupported: { ar: 'وضع التحدث مش مدعوم في المتصفح ده. اكتب سؤالك واستخدم زر قراءة الرد.', en: 'Voice chat is not supported in this browser. Type your question and use the read-aloud button.' },
  disclosure_title: { ar: 'قبل ما تبدأ وضع التحدث', en: 'Before starting voice chat' },
  disclosure_body: { ar: 'لازم تسمح للمتصفح باستخدام الميكروفون. ممكن المتصفح أو خدمات التعرّف على الكلام أو النطق تعالج الصوت أو النص حسب إعداداتها وسياساتها؛ موقع شام نفسه لا يسجّل ملف الصوت ولا يرفعه. الكلام بعد تحويله لنص يدخل محادثة شاهين المعتادة، ويخضع لنفس معالجتها وحفظها.', en: 'You will need to allow microphone access. Your browser or its speech-recognition or speech-synthesis services may process audio or text under their own settings and policies; Sham does not record or upload the audio file. The transcript goes into your usual Shaheen conversation and follows the same processing and retention.' },
  confirm: { ar: 'موافق، ابدأ', en: 'Continue' },
  cancel: { ar: 'إلغاء', en: 'Cancel' },
  listening: { ar: 'بسمعك… اتكلم، وهبعت الكلام بعد ما تسكت.', en: 'Listening… speak naturally; I’ll send it when you pause.' },
  heard: { ar: 'اللي وصلني:', en: 'Heard:' },
  waiting: { ar: 'شاهين بيجهّز الرد…', en: 'Shaheen is preparing a reply…' },
  speaking: { ar: 'شاهين بيتكلم…', en: 'Shaheen is speaking…' },
  permission_error: { ar: 'إذن الميكروفون مرفوض. اسمح به من إعدادات المتصفح وحاول تاني.', en: 'Microphone permission was denied. Allow it in your browser settings and try again.' },
  microphone_error: { ar: 'مش قادر أوصل للميكروفون. اتأكد إنه متصل ومسموح للمتصفح.', en: 'The microphone is unavailable. Check that it is connected and allowed in your browser.' },
  network_error: { ar: 'التعرّف على الكلام مش متاح دلوقتي. جرّب تاني أو اكتب سؤالك.', en: 'Speech recognition is unavailable right now. Try again or type your question.' },
  recognition_error: { ar: 'ماقدرتش أبدأ الاستماع. جرّب تاني أو اكتب سؤالك.', en: 'Speech recognition could not start. Try again or type your question.' },
  speech_error: { ar: 'تعذّر تشغيل الرد بصوت. تقدر تقرأ الرد من زر القراءة.', en: 'The spoken reply could not play. You can read the reply or try the read-aloud button.' },
  too_long: { ar: 'الكلام أطول من الحد المسموح. جرّب تقوله على أجزاء أقصر.', en: 'That was longer than the message limit. Try speaking in shorter parts.' },
} satisfies Record<string, LText>;

export function ShaheenVoiceModeButton({ language, voice, disabled = false }: {
  language: SupportedLanguage;
  voice: VoiceModeState;
  disabled?: boolean;
}) {
  const [showDisclosure, setShowDisclosure] = useState(false);
  const L = makeT(language, COPY);
  const rtl = isRTL(language);

  const toggle = () => {
    if (disabled) return;
    if (voice.active) voice.stop();
    else setShowDisclosure(true);
  };
  const begin = () => {
    setShowDisclosure(false);
    voice.start();
  };
  const errorText = voice.error ? ({
    unsupported: L('unsupported'),
    permission: L('permission_error'),
    microphone: L('microphone_error'),
    network: L('network_error'),
    recognition: L('recognition_error'),
    speech: L('speech_error'),
    too_long: L('too_long'),
  } as const)[voice.error] : '';
  const statusText = voice.speaking ? L('speaking') : voice.waiting ? L('waiting') : L('listening');

  return (
    <>
      <div className="relative flex items-center">
        <button
          type="button"
          onClick={toggle}
          disabled={disabled || !voice.supported}
          aria-label={voice.active ? L('stop') : L('start')}
          aria-pressed={voice.active}
          title={voice.active ? L('stop') : voice.supported ? L('start') : L('unsupported')}
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 ${
            voice.active
              ? 'border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100'
              : 'border-stone-200 bg-white text-stone-600 hover:border-amber-300 hover:bg-amber-50 hover:text-amber-800'
          } disabled:cursor-not-allowed disabled:opacity-45`}
        >
          {voice.active ? <MicOff className="h-4 w-4" aria-hidden="true" /> : <Mic className="h-4 w-4" aria-hidden="true" />}
        </button>
        {voice.active && (
          <div className="absolute bottom-[calc(100%+0.65rem)] end-0 z-30 w-64 max-w-[80vw] rounded-2xl border border-amber-200 bg-white p-3 text-xs text-stone-700 shadow-xl" dir={rtl ? 'rtl' : 'ltr'} aria-live="polite" role="status">
            <div className="mb-1 flex items-center gap-2 font-semibold text-amber-900">
              {voice.speaking ? <Volume2 className="h-4 w-4" aria-hidden="true" /> : voice.waiting ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : <span className="h-2 w-2 animate-pulse rounded-full bg-rose-500" aria-hidden="true" />}
              <span>{statusText}</span>
            </div>
            {!voice.speaking && voice.interim && <p className="line-clamp-3 break-words text-stone-500">{L('heard')} {voice.interim}</p>}
          </div>
        )}
      </div>

      {!voice.supported && !disabled && (
        <p className="absolute bottom-[calc(100%+0.65rem)] end-0 z-20 w-72 max-w-[80vw] rounded-xl border border-stone-200 bg-white p-3 text-xs leading-relaxed text-stone-600 shadow-lg" dir={rtl ? 'rtl' : 'ltr'} role="status">
          {L('unsupported')}
        </p>
      )}
      {errorText && (
        <p className="absolute bottom-[calc(100%+0.65rem)] end-0 z-20 w-72 max-w-[80vw] rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs leading-relaxed text-rose-800 shadow-lg" dir={rtl ? 'rtl' : 'ltr'} role="alert">
          {errorText}
        </p>
      )}

      {showDisclosure && (
        <div className="fixed inset-0 z-[120] grid place-items-center bg-black/55 p-4" dir={rtl ? 'rtl' : 'ltr'}>
          <div className="w-full max-w-md rounded-3xl border border-stone-200 bg-white p-5 shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="shaheen-voice-disclosure-title">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div className="flex items-center gap-2 text-stone-900">
                <span className="rounded-xl bg-amber-100 p-2 text-amber-800"><ShieldCheck className="h-5 w-5" aria-hidden="true" /></span>
                <h2 id="shaheen-voice-disclosure-title" className="font-bold">{L('disclosure_title')}</h2>
              </div>
              <button type="button" onClick={() => setShowDisclosure(false)} className="rounded-full p-2 text-stone-500 hover:bg-stone-100" aria-label={L('cancel')}>
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <p className="text-sm leading-7 text-stone-600">{L('disclosure_body')}</p>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button type="button" onClick={() => setShowDisclosure(false)} className="rounded-xl border border-stone-200 px-4 py-2 text-sm font-semibold text-stone-700 hover:bg-stone-50">{L('cancel')}</button>
              <button type="button" onClick={begin} className="rounded-xl bg-amber-700 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2">{L('confirm')}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
