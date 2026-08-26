/* Operational export boundary: Admin -> authorized Edge Function -> Supabase. */
(function(){
  'use strict';
  function client(){return window.SutiSupabase.getClient();}
  /* Diagnóstico sanitizado (temporal): origen real, status HTTP, código técnico y PRESENCIA
     de credenciales. Nunca imprime tokens, apikey, JWT ni el valor de cabecera alguna. */
  async function diagnose(stage,error){
    const info={stage,origin:window.location.origin,name:(error&&error.name)||'Error',status:null,code:null,hasAuthorization:false,hasApikey:false};
    try{const session=await client().auth.getSession();info.hasAuthorization=Boolean(session&&session.data&&session.data.session&&session.data.session.access_token);}catch(_){}
    try{info.hasApikey=Boolean(window.SutiSupabase.isConfigured());}catch(_){}
    const context=error&&error.context;
    if(context&&typeof context.status==='number'){
      info.status=context.status;
      try{const body=await context.clone().json();if(body&&typeof body.error==='string')info.code=body.error;}catch(_){}
    }else if(info.name==='FunctionsFetchError')info.code='CORS_OR_NETWORK_BLOCKED';
    console.error('[data-exports] '+stage,info);
    const failure=new Error(info.code||info.name);failure.code=info.code||info.name;failure.status=info.status;failure.diagnostic=info;
    return failure;
  }
  async function listDomains(){
    let result;
    try{result=await client().functions.invoke('data-exports',{method:'GET'});}catch(error){throw await diagnose('listDomains',error);}
    if(result.error)throw await diagnose('listDomains',result.error);
    return Object.freeze(result.data||{domains:[]});
  }
  function asBlob(value,format){
    if(value instanceof Blob)return value;
    const type=format==='xlsx'?'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':'text/csv;charset=utf-8';
    if(value instanceof ArrayBuffer)return new Blob([value],{type});
    if(ArrayBuffer.isView(value))return new Blob([value.buffer],{type});
    return new Blob([typeof value==='string'?value:JSON.stringify(value)],{type});
  }
  async function download(domain,format,filters,label){
    if(!/^[a-z][a-z0-9_]{2,63}$/.test(domain)||!['xlsx','csv'].includes(format))throw new Error('INVALID_EXPORT_REQUEST');
    const stage='download:'+domain+':'+format;
    let result;
    try{result=await client().functions.invoke('data-exports',{body:{domain,format,filters:filters||{}}});}catch(error){throw await diagnose(stage,error);}
    if(result.error)throw await diagnose(stage,result.error);
    const blob=asBlob(result.data,format);const href=URL.createObjectURL(blob);const date=new Date().toISOString().slice(0,10);const link=document.createElement('a');
    const safe=String(label||domain).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9_-]+/g,'_');
    link.href=href;link.download=`SutiApp_${safe}_${date}.${format}`;link.rel='noopener';document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(href),0);
    return true;
  }
  window.DataExportRepository=Object.freeze({listDomains,download});
})();
