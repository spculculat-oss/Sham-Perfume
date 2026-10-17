import { build } from 'esbuild';
import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

// Explicit Build Output API v3: Vite's dist alone does not deploy the Express API.
const root = new URL('../', import.meta.url);
const output = new URL('.vercel/output/', root);
const functionDirectory = new URL('functions/api.func/', output);
await rm(output, { recursive: true, force: true });
await mkdir(functionDirectory, { recursive: true });
await cp(new URL('dist/', root), new URL('static/', output), { recursive: true });

// No TypeScript compiler invocation by Vercel, Vite server dependency, or node_modules
// lookup at runtime. Provider credentials remain runtime environment variables.
await build({
  absWorkingDir: fileURLToPath(root),
  entryPoints: ['server/vercel-entry.cts'],
  outfile: fileURLToPath(new URL('index.cjs', functionDirectory)),
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'cjs',
  tsconfig: fileURLToPath(new URL('tsconfig.json', root)),
  logLevel: 'info',
});
await writeFile(new URL('.vc-config.json', functionDirectory), JSON.stringify({
  runtime: 'nodejs22.x', handler: 'index.cjs', launcherType: 'Nodejs', maxDuration: 60, supportsResponseStreaming: true,
}, null, 2));
// The second Vercel project (sham-perfume.vercel.app) is not used: no keys, no database. Anyone who lands
// on it is sent to the main site, and scripts/vercel-ignore.sh stops it from rebuilding on every update.
const BACKUP_HOST = process.env.SHAM_BACKUP_HOST || 'sham-perfume.vercel.app';
const MAIN_SITE = (process.env.SHAM_MAIN_SITE || 'https://sham-perfume-49bf.vercel.app').replace(/\/+$/, '');
await writeFile(new URL('config.json', output), JSON.stringify({
  version: 3,
  routes: [
    { src: '/(.*)', has: [{ type: 'host', value: BACKUP_HOST }], status: 307, headers: { Location: `${MAIN_SITE}/$1` } },
    // API requests must never fall through to the SPA or a static 404.
    { src: '/api(?:/.*)?', dest: '/api' },
    { handle: 'filesystem' },
    { src: '/assets/.*', status: 404 },
    { src: '/.*', dest: '/index.html' },
  ],
}, null, 2));
console.log('Vercel output ready: static React site + isolated Node.js API function.');
