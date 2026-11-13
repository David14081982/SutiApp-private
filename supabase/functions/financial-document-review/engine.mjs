// Documentary assessment only. Never assesses affordability or changes a request.
export const VERSION = 'FINANCIAL_DOCUMENT_REVIEW_V1';
export const ANALYSIS_REVISION = '2026-11-13.2';
export const PENDING_STATUSES = ['submitted', 'in_review', 'requires_financial_processing'];
const states = ['READABLE', 'PARTIAL', 'UNREADABLE'];
const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
const finiteMoney = n => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 1e9;
const cents = n => Math.round(n * 100);
const validYear = n => Number.isInteger(n) && n >= 1900 && n <= 2200;
export function payrollAmountIssue(d) {
  if (!finiteMoney(d.net)) return 'NET_UNREADABLE';
  if (d.currency !== 'MXN') return 'CURRENCY_UNCONFIRMED';
  if (finiteMoney(d.gross) && finiteMoney(d.deductions) && Math.abs(cents(d.gross) - cents(d.deductions) - cents(d.net)) > 2) return 'TOTALS_MISMATCH';
  return null;
}
export function hasValidity(d) { return validDate(d.valid_until) || validYear(d.valid_until_year); }
export function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(value + 'T12:00:00Z');
  return Number.isFinite(+d) && d.toISOString().slice(0, 10) === value;
}
export function compareNames(a, b) {
  const left = normalize(a).split(' ').filter(Boolean), right = normalize(b).split(' ').filter(Boolean);
  if (!left.length || !right.length) return 'MANUAL';
  if (left.slice().sort().join(' ') === right.slice().sort().join(' ')) return 'PASS';
  // Missing surnames, initials, reordered/compound names need a person, not rejection.
  if (left.some(token => right.includes(token))) return 'MANUAL';
  return 'FAIL';
}
export function validateExtraction(extraction, documents) {
  if (!extraction || !Array.isArray(extraction.documents) || extraction.documents.length !== documents.length) throw Error('EXTRACTION_SCHEMA_INVALID');
  const expected = new Set(documents.map(d => d.id)), seen = new Set();
  for (const d of extraction.documents) {
    if (!expected.has(d.id) || seen.has(d.id) || !states.includes(d.legibility) ||
        ![true, false, null].includes(d.type_matches) || typeof d.evidence !== 'string' || d.evidence.length > 1200 ||
        ![d.holder_name, d.currency].every(v => v === null || typeof v === 'string' && v.length <= 300) ||
        ![d.net, d.gross, d.deductions].every(v => v === null || finiteMoney(v)) ||
        ![d.period_start, d.period_end, d.payment_date, d.valid_until].every(v => v === null || validDate(v)) ||
        ![d.valid_from_year, d.valid_until_year].every(v => v == null || validYear(v)) ||
        !Array.isArray(d.extras) || d.extras.length > 30 || d.extras.some(x => !['BONUS', 'OVERTIME', 'OTHER'].includes(x.kind) || typeof x.label !== 'string' || x.label.length > 150 || !(x.amount === null || finiteMoney(x.amount)))) throw Error('EXTRACTION_SCHEMA_INVALID');
    seen.add(d.id);
  }
  if (!extraction.signature || !['SIMILAR', 'DIFFERENT', 'UNKNOWN'].includes(extraction.signature.comparison) || typeof extraction.signature.evidence !== 'string' || extraction.signature.evidence.length > 1200) throw Error('EXTRACTION_SCHEMA_INVALID');
  return extraction;
}
export function evaluate(context, extraction) {
  validateExtraction(extraction, context.documents);
  if (!validDate(context.submission_day)) throw Error('SUBMISSION_DATE_REQUIRED');
  const checks = [], payroll = [], source = new Map(extraction.documents.map(d => [d.id, d]));
  const add = (key, status, message, documentId = null, correctable = false) => checks.push({ key, status, message, document_id: documentId, correctable });
  if (!Array.isArray(context.requirements) || !context.requirements.length) add('requirements', 'MANUAL', 'No fue posible determinar todos los requisitos documentales de esta solicitud.');
  for (const req of context.requirements || []) {
    if (!req.required) continue;
    const doc = context.documents.find(d => d.document_type_id === req.document_type_id);
    add('required:' + req.document_type_id, doc ? 'PASS' : 'FAIL', doc ? req.label + ': documento adjunto.' : 'Falta el documento requerido: ' + req.label + '.', doc?.id || null);
  }
  for (const doc of context.documents) {
    const d = source.get(doc.id), readable = d.legibility === 'READABLE' && Boolean(d.evidence.trim());
    add('readable:' + doc.id, readable ? 'PASS' : 'MANUAL', readable ? doc.label + ': datos legibles.' : doc.label + ': no se pudieron leer todos los datos necesarios. Sustituye el archivo por una imagen completa y legible.', doc.id, !readable);
    add('type:' + doc.id, d.type_matches === true ? 'PASS' : d.type_matches === false ? 'FAIL' : 'MANUAL', d.type_matches === true ? doc.label + ': tipo documental identificado.' : 'Verifica que el archivo corresponda a ' + doc.label + '.', doc.id, d.type_matches !== true);
    if (['ine_front', 'payroll_latest', 'payroll_previous'].includes(doc.code)) {
      const match = readable && d.type_matches === true ? compareNames(context.applicant_name, d.holder_name) : 'MANUAL';
      add('name:' + doc.id, match, match === 'PASS' ? doc.label + ': nombre correspondiente al solicitante.' : match === 'FAIL' ? doc.label + ': el nombre leído no corresponde al solicitante. Revisa el documento adjunto.' : doc.label + ': la correspondencia del nombre requiere revisión manual.', doc.id, match !== 'PASS');
    }
    if (['ine_front', 'ine_back'].includes(doc.code) && readable && d.type_matches === true && hasValidity(d)) {
      const endYear = d.valid_until ? Number(d.valid_until.slice(0, 4)) : d.valid_until_year;
      const inconsistent = validYear(d.valid_from_year) && d.valid_from_year > endYear || validYear(d.valid_until_year) && d.valid_until && d.valid_until_year !== endYear;
      const expired = d.valid_until ? d.valid_until < context.submission_day : endYear < Number(context.submission_day.slice(0, 4));
      const future = validYear(d.valid_from_year) && d.valid_from_year > Number(context.submission_day.slice(0, 4));
      add('ine-valid:' + doc.id, inconsistent || future ? 'MANUAL' : expired ? 'FAIL' : 'PASS', inconsistent ? 'La vigencia leída de la INE contiene años inconsistentes; requiere revisión manual.' : future ? 'El inicio de vigencia leído de la INE es posterior al año de solicitud; requiere revisión manual.' : expired ? 'La vigencia leída de la INE es anterior a la presentación de la solicitud.' : 'INE vigente a la fecha de solicitud. Vigencia leída: ' + (d.valid_until || (d.valid_from_year ? d.valid_from_year + '–' : '') + endYear + ' (años)') + '.', doc.id, expired || inconsistent || future);
    }
    if (['payroll_latest', 'payroll_previous'].includes(doc.code)) {
      const identified = readable && d.type_matches === true && compareNames(context.applicant_name, d.holder_name) === 'PASS';
      const issue = payrollAmountIssue(d), usable = identified && !issue;
      if (!usable) {
        const reason = !identified ? 'la lectura o correspondencia del titular requiere revisión antes de utilizar el neto' : issue === 'NET_UNREADABLE' ? 'no se pudo leer el campo «Neto a pagar»' : issue === 'CURRENCY_UNCONFIRMED' ? 'se leyó un importe neto, pero no se pudo confirmar que la moneda sea pesos mexicanos' : 'el neto leído no coincide con total de percepciones menos total de deducciones';
        add('net:' + doc.id, 'MANUAL', doc.label + ': ' + reason + '. La encargada debe verificarlo; no se utilizará para el promedio.', doc.id, !readable || issue === 'NET_UNREADABLE');
      }
      payroll.push({ document_id: doc.id, period_start: d.period_start, period_end: d.period_end, payment_date: d.payment_date, net: usable ? d.net : null, extras: identified ? d.extras : [], usable });
      if (!d.period_start || !d.period_end) add('period-missing:' + doc.id, 'MANUAL', 'No fue posible leer el periodo completo del talón. Sustituye el archivo por una imagen completa y legible.', doc.id, true);
      if (d.period_start && d.period_end && d.period_start > d.period_end) add('period-order:' + doc.id, 'MANUAL', 'Las fechas leídas del periodo de nómina son inconsistentes.', doc.id, true);
    }
  }
  const ine = context.documents.filter(d => ['ine_front', 'ine_back'].includes(d.code));
  if (ine.length && !ine.some(d => source.get(d.id).legibility === 'READABLE' && source.get(d.id).type_matches === true && hasValidity(source.get(d.id)))) add('ine-validity', 'MANUAL', 'No se pudo leer una fecha o un año de vencimiento en el campo Vigencia de la INE. Requiere revisión manual.');
  if (context.documents.some(d => d.code === 'ine_back') && context.signature_available) {
    const similar = extraction.signature.comparison === 'SIMILAR' && Boolean(extraction.signature.evidence.trim()) && ine.every(d => source.get(d.id).legibility === 'READABLE');
    add('signature', similar ? 'PASS' : 'MANUAL', similar ? 'La firma capturada presenta similitud visual con la firma del titular en la INE; no certifica autenticidad.' : 'La similitud entre la firma de la solicitud y la firma del titular en la INE requiere revisión manual.');
  } else add('signature', 'MANUAL', 'No fue posible comparar ambas firmas.');
  const periodKey = p => p.period_start && p.period_end ? p.period_start + '/' + p.period_end : null;
  const distinct = payroll.length === 2 && payroll.every(p => periodKey(p)) && periodKey(payroll[0]) !== periodKey(payroll[1]);
  if (payroll.length === 2 && periodKey(payroll[0]) && periodKey(payroll[0]) === periodKey(payroll[1])) {
    for (const p of payroll) add('duplicate-period:' + p.document_id, 'FAIL', 'Ambos talones corresponden al mismo periodo. Sustituye el que no corresponda.', p.document_id, true);
  }
  // Owner decision 2026-11-13: report the actual periods; only staff judge recency.
  const ordered = payroll.filter(p => validDate(p.period_end) && validDate(p.period_start) && p.period_start <= p.period_end).sort((a, b) => b.period_end.localeCompare(a.period_end));
  const latest = ordered.length && (ordered.length === 1 && payroll.length === 1 || distinct && ordered.length === 2) ? ordered[0] : null;
  const average = distinct && payroll.every(p => p.usable && p.period_start <= p.period_end) ? Math.round(payroll.reduce((sum, p) => sum + cents(p.net), 0) / 2) / 100 : null;
  const status = checks.some(c => c.status === 'FAIL') ? 'FAIL' : checks.some(c => c.status === 'MANUAL') ? 'MANUAL' : 'PASS';
  const observations = checks.filter(c => c.status !== 'PASS');
  // Existing workflow comment field accepts at most 2,000 characters.
  let draft = observations.length ? 'Revisamos tu solicitud. Se identificaron las siguientes observaciones documentales:\n\n' : '';
  for (const message of [...new Set(observations.map(o => o.message))]) {
    if (draft.length + message.length > 1850) { draft += 'Consulta las demás observaciones documentales en el seguimiento de tu solicitud.'; break; }
    draft += '• ' + message + '\n';
  }
  return { version: VERSION, analysis_revision: ANALYSIS_REVISION, status, checks, observations, payroll: { latest, average, receipts: payroll },
    rejection_draft: draft.trim(),
    passed_count: checks.filter(c => c.status === 'PASS').length, check_count: checks.length };
}
