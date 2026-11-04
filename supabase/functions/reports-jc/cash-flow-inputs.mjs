// Explicit transport allowlists for the already-authorized report snapshot.
// No opaque source object, credential, bank/contact field, or PV2 AE crosses this boundary.
import {ReportError} from './report.mjs';
const fields=s=>s.split(' ');
const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
const invalid=()=>{throw new ReportError('CASH_FLOW_SOURCE_INVALID');};
function scalar(v){if(v===null||typeof v==='string'||typeof v==='boolean'||typeof v==='number'&&Number.isFinite(v))return v;return invalid();}
function object(row,keys,nested={}){
 if(!row||typeof row!=='object'||Array.isArray(row))return invalid();
 const out={};for(const k of keys)if(own(row,k)&&row[k]!==undefined)out[k]=scalar(row[k]);
 for(const [k,project]of Object.entries(nested))if(own(row,k)&&row[k]!==undefined)out[k]=project(row[k]);
 return out;
}
const array=(value,project)=>{if(!Array.isArray(value))return invalid();return value.map(project);};
const primitives=v=>array(v,scalar);
const list=keys=>v=>array(v,row=>object(row,fields(keys)));
const SAVINGS_BASES={
 history:list('account_id amount data_conflict date id includes_yield participant_id source'),
 pending:list('id participant_id date amount withdrawal_kind'),
 accounts:list('history_from id imported opening_on participant_id started_on'),
 scheduled:list('date enrollment_id participant_id plan_id scheduled_amount'),
 transactions:list('amount component contribution_date direction effective_date enrollment_id id participant_id transaction_type withdrawal_kind'),
 balance_entries:list('account_id amount date stream'),
 account_balances:list('id incomplete known_amount month'),
 current_balances:list('amount id'),
 history_metadata:list('id reference source_column source_label source_row source_sheet yield_amount yield_column'),
 account_identities:list('account_label control id name reference'),
 historical_withdrawals:list('account_id amount date id name reference source_folio'),
 opening_account_balances:list('id incomplete known_amount')
};
function savingsInputs(value){
 return object(value,fields('as_of'),{
  events:list('amount date id includes_yield kind source source_id status withdrawal_component withdrawal_kind'),
  balances:list('amount known_amount month unknown_count'),
  issues:v=>array(v,r=>object(r,fields('code message'),{affectedKinds:primitives,months:primitives,sourceIds:primitives})),
  source_bases:v=>object(v,[],SAVINGS_BASES)
 });
}
function investorInputs(value){
 if(value===null)return null;
 return object(value,fields('as_of authority financial_writes balance_projection'),{
  contracts:v=>array(v,r=>object(r,fields('id investor_id code starts_on ends_on months principal monthly_rate payment_mode status opening_balance balance_on history_complete parent_id source_status investor_name source_sheet source_row original_document source_observed_on registered_withdrawal registered_payment_day registered_monthly_yield registered_contribution registered_current_capital registered_balance_on closed_on renewed_on balance'),{terms:list('id effective_on monthly_rate')})),
  movements:list('id contract_id obligation_id effective_on concept direction amount period_start period_end'),
  obligations:list('id contract_id period_start period_end due_on concept amount principal_basis rate_snapshot origin paid'),
  reviews:list('id contract_id kind'),
  balances:v=>array(v,r=>object(r,fields('month kind amount known_amount unknown_count'),{unknown_contract_ids:primitives,source_ids:primitives,details:list('contract_id amount cutoff')}))
 });
}
const LOAN_COLUMNS=[...Array.from({length:21},(_,i)=>i).filter(i=>i!==17&&i!==19),25,26,27,28,29,32];
const REQUEST_COLUMNS=[...Array.from({length:11},(_,i)=>i),24];
function sheet(rows,columns,width){
 return array(rows,row=>{if(!Array.isArray(row))return invalid();const out=Array(width).fill(null);for(const index of columns)if(index<row.length&&row[index]!==undefined)out[index]=scalar(row[index]);return out;});
}
export function cashFlowInputSnapshot({source,savings,investors,from,consultedAt,sourceErrors={}}){
 if(!source||!savings||!Array.isArray(savings.events)||!Array.isArray(savings.balances)||typeof from!=='string'||typeof consultedAt!=='string')return invalid();
 if(sourceErrors.investors!==undefined&&sourceErrors.investors!==null&&sourceErrors.investors!=='INVESTOR_SOURCE_UNAVAILABLE')return invalid();
 return {
  version:'cash-flow-inputs-v1',modelVersion:'20261104-original-components-v1',from,consultedAt,
  source:{loans:sheet(source.loans,LOAN_COLUMNS,33),requests:sheet(source.requests,REQUEST_COLUMNS,25)},
  savings:savingsInputs(savings),investors:investorInputs(investors),
  sourceErrors:{investors:sourceErrors.investors??null}
 };
}
export const projectionInputs=cashFlowInputSnapshot;
