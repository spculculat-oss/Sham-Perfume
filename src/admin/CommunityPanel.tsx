/**
 * «المجتمع» in the admin panel: everything from «مجتمع شام», decrypted for the administration only —
 * members' files, merchants' files and products (with their private supplier links), orders with the buyer's
 * address, moderation, reports, private conversations (only with a written reason) and the audit log.
 * Every access is recorded server-side.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { apiUrl } from '../utils/api';
import { CheckCircle2, ClipboardList, Eye, Flag, Loader2, Lock, Mail, RefreshCw, ScrollText, Search, ShieldAlert, Store, Users, X } from 'lucide-react';
import { T } from './adminL10n';
import { AdminApiError, adminRequest, send } from './adminApi';
import { BUNDLED_FX, convert, tidy } from '../utils/pricing';

const card = 'rounded-2xl border border-stone-200 bg-white p-4 shadow-sm';
const input = 'w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400';
const picker = 'w-auto min-w-40 rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400';
const CATEGORY: Record<string, string> = { perfume: 'عطور جاهزة', oil: 'زيوت عطرية', raw_material: 'خامات', alcohol: 'كحول ومذيبات', bottle: 'زجاجات', packaging: 'تغليف', tool: 'أدوات', incense: 'بخور', other: 'أخرى' };
const btn = 'inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold disabled:opacity-50 cursor-pointer';
const sale = (price: number, currency: string) => tidy(convert(price, currency, 'EGP', BUNDLED_FX) * 1.5);
const date = (iso?: string | null) => (iso ? new Date(iso).toLocaleString('ar-EG', { dateStyle: 'medium', timeStyle: 'short' }) : '—');
const fmt = (n: number, c: string) => { try { return new Intl.NumberFormat('ar-EG', { style: 'currency', currency: c, maximumFractionDigits: 2 }).format(n); } catch { return `${n} ${c}`; } };

type Sub = 'overview' | 'users' | 'merchants' | 'products' | 'orders' | 'moderation' | 'audit';
type Any = Record<string, any>;

function useAdmin<T>(path: string | null, deps: unknown[] = []) {
  const [data, setData] = useState<T | undefined>();
  const [error, setError] = useState<AdminApiError | null>(null);
  const [loading, setLoading] = useState(false);
  const reload = useCallback(async () => {
    if (!path) return;
    setLoading(true);
    try { setData(await adminRequest<T>(path)); setError(null); } catch (e) { setError(e instanceof AdminApiError ? e : new AdminApiError(0, 'NETWORK', String(e))); } finally { setLoading(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, ...deps]);
  useEffect(() => { void reload(); }, [reload]);
  return { data, error, loading, reload };
}

async function act(path: string, method: string, body?: unknown) {
  try { await adminRequest(path, send(method, body ?? {})); return true; } catch (e) { alert(e instanceof AdminApiError ? `${e.code}: ${e.message}` : String(e)); return false; }
}

export default function CommunityPanel() {
  const [sub, setSub] = useState<Sub>('overview');
  const [userId, setUserId] = useState<string | null>(null);
  const overview = useAdmin<Any>('/community/overview');
  const tabs: [Sub, string, React.ReactNode, number?][] = [
    ['overview', T('الملخص'), <Users key="o" className="h-4 w-4" />],
    ['users', T('الأعضاء'), <Users key="u" className="h-4 w-4" />],
    ['merchants', T('التجار'), <Store key="m" className="h-4 w-4" />, overview.data?.merchants_pending],
    ['products', T('منتجات للمراجعة'), <ClipboardList key="p" className="h-4 w-4" />, overview.data?.products_pending],
    ['orders', T('الطلبات'), <ClipboardList key="d" className="h-4 w-4" />, overview.data?.orders_to_ship],
    ['moderation', T('البلاغات والإشراف'), <Flag key="r" className="h-4 w-4" />, overview.data?.reports_open],
    ['audit', T('سجل المراجعة'), <ScrollText key="a" className="h-4 w-4" />],
  ];

  if (overview.error?.code === 'COMMUNITY_NOT_CONFIGURED' || overview.error?.status === 503) return <Setup reason={overview.error.message} code={overview.error.code} />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="me-auto text-xl font-bold">{T('مجتمع شام')}</h2>
        <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs text-emerald-800"><Lock className="me-1 inline h-3 w-3" />{T('البيانات مشفّرة — وكل اطلاع بيتسجّل في سجل المراجعة')}</span>
        <button type="button" onClick={() => void overview.reload()} className={`${btn} bg-stone-100`}><RefreshCw className="h-4 w-4" /></button>
      </div>
      <div className="flex gap-1 overflow-x-auto">
        {tabs.map(([id, label, icon, n]) => (
          <button key={id} type="button" onClick={() => setSub(id)} className={`${btn} shrink-0 ${sub === id ? 'bg-stone-900 text-white' : 'bg-white border border-stone-200'}`}>
            {icon}{label}{n ? <span className="rounded-full bg-rose-600 px-1.5 text-[10px] text-white">{n}</span> : null}
          </button>
        ))}
      </div>
      {overview.error && <p className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{overview.error.code}: {overview.error.message}</p>}
      {sub === 'overview' && <OverviewView data={overview.data} go={setSub} />}
      {sub === 'users' && <UsersView open={setUserId} />}
      {sub === 'merchants' && <MerchantsView open={setUserId} onChange={overview.reload} />}
      {sub === 'products' && <ProductsView onChange={overview.reload} />}
      {sub === 'orders' && <OrdersView onChange={overview.reload} />}
      {sub === 'moderation' && <ModerationView open={setUserId} onChange={overview.reload} />}
      {sub === 'audit' && <AuditView />}
      {userId && <UserFile id={userId} onClose={() => setUserId(null)} onChange={overview.reload} />}
    </div>
  );
}

/** What the server sees right now (setting names only) — so the fix is obvious without screenshots. */
function SetupDiagnosis() {
  const [s, setS] = React.useState<Any>();
  React.useEffect(() => { fetch(apiUrl('/api/community/status')).then((r) => r.json()).then(setS, () => setS(undefined)); }, []);
  if (!s) return null;
  const line = s.reason === 'database'
    ? (s.found?.length ? `${T('السيرفر شايف الإعدادات دي بس مفيهاش رابط قاعدة بيانات صالح')}: ${s.found.join('، ')}` : T('السيرفر مش شايف أي إعداد لقاعدة البيانات — الربط لسه ماتمّش على المشروع ده، أو محتاج Redeploy بعد الربط.'))
    : s.reason === 'error' ? `${T('قاعدة البيانات موجودة بس الاتصال فشل')} (${({ auth: T('كلمة سر قاعدة البيانات غلط'), network: T('السيرفر مش قادر يوصل لقاعدة البيانات'), ssl: T('مشكلة تشفير الاتصال'), other: T('سبب آخر') } as Record<string, string>)[s.errorKind] || '—'})`
    : s.reason === 'key' ? T('مفتاح SHAM_DATA_KEY مش مطابق للمفتاح اللي اتعمل بيه التشفير.') : '';
  return line ? <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900">{line}{s.vercelEnv ? ` · ${s.vercelEnv}` : ''}</p> : null;
}

