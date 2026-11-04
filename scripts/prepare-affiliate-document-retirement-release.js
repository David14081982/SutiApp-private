'use strict';
// Preserve every published bundle module except the two audited Afiliados sources.
const fs=require('fs'),path=require('path'),cp=require('child_process'),vm=require('vm'),assert=require('assert/strict'),crypto=require('crypto');
const root=path.resolve(__dirname,'..'),dir=path.join(root,'.tmp/affiliate-document-retirement'),target=path.join(dir,'release'),out=path.join(root,'docs/qa/evidence/affiliate-document-retirement');
const version='2026110403',base='8dc6112ef4b9a58bb914070e0cda6e507b5b4392',sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const modules=['admin-affiliates-repository.js','screens-admin-affiliates.jsx'];
const scripts=fs.readdirSync(path.join(root,'scripts')).filter(n=>/^(inspect|generate|test|release|verify|prepare)-affiliate-document-retirement.*\.(js|py)$/.test(n)).map(n=>'scripts/'+n);
const files=[...modules.map(f=>'app/'+f),...scripts,'scripts/fixtures/affiliate-document-retirement-schema.json','supabase/migrations/20261104000400_affiliate_document_retirement.sql','supabase/recovery/20261104000400_affiliate_document_retirement.sql','supabase/functions/affiliate-document-delete/index.ts','supabase/functions/affiliate-document-delete/handler.mjs','docs/audits/H-AFILIADOS-ELIMINACION-INDIVIDUAL-DOCUMENTOS-001.md'];
const git=args=>cp.execFileSync('git',['-c','safe.directory='+target.replaceAll('\\','/'),...args],{cwd:target,encoding:'utf8',maxBuffer:32*1024*1024});
const baseline=file=>git(['show',base+':'+file]),sections=s=>new Map([...s.matchAll(/^\/\* @@file ([^\r\n]+) \*\/\r?\n[\s\S]*?(?=^\/\* @@file |$(?![\s\S]))/gm)].map(m=>[m[1],m[0]]));
function main(){
 assert.equal(git(['rev-parse','HEAD']).trim(),base,'RELEASE_BASE_DRIFT');
 for(const name of modules)assert.equal(baseline('app/'+name).replace(/\r\n/g,'\n'),fs.readFileSync(path.join(dir,'before',name),'utf8').replace(/\r\n/g,'\n'),'FOCAL_SOURCE_BASE_DRIFT');
 const before=baseline('app/bundle.js'),map=sections(before);assert(map.size>100);let bundle=before;
 const box={};vm.createContext(box);vm.runInContext(fs.readFileSync('C:/tmp/babel-standalone-7.29.0.min.js','utf8'),box);
 for(const name of modules){const source=fs.readFileSync(path.join(root,'app',name),'utf8').replace(/\r\n/g,'\n');new vm.Script(source);const code=name.endsWith('.jsx')?box.Babel.transform(source,{presets:['react'],filename:name}).code:source;const old=map.get(name);assert(old,name);bundle=bundle.replace(old,()=>'/* @@file '+name+' */\n(function(){\n'+code.trimEnd()+'\n})();\n');}
 new vm.Script(bundle);const after=sections(bundle);assert.equal(map.size,after.size);for(const[name,text]of map)if(!modules.includes(name))assert.equal(after.get(name),text,'UNRELATED_MODULE_CHANGED:'+name);
 for(const file of files){const destination=path.join(target,file);fs.mkdirSync(path.dirname(destination),{recursive:true});fs.copyFileSync(path.join(root,file),destination);}
 fs.writeFileSync(path.join(target,'app/bundle.js'),bundle);
 const html=baseline('SutiApp.html'),oldVersion=html.match(/app\/bundle\.js\?v=(\d+)/)[1];
 for(const file of ['SutiApp.html','sw.js']){const original=baseline(file);assert(original.includes(oldVersion));fs.writeFileSync(path.join(target,file),original.replaceAll(oldVersion,version));}
 fs.mkdirSync(out,{recursive:true});const proof={status:'PASS',base,version,target,sourceFiles:files,preservedPublishedModules:map.size-modules.length,modifiedModules:modules,bundleSha256:sha(bundle),sourceHashes:Object.fromEntries(modules.map(f=>[f,sha(fs.readFileSync(path.join(root,'app',f)))])),cachebusterOnly:true};fs.writeFileSync(path.join(out,'assembly.json'),JSON.stringify(proof,null,2)+'\n');
 for(const file of fs.readdirSync(out)){const dest=path.join(target,'docs/qa/evidence/affiliate-document-retirement',file);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.cpSync(path.join(out,file),dest,{recursive:true});}
 console.log(JSON.stringify(proof));
}
main();
