-- Forward recovery: retain all sealed layouts/records, disable writes, use system layout for future events.
begin;
do $$ begin
 if md5((select prosrc from pg_proc where oid='document_private.resolve_configuration(text,text,timestamptz)'::regprocedure)) <> '295b358534dd62c900558dc8a013487f' then raise exception 'DOCUMENT_LAYOUT_RECOVERY_DRIFT';end if;
end $$;
revoke execute on function public.document_layout_persist(text,jsonb) from service_role;
create or replace function document_private.resolve_configuration(p_program text,p_type text,p_at timestamptz) returns jsonb language sql security definer set search_path='' as $$
 select document_private.resolve_configuration_without_layout(p_program,p_type,p_at);
$$;
notify pgrst,'reload schema';
commit;
