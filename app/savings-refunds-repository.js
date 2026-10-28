/* Canonical refund cases, with context-bound reads and idempotent commands. */
(function(){
 'use strict';
 function context(){
  const auth=window.AffiliateAuth?.getState(),admin=window.AdminRepository?.getState();
  if(auth?.phase!=='authenticated'||!auth.session?.user?.id)throw Error('AUTH_REQUIRED');
  let session=auth.session.session_id||'';
  if(!session&&auth.session.access_token){try{session=JSON.parse(atob(auth.session.access_token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))).session_id||'';}catch(_){}}
  return JSON.stringify([auth.session.user.id,session,auth.affiliate?.id,auth.impersonation,admin?.phase,admin?.subjectKey,admin?.assignment]);
 }
 async function rpc(name,args){const key=context(),{data,error}=await window.SutiSupabase.getClient().rpc(name,args);if(context()!==key)throw Error('CONTEXT_CHANGED');if(error)throw error;return data;}
 window.SavingsRefundsRepository=Object.freeze({
  contextKey:context,
  list:values=>rpc('get_admin_savings_refunds',{p_case_id:values?.case_id||null,p_folio:values?.folio||null}),
  people:values=>rpc('get_admin_savings_refund_people',{p_search:values?.search||''}),
  regularization:values=>rpc('get_admin_savings_regularization',{p_year:values?.year,p_folio:values?.folio||null}),
  save:(command,key)=>{if(!key)throw Error('IDEMPOTENCY_KEY_REQUIRED');return rpc('save_admin_savings_refund',{p_command:command,p_client_action_id:key});},
  saveTermination:(command,key)=>{if(!key)throw Error('IDEMPOTENCY_KEY_REQUIRED');return rpc('save_admin_savings_termination',{p_command:command,p_client_action_id:key});}
 });
})();
