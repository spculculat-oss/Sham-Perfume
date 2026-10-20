/**
 * Which e-mail service the server can really send with, and the free Gmail route.
 *
 * Order everywhere: Resend → SendGrid → Gmail (free) → outbound webhook → nothing (honest «not sent").
 *
 * Gmail (free, ~500 messages a day): the owner creates an «App password» in his Google account
 * (Security → 2-Step Verification → App passwords) and stores it himself as the secret
 * SHAM_GMAIL_APP_PASSWORD (GitHub secret → synced to the engine). The address defaults to the store
 * address in src/config/contact.ts (override with SHAM_GMAIL_USER). Gmail always sends as the signed-in
 * address, so the From is that address. The password is never logged or returned.
 *
 * Gmail is used for the platform's OWN mail only (order updates, sign-in codes, contract codes) —
 * never to relay members' «بريد شام» letters, which would put strangers' mail in the owner's account.
 */
import nodemailer from 'nodemailer';
import { STORE_EMAIL, STORE_NAME } from '../../src/config/contact';

type Env = Record<string, string | undefined>;

export type MailProvider = 'resend' | 'sendgrid' | 'gmail' | 'webhook' | '';

export interface GmailConfig { user: string; pass: string }

export function gmailConfig(env: Env = process.env): GmailConfig | undefined {
  const pass = (env.SHAM_GMAIL_APP_PASSWORD || '').replace(/\s+/g, '');
  if (pass.length < 16) return undefined; // Google app passwords are 16 letters
  const user = (env.SHAM_GMAIL_USER || STORE_EMAIL).trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user)) return undefined;
  return { user, pass };
}

/** The first configured service, in the order the senders try them ('' = none: mail is not sent). */
export function mailProvider(env: Env = process.env): MailProvider {
  if (env.RESEND_API_KEY?.trim()) return 'resend';
  if (env.SENDGRID_API_KEY?.trim()) return 'sendgrid';
  if (gmailConfig(env)) return 'gmail';
  if (env.SHAM_WEBHOOK_URL?.trim()) return 'webhook';
  return '';
}

export const mailProviderLabel = (env: Env = process.env) =>
  ({ resend: 'Resend', sendgrid: 'SendGrid', gmail: 'Gmail', webhook: 'Webhook', '': 'Simulator' } as const)[mailProvider(env)];

/** The address our own mail is sent from (and replies go to). */
export function senderAddress(env: Env = process.env): string {
  return (env.SHAM_EMAIL_FROM_ADDRESS || gmailConfig(env)?.user || STORE_EMAIL).trim();
}

export function senderName(env: Env = process.env): string {
  return env.SHAM_EMAIL_FROM_NAME || `${STORE_NAME.ar} (${STORE_NAME.en})`;
}

export interface PlainMail { to: string[]; subject: string; html: string; text: string; replyTo?: string }
export type Transport = { sendMail(message: Record<string, unknown>): Promise<unknown> };
export type TransportFactory = (config: GmailConfig) => Transport;

const defaultFactory: TransportFactory = ({ user, pass }) => nodemailer.createTransport({
  host: 'smtp.gmail.com', port: 465, secure: true, auth: { user, pass },
  connectionTimeout: 8000, greetingTimeout: 8000, socketTimeout: 10000,
});
let factory: TransportFactory = defaultFactory;
/** Tests only: replace the SMTP connection with a fake (pass nothing to restore the real one). */
export function setGmailTransportFactory(next?: TransportFactory) { factory = next || defaultFactory; }

/** Sends with Gmail. undefined = Gmail is not configured (the caller tries the next service). */
export async function sendViaGmail(mail: PlainMail, env: Env = process.env): Promise<{ delivered: boolean; provider: 'gmail'; error?: string } | undefined> {
  const config = gmailConfig(env);
  if (!config) return undefined;
  try {
    await factory(config).sendMail({
      from: { name: senderName(env), address: config.user },
      to: mail.to, subject: mail.subject, html: mail.html, text: mail.text,
      ...(mail.replyTo ? { replyTo: mail.replyTo } : {}),
    });
    return { delivered: true, provider: 'gmail' };
  } catch (error) {
    // SMTP errors can echo the login name but never the password; keep only the short reason.
    const reason = error instanceof Error ? error.message.replace(config.pass, '***').slice(0, 160) : 'unknown';
    return { delivered: false, provider: 'gmail', error: `gmail ${reason}` };
  }
}
