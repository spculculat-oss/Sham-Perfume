import { useEffect, useState } from 'react';
import type { StoreProduct } from '../utils/storeCatalog';
import type { Cart } from '../utils/storeCart';
import { cx, type StoreProduct as MerchantItem } from './api';

/** «متاجر شام» items (mp_… skus) shaped like catalog products, so the basket and the checkout treat them the same. */
export function merchantItemAsProduct(p: MerchantItem): StoreProduct {
  return {
    id: p.id, sku: p.sku, name: { ar: p.name, en: p.name }, description: { ar: p.description, en: p.description },
    brand: p.store?.name || '', category: p.category, families: [], notes: { top: [], heart: [], base: [] },
    seasons: [], occasions: [], tags: p.store ? [`store:${p.store.slug}`] : [], price: p.priceEgp, imageUrl: p.images[0], images: p.images,
    slug: p.id, inStock: p.inStock, isFeatured: false, isNew: false, enrichedBy: 'rules',
  };
}

/** Prices always come from the server (never from the browser); refreshed whenever the basket's merchant skus change. */
export function useMerchantCartProducts(cart: Cart): StoreProduct[] {
  const skus = Object.keys(cart).filter((s) => s.startsWith('mp_')).sort().join(',');
  const [items, setItems] = useState<StoreProduct[]>([]);
  useEffect(() => {
    if (!skus) { setItems([]); return; }
    let live = true;
    cx<MerchantItem[]>(`/community/stores/items?skus=${encodeURIComponent(skus)}`, { token: '' })
      .then((list) => { if (live) setItems(list.map(merchantItemAsProduct)); })
      .catch(() => { /* the community is off: those items simply do not show */ });
    return () => { live = false; };
  }, [skus]);
  return items;
}
