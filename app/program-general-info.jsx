/* Program catalog headers: one presentation authority shared by both Admin entrances. */
(function(){
  const h=React.createElement,{useState,useEffect}=React,I=window.Icon;
  const keys=Object.freeze(['auto','renta','casa','terrenos','solar','aires','puertas','computo','farma','cirugias','tours','market','rifas','donativos']);
  const listeners=new Set();
  const db=()=>window.SutiSupabase.getClient();
  const fields='item_key,group_key,label_override,description_override,enabled,sort_order,updated_at,program_info,program_cover_asset_id,cover:app_assets!finance_catalog_presentation_program_cover_asset_id_fkey(id,storage_bucket,storage_path,status,mime_type)';
  const coverUrl=asset=>asset&&asset.status==='READY'?db().storage.from(asset.storage_bucket).getPublicUrl(asset.storage_path).data.publicUrl:null;
  async function get(key){const r=await db().from('finance_catalog_presentation').select(fields).eq('item_key',key).single();if(r.error)throw r.error;if(!r.data.program_info)throw new Error('PROGRAM_INFO_NOT_FOUND');return {...r.data,cover_url:coverUrl(r.data.cover)};}
  async function save(row){const payload={label_override:row.label_override,description_override:row.description_override,enabled:row.enabled,program_info:row.program_info,program_cover_asset_id:row.program_cover_asset_id};const r=await db().rpc('save_program_general_info',{p_program_key:row.item_key,p_expected_updated_at:row.updated_at,p_payload:payload});if(r.error)throw r.error;listeners.forEach(fn=>fn(row.item_key));if(window.finCatStore)await window.finCatStore.refresh();return get(row.item_key);}
  async function upload(file){
    const ext={'image/png':'png','image/jpeg':'jpg','image/webp':'webp','image/gif':'gif'}[file?.type];
    if(!ext||file.size<1||file.size>10485760)throw new Error('PROGRAM_INFO_IMAGE_INVALID');
    // Unique path avoids sharing a replaceable product image. Existing Storage/RPC permissions apply.
    const user=await db().auth.getUser();if(user.error||!user.data.user)throw new Error('AUTH_REQUIRED');
    const path='program-general/'+user.data.user.id+'/'+crypto.randomUUID()+'.'+ext;
    const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await file.arrayBuffer()))).map(x=>x.toString(16).padStart(2,'0')).join('');
    const r=await db().storage.from('app-assets').upload(path,file,{upsert:false,contentType:file.type});if(r.error)throw r.error;
    const a=await db().rpc('register_program_general_cover',{p_path:path,p_mime:file.type,p_size:file.size,p_sha:hash});if(a.error)throw a.error;
    // Retain uploaded assets on ambiguous network failure; never delete a potentially committed cover.
    return {id:a.data,url:db().storage.from('app-assets').getPublicUrl(path).data.publicUrl};
  }
  function useInfo(key,refreshOnFocus=true){
    const [state,setState]=useState({key,phase:'loading',row:null}),[version,refresh]=useState(0);
    useEffect(()=>{const fn=k=>{if(k===key)refresh(v=>v+1);};listeners.add(fn);return()=>listeners.delete(fn);},[key]);
    useEffect(()=>{let active=true;setState({key,phase:'loading',row:null});if(!keys.includes(key)){setState({key,phase:'not-applicable',row:null});return;}
      get(key).then(row=>{if(active)setState({key,phase:'loaded',row});}).catch(()=>{if(active)setState({key,phase:'error',row:null});});return()=>{active=false;};},[key,version]);
    useEffect(()=>{if(!refreshOnFocus)return;const fn=()=>refresh(v=>v+1);window.addEventListener('focus',fn);return()=>window.removeEventListener('focus',fn);},[refreshOnFocus]);
    return {...(state.key===key?state:{phase:'loading',row:null}),retry:()=>refresh(v=>v+1)};
  }
  function Cover({url,icon,hue=210,children}){
    const [failed,setFailed]=useState(false);useEffect(()=>setFailed(false),[url]);
    return h('div',{'data-program-cover':url?'configured':'empty',style:{position:'relative',height:188,background:`linear-gradient(135deg, hsl(${hue} 48% 42%), hsl(${hue} 55% 26%))`,overflow:'hidden'}},
      url&&!failed&&h('img',{src:url,alt:'Portada del programa',onError:()=>setFailed(true),style:{position:'absolute',inset:0,width:'100%',height:'100%',objectFit:'cover'}}),
      h('div',{style:{position:'absolute',inset:0,background:'linear-gradient(120deg, rgba(20,8,12,.42), rgba(20,8,12,.08))',pointerEvents:'none'}}),
      h('div',{style:{position:'absolute',right:-20,bottom:-30,opacity:.16}},h(I,{name:icon,size:220,stroke:1,style:{color:'#fff'}})),
      failed&&h('span',{role:'status',style:{position:'absolute',bottom:12,left:20,color:'#fff',fontSize:'var(--text-12, 12px)'}},'No se pudo cargar la portada'),children);
  }
  function PublicHeader({row,onFavorite,favorite,notify,children}){
    const p=row.program_info;
    const contact=(kind)=>{const number=p[kind].replace(/[^+0-9]/g,'');if(!number){if(notify)notify('El programa aún no tiene un número de contacto registrado.');return;}if(kind==='phone')window.location.href='tel:'+number;else window.open('https://wa.me/'+(/^\d{10}$/.test(number)?'52'+number:number.replace(/^\+/,'')),'_blank','noopener,noreferrer');};
    const action=(icon,text,fn)=>h('button',{key:text,onClick:fn,'aria-pressed':text==='Guardar'?favorite:undefined,style:{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:6,background:'var(--guinda-50)',border:'1px solid var(--guinda-100)',borderRadius:14,padding:'11px 0',cursor:'pointer',color:'var(--guinda)'}},h(I,{name:icon,size:21,stroke:2}),h('span',{style:{fontSize:'var(--text-12, 12px)',fontWeight:700}},text));
    return h(React.Fragment,null,
      h('div',{style:{display:'flex',gap:13,alignItems:'flex-start',minWidth:0}},
        h('div',{'data-category-header-icon':'true',style:{position:'relative',zIndex:2,marginTop:-46,flexShrink:0,width:64,height:64,borderRadius:18,background:'var(--surface)',boxShadow:'var(--neo-md)',display:'grid',placeItems:'center',color:'var(--guinda)'}},h(I,{name:p.icon,size:32,stroke:1.8})),
        h('div',{style:{flex:1,minWidth:0,paddingTop:2}},h('h1',{style:{fontSize:'var(--text-23, 23px)',fontWeight:800,letterSpacing:'-.02em',margin:0}},row.label_override),h('div',{style:{fontSize:'var(--text-13-5, 13.5px)',color:'var(--ink-3)',fontWeight:600,marginTop:2}},h('span',{style:{color:'var(--guinda)'}},'SutiApp'),' / '+(p.breadcrumb||row.label_override)))),
      h('p',{'data-program-description':true,style:{fontSize:'var(--text-15, 15px)',color:'var(--ink-2)',fontWeight:500,lineHeight:1.55,margin:'16px 0 0',whiteSpace:'pre-line'}},p.description),children,
      h('div',{style:{display:'flex',gap:10,marginTop:18}},action('phone','Llamar',()=>contact('phone')),action('message','WhatsApp',()=>contact('whatsapp')),p.favorite_enabled&&action('star','Guardar',onFavorite)),
      h('div',{'data-program-benefits':true,style:{marginTop:22}},h(window.SectionHead,{title:p.benefits_title,icon:'sparkle'}),h('div',{style:{display:'flex',flexDirection:'column',gap:10}},p.benefits.map((b,i)=>h('div',{key:i,style:{display:'flex',gap:12,alignItems:'center',background:'var(--surface)',borderRadius:14,padding:'13px 14px',boxShadow:'var(--neo-sm)'}},h('div',{style:{width:38,height:38,borderRadius:11,background:'var(--guinda-50)',display:'grid',placeItems:'center',color:'var(--guinda)',flexShrink:0}},h(I,{name:b.icon,size:20,stroke:2})),h('div',null,h('div',{style:{fontSize:'var(--text-14, 14px)',fontWeight:700}},b.t),h('div',{style:{fontSize:'var(--text-12-5, 12.5px)',color:'var(--ink-3)',fontWeight:500}},b.s)))))));
  }
  function InfoState({state}){return h('div',{role:'status',style:{padding:20}},h(window.EmptyState,{icon:state.phase==='error'?'warning':'clock',title:state.phase==='error'?'No pudimos cargar la información del programa':'Cargando información del programa',sub:state.phase==='error'?'Revisa tu conexión e inténtalo de nuevo.':''}),state.phase==='error'&&h(window.Btn,{onClick:state.retry},'Reintentar'));}
  const input={width:'100%',boxSizing:'border-box',border:'none',borderRadius:12,padding:'11px 13px',background:'var(--surface-2)',boxShadow:'var(--neo-inset)',color:'var(--ink)',font:'inherit',marginBottom:12};
  function Editor({programKey,canWrite=true}){
    const state=useInfo(programKey,false),[draft,setDraft]=useState(null),[file,setFile]=useState(null),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[fav,setFav]=useState(false);
    useEffect(()=>{if(state.row){setDraft(JSON.parse(JSON.stringify(state.row)));setFile(null);}},[state.row]);
    const [previewUrl,setPreviewUrl]=useState(null);
    useEffect(()=>{if(!file){setPreviewUrl(null);return;}const url=URL.createObjectURL(file);setPreviewUrl(url);return()=>URL.revokeObjectURL(url);},[file]);
    if(!draft||draft.item_key!==programKey)return h(InfoState,{state});
    const p=draft.program_info,disabled=!canWrite||busy;
    const set=(k,v)=>setDraft(d=>({...d,[k]:v}));const info=(k,v)=>setDraft(d=>({...d,program_info:{...d.program_info,[k]:v}}));
    const field=(title,key,value,onChange,multi=false)=>h('label',{key,style:{display:'block',fontSize:'var(--text-12, 12px)',fontWeight:800,color:'var(--ink-2)'}},h('span',{style:{display:'block',marginBottom:6}},title),h(multi?'textarea':'input',{'data-program-info-field':key,value,disabled,onChange:e=>onChange(e.target.value),rows:multi?4:undefined,maxLength:multi?6000:240,style:input}));
    const iconField=(title,key,value,onChange)=>h('label',{key,style:{display:'block',fontSize:'var(--text-12, 12px)',fontWeight:800}},title,h('select',{'data-program-info-field':key,value,disabled,onChange:e=>onChange(e.target.value),style:input},window.ICON_CATALOG.names.map(name=>h('option',{key:name,value:name},name))));
    const submit=async()=>{setBusy(true);setMessage('');try{let row=draft;if(file){const a=await upload(file);row={...draft,program_cover_asset_id:a.id,cover_url:a.url};setDraft(row);setFile(null);}const saved=await save(row);setDraft(saved);setMessage('Información guardada.');}catch(e){setMessage(String(e.message).includes('CONFLICT')?'La información cambió en otra sesión. Recarga antes de guardar.':String(e.message).includes('IMAGE_INVALID')?'Selecciona una imagen PNG, JPG, GIF o WebP de hasta 10 MB.':'No se pudo guardar la información. Revisa los campos y tus permisos e inténtalo de nuevo.');}finally{setBusy(false);}};
    const preview={...draft,cover_url:previewUrl||draft.cover_url};
    if(programKey==='terrenos')return h(React.Fragment,null,
      h('section',{'data-program-info-editor':programKey,style:{padding:16,borderRadius:18,background:'var(--surface)',marginBottom:18}},h('h2',null,'Información general del programa'),
        field('Nombre en Finanzas','name',draft.label_override,v=>set('label_override',v)),field('Tagline en Finanzas','tagline',draft.description_override,v=>set('description_override',v)),field('Detalle en Finanzas','detail',p.detail,v=>info('detail',v)),
        field('Título de cabecera','map_title',p.map_title,v=>info('map_title',v)),field('Subtítulo','map_subtitle',p.map_subtitle,v=>info('map_subtitle',v)),field('Nombre del programa en cabecera','map_program_label',p.map_program_label,v=>info('map_program_label',v)),field('Descripción de cabecera','map_description',p.map_description,v=>info('map_description',v)),iconField('Icono del programa','icon',p.icon,v=>info('icon',v)),
        h('p',null,'La vista pública de Terrenos conserva el mapa y su cabecera actual.'),h('div',{role:'status','data-program-info-message':true},message),h(window.Btn,{variant:'outline',disabled:busy,onClick:()=>{setDraft(null);state.retry();}},'Recargar'),canWrite&&h(window.Btn,{'data-program-info-save':true,disabled:busy,onClick:submit},busy?'Guardando…':'Guardar información general')),
      h('section',{'data-program-info-preview':programKey,style:{marginBottom:24}},h('h2',null,'Vista previa de cómo se verá'),h('div',{style:{maxWidth:430,borderRadius:24,overflow:'hidden'}},h(window.TerrainProgramHeader,{headerInfo:p,app:{back:()=>{}}}))));

    return h(React.Fragment,null,
      h('section',{'data-program-info-editor':programKey,style:{padding:16,borderRadius:18,background:'var(--surface)',boxShadow:'var(--neo-sm)',marginBottom:18}},h('h2',{style:{fontSize:'var(--text-17, 17px)',margin:'0 0 16px'}},'Información general del programa'),
        field('Nombre público del programa','name',draft.label_override,v=>set('label_override',v)),field('Tagline de la card en Finanzas','tagline',draft.description_override,v=>set('description_override',v)),field('Detalle de la card en Finanzas','detail',p.detail,v=>info('detail',v)),
        field('Breadcrumb (vacío: nombre del programa)','breadcrumb',p.breadcrumb,v=>info('breadcrumb',v)),field('Descripción principal','description',p.description,v=>info('description',v),true),iconField('Icono','icon',p.icon,v=>info('icon',v)),
        h('label',{style:{display:'block',fontSize:'var(--text-12, 12px)',fontWeight:800,marginBottom:12}},'Portada / imagen principal',h('input',{'data-program-info-cover':true,type:'file',accept:'image/png,image/jpeg,image/webp,image/gif',disabled,onChange:e=>{setFile(e.target.files[0]||null);e.target.value='';},style:{display:'block',marginTop:8,maxWidth:'100%'}})),
        (preview.cover_url)&&h('div',{style:{marginBottom:12}},h('img',{src:preview.cover_url,alt:'Portada seleccionada',style:{width:'100%',height:110,objectFit:'cover',borderRadius:12}}),h('button',{disabled,onClick:()=>{setFile(null);setDraft(d=>({...d,program_cover_asset_id:null,cover_url:null}));}},'Quitar portada')),
        field('Teléfono / Llamar','phone',p.phone,v=>info('phone',v)),field('WhatsApp (incluye código de país)','whatsapp',p.whatsapp,v=>info('whatsapp',v)),
        [['favorite_enabled','Mostrar Guardar / Favorito'],['popular','Insignia POPULAR']].map(([k,title])=>h('label',{key:k,style:{display:'block',marginBottom:12}},h('input',{type:'checkbox',checked:p[k],disabled,onChange:e=>info(k,e.target.checked)}),' '+title)),
        h('label',{style:{display:'block',marginBottom:12}},h('input',{type:'checkbox',checked:draft.enabled,disabled,onChange:e=>set('enabled',e.target.checked)}),' Visible en la app'),
        field('Título de ventajas','benefits_title',p.benefits_title,v=>info('benefits_title',v)),
        p.benefits.map((b,index)=>{const change=(k,v)=>info('benefits',p.benefits.map((entry,i)=>i===index?{...entry,[k]:v}:entry));return h('fieldset',{key:index,disabled,style:{border:'1px solid var(--hairline)',borderRadius:12,marginBottom:12,minWidth:0}},h('legend',null,'Ventaja '+(index+1)),iconField('Icono','benefit-'+index+'-icon',b.icon,v=>change('icon',v)),field('Título','benefit-'+index+'-title',b.t,v=>change('t',v)),field('Texto secundario','benefit-'+index+'-text',b.s,v=>change('s',v),true),h('button',{onClick:()=>info('benefits',p.benefits.filter((_,i)=>i!==index))},'Quitar ventaja'));}),
        canWrite&&p.benefits.length<12&&h(window.Btn,{variant:'outline',onClick:()=>info('benefits',p.benefits.concat({icon:'checkCircle',t:'',s:''}))},'Agregar ventaja'),
        field('Título del catálogo','catalog_title',p.catalog_title,v=>info('catalog_title',v)),
        h('div',{role:'status','data-program-info-message':true,style:{fontSize:'var(--text-13, 13px)',marginBottom:12}},message),
        h('div',{style:{display:'flex',gap:10}},h(window.Btn,{variant:'outline',disabled:busy,onClick:()=>{setDraft(null);setMessage('');state.retry();}},'Recargar'),canWrite&&h(window.Btn,{'data-program-info-save':true,disabled:busy,onClick:submit},busy?'Guardando…':'Guardar información general'))),
      h('section',{'data-program-info-preview':programKey,style:{marginBottom:24}},h('h2',{style:{fontSize:'var(--text-17, 17px)'}},'Vista previa de cómo se verá'),h('div',{style:{maxWidth:430,margin:'0 auto',background:'var(--bg)',borderRadius:24,overflow:'hidden',boxShadow:'var(--neo-md)'}},h(Cover,{url:preview.cover_url,icon:p.icon,hue:draft.group_key==='bienestar'?36:210}),h('div',{style:{position:'relative',zIndex:1,padding:'18px 20px 30px'}},h(PublicHeader,{row:preview,favorite:fav,onFavorite:()=>setFav(!fav),notify:setMessage}),h('div',{style:{marginTop:24}},h(window.SectionHead,{title:p.catalog_title}))))));
  }
  window.ProgramGeneralInfo=Object.freeze({keys,get,save,upload,useInfo,Cover,PublicHeader,InfoState,Editor});
})();
