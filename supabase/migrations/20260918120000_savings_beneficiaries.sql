begin;
-- H-SAVINGS-BENEFICIARIES-001. No financial publication, balance or identity writes.
alter table public.savings_beneficiary_versions alter column actor_real_auth_user_id drop not null;
alter table public.savings_beneficiary_versions add column origin text not null default 'SELF';
alter table public.savings_beneficiary_versions add constraint savings_beneficiary_origin_check
 check(origin in ('SELF','GLIDE_IMPORT') and (origin='GLIDE_IMPORT' or actor_real_auth_user_id is not null));
alter table public.savings_beneficiaries alter column relationship drop not null;

create table public.savings_beneficiary_import_rows(
 id uuid primary key default extensions.gen_random_uuid(),
 source_sha256 text not null check(source_sha256 ~ '^[a-f0-9]{64}$'),
 source_row integer not null check(source_row>=2),
 numero_control text not null, raw_record jsonb not null,
 status text not null check(status in ('IMPORTED','PENDING_REVIEW')),
 reason text not null, participant_id uuid references public.savings_participants(id),
 version_id uuid references public.savings_beneficiary_versions(id),
 signature_path text unique, signature_sha256 text,
 signature_status text not null check(signature_status in ('MISSING','STORED','UNAVAILABLE')),
 imported_at timestamptz not null default now(),
 unique(source_sha256,source_row),
 check((status='IMPORTED' and version_id is not null and participant_id is not null) or
       (status='PENDING_REVIEW' and version_id is null)),
 check((signature_status='STORED' and signature_path is not null and signature_sha256 ~ '^[a-f0-9]{64}$')
       or (signature_status<>'STORED' and signature_path is null and signature_sha256 is null))
);
create index savings_beneficiary_import_control on public.savings_beneficiary_import_rows(numero_control);
create table public.savings_beneficiary_authorizations(
 id uuid primary key,
 participant_id uuid not null references public.savings_participants(id),
 affiliate_id uuid not null references public.affiliates(id),
 actor_real_auth_user_id uuid not null references auth.users(id),
 expected_version_id uuid references public.savings_beneficiary_versions(id),
 version_id uuid unique references public.savings_beneficiary_versions(id),
 beneficiaries jsonb not null check(jsonb_typeof(beneficiaries)='array'),
 signature_path text not null unique,
 signature_sha256 text not null check(signature_sha256 ~ '^[a-f0-9]{64}$'),
 signature_size integer not null check(signature_size between 100 and 524288),
 consent_version text not null default 'SAVINGS_BENEFICIARIES_V1',
 accepted_at timestamptz not null default now(),
 committed_at timestamptz,
 check((version_id is null and committed_at is null) or (version_id is not null and committed_at is not null))
);
create index savings_beneficiary_authorizations_participant on public.savings_beneficiary_authorizations(participant_id);
alter table public.savings_beneficiary_import_rows enable row level security;
alter table public.savings_beneficiary_import_rows force row level security;
alter table public.savings_beneficiary_authorizations enable row level security;
alter table public.savings_beneficiary_authorizations force row level security;
revoke all on public.savings_beneficiary_import_rows,public.savings_beneficiary_authorizations from public,anon,authenticated;
grant select,insert,update on public.savings_beneficiary_import_rows to service_role;
grant select on public.savings_beneficiary_authorizations to service_role;

create function public.savings_beneficiary_self_participant() returns uuid
language plpgsql stable security definer set search_path='' as $$
declare af uuid:=public.get_effective_affiliate_id(); control text; pid uuid;
begin
 if auth.uid() is null or af is null then raise exception 'SAVINGS_AFFILIATE_REQUIRED' using errcode='42501';end if;
 select numero_control into control from public.affiliates where id=af and not coalesce(is_archived,false);
 if nullif(btrim(control),'') is null or (select count(*) from public.affiliates where numero_control=control)<>1 then
  raise exception 'SAVINGS_EXACT_IDENTITY_REQUIRED' using errcode='55000';end if;
 if exists(select 1 from public.savings_participants where (affiliate_id=af or legacy_folio=control)
   and (affiliate_id is distinct from af or legacy_folio is distinct from control or identity_status<>'RESOLVED')) then
  raise exception 'SAVINGS_EXACT_IDENTITY_REQUIRED' using errcode='55000';end if;
 select id into pid from public.savings_participants where affiliate_id=af and legacy_folio=control and identity_status='RESOLVED';
 if pid is null then raise exception 'SAVINGS_EXACT_IDENTITY_REQUIRED' using errcode='55000';end if;
 return pid;
