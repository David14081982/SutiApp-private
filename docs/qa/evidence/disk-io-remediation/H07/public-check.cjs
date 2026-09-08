'use strict';
const fs=require('fs'),cp=require('child_process'),crypto=require('crypto'),assert=require('assert').strict,a=require('./audit.cjs');
const release='C:/tmp/sutiapp-h07-release-20260907',base='https://david14081982.github.io/SutiApp-private/';
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
(async()=>{
 const commit=cp.execFileSync('git',['rev-parse','HEAD'],{cwd:release,encoding:'utf8'}).trim();
 const build=fs.readFileSync(release+'/scripts/build-pages-site.js','utf8'),files=[...build.match(/const publicFiles = \[([\s\S]*?)\];/)[1].matchAll(/'([^']+)'/g)].map(x=>x[1]);
 const rows=[];
 for(const f of [...files,'index.html','app/supabase-config.js']){
  const expected=f==='app/supabase-config.js'?fs.readFileSync(fs.readFileSync('C:/tmp/sutiapp-h07-current-site.txt','utf8').trim()+'/'+f):cp.execFileSync('git',['show',commit+':'+(f==='index.html'?'SutiApp.html':f)],{cwd:release,maxBuffer:15000000});
  const response=await fetch(base+f+'?h07='+commit,{headers:{'Cache-Control':'no-cache'},signal:AbortSignal.timeout(20000)}),actual=Buffer.from(await response.arrayBuffer());
  rows.push({file:f,http:response.status,bytes:actual.length,expected_sha256:hash(expected),actual_sha256:hash(actual),equal:response.ok&&expected.equals(actual)});
 }
 const pass=rows.every(x=>x.equal);a.save('public-check-'+(process.argv[2]||'deployment'),{at:new Date().toISOString(),status:pass?'PASS':'FAIL',commit,rows});console.log(JSON.stringify({status:pass?'PASS':'FAIL',commit,files:rows.length,failures:rows.filter(x=>!x.equal).map(x=>x.file)}));assert(pass);
})().catch(e=>{console.error(e.message);process.exitCode=1;});
