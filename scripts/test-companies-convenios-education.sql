-- All fixtures and authorizations live only in the caller's ROLLBACK transaction.
create function pg_temp.assert_true(v boolean, message text) returns void language plpgsql as $$begin if v is distinct from true then raise exception 'ASSERT:%',message;end if;end$$;
create function pg_temp.expect_denied(statement text) returns void language plpgsql as $$begin
 begin execute statement;exception when others then return;end;
 raise exception 'UNEXPECTED_ALLOWED:%',statement;
end$$;
select set_config('request.jwt.claim.sub',current_setting('test.co_admin'),true),set_config('request.jwt.claim.role','authenticated',true);
set local role authenticated;
select pg_temp.assert_true((select count(*)=3 from public.company_portal_plans where id::text like 'cc000000%'),'three authorized plans');
select pg_temp.assert_true(jsonb_array_length(public.list_public_convenios())=(select count(*) from public.companies where enabled and public.can_view_company(id))+(select count(*) from public.educational_resources where published and resource_kind='education'),'public projection completeness');
select set_config('test.co_a',public.save_company_ficha(null,'{"display_name":"QA PAID A","enabled":true,"sort_order":9901}')::text,true);
select set_config('test.co_b',public.save_company_ficha(null,'{"display_name":"QA PAID B","enabled":true,"sort_order":9902}')::text,true);
select set_config('test.co_free',public.save_agreement_ficha('{"company":{"display_name":"QA AGREEMENT","description":"ABOUT","enabled":true,"sort_order":9903},"profile":{"category_label":"Salud","address":"ADDRESS","description":"OFFER","conditions":"CONDITIONS","discount_percent":15,"featured":true},"benefits":[{"label":"BENEFIT","description":"DETAIL","enabled":true}]}')::text,true);
select pg_temp.assert_true((select row->>'description'='ABOUT' and row->>'address_raw'='ADDRESS' and row->>'agreement_description'='OFFER' and row->>'conditions'='CONDITIONS' and row->>'category_raw'='Salud' and jsonb_array_length(row->'benefits')=1 from jsonb_array_elements(public.list_public_convenios()) row where row->>'id'=current_setting('test.co_free')),'admin to public complete');
select pg_temp.expect_denied(format('select public.accredit_company_plan(%L,%L,%L,%L,false)',current_setting('test.co_a'),'cc000000-0000-4000-8000-000000000001','monthly','QA receipt'));
select public.accredit_company_plan(current_setting('test.co_a')::uuid,'cc000000-0000-4000-8000-000000000001','monthly','QA receipt',true);
select public.accredit_company_plan(current_setting('test.co_b')::uuid,'cc000000-0000-4000-8000-000000000002','monthly','QA receipt',true);
insert into public.marketplace_company_memberships(company_id,auth_user_id,role,enabled) values(current_setting('test.co_a')::uuid,current_setting('test.co_user_a')::uuid,'owner',true),(current_setting('test.co_b')::uuid,current_setting('test.co_user_b')::uuid,'owner',true);
insert into public.educational_resources(title,description,resource_kind,published,sort_order,provenance,public_details)
values('QA EDUCATION','ABOUT EDUCATION','education',true,9904,'ADMIN_PHASE2','{"offer":"EDUCATIONAL OFFER","address":"EDUCATIONAL ADDRESS","conditions":"EDUCATIONAL CONDITIONS","benefits":[{"label":"EDUCATIONAL BENEFIT"}],"services":[{"label":"COURSE"}]}');
select pg_temp.assert_true((select count(*)=1 from jsonb_array_elements(public.list_public_convenios()) row where row->>'display_name'='QA EDUCATION' and row->>'source_kind'='education' and row->>'category_raw'='Educación' and row->>'agreement_description'='EDUCATIONAL OFFER'),'education public category and content');
select pg_temp.assert_true(not exists(select 1 from jsonb_array_elements(public.list_public_convenios()) row where row->>'source_kind'='tutorial'),'tutorials preserved outside agreements');

