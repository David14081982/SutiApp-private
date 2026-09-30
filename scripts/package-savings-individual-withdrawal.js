'use strict';
const fs=require('fs'),path=require('path'),cp=require('child_process'),assert=require('assert/strict'),vm=require('vm'),crypto=require('crypto');
const root=path.resolve(__dirname,'..'),release=path.join(root,'.tmp/savings-individual-withdrawal/release'),read=f=>fs.readFileSync(path.join(root,f),'utf8'),hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const git=f=>cp.execFileSync('git',['-C',release,'show','HEAD:'+f],{maxBuffer:30*1024*1024}).toString('utf8');
const norm=s=>s.replace(/\r\n/g,'\n');
const focal=['savings-panel-admin.jsx','savings-runtime-admin.jsx'],added=['savings-individual-withdrawal-repository.js','savings-individual-withdrawal.jsx'];
for(const name of focal)assert.equal(norm(git('app/'+name)),norm(read('.tmp/savings-individual-withdrawal/before/app/'+name)),'remote source drift '+name);
const parse=s=>s.split(/(?=\/\* @@file )/).filter(Boolean).map(bytes=>({name:bytes.match(/^\/\* @@file (.*?) \*\//)[1],bytes}));
const compile=name=>`/* @@file ${name} */\n(function(){\n${norm(read('app/'+name)).trimEnd()}\n})();\n`;
const old=parse(git('app/bundle.js')),bundle=old.map(c=>(c.name==='savings-runtime-admin.jsx'?added.map(compile).join(''):'')+(focal.includes(c.name)?compile(c.name):c.bytes)).join('');
new vm.Script(bundle);const next=parse(bundle);for(const c of old)if(!focal.includes(c.name))assert.equal(next.find(x=>x.name===c.name).bytes,c.bytes);
const files=[...focal.map(n=>'app/'+n),...added.map(n=>'app/'+n),'supabase/migrations/20260930000100_savings_individual_withdrawal.sql','supabase/recovery/20260930000100_savings_individual_withdrawal.sql','scripts/fixtures/savings-individual-withdrawal-schema.json','docs/audits/H-SAVINGS-INDIVIDUAL-WITHDRAWAL-UX-001.md'];
for(const name of fs.readdirSync(path.join(root,'scripts')))if(name.includes('savings-individual-withdrawal'))files.push('scripts/'+name);
for(const f of files){fs.mkdirSync(path.dirname(path.join(release,f)),{recursive:true});fs.copyFileSync(path.join(root,f),path.join(release,f));}
fs.writeFileSync(path.join(release,'app/bundle.js'),bundle);
let builder=git('scripts/build-bundle.js');assert(builder.includes("'savings-panel-repository.js',"));builder=builder.replace("'savings-panel-repository.js',","'savings-panel-repository.js', 'savings-individual-withdrawal-repository.js', 'savings-individual-withdrawal.jsx',");fs.writeFileSync(path.join(release,'scripts/build-bundle.js'),builder);
const bundleVersion=Number(git('SutiApp.html').match(/app\/bundle\.js\?v=(\d+)/)[1])+1;
for(const f of ['SutiApp.html','sw.js']){let text=git(f);text=text.replace(/app\/bundle\.js\?v=\d+/g,'app/bundle.js?v='+bundleVersion);text=f==='sw.js'?text.replace(/sutiapp-v(\d+)/,(_,v)=>'sutiapp-v'+(Number(v)+1)):text.replace(/sw\.js\?v=(\d+)/,(_,v)=>'sw.js?v='+(Number(v)+1));fs.writeFileSync(path.join(release,f),text);}
for(const f of ['docs/SOURCE_OF_TRUTH.md','docs/AGENT_CHANGELOG.md']){
 const text=read(f),marker=f.includes('SOURCE')?'# Retiro individual desde expediente':'# 2026-09-30 — H-SAVINGS-INDIVIDUAL-WITHDRAWAL-UX-001';const pos=text.indexOf(marker);assert(pos>=0);let section=text.slice(pos).trim();const following=section.indexOf('\n# ',1);if(following>=0)section=section.slice(0,following);
 fs.writeFileSync(path.join(release,f),git(f).trimEnd()+'\n\n'+section+'\n');
}
const evidence='docs/qa/evidence/savings-individual-withdrawal';fs.mkdirSync(path.join(release,evidence),{recursive:true});for(const f of fs.readdirSync(path.join(root,evidence)))fs.copyFileSync(path.join(root,evidence,f),path.join(release,evidence,f));
const proof={status:'PASS',base:cp.execFileSync('git',['-C',release,'rev-parse','HEAD'],{encoding:'utf8'}).trim(),changed:focal,added,preservedPublishedChunks:old.length-focal.length,bundleSha256:hash(bundle),normalizedBundleSha256:hash(norm(bundle)),generatedCachebustersOnly:true};
for(const dir of [root,release])fs.writeFileSync(path.join(dir,evidence,'release-package.json'),JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
