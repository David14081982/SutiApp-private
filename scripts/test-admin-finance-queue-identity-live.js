'use strict';
// Local built app, existing authenticated records only; no business writes or PII evidence.
const fs = require('fs'), path = require('path'), http = require('http'), crypto = require('crypto'), assert = require('assert').strict;
const { chromium } = require('C:/tmp/sutiapp-playwright-audit/node_modules/playwright-core');
const root = path.resolve(__dirname, '..'), out = path.join(root, 'docs/qa/evidence/finance-queue-identity-20260909');
function env() {
  const values = {};
  for (const line of fs.readFileSync(process.env.SUTIAPP_TEST_ENV_FILE || path.join(root, 'supabase.env'), 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m) values[m[1]] = m[2].trim().replace(/^['"]|['"]$/g, '');
  }
  return values;
}
async function main() {
  const values = env();
  const server = http.createServer((req, res) => {
    const file = decodeURIComponent(new URL(req.url, 'http://localhost').pathname).replace(/^\//, '') || 'SutiApp.html';
    if (file.includes('..') || !/^(SutiApp\.html|sw\.js|manifest\.webmanifest|icon[\w-]*\.png|app\/[\w./-]+\.(?:js|png|webp)|assets\/[\w./-]+\.(?:png|webp))$/.test(file)) { res.writeHead(404); res.end(); return; }
    const target = path.join(root, file); if (!fs.existsSync(target)) { res.writeHead(404); res.end(); return; }
    res.setHeader('Cache-Control', 'no-store'); res.setHeader('Content-Type', file.endsWith('.js') ? 'application/javascript' : file.endsWith('.html') ? 'text/html; charset=utf-8' : 'application/octet-stream');
    fs.createReadStream(target).pipe(res);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  const publishedUrl = process.argv[2];
  const result = { status: 'FAIL', target: publishedUrl ? 'PRODUCTION' : 'LOCAL_BUILD_LIVE_BACKEND', businessWrites: 0, consoleErrors: 0 };
  try {
    if (publishedUrl) {
      const htmlResponse = await fetch(publishedUrl, { cache: 'no-store' }); assert(htmlResponse.ok);
      const html = await htmlResponse.text(), bundlePath = html.match(/src="(app\/bundle\.js\?v=[^"]+)"/); assert(bundlePath);
      const bundleResponse = await fetch(new URL(bundlePath[1], publishedUrl), { cache: 'no-store' }); assert(bundleResponse.ok);
      const digest = data => crypto.createHash('sha256').update(data).digest('hex');
      assert.equal(digest(Buffer.from(await bundleResponse.arrayBuffer())), digest(fs.readFileSync(path.join(root, 'app/bundle.js'))), 'Published bundle differs from this release');
      result.publishedBundle = bundlePath[1]; result.bundleMatches = true;
    }
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, serviceWorkers: 'block' });
    page.setDefaultTimeout(45000);
    page.on('pageerror', () => result.consoleErrors++);
    page.on('response', res => { if (/\/rest\/v1\/(?:program_requests\?|rpc\/list_admin_finance_request_flow_queue)/.test(res.url()) && res.status() >= 400) { result.queueHttpError = res.status(); } });
    page.on('request', req => { if (/\/rpc\/(?:create_|update_|approve_|record_program_request_admin_action|transition_program_request_workflow|register_)/.test(req.url())) result.businessWrites++; });
    await page.goto(publishedUrl || 'http://127.0.0.1:' + server.address().port + '/SutiApp.html', { waitUntil: 'domcontentloaded' });
    await page.locator('input[type=email]').fill(values.H005_TEST_EMAIL); await page.locator('input[type=password]').fill(values.H005_TEST_PASSWORD); await page.locator('button[type=submit]').click();
    await page.waitForFunction(() => window.AffiliateAuth?.getState().phase === 'authenticated');
    result.readProbe = await page.evaluate(async () => {
      try { const rows = await AdminFinanceQueueRepository.enrich(await ProgramRequestRepository.listAdminFlowQueue()); return { status: 'PASS', rows: rows.length }; }
      catch (error) { return { status: 'FAIL', code: error.code || '', message: String(error.message).slice(0, 220) }; }
    });
    assert.equal(result.readProbe.status, 'PASS', 'Authenticated projection probe failed');
    const popupClose = page.getByRole('button', { name: 'Cerrar', exact: true }); if (await popupClose.count()) await popupClose.first().click();
    const admin = page.getByRole('button', { name: 'Admin', exact: true }); if (await admin.count()) await admin.click();
    await page.locator('[data-admin-module=finanzas]').evaluate(button => button.click()); await page.locator('[data-financial-queue-row]').first().waitFor();
    result.identity = await page.evaluate(async () => {
      const original = await ProgramRequestRepository.listAdminFlowQueue();
      const financialRows = await ProgramRequestRepository.listFinancialMobile();
      const funds = new Map(financialRows.map(r => [r.id, r.financial_submission_snapshot?.financialResult?.fund]));
      const rows = [...document.querySelectorAll('[data-financial-queue-row]')];
      return { count: rows.length, fullNamesMatch: rows.every(el => { const r = original.find(r => r.id === el.dataset.financialQueueRow); return el.querySelector('[data-financial-queue-person]').textContent === (String(r.affiliate.full_name || '').trim() || 'Nombre completo no registrado'); }),
        fundsMatch: rows.every(el => { const r = original.find(r => r.id === el.dataset.financialQueueRow); return r.program_id !== 'prestamo' || el.children[2].textContent.includes(funds.get(r.id) || 'Fondo no registrado'); }),
        photosMatchAffiliate: rows.every(el => el.querySelector('[data-financial-queue-photo]').dataset.financialQueuePhoto === original.find(r => r.id === el.dataset.financialQueueRow).affiliate_id),
        namedLoanFunds: financialRows.filter(r => r.program_id === 'prestamo' && funds.get(r.id)).length,
        headerOrder: [...document.querySelector('.finwb-queue-head').children].map(el => el.textContent).join('|') === 'Folio|Foto|Afiliado / programa|Monto / plazo|Estado / etapa|Antig.' };
    });
    assert(result.identity.count > 0 && result.identity.fullNamesMatch && result.identity.fundsMatch && result.identity.photosMatchAffiliate && result.identity.headerOrder && result.identity.namedLoanFunds > 0);
    await page.waitForFunction(() => [...document.querySelectorAll('.finwb-profile-photo img')].some(img => img.complete && img.naturalWidth > 0));
    result.photos = await page.evaluate(() => ({ loaded: [...document.querySelectorAll('.finwb-profile-photo img')].filter(img => img.complete && img.naturalWidth > 0).length, errors: document.querySelectorAll('.finwb-profile-photo[data-photo-state=error]').length }));
    assert(result.photos.loaded > 0); assert.equal(result.photos.errors, 0);
    const promoClose = page.getByRole('button', { name: 'Cerrar', exact: true }); if (await promoClose.count()) { await promoClose.first().click(); await page.waitForTimeout(300); }
    await page.locator('[data-financial-queue-row]').first().locator('[data-financial-queue-photo]').click(); await page.locator('dialog[open]').waitFor();
    await page.keyboard.press('Escape'); assert.equal(await page.locator('dialog[open]').count(), 0); result.existingDialog = 'PASS';
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false); result.mobile = 'PASS';
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.AffiliateAuth?.getState().phase === 'authenticated');
    const adminAfterRefresh = page.getByRole('button', { name: 'Admin', exact: true }); if (await adminAfterRefresh.count()) await adminAfterRefresh.evaluate(button => button.click());
    await page.locator('[data-admin-module=finanzas]').evaluate(button => button.click());
    await page.locator('[data-financial-queue-row]').first().waitFor();
    await page.locator('[data-financial-queue-row]').first().scrollIntoViewIfNeeded();
    await page.waitForFunction(() => [...document.querySelectorAll('.finwb-profile-photo img')].some(img => img.complete && img.naturalWidth > 0)); result.refresh = 'PASS';
    result.anonymousDenied = await page.evaluate(async () => {
      const config = window.__SUTIAPP_CONFIG__.supabase;
      const response = await fetch(config.url + '/rest/v1/rpc/list_admin_financial_requests_mobile', { method: 'POST', headers: { apikey: config.publishableKey, 'Content-Type': 'application/json' }, body: '{}' });
      return response.status === 401 || response.status === 403;
    });
    assert(result.anonymousDenied);
    assert.equal(result.businessWrites, 0); assert.equal(result.consoleErrors, 0); result.status = 'PASS';
  } catch (error) {
    result.error = String(error.message).split('\n')[0].replace(/https?:\/\/\S+/g, '[URL]').slice(0, 200); throw error;
  } finally {
    fs.mkdirSync(out, { recursive: true }); fs.writeFileSync(path.join(out, publishedUrl ? 'production-result.json' : 'live-result.json'), JSON.stringify(result, null, 2) + '\n');
    console.log(JSON.stringify(result)); await browser.close(); await new Promise(resolve => server.close(resolve));
  }
}
main().catch(() => { process.exitCode = 1; });
