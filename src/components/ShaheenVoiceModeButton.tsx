import { useState } from 'react';
import { AudioLines, ShieldCheck, X } from 'lucide-react';
import type { SupportedLanguage } from '../types/i18n';
import { isRTL } from '../لغات/localizedContent';
import { loc, makeT, type LText } from '../لغات/localize';
import type { useShaheenVoiceMode } from '../hooks/useShaheenVoiceMode';
import { NO_VOICE_COPY, ShaheenVoiceStage } from './ShaheenVoiceStage';

type VoiceModeState = ReturnType<typeof useShaheenVoiceMode>;

const COPY = {
  start: { ar: 'ابدأ التحدث مع شاهين', en: 'Start voice chat with Shaheen', fr: 'Parler avec Shaheen', es: 'Hablar con Shaheen', it: 'Parla con Shaheen', de: 'Mit Shaheen sprechen', ru: 'Поговорить с Шахином', zh: '与 Shaheen 语音对话', tr: 'Shaheen ile sesli konuş', fa: 'گفتگوی صوتی با شاهین' },
  stop: { ar: 'إنهاء وضع التحدث', en: 'Stop voice chat', fr: 'Arrêter la conversation vocale', es: 'Detener chat de voz', it: 'Interrompi chat vocale', de: 'Sprachchat beenden', ru: 'Остановить голосовой чат', zh: '结束语音对话', tr: 'Sesli sohbeti durdur', fa: 'توقف گفتگوی صوتی' },
  voice_short: { ar: 'صوت', en: 'Voice', fr: 'Voix', es: 'Voz', it: 'Voce', de: 'Sprache', ru: 'Голос', zh: '语音', tr: 'Ses', fa: 'صوت' },
  stop_short: { ar: 'إيقاف', en: 'Stop', fr: 'Stop', es: 'Parar', it: 'Stop', de: 'Stopp', ru: 'Стоп', zh: '停止', tr: 'Durdur', fa: 'توقف' },
  unsupported: { ar: 'وضع التحدث مش مدعوم في المتصفح ده. جرّب Chrome أو Edge، أو اكتب سؤالك واستخدم زر قراءة الرد.', en: 'Voice chat is not supported in this browser. Try Chrome or Edge, or type your question and use the read-aloud button.', fr: 'Le mode vocal n’est pas pris en charge par ce navigateur. Essayez Chrome ou Edge, ou écrivez votre question.', es: 'Este navegador no admite el chat de voz. Prueba Chrome o Edge, o escribe tu pregunta.', it: 'Questo browser non supporta la chat vocale. Prova Chrome o Edge, oppure scrivi la domanda.', de: 'Dieser Browser unterstützt den Sprachchat nicht. Versuche Chrome oder Edge oder tippe deine Frage.', ru: 'Этот браузер не поддерживает голосовой чат. Попробуйте Chrome или Edge либо напишите вопрос.', zh: '此浏览器不支持语音对话。请使用 Chrome 或 Edge，或直接输入问题。', tr: 'Bu tarayıcı sesli sohbeti desteklemiyor. Chrome veya Edge dene ya da sorunu yaz.', fa: 'این مرورگر از گفتگوی صوتی پشتیبانی نمی‌کند. Chrome یا Edge را امتحان کنید یا سؤال را بنویسید.' },
  disclosure_title: { ar: 'قبل ما تبدأ وضع التحدث', en: 'Before starting voice chat', fr: 'Avant de commencer', es: 'Antes de empezar el chat de voz', it: 'Prima di iniziare la chat vocale', de: 'Bevor du den Sprachchat startest', ru: 'Перед началом голосового чата', zh: '开始语音对话之前', tr: 'Sesli sohbete başlamadan önce', fa: 'پیش از شروع گفتگوی صوتی' },
  disclosure_body: {
    ar: 'لازم تسمح للمتصفح باستخدام الميكروفون. ممكن المتصفح أو خدمات التعرّف على الكلام أو النطق تعالج الصوت أو النص حسب إعداداتها وسياساتها؛ موقع شام نفسه لا يسجّل ملف الصوت ولا يرفعه. الكلام بعد تحويله لنص يدخل محادثة شاهين المعتادة، ويخضع لنفس معالجتها وحفظها.',
    en: 'You will need to allow microphone access. Your browser or its speech-recognition or speech-synthesis services may process audio or text under their own settings and policies; Sham does not record or upload the audio file. The transcript goes into your usual Shaheen conversation and follows the same processing and retention.',
    fr: 'Vous devrez autoriser l’accès au micro. Votre navigateur ou ses services de reconnaissance et de synthèse vocale peuvent traiter l’audio ou le texte selon leurs propres réglages et politiques ; Sham n’enregistre ni n’envoie le fichier audio. La transcription rejoint votre conversation habituelle avec Shaheen et suit le même traitement et la même conservation.',
    es: 'Tendrás que permitir el acceso al micrófono. Tu navegador o sus servicios de reconocimiento y síntesis de voz pueden procesar el audio o el texto según sus propios ajustes y políticas; Sham no graba ni sube el archivo de audio. La transcripción entra en tu conversación habitual con Shaheen y sigue el mismo tratamiento y conservación.',
    it: 'Dovrai consentire l’accesso al microfono. Il browser o i suoi servizi di riconoscimento e sintesi vocale possono elaborare audio o testo secondo le proprie impostazioni e politiche; Sham non registra né carica il file audio. La trascrizione entra nella tua normale conversazione con Shaheen e segue lo stesso trattamento e conservazione.',
    de: 'Du musst den Mikrofonzugriff erlauben. Dein Browser oder seine Spracherkennungs- und Sprachausgabedienste können Audio oder Text nach eigenen Einstellungen und Richtlinien verarbeiten; Sham zeichnet die Audiodatei weder auf noch lädt sie hoch. Die Abschrift fließt in dein gewohntes Gespräch mit Shaheen und wird genauso verarbeitet und aufbewahrt.',
    ru: 'Нужно разрешить доступ к микрофону. Браузер или его службы распознавания и синтеза речи могут обрабатывать звук или текст по своим настройкам и правилам; Sham не записывает и не загружает аудиофайл. Расшифровка попадает в обычный разговор с Шахином и обрабатывается и хранится так же.',
    zh: '需要允许浏览器使用麦克风。浏览器或其语音识别、语音合成服务可能按其自身设置和政策处理音频或文字；Sham 本身不会录制或上传音频文件。转写后的文字会进入你与 Shaheen 的常规对话，并按相同方式处理和保存。',
    tr: 'Mikrofon erişimine izin vermen gerekir. Tarayıcın veya konuşma tanıma ve seslendirme hizmetleri sesi ya da metni kendi ayar ve politikalarına göre işleyebilir; Sham ses dosyasını kaydetmez ve yüklemez. Metne dönüşen konuşma, Shaheen ile olağan sohbetine eklenir ve aynı şekilde işlenip saklanır.',
    fa: 'باید اجازهٔ استفاده از میکروفون را بدهید. مرورگر یا سرویس‌های تشخیص گفتار و تبدیل متن به گفتار ممکن است صدا یا متن را طبق تنظیمات و سیاست‌های خودشان پردازش کنند؛ شام فایل صوتی را ضبط یا بارگذاری نمی‌کند. متن گفته‌ها وارد گفتگوی معمول شما با شاهین می‌شود و به همان شکل پردازش و نگهداری می‌شود.',
  },
  confirm: { ar: 'موافق، ابدأ', en: 'Continue', fr: 'Continuer', es: 'Continuar', it: 'Continua', de: 'Weiter', ru: 'Продолжить', zh: '继续', tr: 'Devam', fa: 'ادامه' },
  cancel: { ar: 'إلغاء', en: 'Cancel', fr: 'Annuler', es: 'Cancelar', it: 'Annulla', de: 'Abbrechen', ru: 'Отмена', zh: '取消', tr: 'İptal', fa: 'لغو' },
  permission_error: { ar: 'إذن الميكروفون مرفوض. اسمح به من إعدادات المتصفح وحاول تاني.', en: 'Microphone permission was denied. Allow it in your browser settings and try again.', fr: 'L’accès au micro a été refusé. Autorisez-le dans les réglages du navigateur et réessayez.', es: 'Se denegó el permiso del micrófono. Permítelo en los ajustes del navegador e inténtalo de nuevo.', it: 'Permesso del microfono negato. Consentilo nelle impostazioni del browser e riprova.', de: 'Der Mikrofonzugriff wurde verweigert. Erlaube ihn in den Browsereinstellungen und versuche es erneut.', ru: 'Доступ к микрофону запрещён. Разрешите его в настройках браузера и попробуйте снова.', zh: '麦克风权限被拒绝。请在浏览器设置中允许后重试。', tr: 'Mikrofon izni reddedildi. Tarayıcı ayarlarından izin verip tekrar dene.', fa: 'اجازهٔ میکروفون رد شد. آن را در تنظیمات مرورگر فعال کنید و دوباره امتحان کنید.' },
  microphone_error: { ar: 'مش قادر أوصل للميكروفون. اتأكد إنه متصل ومسموح للمتصفح.', en: 'The microphone is unavailable. Check that it is connected and allowed in your browser.', fr: 'Le micro est indisponible. Vérifiez qu’il est branché et autorisé.', es: 'El micrófono no está disponible. Comprueba que esté conectado y permitido.', it: 'Il microfono non è disponibile. Verifica che sia collegato e consentito.', de: 'Das Mikrofon ist nicht verfügbar. Prüfe, ob es angeschlossen und erlaubt ist.', ru: 'Микрофон недоступен. Проверьте, что он подключён и разрешён.', zh: '无法使用麦克风。请确认已连接并允许浏览器使用。', tr: 'Mikrofona ulaşılamıyor. Bağlı ve izinli olduğundan emin ol.', fa: 'میکروفون در دسترس نیست. مطمئن شوید وصل است و اجازه دارد.' },
  network_error: { ar: 'التعرّف على الكلام مش متاح دلوقتي. جرّب تاني أو اكتب سؤالك.', en: 'Speech recognition is unavailable right now. Try again or type your question.', fr: 'La reconnaissance vocale est indisponible pour le moment. Réessayez ou écrivez votre question.', es: 'El reconocimiento de voz no está disponible ahora. Inténtalo de nuevo o escribe tu pregunta.', it: 'Il riconoscimento vocale non è disponibile ora. Riprova o scrivi la domanda.', de: 'Die Spracherkennung ist gerade nicht verfügbar. Versuche es erneut oder tippe deine Frage.', ru: 'Распознавание речи сейчас недоступно. Попробуйте снова или напишите вопрос.', zh: '语音识别暂时不可用。请重试或直接输入问题。', tr: 'Konuşma tanıma şu an kullanılamıyor. Tekrar dene veya sorunu yaz.', fa: 'تشخیص گفتار فعلاً در دسترس نیست. دوباره امتحان کنید یا سؤال را بنویسید.' },
  recognition_error: { ar: 'ماقدرتش أبدأ الاستماع. جرّب تاني أو اكتب سؤالك.', en: 'Speech recognition could not start. Try again or type your question.', fr: 'Impossible de démarrer l’écoute. Réessayez ou écrivez votre question.', es: 'No se pudo empezar a escuchar. Inténtalo de nuevo o escribe tu pregunta.', it: 'Impossibile avviare l’ascolto. Riprova o scrivi la domanda.', de: 'Das Zuhören konnte nicht starten. Versuche es erneut oder tippe deine Frage.', ru: 'Не удалось начать прослушивание. Попробуйте снова или напишите вопрос.', zh: '无法开始聆听。请重试或直接输入问题。', tr: 'Dinleme başlatılamadı. Tekrar dene veya sorunu yaz.', fa: 'شروع شنیدن ممکن نشد. دوباره امتحان کنید یا سؤال را بنویسید.' },
  speech_error: { ar: 'تعذّر تشغيل الرد بصوت. تقدر تقرأ الرد من زر القراءة.', en: 'The spoken reply could not play. You can read the reply or try the read-aloud button.', fr: 'La réponse vocale n’a pas pu être lue. Vous pouvez lire la réponse à l’écran.', es: 'No se pudo reproducir la respuesta hablada. Puedes leerla en pantalla.', it: 'Impossibile riprodurre la risposta vocale. Puoi leggerla sullo schermo.', de: 'Die gesprochene Antwort konnte nicht abgespielt werden. Du kannst sie auf dem Bildschirm lesen.', ru: 'Не удалось озвучить ответ. Его можно прочитать на экране.', zh: '无法播放语音回复。你可以在屏幕上阅读回复。', tr: 'Sesli yanıt oynatılamadı. Yanıtı ekranda okuyabilirsin.', fa: 'پخش صوتی پاسخ ممکن نشد. می‌توانید پاسخ را روی صفحه بخوانید.' },
  too_long: { ar: 'الكلام أطول من الحد المسموح. جرّب تقوله على أجزاء أقصر.', en: 'That was longer than the message limit. Try speaking in shorter parts.', fr: 'C’était plus long que la limite. Essayez en plusieurs parties plus courtes.', es: 'Fue más largo que el límite. Prueba en partes más cortas.', it: 'Era più lungo del limite. Prova a parlare in parti più brevi.', de: 'Das war länger als erlaubt. Versuche es in kürzeren Teilen.', ru: 'Слишком длинное сообщение. Попробуйте говорить короче.', zh: '内容超过长度限制。请分成更短的几段来说。', tr: 'Bu, sınırdan uzundu. Daha kısa parçalar halinde söyle.', fa: 'از حد مجاز طولانی‌تر بود. در بخش‌های کوتاه‌تر بگویید.' },
} satisfies Record<string, LText>;

