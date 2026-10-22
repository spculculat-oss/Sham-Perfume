import { Suspense, lazy, useCallback, useEffect, useState, type ReactNode } from 'react';
import {
  Activity, Banknote, Crown, ExternalLink, Inbox, KeyRound, LayoutDashboard, Loader2, Lock, LogOut, MessagesSquare, Network, ShieldCheck, Siren,
} from 'lucide-react';
import { T, TP, adminDir, useAdminLanguage } from './adminL10n';
import { AdminApiError, adminRequest, getToken, setToken } from './adminApi';
import { isStaticHosting } from '../utils/api';
import { OPS_CODE, verifyOpsCode } from '../utils/opsCode';
import bundledControls from '../data/owner/controls.json';
import bundledPrecheck from '../data/live/shaheen-precheck.json';
import { BOTS } from '../utils/shaheenOrg';
import { readControls, stoppedByOwner } from '../utils/ownerAuthority';

/**
 * #owner — «جناح صاحب الموقع»: a separate management structure for the owner only, entered from the home page's
 * discreet key. Its own layout (not the staff dashboard): his private room with Shaheen and the secretary, his
 * control centre, the robots' structure, the live operations map, the patrol and the money — each tool loaded only
 * after he is in. Way in: the admin code (everything) or the map code (the read-only tools; the room needs the
 * server). Kept for this tab only, locks itself after 30 idle minutes, and stays out of search engines.
 */
const OwnerRoom = lazy(() => import('./OwnerRoom'));
const OwnerInbox = lazy(() => import('./OwnerInbox'));
const OwnerControlPanel = lazy(() => import('./OwnerControlPanel'));
const ShaheenOrgPanel = lazy(() => import('./ShaheenOrgPanel'));
const ShaheenCouncilPanel = lazy(() => import('./ShaheenCouncilPanel'));
const ShaheenPatrolPanel = lazy(() => import('./ShaheenPatrolPanel'));
const ShaheenOpsMapPanel = lazy(() => import('./ShaheenOpsMapPanel'));
const BankPanel = lazy(() => import('./BankPanel'));
const FinancePanel = lazy(() => import('./FinancePanel'));

type Section = 'home' | 'inbox' | 'room' | 'control' | 'org' | 'ops' | 'patrol' | 'money';
type Access = 'full' | 'map';
const MAP_KEY = 'sham_owner_map_ok';
const IDLE_MS = 30 * 60_000;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

const SECTIONS: { id: Section; label: () => string; hint: () => string; icon: ReactNode; needs?: Access }[] = [
  { id: 'home', label: () => T('مكتبك'), hint: () => T('نظرة سريعة على كل حاجة'), icon: <LayoutDashboard className="h-4 w-4" /> },
  { id: 'inbox', label: () => T('صندوق الموافقات'), hint: () => T('اللي شاهين جهّزه ومستني رأيك'), icon: <Inbox className="h-4 w-4" /> },
  { id: 'room', label: () => T('غرفة شاهين الخاصة'), hint: () => T('إنت وشاهين والسكرتير بس'), icon: <MessagesSquare className="h-4 w-4" />, needs: 'full' },
  { id: 'control', label: () => T('مركز التحكم'), hint: () => T('وقف وتشغيل وموافقات'), icon: <Siren className="h-4 w-4" /> },
  { id: 'org', label: () => T('الهيكل والاجتماع'), hint: () => T('الروبوتات وأقسامها وقرارات المجلس'), icon: <Network className="h-4 w-4" /> },
  { id: 'ops', label: () => T('خريطة التشغيل'), hint: () => T('مين شغال دلوقتي'), icon: <Activity className="h-4 w-4" /> },
  { id: 'patrol', label: () => T('الدورية والفحص'), hint: () => T('العطلات وإصلاحها'), icon: <ShieldCheck className="h-4 w-4" /> },
  { id: 'money', label: () => T('البنك والمالية'), hint: () => T('حسابات بنك شام والفلوس'), icon: <Banknote className="h-4 w-4" />, needs: 'full' },
];

