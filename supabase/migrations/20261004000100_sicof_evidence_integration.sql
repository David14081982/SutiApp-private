begin;
set local lock_timeout='2s';
set local statement_timeout='60s';
-- SICOF-only read adapter. Never updates history, plans or financial balances.
do $$ declare r record; begin
 if to_regclass('sicof_private.evidence_reader_backup') is not null
  or to_regprocedure('sicof_private.evidence_history(uuid)') is not null then
  raise exception 'SICOF_EVIDENCE_ALREADY_INSTALLED';
 end if;
 for r in select * from (values
  ('sicof_private.context(date,date)','333c799b38198a06dc86b70aa323833f','{postgres=X/postgres}'),
  ('public.savings_workspace_history(uuid)','0c0119d1ffaec313aff4ad1aa1427279','{postgres=X/postgres}'),
  ('public.generate_savings_schedule(uuid,date,date)','3783b5c5ff59f512775c446d6d4b2379','{postgres=X/postgres,service_role=X/postgres}'),
  ('public.savings_next_contribution_date(date,text)','e715929b802cb3ef78ce2808bdfc8814','{postgres=X/postgres,service_role=X/postgres}')
 ) expected(signature,hash,acl) loop
  if not exists(select 1 from pg_proc p where p.oid=to_regprocedure(r.signature)
   and md5(pg_get_functiondef(p.oid))=r.hash and pg_get_userbyid(p.proowner)='postgres'
   and p.proacl @> r.acl::aclitem[] and p.proacl <@ r.acl::aclitem[]) then
   raise exception 'SICOF_EVIDENCE_BASELINE_DRIFT: %',r.signature;
  end if;
 end loop;
end $$;

create table sicof_private.evidence_reader_backup (
 id boolean primary key check(id), definition text not null, installed_hash text,
 helper_hash text, original_oid oid not null, original_owner text not null, original_acl aclitem[] not null
);
alter table sicof_private.evidence_reader_backup enable row level security;
alter table sicof_private.evidence_reader_backup force row level security;
revoke all on sicof_private.evidence_reader_backup from public,anon,authenticated,service_role;
insert into sicof_private.evidence_reader_backup(id,definition,original_oid,original_owner,original_acl)
 select true,pg_get_functiondef(oid),oid,pg_get_userbyid(proowner),proacl from pg_proc
 where oid='sicof_private.context(date,date)'::regprocedure;

create function sicof_private.evidence_history(p_participant_id uuid)
returns table(id text,date date,amount numeric,expected numeric,status text,source text,
 includes_yield boolean,data_conflict boolean,expected_source text,expected_plan_id uuid)
language sql stable security definer set search_path='' as $$
 select h.id,h.date,h.amount,
  case when h.expected is not null then h.expected when proof.valid then proof.amount end,
  h.status,h.source,h.includes_yield,h.data_conflict,
  case when h.expected is not null then 'SOURCE_HISTORY' when proof.valid then 'CANONICAL_PLAN_AT_DATE' else 'UNRESOLVED' end,
  case when h.expected is null and proof.valid then proof.plan_id end
 from public.savings_workspace_history(p_participant_id) h
 left join lateral (
  select count(*)=1 and bool_and(cp.data_classification='CANONICAL' and e.data_classification='CANONICAL'
    and cp.amount>=0 and cp.amount=round(cp.amount,2)
    and h.date>=e.first_expected_contribution_date
    and h.date>=(e.enrollment_started_at at time zone 'America/Hermosillo')::date
    and (e.terminated_at is null or h.date<(e.terminated_at at time zone 'America/Hermosillo')::date)
    and cp.process_snapshot=e.process_snapshot
    and public.savings_next_contribution_date(h.date,cp.process_snapshot)=h.date) valid,
   min(cp.amount) amount,(array_agg(cp.id))[1] plan_id
  from public.savings_balance_certifications c
  join public.savings_enrollments e on e.participant_id=c.participant_id and e.id=c.enrollment_id
  join public.savings_contribution_plans cp on cp.enrollment_id=e.id
   and cp.effective_from<=h.date and (cp.effective_to is null or cp.effective_to>=h.date)
  where c.participant_id=p_participant_id and h.date<=c.cutoff_on
   and h.source='CERTIFIED_HISTORY' and h.expected is null
   and h.amount is not null and h.amount>=0 and h.includes_yield=false and h.data_conflict=false
 ) proof on true;
$$;
revoke all on function sicof_private.evidence_history(uuid) from public,anon,authenticated,service_role;

do $$ declare original text; needle text:='public.savings_workspace_history(p.id)h'; begin
 select definition into strict original from sicof_private.evidence_reader_backup where id;
 if (length(original)-length(replace(original,needle,'')))/length(needle)<>1 then
  raise exception 'SICOF_EVIDENCE_REPLACEMENT_DRIFT';
 end if;
 execute replace(original,needle,'sicof_private.evidence_history(p.id)h');
 update sicof_private.evidence_reader_backup set
  installed_hash=md5(pg_get_functiondef('sicof_private.context(date,date)'::regprocedure)),
  helper_hash=md5(pg_get_functiondef('sicof_private.evidence_history(uuid)'::regprocedure));
end $$;
notify pgrst,'reload schema';
commit;
