/**
 * «تسعير شام»: the day's exchange rates for every currency (base USD) → src/data/live/fx-rates.json,
 * which src/utils/pricing.ts uses to show each visitor prices in their own country's currency.
 * Runs with every import (every two hours). Offline or a bad answer → the previous file stays.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { isFxTable } from '../../src/utils/pricing';

const FILE = new URL('../../src/data/live/fx-rates.json', import.meta.url);
const gh = Boolean(process.env.GITHUB_ACTIONS);
const say = (level: 'notice' | 'warning', msg: string) => console.log(gh ? `::${level} title=Exchange rates::${msg}` : `[${level}] ${msg}`);

try {
  const r = await fetch('https://open.er-api.com/v6/latest/USD', { signal: AbortSignal.timeout(20_000) });
  const data = await r.json() as { result?: string; time_last_update_unix?: number; rates?: Record<string, number> };
  const table = {
    base: 'USD', source: 'open.er-api.com',
    updatedAt: new Date((data.time_last_update_unix || Date.now() / 1000) * 1000).toISOString().replace(/\.\d+Z$/, 'Z'),
    rates: Object.fromEntries(Object.entries(data.rates || {}).filter(([code, v]) => /^[A-Z]{3}$/.test(code) && Number(v) > 0)),
  };
  if (data.result !== 'success' || !isFxTable(table) || Object.keys(table.rates).length < 100) throw new Error('unexpected answer');
  const previous = JSON.parse(readFileSync(FILE, 'utf8')) as { updatedAt?: string };
  if (previous.updatedAt === table.updatedAt) { say('notice', `already current (${table.updatedAt})`); process.exit(0); }
  writeFileSync(FILE, `${JSON.stringify(table)}\n`);
  say('notice', `${Object.keys(table.rates).length} currencies, 1 USD = ${table.rates.EGP} EGP (${table.updatedAt})`);
} catch (error) {
  say('warning', `kept the previous rates: ${(error as Error).message}`);
}
