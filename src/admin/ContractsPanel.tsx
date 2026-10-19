/**
 * «التعاقدات» — the contracts officer in the dashboard (decision L-40, criteria in server/contracts/policy.ts).
 * The team member writes nothing from scratch: the system drafts every letter, checks it against the legal
 * manager's criteria, and he sends it himself from his own e-mail. The store signs on a private page; the legal
 * manager approves; only then may the importer read that store.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { BadgeCheck, Ban, CircleAlert, Copy, Download, FileSignature, Handshake, Loader2, Mail, MessageSquareReply, RefreshCw, Send, ShieldCheck, Undo2 } from 'lucide-react';
import { adminRequest, send } from './adminApi';
import { T, TP, adminLocale, reactiveMap } from './adminL10n';
import type { ContractStatus, ContractView } from '../../server/contracts/service';
import type { Sender } from '../../server/contracts/policy';

interface Check { ok: boolean; problems: { id: string; textAr: string }[] }
interface LetterView { subject: string; body: string; check: Check }
interface Letters { outreach: LetterView; reminder: LetterView; welcome?: LetterView }
interface Status { ready: boolean; decision: string; policyVersion: number; emailProvider: string; senderMissing: string[]; counts: Record<string, number> }
interface Draft { text: string; source: 'ai' | 'template'; engine?: string; check: Check }

const card = 'rounded-2xl border border-stone-200 bg-white p-4 sm:p-5 shadow-sm';
const field = 'w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400';
const button = 'inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold disabled:opacity-40';
const when = (value?: string) => (value ? new Date(value).toLocaleString(adminLocale(), { dateStyle: 'short', timeStyle: 'short' }) : '—');

const STATUS_LABEL: Record<ContractStatus, string> = reactiveMap(() => ({
  draft: T('مسودة — لسه ما اتبعتش'), sent: T('اتبعت'), viewed: T('فتح الاتفاقية'), signed: T('وقّع'), declined: T('رفض'),
  approved: T('معتمد — مسموح النقل'), revoked: T('سحب الموافقة'), opted_out: T('طلب إيقاف المراسلة'),
}));
const STATUS_TONE: Record<ContractStatus, string> = {
  draft: 'bg-stone-100 text-stone-700', sent: 'bg-sky-50 text-sky-800', viewed: 'bg-indigo-50 text-indigo-800', signed: 'bg-amber-50 text-amber-800',
  declined: 'bg-red-50 text-red-800', approved: 'bg-emerald-50 text-emerald-800', revoked: 'bg-red-50 text-red-800', opted_out: 'bg-stone-200 text-stone-700',
};
const SENDER_FIELDS: { key: keyof Sender; label: () => string; hint?: () => string; dir?: 'ltr' }[] = [
  { key: 'name', label: () => T('اسمك الحقيقي (بيظهر في الخطابات)') },
  { key: 'title', label: () => T('صفتك (مثلاً: مسؤول الشراكات)') },
  { key: 'entityName', label: () => T('اسم النشاط التجاري') },
  { key: 'registrationNo', label: () => T('رقم السجل التجاري (اختياري)'), hint: () => T('من غيره الخطابات بتقول «منصة» مش «شركة»') },
  { key: 'email', label: () => T('إيميلك اللي هتبعت منه'), dir: 'ltr' },
  { key: 'phone', label: () => T('رقم تواصل (اختياري)'), dir: 'ltr' },
  { key: 'platformName', label: () => T('اسم المنصة كما يظهر للمتاجر') },
  { key: 'governingLaw', label: () => T('القانون الحاكم') },
];

function CheckBadge({ check }: { check: Check }) {
  if (check.ok) return <p className="text-xs text-emerald-700 flex items-center gap-1"><ShieldCheck className="w-4 h-4" />{T('مطابق لمعايير المدير القانوني')}</p>;
  return <ul className="text-xs text-red-800 bg-red-50 rounded-xl p-2 space-y-1">{check.problems.map((p, i) => <li key={i} className="flex gap-1"><CircleAlert className="w-4 h-4 shrink-0" /><span><b dir="ltr">{p.id}</b> {p.textAr}</span></li>)}</ul>;
}

function LetterBox({ title, letter, to }: { title: string; letter: LetterView; to: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => { void navigator.clipboard?.writeText(`${letter.subject}\n\n${letter.body}`).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }); };
  const mailto = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(letter.subject)}&body=${encodeURIComponent(letter.body)}`;
  return <div className="rounded-xl border border-stone-200 p-3 space-y-2">
    <div className="flex flex-wrap items-center justify-between gap-2"><h4 className="font-bold text-sm">{title}</h4>
      <div className="flex gap-2"><button type="button" className={`${button} bg-stone-100`} onClick={copy}><Copy className="w-4 h-4" />{copied ? T('اتنسخ') : T('نسخ')}</button>
        {letter.check.ok && <a className={`${button} bg-amber-400 text-stone-950`} href={mailto}><Mail className="w-4 h-4" />{T('افتحه في الإيميل')}</a>}</div></div>
    <p className="text-sm font-semibold">{letter.subject}</p>
    <pre className="whitespace-pre-wrap text-sm font-sans bg-stone-50 rounded-xl p-3 max-h-80 overflow-auto">{letter.body}</pre>
    <CheckBadge check={letter.check} />
  </div>;
}

export default function ContractsPanel() {
  const [status, setStatus] = useState<Status | null>(null);
  const [sender, setSender] = useState<Sender | null>(null);
  const [contracts, setContracts] = useState<ContractView[]>([]);
  const [letters, setLetters] = useState<{ id: string; data: Letters } | null>(null);
  const [form, setForm] = useState({ storeName: '', domain: '', contactEmail: '', contactName: '', lang: 'ar' });
  const [reply, setReply] = useState({ id: '', message: '' });
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState(''); const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(''); const [showSettings, setShowSettings] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      const s = await adminRequest<Status>('/contracts/status');
      setStatus(s);
      if (!s.ready) return;
      const [settings, list] = await Promise.all([adminRequest<{ sender: Sender }>('/contracts/settings'), adminRequest<{ contracts: ContractView[] }>('/contracts')]);
      setSender(settings.sender); setContracts(list.contracts);
      if (s.senderMissing.length) setShowSettings(true);
    } catch (e) { setError(e instanceof Error ? e.message : T('تعذّر التحميل')); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const act = async (key: string, work: () => Promise<unknown>, done?: string) => {
    if (busy) return; setBusy(key); setError(''); setNotice('');
    try { await work(); if (done) setNotice(done); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : T('تعذّر الحفظ')); }
    finally { setBusy(''); }
  };
  const openLetters = (id: string) => act(`letters:${id}`, async () => setLetters({ id, data: await adminRequest<Letters>(`/contracts/${id}/letters`) }));
  const step = (c: ContractView, action: string, done: string, ask?: string) => {
    const note = ask ? window.prompt(ask) : '';
    if (note === null) return;
    void act(`${action}:${c.id}`, () => adminRequest(`/contracts/${c.id}/${action}`, send('POST', { note })), done);
  };
  const downloadCertificate = (c: ContractView) => act(`cert:${c.id}`, async () => {
    const body = await adminRequest(`/contracts/${c.id}/certificate`);
    const url = URL.createObjectURL(new Blob([JSON.stringify(body, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = `agreement-${c.domain}-${c.id}.json`; link.click(); URL.revokeObjectURL(url);
  });

  const selected = letters ? contracts.find((c) => c.id === letters.id) : undefined;
  return <div className="space-y-5" data-testid="contracts-panel">
    <header className="rounded-2xl bg-stone-900 text-white p-5 sm:p-7 flex flex-wrap items-center justify-between gap-4">
      <div><p className="text-xs text-amber-300 font-semibold mb-2">{TP('بمعايير المدير القانوني · القرار {id}', { id: status?.decision || 'L-40' })}</p>
        <h2 className="text-2xl font-bold flex gap-2 items-center"><Handshake className="w-7 h-7" />{T('مسؤول التعاقدات')}</h2>
        <p className="text-sm text-stone-300 mt-2 max-w-2xl">{T('بيجهز خطابات التعاون مع أصحاب المتاجر ويراجعها قانونياً، وإنت اللي بتبعتها من إيميلك باسمك. المتجر بيوافق إلكترونياً على صفحة خاصة، وبعد اعتماد المدير القانوني بس المستورد يقدر ينقل منتجاته. قيمة الهامش مابتظهرش، ورابط المتجر بيتبعت بعد الموافقة.')}</p></div>
      <button type="button" className={`${button} border border-stone-600`} onClick={() => void load()}><RefreshCw className="w-4 h-4" />{T('تحديث')}</button>
    </header>
    {error && <p role="alert" className="bg-red-50 border border-red-200 text-red-800 rounded-xl p-3 text-sm">{error}</p>}
    {notice && <p role="status" className="bg-emerald-50 text-emerald-800 rounded-xl p-3 text-sm">{notice}</p>}
    {!status && !error && <p className="text-sm text-stone-500 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />{T('جاري التحميل…')}</p>}
    {status && !status.ready && <div className={card}><p className="text-sm">{T('التعاقدات بتستخدم نفس قاعدة بيانات «المجتمع» على الخادم. أول ما المجتمع يشتغل (بعد إعادة النشر على Vercel) التبويب ده هيشتغل لوحده.')}</p></div>}
    {status?.ready && <>
      <div className="flex flex-wrap gap-2 text-xs">
        <span className={`rounded-full px-3 py-1 ${status.emailProvider ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'}`}>{status.emailProvider ? T('التأكيد بكود على إيميل المتجر') : T('مفيش خدمة إيميل: التأكيد برد المتجر على إيميلك')}</span>
        {Object.entries(status.counts).map(([k, n]) => <span key={k} className={`rounded-full px-3 py-1 ${STATUS_TONE[k as ContractStatus] || 'bg-stone-100'}`}>{STATUS_LABEL[k as ContractStatus] || k}: {n}</span>)}
      </div>

      <section className={card}>
        <button type="button" className="w-full flex items-center justify-between font-bold" onClick={() => setShowSettings((v) => !v)}>
          <span>{T('بيانات المرسل (إنت)')}{status.senderMissing.length ? <span className="text-red-700 text-xs font-normal ms-2">{T('ناقصة — لازم تتملي الأول')}</span> : null}</span><span>{showSettings ? '−' : '+'}</span></button>
        {showSettings && sender && <div className="mt-3 space-y-3">
          <p className="text-xs text-stone-500">{T('الخطابات بتطلع باسمك الحقيقي، وإنت بتراجعها وبتبعتها بنفسك من إيميلك. لو حد سأل إذا كانت الرسائل آلية، الرد بيكون صادق.')}</p>
          <div className="grid sm:grid-cols-2 gap-3">{SENDER_FIELDS.map((f) => <label key={f.key} className="text-sm space-y-1"><span className="font-semibold">{f.label()}</span>
            <input className={field} dir={f.dir} value={String(sender[f.key] || '')} onChange={(e) => setSender({ ...sender, [f.key]: e.target.value })} />{f.hint && <span className="text-xs text-stone-500">{f.hint()}</span>}</label>)}</div>
          <button type="button" className={`${button} bg-amber-400 text-stone-950`} disabled={Boolean(busy)} onClick={() => void act('settings', () => adminRequest('/contracts/settings', send('PUT', { sender })), T('اتحفظت البيانات'))}>{busy === 'settings' ? <Loader2 className="w-4 h-4 animate-spin" /> : <BadgeCheck className="w-4 h-4" />}{T('حفظ')}</button>
        </div>}
      </section>

      <section className={card}>
        <h3 className="font-bold mb-3 flex items-center gap-2"><FileSignature className="w-5 h-5" />{T('متجر جديد')}</h3>
        <div className="grid sm:grid-cols-2 gap-3">
          <input className={field} placeholder={T('اسم المتجر')} value={form.storeName} onChange={(e) => setForm({ ...form, storeName: e.target.value })} />
          <input className={field} dir="ltr" placeholder="example.com" value={form.domain} onChange={(e) => setForm({ ...form, domain: e.target.value })} />
          <input className={field} dir="ltr" placeholder={T('إيميل المتجر الرسمي')} value={form.contactEmail} onChange={(e) => setForm({ ...form, contactEmail: e.target.value })} />
          <input className={field} placeholder={T('اسم صاحب المتجر (اختياري)')} value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} />
          <select className={field} value={form.lang} onChange={(e) => setForm({ ...form, lang: e.target.value })} aria-label={T('لغة الخطاب')}><option value="ar">{T('عربي')}</option><option value="en">{T('إنجليزي')}</option></select>
        </div>
        <button type="button" className={`${button} bg-stone-900 text-white mt-3`} disabled={Boolean(busy) || status.senderMissing.length > 0}
          onClick={() => void act('create', async () => { const r = await adminRequest<{ contract: ContractView }>('/contracts', send('POST', form)); setForm({ storeName: '', domain: '', contactEmail: '', contactName: '', lang: form.lang }); await openLetters(r.contract.id); }, T('اتجهز الخطاب — راجعه وابعته من إيميلك'))}>
          {busy === 'create' ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSignature className="w-4 h-4" />}{T('جهز الاتفاقية والخطاب')}</button>
      </section>

      {letters && selected && <section className={`${card} space-y-3`}>
        <div className="flex items-center justify-between"><h3 className="font-bold">{TP('خطابات {store}', { store: selected.storeName })}</h3><button type="button" className="text-sm text-stone-500" onClick={() => setLetters(null)}>{T('إغلاق')}</button></div>
        <LetterBox title={T('الخطاب الأول')} letter={letters.data.outreach} to={selected.contactEmail} />
        <LetterBox title={T('تذكير واحد بس (بعد أسبوع من غير رد)')} letter={letters.data.reminder} to={selected.contactEmail} />
        {letters.data.welcome && <LetterBox title={T('خطاب الترحيب ورابط المتجر (بعد الاعتماد)')} letter={letters.data.welcome} to={selected.contactEmail} />}
      </section>}

      <section className={`${card} space-y-3`}>
        <h3 className="font-bold">{T('المتاجر')}</h3>
        {!contracts.length && <p className="text-sm text-stone-500">{T('لسه مفيش متاجر.')}</p>}
        {contracts.map((c) => <div key={c.id} className="rounded-xl border border-stone-200 p-3 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div><p className="font-bold">{c.storeName} <span className="text-xs text-stone-500 font-normal" dir="ltr">{c.domain}</span></p>
              <p className="text-xs text-stone-500">{TP('اتعمل {a} · اتبعت {b} · وقّع {c}', { a: when(c.createdAt), b: when(c.sentAt), c: when(c.signedAt) })}</p>
              {c.signerName && <p className="text-xs">{TP('الموقّع: {name} ({title}) · التأكيد: {v}', { name: c.signerName, title: c.signerTitle || '', v: c.verification ? (c.verification === 'email_code' ? T('كود الإيميل') : T('رد الإيميل')) : T('مستني') })}</p>}</div>
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_TONE[c.status]}`}>{STATUS_LABEL[c.status]}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={`${button} bg-stone-100`} onClick={() => void openLetters(c.id)}><Mail className="w-4 h-4" />{T('الخطابات')}</button>
            {c.status === 'draft' && <button type="button" className={`${button} bg-sky-100 text-sky-900`} onClick={() => step(c, 'sent', T('اتسجل إنه اتبعت'))}><Send className="w-4 h-4" />{T('بعته من إيميلي')}</button>}
            {['sent', 'viewed'].includes(c.status) && !c.remindedAt && <button type="button" className={`${button} bg-stone-100`} onClick={() => step(c, 'reminded', T('اتسجل التذكير'))}><Send className="w-4 h-4" />{T('بعت التذكير')}</button>}
            {c.status === 'signed' && !c.verification && <button type="button" className={`${button} bg-amber-100 text-amber-900`} onClick={() => step(c, 'confirm-reply', T('اتسجل تأكيد المتجر'), T('اكتب ملاحظة: تاريخ رد المتجر بكلمة «موافق» من إيميله الرسمي'))}><MessageSquareReply className="w-4 h-4" />{T('المتجر أكد برد الإيميل')}</button>}
            {c.status === 'signed' && c.verification && <button type="button" className={`${button} bg-emerald-600 text-white`} onClick={() => step(c, 'approve', T('اتعتمد — المستورد يقدر ينقل من المتجر ده'), T('ملاحظة الاعتماد (اختياري)'))}><ShieldCheck className="w-4 h-4" />{T('اعتماد المدير القانوني')}</button>}
            {c.signedAt && <button type="button" className={`${button} bg-stone-100`} onClick={() => void downloadCertificate(c)}><Download className="w-4 h-4" />{T('شهادة التوقيع')}</button>}
            {['draft', 'sent', 'viewed'].includes(c.status) && <button type="button" className={`${button} text-stone-600`} onClick={() => step(c, 'opt-out', T('اتسجل — مش هنراسلهم تاني'), T('المتجر طلب إيقاف المراسلة؟ اكتب ملاحظة (اختياري)'))}><Ban className="w-4 h-4" />{T('طلب إيقاف المراسلة')}</button>}
            {['signed', 'approved'].includes(c.status) && <button type="button" className={`${button} text-red-700`} onClick={() => step(c, 'revoke', T('اتسحبت الموافقة — المنتجات تتشال خلال 48 ساعة'), T('المتجر سحب موافقته؟ اكتب السبب'))}><Undo2 className="w-4 h-4" />{T('سحب الموافقة')}</button>}
          </div>
        </div>)}
      </section>

      <section className={`${card} space-y-3`}>
        <h3 className="font-bold flex items-center gap-2"><MessageSquareReply className="w-5 h-5" />{T('رد على سؤال متجر')}</h3>
        <p className="text-xs text-stone-500">{T('الصق رسالة المتجر، ومسؤول التعاقدات يجهز رد باسمك بمعايير المدير القانوني. راجعه وابعته بنفسك.')}</p>
        <select className={field} value={reply.id} onChange={(e) => setReply({ ...reply, id: e.target.value })} aria-label={T('المتجر')}><option value="">{T('— من غير متجر محدد —')}</option>{contracts.map((c) => <option key={c.id} value={c.id}>{c.storeName}</option>)}</select>
        <textarea className={field} rows={4} value={reply.message} onChange={(e) => setReply({ ...reply, message: e.target.value })} placeholder={T('رسالة المتجر')} />
        <button type="button" className={`${button} bg-stone-900 text-white`} disabled={Boolean(busy) || !reply.message.trim()} onClick={() => void act('reply', async () => setDraft(await adminRequest<Draft>('/contracts/reply', send('POST', reply))))}>
          {busy === 'reply' ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageSquareReply className="w-4 h-4" />}{T('جهز الرد')}</button>
        {draft && <div className="space-y-2">
          <p className="text-xs text-stone-500">{draft.source === 'ai' ? TP('صياغة الذكاء الاصطناعي ({engine})', { engine: draft.engine || '' }) : T('رد جاهز معتمد من المدير القانوني')}</p>
          <pre className="whitespace-pre-wrap text-sm font-sans bg-stone-50 rounded-xl p-3">{draft.text}</pre>
          <div className="flex gap-2"><button type="button" className={`${button} bg-stone-100`} onClick={() => void navigator.clipboard?.writeText(draft.text)}><Copy className="w-4 h-4" />{T('نسخ')}</button></div>
          <CheckBadge check={draft.check} />
        </div>}
      </section>
    </>}
  </div>;
}
