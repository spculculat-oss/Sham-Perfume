import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Loader2,
  Mic,
  MicOff,
  Phone,
  PhoneOff,
  Send,
  Volume2,
  X,
} from 'lucide-react';
import { SupportedLanguage } from '../types/i18n';
import { API_BASE, isStaticHosting } from '../utils/api';
import { pickArEn } from '../لغات/localize';

interface LiveVoiceModalProps {
  open: boolean;
  onClose: () => void;
  currentLang: SupportedLanguage;
}

interface TranscriptLine {
  id: string;
  role: 'user' | 'shahin';
  text: string;
}

const VOICES = ['Charon', 'Kore', 'Zephyr', 'Puck', 'Fenrir'] as const;

function base64FromInt16(int16: Int16Array): string {
  const bytes = new Uint8Array(int16.buffer, int16.byteOffset, int16.byteLength);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function int16FromBase64(b64: string): Int16Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    bytes[i] = bin.charCodeAt(i);
  }
  return new Int16Array(bytes.buffer);
}

function buildLiveWsUrl(voice: string, lang: string): string {
  const base = `${API_BASE}/ws/live`;
  if (base.startsWith('https://')) {
    return `wss://${base.slice('https://'.length)}?voice=${encodeURIComponent(voice)}&lang=${encodeURIComponent(lang)}`;
  }
  if (base.startsWith('http://')) {
    return `ws://${base.slice('http://'.length)}?voice=${encodeURIComponent(voice)}&lang=${encodeURIComponent(lang)}`;
  }
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${window.location.host}${base}?voice=${encodeURIComponent(voice)}&lang=${encodeURIComponent(lang)}`;
}

export const ShaheenLiveVoiceModal: React.FC<LiveVoiceModalProps> = ({
  open,
  onClose,
  currentLang,
}) => {
  const [status, setStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');
  const [voice, setVoice] = useState<(typeof VOICES)[number]>('Charon');
  const [muted, setMuted] = useState(false);
  const [textDraft, setTextDraft] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lines, setLines] = useState<TranscriptLine[]>([]);

  const wsRef = useRef<WebSocket | null>(null);
  const mutedRef = useRef(muted);
  mutedRef.current = muted;

  const micCtxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);

  const playCtxRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const activeSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  const txt = (ar: string, en: string) => pickArEn(currentLang, ar, en);

  const clearPlaybackQueue = useCallback(() => {
    for (const src of activeSourcesRef.current) {
      try {
        src.stop();
        src.disconnect();
      } catch {
        // ignore
      }
    }
    activeSourcesRef.current.clear();
    if (playCtxRef.current) {
      nextStartTimeRef.current = playCtxRef.current.currentTime;
    } else {
      nextStartTimeRef.current = 0;
    }
  }, []);

  const stopCall = useCallback(() => {
    clearPlaybackQueue();
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current.onaudioprocess = null;
      processorRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (micCtxRef.current) {
      void micCtxRef.current.close().catch(() => {});
      micCtxRef.current = null;
    }
    if (playCtxRef.current) {
      void playCtxRef.current.close().catch(() => {});
      playCtxRef.current = null;
    }
    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch {
        // ignore
      }
      wsRef.current = null;
    }
    setStatus('idle');
  }, [clearPlaybackQueue]);

  useEffect(() => {
    if (!open) {
      stopCall();
    }
  }, [open, stopCall]);

  useEffect(() => () => stopCall(), [stopCall]);

  const schedulePcm24k = useCallback((b64: string) => {
    const playCtx = playCtxRef.current;
    if (!playCtx) return;
    if (playCtx.state === 'suspended') void playCtx.resume();

    const int16 = int16FromBase64(b64);
    if (int16.length === 0) return;

    const float32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) {
      float32[i] = int16[i] / 32768;
    }

    const buffer = playCtx.createBuffer(1, float32.length, 24000);
    buffer.copyToChannel(float32, 0);

    const src = playCtx.createBufferSource();
    src.buffer = buffer;
    src.connect(playCtx.destination);

    const now = playCtx.currentTime;
    const startAt = Math.max(now, nextStartTimeRef.current);
    nextStartTimeRef.current = startAt + buffer.duration;

    activeSourcesRef.current.add(src);
    src.onended = () => {
      activeSourcesRef.current.delete(src);
    };
    src.start(startAt);
  }, []);

  const appendTranscript = useCallback((role: 'user' | 'shahin', text: string) => {
    const clean = text.trim();
    if (!clean) return;
    setLines((prev) => {
      const last = prev[prev.length - 1];
      if (last && last.role === role) {
        return [...prev.slice(0, -1), { ...last, text: `${last.text} ${clean}` }];
      }
      return [...prev, { id: `${Date.now()}-${Math.random()}`, role, text: clean }].slice(-24);
    });
  }, []);

  const startCall = async () => {
    if (isStaticHosting) {
      setErrorMsg(txt('المكالمات الصوتية المباشرة غير متاحة في الاستضافة الثابتة.', 'Live voice requires server runtime.'));
      setStatus('error');
      return;
    }
    stopCall();
    setErrorMsg(null);
    setLines([]);
    setStatus('connecting');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      streamRef.current = stream;

      const micCtx = new AudioContext({ sampleRate: 16000 });
      const playCtx = new AudioContext({ sampleRate: 24000 });
      micCtxRef.current = micCtx;
      playCtxRef.current = playCtx;
      nextStartTimeRef.current = playCtx.currentTime;

      const ws = new WebSocket(buildLiveWsUrl(voice, currentLang));
      wsRef.current = ws;

      ws.onopen = () => {
        const source = micCtx.createMediaStreamSource(stream);
        const processor = micCtx.createScriptProcessor(4096, 1, 1);
        processorRef.current = processor;

        processor.onaudioprocess = (ev) => {
          const socket = wsRef.current;
          if (!socket || socket.readyState !== WebSocket.OPEN || mutedRef.current) return;
          const input = ev.inputBuffer.getChannelData(0);
          const int16 = new Int16Array(input.length);
          for (let i = 0; i < input.length; i++) {
            const s = Math.max(-1, Math.min(1, input[i]));
            int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
          }
          socket.send(JSON.stringify({ type: 'audio', data: base64FromInt16(int16) }));
        };

        source.connect(processor);
        processor.connect(micCtx.destination);
      };

      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(String(ev.data)) as {
            type?: string;
            data?: string;
            text?: string;
            message?: string;
          };
          if (msg.type === 'ready') {
            setStatus('connected');
          } else if (msg.type === 'audio' && msg.data) {
            schedulePcm24k(msg.data);
          } else if (msg.type === 'interrupted') {
            clearPlaybackQueue();
          } else if (msg.type === 'inputTranscript' && msg.text) {
            appendTranscript('user', msg.text);
          } else if (msg.type === 'outputTranscript' && msg.text) {
            appendTranscript('shahin', msg.text);
          } else if (msg.type === 'error') {
            setErrorMsg(msg.message || txt('حدث خطأ في الاتصال الصوتي', 'Voice connection error'));
            setStatus('error');
          }
        } catch {
          // ignore malformed server frame
        }
      };

      ws.onerror = () => {
        setErrorMsg(txt('تعذر إتمام اتصال الصوت المباشر.', 'Live voice connection failed.'));
        setStatus('error');
      };

      ws.onclose = () => {
        setStatus((prev) => (prev === 'error' ? 'error' : 'idle'));
      };
    } catch {
      setErrorMsg(txt('يرجى السماح بالوصول إلى الميكروفون لبدء المكالمة.', 'Please allow microphone access to start the call.'));
      setStatus('error');
    }
  };

  const toggleMute = () => {
    setMuted((prev) => {
      const next = !prev;
      if (next && wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'audioStreamEnd' }));
      }
      return next;
    });
  };

  const sendLiveText = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = textDraft.trim();
    if (!clean || wsRef.current?.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ type: 'text', text: clean }));
    appendTranscript('user', clean);
    setTextDraft('');
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={() => {
        stopCall();
        onClose();
      }}
    >
      <div
        className="w-full max-w-xl rounded-3xl bg-white border border-stone-200 shadow-2xl overflow-hidden flex flex-col max-h-[88vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 bg-stone-900 text-white flex items-center justify-between border-b border-stone-800">
          <div className="flex items-center gap-3">
            <span className="w-9 h-9 rounded-2xl bg-amber-600 text-white flex items-center justify-center">
              <Volume2 className="w-5 h-5" />
            </span>
            <div>
              <h3 className="font-black text-sm sm:text-base">
                {txt('مكالمة صوتية مباشرة مع الخبير شاهين', 'Live Voice Consultation — Master Shahin')}
              </h3>
              <p className="text-[11px] text-amber-300">
                {status === 'connected'
                  ? txt('متصل الآن · تحدث بحرية ويمكنك مقاطعة شاهين في أي لحظة', 'Connected · Speak naturally anytime')
                  : status === 'connecting'
                  ? txt('جاري فتح الخط الصوتي المباشر…', 'Opening real-time voice channel…')
                  : txt('محادثة صوتية ثنائية الاتجاه في الزمن الحقيقي', 'Two-way real-time voice dialogue')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              stopCall();
              onClose();
            }}
            className="p-1.5 rounded-full text-stone-400 hover:text-white cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Voice Controls Strip */}
        <div className="p-4 bg-stone-50 border-b border-stone-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-stone-700">{txt('نبرة الصوت:', 'Voice:')}</label>
            <select
              value={voice}
              disabled={status === 'connected' || status === 'connecting'}
              onChange={(e) => setVoice(e.target.value as (typeof VOICES)[number])}
              className="px-2.5 py-1.5 rounded-xl bg-white border border-stone-200 text-xs font-semibold text-stone-800 disabled:opacity-60"
            >
              {VOICES.map((v) => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            {status === 'connected' || status === 'connecting' ? (
              <>
                <button
                  type="button"
                  onClick={toggleMute}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 border cursor-pointer ${
                    muted
                      ? 'bg-rose-50 text-rose-700 border-rose-300'
                      : 'bg-white text-stone-800 border-stone-300 hover:bg-stone-100'
                  }`}
                >
                  {muted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4 text-emerald-600" />}
                  <span>{muted ? txt('كتم نشط', 'Muted') : txt('الميكروفون', 'Mic Active')}</span>
                </button>
                <button
                  type="button"
                  onClick={stopCall}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <PhoneOff className="w-4 h-4" />
                  <span>{txt('إنهاء المكالمة', 'End Call')}</span>
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => void startCall()}
                className="px-5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-black flex items-center gap-2 shadow-sm cursor-pointer"
              >
                <Phone className="w-4 h-4" />
                <span>{txt('بدء المكالمة الصوتية', 'Start Live Call')}</span>
              </button>
            )}
          </div>
        </div>

        {/* Live Transcript Feed */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5 min-h-[220px] bg-white">
          {status === 'connecting' && (
            <div className="flex items-center justify-center gap-2 py-8 text-xs text-amber-800 font-semibold">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>{txt('جاري الاتصال بالخبير شاهين…', 'Connecting to Master Shahin…')}</span>
            </div>
          )}

          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800">
              {errorMsg}
            </div>
          )}

          {lines.length === 0 && status !== 'connecting' && !errorMsg && (
            <div className="text-center py-10 text-xs text-stone-500">
              {status === 'connected'
                ? txt('تحدث الآن عبر الميكروفون… ستظهر ترجمة الحوار هنا لحظياً.', 'Speak into your mic… live transcription appears here.')
                : txt('اضغط «بدء المكالمة الصوتية» للحديث المباشر مع شاهين عن أي تركيبة.', 'Click "Start Live Call" to speak directly with Shahin about any blend.')}
            </div>
          )}

          {lines.map((line) => (
            <div
              key={line.id}
              className={`p-3 rounded-2xl text-xs leading-relaxed ${
                line.role === 'user'
                  ? 'bg-amber-900 text-white ms-8'
                  : 'bg-stone-100 text-stone-900 me-8 border border-stone-200'
              }`}
            >
              <div className="text-[10px] font-bold opacity-75 mb-0.5">
                {line.role === 'user' ? txt('أنت', 'You') : txt('الخبير شاهين', 'Master Shahin')}
              </div>
              <div>{line.text}</div>
            </div>
          ))}
        </div>

        {/* Optional Quick Text Input during active call */}
        {status === 'connected' && (
          <form onSubmit={sendLiveText} className="p-3 bg-stone-50 border-t border-stone-200 flex items-center gap-2">
            <input
              type="text"
              value={textDraft}
              onChange={(e) => setTextDraft(e.target.value)}
              placeholder={txt('أو أرسل سطراً نصياً داخل المكالمة…', 'Or type a quick note into the live call…')}
              className="flex-1 px-3 py-2 rounded-xl bg-white border border-stone-200 text-xs text-stone-900 focus:outline-none focus:border-amber-700"
            />
            <button
              type="submit"
              disabled={!textDraft.trim()}
              className="px-3.5 py-2 rounded-xl bg-stone-900 hover:bg-amber-900 disabled:opacity-40 text-white text-xs font-bold flex items-center gap-1 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
