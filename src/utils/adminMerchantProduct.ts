import { calculatePlatformRevenue, calculateRetailPrice } from '../config/margin';
import type { MerchantProductRecord } from './merchantDataStore';

export interface AdminMerchantProductDraft {
  nameAr: string;
  nameEn: string;
  category: string;
  unit: string;
  costPrice: number;
  stock: number;
  minOrderQty: number;
}

export type AdminMerchantProductValidationError =
  | 'product_names_required'
  | 'product_price_required'
  | 'product_inventory_invalid';

/** Require a bilingual catalogue entry and numerically valid pricing/inventory before saving. */
export function validateAdminMerchantProductDraft(
  draft: AdminMerchantProductDraft,
): AdminMerchantProductValidationError | undefined {
  if (!draft.nameAr.trim() || !draft.nameEn.trim()) return 'product_names_required';
  if (!Number.isFinite(draft.costPrice) || draft.costPrice <= 0) return 'product_price_required';
  if (!Number.isInteger(draft.stock) || draft.stock < 0
    || !Number.isInteger(draft.minOrderQty) || draft.minOrderQty < 1) return 'product_inventory_invalid';
  return undefined;
}

/** Build an admin-created merchant product; it remains inactive and pending approval. */
export function buildAdminMerchantProductRecord(
  merchantId: string,
  draft: AdminMerchantProductDraft,
  identifiers: { id: string; sku: string },
): MerchantProductRecord {
  const costPrice = Math.max(0, draft.costPrice);
  return {
    id: identifiers.id,
    merchantId,
    sku: identifiers.sku,
    nameAr: draft.nameAr.trim(),
    nameEn: draft.nameEn.trim(),
    category: draft.category,
    unit: draft.unit,
    costPrice,
    retailPrice: calculateRetailPrice(costPrice),
    platformMargin: calculatePlatformRevenue(costPrice),
    costCurrency: 'EGP',
    stock: Math.max(0, Math.floor(draft.stock)),
    minOrderQty: Math.max(1, Math.floor(draft.minOrderQty)),
    descriptionAr: '',
    descriptionEn: '',
    imageUrl: undefined,
    isActive: false,
    approvalStatus: 'pending',
    notes: '',
    createdAt: '',
    updatedAt: '',
  };
}
