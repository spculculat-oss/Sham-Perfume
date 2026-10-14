import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  CheckCircle2, ExternalLink, Headset, Loader2, MessageCircle, PackageSearch, RotateCcw, Send, ShoppingBag, Sparkles, X,
} from 'lucide-react';
import type { SupportedLanguage } from '../types/i18n';
import { SUPPORTED_LANGUAGES } from '../types/i18n';
import { ApiError, ApiUnavailableError, isStaticHosting } from '../utils/api';
import { loc, makeT, type LText } from '../utils/localize';
import {
  assistantApi, CONVERSATION_KEY, type ActionCard, type AssistantConfig, type FormField, type ProductCard,
  type PublicService, type RequestView, type UiMessage,
} from './client';

const S = {
  open: { ar: 'مساعد شام للخدمات', en: 'Sham services assistant' },
  teaser: { ar: 'طلبات • متجر • دعم', en: 'Orders • Store • Support' },
  placeholder: { ar: 'اكتب سؤالك أو طلبك…', en: 'Type your question or request…' },
  send: { ar: 'إرسال', en: 'Send' },
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

const SERVICE_ICON: Record<string, React.ReactNode> = {
  store: <ShoppingBag className="w-3.5 h-3.5" />, support: <Headset className="w-3.5 h-3.5" />,
};

interface Props { currentLang: SupportedLanguage }

function errorText(lang: SupportedLanguage, error: unknown) {
  if (error instanceof ApiUnavailableError) return loc(lang, S.static);
  if (error instanceof ApiError && error.status === 429) return loc(lang, S.rate);
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
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Restore the visitor's last conversation (local copy; the server is the source of truth).
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(CONVERSATION_KEY) || 'null');
      if (saved?.id && Array.isArray(saved.messages)) { setConversationId(saved.id); setMessages(saved.messages); setStatus(saved.status || 'open'); }
    } catch { /* ignore corrupted cache */ }
  }, []);
  useEffect(() => {
    try {
      if (conversationId) localStorage.setItem(CONVERSATION_KEY, JSON.stringify({ id: conversationId, status, messages: messages.slice(-60) }));
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

  const send = useCallback(async (text: string) => {
    const message = text.trim();
    if (!message || busy) return;
    setError('');
    setInput('');
    setMessages((m) => [...m, { role: 'user', text: message, at: new Date().toISOString() }]);
    setBusy(true);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const reply = await assistantApi.chat(message, currentLang, conversationId, controller.signal);
      if (controller.signal.aborted) return;
      setConversationId(reply.conversationId);
      setStatus(reply.status);
      setMessages((m) => [...m, { role: 'assistant', text: reply.reply, at: new Date().toISOString(), engine: reply.engine.id, actions: reply.actions, citations: reply.citations }]);
    } catch (e) {
      if (!controller.signal.aborted) setError(errorText(currentLang, e));
    } finally {
      if (abortRef.current === controller) { abortRef.current = null; setBusy(false); }
    }
  }, [busy, conversationId, currentLang]);

  const reset = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setBusy(false);
    setMessages([]); setConversationId(undefined); setStatus('open'); setError('');
    try { localStorage.removeItem(CONVERSATION_KEY); } catch { /* ignore */ }
  };

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
              {messages.map((m, i) => (
                <div key={`${m.at}-${i}`} className="space-y-2">
                  <Bubble role={m.role} text={m.text} engine={m.engine} lang={currentLang} />
                  {m.citations && m.citations.length > 0 && (
                    <p className="text-[10px] text-stone-500 px-2">{L('sources')}: {m.citations.map((c) => c.title).join(' · ')}</p>
                  )}
                  {m.actions?.map((a, j) => (
                    <Action key={j} action={a} lang={currentLang} services={config?.services || []} conversationId={conversationId}
                      productsInMessage={m.actions?.find((x) => x.type === 'products')?.products}
                      onSubmitted={(request) => setMessages((all) => [...all, { role: 'assistant', text: `✅ ${loc(currentLang, S.submitted)} ${request.ref}`, at: new Date().toISOString(), engine: 'system', actions: [{ type: 'order_status', request }] }])} />
                  ))}
                </div>
              ))}
              {busy && <div className="flex items-center gap-2 text-xs text-stone-500 px-2"><Loader2 className="w-4 h-4 animate-spin" />{L('thinking')}</div>}
              {error && <p role="alert" className="text-xs rounded-xl border border-red-200 bg-red-50 p-2.5 text-red-800">{error}</p>}
            </div>

            <form onSubmit={(e) => { e.preventDefault(); void send(input); }} className="p-3 border-t border-stone-200 bg-white shrink-0">
              <div className="flex items-end gap-2">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value.slice(0, 2000))}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(input); } }}
                  rows={1}
                  placeholder={L('placeholder')}
                  aria-label={L('placeholder')}
                  disabled={isStaticHosting}
                  className="flex-1 resize-none max-h-28 rounded-2xl border border-stone-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
                <button type="submit" disabled={busy || !input.trim() || isStaticHosting} aria-label={L('send')}
                  className="h-10 w-10 shrink-0 rounded-full bg-stone-900 text-amber-200 flex items-center justify-center disabled:opacity-40">
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className={`w-4 h-4 ${rtl ? 'rotate-180' : ''}`} />}
                </button>
              </div>
              <p className="mt-1.5 text-[10px] text-stone-400">{L('no_card')}</p>
            </form>
          </motion.section>
        )}
      </AnimatePresence>
    </>
  );
}

function Bubble({ role, text, engine, lang = 'ar' }: { role: 'user' | 'assistant'; text: string; engine?: string; lang?: SupportedLanguage }) {
  const user = role === 'user';
  const label = engine === 'human' ? loc(lang, S.human) : engine && engine !== 'system' ? (engine === 'sham_local' ? 'Sham Core' : `Sham Core · ${engine}`) : '';
  return (
    <div className={`flex ${user ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap shadow-sm ${user ? 'bg-stone-900 text-white rounded-ee-sm' : engine === 'human' ? 'bg-emerald-50 border border-emerald-200 text-stone-900 rounded-es-sm' : 'bg-white border border-stone-200 text-stone-800 rounded-es-sm'}`}>
        {text}
        {label && <span className="block mt-1.5 text-[10px] text-stone-400">{label}</span>}
      </div>
    </div>
  );
}

const fieldLabel = (lang: SupportedLanguage, f: FormField) => (lang === 'ar' || lang === 'fa' ? f.labelAr : f.labelEn) || f.labelAr || f.labelEn;
const inputClass = 'w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400';

function Action({ action, lang, services, conversationId, productsInMessage, onSubmitted }: {
  action: ActionCard; lang: SupportedLanguage; services: PublicService[]; conversationId?: string; productsInMessage?: ProductCard[]; onSubmitted: (r: RequestView) => void;
}) {
  const L = makeT(lang, S);
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
