import { PAYMENT_CATALOG, PROVIDER_REQUIREMENTS } from '../../src/finance/paymentCatalog';
import { isCountry } from '../../src/utils/pricing';
import { kashierConfig, KASHIER_CURRENCIES } from '../core/kashier';
import { ValidationError } from '../core/repository';
import type { PaymentRegistration } from './types';
type Env = Record<string, string | undefined>;
export const emptyRegistration = (): PaymentRegistration => ({ id: 'kashier', merchantCountry: 'EG', buyerCountries: ['EG'], methods: ['card', 'wallet'], legalEntityChecked: false, settlementBankChecked: false, liveAccountApproved: false, websiteApproved: false, reviewedAt: '' });
export function readRegistration(body: unknown, now: number): PaymentRegistration {
  const b = body as Partial<PaymentRegistration> | null;
  const flags = ['legalEntityChecked', 'settlementBankChecked', 'liveAccountApproved', 'websiteApproved'] as const;
  if (!b || b.merchantCountry !== 'EG' || !Array.isArray(b.buyerCountries) || !b.buyerCountries.length || b.buyerCountries.length > 250 || b.buyerCountries.some((c) => !isCountry(c)) ||
    !Array.isArray(b.methods) || !b.methods.length || b.methods.some((m) => !['card', 'wallet'].includes(m)) || flags.some((f) => typeof b[f] !== 'boolean')) {
    throw new ValidationError('INVALID_REGISTRATION', 'راجع بلد التاجر وقائمة الدول والوسائل. الربط الحالي يدعم البطاقات ومحافظ مصر فقط.');
  }
  return { id: 'kashier', merchantCountry: b.merchantCountry, buyerCountries: [...new Set(b.buyerCountries)], methods: [...new Set(b.methods)],
    legalEntityChecked: Boolean(b.legalEntityChecked), settlementBankChecked: Boolean(b.settlementBankChecked), liveAccountApproved: Boolean(b.liveAccountApproved), websiteApproved: Boolean(b.websiteApproved), reviewedAt: new Date(now).toISOString() };
}
export function paymentReadiness(env: Env, registration: PaymentRegistration, persistent: boolean, now = Date.now()) {
  const cfg = kashierConfig(env);
  const checks: { code: string; ok: boolean; message: string }[] = [];
  const check = (code: string, ok: boolean, message: string) => checks.push({ code, ok, message });
  for (const name of PROVIDER_REQUIREMENTS.kashier.credentials) check(name, Boolean(env[name]?.trim()), `إضافة ${name} في أسرار الخادم، وليس في الشات.`);
  check('MERCHANT_ID', /^MID-\d+-\d+$/i.test(env.KASHIER_MERCHANT_ID?.trim() || ''), 'راجع صيغة معرف التاجر MID من لوحة البوابة.');
  check('DISTINCT_KEYS', Boolean(env.KASHIER_API_KEY?.trim() && env.KASHIER_SECRET_KEY?.trim() && env.KASHIER_API_KEY.trim() !== env.KASHIER_SECRET_KEY.trim()), 'مفتاح API ومفتاح Secret يجب أن يكونا مختلفين ومن الوضع نفسه.');
  check('MODE', !env.KASHIER_MODE?.trim() || ['test', 'live'].includes(env.KASHIER_MODE.trim().toLowerCase()), 'الوضع يجب أن يكون test أو live.');
  check('CURRENCIES', !env.KASHIER_CURRENCIES?.trim() || env.KASHIER_CURRENCIES.toUpperCase().split(',').every((c) => KASHIER_CURRENCIES.includes(c.trim() as never)), 'راجع عملات عقد الحساب: EGP أو USD أو EUR أو GBP.');
  check('DURABLE_LEDGER', persistent, 'الدفع الحي يحتاج تخزيناً دائماً للسجل المالي؛ الذاكرة المؤقتة لا تكفي.');
  let publicUrl = false;
  try { const u = new URL(env.SHAM_PUBLIC_API_URL || ''); publicUrl = u.protocol === 'https:' && !u.username && !u.password && !u.search && !u.hash && u.pathname === '/' && !['localhost', '127.0.0.1', '::1', '[::1]'].includes(u.hostname); } catch { /* missing */ }
  check('WEBHOOK_URL', publicUrl, 'اضبط SHAM_PUBLIC_API_URL على أصل HTTPS للمحرك؛ لا نستنتج رابط webhook من Host الزائر.');
  for (const [flag, message] of [
    ['legalEntityChecked', 'شاهين يحتاج تأكيد مراجعة تسجيل الكيان لدى البوابة.'],
    ['settlementBankChecked', 'شاهين يحتاج تأكيد مطابقة حساب التسوية في البوابة.'],
    ['liveAccountApproved', 'شاهين يحتاج موافقة البوابة على الحساب الحي والوسائل.'],
    ['websiteApproved', 'شاهين يحتاج تأكيد اعتماد نطاق المتجر وسياسات البيع.'],
  ] as const) check(flag, registration[flag], message);
  check('REGISTRATION_FRESH', Boolean(registration.reviewedAt && now - Date.parse(registration.reviewedAt) < 90 * 86400_000), 'راجع إقرار بيانات التسجيل كل 90 يوماً.');
  const configured = Boolean(cfg);
  const liveReady = cfg?.mode === 'live' && checks.every((c) => c.ok);
  return { configured, mode: cfg?.mode, liveReady, checks, authentication: 'not_probed' as const, integration: 'hosted' as const };
}
export function availableMethods(country: string, currency: string, env: Env, registration: PaymentRegistration, persistent: boolean, now = Date.now()) {
  const readiness = paymentReadiness(env, registration, persistent, now);
  // Test checkout stays in the sandbox and is explicitly labelled. Live is fail-closed.
  if (!readiness.configured || (readiness.mode === 'live' && !readiness.liveReady) || !registration.buyerCountries.includes(country)) return [];
  return PAYMENT_CATALOG.filter((m) => m.provider === 'kashier' && m.integration === 'hosted' && registration.methods.includes(m.id) &&
    (m.customerCountries === null || m.customerCountries.includes(country)) && m.currencies.includes(currency)).map((m) => ({ id: m.id, name: m.name }));
}
export function providerConfiguration(env: Env) {
  // Only presence is checked for unimplemented providers. Nothing is sent to their APIs.
  return Object.entries(PROVIDER_REQUIREMENTS).map(([id, def]) => ({ id, integration: id === 'kashier' ? 'hosted' : 'not_implemented',
    credentials: def.credentials.map((name) => ({ name, present: Boolean(env[name]?.trim()) })), checklist: def.checklist }));
}
