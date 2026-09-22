-- Isolated dependency contracts only. All identities below are synthetic.
create role anon; create role authenticated; create role service_role;
create schema auth; create schema extensions;
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.actor',true),'')::uuid$$;
create function auth.role() returns text language sql stable as $$select coalesce(nullif(current_setting('test.role',true),''),'authenticated')$$;
create function auth.jwt() returns jsonb language sql stable as $$select '{}'::jsonb$$;
create function extensions.gen_random_uuid() returns uuid language sql volatile as $$select gen_random_uuid()$$;
create function public.has_admin_permission(required_permission text) returns boolean language sql stable as
$$select coalesce(required_permission=any(string_to_array(current_setting('test.permissions',true),',')),false)$$;
create function public.normalize_suti_financial_key(p_value text) returns text language sql immutable as
$$select upper(regexp_replace(translate(btrim(coalesce(p_value,'')),'ÁÉÍÓÚÜÑáéíóúüñ','AEIOUUNAEIOUUN'),'\s+',' ','g'))$$;
create table public.affiliates(id uuid primary key,numero_control text,auth_user_id uuid,display_name text,full_name text,is_archived boolean default false);
create table public.savings_participants(id uuid primary key,affiliate_id uuid,identity_status text,certification_status text,data_classification text);
create table public.savings_enrollments(id uuid primary key,participant_id uuid,sequence_number int,status text,enrollment_started_at timestamptz,first_actual_contribution_date date,continue_saving boolean,terminated_at timestamptz,data_classification text);
create table public.savings_contribution_plans(id uuid primary key,enrollment_id uuid,amount numeric,effective_from date,effective_to date,data_classification text);
create table public.savings_balance_certifications(id uuid primary key,enrollment_id uuid,command jsonb,cutoff_on date);
create table public.savings_contribution_overrides(enrollment_id uuid,contribution_date date,actual_amount numeric,version_number int);
create function public.savings_enrollment_effective_status(p_status text,p_terminated_at timestamptz,p_as_of date) returns text language sql immutable as $$
select case when p_status in ('ACTIVE','TERMINATION_PENDING','TERMINATED') and (p_terminated_at at time zone 'America/Hermosillo')::date<=p_as_of then 'TERMINATED'
 when p_status in ('TERMINATION_PENDING','TERMINATED') and (p_terminated_at at time zone 'America/Hermosillo')::date>p_as_of then 'ACTIVE' else p_status end$$;
create table public.financial_funds(id uuid primary key,name text,code text);
create table public.financial_rules(id uuid primary key,fund_id uuid,legacy_criterion_identity text);
create table public.financial_session_snapshots(id uuid primary key,affiliate_id uuid,actor_real_auth_user_id uuid,impersonation_session_id uuid,financial_profile_version int,profile_fingerprint text,term_policy_fingerprint text,calculation_contract_version text,eligible_rules jsonb,expires_at timestamptz,invalidated_at timestamptz,invalidation_reason text,session_purpose text);
create table public.loan_term_policy(id text primary key,standard_terms int[],custom_min_term int,custom_step int,enabled boolean,decision_reference text);
create table public.program_requests(id uuid primary key,program_id text,affiliate_id uuid,actor_real_auth_user_id uuid,impersonation_session_id uuid,financial_submission_snapshot jsonb);

-- TESTS: migration and actual quote definition are installed by the JS harness.
insert into auth.users values('10000000-0000-0000-0000-000000000001'),('10000000-0000-0000-0000-000000000002');
insert into affiliates(id,numero_control,auth_user_id,full_name) values
 ('20000000-0000-0000-0000-000000000001','001','10000000-0000-0000-0000-000000000001','Test Admin'),
 ('20000000-0000-0000-0000-000000000002','002','10000000-0000-0000-0000-000000000002','Test Affiliate');
insert into financial_funds values('40000000-0000-0000-0000-000000000001','Nombre editable','caja-de-ahorro'),('40000000-0000-0000-0000-000000000002','Caja Chica','caja-chica');
insert into financial_rules values('30000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001',null),('30000000-0000-0000-0000-000000000002','40000000-0000-0000-0000-000000000002',null);
select set_config('test.actor','10000000-0000-0000-0000-000000000001',false);
select set_config('test.permissions','financial_rules.write,program_requests.write,workflow.write',false);
create function public.test_assert(ok boolean,label text) returns void language plpgsql as $$begin if ok is distinct from true then raise exception 'TEST_FAILED: %',label;end if;end$$;

