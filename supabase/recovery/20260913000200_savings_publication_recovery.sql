begin;
do $$begin
 if exists(select 1 from public.savings_publication_events) or exists(select 1 from public.savings_publication_state where mode<>'PRIVATE') then
  raise exception 'SAVINGS_PUBLICATION_HISTORY_MUST_BE_PRESERVED';end if;
end $$;
drop function public.replace_self_savings_beneficiaries(jsonb,uuid);
alter function public.savings_beneficiaries_before_publication(jsonb,uuid) rename to replace_self_savings_beneficiaries;
drop function public.get_self_savings_dashboard();
alter function public.savings_dashboard_before_publication() rename to get_self_savings_dashboard;
drop function public.get_self_savings_if_changed(text);
alter function public.savings_if_changed_before_publication(text) rename to get_self_savings_if_changed;
drop function public.get_self_savings_live_readonly();
alter function public.savings_self_before_publication() rename to get_self_savings_live_readonly;
do $$declare r record; a record; role_name text;begin
 for r in select * from public.savings_publication_function_backup order by signature loop
  execute r.definition;
  execute format('alter function public.%s owner to %I',r.signature,r.original_owner);
  -- Reset current grants, then restore the recorded ACL in its original order.
  execute format('revoke all on function public.%s from public,anon,authenticated,service_role',r.signature);
  for a in select * from aclexplode(coalesce(r.original_acl,acldefault('f',r.original_owner::regrole))) loop
   if a.grantee=r.original_owner::regrole::oid then continue;end if;
   role_name:=case when a.grantee=0 then 'PUBLIC' else quote_ident(a.grantee::regrole::text) end;
   execute format('grant execute on function public.%s to %s%s',r.signature,role_name,case when a.is_grantable then ' with grant option' else '' end);
  end loop;
 end loop;
end $$;
drop function public.admin_publish_savings(integer,text,boolean,uuid);
drop function public.get_admin_savings_publication_status();
drop function public.get_admin_savings_publication_preview(uuid);
drop function public.get_admin_savings_publication_account_preview(uuid);
drop function public.savings_canonical_user_projection(uuid);
drop table public.savings_publication_events,public.savings_publication_state,public.savings_publication_function_backup;
notify pgrst,'reload schema';
commit;
