begin;

alter table public.admin_assignments drop constraint admin_assignments_permissions_check;
alter table public.admin_assignments add constraint admin_assignments_permissions_check check (permissions <@ array[
  'assets.read','assets.write','companies.read','companies.write','popups.read','popups.write',
  'banners.read','banners.write','documents.read','documents.write','affiliates.read','affiliates.impersonate',
  'news.read','news.write','content.read','content.write','marketplace.read','marketplace.write',
  'marketplace.quotes.read','marketplace.quotes.write','memberships.read','memberships.write'
]::text[]);

do $$ declare admin_count integer;
begin
  select count(*) into admin_count from public.admin_assignments where enabled;
  if admin_count<>1 then raise exception 'PHASE4_ADMIN_PRECONDITION_FAILED: expected exactly one enabled assignment, found %',admin_count; end if;
  update public.admin_assignments set permissions=array(select distinct p from unnest(permissions||array['memberships.read','memberships.write']) p),updated_at=now() where enabled;
end $$;

create table public.membership_offerings (
  id uuid primary key default extensions.gen_random_uuid(),
  company_raw text not null check(length(btrim(company_raw)) between 1 and 160),
  concept text not null check(length(btrim(concept)) between 1 and 300),
  amount numeric(14,2) not null check(amount>0),
  installments integer not null check(installments between 1 and 120),
  logo_asset_id uuid null references public.app_assets(id) on delete restrict,
  enabled boolean not null default true,
  sort_order integer not null check(sort_order>0),
  record_origin text not null default 'ADMIN_PHASE4' check(record_origin in ('HISTORICAL_IMPORT','ADMIN_PHASE4')),
  source_sheet text null,
  source_row_ordinal integer null,
  source_row_id_raw text null,
  source_snapshot_hash text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint membership_offerings_history check(
    (record_origin='HISTORICAL_IMPORT' and source_sheet='Membresias' and source_row_ordinal>1 and source_row_id_raw is not null and source_snapshot_hash~'^[A-F0-9]{64}$')
    or (record_origin='ADMIN_PHASE4' and source_sheet is null and source_row_ordinal is null and source_row_id_raw is null and source_snapshot_hash is null)
  )
);
create unique index membership_offerings_historical_source_idx on public.membership_offerings(source_snapshot_hash,source_sheet,source_row_ordinal) where record_origin='HISTORICAL_IMPORT';
create index membership_offerings_public_sort_idx on public.membership_offerings(enabled,sort_order);
create trigger membership_offerings_updated_at before update on public.membership_offerings for each row execute function public.set_h0072_updated_at();
create trigger membership_offerings_admin_audit after insert or update or delete on public.membership_offerings for each row execute function public.audit_admin_write();

alter table public.membership_offerings enable row level security;
alter table public.membership_offerings force row level security;
revoke all on public.membership_offerings from public,anon,authenticated;
grant select on public.membership_offerings to anon,authenticated;
grant insert,update,delete on public.membership_offerings to authenticated;
create policy membership_offerings_public_read on public.membership_offerings for select to anon,authenticated using(enabled or public.has_admin_permission('memberships.read'));
create policy membership_offerings_admin_write on public.membership_offerings for all to authenticated using(public.has_admin_permission('memberships.write')) with check(public.has_admin_permission('memberships.write'));

insert into public.membership_offerings(company_raw,concept,amount,installments,enabled,sort_order,record_origin,source_sheet,source_row_ordinal,source_row_id_raw,source_snapshot_hash) values
('Bud Tv Ultra','Películas y series',200,2,true,1,'HISTORICAL_IMPORT','Membresias',2,'mWWO3HYPSzSlyyrzN33YEQ','1098C6D59E933DC6EF85E043BA736CA216A2356B517A1C56DBB2F51334A9DEA6'),
('RiveraGas','Vales',350,2,true,2,'HISTORICAL_IMPORT','Membresias',3,'a.O67gNqgTCiA.CIdEHhDOA','1098C6D59E933DC6EF85E043BA736CA216A2356B517A1C56DBB2F51334A9DEA6'),
('Sams Club','Solicitud de membresia',350,2,true,3,'HISTORICAL_IMPORT','Membresias',4,'iWHgZjhmQYSUJPVmeGxniw','1098C6D59E933DC6EF85E043BA736CA216A2356B517A1C56DBB2F51334A9DEA6'),
('Costco','Solicitud de membresia',350,2,true,4,'HISTORICAL_IMPORT','Membresias',5,'xwNe7cFYR1-L7lBO9v8UWg','1098C6D59E933DC6EF85E043BA736CA216A2356B517A1C56DBB2F51334A9DEA6'),
('Casa Ley','Vales',1100,2,true,5,'HISTORICAL_IMPORT','Membresias',6,'GFnehVTfSr68fV.l7-XMWg','1098C6D59E933DC6EF85E043BA736CA216A2356B517A1C56DBB2F51334A9DEA6'),
('Arco gasolinera','Vale de gasolina',550,2,true,6,'HISTORICAL_IMPORT','Membresias',7,'ZtQZDWERSbe3a-IzvWkRhw','1098C6D59E933DC6EF85E043BA736CA216A2356B517A1C56DBB2F51334A9DEA6');

comment on table public.membership_offerings is 'Phase 4 membership catalog only. Historical requests, payroll deductions, PII and documents remain protected Google legacy.';
commit;
