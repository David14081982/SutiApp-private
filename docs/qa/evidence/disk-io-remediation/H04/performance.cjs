'use strict';
const a=require('./audit.cjs');
async function main(){
 const claims=a.principal.replace(' order by a.id',''),samples=[];
 for(let i=1;i<=3;i++){
  const rows=await a.raw("begin;set local statement_timeout='20s';"+claims+'explain(analyze,buffers,format json) '+a.photo+';rollback;');
  const plan=rows[0]['QUERY PLAN'][0],summary=a.planSummary(plan);samples.push(summary);a.save('plan-live-'+i,{at:new Date().toISOString(),query:a.photo,summary,plan});
 }
 const rows=await a.raw("begin;set local statement_timeout='20s';set local track_functions='all';"+claims+'explain(analyze,buffers,format json) '+a.photo+";set local role postgres;select schemaname,funcname,calls,total_time,self_time from pg_stat_xact_user_functions where calls>0 order by schemaname,funcname;rollback;");
 a.save('function-calls-live',{at:new Date().toISOString(),rows});
 a.save('performance-live',{at:new Date().toISOString(),status:'PASS',samples:samples.map(x=>({ms:x.ms,hits:x.hits,reads:x.reads,document_rows:x.nodes.filter(n=>n.relation==='affiliate_documents').reduce((s,n)=>s+(n.rows+n.removed)*n.loops,0),executed_document_seq_scans:x.nodes.filter(n=>n.relation==='affiliate_documents'&&n.node==='Seq Scan'&&n.loops>0).length})),function_calls:rows});
 console.log(JSON.stringify(samples.map(x=>({ms:x.ms,hits:x.hits,reads:x.reads}))));
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
