/* request-submission-success.jsx — shared post-submit confirmation for requestable programs. */
(function () {
  const I=window.Icon;
  const dash='—';
  const colors=['#B9003B','#E2AA3B','#0E8A61','#314A7C','#F0A9BA'];
  const CSS=`
    .request-success{position:relative;overflow:hidden;flex:1;min-height:0;display:flex;flex-direction:column;background:var(--bg)}
    .request-success.is-fullscreen{position:fixed;inset:0;z-index:2600}
    .request-success-head{position:relative;z-index:4;display:flex;align-items:center;gap:6px;min-height:56px;padding:0 12px;background:var(--surface);border-bottom:1px solid var(--hairline);font-size:16.5px;font-weight:800}
    .request-success-back{width:40px;height:40px;border:0;border-radius:12px;background:transparent;color:var(--ink);display:grid;place-items:center;cursor:pointer}
    .request-success-scroll{position:relative;z-index:1;flex:1;min-height:0;overflow-y:auto;padding:28px 22px 18px;scrollbar-width:none}
    .request-success-scroll::-webkit-scrollbar{display:none}
    .request-success-hero{text-align:center;display:flex;flex-direction:column;align-items:center}
    .request-success-icon{width:92px;height:92px;border-radius:50%;background:#E3F7EE;color:#087A50;display:grid;place-items:center}
    .request-success h2{font-size:24px;font-weight:900;letter-spacing:-.025em;margin:22px 0 0;color:var(--ink)}
    .request-success-lead{max-width:350px;font-size:14px;font-weight:650;line-height:1.55;color:var(--ink-2);margin:9px 0 0}
    .request-success-lead strong{color:var(--guinda);font-weight:900}
    .request-success-folio{margin-top:20px;padding:10px 16px;border-radius:14px;background:var(--guinda-50);color:var(--guinda);font:850 13px var(--mono)}
    .request-success-destination{max-width:340px;font-size:12px;font-weight:600;line-height:1.5;color:var(--ink-3);margin:12px 0 0}
    .request-success-next{max-width:580px;margin:26px auto 0}
    .request-success-next-title{display:flex;align-items:center;gap:9px;margin:0 0 12px;font-size:17px;font-weight:900;color:var(--ink)}
    .request-success-next-title svg{color:var(--guinda)}
    .request-success-timeline{list-style:none;margin:0;padding:16px 18px;background:var(--surface);border-radius:22px;box-shadow:var(--neo-sm)}
    .request-success-stage{position:relative;display:grid;grid-template-columns:38px minmax(0,1fr);gap:10px;min-height:67px;text-align:left}
    .request-success-stage:last-child{min-height:40px}
    .request-success-stage:not(:last-child)::before{content:'';position:absolute;left:18px;top:34px;bottom:-2px;width:3px;border-radius:3px;background:#E7EAF1}
    .request-success-stage[data-state='done']:not(:last-child)::before{background:linear-gradient(var(--guinda) 0 55%,#E7EAF1 55%)}
    .request-success-dot{position:relative;z-index:1;width:34px;height:34px;border-radius:50%;display:grid;place-items:center;margin-top:1px;background:#EEF1F6;color:#9CA7BB;border:4px solid var(--surface)}
    .request-success-stage[data-state='done'] .request-success-dot{background:var(--guinda);color:#fff;border:0;box-shadow:0 7px 15px -6px rgba(145,0,34,.6)}
    .request-success-stage[data-state='current'] .request-success-dot{background:var(--surface);color:var(--guinda);border:2px solid var(--guinda);box-shadow:0 0 0 4px #F8E8ED}
    .request-success-current-dot{width:8px;height:8px;border-radius:50%;background:currentColor}
    .request-success-upcoming-dot{width:7px;height:7px;border-radius:50%;background:currentColor}
    .request-success-stage-body{min-width:0;padding-top:4px}
    .request-success-stage-title-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
    .request-success-stage-title{font-size:14px;font-weight:850;color:var(--ink)}
    .request-success-stage[data-state='upcoming'] .request-success-stage-title{color:#9CA7BB}
    .request-success-stage-meta{display:block;margin-top:4px;font-size:11px;font-weight:650;color:var(--ink-3)}
    .request-success-badge{display:inline-flex;align-items:center;min-height:20px;padding:3px 9px;border-radius:999px;background:#FCE8EE;color:var(--guinda);font-size:9px;font-weight:900;letter-spacing:.03em}
    .request-success-detail{margin-top:9px;padding:11px 12px;border-radius:13px;background:var(--surface-2);color:var(--ink-2);font-size:11.5px;font-weight:600;line-height:1.45}
    .request-success-stage-context{display:block;margin-top:4px;font-size:10.5px;font-weight:650;color:var(--ink-3);line-height:1.4}
    .request-success-unavailable{padding:18px 14px;text-align:center;color:var(--ink-3);font-size:12.5px;font-weight:700;line-height:1.5}
    .request-success-footer{position:relative;z-index:2;padding:8px 22px calc(12px + env(safe-area-inset-bottom));background:linear-gradient(180deg,transparent,var(--bg) 18%)}
    .request-success-home{display:block;width:100%;height:38px;margin-top:7px;border:0;background:transparent;color:var(--guinda);font:800 13px var(--font);cursor:pointer}
    .request-success button:focus-visible{outline:2px solid var(--guinda);outline-offset:2px}
    @keyframes suti-request-confetti{0%{transform:translate3d(0,-24px,0) rotate(0);opacity:0}9%{opacity:1}100%{transform:translate3d(var(--confetti-drift),105vh,0) rotate(620deg);opacity:0}}
    @media(max-height:760px){.request-success-scroll{padding-top:18px}.request-success-icon{width:76px;height:76px}.request-success h2{margin-top:15px}.request-success-next{margin-top:20px}}
  `;

  function formatStageDate(value){if(!value)return null;const date=new Date(value);if(!Number.isFinite(date.getTime()))return null;return Date.now()-date.getTime()<300000?'Justo ahora':date.toLocaleString('es-MX');}

  function RequestSubmissionSuccess({app,folio,amount,kind='benefit',subject,destination,workflowState,onBack,fullScreen=false,membershipSuccessId}){
    const celebrate=!(window.MOTION&&(window.MOTION.reduced()||window.MOTION.frozen()));
    const stages=workflowState&&workflowState.available&&Array.isArray(workflowState.stages)?workflowState.stages:[];
    const amountLabel=typeof amount==='number'&&Number.isFinite(amount)?window.money(amount):null;
    const history=()=>{if(window.operationsStore&&window.operationsStore.invalidate)window.operationsStore.invalidate();if(app&&app.setTab)app.setTab('historial');};
    const home=()=>app&&app.setTab&&app.setTab('home');
    let lead;
    if(kind==='loan')lead=React.createElement(React.Fragment,null,'Tu préstamo',amountLabel?React.createElement(React.Fragment,null,' por ',React.createElement('strong',null,amountLabel)):null,' ya está en revisión. Te avisaremos al avanzar.');
    else if(kind==='quote')lead=React.createElement(React.Fragment,null,'Tu solicitud de cotización',subject?React.createElement(React.Fragment,null,' para ',React.createElement('strong',null,subject)):null,' ya está en revisión. Te avisaremos cuando el presupuesto esté listo.');
    else if(kind==='membership')lead=React.createElement(React.Fragment,null,'Tu solicitud',subject?React.createElement(React.Fragment,null,' para ',React.createElement('strong',null,subject)):null,' ya está en revisión. Te avisaremos al avanzar.');
    else lead=React.createElement(React.Fragment,null,'Tu solicitud',subject?React.createElement(React.Fragment,null,' de ',React.createElement('strong',null,subject)):null,' ya está en revisión. Te avisaremos al avanzar.');
    return React.createElement('div',{className:'request-success'+(fullScreen?' is-fullscreen':''),'data-request-submission-success':kind,'data-loan-submission-success':kind==='loan'?(folio||dash):undefined,'data-membership-application-success':membershipSuccessId},
      React.createElement('style',null,CSS),
      fullScreen&&React.createElement('header',{className:'request-success-head'},React.createElement('button',{type:'button',className:'request-success-back',onClick:onBack,'aria-label':'Volver'},React.createElement(I,{name:'arrowL',size:22,stroke:2})),'Listo'),
      celebrate&&React.createElement('div',{'aria-hidden':'true','data-request-success-confetti':'three-pass','data-loan-success-confetti':kind==='loan'?'three-pass':undefined,style:{position:'absolute',zIndex:3,inset:0,pointerEvents:'none',overflow:'hidden'}},Array.from({length:42},(_,i)=>React.createElement('i',{key:i,style:{position:'absolute',top:-18,left:((i*37)%100)+'%',width:i%3===0?8:6,height:i%4===0?14:9,borderRadius:i%5===0?'50%':'2px',background:colors[i%colors.length],animation:'suti-request-confetti .9s cubic-bezier(.2,.65,.3,1) '+((i%14)*24+Math.floor(i/14)*720)+'ms both','--confetti-drift':(((i*29)%120)-60)+'px'}}))),
      React.createElement('main',{className:'request-success-scroll'},
        React.createElement('section',{className:'request-success-hero','aria-labelledby':'request-success-title'},
          React.createElement('div',{className:'request-success-icon',style:{animation:celebrate?'su-pop .5s cubic-bezier(.22,1,.36,1)':'none'}},React.createElement(I,{name:'checkCircle',size:50,stroke:2})),
          React.createElement('h2',{id:'request-success-title'},'¡Solicitud enviada!'),
          React.createElement('p',{className:'request-success-lead'},lead),
          React.createElement('div',{className:'request-success-folio'},'Folio '+(folio||dash)),
          React.createElement('p',{className:'request-success-destination'},destination||'Tu solicitud fue enviada al área responsable para su revisión.')),
        React.createElement('section',{className:'request-success-next','aria-labelledby':'request-success-next-title'},
          React.createElement('h3',{id:'request-success-next-title',className:'request-success-next-title'},React.createElement(I,{name:'clock',size:18,stroke:2.2}),'¿Qué sigue?'),
          React.createElement('ol',{className:'request-success-timeline'},stages.length?stages.map((stage)=>React.createElement('li',{key:stage.id,className:'request-success-stage','data-state':stage.state},
            React.createElement('span',{className:'request-success-dot','aria-hidden':'true'},stage.state==='done'?React.createElement(I,{name:'check',size:18,stroke:3}):stage.state==='current'?React.createElement('span',{className:'request-success-current-dot'}):React.createElement('span',{className:'request-success-upcoming-dot'})),
            React.createElement('div',{className:'request-success-stage-body'},
              React.createElement('div',{className:'request-success-stage-title-row'},React.createElement('span',{className:'request-success-stage-title'},stage.label),stage.state==='current'&&React.createElement('span',{className:'request-success-badge'},'EN CURSO')),
              formatStageDate(stage.date)&&React.createElement('span',{className:'request-success-stage-meta'},formatStageDate(stage.date)),
              (stage.responsible||stage.sla_days!=null)&&React.createElement('span',{className:'request-success-stage-context'},[stage.responsible&&('Responsable: '+stage.responsible),stage.sla_days!=null&&('Tiempo estimado: '+stage.sla_days+' día(s) hábil(es)')].filter(Boolean).join(' · ')),
              stage.state==='current'&&stage.description&&React.createElement('div',{className:'request-success-detail'},stage.description)))):React.createElement('li',{className:'request-success-unavailable'},workflowState&&workflowState.message||'Seguimiento no disponible')))),
      React.createElement('footer',{className:'request-success-footer'},
        React.createElement(window.Btn,{full:true,size:'lg',icon:'receipt',onClick:history},'Seguir mi solicitud'),
        React.createElement('button',{type:'button',className:'request-success-home',onClick:home},'Volver al inicio')));
  }

  window.RequestSubmissionSuccess=RequestSubmissionSuccess;
})();
