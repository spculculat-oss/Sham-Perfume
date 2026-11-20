import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Award,
  CheckCircle2,
  Droplets,
  Flame,
  Pause,
  Play,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Trophy,
  Undo2,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { SupportedLanguage } from '../types/i18n';
import { pickArEn } from '../لغات/localize';

type GameState = 'TITLE_MENU' | 'PLAYING' | 'PAUSED' | 'ROUND_SUMMARY' | 'GAME_OVER';
type LayerType = 'top' | 'heart' | 'base';

interface NoteIngredient {
  id: string;
  nameAr: string;
  nameEn: string;
  layer: LayerType;
  ifraLoad: number;
  color: string;
}

const GAME_INGREDIENTS: NoteIngredient[] = [
  { id: 'bergamot', nameAr: 'برغموت كالابريا', nameEn: 'Bergamot', layer: 'top', ifraLoad: 4, color: 'bg-lime-500' },
  { id: 'lemon', nameAr: 'قشر الليمون الأخضر', nameEn: 'Green Zest', layer: 'top', ifraLoad: 3, color: 'bg-yellow-400' },
  { id: 'cardamom', nameAr: 'هيل أخضر', nameEn: 'Cardamom', layer: 'top', ifraLoad: 2, color: 'bg-emerald-500' },
  { id: 'taif_rose', nameAr: 'ورد طائفي', nameEn: 'Taif Rose', layer: 'heart', ifraLoad: 4, color: 'bg-rose-500' },
  { id: 'jasmine', nameAr: 'ياسمين شامي', nameEn: 'Damask Jasmine', layer: 'heart', ifraLoad: 6, color: 'bg-pink-400' },
  { id: 'saffron', nameAr: 'زعفران ملكي', nameEn: 'Royal Saffron', layer: 'heart', ifraLoad: 3, color: 'bg-orange-500' },
  { id: 'oud', nameAr: 'عود كمبودي معتق', nameEn: 'Aged Oud', layer: 'base', ifraLoad: 5, color: 'bg-amber-800' },
  { id: 'frankincense', nameAr: 'لبان حوجري', nameEn: 'Hojari Resin', layer: 'base', ifraLoad: 2, color: 'bg-amber-600' },
  { id: 'ambergris', nameAr: 'عنبر أبيض نقي', nameEn: 'White Amber', layer: 'base', ifraLoad: 1, color: 'bg-stone-600' },
];

interface VipOrder {
  id: string;
  clientAr: string;
  clientEn: string;
  briefAr: string;
  briefEn: string;
  targetTop: number;
  targetHeart: number;
  targetBase: number;
  maxDrops: number;
  ifraCeiling: number;
  timeLimitSec: number;
}

const VIP_ORDERS: VipOrder[] = [
  {
    id: 'o1',
    clientAr: 'الأمير نواف — مجلس المساء',
    clientEn: 'Royal Evening Majlis',
    briefAr: 'توليفة عود وورد متوازنة بافتتاحية حمضية خفيفة',
    briefEn: 'Balanced Oud & Rose accord with bright citrus top',
    targetTop: 20,
    targetHeart: 40,
    targetBase: 40,
    maxDrops: 10,
    ifraCeiling: 45,
    timeLimitSec: 45,
  },
  {
    id: 'o2',
    clientAr: 'بوتيك غراس الصيفي',
    clientEn: 'Grasse Summer Boutique',
    briefAr: 'كولونيا نضرة سريعة التطاير مع قلب ياسمين ناعم',
    briefEn: 'Crisp Citrus Cologne grounded by light Jasmine heart',
    targetTop: 50,
    targetHeart: 30,
    targetBase: 20,
    maxDrops: 10,
    ifraCeiling: 42,
    timeLimitSec: 40,
  },
  {
    id: 'o3',
    clientAr: 'دار ظفار للبخور النادر',
    clientEn: 'Dhofar Rare Incense House',
    briefAr: 'أكورد لباني ثقيل طويل الثبات لليالي الشتاء',
    briefEn: 'Deep resinous Extrait with commanding frankincense base',
    targetTop: 10,
    targetHeart: 30,
    targetBase: 60,
    maxDrops: 10,
    ifraCeiling: 40,
    timeLimitSec: 40,
  },
  {
    id: 'o4',
    clientAr: 'معرض ميلانو للنيش',
    clientEn: 'Milan Niche Exhibition',
    briefAr: 'عطر زهري تبلي متناغم في طبقاته الثلاث',
    briefEn: 'Harmonic floral-spice architecture across all tiers',
    targetTop: 30,
    targetHeart: 40,
    targetBase: 30,
    maxDrops: 10,
    ifraCeiling: 38,
    timeLimitSec: 35,
  },
];

