import { T, adminDir, useAdminLanguage } from './adminL10n';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity, ArrowRight, ArrowDownToLine, BookOpen, Bot, Boxes, ClipboardList, Cpu, Database, Download, FlaskConical, Headset, KeyRound,
  BellRing, CheckCircle2, CircleAlert, EyeOff, LayoutDashboard, Lightbulb, Loader2, LogOut, MessagesSquare, Plus, RefreshCw, Save, Send,
  Settings2, Stethoscope, ThumbsDown, ThumbsUp, Trash2, TriangleAlert, Users, Wand2,
  ChevronUp, ChevronDown, Mail, Eye, ExternalLink, Check, Sparkles,
} from 'lucide-react';
import UpdatesPanel from './UpdatesPanel';
import SupervisorPanel from './SupervisorPanel';
import type {
  Conversation, CoreSettings, CouncilMember, CouncilRole, CouncilTranscript, EngineId, KnowledgeDoc, KnowledgeGap, ModelEngineId, Product, RequestStatus, ServiceDef, ServiceRequest, ShaheenSettings,
} from '../../server/core/types';
import type { AgentResult } from '../../server/core/adminAgent';
import { AdminApiError, adminRequest, getToken, send, setToken } from './adminApi';
import { apiUrl, isStaticHosting } from '../utils/api';
import { parseDoctorIssue, type DoctorReport } from './doctorReport';

type Tab = 'overview' | 'agent' | 'quality' | 'requests' | 'conversations' | 'products' | 'knowledge' | 'services' | 'engines' | 'shaheen' | 'emails' | 'doctor' | 'supervisor' | 'sandbox' | 'updates';
interface EngineStatus { id: EngineId; name: string; model: string; configured: boolean; kind: string }
interface Overview {
  storage: { kind: string; persistent: boolean; error?: string };
  engines: EngineStatus[]; policy: EngineId[];
  counts: Record<string, number>;
  byStatus: Record<string, number>; byType: Record<string, number>; intents: Record<string, number>; engineUsage: Record<string, number>; pipelineValue: Record<string, number>;
  notifications?: { configured: boolean };
  emailNotifications?: { configured: boolean; provider: string; sentCount: number };
}
interface FeedbackItem { conversationId: string; messageId?: string; rating: 'up' | 'down'; reason?: string; at: string; question: string; answer: string; engine?: string; intent?: string }

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'overview', label: T('نظرة عامة'), icon: <LayoutDashboard className="w-4 h-4" /> },
  { id: 'agent', label: T('المساعد الإداري'), icon: <Wand2 className="w-4 h-4" /> },
  { id: 'quality', label: T('الجودة والتعلّم'), icon: <Lightbulb className="w-4 h-4" /> },
  { id: 'requests', label: T('الطلبات والعروض'), icon: <ClipboardList className="w-4 h-4" /> },
  { id: 'emails', label: T('إشعارات البريد'), icon: <Mail className="w-4 h-4" /> },
  { id: 'conversations', label: T('المحادثات'), icon: <MessagesSquare className="w-4 h-4" /> },
  { id: 'products', label: T('المنتجات'), icon: <Boxes className="w-4 h-4" /> },
  { id: 'knowledge', label: T('قاعدة المعرفة'), icon: <BookOpen className="w-4 h-4" /> },
  { id: 'services', label: T('الخدمات'), icon: <Settings2 className="w-4 h-4" /> },
  { id: 'engines', label: T('المحركات والإعدادات'), icon: <Cpu className="w-4 h-4" /> },
  { id: 'shaheen', label: T('الخبير شاهين'), icon: <FlaskConical className="w-4 h-4" /> },
  { id: 'doctor', label: T('طبيب شاهين'), icon: <Stethoscope className="w-4 h-4" /> },
  { id: 'supervisor', label: T('مشرف الذكاء الاصطناعي'), icon: <Sparkles className="w-4 h-4" /> },
  { id: 'sandbox', label: T('مختبر المساعد'), icon: <FlaskConical className="w-4 h-4" /> },
  { id: 'updates', label: T('بيئة التحديثات'), icon: <ArrowDownToLine className="w-4 h-4" /> },
];

const STATUS: Record<RequestStatus, string> = { new: T('جديد'), in_progress: T('قيد التنفيذ'), quoted: T('عرض سعر'), confirmed: T('مؤكد'), completed: T('مكتمل'), cancelled: T('ملغي') };
const TYPE: Record<string, string> = { order: T('طلب متجر'), custom_formula: T('عطر مخصص'), b2b_quote: T('عرض جملة'), consultation: T('استشارة'), support: T('دعم'), service: T('خدمة') };
const INTENT: Record<string, string> = { greeting: T('تحية'), thanks: T('شكر'), list_services: T('عرض الخدمات'), track_order: T('تتبع'), browse_products: T('تصفح منتجات'), service_request: T('طلب خدمة'), handoff: T('تحويل لموظف'), calculate: T('حساب'), perfume_expert: T('سؤال خبير'), question: T('سؤال عام'), memory_view: T('عرض الذاكرة'), forget: T('حذف البيانات') };
const ENGINE_LABEL: Record<string, string> = { self_hosted: T('نموذج مفتوح مستضاف ذاتياً'), gemini: 'Gemini', openai: 'OpenAI', claude: 'Claude', deepseek: 'DeepSeek', openrouter: 'OpenRouter', sham_local: T('محرك شام الذاتي'), human: T('موظف'), system: T('النظام') };

