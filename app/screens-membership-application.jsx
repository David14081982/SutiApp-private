/* Owner-approved membership request UI over the existing Supabase workflow. */
(function(){
  'use strict';
  const{useEffect,useMemo,useRef,useState}=React,I=window.Icon,h=React.createElement;
  const ACCEPTED_DOCUMENT_STATUSES=new Set(['PENDING_REVIEW','UNDER_REVIEW','VERIFIED']);
  const FIELDS=[
    {id:'phone',label:'Teléfono',placeholder:'10 dígitos',maxLength:10,type:'tel',inputMode:'numeric',error:'Deben ser 10 dígitos',valid:(value)=>/^[0-9]{10}$/.test(value)},
    {id:'rfc',label:'RFC',placeholder:'AAAA000000AAA',maxLength:13,error:'Formato: 3 o 4 letras, 6 dígitos y 3 caracteres',valid:(value)=>/^[A-ZÑ&]{3,4}[0-9]{6}[A-Z0-9]{3}$/.test(value)},
    {id:'curp',label:'CURP',placeholder:'18 caracteres',maxLength:18,error:'Deben ser 18 caracteres válidos',valid:(value)=>/^[A-Z]{4}[0-9]{6}[HM][A-Z]{5}[A-Z0-9][0-9]$/.test(value)},
  ];
  const CSS=`
    .mr-screen{position:absolute;inset:0;background:var(--bg);color:var(--ink);display:flex;flex-direction:column;overflow:hidden}
    .mr-scroll{flex:1;min-height:0;overflow-y:auto;overflow-x:hidden;scrollbar-width:none}
    .mr-scroll::-webkit-scrollbar{width:0;height:0}
    .mr-hero{position:relative;overflow:hidden;color:#fff;padding:10px 20px 34px;background:linear-gradient(158deg,var(--guinda) 0%,#6a001b 62%,#45000f 100%)}
    .mr-hero>*:not(.mr-seal){position:relative;z-index:1}
    .mr-seal{position:absolute;right:-58px;bottom:-70px;opacity:.1;pointer-events:none;filter:brightness(0) invert(1)}
    .mr-crumb{display:flex;align-items:center;gap:4px}
    .mr-back{width:44px;height:44px;margin-left:-10px;border:0;background:transparent;color:#fff;display:grid;place-items:center;border-radius:13px;cursor:pointer}
    .mr-crumb span{font-size:11.5px;font-weight:800;letter-spacing:.11em;opacity:.82}
    .mr-member{display:flex;align-items:center;gap:15px;margin-top:16px}
    .mr-logo{width:76px;height:76px;border-radius:22px;background:#fff;display:grid;place-items:center;overflow:hidden;flex-shrink:0;box-shadow:0 14px 30px -10px rgba(0,0,0,.5);color:var(--guinda)}
    .mr-logo img{width:82%;height:82%;object-fit:contain}
    .mr-member-copy{min-width:0}
    .mr-member h1{font-size:24px;font-weight:900;letter-spacing:-.028em;line-height:1.12;margin:0;overflow-wrap:anywhere}
    .mr-member p{font-size:13.5px;font-weight:600;opacity:.88;margin:3px 0 0;line-height:1.35}
    .mr-figures{display:flex;align-items:stretch;gap:0;margin-top:20px;padding:13px 0;border-radius:16px;background:rgba(255,255,255,.13)}
    .mr-figure{flex:1;min-width:0;padding:0 13px}
    .mr-figure+.mr-figure{border-left:1px solid rgba(255,255,255,.24)}
    .mr-figure-label{font-size:10.5px;font-weight:800;letter-spacing:.07em;opacity:.82;text-transform:uppercase}
    .mr-figure-value{font-size:16.5px;font-weight:900;margin-top:3px;font-variant-numeric:tabular-nums;white-space:nowrap}
    .mr-payroll-note{font-size:11.5px;font-weight:600;opacity:.82;margin:10px 0 0;line-height:1.5}
    .mr-body{position:relative;z-index:2;padding:0 20px 24px;margin-top:-34px}
    .mr-tracker{background:var(--surface);border-radius:20px;padding:15px 16px 16px;box-shadow:var(--shadow-lg)}
    .mr-tracker-head{display:flex;align-items:baseline;justify-content:space-between;gap:12px}
    .mr-tracker-head strong{font-size:14.5px;font-weight:900;letter-spacing:-.01em}
    .mr-count{font-size:13.5px;font-weight:900;color:var(--guinda);font-variant-numeric:tabular-nums;white-space:nowrap}
    .mr-tracker.is-done .mr-count{color:#13794A}
    .mr-segments{display:flex;gap:4px;margin-top:11px}
    .mr-segments span{flex:1;height:7px;border-radius:999px;background:var(--surface-2);box-shadow:var(--neo-inset)}
    .mr-segments span.is-on{background:var(--guinda);box-shadow:none}
    .mr-tracker.is-done .mr-segments span.is-on{background:#13794A}
    .mr-missing{margin-top:13px}
    .mr-missing-label{font-size:11.5px;font-weight:800;color:var(--ink-2);letter-spacing:.05em;text-transform:uppercase;margin-bottom:8px}
    .mr-chips{display:flex;flex-wrap:wrap;gap:7px}
    .mr-chip{display:inline-flex;align-items:center;gap:6px;min-height:44px;padding:0 14px;border-radius:999px;border:1.5px solid var(--guinda);background:var(--guinda-50);color:var(--guinda);font-size:13px;font-weight:800;cursor:pointer;font-family:inherit}
    .mr-chip-dot{width:5px;height:5px;border-radius:50%;background:var(--guinda)}
    .mr-ready{display:flex;align-items:center;gap:7px;font-size:12.5px;font-weight:700;color:#13794A;margin-top:12px}
    .mr-section{margin-top:24px}
    .mr-section-head{display:flex;align-items:center;gap:8px;margin:0 0 12px;color:var(--guinda)}
    .mr-section-head h2{font-size:17px;font-weight:800;letter-spacing:-.01em;color:var(--ink);margin:0}
    .mr-state{background:var(--surface);border-radius:16px;padding:18px;text-align:center;box-shadow:var(--neo-sm);font-size:12.5px;font-weight:700;color:var(--ink-2);line-height:1.5}
    .mr-state.is-error{color:#A32921}
    .mr-retry{display:inline-flex;margin-top:10px;min-height:40px;align-items:center;padding:0 15px;border:0;border-radius:12px;background:var(--guinda-50);color:var(--guinda);font-weight:800;font-family:inherit;cursor:pointer}
    .mr-doc-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:12px}
    .mr-doc-tile{position:relative;min-width:0}
    .mr-doc-pick{width:100%;aspect-ratio:1/1;max-height:200px;display:flex;flex-direction:column;justify-content:flex-end;position:relative;overflow:hidden;cursor:pointer;text-align:left;border-radius:18px;padding:12px;background:var(--surface);border:1.5px dashed var(--hairline-strong);box-shadow:var(--neo-sm);font-family:inherit;color:inherit}
    .mr-doc-pick:disabled{cursor:default;opacity:1}
    .mr-doc-tile.is-filled .mr-doc-pick{background:linear-gradient(145deg,#f8f5f6,#ece7e9);border:none;box-shadow:var(--neo-md)}
    .mr-doc-tile.is-highlighted .mr-doc-pick{background:var(--guinda-50);border-color:var(--guinda);box-shadow:inset 0 0 0 2px var(--guinda)}
    .mr-doc-tile.is-error .mr-doc-pick{background:#FCE9EE;border-color:#B3261E}
    .mr-doc-thumb{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
    .mr-doc-veil{position:absolute;inset:0;background:linear-gradient(to top,rgba(10,6,8,.68) 0%,rgba(10,6,8,.16) 45%,rgba(10,6,8,.02) 100%)}
    .mr-doc-badge{position:absolute;top:12px;left:12px;width:40px;height:40px;border-radius:12px;background:var(--guinda-50);color:var(--guinda);display:grid;place-items:center}
    .mr-doc-tile.has-thumbnail .mr-doc-badge{background:rgba(255,255,255,.14);color:#fff}
    .mr-doc-thumb+.mr-doc-veil+.mr-doc-badge{display:none}
    .mr-doc-meta{position:relative;min-width:0;z-index:1}
    .mr-doc-meta strong{display:block;font-size:13.5px;font-weight:800;line-height:1.2;color:var(--ink);overflow-wrap:anywhere}
    .mr-doc-tile.has-thumbnail .mr-doc-meta{margin-top:auto;padding-bottom:25px;text-shadow:0 1px 3px rgba(0,0,0,.58)}
    .mr-doc-tile.has-thumbnail .mr-doc-meta strong{color:#fff}
    .mr-doc-add,.mr-doc-file{display:flex;align-items:center;gap:5px;font-size:11.5px;font-weight:700;color:var(--guinda);margin-top:3px;line-height:1.25}
    .mr-doc-file{color:var(--ink-3)}
    .mr-doc-tile.has-thumbnail .mr-doc-file{color:rgba(255,255,255,.86)}
    .mr-doc-ok{position:absolute;top:10px;left:10px;width:26px;height:26px;border-radius:50%;background:#13794A;color:#fff;display:grid;place-items:center;box-shadow:0 3px 10px -2px rgba(0,0,0,.5);z-index:2}
    .mr-doc-view{position:absolute;top:4px;right:4px;width:44px;height:44px;border:0;background:transparent;color:#fff;display:grid;place-items:center;cursor:pointer;z-index:3}
    .mr-doc-view:before{content:'';position:absolute;width:28px;height:28px;border-radius:50%;background:rgba(10,6,8,.6)}
    .mr-doc-view svg{position:relative}
    .mr-doc-status{position:absolute;left:9px;bottom:8px;z-index:3;border-radius:99px;background:rgba(255,255,255,.92);color:#087A50;padding:4px 7px;font-size:8.5px;font-weight:850;line-height:1}
    .mr-doc-replace{position:absolute;right:8px;bottom:6px;z-index:4;min-height:27px;border:1px solid rgba(255,255,255,.72);border-radius:9px;background:rgba(255,255,255,.94);color:var(--guinda);display:flex;align-items:center;gap:4px;padding:0 7px;font-family:inherit;font-size:8.5px;font-weight:850;cursor:pointer}
    .mr-doc-observation{font-size:11px;font-weight:700;line-height:1.35;color:#9B2743;margin:6px 4px 0}
    .mr-data{background:var(--surface);border-radius:18px;box-shadow:var(--neo-sm);overflow:hidden}
    .mr-row{padding:13px 15px;border-top:1px solid var(--hairline);transition:background .18s}
    .mr-row:first-child{border-top:0}
    .mr-row.is-highlighted{background:var(--guinda-50)}
    .mr-row-head{display:flex;align-items:center;gap:7px;margin-bottom:6px}
    .mr-row-head label{font-size:12px;font-weight:800;color:var(--ink-2);letter-spacing:.06em;text-transform:uppercase}
    .mr-field-mark{width:16px;height:16px;color:#13794A;display:grid;place-items:center}
    .mr-field-dot{width:6px;height:6px;border-radius:50%;background:var(--guinda)}
    .mr-input{width:100%;border:0;border-bottom:2px solid transparent;outline:0;background:transparent;padding:2px 0 4px;font-size:17px;font-family:var(--mono);font-weight:700;color:var(--ink);letter-spacing:.06em}
    .mr-row.is-bad .mr-input{border-bottom-color:#B3261E}
    .mr-field-error{font-size:11.5px;font-weight:700;color:#B3261E;margin-top:5px}
    .mr-privacy{display:flex;gap:9px;align-items:flex-start;margin-top:20px;color:var(--ink-2)}
    .mr-privacy svg{flex-shrink:0;margin-top:1px}
    .mr-privacy p{font-size:12px;font-weight:600;line-height:1.55;margin:0}
    .mr-alert{margin-top:18px;padding:13px;border-radius:13px;background:#FFF4D9;color:#805100;font-size:12px;font-weight:700;line-height:1.5}
    .mr-alert.is-error{background:#FCE9EE;color:#A32921}
    .mr-footer{flex-shrink:0;padding:12px 20px calc(12px + env(safe-area-inset-bottom));background:var(--surface);border-top:1px solid var(--hairline)}
    .mr-cta{display:flex;align-items:center;justify-content:center;gap:9px;width:100%;height:56px;border:0;border-radius:18px;cursor:pointer;background:linear-gradient(150deg,#e8364f 0%,#c41230 42%,#910022 100%);color:#fff;font-size:16.5px;font-weight:900;letter-spacing:-.01em;box-shadow:0 10px 26px -6px rgba(209,31,58,.55),0 4px 10px -2px rgba(145,0,34,.4);font-family:inherit;transition:transform .18s cubic-bezier(.2,.7,.3,1)}
    .mr-cta:active{transform:scale(.975)}
    .mr-cta:disabled{background:var(--surface-2);color:var(--ink-3);box-shadow:var(--neo-inset);cursor:not-allowed;transform:none}
    .mr-footer-hint{font-size:12px;font-weight:700;color:var(--ink-2);text-align:center;margin-top:8px}
    .mr-screen button:focus-visible,.mr-screen input:focus-visible{outline:2px solid var(--guinda);outline-offset:2px}
    .mr-success{background:var(--bg)}
    .mr-success-head{display:flex;align-items:center;gap:6px;padding:8px 12px;background:#fff;border-bottom:1px solid var(--hairline);font-size:16px;font-weight:800}
    .mr-success-back{width:40px;height:40px;border:0;background:transparent;border-radius:12px;display:grid;place-items:center;color:var(--ink)}
    .mr-success-body{flex:1;display:grid;place-items:center;padding:32px;text-align:center}
    .mr-success-icon{width:86px;height:86px;border-radius:50%;background:#E5F7EF;color:#087A50;display:grid;place-items:center;margin:0 auto}
    .mr-success-body h2{font-size:24px;margin:22px 0 8px}
    .mr-success-body p{color:var(--ink-2);line-height:1.5;margin:0}
    .mr-folio{display:inline-block;padding:9px 14px;background:var(--guinda-50);color:var(--guinda);border-radius:12px;font:800 13px var(--mono);margin-top:18px}
    .mr-success-action{margin-top:28px}
    @media(max-width:340px){
      .mr-doc-grid{grid-template-columns:1fr}
      .mr-figure{padding:0 8px}
      .mr-figure-value{font-size:14.5px}
      .mr-member h1{font-size:22px}
    }
    @media(prefers-reduced-motion:reduce){
      .mr-cta,.mr-row{transition:none}
      .mr-scroll{scroll-behavior:auto}
    }
  `;
  const money=(value)=>window.money?window.money(Number(value)||0):'$'+Number(value||0).toLocaleString('es-MX');
  const raw=(value)=>{
    const text=value===null||value===undefined?'':String(value).trim();
    return text==='—'?'':text;
  };
  const newestAccepted=(documents,typeId)=>documents.find((doc)=>doc.document_type_id===typeId&&ACCEPTED_DOCUMENT_STATUSES.has(doc.status))||null;
  const documentType=(requirement)=>requirement.document_type||requirement;

  function MembershipApplicationScreen({app,params}){
    const offering=window.membershipStore.get(params&&params.id);
    const[phase,setPhase]=useState('loading'),[requirements,setRequirements]=useState([]),[documents,setDocuments]=useState([]),[terms,setTerms]=useState(null);
    const[busy,setBusy]=useState(false),[error,setError]=useState(''),[sent,setSent]=useState(null),[touched,setTouched]=useState({}),[highlighted,setHighlighted]=useState('');
    const[data,setData]=useState(()=>{
      const user=app.user||{},affiliate=app.affiliate||{};
      return{
        phone:raw(affiliate.phone_raw||user.phone).replace(/\D/g,'').slice(0,10),
        rfc:raw(affiliate.rfc_raw||user.rfc).toUpperCase().slice(0,13),
        curp:raw(affiliate.curp_raw||user.curp).toUpperCase().slice(0,18),
      };
    });
    const idem=useRef(window.ProgramRequestRepository.newIdempotencyKey()),scrollRef=useRef(null),docsRef=useRef(null),inputRefs=useRef({}),highlightTimer=useRef(null);
    const load=React.useCallback(async()=>{
      if(!offering){
        setPhase('error');
        setError('La membresía ya no está disponible.');
        return;
      }
      setPhase('loading');
      setError('');
      try{
        const rows=await window.DocumentWorkflowRepository.requirements('membership',offering.id);
        const[dResult,tResult]=await Promise.allSettled([
          window.DocumentWorkflowRepository.listSelfDocuments('SELF_SERVICE_MEMBERSHIP'),
          window.ProgramTermsRepository.current('membership',offering.id),
        ]);
        setRequirements(rows.slice());
        setDocuments(dResult.status==='fulfilled'?dResult.value.slice():[]);
        setTerms(tResult.status==='fulfilled'?tResult.value:null);
        const warnings=[];
        if(dResult.status==='rejected')warnings.push('Los requisitos están disponibles; vuelve a intentar si tus documentos existentes no aparecen.');
        if(tResult.status==='rejected')warnings.push('No fue posible verificar los términos publicados.');
        setError(warnings.join(' '));
        setPhase('ready');
      }catch(_){
        setRequirements([]);
        setDocuments([]);
        setTerms(null);
        setPhase('error');
        setError('No fue posible consultar los requisitos autorizados.');
      }
    },[offering&&offering.id]);
    useEffect(()=>{load();},[load]);
    useEffect(()=>()=>{if(highlightTimer.current)clearTimeout(highlightTimer.current);},[]);

    const requiredRequirements=useMemo(()=>requirements.filter((requirement)=>requirement.required===true),[requirements]);
    const selectedDocuments=useMemo(()=>requirements.map((requirement)=>newestAccepted(documents,requirement.document_type_id)).filter(Boolean),[requirements,documents]);
    const requiredDocumentState=useMemo(()=>requiredRequirements.map((requirement)=>({requirement,document:newestAccepted(documents,requirement.document_type_id)})),[requiredRequirements,documents]);
    const fieldValidity=useMemo(()=>Object.fromEntries(FIELDS.map((field)=>[field.id,field.valid(data[field.id])])),[data]);
    const missingItems=useMemo(()=>{
      const documentItems=requiredDocumentState.filter((entry)=>!entry.document).map((entry)=>({kind:'document',id:entry.requirement.document_type_id,label:documentType(entry.requirement).label}));
      const fieldItems=FIELDS.filter((field)=>!fieldValidity[field.id]).map((field)=>({kind:'field',id:field.id,label:field.label}));
      return documentItems.concat(fieldItems);
    },[requiredDocumentState,fieldValidity]);
    const total=requiredRequirements.length+FIELDS.length,completed=total-missingItems.length,missing=missingItems.length;
    const ready=phase==='ready'&&missing===0&&!!terms;
    const pay=offering?Number(offering.monto)/Math.max(1,Number(offering.pagos)):0;

    const submit=async()=>{
      if(!ready||busy)return;
      setBusy(true);
      setError('');
      try{
        const request=await window.ProgramRequestRepository.createMembership({
          membershipOfferingId:offering.id,
          documentIds:selectedDocuments.map((document)=>document.id),
          phone:data.phone,
          rfc:data.rfc,
          curp:data.curp,
          termsVersionId:terms.id,
          idempotencyKey:idem.current,
        });
        setSent(request);
      }catch(_){
        setError('No pudimos registrar la solicitud. Revisa los requisitos e inténtalo de nuevo.');
      }finally{
        setBusy(false);
      }
    };
    const markHighlighted=(value)=>{
      setHighlighted(value);
      if(highlightTimer.current)clearTimeout(highlightTimer.current);
      highlightTimer.current=setTimeout(()=>setHighlighted(''),2600);
    };
    const scrollTo=(node)=>{
      const scroller=scrollRef.current;
      if(!node||!scroller)return;
      const top=scroller.scrollTop+node.getBoundingClientRect().top-scroller.getBoundingClientRect().top-24;
      const reduced=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      scroller.scrollTo({top:Math.max(0,top),behavior:reduced?'auto':'smooth'});
    };
    const goToMissing=(item)=>{
      if(item.kind==='field'){
        const input=inputRefs.current[item.id];
        setTouched((value)=>Object.assign({},value,{[item.id]:true}));
        markHighlighted('field:'+item.id);
        if(input){
          scrollTo(input.closest('[data-membership-field]'));
          input.focus({preventScroll:true});
        }
        return;
      }
      markHighlighted(item.id);
      const tile=docsRef.current&&Array.from(docsRef.current.querySelectorAll('[data-document-type-id]')).find((node)=>node.dataset.documentTypeId===item.id);
      if(tile){
        scrollTo(tile);
        const action=tile.querySelector('[data-document-action="upload"]');
        if(action)action.focus({preventScroll:true});
      }
    };
    const changeField=(field,value)=>{
      const normalized=field.id==='phone'?value.replace(/\D/g,'').slice(0,field.maxLength):value.toUpperCase().slice(0,field.maxLength);
      setData((current)=>Object.assign({},current,{[field.id]:normalized}));
    };

    if(sent)return h(window.RequestSubmissionSuccess,{app,folio:sent.folio,kind:'membership',subject:offering&&offering.concepto,workflowState:sent.workflow_state,onBack:app.back,fullScreen:true,destination:'Tu solicitud fue enviada al área responsable del sindicato para su revisión.',membershipSuccessId:sent.id});

    const trackerDone=phase==='ready'&&missing===0;
    const ctaCopy=busy?'Enviando…':phase==='loading'?'Consultando requisitos…':missing?'Solicitar · faltan '+missing:'Solicitar';
    return h('div',{'data-membership-application':offering&&offering.id,'data-membership-phase':phase,className:'mr-screen'},
      h('style',null,CSS),
      h('div',{ref:scrollRef,className:'mr-scroll su-app-scroll'},
        h('header',{className:'mr-hero'},
          h('div',{className:'mr-seal','aria-hidden':'true'},window.SutiSeal&&h(window.SutiSeal,{size:240,mono:true})),
          h('div',{className:'mr-crumb'},
            h('button',{type:'button',className:'mr-back',onClick:app.back,'aria-label':'Atrás'},h(I,{name:'arrowL',size:22,stroke:2.2})),
            h('span',null,'SOLICITUD DE MEMBRESÍA')),
          offering&&h(React.Fragment,null,
            h('div',{className:'mr-member'},
              h('div',{className:'mr-logo','data-membership-logo-source':offering.logo?'admin':'placeholder'},offering.logo?h('img',{src:offering.logo,alt:offering.empresa}):h(I,{name:'card',size:30,stroke:2})),
              h('div',{className:'mr-member-copy'},h('h1',{'data-membership-company':offering.empresa},offering.empresa),h('p',{'data-membership-concept':offering.concepto},offering.concepto))),
            h('div',{className:'mr-figures'},
              h('div',{className:'mr-figure'},h('div',{className:'mr-figure-label'},'Costo total'),h('div',{className:'mr-figure-value','data-membership-total':Number(offering.monto)},money(offering.monto))),
              h('div',{className:'mr-figure'},h('div',{className:'mr-figure-label'},'Parcialidades'),h('div',{className:'mr-figure-value','data-membership-installments':Number(offering.pagos)},Number(offering.pagos)===1?'1 pago':offering.pagos+' pagos')),
              h('div',{className:'mr-figure'},h('div',{className:'mr-figure-label'},'Cada quincena'),h('div',{className:'mr-figure-value','data-membership-fortnight':pay},money(pay)))),
            h('p',{className:'mr-payroll-note'},'Se descuenta vía nómina a partir del mes siguiente a la aprobación.'))),
        h('main',{className:'mr-body'},
          h('section',{className:'mr-tracker'+(trackerDone?' is-done':''),'data-requirement-count':phase==='ready'?total:'loading','data-requirement-missing':phase==='ready'?missing:'loading','aria-busy':phase==='loading'?'true':'false'},
            h('div',{className:'mr-tracker-head'},h('strong',null,phase==='loading'?'Consultando requisitos':trackerDone?'Expediente completo':'Requisitos obligatorios'),h('span',{className:'mr-count','aria-live':'polite'},phase==='ready'?completed+' de '+total:'—')),
            h('div',{className:'mr-segments','aria-hidden':'true'},phase==='ready'&&Array.from({length:total},(_,index)=>h('span',{key:index,className:index<completed?'is-on':''}))),
            phase==='ready'&&missing>0&&h('div',{className:'mr-missing'},h('div',{className:'mr-missing-label'},'Te falta'),h('div',{className:'mr-chips'},missingItems.map((item)=>h('button',{type:'button',key:item.kind+':'+item.id,className:'mr-chip','data-missing-kind':item.kind,'data-missing-id':item.id,onClick:()=>goToMissing(item)},h('i',{className:'mr-chip-dot','aria-hidden':'true'}),item.label)))),
            ready&&h('div',{className:'mr-ready'},h(I,{name:'checkCircle',size:15,stroke:2.2}),'Ya puedes enviar tu solicitud.')),
          h('section',{className:'mr-section',ref:docsRef},
            h('div',{className:'mr-section-head'},h(I,{name:'folder',size:18,stroke:2}),h('h2',null,'Documentos')),
            phase==='loading'&&h('div',{className:'mr-state',role:'status'},'Cargando documentos y requisitos…'),
            phase==='error'&&h('div',{className:'mr-state is-error',role:'alert'},error,h('br'),h('button',{type:'button',className:'mr-retry',onClick:load},'Reintentar')),
            phase==='ready'&&h(window.UnifiedDocumentPhase,{requirements,documents,onChanged:load,phase:'ready',highlightedId:highlighted,accessPurpose:'SELF_SERVICE_MEMBERSHIP',title:'Verifica tus documentos'})),
          h('section',{className:'mr-section'},
            h('div',{className:'mr-section-head'},h(I,{name:'idcard',size:18,stroke:2}),h('h2',null,'Tus datos')),
            h('div',{className:'mr-data'},FIELDS.map((field)=>{
              const value=data[field.id],valid=fieldValidity[field.id],bad=!!(touched[field.id]&&value&&!valid),errorId='membership-'+field.id+'-error';
              return h('div',{key:field.id,className:'mr-row'+(bad?' is-bad':'')+(highlighted==='field:'+field.id?' is-highlighted':''),'data-membership-field':field.id},
                h('div',{className:'mr-row-head'},h('label',{htmlFor:'membership-'+field.id},field.label),h('span',{className:'mr-field-mark','aria-hidden':'true'},valid?h(I,{name:'checkCircle',size:14,stroke:2.2}):h('i',{className:'mr-field-dot'}))),
                h('input',{ref:(node)=>{inputRefs.current[field.id]=node;},id:'membership-'+field.id,className:'mr-input',value,placeholder:field.placeholder,maxLength:field.maxLength,type:field.type||'text',inputMode:field.inputMode,autoComplete:field.id==='phone'?'tel':'off','aria-invalid':bad?'true':'false','aria-describedby':bad?errorId:undefined,onChange:(event)=>changeField(field,event.target.value),onBlur:()=>setTouched((current)=>Object.assign({},current,{[field.id]:true}))}),
                bad&&h('div',{id:errorId,className:'mr-field-error'},field.error));
            }))),
          h('div',{className:'mr-privacy'},h(I,{name:'lock',size:16,stroke:2}),h('p',null,'Tus documentos viajan cifrados y sólo los ve el comité de validación.')),
          phase==='ready'&&!terms&&h('div',{className:'mr-alert',role:'alert'},'Esta membresía aún no tiene términos publicados. Admin debe publicar una versión antes de recibir solicitudes.'),
          phase==='ready'&&error&&h('div',{className:'mr-alert is-error',role:'alert'},error))),
      h('footer',{className:'mr-footer'},
        h('button',{type:'button',className:'mr-cta',disabled:!ready||busy,onClick:submit,'data-membership-submit':'true','data-membership-ready':ready?'true':'false'},h(I,{name:busy?'clock':'check',size:21,stroke:2.2}),h('span',null,ctaCopy)),
        phase==='ready'&&missing>0&&h('div',{className:'mr-footer-hint'},'Toca un pendiente de arriba para completarlo'),
        phase==='ready'&&missing===0&&!terms&&h('div',{className:'mr-footer-hint'},'Términos pendientes de publicación')));
  }
  window.MembershipApplicationScreen=MembershipApplicationScreen;
})();
