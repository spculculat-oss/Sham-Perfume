import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runPrecheck } from '../scripts/shaheen-council/precheck.ts';

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const NOW = Date.parse('2026-11-03T10:00:00Z');
const census = (extra: Record<string, unknown>) => ({ updatedAt: '2026-10-26T08:00:00Z', totals: { visits: 0, countriesCount: 0 }, ...extra });
const censusCheck = (report: unknown) => runPrecheck({ 'platform-census.json': report }, {}, NOW).bots.find((b) => b.id === 'census')!;

test('#421: the census robot that ran recently is not «late» just because no new real visits arrived', () => {
  const stale = censusCheck(census({}));
  assert.ok(stale.problems.some((p) => /متأخر/.test(p)), 'without checkedAt the old updatedAt still counts');
  const fresh = censusCheck(census({ checkedAt: '2026-11-03T07:00:00Z', liveLedger: 'reached' }));
  assert.ok(!fresh.problems.some((p) => /متأخر/.test(p)), fresh.problems.join(' | '));
  assert.notEqual(fresh.status, 'fail');
});

test('#421: an unreachable live ledger is reported honestly', () => {
  const c = censusCheck(census({ checkedAt: '2026-11-03T07:00:00Z', liveLedger: 'unreachable' }));
  assert.ok(c.problems.some((p) => /دفتر الزيارات الحي/.test(p)), c.problems.join(' | '));
});

test('#421: the census script stamps every run and keeps updatedAt for real visits only', () => {
  const src = read('scripts/state/census.mts');
  assert.match(src, /checkedAt: now\.toISOString\(\)/);
  assert.match(src, /liveLedger: liveReport \? 'reached' : apiBase \? 'unreachable' : 'not_configured'/);
});

test('#418/#419: the order window owns one history entry — back closes it without the app reacting', async () => {
  const pushes: unknown[] = [];
  let backs = 0;
  const history = {
    state: null as Record<string, unknown> | null,
    pushState(s: Record<string, unknown>) { pushes.push(s); this.state = s; },
    back() { backs += 1; this.state = null; },
  };
  (globalThis as { window?: unknown }).window = { history };
  const { checkoutOpened, checkoutClosed, popBelongsToCheckout } = await import('../src/utils/checkoutHistory.ts');

  // Phone back button while the window is open.
  checkoutOpened();
  assert.equal(pushes.length, 1);
  assert.equal(history.state?.modal, 'checkout');
  history.state = null; // the browser moved back
  assert.equal(popBelongsToCheckout(), true, 'the app ignores this back press');
  checkoutClosed();
  assert.equal(backs, 0, 'already off our entry — no extra back');
  assert.equal(popBelongsToCheckout(), false, 'the next real back belongs to the app again');

  // Closed with ✕: our entry is removed quietly.
  checkoutOpened();
  checkoutClosed();
  assert.equal(backs, 1);
  assert.equal(popBelongsToCheckout(), true);
  assert.equal(popBelongsToCheckout(), false);

  const app = read('src/App.tsx');
  assert.match(app, /if \(popBelongsToCheckout\(\)\) return;/);
  const store = read('src/components/Storefront.tsx');
  assert.match(store, /checkoutOpened\(\)/);
  assert.match(store, /checkoutClosed\(\)/);
});

test('#427/#422: no stray English in the Arabic footer and home cards', () => {
  const footer = read('src/components/Footer.tsx');
  assert.doesNotMatch(footer, /ar: '[^']*(Extrait|Sham Perfume Suite)/);
  const hub = read('src/components/HomeHub.tsx');
  assert.doesNotMatch(hub, /CAS Certified|Firebase/);
  assert.doesNotMatch(read('src/لغات/hubL10n.ts'), /ar: '[^']*(Firebase|CAS Certified)/);
  assert.doesNotMatch(read('src/لغات/hubL10n2.ts'), /ar: '[^']*Firebase/);
});
