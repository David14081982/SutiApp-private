'use strict';
// Isolated canonical movement fixtures; no production or ledger writes.
const fs = require('fs'), path = require('path'), assert = require('assert/strict');
const { chromium } = require(process.env.SUTIAPP_PLAYWRIGHT_PATH || 'C:/tmp/sutiapp-playwright-audit/node_modules/playwright-core');
const root = path.resolve(__dirname, '..'), read = file => fs.readFileSync(path.join(root, file), 'utf8');
async function main() {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  const output = path.join(root, '.tmp/sicof/ui-attribution'); fs.mkdirSync(output, { recursive: true });
  try {
    const page = await browser.newPage({ viewport: { width: 430, height: 900 } }), errors = [];
    page.on('pageerror', error => { errors.push(error.message); console.error(error.stack); }); await page.route('**/*', route => route.abort());
    await page.setContent('<body style="font-family:Arial"><div id="fixture"></div></body>');
    for (const file of ['app/vendor/react-18.3.1/react.production.min.js', 'app/vendor/react-dom-18.3.1/react-dom.production.min.js', 'app/sicof-payment-behavior.jsx', 'app/sicof-admin.jsx']) await page.addScriptTag({ content: read(file) });
    await page.evaluate(() => {
      let serial = 0; crypto.randomUUID = () => 'test-key-' + (++serial); window.calls = []; window.fail = ''; window.saved = 0; window.closeCount = 0; window.version = 'v1'; window.permitted = true;
      window.AffiliateAuth = { getState: () => ({ phase: 'authenticated', session: { user: { id: 'test-admin' } }, affiliate: { id: 'test-affiliate' } }), subscribe: () => () => {} };
      const movement = (id, type, amount, direction) => ({ transaction_id: id, type, amount, direction, component: 'YIELD', effective_date: '2026-04-15', can_classify: true });
      const write = async (kind, args) => { calls.push({ kind, args }); if (fail) { const code = fail; fail = ''; throw Error(code); } return { attributed: true }; };
      window.SicofRepository = {
        composition: async participantId => { calls.push({ kind: 'composition', participantId }); return { version, participant_id: participantId, can_attribute: permitted, balances: { yield_amount: 30, capital: 0, total: 30, available: 30 }, movements: [movement('opening', 'REGULARIZATION', 40, 'CREDIT'), movement('withdrawal', 'WITHDRAWAL', 10, 'DEBIT')], periods: [{ origin_key: 'OPENING', component: 'YIELD', recognized: 40, withdrawn: 10, remaining: 30 }] }; },
        attributeOpening: args => write('opening', args), attributeWithdrawal: args => write('withdrawal', args)
      };
      window.ui = ReactDOM.createRoot(document.getElementById('fixture')); window.mount = id => ui.render(React.createElement(SicofAttribution, { key: id, transactionId: id, participantId: 'test-person', onClose: () => { closeCount++; ui.render(null); }, onSaved: () => { saved++; ui.render(null); } })); mount('opening');
    });
    const confirm = () => page.getByRole('button', { name: 'Confirmar clasificaci\u00f3n', exact: true });
    await page.getByRole('button', { name: '+ Agregar periodo', exact: true }).click();
    assert.equal(await page.getByLabel('Usar saldo inicial por identificar', { exact: true }).count(), 0);
    await page.getByLabel('A\u00f1o de origen 1', { exact: true }).fill('2025'); await page.getByLabel('Importe de origen 1', { exact: true }).fill('30');
    await page.getByLabel('Motivo y evidencia del desglose', { exact: true }).fill('Comprobante sintetico 2025 y 2026'); assert(await confirm().isDisabled());
    await page.getByRole('button', { name: '+ Agregar periodo', exact: true }).click();
    await page.getByLabel('A\u00f1o de origen 2', { exact: true }).fill('2026'); await page.getByLabel('Semestre de origen 2', { exact: true }).selectOption('2'); await page.getByLabel('Importe de origen 2', { exact: true }).fill('10'); assert(await confirm().isDisabled());
    await page.getByLabel('Semestre de origen 2', { exact: true }).selectOption('1'); assert(await confirm().isEnabled());
    await page.evaluate(() => { fail = 'NETWORK'; }); await confirm().click(); await page.getByRole('alert').waitFor();
    const first = await page.evaluate(() => calls.filter(c => c.kind === 'opening').at(-1));
    assert.deepEqual(first.args.origins, [{ origin_key: '2025', amount: 30 }, { origin_key: '2026-S1', amount: 10 }]); assert.equal(first.args.allocation_version, 'v1');
    assert.equal(await page.getByLabel('Importe de origen 1', { exact: true }).inputValue(), '30');
    await confirm().click(); await page.waitForFunction(() => saved === 1);
    assert.equal(await page.evaluate(() => calls.filter(c => c.kind === 'opening').at(-1).args.key), first.args.key);
    await page.evaluate(() => mount('withdrawal')); await page.getByRole('button', { name: '+ Agregar periodo', exact: true }).click();
    await page.getByLabel('Usar saldo inicial por identificar', { exact: true }).check(); await page.getByLabel('Importe de origen 1', { exact: true }).fill('10'); await page.getByLabel('Motivo y evidencia del desglose', { exact: true }).fill('Retiro comprobado del saldo inicial');
    await page.evaluate(() => { fail = 'SAVINGS_PERIOD_VERSION_CHANGED'; }); await confirm().click(); await page.getByRole('button', { name: 'Recargar composici\u00f3n', exact: true }).waitFor(); assert(await confirm().isDisabled());
    await page.evaluate(() => { version = 'v2'; }); await page.getByRole('button', { name: 'Recargar composici\u00f3n', exact: true }).click();
    await page.getByRole('button', { name: '+ Agregar periodo', exact: true }).click(); assert.equal(await page.getByLabel('Importe de origen 1', { exact: true }).inputValue(), '');
    await page.getByLabel('Usar saldo inicial por identificar', { exact: true }).check(); await page.getByLabel('Importe de origen 1', { exact: true }).fill('10'); await page.getByLabel('Motivo y evidencia del desglose', { exact: true }).fill('Retiro comprobado del saldo inicial');
    await page.screenshot({ path: path.join(output, 'withdrawal-explicit-origin.png'), fullPage: true });
    await confirm().click(); await page.waitForFunction(() => saved === 2);
    const withdrawal = await page.evaluate(() => calls.filter(c => c.kind === 'withdrawal').at(-1)); assert.deepEqual(withdrawal.args.origins, [{ origin_key: 'OPENING', amount: 10 }]); assert.equal(withdrawal.args.allocation_version, 'v2');
    await page.evaluate(() => { permitted = false; mount('opening'); }); await page.getByRole('alert').waitFor(); assert.equal(await page.getByRole('button', { name: '+ Agregar periodo', exact: true }).count(), 0);
    await page.keyboard.press('Escape'); assert.equal(await page.evaluate(() => closeCount), 1); assert.deepEqual(errors, []);
    const proof = { status: 'PASS', network: 'BLOCKED', productionWrites: 0, checks: ['fresh canonical composition and backend permission', 'opening requires complete explicit origin and evidence', 'future semester rejected', 'sum must equal unchanged transaction', 'network retry retains key and draft', 'stale version requires fresh reload and new review', 'withdrawal can preserve unknown OPENING origin', 'no ledger credit/debit creation', 'cancel preserves source', 'no browser errors'] };
    fs.writeFileSync(path.join(output, 'browser.json'), JSON.stringify(proof, null, 2)); console.log(JSON.stringify(proof));
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error.stack); process.exitCode = 1; });
