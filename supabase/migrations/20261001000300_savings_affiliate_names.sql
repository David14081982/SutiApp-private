begin;
set local lock_timeout='2s';
set local statement_timeout='60s';
-- Presentation only: keep participant UUIDs, raw controls, history and every
-- financial/identity writer intact. The existing admin RPCs own authorization.
create function public.savings_affiliate_display_name(p_participant_id uuid)
returns text language sql stable security invoker set search_path='' as $$
 select coalesce((
  select case
   when p.identity_status is distinct from 'RESOLVED' or a.id is null
    or nullif(btrim(p.legacy_folio),'') is null
    or (select count(*) from public.affiliates candidate
      where candidate.numero_control=p.legacy_folio
       and not coalesce(candidate.is_archived,false))<>1
    then 'Identidad por revisar'
   when nullif(btrim(a.full_name),'') is null then 'Nombre no disponible en Afiliados'
   else a.full_name end
  from public.savings_participants p
  left join public.affiliates a on a.id=p.affiliate_id
   and a.numero_control=p.legacy_folio and not coalesce(a.is_archived,false)
  where p.id=p_participant_id
 ),'Identidad por revisar');
$$;
revoke all on function public.savings_affiliate_display_name(uuid)
 from public,anon,authenticated,service_role;

-- Exact reversible substitutions preserve the original OIDs, owners, ACLs,
-- permission gates and all non-name expressions. Abort on any definition drift.
do $patch$
declare r record; original text; patched text;
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
  original:=pg_get_functiondef(r.signature::regprocedure);
  if md5(original)<>r.before_hash then raise exception 'SAVINGS_NAME_READER_DRIFT: %',r.signature;end if;
  patched:=replace(original,r.old_expression,r.new_expression);
  if md5(patched)<>r.after_hash then raise exception 'SAVINGS_NAME_PATCH_INVALID: %',r.signature;end if;
  execute patched;
  if md5(pg_get_functiondef(r.signature::regprocedure))<>r.after_hash
   then raise exception 'SAVINGS_NAME_INSTALL_MISMATCH: %',r.signature;end if;
 end loop;
end $patch$;
notify pgrst,'reload schema';
commit;
