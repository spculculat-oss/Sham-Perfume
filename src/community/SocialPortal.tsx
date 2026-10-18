/**
 * «سوشيال شام»: the community's public page — posts (public or friends only) with photos and recipes,
 * reactions, comments, friends, people search, profiles and notifications.
 */
import { useEffect, useRef, useState } from 'react';
import { Bell, Check, FlaskConical, Globe2, ImagePlus, Lock, MessageCircle, MoreHorizontal, Search, Send, UserCheck, UserMinus, UserPlus, Users, X } from 'lucide-react';
import { cx, resizeImage, type Comment, type Notification, type Post, type PublicUser, type Recipe } from './api';
import { pulseNow, type SessionState } from './session';
import { Avatar, Btn, Card, Empty, Sheet, Spinner, errorText, inputClass, timeAgo, tx, useLoad, type Lang } from './ui';

export const REACTIONS: { id: string; emoji: string; ar: string; en: string }[] = [
  { id: 'like', emoji: '👍', ar: 'أعجبني', en: 'Like' }, { id: 'love', emoji: '❤️', ar: 'أحببته', en: 'Love' }, { id: 'fire', emoji: '🔥', ar: 'نار', en: 'Fire' },
  { id: 'wow', emoji: '😮', ar: 'واو', en: 'Wow' }, { id: 'haha', emoji: '😂', ar: 'هههه', en: 'Haha' }, { id: 'sad', emoji: '😢', ar: 'حزين', en: 'Sad' },
];

type Go = (route: string) => void;
interface Props { lang: Lang; session: SessionState; go: Go; toast: (text: string) => void }

/* ------------------------------------------------- feed ------------------------------------------------- */

export function SocialFeed({ lang, session, go, toast }: Props) {
  const t = tx(lang);
  const [scope, setScope] = useState<'all' | 'friends'>('all');
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [more, setMore] = useState(true);
  const [error, setError] = useState('');

  const load = async (before?: string) => {
    setLoading(true);
    try {
      const list = await cx<Post[]>(`/community/feed?scope=${scope}${before ? `&before=${encodeURIComponent(before)}` : ''}`);
      setPosts((prev) => (before ? [...prev, ...list] : list));
      setMore(list.length >= 20);
      setError('');
    } catch (e) { setError(errorText(e, lang)); } finally { setLoading(false); }
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void load(); }, [scope]);

  const replace = (p: Post) => setPosts((list) => list.map((x) => (x.id === p.id ? p : x)));
  const remove = (id: string) => setPosts((list) => list.filter((x) => x.id !== id));

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-4">
        <Composer lang={lang} session={session} onPosted={(p) => setPosts((list) => [p, ...list])} toast={toast} />
        <div className="flex gap-2">
          {(['all', 'friends'] as const).map((s) => (
            <button key={s} type="button" onClick={() => setScope(s)} className={`rounded-full px-4 py-1.5 text-sm font-semibold cursor-pointer ${scope === s ? 'bg-stone-900 text-white' : 'bg-white text-stone-600 border border-stone-200'}`}>
              {s === 'all' ? t('كل المجتمع', 'Everyone') : t('أصدقائي', 'Friends')}
            </button>
          ))}
        </div>
        {error && <p className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
        {posts.map((p) => <PostCard key={p.id} post={p} lang={lang} go={go} onChange={replace} onRemove={remove} toast={toast} />)}
        {loading && <Spinner />}
        {!loading && !posts.length && !error && (
          <Card><Empty icon={<Users className="h-10 w-10" />} title={t('لسه مفيش منشورات هنا', 'No posts yet')} body={t('ابدأ بأول منشور، أو أضف أصدقاء من الاقتراحات.', 'Write the first post, or add friends from the suggestions.')} /></Card>
        )}
        {!loading && more && posts.length > 0 && <Btn variant="soft" className="w-full" onClick={() => void load(posts[posts.length - 1].createdAt)}>{t('عرض المزيد', 'Load more')}</Btn>}
      </div>
      <aside className="space-y-4">
        <PeoplePanel lang={lang} go={go} toast={toast} />
      </aside>
    </div>
  );
}

