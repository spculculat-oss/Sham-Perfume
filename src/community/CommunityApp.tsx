/**
 * «مجتمع شام» — one place for the community hub: sign-in / sign-up, «سوشيال شام», the messenger,
 * «بوابتي» (the member's portal), «بوابة التجار» and «متاجر شام». Loaded on demand from App.tsx for
 * every `#community…` address; `route` is the part after `community/`.
 */
import { useCallback, useEffect, useState } from 'react';
import { Bell, Home, LogOut, MessageCircle, Store, User, Users, Wrench } from 'lucide-react';
import HubAuth from './HubAuth';
import MerchantPortal from './MerchantPortal';
import Messenger from './Messenger';
import { FriendsPage, NotificationsPage, ProfilePage, SocialFeed } from './SocialPortal';
import { StoreDirectory, StorePage } from './Stores';
import UserPortal from './UserPortal';
import { signOut, useSession } from './session';
import { Avatar, Badge, Btn, Card, Empty, Spinner, Toast, tx, type Lang } from './ui';

export default function CommunityApp({ lang: siteLang, route, navigate, onSignedIn }: { lang: string; route: string; navigate: (tab: string) => void; onSignedIn?: () => void }) {
  const lang: Lang = siteLang === 'ar' ? 'ar' : 'en';
  const t = tx(lang);
  const session = useSession();
  const [toast, setToast] = useState('');
  const go = useCallback((r: string) => { navigate(r ? `community/${r}` : 'community'); window.scrollTo({ top: 0, behavior: 'smooth' }); }, [navigate]);
  const parts = route.split('/').filter(Boolean);
  const [page, a] = parts;
  const member = session.status === 'member' && session.me;
  useEffect(() => { if (member) onSignedIn?.(); }, [member, onSignedIn]);
  // The site's floating helpers (Shaheen, «مساعد شام») would cover the message box while chatting.
  useEffect(() => {
    if (page !== 'messenger') return;
    document.body.dataset.shamFocus = 'messenger';
    return () => { delete document.body.dataset.shamFocus; };
  }, [page]);

  const pulse = session.pulse;
  const tabs: { id: string; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: 'social', label: t('سوشيال شام', 'Sham Social'), icon: <Home className="h-4 w-4" /> },
    { id: 'messenger', label: t('الماسنجر', 'Messenger'), icon: <MessageCircle className="h-4 w-4" />, badge: pulse?.messages },
    { id: 'notifications', label: t('الإشعارات', 'Notifications'), icon: <Bell className="h-4 w-4" />, badge: (pulse?.notifications || 0) + (pulse?.requests || 0) },
    { id: 'me', label: t('بوابتي', 'My portal'), icon: <User className="h-4 w-4" /> },
    { id: 'merchant', label: t('بوابة التجار', 'Merchants'), icon: <Wrench className="h-4 w-4" /> },
    { id: 'stores', label: t('متاجر شام', 'Stores'), icon: <Store className="h-4 w-4" /> },
  ];
  const active = !page ? 'social' : page === 'u' || page === 'friends' ? 'social' : page === 'store' ? 'stores' : page;
  const isPublic = page === 'stores' || page === 'store';

  let body: React.ReactNode;
  if (session.status === 'loading') body = <Spinner />;
  else if (session.status === 'disabled' || session.status === 'offline') body = <NotReady lang={lang} offline={session.status === 'offline'} />;
  else if (page === 'stores') body = <StoreDirectory lang={lang} go={go} />;
  else if (page === 'store' && a) body = <StorePage lang={lang} go={go} slug={a} />;
  else if (!member) body = <HubAuth lang={lang} initial={page === 'join' ? 'register' : 'login'} onDone={(merchant) => go(merchant ? 'merchant' : 'social')} />;
  else if (page === 'messenger') body = <Messenger lang={lang} session={session} chatId={a} go={go} toast={setToast} />;
  else if (page === 'me') body = <UserPortal lang={lang} session={session} section={a} go={go} toast={setToast} />;
  else if (page === 'merchant') body = <MerchantPortal lang={lang} session={session} section={a} go={go} toast={setToast} />;
  else if (page === 'notifications') body = <NotificationsPage lang={lang} go={go} />;
  else if (page === 'friends') body = <FriendsPage lang={lang} go={go} toast={setToast} />;
  else if (page === 'u' && a) body = <ProfilePage handle={a} lang={lang} go={go} toast={setToast} />;
  else body = <SocialFeed lang={lang} session={session} go={go} toast={setToast} />;

  const showChrome = Boolean(member) || isPublic;
  return (
    <div dir={lang === 'ar' ? 'rtl' : 'ltr'} className="min-h-[70vh] bg-stone-50 pb-16">
      {showChrome && (
        <div className="sticky top-0 z-30 border-b border-stone-200 bg-white/95 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center gap-0.5 overflow-x-auto px-2 py-2 sm:gap-1 sm:px-4">
            <button type="button" onClick={() => go('')} className="me-1 flex shrink-0 items-center gap-2 font-black sm:me-2 text-stone-900 cursor-pointer"><Users className="h-5 w-5 text-amber-600" /><span className="hidden sm:inline">{t('مجتمع شام', 'Sham Community')}</span></button>
            {tabs.filter((tab) => member || tab.id === 'stores').map((tab) => (
              <button key={tab.id} type="button" onClick={() => go(tab.id)}
                className={`flex shrink-0 items-center gap-1.5 rounded-xl px-2.5 py-2 text-sm sm:px-3 font-semibold transition cursor-pointer ${active === tab.id ? 'bg-amber-100 text-amber-900' : 'text-stone-600 hover:bg-stone-100'}`}>
                {tab.icon}<span className="hidden md:inline">{tab.label}</span><Badge n={tab.badge} />
              </button>
            ))}
            <span className="ms-auto" />
            {member ? (
              <div className="flex shrink-0 items-center gap-1 sm:gap-2">
                <button type="button" onClick={() => go(`u/${member.handle}`)} className="cursor-pointer" title={member.name}><Avatar user={member} size={32} ring /></button>
                <button type="button" title={t('تسجيل الخروج', 'Sign out')} onClick={() => void signOut().then(() => go(''))} className="rounded-full p-1.5 text-stone-500 hover:bg-stone-100 cursor-pointer sm:p-2"><LogOut className="h-4 w-4" /></button>
              </div>
            ) : <Btn small onClick={() => go('login')}>{t('دخول / حساب جديد', 'Sign in / Join')}</Btn>}
          </div>
        </div>
      )}
      <div className={showChrome ? 'mx-auto max-w-6xl px-2 py-4 sm:px-4' : ''}>{body}</div>
      {toast && <Toast text={toast} onDone={() => setToast('')} />}
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
