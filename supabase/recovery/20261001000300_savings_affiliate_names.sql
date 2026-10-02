begin;
set local lock_timeout='2s';
set local statement_timeout='60s';
-- Exact inverse; refuse to overwrite any later reader change. No business rows
-- or historical names were rewritten, so recovery never needs data restoration.
do $recovery$
declare r record; installed text; restored text;
begin
 for r in select * from (values
  ('public.get_admin_savings_dashboard(uuid)',
   '44322207796287c3306b62b3e3e7c505','70ff5265417984b960fa8cae88e79624',
   'p.display_name,p.participant_type',
   'public.savings_affiliate_display_name(p.id) display_name,p.participant_type'),
  ('public.get_admin_savings_reconciliation(date)',
   '679c111e7af2d764041fd026ff26d49c','a4f834cc504f83aba8cb92e09053f84b',
   'p.display_name nombre','public.savings_affiliate_display_name(p.id) nombre'),
  ('public.get_admin_savings_runtime_requests(text)',
   '524a287c74aec145ef570be5fb10fbe6','f40f8f7e629255d5a614ef70c4fff38b',
   '''name'',p.display_name,''process''',
   '''name'',public.savings_affiliate_display_name(p.id),''process''')
 ) as changes(signature,before_hash,after_hash,old_expression,new_expression)
 loop
  installed:=pg_get_functiondef(r.signature::regprocedure);
  if md5(installed)<>r.after_hash then raise exception 'SAVINGS_NAME_RECOVERY_DRIFT: %',r.signature;end if;
  restored:=replace(installed,r.new_expression,r.old_expression);
  if md5(restored)<>r.before_hash then raise exception 'SAVINGS_NAME_RECOVERY_INVALID: %',r.signature;end if;
  execute restored;
  if md5(pg_get_functiondef(r.signature::regprocedure))<>r.before_hash
   then raise exception 'SAVINGS_NAME_RESTORE_MISMATCH: %',r.signature;end if;
 end loop;
end $recovery$;
drop function public.savings_affiliate_display_name(uuid);
notify pgrst,'reload schema';
commit;