const HIGH_SCORE_KEY = 'sham_perfumer_game_highscore';

export const PerfumerAtelierGame: React.FC<{ currentLang: SupportedLanguage }> = ({
  currentLang,
}) => {
  const [gameState, setGameState] = useState<GameState>('TITLE_MENU');
  const [roundIdx, setRoundIdx] = useState(0);
  const [drops, setDrops] = useState<NoteIngredient[]>([]);
  const [timeLeft, setTimeLeft] = useState(VIP_ORDERS[0].timeLimitSec);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [lastRoundResult, setLastRoundResult] = useState<{
    accuracy: number;
    ifraSafe: boolean;
    earned: number;
  } | null>(null);
  const [muted, setMuted] = useState(false);
  const [highScore, setHighScore] = useState<number>(() => {
    try {
      return Number(localStorage.getItem(HIGH_SCORE_KEY) || 0) || 0;
    } catch {
      return 0;
    }
  });

  const audioCtxRef = useRef<AudioContext | null>(null);

  const playTone = useCallback(
    (freq: number, dur = 0.09, type: OscillatorType = 'sine', vol = 0.08) => {
      if (muted || typeof window === 'undefined') return;
      try {
        const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctx) return;
        if (!audioCtxRef.current) audioCtxRef.current = new Ctx();
        const ctx = audioCtxRef.current;
        if (ctx.state === 'suspended') void ctx.resume();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, ctx.currentTime);
        gain.gain.setValueAtTime(vol, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + dur);
      } catch {
        // Ignore audio errors
      }
    },
    [muted],
  );

  const txt = (ar: string, en: string) => pickArEn(currentLang, ar, en);
  const currentOrder = VIP_ORDERS[roundIdx % VIP_ORDERS.length];

  const stats = useMemo(() => {
    const total = drops.length;
    const topCount = drops.filter((d) => d.layer === 'top').length;
    const heartCount = drops.filter((d) => d.layer === 'heart').length;
    const baseCount = drops.filter((d) => d.layer === 'base').length;
    const topPct = total ? Math.round((topCount / total) * 100) : 0;
    const heartPct = total ? Math.round((heartCount / total) * 100) : 0;
    const basePct = total ? 100 - topPct - heartPct : 0;
    const ifraLoad = drops.reduce((sum, d) => sum + d.ifraLoad, 0);
    return { total, topPct, heartPct, basePct, ifraLoad };
  }, [drops]);

  useEffect(() => {
    if (gameState !== 'PLAYING') return;
    const id = window.setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          playTone(210, 0.35, 'sawtooth', 0.08);
          setGameState('GAME_OVER');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [gameState, playTone]);

  useEffect(() => {
    if (score > highScore) {
      setHighScore(score);
      try {
        localStorage.setItem(HIGH_SCORE_KEY, String(score));
      } catch {
        // ignore storage failure
      }
    }
  }, [score, highScore]);

  const startNewGame = () => {
    setRoundIdx(0);
    setDrops([]);
    setScore(0);
    setStreak(0);
    setTimeLeft(VIP_ORDERS[0].timeLimitSec);
    setLastRoundResult(null);
    setGameState('PLAYING');
    playTone(523.25, 0.14, 'triangle', 0.1);
  };

  const addDrop = (ing: NoteIngredient) => {
    if (gameState !== 'PLAYING' || drops.length >= currentOrder.maxDrops) return;
    setDrops((prev) => [...prev, ing]);
    const freqMap: Record<LayerType, number> = { top: 680, heart: 510, base: 340 };
    playTone(freqMap[ing.layer] + drops.length * 18, 0.08, 'sine', 0.09);
  };

  const undoDrop = () => {
    if (gameState !== 'PLAYING' || drops.length === 0) return;
    setDrops((prev) => prev.slice(0, -1));
    playTone(280, 0.06, 'sine', 0.05);
  };

  const submitBlend = () => {
    if (gameState !== 'PLAYING' || drops.length === 0) return;
    const diff =
      Math.abs(stats.topPct - currentOrder.targetTop) +
      Math.abs(stats.heartPct - currentOrder.targetHeart) +
      Math.abs(stats.basePct - currentOrder.targetBase);
    const accuracy = Math.max(0, Math.round(100 - diff / 2));
    const ifraSafe = stats.ifraLoad <= currentOrder.ifraCeiling;

    let earned = accuracy * (ifraSafe ? 2 : 1) + (accuracy >= 85 ? timeLeft * 3 : 0);
    if (drops.length < currentOrder.maxDrops) {
      earned = Math.round(earned * (drops.length / currentOrder.maxDrops));
    }

    const nextStreak = accuracy >= 75 && ifraSafe ? streak + 1 : 0;
    const multiplier = 1 + Math.min(2, nextStreak * 0.25);
    const totalEarned = Math.round(earned * multiplier);

    setScore((s) => s + totalEarned);
    setStreak(nextStreak);
    setLastRoundResult({ accuracy, ifraSafe, earned: totalEarned });
    setGameState('ROUND_SUMMARY');

    if (accuracy >= 75 && ifraSafe) {
      playTone(659.25, 0.12, 'triangle', 0.1);
      setTimeout(() => playTone(880, 0.18, 'triangle', 0.1), 110);
    } else {
      playTone(240, 0.2, 'sawtooth', 0.07);
    }
  };

  const nextRound = () => {
    const next = roundIdx + 1;
    setRoundIdx(next);
    setDrops([]);
    setLastRoundResult(null);
    const nextOrder = VIP_ORDERS[next % VIP_ORDERS.length];
    setTimeLeft(nextOrder.timeLimitSec);
    setGameState('PLAYING');
    playTone(587.33, 0.12, 'triangle', 0.09);
  };

  const layerLabel = (l: LayerType) =>
    l === 'top' ? txt('افتتاحية (Top)', 'Top') : l === 'heart' ? txt('قلب (Heart)', 'Heart') : txt('قاعدة (Base)', 'Base');

  return (
    <section className="max-w-5xl mx-auto space-y-5 animate-in fade-in">
      {/* Compact Game HUD Header */}
      <div className="bg-stone-900 text-white rounded-3xl px-5 py-4 border border-amber-500/30 shadow-lg flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-2xl bg-amber-600 text-white flex items-center justify-center shadow-sm">
            <Flame className="w-5 h-5" />
          </span>
          <div>
            <h2 className="text-base sm:text-lg font-black font-serif-luxury">
              {txt('تحدي مختبر العطور — إتقان الهرم والإيفرا', 'Master Blender Challenge — Pyramid & IFRA')}
            </h2>
            <p className="text-[11px] text-amber-300">
              {txt('المرحلة', 'Round')} #{roundIdx + 1} · {txt('أعلى نتيجة:', 'Best:')} <span className="font-mono font-bold">{highScore}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="px-3.5 py-1.5 rounded-xl bg-stone-950 border border-stone-800 text-xs font-mono flex items-center gap-2">
            <Trophy className="w-4 h-4 text-amber-400" />
            <span className="font-bold text-amber-300">{score}</span>
            {streak > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-600 text-white">x{streak}</span>}
          </div>

          {gameState === 'PLAYING' && (
            <div className={`px-3.5 py-1.5 rounded-xl border text-xs font-mono font-bold ${
              timeLeft <= 10 ? 'bg-rose-950 border-rose-500 text-rose-300' : 'bg-stone-950 border-stone-800 text-white'
            }`}>
              {timeLeft}s
            </div>
          )}

          {(gameState === 'PLAYING' || gameState === 'PAUSED') && (
            <button
              type="button"
              onClick={() => setGameState((g) => (g === 'PLAYING' ? 'PAUSED' : 'PLAYING'))}
              className="p-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 cursor-pointer"
              title={gameState === 'PLAYING' ? txt('إيقاف مؤقت', 'Pause') : txt('استئناف', 'Resume')}
            >
              {gameState === 'PLAYING' ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </button>
          )}

          <button
            type="button"
            onClick={() => setMuted((m) => !m)}
            className="p-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 cursor-pointer"
            title={muted ? txt('تشغيل الصوت', 'Unmute') : txt('كتم الصوت', 'Mute')}
          >
            {muted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-amber-400" />}
          </button>
        </div>
      </div>

      {/* Main Playable Canvas Board */}
      <div className="relative bg-white rounded-3xl border border-stone-200 p-5 sm:p-6 shadow-md min-h-[480px] flex flex-col justify-between gap-5 overflow-hidden">
        {gameState === 'TITLE_MENU' && (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-10 space-y-5 bg-gradient-to-b from-amber-50/70 to-white rounded-2xl border border-amber-200/70 p-6">
            <div className="w-16 h-16 rounded-3xl bg-amber-900 text-amber-300 flex items-center justify-center shadow-lg">
              <Sparkles className="w-8 h-8" />
            </div>
            <div className="space-y-2 max-w-lg">
              <h3 className="text-2xl font-black text-stone-900 font-serif-luxury">
                {txt('تحدي قطّارة العطار السريع', 'Sham Artisan Blending Challenge')}
              </h3>
              <p className="text-xs sm:text-sm text-stone-600 leading-relaxed">
                {txt(
                  'أمامك طلبات كبار العملاء: قطّر 10 قطرات لمطابقة نسب القمة والقلب والقاعدة المطلوبة دون تجاوز سقف حساسية IFRA قبل انتهاء المؤقت!',
                  'Fulfill VIP house briefs by dosing 10 fragrance drops to match the exact Top / Heart / Base pyramid ratios while staying under the IFRA safety ceiling.',
                )}
              </p>
            </div>
            <button
              type="button"
              onClick={startNewGame}
              className="px-7 py-3.5 rounded-2xl bg-amber-800 hover:bg-amber-900 text-white font-black text-sm shadow-lg flex items-center gap-2 cursor-pointer transition-transform active:scale-95"
            >
              <Play className="w-4 h-4" />
              <span>{txt('ابدأ المزج الآن', 'Start Blending')}</span>
            </button>
          </div>
        )}

        {(gameState === 'PLAYING' || gameState === 'PAUSED') && (
          <>
            {/* VIP Brief & Live Pyramid Gauges */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
              <div className="lg:col-span-7 p-4 rounded-2xl bg-amber-50/80 border border-amber-200 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-amber-950">
                    {currentLang === 'ar' ? currentOrder.clientAr : currentOrder.clientEn}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-lg bg-white border border-amber-300 text-[11px] font-bold text-amber-900 font-mono">
                    {drops.length} / {currentOrder.maxDrops} {txt('قطرة', 'drops')}
                  </span>
                </div>
                <p className="text-xs text-stone-700">
                  {currentLang === 'ar' ? currentOrder.briefAr : currentOrder.briefEn}
                </p>

                {/* Target vs Current Bars */}
                <div className="grid grid-cols-3 gap-2 pt-1 text-center text-[11px]">
                  {(
                    [
                      ['top', txt('قمة', 'Top'), stats.topPct, currentOrder.targetTop, 'bg-lime-600'],
                      ['heart', txt('قلب', 'Heart'), stats.heartPct, currentOrder.targetHeart, 'bg-rose-600'],
                      ['base', txt('قاعدة', 'Base'), stats.basePct, currentOrder.targetBase, 'bg-amber-800'],
                    ] as const
                  ).map(([k, lbl, cur, tgt, barColor]) => (
                    <div key={k} className="p-2 rounded-xl bg-white border border-stone-200 space-y-1">
                      <div className="font-bold text-stone-800">{lbl}</div>
                      <div className="font-mono text-xs font-black text-stone-950">
                        {cur}% <span className="text-stone-400">/ {tgt}%</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-stone-100 overflow-hidden">
                        <div className={`h-full ${barColor} transition-all`} style={{ width: `${Math.min(100, cur)}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* IFRA Safety & Flask Visual */}
              <div className="lg:col-span-5 p-4 rounded-2xl bg-stone-900 text-white flex flex-col justify-between gap-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 font-bold text-amber-300">
                    <ShieldCheck className="w-4 h-4" />
                    <span>{txt('مؤشر أمان IFRA', 'IFRA Safety Load')}</span>
                  </span>
                  <span className={`font-mono font-bold ${stats.ifraLoad > currentOrder.ifraCeiling ? 'text-rose-400' : 'text-emerald-400'}`}>
                    {stats.ifraLoad} / {currentOrder.ifraCeiling}
                  </span>
                </div>

                {/* Droplets in beaker */}
                <div className="flex flex-wrap gap-1.5 min-h-[42px] items-center p-2 rounded-xl bg-stone-950 border border-stone-800">
                  {drops.length === 0 ? (
                    <span className="text-[11px] text-stone-500">{txt('المخبار فارغ — اضغط على الزيوت للبدء', 'Flask empty — tap oils below')}</span>
                  ) : (
                    drops.map((d, idx) => (
                      <span
                        key={`${d.id}-${idx}`}
                        className={`w-6 h-6 rounded-full ${d.color} border border-white/40 inline-flex items-center justify-center text-[9px] font-bold text-stone-950`}
                        title={currentLang === 'ar' ? d.nameAr : d.nameEn}
                      >
                        {idx + 1}
                      </span>
                    ))
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={undoDrop}
                    disabled={drops.length === 0}
                    className="px-3 py-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 disabled:opacity-40 text-xs font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Undo2 className="w-3.5 h-3.5" />
                    <span>{txt('تراجع', 'Undo')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={submitBlend}
                    disabled={drops.length === 0}
                    className="flex-1 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{txt('اعتماد الخلطة للعميل', 'Deliver Blend')}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Tactile >= 48px Ingredient Droplet Palette */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {(['top', 'heart', 'base'] as LayerType[]).map((layer) => (
                <div key={layer} className="p-3 rounded-2xl border border-stone-200 bg-stone-50/70 space-y-2">
                  <div className="text-[11px] font-black text-stone-700 uppercase tracking-wide px-1">
                    {layerLabel(layer)}
                  </div>
                  <div className="space-y-2">
                    {GAME_INGREDIENTS.filter((i) => i.layer === layer).map((ing) => (
                      <button
                        key={ing.id}
                        type="button"
                        disabled={drops.length >= currentOrder.maxDrops}
                        onClick={() => addDrop(ing)}
                        className="w-full min-h-[48px] px-3 py-2 rounded-xl bg-white hover:bg-amber-50 border border-stone-200 hover:border-amber-400 disabled:opacity-45 flex items-center justify-between gap-2 text-xs font-bold text-stone-800 shadow-2xs cursor-pointer transition-all active:scale-98"
                      >
                        <span className="flex items-center gap-2">
                          <span className={`w-3 h-3 rounded-full ${ing.color} shrink-0`} />
                          <span>{currentLang === 'ar' ? ing.nameAr : ing.nameEn}</span>
                        </span>
                        <span className="text-[10px] font-mono text-stone-500 flex items-center gap-1">
                          <Droplets className="w-3 h-3 text-amber-700" />
                          IFRA {ing.ifraLoad}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {gameState === 'PAUSED' && (
              <div className="absolute inset-0 bg-stone-950/80 flex flex-col items-center justify-center gap-4 text-white z-20">
                <div className="text-xl font-black">{txt('اللعبة متوقفة مؤقتاً', 'Game Paused')}</div>
                <button
                  type="button"
                  onClick={() => setGameState('PLAYING')}
                  className="px-6 py-3 rounded-2xl bg-amber-600 hover:bg-amber-500 font-black text-xs flex items-center gap-2 cursor-pointer"
                >
                  <Play className="w-4 h-4" />
                  <span>{txt('متابعة المزج', 'Resume Blending')}</span>
                </button>
              </div>
            )}
          </>
        )}

        {gameState === 'ROUND_SUMMARY' && lastRoundResult && (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-8 space-y-5">
            <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <Award className="w-8 h-8" />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-xl font-black text-stone-900">
                {lastRoundResult.accuracy >= 80
                  ? txt('توازن عطري باهر!', 'Masterful Accord!')
                  : txt('تركيبة مقبولة — استمر بالتدقيق', 'Good Effort — Refine Ratios')}
              </h3>
              <p className="text-xs text-stone-600">
                {txt('تطابق الهرم العطري:', 'Pyramid Match:')} <strong>{lastRoundResult.accuracy}%</strong> ·{' '}
                {lastRoundResult.ifraSafe ? txt('مطابق لمعايير IFRA ✓', 'IFRA Compliant ✓') : txt('تجاوز سقف IFRA!', 'IFRA Limit Exceeded!')}
              </p>
              <div className="text-lg font-black text-amber-800 font-mono">
                +{lastRoundResult.earned} {txt('نقطة', 'pts')}
              </div>
            </div>
            <button
              type="button"
              onClick={nextRound}
              className="px-6 py-3 rounded-2xl bg-stone-900 hover:bg-amber-900 text-white font-bold text-xs cursor-pointer"
            >
              {txt('الطلب التالي →', 'Next VIP Brief →')}
            </button>
          </div>
        )}

        {gameState === 'GAME_OVER' && (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-8 space-y-5">
            <div className="w-14 h-14 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center">
              <Trophy className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <h3 className="text-xl font-black text-stone-900">{txt('انتهى الوقت!', 'Time Up!')}</h3>
              <p className="text-xs text-stone-600">
                {txt('مجموع نقاطك النهائي:', 'Final Score:')} <strong className="font-mono text-amber-800">{score}</strong>
              </p>
            </div>
            <button
              type="button"
              onClick={startNewGame}
              className="px-6 py-3 rounded-2xl bg-amber-800 hover:bg-amber-900 text-white font-bold text-xs flex items-center gap-2 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>{txt('العب جولة جديدة', 'Play Again')}</span>
            </button>
          </div>
        )}
      </div>
    </section>
  );
};
