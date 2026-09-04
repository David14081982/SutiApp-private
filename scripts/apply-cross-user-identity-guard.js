'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const migrationPath = path.join(root, 'supabase/migrations/20260904000100_cross_user_identity_fail_closed.sql');
const recoveryPath = path.join(root, 'supabase/recovery/20260904000100_cross_user_identity_fail_closed_recovery.sql');
const migration = fs.readFileSync(migrationPath, 'utf8');
const recovery = fs.readFileSync(recoveryPath, 'utf8');

function env() {
  const values = {};
  for (const raw of fs.readFileSync(path.join(root, 'supabase.env'), 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/)) {
    const match = raw.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match) values[match[1]] = match[2].trim().replace(/^['"]|['"]$/g, '');
  }
  return values;
}

function body(sql) {
  const value = sql.trim();
  assert.match(value, /^begin;/i);
  assert.match(value, /commit;$/i);
  return value.replace(/^begin;\s*/i, '').replace(/\s*commit;$/i, '');
}

async function management(values, query) {
  const ref = new URL(values.SUPABASE_URL).hostname.split('.')[0];
  const response = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${values.SUPABASE_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
      'User-Agent': 'SutiApp-Cross-User-Identity-Guard/1.0',
    },
    body: JSON.stringify({ query }),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`MANAGEMENT_SQL_${response.status}:${JSON.stringify(data).slice(0, 1200)}`);
  return data;
}

const auditSql = `
select json_build_object(
  'auth_total',(select count(*) from auth.users),
  'affiliate_links',(select count(*) from public.affiliates where auth_user_id is not null),
  'wrong_links',(select count(*) from public.affiliates a join auth.users u on u.id=a.auth_user_id where u.email_confirmed_at is null or lower(btrim(u.email)) is distinct from a.historical_email_normalized),
  'multiple_links',(select count(*) from (select auth_user_id from public.affiliates where auth_user_id is not null group by auth_user_id having count(*)<>1) q),
  'ambiguous_linked',(select count(*) from public.affiliates a join auth.users u on u.id=a.auth_user_id where (select count(*) from public.affiliates d where d.historical_email_normalized=lower(btrim(u.email)))<>1),
  'duplicate_email_groups',(select count(*) from (select historical_email_normalized from public.affiliates where historical_email_normalized is not null group by historical_email_normalized having count(*)>1) q),
  'active_impersonations',(select count(*) from public.impersonation_sessions where ended_at is null and expires_at>now()),
  'successful_claims',(select count(*) from public.identity_audit_log where action='AFFILIATE_CLAIMED' and result='SUCCESS'),
  'claims_not_current_link',(select count(*) from public.identity_audit_log l left join public.affiliates a on a.id=l.usuario_contexto_affiliate_id and a.auth_user_id=l.actor_real_auth_user_id where l.action='AFFILIATE_CLAIMED' and l.result='SUCCESS' and a.id is null),
  'claim_actors_with_multiple_targets',(select count(*) from (select actor_real_auth_user_id from public.identity_audit_log where action='AFFILIATE_CLAIMED' and result='SUCCESS' group by actor_real_auth_user_id having count(distinct usuario_contexto_affiliate_id)>1) q)
) result;`;

