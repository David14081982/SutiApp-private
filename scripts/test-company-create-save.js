'use strict';
// Disposable PostgreSQL; no network or production writes. Auth helpers are isolated fixtures.
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {PGlite}=require('../.tmp/savings-loan-eligibility/node_modules/@electric-sql/pglite');
const root=path.resolve(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8');
async function main(){
 const db=new PGlite(),checks=[];
 try{
  await db.exec(`create role authenticated;create schema auth;create schema extensions;
   create function extensions.gen_random_uuid() returns uuid language sql as $$select gen_random_uuid()$$;
   create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
   create function public.has_admin_permission(text) returns boolean language sql as $$select coalesce(current_setting('test.admin',true),'false')='true'$$;
   create function public.has_section_action(text,text) returns boolean language sql as $$select false$$;
   create function public.company_is_paid(uuid) returns boolean language sql as $$select false$$;
   create function public.can_manage_company_ficha(uuid,text) returns boolean language sql as $$select auth.uid() is not null and public.has_admin_permission('companies.write')$$;
   create table app_assets(id uuid primary key,status text,mime_type text,owner_company_id uuid);
   grant usage on schema public,auth to authenticated;`);
  const metadata=JSON.parse(read('docs/qa/evidence/screen-permission-fix-20260924/production-metadata.json'));
  for(const table of ['companies','company_assets']){
   const cols=metadata.columns.filter(c=>c.table_name===table).map(c=>`"${c.name}" ${c.type}${c.default_expr?' default '+c.default_expr:''}${c.not_null?' not null':''}`);
   await db.exec(`create table ${table}(${cols.join(',')})`);
   for(const c of metadata.constraints.filter(c=>c.table_name===table))await db.exec(`alter table ${table} add constraint ${c.name} ${c.definition}`);
  }
  const sql=read('supabase/migrations/20260908000900_companies_convenios_education.sql');
  for(const fn of ['save_company_ficha','attach_company_ficha_image']){
   const definition=sql.match(new RegExp('create function public\\.'+fn+'\\([\\s\\S]*?end \\$\\$;'))?.[0];assert(definition,fn);
   await db.exec(definition);
  }
  await db.exec(`alter table companies enable row level security;alter table companies force row level security;
   create policy admin_companies on companies for all to authenticated using(has_admin_permission('companies.write')) with check(has_admin_permission('companies.write'));
   grant select on companies to authenticated;
   grant insert(display_name,description,logo_asset_id,sort_order,enabled,record_origin),update(display_name,description,logo_asset_id,sort_order,enabled,public_details) on companies to authenticated;
   select set_config('test.uid','00000000-0000-4000-8000-000000000001',false),set_config('test.admin','true',false);
   insert into app_assets values('00000000-0000-4000-8000-000000000002','READY','image/png',null);
   set role authenticated;`);
  await assert.rejects(db.query("insert into companies(display_name,category_raw,email_raw,sort_order,record_origin) values('QA','Servicios','qa@example.invalid',1,'ADMIN_H009')"),e=>e.code==='42501');checks.push('original contact/category insert reproduces 42501');
  const fields={display_name:'QA isolated',description:'Profile',category_raw:'Servicios',phone_raw:'000',email_raw:'qa@example.invalid',address_raw:'QA',whatsapp_raw:'000',website_url:'https://example.invalid',logo_asset_id:'00000000-0000-4000-8000-000000000002',sort_order:2,enabled:true};
  const id=(await db.query('select save_company_ficha(null,$1::jsonb) id',[JSON.stringify(fields)])).rows[0].id;
  let row=(await db.query('select * from companies where id=$1',[id])).rows[0];for(const [k,v]of Object.entries(fields))assert.equal(row[k],v);assert.equal(row.record_origin,'ADMIN_H009');assert.equal(row.source_sheet,null);checks.push('existing RPC saves full profile without fabricated provenance');
  await db.query("select attach_company_ficha_image($1,$2,'cover')",[id,fields.logo_asset_id]);
  await db.query("select attach_company_ficha_image($1,$2,'cover')",[id,fields.logo_asset_id]);
  await db.query('select save_company_ficha($1,$2::jsonb)',[id,JSON.stringify({email_raw:'updated@example.invalid'})]);
  row=(await db.query('select * from companies where id=$1',[id])).rows[0];assert.equal(row.email_raw,'updated@example.invalid');assert.equal(row.sort_order,2);checks.push('edit and cover retry preserve identity and order');
  await db.query("select set_config('test.admin','false',false)");
  await assert.rejects(db.query('select save_company_ficha(null,$1::jsonb)',[JSON.stringify(fields)]),/COMPANY_CREATE_DENIED/);
  await assert.rejects(db.query('select save_company_ficha($1,$2::jsonb)',[id,JSON.stringify({description:'forbidden'})]),/COMPANY_DENIED/);
  await assert.rejects(db.query("select attach_company_ficha_image($1,$2,'cover')",[id,fields.logo_asset_id]),/COMPANY_ASSET_DENIED/);checks.push('RPC rejects caller without company permission');
  await db.exec('reset role');assert.equal((await db.query('select count(*)::int n from companies')).rows[0].n,1);assert.equal((await db.query('select count(*)::int n from company_assets')).rows[0].n,1);
  const result={status:'PASS',environment:'ISOLATED_PGLITE',productionWrites:0,checks,limitation:'Auth permission helpers are fixtures; production RLS and grants are unchanged, not certified by this test.'};
  fs.mkdirSync(path.join(root,'docs/qa/evidence/company-create-save'),{recursive:true});fs.writeFileSync(path.join(root,'docs/qa/evidence/company-create-save/database.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
 }finally{await db.close();}
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