/**
 * The voice-mode entry in the chat's input bar. Starting it (after the microphone notice) opens the
 * full-screen voice stage; errors and the unsupported-browser note stay next to the button after it closes.
 */
export function ShaheenVoiceModeButton({ language, voice, disabled = false, avatarSrc }: {
  language: SupportedLanguage;
  voice: VoiceModeState;
  disabled?: boolean;
  /** Shaheen's portrait for the voice stage header. */
  avatarSrc?: string;
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
          className={`group relative flex h-10 min-w-10 shrink-0 items-center justify-center gap-1.5 overflow-hidden rounded-full border px-2.5 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 ${
            voice.active
              ? 'border-amber-400 bg-stone-900 text-amber-200'
              : 'border-amber-300/70 bg-gradient-to-br from-amber-400 via-amber-500 to-amber-700 text-white shadow-sm shadow-amber-900/20 hover:shadow-md hover:shadow-amber-900/30'
          } disabled:cursor-not-allowed disabled:opacity-45`}
        >
          <span className="pointer-events-none absolute inset-0 rounded-full bg-[radial-gradient(circle_at_30%_25%,rgba(255,255,255,.55),transparent_45%)]" aria-hidden="true" />
          <AudioLines className="relative h-[18px] w-[18px] shrink-0 transition-transform group-hover:scale-110" aria-hidden="true" />
          <span className="relative whitespace-nowrap text-[11px] font-semibold">{L(voice.active ? 'stop_short' : 'voice_short')}</span>
        </button>
      </div>

      {voice.active && <ShaheenVoiceStage language={language} voice={voice} avatarSrc={avatarSrc} />}

      {!voice.supported && !disabled && (
        <p className="absolute bottom-[calc(100%+0.65rem)] end-0 z-20 w-72 max-w-[80vw] rounded-xl border border-stone-200 bg-white p-3 text-xs leading-relaxed text-stone-600 shadow-lg" dir={rtl ? 'rtl' : 'ltr'} role="status">
          {L('unsupported')}
        </p>
      )}
      {voice.noVoice && !voice.active && !errorText && (
        <p className="absolute bottom-[calc(100%+0.65rem)] end-0 z-20 flex w-72 max-w-[80vw] items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-900 shadow-lg" dir={rtl ? 'rtl' : 'ltr'} role="status">
          <span className="flex-1">{loc(language, NO_VOICE_COPY)}</span>
          <button type="button" onClick={voice.clearNoVoice} className="shrink-0 rounded-full px-1.5 font-bold text-amber-800 hover:bg-amber-100" aria-label={L('cancel')}>×</button>
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
