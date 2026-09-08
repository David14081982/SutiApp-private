'use strict';
// Isolated browser regression: real HTTP images, synthetic metadata, no Supabase or financial writes.
const fs = require('fs'), path = require('path'), http = require('http'), assert = require('assert').strict, cp = require('child_process');
const { chromium } = require('C:/tmp/sutiapp-playwright-audit/node_modules/playwright-core');
const root = path.resolve(__dirname, '..'), read = f => fs.readFileSync(path.join(root, f), 'utf8');
const evidence = path.join(root, 'docs/qa/evidence/admin-request-images-20260908');
const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60"><rect width="60" height="60" fill="#81607d"/><circle cx="30" cy="30" r="12" fill="white"/></svg>';
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function main() {
  const receipts = [], requests = [];
  const server = http.createServer((req, res) => {
    requests.push(req.url);
    const [_, mode, id, attempt] = req.url.split('/');
    const send = () => {
      if (res.destroyed) return;
      if (mode === 'broken' || mode === 'recover' && attempt === '1') { res.writeHead(503).end('unavailable'); return; }
      res.writeHead(200, { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'public,max-age=300' }); res.end(svg);
    };
    if (mode === 'slow') setTimeout(send, 900); else if (mode !== 'hang') send();
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  try {
    async function fixture(before = false) {
      const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
      page.setDefaultTimeout(12000);
      page.on('pageerror', error => console.error('Browser error:', error.message));
      await page.setContent('<style>:root{--surface-2:#edf0f5;--hairline:#ddd;--ink-3:#777;--guinda:#901040}body{font-family:Arial}</style><div id="fixture"></div>');
      for (const file of ['app/vendor/react-18.3.1/react.production.min.js', 'app/vendor/react-dom-18.3.1/react-dom.production.min.js']) await page.addScriptTag({ content: read(file) });
      await page.evaluate(origin => {
        window.__origin = origin; window.__mode = 'good'; window.__calls = []; window.__denied = false; window.__delay = 0; window.__allowed = true; window.__ttl = 300;
        window.__auth = { phase: 'authenticated', session: { user: { id: 'isolated-actor' }, access_token: 'isolated-token' }, affiliate: { id: 'isolated-affiliate' } };
        window.__listeners = new Set();
        window.AffiliateAuth = { getState: () => __auth, subscribe: fn => { __listeners.add(fn); return () => __listeners.delete(fn); } };
        window.AdminRepository = { getState: () => ({ phase: 'authorized', assignment: { role: 'admin' } }), subscribe: () => () => {} };
        window.Icon = () => null; window.money = n => '$' + n;
        const document = { id: 'doc1', affiliate_document_id: 'doc1', mimeType: 'image/svg+xml', status: 'VERIFIED', document_type: { label: 'Documento de prueba' } };
        window.__detail = { id: 'request1', affiliate_id: 'affiliate1', folio: 'QA-001', nombre: 'Prueba aislada', numero_control: 'QA', status: 'submitted', program_id: 'prestamo', request_type: 'benefit', created_at: '2026-09-01', ts: 1, documents_available: true, current_documents_available: true, request_documents: [document], current_affiliate_documents: [{ ...document }], workflow_state: { stages: [], workflow_name: 'Flujo de prueba' } };
        window.ProgramRequestRepository = { listAdminFlowQueue: async () => [__detail, { ...__detail, id: 'request2', affiliate_id: 'affiliate2', folio: 'QA-002', ts: 0 }], adminFlowDetail: async id => ({ ...__detail, id, affiliate_id: id === 'request1' ? 'affiliate1' : 'affiliate2', folio: id === 'request1' ? 'QA-001' : 'QA-002' }) };
        window.DocumentWorkflowRepository = { adminPreview: async (id, target, purpose) => {
          const mode = __mode, denied = __denied, delay = __delay, call = { id, target, purpose, token: __auth.session && __auth.session.access_token };
          __calls.push(call); const attempt = __calls.filter(row => row.id === id && row.target === target).length;
          if (delay) await new Promise(resolve => setTimeout(resolve, delay));
          if (denied) throw Error('DOCUMENT_CONTEXT_DENIED');
          return { signedUrl: __origin + '/' + mode + '/' + id + '-' + target + '/' + attempt, expiresIn: __ttl };
        } };
      }, origin);
      await page.addScriptTag({ content: read('app/private-resource-demand.js') });
      await page.addScriptTag({ content: read('app/image-viewer.jsx') });
      const source = before ? cp.execFileSync('git', ['show', '4c60c41:app/screens-admin-finanzas.jsx'], { cwd: root, encoding: 'utf8' }) : read('app/screens-admin-finanzas.jsx');
      await page.addScriptTag({ content: source.replace('  function FinanzasModule(', '  window.__Workbench = DesktopFinancialWorkbench;\n  function FinanzasModule(') });
      await page.evaluate(() => {
        window.__root = ReactDOM.createRoot(document.getElementById('fixture')); window.__onCount = () => {};
        window.__render = () => __root.render(React.createElement(__Workbench, { app: { admin: { has: permission => permission === 'documents.read' && __allowed } }, onCount: __onCount }));
      });
      return page;
    }
    const ready = page => page.waitForFunction(() => document.querySelectorAll('.finwb-doc img').length === 2 && [...document.querySelectorAll('.finwb-doc img')].every(image => image.complete && image.naturalWidth > 0));
    const start = page => page.evaluate(() => __render());
    for (const before of [true, false]) {
      console.log('Checking refresh', before ? 'before' : 'after');
      const page = await fixture(before); await start(page); await ready(page);
      const initial = await page.evaluate(() => __calls.length);
      await page.locator('.finwb-doc img').first().evaluate(image => { image.dataset.retained = 'yes'; });
      for (let i = 0; i < 3; i++) { await page.evaluate(() => __render()); await sleep(90); }
      const refreshed = await page.evaluate(() => __calls.length);
      assert.equal(initial, 1); assert.equal(refreshed, before ? 4 : 1);
      receipts.push({ case: before ? 'before-refresh-reproduction' : 'after-stable-refresh', initial, refreshed });
      if (!before) {
        assert.equal(await page.locator('.finwb-doc img').first().getAttribute('data-retained'), 'yes', 'thumbnail DOM was replaced');
        await page.getByRole('button', { name: 'Ampliar', exact: true }).first().click();
        await page.waitForSelector('[data-image-viewer]'); assert.equal(await page.evaluate(() => __calls.length), 2);
        await page.getByRole('button', { name: 'Cerrar', exact: true }).click();
        await page.setViewportSize({ width: 430, height: 932 }); await sleep(80);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
        fs.mkdirSync(evidence, { recursive: true }); await page.screenshot({ path: path.join(evidence, 'isolated-mobile.png') });
        await page.locator('[data-financial-documents]').screenshot({ path: path.join(evidence, 'isolated-documents.png') });
        await page.setViewportSize({ width: 1440, height: 1000 });
        assert.equal(await page.locator('[data-financial-documents]').count(), 1); assert.equal(await page.locator('[data-financial-current-documents]').count(), 1);
        await page.evaluate(() => { __allowed = false; __render(); }); await sleep(80);
        assert.equal(await page.locator('.finwb-doc img').count(), 0);
        receipts.push({ case: 'fresh-open-layout-and-permission-removal', status: 'PASS' });
      }
      await page.close();
    }
    for (const mode of ['slow', 'recover', 'broken']) {
      const page = await fixture(); await page.evaluate(mode => { __mode = mode; __render(); }, mode);
      await page.waitForSelector('.finwb-doc'); await sleep(100);
      assert.equal(await page.getByText('Imagen lista para revisar', { exact: true }).count(), 0, 'ready before download');
      if (mode === 'broken') {
        await page.getByRole('button', { name: 'Reintentar', exact: true }).first().waitFor();
        assert.equal(await page.evaluate(() => __calls.length), 2); await sleep(1500); assert.equal(await page.evaluate(() => __calls.length), 2);
        await page.evaluate(() => { __mode = 'good'; }); await page.getByRole('button', { name: 'Reintentar', exact: true }).first().click(); await ready(page);
        assert.equal(await page.evaluate(() => __calls.length), 3);
      } else { await ready(page); assert.equal(await page.evaluate(() => __calls.length), mode === 'recover' ? 2 : 1); }
      receipts.push({ case: mode, status: 'PASS' }); await page.close();
    }
    {
      const page = await fixture(); await page.evaluate(() => { __denied = true; __render(); });
      await page.getByRole('button', { name: 'Reintentar', exact: true }).first().waitFor(); await sleep(1400);
      assert.equal(await page.evaluate(() => __calls.length), 1); assert.equal(await page.locator('.finwb-doc img').count(), 0);
      receipts.push({ case: 'authorization-denied-no-retry-loop', status: 'PASS' }); await page.close();
    }
    {
      const page = await fixture(); await page.evaluate(() => { __delay = 800; __render(); });
      await page.waitForFunction(() => __calls.length === 1);
      await page.evaluate(() => { __delay = 0; });
      await page.locator('[data-financial-queue-row="request2"]').click();
      await page.waitForFunction(() => __calls.length === 2); await ready(page);
      await sleep(900);
      assert((await page.locator('.finwb-doc img').first().getAttribute('src')).includes('affiliate2'), 'late response replaced selected affiliate');
      assert.equal(await page.evaluate(() => __calls[1].target), 'affiliate2');
      await page.evaluate(() => { __auth = { phase: 'anonymous', session: null }; __listeners.forEach(fn => fn()); }); await sleep(100);
      assert.equal(await page.locator('.finwb-doc img').count(), 0); assert.equal(await page.locator('[data-image-viewer]').count(), 0);
      receipts.push({ case: 'selection-race-and-logout', status: 'PASS' }); await page.close();
    }
    {
      const page = await fixture(); await page.evaluate(() => {
        __mode = 'slow'; const sample = __detail.request_documents[0];
        __detail.request_documents = Array.from({ length: 8 }, (_, i) => ({ ...sample, id: 'doc' + i, affiliate_document_id: 'doc' + i }));
        __detail.current_affiliate_documents = __detail.request_documents.map(row => ({ ...row })); __render();
      });
      await page.waitForFunction(() => __calls.length >= 3); await sleep(100);
      assert.equal(await page.evaluate(() => __calls.length), 3, 'more than three loads in flight');
      await page.waitForFunction(() => document.querySelectorAll('.finwb-doc img').length === 16 && [...document.querySelectorAll('.finwb-doc img')].every(i => i.complete && i.naturalWidth > 0));
      assert.equal(await page.evaluate(() => __calls.length), 8);
      receipts.push({ case: 'concurrency-three-deduplicated-sixteen-rows', status: 'PASS' }); await page.close();
    }
    {
      const page = await fixture(); await page.clock.install(); await page.evaluate(() => { __mode = 'hang'; __render(); });
      await page.waitForFunction(() => __calls.length === 1);
      await page.clock.runFor(21500); await sleep(50); await page.clock.runFor(21000); await sleep(50);
      await page.getByRole('button', { name: 'Reintentar', exact: true }).first().waitFor();
      assert.equal(await page.evaluate(() => __calls.length), 2);
      receipts.push({ case: 'download-timeout-bounded-recovery', status: 'PASS' }); await page.close();
    }
    {
      const page = await fixture(); await page.clock.install(); await start(page);
      for (let i = 0; i < 15 && await page.locator('.finwb-doc img').count() < 2; i++) { await page.clock.runFor(100); await sleep(30); }
      await ready(page); await page.clock.fastForward(270100); await page.clock.runFor(100); await sleep(100);
      await ready(page); assert.equal(await page.evaluate(() => __calls.length), 2);
      await page.getByRole('button', { name: 'Ampliar', exact: true }).first().click(); await page.clock.runFor(100); await sleep(100);
      await page.waitForSelector('[data-image-viewer]'); assert.equal(await page.evaluate(() => __calls.length), 3);
      await page.getByRole('button', { name: 'Cerrar', exact: true }).click();
      await page.locator('.finwb-doc img').first().dispatchEvent('error'); await page.clock.runFor(100); await sleep(100); await ready(page);
      assert.equal(await page.evaluate(() => __calls.length), 4);
      await page.locator('.finwb-doc img').first().dispatchEvent('error'); await page.clock.runFor(100);
      await page.getByRole('button', { name: 'Reintentar', exact: true }).first().waitFor();
      await page.clock.fastForward(300100); await page.clock.runFor(100); assert.equal(await page.evaluate(() => __calls.length), 4, 'failed image started an expiry retry loop');
      receipts.push({ case: 'expiry-renewal-and-fresh-open', status: 'PASS' }); await page.close();
    }
    fs.mkdirSync(evidence, { recursive: true });
    const result = { status: 'PASS', receipts, productionMutations: 0, isolated: true };
    fs.writeFileSync(path.join(evidence, 'browser.json'), JSON.stringify(result, null, 2) + '\n'); console.log(JSON.stringify(result));
  } finally { await browser.close(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
}
main().catch(error => { console.error(error.stack); process.exitCode = 1; });
