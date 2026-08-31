begin;

do $$ begin
  if exists(select 1 from public.loan_request_deposit_snapshots where source_bank_account_id is null) then
    raise exception 'RECOVERY_BLOCKED_OPTIONAL_DEPOSIT_HISTORY_EXISTS';
  end if;
end $$;

drop function public.create_validated_financial_program_request(uuid,uuid,uuid,uuid,text,text,uuid,uuid[],uuid,numeric,integer,text,integer,jsonb);
alter function public.create_validated_financial_program_request_bank_required(uuid,uuid,uuid,uuid,text,text,uuid,uuid[],uuid,numeric,integer,text,integer,jsonb)
  rename to create_validated_financial_program_request;
revoke all on function public.create_validated_financial_program_request(uuid,uuid,uuid,uuid,text,text,uuid,uuid[],uuid,numeric,integer,text,integer,jsonb)
  from public,anon,authenticated;
grant execute on function public.create_validated_financial_program_request(uuid,uuid,uuid,uuid,text,text,uuid,uuid[],uuid,numeric,integer,text,integer,jsonb)
  to service_role;

alter table public.loan_request_deposit_snapshots
  drop constraint loan_deposit_optional_bank_coherence,
  alter column source_bank_account_id set not null,
  alter column bank_name set not null,
  alter column account_holder set not null,
  alter column card_number set not null,
  alter column clabe set not null;

comment on table public.loan_request_deposit_snapshots is
  'Private immutable request-time deposit snapshot. It is not a bank-account authority and has no browser grants.';

notify pgrst, 'reload schema';
commit;
