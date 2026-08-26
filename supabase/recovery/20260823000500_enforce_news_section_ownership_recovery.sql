begin;

-- Disable the pilot before restoring the preceding Phase 2 authorization.
update public.admin_section_definitions set enforcement_status='DESIGN_ONLY',updated_at=now()
where section_key='news';

revoke execute on function public.list_section_responsibility_audit(text) from authenticated;
revoke execute on function public.list_section_responsibilities(text) from authenticated;
revoke execute on function public.resolve_section_responsibility_user(text) from authenticated;
drop function if exists public.list_section_responsibility_audit(text);
drop function if exists public.list_section_responsibilities(text);
drop function if exists public.resolve_section_responsibility_user(text);

drop policy if exists news_section_storage_delete on storage.objects;
drop policy if exists news_section_storage_update on storage.objects;
drop policy if exists news_section_storage_insert on storage.objects;
drop policy if exists asset_sources_news_insert on public.asset_sources;
drop policy if exists app_assets_news_delete on public.app_assets;
drop policy if exists app_assets_news_update on public.app_assets;
drop policy if exists app_assets_news_insert on public.app_assets;

drop policy if exists news_settings_admin_update on public.news_settings;
create policy news_settings_admin_update on public.news_settings for update to authenticated
using (public.has_admin_permission('news.write')) with check (public.has_admin_permission('news.write'));

drop policy if exists news_admin_delete on public.news_articles;
drop policy if exists news_admin_update on public.news_articles;
drop policy if exists news_admin_insert on public.news_articles;
drop policy if exists news_admin_read on public.news_articles;
create policy news_admin_read on public.news_articles for select to authenticated
using (public.has_admin_permission('news.read'));
create policy news_admin_write on public.news_articles for all to authenticated
using (public.has_admin_permission('news.write')) with check (public.has_admin_permission('news.write'));

drop trigger if exists news_articles_section_action_audit on public.news_articles;
drop trigger if exists news_articles_action_guard on public.news_articles;
drop function if exists public.audit_news_section_action();
drop function if exists public.enforce_news_section_action();
drop function if exists public.news_article_required_actions(public.news_articles,public.news_articles,text);

commit;
