# Shaheen local speech: follow-up inspection

Scope: the voice changes merged in PR #544, reviewed on `arena/9d43229f-sham-perfume` together with the latest available main. No generated runtime binaries, browser installation, secrets, or visitor recordings are committed by this audit.

## Confirmed defects and fixes

| Finding | Impact | Fix / regression evidence |
| --- | --- | --- |
| The floating chatbot and master lab discarded `readAloud`'s returned cancellation handle and only called `speechSynthesis.cancel()` | Stop, closing the chat, navigation, or changing language could leave the new local worker/Web Audio running. The old native-only availability check also hid local playback on a browser without native speech. | Both use `useReadAloud`, which owns cancellation for either engine, handles synchronous failures, ignores stale completion, stops on language/dialect changes and releases resources on unmount. Closing/hiding the chat, starting voice conversation and clearing history stop the reader. |
| Voice-mode hook teardown cancelled only the native speech queue | An active or still-loading local preview could survive unmount/navigation. Native watchdog timer/utterance could also remain retained. | Teardown now terminates the local player and clears native timer/utterance. Real Chromium hook tests check unmount while audio is playing and while a dictionary fetch is pending. |
| Local audio decoding had no watchdog | A decoder promise that never settled left the interface speaking indefinitely. | Decoding has a cancellable 10-second timeout; resume also has a 10-second timeout, synthesis 45 seconds, playback its duration plus 10 seconds. Fake-clock tests verify cleanup and exactly one failure. |
| A mobile audio context suspended during dictionary loading was immediately rejected | Otherwise valid audio could fail after the microphone/audio session changed. | Attempt bounded resume before starting decoded audio. Tested with simulated suspended/resumed and indefinitely blocked contexts. This is not real-iPhone certification. |
| Local player referenced mutable caller chunks and a mutable current audio source in completion callbacks | Caller mutations could change later spoken text; a stale ended event could disconnect a newer source. | Snapshot/validate chunks, bind each ended handler to its own source, reject empty/oversized chunks before worker creation. |
| Native read-aloud accepted late duplicate completion/error events from earlier chunks | Duplicate events could skip a chunk or end a newer utterance. Timeout/stop could notify completion before cancelling, potentially cancelling speech started by that completion handler. | Check current utterance identity; clear and cancel before calling completion; make stop idempotent and report timeout/synthesis failures. Voice-mode native chunk completion/error guards were tightened as well. |
| Vercel promotion used a project display name in `/v10/projects/{projectId}/promote/{deploymentId}` | The previous GitHub sync annotation recorded `404 not_found` from this endpoint, independently of build failure. | Resolve the immutable project id from the v9 project lookup; fail closed if absent. Fake Vercel now refuses promotion by name and verifies the id-only request. Reference: official Vercel SDK `src/funcs/projectsRequestPromote.ts` and `docs/models/requestpromoterequest.md` in <https://github.com/vercel/sdk>. |

## Reproduction and tests

The new local-player regression suite was run against the **shipped pre-audit player** in temporary, subsequently removed files: **4 failures / 9 passes**. The failing cases were mutable queue/stale ended events, hung decoding, resuming suspended audio, and validation before resource creation. The corrected player passes all 13 cases. Additional native-reader cases cover stale events, timeout ordering, repeated cancellation and synchronous synthesis exceptions.

```sh
npm run lint
npm test
npm run build:vercel
npm run test:vercel
npm run check:edgeone
npm run build:pages
npm run check:pages
npm run check:seo
# Start npm run dev and provide a separately installed Chromium:
BROWSER_EXECUTABLE=/path/to/chromium npm run test:voices-browser
BROWSER_EXECUTABLE=/path/to/chromium npm run test:voices-lifecycle
```

`test:voices-lifecycle` mounts the real React reader and conversation hooks in Chromium against Vite. It clicks real controls (without an autoplay-bypass flag), uses the actual worker/WASM/dictionary/audio pipeline, tracks worker termination and source stop, changes language, unmounts during playback/loading and injects an HTTP 503 for the Arabic dictionary. It deliberately does not request microphone permission. Its React module URLs are read from Vite's transformed entry to avoid mounting hooks with a duplicate React instance.

## Verification results in this checkout

- Type checks and `git diff --check`: passed.
- Full suite: **1,674 passed, 0 failed**. Focused speech/deployment regression group: **27 passed, 0 failed**.
- `build:vercel` plus its isolated function/route tests: passed (**11 artifact tests**).
- Pages build/path checks and the built worker/WAV browser smoke: passed.
- Real user-click hook lifecycle/dictionary-failure browser checks and the original local voice playback smoke: passed.
- SEO check: **1,178 pages, 0 critical, 0 major**, 13 existing minor findings (short/duplicate descriptions and one large HTML page). Unrelated product copy was not edited.
- **EdgeOne was not verified successfully.** Its CLI's first local attempt failed during Cloud Function compilation without a useful surfaced error. A standalone retry stalled during compilation and was stopped after prolonged resource saturation; it is not counted as a pass. This does not establish a source-code cause or a hosted EdgeOne deployment result. Do not run unbounded retries alongside browser/type-check jobs in this limited sandbox.

## Deployment status and limits

GitHub metadata confirms that the original voice merge's Pages deployment succeeded, while its Vercel Production build failed. Later main commits' Vercel status also remained failed at inspection time. The promotion endpoint fix addresses the independently observed **404**, **not an established explanation of the build failure**. The full Vercel build log is not available through the repository deployment/check metadata in this environment; do not claim that hosted Vercel deployment has been repaired solely because local artifact tests pass.

A local build validates the artifact, not the Vercel account's limits, project settings, install/build environment or actual promotion. These follow-up fixes are not deployed merely by running this audit. Actual iOS/Android microphone/audio-session behavior, naturalness, pronunciation quality and subjective listening still need real-device review; the formant profiles remain explicitly synthetic, not human/neural voices.