const checks = String.raw`
do $matrix$
declare
  v_users uuid[];v_affiliates uuid[];v_emails text[];v_extra uuid;
  v_old_email text;v_old_eligibility text;v_old_reason text;v_state text;v_effective uuid;
  v_denied boolean:=false;i integer;
begin
  select array_agg(q.auth_user_id order by q.auth_user_id),array_agg(q.id order by q.auth_user_id),array_agg(q.email order by q.auth_user_id)
    into v_users,v_affiliates,v_emails
  from (
    select a.auth_user_id,a.id,lower(btrim(u.email)) email
    from public.affiliates a join auth.users u on u.id=a.auth_user_id
    where not a.is_archived and u.email_confirmed_at is not null
      and a.historical_email_normalized=lower(btrim(u.email))
      and (select count(*) from public.affiliates d where d.historical_email_normalized=lower(btrim(u.email)))=1
      and not exists(select 1 from public.admin_assignments x where x.auth_user_id=u.id and x.enabled)
      and not exists(select 1 from public.admin_section_responsibilities x where x.auth_user_id=u.id and x.enabled)
    order by a.auth_user_id limit 3
  ) q;
  if coalesce(array_length(v_users,1),0)<>3 then raise exception 'ABC_FIXTURE_MISSING'; end if;

  for i in 1..3 loop
    perform set_config('request.jwt.claims',jsonb_build_object('sub',v_users[i],'role','authenticated','session_id','identity-matrix-'||i)::text,true);
    v_state:=public.get_current_affiliate_access_state();v_effective:=public.get_effective_affiliate_id();
    if v_state<>'ACTIVE' or v_effective is distinct from v_affiliates[i] then raise exception 'ABC_EXACT_IDENTITY_FAILED_%',i; end if;
  end loop;

  select id,historical_email_normalized,auth_eligibility,auth_ineligibility_reason
    into v_extra,v_old_email,v_old_eligibility,v_old_reason
  from public.affiliates where id<>all(v_affiliates) and auth_user_id is null order by source_row_ordinal desc limit 1;
  if v_extra is null then raise exception 'D_AMBIGUOUS_FIXTURE_MISSING'; end if;
  update public.affiliates set historical_email_normalized=v_emails[1],auth_eligibility='duplicate_email',auth_ineligibility_reason='duplicate_email' where id=v_extra;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',v_users[1],'role','authenticated','session_id','identity-matrix-d')::text,true);
  if public.get_current_affiliate_access_state()<>'AMBIGUOUS_IDENTITY' or public.get_effective_affiliate_id() is not null then raise exception 'D_AMBIGUOUS_NOT_DENIED'; end if;
  begin perform public.claim_affiliate_identity(); exception when insufficient_privilege then v_denied:=position('AFFILIATE_IDENTITY_AMBIGUOUS' in sqlerrm)>0; end;
  if not v_denied then raise exception 'D_AMBIGUOUS_CLAIM_ALLOWED'; end if;
  update public.affiliates set historical_email_normalized=v_old_email,auth_eligibility=v_old_eligibility,auth_ineligibility_reason=v_old_reason where id=v_extra;

  update public.affiliates set auth_user_id=null where id=v_affiliates[1];
  if public.get_current_affiliate_access_state()<>'UNLINKED' or public.get_effective_affiliate_id() is not null then raise exception 'EF_UNLINKED_NOT_DENIED'; end if;
  update public.affiliates set auth_user_id=v_users[1] where id=v_affiliates[1];

  update public.affiliates set historical_email_normalized='identity-matrix-invalid@example.invalid' where id=v_affiliates[1];
  if public.get_current_affiliate_access_state()<>'IDENTITY_MISMATCH' or public.get_effective_affiliate_id() is not null then raise exception 'G_WRONG_LINK_NOT_DENIED'; end if;
  update public.affiliates set historical_email_normalized=v_emails[1] where id=v_affiliates[1];

  perform set_config('suti.identity.actor',v_users[1]::text,true);
  perform set_config('suti.identity.actor_affiliate',v_affiliates[1]::text,true);
  perform set_config('suti.identity.profile_target',(select id::text from public.affiliates where id<>v_affiliates[1] limit 1),true);
  perform set_config('suti.identity.photo_target',(select affiliate_id::text from public.affiliate_files where affiliate_id<>v_affiliates[1] and file_key='profile_photo' limit 1),true);
  perform set_config('suti.identity.document_target',(select affiliate_id::text from public.affiliate_files where affiliate_id<>v_affiliates[1] and file_key<>'profile_photo' limit 1),true);
  perform set_config('suti.identity.request_target',(select affiliate_id::text from public.program_requests where affiliate_id<>v_affiliates[1] limit 1),true);
  perform set_config('suti.identity.savings_target',(select affiliate_id::text from public.savings_participants where affiliate_id is not null and affiliate_id<>v_affiliates[1] limit 1),true);
  if current_setting('suti.identity.profile_target',true)='' or current_setting('suti.identity.photo_target',true)=''
    or current_setting('suti.identity.document_target',true)='' or current_setting('suti.identity.request_target',true)=''
    or current_setting('suti.identity.savings_target',true)='' then raise exception 'CROSS_RESOURCE_FIXTURE_MISSING'; end if;
end $matrix$;

select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('suti.identity.actor')::uuid,'role','authenticated','session_id','identity-rls')::text,true);
set local role authenticated;
do $rls$
declare v_count integer;
begin
  select count(id) into v_count from public.affiliates where id=current_setting('suti.identity.profile_target')::uuid;
  if v_count<>0 then raise exception 'FOREIGN_PROFILE_ALLOWED'; end if;
  select count(id) into v_count from public.affiliate_files where affiliate_id=current_setting('suti.identity.photo_target')::uuid and file_key='profile_photo';
  if v_count<>0 then raise exception 'FOREIGN_PROFILE_PHOTO_ALLOWED'; end if;
  select count(id) into v_count from public.affiliate_files where affiliate_id=current_setting('suti.identity.document_target')::uuid and file_key<>'profile_photo';
  if v_count<>0 then raise exception 'FOREIGN_DOCUMENT_ALLOWED'; end if;
  select count(id) into v_count from public.program_requests where affiliate_id=current_setting('suti.identity.request_target')::uuid;
  if v_count<>0 then raise exception 'FOREIGN_REQUEST_ALLOWED'; end if;
  begin
    select count(id) into v_count from public.savings_participants where affiliate_id=current_setting('suti.identity.savings_target')::uuid;
    if v_count<>0 then raise exception 'FOREIGN_SAVINGS_ALLOWED'; end if;
  exception when insufficient_privilege then
    null;
  end;
end $rls$;
reset role;

do $permissions$
begin
  if has_function_privilege('anon',to_regprocedure('public.get_effective_affiliate_id()'),'EXECUTE') then raise exception 'ANON_EFFECTIVE_ALLOWED'; end if;
  if has_function_privilege('anon',to_regprocedure('public.get_current_affiliate_access_state()'),'EXECUTE') then raise exception 'ANON_STATE_ALLOWED'; end if;
  if has_function_privilege('anon',to_regprocedure('public.claim_affiliate_identity()'),'EXECUTE') then raise exception 'ANON_CLAIM_ALLOWED'; end if;
  if position('globally unambiguous' in coalesce(obj_description(to_regprocedure('public.get_effective_affiliate_id()'),'pg_proc'),''))=0 then raise exception 'IDENTITY_GUARD_MARKER_MISSING'; end if;
end $permissions$;`;

