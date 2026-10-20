/**
 * The platform's e-mail, free setup: one real inbox, one place in the code, no invented addresses,
 * and the free Gmail sender for the platform's own mail.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { CONTACT, CONTACT_ROLES, STORE_EMAIL, contactEmail, contactMailto, contactTag, isPublicMailDomain } from '../src/config/contact';
import { gmailConfig, mailProvider, mailProviderLabel, senderAddress, sendViaGmail, setGmailTransportFactory } from '../server/core/mailer';
import { sendCustomerStatusEmail } from '../server/core/email';
import { mailDomain, sendAuthEmail } from '../server/community/notify';
import type { ServiceRequest } from '../server/core/types';

const ROOT = new URL('..', import.meta.url).pathname;
const APP_PASSWORD = 'abcd efgh ijkl mnop'; // Google shows app passwords in 4 groups; spaces are ignored

function files(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (['node_modules', '.git', 'pages-dist', 'dist', 'tests'].includes(name)) continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) files(path, out);
    else if (/\.(tsx?|mts|mjs|md|json|ya?ml|html)$/.test(name)) out.push(path);
  }
  return out;
}

test('no invented contact domains anywhere in the site, the server, the scripts or the docs', () => {
  const offenders: string[] = [];
  for (const dir of ['src', 'server', 'scripts', 'docs', '.github', 'public']) {
    let list: string[] = [];
    try { list = files(join(ROOT, dir)); } catch { continue; }
    for (const file of list) {
      const text = readFileSync(file, 'utf8');
      if (/@(?:sham-perfume\.com|shamperfumes\.com|sham\.com)\b/.test(text) && !/AuthModal\.tsx$/.test(file)) offenders.push(file.slice(ROOT.length));
    }
  }
  assert.deepEqual(offenders, [], `placeholder addresses came back: ${offenders.join(', ')}`);
});

test('every role has a real address in one place, with a tag Gmail can filter on', () => {
  assert.match(STORE_EMAIL, /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/);
  for (const role of CONTACT_ROLES) {
    assert.equal(contactEmail(role), CONTACT[role].email);
    assert.ok(CONTACT[role].ar && CONTACT[role].en);
  }
  assert.equal(contactTag('privacy', 'ar'), '[شام | الخصوصية]');
  assert.equal(contactTag('privacy', 'en'), '[Sham | Privacy]');
  const link = contactMailto('support', 'ar', 'طلب SP-1', 'سطر أول');
  assert.ok(link.startsWith(`mailto:${STORE_EMAIL}?subject=`));
  assert.equal(decodeURIComponent(link.split('subject=')[1].split('&')[0]), '[شام | الدعم] طلب SP-1');
  assert.ok(link.includes(`body=${encodeURIComponent('سطر أول')}`));
});

test('a free mailbox domain is never used for members’ addresses', () => {
  assert.ok(isPublicMailDomain('gmail.com'));
  assert.equal(mailDomain({}), '', 'no domain configured → no member addresses');
  assert.equal(mailDomain({ SHAM_EMAIL_FROM_ADDRESS: STORE_EMAIL }), '');
  assert.equal(mailDomain({ SHAM_MAIL_DOMAIN: 'gmail.com' }), '');
  assert.equal(mailDomain({ SHAM_MAIL_DOMAIN: '@mail.example.org' }), 'mail.example.org');
  assert.equal(mailDomain({ SHAM_EMAIL_FROM_ADDRESS: 'orders@example.org' }), 'example.org');
});

test('Gmail is configured only with a real 16-letter app password and sits after Resend/SendGrid', () => {
  assert.equal(gmailConfig({}), undefined);
  assert.equal(gmailConfig({ SHAM_GMAIL_APP_PASSWORD: 'short' }), undefined);
  assert.deepEqual(gmailConfig({ SHAM_GMAIL_APP_PASSWORD: APP_PASSWORD }), { user: STORE_EMAIL, pass: 'abcdefghijklmnop' });
  assert.equal(mailProvider({}), '');
  assert.equal(mailProviderLabel({}), 'Simulator');
  assert.equal(mailProvider({ SHAM_GMAIL_APP_PASSWORD: APP_PASSWORD, SHAM_WEBHOOK_URL: 'https://hook.example' }), 'gmail');
  assert.equal(mailProvider({ SHAM_GMAIL_APP_PASSWORD: APP_PASSWORD, SENDGRID_API_KEY: 'sg' }), 'sendgrid');
  assert.equal(mailProvider({ SHAM_GMAIL_APP_PASSWORD: APP_PASSWORD, RESEND_API_KEY: 're' }), 'resend');
  assert.equal(senderAddress({}), STORE_EMAIL);
  assert.equal(senderAddress({ SHAM_EMAIL_FROM_ADDRESS: 'orders@example.org' }), 'orders@example.org');
});

test('order updates and sign-in codes go out through Gmail, and the password never leaks', async () => {
  const sent: Record<string, unknown>[] = [];
  setGmailTransportFactory((config) => {
    assert.equal(config.user, STORE_EMAIL);
    return { async sendMail(message) { sent.push(message); return { messageId: 'x' }; } };
  });
  try {
    const env = { SHAM_GMAIL_APP_PASSWORD: APP_PASSWORD };
    const noFetch = (async () => { throw new Error('no HTTP provider should be called'); }) as unknown as typeof fetch;
    const request = {
      id: 'r1', ref: 'SH-GM1', type: 'order', serviceId: 'store', status: 'new',
      contact: { name: 'Mona', email: 'mona@example.com', phone: '+20100000000' }, fields: {}, items: [], total: 100, currency: 'EGP',
      notes: [], createdAt: '2026-10-20T10:00:00.000Z', updatedAt: '2026-10-20T10:00:00.000Z',
    } as unknown as ServiceRequest;
    const order = await sendCustomerStatusEmail({ request, status: 'confirmed' }, env, noFetch);
    assert.equal(order.provider, 'gmail');
    assert.equal(order.delivery, 'sent');
    assert.deepEqual(sent[0].to, ['mona@example.com']);
    assert.deepEqual(sent[0].from, { name: 'شام للعطور (Sham Perfumes)', address: STORE_EMAIL });
    assert.equal(sent[0].replyTo, STORE_EMAIL);

    const code = await sendAuthEmail('omar@example.com', { subject: 'كود', html: '<b>1</b>', text: '1' }, env, noFetch);
    assert.deepEqual(code, { delivered: true, provider: 'gmail' });

    setGmailTransportFactory(() => ({ async sendMail() { throw new Error(`535 bad login abcdefghijklmnop for ${STORE_EMAIL}`); } }));
    const failed = await sendViaGmail({ to: ['a@example.com'], subject: 's', html: 'h', text: 't' }, env);
    assert.equal(failed?.delivered, false);
    assert.ok(!failed?.error?.includes('abcdefghijklmnop'), 'the app password is masked in errors');
    const orderFailed = await sendCustomerStatusEmail({ request, status: 'confirmed' }, env, noFetch);
    assert.equal(orderFailed.delivery, 'failed', 'a Gmail failure is reported, never shown as simulated');
  } finally {
    setGmailTransportFactory();
  }
});
