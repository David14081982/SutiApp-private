// H-AFFILIATES-GOOGLE-SHEET-001 — owner-authorized 2026-11-19. Server only.
// One-way, read-only mirror: Supabase public.affiliates (financial_union_code = 'SUTISSSTESON')
// -> one dedicated tab of one fixed Google spreadsheet. Never writes Supabase and never touches any
// other spreadsheet or tab. Each publish replaces that tab atomically (single batchUpdate).

export const SPREADSHEET_ID = '1a9Qc8Zu2OZGNsCWCwOkWClCJfYvDem4Zlio3GNK1SLA';
export const TAB_TITLE = 'Afiliados SUTISSSTESON';
export const UNION_CODE = 'SUTISSSTESON';
export const MAX_ROWS = 5000;
export const MAX_PAYLOAD_BYTES = 9 * 1024 * 1024;
export const SERVICE_ACCOUNT_EMAIL = 'sutifinanzas-reader@sutifinanzas-reportes.iam.gserviceaccount.com';
export const SERVICE_ACCOUNT_PROJECT = 'sutifinanzas-reportes';
export const SERVICE_ACCOUNT_SECRET = 'SUTIFINANZAS_GOOGLE_SERVICE_ACCOUNT_JSON';
export const SHEETS_SCOPE = 'https://www.googleapis.com/auth/spreadsheets';
export const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const SHEETS_API = 'https://sheets.googleapis.com/v4/spreadsheets/';

// Same order as the data-exports `affiliates` domain, so "Sindicato" stays in column AD.
// Headers approved by the owner on 2026-11-19.
export const COLUMNS = Object.freeze([
  ['id', 'ID interno'],
  ['numero_control', 'Número de control'],
  ['full_name', 'Nombre completo'],
  ['display_name', 'Nombre para mostrar'],
  ['historical_email_raw', 'Correo histórico'],
  ['auth_email', 'Correo de acceso'],
  ['affiliate_status_raw', 'Estatus'],
  ['phone_raw', 'Teléfono'],
  ['address_raw', 'Domicilio'],
  ['birth_date_raw', 'Fecha de nacimiento'],
  ['gender_raw', 'Género'],
  ['marital_status_raw', 'Estado civil'],
  ['children_count_raw', 'Número de hijos'],
  ['rfc_raw', 'RFC'],
  ['curp_raw', 'CURP'],
  ['unit_raw', 'Unidad'],
  ['city_raw', 'Ciudad'],
  ['employment_position_raw', 'Puesto'],
  ['employment_entry_date_raw', 'Fecha de ingreso al empleo'],
  ['occupation_raw', 'Ocupación'],
  ['institute_entry_date_raw', 'Fecha de ingreso al Instituto'],
  ['employment_area_raw', 'Área'],
  ['employment_level_raw', 'Nivel'],
  ['pension_raw', 'Pensión'],
  ['subdirectorate_raw', 'Subdirección'],
  ['union_enrollment_date_raw', 'Fecha de ingreso al sindicato'],
  ['affiliation_raw', 'Afiliación'],
  ['union_position_raw', 'Cargo sindical'],
  ['termination_date_raw', 'Fecha de baja'],
  ['financial_union_code', 'Sindicato'],
  ['financial_employee_category_code', 'Categoría de empleado'],
  ['financial_employee_type', 'Tipo de empleado'],
  ['financial_affiliation_status', 'Estatus de afiliación (finanzas)'],
  ['financial_employment_status', 'Estatus laboral (finanzas)'],
  ['created_at', 'Fecha de alta en SutiApp'],
  ['updated_at', 'Última modificación'],
].map((pair) => Object.freeze(pair)));

export class SheetError extends Error {
  constructor(code) { super(code); this.code = code; }
}

const HEADER_FORMAT = Object.freeze({
  backgroundColor: { red: 0x7B / 255, green: 0x16 / 255, blue: 0x34 / 255 },
  textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } },
});

// Values are shown exactly as stored. stringValue is never parsed as a formula, so no escaping is needed.
export function cellValue(value) {
  if (value === null || value === undefined || value === '') return {};
  return { stringValue: typeof value === 'object' ? JSON.stringify(value) : String(value) };
}

export function columnWidth(label) {
  return Math.min(40, Math.max(14, label.length + 2)) * 7;
}

export function snapshotRequests(sheetId, rows) {
  if (!Number.isInteger(sheetId) || sheetId < 0) throw new SheetError('SHEET_TAB_INVALID');
  if (!Array.isArray(rows)) throw new SheetError('SHEET_ROWS_INVALID');
  if (rows.length > MAX_ROWS) throw new SheetError('SHEET_ROW_LIMIT_EXCEEDED');
  const width = COLUMNS.length;
  const header = { values: COLUMNS.map(([, label]) => ({ userEnteredValue: { stringValue: label }, userEnteredFormat: HEADER_FORMAT })) };
  // With zero rows the grid keeps one blank data row (a sheet cannot freeze every row); it is written empty.
  const body = (rows.length ? rows : [{}]).map((row) => ({ values: COLUMNS.map(([key]) => ({ userEnteredValue: cellValue(row[key]) })) }));
  return [
    { updateSheetProperties: {
      properties: { sheetId, gridProperties: { rowCount: body.length + 1, columnCount: width, frozenRowCount: 1 } },
      fields: 'gridProperties(rowCount,columnCount,frozenRowCount)',
    } },
    ...COLUMNS.map(([, label], index) => ({ updateDimensionProperties: {
      range: { sheetId, dimension: 'COLUMNS', startIndex: index, endIndex: index + 1 },
      properties: { pixelSize: columnWidth(label) }, fields: 'pixelSize',
    } })),
    { updateCells: { start: { sheetId, rowIndex: 0, columnIndex: 0 }, rows: [header], fields: 'userEnteredValue,userEnteredFormat(backgroundColor,textFormat)' } },
    { updateCells: { start: { sheetId, rowIndex: 1, columnIndex: 0 }, rows: body, fields: 'userEnteredValue' } },
  ];
}

