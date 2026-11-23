/* H-LOAN-NATIVE-TRANSFER-001: fixed-sheet storage adapter for the native planner.
 * No trigger, financial calculation, browser endpoint or alternative authority.
 * Every entry shares the receiver's ScriptLock; the private journal survives retries.
 */
const NATIVE_LOAN_TRANSFER_VERSION = 'NATIVE_LOAN_TRANSFER_V1';
const NATIVE_LOAN_TRANSFER_PENDING = 'NATIVE_LOAN_TRANSFER_PENDING_V1';
const NATIVE_LOAN_TRANSFER_HIGH_WATER = 'NATIVE_LOAN_TRANSFER_HIGH_WATER_V1';

function nativeLoanTransferRead_(payload) {
  return nativeLoanTransferEntry_(payload, 'native_loan_transfer_read', false, function(context) {
    const snapshot = nativeLoanTransferPublicSnapshot_(nativeLoanTransferSnapshot_(context));
    if (snapshot.pending) {
      const job = nativeLoanTransferParseJournal_(context.properties.getProperty(NATIVE_LOAN_TRANSFER_PENDING));
      const current = nativeLoanTransferFindSource_(context.source, job.identity, job.id);
      const matches = nativeLoanTransferFindIds_(context.target, job.id);
      const projected = nativeLoanTransferProjection_(current.values, job.id, job.date);
      snapshot.recovery = {id:job.id, copied:job.copied, existing:job.existingLoan,
        sourceMatches:nativeLoanTransferFingerprint_(current.values) === job.sourceHash,
        projectedMatches:nativeLoanTransferHash_(projected) === job.targetHash,
        receiptMatches:current.note === job.receiptNote, originalNoteMatches:current.note === job.originalNote,
        numericMatches:String(current.values[0]) === String(job.id), state:String(current.values[24]), destinations:matches.length};
      if (matches.length === 1) {
        const actual = nativeLoanTransferNormalizeDestination_(context.target.getRange(matches[0],1,1,17).getValues()[0]);
        snapshot.recovery.differingColumns = actual.map(function(v,i){return String(v) === String(projected[i]) ? null : i+1;}).filter(function(v){return v!==null;});
        snapshot.recovery.destinationProjectionMatches = nativeLoanTransferHash_(actual) === job.targetHash;
      }
    }
    return snapshot;
  });
}

function nativeLoanTransferStatus_(payload) {
  return nativeLoanTransferEntry_(payload, 'native_loan_transfer_status', ['identity'], function(context) {
    if (!/^SR-\d{4}-\d{6,}$/.test(payload.identity || '')) throw new Error('LOAN_TRANSFER_IDENTITY_INVALID');
    const match = requestRegisterIdentity_(context.source, null, payload.identity);
    return {id:match && match.loanId || null};
  });
}

function nativeLoanTransferResume_(payload) {
  return nativeLoanTransferEntry_(payload, 'native_loan_transfer_resume', false, function(context) {
    const pending = context.properties.getProperty(NATIVE_LOAN_TRANSFER_PENDING);
    if (!pending) return {transferred:0, resumed:false, pending:false};
    const job = nativeLoanTransferParseJournal_(pending);
    try { nativeLoanTransferRecover_(context, job); }
    catch (error) {
      if (String(error && error.message) !== 'LOAN_TRANSFER_SOURCE_CHANGED') throw error;
      // A uniquely numbered source and its already present, matching loan need
      // no new allocation. Preserve both records and the original journal.
      const current = nativeLoanTransferFindSource_(context.source, job.identity, job.id);
      const matches = nativeLoanTransferFindIds_(context.target, job.id);
      if (String(current.values[0]) !== String(job.id) || current.note !== job.receiptNote ||
          !nativeLoanTransferApproved_(current.values[24]) || matches.length !== 1) throw error;
      nativeLoanTransferVerifyDestination_(context.target, matches[0], nativeLoanTransferProjection_(current.values, job.id, job.date));
      const archiveKey = 'NATIVE_LOAN_TRANSFER_RECONCILED_' + job.id;
      const archived = context.properties.getProperty(archiveKey);
      if (archived !== null && archived !== pending) throw new Error('LOAN_TRANSFER_JOURNAL_INVALID');
      context.properties.setProperty(archiveKey, pending);
      if (context.properties.getProperty(archiveKey) !== pending) throw new Error('LOAN_TRANSFER_READBACK_FAILED');
      context.properties.deleteProperty(NATIVE_LOAN_TRANSFER_PENDING);
      return {transferred:0, resumed:true, pending:false, preserved_id:job.id};
    }
    return {transferred:1, resumed:true, pending:false};
  });
}

