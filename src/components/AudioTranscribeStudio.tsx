import { useState, useRef } from 'react';
import {
  Mic,
  Square,
  Sparkles,
  Copy,
  Check,
  Upload,
  FileAudio,
  Trash2,
  X,
  Volume2,
  Clock,
  RotateCcw,
  Send,
  Loader2,
} from 'lucide-react';
import { apiUrl } from '../utils/api';

interface Props {
  onClose?: () => void;
  onInsertText?: (text: string) => void;
  lang?: string;
}

export function AudioTranscribeStudio({ onClose, onInsertText, lang = 'ar' }: Props) {
  const isAr = lang === 'ar';
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [transcribedText, setTranscribedText] = useState('');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const startRecording = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
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
        setAudioUrl(URL.createObjectURL(audioBlob));
        await transcribeBlob(audioBlob, mimeType);
      };

      mediaRecorder.start(250);
      setRecording(true);
      setSeconds(0);
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch (err: any) {
      console.error(err);
      setError(
        isAr
          ? 'تعذر الوصول إلى الميكروفون، يرجى التحقق من أذونات المتصفح'
          : 'Microphone access denied'
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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setAudioUrl(URL.createObjectURL(file));
    await transcribeBlob(file, file.type || 'audio/webm');
  };

  const transcribeBlob = async (blob: Blob, mimeType: string) => {
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
        body: JSON.stringify({ audio: base64Audio, mimeType }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to transcribe audio');
      }

      if (data.transcription) {
        setTranscribedText((prev) =>
          prev ? `${prev}\n${data.transcription}` : data.transcription
        );
      } else {
        setError(
          isAr
            ? 'لم يُعثر على أصوات كلامية واضحة في التسجيل'
            : 'No clear speech detected in recording'
        );
      }
    } catch (err: any) {
      console.error(err);
      setError(
        isAr
          ? 'حدث خطأ أثناء تحويل التسجيل الصوتي إلى نص'
          : 'Error transcribing audio recording'
      );
    } finally {
      setTranscribing(false);
    }
  };

  const copyText = () => {
    if (!transcribedText) return;
    navigator.clipboard?.writeText(transcribedText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-3xl border border-stone-200 bg-white p-5 shadow-2xl space-y-4 max-w-2xl mx-auto">
      {/* Studio Header */}
      <div className="flex items-center justify-between border-b border-stone-100 pb-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-600 to-amber-800 text-white shadow-sm">
            <Mic className="h-5 w-5" />
          </span>
          <div>
            <h3 className="font-black text-stone-900 text-base sm:text-lg flex items-center gap-2">
              <span>{isAr ? 'استوديو الإملاء والتحويل الصوتي الذكي' : 'Audio Transcription Studio'}</span>
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-900 border border-amber-300">
                {isAr ? 'تفريغ فوري' : 'Studio Dictation'}
              </span>
            </h3>
            <p className="text-xs text-stone-500">
              {isAr
                ? 'تحدث عبر الميكروفون أو ارفع تسجيلاً ليتم تفريغه حرفياً بدقة عالية'
                : 'Speak into your mic or upload an audio clip for high-accuracy transcription'}
            </p>
          </div>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-stone-400 hover:bg-stone-100 cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Recording Control Center */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 rounded-2xl bg-gradient-to-r from-stone-900 via-amber-950 to-stone-900 p-5 text-white shadow-inner">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={recording ? stopRecording : startRecording}
            disabled={transcribing}
            className={`flex h-14 w-14 items-center justify-center rounded-full transition-transform cursor-pointer hover:scale-105 ${
              recording
                ? 'bg-rose-600 text-white animate-pulse shadow-lg shadow-rose-600/40 ring-4 ring-rose-500/30'
                : 'bg-amber-600 text-white shadow-lg shadow-amber-600/30 hover:bg-amber-500'
            }`}
          >
            {recording ? (
              <Square className="h-6 w-6 fill-current" />
            ) : (
              <Mic className="h-6 w-6" />
            )}
          </button>

          <div>
            <span className="block font-black text-sm text-white">
              {recording
                ? isAr
                  ? 'جاري الاستماع والتسجيل…'
                  : 'Listening & Recording…'
                : isAr
                ? 'اضغط لبدء التحدث'
                : 'Press to Speak'}
            </span>
            <span className="flex items-center gap-1.5 font-mono text-xs text-amber-300">
              <Clock className="h-3.5 w-3.5" />
              {Math.floor(seconds / 60)}:{(seconds % 60).toString().padStart(2, '0')}
            </span>
          </div>
        </div>

        {/* Upload Audio File Option */}
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*"
            hidden
            onChange={handleFileUpload}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={recording || transcribing}
            className="flex items-center gap-2 rounded-xl bg-white/10 px-3.5 py-2 text-xs font-bold text-stone-200 backdrop-blur hover:bg-white/20 transition cursor-pointer"
          >
            <Upload className="h-4 w-4" />
            <span>{isAr ? 'رفع ملف صوتي' : 'Upload Audio'}</span>
          </button>
        </div>
      </div>

      {/* Audio Playback if available */}
      {audioUrl && (
        <div className="flex items-center gap-2 rounded-xl border border-stone-200 bg-stone-50 p-2.5">
          <Volume2 className="h-4 w-4 text-amber-700 shrink-0" />
          <audio src={audioUrl} controls className="w-full h-8" />
        </div>
      )}

      {/* Transcribing state indicator */}
      {transcribing && (
        <div className="flex items-center justify-center gap-2.5 rounded-2xl bg-amber-50 p-4 border border-amber-200 text-amber-900 font-bold text-xs">
          <Loader2 className="h-4 w-4 animate-spin text-amber-700" />
          <span>
            {isAr
              ? 'جاري تفريغ الصوت وتحويله إلى نص دقيق…'
              : 'Transcribing speech into accurate text…'}
          </span>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="rounded-xl bg-rose-50 p-3 text-xs text-rose-700 border border-rose-200">
          {error}
        </div>
      )}

      {/* Transcribed Text Area */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-stone-700">
            {isAr ? 'النص المفرّغ والمحول:' : 'Transcribed Text:'}
          </label>
          <span className="text-[11px] text-stone-400">
            {transcribedText ? `${transcribedText.split(/\s+/).filter(Boolean).length} ${isAr ? 'كلمة' : 'words'}` : ''}
          </span>
        </div>
        <textarea
          value={transcribedText}
          onChange={(e) => setTranscribedText(e.target.value)}
          rows={6}
          placeholder={
            isAr
              ? 'سيظهر هنا النص الصوتي المفرّغ تلقائياً فور انتهائك من التحدث…'
              : 'Transcribed speech text will appear here automatically once recording stops…'
          }
          className="w-full resize-none rounded-2xl border border-stone-200 bg-stone-50/70 p-4 text-sm text-stone-900 outline-none focus:border-amber-500 focus:bg-white focus:ring-2 focus:ring-amber-200 leading-relaxed font-sans"
        />
      </div>

      {/* Action Footer */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-stone-100 pt-3">
        <div className="flex gap-2">
          <button
            type="button"
            disabled={!transcribedText}
            onClick={copyText}
            className="flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs font-bold text-stone-700 hover:bg-stone-50 disabled:opacity-40 cursor-pointer"
          >
            {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
            <span>{copied ? (isAr ? 'تم النسخ!' : 'Copied!') : isAr ? 'نسخ النص' : 'Copy'}</span>
          </button>
          <button
            type="button"
            disabled={!transcribedText}
            onClick={() => setTranscribedText('')}
            className="flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs font-bold text-stone-500 hover:bg-stone-50 disabled:opacity-40 cursor-pointer"
          >
            <Trash2 className="h-4 w-4" />
            <span>{isAr ? 'مسح' : 'Clear'}</span>
          </button>
        </div>

        {onInsertText && (
          <button
            type="button"
            disabled={!transcribedText}
            onClick={() => onInsertText(transcribedText)}
            className="flex items-center gap-1.5 rounded-xl bg-amber-700 px-4 py-2 text-xs font-bold text-white hover:bg-amber-800 disabled:opacity-40 cursor-pointer shadow-sm"
          >
            <Send className="h-3.5 w-3.5" />
            <span>{isAr ? 'إدراج النص في المنشور / المحادثة' : 'Insert into editor'}</span>
          </button>
        )}
      </div>
    </div>
  );
}
