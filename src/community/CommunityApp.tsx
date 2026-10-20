/**
 * «مجتمع شام» — one place for the community hub: sign-in / sign-up, «سوشيال شام» (the Facebook-style home of the
 * merchant's AI Studio design: stories, posts, the discussion salon, news, profiles, the docked chat box), the
 * messenger, «بريد شام», «بوابتي», «بوابة التجار» and «متاجر شام». Loaded on demand from App.tsx for every
 * `#community…` address; `route` is the part after `community/`.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Bell, Coffee, Home, LogOut, Mail, MessageCircle, Radio, Search, Store, User, Users, Wrench } from 'lucide-react';
import HubAuth from './HubAuth';
import Mailbox from './Mailbox';
import MerchantPortal from './MerchantPortal';
import Messenger from './Messenger';
import { FriendsPage, NotificationsPage, PostPage, SocialFeed } from './SocialPortal';
import { ProfilePage } from './ProfilePage';
import { DiscussionsPage } from './DiscussionsPage';
import { FloatingMessengerDock } from './FloatingMessengerDock';
import { GeneralNewsPeriodic } from './GeneralNewsPeriodic';
import { StoreDirectory, StorePage } from './Stores';
import UserPortal from './UserPortal';
import { signOut, useSession } from './session';
import { Avatar, Badge, Btn, Card, Empty, Spinner, Toast, resolveCommunityLanguage, tx, type Lang } from './ui';
import { cx, type PublicUser } from './api';

export default function CommunityApp({ lang: siteLang, route, navigate, onSignedIn }: { lang: string; route: string; navigate: (tab: string) => void; onSignedIn?: () => void }) {
  const lang: Lang = resolveCommunityLanguage(siteLang);
  const t = tx(lang);
  const session = useSession();
  const [toast, setToast] = useState('');
  const [dockUser, setDockUser] = useState<string | null>(null);
  /** `go('')` = the feed; `go('../tab')` leaves the community for another tab of the site (a calculator, Shaheen…). */
  const go = useCallback((r: string) => {
    if (r.startsWith('../')) navigate(r.slice(3));
    else navigate(r ? `community/${r}` : 'community');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [navigate]);
  const parts = route.split('/').filter(Boolean);
  const [page, a] = parts;
  const member = session.status === 'member' && session.me;
  useEffect(() => { if (member) onSignedIn?.(); }, [member, onSignedIn]);
  // The site's floating helpers (Shaheen, «مساعد شام») would cover the message box while chatting.
  useEffect(() => {
    if (page !== 'messenger' && !dockUser) return;
    document.body.dataset.shamFocus = 'messenger';
    return () => { delete document.body.dataset.shamFocus; };
  }, [page, dockUser]);
  useEffect(() => { if (page === 'messenger') setDockUser(null); }, [page]);

  const openChat = useCallback((userId: string) => {
    if (!member) { go('login'); return; }
    if (userId === member.id) return;
    setDockUser(userId);
  }, [member, go]);

  const pulse = session.pulse;
  const tabs: { id: string; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: 'social', label: t('الرئيسية', 'Home'), icon: <Home className="h-5 w-5" /> },
    { id: 'discussions', label: t('مجلس النقاش', 'Discussions'), icon: <Coffee className="h-5 w-5" /> },
    { id: 'news', label: t('أخبار العطور', 'Perfume news'), icon: <Radio className="h-5 w-5" /> },
    { id: 'friends', label: t('الأصدقاء', 'Friends'), icon: <Users className="h-5 w-5" />, badge: pulse?.requests },
    { id: 'messenger', label: t('الماسنجر', 'Messenger'), icon: <MessageCircle className="h-5 w-5" />, badge: pulse?.messages },
    { id: 'mail', label: t('بريد شام', 'Sham Mail'), icon: <Mail className="h-5 w-5" />, badge: pulse?.mail },
    { id: 'notifications', label: t('الإشعارات', 'Notifications'), icon: <Bell className="h-5 w-5" />, badge: pulse?.notifications },
    { id: 'me', label: t('بوابتي', 'My portal'), icon: <User className="h-5 w-5" /> },
    { id: 'merchant', label: t('بوابة التجار', 'Merchants'), icon: <Wrench className="h-5 w-5" /> },
  ];
  const active = !page ? 'social' : page === 'u' || page === 'post' ? 'social' : page === 'store' ? 'stores' : page;
  const isPublic = page === 'stores' || page === 'store' || page === 'news';

  let body: React.ReactNode;
  if (session.status === 'loading') body = <Spinner />;
  else if (session.status === 'disabled' || session.status === 'offline') body = <NotReady lang={lang} offline={session.status === 'offline'} />;
  else if (page === 'stores') body = <StoreDirectory lang={lang} go={go} />;
  else if (page === 'store' && a) body = <StorePage lang={lang} go={go} slug={a} />;
  else if (page === 'news') body = <GeneralNewsPeriodic lang={lang} go={go} toast={setToast} />;
  else if (!member) body = <HubAuth lang={lang} initial={page === 'join' ? 'register' : 'login'} onDone={(merchant) => go(merchant ? 'merchant' : 'social')} />;
  else if (page === 'messenger') body = <Messenger lang={lang} session={session} chatId={a} go={go} toast={setToast} />;
  else if (page === 'mail') body = <Mailbox lang={lang} session={session} route={parts.slice(1).join('/')} go={go} toast={setToast} />;
  else if (page === 'me') body = <UserPortal lang={lang} session={session} section={a} go={go} toast={setToast} />;
  else if (page === 'merchant') body = <MerchantPortal lang={lang} session={session} section={a} go={go} toast={setToast} />;
  else if (page === 'notifications') body = <NotificationsPage lang={lang} go={go} />;
  else if (page === 'friends') body = <FriendsPage lang={lang} go={go} toast={setToast} onOpenMessenger={openChat} />;
  else if (page === 'discussions') body = <DiscussionsPage lang={lang} go={go} toast={setToast} onOpenMessenger={openChat} threadId={a} />;
  else if (page === 'post' && a) body = <PostPage id={a} lang={lang} go={go} toast={setToast} onOpenMessenger={openChat} />;
  else if (page === 'u' && a) body = <ProfilePage handle={a} lang={lang} go={go} toast={setToast} onOpenMessenger={openChat} />;
  else body = <SocialFeed lang={lang} session={session} go={go} toast={setToast} onOpenMessenger={openChat} />;

  const showChrome = Boolean(member) || isPublic;
  return (
    <div dir={lang === 'ar' ? 'rtl' : 'ltr'} className="min-h-[70vh] bg-stone-100/70 pb-16">
      {showChrome && (
        <header className="sticky top-0 z-30 border-b border-stone-200 bg-white/95 shadow-sm backdrop-blur-md">
          <div className="mx-auto flex max-w-7xl items-center gap-2 px-2 py-1.5 sm:px-4">
            <button type="button" onClick={() => go('')} className="flex shrink-0 items-center gap-2 font-black text-stone-900 cursor-pointer">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-600 to-amber-900 text-white shadow-sm shadow-amber-900/20"><Users className="h-5 w-5" /></span>
              <span className="hidden text-start leading-tight xl:block">
                <span className="block text-sm font-black">{t('مجتمع شام', 'Sham Community')}</span>
                <span className="block text-[10px] font-semibold text-amber-800">{t('ملتقى صناع العطور', 'The perfumers’ hub')}</span>
              </span>
            </button>
            {member && <PeopleSearch lang={lang} go={go} />}
            <nav className="flex min-w-0 flex-1 items-center justify-start gap-0.5 overflow-x-auto no-scrollbar lg:justify-center">
              {tabs.filter(() => member).map((tab) => (
                <button key={tab.id} type="button" title={tab.label} aria-label={tab.label} onClick={() => go(tab.id === 'social' ? '' : tab.id)}
                  className={`relative flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-xl px-3 transition cursor-pointer sm:px-4 ${active === tab.id ? 'bg-amber-50/70 text-amber-900 shadow-[inset_0_-3px_0_0_#d97706]' : 'text-stone-500 hover:bg-stone-100 hover:text-stone-900'}`}>
                  {tab.icon}<Badge n={tab.badge} />
                </button>
              ))}
            </nav>
            <button type="button" onClick={() => go('stores')}
              className={`hidden shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition cursor-pointer sm:flex ${active === 'stores' ? 'bg-amber-700 text-white' : 'border border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100'}`}>
              <Store className="h-4 w-4" />{t('سوق التجار', 'Merchants’ market')}
            </button>
            {member ? (
              <div className="flex shrink-0 items-center gap-1">
                <button type="button" onClick={() => go(`u/${member.handle}`)} className="flex items-center gap-2 rounded-full p-1 hover:bg-stone-100 cursor-pointer lg:pe-2" title={member.name}>
                  <Avatar user={member} size={32} ring /><span className="hidden text-xs font-bold text-stone-800 2xl:inline">{member.name.split(' ')[0]}</span>
                </button>
                <button type="button" title={t('تسجيل الخروج', 'Sign out')} onClick={() => void signOut().then(() => go(''))} className="rounded-full p-2 text-stone-400 hover:bg-stone-100 hover:text-stone-700 cursor-pointer"><LogOut className="h-4 w-4" /></button>
              </div>
            ) : <Btn small onClick={() => go('login')}>{t('دخول / حساب جديد', 'Sign in / Join')}</Btn>}
          </div>
        </header>
      )}
      <main className={showChrome ? 'mx-auto max-w-7xl px-2 py-4 sm:px-4' : ''}>{body}</main>
      {member && dockUser && (
        <FloatingMessengerDock lang={lang} userId={dockUser} toast={setToast} onClose={() => setDockUser(null)}
          onExpand={(id) => { setDockUser(null); go(`messenger/${id}`); }} />
      )}
      {toast && <Toast text={toast} onDone={() => setToast('')} />}
    </div>
  );
}

