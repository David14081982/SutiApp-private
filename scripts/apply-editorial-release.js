'use strict';
// Owner-authorized release only. No user/business writer is called.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert/strict');
const {query}=require('./savings-admin-review-db');
const root=path.resolve(__dirname,'..'),dir=path.join(root,'docs/qa/evidence/screen-permission-fix-20260924');
const read=p=>fs.readFileSync(path.join(root,p),'utf8'),quote=s=>"'"+s.replaceAll("'","''")+"'";
const manifest=JSON.parse(fs.readFileSync(path.join(dir,'release.json'),'utf8'));
const baseline=JSON.parse(fs.readFileSync(path.join(dir,'production-metadata.json'),'utf8'));
const migrations=[['20260924000200','admin_screen_permission_boundaries'],['20260924000300','app_editorial_panels']].map(([version,name])=>({version,name,source:read(`supabase/migrations/${version}_${name}.sql`)}));
for(const [p,h] of Object.entries(manifest.sql))assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(root,p))).digest('hex'),h,'UNTESTED_SQL '+p);
for(const file of ['isolated','editorial-isolated','editorial-browser','editorial-session','global-local-final'])assert.equal(JSON.parse(fs.readFileSync(path.join(dir,file+'.json'),'utf8')).status,'PASS',file);
const tables=['public.admin_assignments','public.admin_section_responsibilities','public.admin_roles','public.admin_role_permissions','public.admin_audit_log','public.companies','public.company_assets','public.company_benefit_profiles','public.company_benefits','public.company_audience_rules','public.marketplace_company_memberships','public.company_portal_subscriptions','public.company_portal_plans','auth.users','public.affiliates','public.affiliate_documents','public.request_documents'];
const fingerprints=`jsonb_build_object(${tables.map(t=>`${quote(t)},(select jsonb_build_object('count',count(*),'hash',md5(coalesce(jsonb_agg(to_jsonb(x) order by to_jsonb(x)::text)::text,'[]'))) from ${t} x)`).join(',')})`;
const functionSql=`select p.oid::regprocedure::text signature,pg_get_functiondef(p.oid) definition,md5(pg_get_functiondef(p.oid)) hash,p.proacl::text acl,p.proowner::regrole::text owner from pg_proc p join pg_namespace n on n.oid=p.pronamespace where p.oid in(select s::regprocedure from unnest(array[${baseline.functions.map(f=>quote(f.signature)).join(',')}]) s) or (n.nspname='public' and (p.proname like '%editorial%' or p.proname='enforce_admin_company_module_scope')) order by signature`;
const ro=sql=>query("begin read only;set local statement_timeout='30s';"+sql+';commit;');
const save=(name,data)=>fs.writeFileSync(path.join(dir,name+'.json'),JSON.stringify(data,null,2)+'\n');
const body=s=>s.replace(/^([\s\S]*?)\bbegin;/i,'$1').replace(/commit;\s*$/i,'');
async function expected(){const {createDb}=require('./admin-permission-test-db');const x=await createDb();try{for(const m of migrations)await x.db.exec(m.source);return (await x.db.query(functionSql)).rows.map(({definition,...f})=>f);}finally{await x.db.close();}}
async function preflight(){
 const installed=await ro("select version from supabase_migrations.schema_migrations where version in('20260924000200','20260924000300')");assert.equal(installed.length,0,'ALREADY_INSTALLED_USE_VERIFY');
 const actual=await ro(functionSql);for(const b of baseline.functions){const a=actual.find(f=>f.signature===b.signature);assert(a);assert.equal(a.hash,b.hash,'FUNCTION_DRIFT '+b.signature);assert.equal(a.acl,b.acl,'ACL_DRIFT '+b.signature);}
 const snapshot=await ro(`select ${fingerprints} fingerprints`);
 const result={status:'PASS',at:new Date().toISOString(),productionWrites:0,functions:actual.map(({definition,...f})=>f),fingerprints:snapshot[0].fingerprints};save('release-preflight',result);return result;
}
async function verify(){
 const exp=await expected(),actual=await ro(functionSql);for(const e of exp){const a=actual.find(f=>f.signature===e.signature);assert(a,e.signature);assert.equal(a.hash,e.hash,'INSTALLED_DEFINITION_MISMATCH '+e.signature);}
 const prior=JSON.parse(fs.readFileSync(path.join(dir,'release-preflight.json'),'utf8'));
 for(const b of prior.functions){const a=actual.find(f=>f.signature===b.signature);assert.equal(a.owner,b.owner);assert.equal(a.acl,b.acl,'ACL_CHANGED '+b.signature);}
 const tracking=await ro("select version,name,statements from supabase_migrations.schema_migrations where version in('20260924000200','20260924000300') order by version");
 for(const m of migrations){const t=tracking.find(t=>t.version===m.version);assert(t);assert.equal(t.name,m.name);assert.deepEqual(t.statements,[m.source]);}
 const security=await ro("select relname,relrowsecurity rls,relforcerowsecurity force_rls,has_table_privilege('anon',oid,'INSERT,UPDATE,DELETE') anon_write,has_table_privilege('authenticated',oid,'INSERT,UPDATE,DELETE') browser_write from pg_class where oid in('public.app_editorial_screens'::regclass,'public.app_editorial_revisions'::regclass,'public.app_editorial_submissions'::regclass,'public.app_editorial_installation_20260924000300'::regclass,'public.admin_permission_fix_recovery_20260924000200'::regclass)");
 assert.equal(security.length,5);assert(security.every(s=>s.rls&&s.force_rls&&!s.anon_write&&!s.browser_write));
 const current=await ro(`select ${fingerprints} fingerprints,(select count(*) from public.admin_assignments where enabled) enabled_assignments,(select count(*) from public.app_editorial_screens) editorial_screens,(select count(*) from public.app_editorial_submissions) submissions`);
 assert.equal(Number(current[0].editorial_screens),20);
 const result={status:'PASS',at:new Date().toISOString(),functionsCompared:exp.length,previousFunctionOwnerAclPreserved:true,trackingExact:true,security,current,realAccountRevocations:0};save('release-backend-verified',result);console.log(JSON.stringify({stage:'verified',status:'PASS',functions:exp.length,enabledAssignments:current[0].enabled_assignments,editorialScreens:current[0].editorial_screens}));
}
async function main(){const mode=process.argv[2];assert(['prepare','preflight','apply','verify'].includes(mode),'MODE_REQUIRED');if(mode==='prepare'){const e=await expected();console.log(JSON.stringify({status:'PASS',isolatedDefinitions:e.length}));return;}if(mode==='verify')return verify();await preflight();console.log('PASS production preflight');if(mode==='preflight')return;
 const sql=`begin isolation level repeatable read;set local lock_timeout='2s';set local statement_timeout='60s';
 do $v$ begin if exists(select 1 from supabase_migrations.schema_migrations where version in('20260924000200','20260924000300')) then raise exception 'VERSION_COLLISION';end if;end $v$;
 create temporary table editorial_release_before on commit drop as select ${fingerprints} fingerprints;
 ${migrations.map(m=>body(m.source)).join('\n')}
 do $check$ begin if (select fingerprints from editorial_release_before) is distinct from ${fingerprints} then raise exception 'EXISTING_DATA_CHANGED';end if;end $check$;
 ${migrations.map(m=>`insert into supabase_migrations.schema_migrations(version,name,statements) values(${quote(m.version)},${quote(m.name)},array[${quote(m.source)}]);`).join('\n')}
 notify pgrst,'reload schema';
 select 'PASS' status,(select fingerprints from editorial_release_before) before,${fingerprints} after;commit;`;
 // Transport uncertainty: verify first; never retry the mutation automatically.
 const receipt=await query(sql);assert.equal(receipt[0]?.status,'PASS');assert.deepEqual(receipt[0].before,receipt[0].after);
 save('release-applied',{status:'PASS',at:new Date().toISOString(),versions:migrations.map(m=>m.version),sqlHashes:manifest.sql,businessRowsChanged:0,transaction:'REPEATABLE READ; both tested migrations and tracking atomic',receipt});console.log('PASS both migrations applied; existing rows unchanged');await verify();
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
