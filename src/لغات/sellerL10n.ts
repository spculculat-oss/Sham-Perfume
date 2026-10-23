/**
 * «شاهين التاجر المحنك» on the store page — «يكمّل طلبك» after an add to the cart or a placed order. Arabic and
 * English are written here by hand; the other site languages are filled by «المترجم الذكي» (scripts/shaheen-languages),
 * which reads each `{ ar, en }` line of this file — so keep every text on ONE line. Missing languages fall back to English.
 */
import type { SupportedLanguage } from '../types/i18n';
import { loc } from './localize';

export const SELLER_UI = {
  cartTitle: { ar: 'يكمّل طلبك', en: 'Completes your order' },
  afterTitle: { ar: 'طلبك اتسجل 👌 وده اللي يكمّله', en: 'Your order is in 👌 here is what completes it' },
  forYouTitle: { ar: 'مختار ليك على ذوق آخر طلب', en: 'Picked for you from your last order' },
  optional: { ar: 'اختياري خالص — ضيف اللي يعجبك بضغطة، ولو مش محتاج حاجة فطلبك كامل كده.', en: 'Entirely optional — add what you like in one tap; if you need nothing more, your order is complete.' },
  add: { ar: 'ضيف للسلة', en: 'Add to cart' },
  added: { ar: 'اتضاف ✓', en: 'Added ✓' },
  open: { ar: 'التفاصيل', en: 'Details' },
  travel: { ar: 'حجم السفر', en: 'Travel size' },
  season: { ar: 'للموسم التاني', en: 'Other season' },
  layer: { ar: 'طبقة تثبيت', en: 'Layering' },
  dismiss: { ar: 'إخفاء', en: 'Hide' },
} as const;

export type SellerUiKey = keyof typeof SELLER_UI;
export const sellerText = (lang: SupportedLanguage, key: SellerUiKey): string => loc(lang, SELLER_UI[key]);
