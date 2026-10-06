'use strict';
// Focal release from clean remote main; preserve unrelated deployed/workspace code.
const fs=require('fs'),path=require('path'),cp=require('child_process'),assert=require('assert/strict'),crypto=require('crypto');
const root=path.resolve(__dirname,'..'),release=path.join(root,'.tmp/loan-dated-fund-cutoff/release');
const norm=s=>s.replace(/\r\n/g,'\n'),read=(f,base=root)=>norm(fs.readFileSync(path.join(base,f),'utf8'));
const git=(args,cwd=release)=>cp.execFileSync('git',args,{cwd,encoding:'utf8',windowsHide:true,maxBuffer:32*1024*1024}).trimEnd();
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const put=(f,s)=>{const p=path.join(release,f);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,s);};
const files=[
 'supabase/functions/financial-legacy/visibility-policy.js',
 'supabase/migrations/20261005000100_loan_dated_fund_cutoff.sql',
 'supabase/recovery/20261005000100_loan_dated_fund_cutoff.sql',
 'scripts/test-financial-program-visibility.mjs','scripts/test-loan-dated-fund-cutoff.js',
 'scripts/package-loan-dated-fund-cutoff.js','docs/audits/H-LOAN-DATED-FUND-CUTOFF-001.md',
 'docs/qa/evidence/loan-dated-fund-cutoff/isolated.json',
];
const docs=['docs/DECISIONS.md','docs/INVARIANTS.md','docs/SOURCE_OF_TRUTH.md','docs/AGENT_CHANGELOG.md'];
const allowed=new Set([...files,...docs,'docs/qa/evidence/loan-dated-fund-cutoff/release-package.json','docs/qa/evidence/loan-dated-fund-cutoff/frontend-parity.json']);
const changes=git(['diff','--name-only']).split('\n').filter(Boolean);
for(const f of changes)assert(allowed.has(f),'UNEXPECTED_RELEASE_CHANGE: '+f);
const baseCommit=git(['rev-parse','HEAD']);
for(const f of files.slice(0,1).concat('scripts/test-financial-program-visibility.mjs')){
 assert.equal(norm(git(['show','HEAD:'+f])).trimEnd(),norm(git(['show','HEAD:'+f],root)).trimEnd(),'REMOTE_FOCAL_BASE_CHANGED: '+f);
}
const protectedFiles=['app/bundle.js','SutiApp.html','sw.js','supabase/functions/financial-legacy/index.ts','app/financial-legacy-repository.js'];
const protectedHashes=Object.fromEntries(protectedFiles.map(f=>[f,sha(fs.readFileSync(path.join(release,f)))]));
for(const f of files)put(f,read(f));
for(const f of docs){
 const local=read(f),marker='## H-LOAN-DATED-FUND-CUTOFF-001',start=local.indexOf(marker);
 assert(start>=0,'MISSING_FOCAL_SECTION: '+f);
 const end=local.indexOf('\n## ',start+marker.length),section=local.slice(start,end<0?undefined:end).trimEnd();
 // Preserve existing mixed line endings verbatim; never normalize other Hs.
 const previous=cp.execFileSync('git',['show','HEAD:'+f],{cwd:release,encoding:'utf8',windowsHide:true,maxBuffer:32*1024*1024});
 assert(!previous.includes(marker),'REMOTE_ALREADY_CONTAINS_TASK: '+f);
 const titleEnd=previous.indexOf('\n');assert(titleEnd>0);
 put(f,previous.slice(0,titleEnd+1)+'\n'+section+'\n\n'+previous.slice(titleEnd+1));
}
for(const [f,h] of Object.entries(protectedHashes))assert.equal(sha(fs.readFileSync(path.join(release,f))),h,'UNRELATED_PUBLISHED_FILE_CHANGED: '+f);
const report={status:'PASS',baseCommit,files:[...files,...docs],protectedPublishedFiles:protectedHashes,frontendChanged:false,backendPublished:false};
const target='docs/qa/evidence/loan-dated-fund-cutoff/release-package.json';
for(const dir of [root,release])fs.writeFileSync(path.join(dir,target),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report));
