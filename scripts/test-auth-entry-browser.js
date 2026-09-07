'use strict';
// Isolated browser fixtures. No credentials, email or backend mutations.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const pw = require(process.env.SUTIAPP_PLAYWRIGHT_PATH || 'C:/tmp/sutiapp-playwright-audit/node_modules/playwright-core');
const root = path.resolve(__dirname, '..');
const out = path.join(root, 'docs/qa/evidence/auth-entry-20260907');
const authSource = fs.readFileSync(path.join(root, 'app/affiliate-auth.js'), 'utf8');
// Pin the version that demonstrated the bug so the regression reproduction
// remains meaningful after this fix becomes HEAD.
const baseline = execFileSync('git', ['show', '2ed0d44753422b5f450627ab3c4115dea0e01761:app/affiliate-auth.js'], { cwd: root, encoding: 'utf8' });

function fixture(options) {
  let session = options.session ? { access_token: 'isolated-token', user: { id: 'isolated-user', user_metadata: { sutiapp_activation: true } } } : null;
  let listener;
  window.qa = { reads: 0, updates: 0, phases: [], signOutScope: null };
  const auth = {
    onAuthStateChange(fn) { listener = fn; return { data: { subscription: {} } }; },
    getSession: async () => ({ data: { session } }),
    signOut: async options => { qa.signOutScope = options?.scope || 'global'; session = null; listener('SIGNED_OUT', null); return {}; },
    signInWithPassword: async () => {
      session = { access_token: 'isolated-login', user: { id: 'isolated-user', user_metadata: { sutiapp_activation: true } } };
      listener('SIGNED_IN', session); return { data: { session } };
    },
    updateUser: async () => { qa.updates++; throw new Error('Unexpected password write'); },
  };
  qa.emit = event => listener(event, session);
  window.SutiSupabase = { getClient: () => ({ auth, rpc: async () => ({ data: {} }) }) };
  window.AffiliateRepository = {
    clearProfilePhotoCache() {},
    getCurrentAffiliate: async () => { qa.reads++; return { id: 'isolated-affiliate', auth_user_id: session.user.id, auth_eligibility: 'eligible' }; },
    getProfilePhoto: async () => null,
  };
  window.createAffiliateViewModel = value => value;
}

async function mount(context, source, options = {}) {
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('crash', () => errors.push('PAGE_CRASH'));
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin !== 'https://auth-entry.test') return route.abort();
    if (url.pathname === '/react.js') return route.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(path.join(root, 'app/vendor/react-18.3.1/react.production.min.js'), 'utf8') });
    if (url.pathname === '/react-dom.js') return route.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(path.join(root, 'app/vendor/react-dom-18.3.1/react-dom.production.min.js'), 'utf8') });
    if (url.pathname === '/auth.js') return route.fulfill({ contentType: 'text/javascript', body: source });
    return route.fulfill({ contentType: 'text/html; charset=utf-8', body: `<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div>
      <script>(${fixture.toString()})(${JSON.stringify(options)})</script>
      <script src="/react.js"></script><script src="/react-dom.js"></script><script src="/auth.js"></script>
      <script>
        function Boundary() { const auth = useAffiliateAuth(); return auth.phase === 'authenticated' ? React.createElement('main', {'data-app':true}, 'Sesión activa') : React.createElement(AffiliateLoginScreen, {auth}); }
        AffiliateAuth.subscribe(state => qa.phases.push(state.phase));
        ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(Boundary));
      </script>` });
  });
  await page.goto(`https://auth-entry.test/${options.flow ? '?auth_flow=' + options.flow : ''}`);
  await page.waitForFunction(() => window.AffiliateAuth?.getState().phase !== 'loading');
  return { page, errors };
}