-- An actual non-admin Auth principal A acts under authenticated grants/RLS.
select set_config('request.jwt.claim.sub',current_setting('test.co_user_a'),true);
select pg_temp.assert_true((select count(*)=1 from public.company_portal_plans),'member reads only own plan');
select pg_temp.assert_true((select count(*)=1 from public.marketplace_company_memberships where enabled),'membership isolation');
select public.save_company_ficha(current_setting('test.co_a')::uuid,'{"display_name":"QA A CHANGED","description":"PUBLIC PROFILE","public_details":{"history":"REAL HISTORY","branches":[{"nombre":"Branch","dir":"Address"}]}}');
select pg_temp.assert_true((select row->>'display_name'='QA A CHANGED' and row->>'description'='PUBLIC PROFILE' from jsonb_array_elements(public.list_public_convenios()) row where row->>'id'=current_setting('test.co_a')),'company changes visible publicly');
select pg_temp.expect_denied(format('select public.save_company_ficha(%L,%L)',current_setting('test.co_b'),'{"description":"CROSS"}'));
select pg_temp.expect_denied(format('select public.save_company_ficha(%L,%L)',current_setting('test.co_free'),'{"description":"FREE"}'));
select pg_temp.expect_denied(format('select public.save_company_ficha(%L,%L)',current_setting('test.co_a'),'{"enabled":false}'));
select pg_temp.expect_denied(format('select public.accredit_company_plan(%L,%L,%L,%L,true)',current_setting('test.co_a'),'cc000000-0000-4000-8000-000000000003','monthly','QA attempt'));
insert into public.marketplace_products(company_id,name,requires_quote,enabled,sort_order,record_origin)
select current_setting('test.co_a')::uuid,'QA PRODUCT '||i,true,true,i,'ADMIN_PHASE3' from generate_series(1,5)i;
select pg_temp.expect_denied(format('insert into public.marketplace_products(company_id,name,requires_quote,enabled,sort_order,record_origin) values(%L,%L,true,true,6,%L)',current_setting('test.co_a'),'OVER LIMIT','ADMIN_PHASE3'));
select pg_temp.expect_denied(format('insert into public.marketplace_products(company_id,name,requires_quote,enabled,sort_order,record_origin) values(%L,%L,true,true,1,%L)',current_setting('test.co_b'),'CROSS COMPANY','ADMIN_PHASE3'));
select pg_temp.expect_denied(format('insert into public.company_popup_proposals(company_id,title,body) values(%L,%L,%L)',current_setting('test.co_a'),'NO POPUP PLAN','BODY'));
select pg_temp.assert_true(public.get_company_activity(current_setting('test.co_a')::uuid)->>'history_allowed'='false','history plan gate');
select pg_temp.expect_denied(format('select public.get_company_activity(%L)',current_setting('test.co_b')));
select set_config('test.co_upload_path','convenios/'||current_setting('test.co_user_a')||'/'||current_setting('test.co_a')||'/qa.png',true);
select pg_temp.assert_true(public.can_upload_company_ficha(current_setting('test.co_upload_path')),'own upload path authorized');
select pg_temp.assert_true(not public.can_upload_company_ficha('convenios/'||current_setting('test.co_user_a')||'/'||current_setting('test.co_b')||'/qa.png'),'cross-company upload denied');
-- Storage metadata fixture exists only inside ROLLBACK, never an object advertised as real evidence.
insert into storage.objects(bucket_id,name,metadata) values('company-assets',current_setting('test.co_upload_path'),'{"size":16,"mimetype":"image/png"}');
select set_config('test.co_registered_asset',public.register_company_ficha_image(current_setting('test.co_a')::uuid,current_setting('test.co_upload_path'),repeat('a',64),'image/png',16)::text,true);
select pg_temp.assert_true((select owner_company_id=current_setting('test.co_a')::uuid and status='READY' from public.app_assets where id=current_setting('test.co_registered_asset')::uuid),'uploaded image registration tenant');

select set_config('request.jwt.claim.sub',current_setting('test.co_user_b'),true);
insert into public.company_popup_proposals(company_id,title,body) values(current_setting('test.co_b')::uuid,'PLAN POPUP','BODY');
select pg_temp.assert_true((select count(*)=1 from public.company_popup_proposals where company_id=current_setting('test.co_b')::uuid and status='pending'),'popup proposal pending admin approval');

