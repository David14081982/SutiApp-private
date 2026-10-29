'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),crypto=require('crypto');
const {PGlite}=require(process.env.INVESTORS_PGLITE_MODULE||'../.tmp/inversores/deps/node_modules/@electric-sql/pglite');
const {build}=require('./import-investors'),root=path.resolve(__dirname,'..');
async function main(){const db=new PGlite();try{
 const payload=JSON.parse(fs.readFileSync(path.join(root,'.tmp/inversores/import.json'),'utf8')),bytes=fs.readFileSync(process.argv[2]||'C:/Users/david/Downloads/JC Inversiones.xlsx');
 await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create function auth.uid() returns uuid language sql as $$select null::uuid$$;create function auth.jwt() returns jsonb language sql as $$select '{}'::jsonb$$;create function public.get_effective_affiliate_id() returns uuid language sql as $$select null::uuid$$;create function public.has_admin_permission(text) returns boolean language sql as $$select false$$;create function public.admin_module_boundary(text[],text) returns boolean language sql as $$select false$$;`);
 await db.exec(fs.readFileSync(path.join(root,'supabase/migrations/20261029000100_investors.sql'),'utf8'));
 const sql=build(payload,bytes);await db.exec('begin;'+sql+'commit;');
 const snapshot=async()=>(await db.query(`select jsonb_build_object('investors',(select count(*) from investors_private.investors),'contracts',(select count(*) from investors_private.contracts),'sourceRows',(select count(*) from investors_private.source_rows),'movements',(select count(*) from investors_private.movements),'obligations',(select count(*) from investors_private.obligations),'reviews',(select count(*) from investors_private.reviews),'contractHash',(select md5(jsonb_agg(to_jsonb(c) order by id)::text) from investors_private.contracts c),'sourceHash',(select md5(jsonb_agg(to_jsonb(s) order by id)::text) from investors_private.source_rows s)) s`)).rows[0].s;
 const before=await snapshot();await db.exec('begin;'+sql+'commit;');assert.deepEqual(await snapshot(),before);
 assert.equal(before.investors,payload.investors.length);assert.equal(before.contracts,payload.contracts.length);assert.equal(before.sourceRows,payload.evidence.length);assert.equal(before.movements,0);assert(before.obligations>0);
 const active=(await db.query("select count(*)::int n from investors_private.contracts where status='active'")).rows[0].n;assert.equal(active,payload.summary.active_snapshots);
 assert.equal((await db.query("select count(*)::int n from investors_private.obligations where due_on<'2026-10-29'::date")).rows[0].n,0);
 const restored=(await db.query("select encode(workbook,'base64') b from investors_private.imports")).rows[0].b;assert.deepEqual(Buffer.from(restored,'base64'),bytes);
 const references=payload.contracts.reduce((n,c)=>n+c.references.length,0);assert(references>payload.contracts.length);assert(payload.rows.some(r=>r.kind==='other'));assert(payload.rows.some(r=>r.kind==='amendment'));
 const evidence={status:'PASS',sourceSha256:payload.sha256,sheets:payload.summary.sheets,investors:before.investors,contracts:before.contracts,activeSnapshots:active,sourceRows:before.sourceRows,reviews:before.reviews,retainedContractReferences:references,duplicateRerun:'identical hashes and counts',originalWorkbookRecovery:'byte-identical',realizedPaymentsInferred:0,futureMonthlyObligations:before.obligations,historicalObligationsInferred:0,existingBusinessWrites:0};
 fs.mkdirSync(path.join(root,'docs/qa/evidence/investors'),{recursive:true});fs.writeFileSync(path.join(root,'docs/qa/evidence/investors/import.json'),JSON.stringify(evidence,null,2)+'\n');console.log(JSON.stringify(evidence));
 }finally{await db.close();}}
main().catch(e=>{console.error(e.message,e.detail||'');process.exitCode=1;});
