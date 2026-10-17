import test from 'node:test';
import assert from 'node:assert/strict';
import { isStaleBundleError } from '../src/utils/lazyRetry.tsx';

test('a bundle renamed by a new publish is recognised in every browser (never a blank page)', () => {
  for (const message of [
    'Failed to fetch dynamically imported module: https://spculculat-oss.github.io/Sham-Perfume/assets/CommunityApp-O9-ycOm3.js', // Chrome
    'error loading dynamically imported module: https://x/assets/AdminApp-1.js', // Firefox
    'Importing a module script failed.', // Safari
    "Expected a JavaScript module script but the server responded with a MIME type of \"text/html\"",
    'Unable to preload CSS for /assets/CommunityApp.css',
  ]) assert.equal(isStaleBundleError(new TypeError(message)), true, message);
  for (const message of ['Failed to fetch', 'Cannot read properties of undefined (reading \'name\')', 'NETWORK'])
    assert.equal(isStaleBundleError(new Error(message)), false, message);
});
