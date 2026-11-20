// H-AFFILIATES-GOOGLE-SHEET-001 focal tests. Offline: Google is a fake fetch, keys are generated per run.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fnDir = path.join(root, 'supabase/functions/affiliates-google-sheet');
const sheet = await import(path.join(fnDir, 'affiliates-sheet.mjs').replace(/\\/g, '/').replace(/^([A-Za-z]):/, 'file:///$1:'));
const { COLUMNS, SPREADSHEET_ID, TAB_TITLE, UNION_CODE, SERVICE_ACCOUNT_EMAIL, SERVICE_ACCOUNT_PROJECT, SHEETS_SCOPE, MAX_ROWS } = sheet;
let passed = 0;
async function test(name, fn) { await fn(); passed += 1; console.log('PASS', name); }

const APPROVED = ['ID interno', 'Número de control', 'Nombre completo', 'Nombre para mostrar', 'Correo histórico', 'Correo de acceso', 'Estatus',
  'Teléfono', 'Domicilio', 'Fecha de nacimiento', 'Género', 'Estado civil', 'Número de hijos', 'RFC', 'CURP', 'Unidad', 'Ciudad', 'Puesto',
  'Fecha de ingreso al empleo', 'Ocupación', 'Fecha de ingreso al Instituto', 'Área', 'Nivel', 'Pensión', 'Subdirección',
  'Fecha de ingreso al sindicato', 'Afiliación', 'Cargo sindical', 'Fecha de baja', 'Sindicato', 'Categoría de empleado', 'Tipo de empleado',
  'Estatus de afiliación (finanzas)', 'Estatus laboral (finanzas)', 'Fecha de alta en SutiApp', 'Última modificación'];

await test('columns mirror the data-exports affiliates domain in the same order', () => {
  const source = fs.readFileSync(path.join(root, 'supabase/functions/data-exports/index.ts'), 'utf8');
  const block = source.slice(source.indexOf('  affiliates: {'));
  const columns = JSON.parse(block.match(/columns:\s*(\[[^\]]*\])/)[1]);
  assert.deepEqual(COLUMNS.map(([key]) => key), columns);
});

await test('headers are exactly the owner-approved Spanish list and AD is Sindicato', () => {
  assert.deepEqual(COLUMNS.map(([, label]) => label), APPROVED);
  assert.equal(COLUMNS.length, 36);
  assert.deepEqual([...COLUMNS[29]], ['financial_union_code', 'Sindicato']);
});

await test('cell values are shown as stored, never as formulas', () => {
  assert.deepEqual(sheet.cellValue(null), {});
  assert.deepEqual(sheet.cellValue(undefined), {});
  assert.deepEqual(sheet.cellValue(''), {});
  assert.deepEqual(sheet.cellValue('=HYPERLINK("x")'), { stringValue: '=HYPERLINK("x")' });
  assert.deepEqual(sheet.cellValue('00123'), { stringValue: '00123' });
  assert.deepEqual(sheet.cellValue(7), { stringValue: '7' });
  assert.deepEqual(sheet.cellValue({ a: 1 }), { stringValue: '{"a":1}' });
});

const sample = (n) => Array.from({ length: n }, (_, i) => Object.fromEntries(COLUMNS.map(([key]) => [key, key === 'financial_union_code' ? UNION_CODE : key === 'termination_date_raw' ? null : key + '-' + i])));

await test('snapshot requests size the grid exactly and write header + every cell', () => {
  const requests = sheet.snapshotRequests(42, sample(3));
  const grid = requests[0].updateSheetProperties;
  assert.deepEqual(grid.properties, { sheetId: 42, gridProperties: { rowCount: 4, columnCount: 36, frozenRowCount: 1 } });
  assert.equal(requests.filter((r) => r.updateDimensionProperties).length, 36);
  const [header, body] = requests.filter((r) => r.updateCells).map((r) => r.updateCells);
  assert.deepEqual(header.start, { sheetId: 42, rowIndex: 0, columnIndex: 0 });
  assert.deepEqual(header.rows[0].values.map((v) => v.userEnteredValue.stringValue), APPROVED);
  assert.equal(header.rows[0].values[0].userEnteredFormat.textFormat.bold, true);
  assert.deepEqual(body.start, { sheetId: 42, rowIndex: 1, columnIndex: 0 });
  assert.equal(body.fields, 'userEnteredValue');
  assert.equal(body.rows.length, 3);
  assert.ok(body.rows.every((row) => row.values.length === 36));
  assert.deepEqual(body.rows[1].values[29].userEnteredValue, { stringValue: UNION_CODE });
  assert.deepEqual(body.rows[1].values[28].userEnteredValue, {});
  assert.ok(requests.every((r) => JSON.stringify(r).includes('"sheetId":42')));
});

