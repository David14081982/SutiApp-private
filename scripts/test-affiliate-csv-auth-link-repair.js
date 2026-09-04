const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const migration = fs.readFileSync(path.join(root, 'supabase/migrations/20260904000300_affiliate_csv_auth_link_repair.sql'), 'utf8');
const recovery = fs.readFileSync(path.join(root, 'supabase/recovery/20260904000300_affiliate_csv_auth_link_repair_recovery.sql'), 'utf8');
const runner = fs.readFileSync(path.join(root, 'scripts/apply-affiliate-csv-auth-link-repair.py'), 'utf8');
const repository = fs.readFileSync(path.join(root, 'app/affiliate-repository.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'SutiApp.html'), 'utf8');
const serviceWorker = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');

const includes = (text, pattern, message) => assert.match(text, pattern, message);

includes(migration, /3AB97E9F16951E523301E1A080A1DB965F12739207798490022308FCF1F28E29/, 'source hash is not pinned');
includes(migration, /p_source_row_count <> 947/, 'source row count is not pinned');
includes(migration, /lock table public\.affiliates in share row exclusive mode/, 'affiliate writes are not serialized');
includes(migration, /for share of u/, 'linked Auth principals are not locked');
includes(migration, /a\.numero_control is not null[\s\S]*cs_current\.control_count = 1[\s\S]*ds_current\.control_count = 1/, 'current control ambiguity is not rejected');
includes(migration, /es\.email_count = 1[\s\S]*cs_target\.control_count = 1[\s\S]*ds_target\.control_count = 1/, 'target pair uniqueness is not enforced');
includes(migration, /TARGET_OCCUPIED_OUTSIDE_DETERMINISTIC_REPAIR_SET/, 'occupied targets are not fail-closed');
includes(migration, /CONFIRMED_COSAF_REPAIR_NOT_PRESENT/, 'confirmed cosaf repair is not an apply gate');
includes(migration, /set auth_user_id = null[\s\S]*set auth_user_id = r\.auth_user_id/, 'UUID links are not moved in a collision-safe order');
assert.doesNotMatch(migration, /update\s+auth\.users/i, 'Auth users must never be modified');
assert.doesNotMatch(migration, /set\s+historical_email_(?:raw|normalized)/i, 'historical email must remain unchanged');
assert.doesNotMatch(migration, /full_name\s*=/i, 'name must not be used as a join or mutation authority');
includes(migration, /affiliate_csv_auth_link_repair_snapshot/, 'logical snapshot is missing');
includes(migration, /old_auth_user_id[\s\S]*expected_auth_user_id_after[\s\S]*applied_updated_at/, 'snapshot lacks guarded before/after state');
includes(migration, /affiliate_csv_auth_link_repairs/, 'per-repair audit evidence is missing');
includes(migration, /enable row level security[\s\S]*force row level security/, 'repair evidence is not forced-RLS');
includes(migration, /revoke all on table public\.affiliate_csv_auth_link_repairs from public, anon, authenticated/, 'repair evidence is exposed to browser roles');
includes(migration, /grant execute on function public\.apply_affiliate_csv_auth_link_repair[\s\S]*to service_role/, 'apply RPC is not service-only');
includes(migration, /has_certified_affiliate_auth_link\(u\.id, a\.id, u\.email\)/, 'resolver does not bind certified evidence to UUID, target and Auth email');
includes(migration, /a\.numero_control = r\.to_numero_control/, 'certified evidence is not bound to the target control');
includes(migration, /email_confirmed_at is not null/, 'confirmed Auth email remains required');
includes(migration, /deterministic_cross_links_after[\s\S]*v_cross_after <> 0/, 'zero deterministic crossings is not enforced');
includes(migration, /COSAF_POST_APPLY_VALIDATION_FAILED/, 'cosaf postcondition is missing');

includes(recovery, /RECOVERY_BLOCKED_REPAIR_HISTORY_EXISTS/, 'schema recovery may delete repair audit history');
includes(migration, /RECOVERY_BLOCKED_AFFECTED_ROW_CHANGED/, 'data recovery does not guard concurrent/later changes');
includes(migration, /set auth_user_id = s\.old_auth_user_id/, 'data recovery cannot restore original Auth links');
includes(recovery, /drop table public\.affiliate_csv_auth_link_repairs/, 'empty schema recovery is incomplete');
includes(recovery, /a\.historical_email_normalized = lower\(btrim\(u\.email\)\)/, 'schema recovery does not restore the prior resolver');

includes(runner, /SOURCE_HASH_MISMATCH/, 'runner does not verify the source hash');
includes(runner, /CURRENT_CONTROL_EMPTY/, 'runner does not skip empty current controls');
includes(runner, /CURRENT_CONTROL_DUPLICATE_CSV/, 'runner does not skip duplicate current controls');
includes(runner, /LIVE_PREFLIGHT_CHANGED/, 'runner does not retry a raced preflight safely');
includes(runner, /recover_affiliate_csv_auth_link_repair/, 'automatic rollback path is missing');
includes(runner, /verify_resolvers/, 'all Auth resolvers are not checked');
includes(runner, /recovery_dry_run/, 'recovery dry-run is missing');
includes(runner, /APPLY-H-AFFILIATES-CSV-AUTH-LINK-REPAIR-001/, 'explicit apply confirmation is missing');

includes(repository, /result\.data\.auth_user_id !== principal\.id/, 'frontend does not bind the returned affiliate to the authenticated UUID');
assert.doesNotMatch(repository, /historical_email_normalized !== principalEmail/, 'frontend must not reject a backend-certified repair using stale historical email');
includes(html, /affiliate-repository\.js\?v=5/, 'HTML does not publish the repaired repository cachebuster');
includes(serviceWorker, /const CACHE = 'sutiapp-v151'/, 'service worker cache was not advanced');
includes(serviceWorker, /affiliate-repository\.js\?v=5/, 'service worker does not precache the repaired repository version');

console.log('affiliate csv auth link repair static PASS');
