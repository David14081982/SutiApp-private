'use strict';
// Audit only: real Auth/Push source + real IndexedDB, isolated fake RPC/Push provider.
const fs = require('fs'), path = require('path'), http = require('http');
const assert = require('assert').strict, crypto = require('crypto'), vm = require('vm');
const { chromium } = require('C:/tmp/sutiapp-playwright-audit/node_modules/playwright-core');
const root = path.resolve(__dirname, '..');
const out = path.join(root, 'docs/qa/evidence/request-push-persistence-20260910');
const source = name => fs.readFileSync(path.join(root, 'app', name), 'utf8').replace(/\r\n/g, '\n').trimEnd();
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const files = ['affiliate-auth.js', 'request-push.js'];
const save = (name, value) => { fs.mkdirSync(out, { recursive: true }); fs.writeFileSync(path.join(out, name+'.json'), JSON.stringify(value, null, 2)+'\n'); };
async function parity() {
  const rows = [];
  for (const origin of ['https://sutiapp.com/SutiApp.html', 'https://david14081982.github.io/SutiApp-private/SutiApp.html']) {
    const response = await fetch(origin, { signal: AbortSignal.timeout(20000) });
    assert(response.ok, 'Public HTML HTTP '+response.status);
    const html = await response.text(), match = html.match(/src=["']([^"']*app\/bundle\.js[^"']*)["']/);
    assert(match, 'Bundle reference');
    const url = new URL(match[1], response.url).href;
    const bundleResponse = await fetch(url, { signal: AbortSignal.timeout(20000) });
    assert(bundleResponse.ok, 'Public bundle HTTP '+bundleResponse.status);
    const bundle = (await bundleResponse.text()).replace(/\r\n/g, '\n');
    new vm.Script(bundle);
    const modules = files.map(name => {
      const marker = '/* @@file '+name+' */\n(function(){\n';
      const start = bundle.indexOf(marker); assert(start >= 0, 'Module '+name);
      const end = bundle.indexOf('/* @@file ', start+marker.length);
      const section = bundle.slice(start+marker.length, end < 0 ? undefined : end);
      const code = section.slice(0, section.lastIndexOf('\n})();')).trimEnd();
      const local = source(name);
      // Published build uses a typography token. Do not misreport byte parity.
      const normalized = name === 'request-push.js' ? code.replace("fontSize: 'var(--text-13, 13px)'", 'fontSize:13') : code;
      assert.equal(normalized, local, 'Published logic differs: '+name);
      return { file: name, sha256: sha(code), localSha256: sha(local), localEqualsPublished: code === local,
        lifecycleLogicEqualsLocal: true, differences: code === local ? [] : ["UI fontSize:13 becomes var(--text-13, 13px); all other module code identical"] };
    });
    rows.push({ origin, resolvedHtml: response.url, bundleUrl: url, bundleSha256: sha(bundle), bundleSyntax: 'PASS', modules });
  }
  save('production-parity', { status: 'PASS', checkedAt: new Date().toISOString(), readOnly: true, rows });
  console.log(JSON.stringify({ publicParity: 'PASS', rows }));
}
async function browserAudit() {
  const server = http.createServer((req, res) => { res.setHeader('Content-Type', 'text/html'); res.end('<div id="root"></div>'); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  const cases = [];
  try {
    for (const scenario of ['healthy_reopen', 'affiliate_error_on_reopen', 'session_error_on_reopen', 'context_refresh_error', 'explicit_logout']) {
      const context = await browser.newContext();
      const page = await context.newPage(), errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.goto('http://127.0.0.1:'+server.address().port);
      const initialize = async (failure, existing) => {
        for (const vendor of ['react-18.3.1/react.production.min.js', 'react-dom-18.3.1/react-dom.production.min.js'])
          await page.addScriptTag({ content: fs.readFileSync(path.join(root, 'app/vendor', vendor), 'utf8') });
        await page.evaluate(({ failure, existing }) => {
          window.__failure = failure; window.__unsubscribes = 0; window.__revokes = 0; window.__asks = 0;
          window.__permission = existing ? 'granted' : 'default';
          const user = { id: '11111111-1111-4111-8111-111111111111' };
          const session = { user, access_token: 'isolated-fixture-not-a-real-token' };
          const sub = { toJSON: () => ({ endpoint: 'https://fcm.googleapis.com/test/isolated-audit', keys: { p256dh: 'A'.repeat(87), auth: 'B'.repeat(22) } }), unsubscribe: async () => { __unsubscribes++; window.__sub = null; return true; } };
          window.__sub = existing ? sub : null;
          Object.defineProperty(Notification, 'permission', { get: () => __permission, configurable: true });
          Notification.requestPermission = async () => { __asks++; __permission = 'granted'; return 'granted'; };
          const reg = { getNotifications: async () => [], pushManager: { getSubscription: async () => __sub, subscribe: async () => { window.__sub = sub; return sub; } } };
          Object.defineProperty(navigator.serviceWorker, 'ready', { value: Promise.resolve(reg), configurable: true });
          Object.defineProperty(navigator.serviceWorker, 'getRegistration', { value: async () => reg, configurable: true });
          const client = {
            auth: { getSession: async () => __failure === 'session' ? { error: Error('ISOLATED_OFFLINE') } : { data: { session } },
              onAuthStateChange: cb => { window.__authCallback = cb; return { data: { subscription: {} } }; },
              signOut: async () => { __authCallback('SIGNED_OUT', null); return {}; } },
            rpc: async name => {
              if (name === 'get_admin_access_context') return { data: {} };
              if (name === 'get_self_request_push_config') return { data: { enabled: true, public_key: 'B'.repeat(87) } };
              if (name === 'get_self_request_push_status') return { data: true };
              if (name === 'revoke_self_request_push') { __revokes++; return { data: true }; }
              if (name === 'register_self_request_push') return { data: '22222222-2222-4222-8222-222222222222' };
              throw Error('UNEXPECTED_RPC:'+name);
            }
          };
          window.SutiSupabase = { getClient: () => client };
          window.AffiliateRepository = {
            getCurrentAffiliate: async () => { if (__failure === 'affiliate') throw Error('ISOLATED_OFFLINE'); return { id: 'isolated-affiliate', auth_user_id: user.id, auth_eligibility: 'eligible' }; },
            getProfilePhoto: async () => null, clearProfilePhotoCache: () => {}
          };
          window.createAffiliateViewModel = value => value;
          window.__binding = () => new Promise((resolve, reject) => {
            const open = indexedDB.open('sutiapp-request-push-v1', 1);
            open.onsuccess = () => { const db = open.result, tx = db.transaction('device'), r = tx.objectStore('device').get('binding'); let result;
              r.onsuccess = () => { result = r.result; }; tx.oncomplete = () => { db.close(); resolve(!!result); }; tx.onerror = () => reject(tx.error); };
            open.onerror = () => reject(open.error);
          });
        }, { failure, existing });
        for (const name of files) await page.addScriptTag({ content: source(name) });
        await page.evaluate(() => AffiliateAuth.bootstrap());
      };
      await initialize(null, false);
      await page.evaluate(async () => { const s = await RequestPush.state(); await RequestPush.enable(s.config); });
      assert.equal(await page.evaluate(async () => (await RequestPush.state()).phase), 'active');
      assert.equal(await page.evaluate(() => __asks), 1);
      if (scenario.includes('reopen')) {
        // Fresh JS document, same origin/IndexedDB. Push provider persistence is simulated.
        await page.reload();
        await initialize(scenario === 'affiliate_error_on_reopen' ? 'affiliate' : scenario === 'session_error_on_reopen' ? 'session' : null, true);
      } else if (scenario === 'context_refresh_error') {
        await page.evaluate(async () => { __failure = 'affiliate'; await AffiliateAuth.refreshContext(); });
      } else {
        await page.evaluate(async () => { await RequestPush.clearDevice(); await AffiliateAuth.signOut(); });
      }
      if (scenario !== 'healthy_reopen') await page.waitForFunction(() => __sub === null);
      const beforeRecovery = await page.evaluate(async () => ({ authPhase: AffiliateAuth.getState().phase, permission: Notification.permission, binding: await __binding(), subscription: !!__sub, unsubscribes: __unsubscribes, backendRevokes: __revokes }));
      if (scenario !== 'explicit_logout') await page.evaluate(async () => { __failure = null; await AffiliateAuth.retry(); });
      await page.evaluate(() => { ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(RequestPushInvitation)); });
      const phase = await page.evaluate(async () => (await RequestPush.state()).phase);
      if (scenario === 'healthy_reopen') { assert.equal(phase, 'active'); assert.equal(beforeRecovery.unsubscribes, 0); }
      else if (scenario !== 'explicit_logout') {
        assert.equal(beforeRecovery.authPhase, 'error'); assert.equal(beforeRecovery.binding, false);
        assert.equal(beforeRecovery.unsubscribes, 1); assert.equal(beforeRecovery.backendRevokes, 0);
        assert.equal(beforeRecovery.permission, 'granted'); assert.equal(phase, 'ready');
        await page.getByRole('button', { name: 'Activar notificaciones', exact: true }).waitFor();
      } else { assert.equal(beforeRecovery.backendRevokes, 1); assert.equal(phase, 'unavailable'); }
      assert.deepEqual(errors, []);
      cases.push({ scenario, beforeRecovery, recoveredPushPhase: phase, errors });
      await context.close();
    }
    const result = { status: 'PASS', productFinding: 'FAIL: transient Auth error destroys a previously active local Push subscription', checkedAt: new Date().toISOString(), environment: 'Isolated Chrome; actual Auth/Push JS and IndexedDB; RPC, Notification permission and Push provider simulated; no production writes or real notifications', sourceHashes: Object.fromEntries(files.map(name => [name, sha(source(name))])), cases };
    save('reproduction', result); console.log(JSON.stringify(result));
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
}
(async () => { if (process.argv.includes('--production-parity')) await parity(); else await browserAudit(); })().catch(error => { console.error(error.stack); process.exitCode = 1; });