await test('zero rows still leaves a valid frozen header and a blank row', () => {
  const requests = sheet.snapshotRequests(0, []);
  assert.equal(requests[0].updateSheetProperties.properties.gridProperties.rowCount, 2);
  const body = requests.filter((r) => r.updateCells)[1].updateCells;
  assert.ok(body.rows[0].values.every((v) => JSON.stringify(v.userEnteredValue) === '{}'));
});

const keys = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
const pkcs8 = Buffer.from(await crypto.subtle.exportKey('pkcs8', keys.privateKey)).toString('base64');
const secret = (overrides = {}) => JSON.stringify({ type: 'service_account', client_email: SERVICE_ACCOUNT_EMAIL, project_id: SERVICE_ACCOUNT_PROJECT,
  private_key: '-----BEGIN PRIVATE KEY-----\n' + pkcs8.match(/.{1,64}/g).join('\n') + '\n-----END PRIVATE KEY-----\n', ...overrides });
const fromB64url = (value) => Buffer.from(value.replace(/-/g, '+').replace(/_/g, '/'), 'base64');

function fakeGoogle({ tabs = [{ sheetId: 7, title: TAB_TITLE }], getStatus = 200, addStatus = 200, updateStatus = 200, raceTabs = null } = {}) {
  const calls = []; let reads = 0;
  const respond = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
  const fetchFn = async (url, init = {}) => {
    calls.push({ url, method: init.method || 'GET', body: init.body, auth: init.headers?.Authorization });
    if (url === 'https://oauth2.googleapis.com/token') return respond(200, { access_token: 'fake-token' });
    if (url.startsWith('https://sheets.googleapis.com/v4/spreadsheets/' + SPREADSHEET_ID + '?')) {
      reads += 1; const list = reads > 1 && raceTabs ? raceTabs : tabs;
      return respond(getStatus, { spreadsheetId: SPREADSHEET_ID, sheets: list.map((properties) => ({ properties })) });
    }
    if (url === 'https://sheets.googleapis.com/v4/spreadsheets/' + SPREADSHEET_ID + ':batchUpdate') {
      const body = JSON.parse(init.body);
      if (body.requests[0].addSheet) return respond(addStatus, addStatus === 200 ? { replies: [{ addSheet: { properties: { sheetId: 99, title: TAB_TITLE } } }] } : { error: {} });
      return respond(updateStatus, {});
    }
    throw new Error('UNEXPECTED_URL ' + url);
  };
  return { calls, fetchFn };
}

await test('publishes to the existing tab with a valid signed spreadsheets-scope assertion', async () => {
  const google = fakeGoogle();
  const result = await sheet.publishSnapshot({ fetchFn: google.fetchFn, secretJson: secret(), rows: sample(2), clock: () => 1_700_000_000_000 });
  assert.deepEqual({ ...result }, { sheetId: 7, rowCount: 2 });
  assert.deepEqual(google.calls.map((c) => c.method), ['POST', 'GET', 'POST']);
  const assertion = new URLSearchParams(google.calls[0].body).get('assertion');
  const [h, p, s] = assertion.split('.');
  const claims = JSON.parse(fromB64url(p));
  assert.deepEqual(claims, { iss: SERVICE_ACCOUNT_EMAIL, scope: SHEETS_SCOPE, aud: 'https://oauth2.googleapis.com/token', iat: 1_700_000_000, exp: 1_700_000_900 });
  assert.ok(await crypto.subtle.verify('RSASSA-PKCS1-v1_5', keys.publicKey, fromB64url(s), new TextEncoder().encode(h + '.' + p)));
  assert.ok(google.calls.slice(1).every((c) => c.auth === 'Bearer fake-token' && c.url.includes(SPREADSHEET_ID)));
  const update = JSON.parse(google.calls[2].body);
  assert.equal(update.requests[0].updateSheetProperties.properties.gridProperties.rowCount, 3);
});

await test('creates the dedicated tab when missing and never touches other tabs', async () => {
  const google = fakeGoogle({ tabs: [{ sheetId: 0, title: 'Hoja 1' }] });
  const result = await sheet.publishSnapshot({ fetchFn: google.fetchFn, secretJson: secret(), rows: sample(1) });
  assert.equal(result.sheetId, 99);
  const add = JSON.parse(google.calls[2].body).requests[0].addSheet.properties;
  assert.equal(add.title, TAB_TITLE);
  const write = JSON.stringify(JSON.parse(google.calls[3].body));
  assert.ok(!write.includes('"sheetId":0,') && !write.includes('"sheetId":0}'));
});

await test('a concurrent tab creation is resolved by re-reading once', async () => {
  const google = fakeGoogle({ tabs: [], addStatus: 400, raceTabs: [{ sheetId: 5, title: TAB_TITLE }] });
  const result = await sheet.publishSnapshot({ fetchFn: google.fetchFn, secretJson: secret(), rows: sample(1) });
  assert.equal(result.sheetId, 5);
});

const rejects = (promise, code) => assert.rejects(promise, (error) => error.code === code);

