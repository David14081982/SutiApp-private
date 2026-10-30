'use strict';
// Reuse the approved 15 reader cases against 001 -> 005 -> 006.
// Only the query plan changes; fixtures and financial assertions stay identical.
const fs=require('fs'),path=require('path'),Module=require('module'),assert=require('node:assert/strict');
const sourcePath=path.join(__dirname,'test-cash-flow-criteria-savings-sql.js');
let source=fs.readFileSync(sourcePath,'utf8');
const replace=(from,to)=>{assert(source.includes(from),'HARNESS_ANCHOR_CHANGED');source=source.replace(from,to);};
replace("await db.exec(read(nextMigration));const afterFunction=await metadata();await actor();",`
  await db.exec(read(nextMigration));const beforeOptimization=await metadata();await actor();
  const approvedReports={};for(const from of ['2026-01-01','2026-10-01'])approvedReports[from]=await report(from);
  await db.exec('reset role');await db.exec(read('supabase/migrations/20261030000600_reports_jc_cash_flow_savings_query.sql'));
  const afterFunction=await metadata();await actor();
  await check('optimized reader preserves exact approved reports for both horizons',async()=>{
   const canonical=value=>({...value,issues:value.issues.map(i=>({...i,months:[...i.months].sort(),sourceIds:[...i.sourceIds].sort(),affectedKinds:[...i.affectedKinds].sort()}))});
   for(const from of Object.keys(approvedReports))assert.deepEqual(canonical(await report(from)),canonical(approvedReports[from]));
   const clean=({hash,...rest})=>rest;assert.deepEqual(clean(afterFunction),clean(beforeOptimization));
  });
`);
replace("assert.equal(afterFunction.hash,'94b10b95af8b16883ace97c8f85f67ab');","assert.equal(afterFunction.hash,'5bf922aa77016e0453acc141227ed944');");
replace("await db.exec(read(recovery));assert.deepEqual(await metadata(),beforeFunction);",`
   await db.exec(read('supabase/recovery/20261030000600_reports_jc_cash_flow_savings_query.sql'));
   assert.deepEqual(await metadata(),beforeOptimization);
   await db.exec(read(recovery));assert.deepEqual(await metadata(),beforeFunction);
`);
replace("path.join(dir,'savings-sql.json')","path.join(dir,'savings-query-sql.json')");
const harness=new Module(sourcePath,module);harness.filename=sourcePath;harness.paths=module.paths;harness._compile(source,sourcePath);
