import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Clapperboard, Download, Loader2, Play, Plus, Sparkles, Square, Trash2 } from 'lucide-react';
import type { SupportedLanguage } from '../types/i18n';
import { errorKey } from '../workspace/workspaceApi';
import { wsText } from '../workspace/strings';
import { saveFile } from '../workspace/fileStore';
import { downloadBlob, safeFileName } from '../workspace/officeWriters';
import { ASPECT_SIZE, MOODS_LIST, MOTIONS, stylePrompt, totalSeconds, VIDEO_STYLES, visualPrompt, type Aspect, type Mood, type Motion, type Storyboard, type VideoStyle } from './storyboard';
import { canRecord, drawFrame, loadPicture, play, record, type Picture } from './videoMaker';
import { drawPicture, writeStoryboard } from './studioApi';
import type { T } from './StudioPanel';

const btn = 'inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-[12.5px] font-black cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed';
const soft = `${btn} border border-stone-200 bg-white text-stone-700 hover:border-amber-400`;
const strong = `${btn} bg-amber-800 text-white hover:bg-amber-900`;
const field = 'w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-[13px] focus:border-amber-500 focus:outline-none';
const select = 'rounded-lg border border-stone-200 bg-white px-2 py-1.5 text-[12.5px] font-bold';
const MOTION_ICON: Record<Motion, string> = { 'zoom-in': '🔍＋', 'zoom-out': '🔍－', 'pan-left': '⬅️', 'pan-right': '➡️', 'pan-up': '⬆️', still: '⏸' };
const ASPECT_KEY = { '16:9': 'a_wide', '9:16': 'a_tall', '1:1': 'a_square' } as const;

