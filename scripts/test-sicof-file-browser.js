'use strict';
// Full local file flow, real XLSX, repository, authenticated-handler fixture and
// generated Worker. No production request, persistent account or financial write.
const fs = require('fs'), path = require('path'), assert = require('assert/strict');
const { execFileSync } = require('child_process');
const { chromium } = require(process.env.SUTIAPP_PLAYWRIGHT_PATH || 'C:/tmp/sutiapp-playwright-audit/node_modules/playwright-core');
const root = path.resolve(__dirname, '..'), evidence = path.join(root, '.tmp/sicof-file-workflow');
const epoch = Date.parse('2026-10-03T19:00:00.000Z'), today = '2026-10-03';
const plain = value => JSON.parse(JSON.stringify(value));
async function main() {
  const { dispatchSicof } = await import('../supabase/functions/sicof/handler.mjs');
  const { SICOF_FIELDS, SICOF_COLUMNS } = await import('../supabase/functions/sicof/loan-source.mjs');
  const { analyzeSicofLoans } = await import('../supabase/functions/sicof/loan-calculation.mjs');
  const { decorateLoans, workspaceView } = await import('../supabase/functions/sicof/projection.mjs');
  const { revalidateFileBasis, scopeFileAnalysis } = await import('../supabase/functions/sicof/file-workspace.mjs');
  const { requireCurrentSicofSource } = await import('../supabase/functions/sicof/source-cache.mjs');
  const baseline = await import('data:text/javascript;base64,' + Buffer.from(execFileSync('git', ['show', 'c55ef8f237031dfa06c5149e063534414c1aa0f8:supabase/functions/sicof/engine.mjs'], { cwd: root })).toString('base64'));
  const ExcelJS = require('../.tmp/sicof/deps/node_modules/exceljs');
  const actor = '00000000-0000-4000-8000-000000000001', affiliate = '00000000-0000-4000-8000-000000000002', session = '00000000-0000-4000-8000-000000000003';
  const participants = [1, 2].map(index => {
    const id = 'person-' + index, amount = index * 1000;
    const transaction = { id: id + '-opening', enrollment_id: id + '-enrollment', component: 'CAPITAL', direction: 'CREDIT', amount, effective_date: '2025-12-31', transaction_type: 'REGULARIZATION', origins: [{ origin_key: '2025', amount }] };
    return { id, affiliate_id: id, folio: '0000' + index, name: 'Synthetic Saver ' + index, identity_resolved: true, certified: true, certified_as_of: '2025-12-31', enrollment: { id: id + '-enrollment', status: 'ACTIVE', enrollment_started_at: '2025-01-01', first_actual_contribution_date: '2025-01-15', frequency: 'TWICE_MONTHLY' }, eligibility: { complete: true, reasons: [], policy_reasons: [] }, history: [], transactions: [transaction], composition: { as_of: today, as_of_complete: true, as_of_supported_from: '2025-12-31', balances: { capital: amount, yield_amount: 0, total: amount, available: amount, held: 0 }, as_of_balance: { capital: amount, yield_amount: 0, total: amount }, movements: [{ ...transaction, transaction_id: transaction.id, type: transaction.transaction_type }], periods: [] } };
  });
  const raw = (i, date, fund, patch = {}) => ({ ...Object.fromEntries(SICOF_FIELDS.map(key => [key, null])), source_row: i + 2, date, paid: date > today ? 0 : 110, loan_id: 'loan-' + i, folio: participants[i % 2].folio, name: participants[i % 2].name, process: '001', rate: .1, discount_start: date, discount_end: date, fund, term: 1, principal: 100, total_due: 110, loan_charges: 10, scheduled_charges: 10, expected: 110, status: 'AL CORRIENTE', paid_to_date: 0, expected_to_date: 0, scheduled_admin_fee: 2, admin_fee_total: 2, interest_total: 8, principal_interest_total: 108, scheduled_capital: 100, ...patch });
  const source = { source: 'ISOLATED_SYNTHETIC_SOURCE', headers: Array.from({ length: SICOF_COLUMNS.length }, (_, i) => 'Synthetic header ' + i), columns: SICOF_COLUMNS, source_fingerprint: 'a'.repeat(64), observed_at: new Date(epoch).toISOString(), date_semantics: 'AMORTIZATION_DATE_NOT_RECEIPT_DATE', cache_meta: { state: 'READY', expires_at: new Date(epoch + 300000).toISOString() }, rows: [raw(0, '2026-06-30', 'Caja de Ahorro'), raw(1, '2026-07-01', 'Caja de Ahorro'), raw(2, '2026-10-01', 'Caja de Ahorro'), raw(3, '2026-12-04', 'Caja de Ahorro'), raw(4, '2026-12-05', 'Caja de Ahorro'), raw(5, '2026-12-31', 'Caja de Ahorro'), raw(6, '2027-01-01', 'Caja de Ahorro'), raw(7, '2026-12-04', 'Extra'), raw(8, '2026-12-04', 'Other'), raw(9, '2026-09-15', 'Other', { paid: 0, paid_to_date: 0, expected_to_date: 110, status: 'SALDO ATRASADO' })] };
  source.cache_meta.observed_at = source.observed_at;
  const ctx = { context: { actor, session, effective_affiliate: affiliate }, today, as_of: today, from: '2026-07-01', to: '2026-12-31', fingerprint: 'b'.repeat(32), can_configure: true, can_export: true, participants, periods: [], existing_period_previews: [], scenarios: [], preferences: {}, report: null };
  let clock = epoch, delayPrepare = 0, sourceReads = 0, contextReads = 0, lastPrepared;
  const api = [], errors = [], unexpectedNetwork = [], checks = [];
  const deps = { env: () => '', today: () => today, now: () => clock, sourceReader: async () => { sourceReads++; requireCurrentSicofSource(source, deps); return structuredClone(source); }, loadExcelJS: async () => ExcelJS,
    createUserClient: () => ({ auth: { getUser: async () => ({ data: { user: { id: actor } } }) }, rpc: async (name, args) => { contextReads++; assert.equal(name, 'get_admin_sicof_context'); return { data: { ...structuredClone(ctx), from: args.p_from, to: args.p_to, as_of: args.p_to < today ? args.p_to : today } }; } }),
    createServiceClient: () => { throw Error('UNEXPECTED_FINANCIAL_WRITE'); } };
  const decode = async bytes => { const book = new ExcelJS.Workbook(); await book.xlsx.load(bytes); return book; };
  const browser = await chromium.launch({ executablePath: process.env.SUTIAPP_CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  fs.mkdirSync(evidence, { recursive: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, timezoneId: 'America/Hermosillo', serviceWorkers: 'block', acceptDownloads: true });
    const anchor = Date.now(), clockScript = `(() => { const OriginalDate=Date; globalThis.__clockShift=0; const now=()=>${epoch}+OriginalDate.now()-${anchor}+globalThis.__clockShift; globalThis.Date=class extends OriginalDate {constructor(...args){super(...(args.length?args:[now()]));} static now(){return now();}}; })();`;
    await context.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.origin === 'http://localhost:32299' && url.pathname === '/') return route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="es"><meta charset="utf-8"><body style="margin:0"><div id="root"></div></body></html>' });
      if (url.origin === 'http://localhost:32299' && url.pathname === '/app/sicof-simulation-worker.js' && url.search === '?v=322') return route.fulfill({ contentType: 'application/javascript', body: clockScript + '\n' + fs.readFileSync(path.join(root, 'app/sicof-simulation-worker.js'), 'utf8') });
      if (url.origin === 'http://localhost:32299' && url.pathname === '/app/vendor/exceljs-4.4.0/exceljs.min.js') return route.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(path.join(root, 'app/vendor/exceljs-4.4.0/exceljs.min.js')) });
      unexpectedNetwork.push(url.href); return route.abort();
    });
    const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
    await page.exposeFunction('__backend', async body => {
      api.push({ action: body.action, settings: body.settings, fileBytes: body.file?.base64?.length });
      if (body.action === 'FILE_WORKSPACE' && delayPrepare) { const delay = delayPrepare; delayPrepare = 0; await new Promise(resolve => setTimeout(resolve, delay)); }
      try { const response = await dispatchSicof(body, 'Bearer synthetic', deps); if (body.action === 'FILE_WORKSPACE') lastPrepared = response.data; return plain(response); }
      catch (error) { return { error: error.message }; }
    });
    await page.goto('http://localhost:32299/'); await page.addScriptTag({ content: clockScript });
    for (const file of ['app/vendor/react-18.3.1/react.production.min.js', 'app/vendor/react-dom-18.3.1/react-dom.production.min.js', 'app/sicof-payment-behavior.jsx', 'app/sicof-simulation-client.js', 'app/sicof-file-repository.js', 'app/sicof-file-flow.jsx', 'app/sicof-admin.jsx']) await page.addScriptTag({ content: fs.readFileSync(path.join(root, file), 'utf8') });
    await page.evaluate(({ actor, affiliate, session }) => {
      window.currentIdentity = actor; window.authListeners = []; window.completed = []; window.clients = []; window.terminated = 0; window.delayReply = 0;
      window.AffiliateAuth = { getState: () => ({ phase: currentIdentity ? 'authenticated' : 'anonymous', session: { user: { id: currentIdentity }, session_id: session }, affiliate: { id: affiliate } }), subscribe: listener => { authListeners.push(listener); return () => { authListeners = authListeners.filter(value => value !== listener); }; } };
      window.SutiSupabase = { getClient: () => ({ functions: { invoke: async (name, request) => ({ data: await __backend(request.body), error: null }) } }) };
      window.SicofRepository = new Proxy({}, { get: (_, name) => () => { throw Error('UNEXPECTED_LEGACY_REPOSITORY_' + String(name)); } });
      const original = SicofSimulationClient;
      window.SicofSimulationClient = { create() { const client = original.create(), initialize = client.initialize, calculate = client.calculate, close = client.close;
        client.initialize = async (...args) => { await initialize(...args); client.testReady = true; };
        client.calculate = async input => { const delay = delayReply; delayReply = 0; const value = await calculate(input); if (delay) await new Promise(resolve => setTimeout(resolve, delay)); completed.push({ input: structuredClone(input), value: structuredClone(value), delayed: delay }); return value; };
        client.close = () => { terminated++; close(); }; clients.push(client); return client;
      } };
      window.ui = ReactDOM.createRoot(document.getElementById('root'));
      ui.render(React.createElement(SicofAdminModule, { app: { admin: { phase: 'authorized', has: () => true } }, onBack: () => {}, header: ({ title }) => React.createElement('div', null, title) }));
    }, { actor, affiliate, session });
    await page.getByRole('heading', { name: '1. Descarga la base de préstamos' }).waitFor();
    assert.equal(api.length, 0); assert.equal(contextReads, 0); assert.equal(sourceReads, 0);
    for (const width of [320, 1440]) { await page.setViewportSize({ width, height: 1100 }); assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)); }
    checks.push('opening and responsive initial workflow perform zero data reads');
    const sourceGroup = page.getByRole('group', { name: 'Fuente de la bolsa', exact: true });
    await sourceGroup.getByRole('button', { name: 'Fondos seleccionados', exact: true }).click();
    await page.getByRole('checkbox', { name: 'Extra', exact: true }).waitFor().catch(async error => { console.error(JSON.stringify({ phase: 'funds', api, errors, body: await page.locator('body').innerText() })); throw error; });
    assert.deepEqual(api.map(row => row.action), ['SOURCE_FUNDS']);
    await sourceGroup.getByRole('button', { name: 'Solo Caja de Ahorro', exact: true }).click();
    await sourceGroup.getByRole('button', { name: 'Fondos seleccionados', exact: true }).click();
    assert.equal(api.length, 1, 'same-range fund discovery is reused');
    await sourceGroup.getByRole('button', { name: 'Todos', exact: true }).click();
    const downloaded = page.waitForEvent('download');
    await page.getByRole('button', { name: '↓ Descargar base de préstamos (.xlsx)', exact: true }).click();
    const download = await downloaded, bytes = fs.readFileSync(await download.path()), workbook = await decode(bytes), sheet = workbook.worksheets[0];
    assert.equal(workbook.worksheets.length, 1); assert.equal(sheet.name, 'HISTORIAL P V2'); assert.equal(sheet.columnCount, 15); assert.equal(sheet.rowCount, 9);
    assert.equal(sheet.getCell('D2').value, '00002'); assert.deepEqual(api.map(row => row.action), ['SOURCE_FUNDS', 'DOWNLOAD_SOURCE']);
    checks.push('explicit fund discovery and download produce one original typed sheet A:O with selected dates');
    const picker = page.getByLabel('Archivo de préstamos (.xlsx)', { exact: true });
    await picker.setInputFiles({ name: 'invalid.csv', mimeType: 'text/csv', buffer: Buffer.from('bad') });
    await page.getByRole('alert').filter({ hasText: 'Selecciona un archivo .xlsx' }).waitFor(); assert.equal(api.length, 2);
    await picker.setInputFiles({ name: 'broken.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: Buffer.from('not a zip') });
    await page.getByRole('button', { name: 'Preparar cálculo con este archivo' }).click();
    await page.getByRole('alert').filter({ hasText: 'No se pudo preparar este archivo' }).waitFor(); assert.equal(api.length, 3);
    const malformed = await decode(bytes); malformed.worksheets[0].getCell('P2').value = 1;
    await picker.setInputFiles({ name: 'extra-column.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: Buffer.from(await malformed.xlsx.writeBuffer()) });
    await page.getByRole('button', { name: 'Preparar cálculo con este archivo' }).click();
    await page.getByRole('alert').waitFor(); assert.equal(api.length, 4); assert.equal(await page.getByRole('tab').count(), 0);
    checks.push('invalid extension is rejected locally; malformed XLSX and extra column fail visibly without a fallback workspace');
    await picker.setInputFiles({ name: 'Synthetic-base.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: bytes });
    const beforePrepare = api.length, beforeContext = contextReads, beforeSource = sourceReads;
    await page.getByRole('button', { name: 'Preparar cálculo con este archivo' }).click();
    const baseButton = () => page.getByRole('button', { name: /Descargar base del cálculo/ });
    await page.waitForFunction(() => clients.at(-1)?.testReady && [...document.querySelectorAll('button')].some(button => button.textContent.includes('Descargar base del') && !button.disabled));
    assert.equal(api.length, beforePrepare + 1); assert.equal(contextReads, beforeContext + 1); assert.equal(sourceReads, beforeSource + 1);
    assert.equal(await page.getByRole('tab').count(), 8); await page.getByText('Archivo: Synthetic-base.xlsx', { exact: true }).waitFor();
    const original = structuredClone(api.at(-1).settings), loaded = lastPrepared, initialCalls = api.length;
    async function assertApplied(settings, label) {
      const input = { settings, costs: [], bank: { amount: null, declaredBy: '', date: '' } };
      const selection = await revalidateFileBasis(loaded.file.basis, source, settings);
      const analysis = scopeFileAnalysis(decorateLoans(analyzeSicofLoans(source, { from: settings.periodIni, to: settings.periodFin, as_of: today })), selection, settings);
      const expected = baseline.calculateSicof(ctx, analysis, input);
      expected.fingerprint = await baseline.fingerprint({ engine: expected.engine_version, settings: expected.settings, costs: expected.costs, bank: expected.bank, context: ctx.fingerprint, loans: analysis.source_fingerprint });
      await page.waitForFunction(fingerprint => completed.some(row => row.value.result.fingerprint === fingerprint) && [...document.querySelectorAll('button')].some(button => button.textContent.includes('Descargar base del') && !button.disabled), expected.fingerprint);
      const actual = await page.evaluate(fingerprint => completed.findLast(row => row.value.result.fingerprint === fingerprint).value, expected.fingerprint);
      assert.deepEqual(plain(actual.result), plain(expected), label + ' matches frozen baseline financial engine');
      const view = workspaceView({ ...ctx, from: settings.periodIni, to: settings.periodFin }, analysis);
      assert.deepEqual(plain(actual.workspace), plain({ loans: view.loans, payments: view.payments, funds: view.funds, paymentMetrics: view.paymentMetrics }), label + ' restores exact source workspace');
      assert.equal(api.length, initialCalls, label + ' adds no API calls'); return actual;
    }
    let settings = { ...original, periodFin: '2026-12-04' };
    await page.getByLabel('Cierre del periodo', { exact: true }).fill(settings.periodFin); await assertApplied(settings, 'inclusive partial cutoff');
    settings = { ...settings, src: 'caja', pay: 97 };
    await sourceGroup.getByRole('button', { name: 'Solo Caja de Ahorro', exact: true }).click();
    await page.getByLabel('Porcentaje del interés a repartir', { exact: true }).fill('96');
    await page.getByLabel('Porcentaje del interés a repartir', { exact: true }).fill('97');
    const caja = await assertApplied(settings, 'fund and percentage');
    assert(caja.result.rows.some(row => row.ov && row.loans.some(loan => loan.fund === 'Other')), 'all-fund canonical loans still inform retention');
    assert(caja.workspace.payments.every(payment => payment.fund === 'Caja de Ahorro'), 'other funds never enter the selected file pool');
    const localDownloadPromise = page.waitForEvent('download'); await baseButton().click();
    const localFile = await localDownloadPromise, localBook = await decode(fs.readFileSync(await localFile.path())), localSheet = localBook.worksheets[0];
    assert.equal(localBook.worksheets.length, 1); assert.equal(localSheet.columnCount, 15); assert.deepEqual(localSheet.getColumn(1).values.slice(2), ['2026-07-01', '2026-10-01', '2026-12-04']);
    assert.deepEqual(localSheet.getRow(1).values.slice(1), source.headers.slice(0, 15)); assert.equal(api.length, initialCalls);
    checks.push('one preparation enriches missing components; local filters equal frozen engine and retain other-fund credit evidence without mixing pool');
    checks.push('local ExcelJS export writes exactly one sheet A:O with inclusive applied dates and funds, with zero RPC');
    await sourceGroup.getByRole('button', { name: 'Fondos seleccionados', exact: true }).click();
    await page.getByLabel('Fondos adicionales', { exact: true }).click();
    await page.getByRole('checkbox', { name: 'Extra', exact: true }).check();
    settings = { ...settings, src: 'sel', selFunds: ['Extra'] }; const selectedFunds = await assertApplied(settings, 'selected funds sparse transport');
    assert(selectedFunds.workspace.payments.some(payment => payment.fund === 'Extra'));
    assert(selectedFunds.workspace.payments.every(payment => ['Caja de Ahorro', 'Extra'].includes(payment.fund)));
    await sourceGroup.getByRole('button', { name: 'Todos', exact: true }).click();
    settings = { ...settings, src: 'todos' }; const allFunds = await assertApplied(settings, 'restored all funds sparse transport');
    assert(allFunds.workspace.payments.some(payment => payment.fund === 'Other'));
    await sourceGroup.getByRole('button', { name: 'Solo Caja de Ahorro', exact: true }).click();
    settings = { ...settings, src: 'caja' }; await assertApplied(settings, 'restored Caja sparse cache');
    checks.push('Todos to Caja to selected funds to Todos to Caja reconstructs exact sparse loan schedules and scoped payments without reads');
    await page.getByLabel('Inicio del periodo', { exact: true }).fill('2026-08-01');
    await page.getByRole('alert').filter({ hasText: 'Este cambio requiere otra base' }).waitFor(); assert.equal(api.length, initialCalls); assert(await baseButton().isDisabled());
    await page.getByLabel('Inicio del periodo', { exact: true }).fill(original.periodIni);
    await page.waitForFunction(() => [...document.querySelectorAll('button')].some(button => button.textContent.includes('Descargar base del') && !button.disabled));
    await page.getByLabel('Cierre del periodo', { exact: true }).fill('2026-09-30');
    await page.getByRole('alert').filter({ hasText: 'Este cambio requiere otra base' }).waitFor(); assert.equal(api.length, initialCalls);
    await page.getByLabel('Cierre del periodo', { exact: true }).fill(settings.periodFin);
    await page.waitForFunction(() => [...document.querySelectorAll('button')].some(button => button.textContent.includes('Descargar base del') && !button.disabled));
    await page.evaluate(() => { __clockShift = 360000; });
    settings = { ...settings, pay: 98 }; await page.getByLabel('Porcentaje del interés a repartir', { exact: true }).fill('98'); await assertApplied(settings, 'explicit frozen file after live-source TTL');
    assert.equal(await page.getByRole('alert').filter({ hasText: 'superó los cinco minutos' }).count(), 0);
    checks.push('unsupported start and historical cutoff fail explicitly with zero auto reads; dated file preview remains usable after live-source TTL');
    for (const tab of ['Resumen', 'Liquidez', 'Reparto por ahorrador', 'Préstamos y pagos', 'Atrasos', 'Reporte préstamos', 'Cumplimiento', 'Informe final de ahorro']) {
      await page.getByRole('tab', { name: tab, exact: true }).click(); assert.equal(await page.getByRole('tab', { name: tab, exact: true }).getAttribute('aria-selected'), 'true'); assert((await page.getByRole('tabpanel').innerText()).trim().length > 0);
    }
    await page.getByRole('tab', { name: 'Resumen', exact: true }).click();
    await page.screenshot({ path: path.join(evidence, 'file-workspace.png'), fullPage: true });
    await page.getByRole('button', { name: 'Cargar otro archivo', exact: true }).click();
    await page.getByRole('heading', { name: '1. Descarga la base de préstamos' }).waitFor();
    assert.equal(await page.getByRole('tab').count(), 0); assert.equal(await page.getByText('Archivo: Synthetic-base.xlsx', { exact: true }).count(), 0); assert.equal(api.length, initialCalls);
    assert(await page.evaluate(() => terminated >= 1));
    await picker.setInputFiles({ name: 'Late-base.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: bytes }); delayPrepare = 350;
    await page.getByRole('button', { name: 'Preparar cálculo con este archivo' }).click();
    await page.waitForFunction(() => document.querySelector('[data-sicof-phase="preparing-file"]'));
    await page.evaluate(() => { currentIdentity = ''; authListeners.forEach(listener => listener()); });
    await page.getByRole('alert').getByText('Acceso administrativo requerido.', { exact: true }).waitFor();
    await page.waitForTimeout(450); assert.equal(await page.getByRole('tab').count(), 0); assert.equal(await page.getByText('Archivo: Late-base.xlsx', { exact: true }).count(), 0);
    assert.deepEqual(await page.evaluate(() => [localStorage.length, sessionStorage.length]), [0, 0]);
    checks.push('all eight sections remain; replacing file clears private workspace; delayed preparation cannot survive session loss');
    assert.deepEqual(errors, []); assert.deepEqual(unexpectedNetwork, []);
    const proof = { status: 'PASS', checks, synthetic: true, network: 'all requests intercepted locally', externalRequests: 0, financialWrites: 0, initialDataReads: 0, dataReadsPerSuccessfulPreparation: 1, apiActions: api.map(row => row.action), sourceReads, contextReads, protectedBaseline: 'c55ef8f237031dfa06c5149e063534414c1aa0f8', performanceClaim: 'None: small-fixture correctness and lifecycle only; full-size browser timing is separate.', errors };
    fs.writeFileSync(path.join(evidence, 'browser.json'), JSON.stringify(proof, null, 2) + '\n'); console.log(JSON.stringify(proof));
    await context.close();
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
