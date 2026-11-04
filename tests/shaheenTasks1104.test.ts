import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { acceptLoginGate, isExpectedLoginGate, journeyRowOk } from '../scripts/shaheen-manus/loginGate';
import { cleanTour, tourPrompt } from '../scripts/shaheen-manus/missions';

// #462 — the visitor tour flagged «checkout» as fallen because the site asked for sign-in before paying.
// Payment only after a real verified account is the site's own rule (#311), so that stop is the journey working.
test('#462 — a checkout that stops at the sign-in window is the designed journey, not a fallen step', () => {
  const note = 'الانتقال إلى صفحة الدفع، لكن النافذة طلبت تسجيل الدخول قبل الدفع؛ STOP ولم يتم الدفع أو إدخال بطاقة.';
  assert.equal(isExpectedLoginGate({ step: 'checkout', ok: false, noteAr: note }), true);
  assert.equal(journeyRowOk({ step: 'checkout', ok: false, noteAr: note }), true);
  assert.equal(acceptLoginGate({ step: 'checkout', ok: false, noteAr: note }).ok, true);

  // A real fault is still a fault, and other steps are never excused.
  assert.equal(journeyRowOk({ step: 'checkout', ok: false, noteAr: 'نافذة تسجيل الدخول طلعت فاضية ومش شغالة' }), false);
  assert.equal(journeyRowOk({ step: 'checkout', ok: false, noteAr: 'صفحة الدفع مفتحتش خالص' }), false);
  assert.equal(journeyRowOk({ step: 'cart', ok: false, noteAr: 'طلب تسجيل الدخول' }), false);

  const tour = cleanTour({ summaryAr: 'جولة', score: 80, journey: [{ step: 'checkout', ok: false, seconds: 4, noteAr: note }], issues: [] }, '2026-11-04T10:00:00Z');
  assert.equal(tour?.journey[0]?.ok, true);
  assert.match(tourPrompt(), /sign in before paying[^]*ok: true/);
});

// #463 — the home page was the slowest section in the maneuver: its first visit pulled ~3.8 MB of photos alone
// (each 1376px picture saved at ~800 KB). Photos are now compressed; this budget keeps them that way.
test('#463 — no site photo is heavier than 300 KB, so the first page stays light on a phone', () => {
  const dir = new URL('../src/assets/images/', import.meta.url).pathname;
  const heavy = readdirSync(dir)
    .filter((f) => /\.(jpe?g|png|webp)$/i.test(f))
    .map((f) => ({ f, kb: Math.round(statSync(join(dir, f)).size / 1024) }))
    .filter((x) => x.kb > 300);
  assert.deepEqual(heavy, [], `compress these photos: ${heavy.map((x) => `${x.f} ${x.kb}KB`).join(', ')}`);
});
