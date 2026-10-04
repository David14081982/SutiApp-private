/* Private authenticated SICOF boundary. Calculations and exports run on the
   server; no browser-persisted financial data or alternate financial source. */
(function () {
  'use strict';
  const db = () => window.SutiSupabase.getClient();
  function identity() {
    const auth = window.AffiliateAuth && window.AffiliateAuth.getState();
    const admin = window.AdminRepository && window.AdminRepository.getState();
    const actor = auth && auth.session && auth.session.user && auth.session.user.id;
    if (!actor || auth.phase !== 'authenticated') throw Error('SICOF_AUTH_REQUIRED');
    const affiliate = auth.affiliate && auth.affiliate.id || null;
    let session=auth.session.session_id||'';
    if(!session&&auth.session.access_token){try{session=JSON.parse(atob(auth.session.access_token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))).session_id||'';}catch(_){}}
    return {actor,affiliate,session,key:JSON.stringify([actor,affiliate,session,auth.impersonation||null,admin&&admin.phase,admin&&admin.subjectKey,admin&&admin.assignment])};
  }
  async function invoke(action, values) {
    const subject=identity();
    const result=await db().functions.invoke('sicof',{body:{action,...values}});
    if (identity().key!==subject.key) throw Error('SICOF_CONTEXT_CHANGED');
    if (result.error) {
      let body;try {body=await result.error.context.clone().json();} catch (_) {}
      throw Error(body&&body.error||'SICOF_UNAVAILABLE');
    }
    const response=result.data;
    if (!response||response.error) throw Error(response&&response.error||'SICOF_RESPONSE_INVALID');
    const context=response.context||{};
    if (context.actor!==subject.actor||context.effective_affiliate!==subject.affiliate||subject.session&&context.session!==subject.session) throw Error('SICOF_CONTEXT_CHANGED');
    return response.data;
  }
  let behaviorQueue=new Map(), scheduled=false;
  async function flushBehaviors() {
    const queue=behaviorQueue;behaviorQueue=new Map();scheduled=false;
    const entries=[...queue.entries()];
    // Bound a request without making one Google request per row.
    for(let offset=0;offset<entries.length;offset+=100) {
      const batch=entries.slice(offset,offset+100);
      try {
        const result=await invoke('BEHAVIOR',{affiliate_ids:batch.map(([id])=>id)});
        for(const [id,list] of batch) {
          if (!result||!Object.prototype.hasOwnProperty.call(result,id)) throw Error('SICOF_BEHAVIOR_UNAVAILABLE');
          list.forEach(p=>p.resolve(result[id]));
        }
      } catch(error) {batch.forEach(([,list])=>list.forEach(p=>p.reject(error)));}
    }
  }
  function getBehavior(affiliateId) {
    if(typeof affiliateId!=='string'||!affiliateId) return Promise.reject(Error('SICOF_EXACT_IDENTITY_REQUIRED'));
    let subject;try{subject=identity().key;}catch(error){return Promise.reject(error);}
    return new Promise((resolve,reject)=>{
      if(!behaviorQueue.has(affiliateId))behaviorQueue.set(affiliateId,[]);
      behaviorQueue.get(affiliateId).push({resolve:value=>{try{if(identity().key!==subject)throw Error('SICOF_CONTEXT_CHANGED');resolve(value);}catch(error){reject(error);}},reject});
      if(!scheduled){scheduled=true;queueMicrotask(flushBehaviors);}
    });
  }
  async function exportReport(kind, values) {
    const result=await invoke('EXPORT',{kind,...values});
    if(!result||typeof result.base64!=='string'||typeof result.filename!=='string'||typeof result.content_type!=='string')throw Error('SICOF_EXPORT_INVALID');
    const raw=atob(result.base64),bytes=new Uint8Array(raw.length);
    for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);
    const blob=new Blob([bytes],{type:result.content_type}),url=URL.createObjectURL(blob);
    const link=document.createElement('a');link.href=url;link.download=result.filename;document.body.appendChild(link);link.click();link.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
    return {filename:result.filename};
  }
  async function attribute(kind,values){
    const subject=identity(),result=await db().rpc(kind==='OPENING'?'admin_attribute_savings_opening':'admin_attribute_savings_withdrawal',{
      p_transaction_id:values.transaction_id,p_slices:values.origins,p_version:values.allocation_version,p_reason:values.reason,p_key:values.key
    });
    if(identity().key!==subject.key)throw Error('SICOF_CONTEXT_CHANGED');if(result.error)throw result.error;
    if(window.SavingsRepository)window.SavingsRepository.clearSelfCache();
    if(window.SavingsPanelRepository)window.SavingsPanelRepository.invalidate();return result.data;
  }
  window.SicofRepository=Object.freeze({
    workspace:values=>invoke('WORKSPACE',values),
    load:values=>invoke('LOAD',values),
    calculate:values=>invoke('CALCULATE',values),
    saveScenario:values=>invoke('SAVE_SCENARIO',{...values,key:values.key||crypto.randomUUID()}),
    deleteScenario:id=>invoke('ARCHIVE_SCENARIO',{id}),
    savePreferences:values=>invoke('SAVE_PREFERENCES',values),
    getBehavior,exportReport,
    attributeOpening:values=>attribute('OPENING',values),
    attributeWithdrawal:values=>attribute('WITHDRAWAL',values),
    composition:async participantId=>{
      const subject=identity(),result=await db().rpc('get_admin_savings_period_composition',{p_participant_id:participantId});
      if(identity().key!==subject.key)throw Error('SICOF_CONTEXT_CHANGED');
      if(result.error)throw result.error;return result.data;
    }
  });
})();
