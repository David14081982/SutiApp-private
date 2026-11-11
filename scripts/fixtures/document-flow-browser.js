/* Isolated browser fixture. Not imported by the product build; no external requests. */
(() => {
  const listeners=new Set(),id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
  const token=revision=>`synthetic.${btoa(JSON.stringify({sub:id(1),session_id:id(2),revision}))}.not-a-signature`;
  let auth={phase:'authenticated',session:{user:{id:id(1)},access_token:token(1)},affiliate:{id:id(3),numero_control:'SYNTHETIC-ONLY'}};
  const types=['image/png','application/pdf'].map((mime,i)=>({id:id(10+i),code:'synthetic_'+i,label:'Documento sintético '+i,accepted_mime_types:[mime,'image/jpeg'],camera_allowed:true,file_upload_allowed:true,max_file_size_bytes:104857600}));
  const raw=(n,i)=>({document_id:id(n),affiliate_id:id(3),document_type_id:types[i].id,document_type_label:types[i].label,document_status:'VERIFIED',created_at:'2026-01-01T00:00:00Z',mime_type:types[i].accepted_mime_types[0],available:true,availability:'AVAILABLE'});
  let docs=[raw(20,0),raw(21,1)],held=null;
  const calls=[],operations=new Map(),control={readError:new URLSearchParams(location.search).get('scenario')==='read-error',holdTransfer:false,loseComplete:false};
  window.AffiliateAuth={getState:()=>auth,subscribe:fn=>{listeners.add(fn);return()=>listeners.delete(fn);}};
  window.AdminRepository={getState:()=>({phase:'ready',subjectKey:'synthetic-admin',assignment:{role:'TEST_ONLY'}}),subscribe:()=>()=>{},has:()=>true};
  window.__SUTIAPP_CONFIG__={documentIntegration:'LOCAL_PHASE4',supabase:{url:location.origin}};
  window.membershipStore={get:()=>({id:id(40),empresa:'SYNTHETIC ONLY',concepto:'Prueba local documental'})};
  window.ProgramRequestRepository={newIdempotencyKey:()=>id(41),createMembership:()=>{throw Error('SUBMISSION_FORBIDDEN_IN_FIXTURE');}};
  window.ProgramTermsRepository={current:async()=>({id:id(42),content:'Términos sintéticos'})};
  window.MembershipRepository={paymentQuote:async()=>({quote_hash:'SYNTHETIC',financialResult:{paymentPerPeriod:1,paymentCount:1,paymentPeriod:'quincenal',total:1}})};
  const okay=data=>({data,error:null});
  const db={auth:{getSession:async()=>okay({session:auth.session})},rpc:async(name,args)=>{
    calls.push({kind:'rpc',name});
    if(name==='get_effective_affiliate_id')return okay(auth.affiliate.id);
    if(name==='resolve_effective_document_requirements')return okay(types.map((t,i)=>({requirement_id:id(30+i),document_type_id:t.id,document_type_label:t.label,document_type_code:t.code,required:true,accepted_mime_types:t.accepted_mime_types,max_file_size_bytes:t.max_file_size_bytes})));
    if(name==='list_effective_affiliate_documents')return control.readError?{data:null,error:Error('SYNTHETIC_READ_FAILURE')}:okay(docs);
    if(name==='document_upload_context')return okay({document_id:docs.find(d=>d.document_type_id===args.p_type)?.document_id||null});
    throw Error('UNIMPLEMENTED_SYNTHETIC_RPC_'+name);
  },functions:{invoke:async(name,{body})=>{
    calls.push({kind:'edge',name,action:body.action||body.mode,operationId:body.operation_id||null});
    if(name==='document-access'){const d=docs.find(d=>d.document_id===body.association_id),pdf=d?.mime_type==='application/pdf';return okay({signedUrl:location.origin+(pdf?'/fixture.pdf':'/fixture.png'),expiresIn:30,mimeType:pdf?'application/pdf':'image/png'});}
    if(name!=='document-operation')throw Error('UNIMPLEMENTED_SYNTHETIC_EDGE');
    if(body.action==='PREPARE'){
      if(!operations.has(body.operation_id))operations.set(body.operation_id,{type:body.document_type_id,mime:body.mime,expected:body.expected_document_id,state:'PREPARED'});
      const op=operations.get(body.operation_id);return okay({state:op.state,operation_id:body.operation_id,bucket:'synthetic-only',path:'synthetic-only/'+body.operation_id});
    }
    if(body.action==='COMPLETE'){
      const op=operations.get(body.operation_id);if(!op)throw Error('SYNTHETIC_OPERATION_MISSING');
      if(!op.document){op.document={id:id(100+operations.size),affiliate_id:id(3),document_type_id:op.type,status:'PENDING_REVIEW',created_at:'2026-11-10T12:00:00Z',replaces_document_id:op.expected};op.state='COMPLETE';docs=[{document_id:op.document.id,affiliate_id:id(3),document_type_id:op.type,document_status:'PENDING_REVIEW',created_at:op.document.created_at,mime_type:op.mime,available:true,availability:'AVAILABLE'},...docs.filter(d=>d.document_type_id!==op.type)];calls.push({kind:'registered',id:op.document.id});}
      if(control.loseComplete){control.loseComplete=false;return{data:{error:'DOCUMENT_OPERATION_UNAVAILABLE'},error:Error('SYNTHETIC_RESPONSE_LOST')};}
      return okay({status:'COMPLETE',document:op.document});
    }
    throw Error('SYNTHETIC_MUTATION_FORBIDDEN');
  }},storage:{from:()=>({remove:()=>{calls.push({kind:'delete'});throw Error('DELETE_FORBIDDEN');},upload:()=>{throw Error('STANDARD_STORAGE_UPLOAD_FORBIDDEN');}})}};
  window.SutiSupabase={getClient:()=>db};
  window.DocumentTransfer={hash:async(file,check)=>{check();const digest=await crypto.subtle.digest('SHA-256',await file.arrayBuffer());check();return Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('').toUpperCase();},upload:async(_db,prepared,file,check)=>{calls.push({kind:'transfer',operationId:prepared.operation_id,size:file.size});if(control.holdTransfer)await new Promise(resolve=>{held=resolve;});check();return{error:null};}};
  window.__fixture={id,types,calls,control,release:()=>{control.holdTransfer=false;if(held){const done=held;held=null;done();}},refresh:()=>{auth={...auth,session:{...auth.session,access_token:token(2)}};listeners.forEach(fn=>fn());},state:()=>({operations:operations.size,registered:calls.filter(c=>c.kind==='registered').length,transfers:calls.filter(c=>c.kind==='transfer').length,lists:calls.filter(c=>c.name==='list_effective_affiliate_documents').length,deletes:calls.filter(c=>c.kind==='delete').length,prepares:calls.filter(c=>c.action==='PREPARE').map(c=>c.operationId),completes:calls.filter(c=>c.action==='COMPLETE').map(c=>c.operationId)})};
})();
