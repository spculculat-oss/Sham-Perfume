import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

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
      outDir: pages ? 'docs' : 'dist',
    },
    plugins: [react(), tailwindcss()],
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
