'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const screen = read('app/screens-inversion.jsx');
const finance = read('app/screens-financiera.jsx');
const app = read('app/app.jsx');
const builder = read('scripts/build-bundle.js');
const bundle = read('app/bundle.js');

for (const copy of [
  'SUTI INVERSIÓN', 'Tu dinero rinde 2.5% mensual', 'Haz que tu dinero trabaje para ti.',
  '30% anual', 'Desde $50,000', 'Plazo mínimo 6 meses', 'Cero comisiones',
  'Calcula tu rendimiento', 'Cómo funciona', 'Tu respaldo',
  'Los rendimientos pasados no garantizan rendimientos futuros.',
]) assert.ok(screen.includes(copy), `owner copy missing: ${copy}`);

for (const marker of [
  'data-investment-screen', 'data-investment-back', 'data-investment-slider',
  'data-investment-presets', 'data-investment-terms', 'data-investment-chart-bars',
  'data-investment-monthly', 'data-investment-total', 'data-investment-final',
  'data-investment-footer-return', 'data-investment-cta',
]) assert.ok(screen.includes(marker), `interaction marker missing: ${marker}`);

assert.ok(finance.includes("app.push('investment')"), 'Mi Financiera Invertir does not push the full-screen route');
assert.ok(app.includes('investment: window.InvestmentScreen'), 'investment route is not registered');
assert.ok(builder.includes("'screens-inversion.jsx'"), 'bundle builder is missing the investment source');
assert.ok(bundle.includes('/* @@file screens-inversion.jsx */'), 'generated bundle is missing the investment screen');
assert.ok(bundle.includes('data-investment-screen'), 'bundle/source investment contract diverged');

for (const forbidden of [
  /localStorage/, /sessionStorage/, /indexedDB/i, /FinancialLegacyRepository/,
  /financialLegacyStore/, /SutiSupabase/, /\.rpc\(/, /fetch\(/, /wa\.me/i,
  /window\.open/, /program_requests/, /createFinancial/, /confirmLoanSession/,
]) assert.doesNotMatch(screen, forbidden, `forbidden authority or side effect in screen: ${forbidden}`);

const sandbox = {
  window: { Icon() {} },
  React: { createElement() {}, useState() {}, useRef() {}, useEffect() {} },
  console,
};
vm.createContext(sandbox);
vm.runInContext(screen, sandbox, { filename: 'screens-inversion.jsx' });
const sim = sandbox.window.SUTI_INVESTMENT_SIMULATION;
assert.strictEqual(sim.RATE, 0.025);
assert.strictEqual(sim.MIN, 50000);
assert.strictEqual(sim.MAX, 2000000);
assert.strictEqual(sim.STEP, 10000);
assert.deepStrictEqual(Array.from(sim.PRESETS), [50000, 100000, 250000, 500000, 1000000, 2000000]);
assert.deepStrictEqual(Array.from(sim.TERMS), [6, 12, 18, 24]);
assert.deepStrictEqual({ ...sim.calculate(50000, 6) }, { monthlyReturn: 1250, totalReturn: 7500, finalCapital: 50000 });
assert.deepStrictEqual({ ...sim.calculate(250000, 12) }, { monthlyReturn: 6250, totalReturn: 75000, finalCapital: 250000 });
assert.deepStrictEqual({ ...sim.calculate(2000000, 24) }, { monthlyReturn: 50000, totalReturn: 1200000, finalCapital: 2000000 });

console.log('Suti Investment screen static verification PASS: owner contract, routing, exact simple-interest cases, no persistence/backend/legacy/writer.');