function Composer({ lang, session, onPosted, toast }: { lang: Lang; session: SessionState; onPosted: (p: Post) => void; toast: (s: string) => void }) {
  const t = tx(lang);
  const me = session.me!;
  const [body, setBody] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [visibility, setVisibility] = useState<'public' | 'friends'>('public');
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [pickRecipe, setPickRecipe] = useState(false);
  const [busy, setBusy] = useState(false);
  const file = useRef<HTMLInputElement>(null);

  const submit = async () => {
    setBusy(true);
    try {
      const post = await cx<Post>('/community/posts', { body: { body, image, visibility, recipeId: recipe?.id } });
      onPosted(post); setBody(''); setImage(null); setRecipe(null);
    } catch (e) { toast(errorText(e, lang)); } finally { setBusy(false); }
  };

  return (
    <Card className="p-4">
      <div className="flex gap-3">
        <Avatar user={me} size={44} />
        <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={body ? 3 : 2} maxLength={5000}
          placeholder={t(`بتفكّر في إيه يا ${me.name.split(' ')[0]}؟ شارك تجربة أو سؤال أو تركيبة…`, `What’s on your mind, ${me.name.split(' ')[0]}? Share an experience, a question or a recipe…`)}
          className="min-h-[56px] flex-1 resize-none rounded-2xl bg-stone-50 px-4 py-3 text-sm outline-none focus:bg-white focus:ring-2 focus:ring-amber-200" />
      </div>
      {image && (
        <div className="relative mt-3"><img src={image} alt="" className="max-h-80 w-full rounded-2xl object-cover" />
          <button type="button" onClick={() => setImage(null)} className="absolute top-2 end-2 rounded-full bg-stone-900/70 p-1.5 text-white cursor-pointer"><X className="h-4 w-4" /></button></div>
      )}
      {recipe && (
        <div className="mt-3 flex items-center justify-between rounded-2xl bg-amber-50 p-3 text-sm"><span className="flex items-center gap-2 font-semibold text-amber-900"><FlaskConical className="h-4 w-4" />{recipe.title}</span>
          <button type="button" onClick={() => setRecipe(null)} className="text-stone-500 cursor-pointer"><X className="h-4 w-4" /></button></div>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-stone-100 pt-3">
        <input ref={file} type="file" accept="image/*" hidden onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) setImage(await resizeImage(f).catch(() => null)); }} />
        <Btn variant="ghost" small onClick={() => file.current?.click()}><ImagePlus className="h-4 w-4 text-emerald-600" />{t('صورة', 'Photo')}</Btn>
        <Btn variant="ghost" small onClick={() => setPickRecipe(true)}><FlaskConical className="h-4 w-4 text-amber-600" />{t('تركيبة', 'Recipe')}</Btn>
        <select value={visibility} onChange={(e) => setVisibility(e.target.value as 'public' | 'friends')} className="rounded-xl border border-stone-200 bg-white px-2 py-1.5 text-xs">
          <option value="public">🌍 {t('عام', 'Public')}</option>
          <option value="friends">👥 {t('الأصدقاء فقط', 'Friends only')}</option>
        </select>
        <Btn className="ms-auto" small busy={busy} disabled={!body.trim() && !image && !recipe} onClick={() => void submit()}><Send className="h-3.5 w-3.5" />{t('نشر', 'Post')}</Btn>
      </div>
      {pickRecipe && <RecipePicker lang={lang} onClose={() => setPickRecipe(false)} onPick={(r) => { setRecipe(r); setPickRecipe(false); }} />}
    </Card>
  );
}

export function RecipePicker({ lang, onClose, onPick }: { lang: Lang; onClose: () => void; onPick: (r: Recipe) => void }) {
  const t = tx(lang);
  const { data, loading } = useLoad(() => cx<Recipe[]>('/community/me/recipes'));
  return (
    <Sheet title={t('اختار تركيبة من تركيباتك', 'Pick one of your recipes')} onClose={onClose}>
      {loading ? <Spinner /> : !data?.length ? <Empty title={t('مفيش تركيبات محفوظة', 'No saved recipes')} body={t('احفظ تركيباتك من «بوابتي» أو من الحاسبة.', 'Save recipes from “My portal” or the calculator.')} /> : (
        <div className="space-y-2">{data.map((r) => (
          <button key={r.id} type="button" onClick={() => onPick(r)} className="flex w-full items-center gap-2 rounded-xl border border-stone-200 p-3 text-start hover:border-amber-400 cursor-pointer">
            <FlaskConical className="h-4 w-4 text-amber-600" /><span className="font-semibold">{r.title}</span><span className="ms-auto text-xs text-stone-500">{timeAgo(r.updatedAt, lang)}</span>
          </button>
        ))}</div>
      )}
    </Sheet>
  );
}

/* ------------------------------------------------- post ------------------------------------------------- */

