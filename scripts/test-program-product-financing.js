'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const id='20260922000200_program_product_financing',baseline=JSON.parse(read('scripts/test-program-product-financing-baseline.json'));
const {PGlite}=require(process.env.SUTIAPP_PGLITE_PATH||path.join(root,'.tmp/savings-loan-eligibility/node_modules/@electric-sql/pglite'));
const actor='10000000-0000-0000-0000-000000000001',affiliate='20000000-0000-0000-0000-000000000001',item='30000000-0000-0000-0000-000000000001',terms='40000000-0000-0000-0000-000000000001';
const base={id:'caja-rule',program_id:'caja',rule_id:'test-rule',status:'AVAILABLE',fund:'Caja Chica',union:'Sindicato A',category:'BASE',max_amount:40000,rate:3,rate_factor:.03,payment_count:24,payment_period:'quincenal',visibility_mode:'MOSTRAR',term_label:'24 pagos'};
const config=(rate=null,rules=[],required=false,type='AMOUNT',value=0)=>({default_rate:rate,rules,down_payment:{required,type,value}});
async function main(){
 const db=new PGlite();let tests=0;
 const query=async(q,p=[])=>(await db.query(q,p)).rows;
 const scalar=async(q,p=[])=>(await query(q,p))[0].v;
 const expectReject=async(q,p,pattern)=>{await assert.rejects(query(q,p),pattern);tests++;};
 const cfg=async c=>query('update program_catalog_items set financing_config=$1 where id=$2',[c,item]);
 const resolve=async(price=17100,rule=base)=>scalar('select public.resolve_program_product_financing($1,$2,$3,$4) v',[item,affiliate,rule,price]);
 try{
  await db.exec("create role anon; create role authenticated; create role service_role; create schema auth; create schema storage; create schema extensions; create function extensions.gen_random_uuid() returns uuid language sql as $$select gen_random_uuid()$$;");
  for(const t of baseline.tables)await db.exec(`create table ${t.schema}.${t.name}(${t.columns});`);
  await db.exec(`create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.actor',true),'')::uuid$$;
  create function auth.role() returns text language sql stable as $$select current_setting('test.role',true)$$;
  create function public.has_admin_permission(text) returns boolean language sql stable as $$select current_setting('test.admin',true)='yes'$$;
  create function public.admin_request_module_boundary(uuid) returns boolean language sql stable as $$select current_setting('test.admin',true)='yes'$$;
  create function public.resolve_affiliate_document_requirements(text,text,uuid) returns table(required boolean,document_type_id uuid) language sql as $$select false,null::uuid where false$$;
  create table program_catalog_item_assets(id uuid default gen_random_uuid(),item_id uuid,enabled boolean,sort_order integer,public_asset_id uuid,private_asset_id uuid,role text,source_column text,source_column_letter text);
  alter table program_catalog_items add primary key(id); alter table program_catalog_items alter column id set default gen_random_uuid();
  alter table program_requests add primary key(id); alter table program_requests alter column id set default gen_random_uuid();
  alter table program_requests alter column created_at set default now();
  create unique index test_request_idempotency on program_requests(affiliate_id,idempotency_key);
  create unique index test_request_documents on request_documents(request_id,document_type_id);
  alter table program_catalog_items enable row level security;
  grant usage on schema public,auth to anon,authenticated,service_role;
  grant select(id,name) on program_catalog_items to authenticated;
  create policy test_catalog_read on program_catalog_items for select to authenticated using (enabled);
  `);
  for(const name of ['normalize_suti_financial_key','resolve_suti_loan_quote_contract_v1_engine','resolve_suti_loan_quote_contract','generate_program_product_payment_schedule','create_validated_program_product_payment_request','save_program_catalog_item','create_first_cirugias_program_catalog_item','approve_program_product_payment_request']){
   const f=baseline.definitions.find(f=>f.signature.startsWith(name+'('));assert(f,name);await db.exec(f.definition);
  }
  await db.exec(`create function get_financial_runtime_rules() returns jsonb language sql as $$select current_setting('test.rules')::jsonb$$;`);
  await query("select set_config('test.actor',$1,false),set_config('test.role','service_role',false),set_config('test.admin','yes',false),set_config('test.rules',$2,false)",[actor,JSON.stringify([base])]);
  await db.exec(read('supabase/migrations/'+id+'.sql'));
  await db.exec(read('supabase/recovery/'+id+'.sql'));
  assert.equal(await scalar("select pg_get_functiondef('create_validated_program_product_payment_request(uuid,uuid,uuid,uuid,text,text,uuid,uuid[],uuid,numeric,integer,integer,date)'::regprocedure) v"),baseline.definitions.find(f=>f.signature.startsWith('create_validated_')).definition,'exact recovery');tests++;
  await db.exec(read('supabase/migrations/'+id+'.sql'));
  await query('insert into auth.users(id) values($1)',[actor]);
  await query("insert into affiliates(id,auth_user_id,numero_control,financial_union_code,financial_employee_category_code,financial_profile_version) values($1,$2,'0001','U1','BASE',1)",[affiliate,actor]);
  await query("insert into program_catalog_items(id,program_key,name,enabled,sold,commercial_mode,request_mode,price_cash,requires_quote,sort_order) values($1,'tours','Viaje aislado',true,false,'PAYROLL_FIXED','supabase',17100,false,1)",[item]);
  await db.exec("insert into segmentation_catalog_entries(catalog_type,code,label,enabled) values('union','U1','Sindicato A',true),('union','U2','Sindicato B',true),('employment_category','BASE','BASE',true),('employment_category','JUBILADOS_PENSIONADOS','JUBILADOS Y PENS.',true);insert into loan_term_policy(id,enabled,standard_terms,custom_min_term,custom_step,decision_reference) values('primary',true,array[1,6,12,24],1,1,'isolated');");
  await query("insert into program_terms_versions(id,program_id,published) values($1,'prestamo',true)",[terms]);
  let r=await resolve();assert.deepEqual(r.rule,base);assert.equal(r.minimum_down_payment,0);tests++;
  await cfg(config(0));r=await resolve();assert.equal(r.rule.rate,0);assert.equal(r.rule.rate_factor,0);tests++;
  await cfg(config(2,[],true,'PERCENT',10));r=await resolve();assert.equal(r.minimum_down_payment,1710);assert.equal(r.rule.rate_factor,.02);tests++;
  assert.equal((await resolve(17100.01)).minimum_down_payment,1710.01,'percentage rounds up to required cent');tests++;
  assert.equal((await resolve(50000)).minimum_down_payment,10000,'existing cap still applies');tests++;
  await cfg(config(null,[],true,'AMOUNT',3000));r=await resolve();assert.equal(r.minimum_down_payment,3000);assert.equal(r.rule.rate,3);tests++;
  await cfg(config(2,[{union_code:'U1',category_code:null,rate:1},{union_code:null,category_code:'BASE',rate:1.5},{union_code:'U1',category_code:'BASE',rate:.5}]));
  r=await resolve();assert.equal(r.rule.rate,.5);assert.equal(r.conditions.rate_source,'PRODUCT_AUDIENCE');tests++;
  for(const [rules,expected] of [
   [[{union_code:'U1',category_code:null,rate:1}],1],
   [[{union_code:null,category_code:'BASE',rate:1.5}],1.5],
   [[{union_code:'U2',category_code:null,rate:1}],2],
   [[{union_code:'U1',category_code:null,rate:1},{union_code:null,category_code:'BASE',rate:1}],1],
  ]){await cfg(config(2,rules));assert.equal((await resolve()).rule.rate,expected);tests++;}
  await expectReject('select validate_program_product_financing($1)',[config(2,[{union_code:'U1',category_code:null,rate:1},{union_code:null,category_code:'BASE',rate:1.5}])],/AUDIENCE_CONFLICT/);
  for(const bad of [config(-1),config(null,[],true,'PERCENT',100),config(null,[],true,'AMOUNT',0),config(2,[{union_code:null,category_code:null,rate:1}]),config(2,[{union_code:'UNKNOWN',category_code:null,rate:1}])])await expectReject('select validate_program_product_financing($1)',[bad],/PRODUCT_/);
  await cfg(config(2,[],true,'PERCENT',10));
  await db.exec("set role authenticated;select set_config('test.admin','no',false)");
  await expectReject('select get_program_product_financing_options()',[],/WRITE_REQUIRED/);
  await expectReject('select resolve_program_product_financing($1,$2,$3,$4)',[item,affiliate,base,17100],/permission denied/);
  await expectReject('update program_catalog_items set financing_config=null where id=$1',[item],/permission denied/);
  await expectReject('select save_program_catalog_item_financing($1,$2,$3,$4,$5,false)',[item,{},[],null,null],/WRITE_REQUIRED/);
  await db.exec('reset role;set role anon');
  await expectReject('select get_program_product_financing_options()',[],/permission denied/);
  await db.exec('reset role');
  await query("select set_config('test.admin','yes',false)");
  const payload={program_key:'tours',name:'Viaje aislado',description:null,category_raw:null,price_cash:17100,requires_quote:false,commercial_mode:'PAYROLL_FIXED',sold:false,enabled:true,sort_order:1};
  const saved=await scalar('select save_program_catalog_item_financing($1,$2,$3,$4,$5,false) v',[item,payload,[],config(1.5),config(2,[],true,'PERCENT',10)]);
  assert.equal(saved.financing_config.default_rate,1.5);assert.equal(await scalar("select count(*)::integer v from admin_audit_log where details->>'operation'='PRODUCT_FINANCING'"),1);tests++;
  await expectReject('select save_program_catalog_item_financing($1,$2,$3,$4,$5,false)',[item,payload,[],config(2),config(3)],/FINANCING_CHANGED/);
  const snap=async(down=1710,term=12)=>{
   const conditions=await resolve();const policy={source:'SUPABASE_LOAN_TERM_POLICY',standardTerms:[1,6,12,24],customMinTerm:1,customStep:1,decisionReference:'isolated'};
   const financial=await scalar('select resolve_suti_loan_quote_contract($1,$2,$3,$4,$5,$6,$7) v',[[conditions.rule],base.union,base.category,base.id,17100-down,term,policy]);
   return {conditions,financial};
  };
  await cfg(config(2,[],true,'PERCENT',10));const quote=await snap();assert.equal(quote.financial.interest,3693.6);assert.equal(quote.financial.total,19263.6);tests++;
  const submission={p_actor_real_auth_user_id:actor,p_affiliate_id:affiliate,p_impersonation_session_id:null,p_program_item_id:item,p_notes:'Isolated',p_signature_data:'synthetic signature',p_terms_version_id:terms,p_document_ids:[],p_idempotency_key:'50000000-0000-0000-0000-000000000001',p_down_payment:1710,p_term:12,p_expected_profile_version:1,p_schedule_anchor_date:await scalar("select (now() at time zone 'America/Hermosillo')::date::text v")};
  const confirm=async(s,q)=>scalar('select to_jsonb(confirm_program_product_financing($1,$2,$3)) v',[s,q.financial,q.conditions.conditions]);
  await assert.rejects(confirm({...submission,p_down_payment:1709},quote),/DOWN_PAYMENT_OUT_OF_RANGE/);tests++;
  await cfg(config(1,[],true,'PERCENT',10));await assert.rejects(confirm(submission,quote),/CONDITIONS_CHANGED/);assert.equal(await scalar('select count(*)::integer v from program_requests'),0);tests++;
  await cfg(config(2,[],true,'PERCENT',10));const request=await confirm(submission,quote);assert.equal(request.financial_submission_snapshot.financialResult.rate,2);assert.equal(request.financial_submission_snapshot.payment_schedule.rows.length,12);tests++;
  const google=await import('data:text/javascript;base64,'+Buffer.from(read('supabase/functions/financial-legacy/request-google-sync.js')).toString('base64'));
  const row=google.buildRequestRegisterRow(request,[],null);assert.equal(row[4],'Caja Chica');assert.equal(row[5],.02);assert.equal(row[7],15390);assert.equal(row[8],19263.6);tests++;
  await cfg(config(4));const approved=await scalar('select to_jsonb(approve_program_product_payment_request($1,$2,$3)) v',[request.id,'Aprobación aislada','60000000-0000-0000-0000-000000000001']);
  assert.equal(approved.financial_approval_snapshot.financialResult.rate,2,'approval seals submitted rate after catalog edit');tests++;
  // A quoted price and retired affiliate retain the existing monthly calendar.
  await query("update affiliates set financial_employee_category_code='JUBILADOS_PENSIONADOS' where id=$1",[affiliate]);
  const jubRule={...base,category:'JUBILADOS Y PENS.',payment_period:'mensual'};
  await query("select set_config('test.rules',$1,false)",[JSON.stringify([jubRule])]);
  await query("update program_catalog_items set commercial_mode='PAYROLL_QUOTE',requires_quote=true where id=$1",[item]);
  await query("insert into program_requests(id,affiliate_id,program_item_id,request_type,status,quoted_amount,created_at) values(gen_random_uuid(),$1,$2,'quote','approved',17100,now())",[affiliate,item]);
  await cfg(config(null,[{union_code:'U1',category_code:'JUBILADOS_PENSIONADOS',rate:1}],true,'PERCENT',10));
  const jubConditions=await resolve(17100,jubRule);
  const jubFinancial=await scalar('select resolve_suti_loan_quote_contract($1,$2,$3,$4,$5,$6,$7) v',[[jubConditions.rule],base.union,jubRule.category,base.id,15390,12,{source:'SUPABASE_LOAN_TERM_POLICY',standardTerms:[1,6,12,24],customMinTerm:1,customStep:1}]);
  const jubRequest=await confirm({...submission,p_idempotency_key:'50000000-0000-0000-0000-000000000002'},{financial:jubFinancial,conditions:jubConditions});
  assert.equal(jubRequest.financial_submission_snapshot.price_source,'APPROVED_QUOTE');assert.equal(jubRequest.financial_submission_snapshot.financialResult.rate,1);assert.equal(jubRequest.financial_submission_snapshot.payment_schedule.frequency,'mensual');assert(jubRequest.financial_submission_snapshot.payment_schedule.rows.every(r=>r.date.endsWith('-05')));tests++;
  await query("update affiliates set financial_employee_category_code='BASE' where id=$1",[affiliate]);
  await query("select set_config('test.rules',$1,false)",[JSON.stringify([base])]);
  // Run the actual Edge product resolver against this isolated SQL engine.
  const vm=require('vm'),{stripTypeScriptTypes}=require('module'),crypto=require('crypto');
  const edge=read('supabase/functions/financial-legacy/index.ts');
  const fn=(start,end)=>edge.slice(edge.indexOf(start),edge.indexOf(end,edge.indexOf(start)));
  const hash=async x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
  const policy={source:'SUPABASE_LOAN_TERM_POLICY',standardTerms:[1,6,12,24],customMinTerm:1,customStep:1,decisionReference:'isolated'};
  const privileged={rpc:async(name,args)=>{try{
   const entries=Object.entries(args),v=await scalar('select '+name+'('+entries.map(([k],i)=>k+'=> $'+(i+1)).join(',')+') v',entries.map(([,v])=>v));return {data:v,error:null};
  }catch(e){return {data:null,error:{message:e.message}};}}};
  const sandbox={sha256:hash,readCriteriaRules:async()=>[base],cajaRuleForProfile:()=>base,criteriaFingerprintPayload:r=>r,
   invalidateLoanSession:async()=>{sandbox.invalidated=true;},processForCategory:()=> '1',
   resolveQuote:async(_,rules,profile,body,p)=>scalar('select resolve_suti_loan_quote_contract($1,$2,$3,$4,$5,$6,$7) v',[rules,profile.financial_union,profile.financial_employee_category,body.program_id,body.amount,body.term,p])};
  vm.createContext(sandbox);
  vm.runInContext(stripTypeScriptTypes(fn('async function productFinancing(', 'async function openProgramPaymentSession(')+fn('async function resolveProgramPaymentQuote(', 'async function confirmProgramPaymentSession('))+';this.quote=resolveProgramPaymentQuote;',sandbox);
  await cfg(config(2,[],true,'PERCENT',10));
  const session={id:'isolated',authorized_price:17100,program_item_id:item,criteria_source_fingerprint:await hash([base]),eligible_rules:[{...base,product_financing_conditions:quote.conditions.conditions}],schedule_anchor_date:submission.p_schedule_anchor_date};
  const context={affiliateId:affiliate,profile:{financial_union:base.union,financial_employee_category:base.category}};
  const edgeQuote=await sandbox.quote(privileged,context,policy,session,1710,12);
  assert.equal(edgeQuote.financialResult.total,quote.financial.total);assert.equal(edgeQuote.financingConditions.effective_rate,2);tests++;
  await assert.rejects(sandbox.quote(privileged,context,policy,session,1700,12),/DOWN_PAYMENT_OUT_OF_RANGE/);tests++;
  await cfg(config(1));await assert.rejects(sandbox.quote(privileged,context,policy,session,1710,12),/CONDITIONS_CHANGED/);assert(sandbox.invalidated);tests++;
  await assert.rejects(db.exec(read('supabase/recovery/'+id+'.sql')),/RECOVERY_BLOCKED_PRODUCT_FINANCING_HISTORY_EXISTS/);await db.exec('rollback');tests++;
  console.log(JSON.stringify({status:'PASS',tests,engine:'installed SQL',migrationRecovery:true,atomicSubmit:true,googleProjection:true,historicalApproval:true,productionWrites:0}));
 }finally{await db.close();}
}
main().catch(e=>{console.error(e.message,e.where||'',e.position||'');process.exitCode=1;});
