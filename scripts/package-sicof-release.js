'use strict';
// Isolated frontend release packaging only. Never pushes, applies SQL or calls financial writers.
const fs=require('fs'),path=require('path'),vm=require('vm'),crypto=require('crypto'),cp=require('child_process'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),release=path.join(root,'.tmp/sicof/release'),out=path.join(root,'docs/qa/evidence/sicof');
const focal=['screens-admin.jsx','screens-admin-finanzas.jsx','screens-savings.jsx','savings-runtime-admin.jsx'];
const added=['sicof-repository.js','sicof-payment-behavior.jsx','sicof-admin.jsx','savings-period-breakdown.jsx'];
const runtime=[...focal,...added].map(name=>'app/'+name).concat(['scripts/build-bundle.js','app/bundle.js','SutiApp.html','sw.js']);
const supporting=[
 'scripts/package-sicof-release.js','scripts/test-sicof-release.js','scripts/verify-sicof-ui-live.js',
 'scripts/test-sicof-ui-browser.js','scripts/test-sicof-integration-browser.js','scripts/test-sicof-attribution-browser.js',
 'docs/audits/H-SICOF-FRONTEND-RELEASE.md','docs/audits/H-SICOF-FRONTEND-INDEPENDENT-REVIEW.md',
 'docs/audits/H-SICOF-RELEASE-001.md','docs/audits/H-SICOF-RELEASE-001-ARCHITECT-REVIEW.md',
 'docs/qa/evidence/sicof/ui-contract.json','docs/qa/evidence/sicof/source-manifest.json',
 'supabase/migrations/20261003000100_savings_period_composition.sql',
 'supabase/migrations/20261003000200_sicof_workspace.sql',
 'supabase/migrations/20261003000300_sicof_context_read_performance.sql',
 'supabase/recovery/20261003000100_savings_period_composition.sql',
 'supabase/recovery/20261003000200_sicof_workspace.sql',
 'supabase/recovery/20261003000300_sicof_context_read_performance.sql',
 'supabase/functions/sicof/engine.mjs','supabase/functions/sicof/exports.mjs',
 'supabase/functions/sicof/handler.mjs','supabase/functions/sicof/index.ts',
 'supabase/functions/sicof/loan-calculation.mjs','supabase/functions/sicof/loan-source.mjs','supabase/functions/sicof/projection.mjs',
 'google-apps-script/financial-handoff/Code.gs','google-apps-script/financial-handoff/README.md',
 'scripts/test-sicof-engine.js','scripts/test-sicof-edge.js','scripts/test-sicof-loans.js','scripts/test-sicof-loan-receiver.js',
 'scripts/test-sicof-loan-projection.js','scripts/test-sicof-report-reversals.js','scripts/test-sicof-exports.js',
 'scripts/test-savings-period-composition.js','scripts/test-sicof-workspace.js',
 'scripts/test-sicof-context-performance.js','scripts/fixtures/sicof-context-performance-schema.json',
 'scripts/fixtures/savings-period-composition-schema.json','scripts/fixtures/sicof-workspace-schema.json',
 'docs/audits/H-SICOF-001.md','docs/audits/H-SICOF-PERIOD-COMPOSITION.md','docs/audits/H-SICOF-001-ARCHITECT-REVIEW.md',
 'scripts/release-sicof-backend.js','scripts/release-sicof-google.js','scripts/verify-sicof-live.js',
 ...['preflight','migrations','context-migration','historical-import','historical-download','edge-bundle','edge-deploy','edge-status','edge-surface','source-deltas','ui-live','ui-live-local','ui-live-admin','ui-live-self'].map(name=>'docs/qa/evidence/sicof-release/'+name+'.json'),
 ...['context-performance','context-performance-installed','live-pre','live-post','live-script-versions','production-conservation','google-release-backup','google-release-deployment','google-release-diagnosis','google-release-rollback','google-release-optimization','google-release-verification','google-release-sicof-real-read'].map(name=>'docs/qa/evidence/sicof/'+name+'.json')
];
const metadata='docs/qa/evidence/screen-permissions-20260924/production-metadata.json';
const normativeFiles=['docs/SOURCE_OF_TRUTH.md','docs/AGENT_CHANGELOG.md','docs/DECISIONS.md','docs/MIGRATION_RULES.md','docs/LEGACY_GOOGLE_SYSTEMS.md','docs/SECURITY_RULES.md'];
const governanceFiles=[...normativeFiles,'docs/architecture/architecture-overrides.json',...['SUTIAPP_ARCHITECTURE_REGISTRY.json','registry-code.json','registry-data.json','registry-edges.json','registry-search.json'].map(file=>'docs/architecture/'+file)];
const read=(file,dir=root)=>fs.readFileSync(path.join(dir,file),'utf8');
const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
const normalized=value=>value.replace(/\r\n/g,'\n');
const git=(args)=>cp.execFileSync('git',['-C',release,...args],{encoding:'utf8',maxBuffer:32*1024*1024,windowsHide:true});
const tracked=file=>git(['show','HEAD:'+file]);
const put=(file,value,dir=release)=>{const target=path.join(dir,file);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,value);};
const json=file=>JSON.parse(read(file));
const proof=(file,value)=>{put('docs/qa/evidence/sicof/'+file,JSON.stringify(value,null,2)+'\n',root);if(fs.existsSync(path.join(release,'.git')))put('docs/qa/evidence/sicof/'+file,JSON.stringify(value,null,2)+'\n');};
const parse=value=>value.split(/(?=\/\* @@file )/).filter(Boolean).map(bytes=>{const m=bytes.match(/^\/\* @@file ([^ ]+) \*\//);assert(m,'BUNDLE_MARKER_CHANGED');return{name:m[1],bytes};});
const chunk=(name,code)=>'/* @@file '+name+' */\n(function(){\n'+code+'\n})();\n';
function compiler(){
 const box={};vm.createContext(box);const babelPath=process.env.SUTIAPP_BABEL_PATH||'C:/tmp/babel-standalone-7.29.0.min.js';
 vm.runInContext(fs.readFileSync(babelPath,'utf8'),box);
 return(source,name,babel)=>babel?box.Babel.transform(normalized(source).trimEnd(),{presets:['react'],filename:name}).code:normalized(source).trimEnd();
}
function frozen(){
 const manifest=json('docs/qa/evidence/sicof/source-manifest.json');
 const records=runtime.map(file=>{const entry=manifest.files.find(item=>item.file===file);assert(entry,'MISSING_FROZEN_SOURCE:'+file);assert.equal(hash(fs.readFileSync(path.join(root,file))),entry.sha256,'FROZEN_SOURCE_CHANGED:'+file);return entry;});
 assert.equal(records.find(item=>item.file==='app/bundle.js').sha256,'fe8e56e0e87c9119a613548363e747acaff708284d3e6365385f2316c08e6484','UNREVIEWED_ROOT_CANDIDATE');
 return records;
}
async function inspectLive(){
 const baseline=git(['rev-parse','HEAD']).trim(),expected=tracked('app/bundle.js'),rows=[];
 for(const origin of ['https://sutiapp.com/SutiApp.html','https://david14081982.github.io/SutiApp-private/SutiApp.html']){
  const response=await fetch(origin,{cache:'no-store',signal:AbortSignal.timeout(45000)});assert(response.ok,'PUBLIC_HTML_HTTP_'+response.status);
  const html=await response.text(),src=html.match(/src="(app\/bundle\.js\?v=[^"]+)"/);assert(src,'PUBLIC_BUNDLE_MISSING');
  const bundleResponse=await fetch(new URL(src[1],response.url),{cache:'no-store',signal:AbortSignal.timeout(45000)});assert(bundleResponse.ok);
  const bundle=await bundleResponse.text();assert.equal(hash(normalized(bundle)),hash(normalized(expected)),'MAIN_NOT_PUBLISHED_BASELINE:'+origin);
  rows.push({origin,bundleSha256:hash(bundle),normalizedBundleSha256:hash(normalized(bundle)),bundleVersion:src[1].split('=')[1]});
 }
 const result={status:'PASS',capturedAt:new Date().toISOString(),baselineCommit:baseline,baselineBundleSha256:hash(expected),rows,productionWrites:0};
 proof('frontend-release-live-baseline.json',result);console.log(JSON.stringify(result));
}
function prepare(){
 const frozenFiles=frozen(),baselineCommit=git(['rev-parse','HEAD']).trim(),live=json('docs/qa/evidence/sicof/frontend-release-live-baseline.json');
 assert.equal(live.status,'PASS');assert.equal(live.baselineCommit,baselineCommit);
 const previous=path.join(root,'.tmp/sicof/before'),compile=compiler(),bundle=tracked('app/bundle.js'),old=parse(bundle),approved=parse(read('app/bundle.js')),baseApproved=parse(read('app/bundle.js',previous));
 assert.equal(new Set(old.map(row=>row.name)).size,old.length,'DUPLICATE_BUNDLE_MODULE');
 const modes={},sourceChecks=[];
 for(const name of focal){
  const source=tracked('app/'+name),baselineSource=read('app/'+name,previous);assert.equal(normalized(source),normalized(baselineSource),'FOCAL_REMOTE_SOURCE_DRIFT:'+name);
  const entry=old.find(item=>item.name===name);assert(entry,'REMOTE_MODULE_MISSING:'+name);
  if(entry.bytes===chunk(name,compile(source,name,false)))modes[name]=false;
  else if(entry.bytes===chunk(name,compile(source,name,true)))modes[name]=true;
  else throw Error('REMOTE_SOURCE_BUNDLE_DRIFT:'+name);
  sourceChecks.push({file:'app/'+name,remoteNormalizedSha256:hash(normalized(source)),matchesApprovedPreintegration:true,compiler:modes[name]?'Babel React':'untransformed'});
 }
 for(const name of added)assert(!old.some(row=>row.name===name),'NEW_MODULE_ALREADY_INSTALLED:'+name);
 const manifest=json('docs/qa/evidence/sicof/source-manifest.json'),deltaFile='docs/qa/evidence/sicof-release/source-deltas.json';
 const deltas=fs.existsSync(path.join(root,deltaFile))?json(deltaFile):null;
 if(deltas)assert.equal(deltas.status,'APPROVED','BACKEND_DELTA_NOT_APPROVED');
 for(const row of [...deltas?.additions||[],...deltas?.updatedTests||[]])assert.equal(hash(fs.readFileSync(path.join(root,row.file))),row.sha256,'APPROVED_ADDITIONAL_SOURCE_CHANGED:'+row.file);
 for(const file of supporting){const frozenBackend=manifest.files.find(item=>item.file===file);if(frozenBackend){
  const actual=hash(fs.readFileSync(path.join(root,file))),delta=deltas?.files?.find(item=>item.file===file);
  if(delta){assert.equal(delta.originalSha256,frozenBackend.sha256,'BACKEND_DELTA_BASE_CHANGED:'+file);assert.equal(actual,delta.sha256,'APPROVED_BACKEND_DELTA_CHANGED:'+file);}
  else assert.equal(actual,frozenBackend.sha256,'FROZEN_BACKEND_SOURCE_CHANGED:'+file);
 }}
 const oldFiles=runtime.filter(file=>!added.includes(file.slice(4))),backup=path.join(root,'.tmp/sicof/release-before');
 for(const file of oldFiles){const value=tracked(file);if(fs.existsSync(path.join(backup,file)))assert.equal(read(file,backup),value,'BACKUP_DRIFT:'+file);else put(file,value,backup);}
 const output=added.map(name=>chunk(name,compile(read('app/'+name),name,false))).join('')+
  old.map(entry=>focal.includes(entry.name)?chunk(entry.name,compile(read('app/'+entry.name),entry.name,modes[entry.name])):entry.bytes).join('');
 new vm.Script(output);
 const next=parse(output);
 for(const entry of old)if(!focal.includes(entry.name))assert.equal(next.find(item=>item.name===entry.name).bytes,entry.bytes,'UNRELATED_CHUNK_CHANGED:'+entry.name);
 for(const name of [...focal,...added])put('app/'+name,fs.readFileSync(path.join(root,'app/'+name)));
 put('app/bundle.js',output);
 let builder=tracked('scripts/build-bundle.js');assert.equal(builder.split('const files = [').length,2);
 builder=builder.replace('const files = [',"// H-SICOF-001 integration: private repositories and focal UI dependencies.\nconst files = [\n  'sicof-repository.js', 'sicof-payment-behavior.jsx', 'sicof-admin.jsx', 'savings-period-breakdown.jsx',");
 put('scripts/build-bundle.js',builder);
 const html=tracked('SutiApp.html'),worker=tracked('sw.js'),bundleVersion=Number(html.match(/app\/bundle\.js\?v=(\d+)/)[1])+1;
 const workerVersion=Number(worker.match(/sutiapp-v(\d+)/)[1])+1;
 put('SutiApp.html',html.replace(/app\/bundle\.js\?v=\d+/g,'app/bundle.js?v='+bundleVersion).replace(/sw\.js\?v=\d+/g,'sw.js?v='+workerVersion));
 put('sw.js',worker.replace(/app\/bundle\.js\?v=\d+/g,'app/bundle.js?v='+bundleVersion).replace(/sutiapp-v\d+/g,'sutiapp-v'+workerVersion));
 new vm.Script(read('sw.js',release));
 for(const file of supporting){assert(fs.existsSync(path.join(root,file)),'SUPPORT_FILE_MISSING:'+file);put(file,fs.readFileSync(path.join(root,file)));}
 if(deltas)put(deltaFile,fs.readFileSync(path.join(root,deltaFile)));
 const priorNames=new Set(baseApproved.map(row=>row.name));
 const proofValue={
  status:'PASS',preparedAt:new Date().toISOString(),baselineCommit,originalApprovedBundleSha256:hash(read('app/bundle.js')),
  baselineBundleSha256:hash(bundle),bundleSha256:hash(output),baselineChunks:old.length,candidateChunks:next.length,
  preservedPublishedChunks:old.length-focal.length,changed:focal,added,sourceChecks,frozenFiles,
  remoteDeltaFromApprovedBaseline:{added:old.filter(row=>!priorNames.has(row.name)).map(row=>row.name),changed:old.filter(row=>priorNames.has(row.name)&&row.bytes!==baseApproved.find(item=>item.name===row.name).bytes).map(row=>row.name)},
  sourceCompiler:modes,bundleVersion,workerVersion,generatedCachebustersOnly:true,publicWorkflowUnchanged:true,
  published:false,backendGate:'Await parent BACKEND_PASS and fresh real production metadata before Pages build/push',
  files:[...runtime,...supporting,metadata,...governanceFiles,...(deltas?[deltaFile]:[]),...['frontend-release-live-baseline.json','frontend-release-package.json','frontend-release-verification.json','frontend-release-build.json','frontend-release-contracts.json','frontend-release-global-local.json','frontend-release-governance.json'].map(file=>'docs/qa/evidence/sicof/'+file)],
  approvedBackendDeltas:deltas?.files||[],
  packageFiles:[...runtime,...supporting].map(file=>({file,sha256:hash(fs.readFileSync(path.join(release,file)))}))
 };
 proof('frontend-release-package.json',proofValue);console.log(JSON.stringify({status:proofValue.status,baselineCommit,bundleSha256:proofValue.bundleSha256,preservedPublishedChunks:proofValue.preservedPublishedChunks,sourceCompiler:modes,published:false}));
}
function syncMetadata(){
 const data=json(metadata);assert.equal(data.productionWrites,0,'METADATA_NOT_READONLY');assert(data.sections.some(row=>row.module_key==='sicof'&&row.enforcement_status==='ENFORCED'),'SICOF_NOT_REGISTERED_LIVE');
 assert(data.functions.some(row=>row.schema==='admin_support_private'&&row.name==='module_visible'&&row.definition.includes("'sicof'")),'SICOF_VISIBILITY_NOT_REGISTERED_LIVE');
 put(metadata,fs.readFileSync(path.join(root,metadata)));
 cp.execFileSync(process.execPath,['scripts/screen-permission-contract.js'],{cwd:release,encoding:'utf8',windowsHide:true,stdio:'pipe'});
 console.log(JSON.stringify({status:'PASS',metadataCapturedAt:data.capturedAt,metadataSha256:hash(fs.readFileSync(path.join(release,metadata))),source:'real read-only production catalog',productionWrites:0}));
}
function contractsLive(){
 const env={...process.env};
 for(const line of read('supabase.env').replace(/^\uFEFF/,'').split(/\r?\n/)){const m=line.match(/^(SUPABASE_URL|SUPABASE_PUBLISHABLE_KEY)=(.*)$/);if(m)env['SUTIAPP_'+m[1]]=m[2].trim().replace(/^['"]|['"]$/g,'');}
 const checks=[];
 for(const file of ['scripts/verify-auth-deployment-contract-live.js','scripts/verify-request-submission-deployment-contract-live.js']){
  assert.equal(read(file,release),tracked(file),'DEPLOYMENT_GUARD_CHANGED:'+file);
  const output=cp.execFileSync(process.execPath,[file],{cwd:release,env,encoding:'utf8',windowsHide:true,timeout:60000});
  const result=JSON.parse(output);assert.equal(result.status,'PASS');checks.push({file,result});
 }
 const result={status:'PASS',checkedAt:new Date().toISOString(),checks,productionWrites:0};
 proof('frontend-release-contracts.json',result);console.log(JSON.stringify(result));
}
function governance(){
 const updates=[],sections=[];
 for(const file of normativeFiles){
  const source=normalized(read(file)),heads=[...source.matchAll(/^(#{1,2}) .+$/gm)],own=[];
  for(let i=0;i<heads.length;i++)if(/H-SICOF-(?:001|RELEASE-001)\b/.test(heads[i][0])){
   let end=source.length;for(let j=i+1;j<heads.length;j++)if(heads[j][1].length<=heads[i][1].length){end=heads[j].index;break;}
   own.push(source.slice(heads[i].index,end).trim());
  }
  assert(own.length,'FINAL_SICOF_SECTION_MISSING:'+file);
  const prior=tracked(file);assert(!/H-SICOF-(?:001|RELEASE-001)\b/.test(prior),'REMOTE_ALREADY_HAS_SICOF_GOVERNANCE:'+file);
  updates.push([file,prior.trimEnd()+'\n\n'+own.join('\n\n')+'\n']);sections.push({file,headings:own.map(value=>value.split('\n')[0]),preservedRemotePrefix:true});
 }
 const file='docs/architecture/architecture-overrides.json',prior=tracked(file),current=JSON.parse(prior),source=JSON.parse(read(file));
 const names=new Set(['SicofAdminModule','SicofRepository','sicof','SavingsPeriodBalances','SicofPaymentBehavior']);
 const nodes=source.nodes.filter(node=>names.has(node.name));assert.equal(nodes.length,5,'SICOF_ARCHITECTURE_NODE_DRIFT');
 assert(!current.nodes.some(node=>names.has(node.name)),'REMOTE_ALREADY_HAS_SICOF_OVERRIDES');
 const relationships=source.relationships.filter(edge=>names.has(edge.from)||names.has(edge.to));
 let next=prior;
 for(const [key,values]of [['nodes',nodes],['relationships',relationships]]){const marker='  "'+key+'": [';assert.equal(next.split(marker).length,2);next=next.replace(marker,marker+'\n'+values.map(value=>'    '+JSON.stringify(value)+',').join('\n'));}
 const financePattern=/(\{"domain": "finance", "patterns": \[)([^\]]+)(\]\})/;
 assert(financePattern.test(next),'FINANCE_DOMAIN_PATTERN_DRIFT');
 next=next.replace(financePattern,(_,a,b,c)=>a+b+', "sicof"'+c);
 const parsed=JSON.parse(next);
 assert.deepEqual(parsed.nodes.slice(5),current.nodes,'UNRELATED_OVERRIDE_NODE_CHANGED');
 assert.deepEqual(parsed.relationships.slice(relationships.length),current.relationships,'UNRELATED_OVERRIDE_EDGE_CHANGED');
 updates.push([file,next]);
 for(const [name,value]of updates)put(name,value);
 const result={status:'PASS',generatedFrom:'isolated current release checkout',sections,ownOverrideNodes:nodes.map(node=>node.name),ownRelationships:relationships.length,unrelatedNormativeSectionsPreserved:true,unrelatedSemanticOverridesPreserved:true,registryCopiedFromDirtyRoot:false,productionWrites:0};
 proof('frontend-release-governance.json',result);
 try{for(const args of [['scripts/generate-architecture-registry.py','generate'],['scripts/generate-architecture-registry.py','check']])
  cp.execFileSync('python',args,{cwd:release,encoding:'utf8',windowsHide:true,timeout:180000,maxBuffer:8*1024*1024});}
 catch(error){proof('frontend-release-governance.json',{...result,status:'FAIL'});throw error;}
 console.log(JSON.stringify(result));
}
if(require.main===module)(async()=>{const mode=process.argv[2];if(mode==='inspect-live')await inspectLive();else if(mode==='prepare')prepare();else if(mode==='sync-metadata')syncMetadata();else if(mode==='contracts-live')contractsLive();else if(mode==='governance')governance();else throw Error('Use inspect-live | prepare | sync-metadata | contracts-live | governance');})().catch(error=>{console.error(error.message);process.exitCode=1;});
module.exports={root,release,out,focal,added,runtime,supporting,metadata,read,hash,normalized,git,tracked,put,proof,parse,chunk,compiler,frozen};