export function PostCard({ post, lang, go, onChange, onRemove, toast }: { post: Post; lang: Lang; go: Go; onChange: (p: Post) => void; onRemove: (id: string) => void; toast: (s: string) => void }) {
  const t = tx(lang);
  const [showComments, setShowComments] = useState(false);
  const [menu, setMenu] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(post.body);
  const [picker, setPicker] = useState(false);
  const total = Object.values(post.reactions).reduce((s, n) => s + n, 0);
  const top = Object.entries(post.reactions).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k]) => REACTIONS.find((r) => r.id === k)?.emoji);
  const mine = REACTIONS.find((r) => r.id === post.myReaction);

  const react = async (kind: string | null) => {
    setPicker(false);
    try { onChange(await cx<Post>(`/community/posts/${post.id}/react`, { body: { kind } })); } catch (e) { toast(errorText(e, lang)); }
  };
  const save = async () => {
    try { onChange(await cx<Post>(`/community/posts/${post.id}`, { method: 'PATCH', body: { body: draft } })); setEditing(false); } catch (e) { toast(errorText(e, lang)); }
  };
  const del = async () => {
    if (!confirm(t('حذف المنشور نهائياً؟', 'Delete this post?'))) return;
    try { await cx(`/community/posts/${post.id}`, { method: 'DELETE' }); onRemove(post.id); } catch (e) { toast(errorText(e, lang)); }
  };
  const report = async () => {
    const reason = prompt(t('سبب الإبلاغ (اختياري):', 'Reason (optional):')) ?? null;
    if (reason === null) return;
    try { await cx('/community/reports', { body: { kind: 'post', id: post.id, reason } }); toast(t('وصل البلاغ للإدارة، شكراً لك', 'Thanks — the administration got your report')); } catch (e) { toast(errorText(e, lang)); }
    setMenu(false);
  };

  return (
    <Card>
      <div className="flex items-start gap-3 p-4 pb-2">
        <button type="button" onClick={() => go(`u/${post.author.handle}`)} className="cursor-pointer"><Avatar user={post.author} size={44} /></button>
        <div className="min-w-0 flex-1">
          <button type="button" onClick={() => go(`u/${post.author.handle}`)} className="font-bold text-stone-900 hover:underline cursor-pointer">{post.author.name}</button>
          {post.author.merchant && <span className="ms-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">{t('تاجر', 'Merchant')}</span>}
          <p className="flex items-center gap-1 text-[11px] text-stone-500">{timeAgo(post.createdAt, lang)}{post.editedAt && ` · ${t('معدّل', 'edited')}`} · {post.visibility === 'public' ? <Globe2 className="h-3 w-3" /> : <Lock className="h-3 w-3" />}</p>
        </div>
        <div className="relative">
          <button type="button" onClick={() => setMenu((m) => !m)} className="rounded-full p-1.5 text-stone-500 hover:bg-stone-100 cursor-pointer"><MoreHorizontal className="h-5 w-5" /></button>
          {menu && (
            <div className="absolute end-0 z-10 mt-1 w-44 overflow-hidden rounded-xl border border-stone-200 bg-white text-sm shadow-lg">
              {post.mine ? (<>
                <button type="button" onClick={() => { setEditing(true); setMenu(false); }} className="block w-full px-3 py-2 text-start hover:bg-stone-50 cursor-pointer">{t('تعديل', 'Edit')}</button>
                <button type="button" onClick={() => void cx<Post>(`/community/posts/${post.id}`, { method: 'PATCH', body: { visibility: post.visibility === 'public' ? 'friends' : 'public' } }).then(onChange).finally(() => setMenu(false))} className="block w-full px-3 py-2 text-start hover:bg-stone-50 cursor-pointer">
                  {post.visibility === 'public' ? t('اجعله للأصدقاء فقط', 'Make friends-only') : t('اجعله عاماً', 'Make public')}</button>
                <button type="button" onClick={() => void del()} className="block w-full px-3 py-2 text-start text-rose-600 hover:bg-rose-50 cursor-pointer">{t('حذف', 'Delete')}</button>
              </>) : (
                <button type="button" onClick={() => void report()} className="block w-full px-3 py-2 text-start hover:bg-stone-50 cursor-pointer">{t('إبلاغ الإدارة', 'Report')}</button>
              )}
            </div>
          )}
        </div>
      </div>
      <div className="px-4">
        {editing ? (
          <div className="space-y-2"><textarea className={inputClass} rows={4} value={draft} onChange={(e) => setDraft(e.target.value)} />
            <div className="flex gap-2"><Btn small onClick={() => void save()}>{t('حفظ', 'Save')}</Btn><Btn small variant="ghost" onClick={() => { setEditing(false); setDraft(post.body); }}>{t('إلغاء', 'Cancel')}</Btn></div></div>
        ) : post.body && <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed text-stone-800">{post.body}</p>}
      </div>
      {post.recipe && <RecipeCard lang={lang} title={post.recipe.title} data={post.recipe.data} />}
      {post.image && <img src={post.image} alt="" loading="lazy" className="mt-3 max-h-[560px] w-full bg-stone-100 object-cover" />}
      <div className="flex items-center justify-between px-4 py-2 text-xs text-stone-500">
        <span>{total > 0 && <>{top.join('')} {total}</>}</span>
        {post.comments > 0 && <button type="button" onClick={() => setShowComments(true)} className="hover:underline cursor-pointer">{post.comments} {t('تعليق', 'comments')}</button>}
      </div>
      <div className="relative grid grid-cols-2 border-t border-stone-100 text-sm font-semibold text-stone-600">
        <button type="button" onClick={() => void react(post.myReaction ? null : 'like')} onContextMenu={(e) => { e.preventDefault(); setPicker(true); }}
          onMouseEnter={() => setPicker(true)} className={`flex items-center justify-center gap-1.5 py-2.5 hover:bg-stone-50 cursor-pointer ${mine ? 'text-amber-700' : ''}`}>
          <span>{mine ? mine.emoji : '👍'}</span>{mine ? (lang === 'ar' ? mine.ar : mine.en) : t('تفاعل', 'React')}
        </button>
        <button type="button" onClick={() => setShowComments((s) => !s)} className="flex items-center justify-center gap-1.5 py-2.5 hover:bg-stone-50 cursor-pointer"><MessageCircle className="h-4 w-4" />{t('تعليق', 'Comment')}</button>
        {picker && (
          <div onMouseLeave={() => setPicker(false)} className="absolute -top-12 start-2 z-10 flex gap-1 rounded-full border border-stone-200 bg-white px-2 py-1.5 shadow-xl">
            {REACTIONS.map((r) => <button key={r.id} type="button" title={lang === 'ar' ? r.ar : r.en} onClick={() => void react(r.id)} className="text-2xl transition hover:scale-125 cursor-pointer">{r.emoji}</button>)}
          </div>
        )}
      </div>
      {showComments && <Comments post={post} lang={lang} go={go} toast={toast} onCount={(n) => onChange({ ...post, comments: n })} />}
    </Card>
  );
}

