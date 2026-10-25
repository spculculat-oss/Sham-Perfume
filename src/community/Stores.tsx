/**
 * «متاجر شام»: approved merchants' stores and their published products, priced in the visitor's currency
 * (merchant price + the site's margin, computed on the server). Items go into the same basket as «متجر شام»,
 * so buyers pay once, through the site, and never see a supplier link or a merchant contact.
 */
import { useState } from 'react';
import { Check, ShoppingBag, Store } from 'lucide-react';
import { addToCart, useCart } from '../utils/storeCart';
import { useStoreMoney } from '../utils/storeCheckout';
import { cx, type StorePage as StorePageData, type StoreSummary } from './api';
import { Btn, Card, Empty, Sheet, Spinner, errorText, tx, useLoad, type Lang } from './ui';

interface Props { lang: Lang; go: (r: string) => void }

export function StoreDirectory({ lang, go }: Props) {
  const t = tx(lang);
  const { data, loading, error } = useLoad(() => cx<StoreSummary[]>('/community/stores', { token: '' }));
  return (
    <div className="space-y-4">
      <Card className="flex flex-wrap items-center gap-4 bg-gradient-to-br from-amber-50 to-white p-5">
        <Store className="h-10 w-10 text-amber-600" />
        <div className="flex-1"><h2 className="text-xl font-black">{t('متاجر شام', 'Sham stores')}</h2><p className="text-sm text-stone-600">{t('تجار معتمدين من الإدارة — الدفع والشحن عن طريق الموقع بأمان.', 'Merchants approved by the administration — pay and ship safely through the site.')}</p></div>
        <Btn variant="soft" onClick={() => go('merchant')}>{t('افتح متجرك', 'Open your store')}</Btn>
      </Card>
      {loading ? <Spinner /> : error ? <Card><Empty title={errorText(error, lang)} /></Card> : !data?.length ? <Card><Empty icon={<Store className="h-10 w-10" />} title={t('أول المتاجر في الطريق', 'The first stores are on their way')} body={t('كن أول تاجر في شام!', 'Be the first merchant on Sham!')} /></Card> : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{data.map((s) => (
          <button key={s.slug} type="button" onClick={() => go(`store/${s.slug}`)} className="rounded-2xl border border-stone-200 bg-white p-4 text-start shadow-sm transition hover:-translate-y-0.5 hover:border-amber-300 cursor-pointer">
            <div className="flex items-center gap-3">{s.logo ? <img loading="lazy" decoding="async" src={s.logo} alt="" className="h-14 w-14 rounded-xl object-cover" /> : <span className="flex h-14 w-14 items-center justify-center rounded-xl bg-amber-100 text-2xl">🏪</span>}
              <span className="min-w-0"><span className="block truncate font-bold">{s.name}</span><span className="text-xs text-stone-500">{s.products} {t('منتج', 'products')} · {s.country}</span></span></div>
            {s.about && <p className="mt-2 line-clamp-2 text-xs text-stone-600">{s.about}</p>}
          </button>
        ))}</div>
      )}
    </div>
  );
}

