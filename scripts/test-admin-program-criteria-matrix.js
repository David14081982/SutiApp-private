'use strict';

const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const screen = read('app/screens-admin-fondos.jsx');
const store = read('app/funds-store.jsx');
const repository = read('app/financial-legacy-repository.js');
const edge = read('supabase/functions/financial-legacy/index.ts');
const policy = read('supabase/functions/financial-legacy/visibility-policy.js');
const bundle = read('app/bundle.js');
const html = read('SutiApp.html');
const serviceWorker = read('sw.js');
const desktop = screen.slice(screen.indexOf('function DesktopCriteriaMatrix'), screen.indexOf('function FondosModule'));

assert.match(screen, /min-width: 1024px/);
assert.match(screen, /data-admin-program-criteria-matrix/);
assert.match(screen, /data-read-only/);
assert.match(screen, /Criterios de programas/);
assert.match(screen, /matriz de solo lectura/);
assert.match(screen, /Google no respondió\. No se usó caché, mock ni fuente alternativa/);
assert.match(screen, /pcmx-skeleton/);
assert.match(screen, /grid-template-columns:minmax\(0,1fr\).*278px/);
assert.match(screen, /@media\(min-width:1280px\)/);
assert.match(screen, /@media\(min-width:1440px\)/);
assert.match(screen, /overflow:auto/);
assert.match(screen, /position:sticky/);
assert.match(screen, /Buscar criterios de programas/);
for (const label of ['Filtrar por programa', 'Filtrar por fondo', 'Filtrar por sindicato', 'Filtrar por categoría', 'Filtrar por vigencia', 'Filtrar por visibilidad', 'Filtrar por estado', 'Ordenar criterios']) assert(screen.includes(label), label + ' missing');
for (const label of ['Disponible', 'Programado', 'No disponible', 'Automático', 'Mostrar excepcionalmente', 'Ocultar']) assert(screen.includes(label), label + ' missing');
for (const label of ['Programa y regla', 'Condiciones financieras', 'Vigencia, visibilidad y estado', 'Elegibilidad y visibilidad son distintas', 'Información técnica']) assert(screen.includes(label), label + ' missing');
for (const label of ['Posible duplicado', 'Posible conflicto', 'Condición distinta']) assert(screen.includes(label), label + ' missing');
assert.match(screen, /Comparación ·/);
assert.match(screen, /current\.length < 4/);
assert.match(screen, /Agrupar por programa/);
assert.match(screen, /ArrowDown/);
assert.match(screen, /ArrowUp/);
assert.doesNotMatch(desktop, /store\.setVisibility|FinancialLegacyRepository\.setCriteriaVisibility|localStorage|sessionStorage|\bDATA\b|fetch\s*\(/);

assert.match(store, /FinancialLegacyRepository\.listCriteriaCatalog\(\)/);
assert.match(store, /programId: rule\.program_id/);
assert.match(store, /montoMax: Number\(rule\.max_amount\)/);
assert.match(store, /tasaQuincenal: Number\(rule\.rate\)/);
assert.match(store, /plazoQuincenas: Number\(rule\.payment_count\)/);
assert.match(store, /periodoPago: rule\.payment_period/);
assert.match(store, /readOnly: true/);
assert.doesNotMatch(store, /localStorage|sessionStorage|\bDATA\b/);
assert.match(repository, /listCriteriaCatalog: \(\) => invoke\(\{ action: 'catalog' \}\)/);
assert.match(edge, /sheetName: "Criterios de fondos"/);
assert.match(edge, /range: "A2:P"/);
assert.match(edge, /const programId = programForFund\(fund\)/);
assert.match(edge, /gvizCell\(cells\[0\]\)/);
assert.match(edge, /gvizCell\(cells\[1\]\)/);
assert.match(edge, /gvizCell\(cells\[2\]\)/);
assert.match(edge, /max_amount: maxAmount/);
assert.match(edge, /rate: roundMoney\(rateFactor \* 100\)/);
assert.match(policy, /America\/Hermosillo/);
assert.match(policy, /AVAILABLE/);
assert.match(policy, /SCHEDULED/);
assert.match(policy, /UNAVAILABLE/);
assert.match(bundle, /data-admin-program-criteria-matrix/);
assert(html.includes('app/bundle.js?v=153'));
assert(serviceWorker.includes("sutiapp-v97") && serviceWorker.includes('app/bundle.js?v=153'));

// The approved mobile flow and its existing, separately authorized visibility editor remain present.
assert.match(screen, /function RuleRow/);
assert.match(screen, /function VisibilityEditor/);
assert.match(screen, /!desktop && editing/);
assert.match(screen, /financial_criteria\.visibility\.write/);

console.log('Admin program criteria matrix static contract PASS');
