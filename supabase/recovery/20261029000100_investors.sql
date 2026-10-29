-- Non-destructive withdrawal: retain every imported cell, document, movement and audit.
begin;
revoke execute on function public.get_admin_investors(uuid),public.save_admin_investors(text,jsonb,uuid),public.investors_document(uuid,jsonb,uuid) from authenticated;
revoke execute on function public.get_admin_investors_source(text,integer) from authenticated;
-- Restore frontend artifact from the release baseline. Re-enable only with an audited release.
commit;