end $$;

create function public.savings_validate_beneficiaries(p_rows jsonb) returns void
language plpgsql immutable set search_path='' as $$
declare item jsonb;total numeric:=0;
begin
 if jsonb_typeof(p_rows) is distinct from 'array' or jsonb_array_length(p_rows)>20 then
  raise exception 'SAVINGS_BENEFICIARIES_INVALID' using errcode='22023';end if;
 for item in select value from jsonb_array_elements(p_rows) loop
  if jsonb_typeof(item) is distinct from 'object' or jsonb_typeof(item->'full_name') is distinct from 'string'
    or length(btrim(item->>'full_name')) not between 3 and 180
    or jsonb_typeof(item->'percentage') is distinct from 'number' then
   raise exception 'SAVINGS_BENEFICIARIES_INVALID' using errcode='22023';end if;
  if (item->>'percentage')::numeric<=0 or (item->>'percentage')::numeric>100
    or (item->>'percentage')::numeric<>round((item->>'percentage')::numeric,2) then
   raise exception 'SAVINGS_BENEFICIARIES_INVALID' using errcode='22023';end if;
  if item ? 'relationship' and item->'relationship'<>'null'::jsonb and
   (jsonb_typeof(item->'relationship')<>'string' or length(btrim(item->>'relationship')) not between 2 and 80) then
   raise exception 'SAVINGS_BENEFICIARIES_INVALID' using errcode='22023';end if;
  total:=total+(item->>'percentage')::numeric;
 end loop;
 if total>100 then raise exception 'SAVINGS_BENEFICIARIES_OVER_100' using errcode='22023';end if;
end $$;

-- Defensive invariant even for administrative/import writers; serialize on parent.
create function public.savings_beneficiary_total_guard() returns trigger
language plpgsql security definer set search_path='' as $$
declare vid uuid;
begin
 for vid in select distinct x from unnest(array[case when TG_OP<>'INSERT' then OLD.version_id end,
   case when TG_OP<>'DELETE' then NEW.version_id end]) x where x is not null order by x loop
  perform 1 from public.savings_beneficiary_versions where id=vid for update;
  if (select coalesce(sum(percentage),0) from public.savings_beneficiaries where version_id=vid)>100 then
   raise exception 'SAVINGS_BENEFICIARIES_OVER_100' using errcode='23514';end if;
 end loop;
 return null;
end $$;
create constraint trigger savings_beneficiary_total after insert or update or delete on public.savings_beneficiaries
 deferrable initially immediate for each row execute function public.savings_beneficiary_total_guard();

create function public.get_self_savings_beneficiaries() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare pid uuid:=public.savings_beneficiary_self_participant(); vid uuid;control text;
begin
 select legacy_folio into control from public.savings_participants where id=pid;
 select id into vid from public.savings_beneficiary_versions where participant_id=pid and status='ACTIVE';
 return jsonb_build_object('actor_auth_user_id',auth.uid(),'affiliate_id',public.get_effective_affiliate_id(),
  'can_edit',true,'version_id',vid,
  'beneficiaries',coalesce((select jsonb_agg(jsonb_build_object('id',id,'full_name',full_name,'relationship',relationship,'percentage',percentage) order by created_at,id)
     from public.savings_beneficiaries where version_id=vid),'[]'),
  'pending_count',(select count(*) from public.savings_beneficiary_import_rows where numero_control=control and status='PENDING_REVIEW'),
  'signatures',coalesce((select jsonb_agg(jsonb_build_object('path',signature_path,'status','STORED'))
     from public.savings_beneficiary_authorizations where version_id=vid),'[]')||
    coalesce((select jsonb_agg(jsonb_build_object('path',signature_path,'status',signature_status) order by source_row)
     from public.savings_beneficiary_import_rows where version_id=vid),'[]'));
end $$;

