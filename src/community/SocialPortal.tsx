/**
 * «سوشيال شام»: Facebook-style community hub infused with Dar Sham's luxury fragrance house identity.
 * 3-column classic Facebook layout:
 * - Left: Navigation shortcuts, perfumer profile preview, lab tools shortcuts
 * - Center: Stories carousel, Composer with scent-feeling picker & formula attachment, filter tabs, rich posts with Facebook reaction bar & recipe cards
 * - Right: Online contacts with 1-click docked messenger, trending salon topics, friend suggestions, featured creation
 */
import { useEffect, useRef, useState } from 'react';
import {
  Bell,
  Check,
  FlaskConical,
  Globe2,
  ImagePlus,
  Lock,
  MessageCircle,
  MoreHorizontal,
  Search,
  Send,
  UserCheck,
  UserMinus,
  UserPlus,
  Users,
  X,
  Share2,
  Bookmark,
  Sparkles,
  Flame,
  Award,
  ChevronRight,
  TrendingUp,
  MessageSquare,
  Smile,
  Eye,
  Sliders,
  Store,
  Layers,
  Heart,
  ExternalLink,
  Radio,
} from 'lucide-react';
import { cx, resizeImage, type Comment, type Notification, type Post, type PublicUser, type Recipe, type Thread } from './api';
import { pulseNow, type SessionState } from './session';
import { Avatar, Btn, Card, Empty, Sheet, Spinner, errorText, inputClass, timeAgo, tx, useLoad, type Lang } from './ui';
import { StoriesBar } from './StoriesBar';
import { categoryLabel } from './DiscussionsPage';
import { openFormulaInLab } from './sync';
import { GeneralNewsPeriodic } from './GeneralNewsPeriodic';


export const REACTIONS: { id: string; emoji: string; ar: string; en: string }[] = [
  { id: 'like', emoji: '👍', ar: 'أعجبني', en: 'Like' },
  { id: 'love', emoji: '❤️', ar: 'أحببته', en: 'Love' },
  { id: 'fire', emoji: '🔥', ar: 'فواح / نار', en: 'Fire' },
  { id: 'wow', emoji: '😮', ar: 'واو', en: 'Wow' },
  { id: 'haha', emoji: '😂', ar: 'هههه', en: 'Haha' },
  { id: 'sad', emoji: '😢', ar: 'حزين', en: 'Sad' },
];

export const SCENT_FEELINGS = [
  { id: 'fresh', icon: '🌿', ar: 'ينعش حواسه مع الحمضيات والبرغموت', en: 'feeling fresh with bergamot' },
  { id: 'oud', icon: '🪵', ar: 'يعيش أجواء الفخامة مع دهن العود المعتق', en: 'feeling regal with aged oud' },
  { id: 'rose', icon: '🌹', ar: 'يتأمل جمال الورد الدمشقي والياسمين', en: 'inspired by damask rose' },
  { id: 'warm', icon: '🔥', ar: 'يختبر تركيزاً شتوياً دافئاً بالعنبر والتوباكو', en: 'experimenting warm amber' },
  { id: 'lab', icon: '🧪', ar: 'في ورشة المعمل يوازن الهرم العطري', en: 'in lab balancing pyramid' },
  { id: 'question', icon: '💡', ar: 'يبحث عن مشورة في التعتيق والمثبتات', en: 'seeking maceration advice' },
];

type Go = (route: string) => void;
interface Props {
  lang: Lang;
  session: SessionState;
  go: Go;
  toast: (text: string) => void;
  onOpenMessenger?: (userId: string) => void;
}

/* ------------------------------------------------- Feed ------------------------------------------------- */

