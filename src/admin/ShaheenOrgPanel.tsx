import { T, TP, adminLocale, getAdminLang } from './adminL10n';
import { useCallback, useEffect, useState } from 'react';
import { ArrowLeftRight, BookOpen, ExternalLink, Network, RefreshCw, ShieldCheck, UserCog } from 'lucide-react';
import bundledPrecheck from '../data/live/shaheen-precheck.json';
import { BOTS, DEPARTMENTS, LINKS, botOf, botsIn, type Bot, type DeptId } from '../utils/shaheenOrg';
import { HANDBOOK_EDITION, handbookSections } from '../utils/botHandbook';
import type { BotCheck, BotStatus, PrecheckFile } from '../../scripts/shaheen-council/precheck';

/**
 * «الهيكل الإداري» — the platform as cells under «الخبير شاهين»: the leadership (Shaheen, his secretary who
 * deputises under pressure, the pre-meeting check, the daily meeting), then the four departments with every
 * robot and AI tool coloured by today's full check (two hours before the meeting), its problems, fixes and
 * development ideas, and the cooperation map: who helps whom, and the help requests routed today.
 * Registry: src/utils/shaheenOrg.ts; check: src/data/live/shaheen-precheck.json (bundled + latest from GitHub).
 */
const REPO = 'https://github.com/spculculat-oss/Sham-Perfume';
const RAW = 'https://raw.githubusercontent.com/spculculat-oss/Sham-Perfume/main/src/data/live/shaheen-precheck.json';
const card = 'rounded-2xl border border-stone-200 bg-white p-4 shadow-sm';
const when = (iso?: string) => (iso && Date.parse(iso) > 0 ? new Date(iso).toLocaleString(adminLocale(), { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Cairo' }) : '—');
const isPrecheck = (d: unknown): d is PrecheckFile => Boolean(d && typeof d === 'object' && (d as PrecheckFile).version === 1 && Array.isArray((d as PrecheckFile).bots));
const ar = () => getAdminLang() === 'ar';
const name = (b?: Bot) => (b ? (ar() ? b.nameAr : b.nameEn) : '');

const DEPT_COLOR: Record<DeptId, string> = {
  leadership: 'border-amber-500 bg-amber-50 text-amber-900',
  store: 'border-orange-700 bg-orange-50 text-orange-900',
  content: 'border-sky-700 bg-sky-50 text-sky-900',
  experience: 'border-violet-700 bg-violet-50 text-violet-900',
  reliability: 'border-emerald-700 bg-emerald-50 text-emerald-900',
  innovation: 'border-teal-700 bg-teal-50 text-teal-900',
};
const STATUS: Record<BotStatus, { label: () => string; dot: string }> = {
  ok: { label: () => T('سليمة'), dot: 'bg-emerald-500' },
  warn: { label: () => T('محتاجة انتباه'), dot: 'bg-amber-400' },
  fail: { label: () => T('فيها عطل'), dot: 'bg-red-500' },
  idle: { label: () => T('بدون بيانات'), dot: 'bg-stone-300' },
};

export default function ShaheenOrgPanel() {
  const [check, setCheck] = useState<PrecheckFile>(bundledPrecheck as unknown as PrecheckFile);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const load = useCallback(() => {
    setLoading(true);
    fetch(`${RAW}?t=${Date.now()}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: unknown) => { if (isPrecheck(d) && Date.parse(d.updatedAt) >= Date.parse(check.updatedAt)) setCheck(d); })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, [check.updatedAt]);
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const byId = new Map<string, BotCheck>(check.bots.map((b) => [b.id, b]));
  const ran = Date.parse(check.updatedAt) > 0;

  const Cell = ({ bot }: { bot: Bot }) => {
    const c = byId.get(bot.id);
    const st = STATUS[c?.status || 'idle'];
    const isOpen = open === bot.id;
    const count = (c?.problems.length || 0) + (c?.ideas.length || 0);
    return (
      <div className="rounded-xl border border-stone-200 bg-white p-2.5 text-xs">
        <button type="button" onClick={() => setOpen(isOpen ? null : bot.id)} className="flex w-full items-start gap-2 text-start">
          <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${st.dot}`} title={st.label()} />
          <span className="min-w-0 flex-1">
            <b className="block text-stone-800">{name(bot)}</b>
            {ar() && <span className="mt-0.5 block text-[11px] leading-snug text-stone-500">{bot.dutiesAr}</span>}
          </span>
          {count > 0 && <span className="rounded-full bg-stone-100 px-1.5 text-[10px] font-bold text-stone-600">{count}</span>}
        </button>
        {isOpen && (
          <div className="mt-2 space-y-1.5 border-t border-stone-100 pt-2 text-[11px]">
            <p className="text-stone-500">
              {st.label()}{c?.reportAt ? ` · ${T('آخر تقرير')}: ${when(c.reportAt)}` : ''}{c?.lastRun ? ` · ${T('آخر تشغيل')}: ${when(c.lastRun.at)}` : ''}
              {bot.workflow && <> · <a className="font-bold text-amber-800 underline" href={`${REPO}/actions/workflows/${bot.workflow}`} target="_blank" rel="noreferrer">{T('سجل التشغيل')}</a></>}
            </p>
            {!!c?.problems.length && <List title={T('المشاكل')} items={c.problems} cls="text-red-700" />}
            {!!c?.fixes.length && <List title={T('الإصلاح المقترح')} items={c.fixes} cls="text-emerald-800" />}
            {!!c?.ideas.length && <List title={T('أفكار التطوير')} items={c.ideas} cls="text-sky-800" />}
            {!!c?.legal?.length && <List title={T('قرارات المدير القانوني (ملزمة)')} items={c.legal} cls="text-violet-800" />}
            {!c?.problems.length && !c?.ideas.length && <p className="text-stone-500">{T('مفيش ملاحظات في آخر فحص')}</p>}
            <Helps id={bot.id} />
          </div>
        )}
      </div>
    );
  };

  const leadership = botsIn('leadership');
  return (
    <section className="space-y-4" dir={ar() ? 'rtl' : 'ltr'}>
      <div className={card}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-lg font-black text-stone-900"><Network className="h-5 w-5 text-amber-700" />{T('الهيكل الإداري لمنصة شام')}</h2>
          <div className="flex gap-2">
            <a className="inline-flex items-center gap-1 rounded-lg border border-stone-200 px-2.5 py-1.5 text-xs font-bold text-stone-700" href={`${REPO}/blob/main/SHAHEEN_ORG.md`} target="_blank" rel="noreferrer"><ExternalLink className="h-3.5 w-3.5" />{T('الخريطة الكاملة')}</a>
            <button type="button" onClick={load} className="inline-flex items-center gap-1 rounded-lg border border-stone-200 px-2.5 py-1.5 text-xs font-bold text-stone-700"><RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />{T('تحديث')}</button>
          </div>
        </div>
        <p className="mt-1 text-xs text-stone-500">{TP('{count} أداة وروبوت تحت قيادة الخبير شاهين في 5 خلايا. كل أداة بتعمل فحص شامل لنفسها قبل الاجتماع بساعتين، والسكرتير بينوب عن شاهين وقت الضغط.', { count: BOTS.length })}</p>
        <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl bg-stone-50 p-3 text-xs">
          <ShieldCheck className="h-4 w-4 text-emerald-700" />
          {ran ? (
            <>
              <b className="text-stone-800">{TP('صحة الأدوات {health}%', { health: check.health })}</b>
              {(['ok', 'warn', 'fail', 'idle'] as BotStatus[]).map((s) => <span key={s} className="inline-flex items-center gap-1"><span className={`h-2 w-2 rounded-full ${STATUS[s].dot}`} />{STATUS[s].label()}: {check.counts[s]}</span>)}
              <span className="text-stone-500">{T('آخر فحص')}: {when(check.updatedAt)} · {T('الاجتماع')}: {when(check.meetingAt)}</span>
            </>
          ) : <span className="text-stone-500">{T('أول فحص شامل هيتعمل الساعة 8:10 الصبح بتوقيت القاهرة، قبل الاجتماع بساعتين')}</span>}
        </div>
      </div>

      {/* Leadership */}
      <div className={`${card} border-amber-300`}>
        <div className="mx-auto max-w-md rounded-2xl border-2 border-amber-500 bg-amber-50 p-3 text-center">
          <b className="block text-base text-amber-900">{T('الخبير شاهين')}</b>
          <span className="text-xs text-amber-800">{T('المدير العام — يرأس الاجتماع اليومي ويوزع المهام')}</span>
        </div>
        <div className="mt-3 grid gap-2 md:grid-cols-3">{leadership.map((b) => <Cell key={b.id} bot={b} />)}</div>
        <div className="mt-3 rounded-xl border border-dashed border-amber-300 bg-amber-50/50 p-3 text-xs">
          <b className="flex items-center gap-1.5 text-amber-900"><UserCog className="h-4 w-4" />{T('السكرتير — مشرف شاهين')}</b>
          <ul className="mt-1.5 list-disc space-y-0.5 ps-5 text-stone-700">
            <li>{T('يجهز جدول أعمال الاجتماع من الفحص الشامل.')}</li>
            <li>{T('يرأس الاجتماع بدل شاهين لو مفيش محرك ذكاء اصطناعي أو الباقات خلصت أو الضغط عالي.')}</li>
            <li>{T('ينفذ القرارات الآمنة بس، ويوزع طلبات المساعدة بين الأدوات.')}</li>
            <li>{T('يسجل كل حاجة عملها بالنيابة، وشاهين يراجعها في أول اجتماع بعدها.')}</li>
          </ul>
        </div>
      </div>

      {/* Departments (cells) */}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {DEPARTMENTS.filter((d) => d.id !== 'leadership').map((d) => (
          <div key={d.id} className={`rounded-2xl border-t-4 bg-white p-3 shadow-sm ${DEPT_COLOR[d.id].split(' ')[0]}`}>
            <div className={`rounded-xl px-3 py-2 ${DEPT_COLOR[d.id]}`}>
              <b className="block text-sm">{ar() ? d.nameAr : d.nameEn}</b>
              <span className="text-[11px] opacity-80">{T('الرئيس')}: {ar() ? d.headAr : d.headEn}</span>
            </div>
            <div className="mt-2 space-y-2">{botsIn(d.id).map((b) => <Cell key={b.id} bot={b} />)}</div>
          </div>
        ))}
      </div>

      {/* Cooperation */}
      <div className={card}>
        <h3 className="flex items-center gap-2 text-sm font-black text-stone-900"><ArrowLeftRight className="h-4 w-4 text-amber-700" />{T('التعاون والتنسيق بين الأدوات')}</h3>
        {ran && (
          <div className="mt-2">
            <p className="text-xs font-bold text-stone-700">{TP('طلبات المساعدة النهارده ({count})', { count: check.handoffs.length })}</p>
            {check.handoffs.length ? (
              <ul className="mt-1 space-y-1 text-xs">
                {check.handoffs.map((h, i) => (
                  <li key={i} className="rounded-lg bg-amber-50 px-2.5 py-1.5 text-stone-700">
                    <b>{name(botOf(h.from))}</b> ← <b>{name(botOf(h.to))}</b>: {h.textAr}{h.action ? <span className="ms-1 rounded-full bg-emerald-100 px-1.5 text-[10px] font-bold text-emerald-800">{T('السكرتير هيشغله في الاجتماع')}</span> : null}
                  </li>
                ))}
              </ul>
            ) : <p className="mt-1 text-xs text-stone-500">{T('مفيش طلبات مساعدة — كل أداة ماشية لوحدها كويس')}</p>}
          </div>
        )}
        <p className="mt-3 text-xs font-bold text-stone-700">{T('مين بيساعد مين (دايماً)')}</p>
        <ul className="mt-1 grid gap-1 text-[11px] text-stone-600 md:grid-cols-2">
          {LINKS.map((l, i) => <li key={i}><b className="text-stone-800">{name(botOf(l.from))}</b> ← <b className="text-stone-800">{name(botOf(l.to))}</b>{ar() ? `: ${l.whyAr}` : ''}</li>)}
        </ul>
      </div>

      {/* «كتيب الروبوتات»: the book every robot reads (and its compact edition reaches each robot's model) */}
      <details className={card}>
        <summary className="flex cursor-pointer items-center gap-2 text-sm font-black text-stone-900"><BookOpen className="h-4 w-4 text-amber-700" />{T('كتيب الروبوتات')}<span className="text-[11px] font-bold text-stone-400">{HANDBOOK_EDITION}</span></summary>
        <p className="mt-2 text-xs text-stone-500">{T('سياسات الموقع وتوجهات المنصة وطرق التسعير والأدوات الإضافية. كل روبوت بيقراه، ونسخة مختصرة منه بتوصل تلقائياً لنموذج أي روبوت مع كل طلب — حتى الروبوتات الجديدة.')}</p>
        <a className="mt-2 inline-flex items-center gap-1 rounded-lg border border-stone-200 px-2.5 py-1.5 text-xs font-bold text-stone-700" href={`${REPO}/blob/main/SHAHEEN_HANDBOOK.md`} target="_blank" rel="noreferrer"><ExternalLink className="h-3.5 w-3.5" />{T('الكتيب كامل')}</a>
        <div className="mt-3 space-y-3" dir="rtl">
          {handbookSections().map((s) => (
            <div key={s.id}>
              <b className="text-xs text-stone-800">{ar() ? s.titleAr : s.titleEn}</b>
              <ul className="mt-1 list-disc space-y-0.5 ps-4 text-[11px] leading-relaxed text-stone-600">{s.points.map((p, i) => <li key={i}>{p}</li>)}</ul>
            </div>
          ))}
        </div>
      </details>
    </section>
  );
}

const List = ({ title, items, cls }: { title: string; items: string[]; cls: string }) => (
  <div><b className="text-stone-700">{title}</b><ul className={`list-disc ps-4 ${cls}`}>{items.map((x, i) => <li key={i}>{x}</li>)}</ul></div>
);

/** The bots this one helps and gets help from (the cooperation map, per cell). */
const Helps = ({ id }: { id: string }) => {
  const to = LINKS.filter((l) => l.from === id);
  const from = LINKS.filter((l) => l.to === id);
  if (!to.length && !from.length) return null;
  return (
    <div className="text-stone-600">
      {!!to.length && <p><b className="text-stone-700">{T('بيساعد')}:</b> {to.map((l) => name(botOf(l.to))).join('، ')}</p>}
      {!!from.length && <p><b className="text-stone-700">{T('بياخد مساعدة من')}:</b> {from.map((l) => name(botOf(l.from))).join('، ')}</p>}
    </div>
  );
};
