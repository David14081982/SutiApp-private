'use strict';
// One focal schema migration; never removes Storage objects or historical records.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert/strict');
const {query}=require('./investors-db');
const root=path.resolve(__dirname,'..'),dir=path.join(root,'.tmp/document-upload-diagnosis'),out=path.join(root,'docs/qa/evidence/document-upload-regression');
const version='20261105000200',file='supabase/migrations/'+version+'_affiliate_document_review_slots.sql';
const tables=['affiliates','affiliate_documents','affiliate_files','private_assets','document_types','sensitive_change_audit','request_documents','program_requests','savings_requests','admin_assignments','admin_roles','admin_role_permissions','admin_section_responsibilities','document_retirement_private.operations','document_retirement_private.documents','document_retirement_private.assets'];
const quote=s=>"'"+String(s).replaceAll("'","''")+"'",sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const fingerprintSQL=()=>tables.map(t=>"select "+quote(t)+" name,count(*)::bigint rows,md5(coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text)::text,'[]')) fingerprint from "+(t.includes('.')?t:'public.'+t)+" t").join(' union all ');
const functionsSQL="select n.nspname||'.'||p.oid::regprocedure::text signature,md5(pg_get_functiondef(p.oid)) fingerprint,p.proacl::text acl,p.proowner from pg_proc p join pg_namespace n on n.oid=p.pronamespace where p.prokind='f' and ((n.nspname='public' and p.proname in('register_admin_affiliate_document','register_affiliate_document','set_self_profile_photo','has_admin_permission','has_admin_module','admin_module_boundary','prepare_admin_affiliate_document_delete')) or(n.nspname='admin_support_private' and p.proname='module_visible')) order by p.oid";
function proof(name,data){fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,name+'.json'),JSON.stringify(data,null,2)+'\n');console.log(JSON.stringify(data));}
async function verify(){
 const rows=await query("with expected as(select d.id document_id,d.affiliate_id,d.document_type_id from public.affiliate_documents d where d.status in('PENDING_REVIEW','UNDER_REVIEW','REUPLOAD_REQUIRED') and not exists(select 1 from document_retirement_private.documents r where r.document_id=d.id)),diff as((select * from expected except select document_id,affiliate_id,document_type_id from document_retirement_private.review_slots) union all(select document_id,affiliate_id,document_type_id from document_retirement_private.review_slots except select * from expected)) select (select count(*)::int from expected) active_slots,(select count(*)::int from diff) mismatches,(select count(*)::int from public.affiliate_documents d join document_retirement_private.documents r on r.document_id=d.id where d.status in('PENDING_REVIEW','UNDER_REVIEW','REUPLOAD_REQUIRED')) preserved_retired_pending,(select count(*)::int from document_retirement_private.review_slots s join document_retirement_private.documents r on r.document_id=s.document_id) retired_slots,to_regclass('public.affiliate_documents_current_review_idx') is null obsolete_index_removed");
 const data=rows[0];assert.equal(data.mismatches,0);assert.equal(data.retired_slots,0);assert(data.obsolete_index_removed);
 const security=(await query("select c.relrowsecurity rls,c.relforcerowsecurity forced_rls,exists(select 1 from information_schema.role_table_grants g where g.table_schema='document_retirement_private' and g.table_name='review_slots' and g.grantee in('PUBLIC','anon','authenticated','service_role')) api_grants from pg_class c where c.oid='document_retirement_private.review_slots'::regclass"))[0];assert(security.rls&&security.forced_rls&&!security.api_grants);
 const before=JSON.parse(fs.readFileSync(path.join(dir,'preflight.json'),'utf8'));assert.deepEqual(await query(functionsSQL),before.functions,'EXISTING_WRITERS_OR_PERMISSIONS_CHANGED');
 proof('backend-verified',{status:'PASS',...data,security,existingWriterAndPermissionChanges:0,productionFileDeletions:0,verifiedAt:new Date().toISOString()});
}

