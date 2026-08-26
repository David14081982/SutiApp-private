begin;

-- Safe rollback: preserve every new request, disable new writes, and restore the former CTA boundary.
revoke execute on function public.create_program_request(uuid,uuid,integer,text,text,boolean,uuid) from authenticated;
revoke execute on function public.update_program_request(uuid,text,text) from authenticated;
revoke execute on function public.respond_program_request_quote(uuid,numeric,text,date) from authenticated;

update public.program_catalog_items
set request_mode=case when program_key='farma' then 'supabase' else 'legacy_pending' end,updated_at=now()
where enabled;

grant execute on function public.create_program_benefit_request(uuid,integer,text,text,boolean) to authenticated;
grant execute on function public.create_marketplace_quote(uuid,text,text,boolean) to authenticated;
grant execute on function public.create_marketplace_benefit_request(uuid,integer,text,text,boolean) to authenticated;

update public.admin_assignments
set permissions=array_remove(array_remove(permissions,'program_requests.write'),'program_requests.read'),updated_at=now()
where enabled;

-- program_requests intentionally remains as a read-only recovery archive; no submitted request is deleted.
commit;