function nativeLoanTransferApply_(payload) {
  return nativeLoanTransferEntry_(payload, 'native_loan_transfer_apply', true, function(context) {
    if (context.properties.getProperty(NATIVE_LOAN_TRANSFER_PENDING)) throw new Error('LOAN_TRANSFER_PENDING_REQUIRED');
    const snapshot = nativeLoanTransferSnapshot_(context);
    nativeLoanTransferValidatePlan_(payload.plan, snapshot);
    const started = Date.now();
    let transferred = 0;
    for (let index = 0; index < payload.plan.jobs.length; index += 1) {
      if (Date.now() - started >= 240000) break;
      const proposed = payload.plan.jobs[index], candidate = snapshot.internal[index];
      const current = nativeLoanTransferFindSource_(context.source, proposed.identity, proposed.identity);
      if (nativeLoanTransferFingerprint_(current.values) !== proposed.source_hash ||
          !nativeLoanTransferApproved_(current.values[24]) || current.note !== candidate.note) {
        throw new Error('LOAN_TRANSFER_SOURCE_CHANGED');
      }
      let targetRow, targetHash;
      if (proposed.existing_loan) {
        const destination = nativeLoanTransferExisting_(context.target, current);
        targetRow = destination.row;
        targetHash = nativeLoanTransferDestinationHash_(context.target, targetRow);
        if (targetHash !== candidate.destination_hash) throw new Error('LOAN_TRANSFER_DESTINATION_CHANGED');
      } else {
        const sourceMatches = nativeLoanTransferFindIds_(context.source, proposed.id);
        const keepsNumericId = String(current.values[0]) === String(proposed.id);
        if (nativeLoanTransferFindIds_(context.target, proposed.id).length ||
            (keepsNumericId ? sourceMatches.length !== 1 || sourceMatches[0] !== current.row : sourceMatches.length !== 0)) {
          throw new Error('LOAN_TRANSFER_ID_CONFLICT');
        }
        targetRow = Math.max(2, context.target.getLastRow() + 1);
        targetHash = nativeLoanTransferHash_(nativeLoanTransferProjection_(current.values, proposed.id, snapshot.approval_date));
      }
      const receiptNote = proposed.existing_loan ? current.note :
        (current.note ? current.note + '\n' : '') + nativeLoanTransferReceiptPrefix_(proposed.identity) + JSON.stringify({
          identity:proposed.identity, id:proposed.id, sourceHash:proposed.source_hash
        });
      const job = {
        version:NATIVE_LOAN_TRANSFER_VERSION, identity:proposed.identity, id:proposed.id,
        sourceHash:proposed.existing_loan ? nativeLoanTransferReceipt_(current.note).sourceHash : proposed.source_hash, targetRow:targetRow, targetHash:targetHash,
        date:snapshot.approval_date, originalNote:current.note, receiptNote:receiptNote,
        sourceWasNumeric:/^[1-9]\d{3}$/.test(proposed.identity), existingLoan:proposed.existing_loan, copied:false
      };
      // Persist identity reservation before touching either financial history.
      nativeLoanTransferSaveJournal_(context.properties, job);
      nativeLoanTransferRecover_(context, job);
      transferred += 1;
    }
    return {transferred:transferred, remaining:payload.plan.jobs.length - transferred, pending:false};
  });
}

