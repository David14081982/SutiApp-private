create temporary table h05_cases(label text primary key,auth_id uuid,affiliate_id uuid,participant_id uuid) on commit drop;
insert into h05_cases
select coalesce(current_process,'NO_PROCESS')||'_'||ordinal,auth_id,affiliate_id,participant_id
from (
 select p.current_process,u.id auth_id,a.id affiliate_id,p.id participant_id,
  row_number() over(partition by p.current_process order by p.id) ordinal
 from public.savings_participants p join public.savings_import_batches b on b.id=p.import_batch_id
 join public.affiliates a on a.id=p.affiliate_id join auth.users u on u.id=a.auth_user_id
 where p.identity_status='RESOLVED' and b.certification_status='CERTIFIED' and b.status='APPLIED'
 and not a.is_archived and u.email_confirmed_at is not null
 and a.historical_email_normalized=lower(btrim(u.email))
 and (select count(*) from public.affiliates x where x.historical_email_normalized=a.historical_email_normalized)=1
) eligible where ordinal<=3;
insert into h05_cases
select 'NO_PARTICIPANT',u.id,a.id,null from public.affiliates a join auth.users u on u.id=a.auth_user_id
where not a.is_archived and u.email_confirmed_at is not null
 and a.historical_email_normalized=lower(btrim(u.email))
 and (select count(*) from public.affiliates x where x.historical_email_normalized=a.historical_email_normalized)=1
 and not exists(select 1 from public.savings_participants p where p.affiliate_id=a.id)
order by a.id limit 1;
insert into h05_cases
select 'ZERO_BALANCE',u.id,a.id,p.id from public.savings_participants p
join public.savings_import_batches batch on batch.id=p.import_batch_id
join public.affiliates a on a.id=p.affiliate_id join auth.users u on u.id=a.auth_user_id
left join lateral (select e.* from public.savings_legacy_evidence e
 where e.participant_id=p.id and e.source_sheet='Ahorro' and e.record_type='LEGACY_REPORTED_BALANCE'
 order by e.source_row desc limit 1) e on true
where p.identity_status='RESOLVED' and batch.certification_status='CERTIFIED' and batch.status='APPLIED'
 and not a.is_archived and u.email_confirmed_at is not null
 and a.historical_email_normalized=lower(btrim(u.email))
 and (select count(*) from public.affiliates x where x.historical_email_normalized=a.historical_email_normalized)=1
 and coalesce(p.legacy_reported_balance,e.numeric_value,nullif(e.raw_payload#>>'{legacy_reported_balance,value}','')::numeric)=0
order by p.id limit 1;
grant select on h05_cases to authenticated;
create temporary table h05_results(stage text,label text,payload jsonb,primary key(stage,label)) on commit drop;
create function pg_temp.h05_capture(stage text) returns void language plpgsql security invoker set search_path='' as $capture$
declare item record;payload jsonb;
begin
 for item in select * from pg_temp.h05_cases order by label loop
  perform set_config('request.jwt.claims',jsonb_build_object('sub',item.auth_id,'role','authenticated','session_id','h05-equivalence-session')::text,true);
  perform set_config('role','authenticated',true);
  if public.get_effective_affiliate_id() is distinct from item.affiliate_id then raise exception 'H05_CASE_IDENTITY_INVALID';end if;
  payload:=public.get_self_savings_live_readonly();
  perform set_config('role','postgres',true);
  insert into pg_temp.h05_results values(stage,item.label,payload);
 end loop;
end;
$capture$;
