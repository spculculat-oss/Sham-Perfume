/**
 * «مجلس النقاش» — the public discussion salon of «مجتمع شام» (the merchant's AI Studio design, on real data):
 * categories, search, newest / most voted / unanswered, one vote per member, replies and the answer that solved it
 * (chosen by the person who asked). Every thread and reply is a real member's; an empty salon invites the first one.
 */
import { useEffect, useState } from 'react';
import { CheckCircle2, ChevronUp, MessageCircle, MessageSquare, Plus, Search, Send, Share2, Trash2, X } from 'lucide-react';
import { cx, type Thread, type ThreadView } from './api';
import { pulseNow } from './session';
import { Avatar, Btn, Card, Sheet, Spinner, errorText, inputClass, timeAgo, tx, useLoad, type Lang } from './ui';

export const CATEGORIES = [
  { id: 'all', icon: '🌟', ar: 'كل النقاشات', en: 'All topics' },
  { id: 'maceration', icon: '🔬', ar: 'المعمل والتعتيق', en: 'Lab & maceration' },
  { id: 'materials', icon: '🌿', ar: 'المواد الخام والزيوت', en: 'Raw materials & oils' },
  { id: 'review', icon: '💡', ar: 'نقد وتحليل التركيبات', en: 'Formula reviews' },
  { id: 'sourcing', icon: '🛒', ar: 'الشراء والزجاجات والتغليف', en: 'Sourcing & bottles' },
  { id: 'cafe', icon: '☕', ar: 'قهوة العطارين', en: 'Perfumers’ café' },
];
export const categoryLabel = (id: string, lang: Lang) => {
  const c = CATEGORIES.find((x) => x.id === id) || CATEGORIES[CATEGORIES.length - 1];
  return `${c.icon} ${lang === 'ar' ? c.ar : c.en}`;
};

type Go = (route: string) => void;

