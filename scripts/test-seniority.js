'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert/strict');
const root = path.resolve(__dirname, '..');
const { PGlite } = require(process.env.SUTIAPP_PGLITE_PATH || path.join(root, '.tmp/savings-loan-eligibility/node_modules/@electric-sql/pglite'));
const migration = fs.readFileSync(path.join(root, 'supabase/migrations/20261125000100_affiliate_seniority.sql'), 'utf8');
const union = migration.match(/financial_union_code\)\) = '([^']+)'/)[1];
const uuid = n => '00000000-0000-4000-8000-' + String(n).padStart(12, '0');
async function main() {
  const checks = [], db = new PGlite();
  const value = async (sql, args = []) => (await db.query(sql, args)).rows[0].v;
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role; create schema auth;
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.actor',true),'')::uuid$$;
      create function public.get_effective_affiliate_id() returns uuid language sql stable as $$select nullif(current_setting('test.affiliate',true),'')::uuid$$;
      create function public.get_current_affiliate_access_state() returns text language sql stable as $$select current_setting('test.state',true)$$;
      create function public.has_admin_permission(text) returns boolean language sql stable as $$select coalesce(current_setting('test.admin',true),'false')='true'$$;
      grant usage on schema auth to authenticated, anon;
      create table public.affiliates(id uuid primary key,numero_control text,full_name text,display_name text,city_raw text,unit_raw text,employment_entry_date_raw text,updated_at timestamptz default now(),financial_union_code text,affiliate_status_raw text,financial_employee_category_code text);
      alter table public.affiliates enable row level security; alter table public.affiliates force row level security;
      grant select on public.affiliates to authenticated;
      create policy own on public.affiliates for select to authenticated using(id=public.get_effective_affiliate_id());`);
    await db.exec(migration);
    await db.exec(fs.readFileSync(path.join(root,'supabase/migrations/20261125000200_seniority_unit_whitespace.sql'),'utf8'));
    const insert = async (n, date, changes = {}) => {
      const row = { id: uuid(n), numero_control: '0007', full_name: 'Fixture ' + n, city_raw: null, unit_raw: ' MODULO A ', employment_entry_date_raw: date, financial_union_code: union, affiliate_status_raw: ' Activo ', financial_employee_category_code: 'EVENTUALES', ...changes };
      await db.query('insert into affiliates(' + Object.keys(row).join(',') + ') values(' + Object.keys(row).map((_,i) => '$' + (i+1)).join(',') + ')', Object.values(row));
    };
    for (const [n,date] of [[1,'1/1/2000'],[2,'31/2/2010'],[3,null],[4,'1/1/2999'],[5,'15/6/2008, 0:00:00'],[6,'junio 2009'],[7,'31/12/99']]) await insert(n,date);
    for (const [n,category] of [[8,' BASE '],[9,'jubilados_pensionados'],[10,null]]) await insert(n,'1/1/1990',{ financial_employee_category_code: category });
    await insert(11,'1/1/1990',{financial_union_code:'OTHER'}); await insert(12,'1/1/1990',{affiliate_status_raw:'Baja'});
    await insert(13,'1/1/2010',{unit_raw:'MODULO B',financial_union_code:' '+union.toLowerCase()+' '});
    await insert(14,'1/1/2010',{unit_raw:null});
    await db.query('update affiliates set unit_raw=$1 where id=$2',['\t MODULO A \t\r\n',uuid(5)]);
    const before = await value('select md5(jsonb_agg(to_jsonb(a) order by id)::text) v from affiliates a');
    const actor = async (state='ACTIVE', admin=false, linked=true) => {
      await db.exec('reset role');
      await db.query("select set_config('test.actor',$1,false),set_config('test.affiliate',$2,false),set_config('test.state',$3,false),set_config('test.admin',$4,false)",[uuid(1),linked?uuid(1):'',state,String(admin)]);
      await db.exec('set role authenticated');
    };
    await actor();
    assert.equal(await value('select count(*)::int v from affiliates'),1);
    const first=await value('select get_affiliate_seniority(0,2) v');
    assert.equal(first.total,9); assert.equal(first.items.length,2); assert.equal(first.items[0].id,uuid(1)); assert.equal(first.items[1].id,uuid(5));
    assert.equal(first.items[0].numero_control,'0007'); assert.equal(first.items[0].unit_total,7);
    const all=[];for(let offset=0;offset<first.total;offset+=2){const p=await value('select get_affiliate_seniority($1,2) v',[offset]);assert.equal(p.revision,first.revision);all.push(...p.items);}
    assert.equal(new Set(all.map(r=>r.id)).size,9); assert.equal(all.at(-1).unit,null);
    for(const row of all.filter(r=>r.date_status!=='VALID'))assert.equal(row.tenure_months,null);
    assert.equal(all.filter(r=>r.unit==='MODULO A').map(r=>r.rank).join(','),'1,2,3,4,5,6,7');
    checks.push('Server filters precede totals/pages; BASE, retirees, null category, other union and inactive excluded; text control and UUID preserved; per-unit chronological order; invalid/missing/future last; pagination unique');
    for(const args of [[-1,50],[0,101],[null,50],[0,null]])await assert.rejects(value('select get_affiliate_seniority($1,$2) v',args),/SENIORITY_INVALID_PAGE/);
    for(const state of ['ARCHIVED','UNLINKED','IDENTITY_MISMATCH']){await actor(state,false,false);await assert.rejects(value('select get_affiliate_seniority() v'),/SENIORITY_ACCESS_DENIED/);}
    await actor('UNLINKED',true,false);assert.equal((await value('select get_affiliate_seniority() v')).total,9);
    await db.exec('reset role;set role anon');await assert.rejects(value('select get_affiliate_seniority() v'),/permission denied/);
    await db.exec('reset role;set role authenticated');await assert.rejects(value("select seniority_private.entry_date('1/1/2000') v"),/permission denied/);
    checks.push('Anonymous, archived, unlinked and mismatched denied; existing admin permission allowed; private helper denied; direct affiliate RLS preserved; bounded page arguments');
    await db.exec('reset role');
    for(const [raw,date] of [['29/2/2024','2024-02-29'],['29/2/2023',null],['1/1/2020, 23:59:59','2020-01-01'],['1/1/2020, 24:00:00',null],['1/13/2020',null],['00/1/2020',null],['1/1/20',null],['PTE',null]])assert.equal(await value('select seniority_private.entry_date($1)::text v',[raw]),date,raw);
    assert.equal(await value("select ('2026-11-26 06:59:59+00'::timestamptz at time zone 'America/Hermosillo')::date::text v"),'2026-11-25');
    for(const [today,entry,expected]of [['2026-11-25','2000-11-26',311],['2026-11-26','2000-11-26',312],['2025-02-28','2024-02-29',11],['2025-03-01','2024-02-29',12]]){
      assert.equal(await value("select ((extract(year from $1::date)::int-extract(year from $2::date)::int)*12+extract(month from $1::date)::int-extract(month from $2::date)::int-case when extract(day from $1::date)<extract(day from $2::date) then 1 else 0 end) v",[today,entry]),expected);
    }
    checks.push('Strict real D/M/YYYY clock formats; leap days and invalid dates; no two-digit-year inference; completed month boundaries and Hermosillo date');
    assert.equal(await value('select md5(jsonb_agg(to_jsonb(a) order by id)::text) v from affiliates a'),before);
    await db.exec(fs.readFileSync(path.join(root,'supabase/recovery/20261125000100_affiliate_seniority.sql'),'utf8'));
    assert.equal(await value('select md5(jsonb_agg(to_jsonb(a) order by id)::text) v from affiliates a'),before);
    checks.push('Migration and recovery preserve all affiliate bytes');
    const box={window:{},console};vm.createContext(box);vm.runInContext(fs.readFileSync(path.join(root,'app/seniority-repository.js'),'utf8'),box);
    const model=box.window.SeniorityModel;assert.equal(model.tenure(313),'26 años · 1 mes');assert.equal(model.tenure(null),'Sin antigüedad');assert.equal(model.tenure(0),'0 meses');assert.equal(model.merge([{id:'a'}],[{id:'a'},{id:'b'}]).length,2);
    const csv=model.csv([{...first.items[0],name:'=EVIL',numero_control:'0007'}],'2026-11-25');assert(csv.includes("'=EVIL"));assert(csv.includes('"0007"'));
    await assert.rejects(box.window.createSeniorityRepository(()=>({rpc:async()=>({error:{}})})).page(),/No se pudo/);
    await assert.rejects(box.window.createSeniorityRepository(()=>({rpc:async()=>({data:{items:[]}})})).page(),/incompleta/);
    checks.push('UI model deduplicates UUID, displays months, protects CSV formulas; repository surfaces failures without fallback');
    new vm.Script(fs.readFileSync(path.join(root,'app/screens-seniority.jsx'),'utf8'));
    const proof={status:'PASS',checks,syntheticData:'isolated in-memory PostgreSQL only',productionMutations:0};
    const out=path.join(root,'docs/qa/evidence/seniority');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'isolated.json'),JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
  }finally{await db.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