await test('a sheet not shared with the service account fails visibly', async () => {
  await rejects(sheet.publishSnapshot({ fetchFn: fakeGoogle({ getStatus: 403 }).fetchFn, secretJson: secret(), rows: sample(1) }), 'GOOGLE_ACCESS_DENIED');
  await rejects(sheet.publishSnapshot({ fetchFn: fakeGoogle({ getStatus: 404 }).fetchFn, secretJson: secret(), rows: sample(1) }), 'GOOGLE_ACCESS_DENIED');
  await rejects(sheet.publishSnapshot({ fetchFn: fakeGoogle({ updateStatus: 403 }).fetchFn, secretJson: secret(), rows: sample(1) }), 'GOOGLE_ACCESS_DENIED');
  await rejects(sheet.publishSnapshot({ fetchFn: fakeGoogle({ updateStatus: 500 }).fetchFn, secretJson: secret(), rows: sample(1) }), 'GOOGLE_UNAVAILABLE');
});

await test('only the expected service account secret is accepted', async () => {
  for (const bad of ['', '{}', secret({ client_email: 'other@x.iam.gserviceaccount.com' }), secret({ project_id: 'other' }), secret({ type: 'user' })]) {
    const google = fakeGoogle();
    await rejects(sheet.publishSnapshot({ fetchFn: google.fetchFn, secretJson: bad, rows: sample(1) }), 'GOOGLE_NOT_CONFIGURED');
    assert.equal(google.calls.length, 0);
  }
});

await test('rows outside SUTISSSTESON or over the limit are refused before any Google call', async () => {
  const google = fakeGoogle();
  const foreign = sample(2); foreign[1].financial_union_code = 'SUEISSSTESON';
  await rejects(sheet.publishSnapshot({ fetchFn: google.fetchFn, secretJson: secret(), rows: foreign }), 'SHEET_FILTER_VIOLATION');
  const spaced = sample(1); spaced[0].financial_union_code = 'SUTISSSTESON ';
  await rejects(sheet.publishSnapshot({ fetchFn: google.fetchFn, secretJson: secret(), rows: spaced }), 'SHEET_FILTER_VIOLATION');
  await rejects(sheet.publishSnapshot({ fetchFn: google.fetchFn, secretJson: secret(), rows: sample(MAX_ROWS + 1) }), 'SHEET_ROW_LIMIT_EXCEEDED');
  assert.equal(google.calls.length, 0);
});

await test('Edge Function is read-only over Supabase and gated by data_exports.read', () => {
  const source = fs.readFileSync(path.join(fnDir, 'index.ts'), 'utf8');
  for (const write of ['.insert(', '.update(', '.upsert(', 'data_export_audit_log']) assert.ok(!source.includes(write), 'unexpected ' + write);
  // The only `.delete(` is the in-memory Set bookkeeping of the auth-email lookup, never a Supabase query.
  assert.deepEqual([...source.matchAll(/([A-Za-z_]+)\.delete\(/g)].map((m) => m[1]), ['expected']);
  assert.deepEqual([...source.matchAll(/\.rpc\("([a-z_]+)"/g)].map((m) => m[1]).sort(), ['get_data_export_auth_emails', 'has_admin_permission']);
  assert.deepEqual([...source.matchAll(/\.from\("([a-z_]+)"\)/g)].map((m) => m[1]), ['affiliates', 'affiliates']);
  assert.equal([...source.matchAll(/\.eq\("financial_union_code", UNION_CODE\)/g)].length, 2);
  assert.ok(source.includes('required_permission: "data_exports.read"'));
  assert.ok(source.includes('.order("created_at", { ascending: true }).order("id", { ascending: true })'));
  assert.ok(/allowed\.data !== true\) return json\(403/.test(source));
});

await test('frontend: button gated like the Excel export and the Excel export is unchanged', () => {
  const screen = fs.readFileSync(path.join(root, 'app/screens-admin-affiliates.jsx'), 'utf8');
  const repo = fs.readFileSync(path.join(root, 'app/admin-affiliates-repository.js'), 'utf8');
  assert.ok(screen.includes("!archiveView&&app.admin.has('data_exports.read')&&h('button',{className:'aff-secondary',disabled:sheetBusy,onClick:openGoogleSheet}"));
  assert.ok(screen.includes("' Abrir en Google Sheets'"));
  assert.ok(repo.includes("async function exportXlsx(filters){requirePermission('data_exports.read');const f=filters||{},exportFilters={};if(f.status)exportFilters.affiliate_status_raw=f.status;return window.DataExportRepository.download('affiliates','xlsx',exportFilters,'Afiliados');}"));
  assert.ok(repo.includes("functions.invoke('affiliates-google-sheet',{body:{}})"));
  assert.ok(repo.includes("const GOOGLE_SHEET_URL='https://docs.google.com/spreadsheets/d/" + SPREADSHEET_ID + "/edit'"));
  assert.ok(!/service_role|SERVICE_ACCOUNT|private_key/.test(repo + screen));
});

console.log(JSON.stringify({ status: 'PASS', tests: passed }));
