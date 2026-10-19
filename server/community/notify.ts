/**
 * «مجتمع شام» — e-mail delivery for account security (verification codes, reset codes, sign-in alerts).
 *
 * Uses the exact provider chain the orders' notifications use (Resend → SendGrid → outbound webhook),
 * so there is one set of keys on the server. When no provider is configured the call answers
 * `delivered: false` and the API tells the truth (EMAIL_UNAVAILABLE) — the code is never faked and
 * never shown to the client.
 */
type Env = Record<string, string | undefined>;

export interface AuthEmailResult { delivered: boolean; provider: string; error?: string }

const NOT_DELIVERED: AuthEmailResult = { delivered: false, provider: 'none' };

export interface OutboundMail {
  to: string[];
  subject: string;
  text: string;
  html?: string;
  /** The member's «handle@domain», so external answers come back into «بريد شام». */
  replyTo?: string;
  headers?: Record<string, string>;
}

/**
 * Real e-mail out of the platform («بريد شام» → Gmail / Yahoo / Hotmail / …), over the same provider
 * chain used for security e-mails: Resend → SendGrid → outbound webhook. When none is configured the
 * call answers honestly (`delivered: false, provider: 'none'`) and the sender gets a bounce in-app.
 */
export async function sendMailOutbound(
  mail: OutboundMail,
  env: Env = process.env,
  fetchFn: typeof fetch = fetch,
): Promise<AuthEmailResult> {
  const fromName = env.SHAM_EMAIL_FROM_NAME || 'شام للعطور (Sham Perfumes)';
  const fromAddress = env.SHAM_EMAIL_FROM_ADDRESS || 'no-reply@shamperfumes.com';
  const html = mail.html || `<div dir="auto" style="font-family:Tahoma,Arial,sans-serif;white-space:pre-wrap">${mail.text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>`;
  try {
    const resend = env.RESEND_API_KEY?.trim();
    if (resend) {
      const response = await fetchFn('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${resend}` },
        body: JSON.stringify({ from: `${fromName} <${fromAddress}>`, to: mail.to, subject: mail.subject, html, text: mail.text, ...(mail.replyTo ? { reply_to: mail.replyTo } : {}), ...(mail.headers ? { headers: mail.headers } : {}) }),
        signal: AbortSignal.timeout(8000),
      });
      if (response.ok) return { delivered: true, provider: 'resend' };
      return { delivered: false, provider: 'resend', error: `resend ${response.status}` };
    }
    const sendgrid = env.SENDGRID_API_KEY?.trim();
    if (sendgrid) {
      const response = await fetchFn('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sendgrid}` },
        body: JSON.stringify({
          from: { email: fromAddress, name: fromName },
          personalizations: [{ to: mail.to.map((address) => ({ email: address })) }],
          subject: mail.subject,
          content: [{ type: 'text/plain', value: mail.text }, { type: 'text/html', value: html }],
          ...(mail.replyTo ? { reply_to: { email: mail.replyTo } } : {}),
          ...(mail.headers ? { headers: mail.headers } : {}),
        }),
        signal: AbortSignal.timeout(8000),
      });
      if (response.ok) return { delivered: true, provider: 'sendgrid' };
      return { delivered: false, provider: 'sendgrid', error: `sendgrid ${response.status}` };
    }
    const webhook = env.SHAM_WEBHOOK_URL?.trim();
    if (webhook) {
      const response = await fetchFn(webhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'platform_mail', to: mail.to, subject: mail.subject, html, text: mail.text, replyTo: mail.replyTo || '', headers: mail.headers || {} }),
        signal: AbortSignal.timeout(8000),
      });
      if (response.ok) return { delivered: true, provider: 'webhook' };
      return { delivered: false, provider: 'webhook', error: `webhook ${response.status}` };
    }
  } catch (error) {
    return { delivered: false, provider: 'error', error: error instanceof Error ? error.message : String(error) };
  }
  return NOT_DELIVERED;
}