function useNoIndex(title: string) {
  useEffect(() => {
    document.title = title;
    const meta = document.createElement('meta');
    meta.name = 'robots'; meta.content = 'noindex, nofollow';
    document.head.appendChild(meta);
    document.documentElement.dir = adminDir();
    return () => meta.remove();
  }, [title]);
}

export default function OwnerSuite() {
  useAdminLanguage();
  useNoIndex(T('جناح صاحب الموقع'));
  const [access, setAccess] = useState<Access | null>(null);
  const [code, setCode] = useState('');
  const [checking, setChecking] = useState(Boolean(getToken()) && !isStaticHosting);
  const [error, setError] = useState('');
  const [fails, setFails] = useState(0);
  const [section, setSection] = useState<Section>('home');

  // Already signed in in this tab (admin code or map code) → straight in.
  useEffect(() => {
    try { if (OPS_CODE && sessionStorage.getItem(MAP_KEY) === OPS_CODE.raw) setAccess('map'); } catch { /* private mode */ }
    const saved = getToken();
    if (!saved || isStaticHosting) return;
    adminRequest('/overview', {}, saved).then(() => setAccess('full'), () => undefined).finally(() => setChecking(false));
  }, []);

  const lock = useCallback(() => {
    setToken(''); try { sessionStorage.removeItem(MAP_KEY); } catch { /* ignore */ }
    setAccess(null); setSection('home'); setCode('');
  }, []);

  // Locks itself after 30 minutes without a touch.
  useEffect(() => {
    if (!access) return;
    let timer = setTimeout(lock, IDLE_MS);
    const touch = () => { clearTimeout(timer); timer = setTimeout(lock, IDLE_MS); };
    const events = ['pointerdown', 'keydown', 'scroll'] as const;
    events.forEach((e) => window.addEventListener(e, touch, { passive: true }));
    return () => { clearTimeout(timer); events.forEach((e) => window.removeEventListener(e, touch)); };
  }, [access, lock]);

  const submit = async () => {
    const candidate = code.trim();
    if (!candidate) return;
    setChecking(true); setError('');
    try {
      if (!isStaticHosting) {
        try { await adminRequest('/overview', {}, candidate); setToken(candidate); setCode(''); setFails(0); setAccess('full'); return; }
        catch (e) { if (e instanceof AdminApiError && e.status === 429) { setError(T('محاولات كثيرة فاشلة. انتظر 15 دقيقة.')); return; } }
      }
      if (await verifyOpsCode(candidate)) { try { sessionStorage.setItem(MAP_KEY, OPS_CODE!.raw); } catch { /* ignore */ } setCode(''); setFails(0); setAccess('map'); return; }
      // A growing pause after each wrong code slows down guessing.
      await wait(Math.min(10_000, 1000 * (fails + 1)));
      setFails((n) => n + 1);
      setError(T('الكود غير صحيح.'));
    } finally { setChecking(false); }
  };

  if (!access) {
    return (
      <div dir={adminDir()} className="flex min-h-screen items-center justify-center bg-gradient-to-b from-stone-950 via-stone-900 to-black p-4 font-sans text-stone-100">
        <form className="w-full max-w-sm space-y-4 rounded-3xl border border-amber-900/60 bg-stone-950/80 p-6 shadow-2xl shadow-amber-950/40" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
          <div className="flex flex-col items-center gap-2 text-center">
            <span className="rounded-full border border-amber-700 bg-amber-950/60 p-3"><Crown className="h-7 w-7 text-amber-400" /></span>
            <h1 className="text-xl font-black text-amber-100">{T('جناح صاحب الموقع')}</h1>
            <p className="text-xs text-stone-400">{T('مكان خاص بصاحب الموقع بس. اكتب الكود السري بتاعك. الدخول بيفضل في الصفحة دي لحد ما تقفلها، وبيتقفل لوحده لو سبتها نص ساعة.')}</p>
          </div>
          <input className="w-full rounded-xl border border-stone-700 bg-black px-3 py-2 text-center text-sm tracking-widest text-amber-100" type="password" dir="ltr" autoComplete="current-password" autoFocus
            value={code} onChange={(e) => setCode(e.target.value)} placeholder={T('الكود السري')} aria-label={T('الكود السري')} />
          {error && <p role="alert" className="text-center text-xs text-red-400">{error}</p>}
          <button disabled={checking || !code.trim()} className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 px-3 py-2 text-sm font-black text-stone-950 disabled:opacity-40">
            {checking ? <Loader2 className="h-4 w-4 animate-spin" /> : <><KeyRound className="h-4 w-4" />{T('دخول')}</>}
          </button>
          <a href="#home" className="block text-center text-xs text-stone-500 hover:text-stone-300">{T('العودة إلى الموقع')}</a>
        </form>
      </div>
    );
  }

  const allowed = (s: (typeof SECTIONS)[number]) => !s.needs || s.needs === access;
  const current = SECTIONS.find((s) => s.id === section)!;
  return (
    <div dir={adminDir()} className="min-h-screen bg-stone-950 font-sans text-stone-100 md:flex">
      <aside className="border-b border-stone-800 bg-black/60 md:sticky md:top-0 md:h-screen md:w-64 md:shrink-0 md:border-b-0 md:border-e">
        <div className="flex items-center gap-2 p-4">
          <Crown className="h-6 w-6 text-amber-400" />
          <div><div className="font-black text-amber-100">{T('جناح صاحب الموقع')}</div><div className="text-[10px] text-stone-500">{access === 'full' ? T('دخول كامل بالكود السري') : T('دخول بكود الخريطة — عرض بس')}</div></div>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-2 pb-2 md:flex-col md:overflow-visible">
          {SECTIONS.map((s) => (
            <button key={s.id} type="button" disabled={!allowed(s)} onClick={() => setSection(s.id)}
              className={`flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-start text-sm disabled:opacity-35 ${section === s.id ? 'bg-amber-500 font-bold text-stone-950' : 'text-stone-300 hover:bg-white/5'}`}>
              {s.icon}<span>{s.label()}</span>{!allowed(s) && <Lock className="ms-auto h-3 w-3" />}
            </button>
          ))}
        </nav>
        <div className="hidden space-y-1 p-3 md:block">
          <a href="#admin" className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs text-stone-400 hover:bg-white/5"><ExternalLink className="h-3.5 w-3.5" />{T('لوحة الإدارة الكاملة')}</a>
          <button type="button" onClick={lock} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs text-red-300 hover:bg-red-950/40"><LogOut className="h-3.5 w-3.5" />{T('اقفل الجناح')}</button>
        </div>
      </aside>
      <main className="flex-1 p-4 md:p-6">
        <div className="mb-4 flex items-center gap-2">
          <h1 className="text-lg font-black text-amber-100">{current.label()}</h1>
          <span className="text-xs text-stone-500">{current.hint()}</span>
          <button type="button" onClick={lock} className="ms-auto rounded-lg border border-stone-800 px-2 py-1 text-xs text-red-300 md:hidden">{T('اقفل الجناح')}</button>
        </div>
        <Suspense fallback={<div className="flex items-center gap-2 text-stone-400"><Loader2 className="h-4 w-4 animate-spin" />…</div>}>
          {section === 'home' && <OwnerHome go={setSection} access={access} />}
          {section === 'inbox' && <OwnerInbox code={access === 'full' ? getToken() : ''} onRoom={access === 'full' ? () => setSection('room') : undefined} />}
          {section === 'room' && access === 'full' && <OwnerRoom code={getToken()} />}
          {/* The staff panels keep their own light design inside the suite's frame. */}
          {section === 'control' && <Light><OwnerControlPanel /></Light>}
          {section === 'org' && <Light><ShaheenOrgPanel /><ShaheenCouncilPanel /></Light>}
          {section === 'ops' && <Light><ShaheenOpsMapPanel /></Light>}
          {section === 'patrol' && <Light><ShaheenPatrolPanel /></Light>}
          {section === 'money' && access === 'full' && <Light><BankPanel /><FinancePanel /></Light>}
        </Suspense>
      </main>
    </div>
  );
}

