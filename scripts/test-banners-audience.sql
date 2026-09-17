-- Runs after the forward migration inside a transaction that always rolls back (scripts/ads-audience-backend.js).
create function pg_temp.check_ad(ok boolean,label text) returns void language plpgsql as $$ begin if ok is distinct from true then raise exception 'CHECK_FAILED:%',label; end if; end $$;
create function pg_temp.as_claims(sub uuid,role text) returns void language plpgsql as $$ begin
 perform set_config('request.jwt.claim.sub',coalesce(sub::text,''),true);
 perform set_config('request.jwt.claims',case when sub is null then jsonb_build_object('role',role) else jsonb_build_object('sub',sub,'role',role) end::text,true);
end $$;
create function pg_temp.ids(payload jsonb) returns uuid[] language sql as $$ select coalesce(array_agg((x->>'id')::uuid),'{}') from jsonb_array_elements(payload) x $$;
create temporary table ad_fixture(label text primary key,id uuid not null);
create temporary table ad_people(actor uuid,normal uuid,normal_union text,normal_category text,asset uuid,home_visible integer);
insert into ad_people(actor,normal,normal_union,normal_category,asset,home_visible)
 select aa.auth_user_id,b.auth_user_id,b.financial_union_code,b.financial_employee_category_code,
  (select image_asset_id from public.banners limit 1),
  (select count(*) from public.banners h where h.placement='home' and h.enabled and not public.is_banner_archived(h.id))
 from public.admin_assignments aa join public.admin_roles r on r.id=aa.role_id and r.code='principal_admin'
 cross join lateral(select f.auth_user_id,f.financial_union_code,f.financial_employee_category_code from public.affiliates f join auth.users u on u.id=f.auth_user_id
  where f.auth_user_id<>aa.auth_user_id and not f.is_archived and u.email_confirmed_at is not null and f.financial_union_code is not null and f.financial_employee_category_code is not null
   and not exists(select 1 from public.admin_assignments x where x.auth_user_id=f.auth_user_id and x.enabled) limit 1) b
 where aa.enabled limit 1;
create temporary table ad_checks(label text primary key);

do $$declare p record; v jsonb; seen uuid[]; n integer; ok boolean; denied boolean; newid uuid;
 fx_all uuid; fx_reg uuid; fx_seg uuid; fx_other uuid; fx_cat uuid; fx_off uuid; fx_arch uuid; fx_hue uuid;
