/** Research directory, NOT a list of enabled payment buttons. See FINANCE.md for scope and citations.
 * Customer location is deliberately separate from the merchant's onboarding jurisdiction.
 * Country coverage is a conservative subset; unknown is never treated as supported.
 */
import countryCurrency from '../data/country-currency.json';
export const PAYMENT_RESEARCHED_AT = '2026-10-18';
export const PAYMENT_SOURCES = {
  kashier: { title: 'Kashier — payment sessions', url: 'https://developers.kashier.io/docs/accept-payments/payment-sessions' },
  kashierLive: { title: 'Kashier — going live', url: 'https://developers.kashier.io/docs/get-started/going-live' },
  stripe: { title: 'Stripe — country, currency and business location matrix', url: 'https://docs.stripe.com/payments/payment-methods/payment-method-support' },
  tap: { title: 'Tap — local payment sources', url: 'https://developers.tap.company/reference/charges' },
  paystack: { title: 'Paystack — payment channels', url: 'https://paystack.com/docs/payments/payment-channels/' },
  mercado: { title: 'Mercado Pago — country payment methods', url: 'https://www.mercadopago.com.co/developers/en/docs/sales-processing/payment-methods' },
  xendit: { title: 'Xendit — local payment methods', url: 'https://www.xendit.co/en/products/all-payment-methods/' },
  swish: { title: 'Adyen — Swish', url: 'https://docs.adyen.com/payment-methods/swish' },
  mobilepay: { title: 'Adyen — MobilePay', url: 'https://docs.adyen.com/payment-methods/mobilepay' },
} as const;
export type PaymentSource = keyof typeof PAYMENT_SOURCES;
export interface PaymentCandidate {
  id: string; name: string; provider: string; category: 'card' | 'wallet' | 'bank' | 'cash' | 'bnpl';
  /** null means account-dependent research candidate, NOT worldwide availability. */
  customerCountries: string[] | null; merchantCountries: string[] | null; currencies: string[];
  source: PaymentSource; integration: 'hosted' | 'not_implemented'; notes: string;
}
const EU = 'AT BE BG HR CY CZ DK EE FI FR DE GR HU IE IT LV LT LU MT NL PL PT RO SK SI ES SE'.split(' ');
const stripeCrossBorder = [...EU, 'AU', 'CA', 'HK', 'JP', 'MX', 'NZ', 'SG', 'US'];
const candidate = (id: string, name: string, provider: string, category: PaymentCandidate['category'], countries: string | null, currencies: string,
  source: PaymentSource, merchantCountries: string[] | null = null, notes = 'يلزم حساب تاجر مؤهل، موافقة الوسيلة، وربط واختبار مستقل قبل التفعيل.'): PaymentCandidate => ({
  id, name, provider, category, customerCountries: countries === null ? null : countries.split(' '), merchantCountries,
  currencies: currencies ? currencies.split(' ') : [], source, integration: 'not_implemented', notes,
});
export const PAYMENT_CATALOG: PaymentCandidate[] = [
  { ...candidate('card', 'بطاقات بنكية / Cards', 'kashier', 'card', null, 'EGP USD EUR GBP', 'kashier', ['EG'], 'بلد المشتري والدفع الدولي حسب عقد التاجر؛ لا نفترض قبول كل الدول أو كل شبكات البطاقات.'), integration: 'hosted' },
  { ...candidate('wallet', 'محافظ مصر / Egyptian wallets', 'kashier', 'wallet', 'EG', 'EGP', 'kashier', ['EG'], 'إدخال رقم المحفظة والتحقق داخل صفحة البوابة؛ يجب تفعيل المحافظ في الحساب الحي.'), integration: 'hosted' },
  candidate('kashier_installments', 'تقسيط البنوك / Bank installments', 'kashier', 'bnpl', 'EG', 'EGP', 'kashierLive', ['EG'], 'مرشح للربط بعد اعتماد البنك والعقد؛ وضع الاختبار لا يثبت توافر التقسيط الحي.'),
  candidate('mada', 'مدى / mada', 'tap', 'card', 'SA', 'SAR', 'tap'),
  candidate('knet', 'KNET', 'tap', 'bank', 'KW', 'KWD', 'tap'),
  candidate('benefit', 'Benefit', 'tap', 'bank', 'BH', 'BHD', 'tap'),
  candidate('omannet', 'OmanNet', 'tap', 'card', 'OM', 'OMR', 'tap'),
  candidate('stcpay', 'STC Pay', 'tap', 'wallet', 'SA', 'SAR', 'tap'),
  candidate('apple_pay', 'Apple Pay', 'stripe', 'wallet', null, '', 'stripe', null, 'الدولة والجهاز والبنك وتسجيل النطاق تخضع لقوائم Apple ومزود التحصيل؛ ليست متاحة تلقائياً.'),
  candidate('google_pay', 'Google Pay', 'stripe', 'wallet', null, '', 'stripe', null, 'يلزم دعم الدولة والجهاز والبنك وموافقة البوابة؛ راجع قائمة Google الحالية.'),
  candidate('paypal', 'PayPal عبر Stripe', 'stripe', 'wallet', null, 'AUD CAD CHF CZK DKK EUR GBP HKD NOK NZD PLN SEK SGD USD', 'stripe', [...EU.filter((c) => c !== 'HU'), 'LI', 'NO', 'CH', 'GB'], 'هذه أهلية PayPal عبر Stripe فقط، وليست أهلية فتح حساب PayPal مباشر أو السحب في كل دولة.'),
  candidate('ach', 'ACH Direct Debit', 'stripe', 'bank', 'US', 'USD', 'stripe', [...EU, 'GI', 'LI', 'NO', 'CH', 'GB', 'US']),
  candidate('cashapp', 'Cash App Pay', 'stripe', 'wallet', 'US', 'USD', 'stripe', ['US']),
  candidate('affirm', 'Affirm', 'stripe', 'bnpl', 'US CA', 'USD CAD', 'stripe', ['US', 'CA']),
  candidate('afterpay', 'Afterpay / Clearpay', 'stripe', 'bnpl', 'AU CA NZ GB US', 'AUD CAD NZD GBP USD', 'stripe', ['AU', 'CA', 'NZ', 'GB', 'US']),
  candidate('bacs', 'Bacs Direct Debit', 'stripe', 'bank', 'GB', 'GBP', 'stripe', ['GB']),
  candidate('bancontact', 'Bancontact', 'stripe', 'bank', 'BE', 'EUR', 'stripe', [...EU, 'AU', 'HK', 'JP', 'MX', 'NZ', 'SG', 'US']),
  candidate('ideal', 'iDEAL / Wero', 'stripe', 'bank', 'NL', 'EUR', 'stripe', stripeCrossBorder),
  candidate('eps', 'EPS', 'stripe', 'bank', 'AT', 'EUR', 'stripe', stripeCrossBorder),
  candidate('blik', 'BLIK', 'stripe', 'bank', 'PL', 'PLN', 'stripe', [...EU, 'IS', 'LI', 'NO']),
  candidate('p24', 'Przelewy24', 'stripe', 'bank', 'PL', 'PLN EUR', 'stripe', stripeCrossBorder),
  candidate('sepa', 'SEPA Direct Debit', 'stripe', 'bank', [...EU, 'IS', 'LI', 'NO', 'CH', 'GB'].join(' '), 'EUR', 'stripe', stripeCrossBorder, 'مجموعة بحث محافظة من دول SEPA؛ يلزم تفويض خصم وأهلية حساب باليورو ومراجعة الدول المضافة حديثاً.'),
  candidate('mbway', 'MB WAY', 'stripe', 'wallet', 'PT', 'EUR', 'stripe'),
  candidate('multibanco', 'Multibanco', 'stripe', 'bank', 'PT', 'EUR', 'stripe'),
  candidate('twint', 'TWINT', 'stripe', 'wallet', 'CH', 'CHF', 'stripe'),
  candidate('swish', 'Swish', 'adyen', 'wallet', 'SE', 'SEK', 'swish', ['SE'], 'يتطلب اتفاقاً ورقم Swish وربط شهادة المزود؛ لا تكفي بيانات البطاقة.'),
  candidate('mobilepay', 'MobilePay', 'adyen', 'wallet', 'DK FI', 'DKK EUR', 'mobilepay'),
  candidate('becs', 'BECS Direct Debit', 'stripe', 'bank', 'AU', 'AUD', 'stripe', ['AU']),
  candidate('canada_pad', 'Canadian PAD', 'stripe', 'bank', 'CA', 'CAD USD', 'stripe', ['CA', 'US']),
  candidate('alipay', 'Alipay', 'stripe', 'wallet', 'CN', 'AUD CAD CNY EUR GBP HKD JPY MYR NZD SGD USD', 'stripe', [...EU, 'AU', 'CA', 'HK', 'JP', 'NZ', 'SG', 'US'], 'يمكن أن يستخدمه مسافرون صينيون خارج الصين؛ الترشيح هنا لا يحصر كل أماكن الاستخدام.'),
  candidate('wechat', 'WeChat Pay', 'stripe', 'wallet', 'CN', 'AUD CAD CNY EUR GBP HKD JPY SGD USD', 'stripe', [...EU, 'AU', 'CA', 'HK', 'JP', 'SG', 'GB', 'US']),
  candidate('upi', 'UPI', 'stripe', 'bank', 'IN', 'INR', 'stripe', [...EU, 'AU', 'CA', 'CH', 'GB', 'LI', 'NO', 'SG', 'US']),
  candidate('konbini', 'Konbini', 'stripe', 'cash', 'JP', 'JPY', 'stripe', ['JP']),
  candidate('paypay', 'PayPay', 'stripe', 'wallet', 'JP', 'JPY', 'stripe', ['JP']),
  candidate('fpx', 'FPX', 'stripe', 'bank', 'MY', 'MYR', 'stripe', ['MY']),
  candidate('grabpay', 'GrabPay', 'stripe', 'wallet', 'MY SG', 'MYR SGD', 'stripe', ['MY', 'SG']),
  candidate('paynow', 'PayNow', 'stripe', 'bank', 'SG', 'SGD', 'stripe', ['SG']),
  candidate('promptpay', 'PromptPay', 'stripe', 'bank', 'TH', 'THB', 'stripe', ['TH']),
  candidate('qris', 'QRIS', 'xendit', 'bank', 'ID', 'IDR', 'xendit', ['ID']),
  candidate('dana_ovo', 'DANA / OVO / ShopeePay', 'xendit', 'wallet', 'ID', 'IDR', 'xendit', ['ID']),
  candidate('gcash_maya', 'GCash / Maya', 'xendit', 'wallet', 'PH', 'PHP', 'xendit', ['PH']),
  candidate('momo_zalopay', 'MoMo / ZaloPay', 'xendit', 'wallet', 'VN', 'VND', 'xendit', ['VN']),
  candidate('mpesa', 'M-PESA', 'paystack', 'wallet', 'KE', 'KES', 'paystack', ['KE']),
  candidate('ghana_momo', 'MTN / ATMoney / Telecel', 'paystack', 'wallet', 'GH', 'GHS', 'paystack', ['GH']),
  candidate('civ_momo', 'MTN / Orange / Wave', 'paystack', 'wallet', 'CI', 'XOF', 'paystack', ['CI']),
  candidate('ng_bank', 'Bank / USSD / Transfer', 'paystack', 'bank', 'NG', 'NGN', 'paystack', ['NG']),
  candidate('pix', 'Pix', 'mercadopago', 'bank', 'BR', 'BRL', 'mercado', ['BR']),
  candidate('boleto', 'Boleto', 'mercadopago', 'cash', 'BR', 'BRL', 'mercado', ['BR']),
  candidate('oxxo', 'OXXO / PayCash', 'mercadopago', 'cash', 'MX', 'MXN', 'mercado', ['MX']),
  candidate('spei', 'SPEI / CLABE', 'mercadopago', 'bank', 'MX', 'MXN', 'mercado', ['MX']),
  candidate('pse', 'PSE', 'mercadopago', 'bank', 'CO', 'COP', 'mercado', ['CO']),
  candidate('efecty', 'Efecty', 'mercadopago', 'cash', 'CO', 'COP', 'mercado', ['CO']),
  candidate('yape', 'Yape', 'mercadopago', 'wallet', 'PE', 'PEN', 'mercado', ['PE']),
  candidate('rapipago', 'Rapipago / Pago Fácil', 'mercadopago', 'cash', 'AR', 'ARS', 'mercado', ['AR']),
  candidate('abitab', 'Abitab / Red Pagos', 'mercadopago', 'cash', 'UY', 'UYU', 'mercado', ['UY']),
  candidate('mercado_wallet', 'Mercado Pago Wallet', 'mercadopago', 'wallet', 'AR BR CL CO MX PE UY', 'ARS BRL CLP COP MXN PEN UYU', 'mercado', ['AR', 'BR', 'CL', 'CO', 'MX', 'PE', 'UY']),
];
export const PAYMENT_COUNTRIES = Object.keys(countryCurrency);
export function countryResearch(country: string) {
  const methods = PAYMENT_CATALOG.filter((m) => m.customerCountries === null || m.customerCountries.includes(country));
  return { country, coverage: methods.some((m) => m.customerCountries?.includes(country)) ? 'partial' as const : 'needs_research' as const, methods };
}
export const PROVIDER_REQUIREMENTS: Record<string, { credentials: string[]; checklist: string[] }> = {
  kashier: { credentials: ['KASHIER_MERCHANT_ID', 'KASHIER_API_KEY', 'KASHIER_SECRET_KEY'], checklist: ['معرف MID صحيح ومفتاحا API وSecret مختلفان ومن نفس الوضع.', 'حساب حي معتمد، كيان تجاري وبنك تسوية مطابقان للعقد، موقع معتمد.', 'بلد المشتري والوسيلة والعملة معتمدة في لوحة البوابة؛ الاختبار لا يثبت ذلك.'] },
  stripe: { credentials: ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET'], checklist: ['بلد تسجيل النشاط ضمن قائمة Stripe الخاصة بالوسيلة وليس بلد العميل فقط.', 'اعتماد النشاط والحساب البنكي وتفعيل capabilities؛ تحقق توقيع Webhook.', 'Apple Pay وGoogle Pay يحتاجان مراجعة النطاق والجهاز؛ لا تُفعّل المحافظ بالاسم فقط.'] },
  tap: { credentials: ['TAP_SECRET_KEY'], checklist: ['معرف التاجر المحلي وموافقة كل شبكة دفع وعملة.', 'عقد البنك المستحوذ وتحقق webhook وإتمام 3DS.'] },
  adyen: { credentials: ['ADYEN_API_KEY', 'ADYEN_MERCHANT_ACCOUNT', 'ADYEN_HMAC_KEY'], checklist: ['اعتماد الكيان والتسوية وصلاحيات API وتوقيع HMAC.', 'بعض الوسائل تحتاج اتفاقاً مباشراً أو كياناً محلياً إضافياً.'] },
  paystack: { credentials: ['PAYSTACK_SECRET_KEY'], checklist: ['بلد التاجر والقناة مطابقان للمصفوفة المحلية.', 'حساب بنكي معتمد؛ تأكيد نهائي عبر webhook للقنوات غير المتزامنة.'] },
  mercadopago: { credentials: ['MERCADOPAGO_ACCESS_TOKEN', 'MERCADOPAGO_WEBHOOK_SECRET'], checklist: ['حساب نشاط وبيانات ضريبية وتسوية محلية في السوق المطلوب.', 'عملة محلية، معرف idempotency، توقيع webhook؛ القسيمة ليست تحصيلاً فور إصدارها.'] },
  xendit: { credentials: ['XENDIT_SECRET_KEY', 'XENDIT_WEBHOOK_TOKEN'], checklist: ['تفعيل النشاط والقناة المحلية في بلد التشغيل وعملة التسوية الصحيحة.', 'التحقق من callback؛ QR أو طلب دفع صادر ليس دفعاً ناجحاً.'] },
};
