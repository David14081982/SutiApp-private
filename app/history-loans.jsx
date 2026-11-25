(function(){
 const h=React.createElement,brand='#9E0A2A',muted='#64748B';
 function HistoryDebtCard({history}){
  const [open,setOpen]=React.useState(false),debt=history.data?.debt;
  const ready=history.phase==='loaded'&&debt,known=ready&&debt.total!==null;
  const loans=ready?debt.loans:[],money=cents=>window.money(cents/100,{dec:cents%100?2:0});
  React.useEffect(()=>setOpen(false),[history.data]);
  const next=known&&debt.next;
  const nextDate=next?new Date(next.date+'T12:00:00-07:00').toLocaleDateString('es-MX',{day:'numeric',month:'short',timeZone:'America/Hermosillo'}):null;
  const tone=i=>['#fff','rgba(255,255,255,.62)','rgba(255,255,255,.34)'][i%3];
  function metadata(loan){
   if(loan.balance===null)return 'Información por revisar';
   const count=loan.remaining===null?'Calendario pendiente de actualizar':
    loan.remaining+(loan.term&&loan.remaining<=loan.term?' de '+loan.term:'')+' pagos restantes';
   const quota=!loan.next?'Próximo pago por confirmar':loan.quota===null?'Cuotas variables':money(loan.quota)+(loan.period?'/'+loan.period:' por pago');
   return count+(loan.remaining===0?'':' · '+quota);
  }
  return h('div',{style:{padding:'4px 16px 0'}},
   h('style',null,'.su-debt-card summary{list-style:none;cursor:pointer}.su-debt-card summary::-webkit-details-marker{display:none}.su-debt-card summary:focus-visible{outline:2px solid white;outline-offset:4px;border-radius:6px}.su-debt-chevron{transition:transform .25s ease}.su-debt-card details[open] .su-debt-chevron{transform:rotate(180deg)}@media(prefers-reduced-motion:reduce){.su-debt-chevron{transition:none}}'),
   h('section',{className:'su-history-hero su-debt-card','aria-label':'Total que debes de tus préstamos','data-debt-state':!ready?history.phase:debt.status,
    style:{background:'linear-gradient(135deg,var(--guinda),var(--guinda-700))',borderRadius:22,padding:18,color:'#fff',boxShadow:'var(--neo-md)',position:'relative',overflow:'hidden'}},
    h('svg',{viewBox:'0 0 24 24',fill:'none',stroke:'#fff',strokeWidth:1.2,strokeLinecap:'round',strokeLinejoin:'round','aria-hidden':true,style:{position:'absolute',top:-20,right:-20,width:130,height:130,opacity:.12,pointerEvents:'none'}},
     h('rect',{x:2.5,y:6,width:19,height:12,rx:2}),h('circle',{cx:12,cy:12,r:2.6}),h('path',{d:'M6 9.5v5M18 9.5v5'})),
    h('div',{style:{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8,position:'relative'}},
     h('span',{style:{fontSize:'var(--text-12-5,12.5px)',fontWeight:700,letterSpacing:'.04em'}},'TOTAL QUE DEBES'),
     known&&h('span',{'data-debt-count':'',style:{fontSize:'var(--text-12,12px)',fontWeight:700}},loans.length+' préstamo'+(loans.length===1?'':'s'))),
    h('div',{'data-debt-total':'',role:!known?'status':undefined,style:{marginTop:6,fontSize:known?'var(--text-32,32px)':'var(--text-20,20px)',fontWeight:800,letterSpacing:'-.02em',lineHeight:1.15,overflowWrap:'anywhere',position:'relative'}},
     known?money(debt.total):history.phase==='error'?'No disponible':ready?'Saldo por revisar':'Consultando…'),
    h('p',{'data-debt-next':'',style:{margin:'4px 0 0',fontSize:'var(--text-13,13px)',fontWeight:600,position:'relative'}},
     next?'Descuento próximo pago '+money(next.amount)+' - '+nextDate:
      known?(debt.total===0?'Sin pagos pendientes':'Próximo descuento por confirmar'):
      history.phase==='error'?'No pudimos consultar tu saldo.':ready?'Hay datos de tus préstamos que requieren revisión.':'Cargando el saldo de tus préstamos.'),
    known&&debt.total>0&&h('div',{'data-debt-bar':'','aria-hidden':true,style:{display:'flex',gap:4,marginTop:14}},
     loans.map((loan,i)=>h('div',{key:loan.id,style:{flex:loan.balance+' 1 0%',minWidth:0,height:6,borderRadius:999,background:tone(i)}}))),
    loans.length>0&&h('details',{open,onToggle:e=>setOpen(e.currentTarget.open),style:{marginTop:12,borderTop:'1px solid rgba(255,255,255,.25)'}},
     h('summary',{style:{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8,paddingTop:8,fontSize:'var(--text-13,13px)',fontWeight:700}},
      h('span',null,open?'Ocultar desglose':'Ver desglose por préstamo'),
      h('svg',{className:'su-debt-chevron',viewBox:'0 0 24 24',width:20,height:20,fill:'none',stroke:'currentColor',strokeWidth:2.2,strokeLinecap:'round',strokeLinejoin:'round','aria-hidden':true,style:{flexShrink:0}},h('path',{d:'m5 9 7 7 7-7'}))),
     open&&h('ul',{style:{listStyle:'none',margin:'10px 0 0',padding:0,display:'flex',flexDirection:'column',gap:8}},
      loans.map((loan,i)=>h('li',{key:loan.id,'data-debt-loan':loan.id,'aria-label':loan.fund+', préstamo '+loan.id,style:{display:'flex',alignItems:'center',gap:10,fontSize:'var(--text-13,13px)'}},
       h('span',{'aria-hidden':true,style:{flex:'none',width:8,height:8,borderRadius:999,background:tone(i)}}),
       h('span',{style:{flex:1,minWidth:0,overflowWrap:'anywhere'}},h('span',{style:{fontWeight:700}},loan.fund),h('span',{style:{display:'block',fontSize:'var(--text-11-5,11.5px)',fontWeight:600}},metadata(loan))),
       h('span',{'data-debt-balance':'',style:{fontWeight:800,fontVariantNumeric:'tabular-nums',maxWidth:'44%',overflowWrap:'anywhere',textAlign:'right'}},loan.balance===null?'Por revisar':money(loan.balance))))))));
 }
 function HistoryPill({entry}){
  const overdue=window.LoanHistory.normalize(entry.status)==='SALDO ATRASADO';
  const meta={'En proceso':['amber','clock','En revisión'],'Aprobadas':['green','checkCircle','Aprobada'],
   'En pago':[overdue?'amber':'blue','clock','En pago'],'Liquidadas':['green','checkCircle','Liquidada'],
   'No aprobadas':['red','close','No aprobada']}[entry.category]||['amber','info','Por revisar'];
  return h(window.Badge,{tone:meta[0],icon:meta[1]},meta[2]);
 }
 function ApprovalClock({entry}){
  if(entry.category!=='Aprobadas'||entry.remaining==null)return null;
  const seconds=Math.ceil(entry.remaining/1000),hours=Math.floor(seconds/3600),minutes=Math.floor(seconds%3600/60);
  return h('div',{'data-approval-countdown':'',style:{fontSize:'var(--text-11-5, 11.5px)',color:'var(--ink-3)',marginTop:5,fontWeight:600}},
   'En Aprobadas por '+String(hours).padStart(2,'0')+':'+String(minutes).padStart(2,'0')+':'+String(seconds%60).padStart(2,'0'));
 }
 function HistorySourceState({history}){
  const observation=history.data,state=observation?.sync_state?.status,failed=history.phase==='error'||state==='FAILED'||state==='DISABLED';
  const time=observation?.source_updated_at?new Date(observation.source_updated_at).toLocaleString('es-MX',{timeZone:'America/Hermosillo'}):null;
  let message=history.phase==='error'?'No pudimos actualizar tu historial. ':history.phase==='refreshing'?'Actualizando tu historial… ':history.phase==='loading'?'Consultando tus préstamos y solicitudes financieras… ':state==='FAILED'?'La última actualización no se completó. ':state==='RUNNING'?'Finanzas está actualizando el historial. ':state==='DISABLED'?'La actualización del historial no está disponible. ':state==='EMPTY'?'El historial aún no tiene una publicación disponible. ':'';
  if(failed&&observation)message+='Se muestra la última publicación completa. ';
  return h('div',{'data-history-source':history.phase,role:'status',style:{padding:'10px 4px',fontSize:'var(--history-detail-secondary, 11px)',lineHeight:1.5,color:failed?'#A32921':muted,textAlign:'center'}},
   message,time&&h('span',{'data-history-updated':''},'Información actualizada: '+time+'. '),
   failed&&h('button',{onClick:history.retry,style:{color:'inherit',fontWeight:700,textDecoration:'underline'}},'Reintentar'));
 }
 function LoanHistoryDetail({app,loanKey}){
  const history=window.LoanHistory.useHistory(loanKey),entry=history.data?window.LoanHistory.project(history.data,history.elapsed).find(row=>row.key===loanKey):null;
  const [downloadError,setDownloadError]=React.useState(false),money=v=>v==null?'No registrado':window.money(v),metrics=entry?window.LoanHistory.metrics(entry):null;
  const status=entry&&window.LoanHistory.normalize(entry.status),liquidated=entry?.category==='Liquidadas',overdue=status==='SALDO ATRASADO';
  const chip=(label,color,bg)=>h('span',{style:{display:'inline-flex',alignItems:'center',fontSize:'var(--text-12, 14px)',fontWeight:800,padding:'4px 7px',borderRadius:8,color,background:bg,lineHeight:1.3,maxWidth:'100%',whiteSpace:'normal',overflowWrap:'anywhere'}},label);
  const headerButton={width:38,height:38,flexShrink:0,borderRadius:20,border:'1px solid #FFFFFF26',background:'#FFFFFF19',color:'white',display:'grid',placeItems:'center'};
  const canDownload=entry?.kind==='loan',downloadLabel=entry?.kind==='request'?'Estado de cuenta disponible únicamente para préstamos':'Descargar estado de cuenta';
  const download=()=>{try{if(canDownload){window.LoanHistoryStatement.download(entry,{...history.data,server_now:new Date(Date.parse(history.data.server_now)+history.elapsed).toISOString()});setDownloadError(false);}}catch(_){setDownloadError(true);}};
  return h('div',{className:'su-route','data-loan-history-detail':'',style:{position:'absolute',inset:0,background:'#F4F6F9',display:'flex',flexDirection:'column',color:'#0F172A','--history-detail-secondary':'var(--text-12, 14px)','--text-11-5':'var(--text-12, 14px)',fontSize:'var(--text-16, 16px)',lineHeight:1.45}},
   h('header',{style:{padding:'24px 16px 72px',background:'linear-gradient(135deg,#9E0A2A,#870420 55%,#600216)',color:'white',flexShrink:0}},
    h('div',{style:{display:'flex',alignItems:'center',justifyContent:'space-between',gap:8}},
     h('button',{type:'button',onClick:app.back,'aria-label':'Volver al historial',style:headerButton},h(window.Icon,{name:'arrowL',size:20})),
     h('div',{style:{textAlign:'center',minWidth:0}},h('div',{style:{fontSize:'var(--text-12, 14px)',fontWeight:700,letterSpacing:1.2,color:'#FECDD3'}},'SUTIFINANZAS'),
      h('h1',{style:{fontSize:'var(--text-20, 20px)',fontWeight:800,margin:'3px 0 0',lineHeight:1.3}},entry?.kind==='request'?'Solicitud':'Amortización de pagos')),
     h('button',{type:'button',onClick:download,disabled:!canDownload,'aria-label':downloadLabel,title:downloadLabel,style:{...headerButton,opacity:canDownload?1:.45}},h(window.Icon,{name:'download',size:20})))),
   h('main',{className:'su-app-scroll','data-amortization-scroll':'',style:{position:'relative',flex:1,minHeight:0,overflowY:'auto',overflowAnchor:'none',marginTop:-52,padding:'0 14px 28px',zIndex:1}},
    entry&&h('section',{'data-purpose':'loan-summary',style:{background:'white',border:'1px solid #F1F5F9',borderRadius:24,padding:18,boxShadow:'0 8px 24px -4px #0F172A0F'}},
     h('div',{style:{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8,flexWrap:'wrap',marginBottom:14}},
      h('div',{style:{display:'flex',gap:7,alignItems:'center',flexWrap:'wrap'}},chip(entry.kind==='loan'?'Descuento Vía Nómina':'Solicitud',brand,'#FFF1F3'),
       h('span',{style:{fontSize:'var(--text-12, 14px)',color:'#94A3B8',overflowWrap:'anywhere'}},'Ref: #'+entry.id)),
      chip(entry.term==null?'Plazo no registrado':entry.term+' pagos','#334155','#F1F5F9')),
     h('div',{style:{fontWeight:700,fontSize:'var(--text-16, 16px)',color:muted,marginBottom:12,overflowWrap:'anywhere'}},entry.fund),
     h('div',{style:{fontSize:'var(--text-12, 14px)',color:muted,textTransform:'uppercase',letterSpacing:.8}},'Monto del préstamo'),
     h('div',{style:{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap',margin:'4px 0 8px'}},
      h('strong',{'data-loan-principal':'',style:{fontSize:'var(--text-34, 34px)',fontWeight:800,letterSpacing:-.6,minWidth:0,maxWidth:'100%',overflowWrap:'anywhere'}},money(entry.principal)),
      liquidated?chip('Liquidada','#047857','#ECFDF5'):status==='AL CORRIENTE'?chip('Al corriente','#047857','#ECFDF5'):overdue?chip('Saldo atrasado','#92400E','#FEF3C7'):h(HistoryPill,{entry})),
     h('div',{style:{fontSize:'var(--text-16, 16px)',color:muted,marginBottom:16}},'Total a pagar: ',h('strong',{'data-loan-total':'',style:{fontSize:'var(--text-18, 18px)',color:'#334155'}},money(entry.total))),
     entry.kind==='loan'&&h('div',{style:{background:'#F8FAFC',border:'1px solid #F1F5F9',borderRadius:16,padding:13}},
      h('div',{style:{display:'flex',justifyContent:'space-between',gap:8,alignItems:'center',fontSize:'var(--text-12, 14px)',marginBottom:9}},
       h('strong',{style:{color:'#475569'}},'Progreso de liquidación'),h('strong',{'data-monetary-progress':'',style:{fontSize:'var(--text-16, 16px)',color:brand}},metrics.progress==null?'Por revisar':metrics.progress.toLocaleString('es-MX',{maximumFractionDigits:2})+'%')),
      h('div',{role:'progressbar','aria-label':'Progreso de liquidación','aria-valuemin':0,'aria-valuemax':100,'aria-valuenow':metrics.progress==null?undefined:Math.min(100,metrics.progress),style:{background:'#E2E8F0',height:10,borderRadius:10,padding:2,overflow:'hidden'}},
       h('div',{style:{height:'100%',width:(metrics.progress==null?0:Math.min(100,metrics.progress))+'%',borderRadius:8,background:'linear-gradient(90deg,#9E0A2A,#F43F5E)',transition:'width .4s'}})),
      h('div',{style:{display:'grid',gridTemplateColumns:'minmax(0, 1fr) minmax(0, 1fr)',gap:10,marginTop:12,paddingTop:12,borderTop:'1px solid #E2E8F0',fontSize:'var(--text-12, 14px)'}},
       h('div',null,h('div',{style:{color:'#94A3B8'}},'Total pagado'),h('strong',{'data-loan-paid':'',style:{fontSize:'calc(clamp(16px, 5vw, 18px) * var(--text-scale, 1))',color:'#047857',display:'block',marginTop:3,overflowWrap:'anywhere'}},money(entry.paid_to_date))),
       h('div',{style:{borderLeft:'1px solid #E2E8F0',paddingLeft:10}},h('div',{style:{color:'#94A3B8'}},'Saldo pendiente'),h('strong',{'data-loan-balance':'',style:{fontSize:'calc(clamp(16px, 5vw, 18px) * var(--text-scale, 1))',color:brand,display:'block',marginTop:3,overflowWrap:'anywhere'}},money(metrics.balance)))),
      metrics.overpaid>0&&h('p',{style:{fontSize:'var(--text-12, 14px)',color:muted,marginBottom:0}},'Pago excedente registrado: '+money(metrics.overpaid)),
      metrics.progress==null&&h('p',{role:'status',style:{fontSize:'var(--text-12, 14px)',color:'#92400E',marginBottom:0}},'Faltan importes válidos para mostrar el progreso.')),
     entry.approved_at&&h('div',{style:{fontSize:'var(--text-12, 14px)',color:muted,marginTop:12}},'Aprobada: '+new Date(entry.approved_at).toLocaleString('es-MX',{timeZone:'America/Hermosillo'})),h(ApprovalClock,{entry})),
    h(HistorySourceState,{history}),downloadError&&h('p',{role:'alert',style:{color:'#A32921',fontSize:'var(--text-16, 16px)'}},'No se pudo descargar el estado de cuenta. Inténtalo de nuevo.'),
    !entry&&history.phase==='loaded'&&h('p',{role:'status'},'El registro no está disponible en tu historial.'),
    entry?.kind==='loan'&&h(React.Fragment,null,
     h('section',{'data-purpose':'schedule-filters',style:{display:'flex',gap:8,padding:'4px 3px 14px',color:muted,fontSize:'var(--text-16, 16px)',lineHeight:1.6}},h(window.Icon,{name:'info',size:16,color:brand}),
      h('p',{style:{margin:0}},'Historial')),
     entry.preparing?h('div',{role:'status',style:{padding:18,background:'white',borderRadius:18,fontSize:'var(--text-16, 16px)'}},'Finanzas aprobó tu solicitud. La amortización aún está en preparación. ',h('button',{onClick:history.retry},'Actualizar')):
      h('section',{'data-purpose':'amortization-list',style:{background:'white',borderRadius:24,border:'1px solid #F1F5F9',overflow:'hidden',boxShadow:'0 8px 24px -4px #0F172A0F'}},
       entry.schedule.map((row,i)=>h('article',{key:row.source_row??i,'data-installment':row.state,style:{padding:'16px 12px',borderTop:i?'1px solid #F1F5F9':0,borderLeft:row.upcoming?'4px solid #F59E0B':'4px solid transparent',background:row.upcoming?'#FFFBEB80':'white',display:'flex',gap:9,alignItems:'center'}},
        h('div',{style:{width:34,height:38,borderRadius:13,display:'grid',placeItems:'center',flexShrink:0,fontWeight:800,fontSize:'min(var(--text-12, 14px), 18px)',background:row.upcoming?'#FEF3C7':row.state==='Pagada'?'#ECFDF5':'#F1F5F9',color:row.upcoming?'#92400E':row.state==='Pagada'?'#059669':muted}},i+1),
        h('div',{style:{flex:1,minWidth:0}},h('div',{style:{fontSize:'var(--text-16, 16px)',fontWeight:800,marginBottom:4}},'Cuota '+(i+1)),
         row.upcoming&&chip('Próxima a vencer','#92400E','#FEF3C7'),row.closure&&chip('Cierre de contrato',muted,'#F1F5F9'),
         h('div',{style:{fontSize:'var(--text-12, 14px)',color:row.upcoming?'#B45309':'#94A3B8',marginTop:5,display:'flex',alignItems:'center',gap:3}},h(window.Icon,{name:'calendar',size:12}),window.LoanHistory.formatDate(row.date))),
        h('div',{style:{textAlign:'right',flexShrink:0,maxWidth:'43%'}},h('div',{style:{fontSize:'var(--text-18, 18px)',fontWeight:800,color:row.amount===0?'#94A3B8':row.upcoming?'#78350F':brand,marginBottom:5,overflowWrap:'anywhere'}},money(row.amount)),
         chip(row.state,row.state==='Pagada'?'#047857':row.upcoming?'#92400E':muted,row.state==='Pagada'?'#ECFDF5':row.upcoming?'#FEF3C7':'#F1F5F9')))))),
    entry&&h('section',{'data-purpose':'payroll-support',style:{display:'flex',alignItems:'center',gap:9,padding:13,marginTop:16,borderRadius:16,background:'linear-gradient(90deg,#FFF1F2,#FFF7ED)',border:'1px solid #FFE4E6'}},
     h('div',{style:{width:30,height:34,borderRadius:10,background:brand,color:'white',display:'grid',placeItems:'center',flexShrink:0}},h(window.Icon,{name:'shield',size:17})),
     h('div',{style:{flex:1,minWidth:0}},h('div',{style:{fontSize:'var(--text-16, 16px)',fontWeight:800}},entry.kind==='loan'?'Pagos asegurados por nómina':'Soporte de solicitudes'),h('div',{style:{fontSize:'var(--text-12, 14px)',color:muted,marginTop:3}},entry.kind==='loan'?'No requiere transferencias manuales adicionales.':'Consulta el avance de tu solicitud.')),
     h('button',{type:'button',style:{fontWeight:800,fontSize:'var(--text-16, 16px)',color:brand,flexShrink:0},onClick:()=>window.open('https://api.whatsapp.com/send/?phone=526626727130&text&type=phone_number&app_absent=0','_blank','noopener,noreferrer')},'Soporte'))));
 }
 Object.assign(window,{HistoryDebtCard,HistoryPill,ApprovalClock,HistorySourceState,LoanHistoryDetail});
})();
