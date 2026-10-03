/* Display canonical attribution without calculating another account balance. */
(function () {
  'use strict';
  const h=React.createElement;
  const money=v=>v==null?'Por conciliar':new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN'}).format(v);
  const label=p=>({OPENING:'Saldo inicial · periodo por identificar',UNALLOCATED_WITHDRAWAL:'Retiro pendiente de desglose',UNALLOCATED_ADJUSTMENT:'Ajuste pendiente de desglose',UNALLOCATED_CREDIT:'Ingreso pendiente de desglose',UNALLOCATED_REVERSAL:'Reversión por conciliar'}[p.origin_key])||(p.semester?`${p.period_year} · semestre ${p.semester}`:p.period_year||'Periodo por conciliar');
  function SavingsPeriodBalances({composition}) {
    if(!composition)return null;
    const periods=composition.periods||[];
    return h('section',{className:'sav-section','data-savings-period-balances':''},h('div',{className:'sav-section-title'},h('b',null,'Retiros y saldo por periodo')),
      h('div',{className:'sav-year-list'},periods.map(p=>h('article',{className:'sav-year',key:p.origin_key+':'+p.component},
        h('div',{className:'sav-year-head'},h('b',null,label(p)),h('span',null,p.component==='YIELD'?'RENDIMIENTO':'AHORRO')),
        h('div',{className:'sav-year-grid'},h('div',null,h('span',null,'Registrado'),h('b',null,money(p.recognized))),h('div',null,h('span',null,'Retirado'),h('b',null,money(p.withdrawn)))),
        p.adjustments!==0&&p.adjustments!=null&&h('div',{className:'sav-row'},h('span',null,'Ajustes'),h('b',null,money(p.adjustments))),
        h('div',{className:'sav-year-subtotal'},h('span',null,'Saldo que permanece'),h('b',{'data-savings-period-remaining':p.origin_key+':'+p.component},money(p.remaining)))))),
      h('div',{className:'sav-card','data-savings-current-available':''},h('div',{className:'sav-row'},h('span',null,'Disponible para retirar'),h('b',null,money(composition.balances?.available))),h('div',{className:'sav-row'},h('span',null,'Retenido'),h('b',null,money(composition.balances?.held)))),
      h('p',{className:'sav-note'},'Cada retiro reduce una sola vez tu saldo. Las retenciones, si existen, afectan el disponible total; los periodos por conciliar conservan su identificación pendiente.'));
  }
  function SavingsWithdrawalOrigins({participantId,capital,yieldAmount,disabled,onChange}) {
    const [state,setState]=React.useState({phase:'loading'}),[values,setValues]=React.useState({}),[revision,setRevision]=React.useState(0);
    const callback=React.useRef(onChange);callback.current=onChange;
    React.useEffect(()=>{
      let active=true;setState({phase:'loading'});setValues({});callback.current({ready:false});
      if(!participantId){setState({phase:'error',error:'No se pudo identificar la cuenta de ahorro.'});return()=>{active=false;};}
      window.SicofRepository.composition(participantId).then(data=>{if(active)setState({phase:'ready',data});},()=>{if(active)setState({phase:'error',error:'No fue posible consultar el desglose del saldo.'});});
      return()=>{active=false;};
    },[participantId,revision]);
    React.useEffect(()=>{
      if(state.phase!=='ready'){callback.current({ready:false});return;}
      const rows=state.data.periods||[],slices=[];let valid=true;
      for(const p of rows){const raw=values[p.origin_key+':'+p.component]||'',amount=Number(raw);if(!Number.isFinite(amount)||amount<0||Math.round(amount*100)!==amount*100&&Math.abs(Math.round(amount*100)-amount*100)>1e-7||amount>Number(p.remaining)||amount>0&&p.remaining==null)valid=false;if(amount>0)slices.push({component:p.component,origin_key:p.origin_key,amount});}
      const total=component=>slices.filter(s=>s.component===component).reduce((n,s)=>n+Math.round(s.amount*100),0);
      valid=valid&&total('CAPITAL')===Math.round(Number(capital||0)*100)&&total('YIELD')===Math.round(Number(yieldAmount||0)*100)&&slices.length>0;
      callback.current({ready:valid,origin_allocations:slices,allocation_version:state.data.version});
    },[state,values,capital,yieldAmount]);
    if(state.phase==='loading')return h('p',{role:'status'},'Consultando origen del ahorro…');
    if(state.phase==='error')return h('div',{role:'alert'},state.error,h('button',{type:'button',disabled,onClick:()=>setRevision(v=>v+1)},'Reintentar'));
    return h('fieldset',{disabled,'data-savings-withdrawal-origins':'',style:{border:'1px solid #e8e8ec',borderRadius:12,padding:12}},h('legend',null,'Origen de la entrega'),
      h('p',{className:'svp-note'},'Indica cuánto se entrega de cada periodo. Los importes deben coincidir con el capital y rendimiento de la entrega.'),
      (state.data.periods||[]).filter(p=>p.remaining==null||p.remaining>0).map(p=>h('label',{key:p.origin_key+':'+p.component,style:{display:'grid',gridTemplateColumns:'1fr 110px',gap:8,margin:'8px 0'}},
        h('span',null,label(p)+' · '+(p.component==='YIELD'?'rendimiento':'capital'),h('small',{style:{display:'block'}},'Saldo: '+money(p.remaining))),
        h('input',{type:'number',min:'0',step:'0.01',max:p.remaining==null?undefined:p.remaining,disabled:disabled||p.remaining==null||String(p.origin_key).startsWith('UNALLOCATED_'),value:values[p.origin_key+':'+p.component]||'',onChange:e=>setValues(v=>({...v,[p.origin_key+':'+p.component]:e.target.value}))}))));
  }
  window.SavingsPeriodBalances=SavingsPeriodBalances;
  window.SavingsWithdrawalOrigins=SavingsWithdrawalOrigins;
})();
