// Independent, count-only verification. Private sanitized input is never a runtime fallback.
// Run after refreshing .tmp/reports-jc/source-values/source-sample.json from read-only Google.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { buildReport } from '../supabase/functions/reports-jc/report.mjs';
import { TEMPLATE_BASE64 } from '../supabase/functions/reports-jc/template.mjs';

const require = createRequire(import.meta.url);
const exporter = require('../app/reports-jc-export.js');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const INPUT = path.resolve(process.argv[2] || path.join(ROOT, '.tmp/reports-jc/source-values/source-sample.json'));
const OUTPUT = path.join(ROOT, '.tmp/reports-jc/source-values/independent-expected.json');
const source = JSON.parse(fs.readFileSync(INPUT, 'utf8'));
assert.equal(source.fixtureOnly, true, 'Only explicitly sanitized isolated fixtures are accepted.');
assert(Array.isArray(source.requests) && Array.isArray(source.loans));
const names = ['Préstamos Concentrado', 'Préstamos Mes', 'DtosViaNomina Concentrado', 'DtosViaNomina Mes', 'ValesyMembresias Concentrado', 'ValesyMembresias Mes', 'Financiamientos Concentrado'];
const monthNumbers = Array.from({ length: 12 }, (_, index) => index + 1);
const present = value => value !== null && value !== undefined && String(value).trim() !== '';
const rawText = value => String(value ?? '').trim();
// This oracle deliberately does not import the production date, fund, process,
// status, provider, template-schema, or totals helpers.
function period(serial) {
  if (!present(serial)) return null;
  assert.equal(typeof serial, 'number', 'The live snapshot uses unformatted Google date serials.');
  assert(Number.isFinite(serial));
  const date = new Date(Date.UTC(1899, 11, 30) + Math.floor(serial) * 86400000);
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, date: date.toISOString().slice(0, 10) };
}
const requestRows = new Map([['Caja de Ahorro', 6], ['Caja Chica', 7], ['Sutiexpress', 9]]);
function loanRequestRow(fund) {
  if (/^\d{2}\/\d{2}\/\d{4}(?:\s|[—–-])/.test(rawText(fund))) return 8;
  return requestRows.get(rawText(fund));
}
const providerRows = new Map([
  ['RiveraGas', 6], ['Vales / RiveraGas', 6],
  ['Arco gasolinera', 7], ['Vale de gasolina / Arco gasolinera', 7],
  ['Casa Ley', 8], ['Vales / Casa Ley', 8],
  ['Costco', 9], ['Solicitud de membresia / Costco', 9],
  ['Sams Club', 10], ['Solicitud de membresia / Sams Club', 10],
  ['Cinestar', 11]
]);
const additionalProviderLabel = value => rawText(value) === 'Vales / Diesgas' ? 'Diesgas' : rawText(value);
const payrollRows = new Map([[446, 6], [573, 7], [574, 8], [575, 9], [576, 10], [577, 11], [580, 12], [581, 13], [609, 14], [610, 15], [611, 16], [644, 17], [645, 18], [646, 19], [647, 20]]);
function referenceCode(fund, process) {
  assert(['1', '3', 'JUB'].includes(rawText(process)), 'Unexpected payroll process requires explicit source review.');
  const jub = rawText(process) === 'JUB';
  const family = loanRequestRow(fund);
  if (family === 6) return jub ? 581 : 575;
  if (family === 7) return jub ? 609 : 574;
  if (family === 8 || family === 9) return jub ? 610 : 576;
  const explicit = {
    'Vales y membresias': jub ? 611 : 577,
    'Descuentos SUTISSSTESON': 446,
    'Seguro Colectivo Suti': 644,
    'Suti Terrenos': 645, 'Panel Solar': 645, 'Suti Auto': 645, 'Suti Cirugias': 645,
    'Suti Tours': 646
  };
  assert(Object.hasOwn(explicit, rawText(fund)), 'Unexpected payroll fund requires explicit source review.');
  return explicit[rawText(fund)];
}
function blankCells(columns, first, last) {
  return Object.fromEntries(Array.from({ length: last - first + 1 }, (_, index) => index + first).flatMap(row => [...columns].map(column => [column + row, 0])));
}
function makeReference(year) {
  const sheets = {
    [names[0]]: { cells: blankCells('BCD', 6, 17) },
    [names[1]]: { months: {} },
    [names[2]]: { cells: blankCells('BCD', 6, 17) },
    [names[3]]: { months: {} },
    [names[4]]: { cells: blankCells('BCD', 6, 17) },
    [names[5]]: { months: {} },
    [names[6]]: { cells: blankCells('BCD', 6, 17) }
  };
  const summary = { received: 0, approved: 0, rejected: 0, pending: 0, unknown: 0, months: {} };
  for (const month of monthNumbers) {
    sheets[names[1]].months[month] = { cells: blankCells('BCD', 6, 10) };
    sheets[names[3]].months[month] = { cells: blankCells('CD', 6, 20) };
    sheets[names[5]].months[month] = { cells: blankCells('BCD', 6, 17) };
    summary.months[month] = { received: 0, approved: 0, rejected: 0, pending: 0, unknown: 0 };
  }
  const additionalProviders = [...new Set(source.requests.slice(1).filter(row => row[4] === 'Vales y membresias' && period(row[9])?.year === year && present(row[25]) && !providerRows.has(rawText(row[25]))).map(row => additionalProviderLabel(row[25])))].sort();
  assert(additionalProviders.length <= 6, 'The original template has six spare provider rows.');
  for (const month of monthNumbers) additionalProviders.forEach((label, index) => { sheets[names[5]].months[month].cells['A' + (12 + index)] = label; });
  const counted = (cells, row, state) => {
    if (state === 'approved') { cells['B' + row]++; cells['D' + row]++; }
    if (state === 'rejected') cells['C' + row]++;
  };
  let missingRequestDates = 0, missingMembershipProviders = 0, resolvedProcesses = 0, positiveInstallments = 0, missingInstallmentAmounts = 0;
  for (const row of source.requests.slice(1)) {
    if (![0, 1, 4, 9, 24, 25].some(column => present(row[column]))) continue;
    const when = period(row[9]);
    if (!when) { missingRequestDates++; continue; }
    if (when.year !== year) continue;
    const status = rawText(row[24]);
    assert(['Liquidado', 'Iniciado', 'Rechazado', 'Pendiente', 'PENDIENTE', ''].includes(status), 'New source status must be reviewed, not guessed.');
    const state = status === 'Liquidado' || status === 'Iniciado' ? 'approved' : status === 'Rechazado' ? 'rejected' : status === 'Pendiente' || status === 'PENDIENTE' ? 'pending' : 'unknown';
    summary.received++; summary[state]++; summary.months[when.month].received++; summary.months[when.month][state]++;
    const loanRow = loanRequestRow(row[4]);
    if (loanRow) {
      counted(sheets[names[0]].cells, when.month + 5, state);
      counted(sheets[names[1]].months[when.month].cells, loanRow, state);
    }
    if (row[4] === 'Vales y membresias') {
      counted(sheets[names[4]].cells, when.month + 5, state);
      counted(sheets[names[6]].cells, when.month + 5, state);
      const provider = rawText(row[25]);
      const extraLabel = additionalProviderLabel(provider);
      const rowNumber = providerRows.get(provider) || (additionalProviders.includes(extraLabel) ? 12 + additionalProviders.indexOf(extraLabel) : null);
      if (rowNumber) counted(sheets[names[5]].months[when.month].cells, rowNumber, state);
      else missingMembershipProviders++;
    }
  }
  for (const row of source.loans.slice(1)) {
    const when = period(row[0]);
    if (when?.year !== year || row[1] === 0) continue;
    if (row[1] === null || row[1] === undefined) { missingInstallmentAmounts++; continue; }
    assert.equal(row[1], 1, 'Sanitized positive amounts must be 1; counts must not depend on currency.');
    let process = row[5];
    if (!present(process)) {
      const matching = source.requests.slice(1).filter(request => present(row[2]) && present(row[3]) && request[0] === row[2] && request[1] === row[3] && rawText(request[4]) === rawText(row[6]));
      assert.equal(matching.length, 1, 'Missing process may only join one exact ID/person/fund request.');
      process = matching[0][3]; resolvedProcesses++;
    }
    const code = referenceCode(row[6], process);
    sheets[names[2]].cells[(rawText(process) === 'JUB' ? 'C' : 'B') + (when.month + 5)]++;
    sheets[names[3]].months[when.month].cells['C' + payrollRows.get(code)]++;
    positiveInstallments++;
  }
  function sumRows(cells, columns, first, last, totalRow, attentionColumns) {
    for (let row = first; row <= last; row++) cells['E' + row] = [...attentionColumns].reduce((sum, column) => sum + cells[column + row], 0);
    for (const column of columns) cells[column + totalRow] = Array.from({ length: last - first + 1 }, (_, index) => cells[column + (first + index)]).reduce((sum, value) => sum + value, 0);
    cells['E' + totalRow] = [...attentionColumns].reduce((sum, column) => sum + cells[column + totalRow], 0);
  }
  for (const index of [0, 2, 4, 6]) sumRows(sheets[names[index]].cells, 'BCD', 6, 17, 18, index === 4 || index === 6 ? 'BC' : 'BCD');
  for (const month of monthNumbers) {
    sumRows(sheets[names[1]].months[month].cells, 'BCD', 6, 10, 11, 'BCD');
    sumRows(sheets[names[3]].months[month].cells, 'CD', 6, 20, 21, 'CD');
    sumRows(sheets[names[5]].months[month].cells, 'BCD', 6, 17, 18, 'BC');
  }
  return { year, sheets, summary, coverage: { missingRequestDates, missingMembershipProviders, resolvedProcesses, positiveInstallments, missingInstallmentAmounts } };
}
function compareEngine(report, expected) {
  assert.deepEqual(report.summary, expected.summary, 'All requests must contribute to the received/status summary.');
  assert(!report.issues.some(issue => issue.code === 'PAYROLL_CODE_UNMAPPED'), 'Every actual payroll fund/process must map.');
  assert.equal(report.coverage.resolvedPayrollProcesses, expected.coverage.resolvedProcesses);
  let checked = 0;
  const checkCells = (actual, target, name, month) => {
    for (const [address, value] of Object.entries(target)) {
      assert.equal(actual[address]?.value, value, `${expected.year} ${name} ${month || 'annual'}!${address}`); checked++;
    }
  };
  for (const [name, sheet] of Object.entries(expected.sheets)) {
    if (sheet.cells) checkCells(report.sheets[name].cells, sheet.cells, name);
    else for (const month of monthNumbers) checkCells(report.sheets[name].months[month].cells, sheet.months[month].cells, name, month);
  }
  return checked;
}
const pythonCheck = String.raw`
import base64, io, json, re, sys, zipfile
from openpyxl import load_workbook
data=json.load(sys.stdin)
original_bytes=base64.b64decode(data['original'])
original_zip=zipfile.ZipFile(io.BytesIO(original_bytes))
original=load_workbook(io.BytesIO(original_bytes), data_only=False)
formulas=sum(cell.data_type=='f' for ws in original for row in ws for cell in row)
assert formulas==245
checked=0
formula_caches=0
for item in data['books']:
 raw=base64.b64decode(item['base64'])
 archive=zipfile.ZipFile(io.BytesIO(raw))
 book=load_workbook(io.BytesIO(raw), data_only=False)
 values=load_workbook(io.BytesIO(raw), data_only=True)
 assert book.sheetnames==original.sheetnames and len(book.sheetnames)==17
 assert sum(cell.data_type=='f' for ws in book for row in ws for cell in row)==245
 for index, source_sheet in enumerate(original,1):
  sheet=book[source_sheet.title]
  for row in source_sheet:
   for cell in row:
    assert sheet[cell.coordinate]._style==cell._style, ('style',source_sheet.title,cell.coordinate)
    if cell.data_type=='f': assert sheet[cell.coordinate].value==cell.value, ('formula',source_sheet.title,cell.coordinate)
  if index>8:
   assert archive.read(f'xl/worksheets/sheet{index}.xml')==original_zip.read(f'xl/worksheets/sheet{index}.xml')
   continue
  for row in sheet:
   for cell in row:
    if cell.data_type!='f': continue
    match=re.fullmatch(r'=SUM\(([A-Z]+\d+):([A-Z]+\d+)\)',cell.value)
    assert match,cell.value
    operands=[v.value for selected in values[sheet.title][f'{match[1]}:{match[2]}'] for v in selected]
    expected='#N/A' if '#N/A' in operands else sum(v or 0 for v in operands)
    assert values[sheet.title][cell.coordinate].value==expected,('cached formula',sheet.title,cell.coordinate)
    formula_caches+=1
 for name, expected_sheet in data['expected']['sheets'].items():
  cells=expected_sheet.get('cells') or expected_sheet['months'][str(item['month'])]['cells']
  for address, expected in cells.items():
   actual=values[name][address]
   assert actual.value==expected,(item['month'],name,address,actual.value,expected)
   if isinstance(expected,int): assert actual.data_type=='n',('numeric Google count replaced by error',name,address)
   checked+=1
print(json.dumps({'status':'PASS','books':len(data['books']),'sheetsPerBook':17,'originalFormulasPerBook':245,'independentWorkbookCells':checked,'formulaCachesChecked':formula_caches,'excludedWorksheetPartsPreserved':True}))
`;

