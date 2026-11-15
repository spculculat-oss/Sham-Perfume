import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { CODE_MAP_FILE, CODE_MAP_ROOTS, CODE_MAP_SKIP, CODE_MAP_SOURCE, codeMapEntry, type CodeMap } from './src/utils/codeMap';

/** «خريطة الكود» for Shaheen's coding work in the owner's room (src/utils/codeMap.ts), from the code being built. */
function buildCodeMap(root: string): CodeMap {
  const files: CodeMap['files'] = [];
  const walk = (dir: string) => {
    let names: string[] = [];
    try { names = readdirSync(dir); } catch { return; }
    for (const name of names.sort()) {
      const full = join(dir, name);
      const path = relative(root, full).split('\\').join('/');
      if (CODE_MAP_SKIP.test(`${path}/`) || CODE_MAP_SKIP.test(path)) continue;
      let info;
      try { info = statSync(full); } catch { continue; }
      if (info.isDirectory()) walk(full);
      else if (CODE_MAP_SOURCE.test(name) && info.size < 2_000_000) files.push(codeMapEntry(path, readFileSync(full, 'utf8')));
    }
  };
  for (const top of CODE_MAP_ROOTS) walk(join(root, top));
  return { v: 1, files };
}
function codeMapPlugin(root: string): Plugin {
  return {
    name: 'sham-code-map',
    generateBundle() { this.emitFile({ type: 'asset', fileName: CODE_MAP_FILE, source: JSON.stringify(buildCodeMap(root)) }); },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url || !req.url.split('?')[0]!.endsWith(`/${CODE_MAP_FILE}`)) return next();
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify(buildCodeMap(root)));
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const pages = mode === 'pages';
  const pagesBase = process.env.PAGES_BASE_PATH || '/Sham-Perfume/';

  if (pages && (!pagesBase.startsWith('/') || !pagesBase.endsWith('/') || pagesBase.includes('//'))) {
    throw new Error('PAGES_BASE_PATH must be a path such as /Sham-Perfume/ or /.');
  }

  return {
    // Project Pages lives below the repository name, not the domain root.
    base: pages ? pagesBase : '/',
    build: {
      // The Pages build has its own folder, never stored in git (docs/ keeps the hand-written legal and design
      // documents: Vite empties its output folder, and the importer's legal guard reads docs/legal).
      outDir: pages ? 'pages-dist' : 'dist',
    },
    plugins: [react(), tailwindcss(), codeMapPlugin(fileURLToPath(new URL('.', import.meta.url)))],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('.', import.meta.url)),
      },
    },
    server: {
      host: '0.0.0.0',
      allowedHosts: ['.e2b.app'],
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
    preview: {
      host: '0.0.0.0',
      allowedHosts: ['.e2b.app'],
    },
  };
});
