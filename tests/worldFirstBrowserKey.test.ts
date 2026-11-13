import assert from 'node:assert/strict';
import { test } from 'node:test';
import { prepareBrowserLinkKey } from '../src/bank/worldFirstBrowserKey';
import { signRequest, signatureContent, verifyResponse } from '../server/finance/worldFirstInquiry';

test('a browser WorldFirst key signs the same way the server expects, and is not an account number', async () => {
  const issued = await prepareBrowserLinkKey();
  assert.match(issued.privateKeyPem, /BEGIN PRIVATE KEY/);
  assert.match(issued.publicKeyPem, /BEGIN PUBLIC KEY/);
  assert.equal(issued.publicKeyBody.includes('BEGIN'), false);
  const content = signatureContent('POST', '/amsin/api/v1/business/account/inquiryBalance', 'client-1', '2026-11-13T22:00:00+00:00', '{}');
  const signature = signRequest(content, issued.privateKeyPem);
  assert.equal(verifyResponse(content, `algorithm=RSA256, keyVersion=2, signature=${signature}`, issued.publicKeyPem), true);
  assert.equal(JSON.stringify({ publicKeyBody: issued.publicKeyBody }).includes('BEGIN PRIVATE'), false);
});