async function geometry(page) {
  await page.locator('form').waitFor();
  return page.locator('h1, form, form input, form button').evaluateAll(nodes => nodes.map(node => {
    const rect = node.getBoundingClientRect();
    return { tag: node.tagName, text: node.textContent, x: rect.x, y: rect.y, width: rect.width, height: rect.height };
  }));
}

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const results = [];
  for (const [engine, device] of [['webkit', 'iPhone 13'], ['chromium', 'Pixel 5']]) {
    const browser = await pw[engine].launch({ headless: true, ...(engine === 'chromium' ? { executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' } : {}) });
    try {
      const context = await browser.newContext({ ...pw.devices[device], serviceWorkers: 'block' });
      const before = await mount(context, baseline);
      const after = await mount(context, authSource);
      assert.deepEqual(await geometry(after.page), await geometry(before.page), 'Normal login visual contract changed');
      assert.equal(await after.page.locator('input[type=email]').count(), 1);
      assert.equal(await after.page.locator('input[autocomplete=current-password]').count(), 1);
      await after.page.screenshot({ path: path.join(out, `${engine}-login.png`) });
      await before.page.close();
      await after.page.close();

      const broken = await mount(context, baseline, { session: true });
      assert.equal(await broken.page.evaluate(() => AffiliateAuth.getState().phase), 'activation_password', 'Baseline no longer reproduces reported entry defect');
      await broken.page.close();
      const restored = await mount(context, authSource, { session: true });
      await restored.page.locator('[data-app]').waitFor();
      const reads = await restored.page.evaluate(() => qa.reads);
      await restored.page.evaluate(() => { for (let i = 0; i < 50; i++) qa.emit('SIGNED_IN'); });
      await restored.page.waitForTimeout(150);
      assert.equal(await restored.page.evaluate(() => qa.reads), reads);
      await restored.page.evaluate(() => qa.emit('PASSWORD_RECOVERY'));
      await restored.page.waitForTimeout(100);
      assert.equal(await restored.page.locator('input[autocomplete=new-password]').count(), 0);
      await restored.page.reload();
      await restored.page.locator('[data-app]').waitFor();
      assert.deepEqual(restored.errors, []);
      await restored.page.close();

      for (const flow of ['activation', 'recovery']) {
        const setup = await mount(context, authSource, { session: true, flow });
        await setup.page.locator('input[autocomplete=new-password]').first().waitFor();
        assert.equal(await setup.page.locator('input[autocomplete=new-password]').count(), 2);
        await setup.page.evaluate(() => qa.emit('TOKEN_REFRESHED'));
        await setup.page.waitForTimeout(80);
        assert.equal(await setup.page.locator('input[autocomplete=new-password]').count(), 2);
        await setup.page.reload();
        await setup.page.locator('input[autocomplete=new-password]').first().waitFor();
        await setup.page.screenshot({ path: path.join(out, `${engine}-${flow}.png`) });
        await setup.page.getByRole('button', { name: 'Volver al inicio de sesión', exact: true }).click();
        await setup.page.locator('input[type=email]').waitFor();
        assert.equal(new URL(setup.page.url()).searchParams.has('auth_flow'), false);
        assert.equal(await setup.page.evaluate(() => qa.signOutScope), 'local');
        assert.equal(await setup.page.evaluate(() => qa.updates), 0);
        await setup.page.locator('input[type=email]').fill('isolated@example.test');
        await setup.page.locator('input[autocomplete=current-password]').fill('isolated-only');
        await setup.page.getByRole('button', { name: 'Entrar', exact: true }).click();
        await setup.page.locator('[data-app]').waitFor();
        assert.deepEqual(setup.errors, []);
        await setup.page.close();
      }
      results.push({ engine, device, status: 'PASS', baselineReproduced: true, loginGeometry: 'IDENTICAL', restoredMetadata: true, focusEvents: 50, recoveryBroadcastScoped: true, explicitLinksAndReload: true, cancelAndLogin: true, passwordWrites: 0 });
      await context.close();
    } finally { await browser.close(); }
  }
  const report = { status: 'PASS', isolated: true, productionMutations: 0, results };
  fs.writeFileSync(path.join(out, 'browser-result.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report));
})().catch(error => { console.error(error); process.exitCode = 1; });