export function StorePage({ lang, go, slug }: Props & { slug: string }) {
  const t = tx(lang);
  const { data, loading, error } = useLoad(() => cx<StorePageData>(`/community/stores/${encodeURIComponent(slug)}`, { token: '' }), [slug]);
  const money = useStoreMoney(lang, t('ج.م', 'EGP'));
  const cart = useCart();
  const [added, setAdded] = useState('');
  const [open, setOpen] = useState<StorePageData['products'][number] | null>(null);
  const count = Object.entries(cart).filter(([s]) => s.startsWith('mp_')).reduce((n, [, q]) => n + q, 0);
  if (loading) return <Spinner />;
  if (error || !data) return <Card><Empty title={errorText(error, lang)} action={<Btn small variant="soft" onClick={() => go('stores')}>{t('كل المتاجر', 'All stores')}</Btn>} /></Card>;
  const add = (sku: string) => { addToCart(sku); setAdded(sku); setTimeout(() => setAdded((s) => (s === sku ? '' : s)), 1500); };
  return (
    <div className="space-y-4">
      <Card className="overflow-hidden">
        <div className="h-28 bg-gradient-to-br from-stone-900 via-amber-900 to-amber-600" />
        <div className="flex flex-wrap items-end gap-4 px-5 pb-5">
          {data.store.logo ? <img loading="lazy" decoding="async" src={data.store.logo} alt="" className="-mt-10 h-24 w-24 rounded-2xl border-4 border-white bg-white object-cover" /> : <span className="-mt-10 flex h-24 w-24 items-center justify-center rounded-2xl border-4 border-white bg-amber-100 text-4xl">🏪</span>}
          <div className="min-w-0 flex-1"><h2 className="text-2xl font-black">{data.store.name}</h2><p className="text-xs text-stone-500">✅ {t('متجر معتمد من شام', 'Approved by Sham')} · {data.products.length} {t('منتج', 'products')}</p></div>
          {count > 0 && <Btn onClick={() => { window.location.hash = 'store'; }}><ShoppingBag className="h-4 w-4" />{t('السلة', 'Basket')} ({count})</Btn>}
        </div>
        {data.store.about && <p className="whitespace-pre-wrap px-5 pb-5 text-sm leading-relaxed text-stone-700">{data.store.about}</p>}
      </Card>
      {!data.products.length ? <Card><Empty title={t('لا توجد منتجات منشورة بعد', 'No published products yet')} /></Card> : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">{data.products.map((p) => (
          <Card key={p.sku} className="flex flex-col overflow-hidden">
            <button type="button" onClick={() => setOpen(p)} className="aspect-square bg-stone-100 cursor-pointer">{p.images[0] ? <img src={p.images[0]} alt="" loading="lazy" className="h-full w-full object-cover" /> : <span className="flex h-full items-center justify-center text-4xl">🧴</span>}</button>
            <div className="flex flex-1 flex-col gap-1.5 p-3">
              <button type="button" onClick={() => setOpen(p)} className="line-clamp-2 text-start text-sm font-bold text-stone-900 hover:text-amber-800 cursor-pointer">{p.name}</button>
              <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-1">
                <span className="whitespace-nowrap text-sm font-bold text-amber-900">{money.price(p.priceEgp)}</span>
                <button type="button" disabled={!p.inStock} onClick={() => add(p.sku)} className="whitespace-nowrap rounded-lg bg-amber-700 px-2.5 py-1.5 text-[11px] text-white hover:bg-amber-800 disabled:bg-stone-300 cursor-pointer">
                  {!p.inStock ? t('نفد', 'Sold out') : added === p.sku ? <Check className="h-4 w-4" /> : t('أضف للسلة', 'Add')}</button>
              </div>
            </div>
          </Card>
        ))}</div>
      )}
      <p className="text-center text-[11px] text-stone-500">{t('الأسعار شاملة عمولة الموقع، والشحن بيتحسب في السلة حسب بلدك. الدفع والتواصل عن طريق شام فقط.', 'Prices include the site commission; shipping is calculated in the basket for your country. Payment and contact go through Sham only.')}</p>
      {open && (
        <Sheet title={open.name} onClose={() => setOpen(null)} wide>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid grid-cols-3 gap-2">{(open.images.length ? open.images : ['']).map((src, i) => src ? <img loading="lazy" decoding="async" key={i} src={src} alt="" className={`${i === 0 ? 'col-span-3 aspect-square' : 'aspect-square'} w-full rounded-xl object-cover`} /> : <span key={i} className="col-span-3 flex aspect-square items-center justify-center rounded-xl bg-stone-100 text-5xl">🧴</span>)}</div>
            <div className="space-y-3">
              <p className="text-2xl font-black text-amber-900">{money.price(open.priceEgp)}</p>
              {open.description && <p className="whitespace-pre-wrap text-sm leading-relaxed text-stone-700">{open.description}</p>}
              <p className="text-xs text-stone-500">🏪 {data.store.name}</p>
              <Btn className="w-full" disabled={!open.inStock} onClick={() => add(open.sku)}>{added === open.sku ? <><Check className="h-4 w-4" />{t('اتضاف للسلة', 'Added')}</> : <><ShoppingBag className="h-4 w-4" />{t('أضف للسلة', 'Add to basket')}</>}</Btn>
            </div>
          </div>
        </Sheet>
      )}
    </div>
  );
}
