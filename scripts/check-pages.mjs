import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

const output = new URL('../docs/', import.meta.url);
const base = process.env.PAGES_BASE_PATH || '/Sham-Perfume/';
const html = await readFile(new URL('index.html', output), 'utf8');
const fallback = await readFile(new URL('404.html', output), 'utf8');

assert.equal(fallback, html, '404.html must match the current build, not an older bundle.');
await access(new URL('.nojekyll', output));
assert.ok(!html.includes('/src/main.tsx'), 'Pages must serve built JavaScript, not TypeScript source.');

const assets = [...html.matchAll(/(?:src|href)="([^"]+\.(?:js|css))"/g)].map((match) => match[1]);
assert.ok(assets.some((asset) => asset.endsWith('.js')), 'Missing JavaScript entry.');
assert.ok(assets.some((asset) => asset.endsWith('.css')), 'Missing stylesheet.');

for (const asset of assets) {
  assert.ok(asset.startsWith(`${base}assets/`), `Asset uses the wrong Pages base path: ${asset}`);
  await access(new URL(asset.slice(base.length), output));
}

console.log(`Pages build verified: ${assets.length} entry assets, base ${base}, 404 fallback and .nojekyll.`);
