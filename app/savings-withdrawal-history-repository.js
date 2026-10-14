/* Read-only withdrawal history. Existing Savings and document authorities remain unchanged. */
(function(){
 'use strict';
 async function list({search='',status='all',offset=0,limit=20,signal}={}){
  const savings=window.SavingsPanelRepository,context=savings.contextKey(),revision=savings.revision();
  let request=window.SutiSupabase.getClient().rpc('get_admin_savings_withdrawal_history',{p_search:search,p_status:status,p_offset:offset,p_limit:limit});
  if(signal)request=request.abortSignal(signal);
  const {data,error}=await request;
  if(context!==savings.contextKey()||revision!==savings.revision())throw Error('SAVINGS_CONTEXT_CHANGED');
  if(error)throw error;
  if(!data||!Array.isArray(data.rows)||!Number.isInteger(data.total)||data.total<0)throw Error('SAVINGS_HISTORY_RESPONSE_INVALID');
  return data;
 }
 window.SavingsWithdrawalHistoryRepository=Object.freeze({list});
})();