function base64url(bytes) {
  let binary = '';
  for (let index = 0; index < bytes.length; index += 0x8000) binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  return btoa(binary).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

export async function serviceAccountAssertion(secretJson, clock = () => Date.now()) {
  try {
    const account = JSON.parse(secretJson || 'null');
    if (account?.type !== 'service_account' || account.client_email !== SERVICE_ACCOUNT_EMAIL || account.project_id !== SERVICE_ACCOUNT_PROJECT ||
      typeof account.private_key !== 'string' || !account.private_key.startsWith('-----BEGIN PRIVATE KEY-----')) throw Error();
    const text = (value) => base64url(new TextEncoder().encode(JSON.stringify(value)));
    const now = Math.floor(clock() / 1000);
    const unsigned = text({ alg: 'RS256', typ: 'JWT' }) + '.' + text({ iss: SERVICE_ACCOUNT_EMAIL, scope: SHEETS_SCOPE, aud: TOKEN_ENDPOINT, iat: now, exp: now + 900 });
    const der = Uint8Array.from(atob(account.private_key.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, '')), (c) => c.charCodeAt(0));
    const key = await crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
    const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned));
    return unsigned + '.' + base64url(new Uint8Array(signature));
  } catch (_) { throw new SheetError('GOOGLE_NOT_CONFIGURED'); }
}

function googleFailure(status) {
  if (status === 401) return new SheetError('GOOGLE_AUTH_FAILED');
  if (status === 403 || status === 404) return new SheetError('GOOGLE_ACCESS_DENIED');
  return new SheetError('GOOGLE_UNAVAILABLE');
}

async function call(fetchFn, url, init) {
  let response;
  try { response = await fetchFn(url, { ...init, signal: AbortSignal.timeout(30000) }); } catch (_) { throw new SheetError('GOOGLE_UNAVAILABLE'); }
  const body = await response.json().catch(() => null);
  return { ok: response.ok, status: response.status, body };
}

export async function accessToken(fetchFn, secretJson, clock) {
  const assertion = await serviceAccountAssertion(secretJson, clock);
  const result = await call(fetchFn, TOKEN_ENDPOINT, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }).toString(),
  });
  if (!result.ok || typeof result.body?.access_token !== 'string') throw new SheetError('GOOGLE_AUTH_FAILED');
  return result.body.access_token;
}

async function findTab(fetchFn, token) {
  const result = await call(fetchFn, SHEETS_API + SPREADSHEET_ID + '?fields=spreadsheetId,sheets.properties(sheetId,title)', { headers: { Authorization: 'Bearer ' + token } });
  if (!result.ok) throw googleFailure(result.status);
  if (result.body?.spreadsheetId !== SPREADSHEET_ID || !Array.isArray(result.body.sheets)) throw new SheetError('GOOGLE_RESPONSE_INVALID');
  const tab = result.body.sheets.map((sheet) => sheet?.properties).find((properties) => properties?.title === TAB_TITLE);
  return tab && Number.isInteger(tab.sheetId) ? tab.sheetId : null;
}

async function batchUpdate(fetchFn, token, requests) {
  const payload = JSON.stringify({ requests, includeSpreadsheetInResponse: false });
  if (new TextEncoder().encode(payload).length > MAX_PAYLOAD_BYTES) throw new SheetError('SHEET_PAYLOAD_TOO_LARGE');
  return call(fetchFn, SHEETS_API + SPREADSHEET_ID + ':batchUpdate', {
    method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: payload,
  });
}

// Finds the dedicated tab or creates it. A concurrent creation (title already exists) is resolved by re-reading once.
export async function ensureTab(fetchFn, token) {
  const existing = await findTab(fetchFn, token);
  if (existing !== null) return existing;
  const created = await batchUpdate(fetchFn, token, [{ addSheet: { properties: { title: TAB_TITLE, gridProperties: { rowCount: 2, columnCount: COLUMNS.length, frozenRowCount: 1 } } } }]);
  const sheetId = created.body?.replies?.[0]?.addSheet?.properties?.sheetId;
  if (created.ok && Number.isInteger(sheetId)) return sheetId;
  if (created.status !== 400) throw googleFailure(created.status);
  const raced = await findTab(fetchFn, token);
  if (raced === null) throw new SheetError('GOOGLE_RESPONSE_INVALID');
  return raced;
}

export async function publishSnapshot({ fetchFn, secretJson, rows, clock }) {
  if (!Array.isArray(rows)) throw new SheetError('SHEET_ROWS_INVALID');
  if (rows.length > MAX_ROWS) throw new SheetError('SHEET_ROW_LIMIT_EXCEEDED');
  if (rows.some((row) => row?.financial_union_code !== UNION_CODE)) throw new SheetError('SHEET_FILTER_VIOLATION');
  const token = await accessToken(fetchFn, secretJson, clock);
  const sheetId = await ensureTab(fetchFn, token);
  const result = await batchUpdate(fetchFn, token, snapshotRequests(sheetId, rows));
  if (!result.ok) throw googleFailure(result.status);
  return Object.freeze({ sheetId, rowCount: rows.length });
}
