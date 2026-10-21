import { T, TP, adminLocale } from './adminL10n';
import { useCallback, useEffect, useState } from 'react';
import { BookOpenCheck, ExternalLink, Globe2, GraduationCap, RefreshCw, ShieldCheck, Wrench } from 'lucide-react';
import bundledSources from '../data/live/import-sources.json';
import bundledSchool from '../data/live/shaheen-school.json';
import bundledSkills from '../data/live/shaheen-skills.json';
import type { LiveSource, SourcesFile, SourceStatus } from '../../scripts/shaheen-discover/discover';
import type { SchoolFile } from '../../scripts/shaheen-school/school';
import { TRUST_MIN, type Region, type TrustId, type TrustProfile } from '../../scripts/shaheen-discover/trust';
import type { SkillsFile } from '../../scripts/shaheen-import/skills';

/**
 * «نمو شاهين» in the Shaheen tab: the stores «كشّاف المصادر» found and approved for the importer, the store
 * layouts Shaheen learned to read without AI, and «مدرسة شاهين» — how much he answers by himself.
 * Public data from the repository (src/data/live/*.json, refreshed by .github/workflows/shaheen-discover.yml
 * and shaheen-import.yml), so it shows on GitHub Pages and Vercel alike.
 */
const RAW = 'https://raw.githubusercontent.com/spculculat-oss/Sham-Perfume/main/src/data/live/';
const RUNS_URL = 'https://github.com/spculculat-oss/Sham-Perfume/actions/workflows/shaheen-discover.yml';
const card = 'rounded-2xl border border-stone-200 bg-white p-4 shadow-sm';
const when = (iso?: string) => (iso && Date.parse(iso) > 0 ? new Date(iso).toLocaleString(adminLocale(), { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Cairo' }) : '—');

const STATUS: Record<SourceStatus, { label: () => string; cls: string }> = {
  active: { label: () => T('بيتنقل منه'), cls: 'bg-emerald-100 text-emerald-800' },
  candidate: { label: () => T('في انتظار الفحص'), cls: 'bg-sky-100 text-sky-800' },
  paused: { label: () => T('موقوف مؤقتاً'), cls: 'bg-amber-100 text-amber-800' },
  rejected: { label: () => T('مرفوض'), cls: 'bg-stone-100 text-stone-600' },
  blocked: { label: () => T('ممنوع'), cls: 'bg-red-100 text-red-800' },
};
const FOUND_BY: Record<string, () => string> = {
  'shaheen-search': () => T('بحث شاهين على الويب'),
  'search-api': () => T('خدمة بحث'),
  'brand-site': () => T('المتجر الرسمي لماركة'),
  'known-store': () => T('متجر عطور معروف'),
  seed: () => T('أضفته أنت'),
  council: () => T('اقترحه اجتماع شاهين اليومي'),
  'built-in': () => T('المورد الأصلي'),
};

const REGION: Record<Region, () => string> = {
  arab: () => T('الخليج والعالم العربي'),
  europe: () => T('أوروبا'),
  americas: () => T('الأمريكتان'),
  'east-asia': () => T('شرق آسيا'),
  'central-asia': () => T('وسط آسيا'),
  'south-asia': () => T('جنوب آسيا'),
  oceania: () => T('أستراليا ونيوزيلندا'),
  africa: () => T('أفريقيا'),
  global: () => T('عالمي'),
};
const CHECK: Record<TrustId, () => string> = {
  age: () => T('عمر النطاق'),
  https: () => T('اتصال آمن (https)'),
  contact: () => T('بيانات التواصل'),
  identity: () => T('هوية الشركة (سجل/رقم ضريبي/عنوان)'),
  returns: () => T('سياسة الإرجاع والاسترداد'),
  shipping: () => T('سياسة الشحن'),
  privacy: () => T('سياسة الخصوصية'),
  terms: () => T('الشروط والأحكام'),
  payment: () => T('وسائل دفع معروفة'),
  platform: () => T('منصة متاجر معروفة'),
  social: () => T('حسابات رسمية على التواصل'),
  authentic: () => T('يضمن أن المنتجات أصلية'),
};
const trustTone = (t: TrustProfile) => (t.verdict === 'rejected' ? 'bg-red-100 text-red-800' : t.score >= 80 ? 'bg-emerald-100 text-emerald-800' : t.score >= TRUST_MIN ? 'bg-lime-100 text-lime-800' : 'bg-amber-100 text-amber-800');

/** The store's «CV»: score, every check (✓ found, ✗ missing, ? could not be checked) and red flags. */
function TrustCv({ t }: { t: TrustProfile }) {
  return (
    <details className="w-full">
      <summary className="cursor-pointer text-[11px] text-stone-500">
        <span className={`me-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${trustTone(t)}`}>{TP('الثقة {n}/100', { n: t.score })}</span>
        {T('السيرة الذاتية للمتجر')}
        {t.vouched && <span className="ms-1 rounded-full bg-violet-100 px-1.5 py-0.5 text-[10px] font-bold text-violet-800">{T('أنت ضامنه')}</span>}
      </summary>
      <div className="mt-1 rounded-lg bg-stone-50 p-2">
        {t.flags.length > 0 && (
          <ul className="mb-1 space-y-0.5 text-[11px] font-bold text-red-700">{t.flags.map((f) => <li key={f}>⚑ {T(f)}</li>)}</ul>
        )}
        <ul className="grid gap-x-3 gap-y-0.5 text-[11px] sm:grid-cols-2">
          {t.checks.map((c) => (
            <li key={c.id} className="flex items-baseline gap-1">
              <span className={c.ok ? 'text-emerald-600' : c.ok === false ? 'text-red-500' : 'text-stone-400'}>{c.ok ? '✓' : c.ok === false ? '✗' : '?'}</span>
              <span>{(CHECK[c.id] || (() => c.label))()}</span>
              <span className="text-stone-400">{c.points}/{c.max}</span>
              {c.detail && <span className="truncate text-stone-500" dir="auto">— {T(c.detail)}</span>}
            </li>
          ))}
        </ul>
        <p className="mt-1 text-[10px] text-stone-400">{T('آخر قراءة')}: {when(t.at)}{t.registeredAt ? ` · ${T('مسجّل منذ')} ${when(t.registeredAt)}` : ''}</p>
      </div>
    </details>
  );
}

/** Fetches the newest copy of a live file; keeps the bundled one when the network copy is not newer. */
function useLive<D extends { updatedAt: string }>(name: string, bundled: D, valid: (d: unknown) => boolean) {
  const [data, setData] = useState<D>(bundled);
  const [loading, setLoading] = useState(false);
  const load = useCallback(() => {
    setLoading(true);
    fetch(`${RAW}${name}?t=${Date.now()}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : undefined))
      .then((d: D | undefined) => { if (d && valid(d) && Date.parse(d.updatedAt) >= Date.parse(bundled.updatedAt)) setData(d); })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, [name, bundled, valid]);
  useEffect(load, [load]);
  return [data, loading, load] as const;
}
const isSources = (d: unknown) => Array.isArray((d as SourcesFile)?.sources);
const isSchool = (d: unknown) => Array.isArray((d as SchoolFile)?.history);
const isSkills = (d: unknown) => typeof (d as SkillsFile)?.sites === 'object';

function Meter({ value, tone }: { value: number; tone: string }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-stone-100">
      <div className={`h-full rounded-full ${tone}`} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

export default function ShaheenGrowthPanel() {
  const [sources, l1, load1] = useLive<SourcesFile>('import-sources.json', bundledSources as SourcesFile, isSources);
  const [school, l2, load2] = useLive<SchoolFile>('shaheen-school.json', bundledSchool as unknown as SchoolFile, isSchool);
  const [skills, l3, load3] = useLive<SkillsFile>('shaheen-skills.json', bundledSkills as SkillsFile, isSkills);
  const loading = l1 || l2 || l3;
  const reload = () => { load1(); load2(); load3(); };

  const by = (s: SourceStatus) => sources.sources.filter((x) => x.status === s);
  const active = by('active');
  const lastRun = sources.runs[0];
  const skillList = Object.values(skills.sites);
  const trusted = skillList.filter((s) => s.status === 'trusted').length;
  const r = school.reliance;
  const recent = [...school.history].slice(0, 12).reverse();

  return (
    <div className={`${card} mb-4`}>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-sm font-bold"><GraduationCap className="h-4 w-4 text-amber-600" />{T('نمو شاهين — مصادر جديدة وتعلّم ذاتي')}</h2>
        <div className="flex items-center gap-2">
          <a href={RUNS_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-stone-500 hover:underline">{T('سجل التشغيل')}<ExternalLink className="h-3 w-3" /></a>
          <button type="button" onClick={reload} disabled={loading} className="inline-flex items-center gap-1 rounded-lg border border-stone-200 px-2 py-1 text-xs hover:bg-stone-50 disabled:opacity-50 cursor-pointer">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />{T('تحديث')}
          </button>
        </div>
      </div>
      <p className="mb-4 text-xs leading-relaxed text-stone-600">
        {T('كل 6 ساعات شاهين بيدوّر على متاجر عطور جديدة على الإنترنت، يفحص كل متجر بأدب (بيحترم قواعد الموقع وسرعته، ومش بيقرب من الأسواق الكبيرة ولا السوشيال)، ولو صفحات منتجاته واضحة وعطور فعلاً بيضيفه لمستورد شاهين اللي بينقل منتجاته بنفس الطريقة: السعر + 50%، تنظيف الصور، وصف عربي، مراجعة كل صفحة. وفي نفس الوقت بيمتحن نفسه ويذاكر عشان يرد لوحده لو أي خدمة ذكاء اصطناعي وقفت.')}
      </p>
      <p className="-mt-2 mb-4 flex gap-1.5 text-xs leading-relaxed text-stone-600">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
        <span>{TP('بيدوّر في العالم كله (الخليج، أوروبا، أمريكا، شرق ووسط آسيا) بلغة كل بلد، وقبل ما يدخل أي متجر بيراجع سيرته الذاتية: عمر الموقع، بيانات الشركة والتواصل، سياسة الإرجاع والشحن، وسائل الدفع، وإنه بيبيع أصلي مش تقليد. أقل من {min}/100 أو أي علامة خطر = مرفوض.', { min: TRUST_MIN })}</span>
      </p>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* «كشّاف المصادر» */}
        <section className="rounded-xl border border-stone-100 p-3 lg:col-span-2">
          <h3 className="mb-2 flex items-center gap-1.5 text-xs font-bold text-stone-700"><Globe2 className="h-4 w-4 text-emerald-600" />{T('كشّاف المصادر')}</h3>
          <div className="mb-2 flex flex-wrap gap-1.5 text-xs">
            {(Object.keys(STATUS) as SourceStatus[]).filter((s) => by(s).length).map((s) => <span key={s} className={`rounded-full px-2 py-0.5 font-bold ${STATUS[s].cls}`}>{by(s).length} {STATUS[s].label()}</span>)}
            {!sources.sources.length && <span className="text-stone-500">{T('أول جولة بحث هتظهر نتايجها هنا خلال 6 ساعات.')}</span>}
          </div>
          {lastRun && (
            <p className="mb-2 text-[11px] text-stone-500">
              {T('آخر جولة')}: {when(lastRun.at)} · {lastRun.mode === 'ai' ? T('بحث بالذكاء الاصطناعي') : T('بحث ذاتي بدون ذكاء اصطناعي')} · {TP('لقى {found}، فحص {vetted}، وافق على {activated}', { found: lastRun.found, vetted: lastRun.vetted, activated: lastRun.activated })}
            </p>
          )}
          {active.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-1.5 text-[11px]">
              {[...new Set(active.map((s) => s.region || 'global'))].map((r) => (
                <span key={r} className="rounded-full bg-stone-100 px-2 py-0.5 text-stone-600">{REGION[r]()}: {active.filter((s) => (s.region || 'global') === r).length}</span>
              ))}
            </div>
          )}
          {active.length > 0 && (
            <ul className="mb-2 divide-y divide-stone-100 text-xs">
              {active.map((s) => <SourceRow key={s.id} s={s} />)}
            </ul>
          )}
          {[...by('rejected'), ...by('paused')].length > 0 && (
            <details className="text-xs">
              <summary className="cursor-pointer text-stone-500">{T('متاجر اتفحصت ومتنقلش منها (والسبب)')}</summary>
              <ul className="mt-1 space-y-1">
                {[...by('paused'), ...by('rejected')].slice(0, 30).map((s) => (
                  <li key={s.id} className="flex flex-wrap gap-1.5">
                    <span className="font-mono">{s.host}</span>
                    {s.region && <span className="text-stone-400">{REGION[s.region]()}</span>}
                    <span className="text-stone-500">— {s.reason || '—'}</span>
                    {s.trust && <TrustCv t={s.trust} />}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </section>

        {/* Skills */}
        <section className="rounded-xl border border-stone-100 p-3">
          <h3 className="mb-2 flex items-center gap-1.5 text-xs font-bold text-stone-700"><Wrench className="h-4 w-4 text-sky-600" />{T('مهارات القراءة الذاتية')}</h3>
          <p className="mb-2 text-[11px] leading-relaxed text-stone-500">{T('لما الذكاء الاصطناعي يقرا صفحة منتج صح، شاهين بيحفظ مكان الاسم والسعر والصورة في المتجر ده، ويقرا باقي صفحاته لوحده.')}</p>
          {school.importer && (
            <div className="mb-2">
              <div className="mb-1 flex justify-between text-xs"><span>{T('صفحات اتقرت بدون ذكاء اصطناعي')}</span><b>{school.importer.localShare}%</b></div>
              <Meter value={school.importer.localShare} tone="bg-sky-500" />
            </div>
          )}
          <p className="text-xs text-stone-600">{TP('{sites} متجر اتعلم يقراه، منهم {trusted} موثوق', { sites: skillList.length, trusted })}</p>
        </section>

        {/* «مدرسة شاهين» */}
        <section className="rounded-xl border border-stone-100 p-3 lg:col-span-3">
          <h3 className="mb-2 flex items-center gap-1.5 text-xs font-bold text-stone-700"><BookOpenCheck className="h-4 w-4 text-amber-600" />{T('مدرسة شاهين — الاعتماد على النفس')}</h3>
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div>
              <div className="mb-1 flex justify-between text-xs"><span>{T('أسئلة بيرد عليها لوحده بدون أي خدمة ذكاء اصطناعي')}</span><b>{r.score}%</b></div>
              <Meter value={r.score} tone="bg-amber-500" />
              <p className="mt-1 text-[11px] text-stone-500">
                {TP('{covered} من {total} سؤال', { covered: r.covered, total: r.total })}
                {Object.entries(r.byLang).map(([lang, v]) => ` · ${lang === 'ar' ? T('عربي') : T('إنجليزي')} ${v.covered}/${v.total}`).join('')}
              </p>
              <p className="mt-1 text-[11px] text-stone-500">
                {TP('ذاكر {ai} سؤال مع الذكاء الاصطناعي، واتعلم {self} لوحده من مكتبته', { ai: school.studiedTotal, self: school.selfTaughtTotal || 0 })}
                {school.localTaughtTotal ? ` · ${TP('منهم {n} مع المعلم المحلي (نموذج مفتوح Qwen على GitHub من غير مفتاح)', { n: school.localTaughtTotal })}` : ''} · {T('آخر امتحان')}: {when(school.updatedAt)}
              </p>
              {recent.length > 1 && (
                <div className="mt-2 flex h-10 items-end gap-0.5" aria-label={T('تطور النتيجة')}>
                  {recent.map((h) => <div key={h.at} title={`${when(h.at)} — ${h.score}%`} className={`flex-1 rounded-t ${h.mode === 'ai' ? 'bg-amber-400' : h.mode === 'local' ? 'bg-emerald-400' : 'bg-amber-200'}`} style={{ height: `${Math.max(4, h.score)}%` }} />)}
                </div>
              )}
            </div>
            <div className="text-xs">
              {school.pending.length > 0 && (
                <>
                  <p className="mb-1 font-semibold text-stone-600">{T('هيذاكرها الجولة الجاية')}</p>
                  <ul className="list-inside list-disc space-y-0.5 text-stone-600">{school.pending.slice(0, 6).map((p) => <li key={p.q} dir="auto">{p.q}</li>)}</ul>
                </>
              )}
              {school.lastStudied.length > 0 && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-stone-500">{T('آخر حاجات ذاكرها')}</summary>
                  <ul className="mt-1 list-inside list-disc space-y-0.5 text-stone-600">{school.lastStudied.slice(0, 10).map((p) => <li key={p.q + p.at} dir="auto">{p.q}</li>)}</ul>
                </details>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function SourceRow({ s }: { s: LiveSource }) {
  return (
    <li className="flex flex-wrap items-center gap-x-2 gap-y-0.5 py-1.5">
      <a href={s.base} target="_blank" rel="noreferrer" className="font-mono font-semibold hover:underline">{s.host}</a>
      <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${STATUS[s.status].cls}`}>{STATUS[s.status].label()}</span>
      {s.currency && <span className="text-stone-500">{s.currency}</span>}
      {s.productsEstimate ? <span className="text-stone-500">{TP('~{n} منتج', { n: s.productsEstimate })}</span> : null}
      <span className="text-stone-400">{(FOUND_BY[s.foundBy] || (() => s.foundBy))()}{s.foundWith ? ` («${s.foundWith}»)` : ''}</span>
      {s.region && <span className="text-stone-500">{REGION[s.region]()}</span>}
      <span className="text-stone-400">{T('آخر فحص')}: {when(s.vettedAt)}</span>
      {s.trust ? <TrustCv t={s.trust} /> : <span className="text-[11px] text-amber-700">{T('سيرته الذاتية هتتراجع في الجولة الجاية')}</span>}
    </li>
  );
}
