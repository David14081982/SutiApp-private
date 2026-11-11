'use strict';
// Offline verification adapter only: original test sources are not modified.
const fs=require('node:fs'),path=require('node:path');
const run=path.resolve(process.env.SUTI_OFFLINE_RUN_DIR);
const oldEvidence=path.resolve(process.cwd(),'docs/qa/evidence');
const inside=(p,r)=>p===r||p.startsWith(r+path.sep);
function target(value){
 const p=path.resolve(String(value));
 if(inside(p,run))return p;
 if(inside(p,oldEvidence))return path.join(run,path.basename(p));
 throw Error('OFFLINE_WRITE_OUTSIDE_EVIDENCE_REFUSED');
}
const originalMkdir=fs.mkdirSync.bind(fs),originalWrite=fs.writeFileSync.bind(fs);
fs.mkdirSync=(p,...args)=>originalMkdir(inside(path.resolve(String(p)),oldEvidence)&&!inside(path.resolve(String(p)),run)?run:target(p),...args);
fs.writeFileSync=(p,...args)=>originalWrite(target(p),...args);
for(const name of ['appendFileSync','unlinkSync','rmSync','renameSync'])fs[name]=()=>{throw Error('OFFLINE_UNEXPECTED_MUTATION_REFUSED');};
const denied=()=>{throw Error('OFFLINE_NETWORK_REFUSED');};
global.fetch=async()=>denied();
for(const name of ['node:http','node:https']){const m=require(name);m.request=denied;m.get=denied;}
const net=require('node:net');net.connect=denied;net.createConnection=denied;net.Socket.prototype.connect=denied;
const cp=require('node:child_process');for(const name of ['exec','execSync','spawn','spawnSync','fork','execFile','execFileSync'])cp[name]=()=>{throw Error('OFFLINE_CHILD_PROCESS_REFUSED');};
