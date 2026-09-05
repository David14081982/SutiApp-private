'use strict';
// Isolated UI callbacks: never submits credentials to a backend.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const pw = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'app/affiliate-auth.js'), 'utf8');
const baseline = execFileSync('git', ['show', 'HEAD:app/affiliate-auth.js'], { cwd: root, encoding: 'utf8' });
const results = [];
async function mount(page, code, phase) {
  await page.setContent('<meta name="viewport" content="width=device-width, initial-scale=1"><div id="root"></div>');
  await page.addScriptTag({ path: path.join(root, 'app/vendor/react-18.3.1/react.production.min.js') });
  await page.addScriptTag({ path: path.join(root, 'app/vendor/react-dom-18.3.1/react-dom.production.min.js') });
  await page.addScriptTag({ content: code });
  await page.evaluate(phase => {
    window.calls = [];
    const record = (...args) => window.calls.push(args);
    window.testRoot = ReactDOM.createRoot(document.getElementById('root'));
    testRoot.render(React.createElement(AffiliateLoginScreen, { auth: { phase, signIn: record, completeActivation: record, updateRecoveredPassword: record } }));
  }, phase);
  await page.locator('form').waitFor();
}
async function geometry(page) {
  return page.locator('form, form label, h1, form button[type=submit]').evaluateAll(nodes => nodes.map(n => {
    const r = n.getBoundingClientRect(); return [r.x, r.y, r.width, r.height];
  }));
}
(async () => {
  for (const [engine, device] of [['webkit', 'iPhone 13'], ['chromium', 'Pixel 5']]) {
    const browser = await pw[engine].launch({ headless: true, ...(engine === 'chromium' ? { channel: 'chrome' } : {}) });
    try {
      const context = await browser.newContext({ ...pw.devices[device] });
      const page = await context.newPage();
      for (const phase of ['unauthenticated', 'activation_password', 'password_recovery']) {
        await mount(page, baseline, phase);
        const before = await geometry(page);
        await mount(page, source, phase);
        assert.deepEqual(await geometry(page), before, 'Original layout must remain identical');
        const fields = page.locator('input[autocomplete$="password"]');
        const count = await fields.count();
        assert.equal(count, phase === 'unauthenticated' ? 1 : 2);
        if (phase === 'unauthenticated') await page.locator('input[type=email]').fill('test@example.invalid');
        for (let i = 0; i < count; i++) {
          const field = fields.nth(i);
          const button = field.locator('..').locator('button');
          assert.equal(await field.getAttribute('type'), 'password');
          assert.equal(await field.getAttribute('autocomplete'), phase === 'unauthenticated' ? 'current-password' : 'new-password');
          await field.fill('Local-test-123!');
          await field.evaluate(n => { window.originalInput = n; n.focus(); n.setSelectionRange(2, 7); });
          const box = await button.boundingBox();
          assert.ok(box.width >= 43.99 && box.height >= 43.99, JSON.stringify(box));
          const icon = await button.innerHTML();
          await button.tap();
          await page.waitForTimeout(60);
          assert.equal(await field.getAttribute('type'), 'text');
          assert.match(await button.getAttribute('aria-label'), /^Ocultar /);
          assert.notEqual(await button.innerHTML(), icon);
          assert.deepEqual(await field.evaluate(n => [n === originalInput, document.activeElement === n, n.selectionStart, n.selectionEnd, n.value]), [true, true, 2, 7, 'Local-test-123!']);
          assert.equal(await page.evaluate(() => calls.length), 0);
          if (count === 2) assert.equal(await fields.nth(1 - i).getAttribute('type'), 'password');
          await button.tap();
          assert.equal(await field.getAttribute('type'), 'password');
          assert.match(await button.getAttribute('aria-label'), /^Mostrar /);
          await button.focus();
          await page.keyboard.press('Space');
          assert.equal(await field.getAttribute('type'), 'text');
          await page.keyboard.press('Enter');
          assert.equal(await field.getAttribute('type'), 'password');
          assert.equal(await page.evaluate(() => calls.length), 0);
        }
        await fields.last().focus();
        await page.keyboard.press('Enter');
        assert.deepEqual(await page.evaluate(() => calls), [phase === 'unauthenticated' ? ['test@example.invalid', 'Local-test-123!'] : ['Local-test-123!']]);
        results.push({ engine, device, phase, status: 'PASS', layout: 'identical', touch: '44x44', focusSelectionValueAutocompleteKeyboardSubmit: 'PASS' });
      }
      if (process.argv[2]) {
        await page.goto(process.argv[2]);
        const input = page.locator('input[autocomplete="current-password"]');
        await input.waitFor();
        await input.fill('Local-only-no-submit');
        await input.locator('..').getByRole('button', { name: 'Mostrar contraseña', exact: true }).tap();
        assert.equal(await input.getAttribute('type'), 'text');
        await input.locator('..').getByRole('button', { name: 'Ocultar contraseña', exact: true }).tap();
        assert.equal(await input.getAttribute('type'), 'password');
        results.push({ engine, production: process.argv[2], status: 'PASS', submitted: false });
      }
    } finally { await browser.close(); }
  }
  console.log(JSON.stringify({ status: 'PASS', results }, null, 2));
})().catch(error => { console.error(error); process.exitCode = 1; });