const Light = ({ children }: { children: ReactNode }) => <div className="space-y-4 rounded-3xl bg-stone-100 p-3 text-stone-900 md:p-4">{children}</div>;

function OwnerHome({ go, access }: { go: (s: Section) => void; access: Access }) {
  const controls = readControls(bundledControls);
  const paused = BOTS.filter((b) => b.workflow && stoppedByOwner(controls, b.id)).length;
  const precheck = bundledPrecheck as { health?: number; counts?: Record<string, number>; updatedAt?: string };
  const tile = 'rounded-2xl border border-stone-800 bg-stone-900/70 p-4 text-start hover:border-amber-700';
  return (
    <div className="space-y-4">
      <div className="rounded-3xl border border-amber-900/60 bg-gradient-to-br from-amber-950/60 to-stone-900 p-5">
        <div className="text-sm text-amber-200">{T('أهلاً بيك في جناحك 👑')}</div>
        <p className="mt-1 text-xs text-stone-300">{T('شاهين هو الوكيل المسؤول عن الموقع: بيجهّز كل حاجة، وإنت بتراجع وتوافق من «صندوق الموافقات» أو من غرفتك الخاصة. ومن هنا كمان بتوقف أو تشغل أي روبوت وتتابع الشغل والفلوس. محدش غيرك يقدر يدخل هنا.')}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <button type="button" onClick={() => go('inbox')} className={`${tile} border-amber-800`}>
          <Inbox className="mb-2 h-5 w-5 text-amber-300" /><div className="font-bold">{T('صندوق الموافقات')}</div>
          <div className="text-xs text-stone-400">{controls.selfDevelopment === 'approve_all' ? T('شاهين بيجهّز كل حاجة، ومفيش حاجة بتتنفذ غير بموافقتك') : T('التصليحات الصغيرة بتدخل لوحدها، والباقي مستني موافقتك')}</div>
        </button>
        <button type="button" disabled={access !== 'full'} onClick={() => go('room')} className={`${tile} disabled:opacity-40`}>
          <MessagesSquare className="mb-2 h-5 w-5 text-amber-400" /><div className="font-bold">{T('غرفة شاهين الخاصة')}</div>
          <div className="text-xs text-stone-400">{access === 'full' ? T('إنت وشاهين والسكرتير بس — متشفرة على جهازك') : T('محتاجة الكود السري بتاع الإدارة')}</div>
        </button>
        <button type="button" onClick={() => go('control')} className={tile}>
          <Siren className="mb-2 h-5 w-5 text-red-400" /><div className="font-bold">{T('مركز التحكم')}</div>
          <div className="text-xs text-stone-400">{controls.frozen ? T('فرامل الطوارئ شغالة: كل الروبوتات واقفة') : TP('{n} روبوت موقوف بأمرك', { n: paused })}</div>
        </button>
        <button type="button" onClick={() => go('org')} className={tile}>
          <Network className="mb-2 h-5 w-5 text-sky-400" /><div className="font-bold">{T('الهيكل والاجتماع')}</div>
          <div className="text-xs text-stone-400">{TP('{n} أداة وروبوت · صحة الأدوات {h}%', { n: BOTS.length, h: precheck.health ?? 0 })}</div>
        </button>
        <button type="button" onClick={() => go('ops')} className={tile}>
          <Activity className="mb-2 h-5 w-5 text-emerald-400" /><div className="font-bold">{T('خريطة التشغيل')}</div>
          <div className="text-xs text-stone-400">{T('مين شغال دلوقتي ومين واقف وليه')}</div>
        </button>
        <button type="button" onClick={() => go('patrol')} className={tile}>
          <ShieldCheck className="mb-2 h-5 w-5 text-violet-400" /><div className="font-bold">{T('الدورية والفحص')}</div>
          <div className="text-xs text-stone-400">{T('العطلات المفتوحة واللي اتصلح')}</div>
        </button>
        <button type="button" disabled={access !== 'full'} onClick={() => go('money')} className={`${tile} disabled:opacity-40`}>
          <Banknote className="mb-2 h-5 w-5 text-amber-300" /><div className="font-bold">{T('البنك والمالية')}</div>
          <div className="text-xs text-stone-400">{access === 'full' ? T('حسابات بنك شام والمدفوعات') : T('محتاجة الكود السري بتاع الإدارة')}</div>
        </button>
      </div>
    </div>
  );
}
