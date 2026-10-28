'use strict';
// Read-only replay of the exact captured cohort. Never connects to a database.
// Public evidence contains aggregate counts and opaque case references only.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const assert = require('assert/strict');
const { pathToFileURL } = require('url');

const TASK = 'H-LOAN-HISTORICAL-FUND-RESOLUTION-COMPLETE-001';
const COHORT_SHA = 'fa71be91ead30e331515beb22b04eab1d5363eee84b9f8409d8765ec71e7b132';
const REPORT_SHA = 'fc561c4aaa9b1be98463e324fefac47d14bddb390b144e5068ac6bb5ce2d4354';
// Independent, reviewed evidence set. Adding a runtime alias cannot silently
// enlarge the population this verifier certifies as outside loan capacity.
const REVIEWED_PROGRAMS = Object.freeze({
  'VALES Y MEMBRESIAS': 'membership', 'SEGURO COLECTIVO SUTI': 'insurance',
  'SUTI TERRENOS': 'terrenos', 'SUTI AUTO': 'auto', 'PANEL SOLAR': 'solar',
  'SUTI CIRUGIAS': 'cirugias', 'SUTI TOURS': 'tours',
});
const norm = value => String(value ?? '').trim().normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').toUpperCase();
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const cents = value => Math.round((value + Number.EPSILON) * 100);
function freeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}
function outcome(project, source, runtime, now, identity, observe) {
  try { return { status: 'PASS', capacity: project(source, runtime, now, identity, observe) }; }
  catch (error) { return { status: 'FAIL', error: error.message,
    reason: error.reason || null, obligation_id: error.obligation_id || null }; }
}
function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
}

