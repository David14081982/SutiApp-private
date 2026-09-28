'use strict';
// Authenticated, read-only browser check. The candidate serves only the local bundle.
const fs = require('fs'), path = require('path'), assert = require('assert/strict');
const { chromium } = require(process.env.SUTIAPP_PLAYWRIGHT_PATH || 'C:/tmp/sutiapp-playwright-audit/node_modules/playwright-core');
const root = path.resolve(__dirname, '..');
const out = path.join(root, 'docs/qa/evidence/product-editor-position-20260928');
const baseline = process.argv.includes('--baseline');
const published = process.argv.includes('--published');
const product = '81e154e9-8249-5d92-a357-a6d90675c8e5';
function env() {
  const values = {};
  for (const line of fs.readFileSync(path.join(root, 'supabase.env'), 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/)) {
    const i = line.indexOf('=');
    if (i > 0 && !line.trim().startsWith('#')) values[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^['"]|['"]$/g, '');
  }
  return values;
}
async function geometry(page) {
  return page.evaluate(() => {
    const editor = document.querySelector('[data-program-product-editor]');
    const scroller = document.querySelector('#admin-desktop-workspace') || document.querySelector('[data-app-tab-scroll=admin]');
    const box = editor?.children[0].getBoundingClientRect();
    return { scrollTop: scroller.scrollTop, headerY: box?.y, headerBottom: box?.bottom, viewport: innerHeight };
  });
}
async function main() {
  const values = env();
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const cases = [], errors = [], mutations = [];
  try {
    for (const [width, height] of [[1600, 900], [1280, 720], [390, 844]]) {
      const context = await browser.newContext({ viewport: { width, height }, serviceWorkers: 'block' });
      const page = await context.newPage();
      page.on('pageerror', error => errors.push(error.message));
      page.on('request', request => {
        if (/\/rest\/v1\/(rpc\/)?(save_|create_|reorder_|discard_|register_)/.test(request.url())) mutations.push(new URL(request.url()).pathname);
      });
      let candidateLoaded = false;
      if (!baseline && !published) await page.route('**/app/bundle.js*', async route => {
        candidateLoaded = true;
        await route.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(process.env.SUTIAPP_POSITION_BUNDLE || path.join(root, 'app/bundle.js')) });
      });
      await page.goto('https://sutiapp.com/#/admin/program_products', { waitUntil: 'domcontentloaded' });
      await page.locator('input[type=email]').fill(values.H005_TEST_EMAIL);
      await page.locator('input[type=password]').fill(values.H005_TEST_PASSWORD);
      await page.locator('button[type=submit]').click();
      await page.locator('[data-program-key=tours]').click({ timeout: 45000 });
      const existing = page.locator(`[data-program-product="${product}"]`).locator('button').nth(1);
      const add = page.locator('[data-program-product-add=tours]');
      const checks = [];
      for (const [kind, opener] of [['existing', existing], ['new', add]]) {
        await opener.scrollIntoViewIfNeeded();
        const before = await geometry(page);
        assert(before.scrollTop > 0, 'Exercise a scrolled catalog');
        await opener.click();
        await page.locator('[data-program-product-editor]').waitFor();
        const opened = await geometry(page);
        if (!baseline) {
          assert(opened.headerY >= -1 && opened.headerBottom <= opened.viewport, 'Editor header must open inside viewport');
          for (const selector of ['[data-program-product-field=name]', '[data-product-financing-editor]', '[data-program-product-active-control]', '[data-program-product-sold-control]', '[data-program-product-image-input]']) {
            assert.equal(await page.locator(selector).count(), 1, selector);
          }
          // Reach the existing footer; dismiss without invoking its writer.
          await page.locator('[data-program-product-save]').scrollIntoViewIfNeeded();
          assert(await page.locator('[data-program-product-save]').isVisible());
          await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
        } else {
          // Inspect the broken initial position before scrolling to dismiss.
          await page.getByRole('button', { name: 'Cerrar', exact: true }).click();
        }
        await page.locator('[data-program-product-editor]').waitFor({ state: 'detached' });
        const closed = await geometry(page);
        if (!baseline) assert(Math.abs(closed.scrollTop - before.scrollTop) <= 2, 'Restore catalog scroll on dismissal');
        checks.push({ kind, before, opened, closed });
      }
      if (!baseline && !published) assert(candidateLoaded, 'Local candidate bundle must be exercised');
      cases.push({ width, height, candidateLoaded, checks });
      await context.close();
    }
    assert.deepEqual(errors, []);
    assert.deepEqual(mutations, []);
    if (baseline) assert(cases.some(test => test.checks.some(check => check.opened.headerY < 0)), 'Reproduce the original bug');
    const result = { status: baseline ? 'BUG_REPRODUCED' : 'PASS', mode: baseline ? 'PUBLISHED_BASELINE' : published ? 'PUBLISHED_RELEASE' : 'LOCAL_BUNDLE_WITH_READ_ONLY_LIVE_BACKEND', cases, errors, businessMutations: mutations.length };
    fs.mkdirSync(out, { recursive: true });
    fs.writeFileSync(path.join(out, baseline ? 'baseline.json' : published ? 'published-browser.json' : 'browser.json'), JSON.stringify(result, null, 2) + '\n');
    console.log(JSON.stringify(result));
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
