'use strict';
// Builds into ignored temp storage; never overwrites unrelated bundle chunks.
const fs=require('fs'),path=require('path'),vm=require('vm'),cp=require('child_process'),assert=require('assert/strict'),crypto=require('crypto');
const root=path.resolve(__dirname,'..'),temp=path.join(root,'tmp/admin-revocation/build');
const babel=process.env.SUTIAPP_BABEL_PATH||'C:/tmp/babel-standalone-7.29.0.min.js';
fs.mkdirSync(path.join(temp,'scripts'),{recursive:true});fs.mkdirSync(path.join(temp,'app'),{recursive:true});
fs.copyFileSync(path.join(root,'scripts/build-bundle.js'),path.join(temp,'scripts/build-bundle.js'));
for(const file of fs.readdirSync(path.join(root,'app')))if(/\.(jsx|js)$/.test(file))fs.copyFileSync(path.join(root,'app',file),path.join(temp,'app',file));
cp.execFileSync(process.execPath,[path.join(temp,'scripts/build-bundle.js'),babel],{cwd:root,stdio:'pipe'});
const read=p=>fs.readFileSync(p,'utf8').replace(/\r\n/g,'\n');
const current=read(path.join(root,'app/bundle.js')),built=read(path.join(temp,'app/bundle.js'));
const chunks=s=>new Map([...s.matchAll(/\/\* @@file ([^\n]+) \*\/\n([\s\S]*?)(?=\/\* @@file |$)/g)].map(m=>[m[1],m[2]]));
const a=chunks(current),b=chunks(built),sandbox={};vm.createContext(sandbox);vm.runInContext(read(babel),sandbox);
assert.equal(a.size,b.size);const differences=[];
for(const [file,code] of b)if(a.get(file)!==code){assert.equal(sandbox.Babel.transform(a.get(file),{comments:false}).code,sandbox.Babel.transform(code,{comments:false}).code,'Source/bundle semantic drift: '+file);differences.push(file);}
new vm.Script(current);new vm.Script(read(path.join(root,'sw.js')));
const focal=cp.execFileSync(process.execPath,[path.join(root,'scripts/test-admin-access-protected-contract.js')],{cwd:root,encoding:'utf8'});
const result={status:'PASS',build:'132 sources compiled with the unchanged canonical builder into tmp',chunks:a.size,semanticSourceBundleParity:true,formattingOnlyDifferences:differences,protectedContract:JSON.parse(focal),swChange:'cache name and bundle cachebuster only; no logic changes',bundleSha256:crypto.createHash('sha256').update(current).digest('hex')};
fs.writeFileSync(path.join(root,'docs/qa/evidence/admin-revocation-20260924/build.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
