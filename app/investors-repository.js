(function(){
 'use strict';
 function context(){
  const auth=window.AffiliateAuth?.getState(),admin=window.AdminRepository?.getState();
  if(auth?.phase!=='authenticated'||!auth.session?.user?.id)throw Error('AUTH_REQUIRED');
  let session=auth.session.session_id||'';
  if(!session&&auth.session.access_token){try{session=JSON.parse(atob(auth.session.access_token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))).session_id||'';}catch(_){}}
  return {actor:auth.session.user.id,effective_affiliate:auth.affiliate?.id||null,session,key:JSON.stringify([auth.session.user.id,session,auth.affiliate?.id,auth.impersonation,admin?.phase,admin?.subjectKey,admin?.assignment])};
 }
 async function rpc(name,args){
  const before=context(),client=window.SutiSupabase?.getClient();if(!client)throw Error('SOURCE_UNAVAILABLE');
  const result=await client.rpc(name,args);
  if(context().key!==before.key)throw Error('CONTEXT_CHANGED');
  if(result.error)throw result.error;
  const c=result.data?.context;
  if(!c||c.actor!==before.actor||c.effective_affiliate!==before.effective_affiliate||(before.session&&c.session!==before.session))throw Error('CONTEXT_CHANGED');
  if(result.data.data==null)throw Error('SOURCE_UNAVAILABLE');return result.data.data;
 }
 window.InvestorsRepository=Object.freeze({contextKey:()=>context().key,
  load:id=>rpc('get_admin_investors',{p_investor_id:id||null}),
  save:(action,values,id)=>rpc('save_admin_investors',{p_action:action,p_values:values,p_action_id:id}),
  document:id=>rpc('investors_document',{p_id:id}),
  upload:(values,id)=>rpc('investors_document',{p_values:values,p_action_id:id}),
  source:(sheet,row)=>rpc('get_admin_investors_source',{p_sheet:sheet,p_row:row})
 });
})();
