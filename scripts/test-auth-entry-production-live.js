'use strict';
// Real controlled-session lifecycle. No business data or password writes.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const pw = require(process.env.SUTIAPP_PLAYWRIGHT_PATH || 'C:/tmp/sutiapp-playwright-audit/node_modules/playwright-core');
const root = path.resolve(__dirname, '..');
const target = process.env.SUTIAPP_AUTH_E2E_URL || 'http://localhost:8080/';
const env = {};
for (const line of fs.readFileSync(path.join(root, 'supabase.env'), 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/)) {
  const at = line.indexOf('=');
  if (at > 0 && !line.trim().startsWith('#')) env[line.slice(0, at).trim()] = line.slice(at + 1).trim().replace(/^['"]|['"]$/g, '');
}

async function login(page) {
  await page.locator('input[type=email]').fill(env.H005_TEST_EMAIL);
  await page.locator('input[autocomplete=current-password]').fill(env.H005_TEST_PASSWORD);
  const start = Date.now();
  await page.locator('button[type=submit]').click();
  await page.waitForFunction(() => window.AffiliateAuth?.getState().phase === 'authenticated', null, { timeout: 30000 });
  return Date.now() - start;
}

(async () => {
  const results = [];
  let lastStage = 'start';
  for (const [engine, device] of [['webkit', 'iPhone 13'], ['chromium', 'Pixel 5']]) {
    const browser = await pw[engine].launch({ headless: true, ...(engine === 'chromium' ? { executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' } : {}) });
    try {
      const context = await browser.newContext({ ...pw.devices[device] });
      const page = await context.newPage();
      const errors = [];
      let navigations = 0;
      page.on('pageerror', error => errors.push({ stage: lastStage, message: error.message.replace(/https?:\/\/[^\s"']+/g, value => { try { const url = new URL(value); return url.origin + '/' + url.pathname.split('/').filter(Boolean).slice(0, 3).join('/'); } catch (_) { return '[URL]'; } }) }));
      page.on('crash', () => errors.push('PAGE_CRASH'));
      page.on('requestfailed', request => {
        const url = new URL(request.url());
        if (url.pathname.startsWith('/auth/') || url.pathname.startsWith('/rest/')) console.log(JSON.stringify({ engine, stage: lastStage, endpoint: url.pathname.split('/').slice(0, 4).join('/'), failure: request.failure()?.errorText }));
      });
      // pushState/replaceState also emit framenavigated. Count actual document
      // requests so the app's existing Back-button history is not a reload.
      page.on('request', request => { if (request.isNavigationRequest() && request.frame() === page.mainFrame()) navigations++; });
      await page.goto(target, { waitUntil: 'domcontentloaded' });
      await page.locator('input[type=email]').waitFor();
      lastStage = engine + ':login';
      assert.equal(await page.locator('input[autocomplete=new-password]').count(), 0);
      const loginMs = await login(page);
      await page.locator('[data-app-tab-scroll=home]').waitFor();
      await page.waitForFunction(() => window.VisualContent?.getState().phase !== 'loading');
      await page.waitForTimeout(1500);
      const dismissPromo = page.getByRole('button', { name: 'Ahora no', exact: true });
      if (await dismissPromo.isVisible()) await dismissPromo.click();
      await page.locator('[data-app-tab=admin]').click();
      await page.locator('[data-admin-view=menu]').waitFor();
      lastStage = engine + ':focus-and-refresh';
      await page.evaluate(() => {
        window.__qaAuthPhases = [];
        window.__qaUnsubscribe = AffiliateAuth.subscribe(state => __qaAuthPhases.push(state.phase));
        window.__qaAdminNode = document.querySelector('[data-admin-view=menu]');
      });
      for (let i = 0; i < 12; i++) {
        await page.evaluate(() => { window.dispatchEvent(new Event('focus')); document.dispatchEvent(new Event('visibilitychange')); });
        await page.waitForTimeout(120);
      }
      const tokenRefresh = await page.evaluate(async () => {
        const result = await SutiSupabase.getClient().auth.refreshSession();
        return { error: result.error?.code || null, session: Boolean(result.data?.session) };
      });
      assert.deepEqual(tokenRefresh, { error: null, session: true });
      await page.waitForTimeout(3000);
      assert.equal(await page.evaluate(() => document.querySelector('[data-admin-view=menu]') === __qaAdminNode), true, 'Session event remounted the current screen');
      assert.equal(await page.evaluate(() => __qaAuthPhases.every(phase => phase === 'authenticated')), true);
      await page.reload({ waitUntil: 'domcontentloaded' });
      lastStage = engine + ':reload';
      await page.waitForFunction(() => window.AffiliateAuth?.getState().phase === 'authenticated');
      await page.waitForTimeout(1000);
      const second = await context.newPage();
      lastStage = engine + ':second-tab';
      await second.goto(target, { waitUntil: 'domcontentloaded' });
      await second.waitForFunction(() => window.AffiliateAuth?.getState().phase === 'authenticated');
      assert.equal(await second.locator('input[autocomplete=new-password]').count(), 0);
      await second.close();
      // Exercise an explicit recovery URL and its local cancellation. Do not
      // submit a password or send recovery mail during a production smoke.
      const recovery = new URL(target);
      lastStage = engine + ':recovery-cancel';
      recovery.searchParams.set('auth_flow', 'recovery');
      await page.goto(recovery.toString());
      await page.locator('input[autocomplete=new-password]').first().waitFor();
      assert.equal(await page.locator('input[autocomplete=new-password]').count(), 2);
      await page.getByRole('button', { name: 'Volver al inicio de sesión', exact: true }).click();
      await page.locator('input[type=email]').waitFor();
      assert.equal(new URL(page.url()).searchParams.has('auth_flow'), false);
      const secondLoginMs = await login(page);
      lastStage = engine + ':second-login';
      await page.waitForTimeout(3000);
      assert.equal(await page.locator('input[autocomplete=new-password]').count(), 0);
      assert.deepEqual(errors, []);
      assert(navigations <= 5, 'Unexpected reload loop');
      const bundle = await page.evaluate(() => [...document.scripts].find(script => script.src.includes('/bundle.js')).src.split('/').pop());
      results.push({ engine, device, status: 'PASS', loginMs, secondLoginMs, stableAdminScreen: true, focusCycles: 12, tokenRefresh: true, reload: true, secondTab: true, explicitRecoveryAndCancel: true, unexpectedPasswordSetup: false, pageErrors: 0, crashes: 0, navigations, bundle });
      await page.evaluate(() => SutiSupabase.getClient().auth.signOut({ scope: 'local' }));
      await context.close();
    } catch (error) { throw new Error(`${lastStage}: ${error.message}`); }
    finally { await browser.close(); }
  }
  const report = { status: 'PASS', target, realBackend: true, businessDataMutations: 0, passwordWrites: 0, results };
  const file = ['localhost', '127.0.0.1'].includes(new URL(target).hostname) ? 'live-lifecycle-local.json' : 'live-lifecycle-production.json';
  fs.writeFileSync(path.join(root, 'docs/qa/evidence/auth-entry-20260907', file), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report));
})().catch(error => { console.error(error.message); process.exitCode = 1; });