export function VideoPanel({ lang, st, ai }: { lang: SupportedLanguage; st: T; ai: boolean }) {
  const [idea, setIdea] = useState('');
  const [aspect, setAspect] = useState<Aspect>('16:9');
  const [style, setStyle] = useState<VideoStyle>('cinematic');
  const [mood, setMood] = useState<Mood>('epic');
  const [length, setLength] = useState(20);
  const [board, setBoard] = useState<Storyboard | null>(null);
  const [pictures, setPictures] = useState<Array<Picture | null>>([]);
  const [busy, setBusy] = useState<'' | 'story' | 'draw' | 'record'>('');
  const [progress, setProgress] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [music, setMusic] = useState(true);
  const [note, setNote] = useState('');
  const canvas = useRef<HTMLCanvasElement>(null);
  const stopRef = useRef<() => void>(() => {});
  const abort = useRef<AbortController | null>(null);
  useEffect(() => () => { stopRef.current(); abort.current?.abort(); }, []);

  // The still frame when not playing.
  useEffect(() => {
    if (playing || !board || !canvas.current) return;
    const [W, H] = ASPECT_SIZE[board.aspect];
    canvas.current.width = W; canvas.current.height = H;
    const ctx = canvas.current.getContext('2d');
    if (ctx) drawFrame(ctx, board, pictures, Math.min(3, totalSeconds(board.scenes) / 2));
  }, [board, pictures, playing]);

  const setScene = (i: number, patch: Partial<Storyboard['scenes'][number]>) => setBoard((b) => (b ? { ...b, scenes: b.scenes.map((s, j) => (j === i ? { ...s, ...patch } : s)) } : b));

  const drawScenes = useCallback(async (b: Storyboard, only?: number) => {
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    setBusy('draw'); setNote('');
    const [W, H] = ASPECT_SIZE[b.aspect];
    const pics: Array<Picture | null> = [...pictures];
    pics.length = b.scenes.length;
    let done = 0;
    const targets = b.scenes.map((_, i) => i).filter((i) => (only === undefined ? !pics[i] : i === only));
    setProgress(0);
    for (const i of targets) {
      if (controller.signal.aborted) break;
      try {
        const scene = b.scenes[i]!;
        const src = await drawPicture(`${stylePrompt(visualPrompt(scene.prompt), b.style)}, consistent characters`, Math.round(W * 1.15), Math.round(H * 1.15), controller.signal);
        pics[i] = await loadPicture(src, controller.signal);
        setPictures([...pics]);
      } catch (error) {
        if (!controller.signal.aborted) setNote(wsText(lang, errorKey(error)));
        break;
      }
      done += 1;
      setProgress(done / targets.length);
    }
    setBusy('');
  }, [lang, pictures]);

  const writeStory = async () => {
    if (!idea.trim() || busy) return;
    stopRef.current(); setPlaying(false);
    setBusy('story'); setNote('');
    try {
      const out = await writeStoryboard(idea.trim(), lang, { ai, aspect, style, mood, seconds: length });
      setBoard(out.board);
      setPictures([]);
      if (out.by === 'local') setNote(st('story_local'));
      setBusy('');
      void drawScenes(out.board);
    } catch (error) { setNote(wsText(lang, errorKey(error))); setBusy(''); }
  };

  const togglePlay = () => {
    if (!board || !canvas.current) return;
    if (playing) { stopRef.current(); setPlaying(false); return; }
    setPlaying(true);
    stopRef.current = play(canvas.current, board, pictures, { sound: music, onEnd: () => setPlaying(false) });
  };

  const recordVideo = async () => {
    if (!board || busy) return;
    if (!canRecord()) { setNote(st('no_recorder')); return; }
    stopRef.current(); setPlaying(false);
    const controller = new AbortController();
    abort.current = controller;
    setBusy('record'); setProgress(0); setNote('');
    try {
      const { blob, ext } = await record(board, pictures, { music, onProgress: setProgress, signal: controller.signal });
      const name = safeFileName(board.title || 'shaheen-video', ext);
      downloadBlob(blob, name);
      try { await saveFile(name, blob); } catch { /* too big for the browser's storage: the download is enough */ }
      setNote(st('video_ready'));
    } catch (error) {
      if (!controller.signal.aborted) setNote((error as Error)?.message === 'NO_RECORDER' ? st('no_recorder') : wsText(lang, 'failed'));
    }
    setBusy('');
  };

  const changeAspect = (a: Aspect) => { setAspect(a); if (board && board.aspect !== a) { setBoard({ ...board, aspect: a }); } };
  const total = board ? totalSeconds(board.scenes) : 0;

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-stone-200 bg-white p-3 space-y-2">
        <label className="block text-[13px] font-black text-stone-800" htmlFor="studio-idea">{st('idea')}</label>
        <textarea id="studio-idea" className={`${field} min-h-[84px]`} value={idea} onChange={(e) => setIdea(e.target.value)} placeholder={st('idea_ph')} maxLength={2000} />
        <div className="flex flex-wrap gap-2">
          <label className="flex items-center gap-1.5 text-[12px] font-bold text-stone-600">{st('aspect')}
            <select className={select} value={aspect} onChange={(e) => changeAspect(e.target.value as Aspect)}>{(['16:9', '9:16', '1:1'] as Aspect[]).map((a) => <option key={a} value={a}>{st(ASPECT_KEY[a])}</option>)}</select>
          </label>
          <label className="flex items-center gap-1.5 text-[12px] font-bold text-stone-600">{st('style')}
            <select className={select} value={style} onChange={(e) => { setStyle(e.target.value as VideoStyle); if (board) setBoard({ ...board, style: e.target.value as VideoStyle }); }}>{VIDEO_STYLES.map((s) => <option key={s} value={s}>{st(`s_${s}`)}</option>)}</select>
          </label>
          <label className="flex items-center gap-1.5 text-[12px] font-bold text-stone-600">{st('mood')}
            <select className={select} value={mood} onChange={(e) => { setMood(e.target.value as Mood); if (board) setBoard({ ...board, mood: e.target.value as Mood }); }}>{MOODS_LIST.map((m) => <option key={m} value={m}>{st(`m_${m}`)}</option>)}</select>
          </label>
          <label className="flex items-center gap-1.5 text-[12px] font-bold text-stone-600">{st('length')}
            <select className={select} value={length} onChange={(e) => setLength(Number(e.target.value))}>{[10, 15, 20, 30, 45, 60].map((n) => <option key={n} value={n}>{n}</option>)}</select>
          </label>
        </div>
        <button type="button" className={strong} onClick={writeStory} disabled={!idea.trim() || Boolean(busy)} data-testid="studio-story">
          {busy === 'story' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Clapperboard className="h-4 w-4" />}{st('write_story')}
        </button>
        <p className="text-[11.5px] leading-relaxed text-stone-500">{st('video_honest')}</p>
      </div>
      {note && <p className="rounded-xl bg-amber-50 px-3 py-2 text-[12.5px] font-bold text-amber-900" role="status">{note}</p>}

      {board && (
        <>
          <div className="rounded-2xl border border-stone-200 bg-stone-900 p-2 space-y-2">
            <div className="flex justify-center">
              <canvas ref={canvas} className="max-h-[480px] w-auto max-w-full rounded-lg bg-black" style={{ aspectRatio: board.aspect.replace(':', ' / ') }} data-testid="studio-canvas" />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" className={strong} onClick={togglePlay} disabled={busy === 'record'}>{playing ? <Square className="h-4 w-4" /> : <Play className="h-4 w-4" />}{playing ? st('pause') : st('play')}</button>
              <button type="button" className={soft} onClick={() => void recordVideo()} disabled={Boolean(busy)} data-testid="studio-record">
                {busy === 'record' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}{busy === 'record' ? st('recording', { p: Math.round(progress * 100) }) : st('record')}
              </button>
              <label className="inline-flex items-center gap-1.5 text-[12.5px] font-bold text-white"><input type="checkbox" checked={music} onChange={(e) => setMusic(e.target.checked)} />🎵 {st('music')}</label>
              <span className="text-[12px] font-bold text-stone-300" dir="ltr">{Math.round(total)}s</span>
              {busy === 'draw' && <span className="inline-flex items-center gap-1.5 text-[12px] font-bold text-amber-200"><Loader2 className="h-4 w-4 animate-spin" />{wsText(lang, 'drawing')} {Math.round(progress * 100)}%</span>}
            </div>
          </div>

          <div className="rounded-2xl border border-stone-200 bg-white p-3 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-[13px] font-black text-stone-800">{st('scenes')}</h3>
              <div className="flex gap-2">
                {board.scenes.some((_, i) => !pictures[i]) && busy !== 'draw' && <button type="button" className={soft} onClick={() => void drawScenes(board)}><Sparkles className="h-4 w-4" />{st('draw_scenes')}</button>}
                <button type="button" className={soft} disabled={board.scenes.length >= 16} onClick={() => setBoard({ ...board, scenes: [...board.scenes, { id: `sc${Date.now()}`, caption: '', prompt: board.scenes[board.scenes.length - 1]?.prompt || idea, seconds: 4, motion: 'zoom-in' }] })}><Plus className="h-4 w-4" />{st('add_scene')}</button>
              </div>
            </div>
            <ol className="space-y-2">
              {board.scenes.map((s, i) => (
                <li key={s.id} className="flex gap-2 rounded-xl border border-stone-200 p-2">
                  <div className="relative h-20 w-28 shrink-0 overflow-hidden rounded-lg bg-stone-200">
                    {pictures[i] ? <Thumb picture={pictures[i]!} /> : <span className="absolute inset-0 grid place-items-center text-[11px] font-black text-stone-500">{i + 1}</span>}
                  </div>
                  <div className="min-w-0 grow space-y-1.5">
                    <input className={field} value={s.caption} maxLength={160} placeholder={st('caption')} aria-label={st('caption')} onChange={(e) => setScene(i, { caption: e.target.value })} />
                    <input className={field} value={s.prompt} maxLength={500} placeholder={st('idea')} aria-label={st('idea')} onChange={(e) => setScene(i, { prompt: e.target.value })} />
                    <div className="flex flex-wrap items-center gap-1.5">
                      <select className={select} value={s.seconds} aria-label={st('seconds')} onChange={(e) => setScene(i, { seconds: Number(e.target.value) })}>{[...new Set([2, 3, 4, 5, 6, 8, 10, 12, s.seconds])].sort((x, y) => x - y).map((n) => <option key={n} value={n}>{n}s</option>)}</select>
                      <select className={select} value={s.motion} aria-label="motion" onChange={(e) => setScene(i, { motion: e.target.value as Motion })}>{MOTIONS.map((m) => <option key={m} value={m}>{MOTION_ICON[m]}</option>)}</select>
                      <button type="button" className={soft} disabled={Boolean(busy)} onClick={() => void drawScenes(board, i)}><Sparkles className="h-4 w-4" /></button>
                      <button type="button" aria-label={st('remove')} title={st('remove')} disabled={board.scenes.length < 2} className="rounded p-1.5 text-rose-600 hover:bg-rose-50 disabled:opacity-30 cursor-pointer"
                        onClick={() => { setBoard({ ...board, scenes: board.scenes.filter((_, j) => j !== i) }); setPictures(pictures.filter((_, j) => j !== i)); }}><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </>
      )}
    </div>
  );
}

function Thumb({ picture }: { picture: Picture }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    const ctx = c?.getContext('2d');
    if (!c || !ctx) return;
    c.width = 224; c.height = 160;
    const ratio = Math.max(224 / picture.width, 160 / picture.height);
    const w = picture.width * ratio; const h = picture.height * ratio;
    ctx.drawImage(picture, (224 - w) / 2, (160 - h) / 2, w, h);
  }, [picture]);
  return <canvas ref={ref} className="h-full w-full object-cover" />;
}
