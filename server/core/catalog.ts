/**
 * «كتالوج المنظومة» — مصدر واحد للمنتجات يقرأ منه المساعد والاستمارات والطلبات.
 *
 * المشكلة اللي الملف ده بيحلها: المنظومة كان عندها كتالوجين. كتالوج الإدارة اللي في التخزين
 * (`repo.products`) واللي بيتبني من شاشة «المنتجات»، وكتالوج المتجر الحقيقي اللي الزائر بيشتري منه
 * (`src/data/products.json` + إثراء شاهين). على متجر شغّال بقاله شهور كتالوج الإدارة ساعات بيكون فاضي،
 * فالمساعد كان بيقول «مفيش منتجات منشورة» والمتجر فيه ١١٦١ منتج، والاستمارة كانت بتطلع من غير منتجات.
 *
 * الحل: `catalogView` بترجّع **رؤية واحدة**: منتجات الإدارة لو موجودة (هي اللي التاجر بيديرها ويحجز
 * مخزونها)، وإلا كتالوج المتجر الحقيقي بنفس شكل `Product` — بالاسم والسعر والمقاس والتوفر، ومن غير
 * سعر المورّد أو الهامش أبداً. كل أداة أو استمارة أو طلب بيقرأ من هنا، فمفيش طريق تاني يقول للمساعد
 * إن المتجر فاضي وهو مليان.
 *
 * فرق مهم بيتحفظ: منتجات المتجر **مش** بتتحجز ولا بيتخصم مخزونها من المحادثة (المتجر هو اللي بيدير
 * مخزونه وصفحة الدفع هي مكان الشراء)، والطلب الجاي من المحادثة بيتسجل كطلب عرض سعر بالأسعار الحقيقية
 * والفريق بيأكده. منتجات الإدارة بتفضل بتحجز مخزونها زي الأول.
 */
import { storefrontCatalog, type StoreItem } from './storeGuide';
import type { Product } from './types';

/** The merchant's own catalog is the source when it has rows; otherwise the real storefront answers. */
export type CatalogSource = 'admin' | 'storefront';

export interface CatalogView {
  products: Product[];
  source: CatalogSource;
  /** True when there is nothing to sell at all (an admin catalog with no rows *and* an empty storefront). */
  empty: boolean;
  /** Storefront facts (counts, brands, price range) when the storefront was read. */
  snapshot?: Awaited<ReturnType<typeof storefrontCatalog>>['snapshot'];
}

const clean = (value: string, max = 300) => value.replace(/\s+/g, ' ').trim().slice(0, max);

/**
 * A storefront product in the system's shape. `stock` is only ever 1 or 0 here: the storefront publishes
 * availability, not a count — the store page owns the real inventory and the checkout.
 */
export function storeItemToProduct(item: StoreItem): Product {
  const available = item.inStock;
  return {
    id: item.id,
    sku: item.sku || `SHOP-${item.id}`,
    nameAr: clean(item.nameAr, 160),
    nameEn: clean(item.nameEn || item.nameAr, 160),
    category: 'perfume',
    price: item.price,
    currency: item.currency,
    stock: available ? 1 : 0,
    unit: item.sizeMl ? `${item.sizeMl}ml` : 'piece',
    descriptionAr: clean([item.brand, item.families.join('، '), 'من كتالوج المتجر'].filter(Boolean).join(' — '), 400),
    descriptionEn: clean([item.brand, item.families.join(', '), 'from the store catalog'].filter(Boolean).join(' — '), 400),
    tags: [item.brand, ...item.families].filter(Boolean).map((t) => clean(String(t), 40)).slice(0, 12),
    active: true,
    updatedAt: new Date().toISOString(),
  };
}

/** The whole storefront as system products (reads the live catalog; cached upstream). */
export async function storefrontProducts(env: Record<string, string | undefined> = process.env): Promise<CatalogView> {
  try {
    const { items, snapshot } = await storefrontCatalog(env);
    return { products: items.map(storeItemToProduct), source: 'storefront', empty: items.length === 0, snapshot };
  } catch {
    // Never throw into a chat turn: an unreadable storefront is an empty view, and the caller says so honestly.
    return { products: [], source: 'storefront', empty: true };
  }
}

/**
 * One catalog for everyone: the merchant's own rows when they exist, the real storefront otherwise.
 * `forceStorefront` is for browsing the shop: what a visitor can buy is the storefront even when the
 * merchant also keeps internal order lines.
 */
export async function catalogView(
  repo: { products: (includeInactive?: boolean) => Promise<Product[]> },
  opts: { env?: Record<string, string | undefined>; forceStorefront?: boolean } = {},
): Promise<CatalogView> {
  const admin = opts.forceStorefront ? [] : await repo.products().catch(() => []);
  if (admin.length) return { products: admin, source: 'admin', empty: false };
  return storefrontProducts(opts.env || process.env);
}

/** The same storefront item that a form or a request is pointing at (for ids that are not in the admin catalog). */
export async function findStoreProduct(id: string, env: Record<string, string | undefined> = process.env): Promise<{ product: Product; item: StoreItem } | undefined> {
  const { items } = await storefrontCatalog(env).catch(() => ({ items: [] as StoreItem[] }));
  const item = items.find((i) => i.id === String(id)) || items.find((i) => i.sku === String(id));
  return item ? { product: storeItemToProduct(item), item } : undefined;
}
