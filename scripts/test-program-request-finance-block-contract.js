'use strict';
// Real request/restriction repositories; isolated transport, no network or writes.
const assert=require('assert/strict'),fs=require('fs'),path=require('path'),vm=require('vm');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8').replace(/\r\n/g,'\n');
const source=()=>read('app/program-request-repository.js');
const block={starts_on:'2026-10-01',ends_on:'2026-10-20',reason:'Isolated restriction'};
const program={programItemId:'synthetic-program',quantity:2,notes:'Synthetic note',signature:'synthetic-signature',terms:true,idempotencyKey:'synthetic-key',documentIds:['synthetic-document']};
const member={membershipOfferingId:'synthetic-offering',documentIds:['synthetic-document'],phone:'6620000000',rfc:'SYNTHETIC',curp:'SYNTHETIC',termsVersionId:'synthetic-terms',idempotencyKey:'synthetic-key',paymentQuoteHash:'a'.repeat(64)};
const market={...program,programItemId:undefined,productId:'synthetic-marketplace'};
const routes=[
  {name:'program',method:'create',values:program,rpc:'create_program_request_with_documents',args:{p_program_item_id:program.programItemId,p_product_id:null,p_quantity:2,p_notes:program.notes,p_signature_data:program.signature,p_terms_accepted:true,p_idempotency_key:program.idempotencyKey,p_document_ids:program.documentIds}},
  {name:'membership',method:'createMembership',values:member,rpc:'create_membership_request',args:{p_membership_offering_id:member.membershipOfferingId,p_document_ids:member.documentIds,p_phone:member.phone,p_rfc:member.rfc,p_curp:member.curp,p_terms_version_id:member.termsVersionId,p_idempotency_key:member.idempotencyKey,p_expected_payment_quote_hash:member.paymentQuoteHash}},
];
function fixture(requestSource,options={}){
  const calls={checks:0,writes:[],events:[],sync:[],workflows:[],notices:[],order:[]};
  let affiliate='synthetic-affiliate';
  const row={id:'synthetic-request',program_id:'membership',status:'submitted',request_type:'benefit',created_at:'2026-10-05T12:00:00Z',financial_processing_status:'pending',requested_amount:200};
  const window={
    AffiliateAuth:{getState:()=>({session:{user:{id:'synthetic-actor'}},affiliate:{id:affiliate}})},
    FinanceBlocksUI:{show:value=>calls.notices.push(value)},
    FinancialLegacyRepository:{invoke:async value=>{calls.sync.push(value);return{};}},
    dispatchEvent:event=>calls.events.push(event.type),
    SutiSupabase:{getClient:()=>({rpc:async(name,args)=>{
      calls.order.push(name);
      if(name==='get_self_finance_block'){
        calls.checks++;if(options.changeContext)affiliate='other-affiliate';
        if(options.checkError)return{error:options.checkError};
        if(Object.hasOwn(options,'checkData'))return{data:options.checkData};
        return{data:{blocked:!!options.blocked||(!!options.race&&calls.checks>1),block}};
      }
      if(name==='get_self_request_workflow_state'){calls.workflows.push(args);return{data:{available:true}};}
      assert(['create_program_request_with_documents','create_membership_request'].includes(name),'Unexpected writer '+name);
      calls.writes.push({name,args:JSON.parse(JSON.stringify(args))});
      return options.writeError?{error:options.writeError}:{data:row};
    }})},
  };
  const context=vm.createContext({window,Event:class Event{constructor(type){this.type=type;}},crypto:{randomUUID:()=>{throw Error('Unexpected generated idempotency key');}}});
  vm.runInContext(read('app/finance-blocks-repository.js'),context);
  vm.runInContext(requestSource,context);
  return{calls,row,repository:window.ProgramRequestRepository};
}
function noSuccess(calls){assert.deepEqual([calls.events.length,calls.sync.length,calls.workflows.length],[0,0,0],'failed request must not refresh/sync/project success');}
function succeeded(f){
  assert.deepEqual(f.calls.events,['suti:request-changed']);
  assert.deepEqual(JSON.parse(JSON.stringify(f.calls.sync)),[{action:'syncRequest',request_id:f.row.id}]);
  assert.deepEqual(JSON.parse(JSON.stringify(f.calls.workflows)),[{p_request_id:f.row.id}]);
  assert.equal(f.calls.notices.length,0);
}
async function verify(requestSource=source()){
  const checks=[];
  for(const route of routes){
    const run=f=>f.repository[route.method](route.values);
    let f=fixture(requestSource,{blocked:true});
    await assert.rejects(()=>run(f),/FINANCE_REQUEST_BLOCKED/);
    assert.equal(f.calls.checks,1);assert.equal(f.calls.writes.length,0);noSuccess(f.calls);
    assert.deepEqual(f.calls.notices,[block]);checks.push(route.name+': blocked before write');

    f=fixture(requestSource);const result=await run(f);
    assert.equal(f.calls.checks,1);assert.deepEqual(f.calls.writes,[{name:route.rpc,args:route.args}]);
    assert.deepEqual(f.calls.order.slice(0,2),['get_self_finance_block',route.rpc]);
    assert.equal(result.id,f.row.id);assert.equal(result.importe,200);assert.equal(result.workflow_state.available,true);succeeded(f);
    checks.push(route.name+': allowed, exact payload/idempotency and successful projection');

    const unavailable=new Error('RESTRICTION_SOURCE_UNAVAILABLE');
    f=fixture(requestSource,{checkError:unavailable});await assert.rejects(()=>run(f),error=>error===unavailable);
    assert.equal(f.calls.checks,1);assert.equal(f.calls.writes.length,0);noSuccess(f.calls);
    for(const checkData of [null,{}, {blocked:'false'}]){
      f=fixture(requestSource,{checkData});await assert.rejects(()=>run(f),/FINANCE_BLOCK_CHECK_UNAVAILABLE/);
      assert.equal(f.calls.writes.length,0);noSuccess(f.calls);
    }
    checks.push(route.name+': source failure/malformed result fail closed');

    for(const key of ['message','code','details']){
      f=fixture(requestSource,{race:true,writeError:{[key]:'FINANCE_REQUEST_BLOCKED'}});
      await assert.rejects(()=>run(f),/FINANCE_REQUEST_BLOCKED/);
      assert.equal(f.calls.checks,2);assert.equal(f.calls.writes.length,1);assert.deepEqual(f.calls.notices,[block]);noSuccess(f.calls);
    }
    checks.push(route.name+': concurrent backend block rechecked, no false success');

    const upstream=new Error('REQUEST_SOURCE_UNAVAILABLE');
    f=fixture(requestSource,{writeError:upstream});await assert.rejects(()=>run(f),error=>error===upstream);
    assert.equal(f.calls.checks,1);assert.equal(f.calls.writes.length,1);assert.equal(f.calls.notices.length,0);noSuccess(f.calls);
    checks.push(route.name+': unrelated writer error preserved');

    f=fixture(requestSource,{changeContext:true});await assert.rejects(()=>run(f),/FINANCE_BLOCK_CONTEXT_CHANGED/);
    assert.equal(f.calls.writes.length,0);noSuccess(f.calls);checks.push(route.name+': changed affiliate cannot write');
  }
  for(const paymentQuoteHash of [undefined,'','invalid']){
    const f=fixture(requestSource);await assert.rejects(()=>f.repository.createMembership({...member,paymentQuoteHash}),/MEMBERSHIP_PAYMENT_QUOTE_REQUIRED/);
    assert.equal(f.calls.checks,0);assert.equal(f.calls.writes.length,0);noSuccess(f.calls);
  }
  checks.push('membership: invalid quote hash stops before any RPC');
  let f=fixture(requestSource,{blocked:true});await assert.doesNotReject(()=>f.repository.create(market));
  assert.equal(f.calls.checks,0);assert.deepEqual(f.calls.writes,[{name:routes[0].rpc,args:{...routes[0].args,p_program_item_id:null,p_product_id:market.productId}}]);succeeded(f);
  const error=new Error('MARKETPLACE_UNAVAILABLE');f=fixture(requestSource,{blocked:true,writeError:error});
  await assert.rejects(()=>f.repository.create(market),actual=>actual===error);assert.equal(f.calls.checks,0);assert.equal(f.calls.writes.length,1);noSuccess(f.calls);
  checks.push('Marketplace: ordinary request bypasses financial preflight and preserves errors');
  return checks;
}
async function mutationChecks(){
  const original=source();
  const mutations=[
    ['if(v.programItemId)await window.FinanceBlocksRepository.assertAllowed();',''],
    ["await window.FinanceBlocksRepository.assertAllowed();const r=await db().rpc('create_membership_request'","const r=await db().rpc('create_membership_request'"],
    ['if(v.programItemId)await window.FinanceBlocksRepository.assertAllowed();','await window.FinanceBlocksRepository.assertAllowed();'],
    ['if(r.error)await window.FinanceBlocksRepository.handle(r.error);','if(r.error)throw r.error;'],
    ['p_quantity:Number(v.quantity)||1','p_quantity:1'],
  ];
  for(const [from,to] of mutations){assert(original.includes(from));await assert.rejects(()=>verify(original.replace(from,to)),error=>error.code==='ERR_ASSERTION','behavioral suite must detect mutation: '+from);}
  return mutations.length;
}
module.exports={verify,mutationChecks};
if(require.main===module)(async()=>console.log(JSON.stringify({status:'PASS',checks:await verify(),detectedMutations:await mutationChecks(),externalWrites:0})))().catch(error=>{console.error(error);process.exitCode=1;});
