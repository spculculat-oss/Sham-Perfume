import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Check, CheckCircle2, ChevronDown, Copy, Crown, ExternalLink, Headset, Loader2, MessageCircle, Mic, MicOff, PackageSearch, Pencil, RefreshCw, RotateCcw, Send,
  ShieldCheck, ShoppingBag, Sparkles, Square, ThumbsDown, ThumbsUp, Trash2, Users, Volume2, VolumeX, X,
} from 'lucide-react';
import type { SupportedLanguage } from '../types/i18n';
import { SUPPORTED_LANGUAGES } from '../types/i18n';
import { ApiError, ApiUnavailableError, isStaticHosting } from '../utils/api';
import { fmt, loc, makeT, type LText } from '../utils/localize';
import {
  assistantApi, CONVERSATION_KEY, streamChat, type ActionCard, type AssistantConfig, type ChatReply, type FormField, type ProductCard,
  type CouncilView, type PublicService, type PublicStep, type RequestView, type UiMessage,
} from './client';

const S = {
  open: { ar: 'مساعد شام للخدمات', en: 'Sham services assistant' },
  teaser: { ar: 'طلبات • متجر • دعم', en: 'Orders • Store • Support' },
  placeholder: { ar: 'اكتب سؤالك أو طلبك…', en: 'Type your question or request…' },
  send: { ar: 'إرسال', en: 'Send' },
  council_toggle: { ar: 'مجلس الخبراء: عدة مستشارين يتناقشوا قبل الرد', en: 'Expert council: several advisors discuss before answering' },
  council_on: { ar: 'وضع المجلس شغّال — {n} مستشارين هيكتبوا آراءهم ويراجعوا بعض، والرد هياخد وقت أطول شوية.', en: 'Council mode on — {n} advisors will give opinions and review each other; answers take a little longer.' },
  council_title: { ar: 'نقاش المجلس الاستشاري', en: 'Advisory council discussion' },
  council_meta: { ar: '{n} مستشارين · {r} جولة مراجعة', en: '{n} advisors · {r} review round(s)' },
  council_opinion: { ar: 'الرأي الأول', en: 'First opinion' },
  council_review: { ar: 'بعد مراجعة آراء الباقين', en: 'After reviewing the others' },
  council_chair: { ar: 'رئيس المجلس (كتب الرد)', en: 'Chair (wrote the answer)' },
  council_note: { ar: 'آراء آلية للاستئناس؛ الأسعار والمواعيد يؤكدها فريق شام فقط.', en: 'Automated opinions for guidance; prices and timelines are confirmed by the Sham team only.' },
  reset: { ar: 'محادثة جديدة', en: 'New conversation' },
  close: { ar: 'إغلاق', en: 'Close' },
  own_engine: { ar: 'محرك شام الذاتي', en: 'Sham built-in engine' },
  human: { ar: 'فريق شام', en: 'Sham team' },
  handoff_on: { ar: 'تم تحويلك لفريق شام — الردود ستظهر هنا', en: 'Handed to the Sham team — replies appear here' },
  sources: { ar: 'المصادر', en: 'Sources' },
  name: { ar: 'الاسم', en: 'Name' },
  phone: { ar: 'رقم الهاتف', en: 'Phone' },
  email: { ar: 'البريد الإلكتروني', en: 'Email' },
  phone_or_email: { ar: 'اكتب الهاتف أو البريد على الأقل', en: 'Provide at least phone or email' },
  submit: { ar: 'إرسال الطلب', en: 'Submit request' },
  submitted: { ar: 'تم تسجيل طلبك برقم', en: 'Your request reference is' },
  keep_ref: { ar: 'احتفظ بالرقم لتتبع الطلب. سيتواصل معك فريق شام للتأكيد.', en: 'Keep it to track your request. The Sham team will contact you to confirm.' },
  qty: { ar: 'الكمية', en: 'Qty' },
  out: { ar: 'غير متاح', en: 'Out of stock' },
  demo: { ar: 'تجريبي', en: 'Demo' },
  total: { ar: 'الإجمالي التقديري', en: 'Estimated total' },
  select_product: { ar: 'اختر منتجاً واحداً على الأقل', en: 'Select at least one product' },
  track_title: { ar: 'تتبع طلب', en: 'Track a request' },
  ref: { ar: 'رقم الطلب SH-XXXXXX', en: 'Reference SH-XXXXXX' },
  contact: { ar: 'الهاتف أو البريد المستخدم في الطلب', en: 'Phone or email used in the request' },
  track: { ar: 'تتبع', en: 'Track' },
  status: { ar: 'الحالة', en: 'Status' },
  open_tab: { ar: 'افتح الأداة', en: 'Open tool' },
  static: { ar: 'هذه نسخة ثابتة بلا خادم؛ مساعد الخدمات والطلبات يحتاج تشغيل خادم شام.', en: 'Static edition without a server; the services assistant needs the Sham server.' },
  error: { ar: 'تعذّر الاتصال بخادم شام. حاول مرة أخرى.', en: 'Could not reach the Sham server. Please try again.' },
  rate: { ar: 'رسائل كثيرة في وقت قصير، انتظر دقيقة من فضلك.', en: 'Too many messages — please wait a minute.' },
  not_found: { ar: 'لا يوجد طلب مطابق لهذا الرقم وبيانات التواصل.', en: 'No request matches this reference and contact.' },
  no_card: { ar: 'لا تكتب بيانات بطاقات بنكية أو كلمات مرور في المحادثة.', en: 'Never type card details or passwords in chat.' },
  thinking: { ar: 'المساعد يعمل على طلبك…', en: 'Working on it…' },
  steps: { ar: 'خطوات المعالجة', en: 'How I handled this' },
  helpful: { ar: 'رد مفيد', en: 'Helpful' },
  not_helpful: { ar: 'رد غير مفيد', en: 'Not helpful' },
  thanks_feedback: { ar: 'شكراً، تقييمك بيحسّن المساعد.', en: 'Thanks — your feedback improves the assistant.' },
  why: { ar: 'إيه المشكلة؟ (اختياري)', en: 'What went wrong? (optional)' },
  r_wrong: { ar: 'معلومة غير دقيقة', en: 'Inaccurate' },
  r_missed: { ar: 'لم يجب سؤالي', en: 'Did not answer' },
  r_long: { ar: 'طويل أو غير واضح', en: 'Too long / unclear' },
  send_feedback: { ar: 'إرسال التقييم', en: 'Send feedback' },
  read_aloud: { ar: 'اقرأ الرد بصوت', en: 'Read aloud' },
  stop_reading: { ar: 'إيقاف القراءة', en: 'Stop reading' },
  mic: { ar: 'تحدث بدلاً من الكتابة', en: 'Speak instead of typing' },
  mic_stop: { ar: 'إيقاف الاستماع', en: 'Stop listening' },
  privacy: { ar: 'خصوصيتي: ماذا تتذكر عني؟', en: 'Privacy: what do you remember?' },
  memory_title: { ar: 'ذاكرة المساعد عنك', en: 'What the assistant remembers' },
  memory_empty: { ar: 'لا يوجد شيء محفوظ عنك.', en: 'Nothing is stored about you.' },
  forget: { ar: 'امسح محادثاتي وذاكرتي', en: 'Erase my conversations & memory' },
  forget_confirm: { ar: 'متأكد؟ سيتم حذف محادثاتك وذاكرة المساعد نهائياً (طلباتك المسجلة تبقى لدى فريق شام).', en: 'Are you sure? Your conversations and memory will be deleted permanently (submitted requests stay with the Sham team).' },
  forgotten: { ar: 'تم الحذف. بدأنا من جديد.', en: 'Erased. Starting fresh.' },
  stop: { ar: 'إيقاف الرد', en: 'Stop generating' },
  stopped: { ar: 'تم إيقاف الرد', en: 'Response stopped' },
  regenerate: { ar: 'إعادة توليد الرد', en: 'Regenerate response' },
  edit: { ar: 'تعديل الرسالة', en: 'Edit message' },
  save_edit: { ar: 'حفظ وإرسال', en: 'Save & send' },
  cancel: { ar: 'إلغاء', en: 'Cancel' },
  copy: { ar: 'نسخ الرد', en: 'Copy' },
  copied: { ar: 'تم النسخ', en: 'Copied' },
  cannot_rewind: { ar: 'لا يمكن إعادة التوليد بعد رد فريق شام.', en: 'Cannot regenerate after a reply from the Sham team.' },
} satisfies Record<string, LText>;

