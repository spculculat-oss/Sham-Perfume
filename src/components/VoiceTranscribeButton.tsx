import { useState, useRef } from 'react';
import { Mic, Square, Loader2, Sparkles, Check, AlertCircle } from 'lucide-react';
import { apiUrl } from '../utils/api';

interface Props {
  onTranscribed: (text: string) => void;
  lang?: string;
  className?: string;
  buttonText?: string;
  compact?: boolean;
}

export function VoiceTranscribeButton({
  onTranscribed,
  lang = 'ar',
  className = '',
  buttonText,
  compact = false,
}: Props) {
  const isAr = lang === 'ar';
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<any>(null);

  const startRecording = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : MediaRecorder.isTypeSupported('audio/mp4')
        ? 'audio/mp4'
        : 'audio/wav';

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        clearInterval(timerRef.current);
        const audioBlob = new Blob(chunksRef.current, { type: mimeType });
        await sendForTranscription(audioBlob, mimeType);
      };

      mediaRecorder.start(250);
      setRecording(true);
      setSeconds(0);
      timerRef.current = setInterval(() => {
        setSeconds((s) => s + 1);
      }, 1000);
    } catch (err: any) {
      console.error('Mic access error:', err);
      setError(
        isAr
          ? 'يرجى السماح بالوصول إلى الميكروفون'
          : 'Please allow microphone access'
      );
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop();
      setRecording(false);
      clearInterval(timerRef.current);
    }
  };

  const sendForTranscription = async (blob: Blob, mimeType: string) => {
    setTranscribing(true);
    try {
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
      });
      reader.readAsDataURL(blob);
      const base64Audio = await base64Promise;

      const res = await fetch(apiUrl('/api/ai/transcribe'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audio: base64Audio,
          mimeType,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to transcribe');
      }

      if (data.transcription) {
        onTranscribed(data.transcription);
      } else {
        setError(
          isAr
            ? 'لم يتم التعرف على كلمات واضحة، يرجى التحدث بوضوح وإعادة المحاولة'
            : 'No speech detected, please speak clearly and retry'
        );
      }
    } catch (err: any) {
      console.error('Transcription error:', err);
      setError(
        isAr
          ? 'تعذر تحويل الصوت إلى نص الآن'
          : 'Unable to transcribe audio right now'
      );
    } finally {
      setTranscribing(false);
    }
  };

  if (compact) {
    return (
      <div className="relative inline-flex items-center">
        <button
          type="button"
          title={
            recording
              ? isAr
                ? 'إيقاف التسجيل وتحويل الصوت لنص'
                : 'Stop & transcribe'
              : isAr
              ? 'تحدث لتحويل صوتك إلى نص تلقائياً'
              : 'Speak to transcribe automatically'
          }
          onClick={recording ? stopRecording : startRecording}
          disabled={transcribing}
          className={`flex h-8 w-8 items-center justify-center rounded-full transition cursor-pointer ${
            recording
              ? 'bg-rose-600 text-white animate-pulse shadow-md shadow-rose-600/30'
              : transcribing
              ? 'bg-amber-100 text-amber-700'
              : 'text-stone-500 hover:bg-stone-100 hover:text-amber-800'
          } ${className}`}
        >
          {transcribing ? (
            <Loader2 className="h-4 w-4 animate-spin text-amber-700" />
          ) : recording ? (
            <Square className="h-3.5 w-3.5 fill-current" />
          ) : (
            <Mic className="h-4 w-4" />
          )}
        </button>

        {recording && (
          <span className="ms-1.5 font-mono text-[10px] font-bold text-rose-600">
            {Math.floor(seconds / 60)}:{(seconds % 60).toString().padStart(2, '0')}
          </span>
        )}

        {transcribing && (
          <span className="ms-1.5 text-[10px] text-amber-800 font-semibold flex items-center gap-1">
            <Sparkles className="h-3 w-3 animate-spin" />
            <span>{isAr ? 'جاري التفريغ' : 'Transcribing'}</span>
          </span>
        )}

        {error && (
          <span
            className="absolute top-full start-0 z-50 mt-1 whitespace-nowrap rounded-lg bg-rose-50 px-2 py-1 text-[10px] text-rose-700 border border-rose-200 shadow-lg"
            onClick={() => setError(null)}
          >
            {error}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className={`inline-flex flex-col ${className}`}>
      <button
        type="button"
        onClick={recording ? stopRecording : startRecording}
        disabled={transcribing}
        className={`inline-flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
          recording
            ? 'bg-rose-600 text-white shadow-md shadow-rose-600/20'
            : transcribing
            ? 'bg-amber-100 text-amber-900 border border-amber-300'
            : 'border border-stone-200 bg-white text-stone-700 hover:border-amber-400 hover:bg-amber-50/50'
        }`}
      >
        {transcribing ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin text-amber-700" />
            <span>
              {isAr
                ? 'جاري تحويل الصوت لنص…'
                : 'Transcribing audio…'}
            </span>
          </>
        ) : recording ? (
          <>
            <Square className="h-3.5 w-3.5 fill-current animate-pulse text-white" />
            <span>
              {isAr ? 'إيقاف التسجيل' : 'Stop'} (
              {Math.floor(seconds / 60)}:{(seconds % 60).toString().padStart(2, '0')})
            </span>
          </>
        ) : (
          <>
            <Mic className="h-4 w-4 text-amber-700" />
            <span>{buttonText || (isAr ? 'إملاء صوتي (تحويل لنص)' : 'Dictate (Voice-to-Text)')}</span>
          </>
        )}
      </button>

      {error && (
        <span className="mt-1 text-[10px] text-rose-600 flex items-center gap-1">
          <AlertCircle className="h-3 w-3" />
          {error}
        </span>
      )}
    </div>
  );
}
