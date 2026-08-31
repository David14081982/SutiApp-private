/* Admin-only in-memory projection over ProgramCatalogRepository. */
(function () {
  const {useEffect,useState}=React,listeners=new Set();
  let items=[],phase='idle',error=null,promise=null;
  const labels=Object.freeze({aires:'Aires acondicionados',auto:'Autos',casa:'Casa',computo:'Cómputo',donativos:'Donativos',farma:'Suti Farma',prestamo:'Suti Préstamo',puertas:'Puertas de seguridad',renta:'Renta de vehículos',solar:'Paneles solares',terrenos:'Terrenos',tours:'Tours'});
  const icons=Object.freeze({aires:'snow',auto:'car',casa:'home',computo:'laptop',donativos:'heart',farma:'health',prestamo:'cash',puertas:'shield',renta:'car',solar:'sun',terrenos:'pin',tours:'plane'});
  const emit=()=>listeners.forEach((fn)=>fn());
  async function load(force){if(promise&&!force)return promise;phase='loading';error=null;emit();promise=(async()=>{try{items=(await window.ProgramCatalogRepository.listItems({admin:true})).slice();phase='loaded';}catch(e){phase='error';error=e;}emit();return store;})();return promise;}
  async function refreshConsumers(){await load(true);if(window.catalogStore)await window.catalogStore.retry();}
  const store={
    bootstrap:()=>load(false),retry:()=>{promise=null;return load(true);},state:()=>({phase,error}),all:()=>items.slice(),
    programs:()=>Array.from(new Set(items.map((x)=>x.program_key))).sort((a,b)=>(labels[a]||a).localeCompare(labels[b]||b)).map((key)=>{const rows=items.filter((x)=>x.program_key===key);return{key,label:labels[key]||key,icon:icons[key]||'grid',count:rows.length,active:rows.filter((x)=>x.activo!==false).length,fixed:rows.filter((x)=>x.precio!=null&&!x.cotiza).length,quote:rows.filter((x)=>x.cotiza).length};}),
    byProgram:(key)=>items.filter((x)=>x.program_key===key).sort((a,b)=>(a.orden||0)-(b.orden||0)||String(a.nombre).localeCompare(String(b.nombre))),
    get:(id)=>items.find((x)=>x.id===id)||null,
    blank:(programKey)=>({id:null,program_key:programKey,scope:'fin',scopeId:programKey,nombre:'',desc:'',category_raw:'',precio:null,cotiza:true,activo:true,orden:store.byProgram(programKey).length+1,record_origin:'ADMIN_PROGRAM_CATALOG',requestMode:'supabase',source_sheet:null,source_row_ordinal:null,imagenAssets:[],imagenes:[]}),
    save:async(item,media)=>{const uploaded=[],assets=[];try{for(const entry of media||[]){if(entry.kind==='pending'){const asset=await window.ProgramCatalogRepository.uploadAdminAsset(entry.file,item.nombre);uploaded.push(asset);assets.push(asset);}else assets.push(entry.asset||entry);}const saved=await window.ProgramCatalogRepository.saveAdminItem(item,assets);await refreshConsumers();return saved;}catch(e){await Promise.all(uploaded.map((asset)=>window.ProgramCatalogRepository.discardAdminAsset(asset).catch(()=>null)));throw e;}},
    toggle:async(id)=>{const item=store.get(id);if(!item)return;await store.save(Object.assign({},item,{activo:item.activo===false}),(item.imagenAssets||[]).map((asset)=>({kind:'existing',asset})));},
    move:async(id,direction)=>{const item=store.get(id);if(!item)return;const rows=store.byProgram(item.program_key),from=rows.findIndex((x)=>x.id===id),to=from+direction;if(from<0||to<0||to>=rows.length)return;const reordered=rows.slice(),picked=reordered.splice(from,1)[0];reordered.splice(to,0,picked);await window.ProgramCatalogRepository.reorderAdminItems(item.program_key,reordered.map((x)=>x.id));await refreshConsumers();},
    subscribe:(fn)=>{listeners.add(fn);return()=>listeners.delete(fn);}
  };
  window.programCatalogAdminStore=store;
  window.useProgramCatalogAdminStore=function(){const[,render]=useState(0);useEffect(()=>store.subscribe(()=>render((n)=>n+1)),[]);useEffect(()=>{store.bootstrap();},[]);return store;};
})();
