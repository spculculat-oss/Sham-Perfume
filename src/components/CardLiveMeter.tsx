import React, { useEffect, useState } from 'react';
import { apiUrl, isStaticHosting } from '../utils/api';
import { liveChip, networkCopy, verdictFromProvider, type NetworkCheck } from '../utils/cardNetwork';
import { cardLiveCopy, inspectCardEntry } from '../utils/paymentElement';

const IDLE: NetworkCheck = { connected: false, verdict: 'unconfirmed', reason: 'NETWORK_NOT_CONNECTED' };

/**
 * Instant check while a card is typed. The "active" chip lights only from a
 * live issuer acceptance. The card number is not sent to the network status call.
 */
export function CardLiveMeter({ number, expiry, lang, id }: { number: string; expiry: string; lang: string; id?: string }) {
  const ar = lang === 'ar';
  const live = inspectCardEntry(number, expiry);
  const [network, setNetwork] = useState<NetworkCheck>(IDLE);
  useEffect(() => {
    if (isStaticHosting) return;
    const ctrl = new AbortController();
    fetch(apiUrl('/api/store/card-network'), { signal: ctrl.signal })
      .then((response) => (response.ok ? response.json() : null))
      .then((body: { connected?: unknown; mode?: unknown; status?: unknown; decline?: unknown } | null) => {
        if (!body || typeof body !== 'object') return;
        setNetwork(verdictFromProvider({
          connected: body.connected === true,
          mode: body.mode === 'live' || body.mode === 'test' ? body.mode : undefined,
          status: typeof body.status === 'string' ? body.status : undefined,
          decline: typeof body.decline === 'string' ? body.decline : undefined,
        }));
      })
      .catch(() => {});
    return () => ctrl.abort();
  }, []);

  const lit = liveChip(live.verdict, network);
  const chips = [
    ['dummy', 'وهمية', 'Dummy'],
    ['inactive', 'غير مفعّلة', 'Not active'],
    ['active', 'مفعّلة', 'Active'],
  ] as const;
  const tone = (id: 'dummy' | 'inactive' | 'active') => {
    if (lit !== id) return 'bg-stone-100 text-stone-400';
    return id === 'active' ? 'bg-emerald-800 text-white' : 'bg-red-700 text-white';
  };

  return (
    <div id={id} className="space-y-1" data-testid="card-live-check" data-verdict={live.verdict} data-network={network.verdict} data-lit={lit}>
      <p className="text-[11px] font-bold text-stone-800">{ar ? 'الكشف اللحظي' : 'Instant check'}</p>
      <div className="grid grid-cols-3 gap-1">
        {chips.map(([id, a, e]) => (
          <span key={id} data-chip={id} className={`rounded-lg px-1 py-1 text-center text-[10px] font-bold ${tone(id)}`}>{ar ? a : e}</span>
        ))}
      </div>
      <p className={`text-[11px] ${lit === 'none' ? 'text-sky-800' : 'text-red-700'}`} role="status">
        {live.verdict === 'empty' ? (ar ? 'اكتب الرقم. الكشف يعمل مع كل رقم.' : 'Type the number. The check runs on each digit.') : cardLiveCopy(live.verdict, lang)}
      </p>
      <p className="text-[10px] leading-4 text-stone-500">{networkCopy(network, lang)}</p>
    </div>
  );
}
