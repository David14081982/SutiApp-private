'use strict';
// Real source components with explicit isolated backend fixtures; never production.
const fs = require('fs'), path = require('path'), assert = require('assert/strict');
const { chromium } = require(process.env.SUTIAPP_PLAYWRIGHT_PATH || 'C:/tmp/sutiapp-playwright-audit/node_modules/playwright-core');
const root = path.resolve(__dirname, '..'), read = file => fs.readFileSync(path.join(root, file), 'utf8');
async function main() {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  const output = path.join(root, '.tmp/sicof/ui-integration'); fs.mkdirSync(output, { recursive: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } }), errors = [];
    page.on('pageerror', error => { errors.push(error.message); console.error(error.stack); });
    await page.route('**/*', route => route.abort());
    await page.setContent('<style>:root{--surface:#fff;--surface-2:#edf0f5;--hairline:#e1e5ed;--ink:#172033;--ink-2:#364154;--ink-3:#657086;--guinda:#901040;--mono:monospace;--bg:#f6f6fa;--font:Arial;--grad-guinda:#901040}*{box-sizing:border-box}body{font-family:Arial;background:#f3f5f9;margin:0}html,body,#fixture{height:100%;width:100%}button,input,textarea,select{font-family:inherit}</style><div id="fixture"></div>');
    for (const file of ['app/vendor/react-18.3.1/react.production.min.js', 'app/vendor/react-dom-18.3.1/react-dom.production.min.js']) await page.addScriptTag({ content: read(file) });
    const projection = read('supabase/functions/sicof/projection.mjs');
    await page.addScriptTag({ content: projection.slice(projection.indexOf('export function compactWorkspace(')).replace('export function', 'function') });
    await page.evaluate(() => {
      let serial = 0; window.crypto.randomUUID = () => 'test-action-' + (++serial);
      window.Icon = () => null; window.SutiSeal = () => null; window.money = value => '$' + value;
      window.callbacks = []; window.actor = 'synthetic-admin'; window.phase = 'authorized'; window.edgeCalls = []; window.operations = []; window.failOperation = false; window.failComposition = false;
      window.AffiliateAuth = { getState: () => ({ phase: actor ? 'authenticated' : 'anonymous', session: { user: { id: actor }, access_token: 'synthetic' }, affiliate: { id: 'synthetic-owner' } }), subscribe: fn => { callbacks.push(fn); return () => { callbacks = callbacks.filter(item => item !== fn); }; }, signOut: () => {} };
      window.AdminRepository = { getState: () => ({ phase, assignment: { roleCode: 'principal_admin' } }), subscribe: () => () => {} };
      window.composition = { version: 'allocation-v1', balances: { capital: 110, yield_amount: 20, total: 130, available: 130 }, periods: [
        { origin_key: '2025', component: 'CAPITAL', period_year: 2025, semester: null, recognized: 80, withdrawn: 0, adjustments: 0, remaining: 80 },
        { origin_key: '2025', component: 'YIELD', period_year: 2025, semester: null, recognized: 20, withdrawn: 0, adjustments: 0, remaining: 20 },
        { origin_key: '2026-S1', component: 'CAPITAL', period_year: 2026, semester: 1, recognized: 30, withdrawn: 0, adjustments: 0, remaining: 30 }
      ] };
      window.requestFixture = { id: 'synthetic-request', participant_id: 'synthetic-person', saver_folio: 'TEST-01', folio: 'TEST-WITHDRAW', name: 'PERSONA SINTÉTICA', request_type: 'WITHDRAW', status: 'APPROVED', requested_amount: 35, can_settle: true, can_review: false, can_cancel: false, continue_saving: true };
      window.SutiSupabase = { getClient: () => ({ functions: { invoke: async (name, options) => {
        const args = options.body; edgeCalls.push(structuredClone(args)); let data;
        if (args.action === 'WORKSPACE') data = { workspace: { source: { status: 'READY', observed_at: '2026-10-03T12:00:00Z' }, funds: [], loans: [], payments: [], participants: [], periods: [], scenarios: [], preferences: {}, report: { rows: [] } }, result: { fingerprint: 'synthetic-result', rate: 5, pool: 0, collected: 0, projected: 0, distributed: 0, base: 0, reserve: 0, rows: [], nqual: 0, nexcl: 0, alerts: [], liquidity: {}, compliance: [] } };
        else if (args.action === 'LOAD') data = { source: { status: 'READY', observed_at: '2026-10-03T12:00:00Z' }, funds: [], loans: [], payments: [], participants: [], periods: [], scenarios: [], preferences: {}, report: { rows: [] } };
        else if (args.action === 'CALCULATE') data = { fingerprint: 'synthetic-result', rate: 5, pool: 0, collected: 0, projected: 0, distributed: 0, base: 0, reserve: 0, rows: [], nqual: 0, nexcl: 0, alerts: [], liquidity: {}, compliance: [] };
        else if (args.action === 'BEHAVIOR') data = Object.fromEntries(args.affiliate_ids.map(id => [id, { status: 'CURRENT', label: 'Al corriente', loans: [] }]));
        else throw Error('Unexpected isolated action: ' + args.action);
        if (args.action === 'WORKSPACE' && args.compact) data = JSON.parse(JSON.stringify(compactWorkspace(data)));
        return { data: { context: { actor, effective_affiliate: 'synthetic-owner' }, data } };
      } }, rpc: async (name, args) => {
        if (name !== 'get_admin_savings_period_composition') throw Error('Unexpected RPC: ' + name);
        if (failComposition) return { error: { message: 'NETWORK' } };
        return { data: structuredClone(composition) };
      } }) };
      window.SavingsPanelRepository = {
        runtimeRequests: async () => ({ can_create: false, requests: [requestFixture] }),
        operation: async command => {
          operations.push(structuredClone(command)); if (failOperation) throw Error('NETWORK');
          requestFixture.status = 'SETTLED'; requestFixture.can_settle = false;
          composition = { version: 'allocation-v2', balances: { capital: 80, yield_amount: 15, total: 95, available: 95 }, periods: [
            { origin_key: '2025', component: 'CAPITAL', period_year: 2025, semester: null, recognized: 80, withdrawn: 20, adjustments: 0, remaining: 60 },
            { origin_key: '2025', component: 'YIELD', period_year: 2025, semester: null, recognized: 20, withdrawn: 5, adjustments: 0, remaining: 15 },
            { origin_key: '2026-S1', component: 'CAPITAL', period_year: 2026, semester: 1, recognized: 30, withdrawn: 10, adjustments: 0, remaining: 20 }
          ] }; return { success: true };
        }
      };
      window.GeneratedDocuments = () => null;
      window.SavingsRepository = {
        getSelfIdentityKey: () => actor + ':synthetic-person', clearSelfCache: () => {}, prepareSelfContext: () => {}, subscribeSelfInvalidation: () => () => {},
        getSelfDashboard: async () => ({ participant: { id: 'synthetic-person' }, balances: composition.balances, period_balances: composition,
          annual: [{ year: '2025', capital: 80, yield: 20, closed: true }, { year: '2026-S1', label: '2026 · Enero a junio', capital: 30, yield: 0, closed: true }],
          enrollment: { status: 'Ahorrando', current_contribution_amount: 10, frequency: 'TWICE_MONTHLY', enrollment_started_at: '2025-01-15' }, history: [], withdrawals: [{ id: 'test-debit', effective_date: '2026-10-03', amount: 35, status: 'Pagado' }],
          actions: { WITHDRAW: true, CHANGE_AMOUNT: true }, write_capabilities: { requests: true }
        })
      };
      window.useSavingsBeneficiaries = () => ({ phase: 'ready', data: { beneficiaries: [] }, retry: () => {} });
      window.SavingsJoinAccess = () => null; window.SavingsRequestForm = () => null; window.SavingsRequestHistory = () => null;
      window.SavingsBeneficiariesExperience = () => null;
      const stage = { id: 'received', label: 'Solicitud recibida', state: 'current' };
      window.financeRows = Array.from({ length: 6 }, (_, index) => ({ id: 'request-' + index, affiliate_id: 'affiliate-' + Math.floor(index / 2), affiliate: { full_name: 'PERSONA DE PRUEBA ' + index }, folio: 'TEST-' + index, numero_control: 'TEST-01', program_id: 'prestamo', program_item: { name: 'Préstamo sintético' }, requested_amount: 200, requested_term: 2, requested_term_semantics: 'quincenal', status: 'submitted', request_type: 'benefit', created_at: '2026-10-03T12:00:00Z', workflow_state: { available: true, stages: [stage], current_stage: stage } }));
      window.ProgramRequestRepository = { listAdminFlowQueue: async () => financeRows, adminFlowDetail: async id => financeRows.find(row => row.id === id), listFinancialMobile: async () => financeRows.map(row => ({ id: row.id, financial_submission_snapshot: { financialResult: { fund: 'Caja de Ahorro' } } })) };
      window.AffiliateRepository = { getProfilePhoto: async () => null };
      window.appFixture = { admin: { phase: 'authorized', has: () => true, assignment: { permissions: ['savings.read', 'savings.config', 'program_requests.read'], moduleKeys: ['sicof', 'finanzas', 'savings'] } }, back: () => {}, viewApp: () => {}, toast: () => {} };
      window.ui = ReactDOM.createRoot(document.getElementById('fixture'));
    });
    for (const file of ['app/sicof-repository.js', 'app/sicof-payment-behavior.jsx', 'app/sicof-admin.jsx', 'app/savings-period-breakdown.jsx', 'app/savings-panel-reference.jsx', 'app/savings-runtime-admin.jsx', 'app/savings-store.jsx', 'app/screens-savings.jsx', 'app/screens-admin.jsx', 'app/private-resource-demand.js', 'app/admin-finance-queue-repository.js', 'app/screens-admin-finanzas.jsx']) {
      await page.addScriptTag({ content: read(file).replace('  function FinanzasModule(', '  window.__SicofFinancialWorkbench = DesktopFinancialWorkbench;\n  function FinanzasModule(') });
    }
    await page.evaluate(() => ui.render(React.createElement(AdminScreen, { app: appFixture })));
    await page.locator('[data-admin-desktop-sidebar]').waitFor();
    if (!await page.locator('[data-admin-sidebar-module=sicof]').count()) await page.locator('[data-admin-sidebar-group=finance]').click();
    await page.locator('[data-admin-sidebar-module=sicof]').click();
    await page.locator('[data-admin-view=sicof]').waitFor(); await page.getByText('5%', { exact: true }).waitFor();
    assert.deepEqual(await page.evaluate(() => edgeCalls.map(call => call.action)), ['WORKSPACE'], 'one actual repository call, no LOAD/CALCULATE chain');
    assert.equal(await page.evaluate(() => location.hash), '#/admin/sicof');
    assert.equal(await page.locator('input[type=password]').count(), 0);
    await page.screenshot({ path: path.join(output, 'admin-sidebar.png') });
    const reads = await page.evaluate(() => edgeCalls.length);
    await page.evaluate(() => { appFixture.admin.assignment.moduleKeys = ['finanzas']; ui.render(React.createElement(AdminScreen, { key: 'restricted', app: appFixture })); });
    await page.locator('[data-admin-view=menu]').waitFor(); assert.equal(await page.locator('[data-admin-module=sicof]').count(), 0);
    assert.equal(await page.evaluate(() => edgeCalls.length), reads);
    await page.evaluate(() => { appFixture.admin.phase = 'denied'; ui.render(React.createElement(AdminScreen, { key: 'denied', app: appFixture })); });
    await page.locator('[data-h008-admin-access=denied]').waitFor(); assert.equal(await page.locator('[data-admin-view=sicof]').count(), 0);
    await page.evaluate(() => { appFixture.admin.phase = 'authorized'; appFixture.admin.has = () => false; ui.render(React.createElement(__SicofFinancialWorkbench, { app: appFixture, onCount: () => {} })); });
    const queueRows = page.locator('[data-financial-queue-row]'); await queueRows.first().waitFor();
    await page.locator('[data-sicof-behavior]').first().getByText('Al corriente', { exact: true }).waitFor();
    const behaviorCalls = await page.evaluate(() => edgeCalls.filter(call => call.action === 'BEHAVIOR'));
    assert.equal(behaviorCalls.length, 1); assert.equal(behaviorCalls[0].affiliate_ids.length, 3);
    assert.deepEqual(await page.locator('.finwb-queue-head>span').allTextContents(), ['Folio', 'Foto', 'Afiliado / programa', 'Monto / plazo', 'Estado / etapa', 'Antig.']);
    await page.locator('[data-sicof-behavior]').first().click(); await page.getByRole('dialog', { name: 'Comportamiento de pagos', exact: true }).waitFor();
    assert.equal(await page.locator('dialog[open]').count(), 0, 'Behavior must not open request modal'); await page.keyboard.press('Escape');
    for (const width of [320, 430, 1440]) { await page.setViewportSize({ width, height: 1000 }); assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)); }
    await page.evaluate(() => ui.render(React.createElement(SavingsRequestsAdmin, { expanded: true, folio: 'TEST-01', onSaved: () => {} })));
    await page.getByRole('button', { name: 'Registrar entrega', exact: true }).click();
    await page.getByLabel('Capital que se entrega', { exact: true }).fill('30'); await page.getByLabel('Rendimiento que se entrega', { exact: true }).fill('5');
    await page.locator('[data-savings-withdrawal-origins]').waitFor();
    await page.getByLabel('He comprobado los importes de la entrega.', { exact: true }).check();
    assert(await page.getByRole('button', { name: 'Confirmar entrega', exact: true }).isDisabled());
    const allocationInputs = page.locator('[data-savings-withdrawal-origins] input');
    await allocationInputs.nth(0).fill('20'); await allocationInputs.nth(1).fill('5'); await allocationInputs.nth(2).fill('10');
    await page.getByRole('button', { name: 'Confirmar entrega', exact: true }).waitFor(); assert(await page.getByRole('button', { name: 'Confirmar entrega', exact: true }).isEnabled());
    await allocationInputs.nth(0).fill('81'); assert(await page.getByRole('button', { name: 'Confirmar entrega', exact: true }).isDisabled());
    await allocationInputs.nth(0).fill('20'); await page.evaluate(() => { failOperation = true; });
    await page.getByRole('button', { name: 'Confirmar entrega', exact: true }).click(); await page.getByRole('alert').waitFor();
    await page.evaluate(() => { failOperation = false; }); await page.getByRole('button', { name: 'Confirmar entrega', exact: true }).click();
    await page.getByText('Entrega registrada. Se actualizó el saldo y el historial.', { exact: true }).waitFor();
    const writes = await page.evaluate(() => operations);
    assert.equal(writes.length, 2); assert.equal(writes[0].key, writes[1].key);
    assert.deepEqual(writes[1].command.origin_allocations, [{ component: 'CAPITAL', origin_key: '2025', amount: 20 }, { component: 'YIELD', origin_key: '2025', amount: 5 }, { component: 'CAPITAL', origin_key: '2026-S1', amount: 10 }]);
    assert.equal(writes[1].command.allocation_version, 'allocation-v1');
    await page.evaluate(() => ui.render(React.createElement(SavingsScreen, { app: appFixture })));
    await page.locator('[data-savings-total="95"]').waitFor();
    assert.equal(await page.locator('[data-savings-year]').count(), 2, 'Original annual cards preserved');
    assert.equal(await page.locator('[data-savings-year-capital="80"]').count(), 1, 'Historical reference is not rewritten');
    for (const [key, expected] of [['2025:CAPITAL', '$60.00'], ['2025:YIELD', '$15.00'], ['2026-S1:CAPITAL', '$20.00']]) assert.equal(await page.locator('[data-savings-period-remaining="' + key + '"]').textContent(), expected);
    for (const key of ['WITHDRAW', 'CHANGE_AMOUNT']) assert.equal(await page.locator('[data-savings-action="' + key + '"]').count(), 1);
    for (const key of ['history', 'withdrawals', 'beneficiaries']) assert.equal(await page.locator('[data-savings-detail="' + key + '"]').count(), 1);
    await page.locator('[data-savings-detail=withdrawals]').click(); await page.locator('[data-savings-withdrawals]').getByText('−$35.00', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Cerrar', exact: true }).click();
    await page.setViewportSize({ width: 430, height: 1000 }); await page.screenshot({ path: path.join(output, 'savings-withdrawn-periods.png'), fullPage: true });
    assert.deepEqual(errors, []);
    const proof = { status: 'PASS', network: 'BLOCKED', productionWrites: 0, checks: ['real Admin sidebar route', 'module-restricted and denied access', 'real Finance queue layout preserved', 'one behavior batch for repeated affiliates', 'behavior modal click does not open request', 'queue responsive 320/430/1440', 'existing settlement requires exact period/component allocation', 'over-allocation blocked', 'idempotent retry preserves allocation version', 'canonical total after withdrawal', 'annual references preserved', 'withdrawals reflect source periods', 'self savings actions and detail navigation preserved'] };
    fs.writeFileSync(path.join(output, 'browser.json'), JSON.stringify(proof, null, 2)); console.log(JSON.stringify(proof));
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error.stack); process.exitCode = 1; });
