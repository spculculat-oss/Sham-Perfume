/** Integer minor-unit money. Never silently round a ledger entry or mix currencies. */
import countryCurrency from '../data/country-currency.json';
const CURRENCIES = new Set([...Object.values(countryCurrency), 'USD', 'EUR']);
const ZERO = new Set(['BIF', 'CLP', 'DJF', 'GNF', 'ISK', 'JPY', 'KMF', 'KRW', 'PYG', 'RWF', 'UGX', 'VND', 'VUV', 'XAF', 'XOF', 'XPF']);
const THREE = new Set(['BHD', 'IQD', 'JOD', 'KWD', 'LYD', 'OMR', 'TND']);
export function decimals(currency: string): number {
  if (!CURRENCIES.has(currency)) throw new Error('INVALID_CURRENCY');
  return ZERO.has(currency) ? 0 : THREE.has(currency) ? 3 : 2;
}
export function toMinor(value: unknown, currency: string): number {
  const d = decimals(currency);
  const text = typeof value === 'number' && Number.isFinite(value) ? String(value) : typeof value === 'string' ? value.trim() : '';
  if (!/^\d{1,12}(\.\d{1,3})?$/.test(text)) throw new Error('INVALID_AMOUNT');
  const [whole, fraction = ''] = text.split('.');
  if (fraction.length > d && /[1-9]/.test(fraction.slice(d))) throw new Error('INVALID_PRECISION');
  const minor = Number(whole) * 10 ** d + Number(fraction.slice(0, d).padEnd(d, '0'));
  if (!Number.isSafeInteger(minor)) throw new Error('AMOUNT_TOO_LARGE');
  return minor;
}
export function sumMinor(values: number[]): number {
  return values.reduce((sum, n) => {
    const total = sum + n;
    if (!Number.isSafeInteger(n) || !Number.isSafeInteger(total)) throw new Error('AMOUNT_TOO_LARGE');
    return total;
  }, 0);
}
export const major = (minor: number, currency: string) => minor / 10 ** decimals(currency);
