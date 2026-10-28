'use strict';
/* Isolated real repository/components and Chrome. No credentials or remote requests. */
const assert = require('assert/strict'), fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.resolve(process.argv[2] || path.join(__dirname, '..'));
const baseline = process.argv[3] && path.resolve(process.argv[3]);
const evidence = path.join(root, 'docs/qa/evidence/loan-historical-resolution');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const mapping = 'HISTORICAL_LOAN_MAPPING_REQUIRED', review = 'HISTORICAL_LOAN_DATA_REVIEW_REQUIRED';
async function testRepository() {
  const results = [];
  for (const code of [mapping, review, 'AFFILIATE_CONTEXT_UNAVAILABLE']) {
    for (const scenario of ['opening', 'expiry-refresh', 'invalid-snapshot-refresh']) {
      let failure = scenario === 'opening', quoteCalls = 0, opens = 0;
      const client = {
        auth: { getSession: async () => ({ data: { session: { user: { id: 'isolated-actor' } } } }) },
        functions: { invoke: async (_, { body }) => {
          assert.equal(body.action, 'loanSessionOpen'); opens++;
          if (failure) return { error: { message: 'FunctionsHttpError', context: { clone: () => ({ json: async () => ({ error: code }) }) } } };
          return { data: { data: { programs: [{ status: 'AVAILABLE' }], loanSession: {
            id: 'isolated-snapshot', expires_at: new Date(Date.now() + (scenario === 'expiry-refresh' ? 1000 : 900000)).toISOString(),
          } } } };
        } },
        rpc: async () => { quoteCalls++; return { error: { message: 'SNAPSHOT_INVALID' } }; },
      };
      const window = { SutiSupabase: { getClient: () => client } };
      vm.runInNewContext(read('app/financial-legacy-repository.js'), { window, Object, Number, Date, Set, Error });
      const store = window.financialLegacyStore;
      let result = await store.openLoanSession();
      if (scenario !== 'opening') { failure = true; result = await store.requestLoanSessionQuote('isolated-fund', 100, 6); }
      assert.equal(result.status, 'error'); assert.equal(result.error, code);
      assert.equal(result.overview, null); assert.equal(result.loanSession, null); assert.equal(result.quote, null);
      assert.equal(opens, scenario === 'opening' ? 1 : 2);
      assert.equal(quoteCalls, scenario === 'invalid-snapshot-refresh' ? 1 : 0);
      results.push({ code, scenario, status: 'PASS' });
    }
  }
  return results;
}
const html = '<!doctype html><html lang="es"><meta charset="utf-8"><style>:root{--bg:#f3f4f7;--surface:#fff;--surface-2:#f5f6fa;--ink:#15223e;--ink-2:#45516b;--ink-3:#8793ab;--guinda:#910022;--guinda-50:#fceff3;--guinda-100:#f7dce5;--hairline:#e1e5ed;--hairline-strong:#ccd2df;--grad-guinda:linear-gradient(130deg,#ca5b7a,#98002a);--grad-guinda-soft:linear-gradient(130deg,#ca5b7a,#98002a);--neo-sm:0 2px 5px #15223e18;--font:Arial,sans-serif}*{box-sizing:border-box}body{margin:0;font:14px Arial;background:var(--bg);color:var(--ink)}#root{height:100vh;position:relative}button,input,textarea,select{font-family:inherit}button:disabled{cursor:default}</style><body><div id="root"></div></body></html>';
async function boot(page, screenRoot, mode, errors, external) {
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('**/*', async (route) => {
    if (route.request().url() === 'http://127.0.0.1/loan-historical-isolated') return route.fulfill({ status: 200, contentType: 'text/html', body: html });
    external.push(route.request().url()); await route.abort();
  });
  await page.goto('http://127.0.0.1/loan-historical-isolated');
  for (const file of ['app/vendor/react-18.3.1/react.production.min.js', 'app/vendor/react-dom-18.3.1/react-dom.production.min.js', 'app/icons.jsx', 'app/motion.jsx', 'app/ui.jsx']) await page.addScriptTag({ path: path.join(root, file) });
  await page.evaluate(({ mode, mapping, review }) => {
    window.__mode = mode; window.__calls = []; window.__back = 0; window.__release = null;
    const base = { status: 'AVAILABLE', program_id: 'prestamo', min_amount: 1, suggested_amount: 5000,
      max_amount: 40000, rate: 3, rate_period: 'quincenal', payment_period: 'quincenal',
      allowed_terms: [6, 12], custom_term: { min: 1, max: 12, step: 1 } };
    window.__programs = [{ ...base, id: 'fixture--caja-chica', label: 'Caja Chica', fund: 'Caja Chica', available_amount: 30000 },
      { ...base, id: 'fixture--aguinaldos', label: 'Aguinaldos', fund: 'Aguinaldos', available_amount: 18740.25 }];
    const session = () => ({ id: 'isolated-snapshot', expires_at: new Date(Date.now() + 900000).toISOString() });
    window.SutiSupabase = { getClient: () => ({
      auth: { getSession: async () => ({ data: { session: { user: { id: 'isolated-actor' } } } }) },
      functions: { invoke: async (_, { body }) => {
        window.__calls.push(body);
        if (body.action === 'loanSessionValidate') return { data: { data: { googleResolutionCount: 0, loanSession: session() } } };
        if (body.action !== 'loanSessionOpen') throw Error('Unexpected action in isolated UI: ' + body.action);
        if (window.__mode === 'held-mapping') await new Promise((resolve) => { window.__release = resolve; });
        const code = { 'held-mapping': mapping, mapping, review, identity: 'AFFILIATE_CONTEXT_UNAVAILABLE', generic: 'ISOLATED_SERVICE_ERROR' }[window.__mode];
        if (code) return { error: { message: 'FunctionsHttpError', context: { clone: () => ({ json: async () => ({ error: code }) }) } } };
        return { data: { data: { status: 'AVAILABLE', programs: window.__programs, loanSession: session() } } };
      } },
      rpc: async (name, args) => {
        window.__calls.push({ name, args });
        if (name !== 'resolve_current_loan_snapshot_quote') throw Error('Unexpected RPC: ' + name);
        const program = window.__programs.find((item) => item.id === args.p_program_id);
        const amount = args.p_amount, term = args.p_term;
        return { data: { amount, paymentCount: term, program: program.program_id, fund: program.fund,
          rate: 3, ratePeriod: 'quincenal', paymentPeriod: 'quincenal', interest: 900,
          administrativeFeeTotal: 90, administrativeFeePerPayment: 15, total: amount + 990,
          paymentPerPeriod: (amount + 990) / term, maxAmount: program.available_amount, maxTerm: 12,
          eligibility: true, customTerm: program.custom_term, termOptions: [6, 12].map((value) => ({
            term: value, paymentCount: value, interest: 900, administrativeFeeTotal: 90,
            administrativeFeePerPayment: 90 / value, total: amount + 990, paymentPerPeriod: (amount + 990) / value,
          })), loanSession: session() } };
      },
    }) };
    window.BankAccountRepository = {
      listDeposit: async () => [{ id: 'isolated-bank', bank_name: 'Banco de prueba', card_number: '1111222233334444', maskedCard: '•••• 4444', is_primary: true }],
      getNotificationPhone: async () => ({ notification_phone: '6621112233', source: 'CURRENT_NOTIFICATION_PHONE' }),
      saveNotificationPhone: async () => { throw Error('No writes expected'); },
    };
    window.DocumentWorkflowRepository = { requirements: async () => [], listSelfDocuments: async () => [] };
    window.ProgramTermsRepository = { current: async () => ({ id: 'isolated-terms' }) };
    window.ProgramRequestRepository = { newIdempotencyKey: () => 'isolated-not-submitted' };
  }, { mode, mapping, review });
  await page.addScriptTag({ path: path.join(root, 'app/financial-legacy-repository.js') });
  await page.addScriptTag({ path: path.join(screenRoot, 'app/screens-loan.jsx') });
  await page.evaluate(() => {
    window.__root = ReactDOM.createRoot(document.getElementById('root'));
    window.__root.render(React.createElement(window.LoanScreen, { app: { back: () => { window.__back++; } } }));
  });
}
const footer = (page) => page.locator('[data-loan-flow-footer] button');
async function ready(page) {
  await page.waitForFunction(() => document.querySelector('[data-step-simulator-v2]')?.dataset.state === 'READY' && !document.querySelector('[data-loan-flow-footer] button').disabled);
}
async function structure(page) {
  return page.evaluate(() => ({
    stepLabels: document.querySelector('[data-loan-flow-step]').innerText,
    sections: Array.from(document.querySelectorAll('[data-simulator-result],[data-loan-funds],[data-loan-amount-card],[data-loan-terms]')).map((node) => Array.from(node.attributes).find((attr) => /data-(simulator-result|loan-funds|loan-amount-card|loan-terms)/.test(attr.name)).name),
    funds: Array.from(document.querySelectorAll('[data-loan-funds] button')).map((node) => node.innerText),
    terms: Array.from(document.querySelectorAll('[data-term-card]')).map((node) => node.dataset.termCard),
    back: document.querySelector('button[aria-label="Volver"]') !== null,
  }));
}
async function testBrowser() {
  const { chromium } = require(process.env.SUTIAPP_PLAYWRIGHT_PATH || 'C:/tmp/sutiapp-playwright-audit/node_modules/playwright-core');
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  const errors = [], external = [], checks = [];
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  try {
    await boot(page, root, 'held-mapping', errors, external);
    await page.waitForFunction(() => typeof window.__release === 'function');
    assert.equal(await page.locator('[data-step-simulator-v2]').getAttribute('data-state'), 'LOADING');
    assert.match(await footer(page).innerText(), /Actualizando/);
    await page.evaluate(() => window.__release());
    for (const [mode, expected, title] of [['mapping', mapping, /revisar el fondo/], ['review', review, /revisar un préstamo/]]) {
      if (mode === 'review') await page.evaluate(async () => { window.__mode = 'review'; await window.financialLegacyStore.openLoanSession(); });
      await page.waitForFunction((code) => document.querySelector('[data-step-simulator-v2]').dataset.creditState === code, expected);
      assert.match(await page.getByRole('alert').innerText(), title);
      assert.doesNotMatch(await page.getByRole('alert').innerText(), /simulación|HISTORICAL_|LOAN_CAPACITY_/);
      assert.equal(await footer(page).isDisabled(), true); assert.match(await footer(page).innerText(), /Revisión requerida/);
      assert.equal(await page.locator('[data-odometer-digit]').count(), 0);
      assert.doesNotMatch(await page.locator('[data-simulator-result]').innerText(), /[0-9$]/);
      assert.equal(await page.locator('[data-simulator-result]').getAttribute('aria-busy'), 'false');
      assert.equal(await page.locator('[data-loan-funds] button').count(), 0, 'No fabricated catalog after source failure');
      assert.equal(await page.getByRole('button', { name: 'Editar monto solicitado' }).isDisabled(), true);
      assert.equal(await page.locator('[data-loan-terms]').count(), 1);
      assert.equal(await page.locator('[data-custom-term-editor]').count(), 0);
      assert.doesNotMatch(await page.locator('[data-loan-terms]').innerText(), /0 pagos/);
      assert.match(await page.locator('[data-loan-flow-step]').innerText(), /Monto[\s\S]*Depósito[\s\S]*Documentos[\s\S]*Resumen/);
      assert.doesNotMatch(await page.locator('body').innerText(), /Actualizando|Cotizando/);
      await page.screenshot({ path: path.join(evidence, mode + '-required.png'), fullPage: true });
      checks.push(expected);
    }
    await page.evaluate(() => { window.__mode = 'ready'; });
    await page.getByRole('button', { name: 'Reintentar', exact: true }).click();
    await ready(page);
    const after = await structure(page);
    assert.equal(after.funds.length, 2); assert.deepEqual(after.terms, ['6', '12']);
    await page.screenshot({ path: path.join(evidence, 'ready-after.png'), fullPage: true });
    if (baseline) {
      const before = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
      await boot(before, baseline, 'ready', errors, external); await ready(before);
      assert.deepEqual(await structure(before), after);
      await before.screenshot({ path: path.join(evidence, 'ready-before.png'), fullPage: true });
      await before.close(); checks.push('approved-main-structure-equivalent');
    }
    await page.getByRole('button', { name: 'Editar monto solicitado' }).click();
    await page.getByRole('spinbutton', { name: 'Monto solicitado' }).fill('7000');
    await page.getByRole('spinbutton', { name: 'Monto solicitado' }).press('Tab'); await ready(page);
    await page.locator('[data-term-card="12"]').click(); await ready(page);
    await page.getByRole('button', { name: 'Ver desglose completo', exact: true }).click();
    assert.equal(await page.getByRole('button', { name: 'Desglose del préstamo', exact: true }).getAttribute('aria-expanded'), 'true');
    await footer(page).click(); await page.locator('[data-loan-deposit-step="ready"]').waitFor();
    assert.equal(await page.locator('[data-deposit-account="ready"]').count(), 1);
    assert.equal(await footer(page).isDisabled(), false);
    await page.getByRole('button', { name: 'Volver', exact: true }).click(); await ready(page);
    checks.push('retry-recovers', 'amount-edit', 'term-select', 'breakdown', 'deposit-navigation');
    await page.evaluate(async () => {
      window.__programs[0] = { ...window.__programs[0], available_amount: 0 };
      await window.financialLegacyStore.openLoanSession();
    });
    await page.waitForFunction(() => document.querySelector('[data-step-simulator-v2]').dataset.creditState === 'NO_CREDIT_AVAILABLE');
    assert.match(await page.locator('[data-simulator-state="NO_AVAILABLE_BALANCE"]').innerText(), /Sin saldo disponible/);
    assert.equal(await page.locator('[data-loan-funds] button').count(), 2);
    assert.equal(await page.locator('[data-fund-available]').first().getAttribute('data-fund-available'), '0');
    assert.equal(await footer(page).isDisabled(), true); assert.match(await footer(page).innerText(), /Continuar/);
    assert.equal(await page.locator('[data-odometer-digit]').count(), 0);
    await page.screenshot({ path: path.join(evidence, 'no-credit-available.png'), fullPage: true });
    await page.locator('[data-loan-funds] button').nth(1).click(); await ready(page);
    checks.push('NO_CREDIT_AVAILABLE', 'zero-retains-fund-carousel', 'switch-to-available-fund');
    await page.evaluate(async () => { window.__mode = 'mapping'; await window.financialLegacyStore.openLoanSession(true); });
    await page.waitForFunction((code) => document.querySelector('[data-step-simulator-v2]').dataset.creditState === code, mapping);
    assert.equal(await page.evaluate(() => window.financialLegacyStore.snapshot().quote), null);
    assert.equal(await page.locator('[data-odometer-digit]').count(), 0);
    assert.equal(await footer(page).isDisabled(), true);
    checks.push('successful-quote-invalidated-on-source-error');
    await page.evaluate(async () => { window.__mode = 'generic'; await window.financialLegacyStore.openLoanSession(); });
    await page.waitForFunction(() => document.querySelector('[data-step-simulator-v2]').dataset.state === 'ERROR');
    assert.equal(await page.locator('[data-odometer-digit]').count(), 0);
    assert.doesNotMatch(await footer(page).innerText(), /Actualizando/);
    assert.equal(await footer(page).isDisabled(), true);
    await page.getByRole('button', { name: 'Volver', exact: true }).click();
    assert.equal(await page.evaluate(() => window.__back), 1);
    assert.equal(await page.evaluate(() => window.__calls.some((call) => call.action?.includes('Confirm'))), false);
    checks.push('generic-failure-stops-loading', 'back-navigation');
    assert.deepEqual(errors, []); assert.deepEqual(external, []);
    return { status: 'PASS', browser: 'Chrome', viewport: '390x844', checks, runtimeErrors: errors, externalRequests: external.length };
  } finally { await browser.close(); }
}
async function main() {
  fs.mkdirSync(evidence, { recursive: true });
  const repository = await testRepository(), browser = await testBrowser();
  const result = { status: 'PASS', isolated: true, productionWrites: 0, repository, browser };
  fs.writeFileSync(path.join(evidence, 'ui-browser.json'), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result));
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
