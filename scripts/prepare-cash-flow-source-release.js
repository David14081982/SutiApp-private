'use strict';
// Focal candidate assembler. It never commits, publishes or changes financial sources.
const fs=require('fs'),path=require('path'),vm=require('vm'),cp=require('child_process'),assert=require('assert/strict'),crypto=require('crypto');
const root=path.resolve(__dirname,'..'),privateDir=path.join(root,'.tmp/cash-flow-source-20261104');
const target=path.join(root,'.tmp/reports-jc/membership-counts/release');
const expectedBase='a4a7f8a5fc317c6bb879ff130e2287a4c3cb89ae';
const focalModules=['cash-flow-report.jsx','cash-flow-export.js'],generated=['app/bundle.js','SutiApp.html','sw.js','scripts/build-pages-site.js'];
const readerSql=[
 'supabase/migrations/20261104000100_reports_jc_cash_flow_sources.sql',
 'supabase/recovery/20261104000100_reports_jc_cash_flow_sources.sql',
 'supabase/migrations/20261104000200_reports_jc_investor_sources.sql',
 'supabase/recovery/20261104000200_reports_jc_investor_sources.sql',
 'supabase/migrations/20261104000300_reports_jc_cash_flow_timeout.sql',
 'supabase/recovery/20261104000300_reports_jc_cash_flow_timeout.sql'
];
const defaultFiles=[
 ...focalModules.map(f=>'app/'+f),'app/cash-flow-projection-worker.js',
 'supabase/functions/reports-jc/index.ts',
 ...['cash-flow.mjs','cash-flow-inputs.mjs','cash-flow-google.mjs','cash-flow-consolidated.mjs','cash-flow-loans.mjs','cash-flow-savings.mjs','cash-flow-investors.mjs','cash-flow-investor-continuity.mjs','cash-flow-source-bases.mjs'].map(f=>'supabase/functions/reports-jc/'+f),
 ...['build-cash-flow-projection-worker.js','test-cash-flow-projection-worker.js','test-cash-flow-worker-ui.js','test-cash-flow-timeout-sql.js','test-cash-flow-inputs.mjs','test-cash-flow-source-bases.mjs','test-cash-flow-source-bases-sql.js','test-cash-flow-core.mjs','test-cash-flow-pv2-source.mjs','test-cash-flow-consolidated.mjs','test-cash-flow-consolidated-ui.js','test-cash-flow-investor-criteria-sql.js','test-cash-flow-investor-criteria.mjs','test-cash-flow-investors.mjs','test-cash-flow-source-parity.mjs','verify-cash-flow-source-parity-browser-live.js','test-cash-flow-investor-sources-sql.js','test-cash-flow-investor-continuity.mjs','test-cash-flow-savings.mjs','test-cash-flow-savings-sources-sql.js','cash-flow-source-test-fixture.js','prepare-cash-flow-source-release.js','update-cash-flow-source-registry.py'].map(f=>'scripts/'+f),
 ...readerSql,
 'docs/audits/H-CASH-FLOW-PV2-SOURCE-20261104.md',
 ...['architect-preliminary.json','investor-live-readonly.json','investor-sources-sql.json'].map(f=>'docs/qa/evidence/cash-flow-source-20261104/'+f)
];
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex'),lf=s=>s.replace(/\r\n/g,'\n');
const git=args=>cp.execFileSync('git',['-c','safe.directory='+target.replaceAll('\\','/'),...args],{cwd:target,encoding:'utf8',maxBuffer:64*1024*1024});
const sections=s=>new Map([...s.matchAll(/^\/\* @@file ([^\r\n]+) \*\/\r?\n[\s\S]*?(?=^\/\* @@file |$(?![\s\S]))/gm)].map(m=>[m[1],m[0]]));
const free=()=>{const disk=fs.statfsSync(root);return disk.bavail*disk.bsize;};
function atomic(file,bytes){
 fs.mkdirSync(path.dirname(file),{recursive:true});
 const pending=file+'.cash-flow-candidate.tmp';
 assert(!fs.existsSync(pending),'UNFINISHED_ATOMIC_WRITE:'+pending);
 fs.writeFileSync(pending,bytes);
 assert.equal(sha(fs.readFileSync(pending)),sha(bytes),'ATOMIC_VERIFY:'+file);
 fs.renameSync(pending,file);
}
function within(file){
 assert(typeof file==='string'&&!file.includes('\\')&&!file.startsWith('/')&&!file.split('/').includes('..'),'UNSAFE_PATH:'+file);
 assert(/^(app\/cash-flow-(?:report\.jsx|export\.js|projection-worker\.js)|supabase\/functions\/reports-jc\/(?:cash-flow[^/]*\.mjs|index\.ts)|scripts\/(?:test|prepare|verify|update|build)-cash-flow[^/]*\.(?:js|mjs|py)|scripts\/cash-flow-source-test-fixture\.js|supabase\/(?:migrations|recovery)\/(?:20261104000100|20261104000200|20261104000300)_reports_jc_[^/]+\.sql|docs\/audits\/H-CASH-FLOW-PV2-SOURCE-20261104\.md|docs\/qa\/evidence\/cash-flow-source-20261104\/[^/]+\.json)$/.test(file),'OUTSIDE_FOCAL_SCOPE:'+file);
 return path.join(root,file);
}
function prepare(options={}){
 assert.equal(git(['rev-parse','HEAD']).trim(),expectedBase,'RELEASE_BASE_DRIFT');
 const files=[...new Set(options.files||defaultFiles)],version=options.version||'2026110402';
 const manifestPath=path.join(privateDir,'release-manifest.json'),prior=fs.existsSync(manifestPath)?JSON.parse(fs.readFileSync(manifestPath,'utf8')):{};
 const preservedRegistry=Object.entries(prior.registryUpdate?.outputs||{});
 for(const [file,hash]of preservedRegistry){assert(/^docs\/architecture\/[^/]+\.json$/.test(file),'UNEXPECTED_REGISTRY_PATH');assert.equal(sha(fs.readFileSync(path.join(target,file))),hash,'REGISTRY_DRIFT:'+file);}
 const registryEvidence=prior.registryUpdate?.evidence?.file;
 if(registryEvidence)assert(/^docs\/qa\/evidence\/cash-flow-source-20261104\/[^/]+\.json$/.test(registryEvidence));
 assert(/^\d{10}$/.test(version),'INVALID_VERSION');for(const f of focalModules)assert(files.includes('app/'+f),'MISSING_UI_SOURCE:'+f);
 const protectReaderSql=options.protectReaderSql!==false;
 if(protectReaderSql)for(const f of readerSql)assert(files.includes(f),'MISSING_READER_SQL:'+f);
 const allowed=[...files,...generated,...preservedRegistry.map(([file])=>file),...(registryEvidence?[registryEvidence]:[]),...(protectReaderSql?['.gitattributes']:[])],beforeStatus=git(['status','--porcelain','--untracked-files=all']).split(/\r?\n/).filter(Boolean);
 for(const entry of beforeStatus)assert(allowed.includes(entry.slice(3)),'UNRELATED_CHECKOUT_CHANGE:'+entry);
 const sources=new Map(files.map(file=>[file,fs.readFileSync(within(file))]));
 for(const [file,bytes]of sources){
  assert(bytes.length,'EMPTY_SOURCE:'+file);
  if(options.sourceHashes)assert.equal(sha(bytes),options.sourceHashes[file],'SOURCE_SNAPSHOT_DRIFT:'+file);
  assert(!/sbp_[a-z0-9]{20,}|-----BEGIN (?:RSA )?PRIVATE KEY-----|"private_key"\s*:\s*"-----/i.test(bytes.toString()),'SECRET_PATTERN:'+file);
 }
 const baseline=file=>git(['show',expectedBase+':'+file]),oldBundle=baseline('app/bundle.js');
 const before=sections(oldBundle);assert(before.size>100,'INVALID_BASE_BUNDLE');
 for(const name of focalModules)assert(before.has(name),'MISSING_BASE_MODULE:'+name);
 const box={};vm.createContext(box);
 vm.runInContext(fs.readFileSync(process.env.SUTIAPP_BABEL_PATH||'C:/tmp/babel-standalone-7.29.0.min.js','utf8'),box);
 const compile=(s,name)=>box.Babel.transform(lf(s),{presets:['react'],filename:name}).code;
 let bundle=oldBundle;const replacements=[];
 for(const name of focalModules){
  const source=lf(sources.get('app/'+name).toString()),old=before.get(name);
  new vm.Script(source,{filename:name});
  const content=name.endsWith('.jsx')?compile(source,name):source;
  const next='/* @@file '+name+' */\n(function(){\n'+content.trimEnd()+'\n})();\n';
  assert.equal(bundle.split(old).length,2,'NONUNIQUE_MODULE:'+name);
  bundle=bundle.replace(old,()=>next);replacements.push({name,beforeSha256:sha(old),afterSha256:sha(next)});
 }
 const after=sections(bundle),preserved=[];
 assert.equal(after.size,before.size,'MODULE_COUNT_CHANGED');
 for(const [name,body]of before)if(!focalModules.includes(name)){assert.equal(after.get(name),body,'UNRELATED_MODULE:'+name);preserved.push({name,sha256:sha(body)});}
 const normalized=s=>{for(const name of focalModules)s=s.replace(sections(s).get(name),'/* FOCAL '+name+' */');return s;};
 assert.equal(normalized(bundle),normalized(oldBundle),'UNRELATED_BUNDLE_BYTES');
 new vm.Script(bundle,{filename:'app/bundle.js'});
 const html=baseline('SutiApp.html'),sw=baseline('sw.js'),oldVersion=/app\/bundle\.js\?v=(\d+)/.exec(html)?.[1];
 assert.equal(oldVersion,'2026110203','UNEXPECTED_CACHE_BASE');assert.notEqual(version,oldVersion);
 const nextHtml=html.replaceAll('app/bundle.js?v='+oldVersion,'app/bundle.js?v='+version).replaceAll('./sw.js?v='+oldVersion,'./sw.js?v='+version);
 const nextSw=sw.replaceAll('sutiapp-v'+oldVersion,'sutiapp-v'+version).replaceAll('app/bundle.js?v='+oldVersion,'app/bundle.js?v='+version);
 assert.equal(nextHtml.replaceAll(version,oldVersion),html,'HTML_BEYOND_CACHEBUSTER');
 assert.equal(nextSw.replaceAll(version,oldVersion),sw,'SERVICE_WORKER_LOGIC_CHANGED');
 let attributes=null;
 if(protectReaderSql){const original=baseline('.gitattributes');attributes=original+(original.endsWith('\n')?'':'\n')+readerSql.map(file=>file+' -text\n').join('');assert(attributes.startsWith(original),'ATTRIBUTES_BASELINE_NOT_PRESERVED');}
 const outputs=new Map([...sources,['app/bundle.js',Buffer.from(bundle)],['SutiApp.html',Buffer.from(nextHtml)],['sw.js',Buffer.from(nextSw)]]);
 if(attributes!==null)outputs.set('.gitattributes',Buffer.from(attributes));
 const buildScript=baseline('scripts/build-pages-site.js'),buildAnchor="  'app/sicof-simulation-worker.js',";
 assert.equal(buildScript.split(buildAnchor).length,2,'BUILD_PAGES_WORKER_ANCHOR');
 const nextBuildScript=buildScript.replace(buildAnchor,"  'app/cash-flow-projection-worker.js',\n"+buildAnchor);
 assert.equal(nextBuildScript.replace("  'app/cash-flow-projection-worker.js',\n",''),buildScript,'UNRELATED_BUILD_PAGES_CHANGE');
 outputs.set('scripts/build-pages-site.js',Buffer.from(nextBuildScript));
 const buildPages=options.buildPages!==false,site=path.join(privateDir,'site');
 const required=[...outputs.values()].reduce((sum,bytes)=>sum+bytes.length,0)*2+(buildPages?40:16)*1024*1024,freeBytes=free();
 assert(freeBytes>=required,'INSUFFICIENT_SPACE_FOR_ATOMIC_CANDIDATE:'+freeBytes+'<'+required);
 if(options.dryRun){const proof={status:'PASS',dryRun:true,baseCommit:expectedBase,bundleSyntax:'PASS',beforeModules:before.size,afterModules:after.size,preservedPublishedModules:preserved.length,bundleSha256:sha(bundle),requiredBytes:required,freeBytes};console.log(JSON.stringify(proof));return proof;}
 // No candidate is written until all source, syntax, scope and byte-preservation checks succeed.
 if(protectReaderSql)git(['update-index','--no-skip-worktree','--','.gitattributes']);
 for(const [file,bytes]of outputs)atomic(path.join(target,file),bytes);
 if(protectReaderSql)for(const file of readerSql)assert(git(['check-attr','text','--',file]).trim().endsWith(': unset'),'SQL_BYTES_NOT_PROTECTED:'+file);
 const permission=require(path.join(target,'scripts/screen-permission-contract')).check();assert.equal(permission.status,'PASS');
 const changed=git(['status','--porcelain','--untracked-files=all']).split(/\r?\n/).filter(Boolean).map(line=>line.slice(3));
 for(const file of changed)assert(allowed.includes(file),'UNEXPECTED_CANDIDATE_FILE:'+file);
 if(buildPages){
  assert(!fs.existsSync(site),'SITE_ALREADY_EXISTS_REVIEW_BEFORE_REUSE');
  const values=require('./investors-db').environment();
  const built=JSON.parse(cp.execFileSync(process.execPath,['scripts/build-pages-site.js',site],{cwd:target,env:{...process.env,SUTIAPP_SUPABASE_URL:values.SUPABASE_URL,SUTIAPP_SUPABASE_PUBLISHABLE_KEY:values.SUPABASE_PUBLISHABLE_KEY},encoding:'utf8',stdio:'pipe'}));
  assert.equal(built.status,'PASS','PAGES_BUILD_FAILED');
  assert.equal(sha(fs.readFileSync(path.join(site,'app/bundle.js'))),sha(bundle),'SITE_BUNDLE_MISMATCH');
 }
 const result={
  status:'PASS',baseCommit:expectedBase,target,version,files:[...outputs.keys()],changedFiles:changed,
  sourceHashes:Object.fromEntries([...sources].map(([file,bytes])=>[file,sha(bytes)])),
  candidateHashes:Object.fromEntries([...outputs].map(([file,bytes])=>[file,sha(bytes)])),
  baselineBundleSha256:sha(oldBundle),bundleSha256:sha(bundle),modifiedModules:replacements,
  preservedPublishedModules:preserved.length,preservedModules:preserved,
  beforeModules:before.size,afterModules:after.size,structuralPermissions:'PASS',
  bundleSyntax:'PASS',buildPages:buildPages?'PASS':'NOT APPLICABLE',site:buildPages?site:undefined,cachebusterOnly:true,freeBytesBefore:freeBytes,
  registryUpdate:prior.registryUpdate?{...prior.registryUpdate,status:'REVIEW REQUIRED',scopeFreshness:'STALE'}:undefined,preservedRegistryHashes:Object.fromEntries(preservedRegistry),buildPagesWorkerOnly:true,attributesPreserved:protectReaderSql,readerSqlProtected:protectReaderSql?readerSql:[],financialWrites:0,committed:false,pushed:false,deployed:false
 };
 fs.mkdirSync(privateDir,{recursive:true});atomic(path.join(privateDir,'release-manifest.json'),Buffer.from(JSON.stringify(result,null,2)+'\n'));
 console.log(JSON.stringify({...result,preservedModules:undefined,sourceHashes:undefined,candidateHashes:undefined}));
 return result;
}
if(require.main===module){const options=process.argv[2]?JSON.parse(fs.readFileSync(process.argv[2],'utf8')):{};prepare(options);}
module.exports={prepare,defaultFiles,readerSql,target,expectedBase};
