import assert from 'node:assert/strict';
import { test } from 'node:test';
import { containsCardSecret, liveChip, stripeCardNetwork, verdictFromProvider } from '../src/utils/cardNetwork';
import { inspectCardEntry } from '../src/utils/paymentElement';

const SECRET = `sk_test_${'a'.repeat(20)}`;
const PUBLIC = `pk_test_${'b'.repeat(20)}`;

test('a card is active only after a live issuer acceptance, never from the number alone', () => {
  assert.equal(verdictFromProvider({ connected: false }).verdict, 'unconfirmed');
  assert.equal(verdictFromProvider({ connected: true, mode: 'test' }).verdict, 'unconfirmed');
  assert.equal(verdictFromProvider({ connected: true, mode: 'test', status: 'succeeded' }).verdict, 'dummy');
  assert.equal(verdictFromProvider({ connected: true, mode: 'live', status: 'succeeded', decline: 'card_declined' }).verdict, 'inactive');
  assert.equal(verdictFromProvider({ connected: true, mode: 'live', decline: 'expired_card' }).reason, 'EXPIRED');
  const accepted = verdictFromProvider({ connected: true, mode: 'live', status: 'succeeded' });
  assert.equal(accepted.verdict, 'active');
  assert.equal(accepted.reason, 'ISSUER_ACCEPTED');
  const local = inspectCardEntry('4916338506082832', '12/30', new Date('2026-10-21'));
  assert.equal(liveChip(local.verdict, verdictFromProvider({ connected: false })), 'none');
  assert.equal(liveChip('dummy', verdictFromProvider({ connected: false })), 'dummy');
  assert.equal(liveChip('expired', verdictFromProvider({ connected: false })), 'inactive');
  assert.equal(liveChip('format_ok', accepted), 'active');
});

test('the network check refuses a card number and does not treat a partial key as connected', () => {
  assert.equal(containsCardSecret('4242 4242 4242 4242'), true);
  assert.equal(containsCardSecret('cvc 123'), true);
  assert.equal(containsCardSecret('connected false'), false);
  assert.equal(stripeCardNetwork({}), undefined);
  assert.equal(stripeCardNetwork({ STRIPE_SECRET_KEY: SECRET }), undefined);
  assert.equal(stripeCardNetwork({ STRIPE_SECRET_KEY: SECRET, STRIPE_PUBLISHABLE_KEY: 'pk_live_' + 'b'.repeat(20) }), undefined);
  const cfg = stripeCardNetwork({ STRIPE_SECRET_KEY: SECRET, STRIPE_PUBLISHABLE_KEY: PUBLIC });
  assert.equal(cfg?.mode, 'test');
  assert.equal(JSON.stringify(cfg).includes(SECRET), false);
});
