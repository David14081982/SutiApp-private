'use strict';
// Isolated PostgreSQL/WASM regression for the real presentation helper.
// Synthetic rows and permissions exist only in memory; no credentials or network.
const fs = require('fs');
const path = require('path');
const assert = require('assert/strict');
const root = path.resolve(__dirname, '..');
const { PGlite } = require(process.env.SUTIAPP_PGLITE_PATH || path.join(root, '.tmp/savings-loan-eligibility/node_modules/@electric-sql/pglite'));
const migration = fs.readFileSync(path.join(root, 'supabase/migrations/20261001000300_savings_affiliate_names.sql'), 'utf8');
const helperName = 'savings_affiliate_display_name';
const start = migration.search(new RegExp('create (?:or replace )?function public\\.' + helperName + '\\(', 'i'));
const end = migration.indexOf('$$;', start);
const revoke = migration.match(new RegExp('revoke all on function public\\.' + helperName + '\\(uuid\\)[^;]*;', 'i'));
assert(start >= 0 && end > start && revoke, 'Actual migration helper and its ACL must be present');
const helperSql = migration.slice(start, end + 3) + '\n' + revoke[0];
const uid = n => '00000000-0000-4000-8000-' + String(n).padStart(12, '0');
const REVIEW = 'Identidad por revisar';
const NO_NAME = 'Nombre no disponible en Afiliados';

