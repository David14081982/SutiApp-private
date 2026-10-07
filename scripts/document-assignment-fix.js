'use strict';
// Focused, guarded transport. Never logs tokens, identities, signatures or document contents.
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),crypto=require('crypto'),cp=require('child_process'),vm=require('vm');
const root=path.resolve(__dirname,'..'),workspace=path.resolve(root,'../../..'),privateDir=path.resolve(root,'../private'),out=path.join(root,'docs/qa/evidence/document-assignment-fix');
const read=f=>fs.readFileSync(f,'utf8').replace(/\r\n/g,'\n'),put=(f,s)=>{fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,s);},sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const env={};for(const line of read(process.env.SUTIAPP_ENV_FILE||path.join(workspace,'supabase.env')).replace(/^\uFEFF/,'').split(/\r?\n/)){const m=line.match(/^([A-Z0-9_]+)=(.*)$/);if(m)env[m[1]]=m[2].trim().replace(/^['"]|['"]$/g,'');}
const api='https://api.supabase.com/v1/projects/'+new URL(env.SUPABASE_URL).hostname.split('.')[0];
const mode=process.argv[2],version='20261007000200',migration='document_assignment_consistency';
function proof(name,data){put(path.join(out,name+'.json'),JSON.stringify(data,null,2)+'\n');console.log(JSON.stringify(data));}
async function management(route,options={}){const r=await fetch(api+route,{...options,headers:{Authorization:'Bearer '+env.SUPABASE_ACCESS_TOKEN,...options.headers},signal:AbortSignal.timeout(60000)});if(!r.ok){await r.body?.cancel();throw Error('MANAGEMENT_HTTP_'+r.status);}return r;}
async function query(query,write=false){const r=await management('/database/query',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({query,read_only:!write})});return r.json();}
const stateQuery=`select jsonb_build_object(
 'captured_at',now(),
 'record_count',(select count(*) from document_private.records),
 'records_sha',(select md5(coalesce(jsonb_agg(to_jsonb(r) order by id)::text,'[]')) from document_private.records r),
 'other_assignments_sha',(select md5(coalesce(jsonb_agg(to_jsonb(a) order by id)::text,'[]')) from document_private.layout_activations a where program<>'membership'),
 'other_configs_sha',(select md5(coalesce(jsonb_agg(to_jsonb(c) order by id)::text,'[]')) from document_private.configurations c where program<>'membership'),
 'default_template',(select template_id from document_private.template_default where id),
 'membership',(select jsonb_build_object('configuration_id',c.id,'template_id',c.template_id,'follow_active',c.follow_active,'valid_from',c.valid_from,'valid_until',c.valid_until,'signers',c.signers) from document_private.configurations c where program='membership' and document_type='MEMBERSHIP_APPROVAL' order by created_at desc,id desc limit 1),
 'assignment',(select jsonb_build_object('id',a.id,'layout_id',a.layout_id,'template_id',l.template_id,'definition_sha',md5(l.definition::text),'version',l.version) from document_private.layout_activations a left join document_private.layouts l on l.id=a.layout_id where a.program='membership' and a.document_type='MEMBERSHIP_APPROVAL' and a.fund_key='' order by a.created_at desc,a.id desc limit 1),
 'functions',(select jsonb_agg(jsonb_build_object('name',p.proname,'definition',pg_get_functiondef(p.oid),'oid',p.oid,'owner',p.proowner,'acl',p.proacl)) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('document_generation_command','document_layout_context','document_layout_persist')),
 'tracking',exists(select 1 from supabase_migrations.schema_migrations where version='${version}')
) state`;
const state=async()=>(await query(stateQuery))[0].state;
async function historicalState(before){
 assert(/^\d{4}-\d\d-\d\dT[0-9:.+Z-]+$/.test(before.captured_at));
 const [result]=await query(`select count(*) total_count,count(*) filter(where created_at<='${before.captured_at}'::timestamptz) baseline_count,md5(coalesce(jsonb_agg(to_jsonb(r) order by id) filter(where created_at<='${before.captured_at}'::timestamptz),'[]'::jsonb)::text) baseline_sha from document_private.records r`);
 assert.equal(+result.baseline_count,before.record_count,'HISTORICAL_COUNT_CHANGED');assert.equal(result.baseline_sha,before.records_sha,'HISTORICAL_CONTENT_CHANGED');return result;
}
const edgeNames=['index.ts','renderer.mjs','layout.mjs','render-layout.mjs','layout-service.mjs'];
const edgeSources=()=>Object.fromEntries(edgeNames.map(n=>[n,read(path.join(root,'supabase/functions/document-generation',n))]));
function modules(body){
 let p=0;const take=n=>{assert(n>=0&&p+n<=body.length);const b=body.subarray(p,p+n);p+=n;return b;},u32=()=>take(4).readUInt32BE(),str=()=>take(u32()).toString();
 assert.equal(take(8).toString(),'ESZIP2.3');assert.equal(take(u32()).toString('hex'),'00000100');
 const end=p+4+body.readUInt32BE(p),entries=[];u32();
 while(p<end){const name=str(),kind=take(1)[0];if(kind===0)entries.push({name,offset:u32(),length:u32(),mapOffset:u32(),mapLength:u32(),kind:take(1)[0]});else if(kind===1)str();else throw Error('ESZIP_KIND');}
 assert.equal(p,end);assert.equal(u32(),0);const sources=take(u32()),maps=take(u32());assert.equal(p,body.length);
 const all=Object.fromEntries(entries.map(e=>[e.name,e.mapLength?JSON.parse(maps.subarray(e.mapOffset,e.mapOffset+e.mapLength).toString()).sourcesContent?.[0]||sources.subarray(e.offset,e.offset+e.length).toString():sources.subarray(e.offset,e.offset+e.length).toString()]));
 return Object.fromEntries(edgeNames.map(n=>{const key=Object.keys(all).find(k=>k==='source/'+n||k.endsWith('/document-generation/'+n));assert(key,'MODULE_MISSING_'+n);return[n,all[key].replace(/\r\n/g,'\n')];}));
}
const deployedSources=async()=>modules(Buffer.from(await(await management('/functions/document-generation/body')).arrayBuffer()));
function testGate(){
 const db=JSON.parse(read(path.join(out,'database-tests.json'))),browser=JSON.parse(read(path.join(out,'browser.json')));
 assert.equal(db.status,'PASS');assert.equal(browser.status,'PASS');
 for(const [file,hash] of Object.entries(db.sourceHashes))assert.equal(sha(fs.readFileSync(path.join(root,file))),hash,'TEST_SOURCE_CHANGED_'+file);
 for(const n of edgeNames)assert(db.sourceHashes['supabase/functions/document-generation/'+n],'MISSING_EDGE_TEST_HASH_'+n);
 assert.equal(sha(fs.readFileSync(path.join(root,'app/screens-admin-document-generation.jsx'))),browser.sourceSha256,'BROWSER_SOURCE_CHANGED');
}
async function login(){const r=await fetch(env.SUPABASE_URL+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:env.SUPABASE_PUBLISHABLE_KEY,'Content-Type':'application/json'},body:JSON.stringify({email:env.H005_TEST_EMAIL,password:env.H005_TEST_PASSWORD}),signal:AbortSignal.timeout(30000)});assert(r.ok,'CONTROLLED_LOGIN_FAILED');const session=await r.json();return {apikey:env.SUPABASE_PUBLISHABLE_KEY,Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'};}
async function edge(headers,body){const r=await fetch(env.SUPABASE_URL+'/functions/v1/document-generation',{method:'POST',headers,body:JSON.stringify(body),signal:AbortSignal.timeout(60000)});if(!r.ok){const data=await r.json().catch(()=>({}));const code=/^DOCUMENT_[A-Z0-9_]+$/.test(data.error)?data.error:'EDGE_HTTP_'+r.status;throw Error(code);}return r;}
async function command(headers,action,data={}){const r=await fetch(env.SUPABASE_URL+'/rest/v1/rpc/document_generation_command',{method:'POST',headers,body:JSON.stringify({p_action:action,p_data:data}),signal:AbortSignal.timeout(30000)});assert(r.ok,'COMMAND_HTTP_'+r.status);return r.json();}
async function main(){
 if(mode==='inspect-records'){
  const before=JSON.parse(read(path.join(privateDir,'before.json'))),result=await historicalState(before);
  const newDocuments=await query(`select document_type,status,document_snapshot#>>'{operation,program}' program,document_snapshot#>>'{template,id}' template_id,document_snapshot#>>'{layout,id}' layout_id,count(*) count from document_private.records where created_at>'${before.captured_at}'::timestamptz group by 1,2,3,4,5`);
  proof('concurrent-records',{status:'PASS',baselineRows:+result.baseline_count,totalRows:+result.total_count,originalRowsUnchanged:true,newRows:+result.total_count-before.record_count,newDocuments});return;
 }
 if(mode==='pages'){
  const built=JSON.parse(read(path.join(out,'build.json'))),site=path.resolve(root,'../site-'+built.version);
  cp.execFileSync(process.execPath,[path.join(root,'scripts/build-pages-site.js'),site],{cwd:root,env:{...process.env,SUTIAPP_SUPABASE_URL:env.SUPABASE_URL,SUTIAPP_SUPABASE_PUBLISHABLE_KEY:env.SUPABASE_PUBLISHABLE_KEY},stdio:'pipe',windowsHide:true});
  assert.equal(sha(fs.readFileSync(path.join(site,'app/bundle.js'))),built.bundleSha);proof('pages-build',{status:'PASS',version:built.version,bundleSha:built.bundleSha});return;
 }
 if(mode==='inspect'){
  const before=await state();assert(!before.tracking,'ALREADY_INSTALLED');assert.equal(before.membership.template_id,'b1de3f1a-368d-40a8-ac4f-05e296d2d99a','MEMBERSHIP_SELECTION_CHANGED');assert.equal(before.assignment.layout_id,'59b76193-0e96-404c-aec1-cba74089d6b1','MEMBERSHIP_ASSIGNMENT_CHANGED');
  put(path.join(privateDir,'before.json'),JSON.stringify(before,null,2));
  const info=await(await management('/functions/document-generation')).json();put(path.join(privateDir,'edge-metadata-before.json'),JSON.stringify(info,null,2));
  const body=await management('/functions/document-generation/body');put(path.join(privateDir,'edge-body-before.bin'),Buffer.from(await body.arrayBuffer()));
  proof('baseline',{status:'PASS',recordCount:before.record_count,recordsSha:before.records_sha,otherAssignmentsSha:before.other_assignments_sha,otherConfigsSha:before.other_configs_sha,defaultTemplate:before.default_template,memberLayoutVersion:before.assignment.version,edgeVersion:info.version});return;
 }
 if(mode==='preview-before'){
  const before=JSON.parse(read(path.join(privateDir,'before.json'))),headers=await login();
  const manifest=await(await edge(headers,{action:'LAYOUT_MANIFEST',program:'membership',document_type:'MEMBERSHIP_APPROVAL',version_id:before.assignment.layout_id,template_id:before.membership.template_id})).json();
  const current=manifest.versions.find(v=>v.id===before.assignment.layout_id);assert(current,'SOURCE_LAYOUT_MISSING');
  const response=await edge(headers,{action:'LAYOUT_PREVIEW',program:'membership',document_type:'MEMBERSHIP_APPROVAL',version_id:current.id,template_id:before.membership.template_id,definition:current.definition});
  const bytes=Buffer.from(await response.arrayBuffer());assert.equal(bytes.subarray(0,5).toString(),'%PDF-');put(path.join(privateDir,'membership-candidate.pdf'),bytes);
  proof('candidate-preview',{status:'PASS',syntheticOnly:true,bytes:bytes.length,pdfSha:sha(bytes),sameDefinition:true,targetTemplate:before.membership.template_id,sourceElements:current.definition.elements.length});return;
 }
 if(mode==='build'){
  const file='screens-admin-document-generation.jsx',bundlePath=path.join(root,'app/bundle.js'),bundle=read(bundlePath),parts=[...bundle.matchAll(/\/\* @@file ([^\n]+) \*\/\n[\s\S]*?(?=\/\* @@file |$)/g)];assert.equal(parts.map(p=>p[0]).join(''),bundle);assert.equal(parts.filter(p=>p[1]===file).length,1);
  const box={};vm.createContext(box);vm.runInContext(read('C:/tmp/babel-standalone-7.29.0.min.js'),box);const code=box.Babel.transform(read(path.join(root,'app',file)),{presets:['react'],filename:file}).code;
  const updated=parts.map(p=>p[1]===file?'/* @@file '+file+' */\n(function(){\n'+code+'\n})();\n':p[0]).join('');new vm.Script(updated);put(bundlePath,updated);
  const html=read(path.join(root,'SutiApp.html')),sw=read(path.join(root,'sw.js'));const ver=Math.max(...[...html.matchAll(/(?:bundle\.js\?v=|sw\.js\?v=)(\d+)/g),...sw.matchAll(/(?:sutiapp-v|bundle\.js\?v=)(\d+)/g)].map(m=>+m[1]))+1;
  for(const [f,s] of [['SutiApp.html',html],['sw.js',sw]])put(path.join(root,f),s.replace(/(app\/bundle\.js\?v=|sw\.js\?v=|sutiapp-v)\d+/g,(_,p)=>p+ver));
  proof('build',{status:'PASS',version:ver,bundleSha:sha(updated),changedChunks:[file],unrelatedChunksPreserved:parts.length-1,workerLogicChanged:false});
  return;
 }
 if(mode==='bundle'||mode==='deploy-edge'){
  testGate();const sources=edgeSources(),fingerprint=sha(JSON.stringify(sources)),baseline=modules(fs.readFileSync(path.join(privateDir,'edge-body-before.bin'))),live=await deployedSources();assert.deepEqual(live,baseline,'DEPLOYED_SOURCE_DRIFT');
  for(const n of ['renderer.mjs','layout.mjs','render-layout.mjs'])assert.equal(sources[n],baseline[n],'UNRELATED_RENDERER_CHANGED');
  const metadata=await(await management('/functions/document-generation')).json();assert.equal(metadata.verify_jwt,false);
  if(mode==='deploy-edge'){const compiled=JSON.parse(read(path.join(out,'bundle.json')));assert.equal(compiled.status,'PASS');assert.equal(compiled.fingerprint,fingerprint,'SOURCE_CHANGED_AFTER_COMPILE');}
  const form=new FormData();form.append('metadata',JSON.stringify({name:'document-generation',entrypoint_path:'index.ts',verify_jwt:false}));
  for(const [file,source] of Object.entries(sources))form.append('file',new Blob([source],{type:file.endsWith('.ts')?'application/typescript':'application/javascript'}),file);
  await management('/functions/deploy?slug=document-generation'+(mode==='bundle'?'&bundleOnly=true':''),{method:'POST',body:form});
  const after=await(await management('/functions/document-generation')).json();assert.equal(after.version,metadata.version+(mode==='bundle'?0:1));assert.equal(after.verify_jwt,metadata.verify_jwt);assert.deepEqual(await deployedSources(),mode==='bundle'?baseline:sources,'SOURCE_READBACK');
  proof(mode,{status:'PASS',edgeVersion:after.version,files:edgeNames,fingerprint,sourceHashes:Object.fromEntries(Object.entries(sources).map(([n,s])=>[n,sha(s)])),unchangedRendererModules:3,readbackVerified:true,secretChanges:0});return;
 }
 if(mode==='apply-schema'){
  testGate();
  const before=JSON.parse(read(path.join(privateDir,'before.json'))),current=await state();assert(!current.tracking);for(const f of before.functions){const actual=current.functions.find(x=>x.name===f.name);assert.equal(actual.definition,f.definition,'FUNCTION_DRIFT');assert.deepEqual(actual.acl,f.acl);}
  const sql=read(path.join(root,'supabase/migrations',version+'_'+migration+'.sql'));
  await query(sql.replace(/commit;\s*$/i,`insert into supabase_migrations.schema_migrations(version,name,statements) values('${version}','${migration}',array['H-DOCUMENT-ASSIGNMENT-FIX-001 sha256:${sha(sql)}']);commit;`),true);
  const after=await state();for(const f of before.functions){const actual=after.functions.find(x=>x.name===f.name);assert.deepEqual(actual.acl,f.acl);assert.equal(actual.oid,f.oid);assert.equal(actual.owner,f.owner);}assert.equal(after.records_sha,current.records_sha);assert.equal(after.other_assignments_sha,current.other_assignments_sha);assert.equal(after.other_configs_sha,current.other_configs_sha);
  proof('schema-applied',{status:'PASS',version,migrationSha:sha(sql),oidOwnerAclPreserved:true,recordsPreserved:true,assignmentsPreserved:true});return;
 }
 if(mode==='fix-membership'){
  testGate();
  assert.equal(JSON.parse(read(path.join(out,'schema-applied.json'))).status,'PASS');assert.equal(JSON.parse(read(path.join(out,'deploy-edge.json'))).status,'PASS');
  const current=await state(),before=JSON.parse(read(path.join(privateDir,'before.json')));assert.equal(current.assignment.id,before.assignment.id,'ASSIGNMENT_DRIFT');assert.equal(current.membership.configuration_id,before.membership.configuration_id,'CONFIG_DRIFT');
  const payload={action:'LAYOUT_CONFIGURE',program:'membership',document_type:'MEMBERSHIP_APPROVAL',fund_key:'',id:crypto.randomUUID(),expected_configuration_id:current.membership.configuration_id,expected_assignment_id:current.assignment.id,template_id:current.membership.template_id,signers:current.membership.signers,valid_from:current.membership.valid_from,valid_until:current.membership.valid_until};
  put(path.join(privateDir,'membership-operation.json'),JSON.stringify(payload,null,2));const headers=await login();
  const preview=await edge(headers,{...payload,action:'LAYOUT_CONFIGURE_PREVIEW'});assert.equal(Buffer.from(await preview.arrayBuffer()).subarray(0,5).toString(),'%PDF-');
  const result=await(await edge(headers,payload)).json();const retry=await(await edge(headers,payload)).json();assert.deepEqual(retry,result,'RETRY_MISMATCH');
  const after=await state();assert.equal(after.assignment.template_id,current.membership.template_id);assert.equal(after.assignment.definition_sha,current.assignment.definition_sha,'ELEMENTS_CHANGED');assert.equal(after.other_assignments_sha,current.other_assignments_sha);assert.equal(after.other_configs_sha,current.other_configs_sha);assert.equal(after.records_sha,current.records_sha);assert.equal(after.default_template,current.default_template);assert.deepEqual(after.membership.signers,current.membership.signers);
  const dash=await command(headers,'DASHBOARD'),a=dash.layout_assignments.find(x=>x.program==='membership'&&x.document_type==='MEMBERSHIP_APPROVAL'&&!x.fund_key);assert.equal(a.template_id,current.membership.template_id);
  proof('membership-corrected',{status:'PASS',newLayoutVersion:after.assignment.version,templateName:a.template_name,elementsUnchanged:true,signersUnchanged:true,otherProgramsUnchanged:true,historicalRecordsUnchanged:true,defaultTemplateUnchanged:true,retryIdempotent:true,recordCount:after.record_count,reissuedDocuments:0});return;
 }
 if(mode==='verify'){
  testGate();const live=await state(),before=JSON.parse(read(path.join(privateDir,'before.json')));assert(live.tracking);assert.equal(live.assignment.template_id,before.membership.template_id);assert.equal(live.assignment.definition_sha,before.assignment.definition_sha);assert.equal(live.other_assignments_sha,before.other_assignments_sha);assert.equal(live.other_configs_sha,before.other_configs_sha);const history=await historicalState(before);assert.equal(live.default_template,before.default_template);assert.deepEqual(await deployedSources(),edgeSources());
  const anon=await fetch(env.SUPABASE_URL+'/functions/v1/document-generation',{method:'POST',headers:{apikey:env.SUPABASE_PUBLISHABLE_KEY,'Content-Type':'application/json'},body:JSON.stringify({action:'LAYOUT_CONFIGURE_PREVIEW',program:'membership',document_type:'MEMBERSHIP_APPROVAL'}),signal:AbortSignal.timeout(30000)});assert.equal(anon.status,401);await anon.body?.cancel();
  const dash=await command(await login(),'DASHBOARD');const effective=dash.layout_assignments.find(a=>a.program==='membership'&&a.document_type==='MEMBERSHIP_APPROVAL'&&!a.fund_key);assert.equal(effective.template_id,before.membership.template_id);
  proof('production-verified',{status:'PASS',templateName:effective.template_name,layoutVersion:effective.layout_version||live.assignment.version,recordCount:+history.total_count,historicalRecordCount:+history.baseline_count,historicalRecordsSha:history.baseline_sha,concurrentNewRecords:+history.total_count-before.record_count,historicalRecordsPreserved:true,otherProgramsPreserved:true,rendererModulesPreserved:true,sourceReadback:true,anonymousStatus:anon.status,configurationWrites:0,reissuedDocuments:0});return;
 }
 throw Error('MODE_INVALID');
}
main().catch(e=>{console.error(e.code==='ERR_ASSERTION'?e.message:String(e.message).split('\n')[0]);process.exitCode=1;});
