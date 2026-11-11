'use strict';
// Synthetic integration suite. All services bind to loopback; no production credentials.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),workspace=process.env.SUTI_TEST_WORKSPACE||path.resolve(root,'../..');
const L=require(path.join(workspace,'scripts/document-lab/local.cjs'));
const setup=require(path.join(workspace,'scripts/document-lab/setup.cjs'));
const evidence=path.join(root,'docs/qa/evidence/employee-number-correction');
const forward=path.join(root,'supabase/migrations/prepared/employee-number-correction/20261111000200_employee_number_correction.sql');
const recovery=path.join(root,'supabase/recovery/20261111000200_employee_number_correction.sql');
const catalog=JSON.parse(fs.readFileSync(path.join(root,'scripts/fixtures/employee-number-correction-schema.json')));
const affected=['affiliate_control_reservation_guard','preview_admin_affiliate_control','change_admin_affiliate_control','find_admin_affiliate_duplicates','create_admin_affiliate'];
const baseline={functions:catalog.functions.filter(f=>affected.includes(f.proname))};
const report={startedAt:new Date().toISOString(),status:'RUNNING',engine:'PostgreSQL 18 and local Storage/S3',productionWrites:0,realRowsImported:0,before:[],after:[],limits:[]};
const actor=crypto.randomUUID(),ownerAuth=crypto.randomUUID(),newAuth=crypto.randomUUID(),reader=crypto.randomUUID(),old=crypto.randomUUID();
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
let s,db;
async function q(sql,args=[]){return(await db.query(sql,args)).rows;}
async function value(sql,args=[]){return(await q(sql,args))[0]?.v;}
async function as(id=actor,role='authenticated',connection=db){
 await connection.query('reset role');
 await connection.query("select set_config('request.jwt.claims',$1,false),set_config('request.jwt.claim.sub',$2,false),set_config('request.jwt.claim.role',$3,false)",[JSON.stringify({sub:id,role,session_id:'SYNTHETIC_EMPLOYEE_CORRECTION',email:'synthetic-'+id+'@example.invalid'}),id,role]);
 await connection.query('set role '+role);
}
async function admin(){await db.query('reset role');}
async function check(phase,name,fn){const detail=await fn();report[phase].push({name,status:'PASS',...(detail?{detail}: {})});console.log('PASS '+phase+' '+name);}
function input(number,name='Ángela Muñoz sintética'){return{numero_control:number,full_name:name,affiliate_status_raw:'Activo'};}
async function create(number,extra={},connection=db){return(await connection.query('select public.create_admin_affiliate($1::jsonb,$2) v',[JSON.stringify({...input(number),...extra}), ''])).rows[0].v;}
async function denied(fn,pattern){await assert.rejects(fn,pattern);}
async function fingerprint(){await admin();return value(`select jsonb_build_object('affiliate',(select md5(to_jsonb(a)::text) from affiliates a where id=$1),'documents',(select md5(coalesce(string_agg(to_jsonb(d)::text,'|' order by d.id),'')) from affiliate_documents d where affiliate_id=$1),'history',(select md5(coalesce(string_agg(to_jsonb(c)::text,'|' order by c.id),'')) from affiliate_control_changes c where affiliate_id=$1),'assets',(select md5(coalesce(string_agg(to_jsonb(a)::text,'|' order by a.id),'')) from private_assets a where owner_affiliate_id=$1)) v`,[old]);}
async function functionMeta(){await admin();return q(`select p.oid::regprocedure::text signature,pg_get_userbyid(p.proowner) owner,p.proacl::text acl,p.proconfig,p.prosecdef,p.provolatile,pg_get_functiondef(p.oid) definition from pg_proc p where p.oid=any($1::regprocedure[]) order by 1`,[baseline.functions.map(f=>f.signature)]);}
async function setupFixture(){
 await admin();
 // Current affected definitions captured by SELECT; the remaining schema is the existing schema-only lab snapshot.
 for(const f of catalog.functions)await db.query(f.definition);
 for(const id of [actor,ownerAuth,newAuth,reader])await q("insert into auth.users(id,email,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values($1,$2,now(),'{}','{}',now(),now())",[id,'synthetic-'+id+'@example.invalid']);
 const role=crypto.randomUUID(),readRole=crypto.randomUUID();
 await q("insert into admin_roles(id,code,name) values($1,'employee_correction_test','Synthetic employee correction'),($2,'employee_correction_read','Synthetic read only')",[role,readRole]);
 const permissions=['affiliates.read','affiliates.write','documents.read','documents.write','assets.read'];
 for(const permission of permissions)await q('insert into admin_role_permissions(role_id,permission) values($1,$2)',[role,permission]);
 await q("insert into admin_role_permissions(role_id,permission) values($1,'affiliates.read')",[readRole]);
 await q('insert into admin_assignments(id,auth_user_id,role_id,permissions) values($1,$2,$3,$4),($5,$6,$7,$8)',[crypto.randomUUID(),actor,role,permissions,crypto.randomUUID(),reader,readRole,['affiliates.read']]);
 await q("insert into affiliates(id,numero_control,full_name,affiliate_status_raw,auth_user_id,historical_email_raw,historical_email_normalized,auth_eligibility,record_origin) values($1,'14262','PERSONA ANTERIOR SINTETICA','Activo',$2,$3,$3,'eligible','ADMIN_AFFILIATES')",[old,ownerAuth,'synthetic-'+ownerAuth+'@example.invalid']);
 await q("insert into affiliate_control_changes(affiliate_id,actor_auth_user_id,old_control,new_control,reason,impact,client_action_id) values($1,$2,'8322','14262','','{}',$3)",[old,actor,crypto.randomUUID()]);
 const type=crypto.randomUUID();
 await q("insert into document_types(id,code,label,description,accepted_mime_types,file_upload_allowed,max_file_size_bytes,enabled,required_by_default,sort_order) values($1,'employee_test_document','Synthetic document','Synthetic only',array['application/pdf'],true,5242880,true,false,1)",[type]);
 if(!(await q("select 1 from storage.buckets where id='private-assets'")).length)await s.store.request('POST','/bucket',JSON.stringify({id:'private-assets',name:'private-assets',public:false}),{'Content-Type':'application/json'});
 // Five actual local objects and UUID references; no copied user documents.
 for(let i=0;i<5;i++){
  const docType=i===0?type:crypto.randomUUID();
  if(i>0)await q("insert into document_types(id,code,label,description,accepted_mime_types,file_upload_allowed,max_file_size_bytes,enabled,required_by_default,sort_order) values($1,$2,'Synthetic document','Synthetic only',array['application/pdf'],true,5242880,true,false,$3)",[docType,'employee_test_document_'+i,i+1]);
  const bytes=Buffer.from('%PDF-1.4\nSYNTHETIC-'+i+'\n%%EOF\n'),asset=crypto.randomUUID(),file='affiliate-documents/'+old+'/'+asset+'.pdf';
  await s.store.request('POST','/object/private-assets/'+file,bytes,{'Content-Type':'application/pdf'});
  await q("insert into private_assets(id,asset_key,asset_type,storage_bucket,storage_path,mime_type,file_size,content_sha256,owner_affiliate_id,status) values($1::uuid,'synthetic.'||($1::uuid)::text,'DOCUMENT','private-assets',$2,'application/pdf',$3,$4,$5,'READY')",[asset,file,bytes.length,hash(bytes).toUpperCase(),old]);
  await q("insert into affiliate_documents(affiliate_id,document_type_id,private_asset_id,status,created_by_auth_user_id) values($1,$2,$3,'PENDING_REVIEW',$4)",[old,docType,asset,actor]);
 }
 return{type};
}
async function concurrentCreate(number,isolation='READ COMMITTED'){
 assert(['READ COMMITTED','SERIALIZABLE'].includes(isolation));
 await admin();
 const first=L.connect(s.config),second=L.connect(s.config);await first.connect();await second.connect();
 try{
  await as(actor,'authenticated',first);await as(actor,'authenticated',second);
  const pid=(await second.query('select pg_backend_pid() pid')).rows[0].pid;
  await first.query('begin isolation level '+isolation);await second.query('begin isolation level '+isolation);
  await first.query('select count(*) from affiliates');await second.query('select count(*) from affiliates');
  const saved=await create(number,{},first);
  const pending=(async()=>{await create(number,{},second);await second.query('commit');return{unexpected:true};})().catch(e=>({code:e.code,message:e.message}));
  // Wait until the second writer is actually waiting on the shared number lock.
  for(let attempt=0;attempt<100;attempt++){
   const waiting=(await db.query('select wait_event_type from pg_stat_activity where pid=$1',[pid])).rows[0];
   if(waiting?.wait_event_type==='Lock')break;
   await new Promise(resolve=>setTimeout(resolve,20));
   if(attempt===99)throw Error('CONCURRENT_WRITER_DID_NOT_WAIT');
  }
  await first.query('commit');const result=await pending;assert(!result.unexpected);assert(result.code==='40001'||/CONTROL_(RESERVED|UNAVAILABLE)|DUPLICATE/.test(result.message));
  assert.equal(await value('select count(*)::int v from affiliates where numero_control=$1',[number]),1);
  return{isolation,winner:saved.profile?.id||saved.id,loserCode:result.code,loser:result.message};
 }finally{await first.query('rollback').catch(()=>{});await second.query('rollback').catch(()=>{});await first.end();await second.end();}
}
(async()=>{
 fs.mkdirSync(evidence,{recursive:true});
 try{
  s=await setup.start();db=s.db;assert.equal(s.config.host,'127.0.0.1');assert.equal(s.config.database,'document_lab');
  report.schema=s.schema;
  const fixture=await setupFixture(),original=await fingerprint(),beforeMeta=await functionMeta();
  const beforeSecurity=await q("select c.relname,c.relrowsecurity,c.relforcerowsecurity,c.relacl::text from pg_class c where c.oid=any(array['public.affiliates'::regclass,'public.affiliate_documents'::regclass,'public.private_assets'::regclass,'public.affiliate_control_changes'::regclass]) order by 1");
  await as();
  await check('before','No current8322, but real create RPC fails on historical reservation',async()=>{const matches=await value('select find_admin_affiliate_duplicates($1,null) v',[JSON.stringify(input('8322'))]);assert.equal(matches.length,0);await denied(()=>create('8322'),/AFFILIATE_CONTROL_RESERVED/);});
  await check('before','Padded current number escapes duplicate precheck',async()=>{const found=await value('select find_admin_affiliate_duplicates($1,null) v',[JSON.stringify(input(' 14262 '))]);assert.equal(found.length,0);});
  fs.writeFileSync(path.join(evidence,'database-before.json'),JSON.stringify({...report,status:'BASELINE_REPRODUCED'},null,2)+'\n');
  await admin();await db.query(fs.readFileSync(forward,'utf8'));
  await check('after','Migration leaves original identity, five documents, assets and history unchanged',async()=>assert.deepEqual(await fingerprint(),original));
  const afterMeta=await functionMeta();
  await check('after','Function signatures, owners, ACL, security and search_path unchanged',async()=>{const omit=x=>x.map(({definition,...m})=>m);assert.deepEqual(omit(afterMeta),omit(beforeMeta));});
  await check('after','RLS and table grants unchanged',async()=>assert.deepEqual(await q("select c.relname,c.relrowsecurity,c.relforcerowsecurity,c.relacl::text from pg_class c where c.oid=any(array['public.affiliates'::regclass,'public.affiliate_documents'::regclass,'public.private_assets'::regclass,'public.affiliate_control_changes'::regclass]) order by 1"),beforeSecurity));
  await as();let newPerson;
  await check('after','Basic creation reuses8322 with new UUID and empty independent documents',async()=>{newPerson=await create('8322');assert(newPerson.profile?.id);assert.notEqual(newPerson.profile.id,old);assert.equal(newPerson.profile.numero_control,'8322');assert.equal(newPerson.documents.length,0);});
  await check('after','Padded number precheck matches canonical current holder',async()=>{const found=await value('select find_admin_affiliate_duplicates($1,null) v',[JSON.stringify(input(' 8322 '))]);assert(found.some(x=>x.id===newPerson.profile.id&&(x.matches||[]).includes('numero_control')));await denied(()=>create(' 8322 '),/DUPLICATE|CONTROL_(RESERVED|UNAVAILABLE)/);});
  await check('after','Existing profile edit retains UUID and current employee number',async()=>{const edited=await value('select update_admin_affiliate($1,$2,$3,$4) v',[newPerson.profile.id,newPerson.profile.updated_at,JSON.stringify({full_name:'Persona nueva sintética editada'}),'']);assert.equal(edited.profile.id,newPerson.profile.id);assert.equal(edited.profile.numero_control,'8322');assert.equal(edited.profile.full_name,'Persona nueva sintética editada');newPerson=edited;});
  await check('after','Leading zeroes and accented names preserved;80 accepted81 rejected',async()=>{const zero=await create(' 0007 ');assert.equal(zero.profile.numero_control,'0007');assert.equal(zero.profile.full_name,'Ángela Muñoz sintética');assert.equal((await create('N'.repeat(80))).profile.numero_control.length,80);await denied(()=>create('N'.repeat(81)),/CONTROL/);await denied(()=>create('  '),/CONTROL/);});
  await check('after','Existing number and archived current assignment rejected',async()=>{await denied(()=>create('14262'),/DUPLICATE|CONTROL_(RESERVED|UNAVAILABLE)/);const archived=await create('ARCHIVED-TEST');await value('select archive_admin_affiliate($1,$2,$3) v',[archived.profile.id,archived.profile.updated_at,'']);await denied(()=>create('ARCHIVED-TEST'),/DUPLICATE|CONTROL_(RESERVED|UNAVAILABLE)|ARCHIVED/);});
  await check('after','Admin search resolves two independent identities by current number',async()=>{for(const number of['14262','8322']){const result=await value('select list_admin_affiliates($1) v',[number]);assert.equal(result.items.length,1);assert.equal(result.items[0].numero_control,number);assert.equal(result.items[0].id,number==='14262'?old:newPerson.profile.id);}});
  await check('after','Correction/reuse is transactional and existing history remains immutable',async()=>{const other=await create('TYPO-SYNTHETIC');let preview=await value('select preview_admin_affiliate_control($1,$2) v',[other.profile.id,'CORRECT-SYNTHETIC']);assert.equal(preview.blockers.length,0);const key=crypto.randomUUID();const args=[other.profile.id,preview.new_control,preview.expected_updated_at,preview.fingerprint,'',key];const changed=await value('select change_admin_affiliate_control($1,$2,$3,$4,$5,$6) v',args);assert.equal(changed.change.new_control,'CORRECT-SYNTHETIC');assert.equal((await value('select change_admin_affiliate_control($1,$2,$3,$4,$5,$6) v',args)).replayed,true);const next=await create('TYPO-SYNTHETIC');assert.notEqual(next.profile.id,other.profile.id);await admin();await denied(()=>q("update affiliate_control_changes set reason='overwrite'"),/IMMUTABLE/);await as();});
  await check('after','Read-only admin, ordinary user and anonymous cannot create',async()=>{for(const id of[reader,ownerAuth]){await as(id);await denied(()=>create('DENIED-'+id),/DENIED|permission denied/);}await as(reader,'anon');await denied(()=>create('DENIED-ANON'),/permission denied|DENIED/);await as();});
  await check('after','RFC and CURP duplicate protection remains enforced',async()=>{await create('IDENTITY-SYNTHETIC',{rfc_raw:'SINT900101ABC',curp_raw:'SINT900101HDFXXX09'});for(const field of['rfc_raw','curp_raw']){const fields=field==='rfc_raw'?{rfc_raw:' sint900101abc '}:{curp_raw:' sint900101hdfxxx09 '};const found=await value('select find_admin_affiliate_duplicates($1,null) v',[JSON.stringify({...input('IDENTITY-OTHER'),...fields})]);assert(found.some(x=>x.matches.includes(field==='rfc_raw'?'rfc':'curp')));await denied(()=>create('IDENTITY-OTHER',fields),/DUPLICATE/);}});
  await check('after','Padded preview/change/retry agree and permit a released number for another UUID',async()=>{const target=await create('SECOND-TYPO');const preview=await value('select preview_admin_affiliate_control($1,$2) v',[target.profile.id,' TYPO-SYNTHETIC ']);assert(preview.blockers.length>0);const free=await value('select preview_admin_affiliate_control($1,$2) v',[target.profile.id,' PADDED-CORRECT ']);assert.equal(free.new_control,'PADDED-CORRECT');assert.equal(free.blockers.length,0);const args=[target.profile.id,' PADDED-CORRECT ',free.expected_updated_at,free.fingerprint,'',crypto.randomUUID()];await value('select change_admin_affiliate_control($1,$2,$3,$4,$5,$6) v',args);args[1]='PADDED-CORRECT';assert.equal((await value('select change_admin_affiliate_control($1,$2,$3,$4,$5,$6) v',args)).replayed,true);const third=await create('THIRD-TYPO');const released=await value('select preview_admin_affiliate_control($1,$2) v',[third.profile.id,' SECOND-TYPO ']);assert.equal(released.blockers.length,0);await value('select change_admin_affiliate_control($1,$2,$3,$4,$5,$6) v',[third.profile.id,' SECOND-TYPO ',released.expected_updated_at,released.fingerprint,'',crypto.randomUUID()]);assert.notEqual(third.profile.id,target.profile.id);});
  await check('after','Two concurrent creations cannot claim the same current number',async()=>concurrentCreate('CONCURRENT-SYNTHETIC'));
  await check('after','REPEATABLE READ refuses stale-snapshot creation without persisting a row',async()=>{await as();await q('begin isolation level repeatable read');await q('select count(*) from affiliates');try{await assert.rejects(()=>create('RR-SYNTHETIC'),e=>e.code==='40001'&&e.message==='AFFILIATE_CONTROL_RETRY_REQUIRED');}finally{await q('rollback');}await admin();assert.equal(await value("select count(*)::int v from affiliates where numero_control='RR-SYNTHETIC'"),0);});
  await check('after','SERIALIZABLE concurrent snapshots commit only one assignment',async()=>concurrentCreate('SERIALIZABLE-SYNTHETIC','SERIALIZABLE'));
  await check('after','Original14262 synthetic record and five docs remain unchanged after reuse',async()=>assert.deepEqual(await fingerprint(),original));
  report.documentFixture=await require('./employee-number-document-checks.cjs')({s,db,actor,ownerAuth,newAuth,old,newPerson,fixture,as,admin,q,value,check,hash});
  report.limits.push('Local schema-only snapshot plus exact captured definitions for the five affected functions; no live account operation or production upload.',...report.documentFixture.limitations);
  await admin();await db.query(fs.readFileSync(recovery,'utf8'));
  await check('after','Recovery restores exact original functions without deleting any identities or evidence',async()=>{assert.deepEqual(await functionMeta(),beforeMeta);assert.deepEqual(await fingerprint(),original);assert.equal(await value('select count(*)::int v from affiliates where numero_control=$1',['8322']),1);});
  await as();await check('after','Restored historical guard rejects another reuse without deleting the prior new person',async()=>{const other=await create('RECOVERY-OLD');const preview=await value('select preview_admin_affiliate_control($1,$2) v',[other.profile.id,'RECOVERY-NEW']);await value('select change_admin_affiliate_control($1,$2,$3,$4,$5,$6) v',[other.profile.id,preview.new_control,preview.expected_updated_at,preview.fingerprint,'',crypto.randomUUID()]);await denied(()=>create('RECOVERY-OLD'),/RESERVED/);});
  report.status='PASS';
 }catch(e){report.status='FAIL';report.error={code:e.code||null,message:e.message,stack:e.stack};console.error(e.stack);process.exitCode=1;}
 finally{if(s)try{await s.stop();report.localServicesStopped=true;}catch(e){report.stopError=e.message;process.exitCode=1;}report.completedAt=new Date().toISOString();fs.writeFileSync(path.join(evidence,'database.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({status:report.status,before:report.before.length,after:report.after.length,error:report.error?.message,productionWrites:0}));}
})();
