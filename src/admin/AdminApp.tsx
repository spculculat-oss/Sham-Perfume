import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity, ArrowRight, BookOpen, Bot, Boxes, ClipboardList, Cpu, Database, Download, FlaskConical, Headset, KeyRound,
  BellRing, CheckCircle2, CircleAlert, EyeOff, LayoutDashboard, Lightbulb, Loader2, LogOut, MessagesSquare, Plus, RefreshCw, Save, Send,
  Settings2, ThumbsDown, ThumbsUp, Trash2, TriangleAlert, Wand2,
} from 'lucide-react';
import type {
  Conversation, CoreSettings, EngineId, KnowledgeDoc, KnowledgeGap, Product, RequestStatus, ServiceDef, ServiceRequest,
} from '../../server/core/types';
import type { AgentResult } from '../../server/core/adminAgent';
import { AdminApiError, adminRequest, getToken, send, setToken } from './adminApi';
import { isStaticHosting } from '../utils/api';

type Tab = 'overview' | 'agent' | 'quality' | 'requests' | 'conversations' | 'products' | 'knowledge' | 'services' | 'engines' | 'sandbox';
interface EngineStatus { id: EngineId; name: string; model: string; configured: boolean; kind: string }
interface Overview {
  storage: { kind: string; persistent: boolean; error?: string };
  engines: EngineStatus[]; policy: EngineId[];
  counts: Record<string, number>;
  byStatus: Record<string, number>; byType: Record<string, number>; intents: Record<string, number>; engineUsage: Record<string, number>; pipelineValue: Record<string, number>;
  notifications?: { configured: boolean };
}
interface FeedbackItem { conversationId: string; messageId?: string; rating: 'up' | 'down'; reason?: string; at: string; question: string; answer: string; engine?: string; intent?: string }

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'overview', label: 'نظرة عامة', icon: <LayoutDashboard className="w-4 h-4" /> },
  { id: 'agent', label: 'المساعد الإداري', icon: <Wand2 className="w-4 h-4" /> },
  { id: 'quality', label: 'الجودة والتعلّم', icon: <Lightbulb className="w-4 h-4" /> },
  { id: 'requests', label: 'الطلبات والعروض', icon: <ClipboardList className="w-4 h-4" /> },
  { id: 'conversations', label: 'المحادثات', icon: <MessagesSquare className="w-4 h-4" /> },
  { id: 'products', label: 'المنتجات', icon: <Boxes className="w-4 h-4" /> },
  { id: 'knowledge', label: 'قاعدة المعرفة', icon: <BookOpen className="w-4 h-4" /> },
  { id: 'services', label: 'الخدمات', icon: <Settings2 className="w-4 h-4" /> },
  { id: 'engines', label: 'المحركات والإعدادات', icon: <Cpu className="w-4 h-4" /> },
  { id: 'sandbox', label: 'مختبر المساعد', icon: <FlaskConical className="w-4 h-4" /> },
];

const STATUS: Record<RequestStatus, string> = { new: 'جديد', in_progress: 'قيد التنفيذ', quoted: 'عرض سعر', confirmed: 'مؤكد', completed: 'مكتمل', cancelled: 'ملغي' };
const TYPE: Record<string, string> = { order: 'طلب متجر', custom_formula: 'عطر مخصص', b2b_quote: 'عرض جملة', consultation: 'استشارة', support: 'دعم', service: 'خدمة' };
const INTENT: Record<string, string> = { greeting: 'تحية', thanks: 'شكر', list_services: 'عرض الخدمات', track_order: 'تتبع', browse_products: 'تصفح منتجات', service_request: 'طلب خدمة', handoff: 'تحويل لموظف', calculate: 'حساب', perfume_expert: 'سؤال خبير', question: 'سؤال عام', memory_view: 'عرض الذاكرة', forget: 'حذف البيانات' };
const ENGINE_LABEL: Record<string, string> = { self_hosted: 'نموذج مفتوح مستضاف ذاتياً', gemini: 'Gemini', openai: 'OpenAI', claude: 'Claude', deepseek: 'DeepSeek', sham_local: 'محرك شام الذاتي', human: 'موظف', system: 'النظام' };

const card = 'rounded-2xl border border-stone-200 bg-white p-4 shadow-sm';
const input = 'w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400';
const btn = 'inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold disabled:opacity-50';
const fmtDate = (iso?: string) => (iso ? new Date(iso).toLocaleString('ar-EG', { dateStyle: 'short', timeStyle: 'short' }) : '');

function useLoad<T>(path: string, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const reload = useCallback(() => {
    setLoading(true); setError('');
    adminRequest<T>(path).then(setData).catch((e: Error) => setError(e.message)).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, ...deps]);
  useEffect(() => { reload(); }, [reload]);
  return { data, error, loading, reload, setData };
}

