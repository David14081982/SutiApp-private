'use strict';
const fs=require('fs'),path=require('path');
const {query,body}=require('./savings-admin-review-db'),{prepare,json}=require('./import-savings-admin-review'),{verify}=require('./test-savings-admin-review-import');
async function main(){
 const dir=path.resolve(process.argv[2]||'');if(!process.argv[2]||!path.relative(path.resolve(__dirname,'..'),dir).startsWith('..'))throw Error('PRIVATE_DIRECTORY_REQUIRED');
 const data=prepare(dir);verify(data);
 const current=await query(`select id,source_sheet,source_row,source_data,field_defs,raw_source,version,md5(jsonb_build_object('data',source_data,'defs',field_defs,'raw',raw_source)::text) fingerprint from public.savings_review_records`);
 const map=new Map(current.map(r=>[r.source_sheet+':'+r.source_row,r])),updates=[];
 const canonical=v=>JSON.stringify(v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,JSON.parse(canonical(v[k]))])):Array.isArray(v)?v.map(x=>JSON.parse(canonical(x))):v);
 for(const r of data.records){const before=map.get(r.source_sheet+':'+r.source_row);if(!before||before.version!==0||canonical(before.raw_source)!==canonical(r.raw_source))throw Error('PREPUBLICATION_RAW_OR_VERSION_CHANGED');
  if(canonical(before.source_data)!==canonical(r.source_data)||canonical(before.field_defs)!==canonical(r.field_defs)){
   const changed=Object.fromEntries(Object.entries(r.source_data).filter(([k,v])=>canonical(v)!==canonical(before.source_data[k])));
   const defs=Object.fromEntries(r.field_defs.filter(d=>canonical(d)!==canonical(before.field_defs.find(old=>old.key===d.key))).map(d=>[d.key,d]));
   updates.push({id:before.id,fingerprint:before.fingerprint,data:changed,defs});
  }
 }
 if(!updates.length){console.log('Already normalized; no changes');return;}
 const forward='supabase/migrations/20260906000600_savings_review_import_normalization.sql',recovery='supabase/recovery/20260906000600_savings_review_import_normalization_recovery.sql';
 const sql=`begin;
 lock table public.savings_review_records,public.savings_review_events in access exclusive mode;
 do $$ begin if exists(select 1 from public.savings_review_records where version<>0 or proposed_data<>'{}'::jsonb) or exists(select 1 from public.savings_review_events) then raise exception 'REVIEW_ALREADY_STARTED';end if;end $$;
 ${body(forward)}
 create temporary table review_fix_input on commit drop as select * from jsonb_to_recordset(${json(updates)}) as x(id uuid,fingerprint text,data jsonb,defs jsonb);
 do $$ begin if exists(select 1 from review_fix_input x left join public.savings_review_records r on r.id=x.id where r.id is null or md5(jsonb_build_object('data',r.source_data,'defs',r.field_defs,'raw',r.raw_source)::text)<>x.fingerprint) then raise exception 'IMPORT_CHANGED';end if;end $$;
 insert into public.savings_review_import_normalizations(record_id,source_data_before,field_defs_before,source_data_after,field_defs_after)
 select r.id,r.source_data,r.field_defs,r.source_data||x.data,
 (select jsonb_agg(coalesce(x.defs->(v.d->>'key'),v.d) order by v.ordinal) from jsonb_array_elements(r.field_defs) with ordinality v(d,ordinal))
 from public.savings_review_records r join review_fix_input x on x.id=r.id;
 alter table public.savings_review_records disable trigger savings_review_source_guard;
 update public.savings_review_records r set source_data=x.source_data_after,field_defs=x.field_defs_after from public.savings_review_import_normalizations x where x.record_id=r.id;
 alter table public.savings_review_records enable trigger savings_review_source_guard;
 do $$ begin if exists(select 1 from public.savings_review_import_normalizations x join public.savings_review_records r on r.id=x.record_id where r.source_data<>x.source_data_after or r.field_defs<>x.field_defs_after or r.version<>0) then raise exception 'NORMALIZATION_FAILED';end if;end $$;
 select count(*)::integer normalized_records from public.savings_review_import_normalizations;
 ${process.argv.includes('--apply')?'commit;':'rollback;'}
 `;
 if(!process.argv.includes('--apply'))await query(`begin;${body(forward)}${body(recovery)}rollback;`);
 const result=await query(sql);const report={status:'PASS',mode:process.argv.includes('--apply')?'APPLIED':'ROLLBACK',records:updates.length,raw_source_unchanged:true,review_events:0,financial_writes:0,result};
 fs.writeFileSync('docs/qa/evidence/savings-admin-review-20260906/normalization-'+(process.argv.includes('--apply')?'applied':'test')+'.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
