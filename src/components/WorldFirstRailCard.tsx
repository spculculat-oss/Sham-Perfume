import React, { useEffect, useState } from 'react';
import { AdminApiError, adminRequest, send } from '../admin/adminApi';
import { major } from '../finance/money';
import { WORLDFIRST_RECEIVING_REGIONS, WORLDFIRST_WALLETS, worldFirstSnapshot, type WorldFirstAccountNameKind, type WorldFirstLinkView, type WorldFirstReceivingRegion, type SaleSettlement, type WorldFirstSnapshot } from '../bank/worldFirstRail';

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
  const [wallets, setWallets] = useState<{ currency: typeof WORLDFIRST_WALLETS[number]['currency']; available: string; pending: string }[]>(WORLDFIRST_WALLETS.map((row) => ({ ...row })));
  const [live, setLive] = useState(false);
  const [link, setLink] = useState<WorldFirstLinkView>(worldFirstSnapshot(false, 0).link);
  const [privateOnce, setPrivateOnce] = useState('');
  const [seenInPortal, setSeenInPortal] = useState(false);
  const [region, setRegion] = useState<WorldFirstReceivingRegion>('SG');
  const [nameKind, setNameKind] = useState<WorldFirstAccountNameKind | ''>('');
  const [rotateArmed, setRotateArmed] = useState(false);

  const load = async () => {
    const data = await adminRequest<WorldFirstSnapshot & { items: SaleSettlement[] }>('/finance/bank/sham/settlement');
    setSnap(data);
    setItems(data.items || []);
    setLink(data.link || worldFirstSnapshot(false, 0).link);
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
  const linkError = (code: string) => {
    const text: Record<string, [string, string]> = {
      RATE_LIMITED: ['انتظر قبل تجهيز مفتاح جديد.', 'Wait before preparing another key.'],
      SECRET: ['لا يُكتب رقم حساب أو مفتاح هنا.', 'An account number or key is not entered here.'],
      NOT_SEEN: ['التأكيد لازم يكون من جوه صفحة Receive.', 'Confirmation has to come from inside the Receive page.'],
      INVALID_REGION: ['المنطقة دي مش من مناطق استقبال وورلد فيرست.', 'That region is not a WorldFirst receiving location.'],
      INVALID_LINK: ['حدد شكل الاسم من غير ما تكتب الرقم.', 'Choose the name kind without typing the number.'],
    };
    const row = text[code];
    setError(row ? t(row[0], row[1]) : t('الربط وقف. مفيش حاجة اتبعتت.', 'The link stopped. Nothing was sent.'));
  };
  const prepareKey = async (rotate: boolean) => {
    setError('');
    setNotice('');
    try {
      const data = await adminRequest<{ reissued: boolean; publicKeyPem: string; publicKeyBody: string; privateFingerprint: string; privateKeyPem?: string; receiving: WorldFirstSnapshot['receiving'] }>('/finance/bank/sham/settlement/link/prepare', send('POST', rotate ? { rotate: true } : {}));
      setPrivateOnce(data.privateKeyPem || '');
      setRotateArmed(false);
      setNotice(data.reissued
        ? t('المفتاح اتجهّز. انسخ الخاص مرة واحدة إلى Vercel، وابعت العام لدعم وورلد فيرست. متبعتش الخاص هنا.', 'The key is ready. Copy the private key once into Vercel, and send the public key to WorldFirst support. Do not send the private key here.')
        : t('المفتاح العام موجود. الخاص مش محفوظ، ومفيش حاجة اتبعتت.', 'The public key is already here. The private key is not stored, and nothing was sent.'));
      await load().catch(() => setLink((row) => ({ ...row, prepared: true, publicKeyPem: data.publicKeyPem, publicKeyBody: data.publicKeyBody, privateFingerprint: data.privateFingerprint })));
    } catch (e) {
      linkError(e instanceof AdminApiError ? e.code : '');
    }
  };
  const markSeen = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setNotice('');
    if (!seenInPortal || !nameKind) {
      setError(t('علّم إنك شفت الحساب جوه Receive، وحدد شكل الاسم. متكتبش الرقم.', 'Mark that you saw the account inside Receive, and choose the name kind. Do not type the number.'));
      return;
    }
    try {
      await adminRequest('/finance/bank/sham/settlement/link/seen', send('POST', { seenInPortal: true, region, accountNameKind: nameKind }));
      setNotice(t('اتسجل إن التفاصيل ظاهرة جوه الحساب. الرقم مش محفوظ، والإرسال مقفول.', 'Recorded that the details are visible inside the account. The number is not stored, and sending stays closed.'));
      await load().catch(() => setLink((row) => ({ ...row, receivingSeen: true, receivingRegion: region, accountNameKind: nameKind })));
    } catch (e) {
      linkError(e instanceof AdminApiError ? e.code : '');
    }
  };
  const connection = snap.link?.serverKey === 'different' || link.serverKey === 'different'
    ? t('مفتاح الخادم مختلف · الإرسال مقفول', 'Server key differs · sending stays closed')
    : snap.api === 'keys_present'
      ? t('المفتاح موجود · الإرسال مقفول', 'Key present · sending stays closed')
      : link.prepared && link.serverKey === 'matches'
        ? t('المفتاح الخاص مطابق · لسه مفيش Client ID', 'Private key matches · Client ID is still missing')
        : link.prepared
          ? t('المفتاح العام جاهز · الخاص مش على الخادم', 'Public key is ready · the private key is not on the server')
          : t('غير موصول', 'Not connected');
  const regionLabel: Record<WorldFirstReceivingRegion, [string, string]> = {
    SG: ['سنغافورة', 'Singapore'], HK: ['هونغ كونغ', 'Hong Kong'], JP: ['اليابان', 'Japan'], AU: ['أستراليا', 'Australia'],
    NZ: ['نيوزيلندا', 'New Zealand'], GB: ['بريطانيا', 'United Kingdom'], US: ['أمريكا', 'United States'], NL: ['هولندا', 'Netherlands'],
  };
  const readBalance = async () => {
    setError('');
    setNotice('');
    try {
      const data = await adminRequest<WorldFirstSnapshot & { inquiry: string; wallets: { currency: string; available: string; pending: string }[] }>('/finance/bank/sham/settlement/inquire', send('POST', {}));
      const verified = data.inquiry === 'verified' && data.balancesLive === true;
      setLive(verified);
      if (verified) setWallets(data.wallets.filter((row): row is { currency: typeof WORLDFIRST_WALLETS[number]['currency']; available: string; pending: string } => WORLDFIRST_WALLETS.some((known) => known.currency === row.currency)));
      setNotice(verified
        ? t('اتقرأت الأرصدة من وورلد فيرست. الإرسال لسه مقفول، ومفيش رقم حساب ظاهر.', 'Balances were read from WorldFirst. Sending stays closed, and no account number is shown.')
        : data.inquiry === 'not_ready'
          ? t('مفيش مفتاح شريك. الرقم المعروض هو صفر الشاشة، مش قراءة حية.', 'No partner key. The figure shown is the screen zero, not a live read.')
          : t('الرد ما اتأكدش. الرصيد فضل صفر الشاشة، ومفيش حاجة اتبعتت.', 'The reply was not verified. The balance stays the screen zero, and nothing was sent.'));
    } catch {
      setLive(false);
      setError(t('القراءة وقفت. الرصيد فضل صفر الشاشة.', 'The read stopped. The balance stays the screen zero.'));
    }
  };

  return (
    <section className="space-y-3 rounded-2xl border border-stone-900 bg-stone-950 p-4 text-white" data-testid="worldfirst-rail">
      <div>
        <p className="text-base font-black">{t('ربط وورلد فيرست', 'WorldFirst link')}</p>
        <p className="mt-1 text-xs leading-5 text-stone-300">{t('بنك شام هو البنك الظاهر. وورلد فيرست يستقبل في الخلفية ثمن البيع، وتكلفة الشراء من التاجر، وربح المنصة. القبول الذي أبلغت به ليس تأكيداً من وورلد فيرست.', 'Sham Bank is the bank people see. WorldFirst is behind it for the sale receipt, the merchant purchase, and the platform profit. The acceptance you reported is not a confirmation from WorldFirst.')}</p>
      </div>
      <div data-testid="worldfirst-wallets">
        <p className="text-xs text-stone-400">{live
          ? t('قراءة مؤكدة من وورلد فيرست. الإرسال مقفول، ورقم الحساب مش ظاهر.', 'Verified read from WorldFirst. Sending is closed, and the account number is not shown.')
          : t('عملات الشاشة: الإجمالي التقديري 0.00 دولار. الصفر مش رصيد شام، وCNH يوان خارجي مش يوان صيني محلي.', 'Screen currencies: estimated total 0.00 USD. Zero is not a Sham balance, and CNH is offshore yuan, not onshore CNY.')}</p>
        <ul className="mt-2 grid grid-cols-2 gap-2 text-xs sm:grid-cols-5">
          {(live ? wallets : WORLDFIRST_WALLETS).map((row) => (
            <li key={row.currency} className="rounded-xl bg-white/10 px-2 py-2">
              <p className="font-bold" dir="ltr">{row.currency}</p>
              <p dir="ltr">{t('متاح', 'Available')} {row.available}</p>
              <p className="text-stone-400" dir="ltr">{t('معلّق', 'Pending')} {row.pending}</p>
            </li>
          ))}
        </ul>
      </div>
      <dl className="grid gap-2 text-xs sm:grid-cols-2">
        <div className="rounded-xl bg-white/10 px-3 py-2"><dt className="text-stone-400">{t('الحساب', 'Account')}</dt><dd className="font-bold">{t('أُبلغ بالقبول · غير مؤكد من الواجهة', 'Reported accepted · not confirmed by the API')}</dd></div>
        <div className="rounded-xl bg-white/10 px-3 py-2"><dt className="text-stone-400">{t('تفاصيل الاستقبال', 'Receiving details')}</dt><dd className="font-bold">{link.receivingSeen || snap.receiving === 'owner_seen_in_portal' ? t(`ظاهرة جوه Receive${link.receivingRegion ? ` · ${link.receivingRegion}` : ''} · الرقم مش محفوظ`, `Seen inside Receive${link.receivingRegion ? ` · ${link.receivingRegion}` : ''} · the number is not stored`) : t('لم تُسجل على الموقع', 'Not recorded on the site')}</dd></div>
        <div className="rounded-xl bg-white/10 px-3 py-2"><dt className="text-stone-400">{t('الربط', 'Connection')}</dt><dd className="font-bold">{connection}</dd></div>
        <div className="rounded-xl bg-white/10 px-3 py-2"><dt className="text-stone-400">{t('الإرسال', 'Sending')}</dt><dd className="font-bold">{t('لم يُرسل', 'Not sent')} · {snap.queued}</dd></div>
      </dl>
      <div className="space-y-2 rounded-xl border border-white/15 p-3 text-xs" data-testid="worldfirst-link">
        <p className="font-bold">{t('ربط الواجهة', 'API link')}</p>
        <p className="leading-5 text-stone-300">{t('حساب سنغافورة مش هو الربط. الربط مفتاح RSA2: العام يتبعت لدعم وورلد فيرست، والخاص يتحط في Vercel مرة واحدة. الرقم والآيبان ما يتكتبوش هنا.', 'The Singapore account is not the API link. The link is an RSA2 key: send the public half to WorldFirst support, and put the private half in Vercel once. Do not type the number or IBAN here.')}</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="rounded-xl bg-white px-3 py-2 font-bold text-stone-950" onClick={() => void prepareKey(false)}>{link.prepared ? t('اعرض المفتاح العام', 'Show the public key') : t('جهّز مفتاح الربط', 'Prepare the link key')}</button>
          <label className="flex items-center gap-2"><input type="checkbox" checked={rotateArmed} onChange={(e) => setRotateArmed(e.target.checked)} />{t('دوّر المفتاح', 'Rotate the key')}</label>
          <button type="button" className="rounded-xl border border-white/30 px-3 py-2 font-bold disabled:opacity-40" disabled={!rotateArmed} onClick={() => void prepareKey(true)}>{t('إصدار مفتاح جديد', 'Issue a new key')}</button>
        </div>
        {link.prepared && (
          <label className="block">{t('المفتاح العام — انسخه لبعته لدعم وورلد فيرست', 'Public key — copy it for WorldFirst support')}
            <textarea readOnly value={link.publicKeyBody} rows={3} className="mt-1 w-full rounded-xl border border-white/20 bg-transparent px-3 py-2 font-mono text-[11px]" dir="ltr" spellCheck={false} />
          </label>
        )}
        {privateOnce && (
          <div className="space-y-1 rounded-xl bg-amber-200/10 p-2">
            <p className="font-bold text-amber-100">{t('المفتاح الخاص ظهر مرة واحدة. مش هيتحفظ. حطه في Vercel باسم WORLDFIRST_PRIVATE_KEY وبعدين Redeploy. متبعتوش في الشات.', 'The private key is shown once. It will not be stored. Put it in Vercel as WORLDFIRST_PRIVATE_KEY, then Redeploy. Do not send it in chat.')}</p>
            <textarea readOnly value={privateOnce} rows={4} className="w-full rounded-xl border border-amber-200/40 bg-transparent px-3 py-2 font-mono text-[11px]" dir="ltr" spellCheck={false} autoComplete="off" />
            <button type="button" className="rounded-xl border border-white/30 px-3 py-2 font-bold" onClick={() => setPrivateOnce('')}>{t('امسح المفتاح من الشاشة', 'Clear the key from the screen')}</button>
          </div>
        )}
        <form className="grid gap-2 sm:grid-cols-2" onSubmit={(e) => void markSeen(e)}>
          <label className="flex items-start gap-2 sm:col-span-2"><input type="checkbox" className="mt-0.5" checked={seenInPortal} onChange={(e) => setSeenInPortal(e.target.checked)} />{t('شفت الحساب جوه Receive، مش في الإيميل بس.', 'I saw the account inside Receive, not only in an email.')}</label>
          <label>{t('المنطقة اللي ظاهرة', 'Region shown')}<select value={region} onChange={(e) => setRegion(e.target.value as WorldFirstReceivingRegion)} className="mt-1 w-full rounded-xl border border-white/20 bg-stone-950 px-3 py-2">{WORLDFIRST_RECEIVING_REGIONS.map((code) => <option key={code} value={code}>{t(regionLabel[code][0], regionLabel[code][1])}</option>)}</select></label>
          <label>{t('اسم صاحب الحساب', 'Account name')}<select value={nameKind} onChange={(e) => setNameKind(e.target.value as WorldFirstAccountNameKind | '')} className="mt-1 w-full rounded-xl border border-white/20 bg-stone-950 px-3 py-2"><option value="">{t('اختار من غير رقم', 'Choose, no number')}</option><option value="owner">{t('اسمي أو اسم الشركة', 'My name or the company')}</option><option value="worldfirst">{t('وورلد فيرست أو Alipay', 'WorldFirst or Alipay')}</option><option value="partner_bank">{t('بنك شريك', 'Partner bank')}</option></select></label>
          <button type="submit" className="rounded-xl border border-white/30 px-3 py-2 font-bold sm:col-span-2">{t('سجّل إن التفاصيل ظاهرة، من غير الرقم', 'Record that the details are visible, without the number')}</button>
        </form>
      </div>
      <form className="grid gap-2 sm:grid-cols-2" onSubmit={(e) => void queue(e)}>
        <label className="text-xs sm:col-span-2">{t('مرجع العملية', 'Sale reference')}<input value={saleId} onChange={(e) => setSaleId(e.target.value)} className="mt-1 w-full rounded-xl border border-white/20 bg-transparent px-3 py-2 text-sm" dir="ltr" data-testid="worldfirst-sale" /></label>
        <label className="text-xs">{t('العملة', 'Currency')}<select value={currency} onChange={(e) => setCurrency(e.target.value)} className="mt-1 w-full rounded-xl border border-white/20 bg-stone-950 px-3 py-2 text-sm">{WORLDFIRST_WALLETS.map((row) => <option key={row.currency}>{row.currency}</option>)}</select></label>
        <label className="text-xs">{t('ما دفعه العميل', 'Customer paid')}<input value={paid} onChange={(e) => setPaid(e.target.value)} className="mt-1 w-full rounded-xl border border-white/20 bg-transparent px-3 py-2 text-sm" dir="ltr" inputMode="decimal" /></label>
        <label className="text-xs">{t('تكلفة التاجر', 'Merchant cost')}<input value={cost} onChange={(e) => setCost(e.target.value)} className="mt-1 w-full rounded-xl border border-white/20 bg-transparent px-3 py-2 text-sm" dir="ltr" inputMode="decimal" /></label>
        <label className="text-xs">{t('الشحن', 'Shipping')}<input value={shipping} onChange={(e) => setShipping(e.target.value)} className="mt-1 w-full rounded-xl border border-white/20 bg-transparent px-3 py-2 text-sm" dir="ltr" inputMode="decimal" /></label>
        <button type="submit" className="rounded-xl bg-white px-3 py-2 text-xs font-bold text-stone-950 sm:col-span-2">{t('حجز التسوية في الخلفية', 'Queue the settlement in the background')}</button>
        <button type="button" className="rounded-xl border border-white/30 px-3 py-2 text-xs font-bold sm:col-span-2" onClick={() => void readBalance()}>{t('اقرأ الرصيد من وورلد فيرست', 'Read the WorldFirst balance')}</button>
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