export function SocialFeed({ lang, session, go, toast, onOpenMessenger }: Props) {
  const t = tx(lang);
  const [scope, setScope] = useState<'all' | 'friends' | 'recipes' | 'trending' | 'general-news'>('all');
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [more, setMore] = useState(true);
  const [error, setError] = useState('');

  const me = session.me;

  const load = async (before?: string) => {
    setLoading(true);
    try {
      const queryScope = scope === 'friends' ? 'friends' : 'all';
      const list = await cx<Post[]>(
        `/community/feed?scope=${queryScope}${before ? `&before=${encodeURIComponent(before)}` : ''}`
      );
      let filtered = list;
      if (scope === 'recipes') {
        filtered = list.filter((p) => Boolean(p.recipe));
      } else if (scope === 'trending') {
        filtered = [...list].sort(
          (a, b) =>
            Object.values(b.reactions).reduce((s, n) => s + n, 0) +
            b.comments -
            (Object.values(a.reactions).reduce((s, n) => s + n, 0) + a.comments)
        );
      }
      setPosts((prev) => (before ? [...prev, ...filtered] : filtered));
      setMore(list.length >= 20);
      setError('');
    } catch (e) {
      setError(errorText(e, lang));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [scope]);

  const replace = (p: Post) => setPosts((list) => list.map((x) => (x.id === p.id ? p : x)));
  const remove = (id: string) => setPosts((list) => list.filter((x) => x.id !== id));

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-[260px_minmax(0,1fr)_320px] lg:grid-cols-[minmax(0,1fr)_320px]">
      {/* Left Column (Desktop Shortcuts & Navigation) */}
      <aside className="hidden xl:block space-y-4">
        {/* User Card */}
        {me && (
          <Card className="p-4 space-y-3">
            <button
              type="button"
              onClick={() => go(`u/${me.handle}`)}
              className="flex items-center gap-3 text-start w-full cursor-pointer group"
            >
              <Avatar user={me} size={44} ring />
              <div className="min-w-0 flex-1">
                <p className="truncate font-black text-sm text-stone-900 group-hover:text-amber-800">
                  {me.name}
                </p>
                <p className="truncate text-xs text-stone-500">@{me.handle}</p>
              </div>
            </button>
            <div className="pt-2 border-t border-stone-100 flex items-center justify-between text-xs text-stone-600">
              <span>{t('أصدقاء', 'Friends')} <b>{me.counts?.friends || 0}</b></span>
              <span>·</span>
              <span>{t('تركيبات', 'Formulas')} <b>{me.counts?.recipes || 0}</b></span>
            </div>
          </Card>
        )}

        {/* Facebook-style Left Navigation Menu */}
        <Card className="p-2 space-y-1">
          <button
            type="button"
            onClick={() => go('')}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-bold text-amber-900 bg-amber-50 cursor-pointer"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-200 text-amber-900">
              📰
            </span>
            <span>{t('الموجز العام (الأخبار)', 'News Feed')}</span>
          </button>

          <button
            type="button"
            onClick={() => go('news')}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-xs font-bold text-rose-950 bg-gradient-to-r from-rose-50 to-amber-50/50 border border-rose-200/60 hover:bg-rose-100/70 transition cursor-pointer shadow-2xs group"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-600 text-white shadow-xs">
              <Radio className="h-4 w-4 animate-pulse" />
            </span>
            <div className="flex-1 text-start">
              <div className="flex items-center gap-1.5">
                <span className="text-stone-900 font-extrabold group-hover:text-rose-900">
                  {t('أخبار العامة', 'General News')}
                </span>
                <span className="rounded-full bg-rose-600 px-1.5 py-0.2 text-[9px] text-white font-black animate-pulse">
                  دورية
                </span>
              </div>
              <p className="text-[10px] text-amber-900 font-medium">
                {t('النشرة الدورية الحية للمجتمع', 'Periodic Bulletin')}
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => go('discussions')}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-bold text-stone-700 hover:bg-stone-50 cursor-pointer"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-stone-100 text-stone-800">
              💬
            </span>
            <div className="flex-1 text-start">
              <span>{t('مجلس النقاش العام', 'Public Discussions')}</span>
            </div>
            <span className="rounded-full bg-rose-500 px-1.5 text-[9px] text-white font-black">جديد</span>
          </button>

          <button
            type="button"
            onClick={() => go('messenger')}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-bold text-stone-700 hover:bg-stone-50 cursor-pointer"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-100 text-amber-800">
              ⚡
            </span>
            <span>{t('ماسنجر شام (المحادثات)', 'Messenger')}</span>
          </button>

          <button
            type="button"
            onClick={() => go('friends')}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-bold text-stone-700 hover:bg-stone-50 cursor-pointer"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-stone-100 text-stone-800">
              👥
            </span>
            <span>{t('الأصدقاء والتواصل', 'Friends & Network')}</span>
          </button>

          <button
            type="button"
            onClick={() => go('me/recipes')}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-bold text-stone-700 hover:bg-stone-50 cursor-pointer"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-stone-100 text-stone-800">
              🧪
            </span>
            <span>{t('مكتبة التركيبات والوصفات', 'Perfume Recipes')}</span>
          </button>

          <button
            type="button"
            onClick={() => go('stores')}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-bold text-stone-700 hover:bg-stone-50 cursor-pointer"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-stone-100 text-stone-800">
              🏪
            </span>
            <span>{t('سوق ومتاجر شام', 'Stores Marketplace')}</span>
          </button>
        </Card>

        {/* Shortcuts to Lab Tools */}
        <Card className="p-3.5 space-y-2.5">
          <p className="text-[11px] font-black text-stone-500 uppercase tracking-wider">
            {t('اختصارات المعمل السريعة', 'Lab Quick Tools')}
          </p>
          <div className="space-y-1 text-xs">
            <button
              type="button"
              onClick={() => go('../concentration')}
              className="flex w-full items-center gap-2 rounded-lg p-2 text-stone-700 hover:bg-stone-50 text-start cursor-pointer font-semibold"
            >
              <FlaskConical className="h-4 w-4 text-amber-600" />
              <span>{t('حاسبة التراكيز والزيوت', 'Concentration Calculator')}</span>
            </button>
            <button
              type="button"
              onClick={() => go('../maceration_simulator')}
              className="flex w-full items-center gap-2 rounded-lg p-2 text-stone-700 hover:bg-stone-50 text-start cursor-pointer font-semibold"
            >
              <Sparkles className="h-4 w-4 text-emerald-600" />
              <span>{t('محاكي التعتيق والمكيرولوجي', 'Maceration Simulator')}</span>
            </button>
            <button
              type="button"
              onClick={() => go('../pyramid')}
              className="flex w-full items-center gap-2 rounded-lg p-2 text-stone-700 hover:bg-stone-50 text-start cursor-pointer font-semibold"
            >
              <Layers className="h-4 w-4 text-sky-600" />
              <span>{t('الهرم العطري وتوزيع النوتات', 'Olfactory Pyramid')}</span>
            </button>
          </div>
        </Card>
      </aside>

      {/* Center Column: Stories, Composer, Feed Filter, Posts */}
      <div className="space-y-4 min-w-0">
        {/* Periodic Live Ticker Banner ("تيتل دوري") */}
        <GeneralNewsPeriodic lang={lang} go={go} toast={toast} compactTickerOnly />

        {/* «أهلاً بك في مجتمع شام» — the first steps for a new member (hidden once dismissed) */}
        <WelcomeCard lang={lang} go={go} name={me?.name || ''} />

        {/* Stories / Reels Carousel */}
        <StoriesBar
          lang={lang}
          currentUser={me || undefined}
          onOpenMessenger={onOpenMessenger}
          toast={toast}
        />

        {/* Facebook-style Post Composer */}
        <Composer
          lang={lang}
          session={session}
          onPosted={(p) => setPosts((list) => [p, ...list])}
          toast={toast}
          go={go}
        />

        {/* Feed Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
          {[
            { id: 'all', label: t('🌐 كل المجتمع', '🌐 Everyone') },
            { id: 'general-news', label: t('📡 أخبار العامة (دورية)', '📡 General News (Periodic)') },
            { id: 'friends', label: t('👥 الأصدقاء فقط', '👥 Friends') },
            { id: 'recipes', label: t('🧪 تركيبات المعمل', '🧪 Recipes') },
            { id: 'trending', label: t('🔥 الأكثر تفاعلاً', '🔥 Trending') },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setScope(tab.id as any)}
              className={`rounded-full px-4 py-2 text-xs font-bold transition cursor-pointer shrink-0 ${
                scope === tab.id
                  ? 'bg-amber-900 text-white shadow-sm'
                  : 'bg-white text-stone-600 border border-stone-200 hover:bg-stone-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {error && <p className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}

        {/* Posts Stream or General News View */}
        {scope === 'general-news' ? (
          <GeneralNewsPeriodic lang={lang} go={go} toast={toast} />
        ) : (
          <div className="space-y-4">
            {posts.map((p) => (
              <PostCard
                key={p.id}
                post={p}
                lang={lang}
                go={go}
                onChange={replace}
                onRemove={remove}
                toast={toast}
                onOpenMessenger={onOpenMessenger}
              />
            ))}
          </div>
        )}

        {loading && scope !== 'general-news' && <Spinner />}

        {!loading && scope !== 'general-news' && !posts.length && !error && (
          <Card>
            <Empty
              icon={<Users className="h-10 w-10 text-stone-300" />}
              title={t('لا توجد منشورات في هذا القسم حالياً', 'No posts in this section')}
              body={t(
                'شارك أول تجربة عطرية أو اطرح سؤالاً لزملائك في المعمل.',
                'Share your first scent formulation or ask your peers.'
              )}
            />
          </Card>
        )}

        {!loading && more && posts.length > 0 && (
          <Btn
            variant="soft"
            className="w-full py-3 font-bold"
            onClick={() => void load(posts[posts.length - 1].createdAt)}
          >
            {t('عرض المزيد من المنشورات', 'Load more posts')}
          </Btn>
        )}
      </div>

      {/* Right Column: Online Contacts, Friend Requests, Trending Salon */}
      <aside className="space-y-4">
        <PeoplePanel
          lang={lang}
          go={go}
          toast={toast}
          onOpenMessenger={onOpenMessenger}
        />
      </aside>
    </div>
  );
}

/** One post on its own page (`#community/post/<id>`, the «share» link). */
export function PostPage({ id, lang, go, toast, onOpenMessenger }: { id: string; lang: Lang; go: Go; toast: (s: string) => void; onOpenMessenger?: (userId: string) => void }) {
  const t = tx(lang);
  const { data, setData, loading, error } = useLoad(() => cx<Post>(`/community/posts/${encodeURIComponent(id)}`), [id]);
  return (
    <div className="mx-auto max-w-2xl space-y-3">
      <Btn small variant="ghost" onClick={() => go('')}>{t('← رجوع للرئيسية', '← Back to the feed')}</Btn>
      {loading ? <Spinner /> : error || !data ? <Card><Empty title={errorText(error, lang)} /></Card>
        : <PostCard post={data} lang={lang} go={go} toast={toast} onOpenMessenger={onOpenMessenger} onChange={setData} onRemove={() => go('')} />}
    </div>
  );
}