export function RecipeCard({ lang, title, data }: { lang: Lang; title: string; data: Record<string, unknown> }) {
  const t = tx(lang);
  // Recipes saved from the calculator carry the fragrance pyramid (pyramidNotes); others may list ingredients.
  const d = data as { ingredients?: { name?: string; percent?: number; grams?: number }[]; pyramidNotes?: { nameAr?: string; nameEn?: string; percentageOfOil?: number }[]; formulation?: { concentrationPercent?: number; bottleVolumeMl?: number } };
  const lines = Array.isArray(d.pyramidNotes)
    ? d.pyramidNotes.slice(0, 8).map((n) => ({ name: (lang === 'ar' ? n.nameAr : n.nameEn) || n.nameAr || n.nameEn, percent: n.percentageOfOil, grams: undefined as number | undefined }))
    : Array.isArray(d.ingredients) ? d.ingredients.slice(0, 8) : [];
  return (
    <div className="mx-4 mt-3 rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-3">
      <p className="flex items-center gap-2 font-bold text-amber-900"><FlaskConical className="h-4 w-4" />{title}</p>
      {d.formulation?.concentrationPercent != null && <p className="mt-0.5 text-[11px] text-stone-600">{t('تركيز', 'Concentration')} {d.formulation.concentrationPercent}% · {d.formulation.bottleVolumeMl} ml</p>}
      {lines.length > 0 ? (
        <ul className="mt-2 grid gap-1 text-xs text-stone-700 sm:grid-cols-2">{lines.map((l, i) => <li key={i} className="flex justify-between gap-2 rounded-lg bg-white/70 px-2 py-1"><span>{l.name}</span><span className="font-mono">{l.percent != null ? `${l.percent}%` : l.grams != null ? `${l.grams} g` : ''}</span></li>)}</ul>
      ) : <p className="mt-1 text-xs text-stone-500">{t('تركيبة من محفوظات العضو', 'A recipe from the member’s library')}</p>}
    </div>
  );
}

