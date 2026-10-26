/**
 * «خانة التعداد والكشف العلني — هيكل دولة المنصة» (`src/admin/PlatformCensusPanel.tsx`)
 *
 * Complete Census & Colored World Map Dashboard:
 *   1. Six Complete Counters:
 *      - عداد منذ إنشاء الموقع (`All-Time Since Site Creation`)
 *      - عداد شهري (`Monthly Counter`)
 *      - عداد أسبوعي (`Weekly Counter`)
 *      - عداد يومي (`Daily Counter`)
 *      - عداد تقسيم اليوم (`Day-Part & 24-Hour Counter`)
 *      - عداد لحظي (`Live Real-Time Online Counter`)
 *   2. Colored 182-Country Thermal World Map + Exact Sub-Country Visitor Entry Pinpoints (`WorldVisitHeatmap`).
 *   3. Exact Entry Cities / Governorates Table + Live Entry Radar Feed (`recentEntries`).
 *   4. Executive Report & Certified Open Statement (`الكشف العلني المعتمد`) with Copy, CSV, and JSON export.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Calendar,
  Check,
  Clock,
  Copy,
  Crosshair,
  Download,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  Flame,
  Globe,
  MapPin,
  Radio,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Sun,
  Users,
} from 'lucide-react';
import bundledCensus from '../data/live/platform-census.json';
import { OWNER } from '../utils/ownerAuthority';
import { apiUrl, isStaticHosting } from '../utils/api';
import { T, TP, adminLocale, formatAdminNumber, getAdminLang, useAdminLanguage } from './adminL10n';
import WorldVisitHeatmap from './WorldVisitHeatmap';
import {
  CENSUS_BOT,
  CENSUS_SECTIONS,
  DAY_PARTS,
  HEAT_COLORS,
  WORLD_REGIONS,
  buildPublicStatement,
  cairoDay,
  cairoHour,
  countryNameAr,
  countryNameEn,
  csvStatement,
  dayPartBreakdown,
  dayPartOfHour,
  emptyLiveNow,
  enrichPlaces,
  flagOfCountry,
  mergeCensusReports,
  plainTextStatement,
  readCensusReport,
  type CensusLiveNow,
  type CensusReport,
  type WorldRegionId,
} from '../utils/platformCensus';

const RAW_MAIN_CENSUS = `https://raw.githubusercontent.com/${OWNER.repo}/main/src/data/live/${CENSUS_BOT.reportFile}`;
const WORKFLOW_URL = `https://github.com/${OWNER.repo}/actions/workflows/${CENSUS_BOT.workflowFile}`;

function readLiveNow(raw: unknown): CensusLiveNow | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const d = raw as Record<string, unknown>;
  return {
    asOf: typeof d.asOf === 'string' ? d.asOf : new Date().toISOString(),
    activeVisitors: typeof d.activeVisitors === 'number' && d.activeVisitors > 0 ? Math.floor(d.activeVisitors) : 0,
    last5mVisits: typeof d.last5mVisits === 'number' && d.last5mVisits > 0 ? Math.floor(d.last5mVisits) : 0,
    last60mVisits: typeof d.last60mVisits === 'number' && d.last60mVisits > 0 ? Math.floor(d.last60mVisits) : 0,
    activeCountries: Array.isArray(d.activeCountries) ? (d.activeCountries as CensusLiveNow['activeCountries']) : [],
    activePlaces: Array.isArray(d.activePlaces) ? (d.activePlaces as CensusLiveNow['activePlaces']) : [],
  };
}

export async function loadLiveCensusSnapshot(): Promise<{
  report: CensusReport;
  liveNow: CensusLiveNow;
  liveServerConnected: boolean;
  storageKind?: string;
}> {
  const now = new Date();
  let merged = readCensusReport(bundledCensus, now);
  let live = emptyLiveNow(now.toISOString());
  let liveServerConnected = false;
  let storageKind: string | undefined;

  const tasks: Promise<void>[] = [];

  tasks.push(
    fetch(`${RAW_MAIN_CENSUS}?t=${Date.now()}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((raw) => {
        if (raw) merged = mergeCensusReports(merged, readCensusReport(raw, now), now);
      })
      .catch(() => {}),
  );

  const publicEndpoint = apiUrl('/api/census/public');
  const skipLocalStatic = isStaticHosting && publicEndpoint.startsWith('/');
  if (!skipLocalStatic) {
    tasks.push(
      fetch(publicEndpoint, { cache: 'no-store', credentials: 'omit' })
        .then((r) => (r.ok ? r.json() : null))
        .then((data: { ok?: boolean; report?: unknown; liveNow?: unknown; storage?: { kind?: string } } | null) => {
          if (data?.report) {
            merged = mergeCensusReports(merged, readCensusReport(data.report, now), now);
            liveServerConnected = true;
            storageKind = data.storage?.kind;
          }
          const parsedLive = readLiveNow(data?.liveNow);
          if (parsedLive) live = parsedLive;
        })
        .catch(() => {}),
    );
  }

  await Promise.all(tasks);
  return { report: merged, liveNow: live, liveServerConnected, storageKind };
}

function downloadBlob(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function PlatformCensusPanel({ embedded = false }: { embedded?: boolean }) {
  useAdminLanguage();
  const lang = getAdminLang() === 'ar' ? 'ar' : 'en';
  const isAr = lang === 'ar';

  const [report, setReport] = useState<CensusReport>(() => readCensusReport(bundledCensus));
  const [liveNow, setLiveNow] = useState<CensusLiveNow>(() => emptyLiveNow());
  const [liveConnected, setLiveConnected] = useState(false);
  const [storageKind, setStorageKind] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [dayPartScope, setDayPartScope] = useState<'today' | 'all'>('today');
  const [activeSubTab, setActiveSubTab] = useState<'all' | 'heatmap' | 'places' | 'report' | 'statement'>('all');

  const refresh = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const snap = await loadLiveCensusSnapshot();
      setReport(snap.report);
      setLiveNow(snap.liveNow);
      setLiveConnected(snap.liveServerConnected);
      setStorageKind(snap.storageKind);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh(false);
    const timer = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      void refresh(true);
    }, 12_000);
    return () => clearInterval(timer);
  }, [refresh]);

  const statement = useMemo(() => buildPublicStatement(report), [report]);
  const placesList = useMemo(
    () => enrichPlaces(report, { country: selectedCountry, mode: 'total' }),
    [report, selectedCountry],
  );
  const daySplit = useMemo(() => dayPartBreakdown(report, dayPartScope), [report, dayPartScope]);
  const maxHourCount = Math.max(1, ...daySplit.hours);

  const currentCairoHour = cairoHour(new Date());
  const currentDayPartMeta = DAY_PARTS[dayPartOfHour(currentCairoHour)];
  const currentDayPartVisits =
    dayPartBreakdown(report, 'today').parts.find((p) => p.id === currentDayPartMeta.id)?.visits ?? 0;

  const daysSinceCreation = useMemo(() => {
    const startMs = Date.parse(report.siteCreatedAt) || Date.parse('2026-10-12T05:24:11Z');
    return Math.max(1, Math.ceil((Date.now() - startMs) / 86_400_000));
  }, [report.siteCreatedAt]);

  const copyStatement = async () => {
    try {
      await navigator.clipboard.writeText(plainTextStatement(report, lang));
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // clipboard blocked
    }
  };

  const sectionEntries = useMemo(
    () => Object.entries(report.bySection).sort((a, b) => b[1] - a[1]),
    [report.bySection],
  );
  const maxSectionCount = Math.max(1, ...sectionEntries.map(([, v]) => v));

  const regionEntries = useMemo(
    () =>
      (Object.keys(WORLD_REGIONS) as WorldRegionId[])
        .map((id) => ({ id, ...WORLD_REGIONS[id], ...report.byRegion[id] }))
        .sort((a, b) => b.visits - a.visits),
    [report.byRegion],
  );
  const maxRegionVisits = Math.max(1, ...regionEntries.map((r) => r.visits));

  const recentDays = useMemo(() => report.byDay.slice(-14), [report.byDay]);
  const maxDayVisits = Math.max(1, ...recentDays.map((d) => d.visits));

  const deviceTotal = Math.max(1, report.byDevice.mobile + report.byDevice.desktop + report.byDevice.tablet);

  const fmtTime = (iso: string) =>
    Date.parse(iso) > 0
      ? new Date(iso).toLocaleString(adminLocale(), {
          dateStyle: 'medium',
          timeStyle: 'short',
          timeZone: 'Africa/Cairo',
        })
      : '—';

  return (
    <section
      id="state-census-slot"
      className={`rounded-2xl border ${
        embedded
          ? 'border-amber-300/80 bg-gradient-to-b from-amber-50/40 via-white to-white p-4 sm:p-5'
          : 'border-stone-200 bg-white p-4 sm:p-6'
      } shadow-sm space-y-5`}
    >
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-stone-200 pb-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-stone-900 text-amber-200 px-3 py-1 text-xs font-bold">
              <Flame className="w-3.5 h-3.5 text-amber-400" />
              {T('خانة التعداد — هيكل دولة المنصة')}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 px-2.5 py-0.5 text-[11px] font-semibold">
              <ShieldCheck className="w-3.5 h-3.5" />
              {liveConnected
                ? TP('متصل بالعداد الحي ({kind})', { kind: storageKind || 'live' })
                : T('متصل بسجل الدولة المعتمد')}
            </span>
            <span className="text-[11px] text-stone-500 font-mono" dir="ltr">
              bot: {CENSUS_BOT.id} · {statement.editionCode}
            </span>
          </div>
          <h3 className="text-base sm:text-lg font-bold text-stone-900">
            {T('خريطة الدول بالألوان ورصد أماكن الدخول الدقيقة + منظومة العدادات الـ 6')}
          </h3>
          <p className="text-xs text-stone-600">
            {T('فصل كل دولة بلونها الحراري المستقل، وتحديد مدينة ومحافظة دخول كل زائر بدقة على الخريطة، مع عدادات منذ إنشاء الموقع، شهري، أسبوعي، يومي، تقسيم اليوم، ولحظي مباشر.')}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void refresh(false)}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-xl border border-stone-300 bg-white px-3 py-1.5 text-xs font-semibold text-stone-800 hover:bg-stone-50 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            {T('تحديث التعداد')}
          </button>
          <a
            href={WORKFLOW_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-xl bg-stone-900 text-amber-100 px-3 py-1.5 text-xs font-semibold hover:bg-stone-800"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            {T('سير عمل روبوت التعداد')}
          </a>
        </div>
      </div>

      {/* ── THE 6 REQUESTED COUNTERS («منظومة العدادات الـ 6 الكاملة») ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5" data-testid="six-census-counters">
        {/* 1. عداد لحظي (Live Real-Time Counter) */}
        <div className="rounded-2xl border-2 border-emerald-400/70 bg-gradient-to-br from-emerald-950 via-slate-950 to-slate-900 text-white p-3 shadow-sm">
          <div className="flex items-center justify-between gap-1">
            <p className="text-[11px] text-emerald-300 font-bold flex items-center gap-1">
              <Radio className="h-3.5 w-3.5 text-emerald-400 animate-pulse" />
              {T('العداد اللحظي')}
            </p>
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
          </div>
          <p className="text-2xl font-black text-emerald-300 mt-1 tabular-nums">
            {formatAdminNumber(liveNow.activeVisitors)}
          </p>
          <p className="text-[10px] text-slate-300 mt-0.5">
            {TP('آخر 5 د: {m5} · آخر ساعة: {h1}', {
              m5: formatAdminNumber(liveNow.last5mVisits),
              h1: formatAdminNumber(liveNow.last60mVisits),
            })}
          </p>
        </div>

        {/* 2. عداد تقسيم اليوم (Day-Part Counter) */}
        <div className="rounded-2xl border border-violet-200 bg-violet-50/75 p-3">
          <p className="text-[11px] text-violet-900 font-bold flex items-center gap-1">
            <Clock className="h-3.5 w-3.5 text-violet-700" />
            {T('عداد تقسيم اليوم')}
          </p>
          <p className="text-2xl font-extrabold text-violet-950 mt-1 tabular-nums">
            {formatAdminNumber(currentDayPartVisits)}
          </p>
          <p className="text-[10px] text-violet-800 font-semibold mt-0.5 truncate">
            {isAr ? currentDayPartMeta.ar : currentDayPartMeta.en} ({isAr ? currentDayPartMeta.rangeAr : currentDayPartMeta.rangeEn})
          </p>
        </div>

        {/* 3. عداد يومي (Daily Counter) */}
        <div className="rounded-2xl border border-sky-200 bg-sky-50/75 p-3">
          <p className="text-[11px] text-sky-900 font-bold flex items-center gap-1">
            <Sun className="h-3.5 w-3.5 text-sky-700" />
            {T('العداد اليومي')}
          </p>
          <p className="text-2xl font-extrabold text-sky-950 mt-1 tabular-nums">
            {formatAdminNumber(report.totals.todayVisits)}
          </p>
          <p className="text-[10px] text-stone-600 mt-0.5">
            {TP('{n} زائر فريد اليوم', { n: formatAdminNumber(report.totals.todayUnique) })}
          </p>
        </div>

        {/* 4. عداد أسبوعي (Weekly Counter) */}
        <div className="rounded-2xl border border-cyan-200 bg-cyan-50/70 p-3">
          <p className="text-[11px] text-cyan-900 font-bold flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5 text-cyan-700" />
            {T('العداد الأسبوعي')}
          </p>
          <p className="text-2xl font-extrabold text-cyan-950 mt-1 tabular-nums">
            {formatAdminNumber(report.totals.last7DaysVisits)}
          </p>
          <p className="text-[10px] text-stone-600 mt-0.5">
            {TP('آخر 7 أيام ({u} فريد)', { u: formatAdminNumber(report.totals.last7DaysUnique) })}
          </p>
        </div>

        {/* 5. عداد شهري (Monthly Counter) */}
        <div className="rounded-2xl border border-indigo-200 bg-indigo-50/70 p-3">
          <p className="text-[11px] text-indigo-900 font-bold flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5 text-indigo-700" />
            {T('العداد الشهري')}
          </p>
          <p className="text-2xl font-extrabold text-indigo-950 mt-1 tabular-nums">
            {formatAdminNumber(report.totals.thisMonthVisits)}
          </p>
          <p className="text-[10px] text-stone-600 mt-0.5">
            {TP('آخر 30 يوماً: {n}', { n: formatAdminNumber(report.totals.last30DaysVisits) })}
          </p>
        </div>

        {/* 6. عداد منذ إنشاء الموقع (All-Time Counter Since Site Creation) */}
        <div className="rounded-2xl border-2 border-amber-300 bg-amber-50/85 p-3">
          <p className="text-[11px] text-amber-950 font-bold flex items-center gap-1">
            <Flame className="h-3.5 w-3.5 text-amber-600" />
            {T('منذ إنشاء الموقع')}
          </p>
          <p className="text-2xl font-black text-stone-900 mt-1 tabular-nums">
            {formatAdminNumber(report.totals.visits)}
          </p>
          <p className="text-[10px] text-amber-900 font-semibold mt-0.5">
            {TP('منذ {date} ({d} يوم · {u} فريد)', {
              date: cairoDay(report.siteCreatedAt),
              d: formatAdminNumber(daysSinceCreation),
              u: formatAdminNumber(report.totals.uniqueVisitors),
            })}
          </p>
        </div>
      </div>

      {/* ── DAY-PART & 24-HOUR BREAKDOWN («تفصيل عداد تقسيم اليوم على مدار الـ 24 ساعة») ── */}
      <div className="rounded-2xl border border-stone-200 bg-stone-50/80 p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h4 className="text-xs sm:text-sm font-black text-stone-900 flex items-center gap-1.5">
              <Clock className="h-4 w-4 text-violet-700" />
              {T('تفصيل عداد تقسيم اليوم (الأربع فترات + ساعات اليوم الـ 24 بتوقيت القاهرة)')}
            </h4>
            <p className="text-[11px] text-stone-500">
              {daySplit.peakHour !== null
                ? TP('ساعة الذروة الأعلى نشاطاً: الساعة {h}:00', { h: formatAdminNumber(daySplit.peakHour) })
                : T('يتم رصد وتقسيم كل زيارة تلقائياً حسب ساعة وفترة الدخول على مدار اليوم.')}
            </p>
          </div>
          <div className="inline-flex rounded-xl border border-stone-200 bg-white p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setDayPartScope('today')}
              className={`rounded-lg px-2.5 py-1 font-bold ${
                dayPartScope === 'today' ? 'bg-stone-900 text-amber-200' : 'text-stone-600'
              }`}
            >
              {T('تقسيم اليوم الحالي')}
            </button>
            <button
              type="button"
              onClick={() => setDayPartScope('all')}
              className={`rounded-lg px-2.5 py-1 font-bold ${
                dayPartScope === 'all' ? 'bg-stone-900 text-amber-200' : 'text-stone-600'
              }`}
            >
              {T('التقسيم التراكمي منذ الإنشاء')}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
          {daySplit.parts.map((part) => {
            const isNow = currentDayPartMeta.id === part.id && dayPartScope === 'today';
            return (
              <div
                key={part.id}
                className={`rounded-xl border p-3 bg-white ${
                  isNow ? 'border-violet-400 ring-2 ring-violet-200' : 'border-stone-200'
                }`}
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-stone-800">{isAr ? part.ar : part.en}</span>
                  <span className="text-[10px] font-mono text-stone-500">
                    {isAr ? part.rangeAr : part.rangeEn}
                  </span>
                </div>
                <div className="mt-1.5 flex items-baseline justify-between">
                  <b className="text-xl font-black text-stone-900 tabular-nums">{formatAdminNumber(part.visits)}</b>
                  <span className="text-xs font-bold" style={{ color: part.color }}>
                    {formatAdminNumber(part.sharePercent)}%
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 rounded-full bg-stone-100 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${Math.min(100, part.sharePercent)}%`, backgroundColor: part.color }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* 24-Hour Histogram */}
        <div className="rounded-xl border border-stone-200 bg-white p-3">
          <div className="flex items-end gap-1 h-16" dir="ltr">
            {daySplit.hours.map((cnt, hr) => {
              const isCurrentHr = hr === currentCairoHour && dayPartScope === 'today';
              const partColor = DAY_PARTS[dayPartOfHour(hr)].color;
              return (
                <div
                  key={hr}
                  className="flex-1 flex flex-col items-center gap-1 min-w-0"
                  title={`${String(hr).padStart(2, '0')}:00 — ${cnt}`}
                >
                  <div className="w-full h-11 bg-stone-100 rounded-t flex items-end overflow-hidden">
                    <div
                      className="w-full rounded-t transition-all"
                      style={{
                        height: cnt > 0 ? `${Math.max(12, (cnt / maxHourCount) * 100)}%` : '0%',
                        backgroundColor: isCurrentHr ? '#10b981' : partColor,
                      }}
                    />
                  </div>
                  <span
                    className={`text-[9px] font-mono ${
                      isCurrentHr ? 'font-black text-emerald-700' : 'text-stone-400'
                    }`}
                  >
                    {String(hr).padStart(2, '0')}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* View Switcher Pills */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-stone-200 pb-2.5 text-xs">
        {(
          [
            ['all', T('العرض الكامل (الخريطة الملونة + نقاط الدخول + التقرير + الكشف)')],
            ['heatmap', T('🌍 خريطة الدول الملونة ونقاط الدخول')],
            ['places', T('📍 سجل أماكن ومدن الدخول بدقة')],
            ['report', T('📊 التقرير التنفيذي لصاحب المنصة')],
            ['statement', T('📜 الكشف العلني المعتمد')],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveSubTab(id)}
            className={`rounded-xl px-3 py-1.5 font-semibold transition ${
              activeSubTab === id ? 'bg-stone-900 text-amber-200' : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* 1. Interactive Colored Country World Heatmap + Exact Entry Pinpoints */}
      {(activeSubTab === 'all' || activeSubTab === 'heatmap') && (
        <WorldVisitHeatmap
          report={report}
          liveNow={liveNow}
          selectedCountry={selectedCountry}
          onSelectCountry={setSelectedCountry}
        />
      )}

      {/* 2. Exact Sub-Country Visitor Entry Locations & Live Recent Entry Radar */}
      {(activeSubTab === 'all' || activeSubTab === 'places') && (
        <div className="grid lg:grid-cols-2 gap-3">
          {/* Aggregated Cities & Governorates Inside Countries */}
          <div className="rounded-2xl border border-stone-200 bg-white p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-sm font-black text-stone-900 flex items-center gap-1.5">
                <Crosshair className="w-4 h-4 text-amber-700" />
                {T('أماكن دخول الزوار داخل كل دولة (المدن والمحافظات والإحداثيات)')}
              </h4>
              <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-bold text-amber-900">
                {TP('{n} نقطة دخول', { n: formatAdminNumber(report.totals.placesCount) })}
              </span>
            </div>

            {placesList.length === 0 ? (
              <p className="text-xs text-stone-500 py-4">
                {T('لم تُسجّل نقاط دخول داخل الدول بعد — فور دخول أي زائر ستظهر مدينته ومحافظته وإحداثياته الدقيقة هنا.')}
              </p>
            ) : (
              <div className="overflow-x-auto max-h-80">
                <table className="w-full text-xs text-start border-collapse">
                  <thead>
                    <tr className="border-b border-stone-200 text-stone-500">
                      <th className="py-2 px-2 text-start">{T('المدينة / منطقة الدخول')}</th>
                      <th className="py-2 px-2 text-start">{T('الدولة')}</th>
                      <th className="py-2 px-2 text-start">{T('الإحداثيات')}</th>
                      <th className="py-2 px-2 text-start">{T('الزيارات')}</th>
                      <th className="py-2 px-2 text-start">{T('حصة الدولة')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {placesList.slice(0, 30).map((pl) => (
                      <tr
                        key={pl.id}
                        onClick={() => setSelectedCountry(pl.country)}
                        className="cursor-pointer hover:bg-amber-50/60"
                      >
                        <td className="py-2 px-2 font-bold text-stone-900">
                          📍 {isAr ? pl.cityAr : pl.cityEn}
                          {pl.regionAr && isAr ? (
                            <span className="block text-[10px] font-normal text-stone-500">{pl.regionAr}</span>
                          ) : null}
                        </td>
                        <td className="py-2 px-2 whitespace-nowrap">
                          {pl.flag} {isAr ? pl.countryAr : pl.countryEn}
                        </td>
                        <td className="py-2 px-2 font-mono text-[11px] text-stone-600" dir="ltr">
                          {pl.lat.toFixed(2)}°, {pl.lon.toFixed(2)}°
                        </td>
                        <td className="py-2 px-2 font-black text-stone-900">{formatAdminNumber(pl.visits)}</td>
                        <td className="py-2 px-2 font-bold text-amber-800">{formatAdminNumber(pl.countrySharePercent)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Live Rolling Visitor Entry Feed */}
          <div className="rounded-2xl border border-stone-200 bg-white p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-sm font-black text-stone-900 flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-emerald-700" />
                {T('رادار عمليات الدخول الأخيرة لحظة بلحظة')}
              </h4>
              <span className="text-[11px] text-emerald-700 font-bold">
                {TP('متواجد الآن: {n}', { n: formatAdminNumber(liveNow.activeVisitors) })}
              </span>
            </div>

            {report.recentEntries.length === 0 ? (
              <p className="text-xs text-stone-500 py-4">
                {T('سجل الرصد اللحظي جاهز — يعرض آخر 50 عملية دخول بمكانها الدقيق داخل الدولة والقسم الذي دخله الزائر بدون كشف هويته.')}
              </p>
            ) : (
              <ul className="divide-y divide-stone-100 max-h-80 overflow-y-auto text-xs">
                {report.recentEntries.slice(0, 25).map((entry, idx) => {
                  const secMeta = CENSUS_SECTIONS[entry.section] || CENSUS_SECTIONS.other;
                  return (
                    <li
                      key={`${entry.at}-${entry.placeId}-${idx}`}
                      className="py-2 flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <div className="font-bold text-stone-900 truncate">
                          {flagOfCountry(entry.country)}{' '}
                          {isAr ? entry.cityAr : entry.cityEn} —{' '}
                          <span className="text-stone-600">
                            {isAr ? countryNameAr(entry.country) : countryNameEn(entry.country)}
                          </span>
                        </div>
                        <div className="text-[11px] text-stone-500">
                          {isAr ? secMeta.ar : secMeta.en} ·{' '}
                          <span className="font-mono" dir="ltr">
                            [{entry.lat.toFixed(2)}°, {entry.lon.toFixed(2)}°]
                          </span>
                        </div>
                      </div>
                      <span className="text-[11px] text-stone-500 shrink-0 whitespace-nowrap">
                        {fmtTime(entry.at)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* 3. Comprehensive Executive Report for the Platform Owner */}
      {(activeSubTab === 'all' || activeSubTab === 'report') && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-stone-200 bg-stone-50/80 p-4 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <h4 className="font-bold text-sm text-stone-900 flex items-center gap-2">
                <FileText className="w-4 h-4 text-amber-700" />
                {T('التقرير التنفيذي المرفوع لصاحب المنصة')}
              </h4>
              <span className="text-[11px] text-stone-500">{fmtTime(statement.issuedAt)}</span>
            </div>
            <p className="text-xs font-bold text-amber-900 bg-amber-100/70 border border-amber-200 rounded-xl px-3 py-2">
              {isAr ? statement.headlineAr : statement.headlineEn}
            </p>
            <ul className="space-y-1.5 text-xs text-stone-700 list-disc ps-5">
              {(isAr ? statement.executiveReportAr : statement.executiveReportEn).map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          </div>

          <div className="grid md:grid-cols-3 gap-3">
            <div className="rounded-2xl border border-stone-200 bg-white p-4 space-y-2.5">
              <h5 className="font-bold text-xs text-stone-800 flex items-center gap-1.5">
                <Globe className="w-4 h-4 text-amber-700" />
                {T('توزيع الزيارات حسب أقاليم العالم')}
              </h5>
              <div className="space-y-2">
                {regionEntries.map((r) => (
                  <div key={r.id} className="space-y-1 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-stone-700 font-medium">{isAr ? r.ar : r.en}</span>
                      <span className="text-stone-900 font-bold">
                        {formatAdminNumber(r.visits)}{' '}
                        <span className="text-[10px] font-normal text-stone-500">
                          ({TP('{n} دولة', { n: formatAdminNumber(r.countries) })})
                        </span>
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-stone-100 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-l from-amber-500 to-emerald-600"
                        style={{ width: `${r.visits > 0 ? Math.max(4, (r.visits / maxRegionVisits) * 100) : 0}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-stone-200 bg-white p-4 space-y-2.5">
              <h5 className="font-bold text-xs text-stone-800 flex items-center gap-1.5">
                <Users className="w-4 h-4 text-emerald-700" />
                {T('أقسام المنصة الأكثر زيارة')}
              </h5>
              {sectionEntries.length === 0 ? (
                <p className="text-xs text-stone-400 py-4">{T('لم تُسجّل زيارات أقسام بعد.')}</p>
              ) : (
                <div className="space-y-2">
                  {sectionEntries.slice(0, 7).map(([secKey, count]) => {
                    const meta = CENSUS_SECTIONS[secKey] || CENSUS_SECTIONS.other;
                    return (
                      <div key={secKey} className="space-y-1 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-stone-700 truncate">{isAr ? meta.ar : meta.en}</span>
                          <span className="font-bold text-stone-900">{formatAdminNumber(count)}</span>
                        </div>
                        <div className="h-2 rounded-full bg-stone-100 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-l from-sky-500 to-indigo-600"
                            style={{ width: `${Math.max(4, (count / maxSectionCount) * 100)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-stone-200 bg-white p-4 space-y-3">
              <h5 className="font-bold text-xs text-stone-800 flex items-center gap-1.5">
                <Smartphone className="w-4 h-4 text-indigo-700" />
                {T('الأجهزة والنبض اليومي')}
              </h5>
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                {(
                  [
                    ['mobile', T('موبايل'), report.byDevice.mobile],
                    ['desktop', T('كمبيوتر'), report.byDevice.desktop],
                    ['tablet', T('تابلت'), report.byDevice.tablet],
                  ] as const
                ).map(([k, label, val]) => (
                  <div key={k} className="rounded-xl bg-stone-50 border border-stone-200/80 p-2">
                    <p className="font-bold text-sm text-stone-900">{formatAdminNumber(val)}</p>
                    <p className="text-[10px] text-stone-500">{label}</p>
                    <p className="text-[10px] text-amber-800 font-semibold">
                      {report.totals.visits > 0 ? `${formatAdminNumber(Math.round((val / deviceTotal) * 100))}%` : '0%'}
                    </p>
                  </div>
                ))}
              </div>

              <div className="pt-1">
                <p className="text-[11px] font-semibold text-stone-600 mb-1.5">{T('سجل الزيارات اليومية (آخر 14 يوماً)')}</p>
                {recentDays.length === 0 ? (
                  <p className="text-[11px] text-stone-400">{T('يظهر المنحنى اليومي تلقائياً مع أول زيارة مسجلة.')}</p>
                ) : (
                  <div className="flex items-end gap-1 h-20 pt-2">
                    {recentDays.map((d) => (
                      <div key={d.date} className="flex-1 flex flex-col items-center gap-1 min-w-0" title={`${d.date}: ${d.visits}`}>
                        <div className="w-full bg-stone-100 rounded-t h-14 flex items-end overflow-hidden">
                          <div
                            className="w-full bg-amber-500 rounded-t transition-all"
                            style={{ height: `${Math.max(8, (d.visits / maxDayVisits) * 100)}%` }}
                          />
                        </div>
                        <span className="text-[9px] text-stone-500 truncate w-full text-center" dir="ltr">
                          {d.date.slice(5)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. Certified Public Statement / Open Ledger */}
      {(activeSubTab === 'all' || activeSubTab === 'statement') && (
        <div className="rounded-2xl border-2 border-stone-800/15 bg-white overflow-hidden">
          <div className="p-4 bg-stone-900 text-stone-100 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-300">
                  {T('📜 الكشف العلني المعتمد لزيارات المنصة')}
                </span>
                <span className="text-[11px] font-mono bg-stone-800 text-amber-200 px-2 py-0.5 rounded" dir="ltr">
                  {statement.editionCode}
                </span>
              </div>
              <p className="text-[11px] text-stone-300 mt-1">
                {isAr ? statement.privacyGuaranteeAr : statement.privacyGuaranteeEn}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void copyStatement()}
                className="inline-flex items-center gap-1.5 rounded-xl bg-amber-400 text-stone-950 px-3 py-1.5 text-xs font-bold hover:bg-amber-300"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? T('تم نسخ الكشف العلني') : T('نسخ الكشف العلني')}
              </button>
              <button
                type="button"
                onClick={() =>
                  downloadBlob(`${statement.editionCode}.csv`, csvStatement(report), 'text/csv;charset=utf-8')
                }
                className="inline-flex items-center gap-1.5 rounded-xl bg-stone-800 border border-stone-700 text-stone-100 px-3 py-1.5 text-xs font-semibold hover:bg-stone-700"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                {T('تصدير CSV')}
              </button>
              <button
                type="button"
                onClick={() =>
                  downloadBlob(
                    `${statement.editionCode}.json`,
                    JSON.stringify({ statement, report, liveNow }, null, 2),
                    'application/json',
                  )
                }
                className="inline-flex items-center gap-1.5 rounded-xl bg-stone-800 border border-stone-700 text-stone-100 px-3 py-1.5 text-xs font-semibold hover:bg-stone-700"
              >
                <Download className="w-3.5 h-3.5 text-sky-400" />
                {T('تنزيل JSON')}
              </button>
            </div>
          </div>

          {statement.ledger.length === 0 ? (
            <div className="p-6 text-center space-y-1.5">
              <p className="text-sm font-bold text-stone-800">
                {T('الكشف العلني مفعل ونزيه — 0 زيارة دولية مسجلة حتى هذه اللحظة')}
              </p>
              <p className="text-xs text-stone-500 max-w-xl mx-auto">
                {T('بمجرد تصفح الزوار لأقسام المنصة، يُدرج كل بلد ومدن الدخول بداخله تلقائياً هنا بترتيبه وعدد زياراته ونسبته المئوية ويضيء على الخريطة الملونة أعلاه.')}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-start border-collapse">
                <thead>
                  <tr className="bg-stone-100 text-stone-600 border-b border-stone-200">
                    <th className="py-2.5 px-3 text-start font-bold">#</th>
                    <th className="py-2.5 px-3 text-start font-bold">{T('الدولة')}</th>
                    <th className="py-2.5 px-3 text-start font-bold">{T('أبرز مدينة دخول')}</th>
                    <th className="py-2.5 px-3 text-start font-bold">{T('الحرارة')}</th>
                    <th className="py-2.5 px-3 text-start font-bold">{T('إجمالي الزيارات')}</th>
                    <th className="py-2.5 px-3 text-start font-bold">{T('الزوار الفريدون')}</th>
                    <th className="py-2.5 px-3 text-start font-bold">{T('اليوم')}</th>
                    <th className="py-2.5 px-3 text-start font-bold">{T('النسبة العالمية')}</th>
                    <th className="py-2.5 px-3 text-start font-bold">{T('القسم الأعلى')}</th>
                    <th className="py-2.5 px-3 text-start font-bold">{T('آخر زيارة')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {statement.ledger.map((row) => {
                    const selected = selectedCountry === row.code;
                    const heat = HEAT_COLORS[row.heatLevel];
                    return (
                      <tr
                        key={row.code}
                        onClick={() => setSelectedCountry(selected ? null : row.code)}
                        className={`cursor-pointer transition ${selected ? 'bg-amber-50/90' : 'hover:bg-stone-50'}`}
                      >
                        <td className="py-2.5 px-3 font-bold text-stone-500">{formatAdminNumber(row.rank)}</td>
                        <td className="py-2.5 px-3 font-bold text-stone-900 whitespace-nowrap">
                          <span className="me-1.5 text-sm">{row.flag}</span>
                          {isAr ? row.nameAr : row.nameEn}{' '}
                          <span className="text-[10px] text-stone-400 font-mono" dir="ltr">({row.code})</span>
                        </td>
                        <td className="py-2.5 px-3 text-stone-700 font-semibold">
                          {row.topPlaceAr ? (
                            <span>
                              📍 {isAr ? row.topPlaceAr : row.topPlaceEn}{' '}
                              <span className="text-[10px] text-stone-400">
                                ({formatAdminNumber(row.placesCount)})
                              </span>
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold bg-stone-100 text-stone-800">
                            <span className="h-2 w-2 rounded-full inline-block" style={{ backgroundColor: heat.fill }} />
                            {isAr ? heat.ar : heat.en}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-extrabold text-stone-900">{formatAdminNumber(row.visits)}</td>
                        <td className="py-2.5 px-3 font-semibold text-emerald-800">{formatAdminNumber(row.uniqueVisitors)}</td>
                        <td className="py-2.5 px-3 font-semibold text-amber-800">{formatAdminNumber(row.todayVisits)}</td>
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-1.5">
                            <div className="w-14 h-1.5 rounded-full bg-stone-200 overflow-hidden">
                              <div className="h-full bg-amber-500 rounded-full" style={{ width: `${Math.min(100, row.sharePercent)}%` }} />
                            </div>
                            <span className="font-semibold text-stone-700">{formatAdminNumber(row.sharePercent)}%</span>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-stone-600">{isAr ? row.topSectionAr : row.topSectionEn}</td>
                        <td className="py-2.5 px-3 text-stone-500 whitespace-nowrap">{fmtTime(row.lastVisitAt)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {statement.unspecifiedVisits > 0 && (
                <p className="px-4 py-2 text-[11px] text-stone-500 bg-stone-50 border-t border-stone-200">
                  {TP('🌐 زيارات غير محددة الدولة (بدون ترويسة جغرافية): {n} زيارة.', {
                    n: formatAdminNumber(statement.unspecifiedVisits),
                  })}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
