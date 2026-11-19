/** Real-browser smoke: BROWSER_EXECUTABLE=/path/to/chromium node scripts/check-engineering-calculator.mjs
 * Start the site first; CALCULATOR_BASE_URL defaults to the local development server. */
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';

const base = process.env.CALCULATOR_BASE_URL || 'http://localhost:3000/';
const browser = await chromium.launch({ executablePath: process.env.BROWSER_EXECUTABLE, headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--no-zygote', '--single-process', '--use-gl=angle', '--use-angle=swiftshader'],
});
async function openClock(lang, viewport, mobile = false) {
  const context = await browser.newContext({ viewport, hasTouch: mobile, isMobile: mobile });
  await context.addInitScript((language) => {
    localStorage.setItem('sham_perfume_user_language', language);
    localStorage.setItem('sham_perfume_user_override_lang', 'true');
    localStorage.setItem('sham_cookie_consent_v1', JSON.stringify({ version: '1.1', essential: true, analytics: false, marketing: false, timestamp: new Date().toISOString() }));
  }, lang);
  // The calculator itself must work with no third-party requests.
  await context.route('**/*', (route) => new URL(route.request().url()).origin === new URL(base).origin ? route.continue() : route.abort());
  const page = await context.newPage();
  page.setDefaultTimeout(15_000);
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  const consent = page.getByRole('button', { name: /Reject non-essential|رفض غير الضروري/ });
  if (await consent.isVisible()) await consent.click();
  const launcher = page.getByTestId('visitor-local-dashboard').getByRole('button', { name: lang === 'ar' ? 'حاسبة هندسية' : 'Engineering calculator', exact: true });
  await launcher.locator('.clock-calculator-badge').waitFor();
  await launcher.click();
  const calc = page.getByRole('dialog', { name: lang === 'ar' ? 'الحاسبة الهندسية' : 'Engineering calculator' });
  await calc.waitFor();
  assert.equal(await launcher.getAttribute('aria-controls'), await calc.getAttribute('id'));
  await calc.locator('.cw-lcd').waitFor();
  assert.equal(await calc.locator('.cw-dpad').evaluate((el) => getComputedStyle(el).borderRadius), '50%', 'the new calculator stylesheet is loaded');
  return { page, calc, launcher };
}

