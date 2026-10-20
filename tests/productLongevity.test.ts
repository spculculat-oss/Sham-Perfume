import test from 'node:test';
import assert from 'node:assert/strict';
import { localLongevity } from '../src/لغات/longevity';

test('catalogue longevity is shown in the visitor language, never the raw English value', () => {
  assert.equal(localLongevity('Lasting (6-8 hours)', 'ar'), 'ثابت · ٦–٨ ساعات');
  assert.equal(localLongevity('Lasting (6-8 hours)', 'en'), 'Long-lasting · 6–8 hours');
  assert.equal(localLongevity('Moderate', 'ar'), 'متوسط');
  assert.match(localLongevity('Lasting (9-10 hours)', 'fr'), /^Longue · 9.10\sheures$/);
  assert.equal(localLongevity('Something new', 'ar'), 'Something new');
});
