reset role;
select set_config('request.jwt.claim.sub',current_setting('test.co_admin'),true),set_config('request.jwt.claim.role','authenticated',true);
set local role authenticated;
select public.accredit_company_plan(current_setting('test.co_a')::uuid,'cc000000-0000-4000-8000-000000000003','monthly','QA completion',true);
select pg_temp.assert_true(jsonb_typeof(public.list_company_commercial_requests())='array','admin commercial reader works without table grant');
reset role;
-- Clone a valid request only inside this rolled-back transaction; no sequence or real request is altered.
insert into public.program_requests select (jsonb_populate_record(null::public.program_requests,to_jsonb(r)||jsonb_build_object(
 'id','ca000000-0000-4000-8000-000000000001','folio','QA-COMPANY-READER','idempotency_key','ca000000-0000-4000-8000-000000000001',
 'company_id',current_setting('test.co_a'),'program_id','marketplace','request_type','quote','status','submitted',
 'product_id',(select id from public.marketplace_products where company_id=current_setting('test.co_a')::uuid limit 1),
 'program_item_id',null,'membership_offering_id',null,'document_requirements_snapshot',null,'financial_processing_status',null,'legacy_reference',null,
 'requested_amount',null,'requested_term',null,'requested_term_semantics',null,'financial_profile_snapshot',null,
 'financial_submission_snapshot',null,'financial_approval_snapshot',null,'financial_approved_at',null,'financial_approved_by',null))).*
 from public.program_requests r limit 1;
select set_config('request.jwt.claim.sub',current_setting('test.co_user_a'),true);
set local role authenticated;
select pg_temp.assert_true((select count(*)=1 from jsonb_array_elements(public.list_company_commercial_requests())r where r->>'id'='ca000000-0000-4000-8000-000000000001'),'tenant sees own request');
select pg_temp.assert_true(not exists(select 1 from jsonb_array_elements(public.list_company_commercial_requests())r where r ?| array['signature_data','financial_profile_snapshot','applicant_profile_snapshot','actor_real_auth_user_id']),'reader excludes private and financial snapshots');
select set_config('request.jwt.claim.sub',current_setting('test.co_user_b'),true);
select pg_temp.assert_true(not exists(select 1 from jsonb_array_elements(public.list_company_commercial_requests())r where r->>'id'='ca000000-0000-4000-8000-000000000001'),'cross tenant read denied');
reset role;
update public.company_portal_subscriptions set starts_on=current_date-31,ends_on=current_date-1 where company_id=current_setting('test.co_a')::uuid;
select set_config('request.jwt.claim.sub',current_setting('test.co_user_a'),true);
set local role authenticated;
select pg_temp.assert_true(jsonb_array_length(public.list_company_commercial_requests())=0,'expired tenant read denied');
reset role;
-- Update-only admin cannot approve a promotion through the API.
insert into public.admin_section_responsibilities(auth_user_id,section_key,action,granted_by_auth_user_id)
 values(current_setting('test.co_user_a')::uuid,'marketplace','update',current_setting('test.co_admin')::uuid);
select set_config('request.jwt.claim.sub',current_setting('test.co_admin'),true);
set local role authenticated;
insert into public.marketplace_promotions(id,company_id,title,enabled,approval_status,sort_order,record_origin)values('ca000000-0000-4000-8000-000000000002',current_setting('test.co_b')::uuid,'QA PUBLICATION',true,'pending',9900,'ADMIN_PHASE3');
select set_config('request.jwt.claim.sub',current_setting('test.co_user_a'),true);
select pg_temp.expect_denied('update public.marketplace_promotions set approval_status=''approved'' where id=''ca000000-0000-4000-8000-000000000002''');
reset role;
insert into public.admin_section_responsibilities(auth_user_id,section_key,action,granted_by_auth_user_id)
 values(current_setting('test.co_user_a')::uuid,'marketplace','publish',current_setting('test.co_admin')::uuid);
set local role authenticated;
update public.marketplace_promotions set approval_status='approved' where id='ca000000-0000-4000-8000-000000000002';
select pg_temp.assert_true((select approval_status='approved' from public.marketplace_promotions where id='ca000000-0000-4000-8000-000000000002'),'authorized approval works');
reset role;
update public.marketplace_company_memberships set role='quotes' where company_id=current_setting('test.co_b')::uuid;
select set_config('request.jwt.claim.sub',current_setting('test.co_user_b'),true);
set local role authenticated;
select pg_temp.expect_denied(format('insert into public.company_popup_proposals(company_id,title)values(%L,''QUOTES ROLE POPUP'')',current_setting('test.co_b')));
reset role;
select set_config('request.jwt.claim.sub','',true),set_config('request.jwt.claim.role','anon',true);
set local role anon;
select pg_temp.expect_denied('select public.list_company_commercial_requests()');
reset role;