async function liveSnapshot(){
 const controlled=JSON.parse(fs.readFileSync(path.join(dir,'controlled-account-private.json'),'utf8'));
 const own=controlled.affiliate,source=controlled.documents.find(d=>d.code==='payroll_previous'&&d.mime_type==='image/jpeg');assert(source);
 const other=(await query("select affiliate_id id from public.affiliate_documents where affiliate_id<>"+quote(own)+"::uuid order by affiliate_id limit 1"))[0].id;
 const documents=await query("select to_jsonb(d) row from public.affiliate_documents d where affiliate_id in("+quote(own)+"::uuid,"+quote(other)+"::uuid) order by id");
 const assets=await query("select distinct a.id,to_jsonb(a) row from public.affiliate_documents d left join public.affiliate_files f on f.id=d.affiliate_file_id join public.private_assets a on a.id=coalesce(d.private_asset_id,f.private_asset_id) where d.affiliate_id in("+quote(own)+"::uuid,"+quote(other)+"::uuid) order by a.id");
 const objects=await query("select a.id,exists(select 1 from storage.objects o where o.bucket_id=a.storage_bucket and o.name=a.storage_path) present from public.private_assets a where a.id in("+assets.map(a=>quote(a.id)+'::uuid').join(',')+") order by a.id");
 const retired=await query("select r.document_id from document_retirement_private.documents r join public.affiliate_documents d on d.id=r.document_id where d.affiliate_id in("+quote(own)+"::uuid,"+quote(other)+"::uuid) order by r.document_id");
 return {own,other,type:source.document_type_id,actor:controlled.actor,documents:documents.map(x=>x.row),assets:assets.map(x=>x.row),objects,retired:retired.map(r=>r.document_id)};
}
async function verifyLive(){
 const before=JSON.parse(fs.readFileSync(path.join(dir,'live-before-private.json'),'utf8'));
 const checkpoint=JSON.parse(fs.readFileSync(path.join(dir,'live-upload-checkpoint-private.json'),'utf8'));
 const after=await liveSnapshot(),newSteps=Object.values(checkpoint.steps);assert.equal(newSteps.length,3);assert(newSteps.every(s=>s.status==='COMPLETE'));
 for(const old of before.documents){
  const current=after.documents.find(d=>d.id===old.id);assert(current,'ORIGINAL_DOCUMENT_REMOVED');
  if(!before.retired.includes(old.id)&&old.affiliate_id===before.own&&old.document_type_id===before.type&&['PENDING_REVIEW','UNDER_REVIEW','REUPLOAD_REQUIRED'].includes(old.status)){
   assert.equal(current.status,'REJECTED');assert.equal(current.reviewed_by_auth_user_id,before.actor);
   const except=new Set(['status','review_observation','reviewed_by_auth_user_id','reviewed_at','updated_at']);
   for(const key of Object.keys(old))if(!except.has(key))assert.deepEqual(current[key],old[key],'ORIGINAL_DOCUMENT_METADATA_CHANGED');
  }else assert.deepEqual(current,old,'UNRELATED_DOCUMENT_CHANGED');
 }
 for(const old of before.assets)assert.deepEqual(after.assets.find(a=>a.id===old.id),old,'ORIGINAL_ASSET_CHANGED');
 const created=after.documents.filter(d=>!before.documents.some(old=>old.id===d.id));assert.equal(created.length,3);
 for(const step of newSteps){
  const doc=created.find(d=>d.id===step.documentId),asset=after.assets.find(a=>a.id===step.assetId);assert(doc&&asset);
  assert.equal(doc.affiliate_id,before.own);assert.equal(doc.document_type_id,before.type);assert.equal(doc.created_by_auth_user_id,before.actor);
  assert.equal(asset.owner_affiliate_id,before.own);assert.equal(asset.storage_path,step.path);assert.equal(asset.content_sha256,step.sha256);
 }
 const audits=await query("select count(*)::int n from public.sensitive_change_audit where target_id in("+newSteps.slice(0,2).map(s=>quote(s.documentId)+'::uuid').join(',')+") and actor_auth_user_id="+quote(before.actor)+"::uuid and action='ADMIN_REPLACEMENT_UPLOAD' and metadata->>'reason'='H-AFFILIATE-DOCUMENT-UPLOAD-REGRESSION-001: verificacion autorizada sin borrar archivos'");assert.equal(audits[0].n,2);
 const missing=before.objects.filter(o=>o.present&&!after.objects.find(a=>a.id===o.id)?.present).length;assert.equal(missing,0,'ORIGINAL_STORAGE_OBJECT_MISSING');
 for(const o of before.objects)assert.deepEqual(after.objects.find(a=>a.id===o.id),o,'ORIGINAL_STORAGE_EXISTENCE_CHANGED');
 proof('live-preservation',{status:'PASS',originalDocumentsPreserved:before.documents.length,originalAssetsPreserved:before.assets.length,otherAffiliateUnchanged:true,onlyTargetTypeReplacementStatusChanged:true,retainedNewDocuments:created.length,newAssetsIndependentlyOwned:3,adminAuditWithReason:2,sourceObjectsMissing:0,productionFileDeletions:0,verifiedAt:new Date().toISOString()});
}

