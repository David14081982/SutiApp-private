'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),cp=require('child_process'),assert=require('assert/strict'),crypto=require('crypto');
const root=path.resolve(__dirname,'..'),privateDir=path.join(root,'.tmp/cash-flow-criteria'),target=path.join(root,'.tmp/cash-flow-consolidated/release'),base='183177cdb7b46668c70090cc737fc8cb75ad569c',version='2026103003';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex'),lf=s=>s.replace(/\r\n/g,'\n'),git=args=>cp.execFileSync('git',['-c','safe.directory='+target.replaceAll('\\','/'),...args],{cwd:target,encoding:'utf8',maxBuffer:64*1024*1024});
const sections=s=>new Map([...s.matchAll(/^\/\* @@file ([^\r\n]+) \*\/\r?\n[\s\S]*?(?=^\/\* @@file |$(?![\s\S]))/gm)].map(m=>[m[1],m[0]]));
function main(){
 assert.equal(git(['rev-parse','HEAD']).trim(),base,'RELEASE_BASE_DRIFT');fs.mkdirSync(privateDir,{recursive:true});
 const previous=file=>git(['show',base+':'+file]),oldBundle=previous('app/bundle.js');assert.equal(sha(oldBundle),'76c6180e3c76821655428078128a35248df061356456a37fd8469e437713078a');
 const box={};vm.createContext(box);vm.runInContext(fs.readFileSync('C:/tmp/babel-standalone-7.29.0.min.js','utf8'),box);
 const before=sections(oldBundle);assert.equal(before.size,175);let bundle=oldBundle;
 const owned=['app/cash-flow-report.jsx','app/cash-flow-export.js','app/bundle.js','SutiApp.html','sw.js'];
 for(const name of ['cash-flow-report.jsx','cash-flow-export.js']){const source=lf(fs.readFileSync(path.join(root,'app',name),'utf8'));new vm.Script(source);const content=name.endsWith('.jsx')?box.Babel.transform(source,{presets:['react'],filename:name}).code:source;assert(before.has(name));bundle=bundle.replace(before.get(name),()=>'/* @@file '+name+' */\n(function(){\n'+content.trimEnd()+'\n})();\n');fs.writeFileSync(path.join(target,'app',name),source);}
 new vm.Script(bundle);const after=sections(bundle);assert.equal(after.size,175);let preserved=0;for(const [name,content]of before)if(!['cash-flow-report.jsx','cash-flow-export.js'].includes(name)){assert.equal(after.get(name),content,'UNRELATED_MODULE:'+name);preserved++;}assert.equal(preserved,173);fs.writeFileSync(path.join(target,'app/bundle.js'),bundle);
 const html=previous('SutiApp.html'),sw=previous('sw.js'),oldVersion=/app\/bundle\.js\?v=(\d+)/.exec(html)[1];assert.equal(oldVersion,'2026103002');
 const nextHtml=html.replaceAll('app/bundle.js?v='+oldVersion,'app/bundle.js?v='+version).replaceAll('./sw.js?v='+oldVersion,'./sw.js?v='+version),nextSw=sw.replaceAll('sutiapp-v'+oldVersion,'sutiapp-v'+version).replaceAll('app/bundle.js?v='+oldVersion,'app/bundle.js?v='+version);assert.equal(nextHtml.replaceAll(version,oldVersion),html);assert.equal(nextSw.replaceAll(version,oldVersion),sw);fs.writeFileSync(path.join(target,'SutiApp.html'),nextHtml);fs.writeFileSync(path.join(target,'sw.js'),nextSw);
 assert.equal(require(path.join(target,'scripts/screen-permission-contract')).check().status,'PASS');
 const {env}=require('./release-cash-flow.js'),bundleSha256=sha(bundle),site=path.join(privateDir,'site-'+bundleSha256.slice(0,12));
 if(!fs.existsSync(site))cp.execFileSync(process.execPath,['scripts/build-pages-site.js',site],{cwd:target,env:{...process.env,SUTIAPP_SUPABASE_URL:env.SUPABASE_URL,SUTIAPP_SUPABASE_PUBLISHABLE_KEY:env.SUPABASE_PUBLISHABLE_KEY},encoding:'utf8',stdio:'pipe'});
 assert.equal(sha(fs.readFileSync(path.join(site,'app/bundle.js'))),bundleSha256);
 const result={status:'PASS',baseCommit:base,bundleSha256,candidateHashes:Object.fromEntries(owned.map(f=>[f,sha(fs.readFileSync(path.join(target,f)))])),preservedPublishedModules:173,beforeModules:175,afterModules:175,modifiedModules:['cash-flow-report.jsx','cash-flow-export.js'],cachebusterOnly:true,version,structuralPermissions:'PASS',buildPages:'PASS',site,financialWrites:0};
 fs.writeFileSync(path.join(privateDir,'release-manifest.json'),JSON.stringify(result,null,2)+'\n');const out=path.join(root,'docs/qa/evidence/cash-flow-criteria');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'release-candidate.json'),JSON.stringify({...result,site:undefined},null,2)+'\n');console.log(JSON.stringify({...result,site:undefined}));
}
if(require.main===module)main();
