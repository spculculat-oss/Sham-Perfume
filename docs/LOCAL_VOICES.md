# Optional local Shaheen speech

## What is implemented

- Existing device voices remain available. A saved native voice is now rechecked against the reply language; an English voice accidentally saved under Arabic cannot override the language guard.
- An additional **12 formant-synthesis profiles** (`m1`–`m7`, `f1`–`f5`) are available per supported engine language. These are timbre configurations of **one engine**, not twelve human speakers, recordings, voice clones, or neural models. Arabic is robotic standard-Arabic synthesis, not a natural Egyptian voice. Pitch/rate sliders are not counted as additional profiles.
- `src/data/localVoiceLanguages.json` records actual primary language tags returned by Spellophone 0.2.1 / eSpeak NG 1.52.0 `listVoices()`. Regional aliases are explicit. Unsupported languages offer no fabricated local option. This is not a claim of coverage of every UI language or dialect.
- Replies are synthesized from changing text, not prerecorded greetings. The same saved local selection is used for voice conversation and the reply's read-aloud button.
- Browser modules, the approximately 371 KB WASM, compressed core data and dictionaries load **only when a local voice is used**, from the site's own origin. Arabic's dictionary is about 287 KB compressed; the initialization also loads the engine's default English dictionary. Other language dictionaries load on demand. No paid service, API key, remote synthesis endpoint, or microphone is used by this engine. Browser speech recognition and some native voices have their own separate network behavior.
- Synthesis runs in a separate worker using a reusable engine instance; playback uses Web Audio unlocked by a visitor action. Cancel/interrupt/stop terminates synthesis, clears timers and stops audio. Preview failures and stalled playback settle rather than leaving the conversation permanently speaking. Failures retain the written reply and show the existing speech-error UI; **no silent switch to a network voice** is made.
- Local speech currently has sentence/chunk progress, not word-boundary timestamps. The very short native loading acknowledgement is suppressed for a local selection so it cannot suddenly speak in another voice/language.
- Native speech now keeps its utterance alive and uses a bounded watchdog so a missing completion event cannot leave the UI permanently speaking. A timed-out engine is cancelled and the written reply stays available.

## Build / paths

`dev`, `build`, and `build:pages` call `scripts/prepare-local-voices.mjs`. This copies the exact Bun-locked npm distribution into ignored `public/voice-engine/` (then the static build output); do not commit generated binaries. The worker and engine URL honor Vite `BASE_URL`, including `/Sham-Perfume/` on Pages. Ordinary visits do not download the engine. First use depends on the visitor's network; subsequent requests may use browser HTTP caching. This does **not** promise fully offline service-worker installation.

The dependency's upstream Node API targets Node 24+. This app uses its **browser executable**, served as unmodified static files; the server never imports its Node API. Build copying and the local synthesis smoke tests have also been checked under this project's Node 22 environment. Rebuilding the engine from its source requires the upstream pinned toolchain, not the site's Node 22 build tools.

## Third-party licensing / source

The optional executable `@spelling-creator/spellophone@0.2.1` / eSpeak NG 1.52.0 is **GPL-3.0-or-later**, not MIT or public domain. It is kept unmodified as a separately loaded executable outside the main application bundle. The picker links its license and source/build guide. Complete source archives are intentionally retained in `vendor/voice-sources/`, hash-verified at build time and published beside the binary, at no extra charge:

- `voice-engine/LICENSE.txt` — full GPL license
- `voice-engine/NOTICE.txt` — attribution and component versions
- `voice-engine/BUILD-SOURCE.md` — pinned sources, build guide, checksums
- `voice-engine/source/spellophone-0.2.1.tar.gz` — exact wrapper/bridge source, patches, build scripts and pinned toolchain
- `voice-engine/source/espeak-ng-1.52.0.tar.gz` — matching engine source specified by its vendor manifest
- `voice-engine/source/localVoice.worker.ts`, `localVoiceCatalog.ts`, `localVoiceLanguages.json` — local speech worker/catalog source

Source archives are not downloaded by speech playback. See `vendor/voice-sources/README.md` for provenance, exact hashes and rebuild instructions. This replaces the initially evaluated older `espeak-ng@1.0.2` binary whose underlying source revision was unspecified; that dependency and its assets are no longer used. This component notice does not purport to relicense unrelated application code.

## Verification

```sh
npm run lint
npm test
npm run build
npm run build:pages
npm run check:pages
# Start npm run dev; provide a separately installed Chromium:
BROWSER_EXECUTABLE=/path/to/chromium npm run test:voices-browser
# Built Pages worker/base URL smoke test:
VOICE_BASE_URL=http://localhost:4173/Sham-Perfume/ \
VOICE_WORKER_PATH=assets/localVoice.worker-<build-hash>.js \
BROWSER_EXECUTABLE=/path/to/chromium npm run test:voices-browser
```

Unit tests synthesize and validate distinct nonempty Arabic RIFF/WAVE output for all twelve configured profiles, test language aliases and reject cross-language/tampered selections. Browser checks exercise actual worker synthesis, WAV decoding/playback, sequential Arabic chunks, cancellation during audio, error completion, and optional-package lazy loading. Headless success is **not** a subjective listening test, a microphone interruption accuracy benchmark, or certification on Safari/iOS/Android. Real-device listening and microphone/audio-session checks remain important before release.
