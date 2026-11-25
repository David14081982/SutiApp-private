'use strict';
// Read-only SQL role probes: no Auth tokens, new accounts or impersonation sessions are created.
const C=require('./common.cjs'),assert=require('assert/strict');
async function main(){const db=C.connection(C.environment());await db.connect();try{
 const actors=(await db.query("select a.auth_user_id id from public.affiliates a join auth.users u on u.id=a.auth_user_id where not a.is_archived and u.email_confirmed_at is not null and a.historical_email_normalized=lower(btrim(u.email)) order by a.id limit 30")).rows;
 let found=false;for(const actor of actors){await db.query('begin read only');try{
  await db.query("select set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claims',$2,true)",[actor.id,JSON.stringify({sub:actor.id,role:'authenticated'})]);await db.query('set local role authenticated');
  const access=(await db.query("select public.get_current_affiliate_access_state() state,public.has_admin_permission('affiliates.read') admin")).rows[0];if(access.state!=='ACTIVE'||access.admin)continue;
  const result=(await db.query("select (public.get_affiliate_seniority(0,1)->>'total')::int total,(select count(*)::int from public.affiliates) direct_rows")).rows[0];assert(result.total>1);assert.equal(result.direct_rows,1);
  found=true;const proof={status:'PASS',method:'read-only PostgreSQL authenticated-role probe using an existing non-admin identity; not an HTTP login',directoryTotal:result.total,directAffiliateRows:result.direct_rows,existingRlsRestrictsDirectReads:true,createdAuthAccounts:0,createdImpersonationSessions:0,businessWrites:0};C.fs.writeFileSync(C.path.join(C.root,'docs/qa/evidence/seniority/access.json'),JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));break;
 }finally{await db.query('rollback');}}
 assert(found,'NO_EXISTING_ORDINARY_IDENTITY_FOR_PROBE');
}finally{await db.end();}}
main().catch(e=>{console.error(e.code||e.message);process.exitCode=1;});
