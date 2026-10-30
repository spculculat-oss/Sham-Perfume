import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MemoryStore } from '../server/core/store';
import { WorldFirstRail } from '../server/finance/worldFirstRail';
import {
  prepareSaleSettlement,
  transmissionAllowed,
  worldFirstApiConfigured,
  worldFirstSnapshot,
} from '../src/bank/worldFirstRail';

test('a sale splits into receipt, purchase and profit, and nothing is sent', () => {
  const item = prepareSaleSettlement({
    saleId: 'sale-1001',
    currency: 'USD',
    customerPaidMinor: 15_000,
    merchantCostMinor: 10_000,
    at: '2026-10-26T00:00:00Z',
  });
  assert.equal(item.profitMinor, 5_000);
  assert.equal(item.marginMatchesPolicy, true);
  assert.equal(item.sent, false);
  assert.equal(item.externalRef, '');
  assert.deepEqual(item.legs.map((leg) => [leg.kind, leg.amountMinor, leg.sent]), [
    ['sale_receipt', 15_000, false],
    ['merchant_purchase', 10_000, false],
    ['platform_profit', 5_000, false],
  ]);
  assert.equal(transmissionAllowed(), false);
  assert.equal(JSON.stringify(item).includes('iban'), false);
});

test('WorldFirst acceptance does not issue receiving details or open sending', () => {
  const closed = worldFirstSnapshot(false, 0);
  const keyed = worldFirstSnapshot(true, 2);
  assert.equal(closed.account, 'owner_reported_accepted');
  assert.equal(closed.verifiedByProvider, false);
  assert.equal(closed.receiving, 'not_issued');
  assert.equal(closed.sendsExternal, false);
  assert.equal(keyed.api, 'keys_present');
  assert.equal(keyed.transmission, 'blocked');
  assert.equal(keyed.blockReason, 'RECEIVING_NOT_ISSUED');
  assert.equal(worldFirstApiConfigured({ WORLDFIRST_CLIENT_ID: 'id' }), false);
  assert.equal(worldFirstApiConfigured({ WORLDFIRST_CLIENT_ID: 'id', WORLDFIRST_PRIVATE_KEY: 'key' }), true);
});

test('the queue refuses an account number and replays the same sale without sending', async () => {
  const rail = new WorldFirstRail(new MemoryStore(), () => '2026-10-26T00:00:00Z', {});
  await assert.rejects(rail.queue({ saleId: 'sale-1001', currency: 'USD', customerPaid: '150', merchantCost: '100', iban: 'GB00TEST' }), { code: 'SECRET' });
  const first = await rail.queue({ saleId: 'sale-1001', currency: 'USD', customerPaid: '150', merchantCost: '100' });
  const again = await rail.queue({ saleId: 'sale-1001', currency: 'USD', customerPaid: '150', merchantCost: '100' });
  assert.equal(again.id, first.id);
  assert.equal(again.sent, false);
  await assert.rejects(rail.queue({ saleId: 'sale-1001', currency: 'USD', customerPaid: '180', merchantCost: '100' }), { code: 'CONFLICT' });
  const snap = await rail.snapshot();
  assert.equal(snap.queued, 1);
  assert.equal(snap.sendsExternal, false);
  assert.equal(JSON.stringify(snap).match(/\d{8,}/), null);
});