try {
  const { page, calc, launcher } = await openClock('en', { width: 1280, height: 820 });
  const press = (name) => calc.getByRole('button', { name, exact: true }).click();
  const result = calc.getByTestId('engineering-calculator-result');
  const expression = calc.getByRole('textbox', { name: 'Math expression' });
  const compute = async (value) => { await expression.fill(value); await expression.press('Enter'); };
  const expectResult = async (text) => { assert.equal((await result.textContent()).trim(), text); };
  const mode = async (name) => { await press('Calculator apps'); await press(name); };
  const outcome = () => calc.locator('.cw-app:not([hidden]) .cw-mode-output');

  console.log('Checking scientific keypad and result formats…');
  assert.equal(await calc.getAttribute('aria-modal'), null);
  await press('sin'); await press('3'); await press('0'); await press('Close parenthesis'); await press('Execute');
  assert.equal(await expression.inputValue(), 'sin(30)');
  assert.equal(await result.locator('[aria-label="1/2"]').count(), 1);
  await press('Result format'); await press('DEC Decimal'); await expectResult('0.5');
  await press('+'); await press('1'); await press('Execute'); await expectResult('1.5');
  assert.equal(await expression.inputValue(), 'Ans+1');
  await press('Variable memory'); await press('Store in A'); await press('Recall A'); await press('Execute'); await expectResult('1.5');
  await compute('123'); await expression.fill('123'); await expression.press('Home');
  await press('9'); await press('Execute'); await expectResult('9123');
  await compute('tan(90)'); assert.match(await result.innerText(), /undefined/i);
  await press('Previous calculation'); await expectResult('9123');
  await press('All clear'); await press('Function catalog'); await press('Calculus');
  await calc.getByRole('button', { name: /Example: integrate/ }).click();
  await press('Execute'); await expectResult('0.33333333333');

  console.log('Checking movement, minimize and site navigation…');
  const grip = calc.getByRole('heading', { name: 'Engineering calculator' });
  const prior = await calc.boundingBox();
  const handle = await grip.boundingBox();
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
  await page.mouse.down();
  await page.mouse.move(handle.x + handle.width / 2 - 170, handle.y + handle.height / 2 + 30, { steps: 7 });
  await page.mouse.up();
  assert.ok((await calc.boundingBox()).x < prior.x - 140, 'the window follows the pointer');
  await press('Minimize calculator');
  await calc.waitFor({ state: 'hidden' });
  await page.getByRole('button', { name: 'Restore calculator' }).click();
  await calc.waitFor();
  await expectResult('0.33333333333');
  await page.evaluate(() => { location.hash = 'guide'; });
  await page.locator('[data-clock-layout="compact"]').getByRole('button', { name: 'Engineering calculator', exact: true }).waitFor();
  await expectResult('0.33333333333');
  await press('Minimize calculator');
  await calc.waitFor({ state: 'hidden' });
  await launcher.click();
  await calc.waitFor();
  await expectResult('0.33333333333');

  console.log('Checking advanced calculator apps…');
  await mode('Matrix');
  await calc.getByLabel('Operation').selectOption('det');
  await calc.getByRole('button', { name: 'Calculate EXE', exact: true }).click();
  assert.equal((await outcome().innerText()).trim(), '-2');
  await mode('Equation');
  await calc.getByRole('button', { name: 'Solve EXE', exact: true }).click();
  assert.match(await outcome().innerText(), /x1\s+-2[\s\S]*x2\s+2/);
  await mode('Complex');
  await compute('sqrt(-9)+2i'); await expectResult('5i');
  await press('Result format'); await press('POL Polar form'); await expectResult('5 ∠ 90°');
  await mode('Table');
  await calc.getByLabel('f(x)', { exact: true }).fill('x^2');
  await calc.getByRole('button', { name: 'Generate table EXE', exact: true }).click();
  assert.match(await outcome().getByRole('row').last().innerText(), /5\s+25/);
  await mode('Spreadsheet');
  await calc.getByLabel('Cell A1', { exact: true }).fill('3');
  await press('A2');
  await calc.getByLabel('Cell A2', { exact: true }).fill('=A1*2');
  assert.equal(await calc.getByRole('button', { name: 'A2 6', exact: true }).count(), 1);
  await mode('Unit conversion');
  await calc.getByRole('button', { name: 'Convert EXE', exact: true }).click();
  assert.equal((await outcome().innerText()).trim(), '1000 m');
  await mode('Calculate');
  await page.evaluate(() => { location.hash = 'home'; });
  await launcher.waitFor();
  await page.keyboard.press('Escape');
  await calc.waitFor({ state: 'hidden' });
  assert.equal(await launcher.getAttribute('aria-expanded'), 'false');

  console.log('Checking Arabic mobile and touch…');
  const mobile = await openClock('ar', { width: 360, height: 640 }, true);
  const mobileCalc = mobile.calc;
  const bounds = await mobileCalc.boundingBox();
  assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= 360 && bounds.y >= 0 && bounds.y + bounds.height <= 640, JSON.stringify(bounds));
  const mobilePress = (name) => mobileCalc.getByRole('button', { name, exact: true }).tap();
  await mobilePress('٨'); await mobilePress('−'); await mobilePress('٢'); await mobilePress('تنفيذ');
  assert.equal((await mobileCalc.getByTestId('engineering-calculator-result').innerText()).trim(), '٦');
  await mobilePress('أوضاع الحاسبة');
  assert.equal(await mobileCalc.locator('.cw-app-tile').count(), 14);
  await mobilePress('إغلاق الحاسبة');
  await mobileCalc.waitFor({ state: 'hidden' });
  assert.ok(await mobile.launcher.evaluate((button) => button === document.activeElement));
  console.log('Calculator browser checks passed: launch, keypad, localized mobile, drag, minimize, navigation, exact display, and advanced modes.');
} finally { await browser.close(); }
