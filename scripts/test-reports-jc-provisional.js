'use strict';
// Synthetic report inputs only. The private original is read locally and never changed.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { spawnSync } = require('node:child_process');
const JSZip = require('../app/vendor/jszip-3.10.1/jszip.min.js');
const exporter = require('../app/reports-jc-export.js');
const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, '.tmp/reports-jc/provisional/export-tests');
function rectangle(range, value) {
  const [, a, first, b, last] = /^([A-Z])(\d+):([A-Z])(\d+)$/.exec(range), cells = {};
  for (let row = +first; row <= +last; row++) for (let col = a.charCodeAt(0); col <= b.charCodeAt(0); col++) cells[String.fromCharCode(col) + row] = { value, sourceIds: [], rule: 'synthetic-only' };
  return cells;
}
function fixture() {
  const report = { year: 2028, records: [], issues: [], sheets: {} };
  for (const schema of exporter.SCHEMA) {
    const build = () => {
      const cells = rectangle(schema.inputs, 2);
      if (schema.kind === 'loanMonth') for (const coord of ['B10', 'C10', 'D10']) cells[coord].value = 0;
      if (schema.labels) for (let row = 12; row <= 17; row++) cells['A' + row] = { value: 'Proveedor sintético ' + row };
      return { cells, issues: [] };
    };
    report.sheets[schema.name] = schema.monthly ? { issues: [], months: Object.fromEntries(Array.from({ length: 12 }, (_, i) => [i + 1, build()])) } : build();
  }
  return report;
}
function addIssue(report, code, sheets, months, sourceIds = []) {
  report.issues.push({ severity: 'error', code, message: 'Incidencia sintética <sin datos reales> & pendiente.', sheets, months, sourceIds });
}
async function cells(zip, sheet) {
  const xml = await zip.file('xl/worksheets/sheet' + sheet + '.xml').async('string');
  return Object.fromEntries(Array.from(xml.matchAll(/<c\b([^>]*?\br="([A-Z]+\d+)"[^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g), match => [match[2], { xml: match[0], value: (match[3] || '').match(/<v>(.*?)<\/v>/)?.[1], error: /\bt="e"/.test(match[1]) }]));
}
const PYTHON_VERIFY = String.raw`
import base64, io, json, re, sys, zipfile
from pathlib import Path
from xml.etree import ElementTree as ET
from openpyxl import load_workbook
root, out = Path(sys.argv[1]), Path(sys.argv[2])
source = (root / 'supabase/functions/reports-jc/template.mjs').read_text(encoding='utf-8')
original_bytes = base64.b64decode(json.loads(re.search(r'export const TEMPLATE_BASE64 = ("[^"]+");', source)[1]))
original_zip = zipfile.ZipFile(io.BytesIO(original_bytes))
original = load_workbook(io.BytesIO(original_bytes), data_only=False)
ns = {'m': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
cell_pattern = re.compile(r'<c\b[^>]*?\br="([A-Z]+\d+)"[^>]*?(?:/>|>[\s\S]*?</c>)')
original_formulas = sum(cell.data_type == 'f' for ws in original for row in ws for cell in row)
assert original_formulas == 245
checked, note_count, error_count, annotated_number_count = 0, 0, 0, 0
def check_book(data, month):
 global checked, note_count, error_count, annotated_number_count
 archive = zipfile.ZipFile(io.BytesIO(data))
 book = load_workbook(io.BytesIO(data), data_only=False)
 cached = load_workbook(io.BytesIO(data), data_only=True)
 assert book.sheetnames == original.sheetnames and len(book.sheetnames) == 17
 assert sum(cell.data_type == 'f' for ws in book for row in ws for cell in row) == 245
 allowed_changes = {'[Content_Types].xml'}
 for i in range(1, 9):
  allowed_changes.update({f'xl/worksheets/sheet{i}.xml', f'xl/worksheets/_rels/sheet{i}.xml.rels'})
 for name in original_zip.namelist():
  if name not in allowed_changes: assert archive.read(name) == original_zip.read(name), ('original part changed', name)
 for name in set(archive.namelist()) - set(original_zip.namelist()):
  assert re.fullmatch(r'xl/(comments/reportsJcSheet[1-8]\.xml|drawings/reportsJcSheet[1-8]\.vml)', name), name
 types = archive.read('[Content_Types].xml').decode()
 types = re.sub(r'<Default Extension="vml"[^>]*/>', '', types)
 types = re.sub(r'<Override PartName="/xl/comments/reportsJcSheet[1-8]\.xml"[^>]*/>', '', types)
 assert types == original_zip.read('[Content_Types].xml').decode(), 'content types outside new notes'
 for i, source_sheet in enumerate(original, 1):
  sheet, values = book[source_sheet.title], cached[source_sheet.title]
  for row in source_sheet:
   for cell in row:
    assert sheet[cell.coordinate]._style == cell._style, ('style', i, cell.coordinate)
    if cell.data_type == 'f': assert sheet[cell.coordinate].value == cell.value, ('formula', i, cell.coordinate)
  if i > 8: continue
  title = 'A1' if i == 8 else 'A2'
  assert values[title].value.startswith('PROVISIONAL · ') and 'Conteos registrados; consultar notas' in values[title].value
  original_xml = original_zip.read(f'xl/worksheets/sheet{i}.xml').decode()
  updated_xml = archive.read(f'xl/worksheets/sheet{i}.xml').decode()
  allowed = {title}
  if i in (1,3,5,7): allowed.update(f'{c}{r}' for c in 'BCDE' for r in range(6,19)); allowed.add('A5')
  elif i == 2: allowed.update(f'{c}{r}' for c in 'BCDE' for r in range(6,12))
  elif i == 4: allowed.update(f'{c}{r}' for c in 'CDE' for r in range(6,22))
  elif i == 6: allowed.update(f'{c}{r}' for c in 'BCDE' for r in range(6,19)); allowed.update(f'A{r}' for r in range(12,18))
  else: allowed.update(f'{c}{r}' for c in 'BCDEFGH' for r in range(4,17)); allowed.add('A3')
  strip = lambda xml: re.sub(r'<legacyDrawing r:id="rIdJcNotesVml"/>', '', cell_pattern.sub(lambda m: '' if m[1] in allowed else m[0], xml))
  assert strip(original_xml) == strip(updated_xml), ('sheet outside allowed cells/notes', i)
  xml_root = ET.fromstring(archive.read(f'xl/worksheets/sheet{i}.xml'))
  error_addresses = {c.attrib['r'] for c in xml_root.findall('.//m:c', ns) if c.attrib.get('t') == 'e'}
  comment_addresses = {cell.coordinate for row in sheet for cell in row if cell.comment}
  assert error_addresses <= comment_addresses, ('every unknown count has a note', i)
  for coord in comment_addresses:
   text = sheet[coord].comment.text
   assert 'REPORTE PROVISIONAL' in text
   if coord in error_addresses:
    assert values[coord].data_type == 'e' and values[coord].value == '#N/A'
    assert 'No equivale a cero' in text
   else:
    assert isinstance(values[coord].value, int) and values[coord].value >= 0
    assert f'Cantidad registrada: {values[coord].value}.' in text
    assert 'no es una cifra definitiva' in text and 'no certifica ausencia de casos pendientes' in text
    if sheet[coord].data_type == 'f': assert 'Total de las cantidades registradas' in text
    annotated_number_count += 1
   assert 'DO_NOT_COPY_PERSON_NAME' not in text and '87654321' not in text
  note_count += len(comment_addresses); error_count += len(error_addresses)
  for row in source_sheet:
   for cell in row:
    if cell.data_type != 'f': continue
    match = re.fullmatch(r'=SUM\(([A-Z]+\d+):([A-Z]+\d+)\)', cell.value)
    assert match
    children = [child.value for selected in values[f'{match[1]}:{match[2]}'] for child in selected]
    expected = '#N/A' if '#N/A' in children else sum(value or 0 for value in children)
    assert values[cell.coordinate].value == expected, ('formula cache', i, cell.coordinate)
  rel_path = f'xl/worksheets/_rels/sheet{i}.xml.rels'
  rels = archive.read(rel_path).decode()
  clean_rels = re.sub(r'<Relationship Id="rIdJcNotes(?:Comments|Vml)"[^>]*/>', '', rels)
  assert clean_rels == original_zip.read(rel_path).decode(), ('printer or existing relationship changed', i)
  if comment_addresses:
   rel_root = ET.fromstring(rels)
   assert len({r.attrib['Id'] for r in rel_root}) == len(rel_root)
   vml = ET.fromstring(archive.read(f'xl/drawings/reportsJcSheet{i}.vml'))
   assert len(vml.findall('{urn:schemas-microsoft-com:vml}shape')) == len(comment_addresses)
 checked += 1
check_book((out / 'monthly.xlsx').read_bytes(), 9)
with zipfile.ZipFile(out / 'annual.zip') as annual:
 assert len(annual.namelist()) == 12
 for month in range(1,13): check_book(annual.read(f'Reporte_JC_2028-{month:02d}_PROVISIONAL.xlsx'), month)
assert annotated_number_count > 0 and note_count > error_count
print(json.dumps({'status':'PASS','books':checked,'sheetsPerBook':17,'originalFormulasPerBook':original_formulas,'errorsVerified':error_count,'notesVerified':note_count,'annotatedNumbersVerified':annotated_number_count,'excludedSheetsStylesRelationshipsPreserved':True}))
`;
async function main() {
  const template = await import(pathToFileURL(path.join(ROOT, 'supabase/functions/reports-jc/template.mjs')).href);
  const options = report => ({ report, year: 2028, month: 9, templateBase64: template.TEMPLATE_BASE64, provisional: true });
  const clean = fixture();
  assert.deepEqual(exporter.exportStatus(clean, 9), { provisionalNeeded: false, pendingCells: 0, issueCount: 0 });
  const pending = fixture();
  pending.records.push({ id: 'requests:700', sheet: 'Historial de solicitudes', row: 700, person: 'DO_NOT_COPY_PERSON_NAME', amount: 87654321 });
  addIssue(pending, 'REQUEST_STATUS_UNMAPPED', ['Préstamos Concentrado', 'Préstamos Mes'], [9], ['requests:700']);
  addIssue(pending, 'PAYROLL_CODE_UNMAPPED', ['DtosViaNomina Concentrado', 'DtosViaNomina Mes'], [3], ['loans:900']);
  addIssue(pending, 'REFUND_PERIOD_UNCONFIRMED', ['Caja de Ahorro Voluntario', 'DtosViaNomina Concentrado', 'DtosViaNomina Mes'], [9]);
  addIssue(pending, 'HISTORICAL_TERMINATION_UNMAPPED', ['Caja de Ahorro Voluntario'], [1], ['synthetic-termination']);
  addIssue(pending, 'FUTURE_UNKNOWN_ISSUE', ['ValesyMembresias Mes'], [2], ['requests:701']);
  // These indicators are truly unknown in the backend. An error issue by itself
  // must annotate the observed number, never replace that number with #N/A.
  pending.sheets['Caja de Ahorro Voluntario'].cells.E12.value = null;
  pending.sheets['Caja de Ahorro Voluntario'].cells.G4.value = null;
  pending.sheets['DtosViaNomina Concentrado'].cells.D14.value = null;
  for (const coord of ['D7', 'D12']) pending.sheets['DtosViaNomina Mes'].months[9].cells[coord].value = null;
  pending.sheets['ValesyMembresias Concentrado'].cells.B7.value = null;
  const snapshot = JSON.stringify(pending);
  const status = exporter.exportStatus(pending, 9, 'month');
  assert.equal(status.provisionalNeeded, true); assert.equal(status.issueCount, 4); assert(status.pendingCells > 0);
  assert(exporter.exportStatus(pending, 9, 'year').pendingCells > status.pendingCells);
  await assert.rejects(exporter.buildWorkbook({ ...options(pending), provisional: false }), /incidencias pendientes/);
  await assert.rejects(exporter.buildWorkbook({ ...options(pending), provisional: undefined }), /incidencias pendientes/);
  const bytes = await exporter.buildWorkbook(options(pending)), zip = await JSZip.loadAsync(bytes, { checkCRC32: true });
  const loan = await cells(zip, 1), loanMonth = await cells(zip, 2), payroll = await cells(zip, 3), payrollMonth = await cells(zip, 4), memberships = await cells(zip, 5), savings = await cells(zip, 8);
  assert.equal(loan.B14.value, '2'); assert.equal(loan.E14.value, '6'); assert.equal(loan.B18.value, '24'); assert.equal(loan.E18.value, '72'); assert.equal(loan.B13.value, '2');
  assert.equal(loanMonth.B6.value, '2'); assert.equal(loanMonth.B10.value, '0'); assert.equal(loanMonth.E10.value, '0'); assert.equal(loanMonth.E11.value, '24');
  assert.equal(payroll.B8.value, '2'); assert.equal(payroll.C8.value, '2'); assert.equal(payroll.E8.value, '6'); assert.equal(payroll.B18.value, '24'); assert.equal(payroll.D8.value, '2'); assert.equal(payroll.D14.value, '#N/A'); assert.equal(payroll.E18.value, '#N/A');
  assert.equal(payrollMonth.C7.value, '2'); assert.equal(payrollMonth.D7.value, '#N/A'); assert.equal(payrollMonth.D12.value, '#N/A'); assert.equal(payrollMonth.D8.value, '2'); assert.equal(payrollMonth.C21.value, '30');
  assert.equal(savings.E12.value, '#N/A'); assert.equal(savings.G4.value, '#N/A'); assert.equal(savings.H4.value, '#N/A'); assert.equal(savings.E4.value, '2'); assert.equal(savings.B16.value, '24');
  assert.equal(memberships.B7.value, '#N/A'); assert.equal(memberships.B18.value, '#N/A'); assert.equal(memberships.C18.value, '24');
  const notes = await zip.file('xl/comments/reportsJcSheet1.xml').async('string');
  assert(notes.includes('REQUEST_STATUS_UNMAPPED') && notes.includes('Historial de solicitudes · fila 700'));
  assert(notes.includes('Cantidad registrada: 2.') && notes.includes('Cantidad registrada: 72.'));
  assert(notes.includes('Total de las cantidades registradas'));
  assert(!notes.includes('DO_NOT_COPY_PERSON_NAME') && !notes.includes('87654321'));
  assert(notes.includes('&lt;sin datos reales&gt; &amp; pendiente.'));
  assert.equal(JSON.stringify(pending), snapshot, 'export must not change the report');
  const noMonth = fixture(); addIssue(noMonth, 'REQUEST_DATE_INVALID', ['Préstamos Concentrado', 'Préstamos Mes'], [], ['requests:900']);
  const noMonthZip = await JSZip.loadAsync(await exporter.buildWorkbook(options(noMonth)));
  const allMonths = await cells(noMonthZip, 1);
  for (let row = 6; row <= 17; row++) for (const col of ['B', 'C', 'D']) assert.equal(allMonths[col + row].value, '2', 'One undated record must not erase twelve months of observed counts');
  assert.equal(allMonths.B18.value, '24'); assert.equal(allMonths.E18.value, '72');
  assert.equal(Object.values(allMonths).filter(cell => cell.error).length, 0);
  const noMonthNotes = await noMonthZip.file('xl/comments/reportsJcSheet1.xml').async('string');
  assert(noMonthNotes.includes('REQUEST_DATE_INVALID') && noMonthNotes.includes('fila 900') && noMonthNotes.includes('Cantidad registrada: 72.'));
  const onlyOtherMonth = fixture(); addIssue(onlyOtherMonth, 'UNKNOWN', ['ValesyMembresias Mes'], [2]);
  assert.equal(exporter.exportStatus(onlyOtherMonth, 9).provisionalNeeded, false);
  assert.equal(exporter.exportStatus(onlyOtherMonth, 2).provisionalNeeded, true);
  await exporter.buildWorkbook({ ...options(onlyOtherMonth), provisional: false });
  const warn = fixture(); warn.issues = [{ severity: 'warning', sheets: ['Préstamos Concentrado'], months: [9] }];
  assert.equal(exporter.exportStatus(warn, 9).provisionalNeeded, false);
  let malformed = 0;
  for (const value of [-1, 1.5, undefined, '2', NaN, Infinity]) {
    const invalid = structuredClone(pending); invalid.sheets['Préstamos Concentrado'].cells.B14.value = value;
    await assert.rejects(exporter.buildWorkbook(options(invalid)), /conteo ausente o inválido/); malformed++;
  }
  for (const [mutate, message] of [
    [r => { r.sheets['Préstamos Concentrado'].cells.E18 = { value: 999 }; }, /total incompatible/],
    [r => { r.sheets['Préstamos Mes'].months[9].cells.B10.value = 1; }, /una sola vez/],
    [r => { r.sheets['Préstamos Concentrado'].cells.Z99 = { value: 1 }; }, /fuera de alcance/],
    [r => { delete r.sheets['Préstamos Concentrado']; }, /faltan datos/],
    [r => { r.issues[0].months = [13]; }, /período de incidencia inválido/],
    [r => { r.sheets['ValesyMembresias Mes'].months[9].cells.A12.value = '\x00'; }, /proveedor inválido/],
    [r => { r.sheets['ValesyMembresias Mes'].months[9].cells.A12.value = ''; }, /nombres de proveedores/]
  ]) { const invalid = structuredClone(pending); mutate(invalid); await assert.rejects(exporter.buildWorkbook(options(invalid)), message); malformed++; }
  await assert.rejects(exporter.buildWorkbook({ ...options(pending), templateBase64: Buffer.from('invalid').toString('base64') }), /original autorizado/);
  assert.throws(() => exporter.exportStatus(pending, 13), /período inválido/);
  assert.throws(() => exporter.exportStatus(pending, 9, 'invalid'), /modo de exportación inválido/);
  const { buildReport } = await import(pathToFileURL(path.join(ROOT, 'supabase/functions/reports-jc/report.mjs')).href);
  const headers = Array(26).fill(''); Object.assign(headers, { 0: 'ID', 1: 'Número de control', 3: 'Proceso', 4: 'Fondo', 9: 'Fecha solicitud', 24: 'Estado', 25: 'Observaciones' });
  const engine = buildReport({ year: 2028, requests: [headers], loans: [['Fecha', 'Cuotas', 'ID', 'Folio', '', 'Proceso', 'Fondo']], savings: { year: 2028, events: [], issues: [{ code: 'REFUND_PERIOD_UNCONFIRMED', severity: 'blocking', scope: 'refund', months: [3] }, { code: 'HISTORICAL_TERMINATION_UNMAPPED', severity: 'blocking', months: [2] }], coverage: { synthetic: true } }, consultedAt: '2028-10-27T20:00:00Z' });
  await exporter.buildWorkbook(options(engine));
  assert.equal(engine.sheets['Caja de Ahorro Voluntario'].cells.E6.value, null);
  const annualBytes = await exporter.buildYearZip(options(pending)), annual = await JSZip.loadAsync(annualBytes, { checkCRC32: true });
  assert.equal(Object.keys(annual.files).length, 12);
  for (let month = 1; month <= 12; month++) {
    const book = await JSZip.loadAsync(await annual.file('Reporte_JC_2028-' + String(month).padStart(2, '0') + '_PROVISIONAL.xlsx').async('uint8array'));
    assert.equal((await cells(book, 2)).B6.value, '2');
    assert.equal((await cells(book, 6)).B6.value, '2');
    assert.equal((await cells(book, 4)).D7.value, month === 9 ? '#N/A' : '2');
    assert.equal((await cells(book, 4)).C21.value, '30');
  }
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'monthly.xlsx'), bytes);
  fs.writeFileSync(path.join(OUT, 'annual.zip'), annualBytes);
  fs.writeFileSync(path.join(OUT, 'fixture.json'), JSON.stringify(pending));
  const independent = spawnSync('python', ['-c', PYTHON_VERIFY, ROOT, OUT], { encoding: 'utf8', maxBuffer: 1024 * 1024 });
  assert.equal(independent.status, 0, independent.stderr || independent.stdout);
  const verified = JSON.parse(independent.stdout.trim());
  const result = { status: 'PASS', strictDefaultPreserved: true, countAndFormulaErrorsPropagate: true, observedCountsPreservedWithIssues: true, oneUndatedRequestDoesNotMaskYear: true, annotatedNumericTotalsAccurate: true, annualMonthsScoped: true, nullNeverBecomesZero: true, noSourceMutation: true, hardErrorsRejected: malformed + 3, commentsContainSourceRowsOnly: true, engineNullTotalsAccepted: true, ...verified };
  fs.writeFileSync(path.join(OUT, 'result.json'), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result));
}
main().catch(error => { console.error(error.stack); process.exitCode = 1; });