async function main() {
  const workspace = path.resolve(process.argv[2] || process.env.SUTIAPP_INPUT_WORKSPACE || path.join(__dirname, '..'));
  const release = path.resolve(__dirname, '..');
  const privateDir = path.join(workspace, '.tmp/loan-historical-resolution');
  const sourcePath = path.join(workspace, '.tmp/loan-funds-12087/cohort-private.json');
  const priorPath = path.join(workspace, '.tmp/loan-funds-12087/replay-private.json');
  const provenancePath = path.join(privateDir, 'provenance-private.json');
  const beforeRoot = path.join(privateDir, 'before/functions');
  const candidateRoot = path.join(release, 'supabase/functions');
  const beforePath = path.join(beforeRoot, 'financial-legacy/loan-capacity.mjs');
  const candidatePath = path.join(candidateRoot, 'financial-legacy/loan-capacity.mjs');
  const mapPath = path.join(candidateRoot, 'financial-legacy/historical-obligation-map.mjs');
  const historyBefore = path.join(beforeRoot, 'loan-history/history.mjs');
  const historyAfter = path.join(candidateRoot, 'loan-history/history.mjs');
  const inputs = [sourcePath, priorPath, provenancePath];
  const inputHashes = new Map(inputs.map(file => [file, sha(fs.readFileSync(file))]));
  const runtimeHashes = new Map([beforePath, candidatePath, mapPath, historyBefore, historyAfter]
    .map(file => [file, sha(fs.readFileSync(file))]));
  assert.equal(inputHashes.get(sourcePath), COHORT_SHA, 'EXACT_COHORT_CHANGED');
  assert.equal(sha(fs.readFileSync(historyBefore)), sha(fs.readFileSync(historyAfter)), 'HISTORY_PROJECTOR_CHANGED');
  // Git's Windows checkout may use CRLF; the reviewed source hash uses LF.
  assert.equal(sha(fs.readFileSync(path.join(candidateRoot, 'reports-jc/report.mjs'), 'utf8').replace(/\r\n/g, '\n')),
    REPORT_SHA, 'HISTORICAL_CLASSIFICATION_EVIDENCE_CHANGED');
  const [before, candidate, history, aliases] = await Promise.all([
    import(pathToFileURL(beforePath).href), import(pathToFileURL(candidatePath).href),
    import(pathToFileURL(historyAfter).href), import(pathToFileURL(mapPath).href),
  ]);
  assert.deepEqual(Object.fromEntries(aliases.HISTORICAL_OBLIGATION_MAP.map(row => [norm(row.historical_value), row.program_classification])), REVIEWED_PROGRAMS);
  assert(aliases.HISTORICAL_OBLIGATION_MAP.every(row => row.canonical_fund_id === null && row.evidence && row.reason));
  const data = freeze(read(sourcePath)), prior = freeze(read(priorPath)), provenance = freeze(read(provenancePath));
  assert.equal(data.records.length, 1038);
  assert.equal(data.results.length, 1038);
  assert.equal(prior.length, 1038);
  assert.equal(new Set(data.records.map(row => row.affiliate_id)).size, 1038, 'DUPLICATE_COHORT_AFFILIATE');
  const contracts = new Map(provenance.request_contracts.map(row => [row.id, row]));
  const membershipIds = new Set(provenance.memberships.map(row => row.id));
  const nullControlIds = new Set(provenance.null_control_affiliates.map(row => row.id));
  const privateCases = [], publicCases = [], allResults = [];
  const counts = { beforePass: 0, originalFailures: 0, unchanged: 0, priorRecovered: 0,
    priorRecoveredUnchanged: 0, afterPass: 0, recovered: 0, newlyRecovered: 0,
    resolvedCrossProgram: 0, resolvedCanonical: 0, resolvedLegacy: 0, resolvedOtherValidation: 0,
    ambiguous: 0, ambiguousFund: 0, ambiguousContext: 0, ambiguousData: 0,
    observedCrossProgram: 0, observedCanonical: 0, observedLegacy: 0,
    includedPendingObligations: 0, representedRequestsVerified: 0,
    productFinancingPreserved: 0, productFinancingPreviouslyCorrect: 0 };
  let target = null;
  for (let index = 0; index < data.records.length; index++) {
    const record = data.records[index], captured = data.results[index], previous = prior[index];
    assert.equal(captured.control, record.numero_control, 'BASELINE_ORDER_CHANGED');
    assert.equal(previous.control, record.numero_control, 'PRIOR_REPLAY_ORDER_CHANGED');
    const identity = freeze({ affiliate_id: record.affiliate_id, numero_control: record.numero_control });
    const source = freeze({ ...record.source, folio: record.numero_control });
    const runtime = freeze({ funds: data.common.funds, rules: data.common.rules, requests: record.requests });
    const beforeInput = JSON.stringify({ source, runtime, identity });
    const original = outcome(before.projectLoanCapacity, source, runtime, data.common.now, identity);
    assert.equal(original.status, captured.status, 'BASELINE_STATUS_DRIFT');
    if (original.status === 'PASS') assert.equal(JSON.stringify(original.capacity), JSON.stringify(captured.capacity), 'BASELINE_CAPACITY_DRIFT');
    else assert.equal(original.error, captured.error, 'BASELINE_FAILURE_DRIFT');
    const observations = [];
    const after = outcome(candidate.projectLoanCapacity, source, runtime, data.common.now, identity,
      row => observations.push(row));
    assert.equal(JSON.stringify({ source, runtime, identity }), beforeInput, 'SOURCE_MUTATED');
    if (original.status === 'PASS') {
      counts.beforePass++;
      assert.equal(after.status, 'PASS', 'PREVIOUSLY_CORRECT_REGRESSION');
      assert.equal(JSON.stringify(after.capacity), JSON.stringify(original.capacity), 'PREVIOUSLY_CORRECT_RESULT_CHANGED');
      counts.unchanged++;
    } else counts.originalFailures++;
    const recoveredBefore = original.status === 'FAIL' && previous.status === 'PASS';
    if (recoveredBefore) {
      counts.priorRecovered++;
      assert.equal(after.status, 'PASS', 'PRIOR_12_REGRESSION');
      assert.equal(JSON.stringify(after.capacity), JSON.stringify(previous.capacity), 'PRIOR_12_CAPACITY_CHANGED');
      counts.priorRecoveredUnchanged++;
    }
    let projected = null;
    if (record.numero_control) projected = history.projectHistory(source, { folio: record.numero_control, requests: record.requests }, data.common.now);
    const entries = new Map((projected?.entries || []).map(row => [row.id, row]));
    const requestsByFolio = new Map(record.requests.map(row => [row.folio, row]));
    for (const observation of observations) {
      const loan = entries.get(observation.obligation_id);
      assert(loan, 'CLASSIFICATION_WITHOUT_HISTORY');
      const origins = source.requests.filter(row => row.id === loan.id);
      const sr = origins[0]?.receipt?.identity || (/^SR-/.test(loan.id) ? loan.id : null);
      const canonical = record.requests.find(row => row.id === loan.sourceId) || requestsByFolio.get(sr);
      if (observation.classification === 'CROSS_PROGRAM') {
        counts.observedCrossProgram++;
        assert(!data.common.funds.some(fund => norm(fund.name) === norm(loan.fund)), 'REAL_FUND_EXCLUDED');
        if (canonical) {
          // The captured cohort's canonical exclusions are independently
          // proven memberships, not any arbitrary nonfinancial program label.
          const contract = contracts.get(canonical.id);
          assert.equal(canonical.program_id, 'membership', 'UNREVIEWED_CANONICAL_EXCLUSION');
          assert.equal(canonical.financial, false, 'FINANCIAL_CONTRACT_EXCLUDED');
          assert.equal(canonical.criterion_identity, null);
          assert.equal(canonical.status, 'approved');
          assert.equal(contract?.contract?.contract_version, 'MEMBERSHIP_PAYMENT_V1');
          assert.equal(contract.affiliate_id, record.affiliate_id);
          assert(membershipIds.has(contract.membership_offering_id), 'MEMBERSHIP_OFFERING_UNPROVEN');
          assert.equal(norm(loan.fund), 'VALES Y MEMBRESIAS');
        } else {
          assert(!sr || !/^SR-/.test(sr), 'MISSING_CANONICAL_RELATION_IGNORED');
          assert.equal(REVIEWED_PROGRAMS[norm(loan.fund)], observation.program_id, 'UNPROVEN_HISTORICAL_EXCLUSION');
          assert(source.loans.filter(row => row.id === loan.id).every(row => norm(row.fund) === norm(loan.fund)), 'CONFLICTING_HISTORICAL_PROGRAM');
        }
      } else if (observation.classification === 'LOAN_CANONICAL') {
        counts.observedCanonical++;
        assert(canonical?.financial === true && canonical.program_id !== 'membership', 'MEMBERSHIP_DEDUCTED_AS_LOAN');
        const matching = data.common.rules.filter(rule => rule.criterion_identity === canonical.criterion_identity);
        assert.deepEqual([...new Set(matching.map(rule => rule.fund_id))], [observation.fund_id], 'CANONICAL_FUND_MISMATCH');
        if (canonical.program_id !== 'prestamo') {
          const contract = contracts.get(canonical.id);
          assert.equal(contract?.contract?.contract_version, 'PROGRAM_PRODUCT_PAYMENT_V1');
          assert.equal(contract.contract.criterion_identity, canonical.criterion_identity);
          assert.equal(contract.affiliate_id, record.affiliate_id);
          assert.equal(observation.fund_id, '665ed8f9-4f27-409d-885f-fb9ad807f71b');
          counts.productFinancingPreserved++;
          if (original.status === 'PASS') counts.productFinancingPreviouslyCorrect++;
        }
      } else if (observation.classification === 'LOAN_LEGACY_RESOLVABLE') {
        counts.observedLegacy++;
        assert(!canonical, 'CANONICAL_RELATION_OVERRIDDEN');
        assert.equal(REVIEWED_PROGRAMS[norm(loan.fund)], undefined, 'OTHER_PROGRAM_DEDUCTED_AS_LOAN');
        const matching = data.common.funds.filter(fund => norm(fund.name) === norm(loan.fund));
        assert.equal(matching.length, 1);
        assert.equal(matching[0].id, observation.fund_id);
      }
    }
    if (after.status === 'PASS') {
      counts.afterPass++;
      // Independent aggregation of the unchanged history contract: total minus
      // paidThrough(A/B), rounding only the final obligation balance to cents.
      const expected = new Map(data.common.funds.map(fund => [fund.id, { pending: 0, count: 0 }]));
      const represented = [];
      for (const observation of observations) {
        if (observation.classification === 'CROSS_PROGRAM') continue;
        const loan = entries.get(observation.obligation_id);
        if (loan.sourceId) represented.push(loan.sourceId);
        assert.equal(loan.paid_to_date, history.paidThrough(loan.schedule, projected.business_day));
        const amount = cents(Math.max(0, loan.total - loan.paid_to_date));
        if (amount === 0) continue;
        assert(observation.fund_id, 'POSITIVE_AMBIGUOUS_DEBT_IGNORED');
        expected.get(observation.fund_id).pending += amount;
        expected.get(observation.fund_id).count++;
        counts.includedPendingObligations++;
      }
      assert.equal(new Set(represented).size, represented.length, 'DUPLICATE_REPRESENTED_REQUEST');
      assert.deepEqual(after.capacity.represented_request_ids, represented.sort(), 'RESERVATION_RELEASE_IDENTITY_MISMATCH');
      counts.representedRequestsVerified += represented.length;
      for (const row of after.capacity.funds) {
        assert.equal(cents(row.pending_amount), expected.get(row.fund_id).pending, 'DEBT_BALANCE_FORMULA_CHANGED');
        assert.equal(row.active_loans, expected.get(row.fund_id).count, 'ACTIVE_LOAN_COUNT_CHANGED');
      }
    }
    const ref = sha(TASK + '\0' + record.affiliate_id).slice(0, 20);
    let classification = 'PREVIOUSLY_CORRECT';
    if (original.status === 'FAIL') {
      if (after.status === 'PASS') {
        counts.recovered++;
        if (!recoveredBefore) counts.newlyRecovered++;
        if (original.error !== 'LOAN_CAPACITY_FUND_UNRESOLVED') {
          classification = 'OTHER_VALIDATION'; counts.resolvedOtherValidation++;
        } else if (observations.some(row => row.classification === 'CROSS_PROGRAM')) {
          classification = 'CROSS_PROGRAM'; counts.resolvedCrossProgram++;
        } else if (observations.some(row => row.classification === 'LOAN_CANONICAL')) {
          classification = 'LOAN_CANONICAL'; counts.resolvedCanonical++;
        } else { classification = 'LOAN_LEGACY_RESOLVABLE'; counts.resolvedLegacy++; }
      } else {
        classification = 'AMBIGUOUS'; counts.ambiguous++;
        if (after.error === 'HISTORICAL_LOAN_MAPPING_REQUIRED') counts.ambiguousFund++;
        else if (after.error === 'LOAN_CAPACITY_CONTEXT_INVALID') counts.ambiguousContext++;
        else counts.ambiguousData++;
      }
      const issueLoan = after.obligation_id ? entries.get(after.obligation_id) : null;
      const privateCase = { ref, cohort_index: index, affiliate_id: record.affiliate_id,
        numero_control: record.numero_control, baseline_error: original.error,
        prior_fix_pass: recoveredBefore, resolution: after.status === 'PASS' ? 'RESOLVED' : 'AMBIGUOUS',
        classification, current_error: after.error || null, reason: after.reason || null,
        obligation_id: after.obligation_id || null, historical_value: issueLoan?.fund || null,
        source_rows: issueLoan?.schedule.map(row => row.source_row) || [],
        observations, required_decision: null };
      if (classification === 'AMBIGUOUS') {
        if (!record.numero_control) {
          assert(nullControlIds.has(record.affiliate_id), 'NULL_CONTROL_AFFILIATE_NOT_IN_PROVENANCE');
          privateCase.required_decision = 'Falta numero_control autoritativo. Resolver identidad mediante el escritor de Afiliados; no inventar control ni vincular por nombre/email.';
        } else if (after.error === 'HISTORICAL_LOAN_MAPPING_REQUIRED') {
          privateCase.required_decision = norm(issueLoan?.fund).includes('ANOS DE SERVICIO')
            ? 'Confirmar documentalmente el fondo real. El histórico dice 15/04/2025 y el catálogo 08/04/2025; no existe alias ni auditoría de renombre.'
            : 'Acreditar programa/fondo exacto. La plantilla prueba Descuento SUTISSSTESON singular/código 446; estas filas plurales no conservan ese código en el snapshot.';
        } else {
          privateCase.required_decision = 'Revisar importes originales incompletos o inválidos de las filas indicadas. No sustituir importes ausentes por cero ni modificar el historial automáticamente.';
          privateCase.invalid_schedule_fields = issueLoan?.schedule.filter(row => row.amount === null || !row.date)
            .map(row => ({ source_row: row.source_row, date: row.date, amount: row.amount, state: row.state })) || [];
        }
      }
      privateCases.push(privateCase);
      publicCases.push({ ref, baseline_error: original.error, prior_fix_pass: recoveredBefore,
        resolution: privateCase.resolution, classification, current_error: privateCase.current_error,
        reason: privateCase.reason });
    }
    if (record.numero_control === '12087') {
      assert.equal(after.status, 'PASS');
      assert(recoveredBefore);
      target = { status: 'PASS', prior_fix_preserved: true, history_preserved: true,
        canonical_membership_excluded_from_loan_capacity: observations.some(row => row.classification === 'CROSS_PROGRAM' && row.program_id === 'membership' && row.evidence.startsWith('program_request:')) };
      assert(target.canonical_membership_excluded_from_loan_capacity);
    }
    allResults.push({ ref, status: after.status, capacity_sha256: after.capacity ? sha(JSON.stringify(after.capacity)) : null });
  }
  assert.equal(counts.beforePass, 974); assert.equal(counts.unchanged, 974);
  assert.equal(counts.originalFailures, 64); assert.equal(counts.priorRecovered, 12);
  assert.equal(counts.priorRecoveredUnchanged, 12); assert.equal(counts.afterPass, 1026);
  assert.equal(counts.recovered, 52); assert.equal(counts.newlyRecovered, 40);
  assert.equal(counts.resolvedCrossProgram, 48); assert.equal(counts.resolvedOtherValidation, 4);
  assert.equal(counts.resolvedCanonical, 0); assert.equal(counts.resolvedLegacy, 0);
  assert.equal(counts.ambiguous, 12); assert.equal(counts.ambiguousFund, 6);
  assert.equal(counts.ambiguousContext, 5); assert.equal(counts.ambiguousData, 1);
  assert.equal(counts.productFinancingPreserved, 7); assert.equal(counts.productFinancingPreviouslyCorrect, 6);
  assert.equal(privateCases.length, 64); assert(target);
  for (const [file, expected] of inputHashes) assert.equal(sha(fs.readFileSync(file)), expected, 'INPUT_FILE_CHANGED');
  for (const [file, expected] of runtimeHashes) assert.equal(sha(fs.readFileSync(file)), expected, 'RUNTIME_CHANGED_DURING_REPLAY');
  const evidence = { task: TASK, status: 'PASS', scope: 'DETERMINISTIC_CASES_AND_REGRESSION_WITH_12_DOCUMENTED_AMBIGUOUS', mode: 'OFFLINE_EXACT_COHORT_REPLAY',
    cohort_sha256: COHORT_SHA, observed_at: data.common.now, profiles_checked: 1038,
    previously_correct_unchanged: '974 / 974', original_failures: 64,
    resolved_cross_program: publicCases.filter(row => row.classification === 'CROSS_PROGRAM').map(row => row.ref),
    resolved_loan_canonical: [], resolved_loan_legacy: [],
    other_validation_resolved: publicCases.filter(row => row.classification === 'OTHER_VALIDATION').map(row => row.ref),
    remaining_ambiguous: publicCases.filter(row => row.classification === 'AMBIGUOUS'),
    counts, target_12087: target, financial_balances_changed: 0, historical_rows_modified: 0,
    false_debt_exclusions: 0, memberships_deducted_as_loans: 0,
    reservation_amortization_duplicate_identities: 0, regression: '0 / 974',
    inputs_immutable: true, history_projector_unchanged: true,
    formulas_and_included_obligation_balances_verified: true,
    all_64_cases: publicCases, all_results_sha256: sha(JSON.stringify(allResults)),
    hashes: { before_projector: sha(fs.readFileSync(beforePath)), candidate_projector: sha(fs.readFileSync(candidatePath)),
      historical_map: sha(fs.readFileSync(mapPath)), history_projector: sha(fs.readFileSync(historyAfter)),
      prior_replay: inputHashes.get(priorPath), provenance: inputHashes.get(provenancePath),
      reviewed_report_classification: REPORT_SHA },
    limits: ['This replays projections at the original captured timestamp, not authenticated end-to-end eligibility.',
      'No database, Google, financial records, or production sessions are written.',
      'Reservation evidence verifies exact unique represented request identities; backend reservation arithmetic is covered by separate focused SQL tests.',
      'Pending identity, source-amount and historical-fund decisions remain blocked and are not treated as zero debt.'] };
  const publicPath = path.join(release, 'docs/qa/evidence/loan-historical-resolution/cohort.json');
  writeJson(publicPath, evidence);
  writeJson(path.join(privateDir, 'classification-private.json'), { task: TASK, cohort_sha256: COHORT_SHA,
    counts, cases: privateCases });
  const pending = privateCases.filter(row => row.classification === 'AMBIGUOUS');
  const lines = ['# AMBIGUOUS OWNER REVIEW', '', 'H-LOAN-HISTORICAL-FUND-RESOLUTION-COMPLETE-001', '',
    'Archivo privado local. No publicar en Git ni en el sitio. Sólo los 12 casos pendientes; cero saldos o históricos modificados.', '',
    'La cohorte original contiene 1,038 perfiles. Se mantienen 974/974 resultados anteriores y las 12 correcciones previas. Se recuperan 40 casos adicionales. Estos 12 casos requieren evidencia o decisión administrativa.', ''];
  for (const row of pending) {
    lines.push('## ' + (row.numero_control ? 'Control ' + row.numero_control : 'Sin numero_control: ' + row.affiliate_id), '',
      '- Referencia: ' + row.ref, '- UUID afiliado: ' + row.affiliate_id,
      '- Clasificación: AMBIGUOUS (' + (row.current_error === 'HISTORICAL_LOAN_MAPPING_REQUIRED' ? 'fondo/programa' : 'OTHER_VALIDATION') + ')',
      '- Error original: ' + row.baseline_error, '- Error actual: ' + row.current_error,
      '- Razón: ' + (row.reason || 'CONTEXT_INVALID'),
      '- Obligación histórica: ' + (row.obligation_id || 'No identificable: falta numero_control; captura vacía no acredita ausencia de deuda.'),
      '- Fondo histórico: ' + (row.historical_value || 'No aplicable'),
      '- Filas HISTORIAL P V2: ' + (row.source_rows.join(', ') || 'No aplicable'),
      '- Evidencia pendiente/acción: ' + row.required_decision, '');
    if (row.invalid_schedule_fields?.length) lines.push('Campos incompletos: `' + JSON.stringify(row.invalid_schedule_fields) + '`', '');
  }
  lines.push('Fuente exacta: .tmp/loan-funds-12087/cohort-private.json, SHA256 ' + COHORT_SHA + '.',
    'Provenance: .tmp/loan-historical-resolution/provenance-private.json. Detalle de clasificación: classification-private.json.', '');
  fs.writeFileSync(path.join(privateDir, 'AMBIGUOUS-OWNER-REVIEW.md'), lines.join('\n'));
  console.log(JSON.stringify({ status: evidence.status, counts, target_12087: target.status,
    false_debt_exclusions: 0, financial_balances_changed: 0, historical_rows_modified: 0, regression: evidence.regression }));
}
main().catch(error => { console.error(error.stack); process.exitCode = 1; });