async function main() {
  const db = new PGlite();
  let groups = 0;
  const query = async (sql, args = []) => (await db.query(sql, args)).rows;
  const scalar = async (sql, args = []) => (await query(sql, args))[0].value;
  const owner = () => db.exec('reset role');
  const name = id => scalar('select public.savings_affiliate_display_name($1) value', [id == null ? null : uid(id)]);
  const check = async (label, body) => { await body(); groups++; console.log('PASS ' + label); };
  const denied = promise => assert.rejects(promise, error => error.code === '42501');
  const snapshot = () => scalar(`select jsonb_build_object(
    'affiliates',(select jsonb_agg(to_jsonb(a) order by id) from public.affiliates a),
    'participants',(select jsonb_agg(to_jsonb(p) order by id) from public.savings_participants p)
  ) value`);
  try {
    await db.exec(`
      create role anon; create role authenticated; create role service_role;
      grant usage on schema public to anon,authenticated,service_role;
      create table public.affiliates(id uuid primary key,numero_control text,full_name text,is_archived boolean default false);
      create table public.savings_participants(id uuid primary key,affiliate_id uuid,legacy_folio text,display_name text,identity_status text);
      alter table public.affiliates enable row level security;
      alter table public.savings_participants enable row level security;
      revoke all on public.affiliates,public.savings_participants from public,anon,authenticated,service_role;
      create table public.fixture_savings_read_permissions(role_name text primary key,allowed boolean not null);
      insert into public.fixture_savings_read_permissions values('authenticated',false);
      revoke all on public.fixture_savings_read_permissions from public,anon,authenticated,service_role;
    `);
    const affiliates = [
      [1, '00123', 'María José Núñez O’Farrill', false],
      [2, '123', 'Óscar Pérez López', false],
      [3, 'A-Ñ 07', '  José  María Núñez Álvarez  ', false],
      [4, 'ARCH-DUP', 'Lucía Ríos Actual', false],
      [5, 'ARCH-DUP', 'Persona Archivada Diferente', true],
      [6, 'ACT-DUP', 'Primera Persona Activa', false],
      [7, 'ACT-DUP', 'Segunda Persona Activa', false],
      [8, 'WRONG-LINK', 'Persona Con Folio Coincidente', false],
      [9, 'AMBIGUO', 'Nombre Válido Uno', false],
      [10, 'HUERFANO', 'Nombre Válido Dos', false],
      [11, '', 'Nombre Con Folio Vacío', false],
      [12, '   ', 'Nombre Con Folio Espacios', false],
      [13, 'NULLNAME', null, false],
      [14, 'SPACENAME', '   ', false],
      [15, 'NULLARCH', 'Estado Archivo Nulo', null],
      [16, 'EXACT', 'Coincidencia Exacta Solamente', false],
      [17, 'plain', 'Control Con Minúsculas', false],
      [18, 'EMPTYNAME', '', false]
    ];
    for (const [id, control, fullName, archived] of affiliates) {
      await query('insert into public.affiliates values($1,$2,$3,$4)', [uid(id), control, fullName, archived]);
    }
    // Invalid links are deliberate negative fixtures, never production repairs.
    const participants = [
      [201, 1, '00123', 'RESOLVED'], [202, 2, '123', 'RESOLVED'],
      [203, 3, 'A-Ñ 07', 'RESOLVED'], [204, 4, 'ARCH-DUP', 'RESOLVED'],
      [205, 5, 'ARCH-DUP', 'RESOLVED'], [206, 6, 'ACT-DUP', 'RESOLVED'],
      [207, 2, 'WRONG-LINK', 'RESOLVED'], [208, 9, 'AMBIGUO', 'AMBIGUOUS'],
      [209, 10, 'HUERFANO', 'ORPHAN'], [210, 11, '', 'RESOLVED'],
      [211, 12, '   ', 'RESOLVED'], [212, 13, 'NULLNAME', 'RESOLVED'],
      [213, 14, 'SPACENAME', 'RESOLVED'], [214, 15, 'NULLARCH', 'RESOLVED'],
      [215, 16, ' EXACT', 'RESOLVED'], [216, 17, 'PLAIN', 'RESOLVED'],
      [217, null, '00123', 'RESOLVED'], [218, 999, '00123', 'RESOLVED'],
      [219, 1, '00123', null], [220, 1, null, 'RESOLVED'],
      [221, 18, 'EMPTYNAME', 'RESOLVED'], [222, 1, '123', 'RESOLVED']
    ];
    for (const [id, affiliate, control, status] of participants) {
      await query('insert into public.savings_participants values($1,$2,$3,$4,$5)',
        [uid(id), affiliate == null ? null : uid(affiliate), control, 'Nombre legacy que nunca debe rescatarse ' + id, status]);
    }
    const before = await snapshot();
    await db.exec(helperSql);

    await check('real migration helper is stable, invoker and private', async () => {
      const metadata = (await query("select prosecdef,provolatile,proconfig from pg_proc where oid='public.savings_affiliate_display_name(uuid)'::regprocedure"))[0];
      assert.equal(metadata.prosecdef, false);
      assert.equal(metadata.provolatile, 's');
      assert(metadata.proconfig.includes('search_path=""'));
      for (const role of ['anon', 'authenticated', 'service_role']) {
        assert.equal(await scalar("select has_function_privilege($1,'public.savings_affiliate_display_name(uuid)','EXECUTE') value", [role]), false);
      }
    });
    await check('exact UUID plus raw control keeps leading-zero identities separate', async () => {
      assert.equal(await name(201), affiliates[0][2]);
      assert.equal(await name(202), affiliates[1][2]);
      assert.equal(await name(222), REVIEW, 'A matching alternate control must not rescue a wrong UUID link');
      assert.equal(await name(215), REVIEW, 'Outer control whitespace must not be normalized');
      assert.equal(await name(216), REVIEW, 'Control case must not be normalized');
    });
    await check('complete accents and literal name formatting are preserved', async () => {
      assert.equal(await name(203), affiliates[2][2]);
      assert.equal(await name(214), affiliates[14][2], 'NULL archive flag follows the real coalesce contract');
    });
    await check('one active plus archived duplicate resolves; two active affiliates do not', async () => {
      assert.equal(await name(204), affiliates[3][2]);
      assert.equal(await name(205), REVIEW, 'An archived linked UUID must not be replaced by the active duplicate');
      assert.equal(await name(206), REVIEW, 'Multiple active matches must never choose the first');
    });
    await check('wrong or missing UUID links cannot fall back to a matching folio', async () => {
      for (const id of [207, 217, 218]) assert.equal(await name(id), REVIEW, String(id));
    });
    await check('unresolved status, blank control and absent participants remain explicit', async () => {
      for (const id of [208, 209, 210, 211, 219, 220, 999, null]) assert.equal(await name(id), REVIEW, String(id));
    });
    await check('empty authoritative names never fall back to legacy display_name', async () => {
      for (const id of [212, 213, 221]) assert.equal(await name(id), NO_NAME, String(id));
    });

    // This wrapper is a synthetic permission boundary, not a substitute for the
    // three production RPCs. Its gate uses isolated role permissions, no JWTs.
    await db.exec(`
      create function public.fixture_savings_name_rpc(p_participant_id uuid) returns jsonb
      language plpgsql stable security definer set search_path='' as $$
      begin
        if not exists(select 1 from public.fixture_savings_read_permissions
          where role_name=current_setting('role',true) and allowed)
        then raise exception 'SAVINGS_READ_DENIED' using errcode='42501'; end if;
        return (select jsonb_build_object('id',p.id,'affiliate_id',p.affiliate_id,
          'folio',p.legacy_folio,'name',public.savings_affiliate_display_name(p.id))
          from public.savings_participants p where p.id=p_participant_id);
      end $$;
      revoke all on function public.fixture_savings_name_rpc(uuid) from public,anon,authenticated,service_role;
      grant execute on function public.fixture_savings_name_rpc(uuid) to authenticated;
    `);
    await check('anon, authenticated and service_role cannot invoke helper or read source tables', async () => {
      for (const role of ['anon', 'authenticated', 'service_role']) {
        await owner();
        await db.exec('set role ' + role);
        await denied(name(201));
        await denied(query('select * from public.affiliates'));
        await denied(query('select * from public.savings_participants'));
        await denied(query('select * from public.fixture_savings_read_permissions'));
        await denied(scalar('select public.fixture_savings_name_rpc($1) value', [uid(201)]));
      }
      await owner();
    });
    await check('gated definer reader resolves names while preserving IDs and exact folios', async () => {
      await query("update public.fixture_savings_read_permissions set allowed=true where role_name='authenticated'");
      await db.exec('set role authenticated');
      const result = await scalar('select public.fixture_savings_name_rpc($1) value', [uid(201)]);
      assert.deepEqual(result, { id: uid(201), affiliate_id: uid(1), folio: '00123', name: affiliates[0][2] });
      const conflict = await scalar('select public.fixture_savings_name_rpc($1) value', [uid(222)]);
      assert.deepEqual(conflict, { id: uid(222), affiliate_id: uid(1), folio: '123', name: REVIEW });
      await denied(name(201));
      await denied(query('select * from public.savings_participants'));
      await owner();
    });
    await check('all affiliate and participant source rows remain byte-equivalent as JSON', async () => {
      assert.deepEqual(await snapshot(), before);
    });
    console.log('PASS savings affiliate names: ' + groups + ' isolated regression groups; no live database or writes.');
  } finally {
    await db.close();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