function Comments({ post, lang, go, toast, onCount }: { post: Post; lang: Lang; go: Go; toast: (s: string) => void; onCount: (n: number) => void }) {
  const t = tx(lang);
  const { data, setData, loading } = useLoad(() => cx<Comment[]>(`/community/posts/${post.id}/comments`), [post.id]);
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const add = async () => {
    setBusy(true);
    try { const next = await cx<Comment[]>(`/community/posts/${post.id}/comments`, { body: { body } }); setData(next); onCount(next.length); setBody(''); }
    catch (e) { toast(errorText(e, lang)); } finally { setBusy(false); }
  };
  const del = async (id: string) => {
    try { await cx(`/community/comments/${id}`, { method: 'DELETE' }); const next = (data || []).filter((c) => c.id !== id); setData(next); onCount(next.length); } catch (e) { toast(errorText(e, lang)); }
  };
  return (
    <div className="space-y-3 border-t border-stone-100 p-4">
      {loading ? <Spinner /> : (data || []).map((c) => (
        <div key={c.id} className="group flex gap-2">
          <button type="button" onClick={() => go(`u/${c.author.handle}`)} className="cursor-pointer"><Avatar user={c.author} size={32} /></button>
          <div className="min-w-0 flex-1">
            <div className="inline-block max-w-full rounded-2xl bg-stone-100 px-3 py-2"><p className="text-xs font-bold text-stone-900">{c.author.name}</p><p className="whitespace-pre-wrap break-words text-sm text-stone-800">{c.body}</p></div>
            <p className="mt-0.5 flex gap-3 px-2 text-[11px] text-stone-500">{timeAgo(c.createdAt, lang)}{(c.mine || post.mine) && <button type="button" onClick={() => void del(c.id)} className="hover:text-rose-600 cursor-pointer">{t('حذف', 'Delete')}</button>}</p>
          </div>
        </div>
      ))}
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (body.trim()) void add(); }}>
        <input className={`${inputClass} rounded-full`} value={body} onChange={(e) => setBody(e.target.value)} maxLength={2000} placeholder={t('اكتب تعليق…', 'Write a comment…')} />
        <Btn type="submit" small busy={busy} disabled={!body.trim()} className="rounded-full"><Send className="h-4 w-4" /></Btn>
      </form>
    </div>
  );
}

/* ------------------------------------------------ people ------------------------------------------------ */

function PeoplePanel({ lang, go, toast }: { lang: Lang; go: Go; toast: (s: string) => void }) {
  const t = tx(lang);
  const friends = useLoad(() => cx<{ friends: PublicUser[]; incoming: PublicUser[]; outgoing: PublicUser[] }>('/community/friends'));
  const suggestions = useLoad(() => cx<PublicUser[]>('/community/people/suggestions'));
  const [q, setQ] = useState('');
  const [found, setFound] = useState<PublicUser[] | null>(null);
  useEffect(() => {
    if (q.trim().length < 2) { setFound(null); return; }
    const id = setTimeout(() => { void cx<PublicUser[]>(`/community/people?q=${encodeURIComponent(q.trim())}`).then(setFound).catch(() => setFound([])); }, 300);
    return () => clearTimeout(id);
  }, [q]);
  const act = async (fn: () => Promise<unknown>, done: string) => {
    try { await fn(); toast(done); void friends.reload(true); void suggestions.reload(true); void pulseNow(); } catch (e) { toast(errorText(e, lang)); }
  };

  return (
    <>
      <Card className="p-4">
        <div className="relative"><Search className="absolute inset-y-0 start-3 my-auto h-4 w-4 text-stone-400" />
          <input className={`${inputClass} ps-9`} value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('ابحث عن صناع العطور…', 'Search perfumers…')} /></div>
        {found && (
          <div className="mt-3 space-y-2">{found.length ? found.map((u) => <PersonRow key={u.id} u={u} lang={lang} go={go} />) : <p className="text-xs text-stone-500">{t('مفيش نتائج', 'No results')}</p>}</div>
        )}
      </Card>
      {!!friends.data?.incoming.length && (
        <Card className="p-4">
          <p className="mb-3 font-bold text-stone-900">{t('طلبات الصداقة', 'Friend requests')} <span className="text-rose-600">({friends.data.incoming.length})</span></p>
          <div className="space-y-3">{friends.data.incoming.map((u) => (
            <div key={u.id} className="space-y-2">
              <PersonRow u={u} lang={lang} go={go} />
              <div className="flex gap-2">
                <Btn small className="flex-1" onClick={() => void act(() => cx(`/community/friends/${u.id}`, { body: {} }), t('بقيتوا أصدقاء 🎉', 'You are now friends 🎉'))}><Check className="h-3.5 w-3.5" />{t('قبول', 'Accept')}</Btn>
                <Btn small variant="ghost" className="flex-1" onClick={() => void act(() => cx(`/community/friends/${u.id}`, { method: 'DELETE' }), t('تم الرفض', 'Declined'))}>{t('رفض', 'Decline')}</Btn>
              </div>
            </div>
          ))}</div>
        </Card>
      )}
      <Card className="p-4">
        <p className="mb-3 font-bold text-stone-900">{t('ناس ممكن تعرفهم', 'People you may know')}</p>
        {suggestions.loading ? <Spinner /> : !suggestions.data?.length ? <p className="text-xs text-stone-500">{t('هنقترح عليك ناس أول ما المجتمع يكبر', 'Suggestions will appear as the community grows')}</p> : (
          <div className="space-y-3">{suggestions.data.slice(0, 8).map((u) => (
            <div key={u.id} className="flex items-center gap-2">
              <div className="min-w-0 flex-1"><PersonRow u={u} lang={lang} go={go} /></div>
              <Btn small variant="soft" onClick={() => void act(() => cx(`/community/friends/${u.id}`, { body: {} }), t('اتبعت طلب الصداقة', 'Friend request sent'))}><UserPlus className="h-3.5 w-3.5" /></Btn>
            </div>
          ))}</div>
        )}
      </Card>
      {!!friends.data?.friends.length && (
        <Card className="p-4">
          <button type="button" onClick={() => go('friends')} className="mb-3 font-bold text-stone-900 hover:underline cursor-pointer">{t('أصدقائي', 'Friends')} ({friends.data.friends.length})</button>
          <div className="flex flex-wrap gap-2">{friends.data.friends.slice(0, 12).map((u) => <button key={u.id} type="button" title={u.name} onClick={() => go(`u/${u.handle}`)} className="cursor-pointer"><Avatar user={u} size={38} /></button>)}</div>
        </Card>
      )}
    </>
  );
}

