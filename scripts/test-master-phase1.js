/* Static contract for MASTER Phase 1. */
'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert');
const root=path.resolve(__dirname,'..');
const read=(p)=>fs.readFileSync(path.join(root,p),'utf8');
const migration=read('supabase/migrations/20260821000700_complete_identity_access.sql');
const auth=read('app/affiliate-auth.js'),repo=read('app/affiliate-repository.js'),admin=read('app/admin-repository.js'),screen=read('app/screens-admin-identity.jsx'),app=read('app/app.jsx');
[
 'claim_affiliate_identity','email_confirmed_at','auth_eligibility = \'eligible\'','historical_email_normalized',
 'affiliates.impersonate','char_length(btrim(reason)) between 8 and 500','interval \'30 minutes\'',
 'actor_real_auth_user_id','usuario_contexto_affiliate_id','IMPERSONATION_ALREADY_ACTIVE',
 'enable row level security','force row level security','get_effective_affiliate_id'
].forEach(x=>assert(migration.includes(x),`missing migration contract: ${x}`));
assert(!migration.includes('SUPABASE_SECRET_KEY')&&!migration.includes('service_role'));
assert(!migration.includes("numero_control = '11111111'"));
assert(auth.includes('signInWithOtp')&&auth.includes('get_affiliate_activation_status')&&auth.includes('completeActivation')&&auth.includes('resetPasswordForEmail')&&auth.includes('PASSWORD_RECOVERY')&&auth.includes('updateUser'));
assert(repo.includes("rpc('get_effective_affiliate_id')")&&repo.includes("rpc('get_impersonation_context')"));
assert(admin.includes('startImpersonation')&&admin.includes('stopImpersonation'));
assert(screen.includes('Motivo operativo obligatorio')&&app.includes('data-impersonation-active'));
assert(!screen.includes('localStorage')&&!repo.includes('window.DATA'));
require('./verification-helpers').assertPwaVersionSync(root);
console.log(JSON.stringify({status:'PASS',onboarding:true,recovery:true,impersonation:true,actor_context:true,rls:true,ui_contract:true}));
