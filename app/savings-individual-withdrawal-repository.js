/* Individual Admin Savings availability. No balances or local persistence. */
(function(){
 'use strict';
 async function rpc(name,args){const {data,error}=await window.SutiSupabase.getClient().rpc(name,args);if(error)throw error;return data;}
 window.SavingsIndividualWithdrawalRepository=Object.freeze({
  get:folio=>rpc('get_admin_savings_individual_withdrawal',{p_folio:folio}),
  set:c=>rpc('admin_set_savings_individual_withdrawal',{p_folio:c.folio,p_enabled:c.enabled,p_until:c.until,p_reason:c.reason,p_version:c.version,p_key:c.key})
 });
})();
