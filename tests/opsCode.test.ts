/**
 * «رمز خريطة التشغيل»: the Pages build gets only a slow salted hash of the owner's SHAM_OPS_CODE secret, and the
 * browser checks the code against it — right code in, wrong code out, the code itself never printed or bundled.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { parseOpsCode, verifyOpsCode } from '../src/utils/opsCode';
// @ts-expect-error — plain ESM build script without types
import { ITERATIONS, opsCodeSpec } from '../scripts/ci/ops-code-hash.mjs';

test('the build hash and the browser check agree', async () => {
  const spec = parseOpsCode(opsCodeSpec('map-code-for-tests-2026'));
  assert.ok(spec); assert.equal(spec.iterations, ITERATIONS); assert.ok(ITERATIONS >= 300_000, 'slow enough to resist guessing');
  assert.equal(await verifyOpsCode('map-code-for-tests-2026', spec), true);
  assert.equal(await verifyOpsCode('  map-code-for-tests-2026 ', spec), true, 'spaces around the code are ignored, like in the build');
  assert.equal(await verifyOpsCode('map-code-for-tests-2027', spec), false);
  assert.equal(await verifyOpsCode('', spec), false);
  assert.equal(await verifyOpsCode('anything', undefined), false, 'no code configured → nothing opens with it');
  // A fresh salt every build: same code, different hash.
  assert.notEqual(opsCodeSpec('map-code-for-tests-2026'), opsCodeSpec('map-code-for-tests-2026'));
});

test('malformed specs are refused', () => {
  for (const bad of [undefined, '', 'v1:310000:abc:def', 'v2:310000:AAAAAAAAAAAAAAAAAAAAAA:' + 'A'.repeat(43), 'plain-code', 42]) assert.equal(parseOpsCode(bad), undefined, String(bad));
});

test('the workflow passes the secret only to the hashing step, and the script never prints it', () => {
  const wf = readFileSync(new URL('../.github/workflows/pages.yml', import.meta.url), 'utf8');
  assert.equal((wf.match(/secrets\.SHAM_OPS_CODE/g) || []).length, 1);
  const step = wf.slice(wf.indexOf('- name: Operations map code'), wf.indexOf('- name: Build current source for Pages'));
  assert.match(step, /SHAM_OPS_CODE: \$\{\{ secrets\.SHAM_OPS_CODE \}\}/);
  assert.match(step, /node scripts\/ci\/ops-code-hash\.mjs/);
  assert.doesNotMatch(wf, /SHAM_ADMIN_TOKEN/, 'the public hash is never made from the server admin code');
  const script = readFileSync(new URL('../scripts/ci/ops-code-hash.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(script, /console\.log\([^)]*\$\{code\}/);
  assert.match(script, /VITE_OPS_CODE=\$\{opsCodeSpec\(code\)\}/);
});