function nativeLoanTransferEntry_(payload, action, hasPlan, work) {
  try {
    const properties = PropertiesService.getScriptProperties();
    const secret = properties.getProperty(HANDOFF_SECRET_PROPERTY);
    if (!payload || !secret || !constantTimeEqual_(payload.secret, secret)) throw new Error('UNAUTHORIZED');
    nativeLoanTransferKeys_(payload, ['action','secret','contract_version'].concat(Array.isArray(hasPlan) ? hasPlan : hasPlan ? ['plan'] : []));
    if (payload.action !== action || payload.contract_version !== NATIVE_LOAN_TRANSFER_VERSION) throw new Error('LOAN_TRANSFER_CONTRACT_INVALID');
    const lock = LockService.getScriptLock();
    if (!lock.tryLock(20000)) throw new Error('LOAN_TRANSFER_BUSY');
    try {
      const book = SpreadsheetApp.openById('1Vxy84N7mzbuioTmWhjRD2QFboDx--rG3iUwmLuyeY80');
      const source = book.getSheetByName('Historial de solicitudes');
      const target = book.getSheetByName('HISTORIAL DE PRESTAMOS');
      if (String(book.getId()) !== '1Vxy84N7mzbuioTmWhjRD2QFboDx--rG3iUwmLuyeY80' ||
          !source || !target || source.getSheetId() !== 10616270 || target.getSheetId() !== 1173027666) {
        throw new Error('LOAN_TRANSFER_SHEET_MISMATCH');
      }
      const result = work({source:source, target:target, properties:properties});
      return jsonResponse_(Object.assign({ok:true, contract_version:NATIVE_LOAN_TRANSFER_VERSION}, result));
    } finally { lock.releaseLock(); }
  } catch (error) {
    const code = String(error && error.message || '');
    return jsonResponse_({ok:false, contract_version:NATIVE_LOAN_TRANSFER_VERSION,
      error:/^(LOAN_TRANSFER_[A-Z_]+|UNAUTHORIZED)$/.test(code) ? code : 'LOAN_TRANSFER_FAILED'});
  }
}

function nativeLoanTransferKeys_(value, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      Object.keys(value).length !== keys.length || Object.keys(value).some(function(key) { return keys.indexOf(key) < 0; })) {
    throw new Error('LOAN_TRANSFER_INVALID_FIELD');
  }
}

