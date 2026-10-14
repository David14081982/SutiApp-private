begin;
set local lock_timeout='2s';
set local statement_timeout='60s';
-- Roll back the Historial frontend first. No CASCADE: unexpected dependencies
-- abort recovery instead of removing another feature or any historical data.
do $guard$
begin
 if md5(pg_get_functiondef('public.get_admin_savings_withdrawal_history(text,text,integer,integer)'::regprocedure))
  <>'dca55accf3a419447dfa8a022b4558d0' then
  raise exception 'SAVINGS_WITHDRAWAL_HISTORY_RECOVERY_DRIFT';
 end if;
end $guard$;
drop function public.get_admin_savings_withdrawal_history(text,text,integer,integer);
notify pgrst,'reload schema';
commit;
