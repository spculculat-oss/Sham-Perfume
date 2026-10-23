/**
 * «خانة التعداد والكشف العلني — هيكل دولة المنصة» (`src/admin/PlatformCensusPanel.tsx`)
 *
 * Dedicated census slot inside the Platform State structure in Administration (`#admin` & `#owner`):
 *   1. Official Census Robot status & GitHub workflow controls (`census` / `platform-census.yml`),
 *   2. Interactive World Thermal Heatmap (`WorldVisitHeatmap`),
 *   3. Comprehensive Executive Report («التقرير التنفيذي لصاحب المنصة») — regions, sections, devices, daily timeline,
 *   4. Certified Open Statement & Country Ledger («الكشف العلني المعتمد») with copy, CSV, and JSON export.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Check, Copy, Download, ExternalLink, FileSpreadsheet, FileText, Flame, Globe, RefreshCw, ShieldCheck, Smartphone, Users,
} from 'lucide-react';
import bundledCensus from '../data/live/platform-census.json';
import { OWNER } from '../utils/ownerAuthority';
import { apiUrl, isStaticHosting } from '../utils/api';
import { T, TP, adminLocale, formatAdminNumber, getAdminLang, useAdminLanguage } from './adminL10n';
import WorldVisitHeatmap from './WorldVisitHeatmap';
import {
  CENSUS_BOT,
  CENSUS_SECTIONS,
  HEAT_COLORS,
  WORLD_REGIONS,
  buildPublicStatement,
  csvStatement,
  mergeCensusReports,
  plainTextStatement,
  readCensusReport,
  type CensusReport,
  type WorldRegionId,
} from '../utils/platformCensus';

const RAW_MAIN_CENSUS = `https://raw.githubusercontent.com/${OWNER.repo}/main/src/data/live/${CENSUS_BOT.reportFile}`;
const WORKFLOW_URL = `https://github.com/${OWNER.repo}/actions/workflows/${CENSUS_BOT.workflowFile}`;

export async function loadLiveCensusSnapshot(): Promise<{ report: CensusReport; liveServerConnected: boolean; storageKind?: string }> {
  const now = new Date();
  let merged = readCensusReport(bundledCensus, now);
  let liveServerConnected = false;
  let storageKind: string | undefined;

  const tasks: Promise<void>[] = [];

  // 1. Latest committed report on main (works even on pure static GitHub Pages)
  tasks.push(
    fetch(`${RAW_MAIN_CENSUS}?t=${Date.now()}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((raw) => {
        if (raw) merged = mergeCensusReports(merged, readCensusReport(raw, now), now);
      })
      .catch(() => {}),
  );

  // 2. Live API server (`/api/census/public`), when an API backend is reachable
  const publicEndpoint = apiUrl('/api/census/public');
  const skipLocalStatic = isStaticHosting && publicEndpoint.startsWith('/');
  if (!skipLocalStatic) {
    tasks.push(
      fetch(publicEndpoint, { cache: 'no-store', credentials: 'omit' })
        .then((r) => (r.ok ? r.json() : null))
        .then((data: { ok?: boolean; report?: unknown; storage?: { kind?: string } } | null) => {
          if (data?.report) {
            merged = mergeCensusReports(merged, readCensusReport(data.report, now), now);
            liveServerConnected = true;
            storageKind = data.storage?.kind;
          }
        })
        .catch(() => {}),
    );
  }

  await Promise.all(tasks);
  return { report: merged, liveServerConnected, storageKind };
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
  const [liveConnected, setLiveConnected] = useState(false);
  const [storageKind, setStorageKind] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<'all' | 'heatmap' | 'report' | 'statement'>('all');

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const snap = await loadLiveCensusSnapshot();
      setReport(snap.report);
      setLiveConnected(snap.liveServerConnected);
      setStorageKind(snap.storageKind);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const statement = useMemo(() => buildPublicStatement(report), [report]);

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
    () => (Object.keys(WORLD_REGIONS) as WorldRegionId[])
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
      ? new Date(iso).toLocaleString(adminLocale(), { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Cairo' })
      : '—';

  return (
    <section
      id="state-census-slot"
      className={`rounded-2xl border ${embedded ? 'border-amber-300/80 bg-gradient-to-b from-amber-50/40 via-white to-white p-4 sm:p-5' : 'border-stone-200 bg-white p-4 sm:p-6'} shadow-sm space-y-5`}
    >
      {/* Header: Census Slot in Platform State Structure */}
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
            {T('روبوت التعداد وإحصاء الزيارات — التقرير التنفيذي والكشف العلني وخريطة العالم الحرارية')}
          </h3>
          <p className="text-xs text-stone-600">
            {T('روبوت رسمي تحت سلطة «دولة المنصة» يحصي الزيارات الحقيقية والزوار الفريدين حول العالم ويقدم تقريراً وكشفاً علنياً نزيهاً لصاحب المنصة بدون أي بيانات شخصية أو أرقام وهمية.')}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void refresh()}
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

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3">
          <p className="text-[11px] text-amber-900 font-semibold">{T('إجمالي الزيارات')}</p>
          <p className="text-2xl font-extrabold text-stone-900 mt-1">{formatAdminNumber(report.totals.visits)}</p>
          <p className="text-[10px] text-stone-500 mt-0.5">{T('زيارة حقيقية موثقة')}</p>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3">
          <p className="text-[11px] text-emerald-900 font-semibold">{T('الزوار الفريدون')}</p>
          <p className="text-2xl font-extrabold text-emerald-900 mt-1">{formatAdminNumber(report.totals.uniqueVisitors)}</p>
          <p className="text-[10px] text-stone-500 mt-0.5">{T('بدون حفظ عناوين IP')}</p>
        </div>
        <div className="rounded-xl border border-sky-200 bg-sky-50/70 p-3">
          <p className="text-[11px] text-sky-900 font-semibold">{T('زيارات اليوم')}</p>
          <p className="text-2xl font-extrabold text-sky-950 mt-1">{formatAdminNumber(report.totals.todayVisits)}</p>
          <p className="text-[10px] text-stone-500 mt-0.5">
            {TP('{n} زائر فريد اليوم', { n: formatAdminNumber(report.totals.todayUnique) })}
          </p>
        </div>
        <div className="rounded-xl border border-stone-200 bg-stone-50 p-3">
          <p className="text-[11px] text-stone-600 font-semibold">{T('آخر 7 أيام')}</p>
          <p className="text-2xl font-extrabold text-stone-900 mt-1">{formatAdminNumber(report.totals.last7DaysVisits)}</p>
          <p className="text-[10px] text-stone-500 mt-0.5">
            {TP('آخر 30 يوماً: {n}', { n: formatAdminNumber(report.totals.last30DaysVisits) })}
          </p>
        </div>
        <div className="rounded-xl border border-indigo-200 bg-indigo-50/60 p-3">
          <p className="text-[11px] text-indigo-900 font-semibold">{T('دول العالم النشطة')}</p>
          <p className="text-2xl font-extrabold text-indigo-950 mt-1">{formatAdminNumber(report.totals.countriesCount)}</p>
          <p className="text-[10px] text-stone-500 mt-0.5">{T('دولة مسجلة بالخريطة')}</p>
        </div>
        <div className="rounded-xl border border-purple-200 bg-purple-50/60 p-3">
          <p className="text-[11px] text-purple-900 font-semibold">{T('الأقاليم القارية')}</p>
          <p className="text-2xl font-extrabold text-purple-950 mt-1">
            {formatAdminNumber(report.totals.regionsCount)} <span className="text-xs font-normal text-stone-500">/ {formatAdminNumber(6)}</span>
          </p>
          <p className="text-[10px] text-stone-500 mt-0.5">{T('آخر تحديث:')} {fmtTime(report.updatedAt)}</p>
        </div>
      </div>

      {/* View Switcher Pills */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-stone-200 pb-2.5 text-xs">
        {([
          ['all', T('العرض الكامل (الخريطة + التقرير + الكشف العلني)')],
          ['heatmap', T('🌍 الخريطة الحرارية التفاعلية')],
          ['report', T('📊 التقرير التنفيذي لصاحب المنصة')],
          ['statement', T('📜 الكشف العلني المعتمد')],
        ] as const).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveSubTab(id)}
            className={`rounded-xl px-3 py-1.5 font-semibold transition ${
              activeSubTab === id
                ? 'bg-stone-900 text-amber-200'
                : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* 1. Interactive World Thermal Heatmap */}
      {(activeSubTab === 'all' || activeSubTab === 'heatmap') && (
        <WorldVisitHeatmap
          report={report}
          selectedCountry={selectedCountry}
          onSelectCountry={setSelectedCountry}
        />
      )}

      {/* 2. Comprehensive Executive Report for the Platform Owner */}
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

          {/* Breakdown Grid: Regions + Sections + Devices & Daily Timeline */}
          <div className="grid md:grid-cols-3 gap-3">
            {/* World Regions */}
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

            {/* Top Visited Sections */}
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

            {/* Devices & 14-day Daily Trend */}
            <div className="rounded-2xl border border-stone-200 bg-white p-4 space-y-3">
              <h5 className="font-bold text-xs text-stone-800 flex items-center gap-1.5">
                <Smartphone className="w-4 h-4 text-indigo-700" />
                {T('الأجهزة والنبض اليومي')}
              </h5>
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                {([
                  ['mobile', T('موبايل'), report.byDevice.mobile],
                  ['desktop', T('كمبيوتر'), report.byDevice.desktop],
                  ['tablet', T('تابلت'), report.byDevice.tablet],
                ] as const).map(([k, label, val]) => (
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

      {/* 3. Certified Public Statement / Open Ledger («الكشف العلني المعتمد لصاحب المنصة») */}
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
                onClick={() => downloadBlob(`${statement.editionCode}.csv`, csvStatement(report), 'text/csv;charset=utf-8')}
                className="inline-flex items-center gap-1.5 rounded-xl bg-stone-800 border border-stone-700 text-stone-100 px-3 py-1.5 text-xs font-semibold hover:bg-stone-700"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                {T('تصدير CSV')}
              </button>
              <button
                type="button"
                onClick={() => downloadBlob(`${statement.editionCode}.json`, JSON.stringify({ statement, report }, null, 2), 'application/json')}
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
                {T('بمجرد تصفح الزوار لأقسام المنصة، يُدرج كل بلد تلقائياً هنا بترتيبه وعدد زياراته ونسبته المئوية ويضيء على الخريطة الحرارية أعلاه.')}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-start border-collapse">
                <thead>
                  <tr className="bg-stone-100 text-stone-600 border-b border-stone-200">
                    <th className="py-2.5 px-3 text-start font-bold">#</th>
                    <th className="py-2.5 px-3 text-start font-bold">{T('الدولة')}</th>
                    <th className="py-2.5 px-3 text-start font-bold">{T('الإقليم')}</th>
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
                        <td className="py-2.5 px-3 text-stone-600">{isAr ? row.regionAr : row.regionEn}</td>
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
                  {TP('🌐 زيارات غير محددة الدولة (بدون ترويسة جغرافية): {n} زيارة.', { n: formatAdminNumber(statement.unspecifiedVisits) })}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
