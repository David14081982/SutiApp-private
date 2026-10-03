'use strict';
// Run inside the isolated publication checkout. Rebuild only audited Savings chunks.
const fs=require('fs'),path=require('path'),vm=require('vm'),cp=require('child_process'),crypto=require('crypto'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),baseline=process.argv[2];assert(/^[a-f0-9]{40}$/.test(baseline||''),'BASELINE_COMMIT_REQUIRED');
const git=(...args)=>cp.execFileSync('git',args,{cwd:root,encoding:'utf8',windowsHide:true,maxBuffer:64*1024*1024});
assert.equal(git('rev-parse','HEAD').trim(),baseline,'BUILD_BASELINE_DRIFT');
const read=f=>fs.readFileSync(path.join(root,f),'utf8'),original=f=>git('show',baseline+':'+f),norm=s=>s.replace(/\r\n/g,'\n').trimEnd(),hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const focal=['savings-certification-admin.jsx','savings-panel-admin.jsx','savings-panel-repository.js','screens-savings.jsx'];
const parse=s=>s.split(/(?=\/\* @@file )/).filter(Boolean).map(bytes=>{const m=bytes.match(/^\/\* @@file (.*?) \*\//);assert(m);return {name:m[1],bytes};});
const box={};vm.createContext(box);vm.runInContext(fs.readFileSync(process.env.SUTIAPP_BABEL_PATH||'C:/tmp/babel-standalone-7.29.0.min.js','utf8'),box);
const compile=(source,name,babel)=>babel?box.Babel.transform(norm(source),{presets:['react'],filename:name}).code:norm(source);
const chunk=(name,source)=>`/* @@file ${name} */\n(function(){\n${source}\n})();\n`;
const prior=original('app/bundle.js'),old=parse(prior),modes={};
for(const name of focal){const oldSource=original('app/'+name),found=old.find(x=>x.name===name);assert(found,'MISSING_BUNDLE_CHUNK');
 if(found.bytes===chunk(name,compile(oldSource,name,false)))modes[name]=false;
 else if(found.bytes===chunk(name,compile(oldSource,name,true)))modes[name]=true;
 else throw Error('BASELINE_SOURCE_BUNDLE_DRIFT:'+name);
}
const result=old.map(x=>focal.includes(x.name)?chunk(x.name,compile(read('app/'+x.name),x.name,modes[x.name])):x.bytes).join('');new vm.Script(result);
const next=parse(result);for(const c of old)if(!focal.includes(c.name))assert.equal(next.find(x=>x.name===c.name).bytes,c.bytes);
const panel=read('app/savings-panel-admin.jsx');assert(panel.includes('SavingsRhReport'),'EXISTING_RH_SURFACE_LOST');
fs.writeFileSync(path.join(root,'app/bundle.js'),result);
for(const f of ['SutiApp.html','sw.js']){let value=original(f).replace(/app\/bundle\.js\?v=(\d+)/g,(_,n)=>'app/bundle.js?v='+(Number(n)+1));
 value=f==='sw.js'?value.replace(/sutiapp-v(\d+)/,(_,n)=>'sutiapp-v'+(Number(n)+1)):value.replace(/sw\.js\?v=(\d+)/,(_,n)=>'sw.js?v='+(Number(n)+1));fs.writeFileSync(path.join(root,f),value);
}
const proof={status:'PASS',at:new Date().toISOString(),baseline,baselineSourceBundleEquivalent:true,compiler:modes,changed:focal,preservedChunks:old.length-focal.length,baselineBundleSha256:hash(prior),bundleSha256:hash(result),bundleVersion:Number(read('SutiApp.html').match(/app\/bundle\.js\?v=(\d+)/)[1]),workerLogicUnchanged:true,existingRhPreserved:true,financialWrites:0};
const out=path.join(root,'docs/qa/evidence/savings-automatic-contributions');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'build.json'),JSON.stringify(proof,null,2)+'\n');console.log(JSON.stringify(proof));
