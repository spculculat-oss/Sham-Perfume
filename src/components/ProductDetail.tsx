import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, ExternalLink, MessageCircle, Package, ShoppingCart, Sparkles, Star } from 'lucide-react';
import { type StoreProduct } from '../utils/storeCatalog';
import {
  makeStoreT, storeFamilyLabel, storeGenderLabel, storeLocalized, storeNumber,
  storeOccasionLabel, storeSeasonLabel,
} from '../لغات/storeL10n';
import { isRTL } from '../لغات/localizedContent';
import type { SupportedLanguage } from '../types/i18n';
import { loadStoreCatalog, productPageUrl, storeImageSrc } from '../utils/liveStore';
import { addToCart, useCart } from '../utils/storeCart';
import { useStoreMoney } from '../utils/storeCheckout';

/** كل نص في صفحة العطر — من src/لغات/storeL10n.ts بلغة الزائر (والإنجليزية كأرضية، لا عربية لغير العربي). */
function detailLabels(lang: SupportedLanguage) {
  const t = makeStoreT(lang);
  return {
    heading: t('sf_store_name'), back: t('pd_back'), notFound: t('pd_not_found'), description: t('pd_description'),
    profile: t('pd_scent_profile'), family: t('pd_family'), gender: t('pd_gender'), seasons: t('pd_seasons'),
    occasions: t('pd_occasions'), top: t('pd_top'), heart: t('pd_heart'), base: t('pd_base'),
    brand: t('pd_brand'), category: t('pd_category'), sku: t('pd_sku'), addToCart: t('sf_add_to_cart'),
    inCart: t('pd_in_cart'), qty: t('pd_qty'), outOfStock: t('sf_out_of_stock'), currency: t('sf_currency'),
    related: t('pd_related'), askShaheen: t('pd_ask_shaheen'), reviewed: t('pd_reviewed'), loading: t('pd_loading'),
    size: t('pd_size'), ml: t('pd_ml'), concentration: t('pd_concentration'), longevity: t('pd_longevity'),
    page: t('pd_product_page'), photo: t('pd_photo'),
  };
}

interface Props { productId: number; currentLang: SupportedLanguage; onClose?: () => void; onAddToCart?: (product: StoreProduct) => void }

/** How close two products are (same family, gender, brand, price band) for «قد يعجبك أيضاً». */
const closeness = (a: StoreProduct, b: StoreProduct) =>
  b.families.filter((f) => a.families.includes(f)).length * 3 + (a.gender && a.gender === b.gender ? 2 : 0) +
  (a.brand && a.brand === b.brand ? 1 : 0) + (Math.abs(a.price - b.price) <= a.price * 0.3 ? 1 : 0);

