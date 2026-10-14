'use strict';
// Isolated PostgreSQL/WASM tests. All identities and amounts are synthetic.
// No network, credentials, production rows or financial commands are used.
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),crypto=require('crypto');
const root=path.resolve(__dirname,'..'),read=file=>fs.readFileSync(path.join(root,file),'utf8').replace(/\r\n/g,'\n');
function dependency(){
 if(process.env.SUTIAPP_PGLITE_PATH)return require(process.env.SUTIAPP_PGLITE_PATH);
 for(let folder=root;;folder=path.dirname(folder)){
  const candidate=path.join(folder,'.tmp/savings-loan-eligibility/node_modules/@electric-sql/pglite');
  if(fs.existsSync(candidate))return require(candidate);
  if(path.dirname(folder)===folder)throw Error('Set SUTIAPP_PGLITE_PATH to the existing PGlite dependency.');
 }
}
const {PGlite}=dependency(),migrationFile='supabase/migrations/20261014000200_savings_withdrawal_history.sql',recoveryFile='supabase/recovery/20261014000200_savings_withdrawal_history.sql';
const migration=read(migrationFile),recovery=read(recoveryFile),signature='public.get_admin_savings_withdrawal_history(text,text,integer,integer)';
const hash=value=>crypto.createHash('sha256').update(typeof value==='string'?value:JSON.stringify(value)).digest('hex');
const uid=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0'),actor=uid(900000),checks=[];
const states=['SUBMITTED','UNDER_REVIEW','APPROVED','SETTLED','REJECTED','CANCELLED'];
async function main(){
 const db=new PGlite(),query=async(sql,args=[])=>(await db.query(sql,args)).rows;
 const scalar=async(sql,args=[])=>(await query(sql,args))[0]?.value;
 async function check(name,body){await body();checks.push(name);console.log('PASS '+name);}
 async function as(role,permissions,body,user=actor){
  await db.exec('reset role');
  await query("select set_config('test.uid',$1,false),set_config('test.permissions',$2,false)",[user||'',JSON.stringify(permissions)]);
  await db.exec('set role '+role);
  try{return await body();}finally{await db.exec('reset role');}
 }
 const raw=(search='',status='all',offset=0,limit=20)=>scalar('select public.get_admin_savings_withdrawal_history($1,$2,$3,$4) value',[search,status,offset,limit]);
 const list=(...args)=>as('authenticated',['savings.read'],()=>raw(...args));
 const rejected=(promise,code)=>assert.rejects(promise,error=>error.code===code);
 const sourceState=()=>scalar(`select jsonb_build_object(
  'affiliates',(select jsonb_agg(to_jsonb(a) order by id) from public.affiliates a),
  'participants',(select jsonb_agg(to_jsonb(p) order by id) from public.savings_participants p),
  'requests',(select jsonb_agg(to_jsonb(r) order by id) from public.savings_requests r),
  'table_security',(select jsonb_agg(jsonb_build_object('oid',c.oid,'name',c.relname,'owner',c.relowner,'acl',c.relacl,'rls',c.relrowsecurity,'force_rls',c.relforcerowsecurity) order by c.oid)
   from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r'),
  'previous_functions',(select jsonb_agg(jsonb_build_object('oid',p.oid,'owner',p.proowner,'acl',p.proacl,'definition',pg_get_functiondef(p.oid)) order by p.oid)
   from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','auth') and p.proname<>'get_admin_savings_withdrawal_history')
 ) value`);
 try{
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;
   grant usage on schema public,auth to anon,authenticated,service_role;
   create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
   create function public.has_admin_permission(p text) returns boolean language sql stable as $$select coalesce(current_setting('test.permissions',true),'[]')::jsonb ? p$$;
   create table public.affiliates(id uuid primary key,numero_control text,full_name text,is_archived boolean not null default false);
   create table public.savings_participants(id uuid primary key,affiliate_id uuid references public.affiliates(id),legacy_folio text,display_name text,identity_status text,data_classification text);
   create table public.savings_requests(id uuid primary key,participant_id uuid not null references public.savings_participants(id),folio text not null unique,
    request_type text,status text,requested_amount numeric(14,2),requested_capital_amount numeric(14,2),requested_yield_amount numeric(14,2),
    continue_saving boolean,submitted_at timestamptz not null,reviewed_at timestamptz,settled_at timestamptz,data_classification text,metadata jsonb,
    idempotency_key uuid,actor_real_auth_user_id uuid,reason text,supporting_document_id uuid);
   alter table public.affiliates enable row level security;alter table public.affiliates force row level security;
   alter table public.savings_participants enable row level security;alter table public.savings_participants force row level security;
   alter table public.savings_requests enable row level security;alter table public.savings_requests force row level security;
   revoke all on public.affiliates,public.savings_participants,public.savings_requests from public,anon,authenticated,service_role;
   create function public.existing_savings_writer() returns text language sql as $$select 'UNCHANGED'::text$$;
   revoke all on function public.existing_savings_writer() from public,anon,authenticated,service_role;`);
  const names=read('supabase/migrations/20261001000300_savings_affiliate_names.sql'),helperStart=names.indexOf('create function public.savings_affiliate_display_name('),helperEnd=names.indexOf('$$;',helperStart);
  assert(helperStart>=0&&helperEnd>helperStart);
  const helper=names.slice(helperStart,helperEnd+3)+'\n'+names.match(/revoke all on function public\.savings_affiliate_display_name\(uuid\)[^;]*;/)[0];
  await db.exec(helper);
  const identities=[
   [1,'00123','Nombre Vigente Uno','RESOLVED','CANONICAL'],
   [2,'123','Persona %_ literal','RESOLVED','CANONICAL'],
   [3,'AMB','Persona Ambigua','AMBIGUOUS','CANONICAL'],
   [4,'LEGACY','Persona Historica','RESOLVED','LEGACY'],
   [5,'DUP','Identidad Duplicada A','RESOLVED','CANONICAL'],
   [6,'DUP','Identidad Duplicada B','RESOLVED','CANONICAL'],
   [7,'EMPTY',null,'RESOLVED','CANONICAL']
  ];
  for(const [n,folio,name,status,classification] of identities){
   await query('insert into public.affiliates values($1,$2,$3,false)',[uid(n),folio,name]);
   await query('insert into public.savings_participants values($1,$1,$2,$3,$4,$5)',[uid(n),folio,'Nombre legado distinto '+n,status,classification]);
  }
  const records=[];
  function row(n,overrides={}){
   return {id:uid(n+1000),participant_id:uid(1),folio:'SYNTH-WITHDRAWAL-'+String(n).padStart(4,'0'),request_type:'WITHDRAW',status:'SUBMITTED',
    requested_amount:123.45,requested_capital_amount:100,requested_yield_amount:23.45,continue_saving:true,
    submitted_at:'2026-10-01T12:00:00Z',reviewed_at:null,settled_at:null,data_classification:'CANONICAL',metadata:{origin:'SAVINGS_RUNTIME_V1',private_note:'NOT_FOR_HISTORY_DTO'},
    idempotency_key:uid(n+100000),actor_real_auth_user_id:actor,reason:'PRIVATE_SYNTHETIC_REASON',supporting_document_id:uid(800000),...overrides};
  }
  for(let n=1;n<=515;n++)records.push(row(n,{status:states[n%states.length],reviewed_at:n%states.length>=2?'2026-10-02T12:00:00Z':null,settled_at:n%states.length===3?'2026-10-03T12:00:00Z':null}));
  const oldest=row(516,{status:'SETTLED',submitted_at:'2000-01-01T00:00:00Z',settled_at:'2000-01-02T12:00:00Z',continue_saving:false});records.push(oldest);
  const secondPerson=row(517,{participant_id:uid(2),status:'APPROVED',request_type:'EXTRAORDINARY_WITHDRAWAL'});records.push(secondPerson);
  const ambiguous=row(518,{participant_id:uid(3)}),duplicate=row(519,{participant_id:uid(5)}),noName=row(520,{participant_id:uid(7)});records.push(ambiguous,duplicate,noName);
  const missingComponent=row(521,{status:'SETTLED',requested_yield_amount:null}),proof=row(522,{status:'APPROVED',requested_amount:250,requested_capital_amount:null,requested_yield_amount:null});records.push(missingComponent,proof);
  records.push(row(600,{request_type:'JOIN'}),row(601,{request_type:'CHANGE_AMOUNT'}),row(602,{request_type:'TERMINATE'}),
   row(603,{metadata:{origin:'HISTORICAL_IMPORT'}}),row(604,{metadata:{}}),row(605,{data_classification:'LEGACY'}),row(606,{data_classification:'SHADOW'}),row(607,{participant_id:uid(4)}));
  await query(`insert into public.savings_requests select * from jsonb_populate_recordset(null::public.savings_requests,$1::jsonb)`,[JSON.stringify(records)]);

  const settlementSourceFile='supabase/migrations/20261003000400_savings_automatic_contributions.sql',settlementSource=read(settlementSourceFile);
  const assign="capital:=(p_command->>'capital')::numeric;yield_value:=(p_command->>'yield')::numeric;";
  const actualUpdate="update public.savings_requests set status='SETTLED',settled_at=clock_timestamp(),requested_capital_amount=capital,requested_yield_amount=yield_value where id=r.id returning * into r;";
  await check('Existing settlement SQL records delivered capital/yield and settlement timestamp',async()=>{
   assert(settlementSource.includes(assign));assert(settlementSource.includes(actualUpdate));
   assert(settlementSource.includes('capital+yield_value<>r.requested_amount'));
   // Execute the unchanged source statement in the isolated database, rather
   // than assuming the historically named requested_* columns mean payment.
   await db.exec(`do $proof$ declare r public.savings_requests;capital numeric;yield_value numeric;p_command jsonb:='{"capital":200,"yield":50}';
    begin select * into r from public.savings_requests where id='${proof.id}';${assign}${actualUpdate}end $proof$;`);
   const saved=await scalar('select to_jsonb(r) value from public.savings_requests r where id=$1',[proof.id]);
   assert.equal(saved.status,'SETTLED');assert.equal(saved.requested_capital_amount,200);assert.equal(saved.requested_yield_amount,50);assert(saved.settled_at);
   Object.assign(proof,{status:'SETTLED',requested_capital_amount:200,requested_yield_amount:50,settled_at:saved.settled_at});
  });
  const before=await sourceState();
  await check('Additive installation preserves every existing row, function and table security setting',async()=>{
   await db.exec(migration);assert.deepEqual(await sourceState(),before);
  });
  await check('RPC is stable, definer, fixed-search-path and authenticated-only; tables stay private',async()=>{
   const info=await scalar('select to_jsonb(p) value from pg_proc p where oid=$1::regprocedure',[signature]);
   assert.equal(info.provolatile,'s');assert.equal(info.prosecdef,true);assert.deepEqual(info.proconfig,['search_path=""']);
   for(const [role,allowed] of [['anon',false],['authenticated',true],['service_role',false]]){
    assert.equal(await scalar('select has_function_privilege($1,$2,\'EXECUTE\') value',[role,signature]),allowed);
    for(const table of ['affiliates','savings_participants','savings_requests']){
     assert.equal(await scalar('select has_table_privilege($1,$2,\'SELECT\') value',[role,'public.'+table]),false);
    }
   }
   assert.equal(await scalar("select has_function_privilege('authenticated','public.savings_affiliate_display_name(uuid)','EXECUTE') value"),false);
  });
  await check('Anonymous, unauthenticated and accounts without savings.read cannot read history',async()=>{
   await rejected(as('anon',['savings.read'],()=>raw()),'42501');
   await rejected(as('service_role',['savings.read'],()=>raw()),'42501');
   await rejected(as('authenticated',[],()=>raw()),'42501');
   await rejected(as('authenticated',['savings.write','savings.approve','document_generation.read'],()=>raw()),'42501');
   await rejected(as('authenticated',['savings.read'],()=>raw(),null),'42501');
   for(const table of ['affiliates','savings_participants','savings_requests'])await rejected(as('authenticated',['savings.read'],()=>query('select * from public.'+table)),'42501');
  });
  const included=records.filter(r=>r.data_classification==='CANONICAL'&&r.participant_id!==uid(4)&&r.metadata.origin==='SAVINGS_RUNTIME_V1'&&['WITHDRAW','EXTRAORDINARY_WITHDRAWAL'].includes(r.request_type));
  const sorted=[...included].sort((a,b)=>b.submitted_at.localeCompare(a.submitted_at)||b.id.localeCompare(a.id));
  await check('More than 500 withdrawals paginate completely, including the oldest completed operation',async()=>{
   assert(included.length>500);const seen=[];
   for(let offset=0;offset<included.length;offset+=50){const page=await list('','all',offset,50);assert.equal(page.total,included.length);assert.equal(page.offset,offset);assert.equal(page.limit,50);seen.push(...page.rows.map(r=>r.id));}
   assert.deepEqual(seen,sorted.map(r=>r.id));assert.equal(new Set(seen).size,included.length);assert.equal(seen.at(-1),oldest.id);
   const beyond=await list('','all',included.length+100,20);assert.deepEqual(beyond.rows,[]);assert.equal(beyond.total,included.length);
   const defaults=await list();assert.equal(defaults.rows.length,20);assert.equal(defaults.total,included.length);
  });
  await check('Only canonical operational withdrawal types are included; repeated people retain every request',async()=>{
   const exact=await list(oldest.folio);assert.equal(exact.total,1);assert.equal(exact.rows[0].id,oldest.id);
   for(const n of [600,601,602,603,604,605,606,607])assert.equal((await list('SYNTH-WITHDRAWAL-'+String(n).padStart(4,'0'))).total,0);
   const ordinary=await list('00123');assert.equal(ordinary.total,included.filter(r=>r.participant_id===uid(1)).length);
   const special=await list(secondPerson.folio);assert.equal(special.rows[0].request_type,'EXTRAORDINARY_WITHDRAWAL');
   assert.equal((await list('','all',0,1)).rows[0].id,sorted[0].id);
  });
  await check('Current names, raw person folios and request folios support literal substring search',async()=>{
   assert.equal((await list('nombre vigente')).total,included.filter(r=>r.participant_id===uid(1)).length);
   assert.equal((await list('Nombre legado distinto')).total,0);
   assert.equal((await list('%_')).total,1);assert.equal((await list('%_')).rows[0].id,secondPerson.id);
   assert.equal((await list("' OR 1=1 --")).total,0);
   assert.equal((await list(oldest.folio.toLowerCase())).rows[0].saver_folio,'00123');
   assert.equal((await list(null)).total,included.length);
  });
  await check('Real identity helper keeps ambiguous, duplicate and missing names explicit',async()=>{
   assert.equal((await list(ambiguous.folio)).rows[0].name,'Identidad por revisar');
   assert.equal((await list(duplicate.folio)).rows[0].name,'Identidad por revisar');
   assert.equal((await list(noName.folio)).rows[0].name,'Nombre no disponible en Afiliados');
   assert.equal((await list('Persona Ambigua')).total,0);assert.equal((await list('Identidad Duplicada A')).total,0);
  });
  await check('Status totals are computed before pagination and approvals remain separate from pending',async()=>{
   const groups={pending:['SUBMITTED','UNDER_REVIEW'],approved:['APPROVED'],settled:['SETTLED'],rejected:['REJECTED'],cancelled:['CANCELLED']};
   for(const [filter,allowed] of Object.entries(groups)){
    const page=await list('',filter,0,1);assert.equal(page.total,included.filter(r=>allowed.includes(r.status)).length);assert(page.rows.every(r=>allowed.includes(r.status)));
    const result=await list(oldest.folio,filter);assert.equal(result.total,allowed.includes('SETTLED')?1:0);
   }
   assert.equal((await list('','pending',0,50)).rows.some(r=>r.status==='APPROVED'),false);
  });
  await check('Requested and delivered amounts stay distinct; pending or missing payment values are never zero-filled',async()=>{
   const pending=(await list(secondPerson.folio)).rows[0];assert.equal(pending.requested_amount,123.45);assert.equal(pending.delivered_capital,null);assert.equal(pending.delivered_yield,null);assert.equal(pending.delivered_amount,null);
   const settled=(await list(proof.folio)).rows[0];assert.equal(settled.requested_amount,250);assert.equal(settled.delivered_capital,200);assert.equal(settled.delivered_yield,50);assert.equal(settled.delivered_amount,250);assert(settled.settled_at);
   const missing=(await list(missingComponent.folio)).rows[0];assert.equal(missing.delivered_capital,100);assert.equal(missing.delivered_yield,null);assert.equal(missing.delivered_amount,null);
   const historic=(await list(oldest.folio)).rows[0];assert.equal(historic.continue_saving,false);assert.equal(historic.delivered_amount,123.45);assert.equal(new Date(historic.submitted_at).toISOString(),'2000-01-01T00:00:00.000Z');assert.equal(new Date(historic.settled_at).toISOString(),'2000-01-02T12:00:00.000Z');
  });
  await check('DTO excludes metadata, actor IDs, supporting documents and unrelated private fields',async()=>{
   const expected=['id','participant_id','folio','saver_folio','name','request_type','status','requested_amount','delivered_capital','delivered_yield','delivered_amount','continue_saving','submitted_at','reviewed_at','settled_at'].sort();
   const data=await list();for(const row of data.rows)assert.deepEqual(Object.keys(row).sort(),expected);
   const serial=JSON.stringify(data);assert(!serial.includes('PRIVATE_SYNTHETIC_REASON'));assert(!serial.includes('NOT_FOR_HISTORY_DTO'));assert(!serial.includes(actor));
  });
  await check('Invalid status, offset, limit and oversized search fail before reading a page',async()=>{
   for(const args of [['','unknown',0,20],['',null,0,20],['','all',-1,20],['','all',null,20],['','all',0,0],['','all',0,51],['','all',0,null],['x'.repeat(201),'all',0,20]])await rejected(list(...args),'22023');
   assert.equal((await list('x'.repeat(200))).total,0);assert.equal((await list('','all',0,50)).rows.length,50);
  });
  await check('Repeated history reads succeed in read-only transactions and preserve all authority rows',async()=>{
   await as('authenticated',['savings.read'],async()=>{await db.exec('begin read only');try{await raw();await raw('','settled',500,20);}finally{await db.exec('rollback');}});
   assert.deepEqual(await sourceState(),before);
  });
  const installed=await scalar('select pg_get_functiondef($1::regprocedure) value',[signature]);
  const installedFunctionMd5=crypto.createHash('md5').update(installed).digest('hex');
  await check('Recovery refuses to remove a later changed definition',async()=>{
   assert(recovery.includes(installedFunctionMd5));
   const changed=installed.replace('SAVINGS_READ_DENIED','SAVINGS_HISTORY_SYNTHETIC_DRIFT');assert.notEqual(changed,installed);
   await db.exec(changed);
   try{await rejected(db.exec(recovery),'P0001');}finally{await db.exec('rollback');}
   assert.equal(await scalar('select pg_get_functiondef($1::regprocedure) value',[signature]),changed);
   assert.deepEqual(await sourceState(),before);await db.exec(installed);
  });
  await check('Exact-signature recovery removes only the new reader and preserves original sources/security',async()=>{
   await db.exec(recovery);assert.equal(await scalar('select to_regprocedure($1)::text value',[signature]),null);assert.deepEqual(await sourceState(),before);
   await db.exec(migration);assert.equal(await scalar('select pg_get_functiondef($1::regprocedure) value',[signature]),installed);assert.deepEqual(await sourceState(),before);
   assert.equal((await list()).total,included.length);
  });
  const evidence={status:'PASS',environment:'isolated PostgreSQL/WASM; synthetic fixtures only',checks,requestCount:included.length,
   migration:{path:migrationFile,sha256:hash(read(migrationFile))},recovery:{path:recoveryFile,sha256:hash(read(recoveryFile))},
   test:{path:'scripts/test-savings-withdrawal-history.js',sha256:hash(read('scripts/test-savings-withdrawal-history.js'))},
   existingNameHelper:{path:'supabase/migrations/20261001000300_savings_affiliate_names.sql',sha256:hash(helper)},
   settlementColumnContract:{path:settlementSourceFile,sourceSha256:hash(settlementSource),executedStatementSha256:hash(actualUpdate),scope:'Existing delivered-component assignment executed in synthetic table; no settlement command or financial calculation was changed.'},
   installedFunctionMd5,sourcesUnchangedSha256:hash(before),recoveryReapply:'PASS',productionWrites:0};
  const output=path.join(root,'docs/qa/evidence/savings-withdrawal-history/database.json');fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(evidence,null,2)+'\n');
  console.log(JSON.stringify({status:'PASS',checks:checks.length,requests:included.length,installedFunctionMd5,evidence:output}));
 }finally{await db.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
