'use strict';
// Isolated candidate only. Preserve every published module except the owned cash-flow UI.
const fs=require('fs'),path=require('path'),vm=require('vm'),crypto=require('crypto'),assert=require('assert/strict'),cp=require('child_process');
const root=path.resolve(__dirname,'..'),privateDir=path.join(root,'.tmp/cash-flow-consolidated'),target=path.join(privateDir,'release'),source=path.join(root,'.tmp/cash-flow/release');
const expectedCommit='d1163880218fdf114532ce92ceb24c4bb58f93d9',version='2026103002';
const lf=value=>value.replace(/\r\n/g,'\n'),sha=value=>crypto.createHash('sha256').update(value).digest('hex');
const git=(args,cwd=target)=>cp.execFileSync('git',args,{cwd,encoding:'utf8',maxBuffer:64*1024*1024});
const read=(base,file)=>fs.readFileSync(path.join(base,file),'utf8');
const sections=source=>new Map([...source.matchAll(/^\/\* @@file ([^\r\n]+) \*\/\r?\n[\s\S]*?(?=^\/\* @@file |$(?![\s\S]))/gm)].map(match=>[match[1],match[0]]));
function once(source,anchor,value){assert.equal(source.split(anchor).length,2,'ANCHOR:'+anchor.slice(0,90));return source.replace(anchor,()=>value);}
function environment(){const env={};for(const line of read(root,'supabase.env').replace(/^\uFEFF/,'').split(/\r?\n/)){const m=line.match(/^([A-Z0-9_]+)=(.*)$/);if(m)env[m[1]]=m[2].trim().replace(/^['"]|['"]$/g,'');}return env;}
function main(){
 const disk=fs.statfsSync(root),freeBytes=disk.bavail*disk.bsize;
 assert(freeBytes>=(fs.existsSync(target)?128:384)*1024*1024,'INSUFFICIENT_FREE_SPACE: '+freeBytes+' bytes; no cleanup or clone performed.');
 fs.mkdirSync(privateDir,{recursive:true});
 if(!fs.existsSync(target)){
  assert.equal(git(['cat-file','-t',expectedCommit],source).trim(),'commit','PUBLISHED_COMMIT_MISSING');
  git(['clone','--local','--no-checkout','--config','core.autocrlf=false',source,target],root);
  git(['sparse-checkout','init','--cone']);
  git(['sparse-checkout','set','.github','app','assets','scripts','supabase','docs/architecture','docs/qa/evidence/screen-permissions-20260924']);
  git(['checkout','--detach',expectedCommit]);
  const origin=git(['remote','get-url','origin'],source).trim();git(['remote','set-url','origin',origin]);
 }
 assert.equal(git(['rev-parse','HEAD']).trim(),expectedCommit,'RELEASE_BASE_DRIFT');
 const owned=['app/cash-flow-report.jsx','app/cash-flow-export.js','app/bundle.js','scripts/build-bundle.js','SutiApp.html','sw.js'];
 const changed=git(['diff','--name-only']).trim().split(/\r?\n/).filter(Boolean);assert(changed.every(file=>owned.includes(file)),'UNRELATED_CHECKOUT_CHANGE:'+changed.join(','));
 const baseline=file=>git(['show',expectedCommit+':'+file]);
 const oldReport=baseline('app/cash-flow-report.jsx'),oldBundle=baseline('app/bundle.js');
 assert.equal(sha(oldBundle),'db6693c20fb925e6ca14a4d04ec265718b57af1f83784d34b3c4305f0674bf41','PUBLISHED_BUNDLE_DRIFT');
 const nextReport=lf(read(root,'app/cash-flow-report.jsx')),nextExport=lf(read(root,'app/cash-flow-export.js'));
 new vm.Script(nextReport,{filename:'cash-flow-report.jsx'});new vm.Script(nextExport,{filename:'cash-flow-export.js'});
 const box={};vm.createContext(box);vm.runInContext(fs.readFileSync(process.env.SUTIAPP_BABEL_PATH||'C:/tmp/babel-standalone-7.29.0.min.js','utf8'),box);
 const compile=(source,name)=>box.Babel.transform(lf(source),{presets:['react'],filename:name}).code;
 const before=sections(oldBundle);assert.equal(before.size,174,'BASE_MODULE_COUNT');
 const oldBlock=before.get('cash-flow-report.jsx'),prefix='/* @@file cash-flow-report.jsx */\n(function(){\n',suffix='\n})();\n';
 assert(oldBlock.startsWith(prefix)&&oldBlock.endsWith(suffix),'SOURCE_BLOCK_SHAPE');
 assert.equal(compile(oldReport,'cash-flow-report.jsx'),compile(oldBlock.slice(prefix.length,-suffix.length),'cash-flow-report.jsx'),'PUBLISHED_SOURCE_MISMATCH');
 const block=(name,content)=>'/* @@file '+name+' */\n(function(){\n'+content.trimEnd()+'\n})();\n';
 const bundle=once(oldBundle,oldBlock,block('cash-flow-export.js',nextExport)+block('cash-flow-report.jsx',compile(nextReport,'cash-flow-report.jsx'))),after=sections(bundle),preserved=[];
 for(const [name,bytes]of before)if(name!=='cash-flow-report.jsx'){assert.equal(after.get(name),bytes,'UNRELATED_PUBLISHED_MODULE:'+name);preserved.push({name,sha256:sha(bytes)});}
 assert.equal(preserved.length,173);assert.equal(after.size,175);new vm.Script(bundle,{filename:'app/bundle.js'});
 fs.writeFileSync(path.join(target,'app/cash-flow-report.jsx'),nextReport);fs.writeFileSync(path.join(target,'app/cash-flow-export.js'),nextExport);fs.writeFileSync(path.join(target,'app/bundle.js'),bundle);
 const builder=once(baseline('scripts/build-bundle.js'),"'cash-flow-report.jsx'","'cash-flow-export.js', 'cash-flow-report.jsx'");fs.writeFileSync(path.join(target,'scripts/build-bundle.js'),builder);
 const html=baseline('SutiApp.html'),sw=baseline('sw.js'),previous=/app\/bundle\.js\?v=(\d+)/.exec(html)?.[1];assert.equal(previous,'2026103001','CACHE_BASELINE');assert(!html.includes(version)&&!sw.includes(version),'VERSION_ALREADY_USED');
 const nextHtml=html.replaceAll('app/bundle.js?v='+previous,'app/bundle.js?v='+version).replaceAll('./sw.js?v='+previous,'./sw.js?v='+version),nextSw=sw.replaceAll('sutiapp-v'+previous,'sutiapp-v'+version).replaceAll('app/bundle.js?v='+previous,'app/bundle.js?v='+version);
 assert.equal(nextHtml.replaceAll(version,previous),html,'HTML_NONCACHE_CHANGE');assert.equal(nextSw.replaceAll(version,previous),sw,'SW_LOGIC_CHANGE');fs.writeFileSync(path.join(target,'SutiApp.html'),nextHtml);fs.writeFileSync(path.join(target,'sw.js'),nextSw);
 const permission=require(path.join(target,'scripts/screen-permission-contract')).check();assert.equal(permission.status,'PASS');
 const env=environment(),bundleHash=sha(bundle),site=path.join(privateDir,'site-'+bundleHash.slice(0,12));
 if(!fs.existsSync(site))cp.execFileSync(process.execPath,['scripts/build-pages-site.js',site],{cwd:target,env:{...process.env,SUTIAPP_SUPABASE_URL:env.SUPABASE_URL,SUTIAPP_SUPABASE_PUBLISHABLE_KEY:env.SUPABASE_PUBLISHABLE_KEY},encoding:'utf8',stdio:'pipe'});
 assert.equal(sha(fs.readFileSync(path.join(site,'app/bundle.js'))),bundleHash,'SITE_BUNDLE_MISMATCH');
 const candidateHashes=Object.fromEntries(owned.map(file=>[file,sha(fs.readFileSync(path.join(target,file)))]));
 const result={status:'PASS',baseCommit:expectedCommit,freeBytesBefore:freeBytes,bundleSha256:bundleHash,candidateHashes,preservedPublishedModules:preserved.length,preservedModules:preserved,newModules:['cash-flow-export.js'],modifiedModules:['cash-flow-report.jsx'],beforeModules:174,afterModules:175,cachebusterOnly:true,version,structuralPermissions:'PASS',buildPages:'PASS',site,financialWrites:0,deployed:false};
 fs.writeFileSync(path.join(privateDir,'release-manifest.json'),JSON.stringify(result,null,2)+'\n');
 const evidenceDir=path.join(root,'docs/qa/evidence/cash-flow-consolidated');fs.mkdirSync(evidenceDir,{recursive:true});fs.writeFileSync(path.join(evidenceDir,'release-candidate.json'),JSON.stringify({...result,site:undefined},null,2)+'\n');
 console.log(JSON.stringify({...result,preservedModules:undefined}));
}
main();
