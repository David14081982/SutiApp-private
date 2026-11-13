'use strict';
const assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),vm=require('vm'),crypto=require('crypto');
const root=path.resolve(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8'),checks=[];
async function check(name,fn){try{await fn();checks.push({name,status:'PASS'});}catch(e){checks.push({name,status:'FAIL',error:e.message});}}
function fixture({clone=false,storageThrows=false}={}){
 const stored=new Map(),ids=[],uploads=[],state={error:{error:'TRUNCATED_DOCUMENT',recoverable:false},context:'self'},session={user:{id:'synthetic-user'},access_token:'x.'+Buffer.from(JSON.stringify({session_id:'synthetic-session'})).toString('base64')+'.x'};
 const window={PrivateResourceDemand:{context:()=>state.context},AffiliateAuth:{getState:()=>({session,affiliate:{id:'synthetic'}})},DocumentTransfer:{hash:async()=>'a'.repeat(64),upload:async(db,p)=>{uploads.push(p.id);return{};}}};
 window.SutiSupabase={getClient:()=>({rpc:async()=>({data:{document_id:null}}),functions:{invoke:async(name,{body})=>{
  if(body.action==='PREPARE'){ids.push(body.operation_id);return{data:{id:body.operation_id,state:'PREPARED'}};}
  if(state.error)return clone?{error:{context:{clone:()=>({json:async()=>state.error})}}}:{data:state.error,error:Error('HTTP')};
  return{data:{status:'COMPLETE',document:{id:'document'}}};
 }}})};
 const sandbox={window,sessionStorage:{getItem:k=>stored.get(k),setItem:(k,v)=>stored.set(k,v),removeItem:k=>{if(storageThrows)throw Error('STORAGE_BLOCKED');stored.delete(k);}},crypto:crypto.webcrypto,TextEncoder,atob:s=>Buffer.from(s,'base64').toString(),URL,Map,location:{hostname:'localhost'}};
 vm.runInNewContext(read('app/document-integration.js'),sandbox);
 return{stored,ids,uploads,state,upload:()=>window.DocumentIntegration.upload({id:'type'},{size:10,type:'image/jpeg'})};
}
(async()=>{
 for(const clone of [false,true])await check('terminal error propagation and fresh retry, clone='+clone,async()=>{const f=fixture({clone});await assert.rejects(f.upload(),e=>e.code==='TRUNCATED_DOCUMENT'&&e.recoverable===false&&e.documentPhase==='verifying');assert.equal(f.stored.size,0);f.state.error=null;await f.upload();assert.notEqual(f.ids[0],f.ids[1]);assert.equal(f.stored.size,0);});
 await check('transient COMPLETE retry keeps same operation',async()=>{const f=fixture();f.state.error={error:'DOCUMENT_BYTES_UNAVAILABLE',recoverable:true};await assert.rejects(f.upload());assert.equal(f.stored.size,1);f.state.error=null;await f.upload();assert.equal(f.ids[0],f.ids[1]);assert.equal(f.stored.size,0);});
 await check('old server without recoverable field preserves retry',async()=>{const f=fixture();f.state.error={error:'DOCUMENT_OPERATION_UNAVAILABLE'};await assert.rejects(f.upload(),e=>e.recoverable===true);assert.equal(f.stored.size,1);});
 await check('version conflict resets handle',async()=>{const f=fixture();f.state.error={error:'DOCUMENT_VERSION_CONFLICT',recoverable:true};await assert.rejects(f.upload());assert.equal(f.stored.size,0);});
 await check('storage cleanup exception cannot mask original error',async()=>{const f=fixture({storageThrows:true});await assert.rejects(f.upload(),e=>e.code==='TRUNCATED_DOCUMENT'&&e.documentPhase==='verifying');});
 // Exercise the actual React component/event handlers, with isolated boundary adapters.
 const {chromium}=require(process.env.SUTIAPP_PLAYWRIGHT_PATH||'C:/tmp/sutiapp-playwright-audit/node_modules/playwright-core');
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 try{for(const [code,recoverable,expected]of [['TRUNCATED_DOCUMENT',false,'Toma la foto de nuevo'],['INVALID_IMAGE_DIMENSIONS',false,'menor resolución'],['DOCUMENT_BYTES_UNAVAILABLE',true,'recuperar la misma carga']])await check('real upload UI: '+code,async()=>{
  const page=await browser.newPage({viewport:{width:390,height:844}});page.setDefaultTimeout(5000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
  try{const css=read('SutiApp.html').match(/<style>([\s\S]*?)<\/style>/)[1];await page.setContent('<style>'+css+'</style><main id="root"></main>');for(const f of ['app/vendor/react-18.3.1/react.production.min.js','app/vendor/react-dom-18.3.1/react-dom.production.min.js'])await page.addScriptTag({content:read(f)});
   await page.evaluate(({code,recoverable})=>{window.Icon=()=>null;window.Sheet=({open,children})=>open?React.createElement('aside',null,children):null;window.PrivateResourceDemand={context:()=>1,useContext:()=>1};window.DocumentWorkflowRepository={upload:async()=>{throw Object.assign(Error(code),{code,recoverable,documentPhase:'verifying'});}};}, {code,recoverable});
   await page.addScriptTag({content:read('app/screens-documentos.jsx')});
   await page.evaluate(()=>ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(UnifiedDocumentPhase,{requirements:[{id:'type',document_type_id:'type',label:'Foto perfil',accepted_mime_types:['image/jpeg']}],documents:[],phase:'ready',onChanged:()=>{throw Error('Unexpected registration');}})));
   await page.getByRole('button',{name:/Adjuntar/}).first().click();await page.getByRole('button',{name:/Archivo|Galería/i}).first().click();
   await page.locator('input[type=file]').setInputFiles({name:'synthetic.jpg',mimeType:'image/jpeg',buffer:Buffer.from('isolated fixture')});
   await page.waitForFunction(text=>document.body.innerText.includes(text),expected);assert.deepEqual(errors,[]);
   await page.screenshot({path:path.join(root,'docs/qa/evidence/document-jpeg-trailer/ui-'+code+'.png')});
  }finally{await page.close();}
 });}finally{await browser.close();}
 const result={status:checks.every(c=>c.status==='PASS')?'PASS':'FAIL',syntheticOnly:true,checks};fs.mkdirSync(path.join(root,'docs/qa/evidence/document-jpeg-trailer'),{recursive:true});fs.writeFileSync(path.join(root,'docs/qa/evidence/document-jpeg-trailer/client.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));if(result.status!=='PASS')process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1;});
