import { useEffect, useState } from 'react';
import { Globe, KeyRound, Loader2, LogOut } from 'lucide-react';
import { T, adminDir, useAdminLanguage } from './adminL10n';
import { AdminApiError, adminRequest, getToken, setToken } from './adminApi';
import { isStaticHosting } from '../utils/api';
import { OPS_CODE, verifyOpsCode } from '../utils/opsCode';
import bundledCensus from '../data/live/platform-census.json';
import { emptyCensusReport, emptyLiveNow, readCensusReport, type CensusLiveNow, type CensusReport } from '../utils/platformCensus';
import { loadLiveCensusSnapshot } from './PlatformCensusPanel';
import { WorldHeatmapPageBackdrop } from './WorldVisitHeatmap';
import ShaheenOpsMapPanel from './ShaheenOpsMapPanel';

const EMPTY_GATE_REPORT = emptyCensusReport();

/**
 * #admin/ops (and the old #ops) — «خريطة التشغيل» for the management only, on the GitHub Pages site too.
 * Two ways in, whichever works: the map code the owner stored as the GitHub secret SHAM_OPS_CODE (checked in the
 * browser against the build's salted hash — no server needed), or the server's admin code (SHAM_ADMIN_TOKEN).
 * Kept for this tab only (sessionStorage) and out of search engines.
 */
const OK_KEY = 'sham_ops_ok';
const card = 'rounded-2xl border border-stone-200 bg-white p-5 shadow-sm';

