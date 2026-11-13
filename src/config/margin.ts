/**
 * ثابت هامش ربح المنصة
 * 25% من سعر التاجر الجملة — يتم إضافته تلقائياً على سعر العرض للزبون
 * الزبون ما يعلمش إن سعر الجملة كان أقل — النظام بيظهر retailPrice فقط
 */
export const PLATFORM_MARGIN_PERCENT = 25;

/**
 * حساب السعر المعروض للزبون (retailPrice)
 * retailPrice = costPrice × (1 + PLATFORM_MARGIN_PERCENT / 100)
 */
export function calculateRetailPrice(costPrice: number): number {
  return Number((costPrice * (1 + PLATFORM_MARGIN_PERCENT / 100)).toFixed(2));
}

/**
 * حساب ربح المنصة من عملية بيع
 * platformRevenue = retailPrice - costPrice  (= costPrice × 0.25)
 */
export function calculatePlatformRevenue(costPrice: number): number {
  return Number((costPrice * (PLATFORM_MARGIN_PERCENT / 100)).toFixed(2));
}

/**
 * حساب سعر التاجر بعد الخصم — يساوي costPrice (م 전액 للنظام)
 */
export function calculateMerchantPayout(costPrice: number): number {
  return costPrice;
}
