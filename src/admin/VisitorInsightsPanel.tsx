/**
 * «خزنة فهم الزوار» in the admin panel — the owner's studies of visitors, customers and members:
 * who they are as buyers (communication style, decision style, price comfort, motive, scent temperament), what each
 * country's culture of buying looks like, and the path from viewing to buying. The administration's only.
 * Data: GET /api/admin/insights (server/insights.ts); the analysis lives in src/utils/visitorInsights.ts.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Activity, Brain, Download, Eye, FlaskConical, Globe, Package, RefreshCw, ShieldCheck, Trash2, Users } from 'lucide-react';
import { adminRequest, send } from './adminApi';
import { T, TP, formatAdminNumber, getAdminLang, useAdminLanguage } from './adminL10n';
import {
  DECISION_TEXT, MOTIVE_TEXT, PRICE_TEXT, RHYTHM_TEXT, STYLE_TEXT,
  type InsightProfile, type InsightsSummary, type PersonReading,
} from '../utils/visitorInsights';
import type { OrderCountry, PulseCountry } from '../utils/insightsPulse';
import type { BuyerMotive, BuyerStyle } from '../utils/salesCraft';

type Text = { ar: string; en: string };
const pick = (t?: Text) => (t ? (getAdminLang() === 'ar' ? t.ar : t.en) : '');
const n = (v: number) => formatAdminNumber(v);
const bars = (counter: Record<string, number>, label: (k: string) => string) => {
  const sum = Object.values(counter).reduce((a, b) => a + b, 0) || 1;
  return Object.entries(counter).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, v]) => (
    <div key={k} className="flex items-center gap-2 text-xs">
      <span className="w-40 truncate">{label(k)}</span>
      <div className="flex-1 h-2 rounded bg-stone-100"><div className="h-2 rounded bg-amber-500" style={{ width: `${Math.round((v / sum) * 100)}%` }} /></div>
      <span className="w-10 text-end tabular-nums">{Math.round((v / sum) * 100)}%</span>
    </div>
  ));
};
const styleLabel = (k: string) => pick(STYLE_TEXT[k as BuyerStyle]?.label) || k;
const decisionLabel = (k: string) => pick(DECISION_TEXT[k as keyof typeof DECISION_TEXT]) || k;
const priceLabel = (k: string) => pick(PRICE_TEXT[k as keyof typeof PRICE_TEXT]) || k;
const motiveLabel = (k: string) => pick(MOTIVE_TEXT[k as BuyerMotive]) || k;
const rhythmLabel = (k: string) => pick(RHYTHM_TEXT[k as keyof typeof RHYTHM_TEXT]) || k;

function Card({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-4 space-y-2">
      <h3 className="font-bold text-stone-900 text-sm flex items-center gap-2">{icon}{title}</h3>
      {children}
    </section>
  );
}

export default function VisitorInsightsPanel() {
  useAdminLanguage();
  const [data, setData] = useState<{ storage: { kind: string; persistent: boolean }; summary: InsightsSummary; pulse?: PulseCountry[]; orders?: OrderCountry[] } | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [person, setPerson] = useState<{ profile: InsightProfile; reading: PersonReading } | null>(null);

  const load = useCallback(async () => {
    setBusy(true); setError('');
    try { setData(await adminRequest('/insights')); } catch (e) { setError(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const open = async (id: string) => {
    try { setPerson(await adminRequest(`/insights/profiles/${encodeURIComponent(id)}`)); } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  };
  const erase = async (id: string) => {
    if (!window.confirm(T('امسح سجل الشخص ده نهائياً؟'))) return;
    await adminRequest(`/insights/profiles/${encodeURIComponent(id)}`, send('DELETE')).catch(() => undefined);
    setPerson(null); void load();
  };
  const exportAll = async () => {
    const all = await adminRequest<unknown>('/insights/export');
    const url = URL.createObjectURL(new Blob([JSON.stringify(all, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = `sham-visitor-insights-${new Date().toISOString().slice(0, 10)}.json`; a.click();
    URL.revokeObjectURL(url);
  };

  const s = data?.summary;
  return (
    <div className="space-y-4" data-testid="visitor-insights">
      <div className="rounded-2xl bg-stone-900 text-amber-50 p-4 space-y-1">
        <h2 className="font-bold flex items-center gap-2"><Brain className="w-5 h-5 text-amber-400" />{T('خزنة فهم الزوار')}</h2>
        <p className="text-xs text-stone-300">{T('تفاعل الزوار والعملاء والأعضاء مع المنصة، متحلل نفسياً وسلوكياً ومجتمعياً — ملك الإدارة وحدها.')}</p>
        <p className="text-[11px] text-emerald-300 flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5" />{T('بموافقة الزائر على «التحليل» • من غير مفاتيح ولا كلمات سر ولا أرقام بطاقات • بيانات التواصل بتفضل في حساب العميل بس • مش بتتبعت لأي منصة')}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => void load()} disabled={busy} className="rounded-xl bg-amber-500 text-stone-950 px-3 py-1.5 text-xs font-bold flex items-center gap-1 disabled:opacity-50"><RefreshCw className="w-3.5 h-3.5" />{T('تحديث')}</button>
        <button type="button" onClick={() => void exportAll()} className="rounded-xl border border-stone-300 px-3 py-1.5 text-xs flex items-center gap-1"><Download className="w-3.5 h-3.5" />{T('تصدير كل البيانات (JSON)')}</button>
      </div>
      {error && <p className="text-xs text-red-700">{error}</p>}
      {data && !data.storage.persistent && (
        <p className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900">{T('التخزين مؤقت دلوقتي: البيانات بتتمسح لما السيرفر يعيد التشغيل. هتتحفظ على طول أول ما قاعدة البيانات المجانية تتوصل.')}</p>
      )}
      {s && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            {([[T('الأشخاص'), s.profiles], [T('أعضاء مسجلين'), s.members], [T('رجعوا تاني'), s.returning], [T('اشتروا'), s.customers], [T('تفاعلات'), s.events]] as const).map(([label, v]) => (
              <div key={label} className="rounded-xl bg-white border border-stone-200 p-3"><p className="text-[11px] text-stone-500">{label}</p><p className="text-lg font-bold tabular-nums">{n(v)}</p></div>
            ))}
          </div>
          <Card title={T('رحلة الشراء')}>
            <p className="text-xs text-stone-700">{TP('شاف منتجات {a} ← سلة {b} ← بدأ الدفع {c} ← اشترى {d}', { a: n(s.funnel.products), b: n(s.funnel.carts), c: n(s.funnel.checkouts), d: n(s.funnel.purchases) })}</p>
          </Card>
          <div className="grid md:grid-cols-2 gap-3">
            <Card title={T('أسلوب الكلام (الأنماط الاجتماعية)')} icon={<Users className="w-4 h-4" />}>{bars(s.styles, styleLabel)}</Card>
            <Card title={T('طريقة اتخاذ القرار')}>{bars(s.decisions, decisionLabel)}</Card>
            <Card title={T('الراحة مع السعر')}>{bars(s.prices, priceLabel)}</Card>
            <Card title={T('دوافع الشراء')}>{bars(s.motives, motiveLabel)}</Card>
            <Card title={T('الأذواق (العائلات العطرية)')}>{bars(Object.fromEntries(s.families.map((f) => [f.id, f.share])), (k) => pick(s.families.find((f) => f.id === k)?.label) || k)}</Card>
          </div>
          <Card title={T('ثقافة الشراء في كل بلد')} icon={<Globe className="w-4 h-4" />}>
            {!s.countries.length && <p className="text-xs text-stone-500">{T('لسه مافيش بيانات.')}</p>}
            <div className="grid md:grid-cols-2 gap-3">
              {s.countries.slice(0, 20).map((c) => (
                <div key={c.country} className="rounded-xl border border-stone-200 p-3 space-y-1">
                  <p className="text-sm font-bold">{c.country} · {TP('{n} شخص', { n: n(c.visitors) })} · {TP('{n} رجعوا', { n: n(c.returning) })} · {TP('{n} اشتروا', { n: n(c.customers) })}</p>
                  {c.insights.map((line, i) => <p key={i} className="text-xs text-stone-700">• {pick(line)}</p>)}
                  {c.words.length > 0 && <p className="text-[11px] text-stone-500">{T('أكتر كلام بيدوروا عليه:')} {c.words.map((w) => w.word).join(' · ')}</p>}
                  <p className="text-[11px] text-stone-500">{T('أنشط وقت:')} {Object.entries(c.rhythm).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([k]) => rhythmLabel(k)).join(' · ')}</p>
                </div>
              ))}
            </div>
          </Card>
          <div className="grid md:grid-cols-2 gap-3">
            <Card title={T('عمق الاهتمام (زي فيسبوك)')} icon={<Eye className="w-4 h-4" />}>
              <p className="text-xs text-stone-700">{TP('متوسط الوقت على صفحة المنتج: {n} ثانية', { n: n(s.engagement?.avgDwellSec || 0) })}</p>
              <p className="text-xs text-stone-700">{TP('قرأوا الصفحة لآخرها: {n}%', { n: n(s.engagement?.deepShare || 0) })} · {TP('قلّبوا في الصور: {n} شخص', { n: n(s.engagement?.zoomers || 0) })}</p>
              <p className="text-xs text-stone-700">{TP('عملوا «اختبار ذوقك»: {n} شخص', { n: n(s.engagement?.quizTakers || 0) })}</p>
              {(s.engagement?.declared || []).length > 0 && <p className="text-[11px] text-stone-500">{T('قالوا عن ذوقهم:')} {s.engagement.declared.map((d) => `${d.id.split(':')[1]} ${d.share}%`).join(' · ')}</p>}
            </Card>
            <Card title={T('تجارب الصفحات (نسختين قدام بعض)')} icon={<FlaskConical className="w-4 h-4" />}>
              {!(s.experiments || []).length && <p className="text-xs text-stone-500">{T('لسه مافيش بيانات.')}</p>}
              {(s.experiments || []).map((x) => (
                <div key={x.test} className="space-y-1">
                  <p className="text-xs font-bold">{x.test === 'quiz_prompt' ? T('طريقة عرض «اختبار ذوقك»') : x.test}</p>
                  {x.versions.map((v) => (
                    <p key={v.version} className="text-xs text-stone-700">• {v.version === 'card' ? T('بطاقة دعوة') : v.version === 'chip' ? T('زرار صغير') : v.version}: {TP('{p} شخص — {c}% حطوا في السلة — {b}% اشتروا', { p: n(v.people), c: n(v.cartRate), b: n(v.buyRate) })}{x.leader === v.version ? ' 🏆' : ''}</p>
                  ))}
                  {!x.enough && <p className="text-[11px] text-stone-500">{T('لسه بدري نحكم — محتاجين 30 شخص على الأقل في كل نسخة.')}</p>}
                </div>
              ))}
            </Card>
          </div>
          <Card title={T('نبض الدول (عدّ مجهول الهوية — آخر 3 شهور)')} icon={<Activity className="w-4 h-4" />}>
            <p className="text-[11px] text-stone-500">{T('أرقام عامة من كل الزوار اللي مارفضوش «التحليل»: من غير أي معرّف ولا نص — قانونية من غير موافقة لأنها مستحيل ترجع لشخص.')}</p>
            {!(data?.pulse || []).length && <p className="text-xs text-stone-500">{T('لسه مافيش بيانات.')}</p>}
            <div className="grid md:grid-cols-2 gap-3">
              {(data?.pulse || []).slice(0, 20).map((c) => (
                <div key={c.country} className="rounded-xl border border-stone-200 p-3 space-y-1">
                  <p className="text-sm font-bold">{c.country === 'ZZ' ? T('بلد غير معروف') : c.country} · {TP('{n} تفاعل', { n: n(c.events) })}</p>
                  {c.insights.map((line, i) => <p key={i} className="text-xs text-stone-700">• {pick(line)}</p>)}
                  {c.families.length > 0 && <p className="text-[11px] text-stone-500">{c.families.map((f) => `${pick(f.label)} ${f.share}%`).join(' · ')}</p>}
                </div>
              ))}
            </div>
          </Card>
          <Card title={T('دراسة الطلبات (اللي اتدفع فعلاً)')} icon={<Package className="w-4 h-4" />}>
            {!(data?.orders || []).length && <p className="text-xs text-stone-500">{T('لسه مافيش طلبات حقيقية.')}</p>}
            <div className="grid md:grid-cols-2 gap-3">
              {(data?.orders || []).slice(0, 20).map((c) => (
                <div key={c.country} className="rounded-xl border border-stone-200 p-3 space-y-1">
                  <p className="text-sm font-bold">{c.country} · {TP('{n} طلب', { n: n(c.orders) })} · {TP('{n} اتدفع', { n: n(c.paid) })}</p>
                  {c.insights.map((line, i) => <p key={i} className="text-xs text-stone-700">• {pick(line)}</p>)}
                  {c.products.length > 0 && <p className="text-[11px] text-stone-500">{T('الأكتر مبيعاً:')} {c.products.map((p) => `${p.name} (${n(p.units)})`).join(' · ')}</p>}
                </div>
              ))}
            </div>
          </Card>
          <Card title={T('الأشخاص (آخر نشاط)')}>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead><tr className="text-stone-500 text-start">
                  <th className="p-1 text-start">{T('الشخص')}</th><th className="p-1 text-start">{T('البلد')}</th><th className="p-1 text-start">{T('اللغة')}</th>
                  <th className="p-1 text-start">{T('أسلوب الكلام')}</th><th className="p-1 text-start">{T('القرار')}</th><th className="p-1 text-start">{T('السعر')}</th><th className="p-1 text-start">{T('أيام')}</th>
                </tr></thead>
                <tbody>
                  {s.recent.map((r) => (
                    <tr key={r.id} className="border-t border-stone-100 hover:bg-amber-50 cursor-pointer" onClick={() => void open(r.id)}>
                      <td className="p-1 font-mono">{r.accountId ? `👤 ${r.accountId.slice(0, 10)}` : r.id.slice(0, 10)}</td><td className="p-1">{r.country || '—'}</td><td className="p-1">{r.language || '—'}</td>
                      <td className="p-1">{styleLabel(r.style)}</td><td className="p-1">{decisionLabel(r.decision)}</td><td className="p-1">{priceLabel(r.price)}</td><td className="p-1 tabular-nums">{n(r.days)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
      {person && (
        <Card title={TP('قراءة الشخص {id}', { id: person.profile.accountId || person.profile.id.slice(0, 12) })} icon={<Brain className="w-4 h-4" />}>
          <p className="text-xs">{T('أسلوب الكلام:')} <b>{pick(person.reading.communication.label)}</b></p>
          <p className="text-xs">{T('طريقة القرار:')} <b>{decisionLabel(person.reading.decision)}</b> · {T('الراحة مع السعر:')} <b>{priceLabel(person.reading.price)}</b>{person.reading.priceSensitive ? ` · ${T('حساس للسعر')}` : ''}</p>
          {person.reading.motive && <p className="text-xs">{T('الدافع:')} <b>{motiveLabel(person.reading.motive)}</b></p>}
          {person.reading.temperament.length > 0 && <p className="text-xs">{T('الميول العطرية:')} {person.reading.temperament.map(pick).join(' · ')}</p>}
          <p className="text-xs">{T('الولاء:')} {person.reading.loyalty} · {T('أنشط وقت:')} {rhythmLabel(person.reading.rhythm)} · {T('درجة الثقة في القراءة:')} {person.reading.confidence}</p>
          <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-2 space-y-1">
            <p className="text-xs font-bold text-emerald-900">{T('أحسن طريقة نخدمه بيها (بأمانة ومن غير ضغط):')}</p>
            {person.reading.approach.map((line, i) => <p key={i} className="text-xs text-emerald-900">• {pick(line)}</p>)}
          </div>
          {person.profile.searches.length > 0 && <p className="text-[11px] text-stone-600">{T('آخر بحث:')} {person.profile.searches.slice(-5).join(' · ')}</p>}
          {person.profile.chats.length > 0 && <p className="text-[11px] text-stone-600">{T('آخر أسئلة لشاهين:')} {person.profile.chats.slice(-5).join(' · ')}</p>}
          <button type="button" onClick={() => void erase(person.profile.id)} className="rounded-xl border border-red-300 text-red-700 px-3 py-1.5 text-xs flex items-center gap-1"><Trash2 className="w-3.5 h-3.5" />{T('امسح السجل ده')}</button>
        </Card>
      )}
    </div>
  );
}
