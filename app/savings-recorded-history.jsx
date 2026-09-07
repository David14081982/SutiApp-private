/* Private Savings Admin only: original dated amounts, never financial posting. */
(function () {
 'use strict';
 const h=React.createElement;
 const day=value=>{
  if(!value)return 'Sin fecha registrada';
  if(!/^\d{4}-\d{2}-\d{2}$/.test(String(value)))return String(value)+' · Revisar fecha';
  const date=new Date(value+'T12:00:00Z');
  return Number.isNaN(+date)||date.toISOString().slice(0,10)!==value?String(value)+' · Revisar fecha':date.toLocaleDateString('es-MX',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'});
 };
 const amount=value=>value==null||value===''?'Sin importe registrado':typeof value==='number'&&Number.isFinite(value)?new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN'}).format(value):String(value)+' · Revisar importe';
 const css='.svh{background:white;border:1px solid #dfe2e8;border-radius:14px;padding:16px;margin:12px 0;color:#202432;font:13px Arial;line-height:1.5}.svh h3{margin:0 0 8px;font-size:18px}.svh p{color:#626b7b;margin:8px 0}.svh-facts{display:flex;gap:10px;flex-wrap:wrap;margin:12px 0}.svh-facts>div{flex:1;min-width:150px;padding:12px;background:#f7f3f5;border-radius:10px}.svh-facts b,.svh small{display:block}.svh-controls{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:12px 0}.svh button,.svh select{font:inherit;padding:9px 12px;border:1px solid #d1d5df;border-radius:9px;background:white;color:inherit;cursor:pointer;max-width:100%}.svh button[aria-pressed=true]{background:#a00038;color:white;border-color:#a00038}.svh button:disabled{opacity:.45;cursor:default}.svh table{width:100%;border-collapse:collapse;font-size:12px}.svh th,.svh td{text-align:left;padding:10px 5px;border-bottom:1px solid #e7e8ed;vertical-align:top}.svh th{background:#f5f6f8}.svh small{color:#626b7b}.svh .svh-warning{background:#fff4d9;padding:10px;border-radius:9px;color:#69531f}.svh .svh-money{white-space:nowrap;font-weight:bold}@media(max-width:600px){.svh{padding:12px}.svh th,.svh td{padding:9px 3px}.svh-facts>div{min-width:120px}.svh-controls button{flex:1}}';
 function SavingsRecordedHistory({record,changes={},initialMode='past'}){
  const [mode,setMode]=React.useState(initialMode),[page,setPage]=React.useState(0);
  const source=record.source_data||{},proposed=Object.assign({},record.proposed_data||{},changes);
  const defs=(record.field_defs||[]).filter(f=>/Descuento registrado|Proyección futura/.test(f.label)&&/^\d{4}-\d{2}-\d{2}/.test(f.label));
  const rows=defs.filter(f=>mode==='future'?/Proyección futura/.test(f.label):/Descuento registrado/.test(f.label)).sort((a,b)=>a.label.localeCompare(b.label));
  const pages=Math.max(1,Math.ceil(rows.length/8)),index=Math.min(page,pages-1);
  const corrected=key=>Object.prototype.hasOwnProperty.call(proposed,key)&&JSON.stringify(proposed[key])!==JSON.stringify(source[key]);
  function changeMode(value){setMode(value);setPage(0);}
  return h('section',{className:'svh','aria-label':'Historial de descuentos de ahorro'},h('style',null,css),
   h('h3',null,'Historial de descuentos'),
   h('div',{className:'svh-facts'},[['F','Primer descuento registrado'],['X','Inicio del plan de ahorro']].map(([key,label])=>h('div',{key},label,h('b',null,day(source[key])),corrected(key)&&h('small',null,'Corrección en revisión: '+day(proposed[key]))))),
   h('p',null,'Importes del archivo original de Ahorro. La fecha del primer descuento se conserva tal como fue registrada; no se deduce de esta lista.'),
   h('div',{className:'svh-controls'},h('button',{type:'button','aria-pressed':mode==='past',onClick:()=>changeMode('past')},'Descuentos registrados'),h('button',{type:'button','aria-pressed':mode==='future',onClick:()=>changeMode('future')},'Ahorro previsto')),
   mode==='future'&&h('p',{className:'svh-warning'},'Estos importes eran futuros al capturar el archivo. No son descuentos confirmados, aunque la fecha ya haya pasado.'),
   mode==='past'&&h('p',null,'Revisa cada importe contra los descuentos recibidos. Un cero no demuestra por sí solo una falta de pago.'),
   rows.length?h('table',{'aria-label':mode==='past'?'Descuentos por fecha':'Ahorro previsto por fecha'},h('thead',null,h('tr',null,['Fecha','Importe original','Detalle'].map(t=>h('th',{key:t},t)))),h('tbody',null,rows.slice(index*8,index*8+8).map(f=>h('tr',{key:f.key},h('td',null,day(f.label.slice(0,10))),h('td',null,h('span',{className:'svh-money'},amount(source[f.key])),corrected(f.key)&&h('small',null,'En revisión: '+amount(proposed[f.key]))),h('td',null,f.key==='AR'?'Incluye el rendimiento del semestre. No volver a sumarlo.':source[f.key]==null||source[f.key]===''?'Falta revisar el importe':typeof source[f.key]!=='number'||source[f.key]<0?'Importe por revisar':source[f.key]===0?'Importe registrado en cero':mode==='future'?'Estimación del archivo':'Descuento registrado'))))):h('p',null,'No hay fechas detalladas en este registro.'),
   rows.length>0&&h('div',{className:'svh-controls'},h('button',{disabled:index===0,onClick:()=>setPage(index-1)},'Fechas anteriores'),h('span',null,(index*8+1)+'–'+Math.min((index+1)*8,rows.length)+' de '+rows.length+' fechas'),h('button',{disabled:index+1>=pages,onClick:()=>setPage(index+1)},'Fechas siguientes')),
   h('p',null,'La copia disponible detalla fechas de 2026 en adelante. El ahorro de 2025 aparece en los totales anuales; sus descuentos por fecha no están incluidos en esta copia.'),
   record.batch&&h('small',null,'Copia consultada: '+new Date(record.batch.observed_at).toLocaleString('es-MX')));
 }
 function SavingsPersonHistory({participantId,initialMode='past'}){
  const [state,setState]=React.useState({}),[chosen,setChosen]=React.useState(''),[retry,setRetry]=React.useState(0);
  React.useEffect(()=>{let active=true;setState({});setChosen('');window.SavingsReviewRepository.recordedHistory(participantId).then(data=>{if(active)setState({id:participantId,data});}).catch(()=>{if(active)setState({id:participantId,error:true});});return()=>{active=false;};},[participantId,retry]);
  if(!state.id||state.id!==participantId)return h('p',{role:'status'},'Cargando descuentos por fecha…');
  if(state.error)return h('div',{role:'alert',className:'svh'},'No fue posible cargar los descuentos.',h('button',{onClick:()=>setRetry(retry+1)},'Reintentar historial'));
  const records=state.data.records||[],record=records.length===1?records[0]:records.find(r=>r.id===chosen);
  if(!records.length)return h('div',{className:'svh'},'No hay una fila de Ahorro con el Folio exacto de esta persona. Su historial queda pendiente de revisión.');
  return h(React.Fragment,null,records.length>1&&h('div',{className:'svh'},h('p',null,'Hay varios registros con este Folio. Elige cuál revisar; sus importes no se suman.'),h('select',{'aria-label':'Registro de Ahorro a consultar',value:chosen,onChange:e=>setChosen(e.target.value)},h('option',{value:''},'Selecciona un registro'),records.map(r=>h('option',{key:r.id,value:r.id},'Fila '+r.source_row+' · Copia '+new Date(r.batch.observed_at).toLocaleString('es-MX'))))),
   record&&record.identity_change_pending&&h('p',{className:'svh'},'Esta fila tiene un cambio de Folio pendiente. Aquí se muestran únicamente los datos originales; las propuestas no se asignan a otra persona.'),
   record&&h(SavingsRecordedHistory,{key:record.id,record:record.identity_change_pending?Object.assign({},record,{proposed_data:{}}):record,initialMode}));
 }
 window.SavingsRecordedHistory=SavingsRecordedHistory;
 window.SavingsPersonHistory=SavingsPersonHistory;
})();