export const STATUS_TEXT: Record<string, LText> = {
  new: { ar: 'جديد', en: 'New' }, in_progress: { ar: 'قيد التنفيذ', en: 'In progress' }, quoted: { ar: 'تم إرسال عرض سعر', en: 'Quoted' },
  confirmed: { ar: 'مؤكد', en: 'Confirmed' }, completed: { ar: 'مكتمل', en: 'Completed' }, cancelled: { ar: 'ملغي', en: 'Cancelled' },
};

const OPTION_TEXT: Record<string, LText> = {
  cash_on_delivery: { ar: 'الدفع عند الاستلام', en: 'Cash on delivery' }, bank_transfer: { ar: 'تحويل بنكي', en: 'Bank transfer' }, wallet: { ar: 'محفظة إلكترونية', en: 'Mobile wallet' },
  oriental: { ar: 'شرقي', en: 'Oriental' }, woody: { ar: 'خشبي', en: 'Woody' }, floral: { ar: 'زهري', en: 'Floral' }, citrus: { ar: 'حمضي', en: 'Citrus' },
  fresh: { ar: 'منعش', en: 'Fresh' }, gourmand: { ar: 'جورماند', en: 'Gourmand' }, oud: { ar: 'عود', en: 'Oud' }, unsure: { ar: 'غير متأكد', en: 'Not sure' },
};

const MEMORY_LABEL: Record<string, LText> = {
  name: { ar: 'الاسم', en: 'Name' }, lastService: { ar: 'آخر خدمة', en: 'Last service' }, lastRequestRef: { ar: 'آخر رقم طلب', en: 'Last request' },
};
const PRIVACY_PROMPT: LText = { ar: 'ماذا تعرف عني؟', en: 'What do you know about me?' };
const speechLang = (lang: SupportedLanguage) => (lang === 'ar' ? 'ar-EG' : lang);

// Minimal typing for the (prefixed) Web Speech recognition API, which is not in lib.dom for all browsers.
interface Recognition { lang: string; interimResults: boolean; continuous: boolean; start(): void; stop(): void; onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null; onend: (() => void) | null; onerror: (() => void) | null }
const RecognitionCtor = (): (new () => Recognition) | undefined => {
  if (typeof window === 'undefined') return undefined;
  const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
  return w.SpeechRecognition || w.webkitSpeechRecognition;
};

const SERVICE_ICON: Record<string, React.ReactNode> = {
  store: <ShoppingBag className="w-3.5 h-3.5" />, support: <Headset className="w-3.5 h-3.5" />,
};

interface Props { currentLang: SupportedLanguage }

const lastUserIndex = (list: UiMessage[]) => list.map((m) => m.role).lastIndexOf('user');

function errorText(lang: SupportedLanguage, error: unknown) {
  if (error instanceof ApiUnavailableError) return loc(lang, S.static);
  if (error instanceof ApiError && error.status === 429) return loc(lang, S.rate);
  if (error instanceof ApiError && error.code === 'CANNOT_REWIND') return loc(lang, S.cannot_rewind);
  return loc(lang, S.error);
}

