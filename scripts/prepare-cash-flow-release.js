'use strict';
// Isolated read-only cash-flow UI release; no deployment, no financial data writes.
const fs=require('fs'),path=require('path'),vm=require('vm'),crypto=require('crypto'),assert=require('assert/strict'),cp=require('child_process');
const root=path.resolve(__dirname,'..'),privateDir=path.join(root,'.tmp/cash-flow'),target=path.join(privateDir,'release'),baselineDir=path.join(privateDir,'release-baseline');
const lf=s=>s.replace(/\r\n/g,'\n'),sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const read=(base,file)=>fs.readFileSync(path.join(base,file),'utf8');
const sections=s=>new Map([...s.matchAll(/^\/\* @@file ([^\r\n]+) \*\/\r?\n[\s\S]*?(?=^\/\* @@file |$(?![\s\S]))/gm)].map(m=>[m[1],m[0]]));
function once(source,anchor,value){assert.equal(source.split(anchor).length,2,'ANCHOR:'+anchor.slice(0,80));return source.replace(anchor,()=>value);}
function environment(){const env={};for(const line of fs.readFileSync(path.join(root,'supabase.env'),'utf8').replace(/^\uFEFF/,'').split(/\r?\n/)){const m=line.match(/^([A-Z0-9_]+)=(.*)$/);if(m)env[m[1]]=m[2].trim().replace(/^['"]|['"]$/g,'');}return env;}
function main(){
 const expectedCommit='71404ef7fb3c3d1a8da2f825dc7b1a5bf7766b6d',baseCommit=cp.execFileSync('git',['rev-parse','HEAD'],{cwd:target,encoding:'utf8'}).trim();assert.equal(baseCommit,expectedCommit,'UNEXPECTED_RELEASE_BASE');
 const baselineFiles=['app/reports-jc-admin.jsx','app/reports-jc-repository.js','app/bundle.js','scripts/build-bundle.js','SutiApp.html','sw.js'];
 if(!fs.existsSync(baselineDir)){assert.equal(cp.execFileSync('git',['status','--porcelain'],{cwd:target,encoding:'utf8'}).trim(),'','CLEAN_RELEASE_REQUIRED');for(const file of baselineFiles){fs.mkdirSync(path.dirname(path.join(baselineDir,file)),{recursive:true});fs.copyFileSync(path.join(target,file),path.join(baselineDir,file));}}
 const oldAdmin=read(baselineDir,'app/reports-jc-admin.jsx'),oldRepository=read(baselineDir,'app/reports-jc-repository.js');
 assert.equal(sha(oldAdmin),'7da0e55e49c25f71f72c09b6d115ac09a648629b8f4faf611441f23e2aa3b324','ADMIN_BASELINE_DRIFT');
 assert.equal(sha(lf(oldRepository)),'c323931ff45367e934ce1e427c55aca8f57c4fef8edb1b4a5f507a9ec9ee64b3','REPOSITORY_BASELINE_DRIFT');
 const adminSource=lf(read(root,'app/reports-jc-admin.jsx')),repositorySource=lf(read(root,'app/reports-jc-repository.js'));
 const stateLine=adminSource.split('\n').find(line=>line.includes('const [cashFlowOpen,setCashFlowOpen]')),
       viewLine=adminSource.split('\n').find(line=>line.includes('if(cashFlowOpen)return')),
       entryLine=adminSource.split('\n').find(line=>line.includes("onClick:()=>setCashFlowOpen(true)"));
 assert(stateLine&&viewLine&&entryLine,'CASH_FLOW_THREE_INSERTIONS_REQUIRED');
 let admin=lf(oldAdmin);admin=once(admin,' function ReportsJcAdmin({app,onBack,header}){',' function ReportsJcAdmin({app,onBack,header}){\n'+stateLine);
 const regularizationLine=admin.split('\n').find(line=>line.startsWith('  if(regularization)return'));
 admin=once(admin,regularizationLine,viewLine+'\n'+regularizationLine);
 const bodyLine=admin.split('\n').find(line=>line.startsWith("  return h('div',{className:'rjc','data-reports-jc':true}"));
 admin=once(admin,bodyLine,bodyLine+'\n'+entryLine);assert.equal(admin,adminSource,'UNRELATED_ADMIN_SOURCE_CHANGE');
 const repository=once(lf(oldRepository),"template:()=>invoke('TEMPLATE',{})","template:()=>invoke('TEMPLATE',{}),cashFlow:from=>invoke('CASH_FLOW',{from})");assert.equal(repository,repositorySource,'UNRELATED_REPOSITORY_SOURCE_CHANGE');
 const cashFlow=lf(read(root,'app/cash-flow-report.jsx'));new vm.Script(cashFlow,{filename:'cash-flow-report.jsx'});
 const box={};vm.createContext(box);vm.runInContext(fs.readFileSync(process.env.SUTIAPP_BABEL_PATH||'C:/tmp/babel-standalone-7.29.0.min.js','utf8'),box);const compile=(source,name)=>box.Babel.transform(lf(source),{presets:['react'],filename:name}).code;
 let bundle=read(baselineDir,'app/bundle.js');const before=sections(bundle),eol=bundle.includes('\r\n')?'\r\n':'\n';
 function block(name,source){return ('/* @@file '+name+' */\n(function(){\n'+source.trimEnd()+'\n})();\n').replace(/\n/g,eol);}
 for(const [name,oldSource,nextSource]of [['reports-jc-repository.js',oldRepository,repository],['reports-jc-admin.jsx',oldAdmin,admin]]){
  const old=before.get(name);assert(old,'PUBLISHED_MODULE_MISSING:'+name);const normalized=lf(old),prefix='/* @@file '+name+' */\n(function(){\n',suffix='\n})();\n';assert(normalized.startsWith(prefix)&&normalized.endsWith(suffix));
  assert.equal(compile(oldSource,name),compile(normalized.slice(prefix.length,-suffix.length),name),'PUBLISHED_SOURCE_MISMATCH:'+name);
  bundle=once(bundle,old,block(name,name.endsWith('.jsx')?compile(nextSource,name):nextSource));
 }
 const adminBlock=sections(bundle).get('reports-jc-admin.jsx');bundle=once(bundle,adminBlock,block('cash-flow-report.jsx',compile(cashFlow,'cash-flow-report.jsx'))+adminBlock);
 const after=sections(bundle),modified=['reports-jc-repository.js','reports-jc-admin.jsx'],preserved=[];
 for(const [name,bytes]of before)if(!modified.includes(name)){assert.equal(after.get(name),bytes,'UNRELATED_PUBLISHED_MODULE:'+name);preserved.push({name,sha256:sha(bytes)});}
 assert.equal(after.size,before.size+1,'UNEXPECTED_BUNDLE_MODULE_COUNT');new vm.Script(bundle,{filename:'app/bundle.js'});
 fs.writeFileSync(path.join(target,'app/reports-jc-admin.jsx'),admin.replace(/\n/g,oldAdmin.includes('\r\n')?'\r\n':'\n'));
 fs.writeFileSync(path.join(target,'app/reports-jc-repository.js'),repository.replace(/\n/g,oldRepository.includes('\r\n')?'\r\n':'\n'));
 fs.writeFileSync(path.join(target,'app/cash-flow-report.jsx'),cashFlow);fs.writeFileSync(path.join(target,'app/bundle.js'),bundle);
 const build=once(read(baselineDir,'scripts/build-bundle.js'),"'reports-jc-admin.jsx'","'cash-flow-report.jsx', 'reports-jc-admin.jsx'");fs.writeFileSync(path.join(target,'scripts/build-bundle.js'),build);
 const version='2026103001',html=read(baselineDir,'SutiApp.html'),sw=read(baselineDir,'sw.js'),previous=/app\/bundle\.js\?v=(\d+)/.exec(html)?.[1];assert.equal(previous,'2026102901','UNEXPECTED_CACHE_BASELINE');assert(!html.includes(version)&&!sw.includes(version),'VERSION_ALREADY_USED');
 const nextHtml=html.replaceAll('app/bundle.js?v='+previous,'app/bundle.js?v='+version).replaceAll('./sw.js?v='+previous,'./sw.js?v='+version),nextSw=sw.replaceAll('sutiapp-v'+previous,'sutiapp-v'+version).replaceAll('app/bundle.js?v='+previous,'app/bundle.js?v='+version);
 assert.equal(nextHtml.replaceAll(version,previous),html,'HTML_NONCACHE_CHANGED');assert.equal(nextSw.replaceAll(version,previous),sw,'SW_LOGIC_CHANGED');fs.writeFileSync(path.join(target,'SutiApp.html'),nextHtml);fs.writeFileSync(path.join(target,'sw.js'),nextSw);
 const structural=require(path.join(target,'scripts/screen-permission-contract')).check();assert.equal(structural.status,'PASS');
 const env=environment(),bundleHash=sha(bundle),site=path.join(privateDir,'site-'+bundleHash.slice(0,12));
 if(!fs.existsSync(site))cp.execFileSync(process.execPath,['scripts/build-pages-site.js',site],{cwd:target,env:{...process.env,SUTIAPP_SUPABASE_URL:env.SUPABASE_URL,SUTIAPP_SUPABASE_PUBLISHABLE_KEY:env.SUPABASE_PUBLISHABLE_KEY},stdio:'pipe'});
 assert.equal(sha(fs.readFileSync(path.join(site,'app/bundle.js'))),bundleHash,'SITE_BUNDLE_MISMATCH');
 const candidateFiles=['app/cash-flow-report.jsx',...baselineFiles],candidateHashes=Object.fromEntries(candidateFiles.map(file=>[file,sha(fs.readFileSync(path.join(target,file)))]));
 const result={status:'PASS',baseCommit,bundleSha256:bundleHash,candidateHashes,preservedPublishedModules:preserved.length,preservedModules:preserved,newModules:['cash-flow-report.jsx'],modifiedModules:modified,adminInsertions:3,repositoryAction:'CASH_FLOW',cachebusterOnly:true,version,structuralPermissions:'PASS',buildPages:'PASS',site,financialWrites:0,deployed:false};
 fs.writeFileSync(path.join(privateDir,'release-manifest.json'),JSON.stringify(result,null,2)+'\n');
 const evidenceDir=path.join(root,'docs/qa/evidence/cash-flow');fs.mkdirSync(evidenceDir,{recursive:true});fs.writeFileSync(path.join(evidenceDir,'release-candidate.json'),JSON.stringify({...result,site:undefined},null,2)+'\n');
 console.log(JSON.stringify({...result,preservedModules:undefined,site:undefined}));
}
main();
