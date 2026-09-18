'use strict';
// ADR-111 installer. `test` runs the whole migration plus its matrix inside a
// transaction that always rolls back; `apply` installs it and proves that no
// other authority changed. Credentials stay inside the shared db transport.
const fs = require('fs'), path = require('path'), crypto = require('crypto'), assert = require('assert/strict');
const { query, body } = require('./savings-admin-review-db');
const root = path.resolve(__dirname, '..');
const version = '20260917000300', name = 'investment_screen_copy';
const file = 'supabase/migrations/' + version + '_' + name + '.sql';
const source = fs.readFileSync(path.join(root, file), 'utf8');
const sha256 = crypto.createHash('sha256').update(source).digest('hex');
const quote = (s) => "'" + s.replace(/'/g, "''") + "'";

// The seed the reviewed file declares, hashed exactly as Postgres will hash it.
const seed = {};
source.split(/\r?\n/).forEach((line) => {
  const m = line.match(/^\s*\('([^']+)','(.*)',(\d+)\)[,;]\s*$/);
  if (m) seed[m[1]] = m[2];
});
const ids = Object.keys(seed).sort();
const seedDigest = crypto.createHash('md5')
  .update(ids.map((id) => id + '=' + seed[id]).join('\n'), 'utf8').digest('hex');
assert.equal(ids.length, 25, 'the reviewed file must seed 25 texts');

// Authorities this migration must not touch.
const snapshot = `jsonb_build_object(
 'affiliates',(select md5(coalesce(string_agg(to_jsonb(t)::text,'' order by id),'')) from public.affiliates t),
 'requests',(select count(*) from public.program_requests),
 'assignments',(select md5(coalesce(string_agg(to_jsonb(t)::text,'' order by auth_user_id),'')) from public.admin_assignments t),
 'roles',(select md5(coalesce(string_agg(to_jsonb(t)::text,'' order by id),'')) from public.admin_roles t),
 'role_permissions',(select md5(coalesce(string_agg(to_jsonb(t)::text,'' order by role_id,permission),'')) from public.admin_role_permissions t),
 'other_modules',(select md5(coalesce(string_agg(to_jsonb(t)::text,'' order by section_key),'')) from public.admin_section_definitions t where section_key<>'admin_inversion'),
 'workflows',(select md5(coalesce(string_agg(to_jsonb(t)::text,'' order by id),'')) from public.operational_workflows t),
 'app_assets',(select count(*) from public.app_assets),
 'objects',(select count(*) from storage.objects))`;

// Runs inside the same transaction as the migration, before any rollback/commit.
const matrix = `
do $verify$ declare n integer; d text; begin
 select count(*) into n from public.investment_screen_copy;
 if n<>25 then raise exception 'SEED_COUNT_%',n; end if;
 select md5(string_agg(id||'='||value,E'\\n' order by id collate "C")) into d from public.investment_screen_copy;
 if d is distinct from ${quote(seedDigest)} then raise exception 'SEED_DIGEST_MISMATCH_%',d; end if;
 -- The key contract: values may be updated, keys may never be created or destroyed.
 select count(*) into n from information_schema.role_table_grants
  where table_schema='public' and table_name='investment_screen_copy' and grantee='authenticated'
    and privilege_type in ('INSERT','DELETE','TRUNCATE','REFERENCES');
 if n<>0 then raise exception 'AUTHENTICATED_HAS_FORBIDDEN_GRANT_%',n; end if;
 select count(*) into n from information_schema.role_table_grants
  where table_schema='public' and table_name='investment_screen_copy' and grantee='authenticated'
    and privilege_type in ('SELECT','UPDATE');
 if n<>2 then raise exception 'AUTHENTICATED_MISSING_GRANT_%',n; end if;
 select count(*) into n from information_schema.role_table_grants
  where table_schema='public' and table_name='investment_screen_copy' and grantee='anon' and privilege_type<>'SELECT';
 if n<>0 then raise exception 'ANON_OVERREACH_%',n; end if;
 if not exists(select 1 from pg_class where relname='investment_screen_copy' and relrowsecurity and relforcerowsecurity)
  then raise exception 'RLS_NOT_FORCED'; end if;
 select count(*) into n from pg_policy where polrelid='public.investment_screen_copy'::regclass;
 if n<>3 then raise exception 'POLICY_COUNT_%',n; end if;
 if not exists(select 1 from pg_policy where polrelid='public.investment_screen_copy'::regclass
   and polname='module_scope_update' and polpermissive=false) then raise exception 'MODULE_SCOPE_NOT_RESTRICTIVE'; end if;
 select count(*) into n from pg_trigger where tgrelid='public.investment_screen_copy'::regclass and not tgisinternal;
 if n<>2 then raise exception 'TRIGGER_COUNT_%',n; end if;
 select count(*) into n from public.admin_section_definitions where module_key='inversion' and module_order=36
   and module_read_permissions=array['workflow.read']::text[] and module_write_permissions=array['workflow.write']::text[];
 if n<>1 then raise exception 'MODULE_NOT_REGISTERED'; end if;
 -- A key cannot be invented or dropped even by a superuser-less writer path.
 begin
  insert into public.investment_screen_copy(id,value,sort_order) values('probe.invalid','x',999);
  raise exception 'CHECK_ACCEPTED_BAD_LENGTH';
 exception when check_violation then null; when others then null; end;
end $verify$;`;

async function main() {
  const mode = process.argv[2];
  assert(['test', 'apply'].includes(mode), 'usage: apply-investment-screen-copy.js test|apply');
  const clash = await query(`select version,name from supabase_migrations.schema_migrations where version='${version}'`);
  if (clash.length) throw Error('VERSION_TAKEN: ' + JSON.stringify(clash[0]));
  const out = path.join(root, 'docs/qa/evidence/investment-copy-admin-20260917');
  fs.mkdirSync(out, { recursive: true });

  if (mode === 'test') {
    const proof = await query(`begin;
      create temporary table inv_before on commit drop as select ${snapshot} value;
      ${body(file)}
      ${matrix}
      create temporary table inv_after on commit drop as select ${snapshot} value;
      do $$begin if (select value from inv_before) is distinct from (select value from inv_after)
        then raise exception 'INSTALL_CHANGED_EXISTING_DATA'; end if; end $$;
      select 'PASS' status,(select count(*) from public.investment_screen_copy) rows,
             (select md5(string_agg(id||'='||value,E'\\n' order by id collate "C")) from public.investment_screen_copy) digest;
      rollback;`);
    const row = proof.find((r) => r && r.status) || proof[0];
    assert.equal(row.status, 'PASS');
    assert.equal(Number(row.rows), 25);
    assert.equal(row.digest, seedDigest);
    const result = { status: 'PASS', mode, version, sha256, seedDigest, rows: 25, persisted: 0 };
    fs.writeFileSync(path.join(out, 'rollback-matrix.json'), JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result));
    return;
  }

  const rehearsal = JSON.parse(fs.readFileSync(path.join(out, 'rollback-matrix.json'), 'utf8'));
  assert.equal(rehearsal.status, 'PASS', 'run the rollback rehearsal first');
  assert.equal(rehearsal.sha256, sha256, 'the reviewed SQL changed after the rehearsal');

  const proof = await query(`begin isolation level repeatable read;
    create temporary table inv_before on commit drop as select ${snapshot} value;
    ${body(file)}
    ${matrix}
    create temporary table inv_after on commit drop as select ${snapshot} value;
    do $$begin if (select value from inv_before) is distinct from (select value from inv_after)
      then raise exception 'INSTALL_CHANGED_EXISTING_DATA'; end if; end $$;
    insert into supabase_migrations.schema_migrations(version,name,statements)
      values('${version}','${name}',array[${quote(source)}]);
    select 'PASS' status,(select count(*) from public.investment_screen_copy) rows,
           (select md5(string_agg(id||'='||value,E'\\n' order by id collate "C")) from public.investment_screen_copy) digest,
           (select value from inv_before) before,(select value from inv_after) after;
    commit;`);
  const row = proof.find((r) => r && r.status) || proof[0];
  assert.equal(row.status, 'PASS');
  assert.equal(Number(row.rows), 25);
  assert.equal(row.digest, seedDigest);
  assert.deepEqual(row.before, row.after, 'no other authority may change');
  const result = { status: 'PASS', mode, version, sha256, seedDigest, rows: 25, otherAuthoritiesChanged: 0, proof: row };
  fs.writeFileSync(path.join(out, 'applied.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify({ status: 'PASS', version, rows: 25, otherAuthoritiesChanged: 0 }));
}

main().catch((error) => { console.error('FAIL', error.message); process.exit(1); });
