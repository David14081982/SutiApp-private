/* Private document expediente backed only by canonical Supabase workflow. */
(function(){
  'use strict';
  const{useEffect,useMemo,useRef,useState}=React,I=window.Icon,h=React.createElement;
  const COLORS={
    VERIFIED:{fg:'#087A50',bg:'#E5F7EF',label:'Verificado',icon:'checkCircle'},
    PENDING_REVIEW:{fg:'#A56600',bg:'#FFF4D9',label:'Pendiente de revisión',icon:'clock'},
    UNDER_REVIEW:{fg:'#A56600',bg:'#FFF4D9',label:'En revisión',icon:'clock'},
    REJECTED:{fg:'#B0002A',bg:'#FCE9EE',label:'Rechazado',icon:'info'},
    REUPLOAD_REQUIRED:{fg:'#B0002A',bg:'#FCE9EE',label:'Volver a subir',icon:'upload'},
  };
  const documentState=(doc)=>doc&&doc.status==='VERIFIED'&&doc.verificationProvenance==='HISTORICAL_IMPORT'
    ?{fg:'#087A50',bg:'#E5F7EF',label:'Histórico importado',icon:'checkCircle'}
    :doc?COLORS[doc.status]:null;
  const ACCEPTED=new Set(['PENDING_REVIEW','UNDER_REVIEW','VERIFIED']);
  const newest=(docs,typeId)=>docs.filter((d)=>d.document_type_id===typeId).sort((a,b)=>new Date(b.created_at)-new Date(a.created_at)||String(b.id).localeCompare(String(a.id)))[0]||null;
  const physicalAvailable=(doc)=>!!(doc&&doc.available!==false&&doc.availability!=='OBJECT_MISSING'&&doc.availability!=='ASSET_METADATA_MISSING'&&doc.availability!=='ASSET_DISABLED');

  function DocumentRequirementList({requirements,documents,onChanged,compact,variant,highlightedId,editable,accessPurpose}){
    const selection=useRef(null),input=useRef(null),cameraVideo=useRef(null),cameraStream=useRef(null),[busy,setBusy]=useState(null),[error,setError]=useState(''),[origin,setOrigin]=useState(null),[camera,setCamera]=useState(null),[cameraError,setCameraError]=useState('');
    const pick=(type,source)=>{
      selection.current={type,source};
      setError('');
      if(input.current){
        input.current.accept=source==='camera'?'image/*':(type.accepted_mime_types||[]).join(',');
        if(source==='camera')input.current.setAttribute('capture','environment');
        else input.current.removeAttribute('capture');
        input.current.click();
      }
    };
    const upload=async(event)=>{
      const file=event.target.files&&event.target.files[0],selected=selection.current;
      event.target.value='';
      if(!file||!selected)return;
      const type=selected.type;
      setBusy({id:type.id,phase:'preparing'});
      try{
        await window.DocumentWorkflowRepository.upload(type,file,{source:selected.source,onProgress:(phase)=>setBusy({id:type.id,phase})});
        await onChanged();
      }catch(e){
        const code=e&&(e.code||e.message);
        setError(type.label+': '+(code==='INVALID_DOCUMENT_FILE'
          ?'el archivo no tiene un formato o tamaño permitido.'
          :'no se pudo completar la carga. Revisa tu conexión e intenta nuevamente.'));
      }finally{
        setBusy(null);
        selection.current=null;
      }
    };
    useEffect(()=>{if(!camera)return;let active=true;setCameraError('');navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}},audio:false}).then((stream)=>{if(!active){stream.getTracks().forEach((track)=>track.stop());return;}cameraStream.current=stream;if(cameraVideo.current){cameraVideo.current.srcObject=stream;cameraVideo.current.play().catch(()=>{});}}).catch(()=>{if(active)setCameraError('No fue posible abrir la cámara. Revisa el permiso o adjunta un archivo.');});return()=>{active=false;if(cameraStream.current){cameraStream.current.getTracks().forEach((track)=>track.stop());cameraStream.current=null;}};},[camera&&camera.id]);
    const openCamera=(type)=>{if(window.innerWidth>768&&navigator.mediaDevices&&navigator.mediaDevices.getUserMedia){setCamera(type);return;}pick(type,'camera');};
    const captureCamera=async()=>{const video=cameraVideo.current,type=camera;if(!video||!type||!video.videoWidth||!video.videoHeight)return;const canvas=document.createElement('canvas');canvas.width=video.videoWidth;canvas.height=video.videoHeight;canvas.getContext('2d').drawImage(video,0,0);const blob=await new Promise((resolve)=>canvas.toBlob(resolve,'image/jpeg',.9));if(!blob){setCameraError('No fue posible capturar la foto.');return;}setCamera(null);selection.current={type,source:'camera'};await upload({target:{files:[new File([blob],'captura-'+Date.now()+'.jpg',{type:'image/jpeg'})],value:''}});};
    const open=async(doc,type)=>{
      if(!doc)return;
      setError('');
      setBusy({id:type.id,phase:'authorizing'});
      const popup=window.open('about:blank','_blank');
      if(popup)popup.opener=null;
      try{
        const preview=await window.DocumentWorkflowRepository.selfPreview(doc,accessPurpose||'SELF_SERVICE_EXPEDIENTE');
        if(popup)popup.location.replace(preview.signedUrl);
        else window.open(preview.signedUrl,'_blank','noopener,noreferrer');
      }catch(e){
        if(popup)popup.close();
        const code=e&&(e.code||e.message);
        setError(type.label+': '+(code==='DOCUMENT_OBJECT_MISSING'
          ?'este documento ya no está disponible. Puedes cargarlo nuevamente.'
          :'no fue posible autorizar la vista. Intenta nuevamente.'));
        await onChanged();
      }finally{setBusy(null);}
    };
    const hiddenInput=h('input',{ref:input,type:'file',style:{display:'none'},onChange:upload,'aria-hidden':'true',tabIndex:-1});
    const alert=error&&h('div',{role:'alert',style:{fontSize:12,fontWeight:700,color:'#A32921',marginBottom:9}},error);
    const originSheet=h(window.Sheet,{open:!!origin,onClose:()=>setOrigin(null),title:origin?'Agregar '+origin.label:'Agregar documento'},origin&&h(React.Fragment,null,
      h('p',{style:{fontSize:13,color:'var(--ink-3)',lineHeight:1.5,margin:'0 0 12px'}},'Elige cómo quieres agregar este documento. Se guardará en tu expediente privado.'),
      origin.camera_allowed!==false&&h('button',{type:'button','data-document-origin':'camera',onClick:()=>{const type=origin;setOrigin(null);openCamera(type);},style:{width:'100%',minHeight:52,border:'1px solid var(--hairline-strong)',borderRadius:14,background:'#fff',color:'var(--guinda)',fontWeight:850,display:'flex',alignItems:'center',justifyContent:'center',gap:9,marginBottom:9}},h(I,{name:'camera',size:20,stroke:2}),'Tomar foto'),
      origin.file_upload_allowed!==false&&h('button',{type:'button','data-document-origin':'file',onClick:()=>{const type=origin;setOrigin(null);pick(type,'file');},style:{width:'100%',minHeight:52,border:0,borderRadius:14,background:'var(--guinda)',color:'#fff',fontWeight:850,display:'flex',alignItems:'center',justifyContent:'center',gap:9}},h(I,{name:'upload',size:20,stroke:2}),'Adjuntar archivo')));
    const cameraSheet=h(window.Sheet,{open:!!camera,onClose:()=>setCamera(null),title:camera?'Tomar foto · '+camera.label:'Tomar foto'},camera&&h(React.Fragment,null,
      h('video',{ref:cameraVideo,'data-document-live-camera':'true',playsInline:true,muted:true,style:{display:cameraError?'none':'block',width:'100%',maxHeight:'52vh',objectFit:'cover',borderRadius:15,background:'#111'}}),
      cameraError&&h('div',{role:'alert',style:{padding:13,borderRadius:12,background:'#FCE9EE',color:'#A00027',fontSize:12,fontWeight:750}},cameraError),
      h('div',{style:{display:'flex',gap:9,marginTop:12}},h('button',{type:'button',onClick:()=>setCamera(null),style:{flex:1,minHeight:48,border:'1px solid var(--hairline-strong)',borderRadius:13,background:'#fff',fontWeight:800}},'Cancelar'),h('button',{type:'button',disabled:!!cameraError,onClick:captureCamera,style:{flex:1,minHeight:48,border:0,borderRadius:13,background:'var(--guinda)',color:'#fff',fontWeight:850}},'Capturar foto'))));
    const phaseLabel=(type)=>{if(!busy||busy.id!==type.id)return'';return busy.phase==='preparing'?'Preparando imagen…':busy.phase==='authorizing'?'Autorizando vista…':busy.phase==='registering'?'Registrando…':'Subiendo…';};
    const actionButton=(label,icon,onClick,disabled,kind)=>h('button',{type:'button',disabled,onClick,'data-document-action':kind,style:{height:36,border:'1px solid var(--hairline-strong)',borderRadius:10,background:'#fff',color:'var(--guinda)',fontSize:11.5,fontWeight:800,padding:'0 10px',display:'inline-flex',alignItems:'center',justifyContent:'center',gap:5,flex:'1 1 auto'}},h(I,{name:icon,size:14,stroke:2}),label);

    if(variant==='tiles'){
      return h(React.Fragment,null,
        hiddenInput,
        alert,
        h('div',{className:'mr-doc-grid','data-document-grid':'membership'},requirements.map((req)=>{
          const type=req.document_type||req,doc=newest(documents,type.id),state=documentState(doc)||{fg:'#B0002A',bg:'#FCE9EE',label:'Pendiente',icon:'upload'};
          const verified=!!(doc&&doc.status==='VERIFIED'),accepted=!!(doc&&ACCEPTED.has(doc.status)),available=physicalAvailable(doc),canUpload=!!editable||!doc||['REJECTED','REUPLOAD_REQUIRED'].includes(doc.status),preview=accepted&&available;
          const image=!!(preview&&doc.signedUrl&&String(doc.mimeType||'').toLowerCase().startsWith('image/')),isBusy=!!(busy&&busy.id===type.id);
          const action=canUpload?'upload':preview?'preview':'unavailable',actionCopy=canUpload?(doc?'Reemplazar':'Adjuntar'):state.label,hint=type.description||state.label;
          const classes=['mr-doc-tile',accepted&&available?'is-filled':'',highlightedId===type.id&&(!accepted||!available)?'is-highlighted':'',doc&&(['REJECTED','REUPLOAD_REQUIRED'].includes(doc.status)||!available)?'is-error':''].filter(Boolean).join(' ');
          const act=()=>{if(canUpload)setOrigin(type);else if(preview)open(doc,type);};
          return h('article',{key:type.id,className:classes,'data-document-type':type.code,'data-document-type-id':type.id,'data-document-status':doc?doc.status:'MISSING','data-document-availability':doc&&doc.availability||'MISSING','data-document-required':req.required===false?'false':'true'},
            h('button',{type:'button',className:'mr-doc-pick',disabled:isBusy||action==='unavailable',onClick:act,'data-document-action':action,'aria-label':(canUpload?(doc?'Reemplazar ':'Adjuntar '):preview?'Ver ':'Vista no disponible de ')+type.label},
              image&&h('img',{className:'mr-doc-thumb',src:doc.signedUrl,alt:'',loading:'lazy'}),
              accepted&&available&&h('span',{className:'mr-doc-veil','aria-hidden':'true'}),
              h('span',{className:'mr-doc-badge','aria-hidden':'true',style:{background:state.bg,color:state.fg}},h(I,{name:image?'doc':type.icon||'doc',size:21,stroke:1.9})),
              h('span',{className:'mr-doc-meta'},h('strong',null,type.label),h('span',{className:accepted&&available?'mr-doc-file':'mr-doc-add'},h(I,{name:isBusy?'clock':canUpload?'camera':state.icon,size:14,stroke:2.1}),isBusy?phaseLabel(type):actionCopy+(canUpload?' · '+hint:''))),
              verified&&available&&h('span',{className:'mr-doc-ok','aria-label':state.label},h(I,{name:'checkCircle',size:15,stroke:2.3}))),
            preview&&h('button',{type:'button',className:'mr-doc-view','aria-label':'Ver '+type.label,onClick:()=>open(doc,type)},h(I,{name:'eye',size:16,stroke:2})),
            accepted&&available&&h('span',{className:'mr-doc-status',style:{color:state.fg}},state.label),
            doc&&doc.review_observation&&h('p',{className:'mr-doc-observation'},doc.review_observation));
        })),originSheet,cameraSheet);
    }

    return h(React.Fragment,null,
      hiddenInput,
      alert,
      h('div',{style:{display:'flex',flexDirection:'column',gap:compact?9:11}},requirements.map((req)=>{
        const type=req.document_type||req,doc=newest(documents,type.id),available=physicalAvailable(doc),accepted=!!(doc&&ACCEPTED.has(doc.status)),missingObject=!!(doc&&!available),baseState=documentState(doc),state=missingObject?{fg:'#B0002A',bg:'#FCE9EE',label:'Archivo no disponible',icon:'info'}:baseState||{fg:'#B0002A',bg:'#FCE9EE',label:'Documento requerido',icon:'upload'},canUpload=!!editable||!doc||['REJECTED','REUPLOAD_REQUIRED'].includes(doc.status),cameraAllowed=(type.accepted_mime_types||[]).some((mime)=>String(mime).startsWith('image/')),isBusy=!!(busy&&busy.id===type.id),canView=accepted&&available;
        return h('div',{key:type.id,'data-document-type':type.code,'data-document-type-id':type.id,'data-document-status':doc?doc.status:'MISSING','data-document-availability':doc&&doc.availability||'MISSING',style:{background:'var(--surface)',borderRadius:16,padding:compact?'11px 12px':'13px 14px',boxShadow:'var(--neo-sm)'}},
          h('div',{style:{display:'flex',alignItems:'center',gap:12}},
            h('div',{style:{width:44,height:44,borderRadius:13,background:state.bg,color:state.fg,display:'grid',placeItems:'center',flexShrink:0}},h(I,{name:type.icon||'doc',size:22,stroke:1.9})),
            h('div',{style:{flex:1,minWidth:0}},
              h('div',{style:{fontSize:14,fontWeight:800}},type.label),
              h('div',{style:{display:'flex',alignItems:'center',gap:5,fontSize:11.8,fontWeight:700,color:state.fg,marginTop:2}},h(I,{name:isBusy?'clock':state.icon,size:13,stroke:2.1}),isBusy?phaseLabel(type):state.label),
              doc&&doc.review_observation&&h('div',{style:{fontSize:11,color:'#9B2743',marginTop:3}},doc.review_observation)),
            canView&&h('button',{type:'button','aria-label':'Ver '+type.label,disabled:isBusy,onClick:()=>open(doc,type),style:{width:38,height:38,borderRadius:11,border:'1px solid var(--hairline-strong)',background:'#fff',display:'grid',placeItems:'center',color:'var(--ink-3)'}},h(I,{name:'eye',size:18,stroke:2}))),
          canUpload&&h('div',{style:{display:'flex',gap:7,marginTop:10,flexWrap:'wrap'}},cameraAllowed&&actionButton('Tomar foto','camera',()=>pick(type,'camera'),isBusy,'camera'),actionButton(doc?'Reemplazar':'Subir archivo','upload',()=>pick(type,'file'),isBusy,'upload')));
      })),originSheet,cameraSheet);
  }

  const UNIFIED_CSS=`
    .ud-phase{color:var(--ink);font-family:var(--font);}.ud-title{margin:0 0 4px;font-size:21px;line-height:1.18;font-weight:900}.ud-sub{margin:0 0 14px;color:var(--ink-3);font-size:12.5px;line-height:1.45}.ud-tracker{background:#fff;border-radius:18px;padding:14px 15px;box-shadow:var(--neo-sm);margin-bottom:18px}.ud-head{display:flex;justify-content:space-between;gap:12px;align-items:center;font-size:13px;font-weight:850}.ud-count{color:var(--guinda)}.ud-segments{display:grid;grid-template-columns:repeat(var(--ud-total),1fr);gap:5px;margin:10px 0}.ud-segments i{height:5px;border-radius:99px;background:#E8E8ED}.ud-segments i.on{background:var(--guinda)}.ud-help{font-size:11.5px;color:var(--ink-3);font-weight:650}.ud-chips{display:flex;gap:6px;overflow:auto;padding-top:9px}.ud-chip{white-space:nowrap;border:0;border-radius:99px;background:#FCE9EE;color:#A00027;padding:6px 9px;font-size:10.5px;font-weight:800}.ud-section-title{display:flex;gap:7px;align-items:center;margin:0 0 11px;font-size:14px;font-weight:900}.ud-privacy{display:flex;align-items:flex-start;gap:8px;color:var(--ink-3);font-size:11.5px;line-height:1.45;padding:15px 4px 2px}.ud-state{background:#fff;border-radius:16px;padding:18px;font-size:12.5px;font-weight:700}.ud-state.err{color:#A32921}.mr-doc-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.mr-doc-tile{position:relative;min-height:150px;border-radius:17px;background:#fff;box-shadow:var(--neo-sm);overflow:hidden}.mr-doc-pick{width:100%;min-height:150px;border:0;background:transparent;padding:14px 10px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;color:var(--ink)}.mr-doc-badge{width:44px;height:44px;border-radius:13px;background:#E5F7EF;color:#087A50;display:grid;place-items:center}.mr-doc-meta{display:flex;flex-direction:column;align-items:center;gap:5px;min-width:0}.mr-doc-meta strong{font-size:12px;line-height:1.2;text-align:center}.mr-doc-meta>span{font-size:10px;color:var(--guinda);font-weight:800;text-align:center}.mr-doc-ok{position:absolute;top:9px;left:9px;color:#087A50}.mr-doc-view{position:absolute;top:8px;right:8px;width:32px;height:32px;border:1px solid var(--hairline-strong);border-radius:10px;background:#fff;color:var(--ink-3);display:grid;place-items:center}.mr-doc-status{position:absolute;bottom:8px;left:0;right:0;text-align:center;font-size:9.5px;font-weight:850;color:#087A50}.mr-doc-observation{font-size:9px;color:#A00027;padding:0 8px 8px;margin:0;text-align:center}.mr-doc-tile.is-error{outline:1px solid #E8A2B2}.mr-doc-tile.is-highlighted{outline:2px solid var(--guinda)}@media(min-width:700px){.ud-phase{max-width:760px;margin:0 auto}}
  `;
  function UnifiedDocumentPhase({requirements,documents,onChanged,phase,error,onRetry,highlightedId,accessPurpose,title}){
    const required=(requirements||[]).filter((r)=>r.required!==false),covered=required.filter((r)=>{const d=newest(documents||[],r.document_type_id);return d&&ACCEPTED.has(d.status)&&physicalAvailable(d);}),missing=required.filter((r)=>!covered.includes(r)),total=required.length,done=covered.length;
    return h('section',{className:'ud-phase','data-unified-document-phase':'true','data-document-total':total,'data-document-complete':done,'aria-busy':phase==='loading'?'true':'false'},h('style',null,UNIFIED_CSS),
      h('h2',{className:'ud-title'},title||'Verifica tus documentos'),h('p',{className:'ud-sub'},'Completa tu expediente con una foto o un archivo. Los requisitos provienen de la configuración vigente.'),
      h('div',{className:'ud-tracker',style:{'--ud-total':Math.max(1,total)}},h('div',{className:'ud-head'},h('span',null,'Expediente'),h('span',{className:'ud-count','aria-live':'polite'},phase==='ready'?done+' de '+total:'—')),
        h('div',{className:'ud-segments','aria-hidden':'true'},Array.from({length:Math.max(1,total)},(_,index)=>h('i',{key:index,className:index<done?'on':''}))),
        h('div',{className:'ud-help'},phase==='ready'?(missing.length?'Te faltan '+missing.length+' documento'+(missing.length===1?'':'s')+' obligatorio'+(missing.length===1?'':'s')+'.':'Tu expediente requerido está completo.'):'Consultando el expediente autorizado…'),
        phase==='ready'&&missing.length>0&&h('div',{className:'ud-chips'},missing.map((r)=>h('span',{key:r.document_type_id,className:'ud-chip'},(r.document_type||r).label)))),
      h('div',{className:'ud-section-title'},h(I,{name:'folder',size:18,stroke:2}),'Documentos del expediente'),
      phase==='loading'&&h('div',{className:'ud-state',role:'status'},'Cargando documentos…'),
      phase==='error'&&h('div',{className:'ud-state err',role:'alert'},error||'No fue posible consultar la fuente autorizada.',' ',onRetry&&h('button',{type:'button',onClick:onRetry},'Reintentar')),
      phase==='ready'&&requirements.length===0&&h('div',{className:'ud-state'},'Este trámite no tiene documentos configurados.'),
      phase==='ready'&&requirements.length>0&&h(DocumentRequirementList,{requirements,documents,onChanged,variant:'tiles',highlightedId,editable:true,accessPurpose:accessPurpose||'SELF_SERVICE_EXPEDIENTE'}),
      h('div',{className:'ud-privacy'},h(I,{name:'lock',size:15,stroke:2}),h('span',null,'Tus archivos se envían de forma segura, permanecen privados y sólo se consultan con autorización temporal.')));
  }

  function DocumentRequestGate({scopeType,scopeKey,onState,title}){
    const[state,setState]=useState({phase:'loading',requirements:[],documents:[],error:''});
    const load=React.useCallback(async()=>{setState((current)=>Object.assign({},current,{phase:'loading',error:''}));try{const[requirements,documents]=await Promise.all([window.DocumentWorkflowRepository.resolveRequirements(scopeType,scopeKey),window.DocumentWorkflowRepository.listSelfDocuments('SELF_SERVICE_EXPEDIENTE')]);setState({phase:'ready',requirements:requirements.slice(),documents:documents.slice(),error:''});}catch(_){setState({phase:'error',requirements:[],documents:[],error:'No fue posible consultar los requisitos autorizados.'});}},[scopeType,scopeKey]);
    useEffect(()=>{load();},[load]);
    const result=useMemo(()=>{const required=state.requirements.filter((row)=>row.required!==false),selected=state.requirements.map((row)=>newest(state.documents,row.document_type_id)).filter((doc)=>doc&&ACCEPTED.has(doc.status)&&physicalAvailable(doc));return{phase:state.phase,ready:state.phase==='ready'&&required.every((row)=>selected.some((doc)=>doc.document_type_id===row.document_type_id)),documentIds:selected.map((doc)=>doc.id),missing:Math.max(0,required.length-selected.filter((doc)=>required.some((row)=>row.document_type_id===doc.document_type_id)).length)};},[state]);
    useEffect(()=>{if(onState)onState(result);},[result.phase,result.ready,result.missing,result.documentIds.join('|')]);
    return h(UnifiedDocumentPhase,{requirements:state.requirements,documents:state.documents,onChanged:load,phase:state.phase,error:state.error,onRetry:load,accessPurpose:'SELF_SERVICE_EXPEDIENTE',title:title||'Verifica tus documentos'});
  }

  function useDocuments(){
    const[state,setState]=useState({phase:'loading',types:[],docs:[],error:null});
    const load=React.useCallback(async()=>{
      setState((s)=>Object.assign({},s,{phase:'loading',error:null}));
      try{
        const[types,docs]=await Promise.all([window.DocumentWorkflowRepository.catalog(),window.DocumentWorkflowRepository.listSelfDocuments('SELF_SERVICE_EXPEDIENTE')]);
        setState({phase:'ready',types,docs,error:null});
      }catch(error){
        setState({phase:'error',types:[],docs:[],error});
      }
    },[]);
    useEffect(()=>{load();},[load]);
    return[state,load];
  }

  function DocumentosScreen({app}){
    const[state,load]=useDocuments(),requirements=useMemo(()=>state.types.filter((t)=>t.required_by_default),[state.types]);
    const verified=requirements.filter((t)=>{const d=newest(state.docs,t.id);return d&&d.status==='VERIFIED'&&physicalAvailable(d);}).length;
    return h('div',{'data-document-authority':'supabase','data-document-phase':state.phase,style:{position:'absolute',inset:0,background:'var(--bg)',display:'flex',flexDirection:'column'}},
      h('div',{style:{display:'flex',alignItems:'center',gap:6,padding:'8px 12px',background:'var(--surface)',borderBottom:'1px solid var(--hairline)'}},h('button',{onClick:app.back,style:{width:40,height:40,borderRadius:12,border:'none',background:'transparent',display:'grid',placeItems:'center'}},h(I,{name:'arrowL',size:22,stroke:2})),h('span',{style:{fontSize:16.5,fontWeight:800}},'Mis Documentos')),
      h('div',{className:'su-app-scroll su-route',style:{flex:1,overflowY:'auto',padding:16}},
        h('div',{style:{background:'linear-gradient(135deg,#16322a,#0f4536)',borderRadius:20,padding:18,color:'#fff',display:'flex',gap:14,alignItems:'center'}},h('div',{style:{width:48,height:48,borderRadius:14,background:'rgba(255,255,255,.14)',display:'grid',placeItems:'center'}},h(I,{name:'shield',size:26,stroke:2})),h('div',null,h('div',{style:{fontSize:15,fontWeight:800}},'Tus documentos están protegidos'),h('div',{style:{fontSize:12.2,opacity:.82,fontWeight:600,marginTop:2,lineHeight:1.45}},'Cifrado de extremo a extremo. Solo el comité autorizado puede verlos.'))),
        h('div',{style:{background:'var(--surface)',borderRadius:18,padding:16,marginTop:16,boxShadow:'var(--neo-sm)'}},h('div',{style:{display:'flex',justifyContent:'space-between',marginBottom:10}},h('span',{style:{fontSize:14.5,fontWeight:800}},'Expediente completo'),h('span',{'data-document-count':verified+'/'+requirements.length,style:{fontSize:14.5,fontWeight:800,color:'var(--guinda)'}},state.phase==='ready'?verified+' / '+requirements.length:'—')),h(window.ProgressBar,{value:requirements.length?verified/requirements.length*100:0,height:10}),h('div',{style:{fontSize:12.3,color:'var(--ink-3)',fontWeight:600,marginTop:9}},requirements.length-verified>0?'Te faltan '+(requirements.length-verified)+' documentos por verificar.':'Tu expediente está verificado.')),
        h('div',{style:{marginTop:20}},h(window.SectionHead,{title:'Documentos requeridos',icon:'folder'}),state.phase==='loading'&&h('div',{role:'status'},'Cargando documentos…'),state.phase==='error'&&h('div',{role:'alert',style:{background:'#fff',borderRadius:16,padding:18,color:'#A32921',fontWeight:700}},'No fue posible consultar la fuente autorizada. ',h('button',{onClick:load},'Reintentar')),state.phase==='ready'&&h(DocumentRequirementList,{requirements,documents:state.docs,onChanged:load,editable:true,accessPurpose:'SELF_SERVICE_EXPEDIENTE'}))));
  }
  window.DocumentRequirementList=DocumentRequirementList;
  window.UnifiedDocumentPhase=UnifiedDocumentPhase;
  window.DocumentRequestGate=DocumentRequestGate;
  window.DocumentosScreen=DocumentosScreen;
})();
