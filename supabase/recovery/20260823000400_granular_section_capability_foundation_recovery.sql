begin;

-- Exact recovery for the additive DESIGN_ONLY foundation. No content policy,
-- content row, technical role or historical audit row is changed.

revoke execute on function public.revoke_section_responsibilities(uuid,text) from authenticated;
revoke execute on function public.set_section_responsibilities(text,text,text[]) from authenticated;
revoke execute on function public.get_admin_access_context() from authenticated;
revoke execute on function public.has_section_action(text,text) from authenticated;
revoke select on public.admin_section_responsibilities, public.admin_section_definitions from authenticated;

drop policy if exists admin_section_responsibilities_authorized_read on public.admin_section_responsibilities;
drop policy if exists admin_section_definitions_authorized_read on public.admin_section_definitions;
drop trigger if exists admin_section_responsibilities_updated_at on public.admin_section_responsibilities;
drop trigger if exists admin_section_definitions_updated_at on public.admin_section_definitions;
drop function if exists public.revoke_section_responsibilities(uuid,text);
drop function if exists public.set_section_responsibilities(text,text,text[]);
drop function if exists public.get_admin_access_context();
drop function if exists public.has_section_action(text,text);
drop table if exists public.admin_section_responsibilities;
drop table if exists public.admin_section_definitions;

commit;
