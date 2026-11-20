import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// «وصل الجديد من جوجل استوديو من غير ما نلمس القديم»: the Studio's own additions that came into
// this repository must stay wired to the site's existing rules (one currency, one vault, one checkout).

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('the Studio price helper exists beside our own money rule and never replaces it', async () => {
  const meta = read('src/utils/countryCurrencyMeta.ts');
  assert.match(meta, /export function formatProductPriceInCountry\(/);
  // Our rule (#169) stays: the store's currency is the only currency, so the banner never disagrees with the cart.
  assert.match(meta, /const currency = currencyFor\(code, BUNDLED_FX\);/);
  assert.match(meta, /const sameMoney = known\?\.currency === currency;/);
  const { formatProductPriceInCountry } = await import('../src/utils/countryCurrencyMeta');
  const formatted = formatProductPriceInCountry(1000, 'EG', 'ar');
  assert.ok(formatted.formatted.trim().length > 0, 'a price is shown');
  assert.equal(formatted.currency, 'EGP');
});

test('the payment vault window keeps our sign-in hook next to the Studio card wallet', async () => {
  const modal = read('src/components/PaymentEnvironmentModal.tsx');
  assert.match(modal, /onRequireAuth\?: \(\) => void;/, 'our callers still get the sign-in request');
  assert.match(modal, /onSelectMethod\?: \(method: SavedPaymentMethod\) => void;/, 'and the Studio can hand a saved card back');
  assert.match(modal, /local: \{ nameAr:/, 'the store’s own direct transfer has a face in the wallet list too');
  const { PAYMENT_WINDOW_NOTE } = await import('../src/components/PaymentEnvironmentModal');
  assert.match(PAYMENT_WINDOW_NOTE, /no charge/i, 'saving or picking a card never marks an order paid');
});

test('the storefront hands a picked saved card back to the page without charging', () => {
  const store = read('src/components/Storefront.tsx');
  assert.match(store, /selectableMode/);
  assert.match(store, /onSelectMethod=\{\(method\) => \{/);
  assert.match(store, /setChosenSavedMethod\(method\);/);
  assert.match(store, /data-testid="store-chosen-method"/);
});

test('the sales-by-category chart stays in the merchant and admin desks and is localised', () => {
  for (const file of ['src/community/MerchantPortal.tsx', 'src/components/AdminMerchantManagement.tsx', 'src/components/Storefront.tsx']) {
    assert.match(read(file), /StoreSalesCategoryChart/, `${file} shows the sales chart`);
  }
  const chart = read('src/components/StoreSalesCategoryChart.tsx');
  assert.match(chart, /formatLocalizedNumber/, 'the numbers follow the page language');
});

test('the Studio poll comes with its own tables, server rules and a bar UI beside the old composer', async () => {
  const db = read('server/community/db.ts');
  assert.match(db, /CREATE TABLE IF NOT EXISTS post_polls/);
  assert.match(db, /CREATE TABLE IF NOT EXISTS poll_votes/);
  assert.match(db, /poll_votes_post/, 'votes are indexed by post');
  const social = read('server/community/social.ts');
  assert.match(social, /LEFT JOIN post_polls pp ON pp\.post_id = p\.id/, 'one join, not a second query per post');
  assert.match(social, /export async function votePoll\(/, 'a vote is a server rule, never a client counter');
  assert.match(social, /ON CONFLICT \(post_id, user_id\) DO UPDATE/, 'one changeable vote per member');
  const router = read('server/community/router.ts');
  assert.match(router, /router\.post\('\/community\/posts\/:id\/poll\/vote', member\(/, 'voting needs a member, never an anonymous visitor');
  const portal = read('src/community/SocialPortal.tsx');
  assert.match(portal, /poll: pollDraft/, 'the composer sends the poll beside the existing body/image/recipe fields');
  assert.match(portal, /<PostPollBlock poll=\{post\.poll\}/, 'existing cards render the poll without replacing anything');
  assert.match(portal, /poll\/vote`/, 'the bar UI votes through the new endpoint');
});

test('the Studio audio tools sit on our own server route, not a copy of the Studio server', async () => {
  const server = read('server/studioVoice.ts');
  assert.match(server, /router\.post\('\/transcribe'/, 'a recording is transcribed server-side');
  assert.match(server, /router\.post\('\/music'/, 'music is generated server-side');
  assert.match(server, /router\.post\('\/tts'/, 'speech uses the same human voice as the chat');
  assert.match(server, /GEMINI_API_KEY/, 'the key already on the server, never a second one');
  assert.match(server, /PAID_KEY_REQUIRED/, 'a paid-only key is explained instead of retried forever');
  const app = read('server/app.ts');
  assert.match(app, /app\.use\('\/api\/ai', createStudioVoiceRouter\(\)\)/);
  assert.match(app, /app\.use\('\/api\/ai', express\.json\(\{ limit: '8mb' \}\)\)/, 'a recording fits in the body limit');
  // The three studio components call that route through apiUrl (the Pages build calls the API cross-origin).
  for (const path of ['src/components/AudioTranscribeStudio.tsx', 'src/components/FragranceMusicStudio.tsx', 'src/components/VoiceTranscribeButton.tsx']) {
    assert.match(read(path), /apiUrl\('\/api\/ai\//, path);
  }
  const hub = read('src/components/StudioVoiceHub.tsx');
  assert.match(hub, /<AudioTranscribeStudio/);
  assert.match(hub, /<FragranceMusicStudio/);
  assert.match(hub, /<VoiceTranscribeButton/);
  const page = read('src/App.tsx');
  assert.match(page, /activeTab === 'studio_voice'/, 'the tab is reachable');
  assert.match(read('src/components/Header.tsx'), /id: 'studio_voice'/);
});

test('the Studio cropper cuts the profile cover before it is uploaded, beside the old upload path', async () => {
  const page = read('src/community/ProfilePage.tsx');
  assert.match(page, /from '\.\/ImageCropperModal'/);
  assert.match(page, /<ImageCropperModal/, 'the cover is cropped on the device first');
  assert.match(page, /type="file" accept="image\/\*"[^>]*profile-banner-file/, 'the same device-picture button still opens it');
  assert.match(page, /export async function fittedBanner\(/, 'the cropped picture still fits the server’s ceiling');
  const { fittedBanner, BANNER_MAX_CHARS } = await import('../src/community/ProfilePage');
  assert.equal(await fittedBanner('small.jpg'), 'small.jpg', 'a picture already inside the ceiling is kept as it is');
  assert.equal(await fittedBanner('x'.repeat(BANNER_MAX_CHARS + 1)), '', 'without a canvas it says so instead of sending a picture too large');
});
