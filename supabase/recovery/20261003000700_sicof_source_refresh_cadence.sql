begin;
set local lock_timeout='2s';
set local statement_timeout='60s';
-- Restore the exact installed 006 claim definition after its guarded match.
-- This file contains the literal original definition as the recovery backup;
-- OID/owner/ACL and all source observations/leases remain unchanged.
do $guard$ declare p oid;begin
 p:=to_regprocedure('public.service_sicof_source_claim(boolean)');
 if p is null or md5(pg_get_functiondef(p)) is distinct from 'e0a4804a49c05dac578d311bf7aea108'
  or (select pg_get_userbyid(proowner) from pg_proc where oid=p) is distinct from 'postgres'
  or (select proacl::text from pg_proc where oid=p) is distinct from '{postgres=X/postgres,service_role=X/postgres}'
  then raise exception 'SICOF_SOURCE_CADENCE_BASELINE_DRIFT';end if;
end $guard$;
CREATE OR REPLACE FUNCTION public.service_sicof_source_claim(p_force boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare r sicof_source_private.observation;t timestamptz;token uuid;cooldown interval;
begin
 select * into strict r from sicof_source_private.observation where singleton for update;
 t:=clock_timestamp();
 cooldown:=case when coalesce(p_force,false) then interval '60 seconds' else interval '180 seconds' end;
 if (r.lease_token is not null and r.lease_until>t)
  or r.last_attempt_at>t-cooldown
  or (not coalesce(p_force,false) and r.observed_at>t-interval '180 seconds') then
  return jsonb_build_object('claimed',false,'lease',null,'meta',sicof_source_private.metadata(r,t));
 end if;
 token:=gen_random_uuid();
 update sicof_source_private.observation set lease_token=token,lease_until=t+interval '90 seconds',last_attempt_at=t
  where singleton returning * into r;
 return jsonb_build_object('claimed',true,'lease',token,'meta',sicof_source_private.metadata(r,t));
end $function$;

commit;
