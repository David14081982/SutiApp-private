/* Short-lived credential token issued only by the backend. */
(function(){
  'use strict';const db=()=>window.SutiSupabase.getClient();
  async function issue(){const r=await db().rpc('issue_credential_qr');if(r.error)throw r.error;const row=Array.isArray(r.data)?r.data[0]:r.data;if(!row)throw new Error('QR_TOKEN_UNAVAILABLE');return Object.freeze(row);}
  window.CredentialQrRepository=Object.freeze({issue});
})();