export const ProductDetail: React.FC<Props> = ({ productId, currentLang, onClose, onAddToCart }) => {
  const L = useMemo(() => detailLabels(currentLang), [currentLang]);
  const money = useStoreMoney(currentLang, L.currency); // the visitor's currency (src/utils/pricing.ts)
  const dir = isRTL(currentLang) ? 'rtl' : 'ltr';
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let live = true;
    loadStoreCatalog().then((list) => { if (live) setProducts(list); }).catch(() => undefined).finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, []);
  const [qty, setQty] = useState(1);
  const [broken, setBroken] = useState(false);
  const [photo, setPhoto] = useState(0);
  const cart = useCart();
  const product = products.find((p) => String(p.id) === String(productId));
  useEffect(() => { setQty(1); setBroken(false); setPhoto(0); window.scrollTo?.({ top: 0 }); }, [productId]);
  const Back = isRTL(currentLang) ? ArrowRight : ArrowLeft;

  if (!product && loading) return <div className="min-h-[60vh] flex items-center justify-center text-stone-500" data-testid="product-loading">{L.loading}</div>;
  if (!product) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3">
        <Package className="w-12 h-12 text-stone-300" />
        <p className="text-lg text-stone-600">{L.notFound}</p>
        <button type="button" onClick={onClose} className="text-amber-700 hover:underline">{L.back}</button>
      </div>
    );
  }

  const current = product.images[photo] || product.imageUrl;
  const price = money.price;
  const related = products.filter((p) => p.sku !== product.sku).map((p) => ({ p, s: closeness(product, p) }))
    .filter((r) => r.s > 0).sort((a, b) => b.s - a.s).slice(0, 4).map((r) => r.p);
  const notes = ([['top', product.notes.top], ['heart', product.notes.heart], ['base', product.notes.base]] as const).filter(([, list]) => list.length);
  const askShaheen = () => {
    const prompt = makeStoreT(currentLang)('pd_ask_prompt', {
      name: storeLocalized(product.name, currentLang),
      brand: product.brand ? ` (${product.brand})` : '',
      price: storeNumber(product.price, currentLang),
    });
    window.dispatchEvent(new CustomEvent('open-ai-chat-with-prompt', { detail: prompt }));
  };
  const add = () => { addToCart(product.sku, qty); onAddToCart?.(product); };
  const tag = (text: string) => <span key={text} className="px-2 py-0.5 rounded-full bg-amber-50 border border-amber-100 text-amber-900 text-xs">{text}</span>;

  return (
    <div className="min-h-screen bg-stone-50" dir={dir}>
      <header className="bg-white border-b">
        <div className="max-w-6xl mx-auto px-4 py-3">
          <button type="button" onClick={onClose} className="inline-flex items-center gap-2 text-stone-600 hover:text-stone-900 text-sm cursor-pointer"><Back className="w-4 h-4" />{L.back}</button>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-2">
          <div className="bg-white rounded-2xl overflow-hidden border">
            {current && !broken
              ? <img src={storeImageSrc(current).replace(/w=300&h=300/, 'w=700&h=700')} alt={product.name.ar} onError={() => setBroken(true)} data-testid="product-photo"
                  className={`w-full aspect-square ${/unsplash\.com/.test(current) ? 'object-cover' : 'object-contain bg-white'}`} />
              : <div className="w-full aspect-square bg-gradient-to-br from-amber-100 to-stone-100 flex items-center justify-center"><Package className="w-20 h-20 text-amber-400/40" /></div>}
          </div>
          {product.images.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1" data-testid="product-gallery">
              {product.images.map((src, i) => (
                <button type="button" key={src} onClick={() => { setPhoto(i); setBroken(false); }} aria-label={`${L.photo} ${i + 1}`}
                  className={`shrink-0 w-16 h-16 rounded-xl overflow-hidden border-2 bg-white cursor-pointer ${i === photo ? 'border-amber-600' : 'border-transparent'}`}>
                  <img src={storeImageSrc(src)} alt="" loading="lazy" className="w-full h-full object-contain" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="bg-white rounded-2xl border p-5 space-y-3">
            <div className="flex items-center gap-2 text-xs text-stone-500">
              {product.brand && <span className="font-semibold text-stone-700">{product.brand}</span>}
              {product.rating ? <span className="inline-flex items-center gap-0.5 text-amber-600"><Star className="w-3.5 h-3.5 fill-current" />{product.rating}{product.reviewCount ? <span className="text-stone-400"> ({product.reviewCount})</span> : null}</span> : null}
            </div>
            <h1 className="text-2xl font-bold text-stone-900">{storeLocalized(product.name, currentLang)}</h1>
            <p className="text-3xl font-bold text-amber-900">{price(product.price)}</p>
            {product.inStock ? (
              <div className="flex items-center gap-2">
                <div className="flex items-center border rounded-lg" aria-label={L.qty}>
                  <button type="button" onClick={() => setQty(Math.max(1, qty - 1))} className="px-3 py-2 cursor-pointer">−</button>
                  <span className="w-8 text-center">{qty}</span>
                  <button type="button" onClick={() => setQty(Math.min(99, qty + 1))} className="px-3 py-2 cursor-pointer">+</button>
                </div>
                <button type="button" onClick={add} className="flex-1 py-2.5 rounded-xl bg-amber-700 hover:bg-amber-800 text-white font-semibold inline-flex items-center justify-center gap-2 cursor-pointer">
                  <ShoppingCart className="w-4 h-4" />{cart[product.sku] ? L.inCart.replace('{n}', String(cart[product.sku])) : L.addToCart}
                </button>
              </div>
            ) : <p className="py-2.5 rounded-xl bg-stone-100 text-stone-500 text-center">{L.outOfStock}</p>}
            <button type="button" onClick={askShaheen} data-testid="product-ask-shaheen"
              className="w-full py-2.5 rounded-xl border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 text-sm font-semibold inline-flex items-center justify-center gap-2 cursor-pointer">
              <MessageCircle className="w-4 h-4" />{L.askShaheen}
            </button>
          </div>

          <div className="bg-white rounded-2xl border p-5 space-y-2">
            <h2 className="font-semibold">{L.description}</h2>
            <p className="text-stone-700 leading-relaxed text-sm whitespace-pre-line">{storeLocalized(product.description, currentLang)}</p>
            {product.enrichedBy === 'shaheen' && <p className="text-[11px] text-amber-700 inline-flex items-center gap-1"><Sparkles className="w-3 h-3" />{L.reviewed}</p>}
          </div>

          {(product.families.length > 0 || notes.length > 0 || product.gender || product.seasons.length > 0) && (
            <div className="bg-white rounded-2xl border p-5 space-y-3 text-sm">
              <h2 className="font-semibold">{L.profile}</h2>
              {product.families.length > 0 && <div className="flex flex-wrap items-center gap-1.5"><span className="text-stone-500 me-1">{L.family}:</span>{product.families.map((f) => tag(storeFamilyLabel(f, currentLang)))}</div>}
              {product.gender && <div className="flex flex-wrap items-center gap-1.5"><span className="text-stone-500 me-1">{L.gender}:</span>{tag(storeGenderLabel(product.gender, currentLang))}</div>}
              {product.seasons.length > 0 && <div className="flex flex-wrap items-center gap-1.5"><span className="text-stone-500 me-1">{L.seasons}:</span>{product.seasons.map((s) => tag(storeSeasonLabel(s, currentLang)))}</div>}
              {product.occasions.length > 0 && <div className="flex flex-wrap items-center gap-1.5"><span className="text-stone-500 me-1">{L.occasions}:</span>{product.occasions.map((o) => tag(storeOccasionLabel(o, currentLang)))}</div>}
              {notes.map(([level, list]) => <div key={level} className="flex flex-wrap items-center gap-1.5"><span className="text-stone-500 me-1">{L[level]}:</span>{list.map(tag)}</div>)}
            </div>
          )}

          <div className="bg-white rounded-2xl border p-5 grid grid-cols-2 gap-2 text-sm">
            {product.brand && <><span className="text-stone-500">{L.brand}</span><span className="font-medium">{product.brand}</span></>}
            {product.category && <><span className="text-stone-500">{L.category}</span><span className="font-medium">{product.category}</span></>}
            {product.sizeMl && <><span className="text-stone-500">{L.size}</span><span className="font-medium">{product.sizeMl} {L.ml}</span></>}
            {product.concentration && <><span className="text-stone-500">{L.concentration}</span><span className="font-medium">{product.concentration}</span></>}
            {product.longevity && <><span className="text-stone-500">{L.longevity}</span><span className="font-medium">{product.longevity}</span></>}
            <span className="text-stone-500">{L.sku}</span><span className="font-medium font-mono text-xs">{product.sku}</span>
            <a href={productPageUrl(product.slug)} target="_blank" rel="noopener" data-testid="product-page-link"
              className="col-span-2 mt-1 inline-flex items-center gap-1.5 text-amber-700 hover:underline text-xs"><ExternalLink className="w-3.5 h-3.5" />{L.page}</a>
          </div>
        </div>
      </div>

      {related.length > 0 && (
        <div className="max-w-6xl mx-auto px-4 pb-10">
          <h2 className="text-xl font-bold mb-3">{L.related}</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {related.map((p) => (
              <button type="button" key={p.sku} onClick={() => { window.location.hash = `#product=${p.id}`; }} className="bg-white rounded-2xl border overflow-hidden text-start hover:shadow-md transition cursor-pointer">
                {p.imageUrl ? <img src={storeImageSrc(p.imageUrl)} alt={p.name.ar} loading="lazy" className={`w-full aspect-square ${/unsplash\.com/.test(p.imageUrl) ? 'object-cover' : 'object-contain bg-white'}`} /> : <div className="w-full aspect-square bg-amber-50" />}
                <div className="p-3">
                  <p className="text-sm font-semibold line-clamp-2">{storeLocalized(p.name, currentLang)}</p>
                  <p className="text-sm font-bold text-amber-900 mt-1">{price(p.price)}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
