/* Reportes JC: authenticated read-only projection. Nothing persists in the browser. */
(function(){
 'use strict';
 function context(){
  const auth=window.AffiliateAuth?.getState(),admin=window.AdminRepository?.getState();
  if(auth?.phase!=='authenticated'||!auth.session?.user?.id)throw Error('AUTH_REQUIRED');
  let session=auth.session.session_id||'';
  if(!session&&auth.session.access_token){try{session=JSON.parse(atob(auth.session.access_token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))).session_id||'';}catch(_){}}
  return {actor:auth.session.user.id,effective_affiliate:auth.affiliate?.id||null,session,key:JSON.stringify([auth.session.user.id,session,auth.affiliate?.id,auth.impersonation,admin?.phase,admin?.subjectKey,admin?.assignment])};
 }
 async function invoke(action,values){
  const before=context(),result=await window.SutiSupabase.getClient().functions.invoke('reports-jc',{body:{action,...values}});
  if(context().key!==before.key)throw Error('CONTEXT_CHANGED');
  if(result.error){let response;try{response=await result.error.context.clone().json();}catch(_){}throw Error(response?.error||'SOURCE_UNAVAILABLE');}
  const envelope=result.data,received=envelope?.context;
  if(!received||received.actor!==before.actor||received.effective_affiliate!==before.effective_affiliate||(before.session&&received.session!==before.session))throw Error('CONTEXT_CHANGED');
  if(!envelope.data||envelope.error)throw Error(envelope.error||'RESPONSE_INVALID');
  return envelope.data;
 }
 window.ReportsJcRepository=Object.freeze({contextKey:()=>context().key,load:year=>invoke('LOAD',{year}),template:()=>invoke('TEMPLATE',{}),cashFlow:from=>invoke('CASH_FLOW',{from})});
})();
