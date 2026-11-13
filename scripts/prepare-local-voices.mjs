/** Optional unmodified GPL speech executable and its corresponding source; no application-bundle imports. */
import { copyFile, cp, mkdir, readdir, readFile, writeFile, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const source = new URL('../node_modules/@spelling-creator/spellophone/', import.meta.url);
const target = new URL('../public/voice-engine/', import.meta.url);
// Remove only this generated directory so an older speech package cannot survive in a new build.
await rm(target, { recursive: true, force: true });
await mkdir(new URL('dist/', target), { recursive: true });
await mkdir(new URL('wasm/', target), { recursive: true });
for (const name of await readdir(new URL('dist/', source))) {
  if (name === 'browser.js' || /^core-[\w-]+\.js$/.test(name)) await copyFile(new URL(`dist/${name}`, source), new URL(`dist/${name}`, target));
}
for (const name of ['espeak-ng.js', 'espeak-ng.wasm']) await copyFile(new URL(`wasm/${name}`, source), new URL(`wasm/${name}`, target));
await cp(new URL('espeak-ng-data/', source), new URL('espeak-ng-data/', target), { recursive: true });
await copyFile(new URL('LICENSE', source), new URL('LICENSE.txt', target));
await mkdir(new URL('source/', target), { recursive: true });
const archives = {
  'espeak-ng-1.52.0.tar.gz': 'bb4338102ff3b49a81423da8a1a158b420124b055b60fa76cfb4b18677130a23',
  'spellophone-0.2.1.tar.gz': '6702e673c93ea1d8d90300a162d64aaab9fdc23737068173ec54e0c0ca4c58c6',
};
for (const [name, expected] of Object.entries(archives)) {
  const archive = new URL(`../vendor/voice-sources/${name}`, import.meta.url);
  const hash = createHash('sha256').update(await readFile(archive)).digest('hex');
  if (hash !== expected) throw new Error(`Voice source checksum mismatch: ${name}`);
  await copyFile(archive, new URL(`source/${name}`, target));
}
for (const name of ['localVoice.worker.ts', 'localVoiceCatalog.ts']) await copyFile(new URL(`../src/utils/${name}`, import.meta.url), new URL(`source/${name}`, target));
await copyFile(new URL('../src/data/localVoiceLanguages.json', import.meta.url), new URL('source/localVoiceLanguages.json', target));
await copyFile(new URL('../vendor/voice-sources/local-catalog-MIT.txt', import.meta.url), new URL('source/local-catalog-MIT.txt', target));
await copyFile(new URL('../vendor/voice-sources/README.md', import.meta.url), new URL('BUILD-SOURCE.md', target));
await writeFile(new URL('NOTICE.txt', target), `Optional synthetic speech engine: @spelling-creator/spellophone 0.2.1 and eSpeak NG 1.52.0. GPL-3.0-or-later.\nUnmodified upstream browser modules, WASM and language/voice data. No human recordings or cloned identities.\nFull license: LICENSE.txt. Complete pinned upstream source archives, local worker source and build instructions: source/ and BUILD-SOURCE.md on this same server, at no extra charge.\nSpellophone source commit: 6d51a872d54a773e4969d7130fdaed665b2d6d18.\neSpeak upstream source tag: 1.52.0.\n`);
console.log('Optional local speech prepared: dictionaries load only when used; license and corresponding source included.');