export function DiscussionsPage({ lang, go, toast, onOpenMessenger, threadId }: { lang: Lang; go: Go; toast: (s: string) => void; onOpenMessenger?: (userId: string) => void; threadId?: string }) {
  const t = tx(lang);
  const [category, setCategory] = useState('all');
  const [sort, setSort] = useState<'new' | 'top' | 'unsolved'>('new');
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [creating, setCreating] = useState(false);
  useEffect(() => { const id = setTimeout(() => setQ(search.trim()), 300); return () => clearTimeout(id); }, [search]);
  const list = useLoad(() => cx<Thread[]>(`/community/discussions?category=${category}&sort=${sort}&q=${encodeURIComponent(q)}`), [category, sort, q]);

  const vote = async (th: Thread, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const out = await cx<ThreadView>(`/community/discussions/${th.id}/vote`, { body: { on: !th.voted } });
      list.setData((l) => l?.map((x) => (x.id === th.id ? { ...x, votes: out.votes, voted: out.voted } : x)));
    } catch (err) { toast(errorText(err, lang)); }
  };

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden border-0 bg-gradient-to-br from-stone-900 via-amber-950 to-stone-900 p-5 text-white sm:p-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1.5">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/20 px-3 py-1 text-[11px] font-bold text-amber-300">💬 {t('مجلس النقاش العام', 'Public discussions')}</span>
            <h1 className="text-2xl font-black text-white sm:text-3xl">{t('صالون شام لصناع العطور', 'Sham perfumers’ salon')}</h1>
            <p className="max-w-2xl text-xs leading-relaxed text-stone-300 sm:text-sm">
              {t('اسأل عن التعتيق والفوحان، شارك تجربتك مع خامة، اطلب نقد لتركيبتك، أو اسأل عن مصادر الشراء — والإجابة اللي حلّت مشكلتك بتتعلّم «معتمدة».',
                'Ask about maceration and projection, share a material test, get a formula critique or ask about sourcing — the answer that solved it gets marked.')}
            </p>
          </div>
          <button type="button" onClick={() => setCreating(true)}
            className="flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-600 to-amber-700 px-5 py-3 text-sm font-bold text-white shadow-lg transition hover:scale-105 hover:from-amber-500 hover:to-amber-600 cursor-pointer">
            <Plus className="h-4 w-4" />{t('اسأل أو ابدأ نقاش', 'Ask / start a discussion')}
          </button>
        </div>
      </Card>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
          {CATEGORIES.map((cat) => (
            <button key={cat.id} type="button" onClick={() => setCategory(cat.id)}
              className={`flex shrink-0 items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition cursor-pointer ${category === cat.id ? 'bg-amber-800 text-white shadow-sm' : 'border border-stone-200 bg-white text-stone-700 hover:bg-stone-50'}`}>
              <span>{cat.icon}</span><span>{lang === 'ar' ? cat.ar : cat.en}</span>
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} className="rounded-xl border border-stone-200 bg-white px-2 py-2 text-xs font-bold text-stone-700">
            <option value="new">{t('الأحدث نشاطاً', 'Latest activity')}</option>
            <option value="top">{t('الأكثر تصويتاً', 'Most voted')}</option>
            <option value="unsolved">{t('بدون إجابة معتمدة', 'Unanswered')}</option>
          </select>
          <div className="relative min-w-[200px] flex-1">
            <Search className="absolute inset-y-0 start-3 my-auto h-4 w-4 text-stone-400" />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('ابحث في النقاشات…', 'Search discussions…')}
              className="w-full rounded-xl border border-stone-200 bg-white py-2 ps-9 pe-3 text-xs text-stone-900 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200" />
          </div>
        </div>
      </div>

      {list.error ? <p className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{errorText(list.error, lang)}</p> : null}
      {list.loading && !list.data ? <Spinner /> : (
        <div className="space-y-3">
          {!list.data?.length ? (
            <Card className="p-8 text-center text-stone-500">
              <MessageSquare className="mx-auto h-12 w-12 text-stone-300" />
              <p className="mt-2 text-sm font-bold text-stone-700">{q || category !== 'all' || sort !== 'new' ? t('مفيش نقاشات بالشكل ده', 'No matching discussions') : t('المجلس لسه فاضي', 'The salon is still empty')}</p>
              <p className="mt-1 text-xs text-stone-400">{t('كن أول من يطرح سؤال أو يشارك تجربة — أول مشاركات المجتمع بتفرق!', 'Be the first to ask or share — the first posts matter!')}</p>
              <Btn small className="mt-3" onClick={() => setCreating(true)}><Plus className="h-3.5 w-3.5" />{t('ابدأ أول نقاش', 'Start the first one')}</Btn>
            </Card>
          ) : list.data.map((th) => (
            <Card key={th.id} onClick={() => go(`discussions/${th.id}`)}
              className={`group flex cursor-pointer gap-3 p-4 transition hover:border-amber-300 hover:shadow-md sm:gap-4 ${th.pinned ? 'border-amber-300/80 bg-amber-50/20' : ''}`}>
              <button type="button" onClick={(e) => void vote(th, e)} title={t('صوّت للموضوع ده', 'Vote')}
                className={`flex h-20 w-12 shrink-0 flex-col items-center justify-center rounded-xl border transition cursor-pointer ${th.voted ? 'border-amber-400 bg-amber-100/70 text-amber-900' : 'border-stone-200 bg-stone-50 text-stone-600 hover:border-amber-300 hover:bg-stone-100'}`}>
                <ChevronUp className="h-5 w-5" /><span className="text-xs font-black">{th.votes}</span><span className="text-[9px] text-stone-400">{t('صوت', 'votes')}</span>
              </button>
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  {th.pinned && <span className="rounded-md bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">📌 {t('مثبّت', 'Pinned')}</span>}
                  <span className="rounded-md bg-stone-100 px-2 py-0.5 text-[10px] font-semibold text-stone-700">{categoryLabel(th.category, lang)}</span>
                  {th.solvedReply && <span className="flex items-center gap-1 rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800"><CheckCircle2 className="h-3 w-3" />{t('اتحلّت', 'Solved')}</span>}
                  <span className="ms-auto text-[11px] text-stone-400">{timeAgo(th.lastAt, lang)}</span>
                </div>
                <h3 className="text-base font-bold text-stone-900 group-hover:text-amber-800">{th.title}</h3>
                {th.body && <p className="line-clamp-2 text-xs leading-relaxed text-stone-600">{th.body}</p>}
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-stone-100 pt-1">
                  <div className="flex flex-wrap gap-1.5">{th.tags.map((tag) => <span key={tag} className="rounded-full bg-stone-100 px-2 py-0.5 text-[10px] text-stone-600">#{tag}</span>)}</div>
                  <div className="flex items-center gap-3 text-xs text-stone-500">
                    <span className="flex items-center gap-1.5"><Avatar user={th.author} size={22} /><span className="font-semibold text-stone-800">{th.author.name.split(' ')[0]}</span></span>
                    <span className="flex items-center gap-1 font-bold text-amber-800"><MessageSquare className="h-3.5 w-3.5" />{th.replies} {t('رد', 'replies')}</span>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {creating && <NewThread lang={lang} onClose={() => setCreating(false)} toast={toast}
        defaultCategory={category === 'all' ? 'cafe' : category}
        onDone={(th) => { setCreating(false); toast(t('اتنشر النقاش ✨', 'Discussion posted ✨')); go(`discussions/${th.id}`); }} />}
      {threadId && <ThreadSheet lang={lang} id={threadId} go={go} toast={toast} onOpenMessenger={onOpenMessenger}
        onClose={() => { go('discussions'); void list.reload(true); }} />}
    </div>
  );
}

function NewThread({ lang, onClose, onDone, toast, defaultCategory }: { lang: Lang; onClose: () => void; onDone: (t: ThreadView) => void; toast: (s: string) => void; defaultCategory: string }) {
  const t = tx(lang);
  const [form, setForm] = useState({ title: '', body: '', category: defaultCategory, tags: '' });
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    try { onDone(await cx<ThreadView>('/community/discussions', { body: form })); } catch (e) { toast(errorText(e, lang)); } finally { setBusy(false); }
  };
  return (
    <Sheet title={t('نقاش جديد', 'New discussion')} onClose={onClose}>
      <div className="space-y-3">
        <select className={inputClass} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
          {CATEGORIES.filter((c) => c.id !== 'all').map((c) => <option key={c.id} value={c.id}>{c.icon} {lang === 'ar' ? c.ar : c.en}</option>)}
        </select>
        <input className={inputClass} maxLength={160} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
          placeholder={t('عنوان واضح — مثال: ليه العطر بيختفي بعد ساعة؟', 'A clear title — e.g. why does my perfume fade after an hour?')} />
        <textarea className={`${inputClass} resize-none`} rows={5} maxLength={6000} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })}
          placeholder={t('اكتب التفاصيل: الخامات، النسب، مدة التعتيق، اللي جربته…', 'Details: materials, ratios, maceration time, what you tried…')} />
        <input className={inputClass} value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder={t('وسوم (اختياري): عود، تعتيق، مثبتات', 'Tags (optional): oud, maceration, fixatives')} />
        <Btn className="w-full" busy={busy} disabled={form.title.trim().length < 5} onClick={() => void submit()}>{t('انشر النقاش', 'Post discussion')}</Btn>
      </div>
    </Sheet>
  );
}

function ThreadSheet({ lang, id, go, toast, onClose, onOpenMessenger }: { lang: Lang; id: string; go: Go; toast: (s: string) => void; onClose: () => void; onOpenMessenger?: (userId: string) => void }) {
  const t = tx(lang);
  const th = useLoad(() => cx<ThreadView>(`/community/discussions/${id}`), [id]);
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<ThreadView | unknown>, done?: string) => {
    try { const out = await fn(); if (out && typeof out === 'object' && 'replyList' in out) th.setData(out as ThreadView); if (done) toast(done); void pulseNow(); } catch (e) { toast(errorText(e, lang)); }
  };
  const send = async () => {
    setBusy(true);
    await run(() => cx<ThreadView>(`/community/discussions/${id}/replies`, { body: { body: reply } }));
    setReply(''); setBusy(false);
  };
  const share = async () => {
    const url = `${location.origin}${location.pathname}#community/discussions/${id}`;
    try { await navigator.clipboard.writeText(url); toast(t('اتنسخ رابط النقاش', 'Link copied')); } catch { toast(url); }
  };
  const data = th.data;

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-stone-950/70 p-0 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
      <div className="flex max-h-[94vh] w-full flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:max-w-2xl sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-2 border-b border-stone-100 px-4 py-3">
          <span className="text-xs font-bold text-stone-500">{data ? categoryLabel(data.category, lang) : ''}</span>
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => void share()} className="rounded-full p-2 text-stone-500 hover:bg-stone-100 cursor-pointer" title={t('نسخ الرابط', 'Copy link')}><Share2 className="h-4 w-4" /></button>
            <button type="button" onClick={onClose} className="rounded-full p-2 text-stone-500 hover:bg-stone-100 cursor-pointer" aria-label={t('إغلاق', 'Close')}><X className="h-4 w-4" /></button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          {th.error ? <p className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{errorText(th.error, lang)}</p> : !data ? <Spinner /> : (
            <div className="space-y-4">
              <div className="flex gap-3">
                <button type="button" onClick={() => void run(() => cx(`/community/discussions/${id}/vote`, { body: { on: !data.voted } }))}
                  className={`flex h-16 w-11 shrink-0 flex-col items-center justify-center rounded-xl border cursor-pointer ${data.voted ? 'border-amber-400 bg-amber-100 text-amber-900' : 'border-stone-200 bg-stone-50 text-stone-600'}`}>
                  <ChevronUp className="h-5 w-5" /><span className="text-xs font-black">{data.votes}</span>
                </button>
                <div className="min-w-0 flex-1">
                  <h2 className="text-lg font-black leading-snug text-stone-900">{data.title}</h2>
                  <button type="button" onClick={() => go(`u/${data.author.handle}`)} className="mt-1 flex items-center gap-2 text-xs text-stone-500 cursor-pointer">
                    <Avatar user={data.author} size={24} /><span className="font-bold text-stone-800">{data.author.name}</span><span>· {timeAgo(data.createdAt, lang)}</span>
                  </button>
                </div>
              </div>
              {data.body && <p className="whitespace-pre-wrap text-sm leading-7 text-stone-700">{data.body}</p>}
              {!!data.tags.length && <div className="flex flex-wrap gap-1.5">{data.tags.map((tag) => <span key={tag} className="rounded-full bg-stone-100 px-2 py-0.5 text-[11px] text-stone-600">#{tag}</span>)}</div>}
              <div className="flex flex-wrap gap-2">
                {!data.mine && onOpenMessenger && <Btn small variant="soft" onClick={() => onOpenMessenger(data.author.id)}><MessageCircle className="h-3.5 w-3.5" />{t('راسل صاحب السؤال', 'Message the author')}</Btn>}
                {data.mine && <Btn small variant="ghost" onClick={() => { if (confirm(t('تمسح النقاش ده؟', 'Delete this discussion?'))) void run(() => cx(`/community/discussions/${id}`, { method: 'DELETE' }), t('اتمسح', 'Deleted')).then(onClose); }}><Trash2 className="h-3.5 w-3.5" />{t('مسح', 'Delete')}</Btn>}
              </div>

              <div className="border-t border-stone-100 pt-3">
                <p className="mb-2 text-sm font-black text-stone-900">{t(`الردود (${data.replies})`, `Replies (${data.replies})`)}</p>
                {!data.replyList.length && <p className="rounded-xl bg-stone-50 p-4 text-center text-xs text-stone-500">{t('لسه مفيش ردود — شارك خبرتك وكن أول من يرد.', 'No replies yet — be the first to help.')}</p>}
                <div className="space-y-2.5">
                  {data.replyList.map((r) => (
                    <div key={r.id} className={`rounded-2xl border p-3 ${r.accepted ? 'border-emerald-300 bg-emerald-50/60' : 'border-stone-100 bg-stone-50/60'}`}>
                      <div className="flex items-center gap-2">
                        <button type="button" onClick={() => go(`u/${r.author.handle}`)} className="flex min-w-0 items-center gap-2 cursor-pointer"><Avatar user={r.author} size={26} /><span className="truncate text-xs font-bold text-stone-800">{r.author.name}</span></button>
                        <span className="text-[11px] text-stone-400">{timeAgo(r.createdAt, lang)}</span>
                        {r.accepted && <span className="ms-auto flex items-center gap-1 rounded-md bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white"><CheckCircle2 className="h-3 w-3" />{t('الإجابة المعتمدة', 'Accepted answer')}</span>}
                      </div>
                      <p className="mt-1.5 whitespace-pre-wrap text-sm leading-6 text-stone-700">{r.body}</p>
                      <div className="mt-1.5 flex flex-wrap gap-3 text-[11px] font-bold">
                        {data.mine && <button type="button" className="text-emerald-700 hover:underline cursor-pointer" onClick={() => void run(() => cx(`/community/discussions/${id}/solve`, { body: { replyId: r.accepted ? null : r.id } }), r.accepted ? undefined : t('اتعلّمت كإجابة معتمدة ✅', 'Marked as the answer ✅'))}>
                          {r.accepted ? t('إلغاء الاعتماد', 'Unmark') : t('اعتمد كإجابة', 'Mark as answer')}</button>}
                        {(r.mine || data.mine) && <button type="button" className="text-stone-400 hover:text-rose-600 cursor-pointer" onClick={() => void run(async () => { await cx(`/community/discussion-replies/${r.id}`, { method: 'DELETE' }); return cx<ThreadView>(`/community/discussions/${id}`); })}>{t('مسح', 'Delete')}</button>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
        {data && (
          <div className="flex items-end gap-2 border-t border-stone-100 p-3">
            <textarea className={`${inputClass} resize-none`} rows={2} maxLength={4000} value={reply} onChange={(e) => setReply(e.target.value)} placeholder={t('اكتب ردك أو خبرتك…', 'Write your reply…')} />
            <Btn busy={busy} disabled={!reply.trim()} onClick={() => void send()} aria-label={t('إرسال', 'Send')}><Send className="h-4 w-4" /></Btn>
          </div>
        )}
      </div>
    </div>
  );
}
