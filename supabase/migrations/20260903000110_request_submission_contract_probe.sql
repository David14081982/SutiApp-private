begin;

create table public.request_submission_contract_probe_backup (
  migration_key text primary key check (migration_key='20260903000110'),
  applied_at timestamptz not null default now(),
  previous_definition text not null
);
alter table public.request_submission_contract_probe_backup enable row level security;
alter table public.request_submission_contract_probe_backup force row level security;
revoke all on table public.request_submission_contract_probe_backup from public,anon,authenticated;

insert into public.request_submission_contract_probe_backup(migration_key,previous_definition)
values('20260903000110',pg_get_functiondef('public.get_request_submission_backend_contract()'::regprocedure));

do $patch$
declare v_definition text;v_updated text;
begin
  select previous_definition into v_definition from public.request_submission_contract_probe_backup
   where migration_key='20260903000110';
  if position($old$v_constraint like '%clabe IS NULL OR is_valid_clabe(clabe)%'$old$ in v_definition)=0 then
    raise exception 'REQUEST_CONTRACT_PROBE_PRECONDITION_CHANGED';
  end if;
  v_updated:=replace(v_definition,
    $old$v_constraint like '%clabe IS NULL OR is_valid_clabe(clabe)%'$old$,
    $new$v_constraint like '%clabe IS NULL OR%is_valid_clabe(clabe)%'$new$);
  execute v_updated;
end $patch$;

notify pgrst,'reload schema';
commit;
