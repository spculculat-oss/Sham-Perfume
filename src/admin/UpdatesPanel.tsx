import { T } from './adminL10n';
import React, { useCallback, useMemo, useState } from 'react';
import { CheckCircle2, CircleAlert, Clock3, Download, EyeOff, FileJson, History, PackageCheck, RotateCcw, Trash2 } from 'lucide-react';
import {
  analyzePackage, cancelDevelopment, listAppliedUpdates, listCanceledDevelopments,
  listInstalledDevelopments, parseDevelopmentPackage, receiveDevelopment, restoreDevelopment,
} from '../updates/updateGateway';
import type { ItemDecision, UpdateReport } from '../updates/types';

/**
 * بيئة استقبال التحديثات — الواجهة الإدارية لبوابة التحديثات.
 * أي تطوير قادم من منصة أخرى يُلصق هنا كحزمة JSON، فتحلله البوابة
 * وتقارنه بالموجود وتطبّق الزيادة فقط، مع بقاء الملغي ملغياً وحماية
 * بيانات المستخدمين. كل الحسابات تجري في المتصفح عبر src/updates/updateGateway.ts.
 */

const card = 'rounded-2xl border border-stone-200 bg-white p-4 shadow-sm';
const input = 'w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400';
const btn = 'inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold disabled:opacity-50';

const SAMPLE_PACKAGE = JSON.stringify({
  schemaVersion: 1,
  packageId: 'sample-packaging-cost-2026-10',
  platform: 'manual',
  noteAr: T('مثال: أداة جديدة وترقية بيانات تابعة لها'),
  items: [
    {
      id: 'tool.packaging-cost',
      kind: 'tool',
      version: 1,
      titleAr: T('حاسبة تكلفة التغليف'),
      titleEn: 'Packaging Cost Calculator',
      payload: {
        route: '#packaging-cost',
        descriptionAr: T('تحسب تكلفة الزجاجة والغطاء والكرتونة والملصق لكل وحدة إنتاج'),
        inputs: ['bottleCost', 'capCost', 'cartonCost', 'labelCost', 'unitsPerCarton'],
      },
    },
    {
      id: 'data.bottle-presets',
      kind: 'data',
      version: 2,
      titleAr: T('أحجام العبوات — تحديث'),
      titleEn: 'Bottle size presets — update',
      requires: ['tool.packaging-cost'],
      payload: { sizesMl: [10, 15, 30, 50, 100, 200] },
    },
  ],
}, null, 2);

const DECISION: Record<ItemDecision, { label: string; cls: string }> = {
  applied: { label: T('ثُبّتت — زيادة جديدة'), cls: 'bg-emerald-100 text-emerald-800' },
  updated: { label: T('ترقية فعلية'), cls: 'bg-sky-100 text-sky-800' },
  unchanged: { label: T('موجود بنفس المحتوى'), cls: 'bg-stone-100 text-stone-600' },
  stale: { label: T('أقدم من المثبت'), cls: 'bg-stone-100 text-stone-500' },
  canceled: { label: T('ملغى — رُفض مجدداً'), cls: 'bg-red-100 text-red-800' },
  rejected: { label: T('مرفوض'), cls: 'bg-red-100 text-red-700' },
  deferred: { label: T('مؤجل — تبعية ناقصة'), cls: 'bg-amber-100 text-amber-800' },
};

const KIND_LABEL: Record<string, string> = { tool: T('أداة'), feature: T('ميزة'), data: T('بيانات'), content: T('محتوى'), config: T('إعداد') };

const fmtDate = (iso?: string) => (iso ? new Date(iso).toLocaleString('ar-EG', { dateStyle: 'short', timeStyle: 'short' }) : '');

type Section = 'installed' | 'canceled' | 'ledger';

