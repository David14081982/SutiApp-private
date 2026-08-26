/* H-009 real Supabase CRUD for public visual/company/document content. */
(function(){
  'use strict';
  const I=window.Icon;
  const inputStyle={width:'100%',border:'none',outline:'none',background:'var(--surface-2)',boxShadow:'var(--neo-inset)',borderRadius:12,padding:'11px 13px',fontSize:14,fontWeight:600,fontFamily:'inherit',color:'var(--ink)',boxSizing:'border-box'};
  const labelStyle={display:'block',fontSize:12,fontWeight:850,color:'var(--ink-2)',marginBottom:10};
  const configs={
    banners:{title:'Banners',singular:'banner',icon:'image',permission:'banners.write',imageField:'image_asset_id',bucket:'app-assets',assetType:'BANNER',defaults:{placement:'home',title:'',description:'',action_label:'',action_url:'',image_asset_id:null,enabled:false},required:['title','image_asset_id']},
    popups:{title:'Pop-ups',singular:'pop-up',icon:'message',permission:'popups.write',imageField:'image_asset_id',bucket:'app-assets',assetType:'POPUP',defaults:{title:'',body:'',action_label:'',action_url:'',image_asset_id:null,enabled:false},required:['title']},
    companies:{title:'Empresas',singular:'empresa',icon:'tag',permission:'companies.write',imageField:'logo_asset_id',bucket:'company-assets',assetType:'COMPANY',defaults:{display_name:'',description:'',logo_asset_id:null,cover_asset_id:null,enabled:true},required:['display_name']},
    documents:{title:'Documentos y PDF',singular:'documento',icon:'doc',permission:'documents.write',imageField:'document_asset_id',bucket:'documents',assetType:'DOCUMENT',defaults:{kind:'download',title:'',description:'',document_asset_id:null,enabled:true},required:['title','document_asset_id']},
    education:{title:'Educación y tutoriales',singular:'recurso',icon:'book',permission:'content.write',imageField:'image_asset_id',bucket:'app-assets',assetType:'EDUCATIONAL_IMAGE',defaults:{resource_kind:'education',title:'',description:'',external_url:'',image_asset_id:null,document_asset_id:null,published:false},required:['title']},
    minutes:{title:'Minutas',singular:'minuta',icon:'doc',imageField:'document_asset_id',bucket:'documents',assetType:'MINUTES_DOCUMENT',defaults:{title:'',description:'',source_date_raw:'',published_on:null,document_asset_id:null,image_asset_id:null,enabled:false},required:['title']},
    programs:{title:'Programas institucionales',singular:'programa',icon:'fist',imageField:'primary_image_asset_id',bucket:'app-assets',assetType:'PROGRAM_IMAGE',defaults:{category:'',description:'',phone_raw:'',location_raw:'',primary_image_asset_id:null,enabled:false},required:['category']},
    directory:{title:'Comité Ejecutivo',singular:'integrante',icon:'fist',permission:'documents.write',imageField:'image_asset_id',bucket:'app-assets',assetType:'DIRECTORY_MEMBER_IMAGE',defaults:{name:'',role:'',image_asset_id:null,enabled:false},required:['name','role']},
  };
  function field(label,name,form,setForm,options){
    const props={'data-h009-field':name,value:form[name]||'',onChange:(e)=>{const value=e.target.value;setForm((old)=>Object.assign({},old,{[name]:value}));},style:inputStyle};
    return React.createElement('label',{style:labelStyle},label,options
      ?React.createElement('select',Object.assign({},props,{style:Object.assign({},inputStyle,{marginTop:6})}),options.map((o)=>React.createElement('option',{key:o[0],value:o[0]},o[1])))
      :React.createElement(name==='description'||name==='body'?'textarea':'input',Object.assign({},props,{rows:3,style:Object.assign({},inputStyle,{marginTop:6,resize:'vertical'})})));
  }
  function AssetPicker({label,url,accept,onFile,busy}){
    const ref=React.useRef(null);
    return React.createElement('div',{style:{marginBottom:12}},React.createElement('div',{style:labelStyle},label),
      React.createElement('div',{style:{height:120,borderRadius:14,background:'var(--surface-2)',boxShadow:'var(--neo-inset)',display:'grid',placeItems:'center',overflow:'hidden'}},url
        ?React.createElement(url.toLowerCase().includes('.pdf')?'div':'img',url.toLowerCase().includes('.pdf')?{style:{fontSize:13,fontWeight:850,color:'var(--guinda)'}}:{src:url,alt:'',style:{width:'100%',height:'100%',objectFit:'contain'}},url.toLowerCase().includes('.pdf')?'PDF configurado':null)
        :React.createElement('div',{style:{color:'var(--ink-3)',fontSize:12,fontWeight:750}},'Sin archivo')),
      React.createElement('input',{ref,type:'file',accept,onChange:(e)=>{const file=e.target.files&&e.target.files[0];if(file)onFile(file);e.target.value='';},disabled:busy,style:{display:'none'}}),
      React.createElement('button',{type:'button',disabled:busy,onClick:()=>ref.current.click(),style:{width:'100%',marginTop:7,border:'none',borderRadius:10,padding:9,background:'var(--guinda)',color:'#fff',fontWeight:850}},busy?'Subiendo…':url?'Reemplazar':'Subir'));
  }
  function Editor({kind,item,app,onDone,onCancel,sectionKey,filterKinds}){
    const cfg=configs[kind];const [form,setForm]=React.useState(()=>Object.assign({},cfg.defaults,filterKinds&&filterKinds.length?{kind:filterKinds[0]}:{},item||{}));const[busy,setBusy]=React.useState(false);const[pending,setPending]=React.useState({});const pendingRef=React.useRef({});
    const remember=async(key,asset)=>{if(pendingRef.current[key])await window.AdminRepository.discardAsset(pendingRef.current[key]);pendingRef.current=Object.assign({},pendingRef.current,{[key]:asset});setPending(pendingRef.current);};
    const committed=(keys)=>{const next=Object.assign({},pendingRef.current);keys.forEach((key)=>delete next[key]);pendingRef.current=next;setPending(next);};
    const upload=async(key,file,bucket,type)=>{setBusy(true);try{const asset=await window.AdminRepository.uploadManagedAsset(file,bucket,type,`${kind}.${key}`);await remember(key,asset);setForm((old)=>Object.assign({},old,{[key]:asset.id,[key.replace('_asset_id','_url')]:asset.url}));}catch(_){app.toast('No fue posible subir el archivo');}finally{setBusy(false);}};
    const cancel=async()=>{setBusy(true);await Promise.all(Object.values(pendingRef.current).map((asset)=>window.AdminRepository.discardAsset(asset)));pendingRef.current={};onCancel();};
    const save=async()=>{
      if(cfg.required.some((key)=>!form[key]))return app.toast('Completa los campos y archivos requeridos');
      if(kind==='popups'&&form.enabled&&!String(form.body||'').trim())return app.toast('Un pop-up activo requiere contenido');
      setBusy(true);try{
        const saved=await window.AdminRepository.saveManaged(kind,form);const id=form.id||saved.id;if(!form.id)setForm((old)=>Object.assign({},old,{id}));
        committed(Object.keys(pendingRef.current).filter((key)=>key!=='cover_asset_id'));
        if(kind==='companies'&&form.cover_asset_id){await window.AdminRepository.replaceCompanyAsset(id,form.cover_asset_id,'cover');committed(['cover_asset_id']);}
        app.toast('Cambios guardados');await onDone();
      }catch(_){app.toast('No fue posible guardar los cambios');}finally{setBusy(false);}
    };
    const imageUrl=form.image_url||form.logo_url||null;
    return React.createElement('div',{'data-h009-editor':kind,style:{position:'absolute',inset:0,zIndex:30,background:'var(--bg)',display:'flex',flexDirection:'column'}},
      React.createElement('div',{style:{display:'flex',alignItems:'center',gap:8,padding:'10px 14px',background:'var(--header-bg, var(--grad-guinda))',color:'#fff'}},
        React.createElement('button',{onClick:cancel,disabled:busy,'aria-label':'Volver',style:{width:40,height:40,border:'none',borderRadius:12,background:'rgba(255,255,255,.16)',color:'#fff'}},React.createElement(I,{name:'arrowL',size:21})),
        React.createElement('div',{style:{fontSize:18,fontWeight:900}},form.id?'Editar '+cfg.singular:'Crear '+cfg.singular)),
      React.createElement('div',{className:'su-app-scroll',style:{padding:16,flex:1}},
        kind==='banners'&&field('Ubicación','placement',form,setForm,[['home','Inicio'],['marketplace','Marketplace']]),
        kind==='companies'&&field('Nombre visible','display_name',form,setForm),
        kind==='directory'&&field('Nombre','name',form,setForm),
        kind==='directory'&&field('Cargo','role',form,setForm),
        kind!=='companies'&&kind!=='programs'&&kind!=='directory'&&field('Título','title',form,setForm),
        kind==='programs'&&field('Nombre del programa','category',form,setForm),
        kind==='popups'&&field('Contenido','body',form,setForm),
        kind!=='popups'&&kind!=='directory'&&field('Descripción','description',form,setForm),
        (kind==='banners'||kind==='popups')&&field('Texto de acción','action_label',form,setForm),
        (kind==='banners'||kind==='popups')&&field('URL de acción','action_url',form,setForm),
        kind==='documents'&&field('Tipo','kind',form,setForm,[['download','Descarga'],['form','Formato'],['regulation','Norma o reglamento']].filter((option)=>!filterKinds||filterKinds.includes(option[0]))),
        kind==='education'&&field('Tipo','resource_kind',form,setForm,[['education','Información educativa'],['tutorial','Tutorial']]),
        kind==='education'&&field('Enlace HTTPS','external_url',form,setForm),
        kind!=='documents'&&kind!=='minutes'&&window.AdminRepository.has(sectionKey+'.assets')&&React.createElement(AssetPicker,{label:kind==='companies'?'Logo':'Imagen',url:imageUrl,accept:'image/png,image/jpeg,image/gif,image/webp,image/svg+xml',busy,onFile:(file)=>upload(cfg.imageField,file,cfg.bucket,cfg.assetType)}),
        kind==='companies'&&React.createElement(AssetPicker,{label:'Portada',url:form.cover_url||null,accept:'image/png,image/jpeg,image/gif,image/webp,image/svg+xml',busy,onFile:(file)=>upload('cover_asset_id',file,'company-assets','COMPANY')}),
        (kind==='documents'||kind==='minutes')&&window.AdminRepository.has(sectionKey+'.assets')&&React.createElement(AssetPicker,{label:'Archivo PDF',url:form.document_url||null,accept:'application/pdf',busy,onFile:(file)=>upload('document_asset_id',file,'documents','DOCUMENT')}),
        window.AdminRepository.has(sectionKey+'.publish')&&React.createElement('label',{style:{display:'flex',alignItems:'center',gap:9,fontSize:13,fontWeight:800,margin:'13px 0'}},React.createElement('input',{type:'checkbox',checked:!!(kind==='education'?form.published:form.enabled),onChange:(e)=>setForm(Object.assign({},form,{[kind==='education'?'published':'enabled']:e.target.checked}))}),'Publicado / activo'),
        React.createElement('button',{'data-h009-save':kind,onClick:save,disabled:busy,style:{width:'100%',border:'none',borderRadius:13,padding:13,background:'var(--guinda)',color:'#fff',fontWeight:900}},busy?'Guardando…':'Guardar')));
  }
  function VisualCrudModule({kind,app,onBack,header,filterKinds,title}){
    const cfg=configs[kind];const[items,setItems]=React.useState([]);const[phase,setPhase]=React.useState('loading');const[editing,setEditing]=React.useState(null);const[educationKind,setEducationKind]=React.useState(()=>kind==='education'&&!window.AdminRepository.has('education.read')?'tutorial':'education');
    const load=async()=>{setPhase('loading');try{setItems(await window.AdminRepository.listManaged(kind));setPhase('loaded');}catch(_){setPhase('error');}};
    React.useEffect(()=>{load();},[kind]);
    const refreshConsumers=async()=>{await load();if(app.visual&&app.visual.retry)await app.visual.retry();if(app.institutional&&app.institutional.retry)await app.institutional.retry();setEditing(null);};
    const toggle=async(item)=>{const active=kind==='education'?item.published:item.enabled;try{await window.AdminRepository.setEnabled(kind,item.id,!active);await refreshConsumers();app.toast(active?'Contenido desactivado':'Contenido activado');}catch(_){app.toast('No fue posible cambiar el estado');}};
    const move=async(list,index,delta)=>{const next=list.map((item)=>item.id);const target=index+delta;if(target<0||target>=next.length)return;const hold=next[index];next[index]=next[target];next[target]=hold;try{await window.AdminRepository.reorderManaged(kind,next);await refreshConsumers();}catch(_){app.toast('No fue posible cambiar el orden');}};
    const sectionKey=kind==='education'?(educationKind==='tutorial'?'tutorials':'education'):kind==='directory'?'documents':kind;
    const can=(action)=>window.AdminRepository.has(sectionKey+'.'+action);
    const deletable=(item)=>kind==='education'?item.provenance==='ADMIN_PHASE2':['ADMIN_H009','ADMIN_SECTION_ROLLOUT'].includes(item.record_origin);
    const remove=async(item)=>{if(!deletable(item))return;if(!window.confirm('¿Eliminar definitivamente este contenido? Esta acción no se puede deshacer.'))return;try{await window.AdminRepository.removeManaged(kind,item.id);await refreshConsumers();app.toast('Contenido eliminado');}catch(_){app.toast('No fue posible eliminar el contenido');}};
    const shown=kind==='education'?items.filter((item)=>item.resource_kind===educationKind):filterKinds&&filterKinds.length?items.filter((item)=>filterKinds.includes(item.kind)):items;
    const sectionTitle=title||(kind==='education'?(educationKind==='education'?'Información educativa':'Tutoriales'):cfg.title);
    return React.createElement('div',{'data-h009-module':kind,'data-h009-state':phase,'data-education-section':kind==='education'?educationKind:undefined},header({title:sectionTitle,sub:'Contenido administrable de la aplicación',onBack}),
      React.createElement('div',{className:'su-app-scroll',style:{padding:16}},
        React.createElement(window.SectionResponsibilityPanel,{sectionKey,allowedActions:['read','create','update','delete','publish','order','assets'],app}),
        kind==='education'&&React.createElement('div',{'data-education-admin-tabs':'',style:{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:12}},[['education','Educación'],['tutorial','Tutoriales']].filter(([value])=>window.AdminRepository.has((value==='tutorial'?'tutorials':'education')+'.read')).map(([value,label])=>React.createElement('button',{key:value,onClick:()=>setEducationKind(value),'aria-pressed':educationKind===value,style:{border:'none',borderRadius:12,padding:10,background:educationKind===value?'var(--guinda)':'var(--surface-2)',color:educationKind===value?'#fff':'var(--ink-2)',fontWeight:850}},label))),
        can('create')&&React.createElement('button',{'data-h009-create':kind,onClick:()=>setEditing(kind==='education'?{resource_kind:educationKind}:{}),style:{width:'100%',border:'none',borderRadius:14,padding:12,background:'var(--grad-guinda-soft)',color:'#fff',fontWeight:900,marginBottom:14}},'+ Crear '+(kind==='education'?(educationKind==='education'?'recurso educativo':'tutorial'):cfg.singular)),
        phase==='error'&&React.createElement(window.EmptyState,{icon:'alert',title:'No pudimos cargar el contenido',action:React.createElement(window.Btn,{onClick:load},'Reintentar')}),
        phase==='loading'&&React.createElement('div',{className:'su-skeleton',style:{height:110,borderRadius:16}}),
        phase==='loaded'&&React.createElement('div',{style:{display:'flex',flexDirection:'column',gap:11}},shown.map((item,index)=>{const active=kind==='education'?item.published:item.enabled;return React.createElement('article',{key:item.id,'data-h009-item':kind,'data-h009-id':item.id,style:{display:'flex',gap:12,alignItems:'center',background:'var(--surface)',borderRadius:16,padding:12,boxShadow:'var(--neo-sm)',opacity:active?1:.62}},
          (item.image_url||item.logo_url||item.cover_url)&&React.createElement('img',{src:item.image_url||item.logo_url||item.cover_url,alt:'',style:{width:58,height:58,borderRadius:12,objectFit:'cover',background:'var(--surface-2)'}}),
          React.createElement('div',{style:{flex:1,minWidth:0}},React.createElement('div',{style:{fontSize:14.5,fontWeight:850}},item.title||item.display_name||'Sin título'),React.createElement('div',{style:{fontSize:11.5,fontWeight:700,color:active?'#13794A':'var(--ink-3)',marginTop:3}},active?'ACTIVO':'INACTIVO')),
          can('publish')&&React.createElement('button',{onClick:()=>toggle(item),'aria-label':active?'Desactivar':'Activar',style:{border:'none',borderRadius:10,padding:9,background:'var(--surface-2)',color:'var(--ink-2)'}},React.createElement(I,{name:active?'power':'checkCircle',size:18})),
          can('order')&&React.createElement('button',{onClick:()=>move(shown,index,-1),disabled:index===0,'aria-label':'Subir',style:{border:'none',borderRadius:10,padding:9,background:'var(--surface-2)',color:'var(--ink-2)'}},React.createElement(I,{name:'chevU',size:18})),
          can('order')&&React.createElement('button',{onClick:()=>move(shown,index,1),disabled:index===shown.length-1,'aria-label':'Bajar',style:{border:'none',borderRadius:10,padding:9,background:'var(--surface-2)',color:'var(--ink-2)'}},React.createElement(I,{name:'chevD',size:18})),
          can('delete')&&deletable(item)&&React.createElement('button',{onClick:()=>remove(item),'aria-label':'Eliminar',style:{border:'none',borderRadius:10,padding:9,background:'#FDEAEA',color:'#C0341D'}},React.createElement(I,{name:'trash',size:18})),
          can('update')&&React.createElement('button',{onClick:()=>setEditing(item),'aria-label':'Editar',style:{border:'none',borderRadius:10,padding:9,background:'var(--guinda-50)',color:'var(--guinda)'}},React.createElement(I,{name:'edit',size:18}))) }),
          shown.length===0&&React.createElement(window.EmptyState,{icon:cfg.icon,title:'Sin '+sectionTitle.toLowerCase()}))),
      editing&&React.createElement(Editor,{kind,item:editing.id?editing:null,app,onDone:refreshConsumers,onCancel:()=>setEditing(null),sectionKey,filterKinds}));
  }
  window.VisualCrudModule=VisualCrudModule;
})();
