'use strict';
// Validates a concrete isolated release, never publishes or mutates production data.
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),vm=require('vm'),cp=require('child_process'),crypto=require('crypto');
const workspace=path.resolve(__dirname,'..'),release=process.argv.includes('--here')?workspace:path.join(workspace,'.tmp/sicof/release');
const read=file=>fs.readFileSync(path.join(release,file),'utf8'),hash=value=>crypto.createHash('sha256').update(value).digest('hex'),norm=value=>value.replace(/\r\n/g,'\n');
const git=args=>cp.execFileSync('git',['-C',release,...args],{encoding:'utf8',maxBuffer:32*1024*1024,windowsHide:true});
const original=file=>git(['show','HEAD:'+file]);
const parse=value=>value.split(/(?=\/\* @@file )/).filter(Boolean).map(bytes=>({name:bytes.match(/^\/\* @@file (.*?) \*\//)[1],bytes}));
const checks=[],test=(name,run)=>{run();checks.push({name,status:'PASS'});console.log('PASS '+name);};
const result=JSON.parse(read('docs/qa/evidence/sicof/frontend-release-package.json')),base=parse(original('app/bundle.js')),candidate=parse(read('app/bundle.js'));
test('current isolated HEAD is the verified published baseline',()=>assert.equal(git(['rev-parse','HEAD']).trim(),result.baselineCommit));
test('release has the recorded exact bundle hash and valid JavaScript',()=>{assert.equal(hash(read('app/bundle.js')),result.bundleSha256);new vm.Script(read('app/bundle.js'));new vm.Script(read('sw.js'));});
test('four approved source integrations and all four new modules match the frozen manifest',()=>{
 const manifest=JSON.parse(read('docs/qa/evidence/sicof/source-manifest.json'));
 for(const name of [...result.changed,...result.added])assert.equal(hash(fs.readFileSync(path.join(release,'app/'+name))),manifest.files.find(item=>item.file==='app/'+name).sha256,name);
});
test('all unrelated current production chunks survive byte-for-byte including RH',()=>{
 assert.equal(candidate.length,base.length+4);assert.equal(new Set(candidate.map(row=>row.name)).size,candidate.length);
 for(const row of base)if(!result.changed.includes(row.name))assert.equal(candidate.find(item=>item.name===row.name)?.bytes,row.bytes,row.name);
 assert.equal(base.length-4,result.preservedPublishedChunks);assert(candidate.some(row=>row.name==='savings-rh-report.jsx'));assert(candidate.some(row=>row.name==='savings-rh-repository.js'));
});
test('service worker logic and HTML differ only in required versions',()=>{
 const mask=value=>value.replace(/app\/bundle\.js\?v=\d+/g,'app/bundle.js?v=VERSION').replace(/sw\.js\?v=\d+/g,'sw.js?v=VERSION').replace(/sutiapp-v\d+/g,'sutiapp-vVERSION');
 for(const file of ['SutiApp.html','sw.js'])assert.equal(mask(read(file)),mask(original(file)),file);
 const html=read('SutiApp.html'),worker=read('sw.js');assert(html.includes('app/bundle.js?v='+result.bundleVersion));assert(worker.includes('app/bundle.js?v='+result.bundleVersion));assert(html.includes('sw.js?v='+result.workerVersion));assert(worker.includes('sutiapp-v'+result.workerVersion));
});
test('build registration adds only four modules and retains remote RH entries',()=>{
 const addition="// H-SICOF-001 integration: private repositories and focal UI dependencies.\nconst files = [\n  'sicof-repository.js', 'sicof-payment-behavior.jsx', 'sicof-admin.jsx', 'savings-period-breakdown.jsx',";
 assert.equal(read('scripts/build-bundle.js').replace(addition,'const files = ['),original('scripts/build-bundle.js'));
});
test('workflow public allowlist and existing Auth/request deployment guards unchanged',()=>{
 for(const file of ['.github/workflows/deploy-pages.yml','scripts/build-pages-site.js','scripts/screen-permission-contract.js','scripts/verify-auth-deployment-contract-live.js','scripts/verify-request-submission-deployment-contract-live.js'])assert.equal(read(file),original(file),file);
 const box={};vm.runInNewContext('this.files='+read('scripts/build-pages-site.js').match(/const publicFiles = (\[[\s\S]*?\]);/)[1],box);
 assert(box.files.includes('app/bundle.js'));assert(!box.files.some(file=>/\.(xlsx|env)$|(^|\/)(docs|scripts|supabase|Sicof-main|\.tmp)\//.test(file)));
});
test('only declared files changed and no workbook private backups or secrets enter release',()=>{
 const files=[...new Set([...git(['diff','--name-only']).trim().split('\n'),...git(['ls-files','--others','--exclude-standard']).trim().split('\n')].filter(Boolean))];
 for(const file of files){assert(result.files.includes(file),'UNEXPECTED_RELEASE_FILE:'+file);assert(!/\.(xlsx|env)$|(^|\/)\.tmp\/|supabase\.env|private.*\.json/i.test(file),'PRIVATE_RELEASE_FILE:'+file);}
 for(const name of result.added){const text=read('app/'+name);assert(!/sb_secret_[A-Za-z0-9_-]{10}|sbp_[A-Za-z0-9]{20}|-----BEGIN .*PRIVATE KEY-----/.test(text),'SECRET_IN_FRONTEND:'+name);}
});
if(process.argv.includes('--require-backend'))test('unchanged Pages guard accepts real installed SICOF catalog metadata',()=>{
 const metadata=JSON.parse(read('docs/qa/evidence/screen-permissions-20260924/production-metadata.json'));
 assert.equal(metadata.productionWrites,0);assert(metadata.sections.some(row=>row.module_key==='sicof'&&row.enforcement_status==='ENFORCED'));
 cp.execFileSync(process.execPath,['scripts/screen-permission-contract.js'],{cwd:release,encoding:'utf8',windowsHide:true});
});
let publicArtifact=null;
if(process.argv.includes('--build-pages'))test('real Pages build passes and emits only the public allowlist',()=>{
 assert(process.argv.includes('--require-backend'),'BUILD_REQUIRES_INSTALLED_BACKEND_METADATA');
 const env={...process.env},envFile=path.join(workspace,'supabase.env');
 if(fs.existsSync(envFile))for(const line of fs.readFileSync(envFile,'utf8').replace(/^\uFEFF/,'').split(/\r?\n/)){
  const match=line.match(/^(SUPABASE_URL|SUPABASE_PUBLISHABLE_KEY)=(.*)$/);if(match)env['SUTIAPP_'+match[1]]=match[2].trim().replace(/^['"]|['"]$/g,'');
 }
 publicArtifact='.tmp/sicof/public-artifact-'+Date.now();
 cp.execFileSync(process.execPath,['scripts/build-pages-site.js',publicArtifact],{cwd:release,env,encoding:'utf8',windowsHide:true,timeout:30000});
 assert.equal(hash(fs.readFileSync(path.join(release,publicArtifact,'app/bundle.js'))),result.bundleSha256);
 const collect=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?collect(path.join(dir,entry.name)):path.join(dir,entry.name));
 const emitted=collect(path.join(release,publicArtifact)).map(file=>path.relative(path.join(release,publicArtifact),file).replace(/\\/g,'/'));
 const box={};vm.runInNewContext('this.files='+read('scripts/build-pages-site.js').match(/const publicFiles = (\[[\s\S]*?\]);/)[1],box);
 assert.deepEqual(emitted.sort(),[...box.files,'index.html','.nojekyll','app/supabase-config.js'].sort());
});
if(!process.argv.includes('--static-only')){
 for(const name of ['test-sicof-ui-browser.js','test-sicof-integration-browser.js','test-sicof-attribution-browser.js']){
  test('isolated current release '+name,()=>cp.execFileSync(process.execPath,['scripts/'+name],{cwd:release,encoding:'utf8',windowsHide:true,timeout:180000,maxBuffer:8*1024*1024}));
 }
}
const proof={status:'PASS',checkedAt:new Date().toISOString(),baselineCommit:result.baselineCommit,bundleSha256:result.bundleSha256,checks,backendRegistrationChecked:process.argv.includes('--require-backend'),browserTestsRun:!process.argv.includes('--static-only'),publicArtifact,productionWrites:0,published:false};
for(const dir of [...new Set([workspace,release])]){const target=path.join(dir,'docs/qa/evidence/sicof/'+(process.argv.includes('--static-only')?'frontend-release-build.json':'frontend-release-verification.json'));fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,JSON.stringify(proof,null,2)+'\n');}
console.log(JSON.stringify(proof));