export function PersonRow({ u, lang, go }: { u: PublicUser; lang: Lang; go: Go }) {
  const t = tx(lang);
  return (
    <button type="button" onClick={() => go(`u/${u.handle}`)} className="flex w-full min-w-0 items-center gap-2.5 text-start cursor-pointer">
      <Avatar user={u} size={38} />
      <span className="min-w-0"><span className="block truncate text-sm font-bold text-stone-900">{u.name}</span>
        <span className="block truncate text-[11px] text-stone-500">@{u.handle}{u.mutual ? ` · ${u.mutual} ${t('صديق مشترك', 'mutual')}` : ''}{u.merchant ? ` · ${u.merchant.storeName}` : ''}</span></span>
    </button>
  );
}

/* ------------------------------------------------ friends ------------------------------------------------ */

export function FriendsPage({ lang, go, toast }: Omit<Props, 'session'>) {
  const t = tx(lang);
  const { data, loading, reload } = useLoad(() => cx<{ friends: PublicUser[]; incoming: PublicUser[]; outgoing: PublicUser[] }>('/community/friends'));
  const blocked = useLoad(() => cx<PublicUser[]>('/community/blocks'));
  if (loading) return <Spinner />;
  const section = (title: string, list: PublicUser[], extra: (u: PublicUser) => React.ReactNode) => (
    <Card className="p-4">
      <p className="mb-3 font-bold text-stone-900">{title} ({list.length})</p>
      {!list.length ? <p className="text-sm text-stone-500">—</p> : <div className="grid gap-3 sm:grid-cols-2">{list.map((u) => <div key={u.id} className="flex items-center gap-2 rounded-xl border border-stone-100 p-2"><div className="min-w-0 flex-1"><PersonRow u={u} lang={lang} go={go} /></div>{extra(u)}</div>)}</div>}
    </Card>
  );
  const act = async (fn: () => Promise<unknown>) => { try { await fn(); void reload(true); void blocked.reload(true); void pulseNow(); } catch (e) { toast(errorText(e, lang)); } };
  return (
    <div className="space-y-4">
      {section(t('طلبات واردة', 'Incoming requests'), data?.incoming || [], (u) => <Btn small onClick={() => void act(() => cx(`/community/friends/${u.id}`, { body: {} }))}><UserCheck className="h-3.5 w-3.5" /></Btn>)}
      {section(t('أصدقائي', 'Friends'), data?.friends || [], (u) => <Btn small variant="ghost" onClick={() => void act(async () => { const { id } = await cx<{ id: string }>('/community/chats/direct', { body: { userId: u.id } }); go(`messenger/${id}`); })}><MessageCircle className="h-4 w-4" /></Btn>)}
      {section(t('طلبات أرسلتها', 'Sent requests'), data?.outgoing || [], (u) => <Btn small variant="ghost" onClick={() => void act(() => cx(`/community/friends/${u.id}`, { method: 'DELETE' }))}><X className="h-4 w-4" /></Btn>)}
      {section(t('المحظورون', 'Blocked'), blocked.data || [], (u) => <Btn small variant="ghost" onClick={() => void act(() => cx(`/community/blocks/${u.id}`, { method: 'DELETE' }))}>{t('إلغاء الحظر', 'Unblock')}</Btn>)}
    </div>
  );
}

/* ------------------------------------------------ profile ------------------------------------------------ */

interface ProfileData {
  user: PublicUser; relation: 'self' | 'friends' | 'requested' | 'incoming' | 'blocked' | 'none';
  counts: { friends: number; posts: number; recipes: number }; posts: Post[]; recipes: { id: string; title: string; data: Record<string, unknown>; updatedAt: string }[];
}