function Setup({ reason, code }: { reason: string; code: string }) {
  return (
    <div className={`${card} space-y-3`}>
      <h2 className="flex items-center gap-2 text-lg font-bold"><ShieldAlert className="h-5 w-5 text-amber-600" />{T('مجتمع شام محتاج تفعيل على Vercel')}</h2>
      <p className="text-sm text-stone-600">{code}: {reason}</p>
      <SetupDiagnosis />
      <ol className="list-decimal space-y-2 ps-5 text-sm leading-relaxed text-stone-700">
        <li>{T('افتح مشروع sham-perfume-49bf على Vercel ← Storage ← Create Database ← Neon (Postgres) ← Connect (علّم Production). ده بيضيف رابط قاعدة البيانات تلقائياً — بأي اسم، السيرفر بيلاقيه.')}</li>
        <li>{T('اعمل Redeploy للمشروع، وبعدها حدّث الصفحة دي. مفتاح التشفير بيتعمل لوحده أول مرة.')}</li>
        <li className="text-stone-500">{T('اختياري لحماية أعلى: أضف SHAM_DATA_KEY (24 حرف أو أكثر) في Environment Variables. السيرفر بيقفل بيه مفتاح التشفير، ولازم يفضل ثابت بعد كده.')}</li>
      </ol>
    </div>
  );
}

function Stat({ label, value, note, onClick, tone = 'text-stone-900' }: { label: string; value: React.ReactNode; note?: string; onClick?: () => void; tone?: string }) {
  return <button type="button" onClick={onClick} className={`${card} text-start ${onClick ? 'hover:border-amber-300 cursor-pointer' : 'cursor-default'}`}><p className={`text-2xl font-black ${tone}`}>{value}</p><p className="text-xs text-stone-500">{label}</p>{note && <p className="mt-1 inline-block rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-800">{note}</p>}</button>;
}

