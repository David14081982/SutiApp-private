'use strict';
// No document bytes or private paths enter public evidence. Originals are never removed.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert/strict');
const {query,environment}=require('./investors-db'),{switchSQL}=require('./affiliate-document-isolation-core');
const root=path.resolve(__dirname,'..'),dir=path.join(root,'.tmp/document-isolation'),out=path.join(root,'docs/qa/evidence/document-isolation');
const version='20261105000100',migrationFile='supabase/migrations/'+version+'_affiliate_document_isolation.sql';
const read=f=>fs.readFileSync(path.join(root,f),'utf8').replace(/^\uFEFF/,''),sha=b=>crypto.createHash('sha256').update(b).digest('hex'),quoted=s=>"'"+String(s).replaceAll("'","''")+"'";
const protectedTables=['affiliates','request_documents','savings_requests','program_requests','program_catalog_item_assets','program_terms_versions','historical_asset_sources','financial_programs','admin_assignments','admin_roles','admin_role_permissions','admin_section_responsibilities','document_types'];
const fingerprintSQL=tables=>tables.map(t=>"select '"+t+"' name,count(*)::bigint rows,md5(coalesce(jsonb_agg("+(t==='private_assets'?"to_jsonb(t)-'owner_affiliate_id'":"to_jsonb(t)")+" order by to_jsonb(t)::text)::text,'[]')) fingerprint from public."+t+" t").join(' union all ');
const securitySQL="select p.oid::regprocedure::text signature,md5(pg_get_functiondef(p.oid)) fingerprint,p.proacl::text acl,p.proowner from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in('public','admin_support_private') and p.proname in('has_admin_permission','has_admin_module','module_visible','admin_module_boundary') order by p.oid";
function proof(file,obj){fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,file+'.json'),JSON.stringify(obj,null,2)+'\n');console.log(JSON.stringify(obj));}
function loadPlan(){return JSON.parse(fs.readFileSync(path.join(dir,'plan.json'),'utf8'));}
async function identity(env){
 const r=await fetch(env.SUPABASE_URL+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:env.SUPABASE_PUBLISHABLE_KEY,'Content-Type':'application/json'},body:JSON.stringify({email:env.H005_TEST_EMAIL,password:env.H005_TEST_PASSWORD})});assert(r.ok,'MAINTENANCE_ACTOR_LOGIN');const data=await r.json();return data.user.id;
}
async function main(){
 fs.mkdirSync(dir,{recursive:true});const mode=process.argv[2],env=environment();
 if(mode==='apply'){
  const tested=JSON.parse(read('docs/qa/evidence/document-isolation/database.json')),migration=read(migrationFile);assert.equal(tested.status,'PASS');assert.equal(tested.migrationSha256,sha(migration));assert.equal(tested.coreSha256,sha(fs.readFileSync(path.join(root,'scripts/affiliate-document-isolation-core.js'),'utf8')));
  assert.equal((await query("select count(*)::int n from supabase_migrations.schema_migrations where version='"+version+"'"))[0].n,0,'MIGRATION_ALREADY_PRESENT');
  const tables=[...protectedTables,'affiliate_documents','affiliate_files','private_assets','sensitive_change_audit'];
  const before="create temporary table isolation_before on commit drop as "+fingerprintSQL(tables)+";create temporary table isolation_security_before on commit drop as "+securitySQL+";";
  const after="create temporary table isolation_after on commit drop as "+fingerprintSQL(tables)+";create temporary table isolation_security_after on commit drop as "+securitySQL+";";
  const guard="do $p$ begin if exists(select * from isolation_before except select * from isolation_after) then raise exception 'ISOLATION_EXISTING_ROWS_CHANGED';end if;if exists(select * from isolation_security_before except select * from isolation_security_after) then raise exception 'ISOLATION_GLOBAL_PERMISSIONS_CHANGED';end if;end $p$;";
  const sql="begin isolation level repeatable read;set local lock_timeout='3s';set local statement_timeout='90s';"+before+migration.replace(/^begin;\s*/,'').replace(/commit;\s*$/,'')+after+guard+"insert into supabase_migrations.schema_migrations(version,name,statements) values('"+version+"','affiliate_document_isolation',array["+quoted(migration)+"]);select name,rows from isolation_before order by name;commit;";
  fs.writeFileSync(path.join(dir,'apply.sql'),sql);const result=await query(sql,true);proof('backend-applied',{status:'PASS',migration:version,sha256:sha(migration),preserved:result,existingBusinessRowsChanged:0,globalPermissionChanges:0});return;
 }
 if(mode==='plan'){
  const file=path.join(dir,'plan.json');assert(!fs.existsSync(file),'PLAN_EXISTS');
  const actorAuthUserId=await identity(env);
  const rows=await query("with units as(select 'file' unit_kind,f.id unit_id,f.affiliate_id,f.private_asset_id asset_id from affiliate_files f where f.private_asset_id is not null and not exists(select 1 from document_retirement_private.documents r where r.affiliate_file_id=f.id) union all select 'document',d.id,d.affiliate_id,d.private_asset_id from affiliate_documents d where d.affiliate_file_id is null and d.private_asset_id is not null and not exists(select 1 from document_retirement_private.documents r where r.document_id=d.id)),shared as(select asset_id from units group by asset_id having count(*)>1) select u.unit_kind,u.unit_id,u.affiliate_id,to_jsonb(a) source_asset,case when u.unit_kind='file' then(select to_jsonb(f) from affiliate_files f where id=u.unit_id)end before_file,(select coalesce(jsonb_agg(to_jsonb(d) order by d.id),'[]') from affiliate_documents d where (u.unit_kind='file' and d.affiliate_file_id=u.unit_id) or(u.unit_kind='document' and d.id=u.unit_id)) before_documents from units u join shared s on s.asset_id=u.asset_id join private_assets a on a.id=u.asset_id order by a.id,u.unit_kind,u.unit_id");
  for(const item of rows){assert(item.source_asset.content_sha256&&item.source_asset.storage_bucket==='private-assets');assert(item.before_documents.every(d=>d.affiliate_id===item.affiliate_id));if(item.unit_kind==='file')assert(item.before_documents.every(d=>!d.private_asset_id||d.private_asset_id===item.source_asset.id),'DOCUMENT_FILE_ASSET_CONFLICT');item.new_asset_id=crypto.randomUUID();item.new_path='affiliate-documents/'+item.affiliate_id+'/'+item.new_asset_id+({ 'image/png':'.png','image/jpeg':'.jpg','application/pdf':'.pdf','image/webp':'.webp'}[item.source_asset.mime_type]||'.bin');}
  const plan={id:crypto.randomUUID(),actorAuthUserId,createdAt:new Date().toISOString(),items:rows,protected:await query(fingerprintSQL(protectedTables)),security:await query(securitySQL)};
  fs.writeFileSync(file,JSON.stringify(plan,null,2));proof('repair-plan',{status:'PASS',units:rows.length,sourceAssets:new Set(rows.map(r=>r.source_asset.id)).size,documents:rows.filter(r=>r.unit_kind==='document').length,fileRelations:rows.filter(r=>r.unit_kind==='file').length,bytes:rows.reduce((s,r)=>s+Number(r.source_asset.file_size),0),sourceObjectsPreserved:true,privateSnapshot:true});return;
 }
 if(mode==='copy'){
  const plan=loadPlan(),receiptsFile=path.join(dir,'copy-receipts.ndjson'),done=new Map();
  if(fs.existsSync(receiptsFile))for(const line of fs.readFileSync(receiptsFile,'utf8').trim().split('\n').filter(Boolean)){const r=JSON.parse(line);done.set(r.new_asset_id,r);}
  const headers={apikey:env.SUPABASE_SECRET_KEY,Authorization:'Bearer '+env.SUPABASE_SECRET_KEY},sources=new Map();let cursor=0,completed=0,failed=false;
  const request=async(url,options={})=>{let r;for(let n=0;n<4;n++){r=await fetch(env.SUPABASE_URL+url,{...options,headers:{...headers,...options.headers},signal:AbortSignal.timeout(90000)});if(r.status!==429&&r.status<500)return r;await r.arrayBuffer();await new Promise(resolve=>setTimeout(resolve,1000*(n+1)));}return r;};
  const download=async(storagePath,asset)=>{const url='/storage/v1/object/authenticated/private-assets/'+storagePath.split('/').map(encodeURIComponent).join('/');const r=await request(url);assert(r.ok,'STORAGE_READ_'+r.status);const bytes=Buffer.from(await r.arrayBuffer());assert.equal(bytes.length,Number(asset.file_size),'STORAGE_SIZE_MISMATCH');const digest=sha(bytes).toUpperCase();assert.equal(digest,asset.content_sha256,'STORAGE_HASH_MISMATCH');return digest;};
  const sourceVerified=item=>{if(!sources.has(item.source_asset.id))sources.set(item.source_asset.id,download(item.source_asset.storage_path,item.source_asset));return sources.get(item.source_asset.id);};
  const worker=async()=>{while(!failed){const item=plan.items[cursor++];if(!item)return;
   try{
    if(done.has(item.new_asset_id)){completed++;continue;}
    await sourceVerified(item);
    const copied=await request('/storage/v1/object/copy',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({bucketId:'private-assets',sourceKey:item.source_asset.storage_path,destinationKey:item.new_path})});
    if(!copied.ok){const data=await copied.json().catch(()=>({}));assert(copied.status===409||String(data.statusCode)==='409'||/Duplicate|already exists/i.test(data.error||data.message||''),'STORAGE_COPY_'+copied.status);}
    else await copied.arrayBuffer();
    const digest=await download(item.new_path,item.source_asset);
    fs.appendFileSync(receiptsFile,JSON.stringify({new_asset_id:item.new_asset_id,sha256:digest,verifiedAt:new Date().toISOString()})+'\n');completed++;if(completed%50===0)console.log(JSON.stringify({copiedAndVerified:completed,total:plan.items.length}));
   }catch(e){failed=true;fs.writeFileSync(path.join(dir,'copy-error.json'),JSON.stringify({unit:item.unit_id,new_asset:item.new_asset_id,error:e.message}));throw e;}
  }};
  const results=await Promise.allSettled(Array.from({length:8},worker));const bad=results.find(r=>r.status==='rejected');if(bad)throw bad.reason;
  proof('storage-copies',{status:'PASS',copiedAndVerified:completed,expected:plan.items.length,sha256EveryDestination:true,originalsDeleted:0,documentPointersChanged:0});return;
 }
 if(mode==='switch'){
  const plan=loadPlan(),receipts=new Map(fs.readFileSync(path.join(dir,'copy-receipts.ndjson'),'utf8').trim().split('\n').map(l=>{const r=JSON.parse(l);return[r.new_asset_id,r];}));
  for(const item of plan.items){assert.equal(receipts.get(item.new_asset_id)?.sha256,item.source_asset.content_sha256,'COPY_PROOF_MISSING');item.verified_sha256=receipts.get(item.new_asset_id).sha256;}
  let applied=0;for(let i=0;i<plan.items.length;i+=100){const chunk=plan.items.slice(i,i+100);const result=await query(switchSQL(plan,chunk),true);applied=result.find(r=>r.applied!==undefined)?.applied||applied;console.log(JSON.stringify({isolatedUnits:applied,total:plan.items.length}));}
  await query("update document_isolation_private.batches set completed_at=coalesce(completed_at,now()) where id="+quoted(plan.id)+"::uuid and (select count(*) from document_isolation_private.items where batch_id="+quoted(plan.id)+"::uuid)="+plan.items.length,true);
  proof('repair-applied',{status:'PASS',units:applied,expected:plan.items.length,originalAssetsChanged:0,originalObjectsDeleted:0,privateBeforeSnapshots:true});return;
 }
 if(mode==='verify'){
  const catalog=JSON.parse(read('scripts/fixtures/affiliate-document-isolation-schema.json'));
  const grants=await query("select p.oid::regprocedure::text signature,p.proowner,to_jsonb(p.proacl) acl,has_function_privilege('anon',p.oid,'execute') anon_exec,has_function_privilege('authenticated',p.oid,'execute') auth_exec from pg_proc p where p.oid in('public.register_admin_affiliate_document(uuid,uuid,text,text,bigint,text,text)'::regprocedure,'public.register_affiliate_document(uuid,text,text,bigint,text,text)'::regprocedure,'public.set_self_profile_photo(text,text,bigint,text)'::regprocedure)");
  for(const row of grants){const before=catalog.functions.find(f=>f.signature===row.signature);assert.equal(String(row.proowner),String(before.owner));assert.deepEqual(row.acl,before.acl);assert(!row.anon_exec&&row.auth_exec);}
  proof('security',{status:'PASS',uploadFunctionsChecked:grants.length,ownersAndGrantsPreserved:true,anonymousUploadExecute:false});
  const plan=loadPlan(),actualProtected=await query(fingerprintSQL(protectedTables)),concurrentTables=new Set(['program_requests','request_documents']);let concurrent=null;
  for(const expected of plan.protected){if(expected.name!=='affiliates'&&!concurrentTables.has(expected.name))assert.deepEqual(actualProtected.find(x=>x.name===expected.name),expected,'PROTECTED_RECORDS_CHANGED');}
  const affiliateBaseline=plan.protected.find(x=>x.name==='affiliates'),affiliateActual=actualProtected.find(x=>x.name==='affiliates');let concurrentAffiliates=null;
  if(affiliateBaseline.fingerprint!==affiliateActual.fingerprint){
   assert.equal(Number(affiliateBaseline.rows),Number(affiliateActual.rows));
   const timing=await query("select b.completed_at,(select count(*)::int from affiliates where updated_at>"+quoted(plan.createdAt)+"::timestamptz and updated_at<=b.completed_at) updated_before_switch_end,(select count(*)::int from affiliates where updated_at>b.completed_at) updated_after_switch_end from document_isolation_private.batches b where id="+quoted(plan.id)+"::uuid");
   concurrentAffiliates=timing[0];assert(concurrentAffiliates.completed_at);assert.equal(concurrentAffiliates.updated_before_switch_end,0);assert(concurrentAffiliates.updated_after_switch_end>0);
   proof('post-switch-affiliate-activity',{status:'PASS',...concurrentAffiliates,classification:'Separate affiliate edits after every isolation transaction had completed; no affiliate DML in maintenance',restoredAffiliates:0,rowsBitwiseUnchanged:false});
  }

  if(plan.protected.some(e=>concurrentTables.has(e.name)&&e.fingerprint!==actualProtected.find(x=>x.name===e.name)?.fingerprint)){
   const cutoff=quoted(plan.createdAt);
   const reconciled=await query("with lost as(select snapshot from program_request_deletions where created_at>="+cutoff+"::timestamptz and (snapshot->'request'->>'created_at')::timestamptz<="+cutoff+"::timestamptz),reqs as(select to_jsonb(r) row from program_requests r where r.created_at<="+cutoff+"::timestamptz union all select snapshot->'request' from lost where not exists(select 1 from program_requests r where r.id=(snapshot->'request'->>'id')::uuid)),docs as(select to_jsonb(d) row from request_documents d where exists(select 1 from reqs r where (r.row->>'id')::uuid=d.request_id) union all select x from lost cross join lateral jsonb_array_elements(snapshot->'documents') x where not exists(select 1 from request_documents d where d.id=(x->>'id')::uuid)) select (select count(*)::int from reqs) baseline_requests,(select count(*)::int from docs) baseline_documents,(select md5(coalesce(jsonb_agg(row order by row::text)::text,'[]')) from docs) documents_fingerprint,(select count(*)::int from lost) archived_requests,(select count(*)::int from program_requests where created_at>"+cutoff+"::timestamptz) new_requests,(select count(*)::int from program_requests r where r.created_at<="+cutoff+"::timestamptz and r.updated_at>"+cutoff+"::timestamptz) updated_requests,(select count(*)::int from program_requests r where r.created_at<="+cutoff+"::timestamptz and r.updated_at>"+cutoff+"::timestamptz and not exists(select 1 from program_request_admin_events e where e.request_id=r.id and e.to_status=r.status and abs(extract(epoch from e.created_at-r.updated_at))<1)) unaudited_updates");
   concurrent=reconciled[0];assert.equal(concurrent.baseline_requests,Number(plan.protected.find(x=>x.name==='program_requests').rows));assert.equal(concurrent.baseline_documents,Number(plan.protected.find(x=>x.name==='request_documents').rows));assert.equal(concurrent.documents_fingerprint,plan.protected.find(x=>x.name==='request_documents').fingerprint);assert.equal(concurrent.unaudited_updates,0);
   proof('concurrent-request-activity',{status:'PASS',...concurrent,classification:'Existing request-deletion/admin-decision flows during storage copy; no request DML in isolation maintenance',restoredRequests:0,requestDocumentBaselineReconciledExactly:true,requestRowsBitwiseUnchanged:false});
  }
  assert.deepEqual(await query(securitySQL),plan.security,'GLOBAL_SECURITY_CHANGED');
  const equal=require('util').isDeepStrictEqual;
  const sources=new Map(plan.items.map(i=>[i.source_asset.id,i.source_asset]));
  const sourceRows=await query('select to_jsonb(p) row from private_assets p where id in('+[...sources.keys()].map(quoted).join(',')+')');assert.equal(sourceRows.length,sources.size);for(const r of sourceRows)assert(equal(r.row,sources.get(r.row.id)),'ORIGINAL_ASSET_ROW_CHANGED');
  const expectedFiles=new Map(plan.items.filter(i=>i.unit_kind==='file').map(i=>[i.unit_id,{...i.before_file,private_asset_id:i.new_asset_id,storage_path:i.new_path}]));
  const expectedDocs=new Map(plan.items.flatMap(i=>i.before_documents.map(d=>[d.id,{...d,private_asset_id:d.private_asset_id?i.new_asset_id:null}])));
  for(const [table,expected]of [['affiliate_files',expectedFiles],['affiliate_documents',expectedDocs]]){if(!expected.size)continue;const rows=await query('select to_jsonb(t) row from '+table+' t where id in('+[...expected.keys()].map(quoted).join(',')+')');assert.equal(rows.length,expected.size);for(const r of rows){const a={...r.row},b={...expected.get(r.row.id)};delete a.updated_at;delete b.updated_at;assert(equal(a,b),'UNEXPECTED_DOCUMENT_METADATA_CHANGED');}}
  const r=await query("with units as(select f.private_asset_id asset_id,f.affiliate_id from affiliate_files f where f.private_asset_id is not null and not exists(select 1 from document_retirement_private.documents r where r.affiliate_file_id=f.id) union all select d.private_asset_id,d.affiliate_id from affiliate_documents d where d.affiliate_file_id is null and d.private_asset_id is not null and not exists(select 1 from document_retirement_private.documents r where r.document_id=d.id)) select (select count(*)::int from(select asset_id from units group by asset_id having count(*)>1)s) shared_units,(select count(*)::int from(select asset_id from units group by asset_id having count(distinct affiliate_id)>1)s) cross_affiliate_assets,(select count(*)::int from document_isolation_private.items where batch_id="+quoted(plan.id)+"::uuid) isolated_units,(select count(*)::int from private_assets p join units u on u.asset_id=p.id where p.owner_affiliate_id is not null and p.owner_affiliate_id<>u.affiliate_id) ownership_mismatches,(select bool_and(md5(pg_get_functiondef(signature::regprocedure))=applied_md5) from document_isolation_private.function_backup) functions_match,(select count(*)::int from document_isolation_private.items i join private_assets p on p.id=i.new_asset_id where p.content_sha256<>i.source_hash or p.owner_affiliate_id<>i.affiliate_id) copy_metadata_mismatches");
  const data=r[0];assert.equal(data.shared_units,0);assert.equal(data.cross_affiliate_assets,0);assert.equal(data.isolated_units,plan.items.length);assert.equal(data.ownership_mismatches,0);assert.equal(data.copy_metadata_mismatches,0);assert(data.functions_match);
  proof('backend-verified',{status:'PASS',...data,protectedTablesUnchanged:protectedTables.length-(concurrent?2:0)-(concurrentAffiliates?1:0),concurrentRequestActivityReconciled:!!concurrent,postSwitchAffiliateEdits:concurrentAffiliates?.updated_after_switch_end||0,originalAssetRowsUnchanged:sources.size,fileMetadataPreserved:expectedFiles.size,documentMetadataPreserved:expectedDocs.size,globalPermissionChanges:0});return;
 }
 throw Error('USAGE apply|plan|copy|switch|verify');
}
main().catch(e=>{console.error(e.message);process.exitCode=1});
