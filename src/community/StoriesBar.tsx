/**
 * «القصص» — the Facebook-style stories strip of «مجتمع شام» (the merchant's AI Studio design, on real data).
 * Members share a picture and/or a short line for 24 hours; friends (or everyone, if chosen) see it, the author
 * sees who viewed it and can delete it. Nothing here is invented: an empty strip invites the first story.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Eye, Globe2, ImagePlus, Plus, Send, Trash2, Users, X } from 'lucide-react';
import { cx, resizeImage, type PublicUser, type StoryGroup } from './api';
import { Avatar, Btn, Sheet, Spinner, errorText, inputClass, timeAgo, tx, useLoad, type Lang } from './ui';

/** Text-only story backgrounds (the server accepts these names only). */
export const STORY_BG: Record<string, string> = {
  amber: 'from-amber-500 via-amber-700 to-stone-900',
  rose: 'from-rose-400 via-rose-700 to-stone-900',
  emerald: 'from-emerald-400 via-emerald-700 to-stone-900',
  sky: 'from-sky-400 via-sky-700 to-stone-900',
  violet: 'from-violet-400 via-violet-700 to-stone-900',
  stone: 'from-stone-500 via-stone-700 to-stone-950',
};
const STORY_MS = 6000;

export function StoriesBar({ lang, currentUser, onOpenMessenger, toast }: {
  lang: Lang; currentUser?: Pick<PublicUser, 'id' | 'name' | 'avatar'>; onOpenMessenger?: (userId: string) => void; toast: (s: string) => void;
}) {
  const t = tx(lang);
  const list = useLoad(() => cx<StoryGroup[]>('/community/stories'));
  const [open, setOpen] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const groups = list.data || [];
  const others = groups.filter((g) => !g.mine);
  const mine = groups.find((g) => g.mine);

  return (
    <>
      <div className="relative flex items-stretch gap-2.5 overflow-x-auto pb-1 pt-1 no-scrollbar" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
        {/* Create / my story */}
        <button type="button" onClick={() => (mine ? setOpen(groups.indexOf(mine)) : setAdding(true))}
          className="group relative flex h-48 w-32 shrink-0 cursor-pointer flex-col overflow-hidden rounded-2xl border border-stone-200 bg-white text-start shadow-sm transition hover:-translate-y-1 hover:shadow-md">
          <div className="relative h-32 w-full overflow-hidden bg-stone-100">
            {mine?.items.at(-1)?.image || currentUser?.avatar ? (
              <img loading="lazy" decoding="async" src={mine?.items.at(-1)?.image || currentUser?.avatar || ''} alt="" className="h-full w-full object-cover transition duration-300 group-hover:scale-105" />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-amber-500 to-amber-800 text-3xl font-black text-white">{currentUser?.name?.[0] || '✨'}</div>
            )}
            <div className="absolute inset-0 bg-stone-900/10 group-hover:bg-transparent" />
          </div>
          <div className="relative flex flex-1 flex-col items-center justify-center bg-white px-1 text-center">
            <span onClick={(e) => { e.stopPropagation(); setAdding(true); }}
              className="-mt-5 flex h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-amber-600 text-white shadow transition group-hover:bg-amber-700"><Plus className="h-5 w-5" /></span>
            <span className="mt-1 text-[11px] font-bold text-stone-900">{mine ? t('قصتك', 'Your story') : t('إضافة قصة', 'Add story')}</span>
          </div>
        </button>

        {list.loading && !groups.length && <div className="flex w-32 shrink-0 items-center justify-center"><Spinner /></div>}

        {others.map((g) => {
          const cover = g.items.find((s) => !s.seen) || g.items[g.items.length - 1];
          return (
            <button key={g.user.id} type="button" onClick={() => setOpen(groups.indexOf(g))}
              className="group relative flex h-48 w-32 shrink-0 cursor-pointer flex-col justify-between overflow-hidden rounded-2xl text-start shadow-sm transition hover:-translate-y-1 hover:shadow-md">
              {cover.image
                ? <img loading="lazy" decoding="async" src={cover.image} alt="" className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-110" />
                : <div className={`absolute inset-0 bg-gradient-to-br ${STORY_BG[cover.bg] || STORY_BG.amber}`} />}
              <div className="absolute inset-0 bg-gradient-to-b from-stone-900/50 via-transparent to-stone-950/85" />
              <div className="relative z-10 p-2.5">
                <span className={`inline-block rounded-full ring-2 ring-offset-2 ring-offset-stone-900 ${g.seen ? 'ring-stone-400' : 'ring-amber-400'}`}><Avatar user={g.user} size={36} /></span>
              </div>
              <div className="relative z-10 p-2.5">
                {!cover.image && cover.caption && <p className="mb-1 line-clamp-3 text-xs font-bold leading-tight text-white drop-shadow">{cover.caption}</p>}
                <span className="block truncate text-[11px] font-bold text-white drop-shadow">{g.user.name.split(' ')[0]}</span>
                <span className="block text-[10px] text-stone-300">{timeAgo(g.latest, lang)}</span>
              </div>
            </button>
          );
        })}

        {!list.loading && !others.length && (
          <div className="flex h-48 min-w-56 flex-1 shrink-0 flex-col items-center justify-center rounded-2xl border border-dashed border-amber-300 bg-amber-50/60 p-4 text-center">
            <span className="text-2xl">📸</span>
            <p className="mt-1 text-xs font-bold text-amber-900">{t('مفيش قصص من أصدقائك لسه', 'No stories from friends yet')}</p>
            <p className="mt-1 text-[11px] leading-relaxed text-stone-600">{t('شارك صورة من معملك أو تجربة عطر — بتفضل ٢٤ ساعة وبعدين تختفي.', 'Share a photo from your lab or a scent test — it stays 24 hours.')}</p>
            {list.error ? <p className="mt-1 text-[11px] text-rose-700">{errorText(list.error, lang)}</p> : null}
          </div>
        )}
      </div>

      {open !== null && groups[open] && (
        <StoryViewer lang={lang} groups={groups} start={open} onClose={() => { setOpen(null); void list.reload(true); }}
          onReply={(id) => { setOpen(null); onOpenMessenger?.(id); }} toast={toast} />
      )}
      {adding && <StoryComposer lang={lang} onClose={() => setAdding(false)} onDone={() => { setAdding(false); toast(t('اتنشرت قصتك ✨', 'Story shared ✨')); void list.reload(true); }} toast={toast} />}
    </>
  );
}

