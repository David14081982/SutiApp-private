'use strict';
const fs=require('fs'),path=require('path'),cp=require('child_process');
const {root,privateDir,serve}=require('./test-text-size-helpers');
(async()=>{const local=process.argv[2]?null:await serve(),url=process.argv[2]||local.url;try{
 const child=cp.spawn(process.execPath,[path.join(root,'scripts/test-global-image-regression-production-live.js')],{cwd:root,env:{...process.env,SUTIAPP_IMAGE_E2E_URL:url},windowsHide:true});let stdout='',stderr='';child.stdout.on('data',d=>stdout+=d);child.stderr.on('data',d=>stderr+=d);const code=await new Promise(resolve=>child.on('close',resolve));fs.writeFileSync(path.join(privateDir,url.startsWith('http:')?'global-local.log':'global-production.log'),stdout+'\n'+stderr);
 const line=stdout.trim().split(/\r?\n/).at(-1);if(code!==0){console.log(stderr);process.exitCode=1;return;}const result=JSON.parse(line),out=path.join(root,'docs/qa/evidence/text-size-20260909');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,url.startsWith('http:')?'global-local.json':'global-production.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({status:result.status,target:result.target,surfaces:result.initial.surfaces,productionDataMutations:result.productionDataMutations}));
 }finally{if(local)local.server.close();}})().catch(e=>{console.error(e.message);process.exitCode=1;});