select set_config('request.jwt.claim.sub',current_setting('test.co_admin'),true);
select public.accredit_company_plan(current_setting('test.co_b')::uuid,'cc000000-0000-4000-8000-000000000003','monthly','QA history plan',true);
select pg_temp.assert_true(public.get_company_activity(current_setting('test.co_b')::uuid)->>'history_allowed'='true','authorized history plan');
reset role;
select set_config('test.co_image',(select id::text from public.app_assets where status='READY' and mime_type like 'image/%' and owner_company_id is null order by id limit 1),true);
update public.app_assets set owner_company_id=current_setting('test.co_a')::uuid where id=current_setting('test.co_image')::uuid;
select set_config('request.jwt.claim.sub',current_setting('test.co_user_a'),true);
set local role authenticated;
select pg_temp.assert_true(jsonb_array_length(public.get_current_company_access())=1,'company-only login membership');
select public.attach_company_ficha_image(current_setting('test.co_a')::uuid,current_setting('test.co_image')::uuid,'logo');
select public.attach_company_ficha_image(current_setting('test.co_a')::uuid,current_setting('test.co_image')::uuid,'cover');
select public.attach_company_ficha_image(current_setting('test.co_a')::uuid,current_setting('test.co_image')::uuid,'gallery');
select pg_temp.assert_true((select row->>'logo_asset_id'=current_setting('test.co_image') and row->>'cover_asset_id'=current_setting('test.co_image') and jsonb_array_length(row->'gallery_asset_ids')=1 from jsonb_array_elements(public.list_public_convenios())row where row->>'id'=current_setting('test.co_a')),'legitimate company image projection');
select pg_temp.expect_denied(format('select public.attach_company_ficha_image(%L,%L,%L)',current_setting('test.co_b'),current_setting('test.co_image'),'cover'));
select set_config('request.jwt.claim.sub',current_setting('test.co_admin'),true);
update public.company_portal_subscriptions set status='expired' where company_id=current_setting('test.co_a')::uuid;
select pg_temp.assert_true(not exists(select 1 from jsonb_array_elements(public.list_public_convenios()) row where row->>'id'=current_setting('test.co_a')),'expired paid company not publicly advertised');
select set_config('request.jwt.claim.sub',current_setting('test.co_user_a'),true);
select pg_temp.assert_true(jsonb_array_length(public.get_current_company_access())=0,'expired company login denied');
select pg_temp.expect_denied(format('select public.save_company_ficha(%L,%L)',current_setting('test.co_a'),'{"description":"EXPIRED"}'));
reset role;
-- Granular owners: free agreements can be maintained without company-wide privileges.
select set_config('request.jwt.claim.sub',current_setting('test.co_admin'),true),set_config('request.jwt.claim.role','authenticated',true);
insert into public.admin_section_responsibilities(auth_user_id,section_key,action,granted_by_auth_user_id)
select current_setting('test.co_user_b')::uuid,'agreements',a,current_setting('test.co_admin')::uuid from unnest(array['read','create','update','publish','order','delete'])a;
select set_config('request.jwt.claim.sub',current_setting('test.co_user_b'),true);
set local role authenticated;
select pg_temp.assert_true(not public.has_admin_permission('companies.write'),'section owner is not global company admin');
select public.save_agreement_ficha(jsonb_build_object('id',current_setting('test.co_free'),'company',jsonb_build_object('display_name','QA AGREEMENT UPDATED','description','COMPLETE DESCRIPTION'),'profile',jsonb_build_object('category_label','Servicios','address','FREE ADDRESS','description','FREE OFFER','conditions','FREE CONDITIONS'),'benefits',jsonb_build_array(jsonb_build_object('label','FREE BENEFIT','description','FREE DETAIL'))));
select pg_temp.assert_true((select row->>'description'='COMPLETE DESCRIPTION' and row->>'conditions'='FREE CONDITIONS' and row->>'category_raw'='Servicios' from jsonb_array_elements(public.list_public_convenios())row where row->>'id'=current_setting('test.co_free')),'free section writer public projection');
insert into public.marketplace_products(company_id,name,requires_quote,enabled,sort_order,record_origin) values(current_setting('test.co_free')::uuid,'FREE OPTIONAL PRODUCT',true,true,1,'ADMIN_PHASE3');
select pg_temp.expect_denied(format('select public.save_agreement_ficha(%L)',jsonb_build_object('id',current_setting('test.co_a'),'company',jsonb_build_object('description','PAID CROSS'))::text));
update public.educational_resources set description='CROSS EDUCATION' where title='QA EDUCATION';
select pg_temp.assert_true((select description='ABOUT EDUCATION' from public.educational_resources where title='QA EDUCATION'),'agreement writer cannot edit education');
reset role;
-- Education-only writer keeps Tutoriales outside its boundary.
select set_config('request.jwt.claim.sub',current_setting('test.co_admin'),true);
insert into public.admin_section_responsibilities(auth_user_id,section_key,action,granted_by_auth_user_id)
select current_setting('test.co_user_a')::uuid,'education',a,current_setting('test.co_admin')::uuid from unnest(array['read','create','update','publish','order','assets'])a;
select set_config('request.jwt.claim.sub',current_setting('test.co_user_a'),true);
set local role authenticated;
update public.educational_resources set public_details='{"offer":"UPDATED EDUCATION","conditions":"REQUIREMENTS","services":[{"label":"EDUCATIONAL SERVICE"}]}' where title='QA EDUCATION';
select pg_temp.assert_true((select row->>'agreement_description'='UPDATED EDUCATION' and row->>'conditions'='REQUIREMENTS' from jsonb_array_elements(public.list_public_convenios())row where row->>'display_name'='QA EDUCATION'),'education owner public write');
select pg_temp.expect_denied('insert into public.educational_resources(title,resource_kind,sort_order,provenance) values(''CROSS TUTORIAL'',''tutorial'',9999,''ADMIN_PHASE2'')');
reset role;
select set_config('request.jwt.claim.sub','',true),set_config('request.jwt.claim.role','anon',true);
set local role anon;
select pg_temp.expect_denied(format('select public.save_company_ficha(%L,%L)',current_setting('test.co_free'),'{"description":"ANON"}'));
select pg_temp.assert_true(jsonb_typeof(public.list_public_convenios())='array','anonymous public projection only');
select pg_temp.expect_denied('select public.get_current_company_access()');
reset role;
