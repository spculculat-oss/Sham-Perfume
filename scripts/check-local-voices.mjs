/** Browser smoke test. Start `npm run dev` first. Browser installation is external.
 * BROWSER_EXECUTABLE=/path/to/chromium npm run test:voices-browser
 * For a built Pages preview, set VOICE_BASE_URL and VOICE_WORKER_PATH=assets/localVoice.worker-<hash>.js.
 */
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
const base = process.env.VOICE_BASE_URL || 'http://localhost:3000/';
const workerPath = process.env.VOICE_WORKER_PATH;
const browser = await chromium.launch({ executablePath: process.env.BROWSER_EXECUTABLE, headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--no-zygote', '--single-process', '--use-gl=angle', '--use-angle=swiftshader', '--autoplay-policy=no-user-gesture-required'],
});
try {
  const page = await browser.newPage();
  const errors = [];
  const engineRequests = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => { if (request.url().includes('/voice-engine/')) engineRequests.push(request.url()); });
  await page.goto(base);
  assert.equal(engineRequests.length, 0, 'Opening the site must not download the optional engine');
  if (workerPath) {
    const result = await page.evaluate(async ({ base, workerPath }) => {
      const worker = new Worker(new URL(workerPath, base), { type: 'module' });
      try {
        return await new Promise((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error('Timed out')), 45000);
          worker.onerror = (event) => { clearTimeout(timer); reject(new Error(event.message)); };
          worker.onmessage = async (event) => {
            clearTimeout(timer);
            if (!event.data.audio) { reject(new Error('Synthesis failed')); return; }
            const audio = new AudioContext();
            const buffer = await audio.decodeAudioData(event.data.audio);
            await audio.close(); resolve(buffer.duration);
          };
          worker.postMessage({ engineUrl: new URL('voice-engine/dist/browser.js', base).href, voice: 'sham-local:ar:f1', language: 'ar', text: 'أهلا وسهلا بكم في منصة شام.', rate: 1, pitch: 1 });
        });
      } finally { worker.terminate(); }
    }, { base, workerPath });
    assert.ok(result > 0.5);
    console.log(`Built worker + Arabic WAV decode passed (${result.toFixed(2)}s), base ${base}`);
  } else {
    const result = await page.evaluate(async () => {
      const { playLocalVoice, unlockLocalAudio } = await import('/src/utils/localVoicePlayer.ts');
      unlockLocalAudio();
      const chunks = [];
      const ok = await new Promise((resolve) => playLocalVoice(['أهلا وسهلا بكم في منصة شام.', 'يمكنك اختيار الصوت المناسب لك.'], {
        name: 'sham-local:ar:m1', language: 'ar', rate: 1, pitch: 1,
        onChunk: (_, index) => chunks.push(index), onEnd: () => resolve(true), onError: () => resolve(false),
      }));
      const { readAloud } = await import('/src/utils/readAloud.ts');
      const { saveVoiceChoice, savedVoiceChoice, DEFAULT_VOICE_CHOICE } = await import('/src/utils/voiceChoice.ts');
      const previous = savedVoiceChoice();
      saveVoiceChoice({ ...DEFAULT_VOICE_CHOICE, names: { ar: 'sham-local:ar:f2' } });
      let readFailed = false;
      const savedRead = await new Promise((resolve) => readAloud('أهلا بكم.', { language: 'ar',
        onNoVoice: () => { readFailed = true; }, onEnd: () => resolve(true),
      }));
      saveVoiceChoice(previous);
      let cancelledCompletion = false;
      let stop;
      const interrupted = await new Promise((resolve) => {
        stop = playLocalVoice(['أهلا وسهلا '.repeat(20), 'لن تسمع هذه الجملة بعد الإيقاف.'], {
          name: 'sham-local:ar:f1', language: 'ar', rate: 1, pitch: 1,
          onChunk: () => setTimeout(() => { stop(); resolve(true); }, 50),
          onEnd: () => { cancelledCompletion = true; resolve(false); }, onError: () => resolve(false),
        });
      });
      let failed = false;
      const invalid = await new Promise((resolve) => playLocalVoice(['مرحبا'], {
        name: 'sham-local:en-us:m1', language: 'ar', rate: 1, pitch: 1,
        onEnd: () => resolve(false), onError: () => { failed = true; resolve(true); },
      }));
      await new Promise((resolve) => setTimeout(resolve, 500));
      return { ok, chunks, savedRead, readFailed, interrupted, cancelledCompletion, invalid, failed };
    });
    assert.deepEqual(result, { ok: true, chunks: [0, 1], savedRead: true, readFailed: false, interrupted: true, cancelledCompletion: false, invalid: true, failed: true });
    console.log('Arabic chunked playback, mid-audio cancellation, language validation and error callback passed.');
  }
  assert.ok(engineRequests.some((url) => url.endsWith('/voice-engine/wasm/espeak-ng.wasm')));
  assert.deepEqual(errors, []);
} finally { await browser.close(); }
