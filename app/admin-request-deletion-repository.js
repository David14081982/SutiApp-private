/* Focal Admin request deletion boundary. Never removes affiliate documents or Storage objects. */
(function(){
  'use strict';
  const db=()=>window.SutiSupabase.getClient();
  async function preview(id){const r=await db().rpc('get_admin_request_delete_preview',{p_request_id:id});if(r.error)throw r.error;return r.data;}
  async function remove(confirmed,reason){
    const r=await db().functions.invoke('request-delete',{body:{request_id:confirmed.request_id,folio:confirmed.folio,updated_at:confirmed.updated_at||null,reason}});
    if(r.error){let code;try{code=(await r.error.context.json()).error;}catch(_){}throw Error(code||r.error.message||'REQUEST_DELETE_RETRY_REQUIRED');}
    if(!r.data?.data?.deleted||r.data.data.request_id!==confirmed.request_id)throw Error(r.data?.error||'REQUEST_DELETE_RESPONSE_INVALID');
    window.dispatchEvent(new Event('suti:request-changed'));return r.data.data;
  }
  window.AdminRequestDeletionRepository=Object.freeze({preview,remove});
})();
