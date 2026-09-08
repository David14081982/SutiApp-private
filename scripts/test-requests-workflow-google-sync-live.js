'use strict';
// Explicit focused live acceptance. Uses the controlled QA account and existing real catalog/documents.
// Requests and their audit/Google rows are retained. No historical row, catalog or financial ledger is edited.
const fs=require('fs'),path=require('path'),assert=require('assert').strict,crypto=require('crypto');
const root=path.resolve(__dirname,'..'),mode=process.argv[2]||'status',env={};
const folder=path.join(root,'docs/qa/evidence/requests-workflow-google-sync-20260908'),stateFile=path.join(folder,'live-requests.json');
for(const line of fs.readFileSync(process.env.SUTIAPP_TEST_ENV_FILE||'C:/Users/david/OneDrive/Documentos/Sutiapp 20082026/supabase.env','utf8').replace(/^\uFEFF/,'').split(/\r?\n/)){const at=line.indexOf('=');if(at>0)env[line.slice(0,at).trim()]=line.slice(at+1).trim().replace(/^['"]|['"]$/g,'');}
const cases=fs.existsSync(stateFile)?JSON.parse(fs.readFileSync(stateFile,'utf8')):[];
const save=()=>fs.writeFileSync(stateFile,JSON.stringify(cases,null,2)+'\n');
const quote=v=>"'"+String(v).replace(/'/g,"''")+"'";
let token;
async function json(url,options){const r=await fetch(url,{...options,signal:AbortSignal.timeout(55000)});const d=await r.json().catch(()=>null);if(!r.ok)throw Error('HTTP_'+r.status+'_'+String(d?.error||d?.message||d?.code||'FAILED').slice(0,140));return d;}
const rpc=(name,args={})=>json(env.SUPABASE_URL+'/rest/v1/rpc/'+name,{method:'POST',headers:{apikey:env.SUPABASE_PUBLISHABLE_KEY,Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(args)});
const edge=async body=>(await json(env.SUPABASE_URL+'/functions/v1/financial-legacy',{method:'POST',headers:{apikey:env.SUPABASE_PUBLISHABLE_KEY,Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(body)})).data;
const database=query=>json('https://api.supabase.com/v1/projects/'+new URL(env.SUPABASE_URL).hostname.split('.')[0]+'/database/query',{method:'POST',headers:{Authorization:'Bearer '+env.SUPABASE_ACCESS_TOKEN,'Content-Type':'application/json'},body:JSON.stringify({query})});
async function sync(row){
  const cronOnly=mode==='decide'&&row.family==='service'&&row.branch==='cancel';
  if(!cronOnly)await edge({action:'syncRequest',request_id:row.id});
  for(let i=0;i<(cronOnly?100:30);i++){
    const status=await rpc('get_program_request_google_sync',{p_request_id:row.id});row.google_sync=status;save();
    if(status.phase==='synced'){if(cronOnly)row.automaticCronDelivery='PASS';return status;}
    if(status.phase==='error')throw Error(row.family+'_'+row.branch+'_GOOGLE_'+status.error_code);
    await new Promise(resolve=>setTimeout(resolve,1000));
  }
  throw Error('GOOGLE_SYNC_TIMEOUT_'+row.id);
}
async function source(){
  const result=await database(`begin read only;select jsonb_build_object(
    'documents',(select jsonb_agg(id) from (select distinct on(document_type_id) id from public.affiliate_documents where affiliate_id=${quote(env.H005_TEST_AFFILIATE_ID)}::uuid and status in('PENDING_REVIEW','UNDER_REVIEW','VERIFIED') order by document_type_id,created_at desc,id desc) d),
    'loan',(select jsonb_build_object('program_item_id',r.program_item_id,'signature',r.signature_data,'amount',r.requested_amount,'term',r.requested_term,'fund',r.financial_submission_snapshot->'financialResult'->>'fund','phone',d.notification_phone,'terms',(select id from public.program_terms_versions where program_id='prestamo' and membership_offering_id is null and published order by version desc limit 1)) from public.program_requests r join public.loan_request_deposit_snapshots d on d.request_id=r.id where r.id='5cd836ad-3681-40c8-8cfc-803ac1af2e34' and r.affiliate_id=${quote(env.H005_TEST_AFFILIATE_ID)}::uuid),
    'membership',(select jsonb_build_object('id',r.membership_offering_id,'profile',r.applicant_profile_snapshot,'terms',(select id from public.program_terms_versions where membership_offering_id=r.membership_offering_id and published order by version desc limit 1)) from public.program_requests r where affiliate_id=${quote(env.H005_TEST_AFFILIATE_ID)}::uuid and program_id='membership' and applicant_profile_snapshot is not null order by created_at desc limit 1),
    'service',(select id from public.program_catalog_items where enabled and not sold and request_mode='supabase' and commercial_mode='PAYROLL_QUOTE' and program_key<>'prestamo' order by id limit 1)
  ) source;commit;`);return result[0].source;
}
async function main(){
  const session=await json(env.SUPABASE_URL+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:env.SUPABASE_PUBLISHABLE_KEY,'Content-Type':'application/json'},body:JSON.stringify({email:env.H005_TEST_EMAIL,password:env.H005_TEST_PASSWORD})});token=session.access_token;
  if(mode==='create'){
    const material=await source();assert(material.loan&&material.membership&&material.service&&material.documents.length,'QA_SOURCE_INCOMPLETE');
    for(const family of ['loan','membership','service'])for(const branch of ['approve','reject','cancel']){
      let row=cases.find(r=>r.family===family&&r.branch===branch);if(!row){row={family,branch,idempotencyKey:crypto.randomUUID(),actions:{}};cases.push(row);save();}
      if(row.id){await sync(row);continue;}
      const marker='H-REQUESTS-WORKFLOW-HISTORY-GOOGLE-SYNC-001 / QA '+family+' '+branch+' / prueba de registro, sin ejecutar pagos';
      let created,replay;
      if(family==='loan'){
        const opened=await edge({action:'loanSessionOpen'});const selected=opened.programs.find(p=>p.fund===material.loan.fund&&p.status==='AVAILABLE')||opened.programs.find(p=>p.status==='AVAILABLE'&&p.max_amount>=material.loan.amount&&p.custom_term.min<=material.loan.term&&p.custom_term.max>=material.loan.term);
        assert(selected&&opened.loanSession?.id,'QA_FINANCIAL_FUND_UNAVAILABLE');
        const payload={action:'loanSessionConfirm',snapshot_id:opened.loanSession.id,program_id:selected.id,amount:Number(material.loan.amount),term:Number(material.loan.term),program_item_id:material.loan.program_item_id,notes:marker,signature_data:material.loan.signature,terms_accepted:true,terms_version_id:material.loan.terms,document_ids:material.documents,idempotency_key:row.idempotencyKey,bank_account_id:null,notification_phone:material.loan.phone};
        created=await edge(payload);row.id=created.request_id;row.folio=created.folio;save();replay=await edge(payload);assert.equal(replay.request_id,row.id);
      }else if(family==='membership'){
        const m=material.membership,payload={p_membership_offering_id:m.id,p_document_ids:material.documents,p_phone:m.profile.phone,p_rfc:m.profile.rfc,p_curp:m.profile.curp,p_terms_version_id:m.terms,p_idempotency_key:row.idempotencyKey};
        created=await rpc('create_membership_request',payload);row.id=created.id;row.folio=created.folio;save();replay=await rpc('create_membership_request',payload);assert.equal(replay.id,row.id);
      }else{
        const payload={p_program_item_id:material.service,p_product_id:null,p_quantity:1,p_notes:marker,p_signature_data:material.loan.signature,p_terms_accepted:true,p_idempotency_key:row.idempotencyKey,p_document_ids:material.documents};
        created=await rpc('create_program_request_with_documents',payload);row.id=created.id;row.folio=created.folio;save();replay=await rpc('create_program_request_with_documents',payload);assert.equal(replay.id,row.id);
      }
      await rpc('record_program_request_admin_action',{p_request_id:row.id,p_action:'COMMENT',p_comment:marker,p_client_action_id:crypto.randomUUID()});
      const state=await rpc('get_self_request_workflow_state',{p_request_id:row.id});row.workflowId=state.workflow_id;row.initialStatus=state.request_status;row.creationIdempotent=true;row.snapshotStageIds=state.stages.map(s=>s.id);save();
      const delivery=await sync(row);assert.equal(delivery.phase,'synced');row.initialGoogle='PENDIENTE';save();console.log(JSON.stringify({created:row.family,branch:row.branch,id:row.id,folio:row.folio,googleRow:delivery.google_row,phase:delivery.phase}));
    }
    assert.notEqual(cases.find(r=>r.family==='loan').workflowId,cases.find(r=>r.family==='service').workflowId,'SERVICE_WORKFLOW_NOT_DISTINCT');
  }else if(['review','decide'].includes(mode)){
    assert.equal(cases.length,9,'NINE_CONTROLLED_CASES_REQUIRED');
    for(const row of cases){
      let state=await rpc('get_self_request_workflow_state',{p_request_id:row.id});
      if(mode==='review'){
        if(!row.actions.review)row.actions.review=crypto.randomUUID();save();
        const args={p_request_id:row.id,p_action:'MARK_IN_REVIEW',p_comment:'QA focused workflow review',p_client_action_id:row.actions.review};
        await rpc('record_program_request_admin_action',args);await rpc('record_program_request_admin_action',args);
        state=await rpc('get_self_request_workflow_state',{p_request_id:row.id});assert.equal(state.request_status,'in_review');row.review='PASS';
      }else{
        if(!row.actions.decision)row.actions.decision=crypto.randomUUID();save();
        if(row.branch==='approve'){
          if(row.family==='loan'){await edge({action:'approve',request_id:row.id,comment:'QA focused final approval; no payment execution'});await edge({action:'approve',request_id:row.id,comment:'QA focused final approval; no payment execution'});}
          else{
            const args={p_request_id:row.id,p_action:'ADVANCE',p_comment:'QA focused final approval',p_client_action_id:row.actions.decision,p_quote_amount:row.family==='service'?100:null,p_quote_valid_until:row.family==='service'?'2026-10-08':null};
            const advanced=await rpc('transition_program_request_workflow',args);const replay=await rpc('transition_program_request_workflow',args);assert.equal(replay.idempotent,true);assert.equal(advanced.event.to_status,'approved');
          }
        }else if(row.branch==='reject'){
          const args={p_request_id:row.id,p_action:'REJECT',p_comment:'QA focused rejection reason',p_client_action_id:row.actions.decision};await rpc('transition_program_request_workflow',args);assert.equal((await rpc('transition_program_request_workflow',args)).idempotent,true);
        }else{
          const args={p_request_id:row.id,p_action:'CANCEL',p_comment:'QA focused cancellation reason',p_client_action_id:row.actions.decision};await rpc('record_program_request_admin_action',args);await rpc('record_program_request_admin_action',args);
        }
        state=await rpc('get_self_request_workflow_state',{p_request_id:row.id});assert.equal(state.request_status,{approve:'approved',reject:'rejected',cancel:'cancelled'}[row.branch]);row.decision='PASS';
        assert.equal(state.stages.find(s=>s.id===state.current_stage_id).state,'done');
      }
      const history=await rpc('list_self_program_request_history'),self=history.find(r=>r.id===row.id);assert(self&&self.status===state.request_status,'SELF_HISTORY_NOT_UPDATED');assert.deepEqual(self.workflow_state,state);
      row.selfHistory='PASS';row.status=state.request_status;row.currentStage=state.current_stage_id;row.stageStates=state.stages.map(s=>({id:s.id,state:s.state,date:s.date||null}));await sync(row);save();
      console.log(JSON.stringify({phase:mode,family:row.family,branch:row.branch,status:row.status,google:row.google_sync.phase,row:row.google_sync.google_row}));
    }
  }else if(mode!=='status')throw Error('USAGE: create|review|decide|status');
  console.log(JSON.stringify({status:'PASS',mode,cases:cases.map(r=>({family:r.family,branch:r.branch,id:r.id,folio:r.folio,status:r.status||r.initialStatus,row:r.google_sync?.google_row,sync:r.google_sync?.phase})),requestDeletes:0,catalogWrites:0,financialExecution:0}));
}
main().catch(e=>{save();console.error(JSON.stringify({status:'FAIL',mode,error:e.message}));process.exitCode=1;});
