'use strict';
// Explicit owner-authorized installation only. Never revokes a real account.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert/strict');
const {query}=require('./savings-admin-review-db');
const root=path.resolve(__dirname,'..'),version='20260924000100',name='admin_assignment_voting_permissions';
const out=path.join(root,'docs/qa/evidence/admin-revocation-20260924'),privateDir=path.join(root,'tmp/admin-revocation');
const source=fs.readFileSync(path.join(root,`supabase/migrations/${version}_${name}.sql`),'utf8');
const recovery=fs.readFileSync(path.join(root,`supabase/recovery/${version}_${name}_recovery.sql`),'utf8');
const tested=JSON.parse(fs.readFileSync(path.join(out,'isolated.json'),'utf8'));
const baseline=JSON.parse(fs.readFileSync(path.join(root,'scripts/fixtures/admin-revocation-20260924.json'),'utf8'));
const sha=s=>crypto.createHash('sha256').update(s).digest('hex'),quote=s=>"'"+s.replaceAll("'","''")+"'";
const state=`public.admin_assignment_voting_permissions_state_${version}`;
assert.equal(tested.status,'PASS');assert.equal(sha(source),tested.migrationSha256,'UNTESTED_MIGRATION');assert.equal(sha(recovery),tested.recoverySha256,'UNTESTED_RECOVERY');
const signatures=baseline.functions.map(f=>quote(f.signature)).join(',');
const functionQuery=`select p.oid::regprocedure::text signature,p.oid::text oid,p.proowner::regrole::text owner,p.proacl::text acl,pg_get_functiondef(p.oid) definition,md5(pg_get_functiondef(p.oid)) hash from pg_proc p where p.oid in (select s::regprocedure from unnest(array[${signatures}]) s) order by signature`;
const tables=['public.admin_assignments','public.admin_section_responsibilities','public.admin_roles','public.admin_role_permissions','public.admin_audit_log','public.identity_audit_log','public.impersonation_sessions','auth.users','public.affiliates','public.affiliate_documents','public.request_documents'];
const snapshot='jsonb_build_object('+tables.map(t=>`${quote(t)},(select jsonb_build_object('count',count(*),'hash',md5(coalesce(string_agg(to_jsonb(t)::text,'' order by to_jsonb(t)::text),''))) from ${t} t)`).join(',')+')';
const constraintQuery="select pg_get_constraintdef(oid) definition,md5(pg_get_constraintdef(oid)) hash from pg_constraint where conrelid='public.admin_assignments'::regclass and conname='admin_assignments_permissions_check'";
const ro=sql=>query('begin read only; set local statement_timeout=\'30s\'; '+sql+'; commit;');
function save(file,value){fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,file),JSON.stringify(value,null,2));}
async function expected(){
 const {PGlite}=require(path.join(root,'.tmp/savings-loan-eligibility/node_modules/@electric-sql/pglite'));
 const db=new PGlite();try{
  const rpc=source.match(/create or replace function public\.revoke_admin_assignment[\s\S]+?end \$function\$;/i)?.[0];assert(rpc);
  const check=baseline.constraint[0].definition.replace("'savings.read'::text","'votaciones.read'::text, 'votaciones.create'::text, 'votaciones.update'::text, 'votaciones.delete'::text, 'votaciones.publish'::text, 'votaciones.results'::text, 'votaciones.export_identified_votes'::text, 'savings.read'::text");
  await db.exec('set check_function_bodies=off;'+rpc+'create table public.admin_assignments(permissions text[]);alter table public.admin_assignments add constraint admin_assignments_permissions_check '+check);
  return {rpc:(await db.query("select md5(pg_get_functiondef('public.revoke_admin_assignment(uuid)'::regprocedure)) hash")).rows[0].hash,constraint:(await db.query(constraintQuery)).rows[0].hash};
 }finally{await db.close();}
}
async function preflight(){
 const installed=await ro(`select version from supabase_migrations.schema_migrations where version='${version}'`);assert.equal(installed.length,0,'VERSION_ALREADY_REGISTERED');
 const exists=await ro(`select to_regclass('${state}')::text state`);assert.equal(exists[0].state,null,'STATE_ALREADY_EXISTS');
 const c=await ro(constraintQuery);assert.equal(c[0]?.hash,baseline.constraint[0].hash,'CONSTRAINT_DRIFT');
 const functions=await ro(functionQuery);assert.equal(functions.length,baseline.functions.length);
 for(const b of baseline.functions){const actual=functions.find(f=>f.signature===b.signature);assert(actual,'MISSING '+b.signature);assert.equal(actual.hash,b.hash,'FUNCTION_DRIFT '+b.signature);assert.equal(actual.acl,b.acl,'ACL_DRIFT '+b.signature);}
 const before=await ro(`select ${snapshot} fingerprints`);
 fs.mkdirSync(privateDir,{recursive:true});fs.writeFileSync(path.join(privateDir,'apply-before-functions.json'),JSON.stringify(functions,null,2));
 const result={status:'PASS',at:new Date().toISOString(),migrationSha256:sha(source),recoverySha256:sha(recovery),functions: functions.map(({definition,...f})=>f),constraint:c[0],fingerprints:before[0].fingerprints,productionWrites:0};
 save('application-preflight.json',result);return result;
}
async function verify(){
 const exp=await expected(),previous=JSON.parse(fs.readFileSync(path.join(out,'application-preflight.json'),'utf8'));
 const functions=await ro(functionQuery),c=await ro(constraintQuery);assert.equal(c[0].hash,exp.constraint,'INSTALLED_CHECK_MISMATCH');
 for(const before of previous.functions){const after=functions.find(f=>f.signature===before.signature);assert(after);assert.equal(after.hash,before.signature==='revoke_admin_assignment(uuid)'?exp.rpc:before.hash,'INSTALLED_FUNCTION_MISMATCH '+before.signature);for(const field of ['oid','owner','acl'])assert.equal(after[field],before[field],'FUNCTION_SECURITY_CHANGED '+before.signature);}
 const tracking=await ro(`select version,name,statements from supabase_migrations.schema_migrations where version='${version}'`);assert.equal(tracking.length,1);assert.equal(tracking[0].name,name);assert.deepEqual(tracking[0].statements,[source]);
 const security=await ro(`select relrowsecurity rls,relforcerowsecurity force_rls from pg_class where oid='${state}'::regclass`);assert(security[0].rls&&security[0].force_rls);
 const denied=await ro(`select r,has_table_privilege(r,'${state}','SELECT') can_read,has_table_privilege(r,'${state}','INSERT,UPDATE,DELETE') can_write from unnest(array['anon','authenticated','service_role']) r`);assert(denied.every(r=>!r.can_read&&!r.can_write));
 const recoveryState=await ro(`select count(*)::int count,min(applied_constraint_hash) constraint_hash,min(applied_revoke_hash) rpc_hash from ${state}`);assert.equal(recoveryState[0].count,1);assert.equal(recoveryState[0].constraint_hash,exp.constraint);assert.equal(recoveryState[0].rpc_hash,exp.rpc);
 const mismatch=await ro("select count(*)::int missing from admin_role_permissions rp where not exists(select 1 from pg_constraint c where c.conrelid='admin_assignments'::regclass and c.conname='admin_assignments_permissions_check' and position(''''||rp.permission||'''::text' in pg_get_constraintdef(c.oid))>0)");assert.equal(mismatch[0].missing,0);
 const result={status:'PASS',at:new Date().toISOString(),version,migrationSha256:sha(source),expected:exp,functionsCompared:functions.length,functionOidOwnerAclPreserved:true,otherFunctionDefinitionsPreserved:true,trackingExact:true,recoveryState,security,denied,rolePermissionsOutsideCheck:0,realAccountRevocations:0};
 save('application-verified.json',result);console.log(JSON.stringify(result));
}
async function main(){
 const mode=process.argv[2];assert(['preflight','apply','verify'].includes(mode),'MODE_REQUIRED');
 if(mode==='verify')return verify();
 const before=await preflight();console.log(JSON.stringify({stage:'preflight',status:'PASS',functions:before.functions.length,migrationSha256:sha(source)}));if(mode==='preflight')return;
 const exp=await expected(),body=source.trim().slice(6,-7);
 const sql=`begin isolation level repeatable read;
 set local lock_timeout='2s';set local statement_timeout='60s';
 do $version$ begin if exists(select 1 from supabase_migrations.schema_migrations where version='${version}') then raise exception 'MIGRATION_VERSION_COLLISION'; end if; end $version$;
 create temporary table revocation_install_before on commit drop as select ${snapshot} fingerprints;
 ${body}
 create temporary table revocation_install_after on commit drop as select ${snapshot} fingerprints;
 do $assert$ begin
 if (select fingerprints from revocation_install_before) is distinct from (select fingerprints from revocation_install_after) then raise exception 'INSTALL_CHANGED_BUSINESS_DATA'; end if;
 if (select md5(pg_get_constraintdef(oid)) from pg_constraint where conrelid='public.admin_assignments'::regclass and conname='admin_assignments_permissions_check')<>${quote(exp.constraint)} then raise exception 'INSTALLED_CHECK_MISMATCH'; end if;
 if md5(pg_get_functiondef('public.revoke_admin_assignment(uuid)'::regprocedure))<>${quote(exp.rpc)} then raise exception 'INSTALLED_RPC_MISMATCH'; end if;
 end $assert$;
 insert into supabase_migrations.schema_migrations(version,name,statements) values('${version}','${name}',array[${quote(source)}]);
 select 'PASS' status,(select fingerprints from revocation_install_before) before,(select fingerprints from revocation_install_after) after;
 commit;`;
 fs.writeFileSync(path.join(privateDir,'authorized-apply.sql'),sql);
 // If transport fails after commit, use verify; never automatically reapply.
 const receipt=await query(sql);assert.equal(receipt[0]?.status,'PASS');assert.deepEqual(receipt[0].before,receipt[0].after);
 save('application-applied.json',{status:'PASS',at:new Date().toISOString(),version,migrationSha256:sha(source),businessRowsChanged:0,realAccountRevocations:0,transaction:'REPEATABLE READ, exact tested migration + tracking',receipt});
 console.log(JSON.stringify({stage:'applied',status:'PASS',version,businessRowsChanged:0}));await verify();
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