function OverviewView({ data, go }: { data?: Any; go: (s: Sub) => void }) {
  if (!data) return <Loading />;
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <Stat label={T('الأعضاء')} value={data.users} onClick={() => go('users')} />
      <Stat label={T('متصلين الآن')} value={data.online} tone="text-emerald-700" />
      <Stat label={T('جدد هذا الأسبوع')} value={data.new_week} />
      <Stat label={T('موقوفين')} value={data.suspended} tone="text-rose-700" />
      <Stat label={T('التجار')} value={data.merchants} note={`${data.merchants_pending} ${T('للمراجعة')}`} onClick={() => go('merchants')} />
      <Stat label={T('منتجات التجار')} value={data.products} note={`${data.products_pending} ${T('للمراجعة')}`} onClick={() => go('products')} />
      <Stat label={T('طلبات مدفوعة')} value={data.orders} note={`${data.orders_to_ship} ${T('للشحن')}`} onClick={() => go('orders')} />
      <Stat label={T('ربح الموقع من التجار')} value={fmt(data.margin_egp || 0, 'EGP')} tone="text-amber-800" />
      <Stat label={T('منشورات')} value={data.posts} />
      <Stat label={T('محادثات / رسائل')} value={`${data.conversations} / ${data.messages}`} />
      <Stat label={T('تركيبات محفوظة')} value={data.recipes} />
      <Stat label={T('بلاغات مفتوحة')} value={data.reports_open} tone="text-rose-700" onClick={() => go('moderation')} />
      <p className="col-span-full text-[11px] text-stone-500">{T('قاعدة البيانات')}: {data.store === 'pglite' ? T('تجريبية في الذاكرة (للتطوير فقط)') : 'Postgres'}</p>
    </div>
  );
}

