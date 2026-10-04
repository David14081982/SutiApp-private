'use strict';
// Read-only, authenticated UI proof. Real source data stays in process memory
// and the private .tmp download; only aggregate calculations enter evidence.
const fs = require('fs'), path = require('path'), crypto = require('crypto'), assert = require('assert/strict');
const { chromium } = require(process.env.SUTIAPP_PLAYWRIGHT_PATH || 'C:/tmp/sutiapp-playwright-audit/node_modules/playwright-core');
const root = path.resolve(__dirname, '..'), candidate = process.argv.includes('--candidate');
const base = process.env.SUTIAPP_SICOF_UI_URL || 'https://sutiapp.com/';
const evidenceDir = path.join(root, 'docs/qa/evidence/sicof-authority-release');
const privateDir = path.join(root, '.tmp/sicof-authority-release');
const env = Object.fromEntries(fs.readFileSync(path.join(root, 'supabase.env'), 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/)
  .map(line => line.match(/^([A-Z0-9_]+)=(.*)$/)).filter(Boolean).map(match => [match[1], match[2].trim().replace(/^['"]|['"]$/g, '')]));
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const metricKeys = ['engine_version', 'rate', 'annualRate', 'base', 'pool', 'reserve', 'collected', 'projected',
  'projectedNetPool', 'projectedRateOnConfirmedBase', 'nqual', 'nexcl', 'reviewCount', 'distributed', 'basisPending', 'reviewReasons', 'settings'];
const metrics = result => Object.fromEntries(metricKeys.map(key => [key, result[key]]));
const percent = value => new Intl.NumberFormat('es-MX', { maximumFractionDigits: 2 }).format(Number(value)) + '%';
const money = value => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number(value));

(async () => {
  fs.mkdirSync(privateDir, { recursive: true });
  fs.mkdirSync(evidenceDir, { recursive: true });
  const { calculateSicof } = await import('../supabase/functions/sicof/engine.mjs');
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, serviceWorkers: 'block', acceptDownloads: true });
  const page = await context.newPage(), errors = [], requests = [], blocked = [];
  try {
    await page.addInitScript(({ metricKeys }) => {
      const summary = result => Object.fromEntries(metricKeys.map(key => [key, result[key]]));
      const proof = window.__sicofAuthorityProof = { backend: null, initial: null, results: [], workerErrors: [], workerReady: false };
      const nativeFetch = window.fetch;
      window.fetch = async function (input, options) {
        const response = await nativeFetch.apply(this, arguments);
        if (String(typeof input === 'string' ? input : input.url).includes('/functions/v1/sicof')) {
          let action; try { action = JSON.parse(options?.body || '{}').action; } catch {}
          if (action === 'FILE_WORKSPACE') response.clone().json().then(value => {
            if (value.data?.result) proof.backend = summary(value.data.result);
          }).catch(() => { proof.workerErrors.push('FILE_WORKSPACE_PROOF_DECODE_FAILED'); });
        }
        return response;
      };
      const NativeWorker = window.Worker;
      window.Worker = class extends NativeWorker {
        constructor(url, options) {
          super(url, options);
          this.sicofProof = String(url).includes('sicof-simulation-worker.js');
          if (this.sicofProof) this.addEventListener('message', event => {
            if (event.data?.error) proof.workerErrors.push(event.data.error);
            if (event.data?.data?.ready) proof.workerReady = true;
            if (event.data?.data?.result) proof.results.push(summary(event.data.data.result));
          });
        }
        postMessage(message, ...rest) {
          // Observe the decoded, authorized input the application already sends.
          if (this.sicofProof && message?.type === 'INIT') {
            proof.initial = { seed: message.seed, workspace: message.workspace, input: message.initialInput };
            proof.workerReady = false;
          }
          return super.postMessage(message, ...rest);
        }
      };
    }, { metricKeys });
    await context.route('**/*', async route => {
      const request = route.request(), url = new URL(request.url());
      if (url.pathname.endsWith('/functions/v1/sicof')) {
        let command = {}; try { command = request.postDataJSON() || {}; } catch {}
        if (!['SOURCE_FUNDS', 'DOWNLOAD_SOURCE', 'FILE_WORKSPACE', 'WORKSPACE', 'CALCULATE'].includes(command.action)) {
          blocked.push(String(command.action)); return route.abort();
        }
      }
      // No table mutation or source-file write is part of this verification.
      if ((url.pathname.startsWith('/rest/v1/') && !url.pathname.startsWith('/rest/v1/rpc/') && !['GET', 'HEAD'].includes(request.method())) ||
          (url.pathname.startsWith('/storage/v1/object/') && !url.pathname.startsWith('/storage/v1/object/sign/') && !['GET', 'HEAD'].includes(request.method()))) {
        blocked.push('UNEXPECTED_DATA_MUTATION'); return route.abort();
      }
      if (candidate && url.hostname === new URL(base).hostname) {
        const file = url.pathname.endsWith('/app/bundle.js') ? 'app/bundle.js' :
          url.pathname.endsWith('/app/sicof-simulation-worker.js') ? 'app/sicof-simulation-worker.js' : null;
        if (file) return route.fulfill({ status: 200, contentType: 'application/javascript',
          body: fs.readFileSync(path.join(root, '.tmp/sicof-savings-authority/candidate', file)) });
      }
      return route.continue();
    });
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => {
      if (!response.url().includes('/functions/v1/sicof')) return;
      try { const command = response.request().postDataJSON(); if (command?.action) requests.push({ action: command.action, status: response.status() }); } catch {}
    });
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    const bundleHash = await page.evaluate(async () => {
      const script = document.querySelector('script[src*="app/bundle.js?v="]');
      if (!script) throw Error('PUBLISHED_BUNDLE_MISSING');
      const response = await fetch(script.src, { cache: 'no-store' });
      const digest = await crypto.subtle.digest('SHA-256', await response.arrayBuffer());
      return Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, '0')).join('');
    });
    const expectedBuild = JSON.parse(fs.readFileSync(path.join(root, 'docs/qa/evidence/sicof-savings-authority/build.json'), 'utf8'));
    assert.equal(bundleHash, expectedBuild.bundleSha256, 'the browser must run the reviewed candidate');
    await page.locator('input[type=email]').fill(env.H005_TEST_EMAIL);
    await page.locator('input[type=password]').fill(env.H005_TEST_PASSWORD);
    await page.locator('button[type=submit]').click();
    await page.waitForFunction(() => window.AffiliateAuth?.getState().phase === 'authenticated', null, { timeout: 60000 });
    const dismiss = page.getByRole('button', { name: 'Ahora no', exact: true });
    // The existing startup invitation can appear before the navigation click.
    await page.addLocatorHandler(dismiss, async () => { await dismiss.click(); });
    if (await dismiss.isVisible()) await dismiss.click();
    await page.locator('[data-app-tab="admin"]').click();
    await page.locator('[data-admin-desktop-sidebar]').waitFor({ timeout: 60000 });
    const finance = page.locator('[data-admin-sidebar-group="finance"]');
    if (await finance.getAttribute('aria-expanded') === 'false') await finance.click();
    await page.locator('[data-admin-sidebar-module="sicof"]').click();
    await page.getByLabel('Inicio del periodo', { exact: true }).fill('2026-07-01');
    await page.getByLabel('Cierre del periodo', { exact: true }).fill('2026-10-30');
    const downloading = page.waitForEvent('download', { timeout: 150000 });
    await page.getByRole('button', { name: '↓ Descargar base de préstamos (.xlsx)', exact: true }).click();
    const workbook = path.join(privateDir, 'live-source.xlsx');
    await (await downloading).saveAs(workbook);
    await page.getByLabel('Archivo de préstamos (.xlsx)', { exact: true }).setInputFiles(workbook);
    await page.getByRole('button', { name: 'Preparar cálculo con este archivo', exact: true }).click();
    await page.waitForFunction(() => window.__sicofAuthorityProof.backend && window.__sicofAuthorityProof.workerReady, null, { timeout: 150000 });
    const observation = await page.evaluate(() => ({ backend: window.__sicofAuthorityProof.backend, initial: window.__sicofAuthorityProof.initial }));
    assert(observation.initial?.input && observation.initial?.seed && observation.initial?.workspace, 'actual worker inputs were observed');
    const ordinary = settings => calculateSicof(observation.initial.seed.context,
      { ...observation.initial.seed.analysisMetadata, loans: observation.initial.workspace.loans, payments: observation.initial.workspace.payments },
      { ...observation.initial.input, settings });
    const backend = observation.backend;
    assert.equal(backend.engine_version, 'SICOF_2026_10_04_V4');
    assert.equal(backend.settings.method, 'avg', 'the first scenario exercises average daily balance');
    assert.deepEqual(backend, metrics(ordinary(backend.settings)), 'installed backend and ordinary engine agree on all KPI');
    assert(backend.base > 0 && Number.isFinite(backend.rate), 'the authorized recorded savings produce a rate');
    assert(!backend.reviewReasons.some(item => ['HISTORICAL_EXPECTATION_UNVERIFIED', 'SOURCE_REVIEW_REQUIRED'].includes(item.reason)),
      'valid recorded amounts are not blocked by obsolete evidence requirements');

    async function assertVisible(result) {
      const rate = percent(result.rate), partial = result.base > 0 && result.reviewCount > 0;
      await page.waitForFunction(expected => document.querySelector('.sicof-metrics .sicof-metric.primary strong')?.textContent === expected, rate, { timeout: 15000 });
      const cards = page.locator('.sicof-metrics > *');
      assert.equal(await cards.count(), 12); assert.equal(await page.getByRole('tab').count(), 8);
      const expectedValues = [rate, money(result.pool), money(result.collected), money(result.projected), money(result.projectedNetPool),
        percent(result.projectedRateOnConfirmedBase), money(result.reserve), money(result.base), String(result.nqual), String(result.nexcl), String(result.reviewCount), money(result.distributed)];
      assert.deepEqual(await cards.locator('strong').allTextContents(), expectedValues, 'all 12 visible KPI match the calculation');
      assert.equal(await cards.nth(0).locator('span').textContent(), partial ? 'Tasa del periodo · provisional' : 'Tasa del periodo');
      if (partial) {
        assert.equal(await cards.nth(0).locator('small').innerText(), `Provisional: ${result.nqual} ahorradores; ${result.reviewCount} pendientes.`);
        assert.equal(await cards.nth(7).locator('small').innerText(), `Base parcial: ${result.nqual} ahorradores.`);
        assert.equal(await cards.nth(5).locator('small').innerText(), 'Provisional sobre la base parcial; no acredita rendimiento.');
        assert.equal(await cards.nth(11).locator('small').innerText(), 'Simulación parcial; no es un reparto aprobado.');
      }
    }
    await assertVisible(backend);
    if (backend.reviewReasons.length) {
      await page.locator('[data-sicof-evidence] summary').click();
      assert.equal(await page.locator('[data-sicof-evidence] li').count(), backend.reviewReasons.length);
      const details = await page.locator('[data-sicof-evidence]').innerText();
      assert(!details.includes('Importe histórico esperado sin evidencia'));
      assert(!details.includes('Cambios de fuente pendientes de revisión'));
    }
    const requestsBeforeLocal = requests.length;
    const slider = page.locator('input[type=range]');
    const originalPay = Number(await slider.inputValue()), direction = originalPay > 0 ? 'ArrowLeft' : 'ArrowRight';
    await slider.focus(); await slider.press(direction);
    const adjustedPay = Number(await slider.inputValue());
    assert.notEqual(adjustedPay, originalPay, 'the payout control changed');
    await page.waitForFunction(pay => window.__sicofAuthorityProof.results.some(result => result.settings.method === 'avg' && result.settings.pay === pay), adjustedPay, { timeout: 20000 });
    const adjusted = await page.evaluate(pay => window.__sicofAuthorityProof.results.findLast(result => result.settings.method === 'avg' && result.settings.pay === pay), adjustedPay);
    assert.deepEqual(adjusted, metrics(ordinary(adjusted.settings)), 'real worker slider result equals ordinary calculation');
    assert.equal(adjusted.base, backend.base);
    assert.notEqual(adjusted.rate, backend.rate, 'the payout percentage changes the computed rate');
    assert(Math.abs(adjusted.rate - adjusted.distributed / adjusted.base * 100) < 1e-9, 'rate uses distributed yield over the participating base');
    await assertVisible(adjusted);
    assert.equal(requests.length, requestsBeforeLocal, 'slider recalculates without an additional source or backend calculation request');
    await page.getByRole('button', { name: 'Saldo final', exact: true }).click();
    await page.waitForFunction(pay => window.__sicofAuthorityProof.results.some(result => result.settings.method === 'end' && result.settings.pay === pay), adjustedPay, { timeout: 20000 });
    const finalBalance = await page.evaluate(pay => window.__sicofAuthorityProof.results.findLast(result => result.settings.method === 'end' && result.settings.pay === pay), adjustedPay);
    assert.deepEqual(finalBalance, metrics(ordinary(finalBalance.settings)), 'real worker final-balance result equals ordinary calculation');
    assert.notEqual(finalBalance.base, adjusted.base, 'final balance uses its own dated basis');
    await assertVisible(finalBalance);
    assert.equal(requests.length, requestsBeforeLocal, 'method selection uses only the loaded observation');
    assert.deepEqual(await page.evaluate(() => window.__sicofAuthorityProof.workerErrors), []);
    assert.deepEqual(blocked, []); assert.deepEqual(errors, []);
    assert(requests.every(request => request.status === 200));
    assert(requests.some(request => request.action === 'DOWNLOAD_SOURCE') && requests.some(request => request.action === 'FILE_WORKSPACE'));
    const proof = { status: 'PASS', mode: candidate ? 'CANDIDATE_PUBLIC_ASSET_OVERRIDE' : 'PUBLISHED', at: new Date().toISOString(),
      bundleHash, workbookSha256: sha(fs.readFileSync(workbook)), backend, slider: adjusted, finalBalance, requests,
      checks: ['actual authenticated login', 'legitimate source download and same-file import', 'installed engine V4',
        '12 KPI match returned calculation', '8 tabs preserved', 'provisional notes use actual eligible and pending counts',
        'obsolete amount-review blocks absent', 'worker slider and final-balance results equal ordinary engine',
        'local controls make no further source or calculation request'],
      financialWrites: 0, fixtureResponses: 0, serviceWorkers: 'BLOCKED_FOCAL_TEST' };
    fs.writeFileSync(path.join(evidenceDir, 'ui-live-' + (candidate ? 'candidate' : 'published') + '.json'), JSON.stringify(proof, null, 2) + '\n');
    console.log(JSON.stringify(proof));
  } finally { await browser.close(); }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
