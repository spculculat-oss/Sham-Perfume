import React, { useMemo } from 'react';
import { Check, Plus, Sparkles, X } from 'lucide-react';
import type { SupportedLanguage } from '../types/i18n';
import type { StoreProduct } from '../utils/storeCatalog';
import { complementsFor, type Complement } from '../utils/shaheenSeller';
import { loc } from '../لغات/localize';
import { sellerText, type SellerUiKey } from '../لغات/sellerL10n';
import { storeLocalized } from '../لغات/storeL10n';

interface Props {
  products: StoreProduct[];
  /** What the visitor bought or put in the cart: the complements are chosen for it. */
  basis: StoreProduct[];
  lang: SupportedLanguage;
  variant: 'cart' | 'after' | 'forYou';
  price: (egp: number) => string;
  onAdd: (p: StoreProduct) => void;
  onOpen: (p: StoreProduct) => void;
  /** SKUs added a moment ago (the button says «اتضاف ✓»). */
  added?: string;
  /** SKUs already in the cart: never offered again. */
  inCart?: string[];
  onDismiss?: () => void;
}

const TITLE: Record<Props['variant'], SellerUiKey> = { cart: 'cartTitle', after: 'afterTitle', forYou: 'forYouTitle' };

/**
 * «يكمّل طلبك» — شاهين التاجر: after an add to the cart or a placed order, at most three things that complete it
 * (the same scent in a travel size, a perfume for the other season, a musk to layer under it), each with its honest
 * reason. Optional by design: no countdown, no «فاضل قطعتين», no invented discount.
 */
export default function CompleteYourOrder({ products, basis, lang, variant, price, onAdd, onOpen, added, inCart = [], onDismiss }: Props) {
  // Keyed by the SKUs, not the arrays (the store page re-renders on every keystroke of its search box).
  const basisKey = basis.map((p) => p.sku).join(',');
  const skipKey = inCart.join(',');
  const extras: Complement[] = useMemo(() => {
    const skip = new Set(skipKey.split(','));
    return complementsFor(products, basis, 4).filter((c) => !skip.has(c.product.sku)).slice(0, variant === 'cart' ? 2 : 3);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products, basisKey, skipKey, variant]);
  if (!extras.length) return null;
  const st = (k: SellerUiKey) => sellerText(lang, k);
  const compact = variant === 'cart';
  return (
    <section data-testid={`seller-${variant}`} className={`rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white ${compact ? 'p-3 my-3' : 'p-4 sm:p-5'} space-y-3`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className={`font-extrabold text-stone-900 flex items-center gap-1.5 ${compact ? 'text-sm' : 'text-base'}`}>
            <Sparkles className="w-4 h-4 text-amber-600" />
            <span>{st(TITLE[variant])}</span>
          </h3>
          <p className="text-[11px] text-stone-500 mt-0.5">{st('optional')}</p>
        </div>
        {onDismiss && (
          <button type="button" onClick={onDismiss} className="p-1 rounded-lg hover:bg-amber-100 text-stone-500 cursor-pointer" aria-label={st('dismiss')} title={st('dismiss')}>
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
      <div className={compact ? 'space-y-2' : 'grid gap-3 sm:grid-cols-3'}>
        {extras.map((c) => (
          <div key={c.product.sku} className="rounded-xl border border-stone-200 bg-white p-3 flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-bold rounded-full bg-amber-100 text-amber-900 px-2 py-0.5">{st(c.kind)}</span>
              <span className="text-xs font-bold text-amber-900 font-mono-numbers">{price(c.product.price)}</span>
            </div>
            <button type="button" onClick={() => onOpen(c.product)} className="text-start text-sm font-bold text-stone-900 hover:text-amber-800 line-clamp-2 cursor-pointer">
              {storeLocalized(c.product.name, lang)}
            </button>
            <p className="text-[11px] leading-relaxed text-stone-600">{loc(lang, c.reason)}</p>
            <button
              type="button"
              onClick={() => onAdd(c.product)}
              data-testid="seller-add"
              className="mt-auto w-full py-1.5 rounded-lg bg-stone-900 hover:bg-amber-800 text-white text-xs font-bold inline-flex items-center justify-center gap-1 cursor-pointer transition-colors"
            >
              {added === c.product.sku ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
              <span>{added === c.product.sku ? st('added') : st('add')}</span>
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
