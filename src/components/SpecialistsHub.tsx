/**
 * «مجلس المتخصصين» — أيقونة «استشير متخصصاً» في كل أقسام الموقع.
 *
 * بقت **وكيل ذكاء اصطناعي** (server/specialists/agent.ts): يسأل، يوجّه السؤال لمتخصصه من المجلس،
 * يشتغل بأدواته (علوم المدرسة، الذاكرة، المكتبة، موسوعة المواد، حاسبات المعمل، المتجر، الأخبار،
 * الملجأ، المصادر المفتوحة، الوسايط، والتسليم)، ويرد من ملاحظاتها بس — وكل رد مكتوب عليه مصدره
 * والأدوات اللي اشتغلت فيه، والخطوات التالية للزائر.
 *
 * ولو السيرفر مش متاح (من غير إنترنت، أو نسخة GitHub Pages من غير API) الواجهة ترد **محلياً**
 * من ذاكرة المتصفح ومكتبة شاهين وملجئه — نفس رد المجلس القديم، بصراحة إنه من غير وكيل. مافيش تخمين.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Bot, Check, Copy, ExternalLink, Loader2, MapPin, Send, Sparkles, Users, WifiOff, Wrench, X } from 'lucide-react';
import {
  consult, pickSpecialist, primaryOf, SITE_SECTIONS, SPECIALISTS, specialistOf, specialistsOf,
  type Consultation, type Specialist, type SpecialistId,
} from '../utils/shaheenSpecialists';
import { browserMemory } from '../utils/browserMemory';
import { refugeWay } from '../utils/shaheenRefuge';
import { ApiError } from '../utils/api';
import {
  askSpecialists, loadSpecialistsBoard,
  type SpecialistAction, type SpecialistReply, type SpecialistsBoard, type ToolCitation,
} from '../utils/specialistsClient';
import { ShaheenMarkdown } from './ShaheenMarkdown';
import { AIDisclosureBadge } from './LegalDisclaimer';
import type { SupportedLanguage } from '../types/i18n';

const AR = {
  open: 'استشير متخصصاً',
  title: 'مجلس المتخصصين — وكيل ذكي',
  subtitle: 'اسأل أي سؤال: الوكيل يوجّهه لمتخصصه، يشتغل بأدواته (علوم المدرسة، الذاكرة، المكتبة، موسوعة المواد، حاسبات المعمل، المتجر، الأخبار، الملجأ، والمصادر المفتوحة)، ويرد بمصدره. واسأل «وين ألاقي…» فيوصلك الملجأ لأي حاجة.',
  currentSection: 'قسم الموقع الحالي',
  suggested: 'المقترح لقسمك',
  ask: 'اسأل الوكيل',
  placeholder: 'اكتب سؤالك هنا… (مثال: احسب مقادير 50 مل بتركيز 20%، أو إيه هو الأمبروكسان؟)',
  send: 'اسأل',
  asking: 'الوكيل بيشتغل بأدواته…',
  another: 'سؤال تاني',
  clear: 'محادثة جديدة',
  agentOn: 'وكيل ذكي متصل',
  agentOff: 'من غير إنترنت — رد محلي',
  toolsUsed: 'الأدوات اللي اشتغلت',
  sourcesTitle: 'مصادر الرد',
  actionsTitle: 'خطوتك الجاية',
  followUps: 'أسئلة تكمل بيها',
  copy: 'انسخ الرد',
  copied: 'اتنسخ',
  openTab: 'افتح',
  openChat: 'كمّل مع الخبير شاهين',
  handOver: 'سلّم لـ',
  recorded: 'اتسجل السؤال لمدرسة شاهين وهيذاكره',
  studying: 'المتخصص حوّل سؤالك لخبير المدرسة يذاكره — يرد أوفى المرة الجاية',
  clarify: 'محتاج توضيح منك — دي مش إجابة',
  offlineNote: 'السيرفر مش متاح دلوقتي — الرد من ذاكرة المتصفح ومكتبة شاهين وملجئه (من غير وكيل).',
  busyNote: 'الخدمة مشغولة دلوقتي — استنى دقيقة وجرّب تاني. الرد ده من المصادر المحلية.',
  failedNote: 'حصل خطأ في الاتصال — الرد ده من المصادر المحلية.',
  boardTitle: 'المتخصصين العشرة',
  toolsCount: 'أدوات الوكيل',
  sciences: 'العلوم',
  available: 'متاح الآن',
  pick: 'اختار المتخصص بنفسك أو اسأل والباقي على التوجيه',
  sectionsCount: 'يستشار لأقسام',
  agentLabel: 'وكيل',
  sourceRefuge: 'المصدر: ملجأ شاهين (الوصول لأي حاجة)',
  sourceMemory: 'المصدر: ذاكرة شاهين',
  sourceLibrary: 'المصدر: مكتبة شاهين',
  sourceGap: 'محتاج مذاكرة — الصراحة أحسن من التخمين',
};
const EN = {
  open: 'Consult a specialist',
  title: "The specialists' board — an agent",
  subtitle: "Ask anything: the agent routes it to its specialist, works with his tools (school sciences, memory, library, materials encyclopaedia, lab calculators, store, news, refuge, open sources) and answers with its source. Ask “where do I find…” and the refuge takes you anywhere.",
  currentSection: 'Current section',
  suggested: 'Suggested for your section',
  ask: 'Ask the agent',
  placeholder: 'Write your question… (e.g. compute 50 ml at 20% concentration, or what is ambroxan?)',
  send: 'Ask',
  asking: 'The agent is working with its tools…',
  another: 'Another question',
  clear: 'New conversation',
  agentOn: 'Agent online',
  agentOff: 'Offline — local answer',
  toolsUsed: 'Tools that ran',
  sourcesTitle: 'Answer sources',
  actionsTitle: 'Your next step',
  followUps: 'Follow-up questions',
  copy: 'Copy the answer',
  copied: 'Copied',
  openTab: 'Open',
  openChat: 'Continue with Master Shaheen',
  handOver: 'Hand over to',
  recorded: 'The question was noted for the school to study',
  studying: 'The specialist sent your question to the school’s expert to study — a fuller answer next time',
  clarify: 'Needs your clarification — this is not an answer',
  offlineNote: "The server is unreachable right now — this answer comes from the browser's memory, Shaheen's library and refuge (no agent).",
  busyNote: 'The service is busy — wait a minute and try again. This answer is from the local sources.',
  failedNote: 'A connection error happened — this answer is from the local sources.',
  boardTitle: 'The ten specialists',
  toolsCount: 'Agent tools',
  sciences: 'Sciences',
  available: 'Available now',
  pick: 'Pick a specialist yourself, or just ask and routing will choose',
  sectionsCount: 'Consults for',
  agentLabel: 'Agent',
  sourceRefuge: 'Source: the refuge (reach anything)',
  sourceMemory: "Source: Shaheen's memory",
  sourceLibrary: "Source: Shaheen's library",
  sourceGap: 'Needs studying — honesty beats guessing',
};

/** مصدر الرد كما يظهر للزائر (نفس مفاتيح السيرفر: AnswerSource). */
const SOURCE_AR: Record<string, string> = {
  science: 'علوم شاهين', academy: 'منهج مدرسة شاهين', memory: 'ذاكرة شاهين', library: 'مكتبة شاهين',
  material: 'موسوعة المواد الخام', refuge: 'ملجأ شاهين', calculator: 'حاسبات معمل شام', store: 'متجر شام',
  news: 'نشرة الأخبار', research: 'المصادر المفتوحة', knowledge: 'قاعدة معرفة شام', agent: 'وكيل المتخصصين', gap: 'محتاج مذاكرة',
};
const SOURCE_EN: Record<string, string> = {
  science: "Shaheen's sciences", academy: 'the school curriculum', memory: "Shaheen's memory", library: "Shaheen's library",
  material: 'the raw-materials encyclopaedia', refuge: 'the refuge', calculator: 'the Sham lab calculators', store: 'the Sham store',
  news: 'the news bulletin', research: 'open sources', knowledge: 'the Sham knowledge base', agent: 'the specialists agent', gap: 'needs studying',
};

