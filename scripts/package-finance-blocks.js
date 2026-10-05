'use strict';
// Focal packaging into an isolated checkout. Never applies SQL, stages, commits or publishes.
const fs=require('fs'),path=require('path'),cp=require('child_process'),vm=require('vm'),crypto=require('crypto'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),release=path.join(root,'.tmp/finance-blocks/release'),before=path.join(root,'.tmp/finance-blocks/before');
const focal=['program-request-repository.js','screens-admin-finanzas.jsx','screens-admin.jsx'];
const added=['finance-blocks-repository.js','finance-blocks.jsx'];
const sourceFiles=[...focal,'financial-legacy-repository.js'].map(name=>'app/'+name);
const support=[
 'scripts/package-finance-blocks.js','scripts/build-finance-blocks.js','scripts/inspect-finance-blocks.js',
 'scripts/test-finance-blocks.js','scripts/test-finance-blocks-browser.js','scripts/test-finance-blocks-integration.js','scripts/test-finance-blocks-permissions.js','scripts/test-finance-blocks-read-boundary.js',
 'supabase/migrations/20261004000300_finance_blocks.sql','supabase/recovery/20261004000300_finance_blocks.sql',
 'docs/audits/H-FINANCE-BLOCKS-001.md'
];
const governance=['docs/SOURCE_OF_TRUTH.md','docs/DECISIONS.md','docs/INVARIANTS.md','docs/AGENT_CHANGELOG.md'];
const norm=s=>s.replace(/\r\n/g,'\n'),sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const read=(file,dir=root)=>norm(fs.readFileSync(path.join(dir,file),'utf8'));
const git=args=>cp.execFileSync('git',['-C',release,...args],{encoding:'utf8',windowsHide:true,maxBuffer:32*1024*1024});
const tracked=file=>norm(git(['show','HEAD:'+file]));
const put=(file,value,dir=release)=>{const target=path.join(dir,file);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,value);};
const parse=s=>s.split(/(?=\/\* @@file )/).filter(Boolean).map(bytes=>{const match=/^\/\* @@file ([^ ]+) \*\//.exec(bytes);assert(match,'INVALID_BUNDLE_MARKER');return{name:match[1],bytes};});
const chunk=(name,code)=>'/* @@file '+name+' */\n(function(){\n'+code+'\n})();\n';
function scopedSections(source){
 const headings=[...source.matchAll(/^(#{1,2}) .+$/gm)],sections=[];
 for(let i=0;i<headings.length;i++)if(headings[i][0].includes('H-FINANCE-BLOCKS-001')){
  let end=source.length;for(let j=i+1;j<headings.length;j++)if(headings[j][1].length<=headings[i][1].length){end=headings[j].index;break;}
  sections.push(source.slice(headings[i].index,end).trim());
 }
 assert(sections.length,'MISSING_FOCAL_GOVERNANCE');return sections;
}
function prepare(){
 assert(fs.existsSync(path.join(release,'.git')),'ISOLATED_CHECKOUT_REQUIRED');
 const baseline=git(['rev-parse','HEAD']).trim();
 assert.equal(baseline,cp.execFileSync('git',['-C',root,'rev-parse','origin/main'],{encoding:'utf8',windowsHide:true}).trim(),'REMOTE_BASE_DRIFT');
 const checks=[];
 for(const file of sourceFiles){assert.equal(tracked(file),read(file,before),'PUBLISHED_SOURCE_DRIFT:'+file);checks.push({file,baselineSha256:sha(tracked(file)),candidateSha256:sha(read(file))});}
 const permission='scripts/screen-permission-contract.js';
 assert.equal(tracked(permission),norm(cp.execFileSync('git',['-C',root,'show','HEAD:'+permission],{encoding:'utf8',windowsHide:true})),'PERMISSION_CONTRACT_BASE_DRIFT');
 const builder='scripts/build-bundle.js',builderBefore=read(builder,before),builderCandidate=read(builder);
 const oldMarker='const files = [',insertion="const files = [\n  'finance-blocks-repository.js', 'finance-blocks.jsx',";
 assert.equal(builderBefore.replace(oldMarker,insertion),builderCandidate,'UNEXPECTED_ROOT_BUILDER_CHANGE');
 const publishedBuilder=tracked(builder);assert.equal(publishedBuilder.split(oldMarker).length,2);assert(!publishedBuilder.includes("'finance-blocks-repository.js'"),'FINANCE_ALREADY_PACKAGED');
 const box={};vm.createContext(box);vm.runInContext(fs.readFileSync(process.env.SUTIAPP_BABEL_PATH||'C:/tmp/babel-standalone-7.29.0.min.js','utf8'),box);
 const compile=(source,name,babel)=>babel?box.Babel.transform(source,{presets:['react'],filename:name}).code:source.trimEnd();
 const published=tracked('app/bundle.js'),old=parse(published),modes={};
 assert.equal(new Set(old.map(x=>x.name)).size,old.length,'DUPLICATE_BASE_MODULE');
 for(const name of added)assert(!old.some(x=>x.name===name),'NEW_MODULE_ALREADY_PUBLISHED:'+name);
 for(const name of focal){
  const entry=old.find(x=>x.name===name);assert(entry,'MISSING_PUBLISHED_MODULE:'+name);
  const source=tracked('app/'+name);
  if(entry.bytes===chunk(name,compile(source,name,false)))modes[name]=false;
  else if(entry.bytes===chunk(name,compile(source,name,true)))modes[name]=true;
  else throw Error('PUBLISHED_SOURCE_BUNDLE_DRIFT:'+name);
 }
 const next=added.map(name=>chunk(name,compile(read('app/'+name),name,false))).join('')+old.map(entry=>focal.includes(entry.name)?chunk(entry.name,compile(read('app/'+entry.name),entry.name,modes[entry.name])):entry.bytes).join('');
 new vm.Script(next,{filename:'app/bundle.js'});
 const chunks=parse(next);for(const entry of old)if(!focal.includes(entry.name))assert.equal(chunks.find(x=>x.name===entry.name).bytes,entry.bytes,'UNRELATED_BUNDLE_CHANGE:'+entry.name);
 const html=tracked('SutiApp.html'),worker=tracked('sw.js');
 const currentVersions=[...html.matchAll(/(?:bundle\.js\?v=|sw\.js\?v=|financial-legacy-repository\.js\?v=)(\d+)/g),...worker.matchAll(/(?:sutiapp-v|bundle\.js\?v=|financial-legacy-repository\.js\?v=)(\d+)/g)].map(x=>Number(x[1]));
 const version=Math.max(...currentVersions)+1;
 const update=s=>s.replace(/app\/bundle\.js\?v=\d+/g,'app/bundle.js?v='+version).replace(/sw\.js\?v=\d+/g,'sw.js?v='+version).replace(/sutiapp-v\d+/g,'sutiapp-v'+version).replace(/financial-legacy-repository\.js\?v=\d+/g,'financial-legacy-repository.js?v='+version);
 const removeVersions=s=>s.replace(/(?:sutiapp-v|(?:bundle|sw|financial-legacy-repository)\.js\?v=)\d+/g,'GENERATED_VERSION');
 assert.equal(removeVersions(worker),removeVersions(update(worker)),'WORKER_LOGIC_CHANGED');
 assert.equal(removeVersions(html),removeVersions(update(html)),'HTML_LOGIC_CHANGED');
 const outputs=[...sourceFiles.map(file=>[file,read(file)]),...added.map(name=>['app/'+name,read('app/'+name)]),[permission,read(permission)],[builder,publishedBuilder.replace(oldMarker,insertion)],['app/bundle.js',next],['SutiApp.html',update(html)],['sw.js',update(worker)]];
 const sections=[];
 for(const file of governance){const prior=git(['show','HEAD:'+file]);assert(!prior.includes('H-FINANCE-BLOCKS-001'),'FOCAL_GOVERNANCE_ALREADY_PUBLISHED:'+file);const own=scopedSections(read(file));outputs.push([file,prior.trimEnd()+'\n\n'+own.join('\n\n')+'\n']);sections.push({file,headings:own.map(x=>x.split('\n')[0]),publishedContentPreserved:true});}
 for(const file of support)outputs.push([file,read(file)]);
 for(const [file,value]of outputs)put(file,value);
 const evidenceDir=path.join(root,'docs/qa/evidence/finance-blocks'),copied=[];
 function copyEvidence(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const full=path.join(dir,entry.name);if(entry.isDirectory())copyEvidence(full);else{const relative=path.relative(root,full).replace(/\\/g,'/');if(!entry.name.startsWith('release-')){put(relative,fs.readFileSync(full));copied.push(relative);}}}}
 copyEvidence(evidenceDir);
 const evidence={status:'PASS',preparedAt:new Date().toISOString(),baselineCommit:baseline,baselineChunks:old.length,candidateChunks:chunks.length,preservedPublishedChunks:old.length-focal.length,changedChunks:focal,addedChunks:added,sourceChecks:checks,sourceCompiler:modes,baselineBundleSha256:sha(published),bundleSha256:sha(next),bundleVersion:version,workerVersion:version,financialRepositoryVersion:version,workerLogicIdentical:true,htmlLogicIdentical:true,publishedContentPreserved:true,sourceBuilderPreservesRemoteEntries:true,governance:sections,files:[...outputs.map(x=>x[0]),...copied],businessWrites:0,published:false};
 for(const dir of [root,release])put('docs/qa/evidence/finance-blocks/release-package.json',JSON.stringify(evidence,null,2)+'\n',dir);
 console.log(JSON.stringify({status:'PASS',baselineCommit:baseline,bundleSha256:evidence.bundleSha256,preservedPublishedChunks:evidence.preservedPublishedChunks,bundleVersion:version,files:evidence.files.length,published:false}));
}
function finalize(){
 const receipt=JSON.parse(read('docs/qa/evidence/finance-blocks/release-apply.json'));
 assert.equal(receipt.status,'PASS');assert.equal(receipt.migration,'20261004000300');assert.equal(receipt.newBlocks,0);assert.equal(receipt.newEvents,0);assert.equal(receipt.existingBusinessWrites,0);
 const verified=receipt.receipt[0].receipt;assert.equal(verified.preserved_tables,8);assert.equal(verified.existing_functions_preserved,484);
 const copied=[];
 for(const file of ['scripts/package-finance-blocks.js','scripts/release-finance-blocks.js','scripts/verify-finance-blocks-live.js']){assert(fs.existsSync(path.join(root,file)),'MISSING_FINAL_RELEASE_SCRIPT:'+file);put(file,read(file));copied.push(file);}
 for(const entry of fs.readdirSync(path.join(root,'docs/qa/evidence/finance-blocks'))){if(entry.startsWith('release-')&&entry.endsWith('.json')){const file='docs/qa/evidence/finance-blocks/'+entry;put(file,fs.readFileSync(path.join(root,file)));copied.push(file);}}
 const heading='## H-FINANCE-BLOCKS-001 — activación autorizada del backend';
 const note='El propietario confirmó conservar Ahorro y solicitudes previas, y autorizó commit, push y publicación. La migración 20261004000300 está aplicada con RLS/ACL verificadas: 8 tablas de autoridad y 484 funciones existentes conservadas; 0 bloqueos, 0 eventos y 0 escrituras de negocio. finance_blocks es la autoridad privada instalada; el frontend se prepara en checkout aislado sobre origin/main y su publicación se verifica por separado. Consultas/simulaciones existentes permanecen disponibles; únicamente la confirmación/envío financiero consulta el bloqueo. Evidencia: docs/qa/evidence/finance-blocks/release-apply.json y release-package.json.';
 for(const file of [...governance,'docs/audits/H-FINANCE-BLOCKS-001.md']){const value=fs.readFileSync(path.join(release,file),'utf8');if(!value.includes(heading))put(file,value.trimEnd()+'\n\n'+heading+'\n\n'+note+'\n');}
 const proof={status:'PASS',checkedAt:new Date().toISOString(),copied,backendApplied:true,businessWrites:0,frontendPublished:false,unrelatedGovernancePreserved:true};
 for(const dir of [root,release])put('docs/qa/evidence/finance-blocks/release-finalize.json',JSON.stringify(proof,null,2)+'\n',dir);
 console.log(JSON.stringify(proof));
}
if(require.main===module){try{if(process.argv[2]==='prepare')prepare();else if(process.argv[2]==='finalize')finalize();else throw Error('Use prepare | finalize');}catch(error){console.error(error.message);process.exitCode=1;}}
module.exports={root,release,read,sha,norm,git,tracked,parse,chunk,focal,added,sourceFiles};
