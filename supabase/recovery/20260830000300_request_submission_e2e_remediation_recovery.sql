begin;

drop function if exists public.list_self_program_request_history();

-- Exact pre-H behavior. Applying this recovery also restores the documented
-- service-role incompatibility and therefore requires rolling back the app/Edge
-- release as one unit.
create or replace function public.assert_document_requirement_scope(p_scope_type text,p_scope_key text)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare v_type text:=upper(btrim(coalesce(p_scope_type,'')));v_key text:=btrim(coalesce(p_scope_key,''));v_row jsonb;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  if v_type='PROGRAM' and v_key='prestamo' then
    return jsonb_build_object('scope_type',v_type,'scope_key',v_key,'label','Suti Prestamo','parent_scope_type',null,'parent_scope_key',null);
  elsif v_type='PROGRAM' then
    select jsonb_build_object('scope_type',v_type,'scope_key',i.id::text,'label',i.name,'parent_scope_type',null,'parent_scope_key',null)
      into v_row from public.program_catalog_items i where i.id::text=v_key and i.enabled;
  elsif v_type='MEMBERSHIP' then
    select jsonb_build_object('scope_type',v_type,'scope_key',m.id::text,'label',m.company_raw||' - '||m.concept,'parent_scope_type',null,'parent_scope_key',null)
      into v_row from public.membership_offerings m where m.id::text=v_key and m.enabled;
  elsif v_type='COMPANY' then
    select jsonb_build_object('scope_type',v_type,'scope_key',c.id::text,'label',c.display_name,'parent_scope_type',null,'parent_scope_key',null)
      into v_row from public.companies c where c.id::text=v_key and c.enabled;
  elsif v_type='PRODUCT' then
    select jsonb_build_object('scope_type',v_type,'scope_key',p.id::text,'label',p.name,'parent_scope_type','COMPANY','parent_scope_key',p.company_id::text)
      into v_row from public.marketplace_products p join public.companies c on c.id=p.company_id and c.enabled
      where p.id::text=v_key and p.enabled;
  elsif v_type='SERVICE' then
    raise exception 'DOCUMENT_SCOPE_NOT_AVAILABLE' using errcode='22023';
  else
    raise exception 'INVALID_DOCUMENT_SCOPE' using errcode='22023';
  end if;
  if v_row is null then raise exception 'DOCUMENT_SCOPE_NOT_AVAILABLE' using errcode='22023'; end if;
  return v_row;
end $$;

notify pgrst,'reload schema';
commit;
