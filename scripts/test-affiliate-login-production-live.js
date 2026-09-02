'use strict';

const assert = require('assert').strict;
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const target = 'https://david14081982.github.io/SutiApp-private/';

function loadPlaywright() {
  for (const candidate of [
    process.env.SUTIAPP_PLAYWRIGHT_PATH,
    'C:\\tmp\\sutiapp-playwright-audit\\node_modules\\playwright-core',
  ].filter(Boolean)) {
    try { return require(candidate); } catch (_) {}
  }
  throw new Error('Playwright Core no disponible');
}

function loadEnv() {
  const values = {};
  const source = fs.readFileSync(path.join(root, 'supabase.env'), 'utf8').replace(/^\uFEFF/, '');
  for (const raw of source.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const at = line.indexOf('=');
    if (at > 0) values[line.slice(0, at).trim()] = line.slice(at + 1).trim().replace(/^['"]|['"]$/g, '');
  }
  return values;
}

async function main() {
  const values = loadEnv();
  assert(values.H005_TEST_EMAIL && values.H005_TEST_PASSWORD, 'Controlled login credentials missing');
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch({
    headless: true,
    executablePath: chromePath,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  try {
    await page.goto(target, { waitUntil: 'domcontentloaded' });
    await page.locator('input[type="email"]').fill(values.H005_TEST_EMAIL);
    await page.locator('input[type="password"]').fill(values.H005_TEST_PASSWORD);
    await page.locator('button[type="submit"]').click();
    await page.waitForFunction(() => window.AffiliateAuth && [
      'authenticated', 'error', 'unlinked', 'ineligible', 'archived',
    ].includes(window.AffiliateAuth.getState().phase), null, { timeout: 30000 });
    const result = await page.evaluate(() => {
      const state = window.AffiliateAuth.getState();
      const seal = document.querySelector('img[alt^="Sello"]');
      return {
        phase: state.phase,
        errorCode: state.errorCode || null,
        adminOnly: Boolean(state.adminOnly),
        sealPresent: Boolean(seal),
        sealLoaded: Boolean(seal && seal.complete && seal.naturalWidth > 0),
      };
    });
    assert.equal(result.phase, 'authenticated');
    assert.deepEqual(pageErrors, []);
    console.log(JSON.stringify({ status: 'PASS', target: 'GITHUB_PAGES_PRODUCTION', ...result, pageErrors }));
  } finally {
    await context.close();
    await browser.close();
  }
}

main().catch((error) => {
  console.error(JSON.stringify({ status: 'FAIL', error: error.message }));
  process.exitCode = 1;
});
