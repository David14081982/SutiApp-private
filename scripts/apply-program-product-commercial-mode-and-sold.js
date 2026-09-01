'use strict';
const assert=require('assert').strict,fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..'),id='20260831000700_program_product_commercial_mode_and_sold';
const migration=fs.readFileSync(path.join(root,'supabase/migrations/'+id+'.sql'),'utf8');
const recovery=fs.readFileSync(path.join(root,'supabase/recovery/'+id+'_recovery.sql'),'utf8');
const body=(text)=>text.replace(/^\s*begin;\s*/i,'').replace(/\s*commit;\s*$/i,'');
function env(){const out={};for(const raw of fs.readFileSync(path.join(root,'supabase.env'),'utf8').replace(/^\uFEFF/,'').split(/\r?\n/)){const line=raw.trim(),at=line.indexOf('=');if(at>0&&!line.startsWith('#'))out[line.slice(0,at).trim()]=line.slice(at+1).trim().replace(/^['"]|['"]$/g,'');}return out;}
async function sql(values,query){const ref=new URL(values.SUPABASE_URL).hostname.split('.')[0],response=await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`,{method:'POST',headers:{Authorization:'Bearer '+values.SUPABASE_ACCESS_TOKEN,'Content-Type':'application/json','User-Agent':'SutiApp-Program-Commercial-Mode/1.0'},body:JSON.stringify({query})});const data=await response.json().catch(()=>null);if(!response.ok)throw new Error('MANAGEMENT_SQL_'+response.status+':'+JSON.stringify(data).slice(0,1600));return data;}
const appliedChecks=`do $verify$ begin
  if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='program_catalog_items' and column_name='commercial_mode') then raise exception 'COMMERCIAL_MODE_MISSING'; end if;
  if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='program_catalog_items' and column_name='sold') then raise exception 'SOLD_MISSING'; end if;
  if (select count(*) from public.program_catalog_items)<>135 then raise exception 'ITEM_COUNT_CHANGED'; end if;
  if (select count(*) from public.program_catalog_items where commercial_mode='DIRECT_CONTACT')<>35 or (select count(*) from public.program_catalog_items where program_key='casa' and commercial_mode='DIRECT_CONTACT')<>35 then raise exception 'CASA_DIRECT_CLASSIFICATION_INVALID'; end if;
  if (select count(*) from public.program_catalog_items where commercial_mode='PAYROLL_QUOTE')<>20 or (select count(*) from public.program_catalog_items where commercial_mode='PAYROLL_FIXED')<>80 then raise exception 'MODE_COUNTS_INVALID'; end if;
  if exists(select 1 from public.program_catalog_items where sold or sold_at is not null or sold_by is not null) then raise exception 'SOLD_BACKFILL_INVALID'; end if;
  if has_column_privilege('authenticated','public.program_catalog_items','sold_by','select') then raise exception 'SOLD_BY_EXPOSED'; end if;
  if not has_column_privilege('authenticated','public.program_catalog_items','commercial_mode','select') or not has_column_privilege('authenticated','public.program_catalog_items','sold','select') then raise exception 'COMMERCIAL_COLUMNS_NOT_READABLE'; end if;
  if has_table_privilege('authenticated','public.program_catalog_items','insert') or has_table_privilege('authenticated','public.program_catalog_items','update') or has_table_privilege('authenticated','public.program_catalog_items','delete') then raise exception 'DIRECT_DML_EXPOSED'; end if;
  if not exists(select 1 from pg_trigger where tgrelid='public.program_requests'::regclass and tgname='program_requests_catalog_requestability' and not tgisinternal) then raise exception 'REQUEST_GUARD_MISSING'; end if;
end $verify$;`;
const recoveryChecks=`do $verify$ begin
  if exists(select 1 from information_schema.columns where table_schema='public' and table_name='program_catalog_items' and column_name in('commercial_mode','sold','sold_at','sold_by')) then raise exception 'RECOVERY_COLUMNS_REMAIN'; end if;
  if to_regprocedure('public.enforce_program_catalog_requestability()') is not null then raise exception 'RECOVERY_GUARD_REMAINS'; end if;
  if to_regprocedure('public.save_program_catalog_item(uuid,jsonb,jsonb)') is null or to_regprocedure('public.create_first_cirugias_program_catalog_item(jsonb,jsonb)') is null then raise exception 'RECOVERY_WRITER_LOST'; end if;
end $verify$;`;
const runtimeChecks=`do $runtime$
declare
  v_admin uuid;v_affiliate public.affiliates%rowtype;v_fixed public.program_catalog_items%rowtype;v_direct public.program_catalog_items%rowtype;
  v_payload jsonb;v_links jsonb;v_result jsonb;v_original_mode text;v_original_enabled boolean;
begin
  select a.auth_user_id into v_admin from public.admin_assignments a join public.admin_roles r on r.id=a.role_id
  join public.admin_role_permissions rp on rp.role_id=r.id and rp.permission='program_catalog.write'
  where a.enabled and r.enabled order by a.created_at limit 1;
  select * into v_affiliate from public.affiliates where auth_user_id is not null and nullif(btrim(numero_control),'') is not null order by created_at limit 1;
  select * into v_fixed from public.program_catalog_items where commercial_mode='PAYROLL_FIXED' and price_cash>0 and enabled order by program_key,sort_order limit 1;
  select * into v_direct from public.program_catalog_items where commercial_mode='DIRECT_CONTACT' and price_cash>0 and enabled order by sort_order limit 1;
  if v_admin is null or v_affiliate.id is null or v_fixed.id is null or v_direct.id is null then raise exception 'RUNTIME_FIXTURE_MISSING'; end if;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',v_admin,'role','authenticated')::text,true);
  v_original_mode:=v_fixed.commercial_mode;v_original_enabled:=v_fixed.enabled;
  select coalesce(jsonb_agg(jsonb_build_object('link_id',id) order by sort_order),'[]'::jsonb) into v_links
  from public.program_catalog_item_assets where item_id=v_fixed.id and enabled;
  v_payload:=jsonb_build_object('program_key',v_fixed.program_key,'name',v_fixed.name,'description',v_fixed.description,
    'category_raw',v_fixed.category_raw,'price_cash',v_fixed.price_cash,'requires_quote',v_fixed.requires_quote,
    'commercial_mode',v_fixed.commercial_mode,'sold',true,'enabled',v_fixed.enabled,'sort_order',v_fixed.sort_order);
  v_result:=public.save_program_catalog_item(v_fixed.id,v_payload,v_links);
  if not (v_result->>'sold')::boolean or v_result->>'commercial_mode'<>v_original_mode then raise exception 'SOLD_WRITER_TRANSITION_FAILED'; end if;
  v_payload:=v_payload||jsonb_build_object('sold',false,'enabled',false);
  v_result:=public.save_program_catalog_item(v_fixed.id,v_payload,v_links);
  if (v_result->>'sold')::boolean or (v_result->>'enabled')::boolean or v_result->>'commercial_mode'<>v_original_mode then raise exception 'UNSOLD_OR_INACTIVE_TRANSITION_FAILED'; end if;
  v_payload:=v_payload||jsonb_build_object('enabled',v_original_enabled);
  v_result:=public.save_program_catalog_item(v_fixed.id,v_payload,v_links);
  if (v_result->>'sold')::boolean or (v_result->>'enabled')::boolean<>v_original_enabled or v_result->>'commercial_mode'<>v_original_mode then raise exception 'ORIGINAL_MODE_NOT_RESTORED'; end if;
  update public.program_catalog_items set sold=true,sold_at=now(),sold_by=v_admin where id=v_fixed.id;
  begin
    insert into public.program_requests(id,folio,actor_real_auth_user_id,affiliate_id,numero_control,program_id,program_item_id,request_type,idempotency_key)
    values(extensions.gen_random_uuid(),'TX-SOLD-'||replace(extensions.gen_random_uuid()::text,'-',''),v_affiliate.auth_user_id,v_affiliate.id,v_affiliate.numero_control,v_fixed.program_key,v_fixed.id,'benefit',extensions.gen_random_uuid());
    raise exception 'SOLD_REQUEST_ALLOWED';
  exception when others then if sqlerrm<>'PROGRAM_PRODUCT_SOLD' then raise; end if; end;
  begin
    insert into public.program_requests(id,folio,actor_real_auth_user_id,affiliate_id,numero_control,program_id,program_item_id,request_type,idempotency_key)
    values(extensions.gen_random_uuid(),'TX-DIRECT-'||replace(extensions.gen_random_uuid()::text,'-',''),v_affiliate.auth_user_id,v_affiliate.id,v_affiliate.numero_control,v_direct.program_key,v_direct.id,'benefit',extensions.gen_random_uuid());
    raise exception 'DIRECT_CONTACT_REQUEST_ALLOWED';
  exception when others then if sqlerrm<>'PROGRAM_PRODUCT_DIRECT_CONTACT_ONLY' then raise; end if; end;
end $runtime$;`;
async function snapshot(values,applied){const columns=applied?"||'|'||commercial_mode||'|'||sold::text||'|'||coalesce(sold_at::text,'')||'|'||coalesce(sold_by::text,'')":'';return (await sql(values,`select
  (select count(*)::int from public.program_catalog_items) item_count,
  (select count(*)::int from public.program_catalog_items where program_key='casa') casa_count,
  (select count(*)::int from public.marketplace_products) marketplace_count,
  (select count(*)::int from public.program_requests) request_count,
  (select count(*)::int from public.program_catalog_items where price_cash is not null) priced_count,
  (select md5(string_agg(id::text||'|'||coalesce(price_cash::text,'')||'|'||requires_quote::text,';' order by id)) from public.program_catalog_items) price_quote_hash,
  (select md5(string_agg(id::text||'|'||program_key||'|'||name||'|'||enabled::text||'|'||sort_order::text${columns},';' order by id)) from public.program_catalog_items) catalog_hash,
  (select coalesce(md5(string_agg(item_id::text||'|'||coalesce(public_asset_id::text,'')||'|'||coalesce(private_asset_id::text,'')||'|'||role||'|'||sort_order::text||'|'||enabled::text,';' order by item_id,id)),md5('')) from public.program_catalog_item_assets) asset_hash`))[0];}
async function main(){const values=env();assert(values.SUPABASE_URL&&values.SUPABASE_ACCESS_TOKEN,'Supabase management configuration missing');const applied=(await sql(values,"select exists(select 1 from information_schema.columns where table_schema='public' and table_name='program_catalog_items' and column_name='commercial_mode') applied"))[0].applied===true;const before=await snapshot(values,applied);assert.equal(Number(before.item_count),135);assert.equal(Number(before.casa_count),35);assert.equal(Number(before.priced_count),65);
  if(process.argv.includes('--recovery-dry-run')){assert(applied,'MIGRATION_NOT_APPLIED');await sql(values,'begin;'+body(recovery)+recoveryChecks+body(migration)+appliedChecks+runtimeChecks+'rollback;');const after=await snapshot(values,true);assert.deepEqual(after,before,'recovery dry-run changed persistent state');console.log(JSON.stringify({status:'PASS',mode:'RECOVERY_DRY_RUN_APPLIED',migration:id,items:135,casaDirect:35,writerTransitions:true,serverDenials:true,persistentWrites:0}));return;}
  if(process.argv.includes('--apply')){if(!applied)await sql(values,migration);await sql(values,'begin;'+appliedChecks+runtimeChecks+'rollback;');const after=await snapshot(values,true);assert.equal(after.price_quote_hash,before.price_quote_hash,'price/requires_quote changed');assert.equal(after.asset_hash,before.asset_hash,'assets changed');assert.equal(Number(after.marketplace_count),Number(before.marketplace_count),'marketplace changed');assert.equal(Number(after.request_count),Number(before.request_count),'requests changed');console.log(JSON.stringify({status:'PASS',mode:applied?'VERIFY_APPLIED':'APPLIED',migration:id,items:135,priced:65,casaDirect:35,fixed:80,quote:20,sold:0,writerTransitions:true,serverDenials:true,priceQuoteHash:after.price_quote_hash,marketplaceTouched:0,casaClassified:35}));return;}
  assert(!applied,'MIGRATION_ALREADY_APPLIED_USE_VERIFY');await sql(values,'begin;'+body(migration)+appliedChecks+runtimeChecks+'rollback;');await sql(values,'begin;'+body(migration)+appliedChecks+body(recovery)+recoveryChecks+'rollback;');const after=await snapshot(values,false);assert.deepEqual(after,before,'forward/recovery dry-run changed persistent state');console.log(JSON.stringify({status:'PASS',mode:'DRY_RUN_FORWARD_RECOVERY',migration:id,items:135,casa:35,priced:65,writerTransitions:true,serverDenials:true,persistentWrites:0}));}
main().catch((error)=>{console.error(JSON.stringify({status:'FAIL',error:error.message}));process.exitCode=1;});
