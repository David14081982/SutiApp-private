// HISTORIAL P V2 is the authority. This module never writes Google or caches loans.
export const WORKBOOK = '1Vxy84N7mzbuioTmWhjRD2QFboDx--rG3iUwmLuyeY80';
export const SHEET_ID = 1245291756;
const normalized = value => String(value ?? '').trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
const statuses = new Set(['LIQUIDADO', 'PAGO DE MAS', 'LIQUIDADO O PAGO DE MAS', 'AL CORRIENTE', 'SALDO ATRASADO']);
const unavailable = (stage, status, reason) => Object.assign(Error('SAVINGS_LOAN_VERIFICATION_UNAVAILABLE'), {
  stage, upstream_status: status, upstream_reason: typeof reason === 'string' && /^[A-Za-z_]+$/.test(reason) ? reason : undefined,
});
export function evaluateLoans(rows, folio) {
  if (typeof folio !== 'string' || !folio.trim() || !Array.isArray(rows)) throw Error('SAVINGS_EXACT_IDENTITY_REQUIRED');
  const loans = new Map();
  for (const row of rows) {
    const id = String(row[2] ?? '').trim(), owner = String(row[3] ?? '');
    if (id && !owner.trim()) throw Error('LOAN_STATUS_DATA_INCONSISTENCY');
    if (owner !== folio && owner.trim() === folio) throw Error('LOAN_STATUS_DATA_INCONSISTENCY');
    if (owner !== folio) continue; // Never coerce numeric Folios or drop leading zeroes.
    const status = normalized(row[23]), fund = String(row[6] ?? '').trim();
    if (!id || !fund || !statuses.has(status)) throw Error('LOAN_STATUS_DATA_INCONSISTENCY');
    const prior = loans.get(id);
    if (prior && (prior.status !== status || prior.fund !== fund)) throw Error('LOAN_STATUS_DATA_INCONSISTENCY');
    if (!prior) loans.set(id, { id, fund, status, rows: 0 });
    loans.get(id).rows++;
  }
  return [...loans.values()].sort((a, b) => a.id.localeCompare(b.id));
}
export async function readLoanSource(env, fetcher = fetch) {
  const response = await fetcher('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: env('GOOGLE_REQUEST_SYNC_OAUTH_CLIENT_ID') || '', client_secret: env('GOOGLE_REQUEST_SYNC_OAUTH_CLIENT_SECRET') || '', refresh_token: env('GOOGLE_REQUEST_SYNC_OAUTH_REFRESH_TOKEN') || '', grant_type: 'refresh_token', scope: 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/script.webapp.deploy' }),
    signal: AbortSignal.timeout(15000),
  });
  const token = await response.json();
  if (!response.ok || !token.access_token) throw unavailable('OAUTH_REFRESH', response.status, token.error);
  const url = env('FINANCIAL_LEGACY_API_URL'), secret = env('FINANCIAL_LEGACY_API_TOKEN');
  if (!url || !secret) throw unavailable('RECEIVER_CONFIG', 503, 'NOT_CONFIGURED');
  // Same authoritative Google sheet through the existing authenticated receiver.
  // No direct-API fallback, cache, new connection or caller-selected range.
  const read = await fetcher(url, { method: 'POST', headers: { Authorization: 'Bearer ' + token.access_token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'read_loan_status', secret, contract_version: 'LOAN_STATUS_READ_V1' }), signal: AbortSignal.timeout(30000) });
  let data;
  try { data = await read.json(); } catch { throw unavailable('SHEET_VALUES', read.status, 'INVALID_RESPONSE'); }
  if (!read.ok || !data.ok || data.action !== 'read_loan_status' || data.contract_version !== 'LOAN_STATUS_READ_V1' ||
      data.workbook_id !== WORKBOOK || data.sheet_id !== SHEET_ID || data.sheet_name !== 'HISTORIAL P V2' ||
      !Array.isArray(data.valueRanges) || data.valueRanges.length !== 3 || data.valueRanges.some(r => !Array.isArray(r.values) || r.values.some(row => !Array.isArray(row)))) {
    throw unavailable('SHEET_VALUES', read.status, data.error || 'INVALID_RESPONSE');
  }
  const [ids, funds, states] = data.valueRanges.map(r => r.values || []);
  if (ids[0]?.[0] !== 'Fecha' || ids[0]?.[2] !== 'ID' || ids[0]?.[3] !== 'Folio' || funds[0]?.[0] !== 'Fondo' || normalized(states[0]?.[0]) !== 'ESTATUS DEL PRESTAMO' || ids.length < 2) throw Error('SAVINGS_LOAN_VERIFICATION_UNAVAILABLE');
  const rows = [];
  for (let i = 1; i < Math.max(ids.length, funds.length, states.length); i++) {
    const row = [...(ids[i] || [])]; row[6] = funds[i]?.[0]; row[23] = states[i]?.[0]; rows.push(row);
  }
  return { rows, observed_at: new Date().toISOString(), source: WORKBOOK + ':' + SHEET_ID, scanned_rows: rows.length };
}
