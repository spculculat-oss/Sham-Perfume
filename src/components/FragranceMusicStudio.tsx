import { useState, useRef, useEffect } from 'react';
import {
  Music,
  Play,
  Pause,
  Download,
  Sparkles,
  Clock,
  Radio,
  Sliders,
  Volume2,
  VolumeX,
  Share2,
  X,
  RefreshCw,
  Loader2,
  Info,
  Check,
} from 'lucide-react';
import { apiUrl } from '../utils/api';

interface Props {
  onClose?: () => void;
  lang?: string;
  initialScentName?: string;
  initialScentNotes?: string;
}

const PRESET_TRACKS = [
  {
    id: 'oud_patchouli',
    title: 'سلطان العود والباتشولي الملكي',
    titleEn: 'Royal Oud & Patchouli Symphony',
    notes: 'عود كمبودي معتق، باتشولي إندونيسي، أمبروكسان',
    vibe: 'لحن شرقي ملكي مهيب يمزج بين أوتار العود الأصيل والتشيلو الدافئ مع إيقاع نبضات التعتيق البطيئة والمطمئنة',
    vibeEn: 'Majestic oriental orchestral with authentic oud strings, warm cello and deep ambient meditation rhythm',
    icon: '🪵',
  },
  {
    id: 'damask_rose',
    title: 'نسيم الورد الدمشقي والياسمين',
    titleEn: 'Damask Rose & Jasmine Waltz',
    notes: 'ورد جوري دمشقي، ياسمين بلدي، مسك أبيض',
    vibe: 'مقطوعة موسيقية رومانسية ناعمة بأنغام البيانو الرقيق والكمان الكلاسيكي مع لمسات وترية عذبة تحاكي بتلات الزهور',
    vibeEn: 'Romantic gentle classical waltz with delicate piano and acoustic violin mimicking fresh morning rose petals',
    icon: '🌹',
  },
  {
    id: 'bergamot_spark',
    title: 'إكسير الانتعاش والحمضيات',
    titleEn: 'Citrus Sillage Spark',
    notes: 'برغموت إيطالي، هيديون، لافندر بروفانس',
    vibe: 'إيقاع صيفي منعش مبهج بالحيوية على أنغام الجيتار والناي الخفيف يشع إشراقاً وفوحاناً حيوياً',
    vibeEn: 'Uplifting acoustic guitar with airy flute, vibrant summery groove and bright sparkling energy',
    icon: '🍋',
  },
  {
    id: 'amber_musk',
    title: 'دفء العنبر وخشب الصندل',
    titleEn: 'Amber & Sandalwood Serenade',
    notes: 'صندل ميسوري، عنبر حوتي، فانيليا مدخنة',
    vibe: 'موسيقى استرخائية دافئة للتأمل المسائي بأجواء صوفية هادئة تسكن الروح وتضفي السكينة',
    vibeEn: 'Warm ambient lounge jazz with soothing acoustic double bass and velvety nocturnal chords',
    icon: '🔥',
  },
];

