-- Run only inside BEGIN ... ROLLBACK; real identity resolvers, no permanent fixtures.
create function pg_temp.beneficiary_check(ok boolean,label text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'BENEFICIARY_TEST_FAILED: %',label;end if;end $$;
do $test$
declare a record;b record;ctx jsonb;prep jsonb;res jsonb;next_prep jsonb;race jsonb;
 expected uuid;idem uuid:=extensions.gen_random_uuid();denied boolean;v jsonb;before_finance jsonb;old_count bigint;
begin
 select f.id,f.auth_user_id,p.id participant into a from public.affiliates f join auth.users u on u.id=f.auth_user_id
 join public.savings_participants p on p.affiliate_id=f.id and p.legacy_folio=f.numero_control and p.identity_status='RESOLVED'
 where not coalesce(f.is_archived,false) and f.auth_eligibility='eligible' and u.email_confirmed_at is not null
 and lower(u.email)=f.historical_email_normalized and (select count(*) from public.affiliates x where x.historical_email_normalized=f.historical_email_normalized)=1
 and (select count(*) from public.affiliates x where x.numero_control=f.numero_control)=1
 and not exists(select 1 from public.admin_assignments x where x.auth_user_id=f.auth_user_id and x.enabled) limit 1;
 select f.id,f.auth_user_id,p.id participant into b from public.affiliates f join auth.users u on u.id=f.auth_user_id
 join public.savings_participants p on p.affiliate_id=f.id and p.legacy_folio=f.numero_control and p.identity_status='RESOLVED'
 where f.id<>a.id and not coalesce(f.is_archived,false) and f.auth_eligibility='eligible' and u.email_confirmed_at is not null
 and lower(u.email)=f.historical_email_normalized and (select count(*) from public.affiliates x where x.historical_email_normalized=f.historical_email_normalized)=1
 and (select count(*) from public.affiliates x where x.numero_control=f.numero_control)=1 limit 1;
 perform pg_temp.beneficiary_check(a.id is not null and b.id is not null,'two real resolved principals');
 before_finance:=jsonb_build_array((select count(*) from public.savings_transactions),(select count(*) from public.savings_requests),(select mode from public.savings_publication_state where id));
 perform set_config('request.jwt.claim.sub',a.auth_user_id::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',a.auth_user_id,'role','authenticated','session_id',extensions.gen_random_uuid())::text,true);
 perform set_config('role','authenticated',true);
 ctx:=public.get_self_savings_beneficiaries();expected:=(ctx->>'version_id')::uuid;
 perform pg_temp.beneficiary_check((ctx->>'affiliate_id')::uuid=a.id and (ctx->>'can_edit')::boolean,'self context');
 v:='[{"full_name":"Persona de prueba A","relationship":null,"percentage":33.33},{"full_name":"Persona de prueba B","percentage":66.67}]';
 prep:=public.prepare_self_savings_beneficiaries(v,expected,idem,a.id,repeat('a',64),200,true);
 perform pg_temp.beneficiary_check(prep=public.prepare_self_savings_beneficiaries(v,expected,idem,a.id,repeat('a',64),200,true),'prepare idempotency');
 denied:=false;begin perform public.commit_self_savings_beneficiaries(idem,a.id);exception when invalid_parameter_value then denied:=true;end;
 perform pg_temp.beneficiary_check(denied,'signature object required');
 insert into storage.objects(bucket_id,name,owner_id,metadata) values('savings-beneficiary-signatures',prep->>'path',a.auth_user_id::text,'{"size":200,"mimetype":"image/png"}');
 res:=public.commit_self_savings_beneficiaries(idem,a.id);
 perform pg_temp.beneficiary_check(res=public.commit_self_savings_beneficiaries(idem,a.id),'commit replay');
 perform pg_temp.beneficiary_check(jsonb_array_length(public.get_self_savings_beneficiaries()->'beneficiaries')=2,'self list');
 perform pg_temp.beneficiary_check(public.savings_beneficiary_signature_access(prep->>'path',false),'owner signature read');
 perform pg_temp.beneficiary_check(not public.savings_beneficiary_signature_access(prep->>'path',true),'sealed upload');
 denied:=false;begin perform public.replace_self_savings_beneficiaries(v,extensions.gen_random_uuid());exception when insufficient_privilege then denied:=true;end;
 perform pg_temp.beneficiary_check(denied,'unsigned old writer denied');
 foreach v in array array['[{"full_name":"Exceso total A","percentage":60},{"full_name":"Exceso total B","percentage":41}]'::jsonb,
  '[{"full_name":"Exceso individual","percentage":101}]','[{"full_name":"Decimal inválido","percentage":33.333}]',
  '[{"full_name":"Porcentaje cero","percentage":0}]','[{"full_name":"Sin porcentaje"}]','null'] loop
  denied:=false;begin perform public.prepare_self_savings_beneficiaries(v,(res->>'version_id')::uuid,extensions.gen_random_uuid(),a.id,repeat('b',64),200,true);exception when invalid_parameter_value then denied:=true;end;
  perform pg_temp.beneficiary_check(denied,'invalid/over100 rejected');
 end loop;
 denied:=false;begin perform public.prepare_self_savings_beneficiaries('[]',(res->>'version_id')::uuid,extensions.gen_random_uuid(),a.id,repeat('b',64),200,false);exception when invalid_parameter_value then denied:=true;end;
 perform pg_temp.beneficiary_check(denied,'consent required');
 denied:=false;begin perform public.prepare_self_savings_beneficiaries('[]',(res->>'version_id')::uuid,idem,a.id,repeat('b',64),200,true);exception when invalid_parameter_value then denied:=true;end;
 perform pg_temp.beneficiary_check(denied,'idempotency payload conflict');
 next_prep:=public.prepare_self_savings_beneficiaries('[{"full_name":"Edición con menos de cien","percentage":75}]',(res->>'version_id')::uuid,extensions.gen_random_uuid(),a.id,repeat('c',64),200,true);
 race:=public.prepare_self_savings_beneficiaries('[]',(res->>'version_id')::uuid,extensions.gen_random_uuid(),a.id,repeat('d',64),200,true);
 insert into storage.objects(bucket_id,name,owner_id,metadata) values('savings-beneficiary-signatures',next_prep->>'path',a.auth_user_id::text,'{"size":200,"mimetype":"image/png"}');
 perform public.commit_self_savings_beneficiaries((next_prep->>'authorization_id')::uuid,a.id);
 denied:=false;begin perform public.commit_self_savings_beneficiaries((race->>'authorization_id')::uuid,a.id);exception when serialization_failure then denied:=true;end;
 perform pg_temp.beneficiary_check(denied,'stale parallel draft rejected');
 ctx:=public.get_self_savings_beneficiaries();
 perform pg_temp.beneficiary_check((ctx->'beneficiaries'->0->>'percentage')::numeric=75,'less than100 accepted');
 race:=public.prepare_self_savings_beneficiaries('[]',(ctx->>'version_id')::uuid,extensions.gen_random_uuid(),a.id,repeat('e',64),200,true);
 insert into storage.objects(bucket_id,name,owner_id,metadata) values('savings-beneficiary-signatures',race->>'path',a.auth_user_id::text,'{"size":200,"mimetype":"image/png"}');
 perform public.commit_self_savings_beneficiaries((race->>'authorization_id')::uuid,a.id);
 perform pg_temp.beneficiary_check(jsonb_array_length(public.get_self_savings_beneficiaries()->'beneficiaries')=0,'signed remove all');
 perform set_config('role','none',true);
 perform pg_temp.beneficiary_check(exists(select 1 from public.savings_beneficiary_versions where id=(res->>'version_id')::uuid and status='SUPERSEDED'),'history kept');
 perform pg_temp.beneficiary_check((select count(*)=2 from public.savings_beneficiaries where version_id=(res->>'version_id')::uuid),'historical names and percentages kept');
 denied:=false;begin insert into public.savings_beneficiaries(version_id,full_name,percentage) values((res->>'version_id')::uuid,'Invalid administrative extra',1);exception when check_violation then denied:=true;end;
 perform pg_temp.beneficiary_check(denied,'database aggregate invariant');
 perform set_config('request.jwt.claim.sub',b.auth_user_id::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',b.auth_user_id,'role','authenticated','session_id',extensions.gen_random_uuid())::text,true);
 perform set_config('role','authenticated',true);
 perform pg_temp.beneficiary_check((public.get_self_savings_beneficiaries()->>'affiliate_id')::uuid=b.id,'second owner context');
 perform pg_temp.beneficiary_check(not exists(select 1 from storage.objects where bucket_id='savings-beneficiary-signatures' and name=prep->>'path'),'cross-user storage denied');
 perform pg_temp.beneficiary_check(not public.savings_beneficiary_signature_access(prep->>'path',false),'cross-user signing denied');
 denied:=false;begin perform public.commit_self_savings_beneficiaries(idem,b.id);exception when insufficient_privilege then denied:=true;end;
 perform pg_temp.beneficiary_check(denied,'cross-user commit denied');
 denied:=false;begin perform public.prepare_self_savings_beneficiaries('[]',null,extensions.gen_random_uuid(),a.id,repeat('f',64),200,true);exception when insufficient_privilege then denied:=true;end;
 perform pg_temp.beneficiary_check(denied,'target spoof denied');
 denied:=false;begin insert into storage.objects(bucket_id,name,owner_id,metadata) values('savings-beneficiary-signatures','unauthorized.png',b.auth_user_id::text,'{"size":200,"mimetype":"image/png"}');exception when insufficient_privilege then denied:=true;end;
 perform pg_temp.beneficiary_check(denied,'unreserved upload denied');
 denied:=false;begin perform 1 from public.savings_beneficiary_import_rows;exception when insufficient_privilege then denied:=true;end;
 perform pg_temp.beneficiary_check(denied,'raw CSV not exposed');
 denied:=false;begin perform 1 from public.savings_beneficiary_authorizations;exception when insufficient_privilege then denied:=true;end;
 perform pg_temp.beneficiary_check(denied,'raw authorization not exposed');
 perform set_config('role','none',true);
 perform pg_temp.beneficiary_check(not has_function_privilege('anon','public.get_self_savings_beneficiaries()','execute'),'anon denied');
 perform pg_temp.beneficiary_check(before_finance=jsonb_build_array((select count(*) from public.savings_transactions),(select count(*) from public.savings_requests),(select mode from public.savings_publication_state where id)),'financial state unchanged');
end $test$;
select 'PASS' status,'real self identities, 100/75/0, invalid totals, signatures, history, version conflict, retries, cross-user, anon, direct raw access, unchanged financial state' checks;
