'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const root=path.resolve(__dirname,'..'),results=[];
const type={id:'synthetic-type',label:'Documento',accepted_mime_types:['application/pdf']};
const file={name:'synthetic.pdf',type:'application/pdf',size:100};
const row={id:'synthetic-document',affiliate_id:'synthetic-affiliate',document_type_id:type.id,status:'PENDING_REVIEW',private_asset_id:'synthetic-asset',created_at:'2026-11-10T00:00:00Z'};
function setup(returned=row){let epoch=1,calls=0;const window={AffiliateAuth:{getState:()=>({affiliate:{id:'synthetic-affiliate'}})},PrivateResourceDemand:{context:()=>epoch},DocumentIntegration:{enabled:()=>true,normalizeFile:x=>x,upload:async()=>{calls++;return returned;}}};vm.runInNewContext(fs.readFileSync(path.join(root,'app/document-workflow-repository.js'),'utf8'),{window,WeakMap,Object,crypto:require('node:crypto').webcrypto});return{window,repo:window.DocumentWorkflowRepository,change:()=>epoch++,calls:()=>calls};}
async function check(name,run){try{await run();results.push({name,status:'PASS'});}catch(e){results.push({name,status:'FAIL',error:e.message});}}
// Execute the real hook functions. Only React scheduling and the two remote reads
// are synthetic; receipts still come from the actual Workflow upload/WeakMap.
function readerHarness(kind){
 const source=fs.readFileSync(path.join(root,'app/screens-documentos.jsx'),'utf8'),base=setup(),slots=[],reads=[];
 let cursor=0,identity=1,effects=[],published;
 const useRef=value=>{const index=cursor++;if(!slots[index])slots[index]={current:value};return slots[index];};
 const useState=value=>{const index=cursor++;if(!(index in slots))slots[index]=value;return[slots[index],next=>{slots[index]=typeof next==='function'?next(slots[index]):next;}];};
 const read=name=>new Promise((resolve,reject)=>reads.push({name,resolve,reject}));
 const context={window:{PrivateResourceDemand:{context:()=>identity,useContext:()=>identity},DocumentWorkflowRepository:{
  isConfirmedDocument:base.repo.isConfirmedDocument,mergeConfirmedDocuments:base.repo.mergeConfirmedDocuments,
  resolveRequirements:()=>read('requirements'),catalog:()=>read('catalog'),listSelfDocuments:()=>read('documents'),
 }},React:{useCallback:callback=>callback},useRef,useState,useMemo:callback=>callback(),useEffect:callback=>effects.push(callback),
 h:(_component,props)=>props,UnifiedDocumentPhase:'isolated child',Set,Date,Object,Math};
 const start=source.indexOf('  function '+(kind==='gate'?'DocumentRequestGate(':'useDocuments('));
 const end=source.indexOf(kind==='gate'?'  function useDocuments(':'  function DocumentosScreen(',start);
 assert(start>=0&&end>start);
 vm.createContext(context);
 vm.runInContext(source.slice(source.indexOf('  const ACCEPTED='),source.indexOf('  function DocumentRequirementList('))+source.slice(start,end),context);
 return{
  reads,receipt:()=>base.repo.upload(type,file),changeContext(){identity++;base.change();},
  render(scope='A'){
   cursor=0;effects=[];published=undefined;
   const value=kind==='gate'?context.DocumentRequestGate({scopeType:'PROGRAM',scopeKey:scope,onState:result=>{published=result;}}):context.useDocuments();
   if(kind==='gate')effects.at(-1)(); // Publish real readiness; explicitly drive load instead of mounting effects.
   return kind==='gate'?{state:value,result:published,load:value.onChanged}:{state:value[0],load:value[1]};
  },
  resolveFrom(start,values={}){for(const request of reads.slice(start))request.resolve(values[request.name]||[]);},
 };
}
(async()=>{
await check('PostgreSQL confirmation immediately yields reusable projection, without a second read',async()=>{const s=setup(),doc=await s.repo.upload(type,file);assert.equal(doc.available,true);assert.equal(doc.availability,'AVAILABLE');assert.equal(doc.mimeType,'application/pdf');assert.equal(doc.status,'PENDING_REVIEW');assert.equal(s.repo.isConfirmedDocument(doc),true);assert.equal(s.calls(),1);const merged=s.repo.mergeConfirmedDocuments([{...row,id:'prior',created_at:'2026-11-09T00:00:00Z'}],doc);assert.equal(merged.length,1);assert.equal(merged[0].id,row.id);s.change();assert.equal(s.repo.isConfirmedDocument(doc),false);});
await check('Foreign owner, wrong type and unregistered responses cannot become confirmed documents',async()=>{for(const invalid of [{...row,affiliate_id:'foreign'},{...row,document_type_id:'wrong'},{affiliate_id:row.affiliate_id}])await assert.rejects(setup(invalid).repo.upload(type,file));});
await check('Forged objects cannot replace canonical current documents',async()=>{const s=setup();assert.equal(s.repo.isConfirmedDocument({...row}),false);assert.throws(()=>s.repo.mergeConfirmedDocuments([row],{...row}));});
await check('An idempotent V1 receipt never replaces a known V2',async()=>{const s=setup(),doc=await s.repo.upload(type,file),next={...row,id:'synthetic-v2',replaces_document_id:row.id,created_at:'2026-11-10T01:00:00Z'};assert.equal(s.repo.mergeConfirmedDocuments([next],doc)[0].id,next.id);const reviewed={...row,status:'REUPLOAD_REQUIRED',available:false};assert.equal(s.repo.mergeConfirmedDocuments([reviewed],doc)[0],reviewed);});
await check('A changed context during preparation cannot start another owner upload',async()=>{const s=setup();s.window.DocumentIntegration.normalizeFile=x=>{s.change();return x;};await assert.rejects(s.repo.upload(type,file));assert.equal(s.calls(),0);});
await check('The existing upload handler publishes confirmation before waiting for refresh',async()=>{const source=fs.readFileSync(path.join(root,'app/screens-documentos.jsx'),'utf8'),start=source.indexOf('const upload=async(event)=>'),end=source.indexOf('    useEffect(()=>{if(!camera)',start);let busy,received,error;let settle;const pending=new Promise(r=>settle=r),repo=setup().repo;const context={window:{DocumentWorkflowRepository:repo,PrivateResourceDemand:{context:()=>1}},selection:{current:{type,source:'file'}},setBusy:x=>busy=x,setError:x=>error=x,resourceContext:1,busy:null,onChanged:async doc=>{received=doc;await pending;}};vm.createContext(context);vm.runInContext(source.slice(start,end).replace('const upload=','globalThis.upload='),context);const work=context.upload({target:{files:[file],value:'x'}});for(let n=0;n<8;n++)await Promise.resolve();assert.equal(busy,null);assert.equal(received?.id,row.id);settle();await work;assert.equal(error,undefined);});
for(const kind of ['gate','documents']){
 await check(kind+': obsolete A callback cannot invalidate pending B read',async()=>{
  const h=readerHarness(kind),old=h.render('A').load;
  if(kind==='documents')h.changeContext();
  const current=h.render('B'),work=current.load(),count=h.reads.length;
  await old();assert.equal(h.reads.length,count,'obsolete callback must not issue another read');
  const document={...row,available:true,status:'VERIFIED'};
  h.resolveFrom(0,{requirements:[{document_type_id:type.id,required:true}],catalog:[type],documents:[document]});
  await work;const next=h.render('B');assert.equal(next.state.phase,'ready','current B read must survive the stale callback');
  if(kind==='gate'){assert.equal(next.result.ready,true);assert.equal(next.state.requirements[0].document_type_id,type.id);}
  else assert.equal(next.state.types[0].id,type.id);
 });
 await check(kind+': confirmed upload cannot authorize unresolved requirements/catalog; explicit retry recovers',async()=>{
  const h=readerHarness(kind),first=h.render('A'),initial=first.load(),receipt=await h.receipt();
  await first.load(receipt);const partial=h.render('A');assert.notEqual(partial.state.phase,'ready');
  if(kind==='gate'){assert.equal(partial.result.ready,false);assert.equal(partial.result.missing,null);assert.equal(partial.state.documents[0].id,row.id);}
  else assert.equal(partial.state.docs[0].id,row.id);
  h.resolveFrom(0);await initial;assert.notEqual(h.render('A').state.phase,'ready','cancelled initial read must not promote empty requirements');
  const offset=h.reads.length,retry=h.render('A').load();h.resolveFrom(offset,{requirements:[{document_type_id:type.id,required:true}],catalog:[type],documents:[{...row,available:true}]});
  await retry;const recovered=h.render('A');assert.equal(recovered.state.phase,'ready');if(kind==='gate')assert.equal(recovered.result.ready,true);
 });
}
const output={checks:results,pass:results.filter(x=>x.status==='PASS').length,fail:results.filter(x=>x.status==='FAIL').length,isolation:'Actual Workflow and screen hook functions in VM; synthetic remote reads and React scheduling; no network or user data',sourceSha256:Object.fromEntries(['app/document-workflow-repository.js','app/screens-documentos.jsx'].map(file=>[file,require('node:crypto').createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex')]))};console.log(JSON.stringify(output,null,2));const arg=process.argv.indexOf('--out');if(arg>=0){fs.mkdirSync(path.dirname(process.argv[arg+1]),{recursive:true});fs.writeFileSync(process.argv[arg+1],JSON.stringify(output,null,2)+'\n');}if(output.fail)process.exitCode=1;
})();
