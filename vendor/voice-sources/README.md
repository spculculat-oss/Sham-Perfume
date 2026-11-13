# Optional speech executable: license, corresponding source and build instructions

The separately loaded speech worker uses **Spellophone 0.2.1 / eSpeak NG 1.52.0**, licensed GPL-3.0-or-later. It generates robotic formant speech, not human recordings. The application communicates with this optional worker by messages (text in, WAV bytes out).

Unmodified upstream sources are mirrored here, and published beside the executable at `voice-engine/source/` with no login or extra charge. These source archives are intentionally retained in Git to make corresponding source available even when a third-party download is unavailable. They are **not** downloaded by speech playback.

| Archive | Origin | SHA-256 |
| --- | --- | --- |
| spellophone-0.2.1.tar.gz | https://codeload.github.com/Spelling-Creator/spellophone/tar.gz/6d51a872d54a773e4969d7130fdaed665b2d6d18 | `6702e673c93ea1d8d90300a162d64aaab9fdc23737068173ec54e0c0ca4c58c6` |
| espeak-ng-1.52.0.tar.gz | https://codeload.github.com/espeak-ng/espeak-ng/tar.gz/refs/tags/1.52.0 | `bb4338102ff3b49a81423da8a1a158b420124b055b60fa76cfb4b18677130a23` |

The first archive includes the TypeScript wrapper, C bridge, patches, vendor specification, package lockfile, pinned tool versions in `mise.toml`, and build scripts. Its `vendor/espeak-ng.json` specifies upstream tag **1.52.0**, supplied by the second archive. Preserve the upstream copyright and GPL notices. The full license is also served at `voice-engine/LICENSE.txt`.

## Rebuild the executable

Extract the Spellophone archive and follow its `README.md` and `apps/docs/docs/project/building.md`. Install the pinned tools using `mise install`, then `pnpm install --frozen-lockfile` and `pnpm build`. This compiles both the WASM and language data from source; the build scripts download the specified eSpeak tag, apply the included patches and use the pinned Emscripten SDK. For an offline source checkout, extract the supplied eSpeak archive at the vendor checkout location documented by `scripts/fetch-espeak.ts` (which normally uses a Git checkout at the pinned tag); SDK/compiler/tool installation is separate. A C compiler and the documented host build tools are needed. See the supplied build scripts for exact flags rather than relying on a prose reproduction.

## Local adaptation

The speech engine itself is unmodified. `scripts/prepare-local-voices.mjs` copies its browser entry point/core module, WASM module and packed language data from the exact Bun-locked npm distribution. It also verifies and copies these source archives, this build guide, the GPL license and a notice. The new separate worker carries a GPL-3.0-or-later SPDX notice; the small shared catalog/manifest utility is MIT-licensed (see `source/local-catalog-MIT.txt`) and both are published as readable source alongside the upstream archives. The catalog's relative JSON import refers to `source/localVoiceLanguages.json`, also supplied; in the application checkout it lives at `src/data/localVoiceLanguages.json`. The worker transport, validation and WAV encoding logic can be inspected or modified in those files. The repository's Vite configuration supplies the worker bundling step (`npm run build` or `npm run build:pages`).

This notice covers the optional speech component; it is not a claim to relicense unrelated parts of the site or third-party code.
