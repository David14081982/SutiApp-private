/* Dedicated read-only Admin boundary; Auth remains the event authority. */
(function(){
  'use strict';
  async function list(filters){
    if(!window.AdminRepository?.has('authorization.read'))throw new Error('ADMIN_LOGIN_HISTORY_DENIED');
    const f=filters||{};
    const result=await window.SutiSupabase.getClient().rpc('list_admin_login_history',{
      p_mode:f.mode||'users',p_query:f.query?.trim()||null,p_from:f.from||null,p_to:f.to||null,
      p_page:f.page||1,p_page_size:25
    });
    if(result.error)throw result.error;
    if(!result.data||!Array.isArray(result.data.items)||!Number.isFinite(result.data.total))throw new Error('LOGIN_HISTORY_INVALID_RESPONSE');
    return result.data;
  }
  window.LoginHistoryRepository=Object.freeze({list});
})();
