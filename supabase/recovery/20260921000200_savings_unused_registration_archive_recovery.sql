begin;
set local lock_timeout='2s';
-- Explicit data recovery restores the exact original UUIDs and provenance; never a runtime fallback.
do $$ declare batch record; t text; item jsonb; actual jsonb;begin
 for batch in select * from public.savings_registration_removal_archive
  where id in ('31adefe6-2b91-4b86-81f9-c9c832b4387d','c25d29da-493d-4a5d-8fbc-36947e3e8b46') order by created_at loop
  foreach t in array array['savings_participants','savings_review_records','savings_review_import_normalizations',
   'savings_balance_certifications','savings_beneficiary_versions','savings_beneficiaries',
   'savings_beneficiary_import_rows','savings_beneficiary_authorizations','savings_review_events',
   'savings_legacy_evidence','savings_audit_events'] loop
   for item in select value from jsonb_array_elements(coalesce(batch.snapshots->t,'[]')) loop
    if t='savings_review_import_normalizations' then
     execute format('select to_jsonb(x) from public.%I x where record_id=$1',t) into actual using (item->>'record_id')::uuid;
    else
     execute format('select to_jsonb(x) from public.%I x where id::text=$1',t) into actual using item->>'id';
    end if;
    if actual is not null and actual is distinct from item then raise exception 'SAVINGS_RECOVERY_CONFLICT %',t;end if;
    if actual is null then execute format('insert into public.%I select * from jsonb_populate_record(null::public.%I,$1)',t,t) using item;end if;
   end loop;
  end loop;
 end loop;
end $$;
-- The private archive remains immutable evidence of removal/recovery.
commit;
