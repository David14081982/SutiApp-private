begin;
set local statement_timeout='40s';
set local lock_timeout='2s';
create temporary table h07_actors(label text primary key,id uuid) on commit drop;
insert into h07_actors select 'principal',a.auth_user_id from public.admin_assignments a join public.admin_roles r on r.id=a.role_id where a.enabled and r.enabled and r.code='principal_admin' limit 1;
insert into h07_actors select 'member',a.auth_user_id from public.affiliates a join auth.users u on u.id=a.auth_user_id where not a.is_archived and u.email_confirmed_at is not null and not exists(select 1 from public.admin_assignments x where x.auth_user_id=u.id) order by a.id limit 1;
insert into h07_actors select 'other',a.auth_user_id from public.affiliates a join auth.users u on u.id=a.auth_user_id where not a.is_archived and u.email_confirmed_at is not null and not exists(select 1 from public.admin_assignments x where x.auth_user_id=u.id) and u.id<>(select id from h07_actors where label='member') order by a.id limit 1;
create temporary table h07_companies(id uuid primary key,n integer) on commit drop;
insert into h07_companies select id,row_number() over(order by id) from public.companies order by id limit 3;
select set_config('request.jwt.claims',(select jsonb_build_object('sub',id,'role','authenticated')::text from h07_actors where label='principal'),true);
insert into public.marketplace_company_memberships(company_id,auth_user_id,role,enabled)
select c.id,a.id,'owner',true from h07_companies c cross join h07_actors a where c.n=1 and a.label='member';
insert into public.marketplace_promotions(company_id,title,description,enabled,approval_status,sort_order,start_date,end_date,record_origin)
select c.id,'H07 isolated promotion '||g,'Fixture only in rolled-back transaction',g<>3,case when g=2 then 'pending' when g=4 then 'rejected' else 'approved' end,g,case when g=5 then current_date+2 end,case when g=6 then current_date-2 end,'ADMIN_PHASE3'
from h07_companies c cross join generate_series(1,6) g where c.n<>2;
create temporary table h07_results(mode text,n integer,equivalent boolean,companies integer,promotions integer,private_other_company integer,before_sqlstate text,after_sqlstate text) on commit drop;
grant select on h07_actors,h07_companies to authenticated,anon;
grant insert,select on h07_results to authenticated,anon;
create function pg_temp.h07_compare(p_mode text,p_n integer) returns void language plpgsql security invoker as $$
declare before_result jsonb:='[]';after_result jsonb;company record;promotions jsonb;before_error text;after_error text;
begin
  begin
  for company in select c.id from public.companies c join h07_companies f on f.id=c.id where f.n<=p_n order by c.id loop
    select coalesce(jsonb_agg(to_jsonb(p) order by p.sort_order),'[]') into promotions from (select * from public.marketplace_promotions where company_id=company.id order by sort_order limit 1000) p;
    before_result:=before_result||jsonb_build_array(jsonb_build_object('id',company.id,'promotions',promotions));
  end loop;
  exception when insufficient_privilege then before_error:=SQLSTATE;end;
  begin
  if before_error is null and before_result='[]'::jsonb then after_result:='[]'::jsonb; else
  select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'promotions',p.data) order by c.id),'[]') into after_result
  from public.companies c join h07_companies f on f.id=c.id
  left join lateral (select coalesce(jsonb_agg(to_jsonb(x) order by x.sort_order),'[]') data from (select * from public.marketplace_promotions where company_id=c.id order by sort_order limit 1000) x) p on true where f.n<=p_n;
  end if;
  exception when insufficient_privilege then after_error:=SQLSTATE;end;
  insert into h07_results values(p_mode,p_n,((before_error is not null and before_error=after_error) or (before_error is null and after_error is null and before_result=after_result)),coalesce(jsonb_array_length(after_result),0),(select coalesce(sum(jsonb_array_length(x->'promotions')),0)::integer from jsonb_array_elements(after_result) x),(select count(*)::integer from jsonb_array_elements(after_result) c,jsonb_array_elements(c->'promotions') p where p->>'company_id'<>c->>'id'),before_error,after_error);
end$$;
grant execute on function pg_temp.h07_compare(text,integer) to authenticated,anon;
set local role authenticated;
select pg_temp.h07_compare('principal',n) from generate_series(0,3) n;
reset role;
select set_config('request.jwt.claims',(select jsonb_build_object('sub',id,'role','authenticated')::text from h07_actors where label='member'),true);
set local role authenticated;
select pg_temp.h07_compare('member',n) from generate_series(0,3) n;
reset role;
select set_config('request.jwt.claims',(select jsonb_build_object('sub',id,'role','authenticated')::text from h07_actors where label='other'),true);
set local role authenticated;
select pg_temp.h07_compare('other',n) from generate_series(0,3) n;
reset role;
select set_config('request.jwt.claims','{"role":"anon"}',true);
set local role anon;
select pg_temp.h07_compare('anon',n) from generate_series(0,3) n;
reset role;
select * from h07_results order by mode,n;
rollback;