export function ProfilePage({ handle, lang, go, toast }: Omit<Props, 'session'> & { handle: string }) {
  const t = tx(lang);
  const { data, setData, loading, error, reload } = useLoad(() => cx<ProfileData>(`/community/profile/${encodeURIComponent(handle)}`), [handle]);
  const [tab, setTab] = useState<'posts' | 'recipes'>('posts');
  if (loading) return <Spinner />;
  if (error || !data) return <Card><Empty title={errorText(error, lang)} /></Card>;
  const u = data.user;
  const act = async (fn: () => Promise<unknown>, done?: string) => { try { await fn(); if (done) toast(done); void reload(true); void pulseNow(); } catch (e) { toast(errorText(e, lang)); } };
  const message = () => act(async () => { const { id } = await cx<{ id: string }>('/community/chats/direct', { body: { userId: u.id } }); go(`messenger/${id}`); });

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden">
        <div className="h-32 bg-gradient-to-br from-stone-900 via-amber-900 to-amber-600 sm:h-44" />
        <div className="px-4 pb-4 sm:px-6">
          <div className="-mt-12 flex flex-wrap items-end gap-4">
            <span className="rounded-full border-4 border-white"><Avatar user={u} size={104} /></span>
            <div className="min-w-0 flex-1 pb-1">
              <h2 className="text-2xl font-black text-stone-900">{u.name}</h2>
              <p className="text-sm text-stone-500">@{u.handle} · {data.counts.friends} {t('صديق', 'friends')} · {u.online ? <span className="text-emerald-600">{t('متصل الآن', 'online')}</span> : `${t('آخر ظهور', 'last seen')} ${timeAgo(u.lastSeen, lang)}`}</p>
            </div>
            <div className="flex flex-wrap gap-2 pb-1">
              {data.relation === 'self' && <Btn variant="soft" onClick={() => go('me/profile')}>{t('تعديل الملف', 'Edit profile')}</Btn>}
              {data.relation === 'none' && <Btn onClick={() => void act(() => cx(`/community/friends/${u.id}`, { body: {} }), t('اتبعت طلب الصداقة', 'Request sent'))}><UserPlus className="h-4 w-4" />{t('إضافة صديق', 'Add friend')}</Btn>}
              {data.relation === 'requested' && <Btn variant="soft" onClick={() => void act(() => cx(`/community/friends/${u.id}`, { method: 'DELETE' }))}>{t('إلغاء الطلب', 'Cancel request')}</Btn>}
              {data.relation === 'incoming' && <Btn onClick={() => void act(() => cx(`/community/friends/${u.id}`, { body: {} }), t('بقيتوا أصدقاء 🎉', 'Friends now 🎉'))}><UserCheck className="h-4 w-4" />{t('قبول الصداقة', 'Accept')}</Btn>}
              {data.relation === 'friends' && <Btn variant="soft" onClick={() => { if (confirm(t('إلغاء الصداقة؟', 'Unfriend?'))) void act(() => cx(`/community/friends/${u.id}`, { method: 'DELETE' })); }}><UserMinus className="h-4 w-4" />{t('أصدقاء', 'Friends')}</Btn>}
              {data.relation !== 'self' && data.relation !== 'blocked' && <Btn variant="dark" onClick={() => void message()}><MessageCircle className="h-4 w-4" />{t('مراسلة', 'Message')}</Btn>}
              {data.relation === 'blocked' ? <Btn variant="ghost" onClick={() => void act(() => cx(`/community/blocks/${u.id}`, { method: 'DELETE' }))}>{t('إلغاء الحظر', 'Unblock')}</Btn>
                : data.relation !== 'self' && <Btn variant="ghost" onClick={() => { if (confirm(t('حظر هذا الحساب؟ مش هيقدر يراسلك أو يشوف منشوراتك.', 'Block this account?'))) void act(() => cx(`/community/blocks/${u.id}`, { body: {} }), t('تم الحظر', 'Blocked')); }}>{t('حظر', 'Block')}</Btn>}
              {data.relation !== 'self' && <Btn variant="ghost" onClick={() => { const reason = prompt(t('سبب الإبلاغ:', 'Reason:')); if (reason !== null) void act(() => cx('/community/reports', { body: { kind: 'user', id: u.id, reason } }), t('وصل البلاغ للإدارة', 'Reported')); }}>{t('إبلاغ', 'Report')}</Btn>}
            </div>
          </div>
          {u.bio && <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-stone-700">{u.bio}</p>}
          {u.merchant && <button type="button" onClick={() => go(`store/${u.merchant!.slug}`)} className="mt-3 inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1.5 text-sm font-bold text-amber-900 cursor-pointer">🏪 {u.merchant.storeName}</button>}
        </div>
        <div className="flex border-t border-stone-100 text-sm font-semibold">
          {(['posts', 'recipes'] as const).map((k) => (
            <button key={k} type="button" onClick={() => setTab(k)} className={`flex-1 py-3 cursor-pointer ${tab === k ? 'border-b-2 border-amber-600 text-amber-800' : 'text-stone-500'}`}>
              {k === 'posts' ? `${t('المنشورات', 'Posts')} (${data.counts.posts})` : `${t('التركيبات', 'Recipes')} (${data.recipes.length})`}
            </button>
          ))}
        </div>
      </Card>
      {tab === 'posts'
        ? (data.posts.length ? data.posts.map((p) => <PostCard key={p.id} post={p} lang={lang} go={go} toast={toast}
          onChange={(np) => setData({ ...data, posts: data.posts.map((x) => (x.id === np.id ? np : x)) })} onRemove={(id) => setData({ ...data, posts: data.posts.filter((x) => x.id !== id) })} />)
          : <Card><Empty title={t('لا توجد منشورات ظاهرة لك', 'No posts visible to you')} /></Card>)
        : (data.recipes.length ? <div className="grid gap-3 sm:grid-cols-2">{data.recipes.map((r) => <Card key={r.id} className="pb-3"><RecipeCard lang={lang} title={r.title} data={r.data} /></Card>)}</div>
          : <Card><Empty title={t('لا توجد تركيبات منشورة', 'No shared recipes')} /></Card>)}
    </div>
  );
}

