/** Real Chromium lifecycle/failure regression checks. Start npm run dev first.
 * BROWSER_EXECUTABLE=/path/to/chromium node scripts/check-voice-lifecycle.mjs
 * Uses real hooks + real worker/WASM/Web Audio; does not request microphone permission.
 */
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
const base = process.env.VOICE_BASE_URL || 'http://localhost:3000/';
const browser = await chromium.launch({ executablePath: process.env.BROWSER_EXECUTABLE, headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--no-zygote', '--single-process', '--use-gl=angle', '--use-angle=swiftshader'],
});
try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(base);
  await page.evaluate(async () => {
    const main = await (await fetch('/src/main.tsx')).text();
    const reactUrl = main.match(/"([^"]*\/react\.js\?[^"]*)"/)[1];
    const clientUrl = main.match(/"([^"]*\/react-dom_client\.js\?[^"]*)"/)[1];
    const [{ default: React }, { default: ReactDOM }, { useReadAloud }, { useShaheenVoiceMode }, { saveVoiceChoice, DEFAULT_VOICE_CHOICE }] = await Promise.all([
      import(reactUrl), import(clientUrl),
      import('/src/hooks/useReadAloud.ts'), import('/src/hooks/useShaheenVoiceMode.ts'), import('/src/utils/voiceChoice.ts'),
    ]);
    saveVoiceChoice({ ...DEFAULT_VOICE_CHOICE, names: { ar: 'sham-local:ar:m1', en: 'sham-local:en-us:m1' } });
    const audit = window.__voiceAudit = { workers: 0, starts: 0, stops: 0, readErrors: 0 };
    const NativeWorker = window.Worker;
    window.Worker = class extends NativeWorker {
      constructor(...args) { super(...args); this.live = true; audit.workers++; }
      terminate() { if (this.live) { audit.workers--; this.live = false; } super.terminate(); }
    };
    const nativeSource = AudioContext.prototype.createBufferSource;
    AudioContext.prototype.createBufferSource = function (...args) {
      const source = nativeSource.apply(this, args);
      const start = source.start.bind(source); const stop = source.stop.bind(source);
      source.start = (...input) => { audit.starts++; return start(...input); };
      source.stop = (...input) => { audit.stops++; return stop(...input); };
      return source;
    };
    const host = document.createElement('div'); host.id = 'voice-audit';
    host.style.cssText = 'position:fixed;inset:0;background:white;color:black;z-index:2147483647;padding:40px'; document.body.append(host);
    let root;
    function Harness({ language }) {
      const reader = useReadAloud({ language, onNoVoice: () => audit.readErrors++ });
      const voice = useShaheenVoiceMode({ language, messages: [], isLoading: false, disabled: true, onSend: async () => false });
      audit.readerSpeaking = reader.isSpeaking; audit.voiceSpeaking = voice.speaking; audit.voiceError = voice.error;
      return React.createElement('div', {},
        React.createElement('button', { id: 'audit-read', onClick: () => reader.toggle('أهلا وسهلا بكم في منصة شام. '.repeat(15)) }, 'Read / stop'),
        React.createElement('button', { id: 'audit-stop', onClick: reader.stop }, 'Close'),
        React.createElement('button', { id: 'audit-preview', onClick: () => voice.previewVoice('sham-local:ar:f1', 'أهلا وسهلا بكم في منصة شام. '.repeat(10)) }, 'Preview'),
      );
    }
    window.__mountVoiceAudit = (language = 'ar') => { root ??= ReactDOM.createRoot(host); root.render(React.createElement(Harness, { language })); };
    window.__unmountVoiceAudit = () => { root.unmount(); root = undefined; };
    window.__mountVoiceAudit();
  });
  const state = () => page.evaluate(() => ({ ...window.__voiceAudit }));
  await page.locator('#audit-read').click();
  await page.waitForFunction(() => window.__voiceAudit.starts >= 1);
  await page.locator('#audit-read').click();
  await page.waitForFunction(() => !window.__voiceAudit.readerSpeaking && window.__voiceAudit.workers === 0);
  assert.ok((await state()).stops >= 1, 'Reader toggle must stop actual local audio, not just native speech');

  let before = await state();
  await page.locator('#audit-read').click();
  await page.waitForFunction((starts) => window.__voiceAudit.starts > starts, before.starts);
  await page.evaluate(() => window.__mountVoiceAudit('en'));
  await page.waitForFunction(() => !window.__voiceAudit.readerSpeaking && window.__voiceAudit.workers === 0);
  assert.ok((await state()).stops > before.stops, 'Changing language must cancel the old reader');

  await page.evaluate(() => window.__mountVoiceAudit('ar'));
  before = await state();
  await page.locator('#audit-preview').click();
  await page.waitForFunction((starts) => window.__voiceAudit.starts > starts, before.starts);
  // Wait for the actual preview audio, not just state set before dictionary loading.
  await page.waitForFunction(() => window.__voiceAudit.voiceSpeaking && window.__voiceAudit.workers === 1);
  before = await state();
  await page.evaluate(() => window.__unmountVoiceAudit());
  await page.waitForFunction(() => window.__voiceAudit.workers === 0);
  assert.ok((await state()).stops > before.stops, 'Unmounting the voice hook must stop actual preview audio');

  // A blocked dictionary must settle the reader and close its worker, retaining the text UI.
  await page.route('**/voice-engine/espeak-ng-data/ar_dict.gz', (route) => route.fulfill({ status: 503, body: 'Voice dictionary unavailable' }));
  await page.evaluate(() => window.__mountVoiceAudit());
  await page.locator('#audit-read').click();
  await page.waitForFunction(() => window.__voiceAudit.readErrors === 1 && !window.__voiceAudit.readerSpeaking && window.__voiceAudit.workers === 0);
  await page.unroute('**/voice-engine/espeak-ng-data/ar_dict.gz');

  // Unmount during a dictionary fetch must terminate immediately, not wait for the network timeout.
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  await page.route('**/voice-engine/espeak-ng-data/ar_dict.gz', async (route) => { await gate; try { await route.continue(); } catch { /* Worker terminated. */ } });
  const request = page.waitForRequest('**/voice-engine/espeak-ng-data/ar_dict.gz');
  await page.locator('#audit-preview').click(); await request;
  await page.evaluate(() => window.__unmountVoiceAudit());
  await page.waitForFunction(() => window.__voiceAudit.workers === 0);
  release();
  assert.deepEqual(errors, []);
  console.log('Real user-click reader toggle, language switch, voice-hook unmount during playback/loading, and dictionary failure passed.');
} finally { await browser.close(); }
