/**
 * «استوديو شاهين» — robot designer: describe the robot or pick its kind, shape its answers and the details it
 * collects, try it right here (the very engine your visitors will get), then take one file to any website.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Code2, Download, Loader2, Plus, RotateCcw, Send, Sparkles, Trash2 } from 'lucide-react';
import type { SupportedLanguage } from '../types/i18n';
import { downloadBlob } from '../workspace/officeWriters';
import { BOT_KINDS, BOT_TONES, botDemoPage, botEngine, botFromReply, botPrompt, botScript, botTemplate, cleanBot, localBot, type BotField, type BotKind, type BotSpec, type BotState, type FieldKind } from './botDesigner';
import { askDesign } from './studioApi';
import { dsText, type DesignKey } from './designStrings';
import { Chips, CodeBox, CopyButton, card, field, label, soft, strong } from './designUi';
import type { T } from './StudioPanel';

const DRAFT = 'sham-studio-bot-v1';
const AVATARS = ['🤖', '🦅', '💬', '🎧', '🛍️', '📅', '🎓', '💡', '🌸', '⭐'];
const lines = (s: string) => s.split('\n').map((x) => x.trim()).filter(Boolean);
const kindOf = (label: string): FieldKind => (/تليفون|موبايل|جوال|رقم|phone|mobile|whatsapp|واتس/i.test(label) ? 'phone' : /إيميل|ايميل|بريد|e-?mail/i.test(label) ? 'email' : /يوم|ميعاد|موعد|تاريخ|وقت|date|time|day/i.test(label) ? 'date' : 'text');
interface Line { from: 'bot' | 'me'; text: string; link?: string; linkLabel?: string }

export function BotPanel({ lang, st, ai, onOpenCode }: { lang: SupportedLanguage; st: T; ai: boolean; onOpenCode: (code: string) => void }) {
  const d = (k: DesignKey) => dsText(lang, k);
  const rtlDefault = lang === 'ar';
  const [bot, setBotRaw] = useState<BotSpec>(() => {
    const start = botTemplate('booking', rtlDefault);
    try { const raw = localStorage.getItem(DRAFT); return raw ? cleanBot(JSON.parse(raw), start) : start; } catch { return start; }
  });
  const setBot = (next: BotSpec) => { setBotRaw(next); try { localStorage.setItem(DRAFT, JSON.stringify(next)); } catch { /* full */ } };
  const set = <K extends keyof BotSpec>(k: K, v: BotSpec[K]) => setBot({ ...bot, [k]: v });
  const [idea, setIdea] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  // Text areas keep what is being typed (blank lines included) and update the robot as you go.
  const [quickText, setQuickText] = useState(bot.quick.join('\n'));
  const [rulesText, setRulesText] = useState(bot.rules.join('\n'));
  const [fieldsText, setFieldsText] = useState(bot.collect.fields.map((f) => f.label).join('\n'));
  const syncTexts = (b: BotSpec) => { setQuickText(b.quick.join('\n')); setRulesText(b.rules.join('\n')); setFieldsText(b.collect.fields.map((f) => f.label).join('\n')); };

  // The tester.
  const [log, setLog] = useState<Line[]>([]);
  const [state, setState] = useState<BotState | null>(null);
  const [msg, setMsg] = useState('');
  const logRef = useRef<HTMLDivElement>(null);
  const restart = (b = bot) => { const turn = botEngine(b, '', null); setLog([{ from: 'bot', text: turn.text }]); setState(null); };
  useEffect(() => { restart(); }, [bot.greeting]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { logRef.current?.scrollTo({ top: logRef.current.scrollHeight }); }, [log]);
  const talk = (text: string) => {
    const t = text.trim();
    if (!t) return;
    const turn = botEngine(bot, t, state);
    setState(turn.state);
    setLog((l) => [...l, { from: 'me', text: t }, { from: 'bot', text: turn.text, link: turn.link, linkLabel: turn.linkLabel }]);
    setMsg('');
  };

  const design = async () => {
    if (!idea.trim() || busy) return;
    setBusy(true); setNote('');
    const local = localBot(idea, bot.rtl);
    const reply = await askDesign('bot', idea, lang, { ai }).catch(() => undefined);
    const next = reply ? botFromReply(reply, local) : undefined;
    const chosen = next || local;
    setBot(chosen); syncTexts(chosen); restart(chosen);
    setNote(next ? d('done_ai') : d('done_local'));
    setBusy(false);
  };
  const switchKind = (kind: BotKind) => {
    const t = botTemplate(kind, bot.rtl, bot.name);
    const next = { ...t, color: bot.color, handoff: { ...t.handoff, whatsapp: bot.handoff.whatsapp, email: bot.handoff.email } };
    setBot(next); syncTexts(next); restart(next);
  };
  const setFaq = (i: number, k: 'q' | 'a', v: string) => set('faq', bot.faq.map((f, n) => (n === i ? { ...f, [k]: v } : f)));
  const script = useMemo(() => botScript(bot), [bot]);
  const demo = useMemo(() => botDemoPage(bot), [bot]);
  const prompt = useMemo(() => botPrompt(bot), [bot]);
  const snippet = '<script src="robot.js" defer></script>';

  return (
    <div className="space-y-3" data-testid="studio-bots">
      <p className="text-[12.5px] leading-relaxed text-stone-600">{d('bot_intro')}</p>
      <div className={card}>
        <textarea className={`${field} min-h-[60px]`} value={idea} maxLength={1500} onChange={(e) => setIdea(e.target.value)} placeholder={d('bot_idea_ph')} aria-label={d('bot_idea_ph')} />
        <button type="button" className={strong} disabled={!idea.trim() || busy} onClick={() => void design()}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}{busy ? d('working') : d('idea_go')}</button>
        {note && <p className="rounded-xl bg-amber-50 px-3 py-2 text-[12.5px] font-bold text-amber-900" role="status">{note}</p>}
      </div>

      <div className="grid gap-3 lg:grid-cols-[1fr_360px]">
        <div className="space-y-2">
          <div className={card}>
            <p className={label}>{d('bot_kind')}</p>
            <Chips name={d('bot_kind')} value={bot.kind} onChange={switchKind} options={BOT_KINDS.map((k) => ({ id: k, label: d(`k_${k}` as DesignKey) }))} />
            <div className="grid gap-2 sm:grid-cols-2">
              <label className={label}>{d('bot_name')}<input className={`${field} mt-1`} value={bot.name} maxLength={40} onChange={(e) => set('name', e.target.value)} /></label>
              <label className="inline-flex items-center gap-2 text-[12.5px] font-bold text-stone-700">{d('bot_color')}<input type="color" value={bot.color} onChange={(e) => set('color', e.target.value)} className="h-8 w-10 cursor-pointer rounded border border-stone-200" /></label>
            </div>
            <p className={label}>{d('bot_avatar')}</p>
            <div className="flex flex-wrap gap-1">{AVATARS.map((a) => <button key={a} type="button" aria-pressed={bot.avatar === a} onClick={() => set('avatar', a)} className={`h-9 w-9 rounded-xl text-lg cursor-pointer ${bot.avatar === a ? 'bg-amber-100 ring-2 ring-amber-500' : 'bg-stone-50 hover:bg-stone-100'}`}>{a}</button>)}</div>
            <p className={label}>{d('bot_tone')}</p>
            <Chips name={d('bot_tone')} value={bot.tone} onChange={(v) => set('tone', v)} options={BOT_TONES.map((t) => ({ id: t, label: d(`t_${t}` as DesignKey) }))} />
            <label className={label}>{d('bot_role')}<input className={`${field} mt-1`} value={bot.role} maxLength={400} onChange={(e) => set('role', e.target.value)} /></label>
            <label className={label}>{d('bot_greeting')}<input className={`${field} mt-1`} value={bot.greeting} maxLength={400} onChange={(e) => set('greeting', e.target.value)} /></label>
            <label className={label}>{d('bot_quick')}<textarea className={`${field} mt-1`} rows={3} value={quickText} onChange={(e) => { setQuickText(e.target.value); set('quick', lines(e.target.value).slice(0, 6).map((x) => x.slice(0, 40))); }} /></label>
            <label className={label}>{d('bot_rules')}<textarea className={`${field} mt-1`} rows={3} value={rulesText} onChange={(e) => { setRulesText(e.target.value); set('rules', lines(e.target.value).slice(0, 20)); }} /></label>
          </div>

          <div className={card}>
            <p className={label}>{d('bot_faq')}</p>
            {bot.faq.map((f, i) => (
              <div key={i} className="grid gap-1.5 rounded-xl bg-stone-50 p-2 sm:grid-cols-[1fr_1.4fr_auto]">
                <input className={field} value={f.q} maxLength={200} placeholder={d('bot_q')} aria-label={d('bot_q')} onChange={(e) => setFaq(i, 'q', e.target.value)} />
                <textarea className={field} rows={1} value={f.a} maxLength={1200} placeholder={d('bot_a')} aria-label={d('bot_a')} onChange={(e) => setFaq(i, 'a', e.target.value)} />
                <button type="button" aria-label={st('remove')} title={st('remove')} onClick={() => set('faq', bot.faq.filter((_, n) => n !== i))} className="self-center rounded-lg p-2 text-red-700 hover:bg-red-50 cursor-pointer"><Trash2 className="h-4 w-4" /></button>
              </div>
            ))}
            <button type="button" className={soft} disabled={bot.faq.length >= 40} onClick={() => set('faq', [...bot.faq, { q: '', a: '' }])}><Plus className="h-4 w-4" />{d('bot_add_q')}</button>
          </div>

          <div className={card}>
            <p className={label}>{d('bot_collect')}</p>
            <label className={label}>{d('bot_trigger')}<input className={`${field} mt-1`} value={bot.collect.trigger} maxLength={200} onChange={(e) => set('collect', { ...bot.collect, trigger: e.target.value })} /></label>
            <label className={label}>{d('bot_fields')}<textarea className={`${field} mt-1`} rows={3} value={fieldsText} onChange={(e) => { setFieldsText(e.target.value); set('collect', { ...bot.collect, fields: lines(e.target.value).slice(0, 8).map((l): BotField => ({ label: l.slice(0, 120), kind: kindOf(l) })) }); }} /></label>
            <div className="grid gap-2 sm:grid-cols-2">
              <label className={label}>{d('bot_whatsapp')}<input className={`${field} mt-1`} dir="ltr" inputMode="tel" value={bot.handoff.whatsapp} maxLength={15} placeholder="2010…" onChange={(e) => set('handoff', { ...bot.handoff, whatsapp: e.target.value.replace(/\D/g, '') })} /></label>
              <label className={label}>{d('bot_email')}<input className={`${field} mt-1`} dir="ltr" type="email" value={bot.handoff.email} maxLength={120} onChange={(e) => set('handoff', { ...bot.handoff, email: e.target.value.trim() })} /></label>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm lg:sticky lg:top-3" dir={bot.rtl ? 'rtl' : 'ltr'}>
            <div className="flex items-center gap-2 px-3 py-2.5 text-white" style={{ background: bot.color }}>
              <span className="text-xl" aria-hidden>{bot.avatar}</span><b className="grow truncate text-[14px]">{bot.name}</b>
              <button type="button" aria-label={d('bot_restart')} title={d('bot_restart')} onClick={() => restart()} className="rounded-lg p-1 hover:bg-white/20 cursor-pointer"><RotateCcw className="h-4 w-4" /></button>
            </div>
            <p className="bg-amber-50 px-3 py-1.5 text-[11px] font-bold text-amber-900">{d('bot_try')}</p>
            <div ref={logRef} className="flex h-72 flex-col gap-1.5 overflow-y-auto bg-stone-50 p-3" aria-live="polite">
              {log.map((l, i) => (
                <React.Fragment key={i}>
                  <div className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-[13px] ${l.from === 'me' ? 'self-end text-white' : 'self-start border border-stone-200 bg-white'}`} style={l.from === 'me' ? { background: bot.color } : undefined}>{l.text}</div>
                  {l.link && <a href={l.link} target="_blank" rel="noopener noreferrer" className="self-start rounded-xl bg-emerald-600 px-3 py-1.5 text-[12.5px] font-bold text-white">{l.linkLabel || '↗'}</a>}
                </React.Fragment>
              ))}
            </div>
            {bot.quick.length > 0 && <div className="flex flex-wrap gap-1 bg-stone-50 px-3 pb-2">{bot.quick.map((q) => <button key={q} type="button" onClick={() => talk(q)} className="rounded-full border bg-white px-2.5 py-1 text-[11.5px] font-bold cursor-pointer" style={{ borderColor: bot.color, color: bot.color }}>{q}</button>)}</div>}
            <form className="flex gap-1.5 border-t border-stone-200 p-2" onSubmit={(e) => { e.preventDefault(); talk(msg); }}>
              <input className={field} value={msg} maxLength={500} onChange={(e) => setMsg(e.target.value)} placeholder={bot.texts.placeholder} aria-label={bot.texts.placeholder} />
              <button type="submit" className="rounded-xl px-3 text-white cursor-pointer" style={{ background: bot.color }} aria-label={bot.texts.send}><Send className="h-4 w-4" /></button>
            </form>
          </div>

          <div className={card}>
            <p className={label}>{d('bot_get')}</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" className={strong} onClick={() => downloadBlob(new Blob([script], { type: 'text/javascript;charset=utf-8' }), 'robot.js')}><Download className="h-4 w-4" />{d('bot_script')}</button>
              <button type="button" className={soft} onClick={() => downloadBlob(new Blob([demo], { type: 'text/html;charset=utf-8' }), 'robot-demo.html')}><Download className="h-4 w-4" />{d('bot_demo')}</button>
              <button type="button" className={soft} onClick={() => onOpenCode(demo)}><Code2 className="h-4 w-4" />{d('open_code')}</button>
            </div>
            <p className="text-[12px] font-bold text-stone-700">{d('bot_snippet')}</p>
            <CodeBox code={snippet} rows={1} />
            <CopyButton text={snippet} label={d('copy')} done={d('copied')} />
            <details className="text-[12.5px]">
              <summary className="cursor-pointer font-bold text-stone-700">{d('bot_prompt')}</summary>
              <CodeBox code={prompt} rows={8} />
              <CopyButton text={prompt} label={d('copy')} done={d('copied')} />
            </details>
            <button type="button" className={soft} onClick={() => downloadBlob(new Blob([JSON.stringify(bot, null, 2)], { type: 'application/json' }), 'robot.json')}><Download className="h-4 w-4" />{d('bot_json')}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