/* --------------------------------------------- notifications --------------------------------------------- */

export function NotificationsPage({ lang, go }: { lang: Lang; go: Go }) {
  const t = tx(lang);
  const { data, loading } = useLoad(() => cx<Notification[]>('/community/notifications'));
  useEffect(() => { void cx('/community/notifications/read', { body: {} }).then(() => pulseNow()).catch(() => {}); }, []);
  const text = (n: Notification) => {
    const who = n.actor?.name || t('الإدارة', 'The administration');
    const map: Record<string, [string, string, string?]> = {
      friend_request: [`${who} بعتلك طلب صداقة`, `${who} sent you a friend request`, n.actor ? `u/${n.actor.handle}` : 'friends'],
      friend_accepted: [`${who} قبل طلب صداقتك`, `${who} accepted your request`, n.actor ? `u/${n.actor.handle}` : 'friends'],
      reaction: [`${who} تفاعل مع منشورك`, `${who} reacted to your post`, ''],
      comment: [`${who} علّق على منشورك`, `${who} commented on your post`, ''],
      order_paid: ['طلب جديد مدفوع في متجرك 🎉', 'A new paid order in your store 🎉', 'merchant/orders'],
      merchant_approved: ['تمت الموافقة على متجرك — مبروك! 🎉', 'Your store was approved 🎉', 'merchant'],
      merchant_rejected: ['الإدارة طلبت تعديلات على ملف متجرك', 'The administration asked for changes to your store', 'merchant'],
      merchant_suspended: ['تم إيقاف متجرك مؤقتاً — راجع الملاحظات', 'Your store was suspended', 'merchant'],
      product_approved: ['تم نشر منتجك في المتجر ✅', 'Your product is live ✅', 'merchant/products'],
      product_rejected: ['منتجك محتاج تعديل قبل النشر', 'Your product needs changes', 'merchant/products'],
      order_shipped: [`طلبك ${n.ref} اتشحن 🚚`, `Your order ${n.ref} shipped 🚚`, 'me/orders'],
      order_delivered: [`طلبك ${n.ref} وصل ✅`, `Your order ${n.ref} was delivered ✅`, 'me/orders'],
      order_cancelled: [`طلبك ${n.ref} اتلغى`, `Your order ${n.ref} was cancelled`, 'me/orders'],
    };
    return map[n.kind] || [n.kind, n.kind, ''];
  };
  return (
    <Card className="divide-y divide-stone-100">
      <p className="flex items-center gap-2 p-4 font-bold text-stone-900"><Bell className="h-5 w-5 text-amber-600" />{t('الإشعارات', 'Notifications')}</p>
      {loading ? <Spinner /> : !data?.length ? <Empty title={t('مفيش إشعارات', 'No notifications')} /> : data.map((n) => {
        const [ar, en, route] = text(n);
        return (
          <button key={n.id} type="button" onClick={() => route && go(route)} className={`flex w-full items-center gap-3 p-4 text-start hover:bg-stone-50 cursor-pointer ${n.read ? '' : 'bg-amber-50/60'}`}>
            {n.actor ? <Avatar user={n.actor} size={40} /> : <span className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-lg">🔔</span>}
            <span className="min-w-0 flex-1"><span className="block text-sm text-stone-800">{lang === 'ar' ? ar : en}</span><span className="text-[11px] text-stone-500">{timeAgo(n.createdAt, lang)}</span></span>
            {!n.read && <span className="h-2.5 w-2.5 rounded-full bg-amber-600" />}
          </button>
        );
      })}
    </Card>
  );
}

