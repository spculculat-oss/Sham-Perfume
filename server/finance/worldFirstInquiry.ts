/**
 * Signed balance read from WorldFirst. It never sends money and never returns an account number.
 * A reply is live only after WorldFirst's own signature checks. Otherwise the owner screen stays.
 */
import { createSign, createVerify } from 'node:crypto';
import { decimals } from '../../src/finance/money';
import {
  WORLDFIRST_WALLETS,
  isWorldFirstCurrency,
  worldFirstSnapshot,
  type WorldFirstCurrency,
  type WorldFirstSnapshot,
} from '../../src/bank/worldFirstRail';

export const INQUIRY_PATH = '/amsin/api/v1/business/account/inquiryBalance';
const HOSTS = new Set(['open-sea.worldfirst.com', 'open-eu.worldfirst.com', 'open-na.worldfirst.com']);

export type InquiryState = 'not_ready' | 'verified' | 'unverified' | 'failed';

export interface InquiryWallet {
  currency: WorldFirstCurrency;
  available: string;
  pending: string;
}

export function signatureContent(method: string, path: string, clientId: string, time: string, body: string): string {
  return `${method} ${path}\n${clientId}.${time}.${body}`;
}

export function requestTime(date = new Date()): string {
  return date.toISOString().replace(/\.\d{3}Z$/, '+00:00');
}

function pem(raw: string, kind: 'PRIVATE' | 'PUBLIC'): string {
  const text = raw.replace(/\\n/g, '\n').trim();
  if (text.includes('BEGIN')) return text;
  const body = text.replace(/\s/g, '');
  const lines = body.match(/.{1,64}/g)?.join('\n') || body;
  return `-----BEGIN ${kind} KEY-----\n${lines}\n-----END ${kind} KEY-----`;
}

export function signRequest(content: string, privateKey: string): string {
  const signer = createSign('RSA-SHA256');
  signer.update(content);
  signer.end();
  return encodeURIComponent(signer.sign(pem(privateKey, 'PRIVATE')).toString('base64'));
}

export function verifyResponse(content: string, signatureHeader: string, publicKey: string): boolean {
  const encoded = /(?:^|,)\s*signature=([^,]+)/i.exec(signatureHeader)?.[1] || '';
  if (!encoded) return false;
  let signature: Buffer;
  try { signature = Buffer.from(decodeURIComponent(encoded), 'base64'); } catch { return false; }
  if (signature.length < 32) return false;
  try {
    const verifier = createVerify('RSA-SHA256');
    verifier.update(content);
    verifier.end();
    return verifier.verify(pem(publicKey, 'PUBLIC'), signature);
  } catch {
    return false;
  }
}

function formatMinor(value: number, currency: string): string {
  const d = decimals(currency);
  const abs = Math.abs(value);
  const whole = Math.trunc(abs / 10 ** d);
  const fraction = String(abs % 10 ** d).padStart(d, '0');
  return `${value < 0 ? '-' : ''}${d === 0 ? whole : `${whole}.${fraction}`}`;
}

function moneyValue(row: unknown, currency: string): number | null {
  if (!row || typeof row !== 'object') return null;
  const value = (row as { value?: unknown }).value;
  return typeof value === 'number' && Number.isSafeInteger(value) ? value : null;
}

/** Drops account numbers. Returns null unless WorldFirst reported success. */
export function walletsFromInquiry(payload: unknown): InquiryWallet[] | null {
  if (!payload || typeof payload !== 'object') return null;
  const result = (payload as { result?: { resultStatus?: unknown } }).result;
  if (result?.resultStatus !== 'S') return null;
  const rows = (payload as { accountBalances?: unknown }).accountBalances;
  if (!Array.isArray(rows)) return null;
  const found = new Map<WorldFirstCurrency, InquiryWallet>();
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const currency = String((row as { currency?: unknown }).currency || '');
    if (!isWorldFirstCurrency(currency) || found.has(currency)) continue;
    const available = moneyValue((row as { availableBalance?: unknown }).availableBalance, currency);
    const frozen = moneyValue((row as { frozenBalance?: unknown }).frozenBalance, currency);
    if (available === null) continue;
    const screen = WORLDFIRST_WALLETS.find((item) => item.currency === currency)!;
    found.set(currency, { currency, available: formatMinor(available, currency), pending: frozen === null ? screen.pending : formatMinor(frozen, currency) });
  }
  return WORLDFIRST_WALLETS.map((row) => found.get(row.currency) || { currency: row.currency, available: row.available, pending: row.pending });
}

export function inquiryReady(env: Record<string, string | undefined>): boolean {
  const host = env.WORLDFIRST_API_HOST?.trim().toLowerCase() || '';
  return Boolean(env.WORLDFIRST_CLIENT_ID?.trim() && env.WORLDFIRST_PRIVATE_KEY?.trim() && env.WORLDFIRST_PUBLIC_KEY?.trim() && HOSTS.has(host));
}

export interface InquiryResult extends WorldFirstSnapshot {
  inquiry: InquiryState;
  wallets: InquiryWallet[];
}

export async function inquireWorldFirst(env: Record<string, string | undefined>, fetchImpl: typeof fetch = fetch, now = new Date()): Promise<InquiryResult> {
  const base = worldFirstSnapshot(Boolean(env.WORLDFIRST_CLIENT_ID?.trim() && env.WORLDFIRST_PRIVATE_KEY?.trim()), 0);
  const screen = { ...base, inquiry: 'not_ready' as const, wallets: WORLDFIRST_WALLETS.map((row) => ({ ...row })) };
  if (!inquiryReady(env)) return screen;
  const clientId = env.WORLDFIRST_CLIENT_ID!.trim();
  const host = env.WORLDFIRST_API_HOST!.trim().toLowerCase();
  const body = JSON.stringify({ balanceTypes: ['NORMAL_BALANCE'], currencyList: WORLDFIRST_WALLETS.map((row) => row.currency) });
  const time = requestTime(now);
  const content = signatureContent('POST', INQUIRY_PATH, clientId, time, body);
  let signature: string;
  try { signature = signRequest(content, env.WORLDFIRST_PRIVATE_KEY!); } catch { return { ...screen, inquiry: 'failed' }; }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetchImpl(`https://${host}${INQUIRY_PATH}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=UTF-8',
        'Client-Id': clientId,
        'Request-Time': time,
        Signature: `algorithm=RSA256, keyVersion=2, signature=${signature}`,
      },
      body,
      signal: controller.signal,
    });
    const text = await response.text();
    const responseTime = response.headers.get('response-time') || time;
    const responseSignature = response.headers.get('signature') || '';
    const responseContent = signatureContent('POST', INQUIRY_PATH, clientId, responseTime, text);
    if (!verifyResponse(responseContent, responseSignature, env.WORLDFIRST_PUBLIC_KEY!)) return { ...screen, inquiry: 'unverified' };
    const wallets = walletsFromInquiry(JSON.parse(text));
    if (!wallets) return { ...screen, inquiry: 'failed' };
    return { ...screen, inquiry: 'verified', balancesLive: true, wallets };
  } catch {
    return { ...screen, inquiry: 'failed' };
  } finally {
    clearTimeout(timer);
  }
}


