import { copyFile, writeFile } from 'node:fs/promises';

const output = new URL('../pages-dist/', import.meta.url);

// Absolute, base-aware asset URLs also work when Pages serves the 404 fallback.
await copyFile(new URL('index.html', output), new URL('404.html', output));
await writeFile(new URL('.nojekyll', output), '');
console.log('Prepared pages-dist/ for GitHub Pages (404 fallback and .nojekyll).');
