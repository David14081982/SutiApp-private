'use strict';
const a=require('./audit.cjs'),{env}=a;
async function main(){
 const stage=process.argv[2]||'start';
 const data=await a.query("select clock_timestamp() captured_at,xact_commit,xact_rollback,blks_read,blks_hit,temp_files,temp_bytes,deadlocks,stats_reset,(select count(*) from pg_stat_activity) connections,(select count(*) from pg_stat_activity where wait_event_type='Lock') lock_waiters from pg_stat_database where datname=current_database()");
 a.save('observation-'+stage,data[0]);
 if(stage==='end'){
  const first=require('./observation-start.json'),last=data[0],delta={};
  for(const k of ['xact_commit','xact_rollback','blks_read','blks_hit','temp_files','temp_bytes','deadlocks'])delta[k]=last[k]-first[k];
  a.save('observation-summary',{start:first.captured_at,end:last.captured_at,seconds:(Date.parse(last.captured_at)-Date.parse(first.captured_at))/1000,stats_reset_equal:first.stats_reset===last.stats_reset,delta,connections:[first.connections,last.connections],lock_waiters:[first.lock_waiters,last.lock_waiters]});
  const sql="select log_attributes['parsed.sql_state_code'] sqlstate,count() errors from logs where source='postgres_logs' and log_attributes['parsed.error_severity']='ERROR' group by sqlstate order by errors desc limit 30";
  const url=new URL('https://api.supabase.com/v1/projects/jsucdyothkuptosvskqf/analytics/endpoints/logs');url.searchParams.set('sql',sql);url.searchParams.set('iso_timestamp_start',new Date(first.captured_at).toISOString());url.searchParams.set('iso_timestamp_end',new Date(last.captured_at).toISOString());
  const r=await fetch(url,{headers:{Authorization:'Bearer '+env().SUPABASE_ACCESS_TOKEN},signal:AbortSignal.timeout(20000)}),logs=await r.json();
  a.save('logs-observation',{status:r.status,start:first.captured_at,end:last.captured_at,data:logs,limitation:'Log ingestion may lag; finite window, not a future guarantee.'});
  console.log(JSON.stringify({delta,logs_status:r.status,logs}));
 }else console.log('Observation start captured');
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