do $$ declare af uuid:='20000000-0000-0000-0000-000000000002'; actor uuid:='10000000-0000-0000-0000-000000000001';
 participant uuid:=extensions.gen_random_uuid(); en uuid:=extensions.gen_random_uuid(); k uuid:=extensions.gen_random_uuid(); grant_key uuid;
 d jsonb; a uuid; request_id uuid:=extensions.gen_random_uuid(); today date:=(now() at time zone 'America/Hermosillo')::date;
 savings_snapshot jsonb:='{"criterion_identity":"SUPABASE_RULE:30000000-0000-0000-0000-000000000001","financialResult":{"fund":"Nombre editable"}}';
begin
 perform test_assert(savings_loan_eligibility(af)->>'eligible'='false','no saver denied');
 perform test_assert((get_admin_savings_loan_access('002')->'person'->>'id')=af::text,'exact control lookup');
 begin perform get_admin_savings_loan_access('02');raise exception 'FAIL_LOOKUP';exception when raise_exception then if sqlerrm<>'AFFILIATE_CONTROL_NOT_UNIQUE_OR_MISSING' then raise;end if;end;
 perform set_admin_savings_loan_policy(2,'FIRST_DEDUCTION',0,'Normativa aprobada',k);
 perform set_admin_savings_loan_policy(2,'FIRST_DEDUCTION',0,'Normativa aprobada',k);
 perform test_assert((select version=1 from savings_loan_policy),'policy retry idempotent');
 begin perform set_admin_savings_loan_policy(3,'FIRST_DEDUCTION',0,'Normativa aprobada',extensions.gen_random_uuid());raise exception 'FAIL_STALE';exception when raise_exception then if sqlerrm<>'SAVINGS_LOAN_POLICY_STALE' then raise;end if;end;
 begin perform set_admin_savings_loan_policy(3,'FIRST_DEDUCTION',0,'Normativa aprobada',k);raise exception 'FAIL_RETRY';exception when raise_exception then if sqlerrm<>'SAVINGS_LOAN_IDEMPOTENCY_CONFLICT' then raise;end if;end;
 begin perform set_admin_savings_loan_policy(-1,'FIRST_DEDUCTION',1,'Normativa aprobada',extensions.gen_random_uuid());raise exception 'FAIL_NEGATIVE';exception when raise_exception then if sqlerrm<>'SAVINGS_LOAN_POLICY_INVALID' then raise;end if;end;
 begin perform set_admin_savings_loan_policy(1,'OTHER',1,'Normativa aprobada',extensions.gen_random_uuid());raise exception 'FAIL_BASIS';exception when raise_exception then if sqlerrm<>'SAVINGS_LOAN_POLICY_INVALID' then raise;end if;end;
 insert into savings_participants values(participant,af,'RESOLVED','CERTIFIED','CANONICAL');
 insert into savings_enrollments values(en,participant,1,'ACTIVE',(today-interval '3 months')::timestamp at time zone 'America/Hermosillo',null,true,null,'CANONICAL');
 insert into savings_contribution_plans values(extensions.gen_random_uuid(),en,100,today-100,null,'CANONICAL');
 perform test_assert(savings_loan_eligibility(af)->>'reason'='NO_ACTUAL_DEDUCTION','active enrollment is not a receipt');
 update savings_enrollments set first_actual_contribution_date=today where id=en;
 perform test_assert(savings_loan_eligibility(af)->>'reason'='MINIMUM_TENURE','new saver needs exception');
 update savings_enrollments set first_actual_contribution_date=(today-interval '2 months')::date where id=en;
 perform test_assert(savings_loan_eligibility(af)->>'ordinary_eligible'='true','calendar minimum boundary eligible');
 update savings_enrollments set first_actual_contribution_date=(today-interval '2 months')::date+1 where id=en;
 perform test_assert(savings_loan_eligibility(af)->>'ordinary_eligible'='false','day before minimum denied');
 perform set_admin_savings_loan_policy(2,'ENROLLMENT',1,'Contar desde inscripción',extensions.gen_random_uuid());
 perform test_assert(savings_loan_eligibility(af)->>'ordinary_eligible'='true','configurable enrollment basis');
 perform set_admin_savings_loan_policy(13,'ENROLLMENT',2,'Trece meses configurables',extensions.gen_random_uuid());
 perform test_assert(savings_loan_eligibility(af)->>'ordinary_eligible'='false','arbitrary months beyond presets');
 perform set_admin_savings_loan_policy(0,'ENROLLMENT',3,'Eliminar espera mínima',extensions.gen_random_uuid());
 perform test_assert(savings_loan_eligibility(af)->>'ordinary_eligible'='true','zero months still saver');
 update savings_contribution_plans set effective_from=today+10 where enrollment_id=en;
 perform test_assert(savings_loan_eligibility(af)->>'ordinary_eligible'='true','certified ongoing saver keeps future next deduction plan');
 insert into savings_balance_certifications values(extensions.gen_random_uuid(),en,jsonb_build_object('first_date',today),today-1);
 perform test_assert(savings_loan_eligibility(af)->>'reason'='NO_ACTUAL_DEDUCTION','elapsed planned first date is not receipt evidence');
 insert into savings_contribution_overrides values(en,today,0,1);
 perform test_assert(savings_loan_eligibility(af)->>'reason'='NO_ACTUAL_DEDUCTION','zero confirmed deduction is not a first payment');
 insert into savings_contribution_overrides values(en,today,100,2);
 perform test_assert(savings_loan_eligibility(af)->>'ordinary_eligible'='true','positive actual deduction qualifies');
 insert into savings_contribution_overrides values(en,today,0,3);
 perform test_assert(savings_loan_eligibility(af)->>'reason'='NO_ACTUAL_DEDUCTION','latest zero correction removes false receipt evidence');
 delete from savings_balance_certifications where enrollment_id=en;
 delete from savings_contribution_overrides where enrollment_id=en;
 update savings_contribution_plans set effective_to=today-1 where enrollment_id=en;
 perform test_assert(savings_loan_eligibility(af)->>'eligible'='false','paused saver without current plan excluded');
 update savings_contribution_plans set effective_to=null where enrollment_id=en;
 update savings_enrollments set status='TERMINATED',continue_saving=false,terminated_at=(today+1)::timestamp at time zone 'America/Hermosillo' where id=en;
 perform test_assert(savings_loan_eligibility(af)->>'eligible'='true','future termination preserves current saver status');
 update savings_enrollments set terminated_at=today::timestamp at time zone 'America/Hermosillo' where id=en;
 perform test_assert(savings_loan_eligibility(af)->>'eligible'='false','termination effective today excluded');
 update savings_enrollments set status='ACTIVE',terminated_at=null where id=en;
 update savings_enrollments set continue_saving=false where id=en;
 perform test_assert(savings_loan_eligibility(af)->>'eligible'='false','stopped saver excluded regardless of old deductions');
 perform assert_savings_loan_quote_access(af,'caja--caja-chica--r1','[{"id":"caja--caja-chica--r1","status":"AVAILABLE"}]');
 begin perform assert_savings_loan_quote_access(af,'prestamo--caja-de-ahorro--r1','[{"id":"prestamo--caja-de-ahorro--r1","fund":"Nombre nuevo","status":"AVAILABLE"}]');raise exception 'FAIL_QUOTE_GATE';exception when raise_exception then if sqlerrm<>'FINANCIAL_PROGRAM_NOT_ELIGIBLE' then raise;end if;end;
 grant_key:=extensions.gen_random_uuid();
 d:=set_admin_savings_loan_authorization(af,'GRANT',null,'Excepción de caso específico',grant_key);
 perform set_admin_savings_loan_authorization(af,'GRANT',null,'Excepción de caso específico',grant_key);
 a:=(d#>>'{authorization,id}')::uuid;
 perform test_assert((select count(*)=1 from savings_loan_authorizations),'grant retry is one grant');
 perform test_assert(savings_loan_eligibility(af)->>'eligible'='true','exception allows non-saver');
 perform test_assert(savings_loan_eligibility('20000000-0000-0000-0000-000000000001')->>'eligible'='false','exception never crosses affiliate');
 perform assert_savings_loan_quote_access(af,'prestamo--caja-de-ahorro--r1','[{"id":"prestamo--caja-de-ahorro--r1","status":"AVAILABLE"}]');
 begin perform set_admin_savings_loan_authorization(af,'GRANT',null,'Otra autorización duplicada',extensions.gen_random_uuid());raise exception 'FAIL_DUPLICATE';exception when unique_violation then null;end;
 perform set_admin_savings_loan_authorization(af,'REVOKE',a,'Revocación antes del uso',extensions.gen_random_uuid());
 perform test_assert(savings_loan_eligibility(af)->>'eligible'='false','revocation immediate');
 begin insert into program_requests values(request_id,'prestamo',af,actor,null,savings_snapshot);raise exception 'FAIL_REVOKED_REQUEST';exception when raise_exception then if sqlerrm<>'FINANCIAL_PROGRAM_NOT_ELIGIBLE' then raise;end if;end;
 d:=set_admin_savings_loan_authorization(af,'GRANT',null,'Nueva autorización revisada',extensions.gen_random_uuid());a:=(d#>>'{authorization,id}')::uuid;
 insert into program_requests values(request_id,'prestamo',af,actor,null,savings_snapshot);
 perform test_assert((select used_request_id=request_id from savings_loan_authorizations where id=a),'grant consumed atomically');
 perform test_assert(savings_loan_eligibility(af)->>'eligible'='false','consumed grant unavailable');
 begin insert into program_requests values(extensions.gen_random_uuid(),'prestamo',af,actor,null,savings_snapshot);raise exception 'FAIL_SECOND_USE';exception when raise_exception then if sqlerrm<>'FINANCIAL_PROGRAM_NOT_ELIGIBLE' then raise;end if;end;
 insert into program_requests values(extensions.gen_random_uuid(),'prestamo',af,actor,null,'{"criterion_identity":"SUPABASE_RULE:30000000-0000-0000-0000-000000000002","financialResult":{"fund":"Caja Chica"}}');
 begin insert into program_requests values(extensions.gen_random_uuid(),'prestamo',af,actor,null,'{"financialResult":{"fund":"Nombre falsificado"}}');raise exception 'FAIL_UNKNOWN_FUND';exception when raise_exception then if sqlerrm<>'FINANCIAL_PROGRAM_NOT_ELIGIBLE' then raise;end if;end;
 perform test_assert((select count(*)=1 from savings_loan_access_events where action='USE' and actor_real_auth_user_id=actor and affiliate_id=af),'real actor and beneficiary logged once');
 -- A later authorized request deletion cannot resurrect or erase a used exception.
 delete from program_requests where id=request_id;
 perform test_assert((select used_request_id=request_id from savings_loan_authorizations where id=a),'deletion retains consumed authorization');
 perform test_assert((select count(*)=1 from savings_loan_access_events ev where ev.action='USE' and ev.authorization_id=a and ev.request_id is not null),'deletion retains evidence');
 perform test_assert(savings_loan_eligibility(af)->>'eligible'='false','deleted request does not restore grant');
 begin update savings_loan_access_events set reason='Alterado';raise exception 'FAIL_HISTORY';exception when raise_exception then if sqlerrm<>'SAVINGS_LOAN_AUDIT_IMMUTABLE' then raise;end if;end;
 perform test_assert((get_admin_savings_loan_access('002')->'history'->0->>'actor_label')='Test Admin','human readable responsible');
end $$;

-- Real PostgreSQL roles/ACL, not simulated frontend visibility.
set role authenticated;
do $$begin
 begin perform public.savings_loan_eligibility('20000000-0000-0000-0000-000000000002');raise exception 'FAIL_PRIVATE_READER';exception when insufficient_privilege then null;end;
 begin perform * from public.savings_loan_authorizations;raise exception 'FAIL_DIRECT_READ';exception when insufficient_privilege then null;end;
 begin update public.savings_loan_policy set minimum_months=0;raise exception 'FAIL_DIRECT_WRITE';exception when insufficient_privilege then null;end;
 perform set_config('test.permissions','',false);
 begin perform public.get_admin_savings_loan_access('002');raise exception 'FAIL_UNAUTHORIZED';exception when insufficient_privilege then null;end;
 begin perform public.set_admin_savings_loan_policy(0,'ENROLLMENT',4,'No tengo permisos',gen_random_uuid());raise exception 'FAIL_POLICY_PERMISSION';exception when insufficient_privilege then null;end;
 perform set_config('test.permissions','program_requests.write',false);
 begin perform public.set_admin_savings_loan_authorization('20000000-0000-0000-0000-000000000002','GRANT',null,'No tengo permiso de flujo',gen_random_uuid());raise exception 'FAIL_GRANT_PERMISSION';exception when insufficient_privilege then null;end;
 begin perform public.set_admin_savings_loan_policy(1,'ENROLLMENT',4,'Sin permiso de flujo',gen_random_uuid());raise exception 'FAIL_PARTIAL_FINANCE_PERMISSION';exception when insufficient_privilege then null;end;
 perform set_config('test.permissions','program_requests.write,workflow.write',false);
 perform public.set_admin_savings_loan_policy(1,'FIRST_DEDUCTION',4,'Regla definida por Finanzas',gen_random_uuid());
end$$;
reset role;
set role anon;
do $$begin
 begin perform public.get_admin_savings_loan_access(null);raise exception 'FAIL_ANON';exception when insufficient_privilege then null;end;
end$$;
reset role;
select public.test_assert((select bool_and(relrowsecurity and relforcerowsecurity) from pg_class where relname in ('savings_loan_policy','savings_loan_authorizations','savings_loan_access_events','savings_loan_function_backup')),'forced RLS');
