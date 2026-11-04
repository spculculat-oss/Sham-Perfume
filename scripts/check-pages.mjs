import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

const output = new URL('../pages-dist/', import.meta.url);
const base = process.env.PAGES_BASE_PATH || '/Sham-Perfume/';
const html = await readFile(new URL('index.html', output), 'utf8');
const fallback = await readFile(new URL('404.html', output), 'utf8');

assert.equal(fallback, html, '404.html must match the current build, not an older bundle.');

// Search Console verification: the file Google issued must be served verbatim at the site root.
const verification = await readFile(new URL('google7ef3d5aa6cf98197.html', output), 'utf8');
assert.equal(verification, 'google-site-verification: google7ef3d5aa6cf98197.html', 'Search Console verification file is missing or altered.');
await access(new URL('.nojekyll', output));
await access(new URL('media/index.html', output));
await access(new URL('og/concentration.png', output));
await access(new URL('og/pin-concentration.png', output));
assert.ok(!html.includes('/src/main.tsx'), 'Pages must serve built JavaScript, not TypeScript source.');

const assets = [...html.matchAll(/(?:src|href)="([^"]+\.(?:js|css))"/g)].map((match) => match[1]);
assert.ok(assets.some((asset) => asset.endsWith('.js')), 'Missing JavaScript entry.');
assert.ok(assets.some((asset) => asset.endsWith('.css')), 'Missing stylesheet.');

for (const asset of assets) {
  assert.ok(asset.startsWith(`${base}assets/`), `Asset uses the wrong Pages base path: ${asset}`);
  await access(new URL(asset.slice(base.length), output));
}

// When the static build is wired to a deployed API, the URL must actually be in the bundle.
const apiBase = process.env.VITE_API_BASE_URL?.trim();
let apiNote = 'no API server (server features disabled)';
if (apiBase && /^https:\/\//.test(apiBase)) {
  const origin = new URL(apiBase).origin;
  const js = await Promise.all(assets.filter((a) => a.endsWith('.js')).map((a) => readFile(new URL(a.slice(base.length), output), 'utf8')));
  assert.ok(js.some((code) => code.includes(origin)), `VITE_API_BASE_URL (${origin}) is missing from the Pages bundle.`);
  apiNote = `API ${origin}`;
}

console.log(`Pages build verified: ${assets.length} entry assets, base ${base}, 404 fallback and .nojekyll, ${apiNote}.`);
