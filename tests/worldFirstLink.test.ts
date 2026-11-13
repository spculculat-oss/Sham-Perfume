import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { test } from 'node:test';
import { MemoryStore } from '../server/core/store';
import { WorldFirstLink } from '../server/finance/worldFirstLink';
import { WorldFirstRail } from '../server/finance/worldFirstRail';
import { signRequest, signatureContent, verifyResponse } from '../server/finance/worldFirstInquiry';

test('the link key is issued once, never stored, and still signs', async () => {
  const store = new MemoryStore();
  const link = new WorldFirstLink(store, () => '2026-11-01T09:00:00Z', {});
  const issued = await link.prepare({});
  assert.equal(issued.reissued, true);
  assert.match(issued.publicKeyPem, /BEGIN PUBLIC KEY/);
  assert.match(issued.privateKeyPem || '', /BEGIN PRIVATE KEY/);
  assert.equal(issued.sendsExternal, false);
  assert.equal(issued.transmission, 'blocked');

  const stored = await store.get('shamWorldFirstLink', 'link');
  const storedJson = JSON.stringify(stored);
  assert.equal(storedJson.includes('BEGIN PRIVATE'), false);
  assert.equal(storedJson.includes(issued.privateKeyPem || 'missing'), false);
  assert.equal(stored?.privateFingerprint, issued.privateFingerprint);

  const content = signatureContent('POST', '/amsin/api/v1/business/account/inquiryBalance', 'client-1', '2026-11-01T09:00:00+00:00', '{}');
  const signature = signRequest(content, issued.privateKeyPem || '');
  assert.equal(verifyResponse(content, `algorithm=RSA256, keyVersion=2, signature=${signature}`, issued.publicKeyPem), true);

  const again = await link.prepare({});
  assert.equal(again.reissued, false);
  assert.equal('privateKeyPem' in again, false);
  assert.equal(again.privateFingerprint, issued.privateFingerprint);
  assert.equal(JSON.stringify(again).includes('BEGIN PRIVATE'), false);

  const rail = new WorldFirstRail(store, () => '2026-11-01T09:00:00Z', { WORLDFIRST_PRIVATE_KEY: issued.privateKeyPem, WORLDFIRST_CLIENT_ID: 'client-1' });
  const snap = await rail.snapshot();
  assert.equal(snap.link.prepared, true);
  assert.equal(snap.link.serverKey, 'matches');
  assert.equal(snap.api, 'keys_present');
  assert.equal(snap.receiving, 'not_issued');
  assert.equal(snap.sendsExternal, false);
  assert.equal(JSON.stringify(snap).includes('BEGIN PRIVATE'), false);
});

test('a portal sighting stores the region only, and an account number is refused', async () => {
  const store = new MemoryStore();
  const link = new WorldFirstLink(store, () => '2026-11-01T09:00:00Z', {});
  await assert.rejects(link.seen({ seenInPortal: true, region: 'SG', accountNameKind: 'partner_bank', iban: 'GB00TEST' }), { code: 'SECRET' });
  await assert.rejects(link.seen({ seenInPortal: true, region: 'SG', accountNameKind: 'owner', note: 'SECRET-ACCOUNT-99887766' }), { code: 'SECRET' });
  await assert.rejects(link.seen({ seenInPortal: false, region: 'SG', accountNameKind: 'owner' }), { code: 'NOT_SEEN' });
  await assert.rejects(link.seen({ seenInPortal: true, region: 'EG', accountNameKind: 'owner' }), { code: 'INVALID_REGION' });
  await assert.rejects(link.prepare({ rotate: false, privateKey: 'nope' }), { code: 'SECRET' });

  const seen = await link.seen({ seenInPortal: true, region: 'SG', accountNameKind: 'partner_bank' });
  assert.equal(seen.receiving, 'owner_seen_in_portal');
  assert.equal(seen.receivingRegion, 'SG');
  assert.equal(seen.sendsExternal, false);
  assert.equal(seen.transmission, 'blocked');
  const stored = JSON.stringify(await store.list('shamWorldFirstLink'));
  assert.equal(stored.includes('99887766'), false);
  assert.equal(/iban|accountNo|BEGIN PRIVATE/i.test(stored), false);

  const snap = await new WorldFirstRail(store, () => '2026-11-01T09:00:00Z', {}).snapshot();
  assert.equal(snap.receiving, 'owner_seen_in_portal');
  assert.equal(snap.verifiedByProvider, false);
  assert.equal(snap.transmission, 'blocked');
  assert.equal(snap.blockReason, 'RECEIVING_NOT_ISSUED');
});

test('a different server key is not treated as the prepared key', async () => {
  const store = new MemoryStore();
  const link = new WorldFirstLink(store, () => '2026-11-01T09:00:00Z', {});
  await link.prepare({});
  const other = generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
  const snap = await new WorldFirstRail(store, () => '2026-11-01T09:00:00Z', { WORLDFIRST_PRIVATE_KEY: other, WORLDFIRST_CLIENT_ID: 'client-1' }).snapshot();
  assert.equal(snap.link.serverKey, 'different');
  assert.equal(snap.sendsExternal, false);
  assert.equal(JSON.stringify(snap).includes('BEGIN PRIVATE'), false);
});