export function ShamAssistant({ currentLang }: Props) {
  const L = makeT(currentLang, S);
  const rtl = SUPPORTED_LANGUAGES.find((l) => l.code === currentLang)?.dir === 'rtl';
  const [open, setOpen] = useState(false);
  const [config, setConfig] = useState<AssistantConfig | null>(null);
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [status, setStatus] = useState<'open' | 'handoff' | 'closed'>('open');
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [listening, setListening] = useState(false);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  // Advisory council mode (several AI models deliberate). Remembered for the browser session only.
  const [consult, setConsult] = useState(() => { try { return sessionStorage.getItem('sham_core_consult') === '1'; } catch { return false; } });
  const toggleConsult = () => setConsult((v) => { try { sessionStorage.setItem('sham_core_consult', v ? '0' : '1'); } catch { /* private mode */ } return !v; });
  const councilReady = Boolean(config?.council?.available);
  const consulting = consult && councilReady;
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const recognitionRef = useRef<Recognition | null>(null);
  const canListen = useMemo(() => Boolean(RecognitionCtor()), []);
  const canSpeak = typeof window !== 'undefined' && 'speechSynthesis' in window;

  // Restore the visitor's last conversation (local copy; the server is the source of truth).
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(CONVERSATION_KEY) || 'null');
      if (saved?.id && Array.isArray(saved.messages)) {
        setConversationId(saved.id);
        setMessages((saved.messages as UiMessage[]).filter((m) => !m.streaming));
        setStatus(saved.status || 'open');
      }
    } catch { /* ignore corrupted cache */ }
  }, []);
  useEffect(() => {
    try {
      if (conversationId) localStorage.setItem(CONVERSATION_KEY, JSON.stringify({ id: conversationId, status, messages: messages.filter((m) => !m.streaming).slice(-60) }));
    } catch { /* storage full or disabled */ }
  }, [conversationId, messages, status]);

  useEffect(() => {
    if (!open || config || isStaticHosting) return;
    assistantApi.config().then(setConfig).catch((e) => setError(errorText(currentLang, e)));
  }, [open, config, currentLang]);

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }); }, [messages, busy, open]);

  // Human handoff: poll for replies written by the team in the admin dashboard.
  useEffect(() => {
    if (!open || status !== 'handoff' || !conversationId) return;
    const timer = setInterval(() => {
      assistantApi.conversation(conversationId).then((data) => {
        setStatus(data.status);
        setMessages((current) => (data.messages.length > current.length ? data.messages : current));
      }).catch(() => { /* transient */ });
    }, 8000);
    return () => clearInterval(timer);
  }, [open, status, conversationId]);

  // Other parts of the site can open the assistant with a prefilled message.
  useEffect(() => {
    const handler = (event: Event) => {
      setOpen(true);
      const detail = (event as CustomEvent<string>).detail;
      if (typeof detail === 'string' && detail.trim()) setInput(detail);
    };
    window.addEventListener('open-sham-assistant', handler);
    return () => window.removeEventListener('open-sham-assistant', handler);
  }, []);

  /** `replaces` = text of the latest user message being regenerated/edited (rewind and re-ask). */
  const send = useCallback(async (text: string, replaces?: string) => {
    const message = text.trim();
    if (!message || busy) return;
    setError(''); setNotice('');
    if (replaces === undefined) setInput('');
    const draftId = `draft-${Date.now()}`;
    const at = new Date().toISOString();
    setMessages((m) => {
      const base = replaces !== undefined && lastUserIndex(m) >= 0 ? m.slice(0, lastUserIndex(m)) : m;
      return [...base, { role: 'user', text: message, at }, { id: draftId, role: 'assistant', text: '', at, steps: [], streaming: true }];
    });
    const patch = (fn: (m: UiMessage) => UiMessage) => setMessages((all) => all.map((x) => (x.id === draftId ? fn(x) : x)));
    setBusy(true);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      // Streaming first (live steps + tokens, like the big chat apps); plain JSON as a fallback.
      let streamed = false;
      let reply: ChatReply;
      try {
        reply = await streamChat(message, currentLang, conversationId, (event) => {
          streamed = true;
          if (event.type === 'step') patch((x) => ({ ...x, steps: [...(x.steps || []), event.step] }));
          else if (event.type === 'delta') patch((x) => ({ ...x, text: x.text + event.text }));
          else if (event.type === 'reset') patch((x) => ({ ...x, text: '' }));
        }, controller.signal, replaces, consulting);
      } catch (e) {
        const terminal = streamed || controller.signal.aborted || e instanceof ApiUnavailableError || (e instanceof ApiError && e.status < 500 && e.status !== 404);
        if (terminal) throw e;
        reply = await assistantApi.chat(message, currentLang, conversationId, controller.signal, replaces, consulting);
      }
      if (controller.signal.aborted) throw new DOMException('Stopped', 'AbortError');
      setConversationId(reply.conversationId);
      setStatus(reply.status);
      patch((x) => ({
        ...x, id: reply.messageId || draftId, text: reply.reply, engine: reply.engine.id, actions: reply.actions, citations: reply.citations,
        steps: reply.steps?.length ? reply.steps : x.steps, suggestions: reply.suggestions, streaming: false, council: reply.council,
      }));
    } catch (e) {
      if (controller.signal.aborted) {
        // Stopped by the visitor: keep what was already written (the server stores the same text).
        patch((x) => ({ ...x, streaming: false, stopped: true, text: x.text.trim() || loc(currentLang, S.stopped) }));
      } else {
        setMessages((all) => all.filter((x) => x.id !== draftId));
        setError(errorText(currentLang, e));
      }
    } finally {
      if (abortRef.current === controller) { abortRef.current = null; setBusy(false); }
    }
  }, [busy, conversationId, currentLang, consulting]);

  const stop = () => abortRef.current?.abort();
  const [editing, setEditing] = useState<string | null>(null);

  const stopSpeaking = () => { if (canSpeak) window.speechSynthesis.cancel(); setSpeakingId(null); };
  const speak = (m: UiMessage, key: string) => {
    if (!canSpeak) return;
    if (speakingId === key) { stopSpeaking(); return; }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(m.text.replace(/[*_#`>]/g, ''));
    utterance.lang = speechLang(currentLang);
    utterance.onend = () => setSpeakingId((id) => (id === key ? null : id));
    utterance.onerror = utterance.onend;
    setSpeakingId(key);
    window.speechSynthesis.speak(utterance);
  };

  const toggleMic = () => {
    if (listening) { recognitionRef.current?.stop(); return; }
    const Ctor = RecognitionCtor();
    if (!Ctor) return;
    const recognition = new Ctor();
    recognition.lang = speechLang(currentLang);
    recognition.interimResults = true;
    recognition.continuous = false;
    const base = input ? `${input.trim()} ` : '';
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results).map((r) => r[0]?.transcript || '').join('');
      setInput((base + transcript).slice(0, 2000));
    };
    recognition.onend = () => { setListening(false); recognitionRef.current = null; };
    recognition.onerror = recognition.onend;
    recognitionRef.current = recognition;
    setListening(true);
    recognition.start();
  };
  useEffect(() => () => { recognitionRef.current?.stop(); if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel(); }, []);
  useEffect(() => { if (!open) { recognitionRef.current?.stop(); stopSpeaking(); } }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const reset = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    stopSpeaking();
    setBusy(false);
    setMessages([]); setConversationId(undefined); setStatus('open'); setError(''); setNotice('');
    try { localStorage.removeItem(CONVERSATION_KEY); } catch { /* ignore */ }
  };

  const forgetEverything = async () => {
    try {
      await assistantApi.forget();
      reset();
      setNotice(L('forgotten'));
    } catch (e) { setError(errorText(currentLang, e)); }
  };

  const rate = async (m: UiMessage, rating: 'up' | 'down', reason?: string) => {
    if (!conversationId || !m.id) return;
    setMessages((all) => all.map((x) => (x.id === m.id ? { ...x, feedback: { rating } } : x)));
    try { await assistantApi.feedback(conversationId, m.id, rating, reason); }
    catch (e) { setMessages((all) => all.map((x) => (x.id === m.id ? { ...x, feedback: undefined } : x))); setError(errorText(currentLang, e)); }
  };

  const lastAssistantIndex = messages.reduce((last, m, i) => (m.role === 'assistant' ? i : last), -1);

  const name = config ? loc(currentLang, config.assistantName) : L('open');
  const welcome = config ? loc(currentLang, config.welcome) : '';

  return (
    <>
      <div className={`fixed bottom-6 ${rtl ? 'left-6' : 'right-6'} z-40 no-print flex items-center gap-2 ${rtl ? 'flex-row' : 'flex-row-reverse'}`}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label={L('open')}
          title={L('open')}
          className="relative w-14 h-14 rounded-full bg-gradient-to-br from-emerald-700 via-stone-900 to-amber-700 text-amber-100 shadow-xl border border-amber-300/50 flex items-center justify-center hover:scale-105 active:scale-95 transition"
        >
          {open ? <X className="w-6 h-6" /> : <MessageCircle className="w-6 h-6" />}
          {status === 'handoff' && !open && <span className="absolute -top-0.5 -end-0.5 w-3.5 h-3.5 rounded-full bg-emerald-400 border-2 border-white animate-pulse" />}
        </button>
        {!open && (
          <span className="hidden md:inline-flex text-[11px] font-semibold bg-white/95 text-stone-800 border border-stone-200 rounded-full px-3 py-1.5 shadow">
            {L('teaser')}
          </span>
        )}
      </div>

      <AnimatePresence>
        {open && (
          <motion.section
            dir={rtl ? 'rtl' : 'ltr'}
            role="dialog"
            aria-label={name}
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.97 }}
            transition={{ type: 'spring', damping: 26, stiffness: 300 }}
            className={`fixed z-50 bottom-24 ${rtl ? 'left-3 sm:left-6' : 'right-3 sm:right-6'} w-[calc(100vw-1.5rem)] sm:w-[420px] h-[min(78vh,680px)] bg-stone-50 rounded-3xl shadow-2xl border border-stone-200 flex flex-col overflow-hidden no-print`}
          >
            <header className="px-4 py-3 bg-stone-900 text-white flex items-center gap-3 shrink-0">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-500 to-amber-500 flex items-center justify-center"><Sparkles className="w-5 h-5" /></div>
              <div className="flex-1 min-w-0">
                <h2 className="font-bold text-sm truncate">{name}</h2>
                <p className="text-[10px] text-stone-300 truncate">Sham Core · {config?.modelEnhanced ? 'AI+' : L('own_engine')}</p>
              </div>
              <button type="button" onClick={() => void send(loc(currentLang, PRIVACY_PROMPT))} disabled={busy || isStaticHosting} title={L('privacy')} aria-label={L('privacy')} className="p-2 rounded-lg hover:bg-white/10 disabled:opacity-40"><ShieldCheck className="w-4 h-4" /></button>
              <button type="button" onClick={reset} title={L('reset')} aria-label={L('reset')} className="p-2 rounded-lg hover:bg-white/10"><RotateCcw className="w-4 h-4" /></button>
              <button type="button" onClick={() => setOpen(false)} title={L('close')} aria-label={L('close')} className="p-2 rounded-lg hover:bg-white/10"><X className="w-4 h-4" /></button>
            </header>

            {status === 'handoff' && (
              <div className="px-4 py-2 text-[11px] bg-emerald-50 text-emerald-900 border-b border-emerald-200 flex items-center gap-2"><Headset className="w-3.5 h-3.5" />{L('handoff_on')}</div>
            )}

            <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3" aria-live="polite">
              {isStaticHosting && <p className="text-xs rounded-xl border border-amber-300 bg-amber-50 p-3 text-amber-950">{L('static')}</p>}
              {!messages.length && welcome && (
                <div className="space-y-3">
                  <Bubble role="assistant" text={welcome} />
                  <div className="flex flex-wrap gap-1.5">
                    {config?.services.map((s) => (
                      <button key={s.id} type="button" onClick={() => send(currentLang === 'ar' || currentLang === 'fa' ? (s.kind === 'info' ? s.nameAr : `عايز ${s.nameAr}`) : (s.kind === 'info' ? s.nameEn : `I want ${s.nameEn}`))}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold rounded-full border border-amber-300 bg-white px-2.5 py-1.5 text-stone-800 hover:bg-amber-50">
                        {SERVICE_ICON[s.kind]}{currentLang === 'ar' || currentLang === 'fa' ? s.nameAr : s.nameEn}
                      </button>
                    ))}
                    <button type="button" onClick={() => send(currentLang === 'ar' || currentLang === 'fa' ? 'تتبع طلبي' : 'Track my order')}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold rounded-full border border-emerald-300 bg-white px-2.5 py-1.5 text-emerald-900 hover:bg-emerald-50">
                      <PackageSearch className="w-3.5 h-3.5" />{L('track_title')}
                    </button>
                  </div>
                </div>
              )}
              {notice && <p role="status" className="text-xs rounded-xl border border-emerald-200 bg-emerald-50 p-2.5 text-emerald-900">{notice}</p>}
              {messages.map((m, i) => (
                <div key={m.id || `${m.at}-${i}`} className="space-y-2">
                  {m.role === 'assistant' && m.steps && m.steps.length > 0 && <Steps steps={m.steps} live={Boolean(m.streaming)} lang={currentLang} />}
                  {m.role === 'user' && editing !== null && i === lastUserIndex(messages) ? (
                    <form className="flex flex-col items-end gap-1.5" onSubmit={(e) => { e.preventDefault(); const next = editing.trim(); setEditing(null); if (next && next !== m.text) void send(next, m.text); }}>
                      <textarea autoFocus value={editing} onChange={(e) => setEditing(e.target.value.slice(0, 2000))} rows={3} aria-label={L('edit')}
                        className="w-[88%] rounded-2xl border border-amber-400 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
                      <div className="flex gap-1.5">
                        <button type="button" onClick={() => setEditing(null)} className="text-[11px] rounded-lg border border-stone-300 px-2.5 py-1">{L('cancel')}</button>
                        <button className="text-[11px] font-bold rounded-lg bg-stone-900 text-amber-100 px-2.5 py-1">{L('save_edit')}</button>
                      </div>
                    </form>
                  ) : m.streaming && !m.text ? null : <Bubble role={m.role} text={m.text} engine={m.engine} lang={currentLang} streaming={m.streaming} stopped={m.stopped} />}
                  {m.role === 'user' && i === lastUserIndex(messages) && editing === null && !busy && status === 'open' && !isStaticHosting && (
                    <div className="flex justify-end px-1 -mt-1">
                      <button type="button" onClick={() => setEditing(m.text)} aria-label={L('edit')} title={L('edit')} className="p-1 rounded-md text-stone-400 hover:text-stone-700 hover:bg-stone-200"><Pencil className="w-3 h-3" /></button>
                    </div>
                  )}
                  {m.role === 'assistant' && !m.streaming && m.engine !== 'human' && m.engine !== 'system' && conversationId && (m.stopped || (m.id && !m.id.startsWith('draft-'))) && (
                    <MessageTools message={m} lang={currentLang} canSpeak={canSpeak} speaking={speakingId === (m.id || String(i))}
                      canRate={Boolean(m.id && !m.id.startsWith('draft-'))}
                      onRegenerate={i === lastAssistantIndex && !busy && status === 'open' && lastUserIndex(messages) >= 0 && lastUserIndex(messages) < i ? () => { const last = messages[lastUserIndex(messages)].text; void send(last, last); } : undefined}
                      onSpeak={() => speak(m, m.id || String(i))} onRate={(rating, reason) => void rate(m, rating, reason)} />
                  )}
                  {m.role === 'assistant' && !m.streaming && m.council && m.council.entries.length > 0 && <CouncilPanel council={m.council} lang={currentLang} />}
                  {m.citations && m.citations.length > 0 && (
                    <p className="text-[10px] text-stone-500 px-2">{L('sources')}: {m.citations.map((c) => c.title).join(' · ')}</p>
                  )}
                  {m.actions?.map((a, j) => (
                    <Action key={j} action={a} lang={currentLang} services={config?.services || []} conversationId={conversationId}
                      productsInMessage={m.actions?.find((x) => x.type === 'products')?.products}
                      onForget={forgetEverything}
                      onSubmitted={(request) => setMessages((all) => [...all, { role: 'assistant', text: `✅ ${loc(currentLang, S.submitted)} ${request.ref}`, at: new Date().toISOString(), engine: 'system', actions: [{ type: 'order_status', request }] }])} />
                  ))}
                  {i === lastAssistantIndex && !busy && !m.streaming && m.suggestions && m.suggestions.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 px-1">
                      {m.suggestions.map((sug) => (
                        <button key={sug} type="button" onClick={() => void send(sug)}
                          className="text-[11px] font-semibold rounded-full border border-amber-300 bg-amber-50/60 px-2.5 py-1 text-stone-800 hover:bg-amber-100">{sug}</button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              {busy && !messages.some((m) => m.streaming && (m.text || m.steps?.length)) && <div className="flex items-center gap-2 text-xs text-stone-500 px-2"><Loader2 className="w-4 h-4 animate-spin" />{L('thinking')}</div>}
              {error && <p role="alert" className="text-xs rounded-xl border border-red-200 bg-red-50 p-2.5 text-red-800">{error}</p>}
            </div>

            <form onSubmit={(e) => { e.preventDefault(); void send(input); }} className="p-3 border-t border-stone-200 bg-white shrink-0">
              <div className="flex items-end gap-2">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value.slice(0, 2000))}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape' && busy) { e.preventDefault(); stop(); return; }
                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(input); }
                  }}
                  rows={1}
                  placeholder={L('placeholder')}
                  aria-label={L('placeholder')}
                  disabled={isStaticHosting}
                  className="flex-1 resize-none max-h-28 rounded-2xl border border-stone-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
                {councilReady && (
                  <button type="button" onClick={toggleConsult} disabled={isStaticHosting || busy} aria-pressed={consulting} aria-label={L('council_toggle')} title={L('council_toggle')}
                    className={`h-10 w-10 shrink-0 rounded-full border flex items-center justify-center disabled:opacity-40 ${consulting ? 'bg-amber-500 border-amber-500 text-stone-950 ring-2 ring-amber-300' : 'border-stone-300 text-stone-600 hover:bg-stone-100'}`}>
                    <Users className="w-4 h-4" />
                  </button>
                )}
                {canListen && (
                  <button type="button" onClick={toggleMic} disabled={isStaticHosting} aria-pressed={listening} aria-label={listening ? L('mic_stop') : L('mic')} title={listening ? L('mic_stop') : L('mic')}
                    className={`h-10 w-10 shrink-0 rounded-full border flex items-center justify-center disabled:opacity-40 ${listening ? 'bg-red-600 border-red-600 text-white animate-pulse' : 'border-stone-300 text-stone-600 hover:bg-stone-100'}`}>
                    {listening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                  </button>
                )}
                {busy ? (
                  <button type="button" onClick={stop} aria-label={L('stop')} title={L('stop')}
                    className="h-10 w-10 shrink-0 rounded-full bg-stone-900 text-amber-200 flex items-center justify-center ring-2 ring-amber-300/60">
                    <Square className="w-3.5 h-3.5 fill-current" />
                  </button>
                ) : (
                  <button type="submit" disabled={!input.trim() || isStaticHosting} aria-label={L('send')}
                    className="h-10 w-10 shrink-0 rounded-full bg-stone-900 text-amber-200 flex items-center justify-center disabled:opacity-40">
                    <Send className={`w-4 h-4 ${rtl ? 'rotate-180' : ''}`} />
                  </button>
                )}
              </div>
              {consulting
                ? <p role="status" className="mt-1.5 text-[10px] font-semibold text-amber-800 flex items-center gap-1"><Users className="w-3 h-3 shrink-0" />{fmt(L('council_on'), { n: config?.council?.seats || 2 })}</p>
                : <p className="mt-1.5 text-[10px] text-stone-400">{L('no_card')}</p>}
            </form>
          </motion.section>
        )}
      </AnimatePresence>
    </>
  );
}

function Bubble({ role, text, engine, lang = 'ar', streaming, stopped }: { role: 'user' | 'assistant'; text: string; engine?: string; lang?: SupportedLanguage; streaming?: boolean; stopped?: boolean }) {
  const user = role === 'user';
  const label = engine === 'human' ? loc(lang, S.human) : engine && engine !== 'system' ? (engine === 'sham_local' ? 'Sham Core' : 'Sham Core · AI') : '';
  return (
    <div className={`flex ${user ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap shadow-sm ${user ? 'bg-stone-900 text-white rounded-ee-sm' : engine === 'human' ? 'bg-emerald-50 border border-emerald-200 text-stone-900 rounded-es-sm' : 'bg-white border border-stone-200 text-stone-800 rounded-es-sm'}`}>
        {text}
        {streaming && <span className="inline-block w-1.5 h-4 align-middle ms-0.5 bg-amber-500 animate-pulse rounded-sm" aria-hidden />}
        {stopped && <span className="block mt-1.5 text-[10px] font-semibold text-amber-700">⏹ {loc(lang, S.stopped)}</span>}
        {label && !streaming && <span className="block mt-1.5 text-[10px] text-stone-400">{label}</span>}
      </div>
    </div>
  );
}

/** The advisory council's discussion: each advisor's first opinion, their peer reviews, and who chaired. */
function CouncilPanel({ council, lang }: { council: CouncilView; lang: SupportedLanguage }) {
  const L = makeT(lang, S);
  const [open, setOpen] = useState(false);
  return (
    <div className="mx-1 rounded-xl border border-amber-200 bg-amber-50/40">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open}
        className="w-full flex items-center gap-1.5 px-2.5 py-2 text-[11px] font-bold text-amber-900 text-start">
        <Users className="w-3.5 h-3.5 shrink-0" />
        <span className="flex-1">{L('council_title')} <span className="font-normal text-stone-500">· {fmt(L('council_meta'), { n: council.entries.length, r: council.rounds })}</span></span>
        <ChevronDown className={`w-3.5 h-3.5 transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="px-2.5 pb-2.5 space-y-2">
          {council.entries.map((e) => (
            <div key={e.label} className="rounded-lg border border-stone-200 bg-white p-2">
              <p className="text-[11px] font-bold text-stone-800 flex flex-wrap items-center gap-1">
                <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-stone-900 text-[9px] text-amber-200">{e.label}</span>
                {e.role}
                {e.chair && <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-100 px-1.5 text-[9px] text-amber-900"><Crown className="w-2.5 h-2.5" />{L('council_chair')}</span>}
              </p>
              <p className="mt-1 text-[10px] font-semibold text-stone-500">{L('council_opinion')}</p>
              <p dir="auto" className="text-[11px] text-stone-700 whitespace-pre-wrap leading-relaxed text-start">{e.opinion}</p>
              {e.reviews.map((r, i) => (
                <div key={i} className="mt-1.5 border-s-2 border-amber-300 ps-2">
                  <p className="text-[10px] font-semibold text-stone-500">{L('council_review')}{e.reviews.length > 1 ? ` (${i + 1})` : ''}</p>
                  <p dir="auto" className="text-[11px] text-stone-700 whitespace-pre-wrap leading-relaxed text-start">{r}</p>
                </div>
              ))}
            </div>
          ))}
          <p className="text-[10px] text-stone-500">{L('council_note')}</p>
        </div>
      )}
    </div>
  );
}

/** Live "thinking" timeline (inspired by agent apps): open while streaming, collapsible afterwards. */
function Steps({ steps, live, lang }: { steps: PublicStep[]; live: boolean; lang: SupportedLanguage }) {
  const L = makeT(lang, S);
  const [expanded, setExpanded] = useState(false);
  const show = live || expanded;
  return (
    <div className="px-1">
      <button type="button" onClick={() => setExpanded((v) => !v)} disabled={live} aria-expanded={show}
        className="inline-flex items-center gap-1 text-[10px] font-semibold text-stone-500 hover:text-stone-800 disabled:cursor-default">
        {live ? <Loader2 className="w-3 h-3 animate-spin" /> : <ChevronDown className={`w-3 h-3 transition ${show ? 'rotate-180' : ''}`} />}
        {L('steps')} ({steps.length})
      </button>
      {show && (
        <ol className="mt-1 ms-1.5 border-s border-amber-300 ps-2.5 space-y-0.5">
          {steps.map((step, i) => (
            <li key={`${step.stage}-${i}`} className="text-[10px] text-stone-500 flex items-center gap-1">
              {live && i === steps.length - 1 ? <Loader2 className="w-2.5 h-2.5 animate-spin text-amber-600" /> : <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />}
              {step.label}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

/** Per-message controls: read aloud + thumbs up/down with optional reason (feeds the admin quality loop). */
function MessageTools({ message, lang, canSpeak, speaking, canRate, onSpeak, onRate, onRegenerate }: {
  message: UiMessage; lang: SupportedLanguage; canSpeak: boolean; speaking: boolean; canRate: boolean;
  onSpeak: () => void; onRate: (rating: 'up' | 'down', reason?: string) => void; onRegenerate?: () => void;
}) {
  const L = makeT(lang, S);
  const [asking, setAsking] = useState(false);
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(message.text); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* clipboard blocked */ }
  };
  const [reason, setReason] = useState('');
  const rated = message.feedback?.rating;
  const btn = 'p-1 rounded-md hover:bg-stone-200 text-stone-400 hover:text-stone-700 disabled:hover:bg-transparent';
  return (
    <div className="px-1 space-y-1.5">
      <div className="flex items-center gap-0.5">
        {canSpeak && (
          <button type="button" onClick={onSpeak} className={btn} aria-label={speaking ? L('stop_reading') : L('read_aloud')} title={speaking ? L('stop_reading') : L('read_aloud')}>
            {speaking ? <VolumeX className="w-3.5 h-3.5 text-amber-700" /> : <Volume2 className="w-3.5 h-3.5" />}
          </button>
        )}
        <button type="button" onClick={() => void copy()} className={btn} aria-label={copied ? L('copied') : L('copy')} title={copied ? L('copied') : L('copy')}>
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
        </button>
        {onRegenerate && (
          <button type="button" onClick={onRegenerate} className={btn} aria-label={L('regenerate')} title={L('regenerate')}><RefreshCw className="w-3.5 h-3.5" /></button>
        )}
        {canRate && <>
        <button type="button" disabled={Boolean(rated)} onClick={() => onRate('up')} className={btn} aria-label={L('helpful')} title={L('helpful')} aria-pressed={rated === 'up'}>
          <ThumbsUp className={`w-3.5 h-3.5 ${rated === 'up' ? 'text-emerald-600 fill-emerald-100' : ''}`} />
        </button>
        <button type="button" disabled={Boolean(rated)} onClick={() => setAsking((v) => !v)} className={btn} aria-label={L('not_helpful')} title={L('not_helpful')} aria-pressed={rated === 'down'}>
          <ThumbsDown className={`w-3.5 h-3.5 ${rated === 'down' ? 'text-red-600 fill-red-100' : ''}`} />
        </button>
        </>}
        {rated && <span className="text-[10px] text-stone-400 ms-1">{L('thanks_feedback')}</span>}
      </div>
      {asking && !rated && (
        <form className="rounded-xl border border-stone-200 bg-white p-2 space-y-1.5" onSubmit={(e) => { e.preventDefault(); onRate('down', reason.trim() || undefined); setAsking(false); }}>
          <div className="flex flex-wrap gap-1">
            {(['r_wrong', 'r_missed', 'r_long'] as const).map((key) => (
              <button key={key} type="button" onClick={() => setReason(L(key))}
                className={`text-[10px] rounded-full border px-2 py-0.5 ${reason === L(key) ? 'border-red-300 bg-red-50 text-red-800' : 'border-stone-200 text-stone-600'}`}>{L(key)}</button>
            ))}
          </div>
          <input value={reason} onChange={(e) => setReason(e.target.value.slice(0, 300))} placeholder={L('why')} aria-label={L('why')} className="w-full rounded-lg border border-stone-200 px-2 py-1 text-xs" />
          <button className="text-[11px] font-bold rounded-lg bg-stone-900 text-amber-100 px-3 py-1">{L('send_feedback')}</button>
        </form>
      )}
    </div>
  );
}

function PrivacyCard({ memory, lang, onForget }: { memory: Record<string, string>; lang: SupportedLanguage; onForget: () => Promise<void> }) {
  const L = makeT(lang, S);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const entries = Object.entries(memory).filter(([, v]) => v);
  return (
    <div className="rounded-2xl border border-emerald-200 bg-white p-3 text-xs space-y-2">
      <p className="font-bold text-stone-900 flex items-center gap-1.5"><ShieldCheck className="w-4 h-4 text-emerald-700" />{L('memory_title')}</p>
      {entries.length ? (
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
          {entries.map(([k, v]) => (
            <React.Fragment key={k}><dt className="text-stone-500">{MEMORY_LABEL[k] ? loc(lang, MEMORY_LABEL[k]) : k}</dt><dd className="font-semibold text-stone-800 break-words">{v}</dd></React.Fragment>
          ))}
        </dl>
      ) : <p className="text-stone-500">{L('memory_empty')}</p>}
      {confirming ? (
        <div className="rounded-xl bg-red-50 border border-red-200 p-2 space-y-2">
          <p className="text-red-900">{L('forget_confirm')}</p>
          <div className="flex gap-2">
            <button type="button" disabled={busy} onClick={async () => { setBusy(true); await onForget(); setBusy(false); }}
              className="flex-1 rounded-lg bg-red-700 text-white py-1.5 font-bold disabled:opacity-50">{busy ? <Loader2 className="w-3.5 h-3.5 animate-spin mx-auto" /> : L('forget')}</button>
            <button type="button" onClick={() => setConfirming(false)} className="rounded-lg border border-stone-300 px-3">{L('close')}</button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setConfirming(true)} className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 text-red-800 px-2.5 py-1.5 font-semibold hover:bg-red-50">
          <Trash2 className="w-3.5 h-3.5" />{L('forget')}
        </button>
      )}
    </div>
  );
}

const fieldLabel = (lang: SupportedLanguage, f: FormField) => (lang === 'ar' || lang === 'fa' ? f.labelAr : f.labelEn) || f.labelAr || f.labelEn;
const inputClass = 'w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400';

function Action({ action, lang, services, conversationId, productsInMessage, onSubmitted, onForget }: {
  action: ActionCard; lang: SupportedLanguage; services: PublicService[]; conversationId?: string; productsInMessage?: ProductCard[]; onSubmitted: (r: RequestView) => void; onForget: () => Promise<void>;
}) {
  const L = makeT(lang, S);
  if (action.type === 'privacy') return <PrivacyCard memory={action.memory || {}} lang={lang} onForget={onForget} />;
  if (action.type === 'open_tab' && action.tab) {
    return (
      <button type="button" onClick={() => { window.location.hash = `#${action.tab}`; }}
        className="inline-flex items-center gap-1.5 text-xs font-semibold rounded-full bg-amber-100 text-amber-950 px-3 py-1.5 hover:bg-amber-200">
        <ExternalLink className="w-3.5 h-3.5" />{L('open_tab')}
      </button>
    );
  }
  if (action.type === 'products' && action.products?.length) {
    // Store forms render their own selectable list; this card is the read-only view.
    return null;
  }
  if (action.type === 'order_status') return <TrackCard lang={lang} initial={action.request} initialRef={action.ref} />;
  if (action.type === 'request_form' && action.serviceId) {
    const service = services.find((s) => s.id === action.serviceId);
    return <RequestForm lang={lang} serviceId={action.serviceId} kind={service?.kind} fields={action.fields || service?.formFields || []}
      title={service ? (lang === 'ar' || lang === 'fa' ? service.nameAr : service.nameEn) : action.title || ''} products={productsInMessage} conversationId={conversationId} onSubmitted={onSubmitted} />;
  }
  return null;
}

