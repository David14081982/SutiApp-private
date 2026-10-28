'use strict';
// Read-only evidence. Customer rows stay in the ignored private task directory.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert/strict');
const {query,environment}=require('./inspect-loan-history');
const root=path.resolve(__dirname,'..'),dir=path.join(root,'.tmp/loan-historical-resolution');
const out=path.join(root,'docs/qa/evidence/loan-historical-resolution');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
function save(name,value,publicFile=false){const file=path.join(publicFile?out:dir,name);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,Buffer.isBuffer(value)?value:JSON.stringify(value,null,2)+'\n');}
async function main(){
 fs.mkdirSync(dir,{recursive:true});fs.mkdirSync(out,{recursive:true});
 const mode=process.argv[2];
 if(mode==='baseline'){
  const helper=path.join(root,'scripts/backup-loan-available-credit.js');
  const parse=new Function('require','__dirname','module',fs.readFileSync(helper,'utf8')+'\nreturn eszipSources;')(require('module').createRequire(helper),path.dirname(helper),{});
  const env=environment(),url='https://api.supabase.com/v1/projects/'+new URL(env.SUPABASE_URL).hostname.split('.')[0]+'/functions/financial-legacy';
  const get=async u=>{const r=await fetch(u,{headers:{Authorization:'Bearer '+env.SUPABASE_ACCESS_TOKEN},signal:AbortSignal.timeout(55000)});assert(r.ok,'EDGE_HTTP_'+r.status);return r;};
  const before=await(await get(url)).json(),body=Buffer.from(await(await get(url+'/body')).arrayBuffer()),after=await(await get(url)).json();
  assert.equal(before.version,after.version);assert.equal(before.verify_jwt,true);assert.equal(before.status,'ACTIVE');
  save('before/edge-metadata.json',before);save('before/edge.eszip',body);
  const sources=parse(body);for(const file of sources){const destination=path.join(dir,'before/functions',file.name);fs.mkdirSync(path.dirname(destination),{recursive:true});fs.writeFileSync(destination,file.source);}
  const cohort=fs.readFileSync(path.join(root,'.tmp/loan-funds-12087/cohort-private.json'));
  const result={status:'PASS',at:new Date().toISOString(),version:before.version,verifyJwt:true,bodySha256:sha(body),cohortSha256:sha(cohort),files:sources.map(f=>({name:f.name,sha256:sha(f.source)})),businessWrites:0};
  save('baseline.json',result,true);console.log(JSON.stringify(result));return;
 }
 if(mode==='metadata'){
  const result=(await query(`select jsonb_build_object(
   'columns',(select jsonb_agg(jsonb_build_object('table',table_name,'column',column_name,'type',data_type)) from information_schema.columns where table_schema='public' and table_name in('program_catalog_items','financial_funds','financial_rules','financial_configuration_audit','program_requests','membership_offerings')),
   'functions',(select jsonb_agg(jsonb_build_object('signature',p.oid::regprocedure::text,'definition',pg_get_functiondef(p.oid),'acl',p.proacl::text)) from pg_proc p where p.pronamespace='public'::regnamespace and p.proname in('get_loan_capacity_runtime','membership_payment_contract','financial_runtime_rules_for_batch','resolve_suti_loan_quote_contract','get_current_affiliate_financial_context'))
  ) result`))[0].result;
  save('metadata.json',result);console.log(JSON.stringify({tables:[...new Set(result.columns.map(x=>x.table))],columns:result.columns,functions:result.functions.map(x=>x.signature),businessWrites:0}));return;
 }
 if(mode==='provenance'){
  const result=(await query(`select jsonb_build_object(
   'funds',(select jsonb_agg(to_jsonb(f)-'updated_by') from public.financial_funds f),
   'fund_audit',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'resource_type',resource_type,'resource_id',resource_id,'action',action,'old_value',old_value,'new_value',new_value,'reason',reason,'created_at',created_at)),'[]') from public.financial_configuration_audit where resource_type ilike '%fund%'),
   'catalog',(select jsonb_agg(jsonb_build_object('id',id,'program_key',program_key,'name',name,'record_origin',record_origin,'source_sheet',source_sheet,'source_row_ordinal',source_row_ordinal,'source_snapshot_hash',source_snapshot_hash,'source_payload',source_payload,'financing_config',financing_config)) from public.program_catalog_items),
   'memberships',(select jsonb_agg(jsonb_build_object('id',id,'concept',concept,'source_sheet',source_sheet,'source_row_ordinal',source_row_ordinal,'source_snapshot_hash',source_snapshot_hash)) from public.membership_offerings),
   'request_contracts',(select jsonb_agg(jsonb_build_object('id',id,'folio',folio,'affiliate_id',affiliate_id,'program_id',program_id,'program_item_id',program_item_id,'membership_offering_id',membership_offering_id,
     'status',status,'financial_processing_status',financial_processing_status,'legacy_reference',legacy_reference,
     'contract',jsonb_build_object('contract_version',financial_submission_snapshot->'contract_version','version',financial_submission_snapshot->'version','source',financial_submission_snapshot->'source','program',financial_submission_snapshot->'program','program_id',financial_submission_snapshot->'program_id','fund',financial_submission_snapshot->'fund','criterion_identity',financial_submission_snapshot->'criterion_identity','calculationContractVersion',financial_submission_snapshot->'calculationContractVersion','offeringId',financial_submission_snapshot->'offeringId','productFinancing',financial_submission_snapshot->'productFinancing')))
    from public.program_requests where program_id<>'prestamo'),
   'null_control_affiliates',(select jsonb_agg(jsonb_build_object('id',id,'numero_control',numero_control,'full_name',full_name)) from public.affiliates where not is_archived and numero_control is null)
   ) result`))[0].result;
  save('provenance-private.json',result);console.log(JSON.stringify({funds:result.funds?.length,fundAudit:result.fund_audit?.length,catalog:result.catalog?.length,memberships:result.memberships?.length,nonloanRequestContracts:result.request_contracts?.length,nullControls:result.null_control_affiliates?.length,businessWrites:0}));return;
 }
 throw Error('MODE_NOT_SUPPORTED');
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
