'use strict';
// Reuse isolated PGlite fixture; no network, credentials or production access.
const fs=require('fs'),path=require('path'),Module=require('module'),assert=require('node:assert/strict');
const file=path.join(__dirname,'test-cash-flow-savings-sources-sql.js');
let harness=fs.readFileSync(file,'utf8');
const checks=String.raw`
 await check('historical withdrawal type is explicit, money and backend security preserved, recovery exact',async()=>{
  await db.exec('reset role');
  const migration='supabase/migrations/20261113000100_reports_jc_cash_flow_withdrawal_types.sql';
  const recovery='supabase/recovery/20261113000100_reports_jc_cash_flow_withdrawal_types.sql';
  const originals=await q('select id,source_data from savings_review_records where id=any($1::uuid[])',[[uid(13),uid(14)]]);
  await q("update savings_review_records set source_data=source_data||jsonb_build_object('E',case when id=$1 then 'Completo' else 'Parcial' end) where id=any($2::uuid[])",[uid(13),[uid(13),uid(14)]]);
  const before=await snapshot(),meta=await metadata();await actor();
  const old=await report('2026-01-01');await db.exec('reset role');
  await db.exec(read(migration));const updated=await metadata();await actor();const next=await report('2026-01-01');
  const event=(r,n)=>r.events.find(e=>e.source_id===uid(n));
  assert.equal(event(next,13).kind,'withdrawal_total');assert.equal(event(next,14).kind,'withdrawal_partial');
  assert.deepEqual(next.balances,old.balances);
  assert.deepEqual(next.events.map(({kind,...r})=>r),old.events.map(({kind,...r})=>r));
  assert.equal(next.source_bases.historical_withdrawals.find(r=>r.id===uid(13)).original_withdrawal_type,'Completo');
  const clean=({hash,...r})=>r;assert.deepEqual(clean(updated),clean(meta));
  await db.exec('reset role');assert.deepEqual(await snapshot(),before);
  await db.exec(read(recovery));assert.deepEqual(await metadata(),meta);await actor();assert.deepEqual(await report('2026-01-01'),old);
  await db.exec('reset role');
  // Also prove exact preservation of the deployed reader's timeout.
  await db.exec("alter function public.get_admin_reports_jc_cash_flow(date) set statement_timeout to '30s'");
  const timed=await metadata();await db.exec(read(migration));await db.exec(read(recovery));assert.deepEqual(await metadata(),timed);
  await db.exec('alter function public.get_admin_reports_jc_cash_flow(date) reset statement_timeout');
  for(const r of originals)await q('update savings_review_records set source_data=$2 where id=$1',[r.id,JSON.stringify(r.source_data)]);
  await actor();
 });
 const event=(r,id)=>`;
const anchor='const harness=new Module(sourcePath,module);';
assert(harness.includes(anchor));
harness=harness.replace(anchor,`replace('const event=(r,id)=>',${JSON.stringify(checks)});\n${anchor}`);
const runner=new Module(file,module);runner.filename=file;runner.paths=module.paths;runner._compile(harness,file);
