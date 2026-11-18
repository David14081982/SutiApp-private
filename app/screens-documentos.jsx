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
  const sourceCapabilities=(type)=>{const mime=(type&&type.accepted_mime_types)||[];const camera=!!(type&&type.camera_allowed!==false&&mime.some((value)=>String(value).startsWith('image/'))),file=!!(type&&type.file_upload_allowed!==false);return{camera,file,any:camera||file};};
  const KIND={'application/pdf':'PDF','image/jpeg':'JPG','image/png':'PNG','image/webp':'WEBP'};
  const kindOf=(mime)=>KIND[String(mime||'').toLowerCase()]||'';
  const listKinds=(kinds)=>kinds.length>1?kinds.slice(0,-1).join(', ')+' o '+kinds[kinds.length-1]:kinds.join('');
  const megabytes=(type)=>Math.round((Number(type&&type.max_file_size_bytes)||0)/1048576);
  const shortDate=(value)=>{const date=new Date(value);return isNaN(date.getTime())?'':date.toLocaleDateString('es-MX',{day:'numeric',month:'short'}).replace(/\./g,'');};

  function DocumentRequirementList({requirements,documents,onChanged,compact,variant,highlightedId,editable,accessPurpose}){
    const selection=useRef(null),input=useRef(null),cameraVideo=useRef(null),cameraStream=useRef(null),thumbnailRetries=useRef(new Set()),thumbnailNodes=useRef(new Map()),thumbnailRefresh=useRef(()=>{}),[busy,setBusy]=useState(null),[error,setError]=useState(null),[origin,setOrigin]=useState(null),[camera,setCamera]=useState(null),[cameraError,setCameraError]=useState(''),[thumbnails,setThumbnails]=useState({}),[viewer,setViewer]=useState(null);
    const resourceContext=window.PrivateResourceDemand.useContext();
    const thumbnailCandidates=variant==='tiles'?(requirements||[]).map(req=>newest(documents||[],(req.document_type||req).id)).filter(doc=>doc&&ACCEPTED.has(doc.status)&&physicalAvailable(doc)&&String(doc.mimeType||'').toLowerCase().startsWith('image/')):[];
    const thumbnailKey=JSON.stringify([accessPurpose||'SELF_SERVICE_EXPEDIENTE',thumbnailCandidates]);
    const pick=(type,source,mimes)=>{
      selection.current={type,source};
      setError(null);
      if(input.current){
        const accepted=mimes||type.accepted_mime_types||[];
        input.current.accept=source==='camera'?'image/*':accepted.concat(accepted.includes('image/jpeg')?['.jfif']:[]).join(',');
        if(source==='camera')input.current.setAttribute('capture','environment');
        else input.current.removeAttribute('capture');
        input.current.click();
      }
    };
    const upload=async(event)=>{
      const file=event.target.files&&event.target.files[0],selected=selection.current;
      event.target.value='';
      if(!file||!selected||busy)return;
      const type=selected.type;
      const context=window.PrivateResourceDemand.context();let confirmed=false;
      setBusy({id:type.id,phase:'preparing'});
      try{
        const document=await window.DocumentWorkflowRepository.upload(type,file,{source:selected.source,onProgress:(phase)=>{if(window.PrivateResourceDemand.context()===context)setBusy({id:type.id,phase});}});
        if(window.PrivateResourceDemand.context()!==context)return;
        confirmed=true;setBusy(null);
        await onChanged(document);
      }catch(e){
        if(window.PrivateResourceDemand.context()!==context)return;
        const code=e&&(e.code||e.message),stage=e&&e.documentPhase;
        setError({id:type.id,label:type.label,text:(confirmed?'el documento quedó guardado; no fue posible actualizar la vista. Vuelve a consultar el expediente.':code==='INVALID_DOCUMENT_FILE'
          ?'el archivo no tiene un formato o tamaño permitido.'
          :code==='INVALID_IMAGE_DIMENSIONS'?'la imagen supera las dimensiones permitidas. Selecciona una imagen de menor resolución.'
          :e&&e.recoverable===false?'el archivo está dañado o no es compatible. Toma la foto de nuevo o selecciona otro archivo.'
          :stage==='verifying'?'no se pudo confirmar el registro. Reintenta para recuperar la misma carga.':stage==='uploading'?'se interrumpió la transferencia. Selecciona el mismo archivo para reanudarla.':'no se pudo completar la carga. Revisa tu conexión e intenta nuevamente.')});
      }finally{
        if(window.PrivateResourceDemand.context()===context)setBusy(null);
        selection.current=null;
      }
    };
    useEffect(()=>{if(!camera)return;let active=true;setCameraError('');navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}},audio:false}).then((stream)=>{if(!active){stream.getTracks().forEach((track)=>track.stop());return;}cameraStream.current=stream;if(cameraVideo.current){cameraVideo.current.srcObject=stream;cameraVideo.current.play().catch(()=>{});}}).catch(()=>{if(active)setCameraError('No fue posible abrir la cámara. Revisa el permiso o adjunta un archivo.');});return()=>{active=false;if(cameraStream.current){cameraStream.current.getTracks().forEach((track)=>track.stop());cameraStream.current=null;}};},[camera&&camera.id]);
    const openCamera=(type)=>{if(window.innerWidth>768&&navigator.mediaDevices&&navigator.mediaDevices.getUserMedia){setCamera(type);return;}pick(type,'camera');};
    const captureCamera=async()=>{const video=cameraVideo.current,type=camera;if(!video||!type||!video.videoWidth||!video.videoHeight)return;const canvas=document.createElement('canvas');canvas.width=video.videoWidth;canvas.height=video.videoHeight;canvas.getContext('2d').drawImage(video,0,0);const blob=await new Promise((resolve)=>canvas.toBlob(resolve,'image/jpeg',.9));if(!blob){setCameraError('No fue posible capturar la foto.');return;}setCamera(null);selection.current={type,source:'camera'};await upload({target:{files:[new File([blob],'captura-'+Date.now()+'.jpg',{type:'image/jpeg'})],value:''}});};
    useEffect(()=>{
      let active=true;const visible=new Set(),inFlight=new Set(),ready=new Map(),timers=new Map();
      thumbnailRetries.current=new Set();
      setThumbnails({});
      const valid=()=>active&&window.PrivateResourceDemand.context()===resourceContext;
      const put=(doc,value)=>{if(valid())setThumbnails(current=>Object.assign({},current,{[doc.id]:Object.assign({context:resourceContext,key:thumbnailKey},value)}));};
      const load=async(doc,force)=>{
        if(!valid()||document.hidden||!visible.has(doc.id)||inFlight.has(doc.id))return;
        if(!force&&ready.has(doc.id))return;
        inFlight.add(doc.id);
        put(doc,{phase:'authorizing',url:''});
        try{
          const preview=await window.DocumentWorkflowRepository.selfPreview(doc,accessPurpose||'SELF_SERVICE_EXPEDIENTE');
          if(!valid())return;
          const expires=Date.now()+Math.min(300,Number(preview.expiresIn)||300)*1000-1000;
          if(expires<=Date.now())throw new Error('DOCUMENT_PREVIEW_EXPIRED');
          ready.set(doc.id,true);put(doc,{phase:'ready',url:preview.signedUrl,expires});
          clearTimeout(timers.get(doc.id));timers.set(doc.id,setTimeout(()=>{ready.delete(doc.id);put(doc,{phase:'expired',url:''});load(doc,false);},expires-Date.now()));
        }catch(_){
          ready.set(doc.id,true);put(doc,{phase:'error',url:''});
        }finally{inFlight.delete(doc.id);}
      };
      thumbnailRefresh.current=doc=>{if(thumbnailRetries.current.has(doc.id)){put(doc,{phase:'error',url:''});return;}thumbnailRetries.current.add(doc.id);load(doc,true);};
      const observer=window.IntersectionObserver?new IntersectionObserver(entries=>{for(const entry of entries){const doc=thumbnailCandidates.find(d=>thumbnailNodes.current.get(d.id)===entry.target);if(!doc)continue;if(entry.isIntersecting&&entry.intersectionRatio>0){visible.add(doc.id);load(doc,false);}else visible.delete(doc.id);}},{threshold:[0,0.000001]}):null;
      for(const doc of thumbnailCandidates){const node=thumbnailNodes.current.get(doc.id);if(observer&&node)observer.observe(node);else if(!observer){visible.add(doc.id);load(doc,false);}}
      const foreground=()=>{if(!document.hidden)thumbnailCandidates.forEach(doc=>load(doc,false));};
      document.addEventListener('visibilitychange',foreground);
      return()=>{active=false;thumbnailRefresh.current=()=>{};if(observer)observer.disconnect();timers.forEach(clearTimeout);document.removeEventListener('visibilitychange',foreground);};
    },[thumbnailKey,resourceContext]);
    const refreshThumbnail=doc=>thumbnailRefresh.current(doc);
    const open=async(doc,type)=>{
      if(!doc)return;
      setError(null);
      setBusy({id:type.id,phase:'authorizing'});
      try{
        const preview=await window.DocumentWorkflowRepository.selfPreview(doc,accessPurpose||'SELF_SERVICE_EXPEDIENTE');
        setViewer({source:preview.signedUrl,mimeType:doc.mimeType||'',title:type.label,documentId:doc.id,context:resourceContext});
      }catch(e){
        const code=e&&(e.code||e.message);
        setError({id:type.id,label:type.label,text:(code==='DOCUMENT_OBJECT_MISSING'
          ?'este documento ya no está disponible. Puedes cargarlo nuevamente.'
          :'no fue posible abrir el documento. Intenta nuevamente.')});
        await onChanged();
      }finally{setBusy(null);}
    };
    const retire=async(doc,type)=>{if(!window.confirm('¿Retirar '+type.label+' del expediente? Las solicitudes anteriores conservarán su documento.'))return;setBusy({id:type.id,phase:'retiring'});setError(null);try{await window.DocumentWorkflowRepository.withdraw(doc.id,crypto.randomUUID(),'Retiro solicitado desde el expediente');await onChanged();}catch(e){setError({id:type.id,label:type.label,text:'no se pudo retirar el documento. Intenta nuevamente.'});}finally{setBusy(null);}};
    const hiddenInput=h('input',{ref:input,type:'file',style:{display:'none'},onChange:upload,'aria-hidden':'true',tabIndex:-1});
    const alert=error&&h('div',{role:'alert',style:{fontSize: 'var(--text-12, 12px)',fontWeight:700,color:'#A32921',marginBottom:9}},error.label+': '+error.text);
    const originType=origin&&origin.type,originCapabilities=sourceCapabilities(originType),originMimes=(originType&&originType.accepted_mime_types)||[];
    const originImages=originMimes.filter((value)=>String(value).startsWith('image/')),originPdf=originMimes.filter((value)=>value==='application/pdf'),originMb=megabytes(originType);
    const originOption=(kind,icon,title,detail,run)=>h('button',{type:'button',className:'ud-origin-opt','data-document-origin':kind,onClick:()=>{const type=originType;setOrigin(null);run(type);}},h('span',{className:'ud-origin-ico','aria-hidden':'true'},h(I,{name:icon,size:22,stroke:2})),h('span',{className:'ud-origin-copy'},h('b',null,title),h('small',null,detail)));
    const originTip=(icon,text)=>h('div',{key:icon},h(I,{name:icon,size:20,stroke:2}),text);
    const originSheet=h(window.Sheet,{open:!!origin,onClose:()=>setOrigin(null),title:origin&&origin.replacing?'Reemplazar documento':'Subir documento'},originType&&h('div',{className:'ud-origin'},h('style',null,ORIGIN_CSS),
      h('p',{className:'ud-origin-sub'},originType.label+' · elige cómo quieres subirlo'),
      origin.replacing&&h('p',{className:'ud-origin-keep'},'El documento actual permanecerá intacto hasta completar la nueva carga.'),
      originCapabilities.camera&&originOption('camera','camera','Tomar foto','Usa la cámara de tu teléfono',openCamera),
      originCapabilities.file&&originImages.length>0&&originOption('gallery','image','Elegir de la galería','JPG o PNG',(type)=>pick(type,'file',originImages)),
      originCapabilities.file&&originPdf.length>0&&originOption('pdf','doc','Subir PDF',originMb?'Máximo '+originMb+' MB':'Archivo PDF',(type)=>pick(type,'file',originPdf)),
      h('div',{className:'ud-origin-tips'},originTip('sun','Buena luz, sin reflejos'),originTip('scan','Las 4 esquinas visibles'),originTip('eye','Texto legible')),
      h('button',{type:'button',className:'ud-origin-cancel',onClick:()=>setOrigin(null)},'Cancelar')));
    const cameraSheet=h(window.Sheet,{open:!!camera,onClose:()=>setCamera(null),title:camera?'Tomar foto · '+camera.label:'Tomar foto'},camera&&h(React.Fragment,null,
      h('video',{ref:cameraVideo,'data-document-live-camera':'true',playsInline:true,muted:true,style:{display:cameraError?'none':'block',width:'100%',maxHeight:'52vh',objectFit:'cover',borderRadius:15,background:'#111'}}),
      cameraError&&h('div',{role:'alert',style:{padding:13,borderRadius:12,background:'#FCE9EE',color:'#A00027',fontSize: 'var(--text-12, 12px)',fontWeight:750}},cameraError),
      h('div',{style:{display:'flex',gap:9,marginTop:12}},h('button',{type:'button',onClick:()=>setCamera(null),style:{flex:1,minHeight:48,border:'1px solid var(--hairline-strong)',borderRadius:13,background:'#fff',fontWeight:800}},'Cancelar'),h('button',{type:'button',disabled:!!cameraError,onClick:captureCamera,style:{flex:1,minHeight:48,border:0,borderRadius:13,background:'var(--guinda)',color:'#fff',fontWeight:850}},'Capturar foto'))));
    const phaseLabel=(type)=>{if(!busy||busy.id!==type.id)return'';return busy.phase==='preparing'?'Preparando imagen…':busy.phase==='authorizing'?'Abriendo…':busy.phase==='verifying'?'Verificando archivo…':busy.phase==='retiring'?'Retirando…':busy.phase==='registering'?'Registrando…':'Subiendo…';};
    const actionButton=(label,icon,onClick,disabled,kind)=>h('button',{type:'button',disabled,onClick,'data-document-action':kind,style:{height:36,border:'1px solid var(--hairline-strong)',borderRadius:10,background:'#fff',color:'var(--guinda)',fontSize: 'var(--text-11-5, 11.5px)',fontWeight:800,padding:'0 10px',display:'inline-flex',alignItems:'center',justifyContent:'center',gap:5,flex:'1 1 auto'}},h(I,{name:icon,size:14,stroke:2}),label);

    if(variant==='tiles'){
      return h(React.Fragment,null,
        hiddenInput,
        h('div',{className:'mr-doc-grid','data-document-grid':'membership'},requirements.map((req)=>{
          const type=req.document_type||req,doc=newest(documents,type.id),state=documentState(doc)||{fg:'#B0002A',bg:'#FCE9EE',label:'Pendiente',icon:'upload'};
          const verified=!!(doc&&doc.status==='VERIFIED'),accepted=!!(doc&&ACCEPTED.has(doc.status)),available=physicalAvailable(doc),capabilities=sourceCapabilities(type),canUpload=capabilities.any&&(!!editable||!doc||['REJECTED','REUPLOAD_REQUIRED'].includes(doc.status)),preview=accepted&&available;
          const thumbnail=doc&&thumbnails[doc.id],image=!!(preview&&thumbnail&&thumbnail.context===resourceContext&&thumbnail.key===thumbnailKey&&thumbnail.expires>Date.now()&&thumbnail.phase==='ready'&&thumbnail.url&&String(doc.mimeType||'').toLowerCase().startsWith('image/')),isBusy=!!(busy&&busy.id===type.id);
          const action=preview?'preview':canUpload?'upload':'unavailable';
          const failed=!!(doc&&(['REJECTED','REUPLOAD_REQUIRED'].includes(doc.status)||!available)),historical=!!(doc&&doc.status==='VERIFIED'&&doc.verificationProvenance==='HISTORICAL_IMPORT'),issue=error&&error.id===type.id?error.text:'';
          const tone=isBusy?'up':!doc?'miss':failed?'bad':historical?'hist':verified?'ok':'pend';
          const pill=isBusy?{label:phaseLabel(type),icon:'clock'}:!doc?{label:'Falta subir',icon:'upload'}:!available?{label:'Archivo no disponible',icon:'info'}:{label:state.label,icon:historical?'archive':verified?'check':state.icon};
          const kinds=[...new Set((type.accepted_mime_types||[]).map(kindOf).filter(Boolean))],mb=megabytes(type),uploaded=doc&&shortDate(doc.created_at);
          const meta=!doc?[listKinds(kinds),mb?'máx. '+mb+' MB':''].filter(Boolean).join(' · '):historical?'De tu expediente anterior':[uploaded&&'Subido '+uploaded,kindOf(doc.mimeType)].filter(Boolean).join(' · ');
          const classes=['mr-doc-tile',accepted&&available?'is-filled':'',image?'has-thumbnail':'',highlightedId===type.id&&(!accepted||!available)?'is-highlighted':'',failed||issue?'is-error':''].filter(Boolean).join(' ');
          const act=()=>{if(preview)open(doc,type);else if(canUpload)setOrigin({type,replacing:!!doc});};
          return h('article',{key:type.id,ref:node=>{if(doc){if(node)thumbnailNodes.current.set(doc.id,node);else thumbnailNodes.current.delete(doc.id);}},className:classes,'data-document-type':type.code,'data-document-type-id':type.id,'data-document-id':doc&&doc.id||'','data-document-status':doc?doc.status:'MISSING','data-document-availability':doc&&doc.availability||'MISSING','data-document-required':req.required===false?'false':'true'},
            h('div',{className:'mr-doc-main'},
              h('button',{type:'button',className:'mr-doc-pick'+(doc?'':' is-empty'),disabled:isBusy||action==='unavailable',onClick:act,'data-document-action':action,'aria-label':(preview?'Ver ':canUpload?(doc?'Reemplazar ':'Adjuntar '):'Vista no disponible de ')+type.label},
                image?h('img',{className:'mr-doc-thumb',src:thumbnail.url,alt:'Miniatura de '+type.label,onError:()=>refreshThumbnail(doc)}):h(I,{name:doc?type.icon||'doc':'plus',size:doc?30:26,stroke:doc?1.7:2.2}),
                preview&&h('span',{className:'mr-doc-zoom','aria-hidden':'true'},h(I,{name:'search',size:14,stroke:2.6}))),
              h('div',{className:'mr-doc-info'},
                h('strong',{className:'mr-doc-title'},type.label),
                h('span',{className:'mr-doc-pill is-'+tone},h(I,{name:pill.icon,size:14,stroke:2.4}),pill.label),
                doc&&doc.review_observation&&h('p',{className:'mr-doc-observation'},doc.review_observation),
                issue&&h('p',{className:'mr-doc-observation',role:'alert'},issue.charAt(0).toUpperCase()+issue.slice(1)),
                meta&&h('span',{className:'mr-doc-meta'},meta))),
            (preview||canUpload)&&h('div',{className:'mr-doc-actions'+(preview&&canUpload?'':' is-single')},
              preview&&h('button',{type:'button',className:'mr-doc-act mr-doc-view',disabled:isBusy,'aria-label':'Ver '+type.label,onClick:()=>open(doc,type)},h(I,{name:'eye',size:18,stroke:2.2}),'Ver'),
              preview&&canUpload&&h('button',{type:'button',className:'mr-doc-act mr-doc-replace',disabled:isBusy,'aria-label':'Reemplazar '+type.label,onClick:()=>setOrigin({type,replacing:true})},h(I,{name:'refresh',size:18,stroke:2.2}),'Reemplazar'),
              !preview&&canUpload&&h('button',{type:'button',className:'mr-doc-act mr-doc-upload',disabled:isBusy,'aria-label':(doc?'Volver a subir ':'Subir ')+type.label,onClick:()=>setOrigin({type,replacing:!!doc})},h(I,{name:doc?'refresh':'upload',size:18,stroke:2.2}),doc?'Volver a subir':'Subir documento')),
            doc&&editable&&window.DocumentIntegration&&window.DocumentIntegration.enabled()&&h('button',{type:'button',className:'mr-doc-retire','data-document-action':'retire','aria-label':'Retirar '+type.label,disabled:isBusy,onClick:()=>retire(doc,type)},'Retirar'));
        })),originSheet,cameraSheet,viewer&&viewer.context===resourceContext&&h(window.DocumentViewer,{source:viewer.source,mimeType:viewer.mimeType,title:viewer.title,onClose:()=>setViewer(null)}));
    }

    return h(React.Fragment,null,
      hiddenInput,
      alert,
      h('div',{style:{display:'flex',flexDirection:'column',gap:compact?9:11}},requirements.map((req)=>{
        const type=req.document_type||req,doc=newest(documents,type.id),available=physicalAvailable(doc),accepted=!!(doc&&ACCEPTED.has(doc.status)),missingObject=!!(doc&&!available),baseState=documentState(doc),state=missingObject?{fg:'#B0002A',bg:'#FCE9EE',label:'Archivo no disponible',icon:'info'}:baseState||{fg:'#B0002A',bg:'#FCE9EE',label:'Documento requerido',icon:'upload'},capabilities=sourceCapabilities(type),canUpload=capabilities.any&&(!!editable||!doc||['REJECTED','REUPLOAD_REQUIRED'].includes(doc.status)),isBusy=!!(busy&&busy.id===type.id),canView=accepted&&available;
        return h('div',{key:type.id,'data-document-type':type.code,'data-document-type-id':type.id,'data-document-status':doc?doc.status:'MISSING','data-document-availability':doc&&doc.availability||'MISSING',style:{background:'var(--surface)',borderRadius:16,padding:compact?'11px 12px':'13px 14px',boxShadow:'var(--neo-sm)'}},
          h('div',{style:{display:'flex',alignItems:'center',gap:12}},
            h('div',{style:{width:44,height:44,borderRadius:13,background:state.bg,color:state.fg,display:'grid',placeItems:'center',flexShrink:0}},h(I,{name:type.icon||'doc',size:22,stroke:1.9})),
            h('div',{style:{flex:1,minWidth:0}},
              h('div',{style:{fontSize: 'var(--text-14, 14px)',fontWeight:800}},type.label),
              h('div',{style:{display:'flex',alignItems:'center',gap:5,fontSize: 'var(--text-11-8, 11.8px)',fontWeight:700,color:state.fg,marginTop:2}},h(I,{name:isBusy?'clock':state.icon,size:13,stroke:2.1}),isBusy?phaseLabel(type):state.label),
              doc&&doc.review_observation&&h('div',{style:{fontSize: 'var(--text-11, 11px)',color:'#9B2743',marginTop:3}},doc.review_observation)),
            canView&&h('button',{type:'button','aria-label':'Ver '+type.label,disabled:isBusy,onClick:()=>open(doc,type),style:{width:38,height:38,borderRadius:11,border:'1px solid var(--hairline-strong)',background:'#fff',display:'grid',placeItems:'center',color:'var(--ink-3)'}},h(I,{name:'eye',size:18,stroke:2}))),
          canUpload&&h('div',{style:{display:'flex',gap:7,marginTop:10,flexWrap:'wrap'}},actionButton(doc?'Reemplazar':'Adjuntar','upload',()=>setOrigin({type,replacing:!!doc}),isBusy,doc?'replace':'upload'),doc&&editable&&window.DocumentIntegration&&window.DocumentIntegration.enabled()&&actionButton('Retirar','trash',()=>retire(doc,type),isBusy,'retire')));
      })),originSheet,cameraSheet,viewer&&viewer.context===resourceContext&&h(window.DocumentViewer,{source:viewer.source,mimeType:viewer.mimeType,title:viewer.title,onClose:()=>setViewer(null)}));
  }

  const UNIFIED_CSS=`
    .ud-phase{color:var(--ink);font-family:var(--font);}.ud-title{margin:0 0 4px;font-size:var(--text-21, 21px);line-height:1.18;font-weight:900}.ud-sub{margin:0 0 14px;color:var(--ink-3);font-size:var(--text-12-5, 12.5px);line-height:1.45}.ud-tracker{background:#fff;border-radius:18px;padding:14px 15px;box-shadow:var(--neo-sm);margin-bottom:18px}.ud-head{display:flex;justify-content:space-between;gap:12px;align-items:center;font-size:var(--text-13, 13px);font-weight:850}.ud-count{color:var(--guinda)}.ud-segments{display:grid;grid-template-columns:repeat(var(--ud-total),1fr);gap:5px;margin:10px 0}.ud-segments i{height:5px;border-radius:99px;background:#E8E8ED}.ud-segments i.on{background:var(--guinda)}.ud-help{font-size:var(--text-11-5, 11.5px);color:var(--ink-3);font-weight:650}.ud-chips{display:flex;gap:6px;overflow:auto;padding-top:9px}.ud-chip{white-space:nowrap;border:0;border-radius:99px;background:#FCE9EE;color:#A00027;padding:6px 9px;font-size:var(--text-10-5, 10.5px);font-weight:800}.ud-section-title{display:flex;gap:7px;align-items:center;margin:0 0 11px;font-size:var(--text-14, 14px);font-weight:900}.ud-privacy{display:flex;align-items:flex-start;gap:8px;color:var(--ink-3);font-size:var(--text-11-5, 11.5px);line-height:1.45;padding:15px 4px 2px}.ud-state{background:#fff;border-radius:16px;padding:18px;font-size:var(--text-12-5, 12.5px);font-weight:700}.ud-state.err{color:#A32921}.ud-lead{margin:-3px 0 14px;color:var(--ink-2);font-size:var(--text-13-5, 13.5px);line-height:1.45;font-weight:600}.ud-lead b{color:var(--guinda);font-weight:800}.mr-doc-grid{display:grid;grid-template-columns:minmax(0,1fr);gap:12px}.mr-doc-tile{min-width:0;border-radius:20px;background:var(--surface);box-shadow:var(--neo-sm);overflow:hidden}.mr-doc-tile.is-error{box-shadow:var(--neo-sm),inset 0 0 0 1.5px var(--guinda-100)}.mr-doc-tile.is-highlighted{box-shadow:var(--neo-sm),inset 0 0 0 2px var(--guinda)}.mr-doc-main{display:flex;gap:14px;padding:14px 14px 12px}.mr-doc-pick{position:relative;flex:none;align-self:flex-start;width:76px;height:96px;aspect-ratio:76/96;padding:0;border:0;border-radius:12px;overflow:hidden;background:var(--surface-2);color:var(--ink-3);display:grid;place-items:center;box-shadow:inset 0 0 0 1px rgba(20,33,61,.06);cursor:zoom-in}.mr-doc-pick.is-empty{background:var(--surface);border:1.5px dashed var(--hairline-strong);box-shadow:none;cursor:pointer}.mr-doc-pick:disabled{cursor:default;opacity:1}.mr-doc-thumb{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}.mr-doc-zoom{position:absolute;right:5px;bottom:5px;width:24px;height:24px;border-radius:8px;background:rgba(20,33,61,.66);color:#fff;display:grid;place-items:center}.mr-doc-info{min-width:0;flex:1;display:flex;flex-direction:column;align-items:flex-start;gap:7px;padding-top:2px}.mr-doc-title{font-size:var(--text-15-5, 15.5px);font-weight:800;line-height:1.25;color:var(--ink);overflow-wrap:anywhere}.mr-doc-pill{display:inline-flex;align-items:center;gap:5px;max-width:100%;padding:4px 10px 4px 8px;border-radius:99px;font-size:var(--text-12, 12px);font-weight:800;line-height:1.3}.mr-doc-pill svg{flex:none}.mr-doc-pill.is-pend{background:#fdf4e3;color:#8a5a0b}.mr-doc-pill.is-hist{background:var(--surface-2);color:#3d4a66}.mr-doc-pill.is-ok{background:#e6f5ee;color:#12704b}.mr-doc-pill.is-bad,.mr-doc-pill.is-miss{background:var(--guinda-50);color:var(--guinda)}.mr-doc-pill.is-up{background:var(--guinda-50);color:var(--guinda)}.mr-doc-observation{align-self:stretch;margin:0;padding:8px 10px;border-radius:10px;background:var(--guinda-50);color:var(--guinda);font-size:var(--text-13, 13px);font-weight:700;line-height:1.4;overflow-wrap:anywhere}.mr-doc-meta{font-size:var(--text-12-5, 12.5px);font-weight:600;color:var(--ink-2);line-height:1.35}.mr-doc-actions{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,8.75em),1fr));gap:8px;padding:0 14px 14px;font-size:var(--text-14-5, 14.5px)}.mr-doc-actions.is-single{grid-template-columns:minmax(0,1fr)}.mr-doc-act{min-height:46px;padding:6px 10px;border:0;border-radius:14px;display:inline-flex;align-items:center;justify-content:center;gap:8px;font-family:inherit;font-size:var(--text-14-5, 14.5px);font-weight:800;letter-spacing:-.005em}.mr-doc-act svg{flex:none}.mr-doc-act:disabled{opacity:.5;cursor:default}.mr-doc-view{background:var(--surface-2);color:var(--ink)}.mr-doc-replace{background:var(--guinda-50);color:var(--guinda)}.mr-doc-upload{background:var(--grad-guinda, var(--guinda));color:#fff;box-shadow:0 8px 18px -8px rgba(145,0,34,.55)}.mr-doc-retire{display:block;width:calc(100% - 28px);min-height:40px;margin:-6px 14px 8px;border:0;border-radius:12px;background:transparent;color:var(--ink-2);font-family:inherit;font-size:var(--text-13, 13px);font-weight:750}@media(min-width:700px){.ud-phase{max-width:760px;margin:0 auto}}
  `;
  const ORIGIN_CSS=`
    .ud-origin-sub{margin:-8px 0 16px;color:var(--ink-2);font-size:var(--text-13-5, 13.5px);font-weight:600;line-height:1.4}.ud-origin-keep{margin:-10px 0 14px;color:var(--ink-3);font-size:var(--text-12, 12px);font-weight:600;line-height:1.4}.ud-origin-opt{width:100%;display:flex;align-items:center;gap:14px;margin:0 0 8px;padding:14px;border:0;border-radius:16px;background:var(--bg);color:var(--ink);font-family:inherit;text-align:left}.ud-origin-ico{flex:none;width:44px;height:44px;border-radius:13px;background:var(--surface);color:var(--guinda);display:grid;place-items:center;box-shadow:var(--neo-sm)}.ud-origin-copy{min-width:0}.ud-origin-copy b{display:block;font-size:var(--text-15, 15px);font-weight:800}.ud-origin-copy small{display:block;margin-top:2px;color:var(--ink-2);font-size:var(--text-12-5, 12.5px);font-weight:600}.ud-origin-tips{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:14px 0}.ud-origin-tips div{padding:10px 8px;border-radius:12px;background:var(--surface-2);color:var(--ink-2);text-align:center;font-size:var(--text-12, 12px);font-weight:700;line-height:1.3}.ud-origin-tips svg{display:block;margin:0 auto 5px;color:var(--ink)}.ud-origin-cancel{width:100%;min-height:48px;border:0;border-radius:14px;background:transparent;color:var(--ink-2);font-family:inherit;font-size:var(--text-15, 15px);font-weight:800}
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
      phase==='ready'&&requirements.length>0&&h('p',{className:'ud-lead'},'Toca una imagen para verla completa. Si se ve borrosa o ya cambió, usa ',h('b',null,'Reemplazar'),'.'),
      phase==='loading'&&h('div',{className:'ud-state',role:'status'},'Cargando documentos…'),
      phase==='error'&&h('div',{className:'ud-state err',role:'alert'},error||'No fue posible consultar la fuente autorizada.',' ',onRetry&&h('button',{type:'button',onClick:onRetry},'Reintentar')),
      phase==='ready'&&requirements.length===0&&h('div',{className:'ud-state'},'Este trámite no tiene documentos configurados.'),
      phase==='ready'&&requirements.length>0&&h(DocumentRequirementList,{requirements,documents,onChanged,variant:'tiles',highlightedId,editable:true,accessPurpose:accessPurpose||'SELF_SERVICE_EXPEDIENTE'}),
      h('div',{className:'ud-privacy'},h(I,{name:'lock',size:15,stroke:2}),h('span',null,'Tus archivos se envían de forma segura, permanecen privados y sólo se consultan con autorización temporal.')));
  }

  function DocumentRequestGate({scopeType,scopeKey,onState,title}){
    const identity=window.PrivateResourceDemand.useContext(),target=JSON.stringify([identity,scopeType,scopeKey]),request=useRef({sequence:0,target,ready:false});
    if(request.current.target!==target){request.current={sequence:request.current.sequence+1,target,ready:false};}
    const[state,setState]=useState({phase:'loading',requirements:[],documents:[],error:'',context:null,target:null});
    const load=React.useCallback(async(document)=>{
      const repo=window.DocumentWorkflowRepository,context=window.PrivateResourceDemand.context();
      if(request.current.target!==target||context!==identity)return;
      const sequence=++request.current.sequence;
      if(repo.isConfirmedDocument(document)){setState(current=>current.context===context&&current.target===target?Object.assign({},current,{documents:repo.mergeConfirmedDocuments(current.documents,document),phase:current.phase==='loading'?(request.current.ready?'ready':'error'):current.phase}):current);return;}
      setState(current=>current.context===context&&current.target===target?Object.assign({},current,{phase:'loading',error:''}):{phase:'loading',requirements:[],documents:[],error:'',context,target});
      try{const[requirements,documents]=await Promise.all([repo.resolveRequirements(scopeType,scopeKey),repo.listSelfDocuments('SELF_SERVICE_EXPEDIENTE')]);if(sequence!==request.current.sequence||request.current.target!==target||context!==window.PrivateResourceDemand.context())return;request.current.ready=true;setState({phase:'ready',requirements:requirements.slice(),documents:documents.slice(),error:'',context,target});}
      catch(_){if(sequence===request.current.sequence&&request.current.target===target&&context===window.PrivateResourceDemand.context()){request.current.ready=false;setState(current=>Object.assign({},current,{phase:'error',error:'No fue posible consultar los requisitos autorizados.'}));}}
    },[scopeType,scopeKey,identity]);
    useEffect(()=>{load();return()=>{request.current.sequence++;};},[load]);
    const visible=state.context===identity&&state.target===target?state:{phase:'loading',requirements:[],documents:[],error:''};
    const result=useMemo(()=>{const required=visible.requirements.filter((row)=>row.required!==false),selected=visible.requirements.map((row)=>newest(visible.documents,row.document_type_id)).filter((doc)=>doc&&ACCEPTED.has(doc.status)&&physicalAvailable(doc));return{phase:visible.phase,ready:visible.phase==='ready'&&required.every((row)=>selected.some((doc)=>doc.document_type_id===row.document_type_id)),documentIds:selected.map((doc)=>doc.id),missing:visible.phase==='ready'?Math.max(0,required.length-selected.filter((doc)=>required.some((row)=>row.document_type_id===doc.document_type_id)).length):null};},[visible]);
    useEffect(()=>{if(onState)onState(result);},[result.phase,result.ready,result.missing,result.documentIds.join('|')]);
    return h(UnifiedDocumentPhase,{requirements:visible.requirements,documents:visible.documents,onChanged:load,phase:visible.phase,error:visible.error,onRetry:load,accessPurpose:'SELF_SERVICE_EXPEDIENTE',title:title||'Verifica tus documentos'});
  }

  function useDocuments(){
    const identity=window.PrivateResourceDemand.useContext(),request=useRef({sequence:0,context:identity,ready:false});
    if(request.current.context!==identity){request.current={sequence:request.current.sequence+1,context:identity,ready:false};}
    const[state,setState]=useState({phase:'loading',types:[],docs:[],error:null,context:null});
    const load=React.useCallback(async(document)=>{
      const repo=window.DocumentWorkflowRepository,context=window.PrivateResourceDemand.context();
      if(context!==identity)return;
      const sequence=++request.current.sequence;
      if(repo.isConfirmedDocument(document)){setState(current=>current.context===context?Object.assign({},current,{docs:repo.mergeConfirmedDocuments(current.docs,document),phase:current.phase==='loading'?(request.current.ready?'ready':'error'):current.phase}):current);return;}
      setState(current=>current.context===context?Object.assign({},current,{phase:'loading',error:null}):{phase:'loading',types:[],docs:[],error:null,context});
      try{
        const[types,docs]=await Promise.all([repo.catalog(),repo.listSelfDocuments('SELF_SERVICE_EXPEDIENTE')]);
        if(sequence!==request.current.sequence||context!==window.PrivateResourceDemand.context())return;
        request.current.ready=true;setState({phase:'ready',types,docs,error:null,context});
      }catch(error){
        if(sequence===request.current.sequence&&context===window.PrivateResourceDemand.context()){request.current.ready=false;setState(current=>Object.assign({},current,{phase:'error',error}));}
      }
    },[identity]);
    useEffect(()=>{load();return()=>{request.current.sequence++;};},[load]);
    return[state.context===identity?state:{phase:'loading',types:[],docs:[],error:null},load];
  }

  function DocumentosScreen({app}){
    const[state,load]=useDocuments(),requirements=useMemo(()=>state.types.filter((t)=>t.required_by_default),[state.types]);
    const verified=requirements.filter((t)=>{const d=newest(state.docs,t.id);return d&&d.status==='VERIFIED'&&physicalAvailable(d);}).length;
    return h('div',{'data-document-authority':'supabase','data-document-phase':state.phase,style:{position:'absolute',inset:0,background:'var(--bg)',display:'flex',flexDirection:'column'}},
      h('div',{style:{display:'flex',alignItems:'center',gap:6,padding:'8px 12px',background:'var(--surface)',borderBottom:'1px solid var(--hairline)'}},h('button',{onClick:app.back,style:{width:40,height:40,borderRadius:12,border:'none',background:'transparent',display:'grid',placeItems:'center'}},h(I,{name:'arrowL',size:22,stroke:2})),h('span',{style:{fontSize: 'var(--text-16-5, 16.5px)',fontWeight:800}},'Mis Documentos')),
      h('div',{className:'su-app-scroll su-route',style:{flex:1,overflowY:'auto',padding:16}},
        h('div',{style:{background:'linear-gradient(135deg,#16322a,#0f4536)',borderRadius:20,padding:18,color:'#fff',display:'flex',gap:14,alignItems:'center'}},h('div',{style:{width:48,height:48,borderRadius:14,background:'rgba(255,255,255,.14)',display:'grid',placeItems:'center'}},h(I,{name:'shield',size:26,stroke:2})),h('div',null,h('div',{style:{fontSize: 'var(--text-15, 15px)',fontWeight:800}},'Tus documentos están protegidos'),h('div',{style:{fontSize: 'var(--text-12-2, 12.2px)',opacity:.82,fontWeight:600,marginTop:2,lineHeight:1.45}},'Cifrado de extremo a extremo. Solo el comité autorizado puede verlos.'))),
        h('div',{style:{background:'var(--surface)',borderRadius:18,padding:16,marginTop:16,boxShadow:'var(--neo-sm)'}},h('div',{style:{display:'flex',justifyContent:'space-between',marginBottom:10}},h('span',{style:{fontSize: 'var(--text-14-5, 14.5px)',fontWeight:800}},'Expediente completo'),h('span',{'data-document-count':verified+'/'+requirements.length,style:{fontSize: 'var(--text-14-5, 14.5px)',fontWeight:800,color:'var(--guinda)'}},state.phase==='ready'?verified+' / '+requirements.length:'—')),h(window.ProgressBar,{value:requirements.length?verified/requirements.length*100:0,height:10}),h('div',{style:{fontSize: 'var(--text-12-3, 12.3px)',color:'var(--ink-3)',fontWeight:600,marginTop:9}},state.phase!=='ready'?(state.phase==='error'?'No fue posible consultar tu expediente.':'Consultando el expediente autorizado…'):requirements.length-verified>0?'Te faltan '+(requirements.length-verified)+' documentos por verificar.':'Tu expediente está verificado.')),
        h('div',{style:{marginTop:20}},h(window.SectionHead,{title:'Documentos requeridos',icon:'folder'}),state.phase==='loading'&&h('div',{role:'status'},'Cargando documentos…'),state.phase==='error'&&h('div',{role:'alert',style:{background:'#fff',borderRadius:16,padding:18,color:'#A32921',fontWeight:700}},'No fue posible consultar la fuente autorizada. ',h('button',{onClick:load},'Reintentar')),state.phase==='ready'&&h(DocumentRequirementList,{requirements,documents:state.docs,onChanged:load,editable:true,accessPurpose:'SELF_SERVICE_EXPEDIENTE'}))));
  }
  window.DocumentRequirementList=DocumentRequirementList;
  window.UnifiedDocumentPhase=UnifiedDocumentPhase;
  window.DocumentRequestGate=DocumentRequestGate;

  function DocumentEvidencePanel({contextId,source='REQUEST',mode='SELF_SERVICE',rows:provided}){
    const [rows,setRows]=useState(provided||null),[error,setError]=useState(''),[viewer,setViewer]=useState(null),[busy,setBusy]=useState(null);
    const identity=window.PrivateResourceDemand.useContext();
    useEffect(()=>{let alive=true;setViewer(null);setError('');setRows(provided||null);if(!provided)window.DocumentIntegration.evidence(contextId,source,mode).then(r=>{if(alive)setRows(r);}).catch(()=>{if(alive)setError('No fue posible consultar la evidencia documental.');});return()=>{alive=false;};},[contextId,source,mode,identity,provided]);
    const open=async row=>{const before=window.PrivateResourceDemand.context();setBusy(row.id);setError('');try{const result=await window.DocumentWorkflowRepository.historicalPreview(row.id,source,mode);if(before===window.PrivateResourceDemand.context())setViewer({source:result.signedUrl,mimeType:result.mimeType||row.mimeType,title:row.document_type?.label||'Documento',context:before});}catch(_){if(before===window.PrivateResourceDemand.context())setError('No fue posible abrir el archivo original. Reintenta.');}finally{setBusy(null);}};
    return h('section',{'data-document-evidence':source,style:{marginTop:18}},h(window.SectionHead,{title:'Documentos de la solicitud',icon:'folder'}),error&&h('p',{role:'alert'},error),!rows&&!error&&h('p',{role:'status'},'Cargando documentos…'),rows&&rows.length===0&&h('p',null,'Sin documentos asociados.'),(rows||[]).map(row=>h('button',{key:row.id,type:'button','data-association-id':row.id,onClick:()=>open(row),disabled:busy===row.id,style:{display:'flex',gap:10,alignItems:'center',width:'100%',padding:14,border:'1px solid var(--hairline)',borderRadius:12,background:'var(--surface)',color:'var(--ink)',marginBottom:8}},h(I,{name:row.mimeType==='application/pdf'?'doc':'image',size:20}),row.document_type?.label||'Documento',busy===row.id?' · Abriendo…':'')),viewer&&viewer.context===identity&&h(window.DocumentViewer,{...viewer,onClose:()=>setViewer(null)}));
  }

  function DocumentSupportSelector({value,onChange,disabled}){
    const identity=window.PrivateResourceDemand.useContext(),[state,setState]=useState({phase:'loading',rows:[]});
    useEffect(()=>{let alive=true;setState({phase:'loading',rows:[]});Promise.all([window.DocumentWorkflowRepository.listSelfDocuments('SELF_SERVICE_EXPEDIENTE'),window.DocumentWorkflowRepository.catalog()]).then(([rows,types])=>{if(alive)setState({phase:'ready',rows:rows.filter(d=>ACCEPTED.has(d.status)&&physicalAvailable(d)).map(d=>({...d,label:types.find(t=>t.id===d.document_type_id)?.label||'Documento'}))});}).catch(()=>{if(alive)setState({phase:'error',rows:[]});});return()=>{alive=false;};},[identity]);
    return h('label',{style:{display:'grid',gap:8,margin:'12px 0'}},'Documento de soporte (opcional)',state.phase==='error'?h('span',{role:'alert'},'No fue posible consultar los documentos de tu expediente.'):h('select',{'aria-label':'Documento de soporte',value:value||'',disabled:disabled||state.phase!=='ready',onChange:e=>onChange(e.target.value||null)},h('option',{value:''},state.phase==='loading'?'Cargando…':'Sin documento de soporte'),state.rows.map(d=>h('option',{key:d.id,value:d.id},d.label))));
  }
  window.DocumentSupportSelector=DocumentSupportSelector;


  function ArchivedDocumentEvidence({mode='SELF_SERVICE'}){
    const identity=window.PrivateResourceDemand.useContext(),[rows,setRows]=useState(null),[error,setError]=useState(''),[selected,setSelected]=useState(null);
    useEffect(()=>{let alive=true;setSelected(null);setRows(null);setError('');window.SutiSupabase.getClient().rpc('list_archived_document_contexts',{p_mode:mode}).then(r=>{if(!alive)return;if(r.error)setError('No fue posible consultar los documentos archivados.');else setRows(r.data||[]);});return()=>{alive=false;};},[identity,mode]);
    if(!error&&(!rows||!rows.length))return null;
    return h('section',{'data-archived-document-evidence':'',style:{marginTop:18}},h(window.SectionHead,{title:'Solicitudes archivadas',icon:'folder'}),error&&h('p',{role:'alert'},error),(rows||[]).map(row=>h('div',{key:row.id},h('button',{type:'button',onClick:()=>setSelected(selected===row.id?null:row.id),style:{padding:12,width:'100%',borderRadius:12,background:'var(--surface)',border:'1px solid var(--hairline)',color:'var(--ink)',textAlign:'left'}},row.label),selected===row.id&&h(DocumentEvidencePanel,{contextId:row.id,source:row.source,mode}),selected===row.id&&(mode==='ADMIN'||row.source==='SAVINGS')&&h(window.GeneratedDocuments,{domain:row.source==='SAVINGS'?'savings':'program',operationId:row.id,admin:mode==='ADMIN'}))));
  }
  window.ArchivedDocumentEvidence=ArchivedDocumentEvidence;

  window.DocumentEvidencePanel=DocumentEvidencePanel;

  window.DocumentosScreen=DocumentosScreen;
})();
