'use strict';
// Real policy, overview, browser sum and isolated PostgreSQL. No live data writes.
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),vm=require('vm'),crypto=require('crypto');
const {stripTypeScriptTypes}=require('module');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const pglitePath=process.env.SUTIAPP_PGLITE_PATH||path.join(root,'.tmp/savings-loan-eligibility/node_modules/@electric-sql/pglite');
const {PGlite}=require(pglitePath),{pgcrypto}=require(path.join(pglitePath,'dist/contrib/pgcrypto.cjs'));
const version='20261005000100_loan_dated_fund_cutoff.sql';
const policy={source:'SUPABASE_LOAN_TERM_POLICY',standardTerms:[1,6,12,24],customMinTerm:1,customStep:1};
const base={id:'advance',program_id:'prestamo',status:'AVAILABLE',fund:'Isolated advance',union:'SUTISSSTESON',category:'Base',max_amount:25000,rate_factor:.06,rate:6,payment_count:1,payment_period:'quincenal',term_label:'1 Qnas'};
const actor='10000000-0000-0000-0000-000000000001',affiliate='20000000-0000-0000-0000-000000000001',session='30000000-0000-0000-0000-000000000001';
async function main(){
 const {evaluateVisibility,visibilityWindow}=await import('../supabase/functions/financial-legacy/visibility-policy.js');
 const db=new PGlite({extensions:{pgcrypto}});let checks=0;
 const check=(a,b,label)=>{assert.deepEqual(a,b,label);checks++;};
 const reject=async(p,re)=>{await assert.rejects(p,re);checks++;};
 const scalar=async(sql,args=[])=>(await db.query(sql,args)).rows[0].v;
 const quote=(r,fn='resolve_suti_loan_quote_contract',rules=[r])=>scalar(`select public.${fn}($1,$2,$3,$4,5000,1,$5) v`,[rules,r.union,r.category,r.id,policy]);
 try{
  const edge=read('supabase/functions/financial-legacy/index.ts');
  const ctx=vm.createContext({window:{},normalize:v=>String(v||'').toUpperCase(),Date,Intl});
  vm.runInContext(read('app/financial-legacy-repository.js'),ctx);
  const functions=edge.slice(edge.indexOf('function rulesForProfile('),edge.indexOf('async function resolveQuote('));
  vm.runInContext(stripTypeScriptTypes(functions)+';this.overview=resolveOverview;',ctx);
  const profile={financial_union:base.union,financial_employee_category:base.category};
  const overviewAt=instant=>ctx.overview([
   {...base,id:'permanent',available_on:null,max_amount:133000,status:'AVAILABLE'},
   {...base,max_amount:10000,available_on:'2026-10-15',status:evaluateVisibility('2026-10-15','MOSTRAR',new Date(instant)).status},
   {...base,id:'wrong-profile',category:'Confianza',max_amount:999999,status:'AVAILABLE'},
  ],profile,policy);
  const beforeOverview=overviewAt('2026-09-15T06:59:59Z'),afterOverview=overviewAt('2026-09-15T07:00:00Z');
  check(ctx.window.FinancialLegacyRepository.availableCreditTotal(beforeOverview),143000,'existing total before Hermosillo cutoff');
  check(ctx.window.FinancialLegacyRepository.availableCreditTotal(afterOverview),133000,'existing total after cutoff');
  check(afterOverview.programs.length,1,'closed and wrong-profile funds excluded');
  check(ctx.window.FinancialLegacyRepository.availableCreditTotal({programs:[]}),0,'no available funds means zero');
  check(evaluateVisibility('2027-03-01','AUTO',new Date('2026-10-05T12:00:00-07:00')).status,'SCHEDULED','opening horizon unchanged');
  check(evaluateVisibility('2027-03-01','MOSTRAR',new Date('2026-10-05T12:00:00-07:00')).status,'AVAILABLE','MOSTRAR may still open early');
  check(visibilityWindow(new Date('2026-10-05T12:00:00-07:00')).upperISO,'2027-02-28','four following calendar months unchanged');
  for(const mode of ['AUTO','MOSTRAR','OCULTAR'])check(evaluateVisibility(null,mode,new Date('2026-10-05T12:00:00-07:00')).status,mode==='OCULTAR'?'UNAVAILABLE':'AVAILABLE','undated '+mode);

  await db.exec(read('scripts/test-savings-loan-eligibility.sql').split('-- TESTS:')[0]);
  await db.exec('drop function extensions.gen_random_uuid(); create extension pgcrypto with schema extensions;');
  await db.exec(`alter table financial_session_snapshots add created_at timestamptz default now();
   alter table program_requests add created_at timestamptz default now();
   alter table affiliates add financial_union_code text,add financial_employee_category_code text,add financial_profile_version integer,
    add financial_affiliation_status text,add financial_employee_type text,add financial_employment_status text;
   create table impersonation_sessions(id uuid,actor_real_auth_user_id uuid,ended_at timestamptz,expires_at timestamptz);
   create table segmentation_catalog_entries(catalog_type text,code text,label text,enabled boolean);
   create function public.get_effective_affiliate_id() returns uuid language sql as $$select nullif(current_setting('test.affiliate',true),'')::uuid$$;
   create function public.admin_actor_can_impersonate() returns boolean language sql as $$select false$$;
   grant usage on schema public,auth to authenticated,anon,service_role;`);
  const baseline=JSON.parse(read('scripts/test-loan-advance-fee-baseline.json'));
  for(const name of ['normalize_suti_financial_key','resolve_suti_loan_quote_contract_v1_engine','resolve_suti_loan_quote_contract','resolve_current_loan_snapshot_quote']){
   const d=baseline.definitions.find(x=>x.signature.startsWith(name+'('));await db.exec(d.definition);
   await db.exec(`revoke all on function ${d.signature} from public,anon,authenticated,service_role;`);
   if(name!=='resolve_suti_loan_quote_contract_v1_engine')await db.exec(`grant execute on function ${d.signature} to service_role;`);
   if(name==='resolve_current_loan_snapshot_quote')await db.exec(`grant execute on function ${d.signature} to authenticated;`);
  }
  for(const f of ['20260922000300_loan_advance_admin_fee.sql','20260923000200_loan_advance_interest.sql']){
   // The historical interest migration pins the LF definition installed by the
   // fee release. Git autocrlf must not alter that isolated predecessor fixture.
   const sql=read('supabase/migrations/'+f);
   await db.exec(f.startsWith('20260922000300')?sql.replace(/\r\n/g,'\n'):sql);
  }
  const definitions=async()=>(await db.query("select oid,oid::regprocedure::text signature,pg_get_functiondef(oid) definition,md5(pg_get_functiondef(oid)) hash,proacl::text acl,proowner,prosecdef,proconfig from pg_proc where proname in ('resolve_suti_loan_quote_contract','resolve_current_loan_snapshot_quote','resolve_suti_loan_quote_contract_v1_engine','payroll_periods','enforce_request_date') order by 2")).rows;
  const before=await definitions(),today=await scalar("select (now() at time zone 'America/Hermosillo')::date::text v");
  fs.mkdirSync(path.join(root,'.tmp/loan-dated-fund-cutoff'),{recursive:true});
  fs.writeFileSync(path.join(root,'.tmp/loan-dated-fund-cutoff/isolated-before.json'),JSON.stringify(before,null,2));
  const future=await scalar("select ((now() at time zone 'America/Hermosillo')::date + interval '3 months')::date::text v");
  const permitted=[{...base,available_on:null},{...base,available_on:future},{...base,id:'cash',program_id:'caja',payment_count:24,available_on:null}];
  const clean=q=>{const {resolved_at,...rest}=q;return rest;};
  const oldQuotes=await Promise.all(permitted.map(async r=>clean(await quote(r))));
  const oldClosed=await quote({...base,available_on:today});
  await db.query('insert into program_requests(id,financial_submission_snapshot) values(gen_random_uuid(),$1)',[{financialResult:oldClosed}]);
  const history=await scalar('select jsonb_agg(to_jsonb(t) order by id) v from program_requests t');
  await db.exec(read('supabase/migrations/'+version));
  const after=await definitions();
  check(after.map(({definition,hash,...r})=>r),before.map(({definition,hash,...r})=>r),'signature/OID/ACL/owner/security unchanged');
  for(const row of before.filter(r=>!r.signature.startsWith('resolve_suti_loan_quote_contract(')))check(after.find(r=>r.oid===row.oid),row,'unrelated engine/calendar/snapshot code unchanged');
  for(let i=0;i<permitted.length;i++)check(clean(await quote(permitted[i])),oldQuotes[i],'permitted financial results unchanged');
  await reject(quote({...base,available_on:today,visibility_mode:'MOSTRAR'}),/FINANCIAL_PROGRAM_NOT_ELIGIBLE/);
  check(await scalar('select jsonb_agg(to_jsonb(t) order by id) v from program_requests t'),history,'history untouched');
  const patched=after.find(r=>r.signature.startsWith('resolve_suti_loan_quote_contract('));

  // Isolated copy changes only its clock, allowing actual SQL to run at boundaries.
  await db.exec(patched.definition.replace('public.resolve_suti_loan_quote_contract(', 'public.test_cutoff_quote(')
   .replace("today date:=(now() at time zone 'America/Hermosillo')::date;","today date:=current_setting('test.today')::date;"));
  const dates=[['2026-10-15','2026-09-15'],['2027-01-15','2026-12-15'],['2027-03-31','2027-02-28'],['2028-03-31','2028-02-29'],['2026-05-31','2026-04-30'],['2026-03-01','2026-02-01']];
  for(const [due,cutoff] of dates){
   const prior=new Date(cutoff+'T12:00:00Z');prior.setUTCDate(prior.getUTCDate()-1);
   const following=new Date(cutoff+'T12:00:00Z');following.setUTCDate(following.getUTCDate()+1);
   for(const [day,closed] of [[prior.toISOString().slice(0,10),false],[cutoff,true],[following.toISOString().slice(0,10),true]]){
    await db.query("select set_config('test.today',$1,false)",[day]);
    for(const mode of ['AUTO','MOSTRAR','OCULTAR']){
     const v=evaluateVisibility(due,mode,new Date(day+'T12:00:00-07:00'));
     check(v.status,closed||mode==='OCULTAR'?'UNAVAILABLE':'AVAILABLE',due+' '+day+' '+mode);
     // Deliberately use stale AVAILABLE to prove SQL enforces cutoff independently.
     const r={...base,available_on:due,visibility_mode:mode};
     if(closed)await reject(quote(r,'test_cutoff_quote'),/FINANCIAL_PROGRAM_NOT_ELIGIBLE/);
     else check((await quote(r,'test_cutoff_quote')).amount,5000,'SQL remains open before cutoff');
    }
   }
  }
  // Execute the actual authenticated snapshot RPC with valid synthetic ownership.
  await db.query("insert into affiliates(id,auth_user_id,financial_union_code,financial_employee_category_code,financial_profile_version) values($1,$2,'U','C',1)",[affiliate,actor]);
  await db.exec("insert into segmentation_catalog_entries values('union','U','SUTISSSTESON',true),('employment_category','C','Base',true)");
  await db.query("select set_config('test.actor',$1,false),set_config('test.affiliate',$2,false)",[actor,affiliate]);
  await db.exec(`create function public.assert_savings_loan_quote_access(uuid,text,jsonb) returns void language plpgsql as $$begin
   if $2<>'advance' then raise exception 'UNEXPECTED_SAVINGS_TEST_DEPENDENCY';end if;end$$;
   insert into loan_term_policy values('primary',array[1,6,12,24],1,1,true,'isolated');`);
  const hash=v=>crypto.createHash('sha256').update(JSON.stringify(v)).digest('hex').toUpperCase();
  const profileHash=hash({actor_real_auth_user_id:actor,affiliate_id:affiliate,financial_affiliation_status:null,financial_employee_category:'Base',financial_employee_category_code:'C',financial_employee_type:null,financial_employment_status:null,financial_profile_version:1,financial_union:'SUTISSSTESON',financial_union_code:'U',impersonation_session_id:null});
  const policyHash=hash({customMinTerm:1,customStep:1,decisionReference:'isolated',source:policy.source,standardTerms:policy.standardTerms});
  await db.query("insert into financial_session_snapshots(id,affiliate_id,actor_real_auth_user_id,financial_profile_version,expires_at,calculation_contract_version,session_purpose,profile_fingerprint,term_policy_fingerprint,eligible_rules) values($1,$2,$3,1,now()+interval '10 minutes','SUTI_LOAN_QUOTE_V3','LOAN',$4,$5,$6)",[session,affiliate,actor,profileHash,policyHash,[{...base,available_on:future}]]);
  const interactive=()=>scalar('select resolve_current_loan_snapshot_quote($1,$2,5000,1) v',[session,base.id]);
  await db.exec('set role authenticated');check((await interactive()).amount,5000,'valid authenticated quote');await db.exec('reset role');
  await db.query('update financial_session_snapshots set eligible_rules=$1',[[{...base,available_on:today,visibility_mode:'MOSTRAR'}]]);
  await db.exec('set role authenticated');await reject(interactive(),/FINANCIAL_PROGRAM_NOT_ELIGIBLE/);await db.exec('reset role');
  await db.exec('set role anon');await reject(interactive(),/permission denied/);await db.exec('reset role');
  await db.exec("update financial_session_snapshots set actor_real_auth_user_id=gen_random_uuid()");
  await db.exec('set role authenticated');await reject(interactive(),/SNAPSHOT_INVALID/);await db.exec('reset role');
  await db.exec(read('supabase/recovery/'+version));
  check(await definitions(),before,'exact recovery of all function definitions and ACLs');
  check(await scalar('select jsonb_agg(to_jsonb(t) order by id) v from program_requests t'),history,'recovery preserves history');
  await db.exec(read('supabase/migrations/'+version));
  await reject(db.exec(read('supabase/migrations/'+version)),/DATED_FUND_CUTOFF_FUNCTION_DRIFT/);await db.exec('rollback');
  await db.exec(patched.definition.replace(' -- H-LOAN-DATED-FUND-CUTOFF-001:', ' -- Unexpected later modification: H-LOAN-DATED-FUND-CUTOFF-001:'));
  await reject(db.exec(read('supabase/recovery/'+version)),/RECOVERY_BLOCKED_DATED_FUND_CUTOFF_DRIFT/);await db.exec('rollback');
  await db.exec(patched.definition);
  // Recovery also rejects drift elsewhere, outside the exact added block.
  await db.exec(patched.definition.replace(' -- Simple interest', ' -- Later code change: simple interest'));
  await reject(db.exec(read('supabase/recovery/'+version)),/RECOVERY_BLOCKED_DATED_FUND_CUTOFF_DRIFT/);await db.exec('rollback');
  await db.exec(patched.definition);
  await db.exec(read('supabase/recovery/'+version).replace(/\r?\n/g,'\r\n'));
  check(await definitions(),before,'CRLF checkout exact recovery');
  await db.exec(read('supabase/migrations/'+version).replace(/\r?\n/g,'\r\n'));
  check(await definitions(),after,'CRLF checkout same migration result');
  // Existing approval honors captured financial terms even after visibility closes.
  const extract=(a,b)=>edge.slice(edge.indexOf(a),edge.indexOf(b,edge.indexOf(a)));
  vm.runInContext(stripTypeScriptTypes(extract('function assertAdvanceSubmissionDate(', 'async function approveRequest(')+extract('function businessDateISO(', 'function cajaRuleForProfile('))+';this.capture=capturedAdvanceApprovalResult;',ctx);
  ctx.BUSINESS_TIME_ZONE='America/Hermosillo';
  const captured=ctx.capture({...base,available_on:today,status:'UNAVAILABLE'},{created_at:today+'T12:00:00-07:00',requested_amount:5000,requested_term:1,financial_submission_snapshot:{financialResult:oldClosed}});
  check(captured,oldClosed,'historical submitted advance preserves captured contract');
  const result={status:'PASS',checks,example:{before:143000,after:133000},beforeFunctionHash:before.find(r=>r.signature.startsWith('resolve_suti_loan_quote_contract(')).hash,afterFunctionHash:patched.hash,exactRecovery:true,productionWrites:0,uiFilesChanged:0};
  const out=path.join(root,'docs/qa/evidence/loan-dated-fund-cutoff');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'isolated.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
 }finally{await db.close();}
}
main().catch(e=>{console.error(e.message,e.where||'');process.exitCode=1;});