function StoryViewer({ lang, groups, start, onClose, onReply, toast }: { lang: Lang; groups: StoryGroup[]; start: number; onClose: () => void; onReply: (userId: string) => void; toast: (s: string) => void }) {
  const t = tx(lang);
  const [g, setG] = useState(start);
  const [i, setI] = useState(() => Math.max(0, groups[start].items.findIndex((s) => !s.seen)));
  const [paused, setPaused] = useState(false);
  const [viewers, setViewers] = useState<(PublicUser & { seenAt: string })[] | null>(null);
  const [deleted, setDeleted] = useState<Set<string>>(new Set());
  const group = groups[g];
  const items = group.items.filter((s) => !deleted.has(s.id));
  const story = items[Math.min(i, items.length - 1)];
  const seen = useRef(new Set<string>());

  const next = useCallback(() => {
    if (i < items.length - 1) setI(i + 1);
    else if (g < groups.length - 1) { setG(g + 1); setI(0); }
    else onClose();
  }, [i, items.length, g, groups.length, onClose]);
  const prev = () => { if (i > 0) setI(i - 1); else if (g > 0) { setG(g - 1); setI(0); } };

  useEffect(() => {
    if (!story) { onClose(); return; }
    if (!group.mine && !seen.current.has(story.id)) { seen.current.add(story.id); void cx(`/community/stories/${story.id}/seen`, { body: {} }).catch(() => undefined); }
    if (paused) return;
    const id = setTimeout(next, STORY_MS);
    return () => clearTimeout(id);
  }, [story, paused, next, group.mine, onClose]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [onClose]);
  if (!story) return null;

  const showViewers = async () => {
    setPaused(true);
    try { setViewers(await cx(`/community/stories/${story.id}/viewers`)); } catch (e) { toast(errorText(e, lang)); }
  };
  const remove = async () => {
    try { await cx(`/community/stories/${story.id}`, { method: 'DELETE' }); setDeleted((s) => new Set(s).add(story.id)); toast(t('اتمسحت القصة', 'Story deleted')); } catch (e) { toast(errorText(e, lang)); }
  };

  return (
    <div className="fixed inset-0 z-[75] flex items-center justify-center bg-stone-950/90 p-2 backdrop-blur-md sm:p-4" onClick={onClose}>
      <div className="relative flex h-[85vh] max-h-[720px] w-full max-w-sm flex-col overflow-hidden rounded-3xl bg-stone-900 shadow-2xl" onClick={(e) => e.stopPropagation()}
        onPointerDown={() => setPaused(true)} onPointerUp={() => !viewers && setPaused(false)}>
        {story.image
          ? <img loading="lazy" decoding="async" src={story.image} alt="" className="absolute inset-0 h-full w-full object-contain" />
          : <div className={`absolute inset-0 bg-gradient-to-br ${STORY_BG[story.bg] || STORY_BG.amber}`} />}
        <div className="absolute inset-0 bg-gradient-to-t from-stone-950/90 via-transparent to-stone-950/70" />

        <div className="relative z-20 flex gap-1 p-3" dir="ltr">
          {items.map((s, k) => (
            <div key={s.id} className="h-1 flex-1 overflow-hidden rounded-full bg-white/30">
              <div className="h-full origin-left bg-amber-400"
                style={k < i ? { transform: 'scaleX(1)' } : k === i ? { animation: `sham-story-progress ${STORY_MS}ms linear forwards`, animationPlayState: paused ? 'paused' : 'running' } : { transform: 'scaleX(0)' }}
                key={`${s.id}-${k === i ? g : 'x'}`} />
            </div>
          ))}
        </div>

        <div className="relative z-20 flex items-center justify-between px-3 py-1">
          <div className="flex items-center gap-2">
            <Avatar user={group.user} size={36} ring />
            <div>
              <p className="text-sm font-bold text-white">{group.mine ? t('قصتك', 'Your story') : group.user.name}</p>
              <p className="flex items-center gap-1 text-[11px] text-stone-300">{timeAgo(story.createdAt, lang)} · {story.visibility === 'public' ? <Globe2 className="h-3 w-3" /> : <Users className="h-3 w-3" />}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-full bg-white/20 p-2 text-white transition hover:bg-white/40 cursor-pointer" aria-label={t('إغلاق', 'Close')}><X className="h-5 w-5" /></button>
        </div>

        <div className="relative z-10 flex flex-1 items-center justify-between px-2">
          <button type="button" onClick={lang === 'ar' ? next : prev} className="rounded-full bg-black/40 p-2 text-white hover:bg-black/60 cursor-pointer"><ChevronRight className="h-6 w-6" /></button>
          {!story.image && story.caption && <p className="mx-2 flex-1 text-center text-xl font-black leading-relaxed text-white drop-shadow-lg">{story.caption}</p>}
          <button type="button" onClick={lang === 'ar' ? prev : next} className="rounded-full bg-black/40 p-2 text-white hover:bg-black/60 cursor-pointer"><ChevronLeft className="h-6 w-6" /></button>
        </div>

        <div className="relative z-20 space-y-3 p-4">
          {story.image && story.caption && <p className="text-sm leading-relaxed text-stone-100">{story.caption}</p>}
          {group.mine ? (
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => void showViewers()} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-white/20 py-2.5 text-xs font-bold text-white backdrop-blur hover:bg-white/30 cursor-pointer">
                <Eye className="h-4 w-4" />{t(`شافها ${story.views || 0}`, `Seen by ${story.views || 0}`)}
              </button>
              <button type="button" onClick={() => void remove()} className="rounded-xl bg-rose-600/80 p-2.5 text-white hover:bg-rose-600 cursor-pointer" title={t('مسح القصة', 'Delete story')}><Trash2 className="h-4 w-4" /></button>
            </div>
          ) : (
            <button type="button" onClick={() => onReply(group.user.id)} className="flex w-full items-center justify-center gap-2 rounded-xl bg-white/20 py-2.5 text-xs font-bold text-white backdrop-blur hover:bg-white/30 cursor-pointer">
              <Send className="h-4 w-4" />{t('رد برسالة في الماسنجر', 'Reply in Messenger')}
            </button>
          )}
        </div>

        {viewers && (
          <div className="absolute inset-x-0 bottom-0 z-30 max-h-[60%] overflow-y-auto rounded-t-3xl bg-white p-4" onPointerDown={(e) => e.stopPropagation()}>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-black text-stone-900">{t('شاف القصة', 'Seen by')}</p>
              <button type="button" onClick={() => { setViewers(null); setPaused(false); }} className="rounded-full p-1 text-stone-500 hover:bg-stone-100 cursor-pointer"><X className="h-4 w-4" /></button>
            </div>
            {!viewers.length ? <p className="py-4 text-center text-xs text-stone-500">{t('لسه محدش شافها', 'Nobody yet')}</p> : viewers.map((u) => (
              <div key={u.id} className="flex items-center gap-2 py-1.5"><Avatar user={u} size={32} /><span className="flex-1 truncate text-sm font-semibold text-stone-800">{u.name}</span><span className="text-[11px] text-stone-400">{timeAgo(u.seenAt, lang)}</span></div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StoryComposer({ lang, onClose, onDone, toast }: { lang: Lang; onClose: () => void; onDone: () => void; toast: (s: string) => void }) {
  const t = tx(lang);
  const [image, setImage] = useState('');
  const [caption, setCaption] = useState('');
  const [bg, setBg] = useState('amber');
  const [visibility, setVisibility] = useState<'friends' | 'public'>('friends');
  const [busy, setBusy] = useState(false);
  const file = useRef<HTMLInputElement>(null);

  const pick = async (f?: File) => {
    if (!f) return;
    try { setImage(await resizeImage(f, 1080, 0.8)); } catch { toast(t('الصورة دي مش مدعومة', 'Unsupported image')); }
  };
  const publish = async () => {
    setBusy(true);
    try { await cx('/community/stories', { body: { image: image || undefined, caption, bg, visibility } }); onDone(); }
    catch (e) { toast(errorText(e, lang)); } finally { setBusy(false); }
  };

  return (
    <Sheet title={t('قصة جديدة', 'New story')} onClose={onClose}>
      <div className="space-y-3">
        <div className={`relative flex h-56 items-center justify-center overflow-hidden rounded-2xl ${image ? 'bg-stone-900' : `bg-gradient-to-br ${STORY_BG[bg]}`}`}>
          {image ? <img loading="lazy" decoding="async" src={image} alt="" className="h-full w-full object-contain" /> : <p className="px-6 text-center text-lg font-black text-white drop-shadow">{caption || t('اكتب سطر يظهر هنا…', 'Your line shows here…')}</p>}
          {image && <button type="button" onClick={() => setImage('')} className="absolute end-2 top-2 rounded-full bg-black/50 p-1.5 text-white cursor-pointer"><X className="h-4 w-4" /></button>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Btn small variant="soft" onClick={() => file.current?.click()}><ImagePlus className="h-4 w-4" />{t('صورة', 'Photo')}</Btn>
          <input ref={file} type="file" accept="image/*" className="hidden" onChange={(e) => void pick(e.target.files?.[0])} />
          {!image && Object.keys(STORY_BG).map((k) => (
            <button key={k} type="button" onClick={() => setBg(k)} aria-label={k}
              className={`h-7 w-7 rounded-full bg-gradient-to-br ${STORY_BG[k]} cursor-pointer ${bg === k ? 'ring-2 ring-amber-500 ring-offset-2' : ''}`} />
          ))}
        </div>
        <textarea className={`${inputClass} resize-none`} rows={2} maxLength={280} value={caption} onChange={(e) => setCaption(e.target.value)}
          placeholder={t('مثال: أول يوم تعتيق لتركيبة العود الجديدة 🪵', 'e.g. Day one macerating the new oud blend 🪵')} />
        <div className="flex gap-2 text-xs">
          {(['friends', 'public'] as const).map((v) => (
            <button key={v} type="button" onClick={() => setVisibility(v)}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl border px-3 py-2 font-bold cursor-pointer ${visibility === v ? 'border-amber-500 bg-amber-50 text-amber-900' : 'border-stone-200 text-stone-600'}`}>
              {v === 'friends' ? <Users className="h-3.5 w-3.5" /> : <Globe2 className="h-3.5 w-3.5" />}
              {v === 'friends' ? t('الأصدقاء', 'Friends') : t('كل المجتمع', 'Everyone')}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-stone-500">{t('القصة بتختفي تلقائياً بعد ٢٤ ساعة.', 'Stories disappear after 24 hours.')}</p>
        <Btn className="w-full" busy={busy} disabled={!image && !caption.trim()} onClick={() => void publish()}>{t('انشر القصة ✨', 'Share story ✨')}</Btn>
      </div>
    </Sheet>
  );
}