const SOURCES = {
  refuge: (question: string, lang: string) => refugeWay(question, lang),
  recall: (question: string, lang: string) => browserMemory.recall(question, lang),
  library: (question: string, lang: string) => browserMemory.library?.(question, lang),
};

interface Turn {
  id: number;
  role: 'visitor' | 'agent';
  question?: string;
  reply?: SpecialistReply;
  /** رد المجلس المحلي (من غير سيرفر). */
  local?: Consultation;
  pending?: boolean;
  /** ملاحظة صريحة للزائر: من غير إنترنت/مشغول/خطأ. */
  note?: string;
}

export interface SpecialistsHubProps {
  /** قسم الموقع الحالي — يقترح المستشار الرئيسي للقسم. */
  section?: string;
  lang?: string;
}

export default function SpecialistsHub({ section, lang }: SpecialistsHubProps) {
  const isEn = (lang ?? 'ar').startsWith('en');
  const t = isEn ? EN : AR;
  const badgeLang: SupportedLanguage = isEn ? 'en' : 'ar';
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<SpecialistId | undefined>(undefined);
  const [question, setQuestion] = useState('');
  const [turns, setTurns] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);
  const [board, setBoard] = useState<SpecialistsBoard | undefined>(undefined);
  const [showBoardList, setShowBoardList] = useState(false);
  const [copied, setCopied] = useState<number | undefined>(undefined);
  const listRef = useRef<HTMLDivElement | null>(null);
  const ids = useRef(1);

  // لوحة المجلس (المتخصصين + أدوات الوكيل) بتتحمّل مرة واحدة لما الزائر يفتح الأيقونة.
  useEffect(() => {
    if (!open || board) return;
    let alive = true;
    void loadSpecialistsBoard().then((b) => { if (alive && b) setBoard(b); });
    return () => { alive = false; };
  }, [open, board]);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [turns, busy, open]);

  const sectionInfo = useMemo(() => SITE_SECTIONS.find((s) => s.id === section), [section]);
  const suggested = useMemo(() => (section ? primaryOf(section) : undefined), [section]);
  const active = useMemo<Specialist | undefined>(
    () => (picked && specialistOf(picked)) || (question.trim() ? pickSpecialist(question, section) : suggested),
    [picked, question, section, suggested],
  );
  const toolCount = board?.toolCount ?? 0;

  /** آخر كام سؤال ورد — عشان الوكيل يفهم المتابعة («والتاني؟»). */
  const history = useMemo(() => {
    const out: { role: 'user' | 'assistant'; text: string }[] = [];
    for (const turn of turns.slice(-8)) {
      if (turn.role === 'visitor' && turn.question) out.push({ role: 'user', text: turn.question });
      const answer = turn.reply?.answer || turn.local?.answer;
      if (turn.role === 'agent' && answer) out.push({ role: 'assistant', text: answer });
    }
    return out;
  }, [turns]);

  const localAnswer = (q: string) => consult(q, isEn ? 'en' : 'ar', SOURCES, section, picked);

  const ask = async (raw?: string) => {
    const q = (raw ?? question).trim();
    if (!q || busy) return;
    setQuestion('');
    setBusy(true);
    const visitorIdTurn = ids.current++;
    const agentTurn = ids.current++;
    setTurns((prev) => [...prev, { id: visitorIdTurn, role: 'visitor', question: q }, { id: agentTurn, role: 'agent', pending: true }]);
    const settle = (patch: Partial<Turn>) => setTurns((prev) => prev.map((x) => (x.id === agentTurn ? { ...x, pending: false, ...patch } : x)));
    try {
      const reply = await askSpecialists({ question: q, lang: isEn ? 'en' : 'ar', ...(section ? { section } : {}), ...(picked ? { specialist: picked } : {}), history });
      if (reply) { settle({ reply }); return; }
      settle({ local: await localAnswer(q), note: t.offlineNote });
    } catch (err) {
      // السيرفر رد بخطأ (مشغول/سؤال مرفوض/خلل) — نقول الحقيقة ونرد من المصادر المحلية.
      const note = err instanceof ApiError && err.status === 429 ? t.busyNote : t.failedNote;
      try { settle({ local: await localAnswer(q), note }); } catch { settle({ note }); }
    } finally {
      setBusy(false);
    }
  };

  const doAction = (a: SpecialistAction) => {
    if (a.type === 'open_tab') { window.location.hash = `#${a.tab}`; setOpen(false); return; }
    if (a.type === 'open_chat') {
      window.dispatchEvent(new CustomEvent('open-ai-chat-with-prompt', { detail: a.prompt }));
      setOpen(false);
      return;
    }
    if (a.type === 'hand_over') {
      if (a.to === 'sham') {
        window.dispatchEvent(new CustomEvent('open-sham-assistant', { detail: question.trim() || turns.filter((x) => x.question).pop()?.question || '' }));
        setOpen(false);
        return;
      }
      if (a.to === 'shaheen') {
        window.dispatchEvent(new CustomEvent('open-ai-chat-with-prompt', { detail: turns.filter((x) => x.question).pop()?.question || '' }));
        setOpen(false);
        return;
      }
      setPicked(a.to as SpecialistId); // متخصص تاني من المجلس: يكمل معاه هنا
      setShowBoardList(false);
    }
  };

  const copy = async (turn: Turn) => {
    const text = turn.reply?.answer || turn.local?.answer || '';
    try { await navigator.clipboard.writeText(text); setCopied(turn.id); setTimeout(() => setCopied(undefined), 1600); } catch { /* المتصفح رافض — مفيش حاجة تتنسخ */ }
  };

  const localSourceLabel = (c: Consultation) => (c.source === 'refuge' ? t.sourceRefuge : c.source === 'memory' ? t.sourceMemory : c.source === 'library' ? t.sourceLibrary : t.sourceGap);
  const sourceLabel = (source: string) => `${isEn ? 'Source' : 'المصدر'}: ${isEn ? (SOURCE_EN[source] || source) : (SOURCE_AR[source] || source)}`;

  return (
    <>
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 no-print">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-2 rounded-full bg-emerald-700 hover:bg-emerald-800 text-white shadow-xl px-5 py-3 text-sm font-bold"
          aria-label={t.open}
        >
          <Users className="w-5 h-5" />
          <span>{t.open}</span>
          <span className="flex items-center gap-1 rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-bold">
            <Sparkles className="w-3 h-3" />{t.agentLabel}
          </span>
        </button>
      </div>

      {open && (
        <div
          dir={isEn ? 'ltr' : 'rtl'}
          className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 w-[min(94vw,600px)] h-[min(80vh,680px)] bg-stone-50 rounded-3xl shadow-2xl border border-stone-200 flex flex-col overflow-hidden no-print"
        >
          <div className="flex items-start justify-between gap-2 px-4 py-3 bg-emerald-800 text-white">
            <div>
              <h2 className="font-bold text-sm flex items-center gap-1.5">
                <Bot className="w-4 h-4" />{t.title}
                {toolCount > 0 && <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px]">{toolCount} {t.toolsCount}</span>}
              </h2>
              <p className="text-[11px] text-emerald-100 leading-relaxed">{t.subtitle}</p>
            </div>
            <button type="button" onClick={() => setOpen(false)} className="p-1 rounded-full hover:bg-white/15" aria-label="close">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {sectionInfo && (
              <p className="text-[11px] text-stone-500">
                {t.currentSection}: <b className="text-stone-700">{isEn ? sectionInfo.titleEn : sectionInfo.titleAr}</b>
                {suggested && <> — {t.suggested}: <b className="text-emerald-800">{isEn ? suggested.nameEn.split(' — ')[0] : suggested.nameAr}</b></>}
              </p>
            )}

            {turns.length === 0 && (
              <div className="flex flex-wrap gap-1.5">
                {specialistsOf(section ?? '').map((s) => (
                  <span key={s.id} className="text-[10px] rounded-full bg-emerald-100 text-emerald-900 px-2 py-0.5">
                    {isEn ? s.nameEn.split(' — ')[0] : s.nameAr}
                  </span>
                ))}
              </div>
            )}

            {turns.map((turn) => (turn.role === 'visitor' ? (
              <div key={turn.id} className="flex justify-end">
                <p className="max-w-[85%] rounded-2xl rounded-te-sm bg-emerald-700 text-white px-3 py-2 text-sm">{turn.question}</p>
              </div>
            ) : (
              <div key={turn.id} className="space-y-2">
                {turn.pending ? (
                  <div className="flex items-center gap-2 rounded-2xl bg-white border border-stone-200 px-3 py-3 text-xs text-stone-600">
                    <Loader2 className="w-4 h-4 animate-spin text-emerald-700" />
                    <span className="font-bold">{t.asking}</span>
                    {active && <span className="text-stone-500">{isEn ? active.nameEn.split(' — ')[0] : active.nameAr}</span>}
                  </div>
                ) : (
                  <>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="text-xs font-bold text-emerald-900">
                        {isEn ? (turn.reply?.specialist.nameEn ?? turn.local?.specialist.nameEn) : (turn.reply?.specialist.nameAr ?? turn.local?.specialist.nameAr)}
                        {' — '}
                        {isEn ? (turn.reply?.specialist.fieldEn ?? turn.local?.specialist.fieldEn) : (turn.reply?.specialist.fieldAr ?? turn.local?.specialist.fieldAr)}
                      </p>
                      {turn.reply?.ai
                        ? <span className="flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-900 px-2 py-0.5 text-[10px] font-bold"><Sparkles className="w-3 h-3" />{t.agentOn}</span>
                        : <span className="flex items-center gap-1 rounded-full bg-stone-200 text-stone-700 px-2 py-0.5 text-[10px] font-bold"><WifiOff className="w-3 h-3" />{t.agentOff}</span>}
                    </div>

                    <div className="rounded-2xl rounded-ts-sm bg-white border border-stone-200 p-3 text-sm leading-relaxed text-stone-800">
                      <ShaheenMarkdown text={turn.reply?.answer || turn.local?.answer || ''} className="font-sans" />
                    </div>

                    <p className={`text-[11px] font-bold ${(turn.reply?.ok ?? turn.local?.ok) ? 'text-emerald-700' : 'text-amber-700'}`}>
                      {turn.reply ? sourceLabel(turn.reply.source) : turn.local ? localSourceLabel(turn.local) : ''}
                      {turn.reply?.recorded ? ` · ${t.recorded}` : ''}
                      {turn.reply?.studying ? ` · ${t.studying}` : ''}
                      {turn.reply?.clarify ? ` · ${t.clarify}` : ''}
                    </p>

                    {turn.note && (
                      <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-2 py-1.5">{turn.note}</p>
                    )}

                    {Boolean(turn.reply?.tools?.length) && (
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-stone-500 flex items-center gap-1"><Wrench className="w-3 h-3" />{t.toolsUsed} ({turn.reply!.tools.length})</p>
                        <div className="flex flex-wrap gap-1">
                          {turn.reply!.tools.map((tool, i) => (
                            <span key={`${tool.tool}-${i}`} className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] ${tool.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-stone-100 text-stone-500'}`}>
                              {tool.ok ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                              {isEn ? tool.labelEn : tool.labelAr}
                              <span className="text-stone-400">{tool.ms}ms</span>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {Boolean(turn.reply?.citations?.length) && (
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-stone-500">{t.sourcesTitle}</p>
                        <div className="flex flex-wrap gap-1">
                          {turn.reply!.citations.map((c: ToolCitation) => (c.kind === 'source' && /^https?:\/\//.test(c.id) ? (
                            <a key={c.id} href={c.id} target="_blank" rel="noreferrer noopener" className="flex items-center gap-1 rounded-full bg-sky-50 text-sky-800 px-2 py-0.5 text-[10px] hover:underline">
                              <ExternalLink className="w-3 h-3" />{c.title}
                            </a>
                          ) : (
                            <span key={c.id} className="rounded-full bg-stone-100 text-stone-700 px-2 py-0.5 text-[10px]">{c.title}</span>
                          )))}
                        </div>
                      </div>
                    )}

                    {Boolean(turn.reply?.actions?.length) && (
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-stone-500">{t.actionsTitle}</p>
                        <div className="flex flex-wrap gap-1.5">
                          {turn.reply!.actions.map((a, i) => {
                            if (a.type === 'media') {
                              return (
                                <span key={i} className="flex flex-wrap gap-1.5">
                                  {(a.images || []).map((img) => (
                                    <a key={img.url} href={img.url} target="_blank" rel="noreferrer noopener" className="block rounded-xl overflow-hidden border border-stone-200 bg-white">
                                      <img src={img.url} alt={img.title} loading="lazy" className="h-20 w-28 object-cover" />
                                      {img.credit && <span className="block px-1 py-0.5 text-[9px] text-stone-500">{img.credit}</span>}
                                    </a>
                                  ))}
                                  {(a.places || []).map((p) => (
                                    <a
                                      key={`${p.lat}-${p.lon}`}
                                      href={`https://www.openstreetmap.org/?mlat=${p.lat}&mlon=${p.lon}#map=14/${p.lat}/${p.lon}`}
                                      target="_blank" rel="noreferrer noopener"
                                      className="flex items-center gap-1 rounded-full bg-stone-100 text-stone-700 px-2 py-1 text-[10px] hover:bg-stone-200"
                                    >
                                      <MapPin className="w-3 h-3" />{p.label}
                                    </a>
                                  ))}
                                </span>
                              );
                            }
                            const label = a.type === 'open_tab' ? `${t.openTab} ${a.title || a.tab}`
                              : a.type === 'open_chat' ? (a.title || t.openChat)
                                : `${t.handOver} ${a.title || a.to}`;
                            return (
                              <button
                                key={i}
                                type="button"
                                onClick={() => doAction(a)}
                                className="rounded-full bg-emerald-700 hover:bg-emerald-800 text-white px-3 py-1.5 text-[11px] font-bold"
                              >
                                {label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {Boolean(turn.reply?.followUps?.length) && (
                      <div className="flex flex-wrap gap-1.5">
                        {turn.reply!.followUps.map((f) => (
                          <button
                            key={f}
                            type="button"
                            disabled={busy}
                            onClick={() => void ask(f)}
                            className="rounded-full border border-emerald-300 bg-white text-emerald-800 px-2.5 py-1 text-[11px] hover:bg-emerald-50 disabled:opacity-50"
                          >
                            {f}
                          </button>
                        ))}
                      </div>
                    )}

                    <div className="flex items-center gap-3">
                      <button type="button" onClick={() => void copy(turn)} className="flex items-center gap-1 text-[11px] font-bold text-stone-500 hover:text-emerald-800">
                        {copied === turn.id ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        {copied === turn.id ? t.copied : t.copy}
                      </button>
                      {turn.reply?.ai && <AIDisclosureBadge lang={badgeLang} />}
                    </div>
                  </>
                )}
              </div>
            )))}
          </div>

          <div className="border-t border-stone-200 bg-white px-4 py-3 space-y-2">
            {active && (
              <p className="text-[11px] text-stone-600">
                {isEn ? active.nameEn : active.nameAr} — <span className="text-stone-500">{isEn ? active.sciencesEn : active.sciencesAr}</span>
                <span className="ms-1 text-[10px] text-emerald-700 font-bold">{t.available}</span>
              </p>
            )}
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void ask(); } }}
              placeholder={t.placeholder}
              aria-label={t.ask}
              rows={2}
              className="w-full rounded-2xl border border-stone-300 bg-white p-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void ask()}
                disabled={busy || !question.trim()}
                className="flex items-center gap-2 rounded-full bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white px-4 py-2 text-sm font-bold"
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {busy ? t.asking : t.send}
              </button>
              {turns.length > 0 && (
                <button type="button" onClick={() => { setTurns([]); setPicked(undefined); }} className="text-[11px] font-bold text-stone-500 hover:text-emerald-800 underline">
                  {t.clear}
                </button>
              )}
              <button type="button" onClick={() => setShowBoardList((v) => !v)} className="text-[11px] font-bold text-emerald-800 underline ms-auto">
                {t.boardTitle}
              </button>
            </div>

            {showBoardList && (
              <div className="max-h-52 overflow-y-auto border-t border-stone-200 pt-2">
                <p className="text-[11px] text-stone-500 mb-1">{t.pick}</p>
                <ul className="space-y-1.5">
                  {SPECIALISTS.map((s) => {
                    const owns = SITE_SECTIONS.filter((sec) => sec.consultants.includes(s.id));
                    return (
                      <li key={s.id}>
                        <button
                          type="button"
                          onClick={() => setPicked(picked === s.id ? undefined : s.id)}
                          className={`w-full text-start rounded-2xl border p-2.5 transition ${picked === s.id ? 'border-emerald-600 bg-emerald-50' : 'border-stone-200 bg-white hover:border-emerald-400'}`}
                        >
                          <p className="text-xs font-bold text-stone-800">
                            {isEn ? s.nameEn : s.nameAr} — {isEn ? s.fieldEn : s.fieldAr}
                            <span className={`text-[9px] rounded-full px-1.5 py-0.5 ms-2 ${picked === s.id ? 'bg-emerald-700 text-white' : 'bg-stone-100 text-stone-500'}`}>
                              {t.sectionsCount} {owns.length}
                            </span>
                          </p>
                          <p className="text-[10px] text-stone-500 leading-relaxed">{isEn ? s.sciencesEn : s.sciencesAr}</p>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