/** The domain «بريد شام» answers receive on (used for Reply-To addresses and inbound accept rules). */
export function mailDomain(env: Env = process.env): string {
  const own = env.SHAM_MAIL_DOMAIN?.trim().toLowerCase();
  if (own) return own.replace(/^@+/, '');
  const from = (env.SHAM_EMAIL_FROM_ADDRESS || 'no-reply@shamperfumes.com').trim().toLowerCase();
  return from.includes('@') ? from.split('@')[1] : '';
}

export default sendAuthEmail;

export async function sendAuthEmail(
  to: string,
  mail: { subject: string; html: string; text: string },
  env: Env = process.env,
  fetchFn: typeof fetch = fetch,
): Promise<AuthEmailResult> {
  const from = `${env.SHAM_EMAIL_FROM_NAME || 'شام للعطور (Sham Perfumes)'} <${env.SHAM_EMAIL_FROM_ADDRESS || 'no-reply@shamperfumes.com'}>`;
  try {
    const resend = env.RESEND_API_KEY?.trim();
    if (resend) {
      const response = await fetchFn('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${resend}` },
        body: JSON.stringify({ from, to: [to], subject: mail.subject, html: mail.html, text: mail.text }),
        signal: AbortSignal.timeout(6000),
      });
      if (response.ok) return { delivered: true, provider: 'resend' };
      return { delivered: false, provider: 'resend', error: `resend ${response.status}` };
    }
    const sendgrid = env.SENDGRID_API_KEY?.trim();
    if (sendgrid) {
      const response = await fetchFn('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sendgrid}` },
        body: JSON.stringify({ from: { email: from.split('<')[1]?.replace('>', ''), name: from.split('<')[0] }, personalizations: [{ to: [{ email: to }] }], subject: mail.subject, content: [{ type: 'text/html', value: mail.html }, { type: 'text/plain', value: mail.text }] }),
        signal: AbortSignal.timeout(6000),
      });
      if (response.ok) return { delivered: true, provider: 'sendgrid' };
      return { delivered: false, provider: 'sendgrid', error: `sendgrid ${response.status}` };
    }
    const webhook = env.SHAM_WEBHOOK_URL?.trim();
    if (webhook) {
      const response = await fetchFn(webhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'auth_email', to, subject: mail.subject, html: mail.html, text: mail.text }),
        signal: AbortSignal.timeout(6000),
      });
      if (response.ok) return { delivered: true, provider: 'webhook' };
      return { delivered: false, provider: 'webhook', error: `webhook ${response.status}` };
    }
  } catch (error) {
    return { delivered: false, provider: 'error', error: error instanceof Error ? error.message : String(error) };
  }
  return NOT_DELIVERED;
}

/** A minimal, honest e-mail body for security codes and alerts (bilingual, no tracking). */
export function codeMail(subject: string, code: string, minutes: number, noteAr: string, noteEn: string) {
  return {
    subject,
    html: `<div dir="rtl" style="font-family:Tahoma,Arial,sans-serif;max-width:520px;margin:auto;padding:24px;border:1px solid #e7e2d9;border-radius:16px">
      <h2 style="margin:0 0 8px;color:#7c5e10">شام للعطور</h2>
      <p style="color:#444">${noteAr}</p>
      <p style="font-size:30px;letter-spacing:8px;font-weight:bold;color:#1c1917;direction:ltr;text-align:center;background:#faf6ee;border-radius:12px;padding:12px">${code}</p>
      <p style="color:#8a817c;font-size:12px">الكود صالح لمدة ${minutes} دقيقة. لو أنت مش اللي طلبته، متعملش حاجة — هيتجاهل.</p>
      <hr style="border:none;border-top:1px solid #eee"/>
      <p style="color:#999;font-size:12px" dir="ltr">${noteEn} — the code is valid for ${minutes} minutes. If this was not you, you can ignore it.</p>
    </div>`,
    text: `${noteAr}\n\n${code}\n\nالكود صالح لمدة ${minutes} دقيقة. لو أنت مش اللي طلبته، متعملش حاجة — هيتجاهل.`,
  };
}