const recoveryChecks = String.raw`
do $recovery$
begin
  if position('globally unambiguous' in coalesce(obj_description(to_regprocedure('public.get_effective_affiliate_id()'),'pg_proc'),''))>0 then raise exception 'RECOVERY_NOT_RESTORED'; end if;
end $recovery$;`;

async function main() {
  const values = env();
  assert(values.SUPABASE_URL && values.SUPABASE_ACCESS_TOKEN, 'Supabase management configuration missing');
  const before = (await management(values, auditSql))[0].result;
  if (process.argv.includes('--apply')) {
    assert.equal(before.wrong_links, 0, 'Production contains unverified auth_user_id links; deterministic owner-approved repair required');
    assert.equal(before.multiple_links, 0, 'Production contains auth_user_id linked more than once');
    assert.equal(before.ambiguous_linked, 0, 'Production contains already-linked ambiguous identities');
    await management(values, migration);
    await management(values, `begin;${checks}rollback;`);
    const after = (await management(values, auditSql))[0].result;
    assert.equal(after.wrong_links, 0);
    assert.equal(after.multiple_links, 0);
    assert.equal(after.ambiguous_linked, 0);
    console.log(JSON.stringify({ status: 'PASS', mode: 'APPLIED', audit: after, migration: '20260904000100', affiliate_rows_changed: 0, credentials_exposed: false }));
    return;
  }
  const applied = await management(values, "select position('globally unambiguous' in coalesce(obj_description(to_regprocedure('public.get_effective_affiliate_id()'),'pg_proc'),''))>0 applied;");
  if (applied[0].applied) {
    await management(values, `begin;${body(recovery)}${recoveryChecks}${body(migration)}${checks}rollback;`);
  } else {
    await management(values, `begin;${body(migration)}${checks}${body(recovery)}${recoveryChecks}rollback;`);
  }
  console.log(JSON.stringify({ status: 'PASS', mode: 'DRY_RUN_FORWARD_RECOVERY', audit: before, matrix: 'A-G plus profile/photo/documents/requests/savings', persistent_writes: 0, credentials_exposed: false }));
}

main().catch((error) => {
  console.error(JSON.stringify({ status: 'FAIL', error: error.message, credentials_exposed: false }));
  process.exitCode = 1;
});
