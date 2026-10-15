import assert from 'node:assert/strict';
import test from 'node:test';
import { corsOrigins, DEFAULT_CORS_ORIGINS } from '../server/cors';

test('CORS origin list: defaults, explicit lists, https only, exact origins, and "none"', () => {
  assert.deepEqual([...corsOrigins(undefined)], DEFAULT_CORS_ORIGINS);
  assert.deepEqual([...corsOrigins('')], DEFAULT_CORS_ORIGINS);
  assert.deepEqual([...corsOrigins('none')], []);
  assert.deepEqual([...corsOrigins('https://a.example/path/, http://insecure.example, not a url, http://localhost:5173')], ['https://a.example', 'http://localhost:5173']);
});
