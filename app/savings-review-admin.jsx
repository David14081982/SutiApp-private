/* Private administrative review. No self reader, financial posting or browser persistence. */
(function () {
 'use strict';
 const h = React.createElement;
 const states = { PENDING: 'Pendiente', IN_REVIEW: 'En revisión', RESOLVED: 'Resuelto' };
 const labels = {
  IDENTITY_DUPLICADO: 'Folio duplicado en el padrón', IDENTITY_SIN_REGISTRO: 'Sin registro en el padrón',
  FOLIO_MISSING_OR_NOT_TEXT: 'Folio faltante o con formato por revisar', NO_SAVINGS_ACCOUNT: 'Sin cuenta relacionada en Ahorro',
  PROCESS_REVIEW: 'Categoría de descuento por revisar', MATRIX_VALUE_REVIEW: 'Descuento con valor no numérico',
  ANNUAL_DU_REVIEW: 'Diferencia en subtotal 2026', ANNUAL_DW_REVIEW: 'Diferencia en rendimientos acumulados',
  BALANCE_SNAPSHOT_CHANGED: 'Saldo distinto de la importación anterior', NOT_IMPORTED: 'Registro pendiente de incorporar',
  LOAN_FOLIO_CONFLICT_OR_MISSING: 'Préstamo asociado a más de un Folio o sin Folio',
  Q_ARITHMETIC_REVIEW: 'Composición del saldo por revisar', G_DATED_MATRIX_REVIEW: 'Acumulado por fechas por revisar',
  DUPLICATE_SAVINGS_FOLIO: 'Folio repetido en Ahorro', IMPORTED_LINK_MISMATCH: 'Vínculo anterior por revisar',
  NEGATIVE_Q: 'Saldo negativo', Q_INVALID: 'Saldo sin importe válido', START_DATE_REVIEW: 'Fecha de inicio por revisar',
  LEGACY_MANUAL_BALANCE_PRESENT: 'Saldo manual histórico presente', IMPORTED_EVIDENCE_FOLIO_MISMATCH: 'Folio distinto en evidencia anterior',
 };
 const issue = code => labels[code] || 'Dato por revisar (' + code + ')';
 const show = (value, kind) => value == null || value === '' ? 'Sin dato' : kind === 'money' && typeof value === 'number' ? new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(value) : String(value);
 const stamp = value => value ? new Date(value).toLocaleString('es-MX') : '—';
 const css = `.svr{color:var(--ink,#202432);font-family:var(--font,Arial);font-size:13px}.svr button,.svr input,.svr select,.svr textarea{font:inherit}.svr button{cursor:pointer}.svr button:disabled{cursor:default;opacity:.5}.svr-bar{padding:14px;background:#fff6df;border:1px solid #efd39a;border-radius:14px;line-height:1.6;margin-bottom:14px}.svr-kpis{display:flex;gap:10px;flex-wrap:wrap;margin:12px 0}.svr-kpis>div{flex:1;min-width:120px;background:white;border:1px solid #e1e3e8;border-radius:13px;padding:12px}.svr-kpis b{display:block;font-size:23px;margin-top:5px}.svr-filters{display:flex;flex-wrap:wrap;gap:9px;margin:12px 0;align-items:center}.svr-filters input{flex:1;min-width:180px}.svr input,.svr select,.svr textarea{padding:9px;border:1px solid #ced1da;border-radius:8px;background:white;box-sizing:border-box;max-width:100%}.svr button{border:1px solid #d4d7df;background:white;padding:9px 13px;border-radius:9px;color:inherit}.svr .svr-primary{background:#a00038;color:white;border-color:#a00038}.svr-scroll{overflow:auto;border:1px solid #dfe2e8;border-radius:12px;background:white;max-height:540px}.svr table{border-collapse:collapse;width:100%;font-size:12px}.svr th{background:#f3f4f7;position:sticky;top:0;z-index:1;text-align:left}.svr td,.svr th{padding:11px;border-bottom:1px solid #e7e8ed;vertical-align:top}.svr td small{display:block;margin-top:4px;line-height:1.5;color:#687084}.svr .svr-status{display:inline-block;background:#f2edf0;border-radius:18px;padding:5px 9px;white-space:nowrap}.svr-detail{background:white;border:1px solid #dde0e7;border-radius:14px;padding:16px;margin-top:15px}.svr-detail h2{font-size:20px;margin:12px 0}.svr-detail h3{font-size:15px;margin:18px 0 10px}.svr-fields{min-width:640px}.svr-fields input{width:100%;min-width:150px}.svr-note{color:#666f81;line-height:1.6}.svr-error{padding:12px;border-radius:9px;background:#ffe8ed;color:#9a0034;margin:10px 0}.svr-success{padding:12px;background:#e7f7ee;border-radius:9px;margin:10px 0}.svr-preview{border:2px solid #a00038;border-radius:12px;padding:14px;margin-top:12px}.svr-actions{display:flex;gap:9px;flex-wrap:wrap;margin-top:12px}.svr textarea{display:block;width:100%;min-height:75px;margin-top:6px}.svr-history{padding:12px;border-bottom:1px solid #e0e3e8}.svr-history summary{cursor:pointer;line-height:1.7}.svr-highlight{background:#fff8e8}.svr label{line-height:1.5}.svr-footer{display:flex;gap:10px;align-items:center;margin-top:10px}@media(max-width:650px){.svr-detail{padding:11px}.svr-filters{flex-direction:column;align-items:stretch}.svr h2{font-size:18px}.svr-kpis>div{min-width:100px}}`;
 function errorText(error) {
  const text = String(error && (error.message || error.code) || error);
  if (/SAVINGS_REVIEW_CHANGED/.test(text)) return 'Otra persona actualizó esta fila. Vuelve a abrirla para revisar la versión actual.';
  if (/IDENTITY_PENDING|DUPLICATE_PENDING/.test(text)) return 'La identidad sigue pendiente. Puedes guardar En revisión; resolver requiere un Folio con una sola coincidencia activa.';
  if (/BALANCE_PENDING/.test(text)) return 'Revisa el saldo: para resolver debe tener un importe válido, mayor o igual a cero.';
  if (/DENIED|42501/.test(text)) return 'Tu cuenta no tiene permiso para esta acción.';
  if (/INVALID/.test(text)) return 'Revisa el formato de los campos. Los importes admiten dos decimales y las fechas usan AAAA-MM-DD.';
  return 'No se pudo completar la operación. Tus cambios permanecen en esta pantalla; puedes reintentar.';
 }
 function SavingsReviewAdmin() {
  const [data,setData]=React.useState(null),[detail,setDetail]=React.useState(null),[selected,setSelected]=React.useState('');
  const [search,setSearch]=React.useState(''),[sheet,setSheet]=React.useState('Ahorro'),[status,setStatus]=React.useState(''),[onlyIssues,setOnlyIssues]=React.useState(false),[page,setPage]=React.useState(0);
  const [changes,setChanges]=React.useState({}),[observation,setObservation]=React.useState(''),[nextStatus,setNextStatus]=React.useState('IN_REVIEW'),[group,setGroup]=React.useState('main');
  const [preview,setPreview]=React.useState(null),[busy,setBusy]=React.useState(false),[error,setError]=React.useState(''),[success,setSuccess]=React.useState('');
  const generation=React.useRef(0),listGeneration=React.useRef(0),mounted=React.useRef(true),locked=React.useRef(false),detailElement=React.useRef(null);
  React.useEffect(()=>{if(detail&&detailElement.current)detailElement.current.scrollIntoView({block:'start',behavior:'smooth'});},[detail&&detail.id]);
  React.useEffect(()=>{const warn=e=>{if(Object.keys(changes).length||observation||preview){e.preventDefault();e.returnValue='';}};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);},[changes,observation,preview]);
  async function load(){const seq=++listGeneration.current;try{const value=await window.SavingsReviewRepository.list();if(mounted.current&&seq===listGeneration.current)setData(value);}catch(e){if(mounted.current&&seq===listGeneration.current)setError(errorText(e));}}
  React.useEffect(()=>{mounted.current=true;load();return()=>{mounted.current=false;generation.current++;listGeneration.current++;};},[]);
  async function open(id,force){
   if(locked.current)return;
   if(!force&&(Object.keys(changes).length||observation||preview)&&!window.confirm('Hay cambios sin guardar. ¿Quieres descartarlos para abrir otra fila?'))return;
   const seq=++generation.current;setSelected(id);setDetail(null);setChanges({});setPreview(null);setObservation('');setError('');setSuccess('');setGroup('main');
   try{const value=await window.SavingsReviewRepository.detail(id);if(mounted.current&&seq===generation.current){setDetail(value);setNextStatus(value.status==='RESOLVED'?'IN_REVIEW':value.status);}}catch(e){if(mounted.current&&seq===generation.current)setError(errorText(e));}
  }
  React.useEffect(()=>setPage(0),[search,sheet,status,onlyIssues]);
  const rows=data&&data.records||[],counts={PENDING:0,IN_REVIEW:0,RESOLVED:0};rows.forEach(r=>counts[r.status]++);
  const filtered=rows.filter(r=>(!sheet||r.sheet===sheet)&&(!status||r.status===status)&&(!onlyIssues||r.issues.length||(r.identity&&r.identity.match_count!==1))&&[r.folio,r.identity&&r.identity.name,r.sheet,...r.issues.map(issue)].join(' ').toLocaleLowerCase('es').includes(search.trim().toLocaleLowerCase('es')));
  const pages=Math.max(1,Math.ceil(filtered.length/40)),currentPage=Math.min(page,pages-1),visible=filtered.slice(currentPage*40,currentPage*40+40);
  const effective=detail?Object.assign({},detail.source_data,detail.proposed_data):{};
  const editable=!!(data&&data.can_write),frozen=busy||!!preview;
  function update(def,text){
   const next=Object.assign({},changes),value=text===''?null:def.kind==='money'?(Number.isFinite(Number(text))?Number(text):text):text;
   if(JSON.stringify(value)===JSON.stringify(effective[def.key]??null))delete next[def.key];else next[def.key]=value;
   setChanges(next);setError('');setSuccess('');
  }
  function review(){
   setError('');
   for(const def of detail.field_defs){if(!(def.key in changes))continue;const value=changes[def.key];if(def.kind==='money'&&value!=null&&(typeof value!=='number'||Math.abs(value*100-Math.round(value*100))>0.00001)){setError('Los importes deben tener como máximo dos decimales.');return;}}
   setPreview({id:detail.id,version:detail.version,changes:Object.assign({},changes),status:nextStatus,observation:observation.trim(),key:crypto.randomUUID()});
  }
  async function save(){
   if(locked.current||!preview)return;locked.current=true;setBusy(true);setError('');
   try{await window.SavingsReviewRepository.save(preview);if(!mounted.current)return;locked.current=false;setPreview(null);setChanges({});setObservation('');await open(preview.id,true);await load();if(mounted.current)setSuccess('Revisión guardada. Los valores del ahorrador no se modificaron.');}
   catch(e){if(mounted.current){setError(errorText(e));if(/SAVINGS_REVIEW_CHANGED/.test(String(e.message))){setPreview(null);}}}
   finally{locked.current=false;if(mounted.current)setBusy(false);}
  }
  const fields=detail?detail.field_defs.filter(f=>detail.source_sheet!=='Ahorro'||group==='all'||(group==='dates'?f.key.length<=2&&/Descuento registrado|Proyección futura/.test(f.label):group==='annual'?['DP','DQ','DR','DS','DT','DU','DV','DW'].includes(f.key):!(/Descuento registrado|Proyección futura/.test(f.label)||['DP','DQ','DR','DS','DT','DU','DV','DW'].includes(f.key)))):[];
  return h('section',{className:'svr','data-savings-review':'private'},h('style',null,css),
   h('div',{className:'svr-bar'},h('b',null,'Revisión privada · Sin publicar a los ahorradores'),h('div',null,'Confirma los datos correctos o registra propuestas de corrección. Resolver una fila no autoriza pagos, no certifica el saldo final y no cambia las pantallas Ahorro, Inicio o Finanzas.'),
    data&&data.batches.map(b=>h('small',{key:b.id,style:{display:'block'}},b.source_name+' · Captura: '+stamp(b.observed_at)+' · '+rows.filter(r=>r.batch_id===b.id).length+' de '+b.expected_records+' filas cargadas.'))),
   h('details',null,h('summary',null,'Cómo revisar'),h('ol',null,['Busca un Folio o filtra las filas con incidencias.','Abre la fila y compara el dato original con la propuesta.','Corrige los campos necesarios; las observaciones son opcionales.','Revisa los cambios y confirma. Usa En revisión si faltan datos, o Resuelto si ya verificaste la fila.','Consulta el historial para saber quién cambió cada dato. La publicación se realizará en una etapa posterior.'].map(t=>h('li',{key:t},t)))),
   error&&h('div',{role:'alert',className:'svr-error'},error),success&&h('div',{role:'status',className:'svr-success'},success),
   !data?h('p',null,'Cargando revisión…',h('button',{onClick:load},'Reintentar')):h(React.Fragment,null,
    !editable&&h('p',{className:'svr-note'},'Acceso de consulta. Para corregir se requiere el permiso de escritura de Ahorro.'),
    h('div',{className:'svr-kpis'},[['Filas cargadas',rows.length],['Pendientes',counts.PENDING],['En revisión',counts.IN_REVIEW],['Resueltas',counts.RESOLVED]].map(([label,value])=>h('div',{key:label},label,h('b',null,value)))),
    h('div',{className:'svr-filters'},h('input',{'aria-label':'Buscar Folio o nombre',placeholder:'Buscar Folio, nombre o incidencia',value:search,onChange:e=>setSearch(e.target.value)}),
     h('select',{'aria-label':'Hoja de origen',value:sheet,onChange:e=>setSheet(e.target.value)},h('option',{value:''},'Todas las hojas'),[...new Set(rows.map(r=>r.sheet))].map(s=>h('option',{key:s,value:s},s))),
     h('select',{'aria-label':'Estado de revisión',value:status,onChange:e=>setStatus(e.target.value)},h('option',{value:''},'Todos los estados'),Object.entries(states).map(([v,label])=>h('option',{key:v,value:v},label))),
     h('label',null,h('input',{type:'checkbox',checked:onlyIssues,onChange:e=>setOnlyIssues(e.target.checked)}),' Sólo incidencias'),h('button',{onClick:load,disabled:busy},'Actualizar lista')),
    h('div',{className:'svr-scroll'},h('table',{'aria-label':'Pendientes de Ahorro'},h('thead',null,h('tr',null,['Folio y nombre','Origen','Revisión','Saldo de referencia','Acción'].map(t=>h('th',{key:t},t)))),h('tbody',null,visible.map(r=>h('tr',{key:r.id,className:selected===r.id?'svr-highlight':''},h('td',null,h('b',null,r.folio||'Sin Folio'),h('small',null,r.identity.name)),h('td',null,r.sheet,h('small',null,'Fila '+r.row)),h('td',null,h('span',{className:'svr-status'},states[r.status]),r.issues.map(code=>h('small',{key:code},issue(code)))),h('td',null,r.sheet==='Ahorro'?show(r.proposed_balance,'money'):'—',r.sheet==='Ahorro'&&h('small',null,'Propuesta privada / Q de origen')),h('td',null,h('button',{onClick:()=>open(r.id),disabled:busy,'aria-label':'Revisar '+(r.folio||'sin Folio')+' fila '+r.row},'Revisar'))))))),
    !filtered.length&&h('p',null,'No hay filas que coincidan con los filtros.'),
    h('div',{className:'svr-footer'},h('button',{disabled:currentPage===0,onClick:()=>setPage(currentPage-1)},'Anterior'),h('span',null,filtered.length+' filas · Página '+(currentPage+1)+' de '+pages),h('button',{disabled:currentPage+1>=pages,onClick:()=>setPage(currentPage+1)},'Siguiente'))),
   selected&&!detail&&h('p',null,'Cargando detalle…'),
   detail&&h('article',{className:'svr-detail','aria-label':'Detalle de revisión',ref:detailElement},
    h('h2',null,(effective.A||'Sin Folio')+' · '+detail.identity.name),h('p',{className:'svr-note'},detail.source_sheet+' · Fila '+detail.source_row+' · Versión '+detail.version+' · Captura '+stamp(detail.batch.observed_at)),
    h('p',{className:'svr-note'},'Los cambios de Folio son propuestas para revisión de identidad. No vinculan automáticamente esta información a otra persona ni modifican el padrón.'),
    detail.raw_source.readiness&&h('p',null,'Q de la captura: '+show(detail.source_data.Q,'money')+' · Saldo de la importación anterior: '+show(detail.raw_source.readiness.prior_balance_cents==null?null:detail.raw_source.readiness.prior_balance_cents/100,'money')),
    detail.source_sheet==='Ahorro'&&h(React.Fragment,null,h('p',{className:'svr-bar'},'Revisa Q por separado si corriges descuentos, retiros o rendimientos. Esta revisión no recalcula fórmulas. AR ya incluye DT: no agregues ese rendimiento otra vez. Una fecha futura es proyección; no acredita dinero recibido.'),
     h('select',{'aria-label':'Grupo de campos',value:group,onChange:e=>setGroup(e.target.value)},[['main','Datos principales y saldo'],['dates','Descuentos por fecha'],['annual','Capital y rendimientos históricos'],['all','Todos los campos']].map(([value,label])=>h('option',{key:value,value},label)))),
    h('div',{className:'svr-scroll',style:{marginTop:12}},h('table',{className:'svr-fields','aria-label':'Datos originales y correcciones'},h('thead',null,h('tr',null,['Campo','Original importado','Propuesta para revisión'].map(t=>h('th',{key:t},t)))),h('tbody',null,fields.map(def=>{
     const value=def.key in changes?changes[def.key]:effective[def.key],canEdit=editable&&def.editable&&(def.key!=='A'||data.can_review_identity);
     return h('tr',{key:def.key,className:def.key in changes?'svr-highlight':''},h('td',null,h('b',null,def.key),h('small',null,def.label)),h('td',null,show(detail.source_data[def.key],def.kind)),h('td',null,canEdit?h('input',{'aria-label':def.key+' · '+def.label,value:value??'',type:def.kind==='money'?'number':'text',step:def.kind==='money'?'.01':undefined,placeholder:def.kind==='date'?'AAAA-MM-DD':'Sin dato',disabled:frozen,onChange:e=>update(def,e.target.value)}):show(value,def.kind)));
    })))),
    editable&&h(React.Fragment,null,h('h3',null,'Resultado de esta revisión'),h('label',null,'Estado al guardar ',h('select',{'aria-label':'Estado al guardar',value:nextStatus,disabled:frozen,onChange:e=>setNextStatus(e.target.value)},Object.entries(states).map(([v,label])=>h('option',{key:v,value:v},label)))),
     h('label',{style:{display:'block',marginTop:12}},'Observaciones (opcional)',h('textarea',{'aria-label':'Observaciones (opcional)',value:observation,maxLength:4000,disabled:frozen,onChange:e=>setObservation(e.target.value)})),
     !preview&&h('div',{className:'svr-actions'},h('button',{className:'svr-primary',onClick:review,disabled:busy},'Revisar antes de guardar'),h('button',{onClick:()=>open(detail.id),disabled:busy},'Volver a cargar fila'))),
    preview&&h('section',{className:'svr-preview','aria-label':'Confirmar revisión'},h('h3',null,'Cambios que se guardarán'),
     h('p',null,'Estado: '+states[detail.status]+' → '+states[preview.status]),
     Object.keys(preview.changes).length?h('ul',null,Object.entries(preview.changes).map(([key,value])=>{const def=detail.field_defs.find(f=>f.key===key);return h('li',{key},def.label+': '+show(effective[key],def.kind)+' → '+show(value,def.kind));})):h('p',null,'Sin cambios de valores. Se registrará el resultado de la revisión.'),
     h('p',null,preview.observation||'Sin observaciones.'),h('p',{className:'svr-note'},'Estos cambios permanecerán privados. Los saldos y proyecciones del usuario no cambiarán.'),
     h('div',{className:'svr-actions'},h('button',{className:'svr-primary',onClick:save,disabled:busy},busy?'Guardando…':'Confirmar y guardar'),h('button',{onClick:()=>setPreview(null),disabled:busy},'Volver a editar'))),
    h('h3',null,'Historial de cambios'),!(detail.history||[]).length?h('p',{className:'svr-note'},'Todavía no se ha registrado una revisión.'):detail.history.map(event=>h('details',{key:event.id,className:'svr-history'},h('summary',null,stamp(event.at)+' · '+event.actor_name+' · '+states[event.after.status]),h('p',null,'Identificador del encargado: '+event.actor),h('p',null,event.observation||'Sin observaciones.'),h('p',null,states[event.before.status]+' → '+states[event.after.status]),h('ul',null,Object.entries(event.after.proposed_data).filter(([key,value])=>JSON.stringify(value)!==JSON.stringify(event.before.proposed_data[key])).map(([key,value])=>{const def=detail.field_defs.find(f=>f.key===key)||{label:key};return h('li',{key},def.label+': '+show(key in event.before.proposed_data?event.before.proposed_data[key]:detail.source_data[key],def.kind)+' → '+show(value,def.kind));}))))));
 }
 window.SavingsReviewAdmin = SavingsReviewAdmin;
})();
