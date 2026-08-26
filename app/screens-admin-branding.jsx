/* H-008 branding editor. Auth: Supabase session; authorization: backend RLS. */
(function () {
  'use strict';
  const I = window.Icon;
  const box = { width:'100%', border:'none', background:'var(--surface-2)', boxShadow:'var(--neo-inset)', borderRadius:12, padding:'11px 13px', fontSize:14, fontWeight:600, fontFamily:'inherit', color:'var(--ink)', boxSizing:'border-box' };
  const label = { fontSize:12.5, fontWeight:800, color:'var(--ink-2)', display:'block', marginBottom:7 };

  function Card({ title, sub, children }) {
    return React.createElement('div',{style:{background:'var(--surface)',borderRadius:18,padding:16,boxShadow:'var(--neo-sm)',marginBottom:14}},
      React.createElement('div',{style:{fontSize:15,fontWeight:900,color:'var(--ink)'}},title),
      sub && React.createElement('div',{style:{fontSize:11.5,fontWeight:600,color:'var(--ink-3)',margin:'3px 0 13px'}},sub),children);
  }
  function Preview({url,alt,ratio='1 / 1',fit='contain',position='50% 50%'}) { return React.createElement('div',{style:{aspectRatio:ratio,borderRadius:14,overflow:'hidden',background:'var(--surface-2)',display:'grid',placeItems:'center',boxShadow:'var(--neo-inset)'}},url?React.createElement('img',{src:url,alt,style:{width:'100%',height:'100%',objectFit:fit,objectPosition:position}}):React.createElement('span',{style:{fontSize:11,fontWeight:700,color:'var(--ink-3)'}},'No configurada')); }
  function Upload({ title,url,assetKey,field,canEdit,onDone,nullable,ratio }) {
    const [busy,setBusy]=React.useState(false); const input=React.useRef(null);
    const change=async(e)=>{const file=e.target.files&&e.target.files[0]; if(!file)return; setBusy(true); try{await window.AdminRepository.uploadBrandingAsset(file,assetKey,field); await onDone();}catch(_){alert('No fue posible guardar el archivo.');}finally{setBusy(false);e.target.value='';}};
    const clear=async()=>{setBusy(true);try{await window.AdminRepository.clearAsset(field);await onDone();}catch(_){alert('No fue posible quitar el archivo.');}finally{setBusy(false);}};
    return React.createElement('div',{'data-h008-asset-control':field},React.createElement('div',{style:label},title),React.createElement(Preview,{url,alt:title,ratio}),
      React.createElement('input',{ref:input,type:'file',accept:'image/png,image/jpeg,image/gif,image/webp,image/svg+xml,image/x-icon',onChange:change,style:{display:'none'},disabled:!canEdit||busy}),
      React.createElement('div',{style:{display:'flex',gap:6,marginTop:7}},
        React.createElement('button',{disabled:!canEdit||busy,onClick:()=>input.current.click(),style:{flex:1,border:'none',borderRadius:10,padding:8,background:'var(--guinda)',color:'#fff',fontWeight:800}},busy?'Guardando…':url?'Reemplazar':'Subir'),
        nullable&&url&&React.createElement('button',{disabled:!canEdit||busy,onClick:clear,style:{border:'none',borderRadius:10,padding:8,background:'var(--surface-2)',color:'var(--ink-2)',fontWeight:800}},'Quitar')));
  }
  function HomeHeaderPhoto({canEdit,onDone}) {
    const resource=window.useAsset('home.header.collapsed');const [busy,setBusy]=React.useState(false);const input=React.useRef(null);
    const url=resource&&resource.kind==='image'?resource.url:null;
    const change=async(e)=>{const file=e.target.files&&e.target.files[0];if(!file)return;setBusy(true);try{await window.AdminRepository.uploadResourceAsset(file,'home.header.collapsed');await onDone();}catch(_){alert('No fue posible guardar la foto.');}finally{setBusy(false);e.target.value='';}};
    const restore=async()=>{setBusy(true);try{await window.AdminRepository.resetResourceAsset('home.header.collapsed');await onDone();}catch(_){alert('No fue posible restaurar la foto original.');}finally{setBusy(false);}};
    return React.createElement(Card,{title:'Foto de la cabecera de Inicio',sub:'Se revela al colapsar la cabecera durante el scroll.'},
      React.createElement('div',{'data-home-header-resource':'home.header.collapsed'},
        React.createElement(Preview,{url,alt:'Foto de la cabecera de Inicio',ratio:'12 / 5',fit:'cover',position:'50% 32%'}),
        React.createElement('input',{ref:input,type:'file',accept:'image/jpeg,image/webp,image/png',onChange:change,style:{display:'none'},disabled:!canEdit||busy}),
        React.createElement('div',{style:{display:'flex',gap:7,marginTop:9}},
          React.createElement('button',{type:'button',disabled:!canEdit||busy,onClick:()=>input.current.click(),style:{flex:1,border:'none',borderRadius:10,padding:9,background:'var(--guinda)',color:'#fff',fontWeight:800}},busy?'Guardando…':'Subir / reemplazar'),
          React.createElement('button',{type:'button',disabled:!canEdit||busy,onClick:restore,style:{border:'none',borderRadius:10,padding:9,background:'var(--surface-2)',color:'var(--ink-2)',fontWeight:800}},'Restaurar la original')),
        React.createElement('div',{style:{fontSize:11.5,lineHeight:1.45,color:'var(--ink-3)',fontWeight:650,marginTop:9}},'Recomendación: JPG/WebP horizontal, mínimo 1200 × 500 px, sujeto centrado.')));
  }
  function BrandingModule({app,onBack,header,canEdit}) {
    const branding=app.visual.phase==='loaded'?app.visual.branding:null;
    const [form,setForm]=React.useState({app_name:'',short_name:'',description:''}); const [busy,setBusy]=React.useState(false);
    React.useEffect(()=>{if(branding)setForm({app_name:branding.app_name,short_name:branding.short_name,description:branding.description});},[branding&&branding.updated_at]);
    const reload=async()=>{await app.visual.retry();};
    const save=async()=>{setBusy(true);try{await window.AdminRepository.updateSettings(form);await reload();app.toast('Cambios guardados');}catch(_){app.toast('No fue posible guardar');}finally{setBusy(false);}};
    const set=(name)=>(e)=>setForm(Object.assign({},form,{[name]:e.target.value}));
    const shots=branding?branding.install_screens:[null,null,null];
    const assetControls=branding&&[
      ['Ícono de la app',branding.app_icon_url,'brand.pwa.512','app_icon_asset_id',false],
      ['Sello institucional',branding.institutional_seal_url,'brand.institutional-seal','institutional_seal_asset_id',true],
      ['Favicon / PWA 192',branding.favicon_url,'brand.favicon-pwa-192','favicon_asset_id',false],
      ['Apple Touch',branding.apple_touch_url,'brand.pwa.apple-touch','apple_touch_asset_id',false],
      ['PWA maskable 512',branding.pwa_maskable_512_url,'brand.pwa.maskable-512','pwa_maskable_512_asset_id',false]
    ];
    return React.createElement('div',{'data-branding-source':'supabase','data-branding-state':app.visual.phase,'data-h008-admin-editor':canEdit?'enabled':'denied'},
      header({title:'Ícono e instalación',sub:'Identidad visual de la aplicación',onBack}),
      React.createElement('div',{className:'su-app-scroll',style:{padding:16}},
        React.createElement('div',{style:{padding:12,borderRadius:12,background:canEdit?'#E7F6ED':'#FDEAEA',color:canEdit?'#13794A':'#A32921',fontSize:12,fontWeight:800,marginBottom:14}},canEdit?'Puedes actualizar la identidad visual de la aplicación.':'Tu cuenta puede consultar esta sección, pero no modificarla.'),
        React.createElement(Card,{title:'Nombre y descripción',sub:'Estos textos se muestran en la aplicación y durante su instalación.'},
          [['app_name','Nombre de la aplicación'],['short_name','Nombre corto'],['description','Descripción']].map(([name,title])=>React.createElement('label',{key:name,style:Object.assign({},label,{marginBottom:10})},title,React.createElement('input',{'data-branding-field':name,value:form[name],onChange:set(name),disabled:!canEdit||busy,maxLength:name==='app_name'?80:name==='short_name'?30:240,style:Object.assign({},box,{marginTop:6})}))),
          React.createElement('button',{'data-h008-save-settings':'',disabled:!canEdit||busy,onClick:save,style:{width:'100%',border:'none',borderRadius:12,padding:12,background:'var(--guinda)',color:'#fff',fontWeight:900}},busy?'Guardando…':'Guardar textos')),
        React.createElement(Card,{title:'Íconos e identidad visual',sub:'Formatos de imagen permitidos; tamaño máximo de 10 MB.'},
          React.createElement('div',{style:{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}},assetControls&&assetControls.map((x)=>React.createElement(Upload,{key:x[3],title:x[0],url:x[1],assetKey:x[2],field:x[3],nullable:x[4],canEdit,onDone:reload})))),
        React.createElement(HomeHeaderPhoto,{canEdit,onDone:reload}),
        React.createElement(Card,{title:'Imágenes de instalación',sub:'Orden explícito 1, 2 y 3.'},
          React.createElement('div',{style:{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8}},[0,1,2].map((i)=>React.createElement('div',{key:i,'data-install-position':String(i+1)},React.createElement(Upload,{title:`Pantalla ${i+1}`,url:shots[i],assetKey:`pwa.install-screen-${i+1}`,field:`install_screen_${i+1}_asset_id`,nullable:true,ratio:'9 / 16',canEdit,onDone:reload}))))),
        branding&&React.createElement(Card,{title:'Vista previa',sub:'Así se verá la identidad principal de la aplicación.'},React.createElement('div',{style:{display:'flex',gap:12,alignItems:'center'}},React.createElement('div',{style:{width:58}},React.createElement(Preview,{url:branding.app_icon_url,alt:''})),React.createElement('div',null,React.createElement('div',{'data-branding-preview-name':'',style:{fontWeight:900}},form.app_name),React.createElement('div',{'data-branding-preview-description':'',style:{fontSize:12,color:'var(--ink-3)'}},form.description))))));
  }
  window.BrandingModule=BrandingModule;
})();
