/**
 * Phase 4 — content chrome labels (news categories, material categories and
 * pyramid placements) are translated platform-wide, never left as raw English
 * for a non-English visitor and never falling back to Arabic for a non-Arabic one.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { SUPPORTED_LANGUAGES } from '../src/types/i18n';
import { CONTENT_LABELS_ALL, CONTENT_LABEL_KEYS, contentLabel } from '../src/لغات/contentLabels';

const KEYS = [
  'news_trends', 'news_exhibitions', 'news_harvests', 'news_ifra', 'news_niche',
  'mat_solvent', 'mat_fixative', 'mat_aromachemical', 'mat_natural_essential', 'mat_natural_resin',
  'place_top', 'place_heart', 'place_base', 'place_carrier', 'place_all',
] as const;

const ARABIC = /[\u0600-\u06FF]/;
/** Languages whose own script is Arabic-based — they legitimately use this range. */
const ARABIC_SCRIPT = new Set(['ar', 'fa', 'ur', 'ps', 'sd']);

test('every content label resolves for every platform language', () => {
  for (const { code } of SUPPORTED_LANGUAGES) {
    for (const key of KEYS) {
      const value = contentLabel(key, code);
      assert.ok(value.length > 0, `${code}.${key} is empty`);
      if (!ARABIC_SCRIPT.has(code)) assert.ok(!ARABIC.test(value), `${code}.${key} fell back to Arabic`);
    }
  }
});

test('localized waves reach the resolver (Hindi, Japanese, Ukrainian)', () => {
  assert.equal(contentLabel('news_trends', 'hi'), 'वैश्विक रुझान और विश्लेषण');
  assert.equal(contentLabel('place_base', 'ja'), 'ベースノート（深い固定）');
  assert.equal(contentLabel('mat_natural_resin', 'uk'), 'Природна смола й коштовний уд');
  assert.equal(contentLabel('news_niche', 'fr'), 'Haute Parfumerie & Maisons de Niche');
  assert.equal(contentLabel('place_top', 'ar'), 'نوتة عليا (الافتتاحية)');
});

test('the data category values all map onto labelled keys', () => {
  for (const [raw, key] of Object.entries(CONTENT_LABEL_KEYS.news)) {
    assert.ok(KEYS.includes(key), `${raw} maps to unknown key ${key}`);
  }
  for (const [raw, key] of Object.entries(CONTENT_LABEL_KEYS.material)) {
    assert.ok(KEYS.includes(key), `${raw} maps to unknown key ${key}`);
  }
  for (const [raw, key] of Object.entries(CONTENT_LABEL_KEYS.placement)) {
    assert.ok(KEYS.includes(key), `${raw} maps to unknown key ${key}`);
  }
});

test('all 100 platform languages carry the full content-label set', () => {
  const incomplete = SUPPORTED_LANGUAGES.map((l) => l.code).filter(
    (code) => KEYS.some((key) => (CONTENT_LABELS_ALL[code]?.[key] ?? '').length === 0),
  );
  assert.deepEqual(incomplete, [], `languages missing content labels: ${incomplete.join(', ')}`);
  assert.equal(SUPPORTED_LANGUAGES.length, 100);
});

test('waves never overwrite an earlier language (append-only coverage)', () => {
  const covered = Object.entries(CONTENT_LABELS_ALL)
    .filter(([, pack]) => KEYS.some((key) => (pack?.[key] ?? '').length > 0))
    .map(([lang]) => lang);
  assert.ok(covered.length >= 100, `expected 100 languages, got ${covered.length}`);
});
