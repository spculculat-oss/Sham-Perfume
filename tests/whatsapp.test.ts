import assert from 'node:assert/strict';
import { test } from 'node:test';
import { authPublicConfig } from '../server/community/service';
import { metaWhatsAppReady, sendMetaWhatsAppCode } from '../server/community/whatsapp';

const configured = {
  SHAM_WHATSAPP_ACCESS_TOKEN: 'server-only-test-token',
  SHAM_WHATSAPP_PHONE_NUMBER_ID: '123456789012345',
  SHAM_WHATSAPP_GRAPH_VERSION: 'v99.0',
  SHAM_WHATSAPP_AUTH_TEMPLATE: 'sham_login_code',
  SHAM_WHATSAPP_TEMPLATE_LANGUAGE: 'ar_EG',
};

test('WhatsApp capability is public only when all Meta settings are complete, without exposing secrets', () => {
  assert.equal(metaWhatsAppReady({}), false);
  assert.equal(metaWhatsAppReady({ ...configured, SHAM_WHATSAPP_AUTH_TEMPLATE: '' }), false);
  assert.equal(metaWhatsAppReady(configured), true);
  const publicConfig = authPublicConfig(configured);
  assert.deepEqual(publicConfig, { whatsappOtp: true });
  assert.equal(JSON.stringify(publicConfig).includes(configured.SHAM_WHATSAPP_ACCESS_TOKEN), false);
  assert.equal(authPublicConfig({}).whatsappOtp, false);
});

test('Meta delivery sends a six-digit code via the approved template without leaking configuration', async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const fetchFn: typeof fetch = async (input, init) => {
    calls.push({ url: String(input), init });
    return new Response('{"messages":[{"id":"provider-message-id"}]}', { status: 200 });
  };
  const result = await sendMetaWhatsAppCode('+201001234567', '482731', configured, fetchFn);
  assert.deepEqual(result, { accepted: true });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://graph.facebook.com/v99.0/123456789012345/messages');
  const headers = new Headers(calls[0].init?.headers);
  assert.equal(headers.get('authorization'), `Bearer ${configured.SHAM_WHATSAPP_ACCESS_TOKEN}`);
  const body = JSON.parse(String(calls[0].init?.body));
  assert.equal(body.messaging_product, 'whatsapp');
  assert.equal(body.to, '201001234567');
  assert.equal(body.type, 'template');
  assert.deepEqual(body.template, {
    name: 'sham_login_code',
    language: { code: 'ar_EG' },
    components: [{ type: 'body', parameters: [{ type: 'text', text: '482731' }] }],
  });
  assert.equal(JSON.stringify(body).includes(configured.SHAM_WHATSAPP_ACCESS_TOKEN), false);
});

test('invalid phone/code, missing config, provider rejection and network failure are reported honestly', async () => {
  let calls = 0;
  const okFetch: typeof fetch = async () => { calls++; return new Response('{}', { status: 200 }); };
  assert.deepEqual(await sendMetaWhatsAppCode('+201001234567', '123456', {}, okFetch), { accepted: false, reason: 'unconfigured' });
  assert.deepEqual(await sendMetaWhatsAppCode('01001234567', '123456', configured, okFetch), { accepted: false, reason: 'invalid' });
  assert.deepEqual(await sendMetaWhatsAppCode('+201001234567', '12x456', configured, okFetch), { accepted: false, reason: 'invalid' });
  assert.equal(calls, 0, 'invalid/unconfigured requests never reach Meta');

  const rejectFetch: typeof fetch = async () => new Response('{"error":"private provider detail"}', { status: 400 });
  assert.deepEqual(await sendMetaWhatsAppCode('+201001234567', '123456', configured, rejectFetch), { accepted: false, reason: 'provider' });
  const brokenFetch: typeof fetch = async () => { throw new Error('private network detail'); };
  assert.deepEqual(await sendMetaWhatsAppCode('+201001234567', '123456', configured, brokenFetch), { accepted: false, reason: 'provider' });
});
