/**
 * «مستشار المصممين» on the designers' page: three buttons under the verdict —
 *  «تعديل مقترح» (one-click edits with reason, change and effect), «متخصص يوصّلك لخلطتك» (the designer's goal in his
 *  own words → the road step by step) and «استشارة شاهين» (a score out of 10 with strengths, weaknesses and advice).
 * The answers come from the deterministic advisor (always available); «اسأل شاهين» hands the same context to the
 * site's assistant for a deeper opinion.
 */
import React, { useState } from 'react';
import { CheckCircle2, Compass, Lightbulb, MessageCircle, RotateCcw, Stethoscope, AlertTriangle, ArrowLeftRight, Wand2 } from 'lucide-react';
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from '../types/i18n';
import { fmt, loc } from '../لغات/localize';
import type { DesignersKey } from '../لغات/designersL10n';
import type { Consultation, Effect, GoalPlan, LineChange, Msg, MsgVar, Suggestion } from '../utils/designers/advisorTypes';

type Panel = 'edits' | 'goal' | 'consult';
interface Props<D> {
  lang: SupportedLanguage;
  dt: (k: DesignersKey) => string;
  num: (n: number, d?: number) => string;
  accent: 'amber' | 'rose';
  hasLines: boolean;
  /** The current design (the base «طبّق الكل» chains the visible edits on). */
  design: D;
  suggestions: Suggestion<D>[];
  consult?: Consultation;
  plan: (goal: string) => GoalPlan<D>;
  goalPlaceholder: string;
  changeName: (c: LineChange) => string;
  formula: () => string;
  onApply: (d: D) => void;
  onUndo: () => void;
  onAsk: (text: string) => void;
}