const references = {};
const reports = {};
let engineCells = 0;
for (const year of [2025, 2026, 2027]) {
  references[year] = makeReference(year);
  reports[year] = buildReport({ year, requests: source.requests, loans: source.loans, savings: { year, events: [], issues: [], coverage: { status: 'complete', synthetic: true } }, consultedAt: '2026-10-28T12:00:00Z' });
  engineCells += compareEngine(reports[year], references[year]);
}
const books = [];
for (const month of monthNumbers) {
  const bytes = await exporter.buildWorkbook({ report: reports[2026], year: 2026, month, templateBase64: TEMPLATE_BASE64, provisional: true });
  books.push({ month, base64: Buffer.from(bytes).toString('base64') });
}
const checked = spawnSync('python', ['-X', 'utf8', '-c', pythonCheck], { input: JSON.stringify({ original: TEMPLATE_BASE64, books, expected: references[2026] }), encoding: 'utf8', maxBuffer: 8 * 1024 * 1024, windowsHide: true });
if (checked.status !== 0) throw new Error('Independent workbook verification failed: ' + checked.stderr + checked.stdout);
const workbook = JSON.parse(checked.stdout.trim());
// Publish only aggregate expectations to ignored private evidence. The live check
// must add its actual Supabase contributions to mixed cells; synthetic zero is
// never evidence that savings contributions/refunds were zero in production.
const googleOwned = {};
for (const index of [0, 1, 4, 5, 6]) googleOwned[names[index]] = references[2026].sheets[names[index]];
googleOwned[names[3]] = { months: Object.fromEntries(monthNumbers.map(month => [month, { cells: Object.fromEntries(Object.entries(references[2026].sheets[names[3]].months[month].cells).filter(([address]) => /^C\d+$/.test(address) && !['C7', 'C12', 'C21'].includes(address))) }])) };
const googleContributions = {
  [names[2]]: { cells: Object.fromEntries(Object.entries(references[2026].sheets[names[2]].cells).filter(([address]) => /^[BC]\d+$/.test(address))) },
  [names[3]]: { months: Object.fromEntries(monthNumbers.map(month => [month, { cells: { C21: references[2026].sheets[names[3]].months[month].cells.C21 } }])) }
};
const result = { status: 'PASS', year: 2026, authority: 'Independent counts from sanitized direct Google snapshot; aggregate diagnostic evidence only', savingsAuthority: 'NOT VALIDATED BY THIS TEST. Savings input is explicitly synthetic; production mixed counts require real Supabase events.', sourceRows: { requests: source.requests.length - 1, loans: source.loans.length - 1 }, yearsCompared: [2025, 2026, 2027], engineCellsCompared: engineCells, workbook, summary: references[2026].summary, coverage: Object.fromEntries(Object.entries(references).map(([year, reference]) => [year, reference.coverage])), googleOwned, googleContributions };
fs.writeFileSync(OUTPUT, JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ status: result.status, yearsCompared: result.yearsCompared, engineCellsCompared: engineCells, workbook, coverage: result.coverage }));
