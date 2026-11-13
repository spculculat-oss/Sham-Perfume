import test from 'node:test';
import assert from 'node:assert/strict';
import { financeFailure } from '../scripts/shaheen-finance/explain';

test('the finance scheduler names every failure with a fixed, secret-free reason', () => {
  assert.match(financeFailure('ADMIN_NOT_CONFIGURED'), /SHAM_ADMIN_TOKEN is not set on Vercel/);
  assert.match(financeFailure('NO_ADMIN_TOKEN'), /GitHub Actions secrets/);
  assert.match(financeFailure('HTTP_401'), /differs/);
  assert.equal(financeFailure('HTTP_418'), 'HTTP_418: unexpected answer from the engine.');
});