export function DesignerAdvisor<D>(p: Props<D>) {
  const { lang, dt, num } = p;
  const [open, setOpen] = useState<Panel | null>(null);
  const [skipped, setSkipped] = useState<string[]>([]);
  const [flash, setFlash] = useState('');
  const [goal, setGoal] = useState('');
  const [plan, setPlan] = useState<GoalPlan<D> | null>(null);
  const arrow = SUPPORTED_LANGUAGES.find((l) => l.code === lang)?.dir === 'rtl' ? '←' : '→';
  const val = (v: MsgVar): string => (typeof v === 'number' ? num(v, 1) : typeof v === 'string' ? v : loc(lang, v));
  const say = (m: Msg) => fmt(loc(lang, m.t), Object.fromEntries(Object.entries(m.v || {}).map(([k, v]) => [k, val(v)])));
  const apply = (d: D, id: string) => { p.onApply(d); setFlash(id); window.setTimeout(() => setFlash(''), 1800); };
  const visible = p.suggestions.filter((s) => !skipped.includes(s.id));
  const run = (text: string) => { setGoal(text); setPlan(p.plan(text)); };
  const tone = p.accent === 'amber' ? { solid: 'bg-amber-700 border-amber-700', soft: 'bg-amber-50 border-amber-200', text: 'text-amber-800' } : { solid: 'bg-rose-700 border-rose-700', soft: 'bg-rose-50 border-rose-200', text: 'text-rose-800' };

  const buttons: { id: Panel; key: DesignersKey; icon: React.ElementType; badge?: number }[] = [
    { id: 'edits', key: 'advisorEdits', icon: Lightbulb, badge: p.hasLines ? visible.length : undefined },
    { id: 'goal', key: 'advisorGoal', icon: Compass },
    { id: 'consult', key: 'advisorConsult', icon: Stethoscope },
  ];

  return (
    <div className="space-y-3" data-testid="designer-advisor">
      <div className="flex flex-wrap gap-2">
        {buttons.map(({ id, key, icon: Icon, badge }) => (
          <button key={id} type="button" onClick={() => setOpen(open === id ? null : id)} aria-pressed={open === id} data-testid={`advisor-${id}`}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border cursor-pointer ${open === id ? `${tone.solid} text-white` : `${tone.soft} ${tone.text}`}`}>
            <Icon className="w-3.5 h-3.5" /> {dt(key)}
            {badge ? <span className={`ms-1 min-w-5 px-1.5 rounded-full text-[10px] ${open === id ? 'bg-white/25' : 'bg-white'}`}>{num(badge, 0)}</span> : null}
          </button>
        ))}
      </div>

      {open === 'edits' && (
        <section className={`rounded-2xl border p-3 space-y-3 ${tone.soft}`} data-testid="advisor-edits-panel">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-black text-stone-900 flex items-center gap-1.5"><Lightbulb className="w-4 h-4" /> {dt('editsTitle')}</h3>
            <div className="flex gap-1.5">
              {visible.length > 1 && <SmallButton onClick={() => apply(visible.reduce((x, s) => s.apply(x), p.design), 'all')} solid={tone.solid} testId="advisor-apply-all"><Wand2 className="w-3.5 h-3.5" /> {dt('applyAll')}</SmallButton>}
              <SmallButton onClick={p.onUndo}><RotateCcw className="w-3.5 h-3.5" /> {dt('undoEdit')}</SmallButton>
            </div>
          </div>
          <p className="text-[11px] text-stone-600">{dt('editsIntro')}</p>
          {flash && <p className="text-xs font-bold text-emerald-700 flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> {dt('applied')}</p>}
          {!p.hasLines ? <p className="text-xs text-stone-500">{dt('advisorEmpty')}</p> : !visible.length ? <p className="text-xs text-emerald-800 font-bold">{dt('editsNone')}</p> : visible.map((s) => (
            <article key={s.id} className="rounded-xl border border-stone-200 bg-white p-3 space-y-2" data-testid="advisor-suggestion">
              <p className="text-sm font-black text-stone-900">{say(s.title)}</p>
              <p className="text-xs text-stone-600 leading-relaxed">{say(s.why)}</p>
              <Changes changes={s.changes} name={p.changeName} dt={dt} num={num} />
              <Effects effects={s.effects} val={val} dt={dt} arrow={arrow} />
              <div className="flex gap-1.5">
                <SmallButton onClick={() => apply(s.design, s.id)} solid={tone.solid} testId="advisor-apply">{dt('applyEdit')}</SmallButton>
                <SmallButton onClick={() => setSkipped([...skipped, s.id])}>{dt('dismissEdit')}</SmallButton>
              </div>
            </article>
          ))}
        </section>
      )}

      {open === 'goal' && (
        <section className={`rounded-2xl border p-3 space-y-3 ${tone.soft}`} data-testid="advisor-goal-panel">
          <h3 className="text-sm font-black text-stone-900 flex items-center gap-1.5"><Compass className="w-4 h-4" /> {dt('goalTitle')}</h3>
          <p className="text-[11px] text-stone-600">{dt('goalIntro')}</p>
          <form className="flex flex-col sm:flex-row gap-2" onSubmit={(e) => { e.preventDefault(); run(goal); }}>
            <input value={goal} onChange={(e) => setGoal(e.target.value.slice(0, 240))} placeholder={p.goalPlaceholder} aria-label={dt('goalTitle')} data-testid="advisor-goal-input"
              className="flex-1 rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm" />
            <button type="submit" className={`inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-white text-xs font-bold border cursor-pointer ${tone.solid}`} data-testid="advisor-goal-go"><Compass className="w-3.5 h-3.5" /> {dt('goalGo')}</button>
          </form>
          {plan && (
            <div className="space-y-3" data-testid="advisor-goal-result">
              {plan.understood.length > 0 && (
                <div className="space-y-1">
                  <p className="text-[11px] font-bold text-stone-500">{dt('goalUnderstood')}:</p>
                  <div className="flex flex-wrap gap-1.5">{plan.understood.map((m, i) => <span key={i} className="px-2 py-1 rounded-lg bg-white border border-stone-200 text-[11px] font-semibold text-stone-700">{say(m)}</span>)}</div>
                </div>
              )}
              {plan.questions.length > 0 && (
                <div className="space-y-2" data-testid="advisor-goal-questions">
                  <p className="text-xs font-bold text-stone-700">{dt('goalAsk')}</p>
                  {plan.questions.map((q) => (
                    <div key={q.id} className="space-y-1">
                      <p className="text-xs font-black text-stone-800">{say(q.q)}</p>
                      <div className="flex flex-wrap gap-1.5">{q.options.map((o, i) => (
                        <button key={i} type="button" onClick={() => run(`${goal.trim()} ${loc(lang, o.add)}`.trim())} className="px-2.5 py-1 rounded-full bg-white border border-stone-300 text-[11px] font-bold text-stone-700 cursor-pointer hover:border-stone-500">{loc(lang, o.label)}</button>
                      ))}</div>
                    </div>
                  ))}
                </div>
              )}
              {plan.steps.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-black text-stone-800">{dt('goalSteps')}</p>
                  <ol className="space-y-2">
                    {plan.steps.map((s, i) => (
                      <li key={i} className="rounded-xl border border-stone-200 bg-white p-2.5 space-y-1.5" data-testid="advisor-goal-step">
                        <p className="text-xs text-stone-800"><b className={tone.text}>{num(i + 1, 0)}.</b> {say(s.say)}</p>
                        <Changes changes={s.changes} name={p.changeName} dt={dt} num={num} max={4} />
                        {i < plan.steps.length - 1 && <SmallButton onClick={() => apply(s.design, `step-${i}`)}>{dt('goalApplyTo')}</SmallButton>}
                      </li>
                    ))}
                  </ol>
                  {plan.match && <p className="text-xs text-stone-700"><b>{dt('goalMatch')}:</b> <span dir="ltr">{num(plan.match.from, 0)}% → {num(plan.match.to, 0)}%</span></p>}
                  <Effects effects={plan.effects} val={val} dt={dt} arrow={arrow} />
                  {flash.startsWith('step') || flash === 'goal' ? <p className="text-xs font-bold text-emerald-700 flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> {dt('applied')}</p> : null}
                  {plan.design && <SmallButton onClick={() => apply(plan.design as D, 'goal')} solid={tone.solid} testId="advisor-goal-apply"><Wand2 className="w-3.5 h-3.5" /> {dt('goalApplyAll')}</SmallButton>}
                </div>
              )}
              {goal.trim() && <SmallButton onClick={() => p.onAsk(fmt(dt('askGoal'), { goal: goal.trim(), formula: p.formula() }))}><MessageCircle className="w-3.5 h-3.5" /> {dt('goalAskShaheen')}</SmallButton>}
            </div>
          )}
        </section>
      )}

      {open === 'consult' && (
        <section className={`rounded-2xl border p-3 space-y-3 ${tone.soft}`} data-testid="advisor-consult-panel">
          <h3 className="text-sm font-black text-stone-900 flex items-center gap-1.5"><Stethoscope className="w-4 h-4" /> {dt('consultTitle')}</h3>
          {!p.consult ? <p className="text-xs text-stone-500">{dt('advisorEmpty')}</p> : (
            <>
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-white border border-stone-200 px-4 py-2 text-center" data-testid="advisor-score">
                  <p className={`text-2xl font-black ${p.consult.score >= 7 ? 'text-emerald-700' : p.consult.score >= 5.5 ? 'text-amber-700' : 'text-red-700'}`}>{num(p.consult.score, 1)}</p>
                  <p className="text-[10px] text-stone-500">{dt('consultOutOf')}</p>
                </div>
                <p className="text-sm font-black text-stone-800">{loc(lang, p.consult.grade)}</p>
              </div>
              <div className="grid sm:grid-cols-2 gap-x-4 gap-y-1.5">
                {p.consult.parts.map((x, i) => (
                  <div key={i} className="space-y-0.5">
                    <div className="flex justify-between text-[11px]"><span className="font-bold text-stone-700">{loc(lang, x.label)}</span><span>{num(x.value, 0)}%</span></div>
                    <div className="h-1.5 rounded-full bg-white overflow-hidden"><div className="h-full rounded-full" style={{ width: `${x.value}%`, background: x.value >= 75 ? '#047857' : x.value >= 50 ? '#b45309' : '#b91c1c' }} /></div>
                  </div>
                ))}
              </div>
              <List title={dt('consultStrengths')} items={p.consult.strengths.map(say)} icon={CheckCircle2} color="text-emerald-700" />
              <List title={dt('consultWeaknesses')} items={p.consult.weaknesses.map(say)} icon={AlertTriangle} color="text-amber-700" empty={dt('consultNoWeak')} />
              <div className="space-y-1">
                <p className="text-xs font-black text-stone-800">{dt('consultAdvice')}</p>
                <ol className="list-decimal ps-5 space-y-1 text-xs text-stone-700">{p.consult.advice.map((m, i) => <li key={i}>{say(m)}</li>)}</ol>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {p.suggestions.length > 0 && <SmallButton onClick={() => setOpen('edits')} solid={tone.solid}><Lightbulb className="w-3.5 h-3.5" /> {dt('consultToEdits')}</SmallButton>}
                <SmallButton onClick={() => p.onAsk(fmt(dt('askConsult'), { formula: p.formula(), score: num(p.consult!.score, 1), grade: loc(lang, p.consult!.grade), weak: p.consult!.weaknesses.map(say).join(' · ') || '—' }))}>
                  <MessageCircle className="w-3.5 h-3.5" /> {dt('consultDeeper')}
                </SmallButton>
              </div>
            </>
          )}
        </section>
      )}
      {open && <p className="text-[10px] text-stone-500">{dt('advisorNote')}</p>}
    </div>
  );
}

function SmallButton({ children, onClick, solid, testId }: { children: React.ReactNode; onClick: () => void; solid?: string; testId?: string }) {
  return <button type="button" onClick={onClick} data-testid={testId} className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold border cursor-pointer ${solid ? `${solid} text-white` : 'bg-white border-stone-300 text-stone-700'}`}>{children}</button>;
}

function Changes({ changes, name, dt, num, max = 6 }: { changes: LineChange[]; name: (c: LineChange) => string; dt: (k: DesignersKey) => string; num: (n: number, d?: number) => string; max?: number }) {
  if (!changes.length) return null;
  return (
    <ul className="text-[11px] text-stone-700 space-y-0.5">
      {changes.slice(0, max).map((c, i) => (
        <li key={i} className="flex flex-wrap items-center gap-1">
          <ArrowLeftRight className="w-3 h-3 text-stone-400" />
          <b>{name(c)}</b>
          {c.from === 0 ? <span className="text-emerald-700">{dt('changeNew')} · {num(c.to)}%</span>
            : c.to === 0 ? <span className="text-red-700">{dt('changeRemoved')}</span>
            : <span dir="ltr">{num(c.from)}% → {num(c.to)}%</span>}
        </li>
      ))}
      {changes.length > max && <li className="text-stone-500">{fmt(dt('changesMore'), { n: num(changes.length - max, 0) })}</li>}
    </ul>
  );
}

function Effects({ effects, val, dt, arrow }: { effects: Effect[]; val: (v: MsgVar) => string; dt: (k: DesignersKey) => string; arrow: string }) {
  if (!effects.length) return null;
  return (
    <div className="space-y-1">
      <p className="text-[11px] font-bold text-stone-500">{dt('effectsTitle')}</p>
      <div className="flex flex-wrap gap-1.5">
        {effects.map((e, i) => <span key={i} className={`px-2 py-0.5 rounded-lg text-[11px] font-semibold border ${e.better ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-amber-50 border-amber-200 text-amber-800'}`}>{val(e.label)}: {val(e.from)} {arrow} {val(e.to)}</span>)}
      </div>
    </div>
  );
}

function List({ title, items, icon: Icon, color, empty }: { title: string; items: string[]; icon: React.ElementType; color: string; empty?: string }) {
  if (!items.length && !empty) return null;
  return (
    <div className="space-y-1">
      <p className="text-xs font-black text-stone-800">{title}</p>
      {!items.length ? <p className="text-[11px] text-stone-500">{empty}</p> : (
        <ul className="space-y-1">{items.map((t, i) => <li key={i} className="flex gap-1.5 text-xs text-stone-700"><Icon className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${color}`} />{t}</li>)}</ul>
      )}
    </div>
  );
}
