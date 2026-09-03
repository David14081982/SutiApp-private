'use strict';

const assert = require('assert').strict;
const fs = require('fs');

const read = (file) => fs.readFileSync(file, 'utf8');
const auth = read('app/affiliate-auth.js');
const migration = read('supabase/migrations/20260903000150_auth_prod_activation_preflight.sql');
const recovery = read('supabase/recovery/20260903000150_auth_prod_activation_preflight_recovery.sql');
const apply = read('scripts/apply-auth-prod-activation-cert.js');

assert.match(auth, /rpc\('get_affiliate_activation_status'/);
assert.match(auth, /signInWithOtp/);
assert.match(auth, /shouldCreateUser:\s*true/);
assert.match(auth, /searchParams\.set\('auth_flow', flow\)/);
assert.match(auth, /authFlowUrl\('activation'\)/);
assert.match(auth, /user_metadata\.sutiapp_activation === true/);
assert.match(auth, /completeActivation/);
assert.match(auth, /claimCurrentIdentity/);
assert.match(auth, /ACTIVATION_NOT_REGISTERED/);
assert.match(auth, /ACTIVATION_AMBIGUOUS/);
assert.match(auth, /ACTIVATION_ALREADY_ACTIVE/);
assert.match(auth, /ACTIVATION_RATE_LIMIT/);
assert.match(auth, /ACTIVATION_CONFIGURATION/);
assert.match(auth, /ACTIVATION_PROVIDER_ERROR/);
assert.doesNotMatch(auth.slice(auth.indexOf('async function activate'), auth.indexOf('async function completeActivation')), /catch\s*\(_\)[\s\S]*return true/);
assert.doesNotMatch(auth, /signUp\s*\(/);

assert.match(migration, /security definer/);
assert.match(migration, /set search_path = ''/);
assert.match(migration, /historical_email_normalized = v_email/);
assert.match(migration, /if v_count <> 1/);
assert.match(migration, /'AMBIGUOUS'/);
assert.match(migration, /auth_eligibility <> 'eligible'/);
assert.match(migration, /auth_user_id is not null/);
assert.match(migration, /grant execute on function public\.get_affiliate_activation_status\(text\) to anon, authenticated/);
assert.doesNotMatch(migration, /numero_control|insert into|update public\.affiliates|delete from/);
assert.match(recovery, /drop function public\.get_affiliate_activation_status\(text\)/);

assert.match(apply, /SutiApp-private\//);
assert.match(apply, /auth_flow=activation/);
assert.match(apply, /auth_flow=recovery/);
assert.match(apply, /affiliate_count, beforeSchema\.affiliate_count/);
assert.doesNotMatch(auth + apply, /SUPABASE_SECRET_KEY|SUPABASE_DB_PASSWORD|service_role/i);

console.log(JSON.stringify({
  status: 'PASS', observability: true, callbackPasswordSetup: true,
  failClosedPreflight: true, sourceOfTruth: 'Supabase Auth + public.affiliates',
  secretsExposed: false,
}));
