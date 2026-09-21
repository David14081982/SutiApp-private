/* Server-owned private Savings review. No local financial authority. */
(function(){
 'use strict';
 async function rpc(name,args){const {data,error}=await window.SutiSupabase.getClient().rpc(name,args);if(error)throw error;return data;}
 async function settlement(action,requestId,command,key){
  const {data,error}=await window.SutiSupabase.getClient().functions.invoke('savings-settlement',{body:{action,request_id:requestId,command:command||{},key:key||null}});
  if(error){let body;try{body=await error.context.clone().json();}catch(_){}throw Error(body&&body.error||'SAVINGS_LOAN_VERIFICATION_UNAVAILABLE');}
  if(!data||data.error||!data.data)throw Error(data&&data.error||'SAVINGS_LOAN_VERIFICATION_UNAVAILABLE');return data.data;
 }
 window.SavingsPanelRepository=Object.freeze({
  list:q=>rpc('get_admin_savings_panel',{p_tab:q.tab,p_search:q.search||'',p_filter:q.filter||'todos',p_offset:q.offset||0,p_limit:20}),
  detail:(id,offset=0,limit=6)=>rpc('get_admin_savings_panel_detail',{p_record_id:id,p_history_offset:offset,p_history_limit:limit}),
  affiliate:id=>rpc('get_admin_savings_panel_affiliate',{p_affiliate_id:id}),
  request:id=>rpc('get_admin_savings_panel_request',{p_record_id:id}),
  neighbor:c=>rpc('get_admin_savings_panel_neighbor',{p_record_id:c.id,p_tab:c.tab,p_search:c.search||'',p_filter:c.filter||'todos',p_direction:c.direction}),
  reset:c=>rpc('admin_reset_savings_panel_discount',{p_record_id:c.id,p_version:c.version,p_field:c.field,p_observation:c.observation||null,p_client_action_id:c.key}),
  save:c=>rpc('admin_save_savings_panel',{p_record_id:c.id,p_version:c.version,p_changes:c.changes,p_status:c.status,p_observation:c.observation||null,p_client_action_id:c.key}),

  financial:(id,until=null)=>rpc('get_admin_savings_financial_account',{p_record_id:id,p_until:until}),
  previewBalance:c=>rpc('preview_savings_balance_certification',{p_record_id:c.id,p_command:c.command}),
  confirmBalance:c=>rpc('admin_confirm_savings_balance',{p_record_id:c.id,p_command:c.command,p_fingerprint:c.fingerprint,p_client_action_id:c.key}),
  receipt:c=>rpc('admin_confirm_savings_receipt',{p_record_id:c.id,p_date:c.date,p_actual:c.actual,p_version:c.version,p_observation:c.observation||null,p_client_action_id:c.key}),
  adjustBalance:c=>rpc('admin_adjust_savings_balance',{p_record_id:c.id,p_capital:c.capital,p_yield:c.yield,p_version:c.version,p_observation:c.observation||null,p_client_action_id:c.key}),
  acceptSource:c=>rpc('admin_accept_savings_source',{p_record_id:c.id,p_observation_id:c.updateId,p_version:c.version,p_client_action_id:c.key}),
  publicationAccountPreview:id=>rpc('get_admin_savings_publication_account_preview',{p_participant_id:id}),
  publicationStatus:()=>rpc('get_admin_savings_publication_status',{}),
  publicationPreview:id=>rpc('get_admin_savings_publication_preview',{p_record_id:id}),
  publish:c=>rpc('admin_publish_savings',{p_version:c.version,p_fingerprint:c.fingerprint,p_confirmed:c.confirmed,p_client_action_id:c.key}),
  runtimeRequests:(folio=null)=>rpc('get_admin_savings_runtime_requests',{p_folio:folio}),
  operation:c=>c.command.kind==='SETTLE'?settlement('SETTLE',c.command.request_id,c.command,c.key):rpc('admin_save_savings_operation',{p_command:c.command,p_client_action_id:c.key}),
  checkWithdrawal:id=>settlement('PREVIEW',id),
  authorizeWithdrawal:c=>settlement('OVERRIDE',c.requestId,c.command,c.key),
  revokeException:c=>rpc('admin_revoke_savings_exception',{p_event_id:c.eventId,p_reason:c.reason,p_key:c.key}),
  authorizeYieldOverride:c=>rpc('admin_authorize_savings_yield_override',{p_period_id:c.periodId,p_participant_id:c.participantId||null,p_reason:c.reason,p_justification:c.justification,p_confirmed:c.confirmed===true,p_key:c.key}),
  report:c=>rpc('get_admin_savings_period_report',{p_from:c.from,p_to:c.to}),
  nativeFinancial:(participantId,until=null)=>rpc('get_admin_savings_account',{p_participant_id:participantId,p_until:until}),
  nativeList:q=>rpc('get_admin_savings_native_accounts',{p_search:q.search||'',p_offset:q.offset||0,p_limit:20,p_filter:q.filter||'todos'}),
  nativeReceipt:c=>rpc('admin_confirm_savings_account_receipt',{p_participant_id:c.participantId,p_enrollment_id:c.enrollmentId,p_date:c.date,p_actual:c.actual,p_version:c.version,p_observation:c.observation||null,p_client_action_id:c.key}),
 });
})();
