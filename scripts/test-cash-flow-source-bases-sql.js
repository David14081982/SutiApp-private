'use strict';
// Reuse isolated database fixtures and denial checks; never connects to production.
const fs=require('fs'),path=require('path'),Module=require('module'),assert=require('assert/strict');
const sourcePath=path.join(__dirname,'test-cash-flow-criteria-savings-sql.js');let source=fs.readFileSync(sourcePath,'utf8');
function replace(a,b){assert(source.includes(a),'HARNESS_ANCHOR_CHANGED');source=source.replace(a,b);}
replace('await db.exec(read(nextMigration));const afterFunction=await metadata();await actor();',`
 await db.exec(read(nextMigration));const beforeOptimization=await metadata();
 await db.exec(read('supabase/migrations/20261030000600_reports_jc_cash_flow_savings_query.sql'));const beforeSources=await metadata();await actor();
 const originalReports={};for(const from of ['2026-01-01','2026-10-01'])originalReports[from]=await report(from);
 await db.exec('reset role');await db.exec(read('supabase/migrations/20261102000100_reports_jc_cash_flow_sources.sql'));
 const afterFunction=await metadata();await actor();
 await check('source bases preserve exact existing results and permissions',async()=>{
  for(const [from,original]of Object.entries(originalReports)){
   const {source_bases,...rest}=await report(from);assert.deepEqual(rest,original);
   assert.deepEqual(Object.keys(source_bases).sort(),['accounts','account_balances','balance_entries','current_balances','history','historical_withdrawals','pending','scheduled','transactions'].sort());
   assert(source_bases.history.length>0);assert(source_bases.current_balances.length>0);
   for(const b of rest.balances.filter(b=>String(b.month).startsWith('2026-10'))){const sum=source_bases.current_balances.reduce((s,r)=>s+Number(r.amount||0),0);assert.equal(Number(b.known_amount),sum);}
   assert(!JSON.stringify(source_bases).includes('source_data'));
  }
  const clean=({hash,...r})=>r;assert.deepEqual(clean(afterFunction),clean(beforeSources));
 });
`);
replace("assert.equal(afterFunction.hash,'94b10b95af8b16883ace97c8f85f67ab');","assert.notEqual(afterFunction.hash,beforeSources.hash);");
replace('assert.deepEqual(canonical(actual),canonical(expected));','const {source_bases,...original}=expected;assert.deepEqual(canonical(actual),canonical(original));');
replace('await db.exec(read(recovery));assert.deepEqual(await metadata(),beforeFunction);',`
 await db.exec(read('supabase/recovery/20261102000100_reports_jc_cash_flow_sources.sql'));assert.deepEqual(await metadata(),beforeSources);
 await db.exec(read('supabase/recovery/20261030000600_reports_jc_cash_flow_savings_query.sql'));assert.deepEqual(await metadata(),beforeOptimization);
 await db.exec(read(recovery));assert.deepEqual(await metadata(),beforeFunction);
`);
replace("path.join(dir,'savings-sql.json')","path.join(root,'.tmp/reports-jc/flow-source-parity/savings-sql.json')");
const harness=new Module(sourcePath,module);harness.filename=sourcePath;harness.paths=module.paths;harness._compile(source,sourcePath);
