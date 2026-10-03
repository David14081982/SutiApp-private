begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
-- Preserve the installed reader and the exact legacy rules from which its
-- two source-review booleans are derived. No financial function is replaced.
do $$ declare expected record;actual record;begin
 for expected in select * from (values
  ('sicof_private.context(date,date)','7f30423c12286a4b5d4db89723ab212a','{postgres=X/postgres}'),
  ('public.savings_context_before_source_refresh(uuid)','5e8e2a3d75bed8dddadda96812023cda','{postgres=X/postgres}'),
  ('public.savings_certification_context(uuid)','f02b97fd2e06272c4b941263b99e4af9','{postgres=X/postgres}'),
  ('public.savings_account_before_runtime(uuid,date)','9c1efdf3275e1cb6e33ffab275f3567e','{postgres=X/postgres}'),
  ('public.savings_financial_before_accounts(uuid,date)','0d38d87a59ae2b44cacba8694e3c7315','{postgres=X/postgres}'),
  ('public.get_admin_savings_financial_account(uuid,date)','7d55a959eb44f10e47c388e964d6d2fe','{postgres=X/postgres,authenticated=X/postgres}'),
  ('public.get_admin_savings_account(uuid,date)','d7eb3bf901e66474b3affca78d672ed3','{postgres=X/postgres,authenticated=X/postgres}')
 ) audited(signature,definition_md5,acl) loop
  select md5(pg_get_functiondef(p.oid)) definition_md5,pg_get_userbyid(p.proowner) owner_name,p.proacl into actual
   from pg_proc p where p.oid=to_regprocedure(expected.signature);
  if not found or actual.definition_md5 is distinct from expected.definition_md5 or actual.owner_name is distinct from 'postgres'
   or not(coalesce(actual.proacl,'{}'::aclitem[]) @> expected.acl::aclitem[] and coalesce(actual.proacl,'{}'::aclitem[]) <@ expected.acl::aclitem[])
  then raise exception 'SICOF_CONTEXT_INSTALL_BASELINE_DRIFT: %',expected.signature;end if;
 end loop;
end $$;

create table sicof_private.context_read_backup(
 id boolean primary key check(id),definition text not null,installed_definition text,
 original_acl aclitem[],original_owner text not null
);
alter table sicof_private.context_read_backup enable row level security;
alter table sicof_private.context_read_backup force row level security;
revoke all on sicof_private.context_read_backup from public,anon,authenticated,service_role;
insert into sicof_private.context_read_backup(id,definition,original_acl,original_owner)
 select true,pg_get_functiondef(oid),proacl,pg_get_userbyid(proowner) from pg_proc where oid='sicof_private.context(date,date)'::regprocedure;

do $install$ declare definition text;old_source text:=$old$source_review:=public.get_admin_savings_financial_account(c.record_id,null);$old$;
 new_source text:=$replacement$-- Same source-review rule as the audited financial reader. Its full
    -- schedules/account/audit payload are not required by this projection.
    if not exists(select 1 from public.savings_review_records r where r.id=c.record_id and r.source_sheet='Ahorro') then raise exception 'SAVINGS_RECORD_REQUIRED';end if;
    if c.cutoff_on>present+366 then raise exception 'SAVINGS_PROJECTION_RANGE_INVALID';end if;
    select jsonb_build_object('source_changed',
     (select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'version',r.version,'source',r.source_data,'proposal',r.proposed_data,'status',r.status) order by r.id),'[]')
      from public.savings_review_records r where r.source_folio=(select s.source_folio from public.savings_review_records s where s.id=c.record_id and s.source_sheet='Ahorro'))
      is distinct from coalesce((select a.after_data->'source_snapshot' from public.savings_audit_events a
       where a.participant_id=p.id and a.action='ADJUST_CONFIRMED_BALANCE' order by a.id desc limit 1),c.source_snapshot)->'related',
     'context',jsonb_build_object('source_update',jsonb_build_object('pending',coalesce(
      (select not exists(select 1 from public.savings_source_acceptances a where a.observation_id=o.id)
       from public.savings_source_observations o where o.record_id=c.record_id order by o.observed_at desc,o.id desc limit 1),false)))) into source_review;$replacement$;
 old_origins text:=$old_origins$from savings_period_private.origins(p.id,as_of)o where o.transaction_id=t.id$old_origins$;
 new_origins text:=$new_origins$from savings_period_private.resolve_origin(t.id,as_of)o$new_origins$;
 old_people text:=$old_people$people jsonb:='[]';$old_people$;
 new_people text:=$new_people$people jsonb[]:=array[]::jsonb[];$new_people$;
 old_append text:=$old_append$people:=people||jsonb_build_array(person);$old_append$;
 new_append text:=$new_append$people:=array_append(people,person);$new_append$;
begin
 select b.definition into strict definition from sicof_private.context_read_backup b where id;
 if (length(definition)-length(replace(definition,old_source,'')))/length(old_source)<>1
  or (length(definition)-length(replace(definition,old_origins,'')))/length(old_origins)<>1
  or (length(definition)-length(replace(definition,old_people,'')))/length(old_people)<>1
  or (length(definition)-length(replace(definition,old_append,'')))/length(old_append)<>1 then raise exception 'SICOF_CONTEXT_REPLACEMENT_DRIFT';end if;
 execute replace(replace(replace(replace(definition,old_source,new_source),old_origins,new_origins),old_people,new_people),old_append,new_append);
 update sicof_private.context_read_backup set installed_definition=pg_get_functiondef('sicof_private.context(date,date)'::regprocedure) where id;
end $install$;
notify pgrst,'reload schema';
commit;
