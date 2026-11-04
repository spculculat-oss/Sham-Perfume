import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { test } from 'node:test';
import {
  INQUIRY_PATH,
  inquireWorldFirst,
  signatureContent,
  signRequest,
  verifyResponse,
  walletsFromInquiry,
} from '../server/finance/worldFirstInquiry';

const keys = generateKeyPairSync('rsa', { modulusLength: 2048 });
const privateKey = keys.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
const publicKey = keys.publicKey.export({ type: 'spki', format: 'pem' }).toString();

test('a WorldFirst reply is usable only after its signature checks, and the account number is dropped', async () => {
  const body = JSON.stringify({
    result: { resultStatus: 'S', resultCode: 'SUCCESS' },
    accountBalances: [{
      accountNo: 'SECRET-ACCOUNT-99887766',
      currency: 'USD',
      availableBalance: { currency: 'USD', value: 250 },
      frozenBalance: { currency: 'USD', value: 0 },
    }],
  });
  assert.equal(JSON.stringify(walletsFromInquiry(JSON.parse(body))).includes('SECRET-ACCOUNT'), false);
  const time = '2026-11-01T09:00:00+00:00';
  const content = signatureContent('POST', INQUIRY_PATH, 'client-1', time, body);
  const signature = signRequest(content, privateKey);
  assert.equal(verifyResponse(content, `algorithm=RSA256, keyVersion=2, signature=${signature}`, publicKey), true);
  assert.equal(verifyResponse(content, `algorithm=RSA256, keyVersion=2, signature=${signature}`, publicKey.replace('A', 'B')), false);

  let called = 0;
  const ready = {
    WORLDFIRST_CLIENT_ID: 'client-1',
    WORLDFIRST_PRIVATE_KEY: privateKey,
    WORLDFIRST_PUBLIC_KEY: publicKey,
    WORLDFIRST_API_HOST: 'open-eu.worldfirst.com',
  };
  const verified = await inquireWorldFirst(ready, async (url) => {
    called += 1;
    assert.equal(url, `https://open-eu.worldfirst.com${INQUIRY_PATH}`);
    return new Response(body, { headers: { signature: `algorithm=RSA256, keyVersion=2, signature=${signature}`, 'response-time': time } });
  });
  assert.equal(called, 1);
  assert.equal(verified.inquiry, 'verified');
  assert.equal(verified.balancesLive, true);
  assert.equal(verified.sendsExternal, false);
  assert.equal(verified.receiving, 'not_issued');
  assert.equal(verified.wallets.find((row) => row.currency === 'USD')?.available, '2.50');
  assert.equal(verified.wallets.find((row) => row.currency === 'AUD')?.available, '0.00');
  assert.equal(JSON.stringify(verified).includes('SECRET-ACCOUNT'), false);

  const unread = await inquireWorldFirst({}, async () => { throw new Error('should not call'); });
  assert.equal(unread.inquiry, 'not_ready');
  assert.equal(unread.balancesLive, false);

  const tampered = await inquireWorldFirst(ready, async () => new Response(body, { headers: { signature: 'algorithm=RSA256, keyVersion=2, signature=aaaa', 'response-time': time } }));
  assert.equal(tampered.inquiry, 'unverified');
  assert.equal(tampered.balancesLive, false);
  assert.equal(tampered.wallets.find((row) => row.currency === 'USD')?.available, '0.00');
});
