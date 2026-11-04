'use strict';
// Owner-authorized focal release. No business-document deletion or test fixtures.
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),crypto=require('crypto');
const {query,environment}=require('./investors-db');
const root=path.resolve(__dirname,'..'),dir=path.join(root,'.tmp/affiliate-document-retirement'),out=path.join(root,'docs/qa/evidence/affiliate-document-retirement');
const mode=process.argv[2],version='20261104000400',name='affiliate_document_retirement',slug='affiliate-document-delete';
const read=f=>fs.readFileSync(path.join(root,f),'utf8'),sha=s=>crypto.createHash('sha256').update(s).digest('hex');
function proof(file,data){fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,file+'.json'),JSON.stringify(data,null,2)+'\n');console.log(JSON.stringify(data));}
const protectedTables=['affiliates','affiliate_documents','affiliate_files','private_assets','document_types','request_documents','savings_requests','program_catalog_item_assets','program_terms_versions','historical_asset_sources','financial_programs','sensitive_change_audit','admin_assignments','admin_roles','admin_role_permissions','admin_section_responsibilities'];
const fingerprintSQL=()=>protectedTables.map(t=>`select '${t}'::text name,count(*)::bigint rows,md5(coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text)::text,'[]')) fingerprint from public.${t} t`).join(' union all ');
async function main(){
 const env=environment();
 if(mode==='apply'){
  for(const f of ['database-edge.json','browser.json'])assert.equal(JSON.parse(read('docs/qa/evidence/affiliate-document-retirement/'+f)).status,'PASS',f);
  assert.equal((await query(`select count(*)::int n from supabase_migrations.schema_migrations where version='${version}'`))[0].n,0,'MIGRATION_ALREADY_INSTALLED');
  const migration=read('supabase/migrations/'+version+'_'+name+'.sql');
  const body=migration.replace(/^begin;\s*/,'').replace(/commit;\s*$/,'');
  const sql=`begin isolation level repeatable read;set local lock_timeout='3s';set local statement_timeout='90s';
create temporary table retirement_before on commit drop as ${fingerprintSQL()};
create temporary table retirement_security_before on commit drop as select p.oid,p.proowner,p.proacl,p.prosecdef,p.proconfig,pg_get_functiondef(p.oid) definition from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in('public','admin_support_private') and p.proname in('has_admin_permission','has_admin_module','module_visible','admin_module_boundary');
${body}
create temporary table retirement_after on commit drop as ${fingerprintSQL()};
do $preserve$ begin
 if exists(select * from retirement_before except select * from retirement_after) then raise exception 'DOCUMENT_RETIREMENT_BUSINESS_ROWS_CHANGED';end if;
 if exists(select 1 from retirement_security_before b join pg_proc p on p.oid=b.oid where b.proowner<>p.proowner or b.proacl is distinct from p.proacl or b.definition<>pg_get_functiondef(p.oid)) then raise exception 'GLOBAL_PERMISSIONS_CHANGED';end if;
end $preserve$;
insert into supabase_migrations.schema_migrations(version,name,statements) values('${version}','${name}',array[$migration$${migration}$migration$]);
select name,rows,'PASS'::text preserved from retirement_before;commit;`;
  fs.writeFileSync(path.join(dir,'apply.sql'),sql);
  const result=await query(sql,true);proof('backend-applied',{status:'PASS',migration:version,sha256:sha(migration),preserved:result,businessWrites:0,globalPermissionsChanged:0});return;
 }
 if(['compile','deploy','edge-verify'].includes(mode)){
  const base='https://api.supabase.com/v1/projects/'+new URL(env.SUPABASE_URL).hostname.split('.')[0]+'/functions/',headers={Authorization:'Bearer '+env.SUPABASE_ACCESS_TOKEN};
  if(mode==='edge-verify'){
   const r=await fetch(base+slug+'/body',{headers});assert(r.ok,'EDGE_READBACK_'+r.status);const bytes=Buffer.from(await r.arrayBuffer());for(const marker of ['prepare_admin_affiliate_document_delete','PENDING_STORAGE','affiliate_document_delete_storage','ORIGIN_DENIED'])assert(bytes.includes(Buffer.from(marker)),marker);
   proof('edge-verified',{status:'PASS',slug,artifactSha256:sha(bytes),bytes:bytes.length,requiredMarkers:4});return;
  }
  if(mode==='deploy')assert.equal(JSON.parse(read('docs/qa/evidence/affiliate-document-retirement/backend-applied.json')).status,'PASS');
  const form=new FormData();form.append('metadata',JSON.stringify({name:slug,slug,entrypoint_path:'index.ts',verify_jwt:true}));
  const files=['index.ts','handler.mjs'];for(const f of files)form.append('file',new Blob([read('supabase/functions/'+slug+'/'+f)],{type:'application/typescript'}),f);
  const r=await fetch(base+'deploy?slug='+slug+(mode==='compile'?'&bundleOnly=true':''),{method:'POST',headers,body:form});
  if(!r.ok){fs.writeFileSync(path.join(dir,'edge-private-error.txt'),await r.text());throw Error('EDGE_'+mode+'_'+r.status);}
  const body=await r.json();proof('edge-'+mode,{status:'PASS',slug,version:body.version||null,verifyJwt:true,sourceHashes:Object.fromEntries(files.map(f=>[f,sha(read('supabase/functions/'+slug+'/'+f))]))});return;
 }
 if(mode==='verify'){
  const result=await query(`select jsonb_build_object('migration_installed',exists(select 1 from supabase_migrations.schema_migrations where version='${version}'),'retirements',(select count(*) from document_retirement_private.operations),'policies',(select count(*) from pg_policies where policyname='document_retirement_filter'),'reference_guards',(select count(*) from pg_trigger where tgname='retirement_reference_guard'),'functions_match',not exists(select 1 from document_retirement_private.function_backup where md5(pg_get_functiondef(signature::regprocedure))<>applied_md5),'anon_execute',has_function_privilege('anon','public.prepare_admin_affiliate_document_delete(uuid,uuid,text,text,uuid)','execute'),'authenticated_storage_execute',has_function_privilege('authenticated','public.affiliate_document_delete_storage(uuid,uuid,boolean)','execute')) result`);
  const data=result[0].result;assert(data.migration_installed);assert(data.functions_match);assert.equal(data.policies,4);assert.equal(data.reference_guards,7);assert(!data.anon_execute);assert(!data.authenticated_storage_execute);
  proof('backend-verified',{status:'PASS',...data,productionBusinessWrites:0});return;
 }
 throw Error('USAGE apply|compile|deploy|edge-verify|verify');
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