function nativeLoanTransferApproved_(value) { return String(value).trim().toLowerCase() === 'aprobado'; }
function nativeLoanTransferStarted_(value) { return String(value).trim().toLowerCase() === 'iniciado'; }
function nativeLoanTransferHash_(value) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, JSON.stringify(value), Utilities.Charset.UTF_8)
    .map(function(byte) { return ('0' + ((byte + 256) % 256).toString(16)).slice(-2); }).join('');
}
function nativeLoanTransferFingerprint_(row) {
  return nativeLoanTransferHash_(row.slice(1, 24).concat(row.slice(25, 33)));
}
function nativeLoanTransferUnnumbered_(identity, sourceHash) {
  return typeof identity === 'string' && /^UNNUMBERED:[a-f0-9]{64}$/.test(identity) &&
    (sourceHash === undefined || identity.slice('UNNUMBERED:'.length) === sourceHash);
}
function nativeLoanTransferBlankId_(value) { return value === '' || value === null; }
function nativeLoanTransferReceiptPrefix_(identity) {
  return nativeLoanTransferUnnumbered_(identity) || /^[1-9]\d{3}$/.test(identity) ? 'SUTI_MANUAL_LOAN_TRANSFER_V1:' : 'SUTI_LOAN_TRANSFER_V1:';
}
function nativeLoanTransferMaximum_(sheet) {
  let maximum = 0;
  const height = sheet.getLastRow();
  if (height < 2) return maximum;
  sheet.getRange(2, 1, height - 1, 1).getValues().forEach(function(row) {
    const value = String(row[0]).trim();
    if (!/^\d+$/.test(value)) return;
    if (!Number.isSafeInteger(Number(value))) throw new Error('LOAN_TRANSFER_COUNTER_INVALID');
    maximum = Math.max(maximum, Number(value));
  });
  return maximum;
}
function nativeLoanTransferHighWater_(properties) {
  const value = properties.getProperty(NATIVE_LOAN_TRANSFER_HIGH_WATER);
  if (value !== null && (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value)))) throw new Error('LOAN_TRANSFER_COUNTER_INVALID');
  return Number(value || 0);
}
function nativeLoanTransferFindIds_(sheet, identity) {
  const matches = [], height = sheet.getLastRow();
  if (height < 2) return matches;
  sheet.getRange(2, 1, height - 1, 1).getValues().forEach(function(row, index) {
    if (String(row[0]) === String(identity)) matches.push(index + 2);
  });
  return matches;
}
function nativeLoanTransferFindSource_(sheet, identity, numeric) {
  let matches = [];
  if (nativeLoanTransferUnnumbered_(identity)) {
    const height = sheet.getLastRow(), expectedHash = identity.slice('UNNUMBERED:'.length);
    if (height > 1) sheet.getRange(2, 1, height - 1, 33).getValues().forEach(function(values, index) {
      if (nativeLoanTransferBlankId_(values[0]) && nativeLoanTransferFingerprint_(values) === expectedHash) matches.push(index + 2);
    });
  } else matches = nativeLoanTransferFindIds_(sheet, identity);
  if (String(identity) !== String(numeric)) matches = matches.concat(nativeLoanTransferFindIds_(sheet, numeric));
  if (matches.length !== 1) throw new Error('LOAN_TRANSFER_SOURCE_IDENTITY_CONFLICT');
  const row = matches[0], range = sheet.getRange(row, 1, 1, 33), formulas = range.getFormulas()[0];
  if (formulas[0] || formulas[24]) throw new Error('LOAN_TRANSFER_FORMULA_PROTECTED');
  return {row:row, values:range.getValues()[0], note:sheet.getRange(row, 1).getNote()};
}
function nativeLoanTransferReceipt_(note) {
  const prefixes = ['SUTI_LOAN_TRANSFER_V1:', 'SUTI_MANUAL_LOAN_TRANSFER_V1:'];
  const lines = String(note).split('\n').filter(function(line) {
    return prefixes.some(function(prefix) { return line.indexOf(prefix) !== -1; });
  });
  if (!lines.length) return null;
  const prefix = lines.length === 1 ? prefixes.filter(function(value) { return lines[0].indexOf(value) === 0; })[0] : null;
  if (!prefix) throw new Error('LOAN_TRANSFER_RECEIPT_INVALID');
  let receipt;
  try { receipt = JSON.parse(lines[0].slice(prefix.length)); }
  catch (_) { throw new Error('LOAN_TRANSFER_RECEIPT_INVALID'); }
  nativeLoanTransferKeys_(receipt, ['identity','id','sourceHash']);
  if (typeof receipt.identity !== 'string' || (!/^SR-\d{4}-\d{6,}$/.test(receipt.identity) && !/^[1-9]\d{3}$/.test(receipt.identity) &&
      !nativeLoanTransferUnnumbered_(receipt.identity, receipt.sourceHash)) || !Number.isSafeInteger(receipt.id) ||
      receipt.id < 1000 || receipt.id > 9999 || !/^[a-f0-9]{64}$/.test(receipt.sourceHash)) throw new Error('LOAN_TRANSFER_RECEIPT_INVALID');
  if (prefix !== nativeLoanTransferReceiptPrefix_(receipt.identity) &&
      !(prefix === 'SUTI_LOAN_TRANSFER_V1:' && /^[1-9]\d{3}$/.test(receipt.identity))) throw new Error('LOAN_TRANSFER_RECEIPT_INVALID');
  return receipt;
}
function nativeLoanTransferExisting_(target, current) {
  const identity = String(current.values[0]), receipt = nativeLoanTransferReceipt_(current.note);
  if (!/^[1-9]\d{3}$/.test(identity) || !receipt || receipt.id !== Number(identity)) throw new Error('LOAN_TRANSFER_RECEIPT_INVALID');
  const matches = nativeLoanTransferFindIds_(target, identity);
  if (matches.length > 1) throw new Error('LOAN_TRANSFER_DESTINATION_ID_CONFLICT');
  // A historic receipt alone cannot prove an absent loan was never deleted.
  if (!matches.length) throw new Error('LOAN_TRANSFER_DESTINATION_MISSING');
  const actual = target.getRange(matches[0], 1, 1, 17).getValues()[0];
  const actualTerms = actual.slice(1, 9).concat([actual[16]]);
  const expectedTerms = current.values.slice(1, 9).concat([current.values[32]]);
  if (!nativeLoanTransferSameLexical_(actualTerms, expectedTerms)) throw new Error('LOAN_TRANSFER_DESTINATION_CHANGED');
  return {row:matches[0]};
}
function nativeLoanTransferNormalizeDestination_(values) {
  const result = values.slice();
  if (Object.prototype.toString.call(result[9]) === '[object Date]') {
    result[9] = Utilities.formatDate(result[9], 'America/Hermosillo', 'dd/MM/yyyy');
  }
  return result;
}
function nativeLoanTransferSameLexical_(left, right) {
  return left.length === right.length && left.every(function(value, index) { return String(value) === String(right[index]); });
}
function nativeLoanTransferDestinationHash_(target, row) {
  const range = target.getRange(row, 1, 1, 17);
  return nativeLoanTransferHash_([nativeLoanTransferNormalizeDestination_(range.getValues()[0]).map(String), range.getFormulas()[0]]);
}
function nativeLoanTransferProjection_(values, id, date) {
  const row = [id].concat(values.slice(1, 9), [date, '', '', '', '', '', '', values[32]]);
  if (row.some(function(value) { return typeof value === 'string' && value.charAt(0) === '='; })) throw new Error('LOAN_TRANSFER_UNSAFE_CELL');
  return row;
}
function nativeLoanTransferProjectionMatches_(projected, expectedHash) {
  if (nativeLoanTransferHash_(projected) === expectedHash) return true;
  // General-format edits can change 12 to "12" without changing its value.
  // Prove equality to the ORIGINAL reservation hash over only exact lexical
  // number/text alternatives. Leading zeros, rounding and changed amounts fail.
  const indices = [1,2,3,4,5,6,7,8,16].filter(function(i) {
    const value = projected[i];
    return (typeof value === 'number' && Number.isFinite(value)) ||
      (typeof value === 'string' && value !== '' && Number.isFinite(Number(value)) && String(Number(value)) === value);
  });
  const candidate = projected.slice();
  function check(position) {
    if (position === indices.length) return nativeLoanTransferHash_(candidate) === expectedHash;
    const i = indices[position], value = candidate[i];
    if (check(position + 1)) return true;
    candidate[i] = typeof value === 'number' ? String(value) : Number(value);
    const matches = check(position + 1);candidate[i] = value;return matches;
  }
  return check(0);
}

