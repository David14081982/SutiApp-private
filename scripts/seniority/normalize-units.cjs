'use strict';
const C=require('./common.cjs'),assert=require('assert/strict');
async function main(){const db=C.connection(C.environment(),{readonly:false});await db.connect();try{
 const version='20261125000200',sql=C.fs.readFileSync(C.path.join(C.root,'supabase/migrations/'+version+'_seniority_unit_whitespace.sql'),'utf8');
 await db.query('begin');await db.query("select pg_advisory_xact_lock(hashtext('H-AFFILIATE-SENIORITY-001'))");
 assert.equal((await db.query('select version from supabase_migrations.schema_migrations where version=$1',[version])).rows.length,0);
 const fingerprint="select md5(jsonb_agg(to_jsonb(a) order by id)::text) v from public.affiliates a",before=(await db.query(fingerprint)).rows[0];
 const metadata="select oid,proowner,proacl::text,prosecdef,proconfig from pg_proc where oid='public.get_affiliate_seniority(integer,integer)'::regprocedure",security=(await db.query(metadata)).rows[0];
 await db.query(sql.replace(/^begin;\s*/,'').replace(/\s*commit;\s*$/,''));assert.deepEqual((await db.query(fingerprint)).rows[0],before);assert.deepEqual((await db.query(metadata)).rows[0],security);
 await db.query('insert into supabase_migrations.schema_migrations(version,name,statements) values($1,$2,$3)',[version,'seniority_unit_whitespace',[sql]]);await db.query('commit');
 const proof={status:'PASS',version,sha256:C.sha(sql),affiliateRowsUnchanged:true,functionSecurityUnchanged:true,normalization:'surrounding spaces, tabs, CR and LF only',businessWrites:0};C.fs.writeFileSync(C.path.join(C.root,'docs/qa/evidence/seniority/unit-normalization.json'),JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
}catch(e){await db.query('rollback');throw e;}finally{await db.end();}}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
