'use strict';
// Isolated synthetic UI verification. All network is blocked; no business writes.
const fs = require('fs'), path = require('path'), assert = require('assert/strict');
const { chromium } = require(process.env.SUTIAPP_PLAYWRIGHT_PATH || 'C:/tmp/sutiapp-playwright-audit/node_modules/playwright-core');
const root = path.resolve(__dirname, '..');
async function main() {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  const evidence = path.join(root, '.tmp/sicof/ui-isolated'); fs.mkdirSync(evidence, { recursive: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } }), errors = [];
    page.on('pageerror', error => { errors.push(error.message); console.error(error.stack); });
    await page.route('**/*', route => route.abort());
    await page.setContent('<html lang="es"><body style="margin:0;font-family:Arial,sans-serif"><div id="root"></div></body></html>');
    for (const file of ['app/vendor/react-18.3.1/react.production.min.js', 'app/vendor/react-dom-18.3.1/react-dom.production.min.js', 'app/sicof-payment-behavior.jsx', 'app/sicof-admin.jsx']) await page.addScriptTag({ content: fs.readFileSync(path.join(root, file), 'utf8') });
    await page.evaluate(() => {
      let keyCounter = 0; window.crypto.randomUUID = () => 'synthetic-key-' + (++keyCounter); window.calls = []; window.waiting = []; window.delayCalc = false; window.failCalc = false; window.failSource = false; window.unknownCapital = false; window.currentIdentity = 'synthetic-admin'; window.authListeners = [];
      window.AffiliateAuth = { getState: () => ({ phase: currentIdentity ? 'authenticated' : 'anonymous', session: { user: { id: currentIdentity } }, affiliate: { id: 'synthetic-affiliate' } }), subscribe: fn => { authListeners.push(fn); return () => { authListeners = authListeners.filter(item => item !== fn); }; } };
      window.loanFixture = { id: 'test-loan', folio: 'TEST-01', name: 'PERSONA SINTÉTICA', fund: 'Caja de Ahorro', capital: 100, total: 120, paid: 20, expected: 40, arrears: 20, status: 'SALDO ATRASADO', rate_percent: 5, term: 6, process: '1', severity: 'mild', progress_percent: 16.67, remaining_contractual: 100, discount_start: '2026-08-15', discount_end: '2026-12-15', schedule: [{ date: '2026-08-15', paid: 20, expected: 40, capital: 17, interest: 2, fee: 1, cumulative_paid: 20, cumulative_expected: 40, difference: -20, comparison_label: 'Pago parcial' }], comparison_summary: [{ label: 'Parciales', value: 1 }] };
      window.otherLoan = { id: 'other-loan', folio: 'TEST-02', name: 'OTRA PERSONA', fund: 'FONDO SINTETICO', capital: 6000, total: 6030, paid: 30, expected: 6030, arrears: 6000, status: 'SALDO ATRASADO', rate_percent: 3, term: 6, severity: 'severe', schedule: [{ date: '2025-08-15', paid: 30, expected: 30, capital: 25, interest: 4, fee: 1 }] };
      window.people = [{ participant_id: 'synthetic-person', f: 'TEST-01', n: 'PERSONA SINTÉTICA', e: 'Ahorrando', t: 'ACT', months: 8, endbal: 101, avgbal: 82, ok: true, motivo: 'Cumple reglas', rend: 4.10, retenido: 20, total: 105.10, entregable: 85.10, pct: .04, movements: [{ transaction_id: 'synthetic-withdrawal', can_classify: true, type: 'WITHDRAWAL', effective_date: '2026-08-15', component: 'CAPITAL', direction: 'DEBIT', date: '2026-08-15', label: 'Retiro', period_label: '2026-S1', component_label: 'Capital', amount: -11, balance: 101, days: 30, balance_days: 3030 }], loans: [loanFixture] }];
      window.resultFor = settings => ({ fingerprint: 'synthetic:' + settings.minm, pool: 20, collected: 14, projected: 6, projectedNetPool: 24, projectedRateOnConfirmedBase: 29.27, reviewCount: 0, payTotal: 4.10, reserve: 15.90, base: 82, rate: Number(settings.minm), nqual: 1, nexcl: 0, distributed: 4.10, costsTotal: 3, costsEffectLabel: 'Costo aplicado', summary: ['Resultado sintético para pruebas aisladas.'], rows: people, alerts: [], liquidity: { metrics: [{ label: 'Efectivo', value: 80, format: 'money' }], scenarios: [{ label: '10%', required: 10, cash: 80, portfolio: 20, shortfall: 0, coverage: 800, status_label: 'Cubierto con efectivo', status: 'CASH_COVERED' }], composition: [{ label: 'Efectivo', amount: 80, share: 80 }, { label: 'Cartera', amount: 20, share: 20 }] }, charts: { byFund: [{ label: 'Caja de Ahorro', paid: 20, pending: 100 }], recovery: [{ label: '15-ago', caja: 20, all: 20 }] }, compliance: [{ rule: 'Permanencia', requirement: 'Política registrada', application: 'Revisada', status: 'PASS' }] });
      window.scenes = [];
      window.SicofRepository = {
        composition: async participantId => ({ participant_id: participantId, can_attribute: true, version: 'synthetic-attribution-v1', movements: people[0].movements.map(row => ({ ...row, amount: 11 })), periods: [] }),
        load: async args => { calls.push({ kind: 'load', args }); return { source: failSource ? { status: 'UNAVAILABLE', observed_at: null, error: 'Fuente de préstamos no disponible' } : { status: 'READY', observed_at: '2026-10-03T12:00:00Z' }, funds: [{ id: 'Caja de Ahorro', name: 'Caja de Ahorro', collected: 2, projected: 3, unresolved_rows: 0 }, { id: 'FONDO SINTETICO', name: 'FONDO SINTÉTICO', collected: 4, projected: 5, unresolved_rows: 1 }], loans: failSource ? null : [loanFixture, otherLoan], payments: [{ id: 'payment-test', date: '2026-08-15', folio: 'TEST-01', name: 'PERSONA SINTÉTICA', loan_id: 'test-loan', fund: 'Caja de Ahorro', paid: 20, capital: unknownCapital ? null : 17, interest: 2, fee: 1, audit: 'RECONCILED_SOURCE_PAYMENT' }, { id: 'other-payment', date: '2025-08-15', folio: 'TEST-02', name: 'OTRA PERSONA', loan_id: 'other-loan', fund: 'FONDO SINTETICO', paid: 30, capital: 25, interest: 4, fee: 1, audit: 'RECONCILED_SOURCE_PAYMENT' }], participants: people, periods: [{ id: 'period-test', period_year: 2026, semester: 1 }], scenarios: scenes, preferences: {}, report: { balances: { 'synthetic-person': { capital: 101, yield_amount: 4.1, total: 105.1, available: 85.1, as_of: '2026-10-03' } }, periods: [{ year: 2026, semester: 1 }], rows: [{ participant_id: 'synthetic-person', folio: 'TEST-01', name: 'PERSONA SINTÉTICA', year: 2026, semester: 1, period_label: '2026-S1', capital: 112, yield: 4.10, withdrawn_capital: 11, withdrawn_yield: 0, remaining: 105.10, available: 85.10, movements: people[0].movements }] } }; },
        calculate: async args => { calls.push({ kind: 'calculate', args: structuredClone(args) }); if (failCalc || failSource) throw Error('NETWORK'); if (delayCalc) return new Promise(resolve => waiting.push({ args: structuredClone(args), resolve })); return resultFor(args.settings); },
        exportReport: async (kind, args) => { calls.push({ kind: 'export', exportKind: kind, args: structuredClone(args) }); },
        saveScenario: async args => { calls.push({ kind: 'saveScenario', args: structuredClone(args) }); scenes.push({ id: 'scenario-test', name: 'Escenario sintético', settings: args.settings, costs: args.costs, bank: args.bank, rate: 6, annualRate: 12, base: 82, payTotal: 4.1, eligible_count: 1 }); },
        deleteScenario: async id => { calls.push({ kind: 'deleteScenario', id }); scenes = scenes.filter(item => item.id !== id); },
        savePreferences: async args => { calls.push({ kind: 'savePreferences', args: structuredClone(args) }); },
        getBehavior: async id => { calls.push({ kind: 'behavior', id }); return { status: 'ARREARS', label: 'Con atraso', observed_at: '2026-10-03T12:00:00Z', loans: [loanFixture] }; }
      };
      window.SicofRepository.workspace = async args => {
        calls.push({ kind: 'workspace', args: structuredClone(args) });
        const workspace = await SicofRepository.load({ from: args.settings.periodIni, to: args.settings.periodFin });
        if (failSource) return { workspace, result: null, calculation_error: 'SICOF_LOAN_SOURCE_UNAVAILABLE' };
        return { workspace, result: await SicofRepository.calculate(args) };
      };
      window.ui = ReactDOM.createRoot(document.getElementById('root'));
      window.mount = () => ui.render(React.createElement(SicofAdminModule, { app: { admin: { phase: 'authorized', has: () => true } }, onBack: () => {}, header: ({ title }) => React.createElement('div', null, title) })); mount();
    });
    await page.waitForFunction(() => calls.some(item => item.kind === 'calculate'));
    await page.getByText('Resultado sintético para pruebas aisladas.', { exact: true }).waitFor();
    assert.equal(await page.evaluate(() => calls.filter(x => x.kind === 'workspace').length), 1);
    assert.equal(await page.getByRole('tab').count(), 8);
    assert.equal(await page.locator('input[type=password]').count(), 0);
    await page.getByText('Tasa proyectada sobre base confirmada', { exact: true }).waitFor();
    await page.getByText('29.27%', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Fondos seleccionados', exact: true }).click();
    await page.getByLabel('Fondos adicionales', { exact: true }).click();
    await page.getByText('Cobrado: $4.00 · Proyectado pendiente: $5.00 · 1 por revisar', { exact: true }).waitFor();
    assert.equal(await page.locator('.sicof-multi-panel').getByRole('checkbox').count(), 1);
    await page.getByRole('button', { name: 'Solo Caja de Ahorro', exact: true }).click();
    await page.getByRole('button', { name: '+ Guardar escenario actual', exact: true }).click();
    await page.getByRole('button', { name: 'Escenario sintético', exact: true }).waitFor();
    assert.equal(await page.evaluate(() => calls.find(item => item.kind === 'saveScenario').args.fingerprint), 'synthetic:6');
    await page.getByRole('tab', { name: 'Reparto por ahorrador', exact: true }).click();
    await page.evaluate(() => { window.originalPeople = people; people = [...people,
      { ...people[0], f: 'TEST-EXCLUDED', n: 'EXCLUSION COMPROBADA', ok: false, review_required: false, months: 0, motivo: 'No cumple 6 meses', rend: 0 },
      { ...people[0], f: 'TEST-REVIEW', n: 'EVIDENCIA PENDIENTE', ok: false, review_required: true, months: null, motivo: 'ENROLLMENT_UNVERIFIED', rend: null }
    ]; });
    await page.getByRole('button', { name: 'Actualizar', exact: true }).click();
    const reviewRow = page.getByRole('row').filter({ has: page.getByRole('cell', { name: 'TEST-REVIEW', exact: true }) });
    await reviewRow.waitFor();
    assert.equal(await reviewRow.getByRole('cell', { name: 'Por verificar', exact: true }).count(), 2);
    assert.equal(await reviewRow.getByRole('cell', { name: 'No', exact: true }).count(), 0);
    const excludedRow = page.getByRole('row').filter({ has: page.getByRole('cell', { name: 'TEST-EXCLUDED', exact: true }) });
    assert.equal(await excludedRow.getByRole('cell', { name: 'No', exact: true }).count(), 1);
    assert.equal(await excludedRow.getByRole('cell').nth(3).textContent(), '0');
    assert.equal(await page.getByRole('row').filter({ has: page.getByRole('cell', { name: 'TEST-01', exact: true }) }).getByRole('cell', { name: 'Sí', exact: true }).count(), 1);
    await reviewRow.click();
    await page.getByRole('dialog').getByText('Califica: Por verificar · Permanencia: Por verificar', { exact: true }).waitFor();
    assert.equal(await page.getByRole('dialog').locator('.sicof-metric').filter({ has: page.getByText('Rendimiento', { exact: true }) }).locator('strong').textContent(), '—');
    await page.keyboard.press('Escape');
    await page.evaluate(() => { people = originalPeople; }); await page.getByRole('button', { name: 'Actualizar', exact: true }).click();
    await reviewRow.waitFor({ state: 'detached' });
    await page.getByRole('button', { name: '↓ Excel formulado', exact: true }).click();
    assert.equal(await page.evaluate(() => calls.find(item => item.kind === 'export').exportKind), 'reparto_formulado');
    await page.getByText('PERSONA SINTÉTICA', { exact: true }).last().click();
    await page.getByRole('dialog').waitFor(); await page.getByRole('dialog').getByText('Retiro', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Identificar periodo', exact: true }).click();
    await page.getByRole('dialog', { name: 'Identificar periodos de origen', exact: true }).waitFor();
    await page.getByRole('button', { name: '+ Agregar periodo', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
    await page.getByRole('dialog').getByText('Retiro', { exact: true }).waitFor();

    await page.keyboard.press('Escape'); assert.equal(await page.getByRole('dialog').count(), 0);
    await page.getByRole('tab', { name: 'Liquidez', exact: true }).click();
    await page.evaluate(() => { const originalResult = resultFor; window.resultFor = settings => { const value = originalResult(settings); value.liquidity.composition = [{ label: 'Efectivo', amount: null, share: null }, { label: 'Cartera', amount: 20, share: null }]; return value; }; });
    await page.getByLabel('Saldo bancario del fondo de ahorro', { exact: true }).fill('80');
    await page.getByLabel('Declarado por', { exact: true }).fill('RESPONSABLE SINTÉTICO');
    await page.getByLabel('Fecha de declaración', { exact: true }).fill('2026-10-03');
    await page.getByRole('button', { name: 'Aplicar y calcular', exact: true }).click();
    await page.waitForFunction(() => calls.filter(item => item.kind === 'calculate').at(-1).args.bank.date === '2026-10-03');
    await page.getByText('Proporción por conciliar', { exact: true }).first().waitFor();
    assert.equal(await page.locator('.sicof-donut circle[stroke-dasharray]').count(), 0);
    await page.getByRole('tab', { name: 'Préstamos y pagos', exact: true }).click();
    const metric = label => page.locator('.sicof-metric').filter({ has: page.getByText(label, { exact: true }) }).locator('strong');
    assert.equal(await metric('Cuotas registradas').textContent(), '$50.00');
    await page.getByLabel('Buscar pagos', { exact: true }).fill('TEST-01'); assert.equal(await metric('Cuotas registradas').textContent(), '$20.00');
    await page.getByLabel('Buscar pagos', { exact: true }).fill('');
    await page.getByLabel('Concepto', { exact: true }).fill('COSTO SINTÉTICO'); await page.getByLabel('Monto', { exact: true }).fill('3');
    await page.getByRole('button', { name: '+ Agregar', exact: true }).click();
    await page.getByRole('button', { name: 'Aplicar y calcular', exact: true }).click();
    await page.waitForFunction(() => calls.filter(item => item.kind === 'calculate').at(-1).args.costs.length === 1);
    await page.getByRole('button', { name: '↓ Descargar préstamos', exact: true }).click();
    await page.getByText('PERSONA SINTÉTICA', { exact: true }).click(); await page.getByRole('dialog').waitFor();
    await page.getByText('Falta por pagar', { exact: true }).waitFor();
    await page.getByRole('progressbar', { name: 'Avance del préstamo', exact: true }).waitFor();
    await page.getByRole('tab', { name: 'B · Comparación esperado vs. pagado', exact: true }).click();
    await page.getByRole('img', { name: 'Acumulado: lo que debió pagar vs. lo que pagó', exact: true }).waitFor();
    await page.keyboard.press('Escape');
    for (const [tab, button, kind] of [['Atrasos', '↓ Descargar atrasos', 'atrasos'], ['Reporte préstamos', '↓ Excel por fondo', 'matriz_fondos'], ['Informe final de ahorro', '↓ Descargar informe final de ahorro', 'final_ahorro']]) {
      await page.getByRole('tab', { name: tab, exact: true }).click(); await page.getByRole('button', { name: button, exact: true }).click();
      assert.equal(await page.evaluate(() => calls.filter(item => item.kind === 'export').at(-1).exportKind), kind);
    }
    await page.getByRole('tab', { name: 'Atrasos', exact: true }).click();
    await page.getByText('PERSONA SINTÉTICA', { exact: true }).waitFor();
    assert.equal(await metric('Atraso registrado').textContent(), '$6,020.00');
    await page.getByLabel('Severidad del atraso', { exact: true }).selectOption('mild'); assert.equal(await metric('Atraso registrado').textContent(), '$20.00'); assert.equal(await metric('Casos graves').textContent(), '0');
    await page.getByLabel('Severidad del atraso', { exact: true }).selectOption('');
    await page.getByRole('tab', { name: 'Reporte préstamos', exact: true }).click();
    await page.getByRole('columnheader', { name: 'Tasa quincenal', exact: true }).waitFor();
    await page.getByRole('cell', { name: '5%', exact: true }).waitFor();
    assert.equal(await metric('Préstamos').textContent(), '2');
    await page.getByLabel('Año del reporte de préstamos', { exact: true }).selectOption('2026'); assert.equal(await metric('Préstamos').textContent(), '1'); assert.equal(await metric('Cuotas registradas').textContent(), '$20.00');
    await page.getByLabel('Año del reporte de préstamos', { exact: true }).selectOption('');
    await page.getByRole('tab', { name: 'Informe final de ahorro', exact: true }).click();
    await page.getByLabel('Semestre del ahorro', { exact: true }).selectOption('1'); assert.equal(await page.getByLabel('Año del ahorro', { exact: true }).inputValue(), '2026');
    await page.getByText('PERSONA SINTÉTICA', { exact: true }).click(); await page.getByText('Disponible global actual', { exact: true }).waitFor(); await page.keyboard.press('Escape');

    await page.getByRole('tab', { name: 'Cumplimiento', exact: true }).click(); await page.getByText('Política registrada', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Editar textos', exact: true }).click();
    await page.getByLabel('Simulador de Rendimiento', { exact: true }).fill('Título sintético'); await page.getByRole('button', { name: 'Guardar textos', exact: true }).click();
    await page.getByRole('heading', { name: 'Título sintético', exact: true }).waitFor();
    assert.equal(await page.evaluate(() => calls.filter(item => item.kind === 'savePreferences').at(-1).args.texts.title), 'Título sintético');
    assert.deepEqual(await page.evaluate(() => Object.keys(calls.filter(item => item.kind === 'savePreferences').at(-1).args.texts)), ['title']);
    await page.getByRole('button', { name: 'Mover Liquidez a la izquierda', exact: true }).click();
    await page.waitForFunction(() => calls.filter(item => item.kind === 'savePreferences').at(-1).args.tabOrder[0] === 'liquidez');
    await page.getByRole('tab', { name: 'Resumen', exact: true }).click();
    const beforeEdits = await page.evaluate(() => calls.filter(x => x.kind === 'workspace').length);
    await page.getByLabel('Meses m\u00ednimos', { exact: true }).fill('7');
    await page.getByLabel('Meses m\u00ednimos', { exact: true }).fill('8');
    await page.getByLabel('Inicio del periodo', { exact: true }).fill('2026-07-02');
    await page.waitForTimeout(600);
    assert.equal(await page.evaluate(() => calls.filter(x => x.kind === 'workspace').length), beforeEdits, 'draft edits must not query');
    assert(await page.getByRole('button', { name: '+ Guardar escenario actual', exact: true }).isDisabled());
    await page.evaluate(() => { delayCalc = true; });
    await page.getByRole('button', { name: 'Aplicar y calcular', exact: true }).evaluate(el => { el.click(); el.click(); });
    await page.waitForFunction(() => waiting.length === 1);
    assert.equal(await page.evaluate(() => calls.filter(x => x.kind === 'workspace').length), beforeEdits + 1, 'double click sends one');
    await page.getByLabel('Meses m\u00ednimos', { exact: true }).fill('9');
    await page.evaluate(() => waiting[0].resolve(resultFor(waiting[0].args.settings)));
    await page.getByText('Hay cambios sin aplicar.', { exact: false }).waitFor();
    assert.equal(await page.getByText('8%', { exact: true }).count(), 0, 'late result mismatches edited draft');
    await page.waitForTimeout(400);
    assert.equal(await page.evaluate(() => calls.filter(x => x.kind === 'workspace').length), beforeEdits + 1, 'no queued automatic query');
    await page.evaluate(() => { delayCalc = false; failCalc = true; });
    await page.getByRole('button', { name: 'Aplicar y calcular', exact: true }).click();
    await page.getByRole('button', { name: 'Reintentar', exact: true }).waitFor();
    assert.equal(await page.getByText('8%', { exact: true }).count(), 0);
    const failedCount = await page.evaluate(() => calls.filter(x => x.kind === 'workspace').length);
    await page.waitForTimeout(400);
    assert.equal(await page.evaluate(() => calls.filter(x => x.kind === 'workspace').length), failedCount, 'no automatic retry');
    await page.evaluate(() => { failCalc = false; });
    await page.getByRole('button', { name: 'Reintentar', exact: true }).click(); await page.getByText('9%', { exact: true }).waitFor();
    for (const width of [320, 430, 1440]) {
      await page.setViewportSize({ width, height: 1100 });
      const overflow = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth, elements: [...document.querySelectorAll('body *')].filter(el => el.getBoundingClientRect().right > innerWidth + 1 && getComputedStyle(el).position !== 'absolute').slice(0, 12).map(el => ({tag:el.tagName,cls:el.className,right:el.getBoundingClientRect().right})) })); assert(overflow.scroll <= width + 1, 'Page overflow: ' + JSON.stringify(overflow));
      await page.screenshot({ path: path.join(evidence, 'sicof-' + width + '.png'), fullPage: true });
    }
    await page.evaluate(() => { unknownCapital = true; }); await page.getByRole('button', { name: 'Actualizar', exact: true }).click();
    await page.getByRole('tab', { name: 'Préstamos y pagos', exact: true }).click();
    await page.getByLabel('Buscar pagos', { exact: true }).fill('TEST-01');
    await page.waitForFunction(() => [...document.querySelectorAll('.sicof-metric')].some(node => node.textContent.includes('Capital conciliado') && node.textContent.includes('Pendiente de conciliación')));
    assert.equal(await metric('Capital conciliado').textContent(), '—');
    await page.getByLabel('Buscar pagos', { exact: true }).fill('');
    await page.evaluate(() => { loanFixture.schedule.push({ ...loanFixture.schedule[0], paid: 999 }); });
    await page.getByRole('button', { name: 'Actualizar', exact: true }).click();
    await page.getByRole('tab', { name: 'Reporte préstamos', exact: true }).click();
    await page.getByRole('cell', { name: 'Por revisar', exact: true }).first().waitFor();
    assert.equal(await page.getByRole('cell', { name: 'Por revisar', exact: true }).count(), 4);
    await page.evaluate(() => { failSource = true; });
    await page.getByRole('button', { name: 'Actualizar', exact: true }).click();
    await page.getByRole('alert').getByText('Fuente de préstamos no disponible', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Reintentar cálculo', exact: true }).waitFor();
    await page.getByRole('tab', { name: 'Informe final de ahorro', exact: true }).click();
    await page.getByRole('button', { name: '↓ Descargar informe final de ahorro', exact: true }).click();
    const currentReport = await page.evaluate(() => calls.filter(item => item.kind === 'export').at(-1));
    assert.equal(currentReport.exportKind, 'final_ahorro'); assert(currentReport.args.from); assert(currentReport.args.to); assert.equal(currentReport.args.fingerprint, undefined);
    await page.getByRole('button', { name: '↓ Descargar Excel histórico original', exact: true }).click();
    assert.deepEqual(await page.evaluate(() => calls.filter(item => item.kind === 'export').at(-1).args), { filters: { historical: true } });
    await page.evaluate(() => { currentIdentity = ''; authListeners.forEach(fn => fn()); }); await page.getByRole('alert').getByText('Acceso administrativo requerido.').waitFor();
    assert.equal(await page.getByText('PERSONA SINTÉTICA', { exact: true }).count(), 0);
    await page.evaluate(() => { currentIdentity = 'synthetic-admin'; authListeners.forEach(fn => fn()); ui.render(React.createElement(SicofPaymentBehavior, { affiliateId: 'synthetic-person' })); });
    await page.getByRole('button', { name: 'Con atraso', exact: true }).click(); await page.getByRole('dialog').waitFor();
    await page.getByRole('button', { name: /Caja de Ahorro · test-loan/ }).click(); await page.getByRole('tab', { name: 'A · Historial real de pagos', exact: true }).waitFor();
    await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
    assert.deepEqual(errors, []);
    const proof = { status: 'PASS', network: 'BLOCKED', productionWrites: 0, checks: ['all original tabs and additional period report', 'saver transaction opens authorized classification and preserves detail on cancel', 'scenario full command and fingerprint', 'exports preserve backend fingerprint and filters', 'cost and bank drafts require explicit combined calculation', 'loan charts and saver withdrawals visible', 'texts/tab order persisted via repository', 'drafts issue zero queries; combined apply single flight; late mismatched result hidden; no auto retry', 'source error removes stale amounts', 'savings/current and original reports remain downloadable during Google outage', 'matrix complete metadata and server percentage units', 'projection net pool and conditional percentage visible', 'payment/arrears/matrix totals reflect filters without reallocation', 'unknown components remain unknown in filtered totals', 'matrix year removes loans without dates in that year', 'report semester selects an explicit year', 'account global availability shown without summing periods', 'loan principal interest term remaining and progress preserved', 'duplicate-date matrix evidence never selects first payment', 'arrears uses authoritative status', 'context change clears private UI', 'behavior detail', 'responsive 320/430/1440', 'no browser errors'] };
    proof.checks.push('eligibility preserves verified yes verified no and pending review in table and modal', 'unknown months stay unknown while verified zero months remain zero');
    fs.writeFileSync(path.join(evidence, 'browser.json'), JSON.stringify(proof, null, 2)); console.log(JSON.stringify(proof));
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error.stack); process.exitCode = 1; });
