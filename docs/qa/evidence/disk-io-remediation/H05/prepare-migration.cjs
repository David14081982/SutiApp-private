'use strict';
const fs=require('fs'),path=require('path'),a=require('./audit.cjs');
const root=path.resolve(__dirname,'../../../../..'),file='20260907000500_savings_read_work.sql';
const indexName='savings_legacy_evidence_participant_type_source_idx';
const candidate=fs.readFileSync(a.dir+'/conditional-reader.sql','utf8').replace('create function public.','create or replace function public.');
const recovery=candidate.slice(0,candidate.indexOf(' -- An unfamiliar'))+` return jsonb_build_object('version',null,'modified',true,'cacheable',false,'context',v_context,
  'data',public.get_self_savings_live_readonly());
end;
$function$;
alter function public.get_self_savings_if_changed(text) owner to postgres;
revoke all on function public.get_self_savings_if_changed(text) from public,anon,authenticated;
grant execute on function public.get_self_savings_if_changed(text) to authenticated;
`;
async function main(){
 if(!fs.existsSync(path.join(root,'AGENTS.md')))throw Error('WORKSPACE_ROOT_INVALID');
 const defs=await a.raw("begin;set local lock_timeout='2s';"+candidate+"create temporary table h05_defs as select 'optimized' label,md5(pg_get_functiondef('public.get_self_savings_if_changed(text)'::regprocedure)) hash;"+recovery+"insert into h05_defs select 'recovery',md5(pg_get_functiondef('public.get_self_savings_if_changed(text)'::regprocedure));select * from h05_defs;rollback;");
 const hashes=Object.fromEntries(defs.map(x=>[x.label,x.hash]));a.save('object-hashes',hashes);
 const guard=`do $guard$
declare f regprocedure:=to_regprocedure('public.get_self_savings_if_changed(text)'); i regclass:=to_regclass('public.${indexName}');
begin
 if md5(pg_get_functiondef('public.get_self_savings_live_readonly()'::regprocedure))<>'74f504337e4f336e6b12da3ab32f30a6'
 or md5(pg_get_functiondef('public.savings_effective_action(text,uuid)'::regprocedure))<>'407fefd589bc4f840a0fc36d988e831b'
 then raise exception 'H05_FINANCIAL_READER_DRIFT';end if;
 if f is not null and (md5(pg_get_functiondef(f))<>all(array['${hashes.optimized}','${hashes.recovery}'])
 or not(select prosecdef and provolatile='s' and proowner='postgres'::regrole and proconfig=array['search_path=""'] from pg_proc where oid=f)
 or has_function_privilege('anon',f,'EXECUTE') or not has_function_privilege('authenticated',f,'EXECUTE'))
 then raise exception 'H05_ENDPOINT_DRIFT';end if;
 if i is not null and (pg_get_indexdef(i)<>'CREATE INDEX ${indexName} ON public.savings_legacy_evidence USING btree (participant_id, record_type, source_sheet, source_row DESC)'
 or not(select indisvalid and indisready from pg_index where indexrelid=i)) then raise exception 'H05_INDEX_DRIFT';end if;
 if not(select relrowsecurity from pg_class where oid='public.savings_legacy_evidence'::regclass) then raise exception 'H05_RLS_DRIFT';end if;
end;
$guard$;
`;
 const header="-- H05: access-path optimization only. Original financial SQL and historical rows remain unchanged.\nbegin;\nset local lock_timeout='2s';\nset local statement_timeout='30s';\nset local search_path='';\n";
 const migration=header+guard+`create index if not exists ${indexName} on public.savings_legacy_evidence (participant_id,record_type,source_sheet,source_row DESC);\n`+candidate+guard+'commit;\n';
 const recover=header+guard+'-- Keep a fresh delegating endpoint for already-open H05 clients. Publish old frontend separately.\n'+recovery+`drop index if exists public.${indexName};\n`+guard+'commit;\n';
 for(const [folder,content] of [['migrations',migration],['recovery',recover]])fs.writeFileSync(path.join(root,'supabase',folder,file),content);
 console.log(JSON.stringify({status:'PREPARED',hashes,index:indexName}));
}
if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1;});
module.exports={main,indexName,file};
