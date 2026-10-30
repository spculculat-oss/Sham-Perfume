import React, { useEffect, useState } from 'react';
import { AdminApiError, adminRequest, send } from '../admin/adminApi';
import { ACCOUNT_CURRENCIES } from '../bank/shamAccount';
import { major } from '../finance/money';
import { worldFirstSnapshot, type SaleSettlement, type WorldFirstSnapshot } from '../bank/worldFirstRail';

/**
 * Owner-only view of the institution behind Sham Bank.
 * Customers never see this card. It cannot mark a transfer sent.
 */
export function WorldFirstRailCard({ ar }: { ar: boolean }) {
  const t = (a: string, e: string) => (ar ? a : e);
  const [snap, setSnap] = useState<WorldFirstSnapshot>(worldFirstSnapshot(false, 0));
  const [items, setItems] = useState<SaleSettlement[]>([]);
  const [saleId, setSaleId] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [paid, setPaid] = useState('');
  const [cost, setCost] = useState('');
  const [shipping, setShipping] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    const data = await adminRequest<WorldFirstSnapshot & { items: SaleSettlement[] }>('/finance/bank/sham/settlement');
    setSnap(data);
    setItems(data.items || []);
  };

  useEffect(() => { void load().catch(() => { /* the local snapshot stays honest if the API is away */ }); }, []);

  const queue = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setNotice('');
    try {
      const item = await adminRequest<SaleSettlement>('/finance/bank/sham/settlement', send('POST', {
        saleId, currency, customerPaid: paid, merchantCost: cost, shipping,
      }));
      setNotice(item.marginMatchesPolicy
        ? t('اتحجزت في الخلفية. لم يُرسل شيء إلى وورلد فيرست.', 'Queued in the background. Nothing was sent to WorldFirst.')
        : t('اتحجزت، وهامشها مش ٥٠٪ من تكلفة التاجر. لم يُرسل شيء.', 'Queued, and its margin is not 50% of the merchant cost. Nothing was sent.'));
      setSaleId('');
      await load().catch(() => setItems((rows) => rows.some((row) => row.id === item.id) ? rows : [item, ...rows]));
    } catch (e) {
      const code = e instanceof AdminApiError ? e.code : '';
      const text: Record<string, [string, string]> = {
        INVALID_SALE: ['مرجع العملية من ٨ إلى ٤٠ حرفاً.', 'The sale reference must be 8 to 40 characters.'],
        INVALID_AMOUNT: ['راجع المبالغ. التكلفة والشحن لا يتجاوزان ما دفعه العميل.', 'Check the amounts. Cost and shipping cannot exceed what the customer paid.'],
        CONFLICT: ['هذه العملية مسجّلة بمبالغ مختلفة.', 'This sale is already queued with different amounts.'],
        SECRET: ['لا يُكتب رقم حساب هنا.', 'An account number is not entered here.'],
      };
      const row = text[code];
      setError(row ? t(row[0], row[1]) : t('تعذّر تسجيل التسوية. لم يُرسل شيء.', 'The settlement could not be queued. Nothing was sent.'));
    }
  };

  return (
    <section className="space-y-3 rounded-2xl border border-stone-900 bg-stone-950 p-4 text-white" data-testid="worldfirst-rail">
      <div>
        <p className="text-sm font-bold">{t('تسوية الخلفية', 'Background settlement')}</p>
        <p className="mt-1 text-xs leading-5 text-stone-300">{t('بنك شام هو البنك الظاهر. وورلد فيرست يستقبل في الخلفية ثمن البيع، وتكلفة الشراء من التاجر، وربح المنصة. القبول الذي أبلغت به ليس تأكيداً من وورلد فيرست.', 'Sham Bank is the bank people see. WorldFirst is behind it for the sale receipt, the merchant purchase, and the platform profit. The acceptance you reported is not a confirmation from WorldFirst.')}</p>
      </div>
      <dl className="grid gap-2 text-xs sm:grid-cols-2">
        <div className="rounded-xl bg-white/10 px-3 py-2"><dt className="text-stone-400">{t('الحساب', 'Account')}</dt><dd className="font-bold">{t('أُبلغ بالقبول · غير مؤكد من الواجهة', 'Reported accepted · not confirmed by the API')}</dd></div>
        <div className="rounded-xl bg-white/10 px-3 py-2"><dt className="text-stone-400">{t('تفاصيل الاستقبال', 'Receiving details')}</dt><dd className="font-bold">{t('لم تُصدر', 'Not issued')}</dd></div>
        <div className="rounded-xl bg-white/10 px-3 py-2"><dt className="text-stone-400">{t('الربط', 'Connection')}</dt><dd className="font-bold">{snap.api === 'keys_present' ? t('المفتاح موجود · الإرسال مقفول', 'Key present · sending stays closed') : t('غير موصول', 'Not connected')}</dd></div>
        <div className="rounded-xl bg-white/10 px-3 py-2"><dt className="text-stone-400">{t('الإرسال', 'Sending')}</dt><dd className="font-bold">{t('لم يُرسل', 'Not sent')} · {snap.queued}</dd></div>
      </dl>
      <form className="grid gap-2 sm:grid-cols-2" onSubmit={(e) => void queue(e)}>
        <label className="text-xs sm:col-span-2">{t('مرجع العملية', 'Sale reference')}<input value={saleId} onChange={(e) => setSaleId(e.target.value)} className="mt-1 w-full rounded-xl border border-white/20 bg-transparent px-3 py-2 text-sm" dir="ltr" data-testid="worldfirst-sale" /></label>
        <label className="text-xs">{t('العملة', 'Currency')}<select value={currency} onChange={(e) => setCurrency(e.target.value)} className="mt-1 w-full rounded-xl border border-white/20 bg-stone-950 px-3 py-2 text-sm">{ACCOUNT_CURRENCIES.map((code) => <option key={code}>{code}</option>)}</select></label>
        <label className="text-xs">{t('ما دفعه العميل', 'Customer paid')}<input value={paid} onChange={(e) => setPaid(e.target.value)} className="mt-1 w-full rounded-xl border border-white/20 bg-transparent px-3 py-2 text-sm" dir="ltr" inputMode="decimal" /></label>
        <label className="text-xs">{t('تكلفة التاجر', 'Merchant cost')}<input value={cost} onChange={(e) => setCost(e.target.value)} className="mt-1 w-full rounded-xl border border-white/20 bg-transparent px-3 py-2 text-sm" dir="ltr" inputMode="decimal" /></label>
        <label className="text-xs">{t('الشحن', 'Shipping')}<input value={shipping} onChange={(e) => setShipping(e.target.value)} className="mt-1 w-full rounded-xl border border-white/20 bg-transparent px-3 py-2 text-sm" dir="ltr" inputMode="decimal" /></label>
        <button type="submit" className="rounded-xl bg-white px-3 py-2 text-xs font-bold text-stone-950 sm:col-span-2">{t('حجز التسوية في الخلفية', 'Queue the settlement in the background')}</button>
      </form>
      {notice && <p role="status" className="text-xs text-emerald-200">{notice}</p>}
      {error && <p role="alert" className="text-xs text-red-200">{error}</p>}
      {items.length > 0 && (
        <ul className="space-y-1 text-xs">
          {items.slice(0, 6).map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-2 rounded-xl bg-white/10 px-3 py-2">
              <span dir="ltr">{item.id} · {item.currency} {major(item.profitMinor, item.currency)}</span>
              <span className="rounded-lg bg-amber-200 px-2 py-0.5 font-bold text-amber-950">{t('محجوز', 'Queued')}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
