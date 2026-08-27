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
  const ACCEPTED=new Set(['PENDING_REVIEW','UNDER_REVIEW','VERIFIED']);
  const newest=(docs,typeId)=>docs.filter((d)=>d.document_type_id===typeId).sort((a,b)=>new Date(b.created_at)-new Date(a.created_at))[0]||null;

  function DocumentRequirementList({requirements,documents,onChanged,compact,variant,highlightedId}){
    const[fileType,setFileType]=useState(null),input=useRef(null),[busy,setBusy]=useState(''),[error,setError]=useState('');
    const pick=(type)=>{
      setFileType(type);
      setError('');
      if(input.current){
        input.current.accept=(type.accepted_mime_types||[]).join(',');
        input.current.click();
      }
    };
    const upload=async(event)=>{
      const file=event.target.files&&event.target.files[0];
      event.target.value='';
      if(!file||!fileType)return;
      setBusy(fileType.id);
      try{
        await window.DocumentWorkflowRepository.upload(fileType,file);
        await onChanged();
      }catch(e){
        setError(e&&e.message==='VERIFIED_DOCUMENT_IMMUTABLE'
          ?'El documento verificado debe ser reabierto por Admin.'
          :'No se pudo subir el archivo. Revisa formato y tamaño.');
      }finally{
        setBusy('');
      }
    };
    const open=(doc)=>{
      if(doc&&doc.signedUrl)window.open(doc.signedUrl,'_blank','noopener,noreferrer');
    };
    const hiddenInput=h('input',{ref:input,type:'file',style:{display:'none'},onChange:upload,'aria-hidden':'true',tabIndex:-1});
    const alert=error&&h('div',{role:'alert',style:{fontSize:12,fontWeight:700,color:'#A32921',marginBottom:9}},error);

    if(variant==='tiles'){
      return h(React.Fragment,null,
        hiddenInput,
        alert,
        h('div',{className:'mr-doc-grid','data-document-grid':'membership'},requirements.map((req)=>{
          const type=req.document_type||req,doc=newest(documents,type.id),state=doc?COLORS[doc.status]:{fg:'#B0002A',bg:'#FCE9EE',label:'Pendiente',icon:'upload'};
          const accepted=!!(doc&&ACCEPTED.has(doc.status)),canUpload=!doc||['REJECTED','REUPLOAD_REQUIRED'].includes(doc.status),preview=accepted&&doc.signedUrl;
          const image=!!(preview&&String(doc.mimeType||'').toLowerCase().startsWith('image/')),isBusy=busy===type.id;
          const action=canUpload?'upload':preview?'preview':'unavailable';
          const actionCopy=canUpload?(doc?'Reemplazar':'Adjuntar'):state.label;
          const hint=type.description||state.label;
          const classes=['mr-doc-tile',accepted?'is-filled':'',highlightedId===type.id&&!accepted?'is-highlighted':'',doc&&['REJECTED','REUPLOAD_REQUIRED'].includes(doc.status)?'is-error':''].filter(Boolean).join(' ');
          const act=()=>{if(canUpload)pick(type);else if(preview)open(doc);};
          return h('article',{key:type.id,className:classes,'data-document-type':type.code,'data-document-type-id':type.id,'data-document-status':doc?doc.status:'MISSING','data-document-required':req.required===false?'false':'true'},
            h('button',{type:'button',className:'mr-doc-pick',disabled:isBusy||action==='unavailable',onClick:act,'data-document-action':action,'aria-label':(canUpload?(doc?'Reemplazar ':'Adjuntar '):preview?'Ver ':'Vista no disponible de ')+type.label},
              image&&h('img',{className:'mr-doc-thumb',src:doc.signedUrl,alt:'',loading:'lazy'}),
              accepted&&h('span',{className:'mr-doc-veil','aria-hidden':'true'}),
              h('span',{className:'mr-doc-badge','aria-hidden':'true'},h(I,{name:image?'doc':type.icon||'doc',size:21,stroke:1.9})),
              h('span',{className:'mr-doc-meta'},
                h('strong',null,type.label),
                h('span',{className:accepted?'mr-doc-file':'mr-doc-add'},
                  h(I,{name:isBusy?'clock':canUpload?'camera':state.icon,size:14,stroke:2.1}),
                  isBusy?'Subiendo…':actionCopy+(canUpload?' · '+hint:''))),
              accepted&&h('span',{className:'mr-doc-ok','aria-label':state.label},h(I,{name:'checkCircle',size:15,stroke:2.3}))),
            preview&&h('button',{type:'button',className:'mr-doc-view','aria-label':'Ver '+type.label,onClick:()=>open(doc)},h(I,{name:'eye',size:16,stroke:2})),
            accepted&&h('span',{className:'mr-doc-status'},state.label),
            doc&&doc.review_observation&&h('p',{className:'mr-doc-observation'},doc.review_observation));
        })));
    }

    return h(React.Fragment,null,
      hiddenInput,
      alert,
      h('div',{style:{display:'flex',flexDirection:'column',gap:compact?9:11}},requirements.map((req)=>{
        const type=req.document_type||req,doc=newest(documents,type.id),state=doc?COLORS[doc.status]:{fg:'#B0002A',bg:'#FCE9EE',label:'Pendiente',icon:'upload'},canUpload=!doc||['REJECTED','REUPLOAD_REQUIRED'].includes(doc.status);
        return h('div',{key:type.id,'data-document-type':type.code,'data-document-type-id':type.id,'data-document-status':doc?doc.status:'MISSING',style:{display:'flex',alignItems:'center',gap:12,background:'var(--surface)',borderRadius:16,padding:compact?'11px 12px':'13px 14px',boxShadow:'var(--neo-sm)'}},
          h('div',{style:{width:44,height:44,borderRadius:13,background:state.bg,color:state.fg,display:'grid',placeItems:'center',flexShrink:0}},h(I,{name:type.icon||'doc',size:22,stroke:1.9})),
          h('div',{style:{flex:1,minWidth:0}},
            h('div',{style:{fontSize:14,fontWeight:800}},type.label),
            h('div',{style:{display:'flex',alignItems:'center',gap:5,fontSize:11.8,fontWeight:700,color:state.fg,marginTop:2}},h(I,{name:state.icon,size:13,stroke:2.1}),busy===type.id?'Subiendo…':state.label),
            doc&&doc.review_observation&&h('div',{style:{fontSize:11,color:'#9B2743',marginTop:3}},doc.review_observation)),
          doc&&doc.signedUrl&&h('button',{type:'button','aria-label':'Ver '+type.label,onClick:()=>open(doc),style:{width:38,height:38,borderRadius:11,border:'1px solid var(--hairline-strong)',background:'#fff',display:'grid',placeItems:'center',color:'var(--ink-3)'}},h(I,{name:'eye',size:18,stroke:2})),
          canUpload&&h('button',{type:'button',disabled:busy===type.id,onClick:()=>pick(type),style:{minWidth:62,height:38,border:'none',borderRadius:11,background:'#fff',boxShadow:'var(--neo-sm)',color:'var(--guinda)',fontSize:12.5,fontWeight:800}},'Subir'));
      })));
  }

  function useDocuments(){
    const[state,setState]=useState({phase:'loading',types:[],docs:[],error:null});
    const load=React.useCallback(async()=>{
      setState((s)=>Object.assign({},s,{phase:'loading',error:null}));
      try{
        const[types,docs]=await Promise.all([window.DocumentWorkflowRepository.catalog(),window.DocumentWorkflowRepository.list()]);
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
    const verified=requirements.filter((t)=>{const d=newest(state.docs,t.id);return d&&d.status==='VERIFIED';}).length;
    return h('div',{'data-document-authority':'supabase','data-document-phase':state.phase,style:{position:'absolute',inset:0,background:'var(--bg)',display:'flex',flexDirection:'column'}},
      h('div',{style:{display:'flex',alignItems:'center',gap:6,padding:'8px 12px',background:'var(--surface)',borderBottom:'1px solid var(--hairline)'}},h('button',{onClick:app.back,style:{width:40,height:40,borderRadius:12,border:'none',background:'transparent',display:'grid',placeItems:'center'}},h(I,{name:'arrowL',size:22,stroke:2})),h('span',{style:{fontSize:16.5,fontWeight:800}},'Mis Documentos')),
      h('div',{className:'su-app-scroll su-route',style:{flex:1,overflowY:'auto',padding:16}},
        h('div',{style:{background:'linear-gradient(135deg,#16322a,#0f4536)',borderRadius:20,padding:18,color:'#fff',display:'flex',gap:14,alignItems:'center'}},h('div',{style:{width:48,height:48,borderRadius:14,background:'rgba(255,255,255,.14)',display:'grid',placeItems:'center'}},h(I,{name:'shield',size:26,stroke:2})),h('div',null,h('div',{style:{fontSize:15,fontWeight:800}},'Tus documentos están protegidos'),h('div',{style:{fontSize:12.2,opacity:.82,fontWeight:600,marginTop:2,lineHeight:1.45}},'Cifrado de extremo a extremo. Solo el comité autorizado puede verlos.'))),
        h('div',{style:{background:'var(--surface)',borderRadius:18,padding:16,marginTop:16,boxShadow:'var(--neo-sm)'}},h('div',{style:{display:'flex',justifyContent:'space-between',marginBottom:10}},h('span',{style:{fontSize:14.5,fontWeight:800}},'Expediente completo'),h('span',{'data-document-count':verified+'/'+requirements.length,style:{fontSize:14.5,fontWeight:800,color:'var(--guinda)'}},state.phase==='ready'?verified+' / '+requirements.length:'—')),h(window.ProgressBar,{value:requirements.length?verified/requirements.length*100:0,height:10}),h('div',{style:{fontSize:12.3,color:'var(--ink-3)',fontWeight:600,marginTop:9}},requirements.length-verified>0?'Te faltan '+(requirements.length-verified)+' documentos por verificar.':'Tu expediente está verificado.')),
        h('div',{style:{marginTop:20}},h(window.SectionHead,{title:'Documentos requeridos',icon:'folder'}),state.phase==='loading'&&h('div',{role:'status'},'Cargando documentos…'),state.phase==='error'&&h('div',{role:'alert',style:{background:'#fff',borderRadius:16,padding:18,color:'#A32921',fontWeight:700}},'No fue posible consultar la fuente autorizada. ',h('button',{onClick:load},'Reintentar')),state.phase==='ready'&&h(DocumentRequirementList,{requirements,documents:state.docs,onChanged:load}))));
  }
  window.DocumentRequirementList=DocumentRequirementList;
  window.DocumentosScreen=DocumentosScreen;
})();