const okCode = () => { try { return Boolean(OPS_CODE) && sessionStorage.getItem(OK_KEY) === OPS_CODE!.raw; } catch { return false; } };
const setOk = (v: string) => { try { if (v) sessionStorage.setItem(OK_KEY, v); else sessionStorage.removeItem(OK_KEY); } catch { /* private mode */ } };
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function OpsMapGate() {
  useAdminLanguage();
  const [authed, setAuthed] = useState(okCode);
  const [checking, setChecking] = useState(!okCode() && Boolean(getToken()) && !isStaticHosting);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [fails, setFails] = useState(0);
  const [censusReport, setCensusReport] = useState<CensusReport>(() => readCensusReport(bundledCensus));
  const [censusLive, setCensusLive] = useState<CensusLiveNow>(() => emptyLiveNow());
  const [pageBgOn, setPageBgOn] = useState(true);

  useEffect(() => {
    if (!authed) return;
    void loadLiveCensusSnapshot().then((s) => { setCensusReport(s.report); setCensusLive(s.liveNow); }).catch(() => {});
  }, [authed]);

  useEffect(() => {
    document.title = T('خريطة التشغيل');
    const meta = document.createElement('meta');
    meta.name = 'robots'; meta.content = 'noindex, nofollow';
    document.head.appendChild(meta);
    document.documentElement.dir = adminDir();
    return () => meta.remove();
  }, []);

  // Already signed in to the admin panel in this tab → straight in.
  useEffect(() => {
    if (authed || !checking) return;
    adminRequest('/overview').then(() => setAuthed(true), () => undefined).finally(() => setChecking(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async () => {
    const candidate = code.trim();
    if (!candidate) return;
    setChecking(true); setError('');
    try {
      if (await verifyOpsCode(candidate)) { setOk(OPS_CODE!.raw); setCode(''); setAuthed(true); setFails(0); return; }
      if (!isStaticHosting) {
        try { await adminRequest('/overview', {}, candidate); setToken(candidate); setCode(''); setAuthed(true); setFails(0); return; }
        catch (e) { if (e instanceof AdminApiError && e.status === 429) { setError(T('محاولات كثيرة فاشلة. انتظر 15 دقيقة.')); return; } }
      }
      // A growing pause after each wrong code slows down guessing.
      await wait(Math.min(10_000, 1000 * (fails + 1)));
      setFails((n) => n + 1);
      setError(OPS_CODE ? T('الرمز غير صحيح.') : T('النسخة دي من الموقع لسه ما استلمتش «رمز الخريطة»، فمفيش رمز هيفتح دلوقتي. استنى التحديث الجاي للموقع وجرب تاني.'));
    } finally { setChecking(false); }
  };

  const logout = () => { setOk(''); setToken(''); setAuthed(false); };

  if (!authed) {
    return (
      <div dir={adminDir()} className="relative min-h-screen bg-[#040d1d] font-sans text-stone-900">
        <WorldHeatmapPageBackdrop report={EMPTY_GATE_REPORT} />
        <div className="relative z-10 pt-24 px-3">
          <form className={`${card} mx-auto max-w-sm space-y-4 bg-white/92 backdrop-blur-md border-cyan-400/40 shadow-2xl`} onSubmit={(e) => { e.preventDefault(); void submit(); }}>
            <div className="flex items-center gap-2"><KeyRound className="h-5 w-5 text-amber-700" /><h1 className="text-lg font-bold">{T('خريطة التشغيل')}</h1></div>
            <p className="text-xs text-stone-500">{T('للإدارة فقط. اكتب «رمز الخريطة» اللي سجلته في جيت هب، أو رمز الإدارة بتاع الخادم. الدخول بيتحفظ في الصفحة دي بس لحد ما تقفلها.')}</p>
            <input className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm" type="password" dir="ltr" autoComplete="current-password" value={code} onChange={(e) => setCode(e.target.value)} placeholder={T('الرمز')} aria-label={T('الرمز')} />
            {!OPS_CODE && isStaticHosting && !error && (
              <p className="rounded-xl bg-amber-50 p-3 text-xs leading-relaxed text-amber-900">{T('النسخة دي من الموقع لسه ما استلمتش «رمز الخريطة». تأكد إنك سجلته في جيت هب كـ «سر» (Secret) باسم SHAM_OPS_CODE بالظبط و12 حرف أو أكتر، وبعدها الموقع بيتحدّث لوحده خلال ساعة أو اتنين والرسالة دي هتختفي.')}</p>
            )}
            {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
            <button disabled={checking || !code.trim()} className="flex w-full items-center justify-center rounded-xl bg-stone-900 px-3 py-2 text-sm font-bold text-amber-100 disabled:opacity-50">{checking ? <Loader2 className="h-4 w-4 animate-spin" /> : T('دخول')}</button>
            <a href="#home" className="block text-center text-xs text-stone-500 hover:underline">{T('العودة إلى الموقع')}</a>
          </form>
        </div>
      </div>
    );
  }
  return (
    <div dir={adminDir()} className={`relative min-h-screen font-sans ${pageBgOn ? 'bg-[#050b16] text-stone-900' : 'bg-stone-100 text-stone-900'}`}>
      {pageBgOn && <WorldHeatmapPageBackdrop report={censusReport} liveNow={censusLive} />}
      <div className="relative z-10 mx-auto max-w-7xl p-3 sm:p-6">
        <div className={`mb-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl px-4 py-2.5 ${pageBgOn ? 'border border-slate-700/80 bg-slate-950/80 text-slate-100 backdrop-blur-md' : ''}`}>
          <h1 className="text-lg font-black flex items-center gap-2">
            {T('خريطة التشغيل')}
            <span className="text-xs font-semibold text-amber-300">{T('· خلفية العالم الحرارية الحية')}</span>
          </h1>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setPageBgOn((v) => !v)}
              className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-bold ${
                pageBgOn
                  ? 'border-cyan-400/40 bg-cyan-500/15 text-cyan-200'
                  : 'border-stone-300 bg-white text-stone-700'
              }`}
            >
              <Globe className="h-3.5 w-3.5" />
              {pageBgOn ? T('خلفية الصفحة الحرارية: شغّالة') : T('خلفية الصفحة الحرارية: مخفية')}
            </button>
            <button type="button" onClick={logout} className={`inline-flex items-center gap-1 text-xs font-bold hover:underline ${pageBgOn ? 'text-slate-200' : 'text-stone-600'}`}><LogOut className="h-3.5 w-3.5" />{T('خروج')}</button>
            <a href="#home" className={`text-xs font-bold hover:underline ${pageBgOn ? 'text-amber-200' : 'text-stone-600'}`}>{T('العودة إلى الموقع')}</a>
          </div>
        </div>
        <ShaheenOpsMapPanel />
      </div>
    </div>
  );
}
