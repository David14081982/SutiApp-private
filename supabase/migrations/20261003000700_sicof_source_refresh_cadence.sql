begin;
set local lock_timeout='2s';
set local statement_timeout='60s';
-- H-SICOF-RESPONSE-LATENCY-001. Correct only the private cache claim cadence.
-- Normal claims belong exclusively to the secret-protected four-minute job.
-- Manual force=true retains 60-second cooldown. Both retain the 90-second lease.
-- 006 is immutable. No observation, financial row, other function or ACL changes.
do $guard$ declare p oid;begin
 p:=to_regprocedure('public.service_sicof_source_claim(boolean)');
 if p is null or md5(pg_get_functiondef(p)) is distinct from '6904843462a6ecceb2512940303a616a'
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
declare r sicof_source_private.observation;t timestamptz;token uuid;
begin
 select * into strict r from sicof_source_private.observation where singleton for update;
 t:=clock_timestamp();
 -- Periodic jobs already run every four minutes. Skipping a tick on recent
 -- observation age can push the next check past TTL after a manual refresh.
 if (r.lease_token is not null and r.lease_until>t)
  or (coalesce(p_force,false) and r.last_attempt_at>t-interval '60 seconds') then
  return jsonb_build_object('claimed',false,'lease',null,'meta',sicof_source_private.metadata(r,t));
 end if;
 token:=gen_random_uuid();
 update sicof_source_private.observation set lease_token=token,lease_until=t+interval '90 seconds',last_attempt_at=t
  where singleton returning * into r;
 return jsonb_build_object('claimed',true,'lease',token,'meta',sicof_source_private.metadata(r,t));
end $function$;

commit;
