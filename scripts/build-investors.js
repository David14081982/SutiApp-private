'use strict';
// Focal build: no unrelated compiled section may change, even in a dirty workspace.
const fs=require('fs'),path=require('path'),vm=require('vm'),crypto=require('crypto'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),baseline=path.join(root,'.tmp/inversores'),lf=s=>s.replace(/\r\n/g,'\n');
const fresh=['investors-model.js','investors-repository.js','investors-admin.jsx'];
const read=f=>lf(fs.readFileSync(path.join(root,f),'utf8'));
const sections=s=>new Map([...s.matchAll(/^\/\* @@file ([^\n]+) \*\/\n[\s\S]*?(?=^\/\* @@file |$(?![\s\S]))/gm)].map(m=>[m[1],m[0]]));
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
function main(){
 let bundle=read('app/bundle.js');const before=sections(bundle),old=before.get('screens-admin.jsx');assert(old,'ADMIN_SECTION_MISSING');
 const previous=lf(fs.readFileSync(path.join(baseline,'app/screens-admin.jsx'),'utf8')),current=read('app/screens-admin.jsx');
 const removed=current.split('\n').filter(l=>!l.includes("id:'inversores'")&&!l.includes("inversores:'program_requests.read'")&&!l.includes("view==='inversores'")).join('\n');assert.equal(removed,previous,'UNRELATED_ADMIN_SOURCE_CHANGED');
 const box={};vm.createContext(box);vm.runInContext(fs.readFileSync(process.env.SUTIAPP_BABEL_PATH||'C:/tmp/babel-standalone-7.29.0.min.js','utf8'),box);
 const prefix='/* @@file screens-admin.jsx */\n(function(){\n',suffix='\n})();\n';assert(old.startsWith(prefix)&&old.endsWith(suffix));
 const compile=s=>box.Babel.transform(lf(s),{presets:['react'],filename:'screens-admin.jsx'}).code;
 // Baseline source must describe the executable Admin section before patching.
 const originalBundle=sections(lf(fs.readFileSync(path.join(baseline,'app/bundle.js'),'utf8'))).get('screens-admin.jsx');
 assert.equal(compile(previous),compile(originalBundle.slice(prefix.length,-suffix.length)),'BASELINE_ADMIN_SOURCE_BUNDLE_MISMATCH');
 const block=prefix+compile(current)+suffix;bundle=bundle.replace(old,()=>block);
 let additions='';for(const name of fresh){const code=read('app/'+name).trimEnd();new vm.Script(code,{filename:name});additions+='/* @@file '+name+' */\n(function(){\n'+code+'\n})();\n';if(before.has(name))bundle=bundle.replace(before.get(name),'');}
 const anchor=sections(bundle).get('reports-jc-admin.jsx');assert(anchor);bundle=bundle.replace(anchor,()=>anchor+additions);
 assert(bundle.indexOf('/* @@file investors-model.js')<bundle.indexOf('/* @@file investors-admin.jsx'),'DEPENDENCY_ORDER');
 const after=sections(bundle);for(const [name,section]of before)if(!fresh.includes(name)&&name!=='screens-admin.jsx')assert.equal(after.get(name),section,'UNRELATED_BUNDLE_CHANGED:'+name);
 new vm.Script(bundle);fs.writeFileSync(path.join(root,'app/bundle.js'),bundle);
 const result={status:'PASS',newModules:fresh,preservedModules:[...before.keys()].filter(n=>!fresh.includes(n)&&n!=='screens-admin.jsx').length,adminDelta:'four additive lines',bundleSha256:sha(bundle),globalTestsRun:false};fs.mkdirSync(path.join(root,'docs/qa/evidence/investors'),{recursive:true});fs.writeFileSync(path.join(root,'docs/qa/evidence/investors/build.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
}
main();
