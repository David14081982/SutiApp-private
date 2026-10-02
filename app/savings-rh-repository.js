/* Payroll instructions export. No browser cache, financial writes or email. */
(function(){
 'use strict';
 const months=['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
 function validate(value){
  const {type,year,month,day}=value;
  if(!['mensual','anual'].includes(type)||!Number.isInteger(year)||year<2000||year>2100)throw Error('SAVINGS_RH_SELECTION_INVALID');
  if(type==='mensual'&&(!Number.isInteger(month)||month<1||month>12||![5,15,28,30].includes(day)||new Date(Date.UTC(year,month-1,day)).getUTCMonth()!==month-1))throw Error('SAVINGS_RH_DATE_INVALID');
  return {type,year,month:type==='mensual'?month:null,day:type==='mensual'?day:null};
 }
 async function download(value,signal){
  const selection=validate(value),context=window.SavingsPanelRepository.contextKey();
  const result=await window.SutiSupabase.getClient().functions.invoke('savings-rh-report',{body:selection,signal});
  if(signal?.aborted)throw new DOMException('Aborted','AbortError');
  if(context!==window.SavingsPanelRepository.contextKey())throw Error('SAVINGS_CONTEXT_CHANGED');
  if(result.error){let detail;try{detail=await result.error.context.clone().json();}catch(_){}throw Error(detail?.error||'SAVINGS_RH_UNAVAILABLE');}
  if(!(result.data instanceof Blob)||result.data.size<4)throw Error('SAVINGS_RH_FILE_INVALID');
  const signature=new Uint8Array(await result.data.slice(0,4).arrayBuffer());
  if(signature.join(',')!=='80,75,3,4')throw Error('SAVINGS_RH_FILE_INVALID');
  if(signal?.aborted||context!==window.SavingsPanelRepository.contextKey())throw Error('SAVINGS_CONTEXT_CHANGED');
  const file=new Blob([result.data],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
  const href=URL.createObjectURL(file),link=document.createElement('a');
  const date=selection.type==='anual'?String(selection.year):[selection.year,String(selection.month).padStart(2,'0'),String(selection.day).padStart(2,'0')].join('-');
  link.href=href;link.download='Reporte_RH_'+selection.type+'_'+date+'.xlsx';link.rel='noopener';
  document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(href),1000);
 }
 window.SavingsRhRepository=Object.freeze({months,validate,download});
})();
