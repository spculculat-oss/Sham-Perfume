import { toLatinDigits } from '../لغات/numerals';
import { commonDecimalScale, compensatedSum } from './engineeringNumeric';

// Educational, currency-agnostic time-value calculations. These are not prices or financial advice.
const finite = (n: number) => {
  if (!Number.isFinite(n)) throw new Error('Enter values within the supported numeric range.');
  return n;
};
const positive = (n: number, field: string) => {
  if (!Number.isFinite(n) || n < 0) throw new Error(`${field} must be nonnegative.`);
  return n;
};
function periods(n: number, max = 1200) {
  if (!Number.isInteger(n) || n < 1 || n > max) throw new Error(`Use a whole number of periods from 1 to ${max}.`);
  return n;
}
function rate(r: number) {
  if (!Number.isFinite(r) || r <= -1 || r > 100) throw new Error('The periodic rate must be greater than −100%.');
  return r;
}
function factors(periodicRate: number, count: number, beginning = false) {
  const r = rate(periodicRate), n = periods(count);
  const log = n * Math.log1p(r);
  const compound = finite(Math.exp(log));
  if (!compound) throw new Error('The rate and period count are too far apart in scale.');
  return { compound, series: finite((r ? Math.expm1(log) / r : n) * (beginning ? 1 + r : 1)) };
}

export function timeValue(kind: 'future' | 'present' | 'payment', principal: number, payment: number, future: number, periodicRate: number, count: number, beginning = false) {
  const { compound, series } = factors(periodicRate, count, beginning);
  return finite(kind === 'future' ? principal * compound + payment * series
    : kind === 'present' ? (future - payment * series) / compound
      : (future - principal * compound) / series);
}

export function simpleInterest(principal: number, periodicRate: number, duration: number) {
  const interest = finite(positive(principal, 'Principal') * rate(periodicRate) * positive(duration, 'Duration'));
  return { interest, total: finite(principal + interest) };
}

export function effectiveRate(nominal: number, frequency: number) {
  const n = periods(frequency, 366);
  return finite(Math.expm1(n * Math.log1p(rate(nominal / n))));
}

export function amortizeLoan(principal: number, annualRate: number, months: number) {
  positive(principal, 'Principal');
  const r = positive(annualRate, 'Nominal annual rate') / 12;
  const count = periods(months, 600);
  rate(r);
  // Use the closed form at each month instead of subtracting tiny principal amounts from a
  // rounded balance. Otherwise long, high-rate loans end with a spurious balloon payment.
  const log = Math.log1p(r);
  const factor = r ? -Math.expm1(-count * log) : count;
  const payment = finite(principal * (r ? r / factor : 1 / count));
  const rows = Array.from({ length: count }, (_, i) => {
    const remaining = count - i - 1;
    const interest = r ? payment * -Math.expm1(-(remaining + 1) * log) : 0;
    const paidPrincipal = r ? payment * Math.exp(-(remaining + 1) * log) : payment;
    const balance = principal * ((r ? -Math.expm1(-remaining * log) : remaining) / factor);
    return { month: i + 1, payment, principal: paidPrincipal, interest, balance };
  });
  return { payment, totalInterest: finite(compensatedSum(rows.map((row) => row.interest))), totalPaid: finite(payment * count), rows };
}