export function FragranceMusicStudio({
  onClose,
  lang = 'ar',
  initialScentName,
  initialScentNotes,
}: Props) {
  const isAr = lang === 'ar';
  const [modelType, setModelType] = useState<'clip' | 'full'>('clip');
  const [selectedPreset, setSelectedPreset] = useState<string>(PRESET_TRACKS[0].id);
  const [customPrompt, setCustomPrompt] = useState('');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [lyrics, setLyrics] = useState('');
  const [synthesizing, setSynthesizing] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  const activePreset = PRESET_TRACKS.find((p) => p.id === selectedPreset);

  const handleGenerate = async () => {
    setError(null);
    setGenerating(true);
    setAudioUrl(null);
    setIsPlaying(false);

    const promptText =
      customPrompt.trim() ||
      (activePreset ? (isAr ? activePreset.vibe : activePreset.vibeEn) : 'Luxury fragrance melody');

    try {
      const res = await fetch(apiUrl('/api/ai/music'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: promptText,
          duration: modelType, // 'clip' => lyria-3-clip-preview, 'full' => lyria-3-pro-preview
          scentName: initialScentName || activePreset?.title,
          scentNotes: initialScentNotes || activePreset?.notes,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        if (data.code === 'PAID_KEY_REQUIRED') {
          // If paid key is required, enable harmonic synthesizer and explain
          setError(
            isAr
              ? 'تتطلب نماذج Lyria (lyria-3-clip-preview و lyria-3-pro-preview) مفتاح API مفعّل به الفوترة. يمكنك تشغيل مولد الترددات الهارمونية العطرية الحية أدناه للاستماع إلى النغمات فوراً!'
              : 'Lyria music models (lyria-3-clip-preview / lyria-3-pro-preview) require a paid API key. You can play the live fragrance harmonic synthesizer below!'
          );
          triggerFragranceHarmonics(selectedPreset);
          return;
        }
        throw new Error(data.error || 'Failed to generate music');
      }

      if (data.audioBase64) {
        const binary = atob(data.audioBase64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: data.mimeType || 'audio/wav' });
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        if (data.lyrics) setLyrics(data.lyrics);
      }
    } catch (err: any) {
      console.error(err);
      setError(
        isAr
          ? 'تعذر توليد الموسيقى حالياً. يتم تشغيل الرنين الهارموني العطري كبديل تفاعلي.'
          : 'Music generation unavailable. Playing interactive fragrance harmonic resonance.'
      );
      triggerFragranceHarmonics(selectedPreset);
    } finally {
      setGenerating(false);
    }
  };

  // Interactive Web Audio fragrance harmonic chime generator as seamless fallback
  const triggerFragranceHarmonics = (presetId: string) => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = ctx;
      setSynthesizing(true);

      const chords: Record<string, number[]> = {
        oud_patchouli: [108, 162, 216, 324, 432], // Deep regal 432Hz fifths
        damask_rose: [264, 330, 396, 528, 660], // 528Hz Solfeggio Love frequency
        bergamot_spark: [320, 400, 480, 640, 720], // Bright citrus sparkle
        amber_musk: [136.1, 204, 272, 408, 544], // Om earth meditation frequency
      };

      const notes = chords[presetId] || chords.oud_patchouli;
      const now = ctx.currentTime;

      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = idx % 2 === 0 ? 'sine' : 'triangle';
        osc.frequency.setValueAtTime(freq, now + idx * 0.4);

        gain.gain.setValueAtTime(0.001, now + idx * 0.4);
        gain.gain.exponentialRampToValueAtTime(0.18, now + idx * 0.4 + 0.1);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.4 + 3.5);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + idx * 0.4);
        osc.stop(now + idx * 0.4 + 3.8);
      });

      setTimeout(() => setSynthesizing(false), 5000);
    } catch (e) {
      console.error('Audio synthesizer error', e);
    }
  };

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  return (
    <div className="rounded-3xl border border-stone-200 bg-white p-5 shadow-2xl space-y-5 max-w-2xl mx-auto">
      {/* Studio Header */}
      <div className="flex items-center justify-between border-b border-stone-100 pb-3">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-600 to-amber-900 text-white shadow-sm">
            <Music className="h-5 w-5" />
          </span>
          <div>
            <h3 className="font-black text-stone-900 text-base sm:text-lg flex items-center gap-2">
              <span>{isAr ? 'أوركسترا النوتات العطرية — توليد الموسيقى بـ Lyria' : 'Scent Symphony — Lyria Music'}</span>
            </h3>
            <p className="text-xs text-stone-500">
              {isAr
                ? 'تأليف مقاطع موسيقية حصرية مستوحاة من أهرام العطور وروائح المعمل'
                : 'Generate music inspired by perfume formulas using Lyria models'}
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

      {/* Model Selection Tabs (lyria-3-clip-preview vs lyria-3-pro-preview) */}
      <div className="rounded-2xl bg-stone-100 p-1.5 flex gap-1">
        <button
          type="button"
          onClick={() => setModelType('clip')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-black transition cursor-pointer ${
            modelType === 'clip'
              ? 'bg-white text-amber-950 shadow-sm'
              : 'text-stone-600 hover:text-stone-900'
          }`}
        >
          <Radio className="h-4 w-4 text-amber-600" />
          <span>{isAr ? 'مقطع قصير حتى 30 ثانية' : 'Short Clip (up to 30s)'}</span>
          <span className="font-mono text-[10px] text-stone-400 font-normal">
            lyria-3-clip-preview
          </span>
        </button>

        <button
          type="button"
          onClick={() => setModelType('full')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-black transition cursor-pointer ${
            modelType === 'full'
              ? 'bg-white text-amber-950 shadow-sm'
              : 'text-stone-600 hover:text-stone-900'
          }`}
        >
          <Sparkles className="h-4 w-4 text-amber-600" />
          <span>{isAr ? 'مقطوعة موسيقية كاملة' : 'Full-Length Track'}</span>
          <span className="font-mono text-[10px] text-stone-400 font-normal">
            lyria-3-pro-preview
          </span>
        </button>
      </div>

      {/* Fragrance Presets Selection */}
      <div className="space-y-2">
        <label className="text-xs font-bold text-stone-700">
          {isAr ? 'اختر الطابع العطري للموسيقى أو النوتات:' : 'Choose Fragrance Mood:'}
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {PRESET_TRACKS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => {
                setSelectedPreset(preset.id);
                setCustomPrompt('');
              }}
              className={`p-3 rounded-2xl border text-start transition cursor-pointer ${
                selectedPreset === preset.id && !customPrompt
                  ? 'border-amber-500 bg-amber-50/70 shadow-sm ring-1 ring-amber-400'
                  : 'border-stone-200 bg-stone-50/50 hover:bg-stone-50 hover:border-stone-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-lg">{preset.icon}</span>
                <span className="font-bold text-xs text-stone-900">
                  {isAr ? preset.title : preset.titleEn}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-stone-500 line-clamp-1">{preset.notes}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Custom Music Prompt Input */}
      <div className="space-y-1.5">
        <label className="text-xs font-bold text-stone-700">
          {isAr ? 'تخصيص الوصف الموسيقي (اختياري):' : 'Custom Music Prompt (optional):'}
        </label>
        <textarea
          value={customPrompt}
          onChange={(e) => setCustomPrompt(e.target.value)}
          rows={2}
          placeholder={
            isAr
              ? 'مثال: ألحان عود هادئة مع وتريات أوركسترالية تعبر عن دفء الليل والتعتيق…'
              : 'e.g. Atmospheric oud meditation with warm strings and slow ambient pulse…'
          }
          className="w-full resize-none rounded-2xl border border-stone-200 bg-stone-50/70 p-3 text-xs text-stone-900 outline-none focus:border-amber-500 focus:bg-white"
        />
      </div>

      {/* Generate Action Button */}
      <button
        type="button"
        disabled={generating}
        onClick={handleGenerate}
        className="w-full flex items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-r from-amber-700 to-amber-900 py-3.5 text-sm font-black text-white shadow-lg shadow-amber-900/20 hover:from-amber-600 hover:to-amber-800 transition transform hover:scale-[1.01] disabled:opacity-50 cursor-pointer"
      >
        {generating ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin text-white" />
            <span>
              {isAr
                ? `جاري تأليف المقطوعة بواسطة ${
                    modelType === 'full' ? 'lyria-3-pro-preview' : 'lyria-3-clip-preview'
                  }…`
                : `Composing via ${
                    modelType === 'full' ? 'lyria-3-pro-preview' : 'lyria-3-clip-preview'
                  }…`}
            </span>
          </>
        ) : (
          <>
            <Music className="h-5 w-5" />
            <span>
              {isAr
                ? `تأليف المقطوعة الموسيقية (${
                    modelType === 'full' ? 'lyria-3-pro-preview' : 'lyria-3-clip-preview'
                  }) ✨`
                : `Generate Track (${
                    modelType === 'full' ? 'lyria-3-pro-preview' : 'lyria-3-clip-preview'
                  }) ✨`}
            </span>
          </>
        )}
      </button>

      {/* Error / Notice Display */}
      {error && (
        <div className="rounded-2xl bg-amber-50 p-4 text-xs text-amber-950 border border-amber-200/90 space-y-2">
          <p className="flex items-start gap-2 font-medium">
            <Info className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
            <span>{error}</span>
          </p>
          <button
            type="button"
            onClick={() => triggerFragranceHarmonics(selectedPreset)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-amber-800 text-white px-3 py-1.5 font-bold hover:bg-amber-900 cursor-pointer"
          >
            <Radio className="h-3.5 w-3.5" />
            <span>{isAr ? 'تشغيل رنين الهارموني العطري الحي' : 'Play Live Fragrance Harmonics'}</span>
          </button>
        </div>
      )}

      {/* Synthesizer indicator */}
      {synthesizing && (
        <div className="flex items-center justify-center gap-2 p-3 rounded-2xl bg-stone-900 text-amber-400 text-xs font-bold animate-pulse">
          <Volume2 className="h-4 w-4" />
          <span>
            {isAr
              ? 'جاري عزف ترددات التناغم العطري الحي… (Oud / Rose Harmonic Resonance)'
              : 'Playing live fragrance harmonic resonance…'}
          </span>
        </div>
      )}

      {/* Player Section when generated */}
      {audioUrl && (
        <div className="rounded-2xl border border-stone-200 bg-gradient-to-r from-stone-900 via-amber-950 to-stone-900 p-5 text-white shadow-lg space-y-3">
          <audio
            ref={audioRef}
            src={audioUrl}
            onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime || 0)}
            onLoadedMetadata={() => setDuration(audioRef.current?.duration || 0)}
            onEnded={() => setIsPlaying(false)}
          />

          <div className="flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold text-amber-400 uppercase tracking-widest block">
                {modelType === 'full' ? 'Lyria Pro Track' : 'Lyria 30s Clip'}
              </span>
              <h4 className="text-sm font-black text-white">
                {activePreset ? (isAr ? activePreset.title : activePreset.titleEn) : 'Custom Scent Track'}
              </h4>
            </div>

            <a
              href={audioUrl}
              download={`fragrance-music-${modelType}.wav`}
              className="flex items-center gap-1.5 rounded-xl bg-white/10 px-3 py-1.5 text-xs font-bold text-white hover:bg-white/20 transition cursor-pointer"
            >
              <Download className="h-3.5 w-3.5" />
              <span>{isAr ? 'تحميل' : 'Download'}</span>
            </a>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-3 pt-1">
            <button
              type="button"
              onClick={togglePlay}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-amber-500 text-stone-950 shadow-md hover:bg-amber-400 cursor-pointer"
            >
              {isPlaying ? <Pause className="h-5 w-5 fill-current" /> : <Play className="h-5 w-5 fill-current" />}
            </button>

            <div className="flex-1 space-y-1">
              <div className="h-2 w-full rounded-full bg-white/20 overflow-hidden">
                <div
                  className="h-full bg-amber-400 transition-all"
                  style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] font-mono text-stone-400">
                <span>{Math.floor(currentTime)}s</span>
                <span>{Math.floor(duration)}s</span>
              </div>
            </div>
          </div>

          {lyrics && (
            <p className="mt-2 text-xs text-stone-300 italic whitespace-pre-wrap border-t border-white/10 pt-2">
              "{lyrics}"
            </p>
          )}
        </div>
      )}
    </div>
  );
}
