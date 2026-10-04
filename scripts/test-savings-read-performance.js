'use strict';
// Real installed reader definitions + metadata, isolated PostgreSQL/WASM.
// Auth providers are explicit test boundaries; no production network/data writes.
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),crypto=require('crypto');
const root=path.resolve(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8');
const {PGlite}=require(path.join(root,'.tmp/savings-loan-eligibility/node_modules/@electric-sql/pglite'));
const fixture=JSON.parse(read('scripts/fixtures/savings-read-performance-schema.json'));
const migration=read('supabase/migrations/20261003000500_savings_read_performance.sql'),recovery=read('supabase/recovery/20261003000500_savings_read_performance.sql');
const uuid=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0'),quote=v=>"'"+String(v).replaceAll("'","''")+"'";
const full=f=>f.signature.startsWith(f.schema_name+'.')?f.signature:f.schema_name+'.'+f.signature;
const key=t=>t.schema_name+'.'+(t.table_name||t.name);
async function main(){
 const db=new PGlite(),checks=[],timings={};let seq=1000;
 const q=async(sql,args=[])=>(await db.query(sql,args)).rows,v=async(sql,args)=>(await q(sql,args))[0]?.v;
 const owner=()=>db.exec('reset role'),user=async(affiliate=2,actor=1,session='session-1',imp='',perm='savings.read')=>{
  await owner();await q("select set_config('test.actor',$1,false),set_config('test.affiliate',$2,false),set_config('test.session',$3,false),set_config('test.impersonation',$4,false),set_config('test.permission',$5,false)",[actor?uuid(actor):'',affiliate?uuid(affiliate):'',session,imp,perm]);await db.exec('set role authenticated');
 };
 const check=async(name,fn)=>{await fn();checks.push(name);console.log('PASS '+name);};
 const identifier=n=>'"'+n.replaceAll('"','""')+'"';
 const insert=async(table,row)=>{await owner();const cols=Object.keys(row);return v('insert into '+table+'('+cols.map(identifier).join(',')+') values('+cols.map((_,i)=>'$'+(i+1)).join(',')+') returning to_jsonb('+table.split('.').at(-1)+') v',Object.values(row));};
 const next=()=>uuid(++seq);
 const self=known=>v('select public.get_self_savings_if_changed($1) v',[known??null]);
 const fresh=()=>v('select public.get_self_savings_live_readonly() v');
 const businessHash=async()=>{await owner();const hashes={};for(const table of fixture.tables)hashes[key(table)]=await v('select md5(coalesce(string_agg(to_jsonb(t)::text,\'\' order by to_jsonb(t)::text),\'\')) v from '+key(table)+' t');return hashes;};
 try{
  await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create schema extensions;create schema savings_period_private;create schema savings_automatic_private;
   create function extensions.gen_random_uuid() returns uuid language sql as $$select gen_random_uuid()$$;
   create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.actor',true),'')::uuid$$;
   create function auth.jwt() returns jsonb language sql stable as $$select jsonb_build_object('session_id',nullif(current_setting('test.session',true),''))$$;
   create function public.get_effective_affiliate_id() returns uuid language sql stable as $$select nullif(current_setting('test.affiliate',true),'')::uuid$$;
   create function public.get_impersonation_context() returns table(session_id text,actor_auth_user_id uuid) language sql stable as $$select nullif(current_setting('test.impersonation',true),''),auth.uid()$$;
   create function public.has_admin_permission(text) returns boolean language sql stable as $$select $1=any(string_to_array(coalesce(current_setting('test.permission',true),''),','))$$;
   create function public.savings_review_edit_allowed() returns boolean language sql stable as $$select false$$;
   create function public.savings_review_identity_allowed() returns boolean language sql stable as $$select false$$;
   create function public.savings_if_changed_before_publication(text) returns jsonb language sql stable as $$select jsonb_build_object('private_unchanged',true,'known',$1)$$;
   create function public.savings_self_before_publication() returns jsonb language sql stable as $$select jsonb_build_object('private',true)$$;
   grant usage on schema public,auth to authenticated,anon,service_role;
   set check_function_bodies=false;
  `);
  for(const table of fixture.tables){
   const cols=fixture.columns.filter(c=>key(c)===key(table)).sort((a,b)=>a.ordinal-b.ordinal).map(c=>identifier(c.column_name)+' '+c.type+(c.default_value?' default '+c.default_value:'')+(c.required?' not null':''));
   const constraints=fixture.constraints.filter(c=>key(c)===key(table)&&/^(CHECK|PRIMARY KEY|UNIQUE|EXCLUDE)/.test(c.definition)).map(c=>'constraint '+identifier(c.name)+' '+c.definition);
   await db.exec('create table '+key(table)+'('+cols.concat(constraints).join(',')+');alter table '+key(table)+' enable row level security;alter table '+key(table)+' force row level security;revoke all on '+key(table)+' from public,anon,authenticated,service_role;');
  }
  // Foreign-key endpoints outside this read graph are represented by key-only
  // providers. Financial table shapes/checks/indexes and all readers remain real.
  const external=new Set();for(const c of fixture.constraints.filter(c=>c.definition.startsWith('FOREIGN KEY'))){const match=c.definition.match(/REFERENCES ([\w.]+)\((\w+)\)/);if(match){const name=match[1].includes('.')?match[1]:'public.'+match[1];if(!fixture.tables.some(t=>key(t)===name)&&!external.has(name)){external.add(name);await db.exec('create table '+name+'('+identifier(match[2])+' uuid primary key)');}}}
  for(const f of fixture.functions){await db.exec(f.definition);await db.exec('revoke all on function '+full(f)+' from public,anon,authenticated,service_role');for(const entry of (f.acl||'').slice(1,-1).split(',')){const role=entry.split('=')[0];if(['authenticated','anon','service_role'].includes(role))await db.exec('grant execute on function '+full(f)+' to '+role);}}
  for(const i of fixture.indexes){if(!/CREATE (UNIQUE )?INDEX \w+_pkey /.test(i.definition)&&!fixture.constraints.some(c=>key(c)===key(i)&&i.definition.includes('INDEX '+c.name+' ')))await db.exec(i.definition);}
  // Verify exact current PostgreSQL definitions, including original newline body.
  for(const f of fixture.functions)assert.equal(await v('select md5(pg_get_functiondef($1::regprocedure)) v',[full(f)]),f.definition_md5,full(f));
  const date=await v('select public.savings_operation_today()::text v'),year=Number(date.slice(0,4)),start=year+'-01-01',future=(year+1)+'-01-15';
  await insert('public.savings_publication_state',{id:true,mode:'PUBLISHED',fingerprint:'synthetic',published_at:date,actor_real_auth_user_id:uuid(1)});
  for(const n of [2,3,4,5])await insert('public.affiliates',{id:uuid(n),numero_control:n===2?'00123':n===3?'123':n===4?'CERT':'NEW',full_name:'SYNTHETIC '+n,auth_eligibility:'eligible',record_origin:'ADMIN_AFFILIATES'});
  const account=async(af,n)=>{
   const p=uuid(n),en=uuid(n+10),plan=uuid(n+20),tx=uuid(n+30);
   await insert('public.savings_participants',{id:p,participant_type:'AFFILIATE',affiliate_id:uuid(af),legacy_folio:af===2?'00123':af===3?'123':'CERT',identity_status:'RESOLVED',certification_status:'CERTIFIED',data_classification:'CANONICAL'});
   await insert('public.savings_enrollments',{id:en,participant_id:p,sequence_number:1,status:'ACTIVE',enrollment_started_at:start,approved_at:start,first_expected_contribution_date:start,first_actual_contribution_date:start,process_snapshot:'PROCESS_1',data_classification:'CANONICAL'});
   await insert('public.savings_contribution_plans',{id:plan,enrollment_id:en,amount:300,process_snapshot:'PROCESS_1',effective_from:start,data_classification:'CANONICAL'});
   await insert('public.savings_transactions',{id:tx,participant_id:p,enrollment_id:en,transaction_type:'CONTRIBUTION',component:'CAPITAL',direction:'CREDIT',amount:1000,effective_date:start,contribution_date:start,idempotency_key:tx,data_classification:'CANONICAL'});
   return {p,en,plan,tx};
  };
  const a=await account(2,100),b=await account(3,200);
  const batch=next();await insert('public.savings_review_batches',{id:batch,source_sha256:'a'.repeat(64),source_name:'ISOLATED',observed_at:date,expected_records:3});
  for(const [row,folio,type,status,extra]of [[2,'UNKNOWN','Ahorro','IN_REVIEW',{}],[3,'00123','Solicitud Cambio ahorro','PENDING',{E:'FALSE'}],[4,'123','Solicitud de retiro','RESOLVED',{H:'Completado'}]])await insert('public.savings_review_records',{id:next(),batch_id:batch,source_sheet:type,source_row:row,source_folio:folio,status,source_data:{A:folio,D:'1',F:start,Q:0,R:300,S:300,W:'Ahorrando',X:start,...extra},field_defs:[],raw_source:{}});
  const c=await account(4,300),certRecord=next(),cert=next(),sourceSnapshot={source:{A:'CERT',D:'1',F:start,Q:1000,R:300,S:300,W:'Ahorrando',X:start,G:1000,AR:0,DP:1000,DQ:0,DS:0,DT:0},proposal:{},related:[]};
  await insert('public.savings_review_records',{id:certRecord,batch_id:batch,source_sheet:'Ahorro',source_row:5,source_folio:'CERT',status:'RESOLVED',source_data:sourceSnapshot.source,field_defs:[],raw_source:{}});
  await insert('public.savings_balance_certifications',{id:cert,record_id:certRecord,participant_id:c.p,enrollment_id:c.en,cutoff_on:date,source_version:1,source_snapshot:sourceSnapshot,command:{first_date:start},capital:1000,yield_amount:0,actor_real_auth_user_id:uuid(1),client_action_id:next()});
  await user();const beforeFresh=await fresh(),beforeSummary=await v('select public.get_admin_savings_workspace_summary() v');
  assert.equal((await self()).cacheable,false);const beforeData=await businessHash();
  const functionBefore=await q('select oid::text,oid::regprocedure::text signature,proacl::text acl,proowner::text owner,md5(pg_get_functiondef(oid)) md5 from pg_proc where oid=any($1::regprocedure[])',[fixture.functions.map(full)]);
  await check('migration preserves all business rows and existing function OIDs/ACLs',async()=>{
   await owner();await db.exec(migration);assert.deepEqual(await businessHash(),beforeData);
   for(const f of functionBefore){const now=(await q('select oid::text,proacl::text acl,proowner::text owner from pg_proc where oid=$1::oid',[f.oid]))[0];assert.equal(now.oid,f.oid);assert.equal(now.acl,f.acl);assert.equal(now.owner,f.owner);}
  });
  await check('full self DTO and direct admin summary equal existing canonical readers',async()=>{
   await user();const current=await self();assert.equal(current.cacheable,true);assert.equal(current.modified,true);assert.match(current.version,/^[a-f0-9]{32}$/);assert.deepEqual(current.data,beforeFresh);assert.deepEqual(await v('select public.get_admin_savings_workspace_summary() v'),beforeSummary);
   assert.equal(beforeSummary.kpis.afiliados,4);assert.equal(beforeSummary.kpis.incidencias,1);assert.equal(beforeSummary.kpis.pendientes,1);assert.equal(beforeSummary.kpis.solicitudes_estado_pendiente,1);
   await user(4);const imported=await self();assert.deepEqual(imported.data,await fresh());assert(imported.data.annual.some(row=>row.year==='2025'&&row.yield===0),'historical zero-yield is preserved');
  });
  await check('unchanged response is small and omits canonical DTO',async()=>{
   await user();let begin=performance.now();const first=await self();timings.fullMs=performance.now()-begin;
   begin=performance.now();const unchanged=await self(first.version);timings.unchangedMs=performance.now()-begin;
   assert.equal(unchanged.modified,false);assert.equal(unchanged.cacheable,true);assert.equal(unchanged.version,first.version);assert(!Object.hasOwn(unchanged,'data'));
   timings.fullBytes=Buffer.byteLength(JSON.stringify(first));timings.unchangedBytes=Buffer.byteLength(JSON.stringify(unchanged));assert(timings.unchangedBytes<timings.fullBytes/4);
  });
  const invalidates=async(label,mutation,affiliate=2)=>{await user(affiliate);const initial=await self();await owner();await db.exec('begin');try{await mutation(initial);await user(affiliate);const changed=await self(initial.version);assert.equal(changed.modified,true,label);assert.notEqual(changed.version,initial.version,label);assert.deepEqual(changed.data,await fresh(),label);await owner();await db.exec('rollback');}catch(e){await db.exec('rollback');await owner();throw e;}};
  await check('contribution correction, withdrawal, hold and request invalidate only affected Folio',async()=>{
   await invalidates('contribution',()=>insert('public.savings_transactions',{id:next(),participant_id:a.p,enrollment_id:a.en,transaction_type:'ADJUSTMENT',component:'CAPITAL',direction:'CREDIT',amount:300,effective_date:date,contribution_date:date,idempotency_key:next(),data_classification:'CANONICAL'}));
   await invalidates('withdrawal',()=>insert('public.savings_transactions',{id:next(),participant_id:a.p,transaction_type:'WITHDRAWAL',component:'CAPITAL',direction:'DEBIT',amount:100,effective_date:date,idempotency_key:next(),data_classification:'CANONICAL'}));
   await invalidates('hold',()=>insert('public.savings_holds',{id:next(),participant_id:a.p,component:'CAPITAL',amount:25,reason:'SYNTHETIC HOLD',created_by_auth_user_id:uuid(1)}));
   await invalidates('request',()=>insert('public.savings_requests',{id:next(),folio:'TEST-'+seq,participant_id:a.p,request_type:'WITHDRAW',requested_amount:50,status:'SUBMITTED',idempotency_key:next(),actor_real_auth_user_id:uuid(1),usuario_contexto_affiliate_id:uuid(2),data_classification:'CANONICAL',metadata:{origin:'SAVINGS_RUNTIME_V1'}}));
   await user();const initial=await self();await insert('public.savings_transactions',{id:next(),participant_id:b.p,transaction_type:'ADJUSTMENT',component:'CAPITAL',direction:'CREDIT',amount:20,effective_date:date,idempotency_key:next(),data_classification:'CANONICAL'});await user();assert.equal((await self(initial.version)).modified,false,'00123 is not 123');
  });
  await check('plans receipts scheduled instructions and retirement transitions invalidate',async()=>{
   await invalidates('plan',()=>q('update public.savings_contribution_plans set amount=350 where id=$1',[a.plan]));
   await invalidates('receipt',()=>insert('public.savings_contribution_overrides',{id:next(),enrollment_id:a.en,contribution_date:date,expected_amount:300,actual_amount:0,version_number:1,reason:'SYNTHETIC',client_action_id:next(),entry_source:'SYSTEM_SCHEDULE'}));
   await invalidates('instruction',async()=>insert('savings_automatic_private.instructions',{id:next(),enrollment_id:a.en,contribution_date:future,amount:0,version:1,plan_id:a.plan,plan_hash:await v('select savings_automatic_private.plan_hash($1) v',[a.plan]),actor_real_auth_user_id:uuid(1),reason:'SYNTHETIC',client_action_id:next()}));
   await invalidates('retirement',()=>insert('public.savings_process_change_events',{id:next(),participant_id:a.p,new_process:'JUB',status:'APPLIED',reason:'SYNTHETIC',effective_from:date,conversion_snapshot:{enrollment_id:a.en,conversion_rule:'TWO_FORTNIGHTS_TO_ONE_MONTH',new_plan_id:a.plan,previous_amount:300,new_amount:600}}));
  });
  await check('beneficiaries yield periods and period attribution invalidate',async()=>{
   await invalidates('beneficiary',async()=>{const version=next();await insert('public.savings_beneficiary_versions',{id:version,participant_id:a.p,version_number:1,status:'ACTIVE',actor_real_auth_user_id:uuid(1)});await insert('public.savings_beneficiaries',{id:next(),version_id:version,full_name:'SYNTHETIC BENEFICIARY',relationship:'FAMILY',percentage:100});});
   await invalidates('yield',async()=>{const period=next();await insert('public.savings_yield_periods',{id:period,period_year:year,semester:1,starts_on:start,ends_on:year+'-06-30',rate:.1,status:'CREDITED',productive_enabled:true});await insert('public.savings_yield_allocations',{id:next(),yield_period_id:period,participant_id:a.p,eligible:true,approved_amount:50,status:'CREDITED'});});
   await invalidates('origin',async()=>{const event=next();await insert('savings_period_private.attribution_events',{id:event,transaction_id:a.tx,participant_id:a.p,kind:'OPENING',actor_real_auth_user_id:uuid(1),reason:'SYNTHETIC',client_action_id:next(),command:{}});await insert('savings_period_private.attribution_slices',{event_id:event,origin_key:'2025',amount:1000});});
  });
  await check('deletions and current source corrections invalidate without timestamp assumptions',async()=>{
   await invalidates('delete movement',()=>q('delete from public.savings_transactions where id=$1',[a.tx]));
   await invalidates('review source',()=>q("update public.savings_review_records set proposed_data='{}'::jsonb||jsonb_build_object('D',123) where source_folio='00123'"));
   await invalidates('settings',()=>insert('public.savings_operation_settings',{id:next(),entry_mode:'WINDOWS',reason:'SYNTHETIC',actor_real_auth_user_id:uuid(1),client_action_id:next()}));
  });
  await check('certified historic snapshot and accepted balance corrections invalidate',async()=>{
   await invalidates('certification',()=>q("update public.savings_balance_certifications set source_snapshot=jsonb_set(source_snapshot,'{source,DQ}','5') where id=$1",[cert]),4);
   await invalidates('accepted correction',()=>insert('public.savings_audit_events',{id:++seq,participant_id:c.p,resource:'savings_balance_certifications',action:'ADJUST_CONFIRMED_BALANCE',after_data:{source_snapshot:{...sourceSnapshot,proposal:{DQ:7}}}}),4);
  });
  await check('context/session/impersonation/day changes and absent session cannot reuse old data',async()=>{
   await user();const first=await self();await user(2,1,'session-2');assert.equal((await self(first.version)).modified,true);
   await user(2,1,'session-1','impersonation-1');assert.equal((await self(first.version)).modified,true);
   await user(3);const other=await self(first.version);assert.equal(other.modified,true);assert.equal(other.data.participant.legacy_folio,'123');
   await user(2,1,'');const noSession=await self(first.version);assert.equal(noSession.cacheable,false);assert.equal(noSession.modified,true);
   await owner();const hash=async day=>v('select savings_read_private.self_version($1,$2,$3) v',[uuid(2),first.context,day]);assert.notEqual(await hash(year+'-06-30'),await hash(year+'-07-01'));assert.notEqual(await hash(year+'-12-31'),await hash((year+1)+'-01-01'));
  });
  await check('intraday action expiration invalidates without data changes',async()=>{
   await owner();await db.exec('begin');await insert('public.savings_action_availability',{id:next(),action_code:'WITHDRAW',scope_type:'PARTICIPANT',participant_id:a.p,enabled:true,reason:'SYNTHETIC',configured_by_auth_user_id:uuid(1),effective_from:'2000-01-01',effective_to:await v("select (clock_timestamp()+interval '2 seconds')::text v")});await db.exec('commit');
   await user();const before=await self();assert.equal(before.data.actions.WITHDRAW,true);await new Promise(resolve=>setTimeout(resolve,2200));const after=await self(before.version);assert.equal(after.modified,true);assert.equal(after.data.actions.WITHDRAW,false);
  });
  await check('fresh authorization and exact identity guard every request including known version',async()=>{
   await user();const first=await self();await user(2,0);await assert.rejects(()=>self(first.version),/SAVINGS_AFFILIATE_REQUIRED/);
   await user(2,1,'session-1','','');await assert.rejects(()=>v('select public.get_admin_savings_workspace_summary() v'),/SAVINGS_READ_DENIED/);
   await owner();await db.exec('begin');await q("update public.affiliates set numero_control='123' where id=$1",[uuid(2)]);await user();await assert.rejects(()=>self(first.version),/SAVINGS_EXACT_IDENTITY_REQUIRED/);await db.exec('rollback');await owner();
   await db.exec('set role anon');await assert.rejects(()=>self(),/permission denied/);await db.exec('reset role');await db.exec('set role authenticated');await assert.rejects(()=>v('select savings_read_private.self_version(null,null,null) v'),/permission denied/);await owner();
  });
  await check('unrecognized reader definitions disable reuse while retaining fresh canonical authority',async()=>{
   await user();const initial=await self();await owner();const f=fixture.functions.find(f=>f.name==='savings_panel_number');await db.exec(f.definition.replace('AS $function$','AS $function$\n-- changed reader contract\n'));
   await user();const changed=await self(initial.version);assert.equal(changed.modified,true);assert.equal(changed.cacheable,false);assert.equal(changed.version,null);assert.deepEqual(changed.data,await fresh());await owner();await db.exec(f.definition);
  });
  await check('PRIVATE publication branch remains unchanged and new account keeps JOIN contract',async()=>{
   await owner();await db.exec('begin');await db.exec("update public.savings_publication_state set mode='PRIVATE',published_at=null");await user();assert.deepEqual(await self('known'),{private_unchanged:true,known:'known'});await owner();await db.exec('rollback');
   await user(5);const empty=await self();assert.equal(empty.data.participant,null);assert.equal(empty.cacheable,true);assert.equal((await self(empty.version)).modified,false);
  });
  await check('admin summary equivalent after changes and never invokes full panel',async()=>{
   await user();const panel=await v("select public.get_admin_savings_panel('padron','','todos',0,1) v"),direct=await v('select public.get_admin_savings_workspace_summary() v');assert.deepEqual(direct.kpis,panel.kpis);assert.equal(direct.collection_status,panel.collection_status);
   await owner();const f=fixture.functions.find(f=>f.name==='get_admin_savings_panel');await db.exec("create or replace function public.get_admin_savings_panel(p_tab text default 'padron',p_search text default '',p_filter text default 'todos',p_offset integer default 0,p_limit integer default 20) returns jsonb language plpgsql stable security definer set search_path='' as $$begin raise exception 'FULL_PANEL_MUST_NOT_RUN';end$$;");await user();assert.deepEqual(await v('select public.get_admin_savings_workspace_summary() v'),direct);await owner();await db.exec(f.definition);
  });
  await check('known version returns before any DTO construction, verified with fail-on-call probe',async()=>{
   await user();const first=await self();await owner();
   const live=fixture.functions.find(f=>f.name==='get_self_savings_live_readonly'),versionDef=await v("select pg_get_functiondef('savings_read_private.self_version(uuid,jsonb,date)'::regprocedure) v");
   await db.exec(live.definition.replace(/\bbegin\b/,"begin if current_setting('test.fail_dto',true)='yes' then raise exception 'DTO_MUST_NOT_RUN';end if;"));
   const probeHash=await v("select md5(pg_get_functiondef('public.get_self_savings_live_readonly()'::regprocedure)) v");
   // Permit only this instrumentation in the isolated graph guard, so its body
   // can prove whether the same-version path ever calls the heavy projection.
   await db.exec(versionDef.replace(live.definition_md5,probeHash));await q("select set_config('test.fail_dto','yes',false)");
   await user();assert.equal((await self(first.version)).modified,false);await assert.rejects(()=>self(),/DTO_MUST_NOT_RUN/);
   await owner();await q("select set_config('test.fail_dto','no',false)");await db.exec(live.definition);await db.exec(versionDef);
  });
  await check('guarded recovery restores exact definitions and leaves financial rows intact',async()=>{
   await owner();const before=await businessHash();await db.exec(recovery);assert.deepEqual(await businessHash(),before);for(const f of functionBefore)assert.equal(await v('select md5(pg_get_functiondef($1::regprocedure)) v',[f.signature]),f.md5,f.signature);assert.equal(await v("select to_regnamespace('savings_read_private')::text v"),null);
  });
  console.log(JSON.stringify({status:'PASS',checks,timings,fixture:{functions:fixture.functions.length,tables:fixture.tables.length,metadataOnly:true},limitations:['Auth and PRIVATE branch providers isolated; unchanged real backend guards inspected','No production load benchmark','Foreign keys to unrelated domains represented by key-only providers; no writers exercised'],externalQueries:0,productionWrites:0}));
 }finally{await db.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
