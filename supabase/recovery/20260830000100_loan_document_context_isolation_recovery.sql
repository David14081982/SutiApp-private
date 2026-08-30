begin;

do $$
begin
  if exists(select 1 from public.document_access_audit_log) then
    raise exception 'RECOVERY_BLOCKED_DOCUMENT_ACCESS_AUDIT_EXISTS';
  end if;
end $$;

revoke all on function public.list_effective_affiliate_documents(text),
  public.list_admin_affiliate_documents(uuid,text),
  public.authorize_self_document_preview(uuid,text),
  public.authorize_admin_document_preview(uuid,uuid,text)
from public,anon,authenticated;
drop function public.authorize_admin_document_preview(uuid,uuid,text);
drop function public.authorize_self_document_preview(uuid,text);
drop function public.list_admin_affiliate_documents(uuid,text);
drop function public.list_effective_affiliate_documents(text);
drop table public.document_access_audit_log;

commit;
