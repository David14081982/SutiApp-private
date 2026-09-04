'use strict';

const assert = require('assert').strict;
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const migration = fs.readFileSync(path.join(root, 'supabase/migrations/20260904000200_affiliate_csv_email_update_batch.sql'), 'utf8');
const recovery = fs.readFileSync(path.join(root, 'supabase/recovery/20260904000200_affiliate_csv_email_update_batch_recovery.sql'), 'utf8');
const apply = fs.readFileSync(path.join(root, 'scripts/apply-affiliate-csv-email-update.py'), 'utf8');

function includes(source, pattern, message) {
  assert.match(source, pattern, message);
}

includes(migration, /source_sha256\s*<>\s*'3AB97E9F16951E523301E1A080A1DB965F12739207798490022308FCF1F28E29'/, 'source hash is not pinned');
includes(migration, /jsonb_array_length\(p_rows\)\s*<>\s*947/, '947-row input is not enforced');
includes(migration, /key not in \('ordinal', 'numero_control', 'email_raw'\)/, 'payload allowlist is missing');
includes(migration, /lock table public\.affiliates in share row exclusive mode/, 'affiliate universe is not locked');
includes(migration, /create table public\.affiliate_csv_email_update_snapshot/, 'logical snapshot is missing');
includes(migration, /old_email_raw[\s\S]*old_auth_user_id[\s\S]*proposed_email_raw/, 'before/proposed snapshot is incomplete');
includes(migration, /when a\.auth_user_id is not null then 'NEEDS_AUTH_SYNC'/, 'linked identities are not skipped');
includes(migration, /PROPOSED_EMAIL_OWNED_BY_OTHER_AFFILIATE/, 'foreign email collision is not blocked');
includes(migration, /v_updated <> 1[\s\S]*v_needs_auth <> 8[\s\S]*v_ambiguous_control <> 33[\s\S]*v_ambiguous_email <> 112/, 'pinned classification is missing');
includes(migration, /set historical_email_raw = s\.proposed_email_raw,[\s\S]*historical_email_normalized = s\.proposed_email_normalized/, 'raw/normalized update is missing');
assert.doesNotMatch(migration, /set\s+auth_user_id\s*=/i, 'migration may mutate auth_user_id');
assert.doesNotMatch(migration, /full_name|display_name/i, 'migration may use names');
includes(migration, /v_identity_after is distinct from v_identity_before/, 'identity mapping invariant is missing');
includes(migration, /AUTH_IDENTITY_MISMATCH_CREATED/, 'identity mismatch rollback gate is missing');
includes(migration, /force row level security/g, 'audit tables must force RLS');
includes(migration, /grant execute on function public\.apply_affiliate_csv_email_update[\s\S]*to service_role/, 'apply RPC is not service-only');

includes(recovery, /RECOVER_APPLIED_BATCH_FIRST_WITH_public\.recover_affiliate_csv_email_update/, 'schema recovery can bypass data recovery');
includes(recovery, /drop table public\.affiliate_csv_email_update_snapshot/, 'schema recovery is incomplete');
includes(migration, /CSV_UPDATE_RECOVERY_BLOCKED_BY_LATER_EMAIL_OR_IDENTITY_CHANGE/, 'data recovery does not protect later changes');
includes(migration, /set historical_email_raw = s\.old_email_raw,[\s\S]*historical_email_normalized = s\.old_email_normalized/, 'data recovery cannot restore snapshot');

includes(apply, /reader\.fieldnames != \["N\\u00famero de control", "NOMBRE", "Email"\]/, 'exact CSV contract is missing');
assert.doesNotMatch(apply, /row\["NOMBRE"\]/, 'name is used for matching');
includes(apply, /control = control\.rsplit\("\.", 1\)\[0\]/, 'exported .0 control handling is missing');
includes(apply, /str\(value\)\.strip\(\)\.lower\(\)/, 'allowed email normalization is not exact');
includes(apply, /verify_identity_resolver\(values\)/, 'effective affiliate resolver is not verified');
includes(apply, /recover_affiliate_csv_email_update/, 'automatic recovery path is missing');

console.log(JSON.stringify({
  status: 'PASS',
  scope: 'H-AFFILIATES-CSV-UPDATE-APPLY-001',
  controls: {
    sourcePinned: true,
    numeroControlOnly: true,
    snapshotBeforeWrite: true,
    linkedAuthSkipped: true,
    ambiguousSkipped: true,
    authUserIdImmutable: true,
    recoveryGuarded: true,
    rlsServiceBoundary: true,
  },
}));
