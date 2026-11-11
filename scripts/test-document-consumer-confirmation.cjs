'use strict';
// Real consumer functions and repository confirmation marker; synthetic React/RPC adapters.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),baseline=process.argv.includes('--baseline'),base='f6cfae303ce32c6d2102fce5a664f4292f596118';
const sources=new Map();
const read=file=>{if(!sources.has(file))sources.set(file,baseline?execFileSync('git',['show',base+':'+file],{cwd:root,encoding:'utf8'}):fs.readFileSync(path.join(root,file),'utf8'));return sources.get(file);};
const specs=[
 {name:'Membership',file:'app/screens-membership-application.jsx',component:'MembershipApplicationScreen',marker:'    const requiredRequirements=',expose:'{load,phase,requirements,documents,terms,paymentQuote,error}'},
 {name:'Loan',file:'app/screens-loan.jsx',component:'LoanScreen',marker:'    React.useEffect(()=>{loadDocuments();',expose:'{load:loadDocuments,...documentState}'},
 {name:'Product',file:'app/screens-program-product-payment.jsx',component:'Application',marker:'    const gate=documentSelection',expose:'{load,...docState}'},
 {name:'Renta',file:'app/renta-car.jsx',component:'Application',marker:'  const latest=new Map();documents.rows',expose:'{load,...documents,documents:documents.rows}'},
];
const type={id:'synthetic-type',label:'Documento',accepted_mime_types:['application/pdf'],max_file_size_bytes:104857600};
const old={id:'synthetic-v1',affiliate_id:'synthetic-affiliate',document_type_id:type.id,status:'PENDING_REVIEW',created_at:'2026-11-10T10:00:00Z',available:true,availability:'AVAILABLE'};
const requirement={document_type_id:type.id,required:true,document_type:type};
const results=[];
const plain=x=>JSON.parse(JSON.stringify(x));
const tick=()=>new Promise(resolve=>setImmediate(resolve));
async function test(name,run){try{await run();results.push({name,status:'PASS'});}catch(e){results.push({name,status:'FAIL',error:e.message});}}
function setup(spec){
 let context=1,scope='synthetic-offering',cursor=0,queue=[],reads=0,termsReads=0,quoteReads=0,requirementReads=0,batching=false;
 const updates=[];
 const hooks=[];
 const React={
  useState(initial){const id=cursor++;if(!(id in hooks))hooks[id]=typeof initial==='function'?initial():initial;return[hooks[id],value=>{const apply=()=>{hooks[id]=typeof value==='function'?value(hooks[id]):value;};if(batching)updates.push(apply);else apply();}];},
  useRef(initial){const id=cursor++;if(!(id in hooks))hooks[id]={current:initial};return hooks[id];},
  useMemo(fn){cursor++;return fn();},useCallback(fn){cursor++;return fn;},useEffect(){cursor++;},memo:fn=>fn,createElement(){return null;},Fragment:'fragment',
 };
 const window={PrivateResourceDemand:{context:()=>context,useContext:()=>context},AffiliateAuth:{getState:()=>({affiliate:{id:'synthetic-affiliate'}})},
  DocumentIntegration:{enabled:()=>true,normalizeFile:file=>file,upload:async uploadedType=>({...old,id:'synthetic-v2-'+uploadedType.id,document_type_id:uploadedType.id,created_at:'2026-11-10T11:00:00Z'})},
  membershipStore:{get:id=>({id})},ProgramRequestRepository:{newIdempotencyKey:()=> 'synthetic-idempotency'},
  ProgramTermsRepository:{current:async()=>{termsReads++;return{id:'synthetic-terms'};}},MembershipRepository:{paymentQuote:async()=>{quoteReads++;return{quote_hash:'synthetic-quote',financialResult:{}};}},
 };
 const box={window,React,crypto:crypto.webcrypto,console,setTimeout,clearTimeout,Map,Set,WeakMap,Object,Date,Promise,TextEncoder};
 vm.runInNewContext(fs.readFileSync(path.join(root,'app/document-workflow-repository.js'),'utf8'),box);
 const realRepository=window.DocumentWorkflowRepository;
 window.DocumentWorkflowRepository={...realRepository,requirements:async()=>{requirementReads++;return[requirement];},resolveRequirements:async()=>{requirementReads++;return[requirement];},
  listSelfDocuments:()=>{reads++;return queue.length?queue.shift()():Promise.resolve([old]);}};
 let source=read(spec.file);assert(source.includes(spec.marker),'CONSUMER_SOURCE_BOUNDARY');
 source=source.replace(spec.marker,'    return '+spec.expose+';\n'+spec.marker);
 source=source.replace(/\}\)\(\);\s*$/,'window.__consumer='+spec.component+';})();');
 vm.runInNewContext(source,box,{filename:spec.file});
 const render=()=>{cursor=0;return window.__consumer({app:{user:{},affiliate:{}},params:{id:scope},item:{id:scope},quote:{},session:{}});};
 return{render,queue,reads:()=>reads,allReads:()=>reads+termsReads+quoteReads+requirementReads,setContext:value=>{context=value;},setScope:value=>{scope=value;},
  beginBatch:()=>{batching=true;},flushBatch:()=>{batching=false;while(updates.length)updates.shift()();},
  confirmed:(uploadedType=type)=>realRepository.upload(uploadedType,{name:'synthetic.pdf',type:'application/pdf',size:32},{source:'file'})};
}
(async()=>{
 for(const spec of specs){
  await test(spec.name+': failed list preserves prior rows in error phase',async()=>{
   const h=setup(spec);await h.render().load();const previous=plain(h.render().documents);
   h.queue.push(()=>Promise.reject(Error('SYNTHETIC_READ_FAILED')));await h.render().load();const state=h.render();
   assert.equal(state.phase,'error');assert.deepEqual(plain(state.documents),previous);
  });
  await test(spec.name+': confirmed callback merges V2 without another read',async()=>{
   const h=setup(spec);await h.render().load();const confirmed=await h.confirmed(),count=h.allReads();
   await h.render().load(confirmed);const state=h.render();assert.equal(h.allReads(),count);assert.equal(state.phase,'ready');
   assert.equal(state.documents.length,1);assert.equal(state.documents[0],confirmed);assert.equal(state.documents[0].available,true);
  });
  await test(spec.name+': confirmation never converts an error into ready',async()=>{
   const h=setup(spec);await h.render().load();h.queue.push(()=>Promise.reject(Error('SYNTHETIC_READ_FAILED')));await h.render().load();
   const confirmed=await h.confirmed(),count=h.allReads();await h.render().load(confirmed);const state=h.render();
   assert.equal(state.phase,'error');assert.equal(state.documents[0],confirmed);assert.equal(h.allReads(),count);
  });
  await test(spec.name+': late response from another identity is discarded',async()=>{
   const h=setup(spec);await h.render().load();let resolve;h.queue.push(()=>new Promise(done=>{resolve=done;}));
   const pending=h.render().load();await tick();h.setContext(2);resolve([{...old,id:'foreign-late-response'}]);await pending;
   assert.notEqual(h.render().documents[0]?.id,'foreign-late-response');assert.notEqual(h.render().phase,'ready');
  });
  await test(spec.name+': confirmation cancels older query without stale submission result',async()=>{
   const h=setup(spec);await h.render().load();let resolve;h.queue.push(()=>new Promise(done=>{resolve=done;}));
   const pending=h.render().load();await tick();const confirmed=await h.confirmed(),count=h.allReads();await h.render().load(confirmed);
   resolve([old]);const staleResult=await pending,state=h.render();assert.equal(h.allReads(),count);
   assert.equal(state.documents[0],confirmed);assert.equal(state.phase,'ready');assert.equal(staleResult,null);
   if(spec.name==='Membership'){assert(state.paymentQuote,'CONFIRMED_QUOTE_LOST_DURING_CANCELLED_READ');assert(state.terms);}
  });
  await test(spec.name+': explicit retry still queries the authority',async()=>{
   const h=setup(spec);h.queue.push(()=>Promise.reject(Error('SYNTHETIC_READ_FAILED')));await h.render().load();
   const count=h.reads();await h.render().load();assert.equal(h.reads(),count+1);assert.equal(h.render().phase,'ready');
  });
  await test(spec.name+': confirmation during retry of failed read stays error, never stuck loading',async()=>{
   const h=setup(spec);await h.render().load();h.queue.push(()=>Promise.reject(Error('SYNTHETIC_READ_FAILED')));await h.render().load();
   let resolve;h.queue.push(()=>new Promise(done=>{resolve=done;}));const pending=h.render().load();await tick();
   const confirmed=await h.confirmed();await h.render().load(confirmed);resolve([old]);await pending;
   const state=h.render();assert.equal(state.phase,'error');assert.equal(state.documents[0],confirmed);
  });
  await test(spec.name+': receipt in a new context cannot authorize unqueried requirements',async()=>{
   const h=setup(spec);await h.render().load();h.setContext(2);const confirmed=await h.confirmed();await h.render().load(confirmed);
   const state=h.render();assert.equal(state.phase,'error');assert.equal(state.requirements.length,0);assert.equal(state.documents[0],confirmed);
  });
  await test(spec.name+': batched confirmations of two types both survive',async()=>{
   const h=setup(spec);await h.render().load();const first=await h.confirmed(),second=await h.confirmed({...type,id:'synthetic-type-2'});
   h.beginBatch();await h.render().load(first);await h.render().load(second);h.flushBatch();
   const state=h.render();assert(state.documents.includes(first));assert(state.documents.includes(second));assert.equal(state.phase,'ready');
  });
  await test(spec.name+': old identity callback cannot cancel the new identity read',async()=>{
   const h=setup(spec);await h.render().load();const stale=h.render().load;
   h.setContext(2);let resolve;h.queue.push(()=>new Promise(done=>{resolve=done;}));
   const pending=h.render().load();await tick();const reads=h.allReads();await stale();
   assert.equal(h.allReads(),reads,'STALE_CALLBACK_STARTED_READ');resolve([{...old,id:'new-identity-authoritative'}]);await pending;
   const state=h.render();assert.equal(state.phase,'ready');assert.equal(state.documents[0].id,'new-identity-authoritative');
  });
  if(spec.name!=='Loan')await test(spec.name+': old item callback cannot cancel the new item read',async()=>{
   const h=setup(spec);await h.render().load();const stale=h.render().load;
   h.setScope('synthetic-offering-B');let resolve;h.queue.push(()=>new Promise(done=>{resolve=done;}));
   const pending=h.render().load();await tick();const reads=h.allReads();await stale();
   assert.equal(h.allReads(),reads,'STALE_SCOPE_CALLBACK_STARTED_READ');resolve([{...old,id:'new-item-authoritative'}]);await pending;
   const state=h.render();assert.equal(state.phase,'ready');assert.equal(state.documents[0].id,'new-item-authoritative');
  });
  await test(spec.name+': original markup, styles and preceding calculations unchanged',()=>{
   const original=execFileSync('git',['show',base+':'+spec.file],{cwd:root,encoding:'utf8'}).replace(/\r\n/g,'\n'),current=read(spec.file).replace(/\r\n/g,'\n');
   const marker=spec.name==='Loan'?'    if (submission)':spec.marker;
   assert.equal(current.slice(current.indexOf(marker)),original.slice(original.indexOf(marker)));
   const component='function '+spec.component+'(';
   assert.equal(current.slice(0,current.indexOf(component)),original.slice(0,original.indexOf(component)));
  });
 }
 const loan=read('app/screens-loan.jsx');
 const start=loan.indexOf('    const submit = async () => {',loan.indexOf('  function LoanScreen(')),end=loan.indexOf('    if (submission)',start);
 assert(start>=0&&end>start,'LOAN_SUBMIT_SOURCE_BOUNDARY');
 for(const code of ['DOCUMENT_NOT_CURRENT','DOCUMENT_OPERATION_CHANGED','DOCUMENT_BYTES_UNAVAILABLE']){
  await test('Loan: '+code+' refreshes documents without automatic resubmission',async()=>{
   let sends=0,loads=0,step=null,error='';
   const box={window:{ProgramCatalogRepository:{listItems:async()=>[{id:'synthetic-item',program_key:'prestamo',requestMode:'supabase'}]},ProgramRequestRepository:{},financialLegacyStore:{confirmLoanSession:async()=>{sends++;throw Object.assign(Error(code),{code});}}},
    canContinue:true,setSubmitting:()=>{},setSubmitError:value=>{error=value;},setStep:value=>{step=value;},setSimulation:()=>{},setDocumentRecovery:()=>{},setSubmission:()=>{},
    loadDocuments:async()=>{loads++;return{requirements:[requirement],documents:[old],terms:{id:'synthetic-terms'}};},resolveLoanDocuments:()=>({selected:[old],missing:[]}),
    missingLoanDocumentsMessage:()=> 'missing',simulation:{result:{amount:1,paymentCount:1},program:{id:'synthetic-program'}},options:{},signature:'synthetic-signature',accepted:true,
    idempotencyKey:{current:'synthetic-idempotency'},selectedDepositAccount:{id:'synthetic-account'},deposit:{phone:'SYNTHETIC_PHONE'},loadDeposit:async()=>{},
   };
   vm.runInNewContext(loan.slice(start,end)+'\nthis.submit=submit;',box);await box.submit();
   assert.equal(sends,1);assert.equal(loads,2);assert.equal(step,2);
   assert(code==='DOCUMENT_BYTES_UNAVAILABLE'?/verificar|documento/i.test(error):/versi[oó]n|documento.*cambi/i.test(error));
  });
 }
 const result={status:results.every(x=>x.status==='PASS')?'PASS':'FAIL',baseline,baselineRef:base,recordedAt:new Date().toISOString(),passed:results.filter(x=>x.status==='PASS').length,failed:results.filter(x=>x.status==='FAIL').length,tests:results,
  sourceHashes:Object.fromEntries(specs.map(s=>[s.file,crypto.createHash('sha256').update(read(s.file)).digest('hex')])),repositoryHash:crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'app/document-workflow-repository.js'))).digest('hex'),
  limits:['Synthetic React hook scheduling and RPC responses; no browser layout certification','Real consumer functions and repository WeakMap confirmation/merge','No database, network, real data, financial rules, build or deployment']};
 console.log(JSON.stringify(result,null,2));if(result.failed)process.exitCode=1;
})().catch(error=>{console.error(error);process.exitCode=1;});
