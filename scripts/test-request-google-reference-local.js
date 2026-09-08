'use strict';
// Actual Postgres, isolated localhost cluster, synthetic rows only. No production connection.
const fs=require('fs'),path=require('path'),cp=require('child_process'),assert=require('assert').strict;
const root=path.resolve(__dirname,'..'),dir='C:/tmp/sutiapp-reference-reconcile-20260908',original=fs.readFileSync(path.join(root,'supabase/migrations/20260908000100_requests_workflow_google_sync.sql'),'utf8'),migration=fs.readFileSync(path.join(root,'supabase/migrations/20260908000300_request_google_reference_reconciliation.sql'),'utf8');
const source=original.slice(original.indexOf('-- Transport state only.'),original.indexOf('-- Realtime carries'));
const priorFunction=original.slice(original.indexOf('create function public.finish_program_request_google_sync'),original.indexOf('create function public.request_program_request_google_sync')).trim().replace('create function','create or replace function');
const row=Array(33).fill('');row[0]='af0f53b7-a990-491c-a792-e69f30760fe4';row[1]='QA-LOCAL';row[9]='2026-09-08T12:00:00Z';row[24]='PENDIENTE';
const sql=`begin;
create role anon;create role authenticated;create role service_role bypassrls;
create schema auth;create schema extensions;
create function extensions.gen_random_uuid() returns uuid language sql as 'select pg_catalog.gen_random_uuid()';
create function auth.role() returns text language sql as $$select current_setting('request.jwt.claim.role',true)$$;
create function auth.uid() returns uuid language sql as $$select null::uuid$$;
create function public.get_effective_affiliate_id() returns uuid language sql as $$select null::uuid$$;
create function public.has_admin_permission(text) returns boolean language sql as $$select false$$;
create table public.program_requests(id uuid primary key,affiliate_id uuid,numero_control text,folio text,status text,program_id text,financial_processing_status text,legacy_reference text,updated_at timestamptz default now());
${source}
insert into public.program_requests(id,affiliate_id,numero_control,folio,status,program_id,financial_processing_status) values('${row[0]}','22222222-2222-4222-8222-222222222222','QA-LOCAL','SR-2026-000194','requires_financial_processing','prestamo','pending');
update public.program_request_google_sync set initial_row='${JSON.stringify(row)}'::jsonb,google_row=2326,synced_revision=1,phase='synced';
${migration.replace(/^begin;\s*/,'').replace(/commit;\s*$/,'')}
savepoint tests;
${fs.readFileSync(path.join(root,'scripts/test-request-google-reference-reconciliation.sql'),'utf8')}
rollback to tests;
${priorFunction}
select 'PASS_LOCAL_RELOCATION_AND_RECOVERY';rollback;`;
fs.writeFileSync(path.join(dir,'local-test.sql'),sql);
const result=cp.spawnSync('C:/Program Files/PostgreSQL/18/bin/psql.exe',['-h','127.0.0.1','-p','55498','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-f',path.join(dir,'local-test.sql')],{encoding:'utf8'});
fs.writeFileSync(path.join(dir,'local-test-output.txt'),result.stdout+'\n'+result.stderr);assert.equal(result.status,0,result.stderr);assert(result.stdout.includes('PASS_LOCAL_RELOCATION_AND_RECOVERY'));
const proof={status:'PASS',engine:'isolated PostgreSQL 18 localhost:55498',productionWrites:0,syntheticRowsOnly:true,realMigrationAndRecoveryExecuted:true,checks:['relocation and locator audit','immutable payload rejection','stale lease rejection','equal-revision retry and missing/restored errors','lease release','business request preserved','RLS/grants','recovery'],transaction:'ROLLBACK'};fs.writeFileSync(path.join(root,'docs/qa/evidence/reference-reconciliation-20260908/local-sql-tests.json'),JSON.stringify(proof,null,2)+'\n');console.log(JSON.stringify(proof));
