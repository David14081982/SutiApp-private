'use strict';
const C=require('./document-release/common.cjs'),fs=C.fs,path=C.path,assert=require('node:assert/strict'),crypto=require('node:crypto');
const area=path.join(C.root,'.tmp/document-100mb'),candidate=path.join(area,'candidate'),baseline=path.join(area,'baseline'),evidence=path.join(C.root,'docs/qa/evidence/document-100mb');
const save=(p,x)=>{fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,typeof x==='string'||Buffer.isBuffer(x)?x:JSON.stringify(x,null,2)+'\n');};
const read=p=>fs.readFileSync(p,'utf8'),json=p=>JSON.parse(read(p));
const replace=(s,a,b)=>{assert.equal(s.split(a).length,2,'EXACT_PATCH '+a.slice(0,80));return s.replace(a,b);};
const edit=(file,fn)=>save(path.join(candidate,file),fn(read(path.join(baseline,file))));
const md5=s=>crypto.createHash('md5').update(s).digest('hex');
const migration=path.join(C.root,'supabase/migrations/20261109000400_document_100mb.sql');
const recovery=path.join(C.root,'supabase/recovery/20261109000400_document_100mb.sql');
const body=p=>read(p).replace(/^BEGIN;\r?\n/m,'').replace(/^COMMIT;\r?\n/m,'');
async function remote(suffix,options={}){const env=C.environment(),r=await fetch('https://api.supabase.com/v1/projects/'+new URL(env.SUPABASE_URL).hostname.split('.')[0]+suffix,{...options,headers:{Authorization:'Bearer '+env.SUPABASE_ACCESS_TOKEN,...options.headers},signal:AbortSignal.timeout(120000)});const data=Buffer.from(await r.arrayBuffer());if(!r.ok)throw Error('MANAGEMENT_'+r.status+' '+data.toString().slice(0,300));return data;}
async function prepare(){
 edit('app/document-integration.js',s=>{
  s=replace(s,"const sha=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await file.arrayBuffer()))).map(x=>x.toString(16).padStart(2,'0')).join('');checked(before);","const sha=await window.DocumentTransfer.hash(file,()=>checked(before));checked(before);");
  return replace(s,"db().storage.from(prepared.bucket).upload(prepared.path,file,{contentType:file.type,upsert:false})","window.DocumentTransfer.upload(db(),prepared,file,()=>checked(before))");
 });
 edit('app/document-workflow-repository.js',s=>replace(replace(replace(s,'const MAX=10*1024*1024;','const MAX=100*1024*1024;'),'const MAX_SOURCE=25*1024*1024;','const MAX_SOURCE=100*1024*1024;'),'const prepared=await compressImage(file,type,onProgress||(()=>{}));',"const prepared=origin==='camera'?await compressImage(file,type,onProgress||(()=>{})):file;"));
 edit('app/admin-affiliates-repository.js',s=>replace(s,'const MAX_DOCUMENT_SIZE=10*1024*1024;','const MAX_DOCUMENT_SIZE=100*1024*1024;'));
 edit('app/screens-admin-affiliates.jsx',s=>replace(s,'Math.min(10,(Number(selected.max_file_size_bytes)||10485760)/1048576):10','Math.min(100,(Number(selected.max_file_size_bytes)||104857600)/1048576):100'));
 edit('app/screens-admin-documents.jsx',s=>s.replaceAll('||10485760)','||104857600)'));
 edit('scripts/build-bundle.js',s=>replace(s,"  'document-integration.js',","  'document-transfer.js', 'document-integration.js',"));
 edit('supabase/functions/_shared/document-integration.mjs',s=>{
  const start=s.indexOf('async function verifyObject('),end=s.indexOf('\nexport function documentError',start);assert(start>=0&&end>start);
  s="import {verifyStoredDocument} from './document-stream.mjs';\n"+s.slice(0,start)+"async function verifyObject(service,descriptor,verify,options){return verifyStoredDocument(service,descriptor,options);}"+s.slice(end);
  s=s.replaceAll('verifyObject(service,d,verify);receipts.push','verifyObject(service,d,verify,{existingRead:true});receipts.push');
  s=replace(s,'await verifyObject(service,d,verify);const receipt=await verifyObject(service,d,verify);','const receipt=await verifyObject(service,d,verify);');
  s=s.replaceAll('...await verifyObject(service,d,verify),document_id','...await verifyObject(service,d,verify,{existingRead:true}),document_id');
  return s;
 });
 edit('supabase/functions/document-operation/index.ts',s=>s.replace("import {candidateDocumentVerifier} from '../_shared/document-verifier-runtime.ts';\n",'').replace('const verify=await candidateDocumentVerifier();','const verify=null;'));
 edit('supabase/functions/document-access/index.ts',s=>replace(replace(s,"const [{documentAccess},{candidateDocumentVerifier}]=await Promise.all([import('../_shared/document-integration.mjs'),import('../_shared/document-verifier-runtime.ts')]);","const {documentAccess}=await import('../_shared/document-integration.mjs');"),'documentAccess(body,user,service,await candidateDocumentVerifier())','documentAccess(body,user,service,null)'));
 edit('supabase/functions/financial-legacy/index.ts',s=>replace(replace(s,"const [{verifiedFinancialDocumentRpc},{candidateDocumentVerifier}]=await Promise.all([import('../_shared/document-integration.mjs'),import('../_shared/document-verifier-runtime.ts')]);","const {verifiedFinancialDocumentRpc}=await import('../_shared/document-integration.mjs');"),'verifiedFinancialDocumentRpc(userClient,privileged,name,args,await candidateDocumentVerifier())','verifiedFinancialDocumentRpc(userClient,privileged,name,args,null)'));
 const prior=json(path.join(C.root,'docs/qa/evidence/loan-authorization-order/deployed.json'));for(const f of prior.files.filter(x=>!x.file.startsWith('_shared/')&&x.file!=='financial-legacy/index.ts')){const b=fs.readFileSync(path.join(C.root,'.tmp/loan-authorization-order/candidate/supabase/functions',f.file));assert.equal(C.sha(b),f.sha256);save(path.join(candidate,'supabase/functions',f.file),b);}
 const esbuild=require(path.join(area,'deps/node_modules/esbuild'));await esbuild.build({entryPoints:[path.join(candidate,'app/document-transfer-source.mjs')],outfile:path.join(candidate,'app/document-transfer.js'),bundle:true,minify:true,format:'iife',platform:'browser',target:'es2020',nodePaths:[path.join(area,'deps/node_modules')],legalComments:'inline'});
 for(const slug of ['document-operation','document-access','financial-legacy']){const meta=JSON.parse(await remote('/functions/'+slug));const artifact=await remote('/functions/'+slug+'/body');save(path.join(area,'edge-before',slug+'.json'),meta);save(path.join(area,'edge-before',slug+'.eszip'),artifact);}
 console.log('CANDIDATE_PREPARED');
}
function sql(){
 const functions=json(path.join(area,'functions-before.json')),config=json(path.join(area,'config-before.json'));
 const change=[];for(const f of functions){let after=f.definition;
  if(/^(prepare_document_operation|save_document_type_configuration|register_affiliate_document|register_admin_affiliate_document)\(/.test(f.signature))after=after.replaceAll('10485760','104857600');
  if(f.signature.startsWith('prepare_document_submission('))after=replace(replace(after,"  if p_function='create_validated_financial_program_request' then\n",''),"  else\n   d:=document_evidence_private.lock_document(id);\n  end if;",'');
  if(f.signature.startsWith('complete_document_financial_submission('))after=replace(replace(after," if o.function_name='create_validated_financial_program_request' then\n",''),"  end loop;\n end if;\n -- Dispatch",'  end loop;\n -- Dispatch');
  if(after!==f.definition)change.push({...f,after});
 }
 const enroll=change.find(f=>f.signature.startsWith('complete_document_financial_submission')).after.match(/ -- Only the loan path[\s\S]*?(?= -- Dispatch)/)[0].replace(' -- Only the loan path enrolls existing files, after all service receipts pass.',' -- Enroll canonical existing files only after all server byte receipts pass.');
 const nonfinancial=functions.find(f=>f.signature.startsWith('complete_document_submission('));assert(nonfinancial);change.push({...nonfinancial,after:replace(replace(nonfinancial.definition,'v_result jsonb;matches integer;','v_result jsonb;matches integer;doc public.affiliate_documents;asset public.private_assets;'),'if o.completed_at is not null then return o.result;end if;','if o.completed_at is not null then return o.result;end if;\n'+enroll)});
 const constraints=config.constraints.filter(c=>['assets_size_check','operations_size_check','document_types_max_file_check'].includes(c.conname));assert.equal(constraints.length,3);
 const start="-- Explicit owner authorization: 100 MiB existing and new documents.\nBEGIN;\nSET LOCAL lock_timeout='2s';\nSET LOCAL statement_timeout='60s';\n";
 const q=s=>"'"+s.replaceAll("'","''")+"'";
 function defs(reverse){return change.map(f=>{const before=reverse?f.after:f.definition,after=reverse?f.definition:f.after;return `DO $guard$ BEGIN IF md5(pg_get_functiondef(${q(f.signature)}::regprocedure))<>${q(md5(before))} THEN RAISE EXCEPTION 'DOCUMENT_FUNCTION_DRIFT';END IF;EXECUTE $definition$${after}$definition$;END $guard$;\n`;}).join('');}
 function checks(reverse){return constraints.map(c=>{const before=reverse?c.definition.replaceAll('10485760','104857600'):c.definition,after=reverse?c.definition:c.definition.replaceAll('10485760','104857600');return `DO $guard$ BEGIN IF (SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid=${q(c.table_name)}::regclass AND conname=${q(c.conname)}) IS DISTINCT FROM ${q(before)} THEN RAISE EXCEPTION 'DOCUMENT_CONSTRAINT_DRIFT';END IF;END $guard$;\nALTER TABLE ${c.table_name} DROP CONSTRAINT ${c.conname};\nALTER TABLE ${c.table_name} ADD CONSTRAINT ${c.conname} ${after};\n`;}).join('');}
 save(migration,start+checks(false)+defs(false)+"ALTER TABLE public.document_types ALTER COLUMN max_file_size_bytes SET DEFAULT 104857600;\nUPDATE public.document_types SET max_file_size_bytes=104857600 WHERE max_file_size_bytes<104857600;\nUPDATE storage.buckets SET file_size_limit=104857600 WHERE id IN('private-assets','documents','generated-documents');\nCOMMIT;\n");
 save(recovery,start+"DO $guard$ BEGIN IF EXISTS(SELECT 1 FROM document_lab_integrity.assets WHERE size>10485760) OR EXISTS(SELECT 1 FROM document_lab_integrity.operations WHERE size>10485760) THEN RAISE EXCEPTION 'RETAIN_ACCEPTED_DOCUMENTS';END IF;END $guard$;\n"+config.types.map(t=>`UPDATE public.document_types SET max_file_size_bytes=${t.max_file_size_bytes} WHERE id=${q(t.id)} AND max_file_size_bytes=104857600;\n`).join('')+checks(true)+defs(true)+"ALTER TABLE public.document_types ALTER COLUMN max_file_size_bytes SET DEFAULT 10485760;\n"+config.buckets.filter(b=>['private-assets','documents','generated-documents'].includes(b.id)).map(b=>`UPDATE storage.buckets SET file_size_limit=${b.file_size_limit||'NULL'} WHERE id=${q(b.id)};\n`).join('')+'COMMIT;\n');
 save(path.join(area,'sql-changes.json'),change);save(path.join(C.root,'scripts/fixtures/document-100mb-before.json'),{functions:change.map(({after,...x})=>x),constraints,types:config.types,buckets:config.buckets.filter(b=>['private-assets','documents','generated-documents'].includes(b.id))});console.log('SQL_PREPARED '+change.length+' functions');
}
module.exports={C,fs,path,area,candidate,baseline,evidence,save,read,json,replace,body,migration,recovery,remote};
if(require.main===module)(async()=>{if(process.argv[2]==='prepare')throw Error('ARCHIVED_INITIAL_PREPARATION_USE_FINAL_PUBLISHED_SOURCES');else if(process.argv[2]==='sql')sql();else throw Error('MODE_REQUIRED');})().catch(e=>{console.error(JSON.stringify({status:'FAIL',error:e.message,stack:e.stack}));process.exitCode=1;});