function nativeLoanTransferSnapshot_(context) {
  const maximum = Math.max(nativeLoanTransferMaximum_(context.source), nativeLoanTransferMaximum_(context.target), nativeLoanTransferHighWater_(context.properties));
  const date = Utilities.formatDate(new Date(), 'America/Hermosillo', 'dd/MM/yyyy');
  const pending = context.properties.getProperty(NATIVE_LOAN_TRANSFER_PENDING);
  const candidates = [], internal = [];
  if (!pending) {
    const height = context.source.getLastRow();
    const rows = height > 1 ? context.source.getRange(2, 1, height - 1, 33).getValues() : [];
    for (let index = 0; index < rows.length && candidates.length < 20; index += 1) {
      if (!nativeLoanTransferApproved_(rows[index][24])) continue;
      const identity = nativeLoanTransferBlankId_(rows[index][0]) ?
        'UNNUMBERED:' + nativeLoanTransferFingerprint_(rows[index]) : String(rows[index][0]);
      if (!/^SR-\d{4}-\d{6,}$/.test(identity) && !/^[1-9]\d{3}$/.test(identity) &&
          !nativeLoanTransferUnnumbered_(identity)) throw new Error('LOAN_TRANSFER_IDENTITY_INVALID');
      const current = nativeLoanTransferFindSource_(context.source, identity, identity);
      const sourceHash = nativeLoanTransferFingerprint_(current.values);
      const numeric = /^[1-9]\d{3}$/.test(identity);
      let destinationHash = '', existingLoan = false;
      if (numeric) {
        const receipt = nativeLoanTransferReceipt_(current.note);
        if (receipt) {
          nativeLoanTransferFindSource_(context.source, receipt.identity, Number(identity));
          const existing = nativeLoanTransferExisting_(context.target, current);
          // A previously assigned ID with matching current history is complete
          // for allocation. Do not acknowledge changed administrative contents.
          if (receipt.sourceHash !== sourceHash) continue;
          destinationHash = nativeLoanTransferDestinationHash_(context.target, existing.row);
          existingLoan = true;
        } else {
          // Already numbered manual loans need no allocation. Verify and leave
          // both records untouched; do not invent an SR receipt or adopt history.
          const matches = nativeLoanTransferFindIds_(context.target, identity);
          if (matches.length > 1) throw new Error('LOAN_TRANSFER_DESTINATION_ID_CONFLICT');
          if (matches.length) {
            const actual = context.target.getRange(matches[0], 1, 1, 17).getValues()[0];
            // Contact edits do not invalidate an ID already assigned. We only
            // compare the borrower's identity and loan terms; neither is written.
            if (!nativeLoanTransferSameLexical_(actual.slice(1,9), current.values.slice(1,9))) {
              throw new Error('LOAN_TRANSFER_DESTINATION_CHANGED');
            }
            continue;
          }
          nativeLoanTransferProjection_(current.values, Number(identity), date);
        }
      } else {
        if (nativeLoanTransferReceipt_(current.note)) throw new Error('LOAN_TRANSFER_RECEIPT_CONFLICT');
        nativeLoanTransferProjection_(current.values, 1000, date);
      }
      candidates.push({identity:identity, source_hash:sourceHash, existing_loan:existingLoan, existing_id:numeric ? Number(identity) : null});
      internal.push({note:current.note, destination_hash:destinationHash});
    }
  }
  return {maximum_id:maximum, approval_date:date, candidates:candidates, internal:internal, pending:!!pending,
    snapshot_sha256:nativeLoanTransferHash_([NATIVE_LOAN_TRANSFER_VERSION, maximum, date, candidates, internal, pending ? nativeLoanTransferHash_(pending) : null])};
}
function nativeLoanTransferPublicSnapshot_(snapshot) {
  return {maximum_id:snapshot.maximum_id, approval_date:snapshot.approval_date, candidates:snapshot.candidates,
    pending:snapshot.pending, snapshot_sha256:snapshot.snapshot_sha256};
}
function nativeLoanTransferValidatePlan_(plan, snapshot) {
  nativeLoanTransferKeys_(plan, ['contract_version','snapshot_sha256','maximum_id','approval_date','jobs']);
  if (plan.contract_version !== NATIVE_LOAN_TRANSFER_VERSION || plan.snapshot_sha256 !== snapshot.snapshot_sha256 ||
      plan.maximum_id !== snapshot.maximum_id || plan.approval_date !== snapshot.approval_date) throw new Error('LOAN_TRANSFER_SNAPSHOT_CHANGED');
  if (!Array.isArray(plan.jobs) || plan.jobs.length !== snapshot.candidates.length || plan.jobs.length > 20) throw new Error('LOAN_TRANSFER_PLAN_INVALID');
  let next = Math.max(999, snapshot.maximum_id);
  plan.jobs.forEach(function(job, index) {
    nativeLoanTransferKeys_(job, ['identity','source_hash','id','existing_loan']);
    const candidate = snapshot.candidates[index], expectedId = candidate.existing_id !== null ? candidate.existing_id : ++next;
    if (job.identity !== candidate.identity || job.source_hash !== candidate.source_hash ||
        job.existing_loan !== candidate.existing_loan || job.id !== expectedId || !Number.isSafeInteger(job.id)) throw new Error('LOAN_TRANSFER_PLAN_INVALID');
    if (job.id < 1000 || job.id > 9999) throw new Error('LOAN_TRANSFER_ID_CAPACITY');
  });
}