function StatusPill({ status, lang }: { status: string; lang: SupportedLanguage }) {
  const color = status === 'cancelled' ? 'bg-red-100 text-red-800' : status === 'completed' || status === 'confirmed' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-900';
  return <span className={`text-[11px] font-bold rounded-full px-2 py-0.5 ${color}`}>{loc(lang, STATUS_TEXT[status] || { ar: status, en: status })}</span>;
}

function TrackCard({ lang, initial, initialRef }: { lang: SupportedLanguage; initial?: RequestView; initialRef?: string }) {
  const L = makeT(lang, S);
  const [ref, setRef] = useState(initialRef || '');
  const [contact, setContact] = useState('');
  const [result, setResult] = useState<RequestView | undefined>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (result) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-white p-3 text-sm space-y-1.5">
        <div className="flex items-center gap-2 font-bold text-stone-900"><CheckCircle2 className="w-4 h-4 text-emerald-600" />{result.ref}</div>
        <div className="flex items-center gap-2 text-xs text-stone-600">{L('status')}: <StatusPill status={result.status} lang={lang} /></div>
        {result.total !== undefined && <div className="text-xs text-stone-600">{L('total')}: <b>{result.total} {result.currency}</b></div>}
        {initial && result === initial && <p className="text-[11px] text-stone-500">{L('keep_ref')}</p>}
      </div>
    );
  }
  return (
    <form className="rounded-2xl border border-stone-200 bg-white p-3 space-y-2" onSubmit={async (e) => {
      e.preventDefault(); setBusy(true); setError('');
      try { setResult((await assistantApi.track(ref.trim(), contact.trim())).request); }
      catch (err) { setError(err instanceof ApiError && err.status === 404 ? L('not_found') : errorText(lang, err)); }
      finally { setBusy(false); }
    }}>
      <p className="text-xs font-bold text-stone-800 flex items-center gap-1.5"><PackageSearch className="w-4 h-4" />{L('track_title')}</p>
      <input className={inputClass} dir="ltr" required value={ref} onChange={(e) => setRef(e.target.value.toUpperCase())} placeholder={L('ref')} aria-label={L('ref')} pattern="SH-?[A-Za-z0-9]{6}" />
      <input className={inputClass} required value={contact} onChange={(e) => setContact(e.target.value)} placeholder={L('contact')} aria-label={L('contact')} />
      {error && <p className="text-xs text-red-700">{error}</p>}
      <button disabled={busy} className="w-full rounded-xl bg-stone-900 text-amber-100 py-2 text-sm font-bold disabled:opacity-50">{busy ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : L('track')}</button>
    </form>
  );
}

