'use strict';
// Isolated synthetic fixtures only. Never connects to production.
const fs=require('fs'),path=require('path'),Module=require('module'),assert=require('assert/strict');
const sourcePath=path.join(__dirname,'test-cash-flow-criteria-savings-sql.js');let source=fs.readFileSync(sourcePath,'utf8');
function replace(a,b){assert(source.includes(a),'HARNESS_ANCHOR_CHANGED: '+a);source=source.replace(a,()=>b);}
replace("const original=await val(",`await db.exec("alter table public.savings_participants add column display_name text default 'Persona fixture';alter table public.savings_review_records add column source_row integer default 2;create function public.savings_review_identity(text) returns jsonb language sql stable as $$select jsonb_build_object('name','Persona fixture')$$;");
 const original=await val(`);
replace("insert into savings_participants values(","insert into savings_participants(id,legacy_folio,data_classification) values(");
replace('await db.exec(read(nextMigration));const afterFunction=await metadata();await actor();',`
 await db.exec(read(nextMigration));const beforeOptimization=await metadata();
 await db.exec(read('supabase/migrations/20261030000600_reports_jc_cash_flow_savings_query.sql'));const beforeSources=await metadata();
 await db.exec(read('supabase/migrations/20261102000100_reports_jc_cash_flow_sources.sql'));const beforeExplanation=await metadata();await actor();
 const originalReports={};for(const from of ['2026-01-01','2026-10-01'])originalReports[from]=await report(from);
 await db.exec('reset role');await db.exec(read('supabase/migrations/20261104000100_reports_jc_cash_flow_sources.sql'));
 const afterFunction=await metadata();console.log('NEW_READER_MD5 '+afterFunction.hash);await actor();
 await check('readable savings sources preserve exact original events balances and permissions',async()=>{
  for(const [from,original]of Object.entries(originalReports)){
   const {source_bases,...rest}=await report(from),{source_bases:oldBases,...oldRest}=original;assert.deepEqual(rest,oldRest);
   for(const key of ['accounts','account_balances','balance_entries','current_balances','history','pending','transactions'])assert.deepEqual(source_bases[key],oldBases[key]);
   assert.equal(source_bases.account_identities.length,2);assert(source_bases.account_identities.every(r=>r.name==='Persona fixture'&&r.control&&r.account_label));
   assert.equal(source_bases.opening_account_balances.length,2);assert(source_bases.history_metadata.every(r=>r.reference&&r.source_column&&r.source_row===2));
   assert(!JSON.stringify(source_bases).includes('source_data'));
  }
  const clean=({hash,...r})=>r;assert.deepEqual(clean(afterFunction),clean(beforeExplanation));
 });
 await check('future year includes intervening existing schedule for projection',async()=>{
  for(const from of ['2027-01-01','2028-01-01']){const r=await report(from);assert(r.source_bases.scheduled.some(s=>s.date==='2026-11-15'));
   assert(r.source_bases.scheduled.every(s=>s.participant_id));assert(r.events.some(e=>e.kind==='contribution_scheduled'&&e.date==='2026-11-15'));}
 });
 await check('original SQL reader and savings bridge integrate without changing canonical balances',async()=>{
  const {buildCashFlow}=await import('../supabase/functions/reports-jc/cash-flow.mjs');
  const {reconcileSavingsCashFlow}=await import('../supabase/functions/reports-jc/cash-flow-savings.mjs');
  for(const from of ['2026-01','2026-10','2028-01']){
   const savings=await report(from+'-01'),base=buildCashFlow({from,loans:[],savings,consultedAt:'2026-10-30T20:00:00Z'}),before=structuredClone(base.rows.find(r=>r.id==='savings_balance'));
   const result=reconcileSavingsCashFlow({base,savings});assert.deepEqual(result.rows.find(r=>r.id==='savings_balance'),before);assert(result.savingsSourceTable.rows.length>0);
   for(const m of result.savingsBridge.months)if(m.status==='CALCULATED')assert(m.equationValid);
  }
 });
`);
replace("assert.equal(afterFunction.hash,'94b10b95af8b16883ace97c8f85f67ab');","assert.notEqual(afterFunction.hash,beforeExplanation.hash);");
replace("const event=(r,id)=>",`await check('June original DT is disclosed only under existing panel eligibility',()=>savepoint(async()=>{
  await q("update savings_review_records set source_data=source_data||'{\\"DT\\":30,\\"W\\":\\"Ahorrando\\",\\"X\\":\\"2026-01-15\\"}' where id=$1",[uid(11)]);await actor();
  let r=await report('2026-01-01'),m=r.source_bases.history_metadata.find(x=>x.source_column==='AR');assert.equal(m.yield_amount,30);assert.equal(m.yield_column,'DT');
  await db.exec('reset role');await q("update savings_review_records set source_data=source_data||'{\\"DT\\":999}' where id=$1",[uid(11)]);await actor();
  r=await report('2026-01-01');assert.equal(r.source_bases.history_metadata.find(x=>x.source_column==='AR').yield_amount,null);
 }));
 const event=(r,id)=>`);
replace('assert.deepEqual(canonical(actual),canonical(expected));','const {source_bases,...original}=expected;assert.deepEqual(canonical(actual),canonical(original));');
replace('await db.exec(read(recovery));assert.deepEqual(await metadata(),beforeFunction);',`
 await db.exec(read('supabase/recovery/20261104000100_reports_jc_cash_flow_sources.sql'));assert.deepEqual(await metadata(),beforeExplanation);
 await db.exec(read('supabase/recovery/20261102000100_reports_jc_cash_flow_sources.sql'));assert.deepEqual(await metadata(),beforeSources);
 await db.exec(read('supabase/recovery/20261030000600_reports_jc_cash_flow_savings_query.sql'));assert.deepEqual(await metadata(),beforeOptimization);
 await db.exec(read(recovery));assert.deepEqual(await metadata(),beforeFunction);
`);
replace("task:'H-FLUJO-EFECTIVO-CRITERIO-001'","task:'H-CASH-FLOW-PV2-SOURCE-20261104'");
replace("oldDefinitionMd5:beforeFunction.hash","oldDefinitionMd5:beforeExplanation.hash");
replace("const dir=path.join(root,'docs/qa/evidence/cash-flow-criteria')","const dir=path.join(root,'.tmp/cash-flow-source-20261104')");
const harness=new Module(sourcePath,module);harness.filename=sourcePath;harness.paths=module.paths;harness._compile(source,sourcePath);