export default function AdminApp() {
  const [token, setTok] = useState(getToken());
  const [authed, setAuthed] = useState(false);
  const [checking, setChecking] = useState(Boolean(token));
  const [loginError, setLoginError] = useState('');
  const [tab, setTab] = useState<Tab>('overview');

  const login = useCallback(async (candidate: string) => {
    setChecking(true); setLoginError('');
    try {
      await adminRequest('/overview', {}, candidate);
      setToken(candidate); setTok(candidate); setAuthed(true);
    } catch (e) {
      setToken('');
      setLoginError(e instanceof AdminApiError ? (e.status === 401 ? 'رمز الإدارة غير صحيح.' : e.status === 503 ? 'لوحة الإدارة غير مفعلة: اضبط SHAM_ADMIN_TOKEN (12 حرفاً على الأقل) في متغيرات الخادم.' : e.status === 429 ? 'محاولات كثيرة فاشلة. انتظر 15 دقيقة.' : e.message) : 'تعذّر الاتصال بالخادم.');
    } finally { setChecking(false); }
  }, []);

  useEffect(() => { if (token) void login(token); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { document.documentElement.dir = 'rtl'; document.documentElement.lang = 'ar'; document.title = 'إدارة شام — Sham Core'; }, []);

  if (isStaticHosting) {
    return <Shell><div className={`${card} max-w-lg mx-auto mt-24 text-center`}>لوحة الإدارة تحتاج خادم شام (Node.js أو Vercel). نسخة GitHub Pages ثابتة ولا تحتوي على API.</div></Shell>;
  }

  if (!authed) {
    return (
      <Shell>
        <form className={`${card} max-w-sm mx-auto mt-24 space-y-4`} onSubmit={(e) => { e.preventDefault(); void login(token.trim()); }}>
          <div className="flex items-center gap-2"><KeyRound className="w-5 h-5 text-amber-700" /><h1 className="font-bold text-lg">إدارة شام — Sham Core</h1></div>
          <p className="text-xs text-stone-500">أدخل رمز الإدارة المضبوط في متغير الخادم <code dir="ltr">SHAM_ADMIN_TOKEN</code>. يُحفظ الرمز في هذه الجلسة فقط.</p>
          <input className={input} type="password" dir="ltr" autoComplete="current-password" value={token} onChange={(e) => setTok(e.target.value)} placeholder="Admin token" aria-label="رمز الإدارة" />
          {loginError && <p role="alert" className="text-xs text-red-700">{loginError}</p>}
          <button disabled={checking || !token.trim()} className={`${btn} w-full bg-stone-900 text-amber-100`}>{checking ? <Loader2 className="w-4 h-4 animate-spin" /> : 'دخول'}</button>
          <a href="#home" className="block text-center text-xs text-stone-500 hover:underline">العودة إلى الموقع</a>
        </form>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="flex flex-col lg:flex-row min-h-screen">
        <aside className="lg:w-60 bg-stone-900 text-stone-100 lg:min-h-screen p-3 flex lg:flex-col gap-1 overflow-x-auto shrink-0">
          <div className="hidden lg:flex items-center gap-2 px-2 py-3 mb-2 border-b border-stone-700"><Bot className="w-6 h-6 text-amber-400" /><div><p className="font-bold text-sm">Sham Core</p><p className="text-[10px] text-stone-400">مركز إدارة المساعد والخدمات</p></div></div>
          {TABS.map((t) => (
            <button key={t.id} type="button" onClick={() => setTab(t.id)} className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm whitespace-nowrap ${tab === t.id ? 'bg-amber-500 text-stone-950 font-bold' : 'hover:bg-white/10'}`}>{t.icon}{t.label}</button>
          ))}
          <div className="lg:mt-auto flex lg:flex-col gap-1">
            <a href="#home" className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm hover:bg-white/10 whitespace-nowrap"><ArrowRight className="w-4 h-4" />الموقع</a>
            <button type="button" onClick={() => { setToken(''); setAuthed(false); setTok(''); }} className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm hover:bg-white/10 whitespace-nowrap"><LogOut className="w-4 h-4" />خروج</button>
          </div>
        </aside>
        <main className="flex-1 p-4 lg:p-6 min-w-0">
          {tab === 'overview' && <OverviewPanel go={setTab} />}
          {tab === 'agent' && <AgentPanel go={setTab} />}
          {tab === 'quality' && <QualityPanel />}
          {tab === 'requests' && <RequestsPanel />}
          {tab === 'conversations' && <ConversationsPanel />}
          {tab === 'products' && <ProductsPanel />}
          {tab === 'knowledge' && <KnowledgePanel />}
          {tab === 'services' && <ServicesPanel />}
          {tab === 'engines' && <EnginesPanel />}
          {tab === 'sandbox' && <SandboxPanel />}
        </main>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div dir="rtl" className="min-h-screen bg-stone-100 text-stone-900 font-sans">{children}</div>;
}

function Header({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
      <div><h1 className="text-xl font-bold">{title}</h1>{subtitle && <p className="text-xs text-stone-500 mt-1">{subtitle}</p>}</div>
      <div className="flex gap-2">{actions}</div>
    </div>
  );
}

function Feedback({ error, loading }: { error?: string; loading?: boolean }) {
  if (loading) return <div className="flex items-center gap-2 text-sm text-stone-500 py-6"><Loader2 className="w-4 h-4 animate-spin" />جارٍ التحميل…</div>;
  if (error) return <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>;
  return null;
}

function Bars({ data, labels }: { data: Record<string, number>; labels?: Record<string, string> }) {
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...entries.map(([, v]) => v));
  if (!entries.length) return <p className="text-xs text-stone-400">لا توجد بيانات بعد.</p>;
  return (
    <div className="space-y-1.5">
      {entries.map(([k, v]) => (
        <div key={k} className="flex items-center gap-2 text-xs">
          <span className="w-28 truncate text-stone-600">{labels?.[k] || k}</span>
          <div className="flex-1 h-2.5 rounded-full bg-stone-100 overflow-hidden"><div className="h-full bg-gradient-to-l from-amber-500 to-emerald-600" style={{ width: `${(v / max) * 100}%` }} /></div>
          <span className="w-8 text-end font-semibold">{v}</span>
        </div>
      ))}
    </div>
  );
}

function OverviewPanel({ go }: { go: (t: Tab) => void }) {
  const { data, error, loading, reload } = useLoad<Overview>('/overview');
  return (
    <>
      <Header title="نظرة عامة" subtitle="حالة المساعد والخدمات والطلبات" actions={<button onClick={reload} className={`${btn} bg-white border border-stone-300`}><RefreshCw className="w-4 h-4" />تحديث</button>} />
      <Feedback error={error} loading={loading && !data} />
      {data && (
        <div className="space-y-4">
          {(!data.storage.persistent || data.storage.error) && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
              <b>تنبيه التخزين:</b> {data.storage.error ? `إعداد التخزين غير صحيح (${data.storage.error}). يعمل النظام مؤقتاً في الذاكرة.` : 'التخزين الحالي في الذاكرة فقط وسيُفقد عند إعادة التشغيل.'} اضبط <code dir="ltr">SHAM_STORE=file</code> على سيرفر Node أو <code dir="ltr">SHAM_STORE=firestore</code> على Vercel/Firebase.
            </div>
          )}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              ['طلبات جديدة', data.counts.requestsNew, 'requests', 'text-amber-700'],
              ['تحويلات لموظف مفتوحة', data.counts.handoffsOpen, 'conversations', 'text-emerald-700'],
              ['محادثات آخر 24 ساعة', data.counts.conversations24h, 'conversations', 'text-stone-800'],
              ['منتجات مخزونها منخفض', data.counts.lowStock, 'products', 'text-red-700'],
              ['أسئلة بلا إجابة (فجوات)', data.counts.gapsOpen ?? 0, 'quality', 'text-orange-700'],
              ['تقييمات إيجابية 👍', data.counts.feedbackUp ?? 0, 'quality', 'text-emerald-700'],
              ['تقييمات سلبية 👎', data.counts.feedbackDown ?? 0, 'quality', 'text-red-700'],
            ].map(([label, value, target, color]) => (
              <button key={label as string} onClick={() => go(target as Tab)} className={`${card} text-start hover:border-amber-400`}>
                <p className="text-xs text-stone-500">{label}</p><p className={`text-3xl font-bold mt-1 ${color}`}>{value as number}</p>
              </button>
            ))}
          </div>
          <div className="grid md:grid-cols-3 gap-3">
            <div className={card}><h2 className="font-bold text-sm mb-3 flex items-center gap-1.5"><Activity className="w-4 h-4" />نوايا الزوار</h2><Bars data={data.intents} labels={INTENT} /></div>
            <div className={card}><h2 className="font-bold text-sm mb-3">الطلبات حسب الحالة</h2><Bars data={data.byStatus} labels={STATUS} /></div>
            <div className={card}><h2 className="font-bold text-sm mb-3">المحركات التي ردّت فعلياً</h2><Bars data={data.engineUsage} labels={ENGINE_LABEL} /></div>
          </div>
          <div className="grid md:grid-cols-3 gap-3">
            <div className={card}><h2 className="font-bold text-sm mb-3">الطلبات حسب النوع</h2><Bars data={data.byType} labels={TYPE} /></div>
            <div className={card}>
              <h2 className="font-bold text-sm mb-3">قيمة طلبات المتجر (غير الملغاة)</h2>
              {Object.keys(data.pipelineValue).length ? Object.entries(data.pipelineValue).map(([c, v]) => <p key={c} className="text-2xl font-bold">{v.toLocaleString('ar-EG')} <span className="text-sm">{c}</span></p>) : <p className="text-xs text-stone-400">لا توجد طلبات متجر بعد.</p>}
              <p className="text-[11px] text-stone-400 mt-2">قيمة تقديرية قبل تأكيد الشحن والدفع.</p>
            </div>
            <div className={card}>
              <h2 className="font-bold text-sm mb-3 flex items-center gap-1.5"><Database className="w-4 h-4" />البنية</h2>
              <ul className="text-xs space-y-1.5 text-stone-600">
                <li>التخزين: <b dir="ltr">{data.storage.kind}</b> {data.storage.persistent ? '✅ دائم' : '⚠️ مؤقت'}</li>
                <li>المحادثات: <b>{data.counts.conversations}</b> · الطلبات: <b>{data.counts.requests}</b></li>
                <li>المعرفة: <b>{data.counts.knowledge}</b> مستند · الخدمات: <b>{data.counts.services}</b> · المنتجات: <b>{data.counts.products}</b></li>
                <li>المحركات المهيأة: {data.engines.filter((e) => e.configured).map((e) => ENGINE_LABEL[e.id]).join('، ')}</li>
                <li>إشعارات Webhook: {data.notifications?.configured ? '✅ مفعلة' : <>غير مفعلة — اضبط <code dir="ltr">SHAM_WEBHOOK_URL</code></>}</li>
              </ul>
              {data.notifications?.configured && <NotifyTest />}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function RequestsPanel() {
  const [filter, setFilter] = useState<RequestStatus | ''>('');
  const { data, error, loading, reload } = useLoad<{ items: ServiceRequest[] }>(`/requests${filter ? `?status=${filter}` : ''}`, [filter]);
  const [selected, setSelected] = useState<ServiceRequest | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');

  const update = async (patch: { status?: RequestStatus; note?: string }) => {
    if (!selected) return;
    setBusy(true); setActionError('');
    try {
      const { item } = await adminRequest<{ item: ServiceRequest }>(`/requests/${selected.id}`, send('PATCH', patch));
      setSelected(item); setNote(''); reload();
    } catch (e) { setActionError((e as Error).message); } finally { setBusy(false); }
  };

  return (
    <>
      <Header title="الطلبات والعروض" subtitle="طلبات المتجر، العطور المخصصة، الجملة، الاستشارات وتذاكر الدعم"
        actions={<>
          <select className={input} value={filter} onChange={(e) => setFilter(e.target.value as RequestStatus | '')} aria-label="تصفية حسب الحالة">
            <option value="">كل الحالات</option>{Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <button onClick={reload} className={`${btn} bg-white border border-stone-300`}><RefreshCw className="w-4 h-4" /></button>
        </>} />
      <Feedback error={error} loading={loading && !data} />
      <div className="grid lg:grid-cols-5 gap-4">
        <div className="lg:col-span-3 space-y-2">
          {data?.items.length === 0 && <p className="text-sm text-stone-500">لا توجد طلبات.</p>}
          {data?.items.map((r) => (
            <button key={r.id} onClick={() => setSelected(r)} className={`${card} w-full text-start hover:border-amber-400 ${selected?.id === r.id ? 'border-amber-500 ring-2 ring-amber-200' : ''}`}>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <b dir="ltr">{r.ref}</b><span className="text-xs rounded-full bg-stone-100 px-2 py-0.5">{TYPE[r.type]}</span>
                <span className={`text-xs rounded-full px-2 py-0.5 ${r.status === 'new' ? 'bg-amber-100 text-amber-900' : r.status === 'cancelled' ? 'bg-red-100 text-red-800' : 'bg-emerald-100 text-emerald-800'}`}>{STATUS[r.status]}</span>
                <span className="ms-auto text-xs text-stone-400">{fmtDate(r.createdAt)}</span>
              </div>
              <p className="text-xs text-stone-600 mt-1">{r.contact.name} · <span dir="ltr">{r.contact.phone || r.contact.email}</span>{r.total !== undefined ? ` · ${r.total} ${r.currency}` : ''}</p>
            </button>
          ))}
        </div>
        <div className="lg:col-span-2">
          {selected ? (
            <div className={`${card} space-y-3 lg:sticky lg:top-4`}>
              <div className="flex items-center justify-between"><h2 className="font-bold" dir="ltr">{selected.ref}</h2><span className="text-xs text-stone-500">{TYPE[selected.type]} · {selected.serviceId}</span></div>
              <div className="text-sm space-y-1">
                <p>العميل: <b>{selected.contact.name}</b></p>
                {selected.contact.phone && <p>الهاتف: <a dir="ltr" className="text-emerald-700 underline" href={`tel:${selected.contact.phone}`}>{selected.contact.phone}</a></p>}
                {selected.contact.email && <p>البريد: <a dir="ltr" className="text-emerald-700 underline" href={`mailto:${selected.contact.email}`}>{selected.contact.email}</a></p>}
              </div>
              {Object.keys(selected.fields).length > 0 && (
                <dl className="text-xs bg-stone-50 rounded-xl p-3 space-y-1">{Object.entries(selected.fields).map(([k, v]) => <div key={k}><dt className="inline font-semibold">{k}: </dt><dd className="inline whitespace-pre-wrap">{v}</dd></div>)}</dl>
              )}
              {selected.items && (
                <table className="w-full text-xs"><thead><tr className="text-stone-500"><th className="text-start">المنتج</th><th>الكمية</th><th>السعر</th></tr></thead>
                  <tbody>{selected.items.map((i) => <tr key={i.productId}><td>{i.name} <span className="text-stone-400" dir="ltr">({i.sku})</span></td><td className="text-center">{i.quantity}</td><td className="text-center">{i.unitPrice} {i.currency}</td></tr>)}</tbody>
                  <tfoot><tr className="font-bold"><td colSpan={2}>الإجمالي</td><td className="text-center">{selected.total} {selected.currency}</td></tr></tfoot></table>
              )}
              <label className="block text-xs font-semibold">تغيير الحالة
                <select className={`${input} mt-1`} value={selected.status} disabled={busy || selected.status === 'cancelled'} onChange={(e) => {
                  const next = e.target.value as RequestStatus;
                  if (next === 'cancelled' && !confirm('إلغاء الطلب نهائي ويعيد الكميات للمخزون. متأكد؟')) return;
                  void update({ status: next });
                }}>{Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
              </label>
              <div className="space-y-2">
                <textarea className={input} rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="ملاحظة داخلية (عرض سعر، موعد شحن…)" aria-label="ملاحظة داخلية" />
                <button disabled={busy || !note.trim()} onClick={() => update({ note })} className={`${btn} bg-stone-900 text-amber-100 w-full`}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'إضافة ملاحظة'}</button>
              </div>
              {actionError && <p className="text-xs text-red-700">{actionError}</p>}
              <ol className="text-[11px] text-stone-500 space-y-1 border-t pt-2 max-h-40 overflow-y-auto">{[...selected.notes].reverse().map((n, i) => <li key={i}><span className="text-stone-400">{fmtDate(n.at)}</span> — {n.by === 'admin' ? '👤 ' : ''}{n.text}</li>)}</ol>
            </div>
          ) : <p className="text-sm text-stone-400">اختر طلباً لعرض التفاصيل.</p>}
        </div>
      </div>
    </>
  );
}

interface ConversationSummary { id: string; visitorId: string; status: Conversation['status']; language: string; serviceId?: string; updatedAt: string; messageCount: number; lastMessage: string; memory: Record<string, string> }

function ConversationsPanel() {
  const { data, error, loading, reload } = useLoad<{ items: ConversationSummary[] }>('/conversations');
  const [selected, setSelected] = useState<Conversation | null>(null);
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);
  const [onlyHandoff, setOnlyHandoff] = useState(false);
  const open = async (id: string) => { const { item } = await adminRequest<{ item: Conversation }>(`/conversations/${id}`); setSelected(item); };
  const items = (data?.items || []).filter((c) => !onlyHandoff || c.status === 'handoff');

  return (
    <>
      <Header title="المحادثات" subtitle="كل محادثات الزوار مع مسار التنفيذ؛ يمكن الرد مباشرة على التحويلات"
        actions={<>
          <label className="flex items-center gap-1.5 text-xs bg-white border border-stone-300 rounded-xl px-3"><input type="checkbox" checked={onlyHandoff} onChange={(e) => setOnlyHandoff(e.target.checked)} />التحويلات فقط</label>
          <button onClick={reload} className={`${btn} bg-white border border-stone-300`}><RefreshCw className="w-4 h-4" /></button>
        </>} />
      <Feedback error={error} loading={loading && !data} />
      <div className="grid lg:grid-cols-5 gap-4">
        <div className="lg:col-span-2 space-y-2 max-h-[75vh] overflow-y-auto">
          {items.length === 0 && !loading && <p className="text-sm text-stone-500">لا توجد محادثات.</p>}
          {items.map((c) => (
            <button key={c.id} onClick={() => void open(c.id)} className={`${card} w-full text-start p-3 hover:border-amber-400 ${selected?.id === c.id ? 'border-amber-500' : ''}`}>
              <div className="flex items-center gap-2 text-xs">
                {c.status === 'handoff' && <span className="rounded-full bg-emerald-100 text-emerald-800 px-2 py-0.5 font-bold flex items-center gap-1"><Headset className="w-3 h-3" />تحويل</span>}
                {c.status === 'closed' && <span className="rounded-full bg-stone-200 px-2 py-0.5">مغلقة</span>}
                <span className="text-stone-500">{c.memory.name || c.visitorId.slice(0, 10)}</span>
                <span className="ms-auto text-stone-400">{fmtDate(c.updatedAt)}</span>
              </div>
              <p className="text-xs text-stone-700 mt-1 truncate">{c.lastMessage}</p>
              <p className="text-[10px] text-stone-400 mt-0.5">{c.messageCount} رسالة · {c.language}{c.serviceId ? ` · ${c.serviceId}` : ''}</p>
            </button>
          ))}
        </div>
        <div className="lg:col-span-3">
          {selected ? (
            <div className={`${card} flex flex-col max-h-[75vh]`}>
              <div className="flex flex-wrap items-center gap-2 pb-2 border-b">
                <b className="text-sm">{selected.memory.name || 'زائر'}</b>
                <span className="text-[11px] text-stone-400" dir="ltr">{selected.visitorId}</span>
                {selected.memory.lastRequestRef && <span className="text-[11px] bg-amber-100 rounded-full px-2" dir="ltr">{selected.memory.lastRequestRef}</span>}
                <select className="ms-auto rounded-lg border border-stone-300 text-xs px-2 py-1" value={selected.status} aria-label="حالة المحادثة"
                  onChange={async (e) => { const { item } = await adminRequest<{ item: Conversation }>(`/conversations/${selected.id}`, send('PATCH', { status: e.target.value })); setSelected(item); reload(); }}>
                  <option value="open">مفتوحة (المساعد)</option><option value="handoff">تحويل لموظف</option><option value="closed">مغلقة</option>
                </select>
              </div>
              <div className="flex-1 overflow-y-auto py-3 space-y-2">
                {selected.messages.map((m, i) => (
                  <div key={i} className={`flex ${m.role === 'user' ? 'justify-start' : 'justify-end'}`}>
                    <div className={`max-w-[85%] rounded-xl px-3 py-2 text-sm whitespace-pre-wrap ${m.role === 'user' ? 'bg-stone-100' : m.engine === 'human' ? 'bg-emerald-50 border border-emerald-200' : 'bg-amber-50 border border-amber-100'}`}>
                      {m.text}
                      <div className="text-[10px] text-stone-400 mt-1">{fmtDate(m.at)}{m.intent ? ` · ${INTENT[m.intent] || m.intent}` : ''}{m.engine ? ` · ${ENGINE_LABEL[m.engine] || m.engine}` : ''}</div>
                      {m.trace && (
                        <details className="mt-1 text-[10px] text-stone-500"><summary className="cursor-pointer">مسار التنفيذ</summary>
                          <ol className="mt-1 space-y-0.5" dir="ltr">{m.trace.map((t, j) => <li key={j}><b>{t.stage}</b> {t.detail}{t.ms !== undefined ? ` (${t.ms}ms)` : ''}</li>)}</ol></details>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <form className="flex gap-2 pt-2 border-t" onSubmit={async (e) => {
                e.preventDefault(); if (!reply.trim()) return; setBusy(true);
                try { const { item } = await adminRequest<{ item: Conversation }>(`/conversations/${selected.id}/reply`, send('POST', { text: reply })); setSelected(item); setReply(''); reload(); }
                finally { setBusy(false); }
              }}>
                <input className={input} value={reply} onChange={(e) => setReply(e.target.value)} placeholder="اكتب رداً بشرياً يظهر للزائر في نفس المحادثة…" aria-label="رد الموظف" />
                <button disabled={busy || !reply.trim()} className={`${btn} bg-emerald-700 text-white`}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4 rotate-180" />}</button>
              </form>
            </div>
          ) : <p className="text-sm text-stone-400">اختر محادثة.</p>}
        </div>
      </div>
    </>
  );
}

/** Generic list + editor used by products, knowledge and services. */
function CollectionPanel<T extends { id: string }>({ path, title, subtitle, empty, blank, summary, Editor }: {
  path: 'products' | 'knowledge' | 'services'; title: string; subtitle: string; empty: string; blank: Partial<T>;
  summary: (item: T) => React.ReactNode; Editor: React.FC<{ value: Partial<T>; onChange: (v: Partial<T>) => void }>;
}) {
  const { data, error, loading, reload } = useLoad<{ items: T[] }>(`/${path}`);
  const [editing, setEditing] = useState<Partial<T> | null>(null);
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState('');
  const save = async () => {
    if (!editing) return;
    setBusy(true); setSaveError('');
    try {
      await adminRequest(editing.id ? `/${path}/${editing.id}` : `/${path}`, send(editing.id ? 'PUT' : 'POST', editing));
      setEditing(null); reload();
    } catch (e) { setSaveError((e as Error).message); } finally { setBusy(false); }
  };
  const remove = async (id: string) => {
    if (!confirm('حذف نهائي؟')) return;
    try { await adminRequest(`/${path}/${id}`, send('DELETE')); if (editing?.id === id) setEditing(null); reload(); }
    catch (e) { setSaveError((e as Error).message); }
  };
  return (
    <>
      <Header title={title} subtitle={subtitle} actions={<button onClick={() => setEditing({ ...blank })} className={`${btn} bg-stone-900 text-amber-100`}><Plus className="w-4 h-4" />إضافة</button>} />
      <Feedback error={error} loading={loading && !data} />
      <div className="grid lg:grid-cols-5 gap-4">
        <div className="lg:col-span-3 space-y-2">
          {data?.items.length === 0 && <p className="text-sm text-stone-500">{empty}</p>}
          {data?.items.map((item) => (
            <div key={item.id} className={`${card} flex items-start gap-3 p-3 ${editing?.id === item.id ? 'border-amber-500' : ''}`}>
              <button className="flex-1 text-start min-w-0" onClick={() => setEditing(structuredClone(item))}>{summary(item)}</button>
              <button onClick={() => void remove(item.id)} aria-label="حذف" className="p-1.5 rounded-lg text-red-600 hover:bg-red-50"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
        </div>
        <div className="lg:col-span-2">
          {editing ? (
            <div className={`${card} space-y-3 lg:sticky lg:top-4`}>
              <h2 className="font-bold text-sm">{editing.id ? 'تعديل' : 'إضافة جديد'}</h2>
              <Editor value={editing} onChange={setEditing} />
              {saveError && <p className="text-xs text-red-700">{saveError}</p>}
              <div className="flex gap-2">
                <button disabled={busy} onClick={save} className={`${btn} bg-stone-900 text-amber-100 flex-1`}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4" />حفظ</>}</button>
                <button onClick={() => setEditing(null)} className={`${btn} bg-stone-100`}>إلغاء</button>
              </div>
            </div>
          ) : <p className="text-sm text-stone-400">اختر عنصراً للتعديل أو أضف جديداً.</p>}
        </div>
      </div>
    </>
  );
}

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => <label className="block text-xs font-semibold text-stone-700 space-y-1"><span>{label}</span>{children}</label>;
const csv = (v?: string[]) => (v || []).join('، ');
const fromCsv = (s: string) => s.split(/[,،]/).map((x) => x.trim()).filter(Boolean);

function ProductsPanel() {
  return (
    <CollectionPanel<Product> path="products" title="المنتجات" subtitle="الكتالوج الوحيد الذي يقتبس منه المساعد الأسعار والمخزون" empty="الكتالوج فارغ — المساعد لن يذكر أي أسعار حتى تضيف منتجات."
      blank={{ nameAr: '', nameEn: '', price: 0, stock: 0, unit: 'piece', category: 'perfume', active: true, tags: [] }}
      summary={(p) => (<>
        <p className="text-sm font-semibold truncate">{p.nameAr || p.nameEn} {p.demo && <span className="text-[10px] bg-stone-200 rounded px-1">تجريبي</span>} {!p.active && <span className="text-[10px] bg-red-100 text-red-800 rounded px-1">مخفي</span>}</p>
        <p className="text-xs text-stone-500"><span dir="ltr">{p.sku}</span> · {p.price} {p.currency} / {p.unit} · مخزون <b className={p.stock <= 3 ? 'text-red-700' : ''}>{p.stock}</b></p>
      </>)}
      Editor={({ value: p, onChange }) => (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <Field label="الاسم بالعربية"><input className={input} value={p.nameAr || ''} onChange={(e) => onChange({ ...p, nameAr: e.target.value })} /></Field>
            <Field label="Name (English)"><input className={input} dir="ltr" value={p.nameEn || ''} onChange={(e) => onChange({ ...p, nameEn: e.target.value })} /></Field>
            <Field label="SKU"><input className={input} dir="ltr" value={p.sku || ''} onChange={(e) => onChange({ ...p, sku: e.target.value })} /></Field>
            <Field label="الفئة"><select className={input} value={p.category} onChange={(e) => onChange({ ...p, category: e.target.value as Product['category'] })}>
              {[['perfume', 'عطر'], ['oil', 'زيت'], ['raw_material', 'مادة خام'], ['packaging', 'عبوات'], ['kit', 'طقم'], ['other', 'أخرى']].map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
            <Field label="السعر"><input className={input} type="number" min={0} step="0.01" value={p.price ?? 0} onChange={(e) => onChange({ ...p, price: Number(e.target.value) })} /></Field>
            <Field label="العملة"><input className={input} dir="ltr" placeholder="EGP" value={p.currency || ''} onChange={(e) => onChange({ ...p, currency: e.target.value })} /></Field>
            <Field label="المخزون"><input className={input} type="number" min={0} step={1} value={p.stock ?? 0} onChange={(e) => onChange({ ...p, stock: Math.floor(Number(e.target.value)) })} /></Field>
            <Field label="الوحدة"><input className={input} value={p.unit || ''} onChange={(e) => onChange({ ...p, unit: e.target.value })} /></Field>
          </div>
          <Field label="الوصف بالعربية"><textarea className={input} rows={2} value={p.descriptionAr || ''} onChange={(e) => onChange({ ...p, descriptionAr: e.target.value })} /></Field>
          <Field label="Description (English)"><textarea className={input} dir="ltr" rows={2} value={p.descriptionEn || ''} onChange={(e) => onChange({ ...p, descriptionEn: e.target.value })} /></Field>
          <Field label="كلمات البحث (مفصولة بفواصل)"><input className={input} value={csv(p.tags)} onChange={(e) => onChange({ ...p, tags: fromCsv(e.target.value) })} /></Field>
          <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={p.active ?? true} onChange={(e) => onChange({ ...p, active: e.target.checked })} />ظاهر للزوار</label>
        </div>
      )} />
  );
}

function KnowledgePanel() {
  return (
    <CollectionPanel<KnowledgeDoc> path="knowledge" title="قاعدة المعرفة" subtitle="المصدر الذي يستند إليه المساعد في الإجابات ويعرضه كمراجع (RAG)" empty="لا توجد مستندات."
      blank={{ title: '', content: '', tags: [] }}
      summary={(d) => (<><p className="text-sm font-semibold truncate">{d.title}</p><p className="text-xs text-stone-500 line-clamp-2">{d.content}</p></>)}
      Editor={({ value: d, onChange }) => (
        <div className="space-y-2">
          <Field label="العنوان"><input className={input} value={d.title || ''} onChange={(e) => onChange({ ...d, title: e.target.value })} /></Field>
          <Field label="المحتوى (سياسات، أسئلة شائعة، شروط الشحن والاسترجاع…)"><textarea className={input} rows={10} value={d.content || ''} onChange={(e) => onChange({ ...d, content: e.target.value })} /></Field>
          <Field label="وسوم (مفصولة بفواصل)"><input className={input} value={csv(d.tags)} onChange={(e) => onChange({ ...d, tags: fromCsv(e.target.value) })} /></Field>
          <Field label="معرف الخدمة المرتبطة (اختياري)"><input className={input} dir="ltr" value={d.serviceId || ''} onChange={(e) => onChange({ ...d, serviceId: e.target.value })} /></Field>
        </div>
      )} />
  );
}

function ServicesPanel() {
  return (
    <CollectionPanel<ServiceDef> path="services" title="الخدمات" subtitle="أضف أي خدمة تجارية جديدة: الكلمات المفتاحية توجّه الزوار إليها، والحقول تحدد استمارة الطلب" empty="لا توجد خدمات."
      blank={{ nameAr: '', nameEn: '', kind: 'custom', enabled: true, keywords: [], formFields: [], order: 50 }}
      summary={(s) => (<>
        <p className="text-sm font-semibold">{s.nameAr} {!s.enabled && <span className="text-[10px] bg-red-100 text-red-800 rounded px-1">معطلة</span>}</p>
        <p className="text-xs text-stone-500" dir="ltr">{s.id} · {s.kind} · {s.formFields.length} fields · {s.keywords.length} keywords</p>
      </>)}
      Editor={function ServiceEditor({ value: s, onChange }) {
        const [fieldsText, setFieldsText] = useState(JSON.stringify(s.formFields || [], null, 1));
        const [jsonError, setJsonError] = useState('');
        useEffect(() => { setFieldsText(JSON.stringify(s.formFields || [], null, 1)); }, [s.id]); // eslint-disable-line react-hooks/exhaustive-deps
        return (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <Field label="الاسم بالعربية"><input className={input} value={s.nameAr || ''} onChange={(e) => onChange({ ...s, nameAr: e.target.value })} /></Field>
              <Field label="Name (English)"><input className={input} dir="ltr" value={s.nameEn || ''} onChange={(e) => onChange({ ...s, nameEn: e.target.value })} /></Field>
              <Field label="النوع"><select className={input} value={s.kind} onChange={(e) => onChange({ ...s, kind: e.target.value as ServiceDef['kind'] })}>
                {[['info', 'معلومات/أدوات'], ['store', 'متجر'], ['custom_order', 'طلب مخصص'], ['b2b', 'جملة B2B'], ['consultation', 'استشارة'], ['support', 'دعم'], ['custom', 'خدمة جديدة']].map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
              <Field label="الترتيب"><input className={input} type="number" value={s.order ?? 50} onChange={(e) => onChange({ ...s, order: Number(e.target.value) })} /></Field>
            </div>
            <Field label="الوصف بالعربية"><textarea className={input} rows={2} value={s.descriptionAr || ''} onChange={(e) => onChange({ ...s, descriptionAr: e.target.value })} /></Field>
            <Field label="Description (English)"><textarea className={input} dir="ltr" rows={2} value={s.descriptionEn || ''} onChange={(e) => onChange({ ...s, descriptionEn: e.target.value })} /></Field>
            <Field label="كلمات التوجيه (مفصولة بفواصل)"><textarea className={input} rows={2} value={csv(s.keywords)} onChange={(e) => onChange({ ...s, keywords: fromCsv(e.target.value) })} /></Field>
            <Field label="حقول الاستمارة (JSON: name, labelAr, labelEn, type, required, options)">
              <textarea className={`${input} font-mono text-[11px]`} dir="ltr" rows={6} value={fieldsText} onChange={(e) => {
                setFieldsText(e.target.value);
                try { const parsed = JSON.parse(e.target.value); if (!Array.isArray(parsed)) throw new Error(); onChange({ ...s, formFields: parsed }); setJsonError(''); }
                catch { setJsonError('JSON غير صالح — لن تُحفظ الحقول حتى يُصحَّح.'); }
              }} />
            </Field>
            {jsonError && <p className="text-[11px] text-red-700">{jsonError}</p>}
            <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={s.enabled ?? true} onChange={(e) => onChange({ ...s, enabled: e.target.checked })} />مفعلة للزوار</label>
          </div>
        );
      }} />
  );
}

function EnginesPanel() {
  const { data, error, loading, reload } = useLoad<{ item: CoreSettings; engines: EngineStatus[] }>('/settings');
  const [form, setForm] = useState<CoreSettings | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => { if (data) setForm(data.item); }, [data]);
  const policy = form?.enginePolicy || [];
  const move = (id: EngineId, delta: number) => {
    if (!form) return;
    const list = [...policy]; const i = list.indexOf(id); const j = i + delta;
    if (i < 0 || j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]]; setForm({ ...form, enginePolicy: list });
  };
  const toggle = (id: EngineId) => form && setForm({ ...form, enginePolicy: policy.includes(id) ? policy.filter((x) => x !== id) : [...policy.filter((x) => x !== 'sham_local'), id, 'sham_local'] });
  const save = async () => {
    if (!form) return; setBusy(true); setMessage('');
    try { await adminRequest('/settings', send('PUT', form)); setMessage('تم الحفظ ✅'); reload(); }
    catch (e) { setMessage((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <>
      <Header title="المحركات والإعدادات" subtitle="سياسة اختيار المحرك مع التحويل التلقائي عند الفشل؛ محرك شام الذاتي هو خط الأمان الأخير دائماً"
        actions={<a href="/api/admin/export" onClick={async (e) => {
          e.preventDefault();
          const response = await fetch('/api/admin/export', { headers: { Authorization: `Bearer ${getToken()}` } });
          const blob = await response.blob(); const url = URL.createObjectURL(blob);
          const a = document.createElement('a'); a.href = url; a.download = `sham-core-backup-${new Date().toISOString().slice(0, 10)}.json`; a.click(); URL.revokeObjectURL(url);
        }} className={`${btn} bg-white border border-stone-300`}><Download className="w-4 h-4" />نسخة احتياطية</a>} />
      <Feedback error={error} loading={loading && !data} />
      {form && data && (
        <div className="grid lg:grid-cols-2 gap-4">
          <div className={`${card} space-y-2`}>
            <h2 className="font-bold text-sm">ترتيب المحركات</h2>
            <p className="text-[11px] text-stone-500">المفاتيح وعناوين الخوادم تُضبط في متغيرات بيئة الخادم فقط ولا تظهر هنا. المحرك غير المهيأ يُتخطى تلقائياً.</p>
            {data.engines.map((engine) => {
              const active = policy.includes(engine.id);
              return (
                <div key={engine.id} className={`flex items-center gap-2 rounded-xl border p-2.5 ${active ? 'border-amber-300 bg-amber-50/50' : 'border-stone-200'}`}>
                  <input type="checkbox" aria-label={engine.name} checked={active || engine.id === 'sham_local'} disabled={engine.id === 'sham_local'} onChange={() => toggle(engine.id)} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold">{ENGINE_LABEL[engine.id]} <span className="text-[10px] text-stone-400" dir="ltr">{engine.model}</span></p>
                    <p className={`text-[11px] ${engine.configured ? 'text-emerald-700' : 'text-stone-400'}`}>{engine.configured ? 'مهيأ (الإعداد موجود؛ لا يضمن صحة المفتاح)' : engine.id === 'self_hosted' ? 'غير مهيأ — اضبط SHAM_LLM_BASE_URL' : 'غير مهيأ — لا يوجد مفتاح'}</p>
                  </div>
                  {active && engine.id !== 'sham_local' && <div className="flex flex-col"><button className="text-xs px-1" onClick={() => move(engine.id, -1)} aria-label="أعلى">▲</button><button className="text-xs px-1" onClick={() => move(engine.id, 1)} aria-label="أسفل">▼</button></div>}
                  {active && <span className="text-[10px] font-bold text-amber-800">#{policy.indexOf(engine.id) + 1}</span>}
                </div>
              );
            })}
            <Field label={`درجة الإبداع (temperature): ${form.temperature}`}><input type="range" min={0} max={1} step={0.05} value={form.temperature} onChange={(e) => setForm({ ...form, temperature: Number(e.target.value) })} className="w-full" /></Field>
          </div>
          <div className={`${card} space-y-2`}>
            <h2 className="font-bold text-sm">هوية المساعد</h2>
            <div className="grid grid-cols-2 gap-2">
              <Field label="الاسم بالعربية"><input className={input} value={form.assistantNameAr} onChange={(e) => setForm({ ...form, assistantNameAr: e.target.value })} /></Field>
              <Field label="Name (English)"><input className={input} dir="ltr" value={form.assistantNameEn} onChange={(e) => setForm({ ...form, assistantNameEn: e.target.value })} /></Field>
            </div>
            <Field label="رسالة الترحيب بالعربية"><textarea className={input} rows={3} value={form.welcomeAr} onChange={(e) => setForm({ ...form, welcomeAr: e.target.value })} /></Field>
            <Field label="Welcome (English)"><textarea className={input} dir="ltr" rows={3} value={form.welcomeEn} onChange={(e) => setForm({ ...form, welcomeEn: e.target.value })} /></Field>
            <Field label="الشخصية وأسلوب الرد"><textarea className={input} rows={2} value={form.personaAr} onChange={(e) => setForm({ ...form, personaAr: e.target.value })} /></Field>
            <div className="grid grid-cols-3 gap-2">
              <Field label="العملة الافتراضية"><input className={input} dir="ltr" value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} /></Field>
              <Field label="مواعيد العمل"><input className={input} value={form.businessHours} onChange={(e) => setForm({ ...form, businessHours: e.target.value })} /></Field>
              <Field label="تواصل مباشر"><input className={input} value={form.handoffContact} onChange={(e) => setForm({ ...form, handoffContact: e.target.value })} placeholder="واتساب / هاتف" /></Field>
            </div>
            <button disabled={busy} onClick={save} className={`${btn} bg-stone-900 text-amber-100 w-full`}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4" />حفظ الإعدادات</>}</button>
            {message && <p className="text-xs text-center">{message}</p>}
          </div>
        </div>
      )}
    </>
  );
}

interface SandboxReply { reply: string; engine: { id: string; name: string }; intent: string; actions: { type: string; serviceId?: string }[]; citations: { title: string }[]; trace?: { stage: string; detail: string; ms?: number }[] }

function SandboxPanel() {
  const [message, setMessage] = useState('');
  const [language, setLanguage] = useState('ar');
  const [log, setLog] = useState<{ q: string; r?: SandboxReply; error?: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const samples = useMemo(() => ['عايز اشتري زيت عود', 'محتاج عرض سعر جملة لمحل', 'يعني ايه تعتيق العطر؟', '50 مل بتركيز 20%', 'عايز أكلم موظف', 'What services do you offer?'], []);
  const run = async (q: string) => {
    if (!q.trim()) return; setBusy(true);
    try { const r = await adminRequest<SandboxReply>('/test-chat', send('POST', { message: q, language })); setLog((l) => [{ q, r }, ...l]); }
    catch (e) { setLog((l) => [{ q, error: (e as Error).message }, ...l]); } finally { setBusy(false); setMessage(''); }
  };
  return (
    <>
      <Header title="مختبر المساعد" subtitle="جرّب نفس مسار الزوار مع عرض كامل لخطوات التنفيذ (التوجيه، الاسترجاع، الأدوات، المحرك)" />
      <form className={`${card} flex flex-wrap gap-2`} onSubmit={(e) => { e.preventDefault(); void run(message); }}>
        <input className={`${input} flex-1 min-w-[200px]`} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="اكتب رسالة اختبار…" aria-label="رسالة اختبار" />
        <select className={`${input} w-24`} value={language} onChange={(e) => setLanguage(e.target.value)} aria-label="اللغة"><option value="ar">ar</option><option value="en">en</option><option value="fr">fr</option></select>
        <button disabled={busy} className={`${btn} bg-stone-900 text-amber-100`}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'تشغيل'}</button>
        <div className="w-full flex flex-wrap gap-1.5">{samples.map((s) => <button type="button" key={s} onClick={() => void run(s)} className="text-[11px] rounded-full border border-stone-300 px-2.5 py-1 hover:bg-amber-50">{s}</button>)}</div>
      </form>
      <div className="space-y-3 mt-4">
        {log.map((entry, i) => (
          <div key={i} className={card}>
            <p className="text-sm font-semibold">🧑 {entry.q}</p>
            {entry.error && <p className="text-xs text-red-700 mt-2">{entry.error}</p>}
            {entry.r && (
              <div className="mt-2 grid md:grid-cols-2 gap-3">
                <div>
                  <p className="text-sm whitespace-pre-wrap bg-amber-50 rounded-xl p-3">{entry.r.reply}</p>
                  <p className="text-[11px] text-stone-500 mt-1">المحرك: <b>{ENGINE_LABEL[entry.r.engine.id] || entry.r.engine.name}</b> · النية: <b>{INTENT[entry.r.intent] || entry.r.intent}</b> · بطاقات: {entry.r.actions.map((a) => a.type + (a.serviceId ? `:${a.serviceId}` : '')).join('، ') || '—'}</p>
                  {entry.r.citations.length > 0 && <p className="text-[11px] text-stone-500">المراجع: {entry.r.citations.map((c) => c.title).join(' · ')}</p>}
                </div>
                <ol className="text-[11px] bg-stone-900 text-stone-100 rounded-xl p-3 space-y-1 font-mono overflow-x-auto" dir="ltr">
                  {entry.r.trace?.map((t, j) => <li key={j}><span className="text-amber-400">{t.stage}</span> {t.detail}{t.ms !== undefined ? <span className="text-stone-400"> {t.ms}ms</span> : null}</li>)}
                </ol>
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );
}

function NotifyTest() {
  const [state, setState] = useState<'idle' | 'busy' | 'ok' | 'fail'>('idle');
  return (
    <button type="button" disabled={state === 'busy'} onClick={async () => {
      setState('busy');
      try { const r = await adminRequest<{ delivered: boolean }>('/notifications/test', send('POST', {})); setState(r.delivered ? 'ok' : 'fail'); }
      catch { setState('fail'); }
    }} className={`${btn} mt-3 bg-stone-100 border border-stone-300 text-xs`}>
      {state === 'busy' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <BellRing className="w-3.5 h-3.5" />}
      {state === 'ok' ? 'تم إرسال إشعار تجريبي ✅' : state === 'fail' ? 'فشل الإرسال — راجع الرابط' : 'إرسال إشعار تجريبي'}
    </button>
  );
}

const AGENT_PRESETS = ['تقرير اليوم الكامل', 'إيه الطلبات المتأخرة؟', 'المخزون اللي قرب يخلص', 'الزوار سألوا عن إيه ومالقوش إجابة؟', 'رضا العملاء عامل إزاي؟', 'المبيعات والقيمة المتوقعة'];
const SEVERITY: Record<AgentResult['sections'][number]['severity'], { cls: string; icon: React.ReactNode }> = {
  ok: { cls: 'border-emerald-200 bg-emerald-50/50', icon: <CheckCircle2 className="w-4 h-4 text-emerald-600" /> },
  warn: { cls: 'border-amber-300 bg-amber-50/60', icon: <TriangleAlert className="w-4 h-4 text-amber-600" /> },
  alert: { cls: 'border-red-300 bg-red-50/60', icon: <CircleAlert className="w-4 h-4 text-red-600" /> },
};
const TAB_IDS = new Set<string>(TABS.map((t) => t.id));

/** Manus-style operations agent: plan → run read-only tools → report with next actions. */
function AgentPanel({ go }: { go: (t: Tab) => void }) {
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<AgentResult | null>(null);
  const [asked, setAsked] = useState('');
  const run = async (text: string) => {
    const q = text.trim() || 'تقرير اليوم الكامل';
    setBusy(true); setError(''); setAsked(q);
    try { setResult(await adminRequest<AgentResult>('/agent', send('POST', { message: q }))); }
    catch (e) { setError(e instanceof Error ? e.message : 'فشل التشغيل'); }
    finally { setBusy(false); }
  };
  return (
    <>
      <Header title="المساعد الإداري" subtitle="وكيل عمليات يخطط وينفذ أدوات قراءة فقط على بيانات شام ثم يكتب تقريراً بخطوات قابلة للتنفيذ. لا يعدّل أي بيانات بنفسه." />
      <form className={`${card} space-y-3`} onSubmit={(e) => { e.preventDefault(); void run(message); }}>
        <div className="flex gap-2">
          <input className={input} value={message} onChange={(e) => setMessage(e.target.value.slice(0, 1000))} placeholder="اطلب تقريراً… مثال: إيه اللي محتاج انتباهي النهارده؟" aria-label="طلب للمساعد الإداري" />
          <button disabled={busy} className={`${btn} bg-stone-900 text-amber-100 shrink-0`}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}تشغيل</button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {AGENT_PRESETS.map((p) => <button key={p} type="button" disabled={busy} onClick={() => { setMessage(p); void run(p); }} className="text-xs rounded-full border border-amber-300 bg-amber-50 px-3 py-1 hover:bg-amber-100 disabled:opacity-50">{p}</button>)}
        </div>
      </form>
      {error && <p role="alert" className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      {busy && <div className="mt-4 flex items-center gap-2 text-sm text-stone-500"><Loader2 className="w-4 h-4 animate-spin" />الوكيل يخطط وينفذ المهام…</div>}
      {result && !busy && (
        <div className="mt-4 grid lg:grid-cols-[260px_1fr] gap-4">
          <div className={card}>
            <h2 className="font-bold text-sm mb-1">الخطة المنفذة</h2>
            <p className="text-[11px] text-stone-500 mb-3">«{asked}»</p>
            <ol className="border-s-2 border-amber-300 ps-3 space-y-2">
              {result.plan.map((step, i) => (
                <li key={step.task} className="text-xs flex items-start gap-1.5">
                  {step.status === 'done' ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 mt-0.5 shrink-0" /> : <CircleAlert className="w-3.5 h-3.5 text-red-600 mt-0.5 shrink-0" />}
                  <span><b>{i + 1}.</b> {step.title} <span className="text-stone-400" dir="ltr">{step.ms}ms</span></span>
                </li>
              ))}
            </ol>
            <p className="text-[10px] text-stone-400 mt-3">صياغة الملخص: {ENGINE_LABEL[result.engine] || result.engine}</p>
          </div>
          <div className="space-y-3">
            <div className={`${card} border-amber-300`}>
              <h2 className="font-bold text-sm mb-2 flex items-center gap-1.5"><Wand2 className="w-4 h-4 text-amber-700" />الملخص</h2>
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{result.summary}</p>
              {result.nextActions.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {result.nextActions.map((a) => (
                    <button key={a.text} type="button" onClick={() => TAB_IDS.has(a.tab) && go(a.tab as Tab)} className={`${btn} text-xs bg-stone-900 text-amber-100`}>{a.text} ←</button>
                  ))}
                </div>
              )}
            </div>
            <div className="grid md:grid-cols-2 gap-3">
              {result.sections.map((section) => (
                <div key={section.task} className={`rounded-2xl border p-4 ${SEVERITY[section.severity].cls}`}>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <h3 className="font-bold text-sm flex items-center gap-1.5">{SEVERITY[section.severity].icon}{section.title}</h3>
                    {TAB_IDS.has(section.tab) && <button type="button" onClick={() => go(section.tab as Tab)} className="text-[11px] text-stone-600 hover:underline">فتح ←</button>}
                  </div>
                  <ul className="text-xs space-y-1 text-stone-700 list-disc ps-4">{section.lines.map((line, i) => <li key={i}>{line}</li>)}</ul>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/** The learning loop: unanswered questions + rated answers → new knowledge-base documents. */
function QualityPanel() {
  const gaps = useLoad<{ items: KnowledgeGap[] }>('/gaps');
  const feedback = useLoad<{ items: FeedbackItem[] }>('/feedback');
  const [view, setView] = useState<'open' | 'all'>('open');
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState({ title: '', content: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const items = (gaps.data?.items || []).filter((g) => view === 'all' || g.status === 'open');
  const ups = feedback.data?.items.filter((f) => f.rating === 'up').length || 0;
  const downs = feedback.data?.items.filter((f) => f.rating === 'down').length || 0;
  const rate = ups + downs ? Math.round((ups / (ups + downs)) * 100) : null;

  const patch = async (id: string, body: unknown) => {
    setBusy(true); setError('');
    try { await adminRequest(`/gaps/${encodeURIComponent(id)}`, send('PATCH', body)); setEditing(null); gaps.reload(); }
    catch (e) { setError(e instanceof Error ? e.message : 'فشل الحفظ'); }
    finally { setBusy(false); }
  };

  return (
    <>
      <Header title="الجودة والتعلّم" subtitle="كل سؤال لم يجد إجابة أو رد قيّمه زائر سلبياً يتحول لفجوة. اكتب الإجابة مرة واحدة فتُضاف لقاعدة المعرفة ويستخدمها المساعد فوراً."
        actions={<button onClick={() => { gaps.reload(); feedback.reload(); }} className={`${btn} bg-white border border-stone-300`}><RefreshCw className="w-4 h-4" />تحديث</button>} />
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className={card}><p className="text-xs text-stone-500">فجوات مفتوحة</p><p className="text-3xl font-bold text-orange-700">{gaps.data?.items.filter((g) => g.status === 'open').length ?? '…'}</p></div>
        <div className={card}><p className="text-xs text-stone-500">نسبة الرضا</p><p className="text-3xl font-bold text-emerald-700">{rate === null ? '—' : `${rate}%`}</p></div>
        <div className={card}><p className="text-xs text-stone-500">التقييمات</p><p className="text-lg font-bold mt-2"><span className="text-emerald-700">👍 {ups}</span> · <span className="text-red-700">👎 {downs}</span></p></div>
      </div>
      {error && <p role="alert" className="mb-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      <div className="grid xl:grid-cols-2 gap-4">
        <section className={card}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-sm flex items-center gap-1.5"><Lightbulb className="w-4 h-4 text-amber-600" />فجوات المعرفة</h2>
            <div className="flex text-xs rounded-lg border border-stone-200 overflow-hidden">
              {(['open', 'all'] as const).map((v) => <button key={v} type="button" onClick={() => setView(v)} className={`px-2.5 py-1 ${view === v ? 'bg-stone-900 text-white' : ''}`}>{v === 'open' ? 'المفتوحة' : 'الكل'}</button>)}
            </div>
          </div>
          <Feedback error={gaps.error} loading={gaps.loading && !gaps.data} />
          {gaps.data && !items.length && <p className="text-xs text-stone-400 py-4 text-center">لا توجد فجوات {view === 'open' ? 'مفتوحة' : ''} — ممتاز.</p>}
          <ul className="space-y-2">
            {items.map((g) => (
              <li key={g.id} className="rounded-xl border border-stone-200 p-3 text-sm">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold">{g.question}</p>
                  <span className="shrink-0 text-[11px] rounded-full bg-stone-100 px-2 py-0.5">×{g.count}</span>
                </div>
                <p className="text-[11px] text-stone-500 mt-1">
                  {g.source === 'no_answer' ? 'لم يجد المساعد إجابة' : `تقييم سلبي${g.reason ? `: ${g.reason}` : ''}`} · آخر مرة {fmtDate(g.lastAt)}
                  {g.status !== 'open' && <b className="ms-1">{g.status === 'resolved' ? '· تم الحل ✅' : '· متجاهلة'}</b>}
                </p>
                {g.lastAnswer && <p className="mt-1.5 text-[11px] text-stone-500 line-clamp-2 bg-stone-50 rounded-lg p-1.5">رد المساعد: {g.lastAnswer}</p>}
                {editing === g.id ? (
                  <form className="mt-2 space-y-2" onSubmit={(e) => { e.preventDefault(); void patch(g.id, draft); }}>
                    <input className={input} required value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="عنوان المستند" aria-label="عنوان المستند" />
                    <textarea className={input} required rows={4} value={draft.content} onChange={(e) => setDraft({ ...draft, content: e.target.value })} placeholder="الإجابة الصحيحة كما يجب أن يقولها المساعد" aria-label="الإجابة" />
                    <div className="flex gap-2">
                      <button disabled={busy} className={`${btn} bg-emerald-700 text-white`}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}حفظ في قاعدة المعرفة</button>
                      <button type="button" onClick={() => setEditing(null)} className={`${btn} border border-stone-300`}>إلغاء</button>
                    </div>
                  </form>
                ) : g.status === 'open' ? (
                  <div className="mt-2 flex gap-2">
                    <button type="button" onClick={() => { setEditing(g.id); setDraft({ title: g.question.slice(0, 120), content: '' }); }} className={`${btn} text-xs bg-stone-900 text-amber-100`}><BookOpen className="w-3.5 h-3.5" />أضف الإجابة</button>
                    <button type="button" disabled={busy} onClick={() => void patch(g.id, { status: 'ignored' })} className={`${btn} text-xs border border-stone-300`}><EyeOff className="w-3.5 h-3.5" />تجاهل</button>
                  </div>
                ) : g.status === 'ignored' ? (
                  <button type="button" disabled={busy} onClick={() => void patch(g.id, { status: 'open' })} className="mt-2 text-[11px] text-stone-600 hover:underline">إعادة فتح</button>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
        <section className={card}>
          <h2 className="font-bold text-sm mb-3">آخر التقييمات</h2>
          <Feedback error={feedback.error} loading={feedback.loading && !feedback.data} />
          {feedback.data && !feedback.data.items.length && <p className="text-xs text-stone-400 py-4 text-center">لم يقيّم الزوار أي رد بعد.</p>}
          <ul className="space-y-2 max-h-[70vh] overflow-y-auto">
            {feedback.data?.items.map((f) => (
              <li key={`${f.conversationId}-${f.messageId}`} className={`rounded-xl border p-3 text-xs ${f.rating === 'down' ? 'border-red-200' : 'border-emerald-200'}`}>
                <div className="flex items-center gap-1.5 font-semibold">
                  {f.rating === 'up' ? <ThumbsUp className="w-3.5 h-3.5 text-emerald-600" /> : <ThumbsDown className="w-3.5 h-3.5 text-red-600" />}
                  <span className="truncate">{f.question || '—'}</span>
                </div>
                <p className="mt-1 text-stone-600 line-clamp-3">{f.answer}</p>
                <p className="mt-1 text-[10px] text-stone-400">{fmtDate(f.at)} · {ENGINE_LABEL[f.engine || ''] || f.engine} {f.intent ? `· ${INTENT[f.intent] || f.intent}` : ''}{f.reason ? ` · السبب: ${f.reason}` : ''}</p>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}
