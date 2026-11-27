/* Reporte JC de Ahorro (H-SAVINGS-JC-REPORT-001). Excel generated server-side; no browser cache, financial writes or email. */
(function(){
 'use strict';
 const messages={SAVINGS_REPORT_DENIED:'No tienes permiso para generar reportes de Ahorro.',SAVINGS_JC_UNSUPPORTED_MOVEMENT:'Hay movimientos de Ahorro (por ejemplo, rendimientos) que este reporte todavía no muestra. No se generó el archivo.',SAVINGS_JC_RECONCILIATION_FAILED:'Los saldos no cuadran con los movimientos registrados. No se generó el archivo.',SAVINGS_JC_WITHDRAWAL_INVALID:'Hay un retiro sin fecha o importe válido. No se generó el archivo.',SAVINGS_CONTEXT_CHANGED:'Cambió la sesión. Vuelve a pulsar Reporte JC.',SAVINGS_JC_FILE_INVALID:'No se recibió un Excel válido. Intenta nuevamente.'};
 function today(){return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Hermosillo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());}
 async function download(signal){
  const context=window.SavingsPanelRepository.contextKey();
  const result=await window.SutiSupabase.getClient().functions.invoke('savings-jc-report',{body:{},signal});
  if(signal?.aborted)throw new DOMException('Aborted','AbortError');
  if(context!==window.SavingsPanelRepository.contextKey())throw Error('SAVINGS_CONTEXT_CHANGED');
  if(result.error){let detail;try{detail=await result.error.context.clone().json();}catch(_){}throw Error(detail?.error||'SAVINGS_JC_UNAVAILABLE');}
  if(!(result.data instanceof Blob)||result.data.size<4)throw Error('SAVINGS_JC_FILE_INVALID');
  const signature=new Uint8Array(await result.data.slice(0,4).arrayBuffer());
  if(signature.join(',')!=='80,75,3,4')throw Error('SAVINGS_JC_FILE_INVALID');
  if(signal?.aborted||context!==window.SavingsPanelRepository.contextKey())throw Error('SAVINGS_CONTEXT_CHANGED');
  const file=new Blob([result.data],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
  const href=URL.createObjectURL(file),link=document.createElement('a');
  link.href=href;link.download='Reporte_JC_Ahorro_'+today()+'.xlsx';link.rel='noopener';
  document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(href),1000);
 }
 function explain(error){return messages[error?.message]||'No se pudo generar el Reporte JC. Intenta nuevamente; si persiste, revisa tus permisos y la conexión.';}
 window.SavingsJcRepository=Object.freeze({download,explain});
})();
