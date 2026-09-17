'use strict';
// Builds supabase/recovery/20260916000200_voting_live.sql from the exact function definitions saved in the restore point.
const fs=require('fs'),path=require('path'),{query}=require('./voting-live-db');
const root=path.resolve(__dirname,'..');
const replaced=['voting_question_result(uuid,integer)','list_voting_consultations(boolean)','cast_voting_vote(uuid,uuid,text)','save_voting_consultation(uuid,integer,jsonb)','voting_consultation_action(uuid,integer,text)','export_voting_consultation(uuid,boolean)'];
(async()=>{
 const rows=await query(`select signature,definition,md5 from voting_restore_private.functions_20260916 where signature in (${replaced.map(s=>`'${s}'`).join(',')}) order by signature`);
 if(rows.length!==replaced.length)throw Error('RESTORE_POINT_DEFINITIONS_MISSING');
 for(const row of rows)if(!row.definition.includes('$function$'))throw Error('UNEXPECTED_DOLLAR_QUOTE '+row.signature);
 const expected=Object.fromEntries(rows.map(r=>[r.signature,r.md5]));
 const sql=`begin;
set local lock_timeout='5s';
set local statement_timeout='120s';
-- Recovery for 20260916000200_voting_live (H-SUTIAPP-VOTACIONES-LIVE-002).
-- Returns the voting backend to restore point voting_restore_private.*_20260916 without deleting consultations, questions, votes or audit.
-- Run together with a frontend revert of the release commit (baseline tag: restore/pre-votacion-en-vivo-20260916).
do $realtime$ begin
 if exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='voting_live_state') then
  alter publication supabase_realtime drop table public.voting_live_state;
 end if;
end $realtime$;
drop policy if exists voting_live_state_read on public.voting_live_state;
revoke all on public.voting_live_state from public,anon,authenticated;
drop function if exists public.set_voting_active_question(uuid,uuid);
drop function if exists public.get_voting_live(uuid);
drop function if exists public.count_voting_electorate(jsonb);
drop function if exists public.voting_live_visible(uuid);

-- Exact definitions captured in the restore point (pg_get_functiondef); create or replace keeps their ACL.
${rows.map(r=>`-- ${r.signature} md5 ${r.md5}\n${r.definition.trim()};`).join('\n\n')}

drop function if exists public.voting_live_touch(uuid);
drop function if exists public.voting_electorate(jsonb);

-- The restored contract needs a manual electorate > 0; only zeros are lifted, no other value changes.
update public.voting_consultations set electorate=1 where electorate<1;
alter table public.voting_consultations drop constraint voting_consultations_electorate_check;
alter table public.voting_consultations add constraint voting_consultations_electorate_check check(electorate>0);

-- voting_live_state stays as inert history (no browser grant, not published); activations also remain in admin_audit_log.
do $verify$ declare expected jsonb:='${JSON.stringify(expected)}'; k text; begin
 for k in select jsonb_object_keys(expected) loop
  if md5(pg_get_functiondef(('public.'||k)::regprocedure)) is distinct from expected->>k then raise exception 'VOTING_LIVE_RECOVERY_MISMATCH:%',k; end if;
 end loop;
end $verify$;
notify pgrst,'reload schema';
commit;
`;
 const file=path.join(root,'supabase/recovery/20260916000200_voting_live.sql');
 fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,sql.replace(/\r\n/g,'\n'));
 console.log(JSON.stringify({status:'WRITTEN',file:path.relative(root,file),functions:rows.length,bytes:Buffer.byteLength(sql)}));
})().catch(e=>{console.error(e.message);process.exitCode=1;});
