/**
 * «شاهين يتأكد من دولة الدخول قبل ما يرد» — the server side.
 *
 * Every chat reply leaves the server in the currency of the country the visitor is entering from (the edge country
 * of THIS request, or the page's when the edge is unknown; src/utils/displayCurrency.ts → replyMoney). His brain, the
 * AI platforms, the memory and the price checks keep speaking Egyptian pounds (the catalog's single truth); only the
 * text that goes out is converted, exactly like the product pages (src/utils/chatPrices.ts). The reply also tells the
 * page which country and currency it was written for, so the page can follow a new entry country at once.
 */
import type express from 'express';
import type { SupportedLanguage } from '../../src/types/i18n';
import { isCountry } from '../../src/utils/pricing';
import { replyMoney } from '../../src/utils/displayCurrency';
import { localizeChatPrices } from '../../src/utils/chatPrices';

/** The visitor's country from the edge (Vercel / Cloudflare headers), or undefined. */
export function countryFromHeaders(headers: Record<string, string | string[] | undefined>): string | undefined {
  for (const name of ['x-vercel-ip-country', 'cf-ipcountry', 'x-country-code']) {
    const value = String(headers[name] || '').toUpperCase();
    if (isCountry(value)) return value;
  }
  return undefined;
}

export type ReplyMoney = ReturnType<typeof replyMoney>;

/** The country and currency this request's reply is written in. */
export function moneyFor(req: express.Request, lang: SupportedLanguage): ReplyMoney {
  const body = (req.body && typeof req.body === 'object' ? req.body : {}) as Record<string, unknown>;
  return replyMoney({ edgeCountry: countryFromHeaders(req.headers), country: body.country, currency: body.currency, countryManual: body.countryManual, lang });
}

/** Every Egyptian-pound amount in these text fields, in the reply's currency (other fields untouched). */
export function moneyOut<T>(body: T, money: ReplyMoney, lang: SupportedLanguage, fields: string[] = ['reply']): T {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return body;
  const out: Record<string, unknown> = { ...(body as Record<string, unknown>) };
  let touched = false;
  for (const field of fields) {
    if (typeof out[field] === 'string') { out[field] = localizeChatPrices(out[field] as string, money.currency, lang); touched = true; }
  }
  return (touched ? { ...out, country: money.country, currency: money.currency } : out) as T;
}

/** Wraps `res.json` so whatever answer this request sends goes out in the visitor's currency. */
export function sendInVisitorMoney(req: express.Request, res: express.Response, lang: SupportedLanguage, fields?: string[]): ReplyMoney {
  const money = moneyFor(req, lang);
  const send = res.json.bind(res);
  res.json = ((body: unknown) => send(moneyOut(body, money, lang, fields))) as typeof res.json;
  return money;
}
