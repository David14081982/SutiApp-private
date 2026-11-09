'use strict';
// Narrow release tooling. Production installation requires explicit `deploy` mode.
const C=require('./document-release/common.cjs'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const area=C.path.join(C.root,'.tmp/loan-document-submit');
const evidence=C.path.join(C.root,'docs/qa/evidence/loan-document-submit');
const version='20261109000300';
const migration=C.path.join(C.root,'supabase/migrations/'+version+'_loan_document_submission.sql');
const recovery=C.path.join(C.root,'supabase/recovery/'+version+'_loan_document_submission.sql');
const fixture=C.path.join(C.root,'scripts/fixtures/loan-document-submit-baseline.json');
const md5=s=>crypto.createHash('md5').update(s).digest('hex');
const save=(p,x)=>{C.fs.mkdirSync(C.path.dirname(p),{recursive:true});C.fs.writeFileSync(p,typeof x==='string'?x:JSON.stringify(x,null,2)+'\n');};
function replace(s,from,to){assert.equal(s.split(from).length,2,'EXACT_SINGLE_PATCH_REQUIRED');return s.replace(from,to);}
function build(){
 const privateBaseline=C.path.join(area,'baseline.json');
 const baseline=JSON.parse(C.fs.readFileSync(C.fs.existsSync(privateBaseline)?privateBaseline:fixture)).filter(x=>/^(prepare_document_submission|complete_document_financial_submission)\(/.test(x.signature));
 assert.equal(baseline.length,2);save(fixture,baseline);
 const changes=baseline.map(x=>{let definition=x.definition;
 if(x.signature.startsWith('prepare_')){
  definition=replace(definition,"d public.affiliate_documents;a public.private_assets;docs", "d public.affiliate_documents;a public.private_assets;asset_id uuid;loan_document_id uuid;docs");
  definition=replace(definition,'d:=document_evidence_private.lock_document(id);',`-- Existing loan documents are physically verified by Edge after preparation.
  -- Do not enroll here: authenticated clients cannot attest physical bytes.
  if p_function='create_validated_financial_program_request' then
   loan_document_id:=id;
   select coalesce(x.private_asset_id,f.private_asset_id) into asset_id
    from public.affiliate_documents x left join public.affiliate_files f on f.id=x.affiliate_file_id where x.id=loan_document_id;
   if asset_id is null then raise exception 'DOCUMENT_CONTEXT_DENIED' using errcode='42501';end if;
   perform pg_advisory_xact_lock(hashtextextended('document-asset:'||asset_id,0));
   select * into strict d from public.affiliate_documents where affiliate_documents.id=loan_document_id for update;
   if coalesce(d.private_asset_id,(select private_asset_id from public.affiliate_files where affiliate_files.id=d.affiliate_file_id)) is distinct from asset_id
    then raise exception 'DOCUMENT_OPERATION_CHANGED';end if;
   if exists(select 1 from document_lab_integrity.assets where assets.id=asset_id and state<>'AVAILABLE')
    then raise exception 'PHYSICAL_ASSET_NOT_VERIFIED';end if;
  else
   d:=document_evidence_private.lock_document(id);
  end if;`);
 }else{
  definition=replace(definition,'v_result jsonb;matches integer;', 'v_result jsonb;matches integer;doc public.affiliate_documents;asset public.private_assets;');
  definition=replace(definition,'if o.completed_at is not null then return o.result;end if;',`if o.completed_at is not null then return o.result;end if;
 -- Only the loan path enrolls existing files, after all service receipts pass.
 if o.function_name='create_validated_financial_program_request' then
  for d in select value from jsonb_array_elements(o.documents) order by value->>'asset',value->>'document_id' loop
   perform pg_advisory_xact_lock(hashtextextended('document-asset:'||(d->>'asset'),0));
   select * into strict doc from public.affiliate_documents where id=(d->>'document_id')::uuid for update;
   if doc.affiliate_id is distinct from public.get_effective_affiliate_id()
    or document_integration_private.current_document(doc.affiliate_id,doc.document_type_id) is distinct from doc.id
    or coalesce(doc.private_asset_id,(select private_asset_id from public.affiliate_files where id=doc.affiliate_file_id)) is distinct from (d->>'asset')::uuid
    then raise exception 'DOCUMENT_NOT_CURRENT' using errcode='42501';end if;
   select * into strict asset from public.private_assets where id=(d->>'asset')::uuid for share;
   if asset.status is distinct from 'READY'
    or (asset.owner_affiliate_id is not null and asset.owner_affiliate_id<>doc.affiliate_id)
    or asset.storage_bucket is distinct from d->>'bucket' or asset.storage_path is distinct from d->>'path'
    or lower(asset.content_sha256) is distinct from d->>'sha256'
    or asset.file_size::text is distinct from d->>'size' or asset.mime_type is distinct from d->>'mime'
    then raise exception 'DOCUMENT_OPERATION_CHANGED';end if;
   insert into document_lab_integrity.assets(id,affiliate_id,bucket,path,sha256,size,mime)
    values(asset.id,doc.affiliate_id,asset.storage_bucket,asset.storage_path,lower(asset.content_sha256),asset.file_size,asset.mime_type)
    on conflict(id) do nothing;
   perform 1 from document_lab_integrity.assets i where i.id=asset.id and i.affiliate_id=doc.affiliate_id
    and i.state='AVAILABLE' and i.bucket=asset.storage_bucket and i.path=asset.storage_path
    and i.sha256=lower(asset.content_sha256) and i.size=asset.file_size and i.mime=asset.mime_type for update;
   if not found then raise exception 'PHYSICAL_ASSET_NOT_VERIFIED';end if;
  end loop;
 end if;`);
 }
 return{...x,definition,before:x.definition};});
 function sql(reverse){return '-- H-LOAN-DOCUMENT-SUBMIT-001: loan-only, no business-data backfill.\nBEGIN;\nSET LOCAL lock_timeout=\'2s\';\nSET LOCAL statement_timeout=\'60s\';\n'+changes.map(x=>{const before=reverse?x.definition:x.before,after=reverse?x.before:x.definition;return `DO $guard$\nDECLARE current_definition text;BEGIN\n select pg_get_functiondef('${x.signature}'::regprocedure) into current_definition;\n if md5(current_definition)='${md5(after)}' then return;end if;\n if md5(current_definition)<>'${md5(before)}' then raise exception 'LOAN_DOCUMENT_FUNCTION_DRIFT';end if;\n execute $definition$${after}$definition$;\nEND $guard$;\n`;}).join('\n')+'COMMIT;\n';}
 save(migration,sql(false));save(recovery,sql(true));save(C.path.join(area,'candidate.json'),changes);
 console.log(JSON.stringify({status:'PREPARED',functions:changes.map(x=>x.signature),migrationSha256:C.sha(C.fs.readFileSync(migration))}));
}
function body(file){return C.fs.readFileSync(file,'utf8').replace(/^BEGIN;\r?\n/m,'').replace(/^COMMIT;\r?\n/m,'');}
async function definitions(db){return(await db.query(`select p.oid::regprocedure::text signature,pg_get_functiondef(p.oid) definition,p.proacl::text acl,pg_get_userbyid(p.proowner) owner from pg_proc p where p.oid=any($1::regprocedure[]) order by 1`,[JSON.parse(C.fs.readFileSync(fixture)).map(x=>x.signature)])).rows;}
async function deploy(){
 const tests=JSON.parse(C.fs.readFileSync(C.path.join(evidence,'tests.json')));assert.equal(tests.status,'PASS');assert.equal(tests.groups.length,5);assert.equal(tests.migrationSha256,C.sha(C.fs.readFileSync(migration)));
 const db=C.connection(C.environment(),{readonly:false});await db.connect();
 try{
  await db.query('begin');await db.query("set local lock_timeout='2s'");
  const before=await definitions(db);assert.deepEqual(before,JSON.parse(C.fs.readFileSync(fixture)).sort((a,b)=>a.signature.localeCompare(b.signature)));
  const tables=['public.affiliate_documents','public.private_assets','public.request_documents','public.program_requests','document_lab_integrity.assets'];
  const fingerprints=async()=>{const r={};for(const t of tables)r[t]=(await db.query(`select count(*)::int count,md5(coalesce(string_agg(to_jsonb(t)::text,'' order by to_jsonb(t)::text collate "C"),'')) hash from ${t} t`)).rows[0];return r;};
  // Prevent concurrent business writes only for the short install/readback window.
  await db.query('lock table '+tables.join(',')+' in share mode');const dataBefore=await fingerprints();
  await db.query(body(migration));const after=await definitions(db);
  const expected=JSON.parse(C.fs.readFileSync(C.path.join(area,'candidate.json'))).map(({before,...x})=>x).sort((a,b)=>a.signature.localeCompare(b.signature));assert.deepEqual(after,expected);
  assert.deepEqual(await fingerprints(),dataBefore);
  await db.query('insert into supabase_migrations.schema_migrations(version,name,statements) values($1,$2,$3)',[version,'loan_document_submission',[C.fs.readFileSync(migration,'utf8')]]);
  await db.query('commit');
  assert.deepEqual(await definitions(db),expected);
  const out={status:'PASS',appliedAt:new Date().toISOString(),version,migrationSha256:C.sha(C.fs.readFileSync(migration)),functions:after.map(x=>({signature:x.signature,sha256:C.sha(x.definition),acl:x.acl,owner:x.owner})),tablesUnchanged:dataBefore,productionTestRequests:0};save(C.path.join(evidence,'deployment.json'),out);console.log(JSON.stringify(out));
 }catch(e){await db.query('rollback');throw e;}finally{await db.end();}
}
module.exports={C,area,evidence,version,migration,recovery,fixture,save,body,definitions};
if(require.main===module)(async()=>{if(process.argv[2]==='build')build();else if(process.argv[2]==='deploy')await deploy();else throw Error('MODE_REQUIRED');})().catch(e=>{console.error(JSON.stringify({status:'FAIL',message:e.message,code:e.code}));process.exitCode=1;});
