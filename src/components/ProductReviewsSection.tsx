/**
 * «آراء العملاء» on a product page — the reviews section of the merchant's AI Studio design, on real data:
 * members of «مجتمع شام» write one review per product (stars, text, longevity, projection), every visitor reads
 * them, the average and the 1–5 spread are computed by the server from those reviews only, and «شراء موثّق»
 * appears only when the server finds a paid order of that product for that member. No sample or invented reviews.
 * Text follows the visitor's language (src/لغات/storeL10n.ts, `rv_*` keys).
 */
import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, MessageSquarePlus, Star, ThumbsUp, Trash2 } from 'lucide-react';
import { cx, getSessionToken, type ProductReview, type ReviewSummary } from '../community/api';
import { errorText } from '../community/ui';
import type { SupportedLanguage } from '../types/i18n';
import { isRTL } from '../لغات/localizedContent';
import { makeStoreT, storeNumber } from '../لغات/storeL10n';
import type { StoreTextKey } from '../لغات/storeKeys';

const LONGEVITY = ['weak', 'moderate', 'long', 'very_long'] as const;
const SILLAGE = ['soft', 'moderate', 'strong', 'enormous'] as const;

function Stars({ value, size = 16 }: { value: number; size?: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" dir="ltr" aria-label={`${value}/5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} style={{ width: size, height: size }} className={i <= Math.round(value) ? 'fill-amber-400 text-amber-400' : 'text-stone-300'} />
      ))}
    </span>
  );
}

/**
 * Is «مجتمع شام» switched on on this server? Asked once per page (the status route always answers 200), so a product
 * page never fires a review request the server can only refuse with 503 — no failed request in the visitor's console.
 */
let communityOn: Promise<boolean> | undefined;
const communityEnabled = () => (communityOn ||= cx<{ enabled: boolean }>('/community/status', { timeoutMs: 8000 })
  .then((s) => s.enabled === true, () => { communityOn = undefined; return false; }));

