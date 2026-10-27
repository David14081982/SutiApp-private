'use strict';
/* Real Chrome against isolated synthetic contracts. Never reads credentials or sends RPCs. */
const assert = require('assert/strict'), fs = require('fs'), path = require('path');
const root = path.resolve(process.argv[2] || path.join(__dirname, '..'));
const evidence = path.join(root, 'docs/qa/evidence/loan-available-credit');
const { chromium } = require(process.env.SUTIAPP_PLAYWRIGHT_PATH || 'C:/tmp/sutiapp-playwright-audit/node_modules/playwright-core');
const html = '<!doctype html><html lang="es"><meta charset="utf-8"><style>:root{--bg:#f3f4f7;--surface:#fff;--surface-2:#f5f6fa;--ink:#15223e;--ink-2:#45516b;--ink-3:#8793ab;--guinda:#910022;--guinda-50:#fceff3;--guinda-100:#f7dce5;--hairline:#e1e5ed;--hairline-strong:#ccd2df;--grad-guinda:linear-gradient(130deg,#ca5b7a,#98002a);--grad-guinda-soft:linear-gradient(130deg,#ca5b7a,#98002a);--neo-sm:0 2px 5px #15223e18;--font:Arial,sans-serif}*{box-sizing:border-box}body{margin:0;font:14px Arial;background:var(--bg);color:var(--ink)}#root{max-width:420px;margin:auto;padding:20px}button,input,textarea,select{font-family:inherit}button:disabled{cursor:default}</style><body><div id="root"></div></body></html>';
async function main() {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  const page = await browser.newPage({ viewport: { width: 430, height: 920 } });
  const errors = [], external = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('**/*', async (route) => {
    if (route.request().url() === 'http://127.0.0.1/loan-capacity-isolated') return route.fulfill({ status: 200, contentType: 'text/html', body: html });
    external.push(route.request().url()); await route.abort();
  });
  try {
    await page.goto('http://127.0.0.1/loan-capacity-isolated');
    for (const file of ['app/vendor/react-18.3.1/react.production.min.js', 'app/vendor/react-dom-18.3.1/react-dom.production.min.js', 'app/icons.jsx', 'app/ui.jsx', 'app/screens-loan.jsx', 'app/loan-availability-admin.js']) await page.addScriptTag({ path: path.join(root, file) });
    await page.evaluate(() => {
      window.__calls = [];
      const base = { status: 'AVAILABLE', min_amount: 1, suggested_amount: 5000, rate: 3, rate_period: 'quincenal', payment_period: 'quincenal', allowed_terms: [6, 12], custom_term: { min: 1, max: 12, step: 1 } };
      window.__programs = [
        { ...base, id: 'test--caja-chica', program_id: 'prestamo', label: 'Caja Chica', fund: 'Caja Chica', max_amount: 40000, available_amount: 30000 },
        { ...base, id: 'test--aguinaldo', program_id: 'prestamo', label: 'Aguinaldos', fund: 'Aguinaldos', max_amount: 25000, available_amount: 18740.25 },
      ];
      window.__financial = { status: 'ready', overview: { status: 'AVAILABLE', programs: window.__programs }, error: null };
      window.financialLegacyStore = {
        requestLoanSessionQuote: async (id, amount, term) => {
          window.__calls.push({ id, amount, term });
          const program = window.__programs.find((item) => item.id === id);
          const quote = { amount, paymentCount: term, program: program.program_id, fund: program.fund, rate: 3, ratePeriod: 'quincenal', paymentPeriod: 'quincenal', interest: 900, administrativeFeeTotal: 90, administrativeFeePerPayment: 15, total: amount + 990, paymentPerPeriod: (amount + 990) / term, eligibility: true, termOptions: [] };
          return { status: 'ready', quote };
        },
        openLoanSession: async () => window.__financial,
      };
      function Harness() {
        const [financial, setFinancial] = React.useState(window.__financial);
        const [simulation, setSimulation] = React.useState(null);
        window.__updateFinancial = (programs) => {
          window.__programs = programs;
          window.__financial = { status: 'ready', overview: { status: 'AVAILABLE', programs }, error: null };
          setFinancial(window.__financial);
        };
        window.__simulation = simulation;
        return React.createElement(React.Fragment, null,
          React.createElement(window.StepSimulatorV2, { financial, onSimulationChange: setSimulation }),
          React.createElement('button', { 'data-test-continue': '', disabled: !simulation || !simulation.current }, 'Continuar'));
      }
      window.__root = ReactDOM.createRoot(document.getElementById('root'));
      window.__root.render(React.createElement(Harness));
    });
    await page.waitForFunction(() => document.querySelector('[data-simulator-result="ready"]') && !document.querySelector('[data-test-continue]').disabled);
    assert.equal(await page.locator('[data-loan-funds] button').count(), 2);
    assert.equal(await page.locator('[data-fund-available]').first().getAttribute('data-fund-available'), '30000');
    assert.match(await page.locator('[data-fund-available]').nth(1).innerText(), /18,740\.25/);
    await page.getByRole('button', { name: 'Editar monto solicitado' }).click();
    const amount = page.getByRole('spinbutton', { name: 'Monto solicitado' });
    assert.equal(await amount.getAttribute('max'), '30000');
    await amount.fill('35000');
    assert.equal(await page.locator('[data-test-continue]').isDisabled(), true);
    await amount.press('Tab');
    await page.waitForFunction(() => window.__simulation.amount === 30000 && window.__simulation.current);
    assert.equal(await page.evaluate(() => window.__calls.some((call) => call.amount > 30000)), false);
    assert.deepEqual(await page.locator('[data-term-card]').evaluateAll((nodes) => nodes.map((node) => node.dataset.termCard)), ['6', '12']);
    fs.mkdirSync(evidence, { recursive: true });
    await page.screenshot({ path: path.join(evidence, 'isolated-loan-available.png'), fullPage: true });
    await page.evaluate(() => window.__updateFinancial(window.__programs.map((program, index) => index ? program : { ...program, available_amount: 0 })));
    await page.waitForFunction(() => document.querySelector('[data-step-simulator-v2]').dataset.state === 'NO_AVAILABLE_BALANCE');
    assert.equal(await page.locator('[data-loan-funds] button').count(), 2);
    assert.match(await page.locator('[data-fund-available]').first().innerText(), /Hasta \$0$/);
    assert.equal(await page.getByRole('button', { name: 'Editar monto solicitado' }).isDisabled(), true);
    assert.equal(await page.locator('[data-test-continue]').isDisabled(), true);
    assert.equal(await page.locator('[data-odometer-state="spinning"]').count(), 0);
    assert.doesNotMatch(await page.locator('[data-step-simulator-v2]').innerText(), /Cotizando/);
    await page.screenshot({ path: path.join(evidence, 'isolated-loan-exhausted.png'), fullPage: true });
    await page.locator('[data-loan-funds] button').nth(1).click();
    await page.waitForFunction(() => window.__simulation.current && window.__simulation.program.id === 'test--aguinaldo');
    await page.evaluate(() => window.__updateFinancial(window.__programs.map((program, index) => index ? { ...program, available_amount: undefined } : program)));
    await page.waitForFunction(() => document.querySelector('[data-step-simulator-v2]').dataset.state === 'UNAVAILABLE');
    assert.equal(await page.locator('[data-test-continue]').isDisabled(), true);
    assert.equal(await page.getByRole('button', { name: 'Editar monto solicitado' }).isDisabled(), true);
    assert.match(await page.locator('[data-fund-available]').nth(1).innerText(), /Hasta —/);
    assert.equal(await page.locator('[data-odometer-state="spinning"]').count(), 0);
    await page.evaluate(() => {
      window.__adminCalls = []; window.__capacityHistory = [];
      window.__policy = { allow_full: false, version: 0 };
      window.__overrides = { cash: { allow_full: false, version: 0 }, bonus: { allow_full: false, version: 0 } };
      window.__canWrite = true; window.__rpcError = null;
      const workbench = (control) => ({ policy: { ...window.__policy }, can_configure: window.__canWrite, can_authorize: window.__canWrite,
        person: control === '00123' ? { id: 'fixture-affiliate', name: 'Afiliado de prueba aislada', numero_control: '00123' } : null,
        funds: control === '00123' ? [{ id: 'cash', label: 'Caja Chica', program_id: 'prestamo', ...window.__overrides.cash }, { id: 'bonus', label: 'Aguinaldos', program_id: 'prestamo', ...window.__overrides.bonus }] : [],
        history: window.__capacityHistory.slice(),
      });
      window.SutiSupabase = { getClient: () => ({ rpc: async (name, args) => {
        window.__adminCalls.push({ name, args });
        if (window.__rpcError) return { data: null, error: { message: window.__rpcError } };
        if (name === 'get_admin_loan_capacity') return { data: workbench(args.p_numero_control), error: null };
        if (name === 'set_admin_loan_capacity_policy') {
          if (args.p_expected_version !== window.__policy.version) throw Error('Isolated version mismatch');
          window.__policy = { allow_full: args.p_allow_full, version: window.__policy.version + 1 };
        } else {
          const prior = window.__overrides[args.p_fund_id];
          if (args.p_expected_version !== prior.version) throw Error('Isolated version mismatch');
          window.__overrides[args.p_fund_id] = { allow_full: args.p_allow_full, version: prior.version + 1 };
        }
        window.__capacityHistory.push({ action: name.endsWith('policy') ? 'POLICY' : args.p_allow_full ? 'GRANT' : 'REVOKE', created_at: '2026-10-26T12:00:00Z', actor_label: 'Administrador de prueba', reason: args.p_reason });
        return { data: workbench(name.endsWith('override') ? '00123' : null), error: null };
      } }) };
      window.__renderAdmin = (key) => window.__root.render(React.createElement(window.LoanAvailabilityAdmin, { key, app: { admin: { has: (permission) => permission === 'financial_rules.read' || window.__canWrite && permission === 'financial_rules.write' } } }));
      window.__renderAdmin('editable');
    });
    await page.getByRole('button', { name: /Préstamos · saldo disponible/ }).click();
    const globalSwitch = page.getByRole('switch', { name: 'Permitir solicitar el límite completo a todos', exact: true });
    await globalSwitch.waitFor();
    assert.equal(await globalSwitch.getAttribute('aria-checked'), 'false');
    await globalSwitch.click();
    assert.equal(await page.evaluate(() => window.__policy.allow_full), false, 'Draft does not silently persist');
    await page.getByLabel('Motivo del cambio general', { exact: true }).fill('Autorización general de prueba aislada');
    await page.getByRole('button', { name: 'Guardar autorización general' }).click();
    await page.waitForFunction(() => window.__policy.allow_full === true);
    await page.getByLabel('Número de control exacto', { exact: true }).fill('00123');
    await page.getByRole('button', { name: 'Consultar persona', exact: true }).click();
    await page.locator('[data-loan-capacity-person]').waitFor();
    const individual = page.getByRole('switch', { name: 'Permitir el límite completo en este fondo', exact: true });
    await individual.click();
    await page.getByLabel('Motivo de la autorización o revocación', { exact: true }).fill('Autorización individual de prueba aislada');
    await page.getByRole('button', { name: 'Guardar autorización individual' }).click();
    await page.waitForFunction(() => window.__overrides.cash.allow_full === true);
    await globalSwitch.click();
    await page.getByLabel('Motivo del cambio general', { exact: true }).fill('Restablecer saldo disponible en prueba');
    await page.getByRole('button', { name: 'Guardar autorización general' }).click();
    await page.waitForFunction(() => window.__policy.allow_full === false);
    assert.equal(await page.evaluate(() => window.__overrides.cash.allow_full), true);
    await page.getByRole('button', { name: 'Consultar persona', exact: true }).click();
    await page.locator('[data-loan-capacity-person]').waitFor();
    assert.equal(await individual.getAttribute('aria-checked'), 'true');
    await page.screenshot({ path: path.join(evidence, 'isolated-admin-authorizations.png'), fullPage: true });
    await individual.click();
    await page.getByLabel('Motivo de la autorización o revocación', { exact: true }).fill('Revocación individual de prueba aislada');
    await page.getByRole('button', { name: 'Guardar autorización individual' }).click();
    await page.waitForFunction(() => window.__overrides.cash.allow_full === false);
    await page.evaluate(() => { window.__rpcError = 'LOAN_CAPACITY_STALE'; });
    await individual.click();
    await page.getByLabel('Motivo de la autorización o revocación', { exact: true }).fill('Conflicto de versión de prueba aislada');
    await page.getByRole('button', { name: 'Guardar autorización individual' }).click();
    await page.getByRole('alert').waitFor();
    assert.match(await page.getByRole('alert').innerText(), /configuración cambió/);
    assert.equal(await page.evaluate(() => window.__overrides.cash.allow_full), false);
    await page.evaluate(() => { window.__rpcError = null; window.__canWrite = false; window.__renderAdmin('readonly'); });
    await page.getByRole('button', { name: /Préstamos · saldo disponible/ }).click();
    await globalSwitch.waitFor();
    assert.equal(await globalSwitch.isDisabled(), true);
    assert.equal(await page.getByRole('button', { name: 'Guardar autorización general' }).count(), 0);
    const calls = await page.evaluate(() => window.__adminCalls);
    const writes = calls.filter((call) => call.name.startsWith('set_'));
    assert(writes.every((call) => /^[0-9a-f-]{36}$/i.test(call.args.p_client_action_id)));
    assert(calls.some((call) => call.name === 'get_admin_loan_capacity' && call.args.p_numero_control === '00123'));
    assert.deepEqual(errors, []); assert.deepEqual(external, []);
    const result = { status: 'PASS', browser: 'Chrome', isolated: true, productionWrites: 0, externalRequests: 0,
      loan: ['fund-cards-preserved', 'cents', 'max-capture', 'over-limit-disabled', 'zero-visible', 'no-infinite-loading', 'fund-switch', 'missing-source-fail-closed', 'terms-preserved'],
      admin: ['global-default-off', 'explicit-save', 'exact-control', 'individual-grant', 'global-off-preserves-individual', 'individual-revoke', 'version-conflict', 'readonly', 'idempotency-key'], runtimeErrors: errors };
    fs.writeFileSync(path.join(evidence, 'isolated-ui-browser.json'), JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result));
  } finally { await browser.close(); }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
