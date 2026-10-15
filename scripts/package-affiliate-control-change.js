'use strict';
// Isolated current-main release. Exact two-source baseline guards; no unrelated
// workspace bundle or governance sections are copied over published content.
const fs=require('fs'),path=require('path'),cp=require('child_process'),assert=require('assert/strict'),vm=require('vm'),crypto=require('crypto');
const root=path.resolve(__dirname,'..'),release=path.join(root,'.tmp/affiliate-control-change/release');
const norm=s=>s.replace(/\r\n/g,'\n'),read=(f,b=root)=>norm(fs.readFileSync(path.join(b,f),'utf8'));
const put=(f,s)=>{const p=path.join(release,f);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,s);};
const git=a=>cp.execFileSync('git',['-C',release,...a],{encoding:'utf8',windowsHide:true,maxBuffer:64*1024*1024}).trimEnd();
const names=['admin-affiliates-repository.js','screens-admin-affiliates.jsx'];
const before=read('app/bundle.js',release),chunks=s=>[...s.matchAll(/\/\* @@file ([^\r\n]+) \*\/\n[\s\S]*?(?=\/\* @@file |$)/g)],parts=chunks(before);
assert.equal(parts.map(p=>p[0]).join(''),before);
const box={};vm.createContext(box);vm.runInContext(fs.readFileSync('C:/tmp/babel-standalone-7.29.0.min.js','utf8'),box);
const compiled={};
for(const name of names){
 assert.equal(read('app/'+name,release),read('.tmp/affiliate-control-change/before/app/'+name),'REMOTE_SOURCE_CHANGED '+name);
 const source=read('app/'+name),code=name.endsWith('.jsx')?box.Babel.transform(source,{presets:['react'],filename:name}).code:source.trimEnd();
 compiled[name]='/* @@file '+name+' */\n(function(){\n'+code+'\n})();\n';
 assert.equal(chunks(read('app/bundle.js')).find(c=>c[1]===name)[0],compiled[name],'LOCAL_BUNDLE_MISMATCH');
 put('app/'+name,source);
}
const next=parts.map(p=>compiled[p[1]]||p[0]).join('');new vm.Script(next);
for(const p of parts)if(!names.includes(p[1]))assert.equal(chunks(next).find(c=>c[1]===p[1])[0],p[0]);
put('app/bundle.js',next);
const html=read('SutiApp.html',release),sw=read('sw.js',release);
const version=Math.max(...[...html.matchAll(/(?:bundle\.js\?v=|sw\.js\?v=)(\d+)/g),...sw.matchAll(/(?:sutiapp-v|bundle\.js\?v=)(\d+)/g)].map(m=>Number(m[1])))+1;
const clear=s=>s.replace(/(app\/bundle\.js\?v=|sw\.js\?v=|sutiapp-v)\d+/g,'$1VERSION');
for(const [f,s] of [['SutiApp.html',html],['sw.js',sw]]){
 const updated=s.replace(/(app\/bundle\.js\?v=|sw\.js\?v=|sutiapp-v)\d+/g,(_,prefix)=>prefix+version);
 assert.equal(clear(updated),clear(s));put(f,updated);
}
const support=[
 'supabase/migrations/20261015000100_affiliate_control_change.sql','supabase/recovery/20261015000100_affiliate_control_change.sql',
 'scripts/inspect-affiliate-control-change.py','scripts/release-affiliate-control-change.py',
 'scripts/test-affiliate-control-change.js','scripts/test-affiliate-control-change-browser.js',
 'scripts/test-affiliate-control-change-catalog.js','scripts/test-affiliate-control-change-concurrency.py',
 'scripts/build-affiliate-control-change.js','scripts/package-affiliate-control-change.js',
 'scripts/verify-affiliate-control-change-live.js','scripts/fixtures/affiliate-control-change-schema.json',
 'docs/audits/H-AFFILIATE-CONTROL-CHANGE-001.md'];
for(const f of support)put(f,read(f));
const headers={
 'docs/DECISIONS.md':'## H-AFFILIATE-CONTROL-CHANGE-001',
 'docs/INVARIANTS.md':'## H-AFFILIATE-CONTROL-CHANGE-001',
 'docs/AGENT_CHANGELOG.md':'## H-AFFILIATE-CONTROL-CHANGE-001',
 'docs/SOURCE_OF_TRUTH.md':'## Cambio administrativo de número',
 'docs/MIGRATION_RULES.md':'## 20261015000100'
};
for(const [f,header] of Object.entries(headers)){
 const local=read(f),start=local.indexOf(header);assert(start>=0);
 const end=local.indexOf('\n## ',start+3),section=local.slice(start,end<0?undefined:end).trimEnd();
 let current=read(f,release);assert(!current.includes(header),'SECTION_ALREADY_PRESENT '+f);
 const firstLine=current.indexOf('\n');put(f,current.slice(0,firstLine+1)+'\n'+section+'\n'+current.slice(firstLine+1));
}
const overrides=JSON.parse(read('docs/architecture/architecture-overrides.json',release)),local=JSON.parse(read('docs/architecture/architecture-overrides.json'));
const node=local.nodes.find(n=>n.name==='public.change_admin_affiliate_control');assert(node);assert(!overrides.nodes.some(n=>n.name===node.name));overrides.nodes.unshift(node);
put('docs/architecture/architecture-overrides.json',JSON.stringify(overrides,null,2)+'\n');
fs.cpSync(path.join(root,'docs/qa/evidence/affiliate-control-change'),path.join(release,'docs/qa/evidence/affiliate-control-change'),{recursive:true});
const result={status:'PASS',baseCommit:git(['rev-parse','HEAD']),changedChunks:names,unrelatedPublishedChunksPreserved:parts.length-2,bundleSha256:crypto.createHash('sha256').update(next).digest('hex'),version,workerLogicIdentical:true,previousPublishedContentPreserved:true,published:false};
for(const base of [root,release])fs.writeFileSync(path.join(base,'docs/qa/evidence/affiliate-control-change/release-package.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result));