export function ProductReviewsSection({ sku, currentLang }: { sku: string; currentLang: SupportedLanguage }) {
  const t = makeStoreT(currentLang);
  const dir = isRTL(currentLang) ? 'rtl' : 'ltr';
  const [data, setData] = useState<ReviewSummary | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'unavailable'>('loading');
  const [form, setForm] = useState<{ rating: number; title: string; body: string; longevity: string; sillage: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const signedIn = Boolean(getSessionToken());

  const load = useCallback(async () => {
    if (!(await communityEnabled())) { setState('unavailable'); return; }
    try { setData(await cx<ReviewSummary>(`/community/reviews/${encodeURIComponent(sku)}`, { timeoutMs: 12000 })); setState('ready'); }
    catch { setState('unavailable'); }
  }, [sku]);
  useEffect(() => { setState('loading'); setForm(null); void load(); }, [load]);

  const mine = data?.reviews.find((r) => r.mine);
  const openForm = () => {
    if (!signedIn) { window.location.hash = 'community/login'; return; }
    setForm(mine ? { rating: mine.rating, title: mine.title, body: mine.body, longevity: mine.longevity, sillage: mine.sillage } : { rating: 5, title: '', body: '', longevity: '', sillage: '' });
  };
  const submit = async () => {
    if (!form) return;
    setBusy(true); setNote('');
    try { setData(await cx<ReviewSummary>(`/community/reviews/${encodeURIComponent(sku)}`, { body: form })); setForm(null); setNote(t('rv_saved')); }
    catch (e) { setNote(errorText(e, currentLang)); } finally { setBusy(false); }
  };
  const helpful = async (r: ProductReview) => {
    if (!signedIn) { window.location.hash = 'community/login'; return; }
    try { setData(await cx<ReviewSummary>(`/community/review/${r.id}/helpful`, { body: { on: !r.voted } })); } catch { /* ignore */ }
  };
  const remove = async (r: ProductReview) => {
    try { await cx(`/community/review/${r.id}`, { method: 'DELETE' }); await load(); } catch { /* ignore */ }
  };
  const date = (iso: string) => new Date(iso).toLocaleDateString(currentLang, { year: 'numeric', month: 'short', day: 'numeric' });

  if (state === 'loading') return null;

  return (
    <section dir={dir} className="rounded-3xl border border-stone-200 bg-white p-4 shadow-sm sm:p-6" aria-label={t('rv_title')}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-black text-stone-900"><MessageSquarePlus className="h-5 w-5 text-amber-600" />{t('rv_title')}</h2>
        {state === 'ready' && !form && (
          <button type="button" onClick={openForm} className="rounded-xl bg-amber-700 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-amber-800 cursor-pointer">
            {!signedIn ? t('rv_signin') : mine ? t('rv_edit') : t('rv_write')}
          </button>
        )}
      </div>

      {state === 'unavailable' ? <p className="mt-3 text-sm text-stone-500">{t('rv_unavailable')}</p> : data && (
        <>
          {data.count > 0 && (
            <div className="mt-4 grid gap-4 sm:grid-cols-[180px_1fr]">
              <div className="flex flex-col items-center justify-center rounded-2xl bg-amber-50 p-4 text-center">
                <span className="text-4xl font-black text-stone-900">{storeNumber(data.average, currentLang)}</span>
                <Stars value={data.average} size={18} />
                <span className="mt-1 text-xs text-stone-500">{t('rv_count', { n: storeNumber(data.count, currentLang) })}</span>
              </div>
              <div className="space-y-1.5 self-center">
                {[5, 4, 3, 2, 1].map((n) => {
                  const c = data.spread[n - 1];
                  return (
                    <div key={n} className="flex items-center gap-2 text-xs text-stone-600">
                      <span className="w-6 text-end font-bold">{storeNumber(n, currentLang)}★</span>
                      <span className="h-2 flex-1 overflow-hidden rounded-full bg-stone-100"><span className="block h-full rounded-full bg-amber-400" style={{ width: `${data.count ? (c / data.count) * 100 : 0}%` }} /></span>
                      <span className="w-6 text-stone-400">{storeNumber(c, currentLang)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {form && (
            <div className="mt-4 space-y-3 rounded-2xl border border-amber-200 bg-amber-50/40 p-4">
              <div className="flex items-center gap-3">
                <span className="text-sm font-bold text-stone-800">{t('rv_rating')}</span>
                <span className="inline-flex gap-1" dir="ltr">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <button key={i} type="button" onClick={() => setForm({ ...form, rating: i })} aria-label={`${i}/5`} className="cursor-pointer">
                      <Star className={`h-7 w-7 ${i <= form.rating ? 'fill-amber-400 text-amber-400' : 'text-stone-300'}`} />
                    </button>
                  ))}
                </span>
              </div>
              <input value={form.title} maxLength={120} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder={t('rv_title_ph')}
                className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm outline-none focus:border-amber-500" />
              <textarea value={form.body} maxLength={3000} rows={4} onChange={(e) => setForm({ ...form, body: e.target.value })} placeholder={t('rv_body_ph')}
                className="w-full resize-none rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm outline-none focus:border-amber-500" />
              <div className="grid gap-3 sm:grid-cols-2">
                <Choice label={t('rv_longevity')} value={form.longevity} options={LONGEVITY.map((k) => [k, t(`rv_lon_${k}` as StoreTextKey)])} onChange={(v) => setForm({ ...form, longevity: v })} />
                <Choice label={t('rv_sillage')} value={form.sillage} options={SILLAGE.map((k) => [k, t(`rv_sil_${k}` as StoreTextKey)])} onChange={(v) => setForm({ ...form, sillage: v })} />
              </div>
              <div className="flex gap-2">
                <button type="button" disabled={busy || form.body.trim().length < 10} onClick={() => void submit()} className="flex-1 rounded-xl bg-amber-700 py-2.5 text-sm font-bold text-white hover:bg-amber-800 disabled:opacity-50 cursor-pointer">{t('rv_submit')}</button>
                <button type="button" onClick={() => setForm(null)} className="rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm font-semibold text-stone-600 cursor-pointer">{t('rv_cancel')}</button>
              </div>
            </div>
          )}
          {note && <p className="mt-3 rounded-xl bg-stone-50 p-2 text-center text-xs font-semibold text-stone-700">{note}</p>}

          {!data.count && !form && <p className="mt-4 rounded-2xl border border-dashed border-amber-300 bg-amber-50/50 p-5 text-center text-sm text-stone-600">⭐ {t('rv_none')}</p>}

          <div className="mt-4 space-y-3">
            {data.reviews.map((r) => (
              <article key={r.id} className={`rounded-2xl border p-4 ${r.mine ? 'border-amber-300 bg-amber-50/30' : 'border-stone-100'}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-amber-400 to-amber-700 text-xs font-bold text-white">
                    {r.author.avatar ? <img src={r.author.avatar} alt="" className="h-full w-full object-cover" /> : r.author.name.trim()[0] || '?'}
                  </span>
                  <span className="text-sm font-bold text-stone-900">{r.mine ? t('rv_mine') : r.author.name}</span>
                  <Stars value={r.rating} size={14} />
                  {r.verified && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800"><CheckCircle2 className="h-3 w-3" />{t('rv_verified')}</span>}
                  <span className="ms-auto text-[11px] text-stone-400">{date(r.updatedAt || r.createdAt)}</span>
                </div>
                {r.title && <p className="mt-2 text-sm font-bold text-stone-900">{r.title}</p>}
                <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-stone-700">{r.body}</p>
                {(r.longevity || r.sillage) && (
                  <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                    {r.longevity && <span className="rounded-full bg-stone-100 px-2 py-0.5 text-stone-700">{t('rv_longevity')}: {t(`rv_lon_${r.longevity}` as StoreTextKey)}</span>}
                    {r.sillage && <span className="rounded-full bg-stone-100 px-2 py-0.5 text-stone-700">{t('rv_sillage')}: {t(`rv_sil_${r.sillage}` as StoreTextKey)}</span>}
                  </div>
                )}
                <div className="mt-2 flex items-center gap-3 text-xs">
                  {!r.mine && (
                    <button type="button" onClick={() => void helpful(r)} className={`inline-flex items-center gap-1 rounded-full px-2 py-1 font-semibold cursor-pointer ${r.voted ? 'bg-amber-100 text-amber-900' : 'text-stone-500 hover:bg-stone-100'}`}>
                      <ThumbsUp className="h-3.5 w-3.5" />{t('rv_helpful', { n: storeNumber(r.helpful, currentLang) })}
                    </button>
                  )}
                  {r.mine && <button type="button" onClick={() => void remove(r)} className="inline-flex items-center gap-1 text-stone-400 hover:text-rose-600 cursor-pointer"><Trash2 className="h-3.5 w-3.5" />{t('rv_delete')}</button>}
                </div>
              </article>
            ))}
          </div>
          <p className="mt-4 text-[11px] leading-relaxed text-stone-400">{t('rv_note')}</p>
        </>
      )}
    </section>
  );
}

function Choice({ label, value, options, onChange }: { label: string; value: string; options: [string, string][]; onChange: (v: string) => void }) {
  return (
    <div>
      <p className="mb-1 text-xs font-bold text-stone-700">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {options.map(([k, text]) => (
          <button key={k} type="button" onClick={() => onChange(value === k ? '' : k)}
            className={`rounded-full border px-2.5 py-1 text-xs font-semibold cursor-pointer ${value === k ? 'border-amber-500 bg-amber-100 text-amber-900' : 'border-stone-200 bg-white text-stone-600'}`}>{text}</button>
        ))}
      </div>
    </div>
  );
}