async function main(){
 fs.mkdirSync(dir,{recursive:true});const mode=process.argv[2];
 if(mode==='snapshot-live'){const f=path.join(dir,'live-before-private.json');assert(!fs.existsSync(f),'LIVE_BASELINE_EXISTS');fs.writeFileSync(f,JSON.stringify(await liveSnapshot(),null,2));console.log(JSON.stringify({status:'PASS',privateBaseline:true,productionWrites:0}));return;}
 if(mode==='verify-live'){await verifyLive();return;}
 if(mode==='preflight'){
  const target=path.join(dir,'preflight.json');assert(!fs.existsSync(target),'PREFLIGHT_EXISTS');
  const state={capturedAt:new Date().toISOString(),tables:await query(fingerprintSQL()),functions:await query(functionsSQL)};
  fs.writeFileSync(target,JSON.stringify(state,null,2));proof('preflight',{status:'PASS',protectedTables:state.tables.map(x=>({name:x.name,rows:x.rows})),protectedFunctions:state.functions.length,productionWrites:0});return;
 }
 if(mode==='apply'){
  const sql=fs.readFileSync(path.join(root,file),'utf8'),receipt=JSON.parse(fs.readFileSync(path.join(out,'database.json'),'utf8'));
  assert.equal(receipt.status,'PASS');assert.equal(receipt.migrationSha256,sha(sql),'UNTESTED_MIGRATION');
  assert.equal(receipt.recoverySha256,sha(fs.readFileSync(path.join(root,'supabase/recovery/'+version+'_affiliate_document_review_slots.sql'),'utf8')),'UNTESTED_RECOVERY');
  assert.equal(receipt.testSha256,sha(fs.readFileSync(path.join(root,'scripts/test-affiliate-document-review-slots.js'),'utf8')),'TEST_CHANGED_SINCE_RECEIPT');
  assert.equal((await query('select count(*)::int n from supabase_migrations.schema_migrations where version='+quote(version)))[0].n,0,'ALREADY_APPLIED');
  const statements="begin isolation level repeatable read;set local lock_timeout='5s';set local statement_timeout='90s';lock table public.affiliate_documents,document_retirement_private.documents in share row exclusive mode;create temporary table upload_before on commit drop as "+fingerprintSQL()+";create temporary table upload_functions_before on commit drop as "+functionsSQL+";"+sql.replace(/^begin;\s*/,'').replace(/commit;\s*$/,'')+"create temporary table upload_after on commit drop as "+fingerprintSQL()+";create temporary table upload_functions_after on commit drop as "+functionsSQL+";do $checks$ begin if exists(select * from upload_before except select * from upload_after) or exists(select * from upload_after except select * from upload_before) then raise exception 'UPLOAD_EXISTING_ROWS_CHANGED';end if;if exists(select * from upload_functions_before except select * from upload_functions_after) or exists(select * from upload_functions_after except select * from upload_functions_before) then raise exception 'UPLOAD_WRITERS_OR_PERMISSIONS_CHANGED';end if;end $checks$;insert into supabase_migrations.schema_migrations(version,name,statements) values("+quote(version)+",'affiliate_document_review_slots',array["+quote(sql)+"]);select name,rows from upload_before order by name;commit;";
  fs.writeFileSync(path.join(dir,'apply-review-slots.sql'),statements);const result=await query(statements,true);
  proof('backend-applied',{status:'PASS',version,migrationSha256:sha(sql),preserved:result,originalBusinessRowsChanged:0,uploadWriterChanges:0,globalPermissionChanges:0,productionFileDeletions:0,appliedAt:new Date().toISOString()});await verify();return;
 }
 if(mode==='verify'){await verify();return;}
 throw Error('MODE_REQUIRED_preflight_apply_verify');
}
module.exports={liveSnapshot};
if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1});