/* ------------------------------------------------- Welcome ------------------------------------------------- */

const WELCOME_KEY = 'sham_community_welcome_v1';
function WelcomeCard({ lang, go, name }: { lang: Lang; go: Go; name: string }) {
  const t = tx(lang);
  const [hidden, setHidden] = useState(() => { try { return localStorage.getItem(WELCOME_KEY) === 'hidden'; } catch { return false; } });
  if (hidden) return null;
  const hide = () => { setHidden(true); try { localStorage.setItem(WELCOME_KEY, 'hidden'); } catch { /* private mode */ } };
  const steps = [
    { icon: '👤', label: t('كمّل ملفك', 'Complete your profile'), to: 'me/profile' },
    { icon: '🧪', label: t('شارك تركيبة', 'Share a recipe'), to: 'me/recipes' },
    { icon: '💬', label: t('اسأل في المجلس', 'Ask in the salon'), to: 'discussions' },
    { icon: '🏪', label: t('زور سوق التجار', 'Visit the market'), to: 'stores' },
  ];
  return (
    <Card className="relative overflow-hidden border-amber-200 bg-gradient-to-br from-amber-50 via-white to-rose-50/40 p-4 sm:p-5">
      <button type="button" onClick={hide} className="absolute end-3 top-3 rounded-full p-1 text-stone-400 hover:bg-white hover:text-stone-700 cursor-pointer" aria-label={t('إخفاء', 'Hide')}>✕</button>
      <p className="text-lg font-black text-stone-900">{t(`أهلاً بك في مجتمع شام${name ? `، ${name.split(' ')[0]}` : ''} 👋`, `Welcome to Sham Community${name ? `, ${name.split(' ')[0]}` : ''} 👋`)}</p>
      <p className="mt-1 text-xs leading-relaxed text-stone-600">{t('المجتمع لسه في أوله — كل منشور وسؤال وتركيبة بتشاركها بتبني المكان لكل صناع العطور.', 'The community is just starting — every post, question and recipe you share builds it for every perfumer.')}</p>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {steps.map((s) => (
          <button key={s.to} type="button" onClick={() => go(s.to)} className="flex items-center gap-2 rounded-xl border border-amber-200 bg-white/80 px-3 py-2 text-start text-xs font-bold text-stone-800 transition hover:border-amber-400 hover:bg-white cursor-pointer">
            <span className="text-base">{s.icon}</span>{s.label}
          </button>
        ))}
      </div>
    </Card>
  );
}

/* ------------------------------------------------- Composer ------------------------------------------------- */

