'use strict';
const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { pathToFileURL } = require('url');
const JSZip = require('../app/vendor/jszip-3.10.1/jszip.min.js');
const exporter = require('../app/reports-jc-export.js');
const outDir = path.resolve(__dirname, '../.tmp/reports-jc/export-tests');

function rectangle(range, value) {
  const [, a, r1, b, r2] = /^([A-Z])(\d+):([A-Z])(\d+)$/.exec(range);
  const cells = {};
  for (let r = +r1; r <= +r2; r++) for (let c = a.charCodeAt(0); c <= b.charCodeAt(0); c++) cells[String.fromCharCode(c) + r] = { value: value + (r % 3), sourceIds: ['isolated-fixture'], rule: 'test-only' };
  return cells;
}
function fixture() {
  const report = { year: 2028, issues: [], sheets: {} };
  for (const schema of exporter.SCHEMA) {
    const sheet = { issues: [] };
    const build = month => {
      const cells = rectangle(schema.inputs, month);
      if (schema.kind === 'loanMonth') for (const c of ['B10', 'C10', 'D10']) cells[c].value = 0;
      if (schema.labels) {
        cells.A12 = { value: 'Proveedor & prueba <X>' }; cells.A13 = { value: '=texto, no fórmula' };
        for (let row = 14; row <= 17; row++) for (const col of 'BCD') cells[col + row].value = 0;
      }
      return { cells, issues: [] };
    };
    if (schema.monthly) { sheet.months = {}; for (let month = 1; month <= 12; month++) sheet.months[month] = build(month); }
    else Object.assign(sheet, build(schema.sheet));
    report.sheets[schema.name] = sheet;
  }
  return report;
}
async function main() {
  const template = await import(pathToFileURL(path.resolve(__dirname, '../supabase/functions/reports-jc/template.mjs')).href);
  const raw = Buffer.from(template.TEMPLATE_BASE64, 'base64');
  assert.equal(crypto.createHash('sha256').update(raw).digest('hex'), exporter.TEMPLATE_SHA256);
  const report = fixture();
  const options = { templateBase64: template.TEMPLATE_BASE64, report, year: 2028, month: 10 };
  const { buildReport } = await import(pathToFileURL(path.resolve(__dirname, '../supabase/functions/reports-jc/report.mjs')).href);
  const headers = Array(26).fill('');
  Object.assign(headers, { 0: 'ID', 1: 'Número de control', 3: 'Proceso', 4: 'Fondo', 9: 'Fecha solicitud', 24: 'Estado', 25: 'Observaciones' });
  const request = Array(26).fill('');
  Object.assign(request, { 0: 'isolated-request', 1: 'TEST-001', 4: 'Vales y membresias', 9: '2028-10-01', 24: 'Iniciado', 25: 'Proveedor adicional de prueba' });
  const engineReport = buildReport({ year: 2028, requests: [headers, request], loans: [['Fecha', 'Cuotas', 'ID', 'Folio', '', 'Proceso', 'Fondo'], ['2028-10-15', 100, 'isolated-loan', 'TEST-001', '', '1', 'Caja Chica']], savings: { year: 2028, events: [], issues: [], coverage: { status: 'complete', synthetic: true } }, consultedAt: '2028-10-27T18:00:00Z' });
  await exporter.buildWorkbook({ ...options, report: engineReport });
  const bytes = await exporter.buildWorkbook(options);
  const originalZip = await JSZip.loadAsync(raw);
  const newZip = await JSZip.loadAsync(bytes, { checkCRC32: true });
  assert.deepEqual(Object.keys(newZip.files).sort(), Object.keys(originalZip.files).sort());
  const changed = [];
  for (const name of Object.keys(originalZip.files)) {
    const before = await originalZip.files[name].async('uint8array');
    const after = await newZip.files[name].async('uint8array');
    if (Buffer.compare(Buffer.from(before), Buffer.from(after))) changed.push(name);
  }
  assert.deepEqual(changed.sort(), Array.from({ length: 8 }, (_, i) => `xl/worksheets/sheet${i + 1}.xml`).sort());
  const bad = structuredClone(report);
  delete bad.sheets['Préstamos Concentrado'].cells.B6;
  await assert.rejects(exporter.buildWorkbook({ ...options, report: bad }), /conteo ausente/);
  bad.sheets['Préstamos Concentrado'].cells.B6 = { value: -1 };
  await assert.rejects(exporter.buildWorkbook({ ...options, report: bad }), /conteo ausente/);
  bad.sheets['Préstamos Concentrado'].cells.B6 = { value: 1.5 };
  await assert.rejects(exporter.buildWorkbook({ ...options, report: bad }), /conteo ausente/);
  const other = structuredClone(report);
  other.sheets['Préstamos Concentrado'].cells.A22 = { value: 1 };
  await assert.rejects(exporter.buildWorkbook({ ...options, report: other }), /fuera de alcance/);
  const double = structuredClone(report);
  double.sheets['Préstamos Mes'].months[10].cells.B10.value = 1;
  await assert.rejects(exporter.buildWorkbook({ ...options, report: double }), /una sola vez/);
  const unnamed = structuredClone(report);
  unnamed.sheets['ValesyMembresias Mes'].months[10].cells.B14.value = 1;
  await assert.rejects(exporter.buildWorkbook({ ...options, report: unnamed }), /nombres de proveedores/);
  await assert.rejects(exporter.buildWorkbook({ ...options, year: 2027 }), /año del reporte/);
  await assert.rejects(exporter.buildWorkbook({ ...options, month: 13 }), /período inválido/);
  await assert.rejects(exporter.buildWorkbook({ ...options, templateBase64: Buffer.from('not the template').toString('base64') }), /original autorizado/);
  const wrong = structuredClone(report);
  wrong.sheets['Préstamos Concentrado'].cells.E18 = { value: 0 };
  await assert.rejects(exporter.buildWorkbook({ ...options, report: wrong }), /total incompatible/);
  const errors = structuredClone(report);
  errors.issues.push({ severity: 'error', sheets: ['Préstamos Concentrado'], months: [1] });
  await assert.rejects(exporter.buildWorkbook({ ...options, report: errors }), /incidencias pendientes/);
  errors.issues[0].sheets = ['Préstamos Mes'];
  await exporter.buildWorkbook({ ...options, report: errors });
  await assert.rejects(exporter.buildWorkbook({ ...options, report: errors, month: 1 }), /incidencias pendientes/);
  const annualBytes = await exporter.buildYearZip(options);
  const annual = await JSZip.loadAsync(annualBytes, { checkCRC32: true });
  assert.equal(Object.keys(annual.files).length, 12);
  for (let month = 1; month <= 12; month++) assert(annual.file(`Reporte_JC_2028-${String(month).padStart(2, '0')}.xlsx`));
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'monthly.xlsx'), bytes);
  fs.writeFileSync(path.join(outDir, 'annual.zip'), annualBytes);
  fs.writeFileSync(path.join(outDir, 'fixture.json'), JSON.stringify(report));
  const summary = { status: 'PASS', templateSha256: exporter.TEMPLATE_SHA256, changedWorksheetEntries: changed.length, preservedOtherEntries: Object.keys(originalZip.files).length - changed.length, annualBooks: 12, invalidInputsRejected: 11, realReportEngineContractAccepted: true };
  fs.writeFileSync(path.join(outDir, 'js-result.json'), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary));
}
main().catch(error => { console.error(error.stack); process.exitCode = 1; });