function RequestForm({ lang, serviceId, kind, fields, title, products, conversationId, onSubmitted }: {
  lang: SupportedLanguage; serviceId: string; kind?: string; fields: FormField[]; title: string; products?: ProductCard[]; conversationId?: string; onSubmitted: (r: RequestView) => void;
}) {
  const L = makeT(lang, S);
  const ar = lang === 'ar' || lang === 'fa';
  const [contact, setContact] = useState({ name: '', phone: '', email: '' });
  const [values, setValues] = useState<Record<string, string>>({});
  const [qty, setQty] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState<RequestView | null>(null);
  const store = kind === 'store';
  const list = useMemo(() => products || [], [products]);
  const total = list.reduce((sum, p) => sum + (qty[p.id] || 0) * p.price, 0);

  if (done) return null; // the confirmation message is appended to the conversation

  return (
    <form className="rounded-2xl border border-amber-200 bg-white p-3 space-y-2.5" onSubmit={async (e) => {
      e.preventDefault(); setError('');
      if (!contact.phone.trim() && !contact.email.trim()) { setError(L('phone_or_email')); return; }
      const items = Object.entries(qty).filter(([, q]) => q > 0).map(([productId, quantity]) => ({ productId, quantity }));
      if (store && !items.length) { setError(L('select_product')); return; }
      setBusy(true);
      try {
        const { request } = await assistantApi.submitRequest({
          serviceId, conversationId, fields: values, items: store ? items : undefined,
          contact: { name: contact.name.trim(), phone: contact.phone.trim() || undefined, email: contact.email.trim() || undefined },
        });
        setDone(request); onSubmitted(request);
      } catch (err) {
        setError(err instanceof ApiError && err.status === 409 ? (ar ? 'الكمية المطلوبة أكبر من المخزون المتاح.' : 'Requested quantity exceeds stock.') : err instanceof ApiError && err.status === 400 ? (ar ? 'راجع البيانات المطلوبة.' : 'Please check the required fields.') : errorText(lang, err));
      } finally { setBusy(false); }
    }}>
      <p className="text-xs font-bold text-stone-900">{title}</p>
      {store && (
        <div className="space-y-1.5">
          {list.map((p) => (
            <div key={p.id} className="flex items-center gap-2 rounded-xl border border-stone-200 p-2">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold truncate">{(ar ? p.nameAr : p.nameEn) || p.nameAr} {p.demo && <span className="text-[9px] bg-stone-200 rounded px-1">{L('demo')}</span>}</p>
                <p className="text-[11px] text-stone-500">{p.price} {p.currency} / {p.unit}{p.stock <= 0 ? ` · ${L('out')}` : ''}</p>
              </div>
              <input type="number" min={0} max={Math.max(0, p.stock)} disabled={p.stock <= 0} aria-label={`${L('qty')} ${p.sku}`}
                value={qty[p.id] || 0} onChange={(e) => setQty((q) => ({ ...q, [p.id]: Math.max(0, Math.min(p.stock, Math.floor(Number(e.target.value) || 0))) }))}
                className="w-16 rounded-lg border border-stone-300 px-2 py-1 text-sm text-center disabled:opacity-40" />
            </div>
          ))}
          {total > 0 && <p className="text-xs text-stone-700">{L('total')}: <b>{Math.round(total * 100) / 100} {list[0]?.currency}</b></p>}
        </div>
      )}
      <input className={inputClass} required value={contact.name} onChange={(e) => setContact({ ...contact, name: e.target.value })} placeholder={L('name')} aria-label={L('name')} maxLength={120} />
      <div className="grid grid-cols-2 gap-2">
        <input className={inputClass} dir="ltr" type="tel" value={contact.phone} onChange={(e) => setContact({ ...contact, phone: e.target.value })} placeholder={L('phone')} aria-label={L('phone')} maxLength={40} />
        <input className={inputClass} dir="ltr" type="email" value={contact.email} onChange={(e) => setContact({ ...contact, email: e.target.value })} placeholder={L('email')} aria-label={L('email')} maxLength={200} />
      </div>
      {fields.map((f) => {
        const label = fieldLabel(lang, f) + (f.required ? ' *' : '');
        const common = { value: values[f.name] || '', required: f.required, 'aria-label': label, onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setValues((v) => ({ ...v, [f.name]: e.target.value })) };
        if (f.type === 'textarea') return <textarea key={f.name} {...common} placeholder={label} rows={2} className={inputClass} maxLength={3000} />;
        if (f.type === 'select') {
          return (
            <select key={f.name} {...common} className={inputClass}>
              <option value="">{label}</option>
              {f.options?.map((o) => <option key={o} value={o}>{OPTION_TEXT[o] ? loc(lang, OPTION_TEXT[o]) : o}</option>)}
            </select>
          );
        }
        return <input key={f.name} {...common} type={f.type === 'number' ? 'number' : f.type} placeholder={label} className={inputClass} />;
      })}
      {error && <p className="text-xs text-red-700">{error}</p>}
      <button disabled={busy} className="w-full rounded-xl bg-gradient-to-r from-stone-900 to-amber-800 text-amber-50 py-2.5 text-sm font-bold disabled:opacity-50">
        {busy ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : L('submit')}
      </button>
    </form>
  );
}
