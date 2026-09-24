'use strict';
const assert=require('assert/strict'),fs=require('fs'),path=require('path');
const {createDb}=require('./admin-permission-test-db');
const node=(id,type,extra={})=>({id,type,label:'Synthetic '+id,visible:true,parentId:null,order:10,audience:{mode:'all'},...extra});
async function main(){
 const x=await createDb(),{db,q,scalar,auth,assign,owner,target,read}=x,checks=[];
 const test=async(name,fn)=>{await fn();checks.push(name);console.log('PASS '+name);};
 const forward=read('supabase/migrations/20260924000300_app_editorial_panels.sql'),recovery=read('supabase/recovery/20260924000300_app_editorial_panels_recovery.sql');
 const get=()=>scalar("select get_app_editorial('home',true) value");
 const save=(state,nodes)=>scalar("select save_app_editorial('home',$1,$2) value",[state.version,JSON.stringify(nodes)]);
 try{
  await test('additive installation and no-use recovery preserve original Home order',async()=>{
   await db.exec(forward);await auth(owner);assert.deepEqual((await get()).nodes.map(n=>n.id),['banner_convenio','ecosistema','comite','noticias']);
   await db.exec('reset role');await db.exec(recovery);await db.exec(forward);
  });
  await test('no-use recovery rejects schema and function ACL drift atomically',async()=>{
   await db.exec('begin;alter table app_editorial_screens add column unexpected text');
   await assert.rejects(()=>db.exec(recovery),/RECOVERY_BLOCKED_EDITORIAL_USE|RECOVERY_BLOCKED_EDITORIAL_SCHEMA_DRIFT/);await db.exec('rollback');
   await db.exec('begin;grant execute on function public.validate_editorial_nodes(text,jsonb) to authenticated');
   await assert.rejects(()=>db.exec(recovery),/RECOVERY_BLOCKED_EDITORIAL_FUNCTION_DRIFT/);await db.exec('rollback');
   assert.equal(await scalar('select count(*)::int value from app_editorial_screens'),20);
  });
  await test('Secciones edits real nodes without gaining menu/form writers',async()=>{
   await assign(target,'target@example.invalid',['secciones']);await auth(target);let s=await get();
   s=await save(s,[...s.nodes,node('intro','section',{text:'Real content'})]);
   await assert.rejects(()=>save(s,[...s.nodes,node('link','menu',{target:'home'})]),/EDITORIAL_MODULE_DENIED/);
   assert.equal(await scalar("select has_admin_permission('content.write') value"),false);
  });
  await test('editor without catalog administration can select only real enabled audience codes',async()=>{
   await db.exec('reset role');await q("insert into segmentation_catalog_entries(id,catalog_type,code,label) values(gen_random_uuid(),'union','SYNTHETIC_UNION','Synthetic union')");
   await auth(target);assert.equal((await scalar('select list_app_editorial_segments() value'))[0].code,'SYNTHETIC_UNION');
   let s=await get();s=await save(s,[...s.nodes,node('segmented','component',{audience:{mode:'segment',union_codes:['SYNTHETIC_UNION']}})]);
   await assert.rejects(()=>save(s,s.nodes.map(n=>n.id==='segmented'?{...n,audience:{mode:'segment',union_codes:['INVENTED']}}:n)),/EDITORIAL_SEGMENT_UNKNOWN/);
  });
  await test('Menús saves navigation; arbitrary routes and cross-type changes denied',async()=>{
   await assign(target,'target@example.invalid',['menus']);await auth(target);let s=await get();
   s=await save(s,[...s.nodes,node('link','menu',{target:'documentos'})]);
   await assert.rejects(()=>save(s,s.nodes.map(n=>n.id==='link'?{...n,target:'admin'}:n)),/EDITORIAL_TARGET_INVALID/);
   await assert.rejects(()=>save(s,s.nodes.map(n=>n.id==='link'?{...n,type:'section'}:n)),/EDITORIAL_MODULE_DENIED/);
  });
  await test('Formularios persists fields and optimistic version conflict is enforced',async()=>{
   await assign(target,'target@example.invalid',['formularios']);await auth(target);let s=await get();
   const f=node('survey','form',{fields:[{id:'email',label:'Correo',type:'email',required:true},{id:'choice',label:'Opción',type:'select',required:true,options:['A','B']}]});
   await save(s,[...s.nodes,f]);await assert.rejects(()=>save(s,s.nodes),/EDITORIAL_VERSION_CONFLICT/);
  });
  const user='00000000-0000-4000-8000-000000000005',other='00000000-0000-4000-8000-000000000006';
  await db.exec('reset role');for(const id of [user,other])await q("insert into auth.users(id,email,email_confirmed_at) values($1::uuid,$1::uuid::text||'@example.invalid',now())",[id]);
  let version;const submitId='00000000-0000-4000-8000-000000000099',answers={email:'isolated@example.invalid',choice:'A'};
  await test('real form validates required fields, choice and email before storing one response',async()=>{
   await auth(user);const s=await scalar("select get_app_editorial('home',false) value");version=s.version;
   const submit=a=>scalar("select submit_app_editorial_form($1,'home',$2,'survey',$3) value",[submitId,version,JSON.stringify(a)]);
   await assert.rejects(()=>submit({}),/EDITORIAL_REQUIRED/);
   await assert.rejects(()=>submit({email:'bad',choice:'A'}),/EDITORIAL_EMAIL_INVALID/);
   await assert.rejects(()=>submit({...answers,choice:'C'}),/EDITORIAL_OPTION_INVALID/);
   assert.equal(await submit(answers),submitId);assert.equal(await submit(answers),submitId);
   assert.equal(await scalar('select count(*)::int value from app_editorial_submissions'),1);
   await assert.rejects(()=>q("insert into app_editorial_submissions(id,screen_id,version,node_id,auth_user_id,answers) values(gen_random_uuid(),'home',$1,'survey',$2,'{}')",[version,user]),/permission denied/);
  });
  await test('ordinary and other-module users cannot read another user response or edit configuration',async()=>{
   await auth(other);assert.equal(await scalar('select count(*)::int value from app_editorial_submissions'),0);
   await assert.rejects(get,/EDITORIAL_ADMIN_DENIED/);
   await assign(target,'target@example.invalid',['menus']);await auth(target);assert.equal(await scalar('select count(*)::int value from app_editorial_submissions'),0);
   await assign(target,'target@example.invalid',['formularios']);await auth(target);assert.equal(await scalar('select count(*)::int value from app_editorial_submissions'),1);
  });
  await test('archiving a form retains response and exact submitted schema, then rejects new submissions',async()=>{
   let s=await get();s=await save(s,s.nodes.filter(n=>n.id!=='survey'));
   assert.equal(await scalar("select count(*)::int value from app_editorial_revisions where version=$1 and nodes @> '[{\"id\":\"survey\"}]'",[version]),1);
   await auth(user);assert.equal(await scalar('select count(*)::int value from app_editorial_submissions'),1);
   await assert.rejects(()=>q("select submit_app_editorial_form(gen_random_uuid(),'home',$1,'survey',$2)",[s.version,JSON.stringify(answers)]),/EDITORIAL_FORM_DENIED/);
  });
  await test('anonymous audience filters hidden nodes and parent visibility; builtin cannot be removed',async()=>{
   await auth(owner);let s=await get();s=await save(s,[...s.nodes,node('private','section',{visible:false}),node('nested','component',{parentId:'private',text:'Must not leak'})]);
   await assert.rejects(()=>save(s,s.nodes.filter(n=>n.id!=='comite')),/EDITORIAL_BUILTIN_PRESERVED/);
   await auth(null,'anon');const live=await scalar("select get_app_editorial('home',false) value");assert(!live.nodes.some(n=>n.id==='private'||n.id==='nested'));
  });
  await test('revoked already-open admin session loses editor writers and form responses',async()=>{
   await auth(owner);await q('select revoke_admin_assignment($1)',[target]);await auth(target);await assert.rejects(get,/EDITORIAL_ADMIN_DENIED/);assert.equal(await scalar('select count(*)::int value from app_editorial_submissions'),0);
  });
  await test('recovery after use refuses to remove versions and submissions',async()=>{
   await db.exec('reset role');await assert.rejects(()=>db.exec(recovery),/RECOVERY_BLOCKED_EDITORIAL_USE/);await db.exec('rollback');assert.equal(await scalar('select count(*)::int value from app_editorial_submissions'),1);
  });
  fs.writeFileSync(path.resolve(__dirname,'../docs/qa/evidence/screen-permission-fix-20260924/editorial-isolated.json'),JSON.stringify({status:'PASS',productionWrites:0,checks},null,2)+'\n');
 }finally{await db.close();}
}
main().catch(e=>{console.error(e.stack);process.exitCode=1;});
