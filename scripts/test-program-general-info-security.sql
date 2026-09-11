-- Real authenticated SQL role and an unprivileged identity; transaction rollback only.
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000099',true);
set local role authenticated;
do $$
declare n integer;denied boolean:=false;
begin
  if public.has_admin_permission('program_catalog.write') or public.has_admin_permission('workflow.write') then raise exception 'PRIVILEGED_TEST_CONTEXT';end if;
  select count(*) into n from public.finance_catalog_presentation where program_info is not null;
  if n<>14 then raise exception 'AUTHENTICATED_READ_FAILED';end if;
  update public.finance_catalog_presentation set label_override=label_override where item_key='auto';
  get diagnostics n=row_count;if n<>0 then raise exception 'DIRECT_UPDATE_ALLOWED';end if;
  begin perform public.save_program_general_info('auto',null,'{}');exception when insufficient_privilege then denied=true;end;
  if not denied then raise exception 'AFFILIATE_WRITE_ALLOWED';end if;
  denied=false;begin perform public.register_program_general_cover('forbidden','image/png',1,repeat('A',64));exception when insufficient_privilege then denied=true;end;
  if not denied then raise exception 'AFFILIATE_COVER_ALLOWED';end if;
  denied=false;begin
    insert into storage.objects(bucket_id,name) values('app-assets','program-general/'||auth.uid()::text||'/forbidden.png');
  exception when insufficient_privilege then denied=true;end;
  if not denied then raise exception 'AFFILIATE_STORAGE_ALLOWED';end if;
end $$;
set local role anon;
do $$
declare denied boolean:=false;
begin
  begin perform public.save_program_general_info('auto',null,'{}');exception when insufficient_privilege then denied=true;end;
  if not denied then raise exception 'ANON_WRITE_ALLOWED';end if;
end $$;
reset role;
select 'PASS' status,true authenticated_read,true direct_update_denied,true affiliate_write_denied,true affiliate_cover_denied,true anonymous_write_denied,0 business_writes;
