begin;

create or replace function public.fail_financial_request_export(p_request_id uuid,p_payload_sha256 text,p_error_code text,p_error_message text,p_actor uuid)
returns void language plpgsql security definer set search_path=''
as $$
begin
  if coalesce(auth.role(),'')<>'service_role' then raise exception 'SERVICE_ROLE_REQUIRED' using errcode='42501'; end if;
  if length(btrim(coalesce(p_error_code,''))) not between 3 and 100 then raise exception 'EXPORT_ERROR_CODE_INVALID' using errcode='22023'; end if;
  update public.program_requests set financial_processing_status='failed',updated_at=now()
  where id=p_request_id and status='approved' and financial_processing_status='in_progress';
  update public.financial_request_export_audit set export_status='failed',error_code=btrim(p_error_code),
    error_message=left(btrim(coalesce(p_error_message,'')),500),last_actor_auth_user_id=p_actor,updated_at=now()
  where program_request_id=p_request_id and payload_sha256=p_payload_sha256 and export_status='in_progress';
end $$;

revoke execute on function public.fail_financial_request_export(uuid,text,text,text,uuid) from public,anon,authenticated;
grant execute on function public.fail_financial_request_export(uuid,text,text,text,uuid) to service_role;
notify pgrst, 'reload schema';
commit;
