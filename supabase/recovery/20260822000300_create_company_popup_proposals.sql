begin;
do $$ begin
  if exists(select 1 from public.company_popup_proposals where status='approved') then
    raise exception 'RECOVERY_BLOCKED: approved popup proposals exist; export proposal and linked popup rows before rollback';
  end if;
end $$;
drop function if exists public.review_company_popup_proposal(uuid,boolean,text);
drop table if exists public.company_popup_proposals;
commit;
