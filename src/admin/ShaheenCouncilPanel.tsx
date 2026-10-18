import { T, TP, adminLocale, getAdminLang } from './adminL10n';
import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, ClipboardCopy, ExternalLink, ListTodo, RefreshCw, Target, Users } from 'lucide-react';
import bundledCouncil from '../data/live/shaheen-council.json';
import bundledSupervisor from '../data/live/ai-supervisor.json';
import { AI_TOOLS, type AiToolId } from '../utils/aiTools';
import type { CouncilFile, Decision, Meeting, SeatId, Task } from '../../scripts/shaheen-council/council';

/**
 * «مجلس شاهين» on top of the AI-management tab: Shaheen, manager of every AI tool, meets five specialist
 * seats once a day (.github/workflows/shaheen-council.yml). Shows the latest minutes (who spoke, with which
 * engine — admin only), the decisions, each tool's development goal next to its supervisor score, the task
 * queue the coding agent carries out from the chat («نفذ مهام شاهين», AGENTS.md) and the meeting history.
 * Public data from src/data/live/shaheen-council.json, so it shows on GitHub Pages and Vercel alike.
 */
const REPO = 'https://github.com/spculculat-oss/Sham-Perfume';
const RAW = 'https://raw.githubusercontent.com/spculculat-oss/Sham-Perfume/main/src/data/live/shaheen-council.json';
const RUNS_URL = `${REPO}/actions/workflows/shaheen-council.yml`;
const ISSUES_URL = `${REPO}/issues?q=is%3Aissue+is%3Aopen+label%3Ashaheen-task`;
const card = 'rounded-2xl border border-stone-200 bg-white p-4 shadow-sm';
const when = (iso?: string) => (iso && Date.parse(iso) > 0 ? new Date(iso).toLocaleString(adminLocale(), { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Cairo' }) : '—');
const isCouncil = (d: unknown): d is CouncilFile => Boolean(d && typeof d === 'object' && (d as CouncilFile).version === 1 && Array.isArray((d as CouncilFile).meetings));

const SEAT_LABEL: Record<SeatId, () => string> = {
  manager: () => T('شاهين — مدير أدوات الذكاء الاصطناعي'),
  store: () => T('خبير المتجر والاستيراد'),
  content: () => T('خبير المحتوى والظهور في البحث'),
  experience: () => T('خبير تجربة الزائر والتصميم واللغات'),
  reliability: () => T('خبير الجودة والاعتماد على النفس'),
};
/** The admin may see which engine spoke; visitors never see any of this. */
const ENGINE: Record<string, string> = { gemini: 'Gemini', deepseek: 'DeepSeek', openai: 'ChatGPT', claude: 'Claude', openrouter: 'OpenRouter', self_hosted: 'Self-hosted' };
const PRIORITY: Record<Decision['priority'], { label: () => string; cls: string }> = {
  high: { label: () => T('عاجل'), cls: 'bg-red-100 text-red-800' },
  medium: { label: () => T('متوسط'), cls: 'bg-amber-100 text-amber-800' },
  low: { label: () => T('عادي'), cls: 'bg-stone-100 text-stone-600' },
};
const STATUS: Record<Decision['status'], { label: () => string; cls: string }> = {
  applied: { label: () => T('اتنفذ'), cls: 'bg-emerald-100 text-emerald-800' },
  queued: { label: () => T('في طابور المهام'), cls: 'bg-sky-100 text-sky-800' },
  skipped: { label: () => T('اتأجل'), cls: 'bg-stone-100 text-stone-600' },
};
const TASK_STATUS: Record<Task['status'], { label: () => string; cls: string }> = {
  open: { label: () => T('لسه مفتوحة'), cls: 'bg-sky-100 text-sky-800' },
  done: { label: () => T('اتنفذت'), cls: 'bg-emerald-100 text-emerald-800' },
  dropped: { label: () => T('اتلغت'), cls: 'bg-stone-100 text-stone-600' },
};
const Badge = ({ cls, children }: { cls: string; children: React.ReactNode }) => <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${cls}`}>{children}</span>;
const toolName = (id: string) => { const t = AI_TOOLS.find((x) => x.id === id); return t ? (getAdminLang() === 'ar' ? t.nameAr : t.nameEn) : id; };
const scores = (bundledSupervisor as { tools?: Partial<Record<AiToolId, { score?: number | null; status?: string }>> }).tools || {};

export default function ShaheenCouncilPanel() {
  const [file, setFile] = useState<CouncilFile>(bundledCouncil as unknown as CouncilFile);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  // The chat command the coding agent knows (AGENTS.md); the English one works too.
  const COMMAND = T('نفذ مهام شاهين');
  const load = useCallback(() => {
    setLoading(true);
    fetch(`${RAW}?t=${Date.now()}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : undefined))
      .then((d: unknown) => { if (isCouncil(d) && Date.parse(d.updatedAt) >= Date.parse((bundledCouncil as { updatedAt: string }).updatedAt)) setFile(d); })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);
  useEffect(load, [load]);
  const copy = () => { void navigator.clipboard?.writeText(COMMAND).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); }).catch(() => undefined); };

  const last: Meeting | undefined = file.meetings[0];
  const open = file.tasks.filter((t) => t.status === 'open');
  const closed = file.tasks.filter((t) => t.status !== 'open').slice(0, 20);
  const goals = Object.entries(file.toolGoals) as [AiToolId, { text: string; since: string }][];

  return (
    <div className={`${card} mb-4`}>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-sm font-bold"><Users className="h-4 w-4 text-amber-600" />{T('مجلس شاهين — الاجتماع اليومي لتطوير الموقع')}</h2>
        <div className="flex items-center gap-2">
          <a href={RUNS_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-stone-500 hover:underline">{T('سجل التشغيل')}<ExternalLink className="h-3 w-3" /></a>
          <button type="button" onClick={load} disabled={loading} className="inline-flex items-center gap-1 rounded-lg border border-stone-200 px-2 py-1 text-xs hover:bg-stone-50 disabled:opacity-50 cursor-pointer">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />{T('تحديث')}
          </button>
        </div>
      </div>
      <p className="mb-4 text-xs leading-relaxed text-stone-600">
        {T('شاهين هو مدير كل أدوات الذكاء الاصطناعي في الموقع. كل يوم الساعة 9:30 الصبح بيعمل اجتماع مع خمس خبراء، كل واحد في تخصصه، على تقارير الموقع الحقيقية. بينفذ القرارات الآمنة بنفسه فوراً، ويحدد لكل أداة هدف تطوير، والباقي بيحوله لمهام تطوير تنفذها في الشات بكلمة واحدة.')}
      </p>

      {!last ? (
        <p className="rounded-xl bg-stone-50 p-3 text-xs text-stone-500">{T('أول اجتماع هيظهر هنا بعد أول تشغيل (كل يوم الساعة 9:30 الصبح بتوقيت القاهرة).')}</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          {/* Latest meeting */}
          <section className="rounded-xl border border-stone-100 p-3 lg:col-span-2">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <h3 className="text-xs font-bold text-stone-700">{TP('اجتماع {date}', { date: last.date })}</h3>
              <Badge cls={last.mode === 'ai' ? 'bg-violet-100 text-violet-800' : 'bg-stone-100 text-stone-600'}>{last.mode === 'ai' ? T('نقاش بين الخبراء') : T('من التقارير بدون ذكاء اصطناعي')}</Badge>
              <span className="text-[11px] text-stone-500">{when(last.at)}{last.chairEngine ? ` · ${T('رئيس الجلسة')}: ${ENGINE[last.chairEngine] || last.chairEngine}` : ''}</span>
              {last.chair === 'secretary' && <Badge cls="bg-amber-100 text-amber-800">{T('أدارها السكرتير بالنيابة عن شاهين')}</Badge>}
              {!!last.deputyReasons?.length && <span className="text-[11px] text-amber-800">{T('السبب')}: {last.deputyReasons.join(' · ')}</span>}
            </div>
            <p className="mb-3 text-xs leading-relaxed text-stone-700">{last.summaryAr}</p>
            <div className="mb-3 grid gap-1.5 sm:grid-cols-2">
              {last.seats.map((s) => (
                <details key={s.seat} className="rounded-lg bg-stone-50 px-2 py-1.5 text-xs">
                  <summary className="flex cursor-pointer flex-wrap items-center gap-1.5">
                    <span className={`h-2 w-2 rounded-full ${s.ok ? 'bg-emerald-500' : 'bg-stone-300'}`} />
                    <b>{SEAT_LABEL[s.seat]?.() || s.seat}</b>
                    <span className="text-[10px] text-stone-500">{s.ok ? (ENGINE[s.engine || ''] || s.engine || '') : T('لم يشارك')}</span>
                  </summary>
                  {s.ok && <p className="mt-1 whitespace-pre-line leading-relaxed text-stone-600">{s.text}</p>}
                </details>
              ))}
            </div>
            <h4 className="mb-1 text-xs font-bold text-stone-700">{T('القرارات')}</h4>
            {!last.decisions.length && <p className="text-xs text-stone-500">{T('لا قرارات جديدة اليوم.')}</p>}
            <ul className="space-y-1.5">
              {last.decisions.map((d) => (
                <li key={d.id} className="rounded-lg border border-stone-100 p-2 text-xs">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge cls={PRIORITY[d.priority].cls}>{PRIORITY[d.priority].label()}</Badge>
                    <Badge cls={STATUS[d.status].cls}>{STATUS[d.status].label()}</Badge>
                    <Badge cls="bg-stone-100 text-stone-600">{d.kind === 'auto' ? T('تنفيذ تلقائي') : T('مهمة تطوير')}</Badge>
                    {d.needsApproval && <Badge cls="bg-red-50 text-red-700">{T('محتاج موافقتك')}</Badge>}
                    {d.by === 'secretary' && <Badge cls="bg-amber-50 text-amber-800">{T('قرار السكرتير')}</Badge>}
                    <b>{d.title}</b>
                  </div>
                  <p className="mt-1 whitespace-pre-line text-stone-600">{d.detail}</p>
                  {d.note && <p className="mt-0.5 text-[11px] text-stone-400">{d.note}</p>}
                </li>
              ))}
            </ul>
          </section>

          {/* Tool goals */}
          <section className="rounded-xl border border-stone-100 p-3">
            <h3 className="mb-2 flex items-center gap-1.5 text-xs font-bold text-stone-700"><Target className="h-4 w-4 text-emerald-600" />{T('أهداف تطوير الأدوات')}</h3>
            <p className="mb-2 text-[11px] leading-relaxed text-stone-500">{T('مشرف شاهين بيقيس كل أداة على هدفها في المراجعة الجاية.')}</p>
            {!goals.length && <p className="text-xs text-stone-500">{T('مفيش أهداف لسه.')}</p>}
            <ul className="space-y-2">
              {goals.map(([id, g]) => (
                <li key={id} className="text-xs">
                  <div className="flex items-center justify-between gap-2"><b>{toolName(id)}</b><span className="text-[10px] text-stone-500">{TP('التقييم الحالي: {score}/10', { score: scores[id]?.score ?? '—' })}</span></div>
                  <p className="mt-0.5 whitespace-pre-line text-stone-600">{g.text}</p>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}

      {/* Tasks → the chat */}
      <section className="mt-4 rounded-xl border border-amber-200 bg-amber-50/40 p-3">
        <h3 className="mb-2 flex items-center gap-1.5 text-xs font-bold text-stone-700"><ListTodo className="h-4 w-4 text-amber-600" />{TP('مهام التطوير ({count} مفتوحة)', { count: open.length })}</h3>
        <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
          <span className="text-stone-600">{T('عشان تتنفذ: افتح الشات مع وكيل البرمجة واكتب')}</span>
          <code className="rounded bg-white px-2 py-1 font-bold text-amber-800 ring-1 ring-amber-200">{COMMAND}</code>
          <button type="button" onClick={copy} className="inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-white px-2 py-1 hover:bg-amber-50 cursor-pointer">
            {copied ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> : <ClipboardCopy className="h-3.5 w-3.5" />}{copied ? T('اتنسخ') : T('نسخ')}
          </button>
          <a href={ISSUES_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-stone-500 hover:underline">{T('المهام على GitHub')}<ExternalLink className="h-3 w-3" /></a>
        </div>
        {!open.length && <p className="text-xs text-stone-500">{T('مفيش مهام مفتوحة دلوقتي.')}</p>}
        <ul className="space-y-1.5">
          {open.map((t) => <TaskRow key={t.id} t={t} />)}
        </ul>
        {closed.length > 0 && (
          <details className="mt-2 text-xs">
            <summary className="cursor-pointer text-stone-500">{TP('مهام خلصت أو اتلغت ({count})', { count: closed.length })}</summary>
            <ul className="mt-1 space-y-1.5">{closed.map((t) => <TaskRow key={t.id} t={t} />)}</ul>
          </details>
        )}
      </section>

      {/* History */}
      {file.meetings.length > 1 && (
        <details className="mt-4 text-xs">
          <summary className="cursor-pointer font-bold text-stone-600">{TP('الاجتماعات السابقة ({count})', { count: file.meetings.length - 1 })}</summary>
          <ul className="mt-2 divide-y divide-stone-100">
            {file.meetings.slice(1).map((m) => (
              <li key={m.at} className="py-1.5">
                <div className="flex flex-wrap items-center gap-1.5"><b>{m.date}</b><Badge cls={m.mode === 'ai' ? 'bg-violet-100 text-violet-800' : 'bg-stone-100 text-stone-600'}>{m.mode === 'ai' ? T('نقاش بين الخبراء') : T('من التقارير بدون ذكاء اصطناعي')}</Badge><span className="text-stone-500">{TP('{count} قرار', { count: m.decisions.length })}</span></div>
                <p className="mt-0.5 text-stone-600">{m.summaryAr}</p>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function TaskRow({ t }: { t: Task }) {
  return (
    <li className="rounded-lg bg-white p-2 text-xs ring-1 ring-stone-100">
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge cls={TASK_STATUS[t.status].cls}>{TASK_STATUS[t.status].label()}</Badge>
        <Badge cls={PRIORITY[t.priority].cls}>{PRIORITY[t.priority].label()}</Badge>
        {t.needsApproval && t.status === 'open' && <Badge cls="bg-red-50 text-red-700">{T('محتاج موافقتك')}</Badge>}
        <b>{t.title}</b>
        {t.url ? <a href={t.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 text-sky-700 hover:underline">#{t.issue}<ExternalLink className="h-3 w-3" /></a> : <span className="text-[10px] text-stone-400">{T('لسه ما اتفتحتش على GitHub')}</span>}
        <span className="text-[10px] text-stone-400">{when(t.createdAt)}</span>
      </div>
      <details className="mt-1"><summary className="cursor-pointer text-[11px] text-stone-500">{T('التفاصيل')}</summary><p className="mt-1 whitespace-pre-line text-stone-600">{t.detail}</p></details>
    </li>
  );
}