create function public.prepare_self_savings_beneficiaries(p_beneficiaries jsonb,p_expected_version_id uuid,
 p_idempotency_key uuid,p_expected_affiliate_id uuid,p_signature_sha256 text,p_signature_size integer,p_accepted boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare pid uuid:=public.savings_beneficiary_self_participant(); af uuid:=public.get_effective_affiliate_id();
 a public.savings_beneficiary_authorizations%rowtype;current_id uuid;
begin
 if af is distinct from p_expected_affiliate_id then raise exception 'SAVINGS_CONTEXT_CHANGED' using errcode='42501';end if;
 if p_accepted is distinct from true or p_idempotency_key is null or p_signature_sha256 is null
  or p_signature_sha256!~'^[a-f0-9]{64}$' or p_signature_size is null or p_signature_size not between 100 and 524288 then
  raise exception 'SAVINGS_SIGNATURE_REQUIRED' using errcode='22023';end if;
 perform public.savings_validate_beneficiaries(p_beneficiaries);
 perform pg_advisory_xact_lock(hashtextextended('savings-beneficiary-authorization:'||p_idempotency_key,0));
 perform 1 from public.savings_participants where id=pid for update;
 select * into a from public.savings_beneficiary_authorizations where id=p_idempotency_key;
 if found then
  if a.participant_id<>pid or a.affiliate_id<>af or a.actor_real_auth_user_id<>auth.uid()
    or a.expected_version_id is distinct from p_expected_version_id or a.beneficiaries<>p_beneficiaries
    or a.signature_sha256<>p_signature_sha256 or a.signature_size<>p_signature_size then
   raise exception 'SAVINGS_IDEMPOTENCY_CONFLICT' using errcode='22023';end if;
 else
  select id into current_id from public.savings_beneficiary_versions where participant_id=pid and status='ACTIVE';
  if current_id is distinct from p_expected_version_id then raise exception 'SAVINGS_BENEFICIARIES_STALE' using errcode='40001';end if;
  insert into public.savings_beneficiary_authorizations(id,participant_id,affiliate_id,actor_real_auth_user_id,expected_version_id,
    beneficiaries,signature_path,signature_sha256,signature_size)
  values(p_idempotency_key,pid,af,auth.uid(),p_expected_version_id,p_beneficiaries,
    'authorizations/'||af||'/'||p_idempotency_key||'/'||extensions.gen_random_uuid()||'.png',p_signature_sha256,p_signature_size) returning * into a;
 end if;
 return jsonb_build_object('authorization_id',a.id,'bucket','savings-beneficiary-signatures','path',a.signature_path,
  'committed',a.version_id is not null,'actor_auth_user_id',auth.uid(),'affiliate_id',af);
end $$;

create function public.commit_self_savings_beneficiaries(p_authorization_id uuid,p_expected_affiliate_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare pid uuid:=public.savings_beneficiary_self_participant();af uuid:=public.get_effective_affiliate_id();
 a public.savings_beneficiary_authorizations%rowtype;vid uuid;version_no integer;meta jsonb;
begin
 if af is distinct from p_expected_affiliate_id then raise exception 'SAVINGS_CONTEXT_CHANGED' using errcode='42501';end if;
 perform 1 from public.savings_participants where id=pid for update;
 select * into a from public.savings_beneficiary_authorizations where id=p_authorization_id for update;
 if a.id is null or a.participant_id<>pid or a.affiliate_id<>af or a.actor_real_auth_user_id<>auth.uid() then
  raise exception 'SAVINGS_AUTHORIZATION_DENIED' using errcode='42501';end if;
 if a.version_id is not null then return jsonb_build_object('version_id',a.version_id,'actor_auth_user_id',auth.uid(),'affiliate_id',af);end if;
 select id into vid from public.savings_beneficiary_versions where participant_id=pid and status='ACTIVE';
 if vid is distinct from a.expected_version_id then raise exception 'SAVINGS_BENEFICIARIES_STALE' using errcode='40001';end if;
 select metadata into meta from storage.objects where bucket_id='savings-beneficiary-signatures'
  and name=a.signature_path and owner_id=auth.uid()::text;
 if meta is null or meta->>'mimetype' is distinct from 'image/png' or (meta->>'size')::bigint is distinct from a.signature_size then
  raise exception 'SAVINGS_SIGNATURE_UPLOAD_REQUIRED' using errcode='22023';end if;
 perform public.savings_validate_beneficiaries(a.beneficiaries);
 select coalesce(max(version_number),0)+1 into version_no from public.savings_beneficiary_versions where participant_id=pid;
 update public.savings_beneficiary_versions set status='SUPERSEDED',superseded_at=clock_timestamp() where id=vid;
 insert into public.savings_beneficiary_versions(participant_id,version_number,status,actor_real_auth_user_id,origin)
 values(pid,version_no,'ACTIVE',auth.uid(),'SELF') returning id into vid;
 insert into public.savings_beneficiaries(version_id,full_name,relationship,percentage)
 select vid,btrim(x->>'full_name'),nullif(btrim(x->>'relationship'),''),(x->>'percentage')::numeric from jsonb_array_elements(a.beneficiaries)x;
 update public.savings_beneficiary_authorizations set version_id=vid,committed_at=clock_timestamp() where id=a.id;
 insert into public.savings_audit_events(actor_real_auth_user_id,usuario_contexto_affiliate_id,participant_id,resource,action,target_id,before_data,after_data,client_action_id)
 values(auth.uid(),af,pid,'savings_beneficiaries','SIGNED_REPLACE_VERSION',vid::text,
  jsonb_build_object('version_id',a.expected_version_id),jsonb_build_object('version_id',vid,'authorization_id',a.id,'total',
   (select coalesce(sum((x->>'percentage')::numeric),0) from jsonb_array_elements(a.beneficiaries)x)),a.id);
 return jsonb_build_object('version_id',vid,'actor_auth_user_id',auth.uid(),'affiliate_id',af);
end $$;

-- No unsigned legacy writer is left callable by the browser.
revoke execute on function public.replace_self_savings_beneficiaries(jsonb,uuid) from public,anon,authenticated,service_role;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('savings-beneficiary-signatures','savings-beneficiary-signatures',false,524288,array['image/png','image/jpeg']);
create function public.savings_beneficiary_signature_access(p_path text,p_upload boolean) returns boolean
language plpgsql stable security definer set search_path='' as $$
declare pid uuid;
begin
 if auth.uid() is null then return false;end if;
 begin pid:=public.savings_beneficiary_self_participant();exception when others then return false;end;
 if exists(select 1 from public.savings_beneficiary_authorizations a where a.signature_path=p_path and a.participant_id=pid
    and (not p_upload or a.version_id is null and a.actor_real_auth_user_id=auth.uid())) then return true;end if;
 if not p_upload then return exists(select 1 from public.savings_beneficiary_import_rows r where r.signature_path=p_path
   and r.participant_id=pid and r.status='IMPORTED' and r.signature_status='STORED');end if;
 return false;
end $$;
create policy savings_beneficiary_signature_read on storage.objects for select to authenticated
 using(bucket_id='savings-beneficiary-signatures' and public.savings_beneficiary_signature_access(name,false));
create policy savings_beneficiary_signature_insert on storage.objects for insert to authenticated
 with check(bucket_id='savings-beneficiary-signatures' and owner_id=auth.uid()::text and public.savings_beneficiary_signature_access(name,true));
-- Restrictive guards ensure unrelated permissive policies cannot open this bucket.
create policy savings_beneficiary_signature_read_guard on storage.objects as restrictive for select to public
 using(bucket_id<>'savings-beneficiary-signatures' or public.savings_beneficiary_signature_access(name,false));
create policy savings_beneficiary_signature_insert_guard on storage.objects as restrictive for insert to public
 with check(bucket_id<>'savings-beneficiary-signatures' or owner_id=auth.uid()::text and public.savings_beneficiary_signature_access(name,true));
create policy savings_beneficiary_signature_update_guard on storage.objects as restrictive for update to public
 using(bucket_id<>'savings-beneficiary-signatures') with check(bucket_id<>'savings-beneficiary-signatures');
create policy savings_beneficiary_signature_delete_guard on storage.objects as restrictive for delete to public
 using(bucket_id<>'savings-beneficiary-signatures');

revoke all on function public.savings_beneficiary_self_participant(),public.savings_validate_beneficiaries(jsonb),
 public.savings_beneficiary_total_guard(),public.get_self_savings_beneficiaries(),
 public.prepare_self_savings_beneficiaries(jsonb,uuid,uuid,uuid,text,integer,boolean),
 public.commit_self_savings_beneficiaries(uuid,uuid),public.savings_beneficiary_signature_access(text,boolean) from public,anon,authenticated,service_role;
grant execute on function public.get_self_savings_beneficiaries(),
 public.prepare_self_savings_beneficiaries(jsonb,uuid,uuid,uuid,text,integer,boolean),
 public.commit_self_savings_beneficiaries(uuid,uuid),public.savings_beneficiary_signature_access(text,boolean) to authenticated;
-- anon must be able to evaluate the restrictive predicate (which always returns false).
grant execute on function public.savings_beneficiary_signature_access(text,boolean) to anon;
commit;
