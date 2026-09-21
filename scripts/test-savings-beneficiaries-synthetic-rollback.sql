-- Synthetic fixtures only. Never remove the transaction/ROLLBACK wrapper. No DDL.
BEGIN;
SET LOCAL statement_timeout='30s';
do $test$
declare a record;b record;qa_users uuid[]:=array[extensions.gen_random_uuid(),extensions.gen_random_uuid()];qa_affs uuid[]:=array[extensions.gen_random_uuid(),extensions.gen_random_uuid()];qa_parts uuid[]:=array[extensions.gen_random_uuid(),extensions.gen_random_uuid()];i integer;ctx jsonb;prep jsonb;res jsonb;next_prep jsonb;race jsonb;
 expected uuid;idem uuid:=extensions.gen_random_uuid();denied boolean;v jsonb;before_finance jsonb;old_count bigint;
begin
 -- Two new synthetic identities, visible only inside this rolled-back transaction.
 for i in 1..2 loop
  insert into auth.users(id,email,email_confirmed_at) values(qa_users[i],qa_users[i]::text||'@example.invalid',now());
  insert into public.affiliates(id,auth_user_id,numero_control,historical_email_normalized,auth_eligibility,record_origin)
   values(qa_affs[i],qa_users[i],'QA-BEN-'||qa_affs[i]::text,qa_users[i]::text||'@example.invalid','eligible','ADMIN_AFFILIATES');
  insert into public.savings_participants(id,affiliate_id,legacy_folio,participant_type,identity_status)
   values(qa_parts[i],qa_affs[i],'QA-BEN-'||qa_affs[i]::text,'AFFILIATE','RESOLVED');
 end loop;
 select qa_affs[1] id,qa_users[1] auth_user_id,qa_parts[1] participant into a;
 select qa_affs[2] id,qa_users[2] auth_user_id,qa_parts[2] participant into b;
 before_finance:=jsonb_build_array((select count(*) from public.savings_transactions),(select count(*) from public.savings_requests),(select mode from public.savings_publication_state where id));
 perform set_config('request.jwt.claim.sub',a.auth_user_id::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',a.auth_user_id,'role','authenticated','session_id',extensions.gen_random_uuid())::text,true);
 perform set_config('role','authenticated',true);
 ctx:=public.get_self_savings_beneficiaries();expected:=(ctx->>'version_id')::uuid;
 IF ((ctx->>'affiliate_id')::uuid=a.id and (ctx->>'can_edit')::boolean) IS DISTINCT FROM true THEN RAISE EXCEPTION 'BENEFICIARY_TEST_FAILED: self context'; END IF;
 v:='[{"full_name":"Persona de prueba A","relationship":null,"percentage":33.33},{"full_name":"Persona de prueba B","percentage":66.67}]';
 prep:=public.prepare_self_savings_beneficiaries(v,expected,idem,a.id,repeat('a',64),200,true);
 IF (prep=public.prepare_self_savings_beneficiaries(v,expected,idem,a.id,repeat('a',64),200,true)) IS DISTINCT FROM true THEN RAISE EXCEPTION 'BENEFICIARY_TEST_FAILED: prepare idempotency'; END IF;
 denied:=false;begin perform public.commit_self_savings_beneficiaries(idem,a.id);exception when invalid_parameter_value then denied:=true;end;
 IF (denied) IS DISTINCT FROM true THEN RAISE EXCEPTION 'BENEFICIARY_TEST_FAILED: signature object required'; END IF;
 insert into storage.objects(bucket_id,name,owner_id,metadata) values('savings-beneficiary-signatures',prep->>'path',a.auth_user_id::text,'{"size":200,"mimetype":"image/png"}');
 res:=public.commit_self_savings_beneficiaries(idem,a.id);
 IF (res=public.commit_self_savings_beneficiaries(idem,a.id)) IS DISTINCT FROM true THEN RAISE EXCEPTION 'BENEFICIARY_TEST_FAILED: commit replay'; END IF;
 IF (jsonb_array_length(public.get_self_savings_beneficiaries()->'beneficiaries')=2) IS DISTINCT FROM true THEN RAISE EXCEPTION 'BENEFICIARY_TEST_FAILED: self list'; END IF;
 IF (public.savings_beneficiary_signature_access(prep->>'path',false)) IS DISTINCT FROM true THEN RAISE EXCEPTION 'BENEFICIARY_TEST_FAILED: owner signature read'; END IF;
 IF (not public.savings_beneficiary_signature_access(prep->>'path',true)) IS DISTINCT FROM true THEN RAISE EXCEPTION 'BENEFICIARY_TEST_FAILED: sealed upload'; END IF;
 denied:=false;begin perform public.replace_self_savings_beneficiaries(v,extensions.gen_random_uuid());exception when insufficient_privilege then denied:=true;end;
 IF (denied) IS DISTINCT FROM true THEN RAISE EXCEPTION 'BENEFICIARY_TEST_FAILED: unsigned old writer denied'; END IF;
 foreach v in array array['[{"full_name":"Exceso total A","percentage":60},{"full_name":"Exceso total B","percentage":41}]'::jsonb,
  '[{"full_name":"Exceso individual","percentage":101}]','[{"full_name":"Decimal inválido","percentage":33.333}]',
  '[{"full_name":"Porcentaje cero","percentage":0}]','[{"full_name":"Sin porcentaje"}]','null'] loop
  denied:=false;begin perform public.prepare_self_savings_beneficiaries(v,(res->>'version_id')::uuid,extensions.gen_random_uuid(),a.id,repeat('b',64),200,true);exception when invalid_parameter_value then denied:=true;end;
  IF (denied) IS DISTINCT FROM true THEN RAISE EXCEPTION 'BENEFICIARY_TEST_FAILED: invalid/over100 rejected'; END IF;
 end loop;
 denied:=false;begin perform public.prepare_self_savings_beneficiaries('[]',(res->>'version_id')::uuid,extensions.gen_random_uuid(),a.id,repeat('b',64),200,false);exception when invalid_parameter_value then denied:=true;end;
 IF (denied) IS DISTINCT FROM true THEN RAISE EXCEPTION 'BENEFICIARY_TEST_FAILED: consent required'; END IF;
 denied:=false;begin perform public.prepare_self_savings_beneficiaries('[]',(res->>'version_id')::uuid,idem,a.id,repeat('b',64),200,true);exception when invalid_parameter_value then denied:=true;end;
 IF (denied) IS DISTINCT FROM true THEN RAISE EXCEPTION 'BENEFICIARY_TEST_FAILED: idempotency payload conflict'; END IF;
 next_prep:=public.prepare_self_savings_beneficiaries('[{"full_name":"Edición con menos de cien","percentage":75}]',(res->>'version_id')::uuid,extensions.gen_random_uuid(),a.id,repeat('c',64),200,true);
 race:=public.prepare_self_savings_beneficiaries('[]',(res->>'version_id')::uuid,extensions.gen_random_uuid(),a.id,repeat('d',64),200,true);
 insert into storage.objects(bucket_id,name,owner_id,metadata) values('savings-beneficiary-signatures',next_prep->>'path',a.auth_user_id::text,'{"size":200,"mimetype":"image/png"}');
 perform public.commit_self_savings_beneficiaries((next_prep->>'authorization_id')::uuid,a.id);
 denied:=false;begin perform public.commit_self_savings_beneficiaries((race->>'authorization_id')::uuid,a.id);exception when serialization_failure then denied:=true;end;
 IF (denied) IS DISTINCT FROM true THEN RAISE EXCEPTION 'BENEFICIARY_TEST_FAILED: stale parallel draft rejected'; END IF;
 ctx:=public.get_self_savings_beneficiaries();
 IF ((ctx->'beneficiaries'->0->>'percentage')::numeric=75) IS DISTINCT FROM true THEN RAISE EXCEPTION 'BENEFICIARY_TEST_FAILED: less than100 accepted'; END IF;
 race:=public.prepare_self_savings_beneficiaries('[]',(ctx->>'version_id')::uuid,extensions.gen_random_uuid(),a.id,repeat('e',64),200,true);
 insert into storage.objects(bucket_id,name,owner_id,metadata) values('savings-beneficiary-signatures',race->>'path',a.auth_user_id::text,'{"size":200,"mimetype":"image/png"}');
 perform public.commit_self_savings_beneficiaries((race->>'authorization_id')::uuid,a.id);
 IF (jsonb_array_length(public.get_self_savings_beneficiaries()->'beneficiaries')=0) IS DISTINCT FROM true THEN RAISE EXCEPTION 'BENEFICIARY_TEST_FAILED: signed remove all'; END IF;
 perform set_config('role','none',true);
 IF (exists(select 1 from public.savings_beneficiary_versions where id=(res->>'version_id')::uuid and status='SUPERSEDED')) IS DISTINCT FROM true THEN RAISE EXCEPTION 'BENEFICIARY_TEST_FAILED: history kept'; END IF;
 IF ((select count(*)=2 from public.savings_beneficiaries where version_id=(res->>'version_id')::uuid)) IS DISTINCT FROM true THEN RAISE EXCEPTION 'BENEFICIARY_TEST_FAILED: historical names and percentages kept'; END IF;
 denied:=false;begin insert into public.savings_beneficiaries(version_id,full_name,percentage) values((res->>'version_id')::uuid,'Invalid administrative extra',1);exception when check_violation then denied:=true;end;
 IF (denied) IS DISTINCT FROM true THEN RAISE EXCEPTION 'BENEFICIARY_TEST_FAILED: database aggregate invariant'; END IF;
 perform set_config('request.jwt.claim.sub',b.auth_user_id::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',b.auth_user_id,'role','authenticated','session_id',extensions.gen_random_uuid())::text,true);
 perform set_config('role','authenticated',true);
 IF ((public.get_self_savings_beneficiaries()->>'affiliate_id')::uuid=b.id) IS DISTINCT FROM true THEN RAISE EXCEPTION 'BENEFICIARY_TEST_FAILED: second owner context'; END IF;
 IF (not exists(select 1 from storage.objects where bucket_id='savings-beneficiary-signatures' and name=prep->>'path')) IS DISTINCT FROM true THEN RAISE EXCEPTION 'BENEFICIARY_TEST_FAILED: cross-user storage denied'; END IF;
 IF (not public.savings_beneficiary_signature_access(prep->>'path',false)) IS DISTINCT FROM true THEN RAISE EXCEPTION 'BENEFICIARY_TEST_FAILED: cross-user signing denied'; END IF;
 denied:=false;begin perform public.commit_self_savings_beneficiaries(idem,b.id);exception when insufficient_privilege then denied:=true;end;
 IF (denied) IS DISTINCT FROM true THEN RAISE EXCEPTION 'BENEFICIARY_TEST_FAILED: cross-user commit denied'; END IF;
 denied:=false;begin perform public.prepare_self_savings_beneficiaries('[]',null,extensions.gen_random_uuid(),a.id,repeat('f',64),200,true);exception when insufficient_privilege then denied:=true;end;
 IF (denied) IS DISTINCT FROM true THEN RAISE EXCEPTION 'BENEFICIARY_TEST_FAILED: target spoof denied'; END IF;
 denied:=false;begin insert into storage.objects(bucket_id,name,owner_id,metadata) values('savings-beneficiary-signatures','unauthorized.png',b.auth_user_id::text,'{"size":200,"mimetype":"image/png"}');exception when insufficient_privilege then denied:=true;end;
 IF (denied) IS DISTINCT FROM true THEN RAISE EXCEPTION 'BENEFICIARY_TEST_FAILED: unreserved upload denied'; END IF;
 denied:=false;begin perform 1 from public.savings_beneficiary_import_rows;exception when insufficient_privilege then denied:=true;end;
 IF (denied) IS DISTINCT FROM true THEN RAISE EXCEPTION 'BENEFICIARY_TEST_FAILED: raw CSV not exposed'; END IF;
 denied:=false;begin perform 1 from public.savings_beneficiary_authorizations;exception when insufficient_privilege then denied:=true;end;
 IF (denied) IS DISTINCT FROM true THEN RAISE EXCEPTION 'BENEFICIARY_TEST_FAILED: raw authorization not exposed'; END IF;
 perform set_config('role','none',true);
 IF (not has_function_privilege('anon','public.get_self_savings_beneficiaries()','execute')) IS DISTINCT FROM true THEN RAISE EXCEPTION 'BENEFICIARY_TEST_FAILED: anon denied'; END IF;
 IF (before_finance=jsonb_build_array((select count(*) from public.savings_transactions),(select count(*) from public.savings_requests),(select mode from public.savings_publication_state where id))) IS DISTINCT FROM true THEN RAISE EXCEPTION 'BENEFICIARY_TEST_FAILED: financial state unchanged'; END IF;
end $test$;
select 'PASS' status,'synthetic self identities, 100/75/0, invalid totals, signatures, history, version conflict, retries, cross-user, anon, direct raw access, unchanged financial state' checks;

ROLLBACK;
