(function(){
  'use strict';
  const {useState,useEffect,useRef}=React,Model=window.SutifinanzasModel;
  const money=c=>new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN'}).format(c/100);
  const names={secretariat:'Secretarías',project:'Proyectos',item:'Partidas presupuestales',requisition:'Requisiciones'};
  const months=['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const blank={year:'all',status:'APROBADO',month:'all',search:''};
  function errorText(error){
    const d=error.details||{};
    if(error.message==='MISSING_HEADERS')return 'La estructura del informe cambió. Faltan encabezados: '+(d.missing||[]).join(', ')+'.';
    if(error.message==='AMBIGUOUS_HEADERS')return 'La estructura del informe cambió. Hay encabezados duplicados: '+(d.headers||[]).join(', ')+'.';
    if(d.row)return 'No se pudo validar la fila '+d.row+' de Google Sheets, columna “'+d.header+'” ('+error.message+'). Revisa la fuente y actualiza.';
    if(error.message==='GOOGLE_ACCESS_DENIED')return 'La integración de Google de SutiApp no tiene acceso a este archivo. Autoriza la hoja en la conexión existente y vuelve a actualizar.';
    if(['AUTH_REQUIRED','ADMIN_DENIED','CONTEXT_CHANGED'].includes(error.message))return 'Tu sesión o permiso para consultar este informe cambió. Vuelve a entrar al módulo.';
    return 'No se pudo consultar Google Sheets. Intenta actualizar nuevamente. ('+error.message+')';
  }
  function SutifinanzasAdminModule({app,onBack,header}){
    const [data,setData]=useState(null),[phase,setPhase]=useState('loading'),[error,setError]=useState('');
    const [filters,setFilters]=useState(blank),[path,setPath]=useState([]),[sort,setSort]=useState('amount-desc');
    const generation=useRef(0),busy=useRef(false),mounted=useRef(false),scroll=useRef(new Map()),heading=useRef(null),pendingScroll=useRef(null);
    const context=window.SutifinanzasRepository.identity();
    const contextRef=useRef(context);contextRef.current=context;
    async function refresh(initial=false){
      if(busy.current)return;busy.current=true;
      const g=++generation.current,subject=contextRef.current;
      setPhase('loading');setError('');setData(null);
      try{
        const result=await window.SutifinanzasRepository.load();
        if(!mounted.current||g!==generation.current||subject!==contextRef.current)return;
        if(initial){const years=result.records.map(r=>r.year).filter(Number.isInteger),now=new Date().getFullYear(),year=years.includes(now)?now:Math.max(...years);setFilters({...blank,year:Number.isFinite(year)?String(year):'missing'});}
        setPath([]);scroll.current.clear();setData(result);setPhase('success');
      }catch(e){if(mounted.current&&g===generation.current){setError(errorText(e));setPhase('error');}}
      finally{if(g===generation.current)busy.current=false;}
    }
    useEffect(()=>{mounted.current=true;refresh(true);return()=>{mounted.current=false;generation.current++;busy.current=false;};},[context]);
    useEffect(()=>{if(pendingScroll.current!==null){const {top,parent}=pendingScroll.current;if(parent)parent.scrollTop=top;else window.scrollTo(0,top);pendingScroll.current=null;heading.current?.focus({preventScroll:true});}},[path]);
    function scrollParent(){let p=heading.current?.parentElement;while(p){if(/auto|scroll/.test(getComputedStyle(p).overflowY)&&p.scrollHeight>p.clientHeight)return p;p=p.parentElement;}return null;}
    function navigate(next){const parent=scrollParent();scroll.current.set(JSON.stringify(path),{top:parent?parent.scrollTop:window.scrollY,parent});pendingScroll.current=scroll.current.get(JSON.stringify(next))||{top:parent?parent.scrollTop:window.scrollY,parent};setPath(next);}
    function change(k,v){setFilters(f=>({...f,[k]:v}));setPath([]);scroll.current.clear();}
    const visible=data?Model.filter(data.records,filters):[],summary=Model.summarize(visible),view=Model.explore(visible,path,sort);
    const years=data?[...new Set(data.records.map(r=>r.year).filter(Number.isInteger))].sort((a,b)=>b-a):[];
    const statuses=data?[...new Set(data.records.map(r=>Model.normalize(r.status)).filter(Boolean))].sort():[];
    if(!statuses.includes('APROBADO'))statuses.unshift('APROBADO');
    return <section className="sf-report" data-sutifinanzas="report" aria-busy={phase==='loading'}>
      <style>{`.sf-report{font-family:Nunito,var(--font-family,sans-serif);color:var(--ink);min-width:0}.sf-body{padding:20px;max-width:1320px;margin:auto}.sf-report button,.sf-report input,.sf-report select{font:inherit}.sf-report button,.sf-report select,.sf-report input{min-height:44px}.sf-report button:focus-visible,.sf-report select:focus-visible,.sf-report input:focus-visible{outline:3px solid var(--guinda);outline-offset:3px}.sf-toolbar,.sf-filters,.sf-crumbs{display:flex;gap:12px;flex-wrap:wrap;align-items:center}.sf-toolbar{justify-content:space-between}.sf-button{border:1px solid var(--border,#ded8dc);background:var(--surface,#fff);color:var(--guinda);border-radius:12px;padding:10px 16px;font-weight:800;cursor:pointer}.sf-button:disabled{opacity:.6;cursor:wait}.sf-filters{margin:20px 0;align-items:end}.sf-filters label{display:flex;flex:1 1 140px;flex-direction:column;gap:7px;font-weight:800;font-size:13px}.sf-filters input,.sf-filters select{min-width:0;width:100%;box-sizing:border-box;border:1px solid var(--border,#ded8dc);border-radius:12px;padding:10px;background:var(--surface,#fff);color:var(--ink)}.sf-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}.sf-card{padding:18px;border-radius:18px;background:var(--surface,#fff);box-shadow:var(--neo-sm);min-width:0}.sf-kpi-label{color:var(--ink-3);font-size:12px;font-weight:800}.sf-kpi-value{font-size:clamp(19px,2vw,28px);font-weight:900;overflow-wrap:anywhere;margin-top:7px}.sf-crumbs{margin:24px 0 10px;gap:4px}.sf-crumbs button{border:0;background:transparent;color:var(--guinda);padding:8px;font-weight:800;cursor:pointer;overflow-wrap:anywhere;text-align:left}.sf-group{width:100%;border:0;border-bottom:1px solid var(--border,#e9e1e5);background:transparent;display:grid;grid-template-columns:minmax(0,1.6fr) minmax(110px,1fr) minmax(90px,.7fr) minmax(100px,.8fr) 20px;gap:14px;align-items:center;text-align:left;padding:18px 4px;color:var(--ink);cursor:pointer}.sf-group:hover{background:var(--guinda-50,#f9f0f3)}.sf-group-title{font-weight:900;overflow-wrap:anywhere}.sf-amount{text-align:right;font-weight:900}.sf-share{font-size:13px}.sf-bar{height:5px;background:var(--guinda-50,#eee);border-radius:9px;margin-top:7px;overflow:hidden}.sf-bar span{display:block;height:100%;background:var(--guinda)}.sf-muted{font-size:12px;color:var(--ink-3);line-height:1.6}.sf-note{background:var(--guinda-50,#f9f0f3);padding:12px 16px;border-radius:12px;margin:16px 0;font-size:13px;line-height:1.6}.sf-details{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.sf-details dl{display:grid;grid-template-columns:minmax(90px,.7fr) minmax(0,1.3fr);gap:8px;margin:0;font-size:13px}.sf-details dt{font-weight:800}.sf-details dd{margin:0;overflow-wrap:anywhere}.sf-state{padding:36px 16px;text-align:center}.sf-list-head{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:center}.sf-list-head select{max-width:100%;border:1px solid var(--border,#ded8dc);border-radius:10px;padding:8px;background:var(--surface,#fff);color:var(--ink)}@media(max-width:700px){.sf-body{padding:14px}.sf-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}.sf-group{grid-template-columns:minmax(0,1fr) minmax(110px,.7fr) 16px;gap:8px}.sf-group .sf-share{grid-row:2;grid-column:1}.sf-group .sf-count{grid-row:2;grid-column:2;text-align:right}.sf-group .sf-chevron{grid-column:3;grid-row:1}.sf-details{grid-template-columns:minmax(0,1fr)}}`}</style>
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
            <label style={{flexGrow:2}}>Buscar<input type="search" aria-label="Buscar en el informe" placeholder="Secretaría, proyecto, partida o requisición" value={filters.search} onChange={e=>change('search',e.target.value)}/></label>
          </div>
          <div className="sf-kpis">{[[filters.status==='APROBADO'?'TOTAL APROBADO':'TOTAL FILTRADO',money(summary.amountCents)],['REQUISICIONES',summary.requisitions],['SECRETARÍAS',summary.secretariats],['PROYECTOS',summary.projects]].map(([label,value])=><div className="sf-card" key={label}><div className="sf-kpi-label">{label}</div><div className="sf-kpi-value">{value}</div></div>)}</div>
          {Object.values(data.quality).some(Boolean)&&<p className="sf-note">Datos faltantes en la hoja: {data.quality.missingSecretariat} filas sin secretaría; {data.quality.missingRequisition} sin número de requisición; {data.quality.missingYear} sin año; {data.quality.missingDate} sin fecha de gasto; {data.quality.missingStatus} sin estatus. Puedes consultarlas con las categorías “Sin…”. El año usa AÑO; el mes usa FECHA DEL GASTO.</p>}
          <nav aria-label="Desglose del gasto" className="sf-crumbs"><button onClick={()=>navigate([])} aria-current={!path.length?'page':undefined}>Todas las secretarías</button>{path.map((p,i)=><React.Fragment key={i}><span aria-hidden="true">›</span><button onClick={()=>navigate(path.slice(0,i+1))} aria-current={i===path.length-1?'page':undefined}>{p.label}</button></React.Fragment>)}</nav>
          <div className="sf-card"><div className="sf-list-head"><h2 ref={heading} tabIndex={-1} style={{fontSize:19,margin:'4px 0'}}>{names[view.level]||'Detalle de requisición'}</h2>{view.level&&<select aria-label="Orden del gasto" value={sort} onChange={e=>setSort(e.target.value)}><option value="amount-desc">Mayor importe primero</option><option value="amount-asc">Menor importe primero</option><option value="name">Nombre A–Z</option></select>}</div><p className="sf-muted">{visible.length} registros con los filtros activos · Porcentajes sobre el total filtrado · Importes en MXN</p>
            {!view.records.length?<div className="sf-state" role="status">No hay registros para estos filtros.</div>:view.level?view.groups.map(g=><button className="sf-group" key={g.key??'missing'} aria-label={'Desglosar '+g.label} onClick={()=>navigate([...path,{key:g.key,label:g.label}])}><span className="sf-group-title">{g.label}</span><span className="sf-amount">{money(g.amountCents)}</span><span className="sf-share">{g.percentage.toLocaleString('es-MX',{maximumFractionDigits:1})}%<span className="sf-bar" aria-hidden="true"><span style={{width:Math.max(0,Math.min(100,g.percentage))+'%'}}/></span></span><span className="sf-muted sf-count">{g.count} registros<br/>{g.requisitions} requisiciones</span><span className="sf-chevron" aria-hidden="true">›</span></button>):<div className="sf-details">{view.records.map(r=><article className="sf-card" key={r.id}><h3 style={{marginTop:0}}>{r.concept||'Sin concepto'}</h3><dl>{[['Requisición',r.requisition],['Producto',r.id],['Fecha del gasto',r.date],['Secretaría',r.secretariat],['Proyecto',r.project],['Partida',r.item],['Clave presupuestal',r.budgetCode],['Importe',money(r.amount*100)],['Estatus',r.status],['Año',r.year],['Forma de pago',r.payment],['Fila de la hoja',r.row]].map(([k,v])=><React.Fragment key={k}><dt>{k}</dt><dd>{v??'Sin dato en la hoja'}</dd></React.Fragment>)}</dl></article>)}</div>}
          </div>
        </>}
      </div>
    </section>;
  }
  window.SutifinanzasAdminModule=SutifinanzasAdminModule;
})();
