(function(){
 const h=React.createElement;
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
   'En pago en '+String(hours).padStart(2,'0')+':'+String(minutes).padStart(2,'0')+':'+String(seconds%60).padStart(2,'0'));
 }
 function HistorySourceState({history}){
  if(history.phase==='loaded')return null;
  return h('div',{'data-history-source':history.phase,role:'status',style:{padding:'18px 20px',fontSize:13,color:history.phase==='error'?'#A32921':'var(--ink-3)',textAlign:'center'}},
   history.phase==='error'?'No pudimos consultar tus préstamos y solicitudes financieras. ':'Consultando tus préstamos y solicitudes financieras…',
   history.phase==='error'&&h('button',{onClick:history.retry,style:{color:'inherit',fontWeight:700}},'Reintentar'));
 }
 function LoanHistoryDetail({app,loanKey}){
  const history=window.LoanHistory.useHistory(),entry=history.data?window.LoanHistory.project(history.data,history.elapsed).find(row=>row.key===loanKey):null;
  const money=v=>v==null?'No registrado':window.money(v),cell=(label,value)=>h('div',null,h('div',{style:{fontSize:12,color:'var(--ink-3)',fontWeight:600}},label),h('div',{style:{fontSize:17,fontWeight:800,marginTop:4}},value));
  return h('div',{className:'su-route','data-loan-history-detail':'',style:{position:'absolute',inset:0,background:'var(--bg)',display:'flex',flexDirection:'column'}},
   h('div',{style:{display:'flex',alignItems:'center',padding:'8px 12px',background:'var(--surface)',borderBottom:'1px solid var(--hairline)'}},
    h('button',{onClick:app.back,'aria-label':'Volver al historial',style:{width:40,height:40,border:0,background:'transparent',color:'var(--ink)'}},h(window.Icon,{name:'arrowL',size:22})),
    h('span',{style:{fontSize:17,fontWeight:800}},entry?.kind==='request'?'Solicitud':'Amortización de pagos')),
   h('div',{className:'su-app-scroll',style:{flex:1,minHeight:0,overflowY:'auto',padding:20}},h(HistorySourceState,{history}),
    !entry&&history.phase==='loaded'&&h('p',{role:'status'},'El registro no está disponible en tu historial.'),
    entry&&h(React.Fragment,null,
     h('div',{style:{background:'var(--surface)',borderRadius:20,padding:18,boxShadow:'var(--neo-md)'}},
      h('div',{style:{display:'flex',alignItems:'center',gap:12}},h(window.IconTile,{icon:'receipt',size:50}),
       h('div',{style:{flex:1,minWidth:0}},h('div',{style:{fontSize:17,fontWeight:800,overflowWrap:'anywhere'}},entry.fund),h('div',{style:{fontFamily:'var(--mono)',fontSize:12,color:'var(--ink-3)'}},'Préstamo '+entry.id)),h(HistoryPill,{entry})),
      h('div',{style:{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginTop:18,paddingTop:16,borderTop:'1px solid var(--hairline)'}},cell('Monto del préstamo',money(entry.principal)),cell('Total a pagar',money(entry.total)),
       entry.kind==='loan'&&cell('Pagado a hoy',money(entry.paid_to_date)),cell('Plazo',entry.term==null?'No registrado':entry.term+' pagos')),
      entry.approved_at&&h('div',{style:{fontSize:12,color:'var(--ink-3)',marginTop:14}},'Aprobada: '+new Date(entry.approved_at).toLocaleString('es-MX',{timeZone:'America/Hermosillo'})),
      h(ApprovalClock,{entry}),
      entry.category==='En pago'&&h('div',{style:{marginTop:10,fontSize:13,fontWeight:700,color:window.LoanHistory.normalize(entry.status)==='SALDO ATRASADO'?'#9A6B16':'#2456C7'}},window.LoanHistory.normalize(entry.status)==='SALDO ATRASADO'?'Saldo atrasado':'Al corriente')),
     entry.kind==='loan'&&h('div',{style:{marginTop:22}},h(window.SectionHead,{title:'Amortización de pagos',icon:'receipt'}),
      h('p',{style:{fontSize:12,color:'var(--ink-3)',lineHeight:1.5}},'Las cuotas con fecha de hoy o anterior figuran como pagadas conforme al registro de Finanzas. Las fechas futuras corresponden a cuotas pendientes.'),
      entry.preparing&&h('div',{role:'status',style:{padding:18,background:'var(--surface)',borderRadius:18}},'Finanzas aprobó tu solicitud. La amortización aún está en preparación. ',h('button',{onClick:history.retry},'Actualizar')),
      !entry.preparing&&h('div',{style:{background:'var(--surface)',borderRadius:18,boxShadow:'var(--neo-sm)',overflow:'hidden'}},
       entry.schedule.map((row,i)=>h('div',{key:row.source_row,'data-installment':row.state,style:{padding:'14px 16px',borderTop:i?'1px solid var(--hairline)':'none',display:'flex',gap:12,alignItems:'center'}},
        h('div',{style:{flex:1}},h('div',{style:{fontSize:13,fontWeight:800}},row.number==null?'Cuota':'Cuota '+row.number),h('div',{style:{fontSize:12,color:'var(--ink-3)',marginTop:4}},window.LoanHistory.formatDate(row.date))),
        h('div',{style:{textAlign:'right'}},h('div',{style:{fontSize:15,fontWeight:800,color:'var(--guinda)',marginBottom:5}},money(row.amount)),h(window.Badge,{tone:row.state==='Pagada'?'green':'amber'},row.state)))))),
     h(window.Btn,{full:true,size:'lg',variant:'outline',icon:'headset',style:{marginTop:22},onClick:()=>window.open('https://wa.me/526626727130','_blank','noopener,noreferrer')},'Contactar a un asesor'))));
 }
 Object.assign(window,{HistoryPill,ApprovalClock,HistorySourceState,LoanHistoryDetail});
})();
