begin;
set local lock_timeout='2s';
set local statement_timeout='15s';

-- Signature replacements in 20260918000100 lost the original private ACLs.
-- These are internal helpers. Owner-executed, permission-checked RPCs remain usable.
-- No function body, table, business row or global default privilege is changed.
do $guard$
declare item record; fn pg_proc; original_acl aclitem[]:=
  '{=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}'::aclitem[];
begin
 for item in select * from (values
  ('public.savings_admin_current_summary(jsonb)','2c604445c1a9f9fffca2ae2f65edac26'),
  ('public.savings_panel_before_current_summary(text,text,text,integer,integer,jsonb)','25f57c2bff9d381caf00444f99c837e2')
 ) x(signature,definition_md5) loop
  select * into fn from pg_proc where oid=to_regprocedure(item.signature);
  if fn.oid is null or fn.proowner<>'postgres'::regrole or not fn.prosecdef
   or md5(pg_get_functiondef(fn.oid))<>item.definition_md5
   or fn.proacl is null or not ((fn.proacl @> original_acl and original_acl @> fn.proacl)
    or fn.proacl='{postgres=X/postgres}'::aclitem[])
  then raise exception 'SAVINGS_PRIVATE_HELPER_DRIFT: %',item.signature;end if;
 end loop;
end $guard$;

revoke all on function
 public.savings_admin_current_summary(jsonb),
 public.savings_panel_before_current_summary(text,text,text,integer,integer,jsonb)
from public,anon,authenticated,service_role;

commit;