const Loading = () => <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-amber-600" /></div>;
const Pill = ({ children, tone = 'bg-stone-100 text-stone-700' }: { children: React.ReactNode; tone?: string }) => <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${tone}`}>{children}</span>;
const TONE: Record<string, string> = { active: 'bg-emerald-100 text-emerald-800', approved: 'bg-emerald-100 text-emerald-800', pending: 'bg-amber-100 text-amber-900', suspended: 'bg-rose-100 text-rose-700', rejected: 'bg-rose-100 text-rose-700', paused: 'bg-stone-100 text-stone-700', paid: 'bg-sky-100 text-sky-800', processing: 'bg-violet-100 text-violet-800', shipped: 'bg-amber-100 text-amber-900', delivered: 'bg-emerald-100 text-emerald-800', cancelled: 'bg-rose-100 text-rose-700', refunded: 'bg-rose-100 text-rose-700', open: 'bg-rose-100 text-rose-700', resolved: 'bg-emerald-100 text-emerald-800', dismissed: 'bg-stone-100 text-stone-600' };
const STATUS_AR: Record<string, string> = { active: 'نشط', approved: 'معتمد', pending: 'للمراجعة', suspended: 'موقوف', rejected: 'مرفوض', paused: 'موقوف مؤقتاً', paid: 'مدفوع', processing: 'جاهز للشحن', shipped: 'تم الشحن', delivered: 'تم التسليم', cancelled: 'ملغي', refunded: 'مسترد', open: 'مفتوح', resolved: 'تم الحل', dismissed: 'مرفوض', awaiting_payment: 'بانتظار الدفع', user: 'عضو', merchant: 'تاجر' };
const St = ({ s }: { s: string }) => <Pill tone={TONE[s]}>{T(STATUS_AR[s] || s)}</Pill>;

function UsersView({ open }: { open: (id: string) => void }) {
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [role, setRole] = useState('');
  const { data, loading } = useAdmin<Any[]>(`/community/users?q=${encodeURIComponent(query)}&role=${role}`, [query, role]);
  return (
    <div className="space-y-3">
      <form className="flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); setQuery(q); }}>
        <div className="relative min-w-[220px] flex-1"><Search className="absolute inset-y-0 start-3 my-auto h-4 w-4 text-stone-400" /><input className={`${input} ps-9`} value={q} onChange={(e) => setQ(e.target.value)} placeholder={T('اسم، اسم مستخدم، أو بريد كامل')} /></div>
        <select className={picker} value={role} onChange={(e) => setRole(e.target.value)}><option value="">{T('الكل')}</option><option value="user">{T('أعضاء')}</option><option value="merchant">{T('تجار')}</option></select>
        <button type="submit" className={`${btn} bg-stone-900 text-white`}>{T('بحث')}</button>
      </form>
      {loading ? <Loading /> : (
        <div className={`${card} overflow-x-auto p-0`}>
          <table className="w-full text-sm"><thead className="bg-stone-50 text-xs text-stone-500"><tr><th className="p-3 text-start">{T('العضو')}</th><th className="p-3 text-start">{T('البريد')}</th><th className="p-3">{T('النوع')}</th><th className="p-3">{T('الحالة')}</th><th className="p-3">{T('التسجيل')}</th><th /></tr></thead>
            <tbody>{(data || []).map((u) => (
              <tr key={u.id} className="border-t border-stone-100">
                <td className="p-3"><p className="font-semibold">{u.name}</p><p className="text-xs text-stone-500">@{u.handle} · {u.country}</p></td>
                <td className="p-3 font-mono text-xs" dir="ltr">{u.email}</td>
                <td className="p-3 text-center"><St s={u.role} />{u.merchantStatus && <div className="mt-1"><St s={u.merchantStatus} /></div>}</td>
                <td className="p-3 text-center"><St s={u.status} /></td>
                <td className="p-3 text-center text-xs text-stone-500">{date(u.createdAt)}</td>
                <td className="p-3"><button type="button" onClick={() => open(u.id)} className={`${btn} bg-amber-50 text-amber-900`}><Eye className="h-4 w-4" />{T('الملف')}</button></td>
              </tr>
            ))}</tbody></table>
          {!data?.length && <p className="p-6 text-center text-sm text-stone-500">{T('لا يوجد أعضاء')}</p>}
        </div>
      )}
    </div>
  );
}

function KV({ data }: { data: Record<string, unknown> }) {
  const entries = Object.entries(data || {}).filter(([, v]) => v !== '' && v != null);
  if (!entries.length) return <p className="text-xs text-stone-400">—</p>;
  return <dl className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-2">{entries.map(([k, v]) => <div key={k} className="flex gap-2"><dt className="shrink-0 text-stone-500">{k}:</dt><dd className="break-all font-medium">{String(v)}</dd></div>)}</dl>;
}

function MerchantsView({ open, onChange }: { open: (id: string) => void; onChange: () => void }) {
  const [status, setStatus] = useState('pending');
  const { data, loading, reload } = useAdmin<Any[]>(`/community/merchants?status=${status}`, [status]);
  const review = async (m: Any, s: string) => {
    const note = s === 'approved' ? '' : prompt(T('ملاحظة للتاجر (السبب أو المطلوب تعديله):')) ?? null;
    if (note === null) return;
    if (await act(`/community/merchants/${m.userId}/review`, 'POST', { status: s, note })) { void reload(); onChange(); }
  };
  return (
    <div className="space-y-3">
      <select className={picker} value={status} onChange={(e) => setStatus(e.target.value)}>
        {['pending', 'approved', 'rejected', 'suspended', ''].map((s) => <option key={s} value={s}>{s ? T(STATUS_AR[s]) : T('الكل')}</option>)}
      </select>
      {loading ? <Loading /> : !data?.length ? <p className={`${card} text-center text-sm text-stone-500`}>{T('لا يوجد')}</p> : data.map((m) => (
        <div key={m.userId} className={`${card} space-y-3`}>
          <div className="flex flex-wrap items-center gap-3">
            {m.logo ? <img src={m.logo} alt="" className="h-12 w-12 rounded-xl object-cover" /> : <span className="text-3xl">🏪</span>}
            <div className="flex-1"><p className="font-bold">{m.storeName} <St s={m.status} /></p><p className="text-xs text-stone-500">{m.owner?.name} · @{m.owner?.handle} · <span dir="ltr">{m.owner?.email}</span> · {m.country} · {m.currency}</p></div>
            <span className="text-xs text-stone-500">{m.products} {T('منتج')} · {m.pending} {T('للمراجعة')}</span>
          </div>
          {m.about && <p className="text-sm text-stone-700">{m.about}</p>}
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-xl bg-emerald-50/60 p-3"><p className="mb-2 flex items-center gap-1 text-xs font-bold text-emerald-900"><Lock className="h-3 w-3" />{T('البيانات القانونية والتواصل')}</p><KV data={m.legal} /></div>
            <div className="rounded-xl bg-emerald-50/60 p-3"><p className="mb-2 flex items-center gap-1 text-xs font-bold text-emerald-900"><Lock className="h-3 w-3" />{T('استلام المستحقات')}</p><KV data={m.payout} /></div>
          </div>
          {m.note && <p className="text-xs text-stone-500">{T('آخر ملاحظة')}: {m.note}</p>}
          <div className="flex flex-wrap gap-2">
            {m.status !== 'approved' && <button type="button" onClick={() => void review(m, 'approved')} className={`${btn} bg-emerald-600 text-white`}><CheckCircle2 className="h-4 w-4" />{T('اعتماد المتجر')}</button>}
            {m.status !== 'rejected' && <button type="button" onClick={() => void review(m, 'rejected')} className={`${btn} bg-amber-100 text-amber-900`}>{T('طلب تعديلات')}</button>}
            {m.status !== 'suspended' && <button type="button" onClick={() => void review(m, 'suspended')} className={`${btn} bg-rose-100 text-rose-700`}>{T('إيقاف')}</button>}
            <button type="button" onClick={() => open(m.userId)} className={`${btn} bg-stone-100`}><Eye className="h-4 w-4" />{T('ملف العضو')}</button>
          </div>
        </div>
      ))}
    </div>
  );
}

function ProductsView({ onChange }: { onChange: () => void }) {
  const [status, setStatus] = useState('pending');
  const { data, loading, reload } = useAdmin<Any[]>(`/community/products?status=${status}`, [status]);
  const review = async (p: Any, s: string) => {
    const note = s === 'approved' ? '' : prompt(T('ملاحظة للتاجر:')) ?? null;
    if (note === null) return;
    if (await act(`/community/products/${p.id}/review`, 'POST', { status: s, note })) { void reload(); onChange(); }
  };
  return (
    <div className="space-y-3">
      <select className={picker} value={status} onChange={(e) => setStatus(e.target.value)}>
        {['pending', 'approved', 'rejected', 'paused', ''].map((s) => <option key={s} value={s}>{s ? T(STATUS_AR[s]) : T('الكل')}</option>)}
      </select>
      {loading ? <Loading /> : !data?.length ? <p className={`${card} text-center text-sm text-stone-500`}>{T('لا يوجد')}</p> : (
        <div className="grid gap-3 lg:grid-cols-2">{data.map((p) => (
          <div key={p.id} className={`${card} space-y-2`}>
            <div className="flex gap-1.5 overflow-x-auto">{p.images.map((src: string, i: number) => <a key={i} href={src} target="_blank" rel="noreferrer"><img src={src} alt="" className="h-24 w-24 shrink-0 rounded-xl object-cover" /></a>)}</div>
            <p className="font-bold">{p.name} <St s={p.status} /></p>
            <p className="text-xs text-stone-500">🏪 {p.storeName} · {T(CATEGORY[p.category] || p.category)} · {T('المخزون')}: {p.stock}</p>
            <p className="text-sm">{T('سعر التاجر')}: <b>{fmt(p.price, p.currency)}</b> → {T('سعر البيع')}: <b className="text-amber-800">{fmt(sale(p.price, p.currency), 'EGP')}</b></p>
            {p.description && <p className="max-h-28 overflow-y-auto whitespace-pre-wrap text-sm text-stone-700">{p.description}</p>}
            <div className="rounded-xl bg-emerald-50/60 p-2.5 text-xs"><p className="mb-1 flex items-center gap-1 font-bold text-emerald-900"><Lock className="h-3 w-3" />{T('روابط المصدر الخاصة (لا تظهر للعملاء)')}</p>
              {p.source?.links?.length ? p.source.links.map((l: string) => <a key={l} href={l} target="_blank" rel="noreferrer noopener" className="block truncate text-sky-700 underline" dir="ltr">{l}</a>) : <span className="text-stone-400">—</span>}
              {p.source?.notes && <p className="mt-1 text-stone-700">{p.source.notes}</p>}</div>
            {p.reviewNote && <p className="text-xs text-stone-500">{T('آخر ملاحظة')}: {p.reviewNote}</p>}
            <div className="flex flex-wrap gap-2">
              {p.status !== 'approved' && <button type="button" onClick={() => void review(p, 'approved')} className={`${btn} bg-emerald-600 text-white`}><CheckCircle2 className="h-4 w-4" />{T('نشر')}</button>}
              {p.status !== 'rejected' && <button type="button" onClick={() => void review(p, 'rejected')} className={`${btn} bg-amber-100 text-amber-900`}>{T('طلب تعديل')}</button>}
              {p.status === 'approved' && <button type="button" onClick={() => void review(p, 'paused')} className={`${btn} bg-stone-100`}>{T('إيقاف مؤقت')}</button>}
            </div>
          </div>
        ))}</div>
      )}
    </div>
  );
}

const ORDER_NEXT = ['paid', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'];
function OrdersView({ onChange }: { onChange: () => void }) {
  const [status, setStatus] = useState('');
  const { data, loading, reload } = useAdmin<Any[]>(`/community/orders?status=${status}`, [status]);
  const set = async (o: Any, s: string) => {
    const note = ['cancelled', 'refunded'].includes(s) ? prompt(T('السبب:')) ?? null : '';
    if (note === null) return;
    if (await act(`/community/orders/${o.id}/status`, 'POST', { status: s, note })) { void reload(); onChange(); }
  };
  return (
    <div className="space-y-3">
      <select className={picker} value={status} onChange={(e) => setStatus(e.target.value)}>
        <option value="">{T('كل الطلبات المدفوعة')}</option>{['awaiting_payment', ...ORDER_NEXT].map((s) => <option key={s} value={s}>{T(STATUS_AR[s])}</option>)}
      </select>
      {loading ? <Loading /> : !data?.length ? <p className={`${card} text-center text-sm text-stone-500`}>{T('لا يوجد')}</p> : data.map((o) => (
        <div key={o.id} className={`${card} space-y-2`}>
          <div className="flex flex-wrap items-center gap-2"><span className="font-mono font-bold">#{o.number}</span><St s={o.status} /><span className="text-xs text-stone-500">🏪 {o.storeName} · {date(o.createdAt)} · {T('مرجع الدفع')} {o.paymentRef}</span></div>
          <ul className="text-sm">{o.items.map((i: Any) => <li key={i.sku}>• {i.name} ×{i.qty} {i.merchantUnit != null && <span className="text-stone-500">({T('سعر التاجر')} {fmt(i.merchantUnit, o.merchantCurrency)})</span>}</li>)}</ul>
          <div className="grid gap-2 text-sm md:grid-cols-3">
            <p>{T('العميل دفع')}: <b>{fmt(o.total, o.currency)}</b></p>
            {o.merchantId && <p>{T('مستحق للتاجر')}: <b>{fmt(o.merchantTotal, o.merchantCurrency)}</b></p>}
            {o.merchantId && <p>{T('ربح الموقع')}: <b className="text-amber-800">{fmt(o.marginEgp, 'EGP')}</b></p>}
          </div>
          <div className="rounded-xl bg-emerald-50/60 p-2.5"><p className="mb-1 flex items-center gap-1 text-xs font-bold text-emerald-900"><Lock className="h-3 w-3" />{T('بيانات الشحن (مشفّرة)')} — {o.country}</p><KV data={o.address} /></div>
          <div className="flex flex-wrap gap-1.5">{ORDER_NEXT.filter((s) => s !== o.status).map((s) => <button key={s} type="button" onClick={() => void set(o, s)} className={`${btn} py-1.5 text-xs ${s === 'shipped' || s === 'delivered' ? 'bg-emerald-600 text-white' : 'bg-stone-100'}`}>{T(STATUS_AR[s])}</button>)}</div>
        </div>
      ))}
    </div>
  );
}

function ModerationView({ open, onChange }: { open: (id: string) => void; onChange: () => void }) {
  const reports = useAdmin<Any[]>('/community/reports?status=open');
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const posts = useAdmin<Any[]>(`/community/posts?q=${encodeURIComponent(query)}`, [query]);
  const resolve = async (r: Any, status: string) => { if (await act(`/community/reports/${r.id}`, 'POST', { status })) { void reports.reload(); onChange(); } };
  const moderate = async (kind: 'posts' | 'comments', id: string, status: string) => { if (await act(`/community/${kind}/${id}/moderate`, 'POST', { status })) { void posts.reload(); } };
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="space-y-2">
        <h3 className="font-bold">{T('البلاغات المفتوحة')}</h3>
        {reports.loading ? <Loading /> : !reports.data?.length ? <p className={`${card} text-sm text-stone-500`}>{T('لا توجد بلاغات مفتوحة')} ✅</p> : reports.data.map((r) => (
          <div key={r.id} className={`${card} space-y-2 text-sm`}>
            <p><Pill tone="bg-rose-100 text-rose-700">{r.targetKind || r.kind}</Pill> <span className="font-mono text-xs">{r.targetId}</span></p>
            <p className="text-stone-700">{r.reason || '—'}</p>
            <p className="text-xs text-stone-500">{T('من')}: {r.reporter || '—'} · {date(r.createdAt)}</p>
            <div className="flex flex-wrap gap-1.5">
              {(r.targetKind || r.kind) === 'post' && <button type="button" onClick={() => void moderate('posts', r.targetId, 'hidden').then(() => resolve(r, 'resolved'))} className={`${btn} bg-rose-600 py-1.5 text-xs text-white`}>{T('إخفاء المنشور')}</button>}
              {(r.targetKind || r.kind) === 'comment' && <button type="button" onClick={() => void moderate('comments', r.targetId, 'hidden').then(() => resolve(r, 'resolved'))} className={`${btn} bg-rose-600 py-1.5 text-xs text-white`}>{T('إخفاء التعليق')}</button>}
              {(r.targetKind || r.kind) === 'user' && <button type="button" onClick={() => open(r.targetId)} className={`${btn} bg-stone-100 py-1.5 text-xs`}>{T('فتح ملف العضو')}</button>}
              <button type="button" onClick={() => void resolve(r, 'resolved')} className={`${btn} bg-emerald-600 py-1.5 text-xs text-white`}>{T('تم الحل')}</button>
              <button type="button" onClick={() => void resolve(r, 'dismissed')} className={`${btn} bg-stone-100 py-1.5 text-xs`}>{T('تجاهل')}</button>
            </div>
          </div>
        ))}
      </div>
      <div className="space-y-2">
        <h3 className="font-bold">{T('المنشورات')}</h3>
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); setQuery(q); }}><input className={input} value={q} onChange={(e) => setQ(e.target.value)} placeholder={T('ابحث في المنشورات')} /><button type="submit" className={`${btn} bg-stone-900 text-white`}>{T('بحث')}</button></form>
        {posts.loading ? <Loading /> : (posts.data || []).map((p) => (
          <div key={p.id} className={`${card} space-y-1.5 text-sm`}>
            <p className="text-xs text-stone-500"><button type="button" onClick={() => open(p.author.id)} className="font-bold text-stone-800 hover:underline cursor-pointer">{p.author.name}</button> · {date(p.createdAt)} · <St s={p.status === 'visible' ? 'active' : 'suspended'} /> {p.reports > 0 && <Pill tone="bg-rose-100 text-rose-700">{p.reports} {T('بلاغ')}</Pill>}</p>
            {p.body && <p className="whitespace-pre-wrap text-stone-800">{p.body}</p>}
            {p.image && <img src={p.image} alt="" className="max-h-40 rounded-xl" />}
            <div className="flex gap-1.5">{p.status === 'visible' ? <button type="button" onClick={() => void moderate('posts', p.id, 'hidden')} className={`${btn} bg-rose-100 py-1 text-xs text-rose-700`}>{T('إخفاء')}</button>
              : <button type="button" onClick={() => void moderate('posts', p.id, 'visible')} className={`${btn} bg-emerald-100 py-1 text-xs text-emerald-800`}>{T('إظهار')}</button>}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AuditView() {
  const { data, loading } = useAdmin<Any[]>('/community/audit');
  return loading ? <Loading /> : (
    <div className={`${card} overflow-x-auto p-0`}>
      <table className="w-full text-xs"><thead className="bg-stone-50 text-stone-500"><tr><th className="p-2 text-start">{T('الوقت')}</th><th className="p-2 text-start">{T('الإجراء')}</th><th className="p-2 text-start">{T('الهدف')}</th><th className="p-2 text-start">{T('تفاصيل')}</th></tr></thead>
        <tbody>{(data || []).map((a) => <tr key={a.id} className="border-t border-stone-100"><td className="p-2 whitespace-nowrap">{date(a.at)}</td><td className="p-2 font-mono">{a.action}</td><td className="p-2 font-mono">{a.target}</td><td className="p-2">{a.detail}</td></tr>)}</tbody></table>
    </div>
  );
}

function UserFile({ id, onClose, onChange }: { id: string; onClose: () => void; onChange: () => void }) {
  const { data, loading, reload } = useAdmin<Any>(`/community/users/${id}`, [id]);
  const [chat, setChat] = useState<Any | null>(null);
  const status = async (s: string) => { const note = prompt(T('السبب (يُحفظ في سجل المراجعة):')) ?? null; if (note === null) return; if (await act(`/community/users/${id}/status`, 'POST', { status: s, note })) { void reload(); onChange(); } };
  const readChat = async (c: Any) => {
    const reason = prompt(T('سبب الاطلاع على المحادثة الخاصة (إجباري، يُحفظ في سجل المراجعة):'));
    if (!reason || reason.trim().length < 3) return;
    try { setChat(await adminRequest<Any>(`/community/conversations/${c.id}/read`, send('POST', { reason }))); } catch (e) { alert(e instanceof AdminApiError ? e.message : String(e)); }
  };
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-stone-950/50" onClick={onClose}>
      <div className="h-full w-full max-w-3xl overflow-y-auto bg-stone-50 p-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between"><h3 className="text-lg font-bold">{T('ملف العضو')}</h3><button type="button" onClick={onClose} className={`${btn} bg-white`}><X className="h-4 w-4" /></button></div>
        {loading || !data ? <Loading /> : (
          <div className="space-y-3">
            <div className={`${card} space-y-2`}>
              <p className="text-lg font-bold">{data.account.name} <St s={data.account.status} /> <St s={data.account.role} /></p>
              <KV data={{ id: data.account.id, handle: `@${data.account.handle}`, email: data.account.email, country: data.account.country, lang: data.account.lang, ...(data.account.private || {}), created: date(data.account.createdAt), lastSeen: date(data.account.lastSeen) }} />
              <div className="flex flex-wrap gap-2 pt-1">
                {data.account.status === 'active' ? <button type="button" onClick={() => void status('suspended')} className={`${btn} bg-rose-100 text-rose-700`}>{T('إيقاف الحساب')}</button>
                  : <button type="button" onClick={() => void status('active')} className={`${btn} bg-emerald-100 text-emerald-800`}>{T('إعادة تفعيل')}</button>}
                <button type="button" onClick={() => void act(`/community/users/${id}/signout`, 'POST').then(() => reload())} className={`${btn} bg-stone-100`}>{T('تسجيل خروج من كل الأجهزة')}</button>
                <button type="button" onClick={() => { const note = prompt(T('اكتب «حذف» وسبب الحذف لتأكيد حذف الحساب نهائياً:')); if (note?.includes('حذف')) void act(`/community/users/${id}`, 'DELETE', { note }).then((ok) => { if (ok) { onChange(); onClose(); } }); }} className={`${btn} bg-rose-600 text-white`}>{T('حذف الحساب')}</button>
              </div>
            </div>
            {data.merchant && <div className={card}><p className="mb-2 font-bold">🏪 {data.merchant.storeName} <St s={data.merchant.status} /></p><div className="grid gap-3 md:grid-cols-2"><div><p className="mb-1 text-xs font-bold text-emerald-900">{T('قانوني')}</p><KV data={data.merchant.legal} /></div><div><p className="mb-1 text-xs font-bold text-emerald-900">{T('المستحقات')}</p><KV data={data.merchant.payout} /></div></div></div>}
            <Section title={`${T('الطلبات')} (${data.orders.length})`}>{data.orders.map((o: Any) => <p key={o.id} className="text-sm">#{o.number} · {o.storeName} · <St s={o.status} /> · {fmt(o.total, o.currency)}</p>)}</Section>
            <Section title={`${T('منتجاته')} (${data.products.length})`}>{data.products.map((p: Any) => <p key={p.id} className="text-sm">{p.name} · {fmt(p.price, p.currency)} · <St s={p.status} /></p>)}</Section>
            <Section title={`${T('التركيبات')} (${data.recipes.length})`}>{data.recipes.map((r: Any) => <p key={r.id} className="text-sm">🧪 {r.title} · {r.visibility}</p>)}</Section>
            <Section title={`${T('التعلّم')} (${data.learning.length})`}>{data.learning.map((l: Any) => <p key={l.itemId} className="text-sm">{l.title} — {l.progress}%</p>)}</Section>
            <Section title={`${T('الأصدقاء')} (${data.friends.length})`}><p className="text-sm">{data.friends.map((f: Any) => `${f.name}${f.status !== 'accepted' ? ` (${f.status})` : ''}`).join('، ') || '—'}</p></Section>
            <Section title={`${T('المنشورات')} (${data.posts.length})`}>{data.posts.slice(0, 30).map((p: Any) => <p key={p.id} className="border-b border-stone-100 py-1 text-sm">{p.body?.slice(0, 200) || '📷'} <span className="text-xs text-stone-400">· {p.visibility} · {p.status}</span></p>)}</Section>
            <Section title={`${T('المحادثات الخاصة')} (${data.conversations.length})`}>
              <p className="mb-2 text-xs text-amber-800">{T('محتوى المحادثات مشفّر. الاطلاع عليه يتطلب كتابة سبب ويُسجَّل.')}</p>
              {data.conversations.map((c: Any) => <div key={c.id} className="flex items-center justify-between gap-2 border-b border-stone-100 py-1.5 text-sm"><span>{c.kind === 'group' ? '👥' : '💬'} {c.title} · {c.messages} {T('رسالة')}</span><button type="button" onClick={() => void readChat(c)} className={`${btn} bg-amber-50 py-1 text-xs text-amber-900`}><Eye className="h-3.5 w-3.5" />{T('اطلاع')}</button></div>)}
            </Section>
            <Section title={`${T('الجلسات')} (${data.sessions.length})`}>{data.sessions.map((s: Any, i: number) => <p key={i} className="text-xs text-stone-600">{s.agent || '—'} · {date(s.createdAt)}</p>)}</Section>
            <OfficialMail userId={id} />
          </div>
        )}
        {chat && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-stone-950/60 p-4" onClick={() => setChat(null)}>
            <div className="max-h-[85vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-4" onClick={(e) => e.stopPropagation()}>
              <div className="mb-3 flex items-center justify-between"><p className="font-bold">{chat.conversation.title || chat.members.map((m: Any) => m.name).join(' ↔ ')}</p><button type="button" onClick={() => setChat(null)}><X className="h-4 w-4" /></button></div>
              <div className="space-y-1.5">{chat.messages.map((m: Any) => (
                <div key={m.id} className="rounded-xl bg-stone-50 p-2 text-sm"><p className="text-[11px] text-stone-500">{chat.members.find((x: Any) => x.id === m.senderId)?.name || m.senderId} · {date(m.createdAt)} {m.deletedAt && `· ${T('محذوفة')}`}</p>
                  {m.kind === 'image' && m.attachment && <img src={m.attachment} alt="" className="max-h-40 rounded-lg" />}{m.kind === 'voice' && m.attachment && <audio controls src={m.attachment} />}<p className="whitespace-pre-wrap">{m.text}</p></div>
              ))}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => <div className={card}><p className="mb-2 font-bold">{title}</p>{children}</div>;

/** «بريد شام»: an official letter from the administration to this member's mailbox (recorded in the audit log). */
function OfficialMail({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (!subject.trim() && !body.trim()) return;
    setBusy(true);
    const ok = await act(`/community/mail/${userId}`, 'POST', { subject: subject.trim(), body: body.trim() });
    setBusy(false);
    if (ok) { setOpen(false); setSubject(''); setBody(''); alert(T('وصلت الرسالة الرسمية لبريد العضو ✓')); }
  };
  return (
    <Section title={T('رسالة رسمية (بريد شام)')}>
      {!open ? (
        <button type="button" onClick={() => setOpen(true)} className={`${btn} bg-amber-700 text-white`}><Mail className="h-4 w-4" />{T('إرسال رسالة رسمية للعضو')}</button>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-amber-800">{T('توصل للعضو في «بريد شام» كمرسل رسمي موثّق «إدارة شام» — يُسجَّل كل إرسال في سجل المراجعة.')}</p>
          <input className={input} value={subject} onChange={(e) => setSubject(e.target.value)} placeholder={T('الموضوع')} maxLength={190} />
          <textarea className={`${input} min-h-28`} value={body} onChange={(e) => setBody(e.target.value)} placeholder={T('نص الرسالة…')} maxLength={8000} />
          <div className="flex gap-2">
            <button type="button" disabled={busy || (!subject.trim() && !body.trim())} onClick={() => void submit()} className={`${btn} bg-amber-700 text-white`}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}{T('إرسال')}</button>
            <button type="button" onClick={() => setOpen(false)} className={`${btn} bg-stone-100`}>{T('إلغاء')}</button>
          </div>
        </div>
      )}
    </Section>
  );
}
