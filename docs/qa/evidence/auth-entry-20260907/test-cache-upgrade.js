'use strict';
// Run from repository root with the public QA server at localhost:8080.
// Only temporary build files and an isolated browser's session cache change.
const fs = require('fs'), path = require('path'), assert = require('assert/strict');
const cp = require('child_process');
const pw = require('C:/tmp/sutiapp-playwright-audit/node_modules/playwright-core');
const dir = __dirname;
const candidate = JSON.parse(fs.readFileSync(path.join(dir, 'release-candidate.json'), 'utf8')).candidate;
const site = path.join(path.dirname(candidate), 'site');
const restore = () => {
  for (const file of ['app/bundle.js', 'SutiApp.html', 'index.html', 'sw.js']) fs.copyFileSync(path.join(candidate, file), path.join(site, file));
};
const env = {};
for (const line of fs.readFileSync('supabase.env', 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/)) {
  const i = line.indexOf('=');
  if (i > 0 && !line.trim().startsWith('#')) env[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^['"]|['"]$/g, '');
}
(async () => {
  let browser;
  try {
    for (const file of ['app/bundle.js', 'SutiApp.html', 'sw.js']) fs.writeFileSync(path.join(site, file), cp.execFileSync('git', ['show', '2ed0d44753422b5f450627ab3c4115dea0e01761:' + file], { maxBuffer: 20 * 1024 * 1024 }));
    fs.copyFileSync(path.join(site, 'SutiApp.html'), path.join(site, 'index.html'));
    browser = await pw.chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    await page.goto('http://localhost:8080/', { waitUntil: 'domcontentloaded' });
    await page.locator('input[type=email]').fill(env.H005_TEST_EMAIL);
    await page.locator('input[type=password]').fill(env.H005_TEST_PASSWORD);
    await page.locator('button[type=submit]').click();
    await page.waitForFunction(() => window.AffiliateAuth?.getState().phase === 'authenticated');
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
    const oldCaches = await page.evaluate(async () => {
      const ref = new URL(window.__SUTIAPP_CONFIG__.supabase.url).hostname.split('.')[0];
      const key = 'sb-' + ref + '-auth-token', cached = JSON.parse(localStorage.getItem(key));
      if (!cached?.user) throw Error('No cached test session');
      cached.user.user_metadata = { ...cached.user.user_metadata, sutiapp_activation: true };
      localStorage.setItem(key, JSON.stringify(cached));
      return caches.keys();
    });
    assert(oldCaches.includes('sutiapp-v166'));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.AffiliateAuth?.getState().phase === 'activation_password');
    restore();
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(async () => {
      const keys = await caches.keys();
      return window.AffiliateAuth?.getState().phase === 'authenticated' &&
        keys.includes('sutiapp-v167') && !keys.includes('sutiapp-v166') &&
        navigator.serviceWorker.controller?.scriptURL.endsWith('sw.js?v=167');
    }, null, { timeout: 45000 });
    await page.waitForTimeout(1200);
    await page.waitForFunction(() => window.AffiliateAuth?.getState().phase === 'authenticated');
    const afterUpgrade = await page.evaluate(async () => ({
      phase: AffiliateAuth.getState().phase,
      newPasswordInputs: document.querySelectorAll('input[autocomplete=new-password]').length,
      caches: await caches.keys(),
      worker: new URL(navigator.serviceWorker.controller.scriptURL).pathname + new URL(navigator.serviceWorker.controller.scriptURL).search,
    }));
    assert.equal(afterUpgrade.newPasswordInputs, 0);
    const report = { status: 'PASS', oldCache: 'sutiapp-v166', oldCodeReproducedUnexpectedPasswordSetup: true, staleMetadataFixture: 'isolated browser Auth cache only', serverMetadataWrites: 0, manualCacheClears: 0, afterUpgrade };
    fs.writeFileSync(path.join(dir, 'cache-upgrade-live.json'), JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify(report));
    await page.evaluate(() => SutiSupabase.getClient().auth.signOut({ scope: 'local' }));
  } finally { restore(); if (browser) await browser.close(); }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
