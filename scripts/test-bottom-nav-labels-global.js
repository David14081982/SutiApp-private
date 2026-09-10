'use strict';
// Existing global regression, unchanged assertions/timeouts/corpus, using HTTP/1.1
// for this host's reproducible HTTP/2 transport stalls. Never modifies app flags.
const fs=require('fs'),cp=require('child_process'),crypto=require('crypto'),assert=require('assert').strict;
const h=require('./test-text-size-helpers');
(async()=>{
 const production=process.argv.includes('--production'),site=production?null:await h.serve();
 try{
  const file='scripts/test-global-image-regression-production-live.js',source=fs.readFileSync(h.root+'/'+file,'utf8');
  const originalRoot="const root = path.resolve(__dirname, '..');",explicitRoot='const root = '+JSON.stringify(h.root)+';';
  const originalFlags="'--disable-gpu']",testFlags="'--disable-gpu', '--disable-http2', '--disable-quic']";
  assert(source.includes(originalRoot)&&source.includes(originalFlags));
  const configured=source.replace(originalRoot,explicitRoot).replace(originalFlags,testFlags);
  assert.equal(configured.replace(explicitRoot,originalRoot).replace(testFlags,originalFlags),source,'No assertion or corpus changes allowed');
  const script=h.privateDir+'/global-nav-http1.js';fs.writeFileSync(script,configured);
  const output=await new Promise((resolve,reject)=>{
   const p=cp.spawn(process.execPath,[script],{cwd:h.root,env:{...process.env,SUTIAPP_IMAGE_E2E_URL:production?'https://david14081982.github.io/SutiApp-private/':site.url}});let stdout='',stderr='';
   p.stdout.on('data',d=>stdout+=d);p.stderr.on('data',d=>stderr+=d);p.on('error',reject);p.on('close',code=>code===0?resolve(stdout):reject(Error(stderr||stdout||'Global regression failed')));
  });
  const result=JSON.parse(output.trim());result.harness={file,sha256:crypto.createHash('sha256').update(source.replace(/\r\n/g,'\n')).digest('hex'),concurrency:12,originalImageTimeoutMs:20000,browserTransport:'HTTP_1_1',launchFlags:['--disable-http2','--disable-quic'],assertionOrCorpusChanges:0,privateRootExplicit:true};
  fs.writeFileSync(h.root+'/docs/qa/evidence/bottom-nav-labels-20260909/global-'+(production?'production':'local')+'.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
 }finally{if(site)await new Promise(r=>site.server.close(r));}
})().catch(e=>{console.error(e.message);process.exitCode=1;});
