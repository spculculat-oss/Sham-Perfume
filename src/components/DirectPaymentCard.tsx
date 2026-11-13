import React, { useState } from 'react';
import { CheckCircle2, Copy, Landmark, Loader2, RefreshCw, XCircle } from 'lucide-react';
import { claimDirectOrder, refreshDirectOrder, type DirectOrder } from '../utils/directPayment';
import { formatMoney } from '../utils/storeCheckout';
import { makeStoreT } from '../لغات/storeL10n';
import { LOCALE_MAP } from '../لغات/localize';
import type { SupportedLanguage } from '../types/i18n';

/** «بنك شام» on the buyer's screen: what to pay, where, and a short form to report the transfer. */
export default function DirectPaymentCard({ order, lang, onChange }: { order: DirectOrder; lang: SupportedLanguage; onChange: (o: DirectOrder) => void }) {
  const t = makeStoreT(lang);
  const locale = LOCALE_MAP[lang] || 'en-GB';
  const amount = formatMoney(Number(order.amount), order.currency, lang, t('sf_currency'));
  const [form, setForm] = useState({ payerName: '', transferRef: '', amount: order.amount, paidAt: new Date(Date.now() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 16) });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState('');
  const until = (() => { try { return new Date(order.expiresAt).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' }); } catch { return order.expiresAt; } })();
  const copy = (value: string) => { void navigator.clipboard?.writeText(value).then(() => { setCopied(value); setTimeout(() => setCopied(''), 1500); }).catch(() => undefined); };
  const run = async (work: () => Promise<DirectOrder>) => {
    if (busy) return; setBusy(true); setError('');
    try { onChange(await work()); } catch { setError(t('sf_direct_error')); } finally { setBusy(false); }
  };
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    void run(() => claimDirectOrder(order, { ...form, paidAt: new Date(form.paidAt).toISOString() }));
  };
  const field = 'w-full px-3 py-2 border border-stone-200 rounded-xl text-xs focus:outline-none focus:border-amber-600 bg-white';
  const status = (icon: React.ReactNode, text: string, tone: string) => <p role="status" className={`flex items-start gap-2 text-xs rounded-xl p-3 ${tone}`}>{icon}<span>{text}</span></p>;

  return (
    <section className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-3 space-y-3" data-testid="direct-payment-card">
      <p className="flex items-center gap-2 text-sm font-bold text-stone-900"><Landmark className="w-4 h-4 text-emerald-700" />{t('sf_direct_reserved', { ref: order.ref })}</p>
      {order.kind === 'cod' && order.state !== 'paid' && order.state !== 'rejected' && status(<CheckCircle2 className="w-4 h-4 shrink-0" />, t('sf_direct_cod_done', { ref: order.ref, amount }), 'bg-white text-emerald-900')}
      {order.kind !== 'cod' && order.state === 'awaiting_payment' && <>
        <div className="rounded-xl bg-white p-3 space-y-2 text-xs">
          <p className="font-extrabold text-amber-900 text-sm flex items-center justify-between gap-2">
            <span>{t('sf_direct_amount', { amount })}</span>
            <button type="button" onClick={() => copy(order.amount)} className="inline-flex items-center gap-1 text-[11px] text-stone-600 hover:text-stone-900"><Copy className="w-3 h-3" />{copied === order.amount ? '✓' : t('sf_direct_copy')}</button>
          </p>
          <p className="font-bold text-stone-800">{order.label}</p>
          {order.instructions && <p dir="auto" className="whitespace-pre-wrap text-stone-700 leading-relaxed" data-testid="direct-instructions">{order.instructions}</p>}
          <p className="flex items-center justify-between gap-2 text-stone-700">
            <span>{t('sf_direct_howto', { ref: order.ref })}</span>
            <button type="button" onClick={() => copy(order.ref)} className="inline-flex items-center gap-1 text-[11px] text-stone-600 hover:text-stone-900"><Copy className="w-3 h-3" />{copied === order.ref ? '✓' : t('sf_direct_copy')}</button>
          </p>
          <p className="text-[11px] text-stone-500">{t('sf_direct_until', { date: until })}</p>
        </div>
        <form onSubmit={submit} className="space-y-2" data-testid="direct-claim-form">
          <p className="text-xs font-bold text-stone-900">{t('sf_direct_claim_title')}</p>
          <input required minLength={2} maxLength={80} className={field} placeholder={t('sf_direct_payer')} aria-label={t('sf_direct_payer')} value={form.payerName} onChange={(e) => setForm({ ...form, payerName: e.target.value })} autoComplete="name" />
          <input required minLength={3} maxLength={40} dir="ltr" className={field} placeholder={t('sf_direct_txref')} aria-label={t('sf_direct_txref')} value={form.transferRef} onChange={(e) => setForm({ ...form, transferRef: e.target.value })} />
          <div className="grid grid-cols-2 gap-2">
            <label className="text-[11px] text-stone-600 space-y-1"><span>{t('sf_direct_paid_amount')}</span><input required inputMode="decimal" dir="ltr" className={field} value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></label>
            <label className="text-[11px] text-stone-600 space-y-1"><span>{t('sf_direct_paid_at')}</span><input required type="datetime-local" dir="ltr" className={field} value={form.paidAt} onChange={(e) => setForm({ ...form, paidAt: e.target.value })} /></label>
          </div>
          <button type="submit" disabled={busy} className="w-full py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:bg-stone-400 text-white text-sm font-bold inline-flex items-center justify-center gap-2">{busy && <Loader2 className="w-4 h-4 animate-spin" />}{t('sf_direct_send')}</button>
        </form>
      </>}
      {order.state === 'claimed' && status(<CheckCircle2 className="w-4 h-4 shrink-0" />, t('sf_direct_claimed'), 'bg-white text-emerald-900')}
      {order.state === 'paid' && status(<CheckCircle2 className="w-4 h-4 shrink-0" />, t('sf_direct_paid', { ref: order.ref }), 'bg-emerald-100 text-emerald-900')}
      {order.state === 'rejected' && status(<XCircle className="w-4 h-4 shrink-0" />, t('sf_direct_rejected', { ref: order.ref }), 'bg-red-50 text-red-800')}
      {order.state === 'expired' && status(<XCircle className="w-4 h-4 shrink-0" />, t('sf_direct_expired', { ref: order.ref }), 'bg-amber-50 text-amber-900')}
      {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
      {order.state !== 'paid' && <button type="button" onClick={() => void run(() => refreshDirectOrder(order))} disabled={busy} className="w-full py-1.5 text-xs text-stone-600 hover:underline inline-flex items-center justify-center gap-1"><RefreshCw className="w-3 h-3" />{t('sf_direct_refresh')}</button>}
    </section>
  );
}
