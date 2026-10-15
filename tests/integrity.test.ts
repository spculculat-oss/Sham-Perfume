// Guards against merges built on a stale copy of the project (it happened with PR #26 and with the
// AI Studio sync): they silently drop languages, build scripts or whole features and break main.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { TRANSLATIONS } from '../src/utils/i18n';
import { SUPPORTED_LANGUAGES } from '../src/types/i18n';

const read = (file: string) => readFileSync(file, 'utf8');
const sourceFiles = (dir: string): string[] => readdirSync(dir).flatMap((name) => {
  const full = path.join(dir, name);
  return statSync(full).isDirectory() ? sourceFiles(full) : /\.tsx?$/.test(name) ? [full] : [];
});

test('package.json keeps every script the CI, Vercel, Pages and EdgeOne builds call', () => {
  const pkg = JSON.parse(read('package.json'));
  for (const script of ['dev', 'build', 'lint', 'test', 'build:pages', 'check:pages', 'build:vercel', 'test:vercel', 'check:edgeone', 'verify:keys', 'sync:vercel-env']) {
    assert.ok(pkg.scripts?.[script], `package.json lost the "${script}" script`);
  }
  assert.match(pkg.scripts.lint, /tsconfig\.app\.json/, 'lint must type-check the app too');
  assert.match(pkg.packageManager ?? '', /^bun@/, 'the project installs with bun (vercel.json, CI)');
  assert.equal(pkg.engines?.node, '22.x');
  for (const dep of ['express', 'react', 'leaflet']) assert.ok(pkg.dependencies?.[dep], `dependency ${dep} was removed`);
});

test('all 100 languages stay wired, each with its own dictionary', () => {
  assert.ok(SUPPORTED_LANGUAGES.length >= 100, `only ${SUPPORTED_LANGUAGES.length} languages are offered`);
  const missing = SUPPORTED_LANGUAGES.map((l) => l.code).filter((code) => !TRANSLATIONS[code] || !Object.keys(TRANSLATIONS[code]).length);
  assert.deepEqual(missing, [], 'languages without translations (an i18nExt import was dropped?)');
  assert.ok(Object.keys(TRANSLATIONS.ar).length > 150 && Object.keys(TRANSLATIONS.en).length > 150);
});

test('no visitor sees a raw translation key: every t() key without a fallback exists', () => {
  const missing: string[] = [];
  for (const file of sourceFiles('src')) {
    for (const call of read(file).matchAll(/\bt\(\s*['"]([a-z0-9_]+)['"]\s*(,\s*(?:[^()]|\([^()]*\))*?)?\)/g)) {
      const extraArgs = (call[2] ?? '').split(',').length - 1;
      if (extraArgs >= 2) continue; // t(key, lang, fallback) shows the fallback
      if (!(call[1] in TRANSLATIONS.en) && !(call[1] in TRANSLATIONS.ar)) missing.push(`${file}: ${call[1]}`);
    }
  }
  assert.deepEqual(missing, []);
});

test('the site still mounts its assistants and Shaheen media (images, videos, map)', () => {
  const app = read('src/App.tsx');
  for (const component of ['ShamAssistant', 'PerfumerAIChatbot', 'PerfumerMasterLabView', 'Header', 'Footer']) {
    assert.match(app, new RegExp(`<${component}\\b`), `App.tsx no longer renders <${component}>`);
  }
  for (const file of ['src/components/PerfumerAIChatbot.tsx', 'src/components/PerfumerMasterLabView.tsx']) {
    assert.match(read(file), /<ShaheenMedia\b/, `${file} no longer shows Shaheen's images/videos/map`);
  }
  assert.match(read('server/app.ts'), /app\.use\(\s*'\/api'\s*,\s*createMediaRouter\(/, 'the media API (/api/media) is no longer mounted');
});
