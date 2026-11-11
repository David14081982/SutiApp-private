'use strict';
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../../../../..'),out=__dirname;
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const suites=['test-loan-history.js','test-history-snapshot-runtime.js','test-history-total-paid-runtime.js','test-history-native-pending-runtime.js','test-loan-historical-resolution.js','test-loan-available-credit.js','test-loan-available-credit-edge.js','test-loan-available-credit-sql.js','test-native-financial-rules.js','test-financial-mostrar-override.js'];
const baseline=cp.execFileSync('git',['-c','safe.directory='+root,'rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
const report={startedAt:new Date().toISOString(),baselineCommit:baseline,status:'RUNNING',productionWrites:0,network:'Blocked by offline-preload.cjs; original scripts unchanged',checks:[],limits:['Offline synthetic regression; not production account validation.','Some inherited SQL suites use minimal authorization fixtures; not E2E Auth/Storage.']};
for(const script of suites){
 const dir=path.join(out,script.replace(/\.js$/,''));fs.mkdirSync(dir,{recursive:true});
 const full=path.join(root,'scripts',script),started=Date.now();
 const result=cp.spawnSync(process.execPath,['--require',path.join(out,'offline-preload.cjs'),full],{cwd:root,env:{...process.env,SUTI_OFFLINE_RUN_DIR:dir,SUTI_HISTORY_EVIDENCE_DIR:dir,SUTI_CAPACITY_ROOT:root,SUTIAPP_PGLITE_PATH:'C:/Users/david/Downloads/SutiApp/.tmp/savings-loan-eligibility/node_modules/@electric-sql/pglite',LOAN_CAPACITY_PGLITE_MODULE:'C:/Users/david/Downloads/SutiApp/.tmp/savings-loan-eligibility/node_modules/@electric-sql/pglite'},encoding:'utf8',windowsHide:true,timeout:150000,maxBuffer:4*1024*1024});
 const stdout=result.stdout||'',stderr=result.stderr||'';fs.writeFileSync(path.join(dir,'stdout.txt'),stdout);fs.writeFileSync(path.join(dir,'stderr.txt'),stderr);
 const item={script:'scripts/'+script,sourceSha256:sha(fs.readFileSync(full)),status:result.status===0?'PASS':'FAIL',exitCode:result.status,durationMs:Date.now()-started,error:result.error?.code||null,stdoutPassLines:stdout.split(/\r?\n/).filter(l=>l.startsWith('PASS ')).length};
 report.checks.push(item);console.log(JSON.stringify(item));fs.writeFileSync(path.join(out,'offline-regression.json'),JSON.stringify(report,null,2)+'\n');
}
report.status=report.checks.every(c=>c.status==='PASS')?'PASS':'FAIL';report.completedAt=new Date().toISOString();
fs.writeFileSync(path.join(out,'offline-regression.json'),JSON.stringify(report,null,2)+'\n');process.exitCode=report.status==='PASS'?0:1;