function nativeLoanTransferSaveJournal_(properties, job) {
  const encoded = JSON.stringify(job);
  if (Utilities.newBlob(encoded).getBytes().length > 8000) throw new Error('LOAN_TRANSFER_METADATA_TOO_LARGE');
  properties.setProperty(NATIVE_LOAN_TRANSFER_PENDING, encoded);
}
function nativeLoanTransferParseJournal_(encoded) {
  let job;
  try { job = JSON.parse(encoded); } catch (_) { throw new Error('LOAN_TRANSFER_JOURNAL_INVALID'); }
  nativeLoanTransferKeys_(job, ['version','identity','id','sourceHash','targetRow','targetHash','date','originalNote','receiptNote','sourceWasNumeric','existingLoan','copied']);
  if (job.version !== NATIVE_LOAN_TRANSFER_VERSION || !Number.isSafeInteger(job.id) || job.id < 1000 || job.id > 9999 ||
      !Number.isSafeInteger(job.targetRow) || job.targetRow < 2 || !/^[a-f0-9]{64}$/.test(job.sourceHash) ||
      !/^[a-f0-9]{64}$/.test(job.targetHash) || !/^\d{2}\/\d{2}\/\d{4}$/.test(job.date) ||
      typeof job.originalNote !== 'string' || typeof job.receiptNote !== 'string' || typeof job.copied !== 'boolean' ||
      typeof job.existingLoan !== 'boolean' || typeof job.sourceWasNumeric !== 'boolean' || (job.existingLoan && !job.sourceWasNumeric) ||
      (job.sourceWasNumeric ? String(job.id) !== job.identity :
        !/^SR-\d{4}-\d{6,}$/.test(job.identity) && !nativeLoanTransferUnnumbered_(job.identity, job.sourceHash))) throw new Error('LOAN_TRANSFER_JOURNAL_INVALID');
  const receipt = nativeLoanTransferReceipt_(job.receiptNote);
  if (!receipt || receipt.id !== job.id || receipt.sourceHash !== job.sourceHash ||
      (!job.existingLoan && receipt.identity !== job.identity) ||
      (job.existingLoan && job.receiptNote !== job.originalNote)) throw new Error('LOAN_TRANSFER_JOURNAL_INVALID');
  const expectedNote = job.existingLoan ? job.originalNote : (job.originalNote ? job.originalNote + '\n' : '') +
    nativeLoanTransferReceiptPrefix_(job.identity) + JSON.stringify({identity:job.identity, id:job.id, sourceHash:job.sourceHash});
  if (job.receiptNote !== expectedNote) throw new Error('LOAN_TRANSFER_JOURNAL_INVALID');
  return job;
}
function nativeLoanTransferRecover_(context, pending) {
  const job = nativeLoanTransferParseJournal_(JSON.stringify(pending));
  const sourceIdentity = job.existingLoan ? nativeLoanTransferReceipt_(job.receiptNote).identity : job.identity;
  let current = nativeLoanTransferFindSource_(context.source, sourceIdentity, job.id);
  nativeLoanTransferCheckCurrent_(current, job);
  let matches = nativeLoanTransferFindIds_(context.target, job.id);
  if (matches.length > 1) throw new Error('LOAN_TRANSFER_DESTINATION_ID_CONFLICT');
  if (!matches.length && (job.existingLoan || job.copied || !nativeLoanTransferApproved_(current.values[24]))) throw new Error('LOAN_TRANSFER_DESTINATION_MISSING');
  if (matches.length && !job.existingLoan &&
      (String(current.values[0]) !== String(job.id) || current.note !== job.receiptNote)) throw new Error('LOAN_TRANSFER_ID_CONFLICT');
  const projected = nativeLoanTransferProjection_(current.values, job.id, job.date);
  if (!job.existingLoan && !nativeLoanTransferProjectionMatches_(projected, job.targetHash)) throw new Error('LOAN_TRANSFER_SOURCE_CHANGED');
  let destinationRow = matches.length ? matches[0] : job.targetRow;
  if (job.existingLoan) {
    nativeLoanTransferExisting_(context.target, current);
    if (nativeLoanTransferDestinationHash_(context.target, destinationRow) !== job.targetHash) throw new Error('LOAN_TRANSFER_DESTINATION_CHANGED');
  } else if (matches.length) {
    nativeLoanTransferVerifyDestination_(context.target, destinationRow, projected);
  }
  // No reservation can be reused, including after an ambiguous property write.
  if (!job.existingLoan && nativeLoanTransferHighWater_(context.properties) < job.id) {
    context.properties.setProperty(NATIVE_LOAN_TRANSFER_HIGH_WATER, String(job.id));
  }
  if (!job.existingLoan && !matches.length) {
    if (destinationRow !== Math.max(2, context.target.getLastRow() + 1)) throw new Error('LOAN_TRANSFER_RESERVED_ROW_CHANGED');
    if (String(current.values[0]) !== String(job.id) || current.note !== job.receiptNote) {
      context.source.getRange(current.row, 1).setNote(job.receiptNote);
      context.source.getRange(current.row, 1).setNumberFormat('0000');
      context.source.getRange(current.row, 1).setValue(job.id);
      SpreadsheetApp.flush();
      current = nativeLoanTransferFindSource_(context.source, sourceIdentity, job.id);
      nativeLoanTransferCheckCurrent_(current, job);
      if (String(current.values[0]) !== String(job.id) || current.note !== job.receiptNote ||
          !nativeLoanTransferApproved_(current.values[24])) throw new Error('LOAN_TRANSFER_READBACK_FAILED');
    }
    if (destinationRow > context.target.getMaxRows()) context.target.insertRowsAfter(context.target.getMaxRows(), destinationRow - context.target.getMaxRows());
    const range = context.target.getRange(destinationRow, 1, 1, 17);
    if (range.getValues()[0].some(function(value) { return value !== '' && value !== null; }) || range.getFormulas()[0].some(Boolean)) throw new Error('LOAN_TRANSFER_RESERVED_ROW_CHANGED');
    [2,4,17].forEach(function(column) { context.target.getRange(destinationRow, column).setNumberFormat('@'); });
    context.target.getRange(destinationRow, 1).setNumberFormat('0000');
    range.setValues([projected]);
    SpreadsheetApp.flush();
    nativeLoanTransferVerifyDestination_(context.target, destinationRow, projected);
  }
  job.copied = true;
  nativeLoanTransferSaveJournal_(context.properties, job);
  current = nativeLoanTransferFindSource_(context.source, sourceIdentity, job.id);
  nativeLoanTransferCheckCurrent_(current, job);
  if (String(current.values[0]) !== String(job.id) || current.note !== job.receiptNote) throw new Error('LOAN_TRANSFER_READBACK_FAILED');
  // Existing numeric loans reach only this business write: never append or rewrite them.
  if (!nativeLoanTransferStarted_(current.values[24])) context.source.getRange(current.row, 25).setValue('Iniciado');
  SpreadsheetApp.flush();
  const verified = nativeLoanTransferFindSource_(context.source, sourceIdentity, job.id);
  nativeLoanTransferCheckCurrent_(verified, job);
  if (String(verified.values[0]) !== String(job.id) || verified.values[24] !== 'Iniciado' || verified.note !== job.receiptNote) throw new Error('LOAN_TRANSFER_READBACK_FAILED');
  // Verify the loan again before acknowledging completion, including existing rows.
  matches = nativeLoanTransferFindIds_(context.target, job.id);
  if (matches.length !== 1) throw new Error('LOAN_TRANSFER_DESTINATION_MISSING');
  if (job.existingLoan) {
    if (nativeLoanTransferDestinationHash_(context.target, matches[0]) !== job.targetHash) throw new Error('LOAN_TRANSFER_DESTINATION_CHANGED');
  } else nativeLoanTransferVerifyDestination_(context.target, matches[0], projected);
  context.properties.deleteProperty(NATIVE_LOAN_TRANSFER_PENDING);
}
function nativeLoanTransferCheckCurrent_(current, job) {
  // A reserved identity survives edits to attachments/administrative metadata.
  // Loan terms must still match the original projection (or verified history).
  const reserved = String(current.values[0]) === String(job.id) && current.note === job.receiptNote;
  const unchangedTerms = job.existingLoan || nativeLoanTransferProjectionMatches_(nativeLoanTransferProjection_(current.values, job.id, job.date), job.targetHash);
  if ((nativeLoanTransferFingerprint_(current.values) !== job.sourceHash && !(reserved && unchangedTerms)) ||
      (!nativeLoanTransferApproved_(current.values[24]) && !nativeLoanTransferStarted_(current.values[24])) ||
      (current.note !== job.originalNote && current.note !== job.receiptNote)) throw new Error('LOAN_TRANSFER_SOURCE_CHANGED');
}
function nativeLoanTransferVerifyDestination_(target, row, expected) {
  const range = target.getRange(row, 1, 1, 17);
  if (range.getFormulas()[0].some(Boolean) || !nativeLoanTransferSameLexical_(nativeLoanTransferNormalizeDestination_(range.getValues()[0]), expected)) {
    throw new Error('LOAN_TRANSFER_DESTINATION_CHANGED');
  }
}
