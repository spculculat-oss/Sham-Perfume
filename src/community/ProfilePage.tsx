/**
 * The member's page in «مجتمع شام» — the Facebook-style cover, tabs and friends of the merchant's AI Studio design,
 * showing only what is real: the member's own bio / country / craft level / join date, their visible posts,
 * shared recipes, real friends and the pictures of their posts. Block, report and messaging stay available.
 */
import { useState } from 'react';
import { BookOpen, Calendar, Edit3, FlaskConical, Flag, Image as ImageIcon, MapPin, MessageCircle, Share2, ShieldOff, Sparkles, UserCheck, UserMinus, UserPlus, Users } from 'lucide-react';
import { cx, type ProfileView } from './api';
import { pulseNow } from './session';
import { openFormulaInLab } from './sync';
import { Avatar, Btn, Card, Empty, Spinner, errorText, timeAgo, tx, useLoad, type Lang } from './ui';
import { PostCard, RecipeCard } from './SocialPortal';

type Tab = 'timeline' | 'about' | 'recipes' | 'friends' | 'photos';

export function ProfilePage({ handle, lang, go, toast, onOpenMessenger }: { handle: string; lang: Lang; go: (route: string) => void; toast: (s: string) => void; onOpenMessenger?: (userId: string) => void }) {
  const t = tx(lang);
  const { data, setData, loading, error, reload } = useLoad(() => cx<ProfileView>(`/community/profile/${encodeURIComponent(handle)}`), [handle]);
  const [tab, setTab] = useState<Tab>('timeline');
  if (loading) return <Spinner />;
  if (error || !data) return <Card><Empty title={errorText(error, lang)} /></Card>;
  const u = data.user;
  const isMe = data.relation === 'self';
  const photos = data.posts.filter((p) => p.image).map((p) => ({ id: p.id, src: p.image as string }));

  const act = async (fn: () => Promise<unknown>, done?: string) => {
    try { await fn(); if (done) toast(done); void reload(true); void pulseNow(); } catch (e) { toast(errorText(e, lang)); }
  };
  const message = () => (onOpenMessenger ? onOpenMessenger(u.id)
    : void act(async () => { const { id } = await cx<{ id: string }>('/community/chats/direct', { body: { userId: u.id } }); go(`messenger/${id}`); }));
  const share = async () => {
    const url = `${location.origin}${location.pathname}#community/u/${u.handle}`;
    try { await navigator.clipboard.writeText(url); toast(t('اتنسخ رابط الصفحة 📋', 'Profile link copied 📋')); } catch { toast(url); }
  };
  const useRecipe = (title: string, recipe: Record<string, unknown>) => { if (!openFormulaInLab(title, recipe)) toast(t('التركيبة دي مفيهاش أرقام تتحمّل في الحاسبة', 'This recipe has nothing the calculator can load')); };
  const craftTitle = ({ master_lab: t('خبير معمل', 'Master lab'), perfumer: t('صانع عطور', 'Perfumer'), hobbyist: t('هاوي تركيب عطور', 'Hobbyist') } as Record<string, string>)[u.craftLevel] || t('عضو', 'Member');

  const tabs: { id: Tab; label: string; icon: typeof BookOpen; count?: number }[] = [
    { id: 'timeline', label: t('المنشورات', 'Posts'), icon: BookOpen, count: data.counts.posts },
    { id: 'about', label: t('عنه', 'About'), icon: Sparkles },
    { id: 'recipes', label: t('التركيبات', 'Recipes'), icon: FlaskConical, count: data.recipes.length },
    { id: 'friends', label: t('الأصدقاء', 'Friends'), icon: Users, count: data.counts.friends },
    { id: 'photos', label: t('الصور', 'Photos'), icon: ImageIcon, count: photos.length },
  ];

  const friendsGrid = (limit?: number) => (!data.friends.length
    ? <p className="py-3 text-xs text-stone-500">{isMe ? t('لسه مفيش أصدقاء — دوّر على صناع عطور وابعتلهم طلب.', 'No friends yet — find perfumers and add them.') : t('مفيش أصدقاء ظاهرين.', 'No friends to show.')}</p>
    : (
      <div className="grid grid-cols-3 gap-2">
        {data.friends.slice(0, limit).map((f) => (
          <button key={f.id} type="button" onClick={() => go(`u/${f.handle}`)} className="group flex flex-col items-center gap-1 rounded-xl p-2 text-center hover:bg-stone-50 cursor-pointer">
            <Avatar user={f} size={56} />
            <span className="w-full truncate text-[11px] font-bold text-stone-800 group-hover:text-amber-800">{f.name}</span>
          </button>
        ))}
      </div>
    ));

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden shadow-md">
        <div className="relative h-40 w-full bg-gradient-to-br from-stone-900 via-amber-900 to-amber-600 sm:h-60">
          <div className="absolute inset-0 opacity-30 [background:radial-gradient(circle_at_20%_30%,rgba(251,191,36,.6),transparent_45%),radial-gradient(circle_at_80%_70%,rgba(244,63,94,.35),transparent_40%)]" />
          {isMe && (
            <button type="button" onClick={() => go('me/profile')} className="absolute bottom-4 end-4 flex items-center gap-1.5 rounded-xl bg-white/85 px-3 py-1.5 text-xs font-bold text-stone-900 shadow backdrop-blur hover:bg-white cursor-pointer">
              <Edit3 className="h-3.5 w-3.5" />{t('تعديل الملف', 'Edit profile')}
            </button>
          )}
        </div>
        <div className="px-4 pb-4 sm:px-6">
          <div className="-mt-14 flex flex-col gap-4 sm:-mt-16 sm:flex-row sm:items-end">
            <div className="relative shrink-0 self-center sm:self-start">
              <span className="inline-block rounded-full border-4 border-white shadow-xl ring-2 ring-amber-400"><Avatar user={u} size={112} /></span>
              {u.online && <span className="absolute bottom-2 end-2 h-4 w-4 rounded-full border-2 border-white bg-emerald-500" />}
            </div>
            <div className="min-w-0 flex-1 pb-1 text-center sm:text-start">
              <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                <h1 className="text-2xl font-black text-stone-900 sm:text-3xl">{u.name}</h1>
                <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-900">{craftTitle}</span>
                {u.merchant && <button type="button" onClick={() => go(`store/${u.merchant!.slug}`)} className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-900 hover:bg-emerald-200 cursor-pointer">🏪 {u.merchant.storeName}</button>}
              </div>
              <p className="mt-1 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-xs text-stone-500 sm:justify-start">
                <span className="font-semibold text-stone-700">@{u.handle}</span>
                <span>·</span><span className="flex items-center gap-1"><Users className="h-3 w-3" />{data.counts.friends} {t('صديق', 'friends')}</span>
                {u.country && <><span>·</span><span className="flex items-center gap-1"><MapPin className="h-3 w-3 text-rose-500" />{u.country}</span></>}
                <span>·</span>
                {u.online ? <span className="font-bold text-emerald-600">{t('متصل الآن', 'Active now')}</span> : <span>{t('آخر ظهور', 'last seen')} {timeAgo(u.lastSeen, lang)}</span>}
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2 pb-1">
              {data.relation === 'none' && <Btn onClick={() => void act(() => cx(`/community/friends/${u.id}`, { body: {} }), t('اتبعت طلب الصداقة ✨', 'Request sent ✨'))}><UserPlus className="h-4 w-4" />{t('إضافة صديق', 'Add friend')}</Btn>}
              {data.relation === 'requested' && <Btn variant="soft" onClick={() => void act(() => cx(`/community/friends/${u.id}`, { method: 'DELETE' }))}>{t('إلغاء الطلب', 'Cancel request')}</Btn>}
              {data.relation === 'incoming' && <Btn onClick={() => void act(() => cx(`/community/friends/${u.id}`, { body: {} }), t('بقيتوا أصدقاء 🎉', 'Friends now 🎉'))}><UserCheck className="h-4 w-4" />{t('قبول الصداقة', 'Accept')}</Btn>}
              {data.relation === 'friends' && <Btn variant="soft" onClick={() => { if (confirm(t('إلغاء الصداقة؟', 'Unfriend?'))) void act(() => cx(`/community/friends/${u.id}`, { method: 'DELETE' })); }}><UserMinus className="h-4 w-4" />{t('أصدقاء', 'Friends')}</Btn>}
              {!isMe && data.relation !== 'blocked' && <Btn variant="dark" onClick={() => message()}><MessageCircle className="h-4 w-4" />{t('مراسلة', 'Message')}</Btn>}
              <Btn variant="ghost" onClick={() => void share()} title={t('مشاركة', 'Share')}><Share2 className="h-4 w-4" /></Btn>
              {data.relation === 'blocked'
                ? <Btn variant="ghost" onClick={() => void act(() => cx(`/community/blocks/${u.id}`, { method: 'DELETE' }))}>{t('إلغاء الحظر', 'Unblock')}</Btn>
                : !isMe && <Btn variant="ghost" title={t('حظر', 'Block')} onClick={() => { if (confirm(t('حظر الحساب ده؟ مش هيقدر يراسلك أو يشوف منشوراتك.', 'Block this account?'))) void act(() => cx(`/community/blocks/${u.id}`, { body: {} }), t('اتحظر', 'Blocked')); }}><ShieldOff className="h-4 w-4" /></Btn>}
              {!isMe && <Btn variant="ghost" title={t('إبلاغ', 'Report')} onClick={() => { const reason = prompt(t('سبب الإبلاغ:', 'Reason:')); if (reason !== null) void act(() => cx('/community/reports', { body: { kind: 'user', id: u.id, reason } }), t('وصل البلاغ للإدارة', 'Report sent')); }}><Flag className="h-4 w-4" /></Btn>}
            </div>
          </div>
          {u.bio && <p className="mt-3 whitespace-pre-wrap text-center text-sm leading-relaxed text-stone-700 sm:text-start">{u.bio}</p>}
        </div>
        <div className="flex overflow-x-auto border-t border-stone-100 no-scrollbar">
          {tabs.map((tb) => (
            <button key={tb.id} type="button" onClick={() => setTab(tb.id)}
              className={`flex shrink-0 flex-1 items-center justify-center gap-1.5 px-3 py-3 text-xs font-bold transition cursor-pointer sm:text-sm ${tab === tb.id ? 'border-b-2 border-amber-600 text-amber-800' : 'text-stone-500 hover:bg-stone-50'}`}>
              <tb.icon className="h-4 w-4" />{tb.label}{tb.count != null && <span className="rounded-full bg-stone-100 px-1.5 text-[10px] text-stone-600">{tb.count}</span>}
            </button>
          ))}
        </div>
      </Card>

      {tab === 'timeline' && (
        <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="space-y-4">
            <Card className="space-y-2 p-4 text-sm text-stone-700">
              <h3 className="font-black text-stone-900">{t('نبذة', 'Intro')}</h3>
              {u.bio ? <p className="line-clamp-4 text-xs leading-relaxed">{u.bio}</p> : isMe ? <button type="button" onClick={() => go('me/profile')} className="text-xs font-bold text-amber-700 hover:underline cursor-pointer">{t('+ اكتب نبذة عنك', '+ Add a bio')}</button> : null}
              <p className="flex items-center gap-2 text-xs"><Sparkles className="h-3.5 w-3.5 text-amber-600" />{craftTitle}</p>
              {u.country && <p className="flex items-center gap-2 text-xs"><MapPin className="h-3.5 w-3.5 text-rose-500" />{u.country}</p>}
            </Card>
            <Card className="p-4">
              <div className="mb-2 flex items-center justify-between"><h3 className="font-black text-stone-900">{t('الأصدقاء', 'Friends')}</h3>{data.counts.friends > 9 && <button type="button" onClick={() => setTab('friends')} className="text-xs font-bold text-amber-700 cursor-pointer">{t('الكل', 'All')}</button>}</div>
              {friendsGrid(9)}
            </Card>
          </aside>
          <div className="space-y-4">
            {data.posts.length ? data.posts.map((p) => (
              <PostCard key={p.id} post={p} lang={lang} go={go} toast={toast} onOpenMessenger={onOpenMessenger}
                onChange={(np) => setData({ ...data, posts: data.posts.map((x) => (x.id === np.id ? np : x)) })}
                onRemove={(id) => setData({ ...data, posts: data.posts.filter((x) => x.id !== id) })} />
            )) : <Card><Empty icon={<BookOpen className="h-10 w-10 text-stone-300" />} title={isMe ? t('لسه منشرتش حاجة', 'You have not posted yet') : t('مفيش منشورات ظاهرة لك', 'No posts visible to you')}
              body={isMe ? t('شارك أول تجربة أو تركيبة من صفحة المجتمع.', 'Share your first test or recipe from the community page.') : undefined}
              action={isMe ? <Btn small onClick={() => go('')}>{t('اكتب منشور', 'Write a post')}</Btn> : undefined} /></Card>}
          </div>
        </div>
      )}

      {tab === 'about' && (
        <Card className="grid gap-3 p-5 sm:grid-cols-2">
          <Info label={t('الاسم', 'Name')} value={u.name} />
          <Info label={t('المستوى', 'Craft level')} value={craftTitle} />
          <Info label={t('الدولة', 'Country')} value={u.country || t('مش محددة', 'Not set')} />
          <Info label={t('عضو من', 'Member since')} value={data.since ? <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />{new Date(data.since).toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-GB', { year: 'numeric', month: 'long' })}</span> : '—'} />
          {u.merchant && <Info label={t('المتجر', 'Store')} value={<button type="button" onClick={() => go(`store/${u.merchant!.slug}`)} className="font-bold text-emerald-700 hover:underline cursor-pointer">🏪 {u.merchant.storeName}</button>} />}
          <div className="sm:col-span-2"><Info label={t('نبذة', 'Bio')} value={u.bio || t('لسه مكتبش نبذة.', 'No bio yet.')} /></div>
        </Card>
      )}

      {tab === 'recipes' && (data.recipes.length ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {data.recipes.map((r) => (
            <Card key={r.id} className="space-y-2 p-3">
              <RecipeCard lang={lang} title={r.title} data={r.data} />
              <div className="flex items-center justify-between text-[11px] text-stone-400">
                <span>{timeAgo(r.updatedAt, lang)}</span>
                <Btn small onClick={() => useRecipe(r.title, r.data)}><FlaskConical className="h-3.5 w-3.5" />{t('استخدم التركيبة دي', 'Use this recipe')}</Btn>
              </div>
            </Card>
          ))}
        </div>
      ) : <Card><Empty icon={<FlaskConical className="h-10 w-10 text-stone-300" />} title={t('مفيش تركيبات منشورة', 'No shared recipes')}
        body={isMe ? t('من «بوابتي ← تركيباتي» تقدر تخلي أي تركيبة ظاهرة لأصدقائك أو للكل.', 'From «My portal → Recipes» you can share any recipe with friends or everyone.') : undefined} /></Card>)}

      {tab === 'friends' && <Card className="p-4"><h3 className="mb-2 font-black text-stone-900">{t('الأصدقاء', 'Friends')} ({data.counts.friends})</h3>{friendsGrid()}</Card>}

      {tab === 'photos' && (photos.length ? (
        <Card className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-3">
          {photos.map((p) => <a key={p.id} href={p.src} target="_blank" rel="noreferrer" className="block aspect-square overflow-hidden rounded-xl bg-stone-100"><img src={p.src} alt="" loading="lazy" className="h-full w-full object-cover transition hover:scale-105" /></a>)}
        </Card>
      ) : <Card><Empty icon={<ImageIcon className="h-10 w-10 text-stone-300" />} title={t('مفيش صور لسه', 'No photos yet')} /></Card>)}
    </div>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-stone-100 bg-stone-50/60 p-3">
      <p className="text-[11px] font-bold text-stone-500">{label}</p>
      <div className="mt-0.5 text-sm font-semibold text-stone-900">{value}</div>
    </div>
  );
}
