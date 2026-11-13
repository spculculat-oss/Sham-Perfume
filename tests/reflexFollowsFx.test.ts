import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { REFLEX } from '../src/utils/shaheenReflex';

test('the exchange-rate step rebuilds the instant answers (the importer was refused on 2026-10-28 for the drift)', () => {
  const fx = readFileSync(new URL('../scripts/shaheen-store/fx.mts', import.meta.url), 'utf8');
  assert.match(fx, /rebuildReflexFromFiles\(\)/);
});

test('the English instant answers name the country in English', () => {
  const eg = REFLEX.entries.find((e) => e.id === 'reflex-ship-EG');
  assert.ok(eg);
  assert.match(eg.answerEn, /to Egypt:/);
  for (const e of REFLEX.entries) assert.doesNotMatch(e.answerEn.split('\n')[0], /[\u0600-\u06FF]/, e.id);
});
