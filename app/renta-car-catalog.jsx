/* Rental presentation only. Existing catalog, media, routing and rental flow remain authoritative. */
(function(){
 'use strict';
 const h=React.createElement,{useState,useRef,useEffect}=React;
 const labels=[['engine','Motor'],['vehicle_type','Tipo'],['seats','Asientos'],['tank','Tanque']];
 const price=item=>item.precio!=null&&!item.cotiza?window.money(item.precio)+'/día':'Precio por confirmar';
 const css=`
 [data-rental-catalog],[data-rental-sheet],[data-rental-admin]{font-size:16px}
 [data-rental-catalog] *,[data-rental-sheet] *,[data-rental-admin] *{box-sizing:border-box}
 :is([data-rental-catalog],[data-rental-sheet],[data-rental-admin]){--text-9:14px;--text-9-5:14px;--text-10:14px;--text-10-5:14px;--text-11:14px;--text-11-5:14px;--text-12:14px;--text-12-5:14px;--text-13:14px;--text-13-5:14px}
 :is([data-rental-catalog],[data-rental-sheet],[data-rental-admin]) :is([style*="font-size: 9px"],[style*="font-size: 9.5px"],[style*="font-size: 10px"],[style*="font-size: 10.5px"],[style*="font-size: 11px"],[style*="font-size: 11.5px"],[style*="font-size: 12px"],[style*="font-size: 12.5px"],[style*="font-size: 13px"],[style*="font-size: 13.5px"]){font-size:14px!important}
 [data-rental-catalog] button,[data-rental-sheet] button{font-family:inherit}
 .rc-catalog{position:absolute;inset:0;background:var(--bg);overflow-y:auto;padding:18px 16px 40px}
 .rc-catalog header{display:flex;align-items:center;gap:12px;margin-bottom:22px}
 .rc-catalog h1{font-size:26px;line-height:1.2;margin:0;font-weight:850}
 .rc-catalog header p{font-size:14px;color:var(--ink-2);margin:5px 0 0}
 .rc-icon{width:44px;height:44px;display:grid;place-items:center;border:0;border-radius:14px;background:var(--surface);color:var(--ink);flex-shrink:0;cursor:pointer}
 .rc-card{display:block;width:100%;text-align:left;background:var(--surface);border:1px solid var(--hairline);border-radius:24px;overflow:hidden;padding:0;margin:0 0 20px;color:var(--ink);box-shadow:var(--neo-sm);cursor:pointer}
 .rc-card:focus-visible,.rc-icon:focus-visible{outline:3px solid var(--guinda);outline-offset:3px}
 .rc-card-head{display:flex;justify-content:space-between;gap:12px;padding:20px 18px 14px;align-items:flex-start}
 .rc-card-name{font-size:21px;font-weight:850;line-height:1.25;overflow-wrap:anywhere}
 .rc-year{display:block;font-size:16px;color:var(--ink-2);margin-top:5px}
 .rc-price{font-size:18px;font-weight:850;color:var(--guinda);white-space:nowrap}
 .rc-photo{position:relative;width:100%;aspect-ratio:16/10;background:var(--surface-2)}
 .rc-photo img{display:block;width:100%;height:100%;object-fit:contain}
 .rc-photo-empty{height:100%;display:grid;place-items:center;color:var(--ink-2);padding:24px}
 .rc-specs{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px 12px;margin:0;padding:20px 18px}
 .rc-specs div{min-width:0}.rc-specs dt{font-size:14px;line-height:1.4;color:var(--ink-2);margin-bottom:5px}
 .rc-specs dd{font-size:16px;font-weight:750;line-height:1.4;margin:0;overflow-wrap:anywhere}
 .rc-specs .rc-spec-price{grid-column:span 2}.rc-spec-price dd{color:var(--guinda)}
 .rc-card-foot{display:flex;align-items:center;justify-content:space-between;gap:8px;border-top:1px solid var(--hairline);padding:14px 18px;color:var(--guinda);font-size:14px;font-weight:800}
 .rc-info{margin-top:24px;padding-top:38px}.rc-info [data-category-header-icon]{margin-top:0!important}
 .rc-overlay{position:absolute;inset:0;display:flex;align-items:flex-end;background:rgba(20,16,25,.4);z-index:1}
 .rc-sheet{position:relative;display:flex;flex-direction:column;background:var(--bg);width:100%;height:76%;border-radius:26px 26px 0 0;overflow:hidden;box-shadow:0 -10px 35px rgba(20,16,25,.18);animation:rc-rise .28s ease-out;transition:height .25s ease,transform .2s ease}
 .rc-sheet[data-expanded=true]{height:98%}.rc-sheet-head{display:flex;align-items:center;gap:8px;padding:8px 12px;background:var(--surface);border-bottom:1px solid var(--hairline);flex-shrink:0;touch-action:none;user-select:none}
 .rc-grip{flex:1;min-height:44px;display:flex;align-items:center;justify-content:center;gap:10px;border:0;background:transparent;color:var(--ink-2);font-size:14px;font-weight:700;cursor:ns-resize}
 .rc-grip:before{content:'';width:38px;height:5px;background:var(--ink-3);opacity:.5;border-radius:9px}
 .rc-sheet-body{position:relative;flex:1;min-height:0}.rc-sheet-body>div{height:100%}
 [data-rental-sheet] [data-renta-calendar] button{font-size:14px;min-width:0}
 [data-rental-sheet] [data-renta-calendar] small{font-size:14px!important}
 [data-rental-sheet] [data-renta-calendar] button small{font-size:14px!important;overflow:hidden;text-indent:-9999px;height:3px;background:currentColor;margin:2px 5px 0}
 [data-rental-sheet] [data-renta-calendar] [aria-label="Mes anterior"],[data-rental-sheet] [data-renta-calendar] [aria-label="Mes siguiente"]{width:44px;height:44px;border:1px solid var(--hairline);border-radius:12px;background:var(--surface);color:var(--ink);font-size:24px}
 [data-rental-admin] label{font-size:14px!important}.rc-admin-fields{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin:16px 0}.rc-admin-fields label{display:flex;flex-direction:column;gap:7px;font-weight:750;min-width:0}
 .rc-admin-fields input{width:100%;min-height:44px;padding:11px 13px;border:1px solid var(--hairline);border-radius:12px;font:inherit;background:var(--surface);color:var(--ink)}
 @keyframes rc-rise{from{transform:translateY(100%)}to{transform:translateY(0)}}
 @media(prefers-reduced-motion:reduce){.rc-sheet{animation:none;transition:none}}
 `;
 function Specs({item,includePrice=true}){const specs=item.rental_specs||{};return h('dl',{className:'rc-specs','data-rental-specs':true},labels.map(([key,label])=>h('div',{key},h('dt',null,label),h('dd',{'data-rental-spec':key},specs[key]||'No registrado'))),includePrice&&h('div',{className:'rc-spec-price'},h('dt',null,'Precio por día'),h('dd',null,price(item))));}
 function VehicleCard({item,onOpen}){const asset=window.ProgramCatalogRepository.imageAssets(item)[0];return h('button',{type:'button',className:'rc-card','data-rental-card':item.id,onClick:()=>onOpen(item),'aria-label':'Ver '+item.nombre},
  h('div',{className:'rc-card-head'},h('div',null,h('div',{className:'rc-card-name'},item.nombre),h('span',{className:'rc-year'},item.rental_specs?.year?'Año '+item.rental_specs.year:'Año no registrado')),h('div',{className:'rc-price'},price(item))),
  h('div',{className:'rc-photo'},asset?h(window.ProgramCatalogImage,{asset,alt:item.nombre}):h('div',{className:'rc-photo-empty'},'Imagen no registrada')),
  h(Specs,{item}),h('div',{className:'rc-card-foot'},h('span',null,item.sold?'No disponible':'Ver vehículo y disponibilidad'),h(window.Icon,{name:'arrowR',size:20})));
 }
 function Catalog({app,it,hue,cs,metadata,favorite,onFavorite}){
  const state=cs?cs.state():{phase:'loading'},items=cs?cs.live('fin','renta'):[],available=items.filter(x=>!x.sold),unavailable=items.filter(x=>x.sold);
  useEffect(()=>{const refresh=()=>cs&&cs.retry();window.addEventListener('focus',refresh);return()=>window.removeEventListener('focus',refresh);},[cs]);
  const open=item=>app.push('catitem',{item,ctx:{id:it.id,label:it.label,icon:it.icon,hue}});
  return h('div',{'data-rental-catalog':true,className:'rc-catalog su-app-scroll'},h('style',null,css),
   h('header',null,h('button',{className:'rc-icon',onClick:app.back,'aria-label':'Atrás'},h(window.Icon,{name:'arrowL',size:23})),h('div',null,h('h1',null,it.label||'Renta Car'),h('p',null,'Elige tu vehículo y consulta las fechas'))),
   state.phase==='loading'||state.phase==='idle'?h('p',{role:'status'},'Cargando vehículos…'):state.phase==='error'?h('div',{role:'alert'},h('p',null,'No pudimos consultar los vehículos.'),h(window.Btn,{onClick:()=>cs.retry()},'Reintentar')):h(React.Fragment,null,
    h('h2',{style:{fontSize:18,margin:'0 0 14px'}},'Vehículos disponibles'),available.length?available.map(item=>h(VehicleCard,{key:item.id,item,onOpen:open})):h('p',null,'No hay vehículos disponibles por el momento.'),
    unavailable.length>0&&h('section',null,h('h2',{style:{fontSize:18}},'No disponibles'),unavailable.map(item=>h(VehicleCard,{key:item.id,item,onOpen:open})))),
   h('section',{className:'rc-info','aria-label':'Información y contacto de Renta Car'},metadata.row?h(window.ProgramGeneralInfo.PublicHeader,{row:metadata.row,favorite,onFavorite,notify:app.toast}):h(window.ProgramGeneralInfo.InfoState,{state:metadata})));
 }
 function DetailSheet({app,children}){
  const [expanded,setExpanded]=useState(false),[drag,setDrag]=useState(0),gesture=useRef(null),grip=useRef(null),closed=useRef(false),moved=useRef(false),dialog=useRef(null);
  const close=()=>{if(!closed.current){closed.current=true;app.back();}};
  useEffect(()=>{grip.current?.focus({preventScroll:true});const key=e=>{
   if(document.querySelector('[role=dialog]:not([data-rental-sheet])'))return;
   if(e.key==='Escape'){e.preventDefault();close();}
   if(e.key==='Tab'){const controls=[...dialog.current.querySelectorAll('button:not(:disabled),input:not(:disabled),textarea:not(:disabled),select:not(:disabled),a[href],[tabindex="0"]')].filter(n=>n.getClientRects().length),first=controls[0],last=controls[controls.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}
  };window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);},[]);
  const down=e=>{if(e.target.closest('[data-rental-close]'))return;moved.current=false;gesture.current={y:e.clientY,id:e.pointerId};e.target.setPointerCapture(e.pointerId);};
  const move=e=>{if(gesture.current)setDrag(e.clientY-gesture.current.y);};
  const up=e=>{if(!gesture.current)return;const delta=e.clientY-gesture.current.y;gesture.current=null;moved.current=Math.abs(delta)>10;setDrag(0);if(delta < -45)setExpanded(true);else if(delta>90){if(expanded)setExpanded(false);else close();}};
  return h('div',{className:'rc-overlay',onClick:e=>{if(e.target===e.currentTarget)close();}},h('style',null,css),h('section',{ref:dialog,role:'dialog','aria-modal':true,'aria-label':'Detalle del vehículo','data-rental-sheet':true,className:'rc-sheet','data-expanded':expanded,style:drag>0?{transform:'translateY('+Math.min(drag,160)+'px)',transition:'none'}:undefined},
   h('div',{className:'rc-sheet-head',onPointerDown:down,onPointerMove:move,onPointerUp:up,onPointerCancel:()=>{gesture.current=null;setDrag(0);}},h('button',{ref:grip,className:'rc-grip',type:'button','aria-expanded':expanded,onClick:e=>{if(e.detail===0||!moved.current)setExpanded(x=>!x);}},expanded?'Reducir detalle':'Expandir detalle'),h('button',{'data-rental-close':true,className:'rc-icon',onClick:close,'aria-label':'Cerrar detalle'},h(window.Icon,{name:'close',size:23}))),h('div',{className:'rc-sheet-body'},children)));
 }
 function Fields({draft,set}){return h(React.Fragment,null,h('style',null,css),h('fieldset',{style:{border:0,padding:0,margin:0}},h('legend',{style:{fontSize:18,fontWeight:850}},'Características del vehículo'),h('div',{className:'rc-admin-fields'},[['year','Año'],...labels].map(([key,label])=>h('label',{key},label,h('input',{'data-rental-field':key,type:key==='year'?'number':'text',min:key==='year'?1900:undefined,max:key==='year'?2100:undefined,maxLength:key==='year'?undefined:key==='engine'?120:key==='vehicle_type'?80:40,value:draft.rental_specs?.[key]??'',onChange:e=>set('rental_specs',{...(draft.rental_specs||{}),[key]:key==='year'?(e.target.value===''?null:Number(e.target.value)):e.target.value})}))))));}
 Object.assign(window,{RentaCarCatalog:Catalog,RentaCarDetailSheet:DetailSheet,RentaCarSpecs:Specs,RentaCarFields:Fields});
})();