const COUNCIL_ROLE: Record<CouncilRole, string> = { formulator: T('خبير التركيب والمواد'), commercial: T('المستشار التجاري'), safety: T('مراجع السلامة والجودة'), customer: T('صوت العميل'), general: T('مستشار عام') };
const COUNCIL_INTENTS = ['perfume_expert', 'question', 'service_request', 'browse_products', 'list_services'];
const MODEL_ENGINES: ModelEngineId[] = ['self_hosted', 'gemini', 'openai', 'claude', 'deepseek', 'openrouter'];

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
  // Admin panel follows the language chosen on the public site (Arabic fallback).
  useAdminLanguage();
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
      setLoginError(e instanceof AdminApiError ? (e.status === 401 ? T('رمز الإدارة غير صحيح.') : e.status === 503 ? T('لوحة الإدارة غير مفعلة: اضبط SHAM_ADMIN_TOKEN (12 حرفاً على الأقل) في متغيرات الخادم.') : e.status === 429 ? T('محاولات كثيرة فاشلة. انتظر 15 دقيقة.') : e.message) : T('تعذّر الاتصال بالخادم.'));
    } finally { setChecking(false); }
  }, []);

  useEffect(() => { if (token) void login(token); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { document.documentElement.dir = 'rtl'; document.documentElement.lang = 'ar'; document.title = T('إدارة شام — Sham Core'); }, []);

  if (isStaticHosting) {
    return <Shell><div className={`${card} max-w-lg mx-auto mt-24 text-center`}>{T('لوحة الإدارة تحتاج خادم شام (Node.js أو Vercel). نسخة GitHub Pages ثابتة ولا تحتوي على API.')}</div></Shell>;
  }

  if (!authed) {
    return (
      <Shell>
        <form className={`${card} max-w-sm mx-auto mt-24 space-y-4`} onSubmit={(e) => { e.preventDefault(); void login(token.trim()); }}>
          <div className="flex items-center gap-2"><KeyRound className="w-5 h-5 text-amber-700" /><h1 className="font-bold text-lg">{T('إدارة شام — Sham Core')}</h1></div>
          <p className="text-xs text-stone-500">أدخل رمز الإدارة المضبوط في متغير الخادم <code dir="ltr">SHAM_ADMIN_TOKEN</code>{T('. يُحفظ الرمز في هذه الجلسة فقط.')}</p>
          <input className={input} type="password" dir="ltr" autoComplete="current-password" value={token} onChange={(e) => setTok(e.target.value)} placeholder="Admin token" aria-label={T('رمز الإدارة')} />
          {loginError && <p role="alert" className="text-xs text-red-700">{loginError}</p>}
          <button disabled={checking || !token.trim()} className={`${btn} w-full bg-stone-900 text-amber-100`}>{checking ? <Loader2 className="w-4 h-4 animate-spin" /> : 'دخول'}</button>
          <a href="#home" className="block text-center text-xs text-stone-500 hover:underline">{T('العودة إلى الموقع')}</a>
        </form>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="flex flex-col lg:flex-row min-h-screen">
        <aside className="lg:w-60 bg-stone-900 text-stone-100 lg:min-h-screen p-3 flex lg:flex-col gap-1 overflow-x-auto shrink-0">
          <div className="hidden lg:flex items-center gap-2 px-2 py-3 mb-2 border-b border-stone-700"><Bot className="w-6 h-6 text-amber-400" /><div><p className="font-bold text-sm">Sham Core</p><p className="text-[10px] text-stone-400">{T('مركز إدارة المساعد والخدمات')}</p></div></div>
          {TABS.map((t) => (
            <button key={t.id} type="button" onClick={() => setTab(t.id)} className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm whitespace-nowrap ${tab === t.id ? 'bg-amber-500 text-stone-950 font-bold' : 'hover:bg-white/10'}`}>{t.icon}{t.label}</button>
          ))}
          <div className="lg:mt-auto flex lg:flex-col gap-1">
            <a href="#home" className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm hover:bg-white/10 whitespace-nowrap"><ArrowRight className="w-4 h-4" />{T('الموقع')}</a>
            <button type="button" onClick={() => { setToken(''); setAuthed(false); setTok(''); }} className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm hover:bg-white/10 whitespace-nowrap"><LogOut className="w-4 h-4" />{T('خروج')}</button>
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
          {tab === 'shaheen' && <ShaheenPanel />}
          {tab === 'emails' && <EmailsPanel />}
          {tab === 'doctor' && <DoctorPanel />}
          {tab === 'supervisor' && <SupervisorPanel />}
          {tab === 'sandbox' && <SandboxPanel />}
          {tab === 'updates' && <UpdatesPanel />}
        </main>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div dir={adminDir()} className="min-h-screen bg-stone-100 text-stone-900 font-sans">{children}</div>;
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
  if (loading) return <div className="flex items-center gap-2 text-sm text-stone-500 py-6"><Loader2 className="w-4 h-4 animate-spin" />{T('جارٍ التحميل…')}</div>;
  if (error) return <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>;
  return null;
}

function Bars({ data, labels }: { data: Record<string, number>; labels?: Record<string, string> }) {
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...entries.map(([, v]) => v));
  if (!entries.length) return <p className="text-xs text-stone-400">{T('لا توجد بيانات بعد.')}</p>;
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
      <Header title={T('نظرة عامة')} subtitle={T('حالة المساعد والخدمات والطلبات')} actions={<button onClick={reload} className={`${btn} bg-white border border-stone-300`}><RefreshCw className="w-4 h-4" />{T('تحديث')}</button>} />
      <Feedback error={error} loading={loading && !data} />
      {data && (
        <div className="space-y-4">
          {(!data.storage.persistent || data.storage.error) && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
              <b>{T('تنبيه التخزين:')}</b> {data.storage.error ? `إعداد التخزين غير صحيح (${data.storage.error}). يعمل النظام مؤقتاً في الذاكرة.` : 'التخزين الحالي في الذاكرة فقط وسيُفقد عند إعادة التشغيل.'} اضبط <code dir="ltr">SHAM_STORE=file</code> على سيرفر Node أو <code dir="ltr">SHAM_STORE=firestore</code> على Vercel/Firebase.
            </div>
          )}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              [T('طلبات جديدة'), data.counts.requestsNew, 'requests', 'text-amber-700'],
              [T('تحويلات لموظف مفتوحة'), data.counts.handoffsOpen, 'conversations', 'text-emerald-700'],
              [T('محادثات آخر 24 ساعة'), data.counts.conversations24h, 'conversations', 'text-stone-800'],
              [T('منتجات مخزونها منخفض'), data.counts.lowStock, 'products', 'text-red-700'],
              [T('أسئلة بلا إجابة (فجوات)'), data.counts.gapsOpen ?? 0, 'quality', 'text-orange-700'],
              [T('تقييمات إيجابية 👍'), data.counts.feedbackUp ?? 0, 'quality', 'text-emerald-700'],
              [T('تقييمات سلبية 👎'), data.counts.feedbackDown ?? 0, 'quality', 'text-red-700'],
            ].map(([label, value, target, color]) => (
              <button key={label as string} onClick={() => go(target as Tab)} className={`${card} text-start hover:border-amber-400`}>
                <p className="text-xs text-stone-500">{label}</p><p className={`text-3xl font-bold mt-1 ${color}`}>{value as number}</p>
              </button>
            ))}
          </div>
          <div className="grid md:grid-cols-3 gap-3">
            <div className={card}><h2 className="font-bold text-sm mb-3 flex items-center gap-1.5"><Activity className="w-4 h-4" />{T('نوايا الزوار')}</h2><Bars data={data.intents} labels={INTENT} /></div>
            <div className={card}><h2 className="font-bold text-sm mb-3">{T('الطلبات حسب الحالة')}</h2><Bars data={data.byStatus} labels={STATUS} /></div>
            <div className={card}><h2 className="font-bold text-sm mb-3">{T('المحركات التي ردّت فعلياً')}</h2><Bars data={data.engineUsage} labels={ENGINE_LABEL} /></div>
          </div>
          <div className="grid md:grid-cols-3 gap-3">
            <div className={card}><h2 className="font-bold text-sm mb-3">{T('الطلبات حسب النوع')}</h2><Bars data={data.byType} labels={TYPE} /></div>
            <div className={card}>
              <h2 className="font-bold text-sm mb-3">{T('قيمة طلبات المتجر (غير الملغاة)')}</h2>
              {Object.keys(data.pipelineValue).length ? Object.entries(data.pipelineValue).map(([c, v]) => <p key={c} className="text-2xl font-bold">{v.toLocaleString('ar-EG')} <span className="text-sm">{c}</span></p>) : <p className="text-xs text-stone-400">{T('لا توجد طلبات متجر بعد.')}</p>}
              <p className="text-[11px] text-stone-400 mt-2">{T('قيمة تقديرية قبل تأكيد الشحن والدفع.')}</p>
            </div>
            <div className={card}>
              <h2 className="font-bold text-sm mb-3 flex items-center gap-1.5"><Database className="w-4 h-4" />{T('البنية')}</h2>
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
  const [emailNotice, setEmailNotice] = useState<{ message: string; isError?: boolean } | null>(null);

  // Email notification states
  const [notifyCustomer, setNotifyCustomer] = useState(true);
  const [customEmailNote, setCustomEmailNote] = useState('');
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [previewData, setPreviewData] = useState<{ subject: string; html: string; text: string; recipientEmail: string; customerName: string } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [sendingManualEmail, setSendingManualEmail] = useState(false);

  // Auto-enable notifyCustomer when selecting a request with email
  useEffect(() => {
    if (selected?.contact.email) {
      setNotifyCustomer(true);
    }
    setCustomEmailNote('');
    setEmailNotice(null);
  }, [selected?.id]);

  const update = async (patch: { status?: RequestStatus; note?: string; notifyCustomer?: boolean; customEmailNote?: string }) => {
    if (!selected) return;
    setBusy(true); setActionError(''); setEmailNotice(null);
    try {
      const payload = {
        ...patch,
        notifyCustomer: patch.status ? notifyCustomer : undefined,
        customEmailNote: patch.status && customEmailNote.trim() ? customEmailNote.trim() : undefined,
      };
      const response = await adminRequest<{
        item: ServiceRequest;
        emailNotification?: { success: boolean; delivery: string; provider: string; recipient: string; error?: string };
      }>(`/requests/${selected.id}`, send('PATCH', payload));

      setSelected(response.item);
      setNote('');
      setCustomEmailNote('');
      reload();

      if (response.emailNotification) {
        if (response.emailNotification.success) {
          setEmailNotice({
            message: `✉️ تم إرسال إشعار بالبريد الإلكتروني للعميل (${response.emailNotification.recipient}) بنجاح عبر ${response.emailNotification.provider}`,
          });
        } else {
          setEmailNotice({
            message: `⚠️ تنبيه إرسال البريد: ${response.emailNotification.error || 'تعذر الإرسال'}`,
            isError: true,
          });
        }
      }
    } catch (e) {
      setActionError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const openEmailPreview = async (targetStatus?: RequestStatus) => {
    if (!selected) return;
    setPreviewLoading(true);
    try {
      const statusParam = targetStatus || selected.status;
      const noteParam = customEmailNote.trim() ? `&customNote=${encodeURIComponent(customEmailNote.trim())}` : '';
      const { preview } = await adminRequest<{ preview: { subject: string; html: string; text: string; recipientEmail: string; customerName: string } }>(
        `/requests/${selected.id}/email-preview?status=${statusParam}${noteParam}`
      );
      setPreviewData(preview);
      setPreviewModalOpen(true);
    } catch (e) {
      setActionError((e as Error).message);
    } finally {
      setPreviewLoading(false);
    }
  };

  const sendManualNotification = async () => {
    if (!selected || !selected.contact.email) return;
    setSendingManualEmail(true); setEmailNotice(null);
    try {
      const response = await adminRequest<{
        ok: boolean;
        item: ServiceRequest;
        emailNotification: { success: boolean; delivery: string; provider: string; recipient: string; error?: string };
      }>(`/requests/${selected.id}/notify-email`, send('POST', {
        status: selected.status,
        customNote: customEmailNote.trim() || undefined,
      }));
      setSelected(response.item);
      reload();
      if (response.emailNotification.success) {
        setEmailNotice({
          message: `✉️ تم إرسال إشعار البريد الإلكتروني فورياً إلى ${response.emailNotification.recipient} (${response.emailNotification.provider})`,
        });
      } else {
        setEmailNotice({
          message: `⚠️ فشل إرسال البريد: ${response.emailNotification.error || 'خطأ غير معروف'}`,
          isError: true,
        });
      }
    } catch (e) {
      setActionError((e as Error).message);
    } finally {
      setSendingManualEmail(false);
    }
  };

  return (
    <>
      <Header
        title={T('الطلبات والعروض')}
        subtitle={T('طلبات المتجر، العطور المخصصة، الجملة، الاستشارات مع نظام إشعارات البريد التلقائي للعملاء')}
        actions={<>
          <select className={input} value={filter} onChange={(e) => setFilter(e.target.value as RequestStatus | '')} aria-label={T('تصفية حسب الحالة')}>
            <option value="">{T('كل الحالات')}</option>
            {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <button onClick={reload} className={`${btn} bg-white border border-stone-300`}><RefreshCw className="w-4 h-4" /></button>
        </>}
      />
      <Feedback error={error} loading={loading && !data} />
      <div className="grid lg:grid-cols-5 gap-4">
        <div className="lg:col-span-3 space-y-2">
          {data?.items.length === 0 && <p className="text-sm text-stone-500">{T('لا توجد طلبات.')}</p>}
          {data?.items.map((r) => (
            <button key={r.id} onClick={() => setSelected(r)} className={`${card} w-full text-start hover:border-amber-400 ${selected?.id === r.id ? 'border-amber-500 ring-2 ring-amber-200' : ''}`}>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <b dir="ltr">{r.ref}</b>
                <span className="text-xs rounded-full bg-stone-100 px-2 py-0.5">{TYPE[r.type]}</span>
                <span className={`text-xs rounded-full px-2 py-0.5 ${r.status === 'new' ? 'bg-amber-100 text-amber-900' : r.status === 'cancelled' ? 'bg-red-100 text-red-800' : 'bg-emerald-100 text-emerald-800'}`}>{STATUS[r.status]}</span>
                {r.contact.email && (
                  <span className="inline-flex items-center gap-1 text-[11px] rounded-full bg-amber-50 border border-amber-200 text-amber-800 px-2 py-0.5" title={`إشعار البريد متاح: ${r.contact.email}`}>
                    <Mail className="w-3 h-3 text-amber-700" />
                    <span className="max-w-[120px] truncate" dir="ltr">{r.contact.email}</span>
                  </span>
                )}
                <span className="ms-auto text-xs text-stone-400">{fmtDate(r.createdAt)}</span>
              </div>
              <p className="text-xs text-stone-600 mt-1">
                {r.contact.name} · <span dir="ltr">{r.contact.phone || r.contact.email}</span>
                {r.total !== undefined ? ` · ${r.total} ${r.currency}` : ''}
              </p>
            </button>
          ))}
        </div>

        <div className="lg:col-span-2">
          {selected ? (
            <div className={`${card} space-y-3 lg:sticky lg:top-4`}>
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-base" dir="ltr">{selected.ref}</h2>
                <span className="text-xs text-stone-500">{TYPE[selected.type]} · {selected.serviceId}</span>
              </div>

              <div className="text-sm space-y-1 bg-stone-50 rounded-xl p-3">
                <p>العميل: <b>{selected.contact.name}</b></p>
                {selected.contact.phone && <p>الهاتف: <a dir="ltr" className="text-emerald-700 underline" href={`tel:${selected.contact.phone}`}>{selected.contact.phone}</a></p>}
                {selected.contact.email ? (
                  <p className="flex items-center gap-1.5 flex-wrap">
                    البريد: <a dir="ltr" className="text-emerald-700 underline font-semibold" href={`mailto:${selected.contact.email}`}>{selected.contact.email}</a>
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded-md font-medium">{T('مفعّل للإشعارات')}</span>
                  </p>
                ) : (
                  <p className="text-xs text-stone-400">{T('البريد: غير مسجل (الإشعارات بالبريد غير متاحة)')}</p>
                )}
              </div>

              {Object.keys(selected.fields).length > 0 && (
                <dl className="text-xs bg-stone-50 rounded-xl p-3 space-y-1">
                  {Object.entries(selected.fields).map(([k, v]) => (
                    <div key={k}><dt className="inline font-semibold">{k}: </dt><dd className="inline whitespace-pre-wrap">{v}</dd></div>
                  ))}
                </dl>
              )}

              {selected.items && (
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-stone-500"><th className="text-start">{T('المنتج')}</th><th>{T('الكمية')}</th><th>{T('السعر')}</th></tr>
                  </thead>
                  <tbody>
                    {selected.items.map((i) => (
                      <tr key={i.productId}>
                        <td>{i.name} <span className="text-stone-400" dir="ltr">({i.sku})</span></td>
                        <td className="text-center">{i.quantity}</td>
                        <td className="text-center">{i.unitPrice} {i.currency}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="font-bold"><td colSpan={2}>{T('الإجمالي')}</td><td className="text-center">{selected.total} {selected.currency}</td></tr>
                  </tfoot>
                </table>
              )}

              {/* Status Update & Email Notification Controls */}
              <div className="p-3 bg-amber-50/60 border border-amber-200/80 rounded-xl space-y-2.5">
                <label className="block text-xs font-semibold text-stone-800">
                  تغيير حالة الطلب
                  <select
                    className={`${input} mt-1`}
                    value={selected.status}
                    disabled={busy || selected.status === 'cancelled'}
                    onChange={(e) => {
                      const next = e.target.value as RequestStatus;
                      if (next === 'cancelled' && !confirm(T('إلغاء الطلب نهائي ويعيد الكميات للمخزون. متأكد؟'))) return;
                      void update({ status: next });
                    }}
                  >
                    {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </label>

                {selected.contact.email && (
                  <div className="space-y-2 pt-1 border-t border-amber-200/60">
                    <label className="flex items-center gap-2 text-xs font-medium text-stone-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={notifyCustomer}
                        onChange={(e) => setNotifyCustomer(e.target.checked)}
                        className="rounded text-amber-600 focus:ring-amber-500 w-4 h-4"
                      />
                      <span>{T('إرسال إشعار بريد إلكتروني للعميل تلقائياً عند تغيير الحالة')}</span>
                    </label>

                    <input
                      type="text"
                      className={`${input} text-xs`}
                      value={customEmailNote}
                      onChange={(e) => setCustomEmailNote(e.target.value)}
                      placeholder={T('ملاحظة خاصة بالعميل تُرفق بالبريد (رقم الشحنة، تفاصيل العرض…)')}
                      aria-label={T('ملاحظة البريد')}
                    />

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => void openEmailPreview()}
                        disabled={previewLoading}
                        className={`${btn} flex-1 text-xs bg-white border border-stone-300 text-stone-800 hover:bg-stone-50`}
                      >
                        {previewLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Eye className="w-3.5 h-3.5 text-stone-600" />}
                        معاينة البريد
                      </button>

                      <button
                        type="button"
                        onClick={() => void sendManualNotification()}
                        disabled={sendingManualEmail || busy}
                        className={`${btn} flex-1 text-xs bg-amber-600 text-white hover:bg-amber-700`}
                        title={T('إرسال إشعار بالحالة الحالية فوراً للعميل')}
                      >
                        {sendingManualEmail ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Mail className="w-3.5 h-3.5" />}
                        إرسال إشعار الآن
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {emailNotice && (
                <div className={`p-2.5 rounded-xl text-xs flex items-center gap-2 ${emailNotice.isError ? 'bg-red-50 text-red-800 border border-red-200' : 'bg-emerald-50 text-emerald-800 border border-emerald-200'}`}>
                  {emailNotice.isError ? <CircleAlert className="w-4 h-4 shrink-0 text-red-600" /> : <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />}
                  <span>{emailNotice.message}</span>
                </div>
              )}

              {/* Internal Admin Note */}
              <div className="space-y-2 pt-2 border-t">
                <textarea
                  className={input}
                  rows={2}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder={T('ملاحظة داخلية للإدارة (مذكرات داخلية، موعد توريد…)')}
                  aria-label={T('ملاحظة داخلية')}
                />
                <button
                  disabled={busy || !note.trim()}
                  onClick={() => update({ note })}
                  className={`${btn} bg-stone-900 text-amber-100 w-full`}
                >
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : T('إضافة ملاحظة داخلية')}
                </button>
              </div>

              {actionError && <p className="text-xs text-red-700">{actionError}</p>}

              <div className="border-t pt-2">
                <p className="text-xs font-semibold text-stone-600 mb-1">{T('سجل التحديثات والإشعارات:')}</p>
                <ol className="text-[11px] text-stone-500 space-y-1 max-h-48 overflow-y-auto">
                  {[...selected.notes].reverse().map((n, i) => (
                    <li key={i} className={`p-1.5 rounded-lg ${n.text.includes('✉️') ? 'bg-amber-50/70 text-amber-900 font-medium' : 'bg-stone-50'}`}>
                      <span className="text-stone-400">{fmtDate(n.at)}</span> — {n.by === 'admin' ? '👤 ' : ''}{n.text}
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          ) : (
            <p className="text-sm text-stone-400">{T('اختر طلباً لعرض التفاصيل وتحديث حالته وإشعاراته.')}</p>
          )}
        </div>
      </div>

      {/* Email Preview Modal */}
      {previewModalOpen && previewData && (
        <EmailPreviewModal
          preview={previewData}
          onClose={() => setPreviewModalOpen(false)}
        />
      )}
    </>
  );
}

function EmailPreviewModal({
  preview,
  onClose,
}: {
  preview: { subject: string; html: string; text: string; recipientEmail: string; customerName: string };
  onClose: () => void;
}) {
  const [tab, setTab] = useState<'html' | 'text'>('html');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl border border-stone-200 w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 bg-stone-900 text-stone-100 flex items-center justify-between border-b border-stone-800">
          <div className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-amber-400" />
            <div>
              <h3 className="font-bold text-sm">{T('معاينة إشعار البريد الإلكتروني للعميل')}</h3>
              <p className="text-xs text-stone-400">إلى: <span dir="ltr" className="text-amber-300 font-mono">{preview.recipientEmail}</span> ({preview.customerName})</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-stone-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Subject line bar */}
        <div className="px-4 py-2.5 bg-stone-100 border-b border-stone-200 flex items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-semibold text-stone-600 shrink-0">{T('عنوان الرسالة (Subject):')}</span>
            <span className="font-medium text-stone-900 truncate" dir={adminDir()}>{preview.subject}</span>
          </div>
          <div className="flex gap-1 shrink-0">
            <button
              type="button"
              onClick={() => setTab('html')}
              className={`px-2.5 py-1 rounded-lg font-semibold text-xs transition-colors ${tab === 'html' ? 'bg-amber-600 text-white' : 'bg-white text-stone-700 border border-stone-300'}`}
            >
              عرض منسق (HTML)
            </button>
            <button
              type="button"
              onClick={() => setTab('text')}
              className={`px-2.5 py-1 rounded-lg font-semibold text-xs transition-colors ${tab === 'text' ? 'bg-amber-600 text-white' : 'bg-white text-stone-700 border border-stone-300'}`}
            >
              نص عادي (Text)
            </button>
          </div>
        </div>

        {/* Body content */}
        <div className="flex-1 overflow-y-auto p-4 bg-stone-50 min-h-[380px]">
          {tab === 'html' ? (
            <div className="border border-stone-200 rounded-xl overflow-hidden bg-white shadow-sm">
              <iframe
                title="Email Preview"
                srcDoc={preview.html}
                className="w-full h-[520px] border-0"
                sandbox="allow-same-origin"
              />
            </div>
          ) : (
            <pre className="p-4 bg-white border border-stone-200 rounded-xl text-xs font-mono text-stone-800 whitespace-pre-wrap leading-relaxed select-all" dir={adminDir()}>
              {preview.text}
            </pre>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-white border-t border-stone-200 flex items-center justify-between text-xs">
          <span className="text-stone-500">{T('تصميم متجاوب ومتوافق مع تطبيقات البريد (Gmail, Outlook, Apple Mail).')}</span>
          <button
            type="button"
            onClick={onClose}
            className={`${btn} bg-stone-900 text-amber-100 text-xs`}
          >
            إغلاق المعاينة
          </button>
        </div>
      </div>
    </div>
  );
}

interface EmailHistoryItem {
  id: string;
  requestId: string;
  orderRef: string;
  recipientEmail: string;
  customerName: string;
  status: RequestStatus;
  statusLabelAr: string;
  subject: string;
  sentAt: string;
  deliveryStatus: 'sent' | 'simulated' | 'skipped' | 'failed';
  provider: string;
  error?: string;
  htmlContent: string;
  textContent: string;
}

function EmailsPanel() {
  const { data: overview, reload: reloadOverview } = useLoad<Overview>('/overview');
  const { data: historyData, loading: historyLoading, reload: reloadHistory } = useLoad<{ items: EmailHistoryItem[] }>('/emails/history');

  const [testEmail, setTestEmail] = useState('');
  const [testStatus, setTestStatus] = useState<RequestStatus>('in_progress');
  const [testNote, setTestNote] = useState(T('رسالة تجريبية: طلبك قيد التجهيز بعناية فائقة من مختبرات شام.'));
  const [testBusy, setTestBusy] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Template preview explorer
  const [activeTemplateStatus, setActiveTemplateStatus] = useState<RequestStatus>('in_progress');
  const [previewModalItem, setPreviewModalItem] = useState<{ subject: string; html: string; text: string; recipientEmail: string; customerName: string } | null>(null);

  const sendTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testEmail.trim() || !testEmail.includes('@')) return;
    setTestBusy(true); setTestResult(null);
    try {
      const response = await adminRequest<{
        ok: boolean;
        emailNotification: { success: boolean; delivery: string; provider: string; recipient: string; error?: string };
      }>('/emails/test', send('POST', {
        email: testEmail.trim(),
        status: testStatus,
        customNote: testNote.trim() || undefined,
      }));

      if (response.ok) {
        setTestResult({
          success: true,
          message: `تم الإرسال بنجاح إلى ${response.emailNotification.recipient} عبر مزود ${response.emailNotification.provider} (${response.emailNotification.delivery})`,
        });
        reloadHistory();
        reloadOverview();
      } else {
        setTestResult({
          success: false,
          message: `تعذر الإرسال: ${response.emailNotification.error || 'خطأ'}`,
        });
      }
    } catch (err) {
      setTestResult({
        success: false,
        message: (err as Error).message,
      });
    } finally {
      setTestBusy(false);
    }
  };

  const inspectEmail = (item: EmailHistoryItem) => {
    setPreviewModalItem({
      subject: item.subject,
      html: item.htmlContent,
      text: item.textContent,
      recipientEmail: item.recipientEmail,
      customerName: item.customerName,
    });
  };

  return (
    <>
      <Header
        title={T('نظام إشعارات البريد الإلكتروني للعملاء')}
        subtitle={T('إدارة قوالب إشعارات الطلبات وتحديثات الحالات، واختبار الإرسال، ومراجعة سجل البريد المرسل')}
        actions={<>
          <button onClick={() => { reloadOverview(); reloadHistory(); }} className={`${btn} bg-white border border-stone-300`}>
            <RefreshCw className="w-4 h-4" />
            تحديث
          </button>
        </>}
      />

      {/* Provider Status Card */}
      <div className="grid md:grid-cols-3 gap-4 mb-6">
        <div className={`${card} border-amber-300 bg-amber-50/40`}>
          <div className="flex items-center gap-2 text-amber-900 font-bold text-sm mb-1">
            <Mail className="w-4 h-4 text-amber-700" />
            مزود البريد النشط
          </div>
          <p className="text-2xl font-bold text-stone-900 mt-1">
            {overview?.emailNotifications?.provider || T('محاكي آمن (Simulator)')}
          </p>
          <p className="text-xs text-stone-500 mt-1">
            {overview?.emailNotifications?.configured
              ? T('✅ متصل ومفعل لإرسال الرسائل الحقيقية للعملاء')
              : T('⚡ يعمل في وضع المحاكاة الآمنة والتدقيق الداخلي (دون استهلاك رصيد خارجي)')}
          </p>
        </div>

        <div className={card}>
          <div className="flex items-center gap-2 text-stone-700 font-bold text-sm mb-1">
            <Send className="w-4 h-4 text-emerald-600" />
            إجمالي الإشعارات المسجلة
          </div>
          <p className="text-2xl font-bold text-emerald-700 mt-1">
            {historyData?.items.length ?? overview?.emailNotifications?.sentCount ?? 0}
          </p>
          <p className="text-xs text-stone-500 mt-1">{T('إشعارات تم توليدها وإرسالها للعملاء عند تغيير الحالات')}</p>
        </div>

        <div className={card}>
          <div className="flex items-center gap-2 text-stone-700 font-bold text-sm mb-1">
            <Check className="w-4 h-4 text-amber-600" />
            حالات الإشعار التلقائي
          </div>
          <div className="flex flex-wrap gap-1 mt-2">
            {Object.entries(STATUS).map(([k, v]) => (
              <span key={k} className="text-[11px] bg-stone-100 border border-stone-200 rounded-md px-2 py-0.5 font-medium">
                {v}
              </span>
            ))}
          </div>
          <p className="text-[10px] text-stone-400 mt-2">{T('يرسل النظام إشعاراً فورياً بتصميم متجاوب وبطاقة تتبع مباشرة')}</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-12 gap-6 mb-6">
        {/* Test Email Dispatcher */}
        <div className="lg:col-span-5">
          <form onSubmit={sendTest} className={`${card} space-y-3`}>
            <div className="flex items-center gap-2 border-b pb-2">
              <Mail className="w-4 h-4 text-amber-600" />
              <h2 className="font-bold text-sm">{T('إرسال بريد تجريبي لاختبار النظام')}</h2>
            </div>
            <p className="text-xs text-stone-500">
              يمكنك كتابة أي بريد إلكتروني واختيار الحالة لتجربة استلام الرسالة والتأكد من مظهرها وجودتها.
            </p>

            <label className="block text-xs font-semibold">
              البريد الإلكتروني المستلم:
              <input
                type="email"
                required
                className={`${input} mt-1`}
                dir="ltr"
                placeholder="customer@example.com"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
              />
            </label>

            <label className="block text-xs font-semibold">
              حالة الطلب المراد تجربتها:
              <select
                className={`${input} mt-1`}
                value={testStatus}
                onChange={(e) => setTestStatus(e.target.value as RequestStatus)}
              >
                {Object.entries(STATUS).map(([k, v]) => (
                  <option key={k} value={k}>{v} ({k})</option>
                ))}
              </select>
            </label>

            <label className="block text-xs font-semibold">
              ملاحظة العميل التجريبية:
              <textarea
                className={`${input} mt-1`}
                rows={2}
                value={testNote}
                onChange={(e) => setTestNote(e.target.value)}
                placeholder={T('ملاحظة إضافية للعميل')}
              />
            </label>

            <button
              type="submit"
              disabled={testBusy || !testEmail.trim()}
              className={`${btn} bg-amber-600 text-white w-full hover:bg-amber-700`}
            >
              {testBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              إرسال البريد التجريبي الآن
            </button>

            {testResult && (
              <div className={`p-3 rounded-xl text-xs flex items-center gap-2 ${testResult.success ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
                {testResult.success ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> : <CircleAlert className="w-4 h-4 text-red-600 shrink-0" />}
                <span>{testResult.message}</span>
              </div>
            )}
          </form>
        </div>

        {/* Template Explorer / Quick Preview */}
        <div className="lg:col-span-7">
          <div className={`${card} space-y-3`}>
            <div className="flex items-center justify-between border-b pb-2">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-stone-700" />
                <h2 className="font-bold text-sm">{T('استعراض مظهر القوالب للعملاء')}</h2>
              </div>
              <span className="text-xs text-stone-400">{T('تصميم فاخر بنمط شام')}</span>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {Object.entries(STATUS).map(([k, v]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setActiveTemplateStatus(k as RequestStatus)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${activeTemplateStatus === k ? 'bg-stone-900 text-amber-100 ring-2 ring-amber-400' : 'bg-stone-100 text-stone-700 hover:bg-stone-200'}`}
                >
                  {v}
                </button>
              ))}
            </div>

            <div className="p-4 bg-stone-50 rounded-xl border border-stone-200 text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-stone-500">{T('عنوان الرسالة المتوقع:')}</span>
                <span className="font-semibold text-stone-900" dir={adminDir()}>
                  [شام للعطور] تحديث حالة طلبك SH-SAMPLE: {STATUS[activeTemplateStatus]}
                </span>
              </div>
              <p className="text-stone-600 leading-relaxed">
                يحتوي الإيميل على: شعار وتوقيع شام للعطور الفاخر، شارة الحالة الملونة، تفاصيل الطلب، جدول المنتجات، ملاحظة فريق العمل، وزر «تتبع حالة طلبك بالتفصيل» ورابط مساعد شام المباشر.
              </p>
              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    const sampleReq: ServiceRequest = {
                      id: 'sample',
                      ref: 'SH-SAMPLE',
                      type: 'order',
                      serviceId: 'store',
                      status: activeTemplateStatus,
                      contact: { name: T('الأستاذ أحمد فؤاد'), email: 'ahmed@example.com', phone: '+201123456789' },
                      fields: { 'العنوان': T('التجمع الخامس، القاهرة'), 'طريقة الدفع': T('الدفع عند الاستلام') },
                      items: [
                        { productId: 'oud', sku: 'OUD-ROYAL', name: T('عطر عود ملكي خاص (EdP)'), quantity: 1, unitPrice: 850, currency: 'EGP' },
                        { productId: 'rose', sku: 'ROSE-GRASSE', name: T('زيت ورد غراس النقي 30 مل'), quantity: 2, unitPrice: 380, currency: 'EGP' },
                      ],
                      total: 1610,
                      currency: 'EGP',
                      notes: [],
                      createdAt: new Date().toISOString(),
                      updatedAt: new Date().toISOString(),
                    };
                    adminRequest<{ preview: { subject: string; html: string; text: string; recipientEmail: string; customerName: string } }>(
                      `/requests/sample/email-preview?status=${activeTemplateStatus}`
                    ).then((res) => {
                      setPreviewModalItem(res.preview);
                    }).catch(() => {
                      // Fallback dummy preview
                      setPreviewModalItem({
                        subject: `[شام للعطور] تحديث حالة طلبك SH-SAMPLE: ${STATUS[activeTemplateStatus]}`,
                        html: `<html><body style="font-family:sans-serif;direction:rtl;padding:20px;text-align:right;"><h2 style="color:#b45309;">شام للعطور</h2><p>مرحباً عميلنا العزيز 👋</p><p>حالة طلبك الحالية: <b>${STATUS[activeTemplateStatus]}</b></p></body></html>`,
                        text: `شام للعطور\nحالة طلبك: ${STATUS[activeTemplateStatus]}`,
                        recipientEmail: 'ahmed@example.com',
                        customerName: T('الأستاذ أحمد فؤاد'),
                      });
                    });
                  }}
                  className={`${btn} bg-stone-900 text-amber-100 text-xs`}
                >
                  <Eye className="w-3.5 h-3.5" />
                  معاينة القالب الكامل بالرسومات والتنسيق
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sent Emails History Table */}
      <div className={card}>
        <div className="flex items-center justify-between mb-3 border-b pb-2">
          <div className="flex items-center gap-2">
            <Mail className="w-4 h-4 text-amber-600" />
            <h2 className="font-bold text-sm">{T('سجل الإشعارات المرسلة للعملاء')}</h2>
          </div>
          <button
            type="button"
            onClick={reloadHistory}
            className="text-xs text-stone-500 hover:text-stone-900 flex items-center gap-1"
          >
            <RefreshCw className="w-3 h-3" />
            تحديث السجل
          </button>
        </div>

        {historyLoading && !historyData && (
          <div className="flex items-center gap-2 text-xs text-stone-500 py-6">
            <Loader2 className="w-4 h-4 animate-spin" />
            جارٍ تحميل سجل الإشعارات…
          </div>
        )}

        {historyData && historyData.items.length === 0 && (
          <p className="text-xs text-stone-400 py-6 text-center">
            لم يتم إرسال إشعارات بعد. عند تغيير حالة أي طلب يحمل بريداً إلكترونياً، سيظهر الإشعار المرسل هنا فوراً.
          </p>
        )}

        {historyData && historyData.items.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-stone-500 border-b text-start">
                  <th className="py-2 text-start">{T('الوقت')}</th>
                  <th className="py-2 text-start">{T('رقم الطلب')}</th>
                  <th className="py-2 text-start">{T('العميل والبريد')}</th>
                  <th className="py-2 text-start">{T('الحالة المرسلة')}</th>
                  <th className="py-2 text-start">{T('المزود')}</th>
                  <th className="py-2 text-start">{T('حالة الإرسال')}</th>
                  <th className="py-2 text-center">{T('الإجراء')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {historyData.items.map((item) => (
                  <tr key={item.id} className="hover:bg-stone-50/70">
                    <td className="py-2.5 text-stone-500 whitespace-nowrap">{fmtDate(item.sentAt)}</td>
                    <td className="py-2.5 font-bold font-mono text-amber-700" dir="ltr">{item.orderRef}</td>
                    <td className="py-2.5">
                      <div className="font-semibold text-stone-900">{item.customerName}</div>
                      <div className="text-[11px] text-stone-500 font-mono" dir="ltr">{item.recipientEmail}</div>
                    </td>
                    <td className="py-2.5">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold ${item.status === 'completed' || item.status === 'confirmed' ? 'bg-emerald-100 text-emerald-800' : item.status === 'cancelled' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'}`}>
                        {item.statusLabelAr || STATUS[item.status] || item.status}
                      </span>
                    </td>
                    <td className="py-2.5 text-stone-600 font-medium">{item.provider}</td>
                    <td className="py-2.5">
                      <span className={`inline-flex items-center gap-1 text-[11px] font-bold ${item.deliveryStatus === 'sent' ? 'text-emerald-700' : item.deliveryStatus === 'simulated' ? 'text-blue-700' : 'text-red-700'}`}>
                        {item.deliveryStatus === 'sent' && <CheckCircle2 className="w-3.5 h-3.5" />}
                        {item.deliveryStatus === 'simulated' && <Sparkles className="w-3.5 h-3.5" />}
                        {item.deliveryStatus === 'failed' && <CircleAlert className="w-3.5 h-3.5" />}
                        {item.deliveryStatus === 'sent' ? T('تم الإرسال') : item.deliveryStatus === 'simulated' ? T('محاكاة ناجحة') : T('فشل')}
                      </span>
                    </td>
                    <td className="py-2.5 text-center">
                      <button
                        type="button"
                        onClick={() => inspectEmail(item)}
                        className={`${btn} text-[11px] py-1 px-2.5 bg-stone-100 hover:bg-stone-200 text-stone-800 border border-stone-200`}
                      >
                        <Eye className="w-3 h-3" />
                        عرض
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Preview Modal */}
      {previewModalItem && (
        <EmailPreviewModal
          preview={previewModalItem}
          onClose={() => setPreviewModalItem(null)}
        />
      )}
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
      <Header title={T('المحادثات')} subtitle={T('كل محادثات الزوار مع مسار التنفيذ؛ يمكن الرد مباشرة على التحويلات')}
        actions={<>
          <label className="flex items-center gap-1.5 text-xs bg-white border border-stone-300 rounded-xl px-3"><input type="checkbox" checked={onlyHandoff} onChange={(e) => setOnlyHandoff(e.target.checked)} />{T('التحويلات فقط')}</label>
          <button onClick={reload} className={`${btn} bg-white border border-stone-300`}><RefreshCw className="w-4 h-4" /></button>
        </>} />
      <Feedback error={error} loading={loading && !data} />
      <div className="grid lg:grid-cols-5 gap-4">
        <div className="lg:col-span-2 space-y-2 max-h-[75vh] overflow-y-auto">
          {items.length === 0 && !loading && <p className="text-sm text-stone-500">{T('لا توجد محادثات.')}</p>}
          {items.map((c) => (
            <button key={c.id} onClick={() => void open(c.id)} className={`${card} w-full text-start p-3 hover:border-amber-400 ${selected?.id === c.id ? 'border-amber-500' : ''}`}>
              <div className="flex items-center gap-2 text-xs">
                {c.status === 'handoff' && <span className="rounded-full bg-emerald-100 text-emerald-800 px-2 py-0.5 font-bold flex items-center gap-1"><Headset className="w-3 h-3" />{T('تحويل')}</span>}
                {c.status === 'closed' && <span className="rounded-full bg-stone-200 px-2 py-0.5">{T('مغلقة')}</span>}
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
                <select className="ms-auto rounded-lg border border-stone-300 text-xs px-2 py-1" value={selected.status} aria-label={T('حالة المحادثة')}
                  onChange={async (e) => { const { item } = await adminRequest<{ item: Conversation }>(`/conversations/${selected.id}`, send('PATCH', { status: e.target.value })); setSelected(item); reload(); }}>
                  <option value="open">{T('مفتوحة (المساعد)')}</option><option value="handoff">{T('تحويل لموظف')}</option><option value="closed">{T('مغلقة')}</option>
                </select>
              </div>
              <div className="flex-1 overflow-y-auto py-3 space-y-2">
                {selected.messages.map((m, i) => (
                  <div key={i} className={`flex ${m.role === 'user' ? 'justify-start' : 'justify-end'}`}>
                    <div className={`max-w-[85%] rounded-xl px-3 py-2 text-sm whitespace-pre-wrap ${m.role === 'user' ? 'bg-stone-100' : m.engine === 'human' ? 'bg-emerald-50 border border-emerald-200' : 'bg-amber-50 border border-amber-100'}`}>
                      {m.text}
                      <div className="text-[10px] text-stone-400 mt-1">{fmtDate(m.at)}{m.intent ? ` · ${INTENT[m.intent] || m.intent}` : ''}{m.engine ? ` · ${ENGINE_LABEL[m.engine] || m.engine}` : ''}</div>
                      {m.council && <CouncilTranscriptView council={m.council} />}
                      {m.trace && (
                        <details className="mt-1 text-[10px] text-stone-500"><summary className="cursor-pointer">{T('مسار التنفيذ')}</summary>
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
                <input className={input} value={reply} onChange={(e) => setReply(e.target.value)} placeholder={T('اكتب رداً بشرياً يظهر للزائر في نفس المحادثة…')} aria-label={T('رد الموظف')} />
                <button disabled={busy || !reply.trim()} className={`${btn} bg-emerald-700 text-white`}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4 rotate-180" />}</button>
              </form>
            </div>
          ) : <p className="text-sm text-stone-400">{T('اختر محادثة.')}</p>}
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
    if (!confirm(T('حذف نهائي؟'))) return;
    try { await adminRequest(`/${path}/${id}`, send('DELETE')); if (editing?.id === id) setEditing(null); reload(); }
    catch (e) { setSaveError((e as Error).message); }
  };
  return (
    <>
      <Header title={title} subtitle={subtitle} actions={<button onClick={() => setEditing({ ...blank })} className={`${btn} bg-stone-900 text-amber-100`}><Plus className="w-4 h-4" />{T('إضافة')}</button>} />
      <Feedback error={error} loading={loading && !data} />
      <div className="grid lg:grid-cols-5 gap-4">
        <div className="lg:col-span-3 space-y-2">
          {data?.items.length === 0 && <p className="text-sm text-stone-500">{empty}</p>}
          {data?.items.map((item) => (
            <div key={item.id} className={`${card} flex items-start gap-3 p-3 ${editing?.id === item.id ? 'border-amber-500' : ''}`}>
              <button className="flex-1 text-start min-w-0" onClick={() => setEditing(structuredClone(item))}>{summary(item)}</button>
              <button onClick={() => void remove(item.id)} aria-label={T('حذف')} className="p-1.5 rounded-lg text-red-600 hover:bg-red-50"><Trash2 className="w-4 h-4" /></button>
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
                <button disabled={busy} onClick={save} className={`${btn} bg-stone-900 text-amber-100 flex-1`}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4" />{T('حفظ')}</>}</button>
                <button onClick={() => setEditing(null)} className={`${btn} bg-stone-100`}>{T('إلغاء')}</button>
              </div>
            </div>
          ) : <p className="text-sm text-stone-400">{T('اختر عنصراً للتعديل أو أضف جديداً.')}</p>}
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
    <CollectionPanel<Product> path="products" title={T('المنتجات')} subtitle={T('الكتالوج الوحيد الذي يقتبس منه المساعد الأسعار والمخزون')} empty={T('الكتالوج فارغ — المساعد لن يذكر أي أسعار حتى تضيف منتجات.')}
      blank={{ nameAr: '', nameEn: '', price: 0, stock: 0, unit: 'piece', category: 'perfume', active: true, tags: [] }}
      summary={(p) => (<>
        <p className="text-sm font-semibold truncate">{p.nameAr || p.nameEn} {p.demo && <span className="text-[10px] bg-stone-200 rounded px-1">{T('تجريبي')}</span>} {!p.active && <span className="text-[10px] bg-red-100 text-red-800 rounded px-1">{T('مخفي')}</span>}</p>
        <p className="text-xs text-stone-500"><span dir="ltr">{p.sku}</span> · {p.price} {p.currency} / {p.unit} · مخزون <b className={p.stock <= 3 ? 'text-red-700' : ''}>{p.stock}</b></p>
      </>)}
      Editor={({ value: p, onChange }) => (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <Field label={T('الاسم بالعربية')}><input className={input} value={p.nameAr || ''} onChange={(e) => onChange({ ...p, nameAr: e.target.value })} /></Field>
            <Field label="Name (English)"><input className={input} dir="ltr" value={p.nameEn || ''} onChange={(e) => onChange({ ...p, nameEn: e.target.value })} /></Field>
            <Field label="SKU"><input className={input} dir="ltr" value={p.sku || ''} onChange={(e) => onChange({ ...p, sku: e.target.value })} /></Field>
            <Field label={T('الفئة')}><select className={input} value={p.category} onChange={(e) => onChange({ ...p, category: e.target.value as Product['category'] })}>
              {[['perfume', T('عطر')], ['oil', T('زيت')], ['raw_material', T('مادة خام')], ['packaging', T('عبوات')], ['kit', T('طقم')], ['other', T('أخرى')]].map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
            <Field label={T('السعر')}><input className={input} type="number" min={0} step="0.01" value={p.price ?? 0} onChange={(e) => onChange({ ...p, price: Number(e.target.value) })} /></Field>
            <Field label={T('العملة')}><input className={input} dir="ltr" placeholder="EGP" value={p.currency || ''} onChange={(e) => onChange({ ...p, currency: e.target.value })} /></Field>
            <Field label={T('المخزون')}><input className={input} type="number" min={0} step={1} value={p.stock ?? 0} onChange={(e) => onChange({ ...p, stock: Math.floor(Number(e.target.value)) })} /></Field>
            <Field label={T('الوحدة')}><input className={input} value={p.unit || ''} onChange={(e) => onChange({ ...p, unit: e.target.value })} /></Field>
          </div>
          <Field label={T('الوصف بالعربية')}><textarea className={input} rows={2} value={p.descriptionAr || ''} onChange={(e) => onChange({ ...p, descriptionAr: e.target.value })} /></Field>
          <Field label="Description (English)"><textarea className={input} dir="ltr" rows={2} value={p.descriptionEn || ''} onChange={(e) => onChange({ ...p, descriptionEn: e.target.value })} /></Field>
          <Field label={T('كلمات البحث (مفصولة بفواصل)')}><input className={input} value={csv(p.tags)} onChange={(e) => onChange({ ...p, tags: fromCsv(e.target.value) })} /></Field>
          <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={p.active ?? true} onChange={(e) => onChange({ ...p, active: e.target.checked })} />{T('ظاهر للزوار')}</label>
        </div>
      )} />
  );
}

function KnowledgePanel() {
  return (
    <CollectionPanel<KnowledgeDoc> path="knowledge" title={T('قاعدة المعرفة')} subtitle={T('المصدر الذي يستند إليه المساعد في الإجابات ويعرضه كمراجع (RAG)')} empty={T('لا توجد مستندات.')}
      blank={{ title: '', content: '', tags: [] }}
      summary={(d) => (<><p className="text-sm font-semibold truncate">{d.title}</p><p className="text-xs text-stone-500 line-clamp-2">{d.content}</p></>)}
      Editor={({ value: d, onChange }) => (
        <div className="space-y-2">
          <Field label={T('العنوان')}><input className={input} value={d.title || ''} onChange={(e) => onChange({ ...d, title: e.target.value })} /></Field>
          <Field label={T('المحتوى (سياسات، أسئلة شائعة، شروط الشحن والاسترجاع…)')}><textarea className={input} rows={10} value={d.content || ''} onChange={(e) => onChange({ ...d, content: e.target.value })} /></Field>
          <Field label={T('وسوم (مفصولة بفواصل)')}><input className={input} value={csv(d.tags)} onChange={(e) => onChange({ ...d, tags: fromCsv(e.target.value) })} /></Field>
          <Field label={T('معرف الخدمة المرتبطة (اختياري)')}><input className={input} dir="ltr" value={d.serviceId || ''} onChange={(e) => onChange({ ...d, serviceId: e.target.value })} /></Field>
        </div>
      )} />
  );
}

function ServicesPanel() {
  return (
    <CollectionPanel<ServiceDef> path="services" title={T('الخدمات')} subtitle={T('أضف أي خدمة تجارية جديدة: الكلمات المفتاحية توجّه الزوار إليها، والحقول تحدد استمارة الطلب')} empty={T('لا توجد خدمات.')}
      blank={{ nameAr: '', nameEn: '', kind: 'custom', enabled: true, keywords: [], formFields: [], order: 50 }}
      summary={(s) => (<>
        <p className="text-sm font-semibold">{s.nameAr} {!s.enabled && <span className="text-[10px] bg-red-100 text-red-800 rounded px-1">{T('معطلة')}</span>}</p>
        <p className="text-xs text-stone-500" dir="ltr">{s.id} · {s.kind} · {s.formFields.length} fields · {s.keywords.length} keywords</p>
      </>)}
      Editor={function ServiceEditor({ value: s, onChange }) {
        const [fieldsText, setFieldsText] = useState(JSON.stringify(s.formFields || [], null, 1));
        const [jsonError, setJsonError] = useState('');
        useEffect(() => { setFieldsText(JSON.stringify(s.formFields || [], null, 1)); }, [s.id]); // eslint-disable-line react-hooks/exhaustive-deps
        return (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <Field label={T('الاسم بالعربية')}><input className={input} value={s.nameAr || ''} onChange={(e) => onChange({ ...s, nameAr: e.target.value })} /></Field>
              <Field label="Name (English)"><input className={input} dir="ltr" value={s.nameEn || ''} onChange={(e) => onChange({ ...s, nameEn: e.target.value })} /></Field>
              <Field label={T('النوع')}><select className={input} value={s.kind} onChange={(e) => onChange({ ...s, kind: e.target.value as ServiceDef['kind'] })}>
                {[['info', T('معلومات/أدوات')], ['store', T('متجر')], ['custom_order', T('طلب مخصص')], ['b2b', T('جملة B2B')], ['consultation', T('استشارة')], ['support', T('دعم')], ['custom', T('خدمة جديدة')]].map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
              <Field label={T('الترتيب')}><input className={input} type="number" value={s.order ?? 50} onChange={(e) => onChange({ ...s, order: Number(e.target.value) })} /></Field>
            </div>
            <Field label={T('الوصف بالعربية')}><textarea className={input} rows={2} value={s.descriptionAr || ''} onChange={(e) => onChange({ ...s, descriptionAr: e.target.value })} /></Field>
            <Field label="Description (English)"><textarea className={input} dir="ltr" rows={2} value={s.descriptionEn || ''} onChange={(e) => onChange({ ...s, descriptionEn: e.target.value })} /></Field>
            <Field label={T('كلمات التوجيه (مفصولة بفواصل)')}><textarea className={input} rows={2} value={csv(s.keywords)} onChange={(e) => onChange({ ...s, keywords: fromCsv(e.target.value) })} /></Field>
            <Field label={T('حقول الاستمارة (JSON: name, labelAr, labelEn, type, required, options)')}>
              <textarea className={`${input} font-mono text-[11px]`} dir="ltr" rows={6} value={fieldsText} onChange={(e) => {
                setFieldsText(e.target.value);
                try { const parsed = JSON.parse(e.target.value); if (!Array.isArray(parsed)) throw new Error(); onChange({ ...s, formFields: parsed }); setJsonError(''); }
                catch { setJsonError(T('JSON غير صالح — لن تُحفظ الحقول حتى يُصحَّح.')); }
              }} />
            </Field>
            {jsonError && <p className="text-[11px] text-red-700">{jsonError}</p>}
            <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={s.enabled ?? true} onChange={(e) => onChange({ ...s, enabled: e.target.checked })} />{T('مفعلة للزوار')}</label>
          </div>
        );
      }} />
  );
}

function EnginesPanel() {
  const { data, error, loading, reload } = useLoad<SettingsView>('/settings');
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
    try { await adminRequest('/settings', send('PUT', { ...form, shaheen: undefined })); setMessage(T('تم الحفظ ✅')); reload(); }
    catch (e) { setMessage((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <>
      <Header title={T('المحركات والإعدادات')} subtitle={T('سياسة اختيار المحرك مع التحويل التلقائي عند الفشل؛ محرك شام الذاتي هو خط الأمان الأخير دائماً')}
        actions={<a href="/api/admin/export" onClick={async (e) => {
          e.preventDefault();
          const response = await fetch(apiUrl('/api/admin/export'), { headers: { Authorization: `Bearer ${getToken()}` } });
          const blob = await response.blob(); const url = URL.createObjectURL(blob);
          const a = document.createElement('a'); a.href = url; a.download = `sham-core-backup-${new Date().toISOString().slice(0, 10)}.json`; a.click(); URL.revokeObjectURL(url);
        }} className={`${btn} bg-white border border-stone-300`}><Download className="w-4 h-4" />{T('نسخة احتياطية')}</a>} />
      <Feedback error={error} loading={loading && !data} />
      {form && data && (
        <div className="grid lg:grid-cols-2 gap-4">
          <div className={`${card} space-y-2`}>
            <h2 className="font-bold text-sm">{T('ترتيب المحركات')}</h2>
            <p className="text-[11px] text-stone-500">{T('المفاتيح وعناوين الخوادم تُضبط في متغيرات بيئة الخادم فقط ولا تظهر هنا. المحرك غير المهيأ يُتخطى تلقائياً.')}</p>
            {data.engines.map((engine) => {
              const active = policy.includes(engine.id);
              return (
                <div key={engine.id} className={`flex items-center gap-2 rounded-xl border p-2.5 ${active ? 'border-amber-300 bg-amber-50/50' : 'border-stone-200'}`}>
                  <input type="checkbox" aria-label={engine.name} checked={active || engine.id === 'sham_local'} disabled={engine.id === 'sham_local'} onChange={() => toggle(engine.id)} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold">{ENGINE_LABEL[engine.id]} <span className="text-[10px] text-stone-400" dir="ltr">{engine.model}</span></p>
                    <p className={`text-[11px] ${engine.configured ? 'text-emerald-700' : 'text-stone-400'}`}>{engine.configured ? 'مهيأ (الإعداد موجود؛ لا يضمن صحة المفتاح)' : engine.id === 'self_hosted' ? 'غير مهيأ — اضبط SHAM_LLM_BASE_URL' : 'غير مهيأ — لا يوجد مفتاح'}</p>
                  </div>
                  {active && engine.id !== 'sham_local' && <div className="flex flex-col"><button className="text-xs px-1" onClick={() => move(engine.id, -1)} aria-label={T('أعلى')}>▲</button><button className="text-xs px-1" onClick={() => move(engine.id, 1)} aria-label={T('أسفل')}>▼</button></div>}
                  {active && <span className="text-[10px] font-bold text-amber-800">#{policy.indexOf(engine.id) + 1}</span>}
                </div>
              );
            })}
            <Field label={`درجة الإبداع (temperature): ${form.temperature}`}><input type="range" min={0} max={1} step={0.05} value={form.temperature} onChange={(e) => setForm({ ...form, temperature: Number(e.target.value) })} className="w-full" /></Field>
          </div>
          <div className={`${card} space-y-2`}>
            <h2 className="font-bold text-sm">{T('هوية المساعد')}</h2>
            <div className="grid grid-cols-2 gap-2">
              <Field label={T('الاسم بالعربية')}><input className={input} value={form.assistantNameAr} onChange={(e) => setForm({ ...form, assistantNameAr: e.target.value })} /></Field>
              <Field label="Name (English)"><input className={input} dir="ltr" value={form.assistantNameEn} onChange={(e) => setForm({ ...form, assistantNameEn: e.target.value })} /></Field>
            </div>
            <Field label={T('رسالة الترحيب بالعربية')}><textarea className={input} rows={3} value={form.welcomeAr} onChange={(e) => setForm({ ...form, welcomeAr: e.target.value })} /></Field>
            <Field label="Welcome (English)"><textarea className={input} dir="ltr" rows={3} value={form.welcomeEn} onChange={(e) => setForm({ ...form, welcomeEn: e.target.value })} /></Field>
            <Field label={T('الشخصية وأسلوب الرد')}><textarea className={input} rows={2} value={form.personaAr} onChange={(e) => setForm({ ...form, personaAr: e.target.value })} /></Field>
            <div className="grid grid-cols-3 gap-2">
              <Field label={T('العملة الافتراضية')}><input className={input} dir="ltr" value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} /></Field>
              <Field label={T('مواعيد العمل')}><input className={input} value={form.businessHours} onChange={(e) => setForm({ ...form, businessHours: e.target.value })} /></Field>
              <Field label={T('تواصل مباشر')}><input className={input} value={form.handoffContact} onChange={(e) => setForm({ ...form, handoffContact: e.target.value })} placeholder={T('واتساب / هاتف')} /></Field>
            </div>
            <button disabled={busy} onClick={save} className={`${btn} bg-stone-900 text-amber-100 w-full`}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4" />{T('حفظ الإعدادات')}</>}</button>
            {message && <p className="text-xs text-center">{message}</p>}
          </div>
          <CouncilSettingsCard form={form} setForm={setForm} engines={data.engines} onSave={save} busy={busy} message={message} />
        </div>
      )}
    </>
  );
}

interface SettingsView { item: CoreSettings; engines: EngineStatus[]; shaheen: { source: 'admin' | 'file'; defaults: ShaheenSettings }; storage: { kind: string; persistent: boolean; error?: string } }
interface ProbeResult { id: ModelEngineId; name: string; model: string; configured: boolean; ok: boolean; ms: number; error?: string; detail?: string; usedModel?: string }
const PROBE_ERROR: Record<string, string> = {
  not_configured: T('غير مهيأ — لا يوجد مفتاح/عنوان في متغيرات الخادم'),
  rejected_or_empty: T('المزوّد رفض الطلب أو رجّع رداً فارغاً — راجع صلاحية المفتاح واسم النموذج والرصيد'),
  timeout: T('انتهت المهلة — الخدمة بطيئة أو غير متاحة'),
  unreachable: T('تعذّر الوصول للمزوّد (شبكة/عنوان خاطئ/مفتاح مرفوض)'),
  invalid_key: T('المفتاح غير صالح أو ملغي — أنشئ مفتاحاً جديداً من حساب المزوّد وضعه في متغيرات الخادم'),
  no_credit: T('الحساب بلا رصيد أو انتهت الحصة المجانية — اشحن الرصيد أو فعّل الفوترة عند المزوّد'),
  rate_limited: T('تجاوزت حد الطلبات مؤقتاً — انتظر دقيقة ثم أعد الاختبار'),
  model_not_found: T('اسم النموذج غير متاح لهذا الحساب — اختر نموذجاً آخر من الإعدادات'),
  region_blocked: T('المزوّد لا يخدم منطقة الخادم — استخدم خادماً في منطقة مدعومة'),
  bad_request: T('المزوّد رفض صيغة الطلب — راجع اسم النموذج والإعدادات'),
  upstream_error: T('خدمة المزوّد متعطلة حالياً — أعد المحاولة لاحقاً'),
};

/** «الخبير شاهين»: which engines, in which order, which models, tone, length and extra instructions. */
function ShaheenPanel() {
  const { data, error, loading, setData } = useLoad<SettingsView>('/settings');
  const [form, setForm] = useState<ShaheenSettings | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [probe, setProbe] = useState<ProbeResult[] | null>(null);
  const [probing, setProbing] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  useEffect(() => { if (data) setForm(data.item.shaheen); }, [data]);
  if (!form || !data) return <><Header title={T('الخبير شاهين')} /><Feedback error={error} loading={loading} /></>;

  const set = (patch: Partial<ShaheenSettings>) => setForm({ ...form, ...patch });
  const status = (id: string) => data.engines.find((e) => e.id === id);
  const allowed = form.engines;
  const all: ModelEngineId[] = [...allowed, ...MODEL_ENGINES.filter((id) => !allowed.includes(id))];
  const move = (id: ModelEngineId, delta: number) => {
    const list = [...allowed]; const i = list.indexOf(id); const j = i + delta;
    if (i < 0 || j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]]; set({ engines: list });
  };
  const toggle = (id: ModelEngineId) => set({ engines: allowed.includes(id) ? allowed.filter((x) => x !== id) : [...allowed, id] });
  const ready = allowed.filter((id) => status(id)?.configured);

  const save = async (shaheen: ShaheenSettings | null) => {
    setBusy(true); setMessage('');
    try {
      const next = await adminRequest<SettingsView>('/settings', send('PUT', { shaheen }));
      setData(next); setForm(next.item.shaheen);
      setMessage(shaheen === null ? T('تمت العودة لإعدادات الملف المشتركة ✅') : T('تم الحفظ ✅ — يظهر فوراً على الموقعين'));
    } catch (e) { setMessage((e as Error).message); } finally { setBusy(false); }
  };
  const runProbe = async () => {
    setProbing(true); setProbe(null); setMessage('');
    try { setProbe((await adminRequest<{ results: ProbeResult[] }>('/shaheen/test', send('POST', {}))).results); }
    catch (e) { setMessage((e as Error).message); } finally { setProbing(false); }
  };
  const dirty = JSON.stringify(form) !== JSON.stringify(data.item.shaheen);

  return (
    <>
      <Header title={T('الخبير شاهين')} subtitle={T('إعدادات شات تصميم العطور (النافذة العائمة وصفحة المعمل). نفس الإعدادات تُطبَّق على موقع Vercel وموقع GitHub Pages لأن الاتنين بيستخدموا نفس الخادم.')} />
      <div className="space-y-4">
        {!data.storage.persistent ? (
          <div className="rounded-2xl border border-amber-300 bg-amber-50 p-3 text-xs leading-relaxed text-amber-950">
            <p className="font-bold flex items-center gap-1.5"><TriangleAlert className="w-4 h-4" />التخزين الحالي مؤقت ({data.storage.kind})</p>
            <p>أي تعديل تحفظه هنا يشتغل فوراً، لكنه ممكن يضيع لما الخادم يعيد التشغيل. عشان يبقى دائم على الموقعين: فعّل <code dir="ltr">SHAM_STORE=firestore</code> مع بيانات Firebase في Vercel، أو انسخ «الإعداد الدائم» بالأسفل لملف <code dir="ltr">server/config/shaheen.ts</code> في المستودع.</p>
          </div>
        ) : (
          <p className="text-xs text-emerald-800 flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4" />التخزين دائم ({data.storage.kind}) — التعديلات تفضل محفوظة.</p>
        )}
        <p className="text-[11px] text-stone-500">مصدر الإعدادات الحالي: {data.shaheen.source === 'admin' ? 'لوحة الإدارة (تعديل محفوظ)' : 'الملف المشترك server/config/shaheen.ts'}</p>

        <div className="grid lg:grid-cols-2 gap-4">
          <div className={`${card} space-y-3`}>
            <div className="flex flex-wrap items-center gap-3">
              <label className="inline-flex items-center gap-1.5 text-sm font-bold"><input type="checkbox" checked={form.enabled} onChange={(e) => set({ enabled: e.target.checked })} />{T('شاهين مفعّل للزوار')}</label>
              <label className="inline-flex items-center gap-1.5 text-xs font-semibold"><input type="checkbox" checked={form.allowVisitorChoice} onChange={(e) => set({ allowVisitorChoice: e.target.checked })} />{T('السماح للزائر باختيار وضع الرد (سريع / معمّق / مجلس الخبراء) — أسماء المحركات لا تظهر للزوار أبداً')}</label>
            </div>
            <p className={`text-xs font-semibold ${ready.length ? 'text-emerald-700' : 'text-red-700'}`}>
              {ready.length ? `جاهز: ${ready.length} محرك مهيأ ومسموح (${ready.map((id) => ENGINE_LABEL[id]).join('، ')}).` : T('غير جاهز: مفيش ولا محرك مسموح ومهيأ — الزوار هيشوفوا «شاهين غير متصل».')}
            </p>
            <h2 className="font-bold text-sm">{T('المحركات وترتيب «تلقائي»')}</h2>
            <p className="text-[11px] text-stone-500">{T('«تلقائي» يجرّب المحركات بالترتيب ده ويتخطى غير المهيأ أو اللي فشل. المحرك غير المسموح يختفي من واجهة الزوار. المفاتيح تُضبط في متغيرات الخادم فقط.')}</p>
            {all.map((id) => {
              const on = allowed.includes(id); const st = status(id);
              return (
                <div key={id} className={`grid grid-cols-[auto_1fr_auto] items-center gap-2 rounded-xl border p-2 ${on ? 'border-amber-300 bg-amber-50/50' : 'border-stone-200'}`}>
                  <input type="checkbox" aria-label={`السماح بـ ${ENGINE_LABEL[id]}`} checked={on} onChange={() => toggle(id)} />
                  <div className="min-w-0 space-y-1">
                    <p className="text-sm font-semibold">{ENGINE_LABEL[id]} {on && <span className="text-[10px] font-bold text-amber-800">#{allowed.indexOf(id) + 1}</span>}</p>
                    <p className={`text-[11px] ${st?.configured ? 'text-emerald-700' : 'text-stone-400'}`}>{st?.configured ? 'مهيأ على الخادم' : id === 'self_hosted' ? 'غير مهيأ — اضبط SHAM_LLM_BASE_URL' : 'غير مهيأ — لا يوجد مفتاح'}</p>
                    <input className={`${input} py-1 text-xs`} dir="ltr" aria-label={`نموذج ${ENGINE_LABEL[id]}`} placeholder={`افتراضي: ${st?.model || 'model'}`}
                      value={form.models[id] || ''} onChange={(e) => {
                        const models = { ...form.models };
                        if (e.target.value.trim()) models[id] = e.target.value.trim(); else delete models[id];
                        set({ models });
                      }} />
                  </div>
                  {on && <div className="flex flex-col"><button type="button" className="p-0.5 rounded hover:bg-amber-100 disabled:opacity-30" disabled={allowed.indexOf(id) === 0} onClick={() => move(id, -1)} aria-label={T('تقديم في الترتيب')}><ChevronUp className="w-4 h-4" /></button><button type="button" className="p-0.5 rounded hover:bg-amber-100 disabled:opacity-30" disabled={allowed.indexOf(id) === allowed.length - 1} onClick={() => move(id, 1)} aria-label={T('تأخير في الترتيب')}><ChevronDown className="w-4 h-4" /></button></div>}
                </div>
              );
            })}
          </div>

          <div className="space-y-4">
            <div className={`${card} space-y-3`}>
              <h2 className="font-bold text-sm">{T('أسلوب الردود')}</h2>
              <Field label={`درجة الإبداع (temperature): ${form.temperature}`}><input type="range" min={0} max={1} step={0.05} value={form.temperature} onChange={(e) => set({ temperature: Number(e.target.value) })} className="w-full" /></Field>
              <Field label={T('أقصى طول للرد')}>
                <select className={input} value={form.maxTokens} onChange={(e) => set({ maxTokens: Number(e.target.value) })}>
                  {[1024, 2048, 4096, 6144, 8192].map((n) => <option key={n} value={n}>{n} توكن{n === 4096 ? ' (موصى به)' : ''}</option>)}
                </select>
              </Field>
              <Field label={T('تعليمات إضافية لشاهين (اختياري — لا تلغي قواعد السلامة)')}>
                <textarea className={input} rows={5} maxLength={2000} value={form.instructions} onChange={(e) => set({ instructions: e.target.value })}
                  placeholder={T('مثال: اقترح خامات متوفرة في السوق المصري، واذكر البدائل الاقتصادية، واختم بتذكير بطلب عينة من متجر شام.')} />
              </Field>
              <p className="text-[11px] text-stone-400 text-left" dir="ltr">{form.instructions.length}/2000</p>
            </div>

            <div className={`${card} space-y-2`}>
              <div className="flex flex-wrap items-center gap-2">
                <button disabled={busy || !dirty} onClick={() => void save(form)} className={`${btn} bg-stone-900 text-amber-100`}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4" />{T('حفظ إعدادات شاهين')}</>}</button>
                <button disabled={busy || probing} onClick={() => void runProbe()} className={`${btn} border border-stone-300 bg-white`}>{probing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Activity className="w-4 h-4" />}اختبار الاتصال بالمحركات</button>
                {data.shaheen.source === 'admin' && <button disabled={busy} onClick={() => void save(null)} className={`${btn} border border-stone-300 bg-white text-xs`}><RefreshCw className="w-3.5 h-3.5" />{T('رجوع لإعدادات الملف')}</button>}
              </div>
              {dirty && <p className="text-[11px] text-amber-700">{T('فيه تعديلات لم تُحفظ.')}</p>}
              {message && <p className="text-xs">{message}</p>}
              {probe && (
                <div className="space-y-1.5 pt-1">
                  <p className="text-[11px] text-stone-500">{T('الاختبار يبعت طلب صغير حقيقي لكل محرك مسموح (بالإعدادات المحفوظة).')}</p>
                  {probe.map((r) => (
                    <div key={r.id} className={`flex items-start gap-2 rounded-xl border p-2 text-xs ${r.ok ? 'border-emerald-200 bg-emerald-50' : r.configured ? 'border-red-200 bg-red-50' : 'border-stone-200 bg-stone-50'}`}>
                      {r.ok ? <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" /> : <CircleAlert className={`w-4 h-4 shrink-0 ${r.configured ? 'text-red-700' : 'text-stone-400'}`} />}
                      <div>
                        <p className="font-semibold">{ENGINE_LABEL[r.id]} <span className="font-normal text-stone-500" dir="ltr">{r.model}</span>{r.ms ? <span className="font-normal text-stone-400"> · {(r.ms / 1000).toFixed(1)} ث</span> : null}</p>
                        <p>{r.ok ? 'يعمل ✅' : PROBE_ERROR[r.error || ''] || 'لم يعمل'}</p>
                        {r.usedModel && <p className="text-[10px] text-amber-700" dir="ltr">↪ {r.usedModel}</p>}
                        {r.detail && <p className="text-[10px] text-stone-500 break-words" dir="ltr">{r.detail}</p>}
                      </div>
                    </div>
                  ))}
                  {!probe.length && <p className="text-xs text-stone-500">{T('لا توجد محركات مسموح بها.')}</p>}
                </div>
              )}
            </div>

            <div className={`${card} space-y-2`}>
              <button type="button" onClick={() => setShowConfig((v) => !v)} className="text-xs font-semibold text-amber-800 hover:underline">{showConfig ? 'إخفاء' : 'عرض'} «الإعداد الدائم» لملف المستودع</button>
              {showConfig && (
                <>
                  <p className="text-[11px] text-stone-500">ده نفس الإعداد الحالي بصيغة ملف <code dir="ltr">server/config/shaheen.ts</code>{T('. لما يتحط في المستودع ويتعمل نشر، يبقى هو الأساس على الموقعين حتى بدون تخزين دائم.')}</p>
                  <pre dir="ltr" className="overflow-x-auto rounded-xl bg-stone-900 p-3 text-[11px] text-stone-100">{`export const SHAHEEN_SITE_SETTINGS: ShaheenSettings = ${JSON.stringify(form, null, 2)};`}</pre>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

/** Advisory council: which models sit, with which expert lens, who chairs, how many debate rounds. */
function CouncilSettingsCard({ form, setForm, engines, onSave, busy, message }: { form: CoreSettings; setForm: (f: CoreSettings) => void; engines: EngineStatus[]; onSave: () => void; busy: boolean; message: string }) {
  const council = form.council;
  const set = (patch: Partial<CoreSettings['council']>) => setForm({ ...form, council: { ...council, ...patch } });
  const setMember = (id: string, patch: Partial<CouncilMember>) => set({ members: council.members.map((m) => (m.id === id ? { ...m, ...patch } : m)) });
  const configured = (id: string) => engines.find((e) => e.id === id)?.configured;
  const ready = council.members.filter((m) => m.enabled && configured(m.engine)).length;
  return (
    <div className={`${card} space-y-3 lg:col-span-2`}>
      <div className="flex flex-wrap items-center gap-2">
        <Users className="w-4 h-4 text-amber-700" />
        <h2 className="font-bold text-sm">{T('المجلس الاستشاري (نقاش بين نماذج الذكاء الاصطناعي)')}</h2>
        <label className="ms-auto inline-flex items-center gap-1.5 text-xs font-semibold"><input type="checkbox" checked={council.enabled} onChange={(e) => set({ enabled: e.target.checked })} />{T('مفعّل')}</label>
      </div>
      <p className="text-[11px] text-stone-500 leading-relaxed">
        كل مقعد يكتب رأيه مستقلاً ← المقاعد تراجع آراء بعضها بأسماء مجهولة (A، B، C) ← رئيس المجلس يكتب ردّاً استشارياً واحداً للزائر. الكل يشتغل على بيانات شام فقط، ومحدش منهم يقدر ينفّذ طلب أو يغيّر حاجة.
        كل رد بالمجلس بيكلّف (عدد المقاعد × (1 + الجولات) + 1) طلب للمزوّدين، وفيه حد أقصى لكل زائر (SHAM_COUNCIL_RATE_PER_HOUR، الافتراضي 12 في الساعة).
      </p>
      <p className={`text-xs font-semibold ${ready >= 2 ? 'text-emerald-700' : 'text-amber-700'}`}>
        {ready >= 2 ? `جاهز: ${ready} مقاعد مهيأة (يُستخدم أول 5).` : `غير جاهز: محتاج مقعدين مهيأين على الأقل (حالياً ${ready}). أضف مفاتيح المزوّدين أو اضبط SHAM_LLM_BASE_URL، ويمكن تشغيل أكثر من نموذج على نفس الخادم بتحديد اسم النموذج.`}
      </p>
      <div className="space-y-2">
        {council.members.map((m) => (
          <div key={m.id} className={`grid grid-cols-2 md:grid-cols-[auto_1fr_1fr_1fr_auto] items-center gap-2 rounded-xl border p-2 ${m.enabled && configured(m.engine) ? 'border-amber-300 bg-amber-50/40' : 'border-stone-200'}`}>
            <input type="checkbox" aria-label={T('تفعيل المقعد')} checked={m.enabled} onChange={(e) => setMember(m.id, { enabled: e.target.checked })} />
            <select className={input} aria-label={T('المحرك')} value={m.engine} onChange={(e) => setMember(m.id, { engine: e.target.value as ModelEngineId })}>
              {MODEL_ENGINES.map((id) => <option key={id} value={id}>{ENGINE_LABEL[id]}{configured(id) ? '' : ' (غير مهيأ)'}</option>)}
            </select>
            <input className={input} dir="ltr" aria-label={T('النموذج')} placeholder={engines.find((e) => e.id === m.engine)?.model || 'model'} value={m.model || ''} onChange={(e) => setMember(m.id, { model: e.target.value.trim() || undefined })} />
            <select className={input} aria-label={T('الدور')} value={m.role} onChange={(e) => setMember(m.id, { role: e.target.value as CouncilRole })}>
              {(Object.keys(COUNCIL_ROLE) as CouncilRole[]).map((r) => <option key={r} value={r}>{COUNCIL_ROLE[r]}</option>)}
            </select>
            <button type="button" aria-label={T('حذف المقعد')} onClick={() => set({ members: council.members.filter((x) => x.id !== m.id), chair: council.chair === m.id ? 'auto' : council.chair })} className="p-2 text-stone-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
          </div>
        ))}
        {council.members.length < 8 && (
          <button type="button" onClick={() => set({ members: [...council.members, { id: `seat-${Math.random().toString(36).slice(2, 10)}`, engine: 'self_hosted', role: 'general', enabled: true }] })}
            className={`${btn} border border-dashed border-stone-300 text-xs w-full`}><Plus className="w-3.5 h-3.5" />{T('إضافة مقعد')}</button>
        )}
      </div>
      <div className="grid md:grid-cols-3 gap-3">
        <Field label={T('رئيس المجلس (يكتب الرد النهائي)')}>
          <select className={input} value={council.chair} onChange={(e) => set({ chair: e.target.value })}>
            <option value="auto">{T('تلقائي (حسب ترتيب المحركات)')}</option>
            {council.members.map((m, i) => <option key={m.id} value={m.id}>مقعد {i + 1}: {COUNCIL_ROLE[m.role]} — {ENGINE_LABEL[m.engine]}{m.model ? ` (${m.model})` : ''}</option>)}
          </select>
        </Field>
        <Field label={T('جولات النقاش (المراجعة المتبادلة)')}>
          <select className={input} value={council.rounds} onChange={(e) => set({ rounds: Number(e.target.value) })}>
            <option value={0}>{T('بدون نقاش (آراء + خلاصة)')}</option><option value={1}>{T('جولة واحدة (موصى به)')}</option><option value={2}>{T('جولتان (أبطأ وأغلى)')}</option>
          </select>
        </Field>
        <label className="flex items-center gap-2 text-xs font-semibold mt-5"><input type="checkbox" checked={council.showDiscussion} onChange={(e) => set({ showDiscussion: e.target.checked })} />{T('إظهار النقاش للزائر تحت الرد')}</label>
      </div>
      <div>
        <p className="text-xs font-semibold mb-1">{T('يجتمع المجلس تلقائياً في (والزائر يقدر يطلبه بنفسه من زر المجلس في هذه الأنواع):')}</p>
        <div className="flex flex-wrap gap-2">
          {COUNCIL_INTENTS.map((intent) => (
            <label key={intent} className="inline-flex items-center gap-1 text-[11px] rounded-full border border-stone-300 px-2 py-1">
              <input type="checkbox" checked={council.intents.includes(intent)} onChange={(e) => set({ intents: e.target.checked ? [...council.intents, intent] : council.intents.filter((x) => x !== intent) })} />{INTENT[intent]}
            </label>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button disabled={busy} onClick={onSave} className={`${btn} bg-stone-900 text-amber-100`}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4" />{T('حفظ إعدادات المجلس')}</>}</button>
        {message && <p className="text-xs">{message}</p>}
        <p className="text-[11px] text-stone-500">{T('جرّبه من «مختبر المساعد» بعلامة «استشارة المجلس».')}</p>
      </div>
    </div>
  );
}

/** Admin view of a council transcript (full: failed seats, models, timings). */
function CouncilTranscriptView({ council }: { council: CouncilTranscript }) {
  return (
    <details className="mt-1 text-[11px] text-stone-600">
      <summary className="cursor-pointer font-semibold text-amber-800">نقاش المجلس ({council.entries.filter((e) => e.ok).length}/{council.entries.length} مقاعد · {council.rounds} جولة · {(council.ms / 1000).toFixed(1)} ث · {council.outcome})</summary>
      <div className="mt-1 space-y-1.5">
        {council.entries.map((e) => (
          <div key={e.memberId} className={`rounded-lg border p-1.5 ${e.ok ? 'border-stone-200 bg-white' : 'border-red-200 bg-red-50'}`}>
            <p className="font-bold">{e.label} · {COUNCIL_ROLE[e.role]} · <span dir="ltr">{ENGINE_LABEL[e.engine]} {e.model}</span>{council.chair?.memberId === e.memberId ? ' · 👑 الرئيس' : ''} <span className="font-normal text-stone-400">{e.ms}ms</span></p>
            {e.ok ? <p className="whitespace-pre-wrap">{e.opinion}</p> : <p className="text-red-700">{T('لم يرد (فشل أو انتهت المهلة)')}</p>}
            {e.reviews.map((r, i) => <p key={i} className="mt-1 whitespace-pre-wrap border-s-2 border-amber-300 ps-1.5"><b>مراجعة {i + 1}:</b> {r}</p>)}
          </div>
        ))}
      </div>
    </details>
  );
}

interface SandboxReply { council?: { outcome: string; rounds: number; entries: { label: string; role: string; engine: string; opinion: string; reviews: string[]; chair: boolean }[] }; reply: string; engine: { id: string; name: string }; intent: string; actions: { type: string; serviceId?: string }[]; citations: { title: string }[]; trace?: { stage: string; detail: string; ms?: number }[] }

function SandboxPanel() {
  const [message, setMessage] = useState('');
  const [language, setLanguage] = useState('ar');
  const [log, setLog] = useState<{ q: string; r?: SandboxReply; error?: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [consult, setConsult] = useState(false);
  const samples = useMemo(() => [T('ازاي أركّب عطر عود ثابت؟'), T('عايز اشتري زيت عود'), T('محتاج عرض سعر جملة لمحل'), T('يعني ايه تعتيق العطر؟'), T('50 مل بتركيز 20%'), T('عايز أكلم موظف'), 'What services do you offer?'], []);
  const run = async (q: string) => {
    if (!q.trim()) return; setBusy(true);
    try { const r = await adminRequest<SandboxReply>('/test-chat', send('POST', { message: q, language, ...(consult ? { consult: true } : {}) })); setLog((l) => [{ q, r }, ...l]); }
    catch (e) { setLog((l) => [{ q, error: (e as Error).message }, ...l]); } finally { setBusy(false); setMessage(''); }
  };
  return (
    <>
      <Header title={T('مختبر المساعد')} subtitle={T('جرّب نفس مسار الزوار مع عرض كامل لخطوات التنفيذ (التوجيه، الاسترجاع، الأدوات، المحرك)')} />
      <form className={`${card} flex flex-wrap gap-2`} onSubmit={(e) => { e.preventDefault(); void run(message); }}>
        <input className={`${input} flex-1 min-w-[200px]`} value={message} onChange={(e) => setMessage(e.target.value)} placeholder={T('اكتب رسالة اختبار…')} aria-label={T('رسالة اختبار')} />
        <select className={`${input} w-24`} value={language} onChange={(e) => setLanguage(e.target.value)} aria-label={T('اللغة')}><option value="ar">ar</option><option value="en">en</option><option value="fr">fr</option></select>
        <label className="inline-flex items-center gap-1 text-xs font-semibold"><input type="checkbox" checked={consult} onChange={(e) => setConsult(e.target.checked)} />{T('استشارة المجلس')}</label>
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
                  {entry.r.council && (
                    <details className="mt-2 text-[11px]" open><summary className="cursor-pointer font-semibold text-amber-800">نقاش المجلس ({entry.r.council.entries.length} مستشارين · {entry.r.council.rounds} جولة)</summary>
                      <div className="mt-1 space-y-1.5">{entry.r.council.entries.map((e) => (
                        <div key={e.label} className="rounded-lg border border-stone-200 p-1.5">
                          <p className="font-bold">{e.label} · {e.role} · <span dir="ltr">{e.engine}</span>{e.chair ? ' · 👑' : ''}</p>
                          <p className="whitespace-pre-wrap">{e.opinion}</p>
                          {e.reviews.map((r, i) => <p key={i} className="mt-1 whitespace-pre-wrap border-s-2 border-amber-300 ps-1.5">{r}</p>)}
                        </div>
                      ))}</div>
                    </details>
                  )}
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
      {state === 'ok' ? T('تم إرسال إشعار تجريبي ✅') : state === 'fail' ? T('فشل الإرسال — راجع الرابط') : T('إرسال إشعار تجريبي')}
    </button>
  );
}

const AGENT_PRESETS = [T('تقرير اليوم الكامل'), T('إيه الطلبات المتأخرة؟'), T('المخزون اللي قرب يخلص'), T('الزوار سألوا عن إيه ومالقوش إجابة؟'), T('رضا العملاء عامل إزاي؟'), T('المبيعات والقيمة المتوقعة')];
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
    const q = text.trim() || T('تقرير اليوم الكامل');
    setBusy(true); setError(''); setAsked(q);
    try { setResult(await adminRequest<AgentResult>('/agent', send('POST', { message: q }))); }
    catch (e) { setError(e instanceof Error ? e.message : T('فشل التشغيل')); }
    finally { setBusy(false); }
  };
  return (
    <>
      <Header title={T('المساعد الإداري')} subtitle={T('وكيل عمليات يخطط وينفذ أدوات قراءة فقط على بيانات شام ثم يكتب تقريراً بخطوات قابلة للتنفيذ. لا يعدّل أي بيانات بنفسه.')} />
      <form className={`${card} space-y-3`} onSubmit={(e) => { e.preventDefault(); void run(message); }}>
        <div className="flex gap-2">
          <input className={input} value={message} onChange={(e) => setMessage(e.target.value.slice(0, 1000))} placeholder={T('اطلب تقريراً… مثال: إيه اللي محتاج انتباهي النهارده؟')} aria-label={T('طلب للمساعد الإداري')} />
          <button disabled={busy} className={`${btn} bg-stone-900 text-amber-100 shrink-0`}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}تشغيل</button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {AGENT_PRESETS.map((p) => <button key={p} type="button" disabled={busy} onClick={() => { setMessage(p); void run(p); }} className="text-xs rounded-full border border-amber-300 bg-amber-50 px-3 py-1 hover:bg-amber-100 disabled:opacity-50">{p}</button>)}
        </div>
      </form>
      {error && <p role="alert" className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      {busy && <div className="mt-4 flex items-center gap-2 text-sm text-stone-500"><Loader2 className="w-4 h-4 animate-spin" />{T('الوكيل يخطط وينفذ المهام…')}</div>}
      {result && !busy && (
        <div className="mt-4 grid lg:grid-cols-[260px_1fr] gap-4">
          <div className={card}>
            <h2 className="font-bold text-sm mb-1">{T('الخطة المنفذة')}</h2>
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
              <h2 className="font-bold text-sm mb-2 flex items-center gap-1.5"><Wand2 className="w-4 h-4 text-amber-700" />{T('الملخص')}</h2>
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
                    {TAB_IDS.has(section.tab) && <button type="button" onClick={() => go(section.tab as Tab)} className="text-[11px] text-stone-600 hover:underline">{T('فتح ←')}</button>}
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
    catch (e) { setError(e instanceof Error ? e.message : T('فشل الحفظ')); }
    finally { setBusy(false); }
  };

  return (
    <>
      <Header title={T('الجودة والتعلّم')} subtitle={T('كل سؤال لم يجد إجابة أو رد قيّمه زائر سلبياً يتحول لفجوة. اكتب الإجابة مرة واحدة فتُضاف لقاعدة المعرفة ويستخدمها المساعد فوراً.')}
        actions={<button onClick={() => { gaps.reload(); feedback.reload(); }} className={`${btn} bg-white border border-stone-300`}><RefreshCw className="w-4 h-4" />{T('تحديث')}</button>} />
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className={card}><p className="text-xs text-stone-500">{T('فجوات مفتوحة')}</p><p className="text-3xl font-bold text-orange-700">{gaps.data?.items.filter((g) => g.status === 'open').length ?? '…'}</p></div>
        <div className={card}><p className="text-xs text-stone-500">{T('نسبة الرضا')}</p><p className="text-3xl font-bold text-emerald-700">{rate === null ? '—' : `${rate}%`}</p></div>
        <div className={card}><p className="text-xs text-stone-500">{T('التقييمات')}</p><p className="text-lg font-bold mt-2"><span className="text-emerald-700">👍 {ups}</span> · <span className="text-red-700">👎 {downs}</span></p></div>
      </div>
      {error && <p role="alert" className="mb-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      <div className="grid xl:grid-cols-2 gap-4">
        <section className={card}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-sm flex items-center gap-1.5"><Lightbulb className="w-4 h-4 text-amber-600" />{T('فجوات المعرفة')}</h2>
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
                  {g.source === 'no_answer' ? T('لم يجد المساعد إجابة') : `تقييم سلبي${g.reason ? `: ${g.reason}` : ''}`} · آخر مرة {fmtDate(g.lastAt)}
                  {g.status !== 'open' && <b className="ms-1">{g.status === 'resolved' ? '· تم الحل ✅' : '· متجاهلة'}</b>}
                </p>
                {g.lastAnswer && <p className="mt-1.5 text-[11px] text-stone-500 line-clamp-2 bg-stone-50 rounded-lg p-1.5">رد المساعد: {g.lastAnswer}</p>}
                {editing === g.id ? (
                  <form className="mt-2 space-y-2" onSubmit={(e) => { e.preventDefault(); void patch(g.id, draft); }}>
                    <input className={input} required value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder={T('عنوان المستند')} aria-label={T('عنوان المستند')} />
                    <textarea className={input} required rows={4} value={draft.content} onChange={(e) => setDraft({ ...draft, content: e.target.value })} placeholder={T('الإجابة الصحيحة كما يجب أن يقولها المساعد')} aria-label={T('الإجابة')} />
                    <div className="flex gap-2">
                      <button disabled={busy} className={`${btn} bg-emerald-700 text-white`}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}حفظ في قاعدة المعرفة</button>
                      <button type="button" onClick={() => setEditing(null)} className={`${btn} border border-stone-300`}>{T('إلغاء')}</button>
                    </div>
                  </form>
                ) : g.status === 'open' ? (
                  <div className="mt-2 flex gap-2">
                    <button type="button" onClick={() => { setEditing(g.id); setDraft({ title: g.question.slice(0, 120), content: '' }); }} className={`${btn} text-xs bg-stone-900 text-amber-100`}><BookOpen className="w-3.5 h-3.5" />{T('أضف الإجابة')}</button>
                    <button type="button" disabled={busy} onClick={() => void patch(g.id, { status: 'ignored' })} className={`${btn} text-xs border border-stone-300`}><EyeOff className="w-3.5 h-3.5" />{T('تجاهل')}</button>
                  </div>
                ) : g.status === 'ignored' ? (
                  <button type="button" disabled={busy} onClick={() => void patch(g.id, { status: 'open' })} className="mt-2 text-[11px] text-stone-600 hover:underline">{T('إعادة فتح')}</button>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
        <section className={card}>
          <h2 className="font-bold text-sm mb-3">{T('آخر التقييمات')}</h2>
          <Feedback error={feedback.error} loading={feedback.loading && !feedback.data} />
          {feedback.data && !feedback.data.items.length && <p className="text-xs text-stone-400 py-4 text-center">{T('لم يقيّم الزوار أي رد بعد.')}</p>}
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

// ---------------- «طبيب شاهين» (automatic maintenance, scripts/doctor) ----------------
interface MaintenanceSnapshot {
  version: string; uptimeS: number;
  window: { requests: number; rateLimited: number; answered: number; errors: Record<string, number>; errorRate: number; latencyMs: { p50: number; p95: number; max: number } };
  providers: Record<string, { inFlight: number; coolingMs: number; rpm: number | null; startedLastMinute: number }>;
  answerCache: { entries: number; hits: number; misses: number; shared: number } | null;
  remedies: { action: string; at: string }[];
}
const DOCTOR_REPO = (import.meta.env.VITE_GITHUB_REPO as string | undefined) || 'spculculat-oss/Sham-Perfume';
const REMEDY_LABEL: Record<string, string> = { reset_provider_gate: T('تصفير حالة المزوّدين'), refresh_model_list: T('تحديث قائمة الموديلات'), clear_answer_cache: T('مسح ذاكرة الإجابات') };
const FIX_RESULT: Record<string, string> = { merged: T('⏳ تحت المراقبة'), failed: T('❌ ما اتطبقش'), verified: T('✅ شغال'), reverted: T('↩️ اترجع'), unverified: T('⚪ من غير تأكيد') };

function DoctorPanel() {
  const { data, error, loading, reload } = useLoad<MaintenanceSnapshot>('/maintenance');
  const [report, setReport] = useState<DoctorReport | null | undefined>(undefined);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const loadReport = useCallback(() => {
    fetch(`https://api.github.com/repos/${DOCTOR_REPO}/issues?labels=shaheen-doctor&state=open&per_page=1`, { headers: { Accept: 'application/vnd.github+json' } })
      .then((r) => (r.ok ? r.json() : []))
      .then((issues: { body?: string; html_url: string }[]) => setReport(issues[0] ? parseDoctorIssue(issues[0].body || '', issues[0].html_url) : null))
      .catch(() => setReport(null));
  }, []);
  useEffect(() => { loadReport(); }, [loadReport]);
  const remedy = async (action: string) => {
    setBusy(action); setMessage('');
    try { await adminRequest('/maintenance', send('POST', { action })); setMessage(`تم: ${REMEDY_LABEL[action]} ✅`); reload(); }
    catch (e) { setMessage((e as Error).message); } finally { setBusy(''); }
  };
  const w = data?.window;
  return (
    <>
      <Header title="طبيب شاهين — الصيانة التلقائية" subtitle="بيراجع الخبير شاهين كل 10 دقايق من خوادم GitHub (مش من خادم الموقع) وبيصلّح المشاكل لوحده"
        actions={<button type="button" onClick={() => { reload(); loadReport(); }} className={`${btn} bg-white border border-stone-300`}><RefreshCw className="w-4 h-4" />{T('تحديث')}</button>} />
      <div className="grid lg:grid-cols-2 gap-4">
        <div className={`${card} space-y-2`}>
          <h2 className="font-bold text-sm">آخر تقرير للطبيب</h2>
          {report === undefined && <Feedback loading />}
          {report === null && <p className="text-xs text-stone-500">لسه مفيش تقرير — أول فحص بيتعمل خلال 10 دقايق من دمج الطبيب في main.</p>}
          {report && (
            <>
              <p className="text-sm font-semibold">{report.headline}</p>
              {report.lastRun && <p className="text-[11px] text-stone-500">آخر فحص: {new Date(report.lastRun).toLocaleString('ar-EG', { timeZone: 'Africa/Cairo' })}</p>}
              <ul className="space-y-1">
                {report.rows.map((r) => <li key={r.check} className="flex gap-2 text-xs"><span>{r.status}</span><span className="font-semibold">{r.check}</span><span className="text-stone-500 truncate">{r.detail}</span></li>)}
              </ul>
              {report.timeline && <p className="text-xs" title="آخر 6 ساعات">آخر 6 ساعات: <span className="tracking-tight">{report.timeline}</span></p>}
              <h3 className="font-bold text-xs pt-2">إصلاحات الكود التلقائية</h3>
              {report.fixes.length ? report.fixes.map((f) => (
                <p key={f.at} className="text-xs">{FIX_RESULT[f.result] || f.result} — {f.summary || f.problem}{f.url && <> · <a href={f.url} target="_blank" rel="noreferrer" className="text-amber-700 underline">التغيير</a></>}</p>
              )) : <p className="text-xs text-stone-500">لسه مفيش</p>}
              <a href={report.url} target="_blank" rel="noreferrer" className="inline-block text-xs text-amber-700 underline">السجل الكامل على GitHub ←</a>
            </>
          )}
        </div>
        <div className={`${card} space-y-2`}>
          <h2 className="font-bold text-sm">الخادم دلوقتي (النسخة اللي ردّت)</h2>
          <Feedback error={error} loading={loading && !data} />
          {w && data && (
            <>
              <p className="text-xs text-stone-500" dir="ltr">version {data.version.slice(0, 7)} · up {Math.round(data.uptimeS / 60)} min</p>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl bg-stone-50 p-2"><p className="text-lg font-bold">{w.answered}</p><p className="text-[10px] text-stone-500">ردود آخر 10 د</p></div>
                <div className="rounded-xl bg-stone-50 p-2"><p className="text-lg font-bold">{Math.round(w.errorRate * 100)}%</p><p className="text-[10px] text-stone-500">أخطاء</p></div>
                <div className="rounded-xl bg-stone-50 p-2"><p className="text-lg font-bold">{(w.latencyMs.p95 / 1000).toFixed(1)}ث</p><p className="text-[10px] text-stone-500">p95</p></div>
              </div>
              {Object.keys(w.errors).length > 0 && <p className="text-xs text-red-700" dir="ltr">{Object.entries(w.errors).map(([k, v]) => `${k}: ${v}`).join(' · ')}</p>}
              {Object.entries(data.providers).map(([id, p]) => (
                <p key={id} className="text-xs">{ENGINE_LABEL[id] || id}: {p.coolingMs > 0 ? `⏸️ متوقف ${Math.ceil(p.coolingMs / 1000)}ث (حصة)` : '🟢 متاح'} · {p.startedLastMinute}/دقيقة{p.rpm ? ` · حد ${p.rpm}` : ''}</p>
              ))}
              {data.answerCache && <p className="text-xs text-stone-600">ذاكرة الإجابات: {data.answerCache.entries} إجابة · {data.answerCache.hits} مرة من الذاكرة</p>}
              <div className="flex flex-wrap gap-2 pt-1">
                {Object.keys(REMEDY_LABEL).map((action) => (
                  <button key={action} type="button" disabled={Boolean(busy)} onClick={() => remedy(action)} className={`${btn} text-xs bg-stone-900 text-amber-100`}>
                    {busy === action ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}{REMEDY_LABEL[action]}
                  </button>
                ))}
              </div>
              {message && <p role="status" className="text-xs">{message}</p>}
            </>
          )}
        </div>
      </div>
    </>
  );
}

