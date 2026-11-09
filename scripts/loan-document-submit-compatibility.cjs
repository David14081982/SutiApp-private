'use strict';
const R=require('./loan-document-submit.cjs'),{C,save,area,evidence}=R,assert=require('node:assert/strict');
const candidate=C.path.join(area,'candidate'),v='20261109000400';
const sizeMigration=C.path.join(C.root,'supabase/migrations/prepared/loan-document-submit/'+v+'_loan_existing_document_size.sql');
const sizeRecovery=C.path.join(C.root,'supabase/recovery/prepared/loan-document-submit/'+v+'_loan_existing_document_size.sql');
const prior=()=>JSON.parse(C.fs.readFileSync(C.path.join(C.root,'docs/qa/evidence/loan-authorization-order/deployed.json')));
const json=p=>JSON.parse(C.fs.readFileSync(p));
const runtime='financial-legacy/loan-document-verification.mjs';
const files=()=>[...prior().files.map(({file})=>file),runtime].map(file=>({file,sha256:C.sha(C.fs.readFileSync(C.path.join(candidate,'supabase/functions',file)))}));
async function remote(suffix,options={}){const env=C.environment(),res=await fetch('https://api.supabase.com/v1/projects/'+new URL(env.SUPABASE_URL).hostname.split('.')[0]+suffix,{...options,headers:{Authorization:'Bearer '+env.SUPABASE_ACCESS_TOKEN,...options.headers},signal:AbortSignal.timeout(120000)});if(!res.ok)throw Error('MANAGEMENT_HTTP_'+res.status);return Buffer.from(await res.arrayBuffer());}
async function prepare(){
 for(const f of prior().files){const cached=C.path.join(C.root,'.tmp/loan-authorization-order/candidate/supabase/functions',f.file);const bytes=C.fs.readFileSync(C.fs.existsSync(cached)?cached:C.path.join(C.root,'supabase/functions',f.file));assert.equal(C.sha(bytes),f.sha256);save(C.path.join(candidate,'supabase/functions',f.file),bytes.toString());}
 save(C.path.join(candidate,'supabase/functions',runtime),C.fs.readFileSync(C.path.join(C.root,'supabase/functions/prepared/loan-document-submit/loan-document-verification.mjs'),'utf8'));
 const index=C.path.join(candidate,'supabase/functions/financial-legacy/index.ts'),before=C.fs.readFileSync(index,'utf8');
 const from='return verifiedFinancialDocumentRpc(userClient,privileged,name,args,await candidateDocumentVerifier());';assert.equal(before.split(from).length,2);
 const after='import { loanSubmissionVerifier } from "./loan-document-verification.mjs";\n'+before.replace(from,'return verifiedFinancialDocumentRpc(userClient,privileged,name,args,loanSubmissionVerifier(await candidateDocumentVerifier(),name));');save(index,after);
 const metadata=JSON.parse(await remote('/functions/financial-legacy'));assert.equal(metadata.version,71);assert.equal(metadata.verify_jwt,true);
 const artifact=await remote('/functions/financial-legacy/body');
 const previous=json(C.path.join(C.root,'docs/qa/evidence/loan-authorization-order/deployed-source.json'));assert.equal(C.sha(artifact),previous.artifactSha256);
 C.fs.writeFileSync(C.path.join(area,'financial-v71.eszip'),artifact);save(C.path.join(area,'edge-baseline.json'),metadata);
 save(C.path.join(evidence,'compatibility-prepared.json'),{status:'PASS',baselineVersion:71,artifactSha256:C.sha(artifact),files:files(),sizeMigrationSha256:C.sha(C.fs.readFileSync(sizeMigration))});console.log('PREPARED');
}
async function sizeDeploy(){assert.equal(process.env.SUTIAPP_APPROVE_EXISTING_PRIVATE_SIZE,'100_MIB','EXPLICIT_OWNER_APPROVAL_REQUIRED');const tests=json(C.path.join(evidence,'tests.json'));assert.equal(tests.status,'PASS');assert.equal(tests.sizeMigrationSha256,C.sha(C.fs.readFileSync(sizeMigration)));
 const db=C.connection(C.environment(),{readonly:false});await db.connect();try{
  await db.query('begin');await db.query("set local lock_timeout='2s'");await db.query('lock table document_lab_integrity.assets in access exclusive mode');
  const fingerprint=async()=>(await db.query("select count(*)::int count,md5(coalesce(string_agg(to_jsonb(t)::text,'' order by id),'')) hash from document_lab_integrity.assets t")).rows[0];
  const before=await fingerprint();await db.query(R.body(sizeMigration));assert.deepEqual(await fingerprint(),before);
  await db.query('insert into supabase_migrations.schema_migrations(version,name,statements) values($1,$2,$3)',[v,'loan_existing_document_size',[C.fs.readFileSync(sizeMigration,'utf8')]]);await db.query('commit');
  const definition=(await db.query("select pg_get_constraintdef(oid) definition from pg_constraint where conrelid='document_lab_integrity.assets'::regclass and conname='assets_size_check'")).rows[0].definition;
  save(C.path.join(evidence,'compatibility-database.json'),{status:'PASS',version:v,definition,migrationSha256:C.sha(C.fs.readFileSync(sizeMigration)),existingRowsUnchanged:before,productionTestRequests:0});console.log('SIZE_DEPLOYED');
 }catch(e){await db.query('rollback');throw e;}finally{await db.end();}
}
async function edge(mode){
 const current=JSON.parse(await remote('/functions/financial-legacy'));assert.equal(current.version,71);assert.equal(current.verify_jwt,true);
 assert.equal(C.sha(await remote('/functions/financial-legacy/body')),C.sha(C.fs.readFileSync(C.path.join(area,'financial-v71.eszip'))));
 const entries=files(),prepared=json(C.path.join(evidence,'compatibility-prepared.json'));assert.deepEqual(entries,prepared.files);
 assert.equal(json(C.path.join(evidence,'tests.json')).status,'PASS');
 if(mode==='deploy'){assert.equal(json(C.path.join(evidence,'compatibility-database.json')).status,'PASS');assert.deepEqual(json(C.path.join(evidence,'edge-compile.json')).files,entries);}
 const form=new FormData();form.append('metadata',JSON.stringify({name:'financial-legacy',slug:'financial-legacy',entrypoint_path:'financial-legacy/index.ts',verify_jwt:true}));
 for(const f of entries){const source=C.fs.readFileSync(C.path.join(candidate,'supabase/functions',f.file),'utf8');for(const[key,value]of Object.entries(C.environment()))if(value&&value.length>10&&/PASSWORD|SECRET|SERVICE_ROLE|ACCESS_TOKEN/i.test(key))assert(!source.includes(value));form.append('file',new Blob([source],{type:f.file.endsWith('.ts')?'application/typescript':'application/javascript'}),f.file);}
 const result=JSON.parse(await remote('/functions/deploy?slug=financial-legacy'+(mode==='compile'?'&bundleOnly=true':''),{method:'POST',body:form}));save(C.path.join(area,'edge-'+mode+'-receipt.json'),result);
 const after=JSON.parse(await remote('/functions/financial-legacy'));assert.equal(after.version,mode==='compile'?71:result.version);assert.equal(after.verify_jwt,true);
 const report={status:'PASS',version:after.version,previousVersion:71,files:entries,compileOnly:mode==='compile'};
 if(mode==='deploy'){const artifact=await remote('/functions/financial-legacy/body');for(const f of entries)assert(artifact.includes(C.fs.readFileSync(C.path.join(candidate,'supabase/functions',f.file))),'EMBEDDED_SOURCE_MISSING '+f.file);report.artifactSha256=C.sha(artifact);report.embeddedSourcesVerified=entries.length;}
 save(C.path.join(evidence,'edge-'+mode+'.json'),report);console.log(JSON.stringify(report));
}
module.exports={candidate,sizeMigration,sizeRecovery};
if(require.main===module)(async()=>{const mode=process.argv[2];if(mode==='prepare')await prepare();else if(mode==='size-deploy')await sizeDeploy();else if(['compile','deploy'].includes(mode))await edge(mode);else throw Error('MODE_REQUIRED');})().catch(e=>{console.error(JSON.stringify({status:'FAIL',error:e.message}));process.exitCode=1;});