begin
 select * into p from ad_people;
 perform pg_temp.check_ad(p.actor is not null and p.normal is not null and p.asset is not null,'test_principals');

 -- Schema, defaults, validation and grants.
 perform pg_temp.check_ad((select count(*) from public.banners where audience_mode<>'all' or accent_hue is not null or cardinality(union_codes)>0)=0,'existing_rows_default_all');
 perform pg_temp.check_ad(has_column_privilege('authenticated','public.banners','audience_mode','INSERT') and has_column_privilege('authenticated','public.banners','accent_hue','UPDATE')
  and has_column_privilege('authenticated','public.banners','union_codes','UPDATE') and has_column_privilege('authenticated','public.banners','tag_codes','INSERT'),'column_grants');
 perform pg_temp.check_ad(has_function_privilege('anon','public.list_public_banners(text)','EXECUTE') and has_function_privilege('authenticated','public.list_public_banners(text)','EXECUTE'),'rpc_grants');
 insert into ad_checks values('schema_grants');

 -- Fixtures as service role (bypasses the section guard like any backend job).
 perform pg_temp.as_claims(null,'service_role');
 insert into public.banners(placement,title,image_asset_id,enabled,sort_order,record_origin,audience_mode) values('marketplace','fx all',p.asset,true,9001,'ADMIN_H009','all') returning id into fx_all;
 insert into public.banners(placement,title,image_asset_id,enabled,sort_order,record_origin,audience_mode) values('marketplace','fx registered',p.asset,true,9002,'ADMIN_H009','registered') returning id into fx_reg;
 insert into public.banners(placement,title,image_asset_id,enabled,sort_order,record_origin,audience_mode,union_codes) values('marketplace','fx own union',p.asset,true,9003,'ADMIN_H009','segment',array[p.normal_union]) returning id into fx_seg;
 insert into public.banners(placement,title,image_asset_id,enabled,sort_order,record_origin,audience_mode,union_codes) values('marketplace','fx other union',p.asset,true,9004,'ADMIN_H009','segment',array['NO_UNION_FIXTURE']) returning id into fx_other;
 insert into public.banners(placement,title,image_asset_id,enabled,sort_order,record_origin,audience_mode,employment_category_codes) values('marketplace','fx own category',p.asset,true,9005,'ADMIN_H009','segment',array[p.normal_category]) returning id into fx_cat;
 insert into public.banners(placement,title,image_asset_id,enabled,sort_order,record_origin,audience_mode) values('marketplace','fx hidden',p.asset,false,9006,'ADMIN_H009','all') returning id into fx_off;
 insert into public.banners(placement,title,image_asset_id,enabled,sort_order,record_origin,audience_mode) values('marketplace','fx archived',p.asset,true,9007,'ADMIN_H009','all') returning id into fx_arch;
 insert into public.banners(placement,title,image_asset_id,enabled,sort_order,record_origin,audience_mode,accent_hue) values('marketplace','fx accent',p.asset,true,9008,'ADMIN_H009','all',200) returning id into fx_hue;
 insert into public.banner_deletions(banner_id,actor_auth_user_id) values(fx_arch,p.actor);
 insert into ad_fixture values('all',fx_all),('registered',fx_reg),('own_union',fx_seg),('other_union',fx_other),('own_category',fx_cat),('hidden',fx_off),('archived',fx_arch),('accent',fx_hue);
 denied:=false; begin insert into public.banners(placement,title,image_asset_id,enabled,sort_order,record_origin,audience_mode) values('marketplace','bad mode',p.asset,true,9100,'ADMIN_H009','vip'); exception when check_violation then denied:=true; end;
 perform pg_temp.check_ad(denied,'audience_mode_validated');
 denied:=false; begin insert into public.banners(placement,title,image_asset_id,enabled,sort_order,record_origin,accent_hue) values('marketplace','bad hue',p.asset,true,9101,'ADMIN_H009',400); exception when check_violation then denied:=true; end;
 perform pg_temp.check_ad(denied,'accent_hue_validated');
 insert into ad_checks values('fixtures_and_validation');

 -- Public reader RPC per identity.
 perform pg_temp.as_claims(null,'anon');
 execute 'set local role anon';
 v:=public.list_public_banners('marketplace');
 n:=jsonb_array_length(public.list_public_banners('home'));
 execute 'reset role';
 seen:=pg_temp.ids(v);
 perform pg_temp.check_ad(fx_all=any(seen) and fx_hue=any(seen) and not fx_reg=any(seen) and not fx_seg=any(seen) and not fx_other=any(seen) and not fx_cat=any(seen) and not fx_off=any(seen) and not fx_arch=any(seen),'rpc_anon_only_public');
 perform pg_temp.check_ad(n=p.home_visible,'rpc_home_unchanged');
 perform pg_temp.check_ad((select (x->>'accent_hue')::integer=200 and x->'image_asset'->>'storage_path' is not null from jsonb_array_elements(v) x where x->>'id'=fx_hue::text),'rpc_accent_and_asset_shape');
 perform pg_temp.check_ad((select array_agg((x->>'id')::uuid order by (x->>'sort_order')::integer) from jsonb_array_elements(v) x where (x->>'id')::uuid=any(array[fx_all,fx_hue]))=array[fx_all,fx_hue],'rpc_sorted');

 perform pg_temp.as_claims(p.normal,'authenticated');
 execute 'set local role authenticated';
 v:=public.list_public_banners('marketplace');
 execute 'reset role';
 seen:=pg_temp.ids(v);
 perform pg_temp.check_ad(fx_all=any(seen) and fx_reg=any(seen) and fx_seg=any(seen) and fx_cat=any(seen) and fx_hue=any(seen) and not fx_other=any(seen) and not fx_off=any(seen) and not fx_arch=any(seen),'rpc_affiliate_profile');

 perform pg_temp.as_claims(p.actor,'authenticated');
 execute 'set local role authenticated';
 v:=public.list_public_banners('marketplace');
 execute 'reset role';
 seen:=pg_temp.ids(v);
 perform pg_temp.check_ad(not fx_other=any(seen) and not fx_off=any(seen) and not fx_arch=any(seen) and fx_all=any(seen) and fx_reg=any(seen),'rpc_admin_filtered_by_own_profile');
 denied:=false; begin perform public.list_public_banners('convenios'); exception when invalid_parameter_value then denied:=true; end;
 perform pg_temp.check_ad(denied,'rpc_rejects_unknown_placement');
 insert into ad_checks values('public_reader');

 -- Direct table reads (RLS) per identity.
 perform pg_temp.as_claims(null,'anon');
 execute 'set local role anon';
 select coalesce(array_agg(id),'{}') into seen from public.banners where id in (fx_all,fx_reg,fx_seg,fx_other,fx_cat,fx_off,fx_arch,fx_hue);
 execute 'reset role';
 perform pg_temp.check_ad(fx_all=any(seen) and fx_hue=any(seen) and cardinality(seen)=2,'rls_anon');
 perform pg_temp.as_claims(p.normal,'authenticated');
 execute 'set local role authenticated';
 select coalesce(array_agg(id),'{}') into seen from public.banners where id in (fx_all,fx_reg,fx_seg,fx_other,fx_cat,fx_off,fx_arch,fx_hue);
 execute 'reset role';
 perform pg_temp.check_ad(cardinality(seen)=5 and not fx_other=any(seen) and not fx_off=any(seen) and not fx_arch=any(seen),'rls_affiliate');
 perform pg_temp.as_claims(p.actor,'authenticated');
 execute 'set local role authenticated';
 select coalesce(array_agg(id),'{}') into seen from public.banners where id in (fx_all,fx_reg,fx_seg,fx_other,fx_cat,fx_off,fx_arch,fx_hue);
 execute 'reset role';
 perform pg_temp.check_ad(fx_other=any(seen) and fx_off=any(seen) and not fx_arch=any(seen) and cardinality(seen)=7,'rls_admin_manages_all_not_archived');
 insert into ad_checks values('direct_reads');

 -- Admin writer exactly like the REST client: insert and update audience/accent as the browser role.
 perform pg_temp.as_claims(p.actor,'authenticated');
 execute 'set local role authenticated';
 insert into public.banners(placement,title,description,action_url,enabled,sort_order,record_origin,image_asset_id,audience_mode,union_codes,employment_category_codes,gender_codes,tag_codes,accent_hue)
  values('marketplace','AMCO fixture','Descuentos exclusivos','https://example.invalid/amco',true,9200,'ADMIN_H009',p.asset,'segment',array['SUTISSSTESON'],'{}','{}','{}',150) returning id into newid;
 update public.banners set audience_mode='registered',union_codes='{}',accent_hue=36 where id=newid;
 execute 'reset role';
 perform pg_temp.check_ad((select audience_mode='registered' and accent_hue=36 and cardinality(union_codes)=0 and record_origin='ADMIN_H009' from public.banners where id=newid),'admin_rest_insert_update');
 perform pg_temp.check_ad(exists(select 1 from public.admin_audit_log where resource='banners' and target_id=newid::text),'admin_write_audited');
 insert into ad_checks values('admin_writer');
end $$;
select 'PASS' status,(select array_agg(label order by label) from ad_checks) groups;
