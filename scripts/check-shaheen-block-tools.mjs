/** Real Chromium checks. Start Vite first; set BROWSER_EXECUTABLE to a local Chromium binary. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright-core';
const base = process.env.BLOCKS_BASE_URL || 'http://localhost:5173';
const browser = await chromium.launch({ executablePath: process.env.BROWSER_EXECUTABLE, headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--no-zygote', '--single-process'] });
try {
  const page = await browser.newPage(); const errors = []; let outbound = 0;
  page.on('pageerror', (e) => errors.push(e.message));
  if (process.env.BLOCKS_BROWSER_DEBUG) {
    page.on('requestfailed', (request) => console.error(request.url(), request.failure()));
    page.on('console', (message) => console.error(message.type(), message.text()));
  }
  await page.route('**/api/workspace/status', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ai: false, search: 'encyclopedia', image: 'off', notion: false, slack: false }) }));
  await page.route('**/api/workspace/ask', (route) => { outbound++; return route.fulfill({ status: 503, body: 'No engine' }); });
  await page.route('**/blocks-audit', (route) => route.fulfill({ contentType: 'text/html', body: '<html><head><link rel="stylesheet" href="/src/index.css"></head><body><div id="audit-root"></div><script type="module">import RefreshRuntime from "/@react-refresh"; RefreshRuntime.injectIntoGlobalHook(window); window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => (type) => type; window.__vite_plugin_react_preamble_installed__ = true; window.__auditReady = true;</script></body></html>' }));
  const mount = async (language = 'en') => {
    await page.goto(`${base}/blocks-audit`); await page.waitForFunction(() => window.__auditReady);
    await page.evaluate(async (lang) => {
      const main = await (await fetch('/src/main.tsx')).text();
      const react = main.match(/"([^"]*\/react\.js\?[^"]*)"/)[1];
      const dom = main.match(/"([^"]*\/react-dom_client\.js\?[^"]*)"/)[1];
      const [{ default: React }, { default: ReactDOM }, { default: Workspace }] = await Promise.all([import(react), import(dom), import('/src/workspace/ShaheenWorkspace.tsx')]);
      ReactDOM.createRoot(document.getElementById('audit-root')).render(React.createElement(Workspace, { currentLang: lang }));
    }, language);
  };
  const button = (name) => page.getByRole('button', { name, exact: true });
  const open = () => page.getByTestId('ws-tab-blocks').click();
  const run = () => button('Run tool').click();
  const editor = () => page.getByRole('textbox', { name: 'Blocks JSON definition' });
  const output = () => page.getByTestId('block-results').innerText();
  await mount(); await open(); await run(); assert.match(await output(), /total: 80/);
  await page.getByRole('textbox', { name: 'Price', exact: true }).fill('250'); await run(); assert.match(await output(), /total: 200/);
  await page.getByTestId('block-example-list').click(); await page.getByRole('textbox', { name: /Numbers/ }).fill('[2,3]'); await run(); assert.match(await output(), /total: 13/);
  await page.getByRole('textbox', { name: /Numbers/ }).fill('[broken'); await run(); await page.getByRole('alert').waitFor(); assert.equal(await page.getByTestId('block-results').count(), 0);
  // The documented tool composes a new conditional + map + sum, not one of the templates.
  const doc = await readFile(new URL('../docs/SHAHEEN_BLOCK_TOOLS.md', import.meta.url), 'utf8');
  const custom = JSON.parse(doc.match(/```json\n([\s\S]*?)\n```/)[1]);
  const chooserPromise = page.waitForEvent('filechooser'); await button('Import JSON').click();
  const chooser = await chooserPromise; await chooser.setFiles({ name: 'custom.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(custom)) });
  await page.getByRole('heading', { name: custom.title }).waitFor(); await run(); assert.match(await output(), /total: 8/);
  await button('Save on device').click(); assert.ok(await page.getByText('Tool definition saved on this device only, not to your account or the site.', { exact: true }).isVisible());
  await mount(); await open(); await button('Restore saved').click(); await run(); assert.match(await output(), /total: 8/);
  const downloadPromise = page.waitForEvent('download'); await button('Download JSON').click(); const download = await downloadPromise;
  assert.deepEqual(JSON.parse(await readFile(await download.path(), 'utf8')), custom);
  await editor().fill(JSON.stringify({ ...custom, nodes: [{ id: 'out', expr: { kind: 'eval', code: 'window.__executed = true' } }], outputs: ['out'] }));
  assert.ok(await button('Run tool').isDisabled()); assert.ok(await button('Save on device').isDisabled());
  await button('Validate and apply').click(); await page.getByRole('alert').waitFor(); assert.equal(await page.evaluate(() => window.__executed), undefined);
  await page.getByRole('textbox', { name: 'Requested tool' }).fill('build a video calling application'); await button('Assemble tool').click();
  assert.ok(await page.getByText(/Specify inputs, logic and outputs/).isVisible());
  // A browser storage failure must never claim success.
  await page.getByTestId('block-example-discount').click();
  await page.evaluate(() => { window.__originalSet = Storage.prototype.setItem; Storage.prototype.setItem = () => { throw new Error('Blocked'); }; });
  await button('Save on device').click(); await page.getByRole('alert').waitFor(); assert.equal(await page.getByText(/Tool definition saved on this device only/).count(), 0);
  await page.evaluate(() => { Storage.prototype.setItem = window.__originalSet; });
  await page.getByTestId('ws-tab-chat').click(); await page.getByTestId('ws-input').fill('build a discount calculator using blocks'); await page.getByTestId('ws-send').click();
  await button('Open in blocks').click(); await run(); assert.match(await output(), /total: 80/); assert.equal(outbound, 0, 'building did not call an AI engine');
  await page.unroute('**/api/workspace/ask');
  await page.route('**/api/workspace/ask', (route) => {
    const sent = route.request().postDataJSON(); assert.equal(sent.task, 'blocks'); assert.deepEqual(Object.keys(sent).sort(), ['language', 'messages', 'task']);
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ reply: '```json\n' + JSON.stringify(custom) + '\n```', sources: [] }) });
  });
  await page.getByRole('textbox', { name: 'Requested tool' }).fill('Double only positive list values and sum them');
  await button('Draft a new tool from description (online)').click(); await page.getByRole('heading', { name: custom.title }).waitFor();
  await run(); assert.match(await output(), /total: 8/);
  await page.unroute('**/api/workspace/ask');
  let release; const gate = new Promise((resolve) => { release = resolve; });
  await page.route('**/api/workspace/ask', async (route) => { await gate; try { await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ reply: '```json\n' + JSON.stringify(custom) + '\n```', sources: [] }) }); } catch { /* request cancelled */ } });
  const requested = page.waitForRequest('**/api/workspace/ask');
  await button('Draft a new tool from description (online)').click(); await requested;
  await button('Cancel drafting').click(); await page.getByTestId('block-example-discount').click(); release();
  await run(); assert.match(await output(), /total: 80/);
  await page.unroute('**/api/workspace/ask');
  await page.route('**/api/workspace/ask', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ reply: '```json\n{"code":"alert(1)"}\n```', sources: [] }) }));
  await button('Draft a new tool from description (online)').click(); await page.getByRole('alert').waitFor();
  assert.equal(await page.getByRole('heading', { name: 'Discount calculator', exact: true }).count(), 1, 'invalid generated JSON cannot replace the current tool');
  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok(await page.getByTestId('ws-blocks').evaluate((el) => el.scrollWidth <= el.clientWidth + 1), 'workshop fits mobile width');
  await mount('ar'); await open(); await button('شغّل الأداة').click(); assert.match(await output(), /total/);
  assert.deepEqual(errors, []);
  console.log('Block workshop browser checks passed: execution, input changes, custom map/condition import, local persistence, JSON export, invalid definitions, blocked storage, local chat hand-off, validated online drafting, cancellation, invalid generated JSON and mobile/Arabic rendering.');
} finally { await browser.close(); }
