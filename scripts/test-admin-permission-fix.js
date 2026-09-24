'use strict';
const assert=require('assert/strict'),fs=require('fs'),path=require('path');
const {createDb}=require('./admin-permission-test-db');
async function main(){
 const x=await createDb(),{db,q,scalar,auth,assign,owner,target,read}=x,checks=[];
 const test=async(name,fn)=>{await fn();checks.push(name);console.log('PASS '+name);};
 const member='00000000-0000-4000-8000-000000000003',other='00000000-0000-4000-8000-000000000004';
 const free='00000000-0000-4000-8000-000000000010',paid='00000000-0000-4000-8000-000000000011',paid2='00000000-0000-4000-8000-000000000012',plan='00000000-0000-4000-8000-000000000020';
 const forward=read('supabase/migrations/20260924000200_admin_screen_permission_boundaries.sql'),recovery=read('supabase/recovery/20260924000200_admin_screen_permission_boundaries_recovery.sql');
 const digest=()=>scalar("select md5(jsonb_agg(to_jsonb(a) order by id)::text) value from admin_assignments a");
 try{
  await auth(owner);await db.exec('reset role');
  for(const [id,email] of [[member,'company@example.invalid'],[other,'other@example.invalid']])await q('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())',[id,email]);
  for(const id of [free,paid,paid2])await q("insert into companies(id,display_name,sort_order,record_origin) values($1,'Synthetic company',1,'ADMIN_H009')",[id]);
  await q("insert into company_portal_plans(id,name,max_products,sort_order) values($1,'Synthetic plan',10,1)",[plan]);
  for(const id of [paid,paid2])await q("insert into company_portal_subscriptions(company_id,plan_id,status,billing_cycle,starts_on,ends_on) values($1,$2,'active','monthly',current_date-1,current_date+30)",[id,plan]);
  await q("insert into marketplace_company_memberships(auth_user_id,company_id,role) values($1,$2,'owner'),($3,$4,'editor'),($5,$2,'quotes')",[member,paid,other,paid2,target]);
  await assign(target,'target@example.invalid',['convenios']);
  await test('baseline reproduces unauthorized paid company write from Convenios',async()=>{
   await auth(target);await q("select save_company_ficha($1,'{\"description\":\"baseline breach\"}'::jsonb)",[paid]);
   assert.equal(await scalar('select description value from companies where id=$1',[paid]),'baseline breach');await db.exec('reset role');
  });
  const before=await digest();
  await test('installation preserves assignments and exact no-use recovery',async()=>{
   await db.exec(forward);assert.equal(await digest(),before);await db.exec(recovery);
   for(const name of ['module_visible','can_manage_company_ficha','enforce_company_ficha_action','enforce_company_ficha_asset_action']){
    const f=x.company.functions.find(f=>f.name===name);assert.equal(await scalar('select md5(pg_get_functiondef($1::regprocedure)) value',[f.signature]),f.hash);
   }await db.exec(forward);
  });
  await test('all four omitted modules become visible without granting new screens',async()=>{
   for(const key of ['login_history','votaciones','votaciones_nominal','inversion'])assert.equal(await scalar('select admin_support_private.module_visible($1,$2) value',[owner,key]),true,key);
   await auth(target);assert.equal(await scalar("select has_admin_module('companies_admin') value"),false);
  });
  await test('recovery refuses function ACL drift before use',async()=>{
   await db.exec('reset role');await db.exec('begin;grant execute on function public.enforce_admin_company_module_scope() to authenticated');
   await assert.rejects(()=>db.exec(recovery),/RECOVERY_BLOCKED_GUARD_SECURITY_DRIFT/);await db.exec('rollback');await auth(target);
  });
  await test('Convenios can edit unpaid ficha but cannot edit paid ficha or its benefits',async()=>{
   await q("select save_company_ficha($1,'{\"description\":\"free allowed\"}'::jsonb)",[free]);
   await assert.rejects(()=>q("select save_company_ficha($1,'{\"description\":\"must deny\"}'::jsonb)",[paid]),/DENIED/);
   await assert.rejects(()=>q("insert into company_benefits(company_id,label,record_origin) values($1,'Denied','ADMIN_SECTION_ROLLOUT')",[paid]),/DENIED/);
   await q("insert into company_benefits(company_id,label,record_origin) values($1,'Allowed','ADMIN_SECTION_ROLLOUT')",[free]);
   assert.equal(await scalar('select count(*)::int value from marketplace_company_memberships'),1,'only own independent company membership');
  });
  await test('independent Convenios responsibility preserves unpaid benefits and denies paid benefits',async()=>{
   await db.exec('reset role');
   await q("insert into admin_section_responsibilities(auth_user_id,section_key,action,granted_by_auth_user_id) values($1,'agreements','create',$2)",[other,owner]);
   await auth(other);
   assert.equal(await scalar('select is_module_admin() value'),false);
   assert.equal(await scalar("select has_section_action('agreements','create') value"),true);
   await q("insert into company_benefits(company_id,label,record_origin,enabled) values($1,'Independent allowed','ADMIN_SECTION_ROLLOUT',false)",[free]);
   await assert.rejects(()=>q("insert into company_benefits(company_id,label,record_origin,enabled) values($1,'Independent denied','ADMIN_SECTION_ROLLOUT',false)",[paid]),/COMPANY_MODULE_BOUNDARY_DENIED/);
  });
  await test('own company login context and permitted ficha update survive; other company write denied',async()=>{
   await auth(member);assert.deepEqual(await scalar('select get_current_company_access() value'),[{company_id:paid,role:'owner'}]);
   assert.equal(await scalar('select count(*)::int value from marketplace_company_memberships'),1);
   await q("select save_company_ficha($1,'{\"description\":\"own company\"}'::jsonb)",[paid]);
   await assert.rejects(()=>q("select save_company_ficha($1,'{\"description\":\"cross company\"}'::jsonb)",[paid2]),/DENIED/);
   assert.equal(await scalar("select has_admin_module('companies_admin') value"),false);
   await assert.rejects(()=>q("select save_admin_user_modules('other@example.invalid','total',array[]::text[],null)"),/DENIED/);
  });
  await test('Empresas administrator retains global ficha and membership management access',async()=>{
   await assign(target,'target@example.invalid',['companies_admin']);await auth(target);
   await q("select save_company_ficha($1,'{\"description\":\"global administrator\"}'::jsonb)",[paid2]);
   assert.equal(await scalar('select count(*)::int value from marketplace_company_memberships'),3);
   // Existing restrictive policy reserves benefit editing to Convenios/Sindicato.
   // Empresas keeps its ficha operations; this patch must not add benefit powers.
   await assert.rejects(()=>q("insert into company_benefits(company_id,label,record_origin) values($1,'Not granted','ADMIN_SECTION_ROLLOUT')",[paid2]),/row-level security/);
  });
  await test('revocation affects already-open session; company membership and accounts survive',async()=>{
   await auth(owner);await q('select revoke_admin_assignment($1)',[target]);await auth(target);
   await assert.rejects(()=>q("select save_company_ficha($1,'{\"description\":\"revoked\"}'::jsonb)",[paid2]),/DENIED/);
   assert.deepEqual(await scalar('select get_current_company_access() value'),[{company_id:paid,role:'quotes'}],'revoked administrator retains independent own-company login');
   assert.equal(await scalar("select is_marketplace_company_member($1,'quotes') value",[paid]),true);
   assert.equal(await scalar("select is_marketplace_company_member($1,'write') value",[paid]),false);
   await db.exec('reset role');assert.equal(await scalar('select count(*)::int value from auth.users'),4);
   assert.equal(await scalar('select count(*)::int value from marketplace_company_memberships'),3);
  });
  await test('used recovery refuses rollback without erasing history or data',async()=>{
   const audit=await scalar('select count(*)::int value from admin_audit_log');
   await assert.rejects(()=>db.exec(recovery),/RECOVERY_BLOCKED_DATA_OR_AUTHORIZATION_USE/);await db.exec('rollback');
   assert.equal(await scalar('select count(*)::int value from admin_audit_log'),audit);
   assert.equal(await scalar('select description value from companies where id=$1',[paid2]),'global administrator');
  });
  fs.writeFileSync(path.resolve(__dirname,'../docs/qa/evidence/screen-permission-fix-20260924/isolated.json'),JSON.stringify({status:'PASS',productionWrites:0,checks,limits:['No production business RPC invoked.','Storage upload and all portal business views require browser/global regression separately.','Recovery detects state changes; read-only use is not detectable.']},null,2)+'\n');
 }finally{await db.close();}
}
main().catch(e=>{console.error(e.stack);process.exitCode=1;});
