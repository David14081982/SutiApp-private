begin;
set local lock_timeout='2s';
set local statement_timeout='60s';
-- Match the already certified exact active affiliate; retain archived history.
-- This migration does not publish, alter money or change settlement/request guards.
insert into public.savings_certification_function_backup(signature,definition)
select 'P1_PUBLICATION_20260921:'||oid::regprocedure::text,pg_get_functiondef(oid)
from pg_proc where pronamespace='public'::regnamespace and proname in
 ('get_admin_savings_publication_status','savings_canonical_user_projection','get_self_savings_live_readonly');
do $patch$ declare d text; old_text text; new_text text; sig text;begin
 if (select count(*) from public.savings_certification_function_backup where signature like 'P1_PUBLICATION_20260921:%')<>3
 then raise exception 'SAVINGS_PUBLICATION_CONTRACT_DRIFT';end if;
 foreach sig in array array['savings_canonical_user_projection(uuid)','get_admin_savings_publication_status()'] loop
  d:=pg_get_functiondef(('public.'||sig)::regprocedure);
  old_text:='(select count(*) from public.affiliates where numero_control=p.legacy_folio)<>1';
  new_text:='(select count(*) from public.affiliates where numero_control=p.legacy_folio and not coalesce(is_archived,false))<>1';
  if position(old_text in d)=0 then raise exception 'SAVINGS_PUBLICATION_ACTIVE_CONTRACT_DRIFT';end if;
  d:=replace(d,old_text,new_text);
  if sig='get_admin_savings_publication_status()' then
   old_text:=$old$(ctx#>>'{person,identity,match_count}')::int<>1 or $old$;
   if position(old_text in d)=0 then raise exception 'SAVINGS_PUBLICATION_REVIEW_CONTRACT_DRIFT';end if;
   d:=replace(d,old_text,'');
  end if;
  execute d;
 end loop;
 d:=pg_get_functiondef('public.get_self_savings_live_readonly()'::regprocedure);
 old_text:='(select count(*) from public.affiliates where numero_control=control)<>1';
 new_text:='(select count(*) from public.affiliates where numero_control=control and not coalesce(is_archived,false))<>1';
 if position(old_text in d)=0 then raise exception 'SAVINGS_SELF_ACTIVE_CONTRACT_DRIFT';end if;
 execute replace(d,old_text,new_text);
end $patch$;
notify pgrst,'reload schema';
commit;
