(function(){
  'use strict';
  const normalize=v=>String(v||'').trim().replace(/\s+/g,' ').toLocaleUpperCase('es-MX');
  const missing=v=>v===null||v===undefined||String(v).trim()==='';
  const reqKey=r=>r.requisitionId||r.requisition||('product:'+r.id);
  const levels=['secretariat','project','item','requisition'];
  const labels={secretariat:'Sin secretaría',project:'Sin proyecto',item:'Sin partida',requisition:'Sin requisición'};
  function key(r,field){return field==='requisition'?reqKey(r):(missing(r[field])?null:r[field]);}
  function filter(records,f){return records.filter(r=>(f.year==='all'||String(r.year??'missing')===f.year)&&(f.status==='all'||normalize(r.status)===(f.status==='missing'?'':f.status))&&(f.month==='all'||(r.date?r.date.slice(5,7):'missing')===f.month)&&(!f.search||normalize([r.secretariat,r.project,r.item,r.requisition,r.concept,r.budgetCode].join(' ')).includes(normalize(f.search))));}
  function summarize(records){
    // Sum decimal representations exactly; round only currency presentation, never each row.
    let total=0n,scale=0;
    for(const r of records){const [base,exponent='0']=String(r.amount).split('e'),[integer,fraction='']=base.split('.');let digits=BigInt(integer+fraction),places=fraction.length-Number(exponent);if(places<0){digits*=10n**BigInt(-places);places=0;}if(places>scale){total*=10n**BigInt(places-scale);scale=places;}total+=digits*10n**BigInt(scale-places);}
    const amountCents=Number(total)/10**scale*100;
    if(!Number.isFinite(amountCents)||Math.abs(amountCents)>Number.MAX_SAFE_INTEGER)throw Error('TOTAL_OUT_OF_RANGE');
    return{amountCents,requisitions:new Set(records.filter(r=>r.requisitionId||r.requisition).map(reqKey)).size,secretariats:new Set(records.filter(r=>!missing(r.secretariat)).map(r=>r.secretariat)).size,projects:new Set(records.filter(r=>!missing(r.project)).map(r=>JSON.stringify([r.secretariat,r.project]))).size};
  }
  function explore(records,path,sort='amount-desc'){
    const scoped=records.filter(r=>path.every((p,i)=>key(r,levels[i])===p.key));
    if(path.length===levels.length)return {records:scoped,groups:[],level:null};
    const level=levels[path.length],groups=new Map();
    for(const r of scoped){const k=key(r,level);if(!groups.has(k))groups.set(k,{key:k,label:missing(r[level])?labels[level]:r[level],records:[]});groups.get(k).records.push(r);}
    const total=summarize(records).amountCents;
    const result=[...groups.values()].map(g=>({...g,...summarize(g.records),count:g.records.length,percentage:total?100*summarize(g.records).amountCents/total:0}));
    result.sort((a,b)=>sort==='name'?a.label.localeCompare(b.label,'es'):sort==='amount-asc'?a.amountCents-b.amountCents:b.amountCents-a.amountCents);
    return{records:scoped,groups:result,level};
  }
  function identity(){const auth=window.AffiliateAuth.getState(),admin=window.AdminRepository.getState();return JSON.stringify([auth.phase,auth.session?.user?.id,auth.affiliate?.id,auth.impersonation,admin.phase,admin.subjectKey,admin.assignment]);}
  async function load(){
    const subject=identity();
    const response=await window.SutiSupabase.getClient().functions.invoke('sutifinanzas',{body:{action:'LOAD'}});
    if(identity()!==subject)throw Error('CONTEXT_CHANGED');
    if(response.error){let body;try{body=await response.error.context.clone().json();}catch(_){}const error=Error(body?.error||'SOURCE_UNAVAILABLE');error.details=body||{};throw error;}
    if(response.data?.version!==1||!Array.isArray(response.data.records))throw Error('RESPONSE_INVALID');
    return response.data;
  }
  window.SutifinanzasModel=Object.freeze({normalize,filter,summarize,explore,levels});
  window.SutifinanzasRepository=Object.freeze({load,identity});
})();
