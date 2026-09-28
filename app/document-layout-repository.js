/* Focal designer transport. Reuses Auth/context and the existing document Edge. No cache or Storage signing. */
(function(){
 'use strict';
 async function request(action,data){
  const context=window.DocumentGenerationRepository.context,before=context();
  const result=await window.SutiSupabase.getClient().functions.invoke('document-generation',{body:{action,...data}});
  if(before!==context())throw Error('DOCUMENT_CONTEXT_CHANGED');
  if(result.error){let payload;try{payload=await result.error.context.json();}catch(_){}const error=Error(payload?.error||result.error.message||'DOCUMENT_SERVICE_UNAVAILABLE');error.details=payload?.details;throw error;}
  return result.data;
 }
 window.DocumentLayoutRepository=Object.freeze({request});
})();
