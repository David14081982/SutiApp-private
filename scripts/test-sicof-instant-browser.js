'use strict';
// Real generated Worker and UI, isolated synthetic inputs. Every browser request
// is intercepted; only the test document and local Worker artifact are served.
const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const { chromium } = require(process.env.SUTIAPP_PLAYWRIGHT_PATH || 'C:/tmp/sutiapp-playwright-audit/node_modules/playwright-core');
const root = path.resolve(__dirname, '..');
const evidence = path.resolve(process.env.SICOF_INSTANT_EVIDENCE || path.join(root, '.tmp/sicof-instant'));
const epoch = Date.parse('2026-10-03T19:00:00.000Z');
const today = '2026-10-03';
const json = value => JSON.parse(JSON.stringify(value));
// Advancing fixture time preserves normal timers and exercises actual TTL checks.
const clockScript = anchor => `(() => { const NativeDate = Date, now = () => ${epoch} + NativeDate.now() - ${anchor}; globalThis.Date = class extends NativeDate { constructor(...args) { super(...(args.length ? args : [now()])); } static now() { return now(); } }; })();`;

async function main() {
  const { calculateSicof, fingerprint } = await import('../supabase/functions/sicof/engine.mjs');
  const { analyzeSicofLoans } = await import('../supabase/functions/sicof/loan-calculation.mjs');
  const { decorateLoans, workspaceView, compactWorkspace } = await import('../supabase/functions/sicof/projection.mjs');
  const { createSimulationSeed } = await import('../supabase/functions/sicof/simulation.mjs');
  const settings = { src: 'caja', selFunds: [], pay: 90, method: 'avg', periodIni: '2026-07-01', periodFin: '2026-12-31', minm: 6, exterm: true, exmin: true, warn: 20, exConsec: false, consecN: 4, loanEffect: 'retiro', retScope: 'todo', anchorOn: false, anchorDate: '2026-07-01', capitalBasis: 'all', yieldMode: 'none', yieldPeriods: [] };
  const participants = [1, 2].map(index => {
    const id = 'synthetic-person-' + index, amount = 1000 * index;
    const transaction = { id: id + '-opening', enrollment_id: id + '-enrollment', component: 'CAPITAL', amount, direction: 'CREDIT', transaction_type: 'REGULARIZATION', effective_date: '2025-12-31', origins: [{ origin_key: '2025', amount }] };
    return { id, affiliate_id: id, folio: '0000' + index, name: 'Synthetic Saver ' + index, identity_resolved: true, certified: true, certified_as_of: '2025-12-31', enrollment: { id: id + '-enrollment', status: 'ACTIVE', enrollment_started_at: '2025-01-01', first_actual_contribution_date: '2025-01-15', frequency: 'TWICE_MONTHLY' }, eligibility: { complete: true, reasons: [], policy_reasons: [] }, history: [], transactions: [transaction], composition: { complete: true, as_of: today, as_of_complete: true, as_of_supported_from: '2025-12-31', balances: { capital: amount, yield_amount: 0, total: amount, available: amount, held: 0 }, as_of_balance: { capital: amount, yield_amount: 0, total: amount }, movements: [{ ...transaction, transaction_id: transaction.id, type: transaction.transaction_type }], periods: [{ origin_key: '2025', period_year: 2025, semester: null, component: 'CAPITAL', recognized: amount, withdrawn: 0, adjustments: 0, remaining: amount, origin_state: 'CLASSIFIED' }] } };
  });
  const rows = [];
  for (const [index, fund] of ['Caja de Ahorro', 'Extra', 'Other'].entries()) {
    for (const date of ['2026-07-15', '2026-10-15', '2026-12-04', '2026-12-05', '2026-12-31']) {
      rows.push({ source_row: rows.length + 2, date, loan_id: 'loan-' + index, folio: participants[index % 2].folio, name: participants[index % 2].name, fund, paid: date > today ? 0 : 110, expected: 110, term: 5, principal: 500, total_due: 550, loan_charges: 50, scheduled_charges: 10, scheduled_admin_fee: 1, admin_fee_total: 5, interest_total: 45, principal_interest_total: 545, scheduled_capital: 100, paid_to_date: 110, expected_to_date: 110, status: 'AL CORRIENTE' });
    }
  }
  const source = { source: 'ISOLATED_SYNTHETIC_SOURCE', observed_at: new Date(epoch - 1000).toISOString(), source_fingerprint: 'a'.repeat(64), date_semantics: 'AMORTIZATION_DATE_NOT_RECEIPT_DATE', cache_meta: { state: 'READY', expires_at: new Date(epoch + 299000).toISOString() }, rows };
  const ctx = { today, as_of: today, from: settings.periodIni, to: settings.periodFin, fingerprint: 'b'.repeat(32), participants, periods: [], scenarios: [], preferences: {}, can_configure: true, can_export: true, report: null };
  const input = { settings, costs: [], bank: { amount: null, declaredBy: '', date: '' } };
  async function expected(command, includeWorkspace = false) {
    // Independent server path reanalyzes the original source for every cutoff.
    const analysis = decorateLoans(analyzeSicofLoans(source, { from: command.settings.periodIni, to: command.settings.periodFin, as_of: today }));
    const result = calculateSicof({ ...ctx, from: command.settings.periodIni, to: command.settings.periodFin }, analysis, command);
    result.fingerprint = await fingerprint({ engine: result.engine_version, settings: result.settings, costs: result.costs, bank: result.bank, context: ctx.fingerprint, loans: source.source_fingerprint });
    if (!includeWorkspace) return json(result);
    const view = workspaceView({ ...ctx, from: command.settings.periodIni, to: command.settings.periodFin }, analysis);
    return json({ result, workspace: { loans: view.loans, payments: view.payments, funds: view.funds, paymentMetrics: view.paymentMetrics } });
  }
  const analysis = decorateLoans(analyzeSicofLoans(source, { from: ctx.from, to: ctx.to, as_of: today }));
  const workspace = workspaceView(ctx, analysis);
  workspace.source = { ...workspace.source, state: 'READY', version: 1, expires_at: source.cache_meta.expires_at };
  const result = calculateSicof(ctx, analysis, input);
  result.fingerprint = (await expected(input)).fingerprint;
  const seed = createSimulationSeed(ctx, analysis, source, epoch);
  const response = json(compactWorkspace({ workspace, result, simulation: seed }));
  const workerCode = fs.readFileSync(path.join(root, 'app/sicof-simulation-worker.js'), 'utf8');
  const browser = await chromium.launch({ executablePath: process.env.SUTIAPP_CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  const checks = [], timings = [], errors = [], deniedRequests = [], localRequests = [];
  fs.mkdirSync(evidence, { recursive: true });
  async function openFixture(lifetimeMs = 299000) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, timezoneId: 'America/Hermosillo', serviceWorkers: 'block' });
    const fixtureClock = clockScript(Date.now());
    await context.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.origin === 'http://localhost:32199' && url.pathname === '/') {
        localRequests.push('document');
        return route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><html lang="es"><meta charset="utf-8"><body style="margin:0"><div id="root"></div></body></html>' });
      }
      if (url.origin === 'http://localhost:32199' && url.pathname === '/app/sicof-simulation-worker.js' && url.search === '?v=321') {
        localRequests.push('worker');
        return route.fulfill({ status: 200, contentType: 'application/javascript', body: fixtureClock + '\n' + workerCode });
      }
      deniedRequests.push(url.href); await route.abort();
    });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('http://localhost:32199/');
    await page.addScriptTag({ content: fixtureClock });
    await page.evaluate(() => {
      window.calls = []; window.workerCommands = []; window.workerReplies = []; window.completed = []; window.clients = []; window.applyClicks = 0; window.terminated = 0; window.delayNext = 0;
      const OriginalWorker = Worker;
      window.Worker = class extends OriginalWorker {
        constructor(...args) { super(...args); this.addEventListener('message', event => workerReplies.push(event.data)); }
        postMessage(value, ...args) { workerCommands.push(structuredClone(value)); return super.postMessage(value, ...args); }
        terminate() { terminated++; return super.terminate(); }
      };
      document.addEventListener('click', event => { if (event.target.closest('button')?.textContent === 'Aplicar y calcular') applyClicks++; });
    });
    for (const filename of ['app/vendor/react-18.3.1/react.production.min.js', 'app/vendor/react-dom-18.3.1/react-dom.production.min.js', 'app/sicof-payment-behavior.jsx', 'app/sicof-simulation-client.js', 'app/sicof-admin.jsx']) {
      await page.addScriptTag({ content: fs.readFileSync(path.join(root, filename), 'utf8') });
    }
    const fixture = structuredClone(response), expires = new Date(epoch + lifetimeMs).toISOString();
    fixture.simulation.expires_at = expires; fixture.workspace.source.expires_at = expires;
    await page.evaluate(fixtureResponse => {
      const originalClient = SicofSimulationClient;
      window.SicofSimulationClient = { create() {
        const client = originalClient.create(), originalCalculate = client.calculate, originalInitialize = client.initialize;
        client.initialize = async (...args) => { await originalInitialize(...args); client.testReady = true; };
        client.calculate = async command => {
          const started = performance.now(), delay = delayNext; delayNext = 0;
          const value = await originalCalculate(command);
          if (delay) await new Promise(resolve => setTimeout(resolve, delay));
          completed.push({ command: structuredClone(command), value: structuredClone(value), elapsed_ms: performance.now() - started, deliberatelyDelayed: delay });
          return value;
        };
        clients.push(client); return client;
      } };
      window.currentIdentity = 'synthetic-admin'; window.authListeners = [];
      window.AffiliateAuth = { getState: () => ({ phase: currentIdentity ? 'authenticated' : 'anonymous', session: { user: { id: currentIdentity } }, affiliate: { id: 'synthetic-affiliate' } }), subscribe: fn => { authListeners.push(fn); return () => { authListeners = authListeners.filter(value => value !== fn); }; } };
      window.SicofRepository = {
        workspace: async args => { calls.push({ kind: 'workspace', args: structuredClone(args) }); return structuredClone(fixtureResponse); },
        calculate: async () => { throw Error('UNEXPECTED_REMOTE_CALCULATE'); },
        exportReport: async (kind, args) => { calls.push({ kind: 'export', exportKind: kind, args: structuredClone(args) }); return {}; },
        saveScenario: async () => { throw Error('UNEXPECTED_PERSISTENCE'); },
        savePreferences: async () => { throw Error('UNEXPECTED_PERSISTENCE'); }
      };
      window.ui = ReactDOM.createRoot(document.getElementById('root'));
      ui.render(React.createElement(SicofAdminModule, { app: { admin: { phase: 'authorized', has: () => true } }, onBack: () => {}, header: ({ title }) => React.createElement('div', null, title) }));
    }, fixture);
    await page.waitForFunction(() => clients[0]?.testReady && [...document.querySelectorAll('button')].some(button => button.textContent.includes('Descargar base del') && !button.disabled));
    return { page, context };
  }
  const exportButton = page => page.getByRole('button', { name: /Descargar base del cálculo/ });
  const metric = (page, label) => page.locator('.sicof-metric').filter({ has: page.locator('span', { hasText: new RegExp('^' + label + '$') }) }).locator('strong');
  async function assertApplied(page, command, label, reused = false) {
    const serverResponse = await expected(command, true), server = serverResponse.result;
    await page.waitForFunction(fpr => completed.some(item => item.value.result.fingerprint === fpr) && [...document.querySelectorAll('button')].some(button => button.textContent.includes('Descargar base del') && !button.disabled), server.fingerprint);
    const local = await page.evaluate(fpr => completed.findLast(item => item.value.result.fingerprint === fpr), server.fingerprint);
    assert.deepEqual(json(local.value.result), server, label + ': complete server result including fingerprint after JSON transport');
    assert.deepEqual(json(local.value.workspace), serverResponse.workspace, label + ': selectors reconstruct every workspace field exactly');
    assert.equal(await metric(page, 'Interés proyectado pendiente').textContent(), new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(server.projected));
    assert.equal(await page.evaluate(() => calls.filter(call => call.kind === 'workspace').length), 1, label + ': zero additional data reads');
    timings.push(reused ? { case: label, reusedPreviouslyAppliedResult: true } : { case: label, milliseconds: Math.round(local.elapsed_ms * 100) / 100, includesArtificialDelay: local.deliberatelyDelayed > 0 });
    console.log('PASS ' + label);
    return local;
  }
  try {
    const { page, context } = await openFixture();
    assert.equal(await page.evaluate(() => calls[0].args.simulation), true);
    assert.equal(await page.evaluate(() => calls[0].args.compact), true);
    assert.deepEqual(await page.evaluate(() => calls[0].args.settings), settings);
    assert.equal(await page.getByRole('tab').count(), 8);
    checks.push('real generated Worker initialized once from compact authorized workspace');

    const partial = { ...input, settings: { ...settings, periodFin: '2026-12-04' } };
    const cutoffStarted = performance.now();
    await page.getByLabel('Cierre del periodo', { exact: true }).fill('2026-12-04');
    const partialLocal = await assertApplied(page, partial, 'automatic inclusive December 4');
    timings.push({ case: 'cutoff change through displayed result', milliseconds: Math.round((performance.now() - cutoffStarted) * 100) / 100, includesPlaywrightAndAssertionOverhead: true });
    assert(partialLocal.value.workspace.payments.some(payment => payment.date === '2026-12-04'));
    assert(!partialLocal.value.workspace.payments.some(payment => payment.date > '2026-12-04'));
    assert(partialLocal.value.workspace.loans.every(loan => loan.schedule.find(payment => payment.date === '2026-12-05').in_period === false));
    await exportButton(page).click();
    const firstExport = await page.evaluate(() => calls.find(call => call.kind === 'export'));
    assert.deepEqual(firstExport.args.settings, partial.settings);
    assert.equal(firstExport.args.fingerprint, partialLocal.value.result.fingerprint);
    assert.deepEqual(firstExport.args.simulation_basis, seed.basis);
    checks.push('changing December 31 to December 4 calculates automatically, inclusive cutoff, zero additional RPC, exact export basis');

    // Hold an older real Worker result until a newer result has been applied.
    await page.evaluate(() => { delayNext = 350; });
    await page.getByRole('group', { name: 'Fuente de la bolsa', exact: true }).getByRole('button', { name: 'Todos', exact: true }).click();
    await page.waitForFunction(() => workerReplies.some(reply => reply.data?.result?.settings?.src === 'todos'));
    await page.getByRole('group', { name: 'Fuente de la bolsa', exact: true }).getByRole('button', { name: 'Fondos seleccionados', exact: true }).click();
    await page.getByLabel('Fondos adicionales', { exact: true }).click();
    await page.getByRole('checkbox', { name: /^Extra/ }).check();
    await page.getByLabel('Fondos adicionales', { exact: true }).click();
    await page.getByLabel('Porcentaje del interés a repartir', { exact: true }).fill('96');
    await page.getByLabel('Porcentaje del interés a repartir', { exact: true }).fill('97');
    const selected = { ...partial, settings: { ...partial.settings, src: 'sel', selFunds: ['Extra'], pay: 97 } };
    const selectedLocal = await assertApplied(page, selected, 'rapid selected funds and percentage latest wins');
    await page.waitForFunction(() => completed.some(item => item.deliberatelyDelayed === 350));
    await exportButton(page).click();
    const latestExport = await page.evaluate(() => calls.filter(call => call.kind === 'export').at(-1));
    assert.equal(latestExport.args.fingerprint, selectedLocal.value.result.fingerprint, 'late older response cannot replace the displayed/exported result');
    assert.deepEqual(latestExport.args.settings, selected.settings);
    checks.push('funds and rapid percentages use newest draft; delayed older Worker reply cannot replace results');

    await page.getByRole('button', { name: 'Aportaciones del semestre', exact: true }).click();
    await page.getByRole('alert').filter({ hasText: 'Aportaciones del semestre requiere el semestre completo.' }).waitFor();
    assert.equal(await page.getByRole('tabpanel').getAttribute('aria-busy'), 'false');
    assert.equal(await page.getByRole('status').filter({ hasText: 'Aplicando los filtros' }).count(), 0, 'invalid policy does not keep a misleading pending banner');
    assert.equal(await exportButton(page).isDisabled(), true);
    await page.getByRole('button', { name: 'Capital acumulado', exact: true }).click();
    await assertApplied(page, selected, 'invalid partial-semester policy recovers on correction', true);
    checks.push('partial-semester contribution rule shows explicit error, leaves busy state, blocks export and recovers locally');

    await page.getByLabel('Cierre del periodo', { exact: true }).fill('2026-12-31');
    const restored = { ...selected, settings: { ...selected.settings, periodFin: '2026-12-31' } };
    const restoredLocal = await assertApplied(page, restored, 'reexpanded original cutoff');
    assert(restoredLocal.value.workspace.payments.some(payment => payment.date === '2026-12-31'));
    assert.equal(restoredLocal.value.workspace.payments.length, rows.length);
    assert(restoredLocal.value.workspace.loans.every(loan => loan.schedule.every(payment => payment.in_period)));
    checks.push('reexpanding original December 31 restores future evidence from immutable loaded inputs');
    for (const tab of ['Resumen', 'Liquidez', 'Reparto por ahorrador', 'Préstamos y pagos', 'Atrasos', 'Reporte préstamos', 'Cumplimiento', 'Informe final de ahorro']) {
      await page.getByRole('tab', { name: tab, exact: true }).click();
      assert.equal(await page.getByRole('tab', { name: tab, exact: true }).getAttribute('aria-selected'), 'true');
      assert.equal(await page.getByRole('tabpanel').count(), 1);
      assert((await page.getByRole('tabpanel').innerText()).trim().length > 0);
    }
    await page.getByRole('tab', { name: 'Resumen', exact: true }).click();
    await page.screenshot({ path: path.join(evidence, 'instant-filters.png'), fullPage: true });
    assert.equal(await page.evaluate(() => applyClicks), 0);
    assert.deepEqual(await page.evaluate(() => [localStorage.length, sessionStorage.length]), [0, 0]);
    checks.push('all eight original sections render, no Apply clicks, no browser persistence');

    await page.evaluate(() => { delayNext = 200; });
    await page.getByLabel('Porcentaje del interés a repartir', { exact: true }).fill('95');
    await page.waitForFunction(() => workerCommands.some(command => command.type === 'CALCULATE' && command.input.settings.pay === 95));
    await page.evaluate(() => { currentIdentity = ''; authListeners.forEach(listener => listener()); });
    await page.getByRole('alert').getByText('Acceso administrativo requerido.', { exact: true }).waitFor();
    await page.waitForFunction(() => terminated === 1);
    assert.equal(await exportButton(page).count(), 0);
    assert.equal(await page.getByText('Synthetic Saver 1', { exact: true }).count(), 0);
    assert.equal(await page.evaluate(() => calls.filter(call => call.kind === 'workspace').length), 1);
    assert.equal(await page.evaluate(async () => { try { await clients[0].calculate({}); return 'unexpected'; } catch (error) { return error.message; } }), 'SICOF_SIMULATION_CLOSED');
    checks.push('session loss unmounts private UI, terminates Worker, and rejects subsequent work');
    await context.close();

    const expiredFixture = await openFixture(4000), expiredPage = expiredFixture.page;
    await expiredPage.getByRole('alert').filter({ hasText: 'Esta consulta superó los cinco minutos de vigencia.' }).waitFor();
    const before = await expiredPage.evaluate(() => workerCommands.length);
    assert.equal(await exportButton(expiredPage).isDisabled(), true);
    assert.equal(await expiredPage.getByRole('button', { name: '+ Guardar escenario actual', exact: true }).isDisabled(), true);
    await expiredPage.getByLabel('Cierre del periodo', { exact: true }).fill('2026-12-04');
    await expiredPage.waitForTimeout(120);
    assert.equal(await expiredPage.getByRole('status').filter({ hasText: 'Aplicando los filtros' }).count(), 0, 'expired source does not claim a calculation is running');
    assert.equal(await expiredPage.evaluate(() => workerCommands.length), before, 'expired source does not schedule automatic work');
    const expiryRejection = await expiredPage.evaluate(async command => { try { await clients[0].calculate(command); return 'unexpected'; } catch (error) { return error.message; } }, input);
    assert.equal(expiryRejection, 'SICOF_SIMULATION_EXPIRED', 'real Worker independently checks expiry');
    assert.equal(await expiredPage.evaluate(() => calls.filter(call => call.kind === 'workspace').length), 1);
    assert.equal(await expiredPage.evaluate(() => calls.filter(call => call.kind === 'export').length), 0);
    await expiredFixture.context.close();
    checks.push('source expiry prevents automatic work, exports and scenario save; Worker independently rejects stale inputs without polling');
    assert.deepEqual(errors, []);
    assert.deepEqual(deniedRequests, [], 'no unexpected network requests');
    assert.deepEqual(localRequests.sort(), ['document', 'document', 'worker', 'worker'].sort());
    checks.push('selector transport reconstructs all payments, loans, schedule flags, funds and metric fields exactly as independent server analysis');
    const proof = { status: 'PASS', checks, fixture: { synthetic: true, participants: participants.length, sourceRows: rows.length, operationDay: today, clock: 'fixed calendar date, progressing normal timers', worker: 'generated production artifact with isolated clock shim' }, timings, calls: { initialWorkspacePerSession: 1, additionalWorkspaceForFilters: 0, externalRequests: 0, financialWrites: 0 }, errors, limits: ['Small synthetic browser fixture; timings are observations, not production p95 or network latency.', 'Backend export authorization and concurrent-context validation covered by dedicated handler test.'] };
    fs.writeFileSync(path.join(evidence, 'browser.json'), JSON.stringify(proof, null, 2) + '\n');
    console.log(JSON.stringify(proof));
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
