-- H-SUTIAPP-VOTACIONES-CONSULTAS-004. Runs BEFORE the forward migration, inside the transaction that always rolls back
-- (scripts/voting-consultas-backend.js). Captures what the existing consultations return today so the matrix can prove
-- they are unchanged after the migration and after the recovery. Nothing here is printed: exports carry personal data.
create function pg_temp.vc_check(ok boolean,label text) returns void language plpgsql as $$ begin if ok is distinct from true then raise exception 'CHECK_FAILED:%',label; end if; end $$;
create function pg_temp.vc_as(uid uuid,session text) returns void language plpgsql as $$ begin
 perform set_config('request.jwt.claim.sub',uid::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',uid,'role','authenticated','session_id',session)::text,true);
end $$;
-- Runs one statement and returns 'OK' or 'SQLSTATE:message' (the statement's own writes are undone on error).
create function pg_temp.vc_err(stmt text) returns text language plpgsql as $$ begin execute stmt; return 'OK'; exception when others then return sqlstate||':'||sqlerrm; end $$;
-- Removes only the keys this H adds, so an item read after the migration can be compared with the captured one.
create function pg_temp.vc_strip(x jsonb) returns jsonb language sql immutable as $$
 select (x-'presentation')||jsonb_build_object('questions',coalesce((select jsonb_agg((q-'answer_kind'-'options'-'final')
   ||case when jsonb_typeof(q->'results')='object' then jsonb_build_object('results',(q->'results')-'counts') else '{}'::jsonb end
   ||case when jsonb_typeof(q->'mine')='object' then jsonb_build_object('mine',(q->'mine')-'answer_text') else '{}'::jsonb end order by t.n)
  from jsonb_array_elements(x->'questions') with ordinality t(q,n)),'[]'::jsonb));
$$;
-- Original columns only, so the fingerprint is comparable before and after the new columns exist.
create function pg_temp.vc_rows() returns jsonb language sql stable as $$
 select jsonb_build_object(
  'consultations',(select md5(coalesce(string_agg(row(t.id,t.title,t.closes_on,t.electorate,t.published,t.audience,t.archived_at,t.version,t.created_by,t.created_at,t.updated_at)::text,'|' order by t.id),'')) from public.voting_consultations t),
  'questions',(select md5(coalesce(string_agg(row(t.id,t.consultation_id,t.title,t.detail,t.sort_order,t.archived_at)::text,'|' order by t.id),'')) from public.voting_questions t),
  'votes',(select md5(coalesce(string_agg(row(t.id,t.consultation_id,t.question_id,t.affiliate_id,t.actor_auth_user_id,t.answer,t.folio,t.cast_at,t.identity_snapshot)::text,'|' order by t.id),'')) from public.voting_votes t),
  'live',(select md5(coalesce(string_agg(t::text,'|' order by t.consultation_id),'')) from public.voting_live_state t),
  'counts',jsonb_build_array((select count(*) from public.voting_consultations),(select count(*) from public.voting_questions),(select count(*) from public.voting_votes)));
$$;

create temporary table vc_who(actor uuid,a uuid,normal uuid,b uuid);
insert into vc_who(actor,a,normal,b)
 select aa.auth_user_id,a.id,b.auth_user_id,b.id from public.admin_assignments aa join public.admin_roles r on r.id=aa.role_id and r.code='principal_admin' join public.affiliates a on a.auth_user_id=aa.auth_user_id
 cross join lateral(select f.id,f.auth_user_id from public.affiliates f join auth.users u on u.id=f.auth_user_id where f.auth_user_id<>aa.auth_user_id and not f.is_archived and u.email_confirmed_at is not null and not exists(select 1 from public.admin_assignments x where x.auth_user_id=f.auth_user_id and x.enabled) limit 1) b
 where aa.enabled limit 1;
create temporary table vc_checks(label text primary key);
create temporary table vc_before(id uuid primary key,admin_item jsonb not null,results jsonb not null,identified jsonb not null);
create temporary table vc_before_aff(id uuid primary key,item jsonb not null);
create temporary table vc_fn_before as select p.oid::regprocedure::text sig,md5(pg_get_functiondef(p.oid)) md5,p.proacl::text acl from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like '%voting%';
create temporary table vc_rows_before as select pg_temp.vc_rows() fingerprint;

do $$declare s record; r jsonb;
begin
 select * into s from vc_who;
 perform pg_temp.vc_check(s.actor is not null and s.normal is not null,'test_principals');
 perform pg_temp.vc_as(s.actor,'vc-capture-admin');
 r:=public.list_voting_consultations(true);
 insert into vc_before(id,admin_item,results,identified)
  select (x->>'id')::uuid,x,public.export_voting_consultation((x->>'id')::uuid,false),public.export_voting_consultation((x->>'id')::uuid,true) from jsonb_array_elements(r->'consultations') x;
 perform pg_temp.vc_check((select count(*) from vc_before)=(select count(*) from public.voting_consultations where archived_at is null),'capture_all_consultations');
 perform pg_temp.vc_as(s.normal,'vc-capture-normal');
 r:=public.list_voting_consultations(false);
 insert into vc_before_aff(id,item) select (x->>'id')::uuid,x from jsonb_array_elements(r->'consultations') x;
end $$;