export default function UpdatesPanel() {
  const [raw, setRaw] = useState('');
  const [report, setReport] = useState<UpdateReport | null>(null);
  const [error, setError] = useState('');
  const [section, setSection] = useState<Section>('installed');
  const [tick, setTick] = useState(0);

  const installed = useMemo(() => listInstalledDevelopments(), [tick]);
  const canceled = useMemo(() => listCanceledDevelopments(), [tick]);
  const ledger = useMemo(() => listAppliedUpdates(), [tick]);

  const run = useCallback((mode: 'analyze' | 'receive') => {
    setError('');
    const trimmed = raw.trim();
    if (!trimmed) {
      setError(T('الصق حزمة التطوير (JSON) أولاً.'));
      setReport(null);
      return;
    }
    const parsed = parseDevelopmentPackage(trimmed);
    if (!parsed.ok) {
      setError(parsed.errorAr);
      setReport(null);
      return;
    }
    const result = mode === 'analyze' ? analyzePackage(parsed.pkg) : receiveDevelopment(parsed.pkg);
    setReport(result);
    setTick((n) => n + 1);
  }, [raw]);

  const onCancel = useCallback((id: string, title?: string) => {
    const reason = window.prompt(`إلغاء «${title ?? id}» نهائياً؟ اكتب السبب (اختياري):`, '');
    if (reason === null) return;
    cancelDevelopment(id, reason.trim() || T('إلغاء إداري من بيئة التحديثات'), 'Admin cancel from the updates environment');
    setTick((n) => n + 1);
  }, []);

  const onRestore = useCallback((id: string) => {
    restoreDevelopment(id);
    setTick((n) => n + 1);
  }, []);

  return (
    <div className="space-y-4">
      <Header
        title={T('بيئة استقبال التحديثات')}
        subtitle={T('أول ما يستقبل أي تطوير قادم من أي منصة: تحليل، مقارنة بالموجود، تطبيق الزيادة فقط، وإبقاء الملغي ملغياً — دون لمس بيانات المستخدمين.')}
      />

      <div className={card}>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <h2 className="font-bold text-sm flex items-center gap-1.5"><Download className="w-4 h-4" />{T('استقبال حزمة تطوير (JSON)')}</h2>
          <div className="flex gap-2">
            <button type="button" className="text-xs text-stone-500 hover:underline" onClick={() => { setRaw(SAMPLE_PACKAGE); setError(''); setReport(null); }}>{T('إدراج مثال جاهز')}</button>
          </div>
        </div>
        <textarea
          dir="ltr"
          rows={8}
          spellCheck={false}
          className={`${input} font-mono text-xs leading-5`}
          placeholder='{ "schemaVersion": 1, "packageId": "...", "platform": "...", "items": [ ... ] }'
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
        />
        {error && <p role="alert" className="text-xs text-red-700 mt-2 flex items-center gap-1"><CircleAlert className="w-3.5 h-3.5" />{error}</p>}
        <div className="flex flex-wrap gap-2 mt-3">
          <button type="button" className={`${btn} bg-white border border-stone-300`} onClick={() => run('analyze')}>
            <FileJson className="w-4 h-4" />تحليل فقط (دون تطبيق)
          </button>
          <button type="button" className={`${btn} bg-stone-900 text-amber-100`} onClick={() => run('receive')}>
            <PackageCheck className="w-4 h-4" />استقبال وتطبيق الزيادة
          </button>
        </div>
        <details className="mt-3 text-xs text-stone-500">
          <summary className="cursor-pointer hover:text-stone-700">{T('صيغة الحزمة المتوقعة')}</summary>
          <ul className="list-disc ps-5 mt-2 space-y-1">
            <li>{T('حقل packageId معرّف فريد للحزمة عند المنصة المصدر، وحقل platform اسم المنصة.')}</li>
            <li>{T('كل عنصر: id ثابت، وkind (tool/feature/data/content/config)، وversion تصاعدي، وعنوانان، وpayload بيانات تصريحية.')}</li>
            <li>{T('لا يُثبَّت إلا الجديد فعلاً أو الأحدث فعلاً؛ نفس المحتوى يُتجاهل، والأقدم يُتجاهل.')}</li>
            <li>{T('أي عنصر أُلغي سابقاً يُرفض تلقائياً مهما عاد، وأي حمولة تشير لتخزين المستخدمين تُرفض.')}</li>
          </ul>
        </details>
      </div>

      {report && <ReportCard report={report} />}

      <div className={card}>
        <div className="flex flex-wrap gap-1 mb-3 border-b border-stone-100 pb-2">
          {([
            ['installed', `المثبتات (${installed.length})`],
            ['canceled', `الملغيات (${canceled.length})`],
            ['ledger', `سجل التحديثات (${ledger.length})`],
          ] as Array<[Section, string]>).map(([id, label]) => (
            <button key={id} type="button" onClick={() => setSection(id)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${section === id ? 'bg-amber-500 text-stone-950' : 'hover:bg-stone-100 text-stone-600'}`}>
              {label}
            </button>
          ))}
        </div>

        {section === 'installed' && (
          installed.length === 0 ? <Empty text={T('لا توجد تطويرات مثبتة بعد. استقبل حزمة أولاً.')} /> : (
            <div className="space-y-2">
              {installed.map((item) => (
                <div key={item.id} className="rounded-xl border border-stone-200 p-3 flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-sm">{item.titleAr}</span>
                      <span className="text-[10px] rounded-full bg-stone-100 px-2 py-0.5">{KIND_LABEL[item.kind] ?? item.kind}</span>
                      <span className="text-[10px] rounded-full bg-stone-100 px-2 py-0.5" dir="ltr">v{item.version}</span>
                      <span className="text-[10px] text-stone-400" dir="ltr">{item.id}</span>
                    </div>
                    <p className="text-[11px] text-stone-500 mt-1">
                      من {item.fromPlatform} · حزمة <span dir="ltr">{item.fromPackageId}</span> · {fmtDate(item.appliedAt)}
                    </p>
                    <details className="mt-1">
                      <summary className="text-[11px] text-stone-500 cursor-pointer hover:text-stone-700">{T('الحمولة')}</summary>
                      <pre dir="ltr" className="text-[10px] bg-stone-50 rounded-lg p-2 mt-1 overflow-x-auto">{JSON.stringify(item.payload, null, 2)}</pre>
                    </details>
                  </div>
                  <button type="button" onClick={() => onCancel(item.id, item.titleAr)}
                    className={`${btn} text-xs bg-red-50 text-red-700 border border-red-200 hover:bg-red-100`}>
                    <Trash2 className="w-3.5 h-3.5" />إلغاء نهائي
                  </button>
                </div>
              ))}
            </div>
          )
        )}

        {section === 'canceled' && (
          canceled.length === 0 ? <Empty text={T('لا توجد تطويرات ملغاة. ما تلغيه هنا لا يعود من أي منصة.')} /> : (
            <div className="space-y-2">
              {canceled.map((entry) => (
                <div key={entry.id} className="rounded-xl border border-red-200 bg-red-50/50 p-3 flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-sm">{entry.titleAr ?? entry.id}</span>
                      <span className="text-[10px] text-stone-400" dir="ltr">{entry.id}</span>
                      <span className="text-[10px] rounded-full bg-red-100 text-red-700 px-2 py-0.5 flex items-center gap-1">
                        <EyeOff className="w-3 h-3" />ملغى
                      </span>
                    </div>
                    <p className="text-[11px] text-stone-600 mt-1">{entry.reasonAr ?? 'بدون سبب مسجل'}</p>
                    <p className="text-[11px] text-stone-500">
                      أُلغي {fmtDate(entry.canceledAt)}
                      {entry.rejectedAttempts > 0 && <> · رفضنا عودته {entry.rejectedAttempts} مرة{entry.lastAttemptAt ? ` (آخرها ${fmtDate(entry.lastAttemptAt)})` : ''}</>}
                    </p>
                  </div>
                  <button type="button" onClick={() => onRestore(entry.id)}
                    className={`${btn} text-xs bg-white border border-stone-300 hover:bg-stone-50`}>
                    <RotateCcw className="w-3.5 h-3.5" />استعادة
                  </button>
                </div>
              ))}
            </div>
          )
        )}

        {section === 'ledger' && (
          ledger.length === 0 ? <Empty text={T('لم تُستقبل أي حزمة بعد.')} /> : (
            <div className="space-y-2">
              {ledger.map((entry) => (
                <div key={`${entry.packageId}-${entry.receivedAt}`} className="rounded-xl border border-stone-200 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <History className="w-3.5 h-3.5 text-stone-400" />
                    <span className="font-mono text-xs" dir="ltr">{entry.packageId}</span>
                    <span className="text-[10px] rounded-full bg-stone-100 px-2 py-0.5">{entry.platform}</span>
                    {entry.revision && <span className="text-[10px] rounded-full bg-amber-100 text-amber-800 px-2 py-0.5">{T('نسخة منقحة')}</span>}
                    <span className="text-[11px] text-stone-400 ms-auto">{fmtDate(entry.receivedAt)}</span>
                  </div>
                  <p className="text-[11px] text-stone-600 mt-1">
                    {entry.counts.applied > 0 && <Badge cls={DECISION.applied.cls}>{entry.counts.applied} ثُبّتت</Badge>}
                    {entry.counts.updated > 0 && <Badge cls={DECISION.updated.cls}>{entry.counts.updated} ترقية</Badge>}
                    {entry.counts.unchanged > 0 && <Badge cls={DECISION.unchanged.cls}>{entry.counts.unchanged} بدون تغيير</Badge>}
                    {entry.counts.stale > 0 && <Badge cls={DECISION.stale.cls}>{entry.counts.stale} أقدم</Badge>}
                    {entry.counts.canceled > 0 && <Badge cls={DECISION.canceled.cls}>{entry.counts.canceled} ملغى</Badge>}
                    {entry.counts.rejected > 0 && <Badge cls={DECISION.rejected.cls}>{entry.counts.rejected} مرفوض</Badge>}
                    {entry.counts.deferred > 0 && <Badge cls={DECISION.deferred.cls}>{entry.counts.deferred} مؤجل</Badge>}
                    {Object.values(entry.counts).every((n) => n === 0) && <span className="text-stone-400">{T('لا عناصر')}</span>}
                  </p>
                </div>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
}

function Badge({ cls, children }: { cls: string; children: React.ReactNode }) {
  return <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] me-1 mb-1 ${cls}`}>{children}</span>;
}

function Empty({ text }: { text: string }) {
  return <p className="text-xs text-stone-400 py-6 text-center">{text}</p>;
}

function ReportCard({ report }: { report: UpdateReport }) {
  return (
    <div className={`${card} ${report.ok ? '' : 'border-red-300 bg-red-50'}`}>
      <div className="flex flex-wrap items-center gap-2 mb-2">
        {report.ok ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <CircleAlert className="w-4 h-4 text-red-600" />}
        <h2 className="font-bold text-sm">
          {report.duplicate ? T('حزمة مستقبلة من قبل بنفس المحتوى — لا جديد') : report.dryRun ? T('نتيجة التحليل (لم يُكتب شيء)') : T('تقرير الاستقبال')}
        </h2>
        <span className="text-[10px] rounded-full bg-stone-100 px-2 py-0.5" dir="ltr">{report.platform}</span>
        <span className="font-mono text-[10px] text-stone-400" dir="ltr">{report.packageId}</span>
      </div>

      {!report.ok && <p className="text-xs text-red-700">{report.errorAr}</p>}

      {report.ok && report.items.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr className="text-stone-500 border-b border-stone-100">
              <th className="text-start py-1.5">{T('العنصر')}</th><th className="text-start">{T('القرار')}</th><th className="text-start">{T('التفاصيل')}</th>
            </tr></thead>
            <tbody>
              {report.items.map((item) => (
                <tr key={item.id} className="border-b border-stone-50 align-top">
                  <td className="py-1.5 pe-2">
                    <span className="font-semibold">{item.titleAr}</span>
                    <span className="block text-[10px] text-stone-400" dir="ltr">{item.id}</span>
                    {item.previousVersion !== undefined && item.appliedVersion !== undefined && (
                      <span className="text-[10px] text-stone-400" dir="ltr">v{item.previousVersion} → v{item.appliedVersion}</span>
                    )}
                  </td>
                  <td className="pe-2"><span className={`inline-block rounded-full px-2 py-0.5 text-[10px] whitespace-nowrap ${DECISION[item.decision].cls}`}>{DECISION[item.decision].label}</span></td>
                  <td className="text-stone-600">{item.reasonAr}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-[11px] text-stone-500">
        {report.userDataPreserved
          ? <span className="flex items-center gap-1 text-emerald-700"><CheckCircle2 className="w-3.5 h-3.5" />{T('بيانات المستخدمين لم تُلمس')}</span>
          : <span className="flex items-center gap-1 text-red-700"><CircleAlert className="w-3.5 h-3.5" />{T('رُدّت بيانات المستخدمين بعد محاولة لمسها')}</span>}
        {report.dryRun && <span className="flex items-center gap-1"><Clock3 className="w-3.5 h-3.5" />{T('تحليل مسبق فقط')}</span>}
      </div>
      {report.userDataNotesAr.map((note, i) => <p key={i} className="text-[11px] text-stone-500 mt-1">{note}</p>)}
    </div>
  );
}

function Header({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 mb-2">
      <div><h1 className="text-xl font-bold">{title}</h1>{subtitle && <p className="text-xs text-stone-500 mt-1 max-w-3xl">{subtitle}</p>}</div>
    </div>
  );
}
