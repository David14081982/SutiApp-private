(function(){
  'use strict';
  const {useState,useEffect,useRef,useMemo}=React,Model=window.SutifinanzasModel;
  const money=c=>new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN'}).format(c/100);
  const months=['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const blank={year:'all',status:'APROBADO',month:'all',search:''};
  function errorText(error){
    const d=error.details||{};
    if(error.message==='MISSING_HEADERS')return 'La estructura del informe cambió. Faltan encabezados: '+(d.missing||[]).join(', ')+'.';
    if(error.message==='AMBIGUOUS_HEADERS')return 'La estructura del informe cambió. Hay encabezados duplicados: '+(d.headers||[]).join(', ')+'.';
    if(d.row)return 'No se pudo validar la fila '+d.row+' de Google Sheets, columna “'+d.header+'” ('+error.message+'). Revisa la fuente y actualiza.';
    if(error.message==='GOOGLE_ACCESS_DENIED')return 'La cuenta de lectura de SUTIFINANZAS no tiene acceso al archivo. Revisa que siga compartido como Lector y vuelve a actualizar.';
    if(['AUTH_REQUIRED','ADMIN_DENIED','CONTEXT_CHANGED'].includes(error.message))return 'Tu sesión o permiso para consultar este informe cambió. Vuelve a entrar al módulo.';
    return 'No se pudo consultar Google Sheets. Intenta actualizar nuevamente. ('+error.message+')';
  }

  const defaults=['secretariat','expenseType','project','item','requisition','product'];
  const fieldName=key=>Model.fields.find(f=>f.key===key)?.label||key;
  function PivotGrid({pivot,dimensions,expanded,onToggle,onDetail}){
    const width=dimensions.length||1;
    function rowsFor(nodes){
      return nodes.flatMap(node=>{
        if(!node.children.length||!expanded.has(node.id))return [{id:node.id,node,cells:[{node,depth:node.depth,colSpan:width-node.depth,rowSpan:1}],subtotal:false}];
        const rows=rowsFor(node.children);
        rows.push({id:node.id+'-subtotal',node,cells:[{depth:node.depth+1,colSpan:width-node.depth-1,rowSpan:1,label:'Subtotal · '+node.label}],subtotal:true});
        rows[0].cells.unshift({node,depth:node.depth,colSpan:1,rowSpan:rows.length});
        return rows;
      });
    }
    const rows=rowsFor(pivot.roots);
    const amounts=node=><>{pivot.columns.map(c=><td key={c.key} className="sf-value">{money(node.amounts[c.key]||0)}</td>)}<td className="sf-value sf-total">{money(node.summary.amountCents)}</td></>;
    return <div className="sf-table-scroll" role="region" aria-label="Tabla dinámica de gastos; desplaza horizontalmente para ver todas las columnas" tabIndex={0}>
      <table className="sf-pivot" style={{minWidth:Math.max(620,width*150+(pivot.columns.length+1)*130)}}>
        <caption className="sf-sr-only">Gasto agrupado por {dimensions.map(fieldName).join(', ')||'total general'}. Los subtotales resumen sus filas; no son gastos adicionales.</caption>
        <thead><tr>{(dimensions.length?dimensions:['total']).map((field,i)=><th key={field} rowSpan={2} scope="col" className={'sf-dimension-head'+(!i?' sf-first-column':'')}>{field==='total'?'Gasto filtrado':fieldName(field)}</th>)}<th colSpan={pivot.columns.length+1} scope="colgroup" className="sf-measure-head">Importe comprobado · MXN</th></tr>
          <tr>{pivot.columns.map(c=><th key={c.key} scope="col">{c.label}</th>)}<th scope="col" className="sf-total-head">Total</th></tr></thead>
        <tbody>{!pivot.count?<tr><td colSpan={width+pivot.columns.length+1} className="sf-state">No hay registros para estos filtros.</td></tr>:rows.map(row=><tr key={row.id} className={row.subtotal?'sf-subtotal':'sf-pivot-row'} data-pivot-row={row.subtotal?'subtotal':'group'}>
          {row.cells.map(cell=><th key={cell.depth} rowSpan={cell.rowSpan} colSpan={cell.colSpan} scope={cell.rowSpan>1?'rowgroup':'row'} className={'sf-dimension'+(cell.depth===0?' sf-first-column':'')+(row.subtotal&&!cell.node?' sf-subtotal-label':'')}>
            {cell.node?<button type="button" className="sf-tree-button" data-pivot-node={cell.node.id} aria-expanded={cell.node.children.length?expanded.has(cell.node.id):undefined} aria-label={(cell.node.children.length?(expanded.has(cell.node.id)?'Contraer ':'Expandir '):'Ver detalle de ')+fieldName(cell.node.field)+': '+cell.node.label} onClick={()=>cell.node.children.length?onToggle(cell.node.id):onDetail(cell.node)}>
              <span className="sf-tree-icon" aria-hidden="true">{cell.node.children.length?(expanded.has(cell.node.id)?'−':'+'):'↗'}</span><span>{cell.node.label}</span>
            </button>:cell.label}
          </th>)}{amounts(row.node)}</tr>)}</tbody>
        <tfoot><tr><th colSpan={width} scope="row" className="sf-first-column">Total general <span className="sf-muted">· {pivot.count} registros</span></th>{amounts(pivot)}</tr></tfoot>
      </table>
      {!pivot.columns.length&&<p className="sf-table-hint">Vista de totales. Selecciona «Mes del gasto» o «Año» en Columnas para comparar periodos.</p>}
    </div>;
  }
  function Details({node,onClose}){
    const dialog=useRef(null);
    useEffect(()=>{dialog.current?.showModal();},[]);
    return <dialog ref={dialog} className="sf-detail-dialog" aria-labelledby="sf-detail-title" onCancel={onClose} onClose={onClose}>
      <div className="sf-list-head"><div><div className="sf-muted">Detalle de la selección</div><h2 id="sf-detail-title">{node.label}</h2><p>{node.count} registros · {money(node.summary.amountCents)}</p></div><button type="button" className="sf-button" onClick={onClose} autoFocus>Cerrar detalle</button></div>
      <div className="sf-details">{node.records.map(r=><article className="sf-card" key={r.id}><h3>{r.concept||'Sin concepto'}</h3><dl>{[['Requisición',r.requisition],['Producto',r.id],['Fecha del gasto',r.date],['Secretaría',r.secretariat],['Tipo de gastos',r.expenseType],['Proyecto',r.project],['Partida',r.item],['Clave presupuestal',r.budgetCode],['Importe',money(r.amount*100)],['Estatus',r.status],['Año',r.year],['Forma de pago',r.payment],['Fila de la hoja',r.row]].map(([k,v])=><React.Fragment key={k}><dt>{k}</dt><dd>{v??'Sin dato en la hoja'}</dd></React.Fragment>)}</dl></article>)}</div>
    </dialog>;
  }
  function SutifinanzasAdminModule({app,onBack,header}){
    const [data,setData]=useState(null),[phase,setPhase]=useState('loading'),[error,setError]=useState('');
    const [filters,setFilters]=useState(blank),[sort,setSort]=useState('amount-desc');
    const [dimensions,setDimensions]=useState(defaults),[columnField,setColumnField]=useState('month'),[expanded,setExpanded]=useState(()=>new Set()),[detail,setDetail]=useState(null),[dragged,setDragged]=useState(null),[notice,setNotice]=useState('');
    const generation=useRef(0),busy=useRef(false),mounted=useRef(false),reportElement=useRef(null),pendingFocus=useRef(null);
    const context=window.SutifinanzasRepository.identity();
    const contextRef=useRef(context);contextRef.current=context;
    function clearBranches(){setExpanded(new Set());setDetail(null);}
    async function refresh(initial=false){
      if(busy.current)return;busy.current=true;
      const g=++generation.current,subject=contextRef.current;
      setPhase('loading');setError('');setData(null);clearBranches();
      try{
        const result=await window.SutifinanzasRepository.load();
        if(!mounted.current||g!==generation.current||subject!==contextRef.current)return;
        if(initial){const years=result.records.map(r=>r.year).filter(Number.isInteger),now=new Date().getFullYear(),year=years.includes(now)?now:Math.max(...years);setFilters({...blank,year:Number.isFinite(year)?String(year):'missing'});}
        setData(result);setPhase('success');
      }catch(e){if(mounted.current&&g===generation.current){setError(errorText(e));setPhase('error');}}
      finally{if(g===generation.current)busy.current=false;}
    }
    useEffect(()=>{mounted.current=true;refresh(true);return()=>{mounted.current=false;generation.current++;busy.current=false;};},[context]);
    function change(k,v){setFilters(f=>({...f,[k]:v}));clearBranches();}
    function layout(next,message){setDimensions(next);clearBranches();setNotice(message||'Orden actualizado: '+next.map(fieldName).join(' → '));}
    function move(field,to){const next=dimensions.filter(f=>f!==field);next.splice(Math.max(0,Math.min(to,next.length)),0,field);layout(next);}
    function toggle(id){pendingFocus.current=id;setExpanded(current=>{const next=new Set(current);if(next.has(id))next.delete(id);else next.add(id);return next;});}
    useEffect(()=>{if(pendingFocus.current!==null){const id=pendingFocus.current;pendingFocus.current=null;const button=[...(reportElement.current?.querySelectorAll('[data-pivot-node]')||[])].find(n=>n.getAttribute('data-pivot-node')===id);button?.focus({preventScroll:true});}},[expanded]);
    const visible=useMemo(()=>data?Model.filter(data.records,filters):[],[data,filters]);
    const summary=useMemo(()=>Model.summarize(visible),[visible]);
    const pivot=useMemo(()=>Model.pivot(visible,dimensions,{sort,columnField}),[visible,dimensions,sort,columnField]);
    function expandLevel(){setExpanded(current=>{const next=new Set(current);function visit(nodes){for(const node of nodes){if(!node.children.length)continue;if(!current.has(node.id))next.add(node.id);else visit(node.children);}}visit(pivot.roots);return next;});}
    const years=data?[...new Set(data.records.map(r=>r.year).filter(Number.isInteger))].sort((a,b)=>b-a):[];
    const statuses=data?[...new Set(data.records.map(r=>Model.normalize(r.status)).filter(Boolean))].sort():[];
    if(!statuses.includes('APROBADO'))statuses.unshift('APROBADO');
    return <section ref={reportElement} className="sf-report" data-sutifinanzas="report" aria-busy={phase==='loading'}>
      <style>{`.sf-report{font-family:Nunito,var(--font-family,sans-serif);color:var(--ink);min-width:0}.sf-body{padding:20px;max-width:1320px;margin:auto}.sf-report button,.sf-report input,.sf-report select{font:inherit}.sf-report button,.sf-report select,.sf-report input{min-height:44px}.sf-report button:focus-visible,.sf-report select:focus-visible,.sf-report input:focus-visible{outline:3px solid var(--guinda);outline-offset:3px}.sf-toolbar,.sf-filters,.sf-crumbs{display:flex;gap:12px;flex-wrap:wrap;align-items:center}.sf-toolbar{justify-content:space-between}.sf-button{border:1px solid var(--border,#ded8dc);background:var(--surface,#fff);color:var(--guinda);border-radius:12px;padding:10px 16px;font-weight:800;cursor:pointer}.sf-button:disabled{opacity:.6;cursor:wait}.sf-filters{margin:20px 0;align-items:end}.sf-filters label{display:flex;flex:1 1 140px;flex-direction:column;gap:7px;font-weight:800;font-size:13px}.sf-filters input,.sf-filters select{min-width:0;width:100%;box-sizing:border-box;border:1px solid var(--border,#ded8dc);border-radius:12px;padding:10px;background:var(--surface,#fff);color:var(--ink)}.sf-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}.sf-card{padding:18px;border-radius:18px;background:var(--surface,#fff);box-shadow:var(--neo-sm);min-width:0}.sf-kpi-label{color:var(--ink-3);font-size:12px;font-weight:800}.sf-kpi-value{font-size:clamp(19px,2vw,28px);font-weight:900;overflow-wrap:anywhere;margin-top:7px}.sf-crumbs{margin:24px 0 10px;gap:4px}.sf-crumbs button{border:0;background:transparent;color:var(--guinda);padding:8px;font-weight:800;cursor:pointer;overflow-wrap:anywhere;text-align:left}.sf-group{width:100%;border:0;border-bottom:1px solid var(--border,#e9e1e5);background:transparent;display:grid;grid-template-columns:minmax(0,1.6fr) minmax(110px,1fr) minmax(90px,.7fr) minmax(100px,.8fr) 20px;gap:14px;align-items:center;text-align:left;padding:18px 4px;color:var(--ink);cursor:pointer}.sf-group:hover{background:var(--guinda-50,#f9f0f3)}.sf-group-title{font-weight:900;overflow-wrap:anywhere}.sf-amount{text-align:right;font-weight:900}.sf-share{font-size:13px}.sf-bar{height:5px;background:var(--guinda-50,#eee);border-radius:9px;margin-top:7px;overflow:hidden}.sf-bar span{display:block;height:100%;background:var(--guinda)}.sf-muted{font-size:12px;color:var(--ink-3);line-height:1.6}.sf-note{background:var(--guinda-50,#f9f0f3);padding:12px 16px;border-radius:12px;margin:16px 0;font-size:13px;line-height:1.6}.sf-details{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.sf-details dl{display:grid;grid-template-columns:minmax(90px,.7fr) minmax(0,1.3fr);gap:8px;margin:0;font-size:13px}.sf-details dt{font-weight:800}.sf-details dd{margin:0;overflow-wrap:anywhere}.sf-state{padding:36px 16px;text-align:center}.sf-list-head{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:center}.sf-list-head select{max-width:100%;border:1px solid var(--border,#ded8dc);border-radius:10px;padding:8px;background:var(--surface,#fff);color:var(--ink)}@media(max-width:700px){.sf-body{padding:14px}.sf-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}.sf-group{grid-template-columns:minmax(0,1fr) minmax(110px,.7fr) 16px;gap:8px}.sf-group .sf-share{grid-row:2;grid-column:1}.sf-group .sf-count{grid-row:2;grid-column:2;text-align:right}.sf-group .sf-chevron{grid-column:3;grid-row:1}.sf-details{grid-template-columns:minmax(0,1fr)}}`}</style>
      <style>{`.sf-body{max-width:1600px;min-width:0}.sf-pivot-card{margin-top:20px;padding:18px 0 0;overflow:hidden}.sf-pivot-heading,.sf-field-panel,.sf-pivot-tools{padding:0 18px 16px}.sf-pivot-heading h2{margin:0 0 6px;font-size:20px}.sf-pivot-heading p{margin:0}.sf-field-panel{border-bottom:1px solid var(--border,#ded8dc)}.sf-zone-label{font-size:12px;font-weight:900;margin-bottom:8px;color:var(--ink-3)}.sf-field-zone{display:flex;flex-wrap:wrap;gap:8px;align-items:center}.sf-field-chip{display:flex;align-items:center;border:1px solid #C5DCE5;border-radius:10px;background:#EDF7FB;max-width:100%;color:#234957;cursor:grab}.sf-field-chip[aria-grabbed=true]{opacity:.5}.sf-field-name{font-weight:800;font-size:12px;padding:0 10px;overflow-wrap:anywhere}.sf-field-chip button{background:transparent;border:0;border-left:1px solid #D7E7ED;padding:0;min-width:44px;color:#234957;cursor:pointer}.sf-field-chip button:disabled{opacity:.3;cursor:default}.sf-pivot-tools{display:flex;gap:12px;flex-wrap:wrap;align-items:end;padding-top:14px}.sf-pivot-tools label{display:flex;flex-direction:column;gap:5px;font-size:12px;font-weight:800}.sf-pivot-tools .sf-button{font-size:12px}.sf-pivot-tools select,.sf-add-field{max-width:100%;min-width:0;border:1px solid var(--border,#ded8dc);border-radius:10px;padding:10px;background:var(--surface,#fff);color:var(--ink)}.sf-layout-note{padding:0 18px 12px;margin:0}.sf-table-scroll{overflow:auto;max-height:70vh;max-width:100%;border-top:1px solid #CCDDE5;overscroll-behavior:contain}.sf-table-scroll:focus-visible{outline:3px solid var(--guinda);outline-offset:-3px}.sf-pivot{border-collapse:separate;border-spacing:0;width:100%;font-size:12px;line-height:1.35;table-layout:auto}.sf-pivot th,.sf-pivot td{border-right:1px solid #D7E5EC;border-bottom:1px solid #D7E5EC;padding:8px 10px}.sf-pivot thead th{position:sticky;top:0;z-index:3;background:#E6F2F7;font-weight:800;color:#234957;text-align:left}.sf-pivot thead tr:first-child th{height:38px;box-sizing:border-box}.sf-pivot thead tr:nth-child(2) th{top:38px;white-space:nowrap}.sf-pivot .sf-dimension-head{min-width:125px;vertical-align:bottom}.sf-pivot .sf-measure-head{color:var(--guinda);background:#F8F2F5}.sf-pivot .sf-dimension{vertical-align:top;background:#E8F5FA;text-align:left;font-weight:600;min-width:125px;max-width:260px;padding:0}.sf-tree-button{display:flex;align-items:flex-start;gap:7px;text-align:left;width:100%;border:0;background:transparent;color:inherit;padding:10px;cursor:pointer;font-size:12px!important}.sf-tree-button:hover{background:#D4EAF4}.sf-tree-button span:last-child{overflow-wrap:anywhere}.sf-tree-icon{flex-shrink:0;width:18px;height:18px;display:grid;place-items:center;border:1px solid #A9C4D0;border-radius:4px;background:#fff;font-size:14px;line-height:1;font-weight:800}.sf-pivot .sf-value{text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums;min-width:115px;background:var(--surface,#fff)}.sf-pivot .sf-total{font-weight:900;background:#FAF7F9;position:sticky;right:0;z-index:1;box-shadow:-1px 0 #CCDDE5}.sf-pivot thead .sf-total-head{right:0;z-index:4;background:#E7DCE2}.sf-pivot tfoot .sf-total{background:#E7DCE2}.sf-pivot .sf-subtotal td,.sf-pivot .sf-subtotal-label{background:#FFF8DE;color:#55491E;font-weight:800}.sf-pivot .sf-subtotal-label{padding:10px;overflow-wrap:anywhere}.sf-pivot tfoot th,.sf-pivot tfoot td{background:#E7DCE2;font-weight:900;color:var(--guinda);border-top:2px solid #B58A9C}.sf-pivot .sf-first-column{position:sticky;left:0;z-index:2;box-shadow:1px 0 #CCDDE5}.sf-pivot thead .sf-first-column{z-index:4}.sf-pivot tfoot .sf-first-column{background:#E7DCE2}.sf-table-hint{padding:12px;font-size:12px;color:var(--ink-3)}.sf-sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}.sf-detail-dialog{font-family:Nunito,sans-serif;color:var(--ink);background:var(--surface,#fff);width:min(960px,calc(100vw - 32px));max-height:85vh;border:1px solid var(--border,#ddd);border-radius:18px;padding:20px;box-sizing:border-box}.sf-detail-dialog::backdrop{background:rgba(20,14,18,.5)}.sf-detail-dialog h2{font-size:20px;overflow-wrap:anywhere}.sf-details{margin-top:16px}.sf-details h3{font-size:16px;margin-top:0}@media(max-width:700px){.sf-field-chip{width:100%}.sf-field-name{flex:1}.sf-pivot-tools label{flex:1 1 130px}.sf-pivot-tools select{width:100%}.sf-pivot .sf-first-column{max-width:140px;min-width:110px}.sf-pivot-card{border-radius:14px}.sf-detail-dialog{padding:14px}}`}</style>
      {header?header({title:'SUTIFINANZAS',sub:'Gasto por Secretaría'}):<button className="sf-button" onClick={onBack}>Volver al Admin</button>}
      <div className="sf-body">
        <div className="sf-toolbar"><div><div className="sf-muted">SUTIFINANZAS</div><h1 style={{margin:'4px 0',fontSize:26}}>Gasto por Secretaría</h1><p style={{margin:'6px 0',fontSize:14}}>Consulta y analiza el gasto autorizado por secretaría.</p></div><button className="sf-button" disabled={phase==='loading'} onClick={()=>refresh()}>{phase==='loading'?'Consultando…':'Actualizar'}</button></div>
        <p className="sf-muted">{data?'Datos consultados de Google Sheets: '+new Date(data.source.consultedAt).toLocaleString('es-MX'):'Fuente: Google Sheets · Gasto por secretaría'}</p>
        {phase==='loading'&&<div className="sf-state" role="status">Consultando el informe de Google Sheets…</div>}
        {phase==='error'&&<div className="sf-note" role="alert">{error}</div>}
        {data&&<>
          <div className="sf-filters">
            <label>Año<select aria-label="Año" value={filters.year} onChange={e=>change('year',e.target.value)}><option value="all">Todos los años</option>{years.map(y=><option key={y} value={y}>{y}</option>)}<option value="missing">Sin año</option></select></label>
            <label>Estatus<select aria-label="Estatus" value={filters.status} onChange={e=>change('status',e.target.value)}><option value="all">Todos los estatus</option>{statuses.map(s=><option key={s} value={s}>{s==='APROBADO'?'Aprobado':s==='RECHAZADO'?'Rechazado':s}</option>)}<option value="missing">Sin estatus</option></select></label>
            <label>Mes<select aria-label="Mes" value={filters.month} onChange={e=>change('month',e.target.value)}><option value="all">Todos los meses</option>{months.map((m,i)=><option key={m} value={String(i+1).padStart(2,'0')}>{m}</option>)}<option value="missing">Sin fecha de gasto</option></select></label>
            <label style={{flexGrow:2}}>Buscar<input type="search" aria-label="Buscar en el informe" placeholder="Secretaría, tipo de gastos, proyecto, partida o requisición" value={filters.search} onChange={e=>change('search',e.target.value)}/></label>
          </div>
          <div className="sf-kpis">{[[filters.status==='APROBADO'?'TOTAL APROBADO':'TOTAL FILTRADO',money(summary.amountCents)],['REQUISICIONES',summary.requisitions],['SECRETARÍAS',summary.secretariats],['PROYECTOS',summary.projects]].map(([label,value])=><div className="sf-card" key={label}><div className="sf-kpi-label">{label}</div><div className="sf-kpi-value">{value}</div></div>)}</div>
          {Object.values(data.quality).some(Boolean)&&<p className="sf-note">Datos faltantes en la hoja: {data.quality.missingSecretariat} filas sin secretaría; {data.quality.missingRequisition} sin número de requisición; {data.quality.missingYear} sin año; {data.quality.missingDate} sin fecha de gasto; {data.quality.missingStatus} sin estatus. Puedes consultarlas con las categorías “Sin…”. El año usa AÑO; el mes usa FECHA DEL GASTO.</p>}
          <div className="sf-card sf-pivot-card">
            <div className="sf-pivot-heading"><h2>Tabla dinámica del gasto</h2><p className="sf-muted">Abre los grupos con + y ciérralos con −. El orden de los campos define cómo se desglosa el gasto.</p></div>
            <div className="sf-field-panel"><div className="sf-zone-label">FILAS · Arrastra para cambiar el orden o usa las flechas</div><div className="sf-field-zone" aria-label="Orden de los campos">
              {dimensions.map((field,index)=><div className="sf-field-chip" key={field} draggable aria-grabbed={dragged===field} data-pivot-field={field} onDragStart={e=>{setDragged(field);e.dataTransfer.setData('text/plain',field);e.dataTransfer.effectAllowed='move';}} onDragEnd={()=>setDragged(null)} onDragOver={e=>{if(dragged)e.preventDefault();}} onDrop={e=>{e.preventDefault();if(dragged&&dragged!==field)move(dragged,index);setDragged(null);}}>
                <span className="sf-field-name">{index+1}. {fieldName(field)}</span><button type="button" aria-label={'Mover '+fieldName(field)+' antes'} disabled={index===0} onClick={()=>move(field,index-1)}>←</button><button type="button" aria-label={'Mover '+fieldName(field)+' después'} disabled={index===dimensions.length-1} onClick={()=>move(field,index+1)}>→</button><button type="button" aria-label={'Quitar '+fieldName(field)} onClick={()=>layout(dimensions.filter(f=>f!==field),'Campo retirado: '+fieldName(field))}>×</button>
              </div>)}
              {!dimensions.length&&<span className="sf-muted">Sin campos de agrupación: se muestra el total general.</span>}
              <select className="sf-add-field" aria-label="Añadir campo a las filas" value="" disabled={dimensions.length===Model.fields.length} onChange={e=>{if(e.target.value)layout([...dimensions,e.target.value],'Campo añadido: '+fieldName(e.target.value));}}><option value="">+ Añadir campo</option>{Model.fields.filter(f=>!dimensions.includes(f.key)).map(f=><option value={f.key} key={f.key}>{f.label}</option>)}</select>
            </div></div>
            <div className="sf-pivot-tools"><label>Columnas<select aria-label="Columnas de la tabla" value={columnField} onChange={e=>setColumnField(e.target.value)}><option value="month">Mes del gasto</option><option value="year">Año</option><option value="none">Solo total</option></select></label><label>Ordenar grupos<select aria-label="Orden del gasto" value={sort} onChange={e=>setSort(e.target.value)}><option value="amount-desc">Mayor importe primero</option><option value="amount-asc">Menor importe primero</option><option value="name">Nombre A–Z</option></select></label><button type="button" className="sf-button" onClick={expandLevel} disabled={!pivot.roots.some(n=>n.children.length)}>Expandir un nivel</button><button type="button" className="sf-button" disabled={!expanded.size} onClick={()=>setExpanded(new Set())}>Contraer todo</button><button type="button" className="sf-button" onClick={()=>{layout(defaults,'Vista inicial restaurada');setColumnField('month');}}>Restablecer vista</button></div>
            <p className="sf-muted sf-layout-note">{visible.length} registros con los filtros activos · Subtotales por grupo · Los importes se muestran en MXN</p>
            <div className="sf-sr-only" role="status" aria-live="polite">{notice}</div>
            <PivotGrid pivot={pivot} dimensions={dimensions} expanded={expanded} onToggle={toggle} onDetail={setDetail}/>
          </div>
          {detail&&<Details key={detail.id} node={detail} onClose={()=>setDetail(null)}/>}
        </>}
      </div>
    </section>;
  }
  window.SutifinanzasAdminModule=SutifinanzasAdminModule;
})();
