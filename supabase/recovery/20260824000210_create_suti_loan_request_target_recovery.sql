begin;
do $$ begin
  if exists(select 1 from public.program_requests where program_item_id='7e8c1f55-a5e3-4e5f-9f3b-6d9524725bc3') then
    raise exception 'RECOVERY_BLOCKED_SUTI_LOAN_REQUESTS_EXIST';
  end if;
end $$;
delete from public.program_catalog_items where id='7e8c1f55-a5e3-4e5f-9f3b-6d9524725bc3' and record_origin='OWNER_DECISION_2026_08_24';
alter table public.program_catalog_items drop constraint program_catalog_items_program_check;
alter table public.program_catalog_items add constraint program_catalog_items_program_check check (
  program_key in ('auto','renta','casa','terrenos','solar','aires','puertas','computo','farma','tours','donativos')
);
commit;