/** The top bar's member search (name or @handle), with a dropdown of real members. */
function PeopleSearch({ lang, go }: { lang: Lang; go: (r: string) => void }) {
  const t = tx(lang);
  const [q, setQ] = useState('');
  const [found, setFound] = useState<PublicUser[] | null>(null);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (q.trim().length < 2) { setFound(null); return; }
    const id = setTimeout(() => { void cx<PublicUser[]>(`/community/people?q=${encodeURIComponent(q.trim())}`).then(setFound).catch(() => setFound([])); }, 250);
    return () => clearTimeout(id);
  }, [q]);
  useEffect(() => {
    const close = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setFound(null); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);
  return (
    <div ref={box} className="relative hidden w-48 shrink-0 md:block lg:w-60">
      <Search className="absolute inset-y-0 start-3 my-auto h-4 w-4 text-stone-400" />
      <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('ابحث عن عضو…', 'Search members…')}
        className="w-full rounded-full border border-stone-200 bg-stone-100/80 py-2 pe-3 ps-9 text-xs text-stone-900 outline-none transition focus:border-amber-500 focus:bg-white focus:ring-2 focus:ring-amber-200" />
      {found && (
        <div className="absolute start-0 top-full z-50 mt-1.5 w-80 overflow-hidden rounded-2xl border border-stone-200 bg-white p-2 shadow-2xl">
          {!found.length ? <p className="p-3 text-center text-xs text-stone-500">{t('مفيش أعضاء بالاسم ده', 'No members found')}</p> : found.map((u) => (
            <button key={u.id} type="button" onClick={() => { go(`u/${u.handle}`); setQ(''); setFound(null); }} className="flex w-full items-center gap-2.5 rounded-xl p-2 text-start hover:bg-stone-50 cursor-pointer">
              <Avatar user={u} size={34} />
              <span className="min-w-0 flex-1"><span className="block truncate text-xs font-bold text-stone-900">{u.name}</span><span className="block truncate text-[10px] text-stone-400">@{u.handle}</span></span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function NotReady({ lang, offline }: { lang: Lang; offline: boolean }) {
  const t = tx(lang);
  return (
    <div className="mx-auto max-w-2xl px-3 py-10">
      <Card className="p-6 text-center">
        <Empty icon={<Users className="h-12 w-12" />}
          title={offline ? t('مفيش اتصال بالسيرفر دلوقتي', 'Cannot reach the server right now') : t('مجتمع شام بيتجهّز', 'Sham Community is being set up')}
          body={offline ? t('اتأكد من الإنترنت وجرّب تاني بعد شوية.', 'Check your connection and try again shortly.')
            : t('المجتمع والماسنجر وبوابات التجار والأعضاء هيشتغلوا أول ما الإدارة تفعّل قاعدة البيانات. لحد دلوقتي تقدر تستخدم كل أدوات الموقع والمتجر عادي.', 'The community, messenger and portals start as soon as the administration enables the database. Meanwhile all the site’s tools and the store work as usual.')}
          action={<Btn variant="soft" onClick={() => window.location.reload()}>{t('تحديث', 'Refresh')}</Btn>} />
      </Card>
    </div>
  );
}