function Composer({
  lang,
  session,
  onPosted,
  toast,
  go,
}: {
  lang: Lang;
  session: SessionState;
  onPosted: (p: Post) => void;
  toast: (s: string) => void;
  go: Go;
}) {
  const t = tx(lang);
  const me = session.me;
  // «انشر الخبر للنقاش» from the news page leaves a draft here (read once, then removed).
  const [body, setBody] = useState(() => {
    try {
      const raw = localStorage.getItem('sham_composer_prefill');
      if (!raw) return '';
      localStorage.removeItem('sham_composer_prefill');
      const draft = JSON.parse(raw) as { content?: unknown };
      return typeof draft.content === 'string' ? draft.content.slice(0, 5000) : '';
    } catch { return ''; }
  });
  const [image, setImage] = useState<string | null>(null);
  const [visibility, setVisibility] = useState<'public' | 'friends'>('public');
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [pickRecipe, setPickRecipe] = useState(false);
  const [feeling, setFeeling] = useState<string | null>(null);
  const [showFeelings, setShowFeelings] = useState(false);
  const [busy, setBusy] = useState(false);
  const file = useRef<HTMLInputElement>(null);

  if (!me) {
    return (
      <Card className="p-4 text-center space-y-2">
        <p className="text-sm font-bold text-stone-800">
          {t('انضم إلى مجتمع دار شام للعطور', 'Join Dar Sham Perfumers Community')}
        </p>
        <p className="text-xs text-stone-500">
          {t('سجّل دخولك لمشاركة التركيبات والتفاعل مع صانعي العطور والماسنجر', 'Sign in to post recipes, interact and chat')}
        </p>
        <Btn small onClick={() => go('login')}>
          {t('تسجيل الدخول / إنشاء حساب', 'Sign in / Register')}
        </Btn>
      </Card>
    );
  }

  const submit = async () => {
    setBusy(true);
    try {
      const fullBody = feeling ? `[شعور: ${feeling}]\n\n${body}` : body;
      const post = await cx<Post>('/community/posts', {
        body: { body: fullBody, image, visibility, recipeId: recipe?.id },
      });
      onPosted(post);
      setBody('');
      setImage(null);
      setRecipe(null);
      setFeeling(null);
      toast(t('تم نشر المنشور في مجتمع شام 🎉', 'Post published! 🎉'));
    } catch (e) {
      toast(errorText(e, lang));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="p-4 shadow-sm border-stone-200">
      <div className="flex gap-3 items-start">
        <Avatar user={me} size={44} ring />
        <div className="flex-1 min-w-0">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={body ? 3 : 2}
            maxLength={5000}
            placeholder={t(
              `بم تفكّر اليوم يا ${me.name.split(' ')[0]}؟ شارك سر تركيبة، تجربة تعتيق، أو سؤالاً عطرياً…`,
              `What's on your mind, ${me.name.split(' ')[0]}? Share a formula, maceration tip or scent question…`
            )}
            className="w-full resize-none rounded-2xl bg-stone-50 px-4 py-3 text-sm text-stone-900 outline-none focus:bg-white focus:ring-2 focus:ring-amber-200"
          />

          {feeling && (
            <div className="mt-2 flex items-center justify-between rounded-xl bg-amber-50 px-3 py-1.5 text-xs text-amber-900 font-semibold">
              <span>{feeling}</span>
              <button
                type="button"
                onClick={() => setFeeling(null)}
                className="text-stone-400 hover:text-stone-700 cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {image && (
        <div className="relative mt-3">
          <img src={image} alt="" className="max-h-80 w-full rounded-2xl object-cover" />
          <button
            type="button"
            onClick={() => setImage(null)}
            className="absolute top-2 end-2 rounded-full bg-stone-900/70 p-1.5 text-white cursor-pointer hover:bg-stone-900"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {recipe && (
        <div className="mt-3 flex items-center justify-between rounded-2xl bg-gradient-to-r from-amber-50 to-amber-100/50 p-3 text-sm border border-amber-200">
          <span className="flex items-center gap-2 font-bold text-amber-900">
            <FlaskConical className="h-4 w-4 text-amber-700" />
            {recipe.title}
          </span>
          <button
            type="button"
            onClick={() => setRecipe(null)}
            className="text-stone-400 hover:text-stone-700 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Scent feeling drawer */}
      {showFeelings && (
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 border-t border-stone-100 pt-3">
          {SCENT_FEELINGS.map((sf) => (
            <button
              key={sf.id}
              type="button"
              onClick={() => {
                setFeeling(`${sf.icon} ${lang === 'ar' ? sf.ar : sf.en}`);
                setShowFeelings(false);
              }}
              className="flex items-center gap-2 rounded-xl p-2 text-start text-xs font-semibold text-stone-700 hover:bg-amber-50 hover:text-amber-900 transition cursor-pointer"
            >
              <span className="text-base">{sf.icon}</span>
              <span>{lang === 'ar' ? sf.ar : sf.en}</span>
            </button>
          ))}
        </div>
      )}

      {/* Composer Action Toolbar */}
      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-stone-100 pt-3">
        <input
          ref={file}
          type="file"
          accept="image/*"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (f) setImage(await resizeImage(f).catch(() => null));
          }}
        />
        <Btn variant="ghost" small onClick={() => file.current?.click()}>
          <ImagePlus className="h-4 w-4 text-emerald-600" />
          {t('صورة / معمل', 'Photo')}
        </Btn>

        <Btn variant="ghost" small onClick={() => setPickRecipe(true)}>
          <FlaskConical className="h-4 w-4 text-amber-600" />
          {t('شارك تركيبة', 'Recipe')}
        </Btn>

        <Btn
          variant="ghost"
          small
          onClick={() => setShowFeelings((v) => !v)}
          className={feeling ? 'text-amber-800 bg-amber-50' : ''}
        >
          <Smile className="h-4 w-4 text-rose-500" />
          {t('شعور / نوتة اليوم', 'Scent Feeling')}
        </Btn>

        <select
          value={visibility}
          onChange={(e) => setVisibility(e.target.value as 'public' | 'friends')}
          className="rounded-xl border border-stone-200 bg-white px-2.5 py-1.5 text-xs text-stone-700 outline-none"
        >
          <option value="public">🌍 {t('عام للجميع', 'Public')}</option>
          <option value="friends">👥 {t('الأصدقاء فقط', 'Friends only')}</option>
        </select>

        <Btn
          className="ms-auto"
          small
          busy={busy}
          disabled={!body.trim() && !image && !recipe && !feeling}
          onClick={() => void submit()}
        >
          <Send className="h-3.5 w-3.5" />
          {t('نشر المنشور', 'Post')}
        </Btn>
      </div>

      {pickRecipe && (
        <RecipePicker
          lang={lang}
          onClose={() => setPickRecipe(false)}
          onPick={(r) => {
            setRecipe(r);
            setPickRecipe(false);
          }}
        />
      )}
    </Card>
  );
}

/* ------------------------------------------------- Recipe Picker ------------------------------------------------- */

export function RecipePicker({
  lang,
  onClose,
  onPick,
}: {
  lang: Lang;
  onClose: () => void;
  onPick: (r: Recipe) => void;
}) {
  const t = tx(lang);
  const { data, loading } = useLoad(() => cx<Recipe[]>('/community/me/recipes'));
  return (
    <Sheet title={t('اختر تركيبة من مكتبتك العطرية', 'Pick a fragrance recipe')} onClose={onClose}>
      {loading ? (
        <Spinner />
      ) : !data?.length ? (
        <Empty
          title={t('لا توجد تركيبات محفوظة بعد', 'No saved recipes')}
          body={t(
            'يمكنك حفظ تركيباتك من حاسبة المعمل أو «بوابتي».',
            'Save recipes from the lab calculator or your portal.'
          )}
        />
      ) : (
        <div className="space-y-2">
          {data.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => onPick(r)}
              className="flex w-full items-center gap-3 rounded-2xl border border-stone-200 p-3.5 text-start hover:border-amber-500 hover:bg-amber-50/40 transition cursor-pointer"
            >
              <FlaskConical className="h-5 w-5 text-amber-600" />
              <div>
                <span className="block font-bold text-sm text-stone-900">{r.title}</span>
                <span className="text-xs text-stone-500">{timeAgo(r.updatedAt, lang)}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </Sheet>
  );
}

/* ------------------------------------------------- Post Card ------------------------------------------------- */

export function PostCard({
  post,
  lang,
  go,
  onChange,
  onRemove,
  toast,
  onOpenMessenger,
}: {
  post: Post;
  lang: Lang;
  go: Go;
  onChange: (p: Post) => void;
  onRemove: (id: string) => void;
  toast: (s: string) => void;
  onOpenMessenger?: (userId: string) => void;
}) {
  const t = tx(lang);
  const [showComments, setShowComments] = useState(false);
  const [menu, setMenu] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(post.body);
  const [picker, setPicker] = useState(false);

  const total = Object.values(post.reactions).reduce((s, n) => s + n, 0);
  const top = Object.entries(post.reactions)
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([k]) => REACTIONS.find((r) => r.id === k)?.emoji);
  const mine = REACTIONS.find((r) => r.id === post.myReaction);

  const react = async (kind: string | null) => {
    setPicker(false);
    try {
      onChange(await cx<Post>(`/community/posts/${post.id}/react`, { body: { kind } }));
    } catch (e) {
      toast(errorText(e, lang));
    }
  };

  const save = async () => {
    try {
      onChange(
        await cx<Post>(`/community/posts/${post.id}`, { method: 'PATCH', body: { body: draft } })
      );
      setEditing(false);
    } catch (e) {
      toast(errorText(e, lang));
    }
  };

  const del = async () => {
    if (!confirm(t('حذف هذا المنشور نهائياً؟', 'Delete this post?'))) return;
    try {
      await cx(`/community/posts/${post.id}`, { method: 'DELETE' });
      onRemove(post.id);
    } catch (e) {
      toast(errorText(e, lang));
    }
  };

  const handleShare = async () => {
    const url = `${location.origin}${location.pathname}#community/post/${post.id}`;
    try { await navigator.clipboard.writeText(url); toast(t('اتنسخ رابط المنشور 📋', 'Post link copied 📋')); } catch { toast(url); }
  };

  // Parse scent feeling tag if present at start of post
  const feelingMatch = post.body.match(/^\[شعور:\s*([^\]]+)\]\s*\n*/);
  const feelingTag = feelingMatch ? feelingMatch[1] : null;
  const cleanBody = feelingMatch ? post.body.slice(feelingMatch[0].length) : post.body;

  return (
    <Card className="overflow-hidden shadow-sm border-stone-200">
      {/* Post Header */}
      <div className="flex items-start gap-3 p-4 pb-2">
        <button
          type="button"
          onClick={() => go(`u/${post.author.handle}`)}
          className="cursor-pointer"
        >
          <Avatar user={post.author} size={44} ring />
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => go(`u/${post.author.handle}`)}
              className="font-bold text-stone-900 hover:text-amber-800 cursor-pointer"
            >
              {post.author.name}
            </button>
            {post.author.craftLevel === 'master_lab' && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-900">
                🏛️ {t('معمل معتمد', 'Master Lab')}
              </span>
            )}
            {post.author.merchant && (
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-900">
                🏪 {post.author.merchant.storeName}
              </span>
            )}
          </div>
          <p className="flex items-center gap-1 text-[11px] text-stone-500">
            {timeAgo(post.createdAt, lang)}
            {post.editedAt && ` · ${t('معدّل', 'edited')}`} ·{' '}
            {post.visibility === 'public' ? (
              <Globe2 className="h-3 w-3" />
            ) : (
              <Lock className="h-3 w-3" />
            )}
          </p>
        </div>

        {/* 3-dots Menu */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setMenu((m) => !m)}
            className="rounded-full p-2 text-stone-400 hover:bg-stone-100 hover:text-stone-700 cursor-pointer"
          >
            <MoreHorizontal className="h-5 w-5" />
          </button>
          {menu && (
            <div className="absolute end-0 z-20 mt-1 w-48 overflow-hidden rounded-2xl border border-stone-200 bg-white text-xs shadow-xl">
              {post.mine ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(true);
                      setMenu(false);
                    }}
                    className="block w-full px-4 py-2.5 text-start hover:bg-stone-50 cursor-pointer font-semibold text-stone-700"
                  >
                    {t('تعديل المنشور', 'Edit Post')}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      handleShare();
                      setMenu(false);
                    }}
                    className="block w-full px-4 py-2.5 text-start hover:bg-stone-50 cursor-pointer font-semibold text-stone-700"
                  >
                    {t('نسخ الرابط', 'Copy link')}
                  </button>
                  <button
                    type="button"
                    onClick={() => void del()}
                    className="block w-full px-4 py-2.5 text-start text-rose-600 hover:bg-rose-50 cursor-pointer font-semibold border-t border-stone-100"
                  >
                    {t('حذف المنشور', 'Delete')}
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      handleShare();
                      setMenu(false);
                    }}
                    className="block w-full px-4 py-2.5 text-start hover:bg-stone-50 cursor-pointer font-semibold text-stone-700"
                  >
                    {t('نسخ الرابط', 'Copy link')}
                  </button>
                  {onOpenMessenger && (
                    <button
                      type="button"
                      onClick={() => {
                        onOpenMessenger(post.author.id);
                        setMenu(false);
                      }}
                      className="block w-full px-4 py-2.5 text-start hover:bg-stone-50 cursor-pointer font-semibold text-stone-700"
                    >
                      {t('مراسلة الناشر في الماسنجر', 'Message author')}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setMenu(false);
                      const reason = prompt(t('سبب الإبلاغ:', 'Reason:'));
                      if (reason === null) return;
                      cx('/community/reports', { body: { kind: 'post', id: post.id, reason } })
                        .then(() => toast(t('وصل البلاغ للإدارة، شكراً لك', 'Thanks — the administration got your report')))
                        .catch((e) => toast(errorText(e, lang)));
                    }}
                    className="block w-full px-4 py-2.5 text-start hover:bg-stone-50 cursor-pointer font-semibold text-stone-700"
                  >
                    {t('إبلاغ الإدارة', 'Report')}
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Scent feeling banner if tagged */}
      {feelingTag && (
        <div className="mx-4 mb-2 inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-900 border border-amber-200/80">
          <Sparkles className="h-3.5 w-3.5 text-amber-600" />
          <span>{feelingTag}</span>
        </div>
      )}

      {/* Post Text */}
      <div className="px-4">
        {editing ? (
          <div className="space-y-2">
            <textarea
              className={inputClass}
              rows={4}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
            />
            <div className="flex gap-2">
              <Btn small onClick={() => void save()}>
                {t('حفظ', 'Save')}
              </Btn>
              <Btn
                small
                variant="ghost"
                onClick={() => {
                  setEditing(false);
                  setDraft(post.body);
                }}
              >
                {t('إلغاء', 'Cancel')}
              </Btn>
            </div>
          </div>
        ) : (
          cleanBody && (
            <p className="whitespace-pre-wrap break-words text-[14px] leading-relaxed text-stone-800">
              {cleanBody.split(/(#[^\s#]+)/g).map((part, i) =>
                part.startsWith('#') ? (
                  <span key={i} className="font-bold text-amber-800 hover:underline cursor-pointer">
                    {part}
                  </span>
                ) : (
                  part
                )
              )}
            </p>
          )
        )}
      </div>

      {/* Fragrance Recipe Card Attachment */}
      {post.recipe && (
        <div className="mx-4 mt-3">
          <RecipeCard lang={lang} title={post.recipe.title} data={post.recipe.data} />
          <div className="mt-2 flex justify-end">
            <button
              type="button"
              onClick={() => {
                if (!openFormulaInLab(post.recipe!.title, post.recipe!.data)) toast(t('التركيبة دي مفيهاش أرقام تتحمّل في الحاسبة', 'This recipe has nothing the calculator can load'));
              }}
              className="flex items-center gap-1.5 rounded-xl bg-amber-700 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-amber-800 cursor-pointer shadow-sm"
            >
              <FlaskConical className="h-3.5 w-3.5" />
              {t('استخدم التركيبة دي', 'Use this recipe')}
            </button>
          </div>
        </div>
      )}

      {/* Attached Image */}
      {post.image && (
        <div className="mt-3 overflow-hidden bg-stone-100">
          <img
            src={post.image}
            alt=""
            loading="lazy"
            className="max-h-[520px] w-full object-cover transition hover:scale-[1.01]"
          />
        </div>
      )}

      {/* Reactions Summary & Comments Counter */}
      <div className="flex items-center justify-between px-4 py-2.5 text-xs text-stone-500 border-b border-stone-100">
        <div className="flex items-center gap-1.5">
          {total > 0 && (
            <>
              <span className="flex -space-x-1 rtl:space-x-reverse">{top.join(' ')}</span>
              <span className="font-semibold text-stone-700">{total}</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-3">
          {post.comments > 0 && (
            <button
              type="button"
              onClick={() => setShowComments(true)}
              className="hover:underline cursor-pointer"
            >
              {post.comments} {t('تعليق', 'comments')}
            </button>
          )}
          <button type="button" onClick={handleShare} className="hover:underline cursor-pointer">
            {t('مشاركة', 'share')}
          </button>
        </div>
      </div>

      {/* Facebook Reactions Toolbar */}
      <div className="relative grid grid-cols-3 text-xs font-bold text-stone-600">
        {/* Like / React Button */}
        <div
          className="relative"
          onMouseEnter={() => setPicker(true)}
          onMouseLeave={() => setPicker(false)}
        >
          <button
            type="button"
            onClick={() => void react(post.myReaction ? null : 'like')}
            className={`flex w-full items-center justify-center gap-1.5 py-2.5 hover:bg-stone-50 cursor-pointer ${
              mine ? 'text-amber-800 font-black' : ''
            }`}
          >
            <span className="text-base">{mine ? mine.emoji : '👍'}</span>
            <span>{mine ? (lang === 'ar' ? mine.ar : mine.en) : t('أعجبني', 'Like')}</span>
          </button>

          {/* Facebook Emoji Hover Bar */}
          {picker && (
            <div className="absolute -top-12 start-2 z-30 flex items-center gap-1.5 rounded-full border border-stone-200 bg-white px-3 py-1.5 shadow-2xl animate-in fade-in zoom-in-95">
              {REACTIONS.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  title={lang === 'ar' ? r.ar : r.en}
                  onClick={() => void react(r.id)}
                  className="text-2xl transition hover:scale-135 cursor-pointer transform duration-150"
                >
                  {r.emoji}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Comment Button */}
        <button
          type="button"
          onClick={() => setShowComments((s) => !s)}
          className="flex items-center justify-center gap-1.5 py-2.5 hover:bg-stone-50 cursor-pointer"
        >
          <MessageCircle className="h-4 w-4" />
          <span>{t('تعليق', 'Comment')}</span>
        </button>

        {/* Share Button */}
        <button
          type="button"
          onClick={handleShare}
          className="flex items-center justify-center gap-1.5 py-2.5 hover:bg-stone-50 cursor-pointer"
        >
          <Share2 className="h-4 w-4" />
          <span>{t('مشاركة', 'Share')}</span>
        </button>
      </div>

      {/* Comments Drawer */}
      {showComments && (
        <Comments
          post={post}
          lang={lang}
          go={go}
          toast={toast}
          onCount={(n) => onChange({ ...post, comments: n })}
        />
      )}
    </Card>
  );
}

/* ------------------------------------------------- Recipe Card ------------------------------------------------- */

export function RecipeCard({
  lang,
  title,
  data,
}: {
  lang: Lang;
  title: string;
  data: Record<string, unknown>;
}) {
  const t = tx(lang);
  const d = data as {
    ingredients?: { name?: string; percent?: number; grams?: number }[];
    pyramidNotes?: { nameAr?: string; nameEn?: string; percentageOfOil?: number }[];
    formulation?: { concentrationPercent?: number; bottleVolumeMl?: number };
  };
  const lines = Array.isArray(d.pyramidNotes)
    ? d.pyramidNotes.slice(0, 8).map((n) => ({
        name: (lang === 'ar' ? n.nameAr : n.nameEn) || n.nameAr || n.nameEn,
        percent: n.percentageOfOil,
      }))
    : Array.isArray(d.ingredients)
    ? d.ingredients.slice(0, 8)
    : [];

  return (
    <div className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50/80 via-white to-amber-50/30 p-3.5 shadow-inner">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-2 font-black text-amber-950 text-sm">
          <FlaskConical className="h-4 w-4 text-amber-700" />
          {title}
        </p>
        {d.formulation?.concentrationPercent != null && (
          <span className="rounded-full bg-amber-200/60 px-2.5 py-0.5 text-[10px] font-bold text-amber-950">
            {t('تركيز', 'Concentration')} {d.formulation.concentrationPercent}% ·{' '}
            {d.formulation.bottleVolumeMl} ml
          </span>
        )}
      </div>

      {lines.length > 0 ? (
        <div className="mt-2.5 grid gap-1.5 text-xs text-stone-700 sm:grid-cols-2">
          {lines.map((l, i) => (
            <div
              key={i}
              className="flex justify-between items-center gap-2 rounded-xl bg-white/90 px-2.5 py-1.5 border border-stone-200/60"
            >
              <span className="font-semibold text-stone-800">{l.name}</span>
              <span className="font-mono font-bold text-amber-800">
                {l.percent != null ? `${l.percent}%` : ''}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-1 text-xs text-stone-500">
          {t('تركيبة محفوظة من مكتبة المعمل', 'Formula from member library')}
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------- Comments ------------------------------------------------- */

function Comments({
  post,
  lang,
  go,
  toast,
  onCount,
}: {
  post: Post;
  lang: Lang;
  go: Go;
  toast: (s: string) => void;
  onCount: (n: number) => void;
}) {
  const t = tx(lang);
  const { data, setData, loading } = useLoad(
    () => cx<Comment[]>(`/community/posts/${post.id}/comments`),
    [post.id]
  );
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);

  const add = async () => {
    setBusy(true);
    try {
      const next = await cx<Comment[]>(`/community/posts/${post.id}/comments`, { body: { body } });
      setData(next);
      onCount(next.length);
      setBody('');
    } catch (e) {
      toast(errorText(e, lang));
    } finally {
      setBusy(false);
    }
  };

  const del = async (id: string) => {
    try {
      await cx(`/community/comments/${id}`, { method: 'DELETE' });
      const next = (data || []).filter((c) => c.id !== id);
      setData(next);
      onCount(next.length);
    } catch (e) {
      toast(errorText(e, lang));
    }
  };

  return (
    <div className="space-y-3 border-t border-stone-100 bg-stone-50/50 p-4">
      {loading ? (
        <Spinner />
      ) : (
        (data || []).map((c) => (
          <div key={c.id} className="group flex gap-2.5 items-start">
            <button
              type="button"
              onClick={() => go(`u/${c.author.handle}`)}
              className="cursor-pointer shrink-0 mt-0.5"
            >
              <Avatar user={c.author} size={34} />
            </button>
            <div className="min-w-0 flex-1">
              <div className="inline-block max-w-full rounded-2xl bg-white border border-stone-200/80 px-3.5 py-2 shadow-sm">
                <button
                  type="button"
                  onClick={() => go(`u/${c.author.handle}`)}
                  className="text-xs font-bold text-stone-900 hover:underline cursor-pointer block text-start"
                >
                  {c.author.name}
                </button>
                <p className="whitespace-pre-wrap break-words text-xs leading-relaxed text-stone-800 mt-0.5">
                  {c.body}
                </p>
              </div>
              <div className="mt-1 flex items-center gap-3 px-2 text-[10px] text-stone-400">
                <span>{timeAgo(c.createdAt, lang)}</span>
                {(c.mine || post.mine) && (
                  <button
                    type="button"
                    onClick={() => void del(c.id)}
                    className="hover:text-rose-600 cursor-pointer font-semibold"
                  >
                    {t('حذف', 'Delete')}
                  </button>
                )}
              </div>
            </div>
          </div>
        ))
      )}

      {/* Comment Input */}
      <form
        className="flex gap-2 pt-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (body.trim()) void add();
        }}
      >
        <input
          className={`${inputClass} rounded-full text-xs py-2`}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={2000}
          placeholder={t('اكتب تعليقاً على منشور صانع العطور…', 'Write a comment…')}
        />
        <Btn type="submit" small busy={busy} disabled={!body.trim()} className="rounded-full">
          <Send className="h-3.5 w-3.5" />
        </Btn>
      </form>
    </div>
  );
}

/* ------------------------------------------------- People Panel (Right Sidebar) ------------------------------------------------- */

export function PeoplePanel({
  lang,
  go,
  toast,
  onOpenMessenger,
}: {
  lang: Lang;
  go: Go;
  toast: (s: string) => void;
  onOpenMessenger?: (userId: string) => void;
}) {
  const t = tx(lang);
  const friends = useLoad(() =>
    cx<{ friends: PublicUser[]; incoming: PublicUser[]; outgoing: PublicUser[] }>('/community/friends')
  );
  const suggestions = useLoad(() => cx<PublicUser[]>('/community/people/suggestions'));
  const topics = useLoad(() => cx<Thread[]>('/community/discussions?sort=top&limit=4'));
  const [q, setQ] = useState('');
  const [found, setFound] = useState<PublicUser[] | null>(null);

  useEffect(() => {
    if (q.trim().length < 2) {
      setFound(null);
      return;
    }
    const id = setTimeout(() => {
      void cx<PublicUser[]>(`/community/people?q=${encodeURIComponent(q.trim())}`)
        .then(setFound)
        .catch(() => setFound([]));
    }, 300);
    return () => clearTimeout(id);
  }, [q]);

  const act = async (fn: () => Promise<unknown>, done: string) => {
    try {
      await fn();
      toast(done);
      void friends.reload(true);
      void suggestions.reload(true);
      void pulseNow();
    } catch (e) {
      toast(errorText(e, lang));
    }
  };

  return (
    <>
      {/* People Search */}
      <Card className="p-3.5">
        <div className="relative">
          <Search className="absolute inset-y-0 start-3 my-auto h-4 w-4 text-stone-400" />
          <input
            className={`${inputClass} ps-9 py-2 text-xs`}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t('ابحث عن صناع العطور بالاسم أو المعرف…', 'Search perfumers…')}
          />
        </div>
        {found && (
          <div className="mt-3 space-y-2 max-h-60 overflow-y-auto">
            {found.length ? (
              found.map((u) => <PersonRow key={u.id} u={u} lang={lang} go={go} />)
            ) : (
              <p className="text-xs text-stone-500 py-2 text-center">{t('لا توجد نتائج', 'No results')}</p>
            )}
          </div>
        )}
      </Card>

      {/* Online Contacts & Friends (Active right now with green dot) */}
      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between border-b border-stone-100 pb-2">
          <h3 className="font-black text-xs text-stone-900 uppercase tracking-wider flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            {t('جهات الاتصال المتصلة الآن', 'Contacts Online')}
          </h3>
          <span className="text-[11px] text-stone-400">
            {(friends.data?.friends || []).filter((f) => f.online).length}
          </span>
        </div>

        <div className="space-y-2">
          {!friends.data?.friends.length ? (
            <p className="text-xs text-stone-500 py-2">
              {t('أضف أصدقاء لتراهم متصلين وتتواصل معهم فوراً.', 'Add friends to see them online.')}
            </p>
          ) : (
            friends.data.friends.slice(0, 8).map((u) => (
              <div
                key={u.id}
                className="flex items-center justify-between gap-2 p-1.5 rounded-xl hover:bg-stone-50 transition cursor-pointer"
                onClick={() => (onOpenMessenger ? onOpenMessenger(u.id) : go(`messenger`))}
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <span className="relative">
                    <Avatar user={u} size={34} />
                    {u.online && <span className="absolute bottom-0 end-0 h-2.5 w-2.5 rounded-full border border-white bg-emerald-500" />}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-bold text-stone-900">{u.name}</p>
                    <p className="truncate text-[10px] text-stone-400">@{u.handle}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onOpenMessenger) onOpenMessenger(u.id);
                    else go('messenger');
                  }}
                  className="rounded-full p-1.5 text-stone-400 hover:bg-amber-100 hover:text-amber-900 cursor-pointer"
                  title={t('محادثة ماسنجر سريعة', 'Instant Chat')}
                >
                  <MessageCircle className="h-4 w-4" />
                </button>
              </div>
            ))
          )}
        </div>
      </Card>

      {/* Friend Requests */}
      {!!friends.data?.incoming.length && (
        <Card className="p-4 border-amber-300 bg-amber-50/30">
          <p className="mb-3 font-black text-xs text-amber-950 flex items-center justify-between">
            <span>{t('طلبات الصداقة الواردة', 'Friend requests')}</span>
            <span className="rounded-full bg-rose-600 px-2 py-0.5 text-[10px] font-bold text-white">
              {friends.data.incoming.length}
            </span>
          </p>
          <div className="space-y-3">
            {friends.data.incoming.map((u) => (
              <div key={u.id} className="space-y-2 rounded-xl bg-white p-2.5 border border-amber-200">
                <PersonRow u={u} lang={lang} go={go} />
                <div className="flex gap-2 pt-1">
                  <Btn
                    small
                    className="flex-1 text-[11px]"
                    onClick={() =>
                      void act(
                        () => cx(`/community/friends/${u.id}`, { body: {} }),
                        t('أصبحتم أصدقاء الآن 🎉', 'You are now friends 🎉')
                      )
                    }
                  >
                    <Check className="h-3.5 w-3.5" />
                    {t('قبول', 'Accept')}
                  </Btn>
                  <Btn
                    small
                    variant="ghost"
                    className="flex-1 text-[11px]"
                    onClick={() =>
                      void act(
                        () => cx(`/community/friends/${u.id}`, { method: 'DELETE' }),
                        t('تم رفض الطلب', 'Declined')
                      )
                    }
                  >
                    {t('رفض', 'Decline')}
                  </Btn>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Trending Salon Topics */}
      <Card className="p-4 space-y-2.5">
        <div className="flex items-center justify-between border-b border-stone-100 pb-2">
          <h3 className="font-black text-xs text-stone-900 uppercase tracking-wider flex items-center gap-1.5">
            <Flame className="h-3.5 w-3.5 text-amber-600" />
            {t('المناقشات الرائجة في الصالون', 'Trending Salon Topics')}
          </h3>
          <button
            type="button"
            onClick={() => go('discussions')}
            className="text-[10px] font-bold text-amber-800 hover:underline cursor-pointer"
          >
            {t('عرض الكل', 'View all')}
          </button>
        </div>

        <div className="space-y-2 text-xs">
          {!topics.data?.length && (
            <button type="button" onClick={() => go('discussions')} className="w-full rounded-xl border border-dashed border-amber-300 bg-amber-50/50 p-3 text-start text-[11px] leading-relaxed text-stone-600 cursor-pointer hover:bg-amber-50">
              {t('المجلس لسه بيبدأ — اسأل أول سؤال عن التعتيق أو الخامات وخلّي الخبراء يردّوا.', 'The salon is just starting — ask the first question about maceration or materials.')}
            </button>
          )}
          {(topics.data || []).map((topic) => (
            <div
              key={topic.id}
              onClick={() => go(`discussions/${topic.id}`)}
              className="p-2 rounded-xl hover:bg-stone-50 transition cursor-pointer space-y-0.5"
            >
              <p className="font-bold text-stone-900 line-clamp-1">{topic.title}</p>
              <p className="text-[10px] text-stone-400 flex items-center justify-between">
                <span>{topic.tags[0] ? `#${topic.tags[0]}` : categoryLabel(topic.category, lang)}</span>
                <span>{topic.replies} {t('رد', 'replies')} · ▲ {topic.votes}</span>
              </p>
            </div>
          ))}
        </div>
      </Card>

      {/* People You May Know */}
      <Card className="p-4 space-y-3">
        <p className="font-black text-xs text-stone-900 uppercase tracking-wider">
          {t('صناع عطور قد تعرفهم', 'Perfumers you may know')}
        </p>
        {suggestions.loading ? (
          <Spinner />
        ) : !suggestions.data?.length ? (
          <p className="text-xs text-stone-500">
            {t('ستظهر الاقتراحات مع توسع مجتمع صانعي العطور.', 'Suggestions will appear.')}
          </p>
        ) : (
          <div className="space-y-2.5">
            {suggestions.data.slice(0, 5).map((u) => (
              <div key={u.id} className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <PersonRow u={u} lang={lang} go={go} />
                </div>
                <Btn
                  small
                  variant="soft"
                  onClick={() =>
                    void act(
                      () => cx(`/community/friends/${u.id}`, { body: {} }),
                      t('تم إرسال طلب الصداقة ✨', 'Request sent ✨')
                    )
                  }
                >
                  <UserPlus className="h-3.5 w-3.5" />
                </Btn>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* The site's own expert (Shaheen) — no invented product */}
      <Card className="overflow-hidden border-amber-300 bg-gradient-to-br from-amber-900 to-stone-900 p-4 text-white shadow-md">
        <span className="text-[10px] font-bold uppercase tracking-widest text-amber-300">✨ {t('خبير شام', 'Sham’s expert')}</span>
        <h4 className="mt-1 text-sm font-black text-white">{t('اسأل شاهين عن تركيبتك', 'Ask Shaheen about your blend')}</h4>
        <p className="mt-1 text-[11px] leading-relaxed text-stone-300">
          {t('النسب، التعتيق، الثبات، بدائل الخامات — شاهين بيرد عليك ويقترح أدوات الحساب المناسبة.', 'Ratios, maceration, longevity, material swaps — Shaheen answers and suggests the right calculators.')}
        </p>
        <button type="button" onClick={() => go('../master_ai')}
          className="mt-3 flex items-center gap-1.5 rounded-xl bg-amber-600 px-3 py-1.5 text-xs font-bold text-white shadow hover:bg-amber-500 cursor-pointer">
          <Sparkles className="h-3.5 w-3.5" />{t('افتح شاهين', 'Open Shaheen')}
        </button>
      </Card>
    </>
  );
}

export function PersonRow({ u, lang, go }: { u: PublicUser; lang: Lang; go: Go }) {
  const t = tx(lang);
  return (
    <button
      type="button"
      onClick={() => go(`u/${u.handle}`)}
      className="flex w-full min-w-0 items-center gap-2.5 text-start cursor-pointer group"
    >
      <Avatar user={u} size={38} />
      <span className="min-w-0">
        <span className="block truncate text-xs font-bold text-stone-900 group-hover:text-amber-800">
          {u.name}
        </span>
        <span className="block truncate text-[10px] text-stone-500">
          @{u.handle}
          {u.mutual ? ` · ${u.mutual} ${t('صديق مشترك', 'mutual')}` : ''}
          {u.merchant ? ` · ${u.merchant.storeName}` : ''}
        </span>
      </span>
    </button>
  );
}

/* ------------------------------------------------- Friends Page ------------------------------------------------- */

export function FriendsPage({
  lang,
  go,
  toast,
  onOpenMessenger,
}: Omit<Props, 'session'>) {
  const t = tx(lang);
  const { data, loading, reload } = useLoad(() =>
    cx<{ friends: PublicUser[]; incoming: PublicUser[]; outgoing: PublicUser[] }>('/community/friends')
  );
  const blocked = useLoad(() => cx<PublicUser[]>('/community/blocks'));

  if (loading) return <Spinner />;

  const section = (
    title: string,
    list: PublicUser[],
    extra: (u: PublicUser) => React.ReactNode
  ) => (
    <Card className="p-4 space-y-3">
      <div className="flex items-center justify-between border-b border-stone-100 pb-2">
        <h3 className="font-black text-sm text-stone-900">
          {title} ({list.length})
        </h3>
      </div>
      {!list.length ? (
        <p className="text-xs text-stone-400 py-3 text-center">—</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {list.map((u) => (
            <div
              key={u.id}
              className="flex items-center justify-between gap-2.5 rounded-2xl border border-stone-100 bg-stone-50/50 p-2.5 hover:bg-white transition"
            >
              <div className="min-w-0 flex-1">
                <PersonRow u={u} lang={lang} go={go} />
              </div>
              {extra(u)}
            </div>
          ))}
        </div>
      )}
    </Card>
  );

  const act = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
      void reload(true);
      void blocked.reload(true);
      void pulseNow();
    } catch (e) {
      toast(errorText(e, lang));
    }
  };

  return (
    <div className="space-y-4">
      {section(t('طلبات الصداقة الواردة', 'Incoming requests'), data?.incoming || [], (u) => (
        <div className="flex gap-1">
          <Btn
            small
            onClick={() =>
              void act(() => cx(`/community/friends/${u.id}`, { body: {} }))
            }
          >
            <UserCheck className="h-3.5 w-3.5" />
          </Btn>
          <Btn
            small
            variant="ghost"
            onClick={() =>
              void act(() => cx(`/community/friends/${u.id}`, { method: 'DELETE' }))
            }
          >
            <X className="h-3.5 w-3.5" />
          </Btn>
        </div>
      ))}

      {section(t('أصدقاء المنصة', 'Platform Friends'), data?.friends || [], (u) => (
        <div className="flex gap-1">
          <Btn
            small
            variant="soft"
            onClick={() => {
              if (onOpenMessenger) onOpenMessenger(u.id);
              else void act(async () => {
                const { id } = await cx<{ id: string }>('/community/chats/direct', {
                  body: { userId: u.id },
                });
                go(`messenger/${id}`);
              });
            }}
          >
            <MessageCircle className="h-4 w-4" />
          </Btn>
        </div>
      ))}

      {section(t('طلبات أرسلتها', 'Sent requests'), data?.outgoing || [], (u) => (
        <Btn
          small
          variant="ghost"
          onClick={() =>
            void act(() => cx(`/community/friends/${u.id}`, { method: 'DELETE' }))
          }
        >
          <X className="h-4 w-4" />
        </Btn>
      ))}

      {section(t('المحظورون', 'Blocked'), blocked.data || [], (u) => (
        <Btn
          small
          variant="ghost"
          onClick={() =>
            void act(() => cx(`/community/blocks/${u.id}`, { method: 'DELETE' }))
          }
        >
          {t('إلغاء الحظر', 'Unblock')}
        </Btn>
      ))}
    </div>
  );
}

/* ------------------------------------------------- Notifications Page ------------------------------------------------- */

export function NotificationsPage({ lang, go }: { lang: Lang; go: Go }) {
  const t = tx(lang);
  const { data, loading } = useLoad(() => cx<Notification[]>('/community/notifications'));

  useEffect(() => {
    void cx('/community/notifications/read', { body: {} })
      .then(() => pulseNow())
      .catch(() => {});
  }, []);

  const text = (n: Notification) => {
    const who = n.actor?.name || t('الإدارة', 'The administration');
    const map: Record<string, [string, string, string?]> = {
      security: [n.ref ? `تسجيل دخول جديد: ${n.ref}` : 'تسجيل دخول جديد', n.ref ? `New sign-in: ${n.ref}` : 'New sign-in', 'me/security'],
      friend_request: [`${who} بعتلك طلب صداقة`, `${who} sent you a friend request`, n.actor ? `u/${n.actor.handle}` : 'friends'],
      friend_accepted: [`${who} قبل طلب صداقتك`, `${who} accepted your request`, n.actor ? `u/${n.actor.handle}` : 'friends'],
      reaction: [`${who} تفاعل مع منشورك`, `${who} reacted to your post`, ''],
      comment: [`${who} علّق على منشورك`, `${who} commented on your post`, ''],
      thread_reply: [`${who} ردّ على نقاشك في المجلس`, `${who} replied to your discussion`, n.ref ? `discussions/${n.ref}` : 'discussions'],
      reply_accepted: [`${who} اعتمد ردّك كإجابة ✅`, `${who} marked your reply as the answer ✅`, n.ref ? `discussions/${n.ref}` : 'discussions'],
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
    <Card className="divide-y divide-stone-100 shadow-sm border-stone-200">
      <div className="flex items-center gap-2 p-4 font-black text-stone-900">
        <Bell className="h-5 w-5 text-amber-600" />
        <span>{t('مركز الإشعارات والتنبيهات', 'Notifications Center')}</span>
      </div>
      {loading ? (
        <Spinner />
      ) : !data?.length ? (
        <Empty title={t('لا توجد إشعارات جديدة', 'No notifications')} />
      ) : (
        data.map((n) => {
          const [ar, en, route] = text(n);
          return (
            <button
              key={n.id}
              type="button"
              onClick={() => route && go(route)}
              className={`flex w-full items-center gap-3 p-4 text-start hover:bg-stone-50 cursor-pointer ${
                n.read ? '' : 'bg-amber-50/60'
              }`}
            >
              {n.actor ? (
                <Avatar user={n.actor} size={40} />
              ) : (
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-lg">
                  🔔
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block text-xs sm:text-sm font-semibold text-stone-800">
                  {lang === 'ar' ? ar : en}
                </span>
                <span className="text-[11px] text-stone-400">{timeAgo(n.createdAt, lang)}</span>
              </span>
              {!n.read && <span className="h-2.5 w-2.5 rounded-full bg-amber-600" />}
            </button>
          );
        })
      )}
    </Card>
  );
}
