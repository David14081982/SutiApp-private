begin;
set local lock_timeout='2s';
set local statement_timeout='30s';

-- Native Auth audit storage is enabled separately. No Auth/business rows are changed.
insert into public.admin_section_definitions
 (section_key,display_name,data_boundary,allowed_actions,enforcement_status,module_key,
  module_read_permissions,module_write_permissions,module_sections,module_total_only,module_order)
values ('admin_login_history','Historial de accesos','Read-only Auth sign-ins and affiliate contact',
 array['read'],'ENFORCED','login_history',array['authorization.read'],array[]::text[],array[]::text[],true,90);

create function public.list_admin_login_history(
 p_mode text default 'users', p_query text default null,
 p_from date default null, p_to date default null,
 p_page integer default 1, p_page_size integer default 25
) returns jsonb language plpgsql stable security definer set search_path=''
set statement_timeout='10s' as $$
declare result jsonb;
begin
 if auth.uid() is null or not public.has_admin_permission('authorization.read')
    or not public.admin_module_boundary(array['login_history']) then
  raise exception 'ADMIN_LOGIN_HISTORY_DENIED' using errcode='42501';
 end if;
 if p_mode is null or p_mode not in ('users','history') or p_page is null or p_page<1 or p_page>1000000
    or p_page_size is null or p_page_size<1 or p_page_size>100
    or length(coalesce(p_query,''))>200 or (p_from is not null and p_to is not null and p_from>p_to) then
  raise exception 'INVALID_LOGIN_HISTORY_FILTERS' using errcode='22023';
 end if;
 with events as (
  select u.id::text event_id,u.id::text actor_id,u.last_sign_in_at occurred_at
  from auth.users u where p_mode='users' and u.last_sign_in_at is not null
  union all
  select e.id::text,e.payload->>'actor_id',e.created_at
  from auth.audit_log_entries e
  where p_mode='history' and e.payload->>'action'='login' and e.created_at is not null
 ), projected as (
  select e.*,u.email,a.numero_control,a.full_name,a.notification_phone phone,a.phone_raw historical_phone
  from events e left join auth.users u on u.id::text=e.actor_id
  left join lateral (
   select x.* from (select f.numero_control,f.full_name,f.notification_phone,f.phone_raw,
    count(*) over () links from public.affiliates f where f.auth_user_id=u.id) x where x.links=1
  ) a on true
 ), filtered as (
  select * from projected x
  where (p_from is null or occurred_at >= (p_from::timestamp at time zone 'America/Hermosillo'))
   and (p_to is null or occurred_at < ((p_to+1)::timestamp at time zone 'America/Hermosillo'))
   and (nullif(btrim(p_query),'') is null or strpos(lower(concat_ws(' ',full_name,numero_control,email,phone,historical_phone)),lower(btrim(p_query)))>0)
 ), page_rows as (
  select * from filtered order by occurred_at desc,event_id desc
  limit p_page_size offset ((p_page::bigint-1)*p_page_size)
 )
 select jsonb_build_object(
  'items',coalesce((select jsonb_agg(jsonb_build_object('id',event_id,'occurred_at',occurred_at,
   'email',email,'numero_control',numero_control,'full_name',full_name,
   'phone',phone,'historical_phone',historical_phone) order by occurred_at desc,event_id desc) from page_rows),'[]'::jsonb),
  'total',(select count(*) from filtered),'users_in_filter',(select count(distinct actor_id) from filtered),
  'total_users_signed_in',(select count(*) from auth.users where last_sign_in_at is not null),
  'history_available_from',(select min(created_at) from auth.audit_log_entries where payload->>'action'='login'),
  'page',p_page,'page_size',p_page_size,'mode',p_mode,'timezone','America/Hermosillo'
 ) into result;
 return result;
end $$;
revoke all on function public.list_admin_login_history(text,text,date,date,integer,integer) from public,anon,authenticated;
grant execute on function public.list_admin_login_history(text,text,date,date,integer,integer) to authenticated;
comment on function public.list_admin_login_history(text,text,date,date,integer,integer)
 is 'Admin-only live projection. Native Auth login events are distinct from last sign-in; no historical reconstruction.';
commit;
