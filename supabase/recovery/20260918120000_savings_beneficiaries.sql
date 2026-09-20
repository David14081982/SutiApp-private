begin;
-- Non-destructive recovery. Preserve every version, authorization, source row and file.
-- Restore matching pre-release frontend separately. Do not re-enable unsigned writers.
revoke execute on function public.prepare_self_savings_beneficiaries(jsonb,uuid,uuid,uuid,text,integer,boolean),
 public.commit_self_savings_beneficiaries(uuid,uuid) from public,anon,authenticated,service_role;
drop policy if exists savings_beneficiary_signature_insert on storage.objects;
-- Existing restrictive insert guard still denies unreserved uploads; remove all insert
-- availability for this bucket even if another permissive policy is added later.
alter policy savings_beneficiary_signature_insert_guard on storage.objects
 with check(bucket_id<>'savings-beneficiary-signatures');
-- Reads and immutable records remain available. Re-enablement requires an audited release.
commit;