export function cashFlowAnalysis(flows: readonly number[], discount: number) {
  if (flows.length < 2 || flows.length > 201 || flows.some((n) => !Number.isFinite(n) || Math.abs(n) > 1e15)) throw new Error('Enter 2–201 finite, evenly spaced cash flows.');
  const discounted = (r: number) => {
    if (!r) return compensatedSum(flows);
    // Horner in the discount factor avoids raising tiny rates to a huge high-period power first.
    const inverse = 1 / (1 + r);
    let total = flows[flows.length - 1];
    for (let i = flows.length - 2; i >= 0; i--) total = flows[i] + total * inverse;
    return total;
  };
  const npv = finite(discounted(rate(discount)));
  let irr: number | undefined, payback: number | undefined;
  // A conventional investment has one negative initial flow and nonnegative proceeds. Do not
  // advertise a unique IRR or payback for an arbitrary sequence with multiple sign changes.
  if (flows[0] < 0 && flows.slice(1).every((n) => n >= 0) && flows.slice(1).some((n) => n > 0)) {
    let lo = -0.9999, hi = 100;
    if (discounted(lo) === 0) irr = lo;
    else if (discounted(hi) === 0) irr = hi;
    else if (discounted(lo) > 0 && discounted(hi) < 0) {
      for (let i = 0; i < 80; i++) {
        const middle = (lo + hi) / 2;
        if (discounted(middle) > 0) lo = middle;
        else hi = middle;
      }
      irr = (lo + hi) / 2;
    }
    let cumulative = flows[0];
    for (let i = 1; i < flows.length; i++) {
      if (cumulative + flows[i] >= 0 && flows[i] > 0) { payback = i - 1 - cumulative / flows[i]; break; }
      cumulative += flows[i];
    }
  }
  return { npv, irr, payback };
}

export function bondPrice(face: number, couponRate: number, annualYield: number, frequency: number, count: number) {
  positive(face, 'Face value');
  positive(couponRate, 'Coupon rate');
  const n = periods(frequency, 12);
  const r = rate(annualYield / n);
  const c = periods(count);
  const log = -c * Math.log1p(r);
  return finite(face * Math.exp(log) + (face * couponRate / n) * (r ? -Math.expm1(log) / r : c));
}

export function depreciation(cost: number, salvage: number, life: number, year: number, decliningRate?: number) {
  positive(cost, 'Cost'); positive(salvage, 'Salvage value');
  periods(life, 100); periods(year, life);
  if (salvage > cost || decliningRate !== undefined && !(decliningRate > 0 && decliningRate <= 1)) throw new Error('Check salvage value or the annual declining rate.');
  if (decliningRate === undefined) return { expense: (cost - salvage) / life, bookValue: salvage + (cost - salvage) * ((life - year) / life) };
  const log = Math.log1p(-decliningRate);
  const before = year === 1 ? cost : cost * Math.exp((year - 1) * log);
  const bookValue = Math.max(salvage, cost * Math.exp(year * log));
  // Subtracting rounded book values can erase a nonzero expense at a very low rate.
  return { expense: Math.min(Math.max(0, before - salvage), before * decliningRate), bookValue };
}

export function breakEven(fixedCost: number, sellingPrice: number, variableCost: number) {
  positive(fixedCost, 'Fixed cost'); positive(sellingPrice, 'Selling price'); positive(variableCost, 'Variable cost');
  if (sellingPrice <= variableCost) throw new Error('No finite break-even point when contribution is zero or negative.');
  const { integers: [cost, price, variable], exponent } = commonDecimalScale([fixedCost, sellingPrice, variableCost]);
  const contribution = price - variable;
  const wholeUnits = Number((cost + contribution - 1n) / contribution);
  if (!Number.isSafeInteger(wholeUnits)) throw new Error('The whole-unit result is outside the supported exact range.');
  const margin = Number(`${contribution}e${exponent}`) / sellingPrice;
  const units = finite(fixedCost / Number(`${contribution}e${exponent}`));
  return { units, wholeUnits, revenue: finite(units * sellingPrice), margin };
}

const day = (input: string) => {
  const iso = toLatinDigits(input.trim());
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) throw new Error('Use a date in YYYY-MM-DD format.');
  const ms = Date.parse(`${iso}T00:00:00.000Z`);
  if (!Number.isFinite(ms) || new Date(ms).toISOString().slice(0, 10) !== iso) throw new Error('Invalid calendar date.');
  return ms;
};
export function countCalendarDays(from: string, to: string) {
  return (day(to) - day(from)) / 86_400_000;
}
