/**
 * «شارك في المجتمع» — what a member made or asked in a section of the site (community/share.ts) becomes a post, a
 * discussion in the salon, or a story (يومية, 24 hours). The member sees everything first, can edit it, and chooses
 * where it goes and who sees it; nothing is sent before «انشر».
 */
import React, { useMemo, useState } from 'react';
import { BookOpen, Coffee, FlaskConical, Globe2, Newspaper, Share2, Sparkles, Users } from 'lucide-react';
import { cx, type Post, type ThreadView } from './api';
import { CATEGORIES } from './DiscussionsPage';
import { RecipeCard } from './SocialPortal';
import { pulseNow } from './session';
import {
  clearShareDraft, defaultDestination, postText, readShareDraft, sectionName, SHARE_LIMITS, SHARE_THREAD_CATEGORIES,
  storyCaption, threadCategory, threadDraft, type ShareDestination, type ShareDraft,
} from './share';
import { Btn, Card, Empty, errorText, Field, inputClass, tx, type Lang } from './ui';

type Go = (route: string) => void;

export function SharePage({ lang, go, toast }: { lang: Lang; go: Go; toast: (s: string) => void }) {
  const t = tx(lang);
  const [draft] = useState<ShareDraft | null>(() => readShareDraft());
  const [dest, setDest] = useState<ShareDestination>(() => (draft ? defaultDestination(draft) : 'post'));
  const [title, setTitle] = useState(draft?.title || '');
  const [body, setBody] = useState(draft?.body || '');
  const [visibility, setVisibility] = useState<'public' | 'friends'>('public');
  const [attachRecipe, setAttachRecipe] = useState(Boolean(draft?.recipe));
  const [category, setCategory] = useState<string>(() => (draft ? threadCategory(draft.source) : 'cafe'));
  const [busy, setBusy] = useState(false);

  const edited = useMemo<ShareDraft | null>(() => (draft ? { ...draft, title: title.trim(), body: body.trim() } : null), [draft, title, body]);
  const preview = useMemo(() => {
    if (!edited) return '';
    if (dest === 'story') return storyCaption(edited, lang);
    if (dest === 'discussion') { const th = threadDraft(edited, lang); return `${th.title}\n\n${th.body}`; }
    return postText(edited, lang);
  }, [edited, dest, lang]);

  if (!draft || !edited) {
    return (
      <Card className="mx-auto max-w-2xl p-8">
        <Empty icon={<Share2 className="h-12 w-12 text-amber-700" />} title={t('مفيش حاجة مستنية المشاركة', 'Nothing waiting to be shared')}
          body={t('من أي قسم في شام (حاسبة التركيب، الهرم العطري، مصمم التركيبات، أسئلة شاهين…) دوس «شارك في المجتمع» وهتوصل هنا.', 'From any section of Sham (the compounding calculator, the pyramid, the formulator, Shaheen’s answers…) press “Share to the community” to land here.')}
          action={<Btn onClick={() => go('')}>{t('رجوع للمجتمع', 'Back to the community')}</Btn>} />
      </Card>
    );
  }

  const tooShortThread = dest === 'discussion' && threadDraft(edited, lang).title.length < 5;
  const emptyQuestion = draft.kind === 'question' && !edited.body && dest !== 'story';

  const publish = async () => {
    setBusy(true);
    try {
      if (dest === 'post') {
        let recipeId: string | undefined;
        if (attachRecipe && draft.recipe) {
          const saved = await cx<{ id: string }>('/community/me/recipes', { body: { title: (edited.title || draft.recipe.title).slice(0, SHARE_LIMITS.title), data: draft.recipe.data, notes: '', visibility } });
          recipeId = saved.id;
        }
        const post = await cx<Post>('/community/posts', { body: { body: postText(edited, lang), visibility, recipeId } });
        clearShareDraft();
        toast(t('اتنشر في المجتمع ✅', 'Shared to the community ✅'));
        go(`post/${post.id}`);
      } else if (dest === 'discussion') {
        const th = threadDraft(edited, lang);
        const made = await cx<ThreadView>('/community/discussions', { body: { ...th, category } });
        clearShareDraft();
        toast(t('اتفتح النقاش في المجلس ✅', 'Discussion opened in the salon ✅'));
        go(`discussions/${made.id}`);
      } else {
        await cx('/community/stories', { body: { caption: storyCaption(edited, lang), bg: 'amber', visibility } });
        clearShareDraft();
        toast(t('اتنشرت يوميتك لمدة 24 ساعة ✅', 'Your story is up for 24 hours ✅'));
        go('');
      }
      void pulseNow();
    } catch (e) {
      toast(errorText(e, lang));
    } finally {
      setBusy(false);
    }
  };

  const cancel = () => { clearShareDraft(); go(`../${draft.source === 'chat' ? 'master_ai' : draft.source === 'productDetail' ? 'store' : draft.source}`); };

  const options: { id: ShareDestination; icon: React.ReactNode; label: string; hint: string }[] = [
    { id: 'post', icon: <Newspaper className="h-5 w-5" />, label: t('منشور', 'Post'), hint: t('على الصفحة الرئيسية وبروفايلك', 'On the home feed and your profile') },
    { id: 'discussion', icon: <Coffee className="h-5 w-5" />, label: t('نقاش في المجلس', 'Salon discussion'), hint: t('سؤال أو رأي يرد عليه الأعضاء', 'A question or an opinion members answer') },
    { id: 'story', icon: <Sparkles className="h-5 w-5" />, label: t('يومية (24 ساعة)', 'Story (24 hours)'), hint: t('سطر قصير يختفي بعد يوم', 'A short line that disappears after a day') },
  ];

  return (
    <div className="mx-auto max-w-3xl space-y-4" data-testid="community-share">
      <Card className="p-4 sm:p-5">
        <p className="flex items-center gap-2 text-xs font-bold text-amber-800"><Share2 className="h-4 w-4" />{t('مشاركة من', 'Sharing from')} «{sectionName(draft.source, lang)}»</p>
        <h1 className="mt-1 text-lg font-black text-stone-900">{draft.kind === 'question' ? t('اسأل مجتمع شام', 'Ask the Sham community') : t('شارك اللي عملته مع مجتمع شام', 'Share what you made with the Sham community')}</h1>
        <p className="mt-1 text-xs text-stone-500">{t('راجع وعدّل براحتك. مفيش حاجة بتتنشر غير لما تدوس «انشر».', 'Review and edit freely. Nothing is published until you press “Publish”.')}</p>
      </Card>

      <Card className="p-4 sm:p-5 space-y-4">
        <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label={t('هتنشرها فين؟', 'Where to share?')}>
          {options.map((o) => (
            <button key={o.id} type="button" role="radio" aria-checked={dest === o.id} onClick={() => setDest(o.id)} data-testid={`share-dest-${o.id}`}
              className={`flex items-start gap-2.5 rounded-2xl border p-3 text-start transition cursor-pointer ${dest === o.id ? 'border-amber-500 bg-amber-50 ring-2 ring-amber-200' : 'border-stone-200 hover:border-amber-300'}`}>
              <span className="mt-0.5 text-amber-800">{o.icon}</span>
              <span><span className="block text-sm font-black text-stone-900">{o.label}</span><span className="block text-[11px] text-stone-500">{o.hint}</span></span>
            </button>
          ))}
        </div>

        <Field label={dest === 'discussion' ? t('عنوان النقاش', 'Discussion title') : t('العنوان', 'Title')}>
          <input className={inputClass} value={title} maxLength={SHARE_LIMITS.title} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        {dest !== 'story' && (
          <Field label={draft.kind === 'question' ? t('سؤالك والتفاصيل', 'Your question and the details') : t('التفاصيل', 'Details')}>
            <textarea className={`${inputClass} resize-y`} rows={8} value={body} maxLength={SHARE_LIMITS.body} onChange={(e) => setBody(e.target.value)}
              placeholder={t('اكتب سؤالك: الخامات، النسب، اللي جربته، واللي محتاج تعرفه…', 'Write your question: materials, ratios, what you tried and what you need to know…')} />
          </Field>
        )}

        {dest === 'discussion' && (
          <Field label={t('القسم في المجلس', 'Salon category')}>
            <select className={inputClass} value={category} onChange={(e) => setCategory(e.target.value)}>
              {CATEGORIES.filter((c) => (SHARE_THREAD_CATEGORIES as readonly string[]).includes(c.id)).map((c) => <option key={c.id} value={c.id}>{c.icon} {lang === 'ar' ? c.ar : c.en}</option>)}
            </select>
          </Field>
        )}

        {dest !== 'discussion' && (
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t('مين يشوفها؟', 'Who can see it?')}>
            {([['public', <Globe2 key="g" className="h-4 w-4" />, t('الكل', 'Everyone')], ['friends', <Users key="u" className="h-4 w-4" />, t('أصدقائي بس', 'Friends only')]] as const).map(([v, icon, label]) => (
              <button key={v} type="button" role="radio" aria-checked={visibility === v} onClick={() => setVisibility(v)}
                className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold cursor-pointer ${visibility === v ? 'bg-amber-800 text-white' : 'border border-stone-200 bg-white text-stone-700 hover:bg-stone-50'}`}>
                {icon}{label}
              </button>
            ))}
          </div>
        )}

        {dest === 'post' && draft.recipe && (
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-xs font-bold text-stone-700 cursor-pointer">
              <input type="checkbox" checked={attachRecipe} onChange={(e) => setAttachRecipe(e.target.checked)} className="h-4 w-4 accent-amber-700" />
              <FlaskConical className="h-4 w-4 text-amber-700" />{t('أرفق كارت التركيبة (الأعضاء يقدروا يفتحوها في الحاسبة)', 'Attach the formula card (members can open it in the calculator)')}
            </label>
            {attachRecipe && <RecipeCard lang={lang} title={edited.title || draft.recipe.title} data={draft.recipe.data} />}
          </div>
        )}

        <div className="rounded-2xl border border-stone-200 bg-stone-50 p-3">
          <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold text-stone-500"><BookOpen className="h-3.5 w-3.5" />{t('هتظهر كده', 'It will look like this')}</p>
          <p className="whitespace-pre-wrap break-words text-sm text-stone-800" data-testid="share-preview">{preview}</p>
        </div>

        {emptyQuestion && <p className="text-xs font-bold text-amber-800">{t('اكتب سؤالك الأول في خانة التفاصيل.', 'Write your question in the details box first.')}</p>}
        <div className="flex flex-wrap justify-end gap-2">
          <Btn variant="soft" onClick={cancel}>{t('إلغاء والرجوع للقسم', 'Cancel and go back')}</Btn>
          <Btn busy={busy} disabled={tooShortThread || emptyQuestion} onClick={() => void publish()} data-testid="share-publish">
            <Share2 className="h-4 w-4" />{t('انشر', 'Publish')}
          </Btn>
        </div>
      </Card>
    </div>
  );
}
